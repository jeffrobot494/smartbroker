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