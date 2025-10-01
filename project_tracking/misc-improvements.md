# Miscellaneous Improvements

**Status:** 📋 Planned
**Priority:** Medium
**Complexity:** Low-Medium
**Related Files:**
- `src/modules/keyboard-shortcuts.ts` - Keyboard shortcuts system
- `src/modules/gtfs-parser.ts` - File parsing and loading
- `src/modules/ui.ts` - UI controller with dropdown handling
- `src/index.html` - Load button dropdown structure

## Overview

Collection of smaller improvements and bug fixes that improve overall user experience. These are relatively self-contained changes that don't require major architectural changes.

---

## 1. Enhanced Keyboard Shortcuts

**Status:** ⚠️ Partially Implemented
**Priority:** Medium
**Complexity:** Low

### Current State

The keyboard shortcuts system exists (`src/modules/keyboard-shortcuts.ts`) and implements:
- ✅ File operations: Ctrl+N (new), Ctrl+O (upload), Ctrl+S (save), Ctrl+E (export)
- ✅ Navigation: Ctrl+F (focus map search), Esc (clear), F1 (help)
- ✅ Tab switching: Ctrl+1-5 for different tabs
- ✅ Shortcuts listed in Help tab
- ✅ Smart input field detection (doesn't trigger when typing)

### Proposed Improvements

**1. Add More Shortcuts**

```typescript
// src/modules/keyboard-shortcuts.ts - setupShortcuts()

// Add to existing shortcuts:

// Map navigation
this.addShortcut(
  'ctrl+m',
  () => {
    this.focusMap();
  },
  'Focus map view'
);

// Quick object navigation
this.addShortcut(
  'ctrl+shift+r',
  () => {
    this.navigateToTable('routes');
  },
  'Browse routes'
);

this.addShortcut(
  'ctrl+shift+s',
  () => {
    this.navigateToTable('stops');
  },
  'Browse stops'
);

this.addShortcut(
  'ctrl+shift+t',
  () => {
    this.navigateToTable('trips');
  },
  'Browse trips'
);

// Validation & info
this.addShortcut(
  'ctrl+shift+v',
  () => {
    if (this.gtfsEditor.validateCallback) {
      this.gtfsEditor.validateCallback();
    }
  },
  'Validate GTFS data'
);

// Toggle map modes
this.addShortcut(
  'a',
  (e) => {
    if (!this.isInputFocused()) {
      this.gtfsEditor.mapController?.setMode?.('add-stop');
    }
  },
  'Add stop mode (press A)'
);

this.addShortcut(
  'e',
  (e) => {
    if (!this.isInputFocused()) {
      this.gtfsEditor.mapController?.setMode?.('edit-stops');
    }
  },
  'Edit stops mode (press E)'
);

this.addShortcut(
  'escape',
  () => {
    // Exit map editing modes
    if (this.gtfsEditor.mapController?.getMode?.() !== 'view') {
      this.gtfsEditor.mapController?.setMode?.('view');
    } else {
      // Clear searches if not in editing mode
      this.clearSearches();
    }
  },
  'Exit editing mode / Clear searches'
);
```

**2. Add Helper Methods**

```typescript
// src/modules/keyboard-shortcuts.ts

private focusMap(): void {
  const mapContainer = document.getElementById('map');
  if (mapContainer) {
    mapContainer.focus();
    mapContainer.scrollIntoView({ behavior: 'smooth' });
  }
}

private navigateToTable(tableName: string): void {
  // Switch to Browse tab
  this.switchToTab('objects');

  // Use pageStateManager to navigate to table list
  if (this.gtfsEditor.pageStateManager) {
    this.gtfsEditor.pageStateManager.setPageState({
      page: 'objects',
      table: tableName
    });
  }
}

private isInputFocused(): boolean {
  const activeElement = document.activeElement;
  return (
    activeElement &&
    (activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      (activeElement as HTMLElement).contentEditable === 'true' ||
      activeElement.classList.contains('cm-content'))
  );
}
```

**3. Visual Keyboard Shortcut Hints**

Add subtle keyboard shortcut hints to UI elements:

```html
<!-- src/index.html - Update buttons with shortcut hints -->

<!-- Load button with Ctrl+O hint -->
<div tabindex="0" role="button" class="btn btn-primary btn-sm" id="load-btn">
  <svg>...</svg>
  Load
  <kbd class="kbd kbd-xs ml-2 opacity-50">⌘O</kbd>
</div>

<!-- Export button with Ctrl+E hint -->
<button id="export-btn" class="btn btn-outline btn-sm" disabled>
  <svg>...</svg>
  Export
  <kbd class="kbd kbd-xs ml-1 opacity-50">⌘E</kbd>
</button>

<!-- Save button hint in editor -->
<div class="flex items-center gap-2 ml-auto">
  <span class="text-xs opacity-50">
    Press <kbd class="kbd kbd-xs">⌘S</kbd> to save
  </span>
</div>
```

**Testing:**
- Verify all keyboard shortcuts work as expected
- Test with CodeMirror editor active (should not trigger shortcuts when typing)
- Test on both Mac (Cmd) and PC (Ctrl)
- Verify shortcuts are listed correctly in Help tab

---

## 2. Ignore Non-GTFS Standard Files

**Status:** ❌ Not Implemented
**Priority:** High (Fixes MBTA loading issue)
**Complexity:** Low

### Problem

When loading GTFS feeds that contain non-standard files (like MBTA), the parser may try to process them and fail, or they may clutter the file list unnecessarily.

Example non-standard files:
- `README.txt` - Documentation files
- `checksums.txt` - Hash verification
- `manifest.json` - Custom metadata
- `*.md` - Markdown documentation
- `.DS_Store` - macOS metadata
- `__MACOSX/` - macOS resource fork directory

### Current Behavior

```typescript
// src/modules/gtfs-parser.ts - parseFile()

const files = Object.keys(zipContent.files).filter(
  (name) => !name.startsWith('__MACOSX') && name.endsWith('.txt')
);
```

Currently only filters out `__MACOSX` directory but processes all `.txt` files.

### Proposed Solution

**1. Define GTFS Standard Files List**

```typescript
// src/utils/gtfs-metadata.ts

/**
 * Complete list of GTFS standard file names
 * Includes all required, optional, and experimental GTFS files
 */
export const GTFS_STANDARD_FILES = [
  // Required files
  'agency.txt',
  'stops.txt',
  'routes.txt',
  'trips.txt',
  'stop_times.txt',

  // Calendar files (at least one required)
  'calendar.txt',
  'calendar_dates.txt',

  // Optional files
  'fare_attributes.txt',
  'fare_rules.txt',
  'shapes.txt',
  'frequencies.txt',
  'transfers.txt',
  'pathways.txt',
  'levels.txt',
  'feed_info.txt',
  'translations.txt',
  'attributions.txt',

  // GTFS-Fares V2 files
  'fare_media.txt',
  'fare_products.txt',
  'fare_leg_rules.txt',
  'fare_transfer_rules.txt',
  'areas.txt',
  'stop_areas.txt',
  'networks.txt',
  'route_networks.txt',

  // GTFS-Flex files
  'locations.geojson',
  'location_groups.txt',
  'location_group_stops.txt',
  'booking_rules.txt',

  // Uncommon but valid GTFS files
  'timeframes.txt',
] as const;

/**
 * Check if a filename is a GTFS standard file
 */
export function isGTFSStandardFile(filename: string): boolean {
  const basename = filename.split('/').pop() || filename;
  return GTFS_STANDARD_FILES.includes(basename as any);
}
```

**2. Update Parser to Filter Non-Standard Files**

```typescript
// src/modules/gtfs-parser.ts - parseFile()

async parseFile(file: File | Blob): Promise<{ [fileName: string]: GTFSFileData }> {
  // ... existing code ...

  const zip = await JSZip.loadAsync(file);
  const zipContent = zip;

  // Filter files: only GTFS standard files
  const files = Object.keys(zipContent.files).filter((name) => {
    // Skip directories
    if (name.endsWith('/')) return false;

    // Skip hidden files and macOS metadata
    const basename = name.split('/').pop() || name;
    if (basename.startsWith('.')) return false;
    if (name.startsWith('__MACOSX/')) return false;

    // Only include GTFS standard files
    return isGTFSStandardFile(basename);
  });

  console.log(`Found ${files.length} GTFS standard files in ZIP`);

  // Log ignored files for debugging
  const ignoredFiles = Object.keys(zipContent.files).filter((name) => {
    if (name.endsWith('/')) return false;
    const basename = name.split('/').pop() || name;
    return !basename.startsWith('.') &&
           !name.startsWith('__MACOSX/') &&
           !isGTFSStandardFile(basename);
  });

  if (ignoredFiles.length > 0) {
    console.log('Ignored non-GTFS files:', ignoredFiles);

    // Optionally show notification to user
    notifications.showInfo(
      `Loaded ${files.length} GTFS files (ignored ${ignoredFiles.length} non-standard files)`,
      { duration: 3000 }
    );
  }

  // ... rest of existing code ...
}
```

**3. Handle locations.geojson Separately**

```typescript
// src/modules/gtfs-parser.ts

// Add special handling for GeoJSON files
if (fileName.endsWith('.geojson')) {
  const geojsonContent = await zipContent.files[fileName].async('string');

  try {
    const geojsonData = JSON.parse(geojsonContent);
    this.gtfsData[fileName] = {
      content: geojsonContent,
      data: geojsonData,
      errors: [],
    };

    // Store in database as JSON
    await this.gtfsDatabase.insertGeoJSON('locations', geojsonData);
  } catch (error) {
    console.error(`Failed to parse GeoJSON file ${fileName}:`, error);
    this.gtfsData[fileName] = {
      content: geojsonContent,
      data: null,
      errors: [`Invalid GeoJSON: ${error.message}`],
    };
  }

  continue;
}
```

**Testing:**
- Test with MBTA GTFS feed (known to have extra files)
- Test with feeds containing README.txt, checksums.txt
- Verify ignored files are logged but don't cause errors
- Verify all standard GTFS files are still processed
- Test with GTFS-Flex feed containing locations.geojson

---

## 3. Fix Load Button Dropdown Hiding

**Status:** ❌ Bug
**Priority:** Medium
**Complexity:** Low

### Problem

The load button dropdown may hide behind other elements or not close properly after selection. This is a DaisyUI dropdown z-index and event handling issue.

### Current Implementation

```html
<!-- src/index.html - Load Dropdown -->
<div class="dropdown dropdown-end">
  <div tabindex="0" role="button" class="btn btn-primary btn-sm" id="load-btn">
    <svg>...</svg>
    Load
  </div>
  <ul id="load-dropdown" tabindex="0"
      class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
    <li>...</li>
  </ul>
</div>
```

### Issues

1. **Z-index too low**: `z-[1]` may be behind other elements
2. **Doesn't auto-close**: Clicking items doesn't always close dropdown
3. **Nested details**: The "Examples" submenu may not work properly

### Proposed Solution

**1. Fix Z-index**

```html
<!-- Update dropdown z-index to be above other elements -->
<ul id="load-dropdown" tabindex="0"
    class="dropdown-content z-[100] menu p-2 shadow-lg bg-base-100 rounded-box w-52">
```

**2. Auto-close on Selection**

```typescript
// src/modules/ui.ts - setupEventListeners()

// Auto-close dropdown after selection
const loadDropdown = document.getElementById('load-dropdown');
if (loadDropdown) {
  loadDropdown.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Close dropdown if clicking on an action (not the submenu toggle)
    if (target.tagName === 'A' && !target.closest('details')) {
      // Remove focus from dropdown to close it
      const loadBtn = document.getElementById('load-btn');
      if (loadBtn) {
        (loadBtn as HTMLElement).blur();
      }
    }
  });
}
```

**3. Fix Nested Details/Submenu**

```html
<!-- src/index.html - Better submenu structure -->
<li>
  <details>
    <summary class="flex items-center gap-2">
      <svg>...</svg>
      Examples
    </summary>
    <ul class="p-2 bg-base-200 rounded-box">
      <li>
        <a id="example-columbia" class="active:bg-primary"
           data-url="https://raw.githubusercontent.com/maxtkc/columbia-county-gtfs/refs/heads/main/columbia_county_gtfs.zip">
          Columbia County
        </a>
      </li>
      <li>
        <a id="example-west" class="active:bg-primary"
           data-url="https://westbusservice.com/west_gtfs.zip">
          West Bus Service
        </a>
      </li>
    </ul>
  </details>
</li>
```

**4. CSS Improvements**

```css
/* src/styles/main.css */

@layer components {
  /* Ensure dropdown is always on top */
  .dropdown-content {
    @apply z-50;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
  }

  /* Smooth transitions */
  .dropdown-content {
    transition: opacity 0.15s ease, transform 0.15s ease;
    transform-origin: top right;
  }

  /* Better submenu styling */
  .dropdown details[open] summary {
    @apply bg-base-300;
  }

  .dropdown details ul {
    margin-top: 0.5rem;
    margin-left: 0.5rem;
  }
}
```

**Testing:**
- Click Load button → dropdown appears above all content
- Click "New Empty Feed" → dropdown closes immediately
- Click "Examples" → submenu opens
- Click "Columbia County" → feed loads and dropdown closes
- Click outside dropdown → dropdown closes

---

## 4. Additional Minor Improvements

### 4.1. Loading States for Remote URLs

Add better feedback when loading from remote URLs:

```typescript
// src/modules/ui.ts - loadGTFSFromURL()

async loadGTFSFromURL(url) {
  try {
    notifications.showInfo(`Loading GTFS from ${new URL(url).hostname}...`, {
      duration: 0, // Don't auto-dismiss
      id: 'url-loading'
    });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const blob = await response.blob();

    // Dismiss loading notification
    notifications.dismiss('url-loading');

    await this.loadGTFSFile(blob);

    notifications.showSuccess(`Loaded GTFS from ${new URL(url).hostname}`);
  } catch (error) {
    notifications.dismiss('url-loading');
    notifications.showError(`Failed to load from URL: ${error.message}`);
  }
}
```

### 4.2. Remember Last Used Tab

```typescript
// src/modules/tab-manager.ts

switchToTab(tabName) {
  // ... existing code ...

  // Save to localStorage
  try {
    localStorage.setItem('gtfs-zone-last-tab', tabName);
  } catch (error) {
    // Ignore localStorage errors
  }
}

initialize() {
  // Restore last used tab
  try {
    const lastTab = localStorage.getItem('gtfs-zone-last-tab');
    if (lastTab) {
      this.switchToTab(lastTab);
    }
  } catch (error) {
    // Ignore localStorage errors
  }
}
```

### 4.3. Export Filename with Timestamp

```typescript
// src/modules/ui.ts - exportGTFS()

async exportGTFS() {
  try {
    const blob = await this.gtfsParser.exportZip();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    // Include timestamp in filename
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const projectName = this.gtfsParser.getProjectName?.() || 'gtfs';

    a.href = url;
    a.download = `${projectName}_${timestamp}.zip`;
    a.click();
    URL.revokeObjectURL(url);

    notifications.showSuccess('GTFS feed exported successfully');
  } catch (error) {
    notifications.showError(`Export failed: ${error.message}`);
  }
}
```

### 4.4. Ctrl+/ for Keyboard Shortcuts

Add quick access to keyboard shortcuts list:

```typescript
// src/modules/keyboard-shortcuts.ts

this.addShortcut(
  'ctrl+/',
  (e) => {
    e.preventDefault();
    this.showShortcutsList();
  },
  'Show keyboard shortcuts'
);

private showShortcutsList(): void {
  // Switch to help tab and scroll to shortcuts section
  this.switchToTab('help');

  setTimeout(() => {
    const shortcutsSection = document.querySelector('[id*="shortcut"]');
    if (shortcutsSection) {
      shortcutsSection.scrollIntoView({ behavior: 'smooth' });
    }
  }, 100);
}
```

---

## Implementation Checklist

### Keyboard Shortcuts
- [ ] Add new shortcut mappings (Ctrl+M, Ctrl+Shift+R/S/T, etc.)
- [ ] Add single-key shortcuts for map modes (A, E)
- [ ] Add visual keyboard hints to buttons
- [ ] Update Help tab with new shortcuts
- [ ] Test on Mac and PC

### Non-GTFS Files Filtering
- [ ] Create GTFS_STANDARD_FILES constant
- [ ] Implement isGTFSStandardFile() helper
- [ ] Update parseFile() to filter non-standard files
- [ ] Add logging for ignored files
- [ ] Add user notification for ignored files
- [ ] Handle locations.geojson separately
- [ ] Test with MBTA feed

### Load Dropdown
- [ ] Fix z-index to z-50 or z-100
- [ ] Add auto-close on item click
- [ ] Fix nested submenu behavior
- [ ] Add CSS transitions
- [ ] Test dropdown behavior

### Minor Improvements
- [ ] Add loading state for remote URLs
- [ ] Remember last used tab
- [ ] Export filename with timestamp
- [ ] Add Ctrl+/ shortcut for shortcuts list

---

## Success Metrics

- All keyboard shortcuts work without conflicts
- MBTA GTFS feed loads successfully
- Load dropdown always visible and responsive
- User feedback for all async operations
- No regression in existing functionality

## Notes

- These are "low-hanging fruit" improvements that provide high value
- Can be implemented independently without dependencies
- Focus on polish and user experience
- Follow FAIL HARD error handling policy
- Use DaisyUI components for consistency
