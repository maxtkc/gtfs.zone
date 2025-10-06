#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import {
  GTFSFieldType,
  GTFS_FIELD_TYPE_METADATA,
  mapGTFSTypeString,
} from '../src/types/gtfs-field-types.js';

// Extract primary key mappings from GTFS spec
function extractPrimaryKeys(gtfsSpec: any): Record<string, string> {
  const primaryKeys: Record<string, string> = {};

  for (const [filename, fields] of Object.entries(gtfsSpec.fieldDefinitions)) {
    if (!fields || !Array.isArray(fields)) continue;

    // Find the first field with type "Unique ID" or "ID" that's not optional
    const primaryKeyField = fields.find(field =>
      (field.type === 'Unique ID' || field.type === 'ID') &&
      !field.presence?.toLowerCase().includes('optional')
    );

    // If no required unique ID found, find the first Unique ID (even if optional)
    const fallbackKeyField = fields.find(field =>
      field.type === 'Unique ID' || field.type === 'ID'
    );

    const keyField = primaryKeyField || fallbackKeyField;

    if (keyField) {
      // Keep the original snake_case field name to match GTFS specification
      primaryKeys[filename] = keyField.fieldName;
    }
  }

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
  // Use hardcoded field type metadata for validation
  else {
    const fieldType = mapGTFSTypeString(gtfsType);
    const metadata = GTFS_FIELD_TYPE_METADATA[fieldType];

    if (metadata) {
      // Generate Zod validator using the metadata's zodValidator function
      // We'll use a simplified version here since we can't execute the function directly in code generation
      switch (fieldType) {
        case GTFSFieldType.Email:
          zodType = 'z.string().email()';
          break;
        case GTFSFieldType.URL:
          zodType = 'z.string().url()';
          break;
        case GTFSFieldType.Date:
          zodType = 'z.string().regex(/^\\d{8}$/, \'Must be in YYYYMMDD format\')';
          break;
        case GTFSFieldType.Time:
          zodType = 'z.string().regex(/^\\d{1,2}:\\d{2}:\\d{2}$/, \'Must be in HH:MM:SS format\')';
          break;
        case GTFSFieldType.Color:
          zodType = 'z.string().regex(/^[0-9A-Fa-f]{6}$/, \'Must be a 6-digit hexadecimal color\')';
          break;
        case GTFSFieldType.LanguageCode:
          zodType = 'z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, \'Must be a valid IETF BCP 47 language code\')';
          break;
        case GTFSFieldType.CurrencyCode:
          zodType = 'z.string().regex(/^[A-Z]{3}$/, \'Must be a 3-letter ISO 4217 currency code\')';
          break;
        case GTFSFieldType.CurrencyAmount:
          zodType = 'z.string().regex(/^\\d+(\\.\\d{1,4})?$/, \'Must be a valid decimal amount\')';
          break;
        case GTFSFieldType.Latitude:
          zodType = 'z.number().min(-90.0).max(90.0)';
          break;
        case GTFSFieldType.Longitude:
          zodType = 'z.number().min(-180.0).max(180.0)';
          break;
        case GTFSFieldType.Integer:
          zodType = 'z.number().int()';
          break;
        case GTFSFieldType.NonNegativeInteger:
          zodType = 'z.number().int().nonnegative()';
          break;
        case GTFSFieldType.PositiveInteger:
          zodType = 'z.number().int().positive()';
          break;
        case GTFSFieldType.Float:
          zodType = 'z.number()';
          break;
        case GTFSFieldType.NonNegativeFloat:
          zodType = 'z.number().nonnegative()';
          break;
        case GTFSFieldType.PositiveFloat:
          zodType = 'z.number().positive()';
          break;
        default:
          zodType = 'z.string()';
      }
    } else {
      zodType = 'z.string()';
    }
  }

  // Add description with properly escaped special characters
  const escapedDescription = description
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/'/g, "\\'")     // Escape single quotes
    .replace(/\n/g, '\\n')    // Escape newlines (preserve them, don't convert to spaces)
    .replace(/\r/g, '\\r');   // Escape carriage returns
  return `${zodType}.describe('${escapedDescription}')`;
}

function formatFieldName(fieldName: string): string {
  // Keep snake_case field names to match GTFS specification
  return fieldName;
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

// Extract field type mappings from GTFS spec
function extractFieldTypeMappings(gtfsSpec: any): Record<string, Record<string, string>> {
  const fieldTypes: Record<string, Record<string, string>> = {};

  for (const [filename, fields] of Object.entries(gtfsSpec.fieldDefinitions)) {
    if (!fields || !Array.isArray(fields)) continue;

    fieldTypes[filename] = {};
    for (const field of fields) {
      // Store the raw GTFS type string which will be mapped to GTFSFieldType enum
      fieldTypes[filename][field.fieldName] = field.type;
    }
  }

  return fieldTypes;
}

// Extract enum definitions from GTFS spec
interface EnumOption {
  value: number | string;
  label: string;
  description?: string;
}

function extractEnumDefinitions(gtfsSpec: any): Record<string, EnumOption[]> {
  const enums: Record<string, EnumOption[]> = {};

  for (const [filename, fields] of Object.entries(gtfsSpec.fieldDefinitions)) {
    if (!fields || !Array.isArray(fields)) continue;

    for (const field of fields) {
      // Check if field type is Enum or contains enum values
      const isEnum = field.type === 'Enum' ||
                     field.type.includes('0 - ') ||
                     field.type.includes('1 - ') ||
                     (field.description && /\n\d+\s*-\s*.+/m.test(field.description));

      if (isEnum) {
        const options: EnumOption[] = [];

        // Try to parse enum values from type field first
        let enumText = field.type;

        // If type is just "Enum", look in description
        if (field.type === 'Enum' && field.description) {
          enumText = field.description;
        }

        // Parse enum values with format: "NUMBER - Label text. Description text."
        // Split on newlines first, then parse each line
        const lines = enumText.split('\n');
        let currentOption: EnumOption | null = null;

        for (const line of lines) {
          // Check if this line starts a new enum option (starts with NUMBER -)
          const optionMatch = line.match(/^(\d+)\s*-\s*(.+)/);

          if (optionMatch) {
            // Save previous option if exists
            if (currentOption) {
              options.push(currentOption);
            }

            const value = parseInt(optionMatch[1], 10);
            const rest = optionMatch[2].trim();

            // Split label and description by first sentence-ending period
            // This regex looks for a period followed by:
            // - Optional closing parenthesis
            // - Optional space
            // - A capital letter (start of new sentence/example)
            // But NOT abbreviations like "e.g." or "i.e."
            const labelMatch = rest.match(/^(.*?(?:e\.g\.|i\.e\.|[^.])+)\.\)?\s*([A-Z].*|$)/);

            let label: string;
            let description: string | undefined;

            if (labelMatch) {
              // Found a clear sentence boundary
              label = labelMatch[1].trim();
              // If there's a closing paren after the period, include it in the label
              if (rest.charAt(labelMatch[1].length + 1) === ')') {
                label += ')';
              }
              description = labelMatch[2]?.trim();
            } else {
              // No clear boundary, check if there's a period at the end
              const endPeriodMatch = rest.match(/^(.+)\.\)?\s*$/);
              if (endPeriodMatch) {
                // Has period at end, use everything as label
                label = endPeriodMatch[1].trim();
                // Include closing paren if present
                if (rest.endsWith(')')) {
                  label += ')';
                }
                description = undefined;
              } else {
                // No period, use entire text as label
                label = rest;
                description = undefined;
              }
            }

            currentOption = {
              value,
              label,
              description: description && description.length > 0 ? description : undefined,
            };
          } else if (currentOption && line.trim()) {
            // Continuation of description from previous line
            const desc = currentOption.description || '';
            currentOption.description = desc ? `${desc}\n${line.trim()}` : line.trim();
          }
        }

        // Push the last option
        if (currentOption) {
          options.push(currentOption);
        }

        // Only add to enums if we found valid options
        if (options.length > 0) {
          enums[field.fieldName] = options;
        }
      }
    }
  }

  return enums;
}

// Generate gtfs-enums.ts file content
function generateGTFSEnums(
  enums: Record<string, EnumOption[]>,
  gtfsSpec: any
): string {
  let content = `/**
 * GTFS Enumeration Definitions
 *
 * Generated from ${gtfsSpec.sourceUrl}
 * Scraped at: ${gtfsSpec.scrapedAt}
 *
 * Defines all valid enum values for GTFS fields based on the official specification.
 */

export interface GTFSEnumOption {
  value: number | string;
  label: string;
  description?: string;
}

/**
 * Registry of all GTFS enum fields and their valid values
 */
export const GTFS_ENUMS: Record<string, GTFSEnumOption[]> = {\n`;

  // Sort enum fields alphabetically for consistency
  const sortedEnumKeys = Object.keys(enums).sort();

  for (const fieldName of sortedEnumKeys) {
    const options = enums[fieldName];

    content += `  ${fieldName}: [\n`;

    for (const option of options) {
      content += `    {\n`;
      content += `      value: ${typeof option.value === 'string' ? `'${option.value}'` : option.value},\n`;

      // Escape single quotes in label
      const escapedLabel = option.label.replace(/'/g, "\\'");
      content += `      label: '${escapedLabel}',\n`;

      if (option.description) {
        // Escape single quotes and newlines in description
        const escapedDesc = option.description
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'")
          .replace(/\n/g, '\\n');
        content += `      description: '${escapedDesc}',\n`;
      }

      content += `    },\n`;
    }

    content += `  ],\n\n`;
  }

  content += `};\n\n`;

  // Add helper functions
  content += `/**
 * Get enum options for a specific field
 */
export function getEnumOptions(fieldName: string): GTFSEnumOption[] | undefined {
  return GTFS_ENUMS[fieldName];
}

/**
 * Check if a field is an enum field
 */
export function isEnumField(fieldName: string): boolean {
  return fieldName in GTFS_ENUMS;
}

/**
 * Get the label for a specific enum value
 */
export function getEnumLabel(fieldName: string, value: number | string): string | undefined {
  const options = GTFS_ENUMS[fieldName];
  if (!options) return undefined;

  const option = options.find(opt => opt.value === value);
  return option?.label;
}

/**
 * Get the description for a specific enum value
 */
export function getEnumDescription(fieldName: string, value: number | string): string | undefined {
  const options = GTFS_ENUMS[fieldName];
  if (!options) return undefined;

  const option = options.find(opt => opt.value === value);
  return option?.description;
}
`;

  return content;
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
    const primaryKeys = extractPrimaryKeys(gtfsSpec);
    console.log(`Generated primary key mappings for ${Object.keys(primaryKeys).length} GTFS files`);

    // Extract field type mappings from the specification
    const fieldTypeMappings = extractFieldTypeMappings(gtfsSpec);
    console.log(`Generated field type mappings for ${Object.keys(fieldTypeMappings).length} GTFS files`);

    // Extract enum definitions from the specification
    const enumDefinitions = extractEnumDefinitions(gtfsSpec);
    console.log(`Found ${Object.keys(enumDefinitions).length} enum fields`);

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

// Field type mappings extracted from GTFS specification
// Maps filename -> fieldName -> GTFS type string (e.g., "Text", "Integer", "Enum")
export const GTFS_FIELD_TYPES = ${JSON.stringify(fieldTypeMappings, null, 2)} as const;

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
      
      // Escape string for TypeScript: single quotes, newlines, and backslashes
      const escapedDescription = file.description
        .replace(/\\/g, '\\\\')  // Escape backslashes first
        .replace(/'/g, "\\'")     // Escape single quotes
        .replace(/\n/g, '\\n')    // Escape newlines
        .replace(/\r/g, '\\r');   // Escape carriage returns

      typeDefinitions += `  {\n`;
      typeDefinitions += `    filename: '${file.filename}',\n`;
      typeDefinitions += `    presence: ${presenceValue},\n`;
      typeDefinitions += `    description: '${escapedDescription}',\n`;
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

    // Generate GTFS table name constants
    typeDefinitions += `// GTFS table name constants for type-safe table references\n`;
    typeDefinitions += `export const GTFS_TABLES = {\n`;
    for (const file of gtfsSpec.files) {
      // Convert filename to constant name (e.g., 'agency.txt' -> 'AGENCY')
      const constantName = file.filename
        .replace('.txt', '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '_');

      typeDefinitions += `  ${constantName}: '${file.filename}',\n`;
    }
    typeDefinitions += `} as const;\n\n`;

    // Generate table name type
    typeDefinitions += `// Union type for all GTFS table names\n`;
    typeDefinitions += `export type GTFSTableName = typeof GTFS_TABLES[keyof typeof GTFS_TABLES];\n\n`;

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

    // Generate gtfs-enums.ts file
    const enumsContent = generateGTFSEnums(enumDefinitions, gtfsSpec);
    const enumsPath = path.join(process.cwd(), 'src', 'types', 'gtfs-enums.ts');
    await fs.writeFile(enumsPath, enumsContent);
    console.log(`GTFS enum definitions saved to ${enumsPath}`);

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