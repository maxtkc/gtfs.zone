/**
 * Performance and Browser Compatibility Tests
 * Tests performance metrics, private mode behavior, and storage quota handling
 */
import { test, expect } from '@playwright/test';

test.describe('Performance and Browser Compatibility Tests', () => {
  let page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto('/');
    await page.waitForSelector('#file-input');
  });

  test('should meet performance benchmarks for core operations', async () => {
    const performanceResults = await page.evaluate(async () => {
      const results = {
        initialization: { time: 0, success: false },
        dataInsertion: { time: 0, recordsPerSecond: 0 },
        queryPerformance: { time: 0, resultsCount: 0 },
        uiResponsiveness: { frameDrops: 0, smoothness: true },
        memoryUsage: { peak: 0, efficient: true }
      };

      // Test 1: Database Initialization Performance
      const initStart = performance.now();
      try {
        const { GTFSDatabase } = await import('/src/modules/gtfs-database.js');
        const database = new GTFSDatabase();
        await database.initialize();
        results.initialization.time = performance.now() - initStart;
        results.initialization.success = true;

        // Test 2: Data Insertion Performance
        const insertStart = performance.now();
        const testData = Array.from({ length: 1000 }, (_, i) => ({
          stop_id: \`PERF_STOP_\${i}\`,
          stop_name: \`Performance Test Stop \${i}\`,
          stop_lat: (45.5 + Math.random() * 0.1).toFixed(6),
          stop_lon: (-122.6 + Math.random() * 0.1).toFixed(6)
        }));

        await database.insertRows('stops', testData);
        const insertTime = performance.now() - insertStart;
        results.dataInsertion.time = insertTime;
        results.dataInsertion.recordsPerSecond = Math.round(1000 / (insertTime / 1000));

        // Test 3: Query Performance
        const queryStart = performance.now();
        const queryResults = await database.queryRows('stops', {});
        results.queryPerformance.time = performance.now() - queryStart;
        results.queryPerformance.resultsCount = queryResults.length;

        // Test 4: Memory Usage
        if (performance.memory) {
          results.memoryUsage.peak = performance.memory.usedJSHeapSize / 1024 / 1024; // MB
          results.memoryUsage.efficient = results.memoryUsage.peak < 200; // Under 200MB
        }

        await database.clearDatabase();
        database.close();

      } catch (error) {
        console.error('Performance test error:', error);
      }

      return results;
    });

    // Performance Assertions
    expect(performanceResults.initialization.success).toBe(true);
    expect(performanceResults.initialization.time).toBeLessThan(2000); // Under 2 seconds

    expect(performanceResults.dataInsertion.recordsPerSecond).toBeGreaterThan(500); // At least 500 records/sec
    expect(performanceResults.dataInsertion.time).toBeLessThan(5000); // Under 5 seconds for 1000 records

    expect(performanceResults.queryPerformance.time).toBeLessThan(100); // Under 100ms
    expect(performanceResults.queryPerformance.resultsCount).toBe(1000);

    expect(performanceResults.memoryUsage.efficient).toBe(true);
  });

  test('should handle private/incognito mode gracefully', async () => {
    const privateMode = await page.evaluate(async () => {
      const results = {
        privateModeDetected: false,
        fallbackActivated: false,
        functionalityPreserved: false,
        warningShown: false
      };

      try {
        // Simulate private mode by restricting IndexedDB
        const originalIndexedDB = window.indexedDB;

        // Create a mock IndexedDB that fails like in private mode
        const mockIndexedDB = {
          open: () => {
            const request = {
              error: new Error('The operation failed for reasons unrelated to the database itself'),
              onerror: null,
              onsuccess: null,
              result: null
            };
            setTimeout(() => {
              if (request.onerror) request.onerror();
            }, 10);
            return request;
          },
          deleteDatabase: () => ({
            onerror: null,
            onsuccess: null
          })
        };

        // Replace IndexedDB temporarily
        Object.defineProperty(window, 'indexedDB', {
          value: mockIndexedDB,
          configurable: true
        });

        // Test database initialization in "private mode"
        const { databaseFallbackManager } = await import('/src/modules/database-fallback-manager.js');
        const capabilities = await databaseFallbackManager.detectCapabilities();

        results.privateModeDetected = capabilities.browserInfo.isPrivate;

        // Try to create database - should fallback
        const { GTFSDatabase } = await import('/src/modules/gtfs-database.js');
        const database = new GTFSDatabase();
        await database.initialize();

        results.fallbackActivated = database.isInFallbackMode();

        // Test basic functionality in fallback mode
        if (results.fallbackActivated) {
          const testData = [
            { agency_id: 'PRIVATE_TEST', agency_name: 'Private Mode Test', agency_url: 'http://test.com', agency_timezone: 'UTC' }
          ];

          await database.insertRows('agencies', testData);
          const retrieved = await database.getAllRows('agencies');
          results.functionalityPreserved = retrieved.length === 1 && retrieved[0].agency_name === 'Private Mode Test';
        }

        // Check if warning is shown (look for warning elements)
        const warningElements = document.querySelectorAll('.alert-warning, .modal, [id*="warning"]');
        results.warningShown = warningElements.length > 0;

        // Restore original IndexedDB
        Object.defineProperty(window, 'indexedDB', {
          value: originalIndexedDB,
          configurable: true
        });

        await database.clearDatabase();
        database.close();

      } catch (error) {
        console.error('Private mode test error:', error);
      }

      return results;
    });

    expect(privateMode.fallbackActivated).toBe(true);
    expect(privateMode.functionalityPreserved).toBe(true);
  });

  test('should handle storage quota exceeded scenarios', async () => {
    const quotaTest = await page.evaluate(async () => {
      const results = {
        quotaDetected: false,
        errorHandled: false,
        userNotified: false,
        gracefulDegradation: false
      };

      try {
        const { GTFSDatabase } = await import('/src/modules/gtfs-database.js');
        const database = new GTFSDatabase();
        await database.initialize();

        // Try to create a dataset that might exceed quota
        // Create very large records to potentially trigger quota limits
        const oversizedData = Array.from({ length: 10000 }, (_, i) => ({
          stop_id: \`QUOTA_TEST_\${i}\`,
          stop_name: \`Quota Test Stop \${i}\`,
          stop_desc: 'A'.repeat(10000), // 10KB description per record
          stop_lat: (45.5 + Math.random() * 0.1).toFixed(6),
          stop_lon: (-122.6 + Math.random() * 0.1).toFixed(6),
          stop_url: 'https://example.com/' + 'x'.repeat(1000), // Large URL
          zone_id: 'ZONE_' + 'X'.repeat(500) // Large zone ID
        }));

        try {
          await database.insertRows('stops', oversizedData);
          // If this succeeds, we didn't hit quota limits (which is fine)
          results.gracefulDegradation = true;
        } catch (error) {
          if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
            results.quotaDetected = true;
            results.errorHandled = true;

            // Check if user was notified
            setTimeout(() => {
              const errorElements = document.querySelectorAll('.alert-error, .modal, [class*="error"]');
              results.userNotified = errorElements.length > 0;
            }, 100);

            // Try to continue with smaller dataset
            const smallerData = oversizedData.slice(0, 100);
            try {
              await database.insertRows('stops', smallerData);
              results.gracefulDegradation = true;
            } catch (secondError) {
              console.error('Even smaller dataset failed:', secondError);
            }
          }
        }

        await database.clearDatabase();
        database.close();

      } catch (error) {
        console.error('Quota test error:', error);
      }

      return results;
    });

    // Either quota handling worked OR we didn't hit limits (both are acceptable)
    expect(quotaTest.errorHandled || quotaTest.gracefulDegradation).toBe(true);
  });

  test('should maintain performance under stress conditions', async () => {
    const stressTest = await page.evaluate(async () => {
      const results = {
        concurrentOperations: { completed: 0, failed: 0 },
        memoryStability: true,
        responseTimeConsistency: true,
        errorRecovery: true
      };

      try {
        const { GTFSDatabase } = await import('/src/modules/gtfs-database.js');
        const database = new GTFSDatabase();
        await database.initialize();

        const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
        const responseTimes = [];

        // Stress test: Many concurrent operations
        const stressOperations = [];

        for (let i = 0; i < 20; i++) {
          const operation = async () => {
            const startTime = performance.now();

            try {
              const data = Array.from({ length: 100 }, (_, j) => ({
                stop_id: \`STRESS_\${i}_\${j}\`,
                stop_name: \`Stress Test Stop \${i}-\${j}\`,
                stop_lat: (45.5 + Math.random() * 0.1).toFixed(6),
                stop_lon: (-122.6 + Math.random() * 0.1).toFixed(6)
              }));

              await database.insertRows('stops', data);

              // Perform some queries
              await database.queryRows('stops', {});
              await database.getAllRows('stops');

              const endTime = performance.now();
              responseTimes.push(endTime - startTime);
              results.concurrentOperations.completed++;

            } catch (error) {
              results.concurrentOperations.failed++;
              console.error(\`Stress operation \${i} failed:\`, error);
            }
          };

          stressOperations.push(operation());
        }

        await Promise.allSettled(stressOperations);

        // Check memory stability
        const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
        if (initialMemory > 0) {
          const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
          results.memoryStability = memoryIncrease < 500; // Less than 500MB increase
        }

        // Check response time consistency
        if (responseTimes.length > 0) {
          const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
          const maxResponseTime = Math.max(...responseTimes);
          results.responseTimeConsistency = maxResponseTime < avgResponseTime * 3; // Max shouldn't be more than 3x average
        }

        // Test error recovery
        try {
          // Attempt to corrupt data and recover
          await database.insertRows('invalid_table', [{ test: 'data' }]);
          results.errorRecovery = false; // Should have failed
        } catch (error) {
          // Expected to fail, now try valid operation
          try {
            await database.getAllRows('stops');
            results.errorRecovery = true; // Recovered successfully
          } catch (recoveryError) {
            results.errorRecovery = false;
          }
        }

        await database.clearDatabase();
        database.close();

      } catch (error) {
        console.error('Stress test error:', error);
      }

      return results;
    });

    expect(stressTest.concurrentOperations.completed).toBeGreaterThan(15); // Most operations should succeed
    expect(stressTest.concurrentOperations.failed).toBeLessThan(5); // Few failures acceptable
    expect(stressTest.memoryStability).toBe(true);
    expect(stressTest.responseTimeConsistency).toBe(true);
    expect(stressTest.errorRecovery).toBe(true);
  });

  test('should handle browser-specific limitations gracefully', async () => {
    const browserTest = await page.evaluate(async () => {
      const results = {
        featureDetection: true,
        polyfillHandling: true,
        apiAvailability: true,
        errorHandling: true
      };

      try {
        // Test feature detection
        const { databaseFallbackManager } = await import('/src/modules/database-fallback-manager.js');
        const capabilities = await databaseFallbackManager.detectCapabilities();

        results.featureDetection = typeof capabilities.indexedDB === 'boolean' &&
                                  typeof capabilities.localStorage === 'boolean' &&
                                  typeof capabilities.serviceWorker === 'boolean';

        // Test API availability handling
        const apiTests = {
          indexedDB: typeof window.indexedDB !== 'undefined',
          localStorage: typeof window.localStorage !== 'undefined',
          sessionStorage: typeof window.sessionStorage !== 'undefined',
          performance: typeof window.performance !== 'undefined',
          requestIdleCallback: typeof window.requestIdleCallback !== 'undefined'
        };

        results.apiAvailability = Object.values(apiTests).filter(Boolean).length >= 3; // At least 3 APIs available

        // Test polyfill handling for missing APIs
        if (!window.requestIdleCallback) {
          // Should have a polyfill or graceful degradation
          const hasPolyfill = typeof window.requestIdleCallback === 'function';
          results.polyfillHandling = hasPolyfill || true; // Or graceful degradation
        }

        // Test error handling for unsupported operations
        try {
          // Try to use potentially unsupported feature
          if (navigator.storage && navigator.storage.estimate) {
            await navigator.storage.estimate();
          }
          results.errorHandling = true;
        } catch (error) {
          // Should handle gracefully
          results.errorHandling = !error.message.includes('not supported');
        }

      } catch (error) {
        console.error('Browser test error:', error);
        results.errorHandling = false;
      }

      return results;
    });

    expect(browserTest.featureDetection).toBe(true);
    expect(browserTest.apiAvailability).toBe(true);
    expect(browserTest.errorHandling).toBe(true);
  });

  test('should provide accurate performance metrics and monitoring', async () => {
    const metricsTest = await page.evaluate(async () => {
      const results = {
        performanceMarks: 0,
        timingAccuracy: true,
        memoryTracking: false,
        operationProfiling: true
      };

      try {
        // Test performance measurement capabilities
        const markName = 'gtfs-test-mark';
        performance.mark(\`\${markName}-start\`);

        const { GTFSDatabase } = await import('/src/modules/gtfs-database.js');
        const database = new GTFSDatabase();
        await database.initialize();

        const testData = Array.from({ length: 100 }, (_, i) => ({
          agency_id: \`METRICS_\${i}\`,
          agency_name: \`Metrics Test Agency \${i}\`,
          agency_url: \`https://metrics\${i}.example.com\`,
          agency_timezone: 'UTC'
        }));

        await database.insertRows('agencies', testData);

        performance.mark(\`\${markName}-end\`);
        performance.measure(\`\${markName}-duration\`, \`\${markName}-start\`, \`\${markName}-end\`);

        // Check if performance marks were created
        const marks = performance.getEntriesByType('mark');
        const measures = performance.getEntriesByType('measure');
        results.performanceMarks = marks.length + measures.length;

        // Check timing accuracy
        const measure = measures.find(m => m.name === \`\${markName}-duration\`);
        results.timingAccuracy = measure && measure.duration > 0;

        // Check memory tracking capability
        if (performance.memory) {
          results.memoryTracking = typeof performance.memory.usedJSHeapSize === 'number';
        }

        // Clean up
        performance.clearMarks();
        performance.clearMeasures();
        await database.clearDatabase();
        database.close();

      } catch (error) {
        console.error('Metrics test error:', error);
        results.operationProfiling = false;
      }

      return results;
    });

    expect(metricsTest.performanceMarks).toBeGreaterThan(0);
    expect(metricsTest.timingAccuracy).toBe(true);
    expect(metricsTest.operationProfiling).toBe(true);
  });
});