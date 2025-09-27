/**
 * Schedule Controller Module
 * Handles timetable view for routes showing aligned trips in a standard train schedule format
 * Accessed via Objects tab → Route → Service ID
 */

import {
  shortestCommonSupersequenceWithAlignments,
  SCSResultHelper,
} from './scs';
import { z } from 'zod';
import {
  Routes,
  Stops,
  Calendar,
  CalendarDates,
  Trips,
  StopTimes,
  GTFSTableMap,
} from '../types/gtfs-entities.js';
import { notifications } from './notification-system';

export interface EditableStopTime {
  stop_id: string;
  arrival_time: string | null;
  departure_time: string | null;
  isSkipped: boolean;
  originalArrivalTime?: string;
  originalDepartureTime?: string;
}

export interface AlignedTrip {
  trip_id: string;
  headsign: string;
  stopTimes: Map<number, string>; // position -> time (departure or arrival), null for gaps
  arrival_times?: Map<number, string>; // position -> arrival time, null for gaps
  departure_times?: Map<number, string>; // position -> departure time, null for gaps
  editableStopTimes?: Map<number, EditableStopTime>;
}

export interface DirectionInfo {
  id: string;
  name: string;
  tripCount: number;
}

export interface TimetableData {
  route: Routes;
  service: Calendar | CalendarDates;
  stops: EnhancedStop[];
  trips: AlignedTrip[];
  direction_id?: string;
  directionName?: string;
  availableDirections?: DirectionInfo[];
  selectedDirectionId?: string;
  showArrivalDeparture?: boolean; // Whether to show separate arrival/departure columns
}

// Validation schemas for editable fields
export const TimeValidationSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$|^(2[4-9]|[3-9]\d):[0-5]\d:[0-5]\d$/,
    'Invalid time format. Use HH:MM:SS (24-hour format, may exceed 24:00:00)'
  )
  .or(z.literal(''));

export const ServiceDateSchema = z
  .string()
  .regex(/^\d{8}$/, 'Date must be in YYYYMMDD format')
  .refine((date) => {
    const year = parseInt(date.substring(0, 4));
    const month = parseInt(date.substring(4, 6));
    const day = parseInt(date.substring(6, 8));
    return (
      year >= 1900 &&
      year <= 3000 &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    );
  }, 'Invalid date');

export const ServicePropertiesSchema = z.object({
  service_id: z.string().min(1, 'Service ID is required'),
  start_date: ServiceDateSchema.optional(),
  end_date: ServiceDateSchema.optional(),
  monday: z.boolean().optional(),
  tuesday: z.boolean().optional(),
  wednesday: z.boolean().optional(),
  thursday: z.boolean().optional(),
  friday: z.boolean().optional(),
  saturday: z.boolean().optional(),
  sunday: z.boolean().optional(),
});

export const EditableStopTimeSchema = z
  .object({
    stop_id: z.string().min(1, 'Stop ID is required'),
    arrival_time: TimeValidationSchema.nullable(),
    departure_time: TimeValidationSchema.nullable(),
    isSkipped: z.boolean(),
    originalArrivalTime: z.string().optional(),
    originalDepartureTime: z.string().optional(),
  })
  .refine(
    (data) => {
      // At least one time should be specified
      return data.arrival_time || data.departure_time;
    },
    {
      message: 'Either arrival time or departure time must be specified',
    }
  )
  .refine(
    (data) => {
      // If both times are specified, arrival should be <= departure
      if (data.arrival_time && data.departure_time) {
        return data.arrival_time <= data.departure_time;
      }
      return true;
    },
    {
      message: 'Arrival time must be before or equal to departure time',
      path: ['departure_time'],
    }
  );

// Enhanced GTFS interfaces with both original properties and shorthand convenience properties
interface EnhancedStop {
  // Shorthand properties
  id: string;
  name: string;
  // Original GTFS properties
  stop_id: string;
  stop_name: string;
  stop_code?: string;
  stop_desc?: string;
  stop_lat?: number;
  stop_lon?: number;
  zone_id?: string;
  stop_url?: string;
  location_type?: string;
  parent_station?: string;
  stop_timezone?: string;
  wheelchair_boarding?: string;
  level_id?: string;
  platform_code?: string;
}

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
}

interface GTFSParserInterface {
  getFileDataSync<T extends keyof GTFSTableMap>(filename: T): GTFSTableMap[T][];
  gtfsDatabase: {
    queryRows<T extends keyof GTFSTableMap>(
      tableName: T,
      filter?: { [key: string]: string | number | boolean }
    ): Promise<GTFSTableMap[T][]>;
    updateRow<T extends keyof GTFSTableMap>(
      tableName: T,
      key: string,
      data: Partial<GTFSTableMap[T]>
    ): Promise<void>;
    generateKey<T extends keyof GTFSTableMap>(
      tableName: T,
      data: GTFSTableMap[T]
    ): string;
  };
}

interface GTFSRelationships {
  getCalendarForService(service_id: string): Calendar | CalendarDates | null;
  getTripsForRoute(route_id: string): EnhancedTrip[];
  getStopTimesForTrip(trip_id: string): StopTimes[];
  getStopById(stop_id: string): EnhancedStop | null;
  getStopByIdAsync(stop_id: string): Promise<EnhancedStop | null>;
}

export class ScheduleController {
  private relationships: GTFSRelationships;
  private gtfsParser: GTFSParserInterface;

  constructor(
    gtfsRelationships: GTFSRelationships,
    gtfsParser: GTFSParserInterface
  ) {
    this.relationships = gtfsRelationships;
    this.gtfsParser = gtfsParser;
  }

  // ===== PUBLIC EDITING METHODS =====

  /**
   * Cast time from HH:MM to HH:MM:SS format
   */
  private castTimeToHHMMSS(timeInput: string): string {
    const trimmed = timeInput.trim();

    // If already in HH:MM:SS format, return as-is
    if (
      /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$|^(2[4-9]|[3-9]\d):[0-5]\d:[0-5]\d$/.test(
        trimmed
      )
    ) {
      return trimmed;
    }

    // If in HH:MM format, append :00
    if (/^([01]\d|2[0-3]):[0-5]\d$|^(2[4-9]|[3-9]\d):[0-5]\d$/.test(trimmed)) {
      return trimmed + ':00';
    }

    // If in H:MM format, pad with leading zero and append :00
    if (/^\d:[0-5]\d$/.test(trimmed)) {
      return '0' + trimmed + ':00';
    }

    // If in H:M format, pad both and append :00
    if (/^\d:\d$/.test(trimmed)) {
      const parts = trimmed.split(':');
      return (
        parts[0].padStart(2, '0') + ':' + parts[1].padStart(2, '0') + ':00'
      );
    }

    // Return original if no casting possible
    return trimmed;
  }

  /**
   * Update time for a specific stop in a trip
   */
  public async updateTime(
    trip_id: string,
    stop_id: string,
    newTime: string
  ): Promise<void> {
    try {
      // Cast time to HH:MM:SS format
      const castedTime = this.castTimeToHHMMSS(newTime);

      // Validate time format
      const validationResult = TimeValidationSchema.safeParse(castedTime);
      if (!validationResult.success) {
        console.error(
          'Invalid time format after casting:',
          validationResult.error
        );
        // Show error feedback to user
        this.showTimeError(
          trip_id,
          stop_id,
          'Invalid time format. Use HH:MM (24-hour)'
        );
        return;
      }

      // Update database directly
      await this.updateStopTimeInDatabase(trip_id, stop_id, castedTime);

      console.log(
        `Updated time for ${trip_id}/${stop_id} from ${newTime} to ${castedTime}`
      );
    } catch (error) {
      console.error('Failed to update time:', error);
      this.showTimeError(trip_id, stop_id, 'Failed to save time change');
    }
  }

  /**
   * Update arrival or departure time for a specific stop in a trip
   */
  public async updateArrivalDepartureTime(
    trip_id: string,
    stop_id: string,
    timeType: 'arrival' | 'departure',
    newTime: string
  ): Promise<void> {
    try {
      // Cast time to HH:MM:SS format
      const castedTime = this.castTimeToHHMMSS(newTime);

      // Validate time format
      const validationResult = TimeValidationSchema.safeParse(castedTime);
      if (!validationResult.success) {
        console.error(
          'Invalid time format after casting:',
          validationResult.error
        );
        this.showTimeError(
          trip_id,
          stop_id,
          'Invalid time format. Use HH:MM (24-hour)'
        );
        return;
      }

      // Get current times for validation
      const currentArrivalTime = await this.getCurrentArrivalTime(
        trip_id,
        stop_id
      );
      const currentDepartureTime = await this.getCurrentDepartureTime(
        trip_id,
        stop_id
      );

      // Validate arrival <= departure constraint if both are specified
      if (
        timeType === 'arrival' &&
        currentDepartureTime &&
        castedTime > currentDepartureTime
      ) {
        this.showTimeError(
          trip_id,
          stop_id,
          'Arrival time must be before or equal to departure time'
        );
        return;
      }
      if (
        timeType === 'departure' &&
        currentArrivalTime &&
        castedTime < currentArrivalTime
      ) {
        this.showTimeError(
          trip_id,
          stop_id,
          'Departure time must be after or equal to arrival time'
        );
        return;
      }

      // Update database directly
      await this.updateStopTimeInDatabase(
        trip_id,
        stop_id,
        castedTime,
        timeType
      );

      console.log(
        `Updated ${timeType} time for ${trip_id}/${stop_id} from ${newTime} to ${castedTime}`
      );
    } catch (error) {
      console.error('Failed to update arrival/departure time:', error);
      this.showTimeError(trip_id, stop_id, 'Failed to save time change');
    }
  }

  /**
   * Skip a stop for a trip
   */
  public async skipStop(trip_id: string, stop_id: string): Promise<void> {
    try {
      // Update database directly by setting times to null
      await this.updateStopTimeInDatabase(trip_id, stop_id, null);
      console.log(`Skipped stop ${stop_id} for trip ${trip_id}`);

      // Refresh the display
      this.refreshTimetableCell(trip_id, stop_id);
    } catch (error) {
      console.error('Failed to skip stop:', error);
    }
  }

  /**
   * Unskip a stop for a trip
   */
  public async unskipStop(trip_id: string, stop_id: string): Promise<void> {
    try {
      // TODO: Restore previous times or set to "00:00:00"
      // For now, set to "00:00:00" as a placeholder - user can edit
      await this.updateStopTimeInDatabase(trip_id, stop_id, '00:00:00');
      console.log(`Unskipped stop ${stop_id} for trip ${trip_id}`);

      // Refresh the display
      this.refreshTimetableCell(trip_id, stop_id);
    } catch (error) {
      console.error('Failed to unskip stop:', error);
    }
  }

  /**
   * Handle keyboard navigation in time inputs
   */
  public handleTimeKeyDown(
    event: KeyboardEvent,
    trip_id: string,
    stop_id: string
  ): void {
    const input = event.target as HTMLInputElement;

    switch (event.key) {
      case 'Tab':
        // Let default tab behavior handle navigation
        break;
      case 'Enter':
        input.blur(); // Trigger onchange
        this.focusNextTimeCell(trip_id, stop_id, event.shiftKey);
        event.preventDefault();
        break;
      case 'Escape':
        // Restore original value and blur
        input.value = input.defaultValue;
        input.blur();
        event.preventDefault();
        break;
      case 'ArrowDown':
        this.focusTimeCell(this.getNextStop(stop_id), trip_id);
        event.preventDefault();
        break;
      case 'ArrowUp':
        this.focusTimeCell(this.getPrevStop(stop_id), trip_id);
        event.preventDefault();
        break;
      case 'ArrowLeft':
        if (input.selectionStart === 0) {
          this.focusPrevTimeCell(trip_id, stop_id);
          event.preventDefault();
        }
        break;
      case 'ArrowRight':
        if (input.selectionStart === input.value.length) {
          this.focusNextTimeCell(trip_id, stop_id, false);
          event.preventDefault();
        }
        break;
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Get current time for a stop in a trip (legacy single time method)
   */
  private async getCurrentTime(
    trip_id: string,
    stop_id: string
  ): Promise<string | null> {
    try {
      const database = this.gtfsParser.gtfsDatabase;
      if (!database) {
        return null;
      }

      const stopTimes = await database.queryRows('stop_times', {
        trip_id: trip_id,
        stop_id: stop_id,
      });

      if (stopTimes.length === 0) {
        return null;
      }

      // Return departure_time or fall back to arrival_time
      const stopTime = stopTimes[0];
      return stopTime.departure_time || stopTime.arrival_time || null;
    } catch (error) {
      console.error('Failed to get current time:', error);
      return null;
    }
  }

  /**
   * Get current arrival time for a stop in a trip
   */
  private async getCurrentArrivalTime(
    trip_id: string,
    stop_id: string
  ): Promise<string | null> {
    try {
      const database = this.gtfsParser.gtfsDatabase;
      if (!database) {
        return null;
      }

      const stopTimes = await database.queryRows('stop_times', {
        trip_id: trip_id,
        stop_id: stop_id,
      });

      if (stopTimes.length === 0) {
        return null;
      }

      const stopTime = stopTimes[0];
      return stopTime.arrival_time || null;
    } catch (error) {
      console.error('Failed to get current arrival time:', error);
      return null;
    }
  }

  /**
   * Get current departure time for a stop in a trip
   */
  private async getCurrentDepartureTime(
    trip_id: string,
    stop_id: string
  ): Promise<string | null> {
    try {
      const database = this.gtfsParser.gtfsDatabase;
      if (!database) {
        return null;
      }

      const stopTimes = await database.queryRows('stop_times', {
        trip_id: trip_id,
        stop_id: stop_id,
      });

      if (stopTimes.length === 0) {
        return null;
      }

      const stopTime = stopTimes[0];
      return stopTime.departure_time || null;
    } catch (error) {
      console.error('Failed to get current departure time:', error);
      return null;
    }
  }

  /**
   * Update stop_time in database (legacy single time method)
   */
  private async updateStopTimeInDatabase(
    trip_id: string,
    stop_id: string,
    newTime: string,
    timeType?: 'arrival' | 'departure'
  ): Promise<void> {
    try {
      // Access the database through gtfsParser
      const database = this.gtfsParser.gtfsDatabase;
      if (!database) {
        const error = 'Database connection not available';
        console.error(error);
        notifications.showError(
          'Unable to save changes - database connection lost'
        );
        throw new Error(error);
      }

      // Find the stop_time record by trip_id and stop_id
      const stopTimes = await database.queryRows('stop_times', {
        trip_id: trip_id,
        stop_id: stop_id,
      });

      if (stopTimes.length === 0) {
        const error = `No stop_time found for trip ${trip_id}, stop ${stop_id}`;
        console.error('Database update failed:', error);
        notifications.showError('Unable to find the schedule record to update');
        throw new Error(error);
      }

      // Use the first matching record (there should be only one)
      const stopTime = stopTimes[0];

      // Determine which field to update
      const field =
        timeType === 'arrival'
          ? 'arrival_time'
          : timeType === 'departure'
            ? 'departure_time'
            : 'departure_time';

      // Generate natural key for the stop_time record and update
      const naturalKey = database.generateKey('stop_times', stopTime);
      await database.updateRow('stop_times', naturalKey, {
        [field]: newTime,
      });

      // Log success and show success notification
      console.log(
        `Updated ${field} for trip ${trip_id}, stop ${stop_id} to ${newTime || 'null'}`
      );
      notifications.showSuccess(`Time updated to ${newTime || 'skipped'}`, {
        duration: 2000,
      });

      // Refresh the affected UI cell
      this.refreshTimetableCell(trip_id, stop_id);
    } catch (error) {
      console.error('Failed to update stop_time in database:', error);

      // Show user-friendly error message if not already shown
      if (
        !error.message.includes('Database connection') &&
        !error.message.includes('No stop_time found')
      ) {
        notifications.showError(
          'Failed to save time change - please try again',
          { duration: 6000 }
        );
      }

      throw error;
    }
  }

  /**
   * Show time validation error to user
   */
  private showTimeError(
    trip_id: string,
    stop_id: string,
    message: string
  ): void {
    console.error(`Time error for ${trip_id}/${stop_id}: ${message}`);
    notifications.showError(`Invalid time format: ${message}`, {
      duration: 5000,
    });
  }

  /**
   * Refresh a single timetable cell
   */
  private async refreshTimetableCell(
    trip_id: string,
    stop_id: string
  ): Promise<void> {
    try {
      // Find the specific input element for this trip/stop combination
      const cellSelector = `input[data-trip-id="${trip_id}"][data-stop-id="${stop_id}"]`;
      const inputElement = document.querySelector(
        cellSelector
      ) as HTMLInputElement;

      if (!inputElement) {
        console.log(`Cell not found for refresh: ${trip_id}, ${stop_id}`);
        return;
      }

      // Get the updated time from database
      const database = this.gtfsParser.gtfsDatabase;
      if (!database) {
        console.warn('Database not available for cell refresh');
        return;
      }

      const stopTimes = await database.queryRows('stop_times', {
        trip_id: trip_id,
        stop_id: stop_id,
      });

      if (stopTimes.length > 0) {
        const stopTime = stopTimes[0];
        const timeType = inputElement.dataset.timeType || 'departure';
        const newTime =
          timeType === 'arrival'
            ? stopTime.arrival_time
            : stopTime.departure_time;

        // Update the input value without triggering change events
        inputElement.value = newTime || '';

        // Update visual styling if needed
        if (newTime === null) {
          inputElement.classList.add('text-muted');
          inputElement.placeholder = 'Skipped';
        } else {
          inputElement.classList.remove('text-muted');
          inputElement.placeholder = '';
        }

        console.log(
          `Refreshed cell ${trip_id}/${stop_id}: ${newTime || 'skipped'}`
        );
      }
    } catch (error) {
      console.error(`Failed to refresh cell ${trip_id}/${stop_id}:`, error);
    }
  }

  /**
   * Focus navigation helpers
   */
  private focusNextTimeCell(
    trip_id: string,
    stop_id: string,
    reverse: boolean
  ): void {
    // TODO: Implement focus navigation
    console.log(
      `focusNextTimeCell: ${trip_id}, ${stop_id}, reverse: ${reverse}`
    );
  }

  private focusPrevTimeCell(trip_id: string, stop_id: string): void {
    // TODO: Implement focus navigation
    console.log(`focusPrevTimeCell: ${trip_id}, ${stop_id}`);
  }

  private focusTimeCell(stop_id: string | null, trip_id: string): void {
    if (!stop_id) {
      return;
    }
    const selector = `input[data-trip-id="${trip_id}"][data-stop-id="${stop_id}"]`;
    const input = document.querySelector(selector) as HTMLInputElement;
    if (input) {
      input.focus();
      input.select();
    }
  }

  private getNextStop(_stop_id: string): string | null {
    // TODO: Get next stop in sequence
    return null;
  }

  private getPrevStop(_stop_id: string): string | null {
    // TODO: Get previous stop in sequence
    return null;
  }

  /**
   * Render schedule HTML for a specific route and service
   */
  async renderSchedule(
    route_id: string,
    service_id: string,
    direction_id?: string
  ): Promise<string> {
    try {
      console.log('DEBUG: renderSchedule called with:', {
        route_id,
        service_id,
        direction_id,
      });

      // Get all available directions for this route and service
      const availableDirections = this.getAvailableDirections(
        route_id,
        service_id
      );

      // Use first available direction if none specified
      const selectedDirection =
        direction_id ||
        (availableDirections.length > 0
          ? availableDirections[0].id
          : undefined);

      const timetableData = await this.generateTimetableData(
        route_id,
        service_id,
        selectedDirection
      );

      // Add direction information to timetable data
      timetableData.availableDirections = availableDirections;
      timetableData.selectedDirectionId = selectedDirection;

      console.log('DEBUG: Timetable data generated:', {
        tripsCount: timetableData.trips.length,
        stopsCount: timetableData.stops.length,
      });

      return this.renderTimetableHTML(timetableData);
    } catch (error) {
      console.error('Error rendering schedule:', error);
      return this.renderErrorHTML('Failed to generate schedule view');
    }
  }

  /**
   * Generate timetable data for a route and service
   */
  private async generateTimetableData(
    route_id: string,
    service_id: string,
    direction_id?: string
  ): Promise<TimetableData> {
    // Get route information
    const routesData =
      (this.gtfsParser.getFileDataSync('routes.txt') as Routes[]) || [];
    const route = routesData.find((r: Routes) => r.route_id === route_id);
    if (!route) {
      throw new Error(`Route ${route_id} not found`);
    }

    // Get service information
    const service = this.relationships.getCalendarForService(service_id) || {
      service_id,
    };

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
    const stops: EnhancedStop[] = await Promise.all(
      scsResult.supersequence.map(async (stop_id) => {
        const stop = await this.relationships.getStopByIdAsync(stop_id);
        if (!stop) {
          const error = `Stop ${stop_id} not found in stops.txt but referenced in stop_times.txt`;
          console.error('GTFS Data Integrity Error:', error);
          throw new Error(error);
        }
        return stop;
      })
    );

    // Align trips using the SCS result
    const alignedTrips = this.alignTripsWithSCS(trips, scsHelper);

    // Get direction name
    const directionName =
      direction_id !== undefined
        ? this.getDirectionName(direction_id, trips)
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
        stop_id: stop.id,
        stop_name: stop.name,
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
   * No manual alignment logic needed - everything is handled by SCS!
   */
  private alignTripsWithSCS(
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

  // Note: Old getSortedStops method removed - now handled directly by enhanced SCS

  /**
   * Render timetable HTML structure (returns HTML string)
   */
  private renderTimetableHTML(data: TimetableData): string {
    return `
      <div id="schedule-view" class="h-full flex flex-col">
        ${this.renderScheduleHeader(data.route, data.service)}
        ${this.renderDirectionTabs(data)}
        ${this.renderTimetableContent(data)}
      </div>
    `;
  }

  /**
   * Render schedule header
   */
  private renderScheduleHeader(
    route: Routes,
    service: Calendar | CalendarDates
  ): string {
    const routeName = route.route_short_name
      ? `${route.route_short_name}${route.route_long_name ? ' - ' + route.route_long_name : ''}`
      : route.route_long_name || route.route_id;

    const serviceName = service.service_id;

    return `
      <div class="border-b border-base-300">
        <div class="p-4">
          <h2 class="text-lg font-semibold">
            ${routeName} - ${serviceName}
          </h2>
          <p class="text-sm opacity-70">
            Timetable View
          </p>
        </div>
        ${this.renderServiceProperties(service)}
      </div>
    `;
  }

  /**
   * Render direction tabs navigation
   */
  private renderDirectionTabs(data: TimetableData): string {
    const directions = data.availableDirections || [];

    // Don't show tabs if there's only one or no directions
    if (directions.length <= 1) {
      return '';
    }

    const selectedDirectionId =
      data.selectedDirectionId || directions[0]?.id || '0';

    const tabButtons = directions
      .map((direction) => {
        const isActive = direction.id === selectedDirectionId;
        const directionIcon = this.getDirectionIcon(direction.id);

        return `
        <button
          class="tab ${isActive ? 'tab-active' : ''}"
          data-direction-id="${direction.id}"
          data-route-id="${data.route.route_id}"
          data-service-id="${data.service.service_id}"
          onclick="gtfsEditor.navigateToTimetable('${data.route.route_id}', '${data.service.service_id}', '${direction.id}')"
        >
          <span class="flex items-center gap-2">
            ${directionIcon}
            <span class="font-medium">${direction.name}</span>
            <span class="badge badge-ghost badge-sm">${direction.tripCount} trips</span>
          </span>
        </button>
      `;
      })
      .join('');

    return `
      <div class="direction-tabs-container border-b border-base-300">
        <div class="tabs tabs-boxed w-full justify-start">
          ${tabButtons}
        </div>
      </div>
    `;
  }

  /**
   * Get direction icon SVG
   */
  private getDirectionIcon(direction_id: string): string {
    switch (direction_id) {
      case '0': // Outbound
        return `
          <svg xmlns="http://www.w3.org/2000/svg" class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        `;
      case '1': // Inbound
        return `
          <svg xmlns="http://www.w3.org/2000/svg" class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
        `;
      default:
        return `
          <svg xmlns="http://www.w3.org/2000/svg" class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        `;
    }
  }

  /**
   * Render service properties section
   */
  private renderServiceProperties(service: Calendar | CalendarDates): string {
    if (!service || typeof service !== 'object') {
      return '';
    }

    // Get routes that use this service to show the warning
    const routesUsingService = this.getRoutesUsingService(service.service_id);
    const multipleRoutes = routesUsingService.length > 1;

    // Format start and end dates
    const startDate = service.start_date
      ? this.formatDate(service.start_date)
      : 'Not specified';
    const endDate = service.end_date
      ? this.formatDate(service.end_date)
      : 'Not specified';

    // Get day-of-week properties
    const dayProps = [
      { key: 'monday', label: 'Monday', short: 'Mon' },
      { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
      { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
      { key: 'thursday', label: 'Thursday', short: 'Thu' },
      { key: 'friday', label: 'Friday', short: 'Fri' },
      { key: 'saturday', label: 'Saturday', short: 'Sat' },
      { key: 'sunday', label: 'Sunday', short: 'Sun' },
    ];

    return `
      <div class="p-4 bg-base-200/50">
        ${
          multipleRoutes
            ? `
          <div role="alert" class="alert alert-warning alert-outline mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <div class="font-medium">Service used by multiple routes</div>
              <div class="text-sm opacity-80">This service is used by ${routesUsingService.length} routes. Modifying it will affect all of them.</div>
            </div>
          </div>
        `
            : ''
        }

        <div class="card bg-base-100 shadow-sm">
          <div class="card-body p-4">
            <h3 class="card-title text-base flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Service Properties
              <div class="badge badge-secondary badge-sm">${service.service_id}</div>
            </h3>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
              <!-- Service Period -->
              <div>
                <h4 class="font-medium text-sm mb-2 opacity-80">Service Period</h4>
                <div class="space-y-1 text-sm">
                  <div class="flex justify-between">
                    <span>Start Date:</span>
                    <span class="font-mono">${startDate}</span>
                  </div>
                  <div class="flex justify-between">
                    <span>End Date:</span>
                    <span class="font-mono">${endDate}</span>
                  </div>
                </div>
              </div>

              <!-- Operating Days -->
              <div>
                <h4 class="font-medium text-sm mb-2 opacity-80">Operating Days</h4>
                <div class="flex flex-wrap gap-1">
                  ${dayProps
                    .map(
                      (day) => `
                    <div class="badge ${service[day.key] ? 'badge-success' : 'badge-ghost'} badge-sm">
                      ${day.short}
                    </div>
                  `
                    )
                    .join('')}
                </div>
              </div>
            </div>

            ${
              multipleRoutes
                ? `
              <div class="mt-4 pt-3 border-t border-base-300">
                <h4 class="font-medium text-sm mb-2 opacity-80">Routes using this service</h4>
                <div class="flex flex-wrap gap-2">
                  ${routesUsingService
                    .slice(0, 5)
                    .map(
                      (route) => `
                    <div class="badge badge-outline badge-sm">
                      ${route.route_short_name || route.route_id}
                    </div>
                  `
                    )
                    .join('')}
                  ${
                    routesUsingService.length > 5
                      ? `
                    <div class="badge badge-ghost badge-sm">
                      +${routesUsingService.length - 5} more
                    </div>
                  `
                      : ''
                  }
                </div>
              </div>
            `
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get routes that use a specific service
   */
  private getRoutesUsingService(service_id: string): Routes[] {
    const allRoutes =
      (this.gtfsParser.getFileDataSync('routes.txt') as Routes[]) || [];
    const allTrips =
      (this.gtfsParser.getFileDataSync('trips.txt') as Trips[]) || [];

    // Get unique route IDs that have trips using this service
    const route_ids = new Set();
    allTrips.forEach((trip: Trips) => {
      if (trip.service_id === service_id) {
        route_ids.add(trip.route_id);
      }
    });

    // Return route objects for these route IDs
    return allRoutes.filter((route: Routes) => route_ids.has(route.route_id));
  }

  /**
   * Format GTFS date string (YYYYMMDD) to readable format
   */
  private formatDate(dateString: string): string {
    if (!dateString || dateString.length !== 8) {
      return dateString;
    }

    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);

    try {
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  }

  /**
   * Render timetable content
   */
  private renderTimetableContent(data: TimetableData): string {
    if (data.trips.length === 0) {
      return `
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <div class="text-4xl mb-4">🚌</div>
            <p class="text-lg">No trips found for this service</p>
          </div>
        </div>
      `;
    }

    const showArrivalDeparture = this.shouldShowSeparateArrivalDeparture(
      data.trips
    );
    data.showArrivalDeparture = showArrivalDeparture; // Store for use in rendering

    console.log('DEBUG: renderTimetableContent called with:', {
      showArrivalDeparture,
      tripsCount: data.trips.length,
      stopsCount: data.stops.length,
    });

    return `
      <div class="timetable-container flex-1 overflow-auto">
        <table class="table table-zebra table-pin-rows table-compact table-hover w-full text-sm group">
          ${this.renderTimetableHeader(data.trips, showArrivalDeparture)}
          ${this.renderTimetableBody(data.stops, data.trips, showArrivalDeparture)}
        </table>
      </div>
    `;
  }

  /**
   * Determine if we should show separate arrival/departure columns
   */
  private shouldShowSeparateArrivalDeparture(trips: AlignedTrip[]): boolean {
    // Show separate columns if any trip has different arrival and departure times
    return trips.some((trip) => {
      if (!trip.arrival_times || !trip.departure_times) {
        return false;
      }

      // Check if any stop has different arrival and departure times
      for (const [position, arrival_time] of trip.arrival_times) {
        const departure_time = trip.departure_times.get(position);
        if (arrival_time && departure_time && arrival_time !== departure_time) {
          return true;
        }
      }
      return false;
    });
  }

  /**
   * Render timetable header with trip columns
   */
  private renderTimetableHeader(
    trips: AlignedTrip[],
    showArrivalDeparture: boolean = false
  ): string {
    const tripHeaders = trips
      .map((trip) => {
        if (showArrivalDeparture) {
          // Show two columns per trip: Arrival and Departure
          const arrivalHeader = `
            <th class="trip-header arrival-header p-2 text-center min-w-[70px] border-b border-base-300 bg-blue-50/50">
              <div class="trip-id text-xs font-medium">${trip.trip_id}</div>
              <div class="time-type text-[10px] opacity-60 mt-1">ARR</div>
            </th>
          `;
          const departureHeader = `
            <th class="trip-header departure-header p-2 text-center min-w-[70px] border-b border-base-300 bg-orange-50/50 border-l border-base-200">
              <div class="trip-id text-xs font-medium">${trip.trip_id}</div>
              <div class="time-type text-[10px] opacity-60 mt-1">DEP</div>
            </th>
          `;
          return arrivalHeader + departureHeader;
        } else {
          // Single column per trip (original behavior)
          return `
            <th class="trip-header p-2 text-center min-w-[80px] border-b border-base-300">
              <div class="trip-id text-xs font-medium">${trip.trip_id}</div>
            </th>
          `;
        }
      })
      .join('');

    return `
      <thead class="sticky top-0 bg-base-100 z-10">
        <tr>
          <th class="stop-header p-2 text-left min-w-[200px] sticky left-0 bg-base-100 border-b border-base-300">
            Stop
          </th>
          ${tripHeaders}
        </tr>
      </thead>
    `;
  }

  /**
   * Render timetable body with stop rows
   */
  private renderTimetableBody(
    stops: Stops[],
    trips: AlignedTrip[],
    showArrivalDeparture: boolean = false
  ): string {
    const rows = stops
      .map((stop, stopIndex) => {
        const rowClass = '';
        const timeCells = trips
          .map((trip) => {
            // Use the current stop index as position (NOT findIndex!)
            const stopPosition = stopIndex;
            const editableStopTime = trip.editableStopTimes?.get(stopPosition);

            if (showArrivalDeparture) {
              // Render two cells per trip: arrival and departure
              const arrival_time = trip.arrival_times?.get(stopPosition);
              const departure_time = trip.departure_times?.get(stopPosition);

              const arrivalCell = this.renderEditableArrivalDepartureCell(
                trip.trip_id,
                stop.stop_id,
                arrival_time,
                'arrival',
                editableStopTime
              );

              const departureCell = this.renderEditableArrivalDepartureCell(
                trip.trip_id,
                stop.stop_id,
                departure_time,
                'departure',
                editableStopTime
              );

              return arrivalCell + departureCell;
            } else {
              // Single column per trip (original behavior)
              const time = trip.stopTimes.get(stopPosition);

              return this.renderEditableTimeCell(
                trip.trip_id,
                stop.stop_id,
                time,
                editableStopTime
              );
            }
          })
          .join('');

        return `
        <tr class="${rowClass}">
          <td class="stop-name p-2 font-medium sticky left-0 bg-base-100 border-r border-base-300">
            <div class="stop-name-text">${this.escapeHtml(stop.name || stop.id)}</div>
            <div class="stop-id text-xs opacity-70">${stop.id}</div>
          </td>
          ${timeCells}
        </tr>
      `;
      })
      .join('');

    return `<tbody>${rows}</tbody>`;
  }

  /**
   * Render read-only time cell (supports both single and arrival/departure modes)
   */
  private renderReadOnlyTimeCell(
    time: string | null,
    timeType?: 'arrival' | 'departure'
  ): string {
    const cellClass = `time-cell p-2 text-center ${time ? 'has-time' : 'no-time text-base-content/30'} ${
      timeType === 'arrival'
        ? 'bg-blue-50/30'
        : timeType === 'departure'
          ? 'bg-orange-50/30'
          : ''
    } ${timeType === 'departure' ? 'border-l border-base-200' : ''}`;

    return `
      <td class="${cellClass}">
        ${time ? `<span class="time-badge badge badge-ghost badge-sm font-mono">${this.formatTime(time)}</span>` : '—'}
      </td>
    `;
  }

  /**
   * Render editable arrival/departure time cell
   */
  private renderEditableArrivalDepartureCell(
    trip_id: string,
    stop_id: string,
    time: string | null,
    timeType: 'arrival' | 'departure',
    editableStopTime?: EditableStopTime
  ): string {
    const isSkipped = editableStopTime?.isSkipped || false;
    const displayTime = time ? this.formatTime(time) : '';
    const cellClass = `time-cell p-1 text-center ${
      isSkipped
        ? 'skipped bg-warning/20 text-warning-content'
        : time
          ? 'has-time'
          : 'no-time text-base-content/30'
    } ${
      timeType === 'arrival' ? 'bg-blue-50/30' : 'bg-orange-50/30'
    } ${timeType === 'departure' ? 'border-l border-base-200' : ''}`;

    if (isSkipped) {
      return `
        <td class="${cellClass}">
          <div class="skipped-indicator">
            <span class="text-xs opacity-70">SKIP</span>
            ${
              timeType === 'departure'
                ? `
              <button class="btn btn-ghost btn-xs ml-1" onclick="gtfsEditor.scheduleController.unskipStop('${trip_id}', '${stop_id}')" title="Unskip this stop">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                </svg>
              </button>
            `
                : ''
            }
          </div>
        </td>
      `;
    }

    return `
      <td class="${cellClass}">
        <div class="time-input-container relative">
          <input
            type="text"
            class="time-input input input-xs w-16 text-center font-mono bg-transparent border-none focus:outline-none focus:bg-base-200"
            value="${displayTime}"
            placeholder="--:--"
            data-trip-id="${trip_id}"
            data-stop-id="${stop_id}"
            data-time-type="${timeType}"
            pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$|^(2[4-9]|[3-9][0-9]):[0-5][0-9]$"
            title="Enter time in HH:MM format (24-hour, may exceed 24:00)"
            onchange="gtfsEditor.scheduleController.updateArrivalDepartureTime('${trip_id}', '${stop_id}', '${timeType}', this.value)"
            onkeydown="gtfsEditor.scheduleController.handleTimeKeyDown(event, '${trip_id}', '${stop_id}')"
            onfocus="this.select()"
          />
          ${
            timeType === 'departure'
              ? `
            <div class="time-cell-actions opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 right-0">
              <button class="btn btn-ghost btn-xs" onclick="gtfsEditor.scheduleController.skipStop('${trip_id}', '${stop_id}')" title="Skip this stop">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clip-rule="evenodd"></path>
                </svg>
              </button>
            </div>
          `
              : ''
          }
        </div>
      </td>
    `;
  }

  /**
   * Render editable time cell with input and validation (single column mode)
   */
  private renderEditableTimeCell(
    trip_id: string,
    stop_id: string,
    time: string | null,
    editableStopTime?: EditableStopTime
  ): string {
    const isSkipped = editableStopTime?.isSkipped || false;
    const displayTime = time ? this.formatTime(time) : '';

    const cellClass = `time-cell p-1 text-center ${
      isSkipped
        ? 'skipped bg-warning/20 text-warning-content'
        : time
          ? 'has-time'
          : 'no-time text-base-content/30'
    }`;

    if (isSkipped) {
      return `
        <td class="${cellClass}">
          <div class="skipped-indicator">
            <span class="text-xs opacity-70">SKIP</span>
            <button class="btn btn-ghost btn-xs ml-1" onclick="gtfsEditor.scheduleController.unskipStop('${trip_id}', '${stop_id}')" title="Unskip this stop">
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
              </svg>
            </button>
          </div>
        </td>
      `;
    }

    return `
      <td class="${cellClass}">
        <div class="time-input-container">
          <input
            type="text"
            class="time-input input input-xs w-20 text-center font-mono bg-transparent border-none focus:outline-none focus:bg-base-200"
            value="${displayTime}"
            placeholder="--:--"
            data-trip-id="${trip_id}"
            data-stop-id="${stop_id}"
            pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$|^(2[4-9]|[3-9][0-9]):[0-5][0-9]$"
            title="Enter time in HH:MM format (24-hour, may exceed 24:00)"
            onchange="gtfsEditor.scheduleController.updateTime('${trip_id}', '${stop_id}', this.value)"
            onkeydown="gtfsEditor.scheduleController.handleTimeKeyDown(event, '${trip_id}', '${stop_id}')"
            onfocus="this.select()"
          />
          <div class="time-cell-actions opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 right-0">
            <button class="btn btn-ghost btn-xs" onclick="gtfsEditor.scheduleController.skipStop('${trip_id}', '${stop_id}')" title="Skip this stop">
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clip-rule="evenodd"></path>
              </svg>
            </button>
          </div>
        </div>
      </td>
    `;
  }

  /**
   * Format time for display (HH:MM)
   */
  private formatTime(time: string): string {
    if (!time) {
      return '';
    }

    // Handle times like "24:30:00" or "25:15:00" (next day)
    const parts = time.split(':');
    if (parts.length >= 2) {
      const hours = parseInt(parts[0]);
      const minutes = parts[1];

      if (hours >= 24) {
        // Next day time - show as is for now, could add +1 indicator
        return `${hours}:${minutes}`;
      }

      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }

    return time;
  }

  /**
   * Render error state HTML
   */
  private renderErrorHTML(message: string): string {
    return `
      <div class="h-full flex flex-col">
        <div class="border-b border-base-300">
          <div class="p-3 bg-base-200">
            <div class="breadcrumbs text-sm">
              <ul id="breadcrumb-list">
                <!-- Breadcrumbs will be rendered by UI controller -->
              </ul>
            </div>
          </div>
        </div>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <div class="text-4xl mb-4">⚠️</div>
            <p class="text-lg">${this.escapeHtml(message)}</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get available directions for a route and service
   */
  private getAvailableDirections(
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
        name: this.getDirectionName(id, trips),
        tripCount,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    return directions;
  }

  /**
   * Get a human-readable direction name
   */
  private getDirectionName(direction_id: string, _trips: Trips[]): string {
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

  /**
   * Escape HTML for safe display
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
