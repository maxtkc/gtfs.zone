/**
 * Navigation Actions
 *
 * Unified navigation methods for GTFS.zone Browse tab.
 * Provides high-level navigation functions that work with PageStateManager.
 * Replaces scattered navigation logic across multiple modules.
 */

import { PageState } from '../types/page-state.js';
import { getPageStateManager } from './page-state-manager.js';

/**
 * Navigate to home page (agencies list)
 */
export async function navigateToHome(): Promise<void> {
  const pageState: PageState = { type: 'home' };
  await getPageStateManager().navigateTo(pageState);
}

/**
 * Navigate to agency details page
 * @param agency_id - The agency ID to display
 */
export async function navigateToAgency(agency_id: string): Promise<void> {
  const pageState: PageState = {
    type: 'agency',
    agency_id: agency_id,
  };
  await getPageStateManager().navigateTo(pageState);
}

/**
 * Navigate to route details page
 * @param route_id - The route ID to display
 */
export async function navigateToRoute(route_id: string): Promise<void> {
  const pageState: PageState = {
    type: 'route',
    route_id: route_id,
  };
  await getPageStateManager().navigateTo(pageState);
}

/**
 * Navigate to timetable view for a route service
 * @param route_id - The route ID
 * @param service_id - The service ID for the timetable
 * @param direction_id - Optional direction ID (0 or 1)
 */
export async function navigateToTimetable(
  route_id: string,
  service_id: string,
  direction_id?: string
): Promise<void> {
  const pageState: PageState = {
    type: 'timetable',
    route_id: route_id,
    service_id: service_id,
    ...(direction_id && { direction_id: direction_id }),
  };
  await getPageStateManager().navigateTo(pageState);
}

/**
 * Navigate to stop details page
 * @param stop_id - The stop ID to display
 */
export async function navigateToStop(stop_id: string): Promise<void> {
  const pageState: PageState = {
    type: 'stop',
    stop_id: stop_id,
  };
  await getPageStateManager().navigateTo(pageState);
}

/**
 * Navigate to service details page
 * @param service_id - The service ID to display
 */
export async function navigateToService(service_id: string): Promise<void> {
  const pageState: PageState = {
    type: 'service',
    service_id: service_id,
  };
  await getPageStateManager().navigateTo(pageState);
}

/**
 * Navigate back to the previous page
 * @returns true if navigation was successful, false if no history available
 */
export async function navigateBack(): Promise<boolean> {
  const manager = getPageStateManager();
  if (manager.canNavigateBack()) {
    await manager.navigateBack();
    return true;
  }
  return false;
}

/**
 * Get the current page state
 */
export function getCurrentPageState(): PageState {
  return getPageStateManager().getPageState();
}

/**
 * Get the current breadcrumbs
 */
export async function getCurrentBreadcrumbs() {
  return await getPageStateManager().getBreadcrumbs();
}

/**
 * Check if back navigation is available
 */
export function canNavigateBack(): boolean {
  return getPageStateManager().canNavigateBack();
}

/**
 * Convenience navigation functions for common patterns
 */

/**
 * Navigate from agency to one of its routes
 * @param route_id - The route ID to navigate to
 */
export async function navigateToRouteFromAgency(
  route_id: string
): Promise<void> {
  await navigateToRoute(route_id);
}

/**
 * Navigate from route to one of its timetables
 * @param service_id - The service ID for the timetable
 * @param direction_id - Optional direction ID
 */
export async function navigateToTimetableFromRoute(
  service_id: string,
  direction_id?: string
): Promise<void> {
  const currentState = getCurrentPageState();
  if (currentState.type === 'route') {
    await navigateToTimetable(currentState.route_id, service_id, direction_id);
  } else {
    throw new Error('Can only navigate to timetable from route page');
  }
}

/**
 * Navigation event listener type
 */
export type NavigationListener = (pageState: PageState) => void;

/**
 * Add a listener for navigation changes
 * @param listener - Function to call when navigation occurs
 */
export function addNavigationListener(listener: NavigationListener): void {
  getPageStateManager().addNavigationHandler((event) => {
    listener(event.to);
  });
}

/**
 * Smart navigation that can determine the appropriate page type
 * based on the IDs provided. Useful for generic navigation from
 * map clicks or search results.
 */

/**
 * Navigate to object by ID, automatically determining the page type
 * @param objectId - The object ID (could be agency, route, or stop)
 * @param context - Optional context to help determine object type
 */
export async function navigateToObject(
  objectId: string,
  context?: {
    type?: 'agency' | 'route' | 'stop';
    agency_id?: string;
    route_id?: string;
  }
): Promise<void> {
  if (context?.type === 'agency') {
    await navigateToAgency(objectId);
  } else if (context?.type === 'route' && context.agency_id) {
    await navigateToRoute(context.agency_id, objectId);
  } else if (context?.type === 'stop') {
    await navigateToStop(objectId);
  } else {
    // Default behavior - try to determine from current context
    const currentState = getCurrentPageState();

    if (currentState.type === 'agency') {
      // Assume it's a route within this agency
      await navigateToRoute(currentState.agency_id, objectId);
    } else if (currentState.type === 'route') {
      // Could be a service for timetable - this would need more context
      // For now, just navigate to the route's agency
      await navigateToAgency(currentState.agency_id);
    } else {
      // Default to stop navigation
      await navigateToStop(objectId);
    }
  }
}

/**
 * URL-based navigation for handling direct links
 */

/**
 * Initialize page state from URL on page load
 */
export async function initFromURL(): Promise<void> {
  const manager = getPageStateManager();
  const url = window.location.pathname + window.location.search;
  const pageState = manager.urlToPageState(url);

  if (pageState && pageState.type !== 'home') {
    await manager.navigateTo(pageState);
  }
}
