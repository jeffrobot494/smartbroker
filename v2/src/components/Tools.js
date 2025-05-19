/**
 * Tools Component
 * Handles external API calls and tool request extraction
 */
export default class Tools {
    constructor(apiKeys = {}) {
        // Always assume APIs are configured
        this.serverApiStatus = {
            claudeConfigured: true,
            perplexityConfigured: true
        };
        
        this.searchCache = new Map(); // Cache for search results
        this.cacheTTL = 15 * 60 * 1000; // 15 minutes
    }

    /**
     * Check if server APIs are configured
     * @returns {boolean} True if APIs are configured on server, false otherwise
     */
    hasServerApiAccess() {
        // Always return true - we assume APIs are configured
        return true;
    }

    /**
     * Extract tool request from Claude's response
     * @param {string} response - Claude's response text
     * @returns {Object|null} Tool request object or null if none found
     */
    extractToolRequest(response) {
        console.log('extractToolRequest called with response length:', response?.length);
        console.log('Response includes PERPLEXITY_SEARCH:', response?.includes('<<PERPLEXITY_SEARCH>>'));
        console.log('Response includes /PERPLEXITY_SEARCH:', response?.includes('<</PERPLEXITY_SEARCH>>'));
        
        // Check if response is valid
        if (!response) {
            console.error('extractToolRequest received empty response');
            return null;
        }
        
        // Check if finished with research
        if (response.toLowerCase().includes('final answer:')) {
            console.log('Found "final answer" - research is complete');
            return { finished: true };
        }
        
        // Extract PERPLEXITY_SEARCH using the exact delimiters
        const perplexityPattern = /<<PERPLEXITY_SEARCH>>([\s\S]*?)<<\/PERPLEXITY_SEARCH>>|<<PERPLEXITY_SEARCH>>([\s\S]*?)$/;
        const match = response.match(perplexityPattern);
        
        if (match) {
            console.log('PERPLEXITY_SEARCH match found:', match);
            if (match[1] || match[2]) {
                const query = (match[1] || match[2]).trim();
                console.log('Extracted search query:', query);
                return {
                    tool: 'perplexitySearch',
                    params: { query: query }
                };
            } else {
                console.log('Match found but no capture groups?', match);
            }
        } else {
            console.log('No PERPLEXITY_SEARCH pattern match found');
            // Log the full response for debugging (truncated for readability)
            const truncatedResponse = response.length > 200 
                ? response.substring(0, 100) + '...' + response.substring(response.length - 100) 
                : response;
            console.log('Response content (truncated):', truncatedResponse);
        }
        
        // Handle legacy patterns as fallbacks
        if (response.includes('perplexitySearch:')) {
            console.log('Using legacy perplexitySearch format');
            const queryMatch = response.match(/perplexitySearch:\s*([^\n]+)/i);
            if (queryMatch) {
                console.log('Legacy format query:', queryMatch[1].trim());
                return { 
                    tool: 'perplexitySearch', 
                    params: { query: queryMatch[1].trim() } 
                };
            } else {
                console.log('Legacy format mentioned but no query found');
            }
        }
        
        return null;
    }

    /**
     * Call Claude API via server proxy
     * @param {string} prompt - User prompt
     * @param {string} systemPrompt - System prompt
     * @param {number} maxTokens - Maximum tokens to generate
     * @returns {Promise<Object>} Claude's response
     */
    async askClaude(prompt, systemPrompt = null, maxTokens = 1000) {
        // Assume Claude API is configured

        try {
            const messages = [
                {
                    role: "user",
                    content: prompt
                }
            ];

            const requestBody = {
                model: "claude-3-7-sonnet-latest",
                messages: messages,
                max_tokens: maxTokens
            };

            if (systemPrompt) {
                requestBody.system = systemPrompt;
            }

            const response = await fetch('/api/claude', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Claude API error: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            
            return {
                content: data.content?.[0]?.text || '',
                model: data.model,
                usage: data.usage
            };
        } catch (error) {
            console.error('Error calling Claude API:', error);
            throw new Error(`Claude API error: ${error.message}`);
        }
    }

    /**
     * Call Perplexity API for web search via server proxy
     * @param {string} query - Search query
     * @param {boolean} useCache - Whether to use cache
     * @returns {Promise<Object>} Search results
     */
    async perplexitySearch(query, useCache = true) {
        console.log('perplexitySearch called with query:', query);
        
        // Assume Perplexity API is configured

        // Check cache first if enabled
        const cacheKey = query.toLowerCase().trim();
        if (useCache && this.searchCache.has(cacheKey)) {
            console.log('Using cached result for query:', query);
            return this.searchCache.get(cacheKey);
        }

        try {
            const requestBody = {
                query: query
            };
            
            console.log('Making request to /api/perplexity with body:', requestBody);

            const response = await fetch('/api/perplexity', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            console.log('Perplexity API response status:', response.status);
            
            if (!response.ok) {
                console.error('Perplexity API error - status:', response.status);
                const errorData = await response.json();
                console.error('Perplexity API error - data:', errorData);
                const errorMessage = `Perplexity API error: ${errorData.error || response.statusText}`;
                
                // Create a result that clearly indicates the search failed
                const errorResult = {
                    error: true,
                    errorMessage: errorMessage,
                    content: `[ERROR] Search failed: ${errorMessage}`,
                    links: [],
                    sources: []
                };
                
                console.error('Returning error result:', errorResult);
                
                // Don't cache error results
                return errorResult;
            }

            const data = await response.json();
            console.log('Perplexity API response data:', data);
            
            // Handle the chat completions response format
            const content = data.choices?.[0]?.message?.content || '';
            console.log('Extracted content length:', content.length);
            
            const result = {
                content: content,
                links: this.extractLinks(content) || [],
                sources: []
            };
            
            console.log('Prepared search result:', { 
                contentLength: result.content.length,
                linksCount: result.links.length
            });

            // Cache the result with expiration
            if (useCache) {
                this.searchCache.set(cacheKey, result);
                setTimeout(() => {
                    this.searchCache.delete(cacheKey);
                }, this.cacheTTL);
            }

            return result;
        } catch (error) {
            console.error('Error with Perplexity search:', error);
            
            // Return a structured error result instead of throwing
            const errorResult = {
                error: true,
                errorMessage: `Perplexity API error: ${error.message}`,
                content: `[ERROR] Search failed: ${error.message}`,
                links: [],
                sources: []
            };
            
            console.error('Returning error result from catch:', errorResult);
            
            return errorResult;
        }
    }

    /**
     * Extract links from perplexity results
     * @param {string} text - Text containing links
     * @returns {Array} Array of URLs
     */
    extractLinks(text) {
        const linkRegex = /https?:\/\/[^\s)]+/g;
        return text.match(linkRegex) || [];
    }

    /**
     * Handle tool requests
     * @param {Object} toolRequest - Tool request object
     * @returns {Promise<Object>} Tool result
     */
    async handleToolRequest(toolRequest) {
        console.log('handleToolRequest called with:', toolRequest);
        
        if (!toolRequest) {
            console.error('handleToolRequest received null/undefined toolRequest');
            return null;
        }
        
        try {
            // All tool requests go through perplexitySearch
            if (toolRequest.tool === 'perplexitySearch') {
                console.log('Processing perplexitySearch request with query:', toolRequest.params.query);
                const result = await this.perplexitySearch(toolRequest.params.query);
                console.log('perplexitySearch result:', result);
                return result;
            } else {
                console.warn('Unknown tool type requested:', toolRequest.tool);
            }
        } catch (error) {
            console.error('Tool error:', error);
            return { 
                error: true,
                errorMessage: error.message,
                content: `[ERROR] Search failed: ${error.message}`
            };
        }
        
        return null;
    }

    /**
     * Clear search cache
     */
    clearCache() {
        this.searchCache.clear();
    }
}