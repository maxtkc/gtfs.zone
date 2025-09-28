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
  GTFS_TABLES,
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
 * @param filename - The GTFS filename (e.g., agency.txt, routes.txt)
 * @param fieldName - The field name to get description for
 * @returns Field description string
 */
export function getGTFSFieldDescription(
  filename: string,
  fieldName: string
): string {
  // Map filenames to schema getter functions
  const schemaMap: Record<string, (fieldName: string) => string> = {
    [GTFS_TABLES.AGENCY]: getAgencyFieldDescription,
    [GTFS_TABLES.ROUTES]: getRouteFieldDescription,
    [GTFS_TABLES.CALENDAR]: getCalendarFieldDescription,
    [GTFS_TABLES.CALENDAR_DATES]: getCalendarDatesFieldDescription,
    [GTFS_TABLES.STOPS]: getStopsFieldDescription,
    [GTFS_TABLES.TRIPS]: getTripsFieldDescription,
    [GTFS_TABLES.STOP_TIMES]: getStopTimesFieldDescription,
    [GTFS_TABLES.SHAPES]: getShapesFieldDescription,
    [GTFS_TABLES.FEED_INFO]: getFeedInfoFieldDescription,
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
 * Keep snake_case field names to match GTFS specification.
 * This ensures consistency with the GTFS type generation.
 */
function formatFieldName(fieldName: string): string {
  // Keep snake_case field names to match GTFS specification
  return fieldName;
}

/**
 * Convert GTFS field name to schema field name
 */
export function getSchemaFieldName(gtfsFieldName: string): string {
  return formatFieldName(gtfsFieldName);
}
