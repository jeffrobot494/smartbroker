const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
require('dotenv').config();

// Import API wrapper functions
const apiWrapper = require('./api-wrapper');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../development')));

// Define the questions for company assessment
const questions = [
    { text: "Does the company sell a software product or software development services?", positiveAnswer: "YES", note: "Check the company's website" },
    { text: "Are the company's products vertical market software?", positiveAnswer: "YES", note: "Check the company's website" },
    { text: "Is the owner of the company at least 50 years old?", positiveAnswer: "YES", note: "Check radaris" },
    { text: "Does the company number between 5 and 40 employees?", positiveAnswer: "YES", note: "" },
    { text: "Is the company bootstrapped?", positiveAnswer: "YES", note: "If there's no indication of VC/PE funding, assume the company is bootstrapped" },
    { text: "Are the majority of the employees based in the USA?", positiveAnswer: "YES", note: "Check zoominfo" }
];

// Company data storage
let companies = [];

// Load company data from CSV
function loadCompanyData() {
    const results = [];
    return new Promise((resolve, reject) => {
        fs.createReadStream(path.join(__dirname, '../data/company_info.csv'))
            .pipe(csv())
            .on('data', (data) => {
                // Extract relevant company info
                const company = {
                    companyName: data['Company'] || '',
                    owner: data['First Name'] && data['Last Name'] ? `${data['First Name']} ${data['Last Name']}` : '',
                    title: data['Title'] || '',
                    location: data['City'] && data['State'] ? `${data['City']}, ${data['State']}` : '',
                    website: data['Website'] ? data['Website'].replace('http://', '').replace('https://', '') : '',
                    employeeCount: data['Annual Revenue'] ? Math.floor(parseInt(data['Annual Revenue'].replace(/\D/g, '')) / 120000) : null,
                    linkedinUrl: data['Company Linkedin Url'] || ''
                };
                results.push(company);
            })
            .on('end', () => {
                companies = results;
                resolve(results);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

// Initialize company data on startup
loadCompanyData().catch(err => {
    console.error('Error loading company data:', err);
});

// Proxy endpoint for Anthropic API
app.post('/api/anthropic', async (req, res) => {
    try {
        const response = await axios.post('https://api.anthropic.com/v1/messages', req.body, {
            headers: {
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || error.message
        });
    }
});

// Perplexity search proxy endpoint
app.post('/api/perplexity', async (req, res) => {
    try {
        const query = req.body.query || req.body.messages?.[0]?.content;
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }
        
        const result = await apiWrapper.perplexitySearch(query);
        res.json(result);
    } catch (error) {
        console.error('Error with Perplexity API:', error.message);
        res.status(500).json({
            error: error.message
        });
    }
});

// Endpoint to research a specific company for a specific question
app.post('/api/research', async (req, res) => {
    try {
        const { companyIndex, questionIndex } = req.body;
        
        // Validate parameters
        if (companyIndex === undefined || questionIndex === undefined) {
            return res.status(400).json({ error: 'Company index and question index are required' });
        }
        
        // Get company and question
        const company = companies[companyIndex];
        const question = questions[questionIndex];
        
        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }
        
        if (!question) {
            return res.status(404).json({ error: 'Question not found' });
        }
        
        // For now we don't track previous findings since client manages state
        const previousFindings = {};
        
        // Generate the research prompt
        const prompt = apiWrapper.generateResearchPrompt(company, question, previousFindings);
        const systemPrompt = apiWrapper.createSystemPrompt();
        
        // Call Claude to perform the research
        console.log(`Researching company ${company.companyName} for question: ${question.text}`);
        const claudeResponse = await apiWrapper.askClaude(prompt, systemPrompt, 2000);
        
        // Interpret Claude's response
        const result = apiWrapper.interpretClaudeResponse(claudeResponse, question);
        
        // Return the research result without storing server-side state
        res.json({
            company: company.companyName,
            question: question.text,
            result: result,
            claudeResponse: claudeResponse.content,
            usage: claudeResponse.usage
        });
        
    } catch (error) {
        console.error('Error in research endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to get companies
app.get('/api/companies', (req, res) => {
    if (companies.length === 0) {
        loadCompanyData()
            .then(data => {
                res.json(data);
            })
            .catch(err => {
                console.error('Error loading company data:', err);
                res.status(500).json({ error: 'Failed to load company data' });
            });
    } else {
        res.json(companies);
    }
});

// Get questions
app.get('/api/questions', (req, res) => {
    res.json(questions);
});

// Since our application now uses client-side state management,
// we've removed the server-side state management endpoints.

// Simple test route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../development/index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});