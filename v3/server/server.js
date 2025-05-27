const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Claude API endpoint
app.post('/api/claude', async (req, res) => {
  try {
    const { messages, systemPrompt, model = 'claude-sonnet-4-20250514', maxTokens = 4000 } = req.body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    res.json({
      content: response.data.content[0].text,
      usage: response.data.usage
    });

  } catch (error) {
    console.error('Claude API Error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Claude API request failed',
      details: error.response?.data?.error?.message || error.message
    });
  }
});

// Perplexity API endpoint
app.post('/api/perplexity', async (req, res) => {
  try {
    const { query, model = 'sonar-pro' } = req.body;

    if (!process.env.PERPLEXITY_API_KEY) {
      return res.status(500).json({ error: 'PERPLEXITY_API_KEY not configured' });
    }

    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
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
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
        }
      }
    );

    res.json({
      content: response.data.choices[0].message.content,
      usage: response.data.usage,
      citations: response.data.citations || []
    });

  } catch (error) {
    console.error('Perplexity API Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Perplexity API request failed',
      details: error.response?.data?.error?.message || error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasPerplexityKey: !!process.env.PERPLEXITY_API_KEY
  });
});

app.listen(PORT, () => {
  console.log(`🚀 SmartBroker API Server running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  
  // Check API keys
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY not found in environment');
  }
  if (!process.env.PERPLEXITY_API_KEY) {
    console.warn('⚠️  PERPLEXITY_API_KEY not found in environment');
  }
});