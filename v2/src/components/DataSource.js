/**
 * DataSource Component
 * Central storage for application data and configuration
 * Acts as a single source of truth for app state
 */
export default class DataSource {
    constructor() {
        this.companies = [];
        this.questions = [];
        this.results = [];
        this.settings = this.loadSettings();
        this.investigationState = {
            currentCompanyIndex: 0,
            selectedQuestionIndex: 0,
            selectedColumnIndex: 1,
            selectedCellCompanyIndex: -1,
            mode: 'column', // 'column' or 'cell'
            waitingForUserInput: false,
            ownerNamesByCompany: {},
            isPaused: false // Flag to track if investigation is paused
        };
        this.apiUsage = {
            claude: { count: 0, cost: 0 },
            perplexity: { count: 0, cost: 0 },
            lastReset: new Date().toISOString()
        };
        this.listeners = {
            companies: [],
            questions: [],
            results: [],
            settings: [],
            investigationState: [],
            apiUsage: []
        };
        
        // Load questions from server
        this.loadQuestions();
    }

    /**
     * Load questions from the server
     * Fetches questions JSON from API endpoint
     */
    async loadQuestions() {
        try {
            const response = await fetch('/api/questions');
            if (!response.ok) {
                throw new Error(`Failed to load questions: ${response.statusText}`);
            }
            
            const questions = await response.json();
            this.questions = questions;
            
            // Notify listeners that questions have changed
            this.notifyListeners('questions');
            
            console.log(`Loaded ${questions.length} questions from server`);
            return questions;
        } catch (error) {
            console.error('Error loading questions:', error);
            // Fall back to default questions if server request fails
            this.questions = this.getDefaultQuestions();
            return this.questions;
        }
    }

    /**
     * Get default questions (used as fallback if server request fails)
     * @returns {Array} Array of question objects
     */
    getDefaultQuestions() {
        return [
            { 
                text: "Does the company sell a software product or products?", 
                positiveAnswer: "YES", 
                detailedDescription: "We're looking for companies that develop and sell their own software products, as opposed to companies that primarily offer software development services or consulting.",
                searchGuidance: "Examine the company website, especially 'Products', 'Solutions', or 'Services' pages.",
                disqualificationCriteria: "The company should be disqualified if it primarily offers custom software development, IT consulting, implementation services, or integration of third-party software without having its own products."
            },
            { 
                text: "Are the company's products vertical market software?", 
                positiveAnswer: "YES", 
                detailedDescription: "Vertical market software is designed to address the needs of a specific industry or business type, rather than being general-purpose software.",
                searchGuidance: "Look at how the company describes its target market. Check if they mention specific industries they serve.",
                disqualificationCriteria: "The company should be disqualified if their products are horizontal (designed for all businesses regardless of industry)."
            }
            // Simplified default questions as fallback
        ];
    }

    /**
     * Load settings from localStorage or use defaults
     * @returns {Object} Settings object
     */
    loadSettings() {
        const savedSettings = localStorage.getItem('smartbroker_settings');
        
        if (savedSettings) {
            try {
                return JSON.parse(savedSettings);
            } catch (e) {
                console.error('Failed to load settings:', e);
            }
        }
        
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
     * Save settings to localStorage
     */
    saveSettings() {
        localStorage.setItem('smartbroker_settings', JSON.stringify(this.settings));
        this.notifyListeners('settings');
    }

    /**
     * Update settings with new values
     * @param {Object} newSettings - New settings to apply
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
    }

    /**
     * Set companies data
     * @param {Array} companies - Array of company objects
     */
    setCompanies(companies) {
        this.companies = companies;
        this.notifyListeners('companies');
    }

    /**
     * Get all companies
     * @returns {Array} Array of company objects
     */
    getCompanies() {
        return this.companies;
    }

    /**
     * Get a specific company by index
     * @param {number} index - Index of the company to retrieve
     * @returns {Object|null} Company object or null if not found
     */
    getCompany(index) {
        if (index >= 0 && index < this.companies.length) {
            return this.companies[index];
        }
        return null;
    }

    /**
     * Get all questions
     * @returns {Array} Array of question objects
     */
    getQuestions() {
        return this.questions;
    }

    /**
     * Get a specific question by index
     * @param {number} index - Index of the question to retrieve
     * @returns {Object|null} Question object or null if not found
     */
    getQuestion(index) {
        if (index >= 0 && index < this.questions.length) {
            return this.questions[index];
        }
        return null;
    }
    
    /**
     * Add a new question to the collection
     * @param {Object} question - Question object to add
     */
    async addQuestion(question) {
        try {
            const response = await fetch('/api/questions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(question)
            });
            
            if (!response.ok) {
                throw new Error(`Failed to add question: ${response.statusText}`);
            }
            
            // Reload questions from server
            await this.loadQuestions();
            return true;
        } catch (error) {
            console.error('Error adding question:', error);
            return false;
        }
    }
    
    /**
     * Update an existing question
     * @param {number} index - Index of the question to update
     * @param {Object} updatedQuestion - Updated question data
     */
    async updateQuestion(index, updatedQuestion) {
        try {
            const response = await fetch(`/api/questions/${index}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedQuestion)
            });
            
            if (!response.ok) {
                throw new Error(`Failed to update question: ${response.statusText}`);
            }
            
            // Reload questions from server
            await this.loadQuestions();
            return true;
        } catch (error) {
            console.error('Error updating question:', error);
            return false;
        }
    }
    
    /**
     * Delete a question
     * @param {number} index - Index of the question to delete
     */
    async deleteQuestion(index) {
        try {
            const response = await fetch(`/api/questions/${index}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`Failed to delete question: ${response.statusText}`);
            }
            
            // Reload questions from server
            await this.loadQuestions();
            return true;
        } catch (error) {
            console.error('Error deleting question:', error);
            return false;
        }
    }

    /**
     * Update result for a specific company and question
     * @param {number} companyIndex - Index of the company
     * @param {number} questionIndex - Index of the question
     * @param {Object} result - Result object with answer, confidence, etc.
     */
    updateResult(companyIndex, questionIndex, result) {
        // Ensure the company exists
        if (companyIndex < 0 || companyIndex >= this.companies.length) {
            console.error(`Invalid company index: ${companyIndex}`);
            return;
        }
        
        // Ensure the question exists
        if (questionIndex < 0 || questionIndex >= this.questions.length) {
            console.error(`Invalid question index: ${questionIndex}`);
            return;
        }
        
        // Special handling for owner name question (index 2)
        if (questionIndex === 2 && result.answer && 
            result.answer !== 'unknown' && result.answer !== 'NO' && 
            result.answer !== 'UNKNOWN') {
            this.investigationState.ownerNamesByCompany[companyIndex] = result.answer;
        }
        
        // Initialize research object if needed
        if (!this.companies[companyIndex].research) {
            this.companies[companyIndex].research = {};
        }
        
        // Store the result in the company object
        const questionText = this.questions[questionIndex].text;
        this.companies[companyIndex].research[questionText] = result;
        
        // Notify listeners
        this.notifyListeners('companies');
    }

    /**
     * Get result for a specific company and question
     * @param {number} companyIndex - Index of the company
     * @param {number} questionIndex - Index of the question
     * @returns {Object|null} Result object or null if not found
     */
    getResult(companyIndex, questionIndex) {
        if (companyIndex < 0 || companyIndex >= this.companies.length) {
            return null;
        }
        
        const company = this.companies[companyIndex];
        if (!company.research) {
            return null;
        }
        
        const questionText = this.questions[questionIndex].text;
        return company.research[questionText] || null;
    }

    /**
     * Update investigation state
     * @param {Object} newState - New state properties to update
     */
    updateInvestigationState(newState) {
        this.investigationState = { ...this.investigationState, ...newState };
        this.notifyListeners('investigationState');
    }

    /**
     * Get current investigation state
     * @returns {Object} Current investigation state
     */
    getInvestigationState() {
        return this.investigationState;
    }

    /**
     * Update API usage
     * @param {string} api - API name ('claude' or 'perplexity')
     * @param {number} cost - Cost of the API call in tokens/credits
     */
    updateApiUsage(api, cost = 1) {
        if (api === 'claude' || api === 'perplexity') {
            this.apiUsage[api].count += 1;
            this.apiUsage[api].cost += cost;
            this.notifyListeners('apiUsage');
            localStorage.setItem('smartbroker_api_usage', JSON.stringify(this.apiUsage));
        }
    }

    /**
     * Get API usage statistics
     * @returns {Object} API usage statistics
     */
    getApiUsage() {
        return this.apiUsage;
    }

    /**
     * Reset API usage statistics
     */
    resetApiUsage() {
        this.apiUsage = {
            claude: { count: 0, cost: 0 },
            perplexity: { count: 0, cost: 0 },
            lastReset: new Date().toISOString()
        };
        this.notifyListeners('apiUsage');
        localStorage.setItem('smartbroker_api_usage', JSON.stringify(this.apiUsage));
    }

    /**
     * Add a listener for data changes
     * @param {string} type - Type of data to listen for ('companies', 'questions', etc.)
     * @param {Function} callback - Function to call when data changes
     * @returns {Function} Function to remove the listener
     */
    addListener(type, callback) {
        if (this.listeners[type]) {
            this.listeners[type].push(callback);
            
            // Return function to remove listener
            return () => {
                this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
            };
        }
        return () => {}; // No-op if type doesn't exist
    }

    /**
     * Notify all listeners of a data change
     * @param {string} type - Type of data that changed
     */
    notifyListeners(type) {
        if (this.listeners[type]) {
            this.listeners[type].forEach(callback => callback());
        }
    }

    /**
     * Save all data to localStorage
     */
    saveToLocalStorage() {
        try {
            localStorage.setItem('smartbroker_companies', JSON.stringify(this.companies));
            localStorage.setItem('smartbroker_investigation_state', JSON.stringify(this.investigationState));
            localStorage.setItem('smartbroker_settings', JSON.stringify(this.settings));
            localStorage.setItem('smartbroker_api_usage', JSON.stringify(this.apiUsage));
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    }

    /**
     * Load all data from localStorage
     * @returns {boolean} Whether data was successfully loaded
     */
    loadFromLocalStorage() {
        try {
            const companies = localStorage.getItem('smartbroker_companies');
            const investigationState = localStorage.getItem('smartbroker_investigation_state');
            const settings = localStorage.getItem('smartbroker_settings');
            const apiUsage = localStorage.getItem('smartbroker_api_usage');
            
            if (companies) {
                this.companies = JSON.parse(companies);
                this.notifyListeners('companies');
            }
            
            if (investigationState) {
                this.investigationState = JSON.parse(investigationState);
                this.notifyListeners('investigationState');
            }
            
            if (settings) {
                this.settings = JSON.parse(settings);
                this.notifyListeners('settings');
            }
            
            if (apiUsage) {
                this.apiUsage = JSON.parse(apiUsage);
                this.notifyListeners('apiUsage');
            }
            
            return true;
        } catch (e) {
            console.error('Failed to load from localStorage:', e);
            return false;
        }
    }

    /**
     * Clear all data
     */
    clearAllData() {
        this.companies = [];
        this.investigationState = {
            currentCompanyIndex: 0,
            selectedQuestionIndex: 0,
            selectedColumnIndex: 1,
            selectedCellCompanyIndex: -1,
            mode: 'column',
            waitingForUserInput: false,
            ownerNamesByCompany: {}
        };
        
        // Don't clear settings or API usage
        
        localStorage.removeItem('smartbroker_companies');
        localStorage.removeItem('smartbroker_investigation_state');
        
        this.notifyListeners('companies');
        this.notifyListeners('investigationState');
    }
}