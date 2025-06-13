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

    // Parse CSV headers and check structure
    const headerLine = lines[0];
    const headers = headerLine.split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const headerCount = headers.length;
    
    // Check if any header is exactly "company"
    const hasCompanyHeader = headers.some(header => header === 'company');
    
    if (!hasCompanyHeader) {
      return {
        isValid: false,
        error: {
          code: 'no_headers',
          message: 'CSV file is missing column headers',
          row: 1
        }
      };
    }

    // Validate CSV structure (temporarily disabled)
    // const structureValidation = this.validateCSVStructure(lines, headerCount);
    // if (!structureValidation.isValid) {
    //   return structureValidation;
    // }

    // If we have a valid header line and structure, consider it valid
    return {
      isValid: true,
      headers: lines[0].split(',').map(h => h.trim()),
      totalLines: lines.length
    };
  }

  /**
   * Validate CSV structure and format
   * @param {Array} lines - Array of CSV lines
   * @param {number} expectedColumns - Expected number of columns from header
   * @returns {Object} Validation result
   */
  static validateCSVStructure(lines, expectedColumns) {
    // Must have at least 2 lines (header + data)
    if (lines.length < 2) {
      return {
        isValid: false,
        error: {
          code: 'no_data_rows',
          message: 'CSV file contains only headers, no data rows',
          row: null
        }
      };
    }

    // Check for extremely long lines that suggest unescaped newlines
    const maxReasonableLineLength = 10000;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > maxReasonableLineLength) {
        return {
          isValid: false,
          error: {
            code: 'malformed_csv',
            message: 'CSV contains extremely long lines, possibly unescaped content',
            row: i + 1
          }
        };
      }
    }

    // Check column count consistency in data rows
    let inconsistentRowCount = 0;
    const tolerance = 3; // Allow ±3 for quoted commas and missing values
    
    for (let i = 1; i < Math.min(lines.length, 20); i++) { // Check first 20 data rows
      const rowColumns = lines[i].split(',').length;
      
      if (Math.abs(rowColumns - expectedColumns) > tolerance) {
        inconsistentRowCount++;
      }
    }

    // If more than 50% of sampled rows have wrong column count, it's likely malformed
    // Increased threshold to be less strict with real-world CSV files
    const sampledRows = Math.min(lines.length - 1, 19);
    if (inconsistentRowCount > sampledRows * 0.5) {
      return {
        isValid: false,
        error: {
          code: 'malformed_csv',
          message: 'CSV has inconsistent column counts, possibly malformed',
          row: null
        }
      };
    }

    // Basic format validation - check if it looks like CSV
    const firstDataRow = lines[1];
    if (firstDataRow.split(',').length === 1 && !firstDataRow.includes('"')) {
      // Single column with no quotes might be plain text
      return {
        isValid: false,
        error: {
          code: 'invalid_structure',
          message: 'File does not appear to be valid CSV format',
          row: 2
        }
      };
    }

    return { isValid: true };
  }
}