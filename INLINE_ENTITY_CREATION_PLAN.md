# Inline Entity Creation Plan

## Overview
Add inline input fields to create new GTFS entities (agencies, services, routes) directly from their respective list views without navigating away.

## Feature Breakdown

### 1. Agency Creation (Home Page)
**Location**: Next to "Agencies" heading in home browse view

**UI Components**:
- [ ] Add input field with placeholder "New Agency ID" to the right of "Agencies" heading
- [ ] Style input to match existing design system
- [ ] Add visual feedback for validation states

**Behavior**:
- [ ] On blur (exiting the input), create new agency with entered ID
- [ ] Validate agency_id is unique before creating
- [ ] Show error notification if agency_id already exists
- [ ] Clear input field after successful creation
- [ ] New agency appears in the agencies list immediately
- [ ] Set reasonable defaults for required fields (agency_name, agency_url, agency_timezone)

**Database Operations**:
- [ ] Create new agency record in IndexedDB via GTFSDatabase
- [ ] Trigger UI refresh to show new agency in list
- [ ] Handle validation errors gracefully

---

### 2. Service Creation (Home Page)
**Location**: Next to "Services" heading in home browse view

**UI Components**:
- [ ] Add input field with placeholder "New Service ID" to the right of "Services" heading
- [ ] Match styling with agency input

**Behavior**:
- [ ] On blur, create new service (calendar entry) with entered service_id
- [ ] Validate service_id is unique
- [ ] Show error notification if service_id already exists
- [ ] Clear input after successful creation
- [ ] New service appears in services list
- [ ] Set reasonable defaults for calendar fields (all days = 1, start_date = today, end_date = today + 1 year)

**Database Operations**:
- [ ] Create new calendar record in IndexedDB
- [ ] Trigger UI refresh
- [ ] Handle validation errors

---

### 3. Route Creation (Routes Page)
**Location**: Next to "Routes" heading in routes browse view

**UI Components**:
- [ ] Add input field with placeholder "New Route ID" to the right of "Routes" heading
- [ ] Match styling with other inline inputs

**Behavior**:
- [ ] On blur, create new route with entered route_id
- [ ] Validate route_id is unique
- [ ] Show error notification if route_id already exists
- [ ] Clear input after successful creation
- [ ] New route appears in routes list
- [ ] Set reasonable defaults (route_short_name = route_id, route_type = 3 (bus), agency_id = first agency)

**Database Operations**:
- [ ] Create new route record in IndexedDB
- [ ] Link to an existing agency (use first agency if multiple exist)
- [ ] Trigger UI refresh
- [ ] Handle validation errors

---

### 4. Service Selection for Timetable (Route Page - More Complex)
**Location**: Within route detail view, in the timetable/trips section

**UI Components**:
- [ ] Add DaisyUI select dropdown with label "Select Service"
- [ ] Populate dropdown with all available service_ids from calendar
- [ ] Add placeholder option "Choose a service..."
- [ ] Show empty state when no service is selected

**Behavior**:
- [ ] When user selects a service from dropdown:
  - [ ] Display empty timetable UI for that service
  - [ ] Show column headers (stop names from route's stops if available)
  - [ ] Show "Add Trip" button or inline trip creation UI
  - [ ] **DO NOT create any database records yet**
- [ ] Timetable remains in "draft" state until user adds first trip
- [ ] When user adds first trip:
  - [ ] Create trip record with selected service_id and current route_id
  - [ ] Create stop_times records for the trip
  - [ ] Persist to database
  - [ ] Update UI to show saved timetable

**Database Operations** (only when trip is added):
- [ ] Create trip record linking route_id and service_id
- [ ] Create stop_times records for all stops in the trip
- [ ] Handle validation for required fields
- [ ] Trigger UI refresh

**Edge Cases**:
- [ ] Handle case where route has no stops yet (show message)
- [ ] Handle switching between services before saving (confirm discard)
- [ ] Show visual indicator that timetable is unsaved

---

## Implementation Order

1. **Phase 1: Agency Creation** (Simplest)
   - Implement inline agency creation on home page
   - Test validation and error handling
   - Verify UI updates correctly

2. **Phase 2: Service Creation**
   - Implement inline service creation on home page
   - Reuse patterns from agency creation
   - Test calendar defaults

3. **Phase 3: Route Creation**
   - Implement inline route creation on routes page
   - Handle agency linking logic
   - Test with multiple agencies

4. **Phase 4: Service Selection with Draft Timetable** (Most Complex)
   - Implement service dropdown in route detail
   - Build draft timetable UI (no persistence)
   - Add trip creation that triggers persistence
   - Test full workflow

---

## Shared Components & Patterns

**Reusable Logic**:
- [ ] Create `InlineEntityCreator` utility/component
- [ ] Shared validation logic for unique ID checking
- [ ] Shared error notification patterns
- [ ] Shared input styling and layout

**Validation**:
- [ ] Check ID uniqueness across existing entities
- [ ] Validate ID format (no special characters, reasonable length)
- [ ] Prevent empty IDs
- [ ] Show clear error messages

**UI/UX Patterns**:
- [ ] Consistent input placement (to the right of headings)
- [ ] Consistent placeholder text format
- [ ] Consistent success/error feedback
- [ ] Loading states during database operations

---

## Testing Checklist

**Agency Creation**:
- [ ] Can create agency with unique ID
- [ ] Cannot create duplicate agency_id
- [ ] New agency appears in list
- [ ] Input clears after creation
- [ ] Error shown for duplicate ID

**Service Creation**:
- [ ] Can create service with unique ID
- [ ] Cannot create duplicate service_id
- [ ] New service appears in list
- [ ] Reasonable calendar defaults are set
- [ ] Error handling works

**Route Creation**:
- [ ] Can create route with unique ID
- [ ] Cannot create duplicate route_id
- [ ] New route appears in list
- [ ] Route linked to agency correctly
- [ ] Error handling works

**Service Selection & Timetable**:
- [ ] Can select service from dropdown
- [ ] Empty timetable displays correctly
- [ ] No database writes until trip added
- [ ] Adding trip persists data
- [ ] Switching services works correctly
- [ ] Handles routes with no stops gracefully

---

## Technical Considerations

**State Management**:
- Draft timetable state needs to be tracked separately from persisted data
- Clear distinction between "selected service" and "service with trips"

**Database Schema**:
- Ensure all default values comply with GTFS specification
- Required fields must be populated with sensible defaults

**Performance**:
- Validation checks should be fast (indexed lookups)
- UI should update optimistically where possible

**Error Handling**:
- All database operations need try/catch blocks
- User-friendly error messages via notification system
- Rollback on partial failures

---

## Files to Modify

**UI Controllers**:
- [ ] `src/modules/page-content-renderer.ts` - Add inline inputs to browse views
- [ ] `src/modules/service-view-controller.ts` - Add service selection dropdown
- [ ] `src/modules/schedule-controller.ts` - Handle draft timetable state

**Database Layer**:
- [ ] `src/modules/gtfs-database.ts` - Add creation methods with defaults
- [ ] `src/modules/gtfs-parser.ts` - Ensure proper validation

**Utilities**:
- [ ] Create `src/utils/inline-entity-creator.ts` - Shared creation logic
- [ ] `src/utils/default-values.ts` - GTFS default value generators

**Types**:
- [ ] `src/types/page-state.ts` - Add draft timetable state if needed

**Styles**:
- [ ] `src/styles/main.css` - Inline input styling

---

## Notes

- Keep inputs simple and unobtrusive
- Focus on common workflows (creating one entity at a time)
- Don't over-engineer - inline creation is for convenience, not bulk operations
- Maintain consistency with existing UI patterns
- Follow DaisyUI component conventions
- Use existing notification system for feedback
- Respect GTFS specification for all default values
