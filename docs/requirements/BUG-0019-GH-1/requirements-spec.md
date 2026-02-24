# Requirements Specification: BUG-0019-GH-1

## Bug Report

**Title**: Orchestrator relaxes blast radius requirements instead of implementing missing files, and no task plan integration when blast radius coverage is incomplete
**ID**: BUG-0019
**External ID**: GH-1
**External URL**: https://github.com/vihang-hub/isdlc-framework/issues/1
**Severity**: Medium
**Priority**: P1
**Reported**: 2026-02-16
**Backlog Items**: 0.17, 0.18 (Batch E -- Medium: Orchestrator Blast Radius Response)

---

## Problem Statement

### Bug 0.17: Orchestrator relaxes blast radius instead of implementing

When `blast-radius-validator.cjs` blocks because unaddressed files exist in the impact analysis, the SDLC orchestrator (and the phase-loop controller in `isdlc.md`) responds incorrectly by:
- Adding deferral entries to the impact analysis
- Modifying blast radius metadata to exclude unaddressed files
- Marking files as "out of scope" in state.json

This defeats the purpose of blast radius validation entirely. The hook correctly identifies that files from `impact-analysis.md` have not been touched, but the orchestrator takes the path of least resistance instead of going back to implementation.

### Bug 0.18: No task plan integration for blast radius

`docs/isdlc/tasks.md` already contains tasks for all impacted files (generated after GATE-01 from the impact analysis), but when the blast radius validator blocks:
- There is no mechanism to cross-reference unaddressed files against the task plan
- Skipped tasks in `tasks.md` are not identified or re-queued
- The orchestrator does not know which tasks correspond to the unaddressed files

---

## Expected Behavior

1. Blast radius hook blocks with a list of unaddressed files from `impact-analysis.md`
2. The phase-loop controller (in `isdlc.md` STEP 3f) reads the list of unaddressed files from the block message
3. The controller cross-references unaddressed files against `docs/isdlc/tasks.md` to identify skipped tasks
4. The controller sends the implementation agent back to address the missing files (with the specific task list)
5. Once all files are addressed (or explicitly deferred with justification in the requirements spec), the controller retries the gate

---

## Functional Requirements

### FR-01: Blast Radius Block Response -- Return to Implementation

**Description**: When the blast-radius-validator hook blocks advancement because unaddressed files exist, the phase-loop controller MUST return to the implementation phase (Phase 06) to address those files, rather than modifying the impact analysis or adding deferral entries.

**Acceptance Criteria**:
- AC-01.1: When blast-radius-validator returns a block with `unaddressed_files`, the controller re-delegates to the implementation agent with the file list
- AC-01.2: The controller MUST NOT modify `impact-analysis.md` to remove or defer files in response to a blast radius block
- AC-01.3: The controller MUST NOT modify state.json blast radius metadata to circumvent the block
- AC-01.4: The controller includes the specific unaddressed file paths in the re-delegation prompt

### FR-02: Task Plan Cross-Reference on Blast Radius Block

**Description**: When blast radius blocks, the controller MUST cross-reference the unaddressed files against `docs/isdlc/tasks.md` to identify which tasks were skipped.

**Acceptance Criteria**:
- AC-02.1: The controller reads `docs/isdlc/tasks.md` when processing a blast radius block
- AC-02.2: For each unaddressed file, the controller finds the corresponding task(s) in `tasks.md`
- AC-02.3: The matched tasks are included in the re-delegation prompt to the implementation agent
- AC-02.4: If a task for an unaddressed file is already marked `[X]` in tasks.md, the controller logs this discrepancy (file unaddressed but task marked done)

### FR-03: Blast Radius Retry Loop

**Description**: After re-implementation, the controller MUST retry the gate check (including blast radius validation) to verify all files are now addressed.

**Acceptance Criteria**:
- AC-03.1: After re-delegation to implementation completes, the controller re-runs the gate validation
- AC-03.2: The retry loop has a maximum of 3 iterations to prevent infinite loops
- AC-03.3: If the retry limit is exceeded, the controller escalates to human with a summary of remaining unaddressed files
- AC-03.4: Each retry iteration is logged in state.json with the remaining unaddressed file count

### FR-04: Explicit Deferral Mechanism

**Description**: The only acceptable way to defer an impacted file is if the requirements spec explicitly documents the deferral with justification. The orchestrator/controller MUST NOT auto-generate deferrals.

**Acceptance Criteria**:
- AC-04.1: A file can only be considered "deferred" if the requirements-spec.md contains a `## Deferred Files` section listing it with justification
- AC-04.2: The blast-radius-validator accepts files listed in the requirements spec's deferred section
- AC-04.3: Auto-generated deferrals (added by the orchestrator during blast radius block handling) are NOT valid
- AC-04.4: The blast-radius-validator checks for the deferred section in the requirements spec when validating

### FR-05: Phase-Loop Controller STEP 3f Enhancement

**Description**: The existing STEP 3f in `isdlc.md` (hook block handling) must be enhanced to handle blast-radius-validator blocks specifically.

**Acceptance Criteria**:
- AC-05.1: STEP 3f detects when the blocking hook is `blast-radius-validator`
- AC-05.2: For blast-radius blocks, STEP 3f extracts the unaddressed file list from the hook's stop reason
- AC-05.3: STEP 3f reads `docs/isdlc/tasks.md` and matches unaddressed files to task entries
- AC-05.4: STEP 3f re-delegates to the implementation agent (Phase 06) with the matched task list
- AC-05.5: After re-implementation, STEP 3f re-runs the gate check (loops back to STEP 3d)

---

## Non-Functional Requirements

### NFR-01: No Regression in Blast Radius Validation

The blast-radius-validator.cjs hook itself does NOT need changes. Only the response to its blocks changes. All existing blast radius validation logic must continue to work as-is.

### NFR-02: Backward Compatibility

The enhanced STEP 3f must continue to handle all other hook blocks (non-blast-radius) using the existing logic. The blast-radius-specific handling is an additional code path, not a replacement.

### NFR-03: Logging and Observability

All blast radius retry iterations must be logged in state.json history for post-hoc analysis, including: iteration number, unaddressed file count, matched task count, and outcome.

---

## Affected Components

| Component | Change Type | Description |
|-----------|-------------|-------------|
| `src/claude/commands/isdlc.md` | Modify | STEP 3f: add blast-radius-specific block handling with task cross-reference and re-delegation |
| `src/claude/agents/00-sdlc-orchestrator.md` | Modify | Add guidance preventing blast radius relaxation; document re-implementation pattern |
| `src/claude/hooks/blast-radius-validator.cjs` | No change | Correctly identifies unaddressed files (verified working) |
| `docs/isdlc/tasks.md` | Read-only | Cross-referenced during blast radius block handling |

---

## Out of Scope

- Changes to blast-radius-validator.cjs hook logic (working correctly)
- Changes to impact-analysis.md generation (Phase 02 agent)
- New hook creation
- UI/CLI changes
