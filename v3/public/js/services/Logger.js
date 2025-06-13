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

    // Browser-safe environment detection
    const isDevelopment = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.hostname.includes('localhost');

    // In development, log to console
    if (isDevelopment) {
      console.error('[CSV_VALIDATION_ERROR]', logEntry);
    }

    // Always log to console for Railway production logs
    console.error('[CSV_VALIDATION_ERROR]', logEntry);

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

    // Browser-safe environment detection
    const isDevelopment = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.hostname.includes('localhost');

    if (isDevelopment) {
      console.log('[CSV_VALIDATION_SUCCESS]', logEntry);
    }

    // Always log to console for Railway production logs
    console.log('[CSV_VALIDATION_SUCCESS]', logEntry);
  }
}