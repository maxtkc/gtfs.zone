import JSZip from 'jszip';
import Papa from 'papaparse';

// GTFS file definitions
const GTFS_FILES = {
  required: [
    'agency.txt',
    'routes.txt',
    'trips.txt',
    'stops.txt',
    'stop_times.txt',
    'calendar.txt',
    'calendar_dates.txt'
  ],
  optional: [
    'shapes.txt',
    'frequencies.txt',
    'transfers.txt',
    'feed_info.txt',
    'fare_attributes.txt',
    'fare_rules.txt',
    'locations.geojson'
  ]
};

class GTFSEditor {
  constructor() {
    this.gtfsData = {};
    this.currentFile = null;
    this.editor = null;
    this.map = null;
    this.isTableView = false;
    this.tableData = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.initializeMap();
    this.initializeEditor();
    this.checkURLParams();
  }

  setupEventListeners() {
    // Upload button
    document.getElementById('upload-btn').addEventListener('click', () => {
      document.getElementById('file-input').click();
    });

    // File input
    document.getElementById('file-input').addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.loadGTFSFile(e.target.files[0]);
      }
    });

    // Export button
    document.getElementById('export-btn').addEventListener('click', () => {
      this.exportGTFS();
    });

    // Editor controls - add listeners only when elements exist
    const closeBtn = document.getElementById('close-editor-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closeEditor();
      });
    }

    const textBtn = document.getElementById('view-text-btn');
    if (textBtn) {
      textBtn.addEventListener('click', () => {
        this.switchToTextView();
      });
    }

    const tableBtn = document.getElementById('view-table-btn');
    if (tableBtn) {
      tableBtn.addEventListener('click', () => {
        this.switchToTableView();
      });
    }

    // Drag and drop
    const body = document.body;
    body.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    body.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].name.endsWith('.zip')) {
        this.loadGTFSFile(files[0]);
      }
    });
  }

  initializeMap() {
    // Initialize Leaflet map
    this.map = L.map('map').setView([40.7128, -74.0060], 10); // Default to NYC
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Keep map overlay visible initially
    document.getElementById('map-overlay').style.display = 'flex';
  }

  initializeEditor() {
    // Initialize with a simple textarea for now
    // Monaco Editor will be loaded via CDN
    const editorContainer = document.getElementById('monaco-editor');
    editorContainer.innerHTML = `
      <textarea id="simple-editor" placeholder="Select a file from the sidebar to edit its content...">
      </textarea>
    `;
    this.editor = document.getElementById('simple-editor');
  }

  async loadGTFSFile(file) {
    try {
      console.log('Loading GTFS file:', file.name);
      
      // Show loading state
      this.showLoading();
      
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      
      // Parse all text files in the ZIP
      const files = Object.keys(zipContent.files).filter(name => 
        name.endsWith('.txt') || name.endsWith('.geojson')
      );
      
      this.gtfsData = {};
      
      for (const fileName of files) {
        const fileContent = await zipContent.files[fileName].async('text');
        
        if (fileName.endsWith('.txt')) {
          // Parse CSV files
          const parsed = Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true
          });
          this.gtfsData[fileName] = {
            content: fileContent,
            data: parsed.data,
            errors: parsed.errors
          };
        } else if (fileName.endsWith('.geojson')) {
          // Handle GeoJSON files
          this.gtfsData[fileName] = {
            content: fileContent,
            data: JSON.parse(fileContent)
          };
        }
      }
      
      console.log('Loaded GTFS data:', this.gtfsData);
      
      // Update UI
      this.updateFileList();
      this.updateMap();
      this.hideMapOverlay();
      
      // Enable export button
      document.getElementById('export-btn').disabled = false;
      
    } catch (error) {
      console.error('Error loading GTFS file:', error);
      alert('Error loading GTFS file: ' + error.message);
    }
  }

  updateFileList() {
    const fileList = document.getElementById('file-list');
    fileList.innerHTML = '';
    
    // Group files by required/optional
    const allFiles = Object.keys(this.gtfsData);
    const requiredFiles = allFiles.filter(f => GTFS_FILES.required.includes(f));
    const optionalFiles = allFiles.filter(f => GTFS_FILES.optional.includes(f));
    const otherFiles = allFiles.filter(f => 
      !GTFS_FILES.required.includes(f) && !GTFS_FILES.optional.includes(f)
    );
    
    // Add required files section
    if (requiredFiles.length > 0) {
      const requiredHeader = document.createElement('div');
      requiredHeader.className = 'px-3 py-1 text-xs text-gray-500 uppercase font-semibold';
      requiredHeader.textContent = 'Required Files';
      fileList.appendChild(requiredHeader);
      
      requiredFiles.forEach(fileName => {
        this.addFileItem(fileList, fileName, true);
      });
    }
    
    // Add optional files section
    if (optionalFiles.length > 0) {
      const optionalHeader = document.createElement('div');
      optionalHeader.className = 'px-3 py-1 text-xs text-gray-500 uppercase font-semibold mt-2';
      optionalHeader.textContent = 'Optional Files';
      fileList.appendChild(optionalHeader);
      
      optionalFiles.forEach(fileName => {
        this.addFileItem(fileList, fileName, false);
      });
    }
    
    // Add other files section
    if (otherFiles.length > 0) {
      const otherHeader = document.createElement('div');
      otherHeader.className = 'px-3 py-1 text-xs text-gray-500 uppercase font-semibold mt-2';
      otherHeader.textContent = 'Other Files';
      fileList.appendChild(otherHeader);
      
      otherFiles.forEach(fileName => {
        this.addFileItem(fileList, fileName, false);
      });
    }
  }

  addFileItem(container, fileName, isRequired) {
    const item = document.createElement('div');
    item.className = `file-item ${isRequired ? 'required' : ''}`;
    item.textContent = fileName;
    
    // Add record count if available
    if (this.gtfsData[fileName] && this.gtfsData[fileName].data) {
      const count = Array.isArray(this.gtfsData[fileName].data) 
        ? this.gtfsData[fileName].data.length 
        : 1;
      const countSpan = document.createElement('span');
      countSpan.className = 'text-gray-400 text-xs ml-auto';
      countSpan.textContent = `${count} records`;
      item.appendChild(countSpan);
      item.style.display = 'flex';
      item.style.alignItems = 'center';
    }
    
    item.addEventListener('click', () => {
      this.openFile(fileName);
    });
    
    container.appendChild(item);
  }

  openFile(fileName) {
    if (!this.gtfsData[fileName]) return;
    
    // Update active file styling
    document.querySelectorAll('.file-item').forEach(item => {
      item.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Show editor panel
    const editorPanel = document.getElementById('editor-panel');
    const mapPanel = document.getElementById('map-panel');
    
    editorPanel.classList.remove('hidden');
    mapPanel.classList.remove('flex-1');
    mapPanel.classList.add('w-1/2');
    
    // Update current file
    this.currentFile = fileName;
    const fileNameElement = document.getElementById('current-file-name');
    if (fileNameElement) {
      fileNameElement.textContent = fileName;
    }
    
    // Determine if file can be viewed as table (CSV files)
    const canShowTable = fileName.endsWith('.txt') && this.gtfsData[fileName].data;
    const tableBtn = document.getElementById('view-table-btn');
    
    if (tableBtn) {
      if (canShowTable) {
        tableBtn.style.display = 'block';
        // Default to table view for CSV files
        this.switchToTableView();
      } else {
        tableBtn.style.display = 'none';
        this.switchToTextView();
      }
    } else {
      this.switchToTextView();
    }
    
    // Update editor content
    this.editor.value = this.gtfsData[fileName].content;
    
    // Update map if it's a spatial file
    if (fileName === 'stops.txt' || fileName === 'shapes.txt') {
      this.highlightFileData(fileName);
    }
    
    // Trigger map resize to ensure proper rendering
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 300);
  }

  updateMap() {
    if (!this.gtfsData['stops.txt']) return;
    
    // Clear existing layers (keep tile layer)
    this.map.eachLayer(layer => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
        this.map.removeLayer(layer);
      }
    });
    
    // Add enhanced stops to map
    this.addStopsToMap();
    
    // Add routes visualization (without shapes)
    this.addRoutesToMap();
    
    // Add shapes if available (this will overlay on routes)
    if (this.gtfsData['shapes.txt']) {
      this.addShapesToMap();
    }
  }

  addStopsToMap() {
    const stops = this.gtfsData['stops.txt'].data;
    const validStops = stops.filter(stop => 
      stop.stop_lat && stop.stop_lon && 
      !isNaN(parseFloat(stop.stop_lat)) && !isNaN(parseFloat(stop.stop_lon))
    );
    
    if (validStops.length === 0) return;

    // Create stop markers with better styling
    const stopMarkers = [];
    validStops.forEach(stop => {
      const lat = parseFloat(stop.stop_lat);
      const lon = parseFloat(stop.stop_lon);
      
      // Determine stop type and color
      const stopType = stop.location_type || '0';
      let markerColor = '#2563eb'; // Default blue
      let markerSize = 8;
      let stopTypeText = 'Stop';
      
      switch(stopType) {
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
      const routesAtStop = this.getRoutesForStop(stop.stop_id);
      
      // Create enhanced circle marker
      const marker = L.circleMarker([lat, lon], {
        radius: markerSize,
        fillColor: markerColor,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(this.map);

      // Enhanced popup with more information
      const routesList = routesAtStop.length > 0 
        ? `<br><strong>Routes:</strong> ${routesAtStop.map(r => r.route_short_name || r.route_id).join(', ')}`
        : '';
      
      const wheelchairInfo = stop.wheelchair_boarding 
        ? `<br><strong>Wheelchair:</strong> ${this.getWheelchairText(stop.wheelchair_boarding)}`
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
    if (!this.gtfsData['routes.txt'] || !this.gtfsData['trips.txt'] || !this.gtfsData['stop_times.txt']) {
      return;
    }

    const routes = this.gtfsData['routes.txt'].data;
    const trips = this.gtfsData['trips.txt'].data;
    const stopTimes = this.gtfsData['stop_times.txt'].data;
    const stops = this.gtfsData['stops.txt'].data;

    // Create a stops lookup for coordinates
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

    // Group trips by route
    const tripsByRoute = {};
    trips.forEach(trip => {
      if (!tripsByRoute[trip.route_id]) {
        tripsByRoute[trip.route_id] = [];
      }
      tripsByRoute[trip.route_id].push(trip);
    });

    // Route colors
    const routeColors = [
      '#ef4444', '#3b82f6', '#10b981', '#f59e0b', 
      '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
    ];

    routes.forEach((route, index) => {
      const routeTrips = tripsByRoute[route.route_id] || [];
      if (routeTrips.length === 0) return;

      // Get stops for this route from one of its trips
      const firstTrip = routeTrips[0];
      const tripStopTimes = stopTimes
        .filter(st => st.trip_id === firstTrip.trip_id)
        .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));

      if (tripStopTimes.length < 2) return;

      // Create route path from stops
      const routePath = [];
      tripStopTimes.forEach(st => {
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
          dashArray: route.route_type === '3' ? '10, 5' : null // Dashed for buses
        }).addTo(this.map);

        // Route popup with information
        const routeTypeText = this.getRouteTypeText(route.route_type);
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

  getRoutesForStop(stopId) {
    if (!this.gtfsData['routes.txt'] || !this.gtfsData['trips.txt'] || !this.gtfsData['stop_times.txt']) {
      return [];
    }

    const routes = this.gtfsData['routes.txt'].data;
    const trips = this.gtfsData['trips.txt'].data;
    const stopTimes = this.gtfsData['stop_times.txt'].data;

    // Find trips that serve this stop
    const tripsAtStop = stopTimes
      .filter(st => st.stop_id === stopId)
      .map(st => st.trip_id);

    // Find routes for those trips
    const routeIds = [...new Set(
      trips
        .filter(trip => tripsAtStop.includes(trip.trip_id))
        .map(trip => trip.route_id)
    )];

    return routes.filter(route => routeIds.includes(route.route_id));
  }

  getWheelchairText(wheelchairBoarding) {
    switch(wheelchairBoarding) {
      case '1': return 'Accessible';
      case '2': return 'Not accessible';
      default: return 'Unknown';
    }
  }

  getRouteTypeText(routeType) {
    const types = {
      '0': 'Tram/Streetcar',
      '1': 'Subway/Metro',
      '2': 'Rail',
      '3': 'Bus',
      '4': 'Ferry',
      '5': 'Cable Tram',
      '6': 'Aerial Lift',
      '7': 'Funicular',
      '11': 'Trolleybus',
      '12': 'Monorail'
    };
    return types[routeType] || `Type ${routeType}`;
  }

  addShapesToMap() {
    const shapes = this.gtfsData['shapes.txt'].data;
    const shapeGroups = {};
    
    // Group points by shape_id
    shapes.forEach(point => {
      if (!shapeGroups[point.shape_id]) {
        shapeGroups[point.shape_id] = [];
      }
      shapeGroups[point.shape_id].push({
        lat: parseFloat(point.shape_pt_lat),
        lon: parseFloat(point.shape_pt_lon),
        sequence: parseInt(point.shape_pt_sequence) || 0
      });
    });
    
    // Draw polylines for each shape
    Object.keys(shapeGroups).forEach(shapeId => {
      const points = shapeGroups[shapeId]
        .filter(p => !isNaN(p.lat) && !isNaN(p.lon))
        .sort((a, b) => a.sequence - b.sequence)
        .map(p => [p.lat, p.lon]);
      
      if (points.length > 1) {
        L.polyline(points, {
          color: '#3388ff',
          weight: 3,
          opacity: 0.7
        }).addTo(this.map).bindPopup(`Shape ID: ${shapeId}`);
      }
    });
  }

  highlightFileData(fileName) {
    // Add visual emphasis for the selected file's data on map
    // This could be enhanced to highlight specific elements
    console.log(`Highlighting data for ${fileName}`);
  }

  hideMapOverlay() {
    document.getElementById('map-overlay').style.display = 'none';
  }

  showLoading() {
    const overlay = document.getElementById('map-overlay');
    overlay.innerHTML = `
      <div class="text-center">
        <div class="text-4xl mb-4">⏳</div>
        <h2 class="text-xl font-semibold mb-2">Loading GTFS Data...</h2>
        <p class="text-sm">Processing files and parsing data</p>
      </div>
    `;
    overlay.style.display = 'flex';
  }

  closeEditor() {
    const editorPanel = document.getElementById('editor-panel');
    const mapPanel = document.getElementById('map-panel');
    
    // Save current changes
    this.saveCurrentFileChanges();
    
    // Hide editor panel
    editorPanel.classList.add('hidden');
    mapPanel.classList.remove('w-1/2');
    mapPanel.classList.add('flex-1');
    
    // Clear active file styling
    document.querySelectorAll('.file-item').forEach(item => {
      item.classList.remove('active');
    });
    
    this.currentFile = null;
    
    // Trigger map resize
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 300);
  }

  switchToTextView() {
    this.isTableView = false;
    
    // Update button states
    const textBtn = document.getElementById('view-text-btn');
    const tableBtn = document.getElementById('view-table-btn');
    
    if (textBtn) {
      textBtn.className = 'px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600';
    }
    if (tableBtn) {
      tableBtn.className = 'px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400';
    }
    
    // Show text editor, hide table editor
    const textView = document.getElementById('text-editor-view');
    const tableView = document.getElementById('table-editor-view');
    
    if (textView) {
      textView.classList.remove('hidden');
    }
    if (tableView) {
      tableView.classList.add('hidden');
    }
    
    // Update text content from table if needed
    if (this.tableData) {
      this.syncTableToText();
    }
  }

  switchToTableView() {
    if (!this.currentFile || !this.gtfsData[this.currentFile].data) return;
    
    this.isTableView = true;
    
    // Update button states
    const textBtn = document.getElementById('view-text-btn');
    const tableBtn = document.getElementById('view-table-btn');
    
    if (textBtn) {
      textBtn.className = 'px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400';
    }
    if (tableBtn) {
      tableBtn.className = 'px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600';
    }
    
    // Show table editor, hide text editor
    const textView = document.getElementById('text-editor-view');
    const tableView = document.getElementById('table-editor-view');
    
    if (textView) {
      textView.classList.add('hidden');
    }
    if (tableView) {
      tableView.classList.remove('hidden');
    }
    
    // Build table
    this.buildTableEditor();
  }

  buildTableEditor() {
    const data = this.gtfsData[this.currentFile].data;
    if (!data || data.length === 0) return;
    
    // Get headers from first row
    const headers = Object.keys(data[0]);
    
    // Create table HTML
    let tableHTML = '<table id="table-editor"><thead><tr>';
    headers.forEach(header => {
      tableHTML += `<th>${header}</th>`;
    });
    tableHTML += '</tr></thead><tbody>';
    
    // Add data rows
    data.forEach((row, rowIndex) => {
      tableHTML += '<tr>';
      headers.forEach(header => {
        const value = row[header] || '';
        tableHTML += `<td><input type="text" value="${this.escapeHtml(value)}" data-row="${rowIndex}" data-col="${header}" /></td>`;
      });
      tableHTML += '</tr>';
    });
    
    tableHTML += '</tbody></table>';
    
    // Set table content
    document.getElementById('table-editor').innerHTML = tableHTML;
    
    // Add event listeners for cell changes
    document.querySelectorAll('#table-editor input').forEach(input => {
      input.addEventListener('change', (e) => {
        this.updateTableCell(e.target);
      });
    });
    
    // Store reference to table data
    this.tableData = data;
  }

  updateTableCell(input) {
    const row = parseInt(input.dataset.row);
    const col = input.dataset.col;
    const value = input.value;
    
    if (this.tableData && this.tableData[row]) {
      this.tableData[row][col] = value;
    }
  }

  syncTableToText() {
    if (!this.tableData) return;
    
    // Convert table data back to CSV
    const csv = Papa.unparse(this.tableData);
    this.editor.value = csv;
    this.gtfsData[this.currentFile].content = csv;
  }

  saveCurrentFileChanges() {
    if (!this.currentFile) return;
    
    if (this.isTableView && this.tableData) {
      // Save from table
      this.syncTableToText();
    } else if (this.editor) {
      // Save from text editor
      this.gtfsData[this.currentFile].content = this.editor.value;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  exportGTFS() {
    if (Object.keys(this.gtfsData).length === 0) {
      alert('No GTFS data to export');
      return;
    }
    
    console.log('Exporting GTFS data...');
    
    // Save current file changes
    this.saveCurrentFileChanges();
    
    // Create ZIP file
    const zip = new JSZip();
    
    Object.keys(this.gtfsData).forEach(fileName => {
      zip.file(fileName, this.gtfsData[fileName].content);
    });
    
    // Generate and download
    zip.generateAsync({ type: 'blob' }).then(content => {
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gtfs-modified.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  checkURLParams() {
    // Check for URL parameters to load GTFS data
    const hash = window.location.hash.substring(1);
    if (hash.startsWith('data=')) {
      const dataParam = hash.substring(5);
      
      if (dataParam.startsWith('url:')) {
        // Load from URL
        const url = dataParam.substring(4);
        this.loadGTFSFromURL(url);
      }
      // Future: support for base64, github, etc.
    }
  }

  async loadGTFSFromURL(url) {
    try {
      console.log('Loading GTFS from URL:', url);
      this.showLoading();
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      await this.loadGTFSFile(blob);
      
    } catch (error) {
      console.error('Error loading GTFS from URL:', error);
      alert('Error loading GTFS from URL: ' + error.message);
      this.hideMapOverlay();
    }
  }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  new GTFSEditor();
});