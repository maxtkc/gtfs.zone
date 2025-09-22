/**
 * Schedule Controller Module
 * Handles timetable view for routes showing aligned trips in a standard train schedule format
 * Accessed via Objects tab → Route → Service ID
 */

export interface AlignedTrip {
  tripId: string;
  headsign: string;
  stopTimes: Map<string, string>; // stopId -> time, null for gaps
}

export interface TimetableData {
  route: any;
  service: any;
  stops: any[];
  trips: AlignedTrip[];
  directionId?: string;
  directionName?: string;
}

export class ScheduleController {
  private relationships: any;
  private gtfsParser: any;
  private uiController: any = null;

  constructor(gtfsRelationships: any, gtfsParser: any) {
    this.relationships = gtfsRelationships;
    this.gtfsParser = gtfsParser;
  }

  /**
   * Set UI controller reference for integration
   */
  setUIController(uiController: any): void {
    this.uiController = uiController;
  }

  /**
   * Entry point - show schedule for a specific route and service
   */
  showScheduleForRoute(
    routeId: string,
    serviceId: string,
    directionId?: string
  ): void {
    try {
      const timetableData = this.generateTimetableData(
        routeId,
        serviceId,
        directionId
      );
      this.renderTimetable(timetableData);

      // Update UI controller breadcrumb trail to include schedule
      if (this.uiController) {
        const route = timetableData.route;
        const service = timetableData.service;
        const directionName = timetableData.directionName;
        let scheduleItemName = service.serviceId;
        if (directionName) {
          scheduleItemName += ` - ${directionName}`;
        }
        scheduleItemName += ' Schedule';

        // Add schedule item to existing breadcrumb trail instead of replacing it
        this.uiController.updateBreadcrumbTrail('Schedule', scheduleItemName, {
          routeId: routeId,
          serviceId: serviceId,
          directionId: directionId,
          route: route,
          service: service,
          directionName: directionName,
          isSchedule: true, // Flag to indicate this is a schedule view
        });
      }
    } catch (error) {
      console.error('Error showing schedule:', error);
      this.renderError('Failed to generate schedule view');
    }
  }

  /**
   * Generate timetable data for a route and service
   */
  private generateTimetableData(
    routeId: string,
    serviceId: string,
    directionId?: string
  ): TimetableData {
    // Get route information
    const routesData = this.gtfsParser.getFileData('routes.txt') || [];
    const route = routesData.find((r: any) => r.route_id === routeId);
    if (!route) {
      throw new Error(`Route ${routeId} not found`);
    }

    // Get service information
    const service = this.relationships.getCalendarForService(serviceId) || {
      serviceId,
    };

    // Get all trips for this route and service
    const allTrips = this.relationships.getTripsForRoute(routeId);
    let trips = allTrips.filter((trip: any) => trip.serviceId === serviceId);

    // Filter by direction if specified
    if (directionId !== undefined) {
      trips = trips.filter(
        (trip: any) => (trip.directionId || '0') === directionId
      );
    }

    if (trips.length === 0) {
      const directionFilter =
        directionId !== undefined ? ` and direction ${directionId}` : '';
      throw new Error(
        `No trips found for route ${routeId}, service ${serviceId}${directionFilter}`
      );
    }

    // Get stop times for all trips and align them
    const alignedTrips = this.alignTrips(trips);

    // Get unique stops from aligned trips
    const allStopIds = new Set<string>();
    alignedTrips.forEach((trip) => {
      trip.stopTimes.forEach((time, stopId) => {
        if (time !== null) {
          allStopIds.add(stopId);
        }
      });
    });

    // Get stop details and sort by most common sequence
    const stops = this.getSortedStops(Array.from(allStopIds), trips);

    // Get direction name
    const directionName =
      directionId !== undefined
        ? this.getDirectionName(directionId, trips)
        : undefined;

    return {
      route,
      service,
      stops,
      trips: alignedTrips,
      directionId,
      directionName,
    };
  }

  /**
   * Core alignment algorithm - align trips by stops, allowing gaps
   */
  private alignTrips(trips: any[]): AlignedTrip[] {
    const alignedTrips: AlignedTrip[] = [];

    for (const trip of trips) {
      const stopTimes = this.relationships.getStopTimesForTrip(trip.id);
      const stopTimeMap = new Map<string, string>();

      // Populate stop times for this trip
      stopTimes.forEach((st: any) => {
        // Use departure time, fallback to arrival time
        const time = st.departureTime || st.arrivalTime;
        if (time) {
          stopTimeMap.set(st.stopId, time);
        }
      });

      alignedTrips.push({
        tripId: trip.id,
        headsign: trip.id,
        stopTimes: stopTimeMap,
      });
    }

    return alignedTrips;
  }

  /**
   * Get stops sorted by most common sequence position
   */
  private getSortedStops(stopIds: string[], trips: any[]): any[] {
    const stopSequences = new Map<string, number[]>();

    // Collect all sequence positions for each stop
    for (const trip of trips) {
      const stopTimes = this.relationships.getStopTimesForTrip(trip.id);
      stopTimes.forEach((st: any) => {
        if (stopIds.includes(st.stopId)) {
          if (!stopSequences.has(st.stopId)) {
            stopSequences.set(st.stopId, []);
          }
          stopSequences.get(st.stopId)!.push(st.stopSequence);
        }
      });
    }

    // Calculate average sequence for each stop
    const stopAverages = new Map<string, number>();
    stopSequences.forEach((sequences, stopId) => {
      const avg =
        sequences.reduce((sum, seq) => sum + seq, 0) / sequences.length;
      stopAverages.set(stopId, avg);
    });

    // Sort stops by average sequence
    const sortedStopIds = Array.from(stopIds).sort((a, b) => {
      return (stopAverages.get(a) || 0) - (stopAverages.get(b) || 0);
    });

    // Get stop details
    return sortedStopIds.map((stopId) => {
      return (
        this.relationships.getStopById(stopId) || { id: stopId, name: stopId }
      );
    });
  }

  /**
   * Render timetable HTML structure
   */
  private renderTimetable(data: TimetableData): void {
    const container = document.getElementById('object-details-view');
    if (!container) {
      console.error('Object details view container not found');
      return;
    }

    const html = `
      <div id="schedule-view" class="h-full flex flex-col">
        ${this.renderScheduleHeader(data.route, data.service)}
        ${this.renderTimetableContent(data)}
      </div>
    `;

    container.innerHTML = html;
    this.attachScheduleEventListeners(data);

    // Show the details view
    if (this.uiController) {
      const listView = document.getElementById('objects-list-view');
      const detailsView = document.getElementById('object-details-view');
      if (listView && detailsView) {
        listView.classList.add('hidden');
        detailsView.classList.remove('hidden');
      }
    }
  }

  /**
   * Render schedule header
   */
  private renderScheduleHeader(route: any, service: any): string {
    const routeName = route.route_short_name
      ? `${route.route_short_name}${route.route_long_name ? ' - ' + route.route_long_name : ''}`
      : route.route_long_name || route.route_id;

    const serviceName = service.serviceId;

    // Use UI controller's breadcrumb system if available
    let breadcrumbHtml = '';
    if (this.uiController) {
      // Get the current breadcrumb trail from UI controller
      breadcrumbHtml = `
        <div class="p-3 bg-base-200">
          <div class="breadcrumbs text-sm">
            <ul id="breadcrumb-list">
              <!-- Breadcrumbs will be rendered by UI controller -->
            </ul>
          </div>
        </div>
      `;

      // Re-render breadcrumbs to include schedule item
      setTimeout(() => this.uiController.renderBreadcrumbs(), 0);
    } else {
      // Fallback breadcrumb for when UI controller is not available
      breadcrumbHtml = `
        <div class="p-3 bg-base-200">
          <div class="breadcrumbs text-sm">
            <ul>
              <li>
                <a id="schedule-breadcrumb-agencies">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="h-4 w-4 stroke-current">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
                  </svg>
                </a>
              </li>
              <li><a id="schedule-breadcrumb-route">${routeName}</a></li>
              <li>${serviceName} Schedule</li>
            </ul>
          </div>
        </div>
      `;
    }

    return `
      <div class="border-b border-base-300">
        ${breadcrumbHtml}
        <div class="p-4">
          <h2 class="text-lg font-semibold">
            ${routeName} - ${serviceName}
          </h2>
          <p class="text-sm opacity-70">
            Timetable View
          </p>
        </div>
        ${this.renderServiceProperties(service)}
      </div>
    `;
  }

  /**
   * Render service properties section
   */
  private renderServiceProperties(service: any): string {
    if (!service || typeof service !== 'object') {
      return '';
    }

    // Get routes that use this service to show the warning
    const routesUsingService = this.getRoutesUsingService(service.serviceId);
    const multipleRoutes = routesUsingService.length > 1;

    // Format start and end dates
    const startDate = service.startDate
      ? this.formatDate(service.startDate)
      : 'Not specified';
    const endDate = service.endDate
      ? this.formatDate(service.endDate)
      : 'Not specified';

    // Get day-of-week properties
    const dayProps = [
      { key: 'monday', label: 'Monday', short: 'Mon' },
      { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
      { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
      { key: 'thursday', label: 'Thursday', short: 'Thu' },
      { key: 'friday', label: 'Friday', short: 'Fri' },
      { key: 'saturday', label: 'Saturday', short: 'Sat' },
      { key: 'sunday', label: 'Sunday', short: 'Sun' },
    ];

    return `
      <div class="p-4 bg-base-200/50">
        ${
          multipleRoutes
            ? `
          <div role="alert" class="alert alert-warning alert-outline mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <div class="font-medium">Service used by multiple routes</div>
              <div class="text-sm opacity-80">This service is used by ${routesUsingService.length} routes. Modifying it will affect all of them.</div>
            </div>
          </div>
        `
            : ''
        }

        <div class="card bg-base-100 shadow-sm">
          <div class="card-body p-4">
            <h3 class="card-title text-base flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Service Properties
              <div class="badge badge-secondary badge-sm">${service.serviceId}</div>
            </h3>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
              <!-- Service Period -->
              <div>
                <h4 class="font-medium text-sm mb-2 opacity-80">Service Period</h4>
                <div class="space-y-1 text-sm">
                  <div class="flex justify-between">
                    <span>Start Date:</span>
                    <span class="font-mono">${startDate}</span>
                  </div>
                  <div class="flex justify-between">
                    <span>End Date:</span>
                    <span class="font-mono">${endDate}</span>
                  </div>
                </div>
              </div>

              <!-- Operating Days -->
              <div>
                <h4 class="font-medium text-sm mb-2 opacity-80">Operating Days</h4>
                <div class="flex flex-wrap gap-1">
                  ${dayProps
                    .map(
                      (day) => `
                    <div class="badge ${service[day.key] ? 'badge-success' : 'badge-ghost'} badge-sm">
                      ${day.short}
                    </div>
                  `
                    )
                    .join('')}
                </div>
              </div>
            </div>

            ${
              multipleRoutes
                ? `
              <div class="mt-4 pt-3 border-t border-base-300">
                <h4 class="font-medium text-sm mb-2 opacity-80">Routes using this service</h4>
                <div class="flex flex-wrap gap-2">
                  ${routesUsingService
                    .slice(0, 5)
                    .map(
                      (route) => `
                    <div class="badge badge-outline badge-sm">
                      ${route.route_short_name || route.route_id}
                    </div>
                  `
                    )
                    .join('')}
                  ${
                    routesUsingService.length > 5
                      ? `
                    <div class="badge badge-ghost badge-sm">
                      +${routesUsingService.length - 5} more
                    </div>
                  `
                      : ''
                  }
                </div>
              </div>
            `
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get routes that use a specific service
   */
  private getRoutesUsingService(serviceId: string): any[] {
    const allRoutes = this.gtfsParser.getFileData('routes.txt') || [];
    const allTrips = this.gtfsParser.getFileData('trips.txt') || [];

    // Get unique route IDs that have trips using this service
    const routeIds = new Set();
    allTrips.forEach((trip: any) => {
      if (trip.service_id === serviceId) {
        routeIds.add(trip.route_id);
      }
    });

    // Return route objects for these route IDs
    return allRoutes.filter((route: any) => routeIds.has(route.route_id));
  }

  /**
   * Format GTFS date string (YYYYMMDD) to readable format
   */
  private formatDate(dateString: string): string {
    if (!dateString || dateString.length !== 8) {
      return dateString;
    }

    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);

    try {
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      return dateString;
    }
  }

  /**
   * Render timetable content
   */
  private renderTimetableContent(data: TimetableData): string {
    if (data.trips.length === 0) {
      return `
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <div class="text-4xl mb-4">🚌</div>
            <p class="text-lg">No trips found for this service</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="timetable-container flex-1 overflow-auto">
        <table class="table table-zebra table-pin-rows table-compact table-hover w-full text-sm">
          ${this.renderTimetableHeader(data.trips)}
          ${this.renderTimetableBody(data.stops, data.trips)}
        </table>
      </div>
    `;
  }

  /**
   * Render timetable header with trip columns
   */
  private renderTimetableHeader(trips: AlignedTrip[]): string {
    const tripHeaders = trips
      .map(
        (trip) => `
      <th class="trip-header p-2 text-center min-w-[80px] border-b border-base-300">
        <div class="trip-id text-xs font-medium">${trip.tripId}</div>
      </th>
    `
      )
      .join('');

    return `
      <thead class="sticky top-0 bg-base-100 z-10">
        <tr>
          <th class="stop-header p-2 text-left min-w-[200px] sticky left-0 bg-base-100 border-b border-base-300">
            Stop
          </th>
          ${tripHeaders}
        </tr>
      </thead>
    `;
  }

  /**
   * Render timetable body with stop rows
   */
  private renderTimetableBody(stops: any[], trips: AlignedTrip[]): string {
    const rows = stops
      .map((stop, index) => {
        const rowClass = '';
        const timeCells = trips
          .map((trip) => {
            const time = trip.stopTimes.get(stop.id);
            return `
          <td class="time-cell p-2 text-center ${time ? 'has-time' : 'no-time text-base-content/30'}">
            ${time ? `<span class="time-badge badge badge-ghost badge-sm font-mono">${this.formatTime(time)}</span>` : '—'}
          </td>
        `;
          })
          .join('');

        return `
        <tr class="${rowClass}">
          <td class="stop-name p-2 font-medium sticky left-0 bg-base-100 border-r border-base-300">
            <div class="stop-name-text">${this.escapeHtml(stop.name)}</div>
            <div class="stop-id text-xs opacity-70">${stop.id}</div>
          </td>
          ${timeCells}
        </tr>
      `;
      })
      .join('');

    return `<tbody>${rows}</tbody>`;
  }

  /**
   * Format time for display (HH:MM)
   */
  private formatTime(time: string): string {
    if (!time) return '';

    // Handle times like "24:30:00" or "25:15:00" (next day)
    const parts = time.split(':');
    if (parts.length >= 2) {
      const hours = parseInt(parts[0]);
      const minutes = parts[1];

      if (hours >= 24) {
        // Next day time - show as is for now, could add +1 indicator
        return `${hours}:${minutes}`;
      }

      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }

    return time;
  }

  /**
   * Attach event listeners for schedule interactions
   */
  private attachScheduleEventListeners(data: TimetableData): void {
    const container = document.getElementById('schedule-view');
    if (!container) return;

    // Breadcrumb navigation is now handled by UI controller
    // Only add fallback handlers if UI controller is not available
    if (!this.uiController) {
      const agenciesBtn = document.getElementById(
        'schedule-breadcrumb-agencies'
      );
      if (agenciesBtn) {
        agenciesBtn.addEventListener('click', () => {
          if (this.uiController) {
            this.uiController.showObjectsList();
          }
        });
      }

      const routeBtn = document.getElementById('schedule-breadcrumb-route');
      if (routeBtn) {
        routeBtn.addEventListener('click', () => {
          if (this.uiController) {
            this.uiController.showObjectsList();
            // Navigate back to the route view by calling the objects navigation
            if (this.uiController.objectsNavigation) {
              this.uiController.objectsNavigation.navigateToRoute(
                data.route.route_id
              );
            }
          }
        });
      }
    }
  }

  /**
   * Render error state
   */
  private renderError(message: string): void {
    const container = document.getElementById('object-details-view');
    if (!container) return;

    container.innerHTML = `
      <div class="h-full flex flex-col">
        <div class="border-b border-base-300">
          <div class="p-3 bg-base-200">
            <div class="breadcrumbs text-sm">
              <ul id="breadcrumb-list">
                <!-- Breadcrumbs will be rendered by UI controller -->
              </ul>
            </div>
          </div>
        </div>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <div class="text-4xl mb-4">⚠️</div>
            <p class="text-lg">${this.escapeHtml(message)}</p>
          </div>
        </div>
      </div>
    `;

    // Re-render breadcrumbs using UI controller
    if (this.uiController) {
      setTimeout(() => this.uiController.renderBreadcrumbs(), 0);
    }
  }

  /**
   * Get a human-readable direction name
   */
  private getDirectionName(directionId: string, trips: any[]): string {
    // Use standard direction names
    switch (directionId) {
      case '0':
        return 'Outbound';
      case '1':
        return 'Inbound';
      default:
        return `Direction ${directionId}`;
    }
  }

  /**
   * Escape HTML for safe display
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
