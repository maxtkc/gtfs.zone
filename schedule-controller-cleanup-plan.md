# Schedule Controller Cleanup Plan

## Current Issues Identified

The `schedule-controller.ts` file is 2,152 lines long and has too many responsibilities. It needs to be broken down into focused, maintainable modules.

### Main Problems
- **Single Responsibility Violation**: Handles rendering, data processing, database operations, and UI interaction
- **Large Methods**: Some methods are 100+ lines long
- **Mixed Concerns**: Time formatting, HTML generation, database updates, and UI state all in one class
- **Tight Coupling**: Hard to test individual components
- **Code Duplication**: Similar time formatting logic repeated
- **Dead Code**: Several TODO methods and unused functionality
- **Custom Validation**: Should rely on GTFS Zod schemas instead of custom validation

## Proposed Module Structure

### 1. **TimeFormatter** (utils/time-formatter.ts)
- `formatTime(time: string): string`
- `formatTimeWithSeconds(time: string): string`
- `castTimeToHHMMSS(timeInput: string): string`
- `addMinutesToTime(timeString: string, minutes: number): string`
- Time utilities only - no validation

### 2. **TimetableDataProcessor** (modules/timetable-data-processor.ts)
- `generateTimetableData(route_id, service_id, direction_id)`
- `alignTripsWithSCS(trips, scsHelper)`
- `getAvailableDirections(route_id, service_id)`
- Data transformation and alignment logic
- Uses GTFS Zod schemas for validation

### 3. **TimetableRenderer** (modules/timetable-renderer.ts)
- `renderTimetableHTML(data: TimetableData)`
- `renderScheduleHeader(route, service)`
- `renderDirectionTabs(data)`
- `renderTimetableContent(data)`
- All HTML generation methods

### 4. **TimetableCellRenderer** (modules/timetable-cell-renderer.ts)
- `renderStackedArrivalDepartureCell(...)`
- `renderEditableTimeCell(...)`
- `createLinkedInput(...)`
- `createUnlinkedInputs(...)`
- Cell-specific rendering logic

### 5. **TimetableDatabase** (modules/timetable-database.ts)
- `updateStopTimeInDatabase(...)`
- `getCurrentTime(trip_id, stop_id)`
- `getCurrentArrivalTime(trip_id, stop_id)`
- `getCurrentDepartureTime(trip_id, stop_id)`
- Database interaction methods
- Uses GTFS standard property names

### 6. **ScheduleController** (modules/schedule-controller.ts) - Refactored
- Main orchestrator class
- Coordinates between modules
- Public API methods only
- Minimal logic - delegates to specialized modules
- Simple time editing methods without keyboard handling

## Cleanup Checklist

### Phase 1: Extract Time Utilities
- [ ] Create `TimeFormatter` utility class
- [ ] Move all time formatting methods from ScheduleController
- [ ] Update imports and method calls throughout codebase
- [ ] Remove time formatting from main controller

### Phase 2: Extract Data Processing
- [ ] Create `TimetableDataProcessor` module
- [ ] Move `generateTimetableData` method
- [ ] Move `alignTripsWithSCS` method
- [ ] Move direction-related methods
- [ ] Replace custom validation with GTFS Zod schemas
- [ ] Use GTFS standard property names consistently

### Phase 3: Extract Rendering
- [ ] Create `TimetableRenderer` module
- [ ] Move main HTML rendering methods
- [ ] Create `TimetableCellRenderer` module
- [ ] Move cell-specific rendering methods
- [ ] Ensure all GTFS properties use standard names

### Phase 4: Extract Database Operations
- [ ] Create `TimetableDatabase` module
- [ ] Move all database interaction methods
- [ ] Follow "FAIL HARD" error handling policy
- [ ] Use GTFS standard property names in all operations

### Phase 5: Refactor Main Controller
- [ ] Remove extracted methods from ScheduleController
- [ ] Add module dependencies via constructor injection
- [ ] Update public API methods to delegate to modules
- [ ] Keep only orchestration logic
- [ ] Remove keyboard handling methods

### Phase 6: Remove Dead Code & Custom Validation
- [ ] Remove TODO placeholder methods (`getNextStop`, `getPrevStop`, etc.)
- [ ] Remove custom Zod schemas (use generated GTFS schemas instead)
- [ ] Remove keyboard navigation methods
- [ ] Remove unused interfaces and types
- [ ] Remove commented-out code
- [ ] Clean up imports

### Phase 7: Improve Code Quality
- [ ] Add JSDoc comments to all public methods
- [ ] Ensure consistent error handling patterns (FAIL HARD)
- [ ] Add proper TypeScript types for all parameters
- [ ] Follow GTFS Key Handling Guidelines from CLAUDE.md
- [ ] Verify all modules use GTFS standard property names

### Phase 8: Final Cleanup
- [ ] Run `npm run lint` and fix any issues
- [ ] Run `npm run typecheck` and fix any issues
- [ ] Clean up unused imports across all modules
- [ ] Verify module boundaries are respected

## Implementation Principles

### Code Standards
1. **Single Responsibility**: Each module has one clear purpose
2. **Dependency Injection**: Pass dependencies through constructors
3. **Pure Functions**: Prefer pure functions where possible
4. **Error Handling**: Follow "FAIL HARD" policy from CLAUDE.md - no fallbacks
5. **Type Safety**: Use strict TypeScript types
6. **GTFS Compliance**: Use GTFS standard property names exclusively
7. **Schema Validation**: Rely on generated GTFS Zod schemas, not custom validation

### File Structure
```
src/modules/
├── schedule-controller.ts (refactored, ~200 lines)
├── timetable-data-processor.ts (~400 lines)
├── timetable-renderer.ts (~500 lines)
├── timetable-cell-renderer.ts (~400 lines)
└── timetable-database.ts (~300 lines)

src/utils/
└── time-formatter.ts (~100 lines)
```

### Dependencies
- Each module should have minimal, explicit dependencies
- Use interfaces for dependencies when needed
- Avoid circular dependencies between modules
- Keep utilities independent of business logic
- Always use GTFS standard property names (stop_id, route_id, etc.)

## Expected Benefits

1. **Maintainability**: Smaller, focused modules are easier to understand and modify
2. **Reliability**: FAIL HARD policy ensures problems are caught early
3. **Reusability**: Time formatting can be reused elsewhere
4. **Performance**: Smaller modules may improve bundling and loading
5. **Code Quality**: Better separation of concerns and cleaner interfaces
6. **GTFS Compliance**: Consistent use of standard property names

## Implementation Notes

### Testing Strategy
- **Manual Testing Required**: After each phase, manually test schedule functionality
- **No Automated Tests**: Focus on working functionality, not test coverage
- **Browser Testing**: Verify time editing, direction switching, and data loading
- **Error Testing**: Ensure FAIL HARD policy works correctly

### GTFS Schema Integration
- **Remove Custom Schemas**: Delete TimeValidationSchema, ServiceDateSchema, etc.
- **Use Generated Schemas**: Import from existing GTFS type generation system
- **Standard Property Names**: Ensure stop_id, route_id, trip_id consistency
- **Enhanced Objects**: Maintain compatibility with Enhanced GTFS Object pattern

## Timeline Estimate

- **Phase 1**: 1-2 hours (time utilities extraction)
- **Phase 2**: 3-4 hours (data processing with GTFS schema integration)
- **Phase 3**: 3-4 hours (rendering modules)
- **Phase 4**: 2-3 hours (database operations)
- **Phase 5**: 2-3 hours (main controller refactor)
- **Phase 6**: 2-3 hours (dead code removal)
- **Phase 7-8**: 2-3 hours (quality improvements and final cleanup)

**Total Estimated Time**: 15-22 hours

This plan will transform a monolithic 2,152-line file into 6 focused, maintainable modules while preserving all existing functionality, improving code quality, and ensuring proper GTFS compliance.