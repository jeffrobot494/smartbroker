// DOM elements
const startBtn = document.getElementById('start-btn');
const terminalOutput = document.getElementById('terminal-output');
const terminalInput = document.getElementById('terminal-input');
const loadingSpinner = document.getElementById('loading-spinner');
const resultsSection = document.getElementById('results-section');
const resultsBody = document.getElementById('results-body');
const questionItems = document.querySelectorAll('.question-item');
const questionList = document.getElementById('question-list');

// Single source of truth for investigation state
const investigationState = {
    companies: [],
    questions: [],
    selectedQuestionIndex: 0,
    currentCompanyIndex: 0,
    waitingForUserInput: false,
    results: []
};

// API functions

// Fetch company data from server
async function fetchCompanyData() {
    try {
        appendToTerminal("Loading company data...");
        loadingSpinner.style.display = 'block';
        
        const response = await fetch('/api/companies');
        
        if (response.ok) {
            const data = await response.json();
            investigationState.companies = data;
            appendToTerminal(`Loaded ${investigationState.companies.length} companies from data file.`);
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
    
    // Return a resolved promise for API compatibility
    return Promise.resolve({ message: 'Investigation reset successfully' });
}

// Perform research for a specific company and question
async function performResearch(companyIndex, questionIndex) {
    try {
        const company = investigationState.companies[companyIndex];
        const question = investigationState.questions[questionIndex];
        
        appendToTerminal(`\nResearching company: ${company.companyName}`);
        appendToTerminal(`Question: ${question.text}`);
        loadingSpinner.style.display = 'block';
        
        const response = await fetch('/api/research', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                companyIndex,
                questionIndex
            })
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
        }
        
        investigationState.results[companyIndex].answers[questionIndex] = result.result.answer;
        investigationState.results[companyIndex].status = result.result.answer !== question.positiveAnswer ? 
            'Disqualified' : 
            (questionIndex === investigationState.questions.length - 1 ? 'Qualified' : 'In Progress');
        
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
function appendToTerminal(text) {
    terminalOutput.innerHTML += "\n\n" + text;
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
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
                    appendToTerminal("\nProcessing research request...");
                    
                    // Get the company and question indices
                    const companyIndex = parseInt(terminalInput.dataset.companyIndex);
                    const questionIndex = parseInt(terminalInput.dataset.questionIndex);
                    
                    // Call the research API
                    const result = await performResearch(companyIndex, questionIndex);
                    
                    // Display the results
                    appendToTerminal(`\nResearch Results:\n${result.claudeResponse}`);
                    appendToTerminal(`\nFinal Answer: ${result.result.answer}`);
                    appendToTerminal(`Confidence: ${result.result.confidence}`);
                    
                    if (result.result.evidence) {
                        appendToTerminal(`Evidence: ${result.result.evidence}`);
                    }
                    
                    // Display token usage
                    appendToTerminal(`\nToken Usage: ${result.usage.input_tokens} input, ${result.usage.output_tokens} output`);
                    
                    // If negative answer, indicate disqualification
                    const question = investigationState.questions[questionIndex];
                    if (result.result.answer !== question.positiveAnswer) {
                        appendToTerminal(`\n${result.company} has been disqualified due to a negative answer.`);
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
    appendToTerminal("\n\nInvestigation complete! See the results table below.");
    
    // Show the results section
    resultsSection.classList.remove('hidden');
    
    // Clear previous results
    resultsBody.innerHTML = '';
    
    // Populate the results table
    investigationState.results.forEach(result => {
        if (!result) return; // Skip empty results
        
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${result.companyName}</td>
            <td>${result.answers[0] || '-'}</td>
            <td>${result.answers[1] || '-'}</td>
            <td>${result.answers[2] || '-'}</td>
            <td>${result.answers[3] || '-'}</td>
            <td>${result.answers[4] || '-'}</td>
            <td>${result.answers[5] || '-'}</td>
            <td>${result.status}</td>
        `;
        
        resultsBody.appendChild(row);
    });
    
    // Reset the state for a new investigation
    investigationState.currentCompanyIndex = 0;
    investigationState.waitingForUserInput = false;
    // Keep selectedQuestionIndex intact for next investigation
    
    // Enable the start button
    startBtn.disabled = false;
    startBtn.textContent = "Start New Investigation";
}

// Continue the investigation
function continueInvestigation() {
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
    
    appendToTerminal(`\n\nI'm going to research ${company.companyName} to answer: ${question.text}`);
    appendToTerminal("\nI'll need to use Claude to perform the research. May I proceed?");
    
    // Wait for user input to continue
    investigationState.waitingForUserInput = true;
    terminalInput.style.display = 'block';
    terminalInput.value = '';
    terminalInput.focus();
    terminalInput.dataset.action = 'research';
    terminalInput.dataset.companyIndex = investigationState.currentCompanyIndex;
    terminalInput.dataset.questionIndex = investigationState.selectedQuestionIndex;
}

// Select a question for research
function selectQuestion(questionIndex) {
    // Update the UI to show the selected question
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
        appendToTerminal(`\nSelected question: ${investigationState.questions[questionIndex].text}`);
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

// Start the investigation process
startBtn.addEventListener('click', async function() {
    try {
        // Reset for a new investigation
        terminalOutput.innerHTML = "Starting investigation process...";
        resultsSection.classList.add('hidden');
        
        // Disable the start button
        startBtn.disabled = true;
        
        // Reset the investigation state
        resetInvestigation();
        
        // Load company data and questions
        await fetchCompanyData();
        await fetchQuestions();
        
        if (investigationState.companies.length === 0 || investigationState.questions.length === 0) {
            appendToTerminal("Failed to load required data. Please check the server logs.");
            startBtn.disabled = false;
            return;
        }
        
        appendToTerminal("\nHello, I'm Claude! I'm going to help you research companies based on the criteria you've specified.");
        appendToTerminal(`\nI'll be analyzing ${investigationState.companies.length} companies against ${investigationState.questions.length} criteria questions.`);
        appendToTerminal("\nPress Enter when prompted to proceed with each step of the investigation.");
        
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