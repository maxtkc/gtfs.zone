/**
 * Field Descriptions Display Module
 * Adds field description tooltips and information to the GTFS editor
 */

import { GTFSMetadata } from '../utils/gtfs-metadata';

export class FieldDescriptionsDisplay {
  private currentFile: string | null = null;
  private descriptionsContainer: HTMLElement | null = null;

  constructor() {
    this.createDescriptionsContainer();
  }

  private createDescriptionsContainer(): void {
    // Create a container for field descriptions
    const container = document.createElement('div');
    container.id = 'field-descriptions-panel';
    container.className = 'field-descriptions-panel';
    container.style.cssText = `
      position: fixed;
      right: 20px;
      top: 50%;
      transform: translateY(-50%);
      width: 300px;
      max-height: 400px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      overflow-y: auto;
      z-index: 1000;
      display: none;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3 style="margin: 0; font-size: 14px; color: #333;">Field Descriptions</h3>
        <button id="close-descriptions" style="background: none; border: none; font-size: 18px; cursor: pointer; color: #666;">&times;</button>
      </div>
      <div id="descriptions-content"></div>
    `;

    document.body.appendChild(container);
    this.descriptionsContainer = container;

    // Add close functionality
    const closeButton = container.querySelector('#close-descriptions');
    closeButton?.addEventListener('click', () => {
      this.hideDescriptions();
    });
  }

  public showDescriptionsForFile(filename: string): void {
    if (!this.descriptionsContainer) {
      return;
    }

    this.currentFile = filename;
    const content = this.descriptionsContainer.querySelector(
      '#descriptions-content'
    );
    if (!content) {
      return;
    }

    try {
      const fieldInfo = GTFSMetadata.getAllFieldInfo(filename);
      const fileInfo = GTFSMetadata.getFileInfo(filename);

      if (!fieldInfo || fieldInfo.length === 0) {
        content.innerHTML =
          '<p style="color: #666; font-size: 12px;">No field information available for this file.</p>';
        return;
      }

      let html = `
        <div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px; font-size: 12px;">
          <strong>${filename}</strong><br>
          <span style="color: #666;">${fileInfo?.presence || 'Unknown'} • ${fieldInfo.length} fields</span>
        </div>
      `;

      fieldInfo.forEach((field) => {
        const requiredBadge = field?.required
          ? '<span style="background: #dc3545; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-left: 8px;">Required</span>'
          : '<span style="background: #6c757d; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-left: 8px;">Optional</span>';

        html += `
          <div style="margin-bottom: 12px; padding: 8px; border-left: 3px solid #007bff; background: #f8f9fa;">
            <div style="font-weight: 600; font-size: 12px; color: #333; margin-bottom: 4px;">
              ${field?.name}${requiredBadge}
            </div>
            <div style="font-size: 11px; color: #666; line-height: 1.4;">
              ${field?.description || 'No description available'}
            </div>
          </div>
        `;
      });

      content.innerHTML = html;
      this.descriptionsContainer.style.display = 'block';
    } catch (error) {
      console.error('Error showing field descriptions:', error);
      content.innerHTML =
        '<p style="color: #dc3545; font-size: 12px;">Error loading field descriptions.</p>';
    }
  }

  public hideDescriptions(): void {
    if (this.descriptionsContainer) {
      this.descriptionsContainer.style.display = 'none';
    }
    this.currentFile = null;
  }

  public addDescriptionButton(
    fileElement: HTMLElement,
    filename: string
  ): void {
    // Add a small info button to file elements
    const infoButton = document.createElement('button');
    infoButton.innerHTML = 'ℹ️';
    infoButton.title = 'Show field descriptions';
    infoButton.style.cssText = `
      background: none;
      border: none;
      cursor: pointer;
      font-size: 12px;
      margin-left: 8px;
      opacity: 0.7;
      transition: opacity 0.2s;
    `;

    infoButton.addEventListener('mouseenter', () => {
      infoButton.style.opacity = '1';
    });

    infoButton.addEventListener('mouseleave', () => {
      infoButton.style.opacity = '0.7';
    });

    infoButton.addEventListener('click', (e) => {
      e.stopPropagation();
      if (
        this.currentFile === filename &&
        this.descriptionsContainer?.style.display === 'block'
      ) {
        this.hideDescriptions();
      } else {
        this.showDescriptionsForFile(filename);
      }
    });

    fileElement.appendChild(infoButton);
  }

  public addTooltip(
    element: HTMLElement,
    fieldName: string,
    filename: string
  ): void {
    // Add hover tooltip for field descriptions
    const description = GTFSMetadata.getFieldDescription(filename, fieldName);

    if (description) {
      element.title = `${fieldName}: ${description.substring(0, 200)}${description.length > 200 ? '...' : ''}`;
      element.style.cursor = 'help';
    }
  }

  // Static method to create an instance and integrate with existing UI
  public static integrate(): FieldDescriptionsDisplay {
    const instance = new FieldDescriptionsDisplay();

    // Try to integrate with existing file list if available
    setTimeout(() => {
      instance.enhanceExistingFileList();
    }, 100);

    return instance;
  }

  private enhanceExistingFileList(): void {
    // Look for existing file items and add description buttons
    const fileItems = document.querySelectorAll('[data-filename]');
    fileItems.forEach((item) => {
      const filename = item.getAttribute('data-filename');
      if (filename && item instanceof HTMLElement) {
        // Check if we already added a button
        if (!item.querySelector('.field-descriptions-btn')) {
          this.addDescriptionButton(item, filename);
        }
      }
    });
  }
}
