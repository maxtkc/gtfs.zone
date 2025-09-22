# MLCS Trip Alignment Migration Plan

## Overview
Migrate from the current stop-time-based trip alignment algorithm to a Maximum Length Common Subsequence (MLCS) approach that orders stops based on unique trip orders, ignoring specific stop times.

## Current Implementation Analysis
- **Location**: `src/modules/schedule-controller.ts:157-181` (`alignTrips` method)
- **Current Approach**: Direct stop-time mapping with sequence-based sorting
- **Stop Ordering**: `getSortedStops` uses average sequence positions (`src/modules/schedule-controller.ts:186-221`)
- **Limitations**: Relies on stop_sequence numbers which may be inconsistent across trips

## Migration Tasks Checklist

### Phase 1: Research & Analysis
- [ ] Research MLCS algorithm implementation for JavaScript/TypeScript
- [ ] Analyze existing trip data structure and stop sequence patterns
- [ ] Document current alignment edge cases and test data
- [ ] Identify npm packages for MLCS implementation or create custom solution
- [ ] Create unit tests for current alignment behavior (baseline)

### Phase 2: MLCS Algorithm Implementation
- [ ] Implement MLCS algorithm utility function
- [ ] Create function to extract unique trip orders from stop_times data
- [ ] Build trip order comparison and alignment logic
- [ ] Add type definitions for MLCS-related data structures
- [ ] Create helper functions for stop order deduplication

### Phase 3: Core Migration
- [ ] Create new `alignTripsWithMLCS` method in ScheduleController
- [ ] Replace stop-time-based alignment with trip-order-based MLCS
- [ ] Update `getSortedStops` to use MLCS-determined order instead of sequence averages
- [ ] Modify `AlignedTrip` interface if needed for MLCS data
- [ ] Ensure backward compatibility during transition

### Phase 4: Integration & Testing
- [ ] Update existing Playwright tests to work with new alignment
- [ ] Add specific tests for MLCS edge cases (missing stops, partial routes)
- [ ] Test with various GTFS feeds (simple, complex, malformed)
- [ ] Performance testing with large datasets
- [ ] Visual verification of timetable rendering improvements

### Phase 5: Cleanup & Documentation
- [ ] Remove old alignment algorithm code
- [ ] Update CLAUDE.md with new algorithm description
- [ ] Add inline documentation for MLCS implementation
- [ ] Performance optimization if needed
- [ ] Code review and refactoring

### Phase 6: Validation
- [ ] Test with real-world GTFS feeds
- [ ] Compare output quality vs. old algorithm
- [ ] Verify edge cases handle gracefully
- [ ] User acceptance testing
- [ ] Performance benchmarking

## Technical Considerations

### MLCS Algorithm Requirements
- Input: Array of trip stop sequences (ordered lists of stop IDs)
- Output: Optimal stop ordering that maximizes common subsequences
- Handle partial trips and missing stops gracefully
- Maintain trip-specific gap information

### Data Structures
```typescript
interface TripOrder {
  tripId: string;
  stopSequence: string[]; // Ordered stop IDs
}

interface MLCSResult {
  optimizedStopOrder: string[];
  alignmentMatrix: Map<string, Map<string, boolean>>; // tripId -> stopId -> present
}
```

### Performance Goals
- Handle 100+ trips with 50+ stops efficiently
- Maintain sub-second rendering for typical GTFS routes
- Memory efficient for large datasets

### Backward Compatibility
- Ensure existing timetable rendering works unchanged
- Maintain same API for ScheduleController consumers
- Preserve breadcrumb and UI integration

## Success Criteria
- [ ] More accurate stop ordering for complex routes
- [ ] Better handling of trips with different stop patterns
- [ ] Maintained or improved performance
- [ ] All existing functionality preserved
- [ ] Comprehensive test coverage
- [ ] Clean, maintainable code

## Risk Mitigation
- Implement feature flag for algorithm switching during development
- Maintain old algorithm as fallback during testing
- Extensive testing with diverse GTFS feeds
- Performance monitoring during migration

## Dependencies
- Research MLCS algorithm libraries (if available)
- May need to implement custom MLCS algorithm
- Update test data to cover MLCS edge cases
- Ensure TypeScript types are properly defined