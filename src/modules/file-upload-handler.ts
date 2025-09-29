import { notifications } from './notification-system.js';
import type { GTFSParser } from './gtfs-parser.js';
import type { MapController } from './map-controller.js';

export interface FileUploadCallbacks {
  onFileLoaded?: (filename: string) => void;
  onUrlLoaded?: (url: string) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: number) => void;
}

export interface FileUploadOptions {
  maxFileSize: number; // in bytes
  allowedExtensions: string[];
  enableDragDrop: boolean;
  enableUrlLoading: boolean;
}

export class FileUploadHandler {
  private gtfsParser: GTFSParser;
  private mapController: MapController;
  private callbacks: FileUploadCallbacks = {};

  // Default options
  private defaultOptions: FileUploadOptions = {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedExtensions: ['.zip'],
    enableDragDrop: true,
    enableUrlLoading: true,
  };

  private options: FileUploadOptions;

  constructor(
    gtfsParser: GTFSParser,
    mapController: MapController,
    options: Partial<FileUploadOptions> = {}
  ) {
    this.gtfsParser = gtfsParser;
    this.mapController = mapController;
    this.options = { ...this.defaultOptions, ...options };
    this.setupEventListeners();
  }

  /**
   * Set callbacks for file upload events
   */
  public setCallbacks(callbacks: Partial<FileUploadCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Setup event listeners for file upload interactions
   */
  private setupEventListeners(): void {
    // File input change
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
      fileInput.addEventListener(
        'change',
        this.handleFileInputChange.bind(this)
      );
    }

    // Upload button click
    const uploadBtn = document.getElementById('upload-btn');
    if (uploadBtn) {
      uploadBtn.addEventListener(
        'click',
        this.handleUploadButtonClick.bind(this)
      );
    }

    // Example buttons
    this.setupExampleButtons();

    // Drag and drop if enabled
    if (this.options.enableDragDrop) {
      this.setupDragAndDrop();
    }
  }

  /**
   * Setup example dataset buttons
   */
  private setupExampleButtons(): void {
    const exampleButtons = [
      { id: 'example-columbia', dataset: 'Columbia County Transit' },
      { id: 'example-west', dataset: 'West County Connector' },
    ];

    exampleButtons.forEach(({ id, dataset }) => {
      const button = document.getElementById(id);
      if (button) {
        button.addEventListener('click', (e) => {
          const url = (e.target as HTMLElement).dataset.url;
          if (url) {
            console.log(`Loading example dataset: ${dataset}`);
            this.loadGTFSFromURL(url);
          }
        });
      }
    });
  }

  /**
   * Setup drag and drop functionality
   */
  private setupDragAndDrop(): void {
    const body = document.body;

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
      body.addEventListener(eventName, this.preventDefaults.bind(this), false);
    });

    // Highlight drop area on drag
    ['dragenter', 'dragover'].forEach((eventName) => {
      body.addEventListener(
        eventName,
        this.highlightDropArea.bind(this),
        false
      );
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      body.addEventListener(
        eventName,
        this.unhighlightDropArea.bind(this),
        false
      );
    });

    // Handle dropped files
    body.addEventListener('drop', this.handleDrop.bind(this), false);
  }

  /**
   * Prevent default drag behaviors
   */
  private preventDefaults(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }

  /**
   * Highlight drop area during drag
   */
  private highlightDropArea(): void {
    document.body.classList.add('drag-over');
  }

  /**
   * Remove highlight from drop area
   */
  private unhighlightDropArea(): void {
    document.body.classList.remove('drag-over');
  }

  /**
   * Handle file input change
   */
  private handleFileInputChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.loadGTFSFile(input.files[0]);
    }
  }

  /**
   * Handle upload button click
   */
  private handleUploadButtonClick(): void {
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  /**
   * Handle dropped files
   */
  private handleDrop(e: DragEvent): void {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (this.validateFile(file)) {
        this.loadGTFSFile(file);
      }
    }
  }

  /**
   * Validate uploaded file
   */
  private validateFile(file: File): boolean {
    // Check file extension
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!this.options.allowedExtensions.includes(extension)) {
      const error = new Error(
        `Invalid file type. Please upload a ${this.options.allowedExtensions.join(' or ')} file`
      );
      this.handleError(error);
      return false;
    }

    // Check file size
    if (file.size > this.options.maxFileSize) {
      const maxSizeMB = Math.round(this.options.maxFileSize / (1024 * 1024));
      const error = new Error(`File too large. Maximum size is ${maxSizeMB}MB`);
      this.handleError(error);
      return false;
    }

    return true;
  }

  /**
   * Load GTFS file
   */
  public async loadGTFSFile(file: File): Promise<void> {
    let loadingNotificationId: string | null = null;

    try {
      console.log('Loading GTFS file:', file.name);

      // Validate file
      if (!this.validateFile(file)) {
        return;
      }

      // Show loading notification
      loadingNotificationId = notifications.showLoading(
        `Loading GTFS file: ${file.name}`
      );

      // Show loading state on map
      this.mapController?.showLoading();

      // Check file size and warn if large
      if (file.size > 50 * 1024 * 1024) {
        notifications.showWarning(
          'Large file detected. Processing may take a moment...'
        );
      }

      // Parse the file
      await this.gtfsParser.parseFile(file);

      // Success callback
      if (this.callbacks.onFileLoaded) {
        this.callbacks.onFileLoaded(file.name);
      }

      // Remove loading notification and show success
      if (loadingNotificationId) {
        notifications.removeNotification(loadingNotificationId);
      }
      notifications.showSuccess(`Successfully loaded GTFS file: ${file.name}`);

      console.log(`✅ Successfully loaded GTFS file: ${file.name}`);
    } catch (error) {
      console.error('Error loading GTFS file:', error);

      // Remove loading notification
      if (loadingNotificationId) {
        notifications.removeNotification(loadingNotificationId);
      }

      this.handleError(error as Error);
    } finally {
      // Hide map loading state
      this.mapController?.hideMapOverlay();
    }
  }

  /**
   * Load GTFS from URL
   */
  public async loadGTFSFromURL(url: string): Promise<void> {
    if (!this.options.enableUrlLoading) {
      this.handleError(new Error('URL loading is disabled'));
      return;
    }

    let loadingNotificationId: string | null = null;

    try {
      console.log('Loading GTFS from URL:', url);

      // Validate URL
      if (!this.validateURL(url)) {
        return;
      }

      // Show loading notification
      loadingNotificationId = notifications.showLoading(
        `Loading GTFS from URL: ${url}`
      );

      // Show loading state on map
      this.mapController?.showLoading();

      // Parse from URL
      await this.gtfsParser.parseFromURL(url);

      // Success callback
      if (this.callbacks.onUrlLoaded) {
        this.callbacks.onUrlLoaded(url);
      }

      // Remove loading notification and show success
      if (loadingNotificationId) {
        notifications.removeNotification(loadingNotificationId);
      }
      notifications.showSuccess('Successfully loaded GTFS from URL');

      console.log(`✅ Successfully loaded GTFS from URL: ${url}`);
    } catch (error) {
      console.error('Error loading GTFS from URL:', error);

      // Remove loading notification
      if (loadingNotificationId) {
        notifications.removeNotification(loadingNotificationId);
      }

      this.handleError(error as Error, url);
    } finally {
      // Hide map loading state
      this.mapController?.hideMapOverlay();
    }
  }

  /**
   * Validate URL
   */
  private validateURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      this.handleError(new Error('Invalid URL format'));
      return false;
    }
  }

  /**
   * Handle errors with user-friendly notifications
   */
  private handleError(error: Error, context?: string): void {
    let errorMessage = 'Failed to load GTFS data';

    if (context) {
      errorMessage += ` from ${context}`;
    }

    if (error.message) {
      errorMessage += `: ${error.message}`;
    }

    // Show error notification with actions
    const actions = context
      ? [
          {
            id: 'help',
            label: 'Need Help?',
            handler: () => {
              // Could navigate to help section or documentation
              console.log('Show help for URL loading issues');
            },
          },
        ]
      : [
          {
            id: 'retry',
            label: 'Try Again',
            primary: true,
            handler: () => {
              const fileInput = document.getElementById(
                'file-input'
              ) as HTMLInputElement;
              if (fileInput) {
                fileInput.click();
              }
            },
          },
        ];

    notifications.showError(errorMessage, { actions });

    // Error callback
    if (this.callbacks.onError) {
      this.callbacks.onError(error);
    }
  }

  /**
   * Create new empty GTFS feed
   */
  public createNewFeed(): void {
    try {
      console.log('Creating new GTFS feed');

      // Reset to empty GTFS feed
      this.gtfsParser.initializeEmpty();

      // Success callback
      if (this.callbacks.onFileLoaded) {
        this.callbacks.onFileLoaded('new-feed');
      }

      notifications.showSuccess('New GTFS feed created with sample data!');
      console.log('✅ Created new GTFS feed');
    } catch (error) {
      console.error('Error creating new GTFS feed:', error);
      this.handleError(error as Error);
    }
  }

  /**
   * Check URL parameters for auto-loading
   */
  public checkURLParams(): void {
    const hash = window.location.hash.substring(1);

    if (hash.startsWith('data=')) {
      const dataParam = hash.substring(5);

      if (dataParam.startsWith('url:')) {
        // Load from URL parameter
        const url = dataParam.substring(4);
        console.log('Auto-loading GTFS from URL parameter:', url);
        this.loadGTFSFromURL(url);
      }
      // Future: support for base64, github, etc.
    }
  }

  /**
   * Get current upload options
   */
  public getOptions(): FileUploadOptions {
    return { ...this.options };
  }

  /**
   * Update upload options
   */
  public setOptions(options: Partial<FileUploadOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Cleanup event listeners
   */
  public destroy(): void {
    // Remove event listeners
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
      fileInput.removeEventListener('change', this.handleFileInputChange);
    }

    const uploadBtn = document.getElementById('upload-btn');
    if (uploadBtn) {
      uploadBtn.removeEventListener('click', this.handleUploadButtonClick);
    }

    // Remove drag and drop listeners
    if (this.options.enableDragDrop) {
      const body = document.body;
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
        body.removeEventListener(eventName, this.preventDefaults);
      });
    }

    // Clear callbacks
    this.callbacks = {};

    console.log('🧹 File upload handler destroyed');
  }
}
