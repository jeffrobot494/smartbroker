// CSV Export utility - handles data conversion and download
class CSVExporter {
  static convertTableToCSV(tableElement) {
    const rows = [];
    const headerRow = [];
    
    // Extract headers
    const headerCells = tableElement.querySelectorAll('thead th, thead td');
    headerCells.forEach(cell => {
      headerRow.push(this.escapeCSVField(cell.textContent.trim()));
    });
    rows.push(headerRow);
    
    // Extract data rows
    const dataRows = tableElement.querySelectorAll('tbody tr');
    dataRows.forEach(row => {
      const rowData = [];
      const cells = row.querySelectorAll('td');
      cells.forEach(cell => {
        rowData.push(this.escapeCSVField(cell.textContent.trim()));
      });
      if (rowData.length > 0) {
        rows.push(rowData);
      }
    });
    
    return rows.map(row => row.join(',')).join('\n');
  }
  
  static escapeCSVField(field) {
    // Handle quotes, commas, and newlines
    if (field.includes('"') || field.includes(',') || field.includes('\n')) {
      return '"' + field.replace(/"/g, '""') + '"';
    }
    return field;
  }
  
  static downloadCSV(csvContent, filename = 'research_results.csv') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}