# Bug Report: BUG-0010 — Orchestrator Finalize Creates Tasks but Doesn't Mark Them Completed

**ID**: BUG-0010
**Type**: Bug Fix
**Severity**: Medium
**Component**: Phase-Loop Controller (isdlc.md STEP 4)
**Created**: 2026-02-12

---

## Problem Statement

After the orchestrator finalize step completes a workflow, the Phase-Loop Controller in `isdlc.md` (STEP 4) instructs to clean up tasks. However, this cleanup step is either not executing properly or is being skipped, leaving stale tasks visible in the terminal after workflow completion. The user has to manually mark tasks as completed.

## Reproduction Steps

1. Start any workflow with a description (e.g., `/isdlc feature "some feature"` or `/isdlc fix "some bug"`)
2. The Phase-Loop Controller creates foreground tasks via `TaskCreate` in STEP 2
3. Let the workflow run through all phases (STEP 3 loop)
4. When all phases complete, the orchestrator finalize runs (STEP 4)
5. **Expected**: All tasks are marked completed with strikethrough after finalize returns
6. **Actual**: Tasks remain in `pending` or `in_progress` state after workflow completion

## Root Cause Analysis

The cleanup logic in STEP 4 (lines 936-939 of `isdlc.md`) is structurally correct but has two reliability issues:

### Issue 1: Ambiguous Task Identification

The instruction says "Use TaskList to get all tasks created during this workflow" but provides no mechanism to identify WHICH tasks belong to the current workflow vs. pre-existing tasks. The Phase-Loop Controller has no stored mapping of task IDs to workflow phases after finalize returns.

**Evidence**: In STEP 2, tasks are created with sequential `[N]` numbering but the mapping of `{phase_key -> task_id}` is only described as something to "maintain" -- it exists only in the LLM's working memory during the phase loop. After the orchestrator finalize sub-agent returns, that context may be partially or fully lost.

### Issue 2: Post-Finalize Execution Gap

The finalize step uses the Task tool to delegate to `sdlc-orchestrator`. When that sub-agent returns, the Phase-Loop Controller must resume execution to run the cleanup. But:
- The cleanup instructions are in a subsection that can be overlooked after a long orchestrator output
- There is no enforcement mechanism (like a hook) to guarantee the cleanup runs
- The "After the orchestrator returns from finalize" phrasing is easy to skip when the orchestrator's response is long and includes a completion summary

### Issue 3: Phase Loop STEP 3f Already Handles Completion

Each phase's task IS being marked completed by STEP 3f on successful gate pass. The problem is specifically with the LAST phase -- when the phase loop exits, the final phase's STEP 3f strikethrough may execute, but then the code transitions to STEP 4 where the finalize orchestrator call happens. The question is whether STEP 3f runs for the final phase before STEP 4 starts. The current ordering suggests yes (3f fires on every phase return including the last), but the finalize call in STEP 4 does NOT have explicit instructions to mark the code-review task completed first.

## Affected Files

| File | Role |
|------|------|
| `src/claude/commands/isdlc.md` | Phase-Loop Controller — STEP 4 cleanup logic |
| `src/claude/agents/00-sdlc-orchestrator.md` | Orchestrator finalize mode (does NOT create/manage tasks per line 1108) |

## Requirements

### REQ-BUG10-01: Robust Task Cleanup After Finalize

The Phase-Loop Controller MUST reliably mark all workflow tasks as completed after the orchestrator finalize step returns, regardless of:
- How many tasks were created
- Whether the LLM context has shifted during the orchestrator sub-agent call
- The length of the orchestrator's finalize output

**Acceptance Criteria**:
- AC-01a: After a successful workflow completion, zero tasks remain in `pending` or `in_progress` state
- AC-01b: All completed tasks have strikethrough formatting in their subjects (`~~[N] subject~~`)
- AC-01c: The cleanup is deterministic -- it does not depend on the LLM "remembering" task IDs from earlier in the conversation

### REQ-BUG10-02: Task ID Persistence

The Phase-Loop Controller MUST maintain a durable mapping of workflow task IDs that survives the orchestrator finalize sub-agent call.

**Acceptance Criteria**:
- AC-02a: Task IDs created in STEP 2 are available for cleanup in STEP 4
- AC-02b: The mapping mechanism is explicit (not dependent on LLM working memory)

### REQ-BUG10-03: Idempotent Cleanup

The cleanup step MUST be idempotent -- marking an already-completed task as completed again should not cause errors or duplicate entries.

**Acceptance Criteria**:
- AC-03a: Calling TaskUpdate on an already-completed task does not fail
- AC-03b: Calling TaskUpdate with the same strikethrough subject on an already-strikethrough task does not corrupt the subject

## Proposed Fix Direction

Strengthen STEP 4 of `isdlc.md` to make the cleanup self-sufficient:

1. **Use `TaskList` as the source of truth** -- after finalize, call `TaskList` and scan ALL tasks for any that are not `completed`. Mark them completed. This removes dependency on stored task IDs.
2. **Add explicit instructions** that STEP 4 cleanup is MANDATORY and must execute even if the finalize output is long.
3. **Make the cleanup the FINAL action** in the Phase-Loop Controller flow -- nothing else should execute after it.

## Non-Functional Requirements

- NFR-01: Fix must not add latency to the workflow (TaskList + TaskUpdate calls are lightweight)
- NFR-02: Fix must not require changes to the orchestrator agent (keep separation of concerns)
- NFR-03: Fix must work for all workflow types (feature, fix, test-run, test-generate, upgrade)

## External Links

- None (internal framework bug)
