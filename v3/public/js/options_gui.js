class OptionsGUI {
  constructor(app) {
    this.app = app;
    this.templates = [];
    this.currentTemplateId = null;
    this.currentCriterionId = null; // null = "Add New" mode
    this.criteria = [];
  }

  init() {
    console.log('OptionsGUI: Initializing...');
    this.setupEventListeners();
    this.loadTemplates();
  }

  onDataChanged() {
    console.log('OptionsGUI: Data changed - updating template selection and criteria');
    this.currentTemplateId = this.app.template?.id;
    this.criteria = this.app.template?.criteria || [];
    this.updateTemplateDropdown();
    this.populateCriteriaDropdown();
    this.loadSystemPrompt(this.currentTemplateId);
  }

  setupEventListeners() {
    // Template dropdown change
    const templateSelect = document.getElementById('template-select');
    if (templateSelect) {
      templateSelect.addEventListener('change', (e) => {
        this.onTemplateChange(e.target.value);
      });
    }

    // Save template button
    const saveTemplateBtn = document.getElementById('save-template-btn');
    if (saveTemplateBtn) {
      saveTemplateBtn.addEventListener('click', () => {
        this.showSaveTemplateDialog();
      });
    }

    // Delete template button
    const deleteTemplateBtn = document.getElementById('delete-template-btn');
    if (deleteTemplateBtn) {
      deleteTemplateBtn.addEventListener('click', () => {
        this.deleteTemplate();
      });
    }

    // Criteria dropdown change
    const criterionSelect = document.getElementById('criterion-select');
    if (criterionSelect) {
      criterionSelect.addEventListener('change', (e) => {
        this.onCriterionChange(e.target.value);
      });
    }

    // Update criterion button
    const updateCriterionBtn = document.getElementById('update-criterion-btn');
    if (updateCriterionBtn) {
      updateCriterionBtn.addEventListener('click', () => {
        this.updateCriterion();
      });
    }

    // Delete criterion button
    const deleteCriterionBtn = document.getElementById('delete-criterion-btn');
    if (deleteCriterionBtn) {
      deleteCriterionBtn.addEventListener('click', () => {
        this.deleteCriterion();
      });
    }

    // Delete research results button
    const deleteResearchBtn = document.getElementById('delete-research-btn');
    if (deleteResearchBtn) {
      deleteResearchBtn.addEventListener('click', () => {
        this.deleteResearchResults();
      });
    }
  }

  async loadTemplates() {
    try {
      console.log('OptionsGUI: Loading templates from database...');
      const response = await fetch('/api/templates');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      this.templates = await response.json();
      console.log(`OptionsGUI: Loaded ${this.templates.length} templates`);
      
      this.populateTemplateDropdown();
    } catch (error) {
      console.error('OptionsGUI: Failed to load templates:', error);
      this.app.showNotification('Failed to load templates: ' + error.message, 'error');
    }
  }

  populateTemplateDropdown() {
    const templateSelect = document.getElementById('template-select');
    if (!templateSelect) {
      console.error('OptionsGUI: Template select element not found');
      return;
    }

    // Clear existing options
    templateSelect.innerHTML = '';

    // Add templates from database
    this.templates.forEach(template => {
      const option = document.createElement('option');
      option.value = template.id;
      option.textContent = template.name;
      templateSelect.appendChild(option);
    });

    // Add "New" option at the bottom
    const newOption = document.createElement('option');
    newOption.value = 'new';
    newOption.textContent = 'New';
    templateSelect.appendChild(newOption);

    // Set current active template as selected
    this.updateTemplateDropdown();
  }

  updateTemplateDropdown() {
    const templateSelect = document.getElementById('template-select');
    if (!templateSelect || !this.currentTemplateId) return;

    templateSelect.value = this.currentTemplateId;
  }

  async onTemplateChange(selectedValue) {
    if (selectedValue === 'new') {
      await this.createNewTemplate();
    } else {
      await this.switchTemplate(parseInt(selectedValue));
    }
  }

  async switchTemplate(templateId) {
    try {
      console.log(`OptionsGUI: Switching to template ${templateId}`);
      
      // 1. Activate the new template
      const response = await fetch(`/api/templates/${templateId}/activate`, { 
        method: 'PUT' 
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 2. Reload template data (this triggers notifyDataChanged across all tabs)
      await this.app.loadTemplate();

      // 3. Load system prompt for the new template
      await this.loadSystemPrompt(templateId);

      console.log(`OptionsGUI: Successfully switched to template ${templateId}`);
      
    } catch (error) {
      console.error('OptionsGUI: Failed to switch template:', error);
      this.app.showNotification('Failed to switch template: ' + error.message, 'error');
      
      // Reset dropdown to current template on error
      this.updateTemplateDropdown();
    }
  }

  async createNewTemplate() {
    const templateName = prompt('Enter name for new template:', 'New Template');
    if (!templateName || templateName.trim() === '') {
      // User cancelled or entered empty name, reset dropdown
      this.updateTemplateDropdown();
      return;
    }

    try {
      console.log(`OptionsGUI: Creating new template: ${templateName}`);
      
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          basedOnTemplateId: this.currentTemplateId, // Copy from current template
          makeActive: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('OptionsGUI: New template created:', result.template);

      // Reload templates and update app
      await this.loadTemplates();
      await this.app.loadTemplate();

      this.app.showNotification(`Template "${templateName}" created successfully!`, 'info');
      
    } catch (error) {
      console.error('OptionsGUI: Failed to create template:', error);
      this.app.showNotification('Failed to create template: ' + error.message, 'error');
      
      // Reset dropdown to current template on error
      this.updateTemplateDropdown();
    }
  }

  showSaveTemplateDialog() {
    const currentTemplate = this.templates.find(t => t.id === this.currentTemplateId);
    const currentName = currentTemplate ? currentTemplate.name : 'Unnamed Template';
    
    const templateName = prompt('Template Name:', currentName);
    if (!templateName || templateName.trim() === '') {
      return; // User cancelled
    }

    this.saveTemplate(templateName.trim());
  }

  async saveTemplate(templateName) {
    try {
      const currentTemplate = this.templates.find(t => t.id === this.currentTemplateId);
      
      if (templateName === currentTemplate?.name) {
        // Same name - update existing template
        console.log(`OptionsGUI: Updating existing template: ${templateName}`);
        await this.updateExistingTemplate();
      } else {
        // Different name - create new template
        console.log(`OptionsGUI: Saving as new template: ${templateName}`);
        await this.saveAsNewTemplate(templateName);
      }
      
    } catch (error) {
      console.error('OptionsGUI: Failed to save template:', error);
      this.app.showNotification('Failed to save template: ' + error.message, 'error');
    }
  }

  async updateExistingTemplate() {
    // Get system prompt from textarea
    const systemPrompt = document.getElementById('system-prompt-textarea').value.trim();
    
    if (!systemPrompt) {
      this.app.showNotification('System prompt cannot be empty', 'error');
      return;
    }
    
    const response = await fetch(`/api/template/${this.currentTemplateId}/prompt`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    this.app.showNotification('Template updated successfully!', 'info');
  }

  async saveAsNewTemplate(templateName) {
    const response = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: templateName,
        basedOnTemplateId: this.currentTemplateId,
        makeActive: true
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('OptionsGUI: Template saved as new:', result.template);

    // Reload templates and update app
    await this.loadTemplates();
    await this.app.loadTemplate();

    this.app.showNotification(`Template saved as "${templateName}"!`, 'info');
  }

  async loadSystemPrompt(templateId) {
    if (!templateId) {
      document.getElementById('system-prompt-textarea').value = '';
      return;
    }
    
    try {
      console.log(`OptionsGUI: Loading system prompt for template ${templateId}`);
      
      const response = await fetch(`/api/template/${templateId}/prompt`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      document.getElementById('system-prompt-textarea').value = data.systemPrompt || '';
      
      console.log('OptionsGUI: System prompt loaded successfully');
      
    } catch (error) {
      console.error('OptionsGUI: Failed to load system prompt:', error);
      document.getElementById('system-prompt-textarea').value = '';
      this.app.showNotification('Failed to load system prompt: ' + error.message, 'error');
    }
  }

  // ===== CRITERIA MANAGEMENT METHODS =====

  populateCriteriaDropdown() {
    const criterionSelect = document.getElementById('criterion-select');
    if (!criterionSelect) return;

    // Clear existing options
    criterionSelect.innerHTML = '';

    // Add existing criteria
    this.criteria.forEach(criterion => {
      const option = document.createElement('option');
      option.value = criterion.id;
      option.textContent = criterion.name;
      criterionSelect.appendChild(option);
    });

    // Add "Add New Criterion" option
    const addNewOption = document.createElement('option');
    addNewOption.value = 'add-new';
    addNewOption.textContent = '+ Add New Criterion';
    criterionSelect.appendChild(addNewOption);

    // If no criteria exist, default to "Add New"
    if (this.criteria.length === 0) {
      criterionSelect.value = 'add-new';
      this.onCriterionChange('add-new');
    } else {
      // If criteria exist, populate form with the first criterion (which is pre-selected)
      const firstCriterionId = this.criteria[0].id;
      criterionSelect.value = firstCriterionId;
      this.onCriterionChange(firstCriterionId.toString());
    }
  }

  onCriterionChange(selectedValue) {
    if (selectedValue === 'add-new') {
      this.currentCriterionId = null;
      this.clearCriterionForm();
      this.updateCriterionButtons('add');
    } else {
      this.currentCriterionId = parseInt(selectedValue);
      this.populateCriterionForm();
      this.updateCriterionButtons('edit');
    }
  }

  clearCriterionForm() {
    document.getElementById('criterion-name').value = '';
    document.getElementById('criterion-order').value = this.getNextOrderIndex();
    document.getElementById('criterion-prompt').value = '';
    document.getElementById('perplexity-query').value = '';
    document.getElementById('answer-format').value = 'string';
    document.getElementById('qualifying-criterion').checked = false;
  }

  populateCriterionForm() {
    const criterion = this.criteria.find(c => c.id === this.currentCriterionId);
    if (!criterion) {
      console.warn('OptionsGUI: Criterion not found:', this.currentCriterionId);
      return;
    }

    document.getElementById('criterion-name').value = criterion.name || '';
    document.getElementById('criterion-order').value = criterion.order_index || 1;
    document.getElementById('criterion-prompt').value = criterion.description || '';
    document.getElementById('perplexity-query').value = criterion.firstQueryTemplate || '';
    document.getElementById('answer-format').value = criterion.answerFormat || 'string';
    document.getElementById('qualifying-criterion').checked = !!criterion.disqualifying;
  }

  updateCriterionButtons(mode) {
    const updateBtn = document.getElementById('update-criterion-btn');
    const deleteBtn = document.getElementById('delete-criterion-btn');
    const deleteResearchBtn = document.getElementById('delete-research-btn');
    
    if (mode === 'add') {
      updateBtn.textContent = 'Add Criterion';
      deleteBtn.style.display = 'none';
      deleteResearchBtn.style.display = 'none';
    } else {
      updateBtn.textContent = 'Update Criterion';
      deleteBtn.style.display = 'inline-block';
      deleteResearchBtn.style.display = 'inline-block';
    }
  }

  getNextOrderIndex() {
    if (this.criteria.length === 0) return 1;
    const maxOrder = Math.max(...this.criteria.map(c => c.order_index || 0));
    return maxOrder + 1;
  }

  getCriterionFormData() {
    return {
      name: document.getElementById('criterion-name').value.trim(),
      description: document.getElementById('criterion-prompt').value.trim(),
      first_query_template: document.getElementById('perplexity-query').value.trim() || null,
      answer_format: document.getElementById('answer-format').value,
      disqualifying: document.getElementById('qualifying-criterion').checked,
      order_index: parseInt(document.getElementById('criterion-order').value)
    };
  }

  async updateCriterion() {
    const formData = this.getCriterionFormData();
    
    // Validation
    if (!formData.name) {
      this.app.showNotification('Criterion name is required', 'error');
      return;
    }
    if (!formData.description) {
      this.app.showNotification('Research prompt is required', 'error');
      return;
    }

    try {
      if (this.currentCriterionId === null) {
        // Add new criterion
        await this.createCriterion(formData);
      } else {
        // Update existing criterion
        await this.updateExistingCriterion(formData);
      }
    } catch (error) {
      console.error('OptionsGUI: Failed to update criterion:', error);
      this.app.showNotification('Failed to save criterion: ' + error.message, 'error');
    }
  }

  async createCriterion(formData) {
    console.log('OptionsGUI: Creating new criterion:', formData);
    
    const response = await fetch(`/api/templates/${this.currentTemplateId}/criteria`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('OptionsGUI: Criterion created:', result.criterion);

    // Reload template data
    await this.app.loadTemplate();
    
    // Select the newly created criterion
    this.currentCriterionId = result.criterion.id;
    document.getElementById('criterion-select').value = this.currentCriterionId;
    this.updateCriterionButtons('edit');

    this.app.showNotification(`Criterion "${formData.name}" created successfully!`, 'info');
  }

  async updateExistingCriterion(formData) {
    console.log('OptionsGUI: Updating criterion:', this.currentCriterionId, formData);
    
    const response = await fetch(`/api/criteria/${this.currentCriterionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    console.log('OptionsGUI: Criterion updated successfully');

    // Reload template data
    await this.app.loadTemplate();

    this.app.showNotification(`Criterion "${formData.name}" updated successfully!`, 'info');
  }

  async deleteCriterion() {
    if (this.currentCriterionId === null) return;

    const criterion = this.criteria.find(c => c.id === this.currentCriterionId);
    if (!criterion) return;

    const confirmed = confirm(`Are you sure you want to delete the criterion "${criterion.name}"?\n\nThis will also delete all research results for this criterion.`);
    if (!confirmed) return;

    try {
      console.log('OptionsGUI: Deleting criterion:', this.currentCriterionId);
      
      const response = await fetch(`/api/criteria/${this.currentCriterionId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      console.log('OptionsGUI: Criterion deleted successfully');

      // Reload template data
      await this.app.loadTemplate();

      // Reset to "Add New" mode
      document.getElementById('criterion-select').value = 'add-new';
      this.onCriterionChange('add-new');

      this.app.showNotification(`Criterion "${criterion.name}" deleted successfully!`, 'info');

    } catch (error) {
      console.error('OptionsGUI: Failed to delete criterion:', error);
      this.app.showNotification('Failed to delete criterion: ' + error.message, 'error');
    }
  }

  async deleteResearchResults() {
    if (this.currentCriterionId === null) return;

    const criterion = this.criteria.find(c => c.id === this.currentCriterionId);
    if (!criterion) return;

    const confirmed = confirm(
      `Delete ALL research results for "${criterion.name}" across all companies?\n\n` +
      `This will remove research data but keep the criterion definition.\n\n` +
      `This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      console.log(`OptionsGUI: Deleting research results for criterion ${this.currentCriterionId}`);
      
      const response = await fetch(
        `/api/research/criterion/${this.currentCriterionId}/template/${this.app.template.id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('OptionsGUI: Research results deleted successfully:', result);
      
      // Refresh Research tab data
      if (this.app.researchGUI) {
        this.app.researchGUI.loadExistingResults();
        this.app.researchGUI.loadCostSummary();
      }

      this.app.showNotification(
        `Deleted ${result.deletedCount} research results for "${criterion.name}"`, 
        'info'
      );

    } catch (error) {
      console.error('OptionsGUI: Failed to delete research results:', error);
      this.app.showNotification('Failed to delete research results: ' + error.message, 'error');
    }
  }

  async deleteTemplate() {
    if (!this.currentTemplateId) return;

    const currentTemplate = this.templates.find(t => t.id === this.currentTemplateId);
    if (!currentTemplate) return;

    const confirmed = confirm(
      `Are you sure you want to delete the template "${currentTemplate.name}"?\n\n` +
      `This will permanently delete:\n` +
      `• The template and system prompt\n` +
      `• All research criteria\n` +
      `• All research results\n` +
      `• All company data\n\n` +
      `This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      console.log('OptionsGUI: Deleting template:', this.currentTemplateId);
      
      const response = await fetch(`/api/templates/${this.currentTemplateId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      console.log('OptionsGUI: Template deleted successfully');

      // Reload templates list
      await this.loadTemplates();
      
      // Load the new active template (backend will have switched to another template)
      await this.app.loadTemplate();

      this.app.showNotification(`Template "${currentTemplate.name}" deleted successfully!`, 'info');

    } catch (error) {
      console.error('OptionsGUI: Failed to delete template:', error);
      this.app.showNotification('Failed to delete template: ' + error.message, 'error');
    }
  }
}