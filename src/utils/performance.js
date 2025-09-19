/**
 * Performance utilities for optimizing the GTFS Zone application
 * Includes debouncing, throttling, and other performance helpers
 */

/**
 * Debounce function to limit how often a function can be called
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @param {Object} options - Additional options
 * @param {boolean} [options.leading=false] - Execute on leading edge
 * @param {boolean} [options.trailing=true] - Execute on trailing edge
 * @returns {Function} Debounced function
 */
export function debounce(func, delay, options = {}) {
  const { leading = false, trailing = true } = options;
  let timeoutId = null;
  let lastArgs = null;
  let lastCallTime = null;

  function debounced(...args) {
    lastArgs = args;
    const now = Date.now();

    const isInvokingOnLeading =
      leading && (!lastCallTime || now - lastCallTime >= delay);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (isInvokingOnLeading) {
      lastCallTime = now;
      return func.apply(this, args);
    }

    if (trailing) {
      timeoutId = setTimeout(() => {
        lastCallTime = Date.now();
        func.apply(this, lastArgs);
        timeoutId = null;
      }, delay);
    }
  }

  debounced.cancel = function () {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastCallTime = null;
    lastArgs = null;
  };

  debounced.flush = function () {
    if (timeoutId) {
      clearTimeout(timeoutId);
      lastCallTime = Date.now();
      func.apply(this, lastArgs);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Throttle function to limit execution rate
 * @param {Function} func - Function to throttle
 * @param {number} delay - Minimum time between executions in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, delay) {
  let lastExecTime = 0;
  let timeoutId = null;

  function throttled(...args) {
    const now = Date.now();
    const timeSinceLastExec = now - lastExecTime;

    const executeFunction = () => {
      lastExecTime = Date.now();
      func.apply(this, args);
    };

    if (timeSinceLastExec >= delay) {
      executeFunction();
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(executeFunction, delay - timeSinceLastExec);
    }
  }

  throttled.cancel = function () {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return throttled;
}

/**
 * Lazy loading utility for expensive operations
 * @param {Function} factory - Function that creates the expensive resource
 * @returns {Function} Function that returns the lazily-created resource
 */
export function lazy(factory) {
  let cached = null;
  let isComputed = false;

  return function (...args) {
    if (!isComputed) {
      cached = factory.apply(this, args);
      isComputed = true;
    }
    return cached;
  };
}

/**
 * Memoization utility for caching function results
 * @param {Function} func - Function to memoize
 * @param {Function} [keyGenerator] - Optional function to generate cache key
 * @param {number} [maxCacheSize=100] - Maximum cache size
 * @returns {Function} Memoized function
 */
export function memoize(func, keyGenerator = null, maxCacheSize = 100) {
  const cache = new Map();

  function memoized(...args) {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = func.apply(this, args);

    // LRU eviction if cache is full
    if (cache.size >= maxCacheSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    cache.set(key, result);
    return result;
  }

  memoized.cache = cache;
  memoized.clearCache = () => cache.clear();

  return memoized;
}

/**
 * RAF-based throttling for smooth animations
 * @param {Function} func - Function to call on next animation frame
 * @returns {Function} RAF-throttled function
 */
export function rafThrottle(func) {
  let rafId = null;
  let lastArgs = null;

  function rafThrottled(...args) {
    lastArgs = args;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        func.apply(this, lastArgs);
        rafId = null;
      });
    }
  }

  rafThrottled.cancel = function () {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  return rafThrottled;
}

/**
 * Batch DOM updates for better performance
 * @param {Function} updateFunction - Function that performs DOM updates
 * @returns {Promise} Promise that resolves after updates are applied
 */
export function batchDOMUpdates(updateFunction) {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      updateFunction();
      resolve();
    });
  });
}

/**
 * Simple virtual scrolling helper for large lists
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.container - Container element
 * @param {Array} options.items - Array of items to render
 * @param {Function} options.renderItem - Function to render individual items
 * @param {number} [options.itemHeight=30] - Height of each item in pixels
 * @param {number} [options.overscan=5] - Number of items to render outside visible area
 * @returns {Object} Virtual scrolling controller
 */
export function createVirtualScroll(options) {
  const {
    container,
    items,
    renderItem,
    itemHeight = 30,
    overscan = 5,
  } = options;

  let scrollTop = 0;
  let containerHeight = container.clientHeight;

  const update = throttle(() => {
    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / itemHeight) - overscan
    );
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    // Clear container
    container.innerHTML = '';

    // Create spacer for items above visible area
    if (startIndex > 0) {
      const topSpacer = document.createElement('div');
      topSpacer.style.height = `${startIndex * itemHeight}px`;
      container.appendChild(topSpacer);
    }

    // Render visible items
    for (let i = startIndex; i <= endIndex; i++) {
      if (items[i]) {
        const itemElement = renderItem(items[i], i);
        itemElement.style.height = `${itemHeight}px`;
        container.appendChild(itemElement);
      }
    }

    // Create spacer for items below visible area
    const remainingItems = items.length - (endIndex + 1);
    if (remainingItems > 0) {
      const bottomSpacer = document.createElement('div');
      bottomSpacer.style.height = `${remainingItems * itemHeight}px`;
      container.appendChild(bottomSpacer);
    }
  }, 16);

  const handleScroll = () => {
    scrollTop = container.scrollTop;
    update();
  };

  const handleResize = () => {
    containerHeight = container.clientHeight;
    update();
  };

  // Initial render
  update();

  // Add event listeners
  container.addEventListener('scroll', handleScroll);
  window.addEventListener('resize', handleResize);

  return {
    update,
    destroy() {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      update.cancel();
    },
  };
}

/**
 * Performance monitoring utility
 * @param {string} name - Name of the operation to measure
 * @param {Function} operation - Function to measure
 * @returns {Promise} Promise that resolves with the operation result and timing
 */
export async function measurePerformance(name, operation) {
  const startTime = performance.now();

  try {
    const result = await operation();
    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);

    return { result, duration };
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;

    console.error(
      `[Performance] ${name} failed after ${duration.toFixed(2)}ms:`,
      error
    );
    throw error;
  }
}

/**
 * Check if user prefers reduced motion
 * @returns {boolean} True if user prefers reduced motion
 */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Web Worker utility for offloading heavy computations
 * @param {Function} workerFunction - Function to run in worker
 * @param {*} data - Data to pass to worker
 * @returns {Promise} Promise that resolves with worker result
 */
export function runInWorker(workerFunction, data) {
  return new Promise((resolve, reject) => {
    // Create worker from function
    const workerScript = `
            self.onmessage = function(e) {
                try {
                    const result = (${workerFunction.toString()})(e.data);
                    self.postMessage({ success: true, result });
                } catch (error) {
                    self.postMessage({ success: false, error: error.message });
                }
            };
        `;

    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    worker.onmessage = function (e) {
      const { success, result, error } = e.data;
      worker.terminate();
      URL.revokeObjectURL(blob);

      if (success) {
        resolve(result);
      } else {
        reject(new Error(error));
      }
    };

    worker.onerror = function (error) {
      worker.terminate();
      URL.revokeObjectURL(blob);
      reject(error);
    };

    worker.postMessage(data);
  });
}
