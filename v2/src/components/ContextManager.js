/**
 * ContextManager Component
 * Manages conversation history and research state
 */
export default class ContextManager {
    constructor(options = {}) {
        this.maxHistoryLength = options.maxHistoryLength || 20;
        this.conversation = [];
        this.systemPrompt = '';
        this.intermediateFindings = {};
    }

    /**
     * Start a new conversation
     * @param {string} initialPrompt - Initial prompt
     * @param {string} systemPrompt - System prompt
     */
    startConversation(initialPrompt, systemPrompt) {
        this.conversation = [initialPrompt];
        this.systemPrompt = systemPrompt;
        this.intermediateFindings = {};
    }

    /**
     * Add a message to the conversation
     * @param {string} role - Message role ('user' or 'assistant')
     * @param {string} content - Message content
     */
    addMessage(role, content) {
        this.conversation.push(content);
        
        // Trim conversation if it gets too long
        if (this.conversation.length > this.maxHistoryLength) {
            // Keep first message (initial prompt) and the most recent messages
            this.conversation = [
                this.conversation[0],
                `[... ${this.conversation.length - this.maxHistoryLength} messages omitted for brevity ...]`,
                ...this.conversation.slice(-this.maxHistoryLength + 1)
            ];
        }
    }

    /**
     * Get the current conversation as a single string
     * @returns {string} Combined conversation
     */
    getCurrentConversation() {
        return this.conversation.join('\n\n');
    }

    /**
     * Get the system prompt
     * @returns {string} System prompt
     */
    getSystemPrompt() {
        return this.systemPrompt;
    }

    /**
     * Store intermediate finding
     * @param {string} key - Finding key
     * @param {any} value - Finding value
     */
    storeIntermediateFinding(key, value) {
        this.intermediateFindings[key] = value;
    }

    /**
     * Get an intermediate finding
     * @param {string} key - Finding key
     * @returns {any} Finding value
     */
    getIntermediateFinding(key) {
        return this.intermediateFindings[key];
    }

    /**
     * Get all intermediate findings
     * @returns {Object} All intermediate findings
     */
    getAllIntermediateFindings() {
        return { ...this.intermediateFindings };
    }

    /**
     * Clear all intermediate findings
     */
    clearIntermediateFindings() {
        this.intermediateFindings = {};
    }

    /**
     * Check if a message contains a tool request
     * @param {string} message - Message to check
     * @returns {boolean} True if message contains a tool request
     */
    hasToolRequest(message) {
        return message.includes('<<PERPLEXITY_SEARCH>>') || 
               message.includes('perplexitySearch:');
    }

    /**
     * Get conversation as an array of messages with roles
     * @returns {Array} Array of message objects with role and content
     */
    getConversationMessages() {
        const messages = [];
        let currentRole = 'user';
        
        this.conversation.forEach((message, index) => {
            // First message is always from user (the initial prompt)
            if (index === 0) {
                messages.push({ role: 'user', content: message });
                currentRole = 'assistant';
            } else {
                messages.push({ role: currentRole, content: message });
                // Toggle role for next message
                currentRole = currentRole === 'user' ? 'assistant' : 'user';
            }
        });
        
        return messages;
    }

    /**
     * Calculate the estimated token count for current conversation
     * @returns {number} Estimated token count
     */
    estimateTokenCount() {
        // Simple estimation: ~4 characters per token on average
        const totalText = this.systemPrompt + this.conversation.join('');
        return Math.ceil(totalText.length / 4);
    }

    /**
     * Save conversation to localStorage
     * @param {string} key - Storage key
     */
    saveConversation(key = 'smartbroker_conversation') {
        const data = {
            conversation: this.conversation,
            systemPrompt: this.systemPrompt,
            intermediateFindings: this.intermediateFindings,
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem(key, JSON.stringify(data));
    }

    /**
     * Load conversation from localStorage
     * @param {string} key - Storage key
     * @returns {boolean} Whether the conversation was loaded successfully
     */
    loadConversation(key = 'smartbroker_conversation') {
        try {
            const data = localStorage.getItem(key);
            if (!data) return false;
            
            const parsed = JSON.parse(data);
            this.conversation = parsed.conversation || [];
            this.systemPrompt = parsed.systemPrompt || '';
            this.intermediateFindings = parsed.intermediateFindings || {};
            
            return true;
        } catch (e) {
            console.error('Failed to load conversation:', e);
            return false;
        }
    }
}