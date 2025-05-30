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

## Implementation Status

### ✅ COMPLETED: Step 2A - Database Schema Updates
**Status**: Fully implemented and tested
- ✅ Added confidence_score (1-3) to research_results table with CHECK constraint
- ✅ Added UNIQUE(template_id, order_index) constraint to criteria table
- ✅ Updated ResearchDAO to handle confidence_score in all CRUD operations
- ✅ Database recreates properly with new schema

### ✅ COMPLETED: Step 2B - Backend API Foundation  
**Status**: Fully implemented and tested (14/14 tests passing)
- ✅ Extended ResearchDAO with 4 template management methods:
  - `getTemplates()` - List all templates
  - `createTemplate(name, basedOnId, makeActive)` - Create with optional copying
  - `setActiveTemplate(id)` - Switch active template with exclusive activation
  - `deleteTemplate(id)` - Delete with safety constraints
- ✅ Added 4 server API endpoints: GET/POST/PUT/DELETE `/api/templates/*`
- ✅ Extended TemplateClient with 4 corresponding frontend methods
- ✅ Template creation copies system prompt + all criteria with preserved order_index
- ✅ Business rule enforcement: unique names, can't delete active/last template
- ✅ Frontend-independent JSON APIs ready for any interface

### ✅ COMPLETED: Step 2C - Terminal Interface Updates
**Status**: Fully implemented with proper separation of concerns
- ✅ **Business Logic in ResearchEngine** (4 methods, 40 lines):
  - `getTemplateList()` - Template listing
  - `switchToTemplate(id)` - Switch and reload engine  
  - `createNewTemplate(name, basedOnId, makeActive)` - Creation with copying
  - `removeTemplate(id)` - Deletion
- ✅ **UI Logic in TerminalInterface** (5 methods, 195 lines):
  - `editTemplates()` - Main template management menu
  - `displayTemplateMenu()` - Pure display logic
  - `switchTemplateFlow()` - Template switching workflow
  - `createTemplateFlow()` - Template creation workflow  
  - `deleteTemplateFlow()` - Template deletion workflow
- ✅ Template switching automatically reloads research engine
- ✅ User confirmations for destructive actions
- ✅ Error handling with user-friendly messages
- ✅ Confidence scores display in research results (verbosity 2+)

### 🐛 FIXED: Template Isolation Bug
**Issue**: Templates were sharing research results instead of maintaining isolation
**Root Cause**: `getCompanyResults()` wasn't filtering by template_id during research duplicate detection
**Fix Applied**:
- ✅ Updated `ResearchDAO.getCompanyResults(companyName, templateId)` to filter by template
- ✅ Updated `ResearchClient.getCompanyResults(companyName, templateId)` to pass template parameter
- ✅ Updated server API endpoint to accept `?templateId=` query parameter
- ✅ Updated research engine to pass current template ID in all calls
- ✅ Now templates maintain completely isolated research results

### 🎯 TODO: Step 3 - Advanced Features
**Next Implementation Priority**: System Prompt and Criteria Editing

#### **CRITICAL: Architecture Pattern for Step 3**
**🚨 MAINTAIN SEPARATION OF CONCERNS**: It is essential that Step 3 follows the established architecture pattern:

1. **Business Logic → ResearchEngine**: Add methods for prompt/criteria operations
2. **UI Logic → TerminalInterface**: Add workflow methods for user interaction
3. **API Layer → Server + Client**: Ensure all functionality accessible via APIs

**Why This Matters**: The GUI integration depends on this separation. Terminal UI should only handle user interaction (prompts, displays, navigation), while all business operations must be accessible through ResearchEngine methods. This allows future GUI components to call the same business logic methods without any terminal-specific dependencies.

**Example Pattern**:
```javascript
// ✅ CORRECT - Business logic in ResearchEngine
async updateSystemPrompt(templateId, newPrompt) {
  // Business logic here
}

// ✅ CORRECT - UI logic in TerminalInterface  
async editSystemPromptFlow() {
  // User interaction, delegates to engine
  const newPrompt = await this.promptUser('Enter prompt:');
  await this.engine.updateSystemPrompt(templateId, newPrompt);
}

// ❌ WRONG - Business logic mixed with UI
async editSystemPrompt() {
  const prompt = await this.promptUser('Enter prompt:');
  await axios.put('/api/template/prompt', {prompt}); // API call in UI!
}
```

#### **3A. System Prompt Editing** (High Priority)
**Goal**: Allow editing of template system prompts via terminal interface
**Current Status**: Placeholder method exists in `terminal-interface.js:575`

**Implementation Requirements**:
1. **Backend API Endpoints**:
   ```javascript
   GET /api/template/:id/prompt     // Get system prompt for editing
   PUT /api/template/:id/prompt     // Update system prompt
   ```

2. **ResearchDAO Methods**:
   ```javascript
   async getTemplatePrompt(templateId)
   async updateTemplatePrompt(templateId, newPrompt)
   ```

3. **ResearchEngine Methods** (Business Logic):
   ```javascript
   async getSystemPrompt(templateId)
   async updateSystemPrompt(templateId, newPrompt)  // Include engine reload
   ```

4. **Terminal Interface** (UI Logic Only):
   - Multi-line text editor (handle newlines, long text)
   - Show current prompt for editing
   - Confirmation before saving changes
   - Delegate all business operations to ResearchEngine

5. **Technical Considerations**:
   - System prompts are long (1000+ characters)
   - Need proper text input handling in terminal
   - Validate prompt is not empty
   - Consider showing character count/validation

#### **3B. Criteria Editing** (High Priority)
**Goal**: Full CRUD operations on criteria within templates
**Current Status**: Placeholder method exists in `terminal-interface.js:587`

**Implementation Requirements**:
1. **Backend API Endpoints**:
   ```javascript
   GET /api/templates/:id/criteria           // List criteria (already exists via template)
   POST /api/templates/:id/criteria          // Create new criterion
   PUT /api/criteria/:id                     // Update criterion
   DELETE /api/criteria/:id                  // Delete criterion  
   PUT /api/criteria/:id/reorder            // Change order_index
   ```

2. **ResearchDAO Methods**:
   ```javascript
   async createCriterion(templateId, criterionData)
   async updateCriterion(criterionId, updates)
   async deleteCriterion(criterionId)
   async reorderCriterion(criterionId, newOrderIndex)
   async getNextAvailableOrderIndex(templateId)
   ```

3. **ResearchEngine Methods** (Business Logic):
   ```javascript
   async addCriterion(templateId, criterionData)
   async modifyCriterion(criterionId, updates)
   async removeCriterion(criterionId)
   async reorderCriteria(criterionId, newOrderIndex)
   // All methods should reload engine if current template affected
   ```

4. **Terminal Interface Workflows** (UI Logic Only):
   - **List Criteria**: Show current criteria with order_index, disqualifying flags
   - **Add Criterion**: Form-like input for all fields (name, description, query template, etc.)
   - **Edit Criterion**: Select and modify existing criterion
   - **Delete Criterion**: With confirmation and research result cleanup warning
   - **Reorder Criteria**: Allow changing execution order
   - Delegate all business operations to ResearchEngine

5. **Criterion Fields** (from database schema):
   ```javascript
   {
     name: string,                    // Short identifier
     description: string,             // Full research question
     first_query_template: string,    // Optional Perplexity query with {placeholders}
     answer_format: string,           // Expected response format
     disqualifying: boolean,          // Whether negative result disqualifies company
     order_index: integer            // User-defined execution order
   }
   ```

6. **Technical Considerations**:
   - Order index management (prevent duplicates, suggest next available)
   - Research result cleanup when criteria are deleted
   - Validation of criterion fields
   - Automatic research engine reload after criteria changes

#### **3C. Confidence-Based Analytics** (Lower Priority)
**Goal**: Provide insights on research confidence and template effectiveness

**Implementation Ideas**:
1. **Analytics API**:
   ```javascript
   GET /api/templates/:id/analytics
   // Returns: { avgConfidence, confidenceDistribution, disqualificationRate, etc. }
   ```

2. **Confidence Reporting**:
   - Average confidence per template
   - Confidence distribution (count of 1s, 2s, 3s)
   - Low confidence flagging
   - Template effectiveness metrics

### **Current Working Features** ✅
- **Database-driven templates and criteria**: Complete template isolation
- **Template management**: Create, switch, delete templates via terminal
- **Research execution**: With confidence scores (1-3 scale) displayed at verbosity 2+
- **Automatic first queries**: With company placeholder substitution
- **Research result persistence**: Template-isolated with confidence tracking
- **Database-driven disqualification**: Based on negative results for disqualifying criteria
- **Clear research data**: With confirmation prompts

### **Architecture Notes for Step 3**
- **🚨 CRITICAL: Follow established separation patterns**: Business logic in ResearchEngine, UI logic in TerminalInterface
- **Reuse existing APIs**: Template switching, research engine reloading
- **Maintain frontend independence**: All business logic accessible via APIs for future GUI
- **Error handling**: Consistent with existing patterns
- **User experience**: Confirmation prompts for destructive actions, clear navigation

### **Testing Approach**
- **Manual testing**: Via terminal interface Edit Options menus
- **API testing**: Create test scripts similar to `test-step2b.js`
- **Database validation**: Ensure constraints and relationships work correctly
- **Integration testing**: Verify research engine reloads and template isolation

This completes the database-driven template system foundation. Step 3 will add the final editing capabilities to make the system fully user-configurable while maintaining the architecture that enables seamless GUI integration.