import { Map, Marker, Popup, LngLatBounds } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export class MapController {
  constructor(mapElementId = 'map') {
    this.map = null;
    this.mapElementId = mapElementId;
    this.gtfsParser = null;
    this.resizeTimeout = null;
  }

  initialize(gtfsParser) {
    this.gtfsParser = gtfsParser;
    
    // Initialize MapLibre GL JS map
    this.map = new Map({
      container: this.mapElementId,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [{
          id: 'osm',
          type: 'raster',
          source: 'osm'
        }]
      },
      center: [-74.006, 40.7128], // [lng, lat] format for MapLibre
      zoom: 10
    });

    // Keep welcome overlay visible initially
    const welcomeOverlay = document.getElementById('map-overlay');
    if (welcomeOverlay) {
      welcomeOverlay.classList.remove('hidden');
    }
  }

  updateMap() {
    if (!this.gtfsParser || !this.gtfsParser.getFileData('stops.txt')) {
      return;
    }

    // Wait for map to be loaded before adding sources/layers
    if (!this.map.loaded()) {
      this.map.on('load', () => this.updateMap());
      return;
    }

    // Clear existing sources and layers
    this.clearMapLayers();

    // Add enhanced stops to map
    this.addStopsToMap();

    // Add routes visualization (without shapes)
    this.addRoutesToMap();

    // Add shapes if available (this will overlay on routes)
    if (this.gtfsParser.getFileData('shapes.txt')) {
      this.addShapesToMap();
    }
  }

  clearMapLayers() {
    // Remove existing layers and sources
    const layersToRemove = ['stops', 'routes', 'shapes', 'stops-highlight', 'routes-highlight', 'trip-highlight'];
    const sourcesToRemove = ['stops', 'routes', 'shapes', 'stops-highlight', 'routes-highlight', 'trip-highlight'];

    layersToRemove.forEach(layerId => {
      if (this.map.getLayer(layerId)) {
        this.map.removeLayer(layerId);
      }
    });

    sourcesToRemove.forEach(sourceId => {
      if (this.map.getSource(sourceId)) {
        this.map.removeSource(sourceId);
      }
    });
  }

  addStopsToMap() {
    const stops = this.gtfsParser.getFileData('stops.txt');
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

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lon, lat] // [lng, lat] for MapLibre
          },
          properties: {
            stop_id: stop.stop_id,
            stop_name: stop.stop_name || 'Unnamed Stop',
            stop_code: stop.stop_code || '',
            stop_desc: stop.stop_desc || '',
            location_type: stopType,
            wheelchair_boarding: stop.wheelchair_boarding || '',
            routes_count: routesAtStop.length,
            routes_list: routesAtStop.map((r) => r.route_short_name || r.route_id).join(', ')
          }
        };
      })
    };

    // Add source
    this.map.addSource('stops', {
      type: 'geojson',
      data: stopsGeoJSON
    });

    // Add layer
    this.map.addLayer({
      id: 'stops',
      type: 'circle',
      source: 'stops',
      paint: {
        'circle-radius': [
          'case',
          ['==', ['get', 'location_type'], '1'], 12, // Station
          ['==', ['get', 'location_type'], '2'], 6,  // Entrance/Exit
          ['==', ['get', 'location_type'], '3'], 6,  // Generic node
          ['==', ['get', 'location_type'], '4'], 8,  // Boarding area
          8 // Default stop
        ],
        'circle-color': [
          'case',
          ['==', ['get', 'location_type'], '1'], '#dc2626', // Station - red
          ['==', ['get', 'location_type'], '2'], '#16a34a', // Entrance - green
          ['==', ['get', 'location_type'], '3'], '#ca8a04', // Node - yellow
          ['==', ['get', 'location_type'], '4'], '#7c3aed', // Boarding - purple
          '#2563eb' // Default - blue
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-opacity': 1,
        'circle-stroke-opacity': 1
      }
    });

    // Add hover cursor
    this.map.on('mouseenter', 'stops', () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });

    this.map.on('mouseleave', 'stops', () => {
      this.map.getCanvas().style.cursor = '';
    });

    // Add click handler for stops
    this.map.on('click', 'stops', (e) => {
      const properties = e.features[0].properties;
      const coordinates = e.lngLat;

      // Determine stop type text and color
      const stopTypeMap = {
        '0': { text: 'Stop', color: '#2563eb' },
        '1': { text: 'Station', color: '#dc2626' },
        '2': { text: 'Entrance/Exit', color: '#16a34a' },
        '3': { text: 'Node', color: '#ca8a04' },
        '4': { text: 'Boarding Area', color: '#7c3aed' }
      };
      
      const stopTypeInfo = stopTypeMap[properties.location_type] || stopTypeMap['0'];
      
      const routesList = properties.routes_count > 0 
        ? `<br><strong>Routes:</strong> ${properties.routes_list}`
        : '';

      const wheelchairInfo = properties.wheelchair_boarding
        ? `<br><strong>Wheelchair:</strong> ${this.gtfsParser.getWheelchairText(properties.wheelchair_boarding)}`
        : '';

      const popupContent = `
        <div style="min-width: 200px;">
          <strong>${properties.stop_name}</strong><br>
          <span style="color: ${stopTypeInfo.color}; font-weight: bold;">${stopTypeInfo.text}</span><br>
          <strong>ID:</strong> ${properties.stop_id}<br>
          ${properties.stop_code ? `<strong>Code:</strong> ${properties.stop_code}<br>` : ''}
          ${properties.stop_desc ? `<strong>Description:</strong> ${properties.stop_desc}<br>` : ''}
          <strong>Location:</strong> ${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}${routesList}${wheelchairInfo}
        </div>
      `;

      new Popup()
        .setLngLat(coordinates)
        .setHTML(popupContent)
        .addTo(this.map);
    });

    // Fit map to show all stops
    if (validStops.length > 0) {
      const coordinates = validStops.map(stop => [parseFloat(stop.stop_lon), parseFloat(stop.stop_lat)]);
      const bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord);
      }, new LngLatBounds(coordinates[0], coordinates[0]));
      
      this.map.fitBounds(bounds, { padding: 50 });
    }
  }

  addRoutesToMap() {
    const routes = this.gtfsParser.getFileData('routes.txt');
    const trips = this.gtfsParser.getFileData('trips.txt');
    const stopTimes = this.gtfsParser.getFileData('stop_times.txt');
    const stops = this.gtfsParser.getFileData('stops.txt');

    if (!routes || !trips || !stopTimes || !stops) {
      return;
    }

    // Create a stops lookup for coordinates
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

    // Group trips by route
    const tripsByRoute = {};
    trips.forEach((trip) => {
      if (!tripsByRoute[trip.route_id]) {
        tripsByRoute[trip.route_id] = [];
      }
      tripsByRoute[trip.route_id].push(trip);
    });

    // Route colors
    const routeColors = [
      '#ef4444',
      '#3b82f6',
      '#10b981',
      '#f59e0b',
      '#8b5cf6',
      '#ec4899',
      '#06b6d4',
      '#84cc16',
    ];

    // Create GeoJSON for routes
    const routesGeoJSON = {
      type: 'FeatureCollection',
      features: []
    };

    routes.forEach((route, index) => {
      const routeTrips = tripsByRoute[route.route_id] || [];
      if (routeTrips.length === 0) {
        return;
      }

      // Get stops for this route from one of its trips
      const firstTrip = routeTrips[0];
      const tripStopTimes = stopTimes
        .filter((st) => st.trip_id === firstTrip.trip_id)
        .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));

      if (tripStopTimes.length < 2) {
        return;
      }

      // Create route path from stops
      const routePath = [];
      tripStopTimes.forEach((st) => {
        const stopCoords = stopsLookup[st.stop_id];
        if (stopCoords) {
          routePath.push([stopCoords.lon, stopCoords.lat]); // [lng, lat] for MapLibre
        }
      });

      if (routePath.length >= 2) {
        const routeColor = routeColors[index % routeColors.length];
        const routeTypeText = this.gtfsParser.getRouteTypeText(route.route_type);

        routesGeoJSON.features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: routePath
          },
          properties: {
            route_id: route.route_id,
            route_short_name: route.route_short_name || '',
            route_long_name: route.route_long_name || '',
            route_desc: route.route_desc || '',
            route_type: route.route_type || '',
            route_type_text: routeTypeText,
            agency_id: route.agency_id || 'Default',
            color: routeColor,
            stops_count: tripStopTimes.length,
            is_bus: route.route_type === '3'
          }
        });
      }
    });

    if (routesGeoJSON.features.length > 0) {
      // Add source
      this.map.addSource('routes', {
        type: 'geojson',
        data: routesGeoJSON
      });

      // Add layer
      this.map.addLayer({
        id: 'routes',
        type: 'line',
        source: 'routes',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 4,
          'line-opacity': 0.7
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        }
      });

      // Add hover cursor for routes
      this.map.on('mouseenter', 'routes', () => {
        this.map.getCanvas().style.cursor = 'pointer';
      });

      this.map.on('mouseleave', 'routes', () => {
        this.map.getCanvas().style.cursor = '';
      });

      // Add click handler for routes
      this.map.on('click', 'routes', (e) => {
        const properties = e.features[0].properties;
        const coordinates = e.lngLat;

        const popupContent = `
          <div style="min-width: 200px;">
            <strong>${properties.route_short_name || properties.route_long_name || properties.route_id}</strong><br>
            <span style="color: ${properties.color}; font-weight: bold;">${properties.route_type_text}</span><br>
            ${properties.route_long_name && properties.route_short_name ? `<strong>Long name:</strong> ${properties.route_long_name}<br>` : ''}
            ${properties.route_desc ? `<strong>Description:</strong> ${properties.route_desc}<br>` : ''}
            <strong>Stops:</strong> ${properties.stops_count}<br>
            <strong>Agency:</strong> ${properties.agency_id}
          </div>
        `;

        new Popup()
          .setLngLat(coordinates)
          .setHTML(popupContent)
          .addTo(this.map);
      });
    }
  }

  addShapesToMap() {
    const shapes = this.gtfsParser.getFileData('shapes.txt');
    if (!shapes) {
      return;
    }

    const shapeGroups = {};

    // Group points by shape_id
    shapes.forEach((point) => {
      if (!shapeGroups[point.shape_id]) {
        shapeGroups[point.shape_id] = [];
      }
      shapeGroups[point.shape_id].push({
        lat: parseFloat(point.shape_pt_lat),
        lon: parseFloat(point.shape_pt_lon),
        sequence: parseInt(point.shape_pt_sequence) || 0,
      });
    });

    // Create GeoJSON for shapes
    const shapesGeoJSON = {
      type: 'FeatureCollection',
      features: []
    };

    // Draw polylines for each shape
    Object.keys(shapeGroups).forEach((shapeId) => {
      const points = shapeGroups[shapeId]
        .filter((p) => !isNaN(p.lat) && !isNaN(p.lon))
        .sort((a, b) => a.sequence - b.sequence)
        .map((p) => [p.lon, p.lat]); // [lng, lat] for MapLibre

      if (points.length > 1) {
        shapesGeoJSON.features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: points
          },
          properties: {
            shape_id: shapeId,
            points_count: points.length
          }
        });
      }
    });

    if (shapesGeoJSON.features.length > 0) {
      // Add source
      this.map.addSource('shapes', {
        type: 'geojson',
        data: shapesGeoJSON
      });

      // Add layer
      this.map.addLayer({
        id: 'shapes',
        type: 'line',
        source: 'shapes',
        paint: {
          'line-color': '#3388ff',
          'line-width': 3,
          'line-opacity': 0.7
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        }
      });

      // Add hover cursor for shapes
      this.map.on('mouseenter', 'shapes', () => {
        this.map.getCanvas().style.cursor = 'pointer';
      });

      this.map.on('mouseleave', 'shapes', () => {
        this.map.getCanvas().style.cursor = '';
      });

      // Add click handler for shapes
      this.map.on('click', 'shapes', (e) => {
        const properties = e.features[0].properties;
        const coordinates = e.lngLat;

        const popupContent = `
          <div style="min-width: 200px;">
            <strong>Shape ID:</strong> ${properties.shape_id}<br>
            <strong>Points:</strong> ${properties.points_count}
          </div>
        `;

        new Popup()
          .setLngLat(coordinates)
          .setHTML(popupContent)
          .addTo(this.map);
      });
    }
  }

  highlightFileData(fileName) {
    // Add visual emphasis for the selected file's data on map
    // This could be enhanced to highlight specific elements
    console.log(`Highlighting data for ${fileName}`);
  }

  // Object highlighting methods for Objects navigation
  highlightAgencyRoutes(agencyId) {
    const routes = this.gtfsParser.getFileData('routes.txt') || [];
    const agencyRoutes = routes.filter(route => route.agency_id === agencyId);
    
    if (agencyRoutes.length === 0) return;
    
    // Clear existing highlights
    this.clearHighlights();
    
    // Highlight all routes for this agency
    agencyRoutes.forEach(route => {
      this.highlightRoute(route.route_id, '#ff6b35', 6); // Orange, thicker
    });
    
    // Fit map to show highlighted routes
    this.fitToRoutes(agencyRoutes.map(r => r.route_id));
  }

  highlightRoute(routeId, color = '#ff6b35', weight = 6) {
    const trips = this.gtfsParser.getFileData('trips.txt') || [];
    const stopTimes = this.gtfsParser.getFileData('stop_times.txt') || [];
    const stops = this.gtfsParser.getFileData('stops.txt') || [];
    
    // Clear existing highlights
    this.clearHighlights();
    
    // Find trips for this route
    const routeTrips = trips.filter(trip => trip.route_id === routeId);
    if (routeTrips.length === 0) return;
    
    // Create stops lookup
    const stopsLookup = {};
    stops.forEach(stop => {
      if (stop.stop_lat && stop.stop_lon) {
        stopsLookup[stop.stop_id] = {
          lat: parseFloat(stop.stop_lat),
          lon: parseFloat(stop.stop_lon),
          name: stop.stop_name
        };
      }
    });
    
    // Use first trip to create route path
    const firstTrip = routeTrips[0];
    const tripStopTimes = stopTimes
      .filter(st => st.trip_id === firstTrip.trip_id)
      .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
    
    const routePath = [];
    tripStopTimes.forEach(st => {
      const stopCoords = stopsLookup[st.stop_id];
      if (stopCoords) {
        routePath.push([stopCoords.lon, stopCoords.lat]); // [lng, lat] for MapLibre
      }
    });
    
    if (routePath.length >= 2) {
      // Create highlight GeoJSON
      const highlightGeoJSON = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: routePath
          },
          properties: {
            route_id: routeId
          }
        }]
      };

      // Add highlight source and layer
      this.map.addSource('routes-highlight', {
        type: 'geojson',
        data: highlightGeoJSON
      });

      this.map.addLayer({
        id: 'routes-highlight',
        type: 'line',
        source: 'routes-highlight',
        paint: {
          'line-color': color,
          'line-width': weight,
          'line-opacity': 0.9
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        }
      });
    }
  }

  highlightTrip(tripId, color = '#e74c3c', weight = 5) {
    const stopTimes = this.gtfsParser.getFileData('stop_times.txt') || [];
    const stops = this.gtfsParser.getFileData('stops.txt') || [];
    
    // Clear existing highlights
    this.clearHighlights();
    
    // Create stops lookup
    const stopsLookup = {};
    stops.forEach(stop => {
      if (stop.stop_lat && stop.stop_lon) {
        stopsLookup[stop.stop_id] = {
          lat: parseFloat(stop.stop_lat),
          lon: parseFloat(stop.stop_lon),
          name: stop.stop_name
        };
      }
    });
    
    // Get stop times for this trip
    const tripStopTimes = stopTimes
      .filter(st => st.trip_id === tripId)
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
            coordinates: [stopCoords.lon, stopCoords.lat]
          },
          properties: {
            stop_name: stopCoords.name,
            is_first: isFirst,
            is_last: isLast,
            stop_type: isFirst ? 'first' : isLast ? 'last' : 'middle'
          }
        });
      }
    });
    
    if (tripPath.length >= 2) {
      // Create trip line GeoJSON
      const tripLineGeoJSON = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: tripPath
          },
          properties: {
            trip_id: tripId
          }
        }]
      };

      // Add trip line
      this.map.addSource('trip-highlight', {
        type: 'geojson',
        data: tripLineGeoJSON
      });

      this.map.addLayer({
        id: 'trip-highlight',
        type: 'line',
        source: 'trip-highlight',
        paint: {
          'line-color': color,
          'line-width': weight,
          'line-opacity': 0.9
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        }
      });

      // Add trip stops
      if (tripStopsFeatures.length > 0) {
        const stopsGeoJSON = {
          type: 'FeatureCollection',
          features: tripStopsFeatures
        };

        this.map.addSource('stops-highlight', {
          type: 'geojson',
          data: stopsGeoJSON
        });

        this.map.addLayer({
          id: 'stops-highlight',
          type: 'circle',
          source: 'stops-highlight',
          paint: {
            'circle-radius': 8,
            'circle-color': [
              'case',
              ['==', ['get', 'stop_type'], 'first'], '#27ae60',
              ['==', ['get', 'stop_type'], 'last'], '#e74c3c',
              color
            ],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
            'circle-opacity': 1,
            'circle-stroke-opacity': 1
          }
        });

        // Add click handler for trip stops
        this.map.on('click', 'stops-highlight', (e) => {
          const properties = e.features[0].properties;
          const coordinates = e.lngLat;
          
          const stopTypeText = properties.is_first ? 'First Stop' : 
                              properties.is_last ? 'Last Stop' : 'Trip Stop';
          const stopTypeColor = properties.is_first ? '#27ae60' : 
                               properties.is_last ? '#e74c3c' : color;

          const popupContent = `
            <strong>${properties.stop_name}</strong><br>
            <span style="color: ${stopTypeColor};">${stopTypeText}</span>
          `;

          new Popup()
            .setLngLat(coordinates)
            .setHTML(popupContent)
            .addTo(this.map);
        });
      }
      
      // Fit map to trip
      if (tripPath.length > 0) {
        const coordinates = tripPath;
        const bounds = coordinates.reduce((bounds, coord) => {
          return bounds.extend(coord);
        }, new LngLatBounds(coordinates[0], coordinates[0]));
        
        this.map.fitBounds(bounds, { padding: 50 });
      }
    }
  }

  highlightStop(stopId, color = '#e74c3c', radius = 12) {
    const stops = this.gtfsParser.getFileData('stops.txt') || [];
    
    // Clear existing highlights
    this.clearHighlights();
    
    const stop = stops.find(s => s.stop_id === stopId);
    if (!stop || !stop.stop_lat || !stop.stop_lon) return;
    
    const lat = parseFloat(stop.stop_lat);
    const lon = parseFloat(stop.stop_lon);
    
    // Create highlight GeoJSON
    const highlightGeoJSON = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lon, lat]
        },
        properties: {
          stop_id: stop.stop_id,
          stop_name: stop.stop_name || 'Unnamed Stop',
          stop_code: stop.stop_code || ''
        }
      }]
    };

    // Add highlight source and layer
    this.map.addSource('stops-highlight', {
      type: 'geojson',
      data: highlightGeoJSON
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
        'circle-stroke-opacity': 1
      }
    });

    // Show popup immediately
    const popupContent = `
      <div style="min-width: 200px;">
        <strong>${stop.stop_name || 'Unnamed Stop'}</strong><br>
        <strong>ID:</strong> ${stop.stop_id}<br>
        ${stop.stop_code ? `<strong>Code:</strong> ${stop.stop_code}<br>` : ''}
        <strong>Location:</strong> ${lat.toFixed(6)}, ${lon.toFixed(6)}
      </div>
    `;

    new Popup()
      .setLngLat([lon, lat])
      .setHTML(popupContent)
      .addTo(this.map);
    
    // Center map on stop
    this.map.setCenter([lon, lat]);
    if (this.map.getZoom() < 15) {
      this.map.setZoom(15);
    }
  }

  clearHighlights() {
    // Clear highlight layers
    const highlightLayers = ['routes-highlight', 'trip-highlight', 'stops-highlight'];
    
    highlightLayers.forEach(layerId => {
      if (this.map.getLayer(layerId)) {
        this.map.removeLayer(layerId);
      }
      if (this.map.getSource(layerId)) {
        this.map.removeSource(layerId);
      }
    });
  }

  fitToRoutes(routeIds) {
    const trips = this.gtfsParser.getFileData('trips.txt') || [];
    const stopTimes = this.gtfsParser.getFileData('stop_times.txt') || [];
    const stops = this.gtfsParser.getFileData('stops.txt') || [];
    
    // Find all stops for these routes
    const allStops = new Set();
    
    routeIds.forEach(routeId => {
      const routeTrips = trips.filter(trip => trip.route_id === routeId);
      routeTrips.forEach(trip => {
        const tripStopTimes = stopTimes.filter(st => st.trip_id === trip.trip_id);
        tripStopTimes.forEach(st => allStops.add(st.stop_id));
      });
    });
    
    // Get coordinates for all stops
    const coordinates = [];
    stops.forEach(stop => {
      if (allStops.has(stop.stop_id) && stop.stop_lat && stop.stop_lon) {
        coordinates.push([parseFloat(stop.stop_lon), parseFloat(stop.stop_lat)]); // [lng, lat] for MapLibre
      }
    });
    
    if (coordinates.length > 0) {
      const bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord);
      }, new LngLatBounds(coordinates[0], coordinates[0]));
      
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
}