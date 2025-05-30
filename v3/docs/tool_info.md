# SmartBroker v3 - Tool System Documentation

## Overview

The SmartBroker tool system allows Claude to request additional information during research by calling external tools. The current implementation includes Perplexity web search, with a flexible architecture that supports adding new tools easily.

## Current Tool Architecture

### 1. System Prompt Definition (`server/seed-data.js`)

Tools are described in the system prompt that gets sent to Claude:

```javascript
// Lines 10-17: Tool descriptions in system prompt
You have the following tools at your disposal if you need additional information:

Perplexity Web Search
Perplexity is your general-purpose web search tool. It can be used to ask a question or for general web search via key terms.
To use a perplexity search, use the following format:
<<perplexity_search: {query}>>

Each tool use has a cost. Perplexity search costs $0.01.
```

**Claude learns:**
- What tools are available
- How to format tool requests
- Cost considerations for tool usage

### 2. Tool Execution (`src/research-engine.js`)

The central tool dispatcher handles tool execution:

```javascript
// Lines 568-580: Tool dispatcher
async executeTool(toolName, query) {
  try {
    switch (toolName.toLowerCase()) {
      case 'perplexity_search':
        const result = await this.perplexity.search(query);
        return result.content;
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    return `Error executing ${toolName}: ${error.message}`;
  }
}
```

**Flow:**
1. Claude requests tool use in format: `<<toolname: query>>`
2. ResearchEngine extracts toolName and query
3. `executeTool()` dispatches to appropriate tool implementation
4. Tool result is returned to Claude for analysis

### 3. Response Parsing (`src/research-engine.js`)

Claude's response is parsed to detect tool requests:

```javascript
// Lines 409-421: Tool use detection
if (type === 'tool_use') {
  const toolMatch = content.match(/<<(\w+):\s*([^>>]+)>>/);
  if (!toolMatch) {
    throw new Error('Could not parse tool request from Claude');
  }
  
  return {
    type: 'tool_use',
    toolName: toolMatch[1],        // Extracted from <<toolname: query>>
    query: toolMatch[2].trim(),
    explanation: lines.slice(1).join('\n').trim()
  };
}
```

**Pattern Recognition:**
- Looks for `<<toolname: query>>` pattern in Claude's response
- Extracts tool name and query parameters
- Returns structured tool request object

### 4. Progress Callbacks (`src/research-engine.js`)

Progress events are sent during tool execution:

```javascript
// Lines 290-297: Tool request progress
progressCallback({
  type: 'tool_request',
  toolName: parsed.toolName,
  query: parsed.query,
  waitForApproval: waitBetweenTools
});

// Lines 323-327: Tool result progress  
progressCallback({
  type: 'tool_result',
  result: verbosity >= 2 ? toolResult : null,
  userOverride
});
```

**Progress Events:**
- `tool_request`: When Claude requests a tool
- `tool_approval_needed`: If user approval is required
- `tool_result`: When tool execution completes

### 5. Terminal Interface (`src/terminal-interface.js`)

The terminal displays tool usage to users:

```javascript
// Lines 221-225: Tool request display
case 'tool_request':
  if (this.verbosity >= 1) {
    console.log(`🔧 Additional tool use: ${progress.toolName} - "${progress.query}"`);
  }
  break;

// Lines 242-246: Tool result display
case 'tool_result':
  if (this.verbosity >= 2 && progress.result) {
    console.log('\n📊 Tool Result:');
    console.log(progress.result.substring(0, 300) + '...');
  }
  break;
```

**User Experience:**
- Verbosity 1+: Shows tool requests
- Verbosity 2+: Shows tool results (truncated)
- Interactive approval if `waitBetweenTools` is enabled

### 6. Database Tracking (`server/dao/research-dao.js`)

Tool usage is tracked in research results:

```javascript
// Line 88: Saves tool_calls count
tool_calls, tokens_used, updated_at)

// Line 99: Passes toolCalls count
result.toolCalls || 0,

// Lines 147, 185: Returns toolCalls in results
toolCalls: result.tool_calls,
```

**Metrics Tracked:**
- `tool_calls`: Number of tools used per research result
- `tokens_used`: Claude token consumption
- Cost tracking and analytics

## Tool Request Flow

### 1. Claude Analysis
```
Claude receives: Initial research data + system prompt with tool descriptions
Claude decides: Need more information about X
Claude responds: "TYPE: tool_use\n<<perplexity_search: company revenue model>>"
```

### 2. Tool Execution
```
ResearchEngine parses: toolName="perplexity_search", query="company revenue model"
ResearchEngine calls: executeTool("perplexity_search", "company revenue model")
Tool executes: Perplexity API call
Result returned: "Company generates revenue through SaaS subscriptions..."
```

### 3. Continuation
```
Tool result sent to Claude: "Tool result:\nCompany generates revenue through SaaS subscriptions..."
Claude analyzes: Combined initial data + tool result
Claude responds: "TYPE: positive_result\nYes, this is a SaaS company..."
```

## Adding New Tools

The architecture is designed for easy tool addition. Here's what you need:

### Required Changes

#### 1. Tool Implementation
Create the actual tool service/client (e.g., API client, data processor, etc.)

#### 2. System Prompt Update (`server/seed-data.js`)
Add tool description in the system prompt:
```javascript
Tool Name
Tool description explaining what it does and when to use it.
To use this tool, use the following format:
<<tool_name: {query}>>
```

#### 3. ExecuteTool Switch Case (`src/research-engine.js`)
Add new case to the tool dispatcher:
```javascript
case 'new_tool_name':
  const result = await this.newTool.execute(query);
  return result.content;
```

### Optional Changes

#### 4. Custom Progress Display (`src/terminal-interface.js`)
If the tool needs special display handling, add custom progress cases.

#### 5. Tool-Specific Configuration
Add any configuration options, API keys, or initialization logic.

### Automatic Functionality

The following work automatically for any new tool:
- ✅ **Response parsing** - `<<toolname: query>>` pattern detection
- ✅ **Progress callbacks** - Tool request/result events
- ✅ **Database tracking** - Tool usage counts and metrics
- ✅ **Terminal display** - Basic tool request/result display
- ✅ **User approval flow** - Interactive tool approval if enabled
- ✅ **Error handling** - Tool execution error management

## Example: Adding a "Company Database" Tool

### 1. Create Tool Client
```javascript
// src/company-db-client.js
class CompanyDBClient {
  async lookup(companyName) {
    // Database lookup logic
    return { data: companyInfo };
  }
}
```

### 2. Update System Prompt
```javascript
Company Database Lookup
Search our internal company database for detailed company information including financials, leadership, and history.
To use the company database, use the following format:
<<company_lookup: {company_name}>>
```

### 3. Add ExecuteTool Case
```javascript
case 'company_lookup':
  const result = await this.companyDB.lookup(query);
  return JSON.stringify(result.data, null, 2);
```

### 4. Initialize in ResearchEngine
```javascript
// In constructor
this.companyDB = new CompanyDBClient();
```

**That's it!** The tool is now fully integrated with progress display, database tracking, and user interface support.

## Tool Design Best Practices

### 1. Tool Naming
- Use descriptive names: `company_lookup` not `lookup`
- Use underscores for multi-word tools
- Keep names concise but clear

### 2. Query Format
- Design queries to be natural language when possible
- Support both specific lookups and general searches
- Consider parameter validation

### 3. Result Format
- Return structured, readable results
- Include relevant context and details
- Keep results focused and actionable

### 4. Cost Consideration
- Document tool costs in system prompt
- Optimize for efficiency vs. thoroughness
- Consider rate limiting for expensive tools

### 5. Error Handling
- Provide meaningful error messages
- Graceful degradation when tools fail
- Fallback strategies when appropriate

## Current Tool Inventory

### Perplexity Web Search (`perplexity_search`)
- **Purpose**: General web search and research
- **Format**: `<<perplexity_search: {search_query}>>`
- **Cost**: $0.01 per search
- **Use Cases**: Company research, market analysis, fact checking
- **Implementation**: `src/api-clients.js` - PerplexityClient

## Future Tool Ideas

### Potential Tools to Add:
- **Financial Database**: SEC filings, financial statements
- **Social Media Monitor**: Company mentions, sentiment analysis  
- **Patent Search**: Intellectual property research
- **News Aggregator**: Recent company news and press releases
- **Competitor Analysis**: Market positioning and competitive landscape
- **Technology Stack Detection**: Company's technical infrastructure
- **Job Posting Analysis**: Hiring trends and team growth
- **Contact Database**: Leadership and key personnel information

The modular tool architecture makes it easy to add specialized research capabilities while maintaining consistent user experience and system integration.