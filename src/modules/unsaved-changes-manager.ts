/**
 * Unsaved Changes Manager
 * Tracks unsaved changes and warns users before page unload
 */
export class UnsavedChangesManager {
  private unsavedChanges: Map<string, boolean> = new Map();
  private beforeUnloadHandler: ((event: BeforeUnloadEvent) => void) | null =
    null;
  private autoSaveIndicator: HTMLElement | null = null;

  constructor() {
    this.initializeBeforeUnloadWarning();
    this.initializeAutoSaveIndicator();
  }

  /**
   * Initialize the beforeunload warning
   */
  private initializeBeforeUnloadWarning(): void {
    this.beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      if (this.hasUnsavedChanges()) {
        const message =
          'You have unsaved changes. Are you sure you want to leave?';
        event.preventDefault();
        event.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  /**
   * Initialize auto-save status indicator
   */
  private initializeAutoSaveIndicator(): void {
    let existingIndicator = document.getElementById('auto-save-indicator');
    if (!existingIndicator) {
      existingIndicator = this.createAutoSaveIndicator();
      document.body.appendChild(existingIndicator);
    }

    this.autoSaveIndicator = existingIndicator;
  }

  /**
   * Create the auto-save indicator DOM element
   */
  private createAutoSaveIndicator(): HTMLElement {
    const indicator = document.createElement('div');
    indicator.id = 'auto-save-indicator';
    indicator.className =
      'fixed bottom-4 right-4 z-40 px-3 py-2 rounded-lg shadow-lg transition-all duration-300 transform translate-y-full opacity-0';
    indicator.innerHTML = `
      <div class="flex items-center space-x-2">
        <span class="save-icon">💾</span>
        <span class="save-text text-sm font-medium">Saved</span>
      </div>
    `;
    return indicator;
  }

  /**
   * Mark a file or operation as having unsaved changes
   */
  markAsUnsaved(key: string): void {
    this.unsavedChanges.set(key, true);
    this.updateAutoSaveIndicator('unsaved');
  }

  /**
   * Mark a file or operation as saved
   */
  markAsSaved(key: string): void {
    this.unsavedChanges.delete(key);

    if (!this.hasUnsavedChanges()) {
      this.updateAutoSaveIndicator('saved');
    }
  }

  /**
   * Mark a file or operation as currently saving
   */
  markAsSaving(_key: string): void {
    this.updateAutoSaveIndicator('saving');
  }

  /**
   * Mark a file or operation as having a save error
   */
  markAsError(key: string, error: string): void {
    this.unsavedChanges.set(key, true);
    this.updateAutoSaveIndicator('error', error);
  }

  /**
   * Check if there are any unsaved changes
   */
  hasUnsavedChanges(): boolean {
    return this.unsavedChanges.size > 0;
  }

  /**
   * Get list of files/operations with unsaved changes
   */
  getUnsavedKeys(): string[] {
    return Array.from(this.unsavedChanges.keys());
  }

  /**
   * Clear all unsaved changes (use when saving all or loading new file)
   */
  clearAllUnsaved(): void {
    this.unsavedChanges.clear();
    this.updateAutoSaveIndicator('saved');
  }

  /**
   * Update the auto-save indicator appearance
   */
  private updateAutoSaveIndicator(
    state: 'saved' | 'unsaved' | 'saving' | 'error',
    errorMessage?: string
  ): void {
    if (!this.autoSaveIndicator) {
      return;
    }

    const iconElement = this.autoSaveIndicator.querySelector(
      '.save-icon'
    ) as HTMLElement;
    const textElement = this.autoSaveIndicator.querySelector(
      '.save-text'
    ) as HTMLElement;

    // Reset classes
    this.autoSaveIndicator.className =
      'fixed bottom-4 right-4 z-40 px-3 py-2 rounded-lg shadow-lg transition-all duration-300';

    switch (state) {
      case 'saved':
        this.autoSaveIndicator.classList.add(
          'bg-success',
          'text-success-content'
        );
        iconElement.textContent = '✅';
        textElement.textContent = 'All changes saved';
        this.showIndicatorTemporarily();
        break;

      case 'unsaved':
        this.autoSaveIndicator.classList.add(
          'bg-warning',
          'text-warning-content',
          'translate-y-0',
          'opacity-100'
        );
        iconElement.textContent = '⚠️';
        textElement.textContent = 'Unsaved changes';
        break;

      case 'saving':
        this.autoSaveIndicator.classList.add(
          'bg-info',
          'text-info-content',
          'translate-y-0',
          'opacity-100'
        );
        iconElement.textContent = '💾';
        textElement.textContent = 'Saving...';
        break;

      case 'error':
        this.autoSaveIndicator.classList.add(
          'bg-error',
          'text-error-content',
          'translate-y-0',
          'opacity-100'
        );
        iconElement.textContent = '❌';
        textElement.textContent = errorMessage || 'Save failed';
        // Auto-hide error after 5 seconds
        setTimeout(() => {
          if (this.hasUnsavedChanges()) {
            this.updateAutoSaveIndicator('unsaved');
          } else {
            this.hideIndicator();
          }
        }, 5000);
        break;
    }
  }

  /**
   * Show indicator temporarily (for saved state)
   */
  private showIndicatorTemporarily(): void {
    if (!this.autoSaveIndicator) {
      return;
    }

    // Show the indicator
    this.autoSaveIndicator.classList.add('translate-y-0', 'opacity-100');

    // Hide after 3 seconds unless there are unsaved changes
    setTimeout(() => {
      if (!this.hasUnsavedChanges()) {
        this.hideIndicator();
      } else {
        this.updateAutoSaveIndicator('unsaved');
      }
    }, 3000);
  }

  /**
   * Hide the indicator
   */
  private hideIndicator(): void {
    if (!this.autoSaveIndicator) {
      return;
    }

    this.autoSaveIndicator.classList.remove('translate-y-0', 'opacity-100');
    this.autoSaveIndicator.classList.add('translate-y-full', 'opacity-0');
  }

  /**
   * Show confirmation dialog for unsaved changes
   */
  async confirmUnsavedChanges(
    message: string = 'You have unsaved changes. Do you want to continue?'
  ): Promise<boolean> {
    if (!this.hasUnsavedChanges()) {
      return true;
    }

    return new Promise((resolve) => {
      // Create a modal dialog
      const modal = document.createElement('div');
      modal.className = 'modal modal-open';
      modal.innerHTML = `
        <div class="modal-box">
          <h3 class="font-bold text-lg">Unsaved Changes</h3>
          <p class="py-4">${message}</p>
          <div class="modal-action">
            <button class="btn btn-error" id="confirm-discard">Discard Changes</button>
            <button class="btn btn-primary" id="confirm-cancel">Cancel</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const discardButton = modal.querySelector(
        '#confirm-discard'
      ) as HTMLButtonElement;
      const cancelButton = modal.querySelector(
        '#confirm-cancel'
      ) as HTMLButtonElement;

      discardButton.addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(true);
      });

      cancelButton.addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(false);
      });
    });
  }

  /**
   * Cleanup event listeners
   */
  destroy(): void {
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }

    if (this.autoSaveIndicator) {
      document.body.removeChild(this.autoSaveIndicator);
      this.autoSaveIndicator = null;
    }
  }
}

// Global singleton instance
export const unsavedChangesManager = new UnsavedChangesManager();
