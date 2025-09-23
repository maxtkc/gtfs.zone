/**
 * Unit Tests for GTFSDatabase Class
 * Tests IndexedDB functionality, fallback behavior, and error handling
 */
import { test, expect } from '@playwright/test';

// Test data
const sampleAgencies = [
  { agency_id: 'TEST_AGENCY', agency_name: 'Test Transit Agency', agency_url: 'https://example.com' },
  { agency_id: 'METRO', agency_name: 'Metro Transit', agency_url: 'https://metro.example.com' }
];

const sampleRoutes = [
  { route_id: 'ROUTE_1', agency_id: 'TEST_AGENCY', route_short_name: '1', route_long_name: 'Main Street Line', route_type: '3' },
  { route_id: 'ROUTE_2', agency_id: 'METRO', route_short_name: '2', route_long_name: 'Central Avenue', route_type: '3' }
];

const sampleStops = [
  { stop_id: 'STOP_1', stop_name: 'Main & 1st', stop_lat: '45.5152', stop_lon: '-122.6784' },
  { stop_id: 'STOP_2', stop_name: 'Central Station', stop_lat: '45.5145', stop_lon: '-122.6789' }
];

test.describe('GTFSDatabase Unit Tests', () => {
  let page;
  let database;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto('/');

    // Initialize database for testing
    database = await page.evaluate(async () => {
      const { GTFSDatabase } = await import('/src/modules/gtfs-database.js');
      const db = new GTFSDatabase();
      await db.initialize();
      return db;
    });
  });

  test.afterEach(async () => {
    // Clean up database after each test
    await page.evaluate(async (db) => {
      if (db) {
        await db.clearDatabase();
        db.close();
      }
    }, database);
  });

  test.describe('Initialization and Setup', () => {
    test('should initialize database successfully', async () => {
      const isInitialized = await page.evaluate(async (db) => {
        return db !== null;
      }, database);

      expect(isInitialized).toBe(true);
    });

    test('should handle fallback mode when IndexedDB is unavailable', async () => {
      // Mock IndexedDB as unavailable
      const fallbackMode = await page.evaluate(async () => {
        // Temporarily disable IndexedDB
        const originalIndexedDB = window.indexedDB;
        delete window.indexedDB;

        const { GTFSDatabase } = await import('/src/modules/gtfs-database.js');
        const db = new GTFSDatabase();
        await db.initialize();
        const isFallback = db.isInFallbackMode();

        // Restore IndexedDB
        window.indexedDB = originalIndexedDB;

        return isFallback;
      });

      expect(fallbackMode).toBe(true);
    });
  });

  test.describe('Data Operations', () => {
    test('should insert and retrieve rows correctly', async () => {
      const result = await page.evaluate(async (db, agencies) => {
        await db.insertRows('agencies', agencies);
        const retrieved = await db.getAllRows('agencies');
        return retrieved;
      }, database, sampleAgencies);

      expect(result).toHaveLength(sampleAgencies.length);
      expect(result[0].agency_name).toBe(sampleAgencies[0].agency_name);
      expect(result[1].agency_name).toBe(sampleAgencies[1].agency_name);
    });

    test('should handle bulk insert operations efficiently', async () => {
      // Create large dataset
      const largeDataset = Array.from({ length: 5000 }, (_, i) => ({
        stop_id: \`STOP_\${i}\`,
        stop_name: \`Stop \${i}\`,
        stop_lat: (45.5 + Math.random() * 0.1).toString(),
        stop_lon: (-122.6 + Math.random() * 0.1).toString()
      }));

      const insertTime = await page.evaluate(async (db, data) => {
        const startTime = performance.now();
        await db.insertRows('stops', data);
        const endTime = performance.now();

        const count = await db.getAllRows('stops');
        return {
          insertTime: endTime - startTime,
          recordCount: count.length
        };
      }, database, largeDataset);

      expect(insertTime.recordCount).toBe(5000);
      expect(insertTime.insertTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    test('should update individual rows correctly', async () => {
      await page.evaluate(async (db, agencies) => {
        await db.insertRows('agencies', agencies);
      }, database, sampleAgencies);

      const updateResult = await page.evaluate(async (db) => {
        const rows = await db.getAllRows('agencies');
        const firstRow = rows[0];

        await db.updateRow('agencies', firstRow.id, { agency_name: 'Updated Agency Name' });

        const updatedRow = await db.getRow('agencies', firstRow.id);
        return updatedRow;
      }, database);

      expect(updateResult.agency_name).toBe('Updated Agency Name');
    });

    test('should query rows with filters using indexes', async () => {
      await page.evaluate(async (db, routes) => {
        await db.insertRows('routes', routes);
      }, database, sampleRoutes);

      const queryResult = await page.evaluate(async (db) => {
        return await db.queryRows('routes', { agency_id: 'TEST_AGENCY' });
      }, database);

      expect(queryResult).toHaveLength(1);
      expect(queryResult[0].route_short_name).toBe('1');
    });

    test('should handle search across multiple tables', async () => {
      await page.evaluate(async (db, agencies, routes) => {
        await db.insertRows('agencies', agencies);
        await db.insertRows('routes', routes);
      }, database, sampleAgencies, sampleRoutes);

      const searchResults = await page.evaluate(async (db) => {
        return await db.searchAllTables('Main', 50);
      }, database);

      expect(Object.keys(searchResults)).toContain('routes');
      expect(searchResults.routes[0].route_long_name).toContain('Main');
    });
  });

  test.describe('Error Handling', () => {
    test('should handle storage quota exceeded gracefully', async () => {
      // This test simulates quota exceeded by creating a very large dataset
      const quotaTest = await page.evaluate(async (db) => {
        try {
          // Create oversized data that might trigger quota limits
          const oversizedData = Array.from({ length: 100000 }, (_, i) => ({
            stop_id: \`LARGE_STOP_\${i}\`,
            stop_name: \`Very Long Stop Name \${i} \`.repeat(100), // Make it large
            stop_desc: 'Lorem ipsum '.repeat(500), // Very long description
            stop_lat: (45.5 + Math.random() * 0.1).toString(),
            stop_lon: (-122.6 + Math.random() * 0.1).toString()
          }));

          await db.insertRows('stops', oversizedData);
          return { success: true, error: null };
        } catch (error) {
          return { success: false, error: error.name };
        }
      }, database);

      // Should either succeed or fail gracefully with QuotaExceededError
      if (!quotaTest.success) {
        expect(quotaTest.error).toBe('QuotaExceededError');
      }
    });

    test('should handle concurrent operations correctly', async () => {
      const concurrentResult = await page.evaluate(async (db, agencies, routes, stops) => {
        // Start multiple operations simultaneously
        const promises = [
          db.insertRows('agencies', agencies),
          db.insertRows('routes', routes),
          db.insertRows('stops', stops)
        ];

        await Promise.all(promises);

        // Verify all data was inserted correctly
        const [agencyCount, routeCount, stopCount] = await Promise.all([
          db.getAllRows('agencies'),
          db.getAllRows('routes'),
          db.getAllRows('stops')
        ]);

        return {
          agencies: agencyCount.length,
          routes: routeCount.length,
          stops: stopCount.length
        };
      }, database, sampleAgencies, sampleRoutes, sampleStops);

      expect(concurrentResult.agencies).toBe(2);
      expect(concurrentResult.routes).toBe(2);
      expect(concurrentResult.stops).toBe(2);
    });
  });

  test.describe('Performance Tests', () => {
    test('should handle rapid successive operations', async () => {
      const rapidTest = await page.evaluate(async (db) => {
        const operations = [];
        const startTime = performance.now();

        // Perform 100 rapid insert operations
        for (let i = 0; i < 100; i++) {
          operations.push(db.insertRows('agencies', [{
            agency_id: \`RAPID_\${i}\`,
            agency_name: \`Rapid Agency \${i}\`,
            agency_url: \`https://rapid\${i}.example.com\`
          }]));
        }

        await Promise.all(operations);
        const endTime = performance.now();

        const finalCount = await db.getAllRows('agencies');
        return {
          operationTime: endTime - startTime,
          recordCount: finalCount.length
        };
      }, database);

      expect(rapidTest.recordCount).toBe(100);
      expect(rapidTest.operationTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should maintain performance with indexed queries', async () => {
      // Insert a large dataset first
      await page.evaluate(async (db) => {
        const largeRoutes = Array.from({ length: 1000 }, (_, i) => ({
          route_id: \`PERF_ROUTE_\${i}\`,
          agency_id: i % 10 === 0 ? 'TARGET_AGENCY' : \`OTHER_AGENCY_\${i % 5}\`,
          route_short_name: \`\${i}\`,
          route_long_name: \`Performance Route \${i}\`,
          route_type: '3'
        }));

        await db.insertRows('routes', largeRoutes);
      }, database);

      const queryPerformance = await page.evaluate(async (db) => {
        const startTime = performance.now();
        const results = await db.queryRows('routes', { agency_id: 'TARGET_AGENCY' });
        const endTime = performance.now();

        return {
          queryTime: endTime - startTime,
          resultCount: results.length
        };
      }, database);

      expect(queryPerformance.resultCount).toBe(100); // Every 10th record
      expect(queryPerformance.queryTime).toBeLessThan(100); // Should be very fast with indexes
    });
  });

  test.describe('Data Integrity', () => {
    test('should maintain data consistency during updates', async () => {
      await page.evaluate(async (db, agencies) => {
        await db.insertRows('agencies', agencies);
      }, database, sampleAgencies);

      const consistencyTest = await page.evaluate(async (db) => {
        const originalRows = await db.getAllRows('agencies');
        const firstRow = originalRows[0];

        // Update the same row multiple times rapidly
        const updatePromises = Array.from({ length: 10 }, (_, i) =>
          db.updateRow('agencies', firstRow.id, { agency_name: \`Updated Name \${i}\` })
        );

        await Promise.all(updatePromises);

        const finalRow = await db.getRow('agencies', firstRow.id);
        return {
          originalName: firstRow.agency_name,
          finalName: finalRow.agency_name,
          hasValidUpdate: finalRow.agency_name.startsWith('Updated Name')
        };
      }, database);

      expect(consistencyTest.hasValidUpdate).toBe(true);
    });

    test('should preserve data types correctly', async () => {
      const typeTest = await page.evaluate(async (db) => {
        const testData = [{
          stop_id: 'TYPE_TEST',
          stop_name: 'Type Test Stop',
          stop_lat: '45.5152', // String
          stop_lon: '-122.6784', // String
          location_type: 0, // Number
          wheelchair_boarding: null, // Null
          platform_code: undefined // Undefined
        }];

        await db.insertRows('stops', testData);
        const retrieved = await db.getAllRows('stops');
        const record = retrieved[0];

        return {
          stopIdType: typeof record.stop_id,
          stopNameType: typeof record.stop_name,
          stopLatType: typeof record.stop_lat,
          locationTypeType: typeof record.location_type,
          wheelchairBoardingValue: record.wheelchair_boarding,
          platformCodeValue: record.platform_code
        };
      }, database);

      expect(typeTest.stopIdType).toBe('string');
      expect(typeTest.stopNameType).toBe('string');
      expect(typeTest.stopLatType).toBe('string');
      expect(typeTest.locationTypeType).toBe('number');
    });
  });

  test.describe('Database Management Functions', () => {
    test('should get accurate database statistics', async () => {
      await page.evaluate(async (db, agencies, routes) => {
        await db.insertRows('agencies', agencies);
        await db.insertRows('routes', routes);
      }, database, sampleAgencies, sampleRoutes);

      const stats = await page.evaluate(async (db) => {
        return await db.getDatabaseStats();
      }, database);

      expect(stats.tables.agencies).toBe(2);
      expect(stats.tables.routes).toBe(2);
      expect(stats.size).toBeGreaterThan(0);
    });

    test('should clear individual tables correctly', async () => {
      await page.evaluate(async (db, agencies, routes) => {
        await db.insertRows('agencies', agencies);
        await db.insertRows('routes', routes);
      }, database, sampleAgencies, sampleRoutes);

      const clearResult = await page.evaluate(async (db) => {
        await db.clearTable('agencies');

        const agenciesAfter = await db.getAllRows('agencies');
        const routesAfter = await db.getAllRows('routes');

        return {
          agenciesCount: agenciesAfter.length,
          routesCount: routesAfter.length
        };
      }, database);

      expect(clearResult.agenciesCount).toBe(0);
      expect(clearResult.routesCount).toBe(2); // Routes should remain
    });

    test('should handle database compaction', async () => {
      await page.evaluate(async (db, agencies) => {
        await db.insertRows('agencies', agencies);
      }, database, sampleAgencies);

      const compactionResult = await page.evaluate(async (db) => {
        try {
          await db.compactDatabase();
          const dataAfter = await db.getAllRows('agencies');
          return { success: true, recordCount: dataAfter.length };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, database);

      expect(compactionResult.success).toBe(true);
      expect(compactionResult.recordCount).toBe(2);
    });
  });
});

test.describe('Fallback Database Tests', () => {
  test('should work identically in fallback mode', async ({ page }) => {
    const fallbackTest = await page.evaluate(async () => {
      // Force fallback mode
      const { databaseFallbackManager } = await import('/src/modules/database-fallback-manager.js');
      const fallbackDB = databaseFallbackManager.createFallbackDatabase();
      await fallbackDB.initialize();

      // Test basic operations
      const testData = [
        { agency_id: 'FALLBACK_1', agency_name: 'Fallback Agency 1' },
        { agency_id: 'FALLBACK_2', agency_name: 'Fallback Agency 2' }
      ];

      await fallbackDB.insertRows('agencies', testData);
      const retrieved = await fallbackDB.getAllRows('agencies');

      await fallbackDB.updateRow('agencies', retrieved[0].id, { agency_name: 'Updated Fallback' });
      const updated = await fallbackDB.getRow('agencies', retrieved[0].id);

      const filtered = await fallbackDB.queryRows('agencies', { agency_id: 'FALLBACK_2' });

      return {
        insertedCount: retrieved.length,
        updatedName: updated.agency_name,
        filteredCount: filtered.length,
        filteredName: filtered[0].agency_name
      };
    });

    expect(fallbackTest.insertedCount).toBe(2);
    expect(fallbackTest.updatedName).toBe('Updated Fallback');
    expect(fallbackTest.filteredCount).toBe(1);
    expect(fallbackTest.filteredName).toBe('Fallback Agency 2');
  });
});