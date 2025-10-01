# Browse - Stop Page

**Status**: 🔴 Not Started
**Priority**: Low
**Estimated Effort**: Small (1-2 days)

## Overview
Simplify stop page layout by removing the redundant information bar at the top and updating breadcrumb navigation to use `stop_id` instead of the current value.

## Checklist

- [ ] Identify the "whole bar with name and id and lat/lon" in stop page
- [ ] Remove redundant information bar from stop detail view
- [ ] Update `ObjectsNavigation.renderBreadcrumbs()` to use `stop_id` for stops
- [ ] Update `PageStateManager.getBreadcrumbs()` for stop pages
- [ ] Ensure stop information is still accessible elsewhere in the UI
- [ ] Test stop page layout after changes
- [ ] Update any dependent components or navigation logic
- [ ] Test breadcrumb navigation with stop_id

## Current Implementation

### Stop Page Structure
From `objects-navigation.ts:240-496`:

The `ObjectsNavigation` class manages the browse view, including stop details display. The stop page is rendered through `PageContentRenderer` (dependency injection pattern).

**Current Navigation Flow:**
1. User clicks stop → `onStopClick(stop_id)` called (Line 229)
2. Calls `navigateToStop(stop_id)` from `navigation-actions.ts`
3. `PageStateManager` updates state to `{type: 'stop', stop_id}`
4. `ObjectsNavigation.render()` called (Line 257-296)
5. `PageContentRenderer.renderPage()` generates stop content

### Breadcrumb Rendering
From `objects-navigation.ts:341-374`:

```typescript
renderBreadcrumbs(breadcrumbs: { label: string; pageState: PageState }[]): string {
  if (breadcrumbs.length === 0) {
    return `
      <div class="p-3 border-b border-base-300 bg-base-200">
        <div class="breadcrumbs text-sm">
          <ul>
            <li>Home</li>
          </ul>
        </div>
      </div>
    `;
  }

  const breadcrumbItems = breadcrumbs.map((item, index) => {
    const isLast = index === breadcrumbs.length - 1;
    if (isLast) {
      return `<li>${item.label}</li>`;
    } else {
      return `<li><a class="breadcrumb-item" data-breadcrumb-index="${index}">${item.label}</a></li>`;
    }
  });

  return `
    <div class="p-3 border-b border-base-300 bg-base-200">
      <div class="breadcrumbs text-sm">
        <ul>
          ${breadcrumbItems.join('')}
        </ul>
      </div>
    </div>
  `;
}
```

**Current Breadcrumb Behavior:**
- Breadcrumbs come from `PageStateManager.getBreadcrumbs()`
- `item.label` is used for display text
- Last breadcrumb is not clickable

### InfoDisplay Stop Details
From `info-display.ts:240-302`:

```typescript
showStopDetails(stop_id: string) {
  const stop = this.relationships.getStopById(stop_id);

  if (!stop) {
    this.showError('Stop not found');
    return;
  }

  const trips = this.relationships.getTripsForStop(stop_id);

  if (!this.container) return;

  this.container.innerHTML = `
    <div class="p-4 overflow-y-auto h-full">
      <div class="mb-4">
        <h3 class="text-lg font-semibold text-slate-800 mb-2">🚏 Stop Details</h3>
        <div class="bg-slate-50 rounded-lg p-4">
          <h4 class="font-medium text-slate-800 mb-3">${this.escapeHtml(stop.name)}</h4>

          <div class="space-y-2 text-sm">
            <div><strong>Stop ID:</strong> ${stop.id}</div>
            ${stop.code ? `<div><strong>Code:</strong> ${stop.code}</div>` : ''}
            ${stop.desc ? `<div><strong>Description:</strong> ${this.escapeHtml(stop.desc)}</div>` : ''}
            ${
              stop.lat && stop.lon
                ? `
              <div><strong>Location:</strong> ${stop.lat.toFixed(6)}, ${stop.lon.toFixed(6)}</div>
              <div><strong>Coordinates:</strong>
                <a href="https://www.openstreetmap.org/?mlat=${stop.lat}&mlon=${stop.lon}&zoom=18" target="_blank" class="text-info hover:underline">View on OpenStreetMap</a>
              </div>
            `
                : ''
            }
            <!-- More properties... -->
          </div>
        </div>
      </div>

      <div>
        <h4 class="font-medium text-slate-800 mb-3">Trips serving this stop (${trips.length})</h4>
        <!-- Trips list... -->
      </div>
    </div>
  `;
}
```

**Redundant Information Bar:**
Likely refers to this section (Line 258-278):
```html
<h4 class="font-medium text-slate-800 mb-3">${this.escapeHtml(stop.name)}</h4>

<div class="space-y-2 text-sm">
  <div><strong>Stop ID:</strong> ${stop.id}</div>
  <!-- ... -->
  <div><strong>Location:</strong> ${stop.lat.toFixed(6)}, ${stop.lon.toFixed(6)}</div>
</div>
```

This appears redundant if the information is also in the breadcrumb or header.

### PageStateManager Breadcrumbs
Need to check `page-state-manager.ts` for breadcrumb generation logic.

## Proposed Changes

### Change 1: Remove Redundant Information Bar

**Before:**
```
┌─────────────────────────────────────┐
│ 🚏 Stop Details                     │
├─────────────────────────────────────┤
│ Main Street Station                 │  ← Redundant header
│                                     │
│ Stop ID: stop_001                   │  ← Redundant
│ Location: 40.7489, -73.9680        │  ← Redundant
│                                     │
│ Code: 001                           │
│ Description: Main St & 5th Ave     │
└─────────────────────────────────────┘
```

**After:**
```
┌─────────────────────────────────────┐
│ 🚏 Stop Details                     │
├─────────────────────────────────────┤
│ Code: 001                           │  ← Only non-redundant info
│ Description: Main St & 5th Ave     │
│ Zone ID: A                          │
│ Wheelchair: Accessible              │
└─────────────────────────────────────┘
```

**Implementation:**

Update `info-display.ts:showStopDetails()`:

```typescript
showStopDetails(stop_id: string) {
  const stop = this.relationships.getStopById(stop_id);

  if (!stop) {
    this.showError('Stop not found');
    return;
  }

  const trips = this.relationships.getTripsForStop(stop_id);

  if (!this.container) return;

  this.container.innerHTML = `
    <div class="p-4 overflow-y-auto h-full">
      <div class="mb-4">
        <h3 class="text-lg font-semibold mb-2">🚏 Stop Details</h3>

        <!-- REMOVED: Redundant h4 with stop name -->
        <!-- REMOVED: Stop ID display (in breadcrumb) -->
        <!-- REMOVED: Location coordinates (shown on map) -->

        <div class="space-y-3">
          <!-- Only show non-redundant properties -->
          ${stop.code ? `
            <div class="form-control">
              <label class="label"><span class="label-text">Code</span></label>
              <div class="text-sm">${stop.code}</div>
            </div>
          ` : ''}

          ${stop.desc ? `
            <div class="form-control">
              <label class="label"><span class="label-text">Description</span></label>
              <div class="text-sm">${this.escapeHtml(stop.desc)}</div>
            </div>
          ` : ''}

          ${stop.zone_id ? `
            <div class="form-control">
              <label class="label"><span class="label-text">Zone ID</span></label>
              <div class="text-sm">${stop.zone_id}</div>
            </div>
          ` : ''}

          ${stop.url ? `
            <div class="form-control">
              <label class="label"><span class="label-text">URL</span></label>
              <div class="text-sm">
                <a href="${stop.url}" target="_blank" class="link link-primary">${stop.url}</a>
              </div>
            </div>
          ` : ''}

          ${stop.locationType ? `
            <div class="form-control">
              <label class="label"><span class="label-text">Location Type</span></label>
              <div class="text-sm">${this.getLocationTypeText(stop.locationType)}</div>
            </div>
          ` : ''}

          ${stop.parent_station ? `
            <div class="form-control">
              <label class="label"><span class="label-text">Parent Station</span></label>
              <div class="text-sm">${stop.parent_station}</div>
            </div>
          ` : ''}

          ${stop.wheelchairBoarding ? `
            <div class="form-control">
              <label class="label"><span class="label-text">Wheelchair Boarding</span></label>
              <div class="text-sm">${this.getWheelchairText(stop.wheelchairBoarding)}</div>
            </div>
          ` : ''}

          <!-- Map link (kept for convenience) -->
          ${stop.lat && stop.lon ? `
            <div class="form-control">
              <label class="label"><span class="label-text">View on Map</span></label>
              <a href="https://www.openstreetmap.org/?mlat=${stop.lat}&mlon=${stop.lon}&zoom=18"
                 target="_blank"
                 class="btn btn-sm btn-outline btn-primary">
                Open in OpenStreetMap
              </a>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Trips section unchanged -->
      <div>
        <h4 class="font-medium mb-3">Trips serving this stop (${trips.length})</h4>
        <div class="space-y-2 max-h-64 overflow-y-auto">
          ${trips.slice(0, 15).map(trip => `
            <div class="bg-base-200 rounded p-3">
              <div class="font-medium">${trip.id}</div>
              <div class="text-sm opacity-70">Trip: ${trip.id} | Route: ${trip.route_id}</div>
            </div>
          `).join('')}
          ${trips.length > 15 ? `
            <div class="text-sm opacity-60 text-center py-2">
              ... and ${trips.length - 15} more trips
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}
```

### Change 2: Update Breadcrumb to Use stop_id

**Current Breadcrumb (likely):**
```
Home > Stops > Main Street Station
                ^^^^^^^^^^^^^^^^^^^
                Uses stop_name
```

**New Breadcrumb:**
```
Home > Stops > stop_001
                ^^^^^^^^
                Uses stop_id
```

**Why stop_id instead of stop_name?**
- **Uniqueness**: `stop_id` is guaranteed unique, `stop_name` may have duplicates
- **Consistency**: Other entities (routes, trips) use IDs in breadcrumbs
- **GTFS Standard**: `stop_id` is the primary key
- **Technical**: Easier for URL state management

**Implementation:**

Need to update breadcrumb generation in `PageStateManager`. This likely involves:

```typescript
// In page-state-manager.ts (hypothetical location)
async getBreadcrumbs(): Promise<BreadcrumbItem[]> {
  const state = this.currentState;
  const breadcrumbs: BreadcrumbItem[] = [];

  // Home
  breadcrumbs.push({
    label: 'Home',
    pageState: { type: 'home' }
  });

  if (state.type === 'stop') {
    // OLD: Use stop name
    // const stop = await this.relationships.getStopByIdAsync(state.stop_id);
    // breadcrumbs.push({
    //   label: stop?.stop_name || state.stop_id,
    //   pageState: state
    // });

    // NEW: Use stop_id
    breadcrumbs.push({
      label: state.stop_id,
      pageState: state
    });
  }

  return breadcrumbs;
}
```

**Alternative: Show Both**
```
Home > Stops > stop_001 (Main Street Station)
```

But this may be too long for narrow screens.

### Change 3: Update Header Display

If there's a page header showing stop name, keep it but make it more prominent:

```html
<!-- In ObjectsNavigation or PageContentRenderer -->
<div class="border-b border-base-300">
  <div class="p-4">
    <h2 class="text-lg font-semibold">
      ${stop.stop_name || stop.stop_id}
    </h2>
    <p class="text-sm opacity-70">
      Stop ID: ${stop.stop_id}
    </p>
  </div>
</div>
```

This way, stop name is still visible but not redundant with properties.

## Testing Scenarios

1. **Stop Page Basic**: Navigate to stop page, verify no redundant information bar
2. **Breadcrumb Display**: Verify breadcrumb shows `stop_id` not `stop_name`
3. **Breadcrumb Navigation**: Click breadcrumb, verify navigation works
4. **Information Accessibility**: Verify all stop info is still accessible (either in header, map, or properties)
5. **Long stop_id**: Test with long stop IDs (>20 chars), verify breadcrumb doesn't overflow
6. **Special Characters**: Test stops with special characters in name/ID
7. **Duplicate Names**: Test multiple stops with same name, verify IDs distinguish them

## Edge Cases

### Multiple Stops with Same Name
```
Stop 1: stop_001, name="Main St"
Stop 2: stop_002, name="Main St"
```

Using `stop_id` in breadcrumb resolves ambiguity:
```
Home > Stops > stop_001  (clear which stop)
Home > Stops > stop_002  (clear which stop)
```

### Very Long stop_id
Some agencies use long stop IDs:
```
stop_id: "MBTA_Red_Line_Harvard_Square_Northbound_Platform_1"
```

**Solution: Truncate in breadcrumb with tooltip**
```html
<li>
  <a class="breadcrumb-item tooltip tooltip-bottom"
     data-tip="MBTA_Red_Line_Harvard_Square_Northbound_Platform_1">
    MBTA_Red_Line_...
  </a>
</li>
```

### Non-ASCII stop_id
Some international feeds use non-ASCII characters:
```
stop_id: "駅_001" (Japanese)
stop_id: "محطة_001" (Arabic)
```

Ensure breadcrumb handles UTF-8 properly (should work by default).

## Related Files

Files that may need updates:

1. **`src/modules/objects-navigation.ts`**
   - `renderBreadcrumbs()` method (Line 341-374)

2. **`src/modules/page-state-manager.ts`** (not examined yet)
   - `getBreadcrumbs()` method
   - Breadcrumb label generation logic

3. **`src/modules/info-display.ts`**
   - `showStopDetails()` method (Line 240-302)

4. **`src/modules/page-content-renderer.ts`** (referenced but not examined)
   - May contain stop page rendering logic

## Resources

- GTFS stops.txt Specification: https://gtfs.org/schedule/reference/#stopstxt
- stop_id is the primary key (required, unique)
- stop_name is optional but recommended
- Current implementation: `objects-navigation.ts:240-496`, `info-display.ts:240-302`

## Next Steps

1. Examine `page-state-manager.ts` to find breadcrumb generation logic
2. Examine `page-content-renderer.ts` for stop page rendering
3. Update `InfoDisplay.showStopDetails()` to remove redundant bar
4. Update `PageStateManager.getBreadcrumbs()` to use `stop_id`
5. Test breadcrumb navigation with updated labels
6. Ensure stop name is still visible in page header
7. Test with various stop IDs (short, long, special chars)