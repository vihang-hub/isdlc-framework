# Trace Analysis: Jira updateStatus at Finalize Not Implemented

**Generated**: 2026-02-23
**Bug**: Jira updateStatus at finalize not implemented -- tickets not transitioned to Done
**External ID**: GH-13
**Workflow**: fix
**Phase**: 02-tracing

---

## Executive Summary

The Jira ticket transition at workflow finalize is specified in two places (`00-sdlc-orchestrator.md` step 2.5 and `isdlc.md` STEP 4) but cannot execute because: (1) the instructions reference a conceptual adapter method `updateStatus()` that has never been mapped to the concrete two-step MCP procedure (`getTransitionsForJiraIssue` + `transitionJiraIssue`), (2) the `jira_ticket_id` field referenced by the sync step is never populated on `active_workflow` during initialization (the schema uses `external_id` instead), and (3) the finalize mode execution summary on line 668 of the orchestrator omits Jira sync from the execution sequence entirely. This is a specification gap, not a runtime error -- the agent has no executable instructions to follow.

**Root Cause Confidence**: High
**Severity**: Medium
**Estimated Complexity**: Low (markdown agent file changes only)

---

## Symptom Analysis

### Error Messages

None. This is a silent failure -- no error is thrown because the code path is never entered. The Jira ticket simply remains in its original status.

### Observable Symptoms

1. **Jira ticket not transitioned**: After workflow finalize, Jira tickets remain in "To Do" or "In Progress" instead of moving to "Done"
2. **Missing `jira_sync_status` in workflow_history**: The `workflow_history` entries for completed Jira-backed workflows do not contain a `jira_sync_status` field
3. **No MCP tool calls**: No `getTransitionsForJiraIssue` or `transitionJiraIssue` calls are made during finalize
4. **No warning messages**: Because the sync step is skipped (not failed), no warnings are logged

### Triggering Conditions

- Workflow must be Jira-backed (source detected as "jira" by `detectSource()`)
- Workflow must complete all phases through to finalize
- Atlassian MCP must be configured (but irrelevant since the step is never reached)

### Comparison: GitHub Sync vs Jira Sync

The **GitHub sync** in `isdlc.md` (lines 2248-2251) has concrete executable instructions:
```
- Extract the issue number from source_id (e.g., GH-55 -> 55)
- Run `gh issue close N` to close the GitHub issue
- If the command fails, log a warning and continue
```

The **Jira sync** (lines 2243-2246) has only a conceptual reference:
```
- Calls updateStatus(jira_ticket_id, "Done") via Atlassian MCP
```

This asymmetry confirms the Jira sync was specified at the design level but never translated to executable instructions.

---

## Execution Path

### Entry Point

The finalize flow is triggered when all workflow phases complete:

1. **`isdlc.md` STEP 4** (line 2231): After the phase loop exits, the Phase-Loop Controller delegates to the orchestrator with `MODE: finalize`
2. **`00-sdlc-orchestrator.md` Mode Behavior #3** (line 668): The orchestrator processes finalize mode

### Detailed Execution Trace

```
isdlc.md STEP 4 (line 2231)
  |
  +-> Task tool -> sdlc-orchestrator with MODE: finalize
       |
       +-> Orchestrator reads MODE: finalize
       |   (line 668)
       |
       +-> Human Review Checkpoint (if code_review.enabled)
       |
       +-> Branch Merge (Section 3a, lines 584-617)
       |   |
       |   +-> Step 1: Pre-merge commit (line 586)
       |   +-> Step 2: git checkout main && git merge (line 587)
       |   +-> Step 2.5: JIRA STATUS SYNC [SPECIFIED BUT NOT EXECUTABLE] (lines 588-601)
       |   |   |
       |   |   +-> Read active_workflow.jira_ticket_id
       |   |   |   [PROBLEM: field does not exist; schema uses external_id]
       |   |   |
       |   |   +-> If exists: call updateStatus(jira_ticket_id, "Done")
       |   |       [PROBLEM: updateStatus() is conceptual, not a real MCP tool]
       |   |
       |   +-> Step 3: BACKLOG.md COMPLETION (lines 602-615) [WORKS - has detailed procedure]
       |   +-> Step 4: Merge conflict handling (line 616)
       |   +-> Step 5: Post-merge cleanup (line 617)
       |
       +-> collectPhaseSnapshots()
       +-> Prune state
       +-> Move to workflow_history
       +-> Clear active_workflow
```

### Finalize Mode Summary Gap

The finalize mode behavior summary on line 668:

```
finalize: Human Review (if enabled) -> merge branch -> BACKLOG.md completion
  -> collectPhaseSnapshots(state) -> prune -> move to workflow_history -> clear active_workflow
```

This summary **omits Jira sync** from the execution sequence entirely. The sequence jumps from "merge branch" to "BACKLOG.md completion", skipping step 2.5. Since the orchestrator agent follows the Mode Behavior summary as its primary execution guide, the Jira sync step is never reached even if the detailed specification in Section 3a was executable.

### Data Flow Gap: `jira_ticket_id` vs `external_id`

The fix workflow initialization (orchestrator lines 422-431) writes:
```json
{
  "artifact_prefix": "BUG",
  "artifact_folder": "BUG-0001-PROJ-1234",
  "external_id": "PROJ-1234",
  "external_url": "https://mycompany.atlassian.net/browse/PROJ-1234",
  "counter_used": 1
}
```

But the Jira sync step (line 589) reads:
```
Read active_workflow.jira_ticket_id
```

The field `jira_ticket_id` is **never set**. The equivalent data is stored as `external_id`. This is a field name mismatch between the initialization code and the finalize consumption point.

---

## Root Cause Analysis

### Hypothesis 1 (PRIMARY): Conceptual Adapter Method Never Translated to Concrete MCP Calls

**Confidence**: High (95%)

**Evidence**:
- `CLAUDE.md.template` (line 205) defines `updateStatus(id, status)` as a conceptual adapter method mapping to `jira_transition_issue`
- Both `00-sdlc-orchestrator.md` (line 593) and `isdlc.md` (line 2244) reference `updateStatus(jira_ticket_id, "Done")` -- a conceptual method, not a real MCP tool
- The actual Atlassian MCP tools are `getTransitionsForJiraIssue` (to discover available transitions) and `transitionJiraIssue` (to execute the transition) -- a two-step process
- The `CLAUDE.md.template` even maps `updateStatus()` to a single-step tool (`jira_transition_issue`) which is itself not the correct MCP tool name
- Compare with the GitHub sync which uses the concrete `gh issue close N` command directly

**Root Cause**: The Jira sync was designed at the adapter-pattern abstraction level but the concrete MCP tool mapping was never written into the executable agent instructions. The `updateStatus()` reference is a design intent marker, not an executable instruction.

### Hypothesis 2 (SECONDARY): Field Name Mismatch (`jira_ticket_id` vs `external_id`)

**Confidence**: High (90%)

**Evidence**:
- The fix workflow init schema (orchestrator lines 422-431) stores the Jira ticket ID as `external_id` (e.g., `"PROJ-1234"`)
- The Jira sync step (orchestrator line 589) reads `active_workflow.jira_ticket_id`
- The field `jira_ticket_id` never appears in any initialization code -- `detectSource()` in `three-verb-utils.cjs` returns `source` and `source_id`, not `jira_ticket_id`
- Even if the `updateStatus()` issue were fixed, the sync step would read `jira_ticket_id`, find it absent/null, and skip (line 590: "If jira_ticket_id is absent or null: SKIP")

**Root Cause**: The finalize step references a field (`jira_ticket_id`) that does not exist in the `active_workflow` schema. The equivalent data is stored under `external_id` (when `source === "jira"`).

### Hypothesis 3 (CONTRIBUTING): Finalize Mode Summary Omits Jira Sync

**Confidence**: High (85%)

**Evidence**:
- Line 668 (finalize mode behavior) lists: `Human Review -> merge branch -> BACKLOG.md completion -> collectPhaseSnapshots -> prune -> move to workflow_history -> clear`
- Step 2.5 (Jira sync) is specified in the Branch Merge section (lines 588-601) but is not mentioned in the finalize mode summary
- The agent executing finalize mode follows the Mode Behavior summary as its execution guide
- Even if steps 2.5 had executable instructions, the mode summary would not prompt the agent to execute them

**Root Cause**: The finalize mode summary was not updated when Jira sync was added to the Branch Merge section. The specification exists in the detailed section but not in the execution-level summary that the agent follows.

### Hypothesis Ranking

| Rank | Hypothesis | Confidence | Fix Complexity |
|------|-----------|------------|----------------|
| 1 | Conceptual adapter not translated to MCP calls | 95% | Low - add procedural instructions |
| 2 | Field name mismatch (jira_ticket_id vs external_id) | 90% | Low - align field references |
| 3 | Finalize mode summary omits Jira sync | 85% | Low - update summary line |

All three must be fixed together; any single fix is insufficient.

---

## Suggested Fixes

### Fix 1: Add Concrete MCP Procedure to Orchestrator (Primary)

In `src/claude/agents/00-sdlc-orchestrator.md`, replace the conceptual step 2.5 (lines 588-601) with executable procedural instructions:

```markdown
2.5. **JIRA STATUS SYNC (non-blocking):**
   a) Read `active_workflow.external_id` and `active_workflow.source`
   b) If `source` is not `"jira"` OR `external_id` is absent/null: SKIP this step (not a Jira-backed workflow)
   c) If source is "jira" and external_id exists:
      i.   Call `getAccessibleAtlassianResources` to resolve cloudId. If fails: log WARNING, set jira_sync_status = "failed", continue.
      ii.  Call `getTransitionsForJiraIssue(cloudId, external_id)` to get available transitions. If fails: log WARNING, set jira_sync_status = "failed", continue.
      iii. Find target transition: match by name "Done" (case-insensitive) first, then fall back to "Complete", "Resolved", "Closed", or status category "done".
      iv.  If no terminal transition found: log "WARNING: No 'Done' transition available for Jira {external_id}. Available: {names}", set jira_sync_status = "failed", continue.
      v.   Call `transitionJiraIssue(cloudId, external_id, transition: { id: targetTransitionId })`. If fails: log WARNING, set jira_sync_status = "failed", continue.
      vi.  On success: log "Jira {external_id} transitioned to Done", set jira_sync_status = "synced".
   d) Record jira_sync_status in the workflow_history entry.
   **CRITICAL**: This step is non-blocking. Any failure logs a warning and continues to step 3.
```

### Fix 2: Update Finalize Mode Summary

In `src/claude/agents/00-sdlc-orchestrator.md`, line 668, update the finalize mode execution sequence to include Jira sync:

```
finalize: Human Review (if enabled) -> merge branch -> Jira status sync -> GitHub sync -> BACKLOG.md completion -> collectPhaseSnapshots -> prune -> move to workflow_history -> clear active_workflow
```

### Fix 3: Update isdlc.md STEP 4 with Concrete MCP Calls

In `src/claude/commands/isdlc.md`, replace the conceptual Jira sync description (lines 2243-2246) with the concrete MCP procedure referencing the same steps as Fix 1.

### Fix 4: Align Field References

Either:
- **Option A**: Change all finalize-side references from `jira_ticket_id` to use `external_id` (when `source === "jira"`)
- **Option B**: Add `jira_ticket_id` as an alias populated during init when `source === "jira"`

Option A is preferred as it avoids schema changes and uses the existing field.

### Fix 5: Verify jira_ticket_id Population (Optional Enhancement)

If Option B is chosen for Fix 4, add `jira_ticket_id` population to the fix workflow init (orchestrator lines 422-431) so that when `detectSource()` returns `source: "jira"`, the orchestrator also writes:
```json
{ "jira_ticket_id": "PROJ-1234" }
```

---

## Files Requiring Changes

| File | Lines | Change Description |
|------|-------|--------------------|
| `src/claude/agents/00-sdlc-orchestrator.md` | 588-601 | Replace conceptual step 2.5 with executable MCP procedure |
| `src/claude/agents/00-sdlc-orchestrator.md` | 668 | Add Jira sync to finalize mode execution summary |
| `src/claude/commands/isdlc.md` | 2243-2246 | Replace conceptual updateStatus() with concrete MCP procedure |

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-23",
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "error_keywords": ["updateStatus", "jira_ticket_id", "transitionJiraIssue", "getTransitionsForJiraIssue", "finalize", "jira_sync_status"],
  "files_traced": [
    "src/claude/agents/00-sdlc-orchestrator.md",
    "src/claude/commands/isdlc.md",
    "src/claude/CLAUDE.md.template",
    "src/claude/hooks/lib/three-verb-utils.cjs"
  ],
  "root_causes_identified": 3,
  "primary_root_cause": "Conceptual adapter method updateStatus() never translated to concrete MCP tool calls (getTransitionsForJiraIssue + transitionJiraIssue)",
  "secondary_root_cause": "Field name mismatch: finalize reads jira_ticket_id but init writes external_id",
  "contributing_factor": "Finalize mode execution summary omits Jira sync from sequence"
}
```
