# GTFS Field Types Improvement Plan

## Progress Summary

**Phase 1: COMPLETED ✅**
- Created comprehensive field type definitions with validation metadata
- Updated type generation script to use hardcoded type mapping
- All 17 GTFS field types now have dedicated handling

**Phase 2: COMPLETED ✅**
- Enhanced gtfs-caster.ts with type-specific validation
- Updated gtfs-validator.ts with type-aware validation methods
- All validation now uses centralized field type metadata

**Phase 3: COMPLETED ✅**
- Created field formatters for all types (Color, Date, Time, etc.)
- Updated UI components to use proper HTML5 input types
- Form fields now auto-detect field types and use appropriate inputs

**Phase 4: COMPLETED ✅**
- Updated gtfs-parser.ts with type-aware CSV parsing and export formatting
- Numeric fields properly formatted (no scientific notation)
- Latitude/Longitude exported with 6 decimal places

**Phase 5: PENDING**
- Tests and documentation needed

---

## Overview

This plan outlines how we will improve handling of GTFS field types by hardcoding type definitions and special handling logic instead of fetching them from the reference page. This will ensure consistent validation, proper UI components, and correct data parsing/formatting across the application.

## GTFS Field Types Reference

### String-Based Types
- **Text** - UTF-8 string for display
- **URL** - Fully qualified URL with `http://` or `https://`
- **Email** - Email address
- **Phone number** - Phone number
- **Language code** - IETF BCP 47 language code (e.g., `en`, `en-US`)
- **Currency code** - ISO 4217 alphabetical currency code (e.g., `CAD`, `EUR`, `JPY`)
- **Timezone** - TZ timezone (e.g., `Asia/Tokyo`, `America/Los_Angeles`)
- **Color** - Six-digit hexadecimal color without `#` (e.g., `FFFFFF`, `0039A6`)
- **ID** - UTF-8 sequence (preferably printable ASCII)

### Date/Time Types
- **Date** - `YYYYMMDD` format (e.g., `20180913`)
- **Time** - `HH:MM:SS` or `H:MM:SS` format, can exceed 24:00:00 (e.g., `14:30:00`, `25:35:00`)

### Numeric Types
- **Integer** - Integer value
- **Float** - Floating point number
- **Currency amount** - Decimal value (use decimal/currency type, NOT float)
- **Latitude** - WGS84 decimal degrees, -90.0 to 90.0
- **Longitude** - WGS84 decimal degrees, -180.0 to 180.0

### Special Types
- **Enum** - Predefined constant from a set (e.g., route_type: 0=tram, 1=subway)

---

## Implementation Plan

### Phase 1: Type System Foundation

#### ✅ **Task 1.1: Create GTFS Field Type Definitions**
**File:** `src/types/gtfs-field-types.ts` (NEW)

Create comprehensive type definitions:
- Enum for all GTFS field types
- Type metadata interface (validation rules, format patterns, constraints)
- Field type registry with validation patterns
- Helper functions for type checking

**Deliverables:**
```typescript
export enum GTFSFieldType {
  Text,
  URL,
  Email,
  PhoneNumber,
  LanguageCode,
  CurrencyCode,
  CurrencyAmount,
  Timezone,
  Color,
  Date,
  Time,
  ID,
  Integer,
  Float,
  Latitude,
  Longitude,
  Enum
}

export interface GTFSFieldTypeMetadata {
  type: GTFSFieldType;
  pattern?: RegExp;
  min?: number;
  max?: number;
  decimals?: number;
  zodValidator?: (z: typeof import('zod')) => ZodType;
  inputType?: 'text' | 'number' | 'email' | 'url' | 'tel' | 'color' | 'date' | 'time';
  step?: number;
}
```

---

#### ✅ **Task 1.2: Update Zod Schema Generation**
**File:** `scripts/generate-gtfs-types.ts`

Modify the type mapping to use hardcoded field type definitions:
- Map GTFS type strings to `GTFSFieldType` enum
- Generate Zod validators with proper constraints
- Add specific validation for each type

**Changes:**
- Replace dynamic type mapping with hardcoded type registry
- Add validation patterns for Color (6-digit hex), Date (YYYYMMDD), Time (HH:MM:SS)
- Add range validation for Latitude/Longitude
- Add format validation for Email, URL, Phone, Language codes

---

#### ✅ **Task 1.3: Update GTFS Type Definitions**
**File:** `src/types/gtfs.ts`

Add field type metadata to schema:
- Extend Zod schemas with type hints
- Add `.describe()` with type information
- Ensure all schemas have proper type metadata

**Changes:**
- Import `GTFSFieldType` and metadata
- Add type annotations to each field
- Include validation constraints from type definitions

---

### Phase 2: Validation Enhancement

#### ✅ **Task 2.1: Enhanced Validation in GTFSCaster**
**File:** `src/utils/gtfs-caster.ts`

Add type-specific validation:
- Color format validation (6-digit hex)
- Date format validation (YYYYMMDD)
- Time format validation (HH:MM:SS, supports >24 hours)
- Latitude/Longitude range checks
- Email/URL format validation
- Currency amount decimal validation

**Changes:**
- Add validators for each field type
- Provide helpful error messages
- Add type coercion where appropriate

---

#### ✅ **Task 2.2: Update GTFSValidator**
**File:** `src/modules/gtfs-validator.ts`

Enhance validation with type-aware checks:
- Use field type metadata for validation
- Add type-specific validation rules
- Improve error messages with type information

**Current Issues:**
- Line 812-814: Uses basic regex for time validation
- Line 817-834: Uses basic regex for date validation
- Line 166, 803: URL validation exists but not type-aware
- Line 361-393: Coordinate validation exists but could use type metadata

**Changes:**
- Import field type metadata
- Replace ad-hoc validation with type-aware validation
- Use centralized validation functions

---

### Phase 3: UI Component Enhancement

#### ✅ **Task 3.1: Type-Aware Form Fields**
**File:** `src/utils/field-component.ts`

Enhance form field generation based on field types:
- **Color**: Use `<input type="color">` with hex conversion
- **Date**: Use `<input type="date">` with YYYYMMDD conversion
- **Time**: Use `<input type="time">` with support for >24 hours
- **Email**: Use `<input type="email">`
- **URL**: Use `<input type="url">`
- **Phone**: Use `<input type="tel">`
- **Latitude/Longitude**: Use `<input type="number">` with step="0.000001"
- **Currency Amount**: Use `<input type="number">` with appropriate decimals
- **Enum**: Already uses `<select>`, ensure proper options

**Current State:**
- Line 366-404: Basic type detection (text, number, select, textarea)
- Line 386-390: Some special handling for lat/lon
- Line 391-397: Enum handling exists

**Changes:**
- Add field type detection from schema metadata
- Map field types to appropriate HTML input types
- Add HTML5 attributes (pattern, min, max, step)
- Add custom input components for special types (Color picker, Time with >24h support)

---

#### ✅ **Task 3.2: Field Formatters and Parsers**
**File:** `src/utils/field-formatters.ts` (NEW)

Create formatters and parsers for each field type:
- **Color**: Convert between `#RRGGBB` (display) and `RRGGBB` (GTFS)
- **Date**: Convert between `YYYY-MM-DD` (input) and `YYYYMMDD` (GTFS)
- **Time**: Convert between `HH:MM:SS` (input) and handle >24 hour times
- **Currency Amount**: Format with proper decimal places
- **Latitude/Longitude**: Format with 6 decimal places
- **Phone/Language/Currency codes**: Validation and formatting

**Deliverables:**
```typescript
export interface FieldFormatter {
  toDisplay(value: string): string;
  toGTFS(value: string): string;
  validate(value: string): boolean;
}

export const FIELD_FORMATTERS: Record<GTFSFieldType, FieldFormatter>;
```

---

### Phase 4: Data Import/Export

#### ✅ **Task 4.1: Type-Aware Parsing**
**File:** `src/modules/gtfs-parser.ts`

Add type-aware parsing during CSV import:
- Parse numeric types (Integer, Float, Latitude, Longitude)
- Validate string formats (Date, Time, Color)
- Trim and normalize text fields
- Validate enum values

**Current State:**
- Basic CSV parsing with Papa Parse
- Limited type coercion

**Changes:**
- Add field type metadata lookup
- Apply type-specific parsing
- Add warnings for invalid formats
- Provide data cleaning suggestions

---

#### ✅ **Task 4.2: Type-Aware Export**
**File:** `src/modules/export-manager.ts`

Ensure proper formatting during export:
- Format numeric values correctly (avoid scientific notation)
- Validate required formats before export
- Ensure proper decimal places for Currency Amount
- Validate Color/Date/Time formats

**Changes:**
- Add pre-export validation
- Format fields according to type metadata
- Add export warnings for validation issues

---

### Phase 5: Testing & Documentation

#### ✅ **Task 5.1: Add Field Type Tests**
**File:** `tests/gtfs-field-types.test.ts` (NEW)

Create comprehensive tests for field types:
- Validation tests for each type
- Formatter/parser tests
- Edge case handling (e.g., Time > 24:00:00)
- Invalid format detection

---

#### ✅ **Task 5.2: Update Integration Tests**
**Files:**
- `tests/export-data-integrity.test.ts`
- `tests/editing-consistency.test.ts`

Add type-specific test cases:
- Test Color field editing and export
- Test Date/Time formatting
- Test Currency Amount decimal handling
- Test Latitude/Longitude precision

---

#### ✅ **Task 5.3: Add Type Documentation**
**File:** `docs/GTFS_FIELD_TYPES.md` (NEW)

Document field type handling:
- List all supported field types
- Explain validation rules
- Provide examples for each type
- Document UI behavior for each type

---

## File Changes Summary

### New Files
- [ ] `src/types/gtfs-field-types.ts` - Field type definitions and metadata
- [ ] `src/utils/field-formatters.ts` - Formatters and parsers for each type
- [ ] `tests/gtfs-field-types.test.ts` - Field type unit tests
- [ ] `docs/GTFS_FIELD_TYPES.md` - Field type documentation

### Modified Files
- [ ] `scripts/generate-gtfs-types.ts` - Use hardcoded type definitions
- [ ] `src/types/gtfs.ts` - Add type metadata to schemas
- [ ] `src/utils/gtfs-caster.ts` - Type-specific validation
- [ ] `src/modules/gtfs-validator.ts` - Enhanced validation with type awareness
- [ ] `src/utils/field-component.ts` - Type-aware form field generation
- [ ] `src/modules/gtfs-parser.ts` - Type-aware CSV parsing
- [ ] `src/modules/export-manager.ts` - Type-aware export formatting
- [ ] `tests/export-data-integrity.test.ts` - Add type-specific tests
- [ ] `tests/editing-consistency.test.ts` - Add type-specific tests

---

## Implementation Checklist

### Phase 1: Type System Foundation
- [x] 1.1: Create `src/types/gtfs-field-types.ts` with type definitions ✅ COMPLETED
- [x] 1.2: Update `scripts/generate-gtfs-types.ts` with hardcoded type mapping ✅ COMPLETED
- [ ] 1.3: Update `src/types/gtfs.ts` with type metadata ⏭️ SKIPPED (not needed - types generated from spec)

### Phase 2: Validation Enhancement
- [x] 2.1: Enhance `src/utils/gtfs-caster.ts` with type-specific validation ✅ COMPLETED
- [x] 2.2: Update `src/modules/gtfs-validator.ts` with type-aware validation ✅ COMPLETED

### Phase 3: UI Component Enhancement
- [x] 3.1: Update `src/utils/field-component.ts` with type-aware form fields ✅ COMPLETED
- [x] 3.2: Create `src/utils/field-formatters.ts` with formatters/parsers ✅ COMPLETED

### Phase 4: Data Import/Export
- [x] 4.1: Update `src/modules/gtfs-parser.ts` with type-aware parsing ✅ COMPLETED
- [x] 4.2: Update `src/modules/export-manager.ts` with type-aware formatting ✅ COMPLETED

### Phase 5: Testing & Documentation
- [ ] 5.1: Create `tests/gtfs-field-types.test.ts` with comprehensive tests
- [ ] 5.2: Update integration tests with type-specific cases
- [ ] 5.3: Create `docs/GTFS_FIELD_TYPES.md` with documentation

---

## Priority Order

1. **Critical** (Phase 1 & 2): Type definitions, validation, Zod schema generation
2. **High** (Phase 3): UI components for better user experience
3. **Medium** (Phase 4): Import/Export improvements for data integrity
4. **Low** (Phase 5): Testing and documentation

---

## Notes

- **Currency Amount** must use decimal arithmetic, NOT float (to avoid precision loss)
- **Time** fields can exceed 24:00:00 for trips that span midnight
- **Color** fields are stored WITHOUT the `#` prefix in GTFS
- **Date** format is `YYYYMMDD` (not `YYYY-MM-DD`)
- **ID** fields should prefer printable ASCII but can contain any UTF-8
- **Latitude** range: -90.0 to 90.0
- **Longitude** range: -180.0 to 180.0

---

## Success Criteria

- ✅ All GTFS field types have dedicated validation
- ✅ UI components use appropriate HTML5 input types
- ✅ Data import correctly parses and validates all field types
- ✅ Data export formats all fields according to GTFS spec
- ✅ Comprehensive test coverage for all field types
- ✅ Clear error messages for validation failures
- ✅ Documentation covers all field types and their handling
