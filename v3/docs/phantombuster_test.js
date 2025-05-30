const axios = require('axios');

// Configuration
const API_KEY = 'j3gdLOXdcVyCiyehPhrvnOmrJasqkfIuuerVj0yRKhk';
const PHANTOM_ID = '5165059492418578';
const LINKEDIN_COOKIE = 'AQEDAQO52eYDBOF8AAABk1bgoawAAAGXPBFOI1YAcEN87kTvpCuiypeBR1ATCgPd8dPc4-a_f9Khywl3hbEIoRbTUqmxOhJe_WChVqiRo8IWFV2qVgz9XgKEueWVwgz5V7ju5pC6gxZHYd26uday4UGl';

const headers = {
    'X-Phantombuster-Key': API_KEY,
    'Content-Type': 'application/json'
};

async function runFullWorkflow() {
    try {
        // 1. Launch phantom
        console.log('🚀 Launching phantom...');
        const launchResponse = await axios.post(
            `https://api.phantombuster.com/api/v1/agent/${PHANTOM_ID}/launch`,
            {
                argument: JSON.stringify({
                    profileUrls: ['https://www.linkedin.com/in/bruce-lebel-a9bb4/'],
                    sessionCookie: LINKEDIN_COOKIE
                })
            },
            { headers }
        );
        
        console.log('✅ Launched! Waiting for completion...');
        
        // 2. Wait for completion and get results
        let attempts = 0;
        while (attempts < 15) { // Max 7.5 minutes
            await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
            
            const resultResponse = await axios.get(
                `https://api.phantombuster.com/api/v1/agent/${PHANTOM_ID}/output`,
                { headers }
            );
            
            const containerStatus = resultResponse.data.data?.containerStatus;
            const agentStatus = resultResponse.data.data?.agentStatus;
            console.log(`📊 Status: ${containerStatus} (attempt ${++attempts})`);
            
            if (containerStatus === 'not running' && agentStatus === 'not running') {
                console.log('\n🎉 FINAL RESULTS:');
                console.log(JSON.stringify(resultResponse.data, null, 4));
                return;
            }
            
            if (containerStatus === 'error') {
                console.log('❌ Phantom failed');
                return;
            }
        }
        
        console.log('⏰ Timeout - phantom took too long');
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

runFullWorkflow();