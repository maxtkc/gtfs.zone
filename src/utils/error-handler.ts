interface ErrorMetadata {
  [key: string]: unknown;
}

interface ErrorOptions {
  userFacing?: boolean;
  report?: boolean;
  metadata?: ErrorMetadata;
}

interface ErrorReport {
  message: string;
  stack?: string;
  context: string;
  metadata: ErrorMetadata;
  userAgent: string;
  url: string;
  timestamp: string;
}

type NotificationCallback = (message: string, type: string) => void;
type ErrorReporter = (report: ErrorReport) => void;

/**
 * Centralized error handling for the GTFS Zone application
 * Provides consistent error logging, user notifications, and optional error reporting
 */
export class ErrorHandler {
  private static notificationCallback: NotificationCallback | null = null;
  private static errorReporter: ErrorReporter | null = null;

  static setNotificationCallback(callback: NotificationCallback): void {
    this.notificationCallback = callback;
  }

  static setErrorReporter(reporter: ErrorReporter): void {
    this.errorReporter = reporter;
  }

  static handle(
    error: Error,
    context: string,
    options: ErrorOptions = {}
  ): void {
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

  static async handleAsync<T>(
    promise: Promise<T>,
    context: string,
    options: ErrorOptions = {}
  ): Promise<T> {
    try {
      return await promise;
    } catch (error) {
      this.handle(error, context, options);
      throw error; // Re-throw so caller can handle as needed
    }
  }

  private static getUserFriendlyMessage(error: Error, context: string): string {
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

  private static isUserFriendlyMessage(message: string): boolean {
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

  private static shouldReport(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    );
  }

  private static reportError(
    error: Error,
    context: string,
    metadata: ErrorMetadata
  ): void {
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

  static wrap<T extends (...args: unknown[]) => unknown>(
    handler: T,
    context: string
  ): T {
    return ((...args: Parameters<T>) => {
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
    }) as T;
  }

  static throwValidationError(
    message: string,
    context: string,
    details: ErrorMetadata = {}
  ): never {
    const error = new Error(message);
    error.name = 'ValidationError';
    error.details = details;
    this.handle(error, context, { userFacing: true, report: false });
    throw error;
  }
}
