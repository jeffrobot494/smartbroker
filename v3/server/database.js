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
          company_id INTEGER NOT NULL,
          criterion_name TEXT NOT NULL,
          answer TEXT NOT NULL,
          explanation TEXT,
          result_type TEXT NOT NULL,
          iterations INTEGER DEFAULT 0,
          tool_calls INTEGER DEFAULT 0,
          tokens_used INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
          UNIQUE(company_id, criterion_name)
        )
      `;

      const companiesIndex = `
        CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name)
      `;

      const researchIndex = `
        CREATE INDEX IF NOT EXISTS idx_research_company_criterion 
        ON research_results(company_id, criterion_name)
      `;

      this.db.exec(companiesTable);
      this.db.exec(researchResultsTable);
      this.db.exec(companiesIndex);
      this.db.exec(researchIndex);
      
      console.log('Database tables created successfully');
      return Promise.resolve();
    } catch (error) {
      console.error('Error creating tables:', error);
      return Promise.reject(error);
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