/**
 * SmartBroker v2 - Simple API Server
 * Provides API proxying for Claude and Perplexity APIs
 */
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../src')));

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

// Serve the main app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../src/index.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`SmartBroker v2 server running at http://localhost:${port}`);
});