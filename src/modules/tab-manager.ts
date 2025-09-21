export class TabManager {
  constructor() {
    // Don't initialize automatically, wait for explicit call
  }

  initialize() {
    // DaisyUI radio tabs handle switching automatically
    // This class is now mainly for programmatic tab switching if needed
    console.log('TabManager: DaisyUI tabs initialized');
  }

  // Programmatic tab switching for DaisyUI radio tabs
  switchToTab(tabName: string) {
    const radioInput = document.getElementById(
      `${tabName}-tab-radio`
    ) as HTMLInputElement;
    if (radioInput) {
      radioInput.checked = true;
      // Trigger change event to ensure any listeners are notified
      radioInput.dispatchEvent(new Event('change'));
    } else {
      console.warn(
        `TabManager: Tab radio input not found: ${tabName}-tab-radio`
      );
    }
  }

  // Get currently active tab
  getActiveTab(): string | null {
    const checkedRadio = document.querySelector(
      'input[name="main_tabs"]:checked'
    ) as HTMLInputElement;
    if (checkedRadio) {
      return checkedRadio.id.replace('-tab-radio', '');
    }
    return null;
  }

  // Listen for tab changes (if needed for other components)
  onTabChange(callback: (tabName: string) => void) {
    const radioInputs = document.querySelectorAll('input[name="main_tabs"]');
    radioInputs.forEach((radio) => {
      radio.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.checked) {
          const tabName = target.id.replace('-tab-radio', '');
          callback(tabName);
        }
      });
    });
  }
}
