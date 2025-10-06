/**
 * GTFS Enumeration Definitions
 *
 * Based on the official GTFS specification at https://gtfs.org/schedule/reference/
 * Defines all valid enum values for GTFS fields
 */

export interface GTFSEnumOption {
  value: number | string;
  label: string;
  description?: string;
}

/**
 * Registry of all GTFS enum fields and their valid values
 */
export const GTFS_ENUMS: Record<string, GTFSEnumOption[]> = {
  // stops.txt
  location_type: [
    {
      value: 0,
      label: 'Stop/Platform',
      description:
        'A location where passengers board or disembark from a transit vehicle',
    },
    {
      value: 1,
      label: 'Station',
      description:
        'A physical structure or area that contains one or more platform',
    },
    {
      value: 2,
      label: 'Entrance/Exit',
      description:
        'A location where passengers can enter or exit a station from the street',
    },
    {
      value: 3,
      label: 'Generic Node',
      description: 'A location within a station used to link together pathways',
    },
    {
      value: 4,
      label: 'Boarding Area',
      description:
        'A specific location on a platform where passengers can board and/or alight vehicles',
    },
  ],

  wheelchair_boarding: [
    {
      value: 0,
      label: 'No information',
      description: 'No accessibility information available',
    },
    { value: 1, label: 'Accessible', description: 'Wheelchair accessible' },
    {
      value: 2,
      label: 'Not accessible',
      description: 'Not wheelchair accessible',
    },
  ],

  // routes.txt
  route_type: [
    {
      value: 0,
      label: 'Tram/Streetcar/Light rail',
      description:
        'Any light rail or street level system within a metropolitan area',
    },
    {
      value: 1,
      label: 'Subway/Metro',
      description: 'Any underground rail system within a metropolitan area',
    },
    {
      value: 2,
      label: 'Rail',
      description: 'Used for intercity or long-distance travel',
    },
    {
      value: 3,
      label: 'Bus',
      description: 'Used for short- and long-distance bus routes',
    },
    {
      value: 4,
      label: 'Ferry',
      description: 'Used for short- and long-distance boat service',
    },
    {
      value: 5,
      label: 'Cable tram',
      description:
        'Street-level rail cars where the cable runs beneath the vehicle',
    },
    {
      value: 6,
      label: 'Aerial lift',
      description:
        'Cable transport where cabins, cars, gondolas or open chairs are suspended by cables',
    },
    {
      value: 7,
      label: 'Funicular',
      description: 'Any rail system designed for steep inclines',
    },
    {
      value: 11,
      label: 'Trolleybus',
      description:
        'Electric buses that draw power from overhead wires using poles',
    },
    {
      value: 12,
      label: 'Monorail',
      description:
        'Railway in which the track consists of a single rail or a beam',
    },
  ],

  continuous_pickup: [
    { value: 0, label: 'Continuous stopping pickup' },
    { value: 1, label: 'No continuous stopping pickup' },
    { value: 2, label: 'Must phone agency' },
    { value: 3, label: 'Must coordinate with driver' },
  ],

  continuous_drop_off: [
    { value: 0, label: 'Continuous stopping drop off' },
    { value: 1, label: 'No continuous stopping drop off' },
    { value: 2, label: 'Must phone agency' },
    { value: 3, label: 'Must coordinate with driver' },
  ],

  // trips.txt
  direction_id: [
    {
      value: 0,
      label: 'Outbound',
      description: 'Travel in one direction (e.g. outbound travel)',
    },
    {
      value: 1,
      label: 'Inbound',
      description: 'Travel in the opposite direction (e.g. inbound travel)',
    },
  ],

  wheelchair_accessible: [
    {
      value: 0,
      label: 'No information',
      description: 'No accessibility information for the trip',
    },
    {
      value: 1,
      label: 'Accessible',
      description: 'Vehicle can accommodate at least one rider in a wheelchair',
    },
    {
      value: 2,
      label: 'Not accessible',
      description: 'No riders in wheelchairs can be accommodated on this trip',
    },
  ],

  bikes_allowed: [
    {
      value: 0,
      label: 'No information',
      description: 'No bike information for the trip',
    },
    {
      value: 1,
      label: 'Allowed',
      description: 'Vehicle can accommodate at least one bicycle',
    },
    {
      value: 2,
      label: 'Not allowed',
      description: 'No bicycles are allowed on this trip',
    },
  ],

  cars_allowed: [
    {
      value: 0,
      label: 'No information',
      description: 'No car information for the trip',
    },
    {
      value: 1,
      label: 'Allowed',
      description: 'Vehicle can accommodate at least one car',
    },
    {
      value: 2,
      label: 'Not allowed',
      description: 'No cars are allowed on this trip',
    },
  ],

  // stop_times.txt
  pickup_type: [
    { value: 0, label: 'Regularly scheduled pickup' },
    { value: 1, label: 'No pickup available' },
    { value: 2, label: 'Must phone agency' },
    { value: 3, label: 'Must coordinate with driver' },
  ],

  drop_off_type: [
    { value: 0, label: 'Regularly scheduled drop off' },
    { value: 1, label: 'No drop off available' },
    { value: 2, label: 'Must phone agency' },
    { value: 3, label: 'Must coordinate with driver' },
  ],

  timepoint: [
    {
      value: 0,
      label: 'Approximate time',
      description: 'Times are considered approximate',
    },
    {
      value: 1,
      label: 'Exact time',
      description: 'Times are considered exact',
    },
  ],

  // calendar_dates.txt
  exception_type: [
    {
      value: 1,
      label: 'Service added',
      description: 'Service has been added for the specified date',
    },
    {
      value: 2,
      label: 'Service removed',
      description: 'Service has been removed for the specified date',
    },
  ],

  // fare_attributes.txt
  payment_method: [
    { value: 0, label: 'On board', description: 'Fare is paid on board' },
    {
      value: 1,
      label: 'Before boarding',
      description: 'Fare must be paid before boarding',
    },
  ],

  transfers: [
    {
      value: 0,
      label: 'No transfers',
      description: 'No transfers permitted on this fare',
    },
    {
      value: 1,
      label: 'One transfer',
      description: 'Riders may transfer once',
    },
    {
      value: 2,
      label: 'Two transfers',
      description: 'Riders may transfer twice',
    },
    {
      value: '',
      label: 'Unlimited',
      description: 'Unlimited transfers are permitted',
    },
  ],

  // transfers.txt
  transfer_type: [
    { value: 0, label: 'Recommended transfer point' },
    {
      value: 1,
      label: 'Timed transfer point',
      description: 'Departing vehicle waits for arriving vehicle',
    },
    { value: 2, label: 'Minimum transfer time required' },
    { value: 3, label: 'Transfers not possible' },
    {
      value: 4,
      label: 'In-seat transfer',
      description: 'Passengers can remain in vehicle',
    },
    {
      value: 5,
      label: 'In-seat transfer not allowed',
      description: 'Passengers must disembark and re-board',
    },
  ],

  // pathways.txt
  pathway_mode: [
    { value: 1, label: 'Walkway' },
    { value: 2, label: 'Stairs' },
    { value: 3, label: 'Moving sidewalk/travelator' },
    { value: 4, label: 'Escalator' },
    { value: 5, label: 'Elevator' },
    {
      value: 6,
      label: 'Fare gate',
      description:
        'A pathway that crosses into an area where proof of payment is required',
    },
    {
      value: 7,
      label: 'Exit gate',
      description:
        'A pathway that exits from an area where proof of payment is required',
    },
  ],

  is_bidirectional: [
    {
      value: 0,
      label: 'One-way',
      description: 'Pathway can only be used from from_stop_id to to_stop_id',
    },
    {
      value: 1,
      label: 'Bidirectional',
      description: 'Pathway can be used in both directions',
    },
  ],

  // attributions.txt
  is_producer: [
    { value: 0, label: 'Not producer' },
    {
      value: 1,
      label: 'Producer',
      description: 'Organization produced the data',
    },
  ],

  is_operator: [
    { value: 0, label: 'Not operator' },
    {
      value: 1,
      label: 'Operator',
      description: 'Organization operates the services',
    },
  ],

  is_authority: [
    { value: 0, label: 'Not authority' },
    {
      value: 1,
      label: 'Authority',
      description: 'Organization is the authority for the data',
    },
  ],

  // booking_rules.txt
  booking_type: [
    {
      value: 0,
      label: 'Real-time booking',
      description: 'Service can be booked in real-time',
    },
    {
      value: 1,
      label: 'Up to same-day booking',
      description: 'Service can be booked up to same-day with advance notice',
    },
    {
      value: 2,
      label: 'Up to prior-day(s) booking',
      description: 'Service requires booking prior day(s) in advance',
    },
  ],

  // calendar.txt (day of week fields)
  monday: [
    { value: 0, label: 'Not available' },
    { value: 1, label: 'Available' },
  ],

  tuesday: [
    { value: 0, label: 'Not available' },
    { value: 1, label: 'Available' },
  ],

  wednesday: [
    { value: 0, label: 'Not available' },
    { value: 1, label: 'Available' },
  ],

  thursday: [
    { value: 0, label: 'Not available' },
    { value: 1, label: 'Available' },
  ],

  friday: [
    { value: 0, label: 'Not available' },
    { value: 1, label: 'Available' },
  ],

  saturday: [
    { value: 0, label: 'Not available' },
    { value: 1, label: 'Available' },
  ],

  sunday: [
    { value: 0, label: 'Not available' },
    { value: 1, label: 'Available' },
  ],
};

/**
 * Get enum options for a specific field name
 */
export function getEnumOptions(
  fieldName: string
): GTFSEnumOption[] | undefined {
  return GTFS_ENUMS[fieldName];
}

/**
 * Check if a field is an enum field
 */
export function isEnumField(fieldName: string): boolean {
  return fieldName in GTFS_ENUMS;
}

/**
 * Get the label for a specific enum value
 */
export function getEnumLabel(
  fieldName: string,
  value: number | string
): string {
  const options = getEnumOptions(fieldName);
  if (!options) {
    return String(value);
  }

  const option = options.find((opt) => opt.value === value);
  return option ? option.label : String(value);
}
