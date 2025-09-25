/**
 * GTFS Relationships Module
 * Handles hierarchical navigation through GTFS data
 * Agency → Routes → Trips → Stop Times → Stops
 */

import { GTFSDatabase, GTFSDatabaseRecord } from './gtfs-database.js';

interface GTFSParserInterface {
  getFileDataSync: (filename: string) => GTFSDatabaseRecord[];
  gtfsDatabase: GTFSDatabase;
  searchStops: (query: string) => GTFSDatabaseRecord[];
  searchRoutes: (query: string) => GTFSDatabaseRecord[];
  searchAll: (query: string) => {
    stops: GTFSDatabaseRecord[];
    routes: GTFSDatabaseRecord[];
  };
}

export class GTFSRelationships {
  private gtfsParser: GTFSParserInterface;
  private gtfsDatabase: GTFSDatabase;

  constructor(gtfsParser: GTFSParserInterface) {
    this.gtfsParser = gtfsParser;
    this.gtfsDatabase = gtfsParser.gtfsDatabase;
  }

  /**
   * Get all agencies in the GTFS feed
   */
  getAgencies() {
    const agencyData = this.gtfsParser.getFileDataSync('agency.txt');
    if (!agencyData || !Array.isArray(agencyData)) {
      return [];
    }
    return agencyData.map((agency) => ({
      id: agency.agency_id,
      agency_id: agency.agency_id,
      name: agency.agency_name || `Agency ${agency.agency_id}`,
      agency_name: agency.agency_name || `Agency ${agency.agency_id}`,
      url: agency.agency_url,
      timezone: agency.agency_timezone,
      lang: agency.agency_lang,
      phone: agency.agency_phone,
      fare_url: agency.agency_fare_url,
      email: agency.agency_email,
    }));
  }

  /**
   * Get all routes for a specific agency
   */
  getRoutesForAgency(agencyId: string) {
    const routesData = this.gtfsParser.getFileDataSync('routes.txt');
    if (!routesData || !Array.isArray(routesData)) {
      return [];
    }

    return routesData
      .filter((route) => route.agency_id === agencyId)
      .map((route) => ({
        id: route.route_id,
        route_id: route.route_id,
        agencyId: route.agency_id,
        agency_id: route.agency_id,
        shortName: route.route_short_name,
        route_short_name: route.route_short_name,
        longName: route.route_long_name,
        route_long_name: route.route_long_name,
        desc: route.route_desc,
        route_desc: route.route_desc,
        type: route.route_type,
        route_type: route.route_type,
        url: route.route_url,
        route_url: route.route_url,
        color: route.route_color,
        route_color: route.route_color,
        textColor: route.route_text_color,
        route_text_color: route.route_text_color,
        sortOrder: route.route_sort_order,
        route_sort_order: route.route_sort_order,
      }));
  }

  /**
   * Get all trips for a specific route
   */
  getTripsForRoute(routeId: string) {
    const tripsData = this.gtfsParser.getFileDataSync('trips.txt');
    if (!tripsData || !Array.isArray(tripsData)) {
      return [];
    }

    return tripsData
      .filter((trip) => trip.route_id === routeId)
      .map((trip) => ({
        id: trip.trip_id,
        trip_id: trip.trip_id,
        routeId: trip.route_id,
        route_id: trip.route_id,
        serviceId: trip.service_id,
        service_id: trip.service_id,
        headsign: trip.trip_headsign,
        trip_headsign: trip.trip_headsign,
        shortName: trip.trip_short_name,
        trip_short_name: trip.trip_short_name,
        directionId: trip.direction_id,
        direction_id: trip.direction_id,
        blockId: trip.block_id,
        shapeId: trip.shape_id,
        wheelchairAccessible: trip.wheelchair_accessible,
        bikesAllowed: trip.bikes_allowed,
      }));
  }

  /**
   * Get stop times for a specific trip
   */
  getStopTimesForTrip(tripId: string) {
    const stopTimesData = this.gtfsParser.getFileDataSync('stop_times.txt');
    if (!stopTimesData || !Array.isArray(stopTimesData)) {
      return [];
    }

    const stopTimes = stopTimesData
      .filter((stopTime) => stopTime.trip_id === tripId)
      .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence))
      .map((stopTime) => ({
        tripId: stopTime.trip_id,
        stopId: stopTime.stop_id,
        stopSequence: parseInt(stopTime.stop_sequence),
        arrivalTime: stopTime.arrival_time,
        departureTime: stopTime.departure_time,
        stopHeadsign: stopTime.stop_headsign,
        pickupType: stopTime.pickup_type,
        dropOffType: stopTime.drop_off_type,
        continuousPickup: stopTime.continuous_pickup,
        continuousDropOff: stopTime.continuous_drop_off,
        shapeDistTraveled: stopTime.shape_dist_traveled,
        timepoint: stopTime.timepoint,
      }));

    // Enrich with stop information
    return this.enrichStopTimesWithStops(stopTimes);
  }

  /**
   * Get stop details by stop ID
   */
  getStopById(stopId: string) {
    const stopsData = this.gtfsParser.getFileDataSync('stops.txt');
    if (!stopsData || !Array.isArray(stopsData)) {
      return null;
    }

    const stop = stopsData.find((stop) => stop.stop_id === stopId);
    if (!stop) {
      return null;
    }

    return {
      id: stop.stop_id,
      code: stop.stop_code,
      name: stop.stop_name,
      desc: stop.stop_desc,
      lat: parseFloat(stop.stop_lat),
      lon: parseFloat(stop.stop_lon),
      zoneId: stop.zone_id,
      url: stop.stop_url,
      locationType: stop.location_type,
      parentStation: stop.parent_station,
      timezone: stop.stop_timezone,
      wheelchairBoarding: stop.wheelchair_boarding,
      levelId: stop.level_id,
      platformCode: stop.platform_code,
    };
  }

  /**
   * Get all trips that serve a specific stop
   */
  getTripsForStop(stopId: string) {
    const stopTimesData = this.gtfsParser.getFileDataSync('stop_times.txt');
    if (!stopTimesData || !Array.isArray(stopTimesData)) {
      return [];
    }

    const tripIds = [
      ...new Set(
        stopTimesData
          .filter((stopTime) => stopTime.stop_id === stopId)
          .map((stopTime) => stopTime.trip_id)
      ),
    ];

    const tripsData = this.gtfsParser.getFileDataSync('trips.txt');
    if (!tripsData || !Array.isArray(tripsData)) {
      return [];
    }

    return tripsData
      .filter((trip) => tripIds.includes(trip.trip_id))
      .map((trip) => ({
        id: trip.trip_id,
        routeId: trip.route_id,
        serviceId: trip.service_id,
        headsign: trip.trip_headsign,
        shortName: trip.trip_short_name,
        directionId: trip.direction_id,
        blockId: trip.block_id,
        shapeId: trip.shape_id,
      }));
  }

  /**
   * Get calendar information for a service ID
   */
  getCalendarForService(serviceId: string) {
    const calendarData = this.gtfsParser.getFileDataSync('calendar.txt');
    if (!calendarData || !Array.isArray(calendarData)) {
      return null;
    }

    const calendar = calendarData.find((cal) => cal.service_id === serviceId);
    if (!calendar) {
      return null;
    }

    return {
      serviceId: calendar.service_id,
      monday: calendar.monday === '1',
      tuesday: calendar.tuesday === '1',
      wednesday: calendar.wednesday === '1',
      thursday: calendar.thursday === '1',
      friday: calendar.friday === '1',
      saturday: calendar.saturday === '1',
      sunday: calendar.sunday === '1',
      startDate: calendar.start_date,
      endDate: calendar.end_date,
    };
  }

  /**
   * Get calendar exceptions for a service ID
   */
  getCalendarDatesForService(serviceId: string) {
    const calendarDatesData =
      this.gtfsParser.getFileDataSync('calendar_dates.txt');
    if (!calendarDatesData || !Array.isArray(calendarDatesData)) {
      return [];
    }

    return calendarDatesData
      .filter((calDate) => calDate.service_id === serviceId)
      .map((calDate) => ({
        serviceId: calDate.service_id,
        date: calDate.date,
        exceptionType: parseInt(calDate.exception_type),
      }));
  }

  /**
   * Enrich stop times with stop information
   */
  enrichStopTimesWithStops(stopTimes: Record<string, unknown>[]) {
    return stopTimes.map((stopTime: Record<string, unknown>) => {
      const stop = this.getStopById(stopTime.stop_id);
      return {
        ...stopTime,
        stop: stop,
      };
    });
  }

  /**
   * Get statistics for the GTFS feed
   */
  getStatistics() {
    const agencies = this.getAgencies();
    const routesData = this.gtfsParser.getFileDataSync('routes.txt') || [];
    const tripsData = this.gtfsParser.getFileDataSync('trips.txt') || [];
    const stopsData = this.gtfsParser.getFileDataSync('stops.txt') || [];
    const stopTimesData =
      this.gtfsParser.getFileDataSync('stop_times.txt') || [];

    return {
      agencies: agencies.length,
      routes: routesData.length,
      trips: tripsData.length,
      stops: stopsData.length,
      stopTimes: stopTimesData.length,
    };
  }

  /**
   * Get unique service IDs for a specific route
   */
  getServicesForRoute(routeId: string) {
    const trips = this.getTripsForRoute(routeId);
    const serviceIds = [...new Set(trips.map((trip) => trip.serviceId))];

    return serviceIds.map((serviceId) => {
      const calendar = this.getCalendarForService(serviceId);
      return {
        serviceId,
        calendar,
        tripCount: trips.filter((trip) => trip.serviceId === serviceId).length,
      };
    });
  }

  /**
   * Get services for a route grouped by direction
   */
  getServicesForRouteByDirection(routeId: string) {
    const trips = this.getTripsForRoute(routeId);

    // Group services by direction_id
    const directionGroups = new Map();

    trips.forEach((trip) => {
      const directionId = trip.directionId || '0'; // Default to 0 if not specified
      const key = `${trip.serviceId}_${directionId}`;

      if (!directionGroups.has(key)) {
        directionGroups.set(key, {
          serviceId: trip.serviceId,
          directionId: directionId,
          trips: [],
        });
      }

      directionGroups.get(key).trips.push(trip);
    });

    // Convert to array and add additional service information
    return Array.from(directionGroups.values()).map((group) => {
      const calendar = this.getCalendarForService(group.serviceId);
      return {
        serviceId: group.serviceId,
        directionId: group.directionId,
        calendar,
        tripCount: group.trips.length,
        directionName: this.getDirectionName(group.directionId, group.trips),
      };
    });
  }

  /**
   * Get a human-readable direction name
   */
  private getDirectionName(
    directionId: string,
    trips: Record<string, unknown>[]
  ): string {
    // Try to get direction name from trip headsigns
    const headsigns = [
      ...new Set(trips.map((trip) => trip.headsign).filter(Boolean)),
    ];

    if (headsigns.length === 1) {
      return headsigns[0];
    } else if (headsigns.length > 1) {
      return headsigns.join(' / ');
    }

    // Fallback to standard direction names
    switch (directionId) {
      case '0':
        return 'Outbound';
      case '1':
        return 'Inbound';
      default:
        return `Direction ${directionId}`;
    }
  }

  /**
   * Get route by ID
   */
  getRouteById(routeId: string) {
    const routesData = this.gtfsParser.getFileDataSync('routes.txt');
    if (!routesData || !Array.isArray(routesData)) {
      return null;
    }

    const route = routesData.find((route) => route.route_id === routeId);
    if (!route) {
      return null;
    }

    return {
      id: route.route_id,
      agencyId: route.agency_id,
      shortName: route.route_short_name,
      longName: route.route_long_name,
      desc: route.route_desc,
      type: route.route_type,
      url: route.route_url,
      color: route.route_color,
      textColor: route.route_text_color,
      sortOrder: route.route_sort_order,
    };
  }

  /**
   * Get trip by ID
   */
  getTripById(tripId: string) {
    const tripsData = this.gtfsParser.getFileDataSync('trips.txt');
    if (!tripsData || !Array.isArray(tripsData)) {
      return null;
    }

    const trip = tripsData.find((trip) => trip.trip_id === tripId);
    if (!trip) {
      return null;
    }

    return {
      id: trip.trip_id,
      routeId: trip.route_id,
      serviceId: trip.service_id,
      headsign: trip.trip_headsign,
      shortName: trip.trip_short_name,
      directionId: trip.direction_id,
      blockId: trip.block_id,
      shapeId: trip.shape_id,
      wheelchairAccessible: trip.wheelchair_accessible,
      bikesAllowed: trip.bikes_allowed,
    };
  }

  /**
   * Check if GTFS data is available
   */
  hasData() {
    const stats = this.getStatistics();
    return (
      stats.agencies > 0 ||
      stats.routes > 0 ||
      stats.trips > 0 ||
      stats.stops > 0
    );
  }

  // ========== ASYNC INDEXEDDB METHODS ==========

  /**
   * Get all agencies in the GTFS feed (async)
   */
  async getAgenciesAsync() {
    try {
      const agencyData = await this.gtfsDatabase.getAllRows('agency');
      if (!agencyData || !Array.isArray(agencyData)) {
        return [];
      }
      return agencyData.map((agency) => ({
        id: agency.agency_id,
        agency_id: agency.agency_id,
        name: agency.agency_name || `Agency ${agency.agency_id}`,
        agency_name: agency.agency_name || `Agency ${agency.agency_id}`,
        url: agency.agency_url,
        timezone: agency.agency_timezone,
        lang: agency.agency_lang,
        phone: agency.agency_phone,
        fare_url: agency.agency_fare_url,
        email: agency.agency_email,
      }));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error getting agencies from IndexedDB:', error);
      // Fallback to sync method
      return this.getAgencies();
    }
  }

  /**
   * Get all routes for a specific agency (async)
   */
  async getRoutesForAgencyAsync(agencyId: string) {
    try {
      const routesData = await this.gtfsDatabase.queryRows('routes', {
        agency_id: agencyId,
      });
      if (!routesData || !Array.isArray(routesData)) {
        return [];
      }

      return routesData.map((route) => ({
        id: route.route_id,
        route_id: route.route_id,
        agencyId: route.agency_id,
        agency_id: route.agency_id,
        shortName: route.route_short_name,
        route_short_name: route.route_short_name,
        longName: route.route_long_name,
        route_long_name: route.route_long_name,
        desc: route.route_desc,
        route_desc: route.route_desc,
        type: route.route_type,
        route_type: route.route_type,
        url: route.route_url,
        route_url: route.route_url,
        color: route.route_color,
        route_color: route.route_color,
        textColor: route.route_text_color,
        route_text_color: route.route_text_color,
        sortOrder: route.route_sort_order,
        route_sort_order: route.route_sort_order,
      }));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error getting routes for agency from IndexedDB:', error);
      // Fallback to sync method
      return this.getRoutesForAgency(agencyId);
    }
  }

  /**
   * Get all trips for a specific route (async)
   */
  async getTripsForRouteAsync(routeId: string) {
    try {
      const tripsData = await this.gtfsDatabase.queryRows('trips', {
        route_id: routeId,
      });
      if (!tripsData || !Array.isArray(tripsData)) {
        return [];
      }

      return tripsData.map((trip) => ({
        id: trip.trip_id,
        trip_id: trip.trip_id,
        routeId: trip.route_id,
        route_id: trip.route_id,
        serviceId: trip.service_id,
        service_id: trip.service_id,
        headsign: trip.trip_headsign,
        trip_headsign: trip.trip_headsign,
        shortName: trip.trip_short_name,
        trip_short_name: trip.trip_short_name,
        directionId: trip.direction_id,
        direction_id: trip.direction_id,
        blockId: trip.block_id,
        shapeId: trip.shape_id,
        wheelchairAccessible: trip.wheelchair_accessible,
        bikesAllowed: trip.bikes_allowed,
      }));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error getting trips for route from IndexedDB:', error);
      // Fallback to sync method
      return this.getTripsForRoute(routeId);
    }
  }

  /**
   * Get stop times for a specific trip (async)
   */
  async getStopTimesForTripAsync(tripId: string) {
    try {
      const stopTimesData = await this.gtfsDatabase.queryRows('stop_times', {
        trip_id: tripId,
      });
      if (!stopTimesData || !Array.isArray(stopTimesData)) {
        return [];
      }

      const stopTimes = stopTimesData
        .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence))
        .map((stopTime) => ({
          tripId: stopTime.trip_id,
          stopId: stopTime.stop_id,
          stopSequence: parseInt(stopTime.stop_sequence),
          arrivalTime: stopTime.arrival_time,
          departureTime: stopTime.departure_time,
          stopHeadsign: stopTime.stop_headsign,
          pickupType: stopTime.pickup_type,
          dropOffType: stopTime.drop_off_type,
          continuousPickup: stopTime.continuous_pickup,
          continuousDropOff: stopTime.continuous_drop_off,
          shapeDistTraveled: stopTime.shape_dist_traveled,
          timepoint: stopTime.timepoint,
        }));

      // Enrich with stop information
      return await this.enrichStopTimesWithStopsAsync(stopTimes);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error getting stop times for trip from IndexedDB:', error);
      // Fallback to sync method
      return this.getStopTimesForTrip(tripId);
    }
  }

  /**
   * Get stop details by stop ID (async)
   */
  async getStopByIdAsync(stopId: string) {
    try {
      const stopsData = await this.gtfsDatabase.queryRows('stops', {
        stop_id: stopId,
      });
      if (!stopsData || !Array.isArray(stopsData) || stopsData.length === 0) {
        return null;
      }

      const stop = stopsData[0];
      return {
        id: stop.stop_id,
        code: stop.stop_code,
        name: stop.stop_name,
        desc: stop.stop_desc,
        lat: parseFloat(stop.stop_lat),
        lon: parseFloat(stop.stop_lon),
        zoneId: stop.zone_id,
        url: stop.stop_url,
        locationType: stop.location_type,
        parentStation: stop.parent_station,
        timezone: stop.stop_timezone,
        wheelchairBoarding: stop.wheelchair_boarding,
        levelId: stop.level_id,
        platformCode: stop.platform_code,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error getting stop by ID from IndexedDB:', error);
      // Fallback to sync method
      return this.getStopById(stopId);
    }
  }

  /**
   * Get all trips that serve a specific stop (async)
   */
  async getTripsForStopAsync(stopId: string) {
    try {
      const stopTimesData = await this.gtfsDatabase.queryRows('stop_times', {
        stop_id: stopId,
      });
      if (!stopTimesData || !Array.isArray(stopTimesData)) {
        return [];
      }

      const tripIds = [
        ...new Set(stopTimesData.map((stopTime) => stopTime.trip_id)),
      ];

      const tripsData = await this.gtfsDatabase.getAllRows('trips');
      if (!tripsData || !Array.isArray(tripsData)) {
        return [];
      }

      return tripsData
        .filter((trip) => tripIds.includes(trip.trip_id))
        .map((trip) => ({
          id: trip.trip_id,
          routeId: trip.route_id,
          serviceId: trip.service_id,
          headsign: trip.trip_headsign,
          shortName: trip.trip_short_name,
          directionId: trip.direction_id,
          blockId: trip.block_id,
          shapeId: trip.shape_id,
        }));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error getting trips for stop from IndexedDB:', error);
      // Fallback to sync method
      return this.getTripsForStop(stopId);
    }
  }

  /**
   * Get calendar information for a service ID (async)
   */
  async getCalendarForServiceAsync(serviceId: string) {
    try {
      const calendarData = await this.gtfsDatabase.queryRows('calendar', {
        service_id: serviceId,
      });
      if (
        !calendarData ||
        !Array.isArray(calendarData) ||
        calendarData.length === 0
      ) {
        return null;
      }

      const calendar = calendarData[0];
      return {
        serviceId: calendar.service_id,
        monday: calendar.monday === '1',
        tuesday: calendar.tuesday === '1',
        wednesday: calendar.wednesday === '1',
        thursday: calendar.thursday === '1',
        friday: calendar.friday === '1',
        saturday: calendar.saturday === '1',
        sunday: calendar.sunday === '1',
        startDate: calendar.start_date,
        endDate: calendar.end_date,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        'Error getting calendar for service from IndexedDB:',
        error
      );
      // Fallback to sync method
      return this.getCalendarForService(serviceId);
    }
  }

  /**
   * Get calendar exceptions for a service ID (async)
   */
  async getCalendarDatesForServiceAsync(serviceId: string) {
    try {
      const calendarDatesData = await this.gtfsDatabase.queryRows(
        'calendar_dates',
        { service_id: serviceId }
      );
      if (!calendarDatesData || !Array.isArray(calendarDatesData)) {
        return [];
      }

      return calendarDatesData.map((calDate) => ({
        serviceId: calDate.service_id,
        date: calDate.date,
        exceptionType: parseInt(calDate.exception_type),
      }));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        'Error getting calendar dates for service from IndexedDB:',
        error
      );
      // Fallback to sync method
      return this.getCalendarDatesForService(serviceId);
    }
  }

  /**
   * Enrich stop times with stop information (async)
   */
  async enrichStopTimesWithStopsAsync(stopTimes: Record<string, unknown>[]) {
    try {
      const enrichedStopTimes = await Promise.all(
        stopTimes.map(async (stopTime: Record<string, unknown>) => {
          const stop = await this.getStopByIdAsync(stopTime.stopId);
          return {
            ...stopTime,
            stop: stop,
          };
        })
      );
      return enrichedStopTimes;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        'Error enriching stop times with stops from IndexedDB:',
        error
      );
      // Fallback to sync method
      return this.enrichStopTimesWithStops(stopTimes);
    }
  }

  /**
   * Get statistics for the GTFS feed (async)
   */
  async getStatisticsAsync() {
    try {
      const [agencies, routesData, tripsData, stopsData, stopTimesData] =
        await Promise.all([
          this.getAgenciesAsync(),
          this.gtfsDatabase.getAllRows('routes'),
          this.gtfsDatabase.getAllRows('trips'),
          this.gtfsDatabase.getAllRows('stops'),
          this.gtfsDatabase.getAllRows('stop_times'),
        ]);

      return {
        agencies: agencies.length,
        routes: routesData.length,
        trips: tripsData.length,
        stops: stopsData.length,
        stopTimes: stopTimesData.length,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error getting statistics from IndexedDB:', error);
      // Fallback to sync method
      return this.getStatistics();
    }
  }

  /**
   * Get unique service IDs for a specific route (async)
   */
  async getServicesForRouteAsync(routeId: string) {
    try {
      const trips = await this.getTripsForRouteAsync(routeId);
      const serviceIds = [...new Set(trips.map((trip) => trip.serviceId))];

      const services = await Promise.all(
        serviceIds.map(async (serviceId) => {
          const calendar = await this.getCalendarForServiceAsync(serviceId);
          return {
            serviceId,
            calendar,
            tripCount: trips.filter((trip) => trip.serviceId === serviceId)
              .length,
          };
        })
      );

      return services;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error getting services for route from IndexedDB:', error);
      // Fallback to sync method
      return this.getServicesForRoute(routeId);
    }
  }

  /**
   * Get services for a route grouped by direction (async)
   */
  async getServicesForRouteByDirectionAsync(routeId: string) {
    try {
      const trips = await this.getTripsForRouteAsync(routeId);

      // Group services by direction_id
      const directionGroups = new Map();

      trips.forEach((trip) => {
        const directionId = trip.directionId || '0'; // Default to 0 if not specified
        const key = `${trip.serviceId}_${directionId}`;

        if (!directionGroups.has(key)) {
          directionGroups.set(key, {
            serviceId: trip.serviceId,
            directionId: directionId,
            trips: [],
          });
        }

        directionGroups.get(key).trips.push(trip);
      });

      // Convert to array and add additional service information
      const services = await Promise.all(
        Array.from(directionGroups.values()).map(async (group) => {
          const calendar = await this.getCalendarForServiceAsync(
            group.serviceId
          );
          return {
            serviceId: group.serviceId,
            directionId: group.directionId,
            calendar,
            tripCount: group.trips.length,
            directionName: this.getDirectionName(
              group.directionId,
              group.trips
            ),
          };
        })
      );

      return services;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        'Error getting services for route by direction from IndexedDB:',
        error
      );
      // Fallback to sync method
      return this.getServicesForRouteByDirection(routeId);
    }
  }

  /**
   * Get route by ID (async)
   */
  async getRouteByIdAsync(routeId: string) {
    try {
      const routesData = await this.gtfsDatabase.queryRows('routes', {
        route_id: routeId,
      });
      if (
        !routesData ||
        !Array.isArray(routesData) ||
        routesData.length === 0
      ) {
        return null;
      }

      const route = routesData[0];
      return {
        id: route.route_id,
        agencyId: route.agency_id,
        shortName: route.route_short_name,
        longName: route.route_long_name,
        desc: route.route_desc,
        type: route.route_type,
        url: route.route_url,
        color: route.route_color,
        textColor: route.route_text_color,
        sortOrder: route.route_sort_order,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error getting route by ID from IndexedDB:', error);
      // Fallback to sync method
      return this.getRouteById(routeId);
    }
  }

  /**
   * Get trip by ID (async)
   */
  async getTripByIdAsync(tripId: string) {
    try {
      const tripsData = await this.gtfsDatabase.queryRows('trips', {
        trip_id: tripId,
      });
      if (!tripsData || !Array.isArray(tripsData) || tripsData.length === 0) {
        return null;
      }

      const trip = tripsData[0];
      return {
        id: trip.trip_id,
        routeId: trip.route_id,
        serviceId: trip.service_id,
        headsign: trip.trip_headsign,
        shortName: trip.trip_short_name,
        directionId: trip.direction_id,
        blockId: trip.block_id,
        shapeId: trip.shape_id,
        wheelchairAccessible: trip.wheelchair_accessible,
        bikesAllowed: trip.bikes_allowed,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error getting trip by ID from IndexedDB:', error);
      // Fallback to sync method
      return this.getTripById(tripId);
    }
  }

  /**
   * Check if GTFS data is available (async)
   */
  async hasDataAsync() {
    try {
      const stats = await this.getStatisticsAsync();
      return (
        stats.agencies > 0 ||
        stats.routes > 0 ||
        stats.trips > 0 ||
        stats.stops > 0
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error checking data availability from IndexedDB:', error);
      // Fallback to sync method
      return this.hasData();
    }
  }

  /**
   * Search stops by name/ID using IndexedDB (async)
   */
  async searchStopsAsync(query: string) {
    try {
      if (!query || query.trim().length < 2) {
        return [];
      }

      const stops = await this.gtfsDatabase.getAllRows('stops');
      const lowerQuery = query.toLowerCase();

      return stops
        .filter((stop) => {
          const stopName = (stop.stop_name || '').toLowerCase();
          const stopId = (stop.stop_id || '').toLowerCase();
          const stopCode = (stop.stop_code || '').toLowerCase();

          return (
            stopName.includes(lowerQuery) ||
            stopId.includes(lowerQuery) ||
            stopCode.includes(lowerQuery)
          );
        })
        .map((stop) => ({
          id: stop.stop_id,
          name: stop.stop_name || stop.stop_id,
          code: stop.stop_code,
          lat: parseFloat(stop.stop_lat),
          lon: parseFloat(stop.stop_lon),
          desc: stop.stop_desc,
        }))
        .slice(0, 10); // Limit to 10 results
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error searching stops from IndexedDB:', error);
      // Fallback to sync method from gtfsParser
      return this.gtfsParser.searchStops(query);
    }
  }

  /**
   * Search routes by name/ID using IndexedDB (async)
   */
  async searchRoutesAsync(query: string) {
    try {
      if (!query || query.trim().length < 2) {
        return [];
      }

      const routes = await this.gtfsDatabase.getAllRows('routes');
      const lowerQuery = query.toLowerCase();

      return routes
        .filter((route) => {
          const routeName = (route.route_long_name || '').toLowerCase();
          const routeShortName = (route.route_short_name || '').toLowerCase();
          const routeId = (route.route_id || '').toLowerCase();

          return (
            routeName.includes(lowerQuery) ||
            routeShortName.includes(lowerQuery) ||
            routeId.includes(lowerQuery)
          );
        })
        .map((route) => ({
          id: route.route_id,
          shortName: route.route_short_name,
          longName: route.route_long_name,
          type: route.route_type,
          color: route.route_color,
          textColor: route.route_text_color,
          agencyId: route.agency_id,
        }))
        .slice(0, 10); // Limit to 10 results
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error searching routes from IndexedDB:', error);
      // Fallback to sync method from gtfsParser
      return this.gtfsParser.searchRoutes(query);
    }
  }

  /**
   * Combined search for stops and routes (async)
   */
  async searchAllAsync(query: string) {
    try {
      if (!query || query.trim().length < 2) {
        return { stops: [], routes: [] };
      }

      const [stops, routes] = await Promise.all([
        this.searchStopsAsync(query),
        this.searchRoutesAsync(query),
      ]);

      return { stops, routes };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error performing combined search from IndexedDB:', error);
      // Fallback to sync method from gtfsParser
      return this.gtfsParser.searchAll(query);
    }
  }

  /**
   * Get agency by ID (async)
   */
  async getAgencyByIdAsync(agencyId: string) {
    try {
      const agencyData = await this.gtfsDatabase.queryRows('agency', {
        agency_id: agencyId,
      });
      if (
        !agencyData ||
        !Array.isArray(agencyData) ||
        agencyData.length === 0
      ) {
        return null;
      }

      const agency = agencyData[0];
      return {
        id: agency.agency_id,
        name: agency.agency_name || `Agency ${agency.agency_id}`,
        url: agency.agency_url,
        timezone: agency.agency_timezone,
        lang: agency.agency_lang,
        phone: agency.agency_phone,
        fare_url: agency.agency_fare_url,
        email: agency.agency_email,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error getting agency by ID from IndexedDB:', error);
      // Fallback to sync method
      const agencies = this.getAgencies();
      return agencies.find((agency) => agency.id === agencyId) || null;
    }
  }

  /**
   * Get all routes that serve a specific stop (async)
   */
  async getRoutesForStopAsync(stopId: string) {
    try {
      // First get all trips that serve this stop
      const trips = await this.getTripsForStopAsync(stopId);

      // Get unique route IDs from those trips
      const routeIds = [...new Set(trips.map((trip) => trip.routeId))];

      // Get route details for each route ID
      const routes = await Promise.all(
        routeIds.map((routeId) => this.getRouteByIdAsync(routeId))
      );

      // Filter out null routes and return
      return routes.filter((route) => route !== null);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error getting routes for stop from IndexedDB:', error);
      // Fallback implementation using sync methods
      const trips = this.getTripsForStop(stopId);
      const routeIds = [...new Set(trips.map((trip) => trip.routeId))];
      return routeIds
        .map((routeId) => this.getRouteById(routeId))
        .filter((route) => route !== null);
    }
  }
}
