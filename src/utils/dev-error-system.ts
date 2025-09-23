/**
 * Development Error Visibility System
 * Makes errors IMPOSSIBLE to miss during development
 */
export class DevErrorSystem {
  static isEnabled = false;
  static errorHistory: Record<string, unknown>[] = [];
  static overlay: HTMLElement | null = null;
  static originalConsoleError: ((...data: unknown[]) => void) | null = null;
  static originalConsoleWarn: ((...data: unknown[]) => void) | null = null;
  static notificationQueue: Record<string, unknown>[] = [];
  static lastErrorSound = 0;

  /**
   * Initialize the development error system
   * Only activates in development environment
   */
  static init() {
    // Only enable in development
    if (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === ''
    ) {
      this.isEnabled = true;
      this.setupGlobalErrorHandlers();
      this.setupConsoleInterception();
      this.createErrorOverlay();
      this.setupKeyboardShortcuts();
      console.log(
        '🚨 Development Error System ACTIVATED - Errors will be HIGHLY VISIBLE'
      );
    }
  }

  /**
   * Set up global error handlers to catch everything
   */
  static setupGlobalErrorHandlers() {
    // Catch unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError({
        type: 'JavaScript Error',
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        error: event.error,
        stack: event.error?.stack,
        critical: true,
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: 'Unhandled Promise Rejection',
        message: event.reason?.message || String(event.reason),
        error: event.reason,
        stack: event.reason?.stack,
        critical: true,
      });
    });

    // Catch console errors
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;

    console.error = (...args) => {
      this.originalConsoleError.apply(console, args);
      this.handleConsoleError('error', args);
    };

    console.warn = (...args) => {
      this.originalConsoleWarn.apply(console, args);
      this.handleConsoleError('warn', args);
    };
  }

  /**
   * Handle console errors and warnings
   */
  static handleConsoleError(level: string, args: unknown[]) {
    const message = args
      .map((arg: unknown) =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      )
      .join(' ');

    this.handleError({
      type: level === 'error' ? 'Console Error' : 'Console Warning',
      message,
      args,
      critical: level === 'error',
    });
  }

  /**
   * Main error handling function
   */
  static handleError(errorInfo: Record<string, unknown>) {
    if (!this.isEnabled) {
      return;
    }

    // Add to history
    const errorEntry = {
      ...errorInfo,
      timestamp: new Date(),
      id: Date.now() + Math.random(),
    };

    this.errorHistory.unshift(errorEntry);

    // Keep only last 50 errors
    if (this.errorHistory.length > 50) {
      this.errorHistory = this.errorHistory.slice(0, 50);
    }

    // Show visual notification
    this.showVisualNotification(errorEntry);

    // Play error sound for critical errors
    if (errorEntry.critical) {
      this.playErrorSound();
    }

    // Update overlay
    this.updateErrorOverlay();

    // Flash browser title for critical errors
    if (errorEntry.critical) {
      this.flashBrowserTitle();
    }

    // Auto-open overlay for critical errors
    if (errorEntry.critical && this.overlay) {
      this.showOverlay();
    }
  }

  /**
   * Create persistent error overlay
   */
  static createErrorOverlay() {
    // Create overlay container
    this.overlay = document.createElement('div');
    this.overlay.id = 'dev-error-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.95);
      color: white;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      z-index: 999999;
      display: none;
      overflow: auto;
      padding: 20px;
    `;

    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: between;
      align-items: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #ff4444;
      padding-bottom: 10px;
    `;

    const title = document.createElement('h1');
    title.textContent = '🚨 DEVELOPMENT ERRORS';
    title.style.cssText = `
      color: #ff4444;
      margin: 0;
      font-size: 24px;
      flex: 1;
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = '✕ Close (ESC)';
    closeButton.style.cssText = `
      background: #ff4444;
      color: white;
      border: none;
      padding: 10px 15px;
      cursor: pointer;
      font-family: inherit;
      font-size: 14px;
      border-radius: 4px;
    `;
    closeButton.onclick = () => this.hideOverlay();

    const clearButton = document.createElement('button');
    clearButton.textContent = '🗑️ Clear All';
    clearButton.style.cssText = `
      background: #666;
      color: white;
      border: none;
      padding: 10px 15px;
      cursor: pointer;
      font-family: inherit;
      font-size: 14px;
      border-radius: 4px;
      margin-right: 10px;
    `;
    clearButton.onclick = () => this.clearErrors();

    header.appendChild(title);
    header.appendChild(clearButton);
    header.appendChild(closeButton);

    // Create content area
    this.errorContent = document.createElement('div');
    this.errorContent.id = 'error-content';

    this.overlay.appendChild(header);
    this.overlay.appendChild(this.errorContent);
    document.body.appendChild(this.overlay);
  }

  /**
   * Update error overlay content
   */
  static updateErrorOverlay() {
    if (!this.errorContent) {
      return;
    }

    const criticalErrors = this.errorHistory.filter((e) => e.critical);
    const warnings = this.errorHistory.filter((e) => !e.critical);

    this.errorContent.innerHTML = `
      <div style="margin-bottom: 20px;">
        <div style="color: #ff4444; font-size: 18px; margin-bottom: 10px;">
          ❌ Critical Errors: ${criticalErrors.length}
        </div>
        <div style="color: #ffaa00; font-size: 18px;">
          ⚠️ Warnings: ${warnings.length}
        </div>
      </div>

      ${
        criticalErrors.length > 0
          ? `
        <div style="margin-bottom: 30px;">
          <h2 style="color: #ff4444; border-bottom: 1px solid #ff4444; padding-bottom: 5px;">
            🔥 CRITICAL ERRORS
          </h2>
          ${criticalErrors.map((error) => this.formatError(error)).join('')}
        </div>
      `
          : ''
      }

      ${
        warnings.length > 0
          ? `
        <div>
          <h2 style="color: #ffaa00; border-bottom: 1px solid #ffaa00; padding-bottom: 5px;">
            ⚠️ WARNINGS
          </h2>
          ${warnings.map((error) => this.formatError(error)).join('')}
        </div>
      `
          : ''
      }

      ${
        this.errorHistory.length === 0
          ? `
        <div style="text-align: center; color: #00ff00; font-size: 18px; margin-top: 50px;">
          ✅ NO ERRORS - ALL CLEAR!
        </div>
      `
          : ''
      }
    `;
  }

  /**
   * Format error for display
   */
  static formatError(error) {
    const timeStr = error.timestamp.toLocaleTimeString();
    const typeColor = error.critical ? '#ff4444' : '#ffaa00';

    return `
      <div style="
        margin-bottom: 20px; 
        padding: 15px; 
        background: rgba(255, 255, 255, 0.1); 
        border-left: 4px solid ${typeColor};
        border-radius: 4px;
      ">
        <div style="color: ${typeColor}; font-weight: bold; margin-bottom: 5px;">
          ${error.type} - ${timeStr}
        </div>
        <div style="margin-bottom: 10px; color: #fff; font-size: 16px;">
          ${this.escapeHtml(error.message)}
        </div>
        ${
          error.filename
            ? `
          <div style="color: #aaa; font-size: 12px; margin-bottom: 5px;">
            📁 ${error.filename}:${error.line}:${error.column}
          </div>
        `
            : ''
        }
        ${
          error.stack
            ? `
          <details style="margin-top: 10px;">
            <summary style="color: #ccc; cursor: pointer;">Stack Trace</summary>
            <pre style="
              margin: 10px 0 0 0; 
              padding: 10px; 
              background: rgba(0,0,0,0.5); 
              border-radius: 4px;
              white-space: pre-wrap;
              font-size: 12px;
              color: #ddd;
            ">${this.escapeHtml(error.stack)}</pre>
          </details>
        `
            : ''
        }
      </div>
    `;
  }

  /**
   * Show visual notification for new errors
   */
  static showVisualNotification(error) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${error.critical ? '#ff4444' : '#ffaa00'};
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      font-weight: bold;
      z-index: 1000000;
      max-width: 400px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      animation: slideIn 0.3s ease-out;
      cursor: pointer;
    `;

    // Add CSS animation
    if (!document.getElementById('dev-error-animations')) {
      const style = document.createElement('style');
      style.id = 'dev-error-animations';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      `;
      document.head.appendChild(style);
    }

    const icon = error.critical ? '🔥' : '⚠️';
    const truncatedMessage =
      error.message.length > 80
        ? error.message.substring(0, 80) + '...'
        : error.message;

    notification.innerHTML = `
      <div style="margin-bottom: 5px;">
        ${icon} ${error.type}
      </div>
      <div style="font-weight: normal; font-size: 12px;">
        ${this.escapeHtml(truncatedMessage)}
      </div>
      <div style="font-size: 10px; margin-top: 5px; opacity: 0.8;">
        Click to view details
      </div>
    `;

    // Click to open overlay
    notification.onclick = () => {
      this.showOverlay();
      notification.remove();
    };

    document.body.appendChild(notification);

    // Auto-remove after delay
    setTimeout(
      () => {
        if (notification.parentNode) {
          notification.style.animation = 'slideOut 0.3s ease-in';
          setTimeout(() => notification.remove(), 300);
        }
      },
      error.critical ? 10000 : 5000
    );

    // Shake effect for critical errors
    if (error.critical) {
      notification.style.animation += ', shake 0.5s ease-in-out 0.3s';
    }
  }

  /**
   * Play error sound for critical errors
   */
  static playErrorSound() {
    const now = Date.now();
    // Limit sound frequency to avoid spam
    if (now - this.lastErrorSound < 1000) {
      return;
    }
    this.lastErrorSound = now;

    // Create audio context for error sound
    try {
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Error sound: 3 quick beeps
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime + 0.2);

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch {
      // Fallback: try to play system beep
      console.log('\u0007'); // Bell character
    }
  }

  /**
   * Flash browser title for critical errors
   */
  static flashBrowserTitle() {
    const originalTitle = document.title;
    let flashCount = 0;
    const maxFlashes = 6;

    const flashInterval = setInterval(() => {
      document.title = flashCount % 2 === 0 ? '🚨 ERROR! 🚨' : originalTitle;
      flashCount++;

      if (flashCount >= maxFlashes) {
        clearInterval(flashInterval);
        document.title = originalTitle;
      }
    }, 500);
  }

  /**
   * Set up keyboard shortcuts
   */
  static setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      // ESC to close overlay
      if (event.key === 'Escape' && this.overlay.style.display !== 'none') {
        this.hideOverlay();
      }

      // Ctrl+Shift+E to toggle overlay
      if (event.ctrlKey && event.shiftKey && event.key === 'E') {
        event.preventDefault();
        this.toggleOverlay();
      }

      // Ctrl+Shift+C to clear errors
      if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        event.preventDefault();
        this.clearErrors();
      }
    });
  }

  /**
   * Show error overlay
   */
  static showOverlay() {
    if (this.overlay) {
      this.overlay.style.display = 'block';
      this.updateErrorOverlay();
    }
  }

  /**
   * Hide error overlay
   */
  static hideOverlay() {
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
  }

  /**
   * Toggle error overlay
   */
  static toggleOverlay() {
    if (this.overlay) {
      const isVisible = this.overlay.style.display !== 'none';
      if (isVisible) {
        this.hideOverlay();
      } else {
        this.showOverlay();
      }
    }
  }

  /**
   * Clear all errors
   */
  static clearErrors() {
    this.errorHistory = [];
    this.updateErrorOverlay();
    console.log('🧹 Dev Error System: All errors cleared');
  }

  /**
   * Get error statistics
   */
  static getStats() {
    const critical = this.errorHistory.filter((e) => e.critical).length;
    const warnings = this.errorHistory.filter((e) => !e.critical).length;
    return { critical, warnings, total: this.errorHistory.length };
  }

  /**
   * Setup console interception for better visibility
   */
  static setupConsoleInterception() {
    // Make console errors more visible
    const style = document.createElement('style');
    style.textContent = `
      /* Make console more visible in dev tools */
      .console-error-level .console-message-text {
        background: #ff4444 !important;
        color: white !important;
        font-weight: bold !important;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Utility to escape HTML
   */
  static escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Add floating error counter
   */
  static createFloatingCounter() {
    const counter = document.createElement('div');
    counter.id = 'error-counter';
    counter.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #ff4444;
      color: white;
      padding: 10px 15px;
      border-radius: 25px;
      font-family: 'Courier New', monospace;
      font-weight: bold;
      font-size: 14px;
      z-index: 999998;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      display: none;
    `;

    counter.onclick = () => this.showOverlay();
    document.body.appendChild(counter);

    // Update counter
    const updateCounter = () => {
      const stats = this.getStats();
      if (stats.total > 0) {
        counter.textContent = `🚨 ${stats.critical} errors, ${stats.warnings} warnings`;
        counter.style.display = 'block';
      } else {
        counter.style.display = 'none';
      }
    };

    // Update counter every second
    setInterval(updateCounter, 1000);
    updateCounter();
  }
}

// Auto-initialize when module is loaded
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      DevErrorSystem.init();
      DevErrorSystem.createFloatingCounter();
    });
  } else {
    DevErrorSystem.init();
    DevErrorSystem.createFloatingCounter();
  }
}
