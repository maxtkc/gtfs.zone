import Papa from 'papaparse';

export class Editor {
  constructor(editorElementId = 'simple-editor') {
    this.editor = null;
    this.editorElementId = editorElementId;
    this.currentFile = null;
    this.isTableView = false;
    this.tableData = null;
    this.gtfsParser = null;
    this.viewPreference = this.loadViewPreference();
  }

  initialize(gtfsParser) {
    this.gtfsParser = gtfsParser;
    
    // Use simple textarea instead of CodeMirror for now
    this.editor = document.getElementById(this.editorElementId);
    if (!this.editor) {
      return;
    }

    // Initialize toggle state
    this.updateToggleLabels();
    
    // Initially hide toggle until a file is opened
    const viewToggle = document.getElementById('view-toggle-checkbox');
    if (viewToggle && viewToggle.parentElement) {
      viewToggle.parentElement.style.display = 'none';
    }
  }

  loadViewPreference() {
    try {
      return window.localStorage.getItem('gtfs-editor-view-preference') === 'table';
    } catch {
      return false; // Default to text view
    }
  }

  saveViewPreference(isTableView) {
    try {
      window.localStorage.setItem('gtfs-editor-view-preference', isTableView ? 'table' : 'text');
    } catch {
      // Ignore localStorage errors
    }
  }

  updateToggleLabels() {
    const textOption = document.querySelector('.toggle-text.text-option');
    const tableOption = document.querySelector('.toggle-text.table-option');
    
    if (textOption && tableOption) {
      if (this.isTableView) {
        textOption.classList.remove('active');
        tableOption.classList.add('active');
      } else {
        textOption.classList.add('active');
        tableOption.classList.remove('active');
      }
    }
  }

  // Helper methods for simple textarea
  setEditorValue(content) {
    if (this.editor) {
      this.editor.value = content;
    }
  }

  getEditorValue() {
    return this.editor ? this.editor.value : '';
  }

  openFile(fileName) {
    if (!this.gtfsParser || !this.gtfsParser.getFileContent(fileName)) {
      return;
    }

    // Update current file
    this.currentFile = fileName;
    const fileNameElement = document.getElementById('current-file-name');
    if (fileNameElement) {
      fileNameElement.textContent = fileName;
    }

    // Determine if file can be viewed as table (CSV files)
    const canShowTable = fileName.endsWith('.txt') && this.gtfsParser.getFileData(fileName);
    const viewToggle = document.getElementById('view-toggle-checkbox');

    if (canShowTable) {
      // Show toggle and set to saved preference
      if (viewToggle) {
        viewToggle.parentElement.style.display = 'flex';
        if (this.viewPreference) {
          this.switchToTableView();
        } else {
          this.switchToTextView();
        }
      }
    } else {
      // Hide toggle and switch to text view
      if (viewToggle) {
        viewToggle.parentElement.style.display = 'none';
      }
      this.switchToTextView();
    }

    // Update editor content
    this.setEditorValue(this.gtfsParser.getFileContent(fileName));
  }

  closeEditor() {
    // Save current changes
    this.saveCurrentFileChanges();
    this.currentFile = null;
  }

  switchToTextView() {
    this.isTableView = false;
    this.viewPreference = false;
    this.saveViewPreference(false);

    // Update toggle state
    const viewToggle = document.getElementById('view-toggle-checkbox');
    if (viewToggle) {
      viewToggle.checked = false;
    }

    // Update text labels
    this.updateToggleLabels();

    // Show text editor, hide table editor
    const textView = document.getElementById('text-editor-view');
    const tableView = document.getElementById('table-editor-view');

    if (textView) {
      textView.classList.remove('hidden');
    }
    if (tableView) {
      tableView.classList.add('hidden');
    }

    // Update text content from table if needed
    if (this.tableData) {
      this.syncTableToText();
    }
  }

  switchToTableView() {
    if (!this.currentFile || !this.gtfsParser.getFileData(this.currentFile)) {
      return;
    }

    this.isTableView = true;
    this.viewPreference = true;
    this.saveViewPreference(true);

    // Update toggle state
    const viewToggle = document.getElementById('view-toggle-checkbox');
    if (viewToggle) {
      viewToggle.checked = true;
    }

    // Update text labels
    this.updateToggleLabels();

    // Show table editor, hide text editor
    const textView = document.getElementById('text-editor-view');
    const tableView = document.getElementById('table-editor-view');

    if (textView) {
      textView.classList.add('hidden');
    }
    if (tableView) {
      tableView.classList.remove('hidden');
    }

    // Build table
    this.buildTableEditor();
  }

  buildTableEditor() {
    const data = this.gtfsParser.getFileData(this.currentFile);
    if (!data || data.length === 0) {
      return;
    }

    // Get headers from first row
    const headers = Object.keys(data[0]);

    // Create table HTML
    let tableHTML = '<table id="data-table"><thead><tr>';
    headers.forEach((header) => {
      tableHTML += `<th>${header}</th>`;
    });
    tableHTML += '</tr></thead><tbody>';

    // Add data rows
    data.forEach((row, rowIndex) => {
      tableHTML += '<tr>';
      headers.forEach((header) => {
        const value = row[header] || '';
        tableHTML += `<td><input type="text" value="${this.escapeHtml(value)}" data-row="${rowIndex}" data-col="${header}" /></td>`;
      });
      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';

    // Set table content in the container
    document.getElementById('table-editor').innerHTML = tableHTML;

    // Add event listeners for cell changes
    document.querySelectorAll('#data-table input').forEach((input) => {
      input.addEventListener('change', (e) => {
        this.updateTableCell(e.target);
      });
    });

    // Store reference to table data
    this.tableData = data;
  }

  updateTableCell(input) {
    const row = parseInt(input.dataset.row);
    const col = input.dataset.col;
    const value = input.value;

    if (this.tableData && this.tableData[row]) {
      this.tableData[row][col] = value;
    }
  }

  syncTableToText() {
    if (!this.tableData) {
      return;
    }

    // Convert table data back to CSV
    const csv = Papa.unparse(this.tableData);
    this.setEditorValue(csv);
    
    // Update the parser's data
    if (this.gtfsParser && this.currentFile) {
      this.gtfsParser.updateFileContent(this.currentFile, csv);
    }
  }

  saveCurrentFileChanges() {
    if (!this.currentFile || !this.gtfsParser) {
      return;
    }

    if (this.isTableView && this.tableData) {
      // Save from table
      this.syncTableToText();
    } else if (this.editor) {
      // Save from text editor
      const content = this.getEditorValue();
      this.gtfsParser.updateFileContent(this.currentFile, content);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getCurrentFile() {
    return this.currentFile;
  }
}