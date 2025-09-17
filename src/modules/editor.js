import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import Papa from 'papaparse';

export class Editor {
  constructor(editorElementId = 'simple-editor') {
    this.editor = null;
    this.editorElementId = editorElementId;
    this.currentFile = null;
    this.isTableView = false;
    this.tableData = null;
    this.gtfsParser = null;
  }

  initialize(gtfsParser) {
    this.gtfsParser = gtfsParser;
    
    // Use simple textarea instead of CodeMirror for now
    this.editor = document.getElementById(this.editorElementId);
    if (!this.editor) {
      console.warn(`Editor element with ID '${this.editorElementId}' not found`);
      return;
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
    const tableBtn = document.getElementById('view-table-btn');

    if (tableBtn) {
      if (canShowTable) {
        tableBtn.style.display = 'block';
        // Default to table view for CSV files
        this.switchToTableView();
      } else {
        tableBtn.style.display = 'none';
        this.switchToTextView();
      }
    } else {
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

    // Update button states
    const textBtn = document.getElementById('view-text-btn');
    const tableBtn = document.getElementById('view-table-btn');

    if (textBtn) {
      textBtn.className =
        'px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600';
    }
    if (tableBtn) {
      tableBtn.className =
        'px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400';
    }

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

    // Update button states
    const textBtn = document.getElementById('view-text-btn');
    const tableBtn = document.getElementById('view-table-btn');

    if (textBtn) {
      textBtn.className =
        'px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400';
    }
    if (tableBtn) {
      tableBtn.className =
        'px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600';
    }

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