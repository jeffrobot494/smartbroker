class ResearchDAO {
  constructor(database) {
    this.db = database;
  }

  /**
   * Find or create a company by name
   * @param {string} companyName - Company name
   * @param {Object} companyData - Additional company data
   * @returns {Promise<number>} Company ID
   */
  async findOrCreateCompany(companyName, companyData = {}) {
    // First try to find existing company
    const existing = await this.db.get(
      'SELECT id FROM companies WHERE name = ?',
      [companyName]
    );

    if (existing) {
      return existing.id;
    }

    // Create new company
    const result = await this.db.run(
      'INSERT INTO companies (name, website, data) VALUES (?, ?, ?)',
      [
        companyName,
        companyData.website || null,
        JSON.stringify(companyData)
      ]
    );

    return result.id;
  }

  /**
   * Save research result
   * @param {string} companyName - Company name
   * @param {string} criterionName - Criterion name
   * @param {Object} result - Research result object
   * @returns {Promise<number>} Research result ID
   */
  async saveResearchResult(companyName, criterionName, result, companyData = {}) {
    const companyId = await this.findOrCreateCompany(companyName, companyData);

    const insertResult = await this.db.run(`
      INSERT OR REPLACE INTO research_results 
      (company_id, criterion_name, answer, explanation, result_type, iterations, tool_calls, tokens_used, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      companyId,
      criterionName,
      result.answer || '',
      result.explanation || '',
      result.type || 'unknown',
      result.iterations || 0,
      result.toolCalls || 0,
      result.usage?.output_tokens || 0
    ]);

    return insertResult.id;
  }

  /**
   * Check if research result exists
   * @param {string} companyName - Company name
   * @param {string} criterionName - Criterion name
   * @returns {Promise<boolean>} True if result exists
   */
  async hasResearchResult(companyName, criterionName) {
    const result = await this.db.get(`
      SELECT rr.id 
      FROM research_results rr
      JOIN companies c ON rr.company_id = c.id
      WHERE c.name = ? AND rr.criterion_name = ?
    `, [companyName, criterionName]);

    return !!result;
  }

  /**
   * Get research result
   * @param {string} companyName - Company name
   * @param {string} criterionName - Criterion name
   * @returns {Promise<Object|null>} Research result or null
   */
  async getResearchResult(companyName, criterionName) {
    const result = await this.db.get(`
      SELECT rr.* 
      FROM research_results rr
      JOIN companies c ON rr.company_id = c.id
      WHERE c.name = ? AND rr.criterion_name = ?
    `, [companyName, criterionName]);

    if (!result) return null;

    return {
      criterion: result.criterion_name,
      answer: result.answer,
      explanation: result.explanation,
      type: result.result_type,
      iterations: result.iterations,
      toolCalls: result.tool_calls,
      usage: { output_tokens: result.tokens_used },
      timestamp: result.created_at
    };
  }

  /**
   * Get all research results for a company
   * @param {string} companyName - Company name
   * @returns {Promise<Array>} Array of research results
   */
  async getCompanyResults(companyName) {
    const results = await this.db.all(`
      SELECT rr.* 
      FROM research_results rr
      JOIN companies c ON rr.company_id = c.id
      WHERE c.name = ?
      ORDER BY rr.created_at
    `, [companyName]);

    return results.map(result => ({
      criterion: result.criterion_name,
      answer: result.answer,
      explanation: result.explanation,
      type: result.result_type,
      iterations: result.iterations,
      toolCalls: result.tool_calls,
      usage: { output_tokens: result.tokens_used },
      timestamp: result.created_at
    }));
  }

  /**
   * Get all companies with research data
   * @returns {Promise<Array>} Array of companies with their research
   */
  async getAllCompaniesWithResults() {
    const companies = await this.db.all(`
      SELECT DISTINCT c.name, c.website, c.data
      FROM companies c
      JOIN research_results rr ON c.id = rr.company_id
      ORDER BY c.name
    `);

    const companiesWithResults = [];
    
    for (const company of companies) {
      const results = await this.getCompanyResults(company.name);
      
      // Parse company data
      let companyData = {};
      try {
        companyData = JSON.parse(company.data || '{}');
      } catch (e) {
        console.warn(`Error parsing company data for ${company.name}`);
      }
      
      companiesWithResults.push({
        name: company.name,
        website: company.website,
        ...companyData,
        research: results.reduce((acc, result) => {
          acc[result.criterion] = result;
          return acc;
        }, {})
      });
    }
    
    return companiesWithResults;
  }
}

module.exports = ResearchDAO;