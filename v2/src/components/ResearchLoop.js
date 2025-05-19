/**
 * ResearchLoop Component
 * Manages the conversation flow with Claude for company research
 */
export default class ResearchLoop {
    /**
     * @param {Object} tools - Tools component instance
     * @param {Object} promptGenerator - PromptGenerator component instance
     * @param {Object} contextManager - ContextManager component instance
     * @param {Object} verificationModule - VerificationModule component instance (optional)
     */
    constructor(tools, promptGenerator, contextManager, verificationModule = null) {
        this.tools = tools;
        this.promptGenerator = promptGenerator;
        this.contextManager = contextManager;
        this.verificationModule = verificationModule;
        this.MAX_ITERATIONS = 3;
        this.dataSource = null; // Will be set by the App class
        this.callbacks = {
            onStart: null,
            onToolRequest: null,
            onToolResult: null,
            onComplete: null,
            onError: null,
            onIteration: null,
            onPaused: null
        };
    }
    
    /**
     * Set data source reference
     * @param {Object} dataSource - DataSource component instance
     */
    setDataSource(dataSource) {
        this.dataSource = dataSource;
    }

    /**
     * Set callback functions
     * @param {Object} callbacks - Callback functions
     */
    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * Set maximum iterations
     * @param {number} maxIterations - Maximum number of iterations
     */
    setMaxIterations(maxIterations) {
        this.MAX_ITERATIONS = maxIterations;
    }

    /**
     * Start research process for a company and question
     * @param {Object} company - Company to research
     * @param {Object} question - Question to answer
     * @param {Object} options - Research options
     * @returns {Promise<Object>} Research result
     */
    async startResearch(company, question, options = {}) {
        try {
            // Call onStart callback if provided
            if (this.callbacks.onStart) {
                this.callbacks.onStart({ company, question });
            }

            // Generate initial prompt
            const previousFindings = options.previousFindings || null;
            const prompt = this.promptGenerator.generateResearchPrompt(company, question, previousFindings);
            const systemPrompt = this.promptGenerator.generateSystemPrompt({ 
                maxTools: options.maxTools || this.MAX_ITERATIONS
            });

            // Initialize context
            this.contextManager.startConversation(prompt, systemPrompt);
            
            // Start the research loop
            const result = await this.runResearchLoop(company, question, options);
            
            // Verify results if verification module is provided and verification is enabled
            if (this.verificationModule && options.verifyResults && 
                result && !result.verified) {
                const verifiedResult = await this.verificationModule.verifyResult(
                    company, question, result
                );
                return verifiedResult;
            }
            
            return result;
        } catch (error) {
            console.error('Research error:', error);
            if (this.callbacks.onError) {
                this.callbacks.onError(error);
            }
            return { error: error.message };
        }
    }

    /**
     * Run the research loop
     * @param {Object} company - Company to research
     * @param {Object} question - Question to answer
     * @param {Object} options - Research options
     * @returns {Promise<Object>} Research result
     */
    async runResearchLoop(company, question, options = {}) {
        let iterations = 0;
        let toolsUsed = [];
        
        // Check if we should reset paused state
        if (this.dataSource && options.resetPaused) {
            this.dataSource.updateInvestigationState({ isPaused: false });
        }
        
        // Check if research has been paused before we even start
        if (this.dataSource && this.dataSource.getInvestigationState().isPaused) {
            console.log('Research paused before starting - returning immediately');
            
            // Call onPaused callback if provided
            if (this.callbacks.onPaused) {
                this.callbacks.onPaused({
                    company,
                    question,
                    iterations: 0,
                    toolsUsed: []
                });
            }
            
            // Return partial result for now
            return {
                question: question.text,
                answer: "PAUSED",
                confidence: "LOW",
                evidence: "Investigation was paused by user before starting.",
                claudeResponse: "",
                toolsUsed: [],
                iterations: 0,
                timestamp: new Date().toISOString(),
                usage: null,
                verified: false,
                paused: true
            };
        }
        
        // Get current conversation from context manager
        let conversation = this.contextManager.getCurrentConversation();
        let systemPrompt = this.contextManager.getSystemPrompt();
        
        // Show the prompt in the terminal
        if (this.callbacks.onPrompt) {
            this.callbacks.onPrompt({
                prompt: conversation,
                systemPrompt: systemPrompt
            });
        }
        
        // Check again for pause state before making API call
        if (this.dataSource && this.dataSource.getInvestigationState().isPaused) {
            console.log('Research paused before Claude API call');
            return {
                question: question.text,
                answer: "PAUSED",
                confidence: "LOW",
                evidence: "Investigation was paused by user before starting Claude research.",
                claudeResponse: "",
                toolsUsed: [],
                iterations: 0,
                timestamp: new Date().toISOString(),
                usage: null,
                verified: false,
                paused: true
            };
        }
        
        // Initial Claude call
        let claudeResponse = await this.tools.askClaude(
            conversation,
            systemPrompt,
            options.maxTokens || 2000
        );
        
        // Show Claude's response in the terminal
        if (this.callbacks.onResponse) {
            this.callbacks.onResponse(claudeResponse);
        }
        
        // Update conversation with Claude's response
        this.contextManager.addMessage('assistant', claudeResponse.content);
        
        // Main research loop
        while (iterations < this.MAX_ITERATIONS) {
            // Check if research has been paused
            if (this.dataSource && this.dataSource.getInvestigationState().isPaused) {
                console.log('Research paused by user');
                
                // Call onPaused callback if provided
                if (this.callbacks.onPaused) {
                    this.callbacks.onPaused({
                        company,
                        question,
                        iterations,
                        toolsUsed
                    });
                }
                
                // Return partial result for now
                return {
                    question: question.text,
                    answer: "PAUSED",
                    confidence: "LOW",
                    evidence: "Investigation was paused by user.",
                    claudeResponse: claudeResponse?.content || "",
                    toolsUsed: toolsUsed,
                    iterations: iterations,
                    timestamp: new Date().toISOString(),
                    usage: claudeResponse?.usage || null,
                    verified: false,
                    paused: true
                };
            }
            
            console.log(`Research iteration ${iterations + 1}/${this.MAX_ITERATIONS}`);
            
            // Call onIteration callback if provided
            if (this.callbacks.onIteration) {
                this.callbacks.onIteration({
                    iteration: iterations + 1,
                    maxIterations: this.MAX_ITERATIONS,
                    response: claudeResponse
                });
            }
            
            // Add debugging to trace the response
            console.log('Claude response:', { 
                contentLength: claudeResponse.content?.length,
                contentSnippet: claudeResponse.content?.substring(0, 100) + '...',
                hasPerplexityTag: claudeResponse.content?.includes('<<PERPLEXITY_SEARCH>>')
            });
            
            // Extract tool request
            console.log('Extracting tool request from Claude response...');
            const toolRequest = this.tools.extractToolRequest(claudeResponse.content);
            console.log('Tool request extraction result:', toolRequest);
            
            // If no tool request or research is complete, break the loop
            if (!toolRequest || toolRequest.finished) {
                console.log('No valid tool request found or research is complete');
                
                // Check if Claude has provided a final answer
                if (toolRequest && toolRequest.finished) {
                    console.log('Research complete with final answer');
                    break;
                }
                
                // Check if Claude's response seems to be attempting a search but not using the right format
                if (claudeResponse.content.toLowerCase().includes('search') && 
                    !claudeResponse.content.includes('<<PERPLEXITY_SEARCH>>')) {
                    
                    console.log('Claude tried to search without using the correct format. Sending reminder.');
                    
                    // Add a reminder about the correct format
                    const reminderMessage = `\n\nREMINDER: To perform a search, use this exact format:
<<PERPLEXITY_SEARCH>>
your search query
<</PERPLEXITY_SEARCH>>`;
                    
                    console.log('Adding reminder to conversation');
                    // Add reminder to conversation
                    this.contextManager.addMessage('user', reminderMessage);
                    conversation = this.contextManager.getCurrentConversation();
                    
                    console.log('Continuing conversation with reminder');
                    // Continue conversation with the reminder
                    claudeResponse = await this.tools.askClaude(conversation, systemPrompt, 2000);
                    
                    // Update conversation with new response
                    this.contextManager.addMessage('assistant', claudeResponse.content);
                    
                    continue;
                }
                
                console.log('No tool request found and no search attempted');
                break;
            }
            
            // Call onToolRequest callback if provided
            console.log('Tool request found, processing with callback if available');
            if (this.callbacks.onToolRequest) {
                console.log('onToolRequest callback exists, calling it');
                // Allow user to pause and approve the tool use
                const shouldContinue = await this.callbacks.onToolRequest(toolRequest);
                console.log('onToolRequest callback result:', shouldContinue);
                if (!shouldContinue) {
                    console.log('Tool request cancelled by user');
                    break;
                }
            } else {
                console.log('No onToolRequest callback exists');
            }
            
            // Execute the requested tool
            console.log(`Executing tool: ${toolRequest.tool}`, toolRequest.params);
            const toolResult = await this.tools.handleToolRequest(toolRequest);
            console.log('Tool execution result:', toolResult);
            
            // Track which tools were used
            toolsUsed.push({
                tool: toolRequest.tool,
                params: toolRequest.params
            });
            
            // Call onToolResult callback if provided
            if (this.callbacks.onToolResult) {
                this.callbacks.onToolResult({
                    request: toolRequest,
                    result: toolResult
                });
            }
            
            // Format tool result in a standardized way
            const formattedToolResult = `
<<PERPLEXITY_RESULT>>
${JSON.stringify(toolResult, null, 2)}
<</PERPLEXITY_RESULT>>
`;
            
            // Add tool result to conversation
            this.contextManager.addMessage('user', formattedToolResult);
            conversation = this.contextManager.getCurrentConversation();
            
            // Show the prompt in the terminal
            if (this.callbacks.onPrompt) {
                this.callbacks.onPrompt({
                    prompt: conversation,
                    systemPrompt: systemPrompt
                });
            }
            
            // Continue conversation with Claude
            claudeResponse = await this.tools.askClaude(conversation, systemPrompt, 2000);
            
            // Show Claude's response in the terminal
            if (this.callbacks.onResponse) {
                this.callbacks.onResponse(claudeResponse);
            }
            
            // Update conversation with new response
            this.contextManager.addMessage('assistant', claudeResponse.content);
            
            iterations++;
        }
        
        // Extract final answer from Claude's response
        const finalAnswer = this.extractFinalAnswer(claudeResponse.content, question);
        
        // Create result object
        const result = {
            question: question.text,
            answer: finalAnswer.answer,
            confidence: finalAnswer.confidence,
            evidence: finalAnswer.evidence,
            sources: finalAnswer.sources,
            claudeResponse: claudeResponse.content,
            toolsUsed: toolsUsed,
            iterations: iterations,
            timestamp: new Date().toISOString(),
            usage: claudeResponse.usage,
            verified: false
        };
        
        // Call onComplete callback if provided
        if (this.callbacks.onComplete) {
            this.callbacks.onComplete(result);
        }
        
        return result;
    }

    /**
     * Extract final answer from Claude's response
     * @param {string} content - Claude's response content
     * @param {Object} question - Question object
     * @returns {Object} Final answer details
     */
    extractFinalAnswer(content, question) {
        const contentLower = content.toLowerCase();
        let isPositive = false;
        let confidence = 'LOW';
        let answer = 'NO';
        let evidence = '';
        let sources = '';
        
        // Special handling for the owner name question
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
                    }
                }
            }
            
            // If no direct final answer, try to extract a name from the response
            if (!isPositive) {
                // Look for patterns like "The owner is [Name]" or "The president is [Name]"
                const namePatterns = [
                    /(?:owner|president|ceo|founder|chief executive|leader) (?:is|appears to be) ([A-Z][a-z]+(?: [A-Z][a-z]+){1,4})/i,
                    /([A-Z][a-z]+(?: [A-Z][a-z]+){1,4}) (?:is|appears to be)(?: the)? (?:owner|president|ceo|founder|chief executive|leader)/i,
                    /name:? ([A-Z][a-z]+(?: [A-Z][a-z]+){1,4})/i,
                    /found:? ([A-Z][a-z]+(?: [A-Z][a-z]+){1,4})/i
                ];
                
                for (const pattern of namePatterns) {
                    const match = content.match(pattern);
                    if (match && match[1]) {
                        const ownerName = match[1].trim()
                            .replace(/\.$/, '') // Remove trailing period
                            .replace(/\s+(?:is|as|who|appears|seems).*$/, ''); // Remove trailing phrases
                        
                        isPositive = true;
                        answer = ownerName;
                        break;
                    }
                }
            }
            
            // If still no name found, mark as unknown
            if (!isPositive) {
                if (contentLower.includes("could not find") || 
                    contentLower.includes("no information") || 
                    contentLower.includes("unclear") ||
                    contentLower.includes("not identified") ||
                    contentLower.includes("unknown")) {
                    answer = "unknown";
                }
            }
        } else {
            // Standard yes/no handling for other questions
            if (contentLower.includes('yes') || 
                contentLower.includes('positive') || 
                contentLower.includes('affirmative')) {
                isPositive = true;
            }
            
            answer = isPositive ? question.positiveAnswer : 'NO';
        }
        
        // Check for confidence level
        if (contentLower.includes('high confidence') || 
            contentLower.includes('confidence: high')) {
            confidence = 'HIGH';
        } else if (contentLower.includes('medium confidence') || 
                  contentLower.includes('confidence: medium')) {
            confidence = 'MEDIUM';
        }
        
        // Extract evidence
        const evidenceMatch = content.match(/evidence:(.+?)(?=\n\n|\n[A-Z]|$)/is);
        if (evidenceMatch) {
            evidence = evidenceMatch[1].trim();
        }
        
        // Extract sources
        const sourcesMatch = content.match(/sources:(.+?)(?=\n\n|\n[A-Z]|$)/is);
        if (sourcesMatch) {
            sources = sourcesMatch[1].trim();
        }
        
        return {
            answer,
            confidence,
            evidence,
            sources
        };
    }

    /**
     * Cancel ongoing research
     */
    cancelResearch() {
        // Implement cancellation logic if needed
        console.log('Research cancelled by user');
    }
}