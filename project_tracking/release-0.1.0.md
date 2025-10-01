# Release 0.1.0 Checklist

**Status:** 🎯 Ready to Plan
**Target Date:** TBD
**Version:** 0.0.4 → 0.1.0
**Release Type:** Minor Release (First Public Beta)

## Overview

Release 0.1.0 represents the first public beta of gtfs.zone with core editing functionality complete. This release focuses on stability, polish, and ensuring all critical features work reliably for real-world GTFS editing workflows.

## Version Status

Current version: **0.0.4** (from package.json)

The 0.1.0 release represents:
- ✅ Core features complete and stable
- ✅ Timetable editing functional
- ✅ Production-ready for basic GTFS editing tasks
- 🎯 First recommended version for external users

---

## Pre-Release Requirements

### Core Functionality (MUST HAVE)

#### Data Management
- [x] Upload GTFS ZIP files
- [x] Parse GTFS files with validation
- [x] Export modified GTFS ZIP files
- [x] IndexedDB persistence (offline editing)
- [x] Load GTFS from URL
- [x] Create new empty GTFS feed

#### Map Visualization
- [x] Display stops on map
- [x] Display route shapes on map
- [x] Cluster stops for performance
- [x] Highlight selected stops/routes
- [x] Map search functionality
- [x] Stop popups with information

#### Editing Capabilities
- [x] File editor (text view)
- [x] Table editor (spreadsheet view)
- [x] Timetable view and editing
- [x] Edit stop times (arrival/departure)
- [x] Link/unlink arrival/departure times
- [x] Auto-save functionality
- [ ] **CRITICAL**: Test timetable editing with real feeds
- [ ] **CRITICAL**: Verify stop sequence renumbering works correctly

#### Navigation
- [x] Objects browser (hierarchical navigation)
- [x] Breadcrumb navigation
- [x] URL-based state management
- [x] Deep linking support
- [x] Search within objects

#### User Experience
- [x] Dark/light theme support
- [x] Loading states and progress indicators
- [x] Error notifications
- [x] Success notifications
- [x] Keyboard shortcuts
- [x] Help documentation

---

### Bug Fixes (MUST FIX)

#### Critical Bugs
- [ ] **MBTA Feed Loading**: Implement non-GTFS file filtering (see misc-improvements.md)
- [ ] **Load Dropdown**: Fix z-index and auto-close issues
- [ ] **Timetable Refresh**: Verify timetable refreshes after edits
- [ ] **Database Errors**: Ensure all database errors are caught and displayed (FAIL HARD policy)

#### Known Issues to Address
- [ ] Verify export data integrity (all edits preserved)
- [ ] Test with large GTFS feeds (>50MB)
- [ ] Memory management for large datasets
- [ ] Browser compatibility (Chrome, Firefox, Safari, Edge)

---

### Testing (REQUIRED)

#### Automated Tests
- [ ] Run full Playwright test suite
- [ ] All tests passing
- [ ] No test failures or warnings
- [ ] Performance tests passing

```bash
npm test                    # Full test suite must pass
npm run test:headed         # Visual verification
npm run perf-test          # Performance benchmarks
```

#### Manual Testing Checklist

**File Operations:**
- [ ] Upload GTFS ZIP → loads successfully
- [ ] Create new feed → creates minimal GTFS structure
- [ ] Export feed → downloads valid ZIP
- [ ] Load from URL → fetches and parses remote feed

**Editing Workflow:**
- [ ] Edit stop_times.txt in text editor → saves changes
- [ ] Edit stops.txt in table editor → saves changes
- [ ] Edit timetable (linked times) → updates correctly
- [ ] Edit timetable (unlinked times) → updates correctly
- [ ] Add stop row to timetable → inserts and renumbers sequence
- [ ] Verify changes persist after page reload

**Navigation:**
- [ ] Browse → Routes → Select route → View on map
- [ ] Browse → Stops → Select stop → View on map
- [ ] Browse → Routes → Service → View timetable
- [ ] Deep link with URL → restores correct view
- [ ] Breadcrumbs → navigate back correctly

**Map Interactions:**
- [ ] Click stop marker → shows popup
- [ ] Click stop in objects → highlights on map
- [ ] Search for stop → filters and highlights
- [ ] Route highlighting → shows correct shape

**Performance:**
- [ ] Load large feed (<5s for 100k+ records)
- [ ] Smooth scrolling in timetable view
- [ ] No lag when editing stop times
- [ ] Map remains responsive with 1000+ stops

**Browser Compatibility:**
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

#### Real-World Feed Testing

Test with actual GTFS feeds from:
- [ ] Columbia County (small feed, ~50 stops)
- [ ] West Bus Service (medium feed)
- [ ] MBTA (large feed with non-standard files)
- [ ] Sample feed from Google GTFS examples

---

### Code Quality

#### Linting and Formatting
```bash
npm run lint               # Must pass with no errors
npm run format             # Format all code
npm run typecheck          # TypeScript must compile
```

- [ ] No ESLint errors
- [ ] No TypeScript errors
- [ ] All files formatted with Prettier
- [ ] No console.log in production code (except debug)

#### Documentation
- [ ] README.md up to date
- [ ] CLAUDE.md up to date
- [ ] CHANGELOG.md created for 0.1.0
- [ ] All functions have JSDoc comments
- [ ] Complex algorithms documented

#### Code Review
- [ ] All TODO comments resolved or documented
- [ ] No commented-out code blocks
- [ ] Error handling follows FAIL HARD policy
- [ ] No `as any` type assertions
- [ ] Proper use of Enhanced GTFS Object pattern

---

### Performance & Optimization

#### Bundle Size
```bash
npm run build              # Build production bundle
npm run analyze-bundle     # Check bundle size
```

- [ ] Total bundle < 2MB
- [ ] Initial load < 500KB
- [ ] Code splitting working
- [ ] Tree shaking effective

#### Lighthouse Scores
```bash
npm run lighthouse         # Run Lighthouse audit
```

Target scores:
- [ ] Performance: > 90
- [ ] Accessibility: > 95
- [ ] Best Practices: > 95
- [ ] SEO: > 90

#### Memory & Performance
- [ ] No memory leaks (tested with large feeds)
- [ ] IndexedDB queries optimized
- [ ] Map rendering optimized (clustering)
- [ ] Virtual scrolling working in tables

---

### Security & Accessibility

#### Security
- [ ] No XSS vulnerabilities (escapeHtml used)
- [ ] CORS configured correctly
- [ ] No sensitive data in localStorage
- [ ] Dependencies audited (npm audit)

```bash
npm audit                  # Check for vulnerabilities
npm run audit              # Run audit-ci
```

#### Accessibility
- [ ] Keyboard navigation works
- [ ] ARIA labels present
- [ ] Color contrast meets WCAG AA
- [ ] Screen reader compatible
- [ ] Focus indicators visible

---

### Documentation Updates

#### User Documentation
- [ ] Update README with 0.1.0 features
- [ ] Update Help tab in app
- [ ] Create CHANGELOG.md entry
- [ ] Update examples and screenshots

#### Developer Documentation
- [ ] Update CLAUDE.md with recent changes
- [ ] Document new modules
- [ ] Update architecture diagrams if needed
- [ ] Document known limitations

#### Release Notes

Create `CHANGELOG.md` with:

```markdown
# Changelog

## [0.1.0] - YYYY-MM-DD

### Added
- Full timetable editing with linked/unlinked times
- Auto-save functionality for all edits
- URL-based deep linking for all views
- Service days management (calendar and calendar_dates)
- Stop view with related routes and trips
- Direction tabs in timetable view
- Keyboard shortcuts for common operations

### Changed
- Improved map performance with clustering
- Better error handling (FAIL HARD policy)
- Enhanced GTFS Object pattern for type safety
- Refactored database layer for reliability

### Fixed
- Stop sequence renumbering after edits
- Timetable refresh after time changes
- Memory leaks with large datasets
- Browser compatibility issues

### Known Limitations
- Mobile support not yet implemented
- Route editing not yet available
- Limited GTFS-Flex support
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Code review complete
- [ ] Documentation updated
- [ ] Version bumped to 0.1.0

```bash
npm run version:minor      # Bump to 0.1.0
git add package.json
git commit -m "Bump version to 0.1.0"
git tag v0.1.0
```

### Build
- [ ] Clean build successful
- [ ] No build warnings
- [ ] Assets optimized
- [ ] Source maps generated

```bash
rm -rf dist node_modules
npm install
npm run build
npm run lighthouse        # Verify built version
```

### Deployment
- [ ] Push to GitHub
- [ ] Create GitHub release
- [ ] Deploy to GitHub Pages
- [ ] Verify live site working

```bash
git push origin main
git push origin v0.1.0
npm run deploy            # Deploy to gh-pages
```

### Post-Deployment
- [ ] Visit https://gtfs.zone
- [ ] Test upload functionality
- [ ] Test example feeds
- [ ] Verify all features working
- [ ] Check browser console for errors

---

## Communication Plan

### Announcement
- [ ] GitHub release notes published
- [ ] README badges updated
- [ ] Social media announcement (if applicable)
- [ ] Share with GTFS community

### Feedback Collection
- [ ] GitHub Issues template ready
- [ ] Bug report template ready
- [ ] Feature request template ready
- [ ] Contributing guidelines ready

---

## Post-Release Plan

### Monitoring
- [ ] Set up error tracking (if not already)
- [ ] Monitor GitHub issues
- [ ] Track usage metrics (if available)
- [ ] Collect user feedback

### Quick Fixes
If critical bugs are found:
- [ ] Create patch release (0.1.1)
- [ ] Fix critical issues only
- [ ] Deploy patch within 24-48 hours

### Next Steps (0.2.0 Planning)
After 0.1.0 is stable, prioritize:
1. Mobile support (high priority)
2. Route editing with map (high priority)
3. Enhanced timetable features (medium priority)
4. Additional keyboard shortcuts (low priority)

---

## Feature Freeze

**IMPORTANT: Code Freeze Date**

Once the code freeze date is set:
- ✅ **ALLOWED**: Bug fixes only
- ✅ **ALLOWED**: Documentation updates
- ✅ **ALLOWED**: Test improvements
- ❌ **NOT ALLOWED**: New features
- ❌ **NOT ALLOWED**: Refactoring
- ❌ **NOT ALLOWED**: Dependency updates (unless security)

---

## Risk Assessment

### High Risk Items
1. **Timetable Editing Stability**
   - Risk: Complex sequence renumbering might have edge cases
   - Mitigation: Extensive testing with real feeds
   - Contingency: Disable feature if critical bugs found

2. **Large Feed Performance**
   - Risk: Browser memory limits with very large feeds
   - Mitigation: Implement limits and warnings
   - Contingency: Document limitations in README

3. **Browser Compatibility**
   - Risk: IndexedDB issues on older browsers
   - Mitigation: Test on all major browsers
   - Contingency: Show compatibility warning

### Medium Risk Items
- Export data integrity
- Deep linking edge cases
- Theme switching bugs
- Keyboard shortcut conflicts

### Low Risk Items
- UI polish issues
- Minor visual bugs
- Help documentation gaps

---

## Success Criteria

Release 0.1.0 is successful if:
- ✅ All critical tests passing
- ✅ No P0 (critical) bugs
- ✅ Documentation complete
- ✅ Deployment successful
- ✅ Can edit and export real GTFS feed
- ✅ Positive initial feedback from users

---

## Rollback Plan

If major issues are discovered post-release:

1. **Immediate Actions:**
   - Add warning banner to site
   - Document issue in GitHub
   - Roll back to 0.0.4 if needed

2. **Rollback Commands:**
```bash
git revert v0.1.0
npm run version:patch      # Create 0.1.1
git push origin main
npm run deploy
```

3. **Communication:**
   - Update GitHub release notes
   - Post issue on GitHub
   - Notify users if possible

---

## Team Notes

### Before Release
- Review all tracking files in `project_tracking/`
- Ensure CLAUDE.md is up to date
- Check that all dependencies are current
- Verify LICENSE is correct

### During Release
- Follow checklist sequentially
- Don't skip steps
- Document any deviations
- Take screenshots of successful tests

### After Release
- Update this file with actual release date
- Document lessons learned
- Plan next release (0.2.0)
- Celebrate! 🎉

---

## References

Related tracking files:
- `map-routing.md` - Future feature
- `map-stops.md` - Future feature
- `map-enhancements.md` - Future feature
- `browse-general.md` - Future feature
- `browse-stop.md` - Partially implemented
- `browse-route.md` - Future feature
- `timetable-editing.md` - **Required for 0.1.0**
- `timetable-enhancements.md` - Future feature
- `mobile-support.md` - Future feature (0.2.0)
- `misc-improvements.md` - Some required for 0.1.0

**Priority for 0.1.0:**
1. Complete timetable editing testing
2. Fix MBTA loading bug (non-GTFS files)
3. Fix load dropdown bug
4. All tests passing
5. Documentation complete

Everything else can wait for 0.2.0.
