/**
 * Utility functions for extracting Zod schema descriptions and creating tooltips
 */

import {
  AgencySchema,
  RoutesSchema,
  CalendarSchema,
  CalendarDatesSchema,
} from '../types/gtfs.js';

/**
 * Extract description from a Zod schema field
 */
function getFieldDescription(schema: any, fieldName: string): string {
  try {
    console.log(
      'getFieldDescription called with:',
      fieldName,
      'schema:',
      schema
    );

    if (!schema) {
      console.log('Schema is null/undefined');
      return '';
    }

    const shape = schema._def?.shape || schema.shape;
    console.log('Schema shape:', shape);

    if (!shape) {
      console.log('No shape found in schema');
      return '';
    }

    if (!shape[fieldName]) {
      console.log(
        `Field ${fieldName} not found in shape. Available fields:`,
        Object.keys(shape)
      );
      return '';
    }

    const field = shape[fieldName];
    console.log(`Field ${fieldName}:`, field);
    console.log(`Field ${fieldName}._def:`, field._def);

    const description = field._def?.description || '';
    console.log(`Description for ${fieldName}:`, description);

    return description;
  } catch (e) {
    console.log('Error in getFieldDescription:', e);
    return '';
  }
}

/**
 * Get agency field descriptions
 */
export function getAgencyFieldDescription(fieldName: string): string {
  console.log('getAgencyFieldDescription called with:', fieldName);
  console.log('AgencySchema:', AgencySchema);
  console.log('typeof AgencySchema:', typeof AgencySchema);

  // Temporary hardcoded tooltips for testing
  const testTooltips: Record<string, string> = {
    agencyId:
      'Identifies a transit brand which is often synonymous with a transit agency. Note that in some cases, such as when a single agency operates multiple separate services, agencies and brands are distinct.',
    agencyName: 'Full name of the transit agency.',
    agencyUrl: 'URL of the transit agency.',
    agencyTimezone:
      'Timezone where the transit agency is located. If multiple agencies are specified in the dataset, each must have the same agency_timezone.',
    agencyLang:
      'Primary language used by this transit agency. Should be provided to help GTFS consumers choose capitalization rules and other language-specific settings for the dataset.',
    agencyPhone: 'A voice telephone number for the specified agency.',
    agencyFareUrl:
      'URL of a web page that contains the details of the fares and also could allow purchase of tickets for that agency online.',
    agencyEmail:
      "Email address actively monitored by the agency's customer service department.",
  };

  const testResult = testTooltips[fieldName] || '';
  console.log('Using test tooltip for', fieldName, ':', testResult);

  if (AgencySchema) {
    console.log('AgencySchema._def:', AgencySchema._def);
    console.log('AgencySchema.shape:', AgencySchema.shape);
  }

  const result = getFieldDescription(AgencySchema, fieldName);
  console.log('getFieldDescription result:', result);

  // Return test tooltip for now to verify tooltip display works
  return testResult;
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
