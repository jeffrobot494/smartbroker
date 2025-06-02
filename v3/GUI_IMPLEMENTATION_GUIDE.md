# SmartBroker v3 GUI Implementation Guide

## Project Overview
SmartBroker v3 is a company research tool that uses Claude LLM and Perplexity to analyze companies against custom criteria to determine acquisition potential. The project has a **fully functional terminal interface** and we're now building a **web GUI** that connects to the existing backend.

## Current Implementation Status

### ✅ COMPLETED - CSV Upload & Table Display
- **CSV Upload**: Users can upload CSV files, which are converted to JSON and saved to the database per template
- **Company Table**: Dynamic table populated with companies and criterion columns
- **Template Loading**: Active template with criteria loads automatically on page startup

### 🔄 NEXT TASK - Criteria Selection Checkboxes
Need to implement checkboxes that allow users to select which criteria to research, replacing the current hardcoded checkboxes with dynamic ones from the template.

### 🔮 FUTURE TASKS
1. Company range selection validation
2. Start/Stop research functionality 
3. Real-time progress updates in table cells
4. Output tab implementation
5. Options tab implementation

## Architecture Overview

### Backend (Node.js + Express + SQLite)
- **Server**: `server/server.js` - Express API with endpoints
- **Database**: SQLite with templates, criteria, companies, research_results tables
- **DAO**: `server/dao/research-dao.js` - Database operations
- **APIs**: Claude (Anthropic), Perplexity, PhantomBuster integrations

### Frontend (Vanilla JS + HTML + CSS)
- **Modular Structure**: Separate JS files for each tab
- **No Frameworks**: Pure JavaScript, HTML, CSS (no React/Vue/etc.)
- **File Structure**:
  ```
  public/
  ├── index.html
  ├── styles.css
  └── js/
      ├── main_gui.js      # App coordinator & shared utilities
      ├── research_gui.js  # Research tab functionality
      ├── output_gui.js    # Output tab (placeholder)
      └── options_gui.js   # Options tab (placeholder)
  ```

## Database Schema

### Templates Table
```sql
CREATE TABLE templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  system_prompt TEXT NOT NULL,
  company_data TEXT DEFAULT NULL,  -- JSON array of companies
  is_active BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Criteria Table
```sql
CREATE TABLE criteria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  first_query_template TEXT,
  answer_format TEXT NOT NULL,
  disqualifying BOOLEAN DEFAULT 0,
  order_index INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
)
```

## Key API Endpoints

### Template & Company Data
- `GET /api/template/active` - Get active template with criteria and companies
- `POST /api/template/:id/companies` - Upload CSV and save company data
- `GET /api/template/:id/companies` - Get company data for template

### Research (Existing - Ready to Connect)
- `POST /api/research` - Save research results
- `GET /api/research/company/:name` - Get results for a company
- `GET /api/research/costs` - Get cost summary

## Current File Status

### main_gui.js (App Coordinator)
```javascript
class SmartBrokerApp {
  constructor() {
    this.template = null;      // Active template with criteria & companies
    this.companies = [];       // Company array from template
    this.isResearching = false; // Research state
  }
  
  async loadTemplate() // Loads active template from API
  setupTabSwitching()  // Handles tab navigation
  notifyDataChanged()  // Notifies all tabs when data changes
  showNotification()   // Simple notification system
}
```

### research_gui.js (Research Tab)
```javascript
class ResearchGUI {
  // ✅ COMPLETED FUNCTIONS
  async importCompanies()     // CSV upload functionality
  updateTableHeaders()       // Dynamic headers from criteria
  populateCompanyTable()     // Company rows with progress cells
  
  // 🔄 NEXT TO IMPLEMENT
  populateCriteriaCheckboxes() // Dynamic checkboxes from template
  updateSelectedCriteria()     // Track which criteria are selected
  
  // 🔮 FUTURE FUNCTIONS
  startResearch()            // Validate inputs & start research
  updateTableProgress()      // Update cells during research
  exportResults()           // Export research results
}
```

## Data Flow Examples

### Page Load Flow
```
1. main_gui.js loads → Creates ResearchGUI instance
2. loadTemplate() → GET /api/template/active
3. template loaded → notifyDataChanged()
4. ResearchGUI.onDataChanged() → updateTableHeaders() + populateCompanyTable()
5. Table displays companies with criterion columns
```

### CSV Import Flow
```
1. User selects CSV → File selected event
2. User clicks Import → importCompanies()
3. POST /api/template/:id/companies with FormData
4. Server parses CSV → Saves to template.company_data
5. loadTemplate() → Refresh data
6. Table updates with new companies
```

## Current HTML Structure

### Research Tab (index.html)
```html
<div class="criteria-selection">
  <h3>Research Criteria</h3>
  <div class="criteria-grid" id="criteria-grid">
    <!-- Dynamic checkboxes will go here -->
  </div>
</div>

<table class="progress-table">
  <thead>
    <tr><!-- Dynamic headers from updateTableHeaders() --></tr>
  </thead>
  <tbody id="progress-table-body">
    <!-- Dynamic company rows from populateCompanyTable() -->
  </tbody>
</table>
```

## Existing Research Engine (Terminal)

### Terminal Interface Logic (Reference)
The terminal interface in `src/terminal-interface.js` shows the complete research flow:

1. **Multi-Criteria Selection**: Recently updated to support comma-separated criterion selection (e.g., "1,3,5" or "all")
2. **Range Parsing**: `parseRange()` function handles "1-10" format
3. **Research Execution**: `researchCompanyRange()` method in research engine
4. **Progress Callbacks**: Real-time progress updates during research

### Research Engine Entry Point
```javascript
// This is what the GUI needs to eventually call:
await this.engine.researchCompanyRange(
  companies,          // Array of company objects
  range.start,        // 0-based start index
  range.end,          // 0-based end index (inclusive)
  criteriaNames,      // Array of criterion names ["Product vs Service", "US Employees"]
  {
    verbosity: 1,
    waitBetweenTools: false
  },
  progressCallback    // Function to receive progress updates
);
```

## Company Data Format

### CSV Input
```csv
Company,Website,Company City,Company State
STN Solutions INC,http://www.stnsolutions.com,Austin,TX
```

### JSON Storage (in template.company_data)
```json
[
  {
    "name": "STN Solutions, INC",
    "website": "http://www.stnsolutions.com", 
    "city": "Austin",
    "state": "TX"
  }
]
```

## Next Implementation Task: Criteria Checkboxes

### Goal
Replace hardcoded checkboxes with dynamic ones generated from `this.app.template.criteria`.

### Implementation Plan
1. **Update `populateCriteriaCheckboxes()`** in research_gui.js
2. **Add to `onDataChanged()`** to populate checkboxes when template loads
3. **Implement `updateSelectedCriteria()`** to track selections
4. **Add event listeners** for checkbox changes

### Expected HTML Output
```html
<div class="criteria-grid">
  <div class="criteria-item">
    <input type="checkbox" id="criterion-1" data-criterion-name="Product vs Service" checked>
    <label for="criterion-1">Product vs Service</label>
  </div>
  <!-- Repeat for each criterion in template -->
</div>
```

## Development Environment

### Starting the Application
```bash
# Terminal 1: Start server
cd server && npm run dev

# Terminal 2: Access GUI
# Open browser to http://localhost:3000

# Database: Delete server/smartbroker.db if schema changes
```

### Debugging
- **Server logs**: Check terminal for `[SERVER]` and `[DAO]` prefixed logs
- **Client logs**: Check browser console for `ResearchGUI:` prefixed logs
- **Network**: Check browser dev tools Network tab for API calls

### Testing CSV Upload
Use any CSV with columns: Company, Website, Company City, Company State

## Important Notes

### Code Style
- **Separation of Concerns**: Keep UI logic separate from business logic
- **No Frameworks**: Use vanilla JavaScript only
- **Logging**: Extensive console.log statements for debugging
- **Error Handling**: User-friendly alerts for errors

### Key Design Decisions
- **Template-Based**: Everything tied to active template (criteria, companies, results)
- **Stateful Frontend**: App holds template/company data, passes to all tabs
- **Modular JavaScript**: Each tab has its own class/file
- **Progressive Enhancement**: Build one feature at a time, test thoroughly

### Common Patterns
```javascript
// Accessing app data from any GUI class
this.app.template.criteria  // Array of criterion objects
this.app.companies         // Array of company objects
this.app.template.id       // Active template ID

// Creating DOM elements
const element = document.createElement('div');
element.className = 'css-class';
element.addEventListener('click', () => this.handleClick());

// API calls
const response = await fetch('/api/endpoint');
const data = await response.json();
```

This guide should provide the next AI agent with all the context needed to continue the GUI implementation successfully.