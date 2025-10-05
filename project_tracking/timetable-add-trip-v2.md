# Add Trip to Timetable - V2 (Always Visible)

**Status**: ✅ Implementation Complete
**Priority**: High
**Estimated Effort**: Small (1-2 hours)
**Created**: 2025-10-03

## Overview
Simplified approach: Always show a "new stop" row at the bottom and a "new trip" column on the right. No buttons or dropdowns needed - just persistent input fields.

## UI Design - Always Visible Inputs

```
┌────────────────────────────────────────────────────────────┐
│ Route 101 - Weekday                                         │
│ Timetable View                                              │
├────────────┬────────┬────────┬────────┬──────────────────┤
│ Stop       │ Trip 1 │ Trip 2 │ Trip 3 │ [New Trip ID]    │ ← Always visible
├────────────┼────────┼────────┼────────┼──────────────────┤
│ Main St    │ 08:00  │ 08:30  │ 09:00  │                  │
│ Oak Ave    │ 08:05  │ 08:35  │ 09:05  │                  │
├────────────┼────────┼────────┼────────┼──────────────────┤
│ [Select+]  │        │        │        │                  │ ← Always visible
└────────────┴────────┴────────┴────────┴──────────────────┘
```

**Key Features**:
- **New Trip Column**: Always visible on the right with input field for trip_id in header
- **New Stop Row**: Always visible at the bottom with stop selector in first column
- **No buttons needed**: Users just interact directly with the inputs
- **Immediate feedback**: Validation happens on blur/change

## User Flow

### Adding a Trip
1. User sees empty column on right with input field labeled "New Trip ID"
2. User types trip_id (e.g., "trip_1030") and presses Enter or tabs away
3. System validates uniqueness
4. If valid: **Immediately saves trip to database with NO stop_times**, column appears, new empty column appears
5. If invalid: Shows error notification
6. User can immediately add another trip ID if desired

### Adding a Stop
1. User sees empty row at bottom with stop selector (dropdown/autocomplete)
2. User selects a stop from the dropdown
3. System validates and saves stop_times for all trips (even trips with no times yet)
4. Row becomes regular row, new empty row appears at bottom

## Implementation Plan

### Remove Old Approach
- [x] Remove "+ Add Stop" and "+ Add Trip" buttons from header
- [x] Remove dropdown containers and associated JavaScript

### New Trip Column (Direct Save Pattern)
- [x] Modify `renderTimetableHeader()` to always include a "new trip" header cell
  - [x] Add `<th>` with input field for trip_id (line 205)
  - [x] Placeholder: "New trip ID..."
  - [x] onChange handler: `gtfsEditor.scheduleController.createTripFromInput(value)`

- [x] Modify `renderTimetableBody()` to always include cells for new trip column
  - [x] Add empty `<td>` for each stop row (line 318)
  - [x] Cells are always editable

- [x] Modify `createTripFromInput(trip_id)` to save immediately (line 958)
  - [x] Validate trip_id (not empty, unique)
  - [x] **Save trip to database immediately** (no pending state)
  - [x] Create trip record with route_id, service_id, direction_id
  - [x] Refresh timetable to show new column
  - [x] Show success/error notification

- [x] Remove `pendingTrip` pattern completely
  - [x] Remove `pendingTrip` property
  - [x] Remove `savePendingTripIfMatches()` method
  - [x] Remove calls from time entry methods (lines 128, 166, 236)

- [x] Update `getTimetableData()` to handle trips with no stop_times
  - [x] Query trips from database normally
  - [x] Trips with no stop_times will have empty stopTimes array
  - [x] Remove pendingTrip injection logic

### New Stop Row (Existing Pending Pattern)
- [x] Modify `renderTimetableBody()` to always include a "new stop" row at the end (line 326)
  - [x] First cell: Stop selector (dropdown)
  - [x] Remaining cells: Empty non-editable cells
  - [x] onChange handler: `gtfsEditor.scheduleController.addStopFromSelector(stop_id)`

- [x] Create `addStopFromSelector(stop_id)` method in ScheduleController (line 1029)
  - [x] Set as `pendingStop` (already exists, same pattern)
  - [x] Refresh timetable to show pending row
  - [x] Stop is saved when first time is entered

- [x] Create `populateNewStopSelect()` method (line 603)
  - [x] Called after rendering via setTimeout (line 596)
  - [x] Filter out stops already in timetable
  - [x] Show "All stops are already in this timetable" if none available

### Validation & UX
- [x] Inline validation for trip_id input
  - [x] Show error notification if invalid
  - [x] Clear input after validation

- [x] Stop selector populated with available stops
  - [x] Filter out stops already in timetable
  - [x] Show "All stops are already in this timetable" if all stops used

- [x] Feedback messages
  - [x] Show success notification: "Trip created successfully"
  - [x] Show success notification: "Stop added. Enter a time to save." (for stops)

## Technical Details

### Changes to TimetableRenderer

**renderTimetableHeader()**:
```typescript
// Add at end of trip headers:
<th class="trip-header text-center min-w-[80px] p-2 text-xs">
  <input
    type="text"
    class="input input-xs w-full"
    placeholder="New trip ID..."
    id="new-trip-input"
    onblur="gtfsEditor.scheduleController.createTripFromInput(this.value)"
  />
</th>
```

**renderTimetableBody()**:
```typescript
// Add at end of each row:
<td class="text-center p-2"></td>

// Add at end of tbody:
<tr>
  <td class="stop-name p-2 sticky left-0 bg-base-100">
    <select class="select select-sm w-full" id="new-stop-select"
            onchange="gtfsEditor.scheduleController.addStopFromSelector(this.value)">
      <option value="">Add stop...</option>
      <!-- Populated with available stops -->
    </select>
  </td>
  ${emptyTimeCells}
</tr>
```

### Changes to ScheduleController

**createTripFromInput(trip_id)** (MODIFIED):
- Trim and validate input
- Check uniqueness with `validateTripId()`
- **Save trip to database immediately** (INSERT into trips table)
- Refresh timetable to show new column
- Clear input
- Show success/error notification ("Trip created successfully")

**validateTripId(trip_id)** (EXISTING - private):
- Query trips table for existing trip_id
- Return { isValid, errorMessage }

**addStopFromSelector(stop_id)** (NEW):
- Validate selection
- Set as `pendingStop` (same pattern as trip)
- Refresh timetable to show row
- Reset selector
- Stop saved when first time entered

**populateNewStopSelect()** (NEW - private):
- Called after rendering via setTimeout
- Gets all stops from database
- Filters out stops already in timetable
- Populates <select> with available stops
- Shows message if all stops used

**getTimetableData()** (MODIFIED):
- Query all trips from database (including trips with no stop_times)
- Trips without stop_times will have empty stopTimes array
- Remove pendingTrip injection logic

## Benefits of This Approach

1. **Simpler**: No buttons, no dropdowns, no show/hide logic
2. **More discoverable**: Always visible = users know the feature exists
3. **Faster**: One less click (no button to open dropdown)
4. **Clearer**: Direct manipulation - type where you see the result
5. **Less code**: Remove button handlers, dropdown positioning, blur detection

## Files to Modify

1. **src/modules/timetable-renderer.ts**
   - `renderScheduleHeader()` - Remove buttons and dropdowns
   - `renderTimetableHeader()` - Add new trip input cell
   - `renderTimetableBody()` - Add new trip column cells and new stop row

2. **src/modules/schedule-controller.ts**
   - Remove: `openAddTripDropdown()`, `closeAddTripDropdown()`, `addNewTripFromInput()`
   - Remove: `openAddStopDropdown()` (replace with simpler approach)
   - Add: `createTripFromInput(trip_id)`
   - Add: `addStopFromSelector(stop_id)`
   - Modify: `populateAddStopList()` → `getAvailableStopsForSelector()`
