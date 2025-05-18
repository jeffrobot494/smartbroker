// DOM elements
const startBtn = document.getElementById('start-btn');
const terminalOutput = document.getElementById('terminal-output');
const terminalInput = document.getElementById('terminal-input');
const loadingSpinner = document.getElementById('loading-spinner');
const questionItems = document.querySelectorAll('.question-item');
const questionList = document.getElementById('question-list');
const companyDataTable = document.getElementById('company-data-table');
const companyDataTbody = document.getElementById('company-data-tbody');
const pauseSettingCheckbox = document.getElementById('pause-setting');

// Single source of truth for investigation state
const investigationState = {
    companies: [],
    questions: [],
    selectedQuestionIndex: 0,
    currentCompanyIndex: 0,
    waitingForUserInput: false,
    results: [],
    selectedColumnIndex: 1, // Default to Q1: Product column (index 1)
    selectedCellCompanyIndex: -1, // No specific cell selected by default
    mode: 'column', // 'column' or 'cell'
    ownerNamesByCompany: {}, // Store owner names by company index for cross-question use
};

// API functions

// Fetch company data from server
async function fetchCompanyData() {
    try {
        appendToTerminal("Loading company data...", true);
        loadingSpinner.style.display = 'block';
        
        const response = await fetch('/api/companies');
        
        if (response.ok) {
            const data = await response.json();
            investigationState.companies = data;
            appendToTerminal(`Loaded ${investigationState.companies.length} companies from data file.`);
            
            // Populate the company data table with the loaded companies
            populateCompanyDataTable();
            
            return data;
        } else {
            const errorText = await response.text();
            throw new Error(errorText);
        }
    } catch (error) {
        appendToTerminal(`Error loading company data: ${error.message}`);
        console.error("Failed to load company data:", error);
        return [];
    } finally {
        loadingSpinner.style.display = 'none';
    }
}

// Fetch questions from server
async function fetchQuestions() {
    try {
        appendToTerminal("Loading questions...");
        loadingSpinner.style.display = 'block';
        
        const response = await fetch('/api/questions');
        
        if (response.ok) {
            const data = await response.json();
            investigationState.questions = data;
            appendToTerminal(`Loaded ${investigationState.questions.length} questions.`);
            return data;
        } else {
            const errorText = await response.text();
            throw new Error(errorText);
        }
    } catch (error) {
        appendToTerminal(`Error loading questions: ${error.message}`);
        console.error("Failed to load questions:", error);
        return [];
    } finally {
        loadingSpinner.style.display = 'none';
    }
}

// Reset investigation state
function resetInvestigation() {
    // Reset local state only (server is now stateless for navigation)
    investigationState.currentCompanyIndex = 0;
    investigationState.results = [];
    // Do not reset selectedQuestionIndex - keep user's selection
    
    // Keep owner names between investigations - they're factual information
    // investigationState.ownerNamesByCompany stays intact
    
    // Return a resolved promise for API compatibility
    return Promise.resolve({ message: 'Investigation reset successfully' });
}

/**
 * INTEGRATION POINT: Research Result Display
 * 
 * Perform research for a specific company and question and update all UI elements
 */
async function performResearch(companyIndex, questionIndex) {
    try {
        const company = investigationState.companies[companyIndex];
        const question = investigationState.questions[questionIndex];
        
        appendToTerminal(`Researching company: ${company.companyName}`, true);
        appendToTerminal(`Question: ${question.text}`);
        loadingSpinner.style.display = 'block';
        
        // Prepare the request body
        const requestBody = {
            companyIndex,
            questionIndex
        };
        
        // If this is the Owner Age question and we have the owner name from previous research, include it
        if (questionIndex === 3 && investigationState.ownerNamesByCompany[companyIndex]) {
            const ownerName = investigationState.ownerNamesByCompany[companyIndex];
            requestBody.ownerName = ownerName;
            appendToTerminal(`Using previously found owner name "${ownerName}" to help search for age information.`);
        }
        
        const response = await fetch('/api/research', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }
        
        const result = await response.json();
        
        // Update the investigation results
        if (!investigationState.results[companyIndex]) {
            investigationState.results[companyIndex] = {
                companyName: company.companyName,
                answers: Array(investigationState.questions.length).fill(null),
                status: 'In Progress'
            };
        } else if (investigationState.results[companyIndex].answers.length < investigationState.questions.length) {
            // Resize the answers array if we've added new questions
            const newAnswers = Array(investigationState.questions.length).fill(null);
            investigationState.results[companyIndex].answers.forEach((answer, i) => {
                if (i < newAnswers.length) {
                    newAnswers[i] = answer;
                }
            });
            investigationState.results[companyIndex].answers = newAnswers;
        }
        
        // If this is the Owner Name question (index 2), store the result in our cross-question data store
        if (questionIndex === 2) {
            const answer = result.result.answer;
            // Only store valid names
            if (answer && answer !== 'unknown' && answer !== 'NO' && answer !== 'UNKNOWN') {
                investigationState.ownerNamesByCompany[companyIndex] = answer;
                console.log(`Stored owner name "${answer}" for company index ${companyIndex} for later use`);
            }
        }
        
        const answer = result.result.answer;
        investigationState.results[companyIndex].answers[questionIndex] = answer;
        investigationState.results[companyIndex].status = answer !== question.positiveAnswer ? 
            'Disqualified' : 
            (questionIndex === investigationState.questions.length - 1 ? 'Qualified' : 'In Progress');
        
        // INTEGRATION POINT: Update the table cell with the result
        updateCellWithResult(companyIndex, questionIndex, answer);
        
        return result;
    } catch (error) {
        console.error("Research failed:", error);
        throw error;
    } finally {
        loadingSpinner.style.display = 'none';
    }
}

// Move to next company for the current question
function moveToNextCompany() {
    // Increment company index
    investigationState.currentCompanyIndex++;
    
    // Check if we've gone through all companies for this question
    if (investigationState.currentCompanyIndex >= investigationState.companies.length) {
        // Reset to first company
        investigationState.currentCompanyIndex = 0;
        
        // We've finished the question with all companies
        return {
            nextCompanyIndex: 0,
            nextQuestionIndex: investigationState.selectedQuestionIndex,
            isDone: false,
            completedQuestion: true
        };
    }
    
    return {
        nextCompanyIndex: investigationState.currentCompanyIndex,
        nextQuestionIndex: investigationState.selectedQuestionIndex,
        isDone: false,
        completedQuestion: false
    };
}

// Add text to the terminal output
function appendToTerminal(text, newSection = false) {
    // Use double line break only for new sections, single line break otherwise
    const separator = newSection ? "\n\n" : "\n";
    terminalOutput.innerHTML += separator + text;
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

/**
 * Function to populate the company data table with company information
 */
function populateCompanyDataTable() {
    // Clear existing data
    companyDataTbody.innerHTML = '';
    
    if (investigationState.companies.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="11" style="text-align: center; padding: 20px;">No company data available</td>';
        companyDataTbody.appendChild(emptyRow);
        return;
    }
    
    // Loop through the companies
    investigationState.companies.forEach((company, index) => {
        const row = document.createElement('tr');
        row.dataset.companyIndex = index;
        
        // Format data for display
        const domain = company.website || '-';
        const linkedIn = company.linkedinUrl || '-';
        
        row.innerHTML = `
            <td>${company.companyName}</td>
            <td class="question-cell" data-question-index="0" data-company-index="${index}">-</td>
            <td class="question-cell" data-question-index="1" data-company-index="${index}">-</td>
            <td class="question-cell" data-question-index="2" data-company-index="${index}">-</td>
            <td class="question-cell" data-question-index="3" data-company-index="${index}">-</td>
            <td class="question-cell" data-question-index="4" data-company-index="${index}">-</td>
            <td class="question-cell" data-question-index="5" data-company-index="${index}">-</td>
            <td class="question-cell" data-question-index="6" data-company-index="${index}">-</td>
            <td>${domain}</td>
            <td>${linkedIn}</td>
            <td>${company.owner || '-'}</td>
            <td>${company.title || '-'}</td>
        `;
        
        companyDataTbody.appendChild(row);
    });
    
    // Update cells with any existing results
    updateCompanyTableWithResults();
    
    // Add click handlers 
    addClickHandlers();
    
    // Highlight the currently selected column
    highlightSelectedColumn(investigationState.selectedColumnIndex);
}

/**
 * Function to update cells with existing results
 */
function updateCompanyTableWithResults() {
    investigationState.results.forEach((result, companyIndex) => {
        if (result && result.answers) {
            result.answers.forEach((answer, questionIndex) => {
                if (answer) {
                    updateCellWithResult(companyIndex, questionIndex, answer);
                }
            });
        }
    });
}

/**
 * Update a specific cell with research result
 */
function updateCellWithResult(companyIndex, questionIndex, answer) {
    const rows = companyDataTable.querySelectorAll('tbody tr');
    if (rows.length > companyIndex) {
        const row = rows[companyIndex];
        const cells = row.querySelectorAll('.question-cell');
        if (cells.length > questionIndex) {
            const cell = cells[questionIndex];
            
            // Handle Owner Name question differently (questionIndex 2)
            if (questionIndex === 2) {
                // For Owner Name question, display the actual name or "unknown"
                // The answer should be the actual name found, not YES/NO
                if (answer === 'NO' || answer === 'UNKNOWN' || answer === 'unknown' || !answer) {
                    cell.textContent = 'unknown';
                    cell.classList.add('no-value');
                    cell.classList.remove('yes-value');
                } else {
                    // Make sure we're only showing the name, no extra text
                    cell.textContent = answer;
                    cell.classList.add('yes-value');
                    cell.classList.remove('no-value');
                }
            } else {
                // For all other questions, handle as before
                cell.textContent = answer;
                
                // Apply styling based on answer
                if (answer === 'YES') {
                    cell.classList.add('yes-value');
                    cell.classList.remove('no-value');
                } else if (answer === 'NO') {
                    cell.classList.add('no-value');
                    cell.classList.remove('yes-value');
                }
            }
        }
    }
}

/**
 * Add click handlers to table headers and cells
 */
function addClickHandlers() {
    // Add click handlers to question column headers
    const headerRow = companyDataTable.querySelector('thead tr');
    const headers = headerRow.querySelectorAll('th');
    
    headers.forEach((header, index) => {
        // Only add click events to question headers (indexes 1-7)
        if (index >= 1 && index <= 7) {
            header.addEventListener('click', () => {
                highlightSelectedColumn(index);
                
                // Update the hidden question list for backward compatibility
                const questionIndex = index - 1;
                selectQuestion(questionIndex);
            });
        }
    });
    
    // Add click handlers to question cells
    const questionCells = document.querySelectorAll('.question-cell');
    questionCells.forEach(cell => {
        cell.addEventListener('click', () => {
            const questionIndex = parseInt(cell.dataset.questionIndex);
            const companyIndex = parseInt(cell.dataset.companyIndex);
            
            if (!isNaN(questionIndex) && !isNaN(companyIndex)) {
                // Get the column index (question index + 1 since company is column 0)
                const columnIndex = questionIndex + 1;
                
                // Highlight the cell
                highlightSelectedCell(companyIndex, columnIndex);
                
                // Update the terminal with selection info
                const company = investigationState.companies[companyIndex];
                const question = investigationState.questions[questionIndex];
                
                appendToTerminal(`Selected to research: ${company.companyName}`, true);
                appendToTerminal(`For question: ${question.text}`);
            }
        });
    });
}

/**
 * Function to highlight the selected question column
 */
function highlightSelectedColumn(columnIndex) {
    clearAllSelections();
    
    // Get all rows in the table
    const rows = companyDataTable.querySelectorAll('tr');
    
    // Highlight the selected column in each row
    rows.forEach(row => {
        const cells = row.querySelectorAll('th, td');
        if (cells.length > columnIndex) {
            cells[columnIndex].classList.add('selected-question');
        }
    });
    
    // Update the selected question index based on the column
    if (columnIndex >= 1 && columnIndex <= 7) {
        investigationState.selectedQuestionIndex = columnIndex - 1;
        investigationState.selectedColumnIndex = columnIndex;
        investigationState.selectedCellCompanyIndex = -1;
        investigationState.mode = 'column';
    }
}

/**
 * Function to highlight a specific cell (for specific company/question research)
 */
function highlightSelectedCell(rowIndex, columnIndex) {
    clearAllSelections();
    
    // Still highlight the column for context
    highlightSelectedColumn(columnIndex);
    
    // Get the specific cell and add stronger highlight
    const rows = companyDataTable.querySelectorAll('tbody tr');
    if (rows.length > rowIndex) {
        const cells = rows[rowIndex].querySelectorAll('td');
        if (cells.length > columnIndex) {
            cells[columnIndex].classList.add('selected-cell');
        }
    }
    
    // Update state
    investigationState.selectedQuestionIndex = columnIndex - 1;
    investigationState.selectedColumnIndex = columnIndex;
    investigationState.selectedCellCompanyIndex = rowIndex;
    investigationState.currentCompanyIndex = rowIndex;
    investigationState.mode = 'cell';
}

/**
 * Helper function to clear all selections
 */
function clearAllSelections() {
    const allCells = companyDataTable.querySelectorAll('th, td');
    allCells.forEach(cell => {
        cell.classList.remove('selected-question');
        cell.classList.remove('selected-cell');
    });
}

// Handle user input (Enter key to continue)
terminalInput.addEventListener('keydown', async function(event) {
    if (event.key === 'Enter') {
        if (investigationState.waitingForUserInput) {
            investigationState.waitingForUserInput = false;
            terminalInput.style.display = 'none';
            
            // Process the next step in the investigation
            if (terminalInput.dataset.action === 'research') {
                try {
                    appendToTerminal("Processing research request...");
                    
                    // Get the company and question indices
                    const companyIndex = parseInt(terminalInput.dataset.companyIndex);
                    const questionIndex = parseInt(terminalInput.dataset.questionIndex);
                    
                    // Call the research API
                    const result = await performResearch(companyIndex, questionIndex);
                    
                    // Display the results
                    appendToTerminal(`Research Results:`, true);
                    appendToTerminal(`${result.claudeResponse}`);
                    appendToTerminal(`Final Answer: ${result.result.answer}`);
                    appendToTerminal(`Confidence: ${result.result.confidence}`);
                    
                    if (result.result.evidence) {
                        appendToTerminal(`Evidence: ${result.result.evidence}`);
                    }
                    
                    // Display token usage
                    appendToTerminal(`Token Usage: ${result.usage.input_tokens} input, ${result.usage.output_tokens} output`);
                    
                    // If negative answer, indicate disqualification
                    const question = investigationState.questions[questionIndex];
                    if (result.result.answer !== question.positiveAnswer) {
                        appendToTerminal(`${result.company} has been disqualified due to a negative answer.`);
                    }
                    
                    // Move to the next company
                    const nextStep = moveToNextCompany();
                    
                    // If we've completed all companies for this question, finish
                    if (nextStep.completedQuestion) {
                        finishInvestigation();
                        return;
                    }
                    
                    // Slight delay before continuing
                    setTimeout(() => {
                        continueInvestigation();
                    }, 1000);
                    
                } catch (error) {
                    appendToTerminal(`\nError during research: ${error.message}`);
                    appendToTerminal("\nPlease try again or restart the investigation.");
                    
                    // Re-enable input
                    investigationState.waitingForUserInput = true;
                    terminalInput.style.display = 'block';
                    terminalInput.focus();
                }
            }
        }
    }
});

// Finish the investigation
function finishInvestigation() {
    appendToTerminal("Investigation complete! See the results in the company data table above.", true);
    
    // Reset the state for a new investigation
    investigationState.currentCompanyIndex = 0;
    investigationState.waitingForUserInput = false;
    // Keep selectedQuestionIndex intact for next investigation
    
    // Enable the start button
    startBtn.disabled = false;
    startBtn.textContent = "Start New Investigation";
}

/**
 * INTEGRATION POINT: Mode-Based Flow Control
 * 
 * Continue the investigation based on the current mode (column or cell)
 */
function continueInvestigation() {
    // Check pause setting
    const pauseBetweenSearches = pauseSettingCheckbox.checked;
    
    // Cell mode handling - research just one specific company/question pair
    if (investigationState.mode === 'cell') {
        // If we've already processed the cell, we're done
        if (
            investigationState.results[investigationState.selectedCellCompanyIndex] && 
            investigationState.results[investigationState.selectedCellCompanyIndex].answers[investigationState.selectedQuestionIndex]
        ) {
            finishInvestigation();
            return;
        }
        
        const company = investigationState.companies[investigationState.selectedCellCompanyIndex];
        const question = investigationState.questions[investigationState.selectedQuestionIndex];
        
        appendToTerminal(`I'm going to research ${company.companyName} to answer: ${question.text}`, true);
        
        if (pauseBetweenSearches) {
            appendToTerminal("I'll need to use Claude to perform the research. May I proceed?");
            
            // Wait for user input to continue
            investigationState.waitingForUserInput = true;
            terminalInput.style.display = 'block';
            terminalInput.value = '';
            terminalInput.focus();
            terminalInput.dataset.action = 'research';
            terminalInput.dataset.companyIndex = investigationState.selectedCellCompanyIndex;
            terminalInput.dataset.questionIndex = investigationState.selectedQuestionIndex;
        } else {
            // Auto-proceed with research
            performResearchAndContinue(investigationState.selectedCellCompanyIndex, investigationState.selectedQuestionIndex);
        }
        return;
    }
    
    // Column mode - process all companies for the selected question
    
    // Skip disqualified companies
    if (
        investigationState.currentCompanyIndex < investigationState.companies.length && 
        investigationState.results[investigationState.currentCompanyIndex] && 
        investigationState.results[investigationState.currentCompanyIndex].status === "Disqualified"
    ) {
        // Skip this company by moving to next
        const nextStep = moveToNextCompany();
        
        if (nextStep.completedQuestion) {
            finishInvestigation();
            return;
        }
        
        // Continue with next company
        continueInvestigation();
        return;
    }
    
    // If we've gone through all companies, we're done
    if (investigationState.currentCompanyIndex >= investigationState.companies.length) {
        finishInvestigation();
        return;
    }
    
    const company = investigationState.companies[investigationState.currentCompanyIndex];
    const question = investigationState.questions[investigationState.selectedQuestionIndex];
    
    appendToTerminal(`I'm going to research ${company.companyName} to answer: ${question.text}`, true);
    
    if (pauseBetweenSearches) {
        appendToTerminal("I'll need to use Claude to perform the research. May I proceed?");
        
        // Wait for user input to continue
        investigationState.waitingForUserInput = true;
        terminalInput.style.display = 'block';
        terminalInput.value = '';
        terminalInput.focus();
        terminalInput.dataset.action = 'research';
        terminalInput.dataset.companyIndex = investigationState.currentCompanyIndex;
        terminalInput.dataset.questionIndex = investigationState.selectedQuestionIndex;
    } else {
        // Auto-proceed with research
        performResearchAndContinue(investigationState.currentCompanyIndex, investigationState.selectedQuestionIndex);
    }
}

/**
 * Helper function to perform research without manual confirmation
 */
async function performResearchAndContinue(companyIndex, questionIndex) {
    try {
        appendToTerminal("Processing research request automatically...", true);
        
        // Call the research API
        const result = await performResearch(companyIndex, questionIndex);
        
        // Display the results
        appendToTerminal(`Research Results:`, true);
        appendToTerminal(`${result.claudeResponse}`);
        appendToTerminal(`Final Answer: ${result.result.answer}`);
        appendToTerminal(`Confidence: ${result.result.confidence}`);
        
        if (result.result.evidence) {
            appendToTerminal(`Evidence: ${result.result.evidence}`);
        }
        
        // Display token usage
        appendToTerminal(`Token Usage: ${result.usage.input_tokens} input, ${result.usage.output_tokens} output`);
        
        // Check for disqualification
        const question = investigationState.questions[questionIndex];
        if (result.result.answer !== question.positiveAnswer) {
            appendToTerminal(`${result.company} has been disqualified due to a negative answer.`);
        }
        
        // In cell mode, we're done after one research
        if (investigationState.mode === 'cell') {
            finishInvestigation();
            return;
        }
        
        // In column mode, move to next company
        const nextStep = moveToNextCompany();
        
        if (nextStep.completedQuestion) {
            finishInvestigation();
            return;
        }
        
        // Continue with next company after delay
        setTimeout(() => {
            continueInvestigation();
        }, 1000);
        
    } catch (error) {
        appendToTerminal(`\nError during research: ${error.message}`);
        appendToTerminal("\nPlease try again or restart the investigation.");
        
        startBtn.disabled = false;
    }
}

/**
 * INTEGRATION POINT: Table-Question Selection System
 * 
 * This function handles question selection and integrates with:
 * 1. The hidden question list UI (for backward compatibility)
 * 2. The table column highlighting system
 */
function selectQuestion(questionIndex) {
    // Update the hidden UI to show the selected question
    questionItems.forEach(item => {
        item.classList.remove('selected');
        if (parseInt(item.dataset.questionIndex) === questionIndex) {
            item.classList.add('selected');
        }
    });
    
    // Update the state with selected question
    investigationState.selectedQuestionIndex = questionIndex;
    
    // Show the selection in the terminal
    if (investigationState.questions.length > 0) {
        appendToTerminal(`Selected question: ${investigationState.questions[questionIndex].text}`, true);
    }
    
    // Highlight the corresponding column in the table
    // (Only if we're not being called as part of column highlight process)
    if (investigationState.selectedColumnIndex !== questionIndex + 1) {
        highlightSelectedColumn(questionIndex + 1); // Convert to 1-based column index
    }
}

// Add click event listeners to question items
questionList.addEventListener('click', function(event) {
    let questionItem = event.target.closest('.question-item');
    if (questionItem) {
        const questionIndex = parseInt(questionItem.dataset.questionIndex);
        if (!isNaN(questionIndex) && questionIndex >= 0 && questionIndex < 6) {
            selectQuestion(questionIndex);
        }
    }
});

// Initialize data on page load
async function initializeData() {
    try {
        // Load company data
        await fetchCompanyData();
        await fetchQuestions();
        
        // Pre-select the first question by default
        if (!document.querySelector('.question-item.selected') && investigationState.questions.length > 0) {
            selectQuestion(0);
        }
        
        // Enable the start button if we have data
        if (investigationState.companies.length > 0 && investigationState.questions.length > 0) {
            startBtn.disabled = false;
        } else {
            terminalOutput.innerHTML += "\n\nFailed to load required data. Please check the server logs.";
            startBtn.disabled = true;
        }
    } catch (error) {
        console.error("Error initializing data:", error);
        terminalOutput.innerHTML += `\n\nError loading initial data: ${error.message}`;
    }
}

// Start the investigation process
startBtn.addEventListener('click', async function() {
    try {
        // Reset for a new investigation
        terminalOutput.innerHTML = "Starting investigation process...";
        
        // Disable the start button
        startBtn.disabled = true;
        
        // Reset the investigation state
        resetInvestigation();
        
        // If we don't have data yet, load it (shouldn't happen normally since we load on page init)
        if (investigationState.companies.length === 0 || investigationState.questions.length === 0) {
            await fetchCompanyData();
            await fetchQuestions();
        }
        
        if (investigationState.companies.length === 0 || investigationState.questions.length === 0) {
            appendToTerminal("Failed to load required data. Please check the server logs.");
            startBtn.disabled = false;
            return;
        }
        
        appendToTerminal("Hello, I'm Claude! I'm going to help you research companies based on the criteria you've specified.", true);
        appendToTerminal(`I'll be analyzing ${investigationState.companies.length} companies against ${investigationState.questions.length} criteria questions.`);
        appendToTerminal("Press Enter when prompted to proceed with each step of the investigation.");
        
        // Only default to first question if none is already selected
        if (!document.querySelector('.question-item.selected')) {
            selectQuestion(0);
        }
        
        // Start the investigation
        continueInvestigation();
    } catch (error) {
        appendToTerminal(`Error starting investigation: ${error.message}`);
        startBtn.disabled = false;
    }
});

// Initialize data when the page loads
document.addEventListener('DOMContentLoaded', initializeData);