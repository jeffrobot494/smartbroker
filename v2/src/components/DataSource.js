/**
 * DataSource Component
 * Central storage for application data and configuration
 * Acts as a single source of truth for app state
 */
export default class DataSource {
    constructor() {
        this.companies = [];
        this.questions = this.initQuestions();
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
    }

    /**
     * Initialize with predefined questions
     * @returns {Array} Array of question objects
     */
    initQuestions() {
        return [
            { 
                text: "Does the company sell a software product or products?", 
                positiveAnswer: "YES", 
                detailedDescription: "We're looking for companies that develop and sell their own software products, as opposed to companies that primarily offer software development services or consulting. A software product is a packaged application or platform that clients can purchase, license, or subscribe to use. If the company appears to primarily sell a software product, whether to businesses or consumers, it passes this question with a YES.",
                searchGuidance: "Examine the company website, especially 'Products', 'Solutions', or 'Services' pages. Look for specific named software offerings, pricing pages, demo requests, or product screenshots. Software products typically have specific names, features lists, and may mention licensing models.",
                disqualificationCriteria: "The company should be disqualified if it primarily offers custom software development, IT consulting, implementation services, or integration of third-party software without having its own products. Companies describing themselves as 'software development shops' or 'dev agencies' are typically not what we're looking for."
            },
            { 
                text: "Are the company's products vertical market software?", 
                positiveAnswer: "YES", 
                detailedDescription: "Vertical market software is designed to address the needs of a specific industry or business type, rather than being general-purpose software. We're looking for software that specializes in a particular industry vertical like healthcare, legal, construction, manufacturing, etc.",
                searchGuidance: "Look at how the company describes its target market. Check if they mention specific industries they serve. Examine customer testimonials and case studies for industry focus. Look for industry-specific terminology or features in their product descriptions.",
                disqualificationCriteria: "The company should be disqualified if their products are horizontal (designed for all businesses regardless of industry) like general accounting software, generalized CRM, or productivity tools that aren't industry-specific."
            },
            { 
                text: "Who is the president or owner of the company?", 
                positiveAnswer: "NAME", 
                detailedDescription: "We need to identify the primary decision-maker at the company - typically the founder, CEO, president, or majority owner. For small businesses, this is often one person who holds a title like Owner, President, CEO, or Founder.",
                searchGuidance: "Check the company website's 'About Us', 'Team', or 'Leadership' pages. LinkedIn company page often lists key executives. For smaller companies, also look at LinkedIn profiles connected to the company with founder/owner/CEO titles. State business registrations sometimes list owners/officers.",
                disqualificationCriteria: "This question doesn't disqualify a company, but is used to gather information for subsequent questions. If no clear owner can be identified, note this but continue with other questions."
            },
            { 
                text: "Is the owner of the company at least 50 years old?", 
                positiveAnswer: "YES", 
                detailedDescription: "We need to verify if the identified owner/president is at least 50 years of age. This helps identify established business owners rather than younger entrepreneurs.",
                searchGuidance: "Use public records services or search for information about education/career timeline that might indicate approximate age. Look for graduation dates on LinkedIn that might suggest approximate age (e.g., college graduation in 1995 or earlier would suggest they're likely 50+). Search for news articles or interviews that might mention age or career length.",
                disqualificationCriteria: "If you find concrete evidence that the owner is under 50 years old, the company should be disqualified."
            },
            { 
                text: "Does the company number between 5 and 40 employees?", 
                positiveAnswer: "YES", 
                detailedDescription: "We're looking for small businesses with enough employees to be established (at least 5) but not so large that they're beyond our target size (no more than 40).",
                searchGuidance: "Check LinkedIn company page which often shows employee count. Look at the company website's team or about page to count visible employees. If exact counts aren't available, you might estimate based on company size descriptions (small, medium) and annual revenue.",
                disqualificationCriteria: "Companies with fewer than 5 employees may be too small or too new. Companies with more than 40 employees are too large for our criteria."
            },
            { 
                text: "Is the company bootstrapped?", 
                positiveAnswer: "YES", 
                detailedDescription: "We're looking for companies that are self-funded (bootstrapped) rather than venture-backed or private equity owned. Bootstrapped companies are typically funded by the founders, their revenue, or small personal investments rather than institutional investors.",
                searchGuidance: "Look for funding information on Crunchbase, which typically lists investment rounds. Check company press releases or news for mentions of funding. Review the company's 'About Us' page which might mention their funding approach. Absence of VC funding information often suggests bootstrapping.",
                disqualificationCriteria: "Evidence of venture capital funding, private equity ownership, or being acquired by a larger company would disqualify the business. If there's no indication of external funding, assume the company is bootstrapped."
            },
            { 
                text: "Are the majority of the employees based in the USA?", 
                positiveAnswer: "YES", 
                detailedDescription: "We want to identify companies with most of their workforce in the United States rather than primarily offshore operations.",
                searchGuidance: "Check the company website for office locations. Look at employee LinkedIn profiles to see where they're located. Check job postings to see where they're hiring.",
                disqualificationCriteria: "If most employees appear to be located outside the USA, or if the company primarily advertises its offshore development capabilities, it should be disqualified."
            }
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