# Trace Analysis: BUG-0003-fix-plan-tracking

**Bug ID:** BUG-0003
**Traced by:** Tracing Phase (Phase 02)
**Date:** 2026-02-09
**Status:** Root causes identified

---

## Executive Summary

All three symptoms trace to **instruction-level defects** in the Phase-Loop Controller protocol and supporting documentation. There are no code bugs (no hooks, no lib, no CLI code is involved). The root causes are:

1. **Phase key mismatch** between `workflows.json` (runtime source of truth) and the `isdlc.md` STEP 2 lookup table, causing lookup failures that produce inconsistent or missing task subjects
2. **Strikethrough relies on `subject` field update**, which the instructions specify correctly but the orchestrator's PROGRESS TRACKING section has a parallel (and outdated) fix workflow example that omits `02-tracing` — causing confusion about which phases exist
3. **No explicit cleanup step** in STEP 4 (FINALIZE) — the instructions tell the orchestrator to finalize, but never tell the Phase-Loop Controller to clean up or mark remaining tasks as complete

---

## Symptom 1: Task Numbering Not Sequential

### Observed Behavior

Tasks appear without proper `[1]`, `[2]`, `[3]` sequential prefixes, or numbering has gaps.

### Execution Path

1. User invokes `/isdlc fix "description"`
2. `isdlc.md` Phase-Loop Controller STEP 1 launches orchestrator with `MODE: init-and-phase-01`
3. Orchestrator initializes workflow, reads phases from `workflows.json` fix definition (line 77-85):
   ```json
   ["01-requirements", "02-tracing", "05-test-strategy", "06-implementation",
    "11-local-testing", "07-testing", "10-cicd", "08-code-review"]
   ```
4. Orchestrator returns these phases in the structured result
5. `isdlc.md` STEP 2 iterates over the phases array and looks up each phase key in the table (lines 732-751)

### Root Cause: Phase Key Mismatch

**The lookup table in `isdlc.md` (STEP 2, lines 732-751) uses DIFFERENT phase keys than `workflows.json` (the runtime source of truth).**

| workflows.json key | isdlc.md table key | Match? |
|--------------------|--------------------|--------|
| `01-requirements` | `01-requirements` | YES |
| `02-tracing` | `02-tracing` | YES |
| `05-test-strategy` | `04-test-strategy` | **NO** |
| `06-implementation` | `05-implementation` | **NO** |
| `11-local-testing` | `10-local-testing` | **NO** |
| `07-testing` | `06-testing` | **NO** |
| `10-cicd` | `09-cicd` | **NO** |
| `08-code-review` | `07-code-review` | **NO** |

**6 out of 8 phase keys do not match.** When the Phase-Loop Controller iterates over the phases array and tries to look up `05-test-strategy` in the table, it finds no entry. The LLM executing the instructions must then improvise — it may use a close match, skip the prefix, or generate its own text. This produces inconsistent numbering.

**The same mismatch exists for feature workflows:**

| workflows.json (feature) | isdlc.md table key | Match? |
|---------------------------|--------------------|--------|
| `00-quick-scan` | (not in table) | **NO** |
| `01-requirements` | `01-requirements` | YES |
| `02-impact-analysis` | (not in table) | **NO** |
| `03-architecture` | `02-architecture` | **NO** |
| `04-design` | `03-design` | **NO** |
| `05-test-strategy` | `04-test-strategy` | **NO** |
| `06-implementation` | `05-implementation` | **NO** |
| `11-local-testing` | `10-local-testing` | **NO** |
| `07-testing` | `06-testing` | **NO** |
| `10-cicd` | `09-cicd` | **NO** |
| `08-code-review` | `07-code-review` | **NO** |

**10 out of 11 phase keys do not match.**

### Secondary Issue: Orchestrator Fix Example Outdated

The orchestrator `00-sdlc-orchestrator.md` at lines 2178-2186 shows a fix workflow example with only 6 tasks:
```
TaskCreate: "[1] Capture bug report (Phase 01)"
TaskCreate: "[2] Implement fix with TDD (Phase 05)"
TaskCreate: "[3] Build and launch local environment (Phase 10)"
TaskCreate: "[4] Run integration and E2E tests (Phase 06)"
TaskCreate: "[5] Configure CI/CD pipelines (Phase 09)"
TaskCreate: "[6] Perform code review and QA (Phase 07)"
```

This is missing `02-tracing` and `05-test-strategy` (which ARE in `workflows.json` fix definition). The example was written before `02-tracing` was added to the fix workflow. This stale example causes the orchestrator (in full-workflow mode) to create incorrect task counts.

### Additional Secondary Issue: isdlc.md Fix Phases Inline

`isdlc.md` line 244 hardcodes the fix phases as:
```
["01-requirements", "02-tracing", "04-test-strategy", "05-implementation",
 "10-local-testing", "06-testing", "09-cicd", "07-code-review"]
```

These use the OLD numbering scheme (`04-test-strategy` instead of `05-test-strategy`, etc.), creating yet another inconsistency with `workflows.json`.

---

## Symptom 2: Completed Tasks Not Struck Through

### Observed Behavior

When a phase completes, the task shows a checkmark (via `status: "completed"`) but the subject text is not visually crossed out with `~~strikethrough~~`.

### Execution Path

1. Phase completes inside the orchestrator (single-phase mode)
2. Orchestrator returns `{"status": "passed", "phase_completed": "...", ...}`
3. `isdlc.md` STEP 3e reads the result and says:
   > Mark task as `completed` **with strikethrough**: update both `status` to `completed` AND `subject` to `~~[N] {base subject}~~`

4. The Phase-Loop Controller must call `TaskUpdate` with BOTH `status: "completed"` AND `subject: "~~[N] {base subject}~~"`

### Root Cause: Instruction Ambiguity and API Behavior

The instructions ARE present (lines 757 and 797 in isdlc.md), but there are two problems:

**Problem A: The executing LLM must reconstruct the original subject to wrap it in `~~`.**

The instruction says to update subject to `~~[N] {base subject}~~`. But at the point of execution (STEP 3e), the executing agent must:
1. Know what `N` was for this phase (the sequential number assigned in STEP 2)
2. Know the `{base subject}` text for this phase
3. Reconstruct `~~[N] {base subject}~~` as the new subject

The instructions do not tell the agent to remember the task IDs or subjects from STEP 2. The agent must either:
- Read the current task subject from the task list and wrap it in `~~`
- Or reconstruct it from the lookup table (which has mismatched keys — see Symptom 1)

**Neither path is reliable.** If the keys don't match the table, the agent cannot look up the base subject. If it tries to read the current task, the TaskUpdate API requires a `taskId` — but the instructions never map phase keys to task IDs.

**Problem B: No task-ID-to-phase mapping is maintained.**

STEP 2 creates tasks and STEP 3 needs to update them. But there is no instruction to save the mapping of `{phase_key} -> {taskId}`. The Phase-Loop Controller is told to "mark the phase task" but must figure out which task ID corresponds to which phase. With 8 tasks and sequential numbering, the mapping SHOULD be implicit (phase index = task creation order), but this is not stated explicitly.

**Problem C: The orchestrator's PROGRESS TRACKING section (line 2156) says to update with strikethrough:**
> After gate passes: Mark that phase's task as `completed` **with strikethrough** using `TaskUpdate` — update both `status` to `completed` AND `subject` to `~~[N] {base subject}~~`

But in controlled modes (init-and-phase-01, single-phase, finalize), the orchestrator is told NOT to create tasks (Task List Suppression, line 1165). So who is responsible for the strikethrough update? The Phase-Loop Controller in isdlc.md. But the Phase-Loop Controller only knows about phase keys, not task IDs.

---

## Symptom 3: Task List Not Cleaned Up After Workflow Completion

### Observed Behavior

After a workflow completes (or is cancelled), stale tasks remain in the task list showing their last state.

### Execution Path

1. All phases complete
2. `isdlc.md` STEP 4 launches orchestrator with `MODE: finalize`
3. Orchestrator runs Human Review Checkpoint (if enabled), merges branch, clears `active_workflow`
4. Orchestrator returns `{"status": "completed", "merged": true, ...}`
5. Phase-Loop Controller... does nothing with the task list

### Root Cause: No Cleanup Instructions in STEP 4

**STEP 4 (lines 801-811 in isdlc.md) has NO instructions to clean up the task list.**

The step says:
```
After all phases complete:
  Use Task tool -> sdlc-orchestrator with:
    MODE: finalize
    (include MONOREPO CONTEXT if applicable)

The orchestrator runs the Human Review Checkpoint (if code_review.enabled),
merges the branch, and clears the workflow.
```

After the orchestrator returns, the Phase-Loop Controller does not:
- Mark any remaining tasks as completed
- Delete the tasks
- Update task subjects to show workflow completion

The orchestrator's finalize mode (line 1159) also does not mention task cleanup:
> 3. **finalize**: Run the Human Review Checkpoint (Section 3b, if `code_review.enabled`). Merge the branch back to main (Section 3a). Clear `active_workflow` from state.json. Return structured result.

There is no task-related step in finalize.

**For cancellation:** Similarly, the orchestrator's cancellation process (Section 3, Cancellation Process) says at step 2154:
> On workflow cancellation: Do NOT update remaining tasks (they will be discarded with the context)

This assumes that when the conversation context ends, tasks disappear. But in practice, tasks persist within the same Claude Code session. If the user cancels a workflow and starts another, stale tasks from the cancelled workflow remain visible.

---

## Root Cause Summary

| Symptom | Root Cause | Category | Severity |
|---------|-----------|----------|----------|
| Numbering inconsistent | Phase keys in `workflows.json` don't match lookup table in `isdlc.md` STEP 2 | Instruction defect (key mismatch) | **High** |
| Numbering inconsistent | Orchestrator fix example (line 2181-2186) missing 2 phases | Stale documentation | Medium |
| Numbering inconsistent | `isdlc.md` line 244 hardcodes wrong phase keys | Stale documentation | Medium |
| No strikethrough | Phase-key-to-task-ID mapping not maintained between STEP 2 and STEP 3 | Instruction gap | **High** |
| No strikethrough | Agent must reconstruct subject from mismatched lookup table | Cascading from key mismatch | High |
| No cleanup | STEP 4 has zero task cleanup instructions | Instruction omission | **High** |
| No cleanup | Cancellation assumes tasks vanish with context (they don't) | Wrong assumption | Medium |

---

## Affected Files

### Primary (must be fixed)

1. **`src/claude/commands/isdlc.md`** — Phase-Loop Controller
   - STEP 2 (lines 726-759): Phase key lookup table must match `workflows.json` keys
   - STEP 2: Need explicit instruction to save phase-to-taskId mapping
   - STEP 3e (line 797): Strikethrough update needs to reference saved taskId and current subject
   - STEP 4 (lines 801-811): Missing cleanup instructions after finalize

2. **`src/claude/agents/00-sdlc-orchestrator.md`** — Orchestrator agent
   - Lines 2178-2186: Fix workflow example missing `02-tracing` and `05-test-strategy`
   - Lines 2128-2146: Phase key lookup table must match `workflows.json` keys
   - Line 2154: Cancellation note about tasks assumes they vanish (incorrect)

### Secondary (discrepancy only, not blocking)

3. **`src/isdlc/config/workflows.json`** — Source of truth for phase keys
   - This file is CORRECT. The numbering here (05-test-strategy, 06-implementation, etc.) is the canonical scheme.
   - The other two files must be updated to match this file.

---

## Fix Recommendations

### Fix 1: Align Phase Key Lookup Tables (addresses Symptom 1)

Update the STEP 2 lookup table in `isdlc.md` (lines 732-751) to use the SAME phase keys as `workflows.json`:

| Current (wrong) | Correct (from workflows.json) |
|-----------------|-------------------------------|
| `04-test-strategy` | `05-test-strategy` |
| `05-implementation` | `06-implementation` |
| `10-local-testing` | `11-local-testing` |
| `06-testing` | `07-testing` |
| `09-cicd` | `10-cicd` |
| `07-code-review` | `08-code-review` |
| `02-architecture` | `03-architecture` |
| `03-design` | `04-design` |

Also add missing entries:
| Key | base subject | activeForm |
|-----|-------------|------------|
| `00-quick-scan` | Quick scan feature scope (Phase 00) | Scanning feature scope |
| `02-impact-analysis` | Analyze feature impact (Phase 02) | Analyzing feature impact |
| `12-remote-build` | Build and deploy remote environment (Phase 12) | Building remote environment |

Do the same for the orchestrator's table at lines 2128-2146.

### Fix 2: Maintain Task ID Mapping (addresses Symptom 2)

Add explicit instructions in STEP 2 to maintain a mapping:
- After creating each task, note its task ID (returned by TaskCreate)
- Store the mapping: `phase_key -> taskId` (e.g., in a local variable/list)
- In STEP 3, reference the mapping to find the correct taskId for each phase

Also add a simplified strikethrough instruction: "Read the current task subject, prepend `~~`, append `~~`" instead of requiring the agent to reconstruct from the lookup table.

### Fix 3: Add Cleanup to STEP 4 (addresses Symptom 3)

After the orchestrator returns from finalize, add explicit instructions:
- For successful completion: mark all remaining tasks as `completed` with `~~` strikethrough
- For cancellation: mark completed phases with strikethrough, mark remaining phases as `completed` with subject `[CANCELLED] {subject}`
- Or: delete all tasks after displaying a completion summary

### Fix 4: Update Stale Fix Workflow Examples

Update orchestrator lines 2178-2186 to include all 8 phases from the current `workflows.json` fix definition.

Update `isdlc.md` line 244 to match `workflows.json` phase keys.

---

## Diagnosis Summary

```json
{
  "bug_id": "BUG-0003",
  "symptoms": 3,
  "root_causes": 4,
  "category": "instruction-defect",
  "files_affected": 2,
  "code_changes_needed": 0,
  "markdown_changes_needed": 2,
  "primary_root_cause": "Phase key mismatch between workflows.json and isdlc.md/orchestrator lookup tables",
  "confidence": "high",
  "verification_method": "Direct comparison of phase keys across all 3 files"
}
```
