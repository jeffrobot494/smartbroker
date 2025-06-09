class ApiKeysGUI {
  constructor(app) {
    this.app = app;
    this.keyStatus = {
      anthropic: { configured: false },
      perplexity: { configured: false },
      phantombuster: { configured: false },
      linkedin: { configured: false }
    };
  }

  init() {
    console.log('ApiKeysGUI: Initializing...');
    this.setupEventListeners();
    this.loadApiKeyStatus();
  }

  onDataChanged() {
    // API Keys don't need to update based on template/company data changes
    console.log('ApiKeysGUI: Data changed (no action needed)');
  }

  setupEventListeners() {
    // Save keys button
    const saveBtn = document.getElementById('save-keys-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveApiKeys();
      });
    }

    // Clear form button
    const clearBtn = document.getElementById('clear-form-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearForm();
      });
    }

    // Form submission
    const form = document.getElementById('api-keys-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveApiKeys();
      });
    }
  }

  async loadApiKeyStatus() {
    try {
      console.log('ApiKeysGUI: Loading API key status...');
      
      const response = await fetch('/api/settings/api-keys/status');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const status = await response.json();
      this.keyStatus = status;
      this.updateStatusDisplay();
      
      console.log('ApiKeysGUI: API key status loaded successfully');
      
    } catch (error) {
      console.error('ApiKeysGUI: Failed to load API key status:', error);
      this.app.showNotification('Failed to load API key status: ' + error.message, 'error');
    }
  }

  updateStatusDisplay() {
    const services = ['anthropic', 'perplexity', 'phantombuster', 'linkedin'];
    
    services.forEach(service => {
      const statusEl = document.getElementById(`${service}-status`);
      if (!statusEl) return;

      const iconEl = statusEl.querySelector('.status-icon');
      const textEl = statusEl.querySelector('.status-text');
      const status = this.keyStatus[service];

      if (status.configured) {
        iconEl.textContent = '✅';
        iconEl.style.color = '#28a745';
        textEl.textContent = 'Configured';
        textEl.style.color = '#28a745';
      } else {
        iconEl.textContent = '⚪';
        iconEl.style.color = '#6c757d';
        textEl.textContent = 'Not configured';
        textEl.style.color = '#6c757d';
      }
    });
  }

  getFormData() {
    return {
      ANTHROPIC_API_KEY: document.getElementById('anthropic-key').value.trim(),
      PERPLEXITY_API_KEY: document.getElementById('perplexity-key').value.trim(),
      PHANTOMBUSTER_API_KEY: document.getElementById('phantombuster-key').value.trim(),
      LINKEDIN_SESSION_COOKIE: document.getElementById('linkedin-cookie').value.trim()
    };
  }

  async saveApiKeys() {
    const formData = this.getFormData();
    
    // Filter out empty values
    const keysToSave = {};
    Object.entries(formData).forEach(([key, value]) => {
      if (value) {
        keysToSave[key] = value;
      }
    });

    if (Object.keys(keysToSave).length === 0) {
      this.app.showNotification('Please enter at least one API key', 'error');
      return;
    }

    try {
      console.log('ApiKeysGUI: Saving API keys...');
      this.setButtonLoading('save-keys-btn', true);
      
      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(keysToSave)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('ApiKeysGUI: API keys saved successfully');
      
      // Clear the form
      this.clearForm();
      
      // Reload status
      await this.loadApiKeyStatus();
      
      this.app.showNotification(`Saved ${result.saved} API key(s) successfully!`, 'info');
      
    } catch (error) {
      console.error('ApiKeysGUI: Failed to save API keys:', error);
      this.app.showNotification('Failed to save API keys: ' + error.message, 'error');
    } finally {
      this.setButtonLoading('save-keys-btn', false);
    }
  }

  clearForm() {
    document.getElementById('anthropic-key').value = '';
    document.getElementById('perplexity-key').value = '';
    document.getElementById('phantombuster-key').value = '';
    document.getElementById('linkedin-cookie').value = '';
    console.log('ApiKeysGUI: Form cleared');
  }

  setButtonLoading(buttonId, loading) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    if (loading) {
      button.disabled = true;
      button.dataset.originalText = button.textContent;
      button.textContent = '⏳ Processing...';
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalText || button.textContent;
    }
  }
}