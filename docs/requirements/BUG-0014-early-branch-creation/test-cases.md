# Test Cases: BUG-0014 Early Branch Creation

**Phase**: 05-test-strategy
**Bug**: BUG-0014
**Total Test Cases**: 22 (T01-T22)
**Test File**: `lib/early-branch-creation.test.js`

---

## Test Group 1: Orchestrator Section 3a -- New Timing (FR-02)

These tests verify that the orchestrator's Branch Creation section is renamed and retimed to initialization.

### T01: Section 3a header says "At Initialization" not "Post-GATE-01"
- **Traces to**: AC-02a
- **Priority**: P0 (core fix verification)
- **TDD Status**: RED (will fail before fix)
- **File**: `src/claude/agents/00-sdlc-orchestrator.md`
- **Input**: Read the full file content
- **Expected**: File contains "Branch Creation (At Initialization)" or similar header. File does NOT contain "Branch Creation (Post-GATE-01)".
- **Rationale**: The Section 3a header is the most visible indicator of the timing change.

### T02: Section 3a trigger condition references "initializing a workflow" not "GATE-01 passes"
- **Traces to**: AC-02a
- **Priority**: P0 (core fix verification)
- **TDD Status**: RED (will fail before fix)
- **File**: `src/claude/agents/00-sdlc-orchestrator.md`
- **Input**: Read Section 3a content (between `## 3a.` and `## 3b.`)
- **Expected**: Section contains text about "initializing a workflow" or "workflow initialization" as the trigger. Does NOT contain "When GATE-01 passes" as the trigger for branch creation.
- **Rationale**: AC-02a requires the trigger condition to change from post-GATE-01 to post-initialization.

### T03: init-and-phase-01 mode shows branch creation before Phase 01
- **Traces to**: AC-02b, AC-01d
- **Priority**: P0 (core fix verification)
- **TDD Status**: RED (will fail before fix)
- **File**: `src/claude/agents/00-sdlc-orchestrator.md`
- **Input**: Read the init-and-phase-01 mode description
- **Expected**: The mode description mentions "create branch" before "Phase 01" or "delegate to Phase 01". The ordering is: init -> branch -> Phase 01 -> GATE-01 -> plan.
- **Rationale**: AC-02b requires the mode description to include branch creation before Phase 01 delegation.

### T04: init-and-phase-01 mode table row reflects new ordering
- **Traces to**: AC-02b
- **Priority**: P1 (supporting verification)
- **TDD Status**: RED (will fail before fix)
- **File**: `src/claude/agents/00-sdlc-orchestrator.md`
- **Input**: Read the Mode Definitions table
- **Expected**: The `init-and-phase-01` row contains "create branch" before "run Phase 01" or "Phase 01". Text like "Initialize workflow + create branch + run Phase 01 + validate GATE-01".
- **Rationale**: The table row is a quick-reference summary that must match the detailed description.

---

## Test Group 2: isdlc.md Phase-Loop Controller -- New Timing (FR-03)

These tests verify that the phase-loop controller documentation reflects the new branch creation timing.

### T05: Feature action describes branch creation at init time
- **Traces to**: AC-03a, AC-01a
- **Priority**: P0 (core fix verification)
- **TDD Status**: RED (will fail before fix)
- **File**: `src/claude/commands/isdlc.md`
- **Input**: Read feature workflow action section
- **Expected**: The feature action mentions branch creation during initialization or before Phase 01, not "After GATE-01".
- **Rationale**: AC-03a requires STEP 1 to document branch creation at init time.

### T06: Fix action describes branch creation at init time
- **Traces to**: AC-03a, AC-01b
- **Priority**: P0 (core fix verification)
- **TDD Status**: RED (will fail before fix)
- **File**: `src/claude/commands/isdlc.md`
- **Input**: Read fix workflow action section
- **Expected**: The fix action mentions branch creation during initialization or before Phase 01, not "After GATE-01".
- **Rationale**: AC-03a requires STEP 1 to document branch creation at init time for fix workflows.

### T07: STEP 1 description mentions branch creation before Phase 01
- **Traces to**: AC-03a, AC-03b
- **Priority**: P0 (core fix verification)
- **TDD Status**: RED (will fail before fix)
- **File**: `src/claude/commands/isdlc.md`
- **Input**: Read STEP 1 (INIT) section
- **Expected**: STEP 1 description includes branch creation as part of init, before phase execution. The ordering in the text is: init -> branch -> Phase 01.
- **Rationale**: AC-03b requires post-GATE-01 branch creation references removed from STEP 1.

### T08: No "after GATE-01" branch creation reference in isdlc.md STEP 1
- **Traces to**: AC-03b
- **Priority**: P0 (regression prevention)
- **TDD Status**: RED (will fail before fix)
- **File**: `src/claude/commands/isdlc.md`
- **Input**: Read STEP 1 section content
- **Expected**: The STEP 1 section does not contain "after GATE-01" followed by "creates" or "create" and "branch" within the same sentence/paragraph.
- **Rationale**: AC-03b explicitly requires removal of post-GATE-01 branch creation references.

---

## Test Group 3: Removal of Stale "After GATE-01" Branch References (FR-01, FR-02, FR-03)

These tests verify that no stale references to post-GATE-01 branch creation remain in any of the three target files.

### T09: No "After GATE-01" branch creation in orchestrator feature workflow
- **Traces to**: AC-01a, AC-02a
- **Priority**: P0 (stale reference removal)
- **TDD Status**: RED (will fail before fix)
- **File**: `src/claude/agents/00-sdlc-orchestrator.md`
- **Input**: Read feature workflow section
- **Expected**: The feature workflow section does NOT contain "After GATE-01" followed by "create branch" (the old text was "After GATE-01: create branch `feature/{artifact_folder}` from main").
- **Rationale**: Location #2 from trace analysis must be updated.

### T10: No "After GATE-01" branch creation in orchestrator fix workflow
- **Traces to**: AC-01b, AC-02a
- **Priority**: P0 (stale reference removal)
- **TDD Status**: RED (will fail before fix)
- **File**: `src/claude/agents/00-sdlc-orchestrator.md`
- **Input**: Read fix workflow section
- **Expected**: The fix workflow section does NOT contain "After GATE-01" followed by "create branch" (the old text was "After GATE-01: create branch `bugfix/{artifact_folder}` from main").
- **Rationale**: Location #3 from trace analysis must be updated.

### T11: No "after GATE-01 passes" as branch creation trigger in Section 3a
- **Traces to**: AC-02a
- **Priority**: P0 (stale reference removal)
- **TDD Status**: RED (will fail before fix)
- **File**: `src/claude/agents/00-sdlc-orchestrator.md`
- **Input**: Read Section 3a content
- **Expected**: Section 3a does NOT contain "When GATE-01 passes" as the condition for branch creation.
- **Rationale**: Location #6 from trace analysis. The trigger must change to workflow initialization.

### T12: Step 7 no longer says "Branch will be created after GATE-01"
- **Traces to**: AC-02a
- **Priority**: P1 (supporting verification)
- **TDD Status**: RED (will fail before fix)
- **File**: `src/claude/agents/00-sdlc-orchestrator.md`
- **Input**: Read initialization Step 7 content
- **Expected**: Step 7 does NOT contain "Branch will be created after GATE-01 passes".
- **Rationale**: Location #1 from trace analysis. Step 7 must reference init-time branch creation.

### T13: Section 3b does not reference "branch creation (3a)" as a next step
- **Traces to**: AC-02c, NFR-03
- **Priority**: P1 (plan generation isolation)
- **TDD Status**: RED (will fail before fix)
- **File**: `src/claude/agents/00-sdlc-orchestrator.md`
- **Input**: Read Section 3b content
- **Expected**: Section 3b does NOT contain "proceed to branch creation (3a)" since the branch already exists by the time plan generation runs.
- **Rationale**: Location #7 from trace analysis. Plan generation must not reference branch creation as a subsequent step.

---

## Test Group 4: Preserved Content -- Regression Guards (NFR-01, NFR-03)

These tests verify that content that must NOT change remains intact.

### T14: Feature branch naming convention preserved
- **Traces to**: AC-01c, NFR-01
- **Priority**: P0 (regression guard)
- **TDD Status**: GREEN (should pass before and after fix)
- **File**: `src/claude/agents/00-sdlc-orchestrator.md`
- **Input**: Read full file content
- **Expected**: File contains `feature/{artifact_folder}` branch naming pattern.
- **Rationale**: FR-03 requires branch naming conventions remain unchanged.

### T15: Bugfix branch naming convention preserved
- **Traces to**: AC-01c, NFR-01
- **Priority**: P0 (regression guard)
- **TDD Status**: GREEN (should pass before and after fix)
- **File**: `src/claude/agents/00-sdlc-orchestrator.md`
- **Input**: Read full file content
- **Expected**: File contains `bugfix/{artifact_folder}` branch naming pattern.
- **Rationale**: FR-03 requires branch naming conventions remain unchanged.

### T16: Plan Generation section header still says "Post-GATE-01"
- **Traces to**: AC-02c, AC-03c, NFR-03
- **Priority**: P0 (regression guard)
- **TDD Status**: GREEN (should pass before and after fix)
- **File**: `src/claude/agents/00-sdlc-orchestrator.md`
- **Input**: Read full file content
- **Expected**: File contains "Plan Generation (Post-GATE-01)" header.
- **Rationale**: NFR-03 requires plan generation timing to remain unchanged.

### T17: git checkout -b command preserved in Section 3a
- **Traces to**: AC-01d, NFR-01
- **Priority**: P1 (regression guard)
- **TDD Status**: GREEN (should pass before and after fix)
- **File**: `src/claude/agents/00-sdlc-orchestrator.md`
- **Input**: Read Section 3a content
- **Expected**: Section contains `git checkout -b` command.
- **Rationale**: The actual git command for branch creation must remain.

---

## Test Group 5: Cross-File Consistency (FR-01)

These tests verify that all three files agree on the new timing.

### T18: Orchestrator and isdlc.md agree -- no "after GATE-01" for branch creation
- **Traces to**: AC-01a, AC-01b, AC-01d
- **Priority**: P1 (consistency)
- **TDD Status**: RED (will fail before fix)
- **Files**: `src/claude/agents/00-sdlc-orchestrator.md`, `src/claude/commands/isdlc.md`
- **Input**: Read both files, extract branch-creation-related sections
- **Expected**: Neither file contains "after GATE-01" in the context of branch creation (excluding plan generation references).
- **Rationale**: Cross-file consistency ensures no mixed messages about timing.

### T19: Pre-flight checks documented in orchestrator Section 3a
- **Traces to**: AC-04a, AC-04b, AC-04c, AC-04d
- **Priority**: P1 (pre-flight verification)
- **TDD Status**: GREEN (should pass before and after fix -- pre-flight checks exist in current Section 3a)
- **File**: `src/claude/agents/00-sdlc-orchestrator.md`
- **Input**: Read Section 3a content
- **Expected**: Section 3a contains references to pre-flight checks including: `git rev-parse`, dirty working directory handling, and checkout to main.
- **Rationale**: AC-04a through AC-04d require pre-flight checks to be documented. They already exist in Section 3a and should remain.

### T20: State recording (git_branch) documented in orchestrator Section 3a
- **Traces to**: AC-05a, AC-05b, AC-05c, AC-05d
- **Priority**: P1 (state recording verification)
- **TDD Status**: GREEN (should pass before and after fix -- state recording exists in current Section 3a)
- **File**: `src/claude/agents/00-sdlc-orchestrator.md`
- **Input**: Read Section 3a content
- **Expected**: Section 3a contains the `git_branch` state update with fields: `name`, `created_from`, `created_at`, `status`.
- **Rationale**: AC-05a through AC-05d require state recording. These fields already exist in Section 3a.

---

## Test Group 6: Generate-Plan Skill (FR-01)

These tests verify that the generate-plan skill documentation reflects that the branch already exists.

### T21: generate-plan skill when_to_use mentions branch already exists
- **Traces to**: AC-01d
- **Priority**: P2 (supporting documentation)
- **TDD Status**: RED (will fail before fix)
- **File**: `src/claude/skills/orchestration/generate-plan/SKILL.md`
- **Input**: Read the skill file
- **Expected**: File contains text indicating the branch already exists at plan generation time (e.g., "branch already created" or "branch already exists").
- **Rationale**: Location #13 from trace analysis. The skill's when_to_use must reflect that branch creation precedes plan generation.

### T22: generate-plan skill does not say "Before branch creation"
- **Traces to**: AC-01d
- **Priority**: P2 (stale reference removal)
- **TDD Status**: RED (will fail before fix)
- **File**: `src/claude/skills/orchestration/generate-plan/SKILL.md`
- **Input**: Read the skill file
- **Expected**: File does NOT contain "Before branch creation" (the old text was "Before branch creation (Section 3a of the orchestrator)").
- **Rationale**: Location #14 from trace analysis. The prerequisite must not reference branch creation as a subsequent step.

---

## Test Summary

| ID | Group | Description | Priority | TDD Status | Traces To |
|----|-------|-------------|----------|------------|-----------|
| T01 | Orchestrator 3a | Section 3a header says "At Initialization" | P0 | RED | AC-02a |
| T02 | Orchestrator 3a | Trigger references "initializing a workflow" | P0 | RED | AC-02a |
| T03 | Orchestrator 3a | init-and-phase-01 mode: branch before Phase 01 | P0 | RED | AC-02b, AC-01d |
| T04 | Orchestrator 3a | Mode table row reflects new ordering | P1 | RED | AC-02b |
| T05 | isdlc.md | Feature action: branch at init | P0 | RED | AC-03a, AC-01a |
| T06 | isdlc.md | Fix action: branch at init | P0 | RED | AC-03a, AC-01b |
| T07 | isdlc.md | STEP 1: branch creation before Phase 01 | P0 | RED | AC-03a, AC-03b |
| T08 | isdlc.md | STEP 1: no "after GATE-01" for branch | P0 | RED | AC-03b |
| T09 | Stale Refs | No "After GATE-01" branch in feature workflow | P0 | RED | AC-01a, AC-02a |
| T10 | Stale Refs | No "After GATE-01" branch in fix workflow | P0 | RED | AC-01b, AC-02a |
| T11 | Stale Refs | No "GATE-01 passes" trigger in Section 3a | P0 | RED | AC-02a |
| T12 | Stale Refs | Step 7 no longer says "after GATE-01" | P1 | RED | AC-02a |
| T13 | Stale Refs | Section 3b no "branch creation (3a)" next step | P1 | RED | AC-02c, NFR-03 |
| T14 | Regression | Feature branch naming preserved | P0 | GREEN | AC-01c, NFR-01 |
| T15 | Regression | Bugfix branch naming preserved | P0 | GREEN | AC-01c, NFR-01 |
| T16 | Regression | Plan Generation still "Post-GATE-01" | P0 | GREEN | AC-02c, AC-03c, NFR-03 |
| T17 | Regression | git checkout -b preserved in Section 3a | P1 | GREEN | AC-01d, NFR-01 |
| T18 | Consistency | Orchestrator + isdlc.md: no stale timing | P1 | RED | AC-01a, AC-01b, AC-01d |
| T19 | Consistency | Pre-flight checks in Section 3a | P1 | GREEN | AC-04a thru AC-04d |
| T20 | Consistency | git_branch state recording in Section 3a | P1 | GREEN | AC-05a thru AC-05d |
| T21 | generate-plan | Skill says branch already exists | P2 | RED | AC-01d |
| T22 | generate-plan | Skill does not say "Before branch creation" | P2 | RED | AC-01d |

**TDD Red Baseline**: 16 tests expected to FAIL (T01-T13, T18, T21, T22)
**Regression Green Baseline**: 6 tests expected to PASS (T14-T17, T19, T20)
