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
      // 0) Initialize research engine with template from database
      await this.engine.initialize();
      
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
    const verbosityStr = await this.promptUser('Verbosity level (1-4, default 1): ');
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

      // Show cost summary after research completes
      await this.showCostSummary();

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

        case 'claude_message_sent':
          if (this.verbosity >= 4 && progress.payload) {
            console.log('\n📦 Complete message sent to Claude:');
            console.log('━'.repeat(60));
            console.log(`🤖 Model: ${progress.payload.model}`);
            console.log(`🔢 Max Tokens: ${progress.payload.maxTokens}`);
            console.log('\n📋 System Prompt:');
            console.log('─'.repeat(30));
            console.log(progress.payload.systemPrompt);
            console.log('\n💬 Conversation:');
            console.log('─'.repeat(30));
            progress.payload.messages.forEach((msg, index) => {
              const icon = msg.role === 'user' ? '👤' : '🤖';
              console.log(`${icon} ${msg.role.toUpperCase()}:`);
              console.log(msg.content);
              if (index < progress.payload.messages.length - 1) {
                console.log(''); // Add spacing between messages
              }
            });
            console.log('━'.repeat(60));
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

        case 'automatic_query_skipped':
          if (this.verbosity >= 1) {
            console.log(`ℹ️  Skipping automatic search - no first query template defined`);
          }
          break;

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
            if (progress.toolName === 'phantombuster_linkedin') {
              console.log('\n📊 PhantomBuster LinkedIn Results:');
              console.log(progress.result.substring(0, 800) + (progress.result.length > 800 ? '...' : ''));
            } else {
              console.log('\n📊 Tool Result:');
              console.log(progress.result.substring(0, 300) + '...');
            }
          }
          if (progress.userOverride) {
            console.log(`🔄 Used alternate query: "${progress.userOverride}"`);
          }
          break;

        case 'final_result':
          if (this.verbosity >= 1) {
            let resultText = `✅ Final Answer: ${progress.answer}`;
            
            // Add confidence display for verbosity 2+
            if (this.verbosity >= 2) {
              resultText += this.formatConfidenceDisplay(progress.confidence_score);
            }
            
            console.log(resultText);
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
   * Template management interface
   */
  async editTemplates() {
    while (true) {
      try {
        const templates = await this.engine.getTemplateList();
        this.displayTemplateMenu(templates);
        
        const choice = await this.promptUser('\nEnter option: ');
        
        if (choice === '4') return;
        
        const shouldContinue = await this.handleTemplateChoice(choice, templates);
        if (shouldContinue) continue;
        
      } catch (error) {
        console.error('❌ Template management error:', error.message);
        await this.promptUser('Press Enter to continue...');
      }
    }
  }

  /**
   * Display template management menu (Pure UI)
   */
  displayTemplateMenu(templates) {
    const activeTemplate = templates.find(t => t.is_active);
    
    console.log('\n📋 Template Management');
    console.log('='.repeat(50));
    console.log(`🎯 Current Active: ${activeTemplate.name}\n`);
    
    console.log('📋 Available Templates:');
    templates.forEach((template, index) => {
      const marker = template.is_active ? ' ✓ (Active)' : '';
      console.log(`${index + 1}. ${template.name}${marker}`);
    });
    
    console.log('\n⚙️ Options:');
    console.log('1. Switch active template');
    console.log('2. Create new template');
    console.log('3. Delete template');
    console.log('4. Back to main menu');
  }

  /**
   * Handle user menu choice (Minimal UI logic, delegates to engine)
   */
  async handleTemplateChoice(choice, templates) {
    switch (choice.trim()) {
      case '1':
        await this.switchTemplateFlow(templates);
        return true;
      case '2':
        await this.createTemplateFlow(templates);
        return true;
      case '3':
        await this.deleteTemplateFlow(templates);
        return true;
      default:
        console.log('❌ Invalid option. Please enter 1-4.');
        return true;
    }
  }

  /**
   * Template switching workflow
   */
  async switchTemplateFlow(templates) {
    const inactiveTemplates = templates.filter(t => !t.is_active);
    
    if (inactiveTemplates.length === 0) {
      console.log('❌ No other templates to switch to.');
      await this.promptUser('Press Enter to continue...');
      return;
    }
    
    console.log('\n🔄 Switch Active Template');
    inactiveTemplates.forEach((template, index) => {
      console.log(`${index + 1}. ${template.name}`);
    });
    
    const choice = await this.promptUser('\nEnter template number (or 0 to cancel): ');
    if (choice === '0') return;
    
    const templateIndex = parseInt(choice) - 1;
    if (templateIndex < 0 || templateIndex >= inactiveTemplates.length) {
      console.log('❌ Invalid template number.');
      return;
    }
    
    const selectedTemplate = inactiveTemplates[templateIndex];
    
    try {
      const newTemplate = await this.engine.switchToTemplate(selectedTemplate.id);
      console.log(`✅ Switched to template: ${newTemplate.name}`);
    } catch (error) {
      console.error('❌ Failed to switch template:', error.message);
    }
    
    await this.promptUser('Press Enter to continue...');
  }

  /**
   * Template creation workflow
   */
  async createTemplateFlow(templates) {
    console.log('\n➕ Create New Template');
    
    const name = await this.promptUser('Enter template name: ');
    if (!name.trim()) {
      console.log('❌ Template name cannot be empty.');
      await this.promptUser('Press Enter to continue...');
      return;
    }
    
    console.log('\nBase template options:');
    console.log('0. Create empty template');
    templates.forEach((template, index) => {
      console.log(`${index + 1}. Copy from: ${template.name}`);
    });
    
    const baseChoice = await this.promptUser('\nEnter option (0 for empty): ');
    let basedOnTemplateId = null;
    
    if (baseChoice !== '0') {
      const baseIndex = parseInt(baseChoice) - 1;
      if (baseIndex < 0 || baseIndex >= templates.length) {
        console.log('❌ Invalid option.');
        return;
      }
      basedOnTemplateId = templates[baseIndex].id;
    }
    
    const makeActive = await this.promptUser('Make this template active? (y/N): ');
    const shouldActivate = makeActive.toLowerCase() === 'y';
    
    try {
      const result = await this.engine.createNewTemplate(name.trim(), basedOnTemplateId, shouldActivate);
      console.log(`✅ Created template: ${name}`);
      if (shouldActivate) {
        console.log('✅ Template activated and research engine reloaded');
      }
    } catch (error) {
      console.error('❌ Failed to create template:', error.message);
    }
    
    await this.promptUser('Press Enter to continue...');
  }

  /**
   * Template deletion workflow
   */
  async deleteTemplateFlow(templates) {
    const inactiveTemplates = templates.filter(t => !t.is_active);
    
    if (inactiveTemplates.length === 0) {
      console.log('❌ No inactive templates to delete.');
      console.log('💡 Switch to another template first to delete the current one.');
      await this.promptUser('Press Enter to continue...');
      return;
    }
    
    console.log('\n🗑️ Delete Template');
    console.log('⚠️ This will permanently delete the template and all its research results.');
    console.log('\nInactive templates:');
    
    inactiveTemplates.forEach((template, index) => {
      console.log(`${index + 1}. ${template.name}`);
    });
    
    const choice = await this.promptUser('\nEnter template number (or 0 to cancel): ');
    if (choice === '0') return;
    
    const templateIndex = parseInt(choice) - 1;
    if (templateIndex < 0 || templateIndex >= inactiveTemplates.length) {
      console.log('❌ Invalid template number.');
      return;
    }
    
    const selectedTemplate = inactiveTemplates[templateIndex];
    
    const confirmation = await this.promptUser(`⚠️ Delete "${selectedTemplate.name}"? Type "DELETE" to confirm: `);
    if (confirmation !== 'DELETE') {
      console.log('❌ Deletion cancelled.');
      return;
    }
    
    try {
      await this.engine.removeTemplate(selectedTemplate.id);
      console.log(`✅ Deleted template: ${selectedTemplate.name}`);
    } catch (error) {
      console.error('❌ Failed to delete template:', error.message);
    }
    
    await this.promptUser('Press Enter to continue...');
  }

  async editSystemPrompt() {
    try {
      const template = this.engine.getTemplateInfo();
      console.log(`\n📝 Edit System Prompt for Template: ${template.name}`);
      console.log('━'.repeat(60));
      
      // Get current system prompt
      const currentPrompt = await this.engine.getSystemPrompt(template.id);
      
      console.log('\n🔍 Current System Prompt:');
      console.log('─'.repeat(40));
      console.log(currentPrompt);
      console.log('─'.repeat(40));
      console.log(`\n📊 Current length: ${currentPrompt.length} characters`);
      
      console.log('\n✏️  Enter new system prompt (multi-line input)');
      console.log('💡 Tips: Enter your text, then type "DONE" on a new line when finished');
      console.log('        Type "CANCEL" to abort without saving');
      
      // Multi-line input handling
      const lines = [];
      let line;
      
      while (true) {
        line = await this.promptUser('> ');
        
        if (line.trim() === 'DONE') {
          break;
        } else if (line.trim() === 'CANCEL') {
          console.log('❌ Edit cancelled.');
          return;
        }
        
        lines.push(line);
      }
      
      const newPrompt = lines.join('\n').trim();
      
      if (!newPrompt) {
        console.log('❌ System prompt cannot be empty. Edit cancelled.');
        return;
      }
      
      // Show preview and confirm
      console.log('\n📋 New System Prompt Preview:');
      console.log('─'.repeat(40));
      console.log(newPrompt);
      console.log('─'.repeat(40));
      console.log(`📊 New length: ${newPrompt.length} characters`);
      
      const confirmation = await this.promptUser('\n💾 Save this system prompt? (y/N): ');
      
      if (confirmation.toLowerCase() !== 'y') {
        console.log('❌ Changes not saved.');
        return;
      }
      
      // Save the new prompt
      await this.engine.updateSystemPrompt(template.id, newPrompt);
      
      console.log('✅ System prompt updated successfully!');
      if (template.id === this.engine.currentTemplate?.id) {
        console.log('🔄 Research engine reloaded with new prompt.');
      }
      
    } catch (error) {
      console.error(`❌ Error editing system prompt: ${error.message}`);
    }
    
    await this.promptUser('\nPress Enter to continue...');
  }

  async editCriteria() {
    while (true) {
      try {
        const template = this.engine.getTemplateInfo();
        console.log(`\n📝 Edit Criteria for Template: ${template.name}`);
        console.log('━'.repeat(60));
        
        this.displayCriteriaMenu(template.criteria);
        
        const choice = await this.promptUser('\nEnter option: ');
        
        if (choice === '6') return;
        
        const shouldContinue = await this.handleCriteriaChoice(choice, template);
        if (shouldContinue) continue;
        
      } catch (error) {
        console.error('❌ Criteria management error:', error.message);
        await this.promptUser('Press Enter to continue...');
      }
    }
  }

  displayCriteriaMenu(criteria) {
    console.log('\n📋 Current Criteria:');
    if (criteria.length === 0) {
      console.log('   (No criteria defined)');
    } else {
      criteria.forEach((criterion, index) => {
        const flag = criterion.disqualifying ? '🚫' : '📊';
        console.log(`   ${criterion.order_index || index + 1}. ${flag} ${criterion.name} - ${criterion.description}`);
      });
    }
    
    console.log('\n🔧 Criteria Management:');
    console.log('1. Add new criterion');
    console.log('2. Edit existing criterion');
    console.log('3. Delete criterion');
    console.log('4. Reorder criterion');
    console.log('5. View criterion details');
    console.log('6. Back to main menu');
  }

  async handleCriteriaChoice(choice, template) {
    switch (choice.trim()) {
      case '1':
        await this.addCriterionFlow(template);
        break;
      case '2':
        await this.editCriterionFlow(template);
        break;
      case '3':
        await this.deleteCriterionFlow(template);
        break;
      case '4':
        await this.reorderCriterionFlow(template);
        break;
      case '5':
        await this.viewCriterionDetailsFlow(template);
        break;
      default:
        console.log('❌ Invalid option.');
        return true;
    }
    return true;
  }

  async addCriterionFlow(template) {
    try {
      console.log('\n➕ Add New Criterion');
      console.log('─'.repeat(30));
      
      // Get next available order index
      const nextOrder = await this.engine.template.getNextOrderIndex(template.id);
      
      const name = await this.promptUser('Criterion name: ');
      if (!name.trim()) {
        console.log('❌ Name is required.');
        return;
      }
      
      const description = await this.promptUser('Description (research question): ');
      if (!description.trim()) {
        console.log('❌ Description is required.');
        return;
      }
      
      const answerFormat = await this.promptUser('Expected answer format: ');
      if (!answerFormat.trim()) {
        console.log('❌ Answer format is required.');
        return;
      }
      
      const firstQueryTemplate = await this.promptUser('First query template (optional - leave empty to skip automatic search, use {company_name}, {city}, etc.): ');
      
      const disqualifyingStr = await this.promptUser('Is this disqualifying? (y/n): ');
      const disqualifying = disqualifyingStr.toLowerCase() === 'y';
      
      const orderStr = await this.promptUser(`Order index (default ${nextOrder}): `);
      const orderIndex = orderStr.trim() === '' ? nextOrder : parseInt(orderStr) || nextOrder;
      
      const criterionData = {
        name: name.trim(),
        description: description.trim(),
        answer_format: answerFormat.trim(),
        first_query_template: firstQueryTemplate.trim() || null,
        disqualifying,
        order_index: orderIndex
      };
      
      const confirmation = await this.promptUser('\n💾 Create this criterion? (y/N): ');
      if (confirmation.toLowerCase() !== 'y') {
        console.log('❌ Creation cancelled.');
        return;
      }
      
      await this.engine.addCriterion(template.id, criterionData);
      console.log('✅ Criterion created successfully!');
      if (template.id === this.engine.currentTemplate?.id) {
        console.log('🔄 Research engine reloaded with new criteria.');
      }
      
    } catch (error) {
      console.error(`❌ Error creating criterion: ${error.message}`);
    }
  }

  async editCriterionFlow(template) {
    try {
      if (template.criteria.length === 0) {
        console.log('❌ No criteria to edit.');
        return;
      }
      
      console.log('\n✏️  Edit Criterion');
      console.log('─'.repeat(20));
      
      template.criteria.forEach((criterion, index) => {
        console.log(`${index + 1}. ${criterion.name}`);
      });
      
      const indexStr = await this.promptUser('\nSelect criterion number: ');
      const index = parseInt(indexStr) - 1;
      
      if (index < 0 || index >= template.criteria.length) {
        console.log('❌ Invalid selection.');
        return;
      }
      
      const criterion = template.criteria[index];
      console.log(`\n📝 Editing: ${criterion.name}`);
      
      const updates = {};
      
      const name = await this.promptUser(`Name (current: "${criterion.name}"): `);
      if (name.trim()) updates.name = name.trim();
      
      const description = await this.promptUser(`Description (current: "${criterion.description}"): `);
      if (description.trim()) updates.description = description.trim();
      
      const answerFormat = await this.promptUser(`Answer format (current: "${criterion.answerFormat}"): `);
      if (answerFormat.trim()) updates.answer_format = answerFormat.trim();
      
      const firstQuery = await this.promptUser(`First query template (current: "${criterion.firstQueryTemplate || 'none'}"): `);
      if (firstQuery.trim() !== '') updates.first_query_template = firstQuery.trim() || null;
      
      const disqualifyingStr = await this.promptUser(`Disqualifying (current: ${criterion.disqualifying ? 'yes' : 'no'}) (y/n): `);
      if (disqualifyingStr.trim()) updates.disqualifying = disqualifyingStr.toLowerCase() === 'y';
      
      if (Object.keys(updates).length === 0) {
        console.log('❌ No changes made.');
        return;
      }
      
      const confirmation = await this.promptUser('\n💾 Save changes? (y/N): ');
      if (confirmation.toLowerCase() !== 'y') {
        console.log('❌ Changes not saved.');
        return;
      }
      
      await this.engine.modifyCriterion(criterion.id, updates);
      console.log('✅ Criterion updated successfully!');
      if (template.id === this.engine.currentTemplate?.id) {
        console.log('🔄 Research engine reloaded with updated criteria.');
      }
      
    } catch (error) {
      console.error(`❌ Error editing criterion: ${error.message}`);
    }
  }

  async deleteCriterionFlow(template) {
    try {
      if (template.criteria.length === 0) {
        console.log('❌ No criteria to delete.');
        return;
      }
      
      console.log('\n🗑️  Delete Criterion');
      console.log('─'.repeat(20));
      
      template.criteria.forEach((criterion, index) => {
        console.log(`${index + 1}. ${criterion.name}`);
      });
      
      const indexStr = await this.promptUser('\nSelect criterion number: ');
      const index = parseInt(indexStr) - 1;
      
      if (index < 0 || index >= template.criteria.length) {
        console.log('❌ Invalid selection.');
        return;
      }
      
      const criterion = template.criteria[index];
      console.log(`\n⚠️  Delete: ${criterion.name}`);
      console.log('This will permanently delete the criterion and all associated research results.');
      
      const confirmation = await this.promptUser('\n🗑️  Confirm deletion? (y/N): ');
      if (confirmation.toLowerCase() !== 'y') {
        console.log('❌ Deletion cancelled.');
        return;
      }
      
      await this.engine.removeCriterion(criterion.id);
      console.log('✅ Criterion deleted successfully!');
      if (template.id === this.engine.currentTemplate?.id) {
        console.log('🔄 Research engine reloaded with updated criteria.');
      }
      
    } catch (error) {
      console.error(`❌ Error deleting criterion: ${error.message}`);
    }
  }

  async reorderCriterionFlow(template) {
    try {
      if (template.criteria.length === 0) {
        console.log('❌ No criteria to reorder.');
        return;
      }
      
      console.log('\n🔄 Reorder Criterion');
      console.log('─'.repeat(20));
      
      template.criteria.forEach((criterion, index) => {
        console.log(`${index + 1}. Order ${criterion.order_index || index + 1}: ${criterion.name}`);
      });
      
      const indexStr = await this.promptUser('\nSelect criterion number: ');
      const index = parseInt(indexStr) - 1;
      
      if (index < 0 || index >= template.criteria.length) {
        console.log('❌ Invalid selection.');
        return;
      }
      
      const criterion = template.criteria[index];
      const currentOrder = criterion.order_index || index + 1;
      
      const newOrderStr = await this.promptUser(`New order index (current: ${currentOrder}): `);
      const newOrder = parseInt(newOrderStr);
      
      if (!newOrder || newOrder === currentOrder) {
        console.log('❌ Invalid or unchanged order index.');
        return;
      }
      
      await this.engine.reorderCriteria(criterion.id, newOrder);
      console.log('✅ Criterion reordered successfully!');
      if (template.id === this.engine.currentTemplate?.id) {
        console.log('🔄 Research engine reloaded with updated criteria order.');
      }
      
    } catch (error) {
      console.error(`❌ Error reordering criterion: ${error.message}`);
    }
  }

  async viewCriterionDetailsFlow(template) {
    try {
      if (template.criteria.length === 0) {
        console.log('❌ No criteria to view.');
        return;
      }
      
      console.log('\n👁️  View Criterion Details');
      console.log('─'.repeat(25));
      
      template.criteria.forEach((criterion, index) => {
        console.log(`${index + 1}. ${criterion.name}`);
      });
      
      const indexStr = await this.promptUser('\nSelect criterion number: ');
      const index = parseInt(indexStr) - 1;
      
      if (index < 0 || index >= template.criteria.length) {
        console.log('❌ Invalid selection.');
        return;
      }
      
      const criterion = template.criteria[index];
      
      console.log(`\n📋 Criterion Details: ${criterion.name}`);
      console.log('━'.repeat(40));
      console.log(`🏷️  Name: ${criterion.name}`);
      console.log(`📝 Description: ${criterion.description}`);
      console.log(`📄 Answer Format: ${criterion.answerFormat}`);
      console.log(`🔍 First Query Template: ${criterion.firstQueryTemplate || 'None'}`);
      console.log(`🚫 Disqualifying: ${criterion.disqualifying ? 'Yes' : 'No'}`);
      console.log(`📊 Order Index: ${criterion.order_index || 'Not set'}`);
      console.log('━'.repeat(40));
      
    } catch (error) {
      console.error(`❌ Error viewing criterion: ${error.message}`);
    }
    
    await this.promptUser('\nPress Enter to continue...');
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
   * Format confidence score for display
   */
  formatConfidenceDisplay(confidence_score) {
    const CONFIDENCE_LABELS = {
      1: 'guess',
      2: 'probably', 
      3: 'very likely'
    };
    
    if (!confidence_score || !CONFIDENCE_LABELS[confidence_score]) {
      return '';
    }
    
    return ` [Confidence: ${confidence_score}/3 - ${CONFIDENCE_LABELS[confidence_score]}]`;
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
   * Show cost summary after research completion
   */
  async showCostSummary() {
    try {
      const costs = await this.engine.getSessionCostSummary();
      
      console.log('\n💰 Research Cost Summary');
      console.log('='.repeat(40));
      console.log(`💵 Total cost: ${costs.total_cost}`);
      console.log(`📈 Average per company: ${costs.cost_per_company}`);
      console.log(`📊 Companies researched: ${costs.investigations}`);
      
      if (this.verbosity >= 2) {
        console.log('\n📋 Cost breakdown:');
        console.log(`   Claude: ${costs.breakdown.claude}`);
        console.log(`   Perplexity: ${costs.breakdown.perplexity}`);
        console.log(`   PhantomBuster: ${costs.breakdown.phantombuster}`);
      }
    } catch (error) {
      console.error('❌ Failed to get cost summary:', error.message);
    }
  }

  /**
   * Close readline interface
   */
  close() {
    this.rl.close();
  }
}

module.exports = TerminalInterface;