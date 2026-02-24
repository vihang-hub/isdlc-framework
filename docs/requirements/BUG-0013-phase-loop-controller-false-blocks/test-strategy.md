# Test Strategy: BUG-0013 Phase-Loop-Controller False Blocks

**Phase**: 05-test-strategy
**Bug**: BUG-0013 -- phase-loop-controller fires on ALL Task tool calls when a workflow is active, including sub-agent spawns within a phase
**Created**: 2026-02-13
**Author**: test-design-engineer

---

## 1. Existing Infrastructure

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Test Type**: CJS hook tests (`*.test.cjs`)
- **Existing Test File**: `src/claude/hooks/tests/phase-loop-controller.test.cjs` (12 tests, T1-T12)
- **Test Pattern**: Local `setupTestEnv()` / `writeState()` / `runHook()` helpers using `execSync` child process execution
- **Test Runner**: `npm run test:hooks` (CJS stream)
- **Coverage Tool**: None explicit for CJS hooks (assertion-based verification)
- **Existing Coverage**: 12 tests covering basic allow/block scenarios, but no tests for same-phase vs cross-phase delegation distinction

### Existing Test Inventory (T1-T12)

| ID | Description | Status |
|---|---|---|
| T1 | Blocks when phase status not set | Passing |
| T2 | Blocks when phase status is pending | Passing |
| T3 | Allows when phase status is in_progress | Passing |
| T4 | Allows when phase status is completed | Passing |
| T5 | Allows non-delegation Task calls | Passing |
| T6 | Allows non-Task tool calls | Passing |
| T7 | Allows when no active_workflow | Passing |
| T8 | Allows setup commands | Passing |
| T9 | Fail-open on missing state.json | Passing |
| T10 | Fail-open on empty stdin | Passing |
| T11 | Fail-open on invalid JSON | Passing |
| T12 | Block message includes phase info | Passing |

### Gap Analysis

The existing tests do NOT cover:
1. **Same-phase delegation bypass** -- the core bug scenario where sub-agent calls within the active phase are falsely blocked
2. **Cross-phase delegation distinction** -- explicit verification that cross-phase delegations are still blocked after the fix
3. **Null safety for same-phase comparison** -- edge cases where targetPhase or currentPhase is null
4. **Observability** -- verification that same-phase bypass events are logged

---

## 2. Strategy: Extend Existing Test Suite

**Approach**: Add new test cases to the existing `phase-loop-controller.test.cjs` file. Follow the established pattern (local helpers, `describe/it` blocks, T-numbering continuation from T13).

**Why not a separate file**: The existing test file has all the infrastructure (setupTestEnv, writeState, runHook, makeDelegationStdin). Adding to it keeps tests co-located and avoids duplicating test utilities.

### Test Mode: TDD Red Baseline

Per Article II (Test-First Development), these tests are written BEFORE the fix is implemented. The expected behavior:

- **Tests for same-phase bypass (T13-T16)**: Will FAIL initially (these test the fix that does not exist yet)
- **Tests for cross-phase blocking (T17-T19)**: Will PASS (existing behavior, regression guard)
- **Tests for null safety (T20-T22)**: Will PASS or FAIL depending on edge case (existing behavior handles most null cases)
- **Tests for observability (T23)**: Will FAIL initially (logHookEvent call does not exist yet)

After implementation in Phase 06, ALL tests should pass.

---

## 3. Test Types

### 3.1 Unit Tests (Primary)

The `check()` function is tested via the standalone hook execution pattern (child process with stdin/stdout). This is the established pattern for all CJS hook tests in this project.

**Test approach**: Write state to temp dir, pipe JSON to the hook via `runHook()`, assert on stdout (block response) or empty stdout (allow).

### 3.2 Integration Tests (Implicit)

The hook is tested through its full execution path including:
- JSON parsing (stdin)
- `detectPhaseDelegation()` resolution
- State file reading
- Block/allow decision
- Stdout output format

This is already integration-level because each test invokes the hook as a child process with real file I/O.

### 3.3 Regression Tests

Tests T17-T19 explicitly verify that cross-phase delegations are still blocked after the fix. These are regression guards to ensure the same-phase bypass does not accidentally allow cross-phase delegations.

### 3.4 Security Tests

Not applicable for this bug fix. The hook is a read-only policy enforcement mechanism that processes trusted internal JSON.

### 3.5 Performance Tests

NFR-01 requires the same-phase bypass adds < 1ms. This is a string comparison (`===`) which is sub-microsecond. No explicit performance test needed; the existing 5-second timeout on `execSync` provides a guard rail.

---

## 4. Coverage Targets

| Metric | Target | Notes |
|---|---|---|
| Acceptance Criteria Coverage | 100% (12/12 ACs) | Every AC has at least one test case |
| Same-phase bypass scenarios | 4 tests | Different sub-agent types, status combinations |
| Cross-phase regression | 3 tests | Pending, in_progress, completed cross-phase |
| Null safety | 3 tests | null targetPhase, null currentPhase, both null |
| Observability | 1 test | logHookEvent call verification |
| **Total new tests** | **11** (T13-T23) | Added to existing 12 (T1-T12) |

---

## 5. Test Data Strategy

### State Configurations

All tests use `writeState()` to create minimal state fixtures. Key variations:

```
State A: Same-phase, status pending
  active_workflow.current_phase = "05-test-strategy"
  phases["05-test-strategy"].status = "pending"
  delegation.targetPhase = "05-test-strategy"

State B: Same-phase, status not set
  active_workflow.current_phase = "02-tracing"
  phases = {} (no entry for 02-tracing)
  delegation.targetPhase = "02-tracing"

State C: Cross-phase, status pending
  active_workflow.current_phase = "05-test-strategy"
  phases["06-implementation"].status = "pending"
  delegation.targetPhase = "06-implementation"

State D: Cross-phase, status in_progress
  active_workflow.current_phase = "05-test-strategy"
  phases["06-implementation"].status = "in_progress"
  delegation.targetPhase = "06-implementation"

State E: Null current_phase
  active_workflow.current_phase = null
  delegation resolves to some phase
```

### Delegation Inputs

The `makeDelegationStdin()` helper generates Task tool input. For same-phase scenarios, the prompt must contain a sub-agent name that resolves to the same phase as `current_phase`. The existing helper defaults to `"delegate to 06-implementation agent"` which resolves to `06-implementation`. New helpers will create inputs that resolve to specific phases.

---

## 6. Test Execution

```bash
# Run only the phase-loop-controller tests
node --test src/claude/hooks/tests/phase-loop-controller.test.cjs

# Run all CJS hook tests (includes this file)
npm run test:hooks

# Run full suite
npm run test:all
```

### TDD Verification Commands

```bash
# Phase 05 (test strategy): Run tests, expect T13-T16 and T23 to FAIL
node --test src/claude/hooks/tests/phase-loop-controller.test.cjs

# Phase 06 (implementation): After fix, ALL tests should PASS
node --test src/claude/hooks/tests/phase-loop-controller.test.cjs
```

---

## 7. Critical Paths

1. **Same-phase bypass** (FR-01): The most critical path. Tests T13-T16 verify that sub-agent Task calls within the active phase are allowed regardless of phase status.
2. **Cross-phase blocking preserved** (FR-02): Tests T17-T19 verify no regression in the existing blocking behavior.
3. **Null safety** (FR-03): Tests T20-T22 verify the bypass comparison handles null values safely.
4. **Observability** (FR-04): Test T23 verifies the logHookEvent call for audit trail.

---

## 8. Risk Assessment

| Risk | Mitigation |
|---|---|
| Same-phase bypass too broad (allows cross-phase) | T17-T19 regression tests explicitly verify cross-phase blocking |
| Null comparison (null === null) triggers false bypass | T22 explicitly tests both-null scenario |
| detectPhaseDelegation returns unexpected targetPhase | Tests use real hook execution with actual detectPhaseDelegation logic |
| Existing tests break after fix | All existing tests (T1-T12) verified compatible with the fix |

---

## 9. Constitutional Compliance

- **Article II (Test-First)**: Tests written before implementation. TDD red baseline established.
- **Article VII (Traceability)**: Every test traces to at least one AC. Traceability matrix provided.
- **Article IX (Gate Integrity)**: GATE-05 checklist validates all artifacts.
- **Article XI (Integration Testing)**: Tests run the hook as a child process with real file I/O (integration-level).
