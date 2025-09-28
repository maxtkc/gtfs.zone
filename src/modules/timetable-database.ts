/**
 * Timetable Database Module
 * Handles all database operations for timetable (schedule) functionality
 * Follows "FAIL HARD" error policy - no fallbacks, expose real errors
 */

import { StopTimes, GTFSTableMap } from '../types/gtfs-entities.js';
import { StopTimesSchema } from '../types/gtfs.js';
import { generateCompositeKeyFromRecord } from '../utils/gtfs-primary-keys.js';
import { notifications } from './notification-system.js';

interface GTFSParserInterface {
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
    generateKey<T extends keyof GTFSTableMap>(
      tableName: T,
      data: GTFSTableMap[T]
    ): string;
  };
}

/**
 * Timetable Database - Database operations for schedule functionality
 *
 * This class is responsible for:
 * - All stop_times table CRUD operations
 * - Time validation using GTFS schemas
 * - Arrival/departure constraint validation
 * - Linked time management (same arrival/departure values)
 * - FAIL HARD error handling with user notifications
 *
 * Follows the GTFS standard property naming and Enhanced GTFS Object pattern.
 * Never implements fallback logic - always exposes real errors for debugging.
 */
export class TimetableDatabase {
  private gtfsParser: GTFSParserInterface;

  /**
   * Initialize TimetableDatabase with GTFS parser dependency
   *
   * @param gtfsParser - GTFS parser interface with database access
   */
  constructor(gtfsParser: GTFSParserInterface) {
    this.gtfsParser = gtfsParser;
  }

  /**
   * Get current time for a stop in a trip (legacy single time method)
   *
   * Legacy method that returns a single time value for display purposes.
   * Prefers departure_time, falls back to arrival_time if departure is null.
   * Follows FAIL HARD policy - throws on database connection or query failures.
   *
   * @param trip_id - GTFS trip identifier
   * @param stop_id - GTFS stop identifier
   * @returns Promise resolving to time string or null if no times set
   * @throws {Error} When database connection unavailable or stop_time not found
   */
  async getCurrentTime(
    trip_id: string,
    stop_id: string
  ): Promise<string | null> {
    const database = this.gtfsParser.gtfsDatabase;
    if (!database) {
      const error = 'Database connection not available';
      console.error(error);
      notifications.showError('Database connection lost');
      throw new Error(error);
    }

    const stopTimes = await database.queryRows('stop_times', {
      trip_id: trip_id,
      stop_id: stop_id,
    });

    if (stopTimes.length === 0) {
      const error = `No stop_time found for trip ${trip_id}, stop ${stop_id}`;
      console.error('Database query failed:', error);
      notifications.showError('Schedule record not found');
      throw new Error(error);
    }

    // Return departure_time or fall back to arrival_time
    const stopTime = stopTimes[0];
    return stopTime.departure_time || stopTime.arrival_time || null;
  }

  /**
   * Get current arrival time for a stop in a trip
   *
   * Retrieves the arrival_time field specifically for a stop_time record.
   * Used for separate arrival/departure time handling.
   * Follows FAIL HARD policy - throws on database issues.
   *
   * @param trip_id - GTFS trip identifier
   * @param stop_id - GTFS stop identifier
   * @returns Promise resolving to arrival time string or null
   * @throws {Error} When database connection unavailable or stop_time not found
   */
  async getCurrentArrivalTime(
    trip_id: string,
    stop_id: string
  ): Promise<string | null> {
    const database = this.gtfsParser.gtfsDatabase;
    if (!database) {
      const error = 'Database connection not available';
      console.error(error);
      notifications.showError('Database connection lost');
      throw new Error(error);
    }

    const stopTimes = await database.queryRows('stop_times', {
      trip_id: trip_id,
      stop_id: stop_id,
    });

    if (stopTimes.length === 0) {
      const error = `No stop_time found for trip ${trip_id}, stop ${stop_id}`;
      console.error('Database query failed:', error);
      notifications.showError('Schedule record not found');
      throw new Error(error);
    }

    const stopTime = stopTimes[0];
    return stopTime.arrival_time || null;
  }

  /**
   * Get current departure time for a stop in a trip
   *
   * Retrieves the departure_time field specifically for a stop_time record.
   * Used for separate arrival/departure time handling.
   * Follows FAIL HARD policy - throws on database issues.
   *
   * @param trip_id - GTFS trip identifier
   * @param stop_id - GTFS stop identifier
   * @returns Promise resolving to departure time string or null
   * @throws {Error} When database connection unavailable or stop_time not found
   */
  async getCurrentDepartureTime(
    trip_id: string,
    stop_id: string
  ): Promise<string | null> {
    const database = this.gtfsParser.gtfsDatabase;
    if (!database) {
      const error = 'Database connection not available';
      console.error(error);
      notifications.showError('Database connection lost');
      throw new Error(error);
    }

    const stopTimes = await database.queryRows('stop_times', {
      trip_id: trip_id,
      stop_id: stop_id,
    });

    if (stopTimes.length === 0) {
      const error = `No stop_time found for trip ${trip_id}, stop ${stop_id}`;
      console.error('Database query failed:', error);
      notifications.showError('Schedule record not found');
      throw new Error(error);
    }

    const stopTime = stopTimes[0];
    return stopTime.departure_time || null;
  }

  /**
   * Update stop_time in database
   *
   * Main method for updating individual time fields in stop_times table.
   * Validates time format using GTFS schema before database update.
   * Shows success notifications and logs changes.
   * Follows FAIL HARD policy - throws on validation or database failures.
   *
   * @param trip_id - GTFS trip identifier
   * @param stop_id - GTFS stop identifier
   * @param newTime - New time value or null to clear the field
   * @param timeType - Which field to update ('arrival' or 'departure', defaults to 'departure')
   * @throws {Error} When validation fails, database unavailable, or record not found
   */
  async updateStopTimeInDatabase(
    trip_id: string,
    stop_id: string,
    newTime: string | null,
    timeType?: 'arrival' | 'departure'
  ): Promise<void> {
    // Access the database through gtfsParser
    const database = this.gtfsParser.gtfsDatabase;
    if (!database) {
      const error = 'Database connection not available';
      console.error(error);
      notifications.showError(
        'Unable to save changes - database connection lost'
      );
      throw new Error(error);
    }

    // Validate time format using GTFS schema if not null
    if (newTime !== null) {
      const timeValidation =
        StopTimesSchema.shape.arrival_time.safeParse(newTime);
      if (!timeValidation.success) {
        const error = `Invalid time format: ${newTime}. Must be HH:MM:SS format.`;
        console.error('Time validation failed:', timeValidation.error);
        notifications.showError(`Invalid time format: ${newTime}`);
        throw new Error(error);
      }
    }

    // Find the stop_time record by trip_id and stop_id
    const stopTimes = await database.queryRows('stop_times', {
      trip_id: trip_id,
      stop_id: stop_id,
    });

    if (stopTimes.length === 0) {
      const error = `No stop_time found for trip ${trip_id}, stop ${stop_id}`;
      console.error('Database update failed:', error);
      notifications.showError('Unable to find the schedule record to update');
      throw new Error(error);
    }

    // Use the first matching record (there should be only one)
    const stopTime = stopTimes[0];

    // Determine which field to update
    const field =
      timeType === 'arrival'
        ? 'arrival_time'
        : timeType === 'departure'
          ? 'departure_time'
          : 'departure_time';

    // Generate composite key for the stop_time record and update
    const naturalKey = generateCompositeKeyFromRecord('stop_times', stopTime);
    await database.updateRow('stop_times', naturalKey, {
      [field]: newTime,
    });

    // Log success and show success notification
    console.log(
      `Updated ${field} for trip ${trip_id}, stop ${stop_id} to ${newTime || 'null'}`
    );
    notifications.showSuccess(`Time updated to ${newTime || 'skipped'}`, {
      duration: 2000,
    });
  }

  /**
   * Update both arrival and departure times to the same value (linked times)
   *
   * Sets both arrival_time and departure_time fields to the same value.
   * Used for stops without dwell time where arrival equals departure.
   * Validates time format and provides appropriate user feedback.
   * Follows FAIL HARD policy - throws on validation or database failures.
   *
   * @param trip_id - GTFS trip identifier
   * @param stop_id - GTFS stop identifier
   * @param newTime - New time value for both fields, or null to clear both
   * @throws {Error} When validation fails, database unavailable, or record not found
   */
  async updateLinkedTimes(
    trip_id: string,
    stop_id: string,
    newTime: string | null
  ): Promise<void> {
    const database = this.gtfsParser.gtfsDatabase;
    if (!database) {
      const error = 'Database connection not available';
      console.error(error);
      notifications.showError(
        'Unable to save changes - database connection lost'
      );
      throw new Error(error);
    }

    // Validate time format using GTFS schema if not null
    if (newTime !== null) {
      const timeValidation =
        StopTimesSchema.shape.arrival_time.safeParse(newTime);
      if (!timeValidation.success) {
        const error = `Invalid time format: ${newTime}. Must be HH:MM:SS format.`;
        console.error('Time validation failed:', timeValidation.error);
        notifications.showError(`Invalid time format: ${newTime}`);
        throw new Error(error);
      }
    }

    // Find the stop_time record
    const stopTimes = await database.queryRows('stop_times', {
      trip_id: trip_id,
      stop_id: stop_id,
    });

    if (stopTimes.length === 0) {
      const error = `No stop_time found for trip ${trip_id}, stop ${stop_id}`;
      console.error('Database update failed:', error);
      notifications.showError('Unable to find the schedule record to update');
      throw new Error(error);
    }

    const stopTime = stopTimes[0];
    const naturalKey = generateCompositeKeyFromRecord('stop_times', stopTime);

    // Update both times to the same value
    await database.updateRow('stop_times', naturalKey, {
      arrival_time: newTime,
      departure_time: newTime,
    });

    console.log(
      `Updated linked times for trip ${trip_id}, stop ${stop_id} to ${newTime || 'null'}`
    );

    if (newTime) {
      notifications.showSuccess(`Linked time updated to ${newTime}`, {
        duration: 2000,
      });
    } else {
      notifications.showSuccess('Linked times cleared', {
        duration: 2000,
      });
    }
  }

  /**
   * Get stop_time record for querying database state
   *
   * Retrieves the complete stop_time record for state inspection.
   * Used to check current values before updates or state transitions.
   * Returns null if record not found (does not throw for missing records).
   *
   * @param trip_id - GTFS trip identifier
   * @param stop_id - GTFS stop identifier
   * @returns Promise resolving to StopTimes record or null if not found
   * @throws {Error} When database connection unavailable
   */
  async getStopTime(
    trip_id: string,
    stop_id: string
  ): Promise<StopTimes | null> {
    const database = this.gtfsParser.gtfsDatabase;
    if (!database) {
      const error = 'Database connection not available';
      console.error(error);
      notifications.showError('Database connection lost');
      throw new Error(error);
    }

    const stopTimes = await database.queryRows('stop_times', {
      trip_id: trip_id,
      stop_id: stop_id,
    });

    if (stopTimes.length === 0) {
      return null;
    }

    return stopTimes[0];
  }

  /**
   * Validate arrival <= departure time constraint
   *
   * Checks that arrival time is not later than departure time.
   * Used before updating individual arrival/departure times to maintain
   * GTFS specification compliance. Only validates when both times are present.
   *
   * @param trip_id - GTFS trip identifier
   * @param stop_id - GTFS stop identifier
   * @param timeType - Which time field is being updated ('arrival' or 'departure')
   * @param newTime - New time value to validate against existing time
   * @returns Promise resolving to validation result with optional error message
   */
  async validateArrivalDepartureConstraint(
    trip_id: string,
    stop_id: string,
    timeType: 'arrival' | 'departure',
    newTime: string
  ): Promise<{ isValid: boolean; errorMessage?: string }> {
    const stopTime = await this.getStopTime(trip_id, stop_id);
    if (!stopTime) {
      return { isValid: false, errorMessage: 'Schedule record not found' };
    }

    const currentArrivalTime = stopTime.arrival_time;
    const currentDepartureTime = stopTime.departure_time;

    // Validate arrival <= departure constraint if both are specified
    if (
      timeType === 'arrival' &&
      currentDepartureTime &&
      newTime > currentDepartureTime
    ) {
      return {
        isValid: false,
        errorMessage: 'Arrival time must be before or equal to departure time',
      };
    }

    if (
      timeType === 'departure' &&
      currentArrivalTime &&
      newTime < currentArrivalTime
    ) {
      return {
        isValid: false,
        errorMessage: 'Departure time must be after or equal to arrival time',
      };
    }

    return { isValid: true };
  }
}
