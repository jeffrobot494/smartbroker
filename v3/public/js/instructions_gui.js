class InstructionsGUI {
  constructor(app) {
    this.app = app;
  }

  init() {
    console.log('InstructionsGUI: Initializing...');
    this.fetchAndRenderInstructions();
  }

  onDataChanged() {
    // Instructions don't need to update based on app data changes
  }

  async fetchAndRenderInstructions() {
    try {
      console.log('InstructionsGUI: Fetching instructions from server...');
      
      const response = await fetch('/api/instructions');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('InstructionsGUI: Instructions loaded successfully');
      
      const html = this.parseTextToHTML(data.content);
      this.renderHTML(html);
      
    } catch (error) {
      console.error('InstructionsGUI: Failed to load instructions:', error);
      this.renderErrorMessage(error.message);
    }
  }

  parseTextToHTML(text) {
    const lines = text.split('\n');
    
    return `<div class="options-section">
      ${lines.map(line => {
        if (line.trim() === '') {
          return '<br>';
        } else if (line.startsWith('**') && line.endsWith('**')) {
          // H1 - Two asterisks, use existing h3 style from options-section
          const content = line.slice(2, -2);
          return `<h3>${content}</h3>`;
        } else if (line.startsWith('*') && line.endsWith('*')) {
          // H2 - One asterisk, use form-group label style
          const content = line.slice(1, -1);
          return `<div class="form-group"><label>${content}</label></div>`;
        } else {
          // Regular paragraph
          return `<p style="color: #6c757d; margin-bottom: 10px; padding-left: 15px;">${line}</p>`;
        }
      }).join('')}
    </div>`;
  }

  renderHTML(html) {
    const container = document.querySelector('.instructions-content');
    if (!container) {
      console.error('InstructionsGUI: Instructions container not found');
      return;
    }

    container.innerHTML = html;
    console.log('InstructionsGUI: Instructions rendered successfully');
  }

  renderErrorMessage(errorMessage) {
    const container = document.querySelector('.instructions-content');
    if (!container) return;

    container.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #666;">
        <h2>Instructions Not Available</h2>
        <p>Failed to load instructions: ${errorMessage}</p>
        <p>Please contact support if this issue persists.</p>
      </div>
    `;
  }
}