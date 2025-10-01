# Map Enhancements

**Status**: 🔴 Not Started
**Priority**: Medium
**Estimated Effort**: Medium (1-2 weeks)

## Overview
Add additional basemap options (Stamen, satellite) and improve route visualization by replacing yellow highlights with thicker lines and handling overlapping routes using Turf.js.

## Checklist

- [ ] Research MapLibre GL basemap providers and their requirements
- [ ] Implement basemap switcher UI component
- [ ] Add Stamen tile layer option
- [ ] Add satellite/aerial imagery layer option
- [ ] Install and integrate Turf.js library
- [ ] Implement route overlap detection using `turf.lineOverlap()`
- [ ] Design offset rendering for overlapping routes
- [ ] Replace yellow highlight with thicker line rendering
- [ ] Test basemap switching performance
- [ ] Handle API key management for commercial tile providers
- [ ] Document basemap options and configuration

## Current Map Architecture

### Existing Map Configuration
From `map-controller.ts:103-133`:

```typescript
this.map = new MapLibreMap({
  container: this.mapElementId,
  style: {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
      },
    ],
  },
  center: [-74.006, 40.7128], // NYC default
  zoom: 10,
});
```

**Current Setup:**
- Single basemap: OpenStreetMap (OSM)
- Standard OSM tile server
- No basemap switching capability

### Route Rendering System
From `map-controller.ts:206-211`:

```typescript
// Uses Deck.gl for route visualization
this.routeRenderer!.renderRoutes({
  lineWidth: 3,
  opacity: 0.8,
  enableBlending: true,  // MAX blending for overlaps
  pickable: true,
});
```

**Current Route Visualization:**
- Deck.gl `PathLayer` for route rendering
- 3px line width
- 80% opacity
- MAX blending mode (colors blend when routes overlap)
- No offset for parallel routes

### Route Highlighting
From `map-controller.ts:286-299`:

```typescript
public highlightRoute(route_id: string): void {
  this.clearHighlights();
  this.currentHighlight = { type: 'route', id: route_id };
  this.routeRenderer?.highlightRoute(route_id);
  this.flyToRoute(route_id);
}
```

Current highlight mechanism is in `route-renderer.ts` (not examined but referenced).

## Feature 1: Basemap Switcher

### UI Design

```
Map Controls (top-right corner):

┌──────────────────┐
│ Basemap: [OSM ▼] │  ← Dropdown menu
└──────────────────┘
     ↓ On click
┌──────────────────┐
│ ○ OpenStreetMap  │
│ ○ Stamen Terrain │
│ ○ Satellite      │
│ ● Dark Mode      │
└──────────────────┘
```

Alternative: Layer switcher icon (🗺️)

### Basemap Options

#### 1. OpenStreetMap (Current)
```javascript
{
  name: 'OpenStreetMap',
  type: 'raster',
  tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
  tileSize: 256,
  attribution: '© OpenStreetMap contributors',
  maxzoom: 19,
}
```
**Pros:** Free, no API key, good detail
**Cons:** Can be slow during peak times

#### 2. Stamen Terrain
```javascript
{
  name: 'Stamen Terrain',
  type: 'raster',
  tiles: ['https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png'],
  tileSize: 256,
  attribution: '© Stadia Maps © Stamen Design © OpenStreetMap contributors',
  maxzoom: 18,
}
```
**Pros:** Great for topography, free tier available
**Cons:** Requires Stadia Maps API key (free tier: 200K requests/month)

#### 3. Stamen Toner (High Contrast)
```javascript
{
  name: 'Stamen Toner',
  type: 'raster',
  tiles: ['https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png'],
  tileSize: 256,
  attribution: '© Stadia Maps © Stamen Design © OpenStreetMap contributors',
  maxzoom: 18,
}
```
**Pros:** Excellent for transit maps (minimal detail, high contrast)
**Cons:** Same API key requirement

#### 4. Satellite/Aerial Imagery

**Option A: ESRI World Imagery (Free)**
```javascript
{
  name: 'Satellite',
  type: 'raster',
  tiles: [
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
  ],
  tileSize: 256,
  attribution: '© Esri',
  maxzoom: 19,
}
```
**Pros:** Free, no API key, good coverage
**Cons:** Lower resolution in some areas

**Option B: Mapbox Satellite (Requires API Key)**
```javascript
{
  name: 'Satellite',
  type: 'raster',
  tiles: [
    'https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.png?access_token={apiKey}'
  ],
  tileSize: 512,
  attribution: '© Mapbox',
  maxzoom: 22,
}
```
**Pros:** High resolution, updated imagery
**Cons:** Requires paid API key after free tier (50K free requests/month)

### Implementation

#### 1. Basemap Configuration
```typescript
// New file: src/modules/basemap-config.ts
export interface BasemapStyle {
  id: string;
  name: string;
  type: 'raster' | 'vector';
  tiles: string[];
  tileSize: number;
  attribution: string;
  maxzoom: number;
  requiresApiKey?: boolean;
}

export const basemaps: BasemapStyle[] = [
  {
    id: 'osm',
    name: 'OpenStreetMap',
    type: 'raster',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    tileSize: 256,
    attribution: '© OpenStreetMap contributors',
    maxzoom: 19,
  },
  {
    id: 'stamen-terrain',
    name: 'Stamen Terrain',
    type: 'raster',
    tiles: ['https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png'],
    tileSize: 256,
    attribution: '© Stadia Maps © Stamen Design © OpenStreetMap contributors',
    maxzoom: 18,
    requiresApiKey: true,
  },
  {
    id: 'satellite',
    name: 'Satellite',
    type: 'raster',
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    ],
    tileSize: 256,
    attribution: '© Esri',
    maxzoom: 19,
  },
];
```

#### 2. Basemap Switcher Component
```typescript
// Add to MapController class
public switchBasemap(basemapId: string): void {
  const basemap = basemaps.find(b => b.id === basemapId);
  if (!basemap) {
    console.error('Basemap not found:', basemapId);
    return;
  }

  // Remove old basemap source and layer
  if (this.map!.getLayer('basemap-layer')) {
    this.map!.removeLayer('basemap-layer');
  }
  if (this.map!.getSource('basemap-source')) {
    this.map!.removeSource('basemap-source');
  }

  // Add new basemap source and layer
  this.map!.addSource('basemap-source', {
    type: basemap.type,
    tiles: basemap.tiles,
    tileSize: basemap.tileSize,
    attribution: basemap.attribution,
    maxzoom: basemap.maxzoom,
  });

  this.map!.addLayer(
    {
      id: 'basemap-layer',
      type: 'raster',
      source: 'basemap-source',
    },
    this.getFirstNonBasemapLayer() // Insert below route layers
  );

  console.log('Switched to basemap:', basemap.name);
}

private getFirstNonBasemapLayer(): string | undefined {
  const layers = this.map!.getStyle().layers;
  const nonBasemapLayer = layers.find(
    layer => !layer.id.includes('basemap') && !layer.id.includes('osm')
  );
  return nonBasemapLayer?.id;
}
```

#### 3. UI Integration
Add basemap switcher to `index.html` or create as component:

```html
<!-- Add to map controls area -->
<div class="basemap-switcher">
  <select id="basemap-select" class="select select-sm">
    <option value="osm">OpenStreetMap</option>
    <option value="stamen-terrain">Stamen Terrain</option>
    <option value="satellite">Satellite</option>
  </select>
</div>

<script>
document.getElementById('basemap-select')?.addEventListener('change', (e) => {
  gtfsEditor.mapController.switchBasemap(e.target.value);
});
</script>
```

### API Key Management

For basemaps requiring API keys (Stamen via Stadia Maps):

```typescript
// src/config/api-keys.ts
export const API_KEYS = {
  stadiaMap s: process.env.VITE_STADIA_API_KEY || '',
  mapbox: process.env.VITE_MAPBOX_API_KEY || '',
};

// Check if API key is configured before enabling basemap
export function isBasemapAvailable(basemapId: string): boolean {
  const basemap = basemaps.find(b => b.id === basemapId);
  if (!basemap) return false;

  if (basemap.requiresApiKey) {
    // Check if required API key exists
    if (basemapId.includes('stamen') && !API_KEYS.stadiaMaps) {
      return false;
    }
    if (basemapId === 'mapbox-satellite' && !API_KEYS.mapbox) {
      return false;
    }
  }

  return true;
}
```

Update `.env.example`:
```
# Optional: Stadia Maps API key for Stamen basemaps
VITE_STADIA_API_KEY=your_api_key_here

# Optional: Mapbox API key for satellite imagery
VITE_MAPBOX_API_KEY=your_api_key_here
```

## Feature 2: Improved Route Highlighting

### Current Issue
TODO mentions: "Instead of yellow highlight, maybe slightly thicker?"

### New Approach: Thicker Line Highlighting

```typescript
// In route-renderer.ts (or update MapController)
public highlightRoute(route_id: string): void {
  // Update PathLayer with conditional styling
  this.routeLayer.setProps({
    getWidth: (d) => {
      return d.route_id === route_id ? 6 : 3;  // 2x thicker for highlight
    },
    getColor: (d) => {
      if (d.route_id === route_id) {
        // Use route's own color, but at full opacity
        return [...hexToRgb(d.route_color), 255];
      }
      // Normal routes: semi-transparent
      return [...hexToRgb(d.route_color), 204];  // 80% opacity
    },
  });
}
```

**Visual Effect:**
- Highlighted route: 6px width, 100% opacity
- Normal routes: 3px width, 80% opacity
- No color change (uses route's actual color)

### Alternative: Outline/Halo Effect
```typescript
// Add a separate halo layer for highlights
this.map!.addLayer({
  id: 'route-highlight-halo',
  type: 'line',
  source: 'routes',
  filter: ['==', 'route_id', highlightedRouteId],
  paint: {
    'line-color': '#ffffff',
    'line-width': 8,
    'line-opacity': 0.6,
    'line-blur': 2,
  },
});
```

## Feature 3: Overlapping Route Handling with Turf.js

### Install Turf.js
```bash
npm install @turf/turf
npm install --save-dev @types/turf
```

### Overlap Detection Algorithm

```typescript
import * as turf from '@turf/turf';

interface RouteOverlap {
  routeA: string;
  routeB: string;
  overlapSegments: Feature<LineString>[];
  overlapPercentage: number;
}

function detectOverlappingRoutes(routes: Route[]): RouteOverlap[] {
  const overlaps: RouteOverlap[] = [];

  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      const routeA = turf.lineString(routes[i].coordinates);
      const routeB = turf.lineString(routes[j].coordinates);

      // Check for line overlap within tolerance (50m)
      const overlap = turf.lineOverlap(routeA, routeB, {
        tolerance: 0.05,  // 50 meters in km
        units: 'kilometers',
      });

      if (overlap.features.length > 0) {
        // Calculate overlap percentage
        const routeALength = turf.length(routeA, {units: 'kilometers'});
        const overlapLength = overlap.features.reduce((sum, segment) => {
          return sum + turf.length(segment, {units: 'kilometers'});
        }, 0);
        const overlapPercentage = (overlapLength / routeALength) * 100;

        overlaps.push({
          routeA: routes[i].route_id,
          routeB: routes[j].route_id,
          overlapSegments: overlap.features,
          overlapPercentage,
        });
      }
    }
  }

  return overlaps;
}
```

### Offset Rendering for Overlapping Routes

When routes overlap significantly (>30%), offset them visually:

```typescript
function applyRouteOffsets(routes: Route[], overlaps: RouteOverlap[]): Route[] {
  const offsetAmount = 0.0001; // ~11m at equator

  overlaps.forEach(overlap => {
    // Offset routeB to the right of routeA
    const routeB = routes.find(r => r.route_id === overlap.routeB);
    if (routeB && overlap.overlapPercentage > 30) {
      // Use turf.lineOffset to shift the route
      const line = turf.lineString(routeB.coordinates);
      const offsetLine = turf.lineOffset(line, offsetAmount, {units: 'degrees'});

      routeB.coordinates = offsetLine.geometry.coordinates;
      routeB.hasOffset = true;
    }
  });

  return routes;
}
```

### Visual Representation

```
Without offset (overlapping):
━━━━━━━━━━━  Route A + Route B (indistinguishable)

With offset:
━━━━━━━━━━━  Route A
 ━━━━━━━━━━  Route B (slightly offset)
```

### Integration with RouteRenderer

```typescript
// In route-renderer.ts
public renderRoutes(options: RenderOptions): void {
  // Detect overlaps
  const overlaps = detectOverlappingRoutes(this.routes);

  // Apply offsets
  const offsetRoutes = applyRouteOffsets(this.routes, overlaps);

  // Render with Deck.gl PathLayer
  const pathLayer = new PathLayer({
    id: 'routes',
    data: offsetRoutes,
    getPath: d => d.coordinates,
    getColor: d => hexToRgb(d.route_color),
    getWidth: d => d.hasOffset ? 2.5 : 3,  // Slightly thinner if offset
    widthUnits: 'pixels',
    ...options,
  });

  this.deckOverlay.setProps({
    layers: [pathLayer],
  });
}
```

## Testing

### Basemap Switcher Tests
1. **Switch to Each Basemap**: Verify tiles load correctly
2. **API Key Missing**: Test graceful degradation
3. **Performance**: Measure tile loading time for each basemap
4. **Attribution**: Verify correct attribution appears
5. **Zoom Levels**: Test at min/max zoom for each basemap

### Overlap Detection Tests
1. **Parallel Routes**: Two routes on same street (100% overlap)
2. **Partial Overlap**: Routes share segment (50% overlap)
3. **No Overlap**: Completely separate routes (0% overlap)
4. **Complex Network**: 10+ routes with multiple overlaps
5. **Performance**: Test with 100 routes (measure detection time)

### Visual Tests (Manual)
- [ ] Highlighted route appears thicker and brighter
- [ ] Overlapping routes are visually distinct
- [ ] Offset routes don't obscure stops
- [ ] Basemap switching is smooth (no flicker)

## Performance Considerations

- **Overlap Detection**: O(n²) complexity, run only when routes change
- **Cache Results**: Store overlap calculations, invalidate on route updates
- **Limit Processing**: Only detect overlaps for visible routes in viewport
- **Turf.js Bundle Size**: ~300KB (consider tree-shaking)

## Resources

- Turf.js lineOverlap: https://turfjs.org/docs/api/lineOverlap
- Turf.js lineOffset: https://turfjs.org/docs/api/lineOffset
- MapLibre GL Basemap Examples: https://maplibre.org/maplibre-gl-js/docs/examples/
- Stadia Maps (Stamen): https://stadiamaps.com/stamen/
- ESRI World Imagery: https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer

## Next Steps

1. Install Turf.js: `npm install @turf/turf`
2. Create `basemap-config.ts` with basemap definitions
3. Implement `switchBasemap()` in MapController
4. Add UI dropdown for basemap selection
5. Implement overlap detection with `turf.lineOverlap()`
6. Test offset rendering with parallel routes
7. Update route highlighting to use thickness instead of color