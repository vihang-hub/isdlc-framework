# Implementation Notes: REQ-0040 TOON Format Integration

## Summary

Implemented the TOON (Token-Oriented Object Notation) encoder/decoder as a pure CJS module with zero npm dependencies. Integrated TOON encoding into the session cache builder's SKILLS_MANIFEST section with fail-open JSON fallback per ADR-0040-03.

## Key Implementation Decisions

### ADR-0040-01: Native CJS Encoder
- Implemented as `src/claude/hooks/lib/toon-encoder.cjs` (~260 lines)
- Pure CommonJS, zero external dependencies
- Exports: `encode()`, `decode()`, `isUniformArray()`, plus internal helpers for testing

### ADR-0040-02: SKILLS_MANIFEST Only
- TOON encoding is attempted ONLY for the SKILLS_MANIFEST section in `rebuildSessionCache()`
- Other sections (CONSTITUTION, WORKFLOW_CONFIG, ITERATION_REQUIREMENTS, etc.) remain unchanged
- The `[TOON]` marker is prepended to encoded content for downstream format detection

### ADR-0040-03: Fail-Open Fallback
- If `isUniformArray()` returns false, JSON format is used (no change from baseline)
- If `toon-encoder.cjs` throws any error, the catch block falls through to JSON
- The current skills-manifest.json is a nested object (not a uniform array), so TOON encoding does NOT activate for the current data structure
- When the manifest is restructured to a uniform array in the future, TOON encoding will automatically activate

### ADR-0040-04: FR-003 Deferred
- State array encoding was NOT implemented (no injection point exists)

## Files Created

| File | Description | Lines |
|------|-------------|-------|
| `src/claude/hooks/lib/toon-encoder.cjs` | TOON encoder/decoder module | ~260 |
| `src/claude/hooks/tests/toon-encoder.test.cjs` | Unit tests (44 tests) | ~340 |

## Files Modified

| File | Change | Reason |
|------|--------|--------|
| `src/claude/hooks/lib/common.cjs` | SKILLS_MANIFEST section now attempts TOON encoding | REQ-0040 integration |
| `src/claude/hooks/tests/test-session-cache-builder.test.cjs` | +3 integration tests for TOON encoding | Verify integration works |
| `src/claude/hooks/tests/hook-test-utils.cjs` | Added `toon-encoder.cjs` to lib files copied for test isolation | Ensure hooks using common.cjs work in test environments |

## Test Results

- **New tests**: 47 (44 unit + 3 integration)
- **All new tests**: PASSING
- **Full suite**: 653 total tests, 645 passing, 8 pre-existing failures (unrelated)
- **No regressions** introduced by this implementation

## TOON Format Specification

```
[N]{field1,field2,...}:
  value1,value2,...
  value1,value2,...
```

- Header: `[N]{fields}:` where N is the row count
- Data rows: 2-space indented, comma-delimited
- Strings: bare unless containing special chars (comma, quote, newline, backslash)
- Numbers, booleans, null: literal representation
- Objects/arrays: JSON.stringify() fallback

## Traceability

| Requirement | Implementation |
|-------------|---------------|
| FR-001 (encode) | `toon-encoder.cjs::encode()` |
| FR-002 (decode) | `toon-encoder.cjs::decode()` |
| FR-003 (state arrays) | DEFERRED per ADR-0040-04 |
| NFR-001 (no dependencies) | Zero npm dependencies, pure CJS |
| NFR-002 (fail-open) | try/catch in rebuildSessionCache, decode() JSON fallback |
