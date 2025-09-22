/**
 * Utility functions for extracting Zod schema descriptions and creating tooltips
 */

import {
  AgencySchema,
  RoutesSchema,
  CalendarSchema,
  CalendarDatesSchema,
} from '../types/gtfs.js';

interface SchemaField {
  description?: string;
}

/**
 * Extract description from a Zod schema field
 */
function getFieldDescription(schema: any, fieldName: string): string {
  try {
    const shape = schema._def?.shape || schema.shape;
    if (!shape || !shape[fieldName]) {
      return '';
    }

    const field = shape[fieldName];
    return field._def?.description || '';
  } catch (e) {
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
  agency_id: 'agencyId',
  agency_name: 'agencyName',
  agency_url: 'agencyUrl',
  agency_timezone: 'agencyTimezone',
  agency_lang: 'agencyLang',
  agency_phone: 'agencyPhone',
  agency_fare_url: 'agencyFareUrl',
  agency_email: 'agencyEmail',
  route_id: 'routeId',
  route_short_name: 'routeShortName',
  route_long_name: 'routeLongName',
  route_desc: 'routeDesc',
  route_type: 'routeType',
  route_url: 'routeUrl',
  route_color: 'routeColor',
  route_text_color: 'routeTextColor',
  route_sort_order: 'routeSortOrder',
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
