# Requirements Specification: REQ-0004 Advisory Behavior Hooks

**Version:** 1.0
**Date:** 2026-02-08
**Status:** Approved
**Workflow:** Feature (REQ-0004-advisory-behavior-hooks)

---

## 1. Overview

The iSDLC framework has 14 critical behaviors enforced only via LLM prompts (advisory). LLMs can and do ignore these in practice. This feature (Phase 1 of 2) adds deterministic hook-based enforcement for the 7 most critical behaviors, converting them from prompt-only advisory to hook-enforced guarantees.

Phase 2 (future) will address the remaining ~7 behaviors and add a logging infrastructure.

## 2. Problem Statement

### 2.1 Advisory-Only Enforcement Is Unreliable

The framework relies on prompt instructions to enforce critical behaviors like "show the plan to the user," "don't commit to main during a workflow," and "execute phases in order." All of these have been observed to fail in practice because LLMs can ignore prompt instructions.

### 2.2 Observed Failures

All of the following have been observed:
- Plan not surfaced to the user; progress not visible
- Phases executed out of order (skipping ahead)
- Commits made to main while a feature branch is active
- /discover presenting wrong menu options
- TaskCreate/TaskUpdate not called before phase delegation (no progress spinners)
- Constitution walkthrough skipped during /discover
- Fake test/elicitation state written to state.json

### 2.3 Impact

Users cannot trust the framework's workflow guarantees. The framework's value proposition (structured, gated SDLC) is undermined when agents can bypass the structure.

## 3. Functional Requirements

### FR-01: Phase-Loop Controller Hook

**Hook name:** `phase-loop-controller.cjs`
**Hook type:** PreToolUse[Task]
**Purpose:** Validate that TaskCreate or TaskUpdate was called before the orchestrator delegates to a phase agent via the Task tool.

**Behavior:**
- On PreToolUse[Task], read stdin JSON for the task prompt content
- Check if the task prompt contains a phase delegation pattern (agent name from skills-manifest.json or phase keyword)
- If it IS a phase delegation:
  - Read state.json `active_workflow` to determine current phase
  - Verify that a TaskUpdate with `status: "in_progress"` was recorded for the current phase's task
  - If TaskUpdate was NOT called: output `{"decision": "block", "reason": "Phase delegation without TaskUpdate. Call TaskUpdate to mark the phase task as in_progress before delegating."}`
- If it is NOT a phase delegation: allow (no output)
- Fail-open: if state.json is unreadable or active_workflow is null, allow

**Acceptance Criteria:**
- AC-01: Hook blocks Task tool calls that match phase delegation patterns when no TaskUpdate was called
- AC-01a: Hook allows Task tool calls that are not phase delegations
- AC-01b: Hook allows when active_workflow is null (no workflow active)
- AC-01c: Hook fails open on state.json read errors

### FR-02: Plan Surfacing Enforcer Hook

**Hook name:** `plan-surfacer.cjs`
**Hook type:** PreToolUse[Task]
**Purpose:** Ensure the task plan (tasks.md) has been generated and displayed before implementation phases begin.

**Behavior:**
- On PreToolUse[Task], check if the current phase is an implementation-or-later phase (06-implementation or later in the workflow array)
- If yes, verify that `docs/isdlc/tasks.md` exists (plan was generated)
- If tasks.md does NOT exist and we are past phase 01:
  - Output `{"decision": "block", "reason": "Task plan (docs/isdlc/tasks.md) not generated. Run generate-plan skill before proceeding."}`
- Otherwise: allow (no output)
- Fail-open: if state.json is unreadable, allow

**Acceptance Criteria:**
- AC-02: Hook blocks delegation to implementation+ phases when tasks.md is missing
- AC-02a: Hook allows delegation to early phases (01, 02, 03, 04, 05) without tasks.md
- AC-02b: Hook allows all delegations when tasks.md exists
- AC-02c: Hook fails open on file system errors

### FR-03: Sequential Phase Execution Hook

**Hook name:** `phase-sequence-guard.cjs`
**Hook type:** PreToolUse[Task]
**Purpose:** Block out-of-order phase delegation. Phases must execute in the workflow array order.

**Behavior:**
- On PreToolUse[Task], detect if the task prompt is a phase delegation (same detection as FR-01)
- If it IS a phase delegation:
  - Extract the target phase from the task prompt (match against known phase names/agent names)
  - Read state.json `active_workflow.phases` array and `active_workflow.current_phase`
  - Verify the target phase matches `current_phase` (the phase we should be working on)
  - If target phase does NOT match current_phase: output `{"decision": "block", "reason": "Out-of-order phase delegation. Current phase is {current_phase}, but attempting to delegate to {target_phase}."}`
- If NOT a phase delegation: allow
- Fail-open: if state.json is unreadable or no active_workflow, allow

**Acceptance Criteria:**
- AC-03: Hook blocks delegation to a phase that is not the current_phase
- AC-03a: Hook allows delegation to the correct current_phase
- AC-03b: Hook allows non-phase-delegation Task calls
- AC-03c: Hook fails open when no active workflow exists
- AC-03d: Hook fails open on state.json read errors

### FR-04: Branch Management Hook

**Hook name:** `branch-guard.cjs`
**Hook type:** PreToolUse[Bash]
**Purpose:** Block git commits to main when an active workflow has a feature branch.

**Behavior:**
- On PreToolUse[Bash], check if the bash command contains `git commit`
- If yes:
  - Read state.json `active_workflow.git_branch`
  - If git_branch exists and git_branch.status is "active":
    - Run `git rev-parse --abbrev-ref HEAD` to get current branch
    - If current branch is `main` or `master`: output `{"decision": "block", "reason": "Cannot commit to main during active workflow. Switch to branch {git_branch.name} first."}`
    - If current branch is the workflow branch: allow
  - If no git_branch or status is not "active": allow
- If the command is NOT `git commit`: allow
- Fail-open: if state.json is unreadable or git command fails, allow

**Acceptance Criteria:**
- AC-04: Hook blocks `git commit` on main when active workflow has an active branch
- AC-04a: Hook allows `git commit` on the correct feature branch
- AC-04b: Hook allows `git commit` when no active workflow exists
- AC-04c: Hook allows `git commit` when active workflow has no git_branch
- AC-04d: Hook allows non-git-commit bash commands
- AC-04e: Hook fails open on state.json or git errors

### FR-05: State Write Validation Hook

**Hook name:** `state-write-validator.cjs`
**Hook type:** PostToolUse[Write,Edit]
**Purpose:** Validate state.json writes for correctness -- prevent fake test iteration data, fake elicitation data, and incorrect monorepo path routing.

**Behavior:**
- On PostToolUse, check if the tool output indicates a write to a file ending in `state.json` (or a path containing `.isdlc/state.json` or `.isdlc/projects/*/state.json`)
- If yes:
  - Read the written state.json file
  - Validate structural integrity:
    - `phases[*].constitutional_validation.iterations_used` must be >= 1 if `completed` is true
    - `phases[*].iteration_requirements.interactive_elicitation.menu_interactions` must be >= min from iteration-requirements.json if `completed` is true
    - `phases[*].iteration_requirements.test_iteration.current_iteration` must be >= 1 if `completed` is true
  - If validation fails: log a warning to stderr (do NOT block -- PostToolUse cannot undo writes)
- If NOT a state.json write: no output
- Fail-open: always (PostToolUse hooks are observational)

**Acceptance Criteria:**
- AC-05: Hook detects writes to state.json paths (single-project and monorepo)
- AC-05a: Hook warns on fake constitutional_validation (completed=true but iterations_used=0)
- AC-05b: Hook warns on fake interactive_elicitation (completed=true but menu_interactions below minimum)
- AC-05c: Hook warns on fake test_iteration (completed=true but current_iteration=0)
- AC-05d: Hook never blocks (PostToolUse is observational only)
- AC-05e: Hook fails open on read/parse errors

### FR-06: Constitution Walkthrough Tracker Hook

**Hook name:** `walkthrough-tracker.cjs`
**Hook type:** PostToolUse[Task]
**Purpose:** Track that the constitution walkthrough was completed during /discover before allowing SDLC workflow start.

**Behavior:**
- On PostToolUse[Task], check if the task output indicates a /discover completion
- If the task prompt contained "discover" orchestrator delegation:
  - Read state.json `discovery_context.walkthrough_completed`
  - If walkthrough_completed is NOT true: log warning to stderr ("Discovery completed without constitution walkthrough")
- When PreToolUse[Skill] detects `/sdlc` invocation and discovery_context exists but walkthrough_completed is false:
  - This is handled by the existing delegation-gate or a new check in plan-surfacer
- Fail-open: always

**Acceptance Criteria:**
- AC-06: Hook detects discover orchestrator task completions
- AC-06a: Hook logs warning when walkthrough_completed is false after discover
- AC-06b: Hook is silent when walkthrough_completed is true
- AC-06c: Hook fails open on all errors

### FR-07: Discover Menu Validation Hook

**Hook name:** `discover-menu-guard.cjs`
**Hook type:** PostToolUse[Task]
**Purpose:** Verify that the /discover command presents the correct 3-option menu (not old 4-option or arbitrary menus).

**Behavior:**
- On PostToolUse[Task], check if the task was a /discover delegation
- If yes:
  - Check the task output for menu markers:
    - Must contain options for "New Project," "Existing Project," and "Chat/Explore" (or close variants)
    - Must NOT contain removed options ("Scoped Analysis," "Auto-detect" as a separate option)
  - If wrong menu detected: log warning to stderr ("Discover presented incorrect menu. Expected 3 options: New Project, Existing Project, Chat/Explore")
- Fail-open: always (PostToolUse is observational)

**Acceptance Criteria:**
- AC-07: Hook detects discover task delegations
- AC-07a: Hook logs warning when incorrect menu options are detected in output
- AC-07b: Hook is silent when correct 3-option menu is detected
- AC-07c: Hook fails open on all errors

## 4. Non-Functional Requirements

### NFR-01: Fail-Open Behavior (Article X)

ALL hooks MUST fail open. If a hook encounters any error (file not found, JSON parse failure, missing state, unexpected data structure), it MUST:
- Produce no stdout output (which means "allow" to Claude Code)
- Optionally log the error to stderr for debugging
- Never crash with a non-zero exit code that would disrupt the user's workflow

### NFR-02: Performance

- PreToolUse hooks: must complete within 10 seconds (existing timeout)
- PostToolUse hooks: must complete within 5 seconds (existing timeout)
- Hooks should minimize file I/O -- read state.json once per invocation, not multiple times
- No network calls

### NFR-03: Compatibility

- All hooks must be CJS (.cjs extension) per Article XII
- Must work with Node.js 18, 20, 22 (CI matrix)
- Must work on macOS, Linux, and Windows (CI matrix)
- Must use only Node.js built-in modules (no npm dependencies) per Article V
- Must follow the existing hook stdin/stdout JSON protocol per Article XIII

### NFR-04: Testability

- Each hook must have a co-located test file (`*.test.cjs` in `src/claude/hooks/tests/`)
- Tests must use `node:test` per Article II
- Tests must simulate the actual stdin/stdout JSON protocol per Article XI
- Minimum: 10 test cases per hook (covering all AC + error paths)

### NFR-05: No Regressions

- Existing 586+ tests must continue passing
- Existing 11 hooks must not be broken by new hook registration
- settings.json hook ordering must be preserved for existing hooks

## 5. Phase 2 Backlog (Out of Scope)

The following items are explicitly deferred to Phase 2 and should be added to the CLAUDE.md backlog:

1. Remaining ~7 advisory behaviors not covered by this feature
2. Centralized logging infrastructure for hook warnings/blocks
3. Hook metrics dashboard (block count, warning count, fail-open count)
4. Hook dry-run mode for testing enforcement without blocking
5. Hook configuration in settings.local.json for per-project overrides

## 6. Constraints

- Maximum 7 new hook files (one per FR)
- Each hook must be a single .cjs file (no multi-file hooks)
- Shared utilities go in existing `src/claude/hooks/lib/common.cjs`
- Hook registration in `src/claude/settings.json` (source) and installer must deploy to `.claude/hooks/`
- No changes to the hook protocol itself (stdin/stdout JSON format is fixed)

## 7. Dependencies

- Existing `common.cjs` library (read/write state.json, path utilities)
- Existing `iteration-requirements.json` (for min_menu_interactions thresholds)
- Existing `skills-manifest.json` (for agent name lookups in phase detection)
- `docs/isdlc/tasks.md` (for plan surfacing check -- file existence only)
