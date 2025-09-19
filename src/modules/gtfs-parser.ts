import JSZip from 'jszip';
import Papa from 'papaparse';
import type { 
  Agency, 
  Stops, 
  Routes, 
  Trips, 
  StopTimes, 
  Calendar,
  GTFSRecord
} from '../types/gtfs.js';

// Legacy GTFS file definitions for backward compatibility
export const GTFS_FILES_LEGACY = {
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

export interface GTFSFileData {
  content: string;
  data: GTFSRecord[];
  errors: string[];
}

export interface GTFSData {
  [fileName: string]: GTFSFileData;
}

export interface FileCategorization {
  required: string[];
  optional: string[];
  present: string[];
  missing: string[];
}

export interface SearchResult {
  type: 'stop' | 'route';
  id: string;
  name: string;
  description?: string;
  file: string;
  data: GTFSRecord;
}

export class GTFSParser {
  public gtfsData: GTFSData;

  constructor() {
    this.gtfsData = {};
  }

  public initializeEmpty(): void {
    // Initialize with realistic sample GTFS structure
    const sampleData = {
      'agency.txt': [
        {
          agencyId: 'metro-transit',
          agencyName: 'Metro Transit',
          agencyUrl: 'https://metro.example.com',
          agencyTimezone: 'America/New_York'
        },
        {
          agencyId: 'city-bus',
          agencyName: 'City Bus',
          agencyUrl: 'https://citybus.example.com',
          agencyTimezone: 'America/New_York'
        }
      ] as Agency[],
      'routes.txt': [
        {
          routeId: 'metro-1',
          agencyId: 'metro-transit',
          routeShortName: '1',
          routeLongName: 'Downtown Express',
          routeType: 3
        },
        {
          routeId: 'metro-2',
          agencyId: 'metro-transit',
          routeShortName: '2',
          routeLongName: 'Uptown Local',
          routeType: 3
        },
        {
          routeId: 'city-a',
          agencyId: 'city-bus',
          routeShortName: 'A',
          routeLongName: 'Airport Shuttle',
          routeType: 3
        },
        {
          routeId: 'city-b',
          agencyId: 'city-bus',
          routeShortName: 'B',
          routeLongName: 'Beach Route',
          routeType: 3
        }
      ] as Routes[],
      'trips.txt': [
        {
          routeId: 'metro-1',
          serviceId: 'weekday',
          tripId: 'metro-1-downtown',
          tripHeadsign: 'Downtown'
        },
        {
          routeId: 'metro-1',
          serviceId: 'weekday',
          tripId: 'metro-1-uptown',
          tripHeadsign: 'Uptown'
        },
        {
          routeId: 'metro-2',
          serviceId: 'weekday',
          tripId: 'metro-2-local',
          tripHeadsign: 'Local Service'
        },
        {
          routeId: 'city-a',
          serviceId: 'everyday',
          tripId: 'city-a-airport',
          tripHeadsign: 'Airport Terminal'
        }
      ] as Trips[],
      'stops.txt': [
        {
          stopId: 'downtown-station',
          stopName: 'Downtown Station',
          stopLat: 40.7128,
          stopLon: -74.0060
        },
        {
          stopId: 'main-street',
          stopName: 'Main Street & 5th Ave',
          stopLat: 40.7614,
          stopLon: -73.9776
        },
        {
          stopId: 'uptown-plaza',
          stopName: 'Uptown Plaza',
          stopLat: 40.7831,
          stopLon: -73.9712
        },
        {
          stopId: 'airport-terminal',
          stopName: 'Airport Terminal',
          stopLat: 40.6892,
          stopLon: -74.1745
        },
        {
          stopId: 'beach-pier',
          stopName: 'Beach Pier',
          stopLat: 40.5795,
          stopLon: -73.8370
        }
      ] as Stops[],
      'stop_times.txt': [
        // Metro Route 1 - Downtown
        {
          tripId: 'metro-1-downtown',
          arrivalTime: '08:00:00',
          departureTime: '08:00:00',
          stopId: 'uptown-plaza',
          stopSequence: 1
        },
        {
          tripId: 'metro-1-downtown',
          arrivalTime: '08:15:00',
          departureTime: '08:15:00',
          stopId: 'main-street',
          stopSequence: 2
        },
        {
          tripId: 'metro-1-downtown',
          arrivalTime: '08:30:00',
          departureTime: '08:30:00',
          stopId: 'downtown-station',
          stopSequence: 3
        },
        // City Route A - Airport
        {
          tripId: 'city-a-airport',
          arrivalTime: '09:00:00',
          departureTime: '09:00:00',
          stopId: 'downtown-station',
          stopSequence: 1
        },
        {
          tripId: 'city-a-airport',
          arrivalTime: '09:45:00',
          departureTime: '09:45:00',
          stopId: 'airport-terminal',
          stopSequence: 2
        }
      ] as StopTimes[],
      'calendar.txt': [
        {
          serviceId: 'weekday',
          monday: 1,
          tuesday: 1,
          wednesday: 1,
          thursday: 1,
          friday: 1,
          saturday: 0,
          sunday: 0,
          startDate: '20240101',
          endDate: '20241231'
        },
        {
          serviceId: 'everyday',
          monday: 1,
          tuesday: 1,
          wednesday: 1,
          thursday: 1,
          friday: 1,
          saturday: 1,
          sunday: 1,
          startDate: '20240101',
          endDate: '20241231'
        }
      ] as Calendar[]
    };

    // Convert to expected format with content and data properties
    this.gtfsData = {};
    for (const [fileName, data] of Object.entries(sampleData)) {
      // Generate CSV content for each file
      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        const csvContent = [
          headers.join(','),
          ...data.map(row => headers.map(header => (row as any)[header] || '').join(','))
        ].join('\n');
        
        this.gtfsData[fileName] = {
          content: csvContent,
          data: data as GTFSRecord[],
          errors: []
        };
      }
    }
    
    console.log('Initialized empty GTFS feed with sample data');
    console.log('Final gtfsData structure:', this.gtfsData);
  }

  public async parseFile(file: File): Promise<void> {
    try {
      console.log('Loading GTFS file:', file.name);

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
            data: parsed.data as GTFSRecord[],
            errors: parsed.errors.map((err: any) => err.message || String(err))
          };
        } else if (fileName.endsWith('.geojson')) {
          // Handle GeoJSON files
          try {
            const jsonData = JSON.parse(fileContent);
            this.gtfsData[fileName] = {
              content: fileContent,
              data: [jsonData] as GTFSRecord[],
              errors: []
            };
          } catch (jsonError) {
            this.gtfsData[fileName] = {
              content: fileContent,
              data: [],
              errors: [`Invalid JSON: ${jsonError}`]
            };
          }
        }
      }

      console.log('GTFS data loaded successfully');
    } catch (error) {
      console.error('Error loading GTFS file:', error);
      throw error;
    }
  }

  public async parseFromURL(url: string): Promise<void> {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const file = new File([blob], 'gtfs.zip', { type: 'application/zip' });
      
      await this.parseFile(file);
    } catch (error) {
      console.error('Error loading GTFS from URL:', error);
      throw error;
    }
  }

  public updateFileContent(fileName: string, content: string): void {
    if (this.gtfsData[fileName]) {
      this.gtfsData[fileName].content = content;
      
      // Re-parse the CSV content
      if (fileName.endsWith('.txt')) {
        const parsed = Papa.parse(content, {
          header: true,
          skipEmptyLines: true,
        });
        
        this.gtfsData[fileName].data = parsed.data as GTFSRecord[];
        this.gtfsData[fileName].errors = parsed.errors.map((err: any) => err.message || String(err));
      }
    }
  }

  public getFileContent(fileName: string): string | null {
    return this.gtfsData[fileName]?.content || null;
  }

  public getFileData(fileName: string): GTFSRecord[] | null {
    return this.gtfsData[fileName]?.data || null;
  }

  public getAllFileNames(): string[] {
    return Object.keys(this.gtfsData);
  }

  public categorizeFiles(): FileCategorization {
    const present = this.getAllFileNames();
    const required = GTFS_FILES_LEGACY.required.filter(file => present.includes(file));
    const optional = GTFS_FILES_LEGACY.optional.filter(file => present.includes(file));
    const missing = GTFS_FILES_LEGACY.required.filter(file => !present.includes(file));

    return { required, optional, present, missing };
  }

  public async exportAsZip(): Promise<Blob> {
    const zip = new JSZip();

    for (const [fileName, fileData] of Object.entries(this.gtfsData)) {
      zip.file(fileName, fileData.content);
    }

    return await zip.generateAsync({ type: 'blob' });
  }

  public getRoutesForStop(stopId: string): any[] {
    const routes = this.getFileData('routes.txt') as Routes[] || [];
    const trips = this.getFileData('trips.txt') as Trips[] || [];
    const stopTimes = this.getFileData('stop_times.txt') as StopTimes[] || [];

    if (!routes || !trips || !stopTimes) {
      return [];
    }

    // Find all trips that serve this stop
    const tripsAtStop = stopTimes
      .filter((st: any) => st.stop_id === stopId || st.stopId === stopId)
      .map((st: any) => st.trip_id || st.tripId);

    // Find routes for these trips
    const routeIds = new Set(
      trips
        .filter((trip: any) => tripsAtStop.includes(trip.trip_id || trip.tripId))
        .map((trip: any) => trip.route_id || trip.routeId)
    );

    return routes.filter((route: any) => routeIds.has(route.route_id || route.routeId));
  }

  public getWheelchairText(wheelchairBoarding: number | string): string {
    switch (String(wheelchairBoarding)) {
      case '0': return 'No information';
      case '1': return 'Accessible';
      case '2': return 'Not accessible';
      default: return 'No information';
    }
  }

  public getRouteTypeText(routeType: number | string): string {
    const types: { [key: string]: string } = {
      '0': 'Tram, Streetcar, Light rail',
      '1': 'Subway, Metro',
      '2': 'Rail',
      '3': 'Bus',
      '4': 'Ferry',
      '5': 'Cable tram',
      '6': 'Aerial lift, suspended cable car',
      '7': 'Funicular',
      '11': 'Trolleybus',
      '12': 'Monorail'
    };
    return types[String(routeType)] || 'Unknown';
  }

  public searchStops(query: string): SearchResult[] {
    const stops = this.getFileData('stops.txt') as Stops[] || [];
    const lowerQuery = query.toLowerCase();

    return stops
      .filter((stop: any) => {
        const name = (stop.stop_name || stop.stopName || '').toLowerCase();
        const id = (stop.stop_id || stop.stopId || '').toLowerCase();
        const desc = (stop.stop_desc || stop.stopDesc || '').toLowerCase();
        
        return name.includes(lowerQuery) || id.includes(lowerQuery) || desc.includes(lowerQuery);
      })
      .map((stop: any) => ({
        type: 'stop' as const,
        id: stop.stop_id || stop.stopId,
        name: stop.stop_name || stop.stopName,
        description: stop.stop_desc || stop.stopDesc,
        file: 'stops.txt',
        data: stop
      }));
  }

  public searchRoutes(query: string): SearchResult[] {
    const routes = this.getFileData('routes.txt') as Routes[] || [];
    const lowerQuery = query.toLowerCase();

    return routes
      .filter((route: any) => {
        const shortName = (route.route_short_name || route.routeShortName || '').toLowerCase();
        const longName = (route.route_long_name || route.routeLongName || '').toLowerCase();
        const id = (route.route_id || route.routeId || '').toLowerCase();
        const desc = (route.route_desc || route.routeDesc || '').toLowerCase();
        
        return shortName.includes(lowerQuery) || longName.includes(lowerQuery) || 
               id.includes(lowerQuery) || desc.includes(lowerQuery);
      })
      .map((route: any) => ({
        type: 'route' as const,
        id: route.route_id || route.routeId,
        name: `${route.route_short_name || route.routeShortName} - ${route.route_long_name || route.routeLongName}`,
        description: route.route_desc || route.routeDesc,
        file: 'routes.txt',
        data: route
      }));
  }

  public searchAll(query: string): SearchResult[] {
    return [
      ...this.searchStops(query),
      ...this.searchRoutes(query)
    ];
  }
}