# Technical Debt Inventory: BUG-0005-state-tracking-stale

**Date**: 2026-02-12
**Phase**: 08-code-review

---

## Technical Debt Resolved by BUG-0005

### TD-RESOLVED-001: Hook Read-Priority Inversion (was HIGH)

- **Location**: 6 hook files
- **Description**: Hooks read `state.current_phase` (top-level) which could be stale, causing false blocks and incorrect behavior when `active_workflow.current_phase` had advanced beyond the top-level value.
- **Resolution**: All 6 hooks now prefer `active_workflow.current_phase` with fallback to top-level.
- **Impact**: Eliminates false blocks during workflow execution.

### TD-RESOLVED-002: STEP 3e Missing State Sync (was HIGH)

- **Location**: `src/claude/commands/isdlc.md`
- **Description**: STEP 3e did not update `active_workflow.phase_status`, did not update `active_agent`, and did not mark tasks.md completed.
- **Resolution**: Steps 5-8 added to STEP 3e for complete state synchronization.
- **Impact**: All 3 redundant state tracking locations now stay in sync during phase transitions.

---

## New Technical Debt Introduced by BUG-0005

### TD-BUG0005-001: Redundant State Tracking Locations Not Eliminated (INFORMATIONAL)

- **Description**: `state.json` still has 3 redundant locations for phase information: `active_workflow.current_phase`, `active_workflow.phase_status`, and top-level `current_phase`/`phases{}`. BUG-0005 makes them consistent but does not eliminate the redundancy.
- **Impact**: INFORMATIONAL -- the redundancy is maintained for backward compatibility (AC-05a through AC-05c) and standalone hook execution.
- **Recommendation**: Consider a future state schema simplification initiative (explicitly out of scope per requirements-spec.md section 5).

### TD-BUG0005-002: gate-blocker.cjs Else Branch Defensive No-Op (VERY LOW)

- **Location**: `src/claude/hooks/gate-blocker.cjs` line 578-579
- **Description**: The `else` branch fix `state.active_workflow?.current_phase || state.current_phase` is a no-op because `state.active_workflow` is always falsy when the else branch executes. Added for pattern consistency.
- **Impact**: VERY LOW -- no runtime cost, improves code consistency.
- **Recommendation**: No action needed. If the if/else structure is refactored in the future, this can be cleaned up.

---

## Pre-Existing Technical Debt (Carried Forward)

### TD-001: Pre-existing TC-E09 Test Failure (LOW)

- **Location**: `lib/deep-discovery-consistency.test.js:115`
- **Description**: Test expects README.md to reference "40 agents" but the actual agent count has changed
- **Impact**: LOW -- single cosmetic test failure
- **Recommendation**: Update README agent count or test expectation in a future fix workflow

### TD-002: Node 20 EOL Approaching (INFORMATIONAL)

- **Description**: Node 20 reaches end-of-life on April 30, 2026 (~2.5 months away)
- **Impact**: LOW -- proactive awareness
- **Recommendation**: Schedule REQ for Node 22 minimum in March 2026

### TD-004: Template Phase Key Mismatch (LOW)

- **Location**: `src/isdlc/templates/workflow-tasks-template.md`
- **Description**: Template uses `### 02-architecture` but the feature workflow has `02-impact-analysis` and `03-architecture` as separate phases.
- **Impact**: LOW -- template keys used for task descriptions, not phase key matching

---

## Debt Summary

| Category | Resolved (BUG-0005) | New (BUG-0005) | Pre-Existing | Active Total |
|----------|---------------------|----------------|--------------|-------------|
| HIGH | 2 resolved | 0 | 0 | 0 |
| LOW | 0 | 0 | 2 | 2 |
| INFORMATIONAL | 0 | 2 | 1 | 3 |
| **Total** | **2 resolved** | **2** | **3** | **5** |

Net debt change: -2 HIGH resolved, +2 INFORMATIONAL added. Overall debt posture improved.
