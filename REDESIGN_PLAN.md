# GTFS.zone Redesign Plan [DEPRECATED - See REDESIGN_PLAN_V2.md]

**⚠️ This plan has been superseded by REDESIGN_PLAN_V2.md which reflects the current implementation status and provides actionable next steps.**

## Current State Analysis

### Current Layout Issues
- Sidebar is collapsible overlay, not taking full height
- Editor panel is overlay, not integrated into layout
- No tab system for organizing different views
- No Objects mode for navigating GTFS data hierarchically

### Current Architecture
```
src/
├── index.js (GTFSEditor main class)
├── index.html (layout with overlays)
├── modules/
│   ├── gtfs-parser.js (data parsing and management)
│   ├── map-controller.js (Leaflet map visualization)
│   ├── editor.js (CodeMirror text editor)
│   └── ui.js (UI state management)
└── styles/main.css
```

## New Layout Design

### Visual Layout
```
┌─────────────────────────────────────────────────────────┐
│                    Header (fixed)                       │
├─────────────────┬───────────────────┬─────────────────────┤
│    Left Panel   │                   │    Right Panel      │
│   (full height) │       Map         │   (full height)     │
│                 │    (center)       │                     │
│ ┌─────────────┐ │                   │ ┌─────────────────┐ │
│ │Files│Objects│ │                   │ │Editor│Info│Help│ │ 
│ ├─────────────┤ │                   │ ├─────────────────┤ │
│ │             │ │                   │ │                 │ │
│ │   Content   │ │                   │ │    Content      │ │
│ │             │ │                   │ │                 │ │
│ └─────────────┘ │                   │ └─────────────────┘ │
└─────────────────┴───────────────────┴─────────────────────┘
```

### CSS Grid Layout
```css
.app-container {
  display: grid;
  grid-template-columns: 320px 1fr 400px;
  grid-template-rows: 60px 1fr;
  height: 100vh;
}

.header { grid-column: 1 / -1; }
.left-panel { grid-row: 2; }
.map-container { grid-row: 2; }
.right-panel { grid-row: 2; }
```

## Objects Mode Hierarchy

### GTFS Data Navigation Structure
```
Agency (agency.txt)
├── Routes (routes.txt filtered by agency_id)
│   ├── Trips (trips.txt filtered by route_id)
│   │   ├── Stop Times (stop_times.txt filtered by trip_id)
│   │   │   └── Stop Details (stops.txt by stop_id)
│   │   ├── Calendar (calendar.txt by service_id)
│   │   └── Calendar Dates (calendar_dates.txt by service_id)
│   └── Shapes (shapes.txt filtered by shape_id from trips)
└── Stops (stops.txt - all stops for agency routes)
```

### Navigation Flow
1. **Agency Level**: Show all agencies
2. **Route Level**: Click agency → show routes for that agency
3. **Trip Level**: Click route → show trips + calendar info for that route
4. **Stop Time Level**: Click trip → show stop times with stop names
5. **Stop Detail Level**: Click stop → show stop details + all trips serving it

### Data Relationships
```javascript
// Key relationships to implement
const relationships = {
  agency: {
    routes: (agency_id) => routes.filter(r => r.agency_id === agency_id),
    stops: (agency_id) => getStopsForAgency(agency_id) // via routes->trips->stop_times
  },
  route: {
    trips: (route_id) => trips.filter(t => t.route_id === route_id),
    stops: (route_id) => getStopsForRoute(route_id), // via trips->stop_times
    shapes: (route_id) => getShapesForRoute(route_id) // via trips
  },
  trip: {
    stopTimes: (trip_id) => stop_times.filter(st => st.trip_id === trip_id),
    calendar: (service_id) => calendar.find(c => c.service_id === service_id),
    calendarDates: (service_id) => calendar_dates.filter(cd => cd.service_id === service_id)
  },
  stop: {
    trips: (stop_id) => getTripsForStop(stop_id), // via stop_times
    routes: (stop_id) => getRoutesForStop(stop_id) // via stop_times->trips
  }
};
```

## New File Structure

### Core Architecture
```
src/
├── index.js (main app orchestrator)
├── index.html (new grid layout)
├── modules/
│   ├── data/
│   │   ├── gtfs-parser.js (existing, enhanced)
│   │   ├── gtfs-relationships.js (NEW - data relationships)
│   │   └── gtfs-validator.js (NEW - data validation)
│   ├── ui/
│   │   ├── tabs/
│   │   │   ├── tab-manager.js (NEW - tab abstraction)
│   │   │   ├── files-tab.js (NEW - Files mode)
│   │   │   ├── objects-tab.js (NEW - Objects mode)
│   │   │   ├── editor-tab.js (NEW - Editor tab)
│   │   │   ├── info-tab.js (NEW - Info tab)
│   │   │   └── help-tab.js (NEW - Help tab)
│   │   ├── panels/
│   │   │   ├── left-panel.js (NEW - left panel manager)
│   │   │   └── right-panel.js (NEW - right panel manager)
│   │   └── ui-controller.js (existing, refactored)
│   ├── views/
│   │   ├── objects/
│   │   │   ├── agency-view.js (NEW)
│   │   │   ├── route-view.js (NEW)
│   │   │   ├── trip-view.js (NEW)
│   │   │   ├── stop-view.js (NEW)
│   │   │   └── navigation.js (NEW - breadcrumb/nav)
│   │   └── files/
│   │       └── file-tree.js (NEW - extracted from ui.js)
│   ├── map-controller.js (existing, enhanced)
│   └── editor.js (existing, refactored)
└── styles/
    ├── main.css (existing, refactored)
    ├── layout.css (NEW - grid layout)
    ├── tabs.css (NEW - tab styling)
    └── objects.css (NEW - objects mode styling)
```

## Implementation Steps

### Phase 1: Layout Foundation
1. **Update HTML structure** for CSS Grid layout
2. **Create new CSS** for full-height panels and tabs
3. **Implement TabManager** base class for tab abstraction
4. **Create Panel managers** for left/right panels
5. **Update UIController** to coordinate new layout

### Phase 2: Tab System
1. **Extract Files mode** into FilesTab class
2. **Create basic ObjectsTab** structure
3. **Implement EditorTab, InfoTab, HelpTab** classes
4. **Add tab switching** functionality
5. **Style tab interface** with Tailwind

### Phase 3: GTFS Relationships
1. **Create GTFSRelationships** class for data navigation
2. **Implement data relationship** methods
3. **Add data validation** and error handling
4. **Create navigation state** management
5. **Add breadcrumb navigation** system

### Phase 4: Objects Mode Views
1. **Implement AgencyView** - list all agencies
2. **Implement RouteView** - routes for selected agency
3. **Implement TripView** - trips + calendar for selected route
4. **Implement StopView** - stop details + serving trips
5. **Add map integration** - highlight selected objects

### Phase 5: Enhanced Features
1. **Add search functionality** within Objects mode
2. **Implement data editing** in Objects mode
3. **Add export functionality** for filtered data
4. **Enhance map interactions** with object selection
5. **Add comprehensive error handling**

## Default Feed Behavior

### New Feed Initialization
```javascript
// Create minimal valid GTFS structure
const defaultGTFS = {
  'agency.txt': 'agency_id,agency_name,agency_url,agency_timezone\n1,Sample Transit,http://example.com,America/New_York',
  'routes.txt': 'route_id,agency_id,route_short_name,route_long_name,route_type\n1,1,1,Sample Route,3',
  'trips.txt': 'route_id,service_id,trip_id,trip_headsign\n1,1,1,Downtown',
  'stops.txt': 'stop_id,stop_name,stop_lat,stop_lon\n1,Main St,40.7128,-74.0060\n2,Oak Ave,40.7614,-73.9776',
  'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n1,08:00:00,08:00:00,1,1\n1,08:15:00,08:15:00,2,2',
  'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n1,1,1,1,1,1,0,0,20240101,20241231'
};
```

## Tab Interface Design

### Left Panel Tabs
- **Files**: Current file tree view
- **Objects**: New hierarchical GTFS navigation

### Right Panel Tabs
- **Editor**: CodeMirror editor (current functionality)
- **Info**: Object details, validation results, statistics
- **Help**: Documentation, keyboard shortcuts, tips

## Map Integration

### Object Mode Map Interactions
- **Agency selection**: Highlight all routes for agency
- **Route selection**: Show route shape, highlight stops
- **Trip selection**: Show trip path with timing
- **Stop selection**: Highlight stop, show connections

### Visual Hierarchy
```javascript
const mapStyles = {
  agency: { color: 'blue', weight: 2 },
  route: { color: 'green', weight: 3 },
  trip: { color: 'red', weight: 4 },
  stop: { color: 'orange', radius: 8 }
};
```

## Key Abstractions

### 1. TabManager
```javascript
class TabManager {
  constructor(containerId, tabs) {}
  addTab(id, label, content) {}
  switchTo(tabId) {}
  getCurrentTab() {}
}
```

### 2. GTFSRelationships
```javascript
class GTFSRelationships {
  constructor(gtfsData) {}
  getRoutesForAgency(agencyId) {}
  getTripsForRoute(routeId) {}
  getStopsForTrip(tripId) {}
  getTripsForStop(stopId) {}
}
```

### 3. ObjectsNavigation
```javascript
class ObjectsNavigation {
  constructor(relationships, mapController) {}
  navigateToAgency(agencyId) {}
  navigateToRoute(routeId) {}
  navigateToTrip(tripId) {}
  navigateToStop(stopId) {}
  getBreadcrumb() {}
}
```

This plan provides a comprehensive roadmap for implementing the new layout and Objects mode while maintaining clean, modular code organization.