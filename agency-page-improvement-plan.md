# Agency Page Improvement Plan

## Overview
Improve the agency page in Browse to match the quality and functionality of the stop page. Add agency properties editing and a cleaner routes list display using DaisyUI components.

## Current State
- The agency page currently shows only a simple list of route cards (see `src/modules/page-content-renderer.ts:243-317`)
- Routes are displayed with color badges but no properties editing for the agency
- No agency properties panel similar to the stop properties panel

## Desired State
- Agency page should have a two-section layout:
  1. **Agency Properties** - Editable form fields for all agency attributes
  2. **Routes List** - Clean DaisyUI list showing route ID, name, and route color indicator
- Reuse the same patterns from `StopViewController` for consistency
- Use DaisyUI indicators or badges to show route colors cleanly (not full background)

## Technical Details

### Agency Schema (from `src/types/gtfs.ts:555-597`)
The agency table has the following fields:
- `agency_id` (string) - Unique identifier
- `agency_name` (string, required) - Full name
- `agency_url` (string, required) - URL
- `agency_timezone` (string, required) - Timezone
- `agency_lang` (string, optional) - Primary language
- `agency_phone` (string, optional) - Phone number
- `agency_fare_url` (string, optional) - Fare purchase URL
- `agency_email` (string, optional) - Customer service email

### Routes Schema Fields (relevant for display)
- `route_id` - Unique identifier
- `route_short_name` - Short name/number
- `route_long_name` - Full descriptive name
- `route_color` - Background color (hex without #)
- `route_text_color` - Text color for badges (hex without #)

## Implementation Plan

### 1. Create AgencyViewController
Create a new file `src/modules/agency-view-controller.ts` modeled after `StopViewController`:

**Key responsibilities:**
- Render agency properties section with editable fields
- Render routes list in a clean DaisyUI format
- Handle property updates with auto-save
- Add event listeners for field inputs and route clicks

**Structure:**
```typescript
export interface AgencyViewDependencies {
  gtfsDatabase?: {
    queryRows: (tableName: string, filter?: Record<string, unknown>) => Promise<unknown[]>;
    updateRow: (tableName: string, key: string, data: Record<string, unknown>) => Promise<void>;
  };
  onRouteClick: (route_id: string) => void;
}

export class AgencyViewController {
  async renderAgencyView(agency_id: string): Promise<string>
  private renderAgencyProperties(agency: Agency): string
  private renderRoutesList(routes: Routes[]): string
  async updateAgencyProperty(field: string, newValue: string): Promise<boolean>
  addEventListeners(container: HTMLElement): void
}
```

### 2. Update PageContentRenderer
Modify `src/modules/page-content-renderer.ts`:

**Changes:**
- Import and instantiate `AgencyViewController` (similar to `StopViewController`)
- Update `renderAgency()` method (line 243) to use the new controller
- Add agency controller event listeners in `addEventListeners()` method (line 478)
- Pass database dependencies to agency controller

### 3. Routes List UI Design
Use DaisyUI list/menu components for clean route display:

**Option 1: DaisyUI Menu with Indicators**
```html
<ul class="menu bg-base-100 w-full">
  <li>
    <a class="route-item" data-route-id="1">
      <div class="indicator">
        <span class="indicator-item badge badge-sm" style="background-color: #FF0000"></span>
        <div class="flex flex-col items-start">
          <span class="font-semibold">Route 1</span>
          <span class="text-sm opacity-70">Downtown Express</span>
        </div>
      </div>
    </a>
  </li>
</ul>
```

**Option 2: Simple List with Color Dots**
```html
<div class="space-y-2">
  <div class="flex items-center gap-3 p-3 rounded-lg hover:bg-base-200 cursor-pointer">
    <div class="w-3 h-3 rounded-full" style="background-color: #FF0000"></div>
    <div class="flex-1">
      <div class="font-semibold">Route 1</div>
      <div class="text-sm opacity-70">Downtown Express</div>
    </div>
  </div>
</div>
```

**Recommended:** Option 2 for simplicity and cleanliness

### 4. Field Component Reuse
Leverage existing utilities from `src/utils/field-component.ts`:
- `generateFieldConfigsFromSchema()` - Generate field configs from `AgencySchema`
- `renderFormFields()` - Render the editable form fields
- Use `data-table="agency.txt"` attribute for field identification
- Use `data-field="[field_name]"` for field-specific handling

## Implementation Checklist

- [ ] Create `src/modules/agency-view-controller.ts`
  - [ ] Define `AgencyViewDependencies` interface
  - [ ] Define `EnhancedAgency` interface (with dual property access like StopViewController)
  - [ ] Implement `AgencyViewController` class
  - [ ] Implement `renderAgencyView()` method
  - [ ] Implement `renderAgencyProperties()` - use `generateFieldConfigsFromSchema()` with `AgencySchema`
  - [ ] Implement `renderRoutesList()` - use clean DaisyUI list with color indicators
  - [ ] Implement `getAgencyData()` method
  - [ ] Implement `getRoutesForAgency()` method
  - [ ] Implement `updateAgencyProperty()` with auto-save and notifications
  - [ ] Implement `addEventListeners()` for field inputs and route clicks
  - [ ] Implement `getFieldDisplayName()` helper
  - [ ] Implement `renderError()` helper

- [ ] Update `src/modules/page-content-renderer.ts`
  - [ ] Import `AgencyViewController` and `AgencyViewDependencies`
  - [ ] Add `agencyViewController` as class property
  - [ ] Initialize `AgencyViewController` in constructor
  - [ ] Update `renderAgency()` to use `agencyViewController.renderAgencyView()`
  - [ ] Update dependencies passed to agency controller
  - [ ] Add agency controller event listeners in `addEventListeners()`

- [ ] Test the implementation
  - [ ] Verify agency properties are displayed correctly
  - [ ] Verify all agency fields are editable
  - [ ] Verify field updates save to database
  - [ ] Verify notifications show on successful updates
  - [ ] Verify routes list displays cleanly
  - [ ] Verify route color indicators appear correctly
  - [ ] Verify clicking routes navigates correctly
  - [ ] Test with agencies that have many routes
  - [ ] Test with agencies that have no routes
  - [ ] Test with optional fields (empty/null values)

## Design Notes

### Agency Properties Card
- Should look exactly like stop properties card
- Use same card styling: `card bg-base-100 shadow-lg`
- Use same form layout: `max-w-md` for field width
- Fields should be full-width within the container

### Routes List
- Keep it simple and scannable
- Route color should be subtle (small dot/badge, not full background)
- Show route ID and name clearly
- Make list items interactive (hover state, cursor pointer)
- Handle long route names with truncation or wrapping
- Consider showing route count at top (e.g., "12 routes")

### Color Presentation
- Use a small colored circle (8-12px diameter) or DaisyUI indicator
- Position consistently (left side of route item)
- Fallback to default color if `route_color` is not specified
- Ensure color contrast is accessible

## File References

### Files to Create
- `src/modules/agency-view-controller.ts` (new file, ~450-500 lines, modeled after stop-view-controller.ts)

### Files to Modify
- `src/modules/page-content-renderer.ts:243-317` - Update `renderAgency()` method
- `src/modules/page-content-renderer.ts:478-518` - Update `addEventListeners()` method
- `src/modules/page-content-renderer.ts:86-101` - Update constructor to initialize agency controller

### Files for Reference
- `src/modules/stop-view-controller.ts` - Primary reference for structure and patterns
- `src/types/gtfs.ts:555-597` - AgencySchema definition
- `src/utils/field-component.ts` - Field rendering utilities

## Notes
- This should be a relatively small code change since we're reusing the stop page patterns
- The main work is creating the new controller and updating the page renderer
- Use the same auto-save behavior as stop properties (update on `change` event)
- Use the same notification patterns for user feedback
- Keep the UI consistent with the rest of the app (DaisyUI components, same spacing)
