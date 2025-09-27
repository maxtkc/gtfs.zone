# Timetable Stacked Layout Implementation Plan

## Overview
Implement the stacked arrival/departure time layout from the workshop ideas into the actual timetable. Use vertical stacking with link button functionality, remove ARR/DEP labels to save space, and show full HH:MM:SS format.

## Implementation Checklist

### ✅ Completed
- [x] Created workshop ideas file with stacked layout concept
- [x] Refined stacked layout design without ARR/DEP labels
- [x] Defined visual states (linked vs unlinked times)
- [x] Created new `renderStackedArrivalDepartureCell` method
- [x] Removed ARR/DEP labels from cell layout to save space
- [x] Implemented link button functionality for same arrival/departure times
- [x] Updated cell styling to match daisyui theme
- [x] Handle skipped stops in stacked layout
- [x] Updated time formatting to always show HH:MM:SS (`formatTimeWithSeconds`)
- [x] Added link/unlink button state management (`toggleTimesLink`)
- [x] Updated table header for single column stacked layout
- [x] Updated render logic to use stacked method instead of double columns
- [x] Made stacked layout always show (removed conditional logic)
- [x] Updated both rendering paths to always use stacked cells
- [x] Simplified `shouldShowSeparateArrivalDeparture` to always return true
- [x] **REFINED UI**: Single input when linked, dual inputs when unlinked
- [x] **Removed skip buttons**: Use empty inputs instead
- [x] **Added `updateLinkedTime`**: Method for single input updates both times
- [x] **Empty input handling**: Clear times by leaving inputs empty

### 🚧 In Progress
- [ ] Final testing and validation

### 📋 To Do
- [ ] Ensure keyboard navigation works with stacked inputs
- [ ] Fix any layout/styling issues discovered during testing

## Technical Details

### Current Method to Modify
- `renderEditableArrivalDepartureCell()` in `schedule-controller.ts:1500-1573`
- This method currently renders separate cells for arrival/departure
- Need to change to render single cell with stacked inputs

### Design Specifications
- **Layout**: Vertical stack with arrival input on top, departure below
- **Time Format**: Always show HH:MM:SS (not HH:MM)
- **Link Button**: On right side of arrival input, shows linked state when arrival == departure
- **No Labels**: Remove "ARR" and "DEP" text to save horizontal space
- **Colors**: Blue background for arrival input, orange for departure input
- **Spacing**: Compact but readable spacing between stacked inputs

### Link Button States
- **Linked** (arrival == departure): `btn-primary` style, fully opaque
- **Unlinked** (different times): `btn-ghost` style, reduced opacity
- **Function**: Click to toggle link state, sync times when linking

### Cell Structure
```html
<td class="time-cell">
  <div class="stacked-time-container">
    <!-- Arrival input row -->
    <div class="flex items-center gap-1">
      <input type="text" class="arrival-input" value="08:15:00" />
      <button class="link-btn">🔗</button>
    </div>
    <!-- Departure input row -->
    <div class="flex items-center gap-1">
      <input type="text" class="departure-input" value="08:15:00" />
      <div class="spacer"></div>
    </div>
  </div>
</td>
```

## Files to Update
- `src/modules/schedule-controller.ts` - Main rendering method
- Possibly CSS in `src/styles/main.css` if custom styling needed

## Testing Scenarios
- [ ] Same arrival/departure times (linked state)
- [ ] Different arrival/departure times (unlinked state)
- [ ] Skipped stops
- [ ] Empty times
- [ ] Time validation and editing
- [ ] Link button toggle functionality
- [ ] Keyboard navigation between inputs

## Notes
- Keep existing functionality for single-column mode as fallback
- Maintain backward compatibility with current data structure
- Ensure accessibility with proper ARIA labels
- Consider mobile responsiveness of stacked layout