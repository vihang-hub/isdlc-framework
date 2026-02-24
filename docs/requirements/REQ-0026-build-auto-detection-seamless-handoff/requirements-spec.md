# Requirements Specification: Build Auto-Detection and Seamless Phase 05+ Handoff

**Feature ID**: REQ-BUILD-AUTODETECT
**Source**: GitHub Issue #23 / Backlog Item 16.5
**Scope**: Feature
**Complexity**: Low-Medium (~12-15 files)
**Subsumes**: #17 (Phase B re-runs Phase 00/01), #9 (No post-Phase-A picker), #10 (No parallel analysis UX message)

---

## 1. Project Overview

### 1.1 Problem Statement

When a user says "build X", the `/isdlc build` verb always delegates to the orchestrator with `init-and-phase-01` mode, starting the full workflow from Phase 00 regardless of how much analysis has already been completed via `/isdlc analyze`. This forces users to re-run analysis phases that may have already produced validated artifacts, wasting time and creating duplicate work. If analysis is partial, there is no guidance -- the user sees the full workflow start from scratch.

### 1.2 Business Drivers

- **Efficiency**: The three-verb model (`add` / `analyze` / `build`) was designed so analysis and implementation can be decoupled. Without auto-detection, the build verb undermines this decoupling by ignoring prior analysis.
- **User Experience**: Users who have already run `/isdlc analyze` expect that `/isdlc build` will pick up where analysis left off, not restart from the beginning.
- **Framework Integrity**: The `meta.json` already tracks `phases_completed` and `analysis_status`. This data exists but is not consumed by the build verb.

### 1.3 Success Metrics

- SM-001: Build verb correctly skips already-completed analysis phases in 100% of fully-analyzed items.
- SM-002: Build verb correctly detects and presents partial analysis status in 100% of partially-analyzed items.
- SM-003: Staleness warnings are shown when codebase hash differs from meta.json, with zero false negatives.
- SM-004: No user reports of "build restarted my analysis" after this feature ships.

### 1.4 Scope Boundaries

**In Scope:**
- Build verb reading meta.json to determine analysis completion level
- Phase-skip logic for fully analyzed items
- UX for partial analysis states (resume or skip)
- Staleness detection via codebase hash comparison
- Phase summary display showing what will be skipped and why
- Orchestrator accepting a start-phase parameter

**Out of Scope:**
- Changes to the `analyze` verb behavior
- Changes to the `add` verb behavior
- Changes to meta.json schema (existing schema is sufficient)
- Parallel analysis execution
- Cross-workflow phase sharing (e.g., reusing fix analysis in feature workflow)
- Epic workflow sizing changes

---

## 2. Stakeholders and Personas

### 2.1 Primary Persona: Framework User (Developer)

- **Role**: Software developer using iSDLC to manage feature development
- **Goals**: Move from "I want to build this" to "code is shipping" with minimal friction
- **Pain Points**: Build verb ignores prior analysis work; must re-run phases 00-04 even when artifacts exist
- **Key Tasks**: Runs `analyze` on backlog items asynchronously, then comes back to `build` when ready to implement

### 2.2 Secondary Persona: Framework Maintainer

- **Role**: Developer maintaining the iSDLC framework itself
- **Goals**: Keep the three-verb model consistent and predictable
- **Pain Points**: Build verb is the only verb that doesn't respect meta.json; creates inconsistency in the verb model
- **Key Tasks**: Ensures phase-skip logic integrates cleanly with orchestrator, hooks, and state management

---

## 3. Functional Requirements

### FR-001: Analysis Status Detection on Build

The build verb MUST read meta.json for the resolved item and determine the analysis completion level before delegating to the orchestrator.

**Acceptance Criteria:**

- AC-001-01: Given a user runs `/isdlc build "payment-processing"`, When the item resolves to a directory with meta.json containing `phases_completed: ["00-quick-scan", "01-requirements", "02-impact-analysis", "03-architecture", "04-design"]` and `analysis_status: "analyzed"`, Then the build verb classifies the item as "fully analyzed".
- AC-001-02: Given a user runs `/isdlc build "payment-processing"`, When the item resolves to a directory with meta.json containing `phases_completed: ["00-quick-scan", "01-requirements"]` and `analysis_status: "partial"`, Then the build verb classifies the item as "partially analyzed".
- AC-001-03: Given a user runs `/isdlc build "payment-processing"`, When the item resolves to a directory with meta.json containing `phases_completed: []` and `analysis_status: "raw"`, Then the build verb classifies the item as "raw" (no analysis).
- AC-001-04: Given a user runs `/isdlc build "payment-processing"`, When the item resolves to a directory with NO meta.json, Then the build verb treats the item as "raw" and proceeds with the full workflow.
- AC-001-05: Given a user runs `/isdlc build "payment-processing"`, When meta.json exists but is corrupted (invalid JSON), Then the build verb treats the item as "raw", logs a warning, and proceeds with the full workflow.

### FR-002: Phase-Skip for Fully Analyzed Items

When the item is fully analyzed (all 5 analysis phases complete), the build verb MUST skip analysis phases and start the workflow from Phase 05 (test-strategy).

**Acceptance Criteria:**

- AC-002-01: Given an item with `analysis_status: "analyzed"` and `phases_completed` containing all 5 analysis phases, When the user confirms the build, Then the orchestrator initializes `active_workflow.phases` to `["05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"]` (skipping phases 00-04).
- AC-002-02: Given a fully analyzed item, When the build workflow starts, Then a summary banner is displayed showing: which phases were completed during analysis, the dates/timestamps of completion (if available from meta.json), and which phases will now execute.
- AC-002-03: Given a fully analyzed item, When the build workflow starts, Then the branch name still follows the standard pattern `feature/REQ-NNNN-{slug}` and the REQ counter is incremented normally.
- AC-002-04: Given a fully analyzed item, When the build workflow starts with phase-skip, Then existing analysis artifacts in `docs/requirements/{slug}/` (requirements-spec.md, user-stories.json, impact-analysis.md, architecture-spec.md, design documents) are preserved and referenced by subsequent phases -- they are NOT regenerated.

### FR-003: Partial Analysis Handling

When the item is partially analyzed, the build verb MUST present the user with clear options about how to proceed.

**Acceptance Criteria:**

- AC-003-01: Given an item with `analysis_status: "partial"` and `phases_completed: ["00-quick-scan", "01-requirements"]`, When the build verb detects partial analysis, Then it displays a summary showing completed phases (00-quick-scan, 01-requirements) and remaining analysis phases (02-impact-analysis, 03-architecture, 04-design).
- AC-003-02: Given a partially analyzed item, When the summary is displayed, Then the user is presented with a menu containing three options: `[R] Resume analysis` (continue from next incomplete analysis phase), `[S] Skip to implementation` (start at Phase 05, skipping remaining analysis), and `[F] Full restart` (re-run all phases from 00).
- AC-003-03: Given a partially analyzed item and the user selects `[R] Resume analysis`, Then the build verb determines the next incomplete analysis phase from `ANALYSIS_PHASES` (the first phase NOT in `phases_completed`), and initializes the workflow starting from that phase through Phase 08.
- AC-003-04: Given a partially analyzed item and the user selects `[S] Skip to implementation`, Then the build verb initializes the workflow with phases `["05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"]` and displays a warning that skipped analysis phases may result in lower quality output.
- AC-003-05: Given a partially analyzed item and the user selects `[F] Full restart`, Then the build verb clears `phases_completed` in meta.json, sets `analysis_status` to `"raw"`, and initializes the full workflow from Phase 00.
- AC-003-06: Given a partially analyzed item with an inconsistent `phases_completed` array (e.g., `["00-quick-scan", "02-impact-analysis"]` -- skipping 01-requirements), When the build verb detects this, Then it treats the completion level as up-to-the-last-contiguous-phase (in this example, only 00-quick-scan is considered complete) and logs a warning about the inconsistency.

### FR-004: Staleness Detection

The build verb MUST compare the codebase hash in meta.json with the current git HEAD to detect whether the codebase has changed since analysis was performed.

**Acceptance Criteria:**

- AC-004-01: Given an item with `codebase_hash: "abc1234"` in meta.json, When the current `git rev-parse --short HEAD` returns `"abc1234"` (same hash), Then no staleness warning is displayed.
- AC-004-02: Given an item with `codebase_hash: "abc1234"` in meta.json, When the current `git rev-parse --short HEAD` returns `"def5678"` (different hash), Then a staleness warning is displayed showing: the original hash, the current hash, and the number of commits between them (via `git rev-list --count abc1234..HEAD`).
- AC-004-03: Given a stale item (hashes differ), When the staleness warning is displayed, Then the user is presented with options: `[P] Proceed anyway` (use existing analysis as-is), `[Q] Re-run quick-scan` (refresh only Phase 00 to check for scope changes, then proceed with remaining analysis intact), and `[A] Re-analyze from scratch` (clear all analysis, start fresh).
- AC-004-04: Given a stale item and the user selects `[P] Proceed anyway`, Then the build continues normally using existing analysis artifacts, and `meta.json.codebase_hash` is NOT updated (it retains the original hash for traceability).
- AC-004-05: Given a stale item and the user selects `[Q] Re-run quick-scan`, Then Phase 00 is re-executed (updating the quick-scan artifact), `meta.json.codebase_hash` is updated to the current HEAD, and the workflow continues from the appropriate point based on remaining analysis status.
- AC-004-06: Given a stale item and the user selects `[A] Re-analyze from scratch`, Then `phases_completed` is cleared to `[]`, `analysis_status` is set to `"raw"`, `codebase_hash` is updated to current HEAD, and the full workflow starts from Phase 00.
- AC-004-07: Given an item with NO `codebase_hash` field in meta.json (legacy or manually created), When the build verb runs, Then staleness detection is skipped (no warning), and `codebase_hash` is populated with the current HEAD hash for future use.

### FR-005: Phase Summary Display

Before starting the workflow, the build verb MUST present a clear summary of what will happen.

**Acceptance Criteria:**

- AC-005-01: Given a fully analyzed item with no staleness, When the build verb is about to start, Then a summary banner is displayed in this format:
  ```
  BUILD SUMMARY: {item description}

  Analysis Status: Fully analyzed
  Completed phases:
    [done] Phase 00: Quick Scan
    [done] Phase 01: Requirements
    [done] Phase 02: Impact Analysis
    [done] Phase 03: Architecture
    [done] Phase 04: Design

  Build will execute:
    Phase 05: Test Strategy
    Phase 06: Implementation
    Phase 16: Quality Loop
    Phase 08: Code Review

  Proceed? [Y/n]
  ```
- AC-005-02: Given a raw item (no analysis), When the build verb is about to start, Then the summary shows all phases (00-08) as pending and no phases as completed.
- AC-005-03: Given a partially analyzed item where the user selected `[R] Resume`, When the summary is displayed, Then it shows completed phases as "[done]" and remaining phases (both analysis and implementation) as pending.

### FR-006: Orchestrator Phase-Skip Parameter

The orchestrator's `init-and-phase-01` mode MUST accept a `START_PHASE` parameter that allows the build verb to specify which phase to begin execution from.

**Acceptance Criteria:**

- AC-006-01: Given the orchestrator receives `MODE: init-and-phase-01` with `START_PHASE: "05-test-strategy"`, When it initializes the workflow, Then `active_workflow.phases` contains only `["05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"]` and `active_workflow.current_phase_index` is set to 0.
- AC-006-02: Given the orchestrator receives `START_PHASE: "02-impact-analysis"`, When it initializes the workflow, Then `active_workflow.phases` contains `["02-impact-analysis", "03-architecture", "04-design", "05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"]`.
- AC-006-03: Given the orchestrator receives `START_PHASE` with a value that is not a valid phase key from `workflows.json`, When it processes the parameter, Then it rejects the request with error `ERR-ORCH-INVALID-START-PHASE` and falls back to the full workflow.
- AC-006-04: Given the orchestrator receives `START_PHASE`, When it initializes the workflow, Then `resetPhasesForWorkflow()` is called with only the phases starting from `START_PHASE` onward (not the full feature phase array).
- AC-006-05: Given the orchestrator receives no `START_PHASE` parameter, When it initializes the workflow, Then behavior is identical to current behavior (full phase array, backward compatible).

### FR-007: Artifact Folder Naming with Pre-Analyzed Items

When building a pre-analyzed item, the build verb MUST use the existing artifact folder rather than creating a new one.

**Acceptance Criteria:**

- AC-007-01: Given a pre-analyzed item at `docs/requirements/build-auto-detection-seamless-handoff/`, When the build workflow starts, Then `active_workflow.artifact_folder` is set to `"build-auto-detection-seamless-handoff"` (the existing slug directory name).
- AC-007-02: Given a pre-analyzed item that already has a REQ-prefixed folder (e.g., `docs/requirements/REQ-0022-performance-budget-guardrails/`), When the build workflow starts, Then `active_workflow.artifact_folder` is set to the existing folder name and no new folder is created.
- AC-007-03: Given a raw item being built for the first time (no prior analysis), When the build workflow starts, Then the standard behavior applies: the orchestrator creates the `REQ-NNNN-{slug}` folder and increments the counter.

### FR-008: Meta.json Update After Build Starts

When a build workflow starts with phase-skip, the build verb MUST update meta.json to reflect that the item is now in an active build workflow.

**Acceptance Criteria:**

- AC-008-01: Given a pre-analyzed item enters a build workflow, When the orchestrator initializes the workflow, Then meta.json is updated with `"build_started_at": "{ISO-8601 timestamp}"` and `"workflow_type": "feature"`.
- AC-008-02: Given a build workflow completes successfully, When the orchestrator finalizes, Then meta.json is updated with `"build_completed_at": "{ISO-8601 timestamp}"` and `analysis_status` remains unchanged (it reflects analysis completion, not build completion).

---

## 4. Non-Functional Requirements

### NFR-001: Performance -- Build Verb Detection Latency

| NFR ID | Category | Requirement | Metric | Measurement Method | Priority |
|--------|----------|-------------|--------|-------------------|----------|
| NFR-001 | Performance | Build verb auto-detection (meta.json read + hash comparison + phase computation) must complete quickly | p95 < 2 seconds | Manual timing of build verb invocation to first UX prompt | Must Have |

**Acceptance Criteria:**

- AC-NFR-001-01: Given a backlog item with meta.json, When the build verb is invoked, Then the time between invocation and the first user-facing prompt (summary banner or staleness warning) is less than 2 seconds at p95.

### NFR-002: Performance -- Git Hash Comparison

| NFR ID | Category | Requirement | Metric | Measurement Method | Priority |
|--------|----------|-------------|--------|-------------------|----------|
| NFR-002 | Performance | Staleness check (git rev-parse + rev-list --count) must not block the UX | p95 < 1 second | Manual timing of git operations during build verb | Must Have |

**Acceptance Criteria:**

- AC-NFR-002-01: Given a repository with up to 10,000 commits, When the staleness check runs `git rev-parse --short HEAD` and `git rev-list --count {old}..HEAD`, Then both commands complete in under 1 second combined.

### NFR-003: Backward Compatibility

| NFR ID | Category | Requirement | Metric | Measurement Method | Priority |
|--------|----------|-------------|--------|-------------------|----------|
| NFR-003 | Compatibility | Build verb must remain backward compatible for items without meta.json | 100% backward compatibility | Regression testing: build verb on items without meta.json | Must Have |

**Acceptance Criteria:**

- AC-NFR-003-01: Given a user runs `/isdlc build "new-feature-description"` where no matching item exists in `docs/requirements/`, When the build verb runs, Then behavior is identical to the current implementation (add to backlog, then full workflow).
- AC-NFR-003-02: Given a user runs `/isdlc build "existing-item"` where the item directory exists but has no meta.json, When the build verb runs, Then the item is treated as "raw" and the full workflow starts.
- AC-NFR-003-03: Given a user runs `/isdlc feature "description"` (the alias), When the feature verb runs, Then it follows the same auto-detection logic as build (aliases remain equivalent).

### NFR-004: Robustness -- Graceful Degradation

| NFR ID | Category | Requirement | Metric | Measurement Method | Priority |
|--------|----------|-------------|--------|-------------------|----------|
| NFR-004 | Robustness | Auto-detection failures must degrade gracefully to full workflow | 0 user-facing crashes from detection failures | Error injection testing | Must Have |

**Acceptance Criteria:**

- AC-NFR-004-01: Given meta.json is corrupted (invalid JSON), When the build verb runs, Then a warning is logged, the item is treated as "raw", and the full workflow starts without error.
- AC-NFR-004-02: Given `git rev-parse` fails (e.g., not in a git repo, detached HEAD), When the staleness check runs, Then staleness detection is skipped, a warning is logged, and the build proceeds normally.
- AC-NFR-004-03: Given `phases_completed` contains unknown phase keys (e.g., a phase key from a future version), When the build verb computes analysis status, Then unknown keys are ignored (filtered against `ANALYSIS_PHASES`) and the status is computed from recognized phases only.

### NFR-005: Consistency -- Three-Verb Model Integrity

| NFR ID | Category | Requirement | Metric | Measurement Method | Priority |
|--------|----------|-------------|--------|-------------------|----------|
| NFR-005 | Consistency | Build verb must respect analysis state set by analyze verb | 100% consistency between analyze output and build input | Integration testing: analyze then build | Must Have |

**Acceptance Criteria:**

- AC-NFR-005-01: Given the user runs `/isdlc analyze "X"` completing phases 00-04, Then immediately runs `/isdlc build "X"`, When the build verb reads meta.json, Then it correctly detects `analysis_status: "analyzed"` and skips to Phase 05.
- AC-NFR-005-02: Given the user runs `/isdlc analyze "X"` completing phases 00-01 then stops, Then runs `/isdlc build "X"`, When the build verb reads meta.json, Then it correctly detects `analysis_status: "partial"` with `phases_completed: ["00-quick-scan", "01-requirements"]` and presents the partial analysis menu.

### NFR-006: Testability

| NFR ID | Category | Requirement | Metric | Measurement Method | Priority |
|--------|----------|-------------|--------|-------------------|----------|
| NFR-006 | Testability | All phase-detection and staleness logic must be implemented in testable utility functions | 100% of detection logic in three-verb-utils.cjs or a new utility file | Code review | Must Have |

**Acceptance Criteria:**

- AC-NFR-006-01: Given the auto-detection logic, When it is implemented, Then the following functions are exported from a utility module (three-verb-utils.cjs or a new file): `computeStartPhase(meta, workflowPhases)`, `checkStaleness(meta, currentHash)`, and `validatePhasesCompleted(phasesCompleted)`.
- AC-NFR-006-02: Given the exported utility functions, When unit tests are written, Then each function has at least 3 test cases covering: happy path, edge cases, and error conditions.

---

## 5. Constraints

### CON-001: No State.json Writes During Detection

The auto-detection logic (reading meta.json, computing analysis status, checking staleness) MUST NOT write to `.isdlc/state.json`. State writes only occur when the orchestrator initializes the workflow after user confirmation.

### CON-002: No Breaking Changes to Meta.json Schema

The meta.json schema MUST NOT be changed in a breaking way. New fields (e.g., `build_started_at`) are additive only. Existing fields (`analysis_status`, `phases_completed`, `codebase_hash`) retain their current semantics.

### CON-003: Workflow Rules Remain Enforced

The `no_halfway_entry` rule in `workflows.json` is relaxed for this feature specifically: the build verb can start a workflow at a phase other than the first. However, once the workflow starts, the `no_agent_phase_skipping` rule remains in effect -- agents cannot skip phases within the running workflow.

### CON-004: Single Active Workflow

The `single_active_workflow_per_project` rule remains in effect. The build verb MUST check for an active workflow before proceeding, regardless of analysis status.

---

## 6. Assumptions

- ASM-001: The `meta.json` schema as implemented by `three-verb-utils.cjs` is the source of truth for analysis status. No other files are consulted.
- ASM-002: The `ANALYSIS_PHASES` constant (`["00-quick-scan", "01-requirements", "02-impact-analysis", "03-architecture", "04-design"]`) defines the exhaustive set of analysis phases. A change to this constant would require updating this feature.
- ASM-003: Git is available on the system for staleness detection. If git is not available, staleness detection degrades gracefully (skip with warning).
- ASM-004: The feature workflow phase array in `workflows.json` is the authoritative source for determining which implementation phases follow analysis phases.
- ASM-005: `resolveItem()` from `three-verb-utils.cjs` is the canonical way to match user input to backlog items. This feature does not introduce alternative resolution strategies.

---

## 7. Dependencies

### 7.1 Upstream Dependencies

| Dependency | Status | Impact |
|-----------|--------|--------|
| #19: Three-verb model | DONE | Provides `resolveItem()`, `readMetaJson()`, `deriveAnalysisStatus()`, `ANALYSIS_PHASES` |
| `three-verb-utils.cjs` | Available | Core utility functions already exported and tested |
| `workflows.json` | Available | Feature workflow phase array is the source of truth |

### 7.2 Downstream Consumers

| Consumer | Impact |
|----------|--------|
| Build verb in `isdlc.md` | Primary change target -- adds detection logic before orchestrator delegation |
| Orchestrator agent (`00-sdlc-orchestrator.md`) | Accepts new `START_PHASE` parameter in `init-and-phase-01` mode |
| `common.cjs` (`resetPhasesForWorkflow`) | May need variant that accepts a subset of phases |
| Phase-Loop Controller (`isdlc.md` STEP 3) | No changes needed -- works with any phase array |

---

## 8. User Stories

### US-001: Build a Fully Analyzed Item

As a **developer**, I want to run `/isdlc build "payment-processing"` on an item where I have already completed all analysis phases, so that the framework skips directly to test strategy and implementation without re-running analysis.

**Acceptance Criteria:**
- AC-US-001-01: Given I have run `/isdlc analyze "payment-processing"` through all 5 analysis phases, When I run `/isdlc build "payment-processing"`, Then I see a summary showing all analysis phases as complete and the build starting from Phase 05.
- AC-US-001-02: Given the build starts from Phase 05, When Phase 05 (test-strategy) agent runs, Then it can read and reference the existing requirements-spec.md, impact-analysis.md, architecture-spec.md, and design documents produced during analysis.

**Linked Requirements:** FR-001, FR-002, FR-005

### US-002: Build a Partially Analyzed Item

As a **developer**, I want to run `/isdlc build "login-feature"` on an item where I only completed requirements, so that I am given clear options to resume analysis, skip to implementation, or start fresh.

**Acceptance Criteria:**
- AC-US-002-01: Given I have run `/isdlc analyze "login-feature"` completing only phases 00 and 01, When I run `/isdlc build "login-feature"`, Then I see a summary showing phases 00-01 as complete and phases 02-04 as pending, with a menu offering Resume/Skip/Full-restart.
- AC-US-002-02: Given I select `[R] Resume analysis`, When the workflow starts, Then it begins at Phase 02 (impact-analysis) and continues through Phase 08.
- AC-US-002-03: Given I select `[S] Skip to implementation`, When the workflow starts, Then it begins at Phase 05 (test-strategy) and I see a warning about potentially lower quality due to skipped analysis.

**Linked Requirements:** FR-001, FR-003, FR-005

### US-003: Build a Raw Item

As a **developer**, I want to run `/isdlc build "new-feature"` on an item that has no prior analysis, so that the full workflow runs from Phase 00 just as it does today.

**Acceptance Criteria:**
- AC-US-003-01: Given "new-feature" exists in the backlog with `analysis_status: "raw"`, When I run `/isdlc build "new-feature"`, Then the full workflow starts from Phase 00 with no phase-skip prompt.
- AC-US-003-02: Given "new-feature" does not exist in `docs/requirements/`, When I run `/isdlc build "new-feature"`, Then I am asked if I want to add it to the backlog and start building (current behavior preserved).

**Linked Requirements:** FR-001, FR-007

### US-004: Handle Stale Analysis

As a **developer**, I want to be warned when the codebase has changed since I last analyzed an item, so that I can decide whether to proceed with potentially outdated analysis or refresh it.

**Acceptance Criteria:**
- AC-US-004-01: Given I analyzed "payment-processing" 3 days ago and 15 commits have been pushed since, When I run `/isdlc build "payment-processing"`, Then I see a staleness warning showing the commit count and hash difference.
- AC-US-004-02: Given I see a staleness warning, When I select `[P] Proceed anyway`, Then the build starts with the existing analysis artifacts unchanged.
- AC-US-004-03: Given I see a staleness warning, When I select `[Q] Re-run quick-scan`, Then only Phase 00 is re-executed to check for scope changes, and the remaining analysis is preserved.

**Linked Requirements:** FR-004, FR-005

### US-005: Build with No Meta.json (Legacy/Manual Items)

As a **developer**, I want to build an item that was created before the three-verb model was introduced (no meta.json), so that the framework handles it gracefully without errors.

**Acceptance Criteria:**
- AC-US-005-01: Given an item directory exists at `docs/requirements/legacy-item/` with requirements-spec.md but no meta.json, When I run `/isdlc build "legacy-item"`, Then the build treats the item as "raw" and runs the full workflow.
- AC-US-005-02: Given the build completes on a legacy item, When the workflow finishes, Then a meta.json is created in the item directory tracking the build completion.

**Linked Requirements:** FR-001, FR-008

---

## 9. Prioritization (MoSCoW)

### Must Have (MVP)

| ID | Requirement | Rationale |
|----|-------------|-----------|
| FR-001 | Analysis Status Detection | Core feature -- without this, nothing else works |
| FR-002 | Phase-Skip for Fully Analyzed | Primary use case: build after complete analysis |
| FR-005 | Phase Summary Display | Users must understand what the build will do |
| FR-006 | Orchestrator Phase-Skip Parameter | Infrastructure required for FR-002 to work |
| FR-007 | Artifact Folder Naming | Prevents duplicate folders for pre-analyzed items |
| NFR-001 | Detection Latency < 2s | Detection must be fast enough to feel instant |
| NFR-003 | Backward Compatibility | Must not break existing build/feature workflows |
| NFR-004 | Graceful Degradation | Must not crash on corrupted or missing data |

### Should Have

| ID | Requirement | Rationale |
|----|-------------|-----------|
| FR-003 | Partial Analysis Handling | Important for partial analysis UX, but fully-analyzed and raw cases cover most users |
| FR-004 | Staleness Detection | Valuable safety net, but not blocking for initial release |
| NFR-005 | Three-Verb Consistency | Important for framework integrity |
| NFR-006 | Testability | Important for maintainability |

### Could Have

| ID | Requirement | Rationale |
|----|-------------|-----------|
| FR-008 | Meta.json Update After Build | Nice for traceability but not essential for core flow |
| NFR-002 | Git Hash Perf < 1s | Already likely to be fast; formal metric is nice-to-have |

### Won't Have (this release)

- Cross-workflow analysis reuse (e.g., reusing feature analysis for a fix workflow)
- Automatic staleness resolution without user confirmation
- Analysis phase parallelization
- Visual progress indicators beyond text banners

---

## 10. Error Taxonomy

| Error Code | Trigger | User-Facing Message | Recovery |
|------------|---------|---------------------|----------|
| ERR-BUILD-001 | `resolveItem()` returns null for a reference-style input (#N, PROJECT-N) | "No matching backlog item found for '{input}'. Check the slug, item number, or reference." | User retries with correct input |
| ERR-BUILD-002 | meta.json corrupted (invalid JSON) | "Warning: meta.json for '{slug}' is corrupted. Treating as new item." | Proceed as raw; meta.json will be recreated |
| ERR-BUILD-003 | `phases_completed` contains non-contiguous phases | "Warning: Analysis phases for '{slug}' appear incomplete. Treating completion up to last contiguous phase." | Use contiguous subset |
| ERR-BUILD-004 | `git rev-parse` fails | "Warning: Could not determine current codebase version. Skipping staleness check." | Skip staleness, proceed |
| ERR-ORCH-INVALID-START-PHASE | Orchestrator receives invalid START_PHASE | (Internal) "Invalid start phase '{phase}'. Falling back to full workflow." | Fall back to full workflow |

---

## 11. Glossary

| Term | Definition |
|------|-----------|
| Analysis phases | The first 5 phases of the feature workflow: 00-quick-scan, 01-requirements, 02-impact-analysis, 03-architecture, 04-design |
| Build phases | The implementation phases that follow analysis: 05-test-strategy, 06-implementation, 16-quality-loop, 08-code-review |
| Fully analyzed | An item whose meta.json has all 5 analysis phases in `phases_completed` |
| Partially analyzed | An item with 1-4 analysis phases completed |
| Raw | An item with no completed analysis phases |
| Staleness | When the codebase (git HEAD) has changed since the item's analysis was last performed |
| Phase-skip | Starting a workflow from a phase other than the first, skipping previously completed phases |
| Three-verb model | The iSDLC backlog interaction model: `add` (create), `analyze` (think through), `build` (implement) |
| meta.json | Per-item metadata file in `docs/requirements/{slug}/meta.json` tracking analysis status, phases completed, and codebase hash |

---

## 12. Traceability Matrix

| Requirement ID | User Story ID | Epic | Priority | Status |
|---------------|---------------|------|----------|--------|
| FR-001 | US-001, US-002, US-003, US-005 | Build Auto-Detection | Must Have | Draft |
| FR-002 | US-001 | Build Auto-Detection | Must Have | Draft |
| FR-003 | US-002 | Build Auto-Detection | Should Have | Draft |
| FR-004 | US-004 | Build Auto-Detection | Should Have | Draft |
| FR-005 | US-001, US-002, US-003, US-004 | Build Auto-Detection | Must Have | Draft |
| FR-006 | US-001, US-002 | Build Auto-Detection | Must Have | Draft |
| FR-007 | US-001, US-003, US-005 | Build Auto-Detection | Must Have | Draft |
| FR-008 | US-005 | Build Auto-Detection | Could Have | Draft |
| NFR-001 | All | Build Auto-Detection | Must Have | Draft |
| NFR-002 | US-004 | Build Auto-Detection | Could Have | Draft |
| NFR-003 | US-003, US-005 | Build Auto-Detection | Must Have | Draft |
| NFR-004 | US-005 | Build Auto-Detection | Must Have | Draft |
| NFR-005 | US-001, US-002 | Build Auto-Detection | Should Have | Draft |
| NFR-006 | All | Build Auto-Detection | Should Have | Draft |

---

## 13. Files Affected (from Quick Scan)

| File | Change Type | Purpose |
|------|------------|---------|
| `src/claude/commands/isdlc.md` | MODIFY | Build verb handler: add detection logic before orchestrator delegation |
| `src/claude/hooks/lib/three-verb-utils.cjs` | MODIFY | Add `computeStartPhase()`, `checkStaleness()`, `validatePhasesCompleted()` |
| `src/claude/agents/00-sdlc-orchestrator.md` | MODIFY | Accept `START_PHASE` parameter in init-and-phase-01 mode |
| `src/claude/hooks/lib/common.cjs` | MODIFY | `resetPhasesForWorkflow()` may need variant for partial phase arrays |
| `src/isdlc/config/workflows.json` | MODIFY | Relax `no_halfway_entry` rule with documented exception for build auto-detect |
| `src/claude/hooks/tests/three-verb-utils.test.cjs` | MODIFY | Add tests for new utility functions |
| `docs/requirements/*/meta.json` | NO CHANGE | Schema is sufficient; additive field `build_started_at` optional |

---

## Appendix A: Decision Log

### DEC-001: Partial Analysis Menu (3 options, not auto-resume)

**Decision**: Present a 3-option menu (Resume / Skip / Full restart) for partial analysis rather than auto-resuming.

**Rationale**: Auto-resuming could surprise users who intentionally stopped analysis. The menu gives explicit control while keeping the most common action (Resume) as the first option.

### DEC-002: Staleness Check Uses Short Hash Comparison

**Decision**: Use `git rev-parse --short HEAD` for hash comparison (7-char short hash).

**Rationale**: meta.json already stores short hashes (e.g., `"codebase_hash": "9e304d4"`). Full hashes would require a schema migration. Short hash collisions are astronomically unlikely in repositories under 1M commits.

### DEC-003: Phase Contiguity Validation

**Decision**: When `phases_completed` has gaps (e.g., [00, 02] missing 01), treat completion level as up to the last contiguous phase.

**Rationale**: Non-contiguous completion is an error state (likely from manual meta.json editing or a bug). Using the contiguous prefix is the safest interpretation -- it ensures the user doesn't skip a phase that was never actually completed.

### DEC-004: Relax `no_halfway_entry` Rule

**Decision**: The `no_halfway_entry` rule in `workflows.json` is relaxed specifically for the build verb's auto-detection feature. The build verb can start a workflow at a phase other than the first when analysis phases have been pre-completed.

**Rationale**: The rule was designed to prevent arbitrary phase skipping at runtime. The build auto-detection is a framework-level feature (like adaptive sizing) that modifies the phase array before the workflow begins, which is explicitly permitted per the `_comment_phase_skipping` annotation in workflows.json.
