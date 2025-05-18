# SmartBroker Application Documentation

## Overview

SmartBroker is a web application designed to automate the research process for identifying privately-held software companies that match specific investment criteria. The application helps users efficiently filter through lists of companies by evaluating them against a series of questions in order of complexity and cost to determine compatibility for potential acquisition.

The core functionality leverages Claude AI (Anthropic's Claude 3.7 Sonnet model) to perform intelligent research by combining data from multiple sources including Perplexity AI searches, company websites, and people search services like Radaris.

## Purpose

SmartBroker's primary purpose is to identify software companies that meet specific criteria:
1. Sells software products (not services)
2. Offers vertical market software
3. Has an owner who is at least 50 years old
4. Has between 5-40 employees
5. Is bootstrapped (not VC/PE funded)
6. Has the majority of employees based in the USA

The application optimizes the research process by:
- Eliminating incompatible companies as early as possible
- Prioritizing questions in order of ease/cost to answer
- Verifying company identity across searches
- Tracking progress through the research workflow

## Architecture

SmartBroker follows a client-server architecture:

### Frontend
- Built with vanilla HTML/CSS/JavaScript
- Provides a clean interface for viewing and controlling the investigation process
- Displays a console-like terminal to show Claude's research process
- Shows results in a tabular format

### Backend
- Node.js server using Express
- Manages the investigation workflow
- Handles API integrations with Claude and Perplexity
- Processes company data from CSV files
- Maintains state for the investigation process

### Data Flow
1. Company information is loaded from a CSV file
2. The user initiates the investigation
3. For each company, Claude analyzes whether it meets the first criterion
4. Companies that fail a criterion are eliminated
5. Qualifying companies proceed to the next question
6. Results are displayed in a table showing which criteria each company met

## Key Components

### 1. Server (server.js)
- Runs on Express.js
- Manages the investigation state:
  - Current company index
  - Current question index
  - Results for each company
- Provides API endpoints for:
  - Loading company data
  - Loading questions
  - Performing research
  - Managing investigation flow
- Proxies requests to external APIs (Claude, Perplexity)

### 2. API Wrapper (api-wrapper.js)
- Handles interactions with external APIs:
  - Claude API for AI research
  - Perplexity API for web searches
- Includes functions for:
  - Generating research prompts
  - Creating system prompts for Claude
  - Interpreting Claude's responses
  - Performing targeted searches (website, Radaris)
- Implements caching to reduce API costs

### 3. Frontend (index.html)
- Provides a user interface with:
  - Investigation setup panel
  - Research console showing Claude's work
  - Results table with company evaluations
- Uses JavaScript to:
  - Control the investigation flow
  - Display research progress
  - Wait for user approval at each step
  - Update results dynamically

## Investigation Process

The SmartBroker investigation follows these steps:

1. **Initialization**:
   - Company data is loaded from CSV
   - Questions are loaded in priority order
   - Investigation state is reset

2. **Research Loop**:
   - For each company and question:
     - Claude is provided with company identifiers and the current question
     - Claude performs necessary research using available tools
     - Claude provides a YES/NO answer with confidence level and evidence
     - Results are saved to the investigation state

3. **Filtering Logic**:
   - If a company receives a negative answer to any question, it's disqualified
   - Only companies that pass all questions are marked as qualified
   - The application moves to the next company or question as appropriate

4. **Results Presentation**:
   - A table shows each company's status for each question
   - Companies are categorized as "Qualified", "Disqualified", or "In Progress"

## Claude's Research Methodology

Claude follows a structured approach to research:

1. **Verification of Company Identity**:
   - Uses company identifiers (name, location, owner, website)
   - Cross-references information to ensure the correct company is being researched
   - Notes discrepancies if a similar-named company is found

2. **Question-Specific Research**:
   - Uses appropriate tools based on the question (Perplexity, website search, Radaris)
   - Interprets search results in context of the question
   - Provides evidence and confidence level with answers

3. **Response Format**:
   - Provides a direct YES/NO answer
   - Indicates confidence level (HIGH, MEDIUM, LOW)
   - Includes evidence supporting the answer
   - Lists sources used for research

## API Integration

SmartBroker integrates with the following external APIs:

1. **Claude API (Anthropic)**:
   - Model: claude-3-7-sonnet-latest
   - Used for intelligent research and analysis
   - Handles complex reasoning and verification

2. **Perplexity API**:
   - Model: sonar-medium-online
   - Used for web searching and information gathering
   - Acts as Claude's primary research tool

## Cost Optimization

To minimize API costs, SmartBroker implements several strategies:

1. **Early Elimination**: Companies are disqualified as soon as they fail a criterion
2. **Question Prioritization**: Questions are ordered by ease/cost to answer
3. **Caching**: Recent search results are cached for 15 minutes
4. **Staged Approach**: Research is conducted in a specific order to minimize API calls
5. **Verification**: Company identity is verified to avoid wasted searches

## Technical Details

### Server Requirements
- Node.js environment
- Dependencies:
  - express: Web server framework
  - axios: HTTP client for API requests
  - cors: Cross-Origin Resource Sharing middleware
  - csv-parser: For processing company data
  - dotenv: For environment variable management

### API Keys Required
- ANTHROPIC_API_KEY: For Claude AI access
- PERPLEXITY_API_KEY: For Perplexity search access

### Data Format
- Company data is provided in CSV format with fields for:
  - Company name
  - Owner's name (First Name, Last Name)
  - Title
  - Location (City, State)
  - Website
  - Annual Revenue (used to estimate employee count)
  - LinkedIn URL

## Running the Application

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file with API keys:
   ```
   ANTHROPIC_API_KEY=your_claude_api_key
   PERPLEXITY_API_KEY=your_perplexity_api_key
   ```

3. Start the server:
   ```
   npm start
   ```
   
4. Access the application at http://localhost:3000

## Future Enhancements

Based on the codebase, potential enhancements could include:

1. **Additional Research Tools**:
   - PhantomBuster for LinkedIn profile data
   - People Data Labs for business information
   - Microsoft Azure Face API for age estimation
   - Custom website scraping via FireCrawl

2. **Advanced Settings**:
   - Customizable question criteria
   - Investigation templates for different types of companies
   - API cost controls and limits

3. **Output Improvements**:
   - Export results to Google Sheets
   - Detailed evidence and sources for each answer
   - Confidence scoring for overall match quality

4. **Performance Optimizations**:
   - Asynchronous investigations for multiple companies
   - More sophisticated caching strategies
   - Enhanced error handling and retries

## Conclusion

SmartBroker automates the labor-intensive process of researching and filtering companies based on specific investment criteria. By leveraging AI technologies like Claude and Perplexity, it significantly reduces the time and effort required to identify promising acquisition targets, while maintaining cost efficiency through its strategic investigation approach.