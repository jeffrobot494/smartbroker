# Technical Transition Guide

This guide provides practical advice for transitioning from the current SmartBroker implementation to the new architecture.

## Current vs. New Architecture

### Current Architecture
- **Data Structure**: Flat company objects with fixed fields
- **State Management**: Global `investigationState` object with nested arrays
- **Index-Based Access**: Companies and questions accessed by array indices
- **CSV Loading**: Fixed field mapping in server code
- **UI Integration**: Direct DOM manipulation based on global state

### New Architecture
- **Data Structure**: Flexible company objects with dynamic profile fields
- **State Management**: Modular store with object-based access
- **ID-Based Access**: Companies and questions accessed by unique IDs
- **CSV Loading**: Dynamic field mapping based on headers
- **UI Integration**: Component-based with clear data flow

## Transition Strategy

### 1. Introduce IDs Without Breaking Existing Code

```javascript
// Step 1: Add IDs while maintaining array indices
function enhanceCompanyData(companies) {
  return companies.map((company, index) => ({
    id: `co_${Date.now()}_${index}`,  // Add unique ID
    ...company,                       // Keep all existing fields
    _index: index                     // Store original index for backward compatibility
  }));
}

// Step 2: Add accessor functions that work with both IDs and indices
function getCompany(idOrIndex) {
  if (typeof idOrIndex === 'number') {
    // Support old index-based access
    return companies[idOrIndex];
  }
  
  // Support new ID-based access
  return companies.find(company => company.id === idOrIndex);
}
```

### 2. Refactor CSV Import Without Breaking Existing Fields

```javascript
// Current implementation
function loadCompanyData() {
  // ...existing code...
  const company = {
    companyName: data['Company'] || '',
    website: data['Website'] ? data['Website'].replace('http://', '').replace('https://', '') : '',
    // other fields...
  };
  
  // New implementation - keeps backward compatibility
  function loadCompanyData() {
    // ...existing code...
    const profile = {};
    
    // Store all fields in profile
    Object.keys(data).forEach(key => {
      profile[key] = data[key];
    });
    
    const company = {
      id: generateUniqueId(),
      // Keep original fields for backward compatibility
      companyName: data['Company'] || '',
      website: data['Website'] ? data['Website'].replace('http://', '').replace('https://', '') : '',
      // Add new structure
      name: data['Company'] || '',
      profile,
      research: {
        status: 'not_started',
        answers: {}
      }
    };
  }
}
```

### 3. Introduce Research Results Structure

```javascript
// Current structure
investigationState.results[companyIndex].answers[questionIndex] = answer;

// Transition structure
function saveResearchResult(companyId, questionId, result) {
  const company = getCompany(companyId);
  
  // Initialize if needed
  if (!company.research) {
    company.research = { status: 'in_progress', answers: {} };
  }
  
  // Store by question ID
  company.research.answers[questionId] = {
    answer: result.answer,
    evidence: result.evidence,
    confidence: result.confidence,
    timestamp: new Date().toISOString()
  };
  
  // Also update old structure for backward compatibility
  if (company._index !== undefined && investigationState.results[company._index]) {
    const questionIndex = questions.findIndex(q => q.id === questionId);
    if (questionIndex !== -1) {
      investigationState.results[company._index].answers[questionIndex] = result.answer;
    }
  }
}
```

### 4. Gradual UI Component Refactoring

```javascript
// Current approach (simplified)
function updateCompanyTable() {
  companyDataTbody.innerHTML = '';
  investigationState.companies.forEach((company, index) => {
    const row = document.createElement('tr');
    // ...populate row...
    companyDataTbody.appendChild(row);
  });
}

// Transition approach
function createCompanyTable(companies, container) {
  // Clear container
  container.innerHTML = '';
  
  // Create table element
  const table = document.createElement('table');
  table.className = 'company-data-table';
  
  // Create header
  const thead = document.createElement('thead');
  // ...populate header...
  
  // Create body
  const tbody = document.createElement('tbody');
  companies.forEach(company => {
    const row = createCompanyRow(company);
    tbody.appendChild(row);
  });
  
  // Assemble and return
  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);
  
  return table;
}

// Call from old code
function updateCompanyTable() {
  createCompanyTable(investigationState.companies, companyDataTbody.parentElement);
}
```

## Phased Migration Plan

### Phase 1: Enhanced Data Structures
- Add IDs to all entities while maintaining indices
- Add profile storage for all CSV fields
- Create accessor functions that work with both access methods
- Refactor CSV import to populate new structures

### Phase 2: API Refactoring
- Create new API endpoints alongside existing ones
- Implement ID-based access in new endpoints
- Add storage interface layer
- Begin migrating endpoint callers one by one

### Phase 3: UI Component Refactoring
- Create component functions that take data and return elements
- Replace direct DOM manipulations with component renders
- Implement event delegation pattern for cleaner event handling
- Keep global state updates for backward compatibility

### Phase 4: State Management Overhaul
- Implement proper state stores with setter/getter methods
- Migrate global state updates to use store methods
- Add validation in store methods
- Remove direct manipulation of state objects

## Testing During Transition

For each change:

1. Verify existing functionality continues to work
2. Test for regressions in the main workflow
3. Add tests for new functionality
4. Test edge cases in both old and new implementations

## Helpful Migration Functions

### ID Generation and Management

```javascript
// Generate a unique ID for an entity
function generateUniqueId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Add IDs to existing entities
function addIdsToEntities(entities, prefix) {
  return entities.map((entity, index) => ({
    id: generateUniqueId(prefix),
    _index: index,
    ...entity
  }));
}
```

### State Migration

```javascript
// Convert index-based results to ID-based
function migrateResearchResults(results, companies, questions) {
  const idBasedResults = {};
  
  results.forEach((result, companyIndex) => {
    if (!result) return;
    
    const company = companies.find(c => c._index === companyIndex);
    if (!company) return;
    
    idBasedResults[company.id] = {
      status: result.status,
      answers: {}
    };
    
    result.answers.forEach((answer, questionIndex) => {
      if (!answer) return;
      
      const question = questions.find(q => q._index === questionIndex);
      if (!question) return;
      
      idBasedResults[company.id].answers[question.id] = {
        answer,
        timestamp: new Date().toISOString()
      };
    });
  });
  
  return idBasedResults;
}
```

### Backwards Compatibility Layer

```javascript
// Create facade functions that work with both old and new approaches
const compatLayer = {
  getCompany(idOrIndex) {
    // Support both access methods
  },
  
  getQuestion(idOrIndex) {
    // Support both access methods
  },
  
  getResearchResult(companyIdOrIndex, questionIdOrIndex) {
    // Support both access methods
  },
  
  updateResearchResult(companyIdOrIndex, questionIdOrIndex, result) {
    // Update in both structures
  }
};
```

By following this transition guide, you can gradually move from the current architecture to the new one without breaking existing functionality. Each phase builds on the previous one, ensuring a smooth migration path.