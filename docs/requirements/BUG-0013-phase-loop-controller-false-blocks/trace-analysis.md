# Trace Analysis: Phase-loop-controller false blocks on sub-agent Task calls

**Generated**: 2026-02-13T08:20:00Z
**Bug**: BUG-0013 -- phase-loop-controller fires on ALL Task tool calls when a workflow is active, including sub-agent spawns within a phase
**Workflow**: fix
**Phase**: 02-tracing

---

## Executive Summary

The `phase-loop-controller.cjs` hook incorrectly blocks intra-phase sub-agent Task calls because its `check()` function does not distinguish between top-level phase delegations (orchestrator delegating TO a phase agent) and intra-phase sub-agent calls (a phase agent delegating to its own sub-agents). Both resolve to the same `targetPhase` via `detectPhaseDelegation()` because sub-agents like `symptom-analyzer`, `execution-path-tracer`, and `root-cause-identifier` all map to their parent phase (`02-tracing`) in the skills manifest. The fix is a 3-line same-phase bypass: when `delegation.targetPhase === currentPhase`, the call is within the active phase and should be unconditionally allowed.

**Root Cause Confidence**: HIGH
**Severity**: High
**Estimated Complexity**: Low (3-line insertion)

---

## Symptom Analysis

### Error Messages

The hook produces the following block message when sub-agent calls are falsely blocked:

```
PHASE DELEGATION WITHOUT PROGRESS TRACKING: You are delegating to
phase agent '{agentName}' for phase '{targetPhase}', but the phase
task has not been marked as in_progress.

Before delegating, you MUST:
1. Call TaskCreate to create a task for this phase (if not already created)
2. Call TaskUpdate to set the task status to in_progress

Current phase status: {pending|not set}
```

This error is misleading because:
1. The phase IS the current active phase -- work is already underway
2. The "phase delegation" is actually an intra-phase sub-agent call
3. The status check against `state.phases[phase].status` is being applied to the wrong kind of Task call

### Triggering Conditions

The false block occurs when ALL of the following are true:
1. An active workflow exists (`state.active_workflow` is present)
2. The current phase agent spawns a sub-agent via the Task tool
3. The sub-agent resolves to the same phase as `active_workflow.current_phase` in the skills manifest
4. The `state.phases[currentPhase].status` is not yet `in_progress` (e.g., `pending` or missing)

This timing window is common because the Phase-Loop Controller itself is supposed to detect the initial delegation and ensure the phase is marked `in_progress` before allowing it. Sub-agents spawned *after* the phase is active should not be subject to this check at all.

### Affected Scenarios

| Phase Agent | Sub-Agents Affected | Phase Key |
|---|---|---|
| tracing-orchestrator | symptom-analyzer (T1), execution-path-tracer (T2), root-cause-identifier (T3) | 02-tracing |
| impact-analysis-orchestrator | code-impact-analyzer (M1), dependency-graph-walker (M2), risk-assessor (M3) | 02-impact-analysis |
| quality-loop-engineer | (parallel test/lint/security sub-agents) | 16-quality-loop |

Any phase agent that delegates to sub-agents within its own phase is affected.

### Reproduction Validation

Reproduction steps confirmed via code analysis:
1. Active workflow with `current_phase: "02-tracing"` and `phases["02-tracing"].status: "pending"`
2. Tracing-orchestrator spawns T1 via `Task` with `subagent_type: "symptom-analyzer"`
3. `detectPhaseDelegation()` calls `normalizeAgentName("symptom-analyzer")` which returns `"symptom-analyzer"`
4. `getAgentPhase("symptom-analyzer")` looks up skills-manifest ownership, returns `"02-tracing"`
5. Returns `{ isDelegation: true, targetPhase: "02-tracing", agentName: "symptom-analyzer" }`
6. Hook checks `state.phases["02-tracing"].status` -- finds `"pending"`
7. Block triggered with "Phase status is 'pending', expected 'in_progress'"

---

## Execution Path

### Entry Point

The hook is invoked as part of the `pre-task-dispatcher` chain (file: `src/claude/hooks/dispatchers/pre-task-dispatcher.cjs`, line 65):

```
Dispatcher chain for PreToolUse[Task]:
  1. iteration-corridor     (corridor enforcement)
  2. skill-validator         (observe only)
  3. phase-loop-controller   <-- THIS HOOK (position 3 of 5)
  4. plan-surfacer           (task plan check)
  5. phase-sequence-guard    (phase ordering)
```

The dispatcher short-circuits on the first `block` decision, so if `phase-loop-controller` blocks, hooks 4-5 never run.

### Call Chain: Normal Phase Delegation (Working)

```
Orchestrator (isdlc.md STEP 3d)
  -> Task { subagent_type: "tracing-orchestrator", prompt: "..." }
     -> pre-task-dispatcher fires
        -> detectPhaseDelegation() resolves to "02-tracing"
        -> currentPhase = state.active_workflow.current_phase = "02-tracing"
        -> phaseState = state.phases["02-tracing"]
        -> phaseStatus = "in_progress" (set by orchestrator before delegation)
        -> ALLOWED
```

### Call Chain: Intra-Phase Sub-Agent (Failing)

```
tracing-orchestrator (already running in phase 02-tracing)
  -> Task { subagent_type: "symptom-analyzer", prompt: "Analyze symptoms..." }
     -> pre-task-dispatcher fires
        -> detectPhaseDelegation() resolves to "02-tracing"   <-- SAME PHASE
        -> currentPhase = state.active_workflow.current_phase = "02-tracing"
        -> phaseState = state.phases["02-tracing"]
        -> phaseStatus = "pending" or undefined
        -> BLOCKED  <-- FALSE POSITIVE
```

### Data Flow Analysis

The critical data transformation happens in `detectPhaseDelegation()` at `src/claude/hooks/lib/common.cjs:1112-1169`:

```
Input:  { tool_name: "Task", tool_input: { subagent_type: "symptom-analyzer" } }
                    |
                    v
Step 1: isSetupCommand("...") -> false  (not a setup command)
Step 2: normalizeAgentName("symptom-analyzer") -> "symptom-analyzer"
Step 3: getAgentPhase("symptom-analyzer") -> "02-tracing"  (from manifest)
                    |
                    v
Output: { isDelegation: true, targetPhase: "02-tracing", agentName: "symptom-analyzer" }
```

The manifest ownership entries that cause this resolution:

```json
{
  "symptom-analyzer":       { "agent_id": "T1", "phase": "02-tracing" },
  "execution-path-tracer":  { "agent_id": "T2", "phase": "02-tracing" },
  "root-cause-identifier":  { "agent_id": "T3", "phase": "02-tracing" }
}
```

All three sub-agents resolve to `02-tracing` -- the same phase as their parent `tracing-orchestrator`.

### Failure Point

The failure occurs at `src/claude/hooks/phase-loop-controller.cjs`, lines 66-73:

```javascript
// Line 66-68: Look up phase status
const phaseState = state.phases && state.phases[currentPhase];
const phaseStatus = phaseState && phaseState.status;

// Line 70-73: Allow only if in_progress or completed
if (phaseStatus === 'in_progress' || phaseStatus === 'completed') {
    debugLog('Phase status is', phaseStatus, '- allowing');
    return { decision: 'allow' };
}
```

The missing logic is between line 64 (after `currentPhase` null check) and line 66 (before `phaseState` lookup). A same-phase bypass check should be inserted here.

---

## Root Cause Analysis

### Hypothesis 1: Missing Same-Phase Bypass (CONFIRMED -- HIGH confidence)

**Evidence:**
- The `check()` function at lines 60-73 computes `currentPhase` from `state.active_workflow.current_phase` and `delegation.targetPhase` from `detectPhaseDelegation()`, but never compares them
- When `targetPhase === currentPhase`, the delegation is within the active phase (sub-agent call), not a cross-phase delegation
- The hook was originally designed for the orchestrator-to-phase-agent pattern (BUG-0006, commit `bd3bb63`), which is always a cross-phase delegation
- Sub-agent patterns (orchestrator phases that spawn sub-agents) were introduced later but the hook was not updated

**Fix:**
Insert 3 lines after line 64 (after `currentPhase` null check), before line 66 (`phaseState` lookup):

```javascript
// Same-phase bypass: sub-agent calls within the current phase are allowed
if (delegation.targetPhase === currentPhase) {
    debugLog('Same-phase delegation to', currentPhase, '- allowing');
    return { decision: 'allow' };
}
```

**Why this works:**
- If the delegation target resolves to the *same* phase that is currently active, it is definitionally a sub-agent call within that phase
- The phase is already being executed (the parent agent is running), so there is no need to check `state.phases` status
- Cross-phase delegations (where `targetPhase !== currentPhase`) continue to be subject to the existing status check

### Hypothesis 2: detectPhaseDelegation() Should Not Resolve Sub-Agents (REJECTED)

**Reasoning:** One could modify `detectPhaseDelegation()` to return `isDelegation: false` for sub-agents. However, this would require maintaining a separate list of "sub-agents vs phase agents" and would break the clean manifest-based resolution. The same-phase bypass in the hook consumer is simpler and more maintainable.

### Hypothesis 3: Phase Status Should Be Set Earlier (PARTIAL -- already addressed by BUG-0006)

**Reasoning:** BUG-0006 added pre-delegation state writes so the phase IS marked `in_progress` before the initial delegation. However, there is a timing window where `state.phases[phase].status` may not yet be `in_progress` when sub-agents are spawned -- particularly if the state write has not been flushed or if the sub-agent reads a stale state. The same-phase bypass eliminates this timing dependency entirely.

### Related Bug History

| Bug | Description | Relationship |
|---|---|---|
| BUG-0006 | Phase-loop controller delegates before marking state as in_progress | Added pre-delegation state write; did not address sub-agents |
| BUG-0008 | Constitution validator false positive on delegation prompts | Added `detectPhaseDelegation()` guard; same pattern of hooks over-matching |
| BUG-0009 | Subagents overwrite state.json with stale data | Added optimistic locking; related to stale state reads |
| BUG-0011 | Phase-sequence-guard false blocks from subagent phase field overwrite | Added V8 phase field protection; same class of hook-vs-subagent conflict |
| BUG-0012 | Git commit runs before quality-loop and code-review | Added phase-aware commit blocking; same pattern of hooks needing phase awareness |

This is the fifth bug in the hook-vs-subagent conflict class. All previous fixes addressed specific hooks but none added the fundamental same-phase bypass that prevents this entire class of bugs in the phase-loop-controller.

### Suggested Fix

**File**: `src/claude/hooks/phase-loop-controller.cjs`
**Location**: Between line 64 and line 66 (after `currentPhase` null check, before `phaseState` lookup)
**Complexity**: Low (3-line insertion, no API changes)

```javascript
// Same-phase bypass: sub-agent calls within the current phase are allowed
if (delegation.targetPhase === currentPhase) {
    debugLog('Same-phase delegation to', currentPhase, '- allowing');
    return { decision: 'allow' };
}
```

**Null safety**: Both `delegation.targetPhase` and `currentPhase` have been null-checked by this point in the flow:
- `delegation.targetPhase` is non-null because `delegation.isDelegation` was true (line 40-43)
- `currentPhase` is non-null because of the guard at line 61-64

**Observability**: Add a `logHookEvent()` call for the same-phase bypass to make it visible in hook activity logs:
```javascript
if (delegation.targetPhase === currentPhase) {
    logHookEvent('phase-loop-controller', 'same-phase-bypass', {
        phase: currentPhase,
        agent: delegation.agentName,
        decision: 'allow'
    });
    debugLog('Same-phase delegation to', currentPhase, '- allowing');
    return { decision: 'allow' };
}
```

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-13T08:20:00Z",
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "error_keywords": ["PHASE DELEGATION WITHOUT PROGRESS TRACKING", "phase status", "pending", "not set", "in_progress"],
  "files_traced": [
    "src/claude/hooks/phase-loop-controller.cjs",
    "src/claude/hooks/lib/common.cjs",
    "src/claude/hooks/dispatchers/pre-task-dispatcher.cjs",
    "src/claude/hooks/config/skills-manifest.json",
    "src/claude/hooks/tests/phase-loop-controller.test.cjs"
  ],
  "related_bugs": ["BUG-0006", "BUG-0008", "BUG-0009", "BUG-0011", "BUG-0012"],
  "hypotheses_count": 3,
  "primary_hypothesis": "Missing same-phase bypass in check() function",
  "root_cause_confidence": "high"
}
```
