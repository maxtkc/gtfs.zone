/**
 * GTFS Breadcrumb Lookup Implementation
 *
 * Provides concrete implementations of breadcrumb lookup functions
 * using the GTFS database for object name resolution.
 */

import { BreadcrumbLookup } from './page-state-manager.js';
import { GTFSDatabase } from './gtfs-database.js';

/**
 * GTFS-specific breadcrumb lookup implementation
 */
export class GTFSBreadcrumbLookup implements BreadcrumbLookup {
  private database: GTFSDatabase;
  private nameCache: Map<string, string> = new Map();

  constructor(database: GTFSDatabase) {
    this.database = database;
  }

  /**
   * Get agency name by ID
   */
  async getAgencyName(agency_id: string): Promise<string> {
    const cacheKey = `agency:${agency_id}`;

    if (this.nameCache.has(cacheKey)) {
      return this.nameCache.get(cacheKey)!;
    }

    try {
      const agencies = await this.database.queryRows('agency', {
        agency_id: agency_id,
      });

      if (agencies.length > 0) {
        const agency = agencies[0];
        const name = (agency.agency_name as string) || `Agency ${agency_id}`;
        this.nameCache.set(cacheKey, name);
        return name;
      }
    } catch (error) {
      console.warn(`Failed to lookup agency name for ID ${agency_id}:`, error);
    }

    // Fallback
    const fallback = `Agency ${agency_id}`;
    this.nameCache.set(cacheKey, fallback);
    return fallback;
  }

  /**
   * Get route name by ID
   */
  async getRouteName(route_id: string): Promise<string> {
    const cacheKey = `route:${route_id}`;

    if (this.nameCache.has(cacheKey)) {
      return this.nameCache.get(cacheKey)!;
    }

    try {
      const routes = await this.database.queryRows('routes', {
        route_id: route_id,
      });

      if (routes.length > 0) {
        const route = routes[0];
        // Prefer route_short_name, then route_long_name, then route_id
        const name =
          (route.route_short_name as string) ||
          (route.route_long_name as string) ||
          `Route ${route_id}`;
        this.nameCache.set(cacheKey, name);
        return name;
      }
    } catch (error) {
      console.warn(`Failed to lookup route name for ID ${route_id}:`, error);
    }

    // Fallback
    const fallback = `Route ${route_id}`;
    this.nameCache.set(cacheKey, fallback);
    return fallback;
  }

  /**
   * Get stop name by ID
   */
  async getStopName(stop_id: string): Promise<string> {
    const cacheKey = `stop:${stop_id}`;

    if (this.nameCache.has(cacheKey)) {
      return this.nameCache.get(cacheKey)!;
    }

    try {
      const stops = await this.database.queryRows('stops', {
        stop_id: stop_id,
      });

      if (stops.length > 0) {
        const stop = stops[0];
        const name = (stop.stop_name as string) || `Stop ${stop_id}`;
        this.nameCache.set(cacheKey, name);
        return name;
      }
    } catch (error) {
      console.warn(`Failed to lookup stop name for ID ${stop_id}:`, error);
    }

    // Fallback
    const fallback = `Stop ${stop_id}`;
    this.nameCache.set(cacheKey, fallback);
    return fallback;
  }

  /**
   * Clear the name cache (call when GTFS data is reloaded)
   */
  clearCache(): void {
    this.nameCache.clear();
  }

  /**
   * Preload commonly used names into cache for better performance
   */
  async preloadCache(): Promise<void> {
    try {
      // Preload all agencies
      const agencies = await this.database.getAllRows('agency');
      agencies.forEach((agency) => {
        if (agency.agency_id && agency.agency_name) {
          const cacheKey = `agency:${agency.agency_id}`;
          this.nameCache.set(cacheKey, agency.agency_name as string);
        }
      });

      // Preload all routes
      const routes = await this.database.getAllRows('routes');
      routes.forEach((route) => {
        if (route.route_id) {
          const name =
            (route.route_short_name as string) ||
            (route.route_long_name as string) ||
            `Route ${route.route_id}`;
          const cacheKey = `route:${route.route_id}`;
          this.nameCache.set(cacheKey, name);
        }
      });

      // Preload all stops (limit to first 1000 for performance)
      const stops = await this.database.queryRows('stops', undefined);
      stops.slice(0, 1000).forEach((stop) => {
        if (stop.stop_id && stop.stop_name) {
          const cacheKey = `stop:${stop.stop_id}`;
          this.nameCache.set(cacheKey, stop.stop_name as string);
        }
      });

      console.log(
        `Preloaded ${this.nameCache.size} names into breadcrumb cache`
      );
    } catch (error) {
      console.warn('Failed to preload breadcrumb cache:', error);
    }
  }

  /**
   * Get agency ID for a route (needed for simplified navigation)
   */
  async getAgencyIdForRoute(route_id: string): Promise<string> {
    const cacheKey = `route_agency:${route_id}`;

    if (this.nameCache.has(cacheKey)) {
      return this.nameCache.get(cacheKey)!;
    }

    try {
      const routes = await this.database.queryRows('routes', {
        route_id: route_id,
      });

      if (routes.length > 0) {
        const route = routes[0];
        const agency_id = (route.agency_id as string) || 'default';
        this.nameCache.set(cacheKey, agency_id);
        return agency_id;
      }
    } catch (error) {
      console.warn(`Failed to lookup agency for route ID ${route_id}:`, error);
    }

    // Fallback
    const fallback = 'default';
    this.nameCache.set(cacheKey, fallback);
    return fallback;
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.nameCache.size,
      keys: Array.from(this.nameCache.keys()).slice(0, 10), // Show first 10 keys
    };
  }
}

/**
 * Create and configure a GTFS breadcrumb lookup instance
 */
export function createGTFSBreadcrumbLookup(
  database: GTFSDatabase
): GTFSBreadcrumbLookup {
  return new GTFSBreadcrumbLookup(database);
}
