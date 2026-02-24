# Requirements Specification: Build Consumption -- Init Split & Smart Staleness

**Feature**: GH-60 + GH-61 (Feature B: Build Consumption)
**Artifact Folder**: gh-60-61-build-consumption-init-split-smart-staleness
**Phase**: 01-requirements
**Status**: Draft
**Created**: 2026-02-20

---

## 1. Project Overview

### 1.1 Problem Statement

The iSDLC build handler currently has two architectural problems:

1. **Coupled initialization** (GH-60): `MODE: init-and-phase-01` bundles workflow initialization (branch creation, state.json setup) with the first phase execution. With the three-verb model (`add`/`analyze`/`build`), the `analyze` verb completes phases 00-04 before `build` is invoked. When `build` consumes pre-analyzed work, the current init mode forces Phase 01 re-execution even though analysis artifacts already exist. The Phase-Loop Controller already handles phases 02+ but cannot handle Phase 01 because it is embedded in the init mode.

2. **Naive staleness detection** (GH-61): The `checkStaleness()` function in `three-verb-utils.cjs` uses a simple hash comparison (`meta.codebase_hash === currentHash`). Any commit difference -- even to completely unrelated files -- triggers a staleness warning menu. In parallel development workflows (multiple branches, concurrent features), this fires on nearly every build, creating unnecessary friction.

### 1.2 Business Drivers

- **Developer velocity**: Eliminate redundant Phase 01 re-execution on pre-analyzed items (saves 2-5 minutes per build).
- **Reduced interruptions**: Replace false-positive staleness warnings with targeted, blast-radius-aware checks.
- **Architectural consistency**: Make the Phase-Loop Controller the single execution path for all phases, simplifying the orchestration model.
- **Three-verb model maturity**: Complete the `add`/`analyze`/`build` separation by decoupling init from execution.

### 1.3 Success Metrics

- Zero Phase 01 re-executions when building a fully-analyzed item.
- Staleness warnings only appear when changed files overlap with the item's blast radius.
- Backward compatibility: existing `MODE: init-and-phase-01` continues to function during deprecation period.
- No regressions in existing build, feature, or fix workflows.

### 1.4 Scope

**In scope**:
- New `MODE: init-only` in the orchestrator
- Deprecation of `MODE: init-and-phase-01` (functional but deprecated)
- Phase-Loop Controller handling Phase 01 as any other phase
- Blast-radius-aware staleness check replacing naive hash comparison
- Updated staleness UX (silent / informational / warning tiers)

**Out of scope**:
- Changes to the `analyze` verb or Phase A pipeline
- Changes to individual phase agents (01-requirements, 02-impact-analysis, etc.)
- Changes to `MODE: single-phase` or `MODE: finalize`
- New state.json schema fields
- Changes to meta.json schema

---

## 2. Stakeholders and Personas

### Persona 1: Framework Developer (Primary)

- **Role**: Developer using iSDLC to build features via `add`/`analyze`/`build` workflow
- **Goals**: Fast, uninterrupted build execution on pre-analyzed items; no false-positive staleness warnings
- **Pain points**: Forced Phase 01 re-execution; staleness warnings on unrelated file changes
- **Key tasks**: `isdlc build "feature-name"`, reviewing staleness warnings, confirming build summaries

### Persona 2: Framework Maintainer (Secondary)

- **Role**: Developer maintaining the iSDLC framework itself
- **Goals**: Clean orchestration architecture; single execution path for all phases; testable utility functions
- **Pain points**: Dual execution paths (init bundles phase execution vs. Phase-Loop Controller); untestable staleness logic (no file-level granularity)
- **Key tasks**: Modifying isdlc.md, orchestrator, three-verb-utils; writing and maintaining tests

---

## 3. Functional Requirements

### FR-001: MODE: init-only (Workflow Initialization Without Phase Execution)

**Description**: The orchestrator must support a new `MODE: init-only` that performs all workflow initialization steps (state.json setup, branch creation, counter increment, meta.json update) but does NOT delegate to any phase agent. After initialization, it returns control to the caller (isdlc.md Phase-Loop Controller) with the full phases array.

**Priority**: Must Have

**Acceptance Criteria**:

| AC ID | Given | When | Then |
|-------|-------|------|------|
| AC-001-01 | The orchestrator receives `MODE: init-only` with `ACTION: feature` and `DESCRIPTION: "some feature"` | It processes the request | It creates `active_workflow` in state.json with correct type, description, phases array, current_phase set to the first phase, current_phase_index = 0, and all phase statuses set to "pending" |
| AC-001-02 | The orchestrator receives `MODE: init-only` with `START_PHASE: "05-test-strategy"` and `ARTIFACT_FOLDER: "gh-60-61-build-consumption"` | It processes the request | It slices the phases array from START_PHASE onward, uses the provided artifact folder (no counter increment), and sets current_phase to START_PHASE |
| AC-001-03 | The orchestrator receives `MODE: init-only` with a feature workflow that has `requires_branch: true` | It completes initialization | It creates the git branch (per Section 3a) before returning |
| AC-001-04 | The orchestrator completes `MODE: init-only` processing | It returns the result | It returns a JSON object: `{ "status": "init_complete", "phases": [...], "artifact_folder": "...", "workflow_type": "...", "next_phase_index": 0 }` |
| AC-001-05 | The orchestrator receives `MODE: init-only` | It completes initialization | It does NOT delegate to any phase agent. No Phase 01 (or START_PHASE) execution occurs. |
| AC-001-06 | The orchestrator receives `MODE: init-only` with `--supervised` flag | It processes the request | It sets `supervised_mode.enabled = true` in state.json, same as init-and-phase-01 behavior |

---

### FR-002: Phase-Loop Controller Handles All Phases (Including Phase 01)

**Description**: The Phase-Loop Controller in isdlc.md must be updated so that after receiving the init-only result, it executes ALL phases starting from `next_phase_index` (which is 0 for full workflows), including Phase 01. Currently, Phase 01 is handled by the init mode; after this change, the Phase-Loop Controller is the single execution path for all phases.

**Priority**: Must Have

**Acceptance Criteria**:

| AC ID | Given | When | Then |
|-------|-------|------|------|
| AC-002-01 | The Phase-Loop Controller receives an init result with `next_phase_index: 0` and `phases: ["01-requirements", "02-impact-analysis", ...]` | It begins the phase loop | It delegates to the Phase 01 agent (requirements-analyst) as the first iteration, using `MODE: single-phase PHASE: 01-requirements` |
| AC-002-02 | The Phase-Loop Controller receives an init result with `next_phase_index: 0` and `phases: ["05-test-strategy", "06-implementation", ...]` (pre-analyzed item with START_PHASE) | It begins the phase loop | It delegates to the Phase 05 agent (test-design-engineer) as the first iteration, skipping phases 00-04 |
| AC-002-03 | The Phase-Loop Controller completes Phase 01 delegation | It advances to the next phase | It follows the same STEP 3 protocol (3a through 3f) as it does for phases 02+, with no special-case handling for Phase 01 |
| AC-002-04 | The Phase-Loop Controller uses init-only mode | The task list is created in STEP 2 | ALL phases from the init result (including Phase 01 if present) appear in the task list. Phase 01's task is NOT pre-marked as completed. |
| AC-002-05 | The isdlc.md STEP 1 delegates to the orchestrator | It constructs the Task prompt | It uses `MODE: init-only` instead of `MODE: init-and-phase-01` |

---

### FR-003: Deprecate MODE: init-and-phase-01

**Description**: The existing `MODE: init-and-phase-01` must remain functional for backward compatibility during a deprecation period, but the primary call path in isdlc.md STEP 1 must switch to `MODE: init-only`. The orchestrator documentation and mode tables must mark `init-and-phase-01` as deprecated.

**Priority**: Must Have

**Acceptance Criteria**:

| AC ID | Given | When | Then |
|-------|-------|------|------|
| AC-003-01 | The orchestrator receives `MODE: init-and-phase-01` | It processes the request | It executes the full existing behavior (init + phase execution + gate + plan) unchanged -- no regression |
| AC-003-02 | The orchestrator's mode definition table is updated | A maintainer reads the documentation | `init-and-phase-01` is marked as `(deprecated)` with a note directing to `init-only` |
| AC-003-03 | The isdlc.md STEP 1 code is updated | A build is initiated via `/isdlc build` | STEP 1 uses `MODE: init-only` for the orchestrator delegation |
| AC-003-04 | The orchestrator processes `MODE: init-and-phase-01` | It logs or outputs a message | It emits a deprecation notice: "MODE: init-and-phase-01 is deprecated. Use MODE: init-only with Phase-Loop Controller." (to stderr or log, not blocking) |

---

### FR-004: Blast-Radius-Aware Staleness Check

**Description**: Replace the naive hash-comparison staleness check with a blast-radius-aware algorithm. When the codebase hash differs from the analysis hash, determine which files changed and intersect them with the blast radius from `impact-analysis.md`. The response is tiered: 0 overlaps = silent, 1-3 overlaps = informational note, 4+ overlaps = warning menu.

**Priority**: Must Have

**Acceptance Criteria**:

| AC ID | Given | When | Then |
|-------|-------|------|------|
| AC-004-01 | `meta.codebase_hash` differs from current HEAD and `impact-analysis.md` exists in the artifact folder | The staleness check runs | It executes `git diff --name-only {originalHash}..HEAD` to get the list of changed files |
| AC-004-02 | The changed files list and the blast radius file list have 0 overlapping files | The staleness check evaluates the overlap | It returns `{ stale: false, severity: "none", overlappingFiles: [], ... }` -- silent proceed, no user interaction |
| AC-004-03 | The changed files list and the blast radius file list have 1-3 overlapping files | The staleness check evaluates the overlap | It returns `{ stale: true, severity: "info", overlappingFiles: [...], ... }` -- informational note displayed but no menu, no blocking |
| AC-004-04 | The changed files list and the blast radius file list have 4 or more overlapping files | The staleness check evaluates the overlap | It returns `{ stale: true, severity: "warning", overlappingFiles: [...], ... }` -- warning menu presented with [P] Proceed / [Q] Re-scan / [A] Re-analyze options |
| AC-004-05 | `impact-analysis.md` does not exist in the artifact folder (e.g., partial analysis that skipped Phase 02) | The staleness check runs | It falls back to the existing naive hash comparison behavior (stale if hashes differ) |
| AC-004-06 | `git diff --name-only` fails (e.g., original hash no longer in history) | The staleness check runs | It falls back to the existing naive hash comparison behavior and logs a warning |

---

### FR-005: Extract Files from Impact Analysis

**Description**: A new utility function `extractFilesFromImpactAnalysis(mdContent)` must parse the "Directly Affected Files" table from `impact-analysis.md` and return a list of file paths. This function supports the blast-radius intersection logic in FR-004.

**Priority**: Must Have

**Acceptance Criteria**:

| AC ID | Given | When | Then |
|-------|-------|------|------|
| AC-005-01 | An `impact-analysis.md` contains a "Directly Affected Files" markdown table with a "File" or "Path" column | `extractFilesFromImpactAnalysis()` is called with the file content | It returns an array of file paths extracted from the table rows |
| AC-005-02 | An `impact-analysis.md` contains additional tables (e.g., "Indirect Dependencies") | `extractFilesFromImpactAnalysis()` is called | It extracts files ONLY from the "Directly Affected Files" table, not from other tables |
| AC-005-03 | The markdown content is empty, null, or contains no recognizable table | `extractFilesFromImpactAnalysis()` is called | It returns an empty array (no crash, no error) |
| AC-005-04 | File paths in the table use various formats (relative, absolute, with/without leading `./`) | `extractFilesFromImpactAnalysis()` is called | It normalizes paths to relative form (strip leading `./` or `/`) for consistent intersection matching |

---

### FR-006: Tiered Staleness UX in Build Handler

**Description**: The build handler steps 4b-4c in isdlc.md must be updated to consume the new blast-radius-aware staleness result and apply the appropriate UX tier: silent for no overlap, informational note for 1-3 overlaps, warning menu for 4+ overlaps.

**Priority**: Must Have

**Acceptance Criteria**:

| AC ID | Given | When | Then |
|-------|-------|------|------|
| AC-006-01 | The staleness check returns `severity: "none"` (0 overlapping files) | The build handler processes the staleness result | It proceeds silently to step 4d with no output and no user interaction |
| AC-006-02 | The staleness check returns `severity: "info"` with overlapping files `["src/commands/isdlc.md", "src/hooks/lib/three-verb-utils.cjs"]` | The build handler processes the staleness result | It displays an informational note listing the overlapping files but does NOT present a menu. Build proceeds automatically. |
| AC-006-03 | The staleness check returns `severity: "warning"` with 4+ overlapping files | The build handler processes the staleness result | It displays the staleness warning menu with [P] Proceed / [Q] Re-scan / [A] Re-analyze options (same options as current step 4c, but with the specific overlapping files listed) |
| AC-006-04 | The staleness check falls back to naive mode (no impact-analysis.md) | The build handler processes the staleness result | It behaves identically to the current step 4c behavior (hash-based warning menu) -- no regression |

---

### FR-007: init-only Return Format

**Description**: The `MODE: init-only` return JSON must include all fields needed by the Phase-Loop Controller to begin phase execution, maintaining consistency with the existing init-and-phase-01 return format but with `next_phase_index: 0` to indicate no phases have been executed.

**Priority**: Must Have

**Acceptance Criteria**:

| AC ID | Given | When | Then |
|-------|-------|------|------|
| AC-007-01 | The orchestrator completes `MODE: init-only` | It returns JSON | The return includes `status: "init_complete"`, `phases` (full or sliced array), `artifact_folder`, `workflow_type`, and `next_phase_index: 0` |
| AC-007-02 | The Phase-Loop Controller receives the init-only result | It reads `next_phase_index` | It starts phase execution from index 0 (the first phase in the phases array) |
| AC-007-03 | The orchestrator completes `MODE: init-only` with `START_PHASE` | It returns JSON | The `phases` array is sliced from START_PHASE onward, and `next_phase_index` is 0 (relative to the sliced array) |

---

## 4. Constraints

| ID | Constraint | Rationale |
|----|-----------|-----------|
| CON-001 | `MODE: init-and-phase-01` must remain functional during deprecation | Backward compatibility for any external references or in-flight workflows |
| CON-002 | No new state.json schema fields | Minimize migration burden; existing schema supports all new behavior |
| CON-003 | No new meta.json schema fields | Keep meta.json stable for existing tooling |
| CON-004 | `git` must be available at runtime for blast-radius staleness check | Already assumed by the framework (branch creation, hash lookup) |
| CON-005 | `impact-analysis.md` format must be treated as semi-stable | The "Directly Affected Files" table structure may vary slightly between analysts; parsing must be resilient |

---

## 5. Assumptions

| ID | Assumption |
|----|-----------|
| ASM-001 | The Phase-Loop Controller's existing STEP 3 protocol (3a-3f) can handle Phase 01 without modification, since Phase 01 uses the same `MODE: single-phase` delegation as all other phases |
| ASM-002 | The `impact-analysis.md` artifact is always generated during Phase 02 (impact-analysis) and is present whenever `phases_completed` includes `02-impact-analysis` |
| ASM-003 | Git history between `meta.codebase_hash` and HEAD is available (no force-pushes or history rewrites that would make `git diff --name-only` fail) |
| ASM-004 | The performance impact of `git diff --name-only` is negligible for typical repository sizes |
| ASM-005 | The Phase-Loop Controller already creates task lists in STEP 2 and marks completed tasks; extending this to include Phase 01 requires only removing the "pre-mark Phase 01 as completed" logic |

---

## 6. Glossary

| Term | Definition |
|------|-----------|
| Phase-Loop Controller | The execution engine in isdlc.md (STEP 3) that runs phases one at a time via `MODE: single-phase` orchestrator delegations |
| init-and-phase-01 | Current orchestrator mode that bundles workflow initialization with first phase execution |
| init-only | Proposed new orchestrator mode that performs only initialization (no phase execution) |
| Blast radius | The set of files identified by impact-analysis.md as directly affected by a feature |
| Staleness | Condition where codebase has changed since analysis was performed, potentially invalidating analysis artifacts |
| Three-verb model | The `add`/`analyze`/`build` workflow pattern where analysis and implementation are decoupled |
| meta.json | Per-item metadata file in the requirements directory tracking analysis status, phases completed, and codebase hash |

---

## 7. Non-Functional Requirements

### NFR-001: Backward Compatibility

**Description**: All existing workflows (feature, fix, test-run, test-generate, upgrade) must continue to function without modification when invoked via their current paths.

**Priority**: Must Have

| AC ID | Given | When | Then |
|-------|-------|------|------|
| AC-NFR-001-01 | A user invokes `/isdlc feature "new feature"` | The workflow executes | All phases execute successfully with no behavioral changes visible to the user |
| AC-NFR-001-02 | A user invokes `/isdlc fix "bug description"` | The workflow executes | The fix workflow functions identically to pre-change behavior |
| AC-NFR-001-03 | An external tool or script invokes `MODE: init-and-phase-01` | The orchestrator processes it | It produces the same output as before (init + phase + gate + plan) |

### NFR-002: Performance -- Staleness Check

**Description**: The blast-radius-aware staleness check must not add perceptible latency to the build handler.

**Priority**: Should Have

| AC ID | Given | When | Then |
|-------|-------|------|------|
| AC-NFR-002-01 | A repository with 500+ commits between analysis hash and HEAD | The staleness check runs `git diff --name-only` | The command completes in under 2 seconds |
| AC-NFR-002-02 | An impact-analysis.md with 50+ files in the blast radius | `extractFilesFromImpactAnalysis()` parses the file | Parsing completes in under 100ms |

### NFR-003: Resilience -- Graceful Degradation

**Description**: When blast-radius-aware staleness cannot be performed (missing impact-analysis.md, git errors), the system must fall back to existing naive behavior rather than failing.

**Priority**: Must Have

| AC ID | Given | When | Then |
|-------|-------|------|------|
| AC-NFR-003-01 | `impact-analysis.md` is missing from the artifact folder | The staleness check runs | It falls back to naive hash comparison (current behavior) |
| AC-NFR-003-02 | `git diff --name-only` returns a non-zero exit code | The staleness check runs | It falls back to naive hash comparison and logs a warning to stderr |
| AC-NFR-003-03 | `impact-analysis.md` exists but has no parseable "Directly Affected Files" table | `extractFilesFromImpactAnalysis()` runs | It returns an empty array, and staleness check falls back to naive behavior |

### NFR-004: Testability

**Description**: All new utility functions must be pure or have clear I/O boundaries suitable for unit testing.

**Priority**: Must Have

| AC ID | Given | When | Then |
|-------|-------|------|------|
| AC-NFR-004-01 | `extractFilesFromImpactAnalysis(mdContent)` | A developer writes tests | The function is pure (string in, array out) with no file system or git dependencies |
| AC-NFR-004-02 | The enhanced `checkStaleness()` or new `checkBlastRadiusStaleness()` function | A developer writes tests | Git operations are injectable or the function accepts pre-computed changed file lists for testing |

### NFR-005: Maintainability -- Single Execution Path

**Description**: After this change, the Phase-Loop Controller should be the single execution path for all phase delegations, eliminating the dual-path architecture.

**Priority**: Should Have

| AC ID | Given | When | Then |
|-------|-------|------|------|
| AC-NFR-005-01 | A maintainer reviews the orchestration architecture | They trace the execution flow for a full feature workflow | All phases (01 through 08) are executed by the Phase-Loop Controller; no phases are executed by the init mode |
| AC-NFR-005-02 | A maintainer reviews `MODE: init-only` | They check what the mode does | It performs ONLY initialization (state, branch, counters) with no agent delegation |

---

## 8. Traceability Summary

| Requirement | Source | User Stories |
|-------------|--------|-------------|
| FR-001 | GH-60 | US-001, US-002 |
| FR-002 | GH-60 | US-001, US-003 |
| FR-003 | GH-60 | US-004 |
| FR-004 | GH-61 | US-005, US-006 |
| FR-005 | GH-61 | US-005 |
| FR-006 | GH-61 | US-006, US-007 |
| FR-007 | GH-60 | US-001 |
| NFR-001 | GH-60 | US-004 |
| NFR-002 | GH-61 | US-005 |
| NFR-003 | GH-61 | US-007 |
| NFR-004 | GH-60, GH-61 | US-005 |
| NFR-005 | GH-60 | US-003 |
