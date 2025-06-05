const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
require('dotenv').config();

const Database = require('./database');
const ResearchDAO = require('./dao/research-dao');

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// CSV parsing function (reused from csv-to-json.js)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Helper functions for duplicate detection within CSV
function normalizeCompanyData(company) {
  return {
    name: (company.name || '').trim().toLowerCase(),
    website: normalizeWebsite(company.website || '')
  };
}

function normalizeWebsite(website) {
  if (!website) return '';
  return website.trim().toLowerCase()
    .replace(/^https?:\/\//, '')  // Remove protocol
    .replace(/^www\./, '')        // Remove www
    .replace(/\/$/, '');          // Remove trailing slash
}

function isDuplicate(company1, company2) {
  const norm1 = normalizeCompanyData(company1);
  const norm2 = normalizeCompanyData(company2);
  
  return norm1.name === norm2.name && norm1.website === norm2.website;
}

function parseCSVData(csvString) {
  const lines = csvString.split('\n').filter(line => line.trim());
  if (lines.length === 0) return { companies: [], duplicatesSkipped: 0 };
  
  const headers = parseCSVLine(lines[0]);
  const companies = [];
  const seen = new Set();
  let duplicatesSkipped = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const company = {};
    
    headers.forEach((header, index) => {
      // Only keep company name, website, and company location
      if (header === 'Company') {
        company.name = values[index] || '';
      } else if (header === 'Website') {
        company.website = values[index] || '';
      } else if (header === 'Company City') {
        company.city = values[index] || '';
      } else if (header === 'Company State') {
        company.state = values[index] || '';
      }
    });
    
    // Only add company if it has at least a name
    if (company.name && company.name.trim()) {
      // Check for duplicates within this CSV file
      const normalized = normalizeCompanyData(company);
      const key = `${normalized.name}|${normalized.website}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        companies.push(company);
      } else {
        duplicatesSkipped++;
        console.log(`[SERVER] Skipping duplicate company in CSV: ${company.name} (${company.website})`);
      }
    }
  }
  
  return { companies, duplicatesSkipped };
}

const app = express();
const PORT = process.env.PORT || 3000;

// Global research state
let isResearchStopped = false;
let sseClient = null;

// Initialize database
const database = new Database();
const researchDAO = new ResearchDAO(database);

// Middleware
app.use(cors());
app.use(express.json());

// Debug: Log current working directory and paths
console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);
console.log('Resolved public path:', require('path').resolve(__dirname, '../public'));

// Serve static files from public directory
app.use(express.static('../public'));

// Claude API endpoint
app.post('/api/claude', async (req, res) => {
  try {
    const { messages, systemPrompt, model = 'claude-sonnet-4-20250514', maxTokens = 4000 } = req.body;

    console.log(`[DEBUG] Server received Claude API request - Messages: ${messages.length}, System prompt: ${systemPrompt.length} chars`);
    console.log(`[DEBUG] Total request size: ${JSON.stringify(req.body).length} chars`);

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    console.log(`[DEBUG] Making request to Anthropic API...`);
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

    console.log(`[DEBUG] Anthropic API response received: ${response.status} ${response.statusText}`);
    console.log(`[DEBUG] Response content length: ${response.data.content[0].text.length} chars`);

    res.json({
      content: response.data.content[0].text,
      usage: response.data.usage
    });

  } catch (error) {
    console.error(`[DEBUG] Server-side Claude API error type: ${error.code || 'unknown'}`);
    console.error(`[DEBUG] Server-side Claude API error message: ${error.message}`);
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

// PhantomBuster LinkedIn Scraper Endpoint
app.post('/api/phantombuster', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || !url.includes('linkedin.com')) {
      return res.status(400).json({ error: 'Valid LinkedIn URL required' });
    }

    if (!process.env.PHANTOMBUSTER_API_KEY || !process.env.LINKEDIN_SESSION_COOKIE) {
      return res.status(500).json({ error: 'PhantomBuster credentials not configured' });
    }

    // Launch phantom
    const launchResponse = await axios.post(
      `https://api.phantombuster.com/api/v1/agent/${process.env.PHANTOMBUSTER_PHANTOM_ID}/launch`,
      {
        argument: JSON.stringify({
          profileUrls: [url],
          sessionCookie: process.env.LINKEDIN_SESSION_COOKIE
        })
      },
      {
        headers: {
          'X-Phantombuster-Key': process.env.PHANTOMBUSTER_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );

    // Poll for completion (max 15 attempts = 7.5 minutes)
    let attempts = 0;
    const maxAttempts = 15;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
      
      const statusResponse = await axios.get(
        `https://api.phantombuster.com/api/v1/agent/${process.env.PHANTOMBUSTER_PHANTOM_ID}/output`,
        {
          headers: { 'X-Phantombuster-Key': process.env.PHANTOMBUSTER_API_KEY }
        }
      );
      
      const containerStatus = statusResponse.data?.data?.containerStatus;
      const agentStatus = statusResponse.data?.data?.agentStatus;
      attempts++;
      
      // Check if completed
      if (containerStatus === 'not running' && agentStatus === 'not running') {
        const results = statusResponse.data?.data?.resultObject;
        if (results && results.length > 0) {
          const formattedData = formatLinkedInResults(statusResponse.data, url);
          return res.json({
            content: formattedData,
            executionTime: attempts * 30
          });
        }
      }
    }
    
    // Timeout
    return res.status(408).json({
      error: 'PhantomBuster execution timed out',
      details: `Phantom did not complete after ${attempts * 30} seconds`
    });

  } catch (error) {
    console.error('PhantomBuster API Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'PhantomBuster request failed',
      details: error.response?.data?.error || error.message
    });
  }
});

// Helper function for formatting LinkedIn results
function formatLinkedInResults(rawData, originalUrl) {
  // Parse the JSON string from resultObject
  let resultArray = [];
  try {
    const resultString = rawData?.data?.resultObject;
    if (resultString && typeof resultString === 'string') {
      resultArray = JSON.parse(resultString);
    } else if (Array.isArray(resultString)) {
      resultArray = resultString; // Already parsed
    }
  } catch (error) {
    console.error('Error parsing PhantomBuster resultObject:', error.message);
  }
  
  const profile = resultArray[0] || {};
  const general = profile.general || {};
  const schools = profile.schools || [];
  
  // Extract graduation dates for age estimation (PRIMARY USE CASE)
  const educationInfo = schools.map(school => {
    const dateRange = school.dateRange || '';
    const graduationYear = dateRange.match(/(\d{4})\s*-\s*(\d{4})/)?.[2] || 
                          dateRange.match(/(\d{4})$/)?.[0];
    return {
      school: school.schoolName,
      degree: school.degree,
      dateRange: dateRange,
      graduationYear: graduationYear
    };
  });
  
  const graduationYears = educationInfo
    .map(edu => edu.graduationYear)
    .filter(year => year)
    .sort((a, b) => b - a);
  
  const latestGraduation = graduationYears[0];
  const estimatedAge = latestGraduation ? new Date().getFullYear() - parseInt(latestGraduation) + 22 : null;
  
  return `LinkedIn Profile Information:
Name: ${general.fullName || 'Not found'}
Location: ${general.location || 'Not found'}

*** CRITICAL FOR AGE ESTIMATION ***
Education History:
${educationInfo.map(edu => 
  `- ${edu.school}: ${edu.degree} (${edu.dateRange})${edu.graduationYear ? ` → Graduated: ${edu.graduationYear}` : ''}`
).join('\n') || 'No education information found'}

Age Estimation:
${latestGraduation ? `Latest Graduation: ${latestGraduation} → Estimated Age: ~${estimatedAge} years old` : 'Cannot estimate age - no graduation dates found'}

Contact Information:
- LinkedIn: ${general.profileUrl || originalUrl}
- Location: ${general.location || 'Not specified'}`;
}

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
    const { companyName, criterionId, result, companyData, costs } = req.body;

    if (!companyName || !criterionId || !result) {
      return res.status(400).json({ 
        error: 'Missing required fields: companyName, criterionId, result' 
      });
    }

    const resultId = await researchDAO.saveResearchResult(
      companyName, 
      criterionId, 
      result, 
      companyData || {},
      costs || {}
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

// Get cost summary
app.get('/api/research/costs', async (req, res) => {
  try {
    const { templateId } = req.query;
    const summary = await researchDAO.getCostSummary(templateId ? parseInt(templateId) : null);
    
    res.json(summary);
  } catch (error) {
    console.error('Error getting cost summary:', error);
    res.status(500).json({
      error: 'Failed to get cost summary',
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

// Company Data Management Endpoints

// Upload and save company CSV data to template
app.post('/api/template/:id/companies', upload.single('csvFile'), async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    console.log(`[SERVER] CSV upload request for template ID: ${templateId}`);
    
    if (!req.file) {
      console.log('[SERVER] No CSV file provided in request');
      return res.status(400).json({ error: 'No CSV file provided' });
    }

    console.log(`[SERVER] Processing CSV file: ${req.file.originalname}, size: ${req.file.size} bytes`);

    // Parse CSV data
    const csvString = req.file.buffer.toString('utf8');
    console.log(`[SERVER] CSV content length: ${csvString.length} characters`);
    
    const parseResult = parseCSVData(csvString);
    const { companies, duplicatesSkipped } = parseResult;
    console.log(`[SERVER] Parsed ${companies.length} companies from CSV, skipped ${duplicatesSkipped} duplicates`);

    if (companies.length === 0) {
      console.log('[SERVER] No valid company data found in CSV');
      return res.status(400).json({ error: 'No valid company data found in CSV' });
    }

    // Log first company as sample
    if (companies.length > 0) {
      console.log('[SERVER] Sample company data:', JSON.stringify(companies[0], null, 2));
    }

    // Save to database
    console.log(`[SERVER] Saving company data to template ${templateId}...`);
    const result = await researchDAO.saveCompanyData(templateId, companies);
    console.log('[SERVER] Company data saved successfully:', result);
    
    // Build response message
    let message = `Imported ${companies.length} companies`;
    if (duplicatesSkipped > 0) {
      message += `, skipped ${duplicatesSkipped} duplicates`;
    }
    
    res.json({
      success: true,
      message: message,
      count: companies.length,
      duplicatesSkipped: duplicatesSkipped
    });

  } catch (error) {
    console.error('[SERVER] Error uploading company data:', error);
    res.status(500).json({
      error: 'Failed to import company data',
      details: error.message
    });
  }
});

// Get company data for template
app.get('/api/template/:id/companies', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const companies = await researchDAO.getCompanyData(templateId);
    
    res.json({
      companies: companies,
      count: companies.length
    });
  } catch (error) {
    console.error('Error getting company data:', error);
    res.status(500).json({
      error: 'Failed to get company data',
      details: error.message
    });
  }
});

// Clear company data for template
app.delete('/api/template/:id/companies', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    await researchDAO.clearCompanyData(templateId);
    
    res.json({
      success: true,
      message: 'Company data cleared'
    });
  } catch (error) {
    console.error('Error clearing company data:', error);
    res.status(500).json({
      error: 'Failed to clear company data',
      details: error.message
    });
  }
});

// Get all research results for a template
app.get('/api/research/template/:id/results', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    
    console.log(`[SERVER] Getting all research results for template ${templateId}`);
    const results = await researchDAO.getTemplateResults(templateId);
    
    res.json({
      templateId: templateId,
      results: results,
      count: results.length
    });
  } catch (error) {
    console.error('Error getting template results:', error);
    res.status(500).json({
      error: 'Failed to get template results',
      details: error.message
    });
  }
});

// Delete all research results for a criterion in a template
app.delete('/api/research/criterion/:criterionId/template/:templateId', async (req, res) => {
  try {
    const criterionId = parseInt(req.params.criterionId);
    const templateId = parseInt(req.params.templateId);
    
    console.log(`[SERVER] Deleting research results for criterion ${criterionId} in template ${templateId}`);
    const result = await researchDAO.deleteCriterionResults(criterionId, templateId);
    
    res.json(result);
  } catch (error) {
    console.error('Error deleting criterion research results:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete all research results for a company in a template
app.delete('/api/research/company/:companyName/template/:templateId', async (req, res) => {
  try {
    const companyName = decodeURIComponent(req.params.companyName);
    const templateId = parseInt(req.params.templateId);
    
    console.log(`[SERVER] Deleting research results for company "${companyName}" in template ${templateId}`);
    const result = await researchDAO.deleteCompanyResults(companyName, templateId);
    
    res.json(result);
  } catch (error) {
    console.error('Error deleting company research results:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Start research endpoint
app.post('/api/research/start', async (req, res) => {
  try {
    const { companies, startIndex, endIndex, criteriaNames, options } = req.body;
    
    // Reset stop flag when starting new research
    isResearchStopped = false;
    console.log('[SERVER] Research request received (stop flag reset):', {
      companiesCount: companies.length,
      range: `${startIndex}-${endIndex}`,
      criteria: criteriaNames,
      options
    });

    // Import and initialize research engine
    console.log(`[DEBUG] Creating ResearchEngine for research request...`);
    const ResearchEngine = require('../src/research-engine');
    const engine = new ResearchEngine();
    
    console.log(`[DEBUG] Initializing ResearchEngine...`);
    await engine.initialize();

    // Pass stop flag checker to research engine
    engine.setStopChecker(() => isResearchStopped);

    // Progress callback to log updates and send to SSE client
    const progressCallback = (progress) => {
      console.log('[SERVER] Research progress:', progress);
      
      // Send to SSE client if connected
      if (sseClient) {
        try {
          const update = {
            type: 'research_progress',
            timestamp: Date.now(),
            ...progress
          };
          
          sseClient.write(`data: ${JSON.stringify(update)}\n\n`);
        } catch (error) {
          console.error('[SERVER] Error sending SSE update:', error);
          sseClient = null; // Clear broken connection
        }
      }
    };

    // Start research
    console.log('[SERVER] Starting research engine...');
    await engine.researchCompanyRange(
      companies,
      startIndex,
      endIndex,
      criteriaNames,
      options,
      progressCallback
    );

    console.log('[SERVER] Research completed successfully');
    res.json({ success: true, message: 'Research completed' });

  } catch (error) {
    console.error('[SERVER] Research error:', error);
    
    // Check if it was stopped by user
    if (isResearchStopped) {
      console.log('[SERVER] Research was stopped by user');
      res.json({ success: true, message: 'Research stopped by user' });
    } else {
      res.status(500).json({
        error: 'Research failed',
        details: error.message
      });
    }
  }
});

// Stop research endpoint
app.post('/api/research/stop', async (req, res) => {
  try {
    console.log('[SERVER] Stop research request received');
    isResearchStopped = true;
    console.log('[SERVER] Research stop flag set to true');
    
    res.json({ 
      success: true, 
      message: 'Research stop requested - will terminate at next checkpoint' 
    });
  } catch (error) {
    console.error('[SERVER] Error stopping research:', error);
    res.status(500).json({
      error: 'Failed to stop research',
      details: error.message
    });
  }
});

// SSE endpoint for real-time progress updates
app.get('/api/research/stream', (req, res) => {
  console.log('[SERVER] SSE client connected');
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });
  
  // Store the single client connection
  sseClient = res;
  
  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({
    type: 'connection',
    message: 'Connected to research progress stream',
    timestamp: Date.now()
  })}\n\n`);
  
  // Handle client disconnect
  req.on('close', () => {
    console.log('[SERVER] SSE client disconnected');
    sseClient = null;
  });
  
  req.on('error', (error) => {
    console.error('[SERVER] SSE request error:', error);
    sseClient = null;
  });
});

// Instructions endpoint
app.get('/api/instructions', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const instructionsPath = path.resolve(__dirname, '../docs/instructions.txt');
    
    console.log('[SERVER] Reading instructions from:', instructionsPath);
    const content = fs.readFileSync(instructionsPath, 'utf8');
    
    res.json({ content });
  } catch (error) {
    console.error('[SERVER] Error reading instructions file:', error);
    res.status(500).json({ 
      error: 'Failed to load instructions',
      details: error.message
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