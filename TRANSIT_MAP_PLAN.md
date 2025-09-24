# Transit Map Enhancement Plan

## Phase 1: Core Transit Visualization

### 1. Shape-Based Route Rendering

- [x] **Parse shapes.txt properly** - Connect routes to shape_ids via trips
- [x] **Create shape-to-route mapping** - Build lookup from shape_id to route(s)
- [x] **Implement shape fallback logic** - Use shapes when available, fall back to stop connections
- [x] **Render route geometries** - Use actual transit alignment or straight lines between stops

### 2. Deterministic Route Colors

- [x] **Install string-hash package** - `npm install string-hash`
- [x] **Create color mapping function** - Hash route_id to HSL with good contrast
- [x] **Use route_color from GTFS** - Prefer GTFS route_color when available
- [x] **Apply color system** - Update route layers to use deterministic colors

### 3. Transit-Style Visualization

- [x] **Style route lines** - Thin traces (3px) with rounded caps
- [x] **Style stop circles** - White fill with colored stroke matching route
- [x] **Layer organization** - Routes behind stops, proper z-index
- [x] **Visual hierarchy** - Consistent stroke widths and opacities

## Phase 2: Interactive States

### 4. Focus States

- [x] **Route focus styling** - Wider lines (5-6px), higher opacity for focused routes
- [x] **Stop focus styling** - Larger circles for focused stops
- [x] **Multi-route stops** - Handle stops served by multiple routes
- [x] **Smooth transitions** - Use MapLibre GL expressions for state changes

### 5. Objects Tab Integration

- [x] **Route selection handler** - Listen for route selection in Objects tab
- [x] **Map focus coordination** - Zoom to route and apply focus styles
- [x] **Bidirectional communication** - Map clicks update Objects tab selection
- [x] **State synchronization** - Keep map and UI selections in sync

### 6. Interactive Feedback

- [x] **Hover states** - Subtle highlighting on hover
- [x] **Increase click area on routes and stops** - Added invisible larger click areas for better UX
- [x] **DaisyUI info cards** - Replace popups with positioned cards
- [x] **Route/stop information** - Show relevant GTFS data in cards
- [x] **Click interactions** - Select and navigate to Objects tab
- [x] **Update breadcrumbs** - Map click interactions now show proper hierarchy (Home -> Agency -> Route)

### 6a. Cleaning up

#### Remove Info Cards
- [x] **Remove card creation in map-controller.ts** - Delete `createInfoCard()` function
- [x] **Remove card DOM elements** - Delete info card HTML in `index.html`
- [x] **Remove card styling** - Delete info card CSS classes
- [x] **Remove card show/hide logic** - Delete hover/click handlers that show cards
- [x] **Remove card positioning code** - Delete calculation of card position relative to map
- [x] **Update hover interactions** - Remove card display, keep only visual highlighting
- [x] **Update click interactions** - Route directly to Computed tab instead of showing card

#### Breadcrumb Determinism
- [x] **Create setBreadcrumb() function** - Replace all breadcrumb.push() with setBreadcrumb(fullPath)
- [ ] **Define breadcrumb patterns** - Document the exact patterns for each object type:
  - Home
  - Home → Agency → Route
  - Home → Stop (no agency association - stops can serve multiple agencies)
  - Home → Agency → Trip
  - Home → Agency → Service
- [x] **Update route selection** - Always set full path: `setBreadcrumb(['Home', agency.name, route.route_short_name])`
- [ ] **Update stop selection** - Always set simple path: `setBreadcrumb(['Home', stop.stop_name])` (stops not tied to specific agency)
- [x] **Update trip selection** - Always set full path: `setBreadcrumb(['Home', agency.name, trip.trip_id])`
- [x] **Remove all breadcrumb.push() calls** - Search codebase and replace with setBreadcrumb()
- [ ] **Test breadcrumb consistency** - Click around and verify breadcrumbs never get into weird states

#### Stop Multi-Route Handling
- [x] **Group trips by route** - In stop details, organize trips by their route_id
- [x] **Create route sections** - Show "Route A: Trip 1, Trip 2" groupings
- [x] **Make route names clickable** - Link route names to route selection
- [x] **Make trip IDs clickable** - Link individual trips to trip/service details
- [x] **Show service patterns** - Display which service_id each trip uses
- [x] **Add route color indicators** - Show route colors next to route names in stop details
- [ ] **Group by agency then route** - Show trips grouped by agency, then by route within each agency
- [ ] **Fix missing relationship methods** - Implement getAgencyByIdAsync and getRoutesForStopAsync methods

#### Code Cleanup Tasks
- [x] **Remove unused card variables** - Delete any leftover card-related variables
- [x] **Remove card event listeners** - Clean up any orphaned event listeners
- [x] **Update TypeScript types** - Remove card-related type definitions
- [x] **Update comments** - Remove any comments referencing info cards
- [x] **Test all interactions** - Ensure no broken references to removed card functionality

#### UI/UX Improvements
- [x] **Improve Computed tab prominence** - Make it more obvious that details appear there
- [x] **Add loading states** - Show loading in Computed tab when fetching object details
- [x] **Improve object selection feedback** - Clear visual indication when something is selected
- [x] **Add back navigation** - Easy way to navigate back through breadcrumb hierarchy
- [x] **Consistent selection styling** - Same visual treatment for all selected objects

#### Testing Checklist
- [x] **Test route selection flow** - Route click → Computed tab → correct breadcrumb
- [x] **Test stop selection flow** - Stop click → Computed tab → correct breadcrumb → grouped trips
- [x] **Test breadcrumb navigation** - Click breadcrumb items to navigate back
- [x] **Test multi-route stops** - Stops served by multiple routes show all routes correctly
- [x] **Test route/trip linking** - Links from stop details navigate correctly
- [x] **Test edge cases** - Objects without names, missing data, etc.
- [x] **Test state persistence** - Selection survives page interactions
- [x] **Verify no console errors** - No references to removed card functionality

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
