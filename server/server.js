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

// Define the questions for company assessment with enhanced details
const questions = [
    { 
        text: "Does the company sell a software product or products?", 
        positiveAnswer: "YES", 
        detailedDescription: "We're looking for companies that develop and sell their own software products, as opposed to companies that primarily offer software development services or consulting. A software product is a packaged application or platform that clients can purchase, license, or subscribe to use.",
        searchGuidance: "Examine the company website, especially 'Products', 'Solutions', or 'Services' pages. Look for specific named software offerings, pricing pages, demo requests, or product screenshots. Software products typically have specific names, features lists, and may mention licensing models.",
        disqualificationCriteria: "The company should be disqualified if it primarily offers custom software development, IT consulting, implementation services, or integration of third-party software without having its own products. Companies describing themselves as 'software development shops' or 'dev agencies' are typically not what we're looking for.",
        usefulSources: ["Company website", "LinkedIn company page", "G2.com", "Capterra.com", "Crunchbase"],
        examples: {
            positive: "Acme Corp offers TimeTracker Pro, a time management software for professional services firms with pricing tiers and a free trial.",
            negative: "XYZ Solutions provides custom software development services tailored to each client's unique business requirements."
        }
    },
    { 
        text: "Are the company's products vertical market software?", 
        positiveAnswer: "YES", 
        detailedDescription: "Vertical market software is designed to address the needs of a specific industry or business type, rather than being general-purpose software. We're looking for software that specializes in a particular industry vertical like healthcare, legal, construction, manufacturing, etc.",
        searchGuidance: "Look at how the company describes its target market. Check if they mention specific industries they serve. Examine customer testimonials and case studies for industry focus. Look for industry-specific terminology or features in their product descriptions.",
        disqualificationCriteria: "The company should be disqualified if their products are horizontal (designed for all businesses regardless of industry) like general accounting software, generalized CRM, or productivity tools that aren't industry-specific.",
        usefulSources: ["Company website - particularly 'About Us' and 'Industries' pages", "Case studies", "Customer testimonials"],
        examples: {
            positive: "MedTech Solutions offers PatientFlow, a practice management system specifically designed for small to medium-sized medical practices.",
            negative: "BusinessSoft offers a general-purpose accounting package that can be used by any type of business."
        }
    },
    { 
        text: "Who is the president or owner of the company?", 
        positiveAnswer: "NAME", 
        detailedDescription: "We need to identify the primary decision-maker at the company - typically the founder, CEO, president, or majority owner. For small businesses, this is often one person who holds a title like Owner, President, CEO, or Founder.",
        searchGuidance: "Check the company website's 'About Us', 'Team', or 'Leadership' pages. LinkedIn company page often lists key executives. For smaller companies, also look at LinkedIn profiles connected to the company with founder/owner/CEO titles. State business registrations sometimes list owners/officers.",
        disqualificationCriteria: "This question doesn't disqualify a company, but is used to gather information for subsequent questions. If no clear owner can be identified, note this but continue with other questions.",
        usefulSources: ["Company website", "LinkedIn", "Bloomberg company profiles", "OpenCorporates", "State business registries"],
        examples: {
            positive: "Based on the LinkedIn profile and company website, John Smith is the Founder and CEO of Acme Software.",
            negative: "The company appears to be a subsidiary of a larger corporation and doesn't have a single identifiable owner."
        }
    },
    { 
        text: "Is the owner of the company at least 50 years old?", 
        positiveAnswer: "YES", 
        detailedDescription: "We need to verify if the identified owner/president is at least 50 years of age. This helps identify established business owners rather than younger entrepreneurs.",
        searchGuidance: "Use public records services like Radaris, WhitePages, or Spokeo to search for age information. Look for graduation dates on LinkedIn that might indicate approximate age (e.g., college graduation in 1995 or earlier would suggest they're likely 50+). Search for news articles or interviews that might mention age or career length.",
        disqualificationCriteria: "If you find concrete evidence that the owner is under 50 years old, the company should be disqualified.",
        usefulSources: ["Radaris.com", "Spokeo.com", "WhitePages.com", "LinkedIn (check education dates)", "News articles or interviews"],
        examples: {
            positive: "According to Radaris, John Smith was born in 1965, making him 58 years old.",
            negative: "Based on her LinkedIn profile showing college graduation in 2005, Jane Doe appears to be approximately 40 years old."
        }
    },
    { 
        text: "Does the company number between 5 and 40 employees?", 
        positiveAnswer: "YES", 
        detailedDescription: "We're looking for small businesses with enough employees to be established (at least 5) but not so large that they're beyond our target size (no more than 40).",
        searchGuidance: "Check LinkedIn company page which often shows employee count. Look at the company website's team or about page to count visible employees. ZoomInfo, Crunchbase, and D&B often provide employee counts. If exact counts aren't available, you might estimate based on company size descriptions (small, medium) and annual revenue (roughly $100k-$250k per employee for software companies).",
        disqualificationCriteria: "Companies with fewer than 5 employees may be too small or too new. Companies with more than 40 employees are too large for our criteria.",
        usefulSources: ["LinkedIn company page", "ZoomInfo", "Crunchbase", "Company website team page", "D&B business directories"],
        examples: {
            positive: "According to LinkedIn, the company has 22 employees, which falls within our 5-40 range.",
            negative: "The company's website states they have over 100 employees across 3 offices."
        }
    },
    { 
        text: "Is the company bootstrapped?", 
        positiveAnswer: "YES", 
        detailedDescription: "We're looking for companies that are self-funded (bootstrapped) rather than venture-backed or private equity owned. Bootstrapped companies are typically funded by the founders, their revenue, or small personal investments rather than institutional investors.",
        searchGuidance: "Look for funding information on Crunchbase, which typically lists investment rounds. Check company press releases or news for mentions of funding. Review the company's 'About Us' page which might mention their funding approach. Absence of VC funding information often suggests bootstrapping.",
        disqualificationCriteria: "Evidence of venture capital funding, private equity ownership, or being acquired by a larger company would disqualify the business. If there's no indication of external funding, assume the company is bootstrapped.",
        usefulSources: ["Crunchbase", "Company website", "Press releases", "Business news articles"],
        examples: {
            positive: "The company has been operating for 15 years with no record of external funding on Crunchbase or in press releases, suggesting it is bootstrapped.",
            negative: "According to Crunchbase, the company raised a $5M Series A round from Acme Ventures in 2021."
        }
    },
    { 
        text: "Are the majority of the employees based in the USA?", 
        positiveAnswer: "YES", 
        detailedDescription: "We want to identify companies with most of their workforce in the United States rather than primarily offshore operations.",
        searchGuidance: "Check the company website for office locations. Look at employee LinkedIn profiles to see where they're located. Check job postings to see where they're hiring. ZoomInfo sometimes provides employee location breakdowns.",
        disqualificationCriteria: "If most employees appear to be located outside the USA, or if the company primarily advertises its offshore development capabilities, it should be disqualified.",
        usefulSources: ["ZoomInfo", "LinkedIn company page", "Company website 'Careers' or 'Contact Us' pages", "Job postings"],
        examples: {
            positive: "Based on LinkedIn data, approximately 80% of the company's 25 employees are located in the United States.",
            negative: "The company's website highlights their development centers in Eastern Europe and India, with only sales and marketing in the US."
        }
    }
];

// Company data storage
let companies = [];

// Load company data from CSV
function loadCompanyData() {
    const results = [];
    let count = 0;
    const LIMIT = 100; // Limit to 100 records
    
    return new Promise((resolve, reject) => {
        fs.createReadStream(path.join(__dirname, '../data/company_info.csv'))
            .pipe(csv())
            .on('data', (data) => {
                // Only process up to LIMIT records
                if (count < LIMIT) {
                    // Extract only company name and website for now
                    const company = {
                        companyName: data['Company'] || '',
                        website: data['Website'] ? data['Website'].replace('http://', '').replace('https://', '') : '',
                        // Keep these fields in the structure but leave them empty
                        owner: '',
                        title: '',
                        location: '',
                        employeeCount: null,
                        linkedinUrl: ''
                    };
                    results.push(company);
                    count++;
                }
            })
            .on('end', () => {
                console.log(`Loaded ${results.length} companies (limited to ${LIMIT})`);
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
        const { companyIndex, questionIndex, ownerName } = req.body;
        
        // Validate parameters
        if (companyIndex === undefined || questionIndex === undefined) {
            return res.status(400).json({ error: 'Company index and question index are required' });
        }
        
        // Get company and question
        let companyData = companies[companyIndex];
        const question = questions[questionIndex];
        
        if (!companyData) {
            return res.status(404).json({ error: 'Company not found' });
        }
        
        if (!question) {
            return res.status(404).json({ error: 'Question not found' });
        }
        
        // Initialize previous findings
        const previousFindings = {};
        
        // If this is the Owner Age question and we have the owner name from previous research
        if (questionIndex === 3 && ownerName) {
            previousFindings['Owner Name'] = ownerName;
            console.log(`Using previously found owner name: ${ownerName} for age research`);
            
            // Clone the company object to avoid modifying the original
            companyData = {...companyData};
            // Always override the owner field with our research result
            companyData.owner = ownerName;
        }
        
        // Generate the research prompt
        const prompt = apiWrapper.generateResearchPrompt(companyData, question, previousFindings);
        const systemPrompt = apiWrapper.createSystemPrompt();
        
        // Call Claude to perform the research
        console.log(`Researching company ${companyData.companyName} for question: ${question.text}`);
        const claudeResponse = await apiWrapper.askClaude(prompt, systemPrompt, 2000);
        
        // Interpret Claude's response
        const result = apiWrapper.interpretClaudeResponse(claudeResponse, question);
        
        // Return the research result without storing server-side state
        res.json({
            company: companyData.companyName,
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