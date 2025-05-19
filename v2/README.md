# SmartBroker v2

## Deployment Instructions

### Railway.app Deployment

1. Create an account on [Railway.app](https://railway.app)
2. Install the Railway CLI:
   ```
   npm install -g @railway/cli
   ```
3. Login to Railway:
   ```
   railway login
   ```
4. Initialize your project:
   ```
   railway init
   ```
5. Deploy your application:
   ```
   railway up
   ```

### Environment Variables

Make sure to set the following environment variables in the Railway dashboard:

- `ANTHROPIC_API_KEY` - Your Claude API key
- `PERPLEXITY_API_KEY` - Your Perplexity API key

A web application for researching companies using AI tools (Claude and Perplexity).

## Overview

SmartBroker v2 is a simple, single-user application for researching companies using AI tools. It loads company data, automates research through AI prompts, and presents results in an interactive UI.

## Architecture

The application follows a clean component-based architecture with a focus on:

- **Simplicity First**: Minimizing complexity and dependencies
- **Separation of Concerns**: Clean component boundaries
- **Local-First**: Data stored locally with simple persistence

### Key Components

1. **CSV-to-JSON Reader**: Import company data from CSV files
2. **Data Source**: Central storage for application data
3. **Prompt Generator**: Create effective prompts for AI research
4. **Tools**: Provide external data access capabilities
5. **Research Loop**: Orchestrate the AI research conversation flow
6. **Context Management**: Maintain conversation history
7. **Database Management**: Simple local storage
8. **Terminal Window**: Display research progress
9. **Data Table**: Show company data in tabular form
10. **Exporter**: Extract research results
11. **Settings**: Allow user configuration
12. **API Usage**: Manage API usage and costs
13. **Verification**: Validate research results

## Setup and Installation

### Prerequisites

- Node.js (v14 or later)
- API keys for Claude and Perplexity

### Installation

1. Clone the repository
2. Install dependencies:

```bash
# Client-side dependencies
cd v2/src
npm install

# Server-side dependencies
cd ../server
npm install
```

3. Configure API keys:
   - Copy `server/.env.example` to `server/.env`
   - Add your API keys to the `.env` file

### Running the Application

1. Start the server:

```bash
cd v2/server
npm start
```

2. Access the application:
   - Open http://localhost:3000 in your browser

## Usage

1. **Upload Company Data**: Use the CSV upload button to load company data
2. **Configure API Keys**: Enter your API keys in the settings
3. **Start Research**: Select a question and click "Start Investigation"
4. **View Results**: Results appear in the data table and can be viewed in the terminal window
5. **Export Data**: Use the export button to save results in various formats

## Development

To run in development mode with hot reloading:

```bash
cd v2/server
npm run dev
```

## License

Private, no license granted.