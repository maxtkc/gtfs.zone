import { test, expect } from '@playwright/test';
import path from 'path';

// Test application loading and basic UI
test.describe('GTFS.io Basic Functionality', () => {
  
  test('should load the application successfully', async ({ page }) => {
    await page.goto('/');
    
    // Check page title
    await expect(page).toHaveTitle('gtfs.io - GTFS Transit Data Editor');
    
    // Check main header
    await expect(page.locator('h1')).toContainText('gtfs.io');
    
    // Check upload button exists
    await expect(page.locator('#upload-btn')).toBeVisible();
    
    // Check export button exists but is disabled initially
    await expect(page.locator('#export-btn')).toBeVisible();
    await expect(page.locator('#export-btn')).toBeDisabled();
    
    // Check initial state shows welcome message
    await expect(page.locator('#map-overlay')).toBeVisible();
    await expect(page.locator('#map-overlay')).toContainText('Welcome to gtfs.io');
  });

  test('should show file tree sidebar', async ({ page }) => {
    await page.goto('/');
    
    // Check sidebar exists
    await expect(page.locator('#sidebar')).toBeVisible();
    await expect(page.locator('#file-list')).toBeVisible();
    
    // Check initial message
    await expect(page.locator('#file-list')).toContainText('Upload a GTFS file to get started');
  });

  test('should have map container', async ({ page }) => {
    await page.goto('/');
    
    // Check map container exists
    await expect(page.locator('#map')).toBeVisible();
    await expect(page.locator('#map-panel')).toBeVisible();
  });

  test('should load from URL parameter', async ({ page }) => {
    // Test with the provided real GTFS feed
    const gtfsUrl = 'http://westbusservice.com/west_gtfs.zip';
    await page.goto(`/#data=url:${gtfsUrl}`);
    
    // Wait for loading to complete (increase timeout for real download)
    await expect(page.locator('#map-overlay')).toBeHidden({ timeout: 30000 });
    
    // Should show files in sidebar
    await expect(page.locator('.file-item')).toHaveCount.toBeGreaterThan(0);
    
    // Export button should be enabled
    await expect(page.locator('#export-btn')).toBeEnabled();
  });
});

test.describe('GTFS File Upload', () => {
  test('should upload and process GTFS file', async ({ page }) => {
    await page.goto('/');
    
    // Upload our test GTFS file
    const filePath = path.join(__dirname, 'fixtures', 'test-gtfs.zip');
    
    // Set up file input
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles(filePath);
    
    // Wait for processing to complete
    await expect(page.locator('#map-overlay')).toBeHidden({ timeout: 10000 });
    
    // Check that files are listed in sidebar
    await expect(page.locator('.file-item')).toHaveCount.toBeGreaterThan(0);
    
    // Check for required files
    await expect(page.locator('.file-item.required')).toHaveCount.toBeGreaterThan(0);
    
    // Check that export button is enabled
    await expect(page.locator('#export-btn')).toBeEnabled();
    
    // Check that stops are visible on map (we have 3 stops in test data)
    // Note: We can't easily test marker visibility without more complex map interaction
    // but we can check that the overlay is hidden, indicating successful processing
  });

  test('should categorize files correctly', async ({ page }) => {
    await page.goto('/');
    
    const filePath = path.join(__dirname, 'fixtures', 'test-gtfs.zip');
    await page.locator('#file-input').setInputFiles(filePath);
    
    await expect(page.locator('#map-overlay')).toBeHidden({ timeout: 10000 });
    
    // Check for section headers
    await expect(page.locator('text=Required Files')).toBeVisible();
    await expect(page.locator('text=Optional Files')).toBeVisible();
    
    // Check specific files exist
    await expect(page.locator('text=agency.txt')).toBeVisible();
    await expect(page.locator('text=routes.txt')).toBeVisible();
    await expect(page.locator('text=stops.txt')).toBeVisible();
    await expect(page.locator('text=shapes.txt')).toBeVisible();
  });
});

test.describe('File Editor', () => {
  test('should open file editor when clicking on file', async ({ page }) => {
    await page.goto('/');
    
    const filePath = path.join(__dirname, 'fixtures', 'test-gtfs.zip');
    await page.locator('#file-input').setInputFiles(filePath);
    
    await expect(page.locator('#map-overlay')).toBeHidden({ timeout: 10000 });
    
    // Click on a file
    await page.locator('text=agency.txt').click();
    
    // Editor panel should be visible
    await expect(page.locator('#editor-panel')).toBeVisible();
    
    // Editor should contain file content
    const editor = page.locator('#simple-editor');
    await expect(editor).toBeVisible();
    
    const content = await editor.inputValue();
    expect(content).toContain('agency_id');
    expect(content).toContain('TEST_AGENCY');
  });

  test('should show active file highlighting', async ({ page }) => {
    await page.goto('/');
    
    const filePath = path.join(__dirname, 'fixtures', 'test-gtfs.zip');
    await page.locator('#file-input').setInputFiles(filePath);
    
    await expect(page.locator('#map-overlay')).toBeHidden({ timeout: 10000 });
    
    // Click on a file
    await page.locator('text=stops.txt').click();
    
    // File should be marked as active
    await expect(page.locator('.file-item.active')).toContainText('stops.txt');
  });
});

test.describe('Export Functionality', () => {
  test('should enable export after loading GTFS', async ({ page }) => {
    await page.goto('/');
    
    const filePath = path.join(__dirname, 'fixtures', 'test-gtfs.zip');
    await page.locator('#file-input').setInputFiles(filePath);
    
    await expect(page.locator('#map-overlay')).toBeHidden({ timeout: 10000 });
    
    // Export button should be enabled
    await expect(page.locator('#export-btn')).toBeEnabled();
  });

  test('should trigger download when export is clicked', async ({ page }) => {
    await page.goto('/');
    
    const filePath = path.join(__dirname, 'fixtures', 'test-gtfs.zip');
    await page.locator('#file-input').setInputFiles(filePath);
    
    await expect(page.locator('#map-overlay')).toBeHidden({ timeout: 10000 });
    
    // Set up download event listener
    const downloadPromise = page.waitForEvent('download');
    
    // Click export button
    await page.locator('#export-btn').click();
    
    // Wait for download
    const download = await downloadPromise;
    
    // Check download filename
    expect(download.suggestedFilename()).toBe('gtfs-modified.zip');
  });
});

test.describe('Responsive Layout', () => {
  test('should adapt to different screen sizes', async ({ page }) => {
    await page.goto('/');
    
    // Test desktop layout
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator('#sidebar')).toBeVisible();
    
    // Test mobile layout (though our current CSS might not be fully responsive)
    await page.setViewportSize({ width: 375, height: 667 });
    // On mobile, sidebar might be hidden or collapsed - this depends on implementation
    // For now, just check that the page doesn't break
    await expect(page.locator('h1')).toBeVisible();
  });
});

test.describe('Error Handling', () => {
  test('should handle invalid files gracefully', async ({ page }) => {
    await page.goto('/');
    
    // Try to upload a non-ZIP file
    const textFilePath = path.join(__dirname, 'fixtures', 'agency.txt');
    
    // This should not crash the application
    await page.locator('#file-input').setInputFiles(textFilePath);
    
    // App should still be functional
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should handle network errors for URL loading', async ({ page }) => {
    // Test with invalid URL
    await page.goto('/#data=url:https://invalid-url-that-does-not-exist.com/fake.zip');
    
    // Should show error and not crash
    await expect(page.locator('h1')).toBeVisible();
    
    // Map overlay should still be visible (indicating failure to load)
    await expect(page.locator('#map-overlay')).toBeVisible();
  });
});