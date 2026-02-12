# Technical Debt Inventory: BUG-0006-phase-loop-state-ordering

**Date**: 2026-02-12
**Phase**: 08-code-review

---

## Technical Debt Resolved by BUG-0006

### TD-RESOLVED-003: Pre-Delegation State Write Missing (was HIGH)

- **Location**: `src/claude/commands/isdlc.md` STEP 3 loop
- **Description**: The Phase-Loop Controller delegated to phase agents (STEP 3d) before writing `phases[key].status = "in_progress"` to state.json. The `phase-loop-controller.cjs` hook correctly enforced the status check, causing every phase transition to be blocked.
- **Resolution**: Added STEP 3c-prime between 3c and 3d to write all 6 required state fields before delegation.
- **Impact**: Phase transitions now work correctly with hook enforcement enabled.

### TD-RESOLVED-004: Redundant Next-Phase Activation in STEP 3e (was MEDIUM)

- **Location**: `src/claude/commands/isdlc.md` STEP 3e step 6
- **Description**: STEP 3e step 6 set the NEXT phase to `"in_progress"` after completing the current phase, but the next iteration's 3c-prime also activates the phase. This created potential double-writes and unclear ownership of phase activation.
- **Resolution**: Removed redundant writes from step 6; 3c-prime is now the single source of truth for phase activation.
- **Impact**: Cleaner state lifecycle; single responsibility for activation (3c-prime) and deactivation (3e).

---

## New Technical Debt Introduced by BUG-0006

None. The fix is minimal and does not introduce new debt.

---

## Pre-Existing Technical Debt (Updated)

### TD-BUG0006-OBS01: PHASE_AGENT_MAP vs PHASE->AGENT Table Discrepancy (LOW)

- **Location**: `src/claude/commands/isdlc.md` lines 788-809 (STEP 3d table) vs lines 842-859 (PHASE_AGENT_MAP)
- **Description**: The two agent lookup tables in isdlc.md contain different agent names for the same phases (e.g., `tracing-orchestrator` vs `trace-analyst`, `qa-engineer` vs `code-reviewer`). Additionally, PHASE_AGENT_MAP is missing entries for 6 phase keys and uses 2 different phase key names.
- **Impact**: LOW -- `active_agent` in state.json will not match the actual `subagent_type` used in Task delegation. No hooks currently enforce this match, so no runtime failures. Creates misleading observability data.
- **Pre-existing**: Yes -- the map content was not modified by BUG-0006 (only the label was updated).
- **Recommendation**: Address in a separate fix workflow to unify the two tables into a single canonical source.

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

### TD-BUG0005-001: Redundant State Tracking Locations Not Eliminated (INFORMATIONAL)

- **Description**: `state.json` still has 3 redundant locations for phase information: `active_workflow.current_phase`, `active_workflow.phase_status`, and top-level `current_phase`/`phases{}`. BUG-0005 made them consistent; BUG-0006 maintains consistency. Redundancy remains.
- **Impact**: INFORMATIONAL -- maintained for backward compatibility and standalone hook execution.

### TD-BUG0005-002: gate-blocker.cjs Else Branch Defensive No-Op (VERY LOW)

- **Location**: `src/claude/hooks/gate-blocker.cjs`
- **Description**: The `else` branch read-priority fix is a no-op because `state.active_workflow` is always falsy when the else branch executes.
- **Impact**: VERY LOW -- no runtime cost, improves code consistency.

---

## Debt Summary

| Category | Resolved (BUG-0006) | New (BUG-0006) | Pre-Existing | Active Total |
|----------|---------------------|----------------|--------------|-------------|
| HIGH | 1 resolved | 0 | 0 | 0 |
| MEDIUM | 1 resolved | 0 | 0 | 0 |
| LOW | 0 | 0 | 4 | 4 |
| INFORMATIONAL | 0 | 0 | 2 | 2 |
| **Total** | **2 resolved** | **0** | **6** | **6** |

Net debt change: -1 HIGH resolved, -1 MEDIUM resolved, +1 LOW added (PHASE_AGENT_MAP discrepancy reclassified from pre-existing). Overall debt posture improved.
