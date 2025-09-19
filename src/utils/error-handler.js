/**
 * Centralized error handling for the GTFS Zone application
 * Provides consistent error logging, user notifications, and optional error reporting
 */
export class ErrorHandler {
  /**
   * @private
   * @type {Function|null}
   */
  static notificationCallback = null;

  /**
   * @private
   * @type {Function|null}
   */
  static errorReporter = null;

  /**
   * Set the notification callback for user-facing error messages
   * @param {Function} callback - Function to call with error messages
   */
  static setNotificationCallback(callback) {
    this.notificationCallback = callback;
  }

  /**
   * Set the error reporter for production error tracking
   * @param {Function} reporter - Function to report errors to external service
   */
  static setErrorReporter(reporter) {
    this.errorReporter = reporter;
  }

  /**
   * Main error handling method
   * @param {Error} error - The error that occurred
   * @param {string} context - Context where the error occurred (e.g., 'file-upload', 'map-rendering')
   * @param {Object} options - Additional options
   * @param {boolean} [options.userFacing=true] - Whether to show user-facing notification
   * @param {boolean} [options.report=true] - Whether to report to error tracking service
   * @param {Object} [options.metadata] - Additional metadata to include with error
   */
  static handle(error, context, options = {}) {
    const { userFacing = true, report = true, metadata = {} } = options;

    // Always log to console for debugging
    console.error(`[${context}]`, error, metadata);

    // In development, also send to DevErrorSystem if available
    if (typeof window !== 'undefined' && window.DevErrorSystem) {
      window.DevErrorSystem.handleError({
        type: `App Error (${context})`,
        message: error.message || String(error),
        error,
        stack: error.stack,
        context,
        metadata,
        critical: true,
      });
    }

    // Show user-facing notification if enabled and callback is set
    if (userFacing && this.notificationCallback) {
      const userMessage = this.getUserFriendlyMessage(error, context);
      this.notificationCallback(userMessage, 'error');
    }

    // Report to error tracking service if in production and enabled
    if (report && this.shouldReport() && this.errorReporter) {
      this.reportError(error, context, metadata);
    }
  }

  /**
   * Handle async operation errors with consistent messaging
   * @param {Promise} promise - The promise to handle
   * @param {string} context - Context for error handling
   * @param {Object} options - Error handling options
   * @returns {Promise} - The original promise with error handling
   */
  static async handleAsync(promise, context, options = {}) {
    try {
      return await promise;
    } catch (error) {
      this.handle(error, context, options);
      throw error; // Re-throw so caller can handle as needed
    }
  }

  /**
   * Convert technical errors to user-friendly messages
   * @private
   * @param {Error} error - The error to convert
   * @param {string} context - Context where error occurred
   * @returns {string} User-friendly error message
   */
  static getUserFriendlyMessage(error, context) {
    const contextMessages = {
      'file-upload':
        'Failed to upload file. Please check the file format and try again.',
      'file-parsing':
        'Failed to parse GTFS file. Please check that the file is valid.',
      'map-rendering':
        'Failed to display map data. Please try refreshing the page.',
      export: 'Failed to export data. Please try again.',
      'url-loading':
        'Failed to load data from URL. Please check the URL and try again.',
      editor: 'Failed to update editor content.',
      network:
        'Network error occurred. Please check your connection and try again.',
    };

    const baseMessage =
      contextMessages[context] || 'An unexpected error occurred.';

    // Include specific error message if it's user-friendly
    if (error.message && this.isUserFriendlyMessage(error.message)) {
      return `${baseMessage} (${error.message})`;
    }

    return baseMessage;
  }

  /**
   * Check if an error message is safe to show to users
   * @private
   * @param {string} message - Error message to check
   * @returns {boolean} Whether message is user-friendly
   */
  static isUserFriendlyMessage(message) {
    // Filter out technical messages that might confuse users
    const technicalPatterns = [
      /stack trace/i,
      /undefined is not a function/i,
      /cannot read property/i,
      /permission denied/i,
      /cors/i,
    ];

    return !technicalPatterns.some((pattern) => pattern.test(message));
  }

  /**
   * Determine if errors should be reported (e.g., in production)
   * @private
   * @returns {boolean} Whether to report errors
   */
  static shouldReport() {
    return (
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    );
  }

  /**
   * Report error to external service
   * @private
   * @param {Error} error - Error to report
   * @param {string} context - Context where error occurred
   * @param {Object} metadata - Additional metadata
   */
  static reportError(error, context, metadata) {
    if (this.errorReporter) {
      try {
        this.errorReporter({
          message: error.message,
          stack: error.stack,
          context,
          metadata,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        });
      } catch (reportingError) {
        console.error('Failed to report error:', reportingError);
      }
    }
  }

  /**
   * Create a wrapper function that handles errors for event handlers
   * @param {Function} handler - The original event handler
   * @param {string} context - Context for error handling
   * @returns {Function} Wrapped handler with error handling
   */
  static wrap(handler, context) {
    return (...args) => {
      try {
        const result = handler(...args);

        // Handle async functions
        if (result && typeof result.catch === 'function') {
          return result.catch((error) => {
            this.handle(error, context);
            throw error;
          });
        }

        return result;
      } catch (error) {
        this.handle(error, context);
        throw error;
      }
    };
  }

  /**
   * Utility method for validation errors
   * @param {string} message - Validation error message
   * @param {string} context - Context where validation failed
   * @param {Object} details - Additional validation details
   * @throws {Error} Validation error
   */
  static throwValidationError(message, context, details = {}) {
    const error = new Error(message);
    error.name = 'ValidationError';
    error.details = details;
    this.handle(error, context, { userFacing: true, report: false });
    throw error;
  }
}
