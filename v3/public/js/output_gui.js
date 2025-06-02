class OutputGUI {
  constructor(app) {
    this.app = app;
    this.messages = []; // Store all messages for filtering
    this.filters = {
      'system-prompt': true,
      'criterion-prompt': true,
      'tool-response': true,
      'claude-tool-request': true,
      'claude-analysis': true
    };
    this.terminalContainer = null;
  }

  init() {
    console.log('OutputGUI: Initializing...');
    this.terminalContainer = document.getElementById('terminal');
    if (!this.terminalContainer) {
      console.error('OutputGUI: Terminal container not found');
      return;
    }
    this.setupEventListeners();
  }

  onDataChanged() {
    console.log('OutputGUI: Data changed (no action needed)');
    // OutputGUI doesn't need to react to template/company data changes
    // It only reacts to real-time SSE messages during research
  }

  setupEventListeners() {
    // Filter checkbox listeners
    const checkboxes = document.querySelectorAll('.output-checkboxes input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        this.filters[e.target.id] = e.target.checked;
        console.log(`OutputTab: Filter ${e.target.id} set to ${e.target.checked}`);
        this.refreshDisplay();
      });
    });

    // Clear output button
    const clearBtn = document.getElementById('clear-output-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearOutput();
      });
    }
  }

  addMessage(messageData) {
    const message = {
      id: Date.now() + Math.random(), // Unique ID
      timestamp: new Date(),
      type: this.mapMessageType(messageData.type),
      sseType: messageData.type, // Keep original SSE type
      content: this.getMessageContent(messageData),
      details: this.getMessageDetails(messageData),
      company: messageData.company || null,
      criterion: messageData.criterion || null
    };

    this.messages.push(message);
    
    // Only add to display if filter is enabled
    if (this.filters[this.getFilterKey(message.type)]) {
      this.addMessageToDisplay(message);
    }
  }

  mapMessageType(sseType) {
    // Map actual SSE types to display categories
    const typeMap = {
      // Research Flow
      'criterion_start': 'System Prompt',
      'company_start': 'System Prompt', 
      'company_skipped': 'System Prompt',
      'company_disqualified': 'System Prompt',
      
      // Automatic Queries (first query templates)
      'automatic_query': 'Criterion Prompt',
      'automatic_query_result': 'Tool Response',
      'automatic_query_error': 'Tool Response',
      'automatic_query_skipped': 'Criterion Prompt',
      
      // Claude API
      'prompt_sent': 'Criterion Prompt',
      'claude_response': 'Claude Analysis',
      'claude_message_sent': 'Claude Analysis',
      
      // Tool Usage
      'tool_request': 'Claude Tool Request',
      'tool_approval_needed': 'Claude Tool Request',
      'tool_result': 'Tool Response',
      
      // Results
      'final_result': 'Claude Analysis',
      
      // Errors & Connection
      'research_error': 'System Prompt',
      'error': 'System Prompt',
      'connection': 'System Prompt'
    };
    
    return typeMap[sseType] || 'System Prompt';
  }

  getFilterKey(messageType) {
    const filterMap = {
      'System Prompt': 'system-prompt',
      'Criterion Prompt': 'criterion-prompt',
      'Tool Response': 'tool-response',
      'Claude Tool Request': 'claude-tool-request',
      'Claude Analysis': 'claude-analysis',
      'System': 'system-prompt',
      'Error': 'system-prompt'
    };
    return filterMap[messageType] || 'system-prompt';
  }

  getMessageContent(messageData) {
    // Extract main display content based on message type
    switch(messageData.type) {
      case 'criterion_start':
        return `Starting criterion: ${messageData.criterion} (${messageData.total} companies)`;
      
      case 'company_start':
        return `Researching: ${messageData.company} (${messageData.index + 1}) - ${messageData.criterion}`;
      
      case 'company_skipped':
        return `Company skipped: ${messageData.reason}`;
        
      case 'company_disqualified':
        return `Company disqualified: ${messageData.reason}`;
      
      case 'automatic_query':
        return `Auto Query: ${messageData.query}`;
        
      case 'automatic_query_result':
        const resultPreview = messageData.result ? messageData.result.substring(0, 100) + '...' : 'No result';
        return `Auto Query Result: ${resultPreview}`;
        
      case 'automatic_query_error':
        return `Auto Query Error: ${messageData.error}`;
        
      case 'automatic_query_skipped':
        return `Auto Query Skipped: ${messageData.reason}`;
      
      case 'prompt_sent':
        return `Prompt sent to Claude (${messageData.prompt ? messageData.prompt.length : 0} chars)`;
      
      case 'claude_response':
        // Show Claude's actual response content, with a preview
        if (messageData.content) {
          const preview = messageData.content.length > 150 ? 
            messageData.content.substring(0, 150) + '...' : 
            messageData.content;
          return `Claude Analysis: ${preview}`;
        } else {
          const cost = (typeof messageData.cost === 'number') ? messageData.cost.toFixed(4) : 'unknown';
          return `Claude Response: ${messageData.tokens || 0} tokens, $${cost}`;
        }
        
      case 'tool_request':
        return `Tool Request: ${messageData.toolName} - ${messageData.query}`;
        
      case 'tool_approval_needed':
        return `Waiting for approval: ${messageData.query}`;
        
      case 'tool_result':
        return `Tool Result: ${messageData.result ? 'Success' : 'No result'}`;
        
      case 'final_result':
        const answer = messageData.result?.answer || 'No answer';
        const type = messageData.result?.type || 'unknown';
        return `Final Result: ${answer} (${type})`;
        
      case 'research_error':
      case 'error':
        return `Error: ${messageData.error}`;
        
      case 'connection':
        return messageData.message || 'Connected to research stream';
        
      default:
        return messageData.message || messageData.content || 'Unknown message';
    }
  }

  getMessageDetails(messageData) {
    // Extract detailed information for expandable sections
    const details = {};
    
    switch(messageData.type) {
      case 'company_start':
        details['Company'] = messageData.company;
        details['Criterion'] = messageData.criterion;
        details['Index'] = messageData.index + 1;
        break;
        
      case 'automatic_query':
        details['Query'] = messageData.query;
        details['Criterion'] = messageData.criterionName;
        break;
        
      case 'automatic_query_result':
        if (messageData.result) {
          details['Full Result'] = messageData.result;
        }
        break;
        
      case 'prompt_sent':
        if (messageData.prompt) {
          details['Full Prompt'] = messageData.prompt;
        }
        break;
        
      case 'claude_response':
        if (messageData.content) {
          details['Full Response'] = messageData.content;
        }
        details['Output Tokens'] = messageData.tokens || 0;
        const detailCost = (typeof messageData.cost === 'number') ? messageData.cost.toFixed(4) : 'unknown';
        details['Cost'] = `$${detailCost}`;
        break;
        
      case 'claude_message_sent':
        if (messageData.payload) {
          details['Model'] = messageData.payload.model;
          details['Max Tokens'] = messageData.payload.maxTokens;
          details['Messages Count'] = messageData.payload.messages?.length;
          details['System Prompt Length'] = messageData.payload.systemPrompt?.length;
        }
        break;
        
      case 'tool_request':
        details['Tool'] = messageData.toolName;
        details['Query'] = messageData.query;
        details['Requires Approval'] = messageData.waitForApproval ? 'Yes' : 'No';
        break;
        
      case 'tool_result':
        if (messageData.result) {
          details['Result'] = messageData.result;
        }
        if (messageData.userOverride) {
          details['User Override'] = messageData.userOverride;
        }
        break;
        
      case 'final_result':
        if (messageData.result) {
          details['Company'] = messageData.company;
          details['Criterion'] = messageData.criterion;
          details['Answer'] = messageData.result.answer;
          details['Type'] = messageData.result.type;
          details['Explanation'] = messageData.result.explanation;
          details['Confidence'] = messageData.result.confidence_score;
        }
        break;
    }
    
    return Object.keys(details).length > 0 ? details : null;
  }

  addMessageToDisplay(message) {
    const line = this.createTerminalLine(message);
    this.terminalContainer.appendChild(line);
    
    // Auto-scroll to bottom
    this.terminalContainer.scrollTop = this.terminalContainer.scrollHeight;
  }

  createTerminalLine(message) {
    const line = document.createElement('div');
    line.className = 'terminal-line';
    line.dataset.messageId = message.id;
    line.dataset.messageType = this.getFilterKey(message.type);

    const timestamp = this.formatTimestamp(message.timestamp);
    const typeClass = this.getTypeClass(message.type);
    
    // Check if this message has details (expandable)
    const hasDetails = message.details && Object.keys(message.details).length > 0;
    
    if (hasDetails) {
      line.classList.add('expandable');
      line.onclick = () => this.toggleExpand(line);
    }

    line.innerHTML = `
      <span class="terminal-timestamp">[${timestamp}]</span> 
      <span class="${typeClass}">${message.type}:</span> 
      ${this.escapeHtml(message.content)}
      ${hasDetails ? '<span class="expand-indicator">▼</span>' : ''}
      ${hasDetails ? this.createDetailsSection(message.details) : ''}
    `;

    return line;
  }

  createDetailsSection(details) {
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'terminal-details';
    detailsDiv.style.display = 'none';

    // Convert details object to readable format
    const detailsContent = Object.entries(details)
      .map(([key, value]) => `<div><strong>${key}:</strong> ${this.escapeHtml(String(value))}</div>`)
      .join('');

    detailsDiv.innerHTML = detailsContent;
    return detailsDiv.outerHTML;
  }

  toggleExpand(line) {
    const details = line.querySelector('.terminal-details');
    const indicator = line.querySelector('.expand-indicator');
    
    if (details) {
      const isExpanded = details.style.display !== 'none';
      details.style.display = isExpanded ? 'none' : 'block';
      indicator.textContent = isExpanded ? '▼' : '▲';
      line.classList.toggle('expanded', !isExpanded);
    }
  }

  formatTimestamp(date) {
    return date.toTimeString().split(' ')[0]; // HH:MM:SS format
  }

  getTypeClass(messageType) {
    const classMap = {
      'System Prompt': 'terminal-system',
      'Criterion Prompt': 'terminal-system',
      'Tool Response': 'terminal-tool',
      'Claude Tool Request': 'terminal-claude',
      'Claude Analysis': 'terminal-claude',
      'System': 'terminal-system',
      'Error': 'terminal-error'
    };
    return classMap[messageType] || 'terminal-system';
  }

  refreshDisplay() {
    // Clear current display
    this.terminalContainer.innerHTML = '';
    
    // Re-add filtered messages
    this.messages.forEach(message => {
      if (this.filters[this.getFilterKey(message.type)]) {
        this.addMessageToDisplay(message);
      }
    });
  }

  clearOutput() {
    this.messages = [];
    this.terminalContainer.innerHTML = '';
    console.log('OutputTab: Output cleared');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}