# Map Routing

**Status**: 🔴 Not Started
**Priority**: High
**Estimated Effort**: Large (2-3 weeks)

## Overview
Implement route editing functionality with drag-and-drop capabilities and intelligent anchor point navigation between stops on the map.

## Checklist

- [ ] Research MapLibre GL drag-and-drop interaction patterns
- [ ] Design anchor point selection UI/UX flow
- [ ] Implement anchor point placement logic (two anchors per route segment)
- [ ] Create straight line vs. calculated route options
- [ ] Add visual feedback during drag operations (ghost line, snap indicators)
- [ ] Handle route shape updates in database (`shapes.txt`)
- [ ] Implement shape point generation between anchors
- [ ] Test with various route configurations (simple, complex, overlapping)
- [ ] Add validation for anchor point placement (must be on/near route)
- [ ] Handle edge cases (self-intersections, loop routes, branching)

## Current Architecture Context

### Relevant Modules
- **`src/modules/map-controller.ts`** (860 lines)
  - Main orchestrator: `MapController` class
  - Uses modular architecture with `RouteRenderer`, `LayerManager`, `InteractionHandler`
  - Current interaction modes: `NAVIGATE`, `ADD_STOP`, `EDIT_STOPS` (enum `MapMode`)
  - Need to add: `EDIT_ROUTE` mode

- **`src/modules/route-renderer.ts`** (referenced but not read)
  - Handles Deck.gl route visualization
  - Methods: `renderRoutes()`, `highlightRoute()`, `clearRoutes()`
  - Uses MAX blending for overlapping routes

- **`src/modules/interaction-handler.ts`** (referenced but not read)
  - Manages map interactions and callbacks
  - Has stop drag functionality already: `handleStopDragComplete()`
  - Pattern to follow for route dragging

### Current Route Rendering
```typescript
// From map-controller.ts:206-211
this.routeRenderer!.renderRoutes({
  lineWidth: 3,
  opacity: 0.8,
  enableBlending: true,
  pickable: true,
});
```

### Database Operations
- Routes stored in `routes.txt` (basic metadata: ID, name, color)
- Route geometry stored in `shapes.txt` with sequences of lat/lon points
- Each shape point has: `shape_id`, `shape_pt_lat`, `shape_pt_lon`, `shape_pt_sequence`
- Trips link to shapes via `shape_id` field

## Technical Design

### Anchor-Based Route Editing
The TODO specifies: "drag a route out with two anchors (points on the route to navigate between)"

**Proposed Flow:**
1. User activates route edit mode
2. User clicks on a route segment to edit
3. User drags the route to a new path
4. System prompts for two anchor points:
   - **Start anchor**: Fixed point where new path begins
   - **End anchor**: Fixed point where new path ends
5. For each anchor, user chooses:
   - **Option A**: Straight line to anchor
   - **Option B**: Calculated path (using routing service or manual drawing)

### Implementation Strategy

#### 1. Extend `MapMode` Enum
```typescript
export enum MapMode {
  NAVIGATE = 'navigate',
  ADD_STOP = 'add_stop',
  EDIT_STOPS = 'edit_stops',
  EDIT_ROUTES = 'edit_routes',  // NEW
}
```

#### 2. Route Editing State Machine
States:
- `idle`: No editing active
- `selecting_route`: User hovering/selecting route to edit
- `dragging`: User dragging route segment
- `anchor_placement`: Placing anchor points
- `path_selection`: Choosing straight vs. calculated path

#### 3. Visual Feedback
- Ghost route line during drag
- Anchor point markers (large, distinct)
- Dashed line showing path options
- Snap indicators for valid anchor positions

#### 4. Database Updates
```typescript
// Update shapes.txt with new geometry
interface ShapePoint {
  shape_id: string;
  shape_pt_lat: string;
  shape_pt_lon: string;
  shape_pt_sequence: string;
  shape_dist_traveled?: string;
}

async function updateRouteShape(
  shape_id: string,
  newPoints: {lat: number, lon: number}[]
): Promise<void> {
  // Delete old shape points
  // Insert new shape points with sequential shape_pt_sequence
  // Optionally calculate shape_dist_traveled
}
```

### Integration Points

**InteractionHandler Pattern (from stop editing):**
```typescript
// From map-controller.ts:696-728
private async handleStopDragComplete(
  stop_id: string,
  lat: number,
  lng: number
): Promise<void> {
  try {
    await this.gtfsParser.updateStopCoordinates(stop_id, lat, lng);
    this.layerManager?.updateStopsData();
    this.showNotification('Stop coordinates updated', 'success');
  } catch (error) {
    this.showNotification('Failed to update stop coordinates', 'error');
    this.updateMap(); // Revert visual changes
  }
}
```

Apply similar pattern for route updates.

## Dependencies & Libraries

### Required Libraries
- **MapLibre GL** (already integrated v5.7.2)
  - Built-in drag/drop support
  - Event system: `mousedown`, `mousemove`, `mouseup`

- **Turf.js** (mentioned in TODO but NOT YET INSTALLED)
  - Needed for geometric operations
  - Functions: `lineSlice`, `nearestPointOnLine`, `lineString`
  - Install: `npm install @turf/turf`

### Optional: Routing Service
For calculated paths between anchors:
- **OSRM** (Open Source Routing Machine)
- **Mapbox Directions API** (requires API key)
- **GraphHopper** (open source alternative)
- Or: Simple Bezier curve interpolation (no external service needed)

## GTFS Specification Context

### shapes.txt Structure
```
shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence,shape_dist_traveled
route_1_outbound,37.7749,-122.4194,1,0
route_1_outbound,37.7750,-122.4195,2,50.5
route_1_outbound,37.7751,-122.4196,3,101.2
```

**Fields:**
- `shape_id`: Links to `trips.shape_id`
- `shape_pt_sequence`: Integer, defines order (MUST be sequential)
- `shape_dist_traveled`: Optional, distance from first point (meters)

### Relationship to Routes and Trips
```
routes.txt → trips.txt → shapes.txt
route_id     trip_id       shape_id
             shape_id      shape points (ordered by sequence)
```

**Important**: Multiple trips can share the same `shape_id`!

## Testing Scenarios

1. **Simple Route Edit**: Two-stop route, minor path adjustment
2. **Complex Route**: Multi-stop route with multiple segments
3. **Shared Shape**: Route used by multiple trips (ensure all trips update)
4. **Loop Route**: Route that returns to starting point
5. **Branching Routes**: Different trips on same route with slightly different paths
6. **Long Distance**: Route with many shape points (100+)
7. **Straight Line Option**: User chooses direct path between anchors
8. **Calculated Path Option**: User chooses routed path between anchors

## Edge Cases & Error Handling

1. **No existing shape**: Route has no shape_id → Create new shape
2. **Shape used by multiple routes**: Warn user before editing
3. **Invalid anchor placement**: Anchor not on route path → Show error
4. **Self-intersecting paths**: Detect and warn
5. **Database failure**: Revert visual changes if save fails (FAIL HARD policy)
6. **Very large routes**: Performance testing with 500+ shape points

## UI/UX Mockup

```
┌─────────────────────────────────────┐
│ Map Controls                        │
│ [Navigate] [Add Stop] [Edit Stops]  │
│ [Edit Routes] ← NEW BUTTON          │
└─────────────────────────────────────┘

When Edit Routes active:
1. Click route → Route highlights
2. Drag route → Ghost line shows new path
3. Release → Anchor placement prompt appears

┌─────────────────────────────────────┐
│ Place Anchor Points                  │
│                                      │
│ Click on the route to place the     │
│ START and END anchors for the new   │
│ path.                                │
│                                      │
│ Anchor 1 (Start): [Waiting...]      │
│ Anchor 2 (End):   [Waiting...]      │
│                                      │
│ [Cancel] [Reset]                     │
└─────────────────────────────────────┘

After anchors placed:
┌─────────────────────────────────────┐
│ Choose Path Type                     │
│                                      │
│ ○ Straight line                     │
│   Direct path between anchors       │
│                                      │
│ ○ Calculated route                  │
│   Follow street network             │
│                                      │
│ [Back] [Cancel] [Apply]             │
└─────────────────────────────────────┘
```

## Resources

- MapLibre GL Drag/Drop Examples: https://maplibre.org/maplibre-gl-js/docs/examples/drag-a-marker/
- Turf.js Documentation: https://turfjs.org/docs/
- GTFS shapes.txt Reference: https://gtfs.org/schedule/reference/#shapestxt
- Deck.gl LineLayer: https://deck.gl/docs/api-reference/layers/line-layer (used by RouteRenderer)

## Next Steps

1. Install Turf.js: `npm install @turf/turf`
2. Add `EDIT_ROUTES` mode to `MapMode` enum
3. Create `RouteEditor` class (similar to stop editing pattern)
4. Implement anchor point UI
5. Add shape update methods to `gtfs-database.ts`
6. Write tests for shape point generation