# Test Strategy: Three-Verb Backlog Model (REQ-0023)

**Phase**: 05-test-strategy
**Version**: 1.0
**Created**: 2026-02-18
**Feature**: Three-verb backlog model (add/analyze/build) -- unify backlog management around three natural verbs, eliminate Phase A/B naming, redesign command surface and intent detection (GH #19)
**Traces to**: FR-001 through FR-009, NFR-001 through NFR-006

---

## Existing Infrastructure (from project discovery)

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Coverage Tool**: c8 / Node.js built-in coverage
- **Current Baseline**: 555+ tests (302 ESM + 253 CJS per constitution)
- **Existing Patterns**: CJS hooks tested via `hook-test-utils.cjs` (setupTestEnv, cleanupTestEnv, prepareHook, runHook); ESM lib tested via `lib/utils/test-helpers.js`
- **Existing Tests for Affected Hooks**:
  - `test-skill-delegation-enforcer.test.cjs` -- 11 tests covering BUG-0021 EXEMPT_ACTIONS for `analyze`
  - `test-delegation-gate.test.cjs` -- 13 tests covering BUG-0021 EXEMPT_ACTIONS defense-in-depth for `analyze`
- **Coverage Gap**: `add` action not yet covered in EXEMPT_ACTIONS. `build` action not verified as non-exempt. No tests exist for meta.json migration, BACKLOG.md marker parsing, slug generation, source detection, or item resolution.

## Strategy for This Requirement

- **Approach**: Extend existing CJS test suites for hooks. Create a new standalone test file for utility functions (meta.json, BACKLOG.md markers, slug generation, source detection, item resolution) that will be implemented as inline logic in isdlc.md but extracted to a testable helper module.
- **New Test Types Needed**: Unit tests for 8 utility functions, regression tests for hook EXEMPT_ACTIONS changes, negative tests for all 28 error codes, boundary value tests for slug/marker/resolution edge cases.
- **Coverage Target**: >=80% statement coverage on all new/modified code. 100% coverage on critical paths (hook exemption logic, meta.json migration, marker state transitions).

## Test Commands (use existing)

- Unit (CJS): `npm run test:hooks`
- All tests: `npm run test:all`
- Delegation enforcer: `node --test src/claude/hooks/tests/test-skill-delegation-enforcer.test.cjs`
- Delegation gate: `node --test src/claude/hooks/tests/test-delegation-gate.test.cjs`
- Three-verb utilities: `node --test src/claude/hooks/tests/test-three-verb-utils.test.cjs`

---

## Test Pyramid

### Unit Tests (70% of effort)

Unit tests form the foundation. Each utility function gets isolated tests with mocked filesystem and state.

| Test Area | New Tests | File | Traces |
|-----------|-----------|------|--------|
| `generateSlug()` | 12 | test-three-verb-utils.test.cjs | FR-001, VR-SLUG-001..004 |
| `deriveAnalysisStatus()` | 5 | test-three-verb-utils.test.cjs | FR-009, VR-PHASE-003 |
| `deriveBacklogMarker()` | 5 | test-three-verb-utils.test.cjs | FR-007, AC-007-01..03 |
| `readMetaJson()` (legacy migration) | 10 | test-three-verb-utils.test.cjs | FR-009, AC-009-01..05 |
| `writeMetaJson()` | 6 | test-three-verb-utils.test.cjs | FR-009, AC-009-01..02 |
| Source detection | 6 | test-three-verb-utils.test.cjs | FR-001, VR-SOURCE-001..003 |
| BACKLOG marker regex parsing | 8 | test-three-verb-utils.test.cjs | FR-007, VR-MARKER-001..004 |
| `updateBacklogMarker()` | 8 | test-three-verb-utils.test.cjs | FR-007, AC-007-01..06 |
| `appendToBacklog()` | 6 | test-three-verb-utils.test.cjs | FR-001, AC-001-04 |
| `resolveItem()` priority chain | 12 | test-three-verb-utils.test.cjs | ADR-0015, VR-RESOLVE-001..006 |
| Hook EXEMPT_ACTIONS (enforcer) | 3 new | test-skill-delegation-enforcer.test.cjs | FR-008, AC-008-01..02 |
| Hook EXEMPT_ACTIONS (gate) | 3 new | test-delegation-gate.test.cjs | FR-008, AC-008-01..02 |
| Error codes | 28 | test-three-verb-utils.test.cjs | Error taxonomy (all 28 codes) |

**Total new unit tests: ~112**

### Integration Tests (20% of effort)

Integration tests validate cross-function data flows: add -> marker update -> meta.json write, or analyze -> resume -> marker progression.

| Test Area | Tests | File | Traces |
|-----------|-------|------|--------|
| Add flow: source detect -> slug -> meta.json write -> BACKLOG append | 4 | test-three-verb-utils.test.cjs | FR-001, US-001 |
| Analyze flow: resolve item -> read meta -> derive next phase -> update marker | 3 | test-three-verb-utils.test.cjs | FR-002, US-003 |
| Resume analysis: partial meta -> next phase detection -> marker update | 3 | test-three-verb-utils.test.cjs | FR-002, AC-002-04 |
| Legacy migration flow: v1 meta -> read -> migrate -> write v2 | 2 | test-three-verb-utils.test.cjs | FR-009, ADR-0013 |
| Marker progression: raw -> partial -> analyzed -> completed | 2 | test-three-verb-utils.test.cjs | FR-007, VR-MARKER-003 |
| Hook cross-validation: enforcer exempts add, gate auto-clears add | 2 | test-delegation-gate.test.cjs | FR-008, AC-008-01 |

**Total new integration tests: ~16**

### Regression Tests (10% of effort)

All existing tests must continue to pass. These are not new tests but are validated as part of the test run.

| Area | Existing Tests | File |
|------|---------------|------|
| skill-delegation-enforcer existing behavior | 11 | test-skill-delegation-enforcer.test.cjs |
| delegation-gate existing behavior | 13 | test-delegation-gate.test.cjs |
| All other hook tests | 229+ | Various test-*.test.cjs files |
| ESM lib tests | 302 | lib/*.test.js |

---

## Flaky Test Mitigation

1. **Filesystem isolation**: All tests use `setupTestEnv()` which creates a unique temp directory via `fs.mkdtempSync()`. Each test operates on its own isolated directory. Cleanup via `cleanupTestEnv()` in `afterEach()`.

2. **No shared mutable state**: Utility functions under test are pure functions or use injected paths. No global singletons, no module-level caches.

3. **No network calls**: All tests are filesystem-only. No HTTP, no MCP, no git commands. Source detection tests validate regex patterns only (no actual Jira/GitHub API calls).

4. **Deterministic markers**: BACKLOG.md test fixtures use hardcoded content strings. No timestamps, no random values in marker tests.

5. **Process isolation for hooks**: Hook tests spawn child processes via `runHook()` with isolated `CLAUDE_PROJECT_DIR`. Each hook invocation starts fresh with no process-level state leakage.

6. **Timeout guards**: All hook spawns use `HOOK_TIMEOUT_MS` (10s) to prevent hanging tests. Utility function tests have no async operations (synchronous fs operations only).

---

## Performance Test Plan

### NFR-004: Performance Targets

| Operation | Target | Test Method |
|-----------|--------|-------------|
| `add` verb completion | < 5 seconds | Time the full add flow (slug generation + meta.json write + BACKLOG append) in a test. Assert elapsed < 5000ms. |
| `analyze` phase transition | < 2 seconds | Time the overhead between phases (meta.json read/write + marker update + status derivation). Assert elapsed < 2000ms. |
| `generateSlug()` | < 10ms | Benchmark with 100 iterations. Assert average < 10ms. |
| `readMetaJson()` with legacy migration | < 50ms | Benchmark with migration path. Assert < 50ms. |
| BACKLOG.md marker update on 500-item file | < 500ms | Create a 500-line BACKLOG fixture, time marker update. Assert < 500ms. |

### NFR-005: Cross-Platform

BACKLOG.md tests include fixtures with both LF and CRLF line endings to validate cross-platform parsing (VR-CRLF-001, VR-CRLF-002).

---

## Security Testing

Since this feature involves filesystem operations (reading/writing meta.json, BACKLOG.md, draft.md), security tests focus on path traversal prevention:

| Test | Description | Traces |
|------|-------------|--------|
| Slug with path traversal | `generateSlug("../../etc/passwd")` produces safe slug without directory traversal | VR-SLUG-001 |
| meta.json path injection | `readMetaJson()` with path containing `..` does not escape the docs/requirements/ directory | FR-009 |
| BACKLOG.md content injection | Marker update with malicious description text does not corrupt file structure | FR-007 |

---

## Test Data Strategy

Detailed in the companion document `test-data-plan.md`. Summary:

- **Valid inputs**: Standard descriptions, GitHub refs (#42), Jira refs (PROJ-123), slugs
- **Invalid inputs**: Empty strings, whitespace-only, excessively long strings, special characters, path traversal attempts
- **Boundary values**: Slug at exactly 50 chars, slug at 51 chars (truncation), empty slug after sanitization, zero phases completed, all 5 phases completed
- **Legacy data**: meta.json v1 with `phase_a_completed: true`, `false`, missing field, corrupted JSON
- **BACKLOG.md fixtures**: Files with all 4 marker types, mixed markers, hand-edited markers, CRLF line endings, no Open section, empty file

---

## Coverage Targets

| Module | Target | Rationale |
|--------|--------|-----------|
| Hook EXEMPT_ACTIONS (enforcer + gate) | 100% branch | Critical enforcement path. False blocks or missed exemptions break developer experience. |
| meta.json read-time migration | 100% branch | Data migration correctness. Wrong migration corrupts analysis state. |
| BACKLOG.md marker parsing | 100% line | New functionality with no existing coverage. All 4 marker states must be validated. |
| Slug generation | 100% branch | Input sanitization. Edge cases in slug generation can cause directory collisions or empty slugs. |
| Source detection | 100% branch | Correct source_id format is critical for external reference lookups. |
| Item resolution | 90% branch | Priority chain has 5 strategies. Each must be individually validated. Fuzzy match may have unavoidable edge cases. |
| Error handling (28 codes) | 100% code mapping | Every error code must have at least one test triggering it. |

---

## Test File Organization

```
src/claude/hooks/tests/
  test-skill-delegation-enforcer.test.cjs   # EXISTING + 3 new tests
  test-delegation-gate.test.cjs             # EXISTING + 3 new tests
  test-three-verb-utils.test.cjs            # NEW -- all utility function tests
```

### Why a Separate Utility Test File

The 8 utility functions (generateSlug, readMetaJson, writeMetaJson, resolveItem, updateBacklogMarker, appendToBacklog, deriveAnalysisStatus, deriveBacklogMarker) will be implemented as inline logic within `isdlc.md`. Since isdlc.md is a markdown command file (not importable), these functions must be extracted to a testable CommonJS module for unit testing:

```
src/claude/hooks/lib/three-verb-utils.cjs   # Extracted utility functions
src/claude/hooks/tests/test-three-verb-utils.test.cjs  # Tests
```

This follows the existing pattern where `common.cjs` provides shared utilities that are both used by hooks and tested independently.

---

## Traceability Summary

| Requirement | Test Count | Coverage |
|-------------|-----------|----------|
| FR-001 (Add verb) | 24 | AC-001-01 through AC-001-07 |
| FR-002 (Analyze verb) | 15 | AC-002-01 through AC-002-09 |
| FR-003 (Build verb) | 8 | AC-003-01 through AC-003-07 |
| FR-004 (Intent detection) | 0 (prompt-level, not testable as code) | AC-004-01 through AC-004-08 documented in test-cases.md |
| FR-005 (Command surface) | 0 (markdown spec, not testable as code) | AC-005-01 through AC-005-08 documented in test-cases.md |
| FR-006 (Orchestrator) | 0 (markdown spec, not testable as code) | AC-006-01 through AC-006-05 documented in test-cases.md |
| FR-007 (BACKLOG markers) | 21 | AC-007-01 through AC-007-06 |
| FR-008 (Hook updates) | 6 new + 24 existing regression | AC-008-01 through AC-008-04 |
| FR-009 (meta.json schema) | 21 | AC-009-01 through AC-009-05 |
| NFR-001 (Backward compat) | All existing tests (regression) | Pass/fail gate |
| NFR-002 (Zero state corruption) | 3 | Covered in add/analyze tests |
| NFR-005 (Cross-platform) | 2 | CRLF tests |
| Error taxonomy | 28 | All 28 error codes |
| **TOTAL NEW** | **~128** | |
