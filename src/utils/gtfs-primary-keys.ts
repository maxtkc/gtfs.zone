/**
 * GTFS Primary Key Configuration
 *
 * Based on the official GTFS specification at https://gtfs.org/schedule/reference/
 * This module provides the definitive source of truth for GTFS table primary keys.
 */

export interface GTFSTablePrimaryKey {
  /** The table name (filename without .txt) */
  tableName: string;
  /** The field(s) that make up the primary key */
  fields: string[];
  /** Whether this is a natural key (single field) or composite key (multiple fields) */
  type: 'natural' | 'composite' | 'all_fields' | 'none';
  /** Whether the table allows only one row (like feed_info.txt) */
  singleRow?: boolean;
}

/**
 * Official GTFS Primary Key Definitions
 * Source: https://gtfs.org/schedule/reference/ (accessed 2024)
 */
export const GTFS_PRIMARY_KEYS: GTFSTablePrimaryKey[] = [
  // Core Required Files
  {
    tableName: 'agency',
    fields: ['agency_id'],
    type: 'natural',
  },
  {
    tableName: 'stops',
    fields: ['stop_id'],
    type: 'natural',
  },
  {
    tableName: 'routes',
    fields: ['route_id'],
    type: 'natural',
  },
  {
    tableName: 'trips',
    fields: ['trip_id'],
    type: 'natural',
  },
  {
    tableName: 'stop_times',
    fields: ['trip_id', 'stop_sequence'],
    type: 'composite',
  },

  // Calendar Files
  {
    tableName: 'calendar',
    fields: ['service_id'],
    type: 'natural',
  },
  {
    tableName: 'calendar_dates',
    fields: ['service_id', 'date'],
    type: 'composite',
  },

  // Optional Core Files
  {
    tableName: 'shapes',
    fields: ['shape_id', 'shape_pt_sequence'],
    type: 'composite',
  },
  {
    tableName: 'frequencies',
    fields: ['trip_id', 'start_time'],
    type: 'composite',
  },
  {
    tableName: 'transfers',
    fields: [], // All provided fields
    type: 'all_fields',
  },
  {
    tableName: 'feed_info',
    fields: [],
    type: 'none',
    singleRow: true,
  },

  // Fare Files
  {
    tableName: 'fare_attributes',
    fields: ['fare_id'],
    type: 'natural',
  },
  {
    tableName: 'fare_rules',
    fields: [], // All provided fields
    type: 'all_fields',
  },

  // Extended GTFS Files
  {
    tableName: 'timeframes',
    fields: [], // All provided fields
    type: 'all_fields',
  },
  {
    tableName: 'rider_categories',
    fields: ['rider_category_id'],
    type: 'natural',
  },
  {
    tableName: 'fare_media',
    fields: ['fare_media_id'],
    type: 'natural',
  },
  {
    tableName: 'fare_products',
    fields: ['fare_product_id', 'rider_category_id', 'fare_media_id'],
    type: 'composite',
  },
  {
    tableName: 'fare_leg_rules',
    fields: [
      'network_id',
      'from_area_id',
      'to_area_id',
      'from_timeframe_group_id',
      'to_timeframe_group_id',
      'fare_product_id',
    ],
    type: 'composite',
  },
  {
    tableName: 'fare_leg_join_rules',
    fields: ['from_network_id', 'to_network_id', 'from_stop_id', 'to_stop_id'],
    type: 'composite',
  },
  {
    tableName: 'fare_transfer_rules',
    fields: [], // All provided fields
    type: 'all_fields',
  },
  {
    tableName: 'areas',
    fields: ['area_id'],
    type: 'natural',
  },
  {
    tableName: 'stop_areas',
    fields: [], // All provided fields
    type: 'all_fields',
  },
  {
    tableName: 'networks',
    fields: ['network_id'],
    type: 'natural',
  },
  {
    tableName: 'route_networks',
    fields: [], // All provided fields
    type: 'all_fields',
  },
  {
    tableName: 'attributions',
    fields: [], // All provided fields
    type: 'all_fields',
  },
  {
    tableName: 'translations',
    fields: ['table_name', 'field_name', 'language', 'translation'],
    type: 'composite',
  },

  // Pathways and Accessibility
  {
    tableName: 'pathways',
    fields: ['pathway_id'],
    type: 'natural',
  },
  {
    tableName: 'levels',
    fields: ['level_id'],
    type: 'natural',
  },

  // Location Groups and Booking
  {
    tableName: 'location_groups',
    fields: ['location_group_id'],
    type: 'natural',
  },
  {
    tableName: 'location_group_stops',
    fields: [], // All provided fields
    type: 'all_fields',
  },
  {
    tableName: 'booking_rules',
    fields: ['booking_rule_id'],
    type: 'natural',
  },
];

/**
 * Get primary key configuration for a GTFS table
 */
export function getGTFSPrimaryKey(
  tableName: string
): GTFSTablePrimaryKey | null {
  return (
    GTFS_PRIMARY_KEYS.find((config) => config.tableName === tableName) || null
  );
}

/**
 * Check if a table uses a natural (single field) primary key
 */
export function isNaturalKey(tableName: string): boolean {
  const config = getGTFSPrimaryKey(tableName);
  return config?.type === 'natural';
}

/**
 * Check if a table uses a composite (multiple field) primary key
 */
export function isCompositeKey(tableName: string): boolean {
  const config = getGTFSPrimaryKey(tableName);
  return config?.type === 'composite';
}

/**
 * Check if a table uses all provided fields as primary key
 */
export function isAllFieldsKey(tableName: string): boolean {
  const config = getGTFSPrimaryKey(tableName);
  return config?.type === 'all_fields';
}

/**
 * Check if a table allows only one row
 */
export function isSingleRowTable(tableName: string): boolean {
  const config = getGTFSPrimaryKey(tableName);
  return config?.singleRow === true;
}

/**
 * Get the natural key field name for tables with single-field primary keys
 */
export function getNaturalKeyField(tableName: string): string | null {
  const config = getGTFSPrimaryKey(tableName);
  if (config?.type === 'natural' && config.fields.length === 1) {
    return config.fields[0];
  }
  return null;
}

/**
 * Get all primary key fields for a table
 */
export function getPrimaryKeyFields(tableName: string): string[] {
  const config = getGTFSPrimaryKey(tableName);
  return config?.fields || [];
}

/**
 * Generate a composite key string from a record
 */
export function generateCompositeKeyFromRecord(
  tableName: string,
  record: Record<string, unknown>
): string {
  const config = getGTFSPrimaryKey(tableName);

  if (!config) {
    throw new Error(`Unknown GTFS table: ${tableName}`);
  }

  if (config.type === 'natural') {
    const field = config.fields[0];
    const value = record[field];
    if (value === undefined || value === null || value === '') {
      throw new Error(
        `Missing required primary key field '${field}' for table '${tableName}'`
      );
    }
    return String(value);
  }

  if (config.type === 'composite') {
    const keyParts = config.fields.map((field) => {
      const value = record[field];
      if (value === undefined || value === null || value === '') {
        throw new Error(
          `Missing required primary key field '${field}' for table '${tableName}'`
        );
      }
      return String(value);
    });
    return keyParts.join(':');
  }

  if (config.type === 'all_fields') {
    // For tables that use all fields as primary key, sort field names for consistency
    const fields = Object.keys(record).sort();
    const keyParts = fields.map((field) => {
      const value = record[field];
      return `${field}=${String(value)}`;
    });
    return keyParts.join('&');
  }

  if (config.type === 'none') {
    // Single row tables like feed_info use a fixed key
    return tableName;
  }

  throw new Error(
    `Unsupported primary key type '${config.type}' for table '${tableName}'`
  );
}

/**
 * Parse a composite key string back into its component fields
 */
export function parseCompositeKey(
  tableName: string,
  key: string
): Record<string, string> {
  const config = getGTFSPrimaryKey(tableName);

  if (!config) {
    throw new Error(`Unknown GTFS table: ${tableName}`);
  }

  if (config.type === 'natural') {
    const field = config.fields[0];
    return { [field]: key };
  }

  if (config.type === 'composite') {
    const keyParts = key.split(':');
    if (keyParts.length !== config.fields.length) {
      throw new Error(
        `Invalid composite key format for table '${tableName}'. Expected ${config.fields.length} parts, got ${keyParts.length}`
      );
    }

    const result: Record<string, string> = {};
    config.fields.forEach((field, index) => {
      result[field] = keyParts[index];
    });
    return result;
  }

  if (config.type === 'all_fields') {
    const result: Record<string, string> = {};
    const keyParts = key.split('&');

    for (const part of keyParts) {
      const [field, value] = part.split('=');
      if (field && value !== undefined) {
        result[field] = value;
      }
    }
    return result;
  }

  if (config.type === 'none') {
    // Single row tables don't have meaningful key parsing
    return {};
  }

  throw new Error(
    `Unsupported primary key type '${config.type}' for table '${tableName}'`
  );
}
