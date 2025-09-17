import Papa from 'papaparse';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { placeholder } from '@codemirror/view';
import { StreamLanguage } from '@codemirror/language';
import Clusterize from 'clusterize.js';

// Simple Mathematica-inspired syntax highlighting for CSV
const csvMathematicaMode = {
  name: 'csv-mathematica',
  startState: function() {
    return { lineStart: true, firstLine: true };
  },
  token: function(stream, state) {
    // Handle quoted strings first
    if (stream.match(/"[^"]*"/)) {
      return 'string'; // Quoted values as strings (green)
    }
    
    // Handle numbers (integers and floats)
    if (stream.match(/\b\d+\.?\d*\b/)) {
      return 'number'; // Numbers (orange/red)
    }
    
    // Handle commas
    if (stream.match(/,/)) {
      return 'operator'; // Commas as operators
    }
    
    // Handle headers on first line
    if (state.firstLine && stream.match(/[A-Za-z][A-Za-z0-9_]*/)) {
      return 'keyword'; // Headers as keywords (blue)
    }
    
    // Handle IDs and identifiers
    if (stream.match(/[A-Za-z][A-Za-z0-9_]*/)) {
      return 'variable'; // Regular text as variables
    }
    
    // Reset firstLine at end of first line
    if (stream.eol() && state.firstLine) {
      state.firstLine = false;
    }
    
    // Default - consume one character
    if (!stream.eol()) {
      stream.next();
    }
    return null;
  }
};

export class Editor {
  constructor(editorElementId = 'simple-editor') {
    this.editor = null;
    this.editorView = null;
    this.editorElementId = editorElementId;
    this.currentFile = null;
    this.isTableView = false;
    this.tableData = null;
    this.gtfsParser = null;
    this.viewPreference = this.loadViewPreference();
    this.clusterize = null;
    this.headers = [];
  }

  initialize(gtfsParser) {
    this.gtfsParser = gtfsParser;
    
    // Initialize CodeMirror editor
    this.editor = document.getElementById(this.editorElementId);
    if (!this.editor) {
      return;
    }

    // Create CodeMirror editor instance
    const startState = EditorState.create({
      doc: '',
      extensions: [
        basicSetup,
        StreamLanguage.define(csvMathematicaMode),
        placeholder('Select a file from the sidebar to edit its content...'),
        // Use a light theme by default, could add theme switching later
        EditorView.theme({
          '&': {
            fontSize: '14px',
            height: '100%'
          },
          '.cm-content': {
            padding: '10px'
          },
          '.cm-focused': {
            outline: 'none'
          },
          '.cm-placeholder': {
            color: '#999',
            fontSize: '14px'
          }
        })
      ]
    });

    // Clear the container and create CodeMirror view
    this.editor.innerHTML = '';
    this.editorView = new EditorView({
      state: startState,
      parent: this.editor
    });

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

  // Helper methods for CodeMirror
  setEditorValue(content) {
    if (this.editorView) {
      this.editorView.dispatch({
        changes: {
          from: 0,
          to: this.editorView.state.doc.length,
          insert: content
        }
      });
    }
  }

  getEditorValue() {
    return this.editorView ? this.editorView.state.doc.toString() : '';
  }

  openFile(fileName) {
    if (!this.gtfsParser || !this.gtfsParser.getFileContent(fileName)) {
      return;
    }

    // Clear table data when switching to a new file
    this.tableData = null;

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
    
    // Clean up Clusterize instance
    if (this.clusterize) {
      this.clusterize.destroy();
      this.clusterize = null;
    }
    
    this.currentFile = null;
  }

  clearEditor() {
    // Clear the editor content
    this.setEditorValue('');
    this.currentFile = null;
    
    // Clear table view
    if (this.clusterize) {
      this.clusterize.destroy();
      this.clusterize = null;
    }
    this.tableData = null;
    
    // Switch to text view
    this.switchToTextView();
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
    this.headers = Object.keys(data[0]);
    this.tableData = data;

    // Create table container with proper structure for Clusterize.js
    const tableContainer = document.getElementById('table-editor');
    tableContainer.innerHTML = `
      <div class="clusterize-scroll" id="scrollArea">
        <table class="clusterize-table" id="table">
          <thead>
            <tr>
              ${this.headers.map(header => `<th>${this.escapeHtml(header)}</th>`).join('')}
            </tr>
          </thead>
          <tbody class="clusterize-content" id="contentArea">
          </tbody>
        </table>
      </div>
    `;

    // Generate row data for Clusterize.js
    const rows = data.map((row, rowIndex) => {
      const cells = this.headers.map((header) => {
        const value = row[header] || '';
        return `<td><input type="text" value="${this.escapeHtml(value)}" data-row="${rowIndex}" data-col="${header}" /></td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    });

    // Destroy existing Clusterize instance if it exists
    if (this.clusterize) {
      this.clusterize.destroy();
    }

    // Initialize Clusterize.js
    this.clusterize = new Clusterize({
      rows: rows,
      scrollId: 'scrollArea',
      contentId: 'contentArea',
      rows_in_block: 50, // Number of rows to render at once
      blocks_in_cluster: 4, // Number of blocks to keep in memory
      tag: 'tr' // Table row tag
    });

    // Add event delegation for input changes since rows are dynamically created
    const scrollArea = document.getElementById('scrollArea');
    scrollArea.addEventListener('change', (e) => {
      if (e.target.tagName === 'INPUT' && e.target.dataset.row) {
        this.updateTableCell(e.target);
      }
    });

    // Add input event for real-time updates
    scrollArea.addEventListener('input', (e) => {
      if (e.target.tagName === 'INPUT' && e.target.dataset.row) {
        this.updateTableCell(e.target);
      }
    });
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
    } else if (this.editorView) {
      // Save from CodeMirror editor
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