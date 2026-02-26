# Implementation Notes: REQ-0041 TOON Full Spec Session Cache Reduction

| Field | Value |
|-------|-------|
| **Phase** | 06-implementation |
| **Status** | Complete |
| **Date** | 2026-02-26 |

---

## Files Modified

### 1. `src/claude/hooks/lib/toon-encoder.cjs`

**Lines**: 304 (before) -> 989 (after)

**New functions added**:

- `isPrimitiveArray(data)` -- Checks if all elements are string/number/boolean/null
- `encodeValue(data, options)` -- General-purpose TOON encoder for any JS value
- `decodeValue(toonString)` -- TOON parser for test round-trip verification
- `_encodeObject(obj, indent, stripKeys)` -- Internal: indentation-based object encoding
- `_encodeListArray(arr, indent, stripKeys)` -- Internal: list-form array encoding
- `_decodeLines(lines, baseIndent, startLine, endLine)` -- Internal: recursive line parser
- `_parseObjectBlock(lines, startLine, endLine, baseIndent)` -- Internal: object block parser
- `_getIndent(line)` -- Internal: indentation level calculator
- `_findBlockEnd(lines, startLine, endLine, minIndent)` -- Internal: block boundary finder
- `_parseKVLine(trimmedLine, obj, lines, lineIndex, endLine, indent)` -- Internal: KV parser
- `_skipBlock(lines, lineIndex, endLine, baseIndent)` -- Internal: block skipper

**New exports**: `encodeValue`, `decodeValue`, `isPrimitiveArray`

**Existing exports unchanged**: `encode`, `decode`, `isUniformArray`, `serializeValue`, `deserializeValue`, `splitRow`, `MAX_ROWS`

### 2. `src/claude/hooks/lib/common.cjs`

**Changes to `rebuildSessionCache()`**:

- Added `buildJsonSection(name, sourcePath)` helper function that:
  1. Parses JSON from source file
  2. Attempts TOON encoding via `encodeValue()` with `stripKeys: ['_comment']`
  3. Falls back to JSON on failure (fail-open per Article X)
  4. Logs per-section stats when verbose
- Replaced sections 2-5 (WORKFLOW_CONFIG, ITERATION_REQUIREMENTS, ARTIFACT_PATHS, SKILLS_MANIFEST) to use `buildJsonSection()`
- Added total TOON reduction summary in verbose mode (FR-010)
- Tracks `totalJsonChars` / `totalToonChars` for summary calculation

### 3. `src/claude/hooks/tests/toon-encoder.test.cjs`

**Lines**: 443 (before) -> 1205 (after), **85 new tests**

New test suites:
- `isPrimitiveArray()` -- 6 tests (TC-IPA-01 through TC-IPA-06)
- `encodeValue() type dispatch` -- 8 tests (TC-EV-01 through TC-EV-08)
- `encodeValue() nested objects` -- 8 tests (TC-EV-09 through TC-EV-16)
- `encodeValue() key-value pairs` -- 6 tests (TC-EV-17 through TC-EV-22)
- `encodeValue() inline primitive arrays` -- 7 tests (TC-EV-23 through TC-EV-29)
- `encodeValue() mixed/list arrays` -- 5 tests (TC-EV-30 through TC-EV-34)
- `encodeValue() tabular delegation` -- 3 tests (TC-EV-35 through TC-EV-37)
- `encodeValue() key stripping` -- 4 tests (TC-EV-38 through TC-EV-41)
- `encodeValue() options` -- 3 tests (TC-EV-42 through TC-EV-44)
- `decodeValue() primitives` -- 5 tests (TC-DV-01 through TC-DV-05)
- `decodeValue() objects` -- 5 tests (TC-DV-06 through TC-DV-10)
- `decodeValue() inline arrays` -- 4 tests (TC-DV-11 through TC-DV-14)
- `decodeValue() list arrays` -- 4 tests (TC-DV-15 through TC-DV-18)
- `decodeValue() error handling` -- 4 tests (TC-DV-19 through TC-DV-22)
- `Round-trip encodeValue/decodeValue` -- 8 tests (TC-EVRT-01 through TC-EVRT-08)
- `Module exports` -- 2 tests (TC-MOD-01, TC-MOD-02)
- `Backward compatibility` -- 3 tests (TC-BC-02 through TC-BC-04)

### 4. `src/claude/hooks/tests/test-session-cache-builder.test.cjs`

**Updated tests** to reflect REQ-0041 TOON encoding behavior:
- TC-BUILD-07: Now verifies WORKFLOW_CONFIG uses `[TOON]` marker with bare keys
- TC-BUILD-08: Now verifies SKILLS_MANIFEST uses `[TOON]` marker with bare ownership key
- TC-TOON-INT-02: Updated from "falls back to JSON" to "uses TOON for nested objects"

## Design Decisions

### D1: Uniform arrays with nested object values use tabular format

Per module-design.md Section 2.5, when `isUniformArray()` returns true, the data is encoded in tabular format regardless of value complexity. Nested object values within uniform arrays are serialized via `JSON.stringify()` within the tabular rows. This preserves the REQ-0040 optimization for applicable data.

### D2: `decodeValue()` treats single bare strings as valid TOON

A single-line string without any TOON structural markers (`:`, `[`, `-`) is treated as a bare string value and returned as-is via `deserializeValue()`. This matches the TOON format specification where simple strings are emitted bare.

### D3: `_comment` stripping via `stripKeys` option

All four JSON sections are encoded with `stripKeys: ['_comment']` per FR-006. This removes documentation-only keys that waste tokens in the LLM context window.

## Test Results

- **Total tests**: 129 (44 existing + 85 new)
- **Passing**: 129/129 (100%)
- **Session cache builder tests**: 48/50 (2 pre-existing failures unrelated to REQ-0041)
- **Iterations**: 3 (initial run -> 3 failures -> 1 failure -> 0 failures)

## Traceability

| FR | AC | Implementation | Test |
|----|----|---------------|------|
| FR-001 | AC-001-01..04 | `_encodeObject()` | TC-EV-09..16 |
| FR-002 | AC-002-01..03 | `_encodeObject()` key-value encoding | TC-EV-17..22 |
| FR-003 | AC-003-01..05 | `isPrimitiveArray()`, inline array in `_encodeObject()` | TC-IPA-01..06, TC-EV-23..29 |
| FR-004 | AC-004-01..03 | `_encodeListArray()` | TC-EV-30..34 |
| FR-005 | AC-005-01..02 | `encodeValue()` uniform array dispatch | TC-EV-35..37 |
| FR-006 | AC-006-01..03 | `stripKeys` parameter in `_encodeObject()` | TC-EV-38..41 |
| FR-007 | AC-007-01..05 | `buildJsonSection()` in `rebuildSessionCache()` | TC-BUILD-07..08, TC-TOON-INT-01..03 |
| FR-008 | AC-008-01..05 | `decodeValue()` | TC-DV-01..22, TC-EVRT-01..08 |
| FR-009 | AC-009-01..02 | Unchanged exports + new exports | TC-MOD-01..02, TC-BC-02..04 |
| FR-010 | AC-010-01..02 | Verbose stats in `buildJsonSection()` | (tested via integration) |
