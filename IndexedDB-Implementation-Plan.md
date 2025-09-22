# IndexedDB Row-Level Storage Implementation Plan

## Overview
Implement IndexedDB storage where each GTFS file becomes a table, and each CSV row becomes a database record. This enables persistent storage for 30MB+ files with real-time editing capabilities.

## Database Schema (Single GTFS File Storage)

### Core Principles
- [ ] One table per GTFS file type (`agencies`, `routes`, `stops`, `trips`, `stop_times`, `calendar`, etc.)
- [ ] Each CSV row stored as individual record with auto-increment primary key
- [ ] Current project metadata stored in single `project` table
- [ ] Clear entire database when loading new GTFS file (single file state)

## Phase 1: Setup & Dependencies

- [ ] Install `idb` package for IndexedDB wrapper
- [ ] Create `GTFSDatabase` class in new file `src/modules/gtfs-database.ts`
- [ ] Define TypeScript interfaces for database schema
- [ ] Implement database initialization and table creation

## Phase 2: Database Layer Implementation

### GTFSDatabase Class
- [ ] `initialize()` - Open database connection and create tables
- [ ] `clearDatabase()` - Wipe all data when loading new GTFS file
- [ ] `createTablesFromGTFS(fileNames)` - Dynamic table creation based on uploaded files
- [ ] `insertRows(tableName, rows)` - Bulk insert CSV rows as records
- [ ] `getRow(tableName, id)` - Retrieve single record
- [ ] `updateRow(tableName, id, data)` - Update single record with debouncing
- [ ] `getAllRows(tableName)` - Get all records from table (for export)
- [ ] `queryRows(tableName, filter)` - Filtered queries for search/navigation

## Phase 3: GTFSParser Integration

### Modify GTFSParser Class
- [ ] Add `gtfsDatabase` instance property
- [ ] Update `parseFile()` to store rows in IndexedDB instead of memory
- [ ] Update `initializeEmpty()` to populate IndexedDB with sample data
- [ ] Modify `updateFileContent()` to parse and update affected rows
- [ ] Update `getFileData()` to read from IndexedDB instead of memory
- [ ] Update `exportAsZip()` to read all rows from IndexedDB and generate CSV

### Data Flow Changes
- [ ] Replace in-memory `gtfsData` object with IndexedDB queries
- [ ] Implement lazy loading for large tables
- [ ] Add loading states for async operations

## Phase 4: Editor Integration

### Table Editor (Clusterize.js Integration)
- [ ] Modify `buildTableEditor()` to load rows from IndexedDB
- [ ] Update `updateTableCell()` to write directly to IndexedDB with debouncing (500ms)
- [ ] Implement pagination/virtualization for large tables
- [ ] Add optimistic UI updates while database writes are pending

### Text Editor (CodeMirror Integration)
- [ ] Update `saveCurrentFileChanges()` to parse changes and update affected IndexedDB rows
- [ ] Implement conflict detection between text and table edits
- [ ] Add "unsaved changes" indicator during debounce period

## Phase 5: Objects Navigation Integration

### Update Objects Navigation
- [ ] Modify `GTFSRelationships` to query IndexedDB instead of in-memory arrays
- [ ] Update navigation methods to use async IndexedDB queries
- [ ] Implement efficient filtering and search using IndexedDB indexes
- [ ] Add loading states for navigation queries

### Search Controller Updates
- [ ] Update `searchStops()` and `searchRoutes()` to query IndexedDB directly
- [ ] Add database indexes for commonly searched fields
- [ ] Implement debounced search queries

## Phase 6: Performance Optimizations

### Database Optimization
- [ ] Add indexes on frequently queried fields (id fields, names, etc.)
- [ ] Implement connection pooling and transaction batching
- [ ] Add database compaction utilities
- [ ] Optimize bulk operations for large file imports

### UI/UX Improvements
- [ ] Add global loading indicator for database operations
- [ ] Implement "unsaved changes" warning before page unload
- [ ] Add auto-save status indicator
- [ ] Implement offline detection and graceful degradation

## Phase 7: Error Handling & Fallbacks

### Robustness
- [ ] Detect IndexedDB support and show warning for unsupported browsers
- [ ] Implement graceful fallback to in-memory storage if IndexedDB fails
- [ ] Add error recovery for corrupted database states
- [ ] Handle storage quota exceeded scenarios

### User Experience
- [ ] Add clear error messages for database issues
- [ ] Implement database reset/clear functionality
- [ ] Add data import/export for backup purposes
- [ ] Handle concurrent tab scenarios (warn about conflicts)

## Phase 8: Testing & Validation

### Testing Strategy
- [ ] Add unit tests for GTFSDatabase class
- [ ] Test large file imports (30MB+)
- [ ] Test rapid editing scenarios with debouncing
- [ ] Verify data consistency between text and table edits
- [ ] Test export functionality preserves exact data
- [ ] Performance testing with Lighthouse/browser tools

### Browser Testing
- [ ] Test across Chrome, Firefox, Safari, Edge
- [ ] Verify mobile browser compatibility
- [ ] Test private/incognito mode behavior
- [ ] Validate storage quota handling

## Technical Implementation Notes

### Debouncing Strategy
- Use 500ms debounce for individual cell edits
- Batch multiple rapid changes into single transaction
- Show visual feedback during pending writes

### Database Schema Example
```typescript
interface GTFSDatabase {
  agencies: Agency[]
  routes: Route[]
  stops: Stop[]
  trips: Trip[]
  stop_times: StopTime[]
  calendar: Calendar[]
  // ... other GTFS files as needed
  project: ProjectMetadata[]
}
```

### Error Handling Priorities
1. Storage quota exceeded → Suggest file size reduction
2. Database corruption → Offer reset with data loss warning
3. Concurrent access → Warn about potential conflicts
4. Browser compatibility → Graceful fallback to memory storage

## Success Criteria

- [ ] **Persistence**: Data survives browser restart/crash
- [ ] **Performance**: Handles 30MB+ files without UI blocking
- [ ] **Real-time**: Cell edits save within 500ms debounce window
- [ ] **Consistency**: Text and table edits stay synchronized
- [ ] **Export**: Generated files match original structure exactly
- [ ] **UX**: Clear loading states and error messages throughout