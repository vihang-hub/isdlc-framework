# Trace Analysis: Orchestrator Finalize Creates Tasks but Doesn't Mark Them Completed

**Generated**: 2026-02-12T21:35:00Z
**Bug**: BUG-0010 -- Orchestrator finalize creates tasks but doesn't mark them completed
**External ID**: None (internal framework bug)
**Workflow**: fix
**Phase**: 02-tracing

---

## Executive Summary

The Phase-Loop Controller in `src/claude/commands/isdlc.md` creates foreground tasks in STEP 2 and marks them completed with strikethrough in STEP 3f as each phase gate passes. After all phases complete, STEP 4 delegates to the orchestrator for finalize, then instructs a post-finalize task cleanup sweep. The cleanup sweep (lines 936-939) reliably fails because it relies on the LLM recognizing "tasks created during this workflow" after a context-disrupting sub-agent call, provides no concrete identification mechanism, and has no enforcement guaranteeing execution. The root cause is a **prompt engineering deficiency** -- the cleanup instructions are vague, context-dependent, and structurally positioned where they are easy to skip.

**Root Cause Confidence**: High
**Severity**: Medium
**Estimated Complexity**: Low (prompt-only fix in a single markdown file)

---

## Symptom Analysis

### Observed Behavior

After a workflow completes (all phases pass gates, orchestrator finalize merges branch and clears `active_workflow`), some or all tasks remain visible in the terminal in `pending` or `in_progress` state. The user must manually mark tasks as completed.

### Error Messages

No error messages are produced. This is a silent failure -- the cleanup simply does not execute, leaving stale UI state with no indication of failure.

### Triggering Conditions

1. **Any workflow type** (feature, fix, test-generate, upgrade) -- all use the Phase-Loop Controller
2. **After successful completion** -- the bug manifests specifically when everything succeeds
3. **Most visible with longer workflows** (6+ phases) where more tasks accumulate
4. **Reproduction is consistent** -- occurs on every workflow completion

### Source File Locations

| Location | Lines | Content |
|----------|-------|---------|
| `src/claude/commands/isdlc.md` STEP 2 | 713-744 | Task creation with `[N]` numbering, `{phase_key -> task_id}` mapping instruction |
| `src/claude/commands/isdlc.md` STEP 3f | 919-922 | Per-phase task completion with strikethrough on successful gate pass |
| `src/claude/commands/isdlc.md` STEP 4 | 924-939 | Finalize delegation + post-finalize cleanup sweep |

### Symptom Taxonomy

- **Category**: UI/UX state leakage -- internal workflow completes but user-visible state is stale
- **Frequency**: Every workflow completion (100% reproduction rate)
- **Affected tasks**: Primarily the last phase task (STEP 3f may or may not fire for the exit iteration) and any sub-agent-created tasks (tracing, quality-loop sub-agents create their own tasks)
- **Precedent**: BUG-0003 (commit `362d483`) added the STEP 4 cleanup instructions, confirming this was a known gap. The fix was insufficient.

---

## Execution Path

### Entry Point

User invokes `/isdlc feature "description"` or `/isdlc fix "description"`. The Phase-Loop Controller in `isdlc.md` activates.

### Execution Trace

```
STEP 1: Init
  |-- Task tool -> sdlc-orchestrator (MODE: init-and-phase-01)
  |-- Returns { phases[], artifact_folder, next_phase_index }
  |
STEP 2: Create Foreground Tasks
  |-- For each phase in phases[]:
  |     TaskCreate with subject "[N] {base subject}"
  |-- Mark Phase 01 task as completed with strikethrough
  |-- "Maintain a mapping of {phase_key -> task_id}"  <-- INSTRUCTION ONLY, NO MECHANISM
  |
STEP 3: Phase Loop (for each remaining phase)
  |-- 3a: TaskUpdate -> in_progress (spinner)
  |-- 3b: Read state.json, check escalations
  |-- 3c-prime: Write phase activation to state.json
  |-- 3d: Task tool -> phase agent (direct delegation)
  |-- 3e: Post-phase state update (state.json)
  |-- 3f: TaskUpdate -> completed with strikethrough "~~[N] subject~~"
  |        (SUCCESS PATH: task marked done)
  |-- Loop continues to next phase
  |
  |-- [FINAL ITERATION]: Phase loop completes
  |     3f fires for last phase -> marks last phase task completed
  |     Loop exits
  |
STEP 4: Finalize
  |-- Task tool -> sdlc-orchestrator (MODE: finalize)
  |     Orchestrator: Human Review -> merge -> prune -> clear active_workflow
  |     Returns { status: "completed", merged, metrics }
  |
  |-- POST-FINALIZE CLEANUP (lines 936-939):          <-- FAILURE POINT
  |     "Use TaskList to get all tasks created during this workflow"
  |     "For any task still pending/in_progress, mark completed with strikethrough"
  |
  |-- END
```

### Data Flow at Failure Point

At the moment STEP 4 post-finalize cleanup needs to execute:

1. **Task IDs**: Created in STEP 2, used throughout STEP 3. The `{phase_key -> task_id}` mapping exists only in the LLM's working memory. After the orchestrator finalize sub-agent call (which may produce hundreds of lines of output), this mapping may be partially or fully lost from context.

2. **TaskList output**: Contains ALL tasks in the session, not just workflow tasks. If this is a `fix` workflow, there may be 6 workflow tasks plus N tasks created by sub-agents (e.g., tracing orchestrator, quality-loop engineer, code-review agent). There is no label, tag, or metadata to distinguish workflow tasks from other tasks.

3. **Orchestrator context boundary**: The `Task tool -> sdlc-orchestrator` call creates a sub-agent with its own context. When it returns, the calling LLM (Phase-Loop Controller) must resume execution. But the finalize output is often long (merge results, metrics, pruning summary, completion summary), and the cleanup instructions (lines 936-939) are positioned as a post-action addendum rather than an integral part of the flow.

---

## Root Cause Analysis

### Hypothesis 1: Ambiguous Task Identification (CONFIRMED -- Primary)

**Evidence**: Line 937 says "Use TaskList to get all tasks created during this workflow" but provides NO mechanism to identify which tasks belong to the workflow.

- STEP 2 (line 717) says "Maintain a mapping of `{phase_key -> task_id}`" -- this is an instruction to the LLM to remember the mapping, not a durable storage mechanism
- TaskCreate does not accept tags, labels, or metadata fields for grouping
- TaskList returns ALL tasks in the session, with no filtering capability
- After the orchestrator finalize sub-agent call, the LLM's working memory of task IDs from STEP 2 may be degraded

**Severity**: HIGH -- This makes cleanup unreliable even if the instruction IS executed.

**Fix direction**: Instead of relying on the LLM to identify "workflow tasks", scan ALL non-completed tasks from TaskList and mark them completed. Since the Phase-Loop Controller is the last thing running in the session, any remaining tasks are necessarily stale.

### Hypothesis 2: Post-Finalize Execution Gap (CONFIRMED -- Contributing)

**Evidence**: Lines 936-939 are structured as a post-action advisory rather than a mandatory step.

The instruction reads:
```
**After the orchestrator returns from finalize**, clean up all workflow tasks:
1. Use TaskList to get all tasks created during this workflow
2. For any task still showing as pending or in_progress, mark it as completed...
3. This ensures the task list accurately reflects...
```

Problems:
- The bold text "After the orchestrator returns from finalize" is a conditional trigger that depends on the LLM correctly resuming after a long sub-agent output
- Item 3 is explanatory rationale, not an actionable step -- it wastes instruction space
- No enforcement mechanism (hook, state check, or gate) guarantees this runs
- The cleanup is described AFTER the orchestrator call block, making it visually subordinate
- Compare to STEP 3f which is a numbered sub-step WITHIN the loop -- the cleanup should have the same structural prominence

**Severity**: MEDIUM -- Even with better task identification, the cleanup will not run if this instruction is skipped.

**Fix direction**: Restructure STEP 4 to make cleanup a mandatory, numbered sub-step with explicit iteration. Add a `CRITICAL:` marker. Consider making it the FIRST action after finalize returns, not a trailing note.

### Hypothesis 3: Final Phase Edge Case in STEP 3f (PARTIALLY CONFIRMED -- Minor)

**Evidence**: STEP 3f (line 919-922) fires on EVERY phase return including the last one. The flow is:

```
Loop iteration N (last phase):
  3a -> in_progress
  3d -> delegate to agent
  3e -> state update
  3f -> mark task completed with strikethrough  <-- THIS FIRES
  Loop exits (no more phases)
STEP 4: Finalize
```

The loop structure means STEP 3f DOES fire for the last phase before STEP 4. However:
- Sub-agents spawned by phase agents (e.g., tracing sub-agents T1/T2/T3, quality-loop sub-tasks) create their OWN tasks that STEP 3f does not clean up
- If STEP 3f fails for any reason on the last phase (LLM skips it due to long agent output), there is no fallback

**Severity**: LOW for the main loop (3f appears reliable for the last phase), MEDIUM for sub-agent tasks (not addressed by 3f at all).

**Fix direction**: STEP 4 cleanup must be a catch-all that handles both skipped 3f completions AND sub-agent-created tasks.

### Hypothesis 4: Sub-Agent Task Proliferation (NEW -- Identified During Tracing)

**Evidence**: The tracing orchestrator (this very agent) creates its own tasks (e.g., "Parse bug description", "Launch parallel sub-agents", etc.). The quality-loop engineer similarly creates sub-tasks. These tasks are NEVER addressed by STEP 3f (which only knows about the main phase tasks from STEP 2) and are not reliably addressed by STEP 4 cleanup (which has the identification problem from H1).

This means even if STEP 3f perfectly marks all 6 phase tasks as completed, the sub-agent tasks remain stale.

**Severity**: MEDIUM -- This is a second category of stale tasks beyond the main phase tasks.

**Fix direction**: The STEP 4 cleanup must use a `TaskList -> mark ALL non-completed tasks` approach, not a selective "workflow tasks only" approach.

---

## Suggested Fixes

### Fix 1: Rewrite STEP 4 Cleanup (Primary -- Addresses H1, H2, H4)

Replace lines 936-939 with an explicit, self-sufficient cleanup protocol:

```markdown
**CRITICAL -- MANDATORY CLEANUP (must execute even if finalize output is long):**

After the orchestrator returns from finalize, execute this cleanup loop:

1. Call `TaskList` to retrieve ALL tasks
2. For EACH task in the list:
   a. If task status is `pending` or `in_progress`:
      - Call `TaskUpdate` with status `completed`
      - If subject does NOT already start with `~~`:
        update subject to `~~{current_subject}~~`
3. This loop must complete before the Phase-Loop Controller exits
```

Key improvements:
- Processes ALL tasks (not just "workflow tasks") -- eliminates H1 identification problem
- Uses `CRITICAL` marker and explicit loop -- addresses H2 execution gap
- Handles sub-agent tasks -- addresses H4
- Includes idempotency guard (`does NOT already start with ~~`) -- addresses AC-03b

### Fix 2: Add Task ID Array to STEP 2 (Optional Enhancement)

In STEP 2, after creating all tasks, emit an explicit instruction to store the task IDs:

```markdown
Store the complete list of task IDs as `workflow_task_ids = [id1, id2, ...]` for use in STEP 4 cleanup.
```

This provides a fallback if the "mark ALL" approach in Fix 1 is too aggressive for some use case. However, Fix 1 alone is sufficient since after workflow completion, all remaining tasks SHOULD be completed.

### Fix 3: Defensive Check in STEP 3f (Minor Robustness)

Add a note to STEP 3f that sub-agent tasks are NOT handled here and will be caught by STEP 4 cleanup. This prevents future confusion about the division of responsibility.

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-12T21:35:00Z",
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "error_keywords": ["stale tasks", "TaskList", "TaskUpdate", "strikethrough", "finalize", "STEP 4", "cleanup"],
  "files_traced": [
    "src/claude/commands/isdlc.md (lines 713-744, 919-922, 924-939)",
    "src/claude/agents/00-sdlc-orchestrator.md (lines 630-691, 1106-1119)"
  ],
  "hypotheses_count": 4,
  "confirmed_hypotheses": ["H1-ambiguous-identification", "H2-execution-gap", "H3-final-phase-edge", "H4-sub-agent-proliferation"],
  "primary_root_cause": "H1 + H2: Vague task identification combined with non-mandatory cleanup instruction",
  "related_commits": ["362d483 (BUG-0003: first attempt at adding STEP 4 cleanup)"],
  "related_bugs": ["BUG-0003", "BUG-0005", "BUG-0006"]
}
```
