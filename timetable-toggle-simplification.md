# Timetable Cell Link/Unlink Toggle Simplification

## ✅ IMPLEMENTATION COMPLETED

## Overview
The current toggle implementation is overly complex with unnecessary refreshes and state management. We need to simplify it to work entirely based on database state and real-time UI updates without full cell refreshes.

## ✅ Implementation Status

### Completed Changes:

1. **✅ Removed Complex State Management**
   - Deleted `data-ui-state` attributes from cell rendering
   - Removed `refreshTimetableCellComplete()` method entirely
   - Eliminated artificial state tracking

2. **✅ Added Database State Detection**
   - Implemented `isLinkedState(arrival_time, departure_time)` helper method
   - Database-driven state detection: linked if times are equal and both non-null

3. **✅ Created DOM Manipulation Helpers**
   - `createLinkedInput()`: Creates single linked input element with event handlers
   - `createUnlinkedInputs()`: Creates separate arrival/departure input elements
   - Proper event handler attachment and styling for each state

4. **✅ Implemented Direct DOM Swapping**
   - `swapToLinkedInput()`: Database update + DOM replacement for linking
   - `swapToUnlinkedInputs()`: Pure UI change for unlinking (no DB changes)
   - Uses `element.replaceWith()` for clean DOM manipulation

5. **✅ Enhanced Input Event Handlers**
   - Immediate input value updates without cell refreshes
   - Direct database updates for linked and individual time changes
   - Real-time UI feedback with input value synchronization

6. **✅ Simplified Toggle Logic**
   - `toggleTimesLink()` now uses pure database state detection
   - From linked → unlinked: No database changes, just UI swap
   - From unlinked → linked: Sets `departure_time = arrival_time` + UI swap

7. **✅ Simplified Initial Render**
   - `renderStackedArrivalDepartureCell()` uses database state detection
   - Removed `uiState` parameter and complex state logic
   - Always renders based on actual database values

8. **✅ Fixed Linking Logic**
   - `swapToLinkedInput()` now handles cases where arrival_time is empty
   - Uses arrival_time as primary, falls back to departure_time if needed
   - Sets both arrival_time and departure_time to the same value when linking

9. **✅ Fixed Toggle State Detection**
   - `toggleTimesLink()` now detects current UI state instead of database state
   - Looks for presence of `data-time-type="linked"` input to determine current mode
   - Fixes issue where unlinking didn't change database, causing incorrect state detection

## ✅ Issues Resolved
1. **✅ Over-engineered state management**: Removed `data-ui-state` attributes and complex refresh logic
2. **✅ Unnecessary refreshes**: Replaced with direct DOM manipulation and immediate input updates
3. **✅ Inconsistent behavior**: Now always reflects actual database state via `isLinkedState()`
4. **✅ Performance overhead**: Eliminated HTML regeneration, using efficient DOM swapping

## Simplified Requirements

### Initial Render (Database-Driven)
- **Linked State Detection**: If `arrival_time === departure_time` and both are not null, render as linked
- **Unlinked State Detection**: If times are different or only one exists, render as unlinked
- **Input Values**: Always populate from database values (`arrival_time`, `departure_time`)
- **No artificial state tracking**: Remove `data-ui-state` attributes

### Linked State Behavior
- **Display**: Single input showing the common time value
- **Editing**: When user types and exits input:
  - Save the new value to BOTH `arrival_time` AND `departure_time` in database
  - Update input value immediately (no refresh needed)
- **Link Button**: Shows "unlink" action with appropriate styling

### Unlinked State Behavior
- **Display**: Two separate inputs (arrival and departure)
- **Editing**: When user changes either input:
  - Save only the specific field (`arrival_time` OR `departure_time`) to database
  - Update only that input value immediately (no refresh needed)
- **Link Button**: Shows "link" action with appropriate styling

### Toggle Actions

#### From Linked to Unlinked
1. **Database**: No changes to time values
2. **UI**: Replace single input with two inputs populated with current values
3. **Implementation**: DOM manipulation to swap input elements

#### From Unlinked to Linked
1. **Database**: Set `departure_time = arrival_time` (use arrival as primary)
2. **UI**: Replace two inputs with single input showing the arrival time
3. **Implementation**: DOM manipulation to swap input elements

## Implementation Strategy

### 1. Remove Complex State Management
- Delete `data-ui-state` attributes
- Remove `refreshTimetableCellComplete` method
- Simplify `toggleTimesLink` method

### 2. Enhance Input Event Handlers
- **Linked input**: `onchange` updates both fields in database
- **Arrival input**: `onchange` updates only `arrival_time` in database
- **Departure input**: `onchange` updates only `departure_time` in database

### 3. Direct DOM Manipulation for Toggle
Instead of re-rendering HTML:
- Create helper methods: `showLinkedInput()`, `showUnlinkedInputs()`
- Use `replaceWith()` or similar DOM methods to swap input elements
- Preserve all event handlers and data attributes

### 4. Database State Detection Helper
```typescript
private isLinkedState(arrival_time: string | null, departure_time: string | null): boolean {
  return arrival_time === departure_time && arrival_time !== null && departure_time !== null;
}
```

## File Locations and Methods to Modify

### `/src/modules/schedule-controller.ts`

#### Methods to Simplify/Remove:
- `toggleTimesLink()` - Simplify to direct DOM manipulation
- `refreshTimetableCellComplete()` - Remove entirely
- `renderStackedArrivalDepartureCell()` - Simplify initial render logic

#### Methods to Add/Enhance:
- `createLinkedInput()` - Create single linked input element
- `createUnlinkedInputs()` - Create arrival/departure input pair
- `swapToLinkedInput()` - DOM swap for link action
- `swapToUnlinkedInputs()` - DOM swap for unlink action
- Enhanced `updateLinkedTime()` - Update both fields
- Enhanced `updateArrivalDepartureTime()` - Update single field

### Key Database Operations
- **Link action**: `UPDATE stop_times SET departure_time = arrival_time WHERE...`
- **Unlink action**: No database changes
- **Linked input change**: `UPDATE stop_times SET arrival_time = ?, departure_time = ? WHERE...`
- **Single input change**: `UPDATE stop_times SET [field] = ? WHERE...`

## Expected Behavior Flow

### Scenario 1: Initial Render (Linked Times)
1. Database has `arrival_time = "08:30:00"`, `departure_time = "08:30:00"`
2. Render single input with value "08:30:00"
3. Button shows "unlink" state

### Scenario 2: User Edits Linked Time
1. User changes input to "08:35:00" and exits
2. Database updated: `arrival_time = "08:35:00"`, `departure_time = "08:35:00"`
3. Input shows "08:35:00", no refresh needed

### Scenario 3: User Clicks Unlink
1. DOM swapped: single input → two inputs
2. Arrival input shows "08:35:00", departure input shows "08:35:00"
3. Button shows "link" state
4. No database changes

### Scenario 4: User Edits Departure Time
1. User changes departure input to "08:37:00"
2. Database updated: `departure_time = "08:37:00"` (arrival unchanged)
3. Departure input shows "08:37:00", no refresh needed

### Scenario 5: User Clicks Link (Different Times)
1. Database updated: `departure_time = "08:35:00"` (copied from arrival)
2. DOM swapped: two inputs → single input showing "08:35:00"
3. Button shows "unlink" state

## Performance Benefits
- **No HTML regeneration**: Direct DOM manipulation only
- **No full refreshes**: Immediate input updates
- **Simpler state logic**: Database-driven, no artificial state tracking
- **Better UX**: Instant feedback, no UI flicker

## Technical Notes
- Use `element.replaceWith()` for clean DOM swapping
- Preserve `data-trip-id` and `data-stop-id` attributes on all inputs
- Maintain consistent CSS classes for styling
- Keep existing keyboard navigation and validation logic
- Ensure proper event handler attachment after DOM changes

## Testing Scenarios
1. Initial render with identical times (should show linked)
2. Initial render with different times (should show unlinked)
3. Initial render with one null time (should show unlinked)
4. Toggle from linked to unlinked (no database changes)
5. Toggle from unlinked to linked (departure copies arrival)
6. Edit linked time (updates both fields)
7. Edit individual times when unlinked (updates only that field)
8. Multiple rapid toggles (should be stable)
9. Toggle with keyboard navigation
10. Toggle with empty/null times

This simplified approach eliminates the current complexity while providing the exact behavior the user requested: pure UI state changes for unlinking, and logical database updates for linking.