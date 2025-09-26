/**
 * Schedule Controller Module
 * Handles timetable view for routes showing aligned trips in a standard train schedule format
 * Accessed via Objects tab → Route → Service ID
 */

import {
  shortestCommonSupersequenceWithAlignments,
  SCSResultHelper,
} from './scs';
import { z } from 'zod';
import {
  Routes,
  Stops,
  Calendar,
  CalendarDates,
  Trips,
} from '../types/gtfs.js';

export interface EditableStopTime {
  stopId: string;
  time: string | null;
  isModified: boolean;
  isSkipped: boolean;
  originalTime?: string;
}

export interface AlignedTrip {
  tripId: string;
  headsign: string;
  stopTimes: Map<number, string>; // position -> time, null for gaps
  isModified: boolean;
  isNew: boolean;
  editableStopTimes?: Map<number, EditableStopTime>;
}

export interface EditableService {
  serviceId: string;
  startDate?: string;
  endDate?: string;
  monday?: boolean;
  tuesday?: boolean;
  wednesday?: boolean;
  thursday?: boolean;
  friday?: boolean;
  saturday?: boolean;
  sunday?: boolean;
  isModified: boolean;
  originalData?: Calendar | CalendarDates;
}

export interface TimetableData {
  route: Routes;
  service: Calendar | CalendarDates;
  stops: Stops[];
  trips: AlignedTrip[];
  directionId?: string;
  directionName?: string;
  isEditable?: boolean;
  editableService?: EditableService;
}

export interface TimetableEditState {
  hasUnsavedChanges: boolean;
  modifiedTrips: Set<string>;
  modifiedStops: Map<string, Set<string>>; // tripId -> Set<stopId>
  serviceModified: boolean;
  undoStack: TimetableOperation[];
  redoStack: TimetableOperation[];
}

export interface TimetableOperation {
  type:
    | 'time_edit'
    | 'trip_add'
    | 'trip_delete'
    | 'trip_duplicate'
    | 'stop_skip'
    | 'stop_insert'
    | 'service_edit';
  tripId?: string;
  stopId?: string;
  oldValue?: string | boolean;
  newValue?: string | boolean;
  timestamp: number;
  data?: unknown;
}

// Validation schemas for editable fields
export const TimeValidationSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$|^(2[4-9]|[3-9]\d):[0-5]\d:[0-5]\d$/,
    'Invalid time format. Use HH:MM:SS (24-hour format, may exceed 24:00:00)'
  )
  .or(z.literal(''));

export const ServiceDateSchema = z
  .string()
  .regex(/^\d{8}$/, 'Date must be in YYYYMMDD format')
  .refine((date) => {
    const year = parseInt(date.substring(0, 4));
    const month = parseInt(date.substring(4, 6));
    const day = parseInt(date.substring(6, 8));
    return (
      year >= 1900 &&
      year <= 3000 &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    );
  }, 'Invalid date');

export const ServicePropertiesSchema = z.object({
  serviceId: z.string().min(1, 'Service ID is required'),
  startDate: ServiceDateSchema.optional(),
  endDate: ServiceDateSchema.optional(),
  monday: z.boolean().optional(),
  tuesday: z.boolean().optional(),
  wednesday: z.boolean().optional(),
  thursday: z.boolean().optional(),
  friday: z.boolean().optional(),
  saturday: z.boolean().optional(),
  sunday: z.boolean().optional(),
});

export const EditableStopTimeSchema = z.object({
  stopId: z.string().min(1, 'Stop ID is required'),
  time: TimeValidationSchema.nullable(),
  isModified: z.boolean(),
  isSkipped: z.boolean(),
  originalTime: z.string().optional(),
});

export class ScheduleController {
  private relationships: Record<string, unknown>;
  private gtfsParser: Record<string, unknown>;
  private editState: TimetableEditState;

  constructor(
    gtfsRelationships: Record<string, unknown>,
    gtfsParser: Record<string, unknown>
  ) {
    this.relationships = gtfsRelationships;
    this.gtfsParser = gtfsParser;
    this.editState = this.initializeEditState();
  }

  /**
   * Initialize empty edit state
   */
  private initializeEditState(): TimetableEditState {
    return {
      hasUnsavedChanges: false,
      modifiedTrips: new Set(),
      modifiedStops: new Map(),
      serviceModified: false,
      undoStack: [],
      redoStack: [],
    };
  }

  /**
   * Mark a trip as modified
   */
  private markTripModified(tripId: string, stopId?: string): void {
    this.editState.modifiedTrips.add(tripId);

    if (stopId) {
      if (!this.editState.modifiedStops.has(tripId)) {
        this.editState.modifiedStops.set(tripId, new Set());
      }
      this.editState.modifiedStops.get(tripId)!.add(stopId);
    }

    this.editState.hasUnsavedChanges = true;
  }

  /**
   * Mark service as modified
   */
  private markServiceModified(): void {
    this.editState.serviceModified = true;
    this.editState.hasUnsavedChanges = true;
  }

  /**
   * Check if there are unsaved changes
   */
  public hasUnsavedChanges(): boolean {
    return this.editState.hasUnsavedChanges;
  }

  /**
   * Get modified trips
   */
  public getModifiedTrips(): Set<string> {
    return new Set(this.editState.modifiedTrips);
  }

  /**
   * Clear edit state (after save)
   */
  public clearEditState(): void {
    this.editState = this.initializeEditState();
  }

  /**
   * Add operation to undo stack
   */
  private addOperation(operation: TimetableOperation): void {
    // Clear redo stack when new operation is added
    this.editState.redoStack = [];

    // Add to undo stack
    this.editState.undoStack.push(operation);

    // Limit undo stack size to prevent memory issues
    const MAX_UNDO_OPERATIONS = 100;
    if (this.editState.undoStack.length > MAX_UNDO_OPERATIONS) {
      this.editState.undoStack.shift();
    }
  }

  /**
   * Undo the last operation
   */
  public undo(): boolean {
    const operation = this.editState.undoStack.pop();
    if (!operation) {
      return false;
    }

    // Move operation to redo stack
    this.editState.redoStack.push(operation);

    // Apply reverse operation
    this.applyReverseOperation(operation);

    return true;
  }

  /**
   * Redo the last undone operation
   */
  public redo(): boolean {
    const operation = this.editState.redoStack.pop();
    if (!operation) {
      return false;
    }

    // Move operation back to undo stack
    this.editState.undoStack.push(operation);

    // Apply operation
    this.applyOperation(operation);

    return true;
  }

  /**
   * Apply an operation (for redo)
   */
  private applyOperation(operation: TimetableOperation): void {
    switch (operation.type) {
      case 'time_edit':
        if (operation.tripId && operation.stopId && operation.newValue) {
          // Apply the time edit
          this.updateTimeInternal(
            operation.tripId,
            operation.stopId,
            operation.newValue as string,
            false
          );
        }
        break;
      case 'stop_skip':
        if (operation.tripId && operation.stopId) {
          this.skipStopInternal(
            operation.tripId,
            operation.stopId,
            operation.newValue as boolean,
            false
          );
        }
        break;
      // Add other operation types as needed
    }
  }

  /**
   * Apply reverse of an operation (for undo)
   */
  private applyReverseOperation(operation: TimetableOperation): void {
    switch (operation.type) {
      case 'time_edit':
        if (operation.tripId && operation.stopId && operation.oldValue) {
          // Apply the old time
          this.updateTimeInternal(
            operation.tripId,
            operation.stopId,
            operation.oldValue as string,
            false
          );
        }
        break;
      case 'stop_skip':
        if (operation.tripId && operation.stopId) {
          this.skipStopInternal(
            operation.tripId,
            operation.stopId,
            operation.oldValue as boolean,
            false
          );
        }
        break;
      // Add other operation types as needed
    }
  }

  // ===== PUBLIC EDITING METHODS =====

  /**
   * Update time for a specific stop in a trip
   */
  public async updateTime(
    tripId: string,
    stopId: string,
    newTime: string
  ): Promise<void> {
    try {
      // Validate time format
      const validationResult = TimeValidationSchema.safeParse(newTime);
      if (!validationResult.success) {
        console.error('Invalid time format:', validationResult.error);
        // Show error feedback to user
        this.showTimeError(
          tripId,
          stopId,
          'Invalid time format. Use HH:MM (24-hour)'
        );
        return;
      }

      // Get current time for undo operation
      const oldTime = await this.getCurrentTime(tripId, stopId);

      // Add to undo stack
      if (oldTime !== newTime) {
        this.addOperation({
          type: 'time_edit',
          tripId,
          stopId,
          oldValue: oldTime || '',
          newValue: newTime,
          timestamp: Date.now(),
        });
      }

      // Update internal state
      this.updateTimeInternal(tripId, stopId, newTime, false);

      // Update database
      await this.updateStopTimeInDatabase(tripId, stopId, newTime);

      // Mark as modified
      this.markTripModified(tripId, stopId);

      console.log(`Updated time for ${tripId}/${stopId} to ${newTime}`);
    } catch (error) {
      console.error('Failed to update time:', error);
      this.showTimeError(tripId, stopId, 'Failed to save time change');
    }
  }

  /**
   * Skip a stop for a trip
   */
  public skipStop(tripId: string, stopId: string): void {
    this.addOperation({
      type: 'stop_skip',
      tripId,
      stopId,
      oldValue: false,
      newValue: true,
      timestamp: Date.now(),
    });

    this.skipStopInternal(tripId, stopId, true, false);
    this.markTripModified(tripId, stopId);

    // Refresh the display
    this.refreshTimetableCell(tripId, stopId);
  }

  /**
   * Unskip a stop for a trip
   */
  public unskipStop(tripId: string, stopId: string): void {
    this.addOperation({
      type: 'stop_skip',
      tripId,
      stopId,
      oldValue: true,
      newValue: false,
      timestamp: Date.now(),
    });

    this.skipStopInternal(tripId, stopId, false, false);
    this.markTripModified(tripId, stopId);

    // Refresh the display
    this.refreshTimetableCell(tripId, stopId);
  }

  /**
   * Handle keyboard navigation in time inputs
   */
  public handleTimeKeyDown(
    event: KeyboardEvent,
    tripId: string,
    stopId: string
  ): void {
    const input = event.target as HTMLInputElement;

    switch (event.key) {
      case 'Tab':
        // Let default tab behavior handle navigation
        break;
      case 'Enter':
        input.blur(); // Trigger onchange
        this.focusNextTimeCell(tripId, stopId, event.shiftKey);
        event.preventDefault();
        break;
      case 'Escape':
        // Restore original value and blur
        input.value = input.defaultValue;
        input.blur();
        event.preventDefault();
        break;
      case 'ArrowDown':
        this.focusTimeCell(this.getNextStop(stopId), tripId);
        event.preventDefault();
        break;
      case 'ArrowUp':
        this.focusTimeCell(this.getPrevStop(stopId), tripId);
        event.preventDefault();
        break;
      case 'ArrowLeft':
        if (input.selectionStart === 0) {
          this.focusPrevTimeCell(tripId, stopId);
          event.preventDefault();
        }
        break;
      case 'ArrowRight':
        if (input.selectionStart === input.value.length) {
          this.focusNextTimeCell(tripId, stopId, false);
          event.preventDefault();
        }
        break;
    }
  }

  /**
   * Insert stop before another stop (placeholder)
   */
  public insertStopBefore(stopId: string): void {
    console.log(`insertStopBefore: ${stopId} - TODO: Implement in Phase 5`);
    // TODO: Implement in Phase 5
  }

  /**
   * Duplicate a trip (placeholder)
   */
  public duplicateTrip(tripId: string): void {
    console.log(`duplicateTrip: ${tripId} - TODO: Implement in Phase 6`);
    // TODO: Implement in Phase 6
  }

  /**
   * Delete a trip (placeholder)
   */
  public deleteTrip(tripId: string): void {
    console.log(`deleteTrip: ${tripId} - TODO: Implement in Phase 6`);
    // TODO: Implement in Phase 6
  }

  /**
   * Add new trip (placeholder)
   */
  public addNewTrip(): void {
    console.log(`addNewTrip - TODO: Implement in Phase 6`);
    // TODO: Implement in Phase 6
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Internal method to update time without adding to undo stack
   */
  private updateTimeInternal(
    tripId: string,
    stopId: string,
    newTime: string,
    addToUndo: boolean = true
  ): void {
    // Find the trip in current data and update its editable stop times
    // This will be used to maintain state until we refresh from database
    console.log(
      `updateTimeInternal: ${tripId}, ${stopId}, ${newTime}, addToUndo: ${addToUndo}`
    );

    // TODO: Update in-memory trip data structure for immediate UI feedback
  }

  /**
   * Internal method to skip/unskip stop without adding to undo stack
   */
  private skipStopInternal(
    tripId: string,
    stopId: string,
    isSkipped: boolean,
    addToUndo: boolean = true
  ): void {
    console.log(
      `skipStopInternal: ${tripId}, ${stopId}, ${isSkipped}, addToUndo: ${addToUndo}`
    );

    // TODO: Update in-memory trip data structure for immediate UI feedback
  }

  /**
   * Get current time for a stop in a trip
   */
  private async getCurrentTime(
    _tripId: string,
    _stopId: string
  ): Promise<string | null> {
    // TODO: Implement database lookup
    return null;
  }

  /**
   * Update stop_time in database
   */
  private async updateStopTimeInDatabase(
    tripId: string,
    stopId: string,
    newTime: string
  ): Promise<void> {
    // TODO: Use GTFSDatabase to update stop_times table
    console.log(`updateStopTimeInDatabase: ${tripId}, ${stopId}, ${newTime}`);
  }

  /**
   * Show time validation error to user
   */
  private showTimeError(tripId: string, stopId: string, message: string): void {
    // TODO: Show user-friendly error notification
    console.error(`Time error for ${tripId}/${stopId}: ${message}`);
  }

  /**
   * Refresh a single timetable cell
   */
  private refreshTimetableCell(tripId: string, stopId: string): void {
    // TODO: Update specific DOM element without full refresh
    console.log(`refreshTimetableCell: ${tripId}, ${stopId}`);
  }

  /**
   * Focus navigation helpers
   */
  private focusNextTimeCell(
    tripId: string,
    stopId: string,
    reverse: boolean
  ): void {
    // TODO: Implement focus navigation
    console.log(`focusNextTimeCell: ${tripId}, ${stopId}, reverse: ${reverse}`);
  }

  private focusPrevTimeCell(tripId: string, stopId: string): void {
    // TODO: Implement focus navigation
    console.log(`focusPrevTimeCell: ${tripId}, ${stopId}`);
  }

  private focusTimeCell(stopId: string | null, tripId: string): void {
    if (!stopId) {
      return;
    }
    const selector = `input[data-trip-id="${tripId}"][data-stop-id="${stopId}"]`;
    const input = document.querySelector(selector) as HTMLInputElement;
    if (input) {
      input.focus();
      input.select();
    }
  }

  private getNextStop(_stopId: string): string | null {
    // TODO: Get next stop in sequence
    return null;
  }

  private getPrevStop(_stopId: string): string | null {
    // TODO: Get previous stop in sequence
    return null;
  }

  /**
   * Render schedule HTML for a specific route and service
   */
  async renderSchedule(
    routeId: string,
    serviceId: string,
    directionId?: string
  ): Promise<string> {
    try {
      const timetableData = this.generateTimetableData(
        routeId,
        serviceId,
        directionId
      );
      return this.renderTimetableHTML(timetableData);
    } catch (error) {
      console.error('Error rendering schedule:', error);
      return this.renderErrorHTML('Failed to generate schedule view');
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
    const routesData = this.gtfsParser.getFileDataSync('routes.txt') || [];
    const route = routesData.find(
      (r: Record<string, unknown>) => r.route_id === routeId
    );
    if (!route) {
      throw new Error(`Route ${routeId} not found`);
    }

    // Get service information
    const service = this.relationships.getCalendarForService(serviceId) || {
      serviceId,
    };

    // Get all trips for this route and service
    const allTrips = this.relationships.getTripsForRoute(routeId);
    let trips = allTrips.filter(
      (trip: Record<string, unknown>) => trip.serviceId === serviceId
    );

    // Filter by direction if specified
    if (directionId !== undefined) {
      trips = trips.filter(
        (trip: Record<string, unknown>) =>
          (trip.directionId || '0') === directionId
      );
    }

    if (trips.length === 0) {
      const directionFilter =
        directionId !== undefined ? ` and direction ${directionId}` : '';
      throw new Error(
        `No trips found for route ${routeId}, service ${serviceId}${directionFilter}`
      );
    }

    // Build stop sequences for each trip
    const tripSequences: string[][] = [];
    trips.forEach((trip: Record<string, unknown>) => {
      const stopTimes = this.relationships.getStopTimesForTrip(trip.id);
      const tripStops = stopTimes
        .sort(
          (a: Record<string, unknown>, b: Record<string, unknown>) =>
            a.stopSequence - b.stopSequence
        )
        .map((st: Record<string, unknown>) => st.stopId);
      tripSequences.push(tripStops);
    });

    // Use enhanced SCS to get both optimal sequence and alignments
    const scsResult = shortestCommonSupersequenceWithAlignments(tripSequences);
    const scsHelper = new SCSResultHelper(scsResult);

    // Get stop details for the optimal sequence
    const stops = scsResult.supersequence.map((stopId) => {
      return (
        this.relationships.getStopById(stopId) || { id: stopId, name: stopId }
      );
    });

    // Align trips using the SCS result
    const alignedTrips = this.alignTripsWithSCS(trips, scsHelper);

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
   * Enhanced alignment algorithm using SCS result
   * No manual alignment logic needed - everything is handled by SCS!
   */
  private alignTripsWithSCS(
    trips: Trips[],
    scsHelper: SCSResultHelper<string>
  ): AlignedTrip[] {
    const alignedTrips: AlignedTrip[] = [];

    trips.forEach((trip, tripIndex) => {
      const stopTimes = this.relationships.getStopTimesForTrip(trip.id);
      const stopTimeMap = new Map<number, string>();
      const editableStopTimes = new Map<number, EditableStopTime>();

      // Sort stop times by sequence
      const sortedStopTimes = stopTimes.sort(
        (a: Record<string, unknown>, b: Record<string, unknown>) =>
          a.stopSequence - b.stopSequence
      );

      // Use SCS alignment to map times to supersequence positions
      const positionMapping = scsHelper.getPositionMapping(tripIndex);

      sortedStopTimes.forEach((st: Record<string, unknown>, inputPosition) => {
        const superPosition = positionMapping.get(inputPosition);
        if (superPosition !== undefined) {
          const time = st.departureTime || st.arrivalTime;
          if (time) {
            stopTimeMap.set(superPosition, time);
            editableStopTimes.set(superPosition, {
              stopId: st.stopId,
              time: time,
              isModified: false,
              isSkipped: false,
              originalTime: time,
            });
          }
        }
      });

      alignedTrips.push({
        tripId: trip.id,
        headsign: trip.id,
        stopTimes: stopTimeMap,
        isModified: false,
        isNew: false,
        editableStopTimes,
      });
    });

    return alignedTrips;
  }

  // Note: Old getSortedStops method removed - now handled directly by enhanced SCS

  /**
   * Render timetable HTML structure (returns HTML string)
   */
  private renderTimetableHTML(data: TimetableData): string {
    return `
      <div id="schedule-view" class="h-full flex flex-col">
        ${this.renderScheduleHeader(data.route, data.service)}
        ${this.renderTimetableContent(data)}
      </div>
    `;
  }

  /**
   * Render schedule header
   */
  private renderScheduleHeader(
    route: Routes,
    service: Calendar | CalendarDates
  ): string {
    const routeName = route.route_short_name
      ? `${route.route_short_name}${route.route_long_name ? ' - ' + route.route_long_name : ''}`
      : route.route_long_name || route.route_id;

    const serviceName = service.serviceId;

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
        ${this.renderServiceProperties(service)}
      </div>
    `;
  }

  /**
   * Render service properties section
   */
  private renderServiceProperties(service: Calendar | CalendarDates): string {
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
  private getRoutesUsingService(serviceId: string): Routes[] {
    const allRoutes = this.gtfsParser.getFileDataSync('routes.txt') || [];
    const allTrips = this.gtfsParser.getFileDataSync('trips.txt') || [];

    // Get unique route IDs that have trips using this service
    const routeIds = new Set();
    allTrips.forEach((trip: Record<string, unknown>) => {
      if (trip.service_id === serviceId) {
        routeIds.add(trip.route_id);
      }
    });

    // Return route objects for these route IDs
    return allRoutes.filter((route: Record<string, unknown>) =>
      routeIds.has(route.route_id)
    );
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
    } catch {
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

    const isEditable = data.isEditable || false;

    return `
      <div class="timetable-container flex-1 overflow-auto">
        ${isEditable ? this.renderEditingControls() : ''}
        <table class="table table-zebra table-pin-rows table-compact table-hover w-full text-sm group">
          ${this.renderTimetableHeader(data.trips, isEditable)}
          ${this.renderTimetableBody(data.stops, data.trips, isEditable)}
        </table>
      </div>
    `;
  }

  /**
   * Render editing controls bar
   */
  private renderEditingControls(): string {
    return `
      <div class="editing-controls bg-base-200 p-2 mb-2 rounded-lg flex items-center gap-2 text-sm">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-info" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path>
          </svg>
          <span class="font-medium">Editing Mode</span>
        </div>
        <div class="divider divider-horizontal"></div>
        <div class="flex items-center gap-4 text-xs">
          <div class="tooltip" data-tip="Undo last change">
            <button class="btn btn-ghost btn-xs" onclick="gtfsEditor.scheduleController.undo()" ${this.editState.undoStack.length === 0 ? 'disabled' : ''}>
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"></path>
              </svg>
            </button>
          </div>
          <div class="tooltip" data-tip="Redo last change">
            <button class="btn btn-ghost btn-xs" onclick="gtfsEditor.scheduleController.redo()" ${this.editState.redoStack.length === 0 ? 'disabled' : ''}>
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"></path>
              </svg>
            </button>
          </div>
          ${this.editState.hasUnsavedChanges ? '<div class="badge badge-warning badge-sm">Unsaved Changes</div>' : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render timetable header with trip columns
   */
  private renderTimetableHeader(
    trips: AlignedTrip[],
    isEditable: boolean = false
  ): string {
    const tripHeaders = trips
      .map((trip) => {
        if (isEditable) {
          return `
            <th class="trip-header p-2 text-center min-w-[80px] border-b border-base-300 group">
              <div class="trip-id text-xs font-medium ${trip.isModified ? 'text-info' : ''}">${trip.tripId}</div>
              <div class="trip-actions opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                <div class="flex justify-center gap-1">
                  <button class="btn btn-ghost btn-xs" onclick="gtfsEditor.scheduleController.duplicateTrip('${trip.tripId}')" title="Duplicate trip">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 7a1 1 0 012 0v6a1 1 0 11-2 0V7zM13 7a1 1 0 012 0v6a1 1 0 11-2 0V7z"></path>
                      <path fill-rule="evenodd" d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 011 1v8a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" clip-rule="evenodd"></path>
                    </svg>
                  </button>
                  <button class="btn btn-ghost btn-xs text-error" onclick="gtfsEditor.scheduleController.deleteTrip('${trip.tripId}')" title="Delete trip">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clip-rule="evenodd"></path>
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </th>
          `;
        } else {
          return `
            <th class="trip-header p-2 text-center min-w-[80px] border-b border-base-300">
              <div class="trip-id text-xs font-medium">${trip.tripId}</div>
            </th>
          `;
        }
      })
      .join('');

    const newTripColumn = isEditable
      ? `
      <th class="trip-header p-2 text-center min-w-[80px] border-b border-base-300 border-dashed">
        <button class="btn btn-ghost btn-sm w-full h-full" onclick="gtfsEditor.scheduleController.addNewTrip()" title="Add new trip">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"></path>
          </svg>
        </button>
      </th>
    `
      : '';

    return `
      <thead class="sticky top-0 bg-base-100 z-10">
        <tr>
          <th class="stop-header p-2 text-left min-w-[200px] sticky left-0 bg-base-100 border-b border-base-300">
            Stop
          </th>
          ${tripHeaders}
          ${newTripColumn}
        </tr>
      </thead>
    `;
  }

  /**
   * Render timetable body with stop rows
   */
  private renderTimetableBody(
    stops: Stops[],
    trips: AlignedTrip[],
    isEditable: boolean = false
  ): string {
    const rows = stops
      .map((stop, stopIndex) => {
        const rowClass = '';
        const timeCells = trips
          .map((trip) => {
            // Use the current stop index as position (NOT findIndex!)
            const stopPosition = stopIndex;
            const time = trip.stopTimes.get(stopPosition);
            const editableStopTime = trip.editableStopTimes?.get(stopPosition);

            if (isEditable) {
              return this.renderEditableTimeCell(
                trip.tripId,
                stop.id,
                time,
                editableStopTime
              );
            } else {
              return this.renderReadOnlyTimeCell(time);
            }
          })
          .join('');

        return `
        <tr class="${rowClass}">
          <td class="stop-name p-2 font-medium sticky left-0 bg-base-100 border-r border-base-300">
            <div class="stop-name-text">${this.escapeHtml(stop.name)}</div>
            <div class="stop-id text-xs opacity-70">${stop.id}</div>
            ${isEditable ? this.renderStopActions(stop.id) : ''}
          </td>
          ${timeCells}
        </tr>
      `;
      })
      .join('');

    return `<tbody>${rows}</tbody>`;
  }

  /**
   * Render read-only time cell (original behavior)
   */
  private renderReadOnlyTimeCell(time: string | null): string {
    return `
      <td class="time-cell p-2 text-center ${time ? 'has-time' : 'no-time text-base-content/30'}">
        ${time ? `<span class="time-badge badge badge-ghost badge-sm font-mono">${this.formatTime(time)}</span>` : '—'}
      </td>
    `;
  }

  /**
   * Render editable time cell with input and validation
   */
  private renderEditableTimeCell(
    tripId: string,
    stopId: string,
    time: string | null,
    editableStopTime?: EditableStopTime
  ): string {
    const isSkipped = editableStopTime?.isSkipped || false;
    const isModified = editableStopTime?.isModified || false;
    const displayTime = time ? this.formatTime(time) : '';

    const cellClass = `time-cell p-1 text-center ${
      isSkipped
        ? 'skipped bg-warning/20 text-warning-content'
        : time
          ? 'has-time'
          : 'no-time text-base-content/30'
    } ${isModified ? 'modified border border-info' : ''}`;

    if (isSkipped) {
      return `
        <td class="${cellClass}">
          <div class="skipped-indicator">
            <span class="text-xs opacity-70">SKIP</span>
            <button class="btn btn-ghost btn-xs ml-1" onclick="gtfsEditor.scheduleController.unskipStop('${tripId}', '${stopId}')" title="Unskip this stop">
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
              </svg>
            </button>
          </div>
        </td>
      `;
    }

    return `
      <td class="${cellClass}">
        <div class="time-input-container">
          <input
            type="text"
            class="time-input input input-xs w-20 text-center font-mono bg-transparent border-none focus:outline-none focus:bg-base-200 ${isModified ? 'text-info' : ''}"
            value="${displayTime}"
            placeholder="--:--"
            data-trip-id="${tripId}"
            data-stop-id="${stopId}"
            pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$|^(2[4-9]|[3-9][0-9]):[0-5][0-9]$"
            title="Enter time in HH:MM format (24-hour, may exceed 24:00)"
            onchange="gtfsEditor.scheduleController.updateTime('${tripId}', '${stopId}', this.value)"
            onkeydown="gtfsEditor.scheduleController.handleTimeKeyDown(event, '${tripId}', '${stopId}')"
            onfocus="this.select()"
          />
          <div class="time-cell-actions opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 right-0">
            <button class="btn btn-ghost btn-xs" onclick="gtfsEditor.scheduleController.skipStop('${tripId}', '${stopId}')" title="Skip this stop">
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clip-rule="evenodd"></path>
              </svg>
            </button>
          </div>
        </div>
      </td>
    `;
  }

  /**
   * Render stop actions (for inserting stops)
   */
  private renderStopActions(stopId: string): string {
    return `
      <div class="stop-actions opacity-0 group-hover:opacity-100 transition-opacity text-xs mt-1">
        <button class="btn btn-ghost btn-xs" onclick="gtfsEditor.scheduleController.insertStopBefore('${stopId}')" title="Insert stop before">
          <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"></path>
          </svg>
        </button>
      </div>
    `;
  }

  /**
   * Format time for display (HH:MM)
   */
  private formatTime(time: string): string {
    if (!time) {
      return '';
    }

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
   * Render error state HTML
   */
  private renderErrorHTML(message: string): string {
    return `
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
  }

  /**
   * Get a human-readable direction name
   */
  private getDirectionName(directionId: string, _trips: Trips[]): string {
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
