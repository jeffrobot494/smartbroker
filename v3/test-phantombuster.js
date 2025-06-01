#!/usr/bin/env node

/**
 * Standalone PhantomBuster Test Script
 * Tests the exact same conditions/settings as our app
 */

const axios = require('axios');
require('dotenv').config({ path: './server/.env' });

// Test configuration - using exact same format as working script
const PHANTOMBUSTER_BASE_URL = 'https://api.phantombuster.com/api/v1';
const TEST_LINKEDIN_URL = 'https://www.linkedin.com/in/bruce-lebel-a9bb4/'; // Same URL as working script

console.log('🧪 PhantomBuster Standalone Test');
console.log('='.repeat(50));

// Check environment variables (same validation as our app)
console.log('\n📋 Environment Variables:');
console.log(`PHANTOMBUSTER_API_KEY: ${process.env.PHANTOMBUSTER_API_KEY ? 'SET (length: ' + process.env.PHANTOMBUSTER_API_KEY.length + ')' : 'NOT SET'}`);
console.log(`PHANTOMBUSTER_PHANTOM_ID: ${process.env.PHANTOMBUSTER_PHANTOM_ID ? 'SET (value: ' + process.env.PHANTOMBUSTER_PHANTOM_ID + ')' : 'NOT SET'}`);
console.log(`LINKEDIN_SESSION_COOKIE: ${process.env.LINKEDIN_SESSION_COOKIE ? 'SET (length: ' + process.env.LINKEDIN_SESSION_COOKIE.length + ')' : 'NOT SET'}`);

if (!process.env.PHANTOMBUSTER_API_KEY || !process.env.PHANTOMBUSTER_PHANTOM_ID || !process.env.LINKEDIN_SESSION_COOKIE) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Fixed helper function - same as our server
function formatLinkedInResults(rawData, originalUrl) {
  // Parse the JSON string from resultObject
  let resultArray = [];
  try {
    const resultString = rawData?.data?.resultObject;
    if (resultString && typeof resultString === 'string') {
      resultArray = JSON.parse(resultString);
    } else if (Array.isArray(resultString)) {
      resultArray = resultString; // Already parsed
    }
  } catch (error) {
    console.error('Error parsing PhantomBuster resultObject:', error.message);
  }
  
  const profile = resultArray[0] || {};
  const general = profile.general || {};
  const schools = profile.schools || [];
  
  // Extract graduation dates for age estimation (PRIMARY USE CASE)
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
  
  const graduationYears = educationInfo
    .map(edu => edu.graduationYear)
    .filter(year => year)
    .sort((a, b) => b - a);
  
  const latestGraduation = graduationYears[0];
  const estimatedAge = latestGraduation ? new Date().getFullYear() - parseInt(latestGraduation) + 22 : null;
  
  return `LinkedIn Profile Information:
Name: ${general.fullName || 'Not found'}
Location: ${general.location || 'Not found'}

*** CRITICAL FOR AGE ESTIMATION ***
Education History:
${educationInfo.map(edu => 
  `- ${edu.school}: ${edu.degree} (${edu.dateRange})${edu.graduationYear ? ` → Graduated: ${edu.graduationYear}` : ''}`
).join('\n') || 'No education information found'}

Age Estimation:
${latestGraduation ? `Latest Graduation: ${latestGraduation} → Estimated Age: ~${estimatedAge} years old` : 'Cannot estimate age - no graduation dates found'}

Contact Information:
- LinkedIn: ${general.profileUrl || originalUrl}
- Location: ${general.location || 'Not specified'}`;
}

async function testPhantomBuster() {
  try {
    console.log(`\n🔗 Testing with URL: ${TEST_LINKEDIN_URL}`);
    console.log(`⏰ Starting at: ${new Date().toISOString()}`);
    
    // Step 1: Launch phantom (exact same request as our app)
    console.log('\n📤 Step 1: Launching PhantomBuster...');
    const launchPayload = {
      argument: JSON.stringify({
        profileUrls: [TEST_LINKEDIN_URL],
        sessionCookie: process.env.LINKEDIN_SESSION_COOKIE
      })
    };
    
    console.log(`Payload size: ${JSON.stringify(launchPayload).length} chars`);
    
    const launchResponse = await axios.post(
      `${PHANTOMBUSTER_BASE_URL}/agent/${process.env.PHANTOMBUSTER_PHANTOM_ID}/launch`,
      launchPayload,
      {
        headers: {
          'X-Phantombuster-Key': process.env.PHANTOMBUSTER_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );
    
    console.log(`✅ Launch successful: ${launchResponse.status} ${launchResponse.statusText}`);
    console.log(`📊 Launch response:`, JSON.stringify(launchResponse.data, null, 2));
    
    // Step 2: Poll for completion (exact same logic as our app)
    console.log('\n⏳ Step 2: Polling for completion...');
    let attempts = 0;
    const maxAttempts = 15; // Same as our app
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 30000)); // Same 30 second interval
      attempts++;
      
      console.log(`\n📊 Polling attempt ${attempts}/${maxAttempts} at ${new Date().toISOString()}`);
      
      const statusResponse = await axios.get(
        `${PHANTOMBUSTER_BASE_URL}/agent/${process.env.PHANTOMBUSTER_PHANTOM_ID}/output`,
        {
          headers: { 'X-Phantombuster-Key': process.env.PHANTOMBUSTER_API_KEY }
        }
      );
      
      console.log(`Status response: ${statusResponse.status} ${statusResponse.statusText}`);
      
      const containerStatus = statusResponse.data?.data?.containerStatus;
      const agentStatus = statusResponse.data?.data?.agentStatus;
      
      console.log(`Container Status: ${containerStatus}`);
      console.log(`Agent Status: ${agentStatus}`);
      
      // Same completion check as our app
      if (containerStatus === 'not running' && agentStatus === 'not running') {
        const results = statusResponse.data?.data?.resultObject;
        console.log(`\n✅ PhantomBuster completed after ${attempts} attempts (${attempts * 30} seconds)`);
        
        if (results && results.length > 0) {
          console.log(`\n🎉 FULL RESPONSE (like working script):`, JSON.stringify(statusResponse.data, null, 4));
          console.log(`\n📊 Raw results[0]:`, JSON.stringify(results[0], null, 2));
          
          const formattedData = formatLinkedInResults(statusResponse.data, TEST_LINKEDIN_URL);
          console.log(`\n📋 Formatted results:\n${formattedData}`);
          
          console.log(`\n🎉 SUCCESS: PhantomBuster test completed successfully!`);
          return;
        } else {
          console.log(`⚠️  No results found in response`);
          console.log(`Full response (like working script):`, JSON.stringify(statusResponse.data, null, 4));
          return;
        }
      }
      
      if (containerStatus === 'error' || agentStatus === 'error') {
        console.error(`❌ PhantomBuster reported error status`);
        console.error(`Full response:`, JSON.stringify(statusResponse.data, null, 2));
        return;
      }
      
      console.log(`⏳ Still running... waiting 30 seconds`);
    }
    
    console.error(`❌ PhantomBuster timed out after ${maxAttempts} attempts (${maxAttempts * 30} seconds)`);
    
  } catch (error) {
    console.error(`\n❌ Test failed with error:`);
    console.error(`Error type: ${error.code || 'unknown'}`);
    console.error(`Error message: ${error.message}`);
    
    if (error.response) {
      console.error(`HTTP Status: ${error.response.status} ${error.response.statusText}`);
      console.error(`Response data:`, JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.request) {
      console.error(`Request details:`, {
        method: error.request.method,
        url: error.request.path,
        headers: error.request._headers
      });
    }
  }
}

// Run the test
testPhantomBuster().then(() => {
  console.log(`\n⏰ Test completed at: ${new Date().toISOString()}`);
  process.exit(0);
}).catch(error => {
  console.error(`\n💥 Unexpected error:`, error);
  process.exit(1);
});