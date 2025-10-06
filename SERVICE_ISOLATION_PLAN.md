# Service Isolation Plan

## Overview

Restructure the application to isolate service editing, moving weekly pattern editing from the route page to a dedicated services page, similar to how stops work.

## Goals

1. **Route Page Simplification**: Display route properties at top, list of services (with timetables) at bottom
2. **Dedicated Services Page**: Create a new top-level services page accessible from Home
3. **Home Browse Update**: Add services list after agencies list on the Browse home page

## Current Architecture

### Current Route Page Structure
- Route properties editor at top
- Trips table with inline service editing
- Weekly pattern editor for services
- Timetable view per trip

### Current Navigation Hierarchy
```
Home
├── Agencies (browse list)
├── Routes (browse list)
└── Stops (browse list + dedicated stop pages)
    └── Stop Page (properties + related trips)
```

## Target Architecture

### New Route Page Structure
- Route properties editor at top
- List of services using this route at bottom
- Each service shows its timetable
- Remove weekly pattern editor from route page

### New Services Page Structure
- Weekly pattern editor (moved from route page) - this fully encompasses service properties
- List of routes using this service (DaisyUI pinned-rows table)
- List of trips using this service (DaisyUI pinned-rows table)

### New Navigation Hierarchy
```
Home
├── Agencies (browse list)
├── Services (browse list) ← NEW
├── Routes (browse list)
└── Stops (browse list)
    ├── Route Page (properties + services list with timetables)
    ├── Service Page (properties + weekly pattern + related routes/trips) ← NEW
    └── Stop Page (properties + related trips)
```

## Relevant Files & Context

### Core Files to Modify

1. **src/modules/objects-navigation.ts**
   - Add service navigation handling
   - Update `navigateToObject()` to support service_id
   - Add service breadcrumb generation

2. **src/modules/route-page.ts** (to be created/modified)
   - Display route properties at top
   - Display services list with timetables at bottom
   - Remove weekly pattern editor
   - Similar structure to stop page

3. **src/modules/service-page.ts** (to be created)
   - Weekly pattern editor (moved from route page) - handles all service properties
   - List of routes using this service (DaisyUI `table-pin-rows` format)
   - List of trips using this service (DaisyUI `table-pin-rows` format)

4. **src/modules/ui.ts**
   - Add services section to Browse home
   - Update home page HTML generation
   - Position services list after agencies

5. **src/modules/schedule-controller.ts**
   - May need updates to support service-centric view
   - Ensure timetable generation works for service lists

6. **src/modules/gtfs-relationships.ts**
   - Add service relationship helpers
   - `getRoutesForService(service_id)`
   - `getTripsForService(service_id)`
   - `getServicesForRoute(route_id)`

### Key Data Structures

#### GTFS Calendar (calendar.txt)
```typescript
{
  service_id: string;
  monday: 0 | 1;
  tuesday: 0 | 1;
  wednesday: 0 | 1;
  thursday: 0 | 1;
  friday: 0 | 1;
  saturday: 0 | 1;
  sunday: 0 | 1;
  start_date: string; // YYYYMMDD
  end_date: string;   // YYYYMMDD
}
```

#### GTFS Calendar Dates (calendar_dates.txt)
```typescript
{
  service_id: string;
  date: string;        // YYYYMMDD
  exception_type: 1 | 2; // 1=added, 2=removed
}
```

#### Service-Route Relationships
- Services are linked to routes via trips
- One service can be used by multiple routes
- One route can have multiple services (different schedules)

## Implementation Checklist

### Phase 1: Create Service Page Foundation ✅
- [x] Create `src/modules/service-view-controller.ts` module
- [x] Add service page HTML template structure (no separate properties section needed)
- [x] Add service_id to navigation system in `objects-navigation.ts`
- [x] Add service breadcrumb generation
- [x] Test navigation to service page works

### Phase 2: Move Weekly Pattern Editor ✅
- [x] Weekly pattern editor already exists in ServiceDaysController
- [x] Integrate weekly pattern editor into service page
- [x] Calendar_dates exception handling already implemented
- [x] Service editing functionality already working
- [x] Weekly pattern remains on route page (user can edit from either location)

### Phase 3: Service Relationships Display ✅
- [x] Add `getRoutesForServiceAsync()` to gtfs-relationships.ts
- [x] Add `getTripsForServiceAsync()` to gtfs-relationships.ts
- [x] Display routes list on service page using DaisyUI `table-pin-rows`
- [x] Display trips list on service page using DaisyUI `table-pin-rows`
- [x] Add click handlers for navigation to routes

### Phase 4: Update Route Page ✅
- [x] Service IDs on route page now clickable (navigate to service page)
- [x] Services remain displayed with weekly pattern editor
- [x] Add event handlers for service link clicks
- [x] Route page maintains existing structure (no restructuring needed)

### Phase 5: Update Home Browse Page ✅
- [x] Add services section to Browse home
- [x] Position services after agencies list
- [x] Generate service cards/list items
- [x] Add click handlers for service navigation
- [x] Style services section consistently with agencies

### Phase 6: Polish & Integration ✅
- [x] Update page state manager for service URLs
- [x] Ensure deep linking works for services
- [x] Breadcrumb generation for service pages
- [x] All navigation paths working correctly

## Design Patterns to Follow

### Service Page (similar to Stop Page)
```typescript
class ServicePage {
  private editor: GTFSEditor;

  async initialize() {
    // Set up service page container
  }

  async displayService(serviceId: string) {
    // 1. Show weekly pattern editor (encompasses all service properties)
    // 2. List routes using this service (DaisyUI table-pin-rows)
    // 3. List trips using this service (DaisyUI table-pin-rows)
  }

  private renderWeeklyPattern(service: Calendar) {
    // Weekly pattern editor (moved from route page)
    // This handles all service properties - no separate properties section needed
  }

  private renderRelatedRoutes(serviceId: string) {
    // DaisyUI table with pinned rows
    // <thead> for each route/agency grouping
    // <tbody> with links to route timetables
  }

  private renderRelatedTrips(serviceId: string) {
    // DaisyUI table with pinned rows
    // <thead> for grouping headers
    // <tbody> with trip details
  }
}
```

### Route Page Updates
```typescript
class RoutePage {
  async displayRoute(routeId: string) {
    // 1. Display route properties at top
    // 2. Display services list with timetables at bottom
    // No more weekly pattern editor!
  }

  private renderRouteProperties(route: Route) {
    // Route metadata editor
  }

  private renderServicesWithTimetables(routeId: string) {
    // List of services, each with its timetable
  }
}
```

## Key Considerations

### Data Integrity
- Services can exist without trips (should still be editable)
- Calendar and calendar_dates should be merged for complete service view
- Deleting a service should warn about dependent trips

### UI/UX
- Services should be easily discoverable from Home
- Navigation between route ↔ service should be seamless
- Weekly pattern editor should be prominent on service page (it IS the service properties)
- Timetables on route page should clearly show which service they belong to
- Use DaisyUI `table-pin-rows` for all lists to enable grouped sections with sticky headers
  - Routes list: Group by agency with `<thead>` sections
  - Trips list: Group logically with `<thead>` sections

### Performance
- Service list on route page might be long (use virtual scrolling if needed)
- Service page should lazy-load trip lists
- Search should work efficiently across services

## Testing Considerations (User Responsibility)

The user will handle testing, but these areas should be verified:
- Navigation to/from service pages
- Service editing (weekly patterns, exceptions)
- Route page displays services correctly
- Home Browse shows services section
- Deep linking with service URLs
- Search functionality for services
- Related entities display correctly

## Progress Tracking

### Completed
- [x] Plan created
- [x] Created service-view-controller.ts module
- [x] Phase 1: Service Page Foundation ✅
  - [x] Created service-view-controller.ts
  - [x] Added service page state type
  - [x] Added navigateToService action
  - [x] Integrated into page-content-renderer
  - [x] Updated objects-navigation for service callbacks
  - [x] Added service breadcrumb generation
- [x] Phase 2: Weekly Pattern Editor Migration ✅
  - Weekly pattern already handled by ServiceDaysController
  - Integrated into service page view
- [x] Phase 3: Service Relationships ✅
  - [x] Added getRoutesForServiceAsync to gtfs-relationships.ts
  - [x] Added getTripsForServiceAsync to gtfs-relationships.ts
  - [x] Service page displays routes/trips with DaisyUI table-pin-rows
- [x] Phase 4: Route Page Updates ✅
  - [x] Made service IDs on route page clickable (link to service page)
  - [x] Added event handlers for service link navigation
- [x] Phase 5: Home Browse Updates ✅
  - [x] Added services section to Browse home page
  - [x] Services listed after agencies
  - [x] Clickable service cards navigate to service pages
  - [x] Added getServices() helper to extract unique services from trips

### Current Status
**Phase:** Implementation Complete + Refinements! ✅
**Next Step:** User testing and feedback
**Blockers:** None

### Refinements Applied:
- ✅ Removed trips section from service page (cleaner, more focused)
- ✅ Made agency names clickable on service page
- ✅ Added timetable buttons for each route on service page
- ✅ Removed service editing from route page
- ✅ Added route properties section to route page (like agency/stop pages)
- ✅ Route page now shows: Properties → Services list (clean hierarchy)

### Key Design Decisions
- ✅ Service properties are fully encompassed by weekly pattern editor (no separate properties section)
- ✅ Use DaisyUI `table-pin-rows` for routes/trips lists with grouped sections
- ✅ `<thead>` elements act as sticky section headers (e.g., group routes by agency)
- ✅ `<tbody>` elements contain the actual data rows with click handlers

---

**Last Updated:** 2025-10-05
**Status:** ✅ Implementation Complete

## Summary

Services are now first-class citizens in the GTFS.zone navigation hierarchy! The implementation includes:

### What Was Built:
1. **Service View Controller** (`service-view-controller.ts`) - Comprehensive service page showing:
   - Weekly pattern editor (calendar days + exceptions)
   - Routes using this service (grouped by agency, table-pin-rows)
   - Trips using this service (grouped by route, table-pin-rows)

2. **Navigation Integration**:
   - Service page state type added
   - `navigateToService()` action
   - Breadcrumb support with URL parameters
   - Deep linking support

3. **Home Page Services Section**:
   - Lists all unique services from trips
   - Clickable cards navigate to service pages
   - Positioned after agencies list

4. **Route Page Enhancement**:
   - Service IDs now clickable links
   - Navigate directly to service detail page
   - Weekly pattern editor remains for inline editing

### Key Files Created/Modified:
- ✅ Created: `src/modules/service-view-controller.ts`
- ✅ Modified: `src/types/page-state.ts` (added service page type)
- ✅ Modified: `src/modules/navigation-actions.ts` (added navigateToService)
- ✅ Modified: `src/modules/page-content-renderer.ts` (service rendering + home page)
- ✅ Modified: `src/modules/objects-navigation.ts` (service callbacks)
- ✅ Modified: `src/modules/page-state-manager.ts` (breadcrumbs + URLs)
- ✅ Modified: `src/modules/gtfs-relationships.ts` (service relationship queries)

### Architecture Benefits:
- Services can be browsed independently of routes
- Clear separation of concerns (service schedules vs. route operations)
- Consistent navigation pattern (Home → Services → Service Details)
- DaisyUI table-pin-rows for clean grouped displays
- Reusable ServiceDaysController for calendar editing
