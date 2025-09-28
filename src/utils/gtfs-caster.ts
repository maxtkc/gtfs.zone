/**
 * GTFS Casting and Validation Utilities
 */

import { z } from 'zod';
import {
  GTFSSchemas,
  GTFSRecord,
  GTFS_RELATIONSHIPS,
  GTFS_PRIMARY_KEYS,
  GTFSValidationContext,
  validateForeignKey,
  GTFS_TABLES,
} from '../types/gtfs.js';
import { GTFSRelationshipResolver } from './gtfs-relationships.js';
import { GTFSTableMap } from '../types/gtfs-entities.js';

export interface ValidationResult {
  success: boolean;
  data?: GTFSRecord[];
  errors?: z.ZodError[];
  warnings?: string[];
}

export interface CastOptions {
  strict?: boolean; // Fail on any validation error
  skipMissingFiles?: boolean; // Allow missing optional files
  resolveRelationships?: boolean; // Resolve foreign key relationships
  validateForeignKeys?: boolean; // Validate foreign key references
}

export class GTFSCaster {
  private relationshipResolver?: GTFSRelationshipResolver;
  private validationContext?: GTFSValidationContext;

  /**
   * Validate and cast a single GTFS file
   */
  public validateFile(
    filename: string,
    rawData: Record<string, unknown>[],
    options: CastOptions = {}
  ): ValidationResult {
    const schema = GTFSSchemas[filename as keyof typeof GTFSSchemas];

    if (!schema) {
      return {
        success: false,
        errors: [
          new z.ZodError([
            {
              code: 'custom',
              message: `No schema found for file: ${filename}`,
              path: [filename],
            },
          ]),
        ],
        warnings: [],
      };
    }

    const results: ValidationResult = {
      success: true,
      data: [],
      errors: [],
      warnings: [],
    };

    // Validate each record
    for (let i = 0; i < rawData.length; i++) {
      try {
        const validatedRecord = schema.parse(rawData[i]);
        results.data!.push(validatedRecord);
      } catch (error) {
        if (error instanceof z.ZodError) {
          results.errors!.push(error);
          if (options.strict) {
            results.success = false;
            break;
          }
        }
      }
    }

    // Set success based on whether we have data and no critical errors
    results.success =
      results.data!.length > 0 &&
      (options.strict ? results.errors!.length === 0 : true);

    return results;
  }

  /**
   * Build validation context from validated GTFS data
   */
  private buildValidationContext(results: {
    [filename: string]: ValidationResult;
  }): GTFSValidationContext {
    const context: GTFSValidationContext = {};

    for (const [filename, result] of Object.entries(results)) {
      if (result.success && result.data) {
        const dataMap = new Map<string, Record<string, unknown>>();

        // Determine the primary key field for this file
        const primaryKeyField = this.getPrimaryKeyField(filename);

        for (const record of result.data) {
          const primaryKey = (record as Record<string, unknown>)[
            primaryKeyField
          ];
          if (primaryKey) {
            dataMap.set(primaryKey, record);
          }
        }

        context[filename] = dataMap;
      }
    }

    return context;
  }

  /**
   * Get the primary key field name for a GTFS file
   */
  private getPrimaryKeyField(filename: string): string {
    return (
      GTFS_PRIMARY_KEYS[filename as keyof typeof GTFS_PRIMARY_KEYS] || 'id'
    );
  }

  /**
   * Validate foreign key references for a single record
   */
  private validateRecordForeignKeys(
    filename: string,
    record: Record<string, unknown>,
    context: GTFSValidationContext
  ): Array<{ field: string; message: string }> {
    const errors: Array<{ field: string; message: string }> = [];

    // Get foreign key relationships for this file
    const relationships = GTFS_RELATIONSHIPS.filter(
      (rel) => rel.sourceFile === filename
    );

    for (const relationship of relationships) {
      const value = record[relationship.sourceField];

      // Skip validation if field is empty and optional
      if (relationship.optional && (!value || value.trim() === '')) {
        continue;
      }

      if (value) {
        const validation = validateForeignKey(
          value,
          relationship.targetFile,
          relationship.targetField,
          context,
          relationship.optional
        );

        if (!validation.valid && validation.message) {
          errors.push({
            field: relationship.sourceField,
            message: validation.message,
          });
        }
      }
    }

    return errors;
  }

  /**
   * Validate and cast an entire GTFS feed
   */
  public validateFeed(
    rawGtfsData: { [filename: string]: Record<string, unknown>[] },
    options: CastOptions = {}
  ): { [filename: string]: ValidationResult } {
    const results: { [filename: string]: ValidationResult } = {};

    // First pass: Basic validation of each file
    for (const [filename, data] of Object.entries(rawGtfsData)) {
      results[filename] = this.validateFile(filename, data, options);
    }

    // Second pass: Foreign key validation if requested
    if (options.validateForeignKeys) {
      this.validationContext = this.buildValidationContext(results);

      // Re-validate each file with foreign key checks
      for (const [filename, result] of Object.entries(results)) {
        if (result.success && result.data) {
          const foreignKeyErrors: z.ZodError[] = [];

          for (let i = 0; i < result.data.length; i++) {
            const record = result.data[i];
            const fkErrors = this.validateRecordForeignKeys(
              filename,
              record,
              this.validationContext
            );

            if (fkErrors.length > 0) {
              const zodError = new z.ZodError(
                fkErrors.map((err) => ({
                  code: 'custom' as const,
                  message: err.message,
                  path: [err.field],
                }))
              );
              foreignKeyErrors.push(zodError);

              if (options.strict) {
                result.success = false;
              }
            }
          }

          if (foreignKeyErrors.length > 0) {
            result.errors = [...(result.errors || []), ...foreignKeyErrors];
          }
        }
      }
    }

    // If relationship resolution is requested, build the resolver
    if (options.resolveRelationships) {
      const validatedData: { [filename: string]: GTFSRecord[] } = {};

      for (const [filename, result] of Object.entries(results)) {
        if (result.success && result.data) {
          validatedData[filename] = result.data;
        }
      }

      this.relationshipResolver = new GTFSRelationshipResolver(validatedData);
    }

    return results;
  }

  /**
   * Get validation summary for the entire feed
   */
  public getValidationSummary(results: {
    [filename: string]: ValidationResult;
  }): {
    totalFiles: number;
    validFiles: number;
    totalRecords: number;
    validRecords: number;
    totalErrors: number;
    totalWarnings: number;
    fileStatus: { [filename: string]: 'valid' | 'errors' | 'missing' };
  } {
    let totalFiles = 0;
    let validFiles = 0;
    let totalRecords = 0;
    let validRecords = 0;
    let totalErrors = 0;
    let totalWarnings = 0;
    const fileStatus: { [filename: string]: 'valid' | 'errors' | 'missing' } =
      {};

    for (const [filename, result] of Object.entries(results)) {
      totalFiles++;

      if (result.success) {
        validFiles++;
        fileStatus[filename] = 'valid';
      } else {
        fileStatus[filename] = 'errors';
      }

      if (result.data) {
        const recordCount = result.data.length;
        totalRecords += recordCount;
        validRecords += recordCount;
      }

      if (result.errors) {
        totalErrors += result.errors.length;
      }

      if (result.warnings) {
        totalWarnings += result.warnings.length;
      }
    }

    return {
      totalFiles,
      validFiles,
      totalRecords,
      validRecords,
      totalErrors,
      totalWarnings,
      fileStatus,
    };
  }

  /**
   * Cast raw CSV data to typed GTFS objects
   */
  public castToTyped<T extends GTFSRecord>(
    filename: string,
    rawData: Record<string, unknown>[]
  ): T[] {
    const result = this.validateFile(filename, rawData, { strict: false });
    return (result.data || []) as T[];
  }

  /**
   * Cast raw CSV data to typed GTFS entities using the new type system
   */
  public castToTypedEntity<T extends keyof GTFSTableMap>(
    tableName: T,
    rawData: Record<string, unknown>[]
  ): GTFSTableMap[T][] {
    const filename = `${tableName}.txt`;
    const result = this.validateFile(filename, rawData, { strict: false });
    return (result.data || []) as GTFSTableMap[T][];
  }

  /**
   * Get enhanced record with resolved relationships
   */
  public getEnhancedRecord(
    filename: string,
    recordId: string
  ): Record<string, unknown> | null {
    if (!this.relationshipResolver) {
      throw new Error(
        'Relationship resolver not initialized. Use validateFeed with resolveRelationships: true'
      );
    }

    switch (filename) {
      case GTFS_TABLES.STOPS:
        return this.relationshipResolver.enhanceStop(recordId);
      case GTFS_TABLES.ROUTES:
        return this.relationshipResolver.enhanceRoute(recordId);
      case GTFS_TABLES.TRIPS:
        return this.relationshipResolver.enhanceTrip(recordId);
      default:
        throw new Error(`Enhanced records not supported for ${filename}`);
    }
  }

  /**
   * Get field validation errors for a specific record
   */
  public getFieldErrors(
    filename: string,
    record: Record<string, unknown>
  ): { [fieldName: string]: string[] } {
    const schema = GTFSSchemas[filename as keyof typeof GTFSSchemas];
    if (!schema) {
      return {};
    }

    try {
      schema.parse(record);
      return {};
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { [fieldName: string]: string[] } = {};

        for (const issue of error.issues) {
          const fieldName = issue.path.join('.');
          if (!fieldErrors[fieldName]) {
            fieldErrors[fieldName] = [];
          }
          fieldErrors[fieldName].push(issue.message);
        }

        return fieldErrors;
      }

      return {};
    }
  }

  /**
   * Suggest fixes for common validation errors
   */
  public suggestFixes(error: z.ZodError): string[] {
    const suggestions: string[] = [];

    for (const issue of error.issues) {
      switch (issue.code) {
        case 'invalid_type':
          suggestions.push(
            `Field '${issue.path.join('.')}' should be ${(issue as Record<string, unknown>).expected} but got ${(issue as Record<string, unknown>).received}`
          );
          break;
        case 'too_small':
          suggestions.push(
            `Field '${issue.path.join('.')}' is too small. Minimum value: ${(issue as Record<string, unknown>).minimum}`
          );
          break;
        case 'too_big':
          suggestions.push(
            `Field '${issue.path.join('.')}' is too large. Maximum value: ${(issue as Record<string, unknown>).maximum}`
          );
          break;
        default:
          suggestions.push(`Field '${issue.path.join('.')}': ${issue.message}`);
      }
    }

    return suggestions;
  }

  /**
   * Get schema information for UI components
   */
  public getSchemaInfo(filename: string) {
    const schema = GTFSSchemas[filename as keyof typeof GTFSSchemas];
    if (!schema) {
      return null;
    }

    const shape = (schema as Record<string, unknown>).shape;
    const fields: Array<{
      name: string;
      type: string;
      required: boolean;
      description?: string;
      constraints?: Record<string, unknown>;
    }> = [];

    for (const [fieldName, fieldSchema] of Object.entries(shape || {})) {
      const isOptional =
        (fieldSchema as Record<string, unknown>)?._def?.typeName ===
        'ZodOptional';
      const baseSchema = isOptional
        ? (fieldSchema as Record<string, unknown>)._def.innerType
        : fieldSchema;

      fields.push({
        name: fieldName,
        type: baseSchema?._def?.typeName || 'unknown',
        required: !isOptional,
        description: (fieldSchema as Record<string, unknown>)?.description as
          | string
          | undefined,
        constraints: this.extractConstraints(baseSchema),
      });
    }

    return {
      filename,
      fields,
      totalFields: fields.length,
      requiredFields: fields.filter((f) => f.required).length,
    };
  }

  private extractConstraints(
    schema: Record<string, unknown>
  ): Record<string, unknown> {
    if (!schema || !schema._def) {
      return {};
    }

    const constraints: Record<string, unknown> = {};

    // Extract constraints based on schema type
    if (schema._def.checks) {
      for (const check of schema._def.checks) {
        switch (check.kind) {
          case 'min':
            constraints.min = check.value;
            break;
          case 'max':
            constraints.max = check.value;
            break;
          case 'email':
            constraints.format = 'email';
            break;
          case 'url':
            constraints.format = 'url';
            break;
          case 'regex':
            constraints.pattern = check.regex.source;
            break;
        }
      }
    }

    if (schema._def.values) {
      constraints.enum = Array.from(schema._def.values);
    }

    return constraints;
  }
}
