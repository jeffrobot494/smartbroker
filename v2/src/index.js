/**
 * Main entry point for SmartBroker v2 application
 * This file initializes the application and creates the main App instance
 */
import App from './app.js';
import CSVReader from './components/CSVReader.js';

// Create the application instance when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded - creating app instance');
    
    // Initialize the app
    window.app = new App();
    
    // Check if handleStartInvestigation exists
    console.log('handleStartInvestigation exists:', typeof window.app.handleStartInvestigation === 'function');
    
    console.log('SmartBroker v2 initialized successfully');
    
    // Display version info
    const versionInfo = {
        version: '2.0.0',
        buildDate: new Date().toISOString().split('T')[0],
        environment: 'development'
    };
    
    console.log('Version info:', versionInfo);
    
    // Direct event handler for clear terminal button
    console.log('Adding direct event handler to clear terminal button');
    const clearTerminalBtn = document.getElementById('clear-terminal-btn');
    if (clearTerminalBtn) {
        console.log('Found clear terminal button directly in index.js');
        clearTerminalBtn.addEventListener('click', () => {
            console.log('Clear button clicked - direct handler in index.js');
            const terminalOutput = document.getElementById('terminal-output');
            if (terminalOutput) {
                console.log('Found terminal output element, clearing content directly');
                terminalOutput.innerHTML = 'Terminal cleared by direct handler.';
            } else {
                console.error('Terminal output element not found');
            }
        });
    } else {
        console.error('Clear terminal button not found in index.js');
    }
    
    // NOTE: CSV upload event handlers are now managed by the App class in setupEventListeners
    // Removed duplicate event binding that was causing the file dialog to reopen
    
    // Direct test for start and stop buttons as a fallback
    setTimeout(() => {
        console.log('Setting up direct button event listeners');
        
        // Start button setup
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            console.log('Start button found directly:', startBtn);
            console.log('Start button disabled:', startBtn.disabled);
            
            // Force enable the start button for testing
            startBtn.disabled = false;
            
            // Add direct click handler for testing
            startBtn.addEventListener('click', (e) => {
                console.log('DIRECT start button click detected!');
                console.log('Event:', e);
                if (window.app && typeof window.app.handleStartInvestigation === 'function') {
                    console.log('Directly calling handleStartInvestigation...');
                    window.app.handleStartInvestigation();
                } else {
                    console.error('App or handleStartInvestigation not found');
                    
                    // Try a direct manual test
                    console.log('Attempting direct manual test...');
                    if (window.app) {
                        const companies = window.app.dataSource.getCompanies();
                        if (companies && companies.length > 0) {
                            console.log('Found companies, attempting direct research');
                            // Force set investigation state
                            window.app.dataSource.updateInvestigationState({
                                selectedQuestionIndex: 0,
                                mode: 'cell',
                                selectedCellCompanyIndex: 0,
                                currentCompanyIndex: 0
                            });
                            
                            // Try direct research
                            window.app.researchCompanyQuestion(0, 0).then(result => {
                                console.log('Direct research successful:', result);
                            }).catch(error => {
                                console.error('Direct research failed:', error);
                            });
                        } else {
                            console.error('No companies found for direct test');
                        }
                    }
                }
            });
        } else {
            console.error('Start button NOT found directly!');
        }
        
        // Stop button setup
        const stopBtn = document.getElementById('stop-btn');
        if (stopBtn) {
            console.log('Stop button found directly:', stopBtn);
            console.log('Stop button disabled:', stopBtn.disabled);
            
            // Add direct click handler for testing
            stopBtn.addEventListener('click', (e) => {
                console.log('DIRECT stop button click detected in index.js!');
                console.log('Event:', e);
                if (window.app && typeof window.app.handleStopInvestigation === 'function') {
                    console.log('Directly calling handleStopInvestigation from index.js...');
                    window.app.handleStopInvestigation();
                } else {
                    console.error('App or handleStopInvestigation not found in index.js');
                }
            });
        } else {
            console.error('Stop button NOT found directly!');
        }
    }, 2000); // Wait 2 seconds to ensure everything is loaded
});

// Handle errors
window.addEventListener('error', (event) => {
    console.error('Application error:', event.error);
    
    // Display error in terminal if available
    const terminalOutput = document.getElementById('terminal-output');
    if (terminalOutput) {
        terminalOutput.innerHTML += `\n<span class="error-text">Application error: ${event.error.message}</span>`;
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }
});

// Service worker registration disabled for now
// We'll add this later if needed with proper configuration
/* 
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').then(registration => {
            console.log('ServiceWorker registration successful');
        }).catch(error => {
            console.log('ServiceWorker registration failed:', error);
        });
    });
}
*/