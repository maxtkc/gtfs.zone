/**
 * Page State Types for GTFS.zone Browse Tab Navigation
 *
 * This module defines the core types for the unified page state management system.
 * Every page in the application should be uniquely identified by a PageState,
 * making breadcrumbs deterministic and navigation predictable.
 */

/**
 * Union type representing all possible page states in the application.
 * Each state contains the minimal set of object keys needed to uniquely
 * identify and restore the page content.
 *
 * Simplified: route_id and stop_id are unique across the entire GTFS feed,
 * so we don't need to track agency_id for routes/timetables.
 */
export type PageState =
  | { type: 'home' }
  | { type: 'agency'; agencyId: string }
  | { type: 'route'; routeId: string }
  | {
      type: 'timetable';
      routeId: string;
      serviceId: string;
      directionId?: string;
    }
  | { type: 'stop'; stopId: string };

/**
 * Represents a single item in the breadcrumb trail.
 * Links a human-readable label to the page state it represents.
 */
export type BreadcrumbItem = {
  label: string;
  pageState: PageState;
};

/**
 * Type guard to check if a value is a valid PageState
 */
export function isPageState(value: unknown): value is PageState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const state = value as { type?: string };
  if (!state.type || typeof state.type !== 'string') {
    return false;
  }

  switch (state.type) {
    case 'home':
      return Object.keys(state).length === 1;

    case 'agency': {
      const agencyState = state as { type: string; agencyId?: string };
      return (
        Object.keys(state).length === 2 &&
        typeof agencyState.agencyId === 'string'
      );
    }

    case 'route': {
      const routeState = state as { type: string; routeId?: string };
      return (
        Object.keys(state).length === 2 &&
        typeof routeState.routeId === 'string'
      );
    }

    case 'timetable': {
      const timetableState = state as {
        type: string;
        routeId?: string;
        serviceId?: string;
        directionId?: string;
      };
      const hasRequiredFields =
        typeof timetableState.routeId === 'string' &&
        typeof timetableState.serviceId === 'string';
      const hasValidDirectionId =
        timetableState.directionId === undefined ||
        typeof timetableState.directionId === 'string';
      const keyCount = Object.keys(state).length;
      return (
        hasRequiredFields &&
        hasValidDirectionId &&
        (keyCount === 3 || keyCount === 4)
      );
    }

    case 'stop': {
      const stopState = state as { type: string; stopId?: string };
      return (
        Object.keys(state).length === 2 && typeof stopState.stopId === 'string'
      );
    }

    default:
      return false;
  }
}

/**
 * Type guard to check if a value is a valid BreadcrumbItem
 */
export function isBreadcrumbItem(value: unknown): value is BreadcrumbItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as { label?: string; pageState?: unknown };
  return typeof item.label === 'string' && isPageState(item.pageState);
}

/**
 * Utility type for extracting page state type
 */
export type PageStateType = PageState['type'];

/**
 * Utility type for extracting specific page state by type
 */
export type ExtractPageState<T extends PageStateType> = Extract<
  PageState,
  { type: T }
>;

/**
 * Navigation event types for the page state manager
 */
export type NavigationEvent = {
  from: PageState;
  to: PageState;
  timestamp: number;
};

/**
 * Configuration options for page state manager
 * Simplified: URL sync disabled for cleaner user experience
 */
export type PageStateManagerConfig = {
  enableHistory: boolean;
  maxHistoryLength: number;
  enableUrlSync: boolean;
  enableBrowserHistory: boolean;
};
