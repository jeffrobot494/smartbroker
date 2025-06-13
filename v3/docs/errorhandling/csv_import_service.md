# CSV Import Service - Error Handling Architecture

## Overview

This document describes the error handling architecture for CSV import functionality and serves as an **implementation guide** for our broader error handling strategy across the SmartBroker application.

## Implementation Approach

We decided to implement **client-side validation** that happens **before** sending files to the server:

- **Fast feedback**: Users see errors immediately without server round-trip
- **Minimal server changes**: Existing server code remains unchanged
- **Better UX**: Clear guidance instead of technical error messages

## Architecture Decision

We chose a **specialized services architecture** with **shared dependencies** over a singleton pattern for better separation of concerns, testability, and maintainability.

## Information Flow

The information flows through the system like a restaurant with specialized workers:

```
1. User uploads CSV file
   ↓
2. ResearchGUI detects import button click
   ↓
3. ResearchGUI → CSVImportService (validates BEFORE server)
   ↓
4. CSVImportService → CSVValidator (checks file quality)
   ↓
5. CSVValidator returns validation result
   ↓
6A. IF ERROR: CSVImportService → ErrorHandler → show user error, STOP
6B. IF VALID: Continue to existing server upload logic
   ↓
7. ResearchGUI → Server (existing unchanged code)
   ↓
8. Server processes and responds (existing unchanged code)
```

## Implementation Stages

### **Stage 1: Basic Skeleton (First Priority)**
Create the minimal file structure to make CSV validation work:
- Create skeleton service classes with basic structure
- Integrate with main-gui and research-gui 
- Use simple alert() for user feedback (upgrade later)
- Test with one validation rule: missing headers

### **Stage 2: Enhanced User Experience**
- Replace alert() with proper notification system
- Add more validation rules (missing columns, malformed data)
- Improve error messages and user guidance

### **Stage 3: Full Integration**
- Add retry mechanisms and error recovery
- Extend pattern to API and network errors
- Add comprehensive logging and analytics

## Key Design Principles

### 1. Single Responsibility
- **CSVValidator**: Only validates CSV structure, no side effects
- **ErrorHandler**: Only handles error classification and coordination
- **Logger**: Only logs technical details
- **NotificationService**: Only shows user messages
- **CSVImportService**: Only orchestrates the import process

### 2. Shared Services
All services (CSV, API, Research, etc.) share the same instances of:
- **ErrorHandler**: Consistent error classification
- **Logger**: Centralized logging
- **NotificationService**: Consistent user experience

### 3. Dependency Injection
Services receive their dependencies as constructor parameters rather than creating them internally.

## Implementation

### Test Case
We're starting with a single error test case: **Missing column headers in CSV file**.

## Code Files

### 1. CSVValidator.js
```javascript
/**
 * Pure validation - only checks CSV, no side effects
 */
class CSVValidator {
  /**
   * Validate CSV content for basic structure
   * @param {string} csvContent - Raw CSV file content
   * @returns {Object} Validation result
   */
  static validate(csvContent) {
    // Check if content exists
    if (!csvContent || csvContent.trim().length === 0) {
      return {
        isValid: false,
        error: {
          code: 'empty_file',
          message: 'CSV file is empty',
          row: null
        }
      };
    }

    // Split into lines and filter out empty ones
    const lines = csvContent.trim().split('\n').filter(line => line.trim());
    
    // Check if we have at least one line (headers)
    if (lines.length === 0) {
      return {
        isValid: false,
        error: {
          code: 'no_content',
          message: 'CSV file contains no data',
          row: null
        }
      };
    }

    // Check if first line looks like headers (our single test case)
    const firstLine = lines[0].trim();
    
    // Very basic header detection - just check if first line has content
    if (!firstLine || firstLine.length === 0) {
      return {
        isValid: false,
        error: {
          code: 'no_headers',
          message: 'CSV file is missing column headers',
          row: 1
        }
      };
    }

    // For now, if we have a non-empty first line, consider it valid
    // (We'll add more validation later)
    return {
      isValid: true,
      headers: firstLine.split(',').map(h => h.trim()),
      totalLines: lines.length
    };
  }
}

module.exports = CSVValidator;
```

Note from user: first row must contain "company" or "Company" - that tells us it is the header row.

### 2. ErrorHandler.js
```javascript
/**
 * Handles error classification and coordination of logging/notification
 */
class ErrorHandler {
  constructor(notificationService, logger) {
    this.notificationService = notificationService;
    this.logger = logger;
  }

  /**
   * Handle CSV validation errors
   * @param {Object} validationError - Error from CSVValidator
   * @param {string} context - Additional context (e.g., filename)
   */
  handleCSVError(validationError, context = {}) {
    // Classify the error for user display
    const userInfo = this.classifyCSVError(validationError);
    
    // Log the technical details
    this.logger.logCSVError(validationError, context);
    
    // Show user-friendly message
    this.notificationService.showCSVError(userInfo);
  }

  /**
   * Convert technical validation error to user-friendly information
   * @param {Object} validationError - Technical error details
   * @returns {Object} User-friendly error information
   */
  classifyCSVError(validationError) {
    const errorMappings = {
      'empty_file': {
        userMessage: 'The uploaded file appears to be empty.',
        helpText: 'Please check that you selected the correct file and try again.',
        actions: [
          { label: 'Try Different File', action: 'retry' }
        ],
        severity: 'error'
      },
      
      'no_content': {
        userMessage: 'The CSV file contains no data.',
        helpText: 'Your CSV file should have at least a header row with column names.',
        actions: [
          { label: 'Try Different File', action: 'retry' },
          { label: 'CSV Format Help', action: 'help' }
        ],
        severity: 'error'
      },
      
      'no_headers': {
        userMessage: 'CSV file is missing column headers.',
        helpText: 'The first row of your CSV should contain column names like "Company", "Website", etc.',
        actions: [
          { label: 'Fix and Try Again', action: 'retry' },
          { label: 'See CSV Format Guide', action: 'help' }
        ],
        severity: 'error'
      }
    };

    const errorInfo = errorMappings[validationError.code] || {
      userMessage: 'There was a problem with your CSV file.',
      helpText: 'Please check the file format and try again.',
      actions: [{ label: 'Try Again', action: 'retry' }],
      severity: 'error'
    };

    return {
      ...errorInfo,
      originalError: validationError
    };
  }
}

module.exports = ErrorHandler;
```

### 3. Logger.js
```javascript
/**
 * Handles all logging - technical details for debugging
 */
class Logger {
  /**
   * Log CSV validation errors with technical details
   * @param {Object} validationError - Technical error details
   * @param {Object} context - Additional context
   */
  logCSVError(validationError, context) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'csv_validation_error',
      error: validationError,
      context: {
        filename: context.filename || 'unknown',
        fileSize: context.fileSize || 'unknown',
        userAgent: navigator.userAgent
      }
    };

    // In development, log to console
    if (process.env.NODE_ENV === 'development') {
      console.error('[CSV_VALIDATION_ERROR]', logEntry);
    }

    // In production, you might send to a logging service
    // this.sendToLoggingService(logEntry);
  }

  /**
   * Log successful CSV operations for analytics
   * @param {Object} successInfo - Success details
   */
  logCSVSuccess(successInfo) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'csv_validation_success',
      info: successInfo
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('[CSV_VALIDATION_SUCCESS]', logEntry);
    }
  }
}

module.exports = Logger;
```

Note from user: Production build uses railway. Send the message to the console and the railway deploy log.

### 4. NotificationService.js
```javascript
/**
 * Handles user notifications - displays messages in the UI
 */
class NotificationService {
  /**
   * Show CSV error to user with actions
   * @param {Object} userInfo - User-friendly error information
   */
  showCSVError(userInfo) {
    // Create the notification HTML
    const notification = this.createNotificationElement(userInfo);
    
    // Add to notification container
    this.addToNotificationContainer(notification);
    
    // Auto-remove after 10 seconds (errors stay longer)
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 10000);
  }

  /**
   * Create notification HTML element
   * @param {Object} userInfo - User-friendly error information
   * @returns {HTMLElement} Notification element
   */
  createNotificationElement(userInfo) {
    const notification = document.createElement('div');
    notification.className = `alert alert-${userInfo.severity} alert-dismissible csv-error-notification`;
    notification.style.cssText = `
      margin-bottom: 10px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      border-radius: 4px;
      animation: slideInRight 0.3s ease-out;
    `;

    // Create action buttons HTML
    const actionsHtml = userInfo.actions.map(action => 
      `<button class="btn btn-sm btn-outline-light me-2" onclick="csvNotificationHandler.handleAction('${action.action}')">${action.label}</button>`
    ).join('');

    notification.innerHTML = `
      <div style="display: flex; align-items: flex-start;">
        <div style="flex: 1;">
          <strong>❌ CSV Import Error</strong>
          <div style="margin-top: 5px;">${userInfo.userMessage}</div>
          <div style="margin-top: 5px; font-size: 0.9em; opacity: 0.8;">${userInfo.helpText}</div>
          ${actionsHtml ? `<div style="margin-top: 10px;">${actionsHtml}</div>` : ''}
        </div>
        <button type="button" class="btn-close" onclick="this.parentElement.parentElement.remove()"></button>
      </div>
    `;

    return notification;
  }

  /**
   * Add notification to the page
   * @param {HTMLElement} notification - Notification element
   */
  addToNotificationContainer(notification) {
    // Get or create notification container
    let container = document.getElementById('notification-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notification-container';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
      `;
      document.body.appendChild(container);
    }

    container.appendChild(notification);
  }
}

// Global handler for notification actions
window.csvNotificationHandler = {
  handleAction(action) {
    switch (action) {
      case 'retry':
        // Reset the file input
        const fileInput = document.getElementById('csv-upload');
        if (fileInput) {
          fileInput.value = '';
          fileInput.click(); // Open file dialog again
        }
        break;
      case 'help':
        // Could open a help modal or navigate to help page
        alert('CSV Format Help:\n\nYour CSV should start with column headers like:\nCompany,Website,City,State\nAcme Corp,acme.com,New York,NY');
        break;
    }
  }
};

module.exports = NotificationService;
```

Note from user: For stage 1, when we are just using alerts, show userMessage and helpText in the alert.
Also, do not make errors go away after 10 seconds. Also, I don't think the notification class should touch the import button. That's more a job for CSVImportService or research-gui. We could also just instruct the user to refresh the page.

### 5. CSVImportService.js
```javascript
const CSVValidator = require('./CSVValidator');

/**
 * Orchestrates the CSV import process - the "Host" in our restaurant analogy
 * Stage 1: Simple validation before server upload
 */
class CSVImportService {
  constructor(errorHandler) {
    this.errorHandler = errorHandler;
  }

  /**
   * Validate CSV file before sending to server
   * @param {File} csvFile - File object from file input
   * @returns {Promise<Object>} Validation result
   */
  async validateCSV(csvFile) {
    try {
      // Read the file content
      const csvContent = await this.readFileContent(csvFile);
      
      // Validate the CSV (our single test case)
      const validation = CSVValidator.validate(csvContent);
      
      if (!validation.isValid) {
        // Handle the error through our error system
        this.errorHandler.handleCSVError(validation.error, {
          filename: csvFile.name,
          fileSize: csvFile.size
        });
        
        // Reset application state for retry
        this.resetImportState();
        
        return { 
          isValid: false, 
          error: validation.error.code 
        };
      }

      // If validation passes, log success
      this.errorHandler.logger.logCSVSuccess({
        filename: csvFile.name,
        fileSize: csvFile.size,
        headers: validation.headers,
        totalLines: validation.totalLines
      });

      return { 
        isValid: true, 
        message: `CSV validated successfully! Found ${validation.headers.length} columns and ${validation.totalLines} total lines.` 
      };

    } catch (error) {
      // Handle unexpected errors
      this.errorHandler.handleCSVError({
        code: 'unexpected_error',
        message: error.message,
        row: null
      }, {
        filename: csvFile.name,
        fileSize: csvFile.size
      });

      this.resetImportState();
      
      return { 
        isValid: false, 
        error: 'unexpected_error' 
      };
    }
  }

  /**
   * Read file content as text
   * @param {File} file - File object
   * @returns {Promise<string>} File content
   */
  readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Reset application state so user can try again
   */
  resetImportState() {
    // Clear the file input
    const fileInput = document.getElementById('csv-upload');
    if (fileInput) {
      fileInput.value = '';
    }

    // Reset any UI state
    const fileInfo = document.querySelector('.file-info');
    if (fileInfo) {
      fileInfo.textContent = 'No file selected';
      fileInfo.style.color = '#6c757d';
    }
  }
}

module.exports = CSVImportService;
```

### 6. Integration with main_gui.js
```javascript
// main_gui.js - Create services and pass to ResearchGUI
class SmartBrokerApp {
  constructor() {
    // Create shared error handling services
    this.logger = new Logger();
    this.notificationService = new NotificationService();
    this.errorHandler = new ErrorHandler(this.notificationService, this.logger);
    
    // Create domain services with shared dependencies
    this.csvImportService = new CSVImportService(this.errorHandler);
    
    // Existing properties...
    this.template = null;
    this.companies = [];
    this.isResearching = false;
    
    // Tab controllers (will be created in init())
    this.researchGUI = null;
    this.outputGUI = null;
    this.optionsGUI = null;
    this.apiKeysGUI = null;
    this.instructionsGUI = null;
  }

  async init() {
    console.log('Initializing SmartBroker GUI...');
    
    // Initialize tab controllers - pass CSV service to ResearchGUI
    this.researchGUI = new ResearchGUI(this, this.csvImportService);
    this.outputGUI = new OutputGUI(this);
    this.optionsGUI = new OptionsGUI(this);
    this.apiKeysGUI = new ApiKeysGUI(this);
    this.instructionsGUI = new InstructionsGUI(this);
    
    // Load template and company data
    await this.loadTemplate();
    
    // Setup tab switching
    this.setupTabSwitching();
    
    // Initialize all tabs
    this.researchGUI.init();
    this.outputGUI.init();
    this.optionsGUI.init();
    this.apiKeysGUI.init();
    this.instructionsGUI.init();
    
    console.log('SmartBroker GUI initialized successfully');
  }
  
  // ... rest of existing methods unchanged
}
```

### 7. Updated ResearchGUI Integration
```javascript
// research_gui.js - Modified constructor and importCompanies method
class ResearchGUI {
  constructor(app, csvImportService) {
    this.app = app;
    this.csvImportService = csvImportService; // Injected service
    this.selectedCriteria = []; // Track selected criteria names
    this.eventSource = null; // SSE connection
    this.wakeLock = null; // Wake lock to prevent sleep during research
  }

  // ... existing init() and other methods unchanged ...

  async importCompanies() {
    console.log('ResearchGUI: Starting CSV import process...');
    
    const fileInput = document.getElementById('csv-upload');
    if (!fileInput.files[0]) {
      console.log('ResearchGUI: No file selected for import');
      alert('Please select a CSV file first');
      return;
    }

    if (!this.app.template) {
      console.log('ResearchGUI: No template loaded');
      alert('No template loaded');
      return;
    }

    const file = fileInput.files[0];
    console.log('ResearchGUI: Importing file:', {
      name: file.name,
      size: file.size,
      type: file.type,
      templateId: this.app.template.id,
      templateName: this.app.template.name
    });

    // NEW: Validate with CSV service before sending to server
    const validation = await this.csvImportService.validateCSV(file);
    if (!validation.isValid) {
      console.log('ResearchGUI: CSV validation failed:', validation.error);
      return; // Error already shown by service
    }

    // EXISTING: Continue with server upload (unchanged)
    const formData = new FormData();
    formData.append('csvFile', file);

    try {
      console.log('ResearchGUI: Sending POST request to /api/template/' + this.app.template.id + '/companies');
      
      const response = await fetch(`/api/template/${this.app.template.id}/companies`, {
        method: 'POST',
        body: formData
      });

      console.log('ResearchGUI: Server response status:', response.status);
      
      const result = await response.json();
      console.log('ResearchGUI: Server response data:', result);
      
      if (result.success) {
        console.log('ResearchGUI: Import successful!', result.count, 'companies imported');
        alert(`Successfully imported ${result.count} companies`);
        
        // Reload template data to get updated companies
        console.log('ResearchGUI: Reloading template data...');
        await this.app.loadTemplate();
        
        // Clear file input
        fileInput.value = '';
        document.querySelector('.file-info').textContent = 'No file selected';
        document.querySelector('.file-info').style.color = '#6c757d';
        
      } else {
        console.log('ResearchGUI: Import failed:', result.error);
        alert('Import failed: ' + result.error);
      }
    } catch (error) {
      console.error('ResearchGUI: Import error:', error);
      alert('Import failed: ' + error.message);
    }
  }

  // ... rest of existing methods unchanged ...
}
```

## Benefits

### ✅ **Separation of Concerns**
Each class has one job and does it well

### ✅ **Consistent User Experience**
All services use the same error handling, so all errors look and behave the same

### ✅ **Easy Testing**
Each component can be tested independently with mocked dependencies

### ✅ **Maintainability**
Changes to error handling affect all services uniformly

### ✅ **Extensibility**
Adding new error types or services follows the same pattern

## Next Steps

1. **Implement this architecture** for the CSV import functionality
2. **Test the single error case** (missing headers) thoroughly
3. **Add more CSV validation rules** using the same pattern
4. **Apply the same architecture** to API error handling
5. **Extend to other error categories** (network, database, etc.)

## Error Categories to Implement Next

1. **CSV Import Errors** ← (Current implementation)
2. **API Errors** (Claude, Perplexity, PhantomBuster)
3. **Network/Connectivity Errors**
4. **Database/Storage Errors**
5. **Browser Environment Errors**