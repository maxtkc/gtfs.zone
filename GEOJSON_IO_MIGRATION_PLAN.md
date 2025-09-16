# Migration Plan: Align GTFS.io with geojson.io Tech Stack

## Overview
This document outlines the plan to modernize GTFS.io's tech stack to closely mirror [geojson.io](https://github.com/mapbox/geojson.io)'s proven architecture while maintaining our GTFS-specific functionality and keeping Leaflet for mapping.

## Current State Analysis

### ✅ Already Aligned
- **Build System**: Rollup + ES modules + Terser minification
- **Development**: live-server + concurrently for parallel processes  
- **Deployment**: gh-pages for GitHub Pages hosting
- **CSS Framework**: Tailwind CSS (though integration differs)
- **Package Management**: npm with similar script patterns

### 🔄 Key Differences to Address

| Component | geojson.io | GTFS.io (Current) | Priority |
|-----------|------------|-------------------|----------|
| **Code Editor** | CodeMirror 6 | Monaco Editor | High |
| **Code Quality** | ESLint + Prettier | None | High |
| **Build Integration** | HTML/CSS in Rollup | Manual processes | Medium |
| **File Structure** | Organized modules | Basic structure | Medium |
| **Entry Point** | `src/index.js` | `src/js/main.js` | Low |

## Migration Plan

### Phase 1: Code Quality & Tooling (High Priority)

#### 1.1 Add ESLint + Prettier
```bash
npm install --save-dev eslint prettier eslint-config-prettier
```

**Files to create:**
- `.eslintrc.json` - Based on geojson.io's configuration
- `.prettierrc` - Code formatting rules
- `.eslintignore` - Exclude dist/, node_modules/

**Scripts to add to package.json:**
```json
{
  "lint": "eslint src/",
  "lint:fix": "eslint src/ --fix",
  "format": "prettier --write src/"
}
```

#### 1.2 Replace Monaco Editor with CodeMirror 6
**Why CodeMirror 6:**
- Lighter weight (~300KB vs ~2MB for Monaco)
- Better CSV syntax highlighting
- Matches geojson.io's approach
- More suitable for simple text editing

**Dependencies to change:**
```bash
# Remove
npm uninstall monaco-editor

# Add
npm install @codemirror/state @codemirror/view @codemirror/basic-setup @codemirror/lang-csv
```

**Implementation changes:**
- Update `src/js/main.js` to use CodeMirror API
- Replace Monaco's `setValue/getValue` with CodeMirror equivalents
- Update editor styling to match our current design

### Phase 2: Build System Enhancement (Medium Priority)

#### 2.1 Enhanced Rollup Configuration
**Add plugins to match geojson.io:**
```bash
npm install --save-dev @rollup/plugin-html @rollup/plugin-copy rollup-plugin-css-bundle
```

**New rollup.config.js features:**
- HTML processing and template injection
- CSS bundling and minification
- Asset copying (images, fonts, icons)
- Environment-based configuration

#### 2.2 Integrated CSS Pipeline
**Current:** Manual Tailwind build with separate command
**Target:** CSS bundled through Rollup pipeline

**Changes needed:**
- Move Tailwind CSS processing into Rollup
- Remove separate `build:css` script
- Automatic CSS watching and rebuilding

### Phase 3: File Structure Optimization (Low Priority)

#### 3.1 Reorganize File Structure
**Current:**
```
src/
├── js/main.js
├── css/styles.css
└── index.html
```

**Target (geojson.io pattern):**
```
src/
├── index.js              # Main entry point
├── modules/
│   ├── gtfs-parser.js    # GTFS file handling
│   ├── map-controller.js # Leaflet map management
│   ├── editor.js         # CodeMirror integration
│   └── ui.js             # UI components
├── styles/
│   └── main.css          # Tailwind source
└── index.html
```

#### 3.2 Module Separation
Break down the monolithic `main.js` into focused modules:
- **gtfs-parser.js**: ZIP handling, CSV parsing, data validation
- **map-controller.js**: Leaflet map, markers, route visualization  
- **editor.js**: CodeMirror setup, file editing logic
- **ui.js**: UI interactions, file tree, modals

## Implementation Guide for AI Assistants

### Step-by-Step Implementation

#### Step 1: ESLint + Prettier Setup
1. Install dev dependencies for linting
2. Create config files based on geojson.io patterns
3. Add npm scripts for linting/formatting
4. Run initial format pass on existing code

#### Step 2: CodeMirror Migration
1. Remove Monaco Editor dependency
2. Install CodeMirror 6 packages
3. Replace editor initialization in `main.js`
4. Update all editor interactions (setValue, getValue, etc.)
5. Test editor functionality thoroughly

#### Step 3: Rollup Enhancement
1. Add HTML, CSS, and copy plugins
2. Create comprehensive rollup config
3. Update build scripts
4. Test build output matches current functionality

#### Step 4: Code Modularization
1. Create new module files
2. Extract functionality from `main.js`
3. Update imports/exports
4. Test application functionality

### Testing Checklist
After each phase, verify:
- [ ] Application loads correctly
- [ ] GTFS file upload works
- [ ] Map visualization displays
- [ ] File editing functions
- [ ] Export downloads correctly
- [ ] All tests pass (`npm test`)

### Rollback Strategy
- Each phase should be completed in separate commits
- Keep original files until functionality is verified
- Maintain backup of working `main.js` until modularization complete

## Benefits of Migration

1. **Developer Experience**: Better code quality tools, consistent formatting
2. **Performance**: Lighter editor reduces bundle size significantly
3. **Maintainability**: Modular code structure easier to understand and modify
4. **Consistency**: Aligned with proven geojson.io patterns
5. **Build Efficiency**: More integrated and automated build pipeline

## What We Keep Different

- **Leaflet mapping** (instead of Mapbox GL)
- **Playwright testing** (superior to geojson.io's Tape)
- **GTFS-specific dependencies** (JSZip, PapaParse)
- **Core GTFS functionality** (parsing, validation, export)

## Success Metrics

- [ ] Bundle size reduced by >1MB (Monaco → CodeMirror)
- [ ] Build time improved with integrated pipeline
- [ ] Code quality scores improve with linting
- [ ] All existing functionality preserved
- [ ] Test suite continues to pass
- [ ] Development experience enhanced

This migration will modernize our codebase while maintaining the robust GTFS editing capabilities that make GTFS.io unique.