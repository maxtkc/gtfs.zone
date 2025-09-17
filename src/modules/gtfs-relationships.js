/**
 * GTFS Relationships Module
 * Handles hierarchical navigation through GTFS data
 * Agency → Routes → Trips → Stop Times → Stops
 */

export class GTFSRelationships {
  constructor(gtfsParser) {
    this.gtfsParser = gtfsParser;
  }

  /**
   * Get all agencies in the GTFS feed
   */
  getAgencies() {
    const agencyData = this.gtfsParser.getFileData('agency.txt');
    if (!agencyData || !Array.isArray(agencyData)) {
      return [];
    }
    return agencyData.map(agency => ({
      id: agency.agency_id,
      name: agency.agency_name || `Agency ${agency.agency_id}`,
      url: agency.agency_url,
      timezone: agency.agency_timezone,
      lang: agency.agency_lang,
      phone: agency.agency_phone,
      fare_url: agency.agency_fare_url,
      email: agency.agency_email
    }));
  }

  /**
   * Get all routes for a specific agency
   */
  getRoutesForAgency(agencyId) {
    const routesData = this.gtfsParser.getFileData('routes.txt');
    if (!routesData || !Array.isArray(routesData)) {
      return [];
    }
    
    return routesData
      .filter(route => route.agency_id === agencyId)
      .map(route => ({
        id: route.route_id,
        agencyId: route.agency_id,
        shortName: route.route_short_name,
        longName: route.route_long_name,
        desc: route.route_desc,
        type: route.route_type,
        url: route.route_url,
        color: route.route_color,
        textColor: route.route_text_color,
        sortOrder: route.route_sort_order
      }));
  }

  /**
   * Get all trips for a specific route
   */
  getTripsForRoute(routeId) {
    const tripsData = this.gtfsParser.getFileData('trips.txt');
    if (!tripsData || !Array.isArray(tripsData)) {
      return [];
    }
    
    return tripsData
      .filter(trip => trip.route_id === routeId)
      .map(trip => ({
        id: trip.trip_id,
        routeId: trip.route_id,
        serviceId: trip.service_id,
        headsign: trip.trip_headsign,
        shortName: trip.trip_short_name,
        directionId: trip.direction_id,
        blockId: trip.block_id,
        shapeId: trip.shape_id,
        wheelchairAccessible: trip.wheelchair_accessible,
        bikesAllowed: trip.bikes_allowed
      }));
  }

  /**
   * Get stop times for a specific trip
   */
  getStopTimesForTrip(tripId) {
    const stopTimesData = this.gtfsParser.getFileData('stop_times.txt');
    if (!stopTimesData || !Array.isArray(stopTimesData)) {
      return [];
    }
    
    const stopTimes = stopTimesData
      .filter(stopTime => stopTime.trip_id === tripId)
      .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence))
      .map(stopTime => ({
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
        timepoint: stopTime.timepoint
      }));

    // Enrich with stop information
    return this.enrichStopTimesWithStops(stopTimes);
  }

  /**
   * Get stop details by stop ID
   */
  getStopById(stopId) {
    const stopsData = this.gtfsParser.getFileData('stops.txt');
    if (!stopsData || !Array.isArray(stopsData)) {
      return null;
    }
    
    const stop = stopsData.find(stop => stop.stop_id === stopId);
    if (!stop) return null;
    
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
      platformCode: stop.platform_code
    };
  }

  /**
   * Get all trips that serve a specific stop
   */
  getTripsForStop(stopId) {
    const stopTimesData = this.gtfsParser.getFileData('stop_times.txt');
    if (!stopTimesData || !Array.isArray(stopTimesData)) {
      return [];
    }
    
    const tripIds = [...new Set(
      stopTimesData
        .filter(stopTime => stopTime.stop_id === stopId)
        .map(stopTime => stopTime.trip_id)
    )];
    
    const tripsData = this.gtfsParser.getFileData('trips.txt');
    if (!tripsData || !Array.isArray(tripsData)) {
      return [];
    }
    
    return tripsData
      .filter(trip => tripIds.includes(trip.trip_id))
      .map(trip => ({
        id: trip.trip_id,
        routeId: trip.route_id,
        serviceId: trip.service_id,
        headsign: trip.trip_headsign,
        shortName: trip.trip_short_name,
        directionId: trip.direction_id,
        blockId: trip.block_id,
        shapeId: trip.shape_id
      }));
  }

  /**
   * Get calendar information for a service ID
   */
  getCalendarForService(serviceId) {
    const calendarData = this.gtfsParser.getFileData('calendar.txt');
    if (!calendarData || !Array.isArray(calendarData)) {
      return null;
    }
    
    const calendar = calendarData.find(cal => cal.service_id === serviceId);
    if (!calendar) return null;
    
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
      endDate: calendar.end_date
    };
  }

  /**
   * Get calendar exceptions for a service ID
   */
  getCalendarDatesForService(serviceId) {
    const calendarDatesData = this.gtfsParser.getFileData('calendar_dates.txt');
    if (!calendarDatesData || !Array.isArray(calendarDatesData)) {
      return [];
    }
    
    return calendarDatesData
      .filter(calDate => calDate.service_id === serviceId)
      .map(calDate => ({
        serviceId: calDate.service_id,
        date: calDate.date,
        exceptionType: parseInt(calDate.exception_type)
      }));
  }

  /**
   * Enrich stop times with stop information
   */
  enrichStopTimesWithStops(stopTimes) {
    return stopTimes.map(stopTime => {
      const stop = this.getStopById(stopTime.stopId);
      return {
        ...stopTime,
        stop: stop
      };
    });
  }

  /**
   * Get statistics for the GTFS feed
   */
  getStatistics() {
    const agencies = this.getAgencies();
    const routesData = this.gtfsParser.getFileData('routes.txt') || [];
    const tripsData = this.gtfsParser.getFileData('trips.txt') || [];
    const stopsData = this.gtfsParser.getFileData('stops.txt') || [];
    const stopTimesData = this.gtfsParser.getFileData('stop_times.txt') || [];
    
    return {
      agencies: agencies.length,
      routes: routesData.length,
      trips: tripsData.length,
      stops: stopsData.length,
      stopTimes: stopTimesData.length
    };
  }

  /**
   * Check if GTFS data is available
   */
  hasData() {
    const stats = this.getStatistics();
    return stats.agencies > 0 || stats.routes > 0 || stats.trips > 0 || stats.stops > 0;
  }
}