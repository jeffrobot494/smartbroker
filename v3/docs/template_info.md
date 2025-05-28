# SmartBroker v3 - Template System Documentation

## Overview

The template system allows SmartBroker to support multiple research configurations, each containing:
- **System Prompt**: Instructions for Claude LLM on how to analyze companies
- **Criteria Set**: List of research questions/requirements to evaluate companies against
- **Research Results**: Persistent storage tied to specific template versions with confidence scoring

This enables users to create different research profiles (e.g., "SaaS Acquisition", "Manufacturing Due Diligence", "Startup Evaluation") and switch between them seamlessly across any frontend interface.

## Database Schema

### Templates Table
```sql
CREATE TABLE templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    system_prompt TEXT NOT NULL,
    is_active INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
- **id**: Primary key for template identification
- **name**: Human-readable template name (must be unique)
- **system_prompt**: Full LLM instructions for this research approach
- **is_active**: Boolean flag (only one template can be active at a time)
- **created_at**: Creation timestamp

### Criteria Table
```sql
CREATE TABLE criteria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    first_query_template TEXT,
    answer_format TEXT NOT NULL,
    disqualifying INTEGER DEFAULT 0,
    order_index INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
    UNIQUE(template_id, name),
    UNIQUE(template_id, order_index)
);
```
- **template_id**: Links criterion to specific template
- **name**: Short criterion identifier (e.g., "Revenue Growth")
- **description**: Full research question
- **first_query_template**: Optional automatic Perplexity query with company placeholders
- **answer_format**: Expected response format for Claude
- **disqualifying**: If true, negative result disqualifies company
- **order_index**: User-defined execution order within template (set during creation)

### Research Results Table
```sql
CREATE TABLE research_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    company_id INTEGER NOT NULL,
    criterion_id INTEGER NOT NULL,
    answer TEXT NOT NULL,
    explanation TEXT,
    confidence_score INTEGER CHECK(confidence_score >= 1 AND confidence_score <= 3),
    result_type TEXT DEFAULT 'research',
    iterations INTEGER DEFAULT 1,
    tool_calls INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (criterion_id) REFERENCES criteria(id) ON DELETE CASCADE,
    UNIQUE(template_id, company_id, criterion_id)
);
```
- **confidence_score**: 1-3 scale indicating Claude's confidence in the research result:
  - **1**: 0-60% chance this is true (just a guess)
  - **2**: 61-79% chance this is true (probably)
  - **3**: 80-100% chance this is true (very likely)

## Template Lifecycle

### 1. Template Loading (Current Implementation)
```javascript
// Backend API endpoint independent of frontend
GET /api/template/active
// Returns: { id, name, systemPrompt, criteria: [...] }

// Research engine initialization
const templateData = await this.template.getActiveTemplate();
this.currentTemplate = templateData;
this.currentCriteria = templateData.criteria.sort((a, b) => a.order_index - b.order_index);
```

**Flow**:
1. Any frontend calls template API endpoint
2. Backend fetches active template + associated criteria (ordered by order_index)
3. Research engine stores template data for research operations
4. System prompt and criteria become available for research execution

### 2. Template Management API (TODO: Step 2)
**Backend API Endpoints** (Frontend Independent):
```javascript
GET    /api/templates                    // List all templates
POST   /api/templates                    // Create new template
PUT    /api/templates/:id/activate       // Switch active template  
DELETE /api/templates/:id               // Delete template
GET    /api/template/:id                // Get specific template
PUT    /api/template/:id                // Update template
```

**Template Switching Flow**:
1. Frontend calls `PUT /api/templates/:id/activate`
2. Backend deactivates current template, activates selected one
3. Backend returns success/error response
4. Frontend refreshes template data via `GET /api/template/active`
5. Research engine reinitializes with new template

### 3. Template Creation API (TODO: Step 2)
**Backend Implementation**:
```javascript
POST /api/templates
Body: { 
    name: "New Template Name",
    basedOnTemplateId: 1,  // Optional: copy from existing
    makeActive: true       // Optional: activate immediately
}
```

**Creation Logic**:
```javascript
async createTemplate(name, basedOnTemplateId = null, makeActive = false) {
    // 1. Create new template record
    // 2. If basedOnTemplateId: copy all criteria with preserved order_index
    // 3. If makeActive: deactivate others and activate new template
    // 4. Return complete template data
}
```

### 4. Template Deletion API (TODO: Step 2)
**Backend Constraints**:
- Cannot delete active template (must switch first)
- Cannot delete if only one template exists
- Deletion cascades to criteria and research results

```javascript
DELETE /api/templates/:id
// Returns: { success: boolean, message: string, remainingCount: number }
```

## Criteria Management

### Criteria Creation with User-Defined Order
**Backend API** (TODO: Step 3):
```javascript
POST /api/templates/:templateId/criteria
Body: {
    name: "Revenue Growth",
    description: "Has the company shown consistent revenue growth?",
    first_query_template: "{company_name} revenue growth financial performance",
    answer_format: "Yes/No with percentage growth rate",
    disqualifying: false,
    order_index: 3  // User sets execution order during creation
}
```

**Order Index Validation**:
- Must be unique within template
- System suggests next available index
- Gaps allowed (1, 3, 5, etc.)
- Frontend can show reordering interface

### Simplified Placeholder Substitution

#### Company Data Placeholders (Only System)
```javascript
const companyPlaceholders = {
    '{company_name}': companyData.Company,
    '{city}': companyData.City,
    '{state}': companyData.State,
    '{website}': companyData.Website,
    '{linkedin}': companyData.LinkedIn,
    '{phone}': companyData.Phone,
    '{revenue}': companyData['Revenue ($M)'],
    '{president_owner_ceo}': companyData['President/Owner/CEO']
};
```

**Implementation Logic**:
```javascript
function substitutePlaceholders(text, companyData) {
    let result = text;
    
    // Simple string replacement for company data
    Object.entries(companyPlaceholders).forEach(([placeholder, value]) => {
        result = result.replace(new RegExp(placeholder, 'g'), value || '');
    });
    
    return result;
}
```

**Usage Example**:
```javascript
// Criterion first_query_template:
"{company_name} {city} {state} financial performance revenue"

// Becomes:
"Acme Corp Denver Colorado financial performance revenue"
```

### Criteria Management API (TODO: Step 3)
```javascript
GET    /api/templates/:id/criteria          // List criteria for template
POST   /api/templates/:id/criteria          // Create new criterion
PUT    /api/criteria/:id                    // Update criterion
DELETE /api/criteria/:id                   // Delete criterion
PUT    /api/criteria/:id/reorder           // Change order_index
```

## Research Result Persistence with Confidence

### Enhanced Result Storage
```javascript
await this.research.saveResult(
    companyName, 
    criterion.id,
    {
        answer: result.answer,
        explanation: result.explanation,
        confidence_score: result.confidence_score  // 1-3 scale
    },
    companyData, 
    templateId
);
```

### Confidence Score Integration
**Claude Prompt Enhancement**:
```
... [existing prompt] ...

Additionally, provide a confidence score from 1-3 indicating how certain you are about this assessment:
- 1: Just a guess (0-60% chance this is true) - Limited or unclear information
- 2: Probably correct (61-79% chance this is true) - Some evidence but gaps remain  
- 3: Very likely correct (80-100% chance this is true) - Strong evidence supports conclusion

Format your confidence as "Confidence: [1|2|3]" at the end of your response.
```

**Result Processing**:
```javascript
// Research engine extracts confidence from Claude response
const confidence = extractConfidenceScore(claudeResponse); // Parse "Confidence: 2" etc.
const result = {
    answer: extractAnswer(claudeResponse),
    explanation: extractExplanation(claudeResponse),
    confidence_score: confidence
};
```

## Frontend Independence Architecture

### Complete API Abstraction
All functionality accessible via REST APIs - no terminal-specific code in core business logic.

**Research Operations**:
```javascript
// Research execution (frontend-agnostic)
POST /api/research/execute
Body: { companyNames: [...], criteriaIds: [...] }
// Returns: { success: boolean, results: [...] }

// Results retrieval  
GET /api/research/results?templateId=1&companyId=2
```

**Template Operations**:
```javascript
// All template management via API
GET|POST|PUT|DELETE /api/templates/*
GET|POST|PUT|DELETE /api/criteria/*
```

### Frontend Interface Patterns
**Terminal Interface** (Current):
```javascript
// Terminal calls API, displays text-based results
const result = await api.executeResearch(companies, criteria);
displayResults(result.results);
```

**Future GUI Interface**:
```javascript
// GUI calls same APIs, displays in rich interface
const result = await api.executeResearch(companies, criteria);
renderResultsGrid(result.results);
```

**Mobile/Web Interface**:
```javascript
// Same APIs work for any frontend
fetch('/api/research/execute', {
    method: 'POST',
    body: JSON.stringify({ companyNames, criteriaIds })
}).then(data => updateUI(data.results));
```

## Implementation Architecture

### Backend Services (Frontend Independent)
**TemplateService** (`server/services/template-service.js`):
```javascript
class TemplateService {
    async getTemplates()
    async getActiveTemplate()
    async createTemplate(name, basedOnId, makeActive)
    async deleteTemplate(id)
    async setActiveTemplate(id)
}
```

**CriteriaService** (`server/services/criteria-service.js`):
```javascript
class CriteriaService {
    async getCriteria(templateId)
    async createCriterion(templateId, criterionData)
    async updateCriterion(id, updates)
    async deleteCriterion(id)
    async reorderCriterion(id, newOrderIndex)
}
```

**ResearchService** (`server/services/research-service.js`):
```javascript
class ResearchService {
    async executeResearch(templateId, companyIds, criteriaIds)
    async getResults(templateId, companyId, criterionId)
    async getCompanyResults(templateId, companyId)
}
```

### Client Adapters (Frontend Specific)
**Terminal Adapter** (`src/adapters/terminal-adapter.js`):
- Calls backend services
- Formats for console display
- Handles readline input

**GUI Adapter** (Future: `gui/adapters/gui-adapter.js`):
- Calls same backend services
- Updates visual components
- Handles click/form events

## Advanced Features

### Confidence-Based Analysis
**Result Quality Metrics**:
- Low confidence (1) results can trigger manual review flags
- High confidence (3) results can be automatically accepted
- Confidence distribution helps assess template effectiveness

**Template Analytics**:
```javascript
GET /api/templates/:id/analytics
// Returns: { avgConfidence, confidenceDistribution: {1: 5, 2: 12, 3: 8}, disqualificationRate, etc. }
```

### Result Validation
**Confidence Thresholds**:
- Configurable confidence requirements per template
- Automatic flagging of low-confidence results
- Batch processing can skip low-confidence companies

## Implementation Priority

1. **Step 2A - Database Schema Updates**
   - Add confidence_score (1-3) to research_results
   - Update criteria creation to accept order_index

2. **Step 2B - Backend API Foundation**
   - Template management endpoints
   - Frontend-independent service layer
   - Simplified research execution APIs

3. **Step 2C - Terminal Interface Updates**
   - Update terminal to call new APIs
   - Template switching and creation menus
   - Display confidence scores in results

4. **Step 3 - Advanced Features**
   - Criteria editing with order management
   - System prompt editing
   - Confidence-based analytics

This streamlined architecture maintains powerful template functionality while keeping the system simple and ensuring complete frontend independence.