import JSZip from 'jszip';
import Papa from 'papaparse';

// GTFS file definitions
export const GTFS_FILES = {
  required: [
    'agency.txt',
    'routes.txt',
    'trips.txt',
    'stops.txt',
    'stop_times.txt',
    'calendar.txt',
    'calendar_dates.txt',
  ],
  optional: [
    'shapes.txt',
    'frequencies.txt',
    'transfers.txt',
    'feed_info.txt',
    'fare_attributes.txt',
    'fare_rules.txt',
    'locations.geojson',
  ],
};

interface GTFSFileData {
  content: string;
  data: any[];
  errors: any[];
}

export class GTFSParser {
  private gtfsData: { [fileName: string]: GTFSFileData } = {};

  constructor() {
    this.gtfsData = {};
  }

  initializeEmpty(): void {
    // Initialize with realistic sample GTFS structure
    const sampleData = {
      'agency.txt': [
        {
          agency_id: 'metro-transit',
          agency_name: 'Metro Transit',
          agency_url: 'https://metro.example.com',
          agency_timezone: 'America/New_York',
        },
        {
          agency_id: 'city-bus',
          agency_name: 'City Bus',
          agency_url: 'https://citybus.example.com',
          agency_timezone: 'America/New_York',
        },
      ],
      'routes.txt': [
        {
          route_id: 'metro-1',
          agency_id: 'metro-transit',
          route_short_name: '1',
          route_long_name: 'Downtown Express',
          route_type: '3',
        },
        {
          route_id: 'metro-2',
          agency_id: 'metro-transit',
          route_short_name: '2',
          route_long_name: 'Uptown Local',
          route_type: '3',
        },
        {
          route_id: 'city-a',
          agency_id: 'city-bus',
          route_short_name: 'A',
          route_long_name: 'Airport Shuttle',
          route_type: '3',
        },
        {
          route_id: 'city-b',
          agency_id: 'city-bus',
          route_short_name: 'B',
          route_long_name: 'Beach Route',
          route_type: '3',
        },
      ],
      'trips.txt': [
        {
          route_id: 'metro-1',
          service_id: 'weekday',
          trip_id: 'metro-1-downtown',
          trip_headsign: 'Downtown',
        },
        {
          route_id: 'metro-1',
          service_id: 'weekday',
          trip_id: 'metro-1-uptown',
          trip_headsign: 'Uptown',
        },
        {
          route_id: 'metro-2',
          service_id: 'weekday',
          trip_id: 'metro-2-local',
          trip_headsign: 'Local Service',
        },
        {
          route_id: 'city-a',
          service_id: 'everyday',
          trip_id: 'city-a-airport',
          trip_headsign: 'Airport Terminal',
        },
      ],
      'stops.txt': [
        {
          stop_id: 'downtown-station',
          stop_name: 'Downtown Station',
          stop_lat: '40.7128',
          stop_lon: '-74.0060',
        },
        {
          stop_id: 'main-street',
          stop_name: 'Main Street & 5th Ave',
          stop_lat: '40.7614',
          stop_lon: '-73.9776',
        },
        {
          stop_id: 'uptown-plaza',
          stop_name: 'Uptown Plaza',
          stop_lat: '40.7831',
          stop_lon: '-73.9712',
        },
        {
          stop_id: 'airport-terminal',
          stop_name: 'Airport Terminal',
          stop_lat: '40.6892',
          stop_lon: '-74.1745',
        },
        {
          stop_id: 'beach-pier',
          stop_name: 'Beach Pier',
          stop_lat: '40.5795',
          stop_lon: '-73.8370',
        },
      ],
      'stop_times.txt': [
        // Metro Route 1 - Downtown
        {
          trip_id: 'metro-1-downtown',
          arrival_time: '08:00:00',
          departure_time: '08:00:00',
          stop_id: 'uptown-plaza',
          stop_sequence: '1',
        },
        {
          trip_id: 'metro-1-downtown',
          arrival_time: '08:15:00',
          departure_time: '08:15:00',
          stop_id: 'main-street',
          stop_sequence: '2',
        },
        {
          trip_id: 'metro-1-downtown',
          arrival_time: '08:30:00',
          departure_time: '08:30:00',
          stop_id: 'downtown-station',
          stop_sequence: '3',
        },
        // City Route A - Airport
        {
          trip_id: 'city-a-airport',
          arrival_time: '09:00:00',
          departure_time: '09:00:00',
          stop_id: 'downtown-station',
          stop_sequence: '1',
        },
        {
          trip_id: 'city-a-airport',
          arrival_time: '09:45:00',
          departure_time: '09:45:00',
          stop_id: 'airport-terminal',
          stop_sequence: '2',
        },
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
          end_date: '20241231',
        },
        {
          service_id: 'everyday',
          monday: '1',
          tuesday: '1',
          wednesday: '1',
          thursday: '1',
          friday: '1',
          saturday: '1',
          sunday: '1',
          start_date: '20240101',
          end_date: '20241231',
        },
      ],
    };

    // Convert to expected format with content and data properties
    this.gtfsData = {};
    for (const [fileName, data] of Object.entries(sampleData)) {
      // Generate CSV content for each file
      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        const csvContent = [
          headers.join(','),
          ...data.map((row: any) =>
            headers.map((header) => (row as any)[header] || '').join(',')
          ),
        ].join('\n');

        this.gtfsData[fileName] = {
          content: csvContent,
          data: data,
          errors: [],
        };
      }
    }

    console.log('Initialized empty GTFS feed with sample data');
    console.log('Final gtfsData structure:', this.gtfsData);
  }

  async parseFile(
    file: File | Blob
  ): Promise<{ [fileName: string]: GTFSFileData }> {
    try {
      console.log('Loading GTFS file:', (file as File).name || 'blob');

      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);

      // Parse all text files in the ZIP
      const files = Object.keys(zipContent.files).filter(
        (name) => name.endsWith('.txt') || name.endsWith('.geojson')
      );

      this.gtfsData = {};

      for (const fileName of files) {
        const fileContent = await zipContent.files[fileName].async('text');

        if (fileName.endsWith('.txt')) {
          // Parse CSV files
          const parsed = Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
          });
          this.gtfsData[fileName] = {
            content: fileContent,
            data: parsed.data,
            errors: parsed.errors,
          };
        } else if (fileName.endsWith('.geojson')) {
          // Handle GeoJSON files
          this.gtfsData[fileName] = {
            content: fileContent,
            data: JSON.parse(fileContent),
            errors: [],
          };
        }
      }

      console.log('Loaded GTFS data:', this.gtfsData);
      return this.gtfsData;
    } catch (error) {
      console.error('Error loading GTFS file:', error);
      throw error;
    }
  }

  async parseFromURL(url: string): Promise<void> {
    try {
      console.log('Loading GTFS from URL:', url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      await this.parseFile(blob);
      return;
    } catch (error) {
      console.error('Error loading GTFS from URL:', error);
      throw error;
    }
  }

  updateFileContent(fileName: string, content: string): void {
    if (this.gtfsData[fileName]) {
      this.gtfsData[fileName].content = content;

      // Re-parse CSV if it's a text file
      if (fileName.endsWith('.txt')) {
        const parsed = Papa.parse(content, {
          header: true,
          skipEmptyLines: true,
        });
        this.gtfsData[fileName].data = parsed.data;
        this.gtfsData[fileName].errors = parsed.errors;
      }
    }
  }

  getFileContent(fileName: string): string {
    return this.gtfsData[fileName]?.content || '';
  }

  getFileData(fileName: string): any[] | null {
    return this.gtfsData[fileName]?.data || null;
  }

  getAllFileNames(): string[] {
    return Object.keys(this.gtfsData);
  }

  categorizeFiles(): {
    required: string[];
    optional: string[];
    other: string[];
  } {
    const allFiles = this.getAllFileNames();
    return {
      required: allFiles.filter((f) => GTFS_FILES.required.includes(f)),
      optional: allFiles.filter((f) => GTFS_FILES.optional.includes(f)),
      other: allFiles.filter(
        (f) =>
          !GTFS_FILES.required.includes(f) && !GTFS_FILES.optional.includes(f)
      ),
    };
  }

  async exportAsZip() {
    if (Object.keys(this.gtfsData).length === 0) {
      throw new Error('No GTFS data to export');
    }

    const zip = new JSZip();

    Object.keys(this.gtfsData).forEach((fileName) => {
      zip.file(fileName, this.gtfsData[fileName].content);
    });

    return await zip.generateAsync({ type: 'blob' });
  }

  getRoutesForStop(stopId: string) {
    const routes = this.getFileData('routes.txt');
    const trips = this.getFileData('trips.txt');
    const stopTimes = this.getFileData('stop_times.txt');

    if (!routes || !trips || !stopTimes) {
      return [];
    }

    // Find trips that serve this stop
    const tripsAtStop = stopTimes
      .filter((st) => st.stop_id === stopId)
      .map((st) => st.trip_id);

    // Find routes for those trips
    const routeIds = [
      ...new Set(
        trips
          .filter((trip) => tripsAtStop.includes(trip.trip_id))
          .map((trip) => trip.route_id)
      ),
    ];

    return routes.filter((route) => routeIds.includes(route.route_id));
  }

  getWheelchairText(wheelchairBoarding: string) {
    switch (wheelchairBoarding) {
      case '1':
        return 'Accessible';
      case '2':
        return 'Not accessible';
      default:
        return 'Unknown';
    }
  }

  getRouteTypeText(routeType: string) {
    const types: { [key: string]: string } = {
      '0': 'Tram/Streetcar',
      '1': 'Subway/Metro',
      '2': 'Rail',
      '3': 'Bus',
      '4': 'Ferry',
      '5': 'Cable Tram',
      '6': 'Aerial Lift',
      '7': 'Funicular',
      '11': 'Trolleybus',
      '12': 'Monorail',
    };
    return types[routeType] || `Type ${routeType}`;
  }

  // Search functionality
  searchStops(query: string) {
    const stops = this.getFileData('stops.txt') || [];
    if (!query || query.trim().length < 2) {
      return [];
    }

    const searchTerm = query.toLowerCase().trim();

    return stops
      .filter((stop) => {
        return (
          (stop.stop_name &&
            stop.stop_name.toLowerCase().includes(searchTerm)) ||
          (stop.stop_id && stop.stop_id.toLowerCase().includes(searchTerm)) ||
          (stop.stop_code &&
            stop.stop_code.toLowerCase().includes(searchTerm)) ||
          (stop.stop_desc && stop.stop_desc.toLowerCase().includes(searchTerm))
        );
      })
      .slice(0, 10); // Limit to 10 results
  }

  searchRoutes(query: string) {
    const routes = this.getFileData('routes.txt') || [];
    if (!query || query.trim().length < 2) {
      return [];
    }

    const searchTerm = query.toLowerCase().trim();

    return routes
      .filter((route) => {
        return (
          (route.route_short_name &&
            route.route_short_name.toLowerCase().includes(searchTerm)) ||
          (route.route_long_name &&
            route.route_long_name.toLowerCase().includes(searchTerm)) ||
          (route.route_id &&
            route.route_id.toLowerCase().includes(searchTerm)) ||
          (route.route_desc &&
            route.route_desc.toLowerCase().includes(searchTerm))
        );
      })
      .slice(0, 10); // Limit to 10 results
  }

  searchAll(query: string) {
    if (!query || query.trim().length < 2) {
      return { stops: [], routes: [] };
    }

    return {
      stops: this.searchStops(query),
      routes: this.searchRoutes(query),
    };
  }
}
