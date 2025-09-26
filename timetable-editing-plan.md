# Timetable Editing Implementation Plan

## Overview
This plan outlines the step-by-step implementation of editable timetables in GTFS.zone, including time modifications, service properties, trip management, and stop operations.

## Progress Tracking
**IMPORTANT**: Update the checkboxes in this file as we complete each task. This serves as our working document and progress tracker throughout the implementation.

## Current State Analysis
- [x] **Phase 0: Research Current Implementation** ✅ **COMPLETED**
  - [x] Analyze current schedule controller structure
  - [x] Review timetable rendering logic
  - [x] Identify data flow from database to UI
  - [x] Document current validation patterns
  - [x] Map existing event handlers and state management

### Phase 0 Analysis Summary:

**Schedule Controller Architecture:**
- `/src/modules/schedule-controller.ts` - Main timetable rendering class
- Renders HTML string output with timetable structure
- Uses `AlignedTrip` interface for trip data with `Map<stopId, time>`
- Implements SCS (Shortest Common Supersequence) algorithm for optimal stop ordering
- Currently READ-ONLY with no editing capabilities

**Data Flow:**
1. `PageContentRenderer` calls `scheduleController.renderSchedule()`
2. `ScheduleController.generateTimetableData()` gets route/service/trip data
3. `GTFSRelationships.getTripsForRoute()` & `getStopTimesForTrip()` fetch data
4. `GTFSParser.getFileDataSync()` retrieves data from IndexedDB via `GTFSDatabase`
5. HTML string returned and inserted into DOM via `ObjectsNavigation`

**Current Rendering Structure:**
- Header: Route name, service ID, service properties (dates, days)
- Table: Stops (rows) × Trips (columns) with time cells
- Time cells: `<span class="time-badge">` with formatted times
- No interactive elements or edit handlers

**Validation Patterns:**
- `GTFSValidator` class provides file-level validation
- Zod schemas used for data validation (imported types)
- No real-time validation during editing currently
- Time format validation exists but not used for editing

**Event Handling:**
- No event handlers in current schedule controller
- UI events handled in `UIController`, `ObjectsNavigation`, `Editor` modules
- Navigation events handled by `PageStateManager`
- Map interactions in `MapController`

## Phase 1: Foundation and Data Layer
- [x] **1.1: Enhance Data Models** ✅ **COMPLETED**
  - [x] Add edit state tracking to trip objects
  - [x] Implement dirty flag system for unsaved changes
  - [x] Create validation schemas for editable fields
  - [x] Add undo/redo state management for timetable operations

- [x] **1.2: Database Operations** ✅ **COMPLETED**
  - [x] Implement trip CRUD operations in GTFSDatabase
  - [x] Add stop_times bulk update methods
  - [x] Create service/calendar modification functions
  - [x] Add relationship integrity checks for modifications

## Phase 2: Time Editing Functionality
- [x] **2.1: Time Cell Editing** ✅ **COMPLETED**
  - [x] Convert time display cells to editable inputs
  - [x] Implement time format validation (HH:MM:SS)
  - [x] Add keyboard navigation between time cells
  - [x] Handle invalid time input with user feedback

- [x] **2.2: Arrival/Departure Time Support** ✅ **COMPLETED**
  - [x] Support separate arrival and departure times for stops
  - [x] Implement UI for displaying both arrival/departure columns
  - [x] Add validation for arrival <= departure time constraints
  - [x] Handle cases where only arrival or departure is specified

- [x] **2.3: Moved to Phase 8** ✅ **MOVED**
  - This step has been moved to Phase 8.1 for better logical flow

## Phase 3: Service Properties Management
- [ ] **3.1: Service Display Enhancement**
  - [ ] Make service IDs clickable links
  - [ ] Show service details in expandable sections
  - [ ] Display calendar dates and exceptions
  - [ ] Add visual indicators for service patterns

- [ ] **3.2: Service Modification**
  - [ ] Implement inline editing for service properties
  - [ ] Add calendar date picker for service periods
  - [ ] Handle service exceptions (calendar_dates.txt)
  - [ ] Validate service date ranges

## Phase 4: Route Navigation and Cross-References
- [x] **4.1: Direction-Based Timetable Pages** ✅ **COMPLETED**
  - [x] Create separate timetable pages for each route direction
  - [x] Implement direction filtering in timetable rendering
  - [x] Add direction navigation controls to timetable header
  - [x] Handle routes with multiple direction patterns

  **4.1 Implementation Details:**

  **Best DaisyUI Component Choice: Tabs with Radio Controls**
  - Use `tabs tabs-lift` for clean, modern appearance with lift effect
  - Radio button control provides proper state management
  - Content area below tabs will contain the timetable
  - Supports keyboard navigation and accessibility

  **HTML Structure:**
  ```html
  <div class="tabs tabs-lift w-full">
    <label class="tab">
      <input type="radio" name="direction-tabs" value="0" checked />
      <svg class="size-4 me-2"><!-- direction arrow icon --></svg>
      Inbound
    </label>
    <div class="tab-content bg-base-100 border-base-300 p-6">
      <!-- Timetable content for direction 0 -->
    </div>

    <label class="tab">
      <input type="radio" name="direction-tabs" value="1" />
      <svg class="size-4 me-2"><!-- direction arrow icon --></svg>
      Outbound
    </label>
    <div class="tab-content bg-base-100 border-base-300 p-6">
      <!-- Timetable content for direction 1 -->
    </div>
  </div>
  ```

  **Alternative Options Considered:**
  - `tabs tabs-boxed`: Good for distinct separation but less modern
  - `select` dropdown: Compact but less discoverable for primary navigation
  - `tabs tabs-border`: Similar to lift but borders may conflict with timetable styling

  **Implementation Tasks:**
  - [x] Add direction detection logic to ScheduleController
  - [x] Create tab navigation HTML in timetable header
  - [x] Add direction icons (arrows pointing in/out)
  - [x] Filter trips by direction_id in timetable data generation
  - [x] Handle routes without explicit direction_id values
  - [x] Add URL parameter support for direction selection
  - [x] Implement smooth transitions between direction views

  **✅ Implementation Results:**
  - Successfully implemented direction-based timetable pages using DaisyUI tabs-boxed component
  - Direction switching works seamlessly with proper URL state management
  - Icons and trip counts displayed correctly for each direction
  - Timetable content updates dynamically when switching between directions
  - Both explicit direction_id values and default handling work as expected
  - Integration with existing navigation system completed

- [ ] **4.2: Related Routes Display**
  - [ ] Identify other routes using the same service
  - [ ] Make route references clickable
  - [ ] Show route details in tooltips/popups
  - [ ] Implement navigation between related timetables

- [ ] **4.3: Service Usage Analytics**
  - [ ] Display count of trips using each service
  - [ ] Show impact warnings before service modifications
  - [ ] Add service dependency visualization
  - [ ] Implement bulk service updates across routes

## Phase 5: Stop Management
- [ ] **5.1: Skip/Unskip Stop Functionality**
  - [ ] Add skip toggle buttons for each stop
  - [ ] Implement visual indicators for skipped stops
  - [ ] Handle stop_times row deletion/restoration
  - [ ] Maintain stop sequence integrity

- [ ] **5.2: Stop Insertion**
  - [ ] Add "Insert Stop" buttons between existing stops
  - [ ] Implement stop selection modal/dropdown
  - [ ] Calculate interpolated arrival/departure times
  - [ ] Update stop sequence numbers automatically

## Phase 6: Trip Management
- [ ] **6.1: Trip Deletion**
  - [ ] Add delete button for each trip column
  - [ ] Implement confirmation dialog with impact warnings
  - [ ] Handle cascading deletions (stop_times cleanup)
  - [ ] Update timetable display after deletion

- [ ] **6.2: Trip Duplication**
  - [ ] Add duplicate button for each trip
  - [ ] Generate unique trip IDs for copies
  - [ ] Allow time offset application during duplication
  - [ ] Handle service ID association for duplicates

- [ ] **6.3: New Trip Creation**
  - [ ] Add "New Trip" button to timetable header
  - [ ] Implement trip creation wizard/form
  - [ ] Generate default stop_times with reasonable intervals
  - [ ] Associate new trips with appropriate services

## Phase 7: User Experience Enhancements
- [ ] **7.1: Visual Feedback System**
  - [ ] Implement cell highlighting for modifications
  - [ ] Add saving/loading indicators
  - [ ] Show validation errors inline
  - [ ] Display unsaved changes warnings

- [ ] **7.2: Keyboard Shortcuts**
  - [ ] Tab navigation between editable cells
  - [ ] Enter to confirm edits
  - [ ] Escape to cancel edits
  - [ ] Ctrl+Z/Y for undo/redo operations

- [ ] **7.3: Bulk Operations**
  - [ ] Time shift operations (add/subtract minutes)
  - [ ] Bulk service assignment
  - [ ] Multi-select for batch operations
  - [ ] Import/export timetable sections

## Phase 8: Validation and Data Integrity
- [ ] **8.1: Real-time Validation**
  - [ ] Implement automatic time progression validation (moved from 2.3)
  - [ ] Add arrival/departure time consistency checks (moved from 2.3)
  - [ ] Handle overnight trips (times > 24:00:00) (moved from 2.3)
  - [ ] Validate stop sequence timing logic (moved from 2.3)
  - [ ] Validate time sequences during editing
  - [ ] Check service calendar consistency
  - [ ] Ensure stop sequence integrity
  - [ ] Validate GTFS specification compliance

- [ ] **8.2: Conflict Resolution**
  - [ ] Handle overlapping service periods
  - [ ] Resolve duplicate trip IDs
  - [ ] Manage stop sequence conflicts
  - [ ] Provide automatic fix suggestions

## Phase 9: Performance Optimization
- [ ] **9.1: Large Dataset Handling**
  - [ ] Implement virtual scrolling for large timetables
  - [ ] Add pagination for trips
  - [ ] Optimize rendering for many stops/trips
  - [ ] Cache frequently accessed data

- [ ] **9.2: Memory Management**
  - [ ] Implement efficient dirty state tracking
  - [ ] Optimize undo/redo memory usage
  - [ ] Clean up event listeners properly
  - [ ] Handle large file operations gracefully

## Phase 10: Testing and Quality Assurance
- [ ] **10.1: Unit Testing**
  - [ ] Test time parsing and validation functions
  - [ ] Verify CRUD operations work correctly
  - [ ] Test edge cases (overnight trips, invalid data)
  - [ ] Validate data integrity functions

- [ ] **10.2: Integration Testing**
  - [ ] Test complete edit workflows
  - [ ] Verify database persistence
  - [ ] Test export functionality with modifications
  - [ ] Validate cross-module interactions

- [ ] **10.3: User Acceptance Testing**
  - [ ] Test with real GTFS datasets
  - [ ] Verify usability on different screen sizes
  - [ ] Test keyboard navigation flows
  - [ ] Validate performance with large datasets

## Phase 11: Documentation and Deployment
- [ ] **11.1: Code Documentation**
  - [ ] Document new API methods
  - [ ] Update module interaction diagrams
  - [ ] Add inline code comments
  - [ ] Update TypeScript type definitions

- [ ] **11.2: User Documentation**
  - [ ] Create timetable editing guide
  - [ ] Document keyboard shortcuts
  - [ ] Add troubleshooting section
  - [ ] Update help tooltips

## Implementation Notes

### Technical Considerations
- Use existing Zod schemas for validation where possible
- Leverage DaisyUI components for consistent styling
- Maintain compatibility with existing database structure
- Ensure mobile responsiveness for touch editing

### Data Structure Impact
- May need to extend stop_times table structure
- Consider versioning for undo/redo functionality
- Maintain referential integrity during operations
- Handle concurrent editing scenarios

### Performance Targets
- < 100ms response time for single cell edits
- Support timetables with 100+ trips
- Handle routes with 50+ stops efficiently
- Maintain smooth scrolling and interaction

### Risk Mitigation
- Implement comprehensive data backup before edits
- Add confirmation dialogs for destructive operations
- Provide clear undo mechanisms
- Validate all changes before persistence

## Success Criteria
- [ ] Users can edit times with immediate visual feedback
- [ ] Service properties are easily modifiable
- [ ] Trip management operations work intuitively
- [ ] Stop operations maintain data integrity
- [ ] Performance remains acceptable with real datasets
- [ ] All changes can be exported correctly
- [ ] Undo/redo functionality works reliably
- [ ] Validation prevents invalid GTFS data

---

*This plan should be followed sequentially, with each phase building upon the previous one. Testing should be performed after each phase to ensure stability before proceeding.*