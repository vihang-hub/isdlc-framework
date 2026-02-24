# Test Strategy: Wire Skill Index Block Injection and Unify Skill Injection

**Requirement ID**: REQ-0033
**Artifact Folder**: REQ-0033-skill-index-injection-unify-blocks
**Phase**: 05-test-strategy
**Version**: 1.0.0
**Created**: 2026-02-23
**Status**: Draft

---

## 1. Existing Infrastructure

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Module Format**: CJS (`*.test.cjs`) for hook-layer tests
- **Coverage Tool**: None (no Istanbul/c8 configured; coverage is structural via traceability)
- **Current Test Count**: 555+ (302 ESM lib tests + 253 CJS hook tests)
- **Existing Skill Injection Tests**: `skill-injection.test.cjs` (40 tests), `test-bug-0035-skill-index.test.cjs` (27 tests)
- **Test Runner Command**: `npm run test:hooks` (CJS), `npm test` (ESM)
- **Test Naming Convention**: `test-{type}-{id}-{description}.test.cjs`

---

## 2. Test Nature: Spec-Validation Pattern

This feature modifies a **specification file** (`src/claude/commands/isdlc.md`) that serves as executable instructions for the LLM Phase-Loop Controller. This is the same spec-validation test pattern used in BUG-0032, BUG-0033, BUG-0034, and BUG-0035:

- Tests **scan the specification file content with regex** to verify structural markers, keywords, and procedural instructions are present
- Tests are **deterministic** -- no MCP calls, no network, no mocking needed
- File reads are cached per test suite run
- Tests also verify the **TC-09 test updates** in `skill-injection.test.cjs` (checking that the test file assertions match the new specification keywords)

This is NOT traditional unit/integration/E2E testing of executable code. The "code under test" is markdown that will be interpreted by an LLM.

---

## Test Pyramid

For this spec-validation feature, the test pyramid is adapted:

| Level | Description | Count | Rationale |
|-------|-------------|-------|-----------|
| **Spec Structure** (analogous to unit) | Regex scans of isdlc.md to verify each SKILL INJECTION STEP is present with correct keywords | 18 tests | Core verification that the spec rewrite is complete |
| **Ordering/Position** (analogous to integration) | Position-based assertions verifying the ordering of injection steps relative to each other and to WORKFLOW MODIFIERS / GATE REQUIREMENTS | 5 tests | Ensures the prompt assembly order is correct |
| **Fail-Open / NFR** (analogous to E2E / resilience) | Verifying fail-open language, monorepo paths, and non-functional constraints in the spec | 5 tests | Ensures safety properties are encoded in the spec |
| **TC-09 Update Guards** | Verifying skill-injection.test.cjs has been updated with new assertion keywords | 4 tests | Ensures existing test suite is updated |
| **Regression Guards** | Verifying that unchanged blocks (GATE REQUIREMENTS, BUDGET DEGRADATION) still exist and are unmodified | 3 tests | CON-006 compliance |

**Total tests**: 34 (29 RED before implementation, 5 already-passing regression guards)

---

## Flaky Test Mitigation

Risk of flaky tests is **extremely low** for this feature because:

1. All tests use `fs.readFileSync()` to read static files -- no async race conditions
2. No network calls, no mocking, no timer-dependent behavior
3. No temp directory creation -- tests read the actual source files in the repo
4. String matching with `includes()` and `indexOf()` is deterministic

**Mitigation for the one potential source of flakiness**: Line number assertions are avoided in favor of relative position assertions (`indexOf(A) < indexOf(B)`) which survive line count changes from unrelated edits.

---

## Performance Test Plan

No performance-critical code paths are being modified. The specification text changes do not affect runtime performance of any JavaScript function. The existing performance test in `skill-injection.test.cjs` TC-08.2 (getAgentSkillIndex under 100ms) and `test-bug-0035-skill-index.test.cjs` TC-B35-NFR-01 remain valid and unchanged.

**NFR-002** (skill injection under 5 seconds) is a runtime characteristic of the LLM executing the spec, not testable via deterministic automated tests. It will be validated during manual acceptance testing.

---

## 3. Coverage Targets

| Area | Target | Method |
|------|--------|--------|
| FR-001 (Built-in skill index wiring) | 100% AC coverage | 4 test cases verify STEP A instructions, function names, Bash command |
| FR-002 (External skill injection wiring) | 100% AC coverage | 4 test cases verify STEP B instructions, manifest path, delivery types |
| FR-003 (Unified prompt structure) | 100% AC coverage | 3 test cases verify STEP C assembly, ordering rules |
| FR-004 (Curly-brace replacement) | 100% AC coverage | 3 test cases verify curly-brace blocks removed, imperative format |
| FR-005 (Monorepo path resolution) | 100% AC coverage | 2 test cases verify monorepo path references in STEP B |
| FR-006 (Fail-open semantics) | 100% AC coverage | 3 test cases verify fail-open language in Steps A, B, C |
| NFR-001 through NFR-006 | Covered by structural assertions | 3 test cases verify prompt size constraints, compatibility text |
| CON-006 (Unchanged blocks) | Regression guards | 3 test cases verify GATE REQUIREMENTS and BUDGET DEGRADATION intact |

---

## 4. Test File Location and Naming

| Artifact | Path |
|----------|------|
| New test file | `src/claude/hooks/tests/test-req-0033-skill-injection-wiring.test.cjs` |
| Modified test file (by Phase 06) | `src/claude/hooks/tests/skill-injection.test.cjs` (TC-09 updates) |

The new test file follows the established naming convention: `test-{type}-{id}-{description}.test.cjs`.

---

## 5. RED-State Design

The test file is written to be in **RED state** before implementation:

- Tests assert that `SKILL INJECTION STEP A`, `SKILL INJECTION STEP B`, `SKILL INJECTION STEP C` keywords exist in `isdlc.md`
- Tests assert that `getAgentSkillIndex` and `formatSkillIndexBlock` are referenced as executable instructions (not just in curly-brace comments)
- Tests assert that the old curly-brace blocks have been replaced (or at minimum that the new imperative format co-exists)

**Before Phase 06 implementation**: Tests will FAIL because `isdlc.md` still has the old curly-brace format.
**After Phase 06 implementation**: Tests will PASS because the spec has been rewritten per the module design.

---

## 6. Test Execution

```
node --test src/claude/hooks/tests/test-req-0033-skill-injection-wiring.test.cjs
```

Or as part of the full CJS test suite:

```
npm run test:hooks
```

---

## 7. Constitutional Compliance

| Article | Requirement | Status |
|---------|------------|--------|
| Article II (Test-First Development) | Tests designed before implementation | PASS -- this document and test file are created in Phase 05, before Phase 06 implementation |
| Article VII (Artifact Traceability) | Test cases trace to requirements | PASS -- every test case group traces to FR-xxx and AC-xxx |
| Article IX (Quality Gate Integrity) | All required artifacts exist | PASS -- test-strategy.md, test file, and traceability matrix all produced |
| Article XI (Integration Testing) | Integration tests validate component interactions | N/A -- this feature modifies a specification file, not executable code with component interfaces |

---

## 8. Metadata

```json
{
  "phase": "05-test-strategy",
  "requirement_id": "REQ-0033",
  "test_file": "src/claude/hooks/tests/test-req-0033-skill-injection-wiring.test.cjs",
  "test_count": 34,
  "existing_test_modifications": "skill-injection.test.cjs TC-09 (Phase 06 scope)",
  "debate_rounds_used": 0,
  "fan_out_chunks": 0
}
```
