import { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';
import { GTFS } from '../types/gtfs.js';
import type { GTFSParser } from './gtfs-parser.js';

export interface StopLayerOptions {
  showBackground: boolean;
  showClickArea: boolean;
  enableHover: boolean;
  backgroundColor: string;
  strokeColor: string;
  strokeWidth: number;
  radius: number;
  clickAreaRadius: number;
}

export interface HighlightLayerOptions {
  color: string;
  radius: number;
  strokeColor: string;
  strokeWidth: number;
}

export class LayerManager {
  private map: MapLibreMap;
  private gtfsParser: GTFSParser;

  // Default options
  private defaultStopOptions: StopLayerOptions = {
    showBackground: true,
    showClickArea: true,
    enableHover: true,
    backgroundColor: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 2,
    radius: 4,
    clickAreaRadius: 15,
  };

  private defaultHighlightOptions: HighlightLayerOptions = {
    color: '#e74c3c',
    radius: 12,
    strokeColor: '#ffffff',
    strokeWidth: 3,
  };

  constructor(map: MapLibreMap, gtfsParser: GTFSParser) {
    this.map = map;
    this.gtfsParser = gtfsParser;
  }

  /**
   * Clear all managed layers and sources
   */
  public clearAllLayers(): void {
    const layersToRemove = [
      'stops-background',
      'stops-clickarea',
      'stops-highlight',
      'trip-highlight',
      // Legacy layers for backward compatibility
      'stops',
      'routes',
      'shapes',
    ];

    const sourcesToRemove = ['stops', 'stops-highlight', 'trip-highlight'];

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

  /**
   * Add stops to map with enhanced styling and functionality
   */
  public addStopsLayer(options: Partial<StopLayerOptions> = {}): void {
    const stops = this.gtfsParser.getFileDataSyncTyped<GTFS.Stop>('stops.txt');
    if (!stops) {
      console.warn('No stops data available for rendering');
      return;
    }

    const finalOptions = { ...this.defaultStopOptions, ...options };

    const validStops = stops.filter(
      (stop) =>
        stop.stop_lat &&
        stop.stop_lon &&
        !isNaN(parseFloat(stop.stop_lat)) &&
        !isNaN(parseFloat(stop.stop_lon))
    );

    if (validStops.length === 0) {
      console.warn('No valid stops with coordinates found');
      return;
    }

    // Create GeoJSON for stops
    const stopsGeoJSON = this.createStopsGeoJSON(validStops);

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

    // Add background stops layer if enabled
    if (finalOptions.showBackground) {
      this.addStopsBackgroundLayer(finalOptions);
    }

    // Add invisible click areas if enabled
    if (finalOptions.showClickArea) {
      this.addStopsClickAreaLayer(finalOptions);
    }

    // Add hover behavior if enabled
    if (finalOptions.enableHover) {
      this.addStopsHoverBehavior();
    }

    console.log(`🗺️ Added ${validStops.length} stops to map`);
  }

  /**
   * Create GeoJSON data for stops
   */
  private createStopsGeoJSON(stops: GTFS.Stop[]): GeoJSON.FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: stops.map((stop) => {
        const lat = parseFloat(stop.stop_lat);
        const lon = parseFloat(stop.stop_lon);
        const stopType = stop.location_type || '0';

        // Get routes serving this stop
        const routesAtStop =
          this.gtfsParser.getRoutesForStop?.(stop.stop_id) || [];

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
  }

  /**
   * Add background stops layer
   */
  private addStopsBackgroundLayer(options: StopLayerOptions): void {
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
          options.radius, // Default stop
        ],
        'circle-color': options.backgroundColor,
        'circle-stroke-color': options.strokeColor,
        'circle-stroke-width': options.strokeWidth,
        'circle-opacity': 1,
        'circle-stroke-opacity': 1,
      },
    });
  }

  /**
   * Add invisible click areas for stops
   */
  private addStopsClickAreaLayer(options: StopLayerOptions): void {
    this.map.addLayer({
      id: 'stops-clickarea',
      type: 'circle',
      source: 'stops',
      paint: {
        'circle-radius': options.clickAreaRadius,
        'circle-color': 'transparent',
        'circle-opacity': 0,
      },
    });
  }

  /**
   * Add hover behavior for stops
   */
  private addStopsHoverBehavior(): void {
    ['stops-background', 'stops-clickarea'].forEach((layerId) => {
      this.map.on('mouseenter', layerId, () => {
        this.map.getCanvas().style.cursor = 'pointer';
      });

      this.map.on('mouseleave', layerId, () => {
        this.map.getCanvas().style.cursor = '';
      });
    });
  }

  /**
   * Highlight specific stop
   */
  public highlightStop(
    stop_id: string,
    options: Partial<HighlightLayerOptions> = {}
  ): void {
    const finalOptions = { ...this.defaultHighlightOptions, ...options };
    const stops =
      this.gtfsParser.getFileDataSyncTyped<GTFS.Stop>('stops.txt') || [];

    // Clear existing highlights
    this.clearHighlights();

    const stop = stops.find((s) => s.stop_id === stop_id);
    if (!stop || !stop.stop_lat || !stop.stop_lon) {
      console.warn(`Stop ${stop_id} not found or missing coordinates`);
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
        'circle-radius': finalOptions.radius,
        'circle-color': finalOptions.color,
        'circle-stroke-color': finalOptions.strokeColor,
        'circle-stroke-width': finalOptions.strokeWidth,
        'circle-opacity': 1,
        'circle-stroke-opacity': 1,
      },
    });

    console.log(`🎯 Highlighted stop: ${stop_id}`);
  }

  /**
   * Highlight trip path
   */
  public highlightTrip(
    trip_id: string,
    options: Partial<HighlightLayerOptions> = {}
  ): void {
    const finalOptions = { ...this.defaultHighlightOptions, ...options };
    const stopTimes =
      this.gtfsParser.getFileDataSyncTyped<GTFS.StopTime>('stop_times.txt') ||
      [];
    const stops =
      this.gtfsParser.getFileDataSyncTyped<GTFS.Stop>('stops.txt') || [];

    // Clear existing highlights
    this.clearHighlights();

    // Create stops lookup
    const stopsLookup: { [key: string]: GTFS.Stop } = {};
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

    const tripPath: [number, number][] = [];
    const tripStopsFeatures: GeoJSON.Feature[] = [];

    tripStopTimes.forEach((st, index) => {
      const stopCoords = stopsLookup[st.stop_id];
      if (stopCoords) {
        tripPath.push([stopCoords.lon, stopCoords.lat]);

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
      this.addTripHighlightLayers(tripPath, tripStopsFeatures, finalOptions);
    }

    console.log(
      `🎯 Highlighted trip: ${trip_id} with ${tripPath.length} stops`
    );
  }

  /**
   * Add trip highlight layers (line and stops)
   */
  private addTripHighlightLayers(
    tripPath: [number, number][],
    tripStopsFeatures: GeoJSON.Feature[],
    options: HighlightLayerOptions
  ): void {
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
          properties: {},
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
        'line-color': options.color,
        'line-width': 5,
        'line-opacity': 0.9,
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
    });

    // Add trip stops if available
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
            '#27ae60', // Green for first stop
            ['==', ['get', 'stop_type'], 'last'],
            '#e74c3c', // Red for last stop
            options.color, // Default color for middle stops
          ],
          'circle-stroke-color': options.strokeColor,
          'circle-stroke-width': 2,
          'circle-opacity': 1,
          'circle-stroke-opacity': 1,
        },
      });
    }
  }

  /**
   * Clear all highlights
   */
  public clearHighlights(): void {
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

  /**
   * Update stop feature state (for dragging, selection, etc.)
   */
  public setStopFeatureState(
    stop_id: string,
    state: Record<string, unknown>
  ): void {
    try {
      this.map.setFeatureState({ source: 'stops', id: stop_id }, state);
    } catch (error) {
      console.debug('Could not set feature state for stop:', stop_id, error);
    }
  }

  /**
   * Get route color (helper method)
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
   * Update stops data source
   */
  public updateStopsData(): void {
    const stopsSource = this.map.getSource('stops') as GeoJSONSource;
    if (!stopsSource) {
      return;
    }

    const stops = this.gtfsParser.getFileDataSyncTyped<GTFS.Stop>('stops.txt');
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

    const stopsGeoJSON = this.createStopsGeoJSON(validStops);
    const stopsGeoJSONWithIds = {
      ...stopsGeoJSON,
      features: stopsGeoJSON.features.map((feature) => ({
        ...feature,
        id: feature.properties.stop_id,
      })),
    };

    stopsSource.setData(stopsGeoJSONWithIds);
    console.log(`🔄 Updated stops data: ${validStops.length} stops`);
  }

  /**
   * Check if a layer exists
   */
  public hasLayer(layerId: string): boolean {
    return !!this.map.getLayer(layerId);
  }

  /**
   * Check if a source exists
   */
  public hasSource(sourceId: string): boolean {
    return !!this.map.getSource(sourceId);
  }
}
