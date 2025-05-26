const fs = require('fs');
const readline = require('readline');

// CSV parsing function that handles escaped commas
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last field
  result.push(current.trim());
  return result;
}

// Transform CSV row to required JSON structure
function transformToCompanyObject(headers, values) {
  const row = {};
  headers.forEach((header, index) => {
    row[header] = values[index] || '';
  });
  
  const company = {
    name: row['Company'] || '',
    website: row['Website'] || '',
    linkedin: row['Company Linkedin Url'] || '',
    city: row['Company City'] || '',
    state: row['Company State'] || '',
    phone: row['Company Phone'] || '',
    revenue: row['Annual Revenue'] || '',
    "president/owner/ceo": '',
    other: {}
  };
  
  // Check if title contains president/owner/ceo
  const title = (row['Title'] || '').toLowerCase();
  if (title.includes('president') || title.includes('owner') || title.includes('ceo')) {
    company["president/owner/ceo"] = `${row['First Name'] || ''} ${row['Last Name'] || ''}`.trim();
  }
  
  // Add remaining fields to "other"
  const usedFields = new Set(['Company', 'Website', 'Company Linkedin Url', 'Company City', 'Company State', 'Company Phone', 'Annual Revenue', 'First Name', 'Last Name', 'Title']);
  headers.forEach(header => {
    if (!usedFields.has(header)) {
      company.other[header] = row[header];
    }
  });
  
  return company;
}

// Interactive duplicate resolution with side-by-side display
async function resolveDuplicate(existingData, newData) {
  console.log('\n=== DUPLICATE COMPANY FOUND ===');
  console.log('Choose which record to keep:\n');
  
  console.log('Option 1 (Current):'.padEnd(50) + 'Option 2 (New):');
  console.log('-'.repeat(100));
  
  // Display all CSV columns side by side
  existingData.headers.forEach((header, index) => {
    const existing = existingData.values[index] || '';
    const newValue = newData.values[index] || '';
    console.log(`${header}: ${existing}`.padEnd(50) + `${header}: ${newValue}`);
  });
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('\nEnter 1 or 2 to choose which record to keep: ', (answer) => {
      rl.close();
      resolve(parseInt(answer));
    });
  });
}

// Main processing function
async function processCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  const headers = parseCSVLine(lines[0]);
  const companies = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const company = transformToCompanyObject(headers, values);
    
    // Check for duplicates based on exact name and website match
    const existingIndex = companies.findIndex(c => 
      c.company.name === company.name && c.company.website === company.website
    );
    
    const currentData = { headers, values, company };
    
    if (existingIndex !== -1) {
      const choice = await resolveDuplicate(companies[existingIndex], currentData);
      if (choice === 2) {
        companies[existingIndex] = currentData;
      }
      // If choice is 1 or invalid, keep existing record
    } else {
      companies.push(currentData);
    }
  }
  
  return companies.map(item => item.company);
}

// Main execution
async function main() {
  const filePath = process.argv[2];
  
  if (!filePath) {
    console.error('Usage: node csv-to-json.js <path-to-csv-file>');
    process.exit(1);
  }
  
  try {
    const csvContent = fs.readFileSync(filePath, 'utf8');
    const companies = await processCSV(csvContent);
    
    // Write to company_info.json
    fs.writeFileSync('company_info.json', JSON.stringify(companies, null, 2));
    console.log(`\nProcessed ${companies.length} unique companies. Output saved to company_info.json`);
  } catch (error) {
    console.error('Error processing file:', error.message);
    process.exit(1);
  }
}

main();