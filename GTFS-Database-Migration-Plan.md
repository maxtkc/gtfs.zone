# GTFS Database Migration Plan: JSON to Typed Columns

## Overview
Migrate from storing GTFS data as JSON objects (`GTFSDatabaseRecord`) to strongly-typed column schemas generated from existing Zod schemas. This will provide type safety, better query performance, and more efficient storage.

## Current State Analysis
- **Database**: IndexedDB with dynamic JSON object storage
- **Validation**: Existing Zod schemas in `src/types/gtfs.ts` (2311 lines, ~20+ schemas)
- **Type Safety**: Runtime validation only via Zod
- **Storage**: Generic `GTFSDatabaseRecord` interface with `[key: string]: any`

## Migration Strategy

### 1. Generate TypeScript Interfaces from Zod Schemas
**Target**: Create strongly-typed interfaces for each GTFS entity

```typescript
// New file: src/types/gtfs-entities.ts
export interface Agency extends z.infer<typeof AgencySchema> {
  id?: number; // Keep auto-increment primary key
}
export interface Routes extends z.infer<typeof RoutesSchema> {
  id?: number;
}
// ... for all 20+ GTFS entities
```

**Implementation**:
- Extract all schema names: `AgencySchema`, `RoutesSchema`, `StopsSchema`, etc.
- Generate interfaces using `z.infer<typeof SchemaName>`
- Preserve `id?: number` for IndexedDB auto-increment keys

### 2. Update Database Schema Interface
**Target**: Replace generic `GTFSDBSchema` with typed object stores

```typescript
// Update src/modules/gtfs-database.ts
export interface GTFSDBSchema extends DBSchema {
  agencies: {
    key: number;
    value: Agency;
  };
  routes: {
    key: number;
    value: Routes;
  };
  // ... for all GTFS entities
}
```

**Implementation**:
- Remove generic `GTFSDatabaseRecord` usage
- Update each object store definition with proper types
- Maintain existing index definitions (lines 242-344)

### 3. Update Database Class Methods
**Target**: Add type safety to all database operations

**Changes Required**:
- `insertRows<T>(tableName: string, rows: T[])` - Generic method with entity type
- `getAllRows<T>(tableName: string): T[]` - Type-safe retrieval
- `queryRows<T>(tableName: string, filter?)` - Typed filtering
- Update all CRUD operations to use specific entity types

**Implementation**:
- Replace `GTFSDatabaseRecord` with generic types
- Add type assertions for table name → entity type mapping
- Preserve existing batch processing and error handling

### 4. Update Parser Integration
**Target**: Type-safe data flow from CSV parsing to database storage

**Changes Required**:
- `gtfs-parser.ts`: Update `parseCSV()` to return typed entities
- Maintain Zod validation but cast to proper types
- Update data transformation utilities in `utils/gtfs-caster.ts`

### 5. Database Version Management
**Target**: Handle schema migration gracefully

**Implementation**:
```typescript
private readonly dbVersion = 2; // Increment version

upgrade: (db, oldVersion) => {
  if (oldVersion < 2) {
    // Clear existing data (assumption: reset on schema change)
    // Recreate all object stores with new typed schema
  }
}
```

### 6. Update Dependent Modules
**Target**: Propagate type safety throughout application

**Modules to Update**:
- `gtfs-validator.ts`: Update validation methods to use typed entities
- `map-controller.ts`: Type-safe map data handling
- `editor.ts`: Typed entity editing
- `search-controller.ts`: Type-safe search results
- `schedule-controller.ts`: Typed timetable operations

## Benefits After Migration
- **Compile-Time Safety**: TypeScript catches field name errors
- **Better Performance**: IndexedDB can optimize with known column types
- **Storage Efficiency**: Structured data vs. repeated JSON keys
- **IDE Support**: Auto-completion and type checking for all GTFS fields
- **Maintainability**: Clear interfaces for each GTFS entity type

## Implementation Checklist

### Phase 1: Type Generation (2-3 hours)
- [x] **Generate entity interfaces from existing Zod schemas in src/types/gtfs-entities.ts**
  - ✅ Created 29 strongly-typed interfaces extending Zod schemas
  - ✅ Added GTFSTableMap for type-safe table name mapping
  - ✅ Included auto-increment `id?: number` for all entities
  - ✅ Added ProjectMetadata interface for application metadata
- [x] **Create type-safe database schema interface in GTFSDBSchema**
  - ✅ Replaced GTFSDatabaseRecord with specific entity types in database schema
  - ✅ Updated all object store definitions with proper types (Agency, Routes, Stops, etc.)
  - ✅ Maintained backwards compatibility with GTFSDatabaseRecord for dynamic operations
- [x] **Update database class with generic methods (insertRows<T>, getAllRows<T>, queryRows<T>)**
  - ✅ Added generic method overloads for type-safe database operations
  - ✅ Maintained existing batch processing and error handling
  - ✅ Preserved backwards compatibility with legacy method signatures

**Phase 1 Status: ✅ COMPLETED**
- Type-safe interfaces generated from Zod schemas
- Database schema updated with typed entities
- Generic method signatures added for type safety
- Backwards compatibility maintained for existing code

### Phase 2: Database Migration (1-2 hours)
- [x] **Increment database version to 2 in gtfs-database.ts**
  - ✅ Updated dbVersion constant from 1 to 2
- [x] **Implement migration logic with upgrade handler (clear + recreate object stores)**
  - ✅ Added comprehensive upgrade handler that detects version 1 to 2 migration
  - ✅ Implemented graceful schema migration with existing object store cleanup
  - ✅ Clear existing data and recreate with new typed schema
  - ✅ Added logging for migration progress tracking
- [x] **Test database migration with sample GTFS data**
  - ✅ Verified migration works correctly in browser console
  - ✅ Confirmed successful database upgrade from version 1 to 2
  - ✅ Verified typed entity insertion and retrieval operations work properly
  - ✅ Tested with real GTFS data loading from URL (Columbia County GTFS)

**Phase 2 Status: ✅ COMPLETED**
- Database version successfully incremented to 2
- Migration logic handles schema changes gracefully
- Typed entity operations confirmed working
- Real GTFS data processing verified successful

### Phase 3: Module Updates (3-4 hours) - NEAR COMPLETION
- [x] **Update gtfs-parser.ts parseCSV() method to return typed entities**
  - ✅ Added typed entity interfaces import (GTFSTableMap, GTFSTableName)
  - ✅ Created generic GTFSFileData<T> interface for type safety
  - ✅ Added getTypedTableName() helper method for table name validation
  - ✅ Added parseCSVWithType<T>() generic method for type-safe parsing
  - ✅ Added getFileDataTyped<T>() and getFileDataSyncTyped<T>() methods
  - ✅ Updated all search methods to use typed entity retrieval
  - ✅ Updated getRoutesForStop methods to use typed entities
  - ✅ Maintained backward compatibility with existing GTFSDatabaseRecord methods
  - ✅ Added missing updateFileInMemory() and refreshRelatedTables() methods
- [x] **Update gtfs-validator.ts validation methods to use typed entities**
  - ✅ Added GTFSTableMap and GTFSTableName imports
  - ✅ Updated GTFSParserInterface to include getFileDataSyncTyped<T>() method
  - ✅ Updated all validation methods to use typed entity retrieval:
    - validateAgencies() - uses typed Agency entities
    - validateRoutes() - uses typed Routes entities
    - validateStops() - uses typed Stops entities
    - validateTrips() - uses typed Trips entities
    - validateStopTimes() - uses typed StopTimes entities
    - validateCalendar() - uses typed Calendar and CalendarDates entities
    - validateShapes() - uses typed Shapes entities
    - validateReferences() - uses typed entities for cross-validation
  - ✅ Removed explicit GTFSDatabaseRecord type annotations in favor of type inference
- [x] **Update map-controller.ts for type-safe map data handling**
  - ✅ Updated to use typed entities (Stops, Routes, Shapes, Trips, StopTimes)
  - ✅ Replaced GTFSDatabaseRecord usage with specific typed entities
  - ✅ Updated interface signatures to handle null return types properly
  - ✅ Added support for getFileDataSyncTyped<T>() method
- [x] **Update editor.ts for typed entity editing**
  - ✅ Updated interface definitions to include missing methods
  - ✅ Enhanced GTFSParser interface with proper method signatures
  - ✅ Maintained backward compatibility for entity editing operations
- [x] **Update search-controller.ts for type-safe search results**
  - ✅ Added TypeScript types and interfaces for type safety
  - ✅ Updated to use typed Routes and Stops entities
  - ✅ Implemented proper interface definitions for dependencies
  - ✅ Enhanced method signatures with return types
- [x] **Update schedule-controller.ts for typed timetable operations**
  - ✅ Updated imports to use gtfs-entities.js typed interfaces
  - ✅ Enhanced interface definitions for GTFSParser and GTFSRelationships
  - ✅ Updated timetable operations to use typed StopTimes, Trips, Routes entities
  - ✅ Fixed property name mappings (e.g., trip.id → trip.trip_id)
- [x] **Update data transformation utilities in utils/gtfs-caster.ts**
  - ✅ Updated import paths to use .js extensions
  - ✅ Added GTFSTableMap import for new type system
  - ✅ Added castToTypedEntity<T>() method for typed entity casting
  - ✅ Enhanced utility functions to work with typed entities
- [x] **Fix major TypeScript compilation errors throughout codebase**
  - ✅ SIGNIFICANT PROGRESS - Resolved major interface mismatches
  - ✅ Fixed GTFSParserInterface compatibility issues:
    - Added missing updateFileInMemory() and refreshRelatedTables() methods
    - Updated return type signatures to handle null properly
  - ✅ Fixed UIController interface issues:
    - Added missing showFileInEditor() method
  - ✅ Updated interface signatures to be compatible with actual implementations
  - ✅ Resolved property visibility and return type compatibility issues
- [ ] **Update tests to use typed entities instead of generic records**
  - ❌ IN PROGRESS - Test files still have import path errors and type issues

**Phase 3 Status: 🔄 PARTIAL COMPLETION**
- Core parsing and validation modules successfully migrated to typed entities
- Parser now provides type-safe data retrieval methods alongside backward-compatible methods
- Validator uses typed entities for all validation operations
- Remaining work: map-controller, editor, search-controller, schedule-controller, and resolution of interface compatibility issues

### Phase 4: Validation & Testing (1-2 hours)
- [ ] **Run existing Playwright test suite to verify functionality**
  - Ensure no regressions
- [ ] **Verify functionality with large GTFS files for performance**
  - Test performance with real-world data
- [ ] **Run performance benchmarking on IndexedDB with typed schemas**
  - Measure performance improvements
- [ ] **Validate no functional regressions in UI/UX functionality**
  - Manual testing of key features

### Success Criteria
- [ ] **Verify improved type safety throughout codebase**
  - All TypeScript compilation errors resolved
  - Better IDE support and auto-completion
  - Runtime type safety maintained

## Risk Mitigation
- **Data Loss**: Users will lose existing data (acceptable per requirements)
- **Breaking Changes**: All modules require updates simultaneously
- **Rollback**: Keep migration reversible via database version handling
- **Performance**: Monitor IndexedDB performance with typed schemas

## Success Criteria
- All TypeScript compilation errors resolved
- Existing test suite passes
- No functional regressions in UI/UX
- Improved type safety throughout codebase