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

  constructor(database: GTFSDatabase) {
    this.database = database;
  }

  /**
   * Get agency name by ID
   */
  async getAgencyName(agency_id: string): Promise<string> {
    try {
      const agencies = await this.database.queryRows('agency', {
        agency_id: agency_id,
      });

      if (agencies.length > 0) {
        const agency = agencies[0];
        const name = (agency.agency_name as string) || `Agency ${agency_id}`;
        return name;
      }
    } catch (error) {
      console.warn(`Failed to lookup agency name for ID ${agency_id}:`, error);
    }

    // Fallback
    return `Agency ${agency_id}`;
  }

  /**
   * Get route name by ID
   */
  async getRouteName(route_id: string): Promise<string> {
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
        return name;
      }
    } catch (error) {
      console.warn(`Failed to lookup route name for ID ${route_id}:`, error);
    }

    // Fallback
    return `Route ${route_id}`;
  }

  /**
   * Get stop name by ID
   */
  async getStopName(stop_id: string): Promise<string> {
    try {
      const stops = await this.database.queryRows('stops', {
        stop_id: stop_id,
      });

      if (stops.length > 0) {
        const stop = stops[0];
        const name = (stop.stop_name as string) || `Stop ${stop_id}`;
        return name;
      }
    } catch (error) {
      console.warn(`Failed to lookup stop name for ID ${stop_id}:`, error);
    }

    // Fallback
    return `Stop ${stop_id}`;
  }

  /**
   * No-op cache clearing method for compatibility
   */
  clearCache(): void {
    // No cache to clear - data is always loaded fresh from database
  }

  /**
   * No-op preload method for compatibility
   */
  async preloadCache(): Promise<void> {
    // No cache to preload - data is always loaded fresh from database
  }

  /**
   * Get agency ID for a route (needed for simplified navigation)
   */
  async getAgencyIdForRoute(route_id: string): Promise<string> {
    try {
      const routes = await this.database.queryRows('routes', {
        route_id: route_id,
      });

      if (routes.length > 0) {
        const route = routes[0];
        const agency_id = (route.agency_id as string) || 'default';
        return agency_id;
      }
    } catch (error) {
      console.warn(`Failed to lookup agency for route ID ${route_id}:`, error);
    }

    // Fallback
    return 'default';
  }

  /**
   * Get cache statistics for debugging (no-op since no cache)
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: 0,
      keys: [], // No cache, so no keys
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
