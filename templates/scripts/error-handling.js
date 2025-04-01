/**
 * Error handling for report UI
 */

class ErrorHandler {
  constructor() {
    this.errorContainer = null;
    this.warningContainer = null;
    this.errorCount = 0;
    this.warningCount = 0;
  }

  /**
   * Initialize error handler
   */
  initialize() {
    // Create error containers if they don't exist
    this.createErrorContainers();
    
    // Set up global error handling
    this.setupGlobalErrorHandling();
  }

  /**
   * Create error containers
   */
  createErrorContainers() {
    // Check if containers already exist
    this.errorContainer = document.getElementById('error-container');
    this.warningContainer = document.getElementById('warning-container');
    
    if (!this.errorContainer) {
      this.errorContainer = document.createElement('div');
      this.errorContainer.id = 'error-container';
      this.errorContainer.className = 'error-container';
      this.errorContainer.style.display = 'none';
      this.errorContainer.innerHTML = `
        <div class="error-header">
          <h3>Errors <span class="error-count">0</span></h3>
          <button class="error-close">×</button>
        </div>
        <div class="error-list"></div>
      `;
      document.body.appendChild(this.errorContainer);
      
      // Add event listener for close button
      const closeButton = this.errorContainer.querySelector('.error-close');
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          this.errorContainer.style.display = 'none';
        });
      }
    }
    
    if (!this.warningContainer) {
      this.warningContainer = document.createElement('div');
      this.warningContainer.id = 'warning-container';
      this.warningContainer.className = 'warning-container';
      this.warningContainer.style.display = 'none';
      this.warningContainer.innerHTML = `
        <div class="warning-header">
          <h3>Warnings <span class="warning-count">0</span></h3>
          <button class="warning-close">×</button>
        </div>
        <div class="warning-list"></div>
      `;
      document.body.appendChild(this.warningContainer);
      
      // Add event listener for close button
      const closeButton = this.warningContainer.querySelector('.warning-close');
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          this.warningContainer.style.display = 'none';
        });
      }
    }
    
    // Add styles for error containers
    this.addStyles();
  }

  /**
   * Set up global error handling
   */
  setupGlobalErrorHandling() {
    // Override console.error
    const originalConsoleError = console.error;
    console.error = (...args) => {
      // Call original console.error
      originalConsoleError.apply(console, args);
      
      // Add to error container
      this.addError(args.map(arg => this.formatErrorArg(arg)).join(' '));
    };
    
    // Override console.warn
    const originalConsoleWarn = console.warn;
    console.warn = (...args) => {
      // Call original console.warn
      originalConsoleWarn.apply(console, args);
      
      // Add to warning container
      this.addWarning(args.map(arg => this.formatErrorArg(arg)).join(' '));
    };
    
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', event => {
      this.addError(`Unhandled Promise Rejection: ${event.reason}`);
    });
    
    // Handle global errors
    window.addEventListener('error', event => {
      this.addError(`Error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`);
    });
  }

  /**
   * Format error argument for display
   * @param {any} arg - Error argument
   * @returns {string} - Formatted error
   */
  formatErrorArg(arg) {
    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}\\n${arg.stack}`;
    }
    
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg, null, 2);
      } catch (e) {
        return '[Object]';
      }
    }
    
    return String(arg);
  }

  /**
   * Add error to container
   * @param {string} message - Error message
   */
  addError(message) {
    if (!this.errorContainer) return;
    
    const errorList = this.errorContainer.querySelector('.error-list');
    if (!errorList) return;
    
    // Create error item
    const errorItem = document.createElement('div');
    errorItem.className = 'error-item';
    errorItem.textContent = message;
    
    // Add timestamp
    const timestamp = document.createElement('span');
    timestamp.className = 'error-timestamp';
    timestamp.textContent = new Date().toLocaleTimeString();
    errorItem.appendChild(timestamp);
    