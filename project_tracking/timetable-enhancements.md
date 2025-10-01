# Timetable Enhancements

**Status:** 📋 Planned
**Priority:** Medium
**Complexity:** Medium
**Related Files:**
- `src/modules/schedule-controller.ts` - Main timetable orchestration
- `src/modules/timetable-renderer.ts` - HTML rendering
- `src/modules/timetable-cell-renderer.ts` - Cell rendering
- `src/modules/timetable-data-processor.ts` - Data processing
- `src/styles/main.css` - Timetable styling

## Overview

Enhancement features for the timetable view to improve usability, navigation, and visual presentation. These are non-editing features that make the timetable more intuitive and easier to work with.

## Current State

The timetable view currently supports:
- ✅ Direction tabs for multi-direction routes
- ✅ Sticky headers and stop column
- ✅ Editable time cells with linked/unlinked modes
- ✅ Alternating row colors for readability
- ✅ Monospace font for time values
- ✅ Trip headers with headsign/ID display

## Planned Enhancements

### 1. Click Stop to Navigate to Stop Page

**Goal:** Allow users to click a stop name in the timetable to view the stop details page.

**Current Behavior:**
- Stop names are displayed as read-only text in sticky left column
- No interaction available for stop cells

**Desired Behavior:**
- Stop name becomes a clickable link
- Clicking navigates to the stop page (Objects → Stops → [stop_id])
- Visual hover state indicates clickability

**Implementation Plan:**

```typescript
// In timetable-renderer.ts - renderTimetableBody()

// Current stop cell rendering:
<td class="stop-name p-2 font-medium sticky left-0 bg-base-100 border-r border-base-300">
  <div class="stop-name-text">${this.escapeHtml(stop.stop_name || stop.stop_id)}</div>
  <div class="stop-id text-xs opacity-70">${stop.stop_id}</div>
</td>

// Enhanced stop cell with navigation:
<td class="stop-name p-2 font-medium sticky left-0 bg-base-100 border-r border-base-300">
  <a href="#"
     onclick="gtfsEditor.navigateToStop('${stop.stop_id}'); return false;"
     class="stop-name-link hover:underline cursor-pointer">
    <div class="stop-name-text">${this.escapeHtml(stop.stop_name || stop.stop_id)}</div>
    <div class="stop-id text-xs opacity-70">${stop.stop_id}</div>
  </a>
</td>
```

**CSS Updates (main.css):**

```css
.timetable .stop-name-link {
  display: block;
  color: oklch(var(--bc));
  text-decoration: none;
  transition: color 0.15s ease;
}

.timetable .stop-name-link:hover {
  color: oklch(var(--p));
}

.timetable .stop-name-link:hover .stop-name-text {
  text-decoration: underline;
}
```

**GTFSEditor Integration:**

```typescript
// In src/index.ts - GTFSEditor class
public navigateToStop(stop_id: string): void {
  this.pageStateManager.setPageState({
    page: 'objects',
    table: 'stops',
    id: stop_id
  });
}
```

**Benefits:**
- Quick navigation from timetable to stop details
- Maintains context (can use browser back button)
- Consistent with other navigation patterns in the app

**Testing:**
- Click stop name in timetable → verify navigation to stop page
- Verify hover state shows link cursor and styling
- Verify back button returns to timetable

---

### 2. Visual Stop Sequence with Colored Line

**Goal:** Add a visual representation of the route with colored dots and connecting lines in the left column.

**Design Concept:**

```
┌─────────────────────────────┐
│ ●───────────────────────    │ First Stop
│ │                            │
│ ●───────────────────────    │ Second Stop
│ │                            │
│ ●───────────────────────    │ Third Stop
│ │                            │
│ ●───────────────────────    │ Last Stop
└─────────────────────────────┘
```

**Implementation Plan:**

**1. Add route color to TimetableData interface:**

```typescript
// In timetable-data-processor.ts
export interface TimetableData {
  route: Routes;
  service: Calendar | CalendarDates;
  stops: Stops[];
  trips: AlignedTrip[];
  availableDirections?: DirectionInfo[];
  selectedDirectionId?: string;
  routeColor?: string;  // NEW: Add route color
}

// In generateTimetableData():
const timetableData: TimetableData = {
  route,
  service,
  stops: sortedStops,
  trips: alignedTrips,
  routeColor: route.route_color || '000000'  // Default to black if not specified
};
```

**2. Update stop cell rendering to include visual indicator:**

```typescript
// In timetable-renderer.ts - renderTimetableBody()

private renderStopCell(stop: Stops, stopIndex: number, totalStops: number, routeColor: string): string {
  const isFirst = stopIndex === 0;
  const isLast = stopIndex === totalStops - 1;

  return `
    <td class="stop-name p-2 font-medium sticky left-0 bg-base-100 border-r border-base-300">
      <div class="flex gap-3 items-center">
        <!-- Visual indicator column -->
        <div class="stop-visual flex flex-col items-center" style="width: 16px; min-width: 16px;">
          ${!isFirst ? `<div class="stop-line-top" style="background-color: #${routeColor};"></div>` : ''}
          <div class="stop-dot" style="background-color: #${routeColor};"></div>
          ${!isLast ? `<div class="stop-line-bottom" style="background-color: #${routeColor};"></div>` : ''}
        </div>

        <!-- Stop name column -->
        <a href="#"
           onclick="gtfsEditor.navigateToStop('${stop.stop_id}'); return false;"
           class="stop-name-link hover:underline cursor-pointer flex-1">
          <div class="stop-name-text">${this.escapeHtml(stop.stop_name || stop.stop_id)}</div>
          <div class="stop-id text-xs opacity-70">${stop.stop_id}</div>
        </a>
      </div>
    </td>
  `;
}

// Update renderTimetableBody to use this method:
const rows = data.stops.map((stop, stopIndex) => {
  const rowClass = '';
  const timeCells = /* ... existing time cell rendering ... */;

  return `
    <tr class="${rowClass}">
      ${this.renderStopCell(stop, stopIndex, data.stops.length, data.routeColor || '000000')}
      ${timeCells}
    </tr>
  `;
}).join('');
```

**3. Add CSS for visual indicators:**

```css
/* In src/styles/main.css */

.stop-visual {
  position: relative;
  height: 100%;
  min-height: 48px;
}

.stop-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid oklch(var(--b1));
  box-shadow: 0 0 0 2px oklch(var(--bc) / 0.1);
  z-index: 2;
  position: relative;
}

.stop-line-top,
.stop-line-bottom {
  width: 3px;
  flex: 1;
  min-height: 18px;
  position: relative;
}

.stop-line-top {
  margin-bottom: -2px;
}

.stop-line-bottom {
  margin-top: -2px;
}

/* Ensure visual works with alternating row colors */
.timetable tbody tr:nth-child(even) .stop-dot {
  border-color: oklch(var(--b2) / 0.3);
}
```

**Color Handling:**

GTFS route colors are in hex format without the `#` prefix:
- Use `style="background-color: #${routeColor};"` for inline styles
- Ensure route_color is validated as 6-character hex
- Fallback to route_text_color for contrast if needed

**Benefits:**
- Visual representation matches stop sequence order
- Route color provides context and branding
- Easy to see which stops are skipped (no dot/line)
- Professional transit timetable aesthetic

**Testing:**
- Verify dots appear for all stops in sequence
- Verify lines connect dots (except first/last)
- Verify route color is applied correctly
- Test with routes that have no route_color (default to black)
- Test with alternating row colors

---

### 3. Combined Directions View

**Goal:** Display both directions in a single view, with trips sorted by start time and reversed trip order for return direction.

**Current Behavior:**
- Each direction shown in separate tabs
- User must switch between tabs to see both directions

**Desired Behavior:**
- "Combined" tab option alongside direction tabs
- Outbound trips shown left-to-right by start time
- Inbound trips shown right-to-left (reversed column order) by start time
- All trips sorted globally by first departure time
- Visual separator or color coding to distinguish directions

**Implementation Plan:**

**1. Add "Combined" direction option:**

```typescript
// In timetable-data-processor.ts

export interface DirectionInfo {
  id: string;
  name: string;
  tripCount: number;
}

public getAvailableDirections(route_id: string, service_id: string): DirectionInfo[] {
  const trips = this.relationships.getTripsForRoute(route_id)
    .filter(trip => trip.service_id === service_id);

  const directionMap = new Map<string, number>();

  trips.forEach(trip => {
    const direction_id = trip.direction_id || '0';
    directionMap.set(direction_id, (directionMap.get(direction_id) || 0) + 1);
  });

  const directions: DirectionInfo[] = Array.from(directionMap.entries()).map(([id, count]) => ({
    id,
    name: this.getDirectionName(id),
    tripCount: count
  }));

  // Add "Combined" option if there are multiple directions
  if (directions.length > 1) {
    const totalTrips = trips.length;
    directions.unshift({
      id: 'combined',
      name: 'Combined',
      tripCount: totalTrips
    });
  }

  return directions;
}
```

**2. Handle combined direction in data generation:**

```typescript
// In timetable-data-processor.ts - generateTimetableData()

public async generateTimetableData(
  route_id: string,
  service_id: string,
  direction_id?: string
): Promise<TimetableData> {

  // ... existing code ...

  if (direction_id === 'combined') {
    return this.generateCombinedDirectionData(route_id, service_id);
  }

  // ... existing single direction code ...
}

private async generateCombinedDirectionData(
  route_id: string,
  service_id: string
): Promise<TimetableData> {

  const route = await this.getRouteById(route_id);
  const service = this.relationships.getCalendarForService(service_id);

  if (!route || !service) {
    throw new Error('Route or service not found');
  }

  // Get all trips for all directions
  const allTrips = this.relationships.getTripsForRoute(route_id)
    .filter(trip => trip.service_id === service_id);

  // Get all unique stops across all trips
  const allStops = this.getSupersequenceForTrips(allTrips);

  // Separate trips by direction
  const direction0Trips = allTrips.filter(t => (t.direction_id || '0') === '0');
  const direction1Trips = allTrips.filter(t => (t.direction_id || '0') === '1');

  // Process each direction separately
  const aligned0 = await this.alignTripsToStops(direction0Trips, allStops);
  const aligned1 = await this.alignTripsToStops(direction1Trips, allStops);

  // Reverse the column order for direction 1 (visual effect of opposite direction)
  aligned1.reverse();

  // Sort all trips by first departure time
  const allAlignedTrips = [...aligned0, ...aligned1].sort((a, b) => {
    const aFirstTime = this.getFirstDepartureTime(a);
    const bFirstTime = this.getFirstDepartureTime(b);
    return aFirstTime.localeCompare(bFirstTime);
  });

  return {
    route,
    service,
    stops: allStops,
    trips: allAlignedTrips,
    routeColor: route.route_color || '000000',
    isCombinedView: true  // Flag for rendering logic
  };
}

private getFirstDepartureTime(trip: AlignedTrip): string {
  // Find first non-null departure time
  for (const [stop_id, time] of trip.departure_times || new Map()) {
    if (time) return time;
  }
  return '99:99:99';  // Fallback for sorting
}
```

**3. Update rendering for combined view:**

```typescript
// In timetable-renderer.ts

public renderTimetableHeader(trips: AlignedTrip[], isCombinedView: boolean = false): string {
  const tripHeaders = trips.map((trip) => {
    const direction_id = trip.direction_id || '0';
    const directionClass = isCombinedView ? `direction-${direction_id}` : '';

    return `
      <th class="trip-header text-center min-w-[80px] p-2 text-xs ${directionClass}"
          title="${trip.trip_headsign || trip.trip_short_name || trip.trip_id}">
        ${trip.trip_id}
      </th>
    `;
  }).join('');

  return `
    <thead>
      <tr>
        <th class="stop-header sticky left-0 bg-base-100 min-w-[200px] p-2 text-left">Stop</th>
        ${tripHeaders}
      </tr>
    </thead>
  `;
}
```

**4. Add visual distinction for directions:**

```css
/* In src/styles/main.css */

.timetable th.direction-0 {
  border-top: 3px solid oklch(var(--p));
}

.timetable th.direction-1 {
  border-top: 3px solid oklch(var(--s));
}

/* Optional: Add gradient separator between direction groups */
.timetable th.direction-boundary {
  border-right: 2px solid oklch(var(--bc) / 0.2);
  box-shadow: 2px 0 4px oklch(var(--bc) / 0.1);
}
```

**Benefits:**
- See entire service pattern at a glance
- Compare frequencies between directions
- Identify gaps or timing issues
- More efficient for planning and analysis

**Challenges:**
- May have different stop sequences for each direction
- Wide table if many trips in both directions
- Need clear visual distinction between directions

**Testing:**
- Test with routes that have 2 directions
- Verify trips are sorted by time correctly
- Verify direction 1 trips show in reversed order
- Test with routes where directions have different stop sequences
- Verify performance with large number of trips

---

## Implementation Priority

1. **Click Stop to Navigate** (Easy, High Value)
   - Simple enhancement with immediate usability benefit
   - Low complexity, low risk

2. **Visual Stop Sequence** (Medium, High Value)
   - Significantly improves visual presentation
   - Medium complexity, requires careful CSS work

3. **Combined Directions** (Complex, Medium Value)
   - Most complex implementation
   - Useful for some routes, but not all users need it
   - Can be added later if requested

## Related TODOs

These enhancements complement the editing features in `timetable-editing.md`:
- Add trip column
- Add stop row
- Edit trip properties
- Support additional stop_time fields

## Success Metrics

- Users can quickly navigate from timetable to stop details
- Timetable visually represents route structure clearly
- Combined view reduces tab switching for multi-direction routes
- No performance degradation with enhancements

## Notes

- All enhancements should follow DaisyUI styling patterns
- Maintain accessibility with keyboard navigation
- Ensure responsive behavior (though mobile gets separate treatment)
- Use GTFS standard property names (snake_case) throughout
- Follow FAIL HARD error handling policy
