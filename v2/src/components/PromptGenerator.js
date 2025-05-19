/**
 * PromptGenerator Component
 * Creates structured prompts for AI research based on companies and questions
 */
export default class PromptGenerator {
    constructor() {
        // Default templates
        this.systemPromptTemplate = this.getDefaultSystemPrompt();
    }

    /**
     * Generate research prompt for a specific company and question
     * @param {Object} company - Company object with details
     * @param {Object} question - Question object with criteria
     * @param {Object} previousFindings - Previous research findings (optional)
     * @returns {string} Formatted prompt text
     */
    generateResearchPrompt(company, question, previousFindings = null) {
        let prompt = `I need information about the company "${company.companyName}".\n\n`;
        
        // Company identifiers
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
            
            // Special handling for Owner Age question if we have owner name
            if (question.text.includes("owner of the company at least 50 years old") && 
                previousFindings['Owner Name']) {
                prompt += `\nIMPORTANT: We've already identified that the owner/president is "${previousFindings['Owner Name']}". `;
                prompt += `Please specifically focus your research on finding the age of this person.\n`;
                prompt += `If you find information about the age of "${previousFindings['Owner Name']}", explicitly state it in your answer.\n`;
            }
        }
        
        // Main question
        prompt += `\nQUESTION: ${question.text}\n`;
        
        // Add detailed description
        if (question.detailedDescription) {
            prompt += `\nDETAILED DESCRIPTION:\n${question.detailedDescription}\n`;
        }
        
        // Add search guidance
        if (question.searchGuidance) {
            prompt += `\nSEARCH GUIDANCE:\n${question.searchGuidance}\n`;
        }
        
        // Add disqualification criteria
        if (question.disqualificationCriteria) {
            prompt += `\nDISQUALIFICATION CRITERIA:\n${question.disqualificationCriteria}\n`;
        }
        
        // Handle answer format
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
            prompt += `\nSPECIAL INSTRUCTIONS FOR OWNER NAME RESEARCH:
For this specific question about finding the owner or president, please follow these steps:

1. First, perform an initial search using this exact format:

<<PERPLEXITY_SEARCH>>
Who is the CEO, founder, president or owner of ${company.companyName}?
<</PERPLEXITY_SEARCH>>

2. If you find a potential name, verify it with a second search:

<<PERPLEXITY_SEARCH>>
Verify if [Name] is the current CEO/owner of ${company.companyName}. Find additional sources.
<</PERPLEXITY_SEARCH>>

3. Do not guess or provide a name without clear evidence
4. If you can't find reliable information, answer "unknown"
5. Be wary of outdated information - verify recent sources when possible\n`;
        } else {
            prompt += `3. Provide a direct ${question.positiveAnswer} or NO answer to the question\n`;
        }
        
        prompt += `4. Include your confidence level (HIGH, MEDIUM, LOW)\n`;
        prompt += `5. Include brief evidence or reasoning for your answer\n`;
        prompt += `6. List any sources or websites you used for reference\n`;
        prompt += `7. End with a "Final Answer: " line that provides just the answer\n`;
    
        return prompt;
    }

    /**
     * Get default system prompt template
     * @returns {string} Default system prompt template
     */
    getDefaultSystemPrompt() {
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
1. Request ONE search at a time with a specific query. You will then be given a new prompt from the user with results from your query.
2. After receiving results, either request another search or provide your final answer
3. You can use a maximum of 3 searches per question
4. Always end with "Final Answer: YES", "Final Answer: NO", or "Final Answer: [Name]" depending on the question`;
    }

    /**
     * Generate system prompt for AI research
     * @param {Object} options - Configuration options
     * @returns {string} System prompt for AI research
     */
    generateSystemPrompt(options = {}) {
        let systemPrompt = this.systemPromptTemplate;
        
        // Allow customization of the max tools limit
        if (options.maxTools) {
            systemPrompt = systemPrompt.replace(
                'You can use a maximum of 3 searches per question', 
                `You can use a maximum of ${options.maxTools} searches per question`
            );
        }
        
        return systemPrompt;
    }
}