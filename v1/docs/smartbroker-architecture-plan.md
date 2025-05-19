# Reimagining SmartBroker: A Ground-Up Approach

This document outlines a plan for rebuilding the SmartBroker application with simplicity, maintainability, and future database readiness in mind.

## 1. Core Architecture

### Backend
- **RESTful API Structure**
  - Organized by resource types (companies, questions, research)
  - Clear separation between data access and business logic
  - Stateless design for scalability

### Frontend
- **Component-Based Design**
  - Small, focused components with single responsibilities
  - Shared state management without global variables
  - Clear data flow patterns (down via props, up via callbacks)

## 2. Data Model Improvements

### Company Model
```javascript
{
  id: "unique-id",
  name: "Company Name",
  profile: {
    // All fields from CSV dynamically added here
    // No assumed field structure
  },
  research: {
    status: "qualified|disqualified|in_progress",
    lastUpdated: "timestamp",
    answers: {
      // questionId: { answer, evidence, confidence, timestamp }
    }
  }
}
```

### Question Model
```javascript
{
  id: "unique-id",
  text: "Question text",
  positiveAnswer: "YES",
  note: "Research note",
  priority: 1,
  dependencies: [] // Questions that should be answered first
}
```

### Research Session Model
```javascript
{
  id: "unique-id",
  startedAt: "timestamp",
  companyId: "company-id",
  questionId: "question-id",
  status: "pending|complete",
  result: { answer, evidence, confidence }
}
```

## 3. Key Functionality Changes

### Data Import
- **CSV Agnostic Importer**
  - First-class feature, not an afterthought
  - Header detection and mapping
  - Preview and validation before import
  - Error reporting for malformed data

### Research Flow
- **Question Dependencies**
  - Smart sequencing based on logical dependencies
  - Use previously found information (owner name → owner age)
  - Cache and reuse related search results

### UI Improvements
- **Research Dashboard**
  - Focus on the company profile and current question
  - Progressive disclosure (show details only when needed)
  - Clear visual indicators of progress and status

## 4. Technical Implementation

### Backend Stack
- **Express.js** - Lightweight but powerful API framework
- **SQLite** - Simple embedded database for early stages
  - Easy migration path to PostgreSQL/MySQL later
- **Repository Pattern** - Data access abstraction for future database migration

### Frontend Implementation
- **Clean State Management**
  - Context API or lightweight state manager
  - Avoid deeply nested state objects
  - Immutable update patterns
- **Typed Interfaces** (with TypeScript or JSDoc)
  - Clear documentation of expected data shapes
  - Early error detection for data mismatches

## 5. Code Structure

### Directory Organization
```
/src
  /api          # API endpoint handlers
    companies.js
    questions.js
    research.js
  /models       # Data models and validation
    Company.js
    Question.js
    Research.js
  /services     # Business logic
    researchService.js
    importService.js
    aiService.js
  /utils        # Helper functions
    csvParser.js
    apiClient.js
  /components   # UI components
    /company
      CompanyTable.js
      CompanyDetail.js
    /research
      ResearchPrompt.js
      ResultsViewer.js
    /import
      ImportForm.js
  /hooks        # Custom React hooks
    useResearch.js
    useCompanyData.js
  /store        # State management
    companyStore.js
    researchStore.js
  App.js        # Application entry point
```

## 6. Key Simplifications

1. **Flat Data Access**
   - Direct paths to access data (`company.profile.website` vs `getCompanyField(company, "website")`)
   - Explicit data transformations where needed

2. **Explicit State Transitions**
   - Clear functions for state changes (startResearch, completeResearch)
   - No implicit state changes hidden in UI callbacks

3. **Decoupled Components**
   - Research logic separate from display logic
   - API interaction separate from data processing

4. **Consistent Patterns**
   - Same pattern for all API calls
   - Same pattern for all state updates
   - Same pattern for all component structures

## 7. Database Preparation

1. **ID-Based References**
   - Use IDs to reference entities instead of array indices
   - Prepare for relational or document database models

2. **Data Validation**
   - Schema validation for incoming data
   - Clear error handling for invalid data

3. **Transactions**
   - Group related operations (research update + status change)
   - Ensure data consistency

4. **Pagination**
   - Design list views to work with paginated data from the beginning
   - Don't assume all data fits in memory

## Why This Approach Works Better

1. **Simplicity** - Clear patterns make code easier to understand
2. **Maintainability** - Isolated components can be updated independently
3. **Scalability** - Stateless design supports multiple users
4. **Future-Proofing** - Database-ready patterns from the start
5. **Adaptability** - Dynamic data structures embrace changing requirements

## Implementation Phases

### Phase 1: Core Data Models & API
- Implement basic data models
- Create RESTful API endpoints
- Set up in-memory storage with ID-based references

### Phase 2: Research Workflow
- Implement research process with question dependencies
- Add AI integration for answering questions
- Create research state management

### Phase 3: CSV Import & UI
- Build CSV import functionality
- Create dynamic company profile display
- Implement research dashboard

### Phase 4: Database Integration
- Add SQLite database
- Implement data repository pattern
- Migrate in-memory storage to database

Each phase builds on the previous while maintaining a working application throughout the process.