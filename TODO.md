- Every file should always exist in the Files
- We should be able to diff with the most recently uploaded file (maybe we should have a diff-base? Should it be commit based?)
- Bus/train selector/filters
- Lets make a plan to revamp the map overlays.

Ideas:

- File based editing is there only for bulk custom edits, mostly shouldn't need to be touched

### Timetable

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

#### GTFS State ✅ COMPLETED

- ✅ IndexedDB implementation complete with row-level storage
- ✅ Persistent storage for 30MB+ files with real-time editing
- ✅ Complete fallback system for unsupported browsers
- ✅ Performance optimizations and comprehensive testing

### Mobile support

- The map is still the main thing. The sidebar becomes a bottom bar and you can swipe down to see more there

### Misc

- Fix the lint issue
- Add dropdowns for enum fields
- Fix the tooltips, zod isn't working correctly
- Remove the junk gtfs feed and start properly empty
