/**
 * GTFS Entity Type Definitions
 *
 * Strongly-typed interfaces generated from Zod schemas for database storage.
 * Each interface extends the corresponding Zod schema type and uses natural
 * GTFS primary keys as defined in the GTFS specification.
 */

import { z } from 'zod';
import {
  AgencySchema,
  StopsSchema,
  RoutesSchema,
  TripsSchema,
  StopTimesSchema,
  CalendarSchema,
  CalendarDatesSchema,
  FareAttributesSchema,
  FareRulesSchema,
  TimeframesSchema,
  RiderCategoriesSchema,
  FareMediaSchema,
  FareProductsSchema,
  FareLegRulesSchema,
  FareLegJoinRulesSchema,
  FareTransferRulesSchema,
  AreasSchema,
  StopAreasSchema,
  NetworksSchema,
  RouteNetworksSchema,
  ShapesSchema,
  FrequenciesSchema,
  TransfersSchema,
  PathwaysSchema,
  LevelsSchema,
  LocationGroupsSchema,
  LocationGroupStopsSchema,
  BookingRulesSchema,
  TranslationsSchema,
  FeedInfoSchema,
  AttributionsSchema,
} from './gtfs.js';

// Core GTFS entities (required files)

/**
 * Agency - Transit agency information
 * Primary key: agencyId
 */
export interface Agency extends z.infer<typeof AgencySchema> {}

/**
 * Stops - Transit stops and stations
 * Primary key: stopId
 */
export interface Stops extends z.infer<typeof StopsSchema> {}

/**
 * Routes - Transit routes
 * Primary key: routeId
 */
export interface Routes extends z.infer<typeof RoutesSchema> {}

/**
 * Trips - Individual vehicle trips
 * Primary key: tripId
 */
export interface Trips extends z.infer<typeof TripsSchema> {}

/**
 * StopTimes - Stop times for trips
 * Composite primary key: tripId + stopSequence
 */
export interface StopTimes extends z.infer<typeof StopTimesSchema> {}

/**
 * Calendar - Service calendar dates
 * Primary key: serviceId
 */
export interface Calendar extends z.infer<typeof CalendarSchema> {}

/**
 * CalendarDates - Service calendar date exceptions
 * Composite primary key: serviceId + date
 */
export interface CalendarDates extends z.infer<typeof CalendarDatesSchema> {}

// Optional GTFS entities

/**
 * FareAttributes - Fare information
 * Primary key: fareId
 */
export interface FareAttributes extends z.infer<typeof FareAttributesSchema> {}

/**
 * FareRules - Fare rules
 * Primary key: fareId
 */
export interface FareRules extends z.infer<typeof FareRulesSchema> {}

/**
 * Timeframes - Extended GTFS timeframes
 * Composite primary key: all provided fields
 */
export interface Timeframes extends z.infer<typeof TimeframesSchema> {}

/**
 * RiderCategories - Extended GTFS rider categories
 * Primary key: riderCategoryId
 */
export interface RiderCategories extends z.infer<typeof RiderCategoriesSchema> {}

/**
 * FareMedia - Extended GTFS fare media
 * Primary key: fareMediaId
 */
export interface FareMedia extends z.infer<typeof FareMediaSchema> {}

/**
 * FareProducts - Extended GTFS fare products
 * Composite primary key: fareProductId + riderCategoryId + fareMediaId
 */
export interface FareProducts extends z.infer<typeof FareProductsSchema> {}

/**
 * FareLegRules - Extended GTFS fare leg rules
 * Composite primary key: networkId + fromAreaId + toAreaId + fromTimeframeGroupId + toTimeframeGroupId + fareProductId
 */
export interface FareLegRules extends z.infer<typeof FareLegRulesSchema> {}

/**
 * FareLegJoinRules - Extended GTFS fare leg join rules
 * Composite primary key: fromNetworkId + toNetworkId + fromStopId + toStopId
 */
export interface FareLegJoinRules extends z.infer<typeof FareLegJoinRulesSchema> {}

/**
 * FareTransferRules - Extended GTFS fare transfer rules
 * Primary key: TBD (requires investigation)
 */
export interface FareTransferRules extends z.infer<typeof FareTransferRulesSchema> {}

/**
 * Areas - Extended GTFS areas
 * Primary key: areaId (likely)
 */
export interface Areas extends z.infer<typeof AreasSchema> {}

/**
 * StopAreas - Extended GTFS stop areas
 * Composite primary key: areaId + stopId (likely)
 */
export interface StopAreas extends z.infer<typeof StopAreasSchema> {}

/**
 * Networks - Extended GTFS networks
 * Primary key: networkId (likely)
 */
export interface Networks extends z.infer<typeof NetworksSchema> {}

/**
 * RouteNetworks - Extended GTFS route networks
 * Composite primary key: networkId + routeId (likely)
 */
export interface RouteNetworks extends z.infer<typeof RouteNetworksSchema> {}

/**
 * Shapes - Route shape data
 * Primary key: shapeId
 */
export interface Shapes extends z.infer<typeof ShapesSchema> {}

/**
 * Frequencies - Headway-based service
 * Primary key: tripId
 */
export interface Frequencies extends z.infer<typeof FrequenciesSchema> {}

/**
 * Transfers - Transfer rules between stops
 * Primary key: fromStopId
 */
export interface Transfers extends z.infer<typeof TransfersSchema> {}

/**
 * Pathways - Pathways between locations
 * Primary key: pathwayId
 */
export interface Pathways extends z.infer<typeof PathwaysSchema> {}

/**
 * Levels - Location levels
 * Primary key: levelId
 */
export interface Levels extends z.infer<typeof LevelsSchema> {}

/**
 * LocationGroups - Extended GTFS location groups
 * Primary key: locationGroupId (likely)
 */
export interface LocationGroups extends z.infer<typeof LocationGroupsSchema> {}

/**
 * LocationGroupStops - Extended GTFS location group stops
 * Composite primary key: locationGroupId + stopId (likely)
 */
export interface LocationGroupStops extends z.infer<typeof LocationGroupStopsSchema> {}

/**
 * BookingRules - Extended GTFS booking rules
 * Primary key: bookingRuleId (likely)
 */
export interface BookingRules extends z.infer<typeof BookingRulesSchema> {}

/**
 * Translations - GTFS translations
 * Composite primary key: tableName + fieldName + language + recordId
 */
export interface Translations extends z.infer<typeof TranslationsSchema> {}

/**
 * FeedInfo - GTFS feed information
 * No primary key (single record file)
 */
export interface FeedInfo extends z.infer<typeof FeedInfoSchema> {}

/**
 * Attributions - Data attributions
 * Primary key: attributionId
 */
export interface Attributions extends z.infer<typeof AttributionsSchema> {}

// Primary key type aliases for GTFS entities
export type AgencyId = string;
export type StopId = string;
export type RouteId = string;
export type TripId = string;
export type ServiceId = string;
export type FareId = string;
export type ShapeId = string;
export type PathwayId = string;
export type LevelId = string;
export type AttributionId = string;
export type RiderCategoryId = string;
export type FareMediaId = string;
export type FareProductId = string;

// Composite key type aliases (using compound string format: "key1:key2")
export type StopTimesKey = string; // Format: "tripId:stopSequence"
export type CalendarDatesKey = string; // Format: "serviceId:date"
export type TranslationsKey = string; // Format: "tableName:fieldName:language:recordId"

// Union type for all GTFS entities
export type GTFSEntity =
  | Agency
  | Stops
  | Routes
  | Trips
  | StopTimes
  | Calendar
  | CalendarDates
  | FareAttributes
  | FareRules
  | Timeframes
  | RiderCategories
  | FareMedia
  | FareProducts
  | FareLegRules
  | FareLegJoinRules
  | FareTransferRules
  | Areas
  | StopAreas
  | Networks
  | RouteNetworks
  | Shapes
  | Frequencies
  | Transfers
  | Pathways
  | Levels
  | LocationGroups
  | LocationGroupStops
  | BookingRules
  | Translations
  | FeedInfo
  | Attributions;

// Project metadata for GTFS.zone application
export interface ProjectMetadata {
  id?: number;
  name: string;
  createdAt: string;
  lastModified: string;
  fileCount: number;
}

// Table name to entity type mapping for type safety
export type GTFSTableMap = {
  'agencies': Agency;
  'stops': Stops;
  'routes': Routes;
  'trips': Trips;
  'stop_times': StopTimes;
  'calendar': Calendar;
  'calendar_dates': CalendarDates;
  'fare_attributes': FareAttributes;
  'fare_rules': FareRules;
  'timeframes': Timeframes;
  'rider_categories': RiderCategories;
  'fare_media': FareMedia;
  'fare_products': FareProducts;
  'fare_leg_rules': FareLegRules;
  'fare_leg_join_rules': FareLegJoinRules;
  'fare_transfer_rules': FareTransferRules;
  'areas': Areas;
  'stop_areas': StopAreas;
  'networks': Networks;
  'route_networks': RouteNetworks;
  'shapes': Shapes;
  'frequencies': Frequencies;
  'transfers': Transfers;
  'pathways': Pathways;
  'levels': Levels;
  'location_groups': LocationGroups;
  'location_group_stops': LocationGroupStops;
  'booking_rules': BookingRules;
  'translations': Translations;
  'feed_info': FeedInfo;
  'attributions': Attributions;
  'project': ProjectMetadata;
};