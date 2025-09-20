#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';

// Mapping from GTFS data types to TypeScript types
const typeMapping: Record<string, string> = {
  'Text': 'string',
  'URL': 'string',
  'Email': 'string',
  'Phone number': 'string',
  'Language code': 'string',
  'Currency code': 'string',
  'Timezone': 'string',
  'Date': 'string', // YYYYMMDD format
  'Time': 'string', // HH:MM:SS format
  'Color': 'string', // hex color
  'ID': 'string',
  'Integer': 'number',
  'Non-negative integer': 'number',
  'Positive integer': 'number',
  'Float': 'number',
  'Non-negative float': 'number',
  'Positive float': 'number',
  'Latitude': 'number',
  'Longitude': 'number',
  'Enum': 'number' // Will be refined based on specific values
};

function mapGTFSTypeToTS(gtfsType: string): string {
  // Handle enum types with specific values
  if (gtfsType.includes('Enum') || gtfsType.includes('0 - ') || gtfsType.includes('1 - ')) {
    // Extract enum values
    const enumMatch = gtfsType.match(/(\d+)\s*-\s*[^,\n]+/g);
    if (enumMatch) {
      const values = enumMatch.map(match => match.match(/(\d+)/)[1]);
      return values.join(' | ');
    }
  }
  
  // Handle compound types
  if (gtfsType.includes(' or ')) {
    const types = gtfsType.split(' or ').map(type => type.trim());
    return types.map(type => typeMapping[type] || 'string').join(' | ');
  }
  
  return typeMapping[gtfsType] || 'string';
}

function mapGTFSTypeToZod(gtfsType: string, fieldName: string, description: string): string {
  let zodType;
  
  // Handle enum types with specific values
  if (gtfsType.includes('Enum') || gtfsType.includes('0 - ') || gtfsType.includes('1 - ')) {
    const enumMatch = gtfsType.match(/(\d+)\s*-\s*[^,\n]+/g);
    if (enumMatch) {
      const values = enumMatch.map(match => match.match(/(\d+)/)[1]);
      zodType = `z.enum([${values.join(', ')}])`;
    } else {
      zodType = 'z.number()';
    }
  }
  // Handle compound types
  else if (gtfsType.includes(' or ')) {
    const types = gtfsType.split(' or ').map(type => type.trim());
    const zodTypes = types.map(type => {
      switch (typeMapping[type]) {
        case 'string': return 'z.string()';
        case 'number': return 'z.number()';
        default: return 'z.string()';
      }
    });
    zodType = `z.union([${zodTypes.join(', ')}])`;
  }
  // Handle specific types
  else {
    switch (typeMapping[gtfsType] || 'string') {
      case 'string':
        // Special handling for specific string formats
        if (gtfsType === 'Email') {
          zodType = 'z.string().email()';
        } else if (gtfsType === 'URL') {
          zodType = 'z.string().url()';
        } else if (gtfsType === 'Date') {
          zodType = 'z.string().regex(/^\\d{8}$/)'; // YYYYMMDD format
        } else if (gtfsType === 'Time') {
          zodType = 'z.string().regex(/^\\d{2}:\\d{2}:\\d{2}$/)'; // HH:MM:SS format
        } else if (gtfsType === 'Color') {
          zodType = 'z.string().regex(/^[0-9A-Fa-f]{6}$/)'; // hex color
        } else {
          zodType = 'z.string()';
        }
        break;
      case 'number':
        if (gtfsType.includes('Non-negative')) {
          zodType = 'z.number().min(0)';
        } else if (gtfsType.includes('Positive')) {
          zodType = 'z.number().positive()';
        } else if (gtfsType === 'Latitude') {
          zodType = 'z.number().min(-90).max(90)';
        } else if (gtfsType === 'Longitude') {
          zodType = 'z.number().min(-180).max(180)';
        } else {
          zodType = 'z.number()';
        }
        break;
      default:
        zodType = 'z.string()';
    }
  }
  
  // Add description
  const escapedDescription = description.replace(/'/g, "\\'").replace(/\n/g, ' ');
  return `${zodType}.describe('${escapedDescription}')`;
}

function formatFieldName(fieldName: string): string {
  // Convert snake_case to camelCase for TypeScript
  return fieldName.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

function generateInterfaceForFile(filename: string, fields: any[]): { interfaceName: string; interfaceCode: string } {
  const interfaceName = filename.replace('.txt', '').split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  
  let interfaceCode = `export interface ${interfaceName} {\n`;
  
  for (const field of fields) {
    const fieldName = formatFieldName(field.fieldName);
    const tsType = mapGTFSTypeToTS(field.type);
    const optional = field.presence.toLowerCase().includes('optional') ? '?' : '';
    
    // Add JSDoc comment with description
    interfaceCode += `  /** ${field.description.replace(/\n/g, ' ')} */\n`;
    interfaceCode += `  ${fieldName}${optional}: ${tsType};\n\n`;
  }
  
  interfaceCode += '}\n\n';
  
  return { interfaceName, interfaceCode };
}

function generateZodSchemaForFile(filename: string, fields: any[]): { schemaName: string; schemaCode: string } {
  const schemaName = filename.replace('.txt', '').split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('') + 'Schema';
  
  let schemaCode = `export const ${schemaName} = z.object({\n`;
  
  for (const field of fields) {
    const fieldName = formatFieldName(field.fieldName);
    const zodType = mapGTFSTypeToZod(field.type, field.fieldName, field.description);
    const optional = field.presence.toLowerCase().includes('optional');
    
    schemaCode += `  ${fieldName}: ${zodType}`;
    if (optional) {
      schemaCode += '.optional()';
    }
    schemaCode += ',\n';
  }
  
  schemaCode += '});\n\n';
  
  return { schemaName, schemaCode };
}

async function generateGTFSTypes(): Promise<string> {
  console.log('Generating TypeScript definitions and Zod schemas from GTFS specification...');
  
  try {
    // Read the scraped specification
    const specPath = path.join(process.cwd(), 'src', 'gtfs-spec.json');
    const specContent = await fs.readFile(specPath, 'utf-8');
    const gtfsSpec = JSON.parse(specContent);
    
    let typeDefinitions = `/**
 * GTFS (General Transit Feed Specification) TypeScript definitions and Zod schemas
 * 
 * Generated from ${gtfsSpec.sourceUrl}
 * Scraped at: ${gtfsSpec.scrapedAt}
 * 
 * This file contains TypeScript interfaces and Zod schemas for all GTFS files and their fields.
 * Zod schemas include field descriptions accessible at runtime.
 */

import { z } from 'zod';

`;

    const interfaces = [];
    const schemas = [];
    
    // Generate interfaces and schemas for each file
    for (const [filename, fields] of Object.entries(gtfsSpec.fieldDefinitions)) {
      if (fields && fields.length > 0) {
        const { interfaceName, interfaceCode } = generateInterfaceForFile(filename, fields);
        const { schemaName, schemaCode } = generateZodSchemaForFile(filename, fields);
        
        interfaces.push(interfaceName);
        schemas.push(schemaName);
        
        // Add Zod schema first
        typeDefinitions += schemaCode;
        
        // Add TypeScript interface (inferred from schema)
        typeDefinitions += `// TypeScript interface inferred from Zod schema\n`;
        typeDefinitions += `export type ${interfaceName} = z.infer<typeof ${schemaName}>;\n\n`;
      }
    }
    
    // Generate union types for schemas and records
    typeDefinitions += `// Union type for all GTFS record schemas\n`;
    typeDefinitions += `export const GTFSSchemas = {\n`;
    for (const [filename, fields] of Object.entries(gtfsSpec.fieldDefinitions)) {
      if (fields && fields.length > 0) {
        const schemaName = filename.replace('.txt', '').split('_')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join('') + 'Schema';
        typeDefinitions += `  '${filename}': ${schemaName},\n`;
      }
    }
    typeDefinitions += `} as const;\n\n`;
    
    typeDefinitions += `// Union type for all GTFS record types\n`;
    typeDefinitions += `export type GTFSRecord = ${interfaces.join(' | ')};\n\n`;
    
    // Generate file presence enum
    typeDefinitions += `// File presence requirements\n`;
    typeDefinitions += `export enum GTFSFilePresence {\n`;
    typeDefinitions += `  Required = 'Required',\n`;
    typeDefinitions += `  Optional = 'Optional',\n`;
    typeDefinitions += `  ConditionallyRequired = 'Conditionally Required'\n`;
    typeDefinitions += `}\n\n`;
    
    // Generate file metadata interface
    typeDefinitions += `// GTFS file metadata\n`;
    typeDefinitions += `export interface GTFSFileInfo {\n`;
    typeDefinitions += `  filename: string;\n`;
    typeDefinitions += `  presence: GTFSFilePresence;\n`;
    typeDefinitions += `  description: string;\n`;
    typeDefinitions += `  schema: z.ZodSchema;\n`;
    typeDefinitions += `}\n\n`;
    
    // Generate file list constant
    typeDefinitions += `// Complete list of GTFS files\n`;
    typeDefinitions += `export const GTFS_FILES: GTFSFileInfo[] = [\n`;
    for (const file of gtfsSpec.files) {
      let presenceValue;
      switch (file.presence) {
        case 'Required':
          presenceValue = 'GTFSFilePresence.Required';
          break;
        case 'Optional':
          presenceValue = 'GTFSFilePresence.Optional';
          break;
        case 'Conditionally Required':
          presenceValue = 'GTFSFilePresence.ConditionallyRequired';
          break;
        default:
          presenceValue = 'GTFSFilePresence.Optional';
      }
      
      const hasSchema = gtfsSpec.fieldDefinitions[file.filename] && gtfsSpec.fieldDefinitions[file.filename].length > 0;
      const schemaRef = hasSchema ? `GTFSSchemas['${file.filename}']` : 'z.any()';
      
      typeDefinitions += `  {\n`;
      typeDefinitions += `    filename: '${file.filename}',\n`;
      typeDefinitions += `    presence: ${presenceValue},\n`;
      typeDefinitions += `    description: '${file.description.replace(/'/g, "\\'")}',\n`;
      typeDefinitions += `    schema: ${schemaRef}\n`;
      typeDefinitions += `  },\n`;
    }
    typeDefinitions += `];\n\n`;
    
    // Generate a map of filename to interface type
    typeDefinitions += `// Map of filename to TypeScript interface\n`;
    typeDefinitions += `export const GTFS_FILE_TYPES = {\n`;
    for (const [filename, fields] of Object.entries(gtfsSpec.fieldDefinitions)) {
      if (fields && fields.length > 0) {
        const interfaceName = filename.replace('.txt', '').split('_')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join('');
        typeDefinitions += `  '${filename}': '${interfaceName}' as const,\n`;
      }
    }
    typeDefinitions += `} as const;\n\n`;
    
    // Generate utility functions for accessing field descriptions
    typeDefinitions += `// Utility functions for accessing schema metadata\n`;
    typeDefinitions += `export function getFieldDescription(filename: string, fieldName: string): string | undefined {\n`;
    typeDefinitions += `  const schema = GTFSSchemas[filename as keyof typeof GTFSSchemas];\n`;
    typeDefinitions += `  if (!schema) return undefined;\n`;
    typeDefinitions += `  \n`;
    typeDefinitions += `  // Get the shape of the schema\n`;
    typeDefinitions += `  const shape = (schema as any).shape;\n`;
    typeDefinitions += `  if (!shape || !shape[fieldName]) return undefined;\n`;
    typeDefinitions += `  \n`;
    typeDefinitions += `  // Extract description from the field schema\n`;
    typeDefinitions += `  return shape[fieldName]?.description;\n`;
    typeDefinitions += `}\n\n`;
    
    typeDefinitions += `export function getFileSchema(filename: string): z.ZodSchema | undefined {\n`;
    typeDefinitions += `  return GTFSSchemas[filename as keyof typeof GTFSSchemas];\n`;
    typeDefinitions += `}\n\n`;
    
    typeDefinitions += `export function getAllFieldDescriptions(filename: string): Record<string, string> {\n`;
    typeDefinitions += `  const schema = GTFSSchemas[filename as keyof typeof GTFSSchemas];\n`;
    typeDefinitions += `  if (!schema) return {};\n`;
    typeDefinitions += `  \n`;
    typeDefinitions += `  const shape = (schema as any).shape;\n`;
    typeDefinitions += `  const descriptions: Record<string, string> = {};\n`;
    typeDefinitions += `  \n`;
    typeDefinitions += `  for (const [fieldName, fieldSchema] of Object.entries(shape || {})) {\n`;
    typeDefinitions += `    const desc = (fieldSchema as any)?.description;\n`;
    typeDefinitions += `    if (desc) {\n`;
    typeDefinitions += `      descriptions[fieldName] = desc;\n`;
    typeDefinitions += `    }\n`;
    typeDefinitions += `  }\n`;
    typeDefinitions += `  \n`;
    typeDefinitions += `  return descriptions;\n`;
    typeDefinitions += `}\n\n`;
    
    // Write the TypeScript definitions file
    const outputPath = path.join(process.cwd(), 'src', 'types', 'gtfs.ts');
    
    // Ensure types directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    await fs.writeFile(outputPath, typeDefinitions);
    
    console.log(`TypeScript definitions and Zod schemas saved to ${outputPath}`);
    console.log(`Generated ${interfaces.length} interfaces and ${schemas.length} Zod schemas for GTFS files`);
    
    return typeDefinitions;
    
  } catch (error) {
    console.error('Error generating TypeScript definitions:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateGTFSTypes();
}

export { generateGTFSTypes };