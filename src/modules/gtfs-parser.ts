import JSZip from 'jszip';
import Papa from 'papaparse';
import { GTFSDatabase, GTFSDatabaseRecord } from './gtfs-database.js';
import { GTFS_FILES, GTFSFilePresence } from '../types/gtfs.js';
import { loadingStateManager } from './loading-state-manager.js';
import { GTFSTableMap } from '../types/gtfs-entities.js';

interface GTFSFileData<T = GTFSDatabaseRecord> {
  content: string;
  data: T[];
  errors: Papa.ParseError[];
}

// Type-safe table name to entity type mapping
type GTFSTableName = keyof GTFSTableMap;

export class GTFSParser {
  private gtfsData: { [fileName: string]: GTFSFileData } = {};
  public gtfsDatabase: GTFSDatabase;

  constructor() {
    this.gtfsData = {};
    this.gtfsDatabase = new GTFSDatabase();
  }

  async initialize(): Promise<void> {
    await this.gtfsDatabase.initialize();
  }

  async initializeEmpty(): Promise<void> {
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

    // Clear existing data from database
    await this.gtfsDatabase.clearDatabase();

    // Convert to expected format with content and data properties
    this.gtfsData = {};
    for (const [fileName, data] of Object.entries(sampleData)) {
      // Generate CSV content for each file
      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        const csvContent = [
          headers.join(','),
          ...data.map((row: GTFSDatabaseRecord) =>
            headers.map((header) => row[header] || '').join(',')
          ),
        ].join('\n');

        this.gtfsData[fileName] = {
          content: csvContent,
          data: data,
          errors: [],
        };

        // Store in IndexedDB
        const tableName = this.getTableName(fileName);
        const rows = data as GTFSDatabaseRecord[];
        await this.gtfsDatabase.insertRows(tableName, rows);
      }
    }

    // Update project metadata
    await this.gtfsDatabase.updateProjectMetadata({
      name: 'Sample GTFS Feed',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      fileCount: Object.keys(sampleData).length,
    });

    // eslint-disable-next-line no-console
    console.log('Initialized empty GTFS feed with sample data');
    // eslint-disable-next-line no-console
    console.log('Final gtfsData structure:', this.gtfsData);
  }

  async parseFile(
    file: File | Blob
  ): Promise<{ [fileName: string]: GTFSFileData }> {
    const operation = 'parseFile';

    try {
      // eslint-disable-next-line no-console
      console.log('Loading GTFS file:', (file as File).name || 'blob');

      // Start loading indicator
      loadingStateManager.startLoading(operation, 'Loading GTFS file...');

      // Clear existing data from database
      loadingStateManager.updateProgress(
        operation,
        10,
        'Clearing existing data...'
      );
      await this.gtfsDatabase.clearDatabase();

      loadingStateManager.updateProgress(
        operation,
        20,
        'Extracting ZIP file...'
      );
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);

      // Parse all text files in the ZIP
      const files = Object.keys(zipContent.files).filter(
        (name) => name.endsWith('.txt') || name.endsWith('.geojson')
      );

      this.gtfsData = {};
      const totalFiles = files.length;

      for (let i = 0; i < files.length; i++) {
        const fileName = files[i];
        const progress = 20 + 60 * (i / totalFiles); // 20-80% for file processing

        loadingStateManager.updateProgress(
          operation,
          progress,
          `Processing ${fileName}...`
        );
        const fileContent = await zipContent.files[fileName].async('text');

        if (fileName.endsWith('.txt')) {
          // Parse CSV files
          const parsed = Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
          });

          // Store in memory for compatibility
          this.gtfsData[fileName] = {
            content: fileContent,
            data: parsed.data,
            errors: parsed.errors,
          };

          // Store in IndexedDB
          const tableName = this.getTableName(fileName);
          const rows = parsed.data as GTFSDatabaseRecord[];
          if (rows.length > 0) {
            loadingStateManager.updateProgress(
              operation,
              progress + 5,
              `Storing ${fileName} (${rows.length} records)...`
            );
            await this.gtfsDatabase.insertRows(tableName, rows);
          }
        } else if (fileName.endsWith('.geojson')) {
          // Handle GeoJSON files
          this.gtfsData[fileName] = {
            content: fileContent,
            data: JSON.parse(fileContent),
            errors: [],
          };

          // Store GeoJSON in IndexedDB as well
          const tableName = this.getTableName(fileName);
          const geoJsonData = JSON.parse(fileContent);
          await this.gtfsDatabase.insertRows(tableName, [
            geoJsonData as GTFSDatabaseRecord,
          ]);
        }
      }

      // Update project metadata
      loadingStateManager.updateProgress(operation, 90, 'Finalizing...');
      await this.gtfsDatabase.updateProjectMetadata({
        name: (file as File).name || 'Uploaded GTFS',
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        fileCount: files.length,
      });

      loadingStateManager.updateProgress(operation, 100, 'Complete!');
      loadingStateManager.finishLoading(operation);
      loadingStateManager.showSuccess(
        `Successfully loaded ${files.length} GTFS files`
      );

      // eslint-disable-next-line no-console
      console.log('Loaded GTFS data to IndexedDB and memory:', this.gtfsData);
      return this.gtfsData;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error loading GTFS file:', error);
      loadingStateManager.finishLoading(operation);
      loadingStateManager.showError(
        `Failed to load GTFS file: ${error.message}`
      );
      throw error;
    }
  }

  private getTableName(fileName: string): string {
    return fileName.replace('.txt', '').replace('.geojson', '');
  }

  // Type-safe helper to get table name as GTFSTableName
  private getTypedTableName(fileName: string): GTFSTableName | null {
    const tableName = this.getTableName(fileName);
    // Check if the table name is a valid GTFS entity type
    if (tableName in ({} as GTFSTableMap)) {
      return tableName as GTFSTableName;
    }
    return null;
  }

  // Type-safe parsing method that returns properly typed entities
  private parseCSVWithType<T extends keyof GTFSTableMap>(
    content: string,
    _tableName: T
  ): { data: GTFSTableMap[T][]; errors: Papa.ParseError[] } {
    const parsed = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
    });

    return {
      data: parsed.data as GTFSTableMap[T][],
      errors: parsed.errors,
    };
  }

  async parseFromURL(url: string): Promise<void> {
    try {
      // eslint-disable-next-line no-console
      console.log('Loading GTFS from URL:', url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      await this.parseFile(blob);
      return;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error loading GTFS from URL:', error);
      throw error;
    }
  }

  async updateFileContent(fileName: string, content: string): Promise<void> {
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

        // Update IndexedDB with new data
        const tableName = this.getTableName(fileName);

        // Clear existing rows for this table
        await this.gtfsDatabase.clearTable(tableName);

        // Insert new rows
        const rows = parsed.data as GTFSDatabaseRecord[];
        if (rows.length > 0) {
          await this.gtfsDatabase.insertRows(tableName, rows);
        }
      } else if (fileName.endsWith('.geojson')) {
        // Handle GeoJSON updates
        this.gtfsData[fileName].data = JSON.parse(content);

        const tableName = this.getTableName(fileName);
        // Clear and re-insert GeoJSON data
        await this.gtfsDatabase.clearTable(tableName);

        const geoJsonData = JSON.parse(content);
        await this.gtfsDatabase.insertRows(tableName, [
          geoJsonData as GTFSDatabaseRecord,
        ]);
      }
    }
  }

  getFileContent(fileName: string): string {
    return this.gtfsData[fileName]?.content || '';
  }

  // Method expected by Editor interface
  updateFileInMemory(fileName: string, content: string): void {
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

  // Method expected by Editor interface
  async refreshRelatedTables(fileName: string): Promise<void> {
    // This could trigger relationship validation or cache refresh
    // For now, just update the database
    await this.updateFileContent(fileName, this.getFileContent(fileName));
  }

  async getFileData(fileName: string): Promise<GTFSDatabaseRecord[] | null> {
    // Try to get from IndexedDB first
    try {
      const tableName = this.getTableName(fileName);
      const rows = await this.gtfsDatabase.getAllRows(tableName);
      if (rows.length > 0) {
        return rows;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(
        `Failed to get data from IndexedDB for ${fileName}, falling back to memory:`,
        error
      );
    }

    // Fallback to memory
    return this.gtfsData[fileName]?.data || null;
  }

  // Type-safe async file data retrieval
  async getFileDataTyped<T extends GTFSTableName>(
    fileName: `${T}.txt`
  ): Promise<GTFSTableMap[T][] | null> {
    const data = await this.getFileData(fileName);
    return data as GTFSTableMap[T][] | null;
  }

  // Synchronous version for backward compatibility (will use memory data)
  getFileDataSync(fileName: string): GTFSDatabaseRecord[] | null {
    return this.gtfsData[fileName]?.data || null;
  }

  // Type-safe synchronous file data retrieval
  getFileDataSyncTyped<T extends GTFSTableName>(
    fileName: `${T}.txt`
  ): GTFSTableMap[T][] | null {
    const data = this.getFileDataSync(fileName);
    return data as GTFSTableMap[T][] | null;
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
    const requiredFiles = GTFS_FILES.filter(
      (f) => f.presence === GTFSFilePresence.Required
    ).map((f) => f.filename);
    const optionalFiles = GTFS_FILES.filter(
      (f) =>
        f.presence === GTFSFilePresence.Optional ||
        f.presence === GTFSFilePresence.ConditionallyRequired
    ).map((f) => f.filename);

    return {
      required: allFiles.filter((f) => requiredFiles.includes(f)),
      optional: allFiles.filter((f) => optionalFiles.includes(f)),
      other: allFiles.filter(
        (f) => !requiredFiles.includes(f) && !optionalFiles.includes(f)
      ),
    };
  }

  async exportAsZip() {
    try {
      // Get all available files from memory (for file list)
      const fileNames = Object.keys(this.gtfsData);

      if (fileNames.length === 0) {
        throw new Error('No GTFS data to export');
      }

      const zip = new JSZip();

      for (const fileName of fileNames) {
        try {
          // Get data from IndexedDB first
          const tableName = this.getTableName(fileName);
          const rows = await this.gtfsDatabase.getAllRows(tableName);

          if (rows.length > 0) {
            // Generate CSV content from IndexedDB data
            let csvContent = '';

            if (fileName.endsWith('.txt')) {
              // Create CSV content from natural key data (no auto-increment id to remove)
              if (rows.length > 0) {
                const headers = Object.keys(rows[0]);
                csvContent = [
                  headers.join(','),
                  ...rows.map((row) =>
                    headers.map((header) => row[header] || '').join(',')
                  ),
                ].join('\n');
              }
            } else if (fileName.endsWith('.geojson')) {
              // For GeoJSON, use the stored data directly
              csvContent = JSON.stringify(rows[0], null, 2);
            }

            zip.file(fileName, csvContent);
          } else {
            // Fallback to memory content if IndexedDB is empty
            // eslint-disable-next-line no-console
            console.warn(
              `No data in IndexedDB for ${fileName}, using memory content`
            );
            zip.file(fileName, this.gtfsData[fileName].content);
          }
        } catch (dbError) {
          // Fallback to memory content if IndexedDB fails
          // eslint-disable-next-line no-console
          console.warn(
            `IndexedDB error for ${fileName}, using memory content:`,
            dbError
          );
          zip.file(fileName, this.gtfsData[fileName].content);
        }
      }

      return await zip.generateAsync({ type: 'blob' });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error exporting GTFS data:', error);
      throw error;
    }
  }

  getRoutesForStop(stop_id: string) {
    const routes = this.getFileDataSyncTyped('routes.txt');
    const trips = this.getFileDataSyncTyped('trips.txt');
    const stopTimes = this.getFileDataSyncTyped('stop_times.txt');

    if (!routes || !trips || !stopTimes) {
      return [];
    }

    // Find trips that serve this stop
    const tripsAtStop = stopTimes
      .filter((st) => st.stop_id === stop_id)
      .map((st) => st.trip_id);

    // Find routes for those trips
    const route_ids = [
      ...new Set(
        trips
          .filter((trip) => tripsAtStop.includes(trip.trip_id))
          .map((trip) => trip.route_id)
      ),
    ];

    return routes.filter((route) => route_ids.includes(route.route_id));
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
    const stops = this.getFileDataSyncTyped('stops.txt') || [];
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
    const routes = this.getFileDataSyncTyped('routes.txt') || [];
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

  // Async versions of search methods that use IndexedDB
  async searchStopsAsync(query: string) {
    const stops = (await this.getFileDataTyped('stops.txt')) || [];
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

  async searchRoutesAsync(query: string) {
    const routes = (await this.getFileDataTyped('routes.txt')) || [];
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

  async searchAllAsync(query: string) {
    if (!query || query.trim().length < 2) {
      return { stops: [], routes: [] };
    }

    return {
      stops: await this.searchStopsAsync(query),
      routes: await this.searchRoutesAsync(query),
    };
  }

  async getRoutesForStopAsync(stop_id: string) {
    const routes = await this.getFileDataTyped('routes.txt');
    const trips = await this.getFileDataTyped('trips.txt');
    const stopTimes = await this.getFileDataTyped('stop_times.txt');

    if (!routes || !trips || !stopTimes) {
      return [];
    }

    // Find trips that serve this stop
    const tripsAtStop = stopTimes
      .filter((st) => st.stop_id === stop_id)
      .map((st) => st.trip_id);

    // Find routes for those trips
    const route_ids = [
      ...new Set(
        trips
          .filter((trip) => tripsAtStop.includes(trip.trip_id))
          .map((trip) => trip.route_id)
      ),
    ];

    return routes.filter((route) => route_ids.includes(route.route_id));
  }

  /**
   * Get the GTFS database instance for external use
   */
  getDatabase(): GTFSDatabase {
    return this.gtfsDatabase;
  }
}
