const { ClaudeClient, PerplexityClient } = require('./api-clients');
const CompanyLoader = require('./company-loader');
const { SYSTEM_PROMPT, CRITERIA } = require('./criteria');

class ResearchEngine {
  constructor() {
    this.claude = new ClaudeClient();
    this.perplexity = new PerplexityClient();
    this.companyLoader = new CompanyLoader();
    this.maxIterations = 5;
    this.currentTemplate = 'Default';
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
    return {
      name: this.currentTemplate,
      systemPrompt: SYSTEM_PROMPT,
      criteria: CRITERIA
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
      verbosity = 1,
      waitBetweenTools = false,
      continueWithRemaining = false
    } = options;

    // Get criteria objects
    const criteriaToResearch = CRITERIA.filter(c => criteriaNames.includes(c.name));
    const companiesInRange = companies.slice(startIndex, endIndex + 1);

    let totalResearched = 0;
    let totalSkipped = 0;
    let totalDisqualified = 0;

    for (const criterion of criteriaToResearch) {
      if (progressCallback) {
        progressCallback({
          type: 'criterion_start',
          criterion: criterion.name,
          total: criteriaToResearch.length
        });
      }

      for (let i = 0; i < companiesInRange.length; i++) {
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

        // Skip if already disqualified
        if (company.disqualified) {
          totalSkipped++;
          if (progressCallback) {
            progressCallback({
              type: 'company_skipped',
              reason: 'disqualified'
            });
          }
          continue;
        }

        // Skip if already researched
        if (this.companyLoader.hasResearchResult(company, criterion.name)) {
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

          // Check for disqualification
          if (criterion.disqualifying && result.type === 'negative') {
            company.disqualified = true;
            company.disqualificationReason = criterion.name;
            totalDisqualified++;
            
            if (progressCallback) {
              progressCallback({
                type: 'company_disqualified',
                reason: criterion.name
              });
            }
            
            // Stop researching this company for remaining criteria
            break;
          }

        } catch (error) {
          if (progressCallback) {
            progressCallback({
              type: 'research_error',
              error: error.message
            });
          }
          
          // Store error result
          this.companyLoader.addResearchResult(company, criterion.name, {
            error: error.message,
            answer: 'Error',
            explanation: `Research failed: ${error.message}`
          });
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
    const { verbosity = 1, waitBetweenTools = false } = options;
    
    const companyInfo = this.companyLoader.formatCompanyInfo(company);
    const conversation = [];
    let iterations = 0;
    let toolCalls = 0;

    const initialPrompt = `${criterion.text}

The company you are researching is:
${companyInfo}

Please analyze this company and determine your answer for the criterion: ${criterion.name}`;

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
        const response = await this.claude.sendMessage(conversation, SYSTEM_PROMPT);
        
        if (progressCallback) {
          progressCallback({
            type: 'claude_response',
            content: verbosity >= 3 ? response.content : null,
            tokens: response.usage.output_tokens
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
          
          if (progressCallback) {
            progressCallback({
              type: 'tool_result',
              result: verbosity >= 2 ? toolResult : null,
              userOverride
            });
          }

          conversation.push({ role: 'assistant', content: response.content });
          conversation.push({ role: 'user', content: `Tool result:\n${toolResult}` });
          
        } else {
          // Final answer
          const result = {
            criterion: criterion.name,
            answer: parsed.answer,
            explanation: parsed.explanation,
            type: parsed.type,
            iterations: iterations,
            toolCalls: toolCalls,
            usage: response.usage
          };

          this.companyLoader.addResearchResult(company, criterion.name, result);
          
          if (progressCallback) {
            progressCallback({
              type: 'final_result',
              answer: parsed.answer,
              explanation: parsed.explanation,
              type: parsed.type
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
    
    const typeMatch = typeLine.match(/TYPE:\s*(tool_use|positive_result|negative_result)/i);
    if (!typeMatch) {
      throw new Error('Could not parse response type from Claude');
    }
    
    const type = typeMatch[1].toLowerCase();
    
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
      
      return {
        type: type === 'positive_result' ? 'positive' : 'negative',
        answer: answer,
        explanation: explanation
      };
    }
  }

  /**
   * Execute a tool request
   */
  async executeTool(toolName, query) {
    try {
      switch (toolName.toLowerCase()) {
        case 'perplexity_search':
          const result = await this.perplexity.search(query);
          return result.content;
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      return `Error executing ${toolName}: ${error.message}`;
    }
  }

  /**
   * Get results table data for display
   * @param {Array} companies - All companies
   * @param {number} page - Page number (0-based)
   * @param {number} pageSize - Number of companies per page
   * @returns {Object} Table data
   */
  getResultsTable(companies, page = 0, pageSize = 20) {
    const start = page * pageSize;
    const end = Math.min(start + pageSize, companies.length);
    const pageCompanies = companies.slice(start, end);

    const tableData = pageCompanies.map((company, index) => {
      const row = {
        index: start + index + 1,
        name: company.name,
        results: {}
      };

      CRITERIA.forEach(criterion => {
        const result = this.companyLoader.getResearchResult(company, criterion.name);
        if (result) {
          if (result.type === 'positive') row.results[criterion.name] = '+';
          else if (result.type === 'negative') row.results[criterion.name] = '-';
          else row.results[criterion.name] = '?';
        } else {
          row.results[criterion.name] = '';
        }
      });

      return row;
    });

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
      criteria: CRITERIA.map(c => ({ name: c.name, disqualifying: c.disqualifying }))
    };
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
}

module.exports = ResearchEngine;