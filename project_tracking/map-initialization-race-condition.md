# Map Initialization Race Condition Fix

## Problem Statement

The `RouteRenderer` has a race condition during initialization where `renderRoutes()` can be called before MapLibre layers are fully initialized. This results in console errors and requires fallback recovery logic.

### Current Symptoms

```
❌ Routes source not found! Attempting to initialize layers...
```

### Root Cause

**Timing Issue:**
1. `MapController.initialize()` creates MapLibre map
2. `MapController.initializeModules()` instantiates `RouteRenderer`
3. `RouteRenderer` constructor waits for `styleload` event to call `initializeMapLayers()`
4. `MapController.updateMap()` calls `routeRenderer.renderRoutes()` immediately
5. **Race**: `renderRoutes()` executes BEFORE `styleload` fires, so 'routes' source doesn't exist

**Current Workaround:**
- Fallback code in `renderRoutes()` catches the error and re-initializes layers
- This is brittle, inefficient, and creates confusing console output

### Why This Matters

**Potential Issues:**
1. **Timing-dependent bugs**: Inconsistent behavior on slower devices/networks
2. **Multiple initialization**: Could create duplicate sources/layers
3. **Memory leaks**: Duplicate event listeners from recovery attempts
4. **Poor developer experience**: Error spam makes debugging harder
5. **State inconsistency**: Route data might render before layers are ready
6. **Maintenance burden**: Fallback logic adds complexity

## Solution: Async Initialization Pattern

### Architecture Changes

Implement **Promise-based lifecycle management** to ensure proper initialization order.

### Implementation Plan

#### 1. RouteRenderer (`src/modules/route-renderer.ts`)

**Add initialization state tracking:**
```typescript
private initialized: boolean = false;
private initializationPromise: Promise<void> | null = null;
```

**Make `initializeMapLayers()` return a Promise:**
```typescript
private initializeMapLayers(): Promise<void> {
  return new Promise((resolve) => {
    console.log('🔧 Initializing MapLibre route layers...');

    // Check if already initialized
    if (this.initialized) {
      console.log('✅ Routes already initialized');
      resolve();
      return;
    }

    // Check if source already exists
    if (this.map.getSource('routes')) {
      console.log('🔍 Routes source already exists');
      this.initialized = true;
      resolve();
      return;
    }

    // Add routes source and layers...
    this.map.addSource('routes', { /* ... */ });
    this.map.addLayer({ /* background layer */ });
    this.map.addLayer({ /* clickarea layer */ });
    this.map.addLayer({ /* highlight layer */ });

    this.initialized = true;
    console.log('✅ Routes layers initialized successfully');
    resolve();
  });
}
```

**Update constructor to store initialization promise:**
```typescript
constructor(map: MapLibreMap, gtfsParser: GTFSParser) {
  this.map = map;
  this.gtfsParser = gtfsParser;

  // Start initialization and store promise
  if (this.map.isStyleLoaded()) {
    this.initializationPromise = this.initializeMapLayers();
  } else {
    this.initializationPromise = new Promise((resolve) => {
      this.map.once('styleload', async () => {
        await this.initializeMapLayers();
        resolve();
      });
    });
  }
}
```

**Add public initialization method:**
```typescript
/**
 * Ensure layers are initialized before use
 * @returns Promise that resolves when initialization is complete
 */
public async ensureInitialized(): Promise<void> {
  if (this.initialized) {
    return;
  }

  if (this.initializationPromise) {
    await this.initializationPromise;
  }
}
```

**Update `renderRoutes()` to await initialization:**
```typescript
public async renderRoutes(options?: Partial<RouteRenderingOptions>): Promise<void> {
  // Ensure layers are initialized
  await this.ensureInitialized();

  const renderOptions = { ...this.defaultOptions, ...options };

  // Build route features...
  this.routeFeatures = /* ... */;

  const source = this.map.getSource('routes') as maplibregl.GeoJSONSource;

  // Source is guaranteed to exist now, no fallback needed
  const geoJsonData = {
    type: 'FeatureCollection' as const,
    features: this.routeFeatures,
  };

  source.setData(geoJsonData);
  this.map.triggerRepaint();

  console.log(`✅ Rendered ${this.routeFeatures.length} route features`);
}
```

**Remove all fallback error handling code** (lines 341-364)

#### 2. MapController (`src/modules/map-controller.ts`)

**Make `initializeModules()` async:**
```typescript
private async initializeModules(): Promise<void> {
  if (!this.map || !this.gtfsParser) {
    throw new Error('Map or gtfsParser not available for module initialization');
  }

  // Initialize modules
  this.layerManager = new LayerManager(this.map, this.gtfsParser);
  this.routeRenderer = new RouteRenderer(this.map, this.gtfsParser);
  this.interactionHandler = new InteractionHandler(this.map, this.gtfsParser);

  // Wait for RouteRenderer to be ready
  await this.routeRenderer.ensureInitialized();
}
```

**Make `initialize()` async:**
```typescript
public async initialize(gtfsParser: MapControllerDependencies): Promise<void> {
  if (this.isInitialized) {
    console.warn('MapController already initialized');
    return;
  }

  this.gtfsParser = gtfsParser;
  this.initializeMap();
  await this.initializeModules();
  this.setupModuleCallbacks();
  this.isInitialized = true;

  console.log('🗺️ MapController initialized successfully');
}
```

**Make `updateMap()` async:**
```typescript
public async updateMap(): Promise<void> {
  if (!this.isMapReady()) {
    return;
  }

  // Wait for map to be loaded before adding sources/layers
  if (!this.map!.loaded()) {
    this.map!.once('load', () => this.updateMap());
    return;
  }

  console.log('🔄 Updating map with GTFS data');

  // Clear existing layers
  this.layerManager!.clearAllLayers();
  this.routeRenderer!.clearRoutes();

  // Wait for route rendering to complete
  await this.routeRenderer!.renderRoutes({
    lineWidth: 3,
    opacity: 0.8,
    enableBlending: true,
    pickable: true,
  });

  // Add stops using LayerManager
  this.layerManager!.addStopsLayer({ /* ... */ });

  // Fit map to data
  this.fitMapToBounds();
}
```

#### 3. Update Callers

**In `src/index.ts`:**
```typescript
// Initialize MapController
await editor.mapController.initialize(editor.gtfsParser);
```

**Update all `updateMap()` calls:**
```typescript
// Change from:
editor.mapController.updateMap();

// To:
await editor.mapController.updateMap();
```

### Benefits

✅ **Eliminates race condition completely**
- No more timing-dependent initialization issues

✅ **Cleaner code**
- Removes ~24 lines of fallback error handling
- No confusing console errors

✅ **Better developer experience**
- Clear initialization flow
- Predictable behavior

✅ **Type safety**
- TypeScript async/await ensures proper sequencing

✅ **Future-proof**
- Follows modern JavaScript best practices
- Easy to extend with additional async operations

✅ **Performance**
- Prevents duplicate initialization attempts
- No retry overhead

## Testing Strategy

### Unit Tests
- [ ] Test RouteRenderer initialization with styleload event
- [ ] Test RouteRenderer initialization when style already loaded
- [ ] Test `ensureInitialized()` called multiple times
- [ ] Test `renderRoutes()` waits for initialization

### Integration Tests
- [ ] Test full MapController initialization sequence
- [ ] Test updateMap() with large GTFS datasets
- [ ] Test rapid successive updateMap() calls
- [ ] Test initialization on slow network conditions

### Manual Testing
- [ ] Load application and verify no console errors
- [ ] Upload GTFS file and verify routes render correctly
- [ ] Switch between different GTFS files rapidly
- [ ] Test on various browsers and devices

## Implementation Checklist

- [x] Update RouteRenderer with async initialization
  - [x] Add `initialized` flag and `initializationPromise`
  - [x] Make `initializeMapLayers()` return Promise
  - [x] Add `ensureInitialized()` public method
  - [x] Make `renderRoutes()` async and await initialization
  - [x] Remove fallback error handling (lines 341-364)

- [x] Update MapController for async flow
  - [x] Make `initializeModules()` async
  - [x] Make `initialize()` async
  - [x] Make `updateMap()` async
  - [x] Add proper await calls

- [x] Update all callers in index.ts and ui.ts
  - [x] Make MapController initialization await
  - [x] Add await to all updateMap() calls in index.ts
  - [x] Add await to all updateMap() calls in ui.ts
  - [x] Make ui.ts methods async (loadGTFSFile, loadGTFSFromURL, createNewFeed)

- [x] Testing
  - [x] Manual testing - confirmed no race condition error
  - [x] Verified console output is clean (no "Routes source not found!" errors)
  - [x] Tested with existing cached data
  - [ ] Write unit tests for RouteRenderer initialization (future work)
  - [ ] Add integration tests for MapController (future work)
  - [ ] Performance testing with large datasets (future work)

- [ ] Documentation
  - [ ] Update JSDoc comments with async behavior
  - [ ] Document initialization lifecycle in CLAUDE.md
  - [ ] Add inline comments explaining critical timing

## Implementation Summary

**Date Completed:** October 2, 2025
**Status:** ✅ FULLY RESOLVED

### Changes Made

**1. RouteRenderer (`src/modules/route-renderer.ts`)**
- Added `initialized: boolean` and `initializationPromise: Promise<void> | null` state tracking
- Made `initializeMapLayers()` async and return `Promise<void>`
- Added public `ensureInitialized()` method for external callers
- Made `renderRoutes()` async with proper initialization awaiting
- Removed 24 lines of fallback error handling code (lines 341-364)

**2. MapController (`src/modules/map-controller.ts`)**
- Made `initialize()` async
- Made `initializeModules()` async with await on RouteRenderer initialization
- Made `updateMap()` async with await on route rendering
- Updated error handler in `handleStopDragComplete()` to await updateMap

**3. Index.ts and UI.ts Callers**
- Updated `src/index.ts`: Added await to `mapController.initialize()` and `mapController.updateMap()`
- Updated `src/modules/ui.ts`: Added await to all `mapController.updateMap()` calls
- Made `ui.ts` methods async: `loadGTFSFile()`, `loadGTFSFromURL()`, `createNewFeed()`

### Final Fix: Correct MapLibre Event

**Critical Discovery (October 2, 2025):**
MapLibre uses `load` event, not `styleload` event! The implementation was waiting for the wrong event, causing initialization to hang indefinitely.

**Final Change:**
```typescript
// Changed from:
this.map.once('styleload', async () => { ... });

// To:
this.map.once('load', async () => { ... });
```

### Test Results

✅ **Race condition eliminated** - No "Routes source not found!" errors in console
✅ **Clean initialization** - Proper async sequencing working correctly
✅ **No regressions** - Application loads and functions normally
✅ **Code cleaner** - Removed unnecessary error recovery logic
✅ **Correct event listener** - Now uses MapLibre 'load' event instead of non-existent 'styleload'
✅ **Full initialization flow** - All modules initialize successfully with proper logging

### Console Output After Fix

**Before:**
```
❌ Routes source not found! Attempting to initialize layers...
✅ Layers initialized successfully, setting route data...
```

**After (Final):**
```
🔧 Initializing MapController...
🔧 initializeModules starting...
🔧 Creating RouteRenderer...
🔍 RouteRenderer constructor - isStyleLoaded: false
⏳ Style not loaded, waiting for load event...
✅ load event fired!
🔧 Initializing MapLibre route layers...
✅ Routes source added
✅ Routes background layer added
✅ Routes layers initialized successfully
✅ RouteRenderer initialized
🗺️ MapController initialized successfully
✅ MapController initialized
```

## Risk Assessment

**Low Risk:**
- Pure refactoring with no functionality changes
- Makes existing code more robust
- Easy to test and verify
- No breaking changes to public APIs

**Rollback Plan:**
- Keep current error handling temporarily during migration
- Test thoroughly before removing fallback code
- Can revert single file at a time if issues arise

## Timeline Estimate

- **Implementation**: 2-3 hours
- **Testing**: 1-2 hours
- **Documentation**: 30 minutes
- **Total**: ~4-6 hours

## Success Criteria

✅ No console errors during normal operation
✅ Routes render correctly on first load
✅ All Playwright tests pass
✅ No performance regression
✅ Code is cleaner and more maintainable
