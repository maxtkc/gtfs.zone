/**
 * Error Test Helpers for Development
 * Use these functions to test the error visibility system
 */

/**
 * Test functions to validate error system is working
 */
export const ErrorTestHelpers = {
  /**
   * Test basic console error
   */
  testConsoleError() {
    console.error('Test Console Error: This is a test error message');
  },

  /**
   * Test console warning
   */
  testConsoleWarning() {
    console.warn('Test Console Warning: This is a test warning message');
  },

  /**
   * Test JavaScript runtime error
   */
  testRuntimeError() {
    // This will throw a ReferenceError
    nonExistentFunction();
  },

  /**
   * Test promise rejection
   */
  async testPromiseRejection() {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error('Test Promise Rejection: This promise was rejected'));
      }, 100);
    });
  },

  /**
   * Test ErrorHandler integration
   */
  testErrorHandler() {
    const { ErrorHandler } = require('./error-handler');

    ErrorHandler.handle(
      new Error('Test ErrorHandler: This error was handled by ErrorHandler'),
      'error-test',
      { metadata: { testType: 'manual' } }
    );
  },

  /**
   * Test validation error
   */
  testValidationError() {
    const { ErrorHandler } = require('./error-handler');

    try {
      ErrorHandler.throwValidationError(
        'Test Validation Error: Invalid data format',
        'validation-test',
        { field: 'test_field', value: 'invalid_value' }
      );
    } catch {
      // Error was thrown and handled
    }
  },

  /**
   * Test async error
   */
  async testAsyncError() {
    const { ErrorHandler } = require('./error-handler');

    const faultyPromise = new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error('Test Async Error: This async operation failed'));
      }, 500);
    });

    try {
      await ErrorHandler.handleAsync(faultyPromise, 'async-test');
    } catch {
      // Error was handled
    }
  },

  /**
   * Test multiple rapid errors
   */
  testRapidErrors() {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        console.error(`Rapid Error ${i + 1}: Testing rapid error generation`);
      }, i * 200);
    }
  },

  /**
   * Test error with stack trace
   */
  testStackTraceError() {
    function level3() {
      throw new Error('Test Stack Trace Error: Deep function call error');
    }

    function level2() {
      level3();
    }

    function level1() {
      level2();
    }

    try {
      level1();
    } catch (e) {
      console.error('Caught error with stack trace:', e);
    }
  },

  /**
   * Test all error types in sequence
   */
  async testAllErrorTypes() {
    console.log('🧪 Starting comprehensive error system test...');

    // Test 1: Console Error
    setTimeout(() => {
      console.log('Test 1: Console Error');
      this.testConsoleError();
    }, 1000);

    // Test 2: Console Warning
    setTimeout(() => {
      console.log('Test 2: Console Warning');
      this.testConsoleWarning();
    }, 2000);

    // Test 3: ErrorHandler
    setTimeout(() => {
      console.log('Test 3: ErrorHandler');
      this.testErrorHandler();
    }, 3000);

    // Test 4: Stack Trace Error
    setTimeout(() => {
      console.log('Test 4: Stack Trace Error');
      this.testStackTraceError();
    }, 4000);

    // Test 5: Promise Rejection
    setTimeout(async () => {
      console.log('Test 5: Promise Rejection');
      try {
        await this.testPromiseRejection();
      } catch {
        // Expected to fail
      }
    }, 5000);

    // Test 6: Validation Error
    setTimeout(() => {
      console.log('Test 6: Validation Error');
      this.testValidationError();
    }, 6000);

    // Test 7: Multiple Rapid Errors
    setTimeout(() => {
      console.log('Test 7: Rapid Errors');
      this.testRapidErrors();
    }, 7000);

    console.log(
      '🧪 Error tests scheduled. Check DevErrorSystem overlay for results.'
    );
    console.log('💡 Use Ctrl+Shift+E to open/close error overlay');
    console.log('💡 Use Ctrl+Shift+C to clear all errors');
  },

  /**
   * Show help for error testing
   */
  showHelp() {
    console.log(`
🧪 ERROR TESTING HELPERS

Available test functions:
- ErrorTestHelpers.testConsoleError()     - Test console.error()
- ErrorTestHelpers.testConsoleWarning()   - Test console.warn()
- ErrorTestHelpers.testRuntimeError()     - Test JavaScript runtime error
- ErrorTestHelpers.testPromiseRejection() - Test unhandled promise rejection
- ErrorTestHelpers.testErrorHandler()     - Test ErrorHandler class
- ErrorTestHelpers.testValidationError()  - Test validation error
- ErrorTestHelpers.testAsyncError()       - Test async operation error
- ErrorTestHelpers.testRapidErrors()      - Test multiple rapid errors
- ErrorTestHelpers.testStackTraceError()  - Test error with stack trace
- ErrorTestHelpers.testAllErrorTypes()    - Run all tests in sequence

🎮 KEYBOARD SHORTCUTS:
- Ctrl+Shift+E: Open/close error overlay
- Ctrl+Shift+C: Clear all errors
- ESC: Close error overlay

🔍 FEATURES:
- Visual notifications for all errors
- Audio alerts for critical errors
- Floating error counter (bottom-right)
- Full error overlay with stack traces
- Error history and statistics
- Browser title flashing for critical errors

To test the system: ErrorTestHelpers.testAllErrorTypes()
    `);
  },
};

// Make available globally in development
if (
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1')
) {
  window.ErrorTestHelpers = ErrorTestHelpers;

  // Auto-show help in console
  setTimeout(() => {
    console.log('🚨 Development Error System Ready!');
    console.log('📖 Type ErrorTestHelpers.showHelp() for testing commands');
  }, 1000);
}
