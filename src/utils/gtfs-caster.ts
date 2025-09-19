/**
 * GTFS Casting and Validation Utilities
 */

import { z } from 'zod';
import { GTFSSchemas, GTFSRecord } from '../types/gtfs.js';
import { GTFSRelationshipResolver } from './gtfs-relationships.js';

export interface ValidationResult {
  success: boolean;
  data?: GTFSRecord[];
  errors?: z.ZodError[];
  warnings?: string[];
}

export interface CastOptions {
  strict?: boolean;          // Fail on any validation error
  skipMissingFiles?: boolean; // Allow missing optional files
  resolveRelationships?: boolean; // Resolve foreign key relationships
}

export class GTFSCaster {
  private relationshipResolver?: GTFSRelationshipResolver;
  
  /**
   * Validate and cast a single GTFS file
   */
  public validateFile(
    filename: string, 
    rawData: any[], 
    options: CastOptions = {}
  ): ValidationResult {
    const schema = GTFSSchemas[filename as keyof typeof GTFSSchemas];
    
    if (!schema) {
      return {
        success: false,
        errors: [new z.ZodError([{
          code: 'custom',
          message: `No schema found for file: ${filename}`,
          path: [filename]
        }])],
        warnings: []
      };
    }
    
    const results: ValidationResult = {
      success: true,
      data: [],
      errors: [],
      warnings: []
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
    results.success = results.data!.length > 0 && (options.strict ? results.errors!.length === 0 : true);
    
    return results;
  }
  
  /**
   * Validate and cast an entire GTFS feed
   */
  public validateFeed(
    rawGtfsData: { [filename: string]: any[] },
    options: CastOptions = {}
  ): { [filename: string]: ValidationResult } {
    const results: { [filename: string]: ValidationResult } = {};
    
    // Validate each file
    for (const [filename, data] of Object.entries(rawGtfsData)) {
      results[filename] = this.validateFile(filename, data, options);
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
  public getValidationSummary(
    results: { [filename: string]: ValidationResult }
  ): {
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
    const fileStatus: { [filename: string]: 'valid' | 'errors' | 'missing' } = {};
    
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
      fileStatus
    };
  }
  
  /**
   * Cast raw CSV data to typed GTFS objects
   */
  public castToTyped<T extends GTFSRecord>(
    filename: string,
    rawData: any[]
  ): T[] {
    const result = this.validateFile(filename, rawData, { strict: false });
    return (result.data || []) as T[];
  }
  
  /**
   * Get enhanced record with resolved relationships
   */
  public getEnhancedRecord(filename: string, recordId: string): any {
    if (!this.relationshipResolver) {
      throw new Error('Relationship resolver not initialized. Use validateFeed with resolveRelationships: true');
    }
    
    switch (filename) {
      case 'stops.txt':
        return this.relationshipResolver.enhanceStop(recordId);
      case 'routes.txt':
        return this.relationshipResolver.enhanceRoute(recordId);
      case 'trips.txt':
        return this.relationshipResolver.enhanceTrip(recordId);
      default:
        throw new Error(`Enhanced records not supported for ${filename}`);
    }
  }
  
  /**
   * Get field validation errors for a specific record
   */
  public getFieldErrors(filename: string, record: any): { [fieldName: string]: string[] } {
    const schema = GTFSSchemas[filename as keyof typeof GTFSSchemas];
    if (!schema) return {};
    
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
          suggestions.push(`Field '${issue.path.join('.')}' should be ${(issue as any).expected} but got ${(issue as any).received}`);
          break;
        case 'too_small':
          suggestions.push(`Field '${issue.path.join('.')}' is too small. Minimum value: ${(issue as any).minimum}`);
          break;
        case 'too_big':
          suggestions.push(`Field '${issue.path.join('.')}' is too large. Maximum value: ${(issue as any).maximum}`);
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
    if (!schema) return null;
    
    const shape = (schema as any).shape;
    const fields: Array<{
      name: string;
      type: string;
      required: boolean;
      description?: string;
      constraints?: any;
    }> = [];
    
    for (const [fieldName, fieldSchema] of Object.entries(shape || {})) {
      const isOptional = (fieldSchema as any)?._def?.typeName === 'ZodOptional';
      const baseSchema = isOptional ? (fieldSchema as any)._def.innerType : fieldSchema;
      
      fields.push({
        name: fieldName,
        type: baseSchema?._def?.typeName || 'unknown',
        required: !isOptional,
        description: (fieldSchema as any)?.description,
        constraints: this.extractConstraints(baseSchema)
      });
    }
    
    return {
      filename,
      fields,
      totalFields: fields.length,
      requiredFields: fields.filter(f => f.required).length
    };
  }
  
  private extractConstraints(schema: any): any {
    if (!schema || !schema._def) return {};
    
    const constraints: any = {};
    
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