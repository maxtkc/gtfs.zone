export class TabManager {
  constructor() {
    // Don't initialize automatically, wait for explicit call
  }

  initialize() {
    // Handle tab switching for both left and right panels
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab')) {
        this.switchTab(e.target);
      }
    });
  }

  switchTab(button) {
    const tabId = button.dataset.tab;
    const panel = button.closest('.left-panel, .right-panel');

    if (!panel) {
      console.error('TabManager: Could not find panel for button', button);
      return;
    }

    // Remove active state from all tabs in this panel
    const allTabs = panel.querySelectorAll('.tab');
    const allContent = panel.querySelectorAll('.tab-content');

    allTabs.forEach((tab) => {
      tab.classList.remove('tab-active');
    });

    allContent.forEach((content) => {
      content.classList.add('hidden');
    });

    // Activate selected tab
    button.classList.add('tab-active');

    // Show selected content
    const targetContent = document.getElementById(`${tabId}-tab`);
    if (targetContent) {
      targetContent.classList.remove('hidden');
    }
  }
}
