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
        disqualifying: !!c.disqualifying,
        order_index: c.order_index
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
      (template_id, company_id, criterion_id, answer, explanation, confidence_score, result_type, iterations, tool_calls, tokens_used, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      criterion.template_id,
      companyId,
      criterionId,
      result.answer || '',
      result.explanation || '',
      result.confidence_score || null,
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
      confidence_score: result.confidence_score,
      type: result.result_type,
      iterations: result.iterations,
      toolCalls: result.tool_calls,
      usage: { output_tokens: result.tokens_used },
      timestamp: result.created_at
    };
  }

  /**
   * Get all research results for a company (optionally filtered by template)
   * @param {string} companyName - Company name
   * @param {number|null} templateId - Optional template ID to filter by
   * @returns {Promise<Array>} Array of research results
   */
  async getCompanyResults(companyName, templateId = null) {
    let query = `
      SELECT rr.*, cr.name as criterion_name
      FROM research_results rr
      JOIN companies c ON rr.company_id = c.id
      JOIN criteria cr ON rr.criterion_id = cr.id
      WHERE c.name = ?
    `;
    let params = [companyName];

    if (templateId) {
      query += ` AND rr.template_id = ?`;
      params.push(templateId);
    }

    query += ` ORDER BY rr.created_at`;

    const results = await this.db.all(query, params);

    return results.map(result => ({
      criterion: result.criterion_name,
      answer: result.answer,
      explanation: result.explanation,
      confidence_score: result.confidence_score,
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

  /**
   * Get all templates
   * @returns {Promise<Array>} Array of templates
   */
  async getTemplates() {
    return await this.db.all('SELECT * FROM templates ORDER BY created_at DESC');
  }

  /**
   * Create new template (with optional copying)
   * @param {string} name - Template name
   * @param {number|null} basedOnTemplateId - Template to copy from
   * @param {boolean} makeActive - Whether to make this template active
   * @returns {Promise<Object>} Created template
   */
  async createTemplate(name, basedOnTemplateId = null, makeActive = false) {
    // Validation
    const existing = await this.db.get('SELECT id FROM templates WHERE name = ?', [name]);
    if (existing) {
      throw new Error('Template name already exists');
    }

    // Create template
    const templateResult = await this.db.run(
      'INSERT INTO templates (name, system_prompt, is_active) VALUES (?, ?, ?)',
      [name, '', makeActive ? 1 : 0]
    );
    const newTemplateId = templateResult.id;

    // Copy criteria if basedOnTemplateId provided
    if (basedOnTemplateId) {
      const baseTemplate = await this.db.get('SELECT system_prompt FROM templates WHERE id = ?', [basedOnTemplateId]);
      if (baseTemplate) {
        // Copy system prompt
        await this.db.run('UPDATE templates SET system_prompt = ? WHERE id = ?', [baseTemplate.system_prompt, newTemplateId]);
        
        // Copy criteria
        const baseCriteria = await this.db.all('SELECT * FROM criteria WHERE template_id = ? ORDER BY order_index', [basedOnTemplateId]);
        for (const criterion of baseCriteria) {
          await this.db.run(`
            INSERT INTO criteria (template_id, name, description, first_query_template, answer_format, disqualifying, order_index)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [newTemplateId, criterion.name, criterion.description, criterion.first_query_template, criterion.answer_format, criterion.disqualifying, criterion.order_index]);
        }
      }
    }

    // Handle activation
    if (makeActive) {
      await this.db.run('UPDATE templates SET is_active = 0 WHERE id != ?', [newTemplateId]);
    }

    // Get the final template data to return
    const finalTemplate = await this.db.get('SELECT * FROM templates WHERE id = ?', [newTemplateId]);
    return finalTemplate;
  }

  /**
   * Set active template
   * @param {number} templateId - Template ID to activate
   * @returns {Promise<Object>} Success result
   */
  async setActiveTemplate(templateId) {
    const template = await this.db.get('SELECT id FROM templates WHERE id = ?', [templateId]);
    if (!template) {
      throw new Error('Template not found');
    }

    // Deactivate all, activate target
    await this.db.run('UPDATE templates SET is_active = 0');
    await this.db.run('UPDATE templates SET is_active = 1 WHERE id = ?', [templateId]);
    
    return { success: true };
  }

  /**
   * Delete template
   * @param {number} templateId - Template ID to delete
   * @returns {Promise<Object>} Deletion result
   */
  async deleteTemplate(templateId) {
    // Check template exists
    const template = await this.db.get('SELECT * FROM templates WHERE id = ?', [templateId]);
    if (!template) {
      throw new Error('Template not found');
    }

    // Check not last template (check this first, it's more specific)
    const templateCount = await this.db.get('SELECT COUNT(*) as count FROM templates');
    if (templateCount.count <= 1) {
      throw new Error('Cannot delete the last template');
    }

    // Check not active
    if (template.is_active) {
      throw new Error('Cannot delete active template. Switch to another template first.');
    }

    // Delete (CASCADE will handle criteria and research results)
    await this.db.run('DELETE FROM templates WHERE id = ?', [templateId]);
    
    return { success: true, remainingCount: templateCount.count - 1 };
  }

  /**
   * Get template system prompt
   * @param {number} templateId - Template ID
   * @returns {Promise<string>} System prompt
   */
  async getTemplatePrompt(templateId) {
    const template = await this.db.get('SELECT system_prompt FROM templates WHERE id = ?', [templateId]);
    if (!template) {
      throw new Error('Template not found');
    }
    return template.system_prompt;
  }

  /**
   * Update template system prompt
   * @param {number} templateId - Template ID
   * @param {string} newPrompt - New system prompt
   * @returns {Promise<Object>} Success result
   */
  async updateTemplatePrompt(templateId, newPrompt) {
    // Validation
    if (!newPrompt || newPrompt.trim().length === 0) {
      throw new Error('System prompt cannot be empty');
    }

    const template = await this.db.get('SELECT id FROM templates WHERE id = ?', [templateId]);
    if (!template) {
      throw new Error('Template not found');
    }

    await this.db.run('UPDATE templates SET system_prompt = ? WHERE id = ?', [newPrompt.trim(), templateId]);
    return { success: true };
  }

  /**
   * Create new criterion
   * @param {number} templateId - Template ID
   * @param {Object} criterionData - Criterion data
   * @returns {Promise<Object>} Created criterion
   */
  async createCriterion(templateId, criterionData) {
    const { name, description, first_query_template, answer_format, disqualifying, order_index } = criterionData;

    // Validation
    if (!name || !description || !answer_format) {
      throw new Error('Name, description, and answer_format are required');
    }

    const template = await this.db.get('SELECT id FROM templates WHERE id = ?', [templateId]);
    if (!template) {
      throw new Error('Template not found');
    }

    // Check for duplicate order_index
    if (order_index) {
      const existing = await this.db.get('SELECT id FROM criteria WHERE template_id = ? AND order_index = ?', [templateId, order_index]);
      if (existing) {
        throw new Error(`Order index ${order_index} already exists. Use a different order index.`);
      }
    }

    const result = await this.db.run(`
      INSERT INTO criteria (template_id, name, description, first_query_template, answer_format, disqualifying, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [templateId, name.trim(), description.trim(), first_query_template || null, answer_format.trim(), disqualifying ? 1 : 0, order_index]);

    // Auto-normalize order indexes after creation
    await this.normalizeOrderIndexes(templateId);

    return await this.db.get('SELECT * FROM criteria WHERE id = ?', [result.id]);
  }

  /**
   * Update criterion
   * @param {number} criterionId - Criterion ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Success result
   */
  async updateCriterion(criterionId, updates) {
    const criterion = await this.db.get('SELECT * FROM criteria WHERE id = ?', [criterionId]);
    if (!criterion) {
      throw new Error('Criterion not found');
    }

    const { name, description, first_query_template, answer_format, disqualifying, order_index } = updates;

    // Validation
    if (name !== undefined && !name.trim()) {
      throw new Error('Name cannot be empty');
    }
    if (description !== undefined && !description.trim()) {
      throw new Error('Description cannot be empty');
    }
    if (answer_format !== undefined && !answer_format.trim()) {
      throw new Error('Answer format cannot be empty');
    }

    // Check for duplicate order_index if changing
    if (order_index !== undefined && order_index !== criterion.order_index) {
      const existing = await this.db.get('SELECT id FROM criteria WHERE template_id = ? AND order_index = ?', [criterion.template_id, order_index]);
      if (existing) {
        throw new Error(`Order index ${order_index} already exists. Use a different order index.`);
      }
    }

    const fields = [];
    const values = [];

    if (name !== undefined) { fields.push('name = ?'); values.push(name.trim()); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description.trim()); }
    if (first_query_template !== undefined) { fields.push('first_query_template = ?'); values.push(first_query_template || null); }
    if (answer_format !== undefined) { fields.push('answer_format = ?'); values.push(answer_format.trim()); }
    if (disqualifying !== undefined) { fields.push('disqualifying = ?'); values.push(disqualifying ? 1 : 0); }
    if (order_index !== undefined) { fields.push('order_index = ?'); values.push(order_index); }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(criterionId);
    await this.db.run(`UPDATE criteria SET ${fields.join(', ')} WHERE id = ?`, values);
    
    // Auto-normalize order indexes only if order_index was changed
    if (order_index !== undefined) {
      await this.normalizeOrderIndexes(criterion.template_id);
    }
    
    return { success: true };
  }

  /**
   * Delete criterion
   * @param {number} criterionId - Criterion ID
   * @returns {Promise<Object>} Success result
   */
  async deleteCriterion(criterionId) {
    const criterion = await this.db.get('SELECT * FROM criteria WHERE id = ?', [criterionId]);
    if (!criterion) {
      throw new Error('Criterion not found');
    }

    // Delete (CASCADE will handle research results)
    await this.db.run('DELETE FROM criteria WHERE id = ?', [criterionId]);
    
    // Auto-normalize order indexes after deletion
    await this.normalizeOrderIndexes(criterion.template_id);
    
    return { success: true, templateId: criterion.template_id };
  }

  /**
   * Reorder criterion
   * @param {number} criterionId - Criterion ID
   * @param {number} newOrderIndex - New order index
   * @returns {Promise<Object>} Success result
   */
  async reorderCriterion(criterionId, newOrderIndex) {
    const criterion = await this.db.get('SELECT * FROM criteria WHERE id = ?', [criterionId]);
    if (!criterion) {
      throw new Error('Criterion not found');
    }

    if (newOrderIndex === criterion.order_index) {
      return { success: true, message: 'Order index unchanged' };
    }

    // Check for duplicate order_index
    const existing = await this.db.get('SELECT id FROM criteria WHERE template_id = ? AND order_index = ?', [criterion.template_id, newOrderIndex]);
    if (existing) {
      throw new Error(`Order index ${newOrderIndex} already exists. Use a different order index.`);
    }

    await this.db.run('UPDATE criteria SET order_index = ? WHERE id = ?', [newOrderIndex, criterionId]);
    
    // Auto-normalize order indexes after reordering
    await this.normalizeOrderIndexes(criterion.template_id);
    
    return { success: true, templateId: criterion.template_id };
  }

  /**
   * Get next available order index for template
   * @param {number} templateId - Template ID
   * @returns {Promise<number>} Next available order index
   */
  async getNextAvailableOrderIndex(templateId) {
    const result = await this.db.get('SELECT MAX(order_index) as max_order FROM criteria WHERE template_id = ?', [templateId]);
    return (result.max_order || 0) + 1;
  }

  /**
   * Normalize order indexes to sequential numbers (1, 2, 3, 4...)
   * @param {number} templateId - Template ID
   * @returns {Promise<Object>} Success result
   */
  async normalizeOrderIndexes(templateId) {
    // Get all criteria for template, ordered by current order_index
    const criteria = await this.db.all(`
      SELECT id FROM criteria 
      WHERE template_id = ? 
      ORDER BY order_index ASC
    `, [templateId]);
    
    // Renumber sequentially (1, 2, 3, 4...)
    for (let i = 0; i < criteria.length; i++) {
      await this.db.run(
        'UPDATE criteria SET order_index = ? WHERE id = ?', 
        [i + 1, criteria[i].id]
      );
    }
    
    return { success: true, normalizedCount: criteria.length };
  }
}

module.exports = ResearchDAO;