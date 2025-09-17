
export class UIController {
  constructor() {
    this.gtfsParser = null;
    this.editor = null;
    this.mapController = null;
  }

  initialize(gtfsParser, editor, mapController) {
    this.gtfsParser = gtfsParser;
    this.editor = editor;
    this.mapController = mapController;
    this.setupEventListeners();
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

    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => {
        this.toggleSidebar();
      });
    }

    // Editor controls - add listeners only when elements exist
    const closeBtn = document.getElementById('close-editor-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closeEditor();
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

  async loadGTFSFile(file) {
    try {
      console.log('Loading GTFS file:', file.name);

      // Show loading state
      this.mapController.showLoading();

      // Parse the file
      await this.gtfsParser.parseFile(file);

      // Update UI
      this.updateFileList();
      this.mapController.updateMap();
      this.mapController.hideMapOverlay();

      // Enable export button
      document.getElementById('export-btn').disabled = false;
    } catch (error) {
      console.error('Error loading GTFS file:', error);
      alert('Error loading GTFS file: ' + error.message);
      this.mapController.hideMapOverlay();
    }
  }

  async loadGTFSFromURL(url) {
    try {
      console.log('Loading GTFS from URL:', url);
      this.mapController.showLoading();

      await this.gtfsParser.parseFromURL(url);

      // Update UI
      this.updateFileList();
      this.mapController.updateMap();
      this.mapController.hideMapOverlay();

      // Enable export button
      document.getElementById('export-btn').disabled = false;
    } catch (error) {
      console.error('Error loading GTFS from URL:', error);
      alert('Error loading GTFS from URL: ' + error.message);
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

    // Auto-expand sidebar if collapsed and files are loaded
    const sidebar = document.getElementById('file-sidebar');
    if (sidebar.classList.contains('collapsed')) {
      sidebar.classList.remove('collapsed');
    }

    // Hide welcome overlay
    const welcomeOverlay = document.getElementById('welcome-overlay');
    if (welcomeOverlay) {
      welcomeOverlay.classList.add('hidden');
    }
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

    // Show editor panel
    const editorPanel = document.getElementById('editor-panel');
    editorPanel.classList.remove('hidden');

    // Open file in editor
    this.editor.openFile(fileName);

    // Update map if it's a spatial file
    if (fileName === 'stops.txt' || fileName === 'shapes.txt') {
      this.mapController.highlightFileData(fileName);
    }

    // Force map resize after layout changes complete
    setTimeout(() => {
      this.mapController.forceMapResize();
    }, 20);
  }

  closeEditor() {
    const editorPanel = document.getElementById('editor-panel');

    // Close editor
    this.editor.closeEditor();

    // Hide editor panel
    editorPanel.classList.add('hidden');

    // Clear active file styling
    document.querySelectorAll('.file-item').forEach((item) => {
      item.classList.remove('active');
    });

    // Force map resize after layout changes complete
    setTimeout(() => {
      this.mapController.forceMapResize();
    }, 20);
  }

  toggleSidebar() {
    const sidebar = document.getElementById('file-sidebar');
    sidebar.classList.toggle('collapsed');
    
    // Force map resize after layout changes complete
    setTimeout(() => {
      this.mapController.forceMapResize();
    }, 300);
  }

  async exportGTFS() {
    try {
      if (!this.gtfsParser || this.gtfsParser.getAllFileNames().length === 0) {
        alert('No GTFS data to export');
        return;
      }

      console.log('Exporting GTFS data...');

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
    } catch (error) {
      console.error('Error exporting GTFS:', error);
      alert('Error exporting GTFS: ' + error.message);
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