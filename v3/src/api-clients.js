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

module.exports = {
  ClaudeClient,
  PerplexityClient
};