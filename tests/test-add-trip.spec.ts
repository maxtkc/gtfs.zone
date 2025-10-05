import { test, expect } from '@playwright/test';

test('Add Trip and Stop with always-visible inputs', async ({ page }) => {
  // Load app with real GTFS data via URL
  const gtfsUrl = 'http://westbusservice.com/west_gtfs.zip';
  await page.goto(`/#data=url:${gtfsUrl}`);

  // Wait for loading to complete
  console.log('Waiting for GTFS data to load...');
  await expect(page.locator('#map-overlay')).toBeHidden({ timeout: 30000 });
  console.log('✅ GTFS file loaded successfully');

  // Click on West's Transportation agency to show routes
  console.log('Clicking on agency...');
  await page.click('text=West\'s Transportation');
  await page.waitForTimeout(500);

  // Click on the first route (Ellsworth)
  console.log('Clicking on first route card...');
  await page.click('text=Ellsworth');
  await page.waitForTimeout(1000);

  // Click on "View Timetable" button
  console.log('Clicking View Timetable button...');
  await page.click('text=View Timetable');
  await page.waitForTimeout(2000);
  console.log('Timetable should be loaded now');

  // Take a screenshot to see current state
  await page.screenshot({ path: 'timetable-loaded.png', fullPage: true });
  console.log('Screenshot saved: timetable-loaded.png');

  // Look for the new trip input (always visible in rightmost column)
  console.log('Looking for new trip input field...');
  const newTripInput = page.locator('#new-trip-input');

  const inputExists = await newTripInput.count() > 0;
  console.log('New trip input exists:', inputExists);

  if (inputExists) {
    // Scroll the input into view
    await newTripInput.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const isVisible = await newTripInput.isVisible();
    console.log('New trip input visible:', isVisible);

    if (isVisible) {
      // Take a screenshot showing the input
      await page.screenshot({ path: 'new-trip-input-visible.png', fullPage: true });
      console.log('✅ Screenshot saved: new-trip-input-visible.png');

      // Test entering a trip ID
      console.log('Typing trip ID into input...');
      await newTripInput.fill('test_trip_999');
      await page.waitForTimeout(500);

      // Take screenshot with value
      await page.screenshot({ path: 'trip-id-entered.png', fullPage: true });
      console.log('Screenshot saved: trip-id-entered.png');

      // Trigger the change event (blur or press Enter)
      await newTripInput.press('Tab');
      await page.waitForTimeout(2000); // Wait for trip creation

      // Take final screenshot
      await page.screenshot({ path: 'after-trip-created.png', fullPage: true });
      console.log('✅ Screenshot saved: after-trip-created.png');

      // Check for success notification
      const notification = await page.locator('.alert, .toast').count();
      console.log('Notification shown:', notification > 0);

      expect(isVisible).toBe(true);
      console.log('✅ TEST PASSED - New trip input is always visible!');
    } else {
      console.error('❌ New trip input not visible');
      throw new Error('New trip input not visible');
    }
  } else {
    console.error('❌ New trip input does not exist in DOM');

    // Check what's in the page
    const scheduleView = await page.locator('#schedule-view').count();
    console.log('schedule-view count:', scheduleView);

    const pageText = await page.locator('body').innerText();
    console.log('Page contains "New trip":', pageText.includes('New trip'));

    throw new Error('New trip input does not exist');
  }

  // Also check for new stop selector
  console.log('Looking for new stop selector...');
  const newStopSelect = page.locator('#new-stop-select');
  const selectExists = await newStopSelect.count() > 0;
  console.log('New stop selector exists:', selectExists);

  if (selectExists) {
    await newStopSelect.scrollIntoViewIfNeeded();
    const selectVisible = await newStopSelect.isVisible();
    console.log('New stop selector visible:', selectVisible);

    if (selectVisible) {
      // Take screenshot
      await page.screenshot({ path: 'new-stop-selector-visible.png', fullPage: true });
      console.log('✅ New stop selector is visible!');
    }
  }
});
