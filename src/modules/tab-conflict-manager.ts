/**
 * Tab Conflict Manager
 * Detects and handles concurrent tab scenarios
 */
export class TabConflictManager {
  private readonly HEARTBEAT_INTERVAL = 5000; // 5 seconds
  private readonly CONFLICT_THRESHOLD = 10000; // 10 seconds
  private readonly TAB_ID = this.generateTabId();
  private readonly STORAGE_KEY = 'gtfs_zone_tabs';
  private heartbeatInterval: number | null = null;
  private lastConflictWarning = 0;

  constructor() {
    this.initializeTabTracking();
  }

  /**
   * Generate unique tab ID
   */
  private generateTabId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize tab tracking and conflict detection
   */
  private initializeTabTracking(): void {
    // Register this tab
    this.registerTab();

    // Start heartbeat
    this.startHeartbeat();

    // Listen for storage changes (other tabs)
    window.addEventListener('storage', this.handleStorageChange.bind(this));

    // Cleanup on page unload
    window.addEventListener('beforeunload', this.cleanup.bind(this));

    // Check for existing conflicts on startup
    setTimeout(() => this.checkForConflicts(), 1000);
  }

  /**
   * Register this tab in localStorage
   */
  private registerTab(): void {
    try {
      const tabs = this.getActiveTabs();
      tabs[this.TAB_ID] = {
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tabs));
    } catch (error) {
      console.warn('Failed to register tab:', error);
    }
  }

  /**
   * Get all active tabs from localStorage
   */
  private getActiveTabs(): {
    [tabId: string]: { timestamp: number; url: string; userAgent: string };
  } {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return {};
      }

      const tabs = JSON.parse(stored);
      const now = Date.now();

      // Remove stale tabs (older than conflict threshold)
      Object.keys(tabs).forEach((tabId) => {
        if (now - tabs[tabId].timestamp > this.CONFLICT_THRESHOLD) {
          delete tabs[tabId];
        }
      });

      return tabs;
    } catch (error) {
      console.warn('Failed to get active tabs:', error);
      return {};
    }
  }

  /**
   * Start heartbeat to indicate this tab is active
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(() => {
      this.registerTab();
      this.checkForConflicts();
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Handle storage changes from other tabs
   */
  private handleStorageChange(event: StorageEvent): void {
    if (event.key === this.STORAGE_KEY) {
      // Another tab updated the tab list
      setTimeout(() => this.checkForConflicts(), 100);
    }
  }

  /**
   * Check for conflicts with other tabs
   */
  private checkForConflicts(): void {
    const tabs = this.getActiveTabs();
    const otherTabs = Object.keys(tabs).filter(
      (tabId) => tabId !== this.TAB_ID
    );

    if (otherTabs.length > 0) {
      const now = Date.now();

      // Only show warning once every 30 seconds
      if (now - this.lastConflictWarning > 30000) {
        this.showConflictWarning(otherTabs.length);
        this.lastConflictWarning = now;
      }
    }
  }

  /**
   * Show conflict warning to user
   */
  private showConflictWarning(otherTabCount: number): void {
    // Check if warning already exists
    if (document.getElementById('tab-conflict-warning')) {
      return;
    }

    const warning = document.createElement('div');
    warning.id = 'tab-conflict-warning';
    warning.className =
      'fixed top-20 left-4 right-4 z-50 alert alert-warning shadow-lg';
    warning.innerHTML = `
      <div>
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <div>
          <strong>Multiple GTFS.zone tabs detected</strong>
          <div class="text-sm mt-1">
            ${otherTabCount} other tab${otherTabCount > 1 ? 's are' : ' is'} open.
            This may cause data conflicts or unexpected behavior.
          </div>
          <div class="mt-2 flex gap-2">
            <button class="btn btn-sm btn-warning" id="close-other-tabs">Close Other Tabs</button>
            <button class="btn btn-sm btn-outline" id="dismiss-warning">Dismiss</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(warning);

    // Add event listeners
    const closeOtherBtn = warning.querySelector(
      '#close-other-tabs'
    ) as HTMLButtonElement;
    const dismissBtn = warning.querySelector(
      '#dismiss-warning'
    ) as HTMLButtonElement;

    closeOtherBtn.addEventListener('click', () => {
      this.requestCloseOtherTabs();
      this.dismissWarning();
    });

    dismissBtn.addEventListener('click', () => {
      this.dismissWarning();
    });

    // Auto-dismiss after 15 seconds
    setTimeout(() => {
      if (document.getElementById('tab-conflict-warning')) {
        this.dismissWarning();
      }
    }, 15000);
  }

  /**
   * Request other tabs to close themselves
   */
  private requestCloseOtherTabs(): void {
    try {
      // Set a close request in localStorage
      const closeRequest = {
        requester: this.TAB_ID,
        timestamp: Date.now(),
      };
      localStorage.setItem(
        'gtfs_zone_close_request',
        JSON.stringify(closeRequest)
      );

      // Remove the request after a short delay
      setTimeout(() => {
        localStorage.removeItem('gtfs_zone_close_request');
      }, 2000);
    } catch (error) {
      console.warn('Failed to request tab closure:', error);
    }
  }

  /**
   * Check if this tab should close itself
   */
  private checkCloseRequest(): void {
    try {
      const stored = localStorage.getItem('gtfs_zone_close_request');
      if (!stored) {
        return;
      }

      const request = JSON.parse(stored);

      // If another tab requested closure and it's not from this tab
      if (request.requester !== this.TAB_ID) {
        this.showCloseConfirmation();
      }
    } catch (error) {
      console.warn('Failed to check close request:', error);
    }
  }

  /**
   * Show confirmation dialog for closing this tab
   */
  private showCloseConfirmation(): void {
    const modal = document.createElement('div');
    modal.className = 'modal modal-open';
    modal.innerHTML = `
      <div class="modal-box">
        <h3 class="font-bold text-lg">Close This Tab?</h3>
        <div class="py-4">
          <p>Another GTFS.zone tab has requested to close duplicate tabs to prevent conflicts.</p>
          <div class="alert alert-info mt-3">
            <div class="text-sm">
              Closing this tab will help prevent data conflicts and ensure the best experience.
            </div>
          </div>
        </div>
        <div class="modal-action">
          <button class="btn btn-primary" id="confirm-close">Close This Tab</button>
          <button class="btn btn-outline" id="keep-open">Keep Open</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const confirmBtn = modal.querySelector(
      '#confirm-close'
    ) as HTMLButtonElement;
    const keepOpenBtn = modal.querySelector('#keep-open') as HTMLButtonElement;

    confirmBtn.addEventListener('click', () => {
      window.close();
    });

    keepOpenBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  }

  /**
   * Dismiss the conflict warning
   */
  private dismissWarning(): void {
    const warning = document.getElementById('tab-conflict-warning');
    if (warning) {
      document.body.removeChild(warning);
    }
  }

  /**
   * Get current tab information
   */
  getTabInfo(): { id: string; activeTabCount: number } {
    const tabs = this.getActiveTabs();
    return {
      id: this.TAB_ID,
      activeTabCount: Object.keys(tabs).length,
    };
  }

  /**
   * Check if there are conflicts
   */
  hasConflicts(): boolean {
    const tabs = this.getActiveTabs();
    return (
      Object.keys(tabs).filter((tabId) => tabId !== this.TAB_ID).length > 0
    );
  }

  /**
   * Manually check for close requests (call periodically)
   */
  checkForCloseRequests(): void {
    this.checkCloseRequest();
  }

  /**
   * Cleanup when tab is closing
   */
  private cleanup(): void {
    try {
      // Remove this tab from active tabs
      const tabs = this.getActiveTabs();
      delete tabs[this.TAB_ID];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tabs));

      // Clear heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
    } catch (error) {
      console.warn('Failed to cleanup tab tracking:', error);
    }
  }

  /**
   * Destroy the tab conflict manager
   */
  destroy(): void {
    this.cleanup();
    window.removeEventListener('storage', this.handleStorageChange.bind(this));
    window.removeEventListener('beforeunload', this.cleanup.bind(this));
  }
}

// Global singleton instance
export const tabConflictManager = new TabConflictManager();
