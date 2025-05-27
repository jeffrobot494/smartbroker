const axios = require('axios');
require('dotenv').config();

class ClaudeClient {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.baseURL = 'https://api.anthropic.com/v1';
    
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
  }

  async sendMessage(messages, systemPrompt = '', model = 'claude-sonnet-4-20250514', maxTokens = 4000) {
    try {
      const response = await axios.post(
        `${this.baseURL}/messages`,
        {
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          }
        }
      );

      return {
        content: response.data.content[0].text,
        usage: response.data.usage
      };
    } catch (error) {
      console.error('Claude API Error:', error.response?.data || error.message);
      throw new Error(`Claude API request failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

class PerplexityClient {
  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY;
    this.baseURL = 'https://api.perplexity.ai';
    
    if (!this.apiKey) {
      throw new Error('PERPLEXITY_API_KEY environment variable is required');
    }
  }

  async search(query, model = 'sonar-pro') {
    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful research assistant. Provide accurate, detailed information based on current web sources.'
            },
            {
              role: 'user', 
              content: query
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return {
        content: response.data.choices[0].message.content,
        usage: response.data.usage,
        citations: response.data.citations || []
      };
    } catch (error) {
      console.error('Perplexity API Error:', error.response?.data || error.message);
      throw new Error(`Perplexity API request failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

module.exports = {
  ClaudeClient,
  PerplexityClient
};