# Map Controls Enhancement Plan

## Overview
Add clean, modern map controls to improve the map interaction experience. Start with an "Add Stop" button that allows users to click on the map to create new stops.

## Goals
- [ ] Create a clean, DaisyUI-themed map controls panel
- [ ] Implement "Add Stop" functionality with map click interaction
- [ ] Ensure proper integration with existing GTFS data management
- [ ] Maintain consistency with the current design system
- [ ] Follow the project's error handling policy (fail hard, no fallbacks)

## Implementation Plan

### 1. UI Design & Structure
- [ ] **Design map controls panel**
  - Use DaisyUI components for consistent theming
  - Position controls in top-right corner (below existing search)
  - Create button group with proper spacing and hover states
  - Use custom CSS properties from the project's color scheme

- [ ] **Add Stop button design**
  - Clean button with stop/plus icon
  - Toggle state (active/inactive) with visual feedback
  - Tooltip explaining functionality
  - Disabled state when no GTFS data is loaded

### 2. Map Interaction System
- [ ] **Create MapMode management**
  - Add `MapMode` enum/type for different interaction modes
  - Implement mode switching functionality
  - Handle cursor changes based on active mode
  - Ensure proper cleanup when switching modes

- [ ] **Add Stop mode implementation**
  - Enable click-to-add-stop when mode is active
  - Show crosshair cursor during add mode
  - Disable existing click handlers for stops/routes when in add mode
  - Add visual feedback for where stop will be placed

### 3. Stop Creation Logic
- [ ] **Map click handler for new stops**
  - Capture lat/lng coordinates from map click
  - Generate unique stop_id following GTFS conventions
  - Create stop object with required GTFS fields
  - Integrate with existing GTFSParser data management

- [ ] **Stop data validation**
  - Use existing Zod schemas for stop validation
  - Ensure all required fields are present
  - Follow GTFS specification for stop properties
  - Handle validation errors according to project policy

- [ ] **Database integration**
  - Add new stop to IndexedDB via GTFSDatabase
  - Update stops.txt file data
  - Trigger map refresh to show new stop
  - Update related UI components (file list, objects navigation)

### 4. User Experience Enhancements
- [ ] **Visual feedback system**
  - Show temporary marker during hover in add mode
  - Animate new stop creation with smooth transition
  - Provide success notification after stop creation
  - Handle edge cases (clicking on existing features)

- [ ] **Stop editing workflow**
  - After creating stop, automatically switch to edit mode
  - Pre-populate stop name field for editing
  - Allow immediate property editing in right panel
  - Provide undo functionality for accidental creation

### 5. Code Integration
- [ ] **Update MapController class**
  - Add map mode management methods
  - Implement stop creation functionality
  - Update click handler to respect current mode
  - Add proper TypeScript interfaces

- [ ] **Update GTFSParser integration**
  - Add methods for creating new stops
  - Ensure proper data synchronization
  - Update file change tracking
  - Trigger validation after stop creation

- [ ] **UI Controller updates**
  - Add map controls to existing UI
  - Handle button state management
  - Integrate with notification system
  - Update keyboard shortcuts if needed

### 6. Styling & Theme Integration
- [ ] **DaisyUI component usage**
  - Use btn, btn-group, tooltip components
  - Follow existing color scheme variables
  - Ensure dark/light theme compatibility
  - Add proper hover and active states

- [ ] **CSS custom properties**
  - Use existing oklch color variables
  - Maintain consistency with existing styles
  - Add new utility classes if needed
  - Ensure responsive design

## Technical Requirements

### File Modifications Required
1. **src/modules/map-controller.ts**
   - Add MapMode enum and state management
   - Implement stop creation functionality
   - Update click handlers with mode awareness

2. **src/modules/gtfs-parser.ts**
   - Add createStop() method
   - Integrate with existing data management
   - Update file tracking for stops.txt

3. **src/index.html**
   - Add map controls HTML structure
   - Include new button elements
   - Add proper accessibility attributes

4. **src/styles/main.css**
   - Add map controls styling
   - Create button group styles
   - Add mode-specific cursor styles

5. **src/modules/ui.ts**
   - Add button event handlers
   - Integrate with existing UI state
   - Handle mode switching

### Dependencies
- Use existing MapLibre GL for map interactions
- Leverage current DaisyUI component system
- Integrate with existing Zod validation schemas
- Use current IndexedDB data management

### Data Flow
1. User clicks "Add Stop" button
2. Map enters add-stop mode (cursor changes, click handlers update)
3. User clicks on map location
4. Coordinates captured and validated
5. New stop object created with GTFS-compliant data
6. Stop added to database and stops.txt
7. Map refreshed to show new stop
8. User notified of successful creation
9. Mode resets to normal navigation

## Implementation Notes

### Error Handling
- Follow project policy: fail hard, no fallbacks
- Show descriptive errors for validation failures
- Log errors prominently for developer visibility
- Never silently degrade functionality

### GTFS Compliance
- Generate stop_id following GTFS conventions
- Ensure all required fields are populated
- Use proper coordinate formatting (lat/lng)
- Maintain data integrity with existing stops

### Performance Considerations
- Minimal impact on existing map performance
- Efficient click handler management
- Proper cleanup of event listeners
- Optimize map refresh after stop creation

## Future Enhancements (Out of Scope)
- Edit Stop mode (modify existing stops)
- Delete Stop functionality
- Add Route drawing capability
- Bulk stop operations
- Import stops from external sources

## Success Criteria
- [ ] Clean, themed map controls panel
- [ ] Functional "Add Stop" button with proper states
- [ ] Click-to-create stop functionality working
- [ ] New stops properly integrated with data system
- [ ] No impact on existing map functionality
- [ ] Consistent with project design patterns
- [ ] Proper error handling and validation
- [ ] Good user experience with visual feedback