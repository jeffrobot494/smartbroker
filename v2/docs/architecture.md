# SmartBroker v2 Architecture

## Overview

SmartBroker v2 is a simple, single-user application for researching companies using AI tools (Claude/Perplexity). It loads company data, automates research through AI prompts, and presents results in an interactive UI. The application focuses on simplicity and user experience rather than scaling or complex edge cases.

**Important UI Note**: The UI should maintain visual consistency with SmartBroker v1. Please reference the v1 code in `../v1/` directory for UI styling, layout, and behavior. The goal is to preserve the same look and feel while improving the underlying architecture.

## Design Principles

- **Simplicity First**: Minimize complexity and dependencies
- **Separation of Concerns**: Clean component boundaries
- **Single User Focus**: Optimize for individual usage, not multi-user
- **Minimal Error Handling**: Focus on the happy path
- **Local-First**: Store data locally with simple persistence

## Components

### 1. CSV-to-JSON Reader

**Purpose**: Import company data from CSV files into the application.

**Functionality**:
- Read CSV files with company information
- Convert to structured JSON
- Validate minimal required fields
- Handle basic formatting issues

**Interfaces**:
- Input: CSV file path
- Output: Array of company objects

### 2. Data Source

**Purpose**: Central storage for application data and configuration.

**Functionality**:
- Store company information
- Maintain question definitions and criteria
- Hold research results
- Store prompt templates
- Track current research state

**Interfaces**:
- Methods to get/set companies, questions, results
- Observable data changes for UI updates

### 3. Prompt Generator

**Purpose**: Create effective prompts for AI research.

**Functionality**:
- Generate research prompts for Claude
- Include company context, question details
- Format instructions for tool usage
- Apply templates based on question type

**Interfaces**:
- Input: Company data, question, previous findings
- Output: Formatted prompt text

### 4. Tools

**Purpose**: Provide external data access capabilities for AI research.

**Functionality**:
- Perplexity search wrapper
- Tool request extraction from AI responses
- Tool result formatting
- Simple caching for common queries

**Interfaces**:
- Method to extract tool requests
- Method to execute tools and return results

### 5. Research Loop

**Purpose**: Orchestrate the AI research conversation flow.

**Functionality**:
- Manage the back-and-forth with Claude
- Track conversation context
- Process tool requests and execute them
- Extract final answers
- Apply iteration limits

**Interfaces**:
- Input: Company, question, initial prompt
- Output: Research result with evidence and confidence

### 6. Context Management

**Purpose**: Maintain conversation history and research state.

**Functionality**:
- Track conversation turns
- Manage context window size
- Store intermediate findings
- Handle cross-question information sharing

**Interfaces**:
- Methods to add/get conversation history
- Methods to store/retrieve intermediate findings

### 7. Database Management

**Purpose**: Simple local storage for research results and application state.

**Functionality**:
- Save/load company research data
- Store application configuration
- Handle basic data export/import
- Maintain research history

**Interfaces**:
- Methods to save/load data
- File-based storage for portability

### 8. GUI Terminal Window

**Purpose**: Display research progress and AI interaction.

**Functionality**:
- Show real-time research status
- Display Claude's responses
- Show tool usage and results
- Allow scrollback and history viewing

**Interfaces**:
- Method to append new content
- Method to clear display
- Method to display formatted content

### 9. GUI Live Data Table

**Purpose**: Show company data and research results in tabular form.

**Functionality**:
- Display companies and question answers
- Interactive selection of cells/columns
- Visual indicators for result confidence
- Sorting and basic filtering

**Interfaces**:
- Method to update display with new results
- Event handlers for row/cell selection

### 10. Exporter for Finished Data

**Purpose**: Extract research results for external use.

**Functionality**:
- Export to CSV/Excel format
- Include raw and processed research data
- Format data for readability
- Include metadata (date, confidence, etc.)

**Interfaces**:
- Method to export all or selected results
- Support for different output formats

### 11. GUI Settings Page

**Purpose**: Allow user configuration of application behavior.

**Functionality**:
- Toggle research behaviors
- Set API keys
- Configure prompt parameters
- Adjust UI preferences

**Interfaces**:
- Form controls for settings
- Methods to save/load settings

### 12. API Usage Controls

**Purpose**: Manage AI API usage and costs.

**Functionality**:
- Track API call counts and costs
- Apply rate limiting
- Set usage budgets
- Display usage statistics

**Interfaces**:
- Methods to track/log API usage
- Budget configuration

### 13. Verification Module

**Purpose**: Validate research results for accuracy.

**Functionality**:
- Cross-check findings across multiple sources
- Apply confidence scoring
- Flag inconsistencies
- Suggest verification strategies

**Interfaces**:
- Input: Initial research finding
- Output: Verified result with confidence score

## Data Flow

1. User loads company data via CSV Reader
2. Data is stored in Data Source
3. User selects question(s) to research
4. Research Loop initiates with Prompt Generator creating initial prompt
5. Claude responds, possibly with tool requests
6. Tools execute requests and return results
7. Research Loop continues until conclusion
8. Results stored in Data Source
9. GUI components update to show results
10. User can export results via Exporter

## File Structure

```
/v2
  /src
    /components
      CSVReader.js
      DataSource.js
      PromptGenerator.js
      Tools.js
      ResearchLoop.js
      ContextManager.js
      Database.js
      TerminalWindow.js
      DataTable.js
      Exporter.js
      Settings.js
      APIUsage.js
      Verification.js
    /utils
      formatting.js
      api.js
      helpers.js
    /css
      styles.css
      table.css
      terminal.css
    index.html
    index.js
    app.js
  /tests
    [component test files]
  /docs
    architecture.md
    usage.md
  .env.example            # Example env file with keys needed but no values
  .env                    # Actual keys (not committed to version control)
  .gitignore              # Should include .env
```

## Implementation Notes

- Use native JavaScript with minimal dependencies
- Focus on readability over optimization
- Prefer simple file-based storage over complex databases
- Use browser localStorage for persistence where appropriate
- Keep error handling minimal but prevent catastrophic failures
- Document key functions but don't overdo it
- Store API keys in a `.env` file (not committed to version control)
- Use environment variables for all sensitive credentials