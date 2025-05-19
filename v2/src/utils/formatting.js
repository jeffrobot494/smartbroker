/**
 * Formatting utility functions for SmartBroker v2
 * Handles formatting of data for display and export
 */

/**
 * Format a date string to a human-readable format
 * @param {string|Date} dateString - Date string or Date object
 * @param {boolean} includeTime - Whether to include time in the formatted date
 * @returns {string} Formatted date string
 */
export function formatDate(dateString, includeTime = false) {
    if (!dateString) return 'N/A';
    
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    
    if (isNaN(date.getTime())) {
        return 'Invalid date';
    }
    
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric'
    };
    
    if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
    }
    
    return date.toLocaleDateString('en-US', options);
}

/**
 * Format a confidence level as a human-readable string
 * @param {number} confidence - Confidence value (0-1)
 * @returns {string} Formatted confidence string
 */
export function formatConfidence(confidence) {
    if (confidence === undefined || confidence === null) {
        return 'Unknown';
    }
    
    const numValue = parseFloat(confidence);
    
    if (isNaN(numValue)) {
        return 'Unknown';
    }
    
    // Convert to percentage
    const percentage = Math.round(numValue * 100);
    
    // Return confidence level with descriptive text
    if (percentage >= 90) {
        return `Very High (${percentage}%)`;
    } else if (percentage >= 75) {
        return `High (${percentage}%)`;
    } else if (percentage >= 50) {
        return `Medium (${percentage}%)`;
    } else if (percentage >= 25) {
        return `Low (${percentage}%)`;
    } else {
        return `Very Low (${percentage}%)`;
    }
}

/**
 * Format a result answer for display
 * @param {string} answer - Answer text
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} Formatted answer
 */
export function formatAnswer(answer, maxLength = 50) {
    if (!answer) return 'Not researched';
    
    // Clean up answer
    let cleanAnswer = answer.trim();
    
    // Truncate if longer than maxLength
    if (cleanAnswer.length > maxLength) {
        return cleanAnswer.substring(0, maxLength) + '...';
    }
    
    return cleanAnswer;
}

/**
 * Format a company name for display
 * @param {string} name - Company name
 * @returns {string} Formatted company name
 */
export function formatCompanyName(name) {
    if (!name) return 'Unnamed Company';
    
    // Remove Inc, LLC, etc. for display
    const suffixes = [', Inc.', ' Inc.', ', LLC', ' LLC', ', Ltd.', ' Ltd.', ', Corporation', ' Corporation'];
    
    let formattedName = name.trim();
    
    suffixes.forEach(suffix => {
        if (formattedName.endsWith(suffix)) {
            formattedName = formattedName.substring(0, formattedName.length - suffix.length);
        }
    });
    
    return formattedName;
}

/**
 * Format a number with commas
 * @param {number} number - Number to format
 * @returns {string} Formatted number
 */
export function formatNumber(number) {
    if (number === undefined || number === null || isNaN(number)) {
        return 'N/A';
    }
    
    return new Intl.NumberFormat('en-US').format(number);
}

/**
 * Format a website URL for display
 * @param {string} url - Website URL
 * @returns {string} Formatted URL
 */
export function formatWebsite(url) {
    if (!url) return '';
    
    // Add https:// if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    
    // Remove trailing slash
    if (url.endsWith('/')) {
        url = url.substring(0, url.length - 1);
    }
    
    // Format for display (remove protocol)
    const display = url.replace(/^https?:\/\//, '');
    
    return {
        url,
        display
    };
}

/**
 * Format API usage information
 * @param {Object} usage - API usage data
 * @returns {string} Formatted usage string
 */
export function formatApiUsage(usage) {
    if (!usage) return 'No API usage data';
    
    const claudeCount = usage.claude?.count || 0;
    const claudeCost = usage.claude?.cost || 0;
    const perplexityCount = usage.perplexity?.count || 0;
    const perplexityCost = usage.perplexity?.cost || 0;
    
    const lastReset = usage.lastReset ? formatDate(usage.lastReset) : 'Never';
    
    return `Claude: ${claudeCount} calls (${formatNumber(claudeCost)} tokens), Perplexity: ${perplexityCount} searches, Last Reset: ${lastReset}`;
}

/**
 * Format a CSV value to handle commas, quotes, etc.
 * @param {any} value - Value to format for CSV
 * @returns {string} CSV-formatted value
 */
export function formatCSVValue(value) {
    if (value === null || value === undefined) {
        return '';
    }
    
    const stringValue = String(value);
    
    // If value contains commas, quotes, or newlines, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || 
        stringValue.includes('\n') || stringValue.includes('\r')) {
        
        // Escape quotes by doubling them
        return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    
    return stringValue;
}

/**
 * Create CSS class name for confidence level
 * @param {number} confidence - Confidence value (0-1)
 * @returns {string} CSS class name
 */
export function getConfidenceClass(confidence) {
    if (confidence === undefined || confidence === null) {
        return 'confidence-unknown';
    }
    
    const numValue = parseFloat(confidence);
    
    if (isNaN(numValue)) {
        return 'confidence-unknown';
    }
    
    if (numValue >= 0.9) {
        return 'confidence-very-high';
    } else if (numValue >= 0.75) {
        return 'confidence-high';
    } else if (numValue >= 0.5) {
        return 'confidence-medium';
    } else if (numValue >= 0.25) {
        return 'confidence-low';
    } else {
        return 'confidence-very-low';
    }
}