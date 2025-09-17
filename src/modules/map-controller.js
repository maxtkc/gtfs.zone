export class MapController {
  constructor(mapElementId = 'map') {
    this.map = null;
    this.mapElementId = mapElementId;
    this.gtfsParser = null;
    this.resizeTimeout = null;
  }

  initialize(gtfsParser) {
    this.gtfsParser = gtfsParser;
    
    // Initialize Leaflet map
    this.map = L.map(this.mapElementId).setView([40.7128, -74.006], 10); // Default to NYC

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    // Keep welcome overlay visible initially
    const welcomeOverlay = document.getElementById('welcome-overlay');
    if (welcomeOverlay) {
      welcomeOverlay.classList.remove('hidden');
    }
  }

  updateMap() {
    if (!this.gtfsParser || !this.gtfsParser.getFileData('stops.txt')) {
      return;
    }

    // Clear existing layers (keep tile layer)
    this.map.eachLayer((layer) => {
      if (
        layer instanceof L.Marker ||
        layer instanceof L.Polyline ||
        layer instanceof L.CircleMarker
      ) {
        this.map.removeLayer(layer);
      }
    });

    // Add enhanced stops to map
    this.addStopsToMap();

    // Add routes visualization (without shapes)
    this.addRoutesToMap();

    // Add shapes if available (this will overlay on routes)
    if (this.gtfsParser.getFileData('shapes.txt')) {
      this.addShapesToMap();
    }
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

    // Create stop markers with better styling
    const stopMarkers = [];
    validStops.forEach((stop) => {
      const lat = parseFloat(stop.stop_lat);
      const lon = parseFloat(stop.stop_lon);

      // Determine stop type and color
      const stopType = stop.location_type || '0';
      let markerColor = '#2563eb'; // Default blue
      let markerSize = 8;
      let stopTypeText = 'Stop';

      switch (stopType) {
      case '0': // Stop/platform
        markerColor = '#2563eb';
        stopTypeText = 'Stop';
        markerSize = 8;
        break;
      case '1': // Station
        markerColor = '#dc2626';
        stopTypeText = 'Station';
        markerSize = 12;
        break;
      case '2': // Station entrance/exit
        markerColor = '#16a34a';
        stopTypeText = 'Entrance/Exit';
        markerSize = 6;
        break;
      case '3': // Generic node
        markerColor = '#ca8a04';
        stopTypeText = 'Node';
        markerSize = 6;
        break;
      case '4': // Boarding area
        markerColor = '#7c3aed';
        stopTypeText = 'Boarding Area';
        markerSize = 8;
        break;
      }

      // Get routes serving this stop
      const routesAtStop = this.gtfsParser.getRoutesForStop(stop.stop_id);

      // Create enhanced circle marker
      const marker = L.circleMarker([lat, lon], {
        radius: markerSize,
        fillColor: markerColor,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      }).addTo(this.map);

      // Enhanced popup with more information
      const routesList =
        routesAtStop.length > 0
          ? `<br><strong>Routes:</strong> ${routesAtStop.map((r) => r.route_short_name || r.route_id).join(', ')}`
          : '';

      const wheelchairInfo = stop.wheelchair_boarding
        ? `<br><strong>Wheelchair:</strong> ${this.gtfsParser.getWheelchairText(stop.wheelchair_boarding)}`
        : '';

      marker.bindPopup(`
        <div style="min-width: 200px;">
          <strong>${stop.stop_name || 'Unnamed Stop'}</strong><br>
          <span style="color: ${markerColor}; font-weight: bold;">${stopTypeText}</span><br>
          <strong>ID:</strong> ${stop.stop_id}<br>
          ${stop.stop_code ? `<strong>Code:</strong> ${stop.stop_code}<br>` : ''}
          ${stop.stop_desc ? `<strong>Description:</strong> ${stop.stop_desc}<br>` : ''}
          <strong>Location:</strong> ${lat.toFixed(6)}, ${lon.toFixed(6)}${routesList}${wheelchairInfo}
        </div>
      `);

      stopMarkers.push(marker);
    });

    // Fit map to show all stops
    if (stopMarkers.length > 0) {
      const group = new L.featureGroup(stopMarkers);
      this.map.fitBounds(group.getBounds().pad(0.1));
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
          routePath.push([stopCoords.lat, stopCoords.lon]);
        }
      });

      if (routePath.length >= 2) {
        const routeColor = routeColors[index % routeColors.length];

        // Create route line
        const routeLine = L.polyline(routePath, {
          color: routeColor,
          weight: 4,
          opacity: 0.7,
          dashArray: route.route_type === '3' ? '10, 5' : null, // Dashed for buses
        }).addTo(this.map);

        // Route popup with information
        const routeTypeText = this.gtfsParser.getRouteTypeText(route.route_type);
        routeLine.bindPopup(`
          <div style="min-width: 200px;">
            <strong>${route.route_short_name || route.route_long_name || route.route_id}</strong><br>
            <span style="color: ${routeColor}; font-weight: bold;">${routeTypeText}</span><br>
            ${route.route_long_name && route.route_short_name ? `<strong>Long name:</strong> ${route.route_long_name}<br>` : ''}
            ${route.route_desc ? `<strong>Description:</strong> ${route.route_desc}<br>` : ''}
            <strong>Stops:</strong> ${tripStopTimes.length}<br>
            <strong>Agency:</strong> ${route.agency_id || 'Default'}
          </div>
        `);
      }
    });
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

    // Draw polylines for each shape
    Object.keys(shapeGroups).forEach((shapeId) => {
      const points = shapeGroups[shapeId]
        .filter((p) => !isNaN(p.lat) && !isNaN(p.lon))
        .sort((a, b) => a.sequence - b.sequence)
        .map((p) => [p.lat, p.lon]);

      if (points.length > 1) {
        L.polyline(points, {
          color: '#3388ff',
          weight: 3,
          opacity: 0.7,
        })
          .addTo(this.map)
          .bindPopup(`Shape ID: ${shapeId}`);
      }
    });
  }

  highlightFileData(fileName) {
    // Add visual emphasis for the selected file's data on map
    // This could be enhanced to highlight specific elements
    console.log(`Highlighting data for ${fileName}`);
  }

  hideMapOverlay() {
    const welcomeOverlay = document.getElementById('welcome-overlay');
    if (welcomeOverlay) {
      welcomeOverlay.classList.add('hidden');
    }
    
    // Legacy support - remove old overlay if it exists
    const mapOverlay = document.getElementById('map-overlay');
    if (mapOverlay) {
      mapOverlay.style.display = 'none';
    }
  }

  showLoading() {
    const welcomeOverlay = document.getElementById('welcome-overlay');
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

      // Invalidate size to recalculate map dimensions
      this.map.invalidateSize({
        debounceMoveend: true,
        pan: false, // Prevent pan during resize
      });

      // Restore center and zoom to prevent jumping
      this.map.setView(center, zoom, { animate: false });

      this.resizeTimeout = null;
    }, 350);
  }
}