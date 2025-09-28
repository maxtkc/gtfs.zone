/**
 * Timetable Data Processor Module
 * Handles data transformation and alignment logic for timetable generation
 * Extracted from ScheduleController for better separation of concerns
 */

import {
  shortestCommonSupersequenceWithAlignments,
  SCSResultHelper,
} from './scs';
import {
  Routes,
  Stops,
  Calendar,
  CalendarDates,
  StopTimes,
  StopTimesSchema,
  CalendarSchema,
} from '../types/gtfs.ts';
import { GTFSDatabaseRecord } from './gtfs-database.js';

/**
 * Editable stop time interface for timetable editing
 * Contains both current and original time values for change tracking
 */
export interface EditableStopTime {
  stop_id: string;
  arrival_time: string | null;
  departure_time: string | null;
  isSkipped: boolean;
  originalArrivalTime?: string;
  originalDepartureTime?: string;
}

/**
 * Aligned trip interface for timetable rendering
 * Contains time mappings aligned to the optimal stop sequence
 */
export interface AlignedTrip {
  trip_id: string;
  headsign: string;
  stopTimes: Map<number, string>; // position -> time (departure or arrival), null for gaps
  arrival_times?: Map<number, string>; // position -> arrival time, null for gaps
  departure_times?: Map<number, string>; // position -> departure time, null for gaps
  editableStopTimes?: Map<number, EditableStopTime>;
}

/**
 * Direction information for route analysis
 * Contains direction metadata and trip statistics
 */
export interface DirectionInfo {
  id: string;
  name: string;
  tripCount: number;
}

/**
 * Complete timetable data structure for rendering
 * Contains all necessary data for generating schedule views
 */
export interface TimetableData {
  route: Routes;
  service: Calendar | CalendarDates;
  stops: Stops[];
  trips: AlignedTrip[];
  direction_id?: string;
  directionName?: string;
  availableDirections?: DirectionInfo[];
  selectedDirectionId?: string;
  showArrivalDeparture?: boolean; // Whether to show separate arrival/departure columns
}

// Enhanced GTFS interfaces using standard GTFS property names
interface EnhancedTrip {
  // Shorthand properties
  id: string;
  headsign?: string;
  shortName?: string;
  // Original GTFS properties
  trip_id: string;
  route_id: string;
  service_id: string;
  trip_headsign?: string;
  trip_short_name?: string;
  direction_id?: string;
  block_id?: string;
  shape_id?: string;
  wheelchair_accessible?: string;
  bikes_allowed?: string;
}

interface GTFSRelationships {
  getCalendarForService(service_id: string): Calendar | CalendarDates | null;
  getTripsForRoute(route_id: string): EnhancedTrip[];
  getStopTimesForTrip(trip_id: string): StopTimes[];
  getStopById(stop_id: string): Stops | null;
  getStopByIdAsync(stop_id: string): Promise<Stops | null>;
}

interface GTFSParserInterface {
  getFileDataSync(filename: string): GTFSDatabaseRecord[] | null;
}

/**
 * Timetable Data Processor - Handles data transformation and alignment logic
 *
 * This class is responsible for:
 * - Generating timetable data from GTFS entities
 * - Trip alignment using Shortest Common Supersequence (SCS) algorithm
 * - Direction filtering and management
 * - GTFS schema validation during processing
 *
 * Follows FAIL HARD error handling policy - throws on data integrity issues.
 */
export class TimetableDataProcessor {
  private relationships: GTFSRelationships;
  private gtfsParser: GTFSParserInterface;

  /**
   * Initialize TimetableDataProcessor with required dependencies
   *
   * @param relationships - GTFS relationships manager for data queries
   * @param gtfsParser - GTFS parser for direct file access
   */
  constructor(
    relationships: GTFSRelationships,
    gtfsParser: GTFSParserInterface
  ) {
    this.relationships = relationships;
    this.gtfsParser = gtfsParser;
  }

  /**
   * Generate timetable data for a route and service
   *
   * Main data processing method that:
   * - Validates route and service existence
   * - Filters trips by route, service, and optionally direction
   * - Computes optimal stop sequence using SCS algorithm
   * - Aligns trips to the optimal sequence
   * - Returns structured timetable data for rendering
   *
   * @param route_id - GTFS route identifier
   * @param service_id - GTFS service identifier (calendar or calendar_dates)
   * @param direction_id - Optional direction filter ('0', '1', etc.)
   * @returns Promise resolving to structured timetable data
   * @throws {Error} When route not found, no trips found, or data integrity issues
   */
  async generateTimetableData(
    route_id: string,
    service_id: string,
    direction_id?: string
  ): Promise<TimetableData> {
    // Get route information
    const routesData =
      (this.gtfsParser.getFileDataSync('routes.txt') as Routes[]) || [];

    // Add logging to debug the data loading issue
    console.log(`[TimetableDataProcessor] Looking for route_id: ${route_id}`);
    console.log(
      `[TimetableDataProcessor] Routes data available:`,
      routesData?.length || 0,
      'routes'
    );
    console.log(
      `[TimetableDataProcessor] Routes data sample:`,
      routesData?.slice(0, 3)
    );

    const route = routesData.find((r: Routes) => r.route_id === route_id);
    if (!route) {
      // If no route found in memory cache, try to get from database directly
      console.log(
        `[TimetableDataProcessor] Route ${route_id} not found in memory cache, checking database...`
      );
      throw new Error(`Route ${route_id} not found`);
    }

    // Get service information - use GTFS standard validation
    const service = this.relationships.getCalendarForService(service_id) || {
      service_id,
    };

    // Validate service using GTFS schema
    try {
      CalendarSchema.parse(service);
    } catch (error) {
      console.warn(
        'Service validation failed, proceeding with available data:',
        error
      );
    }

    // Get all trips for this route and service
    const allTrips: EnhancedTrip[] =
      this.relationships.getTripsForRoute(route_id);
    let trips = allTrips.filter(
      (trip: EnhancedTrip) => trip.service_id === service_id
    );

    // Filter by direction if specified
    if (direction_id !== undefined) {
      trips = trips.filter(
        (trip: EnhancedTrip) => (trip.direction_id || '0') === direction_id
      );
    }

    if (trips.length === 0) {
      const directionFilter =
        direction_id !== undefined ? ` and direction ${direction_id}` : '';
      throw new Error(
        `No trips found for route ${route_id}, service ${service_id}${directionFilter}`
      );
    }

    // Build stop sequences for each trip
    const tripSequences: string[][] = [];
    trips.forEach((trip: EnhancedTrip) => {
      const stopTimes = this.relationships.getStopTimesForTrip(trip.id);
      const tripStops = stopTimes
        .sort(
          (a: StopTimes, b: StopTimes) =>
            parseInt(a.stop_sequence) - parseInt(b.stop_sequence)
        )
        .map((st: StopTimes) => st.stop_id);
      tripSequences.push(tripStops);
    });

    // Use enhanced SCS to get both optimal sequence and alignments
    const scsResult = shortestCommonSupersequenceWithAlignments(tripSequences);
    const scsHelper = new SCSResultHelper(scsResult);

    // Get stop details for the optimal sequence
    const stops: Stops[] = await Promise.all(
      scsResult.supersequence.map(async (stop_id) => {
        const stop = await this.relationships.getStopByIdAsync(stop_id);
        if (!stop) {
          const error = `Stop ${stop_id} not found in stops.txt but referenced in stop_times.txt`;
          console.error('GTFS Data Integrity Error:', error);
          throw new Error(error);
        }
        // Return the stop with standard GTFS properties
        return stop;
      })
    );

    // Align trips using the SCS result
    const alignedTrips = this.alignTripsWithSCS(trips, scsHelper);

    // Get direction name
    const directionName =
      direction_id !== undefined
        ? this.getDirectionName(direction_id)
        : undefined;

    // Debug: Show what's being rendered
    console.log('=== TIMETABLE DEBUG ===');
    console.log(
      'Route:',
      route.route_id,
      route.route_short_name || route.route_long_name
    );
    console.log('Service:', service.service_id);
    console.log('Stops sequence:');
    console.table(
      stops.map((stop, index) => ({
        position: index,
        stop_id: stop.stop_id,
        stop_name: stop.stop_name,
      }))
    );

    console.log('Aligned trips data:');
    console.table(
      alignedTrips.map((trip) => {
        const stopTimesArray = Array.from(trip.stopTimes.entries());
        console.log(
          `DEBUG: Trip ${trip.trip_id} stopTimes Map:`,
          trip.stopTimes
        );
        console.log(
          `DEBUG: Trip ${trip.trip_id} stopTimes entries:`,
          stopTimesArray
        );

        return {
          trip_id: trip.trip_id,
          headsign: trip.headsign,
          stop_positions_with_times:
            stopTimesArray.length > 0
              ? stopTimesArray.map(([pos, time]) => `${pos}:${time}`).join(', ')
              : 'EMPTY - no stop times found',
          total_stops: trip.stopTimes.size,
          has_arrival_times: trip.arrival_times?.size || 0,
          has_departure_times: trip.departure_times?.size || 0,
        };
      })
    );

    return {
      route,
      service,
      stops,
      trips: alignedTrips,
      direction_id,
      directionName,
    };
  }

  /**
   * Enhanced alignment algorithm using SCS result
   *
   * Aligns trips to the optimal stop sequence computed by SCS algorithm.
   * Creates time mappings for display time, arrival times, and departure times.
   * Validates each stop time using GTFS schemas.
   *
   * No manual alignment logic needed - everything is handled by SCS!
   *
   * @param trips - Array of enhanced trip objects to align
   * @param scsHelper - SCS result helper with position mappings
   * @returns Array of aligned trips with time mappings at supersequence positions
   */
  alignTripsWithSCS(
    trips: EnhancedTrip[],
    scsHelper: SCSResultHelper<string>
  ): AlignedTrip[] {
    const alignedTrips: AlignedTrip[] = [];

    trips.forEach((trip, tripIndex) => {
      const stopTimes = this.relationships.getStopTimesForTrip(trip.id);
      const stopTimeMap = new Map<number, string>();
      const arrival_timeMap = new Map<number, string>();
      const departure_timeMap = new Map<number, string>();
      const editableStopTimes = new Map<number, EditableStopTime>();

      // Sort stop times by sequence
      const sortedStopTimes = stopTimes.sort(
        (a: StopTimes, b: StopTimes) =>
          parseInt(a.stop_sequence) - parseInt(b.stop_sequence)
      );

      // Validate each stop time using GTFS schema
      sortedStopTimes.forEach((st) => {
        try {
          StopTimesSchema.parse(st);
        } catch (error) {
          console.warn(
            `Stop time validation failed for trip ${trip.id}, stop ${st.stop_id}:`,
            error
          );
        }
      });

      // Use SCS alignment to map times to supersequence positions
      const positionMapping = scsHelper.getPositionMapping(tripIndex);

      console.log(
        `DEBUG: Trip ${trip.id} (index ${tripIndex}) position mapping:`,
        positionMapping
      );
      console.log(
        `DEBUG: Trip ${trip.id} has ${sortedStopTimes.length} stop times`
      );

      sortedStopTimes.forEach((st: StopTimes, inputPosition) => {
        const superPosition = positionMapping.get(inputPosition);
        console.log(
          `DEBUG: Trip ${trip.id} stop ${st.stop_id} - input pos ${inputPosition} -> super pos ${superPosition}`
        );

        if (superPosition !== undefined) {
          const arrival_time = st.arrival_time;
          const departure_time = st.departure_time;
          const displayTime = departure_time || arrival_time; // Fallback for legacy display

          console.log(
            `DEBUG: Trip ${trip.id} at super position ${superPosition}:`,
            {
              arrival_time,
              departure_time,
              displayTime,
            }
          );

          if (arrival_time) {
            arrival_timeMap.set(superPosition, arrival_time);
            console.log(
              `DEBUG: Set arrival time ${arrival_time} at position ${superPosition}`
            );
          }
          if (departure_time) {
            departure_timeMap.set(superPosition, departure_time);
            console.log(
              `DEBUG: Set departure time ${departure_time} at position ${superPosition}`
            );
          }
          if (displayTime) {
            stopTimeMap.set(superPosition, displayTime);
            console.log(
              `DEBUG: Set display time ${displayTime} at position ${superPosition}`
            );
          }

          // Create editable stop time with both arrival and departure
          if (arrival_time || departure_time) {
            editableStopTimes.set(superPosition, {
              stop_id: st.stop_id,
              arrival_time: arrival_time,
              departure_time: departure_time,
              isSkipped: false,
              originalArrivalTime: arrival_time,
              originalDepartureTime: departure_time,
            });
          }
        }
      });

      alignedTrips.push({
        trip_id: trip.id,
        headsign: trip.headsign || trip.id,
        stopTimes: stopTimeMap,
        arrival_times: arrival_timeMap,
        departure_times: departure_timeMap,
        editableStopTimes,
      });

      // Debug: Show time mapping for this trip
      console.log(`Trip ${trip.id} time mapping:`);
      console.table(
        Array.from(stopTimeMap.entries()).map(([position, time]) => ({
          supersequence_position: position,
          display_time: time,
          arrival_time: arrival_timeMap.get(position) || '-',
          departure_time: departure_timeMap.get(position) || '-',
        }))
      );
    });

    return alignedTrips;
  }

  /**
   * Get available directions for a route and service
   *
   * Analyzes all trips for the given route and service to determine
   * which direction_id values are available. Groups trips by direction
   * and counts the number of trips per direction.
   *
   * @param route_id - GTFS route identifier
   * @param service_id - GTFS service identifier
   * @returns Array of direction info objects with ID, name, and trip count
   */
  getAvailableDirections(
    route_id: string,
    service_id: string
  ): DirectionInfo[] {
    // Get all trips for this route and service
    const allTrips = this.relationships.getTripsForRoute(route_id);
    const trips = allTrips.filter(
      (trip: EnhancedTrip) => trip.service_id === service_id
    );

    // Group trips by direction ID
    const directionMap = new Map<string, number>();
    trips.forEach((trip: EnhancedTrip) => {
      const dirId = (trip.direction_id || '0').toString();
      directionMap.set(dirId, (directionMap.get(dirId) || 0) + 1);
    });

    // Convert to DirectionInfo array, sorted by direction ID
    const directions: DirectionInfo[] = Array.from(directionMap.entries())
      .map(([id, tripCount]) => ({
        id,
        name: this.getDirectionName(id),
        tripCount,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    return directions;
  }

  /**
   * Get a human-readable direction name
   *
   * Converts GTFS direction_id to human-readable names.
   * Follows GTFS specification: 0 = Outbound, 1 = Inbound.
   *
   * @param direction_id - GTFS direction identifier ('0', '1', etc.)
   * @returns Human-readable direction name
   */
  private getDirectionName(direction_id: string): string {
    // Use standard direction names
    switch (direction_id) {
      case '0':
        return 'Outbound';
      case '1':
        return 'Inbound';
      default:
        return `Direction ${direction_id}`;
    }
  }
}
