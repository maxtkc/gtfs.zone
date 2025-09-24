/**
 * Page Content Renderer
 *
 * Unified content rendering system for GTFS.zone Browse tab.
 * Renders appropriate content based on PageState, replacing fragmented
 * rendering logic across multiple modules.
 */

import { PageState } from '../types/page-state.js';

/**
 * Interface for injected dependencies
 */
export interface ContentRendererDependencies {
  // GTFS data relationships
  relationships: {
    hasDataAsync: () => Promise<boolean>;
    getAgenciesAsync: () => Promise<unknown[]>;
    getRoutesForAgencyAsync: (agencyId: string) => Promise<unknown[]>;
    getTripsForRouteAsync: (routeId: string) => Promise<unknown[]>;
    getStopTimesForTripAsync: (tripId: string) => Promise<unknown[]>;
    getStopAsync: (stopId: string) => Promise<unknown>;
    getAgencyAsync: (agencyId: string) => Promise<unknown>;
    getRouteAsync: (routeId: string) => Promise<unknown>;
  };

  // Schedule controller for timetables
  scheduleController: {
    renderSchedule: (
      routeId: string,
      serviceId: string,
      directionId?: string
    ) => Promise<string>;
  };

  // Map controller for visualization updates
  mapController: {
    highlightRoute: (routeId: string) => void;
    highlightStop: (stopId: string) => void;
    clearHighlights: () => void;
    focusOnAgency: (agencyId: string) => void;
  };

  // Navigation callbacks
  onAgencyClick: (agencyId: string) => void;
  onRouteClick: (routeId: string) => void;
  onStopClick: (stopId: string) => void;
  onTimetableClick: (
    routeId: string,
    serviceId: string,
    directionId?: string
  ) => void;
}

/**
 * Page Content Renderer
 */
export class PageContentRenderer {
  private dependencies: ContentRendererDependencies;
  private searchQuery: string = '';

  constructor(dependencies: ContentRendererDependencies) {
    this.dependencies = dependencies;
  }

  /**
   * Set search query for filtering content
   */
  setSearchQuery(query: string): void {
    this.searchQuery = query.toLowerCase();
  }

  /**
   * Clear search query
   */
  clearSearch(): void {
    this.searchQuery = '';
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
          return await this.renderAgency(pageState.agencyId);
        case 'route':
          return await this.renderRoute(pageState.routeId);
        case 'timetable':
          return await this.renderTimetable(
            pageState.routeId,
            pageState.serviceId,
            pageState.directionId
          );
        case 'stop':
          return await this.renderStop(pageState.stopId);
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
    let agencies = await this.dependencies.relationships.getAgenciesAsync();

    // Apply search filter
    if (this.searchQuery) {
      agencies = agencies.filter((agency: unknown) => {
        const agencyData = agency as Record<string, unknown>;
        const agencyName = agencyData.agency_name as string | undefined;
        const agencyId = agencyData.agency_id as string | undefined;
        return (
          agencyName?.toLowerCase().includes(this.searchQuery) ||
          agencyId?.toLowerCase().includes(this.searchQuery)
        );
      });
    }

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

    const searchInput = this.searchQuery ? `value="${this.searchQuery}"` : '';

    return `
      <div class="p-4">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold">Transit Agencies</h2>
          <div class="form-control">
            <input type="text"
                   placeholder="Search agencies..."
                   class="input input-bordered input-sm w-64"
                   id="agency-search"
                   ${searchInput} />
          </div>
        </div>

        ${
          agencies.length === 0
            ? `<div class="text-center py-8 text-base-content/50">
            ${this.searchQuery ? 'No agencies found matching your search.' : 'No agencies found in GTFS data.'}
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
  private async renderAgency(agencyId: string): Promise<string> {
    const agency =
      await this.dependencies.relationships.getAgencyAsync(agencyId);
    let routes =
      await this.dependencies.relationships.getRoutesForAgencyAsync(agencyId);

    // Update map to focus on this agency
    this.dependencies.mapController.focusOnAgency(agencyId);

    // Apply search filter
    if (this.searchQuery) {
      routes = routes.filter((route: unknown) => {
        const routeData = route as Record<string, unknown>;
        const routeShortName = routeData.route_short_name as string | undefined;
        const routeLongName = routeData.route_long_name as string | undefined;
        const routeId = routeData.route_id as string | undefined;
        return (
          routeShortName?.toLowerCase().includes(this.searchQuery) ||
          routeLongName?.toLowerCase().includes(this.searchQuery) ||
          routeId?.toLowerCase().includes(this.searchQuery)
        );
      });
    }

    const agencyData = agency as Record<string, unknown> | null;
    const agencyName = (agencyData?.agency_name as string) || agencyId;

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
             data-agency-id="${agencyId}"
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

    const searchInput = this.searchQuery ? `value="${this.searchQuery}"` : '';

    return `
      <div class="p-4">
        <div class="flex justify-between items-center mb-4">
          <div>
            <h2 class="text-xl font-semibold">${agencyName} Routes</h2>
            <div class="text-sm text-base-content/70">${routes.length} route${routes.length !== 1 ? 's' : ''}</div>
          </div>
          <div class="form-control">
            <input type="text"
                   placeholder="Search routes..."
                   class="input input-bordered input-sm w-64"
                   id="route-search"
                   ${searchInput} />
          </div>
        </div>

        ${
          routes.length === 0
            ? `<div class="text-center py-8 text-base-content/50">
            ${this.searchQuery ? 'No routes found matching your search.' : 'No routes found for this agency.'}
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
  private async renderRoute(routeId: string): Promise<string> {
    console.log(`Rendering route ${routeId}`);
    const route = await this.dependencies.relationships.getRouteAsync(routeId);
    const trips =
      await this.dependencies.relationships.getTripsForRouteAsync(routeId);
    console.log(route);
    console.log(trips);

    // Update map to highlight this route
    this.dependencies.mapController.highlightRoute(routeId);

    // Group trips by service_id for timetable links
    const serviceGroups = trips.reduce(
      (groups: Record<string, unknown[]>, trip: unknown) => {
        const tripData = trip as Record<string, unknown>;
        const serviceId = tripData.service_id as string;
        if (!groups[serviceId]) {
          groups[serviceId] = [];
        }
        groups[serviceId].push(trip);
        return groups;
      },
      {}
    );

    const routeData = route as Record<string, unknown> | null;
    const routeName =
      (routeData?.route_short_name as string) ||
      (routeData?.route_long_name as string) ||
      routeId;

    const serviceCards = Object.entries(serviceGroups)
      .map(([serviceId, serviceTrips]: [string, unknown[]]) => {
        const tripCount = serviceTrips.length;
        const directions = [
          ...new Set(
            serviceTrips.map(
              (trip: unknown) => (trip as Record<string, unknown>).direction_id
            )
          ),
        ];

        return `
        <div class="card bg-base-100 shadow-sm border border-base-300 hover:shadow-md transition-shadow cursor-pointer service-card"
             data-route-id="${routeId}"
             data-service-id="${serviceId}">
          <div class="card-body p-4">
            <h3 class="card-title text-base">Service ${serviceId}</h3>
            <div class="text-sm text-base-content/70">
              ${tripCount} trip${tripCount !== 1 ? 's' : ''}
              ${directions.length > 1 ? ' • Both directions' : ''}
            </div>
            <div class="card-actions justify-end">
              <button class="btn btn-sm btn-primary">View Timetable</button>
            </div>
          </div>
        </div>
      `;
      })
      .join('');

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
            : `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
    routeId: string,
    serviceId: string,
    directionId?: string
  ): Promise<string> {
    try {
      // Get the rendered schedule HTML directly
      return await this.dependencies.scheduleController.renderSchedule(
        routeId,
        serviceId,
        directionId
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
  private async renderStop(stopId: string): Promise<string> {
    const stop = await this.dependencies.relationships.getStopAsync(stopId);

    if (!stop) {
      return this.renderError('Stop not found.');
    }

    // Update map to highlight this stop
    this.dependencies.mapController.highlightStop(stopId);

    const stopData = stop as Record<string, unknown>;
    const stopName = (stopData.stop_name as string) || stopId;
    const stopCode = stopData.stop_code as string | undefined;
    const stopDesc = stopData.stop_desc as string | undefined;
    const coordinates =
      stopData.stop_lat && stopData.stop_lon
        ? `${stopData.stop_lat as string}, ${stopData.stop_lon as string}`
        : '';

    return `
      <div class="p-4">
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h2 class="card-title">${stopName}</h2>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <div class="text-sm font-medium">Stop ID</div>
                <div class="text-base-content/70">${stopId}</div>
              </div>

              ${
                stopCode
                  ? `
                <div>
                  <div class="text-sm font-medium">Stop Code</div>
                  <div class="text-base-content/70">${stopCode}</div>
                </div>
              `
                  : ''
              }

              ${
                coordinates
                  ? `
                <div>
                  <div class="text-sm font-medium">Coordinates</div>
                  <div class="text-base-content/70">${coordinates}</div>
                </div>
              `
                  : ''
              }

              ${
                stopDesc
                  ? `
                <div class="md:col-span-2">
                  <div class="text-sm font-medium">Description</div>
                  <div class="text-base-content/70">${stopDesc}</div>
                </div>
              `
                  : ''
              }
            </div>
          </div>
        </div>
      </div>
    `;
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
        const agencyId = card.getAttribute('data-agency-id');
        if (agencyId) {
          this.dependencies.onAgencyClick(agencyId);
        }
      });
    });

    // Route card clicks
    const routeCards = container.querySelectorAll('.route-card');
    routeCards.forEach((card) => {
      card.addEventListener('click', () => {
        const routeId = card.getAttribute('data-route-id');
        if (routeId) {
          this.dependencies.onRouteClick(routeId);
        }
      });
    });

    // Service card clicks (for timetables)
    const serviceCards = container.querySelectorAll('.service-card');
    serviceCards.forEach((card) => {
      card.addEventListener('click', () => {
        const routeId = card.getAttribute('data-route-id');
        const serviceId = card.getAttribute('data-service-id');
        if (routeId && serviceId) {
          this.dependencies.onTimetableClick(routeId, serviceId);
        }
      });
    });

    // Search input handlers
    const agencySearch = container.querySelector(
      '#agency-search'
    ) as HTMLInputElement;
    if (agencySearch) {
      agencySearch.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value;
        this.setSearchQuery(query);
        // Trigger re-render - this would need to be handled by the caller
      });
    }

    const routeSearch = container.querySelector(
      '#route-search'
    ) as HTMLInputElement;
    if (routeSearch) {
      routeSearch.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value;
        this.setSearchQuery(query);
        // Trigger re-render - this would need to be handled by the caller
      });
    }
  }
}
