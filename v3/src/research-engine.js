const { ClaudeClient, PerplexityClient, ResearchClient } = require('./api-clients');
const CompanyLoader = require('./company-loader');
const { SYSTEM_PROMPT, CRITERIA } = require('./criteria');

class ResearchEngine {
  constructor() {
    this.claude = new ClaudeClient();
    this.perplexity = new PerplexityClient();
    this.research = new ResearchClient();
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
        try {
          const hasResult = await this.research.checkExists(company.name, criterion.name);
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
        } catch (error) {
          console.warn(`Error checking research result for ${company.name}: ${error.message}`);
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
          }

        } catch (error) {
          if (progressCallback) {
            progressCallback({
              type: 'research_error',
              error: error.message
            });
          }
          
          // Store error result
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
            
            await this.research.saveResult(company.name, criterion.name, {
              error: error.message,
              answer: 'Error',
              explanation: `Research failed: ${error.message}`,
              type: 'error'
            }, companyData);
          } catch (saveError) {
            console.error(`Error saving error result for ${company.name}: ${saveError.message}`);
          }
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

    // Execute automatic first query
    const automaticSearchResults = await this.executeAutomaticFirstQuery(company, criterion, progressCallback);
    
    const initialPrompt = this.createEnhancedPrompt(criterion, companyInfo, automaticSearchResults);

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
            
            await this.research.saveResult(company.name, criterion.name, result, companyData);
          } catch (error) {
            console.error(`Error saving research result for ${company.name}: ${error.message}`);
          }
          
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

      for (const criterion of CRITERIA) {
        try {
          const result = await this.research.getResult(company.name, criterion.name);
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
      criteria: CRITERIA.map(c => ({ name: c.name, disqualifying: c.disqualifying }))
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
      
      const result = await this.perplexity.search(query);
      
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
    return template.replace(/{company_name}/g, company.name || 'the company');
  }

  /**
   * Create enhanced prompt with automatic search results
   * @param {Object} criterion - Criterion object
   * @param {string} companyInfo - Formatted company information
   * @param {string} searchResults - Initial search results
   * @returns {string} Enhanced prompt
   */
  createEnhancedPrompt(criterion, companyInfo, searchResults) {
    return `Criterion: ${criterion.description}

The company you are researching is:
${companyInfo}

Initial Research Results:
${searchResults}

Based on the initial research results and company information above, please determine your answer for the criterion: ${criterion.name}

Expected answer format: ${criterion.answerFormat}`;
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