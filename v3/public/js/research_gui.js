class ResearchGUI {
  constructor(app, csvImportService) {
    this.app = app;
    this.csvImportService = csvImportService; // Injected service
    this.selectedCriteria = []; // Track selected criteria names
    this.eventSource = null; // SSE connection
    this.wakeLock = null; // Wake lock to prevent sleep during research
  }

  init() {
    console.log('ResearchGUI: Initializing...');
    this.setupEventListeners();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      this.stopProgressStream();
      this.allowSleep(); // Release wake lock on page unload
    });
  }

  onDataChanged() {
    console.log('ResearchGUI: Data changed - companies:', this.app.companies.length);
    this.updateTableHeaders();
    this.populateCompanyTable();
    this.populateCriteriaCheckboxes();
    this.loadExistingResults();
    this.loadCostSummary();
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

    // Export button
    document.getElementById('export-btn').addEventListener('click', () => {
      this.handleExportClick();
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

    // NEW: Validate with CSV service before sending to server
    const validation = await this.csvImportService.validateCSV(file);
    if (!validation.isValid) {
      console.log('ResearchGUI: CSV validation failed:', validation.error);
      return; // Error already shown by service
    }

    // EXISTING: Continue with server upload (unchanged)
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
    
    // Company name cell with index and delete button
    const nameCell = document.createElement('td');
    nameCell.className = 'company-name-cell';
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `${index + 1}. ${company.name}`;
    nameCell.appendChild(nameSpan);
    
    // Add delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑️';
    deleteBtn.className = 'btn-delete-company';
    deleteBtn.title = `Delete all research results for ${company.name}`;
    deleteBtn.style.marginLeft = '10px';
    deleteBtn.style.fontSize = '12px';
    deleteBtn.style.padding = '2px 6px';
    deleteBtn.style.border = 'none';
    deleteBtn.style.background = 'transparent';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.style.opacity = '0.6';
    
    deleteBtn.addEventListener('mouseover', () => deleteBtn.style.opacity = '1');
    deleteBtn.addEventListener('mouseout', () => deleteBtn.style.opacity = '0.6');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteCompanyResults(company.name);
    });
    
    nameCell.appendChild(deleteBtn);
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

    // Prevent computer from sleeping
    await this.preventSleep();

    // Start SSE connection before starting research
    this.startProgressStream();

    try {
      // Call the research engine via API
      await this.callResearchEngine(range, this.selectedCriteria);
      console.log('ResearchGUI: Research completed successfully');
      
    } catch (error) {
      console.error('ResearchGUI: Research failed:', error);
      alert(error.message);
    } finally {
      // Stop SSE connection and reset UI state
      this.stopProgressStream();
      this.app.isResearching = false;
      document.getElementById('start-btn').style.display = 'inline-block';
      document.getElementById('stop-btn').style.display = 'none';
      
      // Allow computer to sleep again
      this.allowSleep();
      
      // Refresh cost summary after research completes
      this.loadCostSummary();
      
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
        verbosity: 4,
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
      const errorData = await response.json();
      throw new Error(errorData.details || errorData.error || `Research failed: ${response.statusText}`);
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
      
      // Allow computer to sleep again
      this.allowSleep();
      
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
    
    // Send all messages to OutputGUI for terminal display
    if (this.app.outputGUI) {
      this.app.outputGUI.addMessage(update);
    }
    
    // Handle different progress update types - the spread operation overwrites the outer type
    if (update.type === 'final_result') {
      // This is a final result - update the table
      this.updateTableProgress(update.company, update.criterion, update.result);
    }
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
      cellClass += ' result-error';
      cellText = '✗';
    } else if (result.type === 'unknown') {
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

  async loadCostSummary() {
    if (!this.app.template || !this.app.template.id) {
      console.log('ResearchGUI: No template available for loading cost summary');
      return;
    }

    try {
      console.log(`ResearchGUI: Loading cost summary for template ${this.app.template.id}`);
      
      const response = await fetch(`/api/research/costs?templateId=${this.app.template.id}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const costData = await response.json();
      console.log('ResearchGUI: Cost data loaded:', costData);
      
      this.updateCostDisplay(costData);

    } catch (error) {
      console.error('ResearchGUI: Error loading cost summary:', error);
      // Reset display to defaults on error
      this.updateCostDisplay({ total: 0, investigations: 0, unique_companies: 0 });
    }
  }

  updateCostDisplay(costData) {
    const totalCost = (costData.total || 0).toFixed(2);
    const investigations = costData.investigations || 0;  // Total queries
    const uniqueCompanies = costData.unique_companies || 0;  // Unique companies
    const averageCostPerCompany = uniqueCompanies > 0 ? (costData.total / uniqueCompanies).toFixed(2) : '0.00';
    const averageCostPerQuery = investigations > 0 ? (costData.total / investigations).toFixed(2) : '0.00';
    
    console.log('ResearchGUI: Updating cost display:', { 
      totalCost, 
      averageCostPerCompany, 
      averageCostPerQuery, 
      investigations, 
      uniqueCompanies 
    });
    
    document.getElementById('total-cost').textContent = `$${totalCost}`;
    document.getElementById('average-cost').textContent = `$${averageCostPerCompany}`;
    document.getElementById('average-query-cost').textContent = `$${averageCostPerQuery}`;
    document.getElementById('queries-researched').textContent = investigations;
    document.getElementById('companies-researched').textContent = uniqueCompanies;
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

  handleExportClick() {
    console.log('ResearchGUI: Export button clicked');
    
    try {
      // Validate companies are loaded
      if (!this.app.companies || this.app.companies.length === 0) {
        console.log('ResearchGUI: No companies loaded');
        alert('No companies available to export');
        return;
      }

      // Get export options from Options tab
      const exportOptions = this.app.optionsGUI.getExportOptions();
      console.log('ResearchGUI: Export options:', exportOptions);
      
      // Filter companies based on elimination status
      let companiesToExport = this.app.companies;
      if (!exportOptions.showEliminated) {
        companiesToExport = this.app.companies.filter(company => 
          !this.isCompanyEliminated(company.name)
        );
      }
      
      if (companiesToExport.length === 0) {
        alert('No companies match the export criteria.');
        return;
      }
      
      console.log(`ResearchGUI: Exporting ${companiesToExport.length} companies`);
      
      // Build custom CSV with selected options
      const csvContent = this.buildCustomCSV(companiesToExport, exportOptions);
      
      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const templateName = this.app.template?.name || 'unknown';
      const eliminatedText = exportOptions.showEliminated ? 'all' : 'qualified';
      const filename = `research_results_${templateName}_${eliminatedText}_${timestamp}.csv`;
      
      CSVExporter.downloadCSV(csvContent, filename);
      
      console.log('ResearchGUI: CSV export completed successfully');
      
    } catch (error) {
      console.error('ResearchGUI: Error exporting CSV:', error);
      alert('Failed to export CSV. Please try again.');
    }
  }

  clearCompanyResultsFromTable(companyName) {
    // Find the company row and clear all result cells
    const companyIndex = this.app.companies.findIndex(c => c.name === companyName);
    if (companyIndex === -1) return;
    
    const tableBody = document.getElementById('progress-table-body');
    const row = tableBody.children[companyIndex];
    if (!row) return;
    
    // Clear all result cells (skip first cell which is company name)
    for (let i = 1; i < row.children.length; i++) {
      const cell = row.children[i];
      cell.textContent = '';
      cell.className = 'progress-cell'; // Reset to default class
      cell.title = ''; // Clear tooltip
    }
  }

  async deleteCompanyResults(companyName) {
    if (!this.app.template || !this.app.template.id) {
      console.log('ResearchGUI: No template available for deletion');
      return;
    }

    const confirmed = confirm(
      `Delete ALL research results for "${companyName}" in template "${this.app.template.name}"?\n\n` +
      `This will remove all research data for this company but keep the company in the list.\n\n` +
      `This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      console.log(`ResearchGUI: Deleting research results for company "${companyName}"`);
      
      const response = await fetch(
        `/api/research/company/${encodeURIComponent(companyName)}/template/${this.app.template.id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('ResearchGUI: Company research results deleted successfully:', result);
      
      // Refresh the research table to show cleared results
      this.clearCompanyResultsFromTable(companyName);
      this.loadExistingResults();
      
      // Refresh cost summary
      this.loadCostSummary();

      this.app.showNotification(
        `Deleted ${result.deletedCount} research results for "${companyName}"`, 
        'info'
      );

    } catch (error) {
      console.error('ResearchGUI: Failed to delete company research results:', error);
      this.app.showNotification('Failed to delete company research results: ' + error.message, 'error');
    }
  }

  isCompanyEliminated(companyName) {
    if (!this.app.template?.criteria) return false;
    
    const disqualifyingCriteria = this.app.template.criteria.filter(c => c.disqualifying);
    if (disqualifyingCriteria.length === 0) return false;
    
    // Check if any disqualifying criterion has a negative result
    return disqualifyingCriteria.some(criterion => {
      const companyIndex = this.app.companies.findIndex(c => c.name === companyName);
      const criterionIndex = this.app.template.criteria.findIndex(c => c.name === criterion.name);
      
      if (companyIndex === -1 || criterionIndex === -1) return false;
      
      const tableBody = document.getElementById('progress-table-body');
      const row = tableBody.children[companyIndex];
      if (!row) return false;
      
      const cell = row.children[criterionIndex + 1]; // +1 because first column is company name
      return cell && cell.classList.contains('result-negative-disqualifying');
    });
  }

  buildCustomCSV(companies, exportOptions) {
    // Build headers based on selected columns
    const headers = ['Company Name'];
    if (exportOptions.columns.website) headers.push('Website');
    if (exportOptions.columns.city) headers.push('City');
    if (exportOptions.columns.state) headers.push('State');
    
    // Add criterion headers (research results)
    if (this.app.template?.criteria) {
      headers.push(...this.app.template.criteria.map(c => c.name));
    }
    
    const rows = [headers];
    
    // Build data rows
    companies.forEach(company => {
      const row = [company.name]; // Always included
      
      // Add selected company data columns
      if (exportOptions.columns.website) row.push(company.website || '');
      if (exportOptions.columns.city) row.push(company.city || '');
      if (exportOptions.columns.state) row.push(company.state || '');
      
      // Add research results for each criterion
      if (this.app.template?.criteria) {
        this.app.template.criteria.forEach(criterion => {
          const result = this.getCompanyResult(company.name, criterion.name);
          row.push(result);
        });
      }
      
      rows.push(row);
    });
    
    // Convert to CSV
    return rows.map(row => 
      row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',')
    ).join('\n');
  }

  getCompanyResult(companyName, criterionName) {
    // Get result from the existing table cell
    const companyIndex = this.app.companies.findIndex(c => c.name === companyName);
    const criterionIndex = this.app.template.criteria.findIndex(c => c.name === criterionName);
    
    if (companyIndex === -1 || criterionIndex === -1) return '';
    
    const tableBody = document.getElementById('progress-table-body');
    const row = tableBody.children[companyIndex];
    if (!row) return '';
    
    const cell = row.children[criterionIndex + 1]; // +1 because first column is company name
    return cell ? cell.textContent.trim() : '';
  }

  async preventSleep() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        console.log('ResearchGUI: Wake lock active - computer will not sleep during research');
      } else {
        console.log('ResearchGUI: Wake lock not supported by this browser');
      }
    } catch (err) {
      console.error('ResearchGUI: Wake lock failed:', err);
    }
  }

  allowSleep() {
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
      console.log('ResearchGUI: Wake lock released - computer can sleep normally');
    }
  }
}