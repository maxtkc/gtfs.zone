# GTFS Generated Types Migration Plan

## Overview

Replace custom GTFS type definitions with auto-generated types from the official GTFS specification to improve type safety, reduce code duplication, and stay synchronized with the official spec.

## Migration Checklist

### Phase 1: Database Layer Updates

- [x] **Update `src/modules/gtfs-database.ts`**
  - [x] Remove custom `GTFSRecord` interface (lines 6-9)
  - [x] Import `GTFS_FILES` from `../types/gtfs`
  - [x] Renamed to `GTFSDatabaseRecord` to avoid conflicts with generated union type
  - [x] Updated `database-fallback-manager.ts` imports
  - [x] Database operations confirmed working

### Phase 2: Parser Layer Updates

- [x] **Update `src/modules/gtfs-parser.ts`**
  - [x] Remove hardcoded `GTFS_FILES` constant (lines 7-26)
  - [x] Import `GTFS_FILES` and `GTFSFilePresence` from `../types/gtfs`
  - [x] Update `GTFSFileData` interface to use `GTFSDatabaseRecord[]`
  - [x] Updated `categorizeFiles()` method to use generated file metadata
  - [x] File categorization now uses `GTFSFilePresence.Required/Optional/ConditionallyRequired`
  - [x] Parser operations confirmed working with new structure

### Phase 3: Type-Safe Components

- [x] **Update `src/modules/schedule-controller.ts`**
  - [x] Replace `Record<string, unknown>` with proper GTFS types:
    - [x] `route: Routes` (line 16)
    - [x] `service: Calendar | CalendarDates` (line 17)
    - [x] `stops: Stops[]` (line 18)
  - [x] Import proper GTFS types: `Routes, Stops, Calendar, CalendarDates, Trips`
  - [x] Update method signatures to use generated types:
    - [x] `alignTrips(trips: Trips[])`
    - [x] `getSortedStops(): Stops[]`
    - [x] `renderScheduleHeader(route: Routes, service: Calendar | CalendarDates)`
    - [x] `renderTimetableBody(stops: Stops[], trips: AlignedTrip[])`
    - [x] `getRoutesUsingService(): Routes[]`
  - [x] Improved type safety across schedule controller methods

- [ ] **Review other modules for similar improvements**
  - [ ] `src/modules/gtfs-validator.ts` - use proper types
  - [ ] `src/modules/gtfs-relationships.ts` - verify compatibility
  - [ ] `src/modules/map-controller.ts` - use typed stop/route data

### Phase 4: Remove Redundant Code

- [ ] **Evaluate `src/utils/gtfs-metadata.ts` for removal**
  - [ ] Find all imports of gtfs-metadata functions
  - [ ] Replace with direct imports from `../types/gtfs`:
    - `getFieldDescription()`
    - `getAllFieldDescriptions()`
    - `getFileSchema()`
    - `GTFS_FILES`
  - [ ] Move any UI-specific helper functions to appropriate modules
  - [ ] Delete `src/utils/gtfs-metadata.ts` once unused

### Phase 5: Enhanced Type Safety

- [ ] **Leverage Zod schemas for runtime validation**
  - [ ] Update CSV parsing to use `GTFSSchemas` for validation
  - [ ] Add proper error handling for schema validation
  - [ ] Use generated field descriptions in error messages

- [ ] **Update import/export to use proper types**
  - [ ] Ensure ZIP export preserves type information
  - [ ] Add type validation during file import
  - [ ] Use foreign key relationships for data integrity

### Phase 6: Testing & Verification

- [ ] **Run test suite**
  - [ ] `npm test` - ensure all Playwright tests pass
  - [ ] Test file upload with various GTFS feeds
  - [ ] Test map visualization with typed data
  - [ ] Test schedule/timetable generation

- [ ] **Manual testing checklist**
  - [ ] Upload GTFS ZIP file via drag-and-drop
  - [ ] Upload GTFS ZIP file via button
  - [ ] Load GTFS from URL parameter
  - [ ] Edit files and verify type validation
  - [ ] Export modified GTFS
  - [ ] Check that all UI components display correctly

### Phase 7: Code Quality

- [ ] **Run linting and type checking**
  - [ ] `npm run lint` - fix any linting issues
  - [ ] `npm run typecheck` - resolve type errors
  - [ ] `npm run format` - ensure consistent formatting

- [ ] **Update documentation**
  - [ ] Update CLAUDE.md with new type usage patterns
  - [ ] Add comments explaining generated type usage
  - [ ] Document any breaking changes for future developers

## Implementation Notes

### Import Pattern Changes

```typescript
// OLD
import { getDescription, getFileSchema } from '../utils/gtfs-metadata';

// NEW
import { getFieldDescription, getFileSchema } from '../types/gtfs';
```

### Type Usage Examples

```typescript
// OLD
const route: Record<string, unknown> = routeData;

// NEW
const route: Routes = routeData;
```

### Schema Validation

```typescript
// NEW - leverage Zod schemas
const schema = GTFSSchemas['routes.txt'];
const validatedRoute = schema.parse(routeData);
```

## Benefits After Migration

- [ ] **Type Safety**: Compile-time checking for GTFS field access
- [ ] **Auto-completion**: Better IDE support for GTFS fields
- [ ] **Spec Compliance**: Always up-to-date with official GTFS spec
- [ ] **Reduced Code**: Less custom type definitions to maintain
- [ ] **Better Validation**: Runtime validation with descriptive error messages
- [ ] **Documentation**: Field descriptions available at runtime

## Rollback Plan

If issues arise during migration:

1. Revert specific file changes using git
2. Keep both old and new imports temporarily during transition
3. Use feature flags if needed for gradual rollout
4. Maintain backwards compatibility during transition period

## Success Criteria

- [ ] All tests pass
- [ ] No TypeScript compilation errors
- [ ] All GTFS functionality works as before
- [ ] Improved type safety and developer experience
- [ ] Reduced lines of custom type definition code
- [ ] Better error messages for invalid GTFS data

