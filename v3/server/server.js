const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const Database = require('./database');
const ResearchDAO = require('./dao/research-dao');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
const database = new Database();
const researchDAO = new ResearchDAO(database);

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

// Template API endpoints

// Get active template with criteria
app.get('/api/template/active', async (req, res) => {
  try {
    const template = await researchDAO.getActiveTemplate();
    res.json(template);
  } catch (error) {
    console.error('Error getting active template:', error);
    res.status(500).json({
      error: 'Failed to get active template',
      details: error.message
    });
  }
});

// Research Results API endpoints

// Save research result
app.post('/api/research', async (req, res) => {
  try {
    const { companyName, criterionId, result, companyData } = req.body;

    if (!companyName || !criterionId || !result) {
      return res.status(400).json({ 
        error: 'Missing required fields: companyName, criterionId, result' 
      });
    }

    const resultId = await researchDAO.saveResearchResult(
      companyName, 
      criterionId, 
      result, 
      companyData || {}
    );

    res.json({ 
      success: true, 
      id: resultId,
      message: 'Research result saved successfully' 
    });

  } catch (error) {
    console.error('Error saving research result:', error);
    res.status(500).json({ 
      error: 'Failed to save research result',
      details: error.message 
    });
  }
});

// Check if research result exists
app.get('/api/research/check', async (req, res) => {
  try {
    const { companyName, criterionName } = req.query;

    if (!companyName || !criterionName) {
      return res.status(400).json({ 
        error: 'Missing required query parameters: companyName, criterionName' 
      });
    }

    const exists = await researchDAO.hasResearchResult(companyName, criterionName);

    res.json({ exists });

  } catch (error) {
    console.error('Error checking research result:', error);
    res.status(500).json({ 
      error: 'Failed to check research result',
      details: error.message 
    });
  }
});

// Get all research results for a company
app.get('/api/research/company/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { templateId } = req.query;
    
    const results = await researchDAO.getCompanyResults(name, templateId ? parseInt(templateId) : null);

    res.json({ 
      companyName: name,
      results 
    });

  } catch (error) {
    console.error('Error getting company results:', error);
    res.status(500).json({ 
      error: 'Failed to get company results',
      details: error.message 
    });
  }
});

// Get specific research result
app.get('/api/research', async (req, res) => {
  try {
    const { companyName, criterionName } = req.query;

    if (!companyName || !criterionName) {
      return res.status(400).json({ 
        error: 'Missing required query parameters: companyName, criterionName' 
      });
    }

    const result = await researchDAO.getResearchResult(companyName, criterionName);

    if (!result) {
      return res.status(404).json({ 
        error: 'Research result not found' 
      });
    }

    res.json(result);

  } catch (error) {
    console.error('Error getting research result:', error);
    res.status(500).json({ 
      error: 'Failed to get research result',
      details: error.message 
    });
  }
});

// Clear all research results
app.delete('/api/research/clear', async (req, res) => {
  try {
    const summary = await researchDAO.clearAllResults();

    res.json({
      message: 'Research data cleared successfully',
      ...summary
    });

  } catch (error) {
    console.error('Error clearing research data:', error);
    res.status(500).json({
      error: 'Failed to clear research data',
      details: error.message
    });
  }
});

// Template Management Endpoints

// Get all templates
app.get('/api/templates', async (req, res) => {
  try {
    const templates = await researchDAO.getTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new template
app.post('/api/templates', async (req, res) => {
  try {
    const { name, basedOnTemplateId, makeActive } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, error: 'Template name is required' });
    }

    const template = await researchDAO.createTemplate(name.trim(), basedOnTemplateId, makeActive);
    res.json({ success: true, template });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Activate template
app.put('/api/templates/:id/activate', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const result = await researchDAO.setActiveTemplate(templateId);
    res.json(result);
  } catch (error) {
    console.error('Error activating template:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete template
app.delete('/api/templates/:id', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const result = await researchDAO.deleteTemplate(templateId);
    res.json(result);
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// System Prompt Endpoints

// Get template system prompt
app.get('/api/template/:id/prompt', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const systemPrompt = await researchDAO.getTemplatePrompt(templateId);
    res.json({ systemPrompt });
  } catch (error) {
    console.error('Error getting system prompt:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update template system prompt
app.put('/api/template/:id/prompt', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const { systemPrompt } = req.body;
    
    if (!systemPrompt || systemPrompt.trim() === '') {
      return res.status(400).json({ success: false, error: 'System prompt is required' });
    }

    const result = await researchDAO.updateTemplatePrompt(templateId, systemPrompt);
    res.json(result);
  } catch (error) {
    console.error('Error updating system prompt:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Criteria Management Endpoints

// Create new criterion
app.post('/api/templates/:id/criteria', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const criterionData = req.body;
    
    if (!criterionData.name || !criterionData.description || !criterionData.answer_format) {
      return res.status(400).json({ success: false, error: 'Name, description, and answer_format are required' });
    }

    const criterion = await researchDAO.createCriterion(templateId, criterionData);
    res.json({ success: true, criterion });
  } catch (error) {
    console.error('Error creating criterion:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update criterion
app.put('/api/criteria/:id', async (req, res) => {
  try {
    const criterionId = parseInt(req.params.id);
    const updates = req.body;

    const result = await researchDAO.updateCriterion(criterionId, updates);
    res.json(result);
  } catch (error) {
    console.error('Error updating criterion:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete criterion
app.delete('/api/criteria/:id', async (req, res) => {
  try {
    const criterionId = parseInt(req.params.id);
    const result = await researchDAO.deleteCriterion(criterionId);
    res.json(result);
  } catch (error) {
    console.error('Error deleting criterion:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Reorder criterion
app.put('/api/criteria/:id/reorder', async (req, res) => {
  try {
    const criterionId = parseInt(req.params.id);
    const { newOrderIndex } = req.body;
    
    if (newOrderIndex === undefined || newOrderIndex === null) {
      return res.status(400).json({ success: false, error: 'newOrderIndex is required' });
    }

    const result = await researchDAO.reorderCriterion(criterionId, parseInt(newOrderIndex));
    res.json(result);
  } catch (error) {
    console.error('Error reordering criterion:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get next available order index
app.get('/api/templates/:id/next-order', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const nextOrder = await researchDAO.getNextAvailableOrderIndex(templateId);
    res.json({ nextOrderIndex: nextOrder });
  } catch (error) {
    console.error('Error getting next order index:', error);
    res.status(400).json({ success: false, error: error.message });
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

// Initialize database and start server
async function startServer() {
  try {
    await database.initialize();
    
    app.listen(PORT, () => {
      console.log(`🚀 SmartBroker API Server running on port ${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/health`);
      console.log(`💾 Database initialized successfully`);
      
      // Check API keys
      if (!process.env.ANTHROPIC_API_KEY) {
        console.warn('⚠️  ANTHROPIC_API_KEY not found in environment');
      }
      if (!process.env.PERPLEXITY_API_KEY) {
        console.warn('⚠️  PERPLEXITY_API_KEY not found in environment');
      }
    });
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  await database.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down server...');
  await database.close();
  process.exit(0);
});

startServer();