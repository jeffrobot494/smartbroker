# API Interfaces & Function Specifications

This document defines the key API interfaces and function signatures for the SmartBroker application.

## Backend API Endpoints

### Companies API

#### GET /api/companies
Returns a list of all companies.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "co_1234",
      "name": "Company Name",
      "profile": { /* Profile fields */ },
      "research": {
        "status": "in_progress",
        "completedQuestions": 2,
        "totalQuestions": 7
      }
    }
  ]
}
```

#### GET /api/companies/:id
Returns detailed information about a specific company.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "co_1234",
    "name": "Company Name",
    "profile": { /* All profile fields */ },
    "research": {
      "status": "in_progress",
      "lastUpdated": "2023-05-18T14:30:00Z",
      "answers": {
        "q1": { 
          "answer": "YES", 
          "evidence": "...",
          "confidence": "HIGH", 
          "timestamp": "2023-05-18T14:30:00Z" 
        }
        // Other question answers...
      }
    }
  }
}
```

#### POST /api/companies/import
Imports companies from a CSV file.

**Request:**
```json
{
  "filePath": "../data/company_info.csv"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "imported": 100,
    "fields": ["Company", "Website", "First Name", "Last Name", "..."]
  }
}
```

### Questions API

#### GET /api/questions
Returns all qualification questions.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "q1",
      "text": "Does the company sell a software product or products?",
      "positiveAnswer": "YES",
      "note": "Check the company's website...",
      "dependencies": []
    },
    // Other questions...
  ]
}
```

### Research API

#### POST /api/research
Research a specific company for a specific question.

**Request:**
```json
{
  "companyId": "co_1234",
  "questionId": "q1"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "companyId": "co_1234",
    "questionId": "q1",
    "result": {
      "answer": "YES",
      "evidence": "...",
      "confidence": "HIGH"
    },
    "claudeResponse": "...",
    "usage": {
      "input_tokens": 320,
      "output_tokens": 450
    }
  }
}
```

#### GET /api/research/status/:companyId
Get research status for a company.

**Response:**
```json
{
  "success": true,
  "data": {
    "companyId": "co_1234",
    "status": "in_progress",
    "completedQuestions": [
      {
        "id": "q1",
        "answer": "YES"
      },
      {
        "id": "q2",
        "answer": "John Smith"
      }
    ],
    "pendingQuestions": [
      {
        "id": "q3",
        "dependencies": ["q2"],
        "dependenciesMet": true
      },
      // Other pending questions...
    ],
    "qualificationStatus": "pending"
  }
}
```

## Core Function Specifications

### Data Models

```javascript
// Company model factory function
function createCompany(data) {
  return {
    id: generateUniqueId(),
    name: extractCompanyName(data),
    profile: createProfile(data),
    research: createInitialResearch()
  };
}

// Question model
function createQuestion(data) {
  return {
    id: data.id || generateUniqueId(),
    text: data.text,
    positiveAnswer: data.positiveAnswer,
    note: data.note || '',
    dependencies: data.dependencies || []
  };
}

// Research result model
function createResearchResult(answer, evidence, confidence) {
  return {
    answer,
    evidence,
    confidence,
    timestamp: new Date().toISOString()
  };
}
```

### CSV Import

```javascript
// Parse CSV file and create company objects
async function importCompaniesFromCSV(filePath) {
  const { headers, rows } = await parseCSV(filePath);
  
  const companies = rows.map(row => {
    const data = {};
    headers.forEach((header, index) => {
      data[header] = row[index];
    });
    
    return createCompany(data);
  });
  
  return {
    companies,
    fields: headers
  };
}
```

### Research Functions

```javascript
// Check if all dependencies for a question are met
function areDependenciesMet(companyId, questionId, questions, researchStore) {
  const question = questions.find(q => q.id === questionId);
  if (!question || !question.dependencies || question.dependencies.length === 0) {
    return true;
  }
  
  return question.dependencies.every(depId => {
    const result = researchStore.getResult(companyId, depId);
    return result && result.answer;
  });
}

// Generate research prompt
function generateResearchPrompt(company, question, previousFindings) {
  // Assemble prompt text using company info, question, and previous findings
  // Handle special cases for dependent questions
  return promptText;
}

// Process Claude's response to extract answer
function interpretResearchResponse(response, question) {
  // For YES/NO questions
  if (question.positiveAnswer === "YES" || question.positiveAnswer === "NO") {
    // Extract boolean answer, confidence, evidence
  }
  // For NAME questions (like "Who is the owner?")
  else if (question.positiveAnswer === "NAME") {
    // Extract name, confidence, evidence
  }
  // For other question types
  else {
    // General extraction logic
  }
  
  return {
    answer,
    evidence,
    confidence
  };
}

// Update company qualification status based on answers
function updateQualificationStatus(company, questions) {
  const isDisqualified = questions.some(q => {
    const result = company.research.answers[q.id];
    return result && result.answer !== q.positiveAnswer && q.positiveAnswer !== "NAME";
  });
  
  if (isDisqualified) {
    company.research.status = "disqualified";
    return;
  }
  
  const allAnswered = questions.every(q => company.research.answers[q.id]);
  if (allAnswered) {
    company.research.status = "qualified";
  } else {
    company.research.status = "in_progress";
  }
}
```

### Storage Interface

```javascript
// Data store interface (implementation will vary based on storage type)
const dataStore = {
  // Company operations
  getCompanies() {},
  getCompany(id) {},
  saveCompany(company) {},
  saveCompanies(companies) {},
  
  // Question operations
  getQuestions() {},
  getQuestion(id) {},
  saveQuestions(questions) {},
  
  // Research operations
  getResearchResults(companyId) {},
  saveResearchResult(companyId, questionId, result) {}
};
```

## UI Component Interface

```javascript
// Company Table Component
function renderCompanyTable(companies, onSelectCompany) {
  // Create table HTML with company data
  // Add event listeners for row selection
  return tableElement;
}

// Company Detail Component
function renderCompanyDetail(company, questions, onStartResearch) {
  // Create company profile display
  // Show research status
  // Add controls for starting research
  return detailElement;
}

// Research Form Component
function renderResearchForm(company, question, previousFindings, onSubmit) {
  // Display company and question information
  // Show relevant previous findings
  // Add controls for submitting/skipping
  return formElement;
}

// Research Results Component
function renderResearchResults(company, questions) {
  // Display all research results for company
  // Show qualification status
  // Format in a readable way
  return resultsElement;
}
```

These specifications define the core interfaces and functions needed to implement the new architecture. They provide clear boundaries between components and establish consistent patterns for data flow throughout the application.