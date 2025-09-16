import JSZip from 'jszip';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fixturesDir = join(__dirname, 'fixtures');
const outputPath = join(__dirname, 'fixtures', 'test-gtfs.zip');

const gtfsFiles = [
  'agency.txt',
  'routes.txt',
  'stops.txt',
  'trips.txt',
  'stop_times.txt',
  'calendar.txt',
  'calendar_dates.txt',
  'shapes.txt'
];

const zip = new JSZip();

// Add each GTFS file to the ZIP
gtfsFiles.forEach(filename => {
  const filePath = join(fixturesDir, filename);
  try {
    const content = readFileSync(filePath, 'utf8');
    zip.file(filename, content);
    console.log(`Added ${filename} to ZIP`);
  } catch (error) {
    console.error(`Error reading ${filename}:`, error.message);
  }
});

// Generate the ZIP file
zip.generateAsync({ type: 'nodebuffer' }).then(content => {
  writeFileSync(outputPath, content);
  console.log(`Test GTFS ZIP created at: ${outputPath}`);
}).catch(error => {
  console.error('Error creating ZIP:', error);
});