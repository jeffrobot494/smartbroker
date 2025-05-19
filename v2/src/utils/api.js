/**
 * API utility functions for SmartBroker v2
 * Provides helper functions for API calls to Claude and Perplexity
 */

/**
 * Call Claude API with proper error handling and retries
 * @param {string} apiKey - Claude API key
 * @param {Object} requestBody - Request body for Claude API
 * @param {number} maxRetries - Maximum number of retries (default: 2)
 * @returns {Promise<Object>} Response object with text and usage
 */
export async function callClaudeAPI(apiKey, requestBody, maxRetries = 2) {
    if (!apiKey) {
        throw new Error('Claude API key is required');
    }
    
    const apiUrl = 'https://api.anthropic.com/v1/messages';
    let retries = 0;
    
    while (retries <= maxRetries) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Claude API error (${response.status}): ${errorData.error?.message || response.statusText}`);
            }
            
            const data = await response.json();
            
            return {
                text: data.content?.[0]?.text || '',
                usage: {
                    input_tokens: data.usage?.input_tokens || 0,
                    output_tokens: data.usage?.output_tokens || 0
                }
            };
            
        } catch (error) {
            retries++;
            
            // If it's the last retry, throw the error
            if (retries > maxRetries) {
                throw error;
            }
            
            // Exponential backoff
            const delay = Math.min(1000 * Math.pow(2, retries), 10000);
            console.log(`Retrying Claude API call in ${delay}ms (${retries}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * Call Perplexity API with proper error handling and retries
 * @param {string} apiKey - Perplexity API key
 * @param {string} query - Search query
 * @param {number} maxRetries - Maximum number of retries (default: 2)
 * @returns {Promise<string>} Search results text
 */
export async function callPerplexityAPI(apiKey, query, maxRetries = 2) {
    if (!apiKey) {
        throw new Error('Perplexity API key is required');
    }
    
    if (!query || query.trim() === '') {
        throw new Error('Search query is required');
    }
    
    // Use server proxy endpoint if available, otherwise direct API call
    const apiUrl = 'https://api.perplexity.ai/search';
    let retries = 0;
    
    while (retries <= maxRetries) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    query: query,
                    max_chunks: 10,
                    highlight: false
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Perplexity API error (${response.status}): ${errorData.error || response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.answer) {
                throw new Error('No results found in Perplexity response');
            }
            
            return {
                text: data.answer,
                sources: data.web_results || []
            };
            
        } catch (error) {
            retries++;
            
            // If it's the last retry, throw the error
            if (retries > maxRetries) {
                throw error;
            }
            
            // Exponential backoff
            const delay = Math.min(1000 * Math.pow(2, retries), 10000);
            console.log(`Retrying Perplexity API call in ${delay}ms (${retries}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * Check if an API response contains rate limiting or quota errors
 * @param {Error} error - Error object from API call
 * @returns {boolean} True if the error is related to rate limiting
 */
export function isRateLimitError(error) {
    if (!error) return false;
    
    const errorMessage = error.message || '';
    
    // Check for common rate limit indicators
    return (
        errorMessage.toLowerCase().includes('rate limit') ||
        errorMessage.toLowerCase().includes('quota') ||
        errorMessage.toLowerCase().includes('too many requests') ||
        errorMessage.toLowerCase().includes('429')
    );
}

/**
 * Parse Claude API error message
 * @param {Error} error - Error object from Claude API call
 * @returns {Object} Parsed error with type and message
 */
export function parseClaudeError(error) {
    if (!error) {
        return { type: 'unknown', message: 'Unknown error' };
    }
    
    const errorMessage = error.message || '';
    
    if (isRateLimitError(error)) {
        return { type: 'rate_limit', message: 'Rate limit or quota exceeded' };
    }
    
    if (errorMessage.toLowerCase().includes('api key') || 
        errorMessage.toLowerCase().includes('authentication') ||
        errorMessage.toLowerCase().includes('unauthorized')) {
        return { type: 'auth', message: 'API key or authentication error' };
    }
    
    if (errorMessage.toLowerCase().includes('content policy') || 
        errorMessage.toLowerCase().includes('content moderation') ||
        errorMessage.toLowerCase().includes('prohibited content')) {
        return { type: 'moderation', message: 'Content policy violation' };
    }
    
    if (errorMessage.toLowerCase().includes('timeout') ||
        errorMessage.toLowerCase().includes('timed out')) {
        return { type: 'timeout', message: 'Request timed out' };
    }
    
    return { type: 'other', message: errorMessage };
}

/**
 * Format sources from Perplexity API response
 * @param {Array} sources - Array of source objects
 * @returns {string} Formatted sources text
 */
export function formatPerplexitySources(sources) {
    if (!sources || !Array.isArray(sources) || sources.length === 0) {
        return '';
    }
    
    // Deduplicate sources by URL
    const uniqueSources = [];
    const seenUrls = new Set();
    
    for (const source of sources) {
        if (!source.url || seenUrls.has(source.url)) continue;
        
        seenUrls.add(source.url);
        uniqueSources.push(source);
    }
    
    // Format each source as "title (url)"
    const formattedSources = uniqueSources.map(source => {
        const title = source.title || 'Untitled';
        const url = source.url || '';
        
        return `${title} (${url})`;
    });
    
    return formattedSources.join('\n');
}