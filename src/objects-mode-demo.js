/**
 * Objects Mode Demo Script
 * This is a standalone script to test Objects mode functionality
 * Independent of the main application bundle
 */

// Import modules (will be bundled)
import { GTFSRelationships } from './modules/gtfs-relationships.js';
import { ObjectsNavigation } from './modules/objects-navigation.js';

// Mock GTFS Parser for demo
class MockGTFSParser {
  constructor() {
    this.demoData = {
      'agency.txt': [
        {
          agency_id: 'demo-transit',
          agency_name: 'Demo Transit Authority',
          agency_url: 'https://demo-transit.com',
          agency_timezone: 'America/New_York',
          agency_lang: 'en',
          agency_phone: '555-0123'
        }
      ],
      'routes.txt': [
        {
          route_id: 'route-1',
          agency_id: 'demo-transit',
          route_short_name: '1',
          route_long_name: 'Main Street Line',
          route_desc: 'Connects downtown to uptown',
          route_type: '3',
          route_color: 'FF0000',
          route_text_color: 'FFFFFF'
        },
        {
          route_id: 'route-2',
          agency_id: 'demo-transit',
          route_short_name: '2',
          route_long_name: 'Oak Avenue Express',
          route_desc: 'Express service to business district',
          route_type: '3',
          route_color: '0000FF',
          route_text_color: 'FFFFFF'
        }
      ],
      'trips.txt': [
        {
          route_id: 'route-1',
          service_id: 'weekday',
          trip_id: 'trip-1-1',
          trip_headsign: 'Downtown',
          direction_id: '0',
          shape_id: 'shape-1'
        },
        {
          route_id: 'route-1',
          service_id: 'weekday',
          trip_id: 'trip-1-2',
          trip_headsign: 'Uptown',
          direction_id: '1',
          shape_id: 'shape-2'
        },
        {
          route_id: 'route-2',
          service_id: 'weekday',
          trip_id: 'trip-2-1',
          trip_headsign: 'Business District',
          direction_id: '0',
          shape_id: 'shape-3'
        }
      ],
      'stops.txt': [
        {
          stop_id: 'stop-1',
          stop_name: 'Main & 1st Street',
          stop_desc: 'Corner of Main and 1st Street',
          stop_lat: '40.7128',
          stop_lon: '-74.0060',
          zone_id: 'zone-1'
        },
        {
          stop_id: 'stop-2',
          stop_name: 'Main & 5th Street',
          stop_desc: 'Corner of Main and 5th Street',
          stop_lat: '40.7200',
          stop_lon: '-74.0100',
          zone_id: 'zone-1'
        },
        {
          stop_id: 'stop-3',
          stop_name: 'Oak Avenue Terminal',
          stop_desc: 'Oak Avenue Transit Terminal',
          stop_lat: '40.7300',
          stop_lon: '-74.0200',
          zone_id: 'zone-2'
        }
      ],
      'stop_times.txt': [
        {
          trip_id: 'trip-1-1',
          arrival_time: '08:00:00',
          departure_time: '08:00:00',
          stop_id: 'stop-1',
          stop_sequence: '1'
        },
        {
          trip_id: 'trip-1-1',
          arrival_time: '08:05:00',
          departure_time: '08:05:00',
          stop_id: 'stop-2',
          stop_sequence: '2'
        },
        {
          trip_id: 'trip-2-1',
          arrival_time: '08:15:00',
          departure_time: '08:15:00',
          stop_id: 'stop-2',
          stop_sequence: '1'
        },
        {
          trip_id: 'trip-2-1',
          arrival_time: '08:25:00',
          departure_time: '08:25:00',
          stop_id: 'stop-3',
          stop_sequence: '2'
        }
      ],
      'calendar.txt': [
        {
          service_id: 'weekday',
          monday: '1',
          tuesday: '1',
          wednesday: '1',
          thursday: '1',
          friday: '1',
          saturday: '0',
          sunday: '0',
          start_date: '20240101',
          end_date: '20241231'
        }
      ]
    };
  }

  getFileData(filename) {
    return this.demoData[filename] || null;
  }

  hasData() {
    return true;
  }
}

// Initialize Objects Mode Demo
function initializeObjectsMode() {
  console.log('Initializing Objects Mode Demo...');
  
  // Create mock GTFS parser with demo data
  const mockParser = new MockGTFSParser();
  
  // Create relationships handler
  const relationships = new GTFSRelationships(mockParser);
  
  // Create mock map controller
  const mockMapController = {
    highlightAgency: (agencyId) => console.log('Map: Highlight agency', agencyId),
    highlightRoute: (routeId) => console.log('Map: Highlight route', routeId),
    highlightTrip: (tripId) => console.log('Map: Highlight trip', tripId),
    highlightStop: (stopId) => console.log('Map: Highlight stop', stopId)
  };
  
  // Create objects navigation
  const objectsNav = new ObjectsNavigation(relationships, mockMapController);
  
  // Initialize with the objects navigation container
  objectsNav.initialize('objects-navigation');
  
  console.log('Objects Mode Demo initialized successfully!');
  
  // Make it available globally for debugging
  window.objectsDemo = {
    relationships,
    objectsNav,
    mockParser
  };
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeObjectsMode);
} else {
  initializeObjectsMode();
}