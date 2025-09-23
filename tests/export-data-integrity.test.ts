/**
 * Export Functionality and Data Integrity Tests
 * Tests that export functionality preserves exact data and handles edge cases
 */
import { test, expect } from '@playwright/test';

test.describe('Export Data Integrity Tests', () => {
  let page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto('/');
    await page.waitForSelector('#file-input');

    // Initialize with comprehensive test data
    await page.evaluate(async () => {
      if (window.gtfsEditor) {
        await window.gtfsEditor.gtfsParser.initializeEmpty();
        await window.gtfsEditor.uiController.updateFileList();
      }
    });
  });

  test('should preserve exact data through import-edit-export cycle', async () => {
    const dataIntegrityTest = await page.evaluate(async () => {
      const results = {
        originalRecordCount: 0,
        exportedRecordCount: 0,
        dataMatches: false,
        specialCharactersPreserved: false,
        numericPrecisionMaintained: false,
        nullValuesHandled: false
      };

      // Create test data with various edge cases
      const testData = {
        agencies: [
          {
            agency_id: 'TEST_1',
            agency_name: 'Test Transit "Special" & Co.',
            agency_url: 'https://test.example.com',
            agency_timezone: 'America/Los_Angeles',
            agency_lang: 'en',
            agency_phone: '(555) 123-4567'
          },
          {
            agency_id: 'TEST_2',
            agency_name: 'Spéciàl Çhäractérs Agéncy',
            agency_url: 'https://special.example.com',
            agency_timezone: 'Europe/Paris',
            agency_lang: 'fr',
            agency_phone: null
          }
        ],
        routes: [
          {
            route_id: 'ROUTE_1',
            agency_id: 'TEST_1',
            route_short_name: '1A',
            route_long_name: 'Downtown Express, Line 1',
            route_desc: 'A route with commas, "quotes", and\nnewlines',
            route_type: '3',
            route_color: 'FF0000',
            route_text_color: 'FFFFFF',
            route_sort_order: 100
          }
        ],
        stops: [
          {
            stop_id: 'STOP_1',
            stop_code: 'ST001',
            stop_name: 'Main St & 1st Ave',
            stop_desc: 'Stop with "quotes" and, commas',
            stop_lat: '45.515151',
            stop_lon: '-122.678400',
            zone_id: '',
            stop_url: null,
            location_type: 0,
            parent_station: '',
            wheelchair_boarding: 1,
            level_id: '',
            platform_code: 'A'
          }
        ],
        stop_times: [
          {
            trip_id: 'TRIP_1',
            arrival_time: '08:15:30',
            departure_time: '08:15:45',
            stop_id: 'STOP_1',
            stop_sequence: 1,
            stop_headsign: '',
            pickup_type: 0,
            drop_off_type: 0,
            continuous_pickup: '',
            continuous_drop_off: '',
            shape_dist_traveled: 0.0,
            timepoint: 1
          }
        ]
      };

      // Import test data
      if (window.gtfsEditor && window.gtfsEditor.gtfsParser.gtfsDatabase) {
        const db = window.gtfsEditor.gtfsParser.gtfsDatabase;

        for (const [tableName, records] of Object.entries(testData)) {
          await db.insertRows(tableName, records);
          results.originalRecordCount += records.length;
        }

        // Test export functionality
        const exportBlob = await window.gtfsEditor.gtfsParser.exportAsZip();

        if (exportBlob) {
          // Parse the exported ZIP to verify contents
          const JSZip = window.JSZip;
          const zip = new JSZip();
          const zipContent = await zip.loadAsync(exportBlob);

          let exportedRecordCount = 0;

          // Check each file in the export
          for (const [tableName, originalRecords] of Object.entries(testData)) {
            const fileName = \`\${tableName}.txt\`;

            if (zipContent.files[fileName]) {
              const csvContent = await zipContent.files[fileName].async('text');
              const lines = csvContent.trim().split('\n');

              // First line should be headers, rest are data
              const dataLines = lines.slice(1);
              exportedRecordCount += dataLines.length;

              // Parse CSV and compare with original
              if (dataLines.length === originalRecords.length) {
                const headers = lines[0].split(',');

                // Check special characters preservation
                if (csvContent.includes('Spéciàl Çhäractérs')) {
                  results.specialCharactersPreserved = true;
                }

                // Check numeric precision
                if (csvContent.includes('45.515151') && csvContent.includes('-122.678400')) {
                  results.numericPrecisionMaintained = true;
                }

                // Check null/empty value handling
                if (csvContent.includes(',,') || csvContent.includes(',\n')) {
                  results.nullValuesHandled = true;
                }

                // Detailed data comparison for first record
                if (tableName === 'agencies' && dataLines.length > 0) {
                  const exportedFirstRecord = dataLines[0];
                  const hasQuotes = exportedFirstRecord.includes('"Special"');
                  const hasAmpersand = exportedFirstRecord.includes('&');
                  results.dataMatches = hasQuotes && hasAmpersand;
                }
              }
            }
          }

          results.exportedRecordCount = exportedRecordCount;
        }
      }

      return results;
    });

    expect(dataIntegrityTest.originalRecordCount).toBe(4); // 2 agencies + 1 route + 1 stop
    expect(dataIntegrityTest.exportedRecordCount).toBe(dataIntegrityTest.originalRecordCount);
    expect(dataIntegrityTest.dataMatches).toBe(true);
    expect(dataIntegrityTest.specialCharactersPreserved).toBe(true);
    expect(dataIntegrityTest.numericPrecisionMaintained).toBe(true);
    expect(dataIntegrityTest.nullValuesHandled).toBe(true);
  });

  test('should handle CSV escaping and special characters correctly', async () => {
    const csvEscapingTest = await page.evaluate(async () => {
      const results = {
        quotesEscaped: false,
        commasHandled: false,
        newlinesPreserved: false,
        unicodeCharacters: false,
        emptyFieldsCorrect: false
      };

      // Test data with challenging CSV scenarios
      const challengingData = [
        {
          agency_id: 'CSV_TEST',
          agency_name: 'Agency with "quotes", commas, and\nmultiline text',
          agency_url: 'https://test.example.com',
          agency_timezone: 'America/New_York',
          agency_lang: '',
          agency_phone: null,
          agency_fare_url: undefined
        },
        {
          agency_id: 'UNICODE_TEST',
          agency_name: '🚌 Transit Agéncy with émojis and açcénts',
          agency_url: 'https://unicode.example.com',
          agency_timezone: 'Asia/Tokyo',
          agency_lang: 'ja',
          agency_phone: '090-1234-5678',
          agency_email: 'test@example.com'
        }
      ];

      if (window.gtfsEditor && window.gtfsEditor.gtfsParser.gtfsDatabase) {
        const db = window.gtfsEditor.gtfsParser.gtfsDatabase;
        await db.insertRows('agencies', challengingData);

        const exportBlob = await window.gtfsEditor.gtfsParser.exportAsZip();

        if (exportBlob) {
          const JSZip = window.JSZip;
          const zip = new JSZip();
          const zipContent = await zip.loadAsync(exportBlob);

          if (zipContent.files['agencies.txt']) {
            const csvContent = await zipContent.files['agencies.txt'].async('text');

            // Check quote escaping: "quotes" should become ""quotes""
            results.quotesEscaped = csvContent.includes('""quotes""');

            // Check comma handling: fields with commas should be quoted
            results.commasHandled = csvContent.includes('"Agency with ""quotes"", commas,');

            // Check newline preservation
            results.newlinesPreserved = csvContent.includes('multiline text');

            // Check Unicode characters
            results.unicodeCharacters = csvContent.includes('🚌') && csvContent.includes('émojis');

            // Check empty fields
            const lines = csvContent.split('\n');
            if (lines.length > 2) {
              // Look for consecutive commas indicating empty fields
              results.emptyFieldsCorrect = lines.some(line => line.includes(',,'));
            }
          }
        }
      }

      return results;
    });

    expect(csvEscapingTest.quotesEscaped).toBe(true);
    expect(csvEscapingTest.commasHandled).toBe(true);
    expect(csvEscapingTest.newlinesPreserved).toBe(true);
    expect(csvEscapingTest.unicodeCharacters).toBe(true);
    expect(csvEscapingTest.emptyFieldsCorrect).toBe(true);
  });

  test('should maintain file structure and metadata in exports', async () => {
    const structureTest = await page.evaluate(async () => {
      const results = {
        correctFileCount: false,
        headerRowsPresent: false,
        fileNamesCorrect: false,
        metadataPreserved: false,
        zipStructureValid: false
      };

      // Add data to multiple tables
      const multiTableData = {
        agencies: [{ agency_id: 'A1', agency_name: 'Agency 1', agency_url: 'http://a1.com', agency_timezone: 'UTC' }],
        routes: [{ route_id: 'R1', agency_id: 'A1', route_short_name: '1', route_long_name: 'Route 1', route_type: '3' }],
        stops: [{ stop_id: 'S1', stop_name: 'Stop 1', stop_lat: '45.5', stop_lon: '-122.6' }],
        trips: [{ route_id: 'R1', service_id: 'SRV1', trip_id: 'T1' }],
        calendar: [{ service_id: 'SRV1', monday: '1', tuesday: '1', wednesday: '1', thursday: '1', friday: '1', saturday: '0', sunday: '0', start_date: '20240101', end_date: '20241231' }]
      };

      if (window.gtfsEditor && window.gtfsEditor.gtfsParser.gtfsDatabase) {
        const db = window.gtfsEditor.gtfsParser.gtfsDatabase;

        // Insert data into multiple tables
        for (const [tableName, records] of Object.entries(multiTableData)) {
          await db.insertRows(tableName, records);
        }

        const exportBlob = await window.gtfsEditor.gtfsParser.exportAsZip();

        if (exportBlob) {
          const JSZip = window.JSZip;
          const zip = new JSZip();
          const zipContent = await zip.loadAsync(exportBlob);

          const expectedFiles = Object.keys(multiTableData).map(name => \`\${name}.txt\`);
          const actualFiles = Object.keys(zipContent.files);

          // Check file count and names
          results.correctFileCount = expectedFiles.length === actualFiles.length;
          results.fileNamesCorrect = expectedFiles.every(fileName => actualFiles.includes(fileName));

          // Check that each file has proper header row
          let headerChecksPassed = 0;
          for (const fileName of expectedFiles) {
            if (zipContent.files[fileName]) {
              const content = await zipContent.files[fileName].async('text');
              const lines = content.trim().split('\n');

              if (lines.length >= 2) { // Header + at least one data row
                const headers = lines[0].split(',');
                if (headers.length > 0 && !headers[0].startsWith('"')) {
                  headerChecksPassed++;
                }
              }
            }
          }

          results.headerRowsPresent = headerChecksPassed === expectedFiles.length;

          // Check ZIP structure validity
          results.zipStructureValid = actualFiles.every(fileName =>
            fileName.endsWith('.txt') && !fileName.includes('/')
          );

          // Check metadata preservation (project info should be maintained)
          const stats = await db.getDatabaseStats();
          results.metadataPreserved = Object.keys(stats.tables).length === Object.keys(multiTableData).length;
        }
      }

      return results;
    });

    expect(structureTest.correctFileCount).toBe(true);
    expect(structureTest.headerRowsPresent).toBe(true);
    expect(structureTest.fileNamesCorrect).toBe(true);
    expect(structureTest.metadataPreserved).toBe(true);
    expect(structureTest.zipStructureValid).toBe(true);
  });

  test('should handle large dataset exports efficiently', async () => {
    const largeExportTest = await page.evaluate(async () => {
      const results = {
        recordsGenerated: 0,
        recordsExported: 0,
        exportTime: 0,
        memoryEfficient: true,
        exportSizeReasonable: true
      };

      // Generate large dataset
      const largeDataset = [];
      for (let i = 0; i < 5000; i++) {
        largeDataset.push({
          stop_id: \`LARGE_STOP_\${i}\`,
          stop_name: \`Large Dataset Stop \${i}\`,
          stop_desc: \`This is a test stop for large dataset export testing. Stop number \${i} in the sequence.\`,
          stop_lat: (45.5 + (Math.random() - 0.5) * 0.1).toFixed(6),
          stop_lon: (-122.6 + (Math.random() - 0.5) * 0.1).toFixed(6),
          location_type: '0',
          wheelchair_boarding: (i % 3).toString()
        });
      }

      results.recordsGenerated = largeDataset.length;

      if (window.gtfsEditor && window.gtfsEditor.gtfsParser.gtfsDatabase) {
        const db = window.gtfsEditor.gtfsParser.gtfsDatabase;
        await db.insertRows('stops', largeDataset);

        // Measure export performance
        const startTime = performance.now();
        const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

        const exportBlob = await window.gtfsEditor.gtfsParser.exportAsZip();

        const endTime = performance.now();
        const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

        results.exportTime = endTime - startTime;

        if (exportBlob) {
          // Verify export contents
          const JSZip = window.JSZip;
          const zip = new JSZip();
          const zipContent = await zip.loadAsync(exportBlob);

          if (zipContent.files['stops.txt']) {
            const csvContent = await zipContent.files['stops.txt'].async('text');
            const lines = csvContent.trim().split('\n');
            results.recordsExported = lines.length - 1; // Subtract header row

            // Check export size is reasonable (should be compressed)
            results.exportSizeReasonable = exportBlob.size < csvContent.length * 0.8; // Should be somewhat compressed
          }

          // Check memory efficiency
          if (initialMemory > 0 && finalMemory > 0) {
            const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
            results.memoryEfficient = memoryIncrease < 100; // Less than 100MB increase
          }
        }
      }

      return results;
    });

    expect(largeExportTest.recordsGenerated).toBe(5000);
    expect(largeExportTest.recordsExported).toBe(largeExportTest.recordsGenerated);
    expect(largeExportTest.exportTime).toBeLessThan(10000); // Should complete within 10 seconds
    expect(largeExportTest.memoryEfficient).toBe(true);
    expect(largeExportTest.exportSizeReasonable).toBe(true);
  });

  test('should handle export errors gracefully', async () => {
    const errorHandlingTest = await page.evaluate(async () => {
      const results = {
        emptyDatasetHandled: false,
        corruptedDataHandled: false,
        partialDataExported: false,
        errorMessagesAppropriate: false
      };

      if (window.gtfsEditor && window.gtfsEditor.gtfsParser.gtfsDatabase) {
        const db = window.gtfsEditor.gtfsParser.gtfsDatabase;

        // Test 1: Empty dataset export
        try {
          const emptyExport = await window.gtfsEditor.gtfsParser.exportAsZip();
          results.emptyDatasetHandled = emptyExport instanceof Blob;
        } catch (error) {
          results.emptyDatasetHandled = error.message.includes('No data') || error.message.includes('empty');
        }

        // Test 2: Corrupted data handling
        await db.insertRows('agencies', [
          { agency_id: 'VALID_1', agency_name: 'Valid Agency', agency_url: 'http://valid.com', agency_timezone: 'UTC' },
          { agency_id: null, agency_name: undefined, agency_url: '', agency_timezone: 'Invalid' }, // Problematic record
          { agency_id: 'VALID_2', agency_name: 'Another Valid', agency_url: 'http://valid2.com', agency_timezone: 'UTC' }
        ]);

        try {
          const corruptedExport = await window.gtfsEditor.gtfsParser.exportAsZip();
          if (corruptedExport) {
            const JSZip = window.JSZip;
            const zip = new JSZip();
            const zipContent = await zip.loadAsync(corruptedExport);

            if (zipContent.files['agencies.txt']) {
              const csvContent = await zipContent.files['agencies.txt'].async('text');
              const lines = csvContent.trim().split('\n');

              // Should still export valid records
              results.corruptedDataHandled = lines.length >= 3; // Header + 2 valid records
              results.partialDataExported = csvContent.includes('VALID_1') && csvContent.includes('VALID_2');
            }
          }
        } catch (error) {
          results.errorMessagesAppropriate = error.message.includes('export') || error.message.includes('data');
        }
      }

      return results;
    });

    expect(errorHandlingTest.emptyDatasetHandled).toBe(true);
    expect(errorHandlingTest.corruptedDataHandled).toBe(true);
    expect(errorHandlingTest.partialDataExported).toBe(true);
  });
});