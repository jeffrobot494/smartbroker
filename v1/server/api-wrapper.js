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

// DEPRECATED - Now using only perplexitySearch
// These function wrappers are kept for compatibility but will be removed in future
async function websiteSearch(url) {
    return perplexitySearch(`Please analyze the company website at ${url}. What products or services do they offer? Who leads the company (CEO, owner, president)? How many employees do they have? What markets or industries do they serve?`);
}

// DEPRECATED - Now using only perplexitySearch
async function radarisSearch(name, location = null) {
    let query = `Find information about ${name}`;
    if (location) {
        query += ` in ${location}`;
    }
    query += `. What is their role at the company? What is their approximate age?`;
    
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
        
        // Special handling for Owner Age question if we already have the owner name
        if (question.text.includes("owner of the company at least 50 years old") && 
            previousFindings['Owner Name']) {
            prompt += `\nIMPORTANT: We've already identified that the owner/president is "${previousFindings['Owner Name']}". `;
            prompt += `Please specifically focus your research on finding the age of this person.\n`;
            prompt += `If you find information about the age of "${previousFindings['Owner Name']}", explicitly state it in your answer.\n`;
        }
    }
    
    // Main question
    prompt += `\nQUESTION: ${question.text}\n`;
    
    // Add detailed description for all questions
    if (question.detailedDescription) {
        prompt += `\nDETAILED DESCRIPTION:\n${question.detailedDescription}\n`;
    }
    
    // Add search guidance for all questions
    if (question.searchGuidance) {
        prompt += `\nSEARCH GUIDANCE:\n${question.searchGuidance}\n`;
    }
    
    // Add disqualification criteria for all questions
    if (question.disqualificationCriteria) {
        prompt += `\nDISQUALIFICATION CRITERIA:\n${question.disqualificationCriteria}\n`;
    }
    
    // Add useful sources
    if (question.usefulSources && question.usefulSources.length > 0) {
        prompt += `\nUSEFUL SOURCES:\n`;
        question.usefulSources.forEach(source => {
            prompt += `- ${source}\n`;
        });
    }
    
    // Add examples
    if (question.examples) {
        prompt += `\nEXAMPLES:\n`;
        if (question.examples.positive) {
            prompt += `Positive example: ${question.examples.positive}\n`;
        }
        if (question.examples.negative) {
            prompt += `Negative example: ${question.examples.negative}\n`;
        }
    }
    
    // Special handling for expected answer format
    if (question.text === "Who is the president or owner of the company?") {
        prompt += `\nANSWER FORMAT:\n`;
        prompt += `For this question, I need you to find the specific name of the president, owner, CEO, or founder.\n`;
        prompt += `If you find a name, provide it in your answer. If you can't find a name, indicate "unknown".\n`;
        prompt += `VERY IMPORTANT: When you provide your final answer, it must ONLY contain the name - no additional words or phrases.\n`;
        prompt += `Example of a correct answer: "Final Answer: John Smith" or "Final Answer: unknown"\n`;
        prompt += `Example of an incorrect answer: "Final Answer: The founder is John Smith" or "Final Answer: I found that John Smith is the CEO"\n`;
    } else {
        prompt += `\nANSWER FORMAT:\n`;
        prompt += `A positive answer would be: "${question.positiveAnswer}"\n`;
    }
    
    // Instructions for verification and response format
    prompt += `\nIMPORTANT INSTRUCTIONS:\n`;
    prompt += `1. Make sure you're researching the correct company by verifying against the company identifiers\n`;
    prompt += `2. If you find information about a different company with a similar name, note this and try to refocus on the target company\n`;
    
    // Special handling for the owner name question
    if (question.text === "Who is the president or owner of the company?") {
        prompt += `3. If you find a name, state it clearly like "The owner/president is [Name]"\n`;
        prompt += `4. If you cannot find a name, state "I could not find the owner or president's name"\n`;
    } else {
        prompt += `3. Provide a direct ${question.positiveAnswer} or NO answer to the question\n`;
    }
    
    prompt += `4. Include your confidence level (HIGH, MEDIUM, LOW)\n`;
    prompt += `5. Include brief evidence or reasoning for your answer\n`;
    prompt += `6. List any sources or websites you used for reference\n`;
    prompt += `7. End with a "Final Answer: " line that provides just the answer\n`;

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
6. Cost-efficiency is important - try to provide definitive answers with minimal API usage

You have access to one powerful research tool:
- PERPLEXITY_SEARCH - Search the web for any information you need

CRITICAL INSTRUCTIONS FOR TOOL USE:
You MUST use this EXACT format when you want to search:

<<PERPLEXITY_SEARCH>>
your detailed search query here
<</PERPLEXITY_SEARCH>>

Example usage:

<<PERPLEXITY_SEARCH>>
Who is the CEO, founder or owner of XYZ Company?
<</PERPLEXITY_SEARCH>>

The search query MUST be specific and focused. For different types of research:

- For company websites: 
<<PERPLEXITY_SEARCH>>
analyze company website at example.com for leadership team information
<</PERPLEXITY_SEARCH>>

- For people information: 
<<PERPLEXITY_SEARCH>>
find information about John Smith CEO of Example Corp including age and background
<</PERPLEXITY_SEARCH>>

- For product research: 
<<PERPLEXITY_SEARCH>>
Does ABC Software sell commercial software products or only services?
<</PERPLEXITY_SEARCH>>

When using the search tool:
1. Request ONE search at a time with a specific query
2. After receiving results, either request another search or provide your final answer
3. You can use a maximum of 3 searches per question
4. Always end with "Final Answer: YES", "Final Answer: NO", or "Final Answer: [Name]" depending on the question`;
}

// Determine if Claude's response is a positive match for the question
function interpretClaudeResponse(response, question) {
    const content = response.content;
    const contentLower = content.toLowerCase();
    let isPositive = false;
    let confidence = 'LOW';
    let answer = 'NO';
    
    // Special handling for the owner name question (question #3)
    if (question.text === "Who is the president or owner of the company?") {
        // First check if there's a direct answer format with a final answer line
        const finalAnswerMatch = content.match(/final answer:?\s*([^\n.]+)/i);
        if (finalAnswerMatch && finalAnswerMatch[1]) {
            const potentialName = finalAnswerMatch[1].trim();
            
            // Make sure it's not just a YES/NO/Unknown response
            if (!/^(yes|no|unknown|not found|couldn't find|could not find)$/i.test(potentialName)) {
                // Check if it's a proper name format (starts with capital letter)
                if (/^[A-Z][a-z]/.test(potentialName)) {
                    isPositive = true;
                    answer = potentialName;
                    // Skip the other pattern matching
                    return {
                        question: question.text,
                        answer: answer,
                        confidence,
                        evidence: '',
                        sources: ''
                    };
                }
            }
        }
        
        // If no direct final answer, try to extract a name from the response
        // Look for patterns like "The owner is [Name]" or "The president is [Name]"
        const namePatterns = [
            /(?:owner|president|ceo|founder|chief executive|leader) (?:is|appears to be) ([A-Z][a-z]+(?: [A-Z][a-z]+){1,4})/i,
            /([A-Z][a-z]+(?: [A-Z][a-z]+){1,4}) (?:is|appears to be)(?: the)? (?:owner|president|ceo|founder|chief executive|leader)/i,
            /name:? ([A-Z][a-z]+(?: [A-Z][a-z]+){1,4})/i,
            /found:? ([A-Z][a-z]+(?: [A-Z][a-z]+){1,4})/i
        ];
        
        let ownerName = null;
        
        // Try each pattern until we find a match
        for (const pattern of namePatterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                ownerName = match[1].trim();
                // Clean up the name - remove any trailing punctuation or phrases
                ownerName = ownerName.replace(/\.$/, '').trim();
                ownerName = ownerName.replace(/\s+(?:is|as|who|appears|seems).*$/, '').trim();
                break;
            }
        }
        
        // If a name was found, use it as the answer
        if (ownerName) {
            isPositive = true;
            answer = ownerName;
        } else if (contentLower.includes("could not find") || 
                  contentLower.includes("no information") || 
                  contentLower.includes("unclear") ||
                  contentLower.includes("not identified") ||
                  contentLower.includes("unknown")) {
            answer = "unknown";
        }
    } else {
        // Standard yes/no handling for other questions
        if (contentLower.includes('yes') || contentLower.includes('positive') || contentLower.includes('affirmative')) {
            isPositive = true;
        }
        
        answer = isPositive ? question.positiveAnswer : 'NO';
    }
    
    // Check for confidence level
    if (contentLower.includes('high confidence') || contentLower.includes('confidence: high')) {
        confidence = 'HIGH';
    } else if (contentLower.includes('medium confidence') || contentLower.includes('confidence: medium')) {
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
        answer: answer,
        confidence,
        evidence,
        sources
    };
}

// Extract tool request from Claude's response
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
    
    // Handle legacy patterns as fallbacks
    
    // Legacy perplexitySearch format
    if (response.includes('perplexitySearch:')) {
        console.log('WARNING: Using legacy perplexitySearch: format');
        const queryMatch = response.match(/perplexitySearch:\s*([^\n]+)/i);
        return queryMatch ? { 
            tool: 'perplexitySearch', 
            params: { query: queryMatch[1].trim() } 
        } : null;
    }
    
    // Legacy websiteSearch format
    if (response.includes('websiteSearch:')) {
        console.log('WARNING: Using legacy websiteSearch: format');
        const urlMatch = response.match(/websiteSearch:\s*(https?:\/\/[^\s\n]+)/);
        if (urlMatch) {
            return { 
                tool: 'perplexitySearch', 
                params: { query: `Analyze the company website at ${urlMatch[1]}. What products or services do they offer? Who leads the company? How many employees do they have?` } 
            };
        }
    }
    
    // Legacy radarisSearch format
    if (response.includes('radarisSearch:')) {
        console.log('WARNING: Using legacy radarisSearch: format');
        const nameMatch = response.match(/radarisSearch:\s*([^\n]+)/i);
        if (nameMatch) {
            return { 
                tool: 'perplexitySearch', 
                params: { query: `Find information about ${nameMatch[1].trim()}. What is their role and approximate age?` } 
            };
        }
    }
    
    return null;
}

// Handle tool requests
async function handleToolRequest(toolRequest) {
    if (!toolRequest) return null;
    
    try {
        // All tool requests go through perplexitySearch
        if (toolRequest.tool === 'perplexitySearch') {
            return await perplexitySearch(toolRequest.params.query);
        }
        
        // Legacy tools - should never reach here due to extractToolRequest conversion
        // but kept for safety
        if (toolRequest.tool === 'websiteSearch') {
            console.log('WARNING: Legacy websiteSearch called directly, converting to perplexitySearch');
            return await perplexitySearch(`Analyze the company website at ${toolRequest.params.url}. What products or services do they offer? Who leads the company? How many employees do they have?`);
        }
        if (toolRequest.tool === 'radarisSearch') {
            console.log('WARNING: Legacy radarisSearch called directly, converting to perplexitySearch');
            return await perplexitySearch(`Find information about ${toolRequest.params.name}. What is their role and approximate age?`);
        }
    } catch (error) {
        console.error('Tool error:', error);
        return { error: error.message };
    }
    
    return null;
}

module.exports = {
    askClaude,
    perplexitySearch,
    websiteSearch,
    radarisSearch,
    generateResearchPrompt,
    createSystemPrompt,
    interpretClaudeResponse,
    extractToolRequest,
    handleToolRequest
};