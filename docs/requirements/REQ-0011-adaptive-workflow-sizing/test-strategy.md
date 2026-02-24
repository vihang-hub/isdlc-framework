# Test Strategy -- REQ-0011: Adaptive Workflow Sizing

**Version**: 1.0.0
**Phase**: 05-test-strategy
**Created**: 2026-02-12
**Traces to**: FR-01 through FR-07, NFR-01 through NFR-04

---

## 1. Existing Infrastructure

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 20+)
- **File Convention**: CJS tests in `src/claude/hooks/tests/*.test.cjs`
- **Shared Utilities**: `src/claude/hooks/tests/hook-test-utils.cjs` (setupTestEnv, cleanupTestEnv, writeState, readState, prepareHook, runHook)
- **Current Test Baseline**: 555 tests (302 ESM + 253 CJS)
- **Coverage Target (Article II)**: >= 80% unit, >= 70% integration, 100% critical paths
- **Existing Patterns**: Tests copy `common.cjs` to temp dir via `installCommonCjs()`, require with cache-clear via `requireCommon()` (see `test-common.test.cjs`)

## 2. Strategy for This Requirement

### 2.1 Approach

Extend the existing CJS test suite. All three new pure functions (`parseSizingFromImpactAnalysis`, `computeSizingRecommendation`, `applySizingDecision`) live in `common.cjs` and are testable via direct `require()` in an isolated temp directory -- matching the established pattern in `test-common.test.cjs`.

No new test framework, no new dependencies, no structural changes to the test harness.

### 2.2 Test File

**Primary test file**: `src/claude/hooks/tests/test-sizing.test.cjs`

This file covers all three exported functions plus integration scenarios. It follows the naming convention of existing files (e.g., `test-common.test.cjs`, `test-blast-radius-validator.test.cjs`).

**Run command**: `node --test src/claude/hooks/tests/test-sizing.test.cjs`

### 2.3 Test Types

| Test Type | Count | Coverage Area |
|-----------|-------|---------------|
| **Unit -- parseSizingFromImpactAnalysis** | 19 | JSON parsing, fallback regex, null/empty/malformed inputs, field validation |
| **Unit -- computeSizingRecommendation** | 16 | Threshold boundaries, risk overrides, null metrics, threshold sanitization |
| **Unit -- applySizingDecision** | 22 | Phase mutation (light), standard/epic records, invariant failures, rollback, invalid intensity |
| **Integration** | 8 | End-to-end flow: IA content -> parse -> compute -> apply |
| **Error Path** | 20 | All 20 error codes from error-taxonomy.md |
| **Total** | 85 | |

### 2.4 Coverage Targets

| Category | Target | Rationale |
|----------|--------|-----------|
| Line coverage (3 functions) | >= 95% | Pure functions with no I/O -- all branches reachable |
| Branch coverage | >= 90% | Decision tables fully enumerable |
| Error code coverage | 100% (20/20) | Every SZ-xxx code has at least one test that exercises its trigger condition |
| Acceptance criteria coverage | 100% (18/18 in-scope ACs) | Traceability matrix maps every AC to at least one TC |

AC-06 and AC-19 through AC-23 are out of scope (epic execution is future). AC-06 is tested at the recommendation level (epic returns `effective_intensity: 'standard'`).

---

## 3. Test Architecture

### 3.1 Setup and Teardown

```
before():
  1. Save process.env snapshot
  2. setupTestEnv() -- creates temp .isdlc/ directory
  3. installCommonCjs() -- copies common.cjs to temp/lib/
  4. requireCommon() -- loads module with cache clear

after():
  1. cleanupTestEnv() -- removes temp directory
  2. Restore process.env
```

Each `describe()` block may use `beforeEach()` to reset state objects when applySizingDecision tests mutate shared fixtures.

### 3.2 Test Data Strategy

Test data is organized into three categories per function:

- **Valid inputs**: Standard well-formed data that exercises the happy path
- **Boundary inputs**: Values at exact threshold boundaries (5/6 files, 20/21 files, empty string, etc.)
- **Invalid inputs**: Malformed JSON, missing fields, wrong types, null/undefined, negative numbers

See `test-data-plan.md` for complete data specifications.

### 3.3 Determinism Guarantee

All three functions are pure (no I/O, no randomness, no time-dependency except `applySizingDecision`'s `decided_at` timestamp). Tests that validate `decided_at` will use pattern matching (`/^\d{4}-\d{2}-\d{2}T/`) rather than exact timestamp comparison.

### 3.4 stderr Capture

`applySizingDecision` writes to `process.stderr` on error paths. Tests intercept stderr output by temporarily replacing `process.stderr.write` and restoring it in `afterEach()`.

---

## 4. Test Categories Detail

### 4.1 Unit Tests: parseSizingFromImpactAnalysis

| Category | Test Count | Covers |
|----------|-----------|--------|
| JSON metadata block parsing (primary) | 6 | Valid JSON, field extraction, multiple JSON blocks (last wins), extra fields ignored |
| Fallback regex parsing | 4 | All 5 fields matched, partial match (file_count + risk_score minimum), case insensitivity |
| Invalid/missing field normalization | 5 | Negative file_count, unrecognized risk_score, non-integer module_count, missing coverage_gaps |
| Null/empty/malformed inputs | 4 | Empty string, non-string input, no code blocks, random text |

**Key boundaries**:
- Empty string -> returns `null`
- JSON block with all invalid fields -> returns object with all defaults (0, 0, "medium", "medium", 0)
- Fallback requires at minimum `file_count` + `risk_score` to succeed

### 4.2 Unit Tests: computeSizingRecommendation

| Category | Test Count | Covers |
|----------|-----------|--------|
| Threshold boundary: light/standard | 4 | file_count=5 (light), file_count=6 (standard), custom thresholds |
| Threshold boundary: standard/epic | 4 | file_count=19 (standard), file_count=20 (epic), custom thresholds |
| Risk override | 3 | High risk + low files -> epic, high risk + medium files -> epic, medium risk + low files -> light |
| Null metrics fallback | 2 | null metrics, undefined metrics |
| Threshold sanitization | 3 | Invalid light_max, invalid epic_min, light_max >= epic_min |

**Key boundaries**:
- `file_count === light_max_files` -> light (inclusive, `<=`)
- `file_count === epic_min_files` -> epic (inclusive, `>=`)
- `file_count === light_max_files + 1` -> standard
- `file_count === epic_min_files - 1` -> standard

### 4.3 Unit Tests: applySizingDecision

| Category | Test Count | Covers |
|----------|-----------|--------|
| Light intensity: phase removal | 5 | Removes 03+04, updates phase_status, updates top-level phases, recalculates index, returns correct sizing record |
| Standard intensity: no changes | 3 | Phases unchanged, sizing record correct, standard rationale |
| Epic intensity: deferred | 3 | Phases unchanged, effective_intensity=standard, epic_deferred=true |
| Invariant failures + rollback | 4 | INV-01 (too few phases), INV-02 (index out of bounds), INV-03 (orphan status), INV-04 (next not pending) |
| Invalid intensity guard | 2 | Unknown string -> standard, non-string -> standard |
| No active_workflow guard | 2 | null state, state without active_workflow |
| Custom skip phases config | 2 | Custom light_skip_phases from sizingData.config, empty skip phases |
| Flag and override recording | 1 | forced_by_flag, overridden, overridden_to fields |

**Key areas**:
- Rollback restores exact snapshot (phases, phase_status, current_phase_index, top-level phases)
- `decided_at` is an ISO-8601 string
- `effective_intensity` differs from `intensity` only for epic
- `fallback_reason` is only set on invariant failure

### 4.4 Integration Tests

| Test | Description | Flow |
|------|-------------|------|
| INT-01 | Light workflow end-to-end | IA content (3 files, low risk) -> parse -> compute -> apply -> verify phases=[7], index=3 |
| INT-02 | Standard workflow end-to-end | IA content (12 files, medium risk) -> parse -> compute -> apply -> verify phases=[9], no changes |
| INT-03 | Epic workflow end-to-end | IA content (25 files, high risk) -> parse -> compute -> apply -> verify phases=[9], epic_deferred=true |
| INT-04 | Parsing failure cascades to standard | Malformed IA content -> parse returns null -> compute returns standard -> apply writes record |
| INT-05 | High risk overrides low file count | IA content (2 files, high risk) -> parse -> compute -> epic -> apply -> standard (deferred) |
| INT-06 | Custom thresholds light | IA content (8 files, low risk), thresholds {light_max: 10, epic_min: 30} -> light |
| INT-07 | Invariant failure cascades to standard | IA content (3 files, low risk) -> parse -> compute -> light -> apply on malformed state -> rollback to standard |
| INT-08 | Determinism: same input, same output | Run parse+compute twice with identical input -> assert identical output |

### 4.5 Error Path Tests

Every error code from `error-taxonomy.md` has a dedicated test:

| Error Code | Test Description |
|------------|-----------------|
| SZ-100 | IA file not found scenario (tested at integration level -- caller returns standard) |
| SZ-101 | Empty content string -> parseSizing returns null |
| SZ-102 | No JSON block -> proceeds to fallback (warning path, not failure) |
| SZ-103 | Malformed JSON block -> proceeds to fallback |
| SZ-104 | Both parsing strategies fail -> returns null |
| SZ-105 | files_directly_affected is negative float -> defaults to 0 |
| SZ-106 | modules_affected is string "abc" -> defaults to 0 |
| SZ-107 | risk_level is "critical" (not in enum) -> defaults to "medium" |
| SZ-108 | blast_radius is 42 (number, not string) -> defaults to "medium" |
| SZ-109 | coverage_gaps is -5 -> defaults to 0 |
| SZ-200 | No sizing config -> tested at STEP 3e level (integration) |
| SZ-201 | Sizing disabled -> tested at STEP 3e level (integration) |
| SZ-202 | light_max_files is -1 -> computeSizing defaults to 5 |
| SZ-203 | epic_min_files is 0 -> computeSizing defaults to 20 |
| SZ-204 | light_max_files=20, epic_min_files=5 -> both reset to defaults |
| SZ-205 | light_skip_phases is string (not array) -> defaults to ["03-architecture", "04-design"] |
| SZ-206 | Skip phase "99-nonexistent" -> filter is no-op, no error |
| SZ-300 | No active_workflow in state -> returns state unchanged |
| SZ-301 | After mutation, only 2 phases remain -> rollback to standard |
| SZ-302 | After mutation, index >= phases.length -> rollback to standard |
| SZ-303 | Orphan phase_status entry after mutation -> rollback to standard |
| SZ-304 | Next phase status is "completed" (not "pending") -> rollback to standard |
| SZ-305 | Invalid intensity "fast" -> defaults to standard |
| SZ-306 | Double sizing prevention (tested at STEP 3e level -- guard check) |

Note: SZ-400, SZ-401, SZ-402 are UX interaction errors that require `AskUserQuestion` mocking. These are covered by integration-level tests in the Phase-Loop Controller test suite, not by the pure function unit tests.

---

## 5. Test Commands

All tests use existing infrastructure:

```bash
# Run sizing tests only
node --test src/claude/hooks/tests/test-sizing.test.cjs

# Run all CJS hook tests (includes sizing)
npm run test:hooks

# Run all tests (ESM + CJS)
npm run test:all
```

---

## 6. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| `applySizingDecision` mutates state in place | State corruption if rollback fails | Tests verify snapshot-based rollback restores exact original state |
| Regex parsing is fragile | False positives/negatives on non-standard IA formats | Tests cover edge cases: multiple code blocks, extra whitespace, mixed case |
| Threshold boundary off-by-one | Wrong intensity classification | Explicit boundary tests at every threshold value (N, N+1, N-1) |
| `decided_at` timestamp non-deterministic | Flaky assertions | Pattern matching, not exact comparison |
| stderr output captures | Test isolation issues | Save/restore `process.stderr.write` in beforeEach/afterEach |

---

## 7. Traceability Summary

| Requirement | ACs | Test Count | Coverage |
|-------------|-----|-----------|----------|
| FR-01 (Sizing Decision Point) | AC-01, AC-02, AC-03 | 12 | 100% |
| FR-02 (Three Intensities) | AC-04, AC-05, AC-06, AC-07 | 18 | 100% |
| FR-03 (UX) | AC-08, AC-09, AC-10, AC-11 | 4 (via integration) | See note |
| FR-04 (-light Flag) | AC-12, AC-13, AC-14 | 3 | 100% |
| FR-05 (Phase Array Mod) | AC-15, AC-16, AC-17, AC-18 | 14 | 100% |
| FR-06 (Epic -- FUTURE) | AC-19-AC-23 | 0 | Out of scope |
| FR-07 (State Tracking) | AC-24, AC-25 | 8 | 100% |
| Error Taxonomy | SZ-100 through SZ-306 | 20+ | 100% |

**Note on FR-03 (UX)**: AC-08 (recommendation content), AC-09 (menu structure), AC-10 (override flow), and AC-11 (chosen intensity recording) are partially testable via pure function outputs (rationale string, sizing record fields). The interactive menu (`AskUserQuestion`) is a Phase-Loop Controller concern tested at the isdlc.md integration level, not in the pure function suite.

---

## 8. Constitutional Compliance

| Article | How This Strategy Complies |
|---------|---------------------------|
| Article II (Test-First Development) | Tests designed before implementation; all ACs mapped to test cases |
| Article VII (Artifact Traceability) | Traceability matrix links every AC to specific TC-IDs |
| Article IX (Quality Gate Integrity) | Gate-05 checklist validates all artifacts before phase completion |
| Article XI (Integration Testing Integrity) | 8 integration tests validate component interaction across all 3 functions |
