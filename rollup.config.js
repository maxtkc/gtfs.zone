import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import html from '@rollup/plugin-html';
import copy from 'rollup-plugin-copy';
import postcss from 'rollup-plugin-postcss';

const isProduction = process.env.NODE_ENV === 'production';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/bundle.js',
    format: 'iife',
    sourcemap: true
  },
  plugins: [
    // Resolve and bundle dependencies
    resolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    
    // Bundle CSS
    postcss({
      extract: 'styles.css',
      minimize: isProduction
    }),
    
    // Process HTML template
    html({
      template: ({ files, publicPath, title }) => {
        return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>gtfs.zone - GTFS Transit Data Editor</title>
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    />
    ${files.css.map(({ fileName }) => `<link rel="stylesheet" href="${fileName}" />`).join('\n    ')}
  </head>
  <body>
    <!-- Header -->
    <header class="header">
      <div class="header-left">
        <h1 class="site-title">gtfs.zone</h1>
        <span class="site-subtitle">powered by OpenStreetMap</span>
      </div>
      <div class="header-actions">
        <button id="upload-btn" class="header-btn">Upload</button>
        <button id="export-btn" class="header-btn" disabled>Export</button>
        <button id="new-btn" class="header-btn">New</button>
        <button id="help-btn" class="header-btn">Help</button>
      </div>
    </header>

    <!-- Main Map Container -->
    <div id="map-container">
      <div id="map"></div>
      
      <!-- Map Controls -->
      <div id="map-controls">
        <div class="search-container">
          <input type="text" id="map-search" placeholder="Search" />
        </div>
      </div>

      <!-- File Sidebar (Collapsible) -->
      <div id="file-sidebar" class="sidebar collapsed">
        <div class="sidebar-header">
          <button id="sidebar-toggle" class="sidebar-toggle">📁</button>
          <h3>GTFS Files</h3>
        </div>
        <div id="file-list" class="file-list">
          <div class="empty-state">
            Upload a GTFS file to get started
          </div>
        </div>
      </div>

      <!-- Editor Panel (Right overlay) -->
      <div id="editor-panel" class="editor-panel hidden">
        <div class="editor-header">
          <div class="editor-tabs">
            <div class="view-toggle">
              <span class="toggle-text text-option" data-view="text">Text</span>
              <input type="checkbox" id="view-toggle-checkbox" class="toggle-checkbox">
              <label for="view-toggle-checkbox" class="toggle-label">
                <span class="toggle-slider"></span>
              </label>
              <span class="toggle-text table-option" data-view="table">Table</span>
            </div>
          </div>
          <button id="close-editor-btn" class="close-btn">×</button>
        </div>
        
        <div class="editor-content">
          <!-- Text Editor View -->
          <div id="text-editor-view" class="editor-view">
            <div id="simple-editor-container">
              <textarea id="simple-editor" placeholder="Select a file from the sidebar to edit its content..."></textarea>
            </div>
          </div>

          <!-- Table Editor View -->
          <div id="table-editor-view" class="editor-view hidden">
            <div id="table-container">
              <div id="table-editor"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Welcome Overlay -->
      <div id="welcome-overlay" class="welcome-overlay">
        <div class="welcome-content">
          <div class="welcome-icon">🚌</div>
          <h2>Welcome to gtfs.zone</h2>
          <p>Upload a GTFS file to visualize transit routes and stops</p>
        </div>
      </div>
    </div>

    <!-- Hidden File Input -->
    <input type="file" id="file-input" accept=".zip" style="display: none" />

    <!-- Scripts -->
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    ${files.js.map(({ fileName }) => `<script src="${fileName}"></script>`).join('\n    ')}
  </body>
</html>`;
      }
    }),
    
    // Copy static assets if needed (for future use)
    copy({
      targets: [
        // Example: { src: 'src/assets/*', dest: 'dist/assets' }
      ]
    }),
    
    // Minify in production
    isProduction && terser()
  ].filter(Boolean)
};