# Test Strategy: BUG-0006 -- Phase-Loop State Ordering Fix

**Bug ID**: BUG-0006
**Phase**: 05-test-strategy
**Author**: Test Design Engineer (Agent 04)
**Date**: 2026-02-12
**Artifact Folder**: BUG-0006-phase-loop-state-ordering

---

## 1. Existing Infrastructure (from test evaluation)

- **Framework**: Node.js built-in `node:test` + `node:assert/strict`
- **Coverage Tool**: None (no Istanbul/c8); coverage measured by test count and AC mapping
- **Current Test Count**: 555+ (302 ESM lib tests + 253 CJS hook tests)
- **Existing Patterns**: CJS hook tests in `src/claude/hooks/tests/*.test.cjs` using `setupTestEnv()`/`writeState()`/`runHook()` pattern
- **Existing Phase-Loop Tests**: `phase-loop-controller.test.cjs` (12 tests covering allow/block logic)
- **Test Commands**: `npm run test:hooks` (CJS), `npm test` (ESM), `npm run test:all` (both)

## 2. Fix Scope and Testing Approach

### What Changed

This fix modifies `src/claude/commands/isdlc.md` (a markdown prompt file, not executable code). The changes are:

1. **Add STEP 3a-prime**: A pre-delegation state.json write block between STEP 3c and STEP 3d
2. **Modify STEP 3e step 6**: Remove redundant next-phase activation writes (keep only `current_phase_index` increment)
3. **Sync runtime copy**: `.claude/commands/isdlc.md` must match `src/claude/commands/isdlc.md`

### Testing Approach: Dual-Layer Verification

Since `isdlc.md` is a prompt file (instructions for Claude, not executable code), traditional unit testing does not apply to the prompt text itself. Instead, the test strategy uses two verification layers:

| Layer | What It Verifies | Method |
|-------|------------------|--------|
| **Layer 1: Prompt Content Verification** | The isdlc.md text contains the correct instructions in the correct order | Regex-based content scanning of isdlc.md |
| **Layer 2: Hook Behavior Verification** | Existing hooks still work correctly when state.json is written per the new instructions | Existing + extended CJS hook tests |

**Layer 1** is the primary verification for this bug fix. It validates that the prompt instructions are correct, complete, and ordered properly. These are new tests written specifically for BUG-0006.

**Layer 2** is the regression safety net. The existing `phase-loop-controller.test.cjs` (12 tests) already validates that the hook allows delegation when `phases[key].status === "in_progress"` (T3) and blocks when it is not (T1, T2). No new hook tests are needed -- the existing suite confirms the hook will behave correctly once the prompt writes state.json before delegation.

## 3. Test Types

### 3.1 Prompt Content Tests (NEW -- Layer 1)

**Purpose**: Verify that `isdlc.md` contains the correct instructions after the fix.

**Framework**: Node.js `node:test` + `node:assert/strict` (CJS pattern)
**File**: `src/claude/hooks/tests/isdlc-step3-ordering.test.cjs`

These tests read `src/claude/commands/isdlc.md` as a text file and use regex patterns to verify:

1. STEP 3a-prime exists between STEP 3c and STEP 3d
2. STEP 3a-prime sets all 6 required state fields
3. STEP 3a-prime includes a "Write .isdlc/state.json" instruction
4. STEP 3e step 6 no longer contains next-phase activation writes
5. STEP 3e step 6 still increments `current_phase_index`
6. Runtime copy (`.claude/commands/isdlc.md`) matches source

### 3.2 Hook Regression Tests (EXISTING -- Layer 2)

**Purpose**: Confirm no regressions in hook enforcement behavior.

**File**: `src/claude/hooks/tests/phase-loop-controller.test.cjs` (12 existing tests)

Existing tests already cover:
- T1: Blocks when phase status not set
- T2: Blocks when status is "pending"
- T3: Allows when status is "in_progress"
- T4: Allows when status is "completed"
- T5-T8: Non-delegation calls allowed
- T9-T11: Fail-open on edge cases
- T12: Block message content

No modifications needed. These tests validate that once the prompt correctly writes `"in_progress"` before delegation (as verified by Layer 1), the hook will allow it.

### 3.3 Integration Tests (NOT NEEDED)

No new integration tests are needed because:
- This fix does not change any executable code (hooks, lib, CLI)
- The integration between the prompt and hooks is tested by Layer 1 (prompt correctness) + Layer 2 (hook correctness)
- The Phase 16 quality loop will run the full test suite as a regression check

### 3.4 Security Tests (NOT APPLICABLE)

No new security surface is introduced. The fix only changes the ordering of state.json writes in prompt instructions.

### 3.5 Performance Tests (NOT APPLICABLE)

No performance-sensitive code is changed. State.json writes are already fast (single file, small JSON).

## 4. Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Requirement coverage | 100% of ACs | All 17 acceptance criteria must map to at least one test case |
| Prompt content tests | >= 10 test cases | Cover all 6 STEP 3a-prime fields + STEP 3e removals + ordering + sync |
| Regression tests | 0 failures | All 555+ existing tests must pass |
| Hook test count | No decrease | Existing 12 phase-loop-controller tests remain |

## 5. Critical Paths

### CP-1: STEP 3a-prime Positioning
The new step MUST appear between STEP 3c (escalation handling) and STEP 3d (Task delegation). If it appears after 3d, the hook will block. If it appears before 3a, it runs before the UI spinner.

### CP-2: STEP 3a-prime Field Completeness
All 6 state fields must be written. Missing any single field can cause hook blocks or stale state:
- `phases[key].status` (phase-loop-controller.cjs checks this)
- `phases[key].started` (timing metadata)
- `active_workflow.current_phase` (hook reads this to determine which phase to check)
- `active_workflow.phase_status[key]` (gate-blocker.cjs cross-references this)
- `current_phase` (delegation-gate.cjs fallback)
- `active_agent` (backward compatibility)

### CP-3: STEP 3e Deduplication
STEP 3e step 6 must NOT set next-phase activation fields, but MUST still increment `current_phase_index`. If the index increment is accidentally removed, the loop will not progress.

### CP-4: Runtime Copy Sync
`.claude/commands/isdlc.md` must be identical to `src/claude/commands/isdlc.md`. A stale runtime copy means the fix is not effective.

## 6. Test Execution Plan

### Phase 05 (This Phase): Design Only
- Design test cases (this document + test-cases.md)
- Create traceability matrix
- No tests are executed in this phase

### Phase 06 (Implementation): Write Tests + Fix
- Implement the prompt content tests in `isdlc-step3-ordering.test.cjs`
- Apply the fix to `isdlc.md`
- Run prompt content tests to verify fix correctness

### Phase 16 (Quality Loop): Full Regression
- Run `npm run test:all` to verify no regressions
- Verify test count >= 555 baseline
- Manual inspection of state.json writes during a workflow run (if applicable)

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Prompt test regex too brittle | Medium | Low | Use flexible regex patterns that match semantic intent, not exact whitespace |
| Fix misses a field in STEP 3a-prime | Low | High | Test case per field (TC-01a through TC-01f) |
| STEP 3e index increment accidentally removed | Low | Critical | Dedicated test case (TC-02e) |
| Runtime copy not synced | Low | High | File comparison test (TC-04a) |

## 8. Assumptions and Constraints

- **C-01**: Only `isdlc.md` needs modification -- no hook code changes
- **C-02**: Existing hook tests validate hook behavior independently of prompt content
- **C-03**: Prompt content tests use regex; they verify instruction presence, not runtime execution
- **C-04**: The quality loop (Phase 16) provides the full regression safety net
- **A-01**: The existing 12 phase-loop-controller tests remain passing (no hook code changes)
- **A-02**: The prompt content test file follows CJS naming convention (`*.test.cjs`)
