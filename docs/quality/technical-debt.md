# Technical Debt Inventory: BUG-0009-state-json-optimistic-locking

**Date**: 2026-02-12
**Phase**: 08-code-review

---

## Technical Debt Resolved by BUG-0009

### TD-RESOLVED-006: State.json Stale Write Vulnerability (was CRITICAL)

- **Location**: `src/claude/hooks/lib/common.cjs` writeState(), `src/claude/hooks/state-write-validator.cjs`
- **Description**: The writeState() function performed blind overwrites with no version tracking. Subagents could overwrite orchestrator state changes with stale snapshots, causing workflow reversions, branch-guard blocks, and manual intervention requirements.
- **Resolution**: Added `state_version` auto-increment to writeState() and V7 version check to state-write-validator hook. Stale writes are now detected and blocked before they reach disk.
- **Impact**: All 18 writeState() call sites across hooks and dispatchers are now protected by optimistic locking without any call-site changes.

---

## New Technical Debt Introduced by BUG-0009

### TD-BUG0009-001: Shallow Copy in writeState() (VERY LOW)

- **Location**: `src/claude/hooks/lib/common.cjs:677`
- **Description**: `Object.assign({}, state)` creates a shallow copy. Nested objects (phases, active_workflow) share references with the caller's object. Currently safe because only the root-level `state_version` is modified on the copy before serialization.
- **Impact**: VERY LOW -- if future changes to writeState() need to modify nested fields on the copy, a deep clone (e.g., `JSON.parse(JSON.stringify(state))`) would be required. Current usage is safe.
- **Recommendation**: No action needed. Document in code if writeState() behavior expands.

### TD-BUG0009-002: checkVersionLock() Cyclomatic Complexity (LOW)

- **Location**: `src/claude/hooks/state-write-validator.cjs:106`
- **Description**: The function has a cyclomatic complexity of 13 (above the typical threshold of 10). This is driven by 3 catch blocks and 3 || operators for backward-compatibility null/undefined checks.
- **Impact**: LOW -- the function is linear (all branches are early returns), readable, and well-tested with 16 dedicated tests. The CC number is inflated by the fail-open defensive pattern which is a standard convention in the hook codebase.
- **Recommendation**: No refactoring needed. If the function grows further, consider splitting into `parseIncomingVersion()` and `readDiskVersion()` helpers.

### TD-BUG0009-003: STATE_JSON_PATTERN Duplicated (LOW, pre-existing, unchanged)

- **Location**: `src/claude/hooks/lib/common.cjs:22`, `src/claude/hooks/state-write-validator.cjs:28`
- **Description**: The STATE_JSON_PATTERN regex is defined in both common.cjs and state-write-validator.cjs. This duplication existed before BUG-0009 and was not changed. Each hook keeps a local copy for standalone execution mode.
- **Impact**: LOW -- patterns are identical. If the pattern changes, 2 files need updating.
- **Recommendation**: Consider consolidating to common.cjs in a future refactoring pass.

---

## Pre-Existing Technical Debt (Carried Forward)

### TD-001: Pre-existing TC-E09 Test Failure (LOW)

- **Location**: `lib/deep-discovery-consistency.test.js:117`
- **Description**: Test expects README.md to reference "40 agents" but the actual agent count has changed.
- **Impact**: LOW -- single cosmetic test failure, 489/490 ESM tests pass.
- **Recommendation**: Update README agent count or test expectation in a future fix workflow.

### TD-002: Node 20 EOL Approaching (INFORMATIONAL)

- **Description**: Node 20 reaches end-of-life on April 30, 2026 (~2.5 months away).
- **Impact**: LOW -- proactive awareness.
- **Recommendation**: Schedule REQ for Node 22 minimum in March 2026.

### TD-004: Template Phase Key Mismatch (LOW)

- **Location**: `src/isdlc/templates/workflow-tasks-template.md`
- **Description**: Template uses `### 02-architecture` but the feature workflow has `02-impact-analysis` and `03-architecture` as separate phases.
- **Impact**: LOW -- template keys used for task descriptions, not phase key matching.

### TD-BUG0005-001: Redundant State Tracking Locations Not Eliminated (INFORMATIONAL)

- **Description**: `state.json` still has 3 redundant locations for phase information: `active_workflow.current_phase`, `active_workflow.phase_status`, and top-level `current_phase`/`phases{}`. Maintained for backward compatibility.

### TD-BUG0005-002: gate-blocker.cjs Else Branch Defensive No-Op (VERY LOW)

- **Location**: `src/claude/hooks/gate-blocker.cjs` line 591
- **Description**: The `else` branch read-priority fix (`state.active_workflow?.current_phase`) is a no-op because `state.active_workflow` is always falsy when the else branch executes.

### TD-BUG0006-OBS01: PHASE_AGENT_MAP vs PHASE->AGENT Table Discrepancy (LOW)

- **Location**: `src/claude/commands/isdlc.md`
- **Description**: Two agent lookup tables contain different agent names for the same phases. No hooks enforce this match.

### TD-BUG0008-001: Triplicated Delegation Guard Pattern (LOW)

- **Location**: `constitution-validator.cjs`, `iteration-corridor.cjs`, `gate-blocker.cjs`
- **Description**: The try/catch delegation guard pattern is copy-pasted identically in 3 hooks.

### TD-BUG0008-002: SETUP_COMMAND_KEYWORDS Quadruplicated (LOW, pre-existing)

- **Location**: `constitution-validator.cjs`, `iteration-corridor.cjs`, `gate-blocker.cjs`, `common.cjs`
- **Description**: The `SETUP_COMMAND_KEYWORDS` array is defined in 4 places.

---

## Debt Summary

| Category | Resolved (BUG-0009) | New (BUG-0009) | Pre-Existing | Active Total |
|----------|---------------------|----------------|--------------|-------------|
| CRITICAL | 1 resolved | 0 | 0 | 0 |
| LOW | 0 | 2 (CC, STATE_JSON_PATTERN) | 7 | 9 |
| VERY LOW | 0 | 1 (shallow copy) | 1 | 2 |
| INFORMATIONAL | 0 | 0 | 2 | 2 |
| **Total** | **1 resolved** | **3** | **10** | **13** |

Net debt change: -1 CRITICAL resolved, +3 LOW/VERY LOW added. Overall debt posture significantly improved (eliminated a critical production vulnerability at the cost of 3 trivial code quality observations).
