# Test Cases: FR-05, FR-06 - Backward Compatibility and Write Correctness

**Requirements:** FR-05 (AC-05a through AC-05d), FR-06 (AC-06a through AC-06d)
**Test Type:** Unit Tests + Regression Tests
**Scope:** Verify backward compatibility and that hooks writing to state.phases use the correctly resolved phase

---

## FR-05: Top-level fields remain for backward compatibility

### TC-05a: Top-level current_phase continues to be written

*This is a STEP 3e concern -- verified in the state-sync integration tests (TC-01c-03). The existing STEP 3e behavior is preserved, so this is a regression-prevention check.*

### TC-05a-01: current_phase in sync after transition
- **Given**: STEP 3e transition from Phase 02 to Phase 05.
- **Then**: `state.current_phase` === `state.active_workflow.current_phase` === `"05-test-strategy"`.
- **Covered by**: TC-01c-03 in TC-FR01-FR02-state-sync.md.

### TC-05b: Top-level phases{} continues to be written

### TC-05b-01: phases[completed_phase].status set to "completed"
- **Given**: Phase 02 completing.
- **Then**: `state.phases["02-tracing"].status` = `"completed"`.
- **Covered by**: TC-01a-02 in TC-FR01-FR02-state-sync.md.

### TC-05c: Top-level active_agent is updated (new behavior via FR-02)

*Covered by TC-02a tests in TC-FR01-FR02-state-sync.md.*

### TC-05d: No hooks or agents broken by the read priority change

This is the core regression safety net. The following tests verify each of the 6 modified hooks still works correctly in the no-workflow scenario.

### TC-05d-01: constitution-validator works without active_workflow
- **Given**: State with NO `active_workflow`. `current_phase` = `"06-implementation"`. Phase has constitutional validation pending.
- **When**: Hook receives completion prompt.
- **Then**: Hook correctly blocks (constitutional validation not done). It does NOT crash or return an error.
- **Covered by**: TC-03a-02 in TC-FR03-hook-read-priority.md.

### TC-05d-02: delegation-gate works without active_workflow
- **Covered by**: TC-03b-02 in TC-FR03-hook-read-priority.md.

### TC-05d-03: log-skill-usage works without active_workflow
- **Covered by**: TC-03c-02 in TC-FR03-hook-read-priority.md.

### TC-05d-04: skill-validator works without active_workflow
- **Covered by**: TC-03d-02 in TC-FR03-hook-read-priority.md.

### TC-05d-05: gate-blocker works without active_workflow
- **Covered by**: TC-03e-02 in TC-FR03-hook-read-priority.md.

### TC-05d-06: provider-utils works without active_workflow
- **Covered by**: TC-03f-02 in TC-FR03-hook-read-priority.md.

---

## FR-06: Hooks that write to state.phases use correctly resolved phase

### TC-06a: constitution-validator writes to correct phase

**File:** `src/claude/hooks/tests/test-constitution-validator.test.cjs` (extend)

### TC-06a-01: Writes constitutional_validation to active_workflow-resolved phase
- **Given**: State with `active_workflow.current_phase` = `"06-implementation"` and top-level `current_phase` = `"05-test-strategy"` (divergent). Phase `"06-implementation"` exists in `phases{}` with iteration requirements enabled.
- **When**: Hook initializes constitutional validation state (first completion check).
- **Then**: `state.phases["06-implementation"].constitutional_validation` is written (not `state.phases["05-test-strategy"]`).

### TC-06a-02: Writes to top-level-resolved phase when no active_workflow
- **Given**: State with NO `active_workflow`. `current_phase` = `"06-implementation"`.
- **When**: Hook writes constitutional validation state.
- **Then**: `state.phases["06-implementation"].constitutional_validation` is written.

---

### TC-06b: test-watcher writes to correct phase

**File:** `src/claude/hooks/tests/test-test-watcher.test.cjs` (extend)

### TC-06b-01: Writes test_iteration to active_workflow-resolved phase
- **Given**: State with `active_workflow.current_phase` = `"06-implementation"`. Test-watcher detects a test command execution.
- **When**: Hook processes test results.
- **Then**: `state.phases["06-implementation"].iteration_requirements.test_iteration` is updated (not a stale phase).

### TC-06b-02: test-watcher already reads active_workflow correctly (regression check)
- **Given**: test-watcher already reads `active_workflow` first (line 441). This is a regression-prevention test.
- **When**: Hook runs with divergent state.
- **Then**: Writes to the correct phase. No behavior change needed for test-watcher.

---

### TC-06c: menu-tracker writes to correct phase

**File:** `src/claude/hooks/tests/test-menu-tracker.test.cjs` (extend)

### TC-06c-01: Writes interactive_elicitation to active_workflow-resolved phase
- **Given**: State with `active_workflow.current_phase` = `"01-requirements"`. Menu-tracker detects a menu interaction pattern.
- **When**: Hook processes the interaction.
- **Then**: `state.phases["01-requirements"].iteration_requirements.interactive_elicitation` is updated.

### TC-06c-02: menu-tracker already reads active_workflow correctly (regression check)
- **Given**: menu-tracker already reads `active_workflow` first (line 146).
- **When**: Hook runs with divergent state.
- **Then**: Writes to the correct phase.

---

### TC-06d: gate-blocker writes to correct phase

**File:** `src/claude/hooks/tests/test-gate-blocker-extended.test.cjs` (extend)

### TC-06d-01: Writes gate_validation to active_workflow-resolved phase
- **Given**: State with `active_workflow.current_phase` = `"06-implementation"`. Gate blocker validates and records gate check results.
- **When**: Hook processes a gate advancement request and records validation.
- **Then**: `state.phases["06-implementation"].gate_validation` is written (using the correctly resolved phase key from the if-branch, which is already correct).

### TC-06d-02: Gate validation in fallback branch uses correct phase
- **Given**: State where else-branch is reached. `current_phase` = `"06-implementation"`.
- **When**: Gate blocker records validation.
- **Then**: `state.phases["06-implementation"].gate_validation` is written using the now-fixed else-branch resolution.

---

## Summary

| AC | Test Cases | New Tests | Notes |
|----|-----------|-----------|-------|
| AC-05a | TC-05a-01 | 0 | Covered by TC-01c-03 (state-sync) |
| AC-05b | TC-05b-01 | 0 | Covered by TC-01a-02 (state-sync) |
| AC-05c | TC-05c | 0 | Covered by TC-02a (state-sync) |
| AC-05d | TC-05d-01 through TC-05d-06 | 0 | Covered by TC-03*-02 (backward compat in each hook) |
| AC-06a | TC-06a-01, TC-06a-02 | 2 | Extend constitution-validator tests |
| AC-06b | TC-06b-01, TC-06b-02 | 2 | Extend test-watcher tests |
| AC-06c | TC-06c-01, TC-06c-02 | 2 | Extend menu-tracker tests |
| AC-06d | TC-06d-01, TC-06d-02 | 2 | Extend gate-blocker tests |
| **Total** | | **8** | (+ 6 via cross-references) |
