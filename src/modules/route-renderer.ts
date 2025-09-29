import { Map as MapLibreMap } from 'maplibre-gl';
import { GTFS } from '../types/gtfs.js';
import type { GTFSParser } from './gtfs-parser.js';

export interface RouteFeature extends GeoJSON.Feature {
  id: string;
  geometry: GeoJSON.LineString;
  properties: {
    route_id: string;
    route_data: GTFS.Route;
    color: string;
    route_short_name?: string;
    route_long_name?: string;
  };
}

export interface RouteRenderingOptions {
  lineWidth: number;
  opacity: number;
  clickable: boolean;
}

export class RouteRenderer {
  private map: MapLibreMap;
  private routeFeatures: RouteFeature[] = [];
  private gtfsParser: GTFSParser;
  private highlightedRouteId: string | null = null;

  // Default rendering options
  private defaultOptions: RouteRenderingOptions = {
    lineWidth: 3,
    opacity: 0.7,
    clickable: true,
  };

  constructor(map: MapLibreMap, gtfsParser: GTFSParser) {
    this.map = map;
    this.gtfsParser = gtfsParser;

    // Wait for map style to load before initializing layers
    if (this.map.isStyleLoaded()) {
      this.initializeMapLayers();
    } else {
      this.map.once('styleload', () => {
        this.initializeMapLayers();
      });
    }
  }

  /**
   * Initialize MapLibre layers for route rendering
   */
  private initializeMapLayers(): void {
    console.log('🔧 Initializing MapLibre route layers...');

    // Check if source already exists
    if (this.map.getSource('routes')) {
      console.log('🔍 Routes source already exists, skipping initialization');
      return;
    }

    // Add routes source
    this.map.addSource('routes', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });

    console.log('✅ Routes source added');

    // Add route background layer for visual appearance
    this.map.addLayer({
      id: 'routes-background',
      type: 'line',
      source: 'routes',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': this.defaultOptions.lineWidth,
        'line-opacity': this.defaultOptions.opacity,
      },
      layout: {
        'line-cap': 'round', // KEY: This creates smooth line ends
        'line-join': 'round', // KEY: This creates smooth line joints
      },
    });

    console.log('✅ Routes background layer added');

    // Add click area layer for interactions
    this.map.addLayer({
      id: 'routes-clickarea',
      type: 'line',
      source: 'routes',
      paint: {
        'line-color': 'transparent',
        'line-width': 15, // Wider click area
        'line-opacity': 0,
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
    });

    // Add route highlight layer
    this.map.addLayer({
      id: 'routes-highlight',
      type: 'line',
      source: 'routes',
      filter: ['==', 'route_id', ''], // Initially matches nothing
      paint: {
        'line-color': '#FFFF00', // Yellow highlight
        'line-width': 5,
        'line-opacity': 0.9,
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
    });
  }

  /**
   * Create route features as GeoJSON FeatureCollection
   */
  private createRouteFeatures(): RouteFeature[] {
    const routes =
      this.gtfsParser.getFileDataSyncTyped<GTFS.Route>('routes.txt');
    const trips = this.gtfsParser.getFileDataSyncTyped<GTFS.Trip>('trips.txt');
    const shapes =
      this.gtfsParser.getFileDataSyncTyped<GTFS.Shape>('shapes.txt');
    const stopTimes =
      this.gtfsParser.getFileDataSyncTyped<GTFS.StopTime>('stop_times.txt');
    const stops = this.gtfsParser.getFileDataSyncTyped<GTFS.Stop>('stops.txt');

    if (!routes || !trips) {
      return [];
    }

    const routeFeatures: RouteFeature[] = [];

    routes.forEach((route) => {
      const route_id = route.route_id;
      const routeColor = this.getRouteColor(route_id, route.route_color);

      // Find trips for this route
      const routeTrips = trips.filter((trip) => trip.route_id === route_id);

      routeTrips.forEach((trip) => {
        let geometry = null;

        // Try to use shape data first
        if (trip.shape_id && shapes) {
          geometry = this.createRouteGeometryFromShape(trip.shape_id, shapes);
        }

        // Fall back to stop connections if no shape
        if (!geometry && stopTimes && stops) {
          console.warn(
            `No shape data for trip ${trip.trip_id}, falling back to stop connections (will be jagged)`
          );
          geometry = this.createRouteGeometryFromStops(
            trip.trip_id,
            stopTimes,
            stops
          );
        }

        if (geometry && geometry.coordinates.length >= 2) {
          routeFeatures.push({
            type: 'Feature',
            id: `${route_id}-${trip.trip_id}`,
            geometry: geometry,
            properties: {
              route_id,
              route_data: route,
              color: routeColor,
              route_short_name: route.route_short_name,
              route_long_name: route.route_long_name,
            },
          });
        }
      });
    });

    return routeFeatures;
  }

  /**
   * Create route geometry from shapes.txt
   */
  private createRouteGeometryFromShape(
    shape_id: string,
    shapes: GTFS.Shape[]
  ): GeoJSON.LineString | null {
    const shapePoints = shapes
      .filter((point) => point.shape_id === shape_id)
      .map((point) => ({
        lat: parseFloat(point.shape_pt_lat),
        lon: parseFloat(point.shape_pt_lon),
        sequence: parseInt(point.shape_pt_sequence) || 0,
      }))
      .filter((p) => !isNaN(p.lat) && !isNaN(p.lon))
      .sort((a, b) => a.sequence - b.sequence);

    if (shapePoints.length < 2) {
      return null;
    }

    console.log(`Shape ${shape_id}: ${shapePoints.length} points`);

    // If we have very few points, the lines will be jagged
    if (shapePoints.length < 5) {
      console.warn(
        `Shape ${shape_id} has only ${shapePoints.length} points - may appear jagged`
      );
    }

    return {
      type: 'LineString',
      coordinates: shapePoints.map((p) => [p.lon, p.lat]),
    };
  }

  /**
   * Create route geometry from stop connections (fallback)
   */
  private createRouteGeometryFromStops(
    trip_id: string,
    stopTimes: GTFS.StopTime[],
    stops: GTFS.Stop[]
  ): GeoJSON.LineString | null {
    // Create stops lookup
    const stopsLookup: { [key: string]: { lat: number; lon: number } } = {};
    stops.forEach((stop) => {
      if (stop.stop_lat && stop.stop_lon) {
        stopsLookup[stop.stop_id] = {
          lat: parseFloat(stop.stop_lat),
          lon: parseFloat(stop.stop_lon),
        };
      }
    });

    // Get stops for this trip
    const tripStopTimes = stopTimes
      .filter((st) => st.trip_id === trip_id)
      .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));

    const routePath: [number, number][] = [];
    tripStopTimes.forEach((st) => {
      const stopCoords = stopsLookup[st.stop_id];
      if (stopCoords) {
        routePath.push([stopCoords.lon, stopCoords.lat]);
      }
    });

    if (routePath.length < 2) {
      return null;
    }

    return {
      type: 'LineString',
      coordinates: routePath,
    };
  }

  /**
   * Generate deterministic color for route
   */
  private getRouteColor(route_id: string, gtfsRouteColor?: string): string {
    // Use GTFS route_color if available and valid
    if (
      gtfsRouteColor &&
      gtfsRouteColor.length === 6 &&
      /^[0-9A-Fa-f]+$/.test(gtfsRouteColor)
    ) {
      return `#${gtfsRouteColor}`;
    }

    // Generate deterministic color from route ID
    let hash = 0;
    for (let i = 0; i < route_id.length; i++) {
      const char = route_id.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }

  /**
   * Render routes using MapLibre with smooth line rendering
   */
  public renderRoutes(_options: Partial<RouteRenderingOptions> = {}): void {
    console.log(
      '🎨 Rendering routes using MapLibre with smooth line rendering...'
    );

    // Create route features
    this.routeFeatures = this.createRouteFeatures();

    if (this.routeFeatures.length === 0) {
      console.warn('No route features available for rendering');
      return;
    }

    // Debug: Check if source exists
    const source = this.map.getSource('routes') as maplibregl.GeoJSONSource;
    console.log('🔍 Routes source exists:', !!source);

    // Debug: Check if layers exist
    console.log(
      '🔍 routes-background layer exists:',
      !!this.map.getLayer('routes-background')
    );
    console.log(
      '🔍 routes-clickarea layer exists:',
      !!this.map.getLayer('routes-clickarea')
    );
    console.log(
      '🔍 routes-highlight layer exists:',
      !!this.map.getLayer('routes-highlight')
    );

    if (source) {
      const geoJsonData = {
        type: 'FeatureCollection' as const,
        features: this.routeFeatures,
      };

      console.log('🔍 Setting route data:', geoJsonData);
      console.log('🔍 First route feature sample:', this.routeFeatures[0]);

      source.setData(geoJsonData);

      // Debug: Force map to repaint
      this.map.triggerRepaint();
    } else {
      console.error(
        '❌ Routes source not found! Attempting to initialize layers...'
      );

      // Try to initialize layers now
      this.initializeMapLayers();

      // Try again after initialization
      const newSource = this.map.getSource(
        'routes'
      ) as maplibregl.GeoJSONSource;
      if (newSource) {
        console.log(
          '✅ Layers initialized successfully, setting route data...'
        );
        const geoJsonData = {
          type: 'FeatureCollection' as const,
          features: this.routeFeatures,
        };
        newSource.setData(geoJsonData);
        this.map.triggerRepaint();
      } else {
        console.error('❌ Failed to initialize route layers!');
      }
    }

    console.log(
      `✅ Rendered ${this.routeFeatures.length} route features using MapLibre with smooth lines`
    );
  }

  /**
   * Clear all route rendering
   */
  public clearRoutes(): void {
    const source = this.map.getSource('routes') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: [],
      });
    }
    this.routeFeatures = [];
    this.highlightedRouteId = null;
  }

  /**
   * Update route highlighting for specific route
   */
  public highlightRoute(route_id: string): void {
    if (this.routeFeatures.length === 0) {
      return;
    }

    console.log(`🎯 Highlighting route: ${route_id}`);

    this.highlightedRouteId = route_id;

    // Update the highlight filter
    this.map.setFilter('routes-highlight', ['==', 'route_id', route_id]);

    console.log(`✅ Route highlight applied: ${route_id}`);
  }

  /**
   * Clear route highlighting
   */
  public clearHighlight(): void {
    this.highlightedRouteId = null;
    // Set filter to match nothing
    this.map.setFilter('routes-highlight', ['==', 'route_id', '']);
  }

  /**
   * Set click handler for route interactions (DEPRECATED - handled by InteractionHandler)
   */
  public setRouteClickHandler(
    _handler: (route_id: string, route_data: GTFS.Route) => void
  ): void {
    // NOTE: Route clicks are now handled by InteractionHandler to prevent conflicts with stop clicks
    // This method is kept for legacy compatibility but does nothing
    console.warn(
      'RouteRenderer.setRouteClickHandler is deprecated - route clicks are handled by InteractionHandler'
    );
  }

  /**
   * Get current route features for debugging
   */
  public getRouteFeatures(): RouteFeature[] {
    return this.routeFeatures;
  }

  /**
   * Destroy the route renderer and clean up resources
   */
  public destroy(): void {
    this.clearRoutes();

    // Remove layers and source
    if (this.map.getLayer('routes-highlight')) {
      this.map.removeLayer('routes-highlight');
    }
    if (this.map.getLayer('routes-clickarea')) {
      this.map.removeLayer('routes-clickarea');
    }
    if (this.map.getLayer('routes-background')) {
      this.map.removeLayer('routes-background');
    }
    if (this.map.getSource('routes')) {
      this.map.removeSource('routes');
    }

    this.routeFeatures = [];
    this.highlightedRouteId = null;
  }
}
