/**
 * Database Component
 * Handles local storage and persistence of application data
 */
export default class Database {
    constructor() {
        this.storageKeys = {
            companies: 'smartbroker_companies',
            settings: 'smartbroker_settings',
            apiUsage: 'smartbroker_api_usage',
            investigationState: 'smartbroker_investigation_state'
        };
    }

    /**
     * Save companies data to localStorage
     * @param {Array} companies - Array of company objects
     * @returns {boolean} Whether the operation was successful
     */
    saveCompanies(companies) {
        try {
            localStorage.setItem(
                this.storageKeys.companies, 
                JSON.stringify(companies)
            );
            return true;
        } catch (error) {
            console.error('Error saving companies:', error);
            return false;
        }
    }

    /**
     * Load companies data from localStorage
     * @returns {Array|null} Array of company objects or null if error
     */
    loadCompanies() {
        try {
            const data = localStorage.getItem(this.storageKeys.companies);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error loading companies:', error);
            return null;
        }
    }

    /**
     * Save settings to localStorage
     * @param {Object} settings - Settings object
     * @returns {boolean} Whether the operation was successful
     */
    saveSettings(settings) {
        try {
            localStorage.setItem(
                this.storageKeys.settings, 
                JSON.stringify(settings)
            );
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            return false;
        }
    }

    /**
     * Load settings from localStorage
     * @returns {Object|null} Settings object or null if error
     */
    loadSettings() {
        try {
            const data = localStorage.getItem(this.storageKeys.settings);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error loading settings:', error);
            return null;
        }
    }

    /**
     * Save API usage to localStorage
     * @param {Object} apiUsage - API usage object
     * @returns {boolean} Whether the operation was successful
     */
    saveApiUsage(apiUsage) {
        try {
            localStorage.setItem(
                this.storageKeys.apiUsage, 
                JSON.stringify(apiUsage)
            );
            return true;
        } catch (error) {
            console.error('Error saving API usage:', error);
            return false;
        }
    }

    /**
     * Load API usage from localStorage
     * @returns {Object|null} API usage object or null if error
     */
    loadApiUsage() {
        try {
            const data = localStorage.getItem(this.storageKeys.apiUsage);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error loading API usage:', error);
            return null;
        }
    }

    /**
     * Save investigation state to localStorage
     * @param {Object} state - Investigation state object
     * @returns {boolean} Whether the operation was successful
     */
    saveInvestigationState(state) {
        try {
            localStorage.setItem(
                this.storageKeys.investigationState, 
                JSON.stringify(state)
            );
            return true;
        } catch (error) {
            console.error('Error saving investigation state:', error);
            return false;
        }
    }

    /**
     * Load investigation state from localStorage
     * @returns {Object|null} Investigation state object or null if error
     */
    loadInvestigationState() {
        try {
            const data = localStorage.getItem(this.storageKeys.investigationState);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error loading investigation state:', error);
            return null;
        }
    }

    /**
     * Export all data to a JSON file for download
     * @returns {Object} Data object containing all application data
     */
    exportAllData() {
        try {
            const data = {
                companies: this.loadCompanies() || [],
                settings: this.loadSettings() || {},
                apiUsage: this.loadApiUsage() || {},
                investigationState: this.loadInvestigationState() || {},
                exportDate: new Date().toISOString(),
                version: '2.0'
            };
            
            return data;
        } catch (error) {
            console.error('Error exporting data:', error);
            return null;
        }
    }

    /**
     * Import data from a JSON object
     * @param {Object} data - Data object to import
     * @returns {boolean} Whether the operation was successful
     */
    importData(data) {
        try {
            if (data.companies) {
                this.saveCompanies(data.companies);
            }
            
            if (data.settings) {
                this.saveSettings(data.settings);
            }
            
            if (data.apiUsage) {
                this.saveApiUsage(data.apiUsage);
            }
            
            if (data.investigationState) {
                this.saveInvestigationState(data.investigationState);
            }
            
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }

    /**
     * Clear all data from localStorage
     * @returns {boolean} Whether the operation was successful
     */
    clearAllData() {
        try {
            localStorage.removeItem(this.storageKeys.companies);
            localStorage.removeItem(this.storageKeys.investigationState);
            // Don't clear settings and API usage as they may still be needed
            return true;
        } catch (error) {
            console.error('Error clearing data:', error);
            return false;
        }
    }

    /**
     * Save a company's research data to a separate file
     * @param {Object} company - Company object with research data
     * @returns {Object} Research data object
     */
    exportCompanyResearch(company) {
        if (!company || !company.research) {
            return null;
        }
        
        const researchData = {
            companyName: company.companyName,
            website: company.website,
            research: company.research,
            exportDate: new Date().toISOString()
        };
        
        return researchData;
    }
}