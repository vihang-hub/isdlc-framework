# Test Strategy: REQ-0041 TOON Full Spec Session Cache Reduction

| Field | Value |
|-------|-------|
| **Status** | Complete |
| **Phase** | 05 - Test Strategy |
| **Last Updated** | 2026-02-26 |
| **Coverage** | Unit, Integration, Performance, Security, Backward Compatibility |

---

## 1. Existing Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` + `node:assert/strict` |
| **Module System** | CommonJS (`.test.cjs` files in `src/claude/hooks/tests/`) |
| **Existing Tests** | 47 tests in `toon-encoder.test.cjs` covering `encode()`, `decode()`, `isUniformArray()`, round-trip |
| **Test Utilities** | `hook-test-utils.cjs` (`setupTestEnv`, `runHook`, `prepareHook`) |
| **Test Isolation** | Copy source to temp directory, `require()` from temp, cleanup after |
| **Coverage Tool** | None project-wide; manual coverage via test case traceability |
| **Run Commands** | `node --test src/claude/hooks/tests/toon-encoder.test.cjs` (individual), `npm run test:hooks` (all CJS) |

### Existing Patterns to Follow

- Test files are named `{module}.test.cjs` in `src/claude/hooks/tests/`
- Tests use `describe/it` pattern with `before/after` for module loading/cleanup
- Test case IDs use `TC-{PREFIX}-{NN}` format (e.g., `TC-ENC-01`, `TC-DEC-01`)
- Source files are copied to `os.tmpdir()` for isolation
- `require.cache` is cleared before loading from temp to avoid stale modules

### Approach: Extend Existing Test Suite

This strategy extends the existing `toon-encoder.test.cjs` file with new test suites for `encodeValue()`, `decodeValue()`, and cache integration. No new test frameworks or tools are introduced. All new tests follow the established naming, structure, and isolation conventions.

---

## 2. Test Pyramid

### Layer 1: Unit Tests (Primary Focus)

**Target**: 80%+ of test effort. All encoding/decoding logic in `toon-encoder.cjs`.

| Suite | Test Count | Purpose |
|-------|-----------|---------|
| `encodeValue()` type dispatch | 8 | Validate correct encoding for each input type |
| `encodeValue()` nested objects | 8 | Validate indentation-based nesting |
| `encodeValue()` key-value pairs | 6 | Validate bare keys, value quoting rules |
| `encodeValue()` inline primitive arrays | 7 | Validate `key[N]: v1,v2,...` format |
| `encodeValue()` mixed/list arrays | 5 | Validate `- ` prefix list form |
| `encodeValue()` tabular delegation | 3 | Validate `isUniformArray()` dispatch to `encode()` |
| `encodeValue()` key stripping | 4 | Validate `stripKeys` option at all depths |
| `encodeValue()` options handling | 3 | Validate `indent` and default options |
| `isPrimitiveArray()` | 6 | Validate type detection helper |
| `decodeValue()` primitives | 5 | Validate primitive value reconstruction |
| `decodeValue()` objects | 5 | Validate indentation-based object parsing |
| `decodeValue()` inline arrays | 4 | Validate `key[N]: v1,v2,...` parsing |
| `decodeValue()` list arrays | 4 | Validate `- ` prefix parsing |
| `decodeValue()` error handling | 4 | Validate JSON fallback and SyntaxError |
| Round-trip `encodeValue`/`decodeValue` | 8 | Validate encode-then-decode fidelity |
| **Total unit tests** | **~80** | |

### Layer 2: Integration Tests

**Target**: Validate `rebuildSessionCache()` integration with TOON encoding.

| Suite | Test Count | Purpose |
|-------|-----------|---------|
| Cache builder TOON integration | 6 | Validate all 4 JSON sections use `encodeValue()` |
| Fail-open fallback | 3 | Validate JSON fallback per section on error |
| `[TOON]` marker presence | 2 | Validate section markers in output |
| Verbose statistics output | 2 | Validate stderr reporting |
| **Total integration tests** | **~13** | |

### Layer 3: Backward Compatibility Tests

**Target**: Verify zero regression in existing functionality.

| Suite | Test Count | Purpose |
|-------|-----------|---------|
| Existing 47 tests pass unchanged | 47 | All `isUniformArray()`, `encode()`, `decode()`, round-trip tests |
| Module exports verification | 2 | All existing exports present, new exports added |
| **Total backward compat tests** | **~49** | |

### Test Pyramid Summary

```
         /\
        /  \  Performance (3 tests)
       /    \  -- Cache rebuild time, encoding throughput
      /------\
     /        \  Integration (13 tests)
    /          \  -- Cache builder, fail-open, markers
   /------------\
  /              \  Unit (80 tests)
 /                \  -- encodeValue, decodeValue, isPrimitiveArray
/------------------\
   Backward Compat (49 tests)
   -- All existing tests pass, exports verified
```

---

## 3. Test Case Design Principles

### Positive Tests

For each functional requirement, test the happy path with valid inputs that exercise the documented behavior. Each acceptance criterion maps to at least one positive test case.

### Negative Tests

For each functional requirement, test error paths, edge cases, and invalid inputs:
- `encodeValue()` with `undefined`, `null`, empty objects, empty arrays
- `decodeValue()` with malformed TOON, mixed indentation, invalid headers
- Cache builder with missing source files, corrupted JSON, encoder exceptions

### Boundary Value Analysis

- Empty string values, empty arrays, empty objects
- Single-element arrays (primitive and object)
- Maximum nesting depth (7 levels matching real cache data)
- Keys with special characters (colon, spaces, hyphens)
- Values with all special character types (comma, quote, newline, backslash)

### Real Data Testing

Use extracted data from actual cache source files:
- `skills-manifest.json` (deeply nested with skill_lookup map)
- `iteration-requirements.json` (7 levels deep, `_comment` keys)
- `workflows.json` (nested config with inline arrays)
- `artifact-paths.json` (3 levels, path arrays)

---

## 4. Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Line coverage (new code) | >=80% | Constitutional Article II threshold |
| Branch coverage (new code) | >=75% | Ensure all type dispatch paths exercised |
| Requirement coverage | 100% | Every FR/AC has at least one test (Article VII) |
| Negative test ratio | >=30% | Ensure error paths are validated |
| Round-trip coverage | 100% of encoding formats | Every TOON format has encode-decode round-trip |

---

## 5. Flaky Test Mitigation

| Risk | Mitigation |
|------|------------|
| Test isolation failure (shared require cache) | Clear `require.cache` before each `describe()` block via `before()` hook |
| Temp directory cleanup race | Use unique `mkdtempSync()` prefix per suite; `after()` cleanup with `force: true` |
| Platform-specific path separators | All test paths use `path.join()` -- no hardcoded separators |
| Test order dependency | Each `describe()` block has independent `loadModule()`/`cleanupModule()` lifecycle |
| Real file system state leakage | Tests read JSON fixtures from strings (not from actual config files); integration tests copy source files to temp |

---

## 6. Performance Test Plan

### P-001: Cache Rebuild Time

**Objective**: Verify that TOON encoding does not regress cache rebuild time by more than 100ms.

**Method**:
1. Run `rebuildSessionCache()` with TOON encoding disabled (baseline)
2. Run `rebuildSessionCache()` with TOON encoding enabled
3. Compare wall-clock time

**Threshold**: Additional encoding time < 100ms (per QA-003 in requirements).

### P-002: Encoding Throughput

**Objective**: Verify `encodeValue()` performance on representative cache data.

**Method**:
1. Load each of the 4 JSON source files
2. Time 100 iterations of `encodeValue()` for each
3. Report average encoding time per section

**Threshold**: < 10ms per section per encoding pass.

### P-003: Character Reduction Validation

**Objective**: Verify the 25-33% character reduction target for JSON sections.

**Method**:
1. For each JSON section, compute `JSON.stringify(data, null, 2).length`
2. Compute `encodeValue(data, { stripKeys: ['_comment'] }).length`
3. Calculate reduction percentage

**Threshold**: Combined reduction >= 25% across all four JSON sections.

---

## 7. Security Considerations

This feature operates on static JSON configuration files and produces text output for LLM context injection. The security surface is minimal.

| Concern | Assessment | Mitigation |
|---------|-----------|------------|
| Input validation | Low risk -- inputs are static JSON files committed to repo | `encodeValue()` handles all JS types gracefully |
| Path traversal | Not applicable -- no user-supplied paths in encoder | Cache builder uses `path.join()` from project root |
| Denial of service | Very low -- MAX_ROWS guard on tabular encoding; recursion bounded by real data depth | Max-depth guard in `encodeValue()` (optional, default 20) |
| Information disclosure | Not applicable -- no secrets in configuration files | `_comment` keys stripped (reduces noise, not secrets) |

No dedicated security test suite is needed. Security is validated through:
- Input validation unit tests (type dispatch handles all types)
- Error handling tests (fail-open behavior)
- Backward compatibility tests (existing security properties preserved)

---

## 8. Test Data Strategy

### 8.1 Synthetic Test Data

Constructed in-test for precise control over edge cases:
- Primitives: `null`, `undefined`, `true`, `false`, `0`, `-1`, `3.14`, `""`, `"simple"`, `"a,b"`, `"say \"hi\""`, `"line1\nline2"`, `"path\\to\\file"`
- Objects: empty `{}`, flat `{a:1}`, nested 2/3/7 levels deep
- Arrays: empty `[]`, single-element, primitive-only, object-only, mixed

### 8.2 Real Cache Data (Extracted Fixtures)

For integration and round-trip tests, extract representative subsets from actual source files:
- `skills-manifest.json` -- top-level structure with `ownership` and `skill_lookup` maps
- `iteration-requirements.json` -- deeply nested with `_comment` keys
- `workflows.json` -- nested config with inline arrays (`phases`)
- `artifact-paths.json` -- 3-level structure with path arrays

These are embedded as JS objects in the test file (not read from filesystem) to ensure test determinism.

### 8.3 Boundary Test Data

See test-data-plan.md for comprehensive boundary value catalog.

---

## 9. Test Execution

### Commands

| Scope | Command |
|-------|---------|
| TOON encoder tests only | `node --test src/claude/hooks/tests/toon-encoder.test.cjs` |
| All CJS hook tests | `npm run test:hooks` |
| All tests (ESM + CJS) | `npm run test:all` |

### Pass Criteria

1. All 47 existing tests pass (zero regression)
2. All new tests pass (zero failures)
3. Every functional requirement has at least one passing test
4. Every acceptance criterion is traced to at least one test in the traceability matrix
5. Round-trip tests pass for all encoding formats
6. Performance thresholds met (< 100ms additional rebuild time)

### Failure Handling

- Any test failure blocks GATE-05 advancement
- Failures in existing tests indicate backward compatibility regression -- investigate immediately
- Failures in new tests indicate implementation gaps -- fix in Phase 06

---

## 10. Traceability

The traceability matrix (`traceability-matrix.csv`) maps every requirement (FR-001 through FR-010) and every acceptance criterion (AC-001-01 through AC-010-02) to specific test cases. Coverage target: 100% of requirements traced to tests.

See `traceability-matrix.csv` in this artifact folder for the complete mapping.

---

## 11. Test File Organization

All new tests are added to the existing file:

```
src/claude/hooks/tests/toon-encoder.test.cjs
  -- Existing suites (47 tests, unchanged):
     describe('isUniformArray()')     -- 7 tests (TC-UNI-01..07)
     describe('encode()')             -- 21 tests (TC-ENC-01..21)
     describe('decode()')             -- 11 tests (TC-DEC-01..11)
     describe('Round-trip encode/decode') -- 5 tests (TC-RT-01..05)
     describe('splitRow()')           -- 3 tests (TC-SR-01..03) [if exists]

  -- New suites (REQ-0041):
     describe('isPrimitiveArray()')       -- 6 tests (TC-IPA-01..06)
     describe('encodeValue()')            -- 44 tests (TC-EV-01..44)
     describe('decodeValue()')            -- 18 tests (TC-DV-01..18)
     describe('Round-trip encodeValue/decodeValue') -- 8 tests (TC-EVRT-01..08)
     describe('Module exports')           -- 2 tests (TC-MOD-01..02)
     describe('Cache integration')        -- 13 tests (TC-CI-01..13)
     describe('Performance')              -- 3 tests (TC-PERF-01..03)
```

---

## 12. Constitutional Compliance

| Article | Requirement | How Satisfied |
|---------|------------|---------------|
| **II (Test-First)** | Tests designed before implementation | This test strategy and all test cases are designed in Phase 05, before Phase 06 implementation |
| **VII (Traceability)** | 100% requirement coverage | Traceability matrix maps every FR/AC to test cases |
| **IX (Quality Gate)** | All artifacts complete and validated | test-strategy.md, test-cases.md, traceability-matrix.csv, test-data-plan.md all produced |
| **XI (Integration Testing)** | Integration tests validate component interactions | Cache builder integration tests validate `rebuildSessionCache()` with `encodeValue()` end-to-end |
