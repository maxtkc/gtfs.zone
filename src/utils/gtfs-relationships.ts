/**
 * GTFS Foreign Key Relationships and Enhanced Data Types
 */

import { GTFSRecord, Agency, Stops, Routes, Trips } from '../types/gtfs';

// Define foreign key relationships based on GTFS specification
export interface GTFSRelationship {
  sourceFile: string;
  sourceField: string;
  targetFile: string;
  targetField: string;
  description: string;
}

export const GTFS_RELATIONSHIPS: GTFSRelationship[] = [
  // Routes -> Agency
  {
    sourceFile: 'routes.txt',
    sourceField: 'agencyId',
    targetFile: 'agency.txt',
    targetField: 'agencyId',
    description: 'Route belongs to agency',
  },

  // Trips -> Routes
  {
    sourceFile: 'trips.txt',
    sourceField: 'routeId',
    targetFile: 'routes.txt',
    targetField: 'routeId',
    description: 'Trip belongs to route',
  },

  // Trips -> Calendar/Calendar Dates
  {
    sourceFile: 'trips.txt',
    sourceField: 'serviceId',
    targetFile: 'calendar.txt',
    targetField: 'serviceId',
    description: 'Trip uses service pattern',
  },

  // Stop Times -> Trips
  {
    sourceFile: 'stop_times.txt',
    sourceField: 'tripId',
    targetFile: 'trips.txt',
    targetField: 'tripId',
    description: 'Stop time belongs to trip',
  },

  // Stop Times -> Stops
  {
    sourceFile: 'stop_times.txt',
    sourceField: 'stopId',
    targetFile: 'stops.txt',
    targetField: 'stopId',
    description: 'Stop time at specific stop',
  },

  // Stops -> Parent Station
  {
    sourceFile: 'stops.txt',
    sourceField: 'parentStation',
    targetFile: 'stops.txt',
    targetField: 'stopId',
    description: 'Stop has parent station',
  },

  // Stops -> Level
  {
    sourceFile: 'stops.txt',
    sourceField: 'levelId',
    targetFile: 'levels.txt',
    targetField: 'levelId',
    description: 'Stop at specific level',
  },

  // Shapes -> Trips (reverse relationship)
  {
    sourceFile: 'trips.txt',
    sourceField: 'shapeId',
    targetFile: 'shapes.txt',
    targetField: 'shapeId',
    description: 'Trip follows shape',
  },

  // Frequencies -> Trips
  {
    sourceFile: 'frequencies.txt',
    sourceField: 'tripId',
    targetFile: 'trips.txt',
    targetField: 'tripId',
    description: 'Frequency applies to trip',
  },

  // Transfers -> Stops (from)
  {
    sourceFile: 'transfers.txt',
    sourceField: 'fromStopId',
    targetFile: 'stops.txt',
    targetField: 'stopId',
    description: 'Transfer from stop',
  },

  // Transfers -> Stops (to)
  {
    sourceFile: 'transfers.txt',
    sourceField: 'toStopId',
    targetFile: 'stops.txt',
    targetField: 'stopId',
    description: 'Transfer to stop',
  },
];

// Enhanced types with resolved relationships
export interface GTFSDatabase {
  [filename: string]: Map<string, GTFSRecord>;
}

export interface EnhancedStop extends Stops {
  routes?: Routes[];
  parentStationDetails?: Stops;
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
        const key = (record as any)[primaryKeyField];
        if (key) {
          map.set(key, record);
        }
      }

      this.database[filename] = map;
    }
  }

  private getPrimaryKeyField(filename: string): string {
    const primaryKeys: { [key: string]: string } = {
      'agency.txt': 'agencyId',
      'stops.txt': 'stopId',
      'routes.txt': 'routeId',
      'trips.txt': 'tripId',
      'stop_times.txt': 'tripId', // Composite key, but tripId is main identifier
      'calendar.txt': 'serviceId',
      'calendar_dates.txt': 'serviceId',
      'shapes.txt': 'shapeId',
      'frequencies.txt': 'tripId',
      'transfers.txt': 'fromStopId', // Composite key
      'levels.txt': 'levelId',
      'fare_attributes.txt': 'fareId',
      'fare_rules.txt': 'fareId',
    };

    return primaryKeys[filename] || 'id';
  }

  /**
   * Resolve a single foreign key relationship
   */
  public resolveReference(
    sourceRecord: GTFSRecord,
    foreignKeyField: string,
    targetFile: string
  ): GTFSRecord | undefined {
    const foreignKeyValue = (sourceRecord as any)[foreignKeyField];
    if (!foreignKeyValue) return undefined;

    const targetMap = this.database[targetFile];
    if (!targetMap) return undefined;

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
    if (!sourceMap) return [];

    return Array.from(sourceMap.values()).filter(
      (record) => (record as any)[sourceKeyField] === targetKeyValue
    );
  }

  /**
   * Enhance a stop with related data
   */
  public enhanceStop(stopId: string): EnhancedStop | undefined {
    const stop = this.database['stops.txt']?.get(stopId);
    if (!stop) return undefined;

    const enhanced: EnhancedStop = { ...(stop as Stops) };

    // Get parent station
    const parentStationId = (stop as any).parentStation;
    if (parentStationId) {
      enhanced.parentStationDetails = this.database['stops.txt']?.get(
        parentStationId
      ) as Stops;
    }

    // Get child stops (if this is a station)
    enhanced.childStops = this.getReferencingRecords(
      stopId,
      'stops.txt',
      'parentStation'
    ) as Stops[];

    // Get level information
    const levelId = (stop as any).levelId;
    if (levelId) {
      enhanced.level = this.database['levels.txt']?.get(levelId);
    }

    // Get routes serving this stop
    const stopTimes = this.getReferencingRecords(
      stopId,
      'stop_times.txt',
      'stopId'
    );

    const tripIds = [...new Set(stopTimes.map((st) => (st as any).tripId))];
    const routeIds = new Set<string>();

    for (const tripId of tripIds) {
      const trip = this.database['trips.txt']?.get(tripId);
      if (trip) {
        routeIds.add((trip as any).routeId);
      }
    }

    enhanced.routes = Array.from(routeIds)
      .map((routeId) => this.database['routes.txt']?.get(routeId))
      .filter(Boolean) as Routes[];

    return enhanced;
  }

  /**
   * Enhance a route with related data
   */
  public enhanceRoute(routeId: string): EnhancedRoute | undefined {
    const route = this.database['routes.txt']?.get(routeId);
    if (!route) return undefined;

    const enhanced: EnhancedRoute = { ...(route as Routes) };

    // Get agency
    const agencyId = (route as any).agencyId;
    if (agencyId) {
      enhanced.agency = this.database['agency.txt']?.get(agencyId) as Agency;
    }

    // Get trips
    enhanced.trips = this.getReferencingRecords(
      routeId,
      'trips.txt',
      'routeId'
    ) as Trips[];

    // Get unique stops served by this route
    const stopIds = new Set<string>();
    for (const trip of enhanced.trips || []) {
      const tripStopTimes = this.getReferencingRecords(
        (trip as any).tripId,
        'stop_times.txt',
        'tripId'
      );
      for (const stopTime of tripStopTimes) {
        stopIds.add((stopTime as any).stopId);
      }
    }

    enhanced.stops = Array.from(stopIds)
      .map((stopId) => this.database['stops.txt']?.get(stopId))
      .filter(Boolean) as Stops[];

    return enhanced;
  }

  /**
   * Enhance a trip with related data
   */
  public enhanceTrip(tripId: string): EnhancedTrip | undefined {
    const trip = this.database['trips.txt']?.get(tripId);
    if (!trip) return undefined;

    const enhanced: EnhancedTrip = { ...(trip as Trips) };

    // Get route
    const routeId = (trip as any).routeId;
    if (routeId) {
      enhanced.route = this.database['routes.txt']?.get(routeId) as Routes;
    }

    // Get service pattern
    const serviceId = (trip as any).serviceId;
    if (serviceId) {
      enhanced.servicePattern =
        this.database['calendar.txt']?.get(serviceId) ||
        this.database['calendar_dates.txt']?.get(serviceId);
    }

    // Get stop times
    enhanced.stopTimes = this.getReferencingRecords(
      tripId,
      'stop_times.txt',
      'tripId'
    ).sort(
      (a, b) => ((a as any).stopSequence || 0) - ((b as any).stopSequence || 0)
    );

    // Get shape
    const shapeId = (trip as any).shapeId;
    if (shapeId) {
      enhanced.shape = this.getReferencingRecords(
        shapeId,
        'shapes.txt',
        'shapeId'
      ).sort(
        (a, b) =>
          ((a as any).shapePtSequence || 0) - ((b as any).shapePtSequence || 0)
      );
    }

    // Get frequencies
    enhanced.frequencies = this.getReferencingRecords(
      tripId,
      'frequencies.txt',
      'tripId'
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
