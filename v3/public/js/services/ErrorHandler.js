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
        userMessage: 'CSV file is missing required column headers.',
        helpText: 'The first row of your CSV must contain a column named "Company" or "company".',
        actions: [
          { label: 'Fix and Try Again', action: 'retry' },
          { label: 'See CSV Format Guide', action: 'help' }
        ],
        severity: 'error'
      },
      
      'no_data_rows': {
        userMessage: 'CSV file contains only headers with no data.',
        helpText: 'Your CSV file needs at least one row of company data after the header row.',
        actions: [
          { label: 'Add Data and Try Again', action: 'retry' },
          { label: 'CSV Format Help', action: 'help' }
        ],
        severity: 'error'
      },
      
      'malformed_csv': {
        userMessage: 'CSV file appears to be malformed or corrupted.',
        helpText: 'The file has inconsistent column counts or extremely long lines. Please check for unescaped commas or newlines in your data.',
        actions: [
          { label: 'Fix CSV and Try Again', action: 'retry' },
          { label: 'CSV Format Help', action: 'help' }
        ],
        severity: 'error'
      },
      
      'invalid_structure': {
        userMessage: 'File does not appear to be a valid CSV.',
        helpText: 'The file looks like plain text rather than comma-separated values. Please ensure your file is properly formatted as CSV.',
        actions: [
          { label: 'Convert to CSV and Try Again', action: 'retry' },
          { label: 'CSV Format Help', action: 'help' }
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