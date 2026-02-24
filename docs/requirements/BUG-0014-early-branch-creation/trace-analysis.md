# Trace Analysis: Branch Creation Happens After GATE-01 Instead of Before Phase 00

**Generated**: 2026-02-13T14:45:00.000Z
**Bug**: BUG-0014 -- Branch creation happens after GATE-01 instead of before Phase 00
**Workflow**: fix
**Phase**: 02-tracing

---

## Executive Summary

The branch creation logic is explicitly documented and implemented as a **post-GATE-01** operation across two primary files (`isdlc.md` and `00-sdlc-orchestrator.md`), plus one supporting skill (`generate-plan/SKILL.md`). The root cause is a design assumption from the initial implementation: the original architecture assumed the artifact folder name (which forms the branch name) was only finalized after Phase 01 completed. However, the sequential ID (`next_bug_id` / `next_req_id`) is read from `state.json.counters` at **workflow initialization time** and the artifact folder is written to `active_workflow` before Phase 01 starts. This means the branch name is fully known at init time, and the delay to post-GATE-01 is unnecessary. The fix involves moving branch creation from Section 3a (post-GATE-01) to the initialization process (Section 3, step 7), and updating all references in `isdlc.md` accordingly.

**Root Cause Confidence**: HIGH
**Severity**: HIGH (main branch pollution on every workflow)
**Estimated Complexity**: LOW (documentation/prompt changes only, no runtime code)

---

## Symptom Analysis

### Observed Symptoms

1. **Main branch pollution**: Phase 00 (quick-scan) and Phase 01 (requirements) execute on `main`, writing artifacts and state.json updates directly to the main branch.
2. **Cancelled workflow debris**: If a workflow is cancelled during Phase 00 or Phase 01, artifacts remain on `main` with no branch to clean up.
3. **Inconsistent git history**: Main branch contains intermediate state changes (requirements drafts, state.json updates) that should be isolated on a feature/bugfix branch.
4. **Principle violation**: The design principle that "main should only change via merge at workflow completion" is violated for the first 1-2 phases of every branched workflow.

### Error Pattern

This is not a crash or runtime error -- it is a **design defect** in the workflow timing. The symptoms are observable by inspecting `git log` on main after starting (but not completing) a workflow:
- State.json changes appear on main during Phase 01
- Requirement artifacts (`requirements-spec.md`, `user-stories.json`) are committed to main
- Only after GATE-01 passes does the branch get created, at which point subsequent work is isolated

### Triggering Conditions

- Any workflow with `requires_branch: true` (feature, fix, upgrade)
- The bug occurs on **every** invocation -- it is not intermittent
- Affects all three branched workflow types equally

---

## Execution Path

### Entry Point: `/isdlc feature "..." ` or `/isdlc fix "..."`

The execution flow for branched workflows follows this path:

```
User invokes /isdlc fix "description"
  |
  v
isdlc.md STEP 1: INIT
  - Launches orchestrator with MODE: init-and-phase-01
  |
  v
00-sdlc-orchestrator.md: init-and-phase-01 mode
  - Section 3: Workflow Initialization
    - Step 1: Validate prerequisites (constitution, no active workflow)
    - Step 2: Load workflow definition from workflows.json
    - Step 3: Reset phases for new workflow
    - Step 4: Write active_workflow to state.json  <-- artifact_folder computed HERE
      - Reads counters.next_bug_id (e.g., 14)
      - Computes artifact_folder = "BUG-0014-early-branch-creation"
      - Writes active_workflow with artifact_folder
    - Step 5: Update current_phase at top level
    - Step 6: Delegate to Phase 01 agent (requirements-analyst)  <-- ON MAIN BRANCH
    - Step 7: Check requires_branch
      - "If true: Branch will be created after GATE-01 passes (see Section 3a)"
  |
  v
Phase 01 executes ON MAIN BRANCH
  - Requirements analyst writes artifacts to docs/requirements/BUG-0014-*/
  - State.json gets updated multiple times
  - All changes are on main
  |
  v
GATE-01 validation
  |
  v
Section 3a: Branch Creation (Post-GATE-01)           <-- BUG IS HERE
  1. Read branch context from state.json (artifact_folder)
  2. Construct branch name (bugfix/BUG-0014-early-branch-creation)
  3. Pre-flight checks (git repo, dirty working dir, current branch)
  4. git checkout -b {branch_name}
  5. Update state.json with git_branch object
  6. Announce branch creation
  |
  v
Section 3b: Plan Generation (Post-GATE-01)
  |
  v
Return to isdlc.md STEP 2 (foreground tasks)
  |
  v
STEP 3: Phase Loop (Phases 02+ execute on branch)
```

### Key Observation

At Step 4 of the initialization process, `active_workflow.artifact_folder` is already set. The branch name is fully deterministic at this point. There is no technical dependency on GATE-01 passing before the branch can be created.

### Correct Execution Path (After Fix)

```
User invokes /isdlc fix "description"
  |
  v
isdlc.md STEP 1: INIT
  - Launches orchestrator with MODE: init-and-phase-01
  |
  v
00-sdlc-orchestrator.md: init-and-phase-01 mode
  - Section 3: Workflow Initialization
    - Step 1-5: Same as before
    - Step 6: Delegate to Phase 01 agent
      CHANGE: Phase 01 now executes on the branch
    - Step 7: Check requires_branch
      CHANGE: Branch is created at init time (NEW Section 3a-init)
        - Pre-flight checks
        - git checkout -b {branch_name}
        - Update state.json with git_branch
  |
  v
Phase 01 executes ON FEATURE/BUGFIX BRANCH  <-- FIXED
  |
  v
GATE-01 → Plan generation (3b) → Return
```

---

## Root Cause Analysis

### Primary Hypothesis: Design Assumption About Artifact ID Availability

**Confidence: HIGH (95%)**

The original design assumed the artifact folder name was only finalized after Phase 01 completed (because requirements capture might change the feature name or external bug ID). In reality:

1. The sequential counter (`next_bug_id` / `next_req_id`) is read and incremented during **workflow initialization** (Section 3, Step 4).
2. The artifact folder name is deterministic: `{prefix}-{zero-padded-counter}-{slug}` (e.g., `BUG-0014-early-branch-creation`).
3. The description slug comes from the user's original command input, not from Phase 01 output.
4. Therefore, the branch name is fully known before Phase 01 starts.

**Evidence:**
- State.json shows `active_workflow.artifact_folder` is set at init time (confirmed by reading state during Phase 01)
- The counter increment happens in the orchestrator's initialization process, not in Phase 01
- All 15 previous workflows in `workflow_history` confirm the artifact_folder was set before Phase 01

### All Locations Requiring Changes

| # | File | Line(s) | Current Text | Required Change |
|---|------|---------|-------------|----------------|
| 1 | `src/claude/agents/00-sdlc-orchestrator.md` | 419 | "If true: Branch will be created after GATE-01 passes (see Section 3a)" | Move branch creation to init time |
| 2 | `src/claude/agents/00-sdlc-orchestrator.md` | 437 | "After GATE-01: create branch `feature/{artifact_folder}` from main (see Section 3a)" | "At init time: create branch..." |
| 3 | `src/claude/agents/00-sdlc-orchestrator.md` | 455 | "After GATE-01: create branch `bugfix/{artifact_folder}` from main (see Section 3a)" | "At init time: create branch..." |
| 4 | `src/claude/agents/00-sdlc-orchestrator.md` | 483 | "After GATE-01 equivalent (analysis approval): create branch `upgrade/{name}-v{version}` from main" | "At init time: create branch..." |
| 5 | `src/claude/agents/00-sdlc-orchestrator.md` | 527-582 | Section 3a "Branch Creation (Post-GATE-01)" | Rename to "Branch Creation (At Initialization)" and move to occur before Phase 01 delegation |
| 6 | `src/claude/agents/00-sdlc-orchestrator.md` | 533 | "When GATE-01 passes AND the active workflow has requires_branch: true:" | "When initializing a workflow with requires_branch: true:" |
| 7 | `src/claude/agents/00-sdlc-orchestrator.md` | 590 | "proceed to branch creation (3a) and then next phase" | Remove branch creation reference from plan generation (branch already created) |
| 8 | `src/claude/agents/00-sdlc-orchestrator.md` | 642 | "Initialize workflow + run Phase 01 + validate GATE-01 + create branch" | "Initialize workflow + create branch + run Phase 01 + validate GATE-01" |
| 9 | `src/claude/agents/00-sdlc-orchestrator.md` | 656 | "init-and-phase-01: Run initialization (Section 3), delegate to Phase 01, validate GATE-01, create branch (3a), generate plan (3b)" | Reorder: "...create branch (3a), delegate to Phase 01, validate GATE-01, generate plan (3b)" |
| 10 | `src/claude/commands/isdlc.md` | 228 | "After GATE-01: creates `feature/REQ-NNNN-description` branch from main" | "At init: creates branch, then runs Phase 01 on the branch" |
| 11 | `src/claude/commands/isdlc.md` | 252 | "After GATE-01: creates `bugfix/BUG-NNNN-external-id` branch from main" | "At init: creates branch, then runs Phase 01 on the branch" |
| 12 | `src/claude/commands/isdlc.md` | 704 | "The orchestrator initializes the workflow, runs Phase 01 (requirements/bug-report), validates GATE-01, creates the branch, generates the plan, and returns" | Reorder: "...creates the branch, runs Phase 01..." |
| 13 | `src/claude/skills/orchestration/generate-plan/SKILL.md` | 9 | "when_to_use: After GATE-01 passes, before branch creation" | "when_to_use: After GATE-01 passes (branch already created at init)" |
| 14 | `src/claude/skills/orchestration/generate-plan/SKILL.md` | 23 | "Before branch creation (Section 3a of the orchestrator)" | "After branch creation (branch already exists from init)" |

### Upgrade Workflow Special Case

The upgrade workflow (line 483) has a slightly different pattern: "After GATE-01 equivalent (analysis approval): create branch". However, the upgrade workflow also sets `artifact_folder` at init time (`UPG-0001-{name}-v{version}`), so the same fix applies.

Additionally, the `upgrade-engineer` agent (line 451-452) has its own branch creation step: "git checkout -b upgrade/{name}-v{version}". This is a separate concern -- the upgrade engineer creates the branch during execution, but if the orchestrator handles branch creation at init time (as it does for feature/fix), this agent-level branch creation would be redundant. The fix should ensure the orchestrator handles it at init time for upgrade workflows too, and remove or skip the agent-level branch creation.

### Suggested Fix

**Approach**: Move Section 3a (Branch Creation) to occur immediately after Step 4 (active_workflow written) and before Step 6 (Phase 01 delegation). This is a documentation/prompt-only change -- no runtime code (hooks, common.cjs) needs modification.

**Steps:**
1. In `00-sdlc-orchestrator.md`:
   - Rename Section 3a header from "Branch Creation (Post-GATE-01)" to "Branch Creation (At Initialization)"
   - Update the trigger condition from "When GATE-01 passes" to "When initializing a workflow with requires_branch: true"
   - Update Step 7 of initialization to create the branch before delegating to Phase 01
   - Update `init-and-phase-01` mode description to reorder: init -> branch -> Phase 01 -> GATE-01 -> plan
   - Update feature/fix/upgrade workflow descriptions to say "At init time" instead of "After GATE-01"

2. In `isdlc.md`:
   - Update feature action step 5 and fix action step 9 to mention branch at init
   - Update STEP 1 description to clarify branch is created before Phase 01

3. In `generate-plan/SKILL.md`:
   - Update `when_to_use` and prerequisites to reflect that branch already exists

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-13T14:48:00.000Z",
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "files_analyzed": [
    "src/claude/commands/isdlc.md",
    "src/claude/agents/00-sdlc-orchestrator.md",
    "src/claude/skills/orchestration/generate-plan/SKILL.md",
    "src/claude/agents/14-upgrade-engineer.md",
    "src/claude/hooks/branch-guard.cjs",
    ".isdlc/config/workflows.json"
  ],
  "locations_requiring_change": 14,
  "files_requiring_change": 3,
  "error_keywords": ["branch creation", "Post-GATE-01", "requires_branch", "init-and-phase-01", "artifact_folder"],
  "change_type": "documentation-and-prompt-only",
  "runtime_code_changes": false
}
```
