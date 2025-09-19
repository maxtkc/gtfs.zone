import { GTFSParser } from './modules/gtfs-parser.js';
import { MapController } from './modules/map-controller.js';
import { Editor } from './modules/editor.js';
import { UIController } from './modules/ui.js';
import { TabManager } from './modules/tab-manager.js';
import { GTFSRelationships } from './modules/gtfs-relationships.js';
import { ObjectsNavigation } from './modules/objects-navigation.js';
import { InfoDisplay } from './modules/info-display.js';
import { SearchController } from './modules/search-controller.js';
import { GTFSValidator } from './modules/gtfs-validator.js';
import { KeyboardShortcuts } from './modules/keyboard-shortcuts.js';
import { notifications } from './modules/notification-system.js';
import { ErrorHandler } from './utils/error-handler.js';
import './styles/main.css';

// Initialize HIGHLY VISIBLE development error system FIRST
if (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
) {
  console.log(
    '🚨 DEVELOPMENT ERROR SYSTEM ACTIVATED - ERRORS WILL BE HIGHLY VISIBLE'
  );

  // Set up global error handlers
  window.addEventListener('error', (event) => {
    console.error('🔥 GLOBAL ERROR CAUGHT:', event.error);
    showErrorNotification(`JavaScript Error: ${event.message}`, true);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('🔥 UNHANDLED PROMISE REJECTION:', event.reason);
    showErrorNotification(
      `Promise Rejection: ${event.reason?.message || event.reason}`,
      true
    );
  });

  // Intercept console.error for visual notifications
  const originalConsoleError = console.error;
  console.error = (...args) => {
    originalConsoleError.apply(console, args);
    const message = args
      .map((arg) =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      )
      .join(' ');
    showErrorNotification(`Console Error: ${message}`, true);
  };

  // Create error notification function
  window.showErrorNotification = function (message, isError = false) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${isError ? '#ff4444' : '#ffaa00'};
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      font-weight: bold;
      z-index: 1000000;
      max-width: 400px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      animation: slideInRight 0.3s ease-out;
      cursor: pointer;
      word-wrap: break-word;
    `;

    // Add CSS animation if not exists
    if (!document.getElementById('error-animations')) {
      const style = document.createElement('style');
      style.id = 'error-animations';
      style.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
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

    const icon = isError ? '🔥' : '⚠️';
    const truncatedMessage =
      message.length > 120 ? message.substring(0, 120) + '...' : message;

    notification.innerHTML = `
      <div style="margin-bottom: 5px;">
        ${icon} ${isError ? 'CRITICAL ERROR' : 'WARNING'}
      </div>
      <div style="font-weight: normal; font-size: 12px; line-height: 1.4;">
        ${truncatedMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </div>
      <div style="font-size: 10px; margin-top: 5px; opacity: 0.8;">
        Click to dismiss
      </div>
    `;

    // Click to remove
    notification.onclick = () => {
      notification.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => notification.remove(), 300);
    };

    document.body.appendChild(notification);

    // Auto-remove after delay
    setTimeout(
      () => {
        if (notification.parentNode) {
          notification.style.animation = 'slideOutRight 0.3s ease-in';
          setTimeout(() => notification.remove(), 300);
        }
      },
      isError ? 10000 : 5000
    );

    // Shake effect for critical errors
    if (isError) {
      notification.style.animation += ', shake 0.5s ease-in-out 0.3s';

      // Flash browser title
      const originalTitle = document.title;
      let flashCount = 0;
      const flashInterval = setInterval(() => {
        document.title = flashCount % 2 === 0 ? '🚨 ERROR! 🚨' : originalTitle;
        flashCount++;
        if (flashCount >= 6) {
          clearInterval(flashInterval);
          document.title = originalTitle;
        }
      }, 500);
    }
  };

  // Test functions available globally
  window.testError = () => {
    console.error('🧪 Test Error: This is a test error message');
  };

  window.testRuntimeError = () => {
    nonExistentFunction(); // This will throw
  };

  window.testPromiseError = () => {
    new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error('Test Promise Rejection')), 100);
    });
  };

  console.log('💡 Error testing functions available:');
  console.log('  - testError() - Test console error');
  console.log('  - testRuntimeError() - Test JavaScript runtime error');
  console.log('  - testPromiseError() - Test promise rejection');
}

class GTFSEditor {
  constructor() {
    this.gtfsParser = new GTFSParser();
    this.mapController = new MapController();
    this.editor = new Editor();
    this.uiController = new UIController();
    this.tabManager = new TabManager();
    this.relationships = new GTFSRelationships(this.gtfsParser);
    this.infoDisplay = new InfoDisplay(this.relationships);
    this.objectsNavigation = new ObjectsNavigation(
      this.relationships,
      this.mapController
    );
    this.searchController = new SearchController(
      this.gtfsParser,
      this.mapController
    );
    this.validator = new GTFSValidator(this.gtfsParser);
    this.keyboardShortcuts = new KeyboardShortcuts(this);

    this.init();
  }

  init() {
    try {
      // Initialize notification system
      notifications.initialize();

      // Connect ErrorHandler to notification system for visible errors
      ErrorHandler.setNotificationCallback((message, type) => {
        notifications.show(message, type, type === 'error' ? 8000 : 5000);
      });

      // Initialize empty GTFS feed
      this.gtfsParser.initializeEmpty();

      // Initialize all modules
      this.mapController.initialize(this.gtfsParser);
      this.editor.initialize(this.gtfsParser);
      // Note: InfoDisplay is not used in the new UI structure
      this.uiController.initialize(
        this.gtfsParser,
        this.editor,
        this.mapController,
        this.objectsNavigation,
        () => this.validateAndUpdateInfo()
      );

      // Initialize Objects navigation
      this.objectsNavigation.initialize('objects-navigation');

      // Set up circular reference
      this.objectsNavigation.uiController = this.uiController;

      // Initialize search controller
      this.searchController.initialize();

      // Initialize keyboard shortcuts
      this.keyboardShortcuts.initialize();

      // Initialize tab manager
      this.tabManager.initialize();

      // Run initial validation and update InfoDisplay
      this.validateAndUpdateInfo();

      // Hide welcome overlay since we always have a feed now
      const overlay = document.getElementById('map-overlay');
      if (overlay) {
        overlay.style.display = 'none';
      }

      // Check for URL parameters
      this.uiController.checkURLParams();

      // Show welcome notification
      notifications.showInfo(
        'Welcome to gtfs.zone! Create a new GTFS feed or upload an existing one to get started.'
      );
    } catch (error) {
      console.error('Failed to initialize application:', error);
      notifications.showError(
        'Failed to initialize application. Please refresh the page and try again.'
      );
    }
  }

  validateAndUpdateInfo() {
    // Run validation
    const validationResults = this.validator.validateFeed();

    // Note: InfoDisplay is not used in the new UI structure
    // Validation results are displayed in the object details view when relevant

    return validationResults;
  }
}

// Initialize the application
function initializeApp() {
  window.gtfsEditor = new GTFSEditor();
}

if (document.readyState === 'loading') {
  // DOM is still loading, wait for DOMContentLoaded
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM is already loaded, initialize immediately
  initializeApp();
}
