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
  <body class="font-sans bg-slate-800 text-white overflow-hidden h-screen">
    <!-- Header -->
    <header class="fixed top-0 left-0 right-0 h-15 bg-slate-700/95 backdrop-blur-sm border-b border-white/10 flex items-center justify-between px-5 z-50">
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-semibold text-white">gtfs.zone</h1>
        <span class="text-xs text-white/70 font-normal">powered by OpenStreetMap</span>
      </div>
      <div class="flex gap-2">
        <button id="upload-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Upload</button>
        <button id="export-btn" class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors" disabled>Export</button>
        <button id="new-btn" class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors">New</button>
        <button id="help-btn" class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors">Help</button>
      </div>
    </header>

    <!-- Main Map Container -->
    <div id="map-container" class="pt-15 h-screen bg-slate-800">
      <div id="map-panel" class="relative w-full h-full">
        <div id="map" class="w-full h-full"></div>
      </div>
      
      <!-- Map Controls -->
      <div id="map-controls" class="absolute top-20 right-4 z-40">
        <div class="bg-white rounded-lg shadow-lg p-2">
          <input type="text" id="map-search" placeholder="Search" class="w-48 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <!-- File Sidebar (Collapsible) -->
      <div id="sidebar" class="fixed left-0 top-15 bottom-0 w-80 bg-slate-700 border-r border-slate-600 transform -translate-x-full transition-transform duration-300 z-40 collapsed">
        <div class="p-4 border-b border-slate-600">
          <button id="sidebar-toggle" class="absolute top-20 -right-12 bg-slate-700 text-white p-2 rounded-r-md hover:bg-slate-600 transition-colors">📁</button>
          <h3 class="text-lg font-semibold text-white">GTFS Files</h3>
        </div>
        <div id="file-list" class="p-4 overflow-y-auto h-full">
          <div class="text-slate-400 text-sm text-center py-8">
            Upload a GTFS file to get started
          </div>
        </div>
      </div>

      <!-- Editor Panel (Right overlay) -->
      <div id="editor-panel" class="fixed right-0 top-15 bottom-0 w-1/2 bg-white border-l border-slate-300 z-30 transform translate-x-full transition-transform duration-300 hidden">
        <div class="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div class="flex items-center gap-4">
            <div class="flex bg-slate-200 rounded-lg p-1">
              <span class="px-3 py-1 text-sm font-medium text-slate-700 bg-white rounded-md shadow-sm cursor-pointer toggle-text text-option active" data-view="text">Text</span>
              <input type="checkbox" id="view-toggle-checkbox" class="hidden">
              <span class="px-3 py-1 text-sm font-medium text-slate-700 cursor-pointer toggle-text table-option" data-view="table">Table</span>
            </div>
          </div>
          <button id="close-editor-btn" class="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors">×</button>
        </div>
        
        <div class="flex-1 overflow-hidden">
          <!-- Text Editor View -->
          <div id="text-editor-view" class="h-full">
            <div id="simple-editor-container" class="h-full">
              <div id="simple-editor" class="h-full"></div>
            </div>
          </div>

          <!-- Table Editor View -->
          <div id="table-editor-view" class="h-full hidden">
            <div id="table-container" class="h-full overflow-auto">
              <div id="table-editor" class="h-full"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Welcome Overlay -->
      <div id="map-overlay" class="absolute inset-0 bg-slate-800/90 backdrop-blur-sm flex items-center justify-center z-20">
        <div class="text-center">
          <div class="text-6xl mb-4">🚌</div>
          <h2 class="text-3xl font-bold text-white mb-4">Welcome to gtfs.zone</h2>
          <p class="text-lg text-slate-300">Upload a GTFS file to visualize transit routes and stops</p>
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