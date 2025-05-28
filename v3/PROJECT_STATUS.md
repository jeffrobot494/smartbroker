# SmartBroker v3 - Project Status

## Current State (as of implementation)
The application is a **terminal-based company research tool** that uses Claude LLM and Perplexity to analyze companies against custom criteria to determine acquisition potential.

## Architecture Overview
- **Client**: Terminal interface (`src/`) loads companies from JSON, displays results
- **Server**: Express API (`server/`) handles Claude/Perplexity calls + SQLite database
- **Database**: SQLite with templates, criteria, companies, research_results tables

## Recent Major Implementation: Database-Driven Templates & Criteria

### COMPLETED: Step 1 - Database Foundation ✅
**Goal**: Move from hardcoded criteria to database storage while maintaining same UX

**What was implemented**:
1. **New Database Schema**:
   - `templates` table (id, name, system_prompt, is_active)
   - `criteria` table (id, template_id, name, description, first_query_template, answer_format, disqualifying, order_index)
   - Updated `research_results` table (now uses template_id + criterion_id instead of criterion_name)
   - Auto-seeding creates "Default" template from hardcoded data

2. **Server Changes**:
   - `server/database.js`: New schema + seeding logic
   - `server/dao/research-dao.js`: Updated to work with IDs, added `getActiveTemplate()`
   - `server/server.js`: Added `GET /api/template/active` endpoint
   - `server/seed-data.js`: Local copy of criteria data for seeding

3. **Client Changes**:
   - `src/api-clients.js`: Added `TemplateClient`, updated `ResearchClient` to use criterion IDs
   - `src/research-engine.js`: Now loads template from database via `initialize()`, uses `this.currentTemplate.systemPrompt`
   - `src/terminal-interface.js`: Calls `engine.initialize()` on startup
   - `src/criteria.js`: Now only used for seeding (commented as such)

### Current Working Features ✅
- Database-driven templates and criteria loading
- Research results saved with template_id + criterion_id 
- Automatic first queries with placeholder substitution (`{company_name}`, `{city}`, etc.)
- Enhanced prompts with previous research results as context
- Database-driven disqualification (derived from negative results on disqualifying criteria)
- Clear research data functionality
- All original functionality preserved

### Key Implementation Details
**Research Flow**:
1. Engine loads active template + criteria from database on startup
2. For each company/criterion: gets previous results, executes automatic query, sends enhanced prompt to Claude
3. Results saved to database with criterion ID reference
4. Disqualification determined by querying database for negative results on disqualifying criteria

**Database Design**:
- Foreign key relationships ensure data integrity
- Unique constraints prevent duplicate research
- CASCADE deletes maintain consistency
- Indexes for performance

## Next Steps: Remaining Edit Options Implementation

### TODO: Step 2 - Template Management UI
**Goal**: Enable switching/creating templates via terminal interface

**What needs implementation**:
1. **Edit Templates Menu** (currently placeholder):
   - List all templates
   - Switch active template  
   - Create new template (copy current + rename)
   - Delete template
   
2. **Database Operations Needed**:
   - `getTemplates()`, `createTemplate()`, `deleteTemplate()`, `setActiveTemplate()`
   - Template switching reloads criteria in research engine

### TODO: Step 3 - Criteria & System Prompt Editing  
**Goal**: Enable full editing of templates

**What needs implementation**:
1. **Edit System Prompt** (currently placeholder):
   - Multi-line text editor in terminal
   - Save to database, reload in engine

2. **Edit Criteria** (currently placeholder):
   - List current criteria with add/edit/delete options
   - Form inputs for criterion fields
   - Reorder criteria functionality

## Important Technical Notes

### Database Schema
```sql
templates (id, name, system_prompt, is_active, created_at)
criteria (id, template_id, name, description, first_query_template, answer_format, disqualifying, order_index, created_at) 
research_results (id, template_id, company_id, criterion_id, answer, explanation, result_type, iterations, tool_calls, tokens_used, created_at, updated_at)
companies (id, name, website, data, created_at)
```

### Key Code Patterns
- Research engine requires `await engine.initialize()` before use
- Criteria accessed via `this.currentCriteria`, system prompt via `this.currentTemplate.systemPrompt`
- Research saving uses criterion IDs: `research.saveResult(companyName, criterion.id, result, companyData)`
- Company info limited to: name, website, linkedin, location for Claude prompts

### Placeholder Substitution
Automatic query templates support: `{company_name}`, `{city}`, `{state}`, `{website}`, `{linkedin}`, `{phone}`, `{revenue}`, `{president_owner_ceo}`

### Current Issues/Limitations  
- Only one active template supported (UI for switching not implemented)
- Criteria editing not implemented
- No template export/import
- Research results tied to specific template (changing criteria may invalidate results)

## Development Environment
- **Server**: Node.js + Express + better-sqlite3
- **Client**: Node.js terminal app with readline
- **APIs**: Claude (Anthropic) + Perplexity
- **Database**: SQLite file at `server/smartbroker.db`
- **Start command**: `npm run dev` (runs server + client concurrently)

## File Structure Overview
```
src/               # Client terminal app
├── api-clients.js     # Claude, Perplexity, Research, Template clients
├── research-engine.js # Core research logic, database-driven
├── terminal-interface.js # Menu system, calls engine.initialize()
├── company-loader.js  # JSON company loading (research removed)
└── criteria.js       # Now only for seeding reference

server/            # Express API server  
├── database.js        # SQLite wrapper + schema + seeding
├── dao/research-dao.js # Database operations
├── server.js         # API endpoints
└── seed-data.js      # Copy of criteria for seeding
```

This status should enable the next Claude instance to pick up exactly where we left off and continue with Step 2 implementation.