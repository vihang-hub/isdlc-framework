# Implementation Notes - BUG-0021-GH-5

## Bug Summary

delegation-gate infinite loop on `/isdlc analyze` caused by missing carve-out for Phase A (inline execution). The `skill-delegation-enforcer.cjs` hook writes a `pending_delegation` marker for ALL `/isdlc` Skill invocations, but `analyze` runs inline without orchestrator delegation. The `delegation-gate.cjs` Stop hook then blocks every response because the marker is never cleared.

## Root Cause

- `skill-delegation-enforcer.cjs` keyed on skill name ("isdlc") only, not on subcommand action
- `delegation-gate.cjs` had no awareness of exempt actions that don't require delegation

## Changes Made

### 1. skill-delegation-enforcer.cjs (FR-01, FR-02)

**EXEMPT_ACTIONS Set** (line 36): Added `const EXEMPT_ACTIONS = new Set(['analyze'])` containing subcommands that run inline without orchestrator delegation.

**Action parsing** (line 71): Extract the first non-flag word from args using regex `^(?:--?\w+\s+)*(\w+)`. This handles:
- `'analyze "description"'` -> extracts `analyze`
- `'--verbose analyze "description"'` -> extracts `analyze` (skips flags)
- `''` (empty) -> extracts `''` (falls through to normal enforcement)
- `'feature "Build auth"'` -> extracts `feature` (not exempt, normal enforcement)

**Exempt check** (line 72-75): If parsed action is in EXEMPT_ACTIONS, log debug message and exit cleanly with `process.exit(0)` -- no marker written, no MANDATORY message emitted.

### 2. delegation-gate.cjs (FR-03)

**EXEMPT_ACTIONS Set** (line 27): Mirror of the same Set for defense-in-depth.

**Auto-clear logic** (lines 103-112): After reading the pending delegation marker but before the full delegation verification, parse the action from `pending.args`. If the action is exempt, auto-clear the marker via `clearMarkerAndResetErrors()` and exit cleanly. This handles the case where a stale marker from a prior `/isdlc analyze` invocation would otherwise block indefinitely.

### 3. Test Coverage

- **skill-delegation-enforcer**: 12 new tests (23 total, from 11 baseline)
- **delegation-gate**: 10 new tests (32 total, from 22 baseline)
- **Total new tests**: 22
- **All tests passing**: 1607/1608 hooks tests (1 pre-existing unrelated failure in gate-blocker-extended)

### 4. Runtime Sync (FR-04)

Both modified source files at `src/claude/hooks/` are identical to their runtime counterparts at `.claude/hooks/` (verified via diff).

## Acceptance Criteria Verification

| AC | Description | Status | Evidence |
|----|-------------|--------|----------|
| AC-01 | EXEMPT_ACTIONS contains 'analyze' as a Set | PASS | `const EXEMPT_ACTIONS = new Set(['analyze'])` in both hooks |
| AC-02 | Action parsing extracts 'analyze' from args | PASS | Test "parses action 'analyze' from args with description" passes |
| AC-03 | No marker written for exempt actions | PASS | Test "does NOT write pending_delegation marker for 'analyze' action" passes |
| AC-04 | Marker still written for non-exempt actions | PASS | Tests for "feature", "fix", "upgrade" all write markers |
| AC-05 | delegation-gate auto-clears exempt markers | PASS | Test "auto-clears pending_delegation for exempt 'analyze' action" passes |
| AC-06 | Empty/missing args don't crash | PASS | Tests for empty args and missing args both pass cleanly |
| AC-07 | All existing tests pass with zero regressions | PASS | 1607/1608 (pre-existing failure only) |
| AC-08 | Runtime hooks synced | PASS | src/ and .claude/ files are identical |

## Files Modified

| File | Lines Changed | Change Type |
|------|--------------|-------------|
| `src/claude/hooks/skill-delegation-enforcer.cjs` | +15 | EXEMPT_ACTIONS Set + action parsing + exempt check |
| `src/claude/hooks/delegation-gate.cjs` | +18 | EXEMPT_ACTIONS Set + auto-clear defense-in-depth |
| `src/claude/hooks/tests/test-skill-delegation-enforcer.test.cjs` | +134 | 12 new test cases |
| `src/claude/hooks/tests/test-delegation-gate.test.cjs` | +191 | 10 new test cases |

## Design Decisions

1. **Regex for action parsing**: `^(?:--?\w+\s+)*(\w+)` handles leading flags gracefully. Empty match returns empty string which is never in EXEMPT_ACTIONS, so it falls through to normal enforcement (fail-safe).

2. **Case-insensitive matching**: `action.toLowerCase()` ensures 'ANALYZE', 'Analyze', etc. all match.

3. **Defense-in-depth in delegation-gate**: Even though the enforcer should prevent the marker from being written for exempt actions, the gate also checks. This handles race conditions and stale markers from before the fix was deployed.

4. **Minimal change footprint**: Only added code, no structural refactoring. Existing behavior for non-exempt actions (feature, fix, upgrade, test, discover) is completely untouched.
