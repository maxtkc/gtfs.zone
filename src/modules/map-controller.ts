import { Map as MapLibreMap, LngLatBounds } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// import stringHash from 'string-hash';

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
  private focusedRouteId: string | null = null;
  private focusedStopId: string | null = null;
  private onRouteSelectCallback: ((routeId: string) => void) | null = null;
  private onStopSelectCallback: ((stopId: string) => void) | null = null;

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

  updateMap() {
    if (!this.gtfsParser || !this.gtfsParser.getFileDataSync('stops.txt') || !this.map) {
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
  }

  clearMapLayers() {
    // Remove existing layers and sources with new layering structure
    const layersToRemove = [
      'routes-background',
      'routes-focused',
      'routes-clickarea',
      'stops-background',
      'stops-focused',
      'stops-clickarea',
      'stops-highlight',
      'routes-highlight',
      'trip-highlight',
      // Legacy layers
      'stops',
      'routes',
      'shapes'
    ];
    const sourcesToRemove = [
      'routes',
      'stops',
      'stops-highlight',
      'routes-highlight',
      'trip-highlight'
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
          primaryRouteColor = this.getRouteColor(primaryRoute.route_id as string, primaryRoute.route_color as string);
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
      features: stopsGeoJSON.features.map(feature => ({
        ...feature,
        id: feature.properties.stop_id // Add ID for feature state
      }))
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
          ['boolean', ['feature-state', 'focused'], false],
          0, // Hide when focused
          // Normal sizes based on location type
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
        'circle-opacity': [
          'case',
          ['boolean', ['feature-state', 'focused'], false],
          0, // Hide when focused
          1  // Normal opacity
        ],
        'circle-stroke-opacity': [
          'case',
          ['boolean', ['feature-state', 'focused'], false],
          0, // Hide when focused
          1  // Normal opacity
        ],
      },
    });

    // Add focused stops layer (selected stops, larger size)
    this.map.addLayer({
      id: 'stops-focused',
      type: 'circle',
      source: 'stops',
      paint: {
        'circle-radius': [
          'case',
          ['boolean', ['feature-state', 'focused'], false],
          // Focused sizes (larger) - nested case for location type
          [
            'case',
            ['==', ['get', 'location_type'], '1'],
            14, // Station - larger
            ['==', ['get', 'location_type'], '2'],
            8, // Entrance/Exit - larger
            ['==', ['get', 'location_type'], '3'],
            8, // Generic node - larger
            ['==', ['get', 'location_type'], '4'],
            10, // Boarding area - larger
            10 // Default stop - larger
          ],
          0 // Hide when not focused
        ],
        'circle-color': '#ffffff', // White fill
        'circle-stroke-color': [
          'case',
          ['>', ['get', 'routes_count'], 0],
          ['get', 'primary_route_color'],
          // Fallback colors
          ['==', ['get', 'location_type'], '1'],
          '#dc2626',
          ['==', ['get', 'location_type'], '2'],
          '#16a34a',
          ['==', ['get', 'location_type'], '3'],
          '#ca8a04',
          ['==', ['get', 'location_type'], '4'],
          '#7c3aed',
          '#2563eb',
        ],
        'circle-stroke-width': [
          'case',
          ['boolean', ['feature-state', 'focused'], false],
          3.5, // Thicker stroke when focused
          0    // Hide when not focused
        ],
        'circle-opacity': [
          'case',
          ['boolean', ['feature-state', 'focused'], false],
          1, // Show when focused
          0  // Hide when not focused
        ],
        'circle-stroke-opacity': [
          'case',
          ['boolean', ['feature-state', 'focused'], false],
          1, // Show when focused
          0  // Hide when not focused
        ],
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
    ['stops-background', 'stops-focused', 'stops-clickarea'].forEach(layerId => {
      this.map.on('mouseenter', layerId, () => {
        this.map.getCanvas().style.cursor = 'pointer';
      });

      this.map.on('mouseleave', layerId, () => {
        this.map.getCanvas().style.cursor = '';
      });

      // Add click handler for stops
      this.map.on('click', layerId, (e) => {
        const properties = e.features[0].properties;
        const stopId = properties.stop_id;


        // Focus this stop
        this.focusStop(stopId);

        // Call callback if available
        if (this.onStopSelectCallback) {
          this.onStopSelectCallback(stopId);
        }
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

  // Deterministic color generation for routes
  private getRouteColor(routeId: string, gtfsRouteColor?: string): string {
    // Use GTFS route_color if available and valid
    if (gtfsRouteColor && gtfsRouteColor.length === 6 && /^[0-9A-Fa-f]+$/.test(gtfsRouteColor)) {
      return `#${gtfsRouteColor}`;
    }

    // Generate deterministic color from route ID (simple hash alternative)
    // const hash = stringHash(routeId);
    let hash = 0;
    for (let i = 0; i < routeId.length; i++) {
      const char = routeId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }

  // Build mapping from shape_id to route_id(s)
  private buildShapeToRouteMapping(): void {
    this.shapeToRouteMapping.clear();

    const trips = this.gtfsParser.getFileDataSync('trips.txt');
    if (!trips) return;

    trips.forEach(trip => {
      if (trip.shape_id && trip.route_id) {
        const shapeId = trip.shape_id as string;
        const routeId = trip.route_id as string;

        if (!this.shapeToRouteMapping.has(shapeId)) {
          this.shapeToRouteMapping.set(shapeId, []);
        }
        const routeIds = this.shapeToRouteMapping.get(shapeId)!;
        if (!routeIds.includes(routeId)) {
          routeIds.push(routeId);
        }
      }
    });
  }

  // Enhanced route rendering with focus states and proper layering
  private addEnhancedRoutesToMap(): void {
    const routes = this.gtfsParser.getFileDataSync('routes.txt');
    const trips = this.gtfsParser.getFileDataSync('trips.txt');
    const shapes = this.gtfsParser.getFileDataSync('shapes.txt');

    if (!routes || !trips) return;

    // Create route features using shapes when available, fallback to stop connections
    const routeFeatures = [];

    routes.forEach(route => {
      const routeId = route.route_id as string;
      const routeColor = this.getRouteColor(routeId, route.route_color as string);

      // Find trips for this route
      const routeTrips = trips.filter(trip => trip.route_id === routeId);
      if (routeTrips.length === 0) return;

      // Try to use shapes first
      let geometry = null;
      const tripWithShape = routeTrips.find(trip => trip.shape_id);

      if (tripWithShape && shapes) {
        geometry = this.createRouteGeometryFromShape(tripWithShape.shape_id as string, shapes);
      }

      // Fallback to stop connections if no shape available
      if (!geometry) {
        geometry = this.createRouteGeometryFromStops(routeTrips[0].trip_id as string);
      }

      if (geometry) {
        const routeTypeText = this.gtfsParser.getRouteTypeText(route.route_type as string);

        routeFeatures.push({
          type: 'Feature',
          id: routeId, // Add ID for feature state
          geometry,
          properties: {
            route_id: routeId,
            route_short_name: route.route_short_name || '',
            route_long_name: route.route_long_name || '',
            route_desc: route.route_desc || '',
            route_type: route.route_type || '',
            route_type_text: routeTypeText,
            agency_id: route.agency_id || 'Default',
            color: routeColor,
            has_shapes: !!tripWithShape?.shape_id
          }
        });
      }
    });

    if (routeFeatures.length > 0) {
      const routesGeoJSON = {
        type: 'FeatureCollection',
        features: routeFeatures
      };

      // Add source
      this.map.addSource('routes', {
        type: 'geojson',
        data: routesGeoJSON,
      });

      // Add background route layer (all routes, thin, muted)
      this.map.addLayer({
        id: 'routes-background',
        type: 'line',
        source: 'routes',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'focused'], false],
            0, // Hide when focused (focused layer will show instead)
            3  // Normal width
          ],
          'line-opacity': [
            'case',
            ['boolean', ['feature-state', 'focused'], false],
            0, // Hide when focused
            0.7 // Normal opacity
          ],
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      });

      // Add focused route layer (selected routes, thick, opaque)
      this.map.addLayer({
        id: 'routes-focused',
        type: 'line',
        source: 'routes',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'focused'], false],
            6, // Focused width
            0  // Hide when not focused
          ],
          'line-opacity': [
            'case',
            ['boolean', ['feature-state', 'focused'], false],
            1, // Focused opacity
            0  // Hide when not focused
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
      ['routes-background', 'routes-focused', 'routes-clickarea'].forEach(layerId => {
        this.map.on('mouseenter', layerId, () => {
          this.map.getCanvas().style.cursor = 'pointer';
        });

        this.map.on('mouseleave', layerId, () => {
          this.map.getCanvas().style.cursor = '';
        });

        // Add click handler for routes
        this.map.on('click', layerId, (e) => {
          const properties = e.features[0].properties;
          const routeId = properties.route_id;


          // Focus this route
          this.focusRoute(routeId);

          // Call callback if available
          if (this.onRouteSelectCallback) {
            this.onRouteSelectCallback(routeId);
          }
        });
      });
    }
  }

  // Create route geometry from shapes.txt
  private createRouteGeometryFromShape(shapeId: string, shapes: Record<string, unknown>[]): any {
    const shapePoints = shapes
      .filter(point => point.shape_id === shapeId)
      .map(point => ({
        lat: parseFloat(point.shape_pt_lat as string),
        lon: parseFloat(point.shape_pt_lon as string),
        sequence: parseInt(point.shape_pt_sequence as string) || 0,
      }))
      .filter(p => !isNaN(p.lat) && !isNaN(p.lon))
      .sort((a, b) => a.sequence - b.sequence);

    if (shapePoints.length < 2) return null;

    return {
      type: 'LineString',
      coordinates: shapePoints.map(p => [p.lon, p.lat])
    };
  }

  // Create route geometry from stop connections (fallback)
  private createRouteGeometryFromStops(tripId: string): any {
    const stopTimes = this.gtfsParser.getFileDataSync('stop_times.txt');
    const stops = this.gtfsParser.getFileDataSync('stops.txt');

    if (!stopTimes || !stops) return null;

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

    if (routePath.length < 2) return null;

    return {
      type: 'LineString',
      coordinates: routePath
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
        this.map.on('click', 'stops-highlight', (e) => {
          const properties = e.features[0].properties;
          const coordinates = e.lngLat;

          const stopTypeText = properties.is_first
            ? 'First Stop'
            : properties.is_last
              ? 'Last Stop'
              : 'Trip Stop';
          const stopTypeColor = properties.is_first
            ? '#27ae60'
            : properties.is_last
              ? '#e74c3c'
              : color;

          const stopData = {
            stop_name: properties.stop_name,
            stop_type_text: stopTypeText,
            stop_type_color: stopTypeColor,
            is_first: properties.is_first,
            is_last: properties.is_last
          };

        });
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

  // New focus state methods for Phase 2
  focusRoute(routeId: string) {
    // Clear previous route focus
    if (this.focusedRouteId) {
      this.map.setFeatureState(
        { source: 'routes', id: this.focusedRouteId },
        { focused: false }
      );
    }

    // Set new route focus
    this.focusedRouteId = routeId;
    this.map.setFeatureState(
      { source: 'routes', id: routeId },
      { focused: true }
    );

    // Focus stops that serve this route
    this.focusStopsForRoute(routeId);

    // Zoom to route
    this.zoomToRoute(routeId);
  }

  focusStop(stopId: string) {
    // Clear previous stop focus
    if (this.focusedStopId) {
      this.map.setFeatureState(
        { source: 'stops', id: this.focusedStopId },
        { focused: false }
      );
    }

    // Set new stop focus
    this.focusedStopId = stopId;
    this.map.setFeatureState(
      { source: 'stops', id: stopId },
      { focused: true }
    );

    // Zoom to stop
    this.zoomToStop(stopId);
  }

  clearFocus() {
    // Clear route focus
    if (this.focusedRouteId) {
      this.map.setFeatureState(
        { source: 'routes', id: this.focusedRouteId },
        { focused: false }
      );
      this.focusedRouteId = null;
    }

    // Clear stop focus
    if (this.focusedStopId) {
      this.map.setFeatureState(
        { source: 'stops', id: this.focusedStopId },
        { focused: false }
      );
      this.focusedStopId = null;
    }

    // Clear any focused stops for routes
    this.clearFocusedStopsForRoute();
  }

  private focusStopsForRoute(routeId: string) {
    // First clear any existing focused stops
    this.clearFocusedStopsForRoute();

    // Get stops for this route
    const trips = this.gtfsParser.getFileDataSync('trips.txt');
    const stopTimes = this.gtfsParser.getFileDataSync('stop_times.txt');

    if (!trips || !stopTimes) return;

    const routeTrips = trips.filter(trip => trip.route_id === routeId);
    const routeStopIds = new Set();

    routeTrips.forEach(trip => {
      const tripStopTimes = stopTimes.filter(st => st.trip_id === trip.trip_id);
      tripStopTimes.forEach(st => routeStopIds.add(st.stop_id));
    });

    // Focus all stops for this route
    routeStopIds.forEach(stopId => {
      this.map.setFeatureState(
        { source: 'stops', id: stopId },
        { focused: true }
      );
    });
  }

  private clearFocusedStopsForRoute() {
    // Get all stops and clear their focus state
    const stops = this.gtfsParser.getFileDataSync('stops.txt');
    if (!stops) return;

    stops.forEach(stop => {
      this.map.setFeatureState(
        { source: 'stops', id: stop.stop_id },
        { focused: false }
      );
    });
  }

  private zoomToRoute(routeId: string) {
    const routes = this.gtfsParser.getFileDataSync('routes.txt');
    if (!routes) return;

    const route = routes.find(r => r.route_id === routeId);
    if (!route) return;

    // Use existing fitToRoutes method
    this.fitToRoutes([routeId]);
  }

  private zoomToStop(stopId: string) {
    const stops = this.gtfsParser.getFileDataSync('stops.txt');
    if (!stops) return;

    const stop = stops.find(s => s.stop_id === stopId);
    if (!stop || !stop.stop_lat || !stop.stop_lon) return;

    const lat = parseFloat(stop.stop_lat);
    const lon = parseFloat(stop.stop_lon);

    this.map.setCenter([lon, lat]);
    if (this.map.getZoom() < 15) {
      this.map.setZoom(15);
    }
  }

  // Callback setters for UI integration
  setRouteSelectCallback(callback: (routeId: string) => void) {
    this.onRouteSelectCallback = callback;
  }

  setStopSelectCallback(callback: (stopId: string) => void) {
    this.onStopSelectCallback = callback;
  }

}
