# GTFS.io MVP Plan

## Overview
Create a web-based GTFS editor inspired by geojson.io, allowing users to upload, edit, and export GTFS feeds with no login required.

## Architecture & Tech Stack
- **Frontend**: Vanilla JavaScript + CSS (simplified from Tailwind for MVP)
- **Build**: Rollup bundler with live-server for development
- **Map**: Leaflet for transit route/stop visualization
- **File Handling**: Client-side ZIP processing using JSZip library
- **Text Editor**: Simple textarea for MVP (Monaco Editor integration planned)
- **CSV Parsing**: PapaParse for handling GTFS CSV files

## Core MVP Features ✅

### 1. File Upload & Processing ✅
- Drag & drop GTFS ZIP file upload
- Extract and parse all GTFS files (agency.txt, routes.txt, stops.txt, etc.)
- Validate basic GTFS structure and show file list
- Real-time file list with required/optional/other categorization

### 2. Map Visualization ✅
- Display stops as markers on map using coordinates from stops.txt
- Show route shapes if available in shapes.txt
- Basic route lines connecting stops for simple visualization
- Clickable stops showing basic info (stop_name, stop_id)
- Auto-fit map bounds to show all transit data

### 3. Text Editor Interface ✅
- File tree sidebar showing all GTFS files with record counts
- Simple textarea editor for CSV editing (Monaco Editor planned for future)
- Click any file to view/edit content
- Split-panel layout: editor on left, map on right
- File categorization (required, optional, other)

### 4. Export Functionality ✅
- Download modified GTFS as ZIP file
- Preserve original file structure and naming
- Save editor changes before export

### 5. URL API
- Load GTFS from URL: `gtfs.io#data=url:https://example.com/gtfs.zip` (pending)
- Share capability for small GTFS feeds (pending)

## File Structure
```
gtfs.io/
├── src/
│   ├── js/
│   │   └── main.js          # Main application
│   ├── css/
│   │   └── styles.css       # Tailwind source
│   └── index.html           # Single page app
├── dist/                    # Build output
│   ├── index.html
│   ├── styles.css           # Compiled CSS
│   └── bundle.js            # Compiled JS
├── package.json
├── rollup.config.js
├── tailwind.config.js
├── MVP_PLAN.md             # This plan document
└── CLAUDE.md               # Development notes and commands
```

## GTFS File Support
The application handles the complete GTFS specification:

### Required Files ✅
- agency.txt - Transit agency information
- routes.txt - Transit routes
- trips.txt - Vehicle trips on routes
- stops.txt - Individual stop locations
- stop_times.txt - Times vehicles arrive/depart at stops
- calendar.txt - Service schedules
- calendar_dates.txt - Service schedule exceptions

### Optional Files ✅
- shapes.txt - Route geometry (visualized on map)
- frequencies.txt - Headway-based service
- transfers.txt - Transfer information
- feed_info.txt - Feed metadata
- fare_attributes.txt - Fare information
- fare_rules.txt - Fare rules
- locations.geojson - Geographic areas

## Features Implemented

### Map Integration
- Leaflet map with OpenStreetMap tiles
- Stop markers with popup information
- Route shape polylines from shapes.txt
- Auto-zoom to fit all transit data
- Visual overlay when no data is loaded

### File Management
- ZIP file extraction and parsing
- CSV parsing with Papa Parse
- File categorization and organization
- Error handling for malformed files
- Record count display for each file

### User Interface
- Clean, minimal design inspired by geojson.io
- Responsive split-panel layout
- File tree navigation
- Upload via button or drag-and-drop
- Export button with state management

## Development Status
- ✅ Project setup and build system
- ✅ HTML layout and CSS styling
- ✅ GTFS file upload and parsing
- ✅ Map visualization with stops and shapes
- ✅ Text editor integration (basic textarea)
- ✅ Export functionality
- ⏳ URL API support (planned)
- ⏳ Monaco Editor integration (planned)
- ⏳ GTFS validation integration (planned)

## Future Enhancements
1. **Monaco Editor Integration**: Rich text editing with syntax highlighting
2. **GTFS Validation**: Integration with MobilityData/gtfs-validator
3. **URL API**: Load and share GTFS feeds via URL parameters
4. **Advanced Editing**: Form-based editing for specific GTFS records
5. **Route Visualization**: Enhanced route rendering with trip patterns
6. **Real-time Preview**: Live map updates as files are edited
7. **Error Handling**: Better validation and error reporting
8. **Performance**: Optimization for large GTFS feeds

## Testing
To test the MVP:
1. Run `npm start` to start development server
2. Open browser to localhost:8080
3. Upload a GTFS ZIP file (try: https://transitfeeds.com)
4. View stops and routes on map
5. Click files in sidebar to edit
6. Export modified GTFS

The MVP successfully demonstrates core functionality and provides a solid foundation for the full gtfs.io vision.