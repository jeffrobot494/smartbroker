/**
 * CSV Reader Component
 * Handles reading and parsing CSV files into structured JSON data
 */
export default class CSVReader {
    /**
     * Set up CSV file upload click handler
     * @param {string} buttonId - ID of the upload button element
     * @param {string} fileInputId - ID of the file input element
     * @param {Function} onFileLoaded - Callback when file is loaded
     */
    static setupCSVUpload(buttonId, fileInputId, onFileLoaded) {
        const uploadBtn = document.getElementById(buttonId);
        const fileInput = document.getElementById(fileInputId);
        
        if (!uploadBtn || !fileInput) {
            console.error(`CSV upload elements not found: ${buttonId}, ${fileInputId}`);
            return;
        }
        
        // Set up click handler for button
        uploadBtn.addEventListener('click', () => {
            fileInput.click();
        });
        
        // Set up change handler for file input
        fileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            try {
                const data = await CSVReader.readCSVFile(file);
                if (onFileLoaded && typeof onFileLoaded === 'function') {
                    onFileLoaded(file, data);
                }
            } catch (error) {
                console.error('Error reading CSV file:', error);
                alert(`Error reading CSV file: ${error.message}`);
            }
        });
    }
    /**
     * Parse CSV content into JSON
     * @param {string} content - The CSV content as a string
     * @param {Object} options - Parsing options
     * @returns {Array} Array of objects representing the CSV data
     */
    static parseCSV(content, options = {}) {
        const lines = content.split(/\r?\n/);
        const headers = lines[0].split(',').map(header => header.trim());
        const result = [];
        
        // Start from line 1 to skip headers
        for (let i = 1; i < lines.length; i++) {
            // Skip empty lines
            if (!lines[i].trim()) continue;
            
            const values = CSVReader.splitCSVLine(lines[i]);
            const obj = {};
            
            // Create object mapping headers to values
            headers.forEach((header, index) => {
                obj[header] = values[index] ? values[index].trim() : '';
            });
            
            // Skip row if required fields are missing
            if (options.requiredFields) {
                const missingRequired = options.requiredFields.some(field => 
                    !obj[field] || obj[field].trim() === '');
                
                if (missingRequired) continue;
            }
            
            result.push(obj);
        }
        
        return result;
    }
    
    /**
     * Split CSV line handling quoted fields with commas
     * @param {string} line - Single line from CSV
     * @returns {Array} Array of field values
     */
    static splitCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        // Add the last field
        result.push(current);
        
        return result;
    }
    
    /**
     * Read a CSV file and convert to JSON
     * @param {File} file - The CSV file to read
     * @param {Object} options - Parsing options
     * @returns {Promise<Array>} Promise resolving to array of objects
     */
    static readCSVFile(file, options = {}) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const content = event.target.result;
                    const data = this.parseCSV(content, options);
                    resolve(data);
                } catch (error) {
                    reject(new Error(`Failed to parse CSV: ${error.message}`));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsText(file);
        });
    }
    
    /**
     * Validate CSV structure against expected fields
     * @param {Array} data - Parsed CSV data
     * @param {Array} expectedFields - Array of expected field names
     * @returns {Object} Validation result with isValid and missing fields
     */
    static validateCSVStructure(data, expectedFields) {
        if (!data || !data.length) {
            return { isValid: false, error: 'CSV data is empty' };
        }
        
        const firstRow = data[0];
        const missingFields = expectedFields.filter(field => 
            !Object.keys(firstRow).includes(field)
        );
        
        return {
            isValid: missingFields.length === 0,
            missingFields
        };
    }
    
    /**
     * Format and clean company data from CSV
     * @param {Array} data - Raw parsed CSV data
     * @returns {Array} Cleaned and formatted company data
     */
    static formatCompanyData(data) {
        return data.map(company => ({
            companyName: company.Company || company.company || company.Name || company.name || '',
            website: company.Website || company.website || company.URL || company.url || '',
            linkedinUrl: company.LinkedIn || company.linkedin || company.linkedIn || '',
            owner: company.Owner || company.owner || company.CEO || company.ceo || '',
            title: company.Title || company.title || company.Position || company.position || '',
            location: company.Location || company.location || '',
            employeeCount: company.Employees || company.employees || company['Employee Count'] || '',
            contact: company.Contact || company.contact || '',
            research: {}
        }));
    }
}