const { ClaudeClient, PerplexityClient, ResearchClient, TemplateClient, PhantomBusterClient } = require('./api-clients');
const CompanyLoader = require('./company-loader');
const CostCalculator = require('./cost-calculator');

const CONFIDENCE_LEVELS = {
  1: { label: 'guess', description: '0-60% chance this is true' },
  2: { label: 'probably', description: '61-79% chance this is true' },
  3: { label: 'very likely', description: '80-100% chance this is true' }
};

class ResearchEngine {
  constructor() {
    // Use same port logic as server
    const serverURL = `http://localhost:${process.env.PORT || 3000}`;
    
    this.claude = new ClaudeClient(serverURL);
    this.perplexity = new PerplexityClient(serverURL);
    this.phantombuster = new PhantomBusterClient(serverURL);
    this.research = new ResearchClient(serverURL);
    this.template = new TemplateClient(serverURL);
    this.companyLoader = new CompanyLoader();
    this.costCalculator = new CostCalculator();
    this.maxIterations = 5;
    this.currentTemplate = null;
    this.currentCriteria = [];
    this.investigationCosts = {}; // Track costs for current investigation
    this.stopChecker = null; // Function to check if research should stop
    this.hasFatalAPIError = false; // Track fatal API errors
    this.lastFatalError = null; // Store original fatal error message
  }

  /**
   * Set a function to check if research should stop
   * @param {Function} stopChecker - Function that returns true if research should stop
   */
  setStopChecker(stopChecker) {
    this.stopChecker = stopChecker;
  }

  /**
   * Check if research should stop and throw error if so
   */
  checkIfStopped() {
    if (this.stopChecker && this.stopChecker()) {
      throw new Error('Research stopped by user');
    }
    if (this.hasFatalAPIError) {
      throw new Error(`Research stopped: ${this.lastFatalError || 'API service unavailable'}`);
    }
  }

  /**
   * Check if an error is a fatal API error that should stop research
   * @param {Error} error - The error to check
   * @returns {boolean} True if this is a fatal API error
   */
  isFatalAPIError(error) {
    const fatalMessages = [
      'insufficient_quota',
      'quota_exceeded', 
      'credits_exhausted',
      'billing_not_active',
      'api_key_invalid',
      'unauthorized',
      'credit balance is too low',
      'usage limit exceeded',
      'account suspended'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return fatalMessages.some(msg => errorMessage.includes(msg));
  }

  /**
   * Centralized API call wrapper with consistent error handling
   * @param {Function} apiFunction - The API function to call
   * @param {...any} args - Arguments to pass to the API function
   * @returns {Promise<Object>} { success: boolean, data?: any, error?: string }
   */
  async safeAPICall(apiFunction, ...args) {
    try {
      const result = await apiFunction(...args);
      return { success: true, data: result };
    } catch (error) {
      if (this.isFatalAPIError(error)) {
        this.hasFatalAPIError = true;
        this.lastFatalError = error.message; // Store original error
        console.log(`[FATAL API ERROR] ${error.message} - Research will stop at next checkpoint`);
        return { success: false, error: error.message };
      }
      
      console.log(`[API ERROR] ${error.message} - Continuing research`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Initialize engine by loading template from database
   */
  async initialize() {
    try {
      console.log(`[DEBUG] ResearchEngine.initialize() starting...`);
      console.log(`[DEBUG] TemplateClient serverURL:`, this.template.serverURL);
      
      const templateData = await this.template.getActiveTemplate();
      
      console.log(`[DEBUG] ResearchEngine.initialize() got template data:`, {
        id: templateData?.id,
        name: templateData?.name,
        criteriaCount: templateData?.criteria?.length,
        companiesCount: templateData?.companies?.length
      });
      
      
      this.currentTemplate = templateData;
      this.currentCriteria = templateData.criteria;
      
      console.log(`[DEBUG] ResearchEngine.initialize() completed successfully`);
    } catch (error) {
      console.error(`[DEBUG] ResearchEngine.initialize() failed:`, {
        message: error.message,
        stack: error.stack
      });
      console.error('Error loading template:', error.message);
      throw error;
    }
  }

  /**
   * Load companies from data file
   * @returns {Array} Array of company objects
   */
  loadCompanies() {
    return this.companyLoader.loadCompanies();
  }

  /**
   * Save companies to data file
   * @param {Array} companies - Array of company objects
   */
  saveCompanies(companies) {
    this.companyLoader.saveCompanies(companies);
  }

  /**
   * Get current research template info
   * @returns {Object} Template information
   */
  getTemplateInfo() {
    if (!this.currentTemplate) {
      throw new Error('Template not loaded. Call initialize() first.');
    }
    
    return {
      id: this.currentTemplate.id,
      name: this.currentTemplate.name,
      systemPrompt: this.currentTemplate.systemPrompt,
      criteria: this.currentCriteria
    };
  }

  /**
   * Research companies in a range against specified criteria
   * @param {Array} companies - All companies
   * @param {number} startIndex - Start index (0-based)
   * @param {number} endIndex - End index (0-based, inclusive)
   * @param {Array} criteriaNames - Array of criterion names to research
   * @param {Object} options - Research options
   * @param {Function} progressCallback - Called with progress updates
   * @returns {Object} Research results summary
   */
  async researchCompanyRange(companies, startIndex, endIndex, criteriaNames, options = {}, progressCallback = null) {
    const {
      verbosity = 4,
      waitBetweenTools = false,
      continueWithRemaining = false
    } = options;

    // Get criteria objects
    const criteriaToResearch = this.currentCriteria.filter(c => criteriaNames.includes(c.name));
    const companiesInRange = companies.slice(startIndex, endIndex + 1);

    let totalResearched = 0;
    let totalSkipped = 0;
    let totalDisqualified = 0;

    for (const criterion of criteriaToResearch) {
      // Check if research should stop before starting each criterion
      this.checkIfStopped();
      
      if (progressCallback) {
        progressCallback({
          type: 'criterion_start',
          criterion: criterion.name,
          total: criteriaToResearch.length
        });
      }

      for (let i = 0; i < companiesInRange.length; i++) {
        // Check if research should stop before each company
        this.checkIfStopped();
        
        const company = companiesInRange[i];
        const globalIndex = startIndex + i + 1;

        if (progressCallback) {
          progressCallback({
            type: 'company_start',
            company: company.name,
            index: globalIndex,
            criterion: criterion.name
          });
        }

        // Get research results for this company (filtered by current template)
        let companyResults = [];
        try {
          companyResults = await this.research.getCompanyResults(company.name, this.currentTemplate.id);
        } catch (error) {
          console.warn(`Error getting research results for ${company.name}: ${error.message}`);
        }

        // Check if company is disqualified based on research results
        const disqualifyingCriteria = this.currentCriteria.filter(c => c.disqualifying).map(c => c.name);
        const isDisqualified = companyResults.some(result => 
          disqualifyingCriteria.includes(result.criterion) && result.type === 'negative'
        );
        if (isDisqualified) {
          totalSkipped++;
          if (progressCallback) {
            progressCallback({
              type: 'company_skipped',
              reason: 'disqualified'
            });
          }
          continue;
        }

        // Check if research already exists for this criterion
        const hasResult = companyResults.some(result => result.criterion === criterion.name);
        if (hasResult) {
          totalSkipped++;
          if (progressCallback) {
            progressCallback({
              type: 'company_skipped',
              reason: 'already_researched'
            });
          }
          continue;
        }

        try {
          const result = await this.researchCompanyCriterion(
            company, 
            criterion, 
            { verbosity, waitBetweenTools },
            progressCallback
          );
          
          totalResearched++;

          // Track disqualification for session statistics
          if (criterion.disqualifying && result.type === 'negative') {
            totalDisqualified++;
            
            if (progressCallback) {
              progressCallback({
                type: 'company_disqualified',
                reason: criterion.name
              });
            }
          }

        } catch (error) {
          // Handle errors from researchCompanyCriterion
          if (progressCallback) {
            progressCallback({
              type: 'research_error',
              error: error.message
            });
          }
          console.error(`Research error for ${company.name}: ${error.message}`);
        }
      }
    }

    // Save results
    this.saveCompanies(companies);

    return {
      totalResearched,
      totalSkipped,
      totalDisqualified,
      companiesProcessed: companiesInRange.length,
      criteriaProcessed: criteriaToResearch.length
    };
  }

  /**
   * Research a single company against a criterion
   * @param {Object} company - Company object
   * @param {Object} criterion - Criterion object
   * @param {Object} options - Research options
   * @param {Function} progressCallback - Progress callback
   * @returns {Object} Research result
   */
  async researchCompanyCriterion(company, criterion, options = {}, progressCallback = null) {
    const { verbosity = 4, waitBetweenTools = false } = options;
    
    const companyInfo = this.companyLoader.formatCompanyInfo(company);
    const conversation = [];
    let iterations = 0;
    let toolCalls = 0;

    // Get previous research results for context (from current template only)
    let previousResults = [];
    try {
      const allResults = await this.research.getCompanyResults(company.name, this.currentTemplate.id);
      previousResults = allResults.filter(result => result.criterion !== criterion.name);
    } catch (error) {
      console.warn(`Error getting previous results for ${company.name}: ${error.message}`);
    }

    // Execute automatic first query only if template exists
    let automaticSearchResults = '';
    if (criterion.firstQueryTemplate && criterion.firstQueryTemplate.trim()) {
      automaticSearchResults = await this.executeAutomaticFirstQuery(company, criterion, progressCallback);
    } else {
      if (progressCallback) {
        progressCallback({
          type: 'automatic_query_skipped',
          criterionName: criterion.name,
          reason: 'No first query template defined'
        });
      }
    }
    
    const initialPrompt = this.createEnhancedPrompt(criterion, companyInfo, automaticSearchResults, previousResults);

    conversation.push({ role: 'user', content: initialPrompt });

    if (progressCallback) {
      progressCallback({
        type: 'prompt_sent',
        prompt: verbosity >= 3 ? initialPrompt : null
      });
    }
    
    while (iterations < this.maxIterations) {
      iterations++;

      try {
        // DEBUG: Log before Claude API call
        const conversationSize = JSON.stringify(conversation).length;
        const systemPromptSize = this.currentTemplate.systemPrompt.length;
        console.log(`[DEBUG] About to call Claude API - Conversation: ${conversationSize} chars, System Prompt: ${systemPromptSize} chars, Total messages: ${conversation.length}`);
        
        // Show complete Claude API payload at verbosity 4
        if (progressCallback && verbosity >= 4) {
          progressCallback({
            type: 'claude_message_sent',
            payload: {
              messages: conversation,
              systemPrompt: this.currentTemplate.systemPrompt,
              model: 'claude-sonnet-4-20250514',
              maxTokens: 4000
            }
          });
        }

        // Build system prompt with iteration context
        const remainingAttempts = this.maxIterations - iterations;
        const iterationContext = remainingAttempts === 0 
          ? `\n\nCRITICAL: Final iteration (${iterations}/${this.maxIterations}). You must provide a definitive answer or use TYPE: unknown_result if insufficient information exists.`
          : `\n\nResearch Status: Iteration ${iterations}/${this.maxIterations} - ${remainingAttempts} more attempts remaining.`;
        
        const systemPromptWithContext = this.currentTemplate.systemPrompt + iterationContext;
        
        const claudeResult = await this.safeAPICall(
          () => this.claude.sendMessage(conversation, systemPromptWithContext)
        );

        if (!claudeResult.success) {
          console.log(`[DEBUG] Claude API failed: ${claudeResult.error}`);
          break; // Exit iteration loop
        }

        const response = claudeResult.data;
        console.log(`[DEBUG] Claude API call successful - Response length: ${response.content.length} chars`);
        
        // Calculate and track Claude costs
        const claudeCost = this.costCalculator.calculateClaudeCost(
          response.usage.input_tokens,
          response.usage.output_tokens
        );
        this.investigationCosts.claude = claudeCost;
        
        if (progressCallback) {
          progressCallback({
            type: 'claude_response',
            content: verbosity >= 3 ? response.content : null,
            tokens: response.usage.output_tokens,
            cost: claudeCost
          });
        }
        
        const parsed = this.parseClaudeResponse(response.content);
        
        if (parsed.type === 'tool_use') {
          if (progressCallback) {
            progressCallback({
              type: 'tool_request',
              toolName: parsed.toolName,
              query: parsed.query,
              waitForApproval: waitBetweenTools
            });
          }

          let finalQuery = parsed.query;
          let userOverride = null;

          // If waiting between tools, the UI layer will handle user input
          // For now, just use the original query
          if (waitBetweenTools && progressCallback) {
            // The callback can return user override
            const approval = await new Promise(resolve => {
              progressCallback({
                type: 'tool_approval_needed',
                query: parsed.query,
                onApproval: resolve
              });
            });
            
            if (approval && approval.override) {
              finalQuery = approval.override;
              userOverride = approval.override;
            }
          }

          const toolResult = await this.executeTool(parsed.toolName, finalQuery);
          toolCalls++;
          
          // DEBUG: Log tool result details
          console.log(`[DEBUG] Tool ${parsed.toolName} completed. Result length: ${toolResult.length} chars`);
          if (parsed.toolName === 'phantombuster_linkedin') {
            console.log(`[DEBUG] PhantomBuster result preview: ${toolResult.substring(0, 200)}...`);
          }
          
          if (progressCallback) {
            progressCallback({
              type: 'tool_result',
              result: verbosity >= 2 ? toolResult : null,
              userOverride
            });
          }

          conversation.push({ role: 'assistant', content: response.content });
          conversation.push({ role: 'user', content: `Tool result:\n${toolResult}` });
          
          // DEBUG: Log conversation size before next Claude call
          const conversationSize = JSON.stringify(conversation).length;
          console.log(`[DEBUG] Conversation size after tool result: ${conversationSize} chars, ${conversation.length} messages`);
          
        } else {
          // Final answer
          const result = {
            criterion: criterion.name,
            answer: parsed.answer,
            explanation: parsed.explanation,
            confidence_score: parsed.confidence_score,
            type: parsed.type,
            iterations: iterations,
            toolCalls: toolCalls,
            usage: response.usage
          };

          // Save research result to server
          try {
            const companyData = {
              website: company.website,
              linkedin: company.linkedin,
              city: company.city,
              state: company.state,
              phone: company.phone,
              revenue: company.revenue,
              'president/owner/ceo': company['president/owner/ceo'],
              other: company.other
            };
            
            // Include cost data when saving result
            const totalCost = this.costCalculator.aggregateCosts(this.investigationCosts);
            const costsData = { ...this.investigationCosts, total: totalCost.grand_total };
            
            await this.research.saveResult(company.name, criterion.id, result, companyData, costsData);
          } catch (error) {
            console.error(`Error saving research result for ${company.name}: ${error.message}`);
          }
          
          if (progressCallback) {
            progressCallback({
              type: 'final_result',
              company: company.name,
              criterion: criterion.name,
              result: {
                type: parsed.type,
                answer: parsed.answer,
                explanation: parsed.explanation,
                confidence_score: parsed.confidence_score
              }
            });
          }
          
          return result;
        }
        
      } catch (error) {
        if (progressCallback) {
          progressCallback({
            type: 'error',
            error: error.message
          });
        }
        throw error;
      }
    }

    throw new Error('Research exceeded maximum iterations');
  }

  /**
   * Parse Claude's response to extract type and content
   */
  parseClaudeResponse(content) {
    const lines = content.trim().split('\n');
    const typeLine = lines[0];
    
    const typeMatch = typeLine.match(/TYPE:\s*(tool_use|positive_result|negative_result|unknown_result)/i);
    if (!typeMatch) {
      throw new Error('Could not parse response type from Claude');
    }
    
    const type = typeMatch[1].toLowerCase();
    
    // Single confidence extraction method
    const confidence_score = this.extractConfidenceScore(content);
    
    if (type === 'tool_use') {
      const toolMatch = content.match(/<<(\w+):\s*([^>>]+)>>/);
      if (!toolMatch) {
        throw new Error('Could not parse tool request from Claude');
      }
      
      return {
        type: 'tool_use',
        toolName: toolMatch[1],
        query: toolMatch[2].trim(),
        explanation: lines.slice(1).join('\n').trim()
      };
    } else {
      const answer = lines[1] ? lines[1].trim() : '';
      const explanation = lines.slice(2).join('\n').trim();
      
      const typeMap = {
        'positive_result': 'positive',
        'negative_result': 'negative',
        'unknown_result': 'unknown'
      };
      
      return {
        type: typeMap[type],
        answer: answer,
        explanation: explanation,
        confidence_score: confidence_score
      };
    }
  }

  /**
   * Extract confidence score from Claude response
   */
  extractConfidenceScore(content) {
    const confidenceMatch = content.match(/Confidence:\s*([123])/i);
    const score = confidenceMatch ? parseInt(confidenceMatch[1]) : null;
    
    // Validate score is within our defined range
    if (score && !CONFIDENCE_LEVELS[score]) {
      console.warn(`Invalid confidence score: ${score}. Expected 1-3.`);
      return null;
    }
    
    return score;
  }

  /**
   * Template Management Methods (Business Logic)
   */

  /**
   * Get all templates with current active marked
   */
  async getTemplateList() {
    return await this.template.getTemplates();
  }

  /**
   * Switch to a different template and reload engine
   */
  async switchToTemplate(templateId) {
    await this.template.setActiveTemplate(templateId);
    await this.initialize(); // Reload engine with new template
    return this.currentTemplate;
  }

  /**
   * Create a new template with optional copying
   */
  async createNewTemplate(name, basedOnTemplateId = null, makeActive = false) {
    const result = await this.template.createTemplate(name, basedOnTemplateId, makeActive);
    if (makeActive) {
      await this.initialize(); // Reload engine if this template was activated
    }
    return result;
  }

  /**
   * Remove a template (with business rule validation handled by API)
   */
  async removeTemplate(templateId) {
    return await this.template.deleteTemplate(templateId);
  }

  /**
   * Get system prompt for a template
   */
  async getSystemPrompt(templateId) {
    return await this.template.getSystemPrompt(templateId);
  }

  /**
   * Update system prompt for a template and reload engine if it's the current template
   */
  async updateSystemPrompt(templateId, newPrompt) {
    const result = await this.template.updateSystemPrompt(templateId, newPrompt);
    
    // If we're updating the current template, reload the engine
    if (this.currentTemplate && this.currentTemplate.id === templateId) {
      await this.initialize();
    }
    
    return result;
  }

  /**
   * Add criterion to a template and reload engine if it's the current template
   */
  async addCriterion(templateId, criterionData) {
    const result = await this.template.createCriterion(templateId, criterionData);
    
    // If we're adding to the current template, reload the engine
    if (this.currentTemplate && this.currentTemplate.id === templateId) {
      await this.initialize();
    }
    
    return result;
  }

  /**
   * Modify criterion and reload engine if it affects the current template
   */
  async modifyCriterion(criterionId, updates) {
    const result = await this.template.updateCriterion(criterionId, updates);
    
    // Check if this criterion belongs to current template
    if (this.currentTemplate && this.currentCriteria.some(c => c.id === criterionId)) {
      await this.initialize();
    }
    
    return result;
  }

  /**
   * Remove criterion and reload engine if it affects the current template
   */
  async removeCriterion(criterionId) {
    const result = await this.template.deleteCriterion(criterionId);
    
    // Check if this criterion belongs to current template
    if (this.currentTemplate && this.currentCriteria.some(c => c.id === criterionId)) {
      await this.initialize();
    }
    
    return result;
  }

  /**
   * Reorder criterion and reload engine if it affects the current template
   */
  async reorderCriteria(criterionId, newOrderIndex) {
    const result = await this.template.reorderCriterion(criterionId, newOrderIndex);
    
    // Check if this criterion belongs to current template
    if (this.currentTemplate && this.currentCriteria.some(c => c.id === criterionId)) {
      await this.initialize();
    }
    
    return result;
  }

  /**
   * Execute a tool request
   */
  async executeTool(toolName, query) {
    switch (toolName.toLowerCase()) {
      case 'perplexity_search':
        const perplexityResult = await this.safeAPICall(
          () => this.perplexity.search(query)
        );
        
        if (!perplexityResult.success) {
          return `Error executing ${toolName}: ${perplexityResult.error}`;
        }
        
        // Track Perplexity cost
        const perplexityCost = this.costCalculator.calculateToolCost('perplexity', 1);
        this.investigationCosts.perplexity = perplexityCost;
        return perplexityResult.data.content;
        
      case 'phantombuster_linkedin':
        if (!query.includes('linkedin.com')) {
          return 'Error: PhantomBuster requires a valid LinkedIn URL (must contain "linkedin.com")';
        }
        
        const phantomResult = await this.safeAPICall(
          () => this.phantombuster.scrapeLinkedIn(query.trim())
        );
        
        if (!phantomResult.success) {
          return `Error executing ${toolName}: ${phantomResult.error}`;
        }
        
        // Track PhantomBuster cost
        const phantombusterCost = this.costCalculator.calculateToolCost('phantombuster', 1);
        this.investigationCosts.phantombuster = phantombusterCost;
        return phantomResult.data.content;
        
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Get results table data for display
   * @param {Array} companies - All companies
   * @param {number} page - Page number (0-based)
   * @param {number} pageSize - Number of companies per page
   * @returns {Object} Table data
   */
  async getResultsTable(companies, page = 0, pageSize = 20) {
    const start = page * pageSize;
    const end = Math.min(start + pageSize, companies.length);
    const pageCompanies = companies.slice(start, end);

    const tableData = [];
    
    for (let index = 0; index < pageCompanies.length; index++) {
      const company = pageCompanies[index];
      const row = {
        index: start + index + 1,
        name: company.name,
        results: {}
      };

      for (const criterion of this.currentCriteria) {
        try {
          const result = await this.research.getResult(company.name, criterion.id);
          if (result) {
            if (result.type === 'positive') row.results[criterion.name] = '+';
            else if (result.type === 'negative') row.results[criterion.name] = '-';
            else row.results[criterion.name] = '?';
          } else {
            row.results[criterion.name] = '';
          }
        } catch (error) {
          console.warn(`Error getting result for ${company.name}, ${criterion.name}: ${error.message}`);
          row.results[criterion.name] = '';
        }
      }

      tableData.push(row);
    }

    return {
      data: tableData,
      pagination: {
        currentPage: page,
        pageSize: pageSize,
        totalCompanies: companies.length,
        totalPages: Math.ceil(companies.length / pageSize),
        start: start + 1,
        end: end
      },
      criteria: this.currentCriteria.map(c => ({ name: c.name, disqualifying: c.disqualifying }))
    };
  }

  /**
   * Execute automatic first query using criterion template
   * @param {Object} company - Company object
   * @param {Object} criterion - Criterion object  
   * @param {Function} progressCallback - Progress callback
   * @returns {string} Search results
   */
  async executeAutomaticFirstQuery(company, criterion, progressCallback = null) {
    try {
      const query = this.substitutePlaceholders(criterion.firstQueryTemplate, company);
      
      if (progressCallback) {
        progressCallback({
          type: 'automatic_query',
          query: query,
          criterionName: criterion.name
        });
      }
      
      const perplexityResult = await this.safeAPICall(
        () => this.perplexity.search(query)
      );

      if (!perplexityResult.success) {
        console.warn(`Automatic first query failed: ${perplexityResult.error}`);
        return `Error in automatic query: ${perplexityResult.error}`;
      }

      const result = perplexityResult.data;
      
      // Track Perplexity cost for automatic query
      const perplexityCost = this.costCalculator.calculateToolCost('perplexity', 1);
      
      // Accumulate with existing perplexity costs (in case tool calls also use perplexity)
      if (this.investigationCosts.perplexity) {
        this.investigationCosts.perplexity.calls += perplexityCost.calls;
        this.investigationCosts.perplexity.cost += perplexityCost.cost;
      } else {
        this.investigationCosts.perplexity = perplexityCost;
      }
      
      if (progressCallback) {
        progressCallback({
          type: 'automatic_query_result',
          result: result.content
        });
      }
      
      return result.content;
    } catch (error) {
      if (progressCallback) {
        progressCallback({
          type: 'automatic_query_error',
          error: error.message
        });
      }
      return `Error executing automatic query: ${error.message}`;
    }
  }

  /**
   * Substitute placeholders in query template
   * @param {string} template - Query template with placeholders
   * @param {Object} company - Company object
   * @returns {string} Query with substituted values
   */
  substitutePlaceholders(template, company) {
    return template
      .replace(/{company_name}/g, company.name || 'the company')
      .replace(/{city}/g, company.city || '')
      .replace(/{state}/g, company.state || '')
      .replace(/{website}/g, company.website || '')
      .replace(/{linkedin}/g, company.linkedin || '')
      .replace(/{phone}/g, company.phone || '')
      .replace(/{revenue}/g, company.revenue || '')
      .replace(/{president_owner_ceo}/g, company['president/owner/ceo'] || '');
  }

  /**
   * Create enhanced prompt with automatic search results and previous research context
   * @param {Object} criterion - Criterion object
   * @param {string} companyInfo - Formatted company information
   * @param {string} searchResults - Initial search results
   * @param {Array} previousResults - Previous research results for context
   * @returns {string} Enhanced prompt
   */
  createEnhancedPrompt(criterion, companyInfo, searchResults, previousResults = []) {
    let prompt = `Criterion: ${criterion.description}

The company you are researching is:
${companyInfo}`;

    // Add previous research results if available
    if (previousResults.length > 0) {
      prompt += `\n\nPrevious Research Results:`;
      previousResults.forEach(result => {
        prompt += `\n- ${result.criterion}: ${result.answer}`;
      });
    }

    if (searchResults && searchResults.trim()) {
      prompt += `\n\nInitial Research Results:
${searchResults}

Based on the initial research results${previousResults.length > 0 ? ', previous research findings,' : ''} and company information above, please determine your answer for the criterion: ${criterion.name}`;
    } else {
      prompt += `\n\nBased on${previousResults.length > 0 ? ' the previous research findings and' : ''} the company information above, please determine your answer for the criterion: ${criterion.name}`;
    }

    prompt += `

Expected answer format: ${criterion.answerFormat}`;

    return prompt;
  }

  /**
   * Clear all research results from the database
   * @returns {Object} Summary of deleted records
   */
  async clearAllResults() {
    return await this.research.clearAllResults();
  }

  /**
   * Get summary statistics
   * @param {Array} companies - All companies
   * @returns {Object} Summary stats
   */
  getSummaryStats(companies) {
    const qualified = companies.filter(c => !c.disqualified);
    const disqualified = companies.filter(c => c.disqualified);
    
    const researchedCount = companies.filter(c => 
      c.research && Object.keys(c.research).length > 0
    ).length;

    return {
      total: companies.length,
      qualified: qualified.length,
      disqualified: disqualified.length,
      researched: researchedCount,
      disqualificationReasons: disqualified.reduce((acc, company) => {
        const reason = company.disqualificationReason || 'Unknown';
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {})
    };
  }

  /**
   * Get session cost summary
   * @returns {Promise<Object>} Cost summary for display
   */
  async getSessionCostSummary() {
    const dbSummary = await this.research.getCostSummary();
    const investigations = dbSummary.investigations || 1; // Avoid division by zero
    const total = dbSummary.total || 0;
    
    return {
      total_cost: this.costCalculator.formatCost(total),
      cost_per_company: this.costCalculator.formatCost(total / investigations),
      investigations: investigations,
      breakdown: {
        claude: this.costCalculator.formatCost(dbSummary.claude || 0),
        perplexity: this.costCalculator.formatCost(dbSummary.perplexity || 0),
        phantombuster: this.costCalculator.formatCost(dbSummary.phantombuster || 0)
      }
    };
  }

  /**
   * Reset investigation costs for new research session
   */
  resetInvestigationCosts() {
    this.investigationCosts = {};
  }
}

module.exports = ResearchEngine;