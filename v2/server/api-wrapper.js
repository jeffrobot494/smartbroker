/**
 * API Wrapper for Claude and Perplexity APIs
 * Provides utility functions for API calls
 */
const axios = require('axios');
require('dotenv').config();

// Cache to store recent search results
const searchCache = new Map();

/**
 * Call Claude API with the given prompt
 * @param {string} prompt - User prompt
 * @param {string} systemPrompt - System prompt
 * @param {number} maxTokens - Maximum tokens to generate
 * @returns {Object} - Claude API response
 */
async function callClaude(prompt, systemPrompt = null, maxTokens = 1000) {
    try {
        const requestBody = {
            model: "claude-3-7-sonnet-latest",
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: maxTokens
        };

        if (systemPrompt) {
            requestBody.system = systemPrompt;
        }

        const response = await axios.post('https://api.anthropic.com/v1/messages', requestBody, {
            headers: {
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            }
        });

        return {
            content: response.data.content?.[0]?.text || '',
            model: response.data.model,
            usage: response.data.usage
        };
    } catch (error) {
        console.error('Error calling Claude API:', error.response?.data || error.message);
        throw new Error(`Claude API error: ${error.message}`);
    }
}

/**
 * Search using Perplexity API
 * @param {string} query - Search query
 * @param {boolean} useCache - Whether to use cache
 * @returns {Object} - Perplexity API response
 */
async function searchPerplexity(query, useCache = true) {
    // Check cache first if enabled
    const cacheKey = query.toLowerCase().trim();
    if (useCache && searchCache.has(cacheKey)) {
        console.log('Using cached result for query:', query);
        return searchCache.get(cacheKey);
    }

    try {
        const response = await axios.post('https://api.perplexity.ai/search', {
            query,
            max_chunks: 10,
            highlight: false
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const result = {
            text: response.data.answer || '',
            sources: response.data.web_results || []
        };

        // Cache the result (with 15-minute expiration)
        if (useCache) {
            searchCache.set(cacheKey, result);
            setTimeout(() => {
                searchCache.delete(cacheKey);
            }, 15 * 60 * 1000); // 15 minutes
        }

        return result;
    } catch (error) {
        console.error('Error with Perplexity search:', error.response?.data || error.message);
        throw new Error(`Perplexity API error: ${error.message}`);
    }
}

/**
 * Extract tool request from Claude response
 * @param {string} response - Claude response text
 * @returns {Object|null} - Tool request object or null
 */
function extractToolRequest(response) {
    // Check if finished with research
    if (response.toLowerCase().includes('final answer:')) {
        return { finished: true };
    }
    
    // Extract PERPLEXITY_SEARCH using the exact delimiters
    const perplexityPattern = /<<PERPLEXITY_SEARCH>>([\s\S]*?)<\/PERPLEXITY_SEARCH>/;
    const match = response.match(perplexityPattern);
    
    if (match && match[1]) {
        const query = match[1].trim();
        console.log('Extracted search query:', query);
        return {
            tool: 'perplexitySearch',
            params: { query: query }
        };
    }
    
    // Alternative format without closing tag (happens sometimes)
    const altPattern = /<<PERPLEXITY_SEARCH>>([\s\S]*?)(?=<<|$)/;
    const altMatch = response.match(altPattern);
    
    if (altMatch && altMatch[1] && !match) {
        const query = altMatch[1].trim();
        console.log('Extracted search query from alt pattern:', query);
        return {
            tool: 'perplexitySearch',
            params: { query: query }
        };
    }
    
    return null;
}

/**
 * Handle tool request
 * @param {Object} toolRequest - Tool request object 
 * @returns {Object} - Tool result
 */
async function handleToolRequest(toolRequest) {
    if (!toolRequest) return null;
    
    try {
        if (toolRequest.tool === 'perplexitySearch') {
            return await searchPerplexity(toolRequest.params.query);
        }
    } catch (error) {
        console.error('Tool error:', error);
        return { error: error.message };
    }
    
    return null;
}

module.exports = {
    callClaude,
    searchPerplexity,
    extractToolRequest,
    handleToolRequest
};