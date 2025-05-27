const fs = require('fs');
const path = require('path');

class CompanyLoader {
  constructor(dataFilePath = 'company_info.json') {
    this.dataFilePath = path.resolve(dataFilePath);
  }

  /**
   * Load companies from JSON file
   * @returns {Array} Array of company objects
   */
  loadCompanies() {
    try {
      if (!fs.existsSync(this.dataFilePath)) {
        console.warn(`Company data file not found: ${this.dataFilePath}`);
        return [];
      }

      const data = fs.readFileSync(this.dataFilePath, 'utf8');
      const companies = JSON.parse(data);
      
      if (!Array.isArray(companies)) {
        throw new Error('Company data must be an array');
      }

      console.log(`Loaded ${companies.length} companies from ${this.dataFilePath}`);
      return companies;
    } catch (error) {
      console.error('Error loading companies:', error.message);
      throw error;
    }
  }

  /**
   * Save companies back to JSON file
   * @param {Array} companies - Updated company objects
   */
  saveCompanies(companies) {
    try {
      const data = JSON.stringify(companies, null, 2);
      fs.writeFileSync(this.dataFilePath, data, 'utf8');
      console.log(`Saved ${companies.length} companies to ${this.dataFilePath}`);
    } catch (error) {
      console.error('Error saving companies:', error.message);
      throw error;
    }
  }

  /**
   * Get company information as a formatted string
   * @param {Object} company - Company object
   * @returns {string} Formatted company information
   */
  formatCompanyInfo(company) {
    const info = [];
    
    if (company.name) info.push(`Company: ${company.name}`);
    if (company.website) info.push(`Website: ${company.website}`);
    if (company.linkedin) info.push(`LinkedIn: ${company.linkedin}`);
    if (company.city && company.state) info.push(`Location: ${company.city}, ${company.state}`);
    if (company.phone) info.push(`Phone: ${company.phone}`);
    if (company.revenue) info.push(`Revenue: ${company.revenue}`);
    if (company['president/owner/ceo']) info.push(`CEO/Owner: ${company['president/owner/ceo']}`);
    
    // Add any additional fields from 'other'
    if (company.other && typeof company.other === 'object') {
      Object.entries(company.other).forEach(([key, value]) => {
        if (value && value.toString().trim()) {
          info.push(`${key}: ${value}`);
        }
      });
    }

    return info.join('\n');
  }

}

module.exports = CompanyLoader;