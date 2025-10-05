/**
 * Field Component Utility
 *
 * Provides reusable functions for creating consistent form fields with DaisyUI styling,
 * tooltips, and Zod schema descriptions across the application.
 *
 * Uses proper DaisyUI fieldset structure as documented at:
 * https://daisyui.com/components/fieldset/
 */

import { getGTFSFieldDescription } from './zod-tooltip-helper.js';
import type { z } from 'zod';

export interface FieldConfig {
  /** Field name in the GTFS specification (e.g., 'stop_name', 'stop_lat') */
  field: string;
  /** Human-readable label for the field */
  label: string;
  /** Input type: text, number, select, textarea */
  type: 'text' | 'number' | 'select' | 'textarea';
  /** Current value of the field */
  value?: string | number;
  /** Placeholder text for empty inputs */
  placeholder?: string;
  /** Additional HTML attributes for the input */
  attributes?: Record<string, string | number>;
  /** Options for select inputs */
  options?: Array<{ value: string | number; label: string }>;
  /** GTFS table name for fetching descriptions (e.g., 'stops.txt') */
  tableName?: string;
  /** Custom tooltip override (if not using Zod description) */
  tooltip?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Custom CSS classes for the input element */
  inputClasses?: string;
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string | number | undefined): string {
  if (text === undefined || text === null) {
    return '';
  }
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

/**
 * Get tooltip description for a field
 */
function getFieldTooltip(config: FieldConfig): string {
  // Use custom tooltip if provided
  if (config.tooltip) {
    return config.tooltip;
  }

  // Get description from Zod schema if table name is provided
  if (config.tableName) {
    const description = getGTFSFieldDescription(config.tableName, config.field);
    return description;
  }

  return '';
}

/**
 * Render a tooltip icon with description using DaisyUI tooltip
 * Handles long text with proper wrapping and max-width
 * Preserves newlines using CSS white-space: pre-line
 */
function renderTooltip(description: string): string {
  if (!description) {
    return '';
  }

  // Escape HTML but keep newlines - they'll be rendered via CSS white-space: pre-line
  const escapedDescription = escapeHtml(description);

  // Use DaisyUI tooltip with white-space: pre to preserve line breaks
  // The tooltip-open class can be added for testing
  // Use single quotes for data-tip attribute to avoid escaping issues
  return `
    <div class="tooltip tooltip-right" data-tip='${escapedDescription}'>
      <svg class="w-4 h-4 opacity-60 hover:opacity-100 cursor-help inline-block ml-1"
           fill="none"
           stroke="currentColor"
           viewBox="0 0 24 24">
        <path stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  `;
}

/**
 * Render label using Pattern 4: Label with for attribute
 */
function renderLabel(
  config: FieldConfig,
  tooltip: string,
  inputId: string
): string {
  const tooltipHtml = renderTooltip(tooltip);
  const requiredMark = config.required
    ? ' <span class="text-error">*</span>'
    : '';

  return `
    <label class="label" for="${inputId}">${escapeHtml(config.label)}${requiredMark}${tooltipHtml}</label>
  `;
}

/**
 * Render text or number input field
 */
function renderTextInput(config: FieldConfig, inputId: string): string {
  const attributes = config.attributes || {};
  const attrString = Object.entries(attributes)
    .map(([key, value]) => `${key}="${escapeHtml(String(value))}"`)
    .join(' ');

  return `
    <input
      type="${config.type}"
      id="${inputId}"
      class="input"
      data-field="${config.field}"
      value="${escapeHtml(config.value)}"
      placeholder="${escapeHtml(config.placeholder || '')}"
      ${config.required ? 'required' : ''}
      ${attrString}
    />
  `;
}

/**
 * Render select dropdown field
 */
function renderSelectInput(config: FieldConfig, inputId: string): string {
  if (!config.options) {
    throw new Error('Select input requires options array');
  }

  const currentValue = String(config.value || '');

  const optionsHtml = config.options
    .map((option) => {
      const optionValue = String(option.value);
      const selected = optionValue === currentValue ? 'selected' : '';
      return `<option value="${escapeHtml(optionValue)}" ${selected}>${escapeHtml(option.label)}</option>`;
    })
    .join('');

  return `
    <select
      id="${inputId}"
      class="select"
      data-field="${config.field}"
      ${config.required ? 'required' : ''}
    >
      ${optionsHtml}
    </select>
  `;
}

/**
 * Render textarea field
 */
function renderTextareaInput(config: FieldConfig, inputId: string): string {
  const attributes = config.attributes || {};
  const attrString = Object.entries(attributes)
    .map(([key, value]) => `${key}="${escapeHtml(String(value))}"`)
    .join(' ');

  return `
    <textarea
      id="${inputId}"
      class="textarea"
      data-field="${config.field}"
      placeholder="${escapeHtml(config.placeholder || '')}"
      ${config.required ? 'required' : ''}
      ${attrString}
    >${escapeHtml(config.value)}</textarea>
  `;
}

/**
 * Render a complete form field using Pattern 4: Fieldset with label
 *
 * Structure follows DaisyUI v5 pattern:
 * <fieldset class="fieldset">
 *   <label class="label" for="id">Label Text</label>
 *   <input id="id" class="input" />
 *   <p class="label">Helper text (optional)</p>
 * </fieldset>
 *
 * @param config - Field configuration
 * @returns HTML string for the complete field
 *
 * @example
 * ```typescript
 * const html = renderFormField({
 *   field: 'stop_name',
 *   label: 'Stop Name',
 *   type: 'text',
 *   value: 'Main Street Station',
 *   placeholder: 'Enter stop name',
 *   tableName: 'stops.txt',
 *   required: true
 * });
 * ```
 */
export function renderFormField(config: FieldConfig): string {
  const tooltip = getFieldTooltip(config);
  const inputId = `field-${config.field}`;
  const labelHtml = renderLabel(config, tooltip, inputId);

  let inputHtml: string;
  switch (config.type) {
    case 'text':
    case 'number':
      inputHtml = renderTextInput(config, inputId);
      break;
    case 'select':
      inputHtml = renderSelectInput(config, inputId);
      break;
    case 'textarea':
      inputHtml = renderTextareaInput(config, inputId);
      break;
    default:
      throw new Error(`Unsupported field type: ${config.type}`);
  }

  return `
    <fieldset class="fieldset">
      ${labelHtml}
      ${inputHtml}
    </fieldset>
  `;
}

/**
 * Render multiple form fields
 *
 * @param configs - Array of field configurations
 * @returns HTML string with all fieldsets wrapped in a container
 *
 * @example
 * ```typescript
 * const html = renderFormFields([
 *   { field: 'stop_name', label: 'Name', type: 'text', value: stop.stop_name },
 *   { field: 'stop_lat', label: 'Latitude', type: 'number', value: stop.stop_lat }
 * ]);
 * ```
 */
export function renderFormFields(configs: FieldConfig[]): string {
  const fieldsHtml = configs.map((config) => renderFormField(config)).join('');

  return `
    <div class="space-y-3">
      ${fieldsHtml}
    </div>
  `;
}

/**
 * Attach event listeners to form fields for auto-save functionality
 *
 * @param container - HTML element containing the form fields
 * @param onUpdate - Callback function called when a field value changes
 *
 * @example
 * ```typescript
 * attachFieldEventListeners(container, async (field, value) => {
 *   await updateDatabase(field, value);
 *   notifications.showSuccess(`Updated ${field}`);
 * });
 * ```
 */
export function attachFieldEventListeners(
  container: HTMLElement,
  onUpdate: (field: string, value: string) => void | Promise<void>
): void {
  const inputs = container.querySelectorAll('[data-field]');

  inputs.forEach((input) => {
    const field = input.getAttribute('data-field');
    if (!field) {
      return;
    }

    const handleUpdate = async () => {
      const value = (
        input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      ).value;
      await onUpdate(field, value);
    };

    // Use 'change' event to fire when value changes and element loses focus
    // This prevents duplicate notifications on every keystroke
    input.addEventListener('change', handleUpdate);
  });
}

/**
 * Generate field configurations from a Zod schema
 *
 * @param schema - Zod schema (e.g., StopsSchema, RoutesSchema)
 * @param data - Current data object
 * @param tableName - GTFS table name (e.g., 'stops.txt')
 * @param primaryKey - Primary key field name (will be read-only)
 * @returns Array of field configurations
 *
 * @example
 * ```typescript
 * import { StopsSchema, GTFS_TABLES } from '../types/gtfs.js';
 * const configs = generateFieldConfigsFromSchema(
 *   StopsSchema,
 *   stop,
 *   GTFS_TABLES.STOPS,
 *   'stop_id'
 * );
 * ```
 */
export function generateFieldConfigsFromSchema(
  schema: z.ZodObject<z.ZodRawShape>,
  data: Record<string, string | number | undefined>,
  tableName: string,
  primaryKey?: string
): FieldConfig[] {
  const configs: FieldConfig[] = [];
  const shape = schema.shape;

  for (const [fieldName, fieldSchema] of Object.entries(shape)) {
    // Skip if primary key (will be handled separately)
    if (primaryKey && fieldName === primaryKey) {
      continue;
    }

    // Unwrap optional/nullable to get inner type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let innerSchema: any = fieldSchema;
    while (innerSchema._def?.innerType) {
      innerSchema = innerSchema._def.innerType;
    }

    // Determine field type and options
    const typeName = innerSchema._def?.typeName;
    const isOptional = fieldSchema.isOptional?.() ?? false;

    let fieldType: 'text' | 'number' | 'select' | 'textarea' = 'text';
    let options: Array<{ value: string | number; label: string }> | undefined;
    const attributes: Record<string, string | number> = {};

    // Determine input type based on Zod schema
    if (typeName === 'ZodNumber') {
      fieldType = 'number';

      // Check for min/max constraints
      const checks = innerSchema._def?.checks || [];
      for (const check of checks) {
        if (check.kind === 'min') {
          attributes.min = check.value;
        }
        if (check.kind === 'max') {
          attributes.max = check.value;
        }
      }

      // Special handling for latitude/longitude
      if (fieldName.includes('_lat')) {
        attributes.step = '0.000001';
      } else if (fieldName.includes('_lon')) {
        attributes.step = '0.000001';
      }
    } else if (typeName === 'ZodEnum') {
      fieldType = 'select';
      const enumValues = innerSchema._def?.values || [];
      options = enumValues.map((v: string | number) => ({
        value: v,
        label: String(v),
      }));
    } else if (
      fieldName.includes('_desc') ||
      fieldName.includes('description')
    ) {
      fieldType = 'textarea';
      attributes.rows = '3';
    }

    // Generate human-readable label from field name
    const label = generateLabel(fieldName);

    configs.push({
      field: fieldName,
      label: `${label} (${fieldName})`,
      type: fieldType,
      value: data[fieldName],
      placeholder: isOptional
        ? `Optional ${label.toLowerCase()}`
        : `Enter ${label.toLowerCase()}`,
      tableName,
      required: !isOptional,
      options,
      attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    });
  }

  // Sort configs: required fields first, then optional fields
  configs.sort((a, b) => {
    if (a.required === b.required) {
      return 0;
    }
    return a.required ? -1 : 1;
  });

  return configs;
}

/**
 * Generate human-readable label from snake_case field name
 */
function generateLabel(fieldName: string): string {
  return fieldName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
