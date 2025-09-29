# Edit Stops Feature Plan

## Overview
Create an edit button that allows users to drag stops to new locations on the map, following the same pattern as the existing add stop button.

## Current Add Stop Button Analysis

### Implementation Pattern
- **Location**: Map tools area in `/src/index.html` (next to add stop button)
- **Button**: Square button with icon, using DaisyUI tooltip
- **State Management**: Uses `MapMode` enum (`NAVIGATE`, `ADD_STOP`)
- **UI Controller**: `toggleAddStopMode()` method in `/src/modules/ui.ts`
- **Map Controller**: `toggleAddStopMode()` and `setMapMode()` methods
- **Visual Feedback**: Button gets `btn-active` class and icon rotates 45deg when active

### Key Components
1. **HTML Button**: Square button with SVG icon and tooltip
2. **Event Listener**: Click handler in `UIController.setupEventListeners()`
3. **Mode Toggle**: Updates map mode and button state
4. **Mode Callback**: Updates UI when mode changes
5. **State Updates**: Visual feedback for active/inactive states

## Edit Stops Feature Design

### 1. New Map Mode
- Add `EDIT_STOPS = 'edit_stops'` to `MapMode` enum
- This mode will enable draggable stop markers

### 2. UI Button
- **Location**: Next to add stop button in map tools
- **Icon**: Edit/pencil icon (different from add icon)
- **Tooltip**: "Edit stops" / "Exit edit mode"
- **Behavior**: Toggle between NAVIGATE and EDIT_STOPS modes

### 3. Draggable Stop Functionality
- **When in EDIT_STOPS mode**: All stop markers become draggable
- **Drag Interaction**: Use MapLibre GL's drag functionality
- **Visual Feedback**:
  - Cursor changes to move cursor on hover
  - Stop marker slightly enlarges when being dragged
  - Real-time coordinate updates

### 4. Database Updates
- **On Drag End**: Update stop coordinates in GTFS database
- **Validation**: Ensure coordinates are valid lat/lng
- **Notifications**: Show success/error messages for updates

## Implementation Steps

### Step 1: Add Edit Mode to Map Controller
- [ ] Add `EDIT_STOPS` to `MapMode` enum
- [ ] Create `toggleEditStopsMode()` method
- [ ] Add `setEditStopsMode()` private method
- [ ] Update mode change callback handling

### Step 2: Create Edit Button in UI
- [ ] Add edit button HTML next to add stop button
- [ ] Add event listener in `UIController.setupEventListeners()`
- [ ] Create `toggleEditStopsMode()` method in UIController
- [ ] Create `updateEditStopsButtonState()` method for visual feedback

### Step 3: Implement Draggable Stops
- [ ] Add draggable property to stop markers when in edit mode
- [ ] Implement drag start, drag, and drag end handlers
- [ ] Add visual feedback during drag operations
- [ ] Ensure drag only works in EDIT_STOPS mode

### Step 4: Database Integration
- [ ] Create method to update stop coordinates in GTFSParser
- [ ] Add validation for coordinate updates
- [ ] Implement error handling for database updates
- [ ] Add notifications for successful/failed updates

### Step 5: Testing & Polish
- [ ] Test mode switching between all modes
- [ ] Test drag functionality with various stop datasets
- [ ] Ensure UI state consistency
- [ ] Test database updates and persistence
- [ ] Verify map updates reflect coordinate changes

## Code Locations

### Files to Modify
1. `/src/modules/map-controller.ts` - Add edit mode and draggable functionality
2. `/src/modules/ui.ts` - Add edit button and state management
3. `/src/index.html` - Add edit button HTML
4. `/src/modules/gtfs-parser.ts` - Add stop coordinate update method

### Key Methods to Add
- `MapController.toggleEditStopsMode()`
- `MapController.setEditStopsMode()`
- `MapController.makeStopsDraggable()`
- `UIController.toggleEditStopsMode()`
- `UIController.updateEditStopsButtonState()`
- `GTFSParser.updateStopCoordinates()`

## Progress Tracking

- [x] **Analysis Complete**: Understand add stop button pattern
- [x] **Plan Created**: Document implementation approach
- [x] **Map Mode Added**: EDIT_STOPS mode implementation
  - Added `EDIT_STOPS` to `MapMode` enum
  - Updated `setMapMode()` to handle new mode with 'move' cursor
  - Added `toggleEditStopsMode()` method
  - Added `updateStopInteractivity()` method (placeholder for draggable logic)
- [x] **UI Button Added**: Edit button with event handlers
  - Added edit button HTML with pencil icon next to add stop button
  - Added event listener for edit button clicks
  - Created `toggleEditStopsMode()` method in UIController
  - Created `updateEditStopsButtonState()` method for visual feedback
  - Updated `setupMapCallbacks()` to handle both buttons
  - Button shows active state with scale transform and tooltip changes
- [x] **Drag Functionality**: Draggable stop markers
  - Implemented `enableStopDragging()` and `disableStopDragging()` methods
  - Added mouse event handlers for drag start, move, and end
  - Cursor changes: grab → grabbing → move based on interaction state
  - Visual feedback: stops enlarge and fade when being dragged
  - Real-time coordinate updates during drag operations
  - Proper cleanup of drag state and event listeners
  - Feature state management for individual stop highlighting
- [x] **Database Updates**: Coordinate persistence
  - Added `updateStopCoordinates()` method to GTFSParser
  - Comprehensive coordinate validation (NaN, range checks)
  - Updates in-memory data, database, and regenerates CSV content
  - Error handling with descriptive error messages
  - Success/error notifications shown to user
  - Automatic map refresh on update failures to revert visual changes
  - Follows same pattern as existing `createStop()` method
- [x] **Testing Complete**: Full functionality tested
  - ✅ Edit button appears correctly next to add stop button
  - ✅ Button state toggles properly (active/inactive visual feedback)
  - ✅ Tooltip changes correctly ("Edit stops" / "Exit edit stops mode")
  - ✅ Console logging confirms mode changes
  - ✅ GTFS data loads successfully with visible stops on map
  - ✅ Edit mode activation confirmed via browser testing
  - ✅ Stop dragging functionality confirmed working by user
  - ✅ Application builds without errors
  - ✅ All TypeScript types compile correctly
  - ✅ Integration between all components successful

## Notes
- Follow DaisyUI design patterns for consistency
- Use existing notification system for user feedback
- Ensure accessibility with proper tooltips and focus states
- Consider adding keyboard shortcuts for power users
- Maintain backwards compatibility with existing functionality