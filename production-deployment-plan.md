# Production Deployment Plan

## Objective
Remove auto-loading GTFS feeds to prepare the application for production deployment. The page should load with no GTFS feed by default, while preserving example feeds in the Load → Examples dropdown.

## Current State Analysis
- [x] ~~Test GTFS feed auto-loads on page initialization~~ **Not found - only Columbia County loads**
- [x] Columbia County GTFS auto-loads when no URL params (lines 1170-1174 in ui.ts)
- [x] Examples dropdown contains sample feeds (preserved in index.html)
- [x] "Load new empty feed" functionality exists (initializeEmpty method)

## Tasks Checklist

### 1. Code Analysis
- [x] Identify where auto-loading is implemented in the codebase
- [x] ~~Locate test GTFS feed loading code~~ **No test feed auto-loading found**
- [x] Locate Columbia County GTFS loading code (ui.ts:1170-1174)
- [x] Document current initialization flow

### 2. Remove Auto-Loading
- [x] ~~Remove test GTFS feed auto-loading from initialization~~ **No test feed found**
- [x] Remove Columbia County GTFS auto-loading from initialization
- [x] Ensure clean startup with no default feed loaded
- [x] Show welcome overlay on empty startup

### 3. Preserve Existing Functionality
- [x] Verify examples dropdown still contains sample feeds
- [x] Ensure examples can still be loaded from dropdown
- [x] Verify "Load new empty feed" creates proper empty state
- [x] Test URL parameter loading still works (gtfs.zone/?url=...)

### 4. Testing & Validation
- [ ] Test page loads with empty state
- [ ] Test examples dropdown functionality
- [ ] Test "Load new empty feed" button
- [ ] Test URL parameter loading
- [ ] Verify no console errors on startup
- [ ] Test all existing functionality still works

### 5. Documentation Updates
- [ ] Update CLAUDE.md if needed
- [ ] Update any developer documentation
- [ ] Note production-ready state

## Files Modified
- [x] `src/modules/ui.ts` - Removed Columbia County auto-loading (lines 1170-1174)
- [x] `src/index.ts` - Removed welcome overlay hiding logic (lines 135-139)
- [x] `src/modules/gtfs-parser.ts` - Replaced sample data with empty arrays in initializeEmpty() (lines 31-82)

## Success Criteria
✅ Page loads with no GTFS feed
✅ Examples dropdown remains functional
✅ "Load new empty feed" works correctly
✅ URL parameter loading still works
✅ No breaking changes to existing functionality
✅ Clean startup with no console errors

## Notes
- Preserve all example feeds in dropdown for demo purposes
- Maintain backward compatibility with URL parameters
- Ensure clean, professional first impression for production users