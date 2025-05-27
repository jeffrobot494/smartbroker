const axios = require('axios');

class ClaudeClient {
  constructor(serverURL = 'http://localhost:3000') {
    this.serverURL = serverURL;
  }

  async sendMessage(messages, systemPrompt = '', model = 'claude-sonnet-4-20250514', maxTokens = 4000) {
    try {
      const response = await axios.post(
        `${this.serverURL}/api/claude`,
        {
          messages,
          systemPrompt,
          model,
          maxTokens
        }
      );

      return response.data;
    } catch (error) {
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

  async saveResult(companyName, criterionName, result, companyData = {}) {
    try {
      const response = await axios.post(
        `${this.serverURL}/api/research`,
        {
          companyName,
          criterionName,
          result,
          companyData
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
          }
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
          }
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

  async getCompanyResults(companyName) {
    try {
      const response = await axios.get(
        `${this.serverURL}/api/research/company/${encodeURIComponent(companyName)}`
      );

      return response.data.results;
    } catch (error) {
      console.error('Company results API Error:', error.response?.data || error.message);
      throw new Error(`Company results failed: ${error.response?.data?.details || error.message}`);
    }
  }

  async clearAllResults() {
    try {
      const response = await axios.delete(
        `${this.serverURL}/api/research/clear`
      );

      return response.data;
    } catch (error) {
      console.error('Clear results API Error:', error.response?.data || error.message);
      throw new Error(`Clear results failed: ${error.response?.data?.details || error.message}`);
    }
  }
}

module.exports = {
  ClaudeClient,
  PerplexityClient,
  ResearchClient
};