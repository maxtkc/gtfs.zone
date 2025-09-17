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
  <body class="font-sans bg-slate-800 text-white h-screen overflow-hidden">
    <!-- App Container with CSS Grid -->
    <div class="app-container grid grid-cols-[320px_1fr_400px] grid-rows-[60px_1fr] h-screen">
      
      <!-- Header -->
      <header class="col-span-3 bg-slate-700/95 backdrop-blur-sm border-b border-white/10 flex items-center justify-between px-5">
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-semibold text-white">gtfs.zone</h1>
          <span class="text-xs text-white/70 font-normal">powered by OpenStreetMap</span>
        </div>
        <div class="flex gap-2">
          <button id="upload-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Upload</button>
          <button id="export-btn" class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors" disabled>Export</button>
          <button id="new-btn" class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors">New</button>
        </div>
      </header>

      <!-- Left Panel -->
      <div class="left-panel bg-slate-700 border-r border-slate-600 flex flex-col">
        <!-- Left Panel Tabs -->
        <div class="flex border-b border-slate-600">
          <button class="tab-btn active flex-1 px-4 py-3 text-sm font-medium text-white hover:bg-slate-600 border-b-2 border-blue-500" data-tab="files">Files</button>
          <button class="tab-btn flex-1 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-600 border-b-2 border-transparent" data-tab="objects">Objects</button>
        </div>
        
        <!-- Left Panel Content -->
        <div class="flex-1 overflow-hidden">
          <!-- Files Tab Content -->
          <div id="files-tab" class="tab-content h-full">
            <div id="file-list" class="p-4 overflow-y-auto h-full">
              <div class="text-slate-400 text-sm text-center py-8">
                No GTFS files loaded
              </div>
            </div>
          </div>
          
          <!-- Objects Tab Content -->
          <div id="objects-tab" class="tab-content h-full hidden">
            <div id="objects-navigation" class="h-full">
              <div class="text-slate-400 text-sm text-center py-8">
                No GTFS data to explore
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Map Container -->
      <div class="map-container relative bg-slate-800">
        <div id="map" class="w-full h-full"></div>
        
        <!-- Map Controls -->
        <div id="map-controls" class="absolute top-4 right-4 z-40">
          <div class="bg-white rounded-lg shadow-lg p-2">
            <input type="text" id="map-search" placeholder="Search" class="w-48 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <!-- Welcome Overlay -->
        <div id="map-overlay" class="absolute inset-0 bg-slate-800/90 backdrop-blur-sm flex items-center justify-center z-20">
          <div class="text-center">
            <div class="text-6xl mb-4">🚌</div>
            <h2 class="text-3xl font-bold text-white mb-4">Welcome to gtfs.zone</h2>
            <p class="text-lg text-slate-300">Create a new GTFS feed or upload an existing one</p>
          </div>
        </div>
      </div>

      <!-- Right Panel -->
      <div class="right-panel bg-white border-l border-slate-300 flex flex-col">
        <!-- Right Panel Tabs -->
        <div class="flex border-b border-slate-200 bg-slate-50">
          <button class="tab-btn active flex-1 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 border-b-2 border-blue-500" data-tab="editor">Editor</button>
          <button class="tab-btn flex-1 px-4 py-3 text-sm font-medium text-slate-500 hover:bg-slate-100 border-b-2 border-transparent" data-tab="info">Info</button>
          <button class="tab-btn flex-1 px-4 py-3 text-sm font-medium text-slate-500 hover:bg-slate-100 border-b-2 border-transparent" data-tab="help">Help</button>
        </div>
        
        <!-- Right Panel Content -->
        <div class="flex-1 overflow-hidden">
          <!-- Editor Tab Content -->
          <div id="editor-tab" class="tab-content h-full">
            <div class="h-full flex flex-col">
              <!-- Editor Controls -->
              <div class="flex items-center gap-4 p-4 border-b border-slate-200">
                <div class="flex bg-slate-200 rounded-lg p-1">
                  <span class="px-3 py-1 text-sm font-medium text-slate-700 bg-white rounded-md shadow-sm cursor-pointer active" data-view="text">Text</span>
                  <span class="px-3 py-1 text-sm font-medium text-slate-700 cursor-pointer" data-view="table">Table</span>
                </div>
              </div>
              
              <!-- Editor Content -->
              <div class="flex-1 overflow-hidden">
                <div id="text-editor-view" class="h-full">
                  <div id="simple-editor-container" class="h-full">
                    <div id="simple-editor" class="h-full"></div>
                  </div>
                </div>
                <div id="table-editor-view" class="h-full hidden">
                  <div id="table-container" class="h-full overflow-auto">
                    <div id="table-editor" class="h-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Info Tab Content -->
          <div id="info-tab" class="tab-content h-full hidden">
            <div class="p-4 overflow-y-auto h-full">
              <div class="text-slate-500 text-sm">
                Select an object to see details
              </div>
            </div>
          </div>
          
          <!-- Help Tab Content -->
          <div id="help-tab" class="tab-content h-full hidden">
            <div class="p-4 overflow-y-auto h-full">
              <div class="text-slate-700">
                <h3 class="font-semibold mb-3">Getting Started</h3>
                <p class="text-sm mb-3">Create a new GTFS feed or upload an existing ZIP file to begin editing.</p>
                <h3 class="font-semibold mb-3">Keyboard Shortcuts</h3>
                <ul class="text-sm space-y-1">
                  <li><code class="bg-slate-100 px-1 rounded">Ctrl+S</code> - Save current file</li>
                  <li><code class="bg-slate-100 px-1 rounded">Ctrl+N</code> - New file</li>
                </ul>
              </div>
            </div>
          </div>
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