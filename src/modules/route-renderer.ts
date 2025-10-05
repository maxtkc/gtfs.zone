import { Map as MapLibreMap } from 'maplibre-gl';
import { GTFS } from '../types/gtfs.js';
import type { GTFSParser } from './gtfs-parser.js';
import * as turf from '@turf/turf';

export interface RouteFeature extends GeoJSON.Feature {
  id: string;
  geometry: GeoJSON.LineString;
  properties: {
    route_id: string;
    route_data: GTFS.Route;
    color: string;
    route_short_name?: string;
    route_long_name?: string;
    hasOverlap?: boolean;
  };
}

interface RouteOverlap {
  routeAId: string;
  routeBId: string;
  tripAId: string;
  tripBId: string;
  overlapSegments: turf.Feature<turf.LineString>[];
  overlapPercentage: number;
}

interface SegmentInfo {
  coordinates: [number, number][];
  isOverlapping: boolean;
  overlapGroup?: string; // ID to identify which routes share this overlap
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
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  // Default rendering options
  private defaultOptions: RouteRenderingOptions = {
    lineWidth: 3,
    opacity: 0.7,
    clickable: true,
  };

  constructor(map: MapLibreMap, gtfsParser: GTFSParser) {
    this.map = map;
    this.gtfsParser = gtfsParser;

    // Start initialization and store promise
    if (this.map.isStyleLoaded()) {
      this.initializationPromise = this.initializeMapLayers();
    } else {
      this.initializationPromise = new Promise((resolve) => {
        this.map.once('load', async () => {
          await this.initializeMapLayers();
          resolve();
        });
      });
    }
  }

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

  /**
   * Initialize MapLibre layers for route rendering
   */
  private async initializeMapLayers(): Promise<void> {
    console.log('🔧 Initializing MapLibre route layers...');

    // Check if already initialized
    if (this.initialized) {
      console.log('✅ Routes already initialized');
      return;
    }

    // Check if layers already exist
    if (this.map.getLayer('routes-background')) {
      console.log('🔍 Routes layers already exist');
      this.initialized = true;
      return;
    }

    // Add routes source if it doesn't exist
    if (!this.map.getSource('routes')) {
      this.map.addSource('routes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });
      console.log('✅ Routes source added');
    }

    // Add route background layer for non-overlapping routes (solid)
    this.map.addLayer({
      id: 'routes-background',
      type: 'line',
      source: 'routes',
      filter: ['!=', ['get', 'hasOverlap'], true], // Only routes without hasOverlap=true
      paint: {
        'line-color': ['get', 'color'],
        'line-width': this.defaultOptions.lineWidth,
        'line-opacity': this.defaultOptions.opacity,
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
    });

    // Add route layer for overlapping routes (dashed)
    this.map.addLayer({
      id: 'routes-overlapping',
      type: 'line',
      source: 'routes',
      filter: ['==', ['get', 'hasOverlap'], true], // Only routes with hasOverlap=true
      paint: {
        'line-color': ['get', 'color'],
        'line-width': this.defaultOptions.lineWidth,
        'line-opacity': this.defaultOptions.opacity,
        'line-dasharray': [3, 2], // Dashed pattern
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
    });

    console.log('✅ Routes background layers added');

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

    // Add route highlight layer (thicker line with route's own color)
    this.map.addLayer({
      id: 'routes-highlight',
      type: 'line',
      source: 'routes',
      filter: ['==', 'route_id', ''], // Initially matches nothing
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 6,
        'line-opacity': 1.0,
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
    });

    this.initialized = true;
    console.log('✅ Routes layers initialized successfully');
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
   * Detect overlapping routes using Turf.js
   * Compares routes (not individual trips) by using one representative trip per route
   */
  private detectOverlappingRoutes(): RouteOverlap[] {
    const overlaps: RouteOverlap[] = [];

    // Group features by route_id and pick one representative trip per route
    const routeRepresentatives = new Map<string, RouteFeature>();
    this.routeFeatures.forEach(feature => {
      const routeId = feature.properties.route_id;
      // Use first trip as representative for each route
      if (!routeRepresentatives.has(routeId)) {
        routeRepresentatives.set(routeId, feature);
      }
    });

    const routeIds = Array.from(routeRepresentatives.keys());
    console.log(`🔍 Checking for overlaps between ${routeIds.length} routes (using representative trips)...`);

    // Compare each pair of different routes (using one trip per route)
    for (let i = 0; i < routeIds.length; i++) {
      for (let j = i + 1; j < routeIds.length; j++) {
        const routeAId = routeIds[i];
        const routeBId = routeIds[j];
        const featureA = routeRepresentatives.get(routeAId)!;
        const featureB = routeRepresentatives.get(routeBId)!;

        try {
          const overlap = turf.lineOverlap(featureA, featureB, {
            tolerance: 0.05, // 50 meters
          });

          if (overlap.features.length > 0) {
            // Calculate overlap metrics
            const lineALength = turf.length(featureA);
            const overlapLength = overlap.features.reduce((sum, segment) => {
              return sum + turf.length(segment);
            }, 0);
            const overlapPercentage = lineALength > 0 ? (overlapLength / lineALength) * 100 : 0;

            console.log(
              `  📊 Overlap: ${routeAId} ↔ ${routeBId}: ${overlapPercentage.toFixed(1)}% (${overlapLength.toFixed(2)}km)`
            );

            // Record the overlap - will apply to ALL trips of both routes
            overlaps.push({
              routeAId,
              routeBId,
              tripAId: featureA.id as string,
              tripBId: featureB.id as string,
              overlapSegments: overlap.features,
              overlapPercentage,
            });
          }
        } catch (error) {
          console.warn(`Error detecting overlap between ${routeAId} and ${routeBId}:`, error);
        }
      }
    }

    console.log(`🔍 Detected ${overlaps.length} overlapping route pairs`);
    return overlaps;
  }

  /**
   * Mark routes that have overlaps with visual styling
   */
  private markOverlappingRoutes(overlaps: RouteOverlap[]): void {
    console.log(`🎨 Marking ${overlaps.length} overlapping route pairs with dashed styling...`);

    const overlappingRouteIds = new Set<string>();

    // Collect all route_ids that have overlaps
    overlaps.forEach(overlap => {
      overlappingRouteIds.add(overlap.routeAId);
      overlappingRouteIds.add(overlap.routeBId);
    });

    console.log(`  📍 ${overlappingRouteIds.size} routes have overlaps`);

    // Mark ALL trips of overlapping routes
    let markedCount = 0;
    this.routeFeatures.forEach(feature => {
      if (overlappingRouteIds.has(feature.properties.route_id)) {
        feature.properties.hasOverlap = true;
        markedCount++;
      }
    });

    console.log(`✅ Marked ${markedCount} trips across ${overlappingRouteIds.size} routes with dashed styling`);
  }

  /**
   * Render routes using MapLibre with smooth line rendering
   */
  public async renderRoutes(
    _options: Partial<RouteRenderingOptions> = {}
  ): Promise<void> {
    console.log(
      '🎨 Rendering routes using MapLibre with smooth line rendering...'
    );

    // Ensure layers are initialized
    await this.ensureInitialized();

    // Create route features
    this.routeFeatures = this.createRouteFeatures();

    if (this.routeFeatures.length === 0) {
      console.warn('No route features available for rendering');
      return;
    }

    // Detect overlapping routes and mark them with visual styling
    const overlaps = this.detectOverlappingRoutes();
    if (overlaps.length > 0) {
      this.markOverlappingRoutes(overlaps);
    }

    // Source is guaranteed to exist now
    const source = this.map.getSource('routes') as maplibregl.GeoJSONSource;
    const geoJsonData = {
      type: 'FeatureCollection' as const,
      features: this.routeFeatures,
    };

    source.setData(geoJsonData);
    this.map.triggerRepaint();

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

    // Use thicker line with route color
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
    if (this.map.getLayer('routes-overlapping')) {
      this.map.removeLayer('routes-overlapping');
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
