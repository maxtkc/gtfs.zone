/**
 * Offline Manager
 * Handles offline detection and graceful degradation
 */
export class OfflineManager {
  private isOnline: boolean = navigator.onLine;
  private offlineIndicator: HTMLElement | null = null;
  private retryQueue: Array<() => Promise<void>> = [];

  constructor() {
    this.initializeOfflineDetection();
    this.initializeOfflineIndicator();
  }

  /**
   * Initialize offline/online detection
   */
  private initializeOfflineDetection(): void {
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));

    // Check connection periodically for more reliable detection
    setInterval(() => {
      this.checkConnectionStatus();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Initialize offline indicator UI
   */
  private initializeOfflineIndicator(): void {
    let existingIndicator = document.getElementById('offline-indicator');
    if (!existingIndicator) {
      existingIndicator = this.createOfflineIndicator();
      document.body.appendChild(existingIndicator);
    }

    this.offlineIndicator = existingIndicator;
  }

  /**
   * Create the offline indicator DOM element
   */
  private createOfflineIndicator(): HTMLElement {
    const indicator = document.createElement('div');
    indicator.id = 'offline-indicator';
    indicator.className =
      'fixed top-16 left-0 right-0 z-40 bg-error text-error-content px-4 py-2 text-center transform -translate-y-full transition-transform duration-300';
    indicator.innerHTML = `
      <div class="flex items-center justify-center space-x-2">
        <span>📡</span>
        <span>You're offline. Some features may be limited.</span>
        <button class="btn btn-sm btn-outline btn-error-content ml-4" id="retry-connection">
          Retry Connection
        </button>
      </div>
    `;

    // Add retry button functionality
    const retryButton = indicator.querySelector(
      '#retry-connection'
    ) as HTMLButtonElement;
    retryButton.addEventListener('click', () => {
      this.checkConnectionStatus();
      this.processRetryQueue();
    });

    return indicator;
  }

  /**
   * Handle online event
   */
  private handleOnline(): void {
    console.log('Connection restored');
    this.isOnline = true;
    this.hideOfflineIndicator();
    this.processRetryQueue();
    this.showConnectionRestored();
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    console.log('Connection lost');
    this.isOnline = false;
    this.showOfflineIndicator();
  }

  /**
   * Check connection status manually
   */
  private async checkConnectionStatus(): Promise<void> {
    try {
      // Try to fetch a small resource to verify connectivity
      const response = await fetch('/', {
        method: 'HEAD',
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });

      const wasOffline = !this.isOnline;
      this.isOnline = response.ok;

      if (wasOffline && this.isOnline) {
        this.handleOnline();
      } else if (!wasOffline && !this.isOnline) {
        this.handleOffline();
      }
    } catch {
      if (this.isOnline) {
        this.handleOffline();
      }
    }
  }

  /**
   * Check if currently online
   */
  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Add operation to retry queue for when connection is restored
   */
  addToRetryQueue(operation: () => Promise<void>): void {
    this.retryQueue.push(operation);
  }

  /**
   * Process all queued operations when connection is restored
   */
  private async processRetryQueue(): Promise<void> {
    if (!this.isOnline || this.retryQueue.length === 0) {
      return;
    }

    console.log(`Processing ${this.retryQueue.length} queued operations`);

    const operations = [...this.retryQueue];
    this.retryQueue = [];

    for (const operation of operations) {
      try {
        await operation();
      } catch (error) {
        console.error('Failed to retry operation:', error);
        // Re-add failed operation to queue
        this.retryQueue.push(operation);
      }
    }
  }

  /**
   * Execute operation with offline handling
   */
  async executeWithOfflineHandling<T>(
    operation: () => Promise<T>,
    fallback?: () => T,
    retryable: boolean = true
  ): Promise<T> {
    if (!this.isOnline) {
      if (fallback) {
        console.log('Executing offline fallback');
        return fallback();
      } else {
        throw new Error('Operation requires internet connection');
      }
    }

    try {
      return await operation();
    } catch (error) {
      console.error('Operation failed:', error);

      // Check if this might be a network error
      if (this.isNetworkError(error)) {
        this.handleOffline();

        if (retryable) {
          this.addToRetryQueue(async () => {
            await operation();
          });
        }

        if (fallback) {
          return fallback();
        }
      }

      throw error;
    }
  }

  /**
   * Check if error is likely a network error
   */
  private isNetworkError(error: unknown): boolean {
    return (
      error instanceof TypeError ||
      (error instanceof Error && error.message?.includes('fetch')) ||
      (error instanceof Error && error.message?.includes('network')) ||
      (error instanceof Error && error.message?.includes('Failed to fetch'))
    );
  }

  /**
   * Show offline indicator
   */
  private showOfflineIndicator(): void {
    if (this.offlineIndicator) {
      this.offlineIndicator.classList.remove('-translate-y-full');
      this.offlineIndicator.classList.add('translate-y-0');
    }
  }

  /**
   * Hide offline indicator
   */
  private hideOfflineIndicator(): void {
    if (this.offlineIndicator) {
      this.offlineIndicator.classList.remove('translate-y-0');
      this.offlineIndicator.classList.add('-translate-y-full');
    }
  }

  /**
   * Show connection restored notification
   */
  private showConnectionRestored(): void {
    if (this.offlineIndicator) {
      // Temporarily show success message
      this.offlineIndicator.className =
        'fixed top-16 left-0 right-0 z-40 bg-success text-success-content px-4 py-2 text-center transform translate-y-0 transition-transform duration-300';
      this.offlineIndicator.innerHTML = `
        <div class="flex items-center justify-center space-x-2">
          <span>✅</span>
          <span>Connection restored!</span>
        </div>
      `;

      // Hide after 3 seconds
      setTimeout(() => {
        this.hideOfflineIndicator();
        // Reset to offline indicator appearance
        this.offlineIndicator!.className =
          'fixed top-16 left-0 right-0 z-40 bg-error text-error-content px-4 py-2 text-center transform -translate-y-full transition-transform duration-300';
        this.offlineIndicator!.innerHTML = `
          <div class="flex items-center justify-center space-x-2">
            <span>📡</span>
            <span>You're offline. Some features may be limited.</span>
            <button class="btn btn-sm btn-outline btn-error-content ml-4" id="retry-connection">
              Retry Connection
            </button>
          </div>
        `;

        // Re-attach retry button event
        const retryButton = this.offlineIndicator!.querySelector(
          '#retry-connection'
        ) as HTMLButtonElement;
        retryButton?.addEventListener('click', () => {
          this.checkConnectionStatus();
          this.processRetryQueue();
        });
      }, 3000);
    }
  }

  /**
   * Get offline-friendly error message
   */
  getOfflineMessage(operationName: string): string {
    return `Cannot ${operationName} while offline. The operation will be retried when connection is restored.`;
  }

  /**
   * Cleanup event listeners
   */
  destroy(): void {
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));

    if (this.offlineIndicator) {
      document.body.removeChild(this.offlineIndicator);
      this.offlineIndicator = null;
    }
  }
}

// Global singleton instance
export const offlineManager = new OfflineManager();
