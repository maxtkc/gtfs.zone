export type Theme = 'light' | 'dark' | 'auto';

export interface ThemeCallbacks {
  onThemeChange?: (theme: Theme) => void;
  onSystemThemeChange?: (isDark: boolean) => void;
}

export class ThemeManager {
  private currentTheme: Theme = 'auto';
  private callbacks: ThemeCallbacks = {};
  private mediaQuery: MediaQueryList;

  constructor() {
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.initializeTheme();
    this.setupEventListeners();
  }

  /**
   * Set callbacks for theme events
   */
  public setCallbacks(callbacks: Partial<ThemeCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Initialize theme from localStorage or system preference
   */
  private initializeTheme(): void {
    // Try to load saved theme preference
    const savedTheme = localStorage.getItem('gtfs-zone-theme') as Theme;

    if (savedTheme && ['light', 'dark', 'auto'].includes(savedTheme)) {
      this.currentTheme = savedTheme;
    } else {
      this.currentTheme = 'auto';
    }

    // Apply the theme
    this.applyTheme(this.currentTheme);

    console.log(`🎨 Theme initialized: ${this.currentTheme}`);
  }

  /**
   * Setup event listeners for theme switching
   */
  private setupEventListeners(): void {
    // Theme toggle button
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', this.handleThemeToggle.bind(this));
    }

    // System theme preference changes
    this.mediaQuery.addEventListener(
      'change',
      this.handleSystemThemeChange.bind(this)
    );

    // Keyboard shortcut for theme toggle (Ctrl/Cmd + Shift + T)
    document.addEventListener(
      'keydown',
      this.handleKeyboardShortcut.bind(this)
    );
  }

  /**
   * Handle theme toggle button click
   */
  private handleThemeToggle(): void {
    // Cycle through themes: auto -> light -> dark -> auto
    const themeOrder: Theme[] = ['auto', 'light', 'dark'];
    const currentIndex = themeOrder.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % themeOrder.length;

    this.setTheme(themeOrder[nextIndex]);
  }

  /**
   * Handle system theme preference changes
   */
  private handleSystemThemeChange(e: MediaQueryListEvent): void {
    if (this.currentTheme === 'auto') {
      this.applyTheme('auto');
    }

    // Notify callback
    if (this.callbacks.onSystemThemeChange) {
      this.callbacks.onSystemThemeChange(e.matches);
    }
  }

  /**
   * Handle keyboard shortcut for theme toggle
   */
  private handleKeyboardShortcut(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
      e.preventDefault();
      this.handleThemeToggle();
    }
  }

  /**
   * Set theme
   */
  public setTheme(theme: Theme): void {
    if (this.currentTheme === theme) {
      return;
    }

    this.currentTheme = theme;
    this.applyTheme(theme);
    this.saveThemePreference(theme);

    // Notify callback
    if (this.callbacks.onThemeChange) {
      this.callbacks.onThemeChange(theme);
    }

    console.log(`🎨 Theme changed to: ${theme}`);
  }

  /**
   * Apply theme to the document
   */
  private applyTheme(theme: Theme): void {
    const html = document.documentElement;

    // Remove existing theme classes
    html.classList.remove('light', 'dark');

    // Determine effective theme
    let effectiveTheme: 'light' | 'dark';

    if (theme === 'auto') {
      effectiveTheme = this.mediaQuery.matches ? 'dark' : 'light';
    } else {
      effectiveTheme = theme;
    }

    // Apply theme class
    html.classList.add(effectiveTheme);

    // Set data attribute for DaisyUI
    html.setAttribute('data-theme', effectiveTheme);

    // Update theme toggle button appearance
    this.updateThemeToggleButton(theme, effectiveTheme);

    // Update meta theme-color for mobile browsers
    this.updateMetaThemeColor(effectiveTheme);
  }

  /**
   * Update theme toggle button appearance
   */
  private updateThemeToggleButton(
    theme: Theme,
    effectiveTheme: 'light' | 'dark'
  ): void {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) {
      return;
    }

    // Update button icon and tooltip
    const icon = themeToggle.querySelector('svg');

    if (icon) {
      // Update icon based on current theme
      if (theme === 'auto') {
        icon.innerHTML = this.getAutoThemeIcon();
        themeToggle.setAttribute('data-tip', 'Theme: Auto');
      } else if (effectiveTheme === 'dark') {
        icon.innerHTML = this.getDarkThemeIcon();
        themeToggle.setAttribute('data-tip', 'Theme: Dark');
      } else {
        icon.innerHTML = this.getLightThemeIcon();
        themeToggle.setAttribute('data-tip', 'Theme: Light');
      }
    }

    // Update button appearance
    themeToggle.classList.toggle('btn-active', effectiveTheme === 'dark');
  }

  /**
   * Update meta theme-color for mobile browsers
   */
  private updateMetaThemeColor(effectiveTheme: 'light' | 'dark'): void {
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');

    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }

    // Set appropriate theme color
    const color = effectiveTheme === 'dark' ? '#1a1a1a' : '#ffffff';
    metaThemeColor.setAttribute('content', color);
  }

  /**
   * Get light theme icon SVG
   */
  private getLightThemeIcon(): string {
    return `
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    `;
  }

  /**
   * Get dark theme icon SVG
   */
  private getDarkThemeIcon(): string {
    return `
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    `;
  }

  /**
   * Get auto theme icon SVG
   */
  private getAutoThemeIcon(): string {
    return `
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    `;
  }

  /**
   * Save theme preference to localStorage
   */
  private saveThemePreference(theme: Theme): void {
    try {
      localStorage.setItem('gtfs-zone-theme', theme);
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }
  }

  /**
   * Get current theme
   */
  public getCurrentTheme(): Theme {
    return this.currentTheme;
  }

  /**
   * Get effective theme (resolved auto theme)
   */
  public getEffectiveTheme(): 'light' | 'dark' {
    if (this.currentTheme === 'auto') {
      return this.mediaQuery.matches ? 'dark' : 'light';
    }
    return this.currentTheme;
  }

  /**
   * Check if system prefers dark theme
   */
  public isSystemDark(): boolean {
    return this.mediaQuery.matches;
  }

  /**
   * Toggle between light and dark themes (skips auto)
   */
  public toggleLightDark(): void {
    const newTheme = this.getEffectiveTheme() === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  /**
   * Force refresh theme application
   */
  public refreshTheme(): void {
    this.applyTheme(this.currentTheme);
  }

  /**
   * Get theme color CSS variable value
   */
  public getThemeColor(variable: string): string {
    const styles = getComputedStyle(document.documentElement);
    return styles.getPropertyValue(variable);
  }

  /**
   * Set custom theme color
   */
  public setThemeColor(variable: string, value: string): void {
    document.documentElement.style.setProperty(variable, value);
  }

  /**
   * Reset all custom theme colors
   */
  public resetCustomColors(): void {
    const html = document.documentElement;
    const customProperties = Array.from(html.style).filter(
      (prop) =>
        prop.startsWith('--') && (prop.includes('color') || prop.includes('bg'))
    );

    customProperties.forEach((prop) => {
      html.style.removeProperty(prop);
    });

    console.log('🎨 Custom theme colors reset');
  }

  /**
   * Export current theme configuration
   */
  public exportThemeConfig(): object {
    const html = document.documentElement;
    const customProperties: { [key: string]: string } = {};

    Array.from(html.style).forEach((prop) => {
      if (prop.startsWith('--')) {
        customProperties[prop] = html.style.getPropertyValue(prop);
      }
    });

    return {
      theme: this.currentTheme,
      effectiveTheme: this.getEffectiveTheme(),
      customProperties,
      systemDark: this.isSystemDark(),
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Import theme configuration
   */
  public importThemeConfig(config: Record<string, unknown>): void {
    try {
      if (config.theme && ['light', 'dark', 'auto'].includes(config.theme)) {
        this.setTheme(config.theme);
      }

      if (
        config.customProperties &&
        typeof config.customProperties === 'object'
      ) {
        Object.entries(config.customProperties).forEach(([prop, value]) => {
          if (typeof prop === 'string' && typeof value === 'string') {
            this.setThemeColor(prop, value);
          }
        });
      }

      console.log('🎨 Theme configuration imported');
    } catch (error) {
      console.error('Failed to import theme configuration:', error);
    }
  }

  /**
   * Cleanup event listeners
   */
  public destroy(): void {
    // Remove event listeners
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.removeEventListener('click', this.handleThemeToggle);
    }

    this.mediaQuery.removeEventListener('change', this.handleSystemThemeChange);
    document.removeEventListener('keydown', this.handleKeyboardShortcut);

    // Clear callbacks
    this.callbacks = {};

    console.log('🧹 Theme manager destroyed');
  }
}
