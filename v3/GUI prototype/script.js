function showTab(tabName) {
    // Hide all tabs
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));
    
    // Show selected tab
    event.target.classList.add('active');
    document.getElementById(tabName + '-tab').classList.add('active');
}

function toggleExpand(element) {
    const details = element.querySelector('.terminal-details');
    const indicator = element.querySelector('.expand-indicator');
    
    if (details.style.display === 'none') {
        details.style.display = 'block';
        element.classList.add('expanded');
    } else {
        details.style.display = 'none';
        element.classList.remove('expanded');
    }
}

// Simulate terminal updates
function addTerminalLine(message, type = 'system') {
    const terminal = document.getElementById('terminal');
    const timestamp = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = 'terminal-line';
    line.innerHTML = `<span class="terminal-timestamp">[${timestamp}]</span> <span class="terminal-${type}">${message}</span>`;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

// File upload handler
document.getElementById('csv-upload').addEventListener('change', function(e) {
    const fileInfo = document.querySelector('.file-info');
    if (e.target.files.length > 0) {
        fileInfo.textContent = `Selected: ${e.target.files[0].name}`;
        fileInfo.style.color = '#28a745';
    } else {
        fileInfo.textContent = 'No file selected';
        fileInfo.style.color = '#6c757d';
    }
});

// Start/Stop button handlers
document.getElementById('start-btn').addEventListener('click', function() {
    this.style.display = 'none';
    document.getElementById('stop-btn').style.display = 'inline-block';
    addTerminalLine('Research started...', 'system');
});

document.getElementById('stop-btn').addEventListener('click', function() {
    this.style.display = 'none';
    document.getElementById('start-btn').style.display = 'inline-block';
    addTerminalLine('Research stopped by user.', 'system');
});
// Clear output button
document.getElementById('clear-output-btn').addEventListener('click', function() {
    const terminal = document.getElementById('terminal');
    terminal.innerHTML = '';
    addTerminalLine('Output cleared.', 'system');
});

// Export button
document.getElementById('export-btn').addEventListener('click', function() {
    addTerminalLine('Exporting results to CSV...', 'system');
    // Simulate export process
    setTimeout(() => {
        addTerminalLine('Export completed: research_results.csv', 'system');
    }, 1000);
});

// Reset costs button
document.getElementById('reset-costs').addEventListener('click', function() {
    if (confirm('Are you sure you want to reset all API cost tracking?')) {
        document.querySelector('.cost-value').textContent = '$0.00';
        const breakdown = document.querySelector('.cost-breakdown');
        breakdown.innerHTML = `
            <div>Perplexity: $0.00</div>
            <div>Claude: $0.00</div>
            <div>PhantomBuster: $0.00</div>
            <div>Other APIs: $0.00</div>
        `;
    }
});

// Delete results button
document.getElementById('delete-results-btn').addEventListener('click', function() {
    const checkedBoxes = document.querySelectorAll('.delete-checkboxes input[type="checkbox"]:checked');
    if (checkedBoxes.length === 0) {
        alert('Please select at least one criterion to delete results for.');
        return;
    }
    
    const criteriaNames = Array.from(checkedBoxes).map(box => box.nextElementSibling.textContent);
    const confirmMessage = `Are you sure you want to delete all research results for:\n${criteriaNames.join('\n')}\n\nThis action cannot be undone.`;
    
    if (confirm(confirmMessage)) {
        addTerminalLine(`Deleting results for: ${criteriaNames.join(', ')}`, 'system');
        // Uncheck all the boxes after deletion
        checkedBoxes.forEach(box => box.checked = false);
    }
});