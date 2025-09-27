# GTFS Type Alignment Plan

## Overview
Fix remaining ESLint errors in `schedule-controller.ts` by removing `as any` casts and aligning object property access with the official GTFS specification. This will improve type safety and code maintainability.

## Current Issues
- 34 remaining `as any` type casts in schedule-controller.ts
- Objects being accessed with non-standard property names (`.id`, `.name`) instead of GTFS spec properties
- Type mismatches between expected GTFS entities and actual data structures

## Root Cause Analysis
The code appears to be using transformed/simplified data objects with properties like:
- `.id` instead of GTFS-standard `trip_id`, `stop_id`, `route_id`
- `.name` instead of GTFS-standard `stop_name`, `route_short_name`, `route_long_name`
- `.headsign` instead of GTFS-standard `trip_headsign`

## GTFS Specification Reference
According to the [GTFS specification](https://gtfs.org/documentation/schedule/reference/):

### Trips (trips.txt)
- `trip_id` (required): Unique identifier for a trip
- `trip_headsign` (optional): Text that appears on signage identifying the trip's destination
- `direction_id` (optional): Indicates the direction of travel for a trip
- `service_id` (required): Identifies a set of dates when service is available

### Stops (stops.txt)
- `stop_id` (required): Unique identifier for a stop, station, or station entrance
- `stop_name` (required): Name of the location
- `stop_sequence` (required in stop_times.txt): Order of stops for a particular trip

### Routes (routes.txt)
- `route_id` (required): Unique identifier for a route
- `route_short_name` (conditionally required): Short name of a route
- `route_long_name` (conditionally required): Full name of a route

### Stop Times (stop_times.txt)
- `trip_id` (required): References trips.trip_id
- `stop_id` (required): References stops.stop_id
- `stop_sequence` (required): Order of stops for a particular trip
- `arrival_time` (conditionally required): Arrival time at the stop
- `departure_time` (conditionally required): Departure time from the stop

## Implementation Plan

### Phase 1: Data Structure Analysis ✅ TODO
- [ ] Examine the data transformation pipeline to understand where `.id` and `.name` properties are created
- [ ] Identify the source of the object transformation (likely in gtfs-relationships.ts or data processing modules)
- [ ] Document the current data flow: GTFS raw data → transformed objects → schedule controller

### Phase 2: Type Interface Updates ✅ TODO
- [ ] Create proper TypeScript interfaces for transformed objects if they're intentionally different from raw GTFS
- [ ] Update GTFSParserInterface and related interfaces to use correct GTFS property names
- [ ] Ensure type consistency between data producers and consumers

### Phase 3: Property Access Alignment ✅ TODO
Fix property access patterns to match GTFS specification:

#### Trip Objects
- [ ] Replace `(trip as any).id` with `trip.trip_id`
- [ ] Replace `(trip as any).headsign` with `trip.trip_headsign`
- [ ] Replace `(trip as any).service_id` with `trip.service_id`
- [ ] Replace `(trip as any).direction_id` with `trip.direction_id`

#### Stop Objects
- [ ] Replace `(stop as any).id` with `stop.stop_id`
- [ ] Replace `(stop as any).name` with `stop.stop_name`

#### Route Objects
- [ ] Replace `(route as any).route_id` with `route.route_id`
- [ ] Replace `(route as any).route_short_name` with `route.route_short_name`
- [ ] Replace `(route as any).route_long_name` with `route.route_long_name`

#### StopTime Objects
- [ ] Replace `(st as any).stop_id` with `st.stop_id`
- [ ] Replace `(st as any).arrival_time` with `st.arrival_time`
- [ ] Replace `(st as any).departure_time` with `st.departure_time`
- [ ] Replace `(st as any).stop_sequence` with `st.stop_sequence`

### Phase 4: Data Provider Investigation ✅ TODO
- [ ] Check `gtfs-relationships.ts` for object transformation logic
- [ ] Verify `getStopTimesForTrip()` returns proper GTFS StopTimes objects
- [ ] Ensure `getTripsForRoute()` returns proper GTFS Trips objects
- [ ] Update data transformation methods if needed to preserve GTFS property names

### Phase 5: Testing & Validation ✅ TODO
- [ ] Run TypeScript compiler to catch type errors
- [ ] Test schedule controller functionality with sample GTFS data
- [ ] Verify timetable rendering still works correctly
- [ ] Run full test suite to ensure no regressions
- [ ] Test with multiple GTFS feeds to ensure compatibility

### Phase 6: Code Quality ✅ TODO
- [ ] Remove all `as any` casts from schedule-controller.ts
- [ ] Add proper type annotations where needed
- [ ] Update JSDoc comments to reflect GTFS property names
- [ ] Run ESLint to verify all type errors are resolved

## Guidelines & Best Practices

### Type Safety Principles
1. **No `as any` casts**: Use proper TypeScript types that match GTFS specification
2. **Explicit typing**: Prefer explicit type annotations over inference where it improves clarity
3. **GTFS compliance**: Always use official GTFS property names as defined in the specification
4. **Interface consistency**: Ensure interfaces match actual data structures

### Property Naming Standards
1. **Follow GTFS spec exactly**: Use `trip_id`, not `id`; `stop_name`, not `name`
2. **Maintain consistency**: Same property names throughout the codebase
3. **No shortcuts**: Avoid abbreviated or simplified property names that deviate from GTFS

### Data Transformation Guidelines
1. **Preserve GTFS structure**: Avoid transforming GTFS objects to simplified formats
2. **Type-safe transformations**: If transformation is necessary, use proper TypeScript types
3. **Document deviations**: Any deviation from GTFS spec should be clearly documented

### Error Handling
1. **Fail fast**: If GTFS properties are missing, throw descriptive errors immediately
2. **Type guards**: Use TypeScript type guards to validate object structure
3. **Runtime validation**: Consider using Zod schemas for runtime type checking

## Risk Assessment

### Low Risk Changes
- Property name updates (`id` → `trip_id`, `name` → `stop_name`)
- Adding proper type annotations
- Removing unnecessary type casts

### Medium Risk Changes
- Updating data transformation logic
- Changing interface definitions
- Modifying object creation patterns

### High Risk Changes
- Major architectural changes to data flow
- Breaking changes to public APIs
- Changing database schema or data storage format

## Success Criteria
- [ ] All ESLint errors resolved in schedule-controller.ts
- [ ] No `as any` casts remaining in the file
- [ ] Full TypeScript compilation without errors
- [ ] All existing functionality preserved
- [ ] Schedule/timetable rendering works correctly
- [ ] Test suite passes completely

## Rollback Plan
If issues arise during implementation:
1. Use git to revert to the current working state
2. Implement changes incrementally with smaller commits
3. Test each change individually before proceeding
4. Consider adding feature flags for experimental changes

## Notes
- This plan aligns with the project's "FAIL HARD - NO FALLBACKS" policy by removing type workarounds
- Changes will improve code maintainability and catch type-related bugs at compile time
- Following GTFS specification exactly will improve compatibility with external GTFS tools and validators