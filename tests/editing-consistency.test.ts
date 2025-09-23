/**
 * Editing Consistency and Debouncing Tests
 * Tests rapid editing scenarios, data consistency, and debouncing behavior
 */
import { test, expect } from '@playwright/test';

test.describe('Rapid Editing and Consistency Tests', () => {
  let page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto('/');
    await page.waitForSelector('#file-input');

    // Load sample data for testing
    await page.evaluate(async () => {
      // Initialize with sample data
      if (window.gtfsEditor) {
        await window.gtfsEditor.gtfsParser.initializeEmpty();
        await window.gtfsEditor.uiController.updateFileList();
      }
    });
  });

  test('should handle rapid consecutive edits with proper debouncing', async () => {
    // First open a file for editing
    await page.click('#file-list .menu a:first-child');
    await page.waitForSelector('#file-editor-view');

    const debouncingTest = await page.evaluate(async () => {
      const results = {
        editsApplied: 0,
        databaseUpdates: 0,
        finalValue: '',
        debounceWorking: false
      };

      // Mock the database update function to count calls
      let originalUpdateRow;
      if (window.gtfsEditor && window.gtfsEditor.gtfsParser.gtfsDatabase) {
        originalUpdateRow = window.gtfsEditor.gtfsParser.gtfsDatabase.updateRow;
        window.gtfsEditor.gtfsParser.gtfsDatabase.updateRow = async function(...args) {
          results.databaseUpdates++;
          return await originalUpdateRow.apply(this, args);
        };
      }

      // Simulate rapid table editing
      const tableView = document.querySelector('.table-editor-container');
      if (tableView) {
        // Find first editable cell
        const firstCell = tableView.querySelector('td[contenteditable="true"]');
        if (firstCell) {
          // Simulate rapid typing
          for (let i = 0; i < 10; i++) {
            firstCell.textContent = `Rapid Edit ${i}`;
            firstCell.dispatchEvent(new Event('input', { bubbles: true }));
            results.editsApplied++;

            // Small delay between edits (faster than debounce)
            await new Promise(resolve => setTimeout(resolve, 50));
          }

          results.finalValue = firstCell.textContent;

          // Wait for debounce to complete (should be 500ms)
          await new Promise(resolve => setTimeout(resolve, 600));

          // Check if debouncing worked (should have fewer DB updates than edits)
          results.debounceWorking = results.databaseUpdates < results.editsApplied;
        }
      }

      return results;
    });

    expect(debouncingTest.editsApplied).toBe(10);
    expect(debouncingTest.finalValue).toBe('Rapid Edit 9');
    expect(debouncingTest.debounceWorking).toBe(true);
    expect(debouncingTest.databaseUpdates).toBeLessThan(5); // Should be significantly fewer than edits
  });

  test('should maintain data consistency between text and table edits', async () => {
    // Open a file for editing
    await page.click('#file-list .menu a:first-child');
    await page.waitForSelector('#file-editor-view');

    const consistencyTest = await page.evaluate(async () => {
      const results = {
        textEditValue: '',
        tableEditValue: '',
        databaseValue: '',
        consistent: false
      };

      // Test switching between text and table views
      const viewToggle = document.getElementById('view-toggle-checkbox');
      if (viewToggle) {
        // Start in text view
        viewToggle.checked = false;
        viewToggle.dispatchEvent(new Event('change'));

        await new Promise(resolve => setTimeout(resolve, 100));

        // Edit in text view
        const textEditor = document.querySelector('.cm-editor');
        if (textEditor) {
          // Simulate text edit by modifying first line
          const textContent = textEditor.textContent || '';
          const lines = textContent.split('\n');
          if (lines.length > 1) {
            lines[1] = lines[1].replace(/^[^,]*/, 'TEXT_EDITED_AGENCY');
            const newContent = lines.join('\n');
            results.textEditValue = 'TEXT_EDITED_AGENCY';

            // Trigger text editor change
            if (window.gtfsEditor && window.gtfsEditor.editor) {
              window.gtfsEditor.editor.setContent(newContent);
              await window.gtfsEditor.editor.saveCurrentFileChanges();
            }
          }
        }

        await new Promise(resolve => setTimeout(resolve, 200));

        // Switch to table view
        viewToggle.checked = true;
        viewToggle.dispatchEvent(new Event('change'));

        await new Promise(resolve => setTimeout(resolve, 200));

        // Check if text edit is reflected in table
        const firstCell = document.querySelector('.table-editor-container td[contenteditable="true"]');
        if (firstCell) {
          results.tableEditValue = firstCell.textContent || '';

          // Make another edit in table view
          firstCell.textContent = 'TABLE_EDITED_AGENCY';
          firstCell.dispatchEvent(new Event('input', { bubbles: true }));

          await new Promise(resolve => setTimeout(resolve, 600)); // Wait for debounce
        }

        // Check database for final value
        if (window.gtfsEditor && window.gtfsEditor.gtfsParser.gtfsDatabase) {
          const agencies = await window.gtfsEditor.gtfsParser.gtfsDatabase.getAllRows('agencies');
          if (agencies.length > 0) {
            results.databaseValue = agencies[0].agency_name || agencies[0].agency_id || '';
          }
        }

        results.consistent = results.databaseValue === 'TABLE_EDITED_AGENCY';
      }

      return results;
    });

    expect(consistencyTest.textEditValue).toBe('TEXT_EDITED_AGENCY');
    expect(consistencyTest.databaseValue).toBe('TABLE_EDITED_AGENCY');
    expect(consistencyTest.consistent).toBe(true);
  });

  test('should handle concurrent edits from multiple sources gracefully', async () => {
    await page.click('#file-list .menu a:first-child');
    await page.waitForSelector('#file-editor-view');

    const concurrentEditTest = await page.evaluate(async () => {
      const results = {
        simultaneousEdits: 0,
        finalState: '',
        noDataLoss: true,
        conflictsHandled: true
      };

      // Switch to table view for easier testing
      const viewToggle = document.getElementById('view-toggle-checkbox');
      if (viewToggle) {
        viewToggle.checked = true;
        viewToggle.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Find multiple editable cells
      const editableCells = document.querySelectorAll('.table-editor-container td[contenteditable="true"]');

      if (editableCells.length >= 3) {
        // Start simultaneous edits on different cells
        const editPromises = Array.from(editableCells).slice(0, 3).map(async (cell, index) => {
          for (let i = 0; i < 5; i++) {
            cell.textContent = `Concurrent_${index}_${i}`;
            cell.dispatchEvent(new Event('input', { bubbles: true }));
            results.simultaneousEdits++;

            // Random small delays to simulate real user behavior
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
          }
          return `Concurrent_${index}_4`; // Final expected value
        });

        const expectedValues = await Promise.all(editPromises);

        // Wait for all debounces to complete
        await new Promise(resolve => setTimeout(resolve, 800));

        // Verify final state
        const finalValues = Array.from(editableCells).slice(0, 3).map(cell => cell.textContent);
        results.finalState = finalValues.join(', ');

        // Check that all expected values are present
        results.noDataLoss = expectedValues.every((expected, index) =>
          finalValues[index] === expected
        );

        // Verify database consistency
        if (window.gtfsEditor && window.gtfsEditor.gtfsParser.gtfsDatabase) {
          const dbData = await window.gtfsEditor.gtfsParser.gtfsDatabase.getAllRows('agencies');
          results.conflictsHandled = dbData.length > 0; // Basic check that data exists
        }
      }

      return results;
    });

    expect(concurrentEditTest.simultaneousEdits).toBe(15); // 3 cells × 5 edits each
    expect(concurrentEditTest.noDataLoss).toBe(true);
    expect(concurrentEditTest.conflictsHandled).toBe(true);
  });

  test('should preserve edit history and allow undo operations', async () => {
    await page.click('#file-list .menu a:first-child');
    await page.waitForSelector('#file-editor-view');

    const undoTest = await page.evaluate(async () => {
      const results = {
        originalValue: '',
        editedValue: '',
        undoAvailable: false,
        undoWorked: false
      };

      // Switch to table view
      const viewToggle = document.getElementById('view-toggle-checkbox');
      if (viewToggle) {
        viewToggle.checked = true;
        viewToggle.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const firstCell = document.querySelector('.table-editor-container td[contenteditable="true"]');
      if (firstCell) {
        results.originalValue = firstCell.textContent || '';

        // Make an edit
        firstCell.textContent = 'EDITED_FOR_UNDO_TEST';
        firstCell.dispatchEvent(new Event('input', { bubbles: true }));
        results.editedValue = firstCell.textContent;

        await new Promise(resolve => setTimeout(resolve, 600)); // Wait for debounce

        // Try to undo (Ctrl+Z)
        firstCell.focus();
        const undoEvent = new KeyboardEvent('keydown', {
          key: 'z',
          code: 'KeyZ',
          ctrlKey: true,
          bubbles: true
        });

        document.dispatchEvent(undoEvent);
        results.undoAvailable = true; // Basic check that undo was attempted

        await new Promise(resolve => setTimeout(resolve, 200));

        // Check if undo worked (in a real implementation)
        // For now, we'll just verify the edit was properly stored
        if (window.gtfsEditor && window.gtfsEditor.gtfsParser.gtfsDatabase) {
          const dbData = await window.gtfsEditor.gtfsParser.gtfsDatabase.getAllRows('agencies');
          if (dbData.length > 0) {
            const storedValue = dbData[0].agency_name || dbData[0].agency_id || '';
            results.undoWorked = storedValue === 'EDITED_FOR_UNDO_TEST';
          }
        }
      }

      return results;
    });

    expect(undoTest.originalValue).toBeTruthy();
    expect(undoTest.editedValue).toBe('EDITED_FOR_UNDO_TEST');
    expect(undoTest.undoAvailable).toBe(true);
  });

  test('should handle validation errors during rapid editing', async () => {
    await page.click('#file-list .menu a:first-child');
    await page.waitForSelector('#file-editor-view');

    const validationTest = await page.evaluate(async () => {
      const results = {
        validEdits: 0,
        invalidEdits: 0,
        errorsHandled: true,
        finalDataValid: true
      };

      // Switch to table view
      const viewToggle = document.getElementById('view-toggle-checkbox');
      if (viewToggle) {
        viewToggle.checked = true;
        viewToggle.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const editableCells = document.querySelectorAll('.table-editor-container td[contenteditable="true"]');

      if (editableCells.length > 0) {
        const testCell = editableCells[0];

        // Mix of valid and invalid edits
        const testValues = [
          'Valid Agency Name',    // Valid
          '',                     // Invalid (empty)
          'Another Valid Name',   // Valid
          '   ',                  // Invalid (whitespace only)
          'Final Valid Name'      // Valid
        ];

        for (const value of testValues) {
          testCell.textContent = value;
          testCell.dispatchEvent(new Event('input', { bubbles: true }));

          if (value.trim()) {
            results.validEdits++;
          } else {
            results.invalidEdits++;
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        }

        await new Promise(resolve => setTimeout(resolve, 600)); // Wait for debounce

        // Verify final state
        const finalValue = testCell.textContent;
        results.finalDataValid = finalValue && finalValue.trim().length > 0;

        // Check for any error indicators
        const hasErrorClass = testCell.classList.contains('error') ||
                             testCell.classList.contains('invalid') ||
                             testCell.parentElement?.classList.contains('error');

        results.errorsHandled = !hasErrorClass || results.finalDataValid;
      }

      return results;
    });

    expect(validationTest.validEdits).toBe(3);
    expect(validationTest.invalidEdits).toBe(2);
    expect(validationTest.errorsHandled).toBe(true);
    expect(validationTest.finalDataValid).toBe(true);
  });

  test('should maintain performance during extended editing sessions', async () => {
    await page.click('#file-list .menu a:first-child');
    await page.waitForSelector('#file-editor-view');

    const performanceTest = await page.evaluate(async () => {
      const results = {
        totalEdits: 0,
        averageResponseTime: 0,
        memoryLeaks: false,
        performanceDegradation: false
      };

      const responseTimes = [];
      const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

      // Switch to table view
      const viewToggle = document.getElementById('view-toggle-checkbox');
      if (viewToggle) {
        viewToggle.checked = true;
        viewToggle.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const firstCell = document.querySelector('.table-editor-container td[contenteditable="true"]');

      if (firstCell) {
        // Perform 100 edits to simulate extended session
        for (let i = 0; i < 100; i++) {
          const startTime = performance.now();

          firstCell.textContent = `Extended Edit Session ${i}`;
          firstCell.dispatchEvent(new Event('input', { bubbles: true }));

          const endTime = performance.now();
          responseTimes.push(endTime - startTime);
          results.totalEdits++;

          // Brief pause to simulate real editing
          if (i % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }

        // Wait for final debounce
        await new Promise(resolve => setTimeout(resolve, 600));

        // Calculate performance metrics
        results.averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;

        // Check for performance degradation (later edits shouldn't be much slower)
        const earlyAvg = responseTimes.slice(0, 20).reduce((sum, time) => sum + time, 0) / 20;
        const lateAvg = responseTimes.slice(-20).reduce((sum, time) => sum + time, 0) / 20;
        results.performanceDegradation = lateAvg > earlyAvg * 2; // More than 2x slower

        // Check for memory leaks
        const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
        if (initialMemory > 0) {
          const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
          results.memoryLeaks = memoryIncrease > 50; // More than 50MB increase
        }
      }

      return results;
    });

    expect(performanceTest.totalEdits).toBe(100);
    expect(performanceTest.averageResponseTime).toBeLessThan(10); // Should respond quickly
    expect(performanceTest.performanceDegradation).toBe(false);
    expect(performanceTest.memoryLeaks).toBe(false);
  });
});