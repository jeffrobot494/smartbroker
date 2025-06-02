class OptionsGUI {
  constructor(app) {
    this.app = app;
    this.templates = [];
    this.currentTemplateId = null;
  }

  init() {
    console.log('OptionsGUI: Initializing...');
    this.setupEventListeners();
    this.loadTemplates();
  }

  onDataChanged() {
    console.log('OptionsGUI: Data changed - updating template selection');
    this.currentTemplateId = this.app.template?.id;
    this.updateTemplateDropdown();
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
    // For now, we'll just update the system prompt
    // Later we'll expand this to include criteria updates
    const systemPrompt = this.app.template.systemPrompt;
    
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
}