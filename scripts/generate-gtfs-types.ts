#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';

// Extract primary key mappings from GTFS spec
function extractPrimaryKeys(): Record<string, string> {
  const primaryKeys: Record<string, string> = {
    'agency.txt': 'agencyId',
    'stops.txt': 'stopId',
    'routes.txt': 'routeId',
    'trips.txt': 'tripId',
    'stop_times.txt': 'tripId',
    'pathways.txt': 'pathwayId',
    'levels.txt': 'levelId',
    'attributions.txt': 'attributionId',
    'calendar.txt': 'serviceId',
    'calendar_dates.txt': 'serviceId',
    'fare_attributes.txt': 'fareId',
    'fare_rules.txt': 'fareId',
    'shapes.txt': 'shapeId',
    'frequencies.txt': 'tripId',
    'transfers.txt': 'fromStopId',
    'feed_info.txt': 'feedPublisherName'
  };

  return primaryKeys;
}

// Map presence string to GTFSFilePresence enum value
function mapPresenceValue(presence: string): string {
  const presenceMap: Record<string, string> = {
    'Required': 'GTFSFilePresence.Required',
    'Optional': 'GTFSFilePresence.Optional',
    'Conditionally Required': 'GTFSFilePresence.ConditionallyRequired',
    'Conditionally Forbidden': 'GTFSFilePresence.ConditionallyForbidden',
    'Recommended': 'GTFSFilePresence.Recommended'
  };

  return presenceMap[presence] || 'GTFSFilePresence.Optional';
}

// Extract foreign key relationships from GTFS spec
function extractForeignKeyRelationships(gtfsSpec: any): Array<{
  sourceFile: string;
  sourceField: string;
  targetFile: string;
  targetField: string;
  description: string;
  optional: boolean;
}> {
  const relationships = [];

  for (const [filename, fields] of Object.entries(gtfsSpec.fieldDefinitions)) {
    if (!fields || !Array.isArray(fields)) continue;

    for (const field of fields) {
      // Look for "Foreign ID referencing" pattern
      if (field.type && field.type.includes('Foreign ID referencing')) {
        // Parse patterns like:
        // "Foreign ID referencing stops.stop_id"
        // "Foreign ID referencing calendar.service_id or calendar_dates.service_id"
        const foreignIdMatch = field.type.match(/Foreign ID referencing ([^,\s]+)/);

        if (foreignIdMatch) {
          const targetRef = foreignIdMatch[1];

          // Handle multiple target files (e.g., "calendar.service_id or calendar_dates.service_id")
          const targets = field.type.match(/referencing ([^,]+)/)[1]
            .split(' or ')
            .map(ref => ref.trim());

          for (const target of targets) {
            // Parse "table.field" or "table.field_name"
            const targetMatch = target.match(/^([^.]+)\.(.+)$/);
            if (targetMatch) {
              const [, targetTable, targetField] = targetMatch;

              // Convert to filename if needed
              const targetFile = targetTable.includes('.') ? targetTable : `${targetTable}.txt`;

              relationships.push({
                sourceFile: filename,
                sourceField: formatFieldName(field.fieldName),
                targetFile: targetFile,
                targetField: formatFieldName(targetField),
                description: `${field.fieldName} references ${target}`,
                optional: field.presence?.toLowerCase().includes('optional') ||
                         field.presence?.toLowerCase().includes('conditionally')
              });
            }
          }
        }
      }
    }
  }

  return relationships;
}

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

function mapGTFSTypeToZod(gtfsType: string, fieldName: string, description: string, relationships: any[]): string {
  let zodType;

  // Check if this field is a foreign key
  const isForeignKey = gtfsType.includes('Foreign ID referencing');

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
  // Handle foreign key types
  else if (isForeignKey) {
    zodType = 'z.string()';
    // Note: Foreign key validation will be added at the schema level
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

function generateZodSchemaForFile(filename: string, fields: any[], relationships: any[]): { schemaName: string; schemaCode: string } {
  const schemaName = filename.replace('.txt', '').split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('') + 'Schema';

  // Get foreign key relationships for this file
  const fileRelationships = relationships.filter(rel => rel.sourceFile === filename);

  let schemaCode = `export const ${schemaName} = z.object({\n`;

  for (const field of fields) {
    const fieldName = formatFieldName(field.fieldName);
    const zodType = mapGTFSTypeToZod(field.type, field.fieldName, field.description, relationships);
    const optional = field.presence.toLowerCase().includes('optional');

    schemaCode += `  ${fieldName}: ${zodType}`;
    if (optional) {
      schemaCode += '.optional()';
    }
    schemaCode += ',\n';
  }

  schemaCode += '})';

  // Add foreign key validation refinements
  if (fileRelationships.length > 0) {
    schemaCode += `.superRefine((_data, _ctx) => {
    // Foreign key validation will be added by GTFSValidator
    // This allows for context-aware validation with access to all GTFS data
  })`;
  }

  schemaCode += ';\n\n';

  return { schemaName, schemaCode };
}

async function generateGTFSTypes(): Promise<string> {
  console.log('Generating TypeScript definitions and Zod schemas from GTFS specification...');

  try {
    // Read the scraped specification
    const specPath = path.join(process.cwd(), 'src', 'gtfs-spec.json');
    const specContent = await fs.readFile(specPath, 'utf-8');
    const gtfsSpec = JSON.parse(specContent);

    // Extract foreign key relationships from the specification
    const relationships = extractForeignKeyRelationships(gtfsSpec);
    console.log(`Found ${relationships.length} foreign key relationships`);

    // Extract primary keys from the specification
    const primaryKeys = extractPrimaryKeys();
    console.log(`Generated primary key mappings for ${Object.keys(primaryKeys).length} GTFS files`);

    let typeDefinitions = `/**
 * GTFS (General Transit Feed Specification) TypeScript definitions and Zod schemas
 *
 * Generated from ${gtfsSpec.sourceUrl}
 * Scraped at: ${gtfsSpec.scrapedAt}
 *
 * This file contains TypeScript interfaces and Zod schemas for all GTFS files and their fields.
 * Zod schemas include field descriptions accessible at runtime and foreign key validation.
 */

import { z } from 'zod';

// Foreign key relationships extracted from GTFS specification
export const GTFS_RELATIONSHIPS = ${JSON.stringify(relationships, null, 2)} as const;

// Primary key mappings for GTFS files
export const GTFS_PRIMARY_KEYS = ${JSON.stringify(primaryKeys, null, 2)} as const;

// Validation context interface for foreign key checking
export interface GTFSValidationContext {
  [filename: string]: Map<string, unknown>;
}

// Foreign key validation utilities
export function validateForeignKey(
  value: string,
  targetFile: string,
  targetField: string,
  context: GTFSValidationContext,
  optional: boolean = false
): { valid: boolean; message?: string } {
  // Allow empty values for optional fields
  if (optional && (!value || value.trim() === '')) {
    return { valid: true };
  }

  const targetData = context[targetFile];
  if (!targetData) {
    return {
      valid: false,
      message: \`Target file \${targetFile} not found in validation context\`
    };
  }

  if (!targetData.has(value)) {
    return {
      valid: false,
      message: \`Referenced \${targetField} '\${value}' not found in \${targetFile}\`
    };
  }

  return { valid: true };
}

`;

    const interfaces = [];
    const schemas = [];

    // Generate interfaces and schemas for each file
    for (const [filename, fields] of Object.entries(gtfsSpec.fieldDefinitions)) {
      if (fields && fields.length > 0) {
        const { interfaceName, interfaceCode } = generateInterfaceForFile(filename, fields);
        const { schemaName, schemaCode } = generateZodSchemaForFile(filename, fields, relationships);

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
    typeDefinitions += `  ConditionallyRequired = 'Conditionally Required',\n`;
    typeDefinitions += `  ConditionallyForbidden = 'Conditionally Forbidden',\n`;
    typeDefinitions += `  Recommended = 'Recommended'\n`;
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
      const presenceValue = mapPresenceValue(file.presence);
      
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
    typeDefinitions += `  const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;\n`;
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
    typeDefinitions += `  const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;\n`;
    typeDefinitions += `  const descriptions: Record<string, string> = {};\n`;
    typeDefinitions += `  \n`;
    typeDefinitions += `  for (const [fieldName, fieldSchema] of Object.entries(shape || {})) {\n`;
    typeDefinitions += `    const desc = (fieldSchema as z.ZodSchema & { description?: string })?.description;\n`;
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