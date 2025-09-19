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
import './styles/main.css';

class GTFSEditor {
  constructor() {
    this.gtfsParser = new GTFSParser();
    this.mapController = new MapController();
    this.editor = new Editor();
    this.uiController = new UIController();
    this.tabManager = new TabManager();
    this.relationships = new GTFSRelationships(this.gtfsParser);
    this.infoDisplay = new InfoDisplay(this.relationships);
    this.objectsNavigation = new ObjectsNavigation(this.relationships, this.mapController);
    this.searchController = new SearchController(this.gtfsParser, this.mapController);
    this.validator = new GTFSValidator(this.gtfsParser);
    this.keyboardShortcuts = new KeyboardShortcuts(this);
    
    this.init();
  }

  init() {
    try {
      // Initialize notification system
      notifications.initialize();
      
      // Initialize empty GTFS feed
      this.gtfsParser.initializeEmpty();
      
      // Initialize all modules
      this.mapController.initialize(this.gtfsParser);
      this.editor.initialize(this.gtfsParser);
      // Note: InfoDisplay is not used in the new UI structure
      this.uiController.initialize(this.gtfsParser, this.editor, this.mapController, this.objectsNavigation, () => this.validateAndUpdateInfo());
      
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
      notifications.showInfo('Welcome to gtfs.zone! Create a new GTFS feed or upload an existing one to get started.');
      
    } catch (error) {
      console.error('Failed to initialize application:', error);
      notifications.showError('Failed to initialize application. Please refresh the page and try again.');
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