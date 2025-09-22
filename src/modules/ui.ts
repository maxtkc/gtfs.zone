import { notifications } from './notification-system';
import {
  getAgencyFieldDescription,
  getRouteFieldDescription,
  getCalendarFieldDescription,
  createTooltip,
  getSchemaFieldName,
} from '../utils/zod-tooltip-helper.js';

export class UIController {
  constructor() {
    this.gtfsParser = null;
    this.editor = null;
    this.mapController = null;
    this.objectsNavigation = null;
    this.scheduleController = null;
    this.validateCallback = null;
    this.breadcrumbTrail = []; // Track navigation path for breadcrumbs
  }

  initialize(
    gtfsParser,
    editor,
    mapController,
    objectsNavigation,
    scheduleController = null,
    validateCallback = null
  ) {
    this.gtfsParser = gtfsParser;
    this.editor = editor;
    this.mapController = mapController;
    this.objectsNavigation = objectsNavigation;
    this.scheduleController = scheduleController;
    this.validateCallback = validateCallback;
    this.setupEventListeners();
    this.initializeTabs();
  }

  setupEventListeners() {
    // DaisyUI handles dropdown toggle automatically via tabindex and focus

    // Empty button (same as New)
    document.getElementById('empty-btn')?.addEventListener('click', () => {
      this.createNewFeed();
      // DaisyUI dropdown will close automatically when button loses focus
    });

    // Upload button
    document.getElementById('upload-btn').addEventListener('click', () => {
      document.getElementById('file-input').click();
      // DaisyUI dropdown will close automatically when button loses focus
    });

    // Example buttons
    document
      .getElementById('example-columbia')
      ?.addEventListener('click', (e) => {
        const url = e.target.dataset.url;
        if (url) this.loadGTFSFromURL(url);
      });

    document.getElementById('example-west')?.addEventListener('click', (e) => {
      const url = e.target.dataset.url;
      if (url) this.loadGTFSFromURL(url);
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

    // Back to files button
    const backToFilesBtn = document.getElementById('back-to-files');
    if (backToFilesBtn) {
      backToFilesBtn.addEventListener('click', () => {
        this.showFileList();
      });
    }

    // Breadcrumb navigation is now handled dynamically in renderBreadcrumbs()

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

  initializeTabs() {
    // Initialize DaisyUI tab functionality
    // Listen for tab changes to handle special behaviors
    const radioInputs = document.querySelectorAll('input[name="main_tabs"]');
    radioInputs.forEach((radio) => {
      radio.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.checked) {
          const tabName = target.id.replace('-tab-radio', '');
          this.handleTabChange(tabName);
        }
      });
    });
  }

  handleTabChange(tabName: string) {
    // If switching to Objects tab, refresh the navigation
    if (tabName === 'objects' && this.objectsNavigation) {
      this.objectsNavigation.refresh();
    }
  }

  async loadGTFSFile(file) {
    let loadingNotificationId = null;

    try {
      console.log('Loading GTFS file:', file.name);

      // Show loading notification
      loadingNotificationId = notifications.showLoading(
        `Loading GTFS file: ${file.name}`
      );

      // Show loading state on map
      this.mapController.showLoading();

      // Validate file type
      if (!file.name.toLowerCase().endsWith('.zip')) {
        throw new Error('Please upload a ZIP file containing GTFS data');
      }

      // Check file size (warn if > 50MB)
      if (file.size > 50 * 1024 * 1024) {
        notifications.showWarning(
          'Large file detected. Processing may take a moment...'
        );
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
            },
          },
        ],
      });

      this.mapController.hideMapOverlay();
    }
  }

  async loadGTFSFromURL(url) {
    let loadingNotificationId = null;

    try {
      console.log('Loading GTFS from URL:', url);

      // Show loading notification
      loadingNotificationId = notifications.showLoading(
        `Loading GTFS from URL: ${url}`
      );

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
      notifications.showSuccess('Successfully loaded GTFS from URL');
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
            },
          },
        ],
      });

      this.mapController.hideMapOverlay();
    }
  }

  updateFileList() {
    const fileList = document.getElementById('file-list');
    fileList.innerHTML = '';

    // Get categorized files
    const { required, optional, other } = this.gtfsParser.categorizeFiles();

    // Create DaisyUI menu structure
    const menu = document.createElement('ul');
    menu.className = 'menu w-full';

    // Add required files section
    if (required.length > 0) {
      const requiredSection = document.createElement('li');
      const requiredHeader = document.createElement('div');
      requiredHeader.className = 'menu-title';
      requiredHeader.textContent = 'Required Files';
      requiredSection.appendChild(requiredHeader);

      const requiredList = document.createElement('ul');
      required.forEach((fileName) => {
        this.addFileItem(requiredList, fileName, true);
      });
      requiredSection.appendChild(requiredList);
      menu.appendChild(requiredSection);
    }

    // Add optional files section
    if (optional.length > 0) {
      const optionalSection = document.createElement('li');
      const optionalHeader = document.createElement('div');
      optionalHeader.className = 'menu-title';
      optionalHeader.textContent = 'Optional Files';
      optionalSection.appendChild(optionalHeader);

      const optionalList = document.createElement('ul');
      optional.forEach((fileName) => {
        this.addFileItem(optionalList, fileName, false);
      });
      optionalSection.appendChild(optionalList);
      menu.appendChild(optionalSection);
    }

    // Add other files section
    if (other.length > 0) {
      const otherSection = document.createElement('li');
      const otherHeader = document.createElement('div');
      otherHeader.className = 'menu-title';
      otherHeader.textContent = 'Other Files';
      otherSection.appendChild(otherHeader);

      const otherList = document.createElement('ul');
      other.forEach((fileName) => {
        this.addFileItem(otherList, fileName, false);
      });
      otherSection.appendChild(otherList);
      menu.appendChild(otherSection);
    }

    fileList.appendChild(menu);

    // Enable export button if we have files
    const hasFiles =
      required.length > 0 || optional.length > 0 || other.length > 0;
    document.getElementById('export-btn').disabled = !hasFiles;
  }

  addFileItem(container, fileName, isRequired) {
    const listItem = document.createElement('li');

    const link = document.createElement('a');
    link.className = `flex justify-between items-center ${isRequired ? 'file-required' : ''}`;

    const nameSpan = document.createElement('span');
    nameSpan.textContent = fileName;
    link.appendChild(nameSpan);

    // Add record count if available
    const data = this.gtfsParser.getFileData(fileName);
    if (data) {
      const count = Array.isArray(data) ? data.length : 1;
      const countSpan = document.createElement('span');
      countSpan.className = 'badge badge-neutral badge-sm';
      countSpan.textContent = `${count}`;
      link.appendChild(countSpan);
    }

    link.addEventListener('click', (event) => {
      event.preventDefault();
      this.openFile(fileName, event.currentTarget);
    });

    listItem.appendChild(link);
    container.appendChild(listItem);
  }

  openFile(fileName, clickedElement = null) {
    if (!this.gtfsParser.getFileContent(fileName)) {
      return;
    }

    // Update active file styling
    document.querySelectorAll('.menu a').forEach((item) => {
      item.classList.remove('menu-active');
    });
    if (clickedElement) {
      clickedElement.classList.add('menu-active');
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
    // Clear breadcrumb trail when returning to objects list
    this.breadcrumbTrail = [];
  }

  showObjectDetails(objectType, objectData, relatedObjects = []) {
    const listView = document.getElementById('objects-list-view');
    const detailsView = document.getElementById('object-details-view');
    if (listView && detailsView) {
      listView.classList.add('hidden');
      detailsView.classList.remove('hidden');

      // Ensure the proper object details structure exists
      // (schedule controller may have replaced it completely)
      this.ensureObjectDetailsStructure(detailsView);

      // Update object info
      const objectTypeEl = document.getElementById('object-type');
      const objectNameEl = document.getElementById('object-name');
      let objectName = 'Unknown';

      // Get the appropriate name based on object type
      if (objectType === 'Agency') {
        objectName =
          objectData.name ||
          objectData.agency_name ||
          objectData.agency_id ||
          'Unknown';
      } else if (objectType === 'Route') {
        // Try shortName first, then longName, then id
        if (objectData.shortName) {
          objectName = objectData.shortName;
          if (objectData.longName) {
            objectName += ' - ' + objectData.longName;
          }
        } else {
          objectName =
            objectData.longName ||
            objectData.id ||
            objectData.route_short_name ||
            objectData.route_long_name ||
            objectData.route_id ||
            'Unknown';
        }
      } else if (objectType === 'Stop') {
        objectName =
          objectData.name ||
          objectData.stop_name ||
          objectData.id ||
          objectData.stop_id ||
          'Unknown';
      } else if (objectType === 'Trip') {
        objectName = objectData.id || objectData.trip_id || 'Unknown';
      } else {
        // Fallback for other types
        objectName =
          objectData.name ||
          objectData.id ||
          objectData.agency_name ||
          objectData.route_short_name ||
          objectData.stop_name ||
          objectData.trip_id ||
          'Unknown';
      }

      if (objectTypeEl && objectNameEl) {
        objectTypeEl.textContent = objectType;
        objectNameEl.textContent = objectName;
      }

      // Update breadcrumb trail
      this.updateBreadcrumbTrail(objectType, objectName, objectData);

      // Populate properties
      this.populateObjectProperties(objectData);

      // Populate related objects
      this.populateRelatedObjects(relatedObjects);
    }
  }

  updateBreadcrumbTrail(objectType, objectName, objectData) {
    // Build breadcrumb trail based on object hierarchy - only store type and ID
    const objectId =
      objectData.id ||
      objectData.agency_id ||
      objectData.route_id ||
      objectData.routeId ||
      objectData.serviceId;

    const breadcrumbItem = {
      type: objectType,
      name: objectName,
      id: objectId,
    };

    // Check if this item is already in the trail to avoid duplicates
    const existingIndex = this.breadcrumbTrail.findIndex(
      (item) => item.type === objectType && item.id === objectId
    );

    if (existingIndex >= 0) {
      // If item exists, truncate trail to that point
      this.breadcrumbTrail = this.breadcrumbTrail.slice(0, existingIndex + 1);
    } else {
      // Add new item to trail
      this.breadcrumbTrail.push(breadcrumbItem);
    }

    this.renderBreadcrumbs();
  }

  renderBreadcrumbs() {
    const breadcrumbList = document.getElementById('breadcrumb-list');
    if (!breadcrumbList) return;

    // Clear existing breadcrumbs
    breadcrumbList.innerHTML = '';

    // Add Home link with icon
    const agenciesLi = document.createElement('li');
    const agenciesLink = document.createElement('a');
    agenciesLink.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="h-4 w-4 stroke-current">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
      </svg>
    `;
    agenciesLink.href = '#';
    agenciesLink.id = 'breadcrumb-objects';
    agenciesLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.showObjectsList();
    });
    agenciesLi.appendChild(agenciesLink);
    breadcrumbList.appendChild(agenciesLi);

    // Add each item in the trail
    this.breadcrumbTrail.forEach((item, index) => {
      const isLast = index === this.breadcrumbTrail.length - 1;
      const li = document.createElement('li');

      if (isLast) {
        // Last item is not clickable
        li.textContent = item.name;
      } else {
        // Previous items are clickable
        const a = document.createElement('a');
        a.textContent = item.name;
        a.href = '#';
        a.addEventListener('click', (e) => {
          e.preventDefault();
          this.navigateToBreadcrumb(index);
        });
        li.appendChild(a);
      }

      breadcrumbList.appendChild(li);
    });
  }

  navigateToBreadcrumb(index) {
    console.log(
      'navigateToBreadcrumb called with index:',
      index,
      'breadcrumbTrail:',
      this.breadcrumbTrail
    );
    // Truncate trail to the clicked item
    this.breadcrumbTrail = this.breadcrumbTrail.slice(0, index + 1);
    const item = this.breadcrumbTrail[index];
    console.log('Navigating to item:', item);

    // Dynamically fetch object data and related objects based on type and ID
    if (item.type === 'Agency' && this.objectsNavigation) {
      // Use the objects navigation to navigate to this agency
      this.objectsNavigation.navigateToAgency(item.id);
    } else if (item.type === 'Route' && this.objectsNavigation) {
      // Use the objects navigation to navigate to this route
      this.objectsNavigation.navigateToRoute(item.id);
    } else if (item.type === 'Schedule') {
      // For schedule items, navigate back to the route view
      const routeItem = this.breadcrumbTrail.find(
        (breadcrumbItem) => breadcrumbItem.type === 'Route'
      );
      if (routeItem && this.objectsNavigation) {
        // Truncate breadcrumb trail to just include the route
        const routeIndex = this.breadcrumbTrail.findIndex(
          (breadcrumbItem) => breadcrumbItem.type === 'Route'
        );
        this.breadcrumbTrail = this.breadcrumbTrail.slice(0, routeIndex + 1);
        // Navigate directly to the route
        this.objectsNavigation.navigateToRoute(routeItem.id);
        return;
      }
    }
  }

  ensureObjectDetailsStructure(detailsView) {
    // Check if the proper structure exists (object-type, object-name, etc.)
    if (
      !document.getElementById('object-type') ||
      !document.getElementById('object-name')
    ) {
      // Restore the original object details structure
      detailsView.innerHTML = `
        <div class="h-full flex flex-col">
          <!-- Object Header with Breadcrumbs -->
          <div class="border-b border-base-300">
            <div id="object-breadcrumbs" class="p-3 bg-base-200">
              <div class="breadcrumbs text-sm">
                <ul id="breadcrumb-list">
                  <li>
                    <a id="breadcrumb-objects">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="h-4 w-4 stroke-current">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
                      </svg>
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <div class="flex items-center gap-2 p-4">
              <span id="object-type" class="text-sm font-medium opacity-70">Agency</span>
              <span id="object-name" class="text-sm font-medium">None</span>
            </div>
          </div>

          <!-- Object Properties -->
          <div class="flex-1 overflow-y-auto">
            <div class="p-4">
              <h3 class="text-sm font-semibold mb-3">Properties</h3>
              <div id="object-properties" class="space-y-3">
                <!-- Properties will be populated here -->
              </div>
            </div>

            <!-- Related Objects -->
            <div class="border-t border-base-300 p-4">
              <h3 class="text-sm font-semibold mb-3">Related Objects</h3>
              <div id="related-objects" class="space-y-2">
                <!-- Related objects will be populated here -->
              </div>
            </div>
          </div>
        </div>
      `;

      // Re-attach the breadcrumb event listener
      const breadcrumbObjectsBtn =
        document.getElementById('breadcrumb-objects');
      if (breadcrumbObjectsBtn) {
        breadcrumbObjectsBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.showObjectsList();
        });
      }
    }
  }

  populateObjectProperties(objectData) {
    const container = document.getElementById('object-properties');
    if (!container) {
      return;
    }

    container.innerHTML = '';

    Object.entries(objectData).forEach(([key, value]) => {
      const propertyEl = document.createElement('div');
      propertyEl.className = 'flex flex-col gap-1';

      // Debug logging
      console.log('Processing property:', key, 'value:', value);

      // Get tooltip description based on the field
      let tooltipDescription = '';
      const schemaFieldName = getSchemaFieldName(key);
      console.log('Schema field name:', schemaFieldName);

      // Try to get description from different schemas
      // Check the current object type to determine which schema to use
      const objectTypeEl = document.getElementById('object-type');
      const objectType = objectTypeEl ? objectTypeEl.textContent : '';

      if (
        objectType === 'Agency' ||
        key.startsWith('agency_') ||
        key === 'agencyId'
      ) {
        tooltipDescription = getAgencyFieldDescription(schemaFieldName);
        console.log('Agency tooltip for', key, ':', tooltipDescription);
      } else if (
        objectType === 'Route' ||
        key.startsWith('route_') ||
        key === 'routeId'
      ) {
        tooltipDescription = getRouteFieldDescription(schemaFieldName);
        console.log('Route tooltip for', key, ':', tooltipDescription);
      } else if (
        objectType === 'Service' ||
        key.startsWith('service_') ||
        key === 'serviceId' ||
        key.includes('date') ||
        key.includes('day')
      ) {
        tooltipDescription = getCalendarFieldDescription(schemaFieldName);
        console.log('Calendar tooltip for', key, ':', tooltipDescription);
      }

      const labelText = key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());

      const labelEl = document.createElement('label');
      labelEl.className = 'text-xs font-medium text-secondary';

      if (tooltipDescription) {
        console.log(
          'Creating tooltip for',
          key,
          'with description:',
          tooltipDescription
        );
        labelEl.innerHTML = createTooltip(labelText, tooltipDescription);
      } else {
        console.log('No tooltip for', key);
        labelEl.textContent = labelText;
      }

      const inputEl = document.createElement('input');
      inputEl.className =
        'text-sm px-2 py-1 border border-primary rounded focus:outline-none focus:ring-1 focus:ring-blue-500';
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
    const headerEl =
      document.querySelector('#related-objects').previousElementSibling;

    if (!container) {
      return;
    }

    // Update the header text based on the types of related objects
    if (headerEl && relatedObjects.length > 0) {
      const objectTypes = [...new Set(relatedObjects.map((obj) => obj.type))];
      let headerText = 'Related Objects';

      if (objectTypes.length === 1) {
        const type = objectTypes[0];
        switch (type) {
          case 'Route':
            headerText = 'Routes';
            break;
          case 'Service':
            headerText = 'Services';
            break;
          case 'Trip':
            headerText = 'Trips';
            break;
          case 'Stop':
            headerText = 'Stops';
            break;
          case 'Agency':
            headerText = 'Agencies';
            break;
          default:
            headerText = `${type}s`;
        }
      } else {
        headerText = 'Related Objects';
      }

      headerEl.textContent = headerText;
    }

    container.innerHTML = '';

    if (relatedObjects.length === 0) {
      const noRelatedEl = document.createElement('div');
      noRelatedEl.className = 'text-sm opacity-60';
      noRelatedEl.textContent = 'No related objects';
      container.appendChild(noRelatedEl);
      return;
    }

    relatedObjects.forEach((obj) => {
      const itemEl = document.createElement('div');
      itemEl.className =
        'flex items-center justify-between p-2 bg-base-200 rounded cursor-pointer hover:bg-base-300';

      const nameEl = document.createElement('span');
      nameEl.className = 'text-sm';
      nameEl.textContent = obj.name;

      const typeEl = document.createElement('span');
      typeEl.className = 'text-xs opacity-60';
      typeEl.textContent = obj.type;

      itemEl.appendChild(nameEl);
      itemEl.appendChild(typeEl);

      itemEl.addEventListener('click', () => {
        if (obj.scheduleAction && obj.routeId && obj.data?.serviceId) {
          // Open schedule view for this service with direction filtering
          if (this.scheduleController) {
            this.scheduleController.showScheduleForRoute(
              obj.routeId,
              obj.data.serviceId,
              obj.directionId || obj.data.directionId
            );
          }
        } else if (obj.routeAction && obj.routeId) {
          // Navigate to route view to show services
          if (this.objectsNavigation) {
            this.objectsNavigation.navigateToRoute(obj.routeId);
          }
        } else {
          this.showObjectDetails(obj.type, obj.data, obj.relatedObjects || []);
        }
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
      notifications.showError(
        `Failed to create new GTFS feed: ${error.message}`
      );
    }
  }

  async exportGTFS() {
    let loadingNotificationId = null;

    try {
      if (!this.gtfsParser || this.gtfsParser.getAllFileNames().length === 0) {
        notifications.showWarning(
          'No GTFS data to export. Please load a GTFS feed first.'
        );
        return;
      }

      console.log('Exporting GTFS data...');

      // Show loading notification
      loadingNotificationId = notifications.showLoading(
        'Preparing GTFS export...'
      );

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
    } else {
      // Load Columbia County as default feed when no URL parameters
      const defaultUrl =
        'https://raw.githubusercontent.com/maxtkc/columbia-county-gtfs/refs/heads/main/columbia_county_gtfs.zip';
      this.loadGTFSFromURL(defaultUrl);
    }
  }
}
