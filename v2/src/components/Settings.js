/**
 * Settings Component
 * Manages application settings and configuration
 */
export default class Settings {
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.settings = this.dataSource ? this.dataSource.loadSettings() : this.getDefaultSettings();
        this.elements = {};
        this.initialized = false;
    }

    /**
     * Initialize settings UI elements
     */
    initialize() {
        // Get settings UI elements
        this.elements = {
            pauseSetting: document.getElementById('pause-setting'),
            verificationSetting: document.getElementById('verification-setting'),
            anthropicKey: document.getElementById('anthropic-key'),
            perplexityKey: document.getElementById('perplexity-key')
        };
        
        // Set initial values from settings
        if (this.elements.pauseSetting) {
            // Set the checkbox to match the current setting
            this.elements.pauseSetting.checked = this.settings.pauseBetweenSearches;
            console.log('Initial pauseBetweenSearches setting:', this.settings.pauseBetweenSearches);
            
            this.elements.pauseSetting.addEventListener('change', () => {
                const checked = this.elements.pauseSetting.checked;
                console.log('Pause Between Searches checkbox changed to:', checked);
                this.updateSetting('pauseBetweenSearches', checked);
                
                // Force-save to localStorage to ensure it's saved
                localStorage.setItem('smartbroker_settings', JSON.stringify(this.settings));
                
                console.log('Settings after update:', this.settings);
            });
        }
        
        if (this.elements.verificationSetting) {
            this.elements.verificationSetting.checked = this.settings.verifyResults;
            
            this.elements.verificationSetting.addEventListener('change', () => {
                this.updateSetting('verifyResults', this.elements.verificationSetting.checked);
            });
        }
        
        if (this.elements.anthropicKey) {
            this.elements.anthropicKey.value = this.settings.anthropicKey || '';
            
            this.elements.anthropicKey.addEventListener('change', () => {
                this.updateSetting('anthropicKey', this.elements.anthropicKey.value);
            });
        }
        
        if (this.elements.perplexityKey) {
            this.elements.perplexityKey.value = this.settings.perplexityKey || '';
            
            this.elements.perplexityKey.addEventListener('change', () => {
                this.updateSetting('perplexityKey', this.elements.perplexityKey.value);
            });
        }
        
        this.initialized = true;
    }

    /**
     * Get default settings
     * @returns {Object} Default settings
     */
    getDefaultSettings() {
        return {
            pauseBetweenSearches: true,
            verifyResults: true,
            maxDailyRequests: 100,
            anthropicKey: '',
            perplexityKey: '',
            maxTools: 3,
            autoSave: true
        };
    }

    /**
     * Load settings from localStorage
     * @returns {Object} Loaded settings
     */
    loadSettings() {
        const savedSettings = localStorage.getItem('smartbroker_settings');
        
        if (savedSettings) {
            try {
                this.settings = JSON.parse(savedSettings);
                this.updateUI();
                return this.settings;
            } catch (e) {
                console.error('Failed to load settings:', e);
            }
        }
        
        // Use defaults if no saved settings
        this.settings = this.getDefaultSettings();
        return this.settings;
    }

    /**
     * Update a setting
     * @param {string} key - Setting key
     * @param {any} value - Setting value
     */
    updateSetting(key, value) {
        this.settings[key] = value;
        
        // Save to dataSource if available
        if (this.dataSource) {
            this.dataSource.updateSettings(this.settings);
        } else {
            // Otherwise save directly to localStorage
            localStorage.setItem('smartbroker_settings', JSON.stringify(this.settings));
        }
        
        // Call onSettingsChange callback if provided
        if (this.onSettingsChange) {
            this.onSettingsChange(key, value, this.settings);
        }
    }

    /**
     * Update UI with current settings
     */
    updateUI() {
        if (!this.initialized) {
            this.initialize();
            return;
        }
        
        // Update UI elements with current settings
        if (this.elements.pauseSetting) {
            this.elements.pauseSetting.checked = this.settings.pauseBetweenSearches;
        }
        
        if (this.elements.verificationSetting) {
            this.elements.verificationSetting.checked = this.settings.verifyResults;
        }
        
        if (this.elements.anthropicKey) {
            this.elements.anthropicKey.value = this.settings.anthropicKey || '';
        }
        
        if (this.elements.perplexityKey) {
            this.elements.perplexityKey.value = this.settings.perplexityKey || '';
        }
    }

    /**
     * Get API keys
     * @returns {Object} API keys
     */
    getAPIKeys() {
        return {
            anthropicKey: this.settings.anthropicKey,
            perplexityKey: this.settings.perplexityKey
        };
    }

    /**
     * Get all settings
     * @returns {Object} All settings
     */
    getAllSettings() {
        return { ...this.settings };
    }

    /**
     * Get a specific setting
     * @param {string} key - Setting key
     * @returns {any} Setting value
     */
    getSetting(key) {
        return this.settings[key];
    }

    /**
     * Reset settings to defaults
     */
    resetToDefaults() {
        this.settings = this.getDefaultSettings();
        
        // Save to dataSource if available
        if (this.dataSource) {
            this.dataSource.updateSettings(this.settings);
        } else {
            // Otherwise save directly to localStorage
            localStorage.setItem('smartbroker_settings', JSON.stringify(this.settings));
        }
        
        this.updateUI();
        
        // Call onSettingsChange callback if provided
        if (this.onSettingsChange) {
            this.onSettingsChange('reset', null, this.settings);
        }
    }
    
    /**
     * Set settings change callback
     * @param {Function} callback - Callback function
     */
    setOnSettingsChange(callback) {
        this.onSettingsChange = callback;
    }
}