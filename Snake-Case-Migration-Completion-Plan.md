# Snake Case Migration Completion Plan

## Migration Overview

The GTFS.zone codebase has been successfully migrated from camelCase to snake_case property naming to match the GTFS specification exactly. This eliminates the confusion between GTFS CSV field names and application property names.

## Object Usage Analysis

**Current State: Mixed object approach (NOT consistently using Zod-typed objects)**

- **Zod-typed objects**: 32 files import proper GTFS types (`Stop`, `Route`, `Trip`, etc.)
- **Generic objects**: 107 occurrences of `Record<string, unknown>` across 10 files
- **Database records**: 69 occurrences of `GTFSDatabaseRecord` (generic type)

## Completion Status

### ✅ **COMPLETED**
- [x] Property access migration (660+ conversions from camelCase to snake_case)
- [x] Type generation script updated to preserve snake_case
- [x] TypeScript types regenerated with snake_case field names
- [x] Core transformation logic updated in utils
- [x] Schema generation updated to use snake_case

### 🔧 **HIGH PRIORITY FIXES** (Critical for app functionality)

#### 1. Fix GTFSParser Interface Compatibility
- **Issue**: Return types incompatible (`| null` vs proper arrays)
- **Files**: `src/index.ts`, `src/modules/gtfs-parser.ts`
- **Fix**: Update method signatures and return types
- **Impact**: Blocking basic app initialization

#### 2. Fix GTFSRelationships Type Signatures
- **Issue**: Calendar/CalendarDates field mapping broken
- **Files**: `src/modules/gtfs-relationships.ts`
- **Fix**: Update property visibility and field mappings
- **Impact**: Navigation and relationship resolution broken

#### 3. Update Object Destructuring Patterns
- **Issue**: `{ camelCase }` patterns still exist
- **Search**: `grep -r "{ *[a-z][A-Z]" src/`
- **Fix**: Convert all destructuring to `{ snake_case }`
- **Impact**: Runtime property access errors

#### 4. Fix Interface Type Mismatches
- **Issue**: Inconsistent interface definitions
- **Files**: Multiple module interfaces
- **Fix**: Align all interfaces to use snake_case consistently
- **Impact**: TypeScript compilation errors

### 🎯 **MEDIUM PRIORITY** (Type safety improvements)

#### 5. Replace Generic Objects with Proper Zod Types
- **Issue**: 107 occurrences of `Record<string, unknown>`
- **Goal**: Use typed GTFS objects (`Stop`, `Route`, `Trip`, etc.)
- **Benefit**: Better type safety and IDE support
- **Files**: 10 files with generic object usage

#### 6. Standardize on GTFSTableMap Types
- **Issue**: Mixed usage of `GTFSDatabaseRecord` vs specific types
- **Goal**: Use `GTFSTableMap[T]` for type-safe entity access
- **Benefit**: Compile-time validation of entity properties

#### 7. Update Test Files
- **Issue**: Test type errors and property access
- **Files**: `tests/*.test.ts`
- **Fix**: Update test assertions and mocks

### 📝 **LOW PRIORITY** (Documentation and cleanup)

#### 8. Update Documentation
- **Update CLAUDE.md**: Document snake_case migration completion
- **Remove references**: Delete camelCase transformation documentation
- **Add guidance**: Best practices for snake_case usage

#### 9. Run Comprehensive Tests
- **Functional testing**: Verify all app features work
- **Performance testing**: Ensure no regressions
- **Browser testing**: Cross-browser compatibility

## Implementation Strategy

### Phase 1: Critical Fixes (Day 1)
1. **Start with GTFSParser interface fixes** - resolves most critical errors
2. **Fix GTFSRelationships type signatures** - restores navigation
3. **Update object destructuring patterns** - prevents runtime errors

### Phase 2: Type Safety (Day 2-3)
1. **Replace generic objects with Zod types** - improves developer experience
2. **Standardize on GTFSTableMap** - consistent type usage
3. **Fix remaining interface mismatches** - clean TypeScript compilation

### Phase 3: Polish (Day 4)
1. **Update tests** - ensure functionality works
2. **Update documentation** - reflect new architecture
3. **Performance verification** - no regressions

## Benefits Achieved

✅ **Eliminates camelCase/snake_case confusion**
✅ **Matches GTFS specification exactly**
✅ **Simpler CSV import/export** (no field name transformation)
✅ **Reduced cognitive load** for developers
✅ **Fewer property access bugs**
✅ **Consistent with industry standards**

## Key Files Modified

- `scripts/generate-gtfs-types.ts` - Type generation logic
- `src/utils/zod-tooltip-helper.ts` - Field name transformation
- `src/types/gtfs.ts` - Generated type definitions
- 30+ module files with property access updates

## Next Steps

**IMMEDIATE**: Start with GTFSParser interface compatibility fixes in `src/index.ts` and `src/modules/gtfs-parser.ts`. This will resolve the most critical TypeScript errors and get the application running again.

**Command to check progress**:
```bash
npm run typecheck | head -20  # See remaining errors
```

## Migration Success Criteria

- [ ] TypeScript compilation with zero errors
- [ ] All tests passing
- [ ] Application loads and functions correctly
- [ ] No runtime property access errors
- [ ] Performance maintained or improved

---

*Migration started: 2025-09-27*
*Status: Core migration complete, interface fixes in progress*