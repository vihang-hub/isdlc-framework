# Test Strategy: Custom Skill Management (REQ-0022)

**Phase**: 05-test-strategy
**Version**: 1.0
**Created**: 2026-02-18
**Feature**: Custom skill management -- add, wire, and inject user-provided skills into workflows (GH-14)
**Traces to**: FR-001 through FR-009, NFR-001 through NFR-006

---

## Existing Infrastructure (from project discovery)

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Coverage Tool**: c8 / Node.js built-in coverage
- **Current Baseline**: 555+ tests (302 ESM + 253 CJS per constitution)
- **Existing Patterns**: CJS hooks tested via `hook-test-utils.cjs` (setupTestEnv, cleanupTestEnv, prepareHook, runHook); ESM lib tested via `lib/utils/test-helpers.js`
- **Existing Test for Related Area**: `skill-injection.test.cjs` -- tests `getAgentSkillIndex()`, `formatSkillIndexBlock()`, caching, and fail-open resilience (51 tests across TC-01 through TC-09)
- **Coverage Gap**: `resolveExternalSkillsPath()`, `resolveExternalManifestPath()`, `loadExternalManifest()` have **0% test coverage** (identified in impact analysis)

## Strategy for This Requirement

- **Approach**: Extend existing CJS test suite. New test file `external-skill-management.test.cjs` in `src/claude/hooks/tests/` alongside existing test files.
- **New Test Types Needed**: Unit tests for 6 new utility functions + 3 existing untested functions, integration tests for cross-function data flows, security tests for path traversal prevention.
- **Coverage Target**: >=80% unit test coverage on all new functions (per Article II). 100% coverage on critical paths (validation, fail-open injection, manifest I/O).

## Test Commands (use existing)

- Unit (CJS): `npm run test:hooks`
- All tests: `npm run test:all`
- Single file: `node --test src/claude/hooks/tests/external-skill-management.test.cjs`

---

## Test Pyramid

### Level 1: Unit Tests (Primary -- 80% of test effort)

All 6 new utility functions in `common.cjs` are pure or near-pure functions suitable for direct unit testing. These form the foundation of the test pyramid.

| Function | Test Count (est.) | Priority | Rationale |
|----------|------------------|----------|-----------|
| `validateSkillFrontmatter()` | 18 | P0 | Gate-keeper for skill acquisition; validates all user input |
| `analyzeSkillContent()` | 12 | P1 | Content analysis accuracy drives smart binding quality |
| `suggestBindings()` | 10 | P1 | Maps analysis to actionable binding suggestions |
| `writeExternalManifest()` | 10 | P0 | Only I/O function; integrity of manifest data |
| `formatSkillInjectionBlock()` | 8 | P0 | Runtime injection format correctness |
| `removeSkillFromManifest()` | 6 | P2 | Pure function on manifest object |
| Existing functions (coverage gap) | 6 | P0 | `resolveExternalSkillsPath`, `resolveExternalManifestPath`, `loadExternalManifest` |

**Total estimated unit tests: ~70**

### Level 2: Integration Tests (15% of test effort)

Cross-function flows that validate the end-to-end data pipeline within `common.cjs`:

| Flow | Test Count (est.) | Priority |
|------|------------------|----------|
| validate -> analyze -> suggest -> write (skill add pipeline) | 4 | P0 |
| loadExternalManifest -> formatSkillInjectionBlock (runtime injection pipeline) | 4 | P0 |
| removeSkillFromManifest -> writeExternalManifest (skill removal pipeline) | 3 | P1 |
| Monorepo path resolution for all operations | 3 | P1 |

**Total estimated integration tests: ~14**

### Level 3: Behavioral/Structural Tests (5% of test effort)

Tests that validate structural expectations in non-unit-testable artifacts (markdown files, JSON configs):

| Target | Test Count (est.) | Priority |
|--------|------------------|----------|
| `isdlc.md` contains EXTERNAL SKILL INJECTION section | 2 | P1 |
| `skills-manifest.json` contains skill-manager agent entry (post-implementation) | 1 | P2 |
| `CLAUDE.md` contains skill management intent row (post-implementation) | 1 | P2 |
| Manifest JSON schema validation | 2 | P1 |

**Total estimated behavioral tests: ~6**

### Grand Total: ~90 tests

---

## Flaky Test Mitigation

### Filesystem Isolation

All tests use `fs.mkdtempSync()` to create isolated temporary directories. This follows the established pattern in `hook-test-utils.cjs`. Each test group creates its own temp directory and cleans it up in `afterEach()` or `after()`.

### Module Cache Management

Since `common.cjs` is CommonJS with module-level state, tests must clear `require.cache` and call `_resetCaches()` between test groups (when available). This pattern is established in `skill-injection.test.cjs` via the `loadCommon()` helper.

### Timing Sensitivity

Performance tests (NFR-001: <100ms injection) use `process.hrtime.bigint()` with generous margins (2x) to avoid flakiness on slow CI runners. These tests are informational -- they log warnings but do not hard-fail on marginal violations.

### No External Dependencies

All tests are self-contained. No network calls, no database, no external services. Test data is generated in-process using fixture factories.

---

## Performance Test Plan

### NFR-001: Injection Latency (<100ms)

- **Test**: Time the full injection pipeline: `loadExternalManifest()` + filter + `formatSkillInjectionBlock()` for 1, 5, 10, and 50 skills
- **Measurement**: `process.hrtime.bigint()` wall-clock time
- **Threshold**: <100ms for typical case (1-5 skills), <500ms for maximum case (50 skills per NFR-002)
- **Implementation**: Unit test in `external-skill-management.test.cjs`, TC-PERF group

### NFR-002: Manifest Size Limit (50 skills)

- **Test**: Generate a manifest with 50 skill entries, measure parse + filter time
- **Threshold**: <500ms total (manifest parse + 50 file reads simulated)
- **Implementation**: Unit test generating large manifest fixture

### Performance Testing Approach

Performance tests run as part of the standard test suite but use soft assertions (log warnings instead of hard failures) to avoid CI flakiness. Hard performance regression detection is deferred to the quality loop phase (Phase 16).

---

## Security Test Plan

### Path Traversal Prevention (Security T1)

- **Test**: Attempt to register skill files with names containing `/`, `\`, `..`, and null bytes
- **Expected**: All rejected by validation rules (PS-001 through PS-003)
- **Implementation**: Negative test cases in `validateSkillFrontmatter()` unit tests

### Content Size Limiting (Security T3)

- **Test**: Skill content with >10,000 chars triggers truncation and reference delivery switch
- **Expected**: Content truncated with `[TRUNCATED]` notice
- **Implementation**: Unit test for injection pipeline with oversized content

### Manifest Integrity (Security T6)

- **Test**: `writeExternalManifest()` re-reads and validates JSON after write
- **Expected**: Returns `{ success: false }` if validation fails after write
- **Implementation**: Unit test with corrupted write scenario

---

## Test Data Strategy

See `docs/common/test-data-plan.md` for detailed fixture definitions.

Summary:
- **Valid skill files**: Well-formed `.md` files with complete YAML frontmatter
- **Invalid skill files**: Missing fields, bad format, wrong extensions, empty files
- **Boundary inputs**: Max-length names (100 chars), max-length descriptions (500 chars), content at 10,000 char threshold
- **Manifest fixtures**: Empty manifest, single-skill, multi-skill, 50-skill (max), corrupt JSON
- **Keyword fixtures**: Content with known keyword matches for each of the 7 categories

---

## Test File Organization

```
src/claude/hooks/tests/
  external-skill-management.test.cjs    # NEW: All unit + integration tests for REQ-0022
  hook-test-utils.cjs                   # EXISTING: Shared test utilities (reused)
  skill-injection.test.cjs              # EXISTING: Tests for getAgentSkillIndex/formatSkillIndexBlock
```

### Why a Single Test File

The 6 new functions are all in `common.cjs` and share the same test setup (temp directory, module cache reset, fixture factories). Grouping them in one file provides:
- Shared fixture factories (no duplication)
- Shared `loadCommon()` helper (consistent cache management)
- Clear traceability (one file maps to one feature: REQ-0022)
- Consistent with project convention (`skill-injection.test.cjs` covers multiple related functions)

---

## Critical Paths (100% coverage required)

1. **validateSkillFrontmatter()**: Every validation check (V-001 through V-006) must have positive and negative test
2. **writeExternalManifest()**: Create, update, and integrity verification paths
3. **Fail-open behavior**: Every warning path (SKL-W001 through SKL-W007) must prove workflow continuity
4. **Path traversal prevention**: All forbidden character patterns (PS-001 through PS-003)
5. **Backward compatibility**: Entries without bindings must be silently skipped (NFR-005)

---

## Acceptance Criteria Coverage

| FR/NFR | Description | Test Coverage |
|--------|-------------|---------------|
| FR-001 | Skill acquisition (file validation) | 18 unit tests for validateSkillFrontmatter |
| FR-002 | Smart binding suggestion | 12 + 10 unit tests for analyzeSkillContent + suggestBindings |
| FR-003 | Interactive wiring session | Behavioral test (agent delegation is prompt-based) |
| FR-004 | Manifest registration | 10 unit tests for writeExternalManifest |
| FR-005 | Runtime skill injection | 8 unit tests for formatSkillInjectionBlock + 4 integration tests |
| FR-006 | Skill listing | Covered by loadExternalManifest tests (read path) |
| FR-007 | Skill removal | 6 unit tests for removeSkillFromManifest |
| FR-008 | Natural language entry points | Structural test for CLAUDE.md intent table row |
| FR-009 | Re-wiring existing skills | Covered by suggestBindings + writeExternalManifest tests |
| NFR-001 | Injection performance (<100ms) | Performance test with timing assertions |
| NFR-002 | Manifest size limit (50 skills) | Large manifest fixture test |
| NFR-003 | Fail-open injection | Negative tests for every fail-open path |
| NFR-004 | Monorepo compatibility | Integration tests with monorepo path resolution |
| NFR-005 | Backward compatibility | Tests with no manifest, entries without bindings |
| NFR-006 | Frontmatter validation clarity | Verify error messages include specific field guidance |

---

## Constitutional Compliance

| Article | Compliance |
|---------|------------|
| Article II (Test-First) | Tests designed before implementation. All functions have test specs before code. |
| Article VII (Traceability) | Every test case traces to a requirement (FR/NFR). Traceability matrix provided. |
| Article IX (Quality Gate) | GATE-05 checklist validated. All required artifacts present. |
| Article XI (Integration Testing) | Integration tests validate cross-function data flows. Mutation testing deferred to Phase 16. |
| Article XIII (Module System) | Test file is `.test.cjs` (CommonJS), matching hook convention. |
