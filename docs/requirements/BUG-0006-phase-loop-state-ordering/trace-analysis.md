# Trace Analysis: Phase-Loop Controller Delegates Before Marking State as in_progress

**Generated**: 2026-02-12T11:00:00Z
**Bug**: BUG-0006 -- Phase-loop controller in isdlc.md delegates to phase agents (STEP 3d) BEFORE marking state as in_progress
**External ID**: BUG-0006
**Workflow**: fix
**Phase**: 02-tracing

---

## Executive Summary

The Phase-Loop Controller in `src/claude/commands/isdlc.md` fires the Task tool delegation to phase agents (STEP 3d) without first writing the current phase's `"in_progress"` status to `.isdlc/state.json`. The `phase-loop-controller.cjs` hook correctly enforces that `phases[key].status` must be `"in_progress"` before allowing delegation, and blocks the call. The root cause is a missing pre-delegation state write between STEP 3a (UI-only TaskUpdate) and STEP 3d (Task delegation). The BUG-0005 fix added post-phase writes (STEP 3e step 6), which set the NEXT phase to `"in_progress"` after the CURRENT phase completes -- but this does not cover the first loop iteration (Phase 02 in fix workflows, Phase 02 in feature workflows) where no previous STEP 3e has run.

**Root Cause Confidence**: HIGH
**Severity**: HIGH
**Estimated Complexity**: LOW (markdown-only fix in isdlc.md)

---

## Symptom Analysis

### Error Messages

The `phase-loop-controller.cjs` hook produces this block message when phase status is not `"in_progress"`:

```
PHASE DELEGATION WITHOUT PROGRESS TRACKING: You are delegating to
phase agent '{agent}' for phase '{phase}', but the phase task has
not been marked as in_progress.

Before delegating, you MUST:
1. Call TaskCreate to create a task for this phase (if not already created)
2. Call TaskUpdate to set the task status to in_progress

This ensures the user can see phase progress via spinners. The phase
status in state.json must be "in_progress" before delegation can proceed.

Current phase status: {pending|not set}
```

**Source**: `src/claude/hooks/phase-loop-controller.cjs`, lines 83-94

### Hook Enforcement Path

The hook's check function follows this logic (lines 26-100):

1. **Line 34**: Only intercepts `Task` tool calls
2. **Line 39**: Uses `detectPhaseDelegation(input)` from `src/claude/hooks/lib/common.cjs:1087` to identify phase delegation patterns
3. **Line 60**: Reads `state.active_workflow.current_phase` from state.json
4. **Lines 67-68**: Looks up `state.phases[currentPhase].status`
5. **Line 70**: Allows if status is `"in_progress"` or `"completed"`
6. **Lines 83-94**: Blocks with descriptive error if status is anything else

### Triggering Conditions

The bug manifests when ALL of the following are true:
- A workflow is active (`active_workflow` exists in state.json)
- The Phase-Loop Controller is executing STEP 3 for a phase
- `state.json` has NOT been updated to set the current phase's status to `"in_progress"`
- The `phase-loop-controller.cjs` hook intercepts the Task delegation

### Affected Hooks

Two hooks read `phases[key].status` and could be affected:

| Hook | File | What It Checks | Impact |
|------|------|----------------|--------|
| `phase-loop-controller.cjs` | `src/claude/hooks/phase-loop-controller.cjs:67-70` | `phases[currentPhase].status === "in_progress"` | **PRIMARY** -- directly blocks delegation |
| `gate-blocker.cjs` | `src/claude/hooks/gate-blocker.cjs:404-411` | `phases[currentPhase].status === "in_progress"` as tertiary evidence | **SECONDARY** -- uses phase status as cross-reference for delegation evidence |
| `delegation-gate.cjs` | `src/claude/hooks/delegation-gate.cjs:132-143` | `phases[currentPhase].status === "in_progress"` as cross-reference | **SECONDARY** -- uses phase status as evidence of active work |

---

## Execution Path

### STEP-by-STEP Trace Through isdlc.md

**File**: `src/claude/commands/isdlc.md`, lines 746-832 (STEP 3: PHASE LOOP)

#### Pre-Loop State (after STEP 1 returns)

After `init-and-phase-01` mode completes (STEP 1), the orchestrator returns:
```json
{
  "status": "phase_01_complete",
  "phases": ["01-requirements", "02-tracing", "05-test-strategy", ...],
  "artifact_folder": "BUG-0006-phase-loop-state-ordering",
  "workflow_type": "fix",
  "next_phase_index": 1
}
```

At this point, `state.json` contains:
- `active_workflow.current_phase`: `"01-requirements"` (set during init, NOT updated to Phase 02)
- `active_workflow.current_phase_index`: `0` (Phase 01's index)
- `phases["01-requirements"].status`: `"completed"` or `"in_progress"` (depends on orchestrator behavior)
- `phases["02-tracing"].status`: `"pending"` (never set to `"in_progress"`)
- Top-level `current_phase`: `"01-requirements"`
- Top-level `active_agent`: `"requirements-analyst"`

#### First Loop Iteration (Phase 02: 02-tracing)

| Step | Action | State.json Write? | What Happens |
|------|--------|-------------------|--------------|
| **3a** (line 750) | `TaskUpdate` -- mark task as `in_progress` | **NO** -- UI task tracker only | User sees spinner in terminal |
| **3b** (line 752) | Read `state.json`, check `pending_escalations[]` | **READ ONLY** | Reads stale state |
| **3c** (line 754) | Handle escalations if any | N/A | Skipped if no escalations |
| -- GAP -- | **No state.json write happens here** | **MISSING** | `phases["02-tracing"].status` is still `"pending"` |
| **3d** (line 772) | Fire `Task` tool to delegate to `tracing-orchestrator` | N/A | **HOOK INTERCEPTS HERE** |
| | `phase-loop-controller.cjs` reads `state.phases["02-tracing"].status` | | Finds `"pending"` -- **BLOCKS** |
| **3e** (line 813) | POST-PHASE STATE UPDATE | **YES** (but never reached for first iteration) | Would write completed status |

#### Subsequent Loop Iterations (if first iteration somehow succeeds)

For Phase N+1, the previous STEP 3e (step 6, lines 819-824) writes:
```
phases[new_phase].status = "in_progress"
active_workflow.phase_status[new_phase] = "in_progress"
active_workflow.current_phase = new_phase
current_phase = new_phase
active_agent = agent_for_new_phase
```

This means subsequent iterations would find the phase already marked as `"in_progress"` from the PREVIOUS iteration's STEP 3e. However, the first iteration has no "previous STEP 3e" to rely on.

### State Fields That Must Be Set Before STEP 3d

Based on the hook's check logic and the delegation-gate cross-references, these fields must be written to `state.json` BEFORE the Task delegation:

| Field Path | Required Value | Why |
|------------|---------------|-----|
| `phases[phase_key].status` | `"in_progress"` | `phase-loop-controller.cjs:67-70` reads this to allow/block |
| `phases[phase_key].started` | ISO-8601 timestamp (if null) | Track phase start time |
| `active_workflow.current_phase` | `phase_key` | Hook reads this at line 60 to determine WHICH phase to check |
| `active_workflow.phase_status[phase_key]` | `"in_progress"` | BUG-0005 sync -- `gate-blocker.cjs:618` reads this |
| `current_phase` (top-level) | `phase_key` | `delegation-gate.cjs:134` reads this as fallback |
| `active_agent` (top-level) | agent name from PHASE_AGENT_MAP | Backward compatibility |

---

## Root Cause Analysis

### Primary Hypothesis (Confidence: HIGH)

**Root Cause**: The Phase-Loop Controller in `isdlc.md` has no state.json write between STEP 3a and STEP 3d. STEP 3a is UI-only (`TaskUpdate`), and STEP 3d is the Task delegation. The `phase-loop-controller.cjs` hook fires during STEP 3d and reads state.json to verify the phase status, but finds stale data because no write has occurred.

**Evidence**:

1. **STEP 3a** (line 750): Only calls `TaskUpdate` which updates the Claude Code UI task tracker, NOT `state.json`
2. **STEP 3b** (line 752): Reads `state.json` but only to check for escalations -- no write
3. **STEP 3c** (line 754): Only fires if escalations exist -- no state write in normal path
4. **STEP 3d** (line 772): Fires Task delegation -- hook intercepts here
5. **STEP 3e** (line 813): POST-phase write -- only runs AFTER the agent returns successfully

There is a complete absence of any state.json write that sets the CURRENT phase to `"in_progress"` before delegation.

### Secondary Hypothesis: STEP 3e Partially Mitigates for Non-First Iterations

**Finding**: STEP 3e step 6 (lines 819-824) sets the NEXT phase to `"in_progress"` after the CURRENT phase completes. This means for the second and subsequent loop iterations, the phase status is already `"in_progress"` when STEP 3d fires. However:

1. The first iteration (Phase 02 in fix workflows, Phase 02-impact-analysis in feature workflows) has NO previous STEP 3e and is always affected
2. If a phase fails and is retried, the status might be reset
3. The `active_workflow.current_phase` field may still point to the wrong phase (the completed one, not the current one) until STEP 3e writes

### Tertiary Hypothesis: Hook Checks Wrong Phase on First Iteration

**Finding**: The hook at line 60 reads `state.active_workflow.current_phase`. After init-and-phase-01, this is still `"01-requirements"`. So the hook checks `phases["01-requirements"].status` instead of `phases["02-tracing"].status`. If Phase 01 was marked completed, the hook sees `"completed"` and allows -- which means it might NOT block on the first iteration, but it is checking the wrong phase. This is a related but separate concern -- the hook would allow delegation for the wrong reason.

### Git History Context

BUG-0005 (commit `431006b`) added STEP 3e writes to sync `phase_status`, `active_agent`, and `tasks.md` AFTER phase completion. That fix addressed post-phase state staleness. This bug (BUG-0006) is about the complementary pre-phase state write that was never added.

### Hypothesis Ranking

| Rank | Hypothesis | Confidence | Evidence |
|------|-----------|------------|----------|
| 1 | Missing pre-delegation state.json write between STEP 3a and STEP 3d | HIGH | Direct code reading of isdlc.md lines 750-772; no write exists |
| 2 | STEP 3e from previous iteration partially mitigates for non-first iterations | MEDIUM | Code reading of lines 819-824; confirmed write exists but only post-phase |
| 3 | Hook may check wrong phase on first iteration due to stale `current_phase` | MEDIUM | Line 60 reads `active_workflow.current_phase` which is set during init to Phase 01 |

### Suggested Fix

**Add a pre-delegation state write between STEP 3a and STEP 3d** (new STEP 3a-prime):

Insert between STEP 3a (TaskUpdate) and STEP 3b (escalation check) -- or integrate into STEP 3b since it already reads state.json:

```
3a-prime. PRE-DELEGATION STATE UPDATE:
1. Read .isdlc/state.json (can share read with STEP 3b)
2. Set phases[phase_key].status = "in_progress"
3. Set phases[phase_key].started = current ISO-8601 timestamp (if null)
4. Set active_workflow.current_phase = phase_key
5. Set active_workflow.phase_status[phase_key] = "in_progress"
6. Set top-level current_phase = phase_key
7. Set top-level active_agent = agent name (from PHASE_AGENT_MAP)
8. Write .isdlc/state.json
```

**Also**: Remove the next-phase activation writes from STEP 3e step 6 to eliminate double-writes. STEP 3e should only:
- Mark the COMPLETED phase
- Increment `current_phase_index`
- Write state.json

The next-phase activation is now handled by the NEXT iteration's STEP 3a-prime.

**Complexity**: LOW -- this is a markdown-only change in `isdlc.md`. No hook code changes needed.

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-12T11:00:00Z",
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "error_keywords": ["PHASE DELEGATION WITHOUT PROGRESS TRACKING", "phase task has not been marked as in_progress", "phases[key].status", "pending"],
  "files_analyzed": [
    "src/claude/commands/isdlc.md (lines 746-852)",
    "src/claude/hooks/phase-loop-controller.cjs (lines 26-100)",
    "src/claude/hooks/delegation-gate.cjs (lines 126-143)",
    "src/claude/hooks/gate-blocker.cjs (lines 403-420, 616-620)",
    "src/claude/hooks/lib/common.cjs (detectPhaseDelegation, lines 1087+)",
    "src/claude/agents/00-sdlc-orchestrator.md (init-and-phase-01 mode)"
  ],
  "root_cause_confidence": "high",
  "fix_scope": "src/claude/commands/isdlc.md only (+ .claude runtime copy sync)"
}
```
