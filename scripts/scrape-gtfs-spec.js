#!/usr/bin/env node

import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import fs from 'fs/promises';
import path from 'path';

async function scrapeGTFSSpec() {
  console.log('Fetching GTFS specification from gtfs.org...');
  
  try {
    const response = await fetch('https://gtfs.org/documentation/schedule/reference');
    const html = await response.text();
    
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Find the Dataset Files section
    const datasetFilesSection = Array.from(document.querySelectorAll('h2, h3, h4'))
      .find(h => h.textContent.toLowerCase().includes('dataset files'));
    
    let filesTable = null;
    if (datasetFilesSection) {
      let sibling = datasetFilesSection.nextElementSibling;
      while (sibling && sibling.tagName !== 'TABLE') {
        sibling = sibling.nextElementSibling;
      }
      filesTable = sibling;
    }
    
    // Extract file information
    const files = [];
    if (filesTable) {
      const rows = filesTable.querySelectorAll('tbody tr');
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
          files.push({
            filename: cells[0].textContent.trim(),
            presence: cells[1].textContent.trim(),
            description: cells[2].textContent.trim()
          });
        }
      }
    }
    
    console.log(`Found ${files.length} GTFS files`);
    
    // Find Field Definitions sections
    const fieldDefinitions = {};
    
    // Look for sections that contain field definitions
    const headings = document.querySelectorAll('h2, h3, h4');
    
    for (const heading of headings) {
      const headingText = heading.textContent.trim();
      
      // Check if this heading is for a specific file (ends with .txt)
      const fileMatch = headingText.match(/(\w+\.txt)/);
      if (fileMatch) {
        const filename = fileMatch[1];
        
        // Find the table following this heading
        let element = heading.nextElementSibling;
        let table = null;
        
        // Look for the next table within reasonable distance
        let attempts = 0;
        while (element && attempts < 10) {
          if (element.tagName === 'TABLE') {
            table = element;
            break;
          }
          element = element.nextElementSibling;
          attempts++;
        }
        
        if (table) {
          const fields = [];
          const rows = table.querySelectorAll('tbody tr');
          
          for (const row of rows) {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 4) {
              fields.push({
                fieldName: cells[0].textContent.trim(),
                type: cells[1].textContent.trim(),
                presence: cells[2].textContent.trim(),
                description: cells[3].textContent.trim()
              });
            }
          }
          
          if (fields.length > 0) {
            fieldDefinitions[filename] = fields;
            console.log(`Found ${fields.length} fields for ${filename}`);
          }
        }
      }
    }
    
    // Create the specification object
    const gtfsSpec = {
      files,
      fieldDefinitions,
      scrapedAt: new Date().toISOString(),
      sourceUrl: 'https://gtfs.org/documentation/schedule/reference'
    };
    
    // Write to file
    const outputPath = path.join(process.cwd(), 'src', 'gtfs-spec.json');
    await fs.writeFile(outputPath, JSON.stringify(gtfsSpec, null, 2));
    
    console.log(`GTFS specification saved to ${outputPath}`);
    console.log(`Total files: ${files.length}`);
    console.log(`Files with field definitions: ${Object.keys(fieldDefinitions).length}`);
    
    return gtfsSpec;
    
  } catch (error) {
    console.error('Error scraping GTFS specification:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  scrapeGTFSSpec();
}

export { scrapeGTFSSpec };