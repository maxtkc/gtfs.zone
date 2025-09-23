/**
 * Objects Navigation Module
 * Handles the hierarchical navigation UI for Objects mode
 * Provides breadcrumb navigation and object selection
 */

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
  };
  private mapController: {
    highlightTrip: (tripId: string) => void;
    highlightStop: (stopId: string) => void;
  };
  public uiController: {
    showFileInEditor: (filename: string, rowId?: string) => void;
  } | null = null; // Will be set after initialization
  public scheduleController: Record<string, unknown> | null = null; // Will be set after initialization
  private currentView: string = 'agencies'; // agencies, routes, trips, stop-times, stop-detail
  private breadcrumb: Record<string, unknown>[] = [];
  private container: HTMLElement | null = null;
  private searchQuery: string = '';
  private searchTimeout: NodeJS.Timeout | null = null;
  private isLoading: boolean = false;

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
    },
    mapController: {
      highlightTrip: (tripId: string) => void;
      highlightStop: (stopId: string) => void;
    }
  ) {
    this.relationships = gtfsRelationships;
    this.mapController = mapController;
  }

  initialize(containerId: string): void {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      // eslint-disable-next-line no-console
      console.error(`Objects navigation container ${containerId} not found`);
      return;
    }

    this.render();
  }

  async render(): Promise<void> {
    if (!this.container) {
      return;
    }

    if (!(await this.relationships.hasDataAsync())) {
      this.renderEmptyState();
      return;
    }

    if (this.isLoading) {
      this.renderLoadingState();
      return;
    }

    this.container.innerHTML = `
      <div class="objects-navigation h-full flex flex-col">
        ${this.renderBreadcrumb()}
        ${this.renderSearchBar()}
        ${await this.renderContent()}
      </div>
    `;

    this.attachEventListeners();
  }

  renderLoadingState(): void {
    if (!this.container) {
      return;
    }

    this.container.innerHTML = `
      <div class="objects-navigation h-full flex flex-col">
        ${this.renderBreadcrumb()}
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

  renderBreadcrumb() {
    const breadcrumbItems = [
      `<li><a class="breadcrumb-home" data-action="home">Home</a></li>`,
    ];

    this.breadcrumb.forEach((item, index) => {
      const isLast = index === this.breadcrumb.length - 1;
      if (isLast) {
        breadcrumbItems.push(`<li>${item.name}</li>`);
      } else {
        breadcrumbItems.push(
          `<li><a class="breadcrumb-item" data-breadcrumb-index="${index}">${item.name}</a></li>`
        );
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

  async renderContent() {
    switch (this.currentView) {
      case 'agencies':
        return await this.renderAgencies();
      case 'routes':
        return await this.renderRoutes();
      case 'trips':
        return await this.renderTrips();
      case 'stop-times':
        return await this.renderStopTimes();
      case 'stop-detail':
        return await this.renderStopDetail();
      default:
        return await this.renderAgencies();
    }
  }

  async renderAgencies() {
    let agencies = await this.relationships.getAgenciesAsync();

    // Apply search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      agencies = agencies.filter(
        (agency) =>
          agency.name.toLowerCase().includes(query) ||
          agency.id.toLowerCase().includes(query) ||
          (agency.timezone && agency.timezone.toLowerCase().includes(query))
      );
    }

    if (agencies.length === 0) {
      const message = this.searchQuery
        ? `No agencies found matching "${this.searchQuery}"`
        : 'No agencies found';
      const submessage = this.searchQuery
        ? 'Try a different search term'
        : 'Add agency.txt to get started';

      return `
        <div class="p-4 text-center">
          <div class="text-lg mb-2">🏢</div>
          <div>${message}</div>
          <div class="text-sm mt-1 opacity-60">${submessage}</div>
        </div>
      `;
    }

    const agencyItems = agencies
      .map(
        (agency) => `
      <li class="list-row agency-item cursor-pointer" data-agency-id="${agency.id}">
        <div class="text-lg">🏢</div>
        <div class="list-col-grow">
          <div class="font-medium">${this.escapeHtml(agency.name)}</div>
          <div class="text-xs opacity-60">ID: ${agency.id}</div>
          ${agency.timezone ? `<div class="text-xs opacity-40">${agency.timezone}</div>` : ''}
        </div>
        <div class="opacity-60">›</div>
      </li>
    `
      )
      .join('');

    const totalAgencies = await this.relationships.getAgenciesAsync();
    return `
      <div class="content flex-1 overflow-y-auto">
        <div class="p-4 pb-2 text-xs opacity-60 tracking-wide">
          Agencies ${this.searchQuery ? `(${agencies.length} of ${totalAgencies.length})` : ''}
        </div>
        <ul class="list">
          ${agencyItems}
        </ul>
      </div>
    `;
  }

  async renderRoutes() {
    const currentAgency = this.breadcrumb[this.breadcrumb.length - 1];
    let routes = await this.relationships.getRoutesForAgencyAsync(
      currentAgency.id
    );

    // Apply search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      routes = routes.filter(
        (route) =>
          (route.shortName && route.shortName.toLowerCase().includes(query)) ||
          (route.longName && route.longName.toLowerCase().includes(query)) ||
          route.id.toLowerCase().includes(query) ||
          (route.desc && route.desc.toLowerCase().includes(query))
      );
    }

    if (routes.length === 0) {
      const message = this.searchQuery
        ? `No routes found matching "${this.searchQuery}"`
        : 'No routes found for this agency';
      const submessage = this.searchQuery ? 'Try a different search term' : '';

      return `
        <div class="p-4 text-center">
          <div class="text-lg mb-2">🚌</div>
          <div>${message}</div>
          ${submessage ? `<div class="text-sm mt-1 opacity-60">${submessage}</div>` : ''}
        </div>
      `;
    }

    const routeItems = routes
      .map(
        (route) => `
      <li class="list-row route-item cursor-pointer" data-route-id="${route.id}">
        <div class="text-lg">🚌</div>
        <div class="list-col-grow">
          <div class="font-medium">
            ${route.shortName ? this.escapeHtml(route.shortName) + ' - ' : ''}${this.escapeHtml(route.longName || route.id)}
          </div>
          <div class="text-xs opacity-60">Route ID: ${route.id}</div>
          ${route.desc ? `<div class="text-xs opacity-40">${this.escapeHtml(route.desc)}</div>` : ''}
        </div>
        <div class="opacity-60">›</div>
      </li>
    `
      )
      .join('');

    const allRoutes = await this.relationships.getRoutesForAgencyAsync(
      currentAgency.id
    );

    return `
      <div class="content flex-1 overflow-y-auto">
        <div class="p-4 pb-2 text-xs opacity-60 tracking-wide">
          Routes ${this.searchQuery ? `(${routes.length} of ${allRoutes.length})` : ''}
        </div>
        <ul class="list">
          ${routeItems}
        </ul>
      </div>
    `;
  }

  async renderTrips() {
    const currentRoute = this.breadcrumb[this.breadcrumb.length - 1];
    const trips = await this.relationships.getTripsForRouteAsync(
      currentRoute.id
    );

    if (trips.length === 0) {
      return `
        <div class="p-4 text-center">
          <div class="text-lg mb-2">🚐</div>
          <div>No trips found for this route</div>
        </div>
      `;
    }

    const tripItems = trips
      .map(
        (trip) => `
      <li class="list-row trip-item cursor-pointer" data-trip-id="${trip.id}">
        <div class="text-lg">🚐</div>
        <div class="list-col-grow">
          <div class="font-medium">
            ${trip.id}
          </div>
          <div class="text-xs opacity-60">Trip ID: ${trip.id}</div>
          <div class="text-xs opacity-40">Service: ${trip.serviceId}</div>
        </div>
        <div class="opacity-60">›</div>
      </li>
    `
      )
      .join('');

    return `
      <div class="content flex-1 overflow-y-auto">
        <div class="p-4 pb-2 text-xs opacity-60 tracking-wide">Trips</div>
        <ul class="list">
          ${tripItems}
        </ul>
      </div>
    `;
  }

  async renderStopTimes() {
    const currentTrip = this.breadcrumb[this.breadcrumb.length - 1];
    const stopTimes = await this.relationships.getStopTimesForTripAsync(
      currentTrip.id
    );

    if (stopTimes.length === 0) {
      return `
        <div class="p-4 text-center">
          <div class="text-lg mb-2">⏰</div>
          <div>No stop times found for this trip</div>
        </div>
      `;
    }

    const stopTimeItems = stopTimes
      .map(
        (stopTime) => `
      <li class="list-row stop-time-item cursor-pointer" data-stop-id="${stopTime.stopId}">
        <div class="text-lg">🚏</div>
        <div class="list-col-grow">
          <div class="font-medium">
            ${stopTime.stop ? this.escapeHtml(stopTime.stop.name) : stopTime.stopId}
          </div>
          <div class="text-xs opacity-60">
            ${stopTime.arrivalTime} - ${stopTime.departureTime}
          </div>
          <div class="text-xs opacity-40">
            Stop ${stopTime.stopSequence}: ${stopTime.stopId}
          </div>
        </div>
        <div class="opacity-60">›</div>
      </li>
    `
      )
      .join('');

    return `
      <div class="content flex-1 overflow-y-auto">
        <div class="p-4 pb-2 text-xs opacity-60 tracking-wide">Stop Times</div>
        <ul class="list">
          ${stopTimeItems}
        </ul>
      </div>
    `;
  }

  async renderStopDetail() {
    const currentStop = this.breadcrumb[this.breadcrumb.length - 1];
    const stop = await this.relationships.getStopByIdAsync(currentStop.id);
    const trips = await this.relationships.getTripsForStopAsync(currentStop.id);

    if (!stop) {
      return `
        <div class="p-4 text-center text-slate-500">
          <div class="text-lg mb-2">❌</div>
          <div>Stop not found</div>
        </div>
      `;
    }

    const tripItems = trips
      .map(
        (trip) => `
      <div class="trip-item p-2 border border-slate-200 rounded mb-2">
        <div class="font-medium text-sm">${trip.id}</div>
        <div class="text-xs text-slate-500">Trip: ${trip.id} | Route: ${trip.routeId}</div>
      </div>
    `
      )
      .join('');

    return `
      <div class="content flex-1 overflow-y-auto">
        <div class="p-4">
          <h3 class="text-lg font-medium text-slate-800 mb-3">Stop Details</h3>
          
          <div class="stop-info bg-slate-50 rounded-lg p-4 mb-4">
            <div class="flex items-start">
              <div class="text-2xl mr-3">🚏</div>
              <div class="flex-1">
                <h4 class="font-medium text-slate-800">${this.escapeHtml(stop.name)}</h4>
                <div class="text-sm text-slate-500 mt-1">ID: ${stop.id}</div>
                ${stop.code ? `<div class="text-sm text-slate-500">Code: ${stop.code}</div>` : ''}
                ${stop.desc ? `<div class="text-sm text-slate-600 mt-2">${this.escapeHtml(stop.desc)}</div>` : ''}
              </div>
            </div>
            
            ${
              stop.lat && stop.lon
                ? `
              <div class="mt-3 p-3 bg-white rounded border">
                <div class="text-sm font-medium text-slate-700">Location</div>
                <div class="text-sm text-slate-600">
                  Lat: ${stop.lat.toFixed(6)}, Lon: ${stop.lon.toFixed(6)}
                </div>
              </div>
            `
                : ''
            }
          </div>
          
          <div class="trips-section">
            <h4 class="font-medium text-slate-800 mb-3">Trips serving this stop (${trips.length})</h4>
            ${trips.length > 0 ? tripItems : '<div class="text-slate-500 text-sm">No trips found</div>'}
          </div>
        </div>
      </div>
    `;
  }

  renderEmptyState() {
    this.container.innerHTML = `
      <div class="p-4 text-center text-slate-500">
        <div class="text-4xl mb-4">📊</div>
        <div class="text-lg mb-2">No GTFS data to explore</div>
        <div class="text-sm">Upload a GTFS file or create a new feed to get started</div>
      </div>
    `;
  }

  attachEventListeners() {
    if (!this.container) {
      return;
    }

    // Search functionality
    const searchInput = document.getElementById('objects-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();

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
      if (e.target.id === 'clear-objects-search') {
        this.searchQuery = '';
        const searchInput = document.getElementById('objects-search');
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
      if (e.target.classList.contains('breadcrumb-home')) {
        await this.navigateHome();
      } else if (e.target.classList.contains('breadcrumb-item')) {
        const index = parseInt(e.target.dataset.breadcrumbIndex);
        await this.navigateToBreadcrumb(index);
      }
    });

    // Object item clicks
    this.container.addEventListener('click', async (e) => {
      const agencyItem = e.target.closest('.agency-item');
      const routeItem = e.target.closest('.route-item');
      const tripItem = e.target.closest('.trip-item');
      const stopTimeItem = e.target.closest('.stop-time-item');

      if (agencyItem) {
        await this.navigateToAgency(agencyItem.dataset.agencyId);
      } else if (routeItem) {
        await this.navigateToRoute(routeItem.dataset.routeId);
      } else if (tripItem) {
        await this.navigateToTrip(tripItem.dataset.tripId);
      } else if (stopTimeItem) {
        await this.navigateToStop(stopTimeItem.dataset.stopId);
      }
    });
  }

  async navigateHome() {
    this.currentView = 'agencies';
    this.breadcrumb = [];
    this.searchQuery = ''; // Clear search when navigating
    this.isLoading = true;
    await this.render();
    this.isLoading = false;
    await this.render();

    // Show feed statistics in Info tab when at home
    if (this.infoDisplay && (await this.relationships.hasDataAsync())) {
      this.infoDisplay.showFeedStatistics();
    }
  }

  async navigateToBreadcrumb(index) {
    this.breadcrumb = this.breadcrumb.slice(0, index + 1);

    if (index === 0) {
      this.currentView = 'routes';
    } else if (index === 1) {
      this.currentView = 'trips';
    } else if (index === 2) {
      this.currentView = 'stop-times';
    }

    this.isLoading = true;
    await this.render();
    this.isLoading = false;
    await this.render();
  }

  async navigateToAgency(agencyId) {
    const agencies = await this.relationships.getAgenciesAsync();
    const agency = agencies.find((a) => a.id === agencyId);

    if (agency) {
      // Get routes for this agency to show as related objects
      const routes = await this.relationships.getRoutesForAgencyAsync(agencyId);
      const relatedObjects = routes.map((route) => ({
        name: route.shortName
          ? `${route.shortName} - ${route.longName || route.id}`
          : route.longName || route.id,
        type: 'Route',
        data: route,
        relatedObjects: [], // We can add trips here later if needed
        routeAction: true, // Flag to indicate this should call navigateToRoute
        routeId: route.id,
      }));

      // Show agency details in the object details view
      if (this.uiController) {
        this.uiController.showObjectDetails('Agency', agency, relatedObjects);
      }

      // Highlight agency routes on map
      this.highlightAgencyOnMap(agencyId);
    }
  }

  async navigateToRoute(routeId) {
    const route = await this.relationships.getRouteByIdAsync(routeId);

    if (route) {
      // Get services for this route grouped by direction
      const services =
        await this.relationships.getServicesForRouteByDirectionAsync(routeId);
      const relatedObjects = services.map((service) => {
        const serviceName = this.formatServiceNameWithDirection(service);
        return {
          name: serviceName,
          type: 'Service',
          data: service,
          relatedObjects: [],
          scheduleAction: true, // Flag to indicate this should open schedule view
          routeId: routeId,
          directionId: service.directionId, // Add direction ID for filtering
        };
      });

      // Show route details in the object details view
      if (this.uiController) {
        this.uiController.showObjectDetails('Route', route, relatedObjects);
      }

      // Highlight route on map
      this.highlightRouteOnMap(routeId);
    }
  }

  async navigateToTrip(tripId) {
    const trip = await this.relationships.getTripByIdAsync(tripId);

    if (trip) {
      // Get stop times for this trip to show as related objects
      const stopTimes =
        await this.relationships.getStopTimesForTripAsync(tripId);
      const relatedObjects = stopTimes.map((stopTime) => ({
        name: stopTime.stop ? stopTime.stop.name : stopTime.stopId,
        type: 'Stop',
        data: stopTime.stop || { stop_id: stopTime.stopId },
        relatedObjects: [],
      }));

      // Show trip details in the object details view
      if (this.uiController) {
        this.uiController.showObjectDetails('Trip', trip, relatedObjects);
      }

      // Highlight trip on map
      this.highlightTripOnMap(tripId);
    }
  }

  async navigateToStop(stopId) {
    const stop = await this.relationships.getStopByIdAsync(stopId);

    if (stop) {
      // Get trips for this stop to show as related objects
      const trips = await this.relationships.getTripsForStopAsync(stopId);
      const relatedObjects = trips.map((trip) => ({
        name: trip.id,
        type: 'Trip',
        data: trip,
        relatedObjects: [],
      }));

      // Show stop details in the object details view
      if (this.uiController) {
        this.uiController.showObjectDetails('Stop', stop, relatedObjects);
      }

      // Highlight stop on map
      this.highlightStopOnMap(stopId);
    }
  }

  // Map highlighting methods
  highlightAgencyOnMap(agencyId) {
    if (this.mapController && this.mapController.highlightAgencyRoutes) {
      this.mapController.highlightAgencyRoutes(agencyId);
    }
  }

  highlightRouteOnMap(routeId) {
    if (this.mapController && this.mapController.highlightRoute) {
      this.mapController.clearHighlights();
      this.mapController.highlightRoute(routeId);

      // Fit map to this route
      this.mapController.fitToRoutes([routeId]);
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

  formatServiceName(service: Record<string, unknown>): string {
    const { serviceId, calendar, tripCount } = service;

    let serviceName = serviceId;

    if (calendar) {
      const days = [];
      if (calendar.monday) {
        days.push('Mon');
      }
      if (calendar.tuesday) {
        days.push('Tue');
      }
      if (calendar.wednesday) {
        days.push('Wed');
      }
      if (calendar.thursday) {
        days.push('Thu');
      }
      if (calendar.friday) {
        days.push('Fri');
      }
      if (calendar.saturday) {
        days.push('Sat');
      }
      if (calendar.sunday) {
        days.push('Sun');
      }

      if (days.length === 7) {
        dayDescription = 'Daily';
      } else if (days.length === 5 && !calendar.saturday && !calendar.sunday) {
        dayDescription = 'Weekdays';
      } else if (days.length === 2 && calendar.saturday && calendar.sunday) {
        dayDescription = 'Weekends';
      } else {
        dayDescription = days.join(', ');
      }

      serviceName = serviceId;
    }

    serviceName += ` - ${tripCount} trips`;

    return serviceName;
  }

  formatServiceNameWithDirection(service: Record<string, unknown>): string {
    const { serviceId, calendar, tripCount, directionName } = service;

    let serviceName = serviceId;

    if (calendar) {
      const days = [];
      let dayDescription;
      if (calendar.monday) {
        days.push('Mon');
      }
      if (calendar.tuesday) {
        days.push('Tue');
      }
      if (calendar.wednesday) {
        days.push('Wed');
      }
      if (calendar.thursday) {
        days.push('Thu');
      }
      if (calendar.friday) {
        days.push('Fri');
      }
      if (calendar.saturday) {
        days.push('Sat');
      }
      if (calendar.sunday) {
        days.push('Sun');
      }

      if (days.length === 7) {
        dayDescription = 'Daily';
      } else if (days.length === 5 && !calendar.saturday && !calendar.sunday) {
        dayDescription = 'Weekdays';
      } else if (days.length === 2 && calendar.saturday && calendar.sunday) {
        dayDescription = 'Weekends';
      } else {
        dayDescription = days.join(', ');
      }

      serviceName = `${serviceId} (${dayDescription})`;
    }

    // Add direction information
    serviceName += ` - ${directionName} - ${tripCount} trips`;

    return serviceName;
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
