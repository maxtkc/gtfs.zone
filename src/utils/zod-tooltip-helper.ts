/**
 * Utility functions for extracting Zod schema descriptions and creating tooltips
 */

import {
  AgencySchema,
  RoutesSchema,
  CalendarSchema,
  CalendarDatesSchema,
  StopsSchema,
  TripsSchema,
  StopTimesSchema,
  ShapesSchema,
  FeedInfoSchema,
} from '../types/gtfs.js';

/**
 * Extract description from a Zod schema field
 */
function getFieldDescription(
  schema: Record<string, unknown>,
  fieldName: string
): string {
  try {
    if (!schema) {
      return '';
    }

    // Access the schema shape - try multiple ways to be compatible
    const shape = schema._def?.shape || schema.shape;

    if (!shape) {
      return '';
    }

    if (!shape[fieldName]) {
      return '';
    }

    const field = shape[fieldName];

    // Try multiple ways to access the description based on Zod's structure
    const description =
      field.description || // Direct access
      field._def?.description || // Internal _def access
      '';

    return description;
  } catch (e) {
    console.error('Error in getFieldDescription:', e);
    return '';
  }
}

/**
 * Get agency field descriptions
 */
export function getAgencyFieldDescription(fieldName: string): string {
  return getFieldDescription(AgencySchema, fieldName);
}

/**
 * Get route field descriptions
 */
export function getRouteFieldDescription(fieldName: string): string {
  return getFieldDescription(RoutesSchema, fieldName);
}

/**
 * Get calendar field descriptions
 */
export function getCalendarFieldDescription(fieldName: string): string {
  return getFieldDescription(CalendarSchema, fieldName);
}

/**
 * Get calendar dates field descriptions
 */
export function getCalendarDatesFieldDescription(fieldName: string): string {
  return getFieldDescription(CalendarDatesSchema, fieldName);
}

/**
 * Get stops field descriptions
 */
export function getStopsFieldDescription(fieldName: string): string {
  return getFieldDescription(StopsSchema, fieldName);
}

/**
 * Get trips field descriptions
 */
export function getTripsFieldDescription(fieldName: string): string {
  return getFieldDescription(TripsSchema, fieldName);
}

/**
 * Get stop times field descriptions
 */
export function getStopTimesFieldDescription(fieldName: string): string {
  return getFieldDescription(StopTimesSchema, fieldName);
}

/**
 * Get shapes field descriptions
 */
export function getShapesFieldDescription(fieldName: string): string {
  return getFieldDescription(ShapesSchema, fieldName);
}

/**
 * Get feed info field descriptions
 */
export function getFeedInfoFieldDescription(fieldName: string): string {
  return getFieldDescription(FeedInfoSchema, fieldName);
}

/**
 * Get field description for any GTFS file type
 * @param filename - The GTFS filename (e.g., 'agency.txt', 'routes.txt')
 * @param fieldName - The field name to get description for
 * @returns Field description string
 */
export function getGTFSFieldDescription(
  filename: string,
  fieldName: string
): string {
  // Map filenames to schema getter functions
  const schemaMap: Record<string, (fieldName: string) => string> = {
    'agency.txt': getAgencyFieldDescription,
    'routes.txt': getRouteFieldDescription,
    'calendar.txt': getCalendarFieldDescription,
    'calendar_dates.txt': getCalendarDatesFieldDescription,
    'stops.txt': getStopsFieldDescription,
    'trips.txt': getTripsFieldDescription,
    'stop_times.txt': getStopTimesFieldDescription,
    'shapes.txt': getShapesFieldDescription,
    'feed_info.txt': getFeedInfoFieldDescription,
  };

  const schemaGetter = schemaMap[filename];
  if (schemaGetter) {
    return schemaGetter(getSchemaFieldName(fieldName));
  }

  return '';
}

/**
 * Create a tooltip wrapper with DaisyUI classes
 */
export function createTooltip(content: string, tooltip: string): string {
  if (!tooltip) {
    return content;
  }

  // Escape HTML in tooltip content
  const escapedTooltip = tooltip
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  return `<div class="tooltip tooltip-info" data-tip="${escapedTooltip}">${content}</div>`;
}

/**
 * Map common GTFS field names to their schema field names
 */
const fieldNameMap: Record<string, string> = {
  // Agency fields (both underscore and camelCase versions)
  agency_id: 'agencyId',
  id: 'agencyId', // Agency id without prefix
  agency_name: 'agencyName',
  name: 'agencyName', // Agency name without prefix
  agency_url: 'agencyUrl',
  url: 'agencyUrl', // Agency url without prefix
  agency_timezone: 'agencyTimezone',
  timezone: 'agencyTimezone', // Agency timezone without prefix
  agency_lang: 'agencyLang',
  lang: 'agencyLang', // Agency lang without prefix
  agency_phone: 'agencyPhone',
  phone: 'agencyPhone', // Agency phone without prefix
  agency_fare_url: 'agencyFareUrl',
  fare_url: 'agencyFareUrl', // Agency fare_url without prefix
  agency_email: 'agencyEmail',
  email: 'agencyEmail', // Agency email without prefix

  // Route fields
  route_id: 'routeId',
  route_short_name: 'routeShortName',
  route_long_name: 'routeLongName',
  route_desc: 'routeDesc',
  route_type: 'routeType',
  route_url: 'routeUrl',
  route_color: 'routeColor',
  route_text_color: 'routeTextColor',
  route_sort_order: 'routeSortOrder',

  // Service/Calendar fields
  service_id: 'serviceId',
  start_date: 'startDate',
  end_date: 'endDate',
  exception_type: 'exceptionType',
};

/**
 * Convert GTFS field name to schema field name
 */
export function getSchemaFieldName(gtfsFieldName: string): string {
  return fieldNameMap[gtfsFieldName] || gtfsFieldName;
}
