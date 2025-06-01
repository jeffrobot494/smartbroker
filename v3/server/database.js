const Database = require('better-sqlite3');
const path = require('path');

class DatabaseWrapper {
  constructor(dbPath = 'smartbroker.db') {
    this.dbPath = path.resolve(dbPath);
    this.db = null;
  }

  /**
   * Initialize database connection and create tables
   */
  async initialize() {
    try {
      this.db = new Database(this.dbPath);
      console.log(`Connected to SQLite database: ${this.dbPath}`);
      
      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');
      
      await this.createTables();
      return Promise.resolve();
    } catch (error) {
      console.error('Error opening database:', error.message);
      return Promise.reject(error);
    }
  }

  /**
   * Create database tables
   */
  async createTables() {
    try {
      const templatesTable = `
        CREATE TABLE IF NOT EXISTS templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          system_prompt TEXT NOT NULL,
          is_active BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const criteriaTable = `
        CREATE TABLE IF NOT EXISTS criteria (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          first_query_template TEXT,
          answer_format TEXT NOT NULL,
          disqualifying BOOLEAN DEFAULT 0,
          order_index INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
          UNIQUE(template_id, name),
          UNIQUE(template_id, order_index)
        )
      `;

      const companiesTable = `
        CREATE TABLE IF NOT EXISTS companies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          website TEXT,
          data JSON,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const researchResultsTable = `
        CREATE TABLE IF NOT EXISTS research_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id INTEGER NOT NULL,
          company_id INTEGER NOT NULL,
          criterion_id INTEGER NOT NULL,
          answer TEXT NOT NULL,
          explanation TEXT,
          confidence_score INTEGER CHECK(confidence_score >= 1 AND confidence_score <= 3),
          result_type TEXT NOT NULL,
          iterations INTEGER DEFAULT 0,
          tool_calls INTEGER DEFAULT 0,
          tokens_used INTEGER DEFAULT 0,
          claude_input_tokens INTEGER DEFAULT 0,
          claude_output_tokens INTEGER DEFAULT 0,
          claude_cost REAL DEFAULT 0,
          perplexity_calls INTEGER DEFAULT 0,
          perplexity_cost REAL DEFAULT 0,
          phantombuster_calls INTEGER DEFAULT 0,
          phantombuster_cost REAL DEFAULT 0,
          total_cost REAL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
          FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
          FOREIGN KEY (criterion_id) REFERENCES criteria(id) ON DELETE CASCADE,
          UNIQUE(template_id, company_id, criterion_id)
        )
      `;

      const templatesIndex = `
        CREATE INDEX IF NOT EXISTS idx_templates_active ON templates(is_active)
      `;

      const criteriaIndex = `
        CREATE INDEX IF NOT EXISTS idx_criteria_template ON criteria(template_id, order_index)
      `;

      const companiesIndex = `
        CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name)
      `;

      const researchIndex = `
        CREATE INDEX IF NOT EXISTS idx_research_template_company 
        ON research_results(template_id, company_id)
      `;

      this.db.exec(templatesTable);
      this.db.exec(criteriaTable);
      this.db.exec(companiesTable);
      this.db.exec(researchResultsTable);
      this.db.exec(templatesIndex);
      this.db.exec(criteriaIndex);
      this.db.exec(companiesIndex);
      this.db.exec(researchIndex);
      
      console.log('Database tables created successfully');
      
      // Seed default template if none exists
      await this.seedDefaultTemplate();
      
      return Promise.resolve();
    } catch (error) {
      console.error('Error creating tables:', error);
      return Promise.reject(error);
    }
  }

  /**
   * Seed default template from hardcoded data
   */
  async seedDefaultTemplate() {
    try {
      // Check if any templates exist
      const existingTemplate = await this.get('SELECT id FROM templates LIMIT 1');
      if (existingTemplate) {
        return; // Already seeded
      }

      console.log('Seeding default template...');

      // Import hardcoded data
      const { SYSTEM_PROMPT, CRITERIA } = require('./seed-data');

      // Create default template
      const templateResult = await this.run(
        'INSERT INTO templates (name, system_prompt, is_active) VALUES (?, ?, ?)',
        ['Default', SYSTEM_PROMPT, 1]
      );

      const templateId = templateResult.id;

      // Create criteria
      for (let i = 0; i < CRITERIA.length; i++) {
        const criterion = CRITERIA[i];
        await this.run(`
          INSERT INTO criteria 
          (template_id, name, description, first_query_template, answer_format, disqualifying, order_index)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          templateId,
          criterion.name,
          criterion.description,
          criterion.firstQueryTemplate,
          criterion.answerFormat,
          criterion.disqualifying ? 1 : 0,
          i
        ]);
      }

      console.log('Default template seeded successfully');
    } catch (error) {
      console.error('Error seeding default template:', error);
      throw error;
    }
  }

  /**
   * Execute a query with parameters
   */
  run(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(params);
      return Promise.resolve({ id: result.lastInsertRowid, changes: result.changes });
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Get a single row
   */
  get(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.get(params);
      return Promise.resolve(result);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Get all rows
   */
  all(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.all(params);
      return Promise.resolve(result);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Close database connection
   */
  close() {
    try {
      if (this.db) {
        this.db.close();
        console.log('Database connection closed');
      }
      return Promise.resolve();
    } catch (error) {
      console.error('Error closing database:', error.message);
      return Promise.resolve();
    }
  }
}

module.exports = DatabaseWrapper;