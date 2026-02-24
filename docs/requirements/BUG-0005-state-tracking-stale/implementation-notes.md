# Implementation Notes: BUG-0005 - Redundant State Tracking Fix

**Bug ID:** BUG-0005-state-tracking-stale
**Phase:** 06-implementation
**Implemented:** 2026-02-12
**Branch:** feature/REQ-0009-enhanced-plan-to-tasks

---

## Summary

Fixed 6 hooks to prefer `active_workflow.current_phase` over the top-level `current_phase` field in `state.json`, and updated STEP 3e in `isdlc.md` to sync all 3 redundant tracking locations (`active_workflow.phase_status`, top-level `active_agent`, and `tasks.md`) on phase transitions.

---

## Changes Made

### Part A: Hook Read-Priority Fixes (T0011-T0016)

All 6 hooks were changed from reading `state.current_phase` (top-level only) to the pattern:
```javascript
const currentPhase = state.active_workflow?.current_phase || state.current_phase;
```

| Hook File | Line | AC | Change |
|-----------|------|-----|--------|
| `src/claude/hooks/constitution-validator.cjs` | 245 | AC-03a | `state.current_phase` -> `state.active_workflow?.current_phase \|\| state.current_phase` |
| `src/claude/hooks/delegation-gate.cjs` | 133 | AC-03b | Inverted priority: `state.current_phase \|\| state.active_workflow...` -> `state.active_workflow... \|\| state.current_phase` |
| `src/claude/hooks/log-skill-usage.cjs` | 87 | AC-03c | Added `state.active_workflow?.current_phase \|\|` before existing expression |
| `src/claude/hooks/skill-validator.cjs` | 95 | AC-03d | Added `state.active_workflow?.current_phase \|\|` before existing expression |
| `src/claude/hooks/gate-blocker.cjs` | 578 | AC-03e | Added `state.active_workflow?.current_phase \|\|` in else branch |
| `src/claude/hooks/lib/provider-utils.cjs` | 323 | AC-03f | Added `state?.active_workflow?.current_phase \|\|` before existing expression |

### Part B: STEP 3e Updates (T0017)

Updated `src/claude/commands/isdlc.md` STEP 3e to add:
- Step 5: Set `active_workflow.phase_status[completed_phase]` = `"completed"` (AC-01a)
- Step 6: Set `active_workflow.phase_status[new_phase]` = `"in_progress"` (AC-01b)
- Step 6: Set top-level `active_agent` = agent name for new phase (AC-02a)
- Added PHASE_AGENT_MAP for agent resolution (AC-02b)

### Part C: tasks.md Update Logic (T0018)

Added Step 8 to STEP 3e:
- Mark all tasks in completed phase section as `[X]` (AC-04b)
- Change section header from `PENDING`/`IN PROGRESS` to `COMPLETE` (AC-04b)
- Recalculate Progress Summary table (AC-04c)
- Skip silently if tasks.md does not exist (AC-04d)
- Preserve pipe annotations like `| traces: AC-03a` (per v2.0 annotation protocol)

---

## Test Summary

### New Tests Added: 25 test cases across 6 test files

| Test File | New Tests | AC Coverage |
|-----------|-----------|-------------|
| `test-constitution-validator.test.cjs` | 6 | AC-03a (4), AC-06a (2) |
| `test-delegation-gate.test.cjs` | 3 | AC-03b (3) |
| `test-log-skill-usage.test.cjs` | 4 | AC-03c (4) |
| `test-skill-validator.test.cjs` | 4 | AC-03d (4) |
| `test-gate-blocker-extended.test.cjs` | 5 | AC-03e (3), AC-06d (2 implicit) |
| `test-provider-utils.test.cjs` | 3 | AC-03f (3) |

### Test Results
- **Hook tests (CJS):** 865 pass, 0 fail
- **All tests (ESM + CJS):** 489 pass, 1 fail (pre-existing TC-E09 unrelated to this bug)
- **Regression:** 0 existing tests broken

### Coverage Scenarios
Each hook test covers:
1. **Divergent state:** `active_workflow.current_phase` differs from top-level `current_phase` -- verifies hook uses the correct (active_workflow) source
2. **No active_workflow:** Backward compatibility -- hook falls back to top-level `current_phase`
3. **Both missing:** Fail-open behavior -- hook uses default fallback or allows
4. **Extremely stale:** Top-level is many phases behind -- confirms active_workflow always wins

---

## Design Decisions

1. **Optional chaining (`?.`)**: Used `state.active_workflow?.current_phase` instead of explicit null checks for conciseness and consistency with modern JavaScript patterns already used in the codebase.

2. **Fallback chain preserved**: Each hook retains its original fallback value (`'01-requirements'`, `'unknown'`, etc.) after the `||` chain, maintaining backward compatibility for standalone hook execution outside a workflow.

3. **STEP 3e as prompt text**: The STEP 3e updates are prompt instructions in `isdlc.md`, not executable code. The phase-loop controller (Claude Code agent) follows these instructions when executing phase transitions. Testing is done via integration validation of state structure expectations.

4. **PHASE_AGENT_MAP inline**: The agent mapping is defined inline in STEP 3e rather than in a separate config file, avoiding a new dependency for a simple lookup table.

---

## Backward Compatibility

- Top-level `current_phase`, `active_agent`, and `phases{}` continue to be written by STEP 3e
- All 6 fixed hooks fall back to top-level `current_phase` when `active_workflow` is absent
- Hooks invoked outside a workflow (standalone execution, direct CLI use) continue to work correctly
- No new files or dependencies added
