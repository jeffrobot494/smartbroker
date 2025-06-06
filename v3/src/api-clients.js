const axios = require('axios');

// Helper function to get internal request headers
function getInternalHeaders() {
  return {
    'X-Internal-Request': process.env.INTERNAL_API_SECRET || 'dev-internal-key'
  };
}

class ClaudeClient {
  constructor(serverURL = 'http://localhost:3000') {
    this.serverURL = serverURL;
  }

  async sendMessage(messages, systemPrompt = '', model = 'claude-sonnet-4-20250514', maxTokens = 4000) {
    try {
      console.log(`[DEBUG] ClaudeClient making request to ${this.serverURL}/api/claude`);
      console.log(`[DEBUG] Request payload size: ${JSON.stringify({messages, systemPrompt, model, maxTokens}).length} chars`);
      
      const response = await axios.post(
        `${this.serverURL}/api/claude`,
        {
          messages,
          systemPrompt,
          model,
          maxTokens
        },
        {
          headers: getInternalHeaders()
        }
      );

      console.log(`[DEBUG] ClaudeClient received response: ${response.status} ${response.statusText}`);
      return response.data;
    } catch (error) {
      console.error(`[DEBUG] ClaudeClient error type: ${error.code || 'unknown'}`);
      console.error(`[DEBUG] ClaudeClient error message: ${error.message}`);
      console.error('Claude API Error:', error.response?.data || error.message);
      throw new Error(`Claude API request failed: ${error.response?.data?.details || error.message}`);
    }
  }
}

class PerplexityClient {
  constructor(serverURL = 'http://localhost:3000') {
    this.serverURL = serverURL;
  }

  async search(query, model = 'sonar-pro') {
    try {
      const response = await axios.post(
        `${this.serverURL}/api/perplexity`,
        {
          query,
          model
        },
        {
          headers: getInternalHeaders()
        }
      );

      return response.data;
    } catch (error) {
      console.error('Perplexity API Error:', error.response?.data || error.message);
      throw new Error(`Perplexity API request failed: ${error.response?.data?.details || error.message}`);
    }
  }
}

class ResearchClient {
  constructor(serverURL = 'http://localhost:3000') {
    this.serverURL = serverURL;
  }

  async saveResult(companyName, criterionId, result, companyData = {}, costs = {}) {
    try {
      const response = await axios.post(
        `${this.serverURL}/api/research`,
        {
          companyName,
          criterionId,
          result,
          companyData,
          costs
        },
        {
          headers: getInternalHeaders()
        }
      );

      return response.data;
    } catch (error) {
      console.error('Research API Error:', error.response?.data || error.message);
      throw new Error(`Research save failed: ${error.response?.data?.details || error.message}`);
    }
  }

  async checkExists(companyName, criterionName) {
    try {
      const response = await axios.get(
        `${this.serverURL}/api/research/check`,
        {
          params: {
            companyName,
            criterionName
          },
          headers: getInternalHeaders()
        }
      );

      return response.data.exists;
    } catch (error) {
      console.error('Research check API Error:', error.response?.data || error.message);
      throw new Error(`Research check failed: ${error.response?.data?.details || error.message}`);
    }
  }

  async getResult(companyName, criterionName) {
    try {
      const response = await axios.get(
        `${this.serverURL}/api/research`,
        {
          params: {
            companyName,
            criterionName
          },
          headers: getInternalHeaders()
        }
      );

      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error('Research get API Error:', error.response?.data || error.message);
      throw new Error(`Research get failed: ${error.response?.data?.details || error.message}`);
    }
  }

  async getCompanyResults(companyName, templateId = null) {
    try {
      let url = `${this.serverURL}/api/research/company/${encodeURIComponent(companyName)}`;
      if (templateId) {
        url += `?templateId=${templateId}`;
      }
      
      const response = await axios.get(url, {
        headers: getInternalHeaders()
      });

      return response.data.results;
    } catch (error) {
      console.error('Company results API Error:', error.response?.data || error.message);
      throw new Error(`Company results failed: ${error.response?.data?.details || error.message}`);
    }
  }

  async clearAllResults() {
    try {
      const response = await axios.delete(
        `${this.serverURL}/api/research/clear`,
        {
          headers: getInternalHeaders()
        }
      );

      return response.data;
    } catch (error) {
      console.error('Clear results API Error:', error.response?.data || error.message);
      throw new Error(`Clear results failed: ${error.response?.data?.details || error.message}`);
    }
  }

  async getCostSummary(templateId = null) {
    try {
      let url = `${this.serverURL}/api/research/costs`;
      if (templateId) {
        url += `?templateId=${templateId}`;
      }
      
      const response = await axios.get(url, {
        headers: getInternalHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Cost summary API Error:', error.response?.data || error.message);
      throw new Error(`Cost summary failed: ${error.response?.data?.details || error.message}`);
    }
  }
}

class PhantomBusterClient {
  constructor(serverURL = 'http://localhost:3000') {
    this.serverURL = serverURL;
  }

  async scrapeLinkedIn(linkedinUrl) {
    try {
      const response = await axios.post(
        `${this.serverURL}/api/phantombuster`,
        { url: linkedinUrl },
        { 
          timeout: 300000, // 5 minute timeout
          headers: getInternalHeaders()
        }
      );
      return response.data;
    } catch (error) {
      console.error('PhantomBuster API Error:', error.response?.data || error.message);
      throw new Error(`PhantomBuster LinkedIn scrape failed: ${error.response?.data?.details || error.message}`);
    }
  }
}

class TemplateClient {
  constructor(serverURL = 'http://localhost:3000') {
    this.serverURL = serverURL;
  }

  async getActiveTemplate() {
    try {
      console.log(`[DEBUG] TemplateClient attempting to fetch from: ${this.serverURL}/api/template/active`);
      console.log(`[DEBUG] Request timestamp: ${new Date().toISOString()}`);
      
      const response = await axios.get(
        `${this.serverURL}/api/template/active`,
        {
          headers: getInternalHeaders()
        }
      );

      console.log(`[DEBUG] TemplateClient received response:`, {
        status: response.status,
        dataLength: JSON.stringify(response.data).length,
        hasData: !!response.data
      });
      
      return response.data;
    } catch (error) {
      console.error(`[DEBUG] TemplateClient error details:`, {
        message: error.message,
        code: error.code,
        response: {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        },
        config: {
          url: error.config?.url,
          method: error.config?.method,
          timeout: error.config?.timeout
        }
      });
      console.error('Template API Error:', error.response?.data || error.message);
      throw new Error(`Template fetch failed: ${error.response?.data?.details || error.message}`);
    }
  }

  async getTemplates() {
    try {
      const response = await axios.get(`${this.serverURL}/api/templates`, {
        headers: getInternalHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Templates API Error:', error.response?.data || error.message);
      throw new Error(`Templates fetch failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async createTemplate(name, basedOnTemplateId = null, makeActive = false) {
    try {
      const response = await axios.post(`${this.serverURL}/api/templates`, {
        name,
        basedOnTemplateId,
        makeActive
      }, {
        headers: getInternalHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Create Template API Error:', error.response?.data || error.message);
      throw new Error(`Template creation failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async setActiveTemplate(templateId) {
    try {
      const response = await axios.put(`${this.serverURL}/api/templates/${templateId}/activate`, null, {
        headers: getInternalHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Activate Template API Error:', error.response?.data || error.message);
      throw new Error(`Template activation failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async deleteTemplate(templateId) {
    try {
      const response = await axios.delete(`${this.serverURL}/api/templates/${templateId}`, {
        headers: getInternalHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Delete Template API Error:', error.response?.data || error.message);
      throw new Error(`Template deletion failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async getSystemPrompt(templateId) {
    try {
      const response = await axios.get(`${this.serverURL}/api/template/${templateId}/prompt`, {
        headers: getInternalHeaders()
      });
      return response.data.systemPrompt;
    } catch (error) {
      console.error('Get System Prompt API Error:', error.response?.data || error.message);
      throw new Error(`System prompt fetch failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async updateSystemPrompt(templateId, systemPrompt) {
    try {
      const response = await axios.put(`${this.serverURL}/api/template/${templateId}/prompt`, {
        systemPrompt
      }, {
        headers: getInternalHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Update System Prompt API Error:', error.response?.data || error.message);
      throw new Error(`System prompt update failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async createCriterion(templateId, criterionData) {
    try {
      const response = await axios.post(`${this.serverURL}/api/templates/${templateId}/criteria`, criterionData, {
        headers: getInternalHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Create Criterion API Error:', error.response?.data || error.message);
      throw new Error(`Criterion creation failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async updateCriterion(criterionId, updates) {
    try {
      const response = await axios.put(`${this.serverURL}/api/criteria/${criterionId}`, updates, {
        headers: getInternalHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Update Criterion API Error:', error.response?.data || error.message);
      throw new Error(`Criterion update failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async deleteCriterion(criterionId) {
    try {
      const response = await axios.delete(`${this.serverURL}/api/criteria/${criterionId}`, {
        headers: getInternalHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Delete Criterion API Error:', error.response?.data || error.message);
      throw new Error(`Criterion deletion failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async reorderCriterion(criterionId, newOrderIndex) {
    try {
      const response = await axios.put(`${this.serverURL}/api/criteria/${criterionId}/reorder`, {
        newOrderIndex
      }, {
        headers: getInternalHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Reorder Criterion API Error:', error.response?.data || error.message);
      throw new Error(`Criterion reorder failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async getNextOrderIndex(templateId) {
    try {
      const response = await axios.get(`${this.serverURL}/api/templates/${templateId}/next-order`, {
        headers: getInternalHeaders()
      });
      return response.data.nextOrderIndex;
    } catch (error) {
      console.error('Get Next Order API Error:', error.response?.data || error.message);
      throw new Error(`Next order fetch failed: ${error.response?.data?.error || error.message}`);
    }
  }
}

module.exports = {
  ClaudeClient,
  PerplexityClient,
  ResearchClient,
  TemplateClient,
  PhantomBusterClient
};