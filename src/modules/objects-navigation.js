/**
 * Objects Navigation Module
 * Handles the hierarchical navigation UI for Objects mode
 * Provides breadcrumb navigation and object selection
 */

export class ObjectsNavigation {
  constructor(gtfsRelationships, mapController, infoDisplay = null) {
    this.relationships = gtfsRelationships;
    this.mapController = mapController;
    this.infoDisplay = infoDisplay;
    this.currentView = 'agencies'; // agencies, routes, trips, stop-times, stop-detail
    this.breadcrumb = [];
    this.container = null;
    this.searchQuery = '';
    this.searchTimeout = null;
  }

  initialize(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Objects navigation container ${containerId} not found`);
      return;
    }
    
    this.render();
  }

  render() {
    if (!this.container) return;
    
    if (!this.relationships.hasData()) {
      this.renderEmptyState();
      return;
    }
    
    this.container.innerHTML = `
      <div class="objects-navigation h-full flex flex-col">
        ${this.renderBreadcrumb()}
        ${this.renderSearchBar()}
        ${this.renderContent()}
      </div>
    `;
    
    this.attachEventListeners();
  }

  renderBreadcrumb() {
    if (this.breadcrumb.length === 0) {
      return '';
    }
    
    const breadcrumbItems = this.breadcrumb.map((item, index) => {
      const isLast = index === this.breadcrumb.length - 1;
      return `
        <button class="breadcrumb-item text-sm ${isLast ? 'text-slate-600 font-medium' : 'text-blue-600 hover:text-blue-800'}" 
                data-breadcrumb-index="${index}" 
                ${isLast ? 'disabled' : ''}>
          ${item.name}
        </button>
      `;
    }).join('<span class="text-slate-400 mx-2">›</span>');
    
    return `
      <div class="breadcrumb p-3 border-b border-slate-200 bg-slate-50">
        <div class="flex items-center text-sm">
          <button class="breadcrumb-home text-blue-600 hover:text-blue-800" data-action="home">
            🏠 Home
          </button>
          ${this.breadcrumb.length > 0 ? '<span class="text-slate-400 mx-2">›</span>' + breadcrumbItems : ''}
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
            ${this.searchQuery ? 
              '<button id="clear-objects-search" class="text-slate-400 hover:text-slate-600">✕</button>' :
              '<span class="text-slate-400">🔍</span>'
            }
          </div>
        </div>
        ${this.searchQuery ? `<div class="mt-2 text-xs text-slate-500">Filtering by: "${this.searchQuery}"</div>` : ''}
      </div>
    `;
  }

  renderContent() {
    switch (this.currentView) {
      case 'agencies':
        return this.renderAgencies();
      case 'routes':
        return this.renderRoutes();
      case 'trips':
        return this.renderTrips();
      case 'stop-times':
        return this.renderStopTimes();
      case 'stop-detail':
        return this.renderStopDetail();
      default:
        return this.renderAgencies();
    }
  }

  renderAgencies() {
    let agencies = this.relationships.getAgencies();
    
    // Apply search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      agencies = agencies.filter(agency => 
        agency.name.toLowerCase().includes(query) ||
        agency.id.toLowerCase().includes(query) ||
        (agency.timezone && agency.timezone.toLowerCase().includes(query))
      );
    }
    
    if (agencies.length === 0) {
      const message = this.searchQuery ? 
        `No agencies found matching "${this.searchQuery}"` : 
        'No agencies found';
      const submessage = this.searchQuery ? 
        'Try a different search term' : 
        'Add agency.txt to get started';
        
      return `
        <div class="p-4 text-center text-slate-500">
          <div class="text-lg mb-2">🏢</div>
          <div>${message}</div>
          <div class="text-sm mt-1">${submessage}</div>
        </div>
      `;
    }
    
    const agencyItems = agencies.map(agency => `
      <div class="object-item agency-item p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer" 
           data-agency-id="${agency.id}">
        <div class="flex items-center">
          <div class="text-lg mr-3">🏢</div>
          <div class="flex-1">
            <div class="font-medium text-slate-800">${this.escapeHtml(agency.name)}</div>
            <div class="text-sm text-slate-500">ID: ${agency.id}</div>
            ${agency.timezone ? `<div class="text-xs text-slate-400">${agency.timezone}</div>` : ''}
          </div>
          <div class="text-slate-400">›</div>
        </div>
      </div>
    `).join('');
    
    return `
      <div class="content flex-1 overflow-y-auto">
        <div class="p-3">
          <h3 class="text-lg font-medium text-slate-800 mb-3">
            Agencies ${this.searchQuery ? `(${agencies.length} of ${this.relationships.getAgencies().length})` : ''}
          </h3>
        </div>
        ${agencyItems}
      </div>
    `;
  }

  renderRoutes() {
    const currentAgency = this.breadcrumb[this.breadcrumb.length - 1];
    let routes = this.relationships.getRoutesForAgency(currentAgency.id);
    
    // Apply search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      routes = routes.filter(route => 
        (route.shortName && route.shortName.toLowerCase().includes(query)) ||
        (route.longName && route.longName.toLowerCase().includes(query)) ||
        route.id.toLowerCase().includes(query) ||
        (route.desc && route.desc.toLowerCase().includes(query))
      );
    }
    
    if (routes.length === 0) {
      const message = this.searchQuery ? 
        `No routes found matching "${this.searchQuery}"` : 
        'No routes found for this agency';
      const submessage = this.searchQuery ? 
        'Try a different search term' : 
        '';
        
      return `
        <div class="p-4 text-center text-slate-500">
          <div class="text-lg mb-2">🚌</div>
          <div>${message}</div>
          ${submessage ? `<div class="text-sm mt-1">${submessage}</div>` : ''}
        </div>
      `;
    }
    
    const routeItems = routes.map(route => `
      <div class="object-item route-item p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer" 
           data-route-id="${route.id}">
        <div class="flex items-center">
          <div class="text-lg mr-3">🚌</div>
          <div class="flex-1">
            <div class="font-medium text-slate-800">
              ${route.shortName ? this.escapeHtml(route.shortName) + ' - ' : ''}${this.escapeHtml(route.longName || route.id)}
            </div>
            <div class="text-sm text-slate-500">Route ID: ${route.id}</div>
            ${route.desc ? `<div class="text-xs text-slate-400">${this.escapeHtml(route.desc)}</div>` : ''}
          </div>
          <div class="text-slate-400">›</div>
        </div>
      </div>
    `).join('');
    
    const allRoutes = this.relationships.getRoutesForAgency(currentAgency.id);
    
    return `
      <div class="content flex-1 overflow-y-auto">
        <div class="p-3">
          <h3 class="text-lg font-medium text-slate-800 mb-3">
            Routes ${this.searchQuery ? `(${routes.length} of ${allRoutes.length})` : ''}
          </h3>
        </div>
        ${routeItems}
      </div>
    `;
  }

  renderTrips() {
    const currentRoute = this.breadcrumb[this.breadcrumb.length - 1];
    const trips = this.relationships.getTripsForRoute(currentRoute.id);
    
    if (trips.length === 0) {
      return `
        <div class="p-4 text-center text-slate-500">
          <div class="text-lg mb-2">🚐</div>
          <div>No trips found for this route</div>
        </div>
      `;
    }
    
    const tripItems = trips.map(trip => `
      <div class="object-item trip-item p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer" 
           data-trip-id="${trip.id}">
        <div class="flex items-center">
          <div class="text-lg mr-3">🚐</div>
          <div class="flex-1">
            <div class="font-medium text-slate-800">
              ${trip.headsign ? this.escapeHtml(trip.headsign) : trip.id}
            </div>
            <div class="text-sm text-slate-500">Trip ID: ${trip.id}</div>
            <div class="text-xs text-slate-400">Service: ${trip.serviceId}</div>
          </div>
          <div class="text-slate-400">›</div>
        </div>
      </div>
    `).join('');
    
    return `
      <div class="content flex-1 overflow-y-auto">
        <div class="p-3">
          <h3 class="text-lg font-medium text-slate-800 mb-3">Trips</h3>
        </div>
        ${tripItems}
      </div>
    `;
  }

  renderStopTimes() {
    const currentTrip = this.breadcrumb[this.breadcrumb.length - 1];
    const stopTimes = this.relationships.getStopTimesForTrip(currentTrip.id);
    
    if (stopTimes.length === 0) {
      return `
        <div class="p-4 text-center text-slate-500">
          <div class="text-lg mb-2">⏰</div>
          <div>No stop times found for this trip</div>
        </div>
      `;
    }
    
    const stopTimeItems = stopTimes.map(stopTime => `
      <div class="object-item stop-time-item p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer" 
           data-stop-id="${stopTime.stopId}">
        <div class="flex items-center">
          <div class="text-lg mr-3">🚏</div>
          <div class="flex-1">
            <div class="font-medium text-slate-800">
              ${stopTime.stop ? this.escapeHtml(stopTime.stop.name) : stopTime.stopId}
            </div>
            <div class="text-sm text-slate-500">
              ${stopTime.arrivalTime} - ${stopTime.departureTime}
            </div>
            <div class="text-xs text-slate-400">
              Stop ${stopTime.stopSequence}: ${stopTime.stopId}
            </div>
          </div>
          <div class="text-slate-400">›</div>
        </div>
      </div>
    `).join('');
    
    return `
      <div class="content flex-1 overflow-y-auto">
        <div class="p-3">
          <h3 class="text-lg font-medium text-slate-800 mb-3">Stop Times</h3>
        </div>
        ${stopTimeItems}
      </div>
    `;
  }

  renderStopDetail() {
    const currentStop = this.breadcrumb[this.breadcrumb.length - 1];
    const stop = this.relationships.getStopById(currentStop.id);
    const trips = this.relationships.getTripsForStop(currentStop.id);
    
    if (!stop) {
      return `
        <div class="p-4 text-center text-slate-500">
          <div class="text-lg mb-2">❌</div>
          <div>Stop not found</div>
        </div>
      `;
    }
    
    const tripItems = trips.map(trip => `
      <div class="trip-item p-2 border border-slate-200 rounded mb-2">
        <div class="font-medium text-sm">${trip.headsign || trip.id}</div>
        <div class="text-xs text-slate-500">Trip: ${trip.id} | Route: ${trip.routeId}</div>
      </div>
    `).join('');
    
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
            
            ${stop.lat && stop.lon ? `
              <div class="mt-3 p-3 bg-white rounded border">
                <div class="text-sm font-medium text-slate-700">Location</div>
                <div class="text-sm text-slate-600">
                  Lat: ${stop.lat.toFixed(6)}, Lon: ${stop.lon.toFixed(6)}
                </div>
              </div>
            ` : ''}
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
    if (!this.container) return;
    
    // Search functionality
    const searchInput = document.getElementById('objects-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        if (this.searchTimeout) {
          clearTimeout(this.searchTimeout);
        }
        
        this.searchTimeout = setTimeout(() => {
          this.searchQuery = query;
          this.render();
        }, 300);
      });
    }
    
    // Clear search button
    this.container.addEventListener('click', (e) => {
      if (e.target.id === 'clear-objects-search') {
        this.searchQuery = '';
        const searchInput = document.getElementById('objects-search');
        if (searchInput) {
          searchInput.value = '';
        }
        this.render();
      }
    });
    
    // Breadcrumb navigation
    this.container.addEventListener('click', (e) => {
      if (e.target.classList.contains('breadcrumb-home')) {
        this.navigateHome();
      } else if (e.target.classList.contains('breadcrumb-item')) {
        const index = parseInt(e.target.dataset.breadcrumbIndex);
        this.navigateToBreadcrumb(index);
      }
    });
    
    // Object item clicks
    this.container.addEventListener('click', (e) => {
      const agencyItem = e.target.closest('.agency-item');
      const routeItem = e.target.closest('.route-item');
      const tripItem = e.target.closest('.trip-item');
      const stopTimeItem = e.target.closest('.stop-time-item');
      
      if (agencyItem) {
        this.navigateToAgency(agencyItem.dataset.agencyId);
      } else if (routeItem) {
        this.navigateToRoute(routeItem.dataset.routeId);
      } else if (tripItem) {
        this.navigateToTrip(tripItem.dataset.tripId);
      } else if (stopTimeItem) {
        this.navigateToStop(stopTimeItem.dataset.stopId);
      }
    });
  }

  navigateHome() {
    this.currentView = 'agencies';
    this.breadcrumb = [];
    this.searchQuery = ''; // Clear search when navigating
    this.render();
    
    // Show feed statistics in Info tab when at home
    if (this.infoDisplay && this.relationships.hasData()) {
      this.infoDisplay.showFeedStatistics();
    }
  }

  navigateToBreadcrumb(index) {
    this.breadcrumb = this.breadcrumb.slice(0, index + 1);
    
    if (index === 0) {
      this.currentView = 'routes';
    } else if (index === 1) {
      this.currentView = 'trips';
    } else if (index === 2) {
      this.currentView = 'stop-times';
    }
    
    this.render();
  }

  navigateToAgency(agencyId) {
    const agencies = this.relationships.getAgencies();
    const agency = agencies.find(a => a.id === agencyId);
    
    if (agency) {
      this.breadcrumb = [{ id: agencyId, name: agency.name, type: 'agency' }];
      this.currentView = 'routes';
      this.render();
      
      // Highlight agency routes on map
      this.highlightAgencyOnMap(agencyId);
      
      // Show agency details in Info tab
      if (this.infoDisplay) {
        this.infoDisplay.showAgencyDetails(agencyId);
      }
    }
  }

  navigateToRoute(routeId) {
    const currentAgency = this.breadcrumb[0];
    const routes = this.relationships.getRoutesForAgency(currentAgency.id);
    const route = routes.find(r => r.id === routeId);
    
    if (route) {
      this.breadcrumb[1] = { id: routeId, name: route.shortName || route.longName || routeId, type: 'route' };
      this.currentView = 'trips';
      this.render();
      
      // Highlight route on map
      this.highlightRouteOnMap(routeId);
      
      // Show route details in Info tab
      if (this.infoDisplay) {
        this.infoDisplay.showRouteDetails(routeId);
      }
    }
  }

  navigateToTrip(tripId) {
    const currentRoute = this.breadcrumb[1];
    const trips = this.relationships.getTripsForRoute(currentRoute.id);
    const trip = trips.find(t => t.id === tripId);
    
    if (trip) {
      this.breadcrumb[2] = { id: tripId, name: trip.headsign || tripId, type: 'trip' };
      this.currentView = 'stop-times';
      this.render();
      
      // Highlight trip on map
      this.highlightTripOnMap(tripId);
      
      // Show trip details in Info tab
      if (this.infoDisplay) {
        this.infoDisplay.showTripDetails(tripId);
      }
    }
  }

  navigateToStop(stopId) {
    const stop = this.relationships.getStopById(stopId);
    
    if (stop) {
      this.breadcrumb[3] = { id: stopId, name: stop.name, type: 'stop' };
      this.currentView = 'stop-detail';
      this.render();
      
      // Highlight stop on map
      this.highlightStopOnMap(stopId);
      
      // Show stop details in Info tab
      if (this.infoDisplay) {
        this.infoDisplay.showStopDetails(stopId);
      }
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

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  refresh() {
    this.render();
  }
}