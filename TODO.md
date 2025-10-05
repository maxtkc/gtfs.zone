# TODO

## Map

### Routing
📁 See detailed plan: [`project_tracking/map-routing.md`](project_tracking/map-routing.md)

- [ ] With the edit tool, when you drag a route out, it will ask for two anchors (points on the route to navigate between). For each anchor, it will give you the option for a straight line to the anchor

### Stop
📁 See detailed plan: [`project_tracking/map-stops.md`](project_tracking/map-stops.md)

- [x] Smaller white dot with black circle around it
- [ ] Highlighted: slightly grey at the center of the stop dot
- [ ] When lines are parallel, use ties

### Enhancements
📁 See detailed plan: [`project_tracking/map-enhancements.md`](project_tracking/map-enhancements.md)

- [ ] Different basemap options (stamen, satellite)
- [ ] Instead of yellow highlight, maybe slightly thicker?
- [ ] Handle overlapping routes with `Turf.js`: https://turfjs.org/docs/api/lineOverlap

## Browse

#### General
📁 See detailed plan: [`project_tracking/browse-general.md`](project_tracking/browse-general.md)

- [ ] Use daisyui label component for properties
- [ ] Add zod sourced tooltips to every property component

### Stop
📁 See detailed plan: [`project_tracking/browse-stop.md`](project_tracking/browse-stop.md)

- [ ] Remove the whole bar with name and id and lat/lon
- [ ] Change breadcrumb to use stop_id
- [ ] Navigate between stops along a route (low priority enhancement)

### Route Page
📁 See detailed plan: [`project_tracking/browse-route.md`](project_tracking/browse-route.md)

- [ ] Refresh after adding service exception
- [ ] Show other routes that use the service (and note that modifications will affect other routes)
- [ ] Duplicate service button (duplicates trips, optionally duplicates trips from other routes too?)
- [ ] Add new service button
- [ ] Maybe add special service exception adders (holidays, every other, etc)

> Note: Services can be used by multiple agencies

### Timetable

#### Editing
📁 See detailed plan: [`project_tracking/timetable-editing.md`](project_tracking/timetable-editing.md)

- [ ] Support adding a stop row at the bottom. After putting in the time, this will get shuffled into the appropriate spot (because of the next bullet)
- [ ] Re calculate the stop_time.stop_sequence after every time edit. If the order changes, this should trigger a reorder with the alg
- [x] Adding a trip via always-visible input column
- [x] Adding a stop via always-visible dropdown row
- [ ] support more `stop_time` fields, ex `pickup_type`, `timepoint`
  - [ ] Maybe we can do this by hovering over the cell and adding enhancements
- [ ] Edit trip properties
  - [ ] This will most likely be a new trip page. We could also consider a hover similar to cells in the timetable

#### Enhancements
📁 See detailed plan: [`project_tracking/timetable-enhancements.md`](project_tracking/timetable-enhancements.md)

- [ ] Click stop from timetable to edit stop
- [ ] Nice looking dots on the left with the color line showing a visual like a stop map
- [ ] Add combined directions (flip trips in one direction and sort by start time)

## Mobile support
📁 See detailed plan: [`project_tracking/mobile-support.md`](project_tracking/mobile-support.md)

- [ ] The map is still the main thing. The sidebar becomes a bottom bar and you can swipe down to see more there

## Misc
📁 See detailed plan: [`project_tracking/misc-improvements.md`](project_tracking/misc-improvements.md)

- [ ] Add keyboard shortcuts
- [ ] Ignore non GTFS standard files (this will maybe fix loading MBTA)
- [x] Fix load button dropdown hiding
- [ ] Revamp the notification system (shouldn't cover important buttons, should be a unified interface)

## Code Quality

### Map Initialization Race Condition
📁 See detailed plan: [`project_tracking/map-initialization-race-condition.md`](project_tracking/map-initialization-race-condition.md)

- [ ] Fix race condition in RouteRenderer initialization
- [ ] Implement proper async/await initialization pattern
- [ ] Remove error recovery fallback logic

### GTFS Validation

- [ ] Better support for Conditionally Required GTFS fields

## Release 0.1.0
📁 See detailed plan: [`project_tracking/release-0.1.0.md`](project_tracking/release-0.1.0.md)

AT SOME POINT, CODE FREEZE AND RELEASE 0.1.0!
