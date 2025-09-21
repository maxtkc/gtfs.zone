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
  showScheduleForRoute(routeId: string, serviceId: string): void {
    try {
      const timetableData = this.generateTimetableData(routeId, serviceId);
      this.renderTimetable(timetableData);
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
    serviceId: string
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
    const trips = allTrips.filter((trip: any) => trip.serviceId === serviceId);

    if (trips.length === 0) {
      throw new Error(
        `No trips found for route ${routeId} and service ${serviceId}`
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

    return {
      route,
      service,
      stops,
      trips: alignedTrips,
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
        headsign: trip.headsign || trip.id,
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

    // Format service days for display
    const serviceDays = this.formatServiceDays(data.service);

    const html = `
      <div id="schedule-view" class="h-full flex flex-col">
        ${this.renderScheduleHeader(data.route, data.service, serviceDays)}
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
  private renderScheduleHeader(
    route: any,
    service: any,
    serviceDays: string
  ): string {
    return `
      <div class="schedule-header p-4 border-b border-slate-200 bg-slate-50">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-800">
              ${route.route_short_name ? route.route_short_name + ' - ' : ''}${route.route_long_name || route.route_id}
            </h2>
            <p class="text-sm text-slate-600">
              Service: ${service.serviceId} ${serviceDays ? '(' + serviceDays + ')' : ''}
            </p>
          </div>
          <button id="back-to-objects" class="btn btn-sm btn-ghost">
            ← Back to Route
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render timetable content
   */
  private renderTimetableContent(data: TimetableData): string {
    if (data.trips.length === 0) {
      return `
        <div class="flex-1 flex items-center justify-center text-slate-500">
          <div class="text-center">
            <div class="text-4xl mb-4">🚌</div>
            <p class="text-lg">No trips found for this service</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="timetable-container flex-1 overflow-auto">
        <table class="table table-zebra table-pin-rows w-full text-sm">
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
      <th class="trip-header p-2 text-center border border-slate-300 bg-slate-100 min-w-[80px]">
        <div class="trip-headsign font-medium text-xs mb-1">${this.escapeHtml(trip.headsign)}</div>
        <div class="trip-actions">
          <button class="duplicate-trip-btn text-xs text-info hover:text-info-content"
                  data-trip-id="${trip.tripId}"
                  title="Duplicate Trip">
            📋
          </button>
        </div>
        <div class="trip-id text-xs text-slate-500 mt-1">${trip.tripId}</div>
      </th>
    `
      )
      .join('');

    return `
      <thead class="sticky top-0 bg-white z-10">
        <tr>
          <th class="stop-header p-2 text-left border border-slate-300 bg-slate-100 min-w-[200px]">
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
        const rowClass = index % 2 === 0 ? 'bg-white' : 'bg-slate-50';
        const timeCells = trips
          .map((trip) => {
            const time = trip.stopTimes.get(stop.id);
            return `
          <td class="time-cell p-2 text-center border border-slate-300 ${time ? 'has-time cursor-pointer hover:bg-blue-50' : 'no-time'}"
              data-trip-id="${trip.tripId}"
              data-stop-id="${stop.id}"
              data-time="${time || ''}"
              title="${time ? 'Click to edit' : 'No service'}">
            ${time ? this.formatTime(time) : '—'}
          </td>
        `;
          })
          .join('');

        return `
        <tr class="${rowClass}">
          <td class="stop-name p-2 border border-slate-300 font-medium">
            <div class="stop-name-text">${this.escapeHtml(stop.name)}</div>
            <div class="stop-id text-xs text-slate-500">${stop.id}</div>
          </td>
          ${timeCells}
        </tr>
      `;
      })
      .join('');

    return `<tbody>${rows}</tbody>`;
  }

  /**
   * Format service days for display
   */
  private formatServiceDays(service: any): string {
    if (!service || typeof service !== 'object') {
      return '';
    }

    const days = [];
    if (service.monday) days.push('Mon');
    if (service.tuesday) days.push('Tue');
    if (service.wednesday) days.push('Wed');
    if (service.thursday) days.push('Thu');
    if (service.friday) days.push('Fri');
    if (service.saturday) days.push('Sat');
    if (service.sunday) days.push('Sun');

    if (days.length === 7) {
      return 'Daily';
    } else if (days.length === 5 && !service.saturday && !service.sunday) {
      return 'Weekdays';
    } else if (days.length === 2 && service.saturday && service.sunday) {
      return 'Weekends';
    } else {
      return days.join(', ');
    }
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

    // Time cell editing
    container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (
        target.classList.contains('time-cell') &&
        target.classList.contains('has-time')
      ) {
        this.editTimeCell(target, data);
      }
    });

    // Trip duplication
    container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('duplicate-trip-btn')) {
        e.stopPropagation();
        const tripId = target.dataset.tripId;
        if (tripId) {
          this.duplicateTrip(tripId, data);
        }
      }
    });

    // Back to objects button
    const backBtn = document.getElementById('back-to-objects');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (this.uiController) {
          this.uiController.showObjectsList();
        }
      });
    }
  }

  /**
   * Handle time cell editing
   */
  private editTimeCell(cell: HTMLElement, data: TimetableData): void {
    const tripId = cell.dataset.tripId;
    const stopId = cell.dataset.stopId;
    const currentTime = cell.dataset.time;

    if (!tripId || !stopId) return;

    // Create inline editor
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTime || '';
    input.className =
      'time-input w-full text-center bg-transparent border-none outline-none';
    input.placeholder = 'HH:MM:SS';

    // Create checkbox for "adjust future times"
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'mt-1 text-xs';
    checkboxContainer.innerHTML = `
      <label class="flex items-center justify-center">
        <input type="checkbox" id="adjust-future" class="mr-1" />
        <span>Adjust future times</span>
      </label>
    `;

    // Replace cell content temporarily
    const originalContent = cell.innerHTML;
    cell.innerHTML = '';
    cell.appendChild(input);
    cell.appendChild(checkboxContainer);

    input.focus();
    input.select();

    const saveEdit = () => {
      const newTime = input.value.trim();
      const adjustFuture =
        (document.getElementById('adjust-future') as HTMLInputElement)
          ?.checked || false;

      this.handleTimeEdit(tripId, stopId, newTime, adjustFuture, data);
      cell.innerHTML = originalContent;

      // Update display
      if (newTime) {
        cell.dataset.time = newTime;
        cell.innerHTML = this.formatTime(newTime);
        cell.classList.add('has-time');
        cell.classList.remove('no-time');
      } else {
        cell.dataset.time = '';
        cell.innerHTML = '—';
        cell.classList.remove('has-time');
        cell.classList.add('no-time');
      }
    };

    const cancelEdit = () => {
      cell.innerHTML = originalContent;
    };

    // Save on Enter, cancel on Escape
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    });

    // Save on blur
    input.addEventListener('blur', saveEdit);
  }

  /**
   * Handle time editing with optional future time adjustment
   */
  private handleTimeEdit(
    tripId: string,
    stopId: string,
    newTime: string,
    adjustFuture: boolean,
    data: TimetableData
  ): void {
    try {
      // Update the time in GTFS data
      this.updateStopTime(tripId, stopId, newTime);

      if (adjustFuture && newTime) {
        // Calculate offset and apply to future stops
        this.adjustFutureStopTimes(tripId, stopId, newTime, data);
      }

      console.log(
        `Updated time for trip ${tripId}, stop ${stopId} to ${newTime}`
      );
    } catch (error) {
      console.error('Error updating time:', error);
      // Could show notification here
    }
  }

  /**
   * Update a specific stop time in the GTFS data
   */
  private updateStopTime(
    tripId: string,
    stopId: string,
    newTime: string
  ): void {
    const stopTimesData = this.gtfsParser.getFileData('stop_times.txt');
    if (!stopTimesData || !Array.isArray(stopTimesData)) {
      throw new Error('Stop times data not found');
    }

    const stopTime = stopTimesData.find(
      (st: any) => st.trip_id === tripId && st.stop_id === stopId
    );

    if (stopTime) {
      stopTime.arrival_time = newTime;
      stopTime.departure_time = newTime; // Keep dwell time simple for now
    } else {
      console.warn(`Stop time not found for trip ${tripId}, stop ${stopId}`);
    }
  }

  /**
   * Adjust all future stop times in a trip by the same offset
   */
  private adjustFutureStopTimes(
    tripId: string,
    stopId: string,
    newTime: string,
    data: TimetableData
  ): void {
    // Get the original time and calculate offset
    const trip = data.trips.find((t) => t.tripId === tripId);
    if (!trip) return;

    const originalTime = trip.stopTimes.get(stopId);
    if (!originalTime) return;

    const offset = this.calculateTimeOffset(originalTime, newTime);
    if (offset === 0) return;

    // Get stop sequence for the edited stop
    const stopTimes = this.relationships.getStopTimesForTrip(tripId);
    const editedStopTime = stopTimes.find((st: any) => st.stopId === stopId);
    if (!editedStopTime) return;

    const editedSequence = editedStopTime.stopSequence;

    // Apply offset to all future stops
    stopTimes.forEach((st: any) => {
      if (st.stopSequence > editedSequence) {
        const currentTime = st.departureTime || st.arrivalTime;
        if (currentTime) {
          const newStopTime = this.addTimeOffset(currentTime, offset);
          this.updateStopTime(tripId, st.stopId, newStopTime);

          // Update the aligned trip data
          trip.stopTimes.set(st.stopId, newStopTime);
        }
      }
    });
  }

  /**
   * Calculate time offset in minutes between two times
   */
  private calculateTimeOffset(oldTime: string, newTime: string): number {
    const oldMinutes = this.timeToMinutes(oldTime);
    const newMinutes = this.timeToMinutes(newTime);
    return newMinutes - oldMinutes;
  }

  /**
   * Convert time string to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const parts = time.split(':');
    if (parts.length < 2) return 0;

    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    return hours * 60 + minutes;
  }

  /**
   * Add offset (in minutes) to a time string
   */
  private addTimeOffset(time: string, offsetMinutes: number): string {
    const totalMinutes = this.timeToMinutes(time) + offsetMinutes;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
  }

  /**
   * Duplicate a trip with a new ID
   */
  private duplicateTrip(tripId: string, data: TimetableData): void {
    try {
      // Generate new trip ID
      const timestamp = Date.now();
      const newTripId = `${tripId}_copy_${timestamp}`;

      // Get original trip data
      const tripsData = this.gtfsParser.getFileData('trips.txt');
      const originalTrip = tripsData.find(
        (trip: any) => trip.trip_id === tripId
      );

      if (!originalTrip) {
        throw new Error(`Original trip ${tripId} not found`);
      }

      // Create new trip record
      const newTrip = { ...originalTrip, trip_id: newTripId };
      tripsData.push(newTrip);

      // Duplicate stop times
      const stopTimesData = this.gtfsParser.getFileData('stop_times.txt');
      const originalStopTimes = stopTimesData.filter(
        (st: any) => st.trip_id === tripId
      );

      originalStopTimes.forEach((stopTime: any) => {
        const newStopTime = { ...stopTime, trip_id: newTripId };
        stopTimesData.push(newStopTime);
      });

      console.log(`Duplicated trip ${tripId} as ${newTripId}`);

      // Refresh the timetable to show the new trip
      this.showScheduleForRoute(data.route.route_id, data.service.serviceId);
    } catch (error) {
      console.error('Error duplicating trip:', error);
      // Could show notification here
    }
  }

  /**
   * Render error state
   */
  private renderError(message: string): void {
    const container = document.getElementById('object-details-view');
    if (!container) return;

    container.innerHTML = `
      <div class="h-full flex items-center justify-center text-slate-500">
        <div class="text-center">
          <div class="text-4xl mb-4">⚠️</div>
          <p class="text-lg">${this.escapeHtml(message)}</p>
          <button id="back-to-objects" class="btn btn-sm btn-primary mt-4">
            ← Back to Objects
          </button>
        </div>
      </div>
    `;

    // Attach back button
    const backBtn = document.getElementById('back-to-objects');
    if (backBtn && this.uiController) {
      backBtn.addEventListener('click', () => {
        this.uiController.showObjectsList();
      });
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
