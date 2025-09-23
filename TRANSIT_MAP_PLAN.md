# Transit Map Enhancement Plan

## Phase 1: Core Transit Visualization

### 1. Shape-Based Route Rendering
- [ ] **Parse shapes.txt properly** - Connect routes to shape_ids via trips
- [ ] **Create shape-to-route mapping** - Build lookup from shape_id to route(s)
- [ ] **Implement shape fallback logic** - Use shapes when available, fall back to stop connections
- [ ] **Render route geometries** - Use actual transit alignment or straight lines between stops

### 2. Deterministic Route Colors
- [ ] **Install string-hash package** - `npm install string-hash`
- [ ] **Create color mapping function** - Hash route_id to HSL with good contrast
- [ ] **Use route_color from GTFS** - Prefer GTFS route_color when available
- [ ] **Apply color system** - Update route layers to use deterministic colors

### 3. Transit-Style Visualization
- [ ] **Style route lines** - Thin traces (2-3px) with rounded caps
- [ ] **Style stop circles** - White fill with colored stroke matching route
- [ ] **Layer organization** - Routes behind stops, proper z-index
- [ ] **Visual hierarchy** - Consistent stroke widths and opacities

## Phase 2: Interactive States

### 4. Focus States
- [ ] **Route focus styling** - Wider lines (5-6px), higher opacity for focused routes
- [ ] **Stop focus styling** - Larger circles for focused stops
- [ ] **Multi-route stops** - Handle stops served by multiple routes
- [ ] **Smooth transitions** - Use MapLibre GL expressions for state changes

### 5. Objects Tab Integration
- [ ] **Route selection handler** - Listen for route selection in Objects tab
- [ ] **Map focus coordination** - Zoom to route and apply focus styles
- [ ] **Bidirectional communication** - Map clicks update Objects tab selection
- [ ] **State synchronization** - Keep map and UI selections in sync

### 6. Interactive Feedback
- [ ] **Hover states** - Subtle highlighting on hover
- [ ] **DaisyUI info cards** - Replace popups with positioned cards
- [ ] **Route/stop information** - Show relevant GTFS data in cards
- [ ] **Click interactions** - Select and navigate to Objects tab

## Phase 3: Advanced Features (Future)

### 7. Route Labels
- [ ] **Label positioning** - Place route names along lines
- [ ] **Dynamic visibility** - Show/hide based on zoom level
- [ ] **Collision detection** - Prevent overlapping labels

### 8. Overlapping Route Handling
- [ ] **Parallel line offset** - Separate overlapping routes visually
- [ ] **Bundling logic** - Group routes sharing common segments
- [ ] **Dynamic spacing** - Adjust spacing based on number of overlapping routes

## Technical Implementation Details

### Architecture Changes

#### New Map Layer Structure
```
├── shapes-background (all route shapes, thin, muted)
├── routes-background (stop-to-stop fallback, thin, muted)
├── shapes-focused (selected route shapes, thick, opaque)
├── routes-focused (selected route fallback, thick, opaque)
├── stops-background (all stops, small circles)
└── stops-focused (selected stops, larger circles)
```

#### Color System
```javascript
// Deterministic color generation
function getRouteColor(routeId, gtfsRouteColor) {
  if (gtfsRouteColor && gtfsRouteColor !== '') {
    return `#${gtfsRouteColor}`;
  }

  const hash = stringHash(routeId);
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
}
```

#### State Management
```javascript
// Route focus state
map.setFeatureState(
  { source: 'routes', id: routeId },
  { focused: true }
);

// Use feature state in layer styling
'line-width': [
  'case',
  ['boolean', ['feature-state', 'focused'], false],
  6,  // focused width
  2   // default width
]
```

### Data Flow

1. **Route Selection** (Objects tab) → Map focus + zoom
2. **Map Hover** → Show info card
3. **Map Click** → Select in Objects tab + show details
4. **Route Focus** → Highlight all stops on route
5. **Stop Focus** → Highlight all routes serving stop

### File Changes Required

#### Core Files
- `src/modules/map-controller.ts` - Main implementation
- `src/modules/ui.ts` - Objects tab integration
- `package.json` - Add string-hash dependency

#### New Utilities
- Color mapping function
- Shape-to-route lookup builder
- Focus state manager
- Info card component

### Testing Strategy

#### Manual Testing Checklist
- [ ] Routes render with shapes when available
- [ ] Routes fall back to stop connections without shapes
- [ ] Colors are consistent and deterministic
- [ ] Focus states work for routes and stops
- [ ] Objects tab selection focuses map
- [ ] Map clicks update Objects tab
- [ ] Info cards show on hover
- [ ] Performance good with large feeds

#### Automated Tests
- [ ] Add Playwright tests for new interactions
- [ ] Test color consistency across reloads
- [ ] Test focus state synchronization
- [ ] Test with feeds with/without shapes

## Dependencies

### New Dependencies
```bash
npm install string-hash
```

### Type Definitions
```bash
npm install @types/string-hash --save-dev
```

## Performance Considerations

- Use MapLibre GL feature state for efficient updates
- Minimize DOM manipulation, leverage GPU rendering
- Implement view-dependent rendering for large networks
- Consider clustering for dense stop areas
- Lazy load route details on demand

## Accessibility

- Ensure sufficient color contrast ratios
- Provide keyboard navigation for focused elements
- Screen reader support for route/stop information
- High contrast mode compatibility

## Browser Compatibility

- Modern browsers with WebGL support (MapLibre GL requirement)
- Fallback messaging for unsupported browsers
- Touch gesture support for mobile devices