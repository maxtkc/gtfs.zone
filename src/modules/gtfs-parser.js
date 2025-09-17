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

export class GTFSParser {
  constructor() {
    this.gtfsData = {};
  }

  async parseFile(file) {
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
            data: parsed.data,
            errors: parsed.errors,
          };
        } else if (fileName.endsWith('.geojson')) {
          // Handle GeoJSON files
          this.gtfsData[fileName] = {
            content: fileContent,
            data: JSON.parse(fileContent),
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

  async parseFromURL(url) {
    try {
      console.log('Loading GTFS from URL:', url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      return await this.parseFile(blob);
    } catch (error) {
      console.error('Error loading GTFS from URL:', error);
      throw error;
    }
  }

  updateFileContent(fileName, content) {
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

  getFileContent(fileName) {
    return this.gtfsData[fileName]?.content || '';
  }

  getFileData(fileName) {
    return this.gtfsData[fileName]?.data || null;
  }

  getAllFileNames() {
    return Object.keys(this.gtfsData);
  }

  categorizeFiles() {
    const allFiles = this.getAllFileNames();
    return {
      required: allFiles.filter((f) => GTFS_FILES.required.includes(f)),
      optional: allFiles.filter((f) => GTFS_FILES.optional.includes(f)),
      other: allFiles.filter(
        (f) => !GTFS_FILES.required.includes(f) && !GTFS_FILES.optional.includes(f)
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

  getRoutesForStop(stopId) {
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

  getWheelchairText(wheelchairBoarding) {
    switch (wheelchairBoarding) {
      case '1':
        return 'Accessible';
      case '2':
        return 'Not accessible';
      default:
        return 'Unknown';
    }
  }

  getRouteTypeText(routeType) {
    const types = {
      0: 'Tram/Streetcar',
      1: 'Subway/Metro',
      2: 'Rail',
      3: 'Bus',
      4: 'Ferry',
      5: 'Cable Tram',
      6: 'Aerial Lift',
      7: 'Funicular',
      11: 'Trolleybus',
      12: 'Monorail',
    };
    return types[routeType] || `Type ${routeType}`;
  }
}