/**
 * Page Content Renderer
 *
 * Unified content rendering system for GTFS.zone Browse tab.
 * Renders appropriate content based on PageState, replacing fragmented
 * rendering logic across multiple modules.
 */

import { PageState } from '../types/page-state.js';
import {
  StopViewController,
  StopViewDependencies,
} from './stop-view-controller.js';

/**
 * Interface for injected dependencies
 */
export interface ContentRendererDependencies {
  // GTFS data relationships
  relationships: {
    hasDataAsync: () => Promise<boolean>;
    getAgenciesAsync: () => Promise<unknown[]>;
    getRoutesForAgencyAsync: (agency_id: string) => Promise<unknown[]>;
    getTripsForRouteAsync: (route_id: string) => Promise<unknown[]>;
    getStopTimesForTripAsync: (trip_id: string) => Promise<unknown[]>;
    getStopAsync: (stop_id: string) => Promise<unknown>;
    getAgencyAsync: (agency_id: string) => Promise<unknown>;
    getRouteAsync: (route_id: string) => Promise<unknown>;
  };

  // GTFS database access for stop controller (optional)
  gtfsDatabase?: {
    queryRows: (
      tableName: string,
      filter?: Record<string, unknown>
    ) => Promise<unknown[]>;
    updateRow: (
      tableName: string,
      key: string,
      data: Record<string, unknown>
    ) => Promise<void>;
  };

  // GTFS relationships for stop controller (optional)
  gtfsRelationships?: {
    getAgenciesServingStop?: (stop_id: string) => Promise<unknown[]>;
    getRoutesServingStop?: (stop_id: string) => Promise<unknown[]>;
  };

  // Schedule controller for timetables
  scheduleController: {
    renderSchedule: (
      route_id: string,
      service_id: string,
      direction_id?: string
    ) => Promise<string>;
  };

  // Service days controller for calendar editing
  serviceDaysController: {
    renderServiceEditor: (service_id: string) => Promise<string>;
  };

  // Map controller for visualization updates
  mapController: {
    highlightRoute: (route_id: string) => void;
    highlightStop: (stop_id: string) => void;
    clearHighlights: () => void;
    focusOnAgency: (agency_id: string) => void;
  };

  // Navigation callbacks
  onAgencyClick: (agency_id: string) => void;
  onRouteClick: (route_id: string) => void;
  onStopClick: (stop_id: string) => void;
  onTimetableClick: (
    route_id: string,
    service_id: string,
    direction_id?: string
  ) => void;
}

/**
 * Page Content Renderer
 */
export class PageContentRenderer {
  private dependencies: ContentRendererDependencies;
  private stopViewController: StopViewController;

  constructor(dependencies: ContentRendererDependencies) {
    this.dependencies = dependencies;

    // Initialize StopViewController with current dependencies
    const stopViewDependencies: StopViewDependencies = {
      gtfsDatabase: dependencies.gtfsDatabase,
      gtfsRelationships: dependencies.gtfsRelationships || {},
      onAgencyClick: dependencies.onAgencyClick,
      onRouteClick: dependencies.onRouteClick,
    };
    this.stopViewController = new StopViewController(stopViewDependencies);
  }

  /**
   * Main rendering method - renders content based on page state
   * @param pageState - Current page state to render
   * @returns HTML string for the content
   */
  async renderPage(pageState: PageState): Promise<string> {
    try {
      // Check if GTFS data is available
      if (!(await this.dependencies.relationships.hasDataAsync())) {
        return this.renderEmptyState();
      }

      // Render based on page type
      switch (pageState.type) {
        case 'home':
          return await this.renderHome();
        case 'agency':
          return await this.renderAgency(pageState.agency_id);
        case 'route':
          return await this.renderRoute(pageState.route_id);
        case 'timetable':
          return await this.renderTimetable(
            pageState.route_id,
            pageState.service_id,
            pageState.direction_id
          );
        case 'stop':
          return await this.renderStop(pageState.stop_id);
        default:
          // TypeScript should prevent this, but fallback to home
          return await this.renderHome();
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error rendering page:', error);
      return this.renderError('Failed to load content. Please try again.');
    }
  }

  /**
   * Render loading state
   */
  renderLoading(): string {
    return `
      <div class="flex items-center justify-center p-8">
        <div class="loading loading-spinner loading-lg"></div>
        <span class="ml-3">Loading...</span>
      </div>
    `;
  }

  /**
   * Render error state
   */
  private renderError(message: string): string {
    return `
      <div class="alert alert-error m-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>${message}</span>
      </div>
    `;
  }

  /**
   * Render empty state when no GTFS data is loaded
   */
  private renderEmptyState(): string {
    return `
      <div class="hero min-h-96">
        <div class="hero-content text-center">
          <div class="max-w-md">
            <h1 class="text-5xl font-bold">No GTFS Data</h1>
            <p class="py-6">
              Please upload a GTFS file or load one from a URL to browse transit data.
            </p>
            <p class="text-sm text-base-content/70">
              Switch to the Upload tab to get started.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render home page (agencies list)
   */
  private async renderHome(): Promise<string> {
    const agencies = await this.dependencies.relationships.getAgenciesAsync();

    const agencyCards = agencies
      .map((agency: unknown) => {
        const agencyData = agency as Record<string, unknown>;
        const agencyName =
          (agencyData.agency_name as string) ||
          (agencyData.agency_id as string) ||
          'Unknown Agency';
        const agencyUrl = agencyData.agency_url
          ? `<a href="${agencyData.agency_url as string}" class="link link-primary text-sm" target="_blank" rel="noopener">${agencyData.agency_url as string}</a>`
          : '';

        return `
        <div class="card bg-base-100 shadow-sm border border-base-300 hover:shadow-md transition-shadow cursor-pointer agency-card"
             data-agency-id="${agencyData.agency_id as string}">
          <div class="card-body p-4">
            <h3 class="card-title text-base">${agencyName}</h3>
            ${agencyUrl}
            <div class="text-sm text-base-content/70">
              ID: ${agencyData.agency_id as string}
            </div>
          </div>
        </div>
      `;
      })
      .join('');

    return `
      <div class="p-4">
        <div class="mb-4">
          <h2 class="text-xl font-semibold">Transit Agencies</h2>
        </div>

        ${
          agencies.length === 0
            ? `<div class="text-center py-8 text-base-content/50">
            No agencies found in GTFS data.
          </div>`
            : `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${agencyCards}
          </div>`
        }
      </div>
    `;
  }

  /**
   * Render agency page (routes list)
   */
  private async renderAgency(agency_id: string): Promise<string> {
    const agency =
      await this.dependencies.relationships.getAgencyAsync(agency_id);
    const routes =
      await this.dependencies.relationships.getRoutesForAgencyAsync(agency_id);

    // Update map to focus on this agency
    this.dependencies.mapController.focusOnAgency(agency_id);

    const agencyData = agency as Record<string, unknown> | null;
    const agencyName = (agencyData?.agency_name as string) || agency_id;

    const routeCards = routes
      .map((route: unknown) => {
        const routeData = route as Record<string, unknown>;
        const routeName =
          (routeData.route_short_name as string) ||
          (routeData.route_long_name as string) ||
          (routeData.route_id as string);
        const routeDescription =
          (routeData.route_long_name as string) ||
          (routeData.route_desc as string) ||
          '';
        const routeColor = routeData.route_color
          ? `#${routeData.route_color as string}`
          : '';
        const routeTextColor = routeData.route_text_color
          ? `#${routeData.route_text_color as string}`
          : '';

        const colorStyle = routeColor
          ? `style="background-color: ${routeColor}; color: ${routeTextColor || '#ffffff'};"`
          : 'class="bg-primary text-primary-content"';

        return `
        <div class="card bg-base-100 shadow-sm border border-base-300 hover:shadow-md transition-shadow cursor-pointer route-card"
             data-agency-id="${agency_id}"
             data-route-id="${routeData.route_id as string}">
          <div class="card-body p-4">
            <div class="flex items-center gap-3">
              <div class="badge badge-lg font-semibold" ${colorStyle}>
                ${routeName}
              </div>
              <div class="flex-1">
                ${routeDescription ? `<h3 class="font-medium">${routeDescription}</h3>` : ''}
                <div class="text-sm text-base-content/70">
                  ID: ${routeData.route_id as string}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      })
      .join('');

    return `
      <div class="p-4">
        <div class="mb-4">
          <h2 class="text-xl font-semibold">${agencyName} Routes</h2>
          <div class="text-sm text-base-content/70">${routes.length} route${routes.length !== 1 ? 's' : ''}</div>
        </div>

        ${
          routes.length === 0
            ? `<div class="text-center py-8 text-base-content/50">
            No routes found for this agency.
          </div>`
            : `<div class="space-y-2">
            ${routeCards}
          </div>`
        }
      </div>
    `;
  }

  /**
   * Render route page (trips/services list)
   */
  private async renderRoute(route_id: string): Promise<string> {
    console.log(`Rendering route ${route_id}`);
    const route = await this.dependencies.relationships.getRouteAsync(route_id);
    const trips =
      await this.dependencies.relationships.getTripsForRouteAsync(route_id);
    console.log('Route data:', route);
    console.log('Trips count:', trips.length);
    console.log('First few trips:', trips.slice(0, 3));

    // Update map to highlight this route
    this.dependencies.mapController.highlightRoute(route_id);

    // Group trips by service_id for timetable links
    const serviceGroups = trips.reduce(
      (groups: Record<string, unknown[]>, trip: unknown) => {
        const tripData = trip as Record<string, unknown>;
        const service_id = tripData.service_id as string;
        if (!groups[service_id]) {
          groups[service_id] = [];
        }
        groups[service_id].push(trip);
        return groups;
      },
      {}
    );

    console.log('Service groups:', serviceGroups);
    console.log(
      'Service groups keys length:',
      Object.keys(serviceGroups).length
    );

    const routeData = route as Record<string, unknown> | null;
    const routeName =
      (routeData?.route_short_name as string) ||
      (routeData?.route_long_name as string) ||
      route_id;

    // Generate service cards with embedded service days editors
    const serviceCardPromises = Object.entries(serviceGroups).map(
      async ([service_id, serviceTrips]: [string, unknown[]]) => {
        const tripCount = serviceTrips.length;
        const directions = [
          ...new Set(
            serviceTrips.map(
              (trip: unknown) => (trip as Record<string, unknown>).direction_id
            )
          ),
        ];

        // Get the service days editor HTML
        const serviceEditorHTML =
          await this.dependencies.serviceDaysController.renderServiceEditor(
            service_id
          );

        return `
        <div class="card bg-base-100 shadow-sm border border-base-300 mb-6">
          <div class="card-body p-4">
            <div class="flex justify-between items-start mb-4">
              <div>
                <h3 class="card-title text-lg">Service ${service_id}</h3>
                <div class="text-sm text-base-content/70">
                  ${tripCount} trip${tripCount !== 1 ? 's' : ''}
                  ${directions.length > 1 ? ' • Both directions' : ''}
                </div>
              </div>
              <div class="card-actions">
                <button class="btn btn-sm btn-primary service-timetable-btn"
                        data-route-id="${route_id}"
                        data-service-id="${service_id}">
                  View Timetable
                </button>
              </div>
            </div>

            <!-- Service Days Editor -->
            <div class="service-days-section mt-4">
              ${serviceEditorHTML}
            </div>
          </div>
        </div>
        `;
      }
    );

    const serviceCards = (await Promise.all(serviceCardPromises)).join('');

    return `
      <div class="p-4">
        <div class="mb-4">
          <h2 class="text-xl font-semibold">Route ${routeName}</h2>
          <div class="text-sm text-base-content/70">
            ${Object.keys(serviceGroups).length} service${Object.keys(serviceGroups).length !== 1 ? 's' : ''} • ${trips.length} total trips
          </div>
        </div>

        ${
          Object.keys(serviceGroups).length === 0
            ? `<div class="text-center py-8 text-base-content/50">
            No services found for this route.
          </div>`
            : `<div class="space-y-4">
            ${serviceCards}
          </div>`
        }
      </div>
    `;
  }

  /**
   * Render timetable page
   */
  private async renderTimetable(
    route_id: string,
    service_id: string,
    direction_id?: string
  ): Promise<string> {
    try {
      // Get the rendered schedule HTML directly
      return await this.dependencies.scheduleController.renderSchedule(
        route_id,
        service_id,
        direction_id
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error rendering timetable:', error);
      return this.renderError('Failed to load timetable. Please try again.');
    }
  }

  /**
   * Render stop page
   */
  private async renderStop(stop_id: string): Promise<string> {
    // Update map to highlight this stop
    this.dependencies.mapController.highlightStop(stop_id);

    // Update StopViewController dependencies in case database became available
    const stopViewDependencies: StopViewDependencies = {
      gtfsDatabase: this.dependencies.gtfsDatabase,
      gtfsRelationships: this.dependencies.gtfsRelationships || {},
      onAgencyClick: this.dependencies.onAgencyClick,
      onRouteClick: this.dependencies.onRouteClick,
    };
    this.stopViewController.updateDependencies(stopViewDependencies);

    // Use the new StopViewController for comprehensive stop view
    return await this.stopViewController.renderStopView(stop_id);
  }

  /**
   * Add event listeners for interactive elements
   * This should be called after the content is inserted into the DOM
   */
  addEventListeners(container: HTMLElement): void {
    // Agency card clicks
    const agencyCards = container.querySelectorAll('.agency-card');
    agencyCards.forEach((card) => {
      card.addEventListener('click', () => {
        const agency_id = card.getAttribute('data-agency-id');
        if (agency_id) {
          this.dependencies.onAgencyClick(agency_id);
        }
      });
    });

    // Route card clicks
    const routeCards = container.querySelectorAll('.route-card');
    routeCards.forEach((card) => {
      card.addEventListener('click', () => {
        const route_id = card.getAttribute('data-route-id');
        if (route_id) {
          this.dependencies.onRouteClick(route_id);
        }
      });
    });

    // Service timetable button clicks
    const timetableButtons = container.querySelectorAll(
      '.service-timetable-btn'
    );
    timetableButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const route_id = button.getAttribute('data-route-id');
        const service_id = button.getAttribute('data-service-id');
        if (route_id && service_id) {
          this.dependencies.onTimetableClick(route_id, service_id);
        }
      });
    });

    // Add StopViewController event listeners
    // It will only attach to stop fields (data-table="stops.txt")
    this.stopViewController.addEventListeners(container);
  }
}
