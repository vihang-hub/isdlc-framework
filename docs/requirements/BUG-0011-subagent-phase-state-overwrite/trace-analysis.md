# Trace Analysis: Subagent Phase State Overwrite (BUG-0011)

**Generated**: 2026-02-13T00:30:00Z
**Bug**: Phase-sequence-guard false blocks caused by subagents overwriting active_workflow.current_phase
**External ID**: BUG-0011
**Workflow**: fix
**Phase**: 02-tracing

---

## Executive Summary

Subagents delegated via the Task tool overwrite orchestration-critical fields (`active_workflow.current_phase`, `current_phase_index`, `phase_status`) in `.isdlc/state.json`, regressing the Phase-Loop Controller's STEP 3c-prime state advancement. This causes the `phase-sequence-guard` hook to block subsequent phase delegations with "OUT-OF-ORDER PHASE DELEGATION" errors. The root cause is a **semantic-level protection gap** in `state-write-validator.cjs`: V7 (optimistic locking, BUG-0009) prevents version-stale writes but does not prevent writes with a current version that contain regressed phase orchestration field values. The fix is a new V8 rule that detects and blocks writes where `current_phase_index` regresses or `phase_status` entries move backward (e.g., `completed` to `pending`).

**Root Cause Confidence**: HIGH
**Severity**: HIGH
**Estimated Complexity**: LOW-MEDIUM

---

## Symptom Analysis

### Error Messages

The user observes the following error from `phase-sequence-guard.cjs` (line 88-99):

```
OUT-OF-ORDER PHASE DELEGATION: Attempting to delegate to phase
'{next_phase}' (agent: {agent_name}), but the current workflow
phase is '{stale_phase}'.

Phases must execute in the order defined by the workflow. You cannot
skip ahead or go back to a previous phase without advancing through
the gate.
```

### Triggering Conditions

1. **Multi-phase workflow**: Any workflow with 2+ phases (feature, fix)
2. **Phase agent writes state**: The delegated subagent writes back to `.isdlc/state.json` during or after its work
3. **Timing**: The subagent's write includes `active_workflow.current_phase` set to the value it READ at the start (which was correct at read time but is now stale because STEP 3e has advanced it)
4. **Symptom appears on NEXT delegation**: The Phase-Loop Controller's next STEP 3c-prime writes the new phase, but then the stale subagent write lands, regressing the state. The next `PreToolUse[Task]` check by `phase-sequence-guard` reads the regressed state and blocks.

### Frequency

This is a **systematic** bug, not intermittent. It occurs whenever a subagent writes state.json and includes the full `active_workflow` object. The race window is between the subagent's Task tool return and the Phase-Loop Controller's STEP 3e write.

### Affected Scope

- All multi-phase workflows (feature 9 phases, fix 6 phases)
- All phase agents that write to state.json (most do)
- Most commonly observed during transitions between consecutive phases

---

## Execution Path

### Entry Point

The Phase-Loop Controller in `/Users/vihangshah/enactor-code/isdlc/src/claude/commands/isdlc.md` (STEP 3a-3e) manages the phase execution loop.

### Detailed Call Chain

```
STEP 3b: Phase-Loop Controller reads state.json (current_phase = "16-quality-loop", index = 6)
    |
STEP 3c-prime: Pre-delegation state update
    |-- Writes state.json:
    |     active_workflow.current_phase = "16-quality-loop"
    |     active_workflow.current_phase_index = 6
    |     active_workflow.phase_status["16-quality-loop"] = "in_progress"
    |-- File: /Users/vihangshah/enactor-code/isdlc/src/claude/commands/isdlc.md (line 776-786)
    |
STEP 3d: Delegate to quality-loop-engineer via Task tool
    |-- PreToolUse[Task] fires: pre-task-dispatcher.cjs
    |     |-- phase-sequence-guard.cjs checks: target="16-quality-loop", current="16-quality-loop" -> ALLOW
    |     File: /Users/vihangshah/enactor-code/isdlc/src/claude/hooks/dispatchers/pre-task-dispatcher.cjs (line 67)
    |     File: /Users/vihangshah/enactor-code/isdlc/src/claude/hooks/phase-sequence-guard.cjs (line 71)
    |
    |-- Subagent executes Phase 16 work
    |     |-- Reads state.json (sees current_phase = "16-quality-loop", index = 6)
    |     |-- Does quality loop work
    |     |-- Writes state.json back (includes full active_workflow with current_phase = "16-quality-loop", index = 6)
    |     |     PostToolUse[Write] fires: post-write-edit-dispatcher.cjs
    |     |       |-- state-write-validator.cjs check():
    |     |       |     V7: incoming version >= disk version -> ALLOW (not a version regression)
    |     |       |     V1-V3: content validation (observational only)
    |     |       |     **NO V8**: no phase field regression check exists
    |     |       File: /Users/vihangshah/enactor-code/isdlc/src/claude/hooks/dispatchers/post-write-edit-dispatcher.cjs (line 79-85)
    |     |       File: /Users/vihangshah/enactor-code/isdlc/src/claude/hooks/state-write-validator.cjs (line 204-208)
    |
    |-- Subagent returns to Phase-Loop Controller
    |
STEP 3e: Post-phase state update
    |-- Phase-Loop Controller reads state.json (sees the subagent's write: current_phase still "16-quality-loop")
    |-- Advances: current_phase_index = 6 + 1 = 7
    |-- Sets phase_status["16-quality-loop"] = "completed"
    |-- Writes state.json
    |
    [NEXT ITERATION]
    |
STEP 3c-prime: Pre-delegation state update for next phase
    |-- Reads state.json
    |-- Sets current_phase = "08-code-review", index = 7
    |-- Writes state.json
    |
STEP 3d: Delegate to qa-engineer via Task tool
    |-- PreToolUse[Task] fires: pre-task-dispatcher.cjs
    |     |-- phase-sequence-guard.cjs checks:
    |     |     Reads state.json (which may have been overwritten by a LATE subagent write)
    |     |     If state has current_phase = "16-quality-loop" (regressed): BLOCK
    |     |     Error: "OUT-OF-ORDER PHASE DELEGATION"
    |     File: /Users/vihangshah/enactor-code/isdlc/src/claude/hooks/phase-sequence-guard.cjs (line 58, 71, 88-99)
```

### Data Flow Corruption Point

The corruption occurs at this specific point:

**File**: `/Users/vihangshah/enactor-code/isdlc/src/claude/hooks/state-write-validator.cjs`
**Location**: `check()` function, lines 204-208
**Gap**: After V7 passes (version check OK), the function proceeds to V1-V3 content validation (observational only). There is NO check for phase orchestration field regression between V7 and V1-V3.

The subagent writes state.json with:
- `state_version` >= disk version (V7 passes)
- `active_workflow.current_phase` = stale value (no V8 to catch it)
- `active_workflow.current_phase_index` = stale value (no V8 to catch it)
- `active_workflow.phase_status` = stale values (no V8 to catch it)

### Why V7 Does Not Catch This

V7 (`checkVersionLock`, line 106-173) only compares `state_version` numbers:

```javascript
if (incomingVersion < diskVersion) {
    // BLOCK
}
```

The subagent's write has `state_version >= diskVersion` because it was read recently (within the same Task delegation). The `writeState()` function in common.cjs (line 651-685) auto-increments `state_version`, so the subagent's write gets a valid version. V7 sees a valid version and allows the write.

The semantic regression of `current_phase_index` from 7 back to 6 is invisible to V7.

---

## Root Cause Analysis

### Primary Hypothesis (Confidence: HIGH)

**Missing semantic field protection in state-write-validator.cjs**

The `state-write-validator.cjs` hook validates state.json writes for:
- V1-V3: Content integrity (observational warnings for fabricated data)
- V7: Version-based optimistic locking (blocks stale writes by version number)

It does NOT validate:
- V8 (missing): Phase orchestration field regression (current_phase, current_phase_index, phase_status)

Evidence supporting this hypothesis:
1. The `check()` function at line 182-251 has a clear gap between V7 (line 204-208) and V1-V3 (line 210-238)
2. No code anywhere in the hook examines `active_workflow.current_phase` or `current_phase_index`
3. The `PROTECTED_STATE_FIELDS` array in common.cjs (line 29-36) does not include `active_workflow.current_phase` or `current_phase_index`
4. The bug report's reproduction steps exactly match this gap

### Secondary Finding: PostToolUse vs PreToolUse Architecture

The `post-write-edit-dispatcher.cjs` (line 10) states: "All hooks run (no short-circuit -- PostToolUse is observational)." The dispatcher at line 82 only captures `result.stderr`, silently discarding `result.decision` and `result.stopReason`. This means:

1. V7 block decisions returned from `check()` are **swallowed** by the dispatcher
2. V7 only effectively blocks in standalone mode (not through the dispatcher)
3. V8 will have the same limitation if added only to the `check()` function

However, there is a critical architectural nuance: for PreToolUse[Write], the file has NOT been written yet, so disk has the OLD state. For PostToolUse[Write], the file HAS been written, so disk has the NEW state (same as incoming). V7's comparison of incoming version vs disk version is only meaningful in PreToolUse.

**Implication for V8**: The V8 rule comparing incoming `current_phase_index` against disk `current_phase_index` MUST run before the write lands. There are two approaches:
1. Register state-write-validator as PreToolUse[Write] in addition to PostToolUse (preferred)
2. Have the post-write-edit-dispatcher propagate block decisions to stdout

The requirements spec says "V8 runs only on Write events" and "compares incoming content against disk." For this to work, the V8 check must execute where disk still has the pre-write state.

### Alternative Hypothesis (Confidence: LOW)

**Race condition in writeState auto-increment**: The `writeState()` function in common.cjs reads disk version, increments, and writes. If two writers (Phase-Loop Controller and subagent) call `writeState()` near-simultaneously, the auto-increment could allow both writes to succeed with valid versions but conflicting content. This is a valid concern but secondary -- the primary issue is the missing field-level protection.

### Suggested Fix

**Add V8 rule (`checkPhaseFieldProtection`) to `state-write-validator.cjs`**:

1. Parse incoming content from `tool_input.content`
2. Read current disk state
3. Compare `active_workflow.current_phase_index`: block if incoming < disk
4. Compare `active_workflow.phase_status` entries: block if any regress (`completed` -> `pending`, etc.)
5. Fail-open on all errors (missing fields, parse failures, etc.)
6. Only apply to Write events (not Edit)

**Implementation location**: `/Users/vihangshah/enactor-code/isdlc/src/claude/hooks/state-write-validator.cjs`
- New function: `checkPhaseFieldProtection(filePath, toolInput, toolName)`
- Called after V7 check in `check()` function (line 208)
- Returns `{ decision: 'block', stopReason }` or `null`

**Complexity**: LOW -- follows the exact same pattern as V7's `checkVersionLock()`. The function structure, error handling, and fail-open logic are already established.

**Files to modify**:
1. `/Users/vihangshah/enactor-code/isdlc/src/claude/hooks/state-write-validator.cjs` -- add V8 rule
2. `/Users/vihangshah/enactor-code/isdlc/src/claude/hooks/tests/state-write-validator.test.cjs` -- add V8 tests
3. `/Users/vihangshah/enactor-code/isdlc/.claude/hooks/state-write-validator.cjs` -- sync runtime copy

### Phase Status Regression Ordering

For V8's phase_status check, the valid progression ordering is:

```
"pending" (0) -> "in_progress" (1) -> "completed" (2)
```

A regression is any transition where the new ordinal is less than the old ordinal:
- `completed` (2) -> `pending` (0) = BLOCK (regression of 2)
- `completed` (2) -> `in_progress` (1) = BLOCK (regression of 1)
- `in_progress` (1) -> `pending` (0) = BLOCK (regression of 1)
- `pending` (0) -> `in_progress` (1) = ALLOW (forward progress)
- `in_progress` (1) -> `completed` (2) = ALLOW (forward progress)
- NEW entries not on disk = ALLOW (new phase initialization)

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-13T00:30:00Z",
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "error_keywords": ["OUT-OF-ORDER PHASE DELEGATION", "current_phase", "current_phase_index", "phase_status", "state-write-validator", "phase-sequence-guard"],
  "files_traced": [
    "src/claude/hooks/state-write-validator.cjs",
    "src/claude/hooks/phase-sequence-guard.cjs",
    "src/claude/hooks/dispatchers/post-write-edit-dispatcher.cjs",
    "src/claude/hooks/dispatchers/pre-task-dispatcher.cjs",
    "src/claude/hooks/lib/common.cjs",
    "src/claude/commands/isdlc.md",
    "src/claude/settings.json",
    "src/claude/hooks/tests/state-write-validator.test.cjs"
  ],
  "root_cause_location": "src/claude/hooks/state-write-validator.cjs:check() lines 204-208",
  "fix_insertion_point": "Between V7 check (line 208) and V1-V3 content validation (line 210)"
}
```
