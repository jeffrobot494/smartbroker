/**
 * DataTable Component
 * Manages the company data table display and interaction
 */
export default class DataTable {
    /**
     * @param {string} tableId - The ID of the table element
     * @param {string} tbodyId - The ID of the tbody element
     * @param {Object} options - Configuration options
     */
    constructor(tableId, tbodyId, options = {}) {
        this.table = document.getElementById(tableId);
        this.tbody = document.getElementById(tbodyId);
        this.options = {
            selectable: true,
            clickableCompanyNames: true,
            showConfidence: true,
            ...options
        };
        
        this.selectedColumn = 1; // Default to first question column
        this.selectedCell = { row: -1, column: -1 }; // No cell selected by default
        this.mode = 'column'; // 'column' or 'cell'
        
        this.setupEventListeners();
    }

    /**
     * Set up event listeners for the table
     */
    setupEventListeners() {
        if (!this.table) return;
        
        // Add click handler for table headers
        const headerRow = this.table.querySelector('thead tr');
        if (headerRow) {
            const headers = headerRow.querySelectorAll('th');
            
            headers.forEach((header, index) => {
                // Only add click events to question headers (indexes 1-7)
                if (index >= 1 && index <= 7) {
                    header.addEventListener('click', () => {
                        this.selectColumn(index);
                        
                        // Call onColumnSelect callback if provided
                        if (this.options.onColumnSelect) {
                            this.options.onColumnSelect(index);
                        }
                    });
                }
            });
        }
        
        // Filter input event listener
        const filterInput = document.getElementById('company-filter');
        if (filterInput) {
            filterInput.addEventListener('input', (e) => {
                this.filterTable(e.target.value);
            });
        }
    }

    /**
     * Populate the table with company data
     * @param {Array} companies - Array of company objects
     */
    populateTable(companies) {
        if (!this.tbody) return;
        
        // Clear existing rows
        this.tbody.innerHTML = '';
        
        if (!companies || companies.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="12" style="text-align: center; padding: 20px;">No company data available</td>';
            this.tbody.appendChild(emptyRow);
            return;
        }
        
        // Create a row for each company
        companies.forEach((company, index) => {
            const row = document.createElement('tr');
            row.dataset.companyIndex = index;
            
            // Format data for display
            const domain = company.website || '-';
            const linkedIn = company.linkedinUrl || '-';
            
            // Create company name cell with clickable link if enabled
            let companyNameCell;
            if (this.options.clickableCompanyNames) {
                companyNameCell = `<a href="#" class="company-name-link" data-company-index="${index}">${company.companyName}</a>`;
            } else {
                companyNameCell = company.companyName;
            }
            
            // Create row HTML
            row.innerHTML = `
                <td>${companyNameCell}</td>
                <td class="question-cell" data-question-index="0" data-company-index="${index}">-</td>
                <td class="question-cell" data-question-index="1" data-company-index="${index}">-</td>
                <td class="question-cell" data-question-index="2" data-company-index="${index}">-</td>
                <td class="question-cell" data-question-index="3" data-company-index="${index}">-</td>
                <td class="question-cell" data-question-index="4" data-company-index="${index}">-</td>
                <td class="question-cell" data-question-index="5" data-company-index="${index}">-</td>
                <td class="question-cell" data-question-index="6" data-company-index="${index}">-</td>
                <td>${domain}</td>
                <td>${linkedIn}</td>
                <td>${company.contact || '-'}</td>
                <td>${company.title || '-'}</td>
            `;
            
            this.tbody.appendChild(row);
            
            // Add event listeners to question cells
            if (this.options.selectable) {
                const questionCells = row.querySelectorAll('.question-cell');
                questionCells.forEach(cell => {
                    cell.addEventListener('click', () => {
                        const questionIndex = parseInt(cell.dataset.questionIndex);
                        const companyIndex = parseInt(cell.dataset.companyIndex);
                        
                        if (!isNaN(questionIndex) && !isNaN(companyIndex)) {
                            // Get the column index (question index + 1 since company is column 0)
                            const columnIndex = questionIndex + 1;
                            
                            this.selectCell(companyIndex, columnIndex);
                            
                            // Call onCellSelect callback if provided
                            if (this.options.onCellSelect) {
                                this.options.onCellSelect(companyIndex, questionIndex);
                            }
                        }
                    });
                });
            }
            
            // Add event listener to company name link
            if (this.options.clickableCompanyNames) {
                const companyLink = row.querySelector('.company-name-link');
                if (companyLink) {
                    companyLink.addEventListener('click', (event) => {
                        event.preventDefault();
                        const companyIndex = parseInt(companyLink.dataset.companyIndex);
                        
                        // Call onCompanySelect callback if provided
                        if (this.options.onCompanySelect && !isNaN(companyIndex)) {
                            this.options.onCompanySelect(companyIndex);
                        }
                    });
                }
            }
        });
        
        // Highlight the selected column
        this.highlightSelectedColumn();
    }

    /**
     * Update a specific cell with research result
     * @param {number} companyIndex - Index of the company
     * @param {number} questionIndex - Index of the question
     * @param {string} answer - Answer text
     * @param {string} confidence - Confidence level (HIGH, MEDIUM, LOW)
     */
    updateCell(companyIndex, questionIndex, answer, confidence) {
        if (!this.tbody) return;
        
        const rows = this.tbody.querySelectorAll('tr');
        if (rows.length > companyIndex) {
            const row = rows[companyIndex];
            const cells = row.querySelectorAll('.question-cell');
            if (cells.length > questionIndex) {
                const cell = cells[questionIndex];
                
                // Set confidence as a data attribute for styling
                if (confidence && this.options.showConfidence) {
                    cell.dataset.confidence = confidence.toLowerCase();
                } else {
                    cell.dataset.confidence = '';
                }
                
                // Handle Owner Name question differently (questionIndex 2)
                if (questionIndex === 2) {
                    // For Owner Name question, display the actual name or "unknown"
                    if (answer === 'NO' || answer === 'UNKNOWN' || answer === 'unknown' || !answer) {
                        cell.textContent = 'unknown';
                        cell.classList.add('no-value');
                        cell.classList.remove('yes-value');
                    } else {
                        // Make sure we're only showing the name, no extra text
                        cell.textContent = answer;
                        cell.classList.add('yes-value');
                        cell.classList.remove('no-value');
                    }
                } else {
                    // For all other questions, handle as before
                    cell.textContent = answer;
                    
                    // Apply styling based on answer
                    if (answer === 'YES') {
                        cell.classList.add('yes-value');
                        cell.classList.remove('no-value');
                    } else if (answer === 'NO') {
                        cell.classList.add('no-value');
                        cell.classList.remove('yes-value');
                    }
                }
            }
        }
    }

    /**
     * Update the table with research results
     * @param {Array} companies - Array of company objects with research data
     */
    updateTableWithResults(companies) {
        if (!companies || !this.tbody) return;
        
        companies.forEach((company, companyIndex) => {
            if (company.research) {
                Object.entries(company.research).forEach(([questionText, researchData]) => {
                    // Find question index based on question text
                    const questionIndex = this.findQuestionIndex(questionText);
                    
                    if (questionIndex !== -1 && researchData.result) {
                        // Check if researchData has a nested result property or is the result itself
                        const result = researchData.result || researchData;
                        
                        // Update the cell
                        if (typeof result === 'object' && result.answer) {
                            this.updateCell(companyIndex, questionIndex, result.answer, result.confidence);
                        } else {
                            // For backward compatibility
                            this.updateCell(companyIndex, questionIndex, result);
                        }
                    }
                });
            }
        });
    }

    /**
     * Find question index based on question text
     * @param {string} questionText - Question text
     * @returns {number} Question index or -1 if not found
     */
    findQuestionIndex(questionText) {
        const questionTexts = [
            "Does the company sell a software product or products?",
            "Are the company's products vertical market software?",
            "Who is the president or owner of the company?",
            "Is the owner of the company at least 50 years old?",
            "Does the company number between 5 and 40 employees?",
            "Is the company bootstrapped?",
            "Are the majority of the employees based in the USA?"
        ];
        
        return questionTexts.findIndex(text => text === questionText);
    }

    /**
     * Select a column
     * @param {number} columnIndex - Index of the column to select
     */
    selectColumn(columnIndex) {
        this.clearAllSelections();
        this.selectedColumn = columnIndex;
        this.mode = 'column';
        this.selectedCell = { row: -1, column: -1 };
        this.highlightSelectedColumn();
    }

    /**
     * Select a specific cell
     * @param {number} rowIndex - Index of the row
     * @param {number} columnIndex - Index of the column
     */
    selectCell(rowIndex, columnIndex) {
        this.clearAllSelections();
        this.mode = 'cell';
        this.selectedCell = { row: rowIndex, column: columnIndex };
        this.selectedColumn = columnIndex;
        this.highlightSelectedCell();
    }

    /**
     * Highlight the selected column
     */
    highlightSelectedColumn() {
        if (!this.table) return;
        
        // Highlight the selected column in each row
        const rows = this.table.querySelectorAll('tr');
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('th, td');
            if (cells.length > this.selectedColumn) {
                cells[this.selectedColumn].classList.add('selected-question');
            }
        });
    }

    /**
     * Highlight the selected cell
     */
    highlightSelectedCell() {
        if (!this.table || this.selectedCell.row === -1) return;
        
        // First highlight the column for context
        this.highlightSelectedColumn();
        
        // Then highlight the specific cell
        const rows = this.table.querySelectorAll('tbody tr');
        if (rows.length > this.selectedCell.row) {
            const row = rows[this.selectedCell.row];
            const cells = row.querySelectorAll('td');
            if (cells.length > this.selectedCell.column) {
                cells[this.selectedCell.column].classList.add('selected-cell');
            }
        }
    }

    /**
     * Clear all selections
     */
    clearAllSelections() {
        if (!this.table) return;
        
        const allCells = this.table.querySelectorAll('th, td');
        allCells.forEach(cell => {
            cell.classList.remove('selected-question');
            cell.classList.remove('selected-cell');
        });
    }

    /**
     * Filter the table by company name
     * @param {string} query - Filter query
     */
    filterTable(query) {
        if (!this.tbody) return;
        
        const rows = this.tbody.querySelectorAll('tr');
        const lowerQuery = query.toLowerCase();
        
        rows.forEach(row => {
            const companyNameCell = row.querySelector('td:first-child');
            const companyName = companyNameCell.textContent.toLowerCase();
            
            if (companyName.includes(lowerQuery) || !lowerQuery) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    /**
     * Get current state
     * @returns {Object} Current state object
     */
    getState() {
        return {
            selectedColumn: this.selectedColumn,
            selectedCell: this.selectedCell,
            mode: this.mode
        };
    }

    /**
     * Set callbacks
     * @param {Object} callbacks - Callback functions
     */
    setCallbacks(callbacks) {
        this.options = { 
            ...this.options,
            ...callbacks
        };
    }
}