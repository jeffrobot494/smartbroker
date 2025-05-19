/**
 * Main application logic for SmartBroker v2
 */
import CSVReader from './components/CSVReader.js';
import DataSource from './components/DataSource.js';
import PromptGenerator from './components/PromptGenerator.js';
import Tools from './components/Tools.js';
import ResearchLoop from './components/ResearchLoop.js';
import ContextManager from './components/ContextManager.js';
import Database from './components/Database.js';
import TerminalWindow from './components/TerminalWindow.js';
import DataTable from './components/DataTable.js';
import Exporter from './components/Exporter.js';
import Settings from './components/Settings.js';
import APIUsage from './components/APIUsage.js';
import Verification from './components/Verification.js';

/**
 * SmartBroker Application
 */
export default class App {
    constructor() {
        // Initialize components
        this.dataSource = new DataSource();
        this.database = new Database();
        this.settings = new Settings(this.dataSource);
        this.tools = new Tools();
        this.promptGenerator = new PromptGenerator();
        this.contextManager = new ContextManager();
        this.apiUsage = new APIUsage(this.dataSource);
        this.verification = new Verification(this.tools);
        this.exporter = new Exporter();
        
        // UI components
        this.terminalWindow = null; // Will be initialized after DOM is loaded
        this.dataTable = null; // Will be initialized after DOM is loaded
        
        // Research loop
        this.researchLoop = new ResearchLoop(
            this.tools,
            this.promptGenerator,
            this.contextManager,
            this.verification
        );
        
        // Set the data source reference in research loop
        this.researchLoop.setDataSource(this.dataSource);
        
        // Application state
        this.isResearching = false;
        this.loadFromLocalStorage();
        
        // Initialize UI
        this.initUI();
    }

    /**
     * Initialize UI elements and event listeners
     */
    initUI() {
        console.log('initUI called');
        
        // Check if DOM is already loaded
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            console.log('DOM already loaded, initializing UI immediately');
            this.initializeComponents();
        } else {
            // Initialize components after DOM is loaded
            console.log('DOM not loaded yet, setting up DOMContentLoaded listener');
            document.addEventListener('DOMContentLoaded', () => {
                console.log('DOMContentLoaded fired, initializing UI');
                this.initializeComponents();
            });
        }
    }
    
    /**
     * Initialize UI components after DOM is loaded
     * This was extracted from initUI to avoid nesting
     */
    initializeComponents() {
        console.log('Initializing UI components');
        
        // Initialize terminal window
        this.terminalWindow = new TerminalWindow('terminal-output', 'terminal-input');
        
        // Initialize settings UI
        this.settings.initialize();
        
        // Initialize data table
        this.dataTable = new DataTable('company-data-table', 'company-data-tbody', {
            onColumnSelect: this.handleColumnSelect.bind(this),
            onCellSelect: this.handleCellSelect.bind(this),
            onCompanySelect: this.handleCompanySelect.bind(this)
        });
        
        // Update table with companies data
        this.dataTable.populateTable(this.dataSource.getCompanies());
        this.dataTable.updateTableWithResults(this.dataSource.getCompanies());
        
        // Set up event listeners
        console.log('Setting up event listeners');
        this.setupEventListeners();
        
        // Update API usage display
        this.apiUsage.updateDisplay();
        
        // Enable start button if we have companies and API keys
        this.updateStartButtonState();
        
        // Verify stop button event handler is attached
        console.log('Verifying stop button is properly set up');
        const stopBtn = document.getElementById('stop-btn');
        if (stopBtn) {
            console.log('Stop button found in initializeComponents');
        } else {
            console.error('Stop button not found in initializeComponents');
        }
    }

    /**
     * Set up event listeners for UI elements
     */
    setupEventListeners() {
        // CSV file upload
        const csvUploadBtn = document.getElementById('csv-upload-btn');
        const csvFileInput = document.getElementById('csv-file-input');
        
        if (csvUploadBtn && csvFileInput) {
            console.log('Setting up CSV upload event handlers in App.setupEventListeners');
            
            // Clear any existing listeners to prevent duplicates
            csvUploadBtn.removeEventListener('click', () => csvFileInput.click());
            
            // Add click event to the upload button
            csvUploadBtn.addEventListener('click', () => {
                console.log('CSV upload button clicked');
                csvFileInput.click();
            });
            
            // Add change event to the file input
            csvFileInput.addEventListener('change', (event) => {
                console.log('CSV file input changed, handling upload');
                this.handleCSVUpload(event);
            });
        } else {
            console.error('CSV upload elements not found');
        }
        
        // Start investigation button
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            console.log('Found start button, adding click event listener');
            startBtn.addEventListener('click', () => {
                console.log('Start button clicked - direct handler');
                this.handleStartInvestigation();
            });
        } else {
            console.error('Could not find start-btn element');
        }
        
        // Stop investigation button
        const stopBtn = document.getElementById('stop-btn');
        if (stopBtn) {
            console.log('Found stop button, adding click event listener');
            stopBtn.addEventListener('click', () => {
                console.log('Stop button clicked - attempting to stop investigation');
                this.handleStopInvestigation();
            });
        } else {
            console.error('Could not find stop-btn element');
        }
        
        // Reset button
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', this.handleReset.bind(this));
        }
        
        // Export button
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', this.handleExport.bind(this));
        }
        
        // Clear terminal button
        const clearTerminalBtn = document.getElementById('clear-terminal-btn');
        if (clearTerminalBtn) {
            clearTerminalBtn.addEventListener('click', () => {
                // Ensure terminal window is initialized
                if (!this.terminalWindow || typeof this.terminalWindow.clear !== 'function') {
                    console.log('Terminal window not properly initialized, recreating it');
                    this.terminalWindow = new TerminalWindow('terminal-output', 'terminal-input');
                }
                
                // Clear the terminal
                this.terminalWindow.clear();
                
                // Add initial message back
                this.terminalWindow.append('Terminal cleared. Ready for new operations.', true);
            });
        }
        
        // Assume APIs are configured on the server
        
        // Settings checkboxes
        const pauseSettingCheckbox = document.getElementById('pause-setting');
        const verificationSettingCheckbox = document.getElementById('verification-setting');
        
        if (pauseSettingCheckbox) {
            pauseSettingCheckbox.addEventListener('change', () => {
                this.settings.updateSetting('pauseBetweenSearches', pauseSettingCheckbox.checked);
            });
        }
        
        if (verificationSettingCheckbox) {
            verificationSettingCheckbox.addEventListener('change', () => {
                this.settings.updateSetting('verifyResults', verificationSettingCheckbox.checked);
            });
        }
    }

    /**
     * Update start button state based on available data and API keys
     */
    // Removed checkApiStatus method - we now assume APIs are configured

    updateStartButtonState() {
        const startBtn = document.getElementById('start-btn');
        const stopBtn = document.getElementById('stop-btn');
        const resetBtn = document.getElementById('reset-btn');
        const exportBtn = document.getElementById('export-btn');
        
        const hasCompanies = this.dataSource.getCompanies().length > 0;
        // Always assume APIs are configured on the server
        const hasAPIAccess = true;
        const isPaused = this.dataSource.getInvestigationState().isPaused;
        
        // Start button - enabled if we have companies and not researching
        if (startBtn) {
            startBtn.disabled = !hasCompanies || this.isResearching;
            
            if (!hasCompanies) {
                startBtn.title = 'Upload a CSV file first';
            } else if (isPaused) {
                startBtn.textContent = 'Resume Investigation';
                startBtn.title = 'Resume the paused investigation';
            } else {
                startBtn.textContent = 'Start Investigation';
                startBtn.title = '';
            }
        }
        
        // Stop button - enabled only when actively researching
        if (stopBtn) {
            stopBtn.disabled = !this.isResearching;
        }
        
        // Reset button - enabled if we have companies and not researching
        if (resetBtn) {
            resetBtn.disabled = !hasCompanies || this.isResearching;
        }
        
        // Export button - enabled if we have results and not researching
        if (exportBtn) {
            const hasResults = hasCompanies && this.dataSource.getCompanies().some(company => company.research);
            exportBtn.disabled = !hasResults || this.isResearching;
        }
    }

    /**
     * Handle CSV file upload
     * @param {Event} event - File input change event
     */
    async handleCSVUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            // Ensure terminal window is properly initialized
            if (!this.terminalWindow || typeof this.terminalWindow.append !== 'function') {
                console.log('Terminal window not properly initialized, recreating it');
                this.terminalWindow = new TerminalWindow('terminal-output', 'terminal-input');
            }
            
            // Parse CSV file
            this.terminalWindow.append(`Reading CSV file: ${file.name}...`, true);
            
            const rawData = await CSVReader.readCSVFile(file);
            
            // Validate CSV structure
            const validation = CSVReader.validateCSVStructure(rawData, ['Company']);
            
            if (!validation.isValid) {
                this.terminalWindow.append(
                    `Error: CSV file is missing required fields: ${validation.missingFields.join(', ')}`,
                    true
                );
                return;
            }
            
            // Format company data
            const companies = CSVReader.formatCompanyData(rawData);
            
            this.terminalWindow.append(`Loaded ${companies.length} companies from ${file.name}`, true);
            
            // Update datasource
            this.dataSource.setCompanies(companies);
            
            // Update data table if initialized
            if (this.dataTable) {
                this.dataTable.populateTable(companies);
            } else {
                console.log('DataTable not initialized yet, initializing now');
                // Create data table on-demand if needed
                this.dataTable = new DataTable('company-data-table', 'company-data-tbody', {
                    onColumnSelect: this.handleColumnSelect.bind(this),
                    onCellSelect: this.handleCellSelect.bind(this),
                    onCompanySelect: this.handleCompanySelect.bind(this)
                });
                this.dataTable.populateTable(companies);
            }
            
            // Update CSV info display
            const dataSourceDisplay = document.getElementById('data-source-display');
            if (dataSourceDisplay) {
                dataSourceDisplay.textContent = file.name;
            }
            
            // Update start button state
            this.updateStartButtonState();
            
            // Save to local storage
            this.database.saveCompanies(companies);
            
        } catch (error) {
            this.terminalWindow.append(`Error reading CSV file: ${error.message}`, true);
            console.error('CSV upload error:', error);
        }
    }

    /**
     * Handle start investigation button click
     */
    async handleStartInvestigation() {
        console.log('handleStartInvestigation called');
        if (this.isResearching) {
            console.log('Already researching, returning');
            return;
        }
        
        const companies = this.dataSource.getCompanies();
        console.log('Companies:', companies);
        if (!companies.length) {
            console.log('No companies found');
            this.terminalWindow.append('No companies to research. Please upload a CSV file first.', true);
            return;
        }
        
        // Check if investigation was paused
        const state = this.dataSource.getInvestigationState();
        const isPaused = state.isPaused;
        
        // Update UI buttons
        const startBtn = document.getElementById('start-btn');
        const stopBtn = document.getElementById('stop-btn');
        
        if (startBtn) {
            console.log('Disabling start button');
            startBtn.disabled = true;
        }
        
        if (stopBtn) {
            console.log('Enabling stop button');
            stopBtn.disabled = false;
        }
        
        console.log('Setting isResearching = true');
        this.isResearching = true;
        
        try {
            console.log('Appending to terminal window');
            
            if (isPaused) {
                this.terminalWindow.append('Resuming paused investigation...', true);
                // Reset the paused flag when resuming
                this.dataSource.updateInvestigationState({ isPaused: false });
            } else {
                this.terminalWindow.append('Starting investigation...', true);
            }
            
            // Get current investigation state
            console.log('Getting investigation state');
            const state = this.dataSource.getInvestigationState();
            console.log('Current state:', state);
            
            // Set up research loop callbacks
            console.log('Setting up research loop callbacks');
            this.researchLoop.setCallbacks({
                onStart: this.handleResearchStart.bind(this),
                onToolRequest: this.handleToolRequest.bind(this),
                onToolResult: this.handleToolResult.bind(this),
                onPrompt: this.handleClaudePrompt.bind(this),
                onResponse: this.handleClaudeResponse.bind(this),
                onComplete: this.handleResearchComplete.bind(this),
                onError: this.handleResearchError.bind(this),
                onIteration: this.handleResearchIteration.bind(this),
                onPaused: this.handleResearchPaused.bind(this)
            });
            
            // Set max iterations from settings
            const maxTools = this.settings.getSetting('maxTools') || 3;
            console.log('Setting max iterations to:', maxTools);
            this.researchLoop.setMaxIterations(maxTools);
            
            let companyIndex, questionIndex;
            
            if (state.mode === 'cell') {
                // Cell mode: research specific company/question
                console.log('Using cell mode');
                companyIndex = state.selectedCellCompanyIndex;
                questionIndex = state.selectedQuestionIndex;
                console.log(`Researching company ${companyIndex}, question ${questionIndex}`);
                
                // Check if the investigation has been paused
                if (this.dataSource.getInvestigationState().isPaused) {
                    console.log('Investigation paused before starting cell research');
                    this.terminalWindow.append(
                        `Investigation paused. Click "Resume Investigation" to continue.`,
                        true
                    );
                    return; // Exit early if already paused
                }
                
                const result = await this.researchCompanyQuestion(companyIndex, questionIndex);
                
                // No need to check result.paused here as cell mode is a single operation
                
            } else {
                // Column mode: research all companies for selected question
                console.log('Using column mode');
                questionIndex = state.selectedQuestionIndex;
                console.log('Selected question index:', questionIndex);
                
                for (companyIndex = state.currentCompanyIndex; companyIndex < companies.length; companyIndex++) {
                    console.log(`Processing company ${companyIndex}: ${companies[companyIndex].companyName}`);
                    // Update current company index
                    this.dataSource.updateInvestigationState({ currentCompanyIndex: companyIndex });
                    
                    // Check if the investigation has been paused
                    if (this.dataSource.getInvestigationState().isPaused) {
                        console.log('Investigation paused, breaking out of company loop');
                        this.terminalWindow.append(
                            `Investigation paused. Will resume from ${companies[companyIndex].companyName} when continued.`,
                            true
                        );
                        break; // Exit the loop and stop processing more companies
                    }
                    
                    // Check if this company already has results for this question
                    const existingResult = this.dataSource.getResult(companyIndex, questionIndex);
                    if (existingResult) {
                        console.log('Company already researched, skipping');
                        this.terminalWindow.append(
                            `Skipping ${companies[companyIndex].companyName} - already researched`,
                            true
                        );
                        continue;
                    }
                    
                    console.log('Researching company/question');
                    const result = await this.researchCompanyQuestion(companyIndex, questionIndex);
                    
                    // Check if the research was paused, and if so, exit the loop
                    if (result && result.paused) {
                        console.log('Research returned with paused state, stopping further processing');
                        break;
                    }
                    
                    // Save current state
                    console.log('Saving to localStorage');
                    this.saveToLocalStorage();
                }
                
                // Reset current company index after finishing all companies
                console.log('Resetting current company index');
                this.dataSource.updateInvestigationState({ currentCompanyIndex: 0 });
            }
            
            console.log('Investigation complete');
            this.terminalWindow.append('Investigation complete!', true);
            
        } catch (error) {
            console.error('Investigation error:', error);
            this.terminalWindow.append(`Investigation error: ${error.message}`, true);
        } finally {
            console.log('Setting isResearching = false');
            this.isResearching = false;
            if (startBtn) {
                console.log('Re-enabling start button');
                startBtn.disabled = false;
            }
            this.updateStartButtonState();
        }
    }

    /**
     * Research a specific company/question pair
     * @param {number} companyIndex - Company index
     * @param {number} questionIndex - Question index
     */
    async researchCompanyQuestion(companyIndex, questionIndex) {
        console.log(`researchCompanyQuestion(${companyIndex}, ${questionIndex})`);
        
        const companies = this.dataSource.getCompanies();
        const questions = this.dataSource.getQuestions();
        
        console.log('Companies length:', companies.length);
        console.log('Questions length:', questions.length);
        
        if (companyIndex < 0 || companyIndex >= companies.length || 
            questionIndex < 0 || questionIndex >= questions.length) {
            console.error('Invalid indices:', { companyIndex, questionIndex, 
                companiesLength: companies.length, questionsLength: questions.length });
            throw new Error('Invalid company or question index');
        }
        
        const company = companies[companyIndex];
        const question = questions[questionIndex];
        
        console.log('Researching company:', company.companyName);
        console.log('Question:', question.text);
        
        this.terminalWindow.append(`Researching ${company.companyName} for: ${question.text}`, true);
        
        // Get previous findings from other questions
        const previousFindings = {};
        
        // Special handling for owner age question
        if (questionIndex === 3) {
            const ownerName = this.dataSource.getInvestigationState().ownerNamesByCompany[companyIndex];
            if (ownerName) {
                previousFindings['Owner Name'] = ownerName;
                console.log('Using previous owner name:', ownerName);
                this.terminalWindow.append(`Using previously found owner name: ${ownerName} for age research`);
            }
        }
        
        // Get research options from settings
        const options = {
            pauseBetweenSearches: this.settings.getSetting('pauseBetweenSearches'),
            verifyResults: this.settings.getSetting('verifyResults'),
            maxTools: this.settings.getSetting('maxTools') || 3,
            previousFindings
        };
        
        console.log('Research options:', options);
        
        // Start the research
        console.log('Starting research with research loop');
        try {
            const result = await this.researchLoop.startResearch(company, question, options);
            console.log('Research complete, result:', result);
            
            // Update data source with the result
            console.log('Updating data source with result');
            this.dataSource.updateResult(companyIndex, questionIndex, result);
            
            // Update data table
            console.log('Updating data table cell');
            this.dataTable.updateCell(
                companyIndex, 
                questionIndex, 
                result.answer, 
                result.confidence
            );
            
            // Track API usage
            if (result.usage) {
                console.log('Tracking Claude API usage');
                this.apiUsage.trackClaudeUsage(
                    result.usage.input_tokens || 0,
                    result.usage.output_tokens || 0
                );
            }
            
            // Track Perplexity usage based on tools used
            if (result.toolsUsed && result.toolsUsed.length) {
                console.log('Tracking Perplexity API usage');
                this.apiUsage.trackPerplexityUsage(result.toolsUsed.length);
            }
            
            return result;
        } catch (error) {
            console.error('Error in researchCompanyQuestion:', error);
            throw error;
        }
    }

    /**
     * Handle column selection
     * @param {number} columnIndex - Selected column index
     */
    handleColumnSelect(columnIndex) {
        // Update investigation state
        this.dataSource.updateInvestigationState({
            selectedQuestionIndex: columnIndex - 1,
            selectedColumnIndex: columnIndex,
            selectedCellCompanyIndex: -1,
            currentCompanyIndex: 0, // Reset to first company whenever a column is selected
            mode: 'column',
            isPaused: false // Reset paused state when selecting a column
        });
        
        const question = this.dataSource.getQuestions()[columnIndex - 1];
        
        this.terminalWindow.append(`Selected question: ${question.text}`, true);
        this.terminalWindow.append(`Investigation will start from the first company`, true);
    }

    /**
     * Handle cell selection
     * @param {number} companyIndex - Selected company index
     * @param {number} questionIndex - Selected question index
     */
    handleCellSelect(companyIndex, questionIndex) {
        // Update investigation state
        this.dataSource.updateInvestigationState({
            selectedQuestionIndex: questionIndex,
            selectedColumnIndex: questionIndex + 1,
            selectedCellCompanyIndex: companyIndex,
            currentCompanyIndex: companyIndex,
            mode: 'cell',
            isPaused: false // Reset paused state when selecting a cell
        });
        
        const company = this.dataSource.getCompanies()[companyIndex];
        const question = this.dataSource.getQuestions()[questionIndex];
        
        this.terminalWindow.append(`Selected to research: ${company.companyName}`, true);
        this.terminalWindow.append(`For question: ${question.text}`);
    }

    /**
     * Handle company selection
     * @param {number} companyIndex - Selected company index
     */
    handleCompanySelect(companyIndex) {
        const company = this.dataSource.getCompanies()[companyIndex];
        
        // Clear terminal
        this.terminalWindow.clear();
        
        // Display company name as header
        this.terminalWindow.append(`Research History for ${company.companyName}`, true);
        this.terminalWindow.append(`Website: ${company.website || 'Not available'}`);
        
        // Check if company has research data
        if (!company.research || Object.keys(company.research).length === 0) {
            this.terminalWindow.append("\nNo research history available for this company.");
            return;
        }
        
        // Display each question's research data
        Object.entries(company.research).forEach(([questionText, researchData]) => {
            this.terminalWindow.append(`\n--- ${questionText} ---`, true);
            
            // Display final answer
            const result = researchData.result || researchData;
            this.terminalWindow.append(`Answer: ${result.answer}`);
            this.terminalWindow.append(`Confidence: ${result.confidence}`);
            
            // Display tool usage if available
            if (researchData.toolsUsed && researchData.toolsUsed.length > 0) {
                this.terminalWindow.append(`\nTools Used (${researchData.toolsUsed.length}):`);
                researchData.toolsUsed.forEach((tool, i) => {
                    this.terminalWindow.append(`${i + 1}. ${tool.tool}: ${JSON.stringify(tool.params)}`);
                });
            }
            
            // Show evidence if available
            if (result.evidence) {
                this.terminalWindow.append(`\nEvidence: ${result.evidence}`);
            }
            
            // Show sources if available
            if (result.sources) {
                this.terminalWindow.append(`\nSources: ${result.sources}`);
            }
            
            // Show full Claude response
            if (researchData.claudeResponse) {
                this.terminalWindow.append(`\nFull Research Response:`, true);
                this.terminalWindow.append(`======== CLAUDE RESPONSE START ========`);
                this.terminalWindow.append(researchData.claudeResponse);
                this.terminalWindow.append(`======== CLAUDE RESPONSE END ========`);
            }
            
            // Show timestamp
            if (researchData.timestamp) {
                this.terminalWindow.append(`\nResearched: ${new Date(researchData.timestamp).toLocaleString()}`);
            }
        });
    }

    /**
     * Handle reset button click
     */
    handleReset() {
        if (confirm('Are you sure you want to reset all research data?')) {
            // Clear data source
            this.dataSource.clearAllData();
            
            // Clear database
            this.database.clearAllData();
            
            // Update data table
            this.dataTable.populateTable(this.dataSource.getCompanies());
            
            // Update terminal
            this.terminalWindow.append('All research data has been reset.', true);
            
            // Update start button state
            this.updateStartButtonState();
        }
    }

    /**
     * Handle export button click
     */
    handleExport() {
        const companies = this.dataSource.getCompanies();
        const questions = this.dataSource.getQuestions();
        
        const exportFormat = prompt('Export format (csv, json, excel):', 'csv');
        
        if (!exportFormat) return;
        
        const includeConfidence = confirm('Include confidence levels?');
        const includeMetadata = confirm('Include additional company metadata?');
        
        const options = {
            includeConfidence,
            includeMetadata
        };
        
        this.exporter.export(companies, questions, exportFormat, options);
    }

    /**
     * Handle research start
     * @param {Object} data - Start event data
     */
    handleResearchStart(data) {
        const spinnerEl = document.getElementById('loading-spinner');
        if (spinnerEl) {
            spinnerEl.style.display = 'block';
        }
    }

    /**
     * Handle tool request
     * @param {Object} toolRequest - Tool request data
     * @returns {Promise<boolean>} Whether to proceed with the tool
     */
    async handleToolRequest(toolRequest) {
        console.log('App.handleToolRequest called with:', toolRequest);
        this.terminalWindow.appendToolRequest(toolRequest);
        
        // Force reload settings from localStorage to ensure we have the latest value
        const settingsFromStorage = localStorage.getItem('smartbroker_settings');
        let pauseBetweenSearches = false;
        
        if (settingsFromStorage) {
            try {
                const parsedSettings = JSON.parse(settingsFromStorage);
                pauseBetweenSearches = parsedSettings.pauseBetweenSearches;
                console.log('pauseBetweenSearches from localStorage:', pauseBetweenSearches);
            } catch (e) {
                console.error('Error parsing settings from localStorage:', e);
            }
        }
        
        // Also check the setting from settings object
        const settingFromObject = this.settings.getSetting('pauseBetweenSearches');
        console.log('pauseBetweenSearches from settings object:', settingFromObject);
        
        // Check the actual checkbox state
        const checkbox = document.getElementById('pause-setting');
        console.log('pauseBetweenSearches checkbox checked:', checkbox?.checked);
        
        // Use the checkbox state directly for the most accurate value
        if (checkbox && checkbox.checked) {
            console.log('Pause checkbox is checked, waiting for user confirmation...');
            // Wait for user confirmation
            this.terminalWindow.append('Press Enter to approve this tool use...');
            
            try {
                console.log('Calling terminalWindow.waitForInput()');
                await this.terminalWindow.waitForInput();
                console.log('User confirmed tool use');
                return true;
            } catch (error) {
                console.error('Error in waitForInput:', error);
                this.terminalWindow.append('Tool use cancelled.');
                return false;
            }
        } else {
            console.log('Pause checkbox is unchecked, automatically approving tool use');
        }
        
        return true;
    }

    /**
     * Handle tool result
     * @param {Object} data - Tool result data
     */
    handleToolResult(data) {
        this.terminalWindow.appendToolResult(data.result);
    }
    
    /**
     * Handle stop investigation button click
     */
    handleStopInvestigation() {
        console.log('*** STOP INVESTIGATION METHOD CALLED ***');
        console.log('this.isResearching:', this.isResearching);
        console.log('this.dataSource exists:', !!this.dataSource);
        console.log('this.terminalWindow exists:', !!this.terminalWindow);
        
        if (!this.isResearching) {
            console.log('Not researching, cannot stop');
            return;
        }
        
        // Update data source state
        this.dataSource.updateInvestigationState({ 
            isPaused: true 
        });
        console.log('Updated investigation state, isPaused set to true');
        
        // Update UI
        this.terminalWindow.append('Investigation paused. Click Start Investigation to resume.', true);
        
        // Hide the loading spinner
        const spinnerEl = document.getElementById('loading-spinner');
        if (spinnerEl) {
            console.log('Hiding loading spinner');
            spinnerEl.style.display = 'none';
        }
        
        // Update application state
        this.isResearching = false;
        this.updateStartButtonState();
        console.log('Stop investigation complete - research paused');
    }
    
    /**
     * Handle research paused callback
     * @param {Object} data - Pause event data including company and question
     */
    handleResearchPaused(data) {
        console.log('Research paused callback received:', data);
        
        // Get company name for better messaging
        const companyName = data.company?.companyName || 'Unknown company';
        const questionText = data.question?.text || 'Unknown question';
        
        // Add a message to the terminal
        this.terminalWindow.append(`Research paused for ${companyName} on question: ${questionText}`, true);
        this.terminalWindow.append('Click "Resume Investigation" button to continue from this point.', true);
        
        // Hide the loading spinner
        const spinnerEl = document.getElementById('loading-spinner');
        if (spinnerEl) {
            console.log('Hiding loading spinner from handleResearchPaused');
            spinnerEl.style.display = 'none';
        }
        
        // Make sure app state is updated
        this.isResearching = false;
        this.updateStartButtonState();
        
        // Save current state to preserve progress
        this.saveToLocalStorage();
    }

    /**
     * Handle research completion
     * @param {Object} result - Research result
     */
    handleResearchComplete(result) {
        // Display final result
        this.terminalWindow.append(`Research complete!`, true);
        this.terminalWindow.append(`Final Answer: ${result.answer}`);
        this.terminalWindow.append(`Confidence: ${result.confidence}`);
        
        // Hide spinner
        const spinnerEl = document.getElementById('loading-spinner');
        if (spinnerEl) {
            spinnerEl.style.display = 'none';
        }
    }

    /**
     * Handle research error
     * @param {Error} error - Research error
     */
    handleResearchError(error) {
        this.terminalWindow.append(`Research error: ${error.message}`, true);
        console.error('Research error:', error);
        
        // Hide spinner
        const spinnerEl = document.getElementById('loading-spinner');
        if (spinnerEl) {
            spinnerEl.style.display = 'none';
        }
    }

    /**
     * Handle research iteration
     * @param {Object} data - Iteration data
     */
    handleResearchIteration(data) {
        // Update progress in terminal
        this.terminalWindow.append(`Iteration ${data.iteration}/${data.maxIterations}`, true);
    }
    
    /**
     * Handle Claude prompt
     * @param {Object} data - Prompt data
     */
    handleClaudePrompt(data) {
        // Get display settings
        const displaySettings = {
            showSystemPrompt: this.settings.getSetting('showSystemPrompt'),
            showQuestionPrompt: this.settings.getSetting('showQuestionPrompt')
        };
        
        // Display Claude prompt in terminal with settings
        this.terminalWindow.appendClaudePrompt(data.prompt, data.systemPrompt, displaySettings);
    }
    
    /**
     * Handle Claude response
     * @param {Object} response - Claude response
     */
    handleClaudeResponse(response) {
        // Display Claude response in terminal
        this.terminalWindow.appendClaudeResponse(response);
    }

    /**
     * Load data from localStorage
     */
    loadFromLocalStorage() {
        // Load companies
        const companies = this.database.loadCompanies();
        if (companies) {
            this.dataSource.setCompanies(companies);
        }
        
        // Load settings
        const settings = this.database.loadSettings();
        if (settings) {
            // Update each setting individually using the existing updateSetting method
            Object.entries(settings).forEach(([key, value]) => {
                this.settings.updateSetting(key, value);
            });
        }
        
        // Load API usage
        const apiUsage = this.database.loadApiUsage();
        if (apiUsage) {
            this.apiUsage.loadUsage();
        }
        
        // Load investigation state
        const state = this.database.loadInvestigationState();
        if (state) {
            this.dataSource.updateInvestigationState(state);
        }
    }

    /**
     * Save data to localStorage
     */
    saveToLocalStorage() {
        // Save companies
        this.database.saveCompanies(this.dataSource.getCompanies());
        
        // Save settings
        this.database.saveSettings(this.settings.getAllSettings());
        
        // Save API usage
        this.database.saveApiUsage(this.apiUsage.usage);
        
        // Save investigation state
        this.database.saveInvestigationState(this.dataSource.getInvestigationState());
    }
}