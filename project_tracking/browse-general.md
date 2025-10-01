# Browse - General Improvements

**Status**: 🔴 Not Started
**Priority**: Medium
**Estimated Effort**: Small (3-5 days)

## Overview
Improve property display across all browse views by using DaisyUI label components and adding Zod-sourced tooltips for every property field.

## Checklist

- [ ] Audit all property display implementations
- [ ] Replace manual property labels with DaisyUI label component
- [ ] Extract tooltip descriptions from Zod schemas
- [ ] Create reusable property display component
- [ ] Add tooltips to all property fields in:
  - [ ] Agency details
  - [ ] Route details
  - [ ] Stop details
  - [ ] Trip details
  - [ ] Service details
- [ ] Test tooltip positioning and responsiveness
- [ ] Ensure consistent styling across all browse views
- [ ] Test with screen readers for accessibility
- [ ] Document property component usage pattern

## Current Implementation

### Existing Property Display
From `info-display.ts:672-752`:

```typescript
populateObjectProperties(objectData) {
  const container = document.getElementById('object-properties');
  if (!container) return;

  container.innerHTML = '';

  Object.entries(objectData).forEach(([key, value]) => {
    const propertyEl = document.createElement('div');
    propertyEl.className = 'flex flex-col gap-1';

    // Get tooltip description based on the field
    let tooltipDescription = '';
    const schemaFieldName = getSchemaFieldName(key);

    // Try to get description from different schemas
    const objectTypeEl = document.getElementById('object-type');
    const objectType = objectTypeEl ? objectTypeEl.textContent : '';

    if (objectType === 'Agency' || key.startsWith('agency_')) {
      tooltipDescription = getAgencyFieldDescription(schemaFieldName);
    } else if (objectType === 'Route' || key.startsWith('route_')) {
      tooltipDescription = getRouteFieldDescription(schemaFieldName);
    } else if (objectType === 'Service' || key.includes('date') || key.includes('day')) {
      tooltipDescription = getCalendarFieldDescription(schemaFieldName);
    }

    const labelText = key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());

    const labelEl = document.createElement('label');
    labelEl.className = 'text-xs font-medium text-secondary';

    if (tooltipDescription) {
      labelEl.innerHTML = createTooltip(labelText, tooltipDescription);
    } else {
      labelEl.textContent = labelText;
    }

    const inputEl = document.createElement('input');
    inputEl.className =
      'text-sm px-2 py-1 border border-primary rounded focus:outline-none focus:ring-1 focus:ring-blue-500';
    inputEl.type = 'text';
    inputEl.value = value || '';
    inputEl.dataset.property = key;

    propertyEl.appendChild(labelEl);
    propertyEl.appendChild(inputEl);
    container.appendChild(propertyEl);
  });
}
```

**Current Approach:**
- Manual label creation with inline styling
- Tooltips already partially implemented using `createTooltip()` helper
- Uses Zod schema descriptions via helper functions
- Inconsistent styling (not using DaisyUI components)

### Existing Tooltip System
From `zod-tooltip-helper.ts` (referenced in info-display.ts imports):

```typescript
import {
  getAgencyFieldDescription,
  getRouteFieldDescription,
  getCalendarFieldDescription,
  createTooltip,
  getSchemaFieldName,
} from '../utils/zod-tooltip-helper.js';
```

**Existing Helpers:**
- `getAgencyFieldDescription()` - Extract descriptions from AgencySchema
- `getRouteFieldDescription()` - Extract from RouteSchema
- `getCalendarFieldDescription()` - Extract from CalendarSchema
- `createTooltip()` - Generate HTML with tooltip markup
- `getSchemaFieldName()` - Convert property names to schema field names

### DaisyUI Label Component
From context7 documentation for DaisyUI (context7CompatibleLibraryID: "/saadeghi/daisyui"):

```html
<div class="form-control w-full max-w-xs">
  <label class="label">
    <span class="label-text">Property Name</span>
    <span class="label-text-alt">Alt label</span>
  </label>
  <input type="text" placeholder="Type here" class="input input-bordered w-full max-w-xs" />
  <label class="label">
    <span class="label-text-alt">Alt label</span>
    <span class="label-text-alt">Alt label</span>
  </label>
</div>
```

## Implementation Plan

### Step 1: Create Reusable Property Component

Create new file: `src/components/property-field.ts`

```typescript
import { getSchemaFieldName } from '../utils/zod-tooltip-helper.js';

interface PropertyFieldOptions {
  propertyKey: string;
  propertyValue: string | number | boolean;
  objectType?: string;
  editable?: boolean;
  onChange?: (value: string) => void;
}

export class PropertyField {
  /**
   * Render a property field with DaisyUI styling and Zod tooltip
   */
  static render(options: PropertyFieldOptions): HTMLElement {
    const {
      propertyKey,
      propertyValue,
      objectType = '',
      editable = true,
      onChange,
    } = options;

    // Create container
    const container = document.createElement('div');
    container.className = 'form-control w-full';

    // Get tooltip description from Zod schema
    const tooltipDescription = this.getTooltipForField(propertyKey, objectType);

    // Format label text (convert snake_case to Title Case)
    const labelText = propertyKey
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());

    // Create label with tooltip
    const label = document.createElement('label');
    label.className = 'label';

    const labelTextSpan = document.createElement('span');
    labelTextSpan.className = 'label-text';

    if (tooltipDescription) {
      // Add tooltip using DaisyUI tooltip
      labelTextSpan.className = 'label-text tooltip tooltip-right';
      labelTextSpan.setAttribute('data-tip', tooltipDescription);
      labelTextSpan.textContent = labelText;
    } else {
      labelTextSpan.textContent = labelText;
    }

    label.appendChild(labelTextSpan);
    container.appendChild(label);

    // Create input field
    const input = document.createElement('input');
    input.type = 'text';
    input.value = String(propertyValue || '');
    input.className = 'input input-bordered input-sm w-full';
    input.dataset.property = propertyKey;

    if (!editable) {
      input.disabled = true;
      input.className += ' input-disabled';
    }

    if (onChange) {
      input.addEventListener('change', (e) => {
        onChange((e.target as HTMLInputElement).value);
      });
    }

    container.appendChild(input);

    return container;
  }

  /**
   * Get tooltip description from Zod schema based on field name and object type
   */
  private static getTooltipForField(
    propertyKey: string,
    objectType: string
  ): string {
    const schemaFieldName = getSchemaFieldName(propertyKey);

    // Import schema helpers
    const {
      getAgencyFieldDescription,
      getRouteFieldDescription,
      getCalendarFieldDescription,
      getStopFieldDescription,
      getTripFieldDescription,
    } = require('../utils/zod-tooltip-helper.js');

    // Determine which schema to use
    if (objectType === 'Agency' || propertyKey.startsWith('agency_')) {
      return getAgencyFieldDescription(schemaFieldName);
    }

    if (objectType === 'Route' || propertyKey.startsWith('route_')) {
      return getRouteFieldDescription(schemaFieldName);
    }

    if (objectType === 'Stop' || propertyKey.startsWith('stop_')) {
      return getStopFieldDescription(schemaFieldName);
    }

    if (objectType === 'Trip' || propertyKey.startsWith('trip_')) {
      return getTripFieldDescription(schemaFieldName);
    }

    if (
      objectType === 'Service' ||
      propertyKey.startsWith('service_') ||
      propertyKey.includes('date') ||
      propertyKey.includes('day')
    ) {
      return getCalendarFieldDescription(schemaFieldName);
    }

    return '';
  }
}
```

### Step 2: Extend zod-tooltip-helper.ts

Add missing schema helper functions:

```typescript
// Add to src/utils/zod-tooltip-helper.ts

import { StopSchema, TripSchema } from '../types/gtfs.js';

/**
 * Get description for a stop field from StopSchema
 */
export function getStopFieldDescription(fieldName: string): string {
  try {
    const shape = StopSchema.shape;
    const field = shape[fieldName];

    if (field && field.description) {
      return field.description;
    }

    return '';
  } catch (error) {
    console.warn(`Could not get description for stop field: ${fieldName}`);
    return '';
  }
}

/**
 * Get description for a trip field from TripSchema
 */
export function getTripFieldDescription(fieldName: string): string {
  try {
    const shape = TripSchema.shape;
    const field = shape[fieldName];

    if (field && field.description) {
      return field.description;
    }

    return '';
  } catch (error) {
    console.warn(`Could not get description for trip field: ${fieldName}`);
    return '';
  }
}
```

### Step 3: Update InfoDisplay to Use PropertyField Component

Refactor `info-display.ts:672-752`:

```typescript
import { PropertyField } from '../components/property-field.js';

populateObjectProperties(objectData) {
  const container = document.getElementById('object-properties');
  if (!container) return;

  container.innerHTML = '';

  // Get object type for schema selection
  const objectTypeEl = document.getElementById('object-type');
  const objectType = objectTypeEl ? objectTypeEl.textContent : '';

  // Render each property using PropertyField component
  Object.entries(objectData).forEach(([key, value]) => {
    const propertyField = PropertyField.render({
      propertyKey: key,
      propertyValue: value,
      objectType: objectType,
      editable: true,
      onChange: (newValue) => {
        // Handle property value changes (future: save to database)
        console.log(`Property ${key} changed to: ${newValue}`);
      },
    });

    container.appendChild(propertyField);
  });
}
```

### Step 4: Apply to All Browse Views

Update property displays in:

1. **Agency Details** (`showAgencyDetails()` - Line 53-107)
2. **Route Details** (`showRouteDetails()` - Line 109-172)
3. **Stop Details** (`showStopDetails()` - Line 240-302)
4. **Trip Details** (`showTripDetails()` - Line 174-238)

Example for Agency Details:

```typescript
showAgencyDetails(agency_id: string) {
  const agencies = this.relationships.getAgencies();
  const agency = agencies.find((a) => a.id === agency_id);

  if (!agency) {
    this.showError('Agency not found');
    return;
  }

  const routes = this.relationships.getRoutesForAgency(agency_id);

  if (!this.container) return;

  // Build property list using PropertyField
  const properties = [
    { key: 'agency_id', value: agency.id },
    { key: 'agency_name', value: agency.name },
    { key: 'agency_url', value: agency.url },
    { key: 'agency_timezone', value: agency.timezone },
    { key: 'agency_lang', value: agency.lang },
    { key: 'agency_phone', value: agency.phone },
    { key: 'agency_email', value: agency.email },
  ].filter((prop) => prop.value); // Only show properties with values

  const propertiesHTML = properties
    .map((prop) => {
      const el = PropertyField.render({
        propertyKey: prop.key,
        propertyValue: prop.value,
        objectType: 'Agency',
        editable: false, // Read-only for now
      });
      return el.outerHTML;
    })
    .join('');

  this.container.innerHTML = `
    <div class="p-4 overflow-y-auto h-full">
      <div class="mb-4">
        <h3 class="text-lg font-semibold mb-4">🏢 Agency Details</h3>
        <div class="space-y-3">
          ${propertiesHTML}
        </div>
      </div>

      <!-- Routes section remains unchanged -->
      <div>
        <h4 class="font-medium mb-3">Routes (${routes.length})</h4>
        ${this.renderRoutesList(routes)}
      </div>
    </div>
  `;
}
```

## DaisyUI Tooltip Configuration

### Tooltip Positioning Options
```html
<!-- Position variants -->
<span class="tooltip" data-tip="Default top">Hover me</span>
<span class="tooltip tooltip-right" data-tip="Right side">Hover me</span>
<span class="tooltip tooltip-bottom" data-tip="Bottom">Hover me</span>
<span class="tooltip tooltip-left" data-tip="Left side">Hover me</span>

<!-- Color variants -->
<span class="tooltip tooltip-primary" data-tip="Primary">Hover me</span>
<span class="tooltip tooltip-secondary" data-tip="Secondary">Hover me</span>
<span class="tooltip tooltip-accent" data-tip="Accent">Hover me</span>
```

For our use case:
```html
<span class="label-text tooltip tooltip-right" data-tip="GTFS field description">
  Property Name
</span>
```

### Accessibility Considerations

DaisyUI tooltips are CSS-based and may not be screen-reader friendly. Enhance with ARIA:

```typescript
// In PropertyField.render()
if (tooltipDescription) {
  labelTextSpan.className = 'label-text tooltip tooltip-right';
  labelTextSpan.setAttribute('data-tip', tooltipDescription);
  labelTextSpan.setAttribute('aria-label', `${labelText}: ${tooltipDescription}`);
  labelTextSpan.textContent = labelText;
}
```

## Testing

### Visual Testing
- [ ] All property labels use DaisyUI label component
- [ ] Tooltips appear on hover with correct descriptions
- [ ] Tooltip positioning doesn't overflow viewport
- [ ] Consistent spacing and alignment
- [ ] Works in both light and dark themes

### Functionality Testing
- [ ] Tooltip descriptions match GTFS specification
- [ ] All object types (Agency, Route, Stop, Trip, Service) have tooltips
- [ ] Fields without descriptions don't show empty tooltips
- [ ] Tooltips work on touch devices (mobile)

### Accessibility Testing
- [ ] Screen reader announces tooltip content
- [ ] Keyboard navigation focuses labels properly
- [ ] ARIA labels are present and accurate
- [ ] Tooltip text has sufficient color contrast

## Schema Coverage

Ensure all GTFS schemas have description extraction helpers:

- [x] `AgencySchema` - getAgencyFieldDescription()
- [x] `RouteSchema` - getRouteFieldDescription()
- [x] `CalendarSchema` - getCalendarFieldDescription()
- [ ] `StopSchema` - getTripFieldDescription() (NEW)
- [ ] `TripSchema` - getTripFieldDescription() (NEW)
- [ ] `StopTimeSchema` - getStopTimeFieldDescription() (OPTIONAL)
- [ ] `FareAttributeSchema` - getFareFieldDescription() (OPTIONAL)

## Example Result

**Before:**
```html
<div class="flex flex-col gap-1">
  <label class="text-xs font-medium text-secondary">Agency Name</label>
  <input type="text" value="Metro Transit" class="text-sm px-2 py-1 border...">
</div>
```

**After:**
```html
<div class="form-control w-full">
  <label class="label">
    <span class="label-text tooltip tooltip-right"
          data-tip="Full name of the transit agency"
          aria-label="Agency Name: Full name of the transit agency">
      Agency Name
    </span>
  </label>
  <input type="text" value="Metro Transit" class="input input-bordered input-sm w-full">
</div>
```

## Resources

- DaisyUI Form Components: context7CompatibleLibraryID "/saadeghi/daisyui"
- DaisyUI Tooltips: https://daisyui.com/components/tooltip/
- Zod Schema Descriptions: Already implemented in gtfs-validator.ts
- GTFS Specification: https://gtfs.org/schedule/reference/

## Next Steps

1. Read DaisyUI documentation via context7: `/saadeghi/daisyui`
2. Create `PropertyField` component in `src/components/`
3. Add missing schema helpers to `zod-tooltip-helper.ts`
4. Update `InfoDisplay.populateObjectProperties()` to use PropertyField
5. Apply PropertyField to all browse views
6. Test tooltips across all object types
7. Test accessibility with screen reader