/**
 * GTFS Foreign Key Relationships and Enhanced Data Types
 *
 * This file now uses auto-generated relationships from the GTFS specification.
 * Relationships are automatically extracted from "Foreign ID referencing" patterns
 * in the official GTFS spec and regenerated with `npm run generate-gtfs-types`.
 */

import {
  GTFSRecord,
  Agency,
  Stops,
  Routes,
  Trips,
  GTFS_RELATIONSHIPS,
  GTFS_PRIMARY_KEYS,
  GTFS_TABLES,
} from '../types/gtfs';

// Export the auto-generated relationships for backwards compatibility
export { GTFS_RELATIONSHIPS };

// Type for relationship objects
export interface GTFSRelationship {
  sourceFile: string;
  sourceField: string;
  targetFile: string;
  targetField: string;
  description: string;
  optional: boolean;
}

// Enhanced types with resolved relationships
export interface GTFSDatabase {
  [filename: string]: Map<string, GTFSRecord>;
}

export interface EnhancedStop extends Stops {
  routes?: Routes[];
  parent_stationDetails?: Stops;
  childStops?: Stops[];
  level?: GTFSRecord;
}

export interface EnhancedRoute extends Routes {
  agency?: Agency;
  trips?: Trips[];
  stops?: Stops[];
}

export interface EnhancedTrip extends Trips {
  route?: Routes;
  stopTimes?: GTFSRecord[];
  servicePattern?: GTFSRecord;
  shape?: GTFSRecord[];
  frequencies?: GTFSRecord[];
}

export interface EnhancedStopTime {
  trip?: Trips;
  stop?: Stops;
}

export class GTFSRelationshipResolver {
  private database: GTFSDatabase = {};

  constructor(gtfsData: { [filename: string]: GTFSRecord[] }) {
    this.buildDatabase(gtfsData);
  }

  private buildDatabase(gtfsData: { [filename: string]: GTFSRecord[] }): void {
    // Convert arrays to Maps indexed by primary key
    for (const [filename, records] of Object.entries(gtfsData)) {
      const map = new Map<string, GTFSRecord>();

      // Determine primary key field based on filename
      const primaryKeyField = this.getPrimaryKeyField(filename);

      for (const record of records) {
        const key = (record as Record<string, unknown>)[primaryKeyField];
        if (key) {
          map.set(key, record);
        }
      }

      this.database[filename] = map;
    }
  }

  private getPrimaryKeyField(filename: string): string {
    return (
      GTFS_PRIMARY_KEYS[filename as keyof typeof GTFS_PRIMARY_KEYS] || 'id'
    );
  }

  /**
   * Resolve a single foreign key relationship
   */
  public resolveReference(
    sourceRecord: GTFSRecord,
    foreignKeyField: string,
    targetFile: string
  ): GTFSRecord | undefined {
    const foreignKeyValue = (sourceRecord as Record<string, unknown>)[
      foreignKeyField
    ];
    if (!foreignKeyValue) {
      return undefined;
    }

    const targetMap = this.database[targetFile];
    if (!targetMap) {
      return undefined;
    }

    return targetMap.get(foreignKeyValue);
  }

  /**
   * Get all records that reference a specific record
   */
  public getReferencingRecords(
    targetKeyValue: string,
    sourceFile: string,
    sourceKeyField: string
  ): GTFSRecord[] {
    const sourceMap = this.database[sourceFile];
    if (!sourceMap) {
      return [];
    }

    return Array.from(sourceMap.values()).filter(
      (record) =>
        (record as Record<string, unknown>)[sourceKeyField] === targetKeyValue
    );
  }

  /**
   * Enhance a stop with related data
   */
  public enhanceStop(stop_id: string): EnhancedStop | undefined {
    const stop = this.database[GTFS_TABLES.STOPS]?.get(stop_id);
    if (!stop) {
      return undefined;
    }

    const enhanced: EnhancedStop = { ...(stop as Stops) };

    // Get parent station
    const parent_stationId = (stop as Record<string, unknown>).parent_station;
    if (parent_stationId) {
      enhanced.parent_stationDetails = this.database[GTFS_TABLES.STOPS]?.get(
        parent_stationId
      ) as Stops;
    }

    // Get child stops (if this is a station)
    enhanced.childStops = this.getReferencingRecords(
      stop_id,
      GTFS_TABLES.STOPS,
      'parent_station'
    ) as Stops[];

    // Get level information
    const level_id = (stop as Record<string, unknown>).level_id;
    if (level_id) {
      enhanced.level = this.database[GTFS_TABLES.LEVELS]?.get(level_id);
    }

    // Get routes serving this stop
    const stopTimes = this.getReferencingRecords(
      stop_id,
      GTFS_TABLES.STOP_TIMES,
      'stop_id'
    );

    const trip_ids = [
      ...new Set(
        stopTimes.map((st) => (st as Record<string, unknown>).trip_id)
      ),
    ];
    const route_ids = new Set<string>();

    for (const trip_id of trip_ids) {
      const trip = this.database[GTFS_TABLES.TRIPS]?.get(trip_id);
      if (trip) {
        route_ids.add((trip as Record<string, unknown>).route_id);
      }
    }

    enhanced.routes = Array.from(route_ids)
      .map((route_id) => this.database[GTFS_TABLES.ROUTES]?.get(route_id))
      .filter(Boolean) as Routes[];

    return enhanced;
  }

  /**
   * Enhance a route with related data
   */
  public enhanceRoute(route_id: string): EnhancedRoute | undefined {
    const route = this.database[GTFS_TABLES.ROUTES]?.get(route_id);
    if (!route) {
      return undefined;
    }

    const enhanced: EnhancedRoute = { ...(route as Routes) };

    // Get agency
    const agency_id = (route as Record<string, unknown>).agency_id;
    if (agency_id) {
      enhanced.agency = this.database[GTFS_TABLES.AGENCY]?.get(
        agency_id
      ) as Agency;
    }

    // Get trips
    enhanced.trips = this.getReferencingRecords(
      route_id,
      GTFS_TABLES.TRIPS,
      'route_id'
    ) as Trips[];

    // Get unique stops served by this route
    const stop_ids = new Set<string>();
    for (const trip of enhanced.trips || []) {
      const tripStopTimes = this.getReferencingRecords(
        (trip as Record<string, unknown>).trip_id,
        GTFS_TABLES.STOP_TIMES,
        'trip_id'
      );
      for (const stopTime of tripStopTimes) {
        stop_ids.add((stopTime as Record<string, unknown>).stop_id);
      }
    }

    enhanced.stops = Array.from(stop_ids)
      .map((stop_id) => this.database[GTFS_TABLES.STOPS]?.get(stop_id))
      .filter(Boolean) as Stops[];

    return enhanced;
  }

  /**
   * Enhance a trip with related data
   */
  public enhanceTrip(trip_id: string): EnhancedTrip | undefined {
    const trip = this.database[GTFS_TABLES.TRIPS]?.get(trip_id);
    if (!trip) {
      return undefined;
    }

    const enhanced: EnhancedTrip = { ...(trip as Trips) };

    // Get route
    const route_id = (trip as Record<string, unknown>).route_id;
    if (route_id) {
      enhanced.route = this.database[GTFS_TABLES.ROUTES]?.get(
        route_id
      ) as Routes;
    }

    // Get service pattern
    const service_id = (trip as Record<string, unknown>).service_id;
    if (service_id) {
      enhanced.servicePattern =
        this.database[GTFS_TABLES.CALENDAR]?.get(service_id) ||
        this.database[GTFS_TABLES.CALENDAR_DATES]?.get(service_id);
    }

    // Get stop times
    enhanced.stopTimes = this.getReferencingRecords(
      trip_id,
      GTFS_TABLES.STOP_TIMES,
      'trip_id'
    ).sort(
      (a, b) =>
        ((a as Record<string, unknown>).stop_sequence || 0) -
        ((b as Record<string, unknown>).stop_sequence || 0)
    );

    // Get shape
    const shape_id = (trip as Record<string, unknown>).shape_id;
    if (shape_id) {
      enhanced.shape = this.getReferencingRecords(
        shape_id,
        GTFS_TABLES.SHAPES,
        'shape_id'
      ).sort(
        (a, b) =>
          ((a as Record<string, unknown>).shapePtSequence || 0) -
          ((b as Record<string, unknown>).shapePtSequence || 0)
      );
    }

    // Get frequencies
    enhanced.frequencies = this.getReferencingRecords(
      trip_id,
      GTFS_TABLES.FREQUENCIES,
      'trip_id'
    );

    return enhanced;
  }

  /**
   * Get available relationships for a record type
   */
  public getAvailableRelationships(filename: string): GTFSRelationship[] {
    return GTFS_RELATIONSHIPS.filter(
      (rel) => rel.sourceFile === filename || rel.targetFile === filename
    );
  }
}
