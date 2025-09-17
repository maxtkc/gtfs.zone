import { GTFSParser } from './modules/gtfs-parser.js';
import { MapController } from './modules/map-controller.js';
import { Editor } from './modules/editor.js';
import { UIController } from './modules/ui.js';
import './styles/main.css';

class GTFSEditor {
  constructor() {
    this.gtfsParser = new GTFSParser();
    this.mapController = new MapController();
    this.editor = new Editor();
    this.uiController = new UIController();
    
    this.init();
  }

  init() {
    // Initialize all modules
    this.mapController.initialize(this.gtfsParser);
    this.editor.initialize(this.gtfsParser);
    this.uiController.initialize(this.gtfsParser, this.editor, this.mapController);
    
    // Check for URL parameters
    this.uiController.checkURLParams();
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