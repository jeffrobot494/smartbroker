const readline = require('readline');
const ResearchEngine = require('./research-engine');

class TerminalInterface {
  constructor() {
    this.engine = new ResearchEngine();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.verbosity = 1;
    this.waitBetweenTools = false;
  }

  /**
   * Main application entry point
   */
  async run() {
    try {
      // 1) Load companies and tell count
      const companies = this.engine.loadCompanies();
      if (companies.length === 0) {
        console.log('❌ No companies found. Please run csv-to-json.js first to convert your CSV data.');
        process.exit(1);
      }
      console.log(`📊 Loaded ${companies.length} companies from data.`);
      
      // 2) Show research template
      this.showResearchTemplate();
      
      // 3) Main menu loop
      while (true) {
        await this.showMainMenu(companies);
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }

  /**
   * Show the research template (system prompt + criteria)
   */
  showResearchTemplate() {
    const template = this.engine.getTemplateInfo();
    
    console.log(`\n📋 Current Research Template: ${template.name}`);
    console.log('='.repeat(50));
    console.log('\n🤖 System Prompt:');
    console.log(template.systemPrompt.substring(0, 200) + '...');
    
    console.log('\n📝 Available Criteria:');
    template.criteria.forEach((criterion, index) => {
      const flag = criterion.disqualifying ? '🚫' : '📊';
      console.log(`${index + 1}. ${flag} ${criterion.name}`);
    });
  }

  /**
   * Main menu (exactly as specified in requirements)
   */
  async showMainMenu(companies) {
    console.log('\n🎯 Menu Options:');
    console.log('1. Perform research');
    console.log('2. View results');
    console.log('3. Edit options');

    const choice = await this.promptUser('\nEnter option number: ');

    switch (choice.trim()) {
      case '1':
        await this.performResearch(companies);
        break;
      case '2':
        await this.viewResults(companies);
        break;
      case '3':
        await this.editOptions();
        break;
      default:
        console.log('❌ Invalid option. Please enter 1, 2, or 3.');
    }
  }

  /**
   * Perform Research workflow (following requirements exactly)
   */
  async performResearch(companies) {
    const template = this.engine.getTemplateInfo();

    // Ask for company range
    const rangeStr = await this.promptUser('Enter company range (e.g., 1-10, 50-100): ');
    const range = this.parseRange(rangeStr, companies.length);
    if (!range) {
      console.log('❌ Invalid range format.');
      return;
    }

    // Ask to choose criterion
    console.log('\n📋 Available Criteria:');
    template.criteria.forEach((criterion, index) => {
      const flag = criterion.disqualifying ? '🚫' : '📊';
      console.log(`${index + 1}. ${flag} ${criterion.name}`);
    });

    const criterionChoice = await this.promptUser('Choose criterion number: ');
    const criterionIndex = parseInt(criterionChoice) - 1;
    if (criterionIndex < 0 || criterionIndex >= template.criteria.length) {
      console.log('❌ Invalid criterion number.');
      return;
    }
    const selectedCriterion = template.criteria[criterionIndex];

    // Ask about remaining criteria
    const doRemaining = await this.promptUser('Do remaining criteria after this one? (y/n): ');
    const continueWithRemaining = doRemaining.toLowerCase() === 'y';

    // Ask about verbosity (default 1)
    const verbosityStr = await this.promptUser('Verbosity level (1-3, default 1): ');
    this.verbosity = verbosityStr.trim() === '' ? 1 : parseInt(verbosityStr) || 1;

    // Ask about waiting between tool uses
    const waitStr = await this.promptUser('Wait between tool uses? (nothing for no, 1 for yes): ');
    this.waitBetweenTools = waitStr.trim() === '1';

    // Determine criteria to run
    const criteriaNames = continueWithRemaining 
      ? template.criteria.slice(criterionIndex).map(c => c.name)
      : [selectedCriterion.name];

    console.log('\n🚀 Starting research...');
    console.log('='.repeat(60));

    // Execute research using engine
    try {
      await this.engine.researchCompanyRange(
        companies,
        range.start,
        range.end,
        criteriaNames,
        {
          verbosity: this.verbosity,
          waitBetweenTools: this.waitBetweenTools,
          continueWithRemaining
        },
        this.createProgressCallback()
      );

      console.log('\n✅ Research complete!');
    } catch (error) {
      console.error('❌ Research failed:', error.message);
    }
  }

  /**
   * Create progress callback for research engine
   */
  createProgressCallback() {
    return async (progress) => {
      switch (progress.type) {
        case 'criterion_start':
          console.log(`\n🎯 Starting criterion: ${progress.criterion}`);
          console.log('─'.repeat(40));
          break;

        case 'company_start':
          if (this.verbosity >= 1) {
            console.log(`\n📍 Company ${progress.index}: ${progress.company}`);
            console.log(`🔍 Criterion: ${progress.criterion}`);
          }
          break;

        case 'company_skipped':
          if (this.verbosity >= 1) {
            const reason = progress.reason === 'disqualified' ? 'already disqualified' : 'already researched';
            console.log(`⏭️  Skipping - ${reason}`);
          }
          break;

        case 'prompt_sent':
          if (this.verbosity >= 3 && progress.prompt) {
            console.log('\n📝 Initial Prompt:');
            console.log(progress.prompt);
          }
          break;

        case 'claude_response':
          if (this.verbosity >= 3 && progress.content) {
            console.log('\n📤 Claude Response:');
            console.log(progress.content);
          }
          break;

        case 'automatic_query':
          if (this.verbosity >= 1) {
            console.log(`🔍 Automatic search: "${progress.query}"`);
          }
          break;

        case 'automatic_query_result':
          if (this.verbosity >= 2 && progress.result) {
            console.log('\n📊 Automatic Search Result:');
            console.log(progress.result.substring(0, 300) + '...');
          }
          break;

        case 'automatic_query_error':
          console.error(`❌ Automatic search error: ${progress.error}`);
          break;

        case 'tool_request':
          if (this.verbosity >= 1) {
            console.log(`🔧 Additional tool use: ${progress.toolName} - "${progress.query}"`);
          }
          break;

        case 'tool_approval_needed':
          if (this.waitBetweenTools) {
            const userInput = await this.promptUser('Press Enter to approve, or type alternate tool use: ');
            if (userInput.trim() !== '') {
              const altMatch = userInput.match(/(\w+):\s*(.+)/);
              if (altMatch) {
                progress.onApproval({ override: altMatch[2] });
                console.log(`🔄 Using alternate query: "${altMatch[2]}"`);
                return;
              }
            }
            progress.onApproval({});
          }
          break;

        case 'tool_result':
          if (this.verbosity >= 2 && progress.result) {
            console.log('\n📊 Tool Result:');
            console.log(progress.result.substring(0, 300) + '...');
          }
          if (progress.userOverride) {
            console.log(`🔄 Used alternate query: "${progress.userOverride}"`);
          }
          break;

        case 'final_result':
          if (this.verbosity >= 1) {
            console.log(`✅ Final Answer: ${progress.answer}`);
          }
          break;

        case 'company_disqualified':
          if (this.verbosity >= 1) {
            console.log(`❌ Company disqualified by ${progress.reason}`);
          }
          break;

        case 'research_error':
          console.error(`❌ Research error: ${progress.error}`);
          break;
      }
    };
  }

  /**
   * Parse range string like "1-10" or "50-100"
   */
  parseRange(rangeStr, maxCompanies) {
    const match = rangeStr.match(/^(\d+)-(\d+)$/);
    if (!match) return null;

    const start = parseInt(match[1]) - 1; // Convert to 0-based
    const end = parseInt(match[2]) - 1;   // Convert to 0-based

    if (start < 0 || end >= maxCompanies || start > end) {
      return null;
    }

    return { start, end };
  }

  /**
   * View Results (with pagination as specified)
   */
  async viewResults(companies) {
    let page = 0;
    const pageSize = 20;

    while (true) {
      const tableData = await this.engine.getResultsTable(companies, page, pageSize);

      console.log('\n📈 Research Results');
      console.log('='.repeat(60));

      // Header
      let header = 'Company'.padEnd(25);
      tableData.criteria.forEach(criterion => {
        header += criterion.name.substring(0, 8).padEnd(10);
      });
      console.log(header);
      console.log('-'.repeat(header.length));

      // Rows
      tableData.data.forEach(row => {
        let line = `${row.index}. ${row.name.substring(0, 20)}`.padEnd(25);
        
        tableData.criteria.forEach(criterion => {
          const symbol = row.results[criterion.name] || '  ';
          line += symbol.padEnd(10);
        });
        
        console.log(line);
      });

      const { pagination } = tableData;
      console.log(`\nShowing ${pagination.start}-${pagination.end} of ${pagination.totalCompanies} companies`);
      console.log('\n1. Return to main menu');
      console.log('2. Previous 20 companies');
      console.log('3. Next 20 companies');

      const choice = await this.promptUser('Enter option: ');

      switch (choice.trim()) {
        case '1':
          return;
        case '2':
          if (page > 0) page--;
          break;
        case '3':
          if ((page + 1) * pageSize < companies.length) page++;
          break;
        default:
          console.log('❌ Invalid option.');
      }
    }
  }

  /**
   * Edit Options menu (placeholders as specified)
   */
  async editOptions() {
    const template = this.engine.getTemplateInfo();
    
    console.log(`\n⚙️  Current Template: ${template.name}`);
    console.log('\n1. Edit templates');
    console.log('2. Edit system prompt');
    console.log('3. Edit criteria');
    console.log('4. Clear research data');

    const choice = await this.promptUser('Enter option: ');

    switch (choice.trim()) {
      case '1':
        await this.editTemplates();
        break;
      case '2':
        await this.editSystemPrompt();
        break;
      case '3':
        await this.editCriteria();
        break;
      case '4':
        await this.clearResearchData();
        break;
      default:
        console.log('❌ Invalid option.');
    }
  }

  /**
   * Placeholder methods for editing (to be implemented later)
   */
  async editTemplates() {
    console.log('\n📋 Current Template: Default');
    console.log('📋 All Templates: Default');
    console.log('\n1. Switch template');
    console.log('2. Create new template');
    console.log('3. Delete template');
    console.log('\n🚧 Template editing not yet implemented');
    await this.promptUser('Press Enter to continue...');
  }

  async editSystemPrompt() {
    console.log('🚧 System prompt editing not yet implemented');
    await this.promptUser('Press Enter to continue...');
  }

  async editCriteria() {
    const template = this.engine.getTemplateInfo();
    console.log('\n📝 Current Criteria:');
    template.criteria.forEach((criterion, index) => {
      const flag = criterion.disqualifying ? '🚫' : '📊';
      console.log(`${index + 1}. ${flag} ${criterion.name} - ${criterion.description}`);
    });
    console.log('\n🚧 Criteria editing not yet implemented');
    await this.promptUser('Press Enter to continue...');
  }

  async clearResearchData() {
    console.log('\n⚠️  Clear Research Data');
    console.log('This will permanently delete ALL research results from the database.');
    console.log('Companies and their research history will be removed.');
    
    const confirmation = await this.promptUser('\nAre you sure you want to continue? (y/N): ');
    
    if (confirmation.toLowerCase() !== 'y') {
      console.log('❌ Operation cancelled.');
      return;
    }

    const doubleConfirm = await this.promptUser('Type "DELETE" to confirm: ');
    
    if (doubleConfirm !== 'DELETE') {
      console.log('❌ Operation cancelled.');
      return;
    }

    try {
      console.log('\n🔄 Clearing research data...');
      const summary = await this.engine.clearAllResults();
      
      console.log(`✅ Research data cleared successfully!`);
      console.log(`📊 Deleted ${summary.deletedResults} research results`);
      console.log(`🏢 Deleted ${summary.deletedCompanies} company records`);
      
    } catch (error) {
      console.error(`❌ Failed to clear research data: ${error.message}`);
    }

    await this.promptUser('\nPress Enter to continue...');
  }

  /**
   * Prompt user for input
   */
  promptUser(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  /**
   * Close readline interface
   */
  close() {
    this.rl.close();
  }
}

module.exports = TerminalInterface;