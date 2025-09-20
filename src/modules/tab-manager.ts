export class TabManager {
  constructor() {
    // Don't initialize automatically, wait for explicit call
  }

  initialize() {
    // Handle tab switching for both left and right panels
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-btn')) {
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
    const allTabs = panel.querySelectorAll('.tab-btn');
    const allContent = panel.querySelectorAll('.tab-content');

    allTabs.forEach((tab) => {
      tab.classList.remove('active');
      tab.classList.remove('border-blue-500', 'text-white', 'text-slate-700');

      if (panel.classList.contains('left-panel')) {
        tab.classList.add('text-slate-300', 'border-transparent');
      } else {
        tab.classList.add('text-slate-500', 'border-transparent');
      }
    });

    allContent.forEach((content) => {
      content.classList.add('hidden');
    });

    // Activate selected tab
    button.classList.add('active', 'border-blue-500');
    button.classList.remove('border-transparent');

    if (panel.classList.contains('left-panel')) {
      button.classList.add('text-white');
      button.classList.remove('text-slate-300');
    } else {
      button.classList.add('text-slate-700');
      button.classList.remove('text-slate-500');
    }

    // Show selected content
    const targetContent = document.getElementById(`${tabId}-tab`);
    if (targetContent) {
      targetContent.classList.remove('hidden');
    }
  }
}
