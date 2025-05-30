# PhantomBuster LinkedIn Tool - Complete Implementation Guide

## Overview

This document provides an exhaustive explanation of how the PhantomBuster LinkedIn scraping tool will be integrated into SmartBroker v3. The tool allows Claude to extract detailed information from LinkedIn profiles when other tools fail to provide sufficient data.

## PhantomBuster Architecture Understanding

### What PhantomBuster Does
- **Input**: LinkedIn profile or company URL
- **Process**: Automated browser scraping of LinkedIn data
- **Output**: Structured profile data (name, location, education, experience, etc.)
- **Time**: 60-300 seconds per profile
- **Cost**: $0.10-$0.25 per execution

### PhantomBuster API Flow
1. **Launch Phantom**: POST to `/phantoms/{id}/launchonce` → Returns container ID immediately
2. **Poll Status**: GET `/containers/{containerId}` → Check if running/finished
3. **Get Results**: GET `/containers/{containerId}/result` → Retrieve scraped data

### LinkedIn Authentication Requirements
**PhantomBuster requires LinkedIn session cookies, NOT login credentials:**

#### What You Need:
- **Your own LinkedIn account** (must be actively logged in)
- **LinkedIn session cookie (`li_at`)** from your browser
- **PhantomBuster browser extension** (easiest method) or manual cookie extraction

#### How Session Cookies Work:
PhantomBuster uses your active session cookie to perform automations on your behalf, exactly as if you were manually browsing LinkedIn. The session cookie is generated when you log into LinkedIn and remains valid for that session.

#### Critical Implications for SmartBroker:

**PROS:**
- ✅ **More secure**: PhantomBuster doesn't know your password or email
- ✅ **Natural behavior**: Works exactly like manual LinkedIn browsing
- ✅ **No credential storage**: Only session tokens, not actual login data

**CONS:**
- ❌ **Requires LinkedIn account**: You need an active account to scrape other profiles
- ❌ **Cookie expiration**: Session cookies expire (~3 months) and need renewal
- ❌ **Rate limiting**: High activity can trigger LinkedIn logout/suspicion
- ❌ **Personal attribution**: All scraping happens "as the account owner"

#### Cookie Management Requirements:
1. **Initial setup**: Account owner provides `li_at` session cookie
2. **Expiration handling**: Detect expired cookies and prompt for renewal
3. **Rate limiting**: Respect LinkedIn's automation detection
4. **Security**: Store cookies securely in environment variables

### Key Characteristics
- **Asynchronous by nature**: Launch returns immediately, results come later
- **Long execution time**: 1-5 minutes typical for LinkedIn profiles
- **Expensive**: 10-25x more costly than Perplexity search
- **Authentication required**: LinkedIn session cookies must be valid
- **Fallback tool**: Only used when other tools fail

## SmartBroker Integration Strategy

### Design Decision: Synchronous Tool Interface
Although PhantomBuster is asynchronous, we'll present it as a synchronous tool to Claude:
- **Reason**: ResearchEngine expects immediate tool results
- **Implementation**: Server handles async polling internally
- **User Experience**: Shows "Running (60+ seconds)..." message

### Architecture Pattern
Following existing tool patterns:
- **Client**: Simple API wrapper (like PerplexityClient)
- **Server**: Handles complex API interactions and polling
- **Integration**: Same patterns as Perplexity tool

## Implementation Plan

### Phase 1: Core Infrastructure

#### File 1: Server API Endpoint (`server/server.js`)
**Location**: Add after existing tool endpoints (~line 105)
**Purpose**: Handle PhantomBuster API integration with polling

```javascript
// PhantomBuster LinkedIn Scraper Endpoint
app.post('/api/phantombuster', async (req, res) => {
  try {
    const { url } = req.body;
    
    // Validate LinkedIn URL
    if (!url || !url.includes('linkedin.com')) {
      return res.status(400).json({
        error: 'Valid LinkedIn URL required'
      });
    }

    // Launch phantom with LinkedIn session cookie (using actual API structure)
    const launchResponse = await axios.post(
      `${PHANTOMBUSTER_BASE_URL}/agent/${process.env.PHANTOMBUSTER_PHANTOM_ID}/launch`,
      {
        argument: JSON.stringify({
          profileUrls: [url],
          sessionCookie: process.env.LINKEDIN_SESSION_COOKIE // li_at cookie
        })
      },
      {
        headers: {
          'X-Phantombuster-Key': process.env.PHANTOMBUSTER_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 120000 // 2 minute timeout
      }
    );

    const containerId = launchResponse.data.containerId;
    
    // Poll for completion using actual API structure
    let containerStatus = 'running';
    let attempts = 0;
    const maxAttempts = 15; // 7.5 minutes max (30 sec intervals)
    
    while ((containerStatus === 'running' || containerStatus === undefined) && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
      
      const statusResponse = await axios.get(
        `${PHANTOMBUSTER_BASE_URL}/agent/${process.env.PHANTOMBUSTER_PHANTOM_ID}/output`,
        {
          headers: {
            'X-Phantombuster-Key': process.env.PHANTOMBUSTER_API_KEY
          }
        }
      );
      
      containerStatus = statusResponse.data?.data?.containerStatus;
      const agentStatus = statusResponse.data?.data?.agentStatus;
      attempts++;
      
      // Check if both container and agent are not running (completed)
      if (containerStatus === 'not running' && agentStatus === 'not running') {
        // Get the actual results from the response
        const results = statusResponse.data?.data?.resultObject;
        if (results && results.length > 0) {
          const formattedData = formatLinkedInResults(statusResponse.data);
          return res.json({
            content: formattedData,
            executionTime: attempts * 30,
            rawData: results[0] // Include raw data for debugging
          });
        }
      }
    }
    
    // Handle timeout or failure cases
    if (containerStatus === 'error') {
      return res.status(500).json({
        error: 'PhantomBuster execution failed',
        details: 'LinkedIn session may have expired or phantom encountered an error',
        cookieHelp: 'Check if LinkedIn session cookie (li_at) needs renewal'
      });
    }
    
    return res.status(408).json({
      error: 'PhantomBuster execution timed out',
      details: `Phantom did not complete after ${attempts * 30} seconds (${attempts} attempts)`
    });
    
    // Get results
    const resultsResponse = await axios.get(
      `${PHANTOMBUSTER_BASE_URL}/containers/${containerId}/result`,
      {
        headers: {
          'X-Phantombuster-Key': process.env.PHANTOMBUSTER_API_KEY
        }
      }
    );
    
    // Format results for Claude
    const formattedData = formatLinkedInResults(resultsResponse.data);
    
    res.json({
      content: formattedData,
      containerId: containerId,
      executionTime: attempts * 10
    });

  } catch (error) {
    console.error('PhantomBuster API Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'PhantomBuster request failed',
      details: error.response?.data?.error || error.message
    });
  }
});

// Helper function to format LinkedIn results for Claude
function formatLinkedInResults(rawData) {
  // PhantomBuster API returns: { status, data: { resultObject: [profile_objects] } }
  // Extract the first profile from the resultObject array
  const profile = rawData?.data?.resultObject?.[0] || {};
  const general = profile.general || {};
  const jobs = profile.jobs || [];
  const schools = profile.schools || [];
  const skills = profile.skills || [];
  const details = profile.details || {};
  
  // CRITICAL: Extract graduation dates for age estimation (primary use case)
  const educationInfo = schools.map(school => {
    const dateRange = school.dateRange || '';
    const graduationYear = dateRange.match(/(\d{4})\s*-\s*(\d{4})/)?.[2] || 
                          dateRange.match(/(\d{4})$/)?.[0];
    return {
      school: school.schoolName,
      degree: school.degree,
      dateRange: dateRange,
      graduationYear: graduationYear
    };
  });
  
  // Find most recent graduation year for age estimation
  const graduationYears = educationInfo
    .map(edu => edu.graduationYear)
    .filter(year => year)
    .sort((a, b) => b - a); // Most recent first
  
  const latestGraduation = graduationYears[0];
  const estimatedAge = latestGraduation ? new Date().getFullYear() - parseInt(latestGraduation) + 22 : null;
  
  // Format current job
  const currentJob = jobs.find(job => job.isCurrent) || jobs[0];
  
  // Format top skills with endorsements
  const topSkills = skills.slice(0, 6).map(skill => 
    `${skill.name} (${skill.endorsements} endorsements)`
  );
  
  return `LinkedIn Profile Information:
Name: ${general.fullName || 'Not found'}
Location: ${general.location || 'Not found'} 
Headline: ${general.headline || 'Not specified'}
Country: ${general.countryCode || 'Unknown'}

*** CRITICAL FOR AGE ESTIMATION ***
Education History:
${educationInfo.map(edu => 
  `- ${edu.school}: ${edu.degree} (${edu.dateRange})${edu.graduationYear ? ` → Graduated: ${edu.graduationYear}` : ''}`
).join('\n') || 'No education information found'}

Age Estimation:
${latestGraduation ? `Latest Graduation: ${latestGraduation} → Estimated Age: ~${estimatedAge} years old` : 'Cannot estimate age - no graduation dates found'}

Current Employment:
${currentJob ? `${currentJob.jobTitle} at ${currentJob.companyName} (${currentJob.location || 'Location not specified'})` : 'Not specified'}
${currentJob?.dateRange ? `Duration: ${currentJob.dateRange}` : ''}
${currentJob?.description ? `\nDescription: ${currentJob.description.substring(0, 200)}${currentJob.description.length > 200 ? '...' : ''}` : ''}

Previous Jobs:
${jobs.filter(job => !job.isCurrent).slice(0, 2).map((job, idx) => 
  `${idx + 1}. ${job.jobTitle} at ${job.companyName} (${job.dateRange})`
).join('\n') || 'No previous jobs listed'}

Skills & Expertise:
${topSkills.join(', ') || 'No skills listed'}

Contact Information:
- Email: ${details.mail || 'Not available'}
- Phone: ${details.phone || 'Not available'}
- Website: ${details.websites || 'Not available'}
- LinkedIn: ${general.profileUrl}
- Connection Degree: ${general.connectionDegree || 'Unknown'}
- Open to Work: ${general.isOpenToWork ? 'Yes' : 'No'}
- Currently Hiring: ${general.isHiring ? 'Yes' : 'No'}

Key Research Data:
- PRIMARY: Latest Graduation Year = ${latestGraduation || 'NOT FOUND'} (for age estimation)
- Estimated Age: ${estimatedAge ? `~${estimatedAge} years old` : 'Cannot determine'}
- Location: ${general.location || 'Not specified'} (US: ${general.countryCode === 'US' ? 'Yes' : 'No'})
- Job Location: ${currentJob?.location || 'Not specified'} (for employee location analysis)`;
}
```

**Required Environment Variables**:
```bash
PHANTOMBUSTER_API_KEY=your_phantombuster_api_key
PHANTOMBUSTER_PHANTOM_ID=your_linkedin_phantom_id
LINKEDIN_SESSION_COOKIE=your_li_at_cookie_value
```

**Important Cookie Notes**:
- The `LINKEDIN_SESSION_COOKIE` is the `li_at` cookie value from your browser
- This cookie expires approximately every 3 months
- When expired, PhantomBuster operations will fail with authentication errors
- Cookie must be from an active LinkedIn session

**Configuration Constants**:
```javascript
const PHANTOMBUSTER_BASE_URL = 'https://api.phantombuster.com/api/v1';
const PHANTOM_ID = process.env.PHANTOMBUSTER_PHANTOM_ID;
```

#### File 2: Client Implementation (`src/api-clients.js`)
**Location**: Add new PhantomBusterClient class after TemplateClient
**Purpose**: Simple API wrapper following existing patterns

```javascript
class PhantomBusterClient {
  constructor(serverURL = 'http://localhost:3000') {
    this.serverURL = serverURL;
  }

  async scrapeLinkedIn(linkedinUrl) {
    try {
      const response = await axios.post(
        `${this.serverURL}/api/phantombuster`,
        {
          url: linkedinUrl
        },
        {
          timeout: 300000 // 5 minute timeout for long operations
        }
      );

      return response.data;
    } catch (error) {
      console.error('PhantomBuster API Error:', error.response?.data || error.message);
      throw new Error(`PhantomBuster LinkedIn scrape failed: ${error.response?.data?.details || error.message}`);
    }
  }
}
```

**Export Update**:
```javascript
module.exports = {
  ClaudeClient,
  PerplexityClient,
  ResearchClient,
  TemplateClient,
  PhantomBusterClient  // Add this line
};
```

#### File 3: Research Engine Integration (`src/research-engine.js`)
**Location 1**: Constructor initialization (~line 13)
```javascript
class ResearchEngine {
  constructor() {
    this.claude = new ClaudeClient();
    this.perplexity = new PerplexityClient();
    this.phantombuster = new PhantomBusterClient();  // Add this line
    this.research = new ResearchClient();
    this.template = new TemplateClient();
    this.companyLoader = new CompanyLoader();
    // ... rest of constructor
  }
```

**Location 2**: Import statement (~line 3)
```javascript
const { 
  ClaudeClient, 
  PerplexityClient, 
  ResearchClient, 
  TemplateClient,
  PhantomBusterClient  // Add this line
} = require('./api-clients');
```

**Location 3**: Tool execution switch (~line 570)
```javascript
async executeTool(toolName, query) {
  try {
    switch (toolName.toLowerCase()) {
      case 'perplexity_search':
        const result = await this.perplexity.search(query);
        return result.content;
        
      case 'phantombuster_linkedin':  // Add this case
        // Validate LinkedIn URL
        if (!query.includes('linkedin.com')) {
          return 'Error: PhantomBuster requires a valid LinkedIn URL (must contain "linkedin.com")';
        }
        
        const phantomResult = await this.phantombuster.scrapeLinkedIn(query.trim());
        return phantomResult.content;
        
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    return `Error executing ${toolName}: ${error.message}`;
  }
}
```

#### File 4: System Prompt Update (`server/seed-data.js`)
**Location**: Update tools section (~line 10-17)
**Purpose**: Teach Claude about PhantomBuster tool

```javascript
You have the following tools at your disposal if you need additional information:

Perplexity Web Search
Perplexity is your general-purpose web search tool. It can be used to ask a question or for general web search via key terms.
To use a perplexity search, use the following format:
<<perplexity_search: {query}>>

PhantomBuster LinkedIn Scraper
PhantomBuster extracts detailed information from LinkedIn personal profiles with a PRIMARY FOCUS on finding graduation dates for age estimation. This tool takes 60-300 seconds to complete and costs significantly more than other tools. The tool specifically extracts education history with date ranges to calculate approximate ages.
To use PhantomBuster, use the following format:
<<phantombuster_linkedin: {linkedin_profile_url}>>

CRITICAL USE CASE: AGE ESTIMATION via graduation dates from education history (schools and date ranges)

Tool Costs and Usage Guidelines:
- Perplexity search: $0.01 per search
- PhantomBuster LinkedIn: $0.15 per profile (15x more expensive)

IMPORTANT: Use PhantomBuster ONLY as a last resort when:
1. **PRIMARY**: Perplexity search cannot find graduation dates for age estimation
2. Perplexity search cannot determine employee locations/US presence  
3. Perplexity search cannot find executive background information
4. You have a specific LinkedIn URL and need detailed education/employment history

The tool will automatically calculate estimated age based on graduation years (assuming graduation at ~22 years old).
Always try Perplexity search first. PhantomBuster should be used sparingly due to its high cost and long execution time.
```

### Phase 2: Enhanced User Experience

#### File 5: Terminal Interface Enhancements (`src/terminal-interface.js`)
**Location 1**: Enhanced tool request display (~line 221)
**Purpose**: Special handling for long-running PhantomBuster operations

```javascript
case 'tool_request':
  if (this.verbosity >= 1) {
    if (progress.toolName === 'phantombuster_linkedin') {
      console.log(`⏳ ${progress.toolName} starting - this will take 60-300 seconds...`);
      console.log(`🔗 LinkedIn URL: ${progress.query}`);
      console.log(`💰 Cost: ~$0.15 (15x more than Perplexity)`);
    } else {
      console.log(`🔧 Additional tool use: ${progress.toolName} - "${progress.query}"`);
    }
  }
  break;
```

**Location 2**: Enhanced tool result display (~line 242)
```javascript
case 'tool_result':
  if (this.verbosity >= 2 && progress.result) {
    if (progress.toolName === 'phantombuster_linkedin') {
      console.log('\n📊 PhantomBuster LinkedIn Results:');
      // Show more of the result since LinkedIn data is structured
      console.log(progress.result.substring(0, 800) + (progress.result.length > 800 ? '...' : ''));
    } else {
      console.log('\n📊 Tool Result:');
      console.log(progress.result.substring(0, 300) + '...');
    }
  }
  break;
```

### Phase 3: Configuration and Environment

#### File 6: Environment Setup (`.env` or environment variables)
**Purpose**: Store PhantomBuster credentials and LinkedIn session cookie securely

```bash
# PhantomBuster Configuration
PHANTOMBUSTER_API_KEY=your_api_key_here
PHANTOMBUSTER_PHANTOM_ID=your_phantom_id_here

# LinkedIn Authentication (Critical for LinkedIn scraping)
LINKEDIN_SESSION_COOKIE=your_li_at_cookie_value_here

# Cookie Management Notes:
# - Extract li_at cookie from browser while logged into LinkedIn
# - Cookie expires ~3 months, needs periodic renewal
# - Use PhantomBuster browser extension for easy extraction
# - Keep this value secure and private
```

#### File 7: Package Dependencies (`server/package.json`)
**Purpose**: Ensure axios is available (should already be installed)

```json
{
  "dependencies": {
    "axios": "^1.x.x"
  }
}
```

## Data Flow Explanation

### Complete Request Lifecycle

1. **Claude Decision**:
   ```
   Claude analyzes research → Determines need for LinkedIn data → Formats request
   "TYPE: tool_use\n<<phantombuster_linkedin: https://linkedin.com/in/john-doe>>"
   ```

2. **Request Processing**:
   ```
   ResearchEngine.parseClaudeResponse() → Extracts tool name and URL
   ResearchEngine.executeTool() → Validates LinkedIn URL
   PhantomBusterClient.scrapeLinkedIn() → Calls server endpoint
   ```

3. **Server Execution**:
   ```
   Server receives URL → Validates format → Calls PhantomBuster API
   Launches phantom → Gets container ID → Polls status every 10 seconds
   Status = finished → Gets results → Formats for Claude → Returns data
   ```

4. **Result Processing**:
   ```
   Client receives formatted data → Returns to ResearchEngine
   ResearchEngine returns to Claude → Claude analyzes combined data
   Claude provides final research answer with LinkedIn insights
   ```

### Progress Display Flow

```
User sees: "🔧 Additional tool use: phantombuster_linkedin - https://linkedin.com/in/john-doe"
User sees: "⏳ phantombuster_linkedin starting - this will take 60-300 seconds..."
[60-300 seconds pass with server polling PhantomBuster]
User sees: "📊 PhantomBuster LinkedIn Results: [formatted profile data]"
```

### Error Handling Flow

```
Invalid URL → Client validation → "Error: PhantomBuster requires a valid LinkedIn URL"
API timeout → Server timeout → "PhantomBuster execution timed out"
Profile private → PhantomBuster error → "Error executing phantombuster_linkedin: [error details]"
```

## Integration with Existing Systems

### Database Tracking
- **Automatic**: Tool usage tracked in `research_results.tool_calls` field
- **Cost tracking**: Each PhantomBuster use increments tool_calls counter
- **Analytics**: Higher tool_calls count indicates expensive research

### Template System
- **Works with all templates**: No template-specific changes needed
- **System prompt**: Each template gets PhantomBuster instructions
- **Criteria compatibility**: Works with any criterion requiring LinkedIn data

### Verbosity Levels
- **Level 1**: Shows tool requests with timing warning
- **Level 2**: Shows formatted results (800 chars for PhantomBuster vs 300 for others)
- **Level 3**: Shows original prompts and Claude responses
- **Level 4**: Shows complete API payloads including PhantomBuster calls

## Testing Strategy

### Development Testing
1. **Mock server endpoint**: Return sample LinkedIn data for testing
2. **URL validation**: Test various LinkedIn URL formats
3. **Timeout handling**: Test server timeout scenarios
4. **Error conditions**: Test invalid URLs, API failures

### Production Testing
1. **Real PhantomBuster account**: Set up phantom for LinkedIn scraping
2. **Test profiles**: Use public LinkedIn profiles for testing
3. **Performance monitoring**: Track execution times and success rates
4. **Cost monitoring**: Track PhantomBuster usage and costs

### Integration Testing
1. **Full research workflow**: Test PhantomBuster in actual research scenarios
2. **Template switching**: Ensure tool works across different templates
3. **Verbosity levels**: Test display at all verbosity levels
4. **Error recovery**: Test research continuation after PhantomBuster failures

## LinkedIn Cookie Management

### How to Extract LinkedIn Session Cookie

#### Method 1: PhantomBuster Browser Extension (Recommended)
1. Install PhantomBuster browser extension
2. Log into LinkedIn in your browser
3. Extension automatically detects and provides `li_at` cookie
4. Copy cookie value to `LINKEDIN_SESSION_COOKIE` environment variable

#### Method 2: Manual Browser Extraction
1. Log into LinkedIn in Chrome/Firefox
2. Open Developer Tools (F12)
3. Go to Application/Storage tab → Cookies → https://linkedin.com
4. Find cookie named `li_at`
5. Copy the Value field (long string starting with "AQE" typically)
6. Set as `LINKEDIN_SESSION_COOKIE` environment variable

### Cookie Lifecycle Management

#### Cookie Expiration Signs:
- PhantomBuster returns authentication errors
- Phantom status shows "failed" with login-related error messages
- LinkedIn prompts for login when phantom runs

#### Cookie Renewal Process:
1. **Detection**: Monitor for authentication error patterns
2. **Notification**: Alert user that cookie needs renewal
3. **Renewal**: User extracts fresh `li_at` cookie from browser
4. **Update**: Update `LINKEDIN_SESSION_COOKIE` environment variable
5. **Restart**: Restart server to load new cookie value

#### Automated Cookie Health Check:
```javascript
// Optional: Add cookie validation endpoint
app.get('/api/phantombuster/health', async (req, res) => {
  // Test if current cookie is still valid
  // Return cookie status and expiration warnings
});
```

### Cookie Security Considerations

#### Security Best Practices:
- ✅ Store cookies in environment variables only
- ✅ Never commit cookies to version control
- ✅ Rotate cookies every 2-3 months proactively
- ✅ Monitor for authentication failures
- ❌ Never log cookie values
- ❌ Never share cookies between environments

#### Privacy Implications:
- All LinkedIn scraping appears as the cookie owner's activity
- LinkedIn may show "profile views" to targets from the cookie owner's account
- Rate limiting affects the cookie owner's LinkedIn account
- Suspicious activity could impact the cookie owner's LinkedIn standing

## Security and Best Practices

### API Key Management
- **Environment variables**: Never commit keys to repository
- **Server-side only**: Keys only exist on server, never exposed to client
- **Rotation support**: Easy to update keys via environment variables

### Rate Limiting
- **PhantomBuster limits**: Respect API rate limits (typically 1-2 concurrent)
- **Internal queuing**: Consider queue for multiple PhantomBuster requests
- **Timeout handling**: Fail gracefully on long delays

### Error Handling
- **Graceful degradation**: Research continues if PhantomBuster fails
- **User feedback**: Clear error messages about tool failures
- **Fallback options**: Suggest alternative approaches when tool fails

### Cost Management
- **Usage warnings**: Clear cost indicators in terminal
- **Fallback tool**: Emphasize using only when other tools fail
- **Usage tracking**: Monitor PhantomBuster usage for cost control

## Future Enhancements

### Phase 4: Advanced Features
1. **Bulk processing**: Handle multiple LinkedIn URLs in one request
2. **Caching**: Cache LinkedIn results to avoid repeated scraping
3. **Profile types**: Support both personal and company LinkedIn profiles
4. **Result filtering**: Extract only relevant data based on research criteria

### Phase 5: Performance Optimization
1. **Async queue**: Background processing for non-urgent requests
2. **Result caching**: Store LinkedIn data for reuse across research sessions
3. **Smart timeouts**: Adaptive timeouts based on profile complexity
4. **Cost optimization**: Batch requests when possible

## Files Modified Summary

| File | Purpose | Changes |
|------|---------|---------|
| `server/server.js` | API endpoint | Add `/api/phantombuster` endpoint with polling logic and cookie handling |
| `src/api-clients.js` | Client wrapper | Add `PhantomBusterClient` class |
| `src/research-engine.js` | Tool integration | Add constructor initialization and `phantombuster_linkedin` case |
| `server/seed-data.js` | System prompt | Add PhantomBuster tool instructions and cost warnings |
| `src/terminal-interface.js` | User experience | Enhanced progress display for long-running operations |
| `.env` | Configuration | Add PhantomBuster API credentials and LinkedIn session cookie |

**Total Code Added**: Approximately 250-300 lines across 6 files
**Implementation Time**: 3-4 hours for core functionality including cookie handling
**Testing Time**: 2-3 hours for validation, integration testing, and cookie management testing

**Critical Prerequisites**:
1. **LinkedIn Account**: Active account for session cookie extraction
2. **PhantomBuster Account**: With LinkedIn scraping phantom configured
3. **Session Cookie**: Fresh `li_at` cookie from LinkedIn browser session
4. **Cookie Management Process**: Established workflow for cookie renewal every 3 months

This implementation follows SmartBroker's established patterns while handling PhantomBuster's unique requirements for long execution times, high costs, and asynchronous API operations.

## Implementation Validation

The implementation has been validated against a working PhantomBuster test script with these confirmed details:

### **Confirmed API Structure:**
- ✅ **Launch endpoint**: `POST /api/v1/agent/{PHANTOM_ID}/launch`
- ✅ **Status/results endpoint**: `GET /api/v1/agent/{PHANTOM_ID}/output`
- ✅ **Request format**: `{ argument: JSON.stringify({ profileUrls: [...], sessionCookie: ... }) }`
- ✅ **Status polling**: Check `containerStatus` and `agentStatus` both equal `'not running'`
- ✅ **Results extraction**: `response.data.data.resultObject[0]` contains profile data
- ✅ **Timing**: 30-second intervals, maximum 15 attempts (7.5 minutes total)

### **Confirmed Response Format:**
- ✅ **Nested structure**: `{ status, data: { resultObject: [{ general, jobs, schools, skills, details }] } }`
- ✅ **Education data**: `schools[].dateRange` contains graduation dates for age estimation
- ✅ **Job data**: `jobs[].isCurrent` identifies current employment
- ✅ **Contact data**: `details.mail`, `details.phone` for contact information
- ✅ **Location data**: `general.location`, `general.countryCode` for geographic analysis

### **Confirmed Age Estimation Logic:**
- ✅ **Graduation parsing**: Extract years from `"1972 - 1976"` format date ranges
- ✅ **Age calculation**: Latest graduation year + 22 years = estimated current age
- ✅ **Multiple degrees**: Handle multiple education entries, use most recent graduation

This implementation is ready for production use with the confirmed API patterns and data structures.