# Technical Debt Inventory: BUG-0008-constitution-validator-false-positive

**Date**: 2026-02-12
**Phase**: 08-code-review

---

## Technical Debt Resolved by BUG-0008

### TD-RESOLVED-005: False-Positive Hook Blocking on Delegation Prompts (was HIGH)

- **Location**: `src/claude/hooks/constitution-validator.cjs`, `iteration-corridor.cjs`, `gate-blocker.cjs`
- **Description**: Three PreToolUse[Task] hooks used overly broad regex patterns that matched delegation prompts (phase-loop controller assigning work to agents) as completion/gate-advancement attempts. This blocked legitimate workflow execution.
- **Resolution**: Added `detectPhaseDelegation()` guard at the top of each detection function. When the Task call is identified as a phase delegation, the detection function returns `false` immediately (skip pattern matching).
- **Impact**: Phase-loop controller can now delegate to agents without hook interference. All workflows (fix, feature) unblocked.

---

## New Technical Debt Introduced by BUG-0008

### TD-BUG0008-001: Triplicated Delegation Guard Pattern (LOW)

- **Location**: `constitution-validator.cjs:isPhaseCompletionAttempt()`, `iteration-corridor.cjs:taskHasAdvanceKeywords()`, `gate-blocker.cjs:isGateAdvancementAttempt()`
- **Description**: The try/catch delegation guard pattern is copy-pasted identically in 3 hooks. If the guard logic needs to change (e.g., additional detection criteria), all 3 hooks must be updated.
- **Impact**: LOW -- the pattern is 5 lines, stable, and unlikely to change. Extracting to a helper would obscure the fail-open intent at each call site. The pre-task-dispatcher consolidation model is the long-term solution (dispatcher could skip hooks for delegations before invoking them).
- **Recommendation**: Monitor for future changes. If a 4th hook needs the same guard, extract to common.cjs.

### TD-BUG0008-002: SETUP_COMMAND_KEYWORDS Quadruplicated (LOW, pre-existing, unchanged)

- **Location**: `constitution-validator.cjs`, `iteration-corridor.cjs`, `gate-blocker.cjs`, `common.cjs`
- **Description**: The `SETUP_COMMAND_KEYWORDS` array is defined in 4 places. BUG-0008 did not change this; it existed prior. Each hook keeps a local copy for standalone execution mode.
- **Impact**: LOW -- arrays are identical. If a new setup keyword is added, 4 files need updating.
- **Recommendation**: Consider consolidating to common.cjs and importing in a future refactoring pass. Not urgent.

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

---

## Debt Summary

| Category | Resolved (BUG-0008) | New (BUG-0008) | Pre-Existing | Active Total |
|----------|---------------------|----------------|--------------|-------------|
| HIGH | 1 resolved | 0 | 0 | 0 |
| LOW | 0 | 1 (guard triplicate) | 5 | 6 |
| INFORMATIONAL | 0 | 0 | 2 | 2 |
| **Total** | **1 resolved** | **1** | **7** | **8** |

Net debt change: -1 HIGH resolved, +1 LOW added. Overall debt posture improved.
