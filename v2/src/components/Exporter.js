/**
 * Exporter Component
 * Handles data export for external use
 */
export default class Exporter {
    constructor() {
        this.exportFormats = {
            csv: this.exportToCSV,
            json: this.exportToJSON,
            excel: this.exportToExcel
        };
    }

    /**
     * Export data to CSV format
     * @param {Array} companies - Array of company objects
     * @param {Array} questions - Array of question objects
     * @param {Object} options - Export options
     * @returns {string} CSV content
     */
    exportToCSV(companies, questions, options = {}) {
        if (!companies || !companies.length) {
            return '';
        }
        
        // Prepare headers
        let headers = ['Company', 'Website', 'LinkedIn'];
        
        // Add question headers
        if (questions && questions.length) {
            questions.forEach((question, index) => {
                headers.push(`Q${index + 1}: ${question.text}`);
                
                if (options.includeConfidence) {
                    headers.push(`Q${index + 1} Confidence`);
                }
            });
        }
        
        // Add additional headers if needed
        if (options.includeMetadata) {
            headers.push('Owner', 'Title', 'Location', 'Contact');
        }
        
        // Create CSV content
        let csv = headers.join(',') + '\n';
        
        // Add data rows
        companies.forEach(company => {
            let row = [];
            
            // Add basic company info
            row.push(`"${this.escapeCSV(company.companyName)}"`);
            row.push(`"${this.escapeCSV(company.website || '')}"`);
            row.push(`"${this.escapeCSV(company.linkedinUrl || '')}"`);
            
            // Add research results
            if (questions && questions.length) {
                questions.forEach((question, index) => {
                    const research = company.research && company.research[question.text];
                    
                    if (research) {
                        const answer = typeof research.answer === 'string' ? research.answer : 
                            (research.result && research.result.answer ? research.result.answer : '-');
                        
                        row.push(`"${this.escapeCSV(answer)}"`);
                        
                        if (options.includeConfidence) {
                            const confidence = research.confidence || 
                                (research.result && research.result.confidence ? research.result.confidence : '-');
                            row.push(`"${this.escapeCSV(confidence)}"`);
                        }
                    } else {
                        row.push('"-"');
                        if (options.includeConfidence) {
                            row.push('"-"');
                        }
                    }
                });
            }
            
            // Add additional metadata if needed
            if (options.includeMetadata) {
                row.push(`"${this.escapeCSV(company.owner || '')}"`);
                row.push(`"${this.escapeCSV(company.title || '')}"`);
                row.push(`"${this.escapeCSV(company.location || '')}"`);
                row.push(`"${this.escapeCSV(company.contact || '')}"`);
            }
            
            csv += row.join(',') + '\n';
        });
        
        return csv;
    }

    /**
     * Export data to JSON format
     * @param {Array} companies - Array of company objects
     * @param {Array} questions - Array of question objects
     * @param {Object} options - Export options
     * @returns {string} JSON content
     */
    exportToJSON(companies, questions, options = {}) {
        if (!companies || !companies.length) {
            return '[]';
        }
        
        let exportData;
        
        if (options.includeFullDetails) {
            // Export full company objects
            exportData = companies;
        } else {
            // Export simplified data
            exportData = companies.map(company => {
                const exportCompany = {
                    companyName: company.companyName,
                    website: company.website,
                    linkedinUrl: company.linkedinUrl,
                    research: {}
                };
                
                // Add metadata if needed
                if (options.includeMetadata) {
                    exportCompany.owner = company.owner;
                    exportCompany.title = company.title;
                    exportCompany.location = company.location;
                    exportCompany.contact = company.contact;
                }
                
                // Add research results
                if (company.research) {
                    for (const [questionText, research] of Object.entries(company.research)) {
                        exportCompany.research[questionText] = {
                            answer: research.answer || (research.result ? research.result.answer : null),
                            confidence: research.confidence || (research.result ? research.result.confidence : null)
                        };
                        
                        // Add evidence and sources if needed
                        if (options.includeEvidence) {
                            exportCompany.research[questionText].evidence = 
                                research.evidence || (research.result ? research.result.evidence : null);
                            exportCompany.research[questionText].sources = 
                                research.sources || (research.result ? research.result.sources : null);
                        }
                    }
                }
                
                return exportCompany;
            });
        }
        
        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Export data to Excel-compatible CSV format
     * @param {Array} companies - Array of company objects
     * @param {Array} questions - Array of question objects
     * @param {Object} options - Export options
     * @returns {string} Excel-compatible CSV content
     */
    exportToExcel(companies, questions, options = {}) {
        // This creates a CSV file with Excel-specific formatting
        // Add UTF-8 BOM for Excel compatibility
        return '\ufeff' + this.exportToCSV(companies, questions, options);
    }

    /**
     * Download exported data as a file
     * @param {string} content - Content to download
     * @param {string} filename - Filename
     * @param {string} mimeType - MIME type
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    /**
     * Export and download data
     * @param {Array} companies - Array of company objects
     * @param {Array} questions - Array of question objects
     * @param {string} format - Export format ('csv', 'json', or 'excel')
     * @param {Object} options - Export options
     */
    export(companies, questions, format = 'csv', options = {}) {
        const exportFn = this.exportFormats[format.toLowerCase()];
        
        if (!exportFn) {
            console.error(`Unsupported export format: ${format}`);
            return;
        }
        
        const content = exportFn.call(this, companies, questions, options);
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        let filename = `smartbroker_export_${date}`;
        let mimeType;
        
        switch (format.toLowerCase()) {
            case 'csv':
                filename += '.csv';
                mimeType = 'text/csv';
                break;
            case 'json':
                filename += '.json';
                mimeType = 'application/json';
                break;
            case 'excel':
                filename += '.csv';
                mimeType = 'text/csv';
                break;
        }
        
        this.downloadFile(content, filename, mimeType);
    }

    /**
     * Escape CSV special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeCSV(text) {
        if (typeof text !== 'string') {
            return String(text);
        }
        
        // Replace double quotes with two double quotes
        return text.replace(/"/g, '""');
    }
}