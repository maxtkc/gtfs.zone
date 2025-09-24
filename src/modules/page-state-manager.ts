/**
 * Page State Manager
 *
 * Central state management system for GTFS.zone Browse tab navigation.
 * Provides a single source of truth for page states and breadcrumb generation.
 * Replaces the fragmented navigation logic across multiple modules.
 */

import {
  PageState,
  BreadcrumbItem,
  NavigationEvent,
  PageStateManagerConfig,
  isPageState,
} from '../types/page-state.js';

/**
 * Event handler type for navigation events
 */
type NavigationEventHandler = (event: NavigationEvent) => void;

/**
 * Breadcrumb lookup functions interface
 * These will be injected to allow the manager to resolve object names
 */
export interface BreadcrumbLookup {
  getAgencyName: (agencyId: string) => Promise<string>;
  getRouteName: (routeId: string) => Promise<string>;
  getStopName: (stopId: string) => Promise<string>;
  getAgencyIdForRoute: (routeId: string) => Promise<string>;
}

/**
 * PageStateManager - Single source of truth for navigation state
 */
export class PageStateManager {
  private currentState: PageState = { type: 'home' };
  private navigationHistory: NavigationEvent[] = [];
  private eventHandlers: NavigationEventHandler[] = [];
  private config: PageStateManagerConfig;
  private breadcrumbLookup: BreadcrumbLookup | null = null;

  constructor(config: Partial<PageStateManagerConfig> = {}) {
    this.config = {
      enableHistory: true,
      maxHistoryLength: 50,
      enableUrlSync: false,
      enableBrowserHistory: false,
      ...config,
    };

    // Set up browser history integration if enabled
    if (this.config.enableBrowserHistory && typeof window !== 'undefined') {
      window.addEventListener('popstate', this.handlePopState.bind(this));
    }
  }

  /**
   * Set the breadcrumb lookup functions for resolving object names
   */
  setBreadcrumbLookup(lookup: BreadcrumbLookup): void {
    this.breadcrumbLookup = lookup;
  }

  /**
   * Get the current page state
   */
  getPageState(): PageState {
    return { ...this.currentState };
  }

  /**
   * Update the current page state
   * Triggers navigation event and updates browser history/URL if configured
   */
  async setPageState(newState: PageState): Promise<void> {
    if (!isPageState(newState)) {
      throw new Error('Invalid page state provided');
    }

    const previousState = this.currentState;
    this.currentState = { ...newState };

    // Record navigation event
    const navigationEvent: NavigationEvent = {
      from: previousState,
      to: newState,
      timestamp: Date.now(),
    };

    if (this.config.enableHistory) {
      this.navigationHistory.push(navigationEvent);

      // Limit history size
      if (this.navigationHistory.length > this.config.maxHistoryLength) {
        this.navigationHistory = this.navigationHistory.slice(
          -this.config.maxHistoryLength
        );
      }
    }

    // Update browser URL if enabled
    if (this.config.enableUrlSync && typeof window !== 'undefined') {
      const url = this.pageStateToURL(newState);
      window.history.pushState({ pageState: newState }, '', url);
    }

    // Notify event handlers
    this.eventHandlers.forEach((handler) => {
      try {
        handler(navigationEvent);
      } catch (error) {
        console.error('Error in navigation event handler:', error);
      }
    });
  }

  /**
   * Generate breadcrumbs for the current page state
   */
  async getBreadcrumbs(): Promise<BreadcrumbItem[]> {
    return this.buildBreadcrumbs(this.currentState);
  }

  /**
   * Navigate to a specific page state (convenience method)
   */
  async navigateTo(pageState: PageState): Promise<void> {
    await this.setPageState(pageState);
  }

  /**
   * Check if navigation back is possible
   */
  canNavigateBack(): boolean {
    return this.navigationHistory.length > 0;
  }

  /**
   * Navigate back to the previous page state
   */
  async navigateBack(): Promise<boolean> {
    if (!this.canNavigateBack()) {
      return false;
    }

    // Find the last different state
    const currentStateStr = JSON.stringify(this.currentState);
    for (let i = this.navigationHistory.length - 1; i >= 0; i--) {
      const historyItem = this.navigationHistory[i];
      const fromStateStr = JSON.stringify(historyItem.from);

      if (fromStateStr !== currentStateStr) {
        await this.setPageState(historyItem.from);
        return true;
      }
    }

    return false;
  }

  /**
   * Add a navigation event handler
   */
  addNavigationHandler(handler: NavigationEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Remove a navigation event handler
   */
  removeNavigationHandler(handler: NavigationEventHandler): void {
    const index = this.eventHandlers.indexOf(handler);
    if (index >= 0) {
      this.eventHandlers.splice(index, 1);
    }
  }

  /**
   * Get navigation history
   */
  getNavigationHistory(): NavigationEvent[] {
    return [...this.navigationHistory];
  }

  /**
   * Clear navigation history
   */
  clearNavigationHistory(): void {
    this.navigationHistory = [];
  }

  /**
   * Initialize from URL (call this on page load)
   */
  async initializeFromURL(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    const pageState = this.urlToPageState(
      window.location.pathname + window.location.search
    );
    if (pageState) {
      this.currentState = pageState;
    }
  }

  /**
   * Build breadcrumbs for a given page state
   */
  private async buildBreadcrumbs(
    pageState: PageState
  ): Promise<BreadcrumbItem[]> {
    const breadcrumbs: BreadcrumbItem[] = [];

    try {
      switch (pageState.type) {
        case 'home':
          // Home page has no breadcrumbs
          break;

        case 'agency': {
          const agencyName = await this.getObjectName(
            'agency',
            pageState.agencyId
          );
          breadcrumbs.push({
            label: 'Home',
            pageState: { type: 'home' },
          });
          breadcrumbs.push({
            label: agencyName,
            pageState: { type: 'agency', agencyId: pageState.agencyId },
          });
          break;
        }

        case 'route': {
          // Look up the agency for this route
          const agencyId = this.breadcrumbLookup
            ? await this.breadcrumbLookup.getAgencyIdForRoute(pageState.routeId)
            : 'unknown';
          const agencyName = await this.getObjectName('agency', agencyId);
          const routeName = await this.getObjectName(
            'route',
            pageState.routeId
          );

          breadcrumbs.push({
            label: 'Home',
            pageState: { type: 'home' },
          });
          breadcrumbs.push({
            label: agencyName,
            pageState: { type: 'agency', agencyId },
          });
          breadcrumbs.push({
            label: routeName,
            pageState: { type: 'route', routeId: pageState.routeId },
          });
          break;
        }

        case 'timetable': {
          // Look up the agency for this route
          const agencyId = this.breadcrumbLookup
            ? await this.breadcrumbLookup.getAgencyIdForRoute(pageState.routeId)
            : 'unknown';
          const agencyName = await this.getObjectName('agency', agencyId);
          const routeName = await this.getObjectName(
            'route',
            pageState.routeId
          );
          const serviceName = await this.getObjectName(
            'service',
            pageState.serviceId
          );

          breadcrumbs.push({
            label: 'Home',
            pageState: { type: 'home' },
          });
          breadcrumbs.push({
            label: agencyName,
            pageState: { type: 'agency', agencyId },
          });
          breadcrumbs.push({
            label: routeName,
            pageState: { type: 'route', routeId: pageState.routeId },
          });

          const timetableLabel = pageState.directionId
            ? `${serviceName} (Direction ${pageState.directionId})`
            : serviceName;

          breadcrumbs.push({
            label: timetableLabel,
            pageState: pageState,
          });
          break;
        }

        case 'stop': {
          const stopName = await this.getObjectName('stop', pageState.stopId);

          breadcrumbs.push({
            label: 'Home',
            pageState: { type: 'home' },
          });
          breadcrumbs.push({
            label: stopName,
            pageState: { type: 'stop', stopId: pageState.stopId },
          });
          break;
        }

        default:
          // Unknown page state - return just Home
          breadcrumbs.push({
            label: 'Home',
            pageState: { type: 'home' },
          });
      }
    } catch (error) {
      console.error('Error building breadcrumbs:', error);

      // Return fallback breadcrumbs on error
      breadcrumbs.length = 0;
      breadcrumbs.push({
        label: 'Home',
        pageState: { type: 'home' },
      });
    }

    return breadcrumbs;
  }

  /**
   * Get object name with fallback handling
   */
  private async getObjectName(
    type: 'agency' | 'route' | 'stop' | 'service',
    id: string
  ): Promise<string> {
    if (!this.breadcrumbLookup) {
      return `${type.charAt(0).toUpperCase() + type.slice(1)} ${id}`;
    }

    try {
      switch (type) {
        case 'agency':
          return await this.breadcrumbLookup.getAgencyName(id);
        case 'route':
          return await this.breadcrumbLookup.getRouteName(id);
        case 'stop':
          return await this.breadcrumbLookup.getStopName(id);
        case 'service':
          return id;
        default:
          return `Unknown ${type} ${id}`;
      }
    } catch (error) {
      console.warn(`Failed to lookup ${type} name for ID ${id}:`, error);
      return `${type.charAt(0).toUpperCase() + type.slice(1)} ${id}`;
    }
  }

  /**
   * Convert page state to URL
   */
  private pageStateToURL(pageState: PageState): string {
    const params = new URLSearchParams();

    switch (pageState.type) {
      case 'home':
        return '/';

      case 'agency':
        params.set('agency', pageState.agencyId);
        return `/?${params.toString()}`;

      case 'route':
        params.set('agency', pageState.agencyId);
        params.set('route', pageState.routeId);
        return `/?${params.toString()}`;

      case 'timetable':
        params.set('agency', pageState.agencyId);
        params.set('route', pageState.routeId);
        params.set('service', pageState.serviceId);
        if (pageState.directionId) {
          params.set('direction', pageState.directionId);
        }
        return `/?${params.toString()}`;

      case 'stop':
        params.set('stop', pageState.stopId);
        return `/?${params.toString()}`;

      default:
        return '/';
    }
  }

  /**
   * Convert URL to page state
   */
  private urlToPageState(url: string): PageState | null {
    try {
      const urlObj = new URL(url, 'http://localhost');
      const params = urlObj.searchParams;

      // Check for different page types based on URL parameters
      if (params.has('stop')) {
        return {
          type: 'stop',
          stopId: params.get('stop')!,
        };
      }

      if (params.has('agency')) {
        const agencyId = params.get('agency')!;

        if (params.has('route')) {
          const routeId = params.get('route')!;

          if (params.has('service')) {
            const serviceId = params.get('service')!;
            const directionId = params.get('direction') || undefined;

            return {
              type: 'timetable',
              agencyId,
              routeId,
              serviceId,
              ...(directionId && { directionId }),
            };
          }

          return {
            type: 'route',
            agencyId,
            routeId,
          };
        }

        return {
          type: 'agency',
          agencyId,
        };
      }

      // Default to home if no recognized parameters
      return { type: 'home' };
    } catch (error) {
      console.warn('Failed to parse URL to page state:', error);
      return null;
    }
  }

  /**
   * Handle browser popstate event
   */
  private handlePopState(event: PopStateEvent): void {
    if (event.state?.pageState && isPageState(event.state.pageState)) {
      this.currentState = event.state.pageState;

      // Trigger navigation event without adding to history (to avoid loops)
      const navigationEvent: NavigationEvent = {
        from: this.currentState, // This is a limitation - we don't know the previous state
        to: event.state.pageState,
        timestamp: Date.now(),
      };

      this.eventHandlers.forEach((handler) => {
        try {
          handler(navigationEvent);
        } catch (error) {
          console.error('Error in navigation event handler:', error);
        }
      });
    } else {
      // Fallback to URL parsing
      const pageState = this.urlToPageState(
        window.location.pathname + window.location.search
      );
      if (pageState) {
        this.currentState = pageState;
      }
    }
  }
}

/**
 * Default singleton instance for convenience
 */
let defaultInstance: PageStateManager | null = null;

/**
 * Get or create the default PageStateManager instance
 */
export function getPageStateManager(): PageStateManager {
  if (!defaultInstance) {
    defaultInstance = new PageStateManager();
  }
  return defaultInstance;
}

/**
 * Initialize the default PageStateManager instance with custom config
 */
export function initPageStateManager(
  config: Partial<PageStateManagerConfig> = {}
): PageStateManager {
  defaultInstance = new PageStateManager(config);
  return defaultInstance;
}
