class ResearchDAO {
  constructor(database) {
    this.db = database;
  }

  /**
   * Get active template with criteria
   * @returns {Promise<Object>} Template with criteria array
   */
  async getActiveTemplate() {
    const template = await this.db.get(`
      SELECT * FROM templates WHERE is_active = 1 LIMIT 1
    `);

    if (!template) {
      throw new Error('No active template found');
    }

    const criteria = await this.db.all(`
      SELECT * FROM criteria 
      WHERE template_id = ? 
      ORDER BY order_index
    `, [template.id]);

    return {
      id: template.id,
      name: template.name,
      systemPrompt: template.system_prompt,
      criteria: criteria.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        firstQueryTemplate: c.first_query_template,
        answerFormat: c.answer_format,
        disqualifying: !!c.disqualifying
      }))
    };
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
   * @param {number} criterionId - Criterion ID
   * @param {Object} result - Research result object
   * @returns {Promise<number>} Research result ID
   */
  async saveResearchResult(companyName, criterionId, result, companyData = {}) {
    const companyId = await this.findOrCreateCompany(companyName, companyData);
    
    // Get template ID from criterion
    const criterion = await this.db.get('SELECT template_id FROM criteria WHERE id = ?', [criterionId]);
    if (!criterion) {
      throw new Error(`Criterion not found: ${criterionId}`);
    }

    const insertResult = await this.db.run(`
      INSERT OR REPLACE INTO research_results 
      (template_id, company_id, criterion_id, answer, explanation, result_type, iterations, tool_calls, tokens_used, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      criterion.template_id,
      companyId,
      criterionId,
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
   * @param {number} criterionId - Criterion ID
   * @returns {Promise<boolean>} True if result exists
   */
  async hasResearchResult(companyName, criterionId) {
    const result = await this.db.get(`
      SELECT rr.id 
      FROM research_results rr
      JOIN companies c ON rr.company_id = c.id
      WHERE c.name = ? AND rr.criterion_id = ?
    `, [companyName, criterionId]);

    return !!result;
  }

  /**
   * Get research result
   * @param {string} companyName - Company name
   * @param {number} criterionId - Criterion ID
   * @returns {Promise<Object|null>} Research result or null
   */
  async getResearchResult(companyName, criterionId) {
    const result = await this.db.get(`
      SELECT rr.*, cr.name as criterion_name
      FROM research_results rr
      JOIN companies c ON rr.company_id = c.id
      JOIN criteria cr ON rr.criterion_id = cr.id
      WHERE c.name = ? AND rr.criterion_id = ?
    `, [companyName, criterionId]);

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
      SELECT rr.*, cr.name as criterion_name
      FROM research_results rr
      JOIN companies c ON rr.company_id = c.id
      JOIN criteria cr ON rr.criterion_id = cr.id
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

  /**
   * Clear all research results from the database
   * @returns {Promise<Object>} Summary of deleted records
   */
  async clearAllResults() {
    try {
      // Count results before deletion
      const resultCount = await this.db.get('SELECT COUNT(*) as count FROM research_results');
      const companyCount = await this.db.get('SELECT COUNT(*) as count FROM companies');

      // Delete all research results (companies will be deleted by CASCADE)
      await this.db.run('DELETE FROM research_results');
      
      // Note: companies are deleted automatically due to CASCADE foreign key
      // But we can also explicitly delete them to be sure
      await this.db.run('DELETE FROM companies');

      return {
        deletedResults: resultCount.count,
        deletedCompanies: companyCount.count,
        success: true
      };
    } catch (error) {
      console.error('Error clearing research results:', error);
      throw error;
    }
  }
}

module.exports = ResearchDAO;