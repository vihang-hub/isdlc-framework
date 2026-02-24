# Test Cases: BUG-0013 Phase-Loop-Controller False Blocks

**Phase**: 05-test-strategy
**Bug**: BUG-0013
**Total New Test Cases**: 11 (T13-T23)
**Existing Tests**: 12 (T1-T12, unmodified)
**Test File**: `src/claude/hooks/tests/phase-loop-controller.test.cjs`

---

## Test Group 1: Same-Phase Bypass (FR-01)

These tests verify the core fix -- sub-agent Task calls within the active phase are ALLOWED.

### T13: Allows same-phase delegation when status is pending
- **Traces to**: AC-01, AC-02, AC-03
- **Priority**: P0 (core bug scenario)
- **TDD Status**: RED (will fail before fix)
- **Precondition**: Active workflow with `current_phase = "05-test-strategy"`, `phases["05-test-strategy"].status = "pending"`
- **Input**: Task call with `subagent_type` resolving to `"05-test-strategy"` via prompt containing "05-test-strategy"
- **Expected**: Hook allows (empty stdout, exit code 0)
- **Rationale**: This is the exact bug scenario -- a sub-agent call within the active phase should not be blocked even if status is pending

### T14: Allows same-phase delegation when status is not set
- **Traces to**: AC-01, AC-02, AC-03
- **Priority**: P0 (core bug scenario variant)
- **TDD Status**: RED (will fail before fix)
- **Precondition**: Active workflow with `current_phase = "02-tracing"`, `phases = {}` (no entry for 02-tracing)
- **Input**: Task call with prompt containing "02-tracing" (resolves targetPhase to "02-tracing")
- **Expected**: Hook allows (empty stdout, exit code 0)
- **Rationale**: Variant where phases entry does not exist at all -- should still be allowed for same-phase

### T15: Allows same-phase delegation with explicit sub-agent name
- **Traces to**: AC-01, AC-04
- **Priority**: P0 (real-world sub-agent scenario)
- **TDD Status**: RED (will fail before fix)
- **Precondition**: Active workflow with `current_phase = "06-implementation"`, `phases["06-implementation"].status = "pending"`
- **Input**: Task call with prompt "delegate to 06-implementation agent" (existing `makeDelegationStdin()` pattern)
- **Expected**: Hook allows (empty stdout, exit code 0)
- **Rationale**: Tests with the exact delegation pattern used in production, where targetPhase resolves to the current phase

### T16: Allows same-phase delegation regardless of phase status value
- **Traces to**: AC-01
- **Priority**: P1 (completeness)
- **TDD Status**: RED (will fail before fix)
- **Precondition**: Active workflow with `current_phase = "06-implementation"`, `phases["06-implementation"].status = "some_other_status"`
- **Input**: Task call resolving to "06-implementation"
- **Expected**: Hook allows (empty stdout, exit code 0)
- **Rationale**: The same-phase bypass should not check status at all -- any status value is fine for same-phase

---

## Test Group 2: Cross-Phase Delegation Preserved (FR-02)

These tests verify that the fix does NOT break the existing cross-phase blocking behavior.

### T17: Blocks cross-phase delegation when current phase status is pending
- **Traces to**: AC-05, AC-06
- **Priority**: P0 (regression guard)
- **TDD Status**: GREEN (should pass before and after fix)
- **Precondition**: Active workflow with `current_phase = "05-test-strategy"`, `phases["05-test-strategy"].status = "pending"`
- **Input**: Task call resolving to "06-implementation" (cross-phase: targetPhase != currentPhase)
- **Expected**: Hook blocks (stdout contains JSON with `continue: false`)
- **Rationale**: Cross-phase delegation when currentPhase status is pending must still be blocked
- **Note**: The hook checks `state.phases[currentPhase].status`, not the target phase status

### T18: Allows cross-phase delegation when current phase status is in_progress
- **Traces to**: AC-05, AC-07
- **Priority**: P1 (regression guard)
- **TDD Status**: GREEN (should pass before and after fix)
- **Precondition**: Active workflow with `current_phase = "05-test-strategy"`, `phases["05-test-strategy"].status = "in_progress"`
- **Input**: Task call resolving to "06-implementation" (cross-phase)
- **Expected**: Hook allows (empty stdout, exit code 0)
- **Rationale**: Cross-phase delegation when currentPhase status is in_progress is allowed

### T19: Allows cross-phase delegation when current phase status is completed
- **Traces to**: AC-05, AC-07
- **Priority**: P1 (regression guard)
- **TDD Status**: GREEN (should pass before and after fix)
- **Precondition**: Active workflow with `current_phase = "05-test-strategy"`, `phases["05-test-strategy"].status = "completed"`
- **Input**: Task call resolving to "06-implementation" (cross-phase)
- **Expected**: Hook allows (empty stdout, exit code 0)
- **Rationale**: Cross-phase delegation when currentPhase status is completed is allowed

---

## Test Group 3: Null Safety (FR-03)

These tests verify that the same-phase bypass handles null/undefined safely.

### T20: No bypass when delegation targetPhase is null
- **Traces to**: AC-08
- **Priority**: P1 (edge case)
- **TDD Status**: GREEN (should pass -- null delegation returns isDelegation:false, never reaches bypass)
- **Precondition**: Active workflow with `current_phase = "06-implementation"`
- **Input**: Task call that does not resolve to any phase (non-delegation)
- **Expected**: Hook allows (non-delegation path, empty stdout)
- **Rationale**: If detectPhaseDelegation returns isDelegation:false (targetPhase null), bypass is never reached

### T21: No bypass when current_phase is null
- **Traces to**: AC-09
- **Priority**: P1 (edge case)
- **TDD Status**: GREEN (should pass -- null currentPhase returns allow at line 62-63)
- **Precondition**: Active workflow with `current_phase = null`
- **Input**: Task call resolving to "06-implementation"
- **Expected**: Hook allows (null currentPhase guard fires first)
- **Rationale**: The existing null guard for currentPhase (line 61-63) fires before the same-phase bypass

### T22: No bypass when current_phase is undefined (missing field)
- **Traces to**: AC-09, AC-10
- **Priority**: P2 (edge case)
- **TDD Status**: GREEN (should pass -- undefined currentPhase treated as falsy)
- **Precondition**: Active workflow with no `current_phase` field
- **Input**: Task call resolving to "06-implementation"
- **Expected**: Hook allows (missing currentPhase guard fires first)
- **Rationale**: Missing field is treated as falsy, existing guard handles it

---

## Test Group 4: Observability (FR-04)

### T23: Same-phase bypass logs hook event
- **Traces to**: AC-11, AC-12
- **Priority**: P2 (observability)
- **TDD Status**: RED (will fail before fix -- no logHookEvent call exists for same-phase bypass)
- **Precondition**: Active workflow with `current_phase = "06-implementation"`, `phases["06-implementation"].status = "pending"`, hook-activity.log file exists
- **Input**: Task call resolving to "06-implementation" (same-phase)
- **Expected**: After hook execution, `hook-activity.log` contains an entry with `same-phase-bypass`
- **Rationale**: AC-11 requires logHookEvent call for audit trail
- **Implementation Note**: This test reads `.isdlc/hook-activity.log` after hook execution to verify the log entry exists

---

## Test Summary

| ID | Group | Description | Priority | TDD Status | Traces To |
|---|---|---|---|---|---|
| T13 | Same-Phase | Same-phase, status pending | P0 | RED | AC-01, AC-02, AC-03 |
| T14 | Same-Phase | Same-phase, status not set | P0 | RED | AC-01, AC-02, AC-03 |
| T15 | Same-Phase | Same-phase, explicit sub-agent name | P0 | RED | AC-01, AC-04 |
| T16 | Same-Phase | Same-phase, arbitrary status | P1 | RED | AC-01 |
| T17 | Cross-Phase | Cross-phase, target pending | P0 | GREEN | AC-05, AC-06 |
| T18 | Cross-Phase | Cross-phase, target in_progress | P1 | GREEN | AC-05, AC-07 |
| T19 | Cross-Phase | Cross-phase, target completed | P1 | GREEN | AC-05, AC-07 |
| T20 | Null Safety | Null targetPhase (non-delegation) | P1 | GREEN | AC-08 |
| T21 | Null Safety | Null current_phase | P1 | GREEN | AC-09 |
| T22 | Null Safety | Undefined current_phase | P2 | GREEN | AC-09, AC-10 |
| T23 | Observability | logHookEvent for same-phase bypass | P2 | RED | AC-11, AC-12 |

**TDD Red Baseline**: 5 tests expected to FAIL (T13, T14, T15, T16, T23)
**Regression Green Baseline**: 6 tests expected to PASS (T17-T22)
