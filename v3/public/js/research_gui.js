class ResearchGUI {
  constructor(app) {
    this.app = app;
    this.selectedCriteria = []; // Track selected criteria names
    this.eventSource = null; // SSE connection
  }

  init() {
    console.log('ResearchGUI: Initializing...');
    this.setupEventListeners();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      this.stopProgressStream();
    });
  }

  onDataChanged() {
    console.log('ResearchGUI: Data changed - companies:', this.app.companies.length);
    this.updateTableHeaders();
    this.populateCompanyTable();
    this.populateCriteriaCheckboxes();
    this.loadExistingResults();
  }

  setupEventListeners() {
    console.log('ResearchGUI: Setting up event listeners...');
    
    // CSV file selection
    document.getElementById('csv-upload').addEventListener('change', (e) => {
      this.onFileSelected(e);
    });

    // CSV import button
    document.getElementById('import-btn').addEventListener('click', () => {
      this.importCompanies();
    });

    // Start research button
    document.getElementById('start-btn').addEventListener('click', () => {
      this.startResearch();
    });

    // Stop research button
    document.getElementById('stop-btn').addEventListener('click', () => {
      this.stopResearch();
    });
  }

  onFileSelected(e) {
    const fileInfo = document.querySelector('.file-info');
    if (e.target.files.length > 0) {
      const fileName = e.target.files[0].name;
      console.log('ResearchGUI: File selected:', fileName);
      fileInfo.textContent = `Selected: ${fileName}`;
      fileInfo.style.color = '#28a745';
    } else {
      console.log('ResearchGUI: No file selected');
      fileInfo.textContent = 'No file selected';
      fileInfo.style.color = '#6c757d';
    }
  }

  async importCompanies() {
    console.log('ResearchGUI: Starting CSV import process...');
    
    const fileInput = document.getElementById('csv-upload');
    if (!fileInput.files[0]) {
      console.log('ResearchGUI: No file selected for import');
      alert('Please select a CSV file first');
      return;
    }

    if (!this.app.template) {
      console.log('ResearchGUI: No template loaded');
      alert('No template loaded');
      return;
    }

    const file = fileInput.files[0];
    console.log('ResearchGUI: Importing file:', {
      name: file.name,
      size: file.size,
      type: file.type,
      templateId: this.app.template.id,
      templateName: this.app.template.name
    });

    const formData = new FormData();
    formData.append('csvFile', file);

    try {
      console.log('ResearchGUI: Sending POST request to /api/template/' + this.app.template.id + '/companies');
      
      const response = await fetch(`/api/template/${this.app.template.id}/companies`, {
        method: 'POST',
        body: formData
      });

      console.log('ResearchGUI: Server response status:', response.status);
      
      const result = await response.json();
      console.log('ResearchGUI: Server response data:', result);
      
      if (result.success) {
        console.log('ResearchGUI: Import successful!', result.count, 'companies imported');
        alert(`Successfully imported ${result.count} companies`);
        
        // Reload template data to get updated companies
        console.log('ResearchGUI: Reloading template data...');
        await this.app.loadTemplate();
        
        // Clear file input
        fileInput.value = '';
        document.querySelector('.file-info').textContent = 'No file selected';
        document.querySelector('.file-info').style.color = '#6c757d';
        
      } else {
        console.log('ResearchGUI: Import failed:', result.error);
        alert('Import failed: ' + result.error);
      }
    } catch (error) {
      console.error('ResearchGUI: Import error:', error);
      alert('Import failed: ' + error.message);
    }
  }

  updateTableHeaders() {
    console.log('ResearchGUI: Updating table headers...');
    const headerRow = document.querySelector('.progress-table thead tr');
    
    // Clear existing headers except company name
    headerRow.innerHTML = '<th>Company Name</th>';
    
    // Add headers for each criterion
    if (this.app.template && this.app.template.criteria) {
      this.app.template.criteria.forEach(criterion => {
        const th = document.createElement('th');
        th.textContent = criterion.name;
        th.title = criterion.description; // Tooltip with full description
        headerRow.appendChild(th);
      });
      
      console.log(`ResearchGUI: Added ${this.app.template.criteria.length} criterion headers`);
    } else {
      console.log('ResearchGUI: No criteria found in template');
    }
  }

  populateCompanyTable() {
    console.log('ResearchGUI: Populating company table...');
    const tableBody = document.getElementById('progress-table-body');
    tableBody.innerHTML = ''; // Clear existing content

    // Handle empty state
    if (!this.app.companies || this.app.companies.length === 0) {
      console.log('ResearchGUI: No companies to display, showing empty state');
      this.showEmptyState(tableBody);
      return;
    }

    // Create row for each company
    this.app.companies.forEach((company, index) => {
      const row = this.createCompanyRow(company, index);
      tableBody.appendChild(row);
    });

    console.log(`ResearchGUI: Populated table with ${this.app.companies.length} companies`);
  }

  showEmptyState(tableBody) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    
    const totalColumns = 1 + (this.app.template?.criteria?.length || 6); // Company name + criteria
    cell.colSpan = totalColumns;
    cell.textContent = 'No companies loaded. Please import a CSV file.';
    cell.className = 'empty-state';
    
    row.appendChild(cell);
    tableBody.appendChild(row);
  }

  createCompanyRow(company, index) {
    const row = document.createElement('tr');
    
    // Company name cell with index
    const nameCell = document.createElement('td');
    nameCell.textContent = `${index + 1}. ${company.name}`;
    nameCell.className = 'company-name-cell';
    row.appendChild(nameCell);
    
    // Progress cells for each criterion
    const criteriaCount = this.app.template?.criteria?.length || 0;
    for (let i = 0; i < criteriaCount; i++) {
      const cell = document.createElement('td');
      cell.className = 'progress-cell';
      cell.textContent = ''; // Empty for now
      row.appendChild(cell);
    }
    
    return row;
  }

  populateCriteriaCheckboxes() {
    console.log('ResearchGUI: Populating criteria checkboxes...');
    const criteriaGrid = document.getElementById('criteria-grid');
    criteriaGrid.innerHTML = ''; // Clear existing checkboxes

    if (!this.app.template || !this.app.template.criteria || this.app.template.criteria.length === 0) {
      console.log('ResearchGUI: No criteria found in template');
      criteriaGrid.innerHTML = '<p class="no-criteria">No criteria available. Please configure criteria in the Options tab.</p>';
      return;
    }

    // Create checkbox for each criterion
    this.app.template.criteria.forEach((criterion, index) => {
      const criteriaItem = document.createElement('div');
      criteriaItem.className = 'criteria-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `criterion-${criterion.id}`;
      checkbox.checked = true; // Default to all selected
      checkbox.dataset.criterionName = criterion.name;
      
      // Add event listener for changes
      checkbox.addEventListener('change', () => this.updateSelectedCriteria());

      const label = document.createElement('label');
      label.htmlFor = checkbox.id;
      label.textContent = criterion.name;
      label.title = criterion.description; // Tooltip with description

      criteriaItem.appendChild(checkbox);
      criteriaItem.appendChild(label);
      criteriaGrid.appendChild(criteriaItem);
    });

    console.log(`ResearchGUI: Created ${this.app.template.criteria.length} criteria checkboxes`);
    
    // Initialize selected criteria array
    this.updateSelectedCriteria();
  }

  updateSelectedCriteria() {
    const checkboxes = document.querySelectorAll('#criteria-grid input[type="checkbox"]:checked');
    this.selectedCriteria = Array.from(checkboxes).map(cb => cb.dataset.criterionName);
    
    console.log('ResearchGUI: Selected criteria updated:', this.selectedCriteria);
    
    // Update UI to show selection count
    const selectionCount = this.selectedCriteria.length;
    const totalCount = this.app.template?.criteria?.length || 0;
    
    // You could add a status display here if needed
    // Example: document.getElementById('criteria-status').textContent = `${selectionCount}/${totalCount} criteria selected`;
  }

  async startResearch() {
    console.log('ResearchGUI: Start research button clicked');
    
    // Validate companies are loaded
    if (!this.app.companies || this.app.companies.length === 0) {
      console.log('ResearchGUI: No companies loaded');
      alert('Please import company data first');
      return;
    }

    // Validate criteria selection
    if (!this.selectedCriteria || this.selectedCriteria.length === 0) {
      console.log('ResearchGUI: No criteria selected');
      alert('Please select at least one criterion');
      return;
    }

    // Get and validate range input
    const rangeInput = document.getElementById('company-range').value.trim();
    console.log('ResearchGUI: Range input:', rangeInput);
    
    const range = this.parseRange(rangeInput, this.app.companies.length);
    if (!range) {
      console.log('ResearchGUI: Invalid range format');
      alert('Invalid range format. Use "1-10" or "50-100"');
      return;
    }

    console.log('ResearchGUI: Starting research with:', {
      companiesTotal: this.app.companies.length,
      range: range,
      criteria: this.selectedCriteria,
      companiesToResearch: this.app.companies.slice(range.start, range.end + 1).map(c => c.name)
    });

    // Update UI state
    this.app.isResearching = true;
    document.getElementById('start-btn').style.display = 'none';
    document.getElementById('stop-btn').style.display = 'inline-block';

    // Start SSE connection before starting research
    this.startProgressStream();

    try {
      // Call the research engine via API
      await this.callResearchEngine(range, this.selectedCriteria);
      console.log('ResearchGUI: Research completed successfully');
      
    } catch (error) {
      console.error('ResearchGUI: Research failed:', error);
      alert('Research failed: ' + error.message);
    } finally {
      // Stop SSE connection and reset UI state
      this.stopProgressStream();
      this.app.isResearching = false;
      document.getElementById('start-btn').style.display = 'inline-block';
      document.getElementById('stop-btn').style.display = 'none';
      console.log('ResearchGUI: Research UI state reset');
    }
  }

  parseRange(rangeStr, maxCompanies) {
    console.log('ResearchGUI: Parsing range:', rangeStr, 'Max companies:', maxCompanies);
    
    if (!rangeStr) return null;
    
    const match = rangeStr.match(/^(\d+)-(\d+)$/);
    if (!match) return null;
    
    const start = parseInt(match[1]) - 1; // Convert to 0-based
    const end = parseInt(match[2]) - 1;   // Convert to 0-based
    
    if (start < 0 || end >= maxCompanies || start > end) {
      return null;
    }
    
    return { start, end };
  }

  async callResearchEngine(range, criteriaNames) {
    console.log('ResearchGUI: Calling research engine with range:', range, 'criteria:', criteriaNames);
    
    // Prepare parameters for research engine
    const payload = {
      companies: this.app.companies,
      startIndex: range.start,
      endIndex: range.end,
      criteriaNames: criteriaNames,
      options: {
        verbosity: 1,
        waitBetweenTools: false
      }
    };
    
    console.log('ResearchGUI: Sending research request to server...');
    
    // Call the backend research endpoint
    const response = await fetch('/api/research/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Research failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('ResearchGUI: Research engine response:', result);
  }

  async stopResearch() {
    console.log('ResearchGUI: Stop research button clicked');
    
    try {
      console.log('ResearchGUI: Sending stop request to server...');
      const response = await fetch('/api/research/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Stop request failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('ResearchGUI: Stop request response:', result);
      
      // Update UI immediately (research engine will terminate gracefully)
      this.app.isResearching = false;
      document.getElementById('start-btn').style.display = 'inline-block';
      document.getElementById('stop-btn').style.display = 'none';
      console.log('ResearchGUI: Research UI state reset after stop');
      
    } catch (error) {
      console.error('ResearchGUI: Stop request failed:', error);
      alert('Failed to stop research: ' + error.message);
    }
  }

  startProgressStream() {
    console.log('ResearchGUI: Starting SSE progress stream...');
    
    this.eventSource = new EventSource('/api/research/stream');
    
    this.eventSource.onopen = () => {
      console.log('ResearchGUI: SSE connection opened');
    };
    
    this.eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        this.handleProgressUpdate(update);
      } catch (error) {
        console.error('ResearchGUI: Error parsing SSE message:', error);
      }
    };
    
    this.eventSource.onerror = (error) => {
      console.error('ResearchGUI: SSE connection error:', error);
    };
  }

  stopProgressStream() {
    if (this.eventSource) {
      console.log('ResearchGUI: Closing SSE connection');
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  handleProgressUpdate(update) {
    // Handle connection confirmation
    if (update.type === 'connection') {
      return;
    }
    
    // Handle different progress update types - the spread operation overwrites the outer type
    if (update.type === 'final_result') {
      // This is a final result - update the table
      this.updateTableProgress(update.company, update.criterion, update.result);
    }
    // Other progress types are logged for future Output tab implementation
  }

  updateTableProgress(companyName, criterionName, result) {
    // Find the company row and criterion column
    const companyIndex = this.app.companies.findIndex(c => c.name === companyName);
    const criterion = this.app.template.criteria.find(c => c.name === criterionName);
    const criterionIndex = this.app.template.criteria.findIndex(c => c.name === criterionName);
    
    if (companyIndex === -1 || criterionIndex === -1) {
      console.warn('ResearchGUI: Could not find company or criterion for table update');
      return;
    }
    
    // Find the specific table cell
    const tableBody = document.getElementById('progress-table-body');
    const row = tableBody.children[companyIndex];
    if (!row) return;
    
    const cell = row.children[criterionIndex + 1]; // +1 because first column is company name
    if (!cell) return;
    
    // Determine styling based on result and criterion type
    let cellClass = 'progress-cell';
    let cellText = '?';
    
    if (result.type === 'error' || !result.answer) {
      cellClass += ' result-unknown';
      cellText = '?';
    } else if (criterion.disqualifying) {
      // Disqualifying criteria: green for positive, red for negative
      cellClass += result.type === 'positive' ? ' result-positive-disqualifying' : ' result-negative-disqualifying';
      cellText = result.answer;
    } else {
      // Non-disqualifying: just use default black text
      cellText = result.answer;
    }
    
    // Update the cell
    cell.textContent = cellText;
    cell.className = cellClass;
    cell.title = result.explanation || ''; // Tooltip with explanation
  }

  async loadExistingResults() {
    if (!this.app.template || !this.app.template.id) {
      console.log('ResearchGUI: No template available for loading results');
      return;
    }

    try {
      console.log(`ResearchGUI: Loading existing results for template ${this.app.template.id}`);
      
      const response = await fetch(`/api/research/template/${this.app.template.id}/results`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`ResearchGUI: Loaded ${data.count} existing research results`);

      // Populate table with existing results
      data.results.forEach(result => {
        this.updateTableProgress(result.company, result.criterion, result.result);
      });

    } catch (error) {
      console.error('ResearchGUI: Error loading existing results:', error);
      // Don't show alert for this - just log the error
    }
  }
}