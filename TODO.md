### Timetable

- Use Shortest common supersequence to align the trips for a timetable
- Fix algorithm. We want to take all of the unique trip sequences and use MLCS to order all of the stops
- Fix scrolling (you should be able to scroll past the properties, or at least hide them, maybe hidden is better because these are not often edited)
- Editable service properties (this shouldn't be too difficult)
- Editable times (hopefully this isn't hard?)
- Then add a button to adjust all future times by the same offset
- Duplicate trip
- (Someday) create a new trip/new service
- (Someday) (better than) string line plot for showing where vehicles are at any given time

### Map

- Lets use the TransitApp for inspiration
- Hover for details so it feels very reactive

#### Home view/Agency view

This will show everything at a high level.

- Thin lines and circles with white bubbles
- Lines next to each other will show next to each other, stops that are shared will be white ovals

#### Route view

- Show all of the stops on that route

#### Stop view

- Maybe a modal for a more modern look
- Shows the routes that stop there
- Maybe should look like google maps?

### State Management

#### Browser state

- This is less important
- Revamp breadcrumbs?

#### GTFS State ✅ COMPLETED

- ✅ IndexedDB implementation complete with row-level storage
- ✅ Persistent storage for 30MB+ files with real-time editing
- ✅ Complete fallback system for unsupported browsers
- ✅ Performance optimizations and comprehensive testing

### Mobile support

- The map is still the main thing. The sidebar becomes a bottom bar and you can swipe down to see more there

### Misc

- Add dropdowns for enum fields
- Fix the tooltips, zod isn't working correctly
- Remove the junk gtfs feed and start properly empty
- Smooth map transitions
- Remove random map hover
- Draw stops with the proper route colors
- Support departure time


### Important

- Bigish issue: When I click on a route on the map and click the schedule, I don't know which direction
- Also, the timetable alg places the sotps kinda weird. It shouldn't repeat them. Idk how to properly do this. Can SCS return the alignments, or should we figure them out?
