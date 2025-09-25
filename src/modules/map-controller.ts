import { Map as MapLibreMap, LngLatBounds } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { PageStateManager } from './page-state-manager.js';

export class MapController {
  private map: MapLibreMap | null;
  private mapElementId: string;
  private gtfsParser: {
    getFileDataSync: (filename: string) => Record<string, unknown>[];
    getRoutesForStop: (stopId: string) => Record<string, unknown>[];
    getWheelchairText: (code: string) => string;
    getRouteTypeText: (typeCode: string) => string;
  } | null;
  private resizeTimeout: NodeJS.Timeout | null;
  private shapeToRouteMapping: Map<string, string[]> = new Map();
  private onRouteSelectCallback: ((routeId: string) => void) | null = null;
  private onStopSelectCallback: ((stopId: string) => void) | null = null;
  private pageStateManager: PageStateManager | null = null;

  constructor(mapElementId = 'map') {
    this.map = null;
    this.mapElementId = mapElementId;
    this.gtfsParser = null;
    this.resizeTimeout = null;
  }

  initialize(gtfsParser: {
    getFileDataSync: (filename: string) => Record<string, unknown>[];
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
      'routes-highlight',
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
      'routes-highlight',
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
    const stops = this.gtfsParser.getFileDataSync('stops.txt');
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

    // Add single map click handler that queries all features and prioritizes stops
    this.map.on('click', (e) => {
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
          const stopId = stopFeature.properties.stop_id;
          console.log('clicked on stop', stopId);
          this.navigateToStop(stopId);
        } else if (routeFeature) {
          // Handle route click
          const routeId = routeFeature.properties.route_id;
          console.log('clicked on route', routeId);
          this.navigateToRoute(routeId);
        }
      }
    });
  }

  // Deterministic color generation for routes
  private getRouteColor(routeId: string, gtfsRouteColor?: string): string {
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
    for (let i = 0; i < routeId.length; i++) {
      const char = routeId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }

  // Diagnostic method to analyze shape usage patterns
  private analyzeShapeUsage(
    routes: Record<string, unknown>[],
    trips: Record<string, unknown>[],
    shapes: Record<string, unknown>[] | null
  ): void {
    console.group('🔍 Shape Usage Analysis');

    const totalShapes = shapes
      ? new Set(shapes.map((s) => s.shape_id)).size
      : 0;
    console.log(`📊 Total unique shapes in shapes.txt: ${totalShapes}`);

    const routeShapeStats = new Map();

    routes.forEach((route) => {
      const routeId = route.route_id as string;
      const routeTrips = trips.filter((trip) => trip.route_id === routeId);
      const tripsWithShapes = routeTrips.filter((trip) => trip.shape_id);
      const uniqueShapes = new Set(
        tripsWithShapes.map((trip) => trip.shape_id)
      );

      routeShapeStats.set(routeId, {
        totalTrips: routeTrips.length,
        tripsWithShapes: tripsWithShapes.length,
        uniqueShapes: uniqueShapes.size,
        shapeIds: Array.from(uniqueShapes),
        routeName: route.route_short_name || route.route_long_name || routeId,
      });

      if (uniqueShapes.size > 1) {
        console.warn(
          `⚠️  Route ${routeId} (${route.route_short_name || route.route_long_name}) has ${uniqueShapes.size} different shapes:`,
          Array.from(uniqueShapes)
        );
      }
    });

    const routesWithMultipleShapes = Array.from(
      routeShapeStats.values()
    ).filter((stats) => stats.uniqueShapes > 1);
    const totalUsedShapes = new Set();
    routeShapeStats.forEach((stats) => {
      stats.shapeIds.forEach((id) => totalUsedShapes.add(id));
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
          'Shape IDs': stats.shapeIds.join(', '),
        }))
      );
    }

    console.groupEnd();
  }

  // Build enhanced mapping from shape_id to route_id(s) with metadata
  private buildShapeToRouteMapping(): void {
    this.shapeToRouteMapping.clear();

    const trips = this.gtfsParser.getFileDataSync('trips.txt');
    if (!trips) {
      return;
    }

    // Enhanced mapping that tracks usage statistics
    const shapeUsage = new Map();

    trips.forEach((trip) => {
      if (trip.shape_id && trip.route_id) {
        const shapeId = trip.shape_id as string;
        const routeId = trip.route_id as string;

        // Initialize shape tracking
        if (!shapeUsage.has(shapeId)) {
          shapeUsage.set(shapeId, {
            routes: new Set(),
            tripCount: 0,
            routeIds: [],
          });
        }

        const usage = shapeUsage.get(shapeId);
        usage.routes.add(routeId);
        usage.tripCount++;

        // Maintain backward compatibility with existing mapping
        if (!this.shapeToRouteMapping.has(shapeId)) {
          this.shapeToRouteMapping.set(shapeId, []);
        }
        const routeIds = this.shapeToRouteMapping.get(shapeId)!;
        if (!routeIds.includes(routeId)) {
          routeIds.push(routeId);
        }
      }
    });

    // Convert enhanced mapping back to simple array format
    shapeUsage.forEach((usage, shapeId) => {
      this.shapeToRouteMapping.set(shapeId, Array.from(usage.routes));
    });

    console.log(
      `🔗 Shape-to-Route mapping updated: ${this.shapeToRouteMapping.size} shapes mapped to routes`
    );
  }

  // Enhanced route rendering with focus states and proper layering
  private addEnhancedRoutesToMap(): void {
    const routes = this.gtfsParser.getFileDataSync('routes.txt');
    const trips = this.gtfsParser.getFileDataSync('trips.txt');
    const shapes = this.gtfsParser.getFileDataSync('shapes.txt');

    if (!routes || !trips) {
      return;
    }

    // Diagnostic logging for shape analysis
    this.analyzeShapeUsage(routes, trips, shapes);

    // Create route features using all unique shapes per route
    const routeFeatures = [];

    routes.forEach((route) => {
      const routeId = route.route_id as string;
      const routeColor = this.getRouteColor(
        routeId,
        route.route_color as string
      );

      // Find trips for this route
      const routeTrips = trips.filter((trip) => trip.route_id === routeId);
      if (routeTrips.length === 0) {
        return;
      }

      // Collect ALL unique shapes for this route
      const tripsWithShapes = routeTrips.filter((trip) => trip.shape_id);
      const uniqueShapes = new Set(
        tripsWithShapes.map((trip) => trip.shape_id as string)
      );

      let hasValidGeometry = false;

      // Create features for each unique shape
      if (uniqueShapes.size > 0 && shapes) {
        Array.from(uniqueShapes).forEach((shapeId, index) => {
          const geometry = this.createRouteGeometryFromShape(shapeId, shapes);

          if (geometry) {
            hasValidGeometry = true;
            const routeTypeText = this.gtfsParser.getRouteTypeText(
              route.route_type as string
            );

            // For multiple shapes, add a suffix to the ID to make each unique
            const featureId =
              uniqueShapes.size > 1 ? `${routeId}_shape_${index}` : routeId;

            routeFeatures.push({
              type: 'Feature',
              id: featureId,
              geometry,
              properties: {
                route_id: routeId,
                shape_id: shapeId,
                shape_index: index,
                total_shapes: uniqueShapes.size,
                route_short_name: route.route_short_name || '',
                route_long_name: route.route_long_name || '',
                route_desc: route.route_desc || '',
                route_type: route.route_type || '',
                route_type_text: routeTypeText,
                agency_id: route.agency_id || 'Default',
                color: routeColor,
                has_shapes: true,
                is_multiple_shapes: uniqueShapes.size > 1,
              },
            });
          }
        });
      }

      // Fallback to stop connections only if no shapes worked
      if (!hasValidGeometry) {
        const geometry = this.createRouteGeometryFromStops(
          routeTrips[0].trip_id as string
        );

        if (geometry) {
          const routeTypeText = this.gtfsParser.getRouteTypeText(
            route.route_type as string
          );

          routeFeatures.push({
            type: 'Feature',
            id: routeId,
            geometry,
            properties: {
              route_id: routeId,
              shape_id: null,
              shape_index: 0,
              total_shapes: 0,
              route_short_name: route.route_short_name || '',
              route_long_name: route.route_long_name || '',
              route_desc: route.route_desc || '',
              route_type: route.route_type || '',
              route_type_text: routeTypeText,
              agency_id: route.agency_id || 'Default',
              color: routeColor,
              has_shapes: false,
              is_multiple_shapes: false,
            },
          });
        }
      }
    });

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
            ['get', 'is_multiple_shapes'],
            [
              'case',
              ['==', ['get', 'shape_index'], 0],
              3.5, // Primary shape slightly thicker
              2.5, // Secondary shapes slightly thinner
            ],
            3, // Single shape default
          ],
          'line-opacity': [
            'case',
            ['get', 'is_multiple_shapes'],
            [
              'case',
              ['==', ['get', 'shape_index'], 0],
              0.8, // Primary shape more visible
              0.6, // Secondary shapes more subtle
            ],
            0.7, // Single shape default
          ],
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
    shapeId: string,
    shapes: Record<string, unknown>[]
  ): GeoJSON.LineString | null {
    const shapePoints = shapes
      .filter((point) => point.shape_id === shapeId)
      .map((point) => ({
        lat: parseFloat(point.shape_pt_lat as string),
        lon: parseFloat(point.shape_pt_lon as string),
        sequence: parseInt(point.shape_pt_sequence as string) || 0,
      }))
      .filter((p) => !isNaN(p.lat) && !isNaN(p.lon))
      .sort((a, b) => a.sequence - b.sequence);

    if (shapePoints.length < 2) {
      console.warn(
        `⚠️  Shape ${shapeId} has insufficient points (${shapePoints.length}), skipping`
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
    tripId: string
  ): GeoJSON.LineString | null {
    const stopTimes = this.gtfsParser.getFileDataSync('stop_times.txt');
    const stops = this.gtfsParser.getFileDataSync('stops.txt');

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
      .filter((st) => st.trip_id === tripId)
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
  highlightAgencyRoutes(agencyId) {
    const routes = this.gtfsParser.getFileDataSync('routes.txt') || [];
    const agencyRoutes = routes.filter((route) => route.agency_id === agencyId);

    if (agencyRoutes.length === 0) {
      return;
    }

    // Clear existing highlights
    this.clearHighlights();

    // Highlight all routes for this agency
    agencyRoutes.forEach((route) => {
      this.highlightRoute(route.route_id, '#ff6b35', 6); // Orange, thicker
    });

    // Fit map to show highlighted routes
    this.fitToRoutes(agencyRoutes.map((r) => r.route_id));
  }

  highlightRoute(routeId, color = '#ff6b35', weight = 6) {
    const trips = this.gtfsParser.getFileDataSync('trips.txt') || [];
    const stopTimes = this.gtfsParser.getFileDataSync('stop_times.txt') || [];
    const stops = this.gtfsParser.getFileDataSync('stops.txt') || [];

    // Clear existing highlights
    this.clearHighlights();

    // Find trips for this route
    const routeTrips = trips.filter((trip) => trip.route_id === routeId);
    if (routeTrips.length === 0) {
      return;
    }

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

    // Use first trip to create route path
    const firstTrip = routeTrips[0];
    const tripStopTimes = stopTimes
      .filter((st) => st.trip_id === firstTrip.trip_id)
      .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));

    const routePath = [];
    tripStopTimes.forEach((st) => {
      const stopCoords = stopsLookup[st.stop_id];
      if (stopCoords) {
        routePath.push([stopCoords.lon, stopCoords.lat]); // [lng, lat] for MapLibre
      }
    });

    if (routePath.length >= 2) {
      // Create highlight GeoJSON
      const highlightGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: routePath,
            },
            properties: {
              route_id: routeId,
            },
          },
        ],
      };

      // Add highlight source and layer
      this.map.addSource('routes-highlight', {
        type: 'geojson',
        data: highlightGeoJSON,
      });

      this.map.addLayer({
        id: 'routes-highlight',
        type: 'line',
        source: 'routes-highlight',
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
    }
  }

  highlightTrip(tripId, color = '#e74c3c', weight = 5) {
    const stopTimes = this.gtfsParser.getFileDataSync('stop_times.txt') || [];
    const stops = this.gtfsParser.getFileDataSync('stops.txt') || [];

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
      .filter((st) => st.trip_id === tripId)
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
              trip_id: tripId,
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

  highlightStop(stopId, color = '#e74c3c', radius = 12) {
    const stops = this.gtfsParser.getFileDataSync('stops.txt') || [];

    // Clear existing highlights
    this.clearHighlights();

    const stop = stops.find((s) => s.stop_id === stopId);
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
    // Clear highlight layers
    const highlightLayers = [
      'routes-highlight',
      'trip-highlight',
      'stops-highlight',
    ];

    highlightLayers.forEach((layerId) => {
      if (this.map.getLayer(layerId)) {
        this.map.removeLayer(layerId);
      }
      if (this.map.getSource(layerId)) {
        this.map.removeSource(layerId);
      }
    });
  }

  fitToRoutes(routeIds) {
    const trips = this.gtfsParser.getFileDataSync('trips.txt') || [];
    const stopTimes = this.gtfsParser.getFileDataSync('stop_times.txt') || [];
    const stops = this.gtfsParser.getFileDataSync('stops.txt') || [];

    // Find all stops for these routes
    const allStops = new Set();

    routeIds.forEach((routeId) => {
      const routeTrips = trips.filter((trip) => trip.route_id === routeId);
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

  // Stub methods for backward compatibility (no-op implementations)
  focusRoute(routeId: string) {
    // No-op: Focus system removed, but keeping method for interface compatibility
    console.log('focusRoute called (no-op):', routeId);
  }

  focusStop(stopId: string) {
    // No-op: Focus system removed, but keeping method for interface compatibility
    console.log('focusStop called (no-op):', stopId);
  }

  clearFocus() {
    // No-op: Focus system removed, but keeping method for interface compatibility
    console.log('clearFocus called (no-op)');
  }

  // Callback setters for UI integration
  setRouteSelectCallback(callback: (routeId: string) => void) {
    this.onRouteSelectCallback = callback;
  }

  setStopSelectCallback(callback: (stopId: string) => void) {
    this.onStopSelectCallback = callback;
  }

  // State-based navigation methods (preferred approach)
  private async navigateToRoute(routeId: string) {
    if (this.pageStateManager) {
      await this.pageStateManager.setPageState({ type: 'route', routeId });
    }
    // Keep legacy callback for backward compatibility
    if (this.onRouteSelectCallback) {
      this.onRouteSelectCallback(routeId);
    }
  }

  private async navigateToStop(stopId: string) {
    if (this.pageStateManager) {
      await this.pageStateManager.setPageState({ type: 'stop', stopId });
    }
    // Keep legacy callback for backward compatibility
    if (this.onStopSelectCallback) {
      this.onStopSelectCallback(stopId);
    }
  }
}
