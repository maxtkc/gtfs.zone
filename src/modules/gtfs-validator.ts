import { GTFSDatabaseRecord } from './gtfs-database.js';
import { GTFSTableMap, GTFSTableName } from '../types/gtfs-entities.js';

interface ValidationMessage {
  level: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
  field?: string;
}

interface ValidationResults {
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
  info: ValidationMessage[];
  summary: {
    isValid: boolean;
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
}

interface GTFSParserInterface {
  getFileDataSync(fileName: string): GTFSDatabaseRecord[] | null;
  getFileDataSyncTyped<T extends GTFSTableName>(fileName: `${T}.txt`): GTFSTableMap[T][] | null;
  getAllFileNames(): string[];
  gtfsData: {
    [fileName: string]: {
      content: string;
      data: GTFSDatabaseRecord[];
      errors: unknown[];
    };
  };
}

export class GTFSValidator {
  private gtfsParser: GTFSParserInterface;
  private validationResults: ValidationResults;

  constructor(gtfsParser: GTFSParserInterface) {
    this.gtfsParser = gtfsParser;
    this.validationResults = {
      errors: [],
      warnings: [],
      info: [],
      summary: {
        isValid: true,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      },
    };
  }

  validateFeed() {
    this.validationResults = {
      errors: [],
      warnings: [],
      info: [],
      summary: {
        isValid: true,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      },
    };

    // Run all validation checks
    this.validateRequiredFiles();
    this.validateAgencies();
    this.validateRoutes();
    this.validateTrips();
    this.validateStops();
    this.validateStopTimes();
    this.validateCalendar();
    this.validateShapes();
    this.validateReferences();

    // Update summary
    this.validationResults.summary.errorCount =
      this.validationResults.errors.length;
    this.validationResults.summary.warningCount =
      this.validationResults.warnings.length;
    this.validationResults.summary.infoCount =
      this.validationResults.info.length;
    this.validationResults.summary.isValid =
      this.validationResults.errors.length === 0;

    return this.validationResults;
  }

  validateRequiredFiles() {
    const requiredFiles = [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
    ];

    const calendarFiles = ['calendar.txt', 'calendar_dates.txt'];
    let hasCalendarFile = false;

    requiredFiles.forEach((fileName) => {
      if (!this.gtfsParser.getFileDataSync(fileName)) {
        this.addError(
          `Required file missing: ${fileName}`,
          'MISSING_REQUIRED_FILE',
          fileName
        );
      }
    });

    // Check calendar files - at least one is required
    calendarFiles.forEach((fileName) => {
      if (this.gtfsParser.getFileDataSync(fileName)) {
        hasCalendarFile = true;
      }
    });

    if (!hasCalendarFile) {
      this.addError(
        'At least one calendar file is required: calendar.txt or calendar_dates.txt',
        'MISSING_CALENDAR_FILE'
      );
    }
  }

  validateAgencies() {
    const agencies = this.gtfsParser.getFileDataSyncTyped('agency.txt');
    if (!agencies) {
      return;
    }

    if (agencies.length === 0) {
      this.addError('agency.txt is empty', 'EMPTY_FILE', 'agency.txt');
      return;
    }

    const agencyIds = new Set();

    agencies.forEach((agency, index: number) => {
      const rowNum = index + 1;

      // Required fields
      if (!agency.agency_name || agency.agency_name.trim() === '') {
        this.addError(
          `Row ${rowNum}: agency_name is required`,
          'MISSING_REQUIRED_FIELD',
          'agency.txt',
          rowNum
        );
      }

      if (!agency.agency_url || agency.agency_url.trim() === '') {
        this.addError(
          `Row ${rowNum}: agency_url is required`,
          'MISSING_REQUIRED_FIELD',
          'agency.txt',
          rowNum
        );
      } else if (!this.isValidUrl(agency.agency_url)) {
        this.addError(
          `Row ${rowNum}: agency_url is not a valid URL`,
          'INVALID_URL',
          'agency.txt',
          rowNum
        );
      }

      if (!agency.agency_timezone || agency.agency_timezone.trim() === '') {
        this.addError(
          `Row ${rowNum}: agency_timezone is required`,
          'MISSING_REQUIRED_FIELD',
          'agency.txt',
          rowNum
        );
      }

      // Check for duplicate agency_id
      if (agency.agency_id) {
        if (agencyIds.has(agency.agency_id)) {
          this.addError(
            `Row ${rowNum}: Duplicate agency_id '${agency.agency_id}'`,
            'DUPLICATE_ID',
            'agency.txt',
            rowNum
          );
        }
        agencyIds.add(agency.agency_id);
      } else if (agencies.length > 1) {
        this.addError(
          `Row ${rowNum}: agency_id is required when multiple agencies exist`,
          'MISSING_REQUIRED_FIELD',
          'agency.txt',
          rowNum
        );
      }
    });

    this.addInfo(`Found ${agencies.length} agencies`, 'AGENCY_COUNT');
  }

  validateRoutes() {
    const routes = this.gtfsParser.getFileDataSyncTyped('routes.txt');
    const agencies = this.gtfsParser.getFileDataSyncTyped('agency.txt');

    if (!routes) {
      return;
    }

    if (routes.length === 0) {
      this.addError('routes.txt is empty', 'EMPTY_FILE', 'routes.txt');
      return;
    }

    const routeIds = new Set();
    const agencyIds = new Set(
      (agencies || []).map((a) => a.agency_id)
    );

    routes.forEach((route, index: number) => {
      const rowNum = index + 1;

      // Required fields
      if (!route.route_id || route.route_id.trim() === '') {
        this.addError(
          `Row ${rowNum}: route_id is required`,
          'MISSING_REQUIRED_FIELD',
          'routes.txt',
          rowNum
        );
      } else {
        if (routeIds.has(route.route_id)) {
          this.addError(
            `Row ${rowNum}: Duplicate route_id '${route.route_id}'`,
            'DUPLICATE_ID',
            'routes.txt',
            rowNum
          );
        }
        routeIds.add(route.route_id);
      }

      if (!route.route_short_name && !route.route_long_name) {
        this.addError(
          `Row ${rowNum}: Either route_short_name or route_long_name is required`,
          'MISSING_REQUIRED_FIELD',
          'routes.txt',
          rowNum
        );
      }

      if (!route.route_type) {
        this.addError(
          `Row ${rowNum}: route_type is required`,
          'MISSING_REQUIRED_FIELD',
          'routes.txt',
          rowNum
        );
      } else {
        const validRouteTypes = [
          '0',
          '1',
          '2',
          '3',
          '4',
          '5',
          '6',
          '7',
          '11',
          '12',
        ];
        if (!validRouteTypes.includes(route.route_type)) {
          this.addWarning(
            `Row ${rowNum}: Unknown route_type '${route.route_type}'`,
            'UNKNOWN_ROUTE_TYPE',
            'routes.txt',
            rowNum
          );
        }
      }

      // Validate agency_id reference
      if (route.agency_id && !agencyIds.has(route.agency_id)) {
        this.addError(
          `Row ${rowNum}: agency_id '${route.agency_id}' not found in agency.txt`,
          'INVALID_REFERENCE',
          'routes.txt',
          rowNum
        );
      }
    });

    this.addInfo(`Found ${routes.length} routes`, 'ROUTE_COUNT');
  }

  validateStops() {
    const stops = this.gtfsParser.getFileDataSyncTyped('stops.txt');
    if (!stops) {
      return;
    }

    if (stops.length === 0) {
      this.addError('stops.txt is empty', 'EMPTY_FILE', 'stops.txt');
      return;
    }

    const stopIds = new Set();

    stops.forEach((stop, index: number) => {
      const rowNum = index + 1;

      // Required fields
      if (!stop.stop_id || stop.stop_id.trim() === '') {
        this.addError(
          `Row ${rowNum}: stop_id is required`,
          'MISSING_REQUIRED_FIELD',
          'stops.txt',
          rowNum
        );
      } else {
        if (stopIds.has(stop.stop_id)) {
          this.addError(
            `Row ${rowNum}: Duplicate stop_id '${stop.stop_id}'`,
            'DUPLICATE_ID',
            'stops.txt',
            rowNum
          );
        }
        stopIds.add(stop.stop_id);
      }

      if (!stop.stop_name || stop.stop_name.trim() === '') {
        this.addError(
          `Row ${rowNum}: stop_name is required`,
          'MISSING_REQUIRED_FIELD',
          'stops.txt',
          rowNum
        );
      }

      // Validate coordinates
      if (!stop.stop_lat || stop.stop_lat.trim() === '') {
        this.addError(
          `Row ${rowNum}: stop_lat is required`,
          'MISSING_REQUIRED_FIELD',
          'stops.txt',
          rowNum
        );
      } else {
        const lat = parseFloat(stop.stop_lat);
        if (isNaN(lat) || lat < -90 || lat > 90) {
          this.addError(
            `Row ${rowNum}: stop_lat must be between -90 and 90`,
            'INVALID_COORDINATE',
            'stops.txt',
            rowNum
          );
        }
      }

      if (!stop.stop_lon || stop.stop_lon.trim() === '') {
        this.addError(
          `Row ${rowNum}: stop_lon is required`,
          'MISSING_REQUIRED_FIELD',
          'stops.txt',
          rowNum
        );
      } else {
        const lon = parseFloat(stop.stop_lon);
        if (isNaN(lon) || lon < -180 || lon > 180) {
          this.addError(
            `Row ${rowNum}: stop_lon must be between -180 and 180`,
            'INVALID_COORDINATE',
            'stops.txt',
            rowNum
          );
        }
      }

      // Validate location_type
      if (stop.location_type) {
        const validLocationTypes = ['0', '1', '2', '3', '4'];
        if (!validLocationTypes.includes(stop.location_type)) {
          this.addWarning(
            `Row ${rowNum}: Unknown location_type '${stop.location_type}'`,
            'UNKNOWN_LOCATION_TYPE',
            'stops.txt',
            rowNum
          );
        }
      }
    });

    this.addInfo(`Found ${stops.length} stops`, 'STOP_COUNT');
  }

  validateTrips() {
    const trips = this.gtfsParser.getFileDataSyncTyped('trips.txt');
    const routes = this.gtfsParser.getFileDataSyncTyped('routes.txt');

    if (!trips) {
      return;
    }

    if (trips.length === 0) {
      this.addError('trips.txt is empty', 'EMPTY_FILE', 'trips.txt');
      return;
    }

    const tripIds = new Set();
    const routeIds = new Set(
      (routes || []).map((r) => r.route_id)
    );

    trips.forEach((trip, index: number) => {
      const rowNum = index + 1;

      // Required fields
      if (!trip.trip_id || trip.trip_id.trim() === '') {
        this.addError(
          `Row ${rowNum}: trip_id is required`,
          'MISSING_REQUIRED_FIELD',
          'trips.txt',
          rowNum
        );
      } else {
        if (tripIds.has(trip.trip_id)) {
          this.addError(
            `Row ${rowNum}: Duplicate trip_id '${trip.trip_id}'`,
            'DUPLICATE_ID',
            'trips.txt',
            rowNum
          );
        }
        tripIds.add(trip.trip_id);
      }

      if (!trip.route_id || trip.route_id.trim() === '') {
        this.addError(
          `Row ${rowNum}: route_id is required`,
          'MISSING_REQUIRED_FIELD',
          'trips.txt',
          rowNum
        );
      } else if (!routeIds.has(trip.route_id)) {
        this.addError(
          `Row ${rowNum}: route_id '${trip.route_id}' not found in routes.txt`,
          'INVALID_REFERENCE',
          'trips.txt',
          rowNum
        );
      }

      if (!trip.service_id || trip.service_id.trim() === '') {
        this.addError(
          `Row ${rowNum}: service_id is required`,
          'MISSING_REQUIRED_FIELD',
          'trips.txt',
          rowNum
        );
      }
    });

    this.addInfo(`Found ${trips.length} trips`, 'TRIP_COUNT');
  }

  validateStopTimes() {
    const stopTimes = this.gtfsParser.getFileDataSyncTyped('stop_times.txt');
    const trips = this.gtfsParser.getFileDataSyncTyped('trips.txt');
    const stops = this.gtfsParser.getFileDataSyncTyped('stops.txt');

    if (!stopTimes) {
      return;
    }

    if (stopTimes.length === 0) {
      this.addError('stop_times.txt is empty', 'EMPTY_FILE', 'stop_times.txt');
      return;
    }

    const tripIds = new Set(
      (trips || []).map((t) => t.trip_id)
    );
    const stopIds = new Set(
      (stops || []).map((s) => s.stop_id)
    );

    stopTimes.forEach((stopTime, index: number) => {
      const rowNum = index + 1;

      // Required fields
      if (!stopTime.trip_id || stopTime.trip_id.trim() === '') {
        this.addError(
          `Row ${rowNum}: trip_id is required`,
          'MISSING_REQUIRED_FIELD',
          'stop_times.txt',
          rowNum
        );
      } else if (!tripIds.has(stopTime.trip_id)) {
        this.addError(
          `Row ${rowNum}: trip_id '${stopTime.trip_id}' not found in trips.txt`,
          'INVALID_REFERENCE',
          'stop_times.txt',
          rowNum
        );
      }

      if (!stopTime.stop_id || stopTime.stop_id.trim() === '') {
        this.addError(
          `Row ${rowNum}: stop_id is required`,
          'MISSING_REQUIRED_FIELD',
          'stop_times.txt',
          rowNum
        );
      } else if (!stopIds.has(stopTime.stop_id)) {
        this.addError(
          `Row ${rowNum}: stop_id '${stopTime.stop_id}' not found in stops.txt`,
          'INVALID_REFERENCE',
          'stop_times.txt',
          rowNum
        );
      }

      if (!stopTime.stop_sequence) {
        this.addError(
          `Row ${rowNum}: stop_sequence is required`,
          'MISSING_REQUIRED_FIELD',
          'stop_times.txt',
          rowNum
        );
      } else if (isNaN(parseInt(stopTime.stop_sequence))) {
        this.addError(
          `Row ${rowNum}: stop_sequence must be a number`,
          'INVALID_NUMBER',
          'stop_times.txt',
          rowNum
        );
      }

      // Validate time format
      if (stopTime.arrival_time && !this.isValidTime(stopTime.arrival_time)) {
        this.addError(
          `Row ${rowNum}: arrival_time format is invalid`,
          'INVALID_TIME_FORMAT',
          'stop_times.txt',
          rowNum
        );
      }

      if (
        stopTime.departure_time &&
        !this.isValidTime(stopTime.departure_time)
      ) {
        this.addError(
          `Row ${rowNum}: departure_time format is invalid`,
          'INVALID_TIME_FORMAT',
          'stop_times.txt',
          rowNum
        );
      }
    });

    this.addInfo(`Found ${stopTimes.length} stop times`, 'STOP_TIME_COUNT');
  }

  validateCalendar() {
    const calendar = this.gtfsParser.getFileDataSyncTyped('calendar.txt');
    const calendarDates = this.gtfsParser.getFileDataSyncTyped('calendar_dates.txt');

    if (calendar) {
      calendar.forEach((service, index: number) => {
        const rowNum = index + 1;

        if (!service.service_id || service.service_id.trim() === '') {
          this.addError(
            `Row ${rowNum}: service_id is required`,
            'MISSING_REQUIRED_FIELD',
            'calendar.txt',
            rowNum
          );
        }

        // Validate date format
        if (service.start_date && !this.isValidDate(service.start_date)) {
          this.addError(
            `Row ${rowNum}: start_date format is invalid (should be YYYYMMDD)`,
            'INVALID_DATE_FORMAT',
            'calendar.txt',
            rowNum
          );
        }

        if (service.end_date && !this.isValidDate(service.end_date)) {
          this.addError(
            `Row ${rowNum}: end_date format is invalid (should be YYYYMMDD)`,
            'INVALID_DATE_FORMAT',
            'calendar.txt',
            rowNum
          );
        }
      });
    }

    if (calendarDates) {
      calendarDates.forEach((exception, index: number) => {
        const rowNum = index + 1;

        if (!exception.service_id || exception.service_id.trim() === '') {
          this.addError(
            `Row ${rowNum}: service_id is required`,
            'MISSING_REQUIRED_FIELD',
            'calendar_dates.txt',
            rowNum
          );
        }

        if (!exception.date || !this.isValidDate(exception.date)) {
          this.addError(
            `Row ${rowNum}: date format is invalid (should be YYYYMMDD)`,
            'INVALID_DATE_FORMAT',
            'calendar_dates.txt',
            rowNum
          );
        }

        if (
          !exception.exception_type ||
          !['1', '2'].includes(exception.exception_type)
        ) {
          this.addError(
            `Row ${rowNum}: exception_type must be 1 or 2`,
            'INVALID_EXCEPTION_TYPE',
            'calendar_dates.txt',
            rowNum
          );
        }
      });
    }
  }

  validateShapes() {
    const shapes = this.gtfsParser.getFileDataSyncTyped('shapes.txt');
    if (!shapes) {
      return;
    }

    shapes.forEach((shape, index: number) => {
      const rowNum = index + 1;

      if (!shape.shape_id || shape.shape_id.trim() === '') {
        this.addError(
          `Row ${rowNum}: shape_id is required`,
          'MISSING_REQUIRED_FIELD',
          'shapes.txt',
          rowNum
        );
      }

      // Validate coordinates
      if (!shape.shape_pt_lat) {
        this.addError(
          `Row ${rowNum}: shape_pt_lat is required`,
          'MISSING_REQUIRED_FIELD',
          'shapes.txt',
          rowNum
        );
      } else {
        const lat = parseFloat(shape.shape_pt_lat);
        if (isNaN(lat) || lat < -90 || lat > 90) {
          this.addError(
            `Row ${rowNum}: shape_pt_lat must be between -90 and 90`,
            'INVALID_COORDINATE',
            'shapes.txt',
            rowNum
          );
        }
      }

      if (!shape.shape_pt_lon) {
        this.addError(
          `Row ${rowNum}: shape_pt_lon is required`,
          'MISSING_REQUIRED_FIELD',
          'shapes.txt',
          rowNum
        );
      } else {
        const lon = parseFloat(shape.shape_pt_lon);
        if (isNaN(lon) || lon < -180 || lon > 180) {
          this.addError(
            `Row ${rowNum}: shape_pt_lon must be between -180 and 180`,
            'INVALID_COORDINATE',
            'shapes.txt',
            rowNum
          );
        }
      }

      if (!shape.shape_pt_sequence) {
        this.addError(
          `Row ${rowNum}: shape_pt_sequence is required`,
          'MISSING_REQUIRED_FIELD',
          'shapes.txt',
          rowNum
        );
      } else if (isNaN(parseInt(shape.shape_pt_sequence))) {
        this.addError(
          `Row ${rowNum}: shape_pt_sequence must be a number`,
          'INVALID_NUMBER',
          'shapes.txt',
          rowNum
        );
      }
    });

    this.addInfo(`Found ${shapes.length} shape points`, 'SHAPE_POINT_COUNT');
  }

  validateReferences() {
    // Additional cross-reference validation
    const trips = this.gtfsParser.getFileDataSyncTyped('trips.txt');
    const stopTimes = this.gtfsParser.getFileDataSyncTyped('stop_times.txt');

    if (trips && stopTimes) {
      const tripIds = new Set(trips.map((t) => t.trip_id));
      const tripsWithStopTimes = new Set(
        stopTimes.map((st) => st.trip_id)
      );

      // Check for trips without stop times
      tripIds.forEach((tripId: string) => {
        if (!tripsWithStopTimes.has(tripId)) {
          this.addWarning(
            `Trip '${tripId}' has no stop times`,
            'TRIP_WITHOUT_STOP_TIMES',
            'trips.txt'
          );
        }
      });
    }
  }

  // Helper methods
  addError(
    message: string,
    code: string,
    fileName: string | null = null,
    rowNum: number | null = null
  ) {
    this.validationResults.errors.push({
      level: 'error',
      message,
      file: fileName || undefined,
      line: rowNum || undefined,
    });
  }

  addWarning(
    message: string,
    code: string,
    fileName: string | null = null,
    rowNum: number | null = null
  ) {
    this.validationResults.warnings.push({
      level: 'warning',
      message,
      file: fileName || undefined,
      line: rowNum || undefined,
    });
  }

  addInfo(
    message: string,
    code: string,
    fileName: string | null = null,
    rowNum: number | null = null
  ) {
    this.validationResults.info.push({
      level: 'info',
      message,
      file: fileName || undefined,
      line: rowNum || undefined,
    });
  }

  isValidUrl(url: string) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  isValidTime(time: string) {
    // GTFS time format: HH:MM:SS or H:MM:SS (hours can exceed 24)
    return /^\d{1,2}:\d{2}:\d{2}$/.test(time);
  }

  isValidDate(date: string) {
    // GTFS date format: YYYYMMDD
    if (!/^\d{8}$/.test(date)) {
      return false;
    }

    const year = parseInt(date.substr(0, 4));
    const month = parseInt(date.substr(4, 2));
    const day = parseInt(date.substr(6, 2));

    return (
      year >= 1900 &&
      year <= 2200 &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    );
  }

  getValidationSummary() {
    return this.validationResults.summary;
  }

  getValidationResults() {
    return this.validationResults;
  }

  hasErrors() {
    return this.validationResults.errors.length > 0;
  }

  hasWarnings() {
    return this.validationResults.warnings.length > 0;
  }
}
