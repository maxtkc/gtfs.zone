# Timetable Editing

**Status**: 🟢 Core Features Implemented (extended features in progress)
**Priority**: High
**Estimated Effort**: Large (2-3 weeks)
**Last Updated**: 2025-10-01

## Overview
Implement comprehensive timetable editing features including stop/trip addition, automatic sequence management, and extended field support beyond just times.

## Checklist

### Core Features
- [x] Add stop row insertion at bottom of timetable *(Implemented 2025-10-01)*
  - Added + button next to "Stop" column header
  - DaisyUI dropdown with searchable stop list
  - Filters out stops already in timetable
  - Creates empty stop_time records for all trips
  - Uses z-index: 1000 for proper dropdown layering
- [x] Implement automatic stop sequence reordering after time edit *(Already working)*
- [x] Create intelligent stop_sequence recalculation algorithm *(Already implemented in TimetableDatabase)*
- [ ] Design and implement trip addition UI and workflow
- [x] Handle empty time cells (null arrival/departure) *(Already working)*
- [x] Add validation for stop sequence integrity *(Already implemented)*

### Extended Fields Support
- [ ] Add `pickup_type` field editing (0=Regular, 1=None, 2=Phone, 3=Driver)
- [ ] Add `drop_off_type` field editing (same values as pickup)
- [ ] Add `timepoint` field editing (0=Approx, 1=Exact, empty=Exact)
- [ ] Add `shape_dist_traveled` field editing (optional distance tracking)
- [ ] Design cell hover enhancement UI for additional fields
- [ ] Implement popover/modal for cell enhancement fields

### Trip Properties
- [ ] Create trip properties page or modal
- [ ] Edit `trip_headsign` (destination display)
- [ ] Edit `trip_short_name` (public-facing trip identifier)
- [ ] Edit `direction_id` (0 or 1)
- [ ] Edit `block_id` (vehicle block assignment)
- [ ] Edit `wheelchair_accessible` (0=Unknown, 1=Yes, 2=No)
- [ ] Edit `bikes_allowed` (0=Unknown, 1=Yes, 2=No)

### Testing & Polish
- [ ] Test sequence reordering edge cases (tied times, null times)
- [ ] Test with large timetables (100+ stops, 50+ trips)
- [ ] Validate all edits against GTFS specification
- [ ] Add undo/redo support for timetable edits
- [ ] Implement bulk edit operations (copy column, shift times)

## Current Implementation Analysis

### Existing Timetable Editing Architecture

The codebase has a well-structured modular timetable system:

#### Module Overview
1. **`ScheduleController`** (`src/modules/schedule-controller.ts`, 596 lines)
   - Main orchestrator for timetable functionality
   - Handles time editing operations (linked/unlinked times)
   - Coordinates between specialized modules
   - Current editing methods:
     - `updateTime()` - Single time update
     - `updateLinkedTime()` - Both arrival/departure to same value
     - `updateArrivalDepartureTime()` - Separate arrival/departure
     - `toggleTimesLink()` - Switch between linked/unlinked mode

2. **`TimetableRenderer`** (`src/modules/timetable-renderer.ts`, 314 lines)
   - HTML generation for schedule views
   - Renders timetable table structure
   - Creates direction tabs for multi-direction routes
   - Methods:
     - `renderTimetableHTML()` - Complete timetable structure
     - `renderTimetableHeader()` - Trip columns
     - `renderTimetableBody()` - Stop rows with time cells

3. **`TimetableDataProcessor`** (`src/modules/timetable-data-processor.ts`, 551 lines)
   - Data transformation and alignment logic
   - Uses Shortest Common Supersequence (SCS) algorithm for stop alignment
   - Handles direction filtering
   - Key methods:
     - `generateTimetableData()` - Main data processing
     - `alignTripsWithSCS()` - Intelligent trip alignment
     - `getAvailableDirections()` - Direction analysis

4. **`TimetableDatabase`** (`src/modules/timetable-database.ts`, 504 lines)
   - All database operations for stop_times
   - CRUD operations with FAIL HARD policy
   - Validation using Zod schemas
   - Critical method: `renumberStopSequences()` (Line 438-503)

5. **`TimetableCellRenderer`** (referenced but not read)
   - Handles individual cell rendering
   - Creates input elements for time editing
   - Manages linked vs. unlinked input states

### Existing Stop Sequence Renumbering

From `TimetableDatabase.renumberStopSequences()` (line 438-503):

```typescript
async renumberStopSequences(trip_id: string): Promise<void> {
  // Get all stop_times for this trip
  const stopTimes = await database.queryRows('stop_times', { trip_id });

  // Sort by arrival_time (use departure_time as fallback)
  const sortedStopTimes = [...stopTimes].sort((a, b) => {
    const timeA = a.arrival_time || a.departure_time || '';
    const timeB = b.arrival_time || b.departure_time || '';
    return timeA.localeCompare(timeB);
  });

  // Check if renumbering is actually needed
  let needsRenumbering = false;
  for (let i = 0; i < sortedStopTimes.length; i++) {
    const expectedSequence = i + 1;
    const currentSequence = parseInt(String(sortedStopTimes[i].stop_sequence));
    if (currentSequence !== expectedSequence) {
      needsRenumbering = true;
      break;
    }
  }

  if (!needsRenumbering) {
    console.log(`Stop sequences already correct`);
    return;
  }

  // Delete all existing stop_times
  for (const stopTime of stopTimes) {
    const naturalKey = generateCompositeKeyFromRecord('stop_times', stopTime);
    await database.deleteRow('stop_times', naturalKey);
  }

  // Prepare updated records with new sequences
  const updatedStopTimes = sortedStopTimes.map((stopTime, index) => ({
    ...stopTime,
    stop_sequence: String(index + 1),
  }));

  // Re-insert all records with updated stop_sequences
  await database.insertRows('stop_times', updatedStopTimes);
}
```

**This is ALREADY IMPLEMENTED and called after every time edit!** (Lines 203, 244, 292 in `schedule-controller.ts`)

### Current Time Editing Flow

From `ScheduleController.updateLinkedTime()` (Lines 160-210):

```typescript
async updateLinkedTime(trip_id: string, stop_id: string, newTime: string): Promise<void> {
  try {
    // Handle empty input (clear both times)
    if (!newTime.trim()) {
      await this.database.updateLinkedTimes(trip_id, stop_id, null);
      // Update input value immediately
      // Renumber stop sequences and refresh timetable
      await this.database.renumberStopSequences(trip_id);
      await this.refreshCurrentTimetable();
      return;
    }

    // Cast time to HH:MM:SS format
    const castedTime = TimeFormatter.castTimeToHHMMSS(newTime);

    // Update both arrival and departure times to the same value
    await this.database.updateLinkedTimes(trip_id, stop_id, castedTime);

    // Update input value immediately
    const input = document.querySelector(
      `input[data-trip-id="${trip_id}"][data-stop-id="${stop_id}"][data-time-type="linked"]`
    ) as HTMLInputElement;
    if (input) {
      input.value = TimeFormatter.formatTimeWithSeconds(castedTime);
    }

    // Renumber stop sequences and refresh timetable
    await this.database.renumberStopSequences(trip_id);
    await this.refreshCurrentTimetable();
  } catch (error) {
    console.error('Failed to update linked time:', error);
    this.showTimeError(trip_id, stop_id, 'Failed to save time change');
  }
}
```

**Key Insight:** Every time edit triggers sequence renumbering and full timetable refresh!

## Feature Design & Implementation

### Feature 1: Add Stop Row at Bottom

**UI Design:**
```
┌────────────────────────────────────────────────────┐
│ Stop Name      │ Trip 1 │ Trip 2 │ Trip 3 │ Trip 4 │
├────────────────┼────────┼────────┼────────┼────────┤
│ Main St        │ 08:00  │ 08:30  │ 09:00  │ 09:30  │
│ Oak Ave        │ 08:05  │ 08:35  │ 09:05  │ 09:35  │
│ Elm St         │ 08:10  │ 08:40  │ 09:10  │ 09:40  │
├────────────────┼────────┼────────┼────────┼────────┤
│ [+ Add Stop]   │        │        │        │        │ ← NEW
└────────────────────────────────────────────────────┘
```

**Implementation Steps:**

1. Add button to timetable footer in `TimetableRenderer`:
```typescript
// Add to renderTimetableBody() after all stop rows
const addStopRow = `
  <tr class="add-stop-row">
    <td class="p-2 border-r border-base-300">
      <button class="btn btn-sm btn-outline btn-primary" id="add-stop-btn">
        + Add Stop
      </button>
    </td>
    ${data.trips.map(() => '<td></td>').join('')}
  </tr>
`;
```

2. Add click handler in `ScheduleController`:
```typescript
document.getElementById('add-stop-btn')?.addEventListener('click', async () => {
  await this.showAddStopDialog();
});

async showAddStopDialog(): Promise<void> {
  // Show modal with stop selector
  // User selects stop from available stops
  // User enters time for first trip (optional)
  // Create new stop_time records for all trips
  // Refresh timetable
}
```

3. Create stop_time records:
```typescript
async addStopToTrips(
  stop_id: string,
  trips: string[],
  initialTimes?: Map<string, string>
): Promise<void> {
  const database = this.gtfsParser.gtfsDatabase;

  for (const trip_id of trips) {
    // Get existing stop_times for sequence numbering
    const existingStops = await database.queryRows('stop_times', { trip_id });
    const maxSequence = Math.max(...existingStops.map(st => parseInt(st.stop_sequence)));

    // Create new stop_time record
    const newStopTime = {
      trip_id,
      stop_id,
      arrival_time: initialTimes?.get(trip_id) || null,
      departure_time: initialTimes?.get(trip_id) || null,
      stop_sequence: String(maxSequence + 1),
    };

    await database.insertRow('stop_times', newStopTime);
  }

  // Renumber sequences for all trips (times may need reordering)
  for (const trip_id of trips) {
    await this.database.renumberStopSequences(trip_id);
  }

  await this.refreshCurrentTimetable();
}
```

**Sorting Behavior:**
After adding stop with time "08:15", the `renumberStopSequences()` method will:
1. Sort all stops by arrival_time: Main St (08:00), Oak Ave (08:05), New Stop (08:15), Elm St (08:10)
2. Detect out-of-order: Elm St should come BEFORE New Stop
3. Re-sort: Main St (08:00), Oak Ave (08:05), Elm St (08:10), New Stop (08:15)
4. Renumber: sequences 1, 2, 3, 4

### Feature 2: Trip Addition

**UI Design:**
```
┌────────────────────────────────────────────────────┐
│                   [+ Add Trip]  ← NEW BUTTON       │
├────────────────────────────────────────────────────┤
│ Stop Name      │ Trip 1 │ Trip 2 │ [New] │        │
├────────────────┼────────┼────────┼───────┼────────┤
│ Main St        │ 08:00  │ 08:30  │       │        │
│ Oak Ave        │ 08:05  │ 08:35  │       │        │
└────────────────────────────────────────────────────┘
```

**Implementation:**

1. Add button to timetable header in `TimetableRenderer`:
```typescript
// Modify renderTimetableHeader() to include Add Trip button
const addTripButton = `
  <th class="text-center p-2">
    <button class="btn btn-sm btn-circle btn-outline btn-primary" id="add-trip-btn" title="Add Trip">
      +
    </button>
  </th>
`;
```

2. Create trip addition dialog:
```typescript
async showAddTripDialog(): Promise<void> {
  // Modal prompts for:
  // - Trip headsign (destination)
  // - Service ID (copy from existing trip in same timetable)
  // - Direction ID (copy from existing trip)
  // - Optional: Copy times from existing trip
  // - Optional: Offset times by X minutes

  const newTrip = {
    trip_id: generateTripId(),  // Auto-generate unique ID
    route_id: this.currentRouteId,
    service_id: selectedServiceId,
    trip_headsign: headsign,
    direction_id: directionId,
    block_id: null,  // Optional
    shape_id: null,  // Optional
  };

  // Create trip record
  await database.insertRow('trips', newTrip);

  // Create stop_times for all stops in supersequence
  // Either empty or copied from reference trip
  const stops = getSupersequenceStops();
  for (let i = 0; i < stops.length; i++) {
    await database.insertRow('stop_times', {
      trip_id: newTrip.trip_id,
      stop_id: stops[i].stop_id,
      arrival_time: null,  // Or copied/offset time
      departure_time: null,
      stop_sequence: String(i + 1),
    });
  }

  await this.refreshCurrentTimetable();
}
```

### Feature 3: Extended stop_times Fields

**Current stop_times Fields in GTFS:**
```typescript
interface StopTime {
  // Core fields (currently editable):
  trip_id: string;
  stop_id: string;
  arrival_time: string;
  departure_time: string;
  stop_sequence: string;

  // Extended fields (NOT currently editable):
  stop_headsign?: string;
  pickup_type?: string;      // 0,1,2,3
  drop_off_type?: string;    // 0,1,2,3
  continuous_pickup?: string; // 0,1,2,3
  continuous_drop_off?: string; // 0,1,2,3
  shape_dist_traveled?: string;
  timepoint?: string;        // 0,1,empty
}
```

**UI Design - Cell Hover Enhancement:**
```
┌─────────────────────────────┐
│ 08:15  ⚙️ ← Gear icon       │
└─────────────────────────────┘
       ↓ On hover
┌─────────────────────────────┐
│ 08:15  [⚙️] ← Click to edit │
└─────────────────────────────┘
       ↓ On click
┌──────────────────────────────────────┐
│ Stop Time Properties                  │
├──────────────────────────────────────┤
│ Arrival:   [08:15:00] [🔗]          │
│ Departure: [08:15:00] [🔗]          │
│                                       │
│ Pickup Type:    [Regular ▼]         │
│ Drop-off Type:  [Regular ▼]         │
│ Timepoint:      [Exact ▼]           │
│ Distance:       [1.25 km]            │
│                                       │
│ [Cancel] [Save]                      │
└──────────────────────────────────────┘
```

**Implementation:**

1. Add gear icon to each cell in `TimetableCellRenderer`:
```typescript
renderStackedArrivalDepartureCell(
  trip_id: string,
  stop_id: string,
  arrival_time: string | null,
  departure_time: string | null,
  editableStopTime: EditableStopTime | null
): string {
  return `
    <td class="text-center p-0">
      <div class="time-cell-container">
        <!-- Existing time inputs -->
        ${this.renderTimeInputs(...)}

        <!-- NEW: Gear icon for additional properties -->
        <button class="cell-properties-btn"
                data-trip-id="${trip_id}"
                data-stop-id="${stop_id}"
                title="Edit stop properties">
          ⚙️
        </button>
      </div>
    </td>
  `;
}
```

2. Create properties modal/popover:
```typescript
class StopTimePropertiesEditor {
  async show(trip_id: string, stop_id: string): Promise<void> {
    // Fetch current stop_time record
    const stopTime = await database.queryRows('stop_times', {
      trip_id,
      stop_id
    })[0];

    // Show modal with all editable fields
    this.renderModal(stopTime);
  }

  async save(trip_id: string, stop_id: string, updates: Partial<StopTime>): Promise<void> {
    const naturalKey = generateCompositeKeyFromRecord('stop_times', {trip_id, stop_id, ...});
    await database.updateRow('stop_times', naturalKey, updates);

    notifications.showSuccess('Stop properties updated');
    await scheduleController.refreshCurrentTimetable();
  }
}
```

3. Add dropdown options:
```typescript
const pickupTypeOptions = [
  { value: '0', label: 'Regular pickup' },
  { value: '1', label: 'No pickup available' },
  { value: '2', label: 'Must phone agency' },
  { value: '3', label: 'Must coordinate with driver' },
];

const timepointOptions = [
  { value: '', label: 'Exact (default)' },
  { value: '0', label: 'Approximate' },
  { value: '1', label: 'Exact' },
];
```

### Feature 4: Trip Properties Page

**Two Options:**

**Option A: Modal (simpler)**
```
[📝 Edit Trip] ← Button at trip column header
     ↓
┌──────────────────────────────────────┐
│ Trip Properties                       │
├──────────────────────────────────────┤
│ Trip ID:          T001_0830          │ (read-only)
│ Headsign:         [Downtown Mall]    │
│ Short Name:       [101]               │
│ Direction:        [Outbound ▼]       │
│ Block ID:         [B_001]             │
│ Shape ID:         [shape_101 ▼]      │
│ Wheelchair:       [Accessible ▼]     │
│ Bikes Allowed:    [Yes ▼]            │
│                                       │
│ [Delete Trip] [Cancel] [Save]        │
└──────────────────────────────────────┘
```

**Option B: Dedicated Page (more complex)**
Navigate to `/trip/:trip_id` with full CRUD interface

**Recommended: Option A (Modal)** for MVP, can enhance to Option B later.

## Sequence Reordering Algorithm Enhancement

The current algorithm sorts by time, but needs enhancement for edge cases:

### Edge Case 1: Tied Times (Multiple Stops at Same Time)
```
Current behavior:
  Stop A: 08:15
  Stop B: 08:15
  Stop C: 08:15

Problem: Which order should these be?
Solution: Preserve original sequence when times are equal
```

**Enhanced Algorithm:**
```typescript
const sortedStopTimes = [...stopTimes].sort((a, b) => {
  const timeA = a.arrival_time || a.departure_time || '';
  const timeB = b.arrival_time || b.departure_time || '';

  // Compare times first
  const timeCompare = timeA.localeCompare(timeB);
  if (timeCompare !== 0) {
    return timeCompare;
  }

  // If times are equal, preserve original sequence
  const seqA = parseInt(String(a.stop_sequence));
  const seqB = parseInt(String(b.stop_sequence));
  return seqA - seqB;
});
```

### Edge Case 2: Null Times (Skipped Stops)
```
Trip A stops at: Stop 1 (08:00), Stop 2 (08:05), Stop 3 (null), Stop 4 (08:15)

Problem: Where does Stop 3 go in sequence?
Solution: Keep null-time stops at end, or use interpolation
```

**Enhanced Algorithm:**
```typescript
const sortedStopTimes = [...stopTimes].sort((a, b) => {
  const timeA = a.arrival_time || a.departure_time;
  const timeB = b.arrival_time || b.departure_time;

  // Put null times at the end
  if (!timeA && !timeB) return 0;
  if (!timeA) return 1;
  if (!timeB) return -1;

  // Normal time comparison
  return timeA.localeCompare(timeB);
});
```

### Edge Case 3: Geographic Position (Future Enhancement)
Use stop coordinates to infer sequence when times are ambiguous:
```typescript
// Calculate distance along route using shape geometry
const distanceAlongRoute = calculateDistanceAlongRoute(stop_id, shape_id);
```

## Database Schema Context

### stop_times.txt Primary Key
```
Composite key: (trip_id, stop_sequence)
```

**Critical Constraint:** `stop_sequence` is part of the primary key!

This means:
- Cannot update `stop_sequence` in place
- Must DELETE + INSERT to change sequence
- All sequence changes require transaction (implemented in `renumberStopSequences`)

### Relationships
```
trips.txt
  ↓ (trip_id)
stop_times.txt
  ↓ (stop_id)
stops.txt
```

When adding a stop:
1. Check stop exists in stops.txt
2. Create stop_time records for all trips in timetable
3. Renumber sequences

When adding a trip:
1. Create trip record in trips.txt
2. Create stop_time records for all stops in supersequence
3. Refresh timetable to include new trip

## Testing Strategy

### Unit Tests (Need to Add)
- `renumberStopSequences()` with tied times
- `renumberStopSequences()` with null times
- `addStopToTrips()` with sequence insertion
- `addTrip()` with stop_time generation

### Integration Tests (Playwright)
1. **Add Stop Test**: Click add stop, select stop, enter time, verify insertion
2. **Add Trip Test**: Click add trip, fill form, verify new column appears
3. **Sequence Reorder Test**: Edit time to earlier value, verify row moves up
4. **Extended Fields Test**: Click gear icon, edit properties, verify save
5. **Trip Properties Test**: Click edit trip, modify headsign, verify update

### Performance Tests
- Add 50 stops to timetable with 20 trips (1000 stop_times)
- Measure renumbering time (should be <500ms)
- Test with 100+ stops, 100+ trips (10,000 stop_times)

## Next Steps

1. ✅ **Already Working**: Time editing, sequence renumbering, refresh
2. **High Priority**:
   - [ ] Add stop row at bottom
   - [ ] Add trip column
   - [ ] Extended field editing (gear icon modal)
3. **Medium Priority**:
   - [ ] Trip properties modal
   - [ ] Handle tied times in sequence algorithm
   - [ ] Handle null times in sequence algorithm
4. **Low Priority**:
   - [ ] Bulk operations (copy column, shift times)
   - [ ] Undo/redo support
   - [ ] Geographic-based sequence inference

## Resources

- GTFS stop_times.txt Reference: https://gtfs.org/schedule/reference/#stop_timestxt
- GTFS trips.txt Reference: https://gtfs.org/schedule/reference/#tripstxt
- Current Codebase:
  - `ScheduleController`: Line 75-596
  - `TimetableDatabase.renumberStopSequences()`: Line 438-503
  - `TimetableRenderer.renderTimetableBody()`: Line 216-263