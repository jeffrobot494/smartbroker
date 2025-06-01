class CostCalculator {
    constructor() {
        this.pricing = {
            claude: { 
                input: 3.0 / 1_000_000,    // $3 per million input tokens
                output: 15.0 / 1_000_000   // $15 per million output tokens
            },
            perplexity: 0.01,              // $0.01 per call
            phantombuster: 0.15            // $0.15 per call
        };
    }

    /**
     * Calculate cost for Claude API usage
     * @param {number} inputTokens - Number of input tokens
     * @param {number} outputTokens - Number of output tokens
     * @returns {Object} Cost breakdown for Claude
     */
    calculateClaudeCost(inputTokens, outputTokens) {
        const inputCost = inputTokens * this.pricing.claude.input;
        const outputCost = outputTokens * this.pricing.claude.output;
        
        return {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            input_cost: inputCost,
            output_cost: outputCost,
            total_cost: inputCost + outputCost
        };
    }

    /**
     * Calculate cost for tool API usage (Perplexity, PhantomBuster)
     * @param {string} toolName - Name of the tool (perplexity, phantombuster)
     * @param {number} callCount - Number of API calls made
     * @returns {Object} Cost breakdown for tool
     */
    calculateToolCost(toolName, callCount = 1) {
        const costPerCall = this.pricing[toolName];
        if (!costPerCall) {
            throw new Error(`Unknown tool: ${toolName}`);
        }
        
        return {
            tool_name: toolName,
            calls: callCount,
            cost: callCount * costPerCall
        };
    }

    /**
     * Aggregate costs from multiple APIs
     * @param {Object} costs - Object containing cost data from different APIs
     * @returns {Object} Aggregated cost summary
     */
    aggregateCosts(costs) {
        return {
            claude_total: costs.claude?.total_cost || 0,
            perplexity_total: costs.perplexity?.cost || 0,
            phantombuster_total: costs.phantombuster?.cost || 0,
            grand_total: (costs.claude?.total_cost || 0) + 
                        (costs.perplexity?.cost || 0) + 
                        (costs.phantombuster?.cost || 0)
        };
    }

    /**
     * Format cost for display
     * @param {number} cost - Raw cost amount
     * @returns {string} Formatted cost string
     */
    formatCost(cost) {
        if (cost < 0.001) {
            return `$${(cost * 1000).toFixed(3)}¢`;
        }
        return `$${cost.toFixed(4)}`;
    }

    /**
     * Get GUI-friendly cost breakdown
     * @param {Object} costs - Raw cost data
     * @returns {Object} Formatted cost breakdown for display
     */
    getCostBreakdown(costs) {
        const aggregated = this.aggregateCosts(costs);
        return {
            total: this.formatCost(aggregated.grand_total),
            breakdown: {
                claude: this.formatCost(aggregated.claude_total),
                perplexity: this.formatCost(aggregated.perplexity_total),
                phantombuster: this.formatCost(aggregated.phantombuster_total)
            },
            raw: aggregated // For calculations
        };
    }
}

module.exports = CostCalculator;