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
    document.getElementById('editor-panel').classList.remove('hidden');
    document.getElementById('map-panel').classList.remove('flex-1');
    document.getElementById('map-panel').classList.add('w-1/2');
    
    // Update editor content
    this.currentFile = fileName;
    this.editor.value = this.gtfsData[fileName].content;
    
    // Update map if it's a spatial file
    if (fileName === 'stops.txt' || fileName === 'shapes.txt') {
      this.highlightFileData(fileName);
    }
  }

  updateMap() {
    if (!this.gtfsData['stops.txt']) return;
    
    // Clear existing layers
    this.map.eachLayer(layer => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        this.map.removeLayer(layer);
      }
    });
    
    // Add stops to map
    const stops = this.gtfsData['stops.txt'].data;
    const validStops = stops.filter(stop => 
      stop.stop_lat && stop.stop_lon && 
      !isNaN(parseFloat(stop.stop_lat)) && !isNaN(parseFloat(stop.stop_lon))
    );
    
    if (validStops.length > 0) {
      // Add stop markers
      validStops.forEach(stop => {
        const lat = parseFloat(stop.stop_lat);
        const lon = parseFloat(stop.stop_lon);
        
        L.marker([lat, lon])
          .addTo(this.map)
          .bindPopup(`
            <strong>${stop.stop_name || 'Unnamed Stop'}</strong><br>
            ID: ${stop.stop_id}<br>
            ${stop.stop_desc ? `${stop.stop_desc}<br>` : ''}
            Lat: ${lat}, Lon: ${lon}
          `);
      });
      
      // Fit map to show all stops
      const group = new L.featureGroup(this.map._layers);
      if (Object.keys(group._layers).length > 0) {
        this.map.fitBounds(group.getBounds().pad(0.1));
      }
    }
    
    // Add shapes if available
    if (this.gtfsData['shapes.txt']) {
      this.addShapesToMap();
    }
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

  exportGTFS() {
    if (Object.keys(this.gtfsData).length === 0) {
      alert('No GTFS data to export');
      return;
    }
    
    console.log('Exporting GTFS data...');
    
    // Update current file content if editor is open
    if (this.currentFile && this.editor) {
      this.gtfsData[this.currentFile].content = this.editor.value;
    }
    
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