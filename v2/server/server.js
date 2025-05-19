/**
 * SmartBroker v2 - Simple API Server
 * Provides API proxying for Claude and Perplexity APIs
 */
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../src')));

// Data directory path
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
async function ensureDataDirExists() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        console.log(`Data directory created at ${DATA_DIR}`);
    } catch (error) {
        console.error('Error creating data directory:', error);
    }
}

// API Proxy for Claude
app.post('/api/claude', async (req, res) => {
    try {
        if (!process.env.ANTHROPIC_API_KEY) {
            return res.status(401).json({ error: 'API key not configured on server' });
        }

        const response = await axios.post('https://api.anthropic.com/v1/messages', req.body, {
            headers: {
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Claude API error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || error.message
        });
    }
});

// API Proxy for Perplexity
app.post('/api/perplexity', async (req, res) => {
    console.log('Server: Perplexity API endpoint called');
    try {
        console.log('Server: Perplexity request body:', req.body);
        
        if (!process.env.PERPLEXITY_API_KEY) {
            console.error('Server: Perplexity API key not configured');
            return res.status(401).json({ error: 'API key not configured on server' });
        }

        const { query } = req.body;
        if (!query) {
            console.error('Server: No query provided in request');
            return res.status(400).json({ error: 'Query is required' });
        }

        console.log('Server: Making Perplexity API request with query:', query);
        
        // The Perplexity API endpoint has changed - they now use chat completions
        try {
            const response = await axios.post('https://api.perplexity.ai/chat/completions', {
                model: "sonar-pro",
                messages: [
                    {
                        role: "user",
                        content: query
                    }
                ]
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('Server: Perplexity API request successful, status:', response.status);
            console.log('Server: Perplexity response data structure:', Object.keys(response.data));
            
            res.json(response.data);
        } catch (apiError) {
            console.error('Server: Perplexity API request failed:', apiError.message);
            console.error('Server: Error response:', apiError.response?.data);
            
            res.status(apiError.response?.status || 500).json({
                error: apiError.response?.data?.error || apiError.message,
                errorDetails: apiError.response?.data || 'No additional details'
            });
        }
    } catch (error) {
        console.error('Server: General error in Perplexity endpoint:', error.message);
        res.status(500).json({
            error: error.message,
            errorType: 'SERVER_ERROR'
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        apis: {
            claude: !!process.env.ANTHROPIC_API_KEY,
            perplexity: !!process.env.PERPLEXITY_API_KEY
        }
    });
});

// API Endpoints for questions and prompts

// GET /api/questions - Get all questions
app.get('/api/questions', async (req, res) => {
    try {
        await ensureDataDirExists();
        const questionsPath = path.join(DATA_DIR, 'questions.json');
        
        try {
            const data = await fs.readFile(questionsPath, 'utf8');
            const questions = JSON.parse(data);
            res.json(questions);
        } catch (error) {
            // If file doesn't exist or has invalid JSON, return empty array
            if (error.code === 'ENOENT' || error instanceof SyntaxError) {
                console.warn('Questions file not found or invalid JSON, returning empty array');
                res.json([]);
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('Error reading questions:', error);
        res.status(500).json({ error: 'Failed to read questions' });
    }
});

// POST /api/questions - Add a new question
app.post('/api/questions', async (req, res) => {
    try {
        await ensureDataDirExists();
        const questionsPath = path.join(DATA_DIR, 'questions.json');
        
        // Read existing questions
        let questions = [];
        try {
            const data = await fs.readFile(questionsPath, 'utf8');
            questions = JSON.parse(data);
        } catch (error) {
            // If file doesn't exist or has invalid JSON, start with empty array
            if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) {
                throw error;
            }
        }
        
        // Add new question
        const newQuestion = req.body;
        questions.push(newQuestion);
        
        // Write updated questions back to file
        await fs.writeFile(questionsPath, JSON.stringify(questions, null, 2), 'utf8');
        
        res.status(201).json(newQuestion);
    } catch (error) {
        console.error('Error adding question:', error);
        res.status(500).json({ error: 'Failed to add question' });
    }
});

// PUT /api/questions/:index - Update a question
app.put('/api/questions/:index', async (req, res) => {
    try {
        await ensureDataDirExists();
        const questionsPath = path.join(DATA_DIR, 'questions.json');
        const index = parseInt(req.params.index);
        
        // Read existing questions
        let questions = [];
        try {
            const data = await fs.readFile(questionsPath, 'utf8');
            questions = JSON.parse(data);
        } catch (error) {
            // If file doesn't exist or has invalid JSON, return 404
            if (error.code === 'ENOENT' || error instanceof SyntaxError) {
                return res.status(404).json({ error: 'Questions file not found or invalid' });
            }
            throw error;
        }
        
        // Validate index
        if (index < 0 || index >= questions.length) {
            return res.status(404).json({ error: 'Question not found' });
        }
        
        // Update question
        const updatedQuestion = req.body;
        questions[index] = updatedQuestion;
        
        // Write updated questions back to file
        await fs.writeFile(questionsPath, JSON.stringify(questions, null, 2), 'utf8');
        
        res.json(updatedQuestion);
    } catch (error) {
        console.error('Error updating question:', error);
        res.status(500).json({ error: 'Failed to update question' });
    }
});

// DELETE /api/questions/:index - Delete a question
app.delete('/api/questions/:index', async (req, res) => {
    try {
        await ensureDataDirExists();
        const questionsPath = path.join(DATA_DIR, 'questions.json');
        const index = parseInt(req.params.index);
        
        // Read existing questions
        let questions = [];
        try {
            const data = await fs.readFile(questionsPath, 'utf8');
            questions = JSON.parse(data);
        } catch (error) {
            // If file doesn't exist or has invalid JSON, return 404
            if (error.code === 'ENOENT' || error instanceof SyntaxError) {
                return res.status(404).json({ error: 'Questions file not found or invalid' });
            }
            throw error;
        }
        
        // Validate index
        if (index < 0 || index >= questions.length) {
            return res.status(404).json({ error: 'Question not found' });
        }
        
        // Remove question
        const removedQuestion = questions.splice(index, 1)[0];
        
        // Write updated questions back to file
        await fs.writeFile(questionsPath, JSON.stringify(questions, null, 2), 'utf8');
        
        res.json(removedQuestion);
    } catch (error) {
        console.error('Error deleting question:', error);
        res.status(500).json({ error: 'Failed to delete question' });
    }
});

// GET /api/prompts - Get all prompts
app.get('/api/prompts', async (req, res) => {
    try {
        await ensureDataDirExists();
        const promptsPath = path.join(DATA_DIR, 'prompts.json');
        
        try {
            const data = await fs.readFile(promptsPath, 'utf8');
            const prompts = JSON.parse(data);
            res.json(prompts);
        } catch (error) {
            // If file doesn't exist or has invalid JSON, return empty object
            if (error.code === 'ENOENT' || error instanceof SyntaxError) {
                console.warn('Prompts file not found or invalid JSON, returning empty object');
                res.json({});
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('Error reading prompts:', error);
        res.status(500).json({ error: 'Failed to read prompts' });
    }
});

// PUT /api/prompts - Update prompts
app.put('/api/prompts', async (req, res) => {
    try {
        await ensureDataDirExists();
        const promptsPath = path.join(DATA_DIR, 'prompts.json');
        
        // Update prompts
        const updatedPrompts = req.body;
        
        // Write updated prompts back to file
        await fs.writeFile(promptsPath, JSON.stringify(updatedPrompts, null, 2), 'utf8');
        
        res.json(updatedPrompts);
    } catch (error) {
        console.error('Error updating prompts:', error);
        res.status(500).json({ error: 'Failed to update prompts' });
    }
});

// Serve the main app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../src/index.html'));
});

// Start the server
app.listen(port, async () => {
    // Ensure data directory exists on startup
    await ensureDataDirExists();
    console.log(`SmartBroker v2 server running at http://localhost:${port}`);
});