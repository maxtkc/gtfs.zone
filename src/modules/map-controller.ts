import { Map as MapLibreMap, LngLatBounds } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { RouteRenderer } from './route-renderer.js';
import { LayerManager } from './layer-manager.js';
import {
  InteractionHandler,
  InteractionCallbacks,
} from './interaction-handler.js';
import { PageStateManager } from './page-state-manager.js';
import { GTFSDatabaseRecord } from './gtfs-database.js';
import { GTFS } from '../types/gtfs.js';

// Map interaction modes
export enum MapMode {
  NAVIGATE = 'navigate',
  ADD_STOP = 'add_stop',
  EDIT_STOPS = 'edit_stops',
}

// Dependencies interface for dependency injection
interface MapControllerDependencies {
  getFileDataSync: (filename: string) => GTFSDatabaseRecord[] | null;
  getFileDataSyncTyped: <T>(filename: string) => T[] | null;
  getRoutesForStop: (stop_id: string) => GTFSDatabaseRecord[];
  getWheelchairText: (code: string) => string;
  getRouteTypeText: (typeCode: string) => string;
  createStop: (stop: GTFSDatabaseRecord) => Promise<void>;
  updateStopCoordinates: (
    stopId: string,
    lat: number,
    lng: number
  ) => Promise<void>;
}

// Callback interfaces
interface MapControllerCallbacks {
  onRouteSelect?: (route_id: string) => void;
  onStopSelect?: (stop_id: string) => void;
  onModeChange?: (mode: MapMode) => void;
}

/**
 * Professional MapController with modular architecture and Deck.gl integration
 *
 * Responsibilities:
 * - Map initialization and lifecycle management
 * - Coordination between RouteRenderer, LayerManager, and InteractionHandler
 * - Public API for map operations
 * - Integration with page state management
 */
export class MapController {
  private map: MapLibreMap | null = null;
  private mapElementId: string;

  // Core modules
  private routeRenderer: RouteRenderer | null = null;
  private layerManager: LayerManager | null = null;
  private interactionHandler: InteractionHandler | null = null;

  // Dependencies (injected)
  private gtfsParser: MapControllerDependencies | null = null;
  private pageStateManager: PageStateManager | null = null;

  // Callbacks
  private callbacks: MapControllerCallbacks = {};

  // State
  private isInitialized = false;
  private resizeTimeout: NodeJS.Timeout | null = null;

  // Highlight state management - ensures mutual exclusivity
  private currentHighlight: {
    type: 'none' | 'route' | 'stop' | 'trip';
    id: string | null;
  } = { type: 'none', id: null };

  constructor(mapElementId = 'map') {
    this.mapElementId = mapElementId;
  }

  /**
   * Initialize the map controller with dependencies
   */
  public async initialize(
    gtfsParser: MapControllerDependencies
  ): Promise<void> {
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

  /**
   * Initialize MapLibre GL map
   */
  private initializeMap(): void {
    this.map = new MapLibreMap({
      container: this.mapElementId,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
          },
        ],
      },
      center: [-74.006, 40.7128], // NYC default
      zoom: 10,
    });

    // Keep welcome overlay visible initially
    const welcomeOverlay = document.getElementById('map-overlay');
    if (welcomeOverlay) {
      welcomeOverlay.classList.remove('hidden');
    }
  }

  /**
   * Initialize core modules
   */
  private async initializeModules(): Promise<void> {
    if (!this.map || !this.gtfsParser) {
      throw new Error(
        'Map or gtfsParser not available for module initialization'
      );
    }

    // Initialize modules
    this.layerManager = new LayerManager(this.map, this.gtfsParser);
    this.routeRenderer = new RouteRenderer(this.map, this.gtfsParser);
    this.interactionHandler = new InteractionHandler(this.map, this.gtfsParser);

    // Wait for RouteRenderer to be ready
    await this.routeRenderer.ensureInitialized();
  }

  /**
   * Setup callbacks between modules
   */
  private setupModuleCallbacks(): void {
    if (!this.interactionHandler || !this.routeRenderer) {
      return;
    }

    // Setup interaction callbacks
    const interactionCallbacks: InteractionCallbacks = {
      onRouteClick: this.handleRouteClick.bind(this),
      onStopClick: this.handleStopClick.bind(this),
      onModeChange: this.handleModeChange.bind(this),
      onStopDragComplete: this.handleStopDragComplete.bind(this),
      onStopCreated: this.handleStopCreated.bind(this),
    };

    this.interactionHandler.setCallbacks(interactionCallbacks);
  }

  /**
   * Set page state manager for URL integration
   */
  public setPageStateManager(pageStateManager: PageStateManager): void {
    this.pageStateManager = pageStateManager;
  }

  /**
   * Set callbacks for external integration
   */
  public setCallbacks(callbacks: Partial<MapControllerCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Update map with current GTFS data
   */
  public async updateMap(): Promise<void> {
    if (!this.isMapReady()) {
      return;
    }

    // Ensure RouteRenderer is initialized (this waits for map style to load)
    await this.routeRenderer!.ensureInitialized();

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
    this.layerManager!.addStopsLayer({
      showBackground: true,
      showClickArea: true,
      enableHover: true,
      backgroundColor: '#ffffff',
      strokeColor: '#2563eb',
      strokeWidth: 2.5,
      radius: 7,
      clickAreaRadius: 15,
    });

    // Fit map to show all data
    this.fitMapToData();

    console.log('✅ Map update completed');
  }

  /**
   * Check if map is ready for operations
   */
  private isMapReady(): boolean {
    if (
      !this.gtfsParser ||
      !this.gtfsParser.getFileDataSync('stops.txt') ||
      !this.map
    ) {
      return false;
    }
    return true;
  }

  /**
   * Fit map to show all GTFS data
   */
  private fitMapToData(): void {
    const stops = this.gtfsParser!.getFileDataSyncTyped<GTFS.Stop>('stops.txt');
    if (!stops || stops.length === 0) {
      return;
    }

    const validStops = stops.filter(
      (stop) =>
        stop.stop_lat &&
        stop.stop_lon &&
        !isNaN(parseFloat(stop.stop_lat)) &&
        !isNaN(parseFloat(stop.stop_lon))
    );

    if (validStops.length === 0) {
      return;
    }

    const coordinates = validStops.map((stop) => [
      parseFloat(stop.stop_lon),
      parseFloat(stop.stop_lat),
    ]);

    const bounds = coordinates.reduce(
      (bounds, coord) => bounds.extend(coord),
      new LngLatBounds(coordinates[0], coordinates[0])
    );

    this.map!.fitBounds(bounds, { padding: 50 });
  }

  // ========================================
  // HIGHLIGHTING AND NAVIGATION METHODS
  // ========================================

  /**
   * Highlight specific route
   */
  public highlightRoute(route_id: string): void {
    // Clear any existing highlights first
    this.clearHighlights();

    // Set new highlight state
    this.currentHighlight = { type: 'route', id: route_id };

    this.routeRenderer?.highlightRoute(route_id);

    // Smoothly fly to route bounds
    this.flyToRoute(route_id);

    console.log(`🎯 Highlighted route: ${route_id}`);
  }

  /**
   * Highlight specific stop
   */
  public highlightStop(stop_id: string, color = '#e74c3c', radius = 12): void {
    // Clear any existing highlights first
    this.clearHighlights();

    // Set new highlight state
    this.currentHighlight = { type: 'stop', id: stop_id };

    this.layerManager?.highlightStop(stop_id, { color, radius });

    // Smoothly fly to stop location
    const stops =
      this.gtfsParser!.getFileDataSyncTyped<GTFS.Stop>('stops.txt') || [];
    const stop = stops.find((s) => s.stop_id === stop_id);

    if (stop && stop.stop_lat && stop.stop_lon) {
      const lat = parseFloat(stop.stop_lat);
      const lon = parseFloat(stop.stop_lon);

      // Use flyTo for smooth animation with reduced zoom level
      this.map!.flyTo({
        center: [lon, lat],
        zoom: Math.max(this.map!.getZoom(), 13), // Reduced from 15 to 13
        duration: 1500, // 1.5 second animation
        essential: true, // Ensure animation completes even if user interacts
      });
    }
    console.log(`🎯 Highlighted stop: ${stop_id}`);
  }

  /**
   * Highlight trip path
   */
  public highlightTrip(trip_id: string, color = '#e74c3c'): void {
    // Clear any existing highlights first
    this.clearHighlights();

    // Set new highlight state
    this.currentHighlight = { type: 'trip', id: trip_id };

    this.layerManager?.highlightTrip(trip_id, { color });

    // Fit map to trip if available
    this.fitMapToTrip(trip_id);
    console.log(`🎯 Highlighted trip: ${trip_id}`);
  }

  /**
   * Fit map to show specific trip
   */
  private fitMapToTrip(trip_id: string): void {
    const stopTimes =
      this.gtfsParser!.getFileDataSyncTyped<GTFS.StopTime>('stop_times.txt') ||
      [];
    const stops =
      this.gtfsParser!.getFileDataSyncTyped<GTFS.Stop>('stops.txt') || [];

    const tripStopTimes = stopTimes
      .filter((st) => st.trip_id === trip_id)
      .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));

    const coordinates: [number, number][] = [];
    const stopsLookup: { [key: string]: { lat: number; lon: number } } = {};

    stops.forEach((stop) => {
      if (stop.stop_lat && stop.stop_lon) {
        stopsLookup[stop.stop_id] = {
          lat: parseFloat(stop.stop_lat),
          lon: parseFloat(stop.stop_lon),
        };
      }
    });

    tripStopTimes.forEach((st) => {
      const stopCoords = stopsLookup[st.stop_id];
      if (stopCoords) {
        coordinates.push([stopCoords.lon, stopCoords.lat]);
      }
    });

    if (coordinates.length > 0) {
      const bounds = coordinates.reduce(
        (bounds, coord) => bounds.extend(coord),
        new LngLatBounds(coordinates[0], coordinates[0])
      );

      this.map!.fitBounds(bounds, { padding: 50 });
    }
  }

  /**
   * Clear all highlights
   */
  public clearHighlights(): void {
    // Reset highlight state
    this.currentHighlight = { type: 'none', id: null };

    this.layerManager?.clearHighlights();
    this.routeRenderer?.clearHighlight();
  }

  /**
   * Get current highlight state
   */
  public getCurrentHighlight(): {
    type: 'none' | 'route' | 'stop' | 'trip';
    id: string | null;
  } {
    return { ...this.currentHighlight };
  }

  /**
   * Smoothly fly to show a specific route
   */
  private flyToRoute(route_id: string): void {
    const trips =
      this.gtfsParser!.getFileDataSyncTyped<GTFS.Trip>('trips.txt') || [];
    const stopTimes =
      this.gtfsParser!.getFileDataSyncTyped<GTFS.StopTime>('stop_times.txt') ||
      [];
    const stops =
      this.gtfsParser!.getFileDataSyncTyped<GTFS.Stop>('stops.txt') || [];

    // Find all stops for this route
    const routeStops = new Set<string>();
    const routeTrips = trips.filter((trip) => trip.route_id === route_id);
    routeTrips.forEach((trip) => {
      const tripStopTimes = stopTimes.filter(
        (st) => st.trip_id === trip.trip_id
      );
      tripStopTimes.forEach((st) => routeStops.add(st.stop_id));
    });

    // Get coordinates for all stops
    const coordinates: [number, number][] = [];
    stops.forEach((stop) => {
      if (routeStops.has(stop.stop_id) && stop.stop_lat && stop.stop_lon) {
        coordinates.push([
          parseFloat(stop.stop_lon),
          parseFloat(stop.stop_lat),
        ]);
      }
    });

    if (coordinates.length > 0) {
      const bounds = coordinates.reduce(
        (bounds, coord) => bounds.extend(coord),
        new LngLatBounds(coordinates[0], coordinates[0])
      );

      // Use flyTo for smooth animation to route bounds
      this.map!.fitBounds(bounds, {
        padding: 80,
        duration: 2000, // 2 second animation for routes (longer than stops)
        essential: true, // Ensure animation completes even if user interacts
      });
    }
  }

  /**
   * Fit map to show specific routes
   */
  public fitToRoutes(route_ids: string[]): void {
    const trips =
      this.gtfsParser!.getFileDataSyncTyped<GTFS.Trip>('trips.txt') || [];
    const stopTimes =
      this.gtfsParser!.getFileDataSyncTyped<GTFS.StopTime>('stop_times.txt') ||
      [];
    const stops =
      this.gtfsParser!.getFileDataSyncTyped<GTFS.Stop>('stops.txt') || [];

    // Find all stops for these routes
    const allStops = new Set<string>();

    route_ids.forEach((route_id) => {
      const routeTrips = trips.filter((trip) => trip.route_id === route_id);
      routeTrips.forEach((trip) => {
        const tripStopTimes = stopTimes.filter(
          (st) => st.trip_id === trip.trip_id
        );
        tripStopTimes.forEach((st) => allStops.add(st.stop_id));
      });
    });

    // Get coordinates for all stops
    const coordinates: [number, number][] = [];
    stops.forEach((stop) => {
      if (allStops.has(stop.stop_id) && stop.stop_lat && stop.stop_lon) {
        coordinates.push([
          parseFloat(stop.stop_lon),
          parseFloat(stop.stop_lat),
        ]);
      }
    });

    if (coordinates.length > 0) {
      const bounds = coordinates.reduce(
        (bounds, coord) => bounds.extend(coord),
        new LngLatBounds(coordinates[0], coordinates[0])
      );

      this.map!.fitBounds(bounds, { padding: 50 });
    }
  }

  /**
   * Highlight all routes for a specific agency
   */
  public highlightAgencyRoutes(agency_id: string): void {
    const routes =
      this.gtfsParser!.getFileDataSyncTyped<GTFS.Route>('routes.txt') || [];
    const agencyRoutes = routes.filter(
      (route) => route.agency_id === agency_id
    );

    if (agencyRoutes.length === 0) {
      return;
    }

    // Clear existing highlights
    this.clearHighlights();

    // Highlight all routes for this agency
    agencyRoutes.forEach((route) => {
      this.highlightRoute(route.route_id);
    });

    // Fit map to show highlighted routes
    this.fitToRoutes(agencyRoutes.map((r) => r.route_id));
  }

  // ========================================
  // MODE MANAGEMENT
  // ========================================

  /**
   * Set map interaction mode
   */
  public setMapMode(mode: MapMode): void {
    this.interactionHandler?.setMapMode(mode);
  }

  /**
   * Get current map mode
   */
  public getCurrentMode(): MapMode {
    return this.interactionHandler?.getCurrentMode() || MapMode.NAVIGATE;
  }

  /**
   * Toggle add stop mode
   */
  public toggleAddStopMode(): void {
    this.interactionHandler?.toggleAddStopMode();
  }

  /**
   * Toggle edit stops mode
   */
  public toggleEditStopsMode(): void {
    this.interactionHandler?.toggleEditStopsMode();
  }

  // ========================================
  // UI INTEGRATION METHODS
  // ========================================

  /**
   * Show map overlay (welcome screen)
   */
  public showMapOverlay(): void {
    const welcomeOverlay = document.getElementById('map-overlay');
    if (welcomeOverlay) {
      welcomeOverlay.classList.remove('hidden');
    }
  }

  /**
   * Hide map overlay
   */
  public hideMapOverlay(): void {
    const welcomeOverlay = document.getElementById('map-overlay');
    if (welcomeOverlay) {
      welcomeOverlay.classList.add('hidden');
    }
  }

  /**
   * Show loading state
   */
  public showLoading(): void {
    const welcomeOverlay = document.getElementById('map-overlay');
    if (welcomeOverlay) {
      const welcomeContent = welcomeOverlay.querySelector('.welcome-content');
      if (welcomeContent) {
        welcomeContent.innerHTML = `
          <div class="welcome-icon">⏳</div>
          <h2>Loading GTFS Data...</h2>
          <p>Please wait while we process your transit feed</p>
        `;
      }
      welcomeOverlay.classList.remove('hidden');
    }
  }

  /**
   * Force map resize (for layout changes)
   */
  public forceMapResize(): void {
    if (!this.map) {
      return;
    }

    // Clear any pending resize operations
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }

    // Wait for CSS transition to complete
    this.resizeTimeout = setTimeout(() => {
      const center = this.map!.getCenter();
      const zoom = this.map!.getZoom();

      this.map!.resize();

      // Restore center and zoom to prevent jumping
      this.map!.setCenter(center);
      this.map!.setZoom(zoom);

      this.resizeTimeout = null;
    }, 350);
  }

  /**
   * Highlight file data (legacy compatibility)
   */
  public highlightFileData(fileName: string): void {
    console.log(`Highlighting data for ${fileName}`);
    // Could be enhanced to highlight specific file types
  }

  // ========================================
  // EVENT HANDLERS
  // ========================================

  /**
   * Handle route click events
   */
  private async handleRouteClick(route_id: string): Promise<void> {
    console.log('Route clicked:', route_id);

    // Navigate using page state manager
    if (this.pageStateManager) {
      await this.pageStateManager.setPageState({ type: 'route', route_id });
    }

    // Legacy callback support
    if (this.callbacks.onRouteSelect) {
      this.callbacks.onRouteSelect(route_id);
    }
  }

  /**
   * Handle stop click events
   */
  private async handleStopClick(stop_id: string): Promise<void> {
    console.log('Stop clicked:', stop_id);

    // Navigate using page state manager
    if (this.pageStateManager) {
      await this.pageStateManager.setPageState({ type: 'stop', stop_id });
    }

    // Legacy callback support
    if (this.callbacks.onStopSelect) {
      this.callbacks.onStopSelect(stop_id);
    }
  }

  /**
   * Handle mode change events
   */
  private handleModeChange(mode: MapMode): void {
    console.log('Map mode changed to:', mode);

    if (this.callbacks.onModeChange) {
      this.callbacks.onModeChange(mode);
    }
  }

  /**
   * Handle stop drag completion
   */
  private async handleStopDragComplete(
    stop_id: string,
    lat: number,
    lng: number
  ): Promise<void> {
    console.log(`Stop ${stop_id} dragged to: ${lat}, ${lng}`);

    try {
      if (this.gtfsParser?.updateStopCoordinates) {
        await this.gtfsParser.updateStopCoordinates(stop_id, lat, lng);
        console.log(`✅ Updated coordinates for stop ${stop_id}`);

        // Update layer data
        this.layerManager?.updateStopsData();

        // Show success notification
        this.showNotification(`Stop ${stop_id} coordinates updated`, 'success');
      }
    } catch (error) {
      console.error(`Failed to update coordinates for stop ${stop_id}:`, error);

      // Show error notification
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.showNotification(
        `Failed to update stop coordinates: ${errorMessage}`,
        'error'
      );

      // Refresh map to revert visual changes
      await this.updateMap();
    }
  }

  /**
   * Handle stop creation
   */
  private handleStopCreated(stop_id: string): void {
    console.log(`Stop ${stop_id} created`);

    // Update layer data to show the new stop
    this.layerManager?.updateStopsData();

    // Show success notification
    this.showNotification(`Stop ${stop_id} created`, 'success');
  }

  /**
   * Show notification (integration with notification system)
   */
  private showNotification(
    message: string,
    type: 'success' | 'error' | 'warning' = 'success'
  ): void {
    import('./notification-system.js')
      .then(({ notifications }) => {
        if (type === 'success') {
          notifications.showSuccess(message);
        } else if (type === 'error') {
          notifications.showError(message);
        } else if (type === 'warning') {
          notifications.showWarning(message);
        }
      })
      .catch((err) => {
        console.error('Failed to load notification system:', err);
        console.log(`${type.toUpperCase()}: ${message}`);
      });
  }

  // ========================================
  // LEGACY COMPATIBILITY METHODS
  // ========================================

  /**
   * Legacy compatibility methods for existing code
   */
  public focusRoute(route_id: string): void {
    this.highlightRoute(route_id);
  }

  public focusStop(stop_id: string): void {
    this.highlightStop(stop_id);
  }

  public clearFocus(): void {
    this.clearHighlights();
  }

  public setRouteSelectCallback(callback: (route_id: string) => void): void {
    this.callbacks.onRouteSelect = callback;
  }

  public setStopSelectCallback(callback: (stop_id: string) => void): void {
    this.callbacks.onStopSelect = callback;
  }

  public setModeChangeCallback(callback: (mode: MapMode) => void): void {
    this.callbacks.onModeChange = callback;
  }

  // ========================================
  // LIFECYCLE MANAGEMENT
  // ========================================

  /**
   * Destroy the map controller and clean up resources
   */
  public destroy(): void {
    if (!this.isInitialized) {
      return;
    }

    // Clean up timeout
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = null;
    }

    // Destroy modules
    this.routeRenderer?.destroy();
    this.interactionHandler?.destroy();
    // LayerManager doesn't need explicit cleanup as it's tied to the map

    // Clean up map
    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    // Reset state
    this.routeRenderer = null;
    this.layerManager = null;
    this.interactionHandler = null;
    this.gtfsParser = null;
    this.pageStateManager = null;
    this.callbacks = {};
    this.currentHighlight = { type: 'none', id: null };
    this.isInitialized = false;

    console.log('🧹 MapController destroyed');
  }

  /**
   * Get debug information about the map controller
   */
  public getDebugInfo(): object {
    return {
      isInitialized: this.isInitialized,
      mapElementId: this.mapElementId,
      hasMap: !!this.map,
      hasRouteRenderer: !!this.routeRenderer,
      hasLayerManager: !!this.layerManager,
      hasInteractionHandler: !!this.interactionHandler,
      hasGtfsParser: !!this.gtfsParser,
      hasPageStateManager: !!this.pageStateManager,
      currentMode: this.getCurrentMode(),
      mapCenter: this.map?.getCenter(),
      mapZoom: this.map?.getZoom(),
      routeDataCount: this.routeRenderer?.getRouteFeatures().length || 0,
      currentHighlight: this.currentHighlight,
    };
  }
}
