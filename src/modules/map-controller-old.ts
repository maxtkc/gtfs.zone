import { Map as MapLibreMap, LngLatBounds, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { PageStateManager } from './page-state-manager.js';
import { GTFSDatabaseRecord } from './gtfs-database.js';
import {
  Stops,
  Routes,
  Trips,
  StopTimes,
  Shapes,
} from '../types/gtfs-entities.js';

// Map interaction modes
export enum MapMode {
  NAVIGATE = 'navigate',
  ADD_STOP = 'add_stop',
  EDIT_STOPS = 'edit_stops',
}

// Type definitions for internal map controller functions
interface RouteData {
  route_id: string;
  route: Routes;
  color: string;
}

interface RouteInfo {
  route_id: string;
  route: Routes;
  color: string;
  trip_id: string;
}

interface RouteSegment {
  geometry: GeoJSON.LineString;
  routes: RouteInfo[];
  hasShapes: boolean;
  segmentHash: string;
  route_id?: string;
  route?: Routes;
  color?: string;
  trip_id?: string;
}

export class MapController {
  private map: MapLibreMap | null;
  private mapElementId: string;
  private gtfsParser: {
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
  } | null;
  private resizeTimeout: NodeJS.Timeout | null;
  private shapeToRouteMapping: Map<string, string[]> = new Map();
  private onRouteSelectCallback: ((route_id: string) => void) | null = null;
  private onStopSelectCallback: ((stop_id: string) => void) | null = null;
  private pageStateManager: PageStateManager | null = null;
  private currentMode: MapMode = MapMode.NAVIGATE;
  private onModeChangeCallback: ((mode: MapMode) => void) | null = null;

  constructor(mapElementId = 'map') {
    this.map = null;
    this.mapElementId = mapElementId;
    this.gtfsParser = null;
    this.resizeTimeout = null;
  }

  initialize(gtfsParser: {
    getFileDataSync: (filename: string) => GTFSDatabaseRecord[] | null;
    getFileDataSyncTyped: <T>(filename: string) => T[] | null;
  }) {
    this.gtfsParser = gtfsParser;

    // Initialize MapLibre GL JS map (keeping original approach)
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
      center: [-74.006, 40.7128], // [lng, lat] format for MapLibre
      zoom: 10,
    });

    // Keep welcome overlay visible initially
    const welcomeOverlay = document.getElementById('map-overlay');
    if (welcomeOverlay) {
      welcomeOverlay.classList.remove('hidden');
    }
  }

  setPageStateManager(pageStateManager: PageStateManager) {
    this.pageStateManager = pageStateManager;
  }

  updateMap() {
    if (
      !this.gtfsParser ||
      !this.gtfsParser.getFileDataSync('stops.txt') ||
      !this.map
    ) {
      return;
    }

    // Wait for map to be loaded before adding sources/layers
    if (!this.map.loaded()) {
      this.map.on('load', () => this.updateMap());
      return;
    }

    // Clear existing sources and layers
    this.clearMapLayers();

    // Build shape to route mapping for enhanced rendering
    this.buildShapeToRouteMapping();

    // Add enhanced routes with proper layering
    this.addEnhancedRoutesToMap();

    // Add enhanced stops to map
    this.addStopsToMap();

    // Add unified click handler that prioritizes stops over routes
    this.addUnifiedClickHandler();
  }

  clearMapLayers() {
    // Remove existing layers and sources with new layering structure
    const layersToRemove = [
      'routes-background',
      'routes-clickarea',
      'stops-background',
      'stops-clickarea',
      'stops-highlight',
      'trip-highlight',
      // Legacy layers
      'stops',
      'routes',
      'shapes',
    ];
    const sourcesToRemove = [
      'routes',
      'stops',
      'stops-highlight',
      'trip-highlight',
    ];

    layersToRemove.forEach((layerId) => {
      if (this.map.getLayer(layerId)) {
        this.map.removeLayer(layerId);
      }
    });

    sourcesToRemove.forEach((sourceId) => {
      if (this.map.getSource(sourceId)) {
        this.map.removeSource(sourceId);
      }
    });
  }

  addStopsToMap() {
    const stops = this.gtfsParser.getFileDataSyncTyped<Stops>('stops.txt');
    if (!stops) {
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

    // Create GeoJSON for stops
    const stopsGeoJSON = {
      type: 'FeatureCollection',
      features: validStops.map((stop) => {
        const lat = parseFloat(stop.stop_lat);
        const lon = parseFloat(stop.stop_lon);
        const stopType = stop.location_type || '0';

        // Get routes serving this stop
        const routesAtStop = this.gtfsParser.getRoutesForStop(stop.stop_id);

        // Determine primary route color for stroke (use first route's color)
        let primaryRouteColor = '#2563eb'; // Default blue
        if (routesAtStop.length > 0) {
          const primaryRoute = routesAtStop[0];
          primaryRouteColor = this.getRouteColor(
            primaryRoute.route_id as string,
            primaryRoute.route_color as string
          );
        }

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lon, lat], // [lng, lat] for MapLibre
          },
          properties: {
            stop_id: stop.stop_id,
            stop_name: stop.stop_name || 'Unnamed Stop',
            stop_code: stop.stop_code || '',
            stop_desc: stop.stop_desc || '',
            location_type: stopType,
            wheelchair_boarding: stop.wheelchair_boarding || '',
            routes_count: routesAtStop.length,
            routes_list: routesAtStop
              .map((r) => r.route_short_name || r.route_id)
              .join(', '),
            primary_route_color: primaryRouteColor,
          },
        };
      }),
    };

    // Add source with feature IDs for state management
    const stopsGeoJSONWithIds = {
      ...stopsGeoJSON,
      features: stopsGeoJSON.features.map((feature) => ({
        ...feature,
        id: feature.properties.stop_id, // Add ID for feature state
      })),
    };

    this.map.addSource('stops', {
      type: 'geojson',
      data: stopsGeoJSONWithIds,
    });

    // Add background stops layer (all stops, normal size)
    this.map.addLayer({
      id: 'stops-background',
      type: 'circle',
      source: 'stops',
      paint: {
        'circle-radius': [
          'case',
          ['==', ['get', 'location_type'], '1'],
          10, // Station
          ['==', ['get', 'location_type'], '2'],
          5, // Entrance/Exit
          ['==', ['get', 'location_type'], '3'],
          5, // Generic node
          ['==', ['get', 'location_type'], '4'],
          7, // Boarding area
          7, // Default stop
        ],
        'circle-color': '#ffffff', // White fill for all stops
        'circle-stroke-color': [
          'case',
          // Use route color if available, otherwise fall back to location type colors
          ['>', ['get', 'routes_count'], 0],
          ['get', 'primary_route_color'],
          // Fallback colors for stops without routes
          ['==', ['get', 'location_type'], '1'],
          '#dc2626', // Station - red
          ['==', ['get', 'location_type'], '2'],
          '#16a34a', // Entrance - green
          ['==', ['get', 'location_type'], '3'],
          '#ca8a04', // Node - yellow
          ['==', ['get', 'location_type'], '4'],
          '#7c3aed', // Boarding - purple
          '#2563eb', // Default - blue
        ],
        'circle-stroke-width': 2.5,
        'circle-opacity': 1,
        'circle-stroke-opacity': 1,
      },
    });

    // Add invisible larger click areas for stops
    this.map.addLayer({
      id: 'stops-clickarea',
      type: 'circle',
      source: 'stops',
      paint: {
        'circle-radius': 15, // Larger click area (3x the visual size)
        'circle-color': 'transparent',
        'circle-opacity': 0,
      },
    });

    // Add hover cursor for stop layers including click area
    ['stops-background', 'stops-clickarea'].forEach((layerId) => {
      this.map.on('mouseenter', layerId, () => {
        this.map.getCanvas().style.cursor = 'pointer';
      });

      this.map.on('mouseleave', layerId, () => {
        this.map.getCanvas().style.cursor = '';
      });
    });

    // Fit map to show all stops
    if (validStops.length > 0) {
      const coordinates = validStops.map((stop) => [
        parseFloat(stop.stop_lon),
        parseFloat(stop.stop_lat),
      ]);
      const bounds = coordinates.reduce(
        (bounds, coord) => {
          return bounds.extend(coord);
        },
        new LngLatBounds(coordinates[0], coordinates[0])
      );

      this.map.fitBounds(bounds, { padding: 50 });
    }
  }

  private addUnifiedClickHandler() {
    // Remove any existing click handler to avoid duplicates
    this.map.off('click');

    // Add single map click handler that respects current mode
    this.map.on('click', (e) => {
      // Handle different modes
      if (this.currentMode === MapMode.ADD_STOP) {
        this.handleAddStopClick(e);
        return;
      }

      // Default navigation mode - query features and prioritize stops
      const features = this.map.queryRenderedFeatures(e.point, {
        layers: ['stops-clickarea', 'routes-clickarea'],
      });

      if (features.length > 0) {
        // Prioritize stops over routes
        const stopFeature = features.find((f) =>
          f.layer.id.startsWith('stops-')
        );
        const routeFeature = features.find((f) =>
          f.layer.id.startsWith('routes-')
        );

        if (stopFeature) {
          // Handle stop click
          const stop_id = stopFeature.properties.stop_id;
          console.log('clicked on stop', stop_id);
          this.navigateToStop(stop_id);
        } else if (routeFeature) {
          // Handle route click - use primary route for navigation
          const route_id =
            routeFeature.properties.primary_route_id ||
            routeFeature.properties.route_id;
          console.log(
            'clicked on route',
            route_id,
            'from feature with',
            routeFeature.properties.route_ids?.length || 1,
            'routes'
          );
          this.navigateToRoute(route_id);
        }
      }
    });
  }

  private async handleAddStopClick(e) {
    if (!this.gtfsParser) {
      console.error('Cannot add stop: GTFSParser not initialized');
      return;
    }

    const { lng, lat } = e.lngLat;

    // Generate unique stop ID
    const stops =
      this.gtfsParser.getFileDataSyncTyped<Stops>('stops.txt') || [];
    const stopIds = stops.map((stop) => stop.stop_id);
    let newStopId = `stop_${Date.now()}`;

    // Ensure uniqueness
    while (stopIds.includes(newStopId)) {
      newStopId = `stop_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    }

    // Create new stop object
    const newStop: Stops = {
      stop_id: newStopId,
      stop_name: `New Stop ${stops.length + 1}`,
      stop_lat: lat.toFixed(6),
      stop_lon: lng.toFixed(6),
      location_type: '0', // Default to stop/platform
    };

    console.log('Creating new stop:', newStop);

    try {
      // Add stop to data
      await this.addStopToData(newStop);

      // Switch back to navigation mode
      this.setMapMode(MapMode.NAVIGATE);

      // Refresh map to show new stop
      this.updateMap();
    } catch (error) {
      console.error('Failed to create stop:', error);
      // Keep in add mode if creation failed
    }
  }

  // Hash geometry coordinates for deduplication
  private hashGeometry(geometry: GeoJSON.LineString): string {
    const coordString = geometry.coordinates
      .map((coord) => `${coord[0].toFixed(6)},${coord[1].toFixed(6)}`)
      .join('|');
    return this.simpleHash(coordString);
  }

  // Simple hash function for coordinate strings
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Select primary route based on trip frequency or route priority
  private selectPrimaryRoute(
    routeData: RouteData[],
    trips: Trips[]
  ): RouteData | null {
    if (routeData.length === 0) {
      return null;
    }
    if (routeData.length === 1) {
      return routeData[0];
    }

    // Count trips per route to determine primary route
    const routeTripCounts = routeData.map(({ route_id, route, color }) => {
      const tripCount = trips.filter(
        (trip) => trip.route_id === route_id
      ).length;
      return { route_id, route, color, tripCount };
    });

    // Sort by trip count (descending) and return the route with most trips
    routeTripCounts.sort((a, b) => b.tripCount - a.tripCount);
    return routeTripCounts[0];
  }

  // Build individual route segments for overlap analysis
  private buildRouteSegments(
    routes: Routes[],
    trips: Trips[],
    shapes: Shapes[],
    stopTimes: StopTimes[],
    stops: Stops[]
  ): RouteSegment[] {
    const segments = [];

    routes.forEach((route) => {
      const route_id = route.route_id as string;
      const routeColor = this.getRouteColor(
        route_id,
        route.route_color as string
      );

      // Find trips for this route
      const routeTrips = trips.filter((trip) => trip.route_id === route_id);
      if (routeTrips.length === 0) {
        return;
      }

      // Process each trip to build segments
      routeTrips.forEach((trip) => {
        let geometry = null;
        let hasShapes = false;

        // Try to use shape data first
        if (trip.shape_id && shapes) {
          geometry = this.createRouteGeometryFromShape(trip.shape_id, shapes);
          hasShapes = !!geometry;
        }

        // Fall back to stop connections if no shape
        if (!geometry && stopTimes && stops) {
          geometry = this.createRouteGeometryFromStops(trip.trip_id);
        }

        if (geometry) {
          // Break route into segments between consecutive coordinate pairs
          const coords = geometry.coordinates;
          for (let i = 0; i < coords.length - 1; i++) {
            const segmentGeometry = {
              type: 'LineString',
              coordinates: [coords[i], coords[i + 1]],
            };

            segments.push({
              route_id,
              route,
              color: routeColor,
              trip_id: trip.trip_id,
              geometry: segmentGeometry,
              hasShapes,
              segmentIndex: i,
              segmentHash: this.hashGeometry(segmentGeometry),
            });
          }
        }
      });
    });

    return segments;
  }

  // Deduplicate overlapping segments and merge routes
  private deduplicateOverlappingSegments(
    segments: RouteSegment[]
  ): RouteSegment[] {
    const segmentMap = new Map(); // segmentHash -> merged segment data

    segments.forEach((segment) => {
      const hash = segment.segmentHash;

      if (!segmentMap.has(hash)) {
        // First occurrence of this segment
        segmentMap.set(hash, {
          geometry: segment.geometry,
          routes: [
            {
              route_id: segment.route_id,
              route: segment.route,
              color: segment.color,
              trip_id: segment.trip_id,
            },
          ],
          hasShapes: segment.hasShapes,
          segmentHash: hash,
        });
      } else {
        // Segment already exists - add this route to it
        const existing = segmentMap.get(hash);
        const routeExists = existing.routes.some(
          (r) => r.route_id === segment.route_id
        );

        if (!routeExists) {
          existing.routes.push({
            route_id: segment.route_id,
            route: segment.route,
            color: segment.color,
            trip_id: segment.trip_id,
          });
        }
      }
    });

    // Convert map to array and determine primary route for each segment
    return Array.from(segmentMap.values()).map((segmentData) => {
      // Select primary route based on frequency or priority
      const primaryRoute = this.selectPrimaryRouteForSegment(
        segmentData.routes
      );

      return {
        ...segmentData,
        primaryRoute,
      };
    });
  }

  // Select primary route for a segment (can be different logic than main route selection)
  private selectPrimaryRouteForSegment(routes: RouteInfo[]): RouteInfo {
    if (routes.length === 1) {
      return routes[0];
    }

    // For segments, prioritize by route type (rail > BRT > bus) then by frequency
    const routePriority = {
      '0': 10, // Tram/Light Rail
      '1': 10, // Subway/Metro
      '2': 10, // Rail
      '3': 8, // Bus (BRT-like)
      '4': 6, // Ferry
      '5': 5, // Cable Car
      '6': 4, // Gondola
      '7': 3, // Funicular
      '11': 7, // Trolleybus
      '12': 2, // Monorail
    };

    // Sort by route type priority, then by route name/ID as tiebreaker
    routes.sort((a, b) => {
      const priorityA = routePriority[a.route.route_type] || 1;
      const priorityB = routePriority[b.route.route_type] || 1;

      if (priorityA !== priorityB) {
        return priorityB - priorityA; // Higher priority first
      }

      // Tiebreaker: alphabetical by route short name or ID
      const nameA = a.route.route_short_name || a.route_id;
      const nameB = b.route.route_short_name || b.route_id;
      return nameA.localeCompare(nameB);
    });

    return routes[0];
  }

  // Deterministic color generation for routes
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

  // Diagnostic method to analyze shape usage patterns
  private analyzeShapeUsage(
    routes: Routes[],
    trips: Trips[],
    shapes: Shapes[] | null
  ): void {
    console.group('🔍 Shape Usage Analysis');

    const totalShapes = shapes
      ? new Set(shapes.map((s) => s.shape_id)).size
      : 0;
    console.log(`📊 Total unique shapes in shapes.txt: ${totalShapes}`);

    const routeShapeStats = new Map();

    routes.forEach((route) => {
      const route_id = route.route_id as string;
      const routeTrips = trips.filter((trip) => trip.route_id === route_id);
      const tripsWithShapes = routeTrips.filter((trip) => trip.shape_id);
      const uniqueShapes = new Set(
        tripsWithShapes.map((trip) => trip.shape_id)
      );

      routeShapeStats.set(route_id, {
        totalTrips: routeTrips.length,
        tripsWithShapes: tripsWithShapes.length,
        uniqueShapes: uniqueShapes.size,
        shape_ids: Array.from(uniqueShapes),
        routeName: route.route_short_name || route.route_long_name || route_id,
      });

      if (uniqueShapes.size > 1) {
        console.warn(
          `⚠️  Route ${route_id} (${route.route_short_name || route.route_long_name}) has ${uniqueShapes.size} different shapes:`,
          Array.from(uniqueShapes)
        );
      }
    });

    const routesWithMultipleShapes = Array.from(
      routeShapeStats.values()
    ).filter((stats) => stats.uniqueShapes > 1);
    const totalUsedShapes = new Set();
    routeShapeStats.forEach((stats) => {
      stats.shape_ids.forEach((id) => totalUsedShapes.add(id));
    });

    console.log(
      `🎯 Routes with multiple shapes: ${routesWithMultipleShapes.length}/${routes.length}`
    );
    console.log(`📈 Total shapes referenced by trips: ${totalUsedShapes.size}`);
    console.log(`❌ Unused shapes: ${totalShapes - totalUsedShapes.size}`);

    if (routesWithMultipleShapes.length > 0) {
      console.table(
        routesWithMultipleShapes.map((stats) => ({
          Route: stats.routeName,
          'Total Trips': stats.totalTrips,
          'Trips w/ Shapes': stats.tripsWithShapes,
          'Unique Shapes': stats.uniqueShapes,
          'Shape IDs': stats.shape_ids.join(', '),
        }))
      );
    }

    console.groupEnd();
  }

  // Build enhanced mapping from shape_id to route_id(s) with metadata
  private buildShapeToRouteMapping(): void {
    this.shapeToRouteMapping.clear();

    const trips = this.gtfsParser.getFileDataSyncTyped<Trips>('trips.txt');
    if (!trips) {
      return;
    }

    // Enhanced mapping that tracks usage statistics
    const shapeUsage = new Map();

    trips.forEach((trip) => {
      if (trip.shape_id && trip.route_id) {
        const shape_id = trip.shape_id as string;
        const route_id = trip.route_id as string;

        // Initialize shape tracking
        if (!shapeUsage.has(shape_id)) {
          shapeUsage.set(shape_id, {
            routes: new Set(),
            tripCount: 0,
            route_ids: [],
          });
        }

        const usage = shapeUsage.get(shape_id);
        usage.routes.add(route_id);
        usage.tripCount++;

        // Maintain backward compatibility with existing mapping
        if (!this.shapeToRouteMapping.has(shape_id)) {
          this.shapeToRouteMapping.set(shape_id, []);
        }
        const route_ids = this.shapeToRouteMapping.get(shape_id)!;
        if (!route_ids.includes(route_id)) {
          route_ids.push(route_id);
        }
      }
    });

    // Convert enhanced mapping back to simple array format
    shapeUsage.forEach((usage, shape_id) => {
      this.shapeToRouteMapping.set(shape_id, Array.from(usage.routes));
    });

    console.log(
      `🔗 Shape-to-Route mapping updated: ${this.shapeToRouteMapping.size} shapes mapped to routes`
    );
  }

  // Enhanced route rendering with segment-level deduplication to prevent opacity stacking
  private addEnhancedRoutesToMap(): void {
    const routes = this.gtfsParser.getFileDataSyncTyped<Routes>('routes.txt');
    const trips = this.gtfsParser.getFileDataSyncTyped<Trips>('trips.txt');
    const shapes = this.gtfsParser.getFileDataSyncTyped<Shapes>('shapes.txt');
    const stopTimes =
      this.gtfsParser.getFileDataSyncTyped<StopTimes>('stop_times.txt');
    const stops = this.gtfsParser.getFileDataSyncTyped<Stops>('stops.txt');

    if (!routes || !trips) {
      return;
    }

    // Diagnostic logging for shape analysis
    this.analyzeShapeUsage(routes, trips, shapes);

    // Build route segments and detect overlaps
    const routeSegments = this.buildRouteSegments(
      routes,
      trips,
      shapes,
      stopTimes,
      stops
    );
    const dedupedSegments = this.deduplicateOverlappingSegments(routeSegments);

    console.log(
      `🎨 Created ${dedupedSegments.length} deduplicated route segments from ${routeSegments.length} original segments`
    );

    // Convert deduplicated segments back to map features
    const routeFeatures = dedupedSegments.map((segment, index) => ({
      type: 'Feature',
      id: `segment_${index}`,
      geometry: segment.geometry,
      properties: {
        route_ids: segment.routes.map((r) => r.route_id),
        primary_route_id: segment.primaryRoute.route_id,
        route_short_name: segment.primaryRoute.route.route_short_name || '',
        route_long_name: segment.primaryRoute.route.route_long_name || '',
        route_desc: segment.primaryRoute.route.route_desc || '',
        route_type: segment.primaryRoute.route.route_type || '',
        route_type_text: this.gtfsParser.getRouteTypeText(
          segment.primaryRoute.route.route_type as string
        ),
        agency_id: segment.primaryRoute.route.agency_id || 'Default',
        color: segment.primaryRoute.color,
        has_shapes: segment.hasShapes,
        is_multiple_shapes: false,
        segment_type: 'deduplicated',
        routes_count: segment.routes.length,
      },
    }));

    if (routeFeatures.length > 0) {
      const routesGeoJSON = {
        type: 'FeatureCollection',
        features: routeFeatures,
      };

      // Add source
      this.map.addSource('routes', {
        type: 'geojson',
        data: routesGeoJSON,
      });

      // Add background route layer with visual differentiation for multiple shapes
      this.map.addLayer({
        id: 'routes-background',
        type: 'line',
        source: 'routes',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'focused'], false],
            5, // Focused segment - thicker
            3, // Default segment width
          ],
          'line-opacity': 0.8, // Consistent opacity for all routes
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      });

      // Add invisible wider click areas for routes
      this.map.addLayer({
        id: 'routes-clickarea',
        type: 'line',
        source: 'routes',
        paint: {
          'line-color': 'transparent',
          'line-width': 15, // Much wider click area
          'line-opacity': 0,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      });

      // Add hover states for all layers including click area
      ['routes-background', 'routes-clickarea'].forEach((layerId) => {
        this.map.on('mouseenter', layerId, () => {
          this.map.getCanvas().style.cursor = 'pointer';
        });

        this.map.on('mouseleave', layerId, () => {
          this.map.getCanvas().style.cursor = '';
        });
      });
    }
  }

  // Create route geometry from shapes.txt
  private createRouteGeometryFromShape(
    shape_id: string,
    shapes: Shapes[]
  ): GeoJSON.LineString | null {
    const shapePoints = shapes
      .filter((point) => point.shape_id === shape_id)
      .map((point) => ({
        lat: parseFloat(point.shape_pt_lat as string),
        lon: parseFloat(point.shape_pt_lon as string),
        sequence: parseInt(point.shape_pt_sequence as string) || 0,
      }))
      .filter((p) => !isNaN(p.lat) && !isNaN(p.lon))
      .sort((a, b) => a.sequence - b.sequence);

    if (shapePoints.length < 2) {
      console.warn(
        `⚠️  Shape ${shape_id} has insufficient points (${shapePoints.length}), skipping`
      );
      return null;
    }

    return {
      type: 'LineString',
      coordinates: shapePoints.map((p) => [p.lon, p.lat]),
    };
  }

  // Create route geometry from stop connections (fallback)
  private createRouteGeometryFromStops(
    trip_id: string
  ): GeoJSON.LineString | null {
    const stopTimes =
      this.gtfsParser.getFileDataSyncTyped<StopTimes>('stop_times.txt');
    const stops = this.gtfsParser.getFileDataSyncTyped<Stops>('stops.txt');

    if (!stopTimes || !stops) {
      return null;
    }

    // Create stops lookup
    const stopsLookup = {};
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

    const routePath = [];
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

  highlightFileData(fileName) {
    // Add visual emphasis for the selected file's data on map
    // This could be enhanced to highlight specific elements
    // eslint-disable-next-line no-console
    console.log(`Highlighting data for ${fileName}`);
  }

  // Object highlighting methods for Objects navigation
  highlightAgencyRoutes(agency_id) {
    const routes =
      this.gtfsParser.getFileDataSyncTyped<Routes>('routes.txt') || [];
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

  highlightRoute(route_id) {
    // Clear existing highlights
    this.clearHighlights();

    let highlightedSegments = 0;

    // Use feature state to increase line width for focused route
    if (this.map.getSource('routes')) {
      // Set feature state for all features with this route_id
      const routesSource = this.map.getSource('routes');
      if (routesSource && routesSource.type === 'geojson') {
        const data = routesSource._data;
        if (data && data.features) {
          data.features.forEach((feature) => {
            try {
              // Check if this feature contains the route_id (supports deduplication)
              const hasRoute =
                feature.properties.primary_route_id === route_id ||
                (feature.properties.route_ids &&
                  feature.properties.route_ids.includes(route_id));

              if (hasRoute && feature.id !== undefined) {
                this.map.setFeatureState(
                  { source: 'routes', id: feature.id },
                  { focused: true }
                );
                highlightedSegments++;
              }
            } catch (error) {
              console.debug(
                'Could not set feature state for feature:',
                feature.id,
                error
              );
            }
          });
        }
      }
    }

    console.log(
      `🎯 Highlighted ${highlightedSegments} segments for route ${route_id}`
    );
  }

  highlightTrip(trip_id, color = '#e74c3c', weight = 5) {
    const stopTimes =
      this.gtfsParser.getFileDataSyncTyped<StopTimes>('stop_times.txt') || [];
    const stops =
      this.gtfsParser.getFileDataSyncTyped<Stops>('stops.txt') || [];

    // Clear existing highlights
    this.clearHighlights();

    // Create stops lookup
    const stopsLookup = {};
    stops.forEach((stop) => {
      if (stop.stop_lat && stop.stop_lon) {
        stopsLookup[stop.stop_id] = {
          lat: parseFloat(stop.stop_lat),
          lon: parseFloat(stop.stop_lon),
          name: stop.stop_name,
        };
      }
    });

    // Get stop times for this trip
    const tripStopTimes = stopTimes
      .filter((st) => st.trip_id === trip_id)
      .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));

    const tripPath = [];
    const tripStopsFeatures = [];

    tripStopTimes.forEach((st, index) => {
      const stopCoords = stopsLookup[st.stop_id];
      if (stopCoords) {
        tripPath.push([stopCoords.lon, stopCoords.lat]); // [lng, lat] for MapLibre

        const isFirst = index === 0;
        const isLast = index === tripStopTimes.length - 1;

        tripStopsFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [stopCoords.lon, stopCoords.lat],
          },
          properties: {
            stop_name: stopCoords.name,
            is_first: isFirst,
            is_last: isLast,
            stop_type: isFirst ? 'first' : isLast ? 'last' : 'middle',
          },
        });
      }
    });

    if (tripPath.length >= 2) {
      // Create trip line GeoJSON
      const tripLineGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: tripPath,
            },
            properties: {
              trip_id: trip_id,
            },
          },
        ],
      };

      // Add trip line
      this.map.addSource('trip-highlight', {
        type: 'geojson',
        data: tripLineGeoJSON,
      });

      this.map.addLayer({
        id: 'trip-highlight',
        type: 'line',
        source: 'trip-highlight',
        paint: {
          'line-color': color,
          'line-width': weight,
          'line-opacity': 0.9,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      });

      // Add trip stops
      if (tripStopsFeatures.length > 0) {
        const stopsGeoJSON = {
          type: 'FeatureCollection',
          features: tripStopsFeatures,
        };

        this.map.addSource('stops-highlight', {
          type: 'geojson',
          data: stopsGeoJSON,
        });

        this.map.addLayer({
          id: 'stops-highlight',
          type: 'circle',
          source: 'stops-highlight',
          paint: {
            'circle-radius': 8,
            'circle-color': [
              'case',
              ['==', ['get', 'stop_type'], 'first'],
              '#27ae60',
              ['==', ['get', 'stop_type'], 'last'],
              '#e74c3c',
              color,
            ],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
            'circle-opacity': 1,
            'circle-stroke-opacity': 1,
          },
        });

        // Add click handler for trip stops
        this.map.on('click', 'stops-highlight', (_e) => {});
      }

      // Fit map to trip
      if (tripPath.length > 0) {
        const coordinates = tripPath;
        const bounds = coordinates.reduce(
          (bounds, coord) => {
            return bounds.extend(coord);
          },
          new LngLatBounds(coordinates[0], coordinates[0])
        );

        this.map.fitBounds(bounds, { padding: 50 });
      }
    }
  }

  highlightStop(stop_id, color = '#e74c3c', radius = 12) {
    const stops =
      this.gtfsParser.getFileDataSyncTyped<Stops>('stops.txt') || [];

    // Clear existing highlights
    this.clearHighlights();

    const stop = stops.find((s) => s.stop_id === stop_id);
    if (!stop || !stop.stop_lat || !stop.stop_lon) {
      return;
    }

    const lat = parseFloat(stop.stop_lat);
    const lon = parseFloat(stop.stop_lon);

    // Create highlight GeoJSON
    const highlightGeoJSON = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lon, lat],
          },
          properties: {
            stop_id: stop.stop_id,
            stop_name: stop.stop_name || 'Unnamed Stop',
            stop_code: stop.stop_code || '',
          },
        },
      ],
    };

    // Add highlight source and layer
    this.map.addSource('stops-highlight', {
      type: 'geojson',
      data: highlightGeoJSON,
    });

    this.map.addLayer({
      id: 'stops-highlight',
      type: 'circle',
      source: 'stops-highlight',
      paint: {
        'circle-radius': radius,
        'circle-color': color,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 3,
        'circle-opacity': 1,
        'circle-stroke-opacity': 1,
      },
    });

    // Center map on stop
    this.map.setCenter([lon, lat]);
    if (this.map.getZoom() < 15) {
      this.map.setZoom(15);
    }
  }

  clearHighlights() {
    // Clear route feature states safely
    if (this.map.getSource('routes')) {
      const routesSource = this.map.getSource('routes');
      if (routesSource && routesSource.type === 'geojson') {
        const data = routesSource._data;
        if (data && data.features) {
          data.features.forEach((feature) => {
            try {
              // Check if feature has an ID and the feature state exists before removing
              if (feature.id !== undefined) {
                const featureState = this.map.getFeatureState({
                  source: 'routes',
                  id: feature.id,
                });
                if (featureState && featureState.focused) {
                  this.map.removeFeatureState(
                    { source: 'routes', id: feature.id },
                    'focused'
                  );
                }
              }
            } catch (error) {
              // Silently ignore errors for features that don't exist or have no state
              console.debug(
                'Could not clear feature state for feature:',
                feature.id,
                error
              );
            }
          });
        }
      }
    }

    // Clear remaining highlight layers (for trips and stops)
    const highlightLayers = ['trip-highlight', 'stops-highlight'];

    highlightLayers.forEach((layerId) => {
      if (this.map.getLayer(layerId)) {
        this.map.removeLayer(layerId);
      }
      if (this.map.getSource(layerId)) {
        this.map.removeSource(layerId);
      }
    });
  }

  fitToRoutes(route_ids) {
    const trips =
      this.gtfsParser.getFileDataSyncTyped<Trips>('trips.txt') || [];
    const stopTimes =
      this.gtfsParser.getFileDataSyncTyped<StopTimes>('stop_times.txt') || [];
    const stops =
      this.gtfsParser.getFileDataSyncTyped<Stops>('stops.txt') || [];

    // Find all stops for these routes
    const allStops = new Set();

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
    const coordinates = [];
    stops.forEach((stop) => {
      if (allStops.has(stop.stop_id) && stop.stop_lat && stop.stop_lon) {
        coordinates.push([
          parseFloat(stop.stop_lon),
          parseFloat(stop.stop_lat),
        ]); // [lng, lat] for MapLibre
      }
    });

    if (coordinates.length > 0) {
      const bounds = coordinates.reduce(
        (bounds, coord) => {
          return bounds.extend(coord);
        },
        new LngLatBounds(coordinates[0], coordinates[0])
      );

      this.map.fitBounds(bounds, { padding: 50 });
    }
  }

  hideMapOverlay() {
    const welcomeOverlay = document.getElementById('map-overlay');
    if (welcomeOverlay) {
      welcomeOverlay.classList.add('hidden');
    }
  }

  showLoading() {
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

  forceMapResize() {
    if (!this.map) {
      return;
    }

    // Clear any pending resize operations to prevent multiple calls
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }

    // Wait for CSS transition to complete (0.3s + small buffer) and stabilize
    this.resizeTimeout = setTimeout(() => {
      // Get current map center and zoom before resize
      const center = this.map.getCenter();
      const zoom = this.map.getZoom();

      // Resize map to fit container
      this.map.resize();

      // Restore center and zoom to prevent jumping
      this.map.setCenter(center);
      this.map.setZoom(zoom);

      this.resizeTimeout = null;
    }, 350);
  }

  // Focus route using width-based highlighting
  focusRoute(route_id: string) {
    this.highlightRoute(route_id);
  }

  focusStop(stop_id: string) {
    // No-op: Focus system removed, but keeping method for interface compatibility
    console.log('focusStop called (no-op):', stop_id);
  }

  clearFocus() {
    this.clearHighlights();
  }

  // Callback setters for UI integration
  setRouteSelectCallback(callback: (route_id: string) => void) {
    this.onRouteSelectCallback = callback;
  }

  setStopSelectCallback(callback: (stop_id: string) => void) {
    this.onStopSelectCallback = callback;
  }

  // State-based navigation methods (preferred approach)
  private async navigateToRoute(route_id: string) {
    if (this.pageStateManager) {
      await this.pageStateManager.setPageState({ type: 'route', route_id });
    }
    // Keep legacy callback for backward compatibility
    if (this.onRouteSelectCallback) {
      this.onRouteSelectCallback(route_id);
    }
  }

  private async navigateToStop(stop_id: string) {
    if (this.pageStateManager) {
      await this.pageStateManager.setPageState({ type: 'stop', stop_id });
    }
    // Keep legacy callback for backward compatibility
    if (this.onStopSelectCallback) {
      this.onStopSelectCallback(stop_id);
    }
  }

  // Map mode management
  setMapMode(mode: MapMode) {
    if (this.currentMode === mode) {
      return;
    }

    this.currentMode = mode;

    // Update cursor based on mode
    if (this.map) {
      const canvas = this.map.getCanvas();
      switch (mode) {
        case MapMode.ADD_STOP:
          canvas.style.cursor = 'crosshair';
          break;
        case MapMode.EDIT_STOPS:
          canvas.style.cursor = 'move';
          break;
        case MapMode.NAVIGATE:
        default:
          canvas.style.cursor = '';
          break;
      }
    }

    // Update stop interactivity based on mode
    this.updateStopInteractivity(mode);

    // Notify UI of mode change
    if (this.onModeChangeCallback) {
      this.onModeChangeCallback(mode);
    }
  }

  getCurrentMode(): MapMode {
    return this.currentMode;
  }

  setModeChangeCallback(callback: (mode: MapMode) => void) {
    this.onModeChangeCallback = callback;
  }

  // Add stop to GTFS data
  private async addStopToData(stop: Stops) {
    if (!this.gtfsParser) {
      throw new Error('GTFSParser not initialized');
    }

    try {
      await this.gtfsParser.createStop(stop as GTFSDatabaseRecord);
      console.log('Stop added successfully:', stop.stop_id);
    } catch (error) {
      console.error('Failed to add stop:', error);
      throw error;
    }
  }

  // Toggle add stop mode
  toggleAddStopMode() {
    const newMode =
      this.currentMode === MapMode.ADD_STOP
        ? MapMode.NAVIGATE
        : MapMode.ADD_STOP;
    this.setMapMode(newMode);
  }

  // Toggle edit stops mode
  toggleEditStopsMode() {
    const newMode =
      this.currentMode === MapMode.EDIT_STOPS
        ? MapMode.NAVIGATE
        : MapMode.EDIT_STOPS;
    this.setMapMode(newMode);
  }

  // Update stop interactivity based on current mode
  private updateStopInteractivity(mode: MapMode) {
    if (!this.map || !this.map.getSource('stops')) {
      return;
    }

    switch (mode) {
      case MapMode.EDIT_STOPS:
        console.log('Entering edit stops mode - stops will become draggable');
        this.enableStopDragging();
        break;
      case MapMode.NAVIGATE:
      case MapMode.ADD_STOP:
      default:
        console.log('Exiting edit stops mode - stops are no longer draggable');
        this.disableStopDragging();
        break;
    }
  }

  // Enable draggable behavior for stops
  private enableStopDragging() {
    if (!this.map) {
      return;
    }

    // Store drag state
    let isDragging = false;
    let draggedStopId: string | null = null;

    // Update cursor for stop layers in edit mode
    ['stops-background', 'stops-clickarea'].forEach((layerId) => {
      this.map.on('mouseenter', layerId, () => {
        if (this.currentMode === MapMode.EDIT_STOPS) {
          this.map.getCanvas().style.cursor = 'grab';
        }
      });

      this.map.on('mouseleave', layerId, () => {
        if (this.currentMode === MapMode.EDIT_STOPS && !isDragging) {
          this.map.getCanvas().style.cursor = 'move';
        }
      });
    });

    // Mouse down on stop - start dragging
    this.map.on('mousedown', 'stops-clickarea', (e) => {
      if (this.currentMode !== MapMode.EDIT_STOPS) {
        return;
      }

      e.preventDefault();
      const feature = e.features[0];
      if (!feature) {
        return;
      }

      draggedStopId = feature.properties.stop_id;
      isDragging = true;
      this.map.getCanvas().style.cursor = 'grabbing';

      // Highlight the dragged stop
      this.map.setFeatureState(
        { source: 'stops', id: draggedStopId },
        { dragging: true }
      );

      // Add visual feedback for dragging
      this.updateStopDragStyles(true);
    });

    // Mouse move - update stop position
    this.map.on('mousemove', (e) => {
      if (
        !isDragging ||
        !draggedStopId ||
        this.currentMode !== MapMode.EDIT_STOPS
      ) {
        return;
      }

      // Update the stop position in the GeoJSON source
      const source = this.map.getSource('stops') as GeoJSONSource;
      const data = (source as unknown as { _data: GeoJSON.FeatureCollection })
        ._data;

      // Find and update the feature coordinates
      const featureIndex = data.features.findIndex(
        (f) => f.properties && f.properties.stop_id === draggedStopId
      );

      if (featureIndex !== -1) {
        (data.features[featureIndex].geometry as GeoJSON.Point).coordinates = [
          e.lngLat.lng,
          e.lngLat.lat,
        ];
        source.setData(data);
      }
    });

    // Mouse up - finish dragging
    this.map.on('mouseup', () => {
      if (!isDragging || !draggedStopId) {
        return;
      }

      const source = this.map.getSource('stops') as GeoJSONSource;
      const data = (source as unknown as { _data: GeoJSON.FeatureCollection })
        ._data;
      const finalPosition = data.features.find(
        (f) => f.properties && f.properties.stop_id === draggedStopId
      );

      if (finalPosition) {
        const [lng, lat] = (finalPosition.geometry as GeoJSON.Point)
          .coordinates;
        console.log(`Stop ${draggedStopId} moved to: ${lat}, ${lng}`);

        // Update the database with new coordinates
        this.updateStopCoordinates(draggedStopId, lat, lng);
      }

      // Clean up drag state
      this.map.setFeatureState(
        { source: 'stops', id: draggedStopId },
        { dragging: false }
      );

      draggedStopId = null;
      isDragging = false;
      this.map.getCanvas().style.cursor = 'move';

      // Remove visual feedback for dragging
      this.updateStopDragStyles(false);
    });
  }

  // Disable draggable behavior for stops
  private disableStopDragging() {
    if (!this.map) {
      return;
    }

    // Remove drag-specific event listeners
    this.map.off('mousedown', 'stops-clickarea');
    this.map.off('mousemove');
    this.map.off('mouseup');

    // Reset cursor behavior to default
    ['stops-background', 'stops-clickarea'].forEach((layerId) => {
      this.map.off('mouseenter', layerId);
      this.map.off('mouseleave', layerId);

      // Re-add original cursor behavior
      this.map.on('mouseenter', layerId, () => {
        this.map.getCanvas().style.cursor = 'pointer';
      });

      this.map.on('mouseleave', layerId, () => {
        this.map.getCanvas().style.cursor = '';
      });
    });

    // Clear any dragging states
    const source = this.map.getSource('stops') as GeoJSONSource;
    if (
      source &&
      (source as unknown as { _data: GeoJSON.FeatureCollection })._data
    ) {
      const data = (source as unknown as { _data: GeoJSON.FeatureCollection })
        ._data;
      data.features.forEach((feature) => {
        if (feature.properties && feature.properties.stop_id) {
          this.map.setFeatureState(
            { source: 'stops', id: feature.properties.stop_id },
            { dragging: false }
          );
        }
      });
    }

    // Remove visual feedback for dragging
    this.updateStopDragStyles(false);
  }

  // Update visual styles for dragging feedback
  private updateStopDragStyles(isDragging: boolean) {
    if (!this.map || !this.map.getLayer('stops-background')) {
      return;
    }

    // Update the paint properties to show visual feedback
    this.map.setPaintProperty('stops-background', 'circle-radius', [
      'case',
      ['boolean', ['feature-state', 'dragging'], false],
      isDragging
        ? [
            'case',
            ['==', ['get', 'location_type'], '1'],
            15, // Station - larger when dragging
            ['==', ['get', 'location_type'], '2'],
            8, // Entrance/Exit
            ['==', ['get', 'location_type'], '3'],
            8, // Generic node
            ['==', ['get', 'location_type'], '4'],
            10, // Boarding area
            10, // Default stop
          ]
        : [
            'case',
            ['==', ['get', 'location_type'], '1'],
            10, // Station
            ['==', ['get', 'location_type'], '2'],
            5, // Entrance/Exit
            ['==', ['get', 'location_type'], '3'],
            5, // Generic node
            ['==', ['get', 'location_type'], '4'],
            7, // Boarding area
            7, // Default stop
          ],
      // Default radius when not dragging
      [
        'case',
        ['==', ['get', 'location_type'], '1'],
        10, // Station
        ['==', ['get', 'location_type'], '2'],
        5, // Entrance/Exit
        ['==', ['get', 'location_type'], '3'],
        5, // Generic node
        ['==', ['get', 'location_type'], '4'],
        7, // Boarding area
        7, // Default stop
      ],
    ]);

    // Add shadow effect when dragging
    this.map.setPaintProperty('stops-background', 'circle-opacity', [
      'case',
      ['boolean', ['feature-state', 'dragging'], false],
      0.8,
      1,
    ]);
  }

  // Update stop coordinates in the database
  private async updateStopCoordinates(
    stopId: string,
    lat: number,
    lng: number
  ) {
    if (!this.gtfsParser || !this.gtfsParser.updateStopCoordinates) {
      console.error('GTFSParser or updateStopCoordinates method not available');
      return;
    }

    try {
      await this.gtfsParser.updateStopCoordinates(stopId, lat, lng);
      console.log(
        `Successfully updated coordinates for stop ${stopId}: ${lat}, ${lng}`
      );

      // Show success notification
      this.showNotification(`Stop ${stopId} coordinates updated`, 'success');
    } catch (error) {
      console.error(`Failed to update coordinates for stop ${stopId}:`, error);

      // Show error notification
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.showNotification(
        `Failed to update stop coordinates: ${errorMessage}`,
        'error'
      );

      // Revert the visual change by refreshing the map
      this.updateMap();
    }
  }

  // Show notification to user (uses external notification system)
  private showNotification(
    message: string,
    type: 'success' | 'error' | 'warning' = 'success'
  ) {
    // Import and use the notification system
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
        // Fallback to console
        console.log(`${type.toUpperCase()}: ${message}`);
      });
  }
}
