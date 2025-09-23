import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { GTFS_FILES } from './gtfs-parser.js';
import { databaseFallbackManager } from './database-fallback-manager.js';

// TypeScript interfaces for GTFS database schema
export interface GTFSRecord {
  id?: number; // Auto-increment primary key
  [key: string]: string | number | boolean | undefined; // Dynamic fields based on CSV columns
}

export interface ProjectMetadata {
  id?: number;
  name: string;
  createdAt: string;
  lastModified: string;
  fileCount: number;
}

// Database schema interface for idb
export interface GTFSDBSchema extends DBSchema {
  // GTFS file tables (dynamic based on uploaded files)
  agencies: {
    key: number;
    value: GTFSRecord;
  };
  routes: {
    key: number;
    value: GTFSRecord;
  };
  stops: {
    key: number;
    value: GTFSRecord;
  };
  trips: {
    key: number;
    value: GTFSRecord;
  };
  stop_times: {
    key: number;
    value: GTFSRecord;
  };
  calendar: {
    key: number;
    value: GTFSRecord;
  };
  calendar_dates: {
    key: number;
    value: GTFSRecord;
  };
  shapes: {
    key: number;
    value: GTFSRecord;
  };
  frequencies: {
    key: number;
    value: GTFSRecord;
  };
  transfers: {
    key: number;
    value: GTFSRecord;
  };
  feed_info: {
    key: number;
    value: GTFSRecord;
  };
  fare_attributes: {
    key: number;
    value: GTFSRecord;
  };
  fare_rules: {
    key: number;
    value: GTFSRecord;
  };
  locations: {
    key: number;
    value: GTFSRecord;
  };
  // Project metadata table
  project: {
    key: number;
    value: ProjectMetadata;
  };
}

export class GTFSDatabase {
  private db: IDBPDatabase<GTFSDBSchema> | null = null;
  private fallbackDB: {
    initialize(): Promise<void>;
    insertRows(tableName: string, rows: GTFSRecord[]): Promise<void>;
    getAllRows(tableName: string): Promise<GTFSRecord[]>;
    getDatabaseStats(): Promise<{
      tables: Record<string, number>;
      size: number;
    }>;
    clearTable(tableName: string): Promise<void>;
    clearDatabase(): Promise<void>;
    compactDatabase(): Promise<void>;
  } | null = null;
  private readonly dbName = 'GTFSZoneDB';
  private readonly dbVersion = 1;
  private isUsingFallback = false;

  constructor() {}

  /**
   * Initialize database connection and create tables
   */
  async initialize(): Promise<void> {
    try {
      // Check browser capabilities first
      const capabilities = await databaseFallbackManager.detectCapabilities();

      if (!capabilities.indexedDB) {
        // eslint-disable-next-line no-console
        console.warn('IndexedDB not supported, using fallback storage');
        this.fallbackDB = databaseFallbackManager.createFallbackDatabase();
        this.isUsingFallback = true;
        await this.fallbackDB.initialize();
        return;
      }

      // Try to initialize IndexedDB
      this.db = await openDB<GTFSDBSchema>(this.dbName, this.dbVersion, {
        upgrade: (db) => {
          // Create tables for all possible GTFS files
          const allFiles = [...GTFS_FILES.required, ...GTFS_FILES.optional];

          allFiles.forEach((fileName) => {
            const tableName = this.getTableName(fileName);
            if (!db.objectStoreNames.contains(tableName)) {
              const store = db.createObjectStore(tableName, {
                keyPath: 'id',
                autoIncrement: true,
              });
              // Add indexes for commonly queried fields
              this.addIndexesForTable(store, tableName);
            }
          });

          // Create project metadata table
          if (!db.objectStoreNames.contains('project')) {
            db.createObjectStore('project', {
              keyPath: 'id',
              autoIncrement: true,
            });
          }
        },
        blocked: () => {
          databaseFallbackManager.showDatabaseError(
            new Error('Database blocked by another tab'),
            'initialization'
          );
        },
      });

      // eslint-disable-next-line no-console
      console.log('GTFSDatabase initialized successfully');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to initialize GTFSDatabase:', error);

      // Handle different types of errors
      if (error.name === 'VersionError' || error.name === 'InvalidStateError') {
        databaseFallbackManager.showDatabaseError(error, 'initialization');
      } else {
        // Fall back to memory storage
        // eslint-disable-next-line no-console
        console.warn('Falling back to memory storage due to IndexedDB error');
        this.fallbackDB = databaseFallbackManager.createFallbackDatabase();
        this.isUsingFallback = true;
        await this.fallbackDB.initialize();
      }
    }
  }

  /**
   * Convert filename to table name (remove .txt extension, handle special cases)
   */
  private getTableName(fileName: string): string {
    return fileName.replace('.txt', '').replace('.geojson', '');
  }

  /**
   * Get the active database instance (IndexedDB or fallback)
   */
  private getActiveDB(): GTFSDatabase | typeof this.fallbackDB {
    return this.isUsingFallback ? this.fallbackDB : this;
  }

  /**
   * Check if using fallback mode
   */
  isInFallbackMode(): boolean {
    return this.isUsingFallback;
  }

  /**
   * Handle database errors with fallback
   */
  private async handleDatabaseError(
    error: Error,
    operation: string,
    fallbackAction?: () => Promise<unknown>
  ): Promise<unknown> {
    // eslint-disable-next-line no-console
    console.error(`Database error in ${operation}:`, error);

    // Check for quota exceeded errors
    if (
      error.name === 'QuotaExceededError' ||
      error.message?.includes('quota')
    ) {
      databaseFallbackManager.showDatabaseError(error, operation);
      throw error;
    }

    // Check for corruption errors
    if (
      error.name === 'InvalidStateError' ||
      error.message?.includes('corrupt')
    ) {
      databaseFallbackManager.showDatabaseError(error, operation);
      throw error;
    }

    // For other errors, try fallback if available
    if (fallbackAction && !this.isUsingFallback) {
      // eslint-disable-next-line no-console
      console.warn(`Attempting fallback for ${operation}`);
      return await fallbackAction();
    }

    throw error;
  }

  /**
   * Add appropriate indexes for each table type
   */
  private addIndexesForTable(store: IDBObjectStore, tableName: string): void {
    switch (tableName) {
      case 'agencies':
        store.createIndex('agency_id', 'agency_id', { unique: false });
        store.createIndex('agency_name', 'agency_name', { unique: false });
        store.createIndex('agency_url', 'agency_url', { unique: false });
        break;
      case 'routes':
        store.createIndex('route_id', 'route_id', { unique: false });
        store.createIndex('agency_id', 'agency_id', { unique: false });
        store.createIndex('route_short_name', 'route_short_name', {
          unique: false,
        });
        store.createIndex('route_long_name', 'route_long_name', {
          unique: false,
        });
        store.createIndex('route_type', 'route_type', { unique: false });
        store.createIndex('route_color', 'route_color', { unique: false });
        break;
      case 'stops':
        store.createIndex('stop_id', 'stop_id', { unique: false });
        store.createIndex('stop_name', 'stop_name', { unique: false });
        store.createIndex('stop_code', 'stop_code', { unique: false });
        store.createIndex('location_type', 'location_type', { unique: false });
        store.createIndex('parent_station', 'parent_station', {
          unique: false,
        });
        // Compound index for geographic searches
        store.createIndex('lat_lon', ['stop_lat', 'stop_lon'], {
          unique: false,
        });
        break;
      case 'trips':
        store.createIndex('trip_id', 'trip_id', { unique: false });
        store.createIndex('route_id', 'route_id', { unique: false });
        store.createIndex('service_id', 'service_id', { unique: false });
        store.createIndex('trip_headsign', 'trip_headsign', { unique: false });
        store.createIndex('direction_id', 'direction_id', { unique: false });
        store.createIndex('shape_id', 'shape_id', { unique: false });
        break;
      case 'stop_times':
        store.createIndex('trip_id', 'trip_id', { unique: false });
        store.createIndex('stop_id', 'stop_id', { unique: false });
        store.createIndex('stop_sequence', 'stop_sequence', { unique: false });
        store.createIndex('arrival_time', 'arrival_time', { unique: false });
        store.createIndex('departure_time', 'departure_time', {
          unique: false,
        });
        // Compound indexes for common queries
        store.createIndex('trip_sequence', ['trip_id', 'stop_sequence'], {
          unique: false,
        });
        break;
      case 'calendar':
        store.createIndex('service_id', 'service_id', { unique: false });
        store.createIndex('start_date', 'start_date', { unique: false });
        store.createIndex('end_date', 'end_date', { unique: false });
        break;
      case 'calendar_dates':
        store.createIndex('service_id', 'service_id', { unique: false });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('exception_type', 'exception_type', {
          unique: false,
        });
        break;
      case 'shapes':
        store.createIndex('shape_id', 'shape_id', { unique: false });
        store.createIndex('shape_pt_sequence', 'shape_pt_sequence', {
          unique: false,
        });
        // Compound index for shape rendering
        store.createIndex('shape_sequence', ['shape_id', 'shape_pt_sequence'], {
          unique: false,
        });
        break;
      case 'frequencies':
        store.createIndex('trip_id', 'trip_id', { unique: false });
        store.createIndex('start_time', 'start_time', { unique: false });
        store.createIndex('end_time', 'end_time', { unique: false });
        break;
      case 'transfers':
        store.createIndex('from_stop_id', 'from_stop_id', { unique: false });
        store.createIndex('to_stop_id', 'to_stop_id', { unique: false });
        store.createIndex('transfer_type', 'transfer_type', { unique: false });
        break;
      case 'feed_info':
        store.createIndex('feed_publisher_name', 'feed_publisher_name', {
          unique: false,
        });
        store.createIndex('feed_lang', 'feed_lang', { unique: false });
        break;
      case 'fare_attributes':
        store.createIndex('fare_id', 'fare_id', { unique: false });
        store.createIndex('agency_id', 'agency_id', { unique: false });
        break;
      case 'fare_rules':
        store.createIndex('fare_id', 'fare_id', { unique: false });
        store.createIndex('route_id', 'route_id', { unique: false });
        break;
      case 'locations':
        store.createIndex('location_id', 'location_id', { unique: false });
        store.createIndex('location_name', 'location_name', { unique: false });
        break;
    }
  }

  /**
   * Clear entire database when loading new GTFS file
   */
  async clearDatabase(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const transaction = this.db.transaction(
        Array.from(this.db.objectStoreNames),
        'readwrite'
      );

      // Clear all object stores
      for (const storeName of this.db.objectStoreNames) {
        await transaction.objectStore(storeName).clear();
      }

      await transaction.done;
      // eslint-disable-next-line no-console
      console.log('Database cleared successfully');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to clear database:', error);
      throw error;
    }
  }

  /**
   * Create tables dynamically based on uploaded GTFS files
   */
  async createTablesFromGTFS(fileNames: string[]): Promise<void> {
    // Tables are created during database initialization
    // This method is for future extensibility if we need dynamic table creation
    // eslint-disable-next-line no-console
    console.log('Tables available for files:', fileNames);
  }

  /**
   * Bulk insert CSV rows as records with optimized batching
   */
  async insertRows(tableName: string, rows: GTFSRecord[]): Promise<void> {
    if (this.isUsingFallback) {
      return await this.fallbackDB.insertRows(tableName, rows);
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const BATCH_SIZE = 1000; // Optimal batch size for IndexedDB

    try {
      // Process in batches for better performance and memory usage
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        await this.insertBatch(tableName, batch);
      }

      // eslint-disable-next-line no-console
      console.log(
        `Inserted ${rows.length} rows into ${tableName} in ${Math.ceil(rows.length / BATCH_SIZE)} batches`
      );
    } catch (error) {
      return await this.handleDatabaseError(error, 'insertRows', async () => {
        // Switch to fallback mode and retry
        this.fallbackDB = databaseFallbackManager.createFallbackDatabase();
        this.isUsingFallback = true;
        await this.fallbackDB.initialize();
        return await this.fallbackDB.insertRows(tableName, rows);
      });
    }
  }

  /**
   * Insert a single batch of rows within one transaction
   */
  private async insertBatch(
    tableName: string,
    rows: GTFSRecord[]
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction(tableName, 'readwrite');
    const store = transaction.objectStore(tableName);

    // Insert all rows in this batch
    const promises = rows.map((row) => store.add(row));
    await Promise.all(promises);

    await transaction.done;
  }

  /**
   * Retrieve single record by ID
   */
  async getRow(tableName: string, id: number): Promise<GTFSRecord | undefined> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      return await this.db.get(tableName, id);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to get row ${id} from ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Update single record with debouncing (will be implemented in integration phase)
   */
  async updateRow(
    tableName: string,
    id: number,
    data: Partial<GTFSRecord>
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const existing = await this.getRow(tableName, id);
      if (!existing) {
        throw new Error(`Record ${id} not found in ${tableName}`);
      }

      const updated = { ...existing, ...data };
      await this.db.put(tableName, updated);
      // eslint-disable-next-line no-console
      console.log(`Updated row ${id} in ${tableName}`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to update row ${id} in ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Get all records from table (for export)
   */
  async getAllRows(tableName: string): Promise<GTFSRecord[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      return await this.db.getAll(tableName);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to get all rows from ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Filtered queries for search/navigation with index optimization
   */
  async queryRows(
    tableName: string,
    filter?: { [key: string]: string | number | boolean }
  ): Promise<GTFSRecord[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      if (!filter) {
        return this.getAllRows(tableName);
      }

      // Try to use indexes for better performance
      const filterKeys = Object.keys(filter);
      const transaction = this.db.transaction(tableName, 'readonly');
      const store = transaction.objectStore(tableName);

      // Check if we have an index for the first filter key
      const indexName = filterKeys[0];
      if (store.indexNames.contains(indexName)) {
        const index = store.index(indexName);
        const results = await index.getAll(filter[indexName]);

        // Apply additional filters if needed
        if (filterKeys.length > 1) {
          const remainingFilter = { ...filter };
          delete remainingFilter[indexName];
          return results.filter((row) => {
            return Object.entries(remainingFilter).every(([key, value]) => {
              return row[key] === value;
            });
          });
        }

        return results;
      }

      // Fallback to full table scan
      const allRows = await this.getAllRows(tableName);
      return allRows.filter((row) => {
        return Object.entries(filter).every(([key, value]) => {
          return row[key] === value;
        });
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to query rows from ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Get project metadata
   */
  async getProjectMetadata(): Promise<ProjectMetadata | undefined> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const projects = await this.db.getAll('project');
      return projects[0]; // Single project mode
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to get project metadata:', error);
      throw error;
    }
  }

  /**
   * Update project metadata
   */
  async updateProjectMetadata(
    metadata: Omit<ProjectMetadata, 'id'>
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const existing = await this.getProjectMetadata();
      if (existing) {
        await this.db.put('project', {
          ...existing,
          ...metadata,
          id: existing.id,
        });
      } else {
        await this.db.add('project', { ...metadata, id: 1 });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to update project metadata:', error);
      throw error;
    }
  }

  /**
   * Clear specific table
   */
  async clearTable(tableName: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const transaction = this.db.transaction(tableName, 'readwrite');
      await transaction.objectStore(tableName).clear();
      await transaction.done;
      // eslint-disable-next-line no-console
      console.log(`Cleared table ${tableName}`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to clear table ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Bulk update multiple rows with transaction batching
   */
  async bulkUpdateRows(
    tableName: string,
    updates: Array<{ id: number; data: Partial<GTFSRecord> }>
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const BATCH_SIZE = 500; // Smaller batch size for updates

    try {
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        await this.updateBatch(tableName, batch);
      }

      // eslint-disable-next-line no-console
      console.log(
        `Updated ${updates.length} rows in ${tableName} in ${Math.ceil(updates.length / BATCH_SIZE)} batches`
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to bulk update rows in ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Update a single batch of rows within one transaction
   */
  private async updateBatch(
    tableName: string,
    updates: Array<{ id: number; data: Partial<GTFSRecord> }>
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction(tableName, 'readwrite');
    const store = transaction.objectStore(tableName);

    const promises = updates.map(async ({ id, data }) => {
      const existing = await store.get(id);
      if (existing) {
        const updated = { ...existing, ...data };
        return store.put(updated);
      }
    });

    await Promise.all(promises);
    await transaction.done;
  }

  /**
   * Get database storage usage statistics
   */
  async getDatabaseStats(): Promise<{
    size: number;
    tables: { [tableName: string]: number };
  }> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const tables: { [tableName: string]: number } = {};
      let totalRecords = 0;

      // Count records in each table
      for (const tableName of this.db.objectStoreNames) {
        const count = await this.db.count(tableName);
        tables[tableName] = count;
        totalRecords += count;
      }

      // Estimate storage size (rough calculation)
      const estimatedSize = totalRecords * 1024; // 1KB per record estimate

      return {
        size: estimatedSize,
        tables,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to get database stats:', error);
      throw error;
    }
  }

  /**
   * Compact database by removing unused space (requires recreation)
   */
  async compactDatabase(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // eslint-disable-next-line no-console
      console.log('Starting database compaction...');

      // Get all data from current database
      const backup: { [tableName: string]: GTFSRecord[] } = {};
      for (const tableName of this.db.objectStoreNames) {
        backup[tableName] = await this.getAllRows(tableName);
      }

      // Close current database
      this.db.close();

      // Delete the database
      await new Promise<void>((resolve, reject) => {
        const deleteReq = indexedDB.deleteDatabase(this.dbName);
        deleteReq.onsuccess = () => resolve();
        deleteReq.onerror = () => reject(deleteReq.error);
      });

      // Reinitialize database
      await this.initialize();

      // Restore all data
      for (const [tableName, rows] of Object.entries(backup)) {
        if (rows.length > 0) {
          // Remove auto-generated IDs before reinserting
          const cleanRows = rows.map(({ id: _id, ...row }) => row);
          await this.insertRows(tableName, cleanRows);
        }
      }

      // eslint-disable-next-line no-console
      console.log('Database compaction completed');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Database compaction failed:', error);
      throw error;
    }
  }

  /**
   * Search across multiple fields using indexes
   */
  async searchAllTables(
    searchTerm: string,
    limit: number = 100
  ): Promise<{ [tableName: string]: GTFSRecord[] }> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const results: { [tableName: string]: GTFSRecord[] } = {};
    const searchLower = searchTerm.toLowerCase();

    try {
      // Search in key tables with name fields
      const searchTables = ['agencies', 'routes', 'stops', 'trips'];

      for (const tableName of searchTables) {
        if (this.db.objectStoreNames.contains(tableName)) {
          const allRows = await this.getAllRows(tableName);
          const matches = allRows
            .filter((row) => {
              // Search in name fields
              const searchFields = this.getSearchableFields(tableName);
              return searchFields.some((field) => {
                const value = row[field];
                return (
                  value && value.toString().toLowerCase().includes(searchLower)
                );
              });
            })
            .slice(0, limit);

          if (matches.length > 0) {
            results[tableName] = matches;
          }
        }
      }

      return results;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Search failed:', error);
      throw error;
    }
  }

  /**
   * Get searchable fields for a table
   */
  private getSearchableFields(tableName: string): string[] {
    switch (tableName) {
      case 'agencies':
        return ['agency_name', 'agency_id'];
      case 'routes':
        return ['route_short_name', 'route_long_name', 'route_id'];
      case 'stops':
        return ['stop_name', 'stop_id', 'stop_code'];
      case 'trips':
        return ['trip_headsign', 'trip_id'];
      default:
        return [];
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
