# Test Cases: FR-03 - Hook Read-Priority Fix

**Requirement:** FR-03 (AC-03a through AC-03f)
**Test Type:** Unit Tests
**Scope:** 6 hooks must prefer `active_workflow.current_phase` over top-level `current_phase`

---

## Test Data Fixtures

### Fixture 1: Divergent State (active_workflow differs from top-level)
```json
{
  "current_phase": "05-test-strategy",
  "active_agent": "test-design-engineer",
  "active_workflow": {
    "type": "fix",
    "current_phase": "06-implementation",
    "current_phase_index": 3,
    "phases": ["01-requirements", "02-tracing", "05-test-strategy", "06-implementation"],
    "phase_status": {
      "01-requirements": "completed",
      "02-tracing": "completed",
      "05-test-strategy": "completed",
      "06-implementation": "in_progress"
    }
  },
  "phases": {
    "05-test-strategy": { "status": "completed" },
    "06-implementation": { "status": "in_progress" }
  }
}
```

### Fixture 2: No active_workflow (backward compatibility)
```json
{
  "current_phase": "06-implementation",
  "active_agent": "software-developer",
  "phases": {
    "06-implementation": { "status": "in_progress" }
  }
}
```

### Fixture 3: Both missing
```json
{
  "phases": {}
}
```

### Fixture 4: active_workflow present but current_phase missing
```json
{
  "current_phase": "06-implementation",
  "active_workflow": {
    "type": "fix",
    "phases": ["01-requirements", "06-implementation"]
  },
  "phases": {
    "06-implementation": { "status": "in_progress" }
  }
}
```

---

## TC-03a: constitution-validator.cjs Read Priority

**File:** `src/claude/hooks/tests/test-constitution-validator.test.cjs` (extend)
**Hook line:** 245

### TC-03a-01: Prefers active_workflow.current_phase when both set
- **Given**: State with `active_workflow.current_phase` = `"06-implementation"` and top-level `current_phase` = `"05-test-strategy"` (divergent). Phase `06-implementation` has constitutional validation state.
- **When**: Hook receives a Task tool input with a phase completion prompt.
- **Then**: Hook evaluates constitutional validation against `"06-implementation"` (not `"05-test-strategy"`). Verify by checking that it reads `phases["06-implementation"].constitutional_validation`, not `phases["05-test-strategy"]`.

### TC-03a-02: Falls back to top-level current_phase when active_workflow is null
- **Given**: State with NO `active_workflow` field. Top-level `current_phase` = `"06-implementation"`.
- **When**: Hook receives a Task tool input with a phase completion prompt.
- **Then**: Hook uses `"06-implementation"` from the top-level field. Verify by checking that it evaluates `phases["06-implementation"].constitutional_validation`.

### TC-03a-03: Allows when both current_phase fields are missing
- **Given**: State with no `active_workflow` and no `current_phase`.
- **When**: Hook receives a Task tool input.
- **Then**: Hook returns `{ decision: "allow" }` (fail-open per Article X).

### TC-03a-04: Prefers active_workflow even when top-level is stale
- **Given**: State with `active_workflow.current_phase` = `"08-code-review"` and top-level `current_phase` = `"01-requirements"` (extremely stale).
- **When**: Hook receives input.
- **Then**: Hook resolves phase as `"08-code-review"`.

---

## TC-03b: delegation-gate.cjs Read Priority

**File:** `src/claude/hooks/tests/test-delegation-gate.test.cjs` (extend)
**Hook line:** 133 (inverted priority fix)

### TC-03b-01: Prefers active_workflow.current_phase (previously was inverted)
- **Given**: State with `active_workflow.current_phase` = `"06-implementation"` and top-level `current_phase` = `"05-test-strategy"` (divergent). `phases["06-implementation"]` has `status: "in_progress"`. `pending_delegation` exists.
- **When**: Hook fires on Stop event.
- **Then**: Hook checks `phases["06-implementation"]` for `in_progress` status (not `"05-test-strategy"`). If found, it clears the marker and allows.

### TC-03b-02: Falls back to top-level when active_workflow is null
- **Given**: State with NO `active_workflow`. Top-level `current_phase` = `"06-implementation"`. `phases["06-implementation"].status` = `"in_progress"`. `pending_delegation` exists.
- **When**: Hook fires on Stop event.
- **Then**: Hook uses top-level `current_phase` and finds `in_progress` phase, allowing.

### TC-03b-03: Allows when no current_phase available at all
- **Given**: State with no `active_workflow`, no `current_phase`, `pending_delegation` exists but no skill_usage_log matches.
- **When**: Hook fires on Stop event.
- **Then**: Hook cannot find an in_progress phase via this path; behavior depends on other delegation checks. The key assertion is that it does NOT crash (fail-open).

---

## TC-03c: log-skill-usage.cjs Read Priority

**File:** `src/claude/hooks/tests/test-log-skill-usage.test.cjs` (extend)
**Hook line:** 87

### TC-03c-01: Prefers active_workflow.current_phase when both set
- **Given**: State with `active_workflow.current_phase` = `"06-implementation"` and top-level `current_phase` = `"05-test-strategy"`.
- **When**: Hook logs a Task tool usage with agent `"software-developer"`.
- **Then**: The logged entry has `current_phase: "06-implementation"` (not `"05-test-strategy"`).

### TC-03c-02: Falls back to top-level current_phase when active_workflow is null
- **Given**: State with NO `active_workflow`. Top-level `current_phase` = `"06-implementation"`.
- **When**: Hook logs a Task tool usage.
- **Then**: The logged entry has `current_phase: "06-implementation"`.

### TC-03c-03: Falls back to default '01-requirements' when both missing
- **Given**: State with NO `active_workflow` and NO `current_phase`.
- **When**: Hook logs a Task tool usage.
- **Then**: The logged entry has `current_phase: "01-requirements"` (default fallback).

### TC-03c-04: Prefers active_workflow over stale top-level
- **Given**: State with `active_workflow.current_phase` = `"16-quality-loop"` and top-level `current_phase` = `"01-requirements"`.
- **When**: Hook logs usage.
- **Then**: Logged entry shows `current_phase: "16-quality-loop"`.

---

## TC-03d: skill-validator.cjs Read Priority

**File:** `src/claude/hooks/tests/test-skill-validator.test.cjs` (extend)
**Hook line:** 95

### TC-03d-01: Prefers active_workflow.current_phase when both set
- **Given**: State with `active_workflow.current_phase` = `"06-implementation"` and top-level `current_phase` = `"05-test-strategy"`.
- **When**: Hook validates a Task tool input for agent `"software-developer"`.
- **Then**: Skill validation is evaluated against phase `"06-implementation"` (not `"05-test-strategy"`).

### TC-03d-02: Falls back to top-level when active_workflow is null
- **Given**: State with NO `active_workflow`. Top-level `current_phase` = `"06-implementation"`.
- **When**: Hook validates a Task tool input.
- **Then**: Skill validation uses `"06-implementation"` from top-level.

### TC-03d-03: Falls back to '01-requirements' when both missing
- **Given**: State with NO `active_workflow` and NO `current_phase`.
- **When**: Hook validates a Task tool input.
- **Then**: Skill validation uses `"01-requirements"` (default).

### TC-03d-04: Divergent state uses active_workflow
- **Given**: `active_workflow.current_phase` = `"08-code-review"`, top-level `current_phase` = `"06-implementation"`.
- **When**: Hook validates.
- **Then**: Phase resolved as `"08-code-review"`.

---

## TC-03e: gate-blocker.cjs Fallback Branch Read Priority

**File:** `src/claude/hooks/tests/test-gate-blocker-extended.test.cjs` (extend)
**Hook line:** 578 (else branch only -- the if branch on line 549 is already correct)

### TC-03e-01: Fallback branch prefers active_workflow.current_phase
- **Given**: State where `activeWorkflow` condition evaluates to falsy BUT `state.active_workflow.current_phase` exists. Top-level `current_phase` differs. (Note: this tests the edge case where the else branch is reached but active_workflow data exists.)
- **When**: Hook processes a gate advancement request.
- **Then**: `currentPhase` is resolved from `active_workflow.current_phase` first, then top-level fallback.

### TC-03e-02: Fallback branch uses top-level when no active_workflow
- **Given**: State with NO `active_workflow`. Top-level `current_phase` = `"06-implementation"`.
- **When**: Hook processes a gate advancement request.
- **Then**: `currentPhase` resolved as `"06-implementation"`.

### TC-03e-03: Fallback branch allows when no phase available
- **Given**: State with NO `active_workflow` and NO `current_phase`.
- **When**: Hook processes a gate advancement request.
- **Then**: Hook returns `{ decision: "allow" }` (line 582-583).

---

## TC-03f: provider-utils.cjs Read Priority

**File:** `src/claude/hooks/tests/test-provider-utils.test.cjs` (extend)
**Hook line:** 323

### TC-03f-01: selectProvider prefers active_workflow.current_phase
- **Given**: State with `active_workflow.current_phase` = `"06-implementation"` and top-level `current_phase` = `"05-test-strategy"`.
- **When**: `selectProvider(config, state, context)` is called.
- **Then**: The phase used for provider selection is `"06-implementation"`.

### TC-03f-02: selectProvider falls back to top-level
- **Given**: State with NO `active_workflow`. Top-level `current_phase` = `"06-implementation"`.
- **When**: `selectProvider(config, state, context)` is called.
- **Then**: The phase used is `"06-implementation"`.

### TC-03f-03: selectProvider falls back to 'unknown' when both missing
- **Given**: State with NO `active_workflow` and NO `current_phase`.
- **When**: `selectProvider(config, state, context)` is called.
- **Then**: The phase used is `"unknown"` (default).

---

## Summary

| AC | Hook | New Tests | Extend File |
|----|------|-----------|-------------|
| AC-03a | constitution-validator.cjs | 4 | test-constitution-validator.test.cjs |
| AC-03b | delegation-gate.cjs | 3 | test-delegation-gate.test.cjs |
| AC-03c | log-skill-usage.cjs | 4 | test-log-skill-usage.test.cjs |
| AC-03d | skill-validator.cjs | 4 | test-skill-validator.test.cjs |
| AC-03e | gate-blocker.cjs | 3 | test-gate-blocker-extended.test.cjs |
| AC-03f | provider-utils.cjs | 3 | test-provider-utils.test.cjs |
| **Total** | | **21** | |
