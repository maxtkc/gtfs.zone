# Map Stops

**Status**: 🟡 In Progress (basic markers exist)
**Priority**: Medium
**Estimated Effort**: Small (3-5 days)

## Overview
Improve stop visualization with better styling (white dot with black circle outline), highlighted states, and parallel route handling ("ties" for parallel lines).

## Checklist

- [ ] Design new stop marker style (white center, black outline)
- [ ] Implement highlighted state styling (grey center)
- [ ] Research parallel line visualization techniques
- [ ] Detect parallel/overlapping routes near stops
- [ ] Implement "ties" for parallel routes (connecting lines between parallel segments)
- [ ] Update stop marker rendering in `LayerManager`
- [ ] Create custom SVG markers for stops
- [ ] Handle marker z-index for overlapping stops
- [ ] Test with high-density stop areas (100+ stops in view)
- [ ] Ensure performance with clustering enabled
- [ ] Add smooth transitions for state changes

## Current Implementation

### Existing Stop Rendering
From `map-controller.ts:213-223`:
```typescript
this.layerManager!.addStopsLayer({
  showBackground: true,
  showClickArea: true,
  enableHover: true,
  backgroundColor: '#ffffff',
  strokeColor: '#2563eb',  // Current blue outline
  strokeWidth: 2.5,
  radius: 7,
  clickAreaRadius: 15,
});
```

**Current Rendering:**
- Uses `LayerManager.addStopsLayer()` method
- Basic circle markers with blue outline
- Click area for interaction (15px radius)
- Hover effects enabled
- Background currently white

### Stop Highlighting
From `map-controller.ts:304-331`:
```typescript
public highlightStop(stop_id: string, color = '#e74c3c', radius = 12): void {
  this.clearHighlights();  // Mutual exclusivity enforced
  this.currentHighlight = { type: 'stop', id: stop_id };
  this.layerManager?.highlightStop(stop_id, { color, radius });

  // Smooth flyTo animation
  this.map!.flyTo({
    center: [lon, lat],
    zoom: Math.max(this.map!.getZoom(), 13),
    duration: 1500,
    essential: true,
  });
}
```

**Current Highlight Behavior:**
- Red color (`#e74c3c`) by default
- Larger radius (12px vs 7px)
- Smooth map animation to stop location
- Mutual exclusivity with route/trip highlights

## Design Requirements

### Default Stop Appearance
```
 ┌─────┐
 │  ●  │  ← White center dot
 │ ◯ ◯ │  ← Black circle outline (2-3px)
 └─────┘
```

**Specifications:**
- Inner circle: 5px radius, white fill (`#ffffff`)
- Outer circle: 8px radius, black stroke (`#000000`), 2.5px width, no fill
- Total visual size: ~11px diameter
- Click area: 15px radius (unchanged)

### Highlighted Stop Appearance
```
 ┌─────┐
 │  ●  │  ← Grey center (#6b7280)
 │ ◯ ◯ │  ← Black circle outline (thicker, 3px)
 └─────┘
```

**Specifications:**
- Inner circle: 6px radius, grey fill (`#6b7280`)
- Outer circle: 9px radius, black stroke (`#000000`), 3px width
- Slightly larger to draw attention
- Smooth transition animation (200ms ease-out)

### Parallel Route "Ties"
When routes run parallel (e.g., two routes on same street):

```
Route A  ━━━━━━●━━━━━━  ← Stop on Route A
           │ │ │  ← "Ties" (perpendicular connecting lines)
Route B  ━━━━━━●━━━━━━  ← Stop on Route B
```

**Specifications:**
- Detect parallel routes within 50m of each other
- Draw perpendicular connecting lines ("ties") every 100m
- Tie styling: thin dashed line, low opacity (0.3)
- Only show ties when both routes are visible
- Ties should not interfere with stop markers

## Technical Implementation

### Custom SVG Markers

#### Approach 1: MapLibre GL Markers
```typescript
const el = document.createElement('div');
el.className = 'stop-marker';
el.innerHTML = `
  <svg width="18" height="18" viewBox="0 0 18 18">
    <!-- Outer circle (black outline) -->
    <circle cx="9" cy="9" r="8"
            fill="none" stroke="#000000" stroke-width="2.5"/>
    <!-- Inner circle (white center) -->
    <circle cx="9" cy="9" r="5"
            fill="#ffffff"/>
  </svg>
`;

new maplibregl.Marker(el)
  .setLngLat([lon, lat])
  .addTo(map);
```

**Pros:** Easy to style with CSS, good for small numbers of stops
**Cons:** Performance issues with 1000+ stops

#### Approach 2: Layer-Based Rendering (Recommended)
Use MapLibre GL native layers for better performance:

```typescript
map.addLayer({
  id: 'stop-circles-outer',
  type: 'circle',
  source: 'stops',
  paint: {
    'circle-radius': 8,
    'circle-color': 'transparent',
    'circle-stroke-width': 2.5,
    'circle-stroke-color': '#000000',
  },
});

map.addLayer({
  id: 'stop-circles-inner',
  type: 'circle',
  source: 'stops',
  paint: {
    'circle-radius': 5,
    'circle-color': '#ffffff',
  },
});
```

**Pros:** Much better performance, native clustering support
**Cons:** Less flexible than SVG (but sufficient for our needs)

### Highlighted State Implementation

```typescript
// Add dynamic styling based on highlighted stop
map.setPaintProperty('stop-circles-inner', 'circle-color', [
  'case',
  ['==', ['get', 'stop_id'], highlightedStopId],
  '#6b7280',  // Grey for highlighted
  '#ffffff'   // White for normal
]);

map.setPaintProperty('stop-circles-inner', 'circle-radius', [
  'case',
  ['==', ['get', 'stop_id'], highlightedStopId],
  6,  // Slightly larger for highlighted
  5   // Normal size
]);
```

### Parallel Route Detection

Using Turf.js (needs installation):

```typescript
import * as turf from '@turf/turf';

function detectParallelRoutes(routes: Route[]): ParallelPair[] {
  const parallel: ParallelPair[] = [];

  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      const routeA = routes[i];
      const routeB = routes[j];

      // Sample points along each route
      const samplesA = turf.lineChunk(routeA.geometry, 0.1, {units: 'kilometers'});
      const samplesB = turf.lineChunk(routeB.geometry, 0.1, {units: 'kilometers'});

      // Check distance between routes
      let parallelSegments = 0;
      samplesA.forEach(segmentA => {
        const distanceToB = turf.pointToLineDistance(
          turf.centroid(segmentA),
          routeB.geometry,
          {units: 'meters'}
        );

        if (distanceToB < 50) {  // Within 50 meters
          parallelSegments++;
        }
      });

      // If >50% of route is parallel, mark as parallel pair
      if (parallelSegments / samplesA.length > 0.5) {
        parallel.push({routeA: routeA.id, routeB: routeB.id});
      }
    }
  }

  return parallel;
}
```

### Rendering "Ties" Between Parallel Routes

```typescript
function generateTies(routeA: LineString, routeB: LineString): Feature[] {
  const ties: Feature[] = [];
  const tieLengthKm = 0.1; // Sample every 100m

  const chunksA = turf.lineChunk(routeA, tieLengthKm, {units: 'kilometers'});

  chunksA.features.forEach(chunk => {
    const pointA = turf.centroid(chunk);
    const nearestB = turf.nearestPointOnLine(routeB, pointA);

    // Create perpendicular tie line
    const tie = turf.lineString([
      pointA.geometry.coordinates,
      nearestB.geometry.coordinates
    ]);

    ties.push(tie);
  });

  return ties;
}

// Add ties layer to map
map.addLayer({
  id: 'route-ties',
  type: 'line',
  source: {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: ties
    }
  },
  paint: {
    'line-color': '#000000',
    'line-width': 1,
    'line-opacity': 0.3,
    'line-dasharray': [2, 2],
  },
});
```

## Module Updates Required

### `src/modules/layer-manager.ts`
```typescript
class LayerManager {
  // Update addStopsLayer signature
  addStopsLayer(options: {
    showBackground: boolean;
    showClickArea: boolean;
    enableHover: boolean;
    backgroundColor: string;
    strokeColor: string;  // Now: '#000000' (black)
    strokeWidth: number;
    radius: number;       // Inner circle radius
    outerRadius: number;  // NEW: Outer circle radius
    clickAreaRadius: number;
  }): void {
    // Implementation with double-circle rendering
  }

  // Update highlightStop to use grey center
  highlightStop(stop_id: string, options: {
    centerColor?: string;  // NEW: '#6b7280' for grey
    outlineColor?: string; // '#000000'
    radius?: number;
  }): void {
    // Implementation
  }
}
```

### `src/modules/map-controller.ts`
Update stop layer configuration:
```typescript
// Line 213-223 needs update:
this.layerManager!.addStopsLayer({
  showBackground: true,
  showClickArea: true,
  enableHover: true,
  backgroundColor: '#ffffff',  // Inner circle (white)
  strokeColor: '#000000',      // Changed from blue to black
  strokeWidth: 2.5,
  radius: 5,                   // Inner circle (reduced from 7)
  outerRadius: 8,              // NEW: Outer circle
  clickAreaRadius: 15,
});

// Line 304-331: Update highlightStop call
this.layerManager?.highlightStop(stop_id, {
  centerColor: '#6b7280',  // Grey center for highlighted
  outlineColor: '#000000',
  radius: 6                // Slightly larger
});
```

## Testing Scenarios

1. **Basic Stop Display**: Load feed with 50 stops, verify white/black appearance
2. **Stop Hover**: Hover over stop, verify visual feedback
3. **Stop Selection**: Click stop, verify grey center + thicker outline
4. **Dense Areas**: Test with 500+ stops in viewport
5. **Clustering**: Verify stop clustering still works at low zoom
6. **Parallel Routes**: Load feed with parallel routes (e.g., bus routes on same street)
7. **Tie Rendering**: Verify ties appear between parallel routes
8. **Performance**: Measure FPS with 1000+ stops + 50+ routes
9. **Zoom Levels**: Test stop appearance at zoom 10, 13, 15, 18
10. **Color Blind Friendly**: Verify black/white/grey contrast is accessible

## Performance Considerations

### Current Clustering
The map already uses clustering for stops (mentioned in CLAUDE.md):
```typescript
// Clustering is used for performance with large datasets
```

**Maintain clustering behavior:**
- Zoom level < 13: Show clusters with stop count
- Zoom level >= 13: Show individual stops
- Transition smoothly between states

### Parallel Route Performance
- Only calculate parallel routes for currently visible routes
- Cache parallel route calculations
- Update only when map moves significantly (>100m)
- Limit tie rendering to zoom >= 14 (detail view)

## Accessibility

- Maintain 15px click area for touch targets (44x44px minimum)
- Use ARIA labels for screen readers
- Keyboard navigation support (tab to stops)
- High contrast mode support (check black/white contrast ratio)

## Resources

- MapLibre GL Circle Layer: https://maplibre.org/maplibre-style-spec/layers/#circle
- Turf.js Point to Line Distance: https://turfjs.org/docs/api/pointToLineDistance
- GTFS stops.txt Specification: https://gtfs.org/schedule/reference/#stopstxt
- Web Accessibility Guidelines: https://www.w3.org/WAI/WCAG21/quickref/

## Next Steps

1. Update `LayerManager.addStopsLayer()` to use double-circle rendering
2. Change stroke color from blue to black
3. Implement highlighted state with grey center
4. Install Turf.js (if not already installed): `npm install @turf/turf`
5. Implement parallel route detection
6. Add tie rendering layer
7. Test performance with sample feeds