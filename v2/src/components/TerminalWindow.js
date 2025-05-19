/**
 * TerminalWindow Component
 * Manages the terminal display for research progress and AI interaction
 */
export default class TerminalWindow {
    /**
     * @param {string} containerId - ID of the terminal container element
     * @param {string} inputId - ID of the terminal input element
     */
    constructor(containerId, inputId) {
        this.terminal = document.getElementById(containerId);
        this.input = document.getElementById(inputId);
        this.waiting = false;
        this.inputCallback = null;
        this.history = [];
        
        // Setup input listener
        if (this.input) {
            this.input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    this.handleInputSubmit();
                }
            });
        }
    }

    /**
     * Append text to the terminal
     * @param {string} text - Text to append
     * @param {boolean} newSection - Whether to start a new section with extra spacing
     */
    append(text, newSection = false) {
        if (!this.terminal) return;
        
        // Add timestamp to history
        this.history.push({
            text,
            timestamp: new Date().toISOString(),
            type: 'text'
        });
        
        // Use double line break for new sections
        const separator = newSection ? "\n\n" : "\n";
        
        // Add text to terminal
        this.terminal.innerHTML += separator + this.escapeHtml(text);
        
        // Scroll to bottom
        this.terminal.scrollTop = this.terminal.scrollHeight;
    }

    /**
     * Append HTML content to the terminal
     * @param {string} html - HTML content to append
     * @param {boolean} newSection - Whether to start a new section
     */
    appendHtml(html, newSection = false) {
        if (!this.terminal) return;
        
        // Add to history
        this.history.push({
            text: html,
            timestamp: new Date().toISOString(),
            type: 'html'
        });
        
        // Use double line break for new sections
        const separator = newSection ? "\n\n" : "\n";
        
        // Create temporary div
        const temp = document.createElement('div');
        temp.innerHTML = html;
        
        // Add HTML content to terminal
        this.terminal.innerHTML += separator;
        this.terminal.appendChild(temp);
        
        // Scroll to bottom
        this.terminal.scrollTop = this.terminal.scrollHeight;
    }

    /**
     * Append a tool request to the terminal
     * @param {Object} toolRequest - Tool request object
     */
    appendToolRequest(toolRequest) {
        if (!this.terminal || !toolRequest) return;
        
        // Add to history
        this.history.push({
            toolRequest,
            timestamp: new Date().toISOString(),
            type: 'toolRequest'
        });
        
        let html = `<div class="terminal-tool-request">`;
        html += `<span class="terminal-timestamp">[${this.formatTime(new Date())}]</span> `;
        html += `<span class="terminal-info">Tool Request: ${toolRequest.tool}</span>\n`;
        
        if (toolRequest.params) {
            for (const [key, value] of Object.entries(toolRequest.params)) {
                html += `  <span class="terminal-command">${key}</span>:\n`;
                html += `  <pre class="terminal-param">${this.escapeHtml(value)}</pre>\n`;
            }
        }
        
        // Show full JSON for debugging
        html += `  <span class="terminal-command">Full Request Data:</span>\n`;
        html += `  <pre class="terminal-json">${this.escapeHtml(JSON.stringify(toolRequest, null, 2))}</pre>\n`;
        
        html += `</div>`;
        
        this.appendHtml(html, true);
    }
    
    /**
     * Append Claude prompt to the terminal
     * @param {string} prompt - Claude prompt
     * @param {string} systemPrompt - System prompt (optional)
     * @param {Object} settings - Settings object with display preferences
     */
    appendClaudePrompt(prompt, systemPrompt = null, settings = {}) {
        if (!this.terminal) return;
        
        // Add to history
        this.history.push({
            prompt,
            systemPrompt,
            timestamp: new Date().toISOString(),
            type: 'claudePrompt'
        });
        
        let html = `<div class="terminal-claude-prompt">`;
        html += `<span class="terminal-timestamp">[${this.formatTime(new Date())}]</span> `;
        html += `<span class="terminal-info">Sending to Claude:</span>\n`;
        
        // Only display system prompt if setting is enabled
        if (systemPrompt && settings.showSystemPrompt) {
            html += `  <span class="terminal-command">System Prompt:</span>\n`;
            html += `  <pre class="terminal-system-prompt">${this.escapeHtml(systemPrompt)}</pre>\n`;
        }
        
        // Only display user prompt if setting is enabled
        if (settings.showQuestionPrompt) {
            html += `  <span class="terminal-command">User Prompt:</span>\n`;
            html += `  <pre class="terminal-user-prompt">${this.escapeHtml(prompt)}</pre>\n`;
        }
        
        html += `</div>`;
        
        this.appendHtml(html, true);
    }
    
    /**
     * Append Claude response to the terminal
     * @param {Object} response - Claude response object
     */
    appendClaudeResponse(response) {
        if (!this.terminal || !response) return;
        
        // Add to history
        this.history.push({
            response,
            timestamp: new Date().toISOString(),
            type: 'claudeResponse'
        });
        
        let html = `<div class="terminal-claude-response">`;
        html += `<span class="terminal-timestamp">[${this.formatTime(new Date())}]</span> `;
        html += `<span class="terminal-success">Claude Response:</span>\n`;
        
        // Show full content
        if (response.content) {
            html += `  <pre class="terminal-claude-content">${this.escapeHtml(response.content)}</pre>\n`;
        }
        
        // Show usage information
        if (response.usage) {
            html += `  <span class="terminal-command">Usage:</span> `;
            html += `${response.usage.input_tokens || 0} input tokens, ${response.usage.output_tokens || 0} output tokens\n`;
        }
        
        // Show full JSON for debugging
        html += `  <span class="terminal-command">Full Response Data:</span>\n`;
        html += `  <pre class="terminal-json">${this.escapeHtml(JSON.stringify(response, null, 2))}</pre>\n`;
        
        html += `</div>`;
        
        this.appendHtml(html, true);
    }

    /**
     * Append a tool result to the terminal
     * @param {Object} toolResult - Tool result object
     */
    appendToolResult(toolResult) {
        if (!this.terminal || !toolResult) return;
        
        // Add to history
        this.history.push({
            toolResult,
            timestamp: new Date().toISOString(),
            type: 'toolResult'
        });
        
        let html = `<div class="terminal-tool-result">`;
        html += `<span class="terminal-timestamp">[${this.formatTime(new Date())}]</span> `;
        html += `<span class="terminal-success">Tool Result:</span>\n`;
        
        // Check for error
        if (toolResult.error || toolResult.errorMessage) {
            html += `  <span class="terminal-error">ERROR: ${this.escapeHtml(toolResult.errorMessage || toolResult.error)}</span>\n`;
            // Show full error details
            html += `  <span class="terminal-error-details">This error will be sent to Claude exactly as shown here.</span>\n`;
        }
        
        // Always show full content, never truncate
        if (toolResult.content) {
            html += `  <span class="terminal-command">Full Content:</span>\n`;
            html += `  <pre class="terminal-content">${this.escapeHtml(toolResult.content)}</pre>\n`;
            
            // Show links if available
            if (toolResult.links && toolResult.links.length > 0) {
                html += `  <span class="terminal-command">Links:</span>\n`;
                toolResult.links.forEach(link => {
                    html += `    - ${this.escapeHtml(link)}\n`;
                });
            }
        }
        
        // Show full JSON for debugging
        html += `  <span class="terminal-command">Full Response Data:</span>\n`;
        html += `  <pre class="terminal-json">${this.escapeHtml(JSON.stringify(toolResult, null, 2))}</pre>\n`;
        
        html += `</div>`;
        
        this.appendHtml(html, true);
    }

    /**
     * Wait for user input
     * @param {string} prompt - Optional prompt text
     * @returns {Promise<string>} User input
     */
    waitForInput(prompt = '') {
        console.log('waitForInput called with prompt:', prompt);
        
        if (!this.input) {
            console.error('Input element not found!', this.input);
            return Promise.reject(new Error('Input element not found'));
        }
        
        // Display prompt if provided
        if (prompt) {
            this.append(prompt);
        }
        
        console.log('Setting input display to block');
        
        // Show input
        this.input.style.display = 'block';
        this.input.value = '';
        
        console.log('Attempting to focus input');
        this.input.focus();
        
        this.waiting = true;
        console.log('Set waiting flag to true');
        
        // Return promise that resolves when user submits input
        return new Promise((resolve) => {
            console.log('Creating new input callback promise');
            this.inputCallback = (value) => {
                console.log('Input callback called with value:', value);
                resolve(value);
            };
        });
    }

    /**
     * Handle input submission
     */
    handleInputSubmit() {
        console.log('handleInputSubmit called, waiting:', this.waiting, 'callback exists:', !!this.inputCallback);
        
        if (!this.waiting) {
            console.log('Not waiting for input, ignoring submission');
            return;
        }
        
        if (!this.inputCallback) {
            console.error('No input callback available!');
            return;
        }
        
        const value = this.input.value;
        console.log('Input value:', value);
        this.append(`> ${value}`);
        
        // Hide input
        this.input.style.display = 'none';
        this.waiting = false;
        
        // Call callback with input value
        console.log('Calling input callback with value:', value);
        this.inputCallback(value);
        this.inputCallback = null;
    }

    /**
     * Clear the terminal
     */
    clear() {
        if (!this.terminal) return;
        
        this.terminal.innerHTML = '';
        
        // Add to history
        this.history.push({
            timestamp: new Date().toISOString(),
            type: 'clear'
        });
    }

    /**
     * Show or hide the input element
     * @param {boolean} visible - Whether the input should be visible
     */
    showInput(visible) {
        if (!this.input) return;
        
        this.input.style.display = visible ? 'block' : 'none';
        
        if (visible) {
            this.input.focus();
        }
    }

    /**
     * Format time for display
     * @param {Date} date - Date object
     * @returns {string} Formatted time string
     */
    formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        if (typeof text !== 'string') {
            return String(text);
        }
        
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Get terminal history
     * @returns {Array} Terminal history
     */
    getHistory() {
        return [...this.history];
    }

    /**
     * Save terminal history to localStorage
     */
    saveHistory() {
        localStorage.setItem('terminal_history', JSON.stringify(this.history));
    }

    /**
     * Load terminal history from localStorage
     */
    loadHistory() {
        try {
            const history = localStorage.getItem('terminal_history');
            if (history) {
                this.history = JSON.parse(history);
            }
        } catch (e) {
            console.error('Failed to load terminal history:', e);
        }
    }
}