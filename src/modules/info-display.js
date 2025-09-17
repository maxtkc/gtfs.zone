/**
 * Info Display Module
 * Handles displaying object details in the Info tab
 */

export class InfoDisplay {
  constructor(gtfsRelationships) {
    this.relationships = gtfsRelationships;
    this.container = null;
  }

  initialize(containerId = 'info-tab') {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Info display container ${containerId} not found`);
      return;
    }
  }

  showAgencyDetails(agencyId) {
    const agencies = this.relationships.getAgencies();
    const agency = agencies.find(a => a.id === agencyId);
    
    if (!agency) {
      this.showError('Agency not found');
      return;
    }

    const routes = this.relationships.getRoutesForAgency(agencyId);
    
    this.container.innerHTML = `
      <div class="p-4 overflow-y-auto h-full">
        <div class="mb-4">
          <h3 class="text-lg font-semibold text-slate-800 mb-2">🏢 Agency Details</h3>
          <div class="bg-slate-50 rounded-lg p-4">
            <h4 class="font-medium text-slate-800 mb-3">${this.escapeHtml(agency.name)}</h4>
            
            <div class="space-y-2 text-sm">
              <div><strong>ID:</strong> ${agency.id}</div>
              ${agency.url ? `<div><strong>Website:</strong> <a href="${agency.url}" target="_blank" class="text-blue-600 hover:underline">${agency.url}</a></div>` : ''}
              ${agency.timezone ? `<div><strong>Timezone:</strong> ${agency.timezone}</div>` : ''}
              ${agency.lang ? `<div><strong>Language:</strong> ${agency.lang}</div>` : ''}
              ${agency.phone ? `<div><strong>Phone:</strong> ${agency.phone}</div>` : ''}
              ${agency.email ? `<div><strong>Email:</strong> <a href="mailto:${agency.email}" class="text-blue-600 hover:underline">${agency.email}</a></div>` : ''}
            </div>
          </div>
        </div>
        
        <div>
          <h4 class="font-medium text-slate-800 mb-3">Routes (${routes.length})</h4>
          <div class="space-y-2">
            ${routes.map(route => `
              <div class="bg-white border border-slate-200 rounded p-3">
                <div class="font-medium text-slate-800">
                  ${route.shortName ? this.escapeHtml(route.shortName) + ' - ' : ''}${this.escapeHtml(route.longName || route.id)}
                </div>
                <div class="text-sm text-slate-500">Route ID: ${route.id}</div>
                ${route.desc ? `<div class="text-xs text-slate-400 mt-1">${this.escapeHtml(route.desc)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  showRouteDetails(routeId) {
    const allRoutes = this.relationships.gtfsParser.getFileData('routes.txt') || [];
    const route = allRoutes.find(r => r.route_id === routeId);
    
    if (!route) {
      this.showError('Route not found');
      return;
    }

    const trips = this.relationships.getTripsForRoute(routeId);
    const agencies = this.relationships.getAgencies();
    const agency = agencies.find(a => a.id === route.agency_id);

    this.container.innerHTML = `
      <div class="p-4 overflow-y-auto h-full">
        <div class="mb-4">
          <h3 class="text-lg font-semibold text-slate-800 mb-2">🚌 Route Details</h3>
          <div class="bg-slate-50 rounded-lg p-4">
            <h4 class="font-medium text-slate-800 mb-3">
              ${route.route_short_name ? this.escapeHtml(route.route_short_name) + ' - ' : ''}${this.escapeHtml(route.route_long_name || route.route_id)}
            </h4>
            
            <div class="space-y-2 text-sm">
              <div><strong>Route ID:</strong> ${route.route_id}</div>
              ${route.route_short_name ? `<div><strong>Short Name:</strong> ${this.escapeHtml(route.route_short_name)}</div>` : ''}
              ${route.route_long_name ? `<div><strong>Long Name:</strong> ${this.escapeHtml(route.route_long_name)}</div>` : ''}
              ${route.route_desc ? `<div><strong>Description:</strong> ${this.escapeHtml(route.route_desc)}</div>` : ''}
              <div><strong>Type:</strong> ${this.getRouteTypeText(route.route_type)}</div>
              ${agency ? `<div><strong>Agency:</strong> ${this.escapeHtml(agency.name)}</div>` : ''}
              ${route.route_color ? `<div><strong>Color:</strong> <span style="background: #${route.route_color}; color: #${route.route_text_color || 'ffffff'};" class="px-2 py-1 rounded">#${route.route_color}</span></div>` : ''}
              ${route.route_url ? `<div><strong>URL:</strong> <a href="${route.route_url}" target="_blank" class="text-blue-600 hover:underline">${route.route_url}</a></div>` : ''}
            </div>
          </div>
        </div>
        
        <div>
          <h4 class="font-medium text-slate-800 mb-3">Trips (${trips.length})</h4>
          <div class="space-y-2 max-h-64 overflow-y-auto">
            ${trips.slice(0, 20).map(trip => `
              <div class="bg-white border border-slate-200 rounded p-3">
                <div class="font-medium text-slate-800">${trip.headsign ? this.escapeHtml(trip.headsign) : trip.id}</div>
                <div class="text-sm text-slate-500">Trip ID: ${trip.id}</div>
                <div class="text-xs text-slate-400">Service: ${trip.serviceId}</div>
              </div>
            `).join('')}
            ${trips.length > 20 ? `<div class="text-sm text-slate-500 text-center py-2">... and ${trips.length - 20} more trips</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  showTripDetails(tripId) {
    const allTrips = this.relationships.gtfsParser.getFileData('trips.txt') || [];
    const trip = allTrips.find(t => t.trip_id === tripId);
    
    if (!trip) {
      this.showError('Trip not found');
      return;
    }

    const stopTimes = this.relationships.getStopTimesForTrip(tripId);
    const allRoutes = this.relationships.gtfsParser.getFileData('routes.txt') || [];
    const route = allRoutes.find(r => r.route_id === trip.route_id);

    this.container.innerHTML = `
      <div class="p-4 overflow-y-auto h-full">
        <div class="mb-4">
          <h3 class="text-lg font-semibold text-slate-800 mb-2">🚐 Trip Details</h3>
          <div class="bg-slate-50 rounded-lg p-4">
            <h4 class="font-medium text-slate-800 mb-3">${trip.trip_headsign ? this.escapeHtml(trip.trip_headsign) : trip.trip_id}</h4>
            
            <div class="space-y-2 text-sm">
              <div><strong>Trip ID:</strong> ${trip.trip_id}</div>
              ${trip.trip_headsign ? `<div><strong>Headsign:</strong> ${this.escapeHtml(trip.trip_headsign)}</div>` : ''}
              ${trip.trip_short_name ? `<div><strong>Short Name:</strong> ${this.escapeHtml(trip.trip_short_name)}</div>` : ''}
              <div><strong>Route:</strong> ${route ? (route.route_short_name || route.route_long_name || route.route_id) : trip.route_id}</div>
              <div><strong>Service ID:</strong> ${trip.service_id}</div>
              ${trip.direction_id ? `<div><strong>Direction:</strong> ${trip.direction_id}</div>` : ''}
              ${trip.block_id ? `<div><strong>Block ID:</strong> ${trip.block_id}</div>` : ''}
              ${trip.shape_id ? `<div><strong>Shape ID:</strong> ${trip.shape_id}</div>` : ''}
            </div>
          </div>
        </div>
        
        <div>
          <h4 class="font-medium text-slate-800 mb-3">Stop Times (${stopTimes.length})</h4>
          <div class="space-y-1 max-h-64 overflow-y-auto">
            ${stopTimes.map((st, index) => `
              <div class="bg-white border border-slate-200 rounded p-2 flex justify-between items-center">
                <div class="flex-1">
                  <div class="font-medium text-sm">${st.stop ? this.escapeHtml(st.stop.name) : st.stopId}</div>
                  <div class="text-xs text-slate-500">Stop ${st.stopSequence}: ${st.stopId}</div>
                </div>
                <div class="text-right">
                  <div class="text-sm font-mono">${st.arrivalTime}</div>
                  <div class="text-sm font-mono text-slate-500">${st.departureTime}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  showStopDetails(stopId) {
    const stop = this.relationships.getStopById(stopId);
    
    if (!stop) {
      this.showError('Stop not found');
      return;
    }

    const trips = this.relationships.getTripsForStop(stopId);

    this.container.innerHTML = `
      <div class="p-4 overflow-y-auto h-full">
        <div class="mb-4">
          <h3 class="text-lg font-semibold text-slate-800 mb-2">🚏 Stop Details</h3>
          <div class="bg-slate-50 rounded-lg p-4">
            <h4 class="font-medium text-slate-800 mb-3">${this.escapeHtml(stop.name)}</h4>
            
            <div class="space-y-2 text-sm">
              <div><strong>Stop ID:</strong> ${stop.id}</div>
              ${stop.code ? `<div><strong>Code:</strong> ${stop.code}</div>` : ''}
              ${stop.desc ? `<div><strong>Description:</strong> ${this.escapeHtml(stop.desc)}</div>` : ''}
              ${stop.lat && stop.lon ? `
                <div><strong>Location:</strong> ${stop.lat.toFixed(6)}, ${stop.lon.toFixed(6)}</div>
                <div><strong>Coordinates:</strong> 
                  <a href="https://www.openstreetmap.org/?mlat=${stop.lat}&mlon=${stop.lon}&zoom=18" target="_blank" class="text-blue-600 hover:underline">View on OpenStreetMap</a>
                </div>
              ` : ''}
              ${stop.zoneId ? `<div><strong>Zone ID:</strong> ${stop.zoneId}</div>` : ''}
              ${stop.url ? `<div><strong>URL:</strong> <a href="${stop.url}" target="_blank" class="text-blue-600 hover:underline">${stop.url}</a></div>` : ''}
              ${stop.locationType ? `<div><strong>Location Type:</strong> ${this.getLocationTypeText(stop.locationType)}</div>` : ''}
              ${stop.parentStation ? `<div><strong>Parent Station:</strong> ${stop.parentStation}</div>` : ''}
              ${stop.wheelchairBoarding ? `<div><strong>Wheelchair Boarding:</strong> ${this.getWheelchairText(stop.wheelchairBoarding)}</div>` : ''}
            </div>
          </div>
        </div>
        
        <div>
          <h4 class="font-medium text-slate-800 mb-3">Trips serving this stop (${trips.length})</h4>
          <div class="space-y-2 max-h-64 overflow-y-auto">
            ${trips.slice(0, 15).map(trip => `
              <div class="bg-white border border-slate-200 rounded p-3">
                <div class="font-medium text-slate-800">${trip.headsign ? this.escapeHtml(trip.headsign) : trip.id}</div>
                <div class="text-sm text-slate-500">Trip: ${trip.id} | Route: ${trip.routeId}</div>
              </div>
            `).join('')}
            ${trips.length > 15 ? `<div class="text-sm text-slate-500 text-center py-2">... and ${trips.length - 15} more trips</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  showFeedStatistics(validationResults = null) {
    const stats = this.relationships.getStatistics();
    
    let validationSection = '';
    if (validationResults) {
      const { summary } = validationResults;
      const statusColor = summary.isValid ? 'green' : summary.errorCount > 0 ? 'red' : 'yellow';
      const statusIcon = summary.isValid ? '✅' : summary.errorCount > 0 ? '❌' : '⚠️';
      const statusText = summary.isValid ? 'Valid' : summary.errorCount > 0 ? 'Has Errors' : 'Has Warnings';
      
      validationSection = `
        <div class="bg-${statusColor}-50 border border-${statusColor}-200 rounded-lg p-4 mb-6">
          <h4 class="font-medium text-${statusColor}-800 mb-3 flex items-center gap-2">
            ${statusIcon} Feed Validation
          </h4>
          <div class="grid grid-cols-3 gap-4 text-sm">
            <div class="text-center">
              <div class="text-lg font-bold text-red-600">${summary.errorCount}</div>
              <div class="text-red-800">Errors</div>
            </div>
            <div class="text-center">
              <div class="text-lg font-bold text-yellow-600">${summary.warningCount}</div>
              <div class="text-yellow-800">Warnings</div>
            </div>
            <div class="text-center">
              <div class="text-lg font-bold text-blue-600">${summary.infoCount}</div>
              <div class="text-blue-800">Info</div>
            </div>
          </div>
          <div class="mt-3 text-center">
            <button id="show-validation-details" class="text-${statusColor}-600 hover:text-${statusColor}-800 text-sm underline">
              View Validation Details
            </button>
          </div>
        </div>
      `;
    }
    
    this.container.innerHTML = `
      <div class="p-4 overflow-y-auto h-full">
        <h3 class="text-lg font-semibold text-slate-800 mb-4">📊 Feed Overview</h3>
        
        ${validationSection}
        
        <div class="grid grid-cols-2 gap-4 mb-6">
          <div class="bg-blue-50 rounded-lg p-4 text-center">
            <div class="text-2xl font-bold text-blue-600">${stats.agencies}</div>
            <div class="text-sm text-blue-800">Agencies</div>
          </div>
          <div class="bg-green-50 rounded-lg p-4 text-center">
            <div class="text-2xl font-bold text-green-600">${stats.routes}</div>
            <div class="text-sm text-green-800">Routes</div>
          </div>
          <div class="bg-purple-50 rounded-lg p-4 text-center">
            <div class="text-2xl font-bold text-purple-600">${stats.trips}</div>
            <div class="text-sm text-purple-800">Trips</div>
          </div>
          <div class="bg-orange-50 rounded-lg p-4 text-center">
            <div class="text-2xl font-bold text-orange-600">${stats.stops}</div>
            <div class="text-sm text-orange-800">Stops</div>
          </div>
        </div>
        
        <div class="bg-slate-50 rounded-lg p-4">
          <h4 class="font-medium text-slate-800 mb-3">Feed Quality</h4>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span>Total Stop Times:</span>
              <span class="font-medium">${stats.stopTimes.toLocaleString()}</span>
            </div>
            <div class="flex justify-between">
              <span>Avg. Trips per Route:</span>
              <span class="font-medium">${stats.routes > 0 ? Math.round(stats.trips / stats.routes) : 0}</span>
            </div>
            <div class="flex justify-between">
              <span>Avg. Stop Times per Trip:</span>
              <span class="font-medium">${stats.trips > 0 ? Math.round(stats.stopTimes / stats.trips) : 0}</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add event listener for validation details
    if (validationResults) {
      const detailsBtn = document.getElementById('show-validation-details');
      if (detailsBtn) {
        detailsBtn.addEventListener('click', () => {
          this.showValidationDetails(validationResults);
        });
      }
    }
  }

  showValidationDetails(validationResults) {
    const { errors, warnings, info, summary } = validationResults;
    
    const renderIssues = (issues, type, icon, colorClass) => {
      if (issues.length === 0) return '';
      
      return `
        <div class="mb-6">
          <h4 class="font-medium text-${colorClass}-800 mb-3 flex items-center gap-2">
            ${icon} ${type} (${issues.length})
          </h4>
          <div class="space-y-2 max-h-64 overflow-y-auto">
            ${issues.map(issue => `
              <div class="bg-${colorClass}-50 border border-${colorClass}-200 rounded p-3">
                <div class="font-medium text-${colorClass}-800">${this.escapeHtml(issue.message)}</div>
                <div class="text-sm text-${colorClass}-600 mt-1">
                  ${issue.fileName ? `File: ${issue.fileName}` : ''}
                  ${issue.rowNum ? ` | Row: ${issue.rowNum}` : ''}
                  ${issue.code ? ` | Code: ${issue.code}` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    };
    
    this.container.innerHTML = `
      <div class="p-4 overflow-y-auto h-full">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-slate-800">🔍 Validation Results</h3>
          <button id="back-to-overview" class="text-blue-600 hover:text-blue-800 text-sm underline">
            ← Back to Overview
          </button>
        </div>
        
        <div class="mb-6">
          <div class="grid grid-cols-3 gap-4 text-sm">
            <div class="bg-red-50 rounded-lg p-3 text-center">
              <div class="text-xl font-bold text-red-600">${summary.errorCount}</div>
              <div class="text-red-800">Errors</div>
            </div>
            <div class="bg-yellow-50 rounded-lg p-3 text-center">
              <div class="text-xl font-bold text-yellow-600">${summary.warningCount}</div>
              <div class="text-yellow-800">Warnings</div>
            </div>
            <div class="bg-blue-50 rounded-lg p-3 text-center">
              <div class="text-xl font-bold text-blue-600">${summary.infoCount}</div>
              <div class="text-blue-800">Info</div>
            </div>
          </div>
        </div>
        
        ${renderIssues(errors, 'Errors', '❌', 'red')}
        ${renderIssues(warnings, 'Warnings', '⚠️', 'yellow')}
        ${renderIssues(info, 'Information', 'ℹ️', 'blue')}
        
        ${errors.length === 0 && warnings.length === 0 && info.length === 0 ? 
          '<div class="text-center py-8 text-slate-500">No validation issues found.</div>' : ''}
      </div>
    `;
    
    // Add back button functionality
    const backBtn = document.getElementById('back-to-overview');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.showFeedStatistics(validationResults);
      });
    }
  }

  showError(message) {
    this.container.innerHTML = `
      <div class="p-4 text-center">
        <div class="text-red-500 text-lg mb-2">⚠️</div>
        <div class="text-slate-700">${message}</div>
      </div>
    `;
  }

  clearDisplay() {
    if (this.container) {
      this.container.innerHTML = `
        <div class="p-4 overflow-y-auto h-full">
          <div class="text-slate-500 text-sm text-center py-8">
            Select an object to see details
          </div>
        </div>
      `;
    }
  }

  getRouteTypeText(routeType) {
    const types = {
      '0': 'Tram/Light Rail',
      '1': 'Subway/Metro',
      '2': 'Rail',
      '3': 'Bus',
      '4': 'Ferry',
      '5': 'Cable Tram',
      '6': 'Aerial Lift',
      '7': 'Funicular',
      '11': 'Trolleybus',
      '12': 'Monorail'
    };
    return types[routeType] || `Unknown (${routeType})`;
  }

  getLocationTypeText(locationType) {
    const types = {
      '0': 'Stop/Platform',
      '1': 'Station',
      '2': 'Station Entrance/Exit',
      '3': 'Generic Node',
      '4': 'Boarding Area'
    };
    return types[locationType] || `Unknown (${locationType})`;
  }

  getWheelchairText(wheelchairBoarding) {
    const values = {
      '0': 'No information',
      '1': 'Accessible',
      '2': 'Not accessible'
    };
    return values[wheelchairBoarding] || `Unknown (${wheelchairBoarding})`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}