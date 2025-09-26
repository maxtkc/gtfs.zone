import { GTFSParser } from './modules/gtfs-parser';
import { MapController } from './modules/map-controller';
import { Editor } from './modules/editor';
import { UIController } from './modules/ui';
import { TabManager } from './modules/tab-manager';
import { GTFSRelationships } from './modules/gtfs-relationships';
import { ObjectsNavigation } from './modules/objects-navigation';
import { InfoDisplay } from './modules/info-display';
import { SearchController } from './modules/search-controller';
import { GTFSValidator } from './modules/gtfs-validator';
import { KeyboardShortcuts } from './modules/keyboard-shortcuts';
import { FieldDescriptionsDisplay } from './modules/field-descriptions';
import { ScheduleController } from './modules/schedule-controller';
import { ThemeController } from './modules/theme-controller';
import { notifications } from './modules/notification-system';
import {
  initializePageStateWithGTFS,
  updateBreadcrumbLookup,
} from './modules/page-state-integration';
import { PageStateManager } from './modules/page-state-manager';
import { navigateToTimetable } from './modules/navigation-actions';
import './styles/main.css';

declare global {
  interface Window {
    gtfsEditor: GTFSEditor;
  }
}

export class GTFSEditor {
  public gtfsParser: GTFSParser;
  public mapController: MapController;
  public editor: Editor;
  public uiController: UIController;
  public tabManager: TabManager;
  public relationships: GTFSRelationships;
  public infoDisplay: InfoDisplay;
  public objectsNavigation: ObjectsNavigation;
  public searchController: SearchController;
  public validator: GTFSValidator;
  public keyboardShortcuts: KeyboardShortcuts;
  public fieldDescriptions: FieldDescriptionsDisplay;
  public scheduleController: ScheduleController;
  public themeController: ThemeController;
  public pageStateManager: PageStateManager;

  constructor() {
    this.gtfsParser = new GTFSParser();
    this.mapController = new MapController();
    this.editor = new Editor();
    this.uiController = new UIController();
    this.tabManager = new TabManager();
    this.relationships = new GTFSRelationships(this.gtfsParser);
    this.infoDisplay = new InfoDisplay(this.relationships);
    this.scheduleController = new ScheduleController(
      this.relationships,
      this.gtfsParser
    );
    this.objectsNavigation = new ObjectsNavigation(
      this.relationships,
      this.mapController,
      this.scheduleController
    );
    this.searchController = new SearchController(
      this.gtfsParser,
      this.mapController
    );
    this.validator = new GTFSValidator(this.gtfsParser);
    this.keyboardShortcuts = new KeyboardShortcuts(this);
    this.fieldDescriptions = FieldDescriptionsDisplay.integrate();
    this.themeController = new ThemeController();

    // Initialize PageStateManager (will be fully set up after GTFS parser initialization)
    this.pageStateManager = initializePageStateWithGTFS(this.gtfsParser);

    this.init().catch((error) => {
      console.error('Failed to initialize GTFSEditor:', error);
      notifications.showError(
        'Failed to initialize application. Please refresh the page and try again.'
      );
    });
  }

  private async init(): Promise<void> {
    try {
      // Initialize notification system
      notifications.initialize();

      // Initialize GTFSParser database
      await this.gtfsParser.initialize();

      // Initialize empty GTFS feed
      await this.gtfsParser.initializeEmpty();

      // Initialize all modules
      this.mapController.initialize(this.gtfsParser);
      this.mapController.setPageStateManager(this.pageStateManager);
      this.editor.initialize(this.gtfsParser);

      // Note: InfoDisplay is not used in the new UI structure
      this.uiController.initialize(
        this.gtfsParser,
        this.editor,
        this.mapController,
        this.objectsNavigation,
        this.scheduleController,
        this.validateAndUpdateInfo.bind(this)
      );

      // Initialize Objects navigation
      this.objectsNavigation.initialize('objects-navigation');

      // Set up circular references
      this.objectsNavigation.uiController = this.uiController;
      this.objectsNavigation.scheduleController = this.scheduleController;

      // Initialize search controller
      this.searchController.initialize();

      // Initialize keyboard shortcuts
      this.keyboardShortcuts.initialize();

      // Initialize theme controller
      this.themeController.initialize();

      // Initialize tab manager
      this.tabManager.initialize();

      // Set up navigation event listener for automatic tab switching
      this.setupNavigationTabSwitching();

      // Run initial validation and update InfoDisplay
      this.validateAndUpdateInfo();

      // Hide welcome overlay since we always have a feed now
      const overlay = document.getElementById('map-overlay');
      if (overlay) {
        overlay.style.display = 'none';
      }

      // Initialize PageStateManager from URL
      await this.pageStateManager.initializeFromURL();

      // Check for URL parameters (legacy support)
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

  public validateAndUpdateInfo(): void {
    // Run validation
    const validationResults = this.validator.validateFeed();

    // Note: InfoDisplay is not used in the new UI structure
    // Validation results are displayed in the object details view when relevant

    return validationResults;
  }

  /**
   * Set up navigation event listener to automatically switch tabs based on PageState changes
   */
  private setupNavigationTabSwitching(): void {
    this.pageStateManager.addNavigationHandler((event) => {
      const { to } = event;

      // Switch to Objects tab for route and stop navigation
      if (to.type === 'route' || to.type === 'stop') {
        this.tabManager.switchToTab('objects');
      }
      // Add other tab switching logic here if needed
      // For example:
      // - 'home' might switch to 'files' tab
      // - 'timetable' might switch to 'schedule' tab
    });
  }

  /**
   * Call this method when GTFS data is reloaded to update breadcrumb lookup cache
   */
  public onGTFSDataReloaded(): void {
    updateBreadcrumbLookup(this.gtfsParser);
  }

  // Navigation helper methods for global access
  async navigateToTimetable(
    routeId: string,
    serviceId: string,
    directionId?: string
  ): Promise<void> {
    await navigateToTimetable(routeId, serviceId, directionId);
  }
}

// Initialize the application
function initializeApp(): void {
  window.gtfsEditor = new GTFSEditor();
}

if (document.readyState === 'loading') {
  // DOM is still loading, wait for DOMContentLoaded
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM is already loaded, initialize immediately
  initializeApp();
}
