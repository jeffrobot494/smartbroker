class SmartBrokerApp {
  constructor() {
    this.template = null;
    this.companies = [];
    this.isResearching = false;
    
    // Initialize tab controllers (will be created after DOM loads)
    this.researchGUI = null;
    this.outputGUI = null;
    this.optionsGUI = null;
    this.instructionsGUI = null;
  }

  async init() {
    console.log('Initializing SmartBroker GUI...');
    
    // Initialize tab controllers
    this.researchGUI = new ResearchGUI(this);
    this.outputGUI = new OutputGUI(this);
    this.optionsGUI = new OptionsGUI(this);
    this.instructionsGUI = new InstructionsGUI(this);
    
    // Load template and company data
    await this.loadTemplate();
    
    // Setup tab switching
    this.setupTabSwitching();
    
    // Initialize all tabs
    this.researchGUI.init();
    this.outputGUI.init();
    this.optionsGUI.init();
    this.instructionsGUI.init();
    
    console.log('SmartBroker GUI initialized successfully');
  }

  async loadTemplate() {
    try {
      console.log('Loading active template...');
      const response = await fetch('/api/template/active');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      this.template = await response.json();
      this.companies = this.template.companies || [];
      
      console.log(`Loaded template: ${this.template.name}`);
      console.log(`Companies loaded: ${this.companies.length}`);
      
      // Notify all tabs of data changes
      this.notifyDataChanged();
      
    } catch (error) {
      console.error('Failed to load template:', error);
      this.showNotification('Failed to load template: ' + error.message, 'error');
    }
  }

  setupTabSwitching() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const targetTab = e.target.dataset.tab;
        
        // Remove active class from all tabs and contents
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked tab and corresponding content
        e.target.classList.add('active');
        document.getElementById(targetTab + '-tab').classList.add('active');
      });
    });
  }

  notifyDataChanged() {
    // Notify all tab controllers that data has changed
    if (this.researchGUI) this.researchGUI.onDataChanged();
    if (this.outputGUI) this.outputGUI.onDataChanged();
    if (this.optionsGUI) this.optionsGUI.onDataChanged();
    if (this.instructionsGUI) this.instructionsGUI.onDataChanged();
  }

  // Shared utilities for all tabs
  showNotification(message, type = 'info') {
    // Simple notification system - could be enhanced with a proper toast library
    const className = type === 'error' ? 'alert-danger' : 'alert-info';
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // For now, just use alert - can be improved later
    if (type === 'error') {
      alert('Error: ' + message);
    } else {
      console.log('Info: ' + message);
    }
  }

  // Switch to a specific tab
  switchToTab(tabName) {
    const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (tabButton) {
      tabButton.click();
    }
  }
}

// Global app instance
let smartBrokerApp;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  smartBrokerApp = new SmartBrokerApp();
  smartBrokerApp.init();
});