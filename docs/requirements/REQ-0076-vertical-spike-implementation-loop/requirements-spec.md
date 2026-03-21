# Requirements Specification: Vertical Spike — Implementation Loop Shared Core Slice

**Item**: REQ-0076 | **GitHub**: #140 | **Depends on**: REQ-0070, REQ-0071, REQ-0072, REQ-0075
**Workstream**: C (Provider Adapters) | **Phase**: 1
**Status**: Analyzed

---

## 1. Business Context

This is the first code extraction — prove one bounded shared-core slice end-to-end before scaling out. The Writer/Reviewer/Updater implementation loop was selected because it's bounded, already structured, and exercises validators, state, artifacts, skills, and looping without touching Discover or Roundtable.

**Success metric**: Minimal `src/core/` slice exists. Claude path continues working identically. Loop orchestration logic is provider-neutral.

## 2. Technical Context

### Current Implementation Loop

The loop spans 3 agent files + orchestration:
- **Writer** (`05-software-developer.md` in WRITER MODE): Produces one file, announces FILE_PRODUCED, stops
- **Reviewer** (`05-implementation-reviewer.md`): Reviews against 8 categories, produces PASS or REVISE
- **Updater** (`05-implementation-updater.md`): Fixes BLOCKING findings, re-runs tests

Orchestrated by `16-quality-loop-engineer.md` which manages: file ordering, cycle counting (max 3 per file), verdict routing (PASS → next file, REVISE → Updater → re-review), TDD ordering, state persistence.

### Structured Contracts (already defined)

- `WRITER_CONTEXT`: mode, per_file_loop, tdd_ordering, file_number, total_files, completed_files
- `REVIEW_CONTEXT`: file_path, file_number, cycle, tech_stack, constitution_path
- `UPDATE_CONTEXT`: file_path, cycle, reviewer_verdict, findings (blocking + warning)

### Phase 0 Decisions Applied

- ADR-CODEX-006: Core in ESM with CJS bridge
- ADR-CODEX-004: Antigravity is peer provider (not involved in this spike)
- ADR-CODEX-005: Analyze is separate (not involved in this spike)

## 3. Functional Requirements

### FR-001: Create src/core/ Scaffold (Minimum Slice)
**Confidence**: High

- **AC-001-01**: Given the spike, then `src/core/` exists with at minimum: `state/`, `teams/`, and `bridge/`.
- **AC-001-02**: Given ADR-CODEX-006, then core modules are ESM with CJS bridge wrappers.

### FR-002: Extract Loop State Management
**Confidence**: High

- **AC-002-01**: Given the implementation loop, then `src/core/teams/implementation-loop.js` contains provider-neutral loop orchestration: file ordering, cycle management, verdict routing.
- **AC-002-02**: Given the loop state, then it tracks: current_file_index, cycle_count_per_file, completed_files, verdict_history.
- **AC-002-03**: Given the team spec, then it defines: team_type, members, parallelism, max_iterations_per_file, state_owner.

### FR-003: Extract State Persistence
**Confidence**: High

- **AC-003-01**: Given the loop, then `src/core/state/index.js` provides readState() and writeState() for loop progress tracking.
- **AC-003-02**: Given state writes, then they are atomic (full JSON write, not partial).

### FR-004: Define Provider-Neutral Contracts
**Confidence**: High

- **AC-004-01**: Given the loop, then JSON schemas exist for WRITER_CONTEXT, REVIEW_CONTEXT, UPDATE_CONTEXT in `src/core/teams/contracts/`.
- **AC-004-02**: Given a provider adapter, then it produces/consumes these exact contract shapes regardless of whether it's Claude, Codex, or Antigravity.

### FR-005: Preserve Claude Path
**Confidence**: High

- **AC-005-01**: Given the extraction, then the 3 agent files (writer, reviewer, updater) remain unchanged as Claude-specific role packaging.
- **AC-005-02**: Given the quality-loop-engineer, then it calls core loop orchestration instead of inline loop logic.
- **AC-005-03**: Given Claude execution, then behavior is identical to pre-extraction (verified by REQ-0077).

## 4. Out of Scope

| Item | Reason |
|------|--------|
| Extracting ValidatorEngine | Not needed for this spike — reviewer does its own validation |
| Extracting WorkflowEngine | Not needed — the loop is within a phase, not across phases |
| Extracting BacklogService | Not needed for this loop |
| Modifying agent file content | Agent files stay as-is; only orchestration moves |

## 5. MoSCoW Prioritization

| FR | Title | Priority |
|----|-------|----------|
| FR-001 | Core scaffold | Must Have |
| FR-002 | Loop state management | Must Have |
| FR-003 | State persistence | Must Have |
| FR-004 | Provider-neutral contracts | Must Have |
| FR-005 | Preserve Claude path | Must Have |
