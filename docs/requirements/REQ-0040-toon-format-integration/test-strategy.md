# Test Strategy: TOON Format Integration

**Requirement ID:** REQ-0040
**Artifact Folder:** REQ-0040-toon-format-integration
**Phase:** 05-test-strategy
**Created:** 2026-02-25
**Status:** Draft

---

## 1. Test Strategy Overview

### 1.1 Approach: Test-First Development (Article II)

All tests are designed before implementation begins. The implementation phase (06) will follow TDD (Red-Green-Refactor):

1. **Red**: Write test cases from this strategy; all fail (module does not exist yet)
2. **Green**: Implement `toon-encoder.cjs` and `common.cjs` modifications until all tests pass
3. **Refactor**: Clean up implementation while maintaining green tests

### 1.2 Existing Infrastructure (from test evaluation)

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` (Node.js built-in) |
| **CJS Test Directory** | `src/claude/hooks/tests/*.test.cjs` |
| **Run Command (CJS)** | `npm run test:hooks` |
| **Run Command (All)** | `npm run test:all` |
| **Current Test Baseline** | 555+ tests (302 ESM + 253 CJS) |
| **Naming Convention** | `{module-name}.test.cjs` |
| **Helpers/Utilities** | `src/claude/hooks/tests/hook-test-utils.cjs` |

### 1.3 Strategy: Extend Existing Test Suite

This strategy does NOT redesign testing from scratch. It extends the existing CJS test suite with:
- 1 new test file: `toon-encoder.test.cjs` (44 tests)
- 1 modified test file: `test-session-cache-builder.test.cjs` (+3 new tests, 1 assertion fix)
- Total net new tests: **47**
- Post-implementation baseline: **>= 602 tests** (555 + 47)

**Note:** The module design document (Section 4.3) claims "35 new tests" in toon-encoder.test.cjs, but the actual test case specifications in Section 4.2 enumerate 44 distinct test cases: isUniformArray (7) + encode (21) + decode (11) + round-trip (5) = 44. This test strategy uses the correct count of 44 based on the concrete test specifications.

### 1.4 Scope Boundaries

**In Scope (per ADRs):**
- FR-001: TOON CJS encoder/decoder/validator (toon-encoder.cjs)
- FR-002: SKILLS_MANIFEST TOON encoding in session cache (AC-002-02 only)
- FR-004: JSON fallback on decode/encode failure
- FR-005: Cache rebuild consistency (auto-inherited via rebuildSessionCache)

**Out of Scope (per ADRs):**
- FR-003: State array encoding (DEFERRED per ADR-0040-04 -- no injection point exists)
- FR-002 AC-002-01: SKILL_INDEX as TOON (already compact text per ADR-0040-02)
- FR-002 AC-002-03: ITERATION_REQUIREMENTS and WORKFLOW_CONFIG as TOON (deeply nested per ADR-0040-02)

---

## 2. Test Pyramid

### 2.1 Test Type Distribution

| Test Type | Count | Percentage | Purpose |
|-----------|-------|------------|---------|
| Unit Tests | 35 | 92% | toon-encoder.cjs: encode, decode, isUniformArray |
| Integration Tests | 3 | 8% | session cache builder with TOON encoding |
| E2E Tests | 0 | 0% | N/A -- internal pipeline, no user-facing endpoint |
| Security Tests | 0 | 0% | No user input boundary (internal hook data only) |
| Performance Tests | Benchmarked inline | -- | Encoding latency < 50ms (NFR-003) |

### 2.2 Justification for Unit-Heavy Distribution

The TOON encoder is a pure function library with no I/O, no state, and no side effects (except stderr logging in decode fallback). This makes unit tests the most effective testing strategy. Integration tests validate the wiring between `toon-encoder.cjs` and `common.cjs` inside `rebuildSessionCache()`.

E2E tests are unnecessary because:
- `inject-session-cache.cjs` treats the cache file as opaque text (no TOON awareness needed)
- The LLM consumer is not programmatically testable
- The entire pipeline is synchronous and deterministic

---

## 3. Test Cases by Category

### 3.1 Unit Tests: isUniformArray() (7 tests)

| Test ID | Description | Test Type | Traces To | Priority |
|---------|-------------|-----------|-----------|----------|
| TC-TOON-01 | Returns true for array of uniform objects | positive | FR-001 | P1 |
| TC-TOON-02 | Returns false for empty array | negative | FR-001 | P0 |
| TC-TOON-03 | Returns false for non-array input (string, number, null, undefined, object) | negative | FR-001 | P0 |
| TC-TOON-04 | Returns false for array with mixed keys | negative | FR-001 | P0 |
| TC-TOON-05 | Returns false for array containing null | negative | FR-001 | P0 |
| TC-TOON-06 | Returns false for array containing nested arrays | negative | FR-001 | P1 |
| TC-TOON-07 | Returns true for single-element array | positive | FR-001 | P1 |

### 3.2 Unit Tests: encode() (21 tests)

| Test ID | Description | Test Type | Traces To | Priority |
|---------|-------------|-----------|-----------|----------|
| TC-TOON-10 | Encodes simple two-field array with correct format | positive | FR-001, AC-001-02 | P0 |
| TC-TOON-11 | Header contains correct row count | positive | FR-001 | P1 |
| TC-TOON-12 | Header contains correct field names | positive | FR-001 | P1 |
| TC-TOON-13 | Data rows are two-space indented | positive | FR-001 | P1 |
| TC-TOON-14 | Encodes null values as literal null | positive | FR-001 | P1 |
| TC-TOON-15 | Encodes boolean values as literals | positive | FR-001 | P1 |
| TC-TOON-16 | Encodes numeric values as literals | positive | FR-001 | P1 |
| TC-TOON-17 | Quotes strings containing commas | positive | FR-001 | P0 |
| TC-TOON-18 | Quotes strings containing double quotes | positive | FR-001 | P0 |
| TC-TOON-19 | Quotes strings containing newlines | positive | FR-001 | P0 |
| TC-TOON-20 | Quotes strings containing backslashes | positive | FR-001 | P1 |
| TC-TOON-21 | Handles empty string values | positive | FR-001 | P1 |
| TC-TOON-22 | Throws TypeError for non-uniform input | negative | FR-001 | P0 |
| TC-TOON-23 | Throws TypeError for empty array | negative | FR-001 | P0 |
| TC-TOON-24 | Throws RangeError for arrays exceeding 10,000 rows | negative | FR-001 | P1 |
| TC-TOON-25 | Encodes single-element array | positive | FR-001 | P1 |
| TC-TOON-26 | Encodes undefined values as null | positive | FR-001 | P1 |
| TC-TOON-27 | JSON-stringifies and quotes object values | positive | FR-001 | P1 |
| TC-TOON-28 | JSON-stringifies and quotes array values | positive | FR-001 | P1 |
| TC-TOON-29 | Handles NaN as null | positive | FR-001 | P2 |
| TC-TOON-30 | Handles Infinity as null | positive | FR-001 | P2 |

### 3.3 Unit Tests: decode() (11 tests)

| Test ID | Description | Test Type | Traces To | Priority |
|---------|-------------|-----------|-----------|----------|
| TC-TOON-40 | Decodes simple two-field TOON string | positive | FR-001, AC-001-03 | P0 |
| TC-TOON-41 | Preserves string types | positive | FR-001, AC-001-03 | P0 |
| TC-TOON-42 | Preserves numeric types | positive | FR-001, AC-001-03 | P0 |
| TC-TOON-43 | Preserves boolean types | positive | FR-001, AC-001-03 | P1 |
| TC-TOON-44 | Preserves null values | positive | FR-001, AC-001-03 | P1 |
| TC-TOON-45 | Decodes quoted strings with escaped characters | positive | FR-001 | P0 |
| TC-TOON-46 | Returns empty array for empty string input | negative | FR-004 | P0 |
| TC-TOON-47 | Returns empty array for non-string input | negative | FR-004 | P0 |
| TC-TOON-48 | Falls back to JSON.parse for JSON string input | positive | FR-004, AC-004-01 | P0 |
| TC-TOON-49 | Returns empty array when both TOON and JSON fail | negative | FR-004 | P0 |
| TC-TOON-50 | Logs fallback to stderr on JSON parse | positive | FR-004, AC-004-02 | P0 |

### 3.4 Unit Tests: Round-Trip (5 tests)

| Test ID | Description | Test Type | Traces To | Priority |
|---------|-------------|-----------|-----------|----------|
| TC-TOON-60 | Round-trip preserves skill_lookup data shape | positive | FR-001, AC-001-02, AC-001-03 | P0 |
| TC-TOON-61 | Round-trip preserves ownership data shape | positive | FR-001, FR-002 | P0 |
| TC-TOON-62 | Round-trip with special characters | positive | FR-001 | P0 |
| TC-TOON-63 | Round-trip with mixed types in same field | positive | FR-001 | P1 |
| TC-TOON-64 | Round-trip with numeric-looking strings | positive | FR-001 | P1 |

### 3.5 Integration Tests: Session Cache Builder (3 new + 1 modified)

| Test ID | Description | Test Type | Traces To | Priority |
|---------|-------------|-----------|-----------|----------|
| TC-BUILD-08 | (MODIFIED) Assertion changed: `"ownership"` to `## ownership` | positive | FR-002 | P0 |
| TC-BUILD-19 | SKILLS_MANIFEST contains TOON-encoded skill_lookup and ownership tables | positive | FR-002, AC-002-02, FR-005, AC-005-01, AC-005-02 | P0 |
| TC-BUILD-20 | SKILLS_MANIFEST falls back to JSON on TOON encoding failure | negative | FR-004, AC-004-03, AC-004-04 | P0 |
| TC-BUILD-21 | Ownership TOON uses defaults for missing fields | positive | FR-002, Article X | P1 |

---

## 4. Test Data Plan

### 4.1 Boundary Values

| Data Point | Boundary | Test Coverage |
|------------|----------|---------------|
| Array length = 0 | Minimum invalid | TC-TOON-02, TC-TOON-23 |
| Array length = 1 | Minimum valid | TC-TOON-07, TC-TOON-25 |
| Array length = 10,000 | Maximum valid | Implicitly valid (no test for exact boundary) |
| Array length = 10,001 | Maximum+1 invalid | TC-TOON-24 |
| Empty string value `""` | Empty field | TC-TOON-21 |
| Null value | Null field | TC-TOON-14, TC-TOON-44 |
| Undefined value | Missing field equivalent | TC-TOON-26 |
| NaN | Non-finite number | TC-TOON-29 |
| Infinity | Non-finite number | TC-TOON-30 |

### 4.2 Invalid Inputs

| Input | Expected Behavior | Test Coverage |
|-------|-------------------|---------------|
| `encode([])` | TypeError thrown | TC-TOON-23 |
| `encode([{a:1},{b:2}])` (mixed keys) | TypeError thrown | TC-TOON-22 |
| `encode(Array(10001).fill({a:1}))` | RangeError thrown | TC-TOON-24 |
| `decode("")` | Returns `[]` | TC-TOON-46 |
| `decode("  ")` | Returns `[]` | TC-TOON-46 |
| `decode(null)` | Returns `[]` | TC-TOON-47 |
| `decode(undefined)` | Returns `[]` | TC-TOON-47 |
| `decode(123)` | Returns `[]` | TC-TOON-47 |
| `decode("not valid")` | Returns `[]`, logs stderr | TC-TOON-49 |
| `isUniformArray("string")` | Returns `false` | TC-TOON-03 |
| `isUniformArray(null)` | Returns `false` | TC-TOON-03 |
| `isUniformArray({a:1})` | Returns `false` | TC-TOON-03 |
| `isUniformArray([{a:1}, null])` | Returns `false` | TC-TOON-05 |
| `isUniformArray([[1,2]])` | Returns `false` | TC-TOON-06 |

### 4.3 Maximum-Size Inputs

| Scenario | Data Size | Purpose | Test Coverage |
|----------|-----------|---------|---------------|
| 10,001 row array | ~10K objects | RangeError boundary | TC-TOON-24 |
| 243-row skill_lookup | Production size | Real-world shape validation | TC-TOON-60 (sample) |
| 41-row ownership | Production size | Real-world shape validation | TC-TOON-61 (sample) |
| String with all special chars | Comma, quote, newline, backslash, tab | Escaping completeness | TC-TOON-62 |

### 4.4 Test Data Fixtures

Test data is defined inline within each test case (no shared fixture files needed). The module design specifies exact fixture data for each test case. Key fixtures:

**skill_lookup shape:**
```javascript
[
    { id: 'QS-001', agent: 'quick-scan-agent' },
    { id: 'ARCH-001', agent: 'solution-architect' }
]
```

**ownership shape:**
```javascript
[
    { agent: 'sdlc-orchestrator', agent_id: '00', phase: 'all', skill_count: 12 },
    { agent: 'discover-orchestrator', agent_id: '00d', phase: 'discovery', skill_count: 6 }
]
```

**Test project (for integration tests):**
The existing `createFullTestProject()` helper in `test-session-cache-builder.test.cjs` creates a minimal project with a 4-entry skill_lookup and 2-entry ownership table. This is sufficient for integration tests.

---

## 5. Flaky Test Mitigation

### 5.1 Risk Assessment

The TOON encoder test suite has **low flakiness risk** because:
- All functions are pure (deterministic input/output, no I/O except stderr in decode)
- No timing dependencies, network calls, or file system races
- No shared mutable state between tests
- Integration tests use isolated temp directories (existing pattern from `createFullTestProject()`)

### 5.2 Mitigation Measures

| Risk | Mitigation |
|------|-----------|
| stderr capture race in TC-TOON-50 | Use synchronous `process.stderr.write` monkey-patch with `try/finally` restore |
| Temp directory cleanup failure | Use `cleanup()` helper with `force: true` (existing pattern) |
| `require()` cache stale module | Use `requireCommon()` helper that clears cache (existing pattern) |
| Object key ordering non-deterministic | TOON uses `Object.keys()` which preserves insertion order in V8; all test data uses literal objects with deterministic key order |

---

## 6. Performance Test Plan

### 6.1 NFR-003: Encoding Latency < 50ms

**Approach:** Benchmark during implementation (not a separate test case). The encoder processes ~284 rows (243 skill_lookup + 41 ownership) of simple string/number data with zero dependencies. Expected latency is sub-millisecond based on similar string manipulation benchmarks.

**Validation method:**
```javascript
const start = performance.now();
toonEncoder.encode(productionSizeData);
const elapsed = performance.now() - start;
// Assert elapsed < 50  (add as assertion in TC-TOON-60/61 if needed)
```

### 6.2 NFR-001: Token Reduction >= 42% on SKILLS_MANIFEST

**Approach:** Manual validation during implementation. Compare character count of JSON-encoded vs TOON-encoded SKILLS_MANIFEST section using production skills-manifest.json.

The module design estimates:
- skill_lookup: 243 entries x 2 fields = from ~8,500 chars JSON to ~4,000 chars TOON (~53% reduction)
- ownership: 41 entries x 4 fields = significant reduction from nested JSON to flat TOON

TC-BUILD-19 validates the format correctness (TOON headers present, data rows present). Token count validation is a manual check during implementation, not an automated test.

---

## 7. Risk-Based Test Prioritization

### 7.1 Priority Definitions

| Priority | Criteria | Run Frequency |
|----------|----------|---------------|
| **P0** (Critical) | Core encoding/decoding, fallback safety, data integrity | Every run |
| **P1** (High) | Format correctness, type preservation, edge cases | Every run |
| **P2** (Medium) | Rare edge cases (NaN, Infinity) | Every run (fast) |

### 7.2 P0 Tests (Must Pass for Feature Acceptance)

These 25 tests cover the critical path:

| ID | Rationale |
|----|-----------|
| TC-TOON-02 | Empty array rejection prevents silent data loss |
| TC-TOON-03 | Non-array rejection prevents undefined behavior |
| TC-TOON-04 | Mixed-key rejection prevents corrupt TOON output |
| TC-TOON-05 | Null-in-array rejection prevents crash |
| TC-TOON-10 | Core encode format validation |
| TC-TOON-17 | Comma-in-string quoting prevents field corruption |
| TC-TOON-18 | Quote-in-string escaping prevents parse errors |
| TC-TOON-19 | Newline-in-string escaping prevents row corruption |
| TC-TOON-22 | TypeError on non-uniform input |
| TC-TOON-23 | TypeError on empty array |
| TC-TOON-40 | Core decode format validation |
| TC-TOON-41 | String type preservation |
| TC-TOON-42 | Numeric type preservation |
| TC-TOON-45 | Escaped character decode correctness |
| TC-TOON-46 | Empty input safety |
| TC-TOON-47 | Non-string input safety |
| TC-TOON-48 | JSON fallback correctness (Article X) |
| TC-TOON-49 | Total decode failure safety |
| TC-TOON-50 | stderr logging verification |
| TC-TOON-60 | skill_lookup round-trip data integrity |
| TC-TOON-61 | ownership round-trip data integrity |
| TC-TOON-62 | Special character round-trip integrity |
| TC-BUILD-08 | Existing assertion compatibility (modified) |
| TC-BUILD-19 | TOON format in live cache |
| TC-BUILD-20 | Fallback safety in live cache |

### 7.3 Critical Paths

1. **Encoding path:** `skills-manifest.json` -> `Object.entries().map()` -> `toonEncoder.encode()` -> TOON string in session-cache.md
2. **Fallback path:** encode() throws -> catch block -> `JSON.stringify()` -> JSON string in session-cache.md
3. **Decode path (future use):** TOON string -> `toonEncoder.decode()` -> array of objects
4. **Decode fallback path:** malformed input -> TOON parse fails -> JSON.parse() -> array or `[]`

---

## 8. Coverage Analysis

### 8.1 Acceptance Criteria Coverage Matrix

| AC ID | Description | Status | Test Case(s) | Coverage |
|-------|-------------|--------|--------------|----------|
| AC-001-01 | CJS require() loads encode/decode | In Scope | TC-TOON-10 (implicit: test loads module) | COVERED |
| AC-001-02 | encode() returns valid TOON | In Scope | TC-TOON-10..30, TC-TOON-60..64 | COVERED |
| AC-001-03 | decode() returns original objects | In Scope | TC-TOON-40..45, TC-TOON-60..64 | COVERED |
| AC-001-04 | Node 20/22/24 compatibility | In Scope | CI matrix (all tests run on 3 versions) | COVERED |
| AC-002-01 | SKILL_INDEX as TOON | **DEFERRED** | N/A (ADR-0040-02: already compact text) | N/A |
| AC-002-02 | SKILLS_MANIFEST skill_lookup + ownership as TOON | In Scope | TC-BUILD-19 | COVERED |
| AC-002-03 | ITER_REQ + WORKFLOW_CONFIG as TOON | **DEFERRED** | N/A (ADR-0040-02: deeply nested) | N/A |
| AC-002-04 | Token reduction >= 30% | In Scope | Manual validation during implementation | COVERED (manual) |
| AC-003-01 | workflow_history TOON injection | **DEFERRED** | N/A (ADR-0040-04: no injection point) | N/A |
| AC-003-02 | history + skill_usage_log TOON injection | **DEFERRED** | N/A (ADR-0040-04: no injection point) | N/A |
| AC-003-03 | state.json remains JSON | **DEFERRED** | N/A (ADR-0040-04) | N/A |
| AC-003-04 | State array token reduction >= 40% | **DEFERRED** | N/A (ADR-0040-04) | N/A |
| AC-004-01 | Malformed TOON falls back to JSON.parse | In Scope | TC-TOON-48 | COVERED |
| AC-004-02 | Fallback logs warning to stderr | In Scope | TC-TOON-50 | COVERED |
| AC-004-03 | Per-section fallback (one fails, others TOON) | In Scope | TC-BUILD-20 | COVERED |
| AC-004-04 | Hooks exit 0 on TOON failure | In Scope | TC-BUILD-20 (cache produced = exit 0) | COVERED |
| AC-005-01 | rebuild-cache.js produces TOON sections | In Scope | TC-BUILD-19 (rebuildSessionCache) | COVERED |
| AC-005-02 | rebuild-cache.js output matches inject output | In Scope | TC-BUILD-19 (same function) | COVERED |
| AC-005-03 | rebuild-cache.js JSON fallback | In Scope | TC-BUILD-20 (same function) | COVERED |

### 8.2 Coverage Summary

| Category | Total | In Scope | Covered | Deferred | Coverage |
|----------|-------|----------|---------|----------|----------|
| FR-001 ACs | 4 | 4 | 4 | 0 | **100%** |
| FR-002 ACs | 4 | 2 | 2 | 2 | **100% (in-scope)** |
| FR-003 ACs | 4 | 0 | 0 | 4 | **N/A (all deferred)** |
| FR-004 ACs | 4 | 4 | 4 | 0 | **100%** |
| FR-005 ACs | 3 | 3 | 3 | 0 | **100%** |
| **Total** | **19** | **13** | **13** | **6** | **100% of in-scope** |

### 8.3 NFR Coverage

| NFR ID | Description | Test Coverage |
|--------|-------------|---------------|
| NFR-001 | Token reduction >= 30% on SKILLS_MANIFEST | Manual validation; TC-BUILD-19 validates format |
| NFR-002 | State array token reduction >= 40% | DEFERRED (ADR-0040-04) |
| NFR-003 | Encoding latency < 50ms | Benchmarked inline during implementation |
| NFR-004 | 100% fallback coverage | TC-TOON-46..50, TC-BUILD-20 |
| NFR-005 | CJS compatibility via require() | All tests use `require()` (implicit) |
| NFR-006 | Node 20/22/24 support | CI matrix runs all tests on 3 versions |
| NFR-007 | Test count >= 602 (555 + 47) | Post-implementation count verification |
| NFR-008 | state.json remains JSON | No state.json modification in any code path; code review validates |
| NFR-009 | LLM parsing accuracy | Existing test suite regression (passes with TOON cache) |

---

## 9. Traceability Matrix (Complete)

### 9.1 Requirement -> Test Case Mapping

| Requirement | AC | Test Case | Test Type | File | Priority |
|-------------|-----|-----------|-----------|------|----------|
| FR-001 | AC-001-01 | TC-TOON-10 | positive | toon-encoder.test.cjs | P0 |
| FR-001 | AC-001-02 | TC-TOON-10 | positive | toon-encoder.test.cjs | P0 |
| FR-001 | AC-001-02 | TC-TOON-11 | positive | toon-encoder.test.cjs | P1 |
| FR-001 | AC-001-02 | TC-TOON-12 | positive | toon-encoder.test.cjs | P1 |
| FR-001 | AC-001-02 | TC-TOON-13 | positive | toon-encoder.test.cjs | P1 |
| FR-001 | AC-001-02 | TC-TOON-14 | positive | toon-encoder.test.cjs | P1 |
| FR-001 | AC-001-02 | TC-TOON-15 | positive | toon-encoder.test.cjs | P1 |
| FR-001 | AC-001-02 | TC-TOON-16 | positive | toon-encoder.test.cjs | P1 |
| FR-001 | AC-001-02 | TC-TOON-17 | positive | toon-encoder.test.cjs | P0 |
| FR-001 | AC-001-02 | TC-TOON-18 | positive | toon-encoder.test.cjs | P0 |
| FR-001 | AC-001-02 | TC-TOON-19 | positive | toon-encoder.test.cjs | P0 |
| FR-001 | AC-001-02 | TC-TOON-20 | positive | toon-encoder.test.cjs | P1 |
| FR-001 | AC-001-02 | TC-TOON-21 | positive | toon-encoder.test.cjs | P1 |
| FR-001 | AC-001-02 | TC-TOON-25 | positive | toon-encoder.test.cjs | P1 |
| FR-001 | AC-001-02 | TC-TOON-26 | positive | toon-encoder.test.cjs | P1 |
| FR-001 | AC-001-02 | TC-TOON-27 | positive | toon-encoder.test.cjs | P1 |
| FR-001 | AC-001-02 | TC-TOON-28 | positive | toon-encoder.test.cjs | P1 |
| FR-001 | AC-001-02 | TC-TOON-29 | positive | toon-encoder.test.cjs | P2 |
| FR-001 | AC-001-02 | TC-TOON-30 | positive | toon-encoder.test.cjs | P2 |
| FR-001 | AC-001-02 | TC-TOON-60 | positive | toon-encoder.test.cjs | P0 |
| FR-001 | AC-001-02 | TC-TOON-61 | positive | toon-encoder.test.cjs | P0 |
| FR-001 | AC-001-02 | TC-TOON-62 | positive | toon-encoder.test.cjs | P0 |
| FR-001 | AC-001-02 | TC-TOON-63 | positive | toon-encoder.test.cjs | P1 |
| FR-001 | AC-001-02 | TC-TOON-64 | positive | toon-encoder.test.cjs | P1 |
| FR-001 | AC-001-03 | TC-TOON-40 | positive | toon-encoder.test.cjs | P0 |
| FR-001 | AC-001-03 | TC-TOON-41 | positive | toon-encoder.test.cjs | P0 |
| FR-001 | AC-001-03 | TC-TOON-42 | positive | toon-encoder.test.cjs | P0 |
| FR-001 | AC-001-03 | TC-TOON-43 | positive | toon-encoder.test.cjs | P1 |
| FR-001 | AC-001-03 | TC-TOON-44 | positive | toon-encoder.test.cjs | P1 |
| FR-001 | AC-001-03 | TC-TOON-45 | positive | toon-encoder.test.cjs | P0 |
| FR-001 | AC-001-04 | CI Matrix | positive | CI: Node 20/22/24 | P0 |
| FR-001 | -- | TC-TOON-01 | positive | toon-encoder.test.cjs | P1 |
| FR-001 | -- | TC-TOON-02 | negative | toon-encoder.test.cjs | P0 |
| FR-001 | -- | TC-TOON-03 | negative | toon-encoder.test.cjs | P0 |
| FR-001 | -- | TC-TOON-04 | negative | toon-encoder.test.cjs | P0 |
| FR-001 | -- | TC-TOON-05 | negative | toon-encoder.test.cjs | P0 |
| FR-001 | -- | TC-TOON-06 | negative | toon-encoder.test.cjs | P1 |
| FR-001 | -- | TC-TOON-07 | positive | toon-encoder.test.cjs | P1 |
| FR-001 | -- | TC-TOON-22 | negative | toon-encoder.test.cjs | P0 |
| FR-001 | -- | TC-TOON-23 | negative | toon-encoder.test.cjs | P0 |
| FR-001 | -- | TC-TOON-24 | negative | toon-encoder.test.cjs | P1 |
| FR-002 | AC-002-02 | TC-BUILD-08 | positive | test-session-cache-builder.test.cjs | P0 |
| FR-002 | AC-002-02 | TC-BUILD-19 | positive | test-session-cache-builder.test.cjs | P0 |
| FR-002 | AC-002-02 | TC-BUILD-21 | positive | test-session-cache-builder.test.cjs | P1 |
| FR-004 | AC-004-01 | TC-TOON-48 | positive | toon-encoder.test.cjs | P0 |
| FR-004 | AC-004-02 | TC-TOON-50 | positive | toon-encoder.test.cjs | P0 |
| FR-004 | AC-004-03 | TC-BUILD-20 | negative | test-session-cache-builder.test.cjs | P0 |
| FR-004 | AC-004-04 | TC-BUILD-20 | negative | test-session-cache-builder.test.cjs | P0 |
| FR-004 | -- | TC-TOON-46 | negative | toon-encoder.test.cjs | P0 |
| FR-004 | -- | TC-TOON-47 | negative | toon-encoder.test.cjs | P0 |
| FR-004 | -- | TC-TOON-49 | negative | toon-encoder.test.cjs | P0 |
| FR-005 | AC-005-01 | TC-BUILD-19 | positive | test-session-cache-builder.test.cjs | P0 |
| FR-005 | AC-005-02 | TC-BUILD-19 | positive | test-session-cache-builder.test.cjs | P0 |
| FR-005 | AC-005-03 | TC-BUILD-20 | negative | test-session-cache-builder.test.cjs | P0 |

### 9.2 Orphan Test Analysis

All 47 test cases (44 in toon-encoder.test.cjs + 3 new in test-session-cache-builder.test.cjs) trace to at least one FR. There are **zero orphan tests**.

### 9.3 Orphan Requirement Analysis

All in-scope ACs have at least one test case mapped. Six ACs are deferred per ADRs and documented as such. There are **zero orphan in-scope requirements**.

---

## 10. Test File Specifications

### 10.1 New File: toon-encoder.test.cjs

**Location:** `src/claude/hooks/tests/toon-encoder.test.cjs`
**Framework:** `node:test` + `node:assert/strict` (CJS)
**Run command:** `node --test src/claude/hooks/tests/toon-encoder.test.cjs`
**Test count:** 44

**Structure:**
```
describe('toon-encoder')
  describe('isUniformArray()')     -- 7 tests (TC-TOON-01..07)
  describe('encode()')             -- 21 tests (TC-TOON-10..30)
  describe('decode()')             -- 11 tests (TC-TOON-40..50)
  describe('round-trip')           -- 5 tests (TC-TOON-60..64)
```

**Dependencies:**
- `require('../lib/toon-encoder.cjs')` -- module under test
- `require('node:test')` -- test framework
- `require('node:assert/strict')` -- assertions

Full test case implementations are specified in the module design document (Section 4.2).

### 10.2 Modified File: test-session-cache-builder.test.cjs

**Location:** `src/claude/hooks/tests/test-session-cache-builder.test.cjs`
**Changes:**
1. TC-BUILD-08: Change assertion from `section.includes('"ownership"')` to `section.includes('## ownership')`
2. TC-BUILD-19: New test -- validates TOON format in SKILLS_MANIFEST section
3. TC-BUILD-20: New test -- validates JSON fallback on encoding failure
4. TC-BUILD-21: New test -- validates default values for missing ownership fields

Full test case implementations are specified in the module design document (Sections 5.1-5.4).

---

## 11. Constitutional Compliance

### 11.1 Article II: Test-First Development

- COMPLIANT: All 47 test cases are designed in Phase 05, before implementation begins in Phase 06
- Tests use TDD approach: will be written first, then implementation code
- Test count will increase from 555 to >= 602, maintaining regression threshold
- Coverage targets: unit test coverage for toon-encoder.cjs will be 100% (all branches covered by 35 tests)

### 11.2 Article VII: Artifact Traceability

- COMPLIANT: Traceability matrix in Section 9 maps every in-scope AC to at least one test case
- 13 in-scope ACs all have test coverage
- 6 deferred ACs are documented with ADR references
- Zero orphan tests (all trace to requirements)
- Zero orphan requirements (all in-scope ACs covered)

### 11.3 Article IX: Quality Gate Integrity

- COMPLIANT: All required test strategy artifacts produced:
  - Test strategy document (this file)
  - Test case specifications (embedded in Sections 3, 10; full code in module design Section 4.2)
  - Traceability matrix (Section 9)
  - Coverage analysis (Section 8)
  - Test data plan (Section 4)
- GATE-05 checklist validated (Section 12)

### 11.4 Article XI: Integration Testing Integrity

- COMPLIANT: Integration tests (TC-BUILD-19, 20, 21) validate real component interaction between `toon-encoder.cjs` and `common.cjs` through `rebuildSessionCache()`
- Tests use `createFullTestProject()` to create real file system artifacts
- No mocking of `toon-encoder.cjs` in integration tests -- real encoder is used
- Mutation testing will be configured during Phase 16 (Quality Loop) per Article XI requirements

---

## 12. GATE-05 Test Strategy Validation Checklist

- [x] Test strategy covers unit, integration, E2E (N/A justified), security (N/A justified), performance
- [x] Test cases exist for all in-scope requirements (13/13 ACs covered by 47 test cases)
- [x] Traceability matrix complete (100% in-scope requirement coverage)
- [x] Coverage targets defined (100% unit for toon-encoder.cjs; >= 80% overall per Article II)
- [x] Test data strategy documented (boundary values, invalid inputs, maximum-size inputs)
- [x] Critical paths identified (encoding path, fallback path, decode path, decode fallback path)
- [x] Flaky test mitigation addressed (low risk; mitigations documented)
- [x] Performance test plan defined (NFR-003 benchmark approach)
- [x] Existing test infrastructure reused (same framework, conventions, helpers)
- [x] No orphan tests or orphan requirements
- [x] Deferred scope documented with ADR references (6 ACs across FR-002, FR-003)
- [x] Test file locations follow existing naming conventions

---

## 13. Positive vs Negative Test Distribution

| Category | Positive Tests | Negative Tests | Total |
|----------|---------------|----------------|-------|
| isUniformArray() | 2 | 5 | 7 |
| encode() | 17 | 4 | 21 |
| decode() | 6 | 5 | 11 |
| round-trip | 5 | 0 | 5 |
| Integration (BUILD) | 2 | 1 | 3 |
| **Total** | **32** | **15** | **47 mappings** |

Note: 47 unique test cases generate 53 traceability mappings because some tests cover multiple ACs.

Of the 47 unique test cases: 32 are positive and 15 are negative.

**Negative test ratio:** 15/47 = 32%. This meets the recommended minimum of 25% negative tests for a data transformation library.

---

## Appendix A: Deferred Requirements Reference

| AC ID | Deferred By | Rationale |
|-------|-------------|-----------|
| AC-002-01 | ADR-0040-02 | SKILL_INDEX already compact text format, not tabular JSON |
| AC-002-03 | ADR-0040-02 | ITERATION_REQUIREMENTS and WORKFLOW_CONFIG are deeply nested, non-tabular |
| AC-003-01 | ADR-0040-04 | No injection point exists for workflow_history into LLM context |
| AC-003-02 | ADR-0040-04 | No injection point exists for history/skill_usage_log into LLM context |
| AC-003-03 | ADR-0040-04 | Deferred with FR-003; state.json integrity preserved by design (no code touches it) |
| AC-003-04 | ADR-0040-04 | No injection point means no token measurement possible |

## Appendix B: Phase Timing Report

```json
{
  "debate_rounds_used": 0,
  "fan_out_chunks": 0
}
```
