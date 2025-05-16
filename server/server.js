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

// Store investigation state
const investigationState = {
    currentCompanyIndex: 0,
    currentQuestionIndex: 0,
    results: [],
    companies: [],
    questions: [
        { text: "Does the company sell a software product or software development services?", positiveAnswer: "YES", note: "Check the company's website" },
        { text: "Are the company's products vertical market software?", positiveAnswer: "YES", note: "Check the company's website" },
        { text: "Is the owner of the company at least 50 years old?", positiveAnswer: "YES", note: "Check radaris" },
        { text: "Does the company number between 5 and 40 employees?", positiveAnswer: "YES", note: "" },
        { text: "Is the company bootstrapped?", positiveAnswer: "YES", note: "If there's no indication of VC/PE funding, assume the company is bootstrapped" },
        { text: "Are the majority of the employees based in the USA?", positiveAnswer: "YES", note: "Check zoominfo" }
    ]
};

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
                investigationState.companies = results;
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
        const company = investigationState.companies[companyIndex];
        const question = investigationState.questions[questionIndex];
        
        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }
        
        if (!question) {
            return res.status(404).json({ error: 'Question not found' });
        }
        
        // Get previous findings for this company
        const previousFindings = {};
        if (investigationState.results[companyIndex]) {
            const answers = investigationState.results[companyIndex].answers;
            for (let i = 0; i < answers.length; i++) {
                if (answers[i] && i !== questionIndex) {
                    previousFindings[`Question ${i+1}`] = answers[i];
                }
            }
        }
        
        // Generate the research prompt
        const prompt = apiWrapper.generateResearchPrompt(company, question, previousFindings);
        const systemPrompt = apiWrapper.createSystemPrompt();
        
        // Call Claude to perform the research
        console.log(`Researching company ${company.companyName} for question: ${question.text}`);
        const claudeResponse = await apiWrapper.askClaude(prompt, systemPrompt, 2000);
        
        // Interpret Claude's response
        const result = apiWrapper.interpretClaudeResponse(claudeResponse, question);
        
        // Save the result to investigation state
        if (!investigationState.results[companyIndex]) {
            investigationState.results[companyIndex] = {
                companyName: company.companyName,
                answers: Array(investigationState.questions.length).fill(null),
                status: 'In Progress'
            };
        }
        
        investigationState.results[companyIndex].answers[questionIndex] = result.answer;
        
        // If negative, mark as disqualified
        if (result.answer !== question.positiveAnswer) {
            investigationState.results[companyIndex].status = 'Disqualified';
        }
        // If we're on the last question and answer is positive, mark as qualified
        else if (questionIndex === investigationState.questions.length - 1) {
            investigationState.results[companyIndex].status = 'Qualified';
        }
        
        // Return the research result
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
    if (investigationState.companies.length === 0) {
        loadCompanyData()
            .then(companies => {
                res.json(companies);
            })
            .catch(err => {
                console.error('Error loading company data:', err);
                res.status(500).json({ error: 'Failed to load company data' });
            });
    } else {
        res.json(investigationState.companies);
    }
});

// Get questions
app.get('/api/questions', (req, res) => {
    res.json(investigationState.questions);
});

// Get current investigation state
app.get('/api/investigation/state', (req, res) => {
    res.json({
        currentCompanyIndex: investigationState.currentCompanyIndex,
        currentQuestionIndex: investigationState.currentQuestionIndex,
        results: investigationState.results
    });
});

// Start or reset investigation
app.post('/api/investigation/start', (req, res) => {
    investigationState.currentCompanyIndex = 0;
    investigationState.currentQuestionIndex = 0;
    investigationState.results = [];
    
    res.json({ message: 'Investigation started/reset successfully' });
});

// Save answer to current company/question
app.post('/api/investigation/answer', (req, res) => {
    const { companyIndex, questionIndex, answer } = req.body;
    
    if (!investigationState.results[companyIndex]) {
        investigationState.results[companyIndex] = {
            companyName: investigationState.companies[companyIndex].companyName,
            answers: Array(investigationState.questions.length).fill(null),
            status: 'In Progress'
        };
    }
    
    investigationState.results[companyIndex].answers[questionIndex] = answer;
    
    // If negative answer, mark as disqualified
    if (answer !== investigationState.questions[questionIndex].positiveAnswer) {
        investigationState.results[companyIndex].status = 'Disqualified';
    } 
    // If we're on the last question and answer is positive, mark as qualified
    else if (questionIndex === investigationState.questions.length - 1) {
        investigationState.results[companyIndex].status = 'Qualified';
    }
    
    res.json({ message: 'Answer saved successfully' });
});

// Move to next step in investigation
app.post('/api/investigation/next', (req, res) => {
    // Current company and question
    let nextCompanyIndex = investigationState.currentCompanyIndex;
    let nextQuestionIndex = investigationState.currentQuestionIndex;
    
    // Move to next company
    nextCompanyIndex++;
    
    // If we've gone through all companies for this question
    if (nextCompanyIndex >= investigationState.companies.length) {
        nextCompanyIndex = 0;
        nextQuestionIndex++;
    }
    
    // Update state
    investigationState.currentCompanyIndex = nextCompanyIndex;
    investigationState.currentQuestionIndex = nextQuestionIndex;
    
    // Check if we're done with all questions
    const isDone = nextQuestionIndex >= investigationState.questions.length;
    
    res.json({ 
        nextCompanyIndex,
        nextQuestionIndex,
        isDone
    });
});

// Simple test route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../development/index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});