# Trip Properties Editing

**Status**: 🔴 Not Started
**Priority**: Medium
**Estimated Effort**: Medium (3-5 days)

## Overview
Enable inline editing of trip properties within the timetable view. Following the same pattern as the stop page, trip properties should be displayed as rows at the top of the timetable with labels in the first column and input fields in subsequent columns (one for each trip). The stop rows will follow below the property rows.

## Checklist

### Planning & Design
- [ ] Review stop page implementation pattern in `stop-view-controller.ts`
- [ ] Review timetable structure in `timetable-renderer.ts` and `schedule-controller.ts`
- [ ] Identify all GTFS trip properties from `TripsSchema` in `gtfs.ts`
- [ ] Design property row layout (label column + trip columns)
- [ ] Decide which properties to show by default vs. advanced/optional

### Core Implementation
- [ ] Create `TripPropertyRow` component or rendering function
- [ ] Update timetable header to include property rows before stop rows
- [ ] Implement field generation using `generateFieldConfigsFromSchema()` with `TripsSchema`
- [ ] Add property row rendering with `renderFormFields()` utility
- [ ] Implement horizontal scrolling coordination between property rows and time cells

### Data Integration
- [ ] Wire up property updates to `gtfsDatabase.updateRow()` for trips table
- [ ] Implement auto-save functionality on property field changes
- [ ] Add validation for trip properties using Zod schema
- [ ] Handle type conversions (string to number for enums, etc.)

### UI/UX Polish
- [ ] Style property rows to distinguish from stop time rows
- [ ] Add tooltips from GTFS schema descriptions
- [ ] Implement responsive layout for narrow screens
- [ ] Add loading states during property updates
- [ ] Show success/error notifications for property changes

### Testing
- [ ] Test property editing with various trip counts (1, 5, 20+ trips)
- [ ] Test with long trip property values (e.g., long headsigns)
- [ ] Test enum fields (direction_id, wheelchair_accessible, bikes_allowed)
- [ ] Test optional vs required field handling
- [ ] Test scroll synchronization between property rows and time cells
- [ ] Test with trips that have missing/null property values

### Documentation
- [ ] Document property row implementation pattern
- [ ] Add code comments explaining layout structure
- [ ] Update user-facing documentation (if any)

## Current Implementation Context

### GTFS Trips Properties
From `src/types/gtfs.ts` - `TripsSchema`:

**Required Properties:**
- `route_id` - Identifies the route (fixed, shouldn't be editable in timetable)
- `service_id` - Identifies service dates (fixed, timetable is already filtered by service)
- `trip_id` - Unique trip identifier (fixed, primary key)

**Editable Properties:**
- `trip_headsign` (string, optional) - Destination signage text
- `trip_short_name` (string, optional) - Public-facing trip identifier (e.g., train numbers)
- `direction_id` (number 0|1, optional) - Direction of travel (0=outbound, 1=inbound)
- `block_id` (string, optional) - Identifies vehicle block for sequential trips
- `shape_id` (string, optional) - References geographic path from shapes.txt
- `wheelchair_accessible` (number 0|1|2, optional) - Wheelchair accessibility indicator
- `bikes_allowed` (number 0|1|2, optional) - Bicycle accommodation indicator

### Stop Page Pattern (Reference)
From `src/modules/stop-view-controller.ts`:

The stop page uses:
1. **Schema-driven field generation**: `generateFieldConfigsFromSchema(StopsSchema, stop, GTFS_TABLES.STOPS)`
2. **Reusable field components**: `renderFormFields(fieldConfigs)`
3. **Auto-save on change**: `attachFieldEventListeners(container, async (field, value) => {...})`
4. **Type conversion**: Handles string→number conversions for lat/lon, enums
5. **Validation**: Uses Zod schema for validation
6. **Notifications**: Shows success/error messages for updates

### Timetable Structure (Current)
From `src/modules/timetable-renderer.ts`:

Current timetable layout:
```
┌───────────────┬──────┬──────┬──────┬──────┐
│ Stop          │ T001 │ T002 │ T003 │ +New │  ← Header row (stop names)
├───────────────┼──────┼──────┼──────┼──────┤
│ Stop A        │ 8:00 │ 8:30 │ 9:00 │      │  ← Stop time rows
│ Stop B        │ 8:15 │ 8:45 │ 9:15 │      │
│ Stop C        │ 8:30 │ 9:00 │ 9:30 │      │
│ + Add Stop    │      │      │      │      │  ← Add stop row
└───────────────┴──────┴──────┴──────┴──────┘
```

**Proposed timetable layout with properties:**
```
┌───────────────┬──────────┬──────────┬──────────┬──────┐
│ Property      │   T001   │   T002   │   T003   │ +New │  ← Header (trip IDs)
├───────────────┼──────────┼──────────┼──────────┼──────┤
│ Headsign      │ Downtown │ Uptown   │ Downtown │      │  ← Property rows
│ Short Name    │ 101      │ 102      │ 103      │      │
│ Direction     │ 0        │ 1        │ 0        │      │
│ Wheelchair    │ 1        │ 1        │ 2        │      │
│ Bikes         │ 1        │ 0        │ 1        │      │
│ Block ID      │ A        │ A        │ B        │      │
├───────────────┼──────────┼──────────┼──────────┼──────┤  ← Visual separator
│ Stop A        │ 08:00:00 │ 08:30:00 │ 09:00:00 │      │  ← Stop time rows
│ Stop B        │ 08:15:00 │ 08:45:00 │ 09:15:00 │      │
│ Stop C        │ 08:30:00 │ 09:00:00 │ 09:30:00 │      │
│ + Add Stop    │          │          │          │      │
└───────────────┴──────────┴──────────┴──────────┴──────┘
```

## Proposed Implementation

### 1. Property Row Data Structure

```typescript
interface TripPropertyRowConfig {
  field: string;           // GTFS field name (e.g., 'trip_headsign')
  label: string;           // Display label (e.g., 'Headsign')
  type: 'text' | 'number' | 'select';
  options?: Array<{ value: string | number; label: string }>;
  tooltip?: string;        // From GTFS schema description
  required?: boolean;
}
```

### 2. Property Row Rendering

Create a new utility in `timetable-renderer.ts`:

```typescript
/**
 * Render trip property rows at the top of the timetable
 */
private renderTripPropertyRows(
  trips: Trip[],
  propertyConfigs: TripPropertyRowConfig[]
): string {
  return propertyConfigs.map(config => {
    const cells = trips.map(trip => {
      const value = trip[config.field] ?? '';
      return this.renderPropertyCell(trip.trip_id, config, value);
    }).join('');

    return `
      <tr class="trip-property-row" data-property="${config.field}">
        <td class="property-label sticky left-0 bg-base-100 font-medium">
          <div class="flex items-center gap-2">
            <span>${config.label}</span>
            ${config.tooltip ? `
              <div class="tooltip tooltip-right" data-tip="${escapeHtml(config.tooltip)}">
                <svg class="w-4 h-4 opacity-50">...</svg>
              </div>
            ` : ''}
          </div>
        </td>
        ${cells}
        <td></td> <!-- Empty cell for "Add Trip" column -->
      </tr>
    `;
  }).join('');
}

/**
 * Render individual property cell with appropriate input type
 */
private renderPropertyCell(
  trip_id: string,
  config: TripPropertyRowConfig,
  value: string | number
): string {
  const inputId = `trip-prop-${trip_id}-${config.field}`;

  if (config.type === 'select' && config.options) {
    return `
      <td class="property-cell">
        <select
          id="${inputId}"
          class="select select-sm select-bordered w-full trip-property-input"
          data-trip-id="${trip_id}"
          data-field="${config.field}">
          <option value="">-</option>
          ${config.options.map(opt => `
            <option value="${opt.value}" ${value == opt.value ? 'selected' : ''}>
              ${opt.label}
            </option>
          `).join('')}
        </select>
      </td>
    `;
  } else if (config.type === 'number') {
    return `
      <td class="property-cell">
        <input
          id="${inputId}"
          type="number"
          class="input input-sm input-bordered w-full trip-property-input"
          data-trip-id="${trip_id}"
          data-field="${config.field}"
          value="${value}" />
      </td>
    `;
  } else {
    // text input
    return `
      <td class="property-cell">
        <input
          id="${inputId}"
          type="text"
          class="input input-sm input-bordered w-full trip-property-input"
          data-trip-id="${trip_id}"
          data-field="${config.field}"
          value="${escapeHtml(value.toString())}"
          placeholder="${config.label}" />
      </td>
    `;
  }
}
```

### 3. Schema-Driven Property Configuration

Use the existing field generation utility with `TripsSchema`:

```typescript
/**
 * Generate property row configurations from TripsSchema
 */
private generateTripPropertyConfigs(trips: Trip[]): TripPropertyRowConfig[] {
  // Get sample trip for current values
  const sampleTrip = trips[0] || {};

  // Generate field configs from schema
  const fieldConfigs = generateFieldConfigsFromSchema(
    TripsSchema,
    sampleTrip,
    GTFS_TABLES.TRIPS
  );

  // Filter out non-editable fields and convert to property row format
  return fieldConfigs
    .filter(fc => !['route_id', 'service_id', 'trip_id'].includes(fc.field))
    .map(fc => ({
      field: fc.field,
      label: fc.label,
      type: fc.type === 'enum' ? 'select' : fc.type === 'number' ? 'number' : 'text',
      options: fc.options,
      tooltip: fc.description,
      required: fc.required
    }));
}
```

### 4. Event Handling for Property Updates

Add event listeners in `schedule-controller.ts` or `timetable-renderer.ts`:

```typescript
/**
 * Attach event listeners to trip property inputs
 */
private attachPropertyEventListeners(container: HTMLElement): void {
  const propertyInputs = container.querySelectorAll('.trip-property-input');

  propertyInputs.forEach(input => {
    // Auto-save on blur (when user leaves field)
    input.addEventListener('blur', async (event) => {
      const target = event.target as HTMLInputElement | HTMLSelectElement;
      const trip_id = target.dataset.tripId;
      const field = target.dataset.field;
      const newValue = target.value;

      if (!trip_id || !field) return;

      await this.updateTripProperty(trip_id, field, newValue);
    });

    // Also save on Enter key
    input.addEventListener('keydown', async (event) => {
      if (event.key === 'Enter') {
        const target = event.target as HTMLInputElement | HTMLSelectElement;
        target.blur(); // Trigger blur event which handles save
      }
    });
  });
}

/**
 * Update trip property in database
 */
private async updateTripProperty(
  trip_id: string,
  field: string,
  newValue: string
): Promise<void> {
  try {
    // Type conversion based on field
    let processedValue: unknown = newValue;

    if (['direction_id', 'wheelchair_accessible', 'bikes_allowed'].includes(field)) {
      // Enum fields - convert to number or null
      processedValue = newValue ? parseInt(newValue) : null;
    } else if (newValue === '') {
      // Empty string → null for optional fields
      processedValue = null;
    }

    // Validate with schema
    const partialTrip = { [field]: processedValue };
    const validationResult = TripsSchema.partial().safeParse(partialTrip);

    if (!validationResult.success) {
      notifications.showError(`Invalid value for ${field}: ${validationResult.error.message}`);
      return;
    }

    // Update database
    await this.dependencies.gtfsDatabase.updateRow(
      'trips',
      trip_id,
      { [field]: processedValue }
    );

    // Success notification
    notifications.showSuccess(
      `Updated ${field} for trip ${trip_id}`,
      { duration: 2000 }
    );

  } catch (error) {
    console.error('Error updating trip property:', error);
    notifications.showError(`Failed to update ${field}`);
  }
}
```

### 5. Styling & Layout

Add CSS to distinguish property rows from time rows:

```css
/* Trip property rows */
.trip-property-row {
  background-color: hsl(var(--b2)); /* Slightly different background */
  border-bottom: 1px solid hsl(var(--bc) / 0.1);
}

.trip-property-row:last-of-type {
  border-bottom: 2px solid hsl(var(--bc) / 0.2); /* Thicker border before stop rows */
}

.property-label {
  font-weight: 600;
  min-width: 150px;
  padding: 0.5rem;
}

.property-cell {
  padding: 0.25rem;
  min-width: 120px;
}

.trip-property-input {
  font-size: 0.875rem;
  height: 2rem;
}

/* Ensure property rows scroll with trip columns */
.timetable-container {
  overflow-x: auto;
}
```

### 6. Integration Points

#### In `timetable-renderer.ts`:
- Add `renderTripPropertyRows()` method
- Call it before rendering stop time rows
- Pass trip data and property configs

#### In `schedule-controller.ts`:
- Initialize property event listeners after render
- Handle property updates via database
- Trigger re-render if needed (or use optimistic updates)

#### In `gtfs-database.ts`:
- Ensure `updateRow()` supports trips table
- Add validation for trip updates

## Testing Scenarios

### Basic Functionality
- [ ] Property rows appear above stop time rows
- [ ] Property values display correctly for each trip
- [ ] Editing a property updates the database
- [ ] Success notification appears on save
- [ ] Error notification appears on invalid input

### Edge Cases
- [ ] Trips with null/missing properties (should show empty/placeholder)
- [ ] Very long headsign text (should wrap or truncate gracefully)
- [ ] Invalid enum values (should show validation error)
- [ ] Concurrent edits to different properties (should not conflict)
- [ ] Editing properties while adding/removing trips

### UI/UX
- [ ] Property rows stay aligned with trip columns when scrolling
- [ ] Labels remain visible when scrolling horizontally (sticky column)
- [ ] Tooltips show GTFS descriptions on hover
- [ ] Input fields have appropriate size and styling
- [ ] Tab navigation works logically through fields

### Performance
- [ ] Rendering 50+ trips with all properties is performant
- [ ] Property updates don't cause unnecessary re-renders
- [ ] Scroll performance is smooth

## Potential Challenges

### 1. Horizontal Scroll Synchronization
**Challenge**: Property row cells must align perfectly with trip columns and scroll together.

**Solution**: Use CSS grid or table layout with consistent column widths. Ensure property cells have same width as time cells.

### 2. Variable Column Widths
**Challenge**: Different properties have different natural widths (e.g., headsign vs direction_id).

**Solution**:
- Option A: Fixed column width for all trips (simplest)
- Option B: Each trip column can have variable width, but must be consistent vertically
- Recommendation: Use fixed width (120px) for consistency

### 3. Optional vs Required Properties
**Challenge**: Some trips may not have values for optional properties.

**Solution**:
- Show all property rows for all trips (consistency)
- Use placeholders for empty values
- Allow clearing values by deleting input text

### 4. Adding New Trips
**Challenge**: New trips need default values for all properties.

**Solution**:
- When adding trip, create with only required fields (route_id, service_id, trip_id)
- Property rows will show empty inputs for optional fields
- User can fill in as needed

### 5. Property Row Order
**Challenge**: Which properties should appear first?

**Solution**: Order by importance/frequency of use:
1. `trip_headsign` (most commonly used)
2. `trip_short_name` (important for commuter rail)
3. `direction_id` (very common)
4. `wheelchair_accessible` (accessibility)
5. `bikes_allowed` (accessibility)
6. `block_id` (advanced/operational)
7. `shape_id` (advanced/geographical)

## Alternative Approaches Considered

### Alternative 1: Modal/Sidebar for Trip Properties
**Approach**: Click trip header to open modal with all properties.

**Pros**:
- Simpler layout (no extra rows)
- More space for property editing
- Can show more detailed help text

**Cons**:
- Requires extra click to edit
- Can't see multiple trip properties side-by-side
- Doesn't follow "inline editing" pattern from stop page

**Verdict**: Rejected. Inline editing is more efficient for bulk edits.

### Alternative 2: Collapsible Property Section
**Approach**: Add expand/collapse button to show/hide property rows.

**Pros**:
- Reduces clutter when properties not needed
- Preserves inline editing when expanded
- Good for users who mainly edit times

**Cons**:
- More complex implementation
- Requires UI state management for collapse state
- May hide important info

**Verdict**: Could be added as enhancement later, but not for initial implementation.

### Alternative 3: Properties in Column Headers
**Approach**: Show properties vertically in trip column headers.

**Pros**:
- No extra rows needed
- Very compact

**Cons**:
- Limited space in headers
- Vertical text is hard to read
- Difficult to edit inline

**Verdict**: Rejected. Not readable or editable.

## Future Enhancements

- [ ] Bulk edit: Select multiple trips and edit property for all at once
- [ ] Copy properties from one trip to another
- [ ] Smart defaults: Auto-fill direction_id based on headsign, etc.
- [ ] Property validation: Warn if direction_id doesn't match typical pattern
- [ ] Filter/hide properties: Let users choose which properties to show
- [ ] Property history: Show changes over time (audit log)
- [ ] Template trips: Create trip from template with pre-filled properties

## Related Files

### Primary Files to Modify
- `src/modules/timetable-renderer.ts` - Add property row rendering
- `src/modules/schedule-controller.ts` - Add event listeners and update logic
- `src/types/gtfs.ts` - Reference `TripsSchema` for field definitions

### Utility Files to Reuse
- `src/utils/field-component.ts` - Field generation utilities
- `src/modules/notification-system.ts` - Notifications

### Reference Files
- `src/modules/stop-view-controller.ts` - Pattern for property editing
- `src/modules/timetable-data-processor.ts` - Trip data processing

## Resources

- [GTFS trips.txt Reference](https://gtfs.org/schedule/reference/#tripstxt)
- Stop page implementation: `src/modules/stop-view-controller.ts:106-130`
- Field component utilities: `src/utils/field-component.ts`
- Current timetable rendering: `src/modules/timetable-renderer.ts`

## Success Criteria

Implementation is complete when:
1. ✅ All trip properties from `TripsSchema` are displayed as editable rows
2. ✅ Property labels use same field component pattern as stop page
3. ✅ Properties appear before stop time rows in timetable
4. ✅ Changes are saved automatically to database with validation
5. ✅ Tooltips show GTFS descriptions for each property
6. ✅ Layout scrolls correctly and maintains alignment
7. ✅ Error handling and notifications work properly
8. ✅ UI is responsive and performs well with 20+ trips

---

*Plan created: 2025-10-05*
