# Trace Analysis: BACKLOG.md Completion Marking Not Wired Into Standard Workflow Finalize

**Generated**: 2026-02-23
**Bug**: BACKLOG.md completion marking is specified but not implemented in standard workflow finalize
**External ID**: GH-11
**Workflow**: fix
**Phase**: 02-tracing

---

## Executive Summary

The BACKLOG.md completion marking behavior is specified in two places (`00-sdlc-orchestrator.md` Section 3a step 2.5d and `isdlc.md` STEP 4 line 2245) but neither specification is reachable during standard workflow finalize. In the orchestrator, the BACKLOG.md update (step 2.5d) is nested inside the Jira sync block (step 2.5) and thus only executes when `jira_ticket_id` is present -- workflows sourced from GitHub or created manually skip it entirely. In `isdlc.md`, line 2245 describes the BACKLOG.md update as a sub-bullet of "Jira sync", reinforcing the incorrect conditional nesting. Furthermore, the orchestrator's finalize mode behavior summary (line 655) omits BACKLOG.md entirely -- it specifies only: Human Review, merge, collectPhaseSnapshots, prune, workflow_history, clear active_workflow. The existing `updateBacklogMarker()` utility only updates the marker character (`[ ]` to `[x]`) but does NOT add a completion date sub-bullet, does NOT move the item block from `## Open` to `## Completed`, and does NOT match by external reference (`GH-N`, `PROJ-N`). The fix requires changes at three layers: specification (orchestrator agent), controller (isdlc.md STEP 4), and utility enhancement (updateBacklogMarker or a new completion function).

**Root Cause Confidence**: High
**Severity**: Medium
**Estimated Complexity**: Medium (3 files, specification + behavior changes)

---

## Symptom Analysis

### Observed Behavior

After any standard workflow completes (feature, fix, upgrade) and merges to main, BACKLOG.md items remain in the `## Open` section with `[ ]` unchecked. Manual intervention is required to mark items complete and move them to `## Completed`.

### Evidence from BACKLOG.md

Current BACKLOG.md at `/Users/vihangshah/enactor-code/isdlc/BACKLOG.md` shows the format:
- `## Open` section starting at line 6, containing items with format: `- N.N [ ] description -> [requirements](path)`
- `## Completed` section starting at line 431, containing manually-moved items with format: `- [x] description **Completed: YYYY-MM-DD**`
- Items in the Completed section do NOT follow the `N.N` prefix pattern consistently -- some use `[x] REQ-NNNN:` format, indicating they were manually moved and reformatted rather than programmatically processed.

### Error Classification

This is not a runtime error (no stack traces, no exceptions). It is a **specification-implementation gap** where:
1. The behavior is specified in the orchestrator agent file
2. The specification is unreachable due to incorrect nesting under a conditional branch
3. The finalize mode behavior summary omits the step entirely
4. The Phase-Loop Controller delegates to the orchestrator without including the step

### Triggering Conditions

The bug manifests for ALL workflow types that use the standard finalize path:
- `/isdlc build` workflows
- `/isdlc fix` workflows
- `/isdlc upgrade` workflows

The ONLY path where BACKLOG.md gets updated is the **trivial tier** execution (step T8, line 1223 of `isdlc.md`), which calls `updateBacklogMarker(backlogPath, slug, "x")` directly without going through the orchestrator finalize. However, even this path only marks the checkbox -- it does NOT add a completion date or move the item to `## Completed`.

---

## Execution Path

### Entry Point: STEP 4 FINALIZE in isdlc.md (line 2231)

The finalize flow begins at STEP 4 in `isdlc.md`:

```
STEP 4: FINALIZE -- Complete the workflow

After all phases complete:
  Use Task tool -> sdlc-orchestrator with:
    MODE: finalize
```

### Call Chain

```
isdlc.md STEP 4 (line 2231)
  |
  +-> Delegates to 00-sdlc-orchestrator.md MODE: finalize
       |
       +-> Line 655: finalize mode behavior:
       |     Human Review (if enabled)
       |     -> merge branch (line 586-587)
       |     -> JIRA STATUS SYNC (line 588-602)  <-- BACKLOG.md update nested HERE
       |     |    Step 2.5a: Read jira_ticket_id
       |     |    Step 2.5b: If absent -> SKIP (local-only)  <-- ALL GitHub/manual workflows skip
       |     |    Step 2.5c: If exists -> Jira transition
       |     |    Step 2.5d: Update BACKLOG.md  <-- UNREACHABLE for non-Jira workflows
       |     |    Step 2.5e: Set jira_sync_status
       |     |
       |     -> collectPhaseSnapshots(state) (line 655)
       |     -> prune (line 655)
       |     -> move to workflow_history (line 655)
       |     -> clear active_workflow (line 655)
       |
       +-> BACKLOG.md update NEVER executed for GitHub-sourced workflows
```

### Failure Point Analysis

**File**: `src/claude/agents/00-sdlc-orchestrator.md`, lines 588-602
**Problem**: Step 2.5d (BACKLOG.md update) is at indentation level 3 under step 2.5 (JIRA STATUS SYNC). Step 2.5b explicitly says "If `jira_ticket_id` is absent or null: SKIP this step (local-only workflow)". Since step 2.5d is a sub-step of 2.5, it gets skipped when 2.5b triggers the skip.

**File**: `src/claude/agents/00-sdlc-orchestrator.md`, line 655
**Problem**: The finalize mode summary does not mention BACKLOG.md at all. It reads: "finalize: Human Review -> merge branch -> collectPhaseSnapshots -> prune -> workflow_history -> clear active_workflow". An agent following this summary would never execute a BACKLOG.md update.

**File**: `src/claude/commands/isdlc.md`, lines 2243-2247
**Problem**: The STEP 4 documentation describes BACKLOG.md update as a sub-item of "Jira sync", reinforcing the incorrect conditional. Line 2245 reads "Updates BACKLOG.md: marks item [x], moves to ## Completed section" but it's bulleted under "Jira sync (if active_workflow.jira_ticket_id exists)".

### Data Flow Gaps

1. **Matching data not passed**: The orchestrator finalize mode does not extract `artifact_folder`, `external_id`, or `source_id` from `active_workflow` for BACKLOG.md matching purposes. These fields exist in `active_workflow` but are only used for branch naming and GitHub issue closing.

2. **Utility limitation**: `updateBacklogMarker()` at line 1061 of `three-verb-utils.cjs` takes `(backlogPath, slug, newMarker)` and only does a marker character substitution using MARKER_REGEX. It does NOT:
   - Add completion date sub-bullets
   - Move item blocks between sections
   - Match by external reference (only by slug substring in description text)

---

## Root Cause Analysis

### Hypothesis 1: Specification Nesting Error (PRIMARY -- High Confidence)

**Evidence**:
- Step 2.5d is indented under step 2.5 ("JIRA STATUS SYNC") in `00-sdlc-orchestrator.md` line 597
- Step 2.5b (line 590) explicitly skips when `jira_ticket_id` is absent
- The orchestrator specification uses "d)" numbering (2.5d) which implies it is a sub-step of 2.5
- The BACKLOG.md update has NO logical dependency on Jira -- it should execute for ALL workflows
- Line 597 even says "find the item by `jira_ticket_id`" which is wrong -- it should search by `artifact_folder` or `external_id`

**Likelihood**: Very High (95%)

### Hypothesis 2: Finalize Mode Summary Omission (CONTRIBUTING)

**Evidence**:
- Line 655 defines the finalize mode execution sequence
- BACKLOG.md is not mentioned anywhere in this sequence
- An LLM agent reading line 655 would execute exactly: Human Review -> merge -> snapshots -> prune -> history -> clear
- Even if step 2.5d were correctly un-nested, an agent following the mode summary would skip it

**Likelihood**: Very High (95%) -- this is a contributing cause that must also be fixed

### Hypothesis 3: Controller Documentation Reinforces the Bug (CONTRIBUTING)

**Evidence**:
- `isdlc.md` STEP 4 (lines 2243-2247) describes BACKLOG.md update under "Jira sync" heading
- This is the Phase-Loop Controller documentation that developers read to understand finalize
- It reinforces the incorrect impression that BACKLOG.md update is Jira-dependent

**Likelihood**: Very High (95%) -- this is a contributing documentation bug

### Hypothesis 4: Utility Insufficient for Full Behavior (CONTRIBUTING)

**Evidence**:
- `updateBacklogMarker()` (line 1061, `three-verb-utils.cjs`) only does marker character replacement
- FR-003 requires adding a `**Completed:** {date}` sub-bullet
- FR-004 requires moving the entire item block from `## Open` to `## Completed`
- The function's MARKER_REGEX `/^(\s*-\s+)(\d+\.\d+)\s+\[([ ~Ax])\]\s+(.+)$/` matches item lines but cannot identify sub-bullet blocks
- FR-001 requires external reference matching (`GH-N`, `PROJ-N`) which `updateBacklogMarker` does not support -- it only matches by slug substring in the description text

**Likelihood**: Very High (95%) -- the utility needs enhancement or a new function is needed

### Root Cause Ranking

| Rank | Hypothesis | Confidence | Fix Required |
|------|-----------|------------|--------------|
| 1 | Specification nesting error (step 2.5d under Jira) | 95% | Un-nest to top-level finalize step in orchestrator |
| 2 | Finalize mode summary omission (line 655) | 95% | Add BACKLOG.md update to finalize sequence |
| 3 | Controller documentation reinforcement | 95% | Move BACKLOG.md update out of Jira sync in isdlc.md |
| 4 | Utility insufficient for full behavior | 95% | Enhance utility or add new completion function |

### Suggested Fixes

**Fix 1: Un-nest BACKLOG.md update in orchestrator** (`src/claude/agents/00-sdlc-orchestrator.md`)
- Move step 2.5d out of the Jira sync block (step 2.5) to become a new top-level step (e.g., step 2.6 or step 5)
- Change matching from `jira_ticket_id` to `artifact_folder` + `external_id` + `source_id`
- Add the full behavior: mark `[x]`, add completion date, move to `## Completed`
- Wrap in try/catch with warning-only failure (non-blocking per Article X)
- **Complexity**: Low -- restructuring existing specification text

**Fix 2: Update finalize mode summary** (`src/claude/agents/00-sdlc-orchestrator.md`, line 655)
- Add BACKLOG.md update to the finalize sequence: "Human Review -> merge -> **BACKLOG.md completion** -> snapshots -> prune -> history -> clear"
- **Complexity**: Low -- single line addition

**Fix 3: Update STEP 4 documentation** (`src/claude/commands/isdlc.md`, lines 2241-2254)
- Add a new "BACKLOG.md sync" section at the same level as "Jira sync" and "GitHub sync"
- Remove the BACKLOG.md sub-bullet from under "Jira sync"
- Describe the matching strategy (artifact_folder, external_id, item number)
- **Complexity**: Low -- restructuring documentation

**Fix 4: Enhance or create completion utility** (`src/claude/hooks/lib/three-verb-utils.cjs` or inline in agent spec)
- Option A: Enhance `updateBacklogMarker()` to also add date sub-bullet and move to Completed section
- Option B: Create a new `completeBacklogItem(backlogPath, matchCriteria)` function that handles the full workflow
- Option C: Specify the behavior inline in the orchestrator agent (no utility change -- the agent reads/writes BACKLOG.md directly)
- Note: Since this is an agent-file bug (markdown specifications), Option C may be most aligned with CON-003 ("Agent File Changes Only") from the requirements spec
- **Complexity**: Medium if creating/enhancing utility, Low if specifying inline

### Recommended Fix Strategy

The most aligned approach given CON-003 is to fix all three specification files:
1. **`00-sdlc-orchestrator.md`**: Un-nest step 2.5d, update finalize mode summary, specify inline BACKLOG.md read/write behavior
2. **`isdlc.md`**: Add "BACKLOG.md sync" as a peer of "Jira sync" and "GitHub sync" in STEP 4
3. **`three-verb-utils.cjs`**: Optionally enhance `updateBacklogMarker()` or leave it as-is if the orchestrator handles the full behavior inline

The agent-inline approach (specifying read BACKLOG.md -> find item -> mark [x] -> add date -> move block -> write BACKLOG.md directly in the orchestrator) avoids JavaScript code changes and keeps the fix within agent markdown files, consistent with how the existing Jira sync and GitHub sync behaviors are specified.

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-23T08:30:00Z",
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "error_keywords": ["BACKLOG.md", "finalize", "updateBacklogMarker", "jira_ticket_id", "completion marking"],
  "files_analyzed": [
    "src/claude/commands/isdlc.md",
    "src/claude/agents/00-sdlc-orchestrator.md",
    "src/claude/hooks/lib/three-verb-utils.cjs",
    "BACKLOG.md"
  ],
  "phase_timing_report": {
    "debate_rounds_used": 0,
    "fan_out_chunks": 0
  }
}
```
