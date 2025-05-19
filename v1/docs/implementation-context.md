# Implementation Context for SmartBroker Architecture

This document provides critical context for implementing the new SmartBroker architecture.

## Application Purpose & Core Workflow

SmartBroker is a tool that helps users research software companies based on specific criteria questions. The core workflow is:

1. Load a list of companies (from CSV)
2. For each company, answer a series of qualification questions using AI-powered research
3. Track which companies meet all criteria ("qualified") vs those that don't ("disqualified")

## Key Requirements

- **Dynamic Data Structure**: The CSV structure will vary; the system must adapt to any columns
- **Research Flow**: Questions have dependencies (e.g., find owner name before researching owner age)
- **AI Integration**: Uses Claude AI to research companies based on prompts
- **Simple UI**: Focuses on a data table with research results for easy scanning

## Current Implementation Details

### API Endpoints Needed

1. **Company Data**
   - `GET /api/companies` - List all companies
   - `POST /api/companies/import` - Import companies from CSV

2. **Questions**
   - `GET /api/questions` - Get all qualification questions

3. **Research**
   - `POST /api/research` - Research a specific company for a specific question
   - `GET /api/research/status/:companyId` - Get research status for a company

### AI Research Process

1. Generate a prompt using:
   - Company information
   - The question being researched
   - Previous findings (for dependent questions)

2. Send prompt to Claude API

3. Parse Claude's response to extract:
   - YES/NO answer or specific information (like owner name)
   - Confidence level
   - Evidence/reasoning

### CSV Import Requirements

- Handle varied column names and structures
- Map essential fields (Company Name, Website) to system fields
- Store all other fields without assuming structure
- Generate unique IDs for each company

## Technical Constraints

- **Frontend**: Vanilla JavaScript (no framework required)
- **Backend**: Node.js with Express
- **Database**: Start with in-memory, prepare for SQLite
- **API**: All communication should be through RESTful API calls

## Critical Dependencies & Patterns

1. **ID-Based References**
   ```javascript
   // Instead of:
   investigationState.results[companyIndex]
   
   // Use:
   getResearchResults(companyId)
   ```

2. **Question Dependencies**
   ```javascript
   // Example question dependency
   {
     id: "q3", 
     text: "Is the owner at least 50 years old?",
     dependencies: ["q2"] // Depends on "Who is the owner?"
   }
   ```

3. **Research State Machine**
   ```
   NOT_STARTED → IN_PROGRESS → COMPLETED → QUALIFIED/DISQUALIFIED
   ```

4. **Response Format Standardization**
   ```javascript
   // All API responses should follow:
   {
     success: true/false,
     data: {...} or [...],
     error: "Error message if applicable"
   }
   ```

## Implementation Priorities

1. First establish core data models and storage
2. Then implement basic API endpoints
3. Create simple UI for company display and research
4. Add CSV import functionality
5. Enhance with relationship handling between questions

## Common Pitfalls to Avoid

1. Don't rely on array indices for company/question references
2. Don't assume specific CSV column names or structure
3. Don't tightly couple UI components to data structure
4. Don't mix research logic with display logic
5. Don't store state in global variables without proper management

## Testing Approach

For each component:
1. Test with sample company data from CSV
2. Verify research with simple questions first
3. Test question dependencies to ensure proper flow
4. Validate CSV import with various column structures

## Useful References & Examples

### Company Object Example
```javascript
{
  id: "co_12345",
  name: "Acme Corp",
  profile: {
    Website: "acmecorp.com",
    LinkedIn: "linkedin.com/company/acmecorp",
    "Annual Revenue": "$2.5M",
    // Any other CSV columns...
  },
  research: {
    status: "in_progress",
    answers: {
      "q1": { answer: "YES", confidence: "HIGH", timestamp: "2023-05-18T14:30:00Z" },
      "q2": { answer: "John Smith", confidence: "MEDIUM", timestamp: "2023-05-18T14:32:00Z" }
    }
  }
}
```

### CSV Import Handling Example
```javascript
function processCSVRow(headers, row) {
  const id = generateUniqueId();
  const profile = {};
  
  // Dynamically create profile from all CSV columns
  headers.forEach((header, index) => {
    profile[header] = row[index];
  });
  
  // Extract name from profile for convenience
  const name = profile["Company"] || profile["Company Name"] || "Unknown Company";
  
  return {
    id,
    name,
    profile,
    research: {
      status: "not_started",
      answers: {}
    }
  };
}
```

### Research Prompt Format
```javascript
function generatePrompt(company, question, previousFindings) {
  return `
    I need information about the company "${company.name}".
    
    COMPANY DETAILS:
    ${formatCompanyDetails(company)}
    
    ${previousFindings ? `PREVIOUS FINDINGS:\n${formatPreviousFindings(previousFindings)}\n` : ''}
    
    QUESTION: ${question.text}
    
    ${question.note ? `NOTE: ${question.note}` : ''}
    
    Please provide a direct answer with your confidence level and supporting evidence.
  `;
}
```