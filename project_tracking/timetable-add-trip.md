# Add Trip to Timetable

**Status**: ✅ Implementation Complete
**Priority**: High
**Estimated Effort**: Medium (3-5 days)
**Created**: 2025-10-02
**Completed**: 2025-10-03

## Overview
Implement the ability to add new trips (columns) to the timetable with an "Add Trip" button in the fixed header area. This allows users to create new service runs without leaving the timetable view.

## UI Design - Proposal 1: Fixed Header Area

```
┌────────────────────────────────────────────────────┐
│ Route 101 - Weekday        [+ Add Stop] [+ Add Trip] │ ← Fixed header
│ Timetable View                                      │
├────────────────────────────────────────────────────┤
│ Stop       │ Trip 1 │ Trip 2 │ Trip 3 │ ... (scroll horizontally)
├────────────┼────────┼────────┼────────┤
│ Main St    │ 08:00  │ 08:30  │ 09:00  │
│ Oak Ave    │ 08:05  │ 08:35  │ 09:05  │
│            (scroll vertically)
```

**Rationale**:
- Always visible regardless of scroll position
- Doesn't interfere with table scrolling (horizontal/vertical)
- Groups related actions together (Add Stop + Add Trip)
- Clear and accessible
- Removes [+] from table header (which scrolls), moves it to fixed header

## Required Trip Properties

### Auto-populated from Context
- `route_id` - From current timetable (e.g., "route_101")
- `service_id` - From current timetable (e.g., "weekday")
- `direction_id` - From currently selected direction tab (if available)

### User Input Required
- `trip_id` - User-provided unique identifier (e.g., "trip_1030")

### Future Enhancements (not in MVP)
- `trip_headsign` - Destination display (e.g., "Downtown Mall")
- `trip_short_name` - Public trip identifier (e.g., "101")
- `block_id` - Vehicle block assignment
- `shape_id` - Route shape reference
- `wheelchair_accessible` - 0/1/2
- `bikes_allowed` - 0/1/2

## User Flow

1. **User clicks "+ Add Trip" button** in header
2. **Dropdown appears** (matching Add Stop UI pattern):
   ```
   ┌──────────────────────────────┐
   │ Enter trip ID                │
   │ [____________________]       │
   └──────────────────────────────┘
   ```
3. **User enters trip_id** and presses Enter or types value
4. **System validates trip_id uniqueness**
5. **System creates trip + empty stop_times**
6. **Timetable refreshes** showing new column with empty cells
7. **User fills in times**

**Alternative (with copy option - future enhancement):**
- Add checkbox in dropdown: "□ Copy from trip: [select ▼]"

## Implementation Checklist

### Backend - Database Operations

- [x] **Create `addNewTrip()` method** in `ScheduleController` (src/modules/schedule-controller.ts:913)
  - [x] Validate `trip_id` is unique (check if already exists in trips table)
  - [x] Insert trip record into `trips` table with minimal fields: `trip_id`, `route_id`, `service_id`, `direction_id`
  - [x] Create empty stop_time records for all stops in supersequence (arrival_time: null, departure_time: null)
  - [x] Return success/error

- [x] **Create `validateTripId()` helper** in `ScheduleController` (src/modules/schedule-controller.ts:879)
  - [x] Query existing trips to check if trip_id already exists
  - [x] Return validation result with error message if duplicate

### Frontend - UI Components

- [x] **Move "+ Add Stop" button** from table header to fixed header area
  - [x] Remove from `renderTimetableHeader()` (was at src/modules/timetable-renderer.ts:210)
  - [x] Add to `renderScheduleHeader()` (src/modules/timetable-renderer.ts:64)
  - [x] Position: Right side of header, next to route/service info

- [x] **Add "+ Add Trip" button** in timetable header (next to Add Stop)
  - [x] Location: `TimetableRenderer.renderScheduleHeader()` (src/modules/timetable-renderer.ts:64)
  - [x] Position: Right side of header, next to [+ Add Stop] button
  - [x] Style: DaisyUI button component (btn btn-sm gap-1), consistent with existing UI
  - [x] Handler: `onclick="gtfsEditor.scheduleController.openAddTripDropdown()"`

- [x] **Create trip creation dropdown HTML** in `TimetableRenderer` (src/modules/timetable-renderer.ts:117)
  - [x] Similar to add-stop dropdown
  - [x] Contains:
    - Label: "Enter trip ID"
    - Input field: `<input class="input input-sm w-full" id="add-trip-input">`
    - Submit on Enter key press
  - [x] Validation: trip_id must not be empty and must be unique

- [x] **Add dropdown show/hide logic** in `ScheduleController`
  - [x] `openAddTripDropdown()` - Display dropdown, focus input (src/modules/schedule-controller.ts:838)
  - [x] `closeAddTripDropdown()` - Hide dropdown (src/modules/schedule-controller.ts:864)
  - [x] `addNewTripFromInput()` - Get input value, validate, create trip (src/modules/schedule-controller.ts:979)
  - [x] Handle Enter key press on input field

### Integration & Refresh

- [x] **Handle input submission** in `ScheduleController`
  - [x] Validate trip_id is not empty
  - [x] Validate trip_id is unique using `validateTripId()`
  - [x] Call `addNewTrip(trip_id)`
  - [x] Show success notification
  - [x] Close dropdown
  - [x] Refresh timetable

- [x] **Refresh timetable** to show new trip
  - [x] Call `refreshCurrentTimetable()` (already exists)
  - [x] New trip column appears at end
  - [x] Empty cells displayed

### Error Handling

- [x] **Validation errors**
  - [x] Empty trip_id → "Trip ID is required"
  - [x] Duplicate trip_id → "Trip ID already exists, please choose another"
  - [x] Database insert failure → Show error notification

- [x] **User feedback**
  - [x] Success: "Trip created successfully"
  - [x] Error: "Failed to create trip" / "No timetable loaded" / validation messages
  - [x] Dropdowns close on blur with timeout

### Testing

- [ ] **Manual testing**
  - [ ] Create trip with trip_id (empty times)
  - [ ] Verify new column appears in timetable
  - [ ] Verify times can be edited in new trip
  - [ ] Test with different directions (if multi-direction route)
  - [ ] Test duplicate trip_id validation

- [ ] **Edge cases**
  - [ ] Create trip when timetable is empty (no stops) - should create trip with no stop_times
  - [ ] Create trip with very long trip_id (truncation in header?)
  - [ ] Close dropdown without submitting (no trip created)
  - [ ] Submit with empty trip_id (validation error)

## Technical Details

### GTFS Schema Reference

From `src/types/gtfs.ts` - `TripsSchema`:
```typescript
{
  route_id: string;           // Required - FK to routes.txt
  service_id: string;         // Required - FK to calendar.txt or calendar_dates.txt
  trip_id: string;            // Required - Primary key
  trip_headsign?: string;     // Optional
  trip_short_name?: string;   // Optional
  direction_id?: number;      // Optional - 0 or 1
  block_id?: string;          // Optional
  shape_id?: string;          // Optional - FK to shapes.txt
  wheelchair_accessible?: string; // Optional - 0, 1, or 2
  bikes_allowed?: string;     // Optional - 0, 1, or 2
}
```

### Database Operations Flow

1. **Insert trip record** (1 row)
   ```typescript
   await database.insertRow('trips', {
     trip_id: userInputTripId,  // User-provided
     route_id: currentRouteId,  // From context
     service_id: currentServiceId,  // From context
     direction_id: currentDirectionId,  // From context (if available)
   });
   ```

2. **Get supersequence stops** (N stops from current timetable)
   ```typescript
   const stops = data.stops; // Already in correct sequence
   ```

3. **Create stop_times for each stop** (N rows)
   ```typescript
   for (let i = 0; i < stops.length; i++) {
     await database.insertRow('stop_times', {
       trip_id: generatedId,
       stop_id: stops[i].stop_id,
       stop_sequence: String(i + 1),
       arrival_time: copyTimes ? referenceTimes.get(stops[i].stop_id)?.arrival : null,
       departure_time: copyTimes ? referenceTimes.get(stops[i].stop_id)?.departure : null,
     });
   }
   ```

4. **Refresh timetable** (re-query and render)

### Key Differences from Add Stop

| Aspect | Add Stop | Add Trip |
|--------|----------|----------|
| **Primary entity** | Stop (already exists in stops.txt) | Trip (newly created in trips.txt) |
| **Secondary records** | Create stop_times for all trips (row) | Create stop_times for all stops (column) |
| **Sequence order** | Auto-sorted by time after edit | Already in order (from supersequence) |
| **Initial state** | Empty times (null) | Empty OR copied from reference |
| **User input** | Select existing stop | Enter trip_id only |

## Files to Modify

1. **src/modules/schedule-controller.ts**
   - Add `openAddTripDropdown()` - show dropdown, focus input
   - Add `addNewTripFromInput()` - get value from input, validate, create
   - Add `addNewTrip(trip_id)` - database operations
   - Add `validateTripId(trip_id)` - check uniqueness

2. **src/modules/timetable-renderer.ts**
   - Modify `renderScheduleHeader()` - add both "+ Add Stop" and "+ Add Trip" buttons to header
   - Update `renderTimetableHeader()` - remove "+ Add Stop" button (moved to header)
   - Dropdown HTML inline in header (similar to current add-stop dropdown pattern)

3. **styles or inline** (if needed)
   - Ensure dropdown z-index is appropriate (z-[1000] matching add-stop dropdown)
   - Button styling consistent with existing UI (btn btn-sm)

## Design System

- **UI Framework**: DaisyUI components (button, dropdown, input, label)
- **Styling**: Tailwind CSS utility classes (context7)
- **Dropdown**: DaisyUI dropdown component (matching add-stop pattern exactly)
- **Form inputs**: DaisyUI input component (input input-sm w-full)
- **Buttons**: DaisyUI button variants (btn btn-sm, btn-circle, btn-ghost)

## Next Steps After Implementation

1. **Extended trip properties editing**
   - Edit existing trip properties (see `project_tracking/timetable-editing.md` line 34-40)
   - Modal or dedicated page for full trip CRUD

2. **Trip deletion**
   - Delete trip column from timetable
   - Remove trip + all associated stop_times

3. **Trip reordering**
   - Drag-and-drop column reorder
   - Sort trips by first departure time

4. **Bulk operations**
   - Duplicate trip (copy all times)
   - Offset trip times by X minutes
   - Apply time pattern to multiple trips

## References

- GTFS trips.txt spec: https://gtfs.org/schedule/reference/#tripstxt
- GTFS stop_times.txt spec: https://gtfs.org/schedule/reference/#stop_timestxt
- Existing add stop implementation: `src/modules/schedule-controller.ts` (addStopToAllTrips)
- Timetable editing plan: `project_tracking/timetable-editing.md`
- UI rendering: `src/modules/timetable-renderer.ts`
- Database layer: `src/modules/timetable-database.ts`
