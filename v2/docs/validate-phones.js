const fs = require('fs');
const https = require('https');

// API Key from the example code
const API_KEY = 'CDonOIX0Ufai8yhlk7QXAWHGpNogttKN';

// Read phone numbers from file
function readPhoneNumbers(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        // Clean the numbers (remove any carriage returns or other whitespace)
        return data.split('\n')
            .map(num => num.trim())
            .filter(num => num.length > 0);
    } catch (err) {
        console.error(`Error reading file: ${err.message}`);
        process.exit(1);
    }
}

// Make a request to the IPQS API
function checkPhoneNumber(phoneNumber) {
    return new Promise((resolve, reject) => {
        const url = `https://www.ipqualityscore.com/api/json/phone/${API_KEY}/${phoneNumber}`;
        
        https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result);
                } catch (err) {
                    reject(new Error(`Failed to parse API response: ${err.message}`));
                }
            });
        }).on('error', (err) => {
            reject(new Error(`API request failed: ${err.message}`));
        });
    });
}

// Process all phone numbers with rate limiting
async function validatePhoneNumbers(phoneNumbers) {
    const results = [];
    let validCount = 0;
    let invalidCount = 0;
    
    console.log(`Starting validation of ${phoneNumbers.length} phone numbers...`);
    
    // Process phone numbers with a delay to respect rate limits
    for (let i = 0; i < phoneNumbers.length; i++) {
        const phoneNumber = phoneNumbers[i];
        
        try {
            console.log(`Checking phone number ${i+1}/${phoneNumbers.length}: ${phoneNumber}`);
            const result = await checkPhoneNumber(phoneNumber);
            
            // Add the phone number to the result for reference
            result.phoneNumber = phoneNumber;
            results.push(result);
            
            if (result.valid === true) {
                validCount++;
            } else {
                invalidCount++;
            }
            
            // Generate a simple progress report
            console.log(`  Status: ${result.valid ? 'VALID ✓' : 'INVALID ✗'} | Carrier: ${result.carrier || 'Unknown'} | Line type: ${result.line_type || 'Unknown'}`);
            
            // Add a small delay between requests to avoid hitting rate limits
            if (i < phoneNumbers.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (err) {
            console.error(`  Error checking ${phoneNumber}: ${err.message}`);
            results.push({
                phoneNumber,
                error: err.message,
                valid: false
            });
            invalidCount++;
        }
    }
    
    return {
        results,
        summary: {
            total: phoneNumbers.length,
            valid: validCount,
            invalid: invalidCount
        }
    };
}

// Save results to a file
function saveResults(results, filePath) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
        console.log(`Results saved to ${filePath}`);
    } catch (err) {
        console.error(`Error saving results: ${err.message}`);
    }
}

// Generate a human-readable report
function generateReport(validationData) {
    const { results, summary } = validationData;
    
    let report = `# Phone Number Validation Report\n\n`;
    report += `Date: ${new Date().toLocaleString()}\n\n`;
    report += `## Summary\n`;
    report += `- Total numbers processed: ${summary.total}\n`;
    report += `- Valid numbers: ${summary.valid}\n`;
    report += `- Invalid numbers: ${summary.invalid}\n\n`;
    
    report += `## Detailed Results\n\n`;
    report += `| Phone Number | Owner Name | Valid | Carrier | Line Type | Country | Fraud Risk |\n`;
    report += `|-------------|------------|-------|---------|-----------|---------|------------|\n`;
    
    results.forEach(result => {
        const valid = result.valid === true ? 'Yes' : 'No';
        const carrier = result.carrier || 'Unknown';
        const lineType = result.line_type || 'Unknown';
        const country = result.country || 'Unknown';
        const fraudRisk = result.fraud_score !== undefined ? `${result.fraud_score}%` : 'Unknown';
        // Add owner's name from the API response
        const ownerName = result.name || 'N/A';
        
        report += `| ${result.phoneNumber} | ${ownerName} | ${valid} | ${carrier} | ${lineType} | ${country} | ${fraudRisk} |\n`;
    });
    
    return report;
}

// Main function
async function main() {
    const inputFile = 'numbers.txt';
    const outputJsonFile = 'validation_results.json';
    const outputReportFile = 'validation_report.md';
    
    console.log(`Reading phone numbers from ${inputFile}...`);
    const phoneNumbers = readPhoneNumbers(inputFile);
    console.log(`Found ${phoneNumbers.length} phone numbers`);
    
    const validationData = await validatePhoneNumbers(phoneNumbers);
    
    // Save the raw results as JSON
    saveResults(validationData, outputJsonFile);
    
    // Generate and save a human-readable report
    const report = generateReport(validationData);
    fs.writeFileSync(outputReportFile, report);
    console.log(`Report saved to ${outputReportFile}`);
}

// Run the script
main().catch(err => {
    console.error(`An error occurred: ${err.message}`);
    process.exit(1);
});