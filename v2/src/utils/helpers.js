/**
 * Helper utility functions for SmartBroker v2
 * General-purpose helper functions used across the application
 */

/**
 * Generate a unique ID string
 * @returns {string} Unique ID
 */
export function generateId() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}

/**
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Debounce a function call
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
    let timeout;
    
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Escape HTML entities
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
    if (!str) return '';
    
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Extract domain from a URL
 * @param {string} url - URL to extract domain from
 * @returns {string} Domain name
 */
export function extractDomain(url) {
    if (!url) return '';
    
    try {
        // Add protocol if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        
        const hostname = new URL(url).hostname;
        
        // Remove www. if present
        return hostname.replace(/^www\./, '');
    } catch (error) {
        console.error('Failed to extract domain:', error);
        return url;
    }
}

/**
 * Calculate confidence score based on multiple factors
 * @param {Object} result - Result object with confidence indicators
 * @returns {number} Confidence score (0-1)
 */
export function calculateConfidence(result) {
    if (!result) return 0;
    
    // If result already has a confidence score, use it
    if (typeof result.confidence === 'number') {
        return Math.min(Math.max(result.confidence, 0), 1);
    }
    
    // Calculate based on available signals
    let score = 0.5; // Default medium confidence
    
    // Increase based on positive signals
    if (result.multipleSources) score += 0.1;
    if (result.consistentResults) score += 0.1;
    if (result.primarySource) score += 0.1;
    if (result.recentData) score += 0.05;
    
    // Decrease based on negative signals
    if (result.contradictoryResults) score -= 0.2;
    if (result.unclearInformation) score -= 0.1;
    if (result.limitedSources) score -= 0.1;
    if (result.oldData) score -= 0.05;
    
    // Ensure range is 0-1
    return Math.min(Math.max(score, 0), 1);
}

/**
 * Check if a response contains a positive indicator
 * @param {string} response - Response text
 * @returns {boolean} True if response indicates a positive answer
 */
export function hasPositiveIndicator(response) {
    if (!response) return false;
    
    const positiveIndicators = [
        'YES',
        'Yes',
        'Positive',
        'positive',
        'Confirmed',
        'confirmed',
        'TRUE',
        'True',
        'true'
    ];
    
    return positiveIndicators.some(indicator => response.includes(indicator));
}

/**
 * Check if a response contains a negative indicator
 * @param {string} response - Response text
 * @returns {boolean} True if response indicates a negative answer
 */
export function hasNegativeIndicator(response) {
    if (!response) return false;
    
    const negativeIndicators = [
        'NO',
        'No',
        'Negative',
        'negative',
        'Not found',
        'not found',
        'FALSE',
        'False',
        'false'
    ];
    
    return negativeIndicators.some(indicator => response.includes(indicator));
}

/**
 * Truncate a string to a maximum length
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
export function truncate(str, maxLength = 100) {
    if (!str) return '';
    
    if (str.length <= maxLength) {
        return str;
    }
    
    return str.substring(0, maxLength) + '...';
}

/**
 * Get browser local storage availability
 * @returns {boolean} True if localStorage is available
 */
export function isLocalStorageAvailable() {
    try {
        const testKey = '__test__';
        localStorage.setItem(testKey, testKey);
        localStorage.removeItem(testKey);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Check if object is empty
 * @param {Object} obj - Object to check
 * @returns {boolean} True if object is empty
 */
export function isEmptyObject(obj) {
    return obj && Object.keys(obj).length === 0 && obj.constructor === Object;
}

/**
 * Wait for a specified time
 * @param {number} ms - Time to wait in milliseconds
 * @returns {Promise} Promise that resolves after the specified time
 */
export function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get file extension from a filename
 * @param {string} filename - Filename
 * @returns {string} File extension
 */
export function getFileExtension(filename) {
    if (!filename) return '';
    
    return filename.split('.').pop().toLowerCase();
}

/**
 * Get readable file size
 * @param {number} bytes - Size in bytes
 * @returns {string} Human-readable file size
 */
export function getReadableFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
}