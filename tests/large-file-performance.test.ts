/**
 * Large File Import and Performance Tests
 * Tests handling of 30MB+ files and performance benchmarks
 */
import { test, expect } from '@playwright/test';

test.describe('Large File Import Performance Tests', () => {
  let page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto('/');

    // Wait for application to be ready
    await page.waitForSelector('#file-input');
  });

  test('should handle large GTFS file import (simulated 30MB+)', async () => {
    const performanceResults = await page.evaluate(async () => {
      // Create a large synthetic GTFS dataset
      const generateLargeGTFSData = () => {
        const data = {
          'agency.txt': [],
          'routes.txt': [],
          'stops.txt': [],
          'trips.txt': [],
          'stop_times.txt': [],
          'calendar.txt': [],
          'shapes.txt': []
        };

        // Generate agencies (10)
        for (let i = 0; i < 10; i++) {
          data['agency.txt'].push({
            agency_id: `AGENCY_${i}`,
            agency_name: `Transit Agency ${i}`,
            agency_url: `https://agency${i}.example.com`,
            agency_timezone: 'America/Los_Angeles'
          });
        }

        // Generate routes (500)
        for (let i = 0; i < 500; i++) {
          data['routes.txt'].push({
            route_id: `ROUTE_${i}`,
            agency_id: `AGENCY_${i % 10}`,
            route_short_name: `${i}`,
            route_long_name: `Route ${i} - Main Street to Downtown`,
            route_type: '3',
            route_color: 'FF0000',
            route_text_color: 'FFFFFF'
          });
        }

        // Generate stops (10,000)
        for (let i = 0; i < 10000; i++) {
          data['stops.txt'].push({
            stop_id: `STOP_${i}`,
            stop_name: `Stop ${i} - ${Math.random() > 0.5 ? 'Main St' : 'Central Ave'} & ${i}th St`,
            stop_desc: `Bus stop located at the intersection of ${Math.random() > 0.5 ? 'Main St' : 'Central Ave'} and ${i}th Street`,
            stop_lat: (45.5 + (Math.random() - 0.5) * 0.1).toFixed(6),
            stop_lon: (-122.6 + (Math.random() - 0.5) * 0.1).toFixed(6),
            location_type: '0',
            wheelchair_boarding: Math.floor(Math.random() * 3).toString()
          });
        }

        // Generate trips (5,000)
        for (let i = 0; i < 5000; i++) {
          data['trips.txt'].push({
            route_id: `ROUTE_${i % 500}`,
            service_id: `SERVICE_${i % 100}`,
            trip_id: `TRIP_${i}`,
            trip_headsign: `Downtown via ${Math.random() > 0.5 ? 'Main' : 'Central'}`,
            direction_id: (i % 2).toString(),
            shape_id: `SHAPE_${i % 1000}`
          });
        }

        // Generate stop_times (50,000 - 10 stops per trip average)
        for (let tripIdx = 0; tripIdx < 5000; tripIdx++) {
          const stopsPerTrip = 8 + Math.floor(Math.random() * 5); // 8-12 stops per trip
          for (let stopSeq = 0; stopSeq < stopsPerTrip; stopSeq++) {
            const baseTime = 6 * 3600 + Math.floor(Math.random() * 16 * 3600); // 6 AM to 10 PM
            const arrivalTime = baseTime + (stopSeq * 120); // 2 minutes between stops
            const departureTime = arrivalTime + 30; // 30 second dwell time

            data['stop_times.txt'].push({
              trip_id: `TRIP_${tripIdx}`,
              arrival_time: formatTime(arrivalTime),
              departure_time: formatTime(departureTime),
              stop_id: `STOP_${Math.floor(Math.random() * 10000)}`,
              stop_sequence: stopSeq.toString(),
              pickup_type: '0',
              drop_off_type: '0'
            });
          }
        }

        // Generate calendar (100 services)
        for (let i = 0; i < 100; i++) {
          data['calendar.txt'].push({
            service_id: `SERVICE_${i}`,
            monday: '1',
            tuesday: '1',
            wednesday: '1',
            thursday: '1',
            friday: '1',
            saturday: i % 3 === 0 ? '1' : '0',
            sunday: i % 5 === 0 ? '1' : '0',
            start_date: '20240101',
            end_date: '20241231'
          });
        }

        // Generate shapes (1,000 shapes with 50 points each = 50,000 points)
        for (let shapeIdx = 0; shapeIdx < 1000; shapeIdx++) {
          const baseLatitude = 45.5 + (Math.random() - 0.5) * 0.1;
          const baseLongitude = -122.6 + (Math.random() - 0.5) * 0.1;

          for (let pointIdx = 0; pointIdx < 50; pointIdx++) {
            data['shapes.txt'].push({
              shape_id: `SHAPE_${shapeIdx}`,
              shape_pt_lat: (baseLatitude + pointIdx * 0.001).toFixed(6),
              shape_pt_lon: (baseLongitude + pointIdx * 0.0008).toFixed(6),
              shape_pt_sequence: pointIdx.toString(),
              shape_dist_traveled: (pointIdx * 100).toString()
            });
          }
        }

        return data;
      };

      const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      };

      console.log('Generating large GTFS dataset...');
      const startGeneration = performance.now();
      const largeGTFSData = generateLargeGTFSData();
      const endGeneration = performance.now();

      // Calculate total size
      let totalRecords = 0;
      let estimatedSize = 0;

      Object.entries(largeGTFSData).forEach(([fileName, records]) => {
        totalRecords += records.length;
        // Estimate size (rough calculation)
        const sampleRecord = JSON.stringify(records[0] || {});
        estimatedSize += sampleRecord.length * records.length;
      });

      console.log(`Generated ${totalRecords} records, estimated size: ${Math.round(estimatedSize / 1024 / 1024 * 100) / 100}MB`);

      // Simulate database import
      const { GTFSDatabase } = await import('/src/modules/gtfs-database.js');
      const database = new GTFSDatabase();
      await database.initialize();

      console.log('Starting database import...');
      const startImport = performance.now();

      // Import each table
      for (const [fileName, records] of Object.entries(largeGTFSData)) {
        if (records.length > 0) {
          const tableName = fileName.replace('.txt', '');
          console.log(`Importing ${tableName}: ${records.length} records`);

          const tableStartTime = performance.now();
          await database.insertRows(tableName, records);
          const tableEndTime = performance.now();

          console.log(`${tableName} imported in ${Math.round(tableEndTime - tableStartTime)}ms`);
        }
      }

      const endImport = performance.now();

      // Verify data integrity
      console.log('Verifying data integrity...');
      const startVerification = performance.now();
      const stats = await database.getDatabaseStats();
      const endVerification = performance.now();

      // Test query performance on large dataset
      console.log('Testing query performance...');
      const startQuery = performance.now();
      const sampleQueryResults = await database.queryRows('stops', { wheelchair_boarding: '1' });
      const endQuery = performance.now();

      // Test search performance
      const startSearch = performance.now();
      const searchResults = await database.searchAllTables('Main', 100);
      const endSearch = performance.now();

      // Clean up
      await database.clearDatabase();
      database.close();

      return {
        generation: {
          time: endGeneration - startGeneration,
          records: totalRecords,
          estimatedSizeMB: Math.round(estimatedSize / 1024 / 1024 * 100) / 100
        },
        import: {
          time: endImport - startImport,
          recordsPerSecond: Math.round(totalRecords / ((endImport - startImport) / 1000))
        },
        verification: {
          time: endVerification - startVerification,
          tablesVerified: Object.keys(stats.tables).length,
          totalRecordsVerified: Object.values(stats.tables).reduce((sum, count) => sum + count, 0)
        },
        queryPerformance: {
          time: endQuery - startQuery,
          resultsFound: sampleQueryResults.length
        },
        searchPerformance: {
          time: endSearch - startSearch,
          tablesSearched: Object.keys(searchResults).length
        }
      };
    });

    // Assertions for performance benchmarks
    expect(performanceResults.generation.records).toBeGreaterThan(70000); // Should generate 70k+ records
    expect(performanceResults.generation.estimatedSizeMB).toBeGreaterThan(25); // Should be 25MB+

    expect(performanceResults.import.time).toBeLessThan(60000); // Should import within 60 seconds
    expect(performanceResults.import.recordsPerSecond).toBeGreaterThan(1000); // Should process 1000+ records/sec

    expect(performanceResults.verification.totalRecordsVerified).toBe(performanceResults.generation.records);

    expect(performanceResults.queryPerformance.time).toBeLessThan(1000); // Queries should be under 1 second
    expect(performanceResults.searchPerformance.time).toBeLessThan(2000); // Search should be under 2 seconds

    console.log('Performance test results:', performanceResults);
  });

  test('should handle memory-intensive operations without blocking UI', async () => {
    const memoryTest = await page.evaluate(async () => {
      const results = {
        uiResponsive: true,
        memoryEfficient: true,
        operationsCompleted: 0
      };

      // Test UI responsiveness during heavy database operations
      let uiChecksPassed = 0;
      const uiCheckInterval = setInterval(() => {
        // Simulate UI interaction
        const button = document.querySelector('#export-btn');
        if (button && !button.disabled) {
          uiChecksPassed++;
        }
      }, 100);

      try {
        const { GTFSDatabase } = await import('/src/modules/gtfs-database.js');
        const database = new GTFSDatabase();
        await database.initialize();

        // Perform memory-intensive operations
        const operations = [];

        for (let batch = 0; batch < 10; batch++) {
          const data = Array.from({ length: 1000 }, (_, i) => ({
            stop_id: `MEMORY_TEST_${batch}_${i}`,
            stop_name: `Memory Test Stop ${batch}-${i}`,
            stop_desc: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10),
            stop_lat: (45.5 + Math.random() * 0.1).toFixed(6),
            stop_lon: (-122.6 + Math.random() * 0.1).toFixed(6)
          }));

          operations.push(database.insertRows('stops', data));

          // Yield control to the event loop
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        await Promise.all(operations);
        results.operationsCompleted = 10;

        // Check memory usage (rough estimate)
        const stats = await database.getDatabaseStats();
        const memoryUsageMB = stats.size / 1024 / 1024;
        results.memoryEfficient = memoryUsageMB < 100; // Should stay under 100MB

        await database.clearDatabase();
        database.close();

      } catch (error) {
        console.error('Memory test failed:', error);
        results.memoryEfficient = false;
      }

      clearInterval(uiCheckInterval);
      results.uiResponsive = uiChecksPassed > 5; // UI should remain responsive

      return results;
    });

    expect(memoryTest.operationsCompleted).toBe(10);
    expect(memoryTest.uiResponsive).toBe(true);
    expect(memoryTest.memoryEfficient).toBe(true);
  });

  test('should maintain performance with concurrent operations', async () => {
    const concurrencyTest = await page.evaluate(async () => {
      const { GTFSDatabase } = await import('/src/modules/gtfs-database.js');
      const database = new GTFSDatabase();
      await database.initialize();

      const startTime = performance.now();

      // Run multiple concurrent operations
      const concurrentOperations = [
        // Large insert operation
        database.insertRows('agencies', Array.from({ length: 1000 }, (_, i) => ({
          agency_id: `CONCURRENT_AGENCY_${i}`,
          agency_name: `Concurrent Agency ${i}`,
          agency_url: `https://concurrent${i}.example.com`
        }))),

        // Another large insert to different table
        database.insertRows('routes', Array.from({ length: 2000 }, (_, i) => ({
          route_id: `CONCURRENT_ROUTE_${i}`,
          agency_id: `CONCURRENT_AGENCY_${i % 1000}`,
          route_short_name: `${i}`,
          route_long_name: `Concurrent Route ${i}`,
          route_type: '3'
        }))),

        // Concurrent stops insert
        database.insertRows('stops', Array.from({ length: 5000 }, (_, i) => ({
          stop_id: `CONCURRENT_STOP_${i}`,
          stop_name: `Concurrent Stop ${i}`,
          stop_lat: (45.5 + Math.random() * 0.1).toFixed(6),
          stop_lon: (-122.6 + Math.random() * 0.1).toFixed(6)
        })))
      ];

      await Promise.all(concurrentOperations);
      const endTime = performance.now();

      // Verify all data was inserted correctly
      const [agencyCount, routeCount, stopCount] = await Promise.all([
        database.getAllRows('agencies'),
        database.getAllRows('routes'),
        database.getAllRows('stops')
      ]);

      await database.clearDatabase();
      database.close();

      return {
        totalTime: endTime - startTime,
        agenciesInserted: agencyCount.length,
        routesInserted: routeCount.length,
        stopsInserted: stopCount.length,
        totalRecords: agencyCount.length + routeCount.length + stopCount.length
      };
    });

    expect(concurrencyTest.agenciesInserted).toBe(1000);
    expect(concurrencyTest.routesInserted).toBe(2000);
    expect(concurrencyTest.stopsInserted).toBe(5000);
    expect(concurrencyTest.totalTime).toBeLessThan(30000); // Should complete within 30 seconds
    expect(concurrencyTest.totalRecords).toBe(8000);
  });
});