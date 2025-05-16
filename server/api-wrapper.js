const axios = require('axios');
require('dotenv').config();

// Cache to store recent search results and avoid duplicate API calls
const searchCache = new Map();

// Claude API wrapper
async function askClaude(prompt, systemPrompt = null, maxTokens = 1000) {
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

// Perplexity search wrapper
async function perplexitySearch(query, useCache = true) {
    // Check cache first if enabled
    const cacheKey = query.toLowerCase().trim();
    if (useCache && searchCache.has(cacheKey)) {
        console.log('Using cached result for query:', query);
        return searchCache.get(cacheKey);
    }

    try {
        const requestBody = {
            model: "sonar-medium-online",
            messages: [
                {
                    role: "user",
                    content: query
                }
            ]
        };

        const response = await axios.post('https://api.perplexity.ai/chat/completions', requestBody, {
            headers: {
                'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const result = {
            content: response.data.choices?.[0]?.message?.content || '',
            links: extractLinks(response.data.choices?.[0]?.message?.content || ''),
            usage: response.data.usage
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

// Website search (simplified version without FireCrawl)
async function websiteSearch(url) {
    // In a real implementation, this would use a website scraping tool
    // For now, we'll use perplexity to get information about the website
    return perplexitySearch(`Please analyze the company website at ${url}. What products or services do they offer? How many employees do they have? What markets or industries do they serve?`);
}

// Radaris search for owner's age
async function radarisSearch(name, location = null) {
    let query = `Search for information about ${name}`;
    if (location) {
        query += ` in ${location}`;
    }
    query += ` on Radaris or similar people search services. What is their approximate age?`;
    
    return perplexitySearch(query);
}

// Extract links from perplexity results
function extractLinks(text) {
    const linkRegex = /https?:\/\/[^\s)]+/g;
    return text.match(linkRegex) || [];
}

// Generate a research prompt for Claude based on question and company
function generateResearchPrompt(company, question, previousFindings = null) {
    let prompt = `I need information about the company "${company.companyName}".\n\n`;
    
    // Include identifiers for company verification
    prompt += "COMPANY IDENTIFIERS:\n";
    if (company.companyName) prompt += `Company Name: ${company.companyName}\n`;
    if (company.owner) prompt += `Owner/Key Person: ${company.owner}\n`;
    if (company.title) prompt += `Title: ${company.title}\n`;
    if (company.location) prompt += `Location: ${company.location}\n`;
    if (company.website) prompt += `Website: ${company.website}\n`;
    if (company.linkedinUrl) prompt += `LinkedIn: ${company.linkedinUrl}\n`;
    
    // Include previous findings if available
    if (previousFindings && Object.keys(previousFindings).length > 0) {
        prompt += "\nPREVIOUS FINDINGS:\n";
        for (const [key, value] of Object.entries(previousFindings)) {
            prompt += `${key}: ${value}\n`;
        }
    }
    
    // Main question
    prompt += `\nI need to answer this specific question: "${question.text}"\n`;
    prompt += `A positive answer would be: "${question.positiveAnswer}"\n`;
    
    if (question.note) {
        prompt += `Note: ${question.note}\n`;
    }
    
    // Instructions for verification and response format
    prompt += `\nIMPORTANT INSTRUCTIONS:
1. Make sure you're researching the correct company by verifying against the company identifiers
2. If you find information about a different company with a similar name, note this and try to refocus on the target company
3. Provide a direct YES or NO answer to the question if possible
4. Include your confidence level (HIGH, MEDIUM, LOW)
5. Include brief evidence or reasoning for your answer
6. List any sources or websites you used for reference`;

    return prompt;
}

// Create Claude system prompt for company research
function createSystemPrompt() {
    return `You are a company research assistant for SmartBroker. Your job is to find specific information about companies to determine if they match certain investment criteria.

Follow these guidelines:
1. Be thorough but concise in your research
2. Always verify you're analyzing the correct company (check name, location, and other identifiers)
3. Focus specifically on answering the given question accurately
4. If you can't find a definitive answer, state your uncertainty and what additional information would be helpful
5. Use a clear format with a direct answer and supporting evidence
6. Cost-efficiency is important - try to provide definitive answers with minimal API usage`;
}

// Determine if Claude's response is a positive match for the question
function interpretClaudeResponse(response, question) {
    const content = response.content.toLowerCase();
    let isPositive = false;
    let confidence = 'LOW';
    
    // Check for direct yes/no answers
    if (content.includes('yes') || content.includes('positive') || content.includes('affirmative')) {
        isPositive = true;
    }
    
    // Check for confidence level
    if (content.includes('high confidence') || content.includes('confidence: high')) {
        confidence = 'HIGH';
    } else if (content.includes('medium confidence') || content.includes('confidence: medium')) {
        confidence = 'MEDIUM';
    }
    
    // Extract evidence
    const evidenceMatch = content.match(/evidence:(.+?)(?=\n\n|\n[A-Z]|$)/is);
    const evidence = evidenceMatch ? evidenceMatch[1].trim() : '';
    
    // Extract sources
    const sourcesMatch = content.match(/sources:(.+?)(?=\n\n|\n[A-Z]|$)/is);
    const sources = sourcesMatch ? sourcesMatch[1].trim() : '';
    
    return {
        question: question.text,
        answer: isPositive ? question.positiveAnswer : 'NO',
        confidence,
        evidence,
        sources
    };
}

module.exports = {
    askClaude,
    perplexitySearch,
    websiteSearch,
    radarisSearch,
    generateResearchPrompt,
    createSystemPrompt,
    interpretClaudeResponse
};