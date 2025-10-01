# Mobile Support

**Status:** 📋 Planned
**Priority:** High
**Complexity:** High
**Related Files:**
- `src/index.html` - Main layout structure
- `src/styles/main.css` - Application styling
- `src/modules/ui.ts` - UI controller
- `src/modules/tab-manager.ts` - Tab switching logic
- `src/modules/map-controller.ts` - Map interactions

## Overview

Implement mobile-responsive design to make gtfs.zone fully functional on smartphones and tablets. The current desktop layout uses a fixed grid with map on left and sidebar on right. The mobile experience should prioritize the map while providing easy access to data through a bottom drawer interface.

## Current State

### Desktop Layout (Working)
- ✅ Grid layout: Map (left) + Sidebar (650px right)
- ✅ Fixed navbar at top
- ✅ Tabs in right sidebar (Browse, Files, Help)
- ✅ Responsive map that fills available space
- ✅ Viewport meta tag present: `width=device-width, initial-scale=1.0`

### Mobile Layout (Not Implemented)
- ❌ No responsive breakpoints defined
- ❌ Fixed 650px sidebar doesn't work on mobile
- ❌ No bottom drawer/sheet for mobile
- ❌ Touch interactions not optimized
- ❌ Small tap targets for map controls

## Design Goals

### Mobile-First Principles

1. **Map Priority**: Map should be the primary view on mobile
2. **Bottom Drawer**: Swipeable bottom drawer for data access
3. **Touch-Friendly**: Large tap targets (min 44x44px)
4. **Gesture Support**: Swipe to expand/collapse drawer
5. **Progressive Enhancement**: Works on all screen sizes

### Breakpoints Strategy

Following Tailwind CSS defaults (DaisyUI compatible):
- `sm`: 640px (large phones, small tablets)
- `md`: 768px (tablets)
- `lg`: 1024px (small laptops)
- `xl`: 1280px (desktops) ← Current layout threshold

## Implementation Plan

### Phase 1: Responsive Layout Foundation

**1. Update HTML Structure for Mobile**

Current layout:
```html
<div class="app-container h-screen grid grid-cols-[1fr_650px] grid-rows-[auto_1fr]">
```

Mobile-responsive layout:
```html
<!-- src/index.html -->
<div class="app-container h-screen flex flex-col xl:grid xl:grid-cols-[1fr_650px] xl:grid-rows-[auto_1fr]">
  <!-- Navbar: Full width on all screens -->
  <div class="navbar bg-base-100 border-b border-base-300 xl:col-span-2">
    ...
  </div>

  <!-- Map Container: Full screen on mobile, left side on desktop -->
  <div class="relative bg-base-300 flex-1 xl:flex-initial">
    <div id="map" class="w-full h-full"></div>
    ...
  </div>

  <!-- Mobile Bottom Drawer / Desktop Right Panel -->
  <div class="mobile-drawer xl:right-panel">
    ...
  </div>
</div>
```

**2. Implement Bottom Drawer for Mobile**

```css
/* src/styles/main.css */

@layer components {
  /* Mobile drawer - hidden by default, slides up from bottom */
  .mobile-drawer {
    @apply fixed bottom-0 left-0 right-0 bg-base-200 border-t border-base-300;
    @apply transform transition-transform duration-300 ease-in-out;
    @apply z-50;

    /* Default state: collapsed (peek view) */
    height: 60px;
    transform: translateY(0);
  }

  /* Drawer expanded state */
  .mobile-drawer.expanded {
    height: 70vh;
    transform: translateY(0);
  }

  /* Drawer fully hidden */
  .mobile-drawer.hidden {
    transform: translateY(100%);
  }

  /* Desktop: becomes fixed right sidebar */
  @media (min-width: 1280px) {
    .mobile-drawer {
      @apply static;
      @apply border-l border-t-0;
      width: 650px;
      height: 100%;
      transform: none;
    }

    .mobile-drawer.expanded,
    .mobile-drawer.hidden {
      @apply static;
      width: 650px;
      height: 100%;
      transform: none;
    }
  }

  /* Drawer handle for mobile */
  .drawer-handle {
    @apply flex items-center justify-center;
    @apply h-12 cursor-pointer;
    @apply xl:hidden; /* Hide on desktop */
  }

  .drawer-handle::before {
    content: '';
    @apply block w-12 h-1 rounded-full bg-base-content;
    opacity: 0.3;
  }

  /* Drawer content area */
  .drawer-content {
    @apply overflow-y-auto;
    height: calc(100% - 48px); /* Subtract handle height */
  }

  /* On desktop, no handle so full height */
  @media (min-width: 1280px) {
    .drawer-content {
      height: 100%;
    }
  }
}
```

**3. Update HTML for Drawer Structure**

```html
<!-- Mobile Bottom Drawer / Desktop Right Panel -->
<div class="mobile-drawer" id="mobile-drawer">
  <!-- Drawer Handle (mobile only) -->
  <div class="drawer-handle" id="drawer-handle">
    <!-- Handle line rendered via CSS ::before -->
  </div>

  <!-- Drawer Content -->
  <div class="drawer-content">
    <!-- Existing tabs content -->
    <div class="tabs tabs-bordered flex-1 overflow-hidden">
      <!-- Browse Tab -->
      <input type="radio" name="main_tabs" id="objects-tab-radio" class="tab"
             aria-label="Browse" checked="checked" />
      <div class="tab-content h-full overflow-y-auto bg-base-100 border-base-300 p-0">
        ...
      </div>

      <!-- Files Tab -->
      <input type="radio" name="main_tabs" id="files-tab-radio" class="tab"
             aria-label="Files" />
      <div class="tab-content h-full overflow-y-auto bg-base-100 border-base-300 p-0">
        ...
      </div>

      <!-- Help Tab -->
      <input type="radio" name="main_tabs" id="help-tab-radio" class="tab"
             aria-label="Help" />
      <div class="tab-content h-full overflow-y-auto bg-base-100 border-base-300 p-0">
        ...
      </div>
    </div>
  </div>
</div>
```

**4. Implement Drawer Interaction Controller**

```typescript
// src/modules/mobile-drawer-controller.ts

/**
 * Mobile Drawer Controller
 * Handles swipe gestures and drawer state for mobile devices
 */
export class MobileDrawerController {
  private drawer: HTMLElement;
  private handle: HTMLElement;
  private startY: number = 0;
  private currentY: number = 0;
  private isDragging: boolean = false;
  private isExpanded: boolean = false;

  constructor() {
    this.drawer = document.getElementById('mobile-drawer')!;
    this.handle = document.getElementById('drawer-handle')!;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Desktop: disable drawer interactions
    if (window.innerWidth >= 1280) {
      return;
    }

    // Touch events for swipe
    this.handle.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.handle.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.handle.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });

    // Click to toggle
    this.handle.addEventListener('click', this.toggleDrawer.bind(this));

    // Window resize: reset to desktop mode if needed
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  private handleTouchStart(e: TouchEvent): void {
    this.startY = e.touches[0].clientY;
    this.isDragging = true;
  }

  private handleTouchMove(e: TouchEvent): void {
    if (!this.isDragging) return;

    this.currentY = e.touches[0].clientY;
    const deltaY = this.startY - this.currentY;

    // Prevent default to avoid page scroll
    e.preventDefault();

    // Visual feedback during drag
    if (deltaY > 0) {
      // Dragging up
      const newHeight = Math.min(window.innerHeight * 0.7, 60 + deltaY);
      this.drawer.style.height = `${newHeight}px`;
    } else if (deltaY < 0 && this.isExpanded) {
      // Dragging down when expanded
      const newHeight = Math.max(60, window.innerHeight * 0.7 + deltaY);
      this.drawer.style.height = `${newHeight}px`;
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (!this.isDragging) return;

    const deltaY = this.startY - this.currentY;
    const threshold = 50; // Minimum swipe distance

    if (deltaY > threshold) {
      // Swipe up: expand
      this.expandDrawer();
    } else if (deltaY < -threshold && this.isExpanded) {
      // Swipe down: collapse
      this.collapseDrawer();
    } else {
      // Snap back to current state
      this.snapToState();
    }

    this.isDragging = false;
  }

  private toggleDrawer(): void {
    if (this.isExpanded) {
      this.collapseDrawer();
    } else {
      this.expandDrawer();
    }
  }

  private expandDrawer(): void {
    this.drawer.classList.add('expanded');
    this.drawer.classList.remove('hidden');
    this.drawer.style.height = '70vh';
    this.isExpanded = true;

    // Announce to screen readers
    this.drawer.setAttribute('aria-expanded', 'true');
  }

  private collapseDrawer(): void {
    this.drawer.classList.remove('expanded');
    this.drawer.style.height = '60px';
    this.isExpanded = false;

    // Announce to screen readers
    this.drawer.setAttribute('aria-expanded', 'false');
  }

  private snapToState(): void {
    if (this.isExpanded) {
      this.drawer.style.height = '70vh';
    } else {
      this.drawer.style.height = '60px';
    }
  }

  private handleResize(): void {
    // Reset to desktop mode on large screens
    if (window.innerWidth >= 1280) {
      this.drawer.classList.remove('expanded', 'hidden');
      this.drawer.style.height = '';
      this.isExpanded = false;
    }
  }

  public initialize(): void {
    // Set initial state
    this.collapseDrawer();
  }
}
```

**5. Integrate Drawer Controller**

```typescript
// src/index.ts - GTFSEditor class

import { MobileDrawerController } from './modules/mobile-drawer-controller.js';

export class GTFSEditor {
  // ... existing properties ...
  private mobileDrawer?: MobileDrawerController;

  async initialize() {
    // ... existing initialization ...

    // Initialize mobile drawer (only active on mobile)
    if (window.innerWidth < 1280) {
      this.mobileDrawer = new MobileDrawerController();
      this.mobileDrawer.initialize();
    }
  }
}
```

---

### Phase 2: Touch-Optimized Controls

**1. Increase Map Control Sizes**

```css
/* src/styles/main.css */

@layer components {
  /* Mobile: larger touch targets */
  #map-controls .btn-square {
    min-height: 2.5rem;
    height: 2.5rem;
    width: 2.5rem;
  }

  @media (max-width: 768px) {
    #map-controls .btn-square {
      min-height: 3rem;
      height: 3rem;
      width: 3rem;
    }

    #map-controls {
      /* Larger spacing on mobile */
      @apply top-2 right-2 space-y-3;
    }

    /* Larger search input on mobile */
    #map-search {
      @apply w-full;
    }

    #map-controls .card {
      @apply p-3;
    }
  }
}
```

**2. Responsive Navbar**

```css
/* src/styles/main.css */

@layer components {
  .navbar {
    @apply flex-wrap;
  }

  @media (max-width: 640px) {
    /* Compact navbar on small screens */
    .navbar-start {
      @apply flex-1;
    }

    .navbar-start .avatar {
      @apply w-6;
    }

    .navbar-start h1 {
      @apply text-base;
    }

    .navbar-start .text-xs {
      @apply hidden; /* Hide "powered by" on mobile */
    }

    .navbar-end .btn {
      @apply btn-xs px-2;
    }

    .navbar-end svg {
      @apply h-3 w-3;
    }

    /* Stack buttons vertically if needed */
    .navbar-end > div {
      @apply flex-wrap gap-1;
    }
  }
}
```

**3. Mobile-Optimized Tab Layout**

```css
/* src/styles/main.css */

@layer components {
  @media (max-width: 1279px) {
    /* Make tabs more compact in mobile drawer */
    .tabs {
      @apply tabs-xs;
    }

    .tab {
      @apply px-3 py-2 text-xs;
    }

    .tab-content {
      @apply p-2;
    }

    /* Objects list: larger tap targets */
    #objects-navigation .menu li a {
      @apply py-3;
    }

    /* File list: larger tap targets */
    #file-list .menu li a {
      @apply py-3;
    }
  }
}
```

---

### Phase 3: Performance Optimizations

**1. Lazy Loading for Mobile**

```typescript
// src/modules/mobile-performance.ts

/**
 * Mobile Performance Optimizations
 * Reduces memory usage and improves responsiveness on mobile devices
 */
export class MobilePerformance {
  private isMobile: boolean;

  constructor() {
    this.isMobile = window.innerWidth < 1280;
  }

  /**
   * Debounce map updates on mobile to reduce battery drain
   */
  public debounceMapUpdates(): boolean {
    return this.isMobile;
  }

  /**
   * Reduce map marker clustering distance on mobile
   */
  public getClusterRadius(): number {
    return this.isMobile ? 60 : 80;
  }

  /**
   * Limit visible stops on mobile for performance
   */
  public getMaxVisibleStops(): number {
    return this.isMobile ? 100 : 500;
  }

  /**
   * Use simplified shapes on mobile
   */
  public useSimplifiedShapes(): boolean {
    return this.isMobile;
  }
}
```

**2. Optimize MapLibre for Touch**

```typescript
// src/modules/map-controller.ts

private initializeMap(): void {
  this.map = new maplibregl.Map({
    container: 'map',
    style: this.getMapStyle(),
    center: [-98.5795, 39.8283],
    zoom: 4,

    // Mobile optimizations
    touchZoomRotate: true,
    touchPitch: false, // Disable pitch on mobile for better performance
    dragRotate: window.innerWidth >= 768, // Only allow rotation on tablets+

    // Performance flags
    performanceMetricsCollection: false,
    preserveDrawingBuffer: false,
  });

  // Add touch-specific controls
  if (window.innerWidth < 1280) {
    this.map.addControl(new maplibregl.NavigationControl({
      showCompass: false, // Hide compass on mobile to save space
      visualizePitch: false
    }), 'bottom-right');
  }
}
```

---

### Phase 4: Accessibility & Testing

**1. ARIA Labels for Mobile**

```html
<!-- src/index.html -->
<div class="mobile-drawer"
     id="mobile-drawer"
     role="region"
     aria-label="Data panel"
     aria-expanded="false">

  <div class="drawer-handle"
       id="drawer-handle"
       role="button"
       aria-label="Toggle data panel"
       tabindex="0">
  </div>

  <!-- ... drawer content ... -->
</div>
```

**2. Keyboard Support for Drawer**

```typescript
// In mobile-drawer-controller.ts

private setupEventListeners(): void {
  // ... existing touch events ...

  // Keyboard support for accessibility
  this.handle.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.toggleDrawer();
    }
  });
}
```

**3. Test on Real Devices**

Playwright mobile emulation tests:

```typescript
// tests/mobile-responsive.spec.ts

import { test, expect, devices } from '@playwright/test';

test.describe('Mobile Responsiveness', () => {
  test.use(devices['iPhone 12']);

  test('should display map full screen on mobile', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const map = page.locator('#map');
    await expect(map).toBeVisible();

    const mapBox = await map.boundingBox();
    const viewportSize = page.viewportSize()!;

    // Map should take most of the viewport height (minus navbar and drawer peek)
    expect(mapBox!.height).toBeGreaterThan(viewportSize.height * 0.6);
  });

  test('should show bottom drawer on mobile', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const drawer = page.locator('#mobile-drawer');
    await expect(drawer).toBeVisible();

    // Should be in collapsed state initially
    await expect(drawer).toHaveCSS('height', '60px');
  });

  test('should expand drawer on handle click', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const handle = page.locator('#drawer-handle');
    await handle.click();

    const drawer = page.locator('#mobile-drawer');
    await expect(drawer).toHaveClass(/expanded/);
  });

  test('should have touch-friendly tap targets', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Check map controls are at least 44x44px
    const addStopBtn = page.locator('#add-stop-btn');
    const box = await addStopBtn.boundingBox();

    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('Tablet Responsiveness', () => {
  test.use(devices['iPad Pro']);

  test('should display in tablet layout', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Tablet should still use mobile drawer
    const drawer = page.locator('#mobile-drawer');
    await expect(drawer).toBeVisible();
  });
});

test.describe('Desktop Responsiveness', () => {
  test('should display in desktop layout', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:5173');

    // Desktop should show fixed sidebar
    const drawer = page.locator('#mobile-drawer');
    await expect(drawer).not.toHaveClass(/expanded/);

    // Sidebar should have fixed width
    const box = await drawer.boundingBox();
    expect(box!.width).toBe(650);
  });
});
```

---

## Implementation Checklist

### Phase 1: Layout Foundation
- [ ] Update HTML grid to flexbox on mobile
- [ ] Implement CSS for bottom drawer
- [ ] Create MobileDrawerController class
- [ ] Add swipe gesture support
- [ ] Test drawer expand/collapse

### Phase 2: Touch Optimization
- [ ] Increase map control sizes on mobile
- [ ] Make navbar responsive
- [ ] Optimize tab layout for small screens
- [ ] Ensure 44x44px minimum tap targets

### Phase 3: Performance
- [ ] Implement mobile performance class
- [ ] Optimize MapLibre for touch
- [ ] Reduce map marker density on mobile
- [ ] Test on low-end devices

### Phase 4: Accessibility
- [ ] Add ARIA labels for drawer
- [ ] Keyboard support for drawer toggle
- [ ] Screen reader testing
- [ ] Write Playwright mobile tests

## Design Mockup

```
┌─────────────────────────────────┐
│  🚌 gtfs.zone    [Theme] [Load] │ ← Compact navbar
├─────────────────────────────────┤
│                                 │
│                                 │
│           MAP VIEW              │
│        (Full Screen)            │
│                                 │
│                                 │
│  [Search]     [+] [Edit]       │ ← Larger controls
│                                 │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│         ═════ (handle)          │ ← Swipeable drawer
│ [Browse] [Files] [Help]         │
└─────────────────────────────────┘

When drawer expanded (70vh):

┌─────────────────────────────────┐
│  🚌 gtfs.zone    [Theme] [Load] │
├─────────────────────────────────┤
│                                 │
│       MAP VIEW (30vh)           │
│                                 │
├─────────────────────────────────┤
│         ═════ (handle)          │ ← Swipe down to collapse
│ [Browse] [Files] [Help]         │
│                                 │
│  📋 Objects List                │
│   • Routes                      │
│   • Stops                       │
│   • Trips                       │
│                                 │
│         (70vh content)          │
│                                 │
└─────────────────────────────────┘
```

## Success Metrics

- [ ] App loads and functions on iPhone SE (375px width)
- [ ] All tap targets meet 44x44px minimum size
- [ ] Drawer swipe gesture works smoothly (60fps)
- [ ] Map remains interactive with drawer expanded
- [ ] No horizontal scrolling on any screen size
- [ ] Keyboard navigation works for drawer
- [ ] Lighthouse mobile score > 90

## Related TODOs

Mobile support affects several other features:
- Timetable view needs horizontal scrolling optimization
- Editor needs mobile-friendly table view
- Search results need bottom-sheet on mobile

## Notes

- Use Tailwind's `xl:` breakpoint (1280px) for desktop layout
- DaisyUI drawer component might be alternative to custom drawer
- Consider using `@media (hover: none)` to detect touch devices
- Test with actual devices, not just browser DevTools
- MapLibre GL JS works well on mobile with proper configuration
- Consider PWA features for mobile (service worker, app manifest)
