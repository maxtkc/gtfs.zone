/**
 * Basemap control UI component using DaisyUI FAB and speed dial
 */

import { Map as MapLibreMap } from 'maplibre-gl';
import { basemapStyles, getBasemapStyle } from './basemap-styles.js';

export class BasemapControl {
  private map: MapLibreMap;
  private container: HTMLElement | null = null;
  private currentBasemap: string = 'standard';
  private currentProjection: 'mercator' | 'globe' = 'globe';
  private isOpen: boolean = false;

  constructor(map: MapLibreMap) {
    this.map = map;
    this.createControl();

    // Apply initial globe projection
    this.applyInitialProjection();
  }

  /**
   * Apply initial globe projection to the map
   */
  private applyInitialProjection(): void {
    // Wait for map to be ready
    if (this.map.isStyleLoaded()) {
      this.applyProjectionToStyle();
    } else {
      this.map.once('load', () => {
        this.applyProjectionToStyle();
      });
    }
  }

  /**
   * Apply current projection to the map style
   */
  private applyProjectionToStyle(): void {
    const currentStyle = this.map.getStyle();
    if (!currentStyle) {
      return;
    }

    const newStyle = {
      ...currentStyle,
      projection:
        this.currentProjection === 'globe'
          ? { type: 'globe' }
          : { type: 'mercator' },
      sky:
        this.currentProjection === 'globe'
          ? {
              'sky-color': '#199EF3',
              'sky-horizon-blend': 0.5,
              'horizon-color': '#ffffff',
              'horizon-fog-blend': 0.5,
              'fog-color': '#0000ff',
              'fog-ground-blend': 0.5,
              'atmosphere-blend': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0,
                1,
                10,
                1,
                12,
                0,
              ],
            }
          : undefined,
    };

    this.map.setStyle(newStyle as Record<string, unknown>);
  }

  /**
   * Create the basemap control UI
   */
  private createControl(): void {
    // Create container
    this.container = document.createElement('div');
    this.container.className = 'basemap-control';
    this.container.style.cssText = `
      position: absolute;
      bottom: 40px;
      right: 10px;
      display: flex;
      gap: 12px;
      align-items: flex-end;
      flex-direction: row;
    `;

    // Get current basemap
    const currentStyle = basemapStyles.find(
      (s) => s.id === this.currentBasemap
    );
    const otherStyles = basemapStyles.filter(
      (s) => s.id !== this.currentBasemap
    );

    // Create FAB structure with flower layout
    this.container.innerHTML = `
      <div class="fab fab-flower bottom-0 right-0">
        <!-- Main FAB button (shows current basemap) -->
        <div tabindex="0" role="button" class="btn btn-lg btn-circle btn-neutral basemap-fab-main">
          ${currentStyle?.icon || basemapStyles[0].icon}
        </div>

        <!-- Main Action button (appears when FAB is open) -->
        <button class="fab-main-action btn btn-circle btn-lg btn-neutral basemap-current" data-basemap="${this.currentBasemap}" title="${currentStyle?.name || 'Standard'}">
          ${currentStyle?.icon || basemapStyles[0].icon}
        </button>

        <!-- Other basemap buttons that show up when FAB is open -->
        ${otherStyles
          .map(
            (style) => `
          <button class="btn btn-lg btn-circle btn-base-100 basemap-btn" data-basemap="${style.id}" title="${style.name}">
            ${style.icon}
          </button>
        `
          )
          .join('')}
      </div>

      <!-- Globe/Mercator projection toggle -->
      <label class="swap swap-rotate btn btn-lg btn-circle btn-neutral projection-swap" title="Toggle projection">
        <input type="checkbox" class="projection-toggle" ${this.currentProjection === 'globe' ? 'checked' : ''} />
        <!-- Globe icon (when checked) -->
        <svg class="swap-on w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
        </svg>
        <!-- Mercator/Map icon (when unchecked) -->
        <svg class="swap-off w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
        </svg>
      </label>
    `;

    // Add minimal custom styles
    const style = document.createElement('style');
    style.textContent = `
      .basemap-control .fab-flower {
        position: relative;
      }

      .basemap-control .projection-swap {
        flex-shrink: 0;
      }
    `;
    document.head.appendChild(style);

    // Attach event listeners
    this.attachEventListeners();

    // Add to map container
    const mapContainer = this.map.getContainer();

    // Ensure map container has position relative for absolute positioning to work
    const computedStyle = window.getComputedStyle(mapContainer);
    if (computedStyle.position === 'static') {
      mapContainer.style.position = 'relative';
    }

    mapContainer.appendChild(this.container);
  }

  /**
   * Attach event listeners for basemap selection and projection toggle
   */
  private attachEventListeners(): void {
    if (!this.container) {
      return;
    }

    // Basemap selection buttons
    const basemapButtons = this.container.querySelectorAll('.basemap-btn');
    basemapButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const basemapId = (button as HTMLElement).getAttribute('data-basemap');
        if (basemapId) {
          this.changeBasemap(basemapId);
        }
      });
    });

    // Current basemap button (in center when FAB is open)
    const currentBtn = this.container.querySelector('.basemap-current');
    if (currentBtn) {
      currentBtn.addEventListener('click', () => {
        const basemapId = (currentBtn as HTMLElement).getAttribute(
          'data-basemap'
        );
        if (basemapId) {
          this.changeBasemap(basemapId);
        }
      });
    }

    // Projection toggle
    const projectionToggle = this.container.querySelector('.projection-toggle');
    if (projectionToggle) {
      projectionToggle.addEventListener('change', (e) => {
        const isGlobe = (e.target as HTMLInputElement).checked;
        this.changeProjection(isGlobe ? 'globe' : 'mercator');
      });
    }

    // Main FAB button (just for accessibility, opening is handled by CSS hover/focus)
    const mainFab = this.container.querySelector('.basemap-fab-main');
    if (mainFab) {
      mainFab.addEventListener('keydown', (e) => {
        if (
          (e as KeyboardEvent).key === 'Enter' ||
          (e as KeyboardEvent).key === ' '
        ) {
          (e.target as HTMLElement).focus();
        }
      });
    }
  }

  /**
   * Change the basemap style
   */
  private changeBasemap(basemapId: string): void {
    // Skip if already on this basemap
    if (basemapId === this.currentBasemap) {
      console.log(`Already on basemap: ${basemapId}`);
      return;
    }

    const basemapStyle = getBasemapStyle(basemapId);
    if (!basemapStyle) {
      console.error(`Basemap style not found: ${basemapId}`);
      return;
    }

    // Store current center and zoom
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();
    const bearing = this.map.getBearing();
    const pitch = this.map.getPitch();

    // Apply projection and sky to the new basemap style
    const styleWithProjection = {
      ...basemapStyle.style,
      projection:
        this.currentProjection === 'globe'
          ? { type: 'globe' }
          : { type: 'mercator' },
      sky:
        this.currentProjection === 'globe'
          ? {
              'sky-color': '#199EF3',
              'sky-horizon-blend': 0.5,
              'horizon-color': '#ffffff',
              'horizon-fog-blend': 0.5,
              'fog-color': '#0000ff',
              'fog-ground-blend': 0.5,
              'atmosphere-blend': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0,
                1,
                10,
                1,
                12,
                0,
              ],
            }
          : undefined,
    };

    // Set new style with projection
    this.map.setStyle(styleWithProjection);

    // Wait for style to load, then restore view and re-add layers
    this.map.once('styledata', () => {
      // Restore view
      this.map.setCenter(center);
      this.map.setZoom(zoom);
      this.map.setBearing(bearing);
      this.map.setPitch(pitch);

      console.log('🎨 Style loaded, firing basemap:changed event');

      // Trigger custom event for other modules to re-add their layers
      this.map.fire('basemap:changed', { basemapId });
    });

    // Update active state
    this.currentBasemap = basemapId;
    this.rebuildControl();

    console.log(`🗺️ Basemap changed to: ${basemapStyle.name}`);
  }

  /**
   * Rebuild the control UI to reflect new basemap selection
   */
  private rebuildControl(): void {
    if (!this.container) {
      return;
    }

    // Store reference to parent
    const parent = this.container.parentNode;
    if (!parent) {
      return;
    }

    // Remove old container
    this.container.remove();

    // Create new control
    this.createControl();
  }

  /**
   * Change map projection (globe vs mercator)
   */
  private changeProjection(projection: 'mercator' | 'globe'): void {
    this.currentProjection = projection;

    // Store current view
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();
    const bearing = this.map.getBearing();
    const pitch = this.map.getPitch();

    // Get current style
    const currentStyle = this.map.getStyle();
    if (!currentStyle) {
      return;
    }

    // Update projection and sky in style
    const newStyle = {
      ...currentStyle,
      projection:
        projection === 'globe' ? { type: 'globe' } : { type: 'mercator' },
      sky:
        projection === 'globe'
          ? {
              'sky-color': '#199EF3',
              'sky-horizon-blend': 0.5,
              'horizon-color': '#ffffff',
              'horizon-fog-blend': 0.5,
              'fog-color': '#0000ff',
              'fog-ground-blend': 0.5,
              'atmosphere-blend': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0,
                1,
                10,
                1,
                12,
                0,
              ],
            }
          : undefined,
    };

    // Set new style with projection
    this.map.setStyle(newStyle as Record<string, unknown>);

    // Wait for style to load, then restore view
    this.map.once('styledata', () => {
      // Restore view
      this.map.setCenter(center);
      this.map.setZoom(zoom);
      this.map.setBearing(bearing);
      this.map.setPitch(pitch);

      console.log(`🌍 Projection changed to: ${projection}`);

      // Trigger event to re-add layers
      this.map.fire('basemap:changed', { projection });
    });
  }

  /**
   * Get current basemap ID
   */
  public getCurrentBasemap(): string {
    return this.currentBasemap;
  }

  /**
   * Programmatically set basemap
   */
  public setBasemap(basemapId: string): void {
    this.changeBasemap(basemapId);
  }

  /**
   * Remove the control from the map
   */
  public destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}
