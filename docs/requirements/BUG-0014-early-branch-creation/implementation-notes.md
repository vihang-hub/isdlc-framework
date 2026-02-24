# Implementation Notes: BUG-0014 Early Branch Creation

**Phase**: 06-implementation
**Bug**: BUG-0014-early-branch-creation
**Date**: 2026-02-13

## Summary

Moved branch creation timing from post-GATE-01 to workflow initialization time across three documentation/prompt files. This ensures all phases (including Phase 01) execute on the feature/bugfix branch, keeping main untouched from the start.

## Files Modified

### 1. `src/claude/agents/00-sdlc-orchestrator.md`

| Location | Change | Traces To |
|----------|--------|-----------|
| Step 7 (Initialization Process) | "Branch will be created after GATE-01 passes" -> "Create branch immediately during initialization -- before Phase 01 delegation" | AC-02a |
| Feature workflow bullet | "After GATE-01: create branch" -> "During initialization: create branch" | AC-01a |
| Fix workflow bullet | "After GATE-01: create branch" -> "During initialization: create branch" | AC-01b |
| Section 3a header | "Branch Creation (Post-GATE-01)" -> "Branch Creation (At Initialization)" | AC-02a |
| Section 3a trigger | "When GATE-01 passes AND" -> "When initializing a workflow that has requires_branch: true" | AC-02a |
| Section 3a step 7 | "Proceed to plan generation (Section 3b)" -> "Proceed to Phase 01 delegation" | AC-02c |
| Section 3b step 3 | "proceed to branch creation (3a) and next phase" -> "proceed to next phase delegation (branch already created during init)" | AC-02c |
| Mode Definitions table | "Initialize workflow + run Phase 01 + validate GATE-01 + create branch" -> "Initialize workflow + create branch + run Phase 01 + validate GATE-01 + generate plan" | AC-02b |
| Mode Behavior item 1 | Reordered: "create branch (3a)" now before "delegate to Phase 01" | AC-02b |

### 2. `src/claude/commands/isdlc.md`

| Location | Change | Traces To |
|----------|--------|-----------|
| Feature action step 5 | "After GATE-01: creates feature/REQ-NNNN branch" -> "During initialization: creates feature/REQ-NNNN branch (before Phase 01)" | AC-03a, AC-01a |
| Fix action step 9 | "After GATE-01: creates bugfix/BUG-NNNN branch" -> "During initialization: creates bugfix/BUG-NNNN branch (before Phase 01)" | AC-03a, AC-01b |
| STEP 1 description | "validates GATE-01, creates the branch, generates the plan" -> "creates the branch, runs Phase 01, validates GATE-01, generates the plan" | AC-03a, AC-03b |

### 3. `src/claude/skills/orchestration/generate-plan/SKILL.md`

| Location | Change | Traces To |
|----------|--------|-----------|
| Frontmatter when_to_use | "before branch creation" -> "after branch already created during init" | AC-01d |
| When to Use section | "Before branch creation (Section 3a)" -> "Branch already created during workflow initialization (Section 3a)" | AC-01d |

## Files Created

| File | Purpose |
|------|---------|
| `lib/early-branch-creation.test.js` | 22 structural validation tests for the timing change |

## What Was NOT Changed

- **Upgrade workflow**: "After GATE-01 equivalent (analysis approval): create branch" stays as-is because upgrades require user approval before branching
- **Branch naming conventions**: `feature/{artifact_folder}` and `bugfix/{artifact_folder}` preserved unchanged
- **Plan Generation (Post-GATE-01)** header: Unchanged because plan generation timing is correct (still post-GATE-01)
- **git checkout -b command**: Preserved in Section 3a
- **Pre-flight checks**: git rev-parse, dirty directory handling, checkout main -- all preserved
- **State recording**: git_branch JSON structure with name, created_from, created_at, status -- all preserved
- **No JavaScript runtime code**: This is a documentation/prompt-only fix

## Test Results

- **22/22 BUG-0014 tests pass** (T01-T22)
- **560/561 ESM tests pass** (1 pre-existing failure TC-E09 -- unrelated)
- **0 regressions introduced**
- **Iteration count**: 1 (all tests passed on first implementation attempt)

## Key Design Decision

The branch creation step was moved to occur *during workflow initialization* (after artifact_folder is computed but before Phase 01 delegation). This is the earliest safe point because:
1. The artifact_folder (which determines the branch name) is already available
2. The workflow type (which determines the branch prefix) is already known
3. No Phase 01 artifacts are needed for branch creation
4. This ensures all Phase 01 work (requirements capture, bug reports) happens on the branch
