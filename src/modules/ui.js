
import { notifications } from './notification-system.js';

export class UIController {
  constructor() {
    this.gtfsParser = null;
    this.editor = null;
    this.mapController = null;
    this.objectsNavigation = null;
    this.validateCallback = null;
  }

  initialize(gtfsParser, editor, mapController, objectsNavigation, validateCallback = null) {
    this.gtfsParser = gtfsParser;
    this.editor = editor;
    this.mapController = mapController;
    this.objectsNavigation = objectsNavigation;
    this.validateCallback = validateCallback;
    this.setupEventListeners();
    this.initializeTabs();
  }

  setupEventListeners() {
    // Upload button
    document.getElementById('upload-btn').addEventListener('click', () => {
      document.getElementById('file-input').click();
    });

    // File input
    document.getElementById('file-input').addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.loadGTFSFile(e.target.files[0]);
      }
    });

    // Export button
    document.getElementById('export-btn').addEventListener('click', () => {
      this.exportGTFS();
    });

    // New GTFS feed button
    document.getElementById('new-btn').addEventListener('click', () => {
      this.createNewFeed();
    });

    // Help button
    const helpBtn = document.getElementById('help-btn');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => {
        this.showHelpPanel();
      });
    }

    // Back to files button
    const backToFilesBtn = document.getElementById('back-to-files');
    if (backToFilesBtn) {
      backToFilesBtn.addEventListener('click', () => {
        this.showFileList();
      });
    }

    // Back to objects button
    const backToObjectsBtn = document.getElementById('back-to-objects');
    if (backToObjectsBtn) {
      backToObjectsBtn.addEventListener('click', () => {
        this.showObjectsList();
      });
    }

    // Panel toggle buttons
    const toggleLeftBtn = document.getElementById('toggle-left-panel');
    if (toggleLeftBtn) {
      toggleLeftBtn.addEventListener('click', () => {
        this.toggleLeftPanel();
      });
    }

    const closeLeftBtn = document.getElementById('close-left-panel');
    if (closeLeftBtn) {
      closeLeftBtn.addEventListener('click', () => {
        this.hideLeftPanel();
      });
    }

    const closeRightBtn = document.getElementById('close-right-panel');
    if (closeRightBtn) {
      closeRightBtn.addEventListener('click', () => {
        this.hideRightPanel();
      });
    }

    const viewToggle = document.getElementById('view-toggle-checkbox');
    if (viewToggle) {
      viewToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.editor.switchToTableView();
        } else {
          this.editor.switchToTextView();
        }
      });
    }

    // Add click handlers for the toggle text options using event delegation
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('toggle-text')) {
        const viewToggle = document.getElementById('view-toggle-checkbox');
        if (viewToggle) {
          const view = e.target.dataset.view;
          if (view === 'text') {
            viewToggle.checked = false;
            this.editor.switchToTextView();
          } else if (view === 'table') {
            viewToggle.checked = true;
            this.editor.switchToTableView();
          }
        }
      }
    });

    // Drag and drop
    const body = document.body;
    body.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    body.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].name.endsWith('.zip')) {
        this.loadGTFSFile(files[0]);
      }
    });
  }


  showHelpPanel() {
    const helpTab = document.querySelector('[data-tab="help"]');
    if (helpTab) {
      helpTab.click();
    }
  }

  initializeTabs() {
    // Initialize tab functionality
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-btn')) {
        this.switchTab(e.target);
      }
    });
  }

  switchTab(button) {
    const tabId = button.dataset.tab;
    const panel = button.closest('.left-panel, .right-panel');
    
    if (!panel) return;
    
    // Remove active state from all tabs in this panel
    panel.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
      btn.classList.add('text-gray-500', 'border-transparent');
      btn.classList.remove('text-gray-900', 'border-blue-500');
    });
    
    // Hide all tab content in this panel
    panel.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });
    
    // Activate clicked tab
    button.classList.add('active');
    button.classList.remove('text-gray-500', 'border-transparent');
    button.classList.add('text-gray-900', 'border-blue-500');
    
    // Show corresponding content
    const content = document.getElementById(`${tabId}-tab`);
    if (content) {
      content.classList.remove('hidden');
    }
    
    // If switching to Objects tab, refresh the navigation
    if (tabId === 'objects' && this.objectsNavigation) {
      this.objectsNavigation.refresh();
    }
  }

  async loadGTFSFile(file) {
    let loadingNotificationId = null;
    
    try {
      console.log('Loading GTFS file:', file.name);

      // Show loading notification
      loadingNotificationId = notifications.showLoading(`Loading GTFS file: ${file.name}`);
      
      // Show loading state on map
      this.mapController.showLoading();

      // Validate file type
      if (!file.name.toLowerCase().endsWith('.zip')) {
        throw new Error('Please upload a ZIP file containing GTFS data');
      }

      // Check file size (warn if > 50MB)
      if (file.size > 50 * 1024 * 1024) {
        notifications.showWarning('Large file detected. Processing may take a moment...');
      }

      // Parse the file
      await this.gtfsParser.parseFile(file);

      // Update UI
      this.updateFileList();
      this.mapController.updateMap();
      this.mapController.hideMapOverlay();
      
      // Show files tab
      this.showFileList();
      
      // Refresh Objects navigation if available
      if (this.objectsNavigation) {
        this.objectsNavigation.refresh();
      }

      // Run validation if callback is available
      if (this.validateCallback) {
        this.validateCallback();
      }

      // Enable export button
      document.getElementById('export-btn').disabled = false;

      // Remove loading notification and show success
      if (loadingNotificationId) {
        notifications.removeNotification(loadingNotificationId);
      }
      notifications.showSuccess(`Successfully loaded GTFS file: ${file.name}`);
      
    } catch (error) {
      console.error('Error loading GTFS file:', error);
      
      // Remove loading notification
      if (loadingNotificationId) {
        notifications.removeNotification(loadingNotificationId);
      }
      
      // Show error notification with helpful message
      let errorMessage = 'Failed to load GTFS file';
      if (error.message) {
        errorMessage += `: ${error.message}`;
      }
      
      notifications.showError(errorMessage, {
        actions: [
          {
            id: 'retry',
            label: 'Try Again',
            primary: true,
            handler: () => {
              document.getElementById('file-input').click();
            }
          }
        ]
      });
      
      this.mapController.hideMapOverlay();
    }
  }

  async loadGTFSFromURL(url) {
    let loadingNotificationId = null;
    
    try {
      console.log('Loading GTFS from URL:', url);
      
      // Show loading notification
      loadingNotificationId = notifications.showLoading(`Loading GTFS from URL: ${url}`);
      
      this.mapController.showLoading();

      await this.gtfsParser.parseFromURL(url);

      // Update UI
      this.updateFileList();
      this.mapController.updateMap();
      this.mapController.hideMapOverlay();
      
      // Refresh Objects navigation if available
      if (this.objectsNavigation) {
        this.objectsNavigation.refresh();
      }

      // Run validation if callback is available
      if (this.validateCallback) {
        this.validateCallback();
      }

      // Enable export button
      document.getElementById('export-btn').disabled = false;

      // Remove loading notification and show success
      if (loadingNotificationId) {
        notifications.removeNotification(loadingNotificationId);
      }
      notifications.showSuccess(`Successfully loaded GTFS from URL`);
      
    } catch (error) {
      console.error('Error loading GTFS from URL:', error);
      
      // Remove loading notification
      if (loadingNotificationId) {
        notifications.removeNotification(loadingNotificationId);
      }
      
      // Show error notification with helpful message
      let errorMessage = 'Failed to load GTFS from URL';
      if (error.message) {
        errorMessage += `: ${error.message}`;
      }
      
      notifications.showError(errorMessage, {
        actions: [
          {
            id: 'help',
            label: 'Need Help?',
            handler: () => {
              // Switch to help tab
              const helpTab = document.querySelector('[data-tab="help"]');
              if (helpTab) {
                helpTab.click();
              }
            }
          }
        ]
      });
      
      this.mapController.hideMapOverlay();
    }
  }

  updateFileList() {
    const fileList = document.getElementById('file-list');
    fileList.innerHTML = '';

    // Get categorized files
    const { required, optional, other } = this.gtfsParser.categorizeFiles();

    // Add required files section
    if (required.length > 0) {
      const requiredHeader = document.createElement('div');
      requiredHeader.className = 'section-header';
      requiredHeader.textContent = 'Required Files';
      fileList.appendChild(requiredHeader);

      required.forEach((fileName) => {
        this.addFileItem(fileList, fileName, true);
      });
    }

    // Add optional files section
    if (optional.length > 0) {
      const optionalHeader = document.createElement('div');
      optionalHeader.className = 'section-header';
      optionalHeader.textContent = 'Optional Files';
      fileList.appendChild(optionalHeader);

      optional.forEach((fileName) => {
        this.addFileItem(fileList, fileName, false);
      });
    }

    // Add other files section
    if (other.length > 0) {
      const otherHeader = document.createElement('div');
      otherHeader.className = 'section-header';
      otherHeader.textContent = 'Other Files';
      fileList.appendChild(otherHeader);

      other.forEach((fileName) => {
        this.addFileItem(fileList, fileName, false);
      });
    }

    // Enable export button if we have files
    const hasFiles = required.length > 0 || optional.length > 0 || other.length > 0;
    document.getElementById('export-btn').disabled = !hasFiles;
  }

  addFileItem(container, fileName, isRequired) {
    const item = document.createElement('div');
    item.className = `file-item ${isRequired ? 'required' : ''}`;
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = fileName;
    item.appendChild(nameSpan);

    // Add record count if available
    const data = this.gtfsParser.getFileData(fileName);
    if (data) {
      const count = Array.isArray(data) ? data.length : 1;
      const countSpan = document.createElement('span');
      countSpan.className = 'file-count';
      countSpan.textContent = `${count}`;
      item.appendChild(countSpan);
    }

    item.addEventListener('click', (event) => {
      this.openFile(fileName, event.currentTarget);
    });

    container.appendChild(item);
  }

  openFile(fileName, clickedElement = null) {
    if (!this.gtfsParser.getFileContent(fileName)) {
      return;
    }

    // Update active file styling
    document.querySelectorAll('.file-item').forEach((item) => {
      item.classList.remove('active');
    });
    if (clickedElement) {
      clickedElement.classList.add('active');
    }

    // Show file editor view
    this.showFileEditor(fileName);

    // Update map if it's a spatial file
    if (fileName === 'stops.txt' || fileName === 'shapes.txt') {
      this.mapController.highlightFileData(fileName);
    }
  }

  showFileList() {
    const listView = document.getElementById('file-list-view');
    const editorView = document.getElementById('file-editor-view');
    if (listView && editorView) {
      listView.classList.remove('hidden');
      editorView.classList.add('hidden');
    }
  }

  showFileEditor(fileName) {
    const listView = document.getElementById('file-list-view');
    const editorView = document.getElementById('file-editor-view');
    if (listView && editorView) {
      listView.classList.add('hidden');
      editorView.classList.remove('hidden');
      
      // Update file name display
      const currentFileNameEl = document.getElementById('current-file-name');
      if (currentFileNameEl) {
        currentFileNameEl.textContent = fileName;
      }
      
      // Open file in editor
      this.editor.openFile(fileName);
    }
  }

  showObjectsList() {
    const listView = document.getElementById('objects-list-view');
    const detailsView = document.getElementById('object-details-view');
    if (listView && detailsView) {
      listView.classList.remove('hidden');
      detailsView.classList.add('hidden');
    }
  }

  showObjectDetails(objectType, objectData, relatedObjects = []) {
    const listView = document.getElementById('objects-list-view');
    const detailsView = document.getElementById('object-details-view');
    if (listView && detailsView) {
      listView.classList.add('hidden');
      detailsView.classList.remove('hidden');
      
      // Update object info
      const objectTypeEl = document.getElementById('object-type');
      const objectNameEl = document.getElementById('object-name');
      if (objectTypeEl && objectNameEl) {
        objectTypeEl.textContent = objectType;
        objectNameEl.textContent = objectData.agency_name || objectData.route_short_name || objectData.stop_name || objectData.trip_id || 'Unknown';
      }
      
      // Populate properties
      this.populateObjectProperties(objectData);
      
      // Populate related objects
      this.populateRelatedObjects(relatedObjects);
    }
  }

  populateObjectProperties(objectData) {
    const container = document.getElementById('object-properties');
    if (!container) return;
    
    container.innerHTML = '';
    
    Object.entries(objectData).forEach(([key, value]) => {
      const propertyEl = document.createElement('div');
      propertyEl.className = 'flex flex-col gap-1';
      
      const labelEl = document.createElement('label');
      labelEl.className = 'text-xs font-medium text-secondary';
      labelEl.textContent = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      const inputEl = document.createElement('input');
      inputEl.className = 'text-sm px-2 py-1 border border-primary rounded focus:outline-none focus:ring-1 focus:ring-blue-500';
      inputEl.type = 'text';
      inputEl.value = value || '';
      inputEl.dataset.property = key;
      
      propertyEl.appendChild(labelEl);
      propertyEl.appendChild(inputEl);
      container.appendChild(propertyEl);
    });
  }

  populateRelatedObjects(relatedObjects) {
    const container = document.getElementById('related-objects');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (relatedObjects.length === 0) {
      const noRelatedEl = document.createElement('div');
      noRelatedEl.className = 'text-tertiary text-sm';
      noRelatedEl.textContent = 'No related objects';
      container.appendChild(noRelatedEl);
      return;
    }
    
    relatedObjects.forEach(obj => {
      const itemEl = document.createElement('div');
      itemEl.className = 'flex items-center justify-between p-2 bg-surface-secondary rounded cursor-pointer hover:bg-hover';
      
      const nameEl = document.createElement('span');
      nameEl.className = 'text-sm text-primary';
      nameEl.textContent = obj.name;
      
      const typeEl = document.createElement('span');
      typeEl.className = 'text-xs text-tertiary';
      typeEl.textContent = obj.type;
      
      itemEl.appendChild(nameEl);
      itemEl.appendChild(typeEl);
      
      itemEl.addEventListener('click', () => {
        this.showObjectDetails(obj.type, obj.data, obj.relatedObjects || []);
      });
      
      container.appendChild(itemEl);
    });
  }


  createNewFeed() {
    try {
      // Reset to empty GTFS feed
      this.gtfsParser.initializeEmpty();
      this.updateFileList();
      this.mapController.updateMap();
      
      // Clear editor
      this.editor.clearEditor();
      
      // Refresh Objects navigation if available
      if (this.objectsNavigation) {
        this.objectsNavigation.refresh();
      }

      // Run validation if callback is available
      if (this.validateCallback) {
        this.validateCallback();
      }
      
      notifications.showSuccess('New GTFS feed created with sample data!');
      console.log('Created new GTFS feed');
      
    } catch (error) {
      console.error('Error creating new GTFS feed:', error);
      notifications.showError(`Failed to create new GTFS feed: ${error.message}`);
    }
  }

  async exportGTFS() {
    let loadingNotificationId = null;
    
    try {
      if (!this.gtfsParser || this.gtfsParser.getAllFileNames().length === 0) {
        notifications.showWarning('No GTFS data to export. Please load a GTFS feed first.');
        return;
      }

      console.log('Exporting GTFS data...');

      // Show loading notification
      loadingNotificationId = notifications.showLoading('Preparing GTFS export...');

      // Save current file changes
      this.editor.saveCurrentFileChanges();

      // Generate ZIP blob
      const blob = await this.gtfsParser.exportAsZip();

      // Download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gtfs-modified.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Remove loading notification and show success
      if (loadingNotificationId) {
        notifications.removeNotification(loadingNotificationId);
      }
      notifications.showSuccess('GTFS data exported successfully!');
      
    } catch (error) {
      console.error('Error exporting GTFS:', error);
      
      // Remove loading notification
      if (loadingNotificationId) {
        notifications.removeNotification(loadingNotificationId);
      }
      
      notifications.showError(`Failed to export GTFS data: ${error.message}`);
    }
  }

  checkURLParams() {
    // Check for URL parameters to load GTFS data
    const hash = window.location.hash.substring(1);
    if (hash.startsWith('data=')) {
      const dataParam = hash.substring(5);

      if (dataParam.startsWith('url:')) {
        // Load from URL
        const url = dataParam.substring(4);
        this.loadGTFSFromURL(url);
      }
      // Future: support for base64, github, etc.
    }
  }
}