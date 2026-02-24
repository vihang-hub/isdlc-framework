# Test Strategy: BUG-0019-GH-1

## Bug Context

**Title**: Orchestrator relaxes blast radius requirements instead of implementing missing files, and no task plan integration when blast radius coverage is incomplete
**Severity**: Medium | **Priority**: P1
**Functional Requirements**: FR-01 through FR-05 (19 acceptance criteria)
**Affected Components**: `src/claude/commands/isdlc.md` (STEP 3f), `src/claude/agents/00-sdlc-orchestrator.md`

---

## Existing Infrastructure (from test evaluation)

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **CJS Hook Tests**: `src/claude/hooks/tests/*.test.cjs` using `hook-test-utils.cjs`
- **Existing Blast Radius Tests**: `src/claude/hooks/tests/test-blast-radius-validator.test.cjs` (75 tests covering parseImpactAnalysis, parseBlastRadiusCoverage, buildCoverageReport, formatBlockMessage, check() guards, full flow, security, dispatcher, NFR, standalone)
- **Test Commands**: `npm run test:hooks` (CJS), `npm test` (ESM), `npm run test:all` (both)
- **Current Coverage**: ~555 total tests (302 ESM + 253 CJS)

## Strategy for This Requirement

- **Approach**: Extend existing test suite -- add new test file alongside existing blast-radius-validator tests
- **No framework changes**: Use existing `node:test` + `node:assert/strict` + `hook-test-utils.cjs`
- **Naming convention**: `test-blast-radius-step3f.test.cjs` (follows `test-*.test.cjs` pattern)
- **Structural convention**: Place in `src/claude/hooks/tests/` alongside existing tests

---

## Test Categories

### Category 1: Markdown Instruction Validation Tests

The primary fix targets markdown agent instructions (`isdlc.md` STEP 3f, `orchestrator.md`). These tests verify that the markdown content after implementation contains the required instruction patterns.

**Rationale**: Since the fix changes agent instructions (markdown), not executable code, tests must validate the instruction content itself -- confirming that blast-radius-specific handling instructions are present and correctly structured.

| Test ID | What It Validates | FR |
|---------|-------------------|-----|
| TC-MD-01 | STEP 3f contains blast-radius-validator detection branch | FR-05 |
| TC-MD-02 | STEP 3f contains unaddressed file extraction instructions | FR-01, FR-05 |
| TC-MD-03 | STEP 3f contains tasks.md cross-reference instructions | FR-02, FR-05 |
| TC-MD-04 | STEP 3f contains re-delegation to implementation instructions | FR-01, FR-05 |
| TC-MD-05 | STEP 3f contains retry loop with max 3 iterations | FR-03, FR-05 |
| TC-MD-06 | STEP 3f contains escalation on retry limit exceeded | FR-03 |
| TC-MD-07 | STEP 3f contains prohibition against modifying impact-analysis.md | FR-01 |
| TC-MD-08 | STEP 3f contains deferral validation from requirements-spec.md | FR-04 |
| TC-MD-09 | STEP 3f preserves existing non-blast-radius block handling | NFR-02 |
| TC-MD-10 | Orchestrator contains blast radius relaxation prevention guidance | FR-01 |
| TC-MD-11 | Orchestrator contains impact-analysis.md read-only constraint | FR-01 |

### Category 2: Unit Tests -- formatBlockMessage Parsing

The fix requires the phase-loop controller to parse the `formatBlockMessage()` output to extract unaddressed file paths. These tests validate that parsing logic (which will be added to a helper or inline) correctly extracts file paths from the known block message format.

| Test ID | What It Validates | FR |
|---------|-------------------|-----|
| TC-PARSE-01 | Extract file paths from single unaddressed file in block message | FR-01 |
| TC-PARSE-02 | Extract file paths from multiple unaddressed files in block message | FR-01 |
| TC-PARSE-03 | Extract change types (MODIFY, CREATE, DELETE) from block message | FR-01 |
| TC-PARSE-04 | Handle empty block message gracefully | FR-01 |
| TC-PARSE-05 | Handle malformed block message without expected pattern | FR-01 |

### Category 3: Unit Tests -- Task Plan Cross-Reference

Tests for the logic that matches unaddressed files against `docs/isdlc/tasks.md` entries.

| Test ID | What It Validates | FR |
|---------|-------------------|-----|
| TC-TASK-01 | Match single unaddressed file to task entry in tasks.md | FR-02 |
| TC-TASK-02 | Match multiple unaddressed files to task entries | FR-02 |
| TC-TASK-03 | Detect unaddressed file with no matching task | FR-02 |
| TC-TASK-04 | Detect unaddressed file whose task is already marked [X] (discrepancy) | FR-02 |
| TC-TASK-05 | Handle missing tasks.md gracefully | FR-02 |
| TC-TASK-06 | Handle empty tasks.md content | FR-02 |

### Category 4: Unit Tests -- Deferral Validation

Tests for the logic that validates deferrals are sourced from requirements-spec.md, not auto-generated.

| Test ID | What It Validates | FR |
|---------|-------------------|-----|
| TC-DEF-01 | Accept deferral for file listed in requirements-spec.md Deferred Files section | FR-04 |
| TC-DEF-02 | Reject deferral for file NOT listed in requirements-spec.md | FR-04 |
| TC-DEF-03 | Handle missing Deferred Files section (no valid deferrals) | FR-04 |
| TC-DEF-04 | Handle malformed Deferred Files section | FR-04 |

### Category 5: Integration Tests -- Blast Radius Block Handling Flow

End-to-end flow tests that validate the complete blast-radius block handling sequence from block detection through re-delegation.

| Test ID | What It Validates | FR |
|---------|-------------------|-----|
| TC-INT-01 | Full flow: block detected -> file list extracted -> tasks matched -> re-delegation prompt built | FR-01, FR-02, FR-05 |
| TC-INT-02 | Re-delegation prompt includes unaddressed file paths | FR-01 |
| TC-INT-03 | Re-delegation prompt includes matched tasks from tasks.md | FR-02 |
| TC-INT-04 | Re-delegation prompt includes prohibition against impact-analysis.md modification | FR-01 |
| TC-INT-05 | Retry counter incremented and logged in state.json | FR-03 |
| TC-INT-06 | Escalation triggered after 3 retries | FR-03 |

### Category 6: Regression Tests

Verify that existing behavior is not broken by the fix.

| Test ID | What It Validates | NFR |
|---------|-------------------|------|
| TC-REG-01 | Non-blast-radius hook blocks still use generic Retry/Skip/Cancel | NFR-02 |
| TC-REG-02 | blast-radius-validator.cjs produces same output format as before | NFR-01 |
| TC-REG-03 | Existing blast-radius-validator tests continue to pass | NFR-01 |

---

## Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Requirement coverage | 100% (19/19 ACs) | Article VII traceability |
| New test count | >= 35 tests | All categories above |
| Regression tests | 0 regressions in existing 555 tests | Article II baseline |
| Critical path coverage | 100% for blast-radius block handling flow | Article II |

---

## Test Data Strategy

See `test-cases/test-data-plan.md` for detailed test data requirements. Summary:

1. **Block message fixtures**: Known `formatBlockMessage()` output samples (single file, multiple files, boundary cases)
2. **tasks.md fixtures**: Mock task plan content with various task states (pending, completed, missing)
3. **requirements-spec.md fixtures**: Mock requirements specs with and without `## Deferred Files` sections
4. **state.json fixtures**: Feature workflow state at Phase 06 with blast radius retry counters
5. **isdlc.md content fixtures**: Post-implementation STEP 3f content for markdown validation tests

---

## Test Execution

All tests run with existing infrastructure:

```bash
# Run new blast-radius STEP 3f tests
node --test src/claude/hooks/tests/test-blast-radius-step3f.test.cjs

# Run all CJS hook tests (includes existing + new)
npm run test:hooks

# Run full suite (ESM + CJS)
npm run test:all
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Markdown instruction tests are brittle (sensitive to wording changes) | Medium | Low | Tests check for semantic patterns, not exact strings |
| formatBlockMessage format changes | Low | Medium | Tests import formatBlockMessage directly and generate expected output |
| tasks.md format varies across workflows | Low | Low | Tests use known fixture content matching current format |
| Retry loop logic is in markdown instructions (not executable) | Medium | Medium | Integration tests validate state.json logging behavior post-implementation |
