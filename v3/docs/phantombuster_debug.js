const axios = require('axios');

// Your actual credentials
const PHANTOMBUSTER_API_KEY = 'j3gdLOXdcVyCiyehPhrvnOmrJasqkfIuuerVj0yRKhk';
const PHANTOM_ID = '5165059492418578';

// Test different API endpoints to find the correct one
async function debugPhantomBuster() {
    console.log('🔍 Debugging PhantomBuster API endpoints...\n');

    const headers = {
        'X-Phantombuster-Key': PHANTOMBUSTER_API_KEY,
        'Content-Type': 'application/json'
    };

    // Test 1: Check if phantom exists with v2 API
    console.log('1️⃣ Testing V2 API - Get phantom info...');
    try {
        const response = await axios.get(`https://api.phantombuster.com/api/v2/phantoms/${PHANTOM_ID}`, { headers });
        console.log('✅ V2 Phantom exists!');
        console.log('Phantom info:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log('❌ V2 Phantom endpoint failed:', error.response?.status, error.response?.statusText);
        console.log('Error details:', error.response?.data);
    }

    console.log('\n');

    // Test 2: Check if phantom exists with v1 API
    console.log('2️⃣ Testing V1 API - Get agent info...');
    try {
        const response = await axios.get(`https://api.phantombuster.com/api/v1/agent/${PHANTOM_ID}`, { headers });
        console.log('✅ V1 Agent exists!');
        console.log('Agent info:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log('❌ V1 Agent endpoint failed:', error.response?.status, error.response?.statusText);
        console.log('Error details:', error.response?.data);
    }

    console.log('\n');

    // Test 3: List all phantoms/agents to see what's available
    console.log('3️⃣ Testing - List all available phantoms...');
    try {
        const response = await axios.get('https://api.phantombuster.com/api/v2/phantoms', { headers });
        console.log('✅ Retrieved phantom list!');
        console.log('Available phantoms:');
        response.data.forEach((phantom, index) => {
            console.log(`${index + 1}. ID: ${phantom.id}, Name: ${phantom.name}`);
        });
    } catch (error) {
        console.log('❌ List phantoms failed:', error.response?.status, error.response?.statusText);
        console.log('Error details:', error.response?.data);
    }

    console.log('\n');

    // Test 4: Try V1 agents list
    console.log('4️⃣ Testing V1 - List all available agents...');
    try {
        const response = await axios.get('https://api.phantombuster.com/api/v1/agents', { headers });
        console.log('✅ Retrieved agent list!');
        console.log('Available agents:');
        if (response.data.data) {
            response.data.data.forEach((agent, index) => {
                console.log(`${index + 1}. ID: ${agent.id}, Name: ${agent.name}`);
            });
        }
    } catch (error) {
        console.log('❌ List agents failed:', error.response?.status, error.response?.statusText);
        console.log('Error details:', error.response?.data);
    }

    console.log('\n');

    // Test 5: Check account info
    console.log('5️⃣ Testing - Account info...');
    try {
        const response = await axios.get('https://api.phantombuster.com/api/v2/user', { headers });
        console.log('✅ Account info retrieved!');
        console.log('Account:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log('❌ Account info failed:', error.response?.status, error.response?.statusText);
        console.log('Error details:', error.response?.data);
    }

    console.log('\n🏁 Debug complete!');
    console.log('\n💡 Next steps:');
    console.log('1. Check which API version works (v1 vs v2)');
    console.log('2. Verify your phantom ID exists in the list above');
    console.log('3. Use the correct endpoint format for launching');
}

// Run the debug
debugPhantomBuster();