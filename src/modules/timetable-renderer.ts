/**
 * Timetable Renderer Module
 * Handles HTML generation for timetable views and schedule headers
 */

import { Routes, Calendar, CalendarDates } from '../types/gtfs-entities.js';
import { TimetableData, DirectionInfo } from './timetable-data-processor.js';
import { TimetableCellRenderer } from './timetable-cell-renderer.js';

/**
 * Timetable Renderer - HTML generation for schedule views
 *
 * This class is responsible for:
 * - Generating complete timetable HTML structure
 * - Rendering schedule headers with route/service information
 * - Creating direction tabs for multi-direction routes
 * - Coordinating with TimetableCellRenderer for time cells
 * - Handling error states and empty data scenarios
 *
 * Uses DaisyUI classes for consistent styling.
 */
export class TimetableRenderer {
  private cellRenderer: TimetableCellRenderer;

  /**
   * Initialize TimetableRenderer with cell renderer dependency
   */
  constructor() {
    this.cellRenderer = new TimetableCellRenderer();
  }
  /**
   * Render complete timetable HTML structure
   *
   * Main entry point for generating full timetable views.
   * Combines header, direction tabs, and content into a cohesive layout.
   *
   * @param data - Complete timetable data including route, service, stops, and trips
   * @param pendingStopId - Optional ID of pending stop being added (for styling)
   * @returns HTML string for the complete timetable view
   */
  public renderTimetableHTML(
    data: TimetableData,
    pendingStopId?: string
  ): string {
    return `
      <div id="schedule-view" class="h-full flex flex-col">
        ${this.renderScheduleHeader(data.route, data.service)}
        ${this.renderDirectionTabs(data)}
        ${this.renderTimetableContent(data, pendingStopId)}
      </div>
    `;
  }

  /**
   * Render schedule header with route and service information
   *
   * Creates the top section with route name, service ID, and service properties.
   * Displays route name (short + long name if available) and service period.
   *
   * @param route - GTFS route entity with naming information
   * @param service - Calendar or CalendarDates entity with service details
   * @returns HTML string for the schedule header section
   */
  public renderScheduleHeader(
    route: Routes,
    service: Calendar | CalendarDates
  ): string {
    const routeName = route.route_short_name
      ? `${route.route_short_name}${route.route_long_name ? ' - ' + route.route_long_name : ''}`
      : route.route_long_name || route.route_id;

    const serviceName = service.service_id;

    return `
      <div class="border-b border-base-300">
        <div class="p-4">
          <h2 class="text-lg font-semibold">
            ${routeName} - ${serviceName}
          </h2>
          <p class="text-sm opacity-70">
            Timetable View
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Render direction tabs navigation
   *
   * Creates tab navigation for multi-direction routes.
   * Hides tabs if only one or no directions are available.
   * Highlights the currently selected direction.
   *
   * @param data - Timetable data containing available directions
   * @returns HTML string for direction tabs or empty string if not needed
   */
  public renderDirectionTabs(data: TimetableData): string {
    const directions = data.availableDirections || [];

    // Don't show tabs if there's only one or no directions
    if (directions.length <= 1) {
      return '';
    }

    const selectedDirectionId =
      data.selectedDirectionId ||
      (directions.length > 0 ? directions[0].id : null);

    const tabsHTML = directions
      .map((direction: DirectionInfo) => {
        const isActive = direction.id === selectedDirectionId;
        const activeClass = isActive ? 'tab-active' : '';

        return `
          <a class="tab ${activeClass}"
             onclick="gtfsEditor.navigateToTimetable('${data.route.route_id}', '${data.service.service_id}', '${direction.id}')">
            ${this.getDirectionDisplayName(direction)}
          </a>
        `;
      })
      .join('');

    return `
      <div class="border-b border-base-300">
        <div class="tabs tabs-bordered p-2">
          ${tabsHTML}
        </div>
      </div>
    `;
  }

  /**
   * Render main timetable content
   *
   * Generates the main timetable table with stops and trip columns.
   * Handles empty states when no direction is selected.
   * Creates responsive table with sticky headers and scrolling.
   *
   * @param data - Complete timetable data with trips and stops
   * @param pendingStopId - Optional ID of pending stop being added (for styling)
   * @returns HTML string for the main timetable content area
   */
  public renderTimetableContent(
    data: TimetableData,
    pendingStopId?: string
  ): string {
    if (!data.selectedDirectionId) {
      return `
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center text-base-content/50">
            <p>No direction selected.</p>
            <p class="text-sm mt-2">Select a direction from the tabs above.</p>
          </div>
        </div>
      `;
    }

    console.log('DEBUG: renderTimetableContent called with:', {
      trips: data.trips?.length || 0,
      selectedDirectionId: data.selectedDirectionId,
    });

    return `
      <div class="flex-1 overflow-auto">
        <table class="table table-xs table-pin-rows w-full">
          ${this.renderTimetableHeader(data, !!pendingStopId)}
          ${this.renderTimetableBody(data, pendingStopId)}
        </table>
      </div>
    `;
  }

  /**
   * Render timetable header with trip columns
   *
   * Creates table header row with stop column and trip columns.
   * Uses trip headsign, short name, or truncated trip ID for display.
   * Makes header sticky for better scrolling experience.
   * Includes "Add Stop" button in the stop column header.
   *
   * @param data - Complete timetable data including trips, route, and service
   * @param hasPendingStop - Whether there's a pending stop being added
   * @returns HTML string for the table header
   */
  public renderTimetableHeader(
    data: TimetableData,
    hasPendingStop: boolean
  ): string {
    const trips = data.trips;
    const tripHeaders = trips
      .map((trip) => {
        return `
          <th class="trip-header text-center min-w-[80px] p-2 text-xs"
              title="${trip.trip_headsign || trip.trip_short_name || trip.trip_id}">
            ${trip.trip_id}
          </th>
        `;
      })
      .join('');

    const disabledAttr = hasPendingStop ? 'disabled' : '';
    const disabledTitle = hasPendingStop
      ? 'Add a time for the pending stop first'
      : 'Add stop to timetable';

    return `
      <thead>
        <tr>
          <th class="stop-header sticky left-0 bg-base-100 min-w-[200px] p-2 text-left">
            <div class="flex items-center gap-2">
              <span>Stop</span>
              <div class="dropdown" id="add-stop-dropdown-container">
                <div tabindex="0" role="button" class="btn btn-xs btn-circle btn-ghost"
                        title="${disabledTitle}"
                        ${disabledAttr}
                        onclick="console.log('Button clicked'); gtfsEditor.scheduleController.openAddStopDropdown('${data.route.route_id}', '${data.service.service_id}')"
                        onfocus="console.log('Button focused'); gtfsEditor.scheduleController.openAddStopDropdown('${data.route.route_id}', '${data.service.service_id}')">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div tabindex="0" class="dropdown-content bg-base-100 rounded-box z-[1000] w-64 p-2 shadow-lg border border-base-300 mt-1" id="add-stop-dropdown">
                  <fieldset class="fieldset">
                    <label class="label text-xs" for="add-stop-select">Select a stop to add</label>
                    <select class="select select-sm w-full" id="add-stop-select"
                            onchange="if(this.value) gtfsEditor.scheduleController.addStopToAllTrips(this.value)">
                      <option value="">Choose a stop...</option>
                      <!-- Options will be populated here -->
                    </select>
                  </fieldset>
                </div>
              </div>
            </div>
          </th>
          ${tripHeaders}
        </tr>
      </thead>
    `;
  }

  /**
   * Render timetable body with stops and trip time cells
   *
   * Creates table body with one row per stop and time cells for each trip.
   * Delegates cell rendering to TimetableCellRenderer for consistency.
   * Uses stop position as the key for time lookups.
   *
   * @param data - Complete timetable data with stops, trips, and time mappings
   * @param pendingStopId - Optional ID of pending stop being added (for styling)
   * @returns HTML string for the table body
   */
  public renderTimetableBody(
    data: TimetableData,
    pendingStopId?: string
  ): string {
    if (!data.stops || !data.trips) {
      return '<tbody></tbody>';
    }

    console.log('\n=== RENDERING TIMETABLE BODY ===');
    console.log(`Number of stops to render: ${data.stops.length}`);
    console.log(`Number of trips to render: ${data.trips.length}`);
    console.log('Stop IDs in rendering order:');
    data.stops.forEach((stop, idx) => {
      console.log(`  [${idx}] ${stop.stop_id} - ${stop.stop_name}`);
    });

    const rows = data.stops
      .map((stop, stopIndex) => {
        console.log(
          `\n--- Rendering row for stop [${stopIndex}]: ${stop.stop_id} ---`
        );
        const isPendingStop = pendingStopId === stop.stop_id;
        const rowClass = isPendingStop
          ? 'opacity-60 border-dashed border-2 border-warning'
          : '';
        const timeCells = data.trips
          .map((trip, tripIndex) => {
            // Use stop_id as the key for all time lookups
            // This is much clearer than numeric indices and eliminates confusion with stop_sequence
            const stop_id = stop.stop_id;

            console.log(
              `  Trip ${tripIndex} (${trip.trip_id}): Looking up stop_id='${stop_id}'`
            );
            const editableStopTime = trip.editableStopTimes?.get(stop_id);
            const arrival_time = trip.arrival_times?.get(stop_id) || undefined;
            const departure_time =
              trip.departure_times?.get(stop_id) || undefined;

            console.log(`    arrival_time: ${arrival_time || 'NONE'}`);
            console.log(`    departure_time: ${departure_time || 'NONE'}`);
            console.log(
              `    editableStopTime: ${editableStopTime ? 'YES' : 'NO'}`
            );

            if (!arrival_time && !departure_time) {
              console.log(
                `    ⚠️  NO TIMES FOUND for stop_id='${stop_id}' in trip ${trip.trip_id}`
              );
              console.log(
                `    Available stop_ids in arrival_times:`,
                Array.from(trip.arrival_times?.keys() || [])
              );
              console.log(
                `    Available stop_ids in departure_times:`,
                Array.from(trip.departure_times?.keys() || [])
              );
            }

            return this.cellRenderer.renderStackedArrivalDepartureCell(
              trip.trip_id,
              stop_id,
              arrival_time || null,
              departure_time || null,
              editableStopTime
            );
          })
          .join('');

        return `
        <tr class="${rowClass}">
          <td class="stop-name p-2 font-medium sticky left-0 bg-base-100 border-r border-base-300">
            <div class="stop-name-text">${this.escapeHtml(stop.stop_name || stop.stop_id)}</div>
            <div class="stop-id text-xs opacity-70">${stop.stop_id}</div>
          </td>
          ${timeCells}
        </tr>
      `;
      })
      .join('');

    return `<tbody>${rows}</tbody>`;
  }

  /**
   * Get display name for direction
   *
   * Determines the best display name for a direction tab.
   * Uses headsign if available, falls back to formatted direction ID.
   *
   * @param direction - Direction info with ID and optional headsign
   * @returns Human-readable direction name for display
   */
  private getDirectionDisplayName(direction: DirectionInfo): string {
    // Use the name property from DirectionInfo, which comes from getDirectionName()
    return direction.name;
  }

  /**
   * Render error HTML
   *
   * Creates consistent error display for failed operations.
   * Centers error message with appropriate styling.
   *
   * @param message - Error message to display to user
   * @returns HTML string for error state
   */
  public renderErrorHTML(message: string): string {
    return `
      <div class="flex-1 flex items-center justify-center">
        <div class="text-center text-error">
          <p class="font-medium">Error</p>
          <p class="text-sm mt-2">${message}</p>
        </div>
      </div>
    `;
  }

  /**
   * Escape HTML characters in text
   *
   * Prevents XSS by escaping user-provided text content.
   * Uses DOM API for safe HTML escaping.
   *
   * @param text - Raw text that may contain HTML characters
   * @returns HTML-safe escaped text
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
