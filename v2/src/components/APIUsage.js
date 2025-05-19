/**
 * APIUsage Component
 * Tracks and manages API usage and costs
 */
export default class APIUsage {
    constructor(dataSource = null) {
        this.dataSource = dataSource;
        this.usage = this.loadUsage();
        this.limits = {
            claude: 1000,
            perplexity: 1000
        };
        this.costs = {
            claude: 0.0035, // ~$3.50 per 1000 tokens for Claude Sonnet
            perplexity: 0.0001 // Approximate cost per request
        };
        this.displayElement = document.getElementById('api-usage-display');
    }

    /**
     * Load API usage from localStorage or dataSource
     * @returns {Object} API usage object
     */
    loadUsage() {
        if (this.dataSource) {
            return this.dataSource.getApiUsage();
        }
        
        // Load directly from localStorage if no dataSource
        const savedUsage = localStorage.getItem('smartbroker_api_usage');
        
        if (savedUsage) {
            try {
                return JSON.parse(savedUsage);
            } catch (e) {
                console.error('Failed to load API usage:', e);
            }
        }
        
        // Default usage object
        return {
            claude: { count: 0, cost: 0, tokenUsage: 0 },
            perplexity: { count: 0, cost: 0 },
            lastReset: new Date().toISOString()
        };
    }

    /**
     * Track Claude API usage
     * @param {number} inputTokens - Input tokens used
     * @param {number} outputTokens - Output tokens used
     */
    trackClaudeUsage(inputTokens, outputTokens) {
        const totalTokens = inputTokens + outputTokens;
        const cost = totalTokens * this.costs.claude / 1000; // Cost per 1000 tokens
        
        this.usage.claude.count += 1;
        this.usage.claude.tokenUsage = (this.usage.claude.tokenUsage || 0) + totalTokens;
        this.usage.claude.cost += cost;
        
        this.saveUsage();
        this.updateDisplay();
    }

    /**
     * Track Perplexity API usage
     * @param {number} count - Number of requests (default: 1)
     */
    trackPerplexityUsage(count = 1) {
        const cost = count * this.costs.perplexity;
        
        this.usage.perplexity.count += count;
        this.usage.perplexity.cost += cost;
        
        this.saveUsage();
        this.updateDisplay();
    }

    /**
     * Save API usage to localStorage or dataSource
     */
    saveUsage() {
        if (this.dataSource) {
            this.dataSource.updateApiUsage('claude', this.usage.claude.cost);
            this.dataSource.updateApiUsage('perplexity', this.usage.perplexity.cost);
        } else {
            // Save directly to localStorage if no dataSource
            localStorage.setItem('smartbroker_api_usage', JSON.stringify(this.usage));
        }
    }

    /**
     * Reset API usage
     */
    resetUsage() {
        this.usage = {
            claude: { count: 0, cost: 0, tokenUsage: 0 },
            perplexity: { count: 0, cost: 0 },
            lastReset: new Date().toISOString()
        };
        
        if (this.dataSource) {
            this.dataSource.resetApiUsage();
        } else {
            localStorage.setItem('smartbroker_api_usage', JSON.stringify(this.usage));
        }
        
        this.updateDisplay();
    }

    /**
     * Get total API usage cost
     * @returns {number} Total cost in dollars
     */
    getTotalCost() {
        return this.usage.claude.cost + this.usage.perplexity.cost;
    }

    /**
     * Get total API usage count
     * @returns {number} Total number of API calls
     */
    getTotalCount() {
        return this.usage.claude.count + this.usage.perplexity.count;
    }

    /**
     * Check if any API limit has been reached
     * @returns {boolean} True if any limit has been reached
     */
    isLimitReached() {
        return this.usage.claude.count >= this.limits.claude || 
               this.usage.perplexity.count >= this.limits.perplexity;
    }

    /**
     * Set API usage limits
     * @param {Object} limits - API limits object
     */
    setLimits(limits) {
        if (limits.claude) {
            this.limits.claude = limits.claude;
        }
        if (limits.perplexity) {
            this.limits.perplexity = limits.perplexity;
        }
    }

    /**
     * Update the usage display
     */
    updateDisplay() {
        if (!this.displayElement) return;
        
        const claudeCount = this.usage.claude.count;
        const perplexityCount = this.usage.perplexity.count;
        const totalCost = this.getTotalCost().toFixed(4);
        
        let displayText = `API Usage: Claude: ${claudeCount} calls, Perplexity: ${perplexityCount} calls`;
        
        if (this.usage.claude.tokenUsage) {
            displayText += `, ${this.usage.claude.tokenUsage.toLocaleString()} tokens`;
        }
        
        displayText += ` (Est. Cost: $${totalCost})`;
        
        this.displayElement.textContent = displayText;
    }
}