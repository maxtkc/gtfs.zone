/**
 * Objects Navigation Module
 * Handles the hierarchical navigation UI for Objects mode
 * Uses PageStateManager for state management and breadcrumb navigation
 */

import { PageState } from '../types/page-state.js';
import { getPageStateManager } from './page-state-manager.js';
import {
  navigateToAgency,
  navigateToRoute,
  navigateToStop,
  navigateToTimetable,
  addNavigationListener,
  getCurrentPageState,
} from './navigation-actions.js';
import {
  PageContentRenderer,
  ContentRendererDependencies,
} from './page-content-renderer.js';

export class ObjectsNavigation {
  private relationships: {
    hasDataAsync: () => Promise<boolean>;
    getAgenciesAsync: () => Promise<Record<string, unknown>[]>;
    getRoutesForAgencyAsync: (
      agencyId: string
    ) => Promise<Record<string, unknown>[]>;
    getTripsForRouteAsync: (
      routeId: string
    ) => Promise<Record<string, unknown>[]>;
    getStopTimesForTripAsync: (
      tripId: string
    ) => Promise<Record<string, unknown>[]>;
    getStopByIdAsync: (
      stopId: string
    ) => Promise<Record<string, unknown> | null>;
    getServicesForRouteByDirectionAsync: (
      routeId: string
    ) => Promise<Record<string, unknown>[]>;
    getRouteByIdAsync: (
      routeId: string
    ) => Promise<Record<string, unknown> | null>;
    getTripByIdAsync: (
      tripId: string
    ) => Promise<Record<string, unknown> | null>;
    getCalendarForServiceAsync: (
      serviceId: string
    ) => Promise<Record<string, unknown> | null>;
    getAgencyByIdAsync?: (
      agencyId: string
    ) => Promise<Record<string, unknown> | null>;
  };
  private mapController: {
    highlightTrip: (tripId: string) => void;
    highlightStop: (stopId: string) => void;
    clearHighlights: () => void;
    highlightRoute: (routeId: string) => void;
    fitToRoutes: (routeIds: string[]) => void;
    focusRoute: (routeId: string) => void;
    focusStop: (stopId: string) => void;
    clearFocus: () => void;
    setRouteSelectCallback: (callback: (routeId: string) => void) => void;
    setStopSelectCallback: (callback: (stopId: string) => void) => void;
  };
  public uiController: {
    showFileInEditor: (filename: string, rowId?: string) => void;
  } | null = null; // Will be set after initialization
  public scheduleController: {
    renderSchedule: (
      routeId: string,
      serviceId: string,
      directionId?: string
    ) => Promise<string>;
  } | null = null; // Will be set after initialization
  private container: HTMLElement | null = null;
  private searchQuery: string = '';
  private searchTimeout: NodeJS.Timeout | null = null;
  private isLoading: boolean = false;
  private contentRenderer: PageContentRenderer | null = null;

  constructor(
    gtfsRelationships: {
      hasDataAsync: () => Promise<boolean>;
      getAgenciesAsync: () => Promise<Record<string, unknown>[]>;
      getRoutesForAgencyAsync: (
        agencyId: string
      ) => Promise<Record<string, unknown>[]>;
      getTripsForRouteAsync: (
        routeId: string
      ) => Promise<Record<string, unknown>[]>;
      getStopTimesForTripAsync: (
        tripId: string
      ) => Promise<Record<string, unknown>[]>;
      getStopByIdAsync: (
        stopId: string
      ) => Promise<Record<string, unknown> | null>;
      getServicesForRouteByDirectionAsync: (
        routeId: string
      ) => Promise<Record<string, unknown>[]>;
      getRouteByIdAsync: (
        routeId: string
      ) => Promise<Record<string, unknown> | null>;
      getTripByIdAsync: (
        tripId: string
      ) => Promise<Record<string, unknown> | null>;
      getCalendarForServiceAsync: (
        serviceId: string
      ) => Promise<Record<string, unknown> | null>;
      getAgencyByIdAsync?: (
        agencyId: string
      ) => Promise<Record<string, unknown> | null>;
    },
    mapController: {
      highlightTrip: (tripId: string) => void;
      highlightStop: (stopId: string) => void;
      clearHighlights: () => void;
      highlightRoute: (routeId: string) => void;
      fitToRoutes: (routeIds: string[]) => void;
      focusRoute: (routeId: string) => void;
      focusStop: (stopId: string) => void;
      clearFocus: () => void;
      setRouteSelectCallback: (callback: (routeId: string) => void) => void;
      setStopSelectCallback: (callback: (stopId: string) => void) => void;
    },
    scheduleController?: {
      renderSchedule: (
        routeId: string,
        serviceId: string,
        directionId?: string
      ) => Promise<string>;
    }
  ) {
    this.relationships = gtfsRelationships;
    this.mapController = mapController;
    this.scheduleController = scheduleController;
  }

  initialize(containerId: string): void {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      // eslint-disable-next-line no-console
      console.error(`Objects navigation container ${containerId} not found`);
      return;
    }

    // Initialize content renderer
    this.initializeContentRenderer();

    // Set up bidirectional communication with map
    this.setupMapCallbacks();

    // Add navigation listener for page state changes
    addNavigationListener((_pageState: PageState) => {
      this.render();
    });

    this.render();
  }

  private initializeContentRenderer(): void {
    const dependencies: ContentRendererDependencies = {
      relationships: {
        hasDataAsync: () => this.relationships.hasDataAsync(),
        getAgenciesAsync: () => this.relationships.getAgenciesAsync(),
        getRoutesForAgencyAsync: (agencyId: string) =>
          this.relationships.getRoutesForAgencyAsync(agencyId),
        getTripsForRouteAsync: (routeId: string) =>
          this.relationships.getTripsForRouteAsync(routeId),
        getStopTimesForTripAsync: (tripId: string) =>
          this.relationships.getStopTimesForTripAsync(tripId),
        getStopAsync: (stopId: string) =>
          this.relationships.getStopByIdAsync(stopId),
        getAgencyAsync: (agencyId: string) =>
          this.relationships.getAgencyByIdAsync?.(agencyId) ||
          Promise.resolve(null),
        getRouteAsync: (routeId: string) =>
          this.relationships.getRouteByIdAsync(routeId),
      },
      scheduleController: this.scheduleController || {
        renderSchedule: () =>
          Promise.resolve('<div>Schedule not available</div>'),
      },
      mapController: {
        highlightRoute: (routeId: string) =>
          this.mapController.highlightRoute?.(routeId),
        highlightStop: (stopId: string) =>
          this.mapController.highlightStop(stopId),
        clearHighlights: () => this.mapController.clearHighlights(),
        focusOnAgency: (agencyId: string) =>
          this.highlightAgencyOnMap(agencyId),
      },
      onAgencyClick: (agencyId: string) => navigateToAgency(agencyId),
      onRouteClick: (routeId: string) => navigateToRoute(routeId),
      onStopClick: (stopId: string) => navigateToStop(stopId),
      onTimetableClick: (
        routeId: string,
        serviceId: string,
        directionId?: string
      ) => navigateToTimetable(routeId, serviceId, directionId),
    };

    this.contentRenderer = new PageContentRenderer(dependencies);
  }

  setupMapCallbacks(): void {
    // Map clicks now use PageStateManager directly
    // No more direct tab manipulation - PageStateManager handles navigation
    // Tab switching should be handled by a navigation event listener at the app level

    console.log('Map callbacks set up to use PageStateManager navigation');
  }

  private async navigateToRouteById(routeId: string): Promise<void> {
    // Get the route to find its agency
    const route = await this.relationships.getRouteByIdAsync(routeId);
    if (route) {
      const agencyId = route.agencyId || route.agency_id || 'default';
      navigateToRoute(agencyId, routeId);
    }
  }

  async render(): Promise<void> {
    if (!this.container || !this.contentRenderer) {
      return;
    }

    if (this.isLoading) {
      this.renderLoadingState();
      return;
    }

    try {
      // Get current page state from PageStateManager
      const pageState = getCurrentPageState();

      // Get breadcrumbs from PageStateManager
      const breadcrumbs = await getPageStateManager().getBreadcrumbs();

      // Set search query in content renderer
      this.contentRenderer.setSearchQuery(this.searchQuery);

      // Render page content
      const pageContent = await this.contentRenderer.renderPage(pageState);

      this.container.innerHTML = `
        <div class="objects-navigation h-full flex flex-col">
          ${this.renderBreadcrumbs(breadcrumbs)}
          ${this.renderSearchBar()}
          <div class="content flex-1 overflow-y-auto">
            ${pageContent}
          </div>
        </div>
      `;

      this.attachEventListeners();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error rendering objects navigation:', error);
      this.renderErrorState();
    }
  }

  renderLoadingState(): void {
    if (!this.container) {
      return;
    }

    this.container.innerHTML = `
      <div class="objects-navigation h-full flex flex-col">
        ${this.renderBreadcrumbs([])}
        ${this.renderSearchBar()}
        <div class="content flex-1 flex items-center justify-center">
          <div class="text-center">
            <div class="loading loading-spinner loading-lg mb-4"></div>
            <div class="text-sm opacity-60">Loading...</div>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  renderErrorState(): void {
    if (!this.container) {
      return;
    }

    this.container.innerHTML = `
      <div class="objects-navigation h-full flex flex-col">
        ${this.renderBreadcrumbs([])}
        ${this.renderSearchBar()}
        <div class="content flex-1 flex items-center justify-center">
          <div class="text-center">
            <div class="text-4xl mb-4">⚠️</div>
            <div class="text-lg mb-2">Error loading content</div>
            <div class="text-sm opacity-60">Please try refreshing the page</div>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  renderBreadcrumbs(
    breadcrumbs: { label: string; pageState: PageState }[]
  ): string {
    if (breadcrumbs.length === 0) {
      return `
        <div class="p-3 border-b border-base-300 bg-base-200">
          <div class="breadcrumbs text-sm">
            <ul>
              <li>Home</li>
            </ul>
          </div>
        </div>
      `;
    }

    const breadcrumbItems = breadcrumbs.map((item, index) => {
      const isLast = index === breadcrumbs.length - 1;
      if (isLast) {
        return `<li>${item.label}</li>`;
      } else {
        return `<li><a class="breadcrumb-item" data-breadcrumb-index="${index}">${item.label}</a></li>`;
      }
    });

    return `
      <div class="p-3 border-b border-base-300 bg-base-200">
        <div class="breadcrumbs text-sm">
          <ul>
            ${breadcrumbItems.join('')}
          </ul>
        </div>
      </div>
    `;
  }

  renderSearchBar() {
    return `
      <div class="search-bar p-3 border-b border-slate-200">
        <div class="relative">
          <input 
            type="text" 
            id="objects-search" 
            placeholder="Search agencies, routes, trips, stops..." 
            value="${this.searchQuery}"
            class="w-full px-3 py-2 pr-8 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div class="absolute inset-y-0 right-0 flex items-center pr-3">
            ${
              this.searchQuery
                ? '<button id="clear-objects-search" class="text-slate-400 hover:text-slate-600">✕</button>'
                : '<span class="text-slate-400">🔍</span>'
            }
          </div>
        </div>
        ${this.searchQuery ? `<div class="mt-2 text-xs text-slate-500">Filtering by: "${this.searchQuery}"</div>` : ''}
      </div>
    `;
  }

  attachEventListeners() {
    if (!this.container) {
      return;
    }

    // Add event listeners from content renderer for agency/route/service cards
    if (this.contentRenderer) {
      this.contentRenderer.addEventListeners(this.container);
    }

    // Search functionality
    const searchInput = document.getElementById('objects-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value.trim();

        if (this.searchTimeout) {
          clearTimeout(this.searchTimeout);
        }

        this.searchTimeout = setTimeout(async () => {
          this.searchQuery = query;
          this.isLoading = true;
          await this.render();
          this.isLoading = false;
          await this.render();
        }, 300);
      });
    }

    // Clear search button
    this.container.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      if (target.id === 'clear-objects-search') {
        this.searchQuery = '';
        const searchInput = document.getElementById(
          'objects-search'
        ) as HTMLInputElement;
        if (searchInput) {
          searchInput.value = '';
        }
        this.isLoading = true;
        await this.render();
        this.isLoading = false;
        await this.render();
      }
    });

    // Breadcrumb navigation
    this.container.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('breadcrumb-item')) {
        const index = parseInt(target.dataset.breadcrumbIndex || '0');
        const breadcrumbs = await getPageStateManager().getBreadcrumbs();
        if (breadcrumbs[index]) {
          await getPageStateManager().navigateTo(breadcrumbs[index].pageState);
        }
      }
    });
  }

  // Map highlighting methods
  highlightAgencyOnMap(agencyId) {
    if (this.mapController && this.mapController.highlightAgencyRoutes) {
      this.mapController.highlightAgencyRoutes(agencyId);
    }
  }

  highlightRouteOnMap(routeId) {
    if (this.mapController && this.mapController.focusRoute) {
      // Use new focus method instead of old highlight method
      this.mapController.focusRoute(routeId);
    }
  }

  highlightTripOnMap(tripId) {
    if (this.mapController && this.mapController.highlightTrip) {
      this.mapController.highlightTrip(tripId);
    }
  }

  highlightStopOnMap(stopId) {
    if (this.mapController && this.mapController.highlightStop) {
      this.mapController.highlightStop(stopId);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async refresh() {
    await this.render();
  }
}
