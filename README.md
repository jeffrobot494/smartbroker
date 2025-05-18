# SmartBroker

A web application that automates company research to identify acquisition targets.

## Overview

SmartBroker helps identify privately-held software companies with owners who are likely to want to sell. The application takes a list of company names as input, performs automated internet research using AI, and outputs a spreadsheet with detailed information about each company based on specific compatibility criteria.

## Key Features

- Automated research of companies using Claude AI (3.7 Sonnet model)
- Intelligent tool selection to minimize API costs
- Early elimination of incompatible companies
- Interactive research flow with user confirmation steps
- Comprehensive context tracking and verification mechanisms
- Detailed output with confidence ratings for each finding

## How It Works

SmartBroker evaluates companies against six key criteria:

1. **Product Focus**: Does the company sell software products (not just services)?
2. **Team Size**: Does the company have 5-40 employees?
3. **US-Based**: Are the majority of employees based in the USA?
4. **Vertical Market**: Does the company sell vertical market software?
5. **Owner Age**: Is the owner at least 50 years old?
6. **Funding Type**: Is the company bootstrapped (not VC/PE funded)?

The application uses a variety of tools to gather this information:

- **Perplexity Search**: The primary research tool, providing comprehensive web search results
- **Radaris Search**: Used primarily for finding owner age information
- **Website Search**: For analyzing company websites (coming in a future version)

## Project Structure

```
smartbroker/
├── .git/
├── cats/
├── docs/
├── py/
├── server/
│   ├── .env                # API keys and configuration
│   ├── node_modules/       
│   ├── package.json        # Node.js dependencies
│   ├── package-lock.json
│   └── server.js           # Server implementation with API endpoints
├── .gitignore
├── CLAUDE.md
├── index.html              # Main application frontend
└── SmartBrokerApp.txt      # Documentation
```

## Technical Implementation

### Server (Node.js)

The server provides:
- A proxy for Anthropic's Claude API
- Custom endpoints for various research tools (Perplexity, Radaris)
- Context management between Claude interactions

### Frontend

The frontend includes:
- A simple interface showing all Claude's thoughts and tool operations
- Interactive research flow with user confirmation steps
- Company data input functionality
- Results display and export

### Context Management

The application maintains structured context for each company investigation, including:
- Company identifiers for verification
- Question responses with evidence and confidence
- Search history to avoid duplication
- Evidence repository for reference
- Investigation status tracking

## Getting Started

### Prerequisites

- Node.js 14+
- API keys for:
  - Anthropic (Claude)
  - Perplexity
  - (Optional) Other research APIs

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   cd server
   npm install
   ```
3. Set up environment variables by creating a `.env` file in the server directory:
   ```
   ANTHROPIC_API_KEY=your_api_key_here
   PERPLEXITY_API_KEY=your_api_key_here
   # Add other API keys as needed
   ```
4. Start the server:
   ```
   npm start
   ```
5. Open `index.html` in your browser

### Usage

1. Prepare a list of companies to research
2. Input the list into the application
3. Follow the interactive research process, confirming each step
4. Review the results in the output area
5. Export the results to a spreadsheet for further analysis

## Cost Management

SmartBroker is designed to minimize API costs by:
- Eliminating incompatible companies as early as possible
- Prioritizing questions that are cheaper to answer
- Using an optimal sequence of research tools
- Storing context to avoid duplicate searches

## Future Enhancements

- Integration with FireCrawl for website scraping
- Investigation templates for different company types
- Advanced filtering and sorting of results
- Batch processing of multiple companies
- Automated phone line verification
- Industry trend and M&A information

## Maintenance

After initial development, minimal maintenance is required. Bug fixes and feature enhancements can be implemented on demand.

## License

Proprietary - All rights reserved

## Contributors

- Bo - Developer
- David - Product Owner
