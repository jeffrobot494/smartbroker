const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor(dbPath = 'smartbroker.db') {
    this.dbPath = path.resolve(dbPath);
    this.db = null;
  }

  /**
   * Initialize database connection and create tables
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err.message);
          reject(err);
          return;
        }
        
        console.log(`Connected to SQLite database: ${this.dbPath}`);
        this.createTables()
          .then(resolve)
          .catch(reject);
      });
    });
  }

  /**
   * Create database tables
   */
  async createTables() {
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

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(companiesTable, (err) => {
          if (err) {
            console.error('Error creating companies table:', err);
            reject(err);
            return;
          }
        });

        this.db.run(researchResultsTable, (err) => {
          if (err) {
            console.error('Error creating research_results table:', err);
            reject(err);
            return;
          }
        });

        this.db.run(companiesIndex, (err) => {
          if (err) {
            console.error('Error creating companies index:', err);
            reject(err);
            return;
          }
        });

        this.db.run(researchIndex, (err) => {
          if (err) {
            console.error('Error creating research index:', err);
            reject(err);
            return;
          }
          
          console.log('Database tables created successfully');
          resolve();
        });
      });
    });
  }

  /**
   * Execute a query with parameters
   */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  /**
   * Get a single row
   */
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get all rows
   */
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Close database connection
   */
  close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err.message);
          } else {
            console.log('Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = Database;