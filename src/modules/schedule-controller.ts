/**
 * Schedule Controller Module
 * Handles timetable view for routes showing aligned trips in a standard train schedule format
 * Accessed via Objects tab → Route → Service ID
 */

import {
  Calendar,
  CalendarDates,
  StopTimes,
  Stops,
  GTFSTableMap,
} from '../types/gtfs-entities.js';
import { notifications } from './notification-system';
import { TimeFormatter } from '../utils/time-formatter.js';
import { TimetableDataProcessor } from './timetable-data-processor.js';
import { TimetableRenderer } from './timetable-renderer.js';
import { TimetableCellRenderer } from './timetable-cell-renderer.js';
import { TimetableDatabase } from './timetable-database.js';

// Enhanced GTFS interfaces using standard GTFS property names

interface EnhancedTrip {
  // Shorthand properties
  id: string;
  headsign?: string;
  shortName?: string;
  // Original GTFS properties
  trip_id: string;
  route_id: string;
  service_id: string;
  trip_headsign?: string;
  trip_short_name?: string;
  direction_id?: string;
  block_id?: string;
  shape_id?: string;
  wheelchair_accessible?: string;
}

interface GTFSParserInterface {
  getFileDataSync<T extends keyof GTFSTableMap>(filename: T): GTFSTableMap[T][];
  gtfsDatabase: {
    queryRows<T extends keyof GTFSTableMap>(
      tableName: T,
      filter?: { [key: string]: string | number | boolean }
    ): Promise<GTFSTableMap[T][]>;
    updateRow<T extends keyof GTFSTableMap>(
      tableName: T,
      key: string,
      data: Partial<GTFSTableMap[T]>
    ): Promise<void>;
  };
}

interface GTFSRelationships {
  getCalendarForService(service_id: string): Calendar | CalendarDates | null;
  getTripsForRoute(route_id: string): EnhancedTrip[];
  getStopTimesForTrip(trip_id: string): StopTimes[];
  getStopById(stop_id: string): Stops | null;
  getStopByIdAsync(stop_id: string): Promise<Stops | null>;
}

/**
 * Schedule Controller - Main orchestrator for timetable functionality
 *
 * Coordinates between specialized modules to provide schedule editing capabilities.
 * This class is responsible for:
 * - Time editing operations (linked/unlinked times)
 * - Schedule rendering coordination
 * - Database operations through TimetableDatabase
 * - Input state management and validation
 *
 * Follows the Enhanced GTFS Object pattern and FAIL HARD error handling policy.
 */
export class ScheduleController {
  private relationships: GTFSRelationships;
  private gtfsParser: GTFSParserInterface;
  private dataProcessor: TimetableDataProcessor;
  private renderer: TimetableRenderer;
  private cellRenderer: TimetableCellRenderer;
  private database: TimetableDatabase;

  // Current timetable state for refresh functionality
  private currentRouteId?: string;
  private currentServiceId?: string;
  private currentDirectionId?: string;

  /**
   * Initialize ScheduleController with required dependencies
   *
   * @param gtfsRelationships - GTFS relationships manager for data queries
   * @param gtfsParser - GTFS parser with database access
   */
  constructor(
    gtfsRelationships: GTFSRelationships,
    gtfsParser: GTFSParserInterface
  ) {
    this.relationships = gtfsRelationships;
    this.gtfsParser = gtfsParser;
    this.dataProcessor = new TimetableDataProcessor(
      gtfsRelationships,
      gtfsParser
    );
    this.renderer = new TimetableRenderer();
    this.cellRenderer = new TimetableCellRenderer();
    this.database = new TimetableDatabase(gtfsParser);
  }

  // ===== PUBLIC EDITING METHODS =====

  /**
   * Update time for a specific stop in a trip
   *
   * Updates both arrival and departure times to the same value.
   * Follows FAIL HARD policy - throws on validation errors.
   *
   * @param trip_id - GTFS trip identifier
   * @param stop_id - GTFS stop identifier
   * @param newTime - New time value in any valid time format (HH:MM, HH:MM:SS)
   * @throws {Error} When validation fails or database update fails
   */
  public async updateTime(
    trip_id: string,
    stop_id: string,
    newTime: string
  ): Promise<void> {
    try {
      // Cast time to HH:MM:SS format
      const castedTime = TimeFormatter.castTimeToHHMMSS(newTime);

      // Update database directly - validation handled by TimetableDatabase
      await this.database.updateStopTimeInDatabase(
        trip_id,
        stop_id,
        castedTime
      );

      console.log(
        `Updated time for ${trip_id}/${stop_id} from ${newTime} to ${castedTime}`
      );
    } catch (error) {
      console.error('Failed to update time:', error);
      this.showTimeError(trip_id, stop_id, 'Failed to save time change');
    }
  }

  /**
   * Update linked time (both arrival and departure set to same value)
   *
   * Sets both arrival_time and departure_time to the same value.
   * Handles empty input by clearing both times.
   * Updates the UI input immediately after successful database update.
   * Renumbers stop sequences based on arrival times after update.
   *
   * @param trip_id - GTFS trip identifier
   * @param stop_id - GTFS stop identifier
   * @param newTime - New time value or empty string to clear
   * @throws {Error} When time casting or database update fails
   */
  public async updateLinkedTime(
    trip_id: string,
    stop_id: string,
    newTime: string
  ): Promise<void> {
    try {
      // Handle empty input (clear both times)
      if (!newTime.trim()) {
        await this.database.updateLinkedTimes(trip_id, stop_id, null);
        console.log(`Cleared both times for ${trip_id}/${stop_id}`);

        // Update input value immediately
        const input = document.querySelector(
          `input[data-trip-id="${trip_id}"][data-stop-id="${stop_id}"][data-time-type="linked"]`
        ) as HTMLInputElement;
        if (input) {
          input.value = '';
        }

        // Rebuild stop_times from table and refresh timetable
        await this.database.rebuildStopTimesFromTable(trip_id);
        await this.refreshCurrentTimetable();
        return;
      }

      // Cast time to HH:MM:SS format
      const castedTime = TimeFormatter.castTimeToHHMMSS(newTime);

      // Update both arrival and departure times to the same value
      await this.database.updateLinkedTimes(trip_id, stop_id, castedTime);

      console.log(
        `Updated linked times for trip ${trip_id}, stop ${stop_id} to ${castedTime}`
      );

      // Clear pending stop if this was the first time entered
      this.clearPendingStopIfMatches(stop_id);

      // Update input value immediately
      const input = document.querySelector(
        `input[data-trip-id="${trip_id}"][data-stop-id="${stop_id}"][data-time-type="linked"]`
      ) as HTMLInputElement;
      if (input) {
        input.value = TimeFormatter.formatTimeWithSeconds(castedTime);
      }

      // Rebuild stop_times from table and refresh timetable
      await this.database.rebuildStopTimesFromTable(trip_id);
      await this.refreshCurrentTimetable();
    } catch (error) {
      console.error('Failed to update linked time:', error);
      this.showTimeError(trip_id, stop_id, 'Failed to save time change');
    }
  }

  /**
   * Update arrival or departure time for a specific stop in a trip
   *
   * Updates either arrival_time or departure_time independently.
   * Validates arrival <= departure constraint before saving.
   * Handles empty input by clearing the specified time field.
   * Renumbers stop sequences based on arrival times after update.
   *
   * @param trip_id - GTFS trip identifier
   * @param stop_id - GTFS stop identifier
   * @param timeType - Which time field to update ('arrival' or 'departure')
   * @param newTime - New time value or empty string to clear
   * @throws {Error} When validation fails or database update fails
   */
  public async updateArrivalDepartureTime(
    trip_id: string,
    stop_id: string,
    timeType: 'arrival' | 'departure',
    newTime: string
  ): Promise<void> {
    try {
      // Handle empty input (skip/clear time)
      if (!newTime.trim()) {
        await this.database.updateStopTimeInDatabase(
          trip_id,
          stop_id,
          null,
          timeType
        );
        console.log(`Cleared ${timeType} time for ${trip_id}/${stop_id}`);

        // Rebuild stop_times from table and refresh timetable
        await this.database.rebuildStopTimesFromTable(trip_id);
        await this.refreshCurrentTimetable();
        return;
      }

      // Cast time to HH:MM:SS format
      const castedTime = TimeFormatter.castTimeToHHMMSS(newTime);

      // Validate arrival <= departure constraint
      const validation = await this.database.validateArrivalDepartureConstraint(
        trip_id,
        stop_id,
        timeType,
        castedTime
      );

      if (!validation.isValid) {
        this.showTimeError(
          trip_id,
          stop_id,
          validation.errorMessage || 'Invalid time'
        );
        return;
      }

      // Update database directly
      await this.database.updateStopTimeInDatabase(
        trip_id,
        stop_id,
        castedTime,
        timeType
      );

      console.log(
        `Updated ${timeType} time for ${trip_id}/${stop_id} from ${newTime} to ${castedTime}`
      );

      // Clear pending stop if this was the first time entered
      this.clearPendingStopIfMatches(stop_id);

      // Update input value immediately
      const input = document.querySelector(
        `input[data-trip-id="${trip_id}"][data-stop-id="${stop_id}"][data-time-type="${timeType}"]`
      ) as HTMLInputElement;
      if (input) {
        input.value = castedTime
          ? TimeFormatter.formatTimeWithSeconds(castedTime)
          : '';
      }

      // Rebuild stop_times from table and refresh timetable
      await this.database.rebuildStopTimesFromTable(trip_id);
      await this.refreshCurrentTimetable();
    } catch (error) {
      console.error('Failed to update arrival/departure time:', error);
      this.showTimeError(trip_id, stop_id, 'Failed to save time change');
    }
  }

  /**
   * Database state detection helper
   *
   * Determines if arrival and departure times are in a "linked" state
   * (both non-null and identical values).
   *
   * @param arrival_time - Current arrival time value
   * @param departure_time - Current departure time value
   * @returns True if times are linked (identical and non-null)
   */
  private isLinkedState(
    arrival_time: string | null,
    departure_time: string | null
  ): boolean {
    return (
      arrival_time === departure_time &&
      arrival_time !== null &&
      departure_time !== null
    );
  }

  /**
   * Swap to linked input (DOM manipulation) - delegates to cellRenderer
   *
   * Converts separate arrival/departure inputs to a single linked input.
   * Uses primary time (arrival preferred, fallback to departure) as initial value.
   * Updates database to set both times to the same value.
   *
   * @param trip_id - GTFS trip identifier
   * @param stop_id - GTFS stop identifier
   * @throws {Error} When DOM manipulation or database update fails
   */
  private async swapToLinkedInput(
    trip_id: string,
    stop_id: string
  ): Promise<void> {
    const inputContainer = document
      .querySelector(
        `input[data-trip-id="${trip_id}"][data-stop-id="${stop_id}"]`
      )
      ?.closest('.stacked-time-container');
    if (!inputContainer) {
      console.error('Input container not found for swap to linked');
      return;
    }

    // Get current times from database
    const stopTime = await this.database.getStopTime(trip_id, stop_id);
    if (!stopTime) {
      console.error(`No stop_time found for trip ${trip_id}, stop ${stop_id}`);
      return;
    }

    const arrival_time = stopTime.arrival_time;
    const departure_time = stopTime.departure_time;

    // Determine which time to use as primary (arrival preferred, fallback to departure)
    const primaryTime = arrival_time || departure_time;
    const timeValue = primaryTime
      ? TimeFormatter.formatTimeWithSeconds(primaryTime)
      : '';

    // Create linked input using cellRenderer and replace content
    const linkedInput = this.cellRenderer.createLinkedInput(
      trip_id,
      stop_id,
      timeValue
    );

    inputContainer.innerHTML = '';
    inputContainer.appendChild(linkedInput);

    // Update database: set both times to the primary time
    await this.database.updateLinkedTimes(trip_id, stop_id, primaryTime);

    console.log(
      `Linked times for ${trip_id}/${stop_id}: set both times to ${primaryTime}`
    );
  }

  /**
   * Swap to unlinked inputs (DOM manipulation) - delegates to cellRenderer
   *
   * Converts linked input to separate arrival/departure inputs.
   * Preserves current time values in the new input fields.
   * No database changes - only UI state change.
   *
   * @param trip_id - GTFS trip identifier
   * @param stop_id - GTFS stop identifier
   * @throws {Error} When DOM manipulation fails
   */
  private async swapToUnlinkedInputs(
    trip_id: string,
    stop_id: string
  ): Promise<void> {
    const inputContainer = document
      .querySelector(
        `input[data-trip-id="${trip_id}"][data-stop-id="${stop_id}"]`
      )
      ?.closest('.stacked-time-container');
    if (!inputContainer) {
      console.error('Input container not found for swap to unlinked');
      return;
    }

    // Get current times from database
    const stopTime = await this.database.getStopTime(trip_id, stop_id);
    if (!stopTime) {
      console.error(`No stop_time found for trip ${trip_id}, stop ${stop_id}`);
      return;
    }

    const arrival_time = stopTime.arrival_time
      ? TimeFormatter.formatTimeWithSeconds(stopTime.arrival_time)
      : '';
    const departure_time = stopTime.departure_time
      ? TimeFormatter.formatTimeWithSeconds(stopTime.departure_time)
      : '';

    // Create unlinked inputs using cellRenderer and replace content
    const unlinkedInputs = this.cellRenderer.createUnlinkedInputs(
      trip_id,
      stop_id,
      arrival_time,
      departure_time
    );

    inputContainer.innerHTML = '';
    inputContainer.appendChild(unlinkedInputs);

    // No database changes for unlinking
    console.log(
      `Unlinked times for ${trip_id}/${stop_id}: UI changed to separate inputs, no database changes`
    );
  }

  /**
   * Toggle link between arrival and departure times
   *
   * Switches between linked (single input) and unlinked (separate inputs) modes.
   * Determines current state from DOM and toggles to opposite state.
   * Delegates actual UI manipulation to swap methods.
   *
   * @param trip_id - GTFS trip identifier
   * @param stop_id - GTFS stop identifier
   * @throws {Error} When state detection or UI manipulation fails
   */
  public async toggleTimesLink(
    trip_id: string,
    stop_id: string
  ): Promise<void> {
    try {
      // Determine current UI state by checking what's currently displayed
      const linkedInput = document.querySelector(
        `input[data-trip-id="${trip_id}"][data-stop-id="${stop_id}"][data-time-type="linked"]`
      );
      const isCurrentlyLinked = !!linkedInput;

      console.log(
        `Toggle for ${trip_id}/${stop_id}: currently ${isCurrentlyLinked ? 'linked' : 'unlinked'}`
      );

      // Toggle to opposite state
      if (isCurrentlyLinked) {
        await this.swapToUnlinkedInputs(trip_id, stop_id);
      } else {
        await this.swapToLinkedInput(trip_id, stop_id);
      }
    } catch (error) {
      console.error('Failed to toggle times link:', error);
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Show time validation error to user
   *
   * Displays error notification and logs error details to console.
   * Used for validation failures and database operation errors.
   *
   * @param trip_id - GTFS trip identifier for context
   * @param stop_id - GTFS stop identifier for context
   * @param message - Error message to display to user
   */
  private showTimeError(
    trip_id: string,
    stop_id: string,
    message: string
  ): void {
    console.error(`Time error for ${trip_id}/${stop_id}: ${message}`);
    notifications.showError(`Invalid time format: ${message}`, {
      duration: 5000,
    });
  }

  /**
   * Render schedule HTML for a specific route and service
   *
   * Main public API method for generating timetable views.
   * Handles direction selection, data processing, and HTML generation.
   * Returns error HTML if data processing fails.
   * Stores current state for refresh functionality.
   *
   * @param route_id - GTFS route identifier
   * @param service_id - GTFS service identifier (calendar or calendar_dates)
   * @param direction_id - Optional GTFS direction identifier for filtering
   * @returns Promise resolving to HTML string for the timetable
   */
  async renderSchedule(
    route_id: string,
    service_id: string,
    direction_id?: string
  ): Promise<string> {
    try {
      console.log('DEBUG: renderSchedule called with:', {
        route_id,
        service_id,
        direction_id,
      });

      // Store current state for refresh functionality
      this.currentRouteId = route_id;
      this.currentServiceId = service_id;
      this.currentDirectionId = direction_id;

      // Get all available directions for this route and service
      const availableDirections = this.dataProcessor.getAvailableDirections(
        route_id,
        service_id
      );

      // Use provided direction_id or first available direction if any exist
      const selectedDirection =
        direction_id ||
        (availableDirections.length > 0
          ? availableDirections[0].id
          : undefined);

      const timetableData = await this.dataProcessor.generateTimetableData(
        route_id,
        service_id,
        selectedDirection
      );

      // Add direction information to timetable data
      timetableData.availableDirections = availableDirections;
      timetableData.selectedDirectionId = selectedDirection;

      // Add pending stop to the end of the stops array (UI only, not in database)
      if (this.pendingStop) {
        timetableData.stops.push({
          stop_id: this.pendingStop.stop_id,
          stop_name: this.pendingStop.stop_name,
        } as Stops);
      }

      console.log('DEBUG: Timetable data generated:', {
        tripsCount: timetableData.trips.length,
        stopsCount: timetableData.stops.length,
        hasPendingStop: !!this.pendingStop,
      });

      return this.renderer.renderTimetableHTML(
        timetableData,
        this.pendingStop?.stop_id
      );
    } catch (error) {
      console.error('Error rendering schedule:', error);
      return this.renderer.renderErrorHTML('Failed to generate schedule view');
    }
  }

  /**
   * Refresh the current timetable view
   *
   * Re-renders the timetable using the stored route/service/direction state.
   * Used after edits to reflect updated stop sequences and times.
   * No-op if no timetable is currently displayed.
   */
  async refreshCurrentTimetable(): Promise<void> {
    if (!this.currentRouteId || !this.currentServiceId) {
      console.log('No current timetable to refresh');
      return;
    }

    console.log('Refreshing timetable:', {
      route_id: this.currentRouteId,
      service_id: this.currentServiceId,
      direction_id: this.currentDirectionId,
    });

    const html = await this.renderSchedule(
      this.currentRouteId,
      this.currentServiceId,
      this.currentDirectionId
    );

    // Update the timetable container
    const container = document.getElementById('schedule-view');
    if (container) {
      container.innerHTML = html;
    }
  }

  /**
   * Open the add stop dropdown and populate with available stops
   *
   * Fetches all stops that are not currently in the timetable and populates
   * the dropdown menu with them. Used when user clicks the + button.
   *
   * @param route_id - GTFS route identifier
   * @param service_id - GTFS service identifier
   */
  public async openAddStopDropdown(
    route_id: string,
    service_id: string
  ): Promise<void> {
    console.log('=== openAddStopDropdown called ===');
    console.log('route_id:', route_id);
    console.log('service_id:', service_id);
    console.log('currentDirectionId:', this.currentDirectionId);

    // Don't allow adding another stop if there's already a pending stop
    // (button should be disabled, but check anyway as fallback)
    if (this.pendingStop) {
      return;
    }

    // Get all stops in the current timetable
    const timetableData = await this.dataProcessor.generateTimetableData(
      route_id,
      service_id,
      this.currentDirectionId
    );
    const currentStopIds = new Set(
      timetableData.stops.map((stop) => stop.stop_id)
    );
    console.log(
      'Current stops in timetable:',
      currentStopIds.size,
      Array.from(currentStopIds)
    );

    // Get all stops from the database
    const allStops = await this.gtfsParser.gtfsDatabase.queryRows('stops', {});
    console.log('Total stops in database:', allStops.length);

    // Filter out stops already in the timetable
    const availableStops = allStops.filter(
      (stop) => !currentStopIds.has(stop.stop_id)
    );
    console.log('Available stops to add:', availableStops.length);

    // Store for filtering
    this.availableStops = availableStops;

    // Populate the dropdown
    this.populateAddStopList(availableStops);
  }

  /**
   * Populate the add stop dropdown list
   *
   * Renders the list of available stops in the dropdown select.
   *
   * @param stops - Array of stops to display
   */
  private populateAddStopList(stops: Stops[]): void {
    console.log('=== populateAddStopList called ===');
    const selectElement = document.getElementById(
      'add-stop-select'
    ) as HTMLSelectElement;
    console.log('Select element found:', !!selectElement);
    if (!selectElement) {
      console.error('add-stop-select element not found in DOM');
      return;
    }

    // Reset select to default option
    selectElement.innerHTML = '<option value="">Choose a stop...</option>';

    if (stops.length === 0) {
      console.log('No available stops to add');
      selectElement.innerHTML +=
        '<option value="" disabled>All stops are already in this timetable</option>';
      return;
    }

    console.log('Adding', stops.length, 'stops to dropdown');
    console.log(
      'First 3 stops:',
      stops.slice(0, 3).map((s) => ({ id: s.stop_id, name: s.stop_name }))
    );

    // Add stops as options
    const options = stops
      .map(
        (stop) => `
        <option value="${stop.stop_id}">
          ${this.escapeHtml(stop.stop_name || stop.stop_id)} (${stop.stop_id})
        </option>
      `
      )
      .join('');

    selectElement.innerHTML += options;
  }

  /**
   * Add a stop to the timetable UI (not saved to database until time is entered)
   *
   * Adds a new row to the timetable for the selected stop. The stop is only
   * saved in UI state until the user enters at least one time. When a time is
   * entered, the stop_time will be created in the database for that specific trip.
   *
   * Only one pending stop is allowed at a time - user must add a time before
   * adding another stop.
   *
   * @param stop_id - GTFS stop identifier to add
   */
  public async addStopToAllTrips(stop_id: string): Promise<void> {
    try {
      if (!this.currentRouteId || !this.currentServiceId) {
        console.error('No current timetable to add stop to');
        return;
      }

      // Get stop name for display
      const stops = await this.gtfsParser.gtfsDatabase.queryRows('stops', {
        stop_id,
      });

      if (stops.length === 0) {
        notifications.showError('Stop not found');
        return;
      }

      const stop = stops[0];

      // Set pending stop (UI state only, not saved to database)
      this.pendingStop = {
        stop_id: stop.stop_id,
        stop_name: stop.stop_name || stop.stop_id,
      };

      console.log(
        `Added pending stop ${stop_id} to UI (not saved to database)`
      );

      // Reset the select element
      const selectElement = document.getElementById(
        'add-stop-select'
      ) as HTMLSelectElement;
      if (selectElement) {
        selectElement.value = '';
      }

      // Close the dropdown by blurring the active element
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      // Refresh the timetable to show the new pending stop row
      await this.refreshCurrentTimetable();

      notifications.showSuccess(
        `Stop added. Enter a time for at least one trip to save.`
      );
    } catch (error) {
      console.error('Failed to add stop to timetable:', error);
      notifications.showError('Failed to add stop to timetable');
    }
  }

  /**
   * Escape HTML characters in text
   *
   * Prevents XSS by escaping user-provided text content.
   *
   * @param text - Raw text that may contain HTML characters
   * @returns HTML-safe escaped text
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Store available stops for filtering
  private availableStops?: Stops[];

  // Track pending stop that hasn't been saved to database yet
  private pendingStop?: {
    stop_id: string;
    stop_name: string;
  };

  /**
   * Clear pending stop after first time is entered
   * Called automatically when a time is successfully saved
   */
  private clearPendingStopIfMatches(stop_id: string): void {
    if (this.pendingStop && this.pendingStop.stop_id === stop_id) {
      console.log(`Clearing pending stop ${stop_id} - time has been saved`);
      this.pendingStop = undefined;
    }
  }

  // Note: Old getSortedStops method removed - now handled directly by enhanced SCS
  // All rendering methods moved to TimetableRenderer and TimetableCellRenderer modules
}
