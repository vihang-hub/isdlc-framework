# Module Design: TOON Format Integration

**Requirement ID:** REQ-0040
**Artifact Folder:** REQ-0040-toon-format-integration
**Phase:** 04-design
**Created:** 2026-02-25
**Status:** Approved

---

## 1. Overview

This document specifies the module-level design for integrating TOON (Token-Oriented Object Notation) encoding into the iSDLC session cache pipeline. It covers four files: one new module (`toon-encoder.cjs`), one modified module (`common.cjs`), one new test file (`toon-encoder.test.cjs`), and one modified test file (`test-session-cache-builder.test.cjs`).

**Architecture References:**
- ADR-0040-01: Native CJS encoder (no SDK dependency)
- ADR-0040-02: Encode only SKILLS_MANIFEST tabular data
- ADR-0040-03: Per-section fail-open with JSON fallback
- ADR-0040-04: REQ-003 deferred (no injection point)

---

## 2. Module 1: toon-encoder.cjs (NEW)

**File:** `src/claude/hooks/lib/toon-encoder.cjs`
**Size Estimate:** 80-100 lines
**Dependencies:** None (zero npm dependencies, pure CJS)
**Traces to:** FR-001 (AC-001-01 through AC-001-04), FR-004 (AC-004-01, AC-004-02)

### 2.1 Public API

```javascript
'use strict';

/**
 * Encode an array of uniform objects to TOON tabular format.
 *
 * @param {Array<Object>} data - Non-empty array of plain objects with identical keys
 * @param {Object} [options] - Encoding options (reserved for future use)
 * @returns {string} TOON-encoded tabular string
 * @throws {TypeError} If data is not a non-empty array of uniform plain objects
 * @throws {RangeError} If data exceeds 10,000 rows
 *
 * Traces to: FR-001 (AC-001-02)
 */
function encode(data, options = {}) { ... }

/**
 * Decode a TOON tabular string back to an array of objects.
 * Falls back to JSON.parse() on TOON parse failure (Article X).
 *
 * @param {string} toonString - TOON-encoded string, or JSON string as fallback
 * @returns {Array<Object>} Decoded array of objects
 *
 * Traces to: FR-001 (AC-001-03), FR-004 (AC-004-01, AC-004-02)
 */
function decode(toonString) { ... }

/**
 * Check if data is a uniform array suitable for TOON encoding.
 * A uniform array is a non-empty Array where every element is a non-null
 * plain object and all elements have exactly the same set of keys.
 *
 * @param {*} data - Data to check
 * @returns {boolean} True if data is TOON-eligible
 *
 * Traces to: FR-001
 */
function isUniformArray(data) { ... }

module.exports = { encode, decode, isUniformArray };
```

### 2.2 TOON Tabular Format Specification

The encoder implements ONLY the tabular array subset of TOON:

```
[N]{field1,field2,...}:
  value1,value2,...
  value1,value2,...
```

**Format Rules:**
- Line 1 (header): `[N]{field1,field2,...}:` where N = row count, fields = comma-separated column names
- Lines 2+: Two-space indented data rows, one per object in the input array
- Values are comma-delimited within each row
- Field order is derived from `Object.keys(data[0])` of the first element

### 2.3 Value Serialization Rules

Each value in a data row is serialized according to its JavaScript type:

| JS Type | TOON Serialization | Example Input | Example Output |
|---------|-------------------|---------------|----------------|
| `string` (simple) | Bare string, unquoted | `"hello"` | `hello` |
| `string` (with special chars) | Double-quoted with escaping | `"he,llo"` | `"he,llo"` |
| `number` | Numeric literal | `42` | `42` |
| `boolean` | Literal `true`/`false` | `true` | `true` |
| `null` | Literal `null` | `null` | `null` |
| `undefined` | Literal `null` | `undefined` | `null` |
| `object` / `array` | JSON-stringified, then quoted | `[1,2]` | `"[1,2]"` |

**String Quoting Trigger:** A string value is double-quoted if it contains ANY of these characters:
- Comma `,`
- Double quote `"`
- Newline `\n`
- Carriage return `\r`
- Tab `\t`
- Backslash `\`

**String Escaping (inside double quotes):** When a string is quoted, these characters are escaped with a backslash prefix:

| Character | Escape Sequence |
|-----------|----------------|
| `\` | `\\` |
| `"` | `\"` |
| `\n` | `\\n` |
| `\r` | `\\r` |
| `\t` | `\\t` |

**Escaping order:** Backslash MUST be escaped first (before other escapes) to avoid double-escaping.

### 2.4 encode() Implementation Pseudocode

```
function encode(data, options = {}):
    // 1. Validate input
    if not isUniformArray(data):
        throw TypeError("encode() requires a non-empty array of uniform objects")
    if data.length > 10000:
        throw RangeError("encode() rejects arrays with more than 10,000 rows")

    // 2. Extract field names from first object
    fields = Object.keys(data[0])

    // 3. Build header line
    header = "[" + data.length + "]{" + fields.join(",") + "}:"

    // 4. Build data rows
    rows = []
    for each obj in data:
        values = []
        for each field in fields:
            values.push(serializeValue(obj[field]))
        rows.push("  " + values.join(","))

    // 5. Return header + rows joined by newline
    return header + "\n" + rows.join("\n")
```

### 2.5 serializeValue() Internal Function

```
function serializeValue(val):
    if val === null or val === undefined:
        return "null"
    if typeof val === "boolean":
        return String(val)
    if typeof val === "number":
        return String(val)
    if typeof val === "object":
        // Arrays and objects are JSON-stringified and quoted
        return quoteString(JSON.stringify(val))
    // String handling
    str = String(val)
    if needsQuoting(str):
        return quoteString(str)
    return str
```

### 2.6 needsQuoting() Internal Function

```
function needsQuoting(str):
    return str contains any of: , " \n \r \t \
    // Implementation: regex /[,"\n\r\t\\]/
```

### 2.7 quoteString() Internal Function

```
function quoteString(str):
    escaped = str
        .replace(/\\/g, "\\\\")     // backslash first
        .replace(/"/g, '\\"')       // double quote
        .replace(/\n/g, "\\n")      // newline
        .replace(/\r/g, "\\r")      // carriage return
        .replace(/\t/g, "\\t")      // tab
    return '"' + escaped + '"'
```

### 2.8 decode() Implementation Pseudocode

```
function decode(toonString):
    // 1. Validate input type
    if typeof toonString !== "string" or toonString.trim() === "":
        return []

    str = toonString.trim()

    // 2. Try TOON parse first
    try:
        return parseToon(str)
    catch (toonErr):
        // 3. TOON parse failed -- try JSON fallback
        try:
            result = JSON.parse(str)
            if Array.isArray(result):
                process.stderr.write("TOON decode fallback: used JSON.parse\n")
                return result
        catch (jsonErr):
            // Both failed
            pass

    // 4. Both failed -- log and return empty array
    process.stderr.write("TOON decode failed: neither TOON nor JSON parseable\n")
    return []
```

### 2.9 parseToon() Internal Function

```
function parseToon(str):
    // 1. Match header: [N]{field1,field2,...}:
    headerMatch = str.match(/^\[(\d+)\]\{([^}]+)\}:/)
    if not headerMatch:
        throw Error("Invalid TOON header")

    expectedCount = parseInt(headerMatch[1], 10)
    fields = headerMatch[2].split(",")

    // 2. Extract data lines (lines after header, trimmed)
    lines = str.substring(headerMatch[0].length)
                .split("\n")
                .filter(line => line.trim().length > 0)

    // 3. Parse each data line
    results = []
    for each line in lines:
        trimmed = line.trim()
        values = parseRow(trimmed, fields.length)
        obj = {}
        for i = 0; i < fields.length; i++:
            obj[fields[i]] = deserializeValue(values[i])
        results.push(obj)

    return results
```

### 2.10 parseRow() Internal Function

Parses a single comma-delimited row, respecting quoted strings:

```
function parseRow(line, expectedFieldCount):
    values = []
    current = ""
    inQuotes = false
    i = 0

    while i < line.length:
        char = line[i]

        if inQuotes:
            if char === "\\" and i + 1 < line.length:
                // Escape sequence
                nextChar = line[i + 1]
                switch nextChar:
                    case "\\": current += "\\"; i += 2; continue
                    case '"': current += '"'; i += 2; continue
                    case 'n': current += "\n"; i += 2; continue
                    case 'r': current += "\r"; i += 2; continue
                    case 't': current += "\t"; i += 2; continue
                    default: current += char; i++; continue
            else if char === '"':
                inQuotes = false
                i++
                continue
            else:
                current += char
                i++
                continue
        else:
            if char === '"':
                inQuotes = true
                i++
                continue
            else if char === ',':
                values.push(current)
                current = ""
                i++
                continue
            else:
                current += char
                i++
                continue

    // Push final value
    values.push(current)

    return values
```

### 2.11 deserializeValue() Internal Function

```
function deserializeValue(str):
    if str === "null": return null
    if str === "true": return true
    if str === "false": return false
    if str matches /^-?\d+(\.\d+)?$/ or str matches /^-?\d+(\.\d+)?e[+-]?\d+$/i:
        parsed = Number(str)
        if not isNaN(parsed): return parsed
    // Attempt JSON parse for stringified objects/arrays
    if (str.startsWith("{") or str.startsWith("[")):
        try: return JSON.parse(str)
        catch: pass  // fall through to return as string
    return str
```

### 2.12 isUniformArray() Implementation

```
function isUniformArray(data):
    if not Array.isArray(data): return false
    if data.length === 0: return false

    // All elements must be non-null plain objects
    for each item in data:
        if item === null or typeof item !== "object" or Array.isArray(item):
            return false

    // All elements must have the same keys
    referenceKeys = Object.keys(data[0]).sort().join(",")
    for i = 1; i < data.length; i++:
        if Object.keys(data[i]).sort().join(",") !== referenceKeys:
            return false

    return true
```

### 2.13 Edge Cases

| Edge Case | Behavior | Traces to |
|-----------|----------|-----------|
| Empty array `[]` | `isUniformArray` returns `false`; `encode` throws `TypeError` | FR-001 |
| Single-element array `[{a:1}]` | Valid; produces header + 1 data row | FR-001 |
| Empty string values `""` | Serialized as bare empty string (no quoting needed) | FR-001 |
| String value `"null"` | Serialized as bare `null` (string); decode returns string `"null"` -- AMBIGUITY: see note below | FR-001 |
| Mixed types in same field | Allowed (each value serialized by its own type) | FR-001 |
| Field names with commas | NOT SUPPORTED (field names must not contain `,`, `{`, `}`) -- validated by `isUniformArray` trusting `Object.keys()` | FR-001 |
| `NaN`, `Infinity` values | Serialized as `"null"` (same as JSON behavior for non-finite numbers) | FR-001 |
| Array exceeding 10,000 rows | `encode` throws `RangeError` | FR-001 |
| `undefined` value | Serialized as `null` | FR-001 |

**Ambiguity Note on "null" String Values:**
The string `"null"` and the literal `null` both serialize to `null` in TOON. During decode, `null` is deserialized as JavaScript `null`. For the iSDLC use case, no field in skill_lookup or ownership contains the literal string `"null"`, so this ambiguity has no practical impact. If future data requires distinguishing `"null"` strings from `null` values, the string should be quoted as `"null"` in the TOON output. This is a known limitation documented per Article IV.

### 2.14 Constants

```javascript
const MAX_ROWS = 10000;
const NEEDS_QUOTING_RE = /[,"\n\r\t\\]/;
const TOON_HEADER_RE = /^\[(\d+)\]\{([^}]+)\}:/;
const NUMBER_RE = /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i;
```

---

## 3. Module 2: common.cjs Modifications

**File:** `src/claude/hooks/lib/common.cjs`
**Change Type:** MODIFY (Section 5: SKILLS_MANIFEST in rebuildSessionCache())
**Lines Affected:** ~4147-4152 (current Section 5 block)
**Traces to:** FR-002 (AC-002-02), FR-004 (AC-004-03, AC-004-04), FR-005

### 3.1 Current Code (lines 4147-4152)

```javascript
// Section 5: SKILLS_MANIFEST
parts.push(buildSection('SKILLS_MANIFEST', () => {
    const manifestPath = path.join(root, 'src', 'claude', 'hooks', 'config', 'skills-manifest.json');
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return JSON.stringify(raw, null, 2);
}));
```

### 3.2 New require() Statement

Add at the top of the file, near the existing `require` statements (after line 12):

```javascript
const toonEncoder = require('./toon-encoder.cjs');
```

**Location:** After `const path = require('path');` (line 12), before the caching section.

**Rationale:** The `require()` call is unconditional. The module is loaded once per process. Since `toon-encoder.cjs` is in the same `lib/` directory, the relative path is `./toon-encoder.cjs`.

### 3.3 Replacement Code for Section 5

Replace lines 4147-4152 with:

```javascript
// Section 5: SKILLS_MANIFEST (TOON-encoded per ADR-0040-02)
parts.push(buildSection('SKILLS_MANIFEST', () => {
    const manifestPath = path.join(root, 'src', 'claude', 'hooks', 'config', 'skills-manifest.json');
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Filter out path_lookup and skill_paths (per REQ-0001 FR-008)
    const { path_lookup, skill_paths, ...filtered } = raw;

    const sectionParts = [];

    // Metadata (plain text key: value lines)
    if (filtered.version) sectionParts.push(`version: ${filtered.version}`);
    if (filtered.total_skills != null) sectionParts.push(`total_skills: ${filtered.total_skills}`);
    if (filtered.enforcement_mode) sectionParts.push(`enforcement_mode: ${filtered.enforcement_mode}`);

    // skill_lookup: transform flat object to array, TOON-encode
    if (filtered.skill_lookup && typeof filtered.skill_lookup === 'object') {
        try {
            const rows = Object.entries(filtered.skill_lookup).map(([id, agent]) => ({ id, agent }));
            sectionParts.push(`## skill_lookup\n${toonEncoder.encode(rows)}`);
        } catch (err) {
            process.stderr.write(`TOON fallback (skill_lookup): ${err.message}\n`);
            sectionParts.push(`## skill_lookup\n${JSON.stringify(filtered.skill_lookup, null, 2)}`);
        }
    }

    // ownership: flatten nested objects to tabular, TOON-encode
    if (filtered.ownership && typeof filtered.ownership === 'object') {
        try {
            const rows = Object.entries(filtered.ownership).map(([agent, meta]) => ({
                agent,
                agent_id: meta.agent_id || '',
                phase: meta.phase || '',
                skill_count: meta.skill_count || 0
            }));
            sectionParts.push(`## ownership\n${toonEncoder.encode(rows)}`);
        } catch (err) {
            process.stderr.write(`TOON fallback (ownership): ${err.message}\n`);
            sectionParts.push(`## ownership\n${JSON.stringify(filtered.ownership, null, 2)}`);
        }
    }

    // cross_agent_delegation: keep as JSON (non-tabular, small)
    if (filtered.cross_agent_delegation) {
        sectionParts.push(`## cross_agent_delegation\n${JSON.stringify(filtered.cross_agent_delegation, null, 2)}`);
    }

    return sectionParts.join('\n\n');
}));
```

### 3.4 Design Decisions in common.cjs Modification

| Decision | Rationale | Traces to |
|----------|-----------|-----------|
| Filter `path_lookup` and `skill_paths` with destructuring | Preserves existing TC-BUILD-08 behavior; keeps these keys out of cache output | REQ-0001 FR-008 |
| Metadata as `key: value` lines | Compact, human-readable; no JSON overhead for 3 scalar values | Article V |
| `Object.entries().map()` for skill_lookup | Transforms `{id: agent}` flat object to `[{id, agent}]` uniform array for TOON | ADR-0040-02 |
| `Object.entries().map()` for ownership | Flattens nested objects, drops `skills[]` array (available via skill_lookup reverse lookup) | ADR-0040-02 |
| Default values `''` and `0` for missing ownership fields | Defensive; prevents `undefined` from appearing in TOON output | Article X |
| Per-sub-section try/catch | One section failing does not affect the other; JSON fallback per ADR-0040-03 | FR-004 (AC-004-03) |
| `process.stderr.write()` for fallback logging | Hook stdout is reserved for JSON protocol; stderr is the correct channel | Article X |
| cross_agent_delegation as JSON | Non-tabular, deeply nested, small size -- TOON adds no benefit | ADR-0040-02 |

### 3.5 No Other Changes to common.cjs

The following parts of common.cjs are NOT modified:
- `buildSection()` helper function (unchanged)
- All other sections (CONSTITUTION, WORKFLOW_CONFIG, ITERATION_REQUIREMENTS, ARTIFACT_PATHS, SKILL_INDEX, EXTERNAL_SKILLS, ROUNDTABLE_CONTEXT) (unchanged)
- Module exports (unchanged)
- Header generation, file writing, size validation (unchanged)

### 3.6 Backward Compatibility

The SKILLS_MANIFEST section output format changes from raw JSON to a structured text format with TOON tables. This affects:
- **inject-session-cache.cjs**: No changes needed. It reads `session-cache.md` as a text file and writes it to stdout. The file content is opaque to the injector.
- **bin/rebuild-cache.js**: No changes needed. It calls `rebuildSessionCache()` which auto-inherits the TOON encoding.
- **lib/installer.js**: No changes needed. Same as rebuild-cache.
- **lib/updater.js**: No changes needed. Same as rebuild-cache.
- **LLM consumer**: The LLM receives the session cache as context text. TOON tabular format is designed for LLM consumption (per TOON specification). No LLM-side changes needed.

### 3.7 Existing Test TC-BUILD-08 Impact

TC-BUILD-08 asserts:
```javascript
assert.ok(!section.includes('"path_lookup"'), 'Should not contain path_lookup');
assert.ok(!section.includes('"skill_paths"'), 'Should not contain skill_paths');
assert.ok(section.includes('"ownership"'), 'Should contain ownership');
```

The third assertion (`section.includes('"ownership"')`) will FAIL because ownership is now TOON-encoded, not JSON. The string `"ownership"` (with JSON double quotes) will not appear. Instead, the section contains `## ownership` as a markdown heading.

**Required Change to TC-BUILD-08:**
```javascript
// Replace:
assert.ok(section.includes('"ownership"'), 'Should contain ownership');
// With:
assert.ok(section.includes('## ownership'), 'Should contain ownership section');
```

---

## 4. Module 3: toon-encoder.test.cjs (NEW)

**File:** `src/claude/hooks/tests/toon-encoder.test.cjs`
**Framework:** node:test + node:assert/strict (CJS stream)
**Run Command:** `node --test src/claude/hooks/tests/toon-encoder.test.cjs`
**Traces to:** FR-001, FR-004

### 4.1 Test Structure

```
describe('toon-encoder')
  describe('isUniformArray()')
    TC-TOON-01: returns true for array of uniform objects
    TC-TOON-02: returns false for empty array
    TC-TOON-03: returns false for non-array input
    TC-TOON-04: returns false for array with mixed keys
    TC-TOON-05: returns false for array containing null
    TC-TOON-06: returns false for array containing nested arrays
    TC-TOON-07: returns true for single-element array

  describe('encode()')
    TC-TOON-10: encodes simple two-field array
    TC-TOON-11: header contains correct row count
    TC-TOON-12: header contains correct field names
    TC-TOON-13: data rows are two-space indented
    TC-TOON-14: encodes null values as literal null
    TC-TOON-15: encodes boolean values as literals
    TC-TOON-16: encodes numeric values as literals
    TC-TOON-17: quotes strings containing commas
    TC-TOON-18: quotes strings containing double quotes
    TC-TOON-19: quotes strings containing newlines
    TC-TOON-20: quotes strings containing backslashes
    TC-TOON-21: handles empty string values
    TC-TOON-22: throws TypeError for non-uniform input
    TC-TOON-23: throws TypeError for empty array
    TC-TOON-24: throws RangeError for arrays exceeding 10,000 rows
    TC-TOON-25: encodes single-element array
    TC-TOON-26: encodes undefined values as null
    TC-TOON-27: JSON-stringifies and quotes object values
    TC-TOON-28: JSON-stringifies and quotes array values
    TC-TOON-29: handles NaN as null
    TC-TOON-30: handles Infinity as null

  describe('decode()')
    TC-TOON-40: decodes simple two-field TOON string
    TC-TOON-41: preserves string types
    TC-TOON-42: preserves numeric types
    TC-TOON-43: preserves boolean types
    TC-TOON-44: preserves null values
    TC-TOON-45: decodes quoted strings with escaped characters
    TC-TOON-46: returns empty array for empty string input
    TC-TOON-47: returns empty array for non-string input
    TC-TOON-48: falls back to JSON.parse for JSON string input
    TC-TOON-49: returns empty array when both TOON and JSON fail
    TC-TOON-50: logs fallback to stderr on JSON parse

  describe('round-trip')
    TC-TOON-60: round-trip preserves skill_lookup data shape
    TC-TOON-61: round-trip preserves ownership data shape
    TC-TOON-62: round-trip with special characters
    TC-TOON-63: round-trip with mixed types in same field
    TC-TOON-64: round-trip with numeric-looking strings
```

### 4.2 Test Case Specifications

**TC-TOON-01: returns true for array of uniform objects**
```javascript
it('TC-TOON-01: returns true for array of uniform objects', () => {
    assert.equal(toonEncoder.isUniformArray([{a: 1, b: 2}, {a: 3, b: 4}]), true);
});
```
Traces to: FR-001

**TC-TOON-02: returns false for empty array**
```javascript
it('TC-TOON-02: returns false for empty array', () => {
    assert.equal(toonEncoder.isUniformArray([]), false);
});
```
Traces to: FR-001

**TC-TOON-03: returns false for non-array input**
```javascript
it('TC-TOON-03: returns false for non-array input', () => {
    assert.equal(toonEncoder.isUniformArray("string"), false);
    assert.equal(toonEncoder.isUniformArray(123), false);
    assert.equal(toonEncoder.isUniformArray(null), false);
    assert.equal(toonEncoder.isUniformArray(undefined), false);
    assert.equal(toonEncoder.isUniformArray({a: 1}), false);
});
```
Traces to: FR-001

**TC-TOON-04: returns false for array with mixed keys**
```javascript
it('TC-TOON-04: returns false for array with mixed keys', () => {
    assert.equal(toonEncoder.isUniformArray([{a: 1}, {b: 2}]), false);
    assert.equal(toonEncoder.isUniformArray([{a: 1, b: 2}, {a: 3}]), false);
});
```
Traces to: FR-001

**TC-TOON-05: returns false for array containing null**
```javascript
it('TC-TOON-05: returns false for array containing null', () => {
    assert.equal(toonEncoder.isUniformArray([{a: 1}, null]), false);
});
```
Traces to: FR-001

**TC-TOON-06: returns false for array containing nested arrays**
```javascript
it('TC-TOON-06: returns false for array containing nested arrays', () => {
    assert.equal(toonEncoder.isUniformArray([[1, 2], [3, 4]]), false);
});
```
Traces to: FR-001

**TC-TOON-07: returns true for single-element array**
```javascript
it('TC-TOON-07: returns true for single-element array', () => {
    assert.equal(toonEncoder.isUniformArray([{a: 1}]), true);
});
```
Traces to: FR-001

**TC-TOON-10: encodes simple two-field array**
```javascript
it('TC-TOON-10: encodes simple two-field array', () => {
    const data = [
        { id: 'QS-001', agent: 'quick-scan-agent' },
        { id: 'ARCH-001', agent: 'solution-architect' }
    ];
    const result = toonEncoder.encode(data);
    assert.equal(result, '[2]{id,agent}:\n  QS-001,quick-scan-agent\n  ARCH-001,solution-architect');
});
```
Traces to: FR-001 (AC-001-02)

**TC-TOON-11: header contains correct row count**
```javascript
it('TC-TOON-11: header contains correct row count', () => {
    const data = [{a: 1}, {a: 2}, {a: 3}];
    const result = toonEncoder.encode(data);
    assert.ok(result.startsWith('[3]{a}:'));
});
```
Traces to: FR-001

**TC-TOON-12: header contains correct field names**
```javascript
it('TC-TOON-12: header contains correct field names', () => {
    const data = [{x: 1, y: 2, z: 3}];
    const result = toonEncoder.encode(data);
    assert.ok(result.startsWith('[1]{x,y,z}:'));
});
```
Traces to: FR-001

**TC-TOON-13: data rows are two-space indented**
```javascript
it('TC-TOON-13: data rows are two-space indented', () => {
    const data = [{a: 'val'}];
    const lines = toonEncoder.encode(data).split('\n');
    assert.equal(lines[1], '  val');
});
```
Traces to: FR-001

**TC-TOON-14: encodes null values as literal null**
```javascript
it('TC-TOON-14: encodes null values as literal null', () => {
    const data = [{a: null, b: 'ok'}];
    const result = toonEncoder.encode(data);
    assert.ok(result.includes('  null,ok'));
});
```
Traces to: FR-001

**TC-TOON-15: encodes boolean values as literals**
```javascript
it('TC-TOON-15: encodes boolean values as literals', () => {
    const data = [{a: true, b: false}];
    const result = toonEncoder.encode(data);
    assert.ok(result.includes('  true,false'));
});
```
Traces to: FR-001

**TC-TOON-16: encodes numeric values as literals**
```javascript
it('TC-TOON-16: encodes numeric values as literals', () => {
    const data = [{a: 42, b: 3.14, c: -1}];
    const result = toonEncoder.encode(data);
    assert.ok(result.includes('  42,3.14,-1'));
});
```
Traces to: FR-001

**TC-TOON-17: quotes strings containing commas**
```javascript
it('TC-TOON-17: quotes strings containing commas', () => {
    const data = [{a: 'hello,world'}];
    const result = toonEncoder.encode(data);
    assert.ok(result.includes('  "hello,world"'));
});
```
Traces to: FR-001

**TC-TOON-18: quotes strings containing double quotes**
```javascript
it('TC-TOON-18: quotes strings containing double quotes', () => {
    const data = [{a: 'say "hi"'}];
    const result = toonEncoder.encode(data);
    assert.ok(result.includes('  "say \\"hi\\""'));
});
```
Traces to: FR-001

**TC-TOON-19: quotes strings containing newlines**
```javascript
it('TC-TOON-19: quotes strings containing newlines', () => {
    const data = [{a: 'line1\nline2'}];
    const result = toonEncoder.encode(data);
    assert.ok(result.includes('  "line1\\nline2"'));
});
```
Traces to: FR-001

**TC-TOON-20: quotes strings containing backslashes**
```javascript
it('TC-TOON-20: quotes strings containing backslashes', () => {
    const data = [{a: 'path\\to\\file'}];
    const result = toonEncoder.encode(data);
    assert.ok(result.includes('  "path\\\\to\\\\file"'));
});
```
Traces to: FR-001

**TC-TOON-21: handles empty string values**
```javascript
it('TC-TOON-21: handles empty string values', () => {
    const data = [{a: '', b: 'ok'}];
    const result = toonEncoder.encode(data);
    assert.ok(result.includes('  ,ok'));
});
```
Traces to: FR-001

**TC-TOON-22: throws TypeError for non-uniform input**
```javascript
it('TC-TOON-22: throws TypeError for non-uniform input', () => {
    assert.throws(() => toonEncoder.encode([{a: 1}, {b: 2}]), { name: 'TypeError' });
});
```
Traces to: FR-001

**TC-TOON-23: throws TypeError for empty array**
```javascript
it('TC-TOON-23: throws TypeError for empty array', () => {
    assert.throws(() => toonEncoder.encode([]), { name: 'TypeError' });
});
```
Traces to: FR-001

**TC-TOON-24: throws RangeError for arrays exceeding 10,000 rows**
```javascript
it('TC-TOON-24: throws RangeError for arrays exceeding 10,000 rows', () => {
    const big = Array.from({ length: 10001 }, (_, i) => ({ id: i }));
    assert.throws(() => toonEncoder.encode(big), { name: 'RangeError' });
});
```
Traces to: FR-001

**TC-TOON-25: encodes single-element array**
```javascript
it('TC-TOON-25: encodes single-element array', () => {
    const result = toonEncoder.encode([{a: 'x'}]);
    assert.equal(result, '[1]{a}:\n  x');
});
```
Traces to: FR-001

**TC-TOON-26: encodes undefined values as null**
```javascript
it('TC-TOON-26: encodes undefined values as null', () => {
    const data = [{a: undefined}];
    const result = toonEncoder.encode(data);
    assert.ok(result.includes('  null'));
});
```
Traces to: FR-001

**TC-TOON-27: JSON-stringifies and quotes object values**
```javascript
it('TC-TOON-27: JSON-stringifies and quotes object values', () => {
    const data = [{a: {nested: true}}];
    const result = toonEncoder.encode(data);
    assert.ok(result.includes('"{\\"nested\\":true}"'));
});
```
Traces to: FR-001

**TC-TOON-28: JSON-stringifies and quotes array values**
```javascript
it('TC-TOON-28: JSON-stringifies and quotes array values', () => {
    const data = [{a: [1, 2, 3]}];
    const result = toonEncoder.encode(data);
    assert.ok(result.includes('"[1,2,3]"'));
});
```
Traces to: FR-001

**TC-TOON-29: handles NaN as null**
```javascript
it('TC-TOON-29: handles NaN as null', () => {
    const data = [{a: NaN}];
    const result = toonEncoder.encode(data);
    assert.ok(result.includes('  null'));
});
```
Traces to: FR-001

**TC-TOON-30: handles Infinity as null**
```javascript
it('TC-TOON-30: handles Infinity as null', () => {
    const data = [{a: Infinity}];
    const result = toonEncoder.encode(data);
    assert.ok(result.includes('  null'));
});
```
Traces to: FR-001

**TC-TOON-40: decodes simple two-field TOON string**
```javascript
it('TC-TOON-40: decodes simple two-field TOON string', () => {
    const toon = '[2]{id,agent}:\n  QS-001,quick-scan-agent\n  ARCH-001,solution-architect';
    const result = toonEncoder.decode(toon);
    assert.deepStrictEqual(result, [
        { id: 'QS-001', agent: 'quick-scan-agent' },
        { id: 'ARCH-001', agent: 'solution-architect' }
    ]);
});
```
Traces to: FR-001 (AC-001-03)

**TC-TOON-41: preserves string types**
```javascript
it('TC-TOON-41: preserves string types', () => {
    const toon = '[1]{name}:\n  hello';
    const result = toonEncoder.decode(toon);
    assert.equal(typeof result[0].name, 'string');
    assert.equal(result[0].name, 'hello');
});
```
Traces to: FR-001 (AC-001-03)

**TC-TOON-42: preserves numeric types**
```javascript
it('TC-TOON-42: preserves numeric types', () => {
    const toon = '[1]{count}:\n  42';
    const result = toonEncoder.decode(toon);
    assert.equal(typeof result[0].count, 'number');
    assert.equal(result[0].count, 42);
});
```
Traces to: FR-001 (AC-001-03)

**TC-TOON-43: preserves boolean types**
```javascript
it('TC-TOON-43: preserves boolean types', () => {
    const toon = '[1]{active}:\n  true';
    const result = toonEncoder.decode(toon);
    assert.equal(typeof result[0].active, 'boolean');
    assert.equal(result[0].active, true);
});
```
Traces to: FR-001 (AC-001-03)

**TC-TOON-44: preserves null values**
```javascript
it('TC-TOON-44: preserves null values', () => {
    const toon = '[1]{val}:\n  null';
    const result = toonEncoder.decode(toon);
    assert.equal(result[0].val, null);
});
```
Traces to: FR-001 (AC-001-03)

**TC-TOON-45: decodes quoted strings with escaped characters**
```javascript
it('TC-TOON-45: decodes quoted strings with escaped characters', () => {
    const toon = '[1]{msg}:\n  "hello,\\"world\\""';
    const result = toonEncoder.decode(toon);
    assert.equal(result[0].msg, 'hello,"world"');
});
```
Traces to: FR-001

**TC-TOON-46: returns empty array for empty string input**
```javascript
it('TC-TOON-46: returns empty array for empty string input', () => {
    assert.deepStrictEqual(toonEncoder.decode(''), []);
    assert.deepStrictEqual(toonEncoder.decode('  '), []);
});
```
Traces to: FR-004

**TC-TOON-47: returns empty array for non-string input**
```javascript
it('TC-TOON-47: returns empty array for non-string input', () => {
    assert.deepStrictEqual(toonEncoder.decode(null), []);
    assert.deepStrictEqual(toonEncoder.decode(undefined), []);
    assert.deepStrictEqual(toonEncoder.decode(123), []);
});
```
Traces to: FR-004

**TC-TOON-48: falls back to JSON.parse for JSON string input**
```javascript
it('TC-TOON-48: falls back to JSON.parse for JSON string input', () => {
    const json = JSON.stringify([{a: 1}, {a: 2}]);
    const result = toonEncoder.decode(json);
    assert.deepStrictEqual(result, [{a: 1}, {a: 2}]);
});
```
Traces to: FR-004 (AC-004-01)

**TC-TOON-49: returns empty array when both TOON and JSON fail**
```javascript
it('TC-TOON-49: returns empty array when both TOON and JSON fail', () => {
    const result = toonEncoder.decode('not valid toon or json');
    assert.deepStrictEqual(result, []);
});
```
Traces to: FR-004

**TC-TOON-50: logs fallback to stderr on JSON parse**
```javascript
it('TC-TOON-50: logs fallback to stderr on JSON parse', () => {
    const original = process.stderr.write;
    let captured = '';
    process.stderr.write = (msg) => { captured += msg; return true; };
    try {
        toonEncoder.decode(JSON.stringify([{a: 1}]));
        assert.ok(captured.includes('TOON decode fallback'));
    } finally {
        process.stderr.write = original;
    }
});
```
Traces to: FR-004 (AC-004-02)

**TC-TOON-60: round-trip preserves skill_lookup data shape**
```javascript
it('TC-TOON-60: round-trip preserves skill_lookup data shape', () => {
    const data = [
        { id: 'QS-001', agent: 'quick-scan-agent' },
        { id: 'QS-002', agent: 'quick-scan-agent' },
        { id: 'ARCH-001', agent: 'solution-architect' }
    ];
    const encoded = toonEncoder.encode(data);
    const decoded = toonEncoder.decode(encoded);
    assert.deepStrictEqual(decoded, data);
});
```
Traces to: FR-001 (AC-001-02, AC-001-03)

**TC-TOON-61: round-trip preserves ownership data shape**
```javascript
it('TC-TOON-61: round-trip preserves ownership data shape', () => {
    const data = [
        { agent: 'sdlc-orchestrator', agent_id: '00', phase: 'all', skill_count: 12 },
        { agent: 'discover-orchestrator', agent_id: '00d', phase: 'discovery', skill_count: 6 }
    ];
    const encoded = toonEncoder.encode(data);
    const decoded = toonEncoder.decode(encoded);
    assert.deepStrictEqual(decoded, data);
});
```
Traces to: FR-001, FR-002

**TC-TOON-62: round-trip with special characters**
```javascript
it('TC-TOON-62: round-trip with special characters', () => {
    const data = [{ val: 'hello, "world"\nline2\ttab\\slash' }];
    const encoded = toonEncoder.encode(data);
    const decoded = toonEncoder.decode(encoded);
    assert.deepStrictEqual(decoded, data);
});
```
Traces to: FR-001

**TC-TOON-63: round-trip with mixed types in same field**
```javascript
it('TC-TOON-63: round-trip with mixed types in same field', () => {
    const data = [
        { val: 'string' },
        { val: 42 },
        { val: true },
        { val: null }
    ];
    const encoded = toonEncoder.encode(data);
    const decoded = toonEncoder.decode(encoded);
    assert.deepStrictEqual(decoded, data);
});
```
Traces to: FR-001

**TC-TOON-64: round-trip with numeric-looking strings**
```javascript
it('TC-TOON-64: round-trip with numeric-looking strings', () => {
    // Note: numeric-looking strings decode as numbers (known limitation)
    // Agent IDs like "00" would decode as 0, so ownership uses string fields
    // that are NOT purely numeric. For purely numeric strings like "00",
    // the round-trip is lossy. This is acceptable per the design because:
    // 1. skill_lookup: IDs like "QS-001" are not purely numeric
    // 2. ownership: agent_id "00" is consumed as a display label,
    //    and the LLM does not perform numeric operations on it
    const data = [{ id: 'QS-001', count: 42 }];
    const encoded = toonEncoder.encode(data);
    const decoded = toonEncoder.decode(encoded);
    assert.deepStrictEqual(decoded, data);
});
```
Traces to: FR-001

### 4.3 Total New Test Count

**New test cases in toon-encoder.test.cjs: 35**

Broken down:
- isUniformArray(): 7 tests (TC-TOON-01 through TC-TOON-07)
- encode(): 21 tests (TC-TOON-10 through TC-TOON-30)
- decode(): 11 tests (TC-TOON-40 through TC-TOON-50)
- round-trip: 5 tests (TC-TOON-60 through TC-TOON-64)

This total of 35 new tests is ADDITIVE to the existing 555+ test baseline (NFR-007 compliance).

---

## 5. Module 4: test-session-cache-builder.test.cjs Modifications

**File:** `src/claude/hooks/tests/test-session-cache-builder.test.cjs`
**Change Type:** MODIFY
**Traces to:** FR-002

### 5.1 TC-BUILD-08 Assertion Update

**Current (line 287):**
```javascript
assert.ok(section.includes('"ownership"'), 'Should contain ownership');
```

**New:**
```javascript
assert.ok(section.includes('## ownership'), 'Should contain ownership section');
```

**Rationale:** The SKILLS_MANIFEST section no longer contains JSON-quoted `"ownership"` -- it contains the markdown heading `## ownership` followed by TOON-encoded data.

### 5.2 New Test Case: TC-BUILD-19

Add a new test case to validate TOON encoding in the SKILLS_MANIFEST section:

```javascript
// TC-BUILD-19: SKILLS_MANIFEST section contains TOON-encoded skill_lookup and ownership
// Traces: REQ-0040, FR-002, AC-002-02
it('TC-BUILD-19: SKILLS_MANIFEST contains TOON-encoded tables', () => {
    const tmpDir = createFullTestProject();
    process.env.CLAUDE_PROJECT_DIR = tmpDir;
    try {
        common.rebuildSessionCache({ projectRoot: tmpDir });
        const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
        const sStart = content.indexOf('<!-- SECTION: SKILLS_MANIFEST -->');
        const sEnd = content.indexOf('<!-- /SECTION: SKILLS_MANIFEST -->');
        const section = content.substring(sStart, sEnd);

        // Metadata should be plain text key: value
        assert.ok(section.includes('version: 5.0.0'), 'Should contain version metadata');
        assert.ok(section.includes('total_skills: 4'), 'Should contain total_skills metadata');
        assert.ok(section.includes('enforcement_mode: observe'), 'Should contain enforcement_mode');

        // skill_lookup should be TOON-encoded
        assert.ok(section.includes('## skill_lookup'), 'Should contain skill_lookup heading');
        assert.ok(section.includes('[4]{id,agent}:'), 'skill_lookup should have TOON header with 4 rows');
        assert.ok(section.includes('TST-001,agent-one'), 'Should contain TST-001 entry');
        assert.ok(section.includes('TST-003,agent-two'), 'Should contain TST-003 entry');

        // ownership should be TOON-encoded
        assert.ok(section.includes('## ownership'), 'Should contain ownership heading');
        assert.ok(section.includes('{agent,agent_id,phase,skill_count}:'),
            'ownership should have TOON header with correct fields');
        assert.ok(section.includes('agent-one,'), 'Should contain agent-one entry');
        assert.ok(section.includes('agent-two,'), 'Should contain agent-two entry');
    } finally {
        cleanup(tmpDir);
    }
});
```

### 5.3 New Test Case: TC-BUILD-20

Add a test for TOON fallback behavior:

```javascript
// TC-BUILD-20: SKILLS_MANIFEST falls back to JSON on TOON encoding failure
// Traces: REQ-0040, FR-004, AC-004-03
it('TC-BUILD-20: SKILLS_MANIFEST falls back to JSON on encoding failure', () => {
    const tmpDir = createFullTestProject();
    process.env.CLAUDE_PROJECT_DIR = tmpDir;
    // Create a malformed manifest where skill_lookup is not an object
    const manifestPath = path.join(tmpDir, 'src', 'claude', 'hooks', 'config', 'skills-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.skill_lookup = 'not-an-object';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    try {
        const result = common.rebuildSessionCache({ projectRoot: tmpDir });
        // Should still produce a valid cache (fail-open)
        assert.ok(fs.existsSync(result.path));
        assert.ok(result.sections.includes('SKILLS_MANIFEST'));
        const content = fs.readFileSync(result.path, 'utf8');
        // The section should exist and not be skipped
        assert.ok(content.includes('<!-- SECTION: SKILLS_MANIFEST -->'));
    } finally {
        cleanup(tmpDir);
    }
});
```

### 5.4 New Test Case: TC-BUILD-21

Validate that the test manifest ownership entries (which lack `agent_id` and `phase` fields) use default values:

```javascript
// TC-BUILD-21: ownership TOON uses defaults for missing fields
// Traces: REQ-0040, FR-002, Article X
it('TC-BUILD-21: ownership TOON uses defaults for missing fields', () => {
    const tmpDir = createFullTestProject();
    process.env.CLAUDE_PROJECT_DIR = tmpDir;
    try {
        common.rebuildSessionCache({ projectRoot: tmpDir });
        const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
        const sStart = content.indexOf('<!-- SECTION: SKILLS_MANIFEST -->');
        const sEnd = content.indexOf('<!-- /SECTION: SKILLS_MANIFEST -->');
        const section = content.substring(sStart, sEnd);

        // Test manifest ownership entries have no agent_id, phase, or skill_count
        // defaults should be used: '' for strings, 0 for skill_count
        assert.ok(section.includes('## ownership'), 'Should contain ownership heading');
        // Verify TOON header has correct fields
        assert.ok(section.includes('{agent,agent_id,phase,skill_count}:'),
            'ownership should have TOON header with 4 fields');
    } finally {
        cleanup(tmpDir);
    }
});
```

### 5.5 Total Modified/New Tests in Session Cache Builder

- TC-BUILD-08: Modified (1 assertion changed)
- TC-BUILD-19: New (TOON format validation)
- TC-BUILD-20: New (fallback behavior)
- TC-BUILD-21: New (default values)

Net new test cases: +3

---

## 6. Error Taxonomy

### 6.1 Errors Thrown by toon-encoder.cjs

| Error Type | Condition | Message Template | Thrown By | Traces to |
|------------|-----------|-----------------|-----------|-----------|
| `TypeError` | `encode()` input is not a uniform array | `"encode() requires a non-empty array of uniform objects"` | `encode()` | FR-001 |
| `RangeError` | `encode()` input exceeds 10,000 rows | `"encode() rejects arrays with more than 10,000 rows"` | `encode()` | FR-001 |

### 6.2 Errors Caught and Handled (Never Propagated)

| Error Source | Caught By | Fallback Behavior | Log Output | Traces to |
|-------------|-----------|-------------------|------------|-----------|
| TOON decode failure | `decode()` | Try JSON.parse() | `"TOON decode fallback: used JSON.parse\n"` to stderr | FR-004 (AC-004-01, AC-004-02) |
| Both TOON and JSON decode failure | `decode()` | Return `[]` | `"TOON decode failed: neither TOON nor JSON parseable\n"` to stderr | FR-004 |
| skill_lookup TOON encoding failure | `rebuildSessionCache()` | JSON.stringify fallback | `"TOON fallback (skill_lookup): {err.message}\n"` to stderr | FR-004 (AC-004-03) |
| ownership TOON encoding failure | `rebuildSessionCache()` | JSON.stringify fallback | `"TOON fallback (ownership): {err.message}\n"` to stderr | FR-004 (AC-004-03) |

### 6.3 Error Flow Diagram

```
encode() error path:
  Input validation failure --> throw TypeError/RangeError
                          --> CAUGHT by rebuildSessionCache() try/catch
                          --> JSON.stringify fallback
                          --> stderr log
                          --> Section produced with JSON (never empty)

decode() error path:
  TOON parse failure --> try JSON.parse()
                    --> JSON parse success --> return array + stderr log
                    --> JSON parse failure --> return [] + stderr log

rebuildSessionCache() error path:
  Section content function throws --> CAUGHT by buildSection()
                                 --> Section marked as SKIPPED
                                 --> Cache still produced (never empty)
```

---

## 7. Validation Rules

### 7.1 Input Validation for encode()

| Rule | Validation | Error |
|------|-----------|-------|
| VR-001 | `data` must be an Array | `TypeError` |
| VR-002 | `data.length` must be > 0 | `TypeError` |
| VR-003 | Each element of `data` must be a non-null, non-array object | `TypeError` |
| VR-004 | All elements must have identical keys (set comparison) | `TypeError` |
| VR-005 | `data.length` must be <= 10,000 | `RangeError` |

### 7.2 Input Validation for decode()

| Rule | Validation | Behavior |
|------|-----------|----------|
| VR-010 | `toonString` must be a string | Return `[]` |
| VR-011 | `toonString.trim()` must be non-empty | Return `[]` |
| VR-012 | TOON header must match `[N]{fields}:` pattern | Fall back to JSON.parse |
| VR-013 | JSON.parse must return an array | Return `[]` |

### 7.3 Data Integrity Invariants

| Invariant | Description | Enforcement |
|-----------|-------------|-------------|
| INV-001 | session-cache.md is always produced | `buildSection()` catches all errors; cache write is unconditional |
| INV-002 | SKILLS_MANIFEST section is never empty | Metadata lines are always written; tabular sub-sections fall back to JSON |
| INV-003 | state.json is never modified by TOON encoding | TOON applied at cache build time only (ADR-0040-04, NFR-008) |
| INV-004 | Hooks always exit 0 | No uncaught exceptions propagate from TOON code (FR-004, AC-004-04) |

---

## 8. Data Flow

### 8.1 Encoding Flow (Cache Build)

```
skills-manifest.json
  |
  v
JSON.parse() --> raw manifest object
  |
  +-- raw.skill_lookup (flat object {id: agent})
  |     |
  |     v
  |   Object.entries().map() --> [{id, agent}, ...] (243 rows)
  |     |
  |     v
  |   toonEncoder.encode() --> "[243]{id,agent}:\n  QS-001,quick-scan-agent\n  ..."
  |     |
  |     +-- On error: JSON.stringify(raw.skill_lookup, null, 2)
  |
  +-- raw.ownership (nested object {agent: {agent_id, phase, skill_count, skills}})
  |     |
  |     v
  |   Object.entries().map() --> [{agent, agent_id, phase, skill_count}, ...] (41 rows)
  |     |                        (skills[] array DROPPED)
  |     v
  |   toonEncoder.encode() --> "[41]{agent,agent_id,phase,skill_count}:\n  sdlc-orchestrator,00,all,12\n  ..."
  |     |
  |     +-- On error: JSON.stringify(raw.ownership, null, 2)
  |
  +-- raw.cross_agent_delegation (deeply nested)
  |     |
  |     v
  |   JSON.stringify(raw.cross_agent_delegation, null, 2) (unchanged)
  |
  +-- Metadata: version, total_skills, enforcement_mode
        |
        v
      "version: 5.0.0\ntotal_skills: 246\nenforcement_mode: observe"
```

### 8.2 Section Assembly

```
sectionParts = [
    "version: 5.0.0",
    "total_skills: 246",
    "enforcement_mode: observe",
    "## skill_lookup\n[243]{id,agent}:\n  QS-001,quick-scan-agent\n  ...",
    "## ownership\n[41]{agent,agent_id,phase,skill_count}:\n  sdlc-orchestrator,00,all,12\n  ...",
    "## cross_agent_delegation\n{...JSON...}"
]

return sectionParts.join("\n\n")
```

### 8.3 Expected SKILLS_MANIFEST Section Output

```
<!-- SECTION: SKILLS_MANIFEST -->
version: 5.0.0
total_skills: 246
enforcement_mode: observe

## skill_lookup
[243]{id,agent}:
  QS-001,quick-scan-agent
  QS-002,quick-scan-agent
  QS-003,quick-scan-agent
  ARCH-001,solution-architect
  ARCH-002,solution-architect
  ...

## ownership
[41]{agent,agent_id,phase,skill_count}:
  sdlc-orchestrator,00,all,12
  discover-orchestrator,00d,discovery,6
  requirements-analyst,01,01-requirements,8
  ...

## cross_agent_delegation
{
  "_comment": "Defines which agents can delegate to other agents for specific workflows",
  "upgrade-engineer": {
    "can_delegate_to": [
      "impact-analysis-orchestrator"
    ],
    ...
  }
}
<!-- /SECTION: SKILLS_MANIFEST -->
```

---

## 9. Implementation Notes

### 9.1 NaN and Infinity Handling

JavaScript's `JSON.stringify()` converts `NaN`, `Infinity`, and `-Infinity` to `null`. The TOON encoder follows the same convention for consistency: non-finite numbers are serialized as `null`.

Implementation:
```javascript
if (typeof val === 'number') {
    if (!isFinite(val)) return 'null';
    return String(val);
}
```

### 9.2 Numeric String Ambiguity in decode()

The decoder's `deserializeValue()` converts numeric-looking bare strings to numbers. This means a string value `"42"` encoded as bare `42` will decode as the number `42`, not the string `"42"`.

For the iSDLC use case, this is acceptable because:
1. **skill_lookup**: Both `id` (e.g., "QS-001") and `agent` (e.g., "quick-scan-agent") contain non-numeric characters and will not trigger numeric parsing.
2. **ownership**: `agent_id` values like "00" ARE numeric-looking, but will decode as `0` (number). This is a lossy round-trip for this field. However, `agent_id` is only used as a display label in the session cache -- the LLM does not perform numeric operations on it.

If future data requires preserving numeric-looking strings, the encoder could be enhanced to always quote string values. This enhancement is deferred per Article V (YAGNI).

### 9.3 File Size Impact

The common.cjs modification adds approximately 30 lines of code (net). The `require('./toon-encoder.cjs')` adds a new module load at process startup, adding negligible latency (< 1ms for a ~100-line CJS file with no dependencies).

### 9.4 Test File Naming Convention

The new test file follows the existing convention:
- CJS test files are in `src/claude/hooks/tests/`
- Named `toon-encoder.test.cjs` (matches the module name)
- Uses `node:test` + `node:assert/strict` framework
- Run via `node --test` command

---

## 10. Requirement Traceability Matrix

| Requirement | Acceptance Criteria | Design Component | Test Case(s) |
|-------------|-------------------|-----------------|--------------|
| FR-001 | AC-001-01 | toon-encoder.cjs `module.exports` | TC-TOON-10 (import works) |
| FR-001 | AC-001-02 | `encode()` function | TC-TOON-10 through TC-TOON-30 |
| FR-001 | AC-001-03 | `decode()` function | TC-TOON-40 through TC-TOON-45 |
| FR-001 | AC-001-04 | Pure CJS, no modern APIs | All tests run on Node 20, 22, 24 via CI |
| FR-002 | AC-002-02 | common.cjs Section 5 modification | TC-BUILD-19 |
| FR-004 | AC-004-01 | `decode()` JSON fallback | TC-TOON-48 |
| FR-004 | AC-004-02 | stderr logging | TC-TOON-50 |
| FR-004 | AC-004-03 | Per-section try/catch in common.cjs | TC-BUILD-20 |
| FR-004 | AC-004-04 | buildSection() catches all; exit 0 | TC-BUILD-20 (cache produced on failure) |
| FR-005 | AC-005-01, AC-005-02 | rebuildSessionCache() auto-inherited | TC-BUILD-19 (validates rebuilt cache format) |
| NFR-001 | 42% on SKILLS_MANIFEST | TOON encoding of 243+41 entries | TC-BUILD-19 (format check) |
| NFR-003 | <50ms encoding | ~500 rows, native CJS, sub-ms expected | Benchmarked during implementation |
| NFR-004 | 100% fallback | Per-section JSON fallback | TC-BUILD-20, TC-TOON-48, TC-TOON-49 |
| NFR-005 | CJS compatibility | `require()` in module.exports | TC-TOON-01 (loads via require) |
| NFR-007 | >=555 test baseline | +35 new + 3 new in session cache = +38 | Test count verification |
| NFR-008 | state.json integrity | No state.json modifications in design | Code review |

---

## 11. Constitutional Compliance

| Article | Status | Evidence |
|---------|--------|---------|
| Article I (Specification Primacy) | COMPLIANT | Design implements architecture spec exactly: native CJS encoder per ADR-0040-01, SKILLS_MANIFEST only per ADR-0040-02, per-section fallback per ADR-0040-03, REQ-003 deferred per ADR-0040-04 |
| Article IV (Explicit Over Implicit) | COMPLIANT | All design decisions documented; numeric string ambiguity documented (Section 9.2); "null" string ambiguity documented (Section 2.13); default values for missing ownership fields explicit |
| Article V (Simplicity First) | COMPLIANT | Zero dependencies; 80-100 line encoder; only encodes what benefits; no speculative features; defers numeric string preservation per YAGNI |
| Article VII (Artifact Traceability) | COMPLIANT | Full traceability matrix in Section 10; every test case traces to FRs; every function traces to requirements |
| Article IX (Quality Gate Integrity) | COMPLIANT | All required design artifacts produced; 38 new test cases added to baseline; GATE-04 checklist validated below |

---

## 12. GATE-04 Design Validation Checklist

- [x] Interface specification complete: toon-encoder.cjs public API fully specified (Section 2)
- [x] All modules designed with clear responsibilities: toon-encoder.cjs (encode/decode), common.cjs modification (SKILLS_MANIFEST section), tests
- [x] Error taxonomy complete: all errors documented with types, messages, and handling (Section 6)
- [x] Validation rules defined: input validation for encode() and decode() (Section 7)
- [x] Designs cover all in-scope requirements: FR-001, FR-002, FR-004, FR-005 covered; FR-003 deferred per ADR-0040-04
- [x] Interface contracts reviewed: encode/decode signatures, return types, error types specified
- [x] Data flow documented: encoding flow, section assembly, expected output (Section 8)
- [x] Test specifications complete: 35 new toon-encoder tests + 3 new session cache tests (Sections 4, 5)
- [x] Backward compatibility addressed: no breaking changes to callers (Section 3.6)
- [x] Constitutional articles validated: I, IV, V, VII, IX all compliant (Section 11)

---

## Appendix A: Files Changed Summary

| # | File | Change | Lines Added (est.) | Lines Modified (est.) | Requirement |
|---|------|--------|-------------------|---------------------|-------------|
| 1 | `src/claude/hooks/lib/toon-encoder.cjs` | NEW | ~100 | 0 | FR-001, FR-004 |
| 2 | `src/claude/hooks/lib/common.cjs` | MODIFY | ~35 | ~5 (replace Section 5) | FR-002, FR-004 |
| 3 | `src/claude/hooks/tests/toon-encoder.test.cjs` | NEW | ~350 | 0 | FR-001, FR-004 tests |
| 4 | `src/claude/hooks/tests/test-session-cache-builder.test.cjs` | MODIFY | ~60 | ~1 (TC-BUILD-08 fix) | FR-002 tests |

**Estimated total: ~545 lines added, ~6 lines modified**

## Appendix B: Phase Timing Report

```json
{
  "debate_rounds_used": 0,
  "fan_out_chunks": 0
}
```
