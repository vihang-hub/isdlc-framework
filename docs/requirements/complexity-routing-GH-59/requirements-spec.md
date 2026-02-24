# Requirements Specification: Complexity-Based Routing

**Source**: GitHub Issue #59
**Category**: Workflow Quality
**Artifact Folder**: `complexity-routing-GH-59`
**Generated**: 2026-02-19
**Phase**: 01-requirements (ANALYSIS MODE -- no state.json writes, no branches)
**Scope Classification**: LARGE (~28-35 files, medium-high complexity)

---

## 1. Overview

### 1.1 Problem Statement

The framework's lightest path (`-light`) still runs 6 phases with gates, branches, and constitutional validation. For trivial changes (1-2 files, single concern, no architectural impact), this overhead causes developers to bypass the framework entirely -- losing audit trail and consistency. The existing sizing decision only kicks in after Phase 02 during `build`, which is too late for trivial changes that don't need any workflow at all.

### 1.2 Solution

Phase 02 (impact analysis) produces a `recommended_tier` based on actual blast radius data. Four tiers route work through progressively heavier workflow paths:

| Tier | File Count | Risk | Workflow Path |
|------|-----------|------|---------------|
| **trivial** | 1-2 files | Low, single concern | Direct edit -- no workflow, no branches, no gates |
| **light** | 3-8 files | Low-medium, single module | `/isdlc build -light` (skip arch + design) |
| **standard** | 9-20 files | Medium, cross-module | `/isdlc build` (full workflow) |
| **epic** | 20+ files | High, cross-cutting | `/isdlc build` with decomposition (#40) |

The trivial tier is a first-class framework option -- not a bypass. It still records changes in the requirements folder so the audit trail is preserved.

### 1.3 Key Principle

**Framework recommends, user decides.** The impact analysis produces a recommendation based on actual file counts, coupling, and risk. The user sees it at analyze completion and chooses at build time. No tier is auto-executed.

### 1.4 Related Items

- #51 -- Sizing decision always prompts user (completed, prerequisite)
- #57 -- Add sizing decision to analyze verb (parallel work, related but independent)
- REQ-0011 -- Adaptive workflow sizing (existing light/standard/epic intensity system)
- #40 -- Epic decomposition (future, depends on this)

---

## 2. Functional Requirements

### FR-001: Impact Analysis Produces Recommended Tier

Phase 02 impact analysis computes a `recommended_tier` based on actual blast radius data (file count, module count, risk score, coupling level). The tier is derived from the measured file count using defined thresholds and is included in the impact-analysis.md output and persisted to meta.json.

**Acceptance Criteria:**

**AC-001a**: Given the impact analysis measures N affected files, when the tier scoring algorithm runs, then it produces a `recommended_tier` value of exactly one of: `"trivial"`, `"light"`, `"standard"`, or `"epic"`.

**AC-001b**: Given the impact analysis completes, when impact-analysis.md is written, then it contains a `Recommended Tier` section showing the tier, the file count that drove it, the risk level, and a one-line rationale (e.g., "2 files, low coupling -- trivial tier recommended").

**AC-001c**: Given the impact analysis completes, when meta.json is updated by the analyze handler, then it contains a `recommended_tier` field at the top level with the string value.

---

### FR-002: Tier Scoring Algorithm

The tier is computed from actual impact analysis metrics (file count, risk score) with risk-based adjustment. The algorithm is deterministic and implemented as a pure function in `three-verb-utils.cjs`. It uses the same metrics shape produced by `parseSizingFromImpactAnalysis()` — real blast radius data, not estimates.

**Acceptance Criteria:**

**AC-002a**: Given the base file-count thresholds are: trivial <= 2, light <= 8, standard <= 20, epic > 20, when the function `computeRecommendedTier(fileCount, riskLevel, thresholds)` is called with actual file count from impact analysis (riskLevel is null or "low"), then it returns the tier matching the base thresholds.

**AC-002b**: Given the risk level is `"medium"` or `"high"`, when `computeRecommendedTier` is called, then the tier is promoted by one level (trivial becomes light, light becomes standard, standard becomes epic). A risk level of `"high"` with file count <= 2 returns `"light"`, not `"trivial"`.

**AC-002c**: Given `estimatedFiles` is null, undefined, or not a positive integer, when `computeRecommendedTier` is called, then it returns `"standard"` as a safe default and logs a warning to stderr.

**AC-002d**: Given `riskLevel` is an unrecognized string (not "low", "medium", "high", null, or undefined), when `computeRecommendedTier` is called, then it treats the risk as `"low"` (no promotion) and logs a warning to stderr.

---

### FR-003: Recommended Tier Recorded in meta.json

The `recommended_tier` field is persisted in meta.json after Phase 02 so downstream handlers (analyze step 8, build step 4a) can read it without re-running impact analysis.

**Acceptance Criteria:**

**AC-003a**: Given Phase 02 completes, when meta.json is written via `writeMetaJson()`, then the `recommended_tier` field is a string at the top level of the meta.json object.

**AC-003b**: Given an existing meta.json file that was created before this feature (no `recommended_tier` field), when `readMetaJson()` is called, then the missing field is treated as `null` -- no error is thrown and no default is injected into the file. Downstream consumers handle the null case explicitly.

**AC-003c**: Given meta.json already contains a `recommended_tier` from a previous analysis, when Phase 02 re-runs (re-analysis), then the `recommended_tier` is overwritten with the new value.

---

### FR-004: Analyze Handler Displays Recommended Tier (Step 8)

After the final analysis phase completes, the analyze handler displays the recommended tier alongside the "Analysis complete" message.

**Acceptance Criteria:**

**AC-004a**: Given analysis completes and meta.json contains a `recommended_tier`, when step 8 runs, then the output includes:
```
Analysis complete. {slug} is ready to build.
Recommended tier: {tier} -- {description}
```
where `{description}` is a brief explanation of the tier (e.g., "direct edit, no workflow" for trivial, "skip architecture and design" for light, "full workflow" for standard, "full workflow with decomposition" for epic).

**AC-004b**: Given analysis completes and meta.json does NOT contain a `recommended_tier` (legacy meta.json or scan failure), when step 8 runs, then the tier line is omitted entirely -- no error, no placeholder. The existing "Analysis complete" message displays unchanged.

**AC-004c**: Given a partial analysis (user stopped after Phase 02 but before Phase 04), when the user resumes and completes all phases, then step 8 displays the tier from meta.json (set during Phase 02, preserved through subsequent phases).

---

### FR-005: Build Handler Presents Tier Menu (Step 4a)

The build handler reads the `recommended_tier` from meta.json and presents a tier selection menu before starting the workflow. The recommended tier is highlighted as the default.

**Acceptance Criteria:**

**AC-005a**: Given meta.json contains `recommended_tier: "light"`, when build step 4a runs, then the user sees a menu:
```
Recommended workflow tier: light (3-8 files, skip architecture and design)

[1] Trivial -- direct edit, no workflow (1-2 files)
[2] Light -- skip architecture and design (3-8 files)  <-- RECOMMENDED
[3] Standard -- full workflow (9-20 files)
[4] Epic -- full workflow with decomposition (20+ files)

Select tier [2]:
```

**AC-005b**: Given the user presses Enter without selecting (accepts default), when the build handler proceeds, then it uses the recommended tier.

**AC-005c**: Given meta.json does NOT contain `recommended_tier` (legacy or missing), when build step 4a runs, then it defaults to `"standard"` and shows the menu without a `<-- RECOMMENDED` marker. A warning is displayed: "No tier recommendation available. Defaulting to standard."

**AC-005d**: Given the user selects `[1] Trivial`, when the build handler processes the selection, then it routes to the trivial tier execution path (FR-006) instead of creating a workflow.

**AC-005e**: Given the user selects any tier other than the recommended one, when the selection is processed, then `meta.json` is updated with `tier_override: { recommended: "{original}", selected: "{chosen}", overridden_at: "{ISO-8601}" }` for audit trail.

---

### FR-006: Trivial Tier Execution Path

When the user selects the trivial tier, the framework executes the change directly without creating a workflow, branches, gates, or state.json entries. The framework assists the user in making the edit, then records the change.

**Acceptance Criteria:**

**AC-006a**: Given the user selects trivial tier, when the trivial execution path starts, then NO workflow is created in state.json, NO git branch is created, NO phase-loop-controller is invoked, and NO gate validation runs.

**AC-006b**: Given the trivial execution path is active, when the framework assists with the edit, then it reads the requirements from `docs/requirements/{slug}/` (draft.md, requirements-spec.md, or quick-scan.md -- whichever exists) to understand what to change, and makes the edit on the current branch.

**AC-006c**: Given the edit is complete, when the user confirms the change, then the framework commits the change to the current branch with a commit message that includes the slug (e.g., "fix: {description} ({slug})").

**AC-006d**: Given the trivial execution path completes, when the change record is written (FR-007), then the build handler displays a completion summary:
```
Trivial change completed:
  Files modified: {list}
  Commit: {short SHA}
  Change record: docs/requirements/{slug}/change-record.md
```

**AC-006e**: Given the trivial execution path is active, when an error occurs during the edit (file not found, syntax error introduced, tests fail), then the framework reports the error to the user and does NOT write a change record. The user can retry or escalate to a higher tier.

---

### FR-007: Trivial Tier Audit Trail

Every trivial change is recorded in the requirements folder so the audit trail is preserved even without a full workflow. This is the traceability mechanism for trivial changes.

**Acceptance Criteria:**

**AC-007a**: Given a trivial change completes successfully, when the change record is written, then `docs/requirements/{slug}/change-record.md` is created (or appended to if it already exists) containing:
- Date and time (ISO-8601)
- Tier used (`trivial`)
- Summary of what changed and why
- List of files modified (absolute paths relative to project root)
- Commit SHA (full 40-character hash)
- Before/after snippet for each modified file (first 20 lines of diff per file, truncated with "..." if longer)

**AC-007b**: Given a trivial change is the second or subsequent trivial edit for the same slug, when the change record is written, then the new entry is APPENDED to the existing `change-record.md` with a horizontal rule separator (`---`), preserving all previous entries.

**AC-007c**: Given a trivial change completes, when meta.json is updated, then the following fields are set:
- `analysis_status`: `"completed"` (or preserved if already set)
- `tier_used`: `"trivial"`
- `last_trivial_change`: `{ "completed_at": "{ISO-8601}", "commit_sha": "{sha}", "files_modified": ["{file1}", "{file2}"] }`

**AC-007d**: Given a trivial change completes, when BACKLOG.md is checked, then the item's marker is updated using `updateBacklogMarker()` with `deriveBacklogMarker()` to reflect the completed status (if the item is tracked in BACKLOG.md).

---

### FR-008: User Can Override Recommended Tier

The user is never locked into the recommended tier. They can select any tier regardless of the recommendation.

**Acceptance Criteria:**

**AC-008a**: Given the recommended tier is `"trivial"`, when the user selects `[3] Standard` from the tier menu, then the full standard workflow is created and executed -- the recommendation is advisory only.

**AC-008b**: Given the recommended tier is `"standard"`, when the user selects `[1] Trivial` from the tier menu, then the trivial execution path runs -- the framework does not block downward tier selection. (The user takes responsibility for scope accuracy.)

**AC-008c**: Given the user overrides the recommended tier, when the override is recorded (AC-005e), then downstream phases (if any) can read `meta.json.tier_override` to understand the discrepancy between recommendation and selection.

---

### FR-009: Tier Descriptions in Utility Function

A utility function `getTierDescription(tier)` in `three-verb-utils.cjs` provides consistent tier descriptions for use in both the analyze display (FR-004) and build menu (FR-005).

**Acceptance Criteria:**

**AC-009a**: Given `tier` is one of `"trivial"`, `"light"`, `"standard"`, or `"epic"`, when `getTierDescription(tier)` is called, then it returns an object `{ label, description, fileRange }` with human-readable strings:
- trivial: `{ label: "Trivial", description: "direct edit, no workflow", fileRange: "1-2 files" }`
- light: `{ label: "Light", description: "skip architecture and design", fileRange: "3-8 files" }`
- standard: `{ label: "Standard", description: "full workflow", fileRange: "9-20 files" }`
- epic: `{ label: "Epic", description: "full workflow with decomposition", fileRange: "20+ files" }`

**AC-009b**: Given `tier` is an unrecognized string, when `getTierDescription(tier)` is called, then it returns a default object with label `"Unknown"`, description `"unrecognized tier"`, and fileRange `"unknown"`.

---

## 3. Non-Functional Requirements

### NFR-001: User Agency -- Framework Recommends, User Decides

The tier recommendation is advisory. No tier is auto-executed. The user must explicitly select a tier before any action is taken.

**Acceptance Criteria:**

**AC-NFR-001a**: Given a `recommended_tier` exists in meta.json, when the build handler runs, then it ALWAYS presents the tier menu (FR-005) and waits for user input. It never auto-selects or auto-executes the recommended tier.

**AC-NFR-001b**: Given the `--trivial` flag is passed to the build command, when the build handler runs, then it still displays a confirmation prompt ("Trivial tier selected via flag. Proceed with direct edit? [Y/n]") rather than executing silently.

**AC-NFR-001c**: Given any tier selection, when the selection is processed, then the audit trail records whether the tier was user-selected, defaulted, or overridden.

---

### NFR-002: Backward Compatibility with Existing meta.json

Existing meta.json files (created before this feature) must continue to work without modification or migration.

**Acceptance Criteria:**

**AC-NFR-002a**: Given a meta.json file without a `recommended_tier` field, when any handler reads meta.json, then no error is thrown and the handler operates with graceful defaults (FR-003 AC-003b, FR-004 AC-004b, FR-005 AC-005c).

**AC-NFR-002b**: Given a meta.json file without `tier_used` or `tier_override` fields, when any handler reads meta.json, then those fields are treated as absent (null) with no error.

**AC-NFR-002c**: Given the `computeStartPhase()` function in three-verb-utils.cjs, when called with a meta.json that has no tier-related fields, then the existing behavior is unchanged -- start phase computation works exactly as before.

---

### NFR-003: Trivial Tier Traceability

Trivial tier changes must have an audit trail equivalent in information content to what a full workflow produces, even though the format is different.

**Acceptance Criteria:**

**AC-NFR-003a**: Given a trivial change was made 6 months ago, when a developer inspects `docs/requirements/{slug}/change-record.md`, then they can determine: what was changed, why it was changed, which files were modified, who/what made the change, and the exact commit.

**AC-NFR-003b**: Given a project has a mix of trivial and full-workflow changes, when the `docs/requirements/` directory is listed, then every slug folder contains either (a) full workflow artifacts (requirements-spec.md, etc.) or (b) at minimum a change-record.md -- no untracked changes exist.

**AC-NFR-003c**: Given a trivial change-record.md and a full-workflow requirements-spec.md for different items, when both are reviewed, then they answer the same core questions: what, why, which files, and when.

---

### NFR-004: Trivial Path Performance

The trivial tier must be fast -- the entire path from tier selection to change-record.md written must complete in under 30 seconds of framework overhead (excluding actual edit time and user think time).

**Acceptance Criteria:**

**AC-NFR-004a**: Given the user selects trivial tier, when the framework sets up the trivial execution path (before the actual edit), then the setup completes in under 5 seconds.

**AC-NFR-004b**: Given the edit is complete and the user confirms, when the framework writes the change record, commits, and updates meta.json/BACKLOG.md, then the post-edit recording completes in under 10 seconds.

**AC-NFR-004c**: Given the trivial path runs, when total framework overhead is measured (excluding edit time and user interaction), then it is under 30 seconds.

---

### NFR-005: No State.json Pollution from Trivial Tier

The trivial tier must not write to `.isdlc/state.json` or interact with the workflow machinery in any way.

**Acceptance Criteria:**

**AC-NFR-005a**: Given the trivial execution path runs from start to finish, when `.isdlc/state.json` is inspected before and after, then the file is byte-identical (or does not exist if it didn't exist before).

**AC-NFR-005b**: Given the trivial execution path runs, when hook activity is inspected, then no phase-loop-controller, gate-blocker, state-write-validator, or phase-sequence-guard hooks are triggered.

**AC-NFR-005c**: Given the trivial execution path runs, when `active_workflow` in state.json is inspected, then no trivial workflow entry exists -- trivial changes are invisible to the workflow machinery.

---

## 4. Constraints

### CON-001: No New Agents

The trivial tier execution path does not require a new agent. The build handler in `isdlc.md` orchestrates the trivial path inline (like the analyze handler orchestrates analysis inline).

### CON-002: Tier Thresholds Are Configuration, Not Code

File-count thresholds (2, 8, 20) should be configurable via `workflows.json` under `workflows.feature.tier_thresholds`, not hardcoded in the scoring function. The function reads thresholds from config with hardcoded defaults as fallback.

### CON-003: Epic Tier Is Placeholder

The epic tier recommendation is output but the epic decomposition path (#40) is not implemented as part of this feature. Selecting epic in the tier menu routes to the standard workflow with a note: "Epic decomposition is not yet available. Running standard workflow."

### CON-004: Tier Scoring Does Not Replace Sizing

The tier recommendation (Phase 02) and the sizing decision (Phase 02, existing 3e-sizing) are complementary, not competing. Both derive from the same impact analysis data but answer different questions:
- **Tier** (Phase 02): Determines whether to run a workflow at all (trivial vs. workflow tiers). Evaluated during analyze and persisted in meta.json for build to consume.
- **Sizing** (Phase 02, build-time): Determines workflow intensity within non-trivial tiers (light vs. standard vs. epic). Evaluated at build time in STEP 3e-sizing.

If the user selects light/standard/epic tier at build time, the existing sizing flow at 3e-sizing still runs. The tier selection informs but does not override the sizing decision.

### CON-005: Analysis Mode Constraint

This specification was produced in ANALYSIS MODE. No state.json writes, no branch creation, no workflow initialization.

---

## 5. Assumptions

### ASM-001: Impact Analysis Metrics Are Reliable

The impact analysis produces actual blast radius data (file count, module count, coupling, risk score) which is reliable for tier recommendation. Unlike Phase 00 estimates, these are measured from codebase analysis. The user can still override if the recommendation seems wrong.

### ASM-002: Single Branch for Trivial Changes

Trivial changes are committed to the current branch (typically `main`). No feature branch is created. This is acceptable because trivial changes are 1-2 files with minimal risk.

### ASM-003: Existing Test Infrastructure Sufficient

The existing test infrastructure (Jest, test files in `src/claude/hooks/tests/`) is sufficient for testing the new utility functions and tier scoring logic.

---

## 6. Out of Scope

- **Epic decomposition logic** (#40) -- epic tier is recognized but not implemented beyond routing to standard
- **Tier re-evaluation after Phase 02** -- once the tier is computed from impact analysis, it is not re-evaluated in later phases. The tier is final once Phase 02 completes.
- **Trivial tier for bug-fix workflows** -- this feature targets feature workflows only. Bug-fix workflows continue to use the existing flow.
- **Automated tier selection** -- no `--auto` flag that skips the tier menu. User must always confirm.
- **Tier history / analytics** -- no tracking of tier accuracy over time (was the recommendation correct?). Future enhancement.

---

## 7. Sync Points

### SP-001: Analyze Handler Step 8

After `"Analysis complete. {slug} is ready to build."`, append the tier recommendation line (FR-004). This is a 2-line addition to the analyze handler.

### SP-002: Build Handler Step 4a

Between step 4 (read meta.json) and the existing step 4a (computeStartPhase), insert the tier menu presentation (FR-005). If trivial is selected, short-circuit to the trivial execution path (FR-006). Otherwise, fall through to the existing computeStartPhase / staleness / sizing flow.

### SP-003: Impact Analysis Output

After Phase 02 (impact analysis) completes in the analyze handler, compute the tier from impact analysis metrics and persist to meta.json. The tier computation function lives in `three-verb-utils.cjs`; the analyze handler calls it after Phase 02 writes impact-analysis.md.

### SP-004: Meta.json Schema

Add `recommended_tier` (string), `tier_used` (string), `tier_override` (object), and `last_trivial_change` (object) to the meta.json schema. All fields are optional for backward compatibility.

---

## 8. Files to Change

| File | Change Type | Description |
|------|-------------|-------------|
| `src/claude/hooks/lib/three-verb-utils.cjs` | Modify | Add `computeRecommendedTier()`, `getTierDescription()` functions |
| `src/claude/commands/isdlc.md` (analyze handler) | Modify | After Phase 02: compute tier, persist to meta.json; Step 8: display recommended tier |
| `src/claude/commands/isdlc.md` (build handler) | Modify | New step 4a-tier: tier menu, trivial execution path |
| `src/claude/hooks/config/workflows.json` | Modify | Add `tier_thresholds` configuration block |
| `src/claude/hooks/tests/test-three-verb-utils.test.cjs` | Modify | Add tier scoring tests (15-20 new test cases) |

---

## 9. User Stories

### US-001
**As a** developer, **I want** the framework to recommend a workflow tier based on the quick scan, **so that** I spend the right amount of process overhead for the size of the change.

### US-002
**As a** developer, **I want** a trivial tier that makes the edit directly without branches or gates, **so that** I don't bypass the framework for small changes and still have an audit trail.

### US-003
**As a** developer, **I want** to see the recommended tier when analysis completes, **so that** I know what to expect when I run build.

### US-004
**As a** developer, **I want** to override the recommended tier, **so that** I can use my judgment when the framework's estimate doesn't match reality.

### US-005
**As a** developer, **I want** trivial changes recorded in a change-record.md, **so that** I can trace what was changed and why even without full workflow artifacts.

### US-006
**As a** developer, **I want** existing meta.json files to keep working without migration, **so that** upgrading the framework doesn't break in-progress work.

---

## 10. Metrics Summary

- **9** Functional Requirements (FR-001 through FR-009)
- **5** Non-Functional Requirements (NFR-001 through NFR-005)
- **6** User Stories (US-001 through US-006)
- **5** Constraints (CON-001 through CON-005)
- **3** Assumptions (ASM-001 through ASM-003)
- **33** Acceptance Criteria (26 functional + 7 non-functional)
- **4** Sync Points (SP-001 through SP-004)
- **Scope Classification**: LARGE

---

## Phase Gate Validation (GATE-01 -- Analysis Mode)

- [x] All functional requirements documented with unique IDs (FR-001 through FR-009)
- [x] All non-functional requirements documented with measurable metrics (NFR-001 through NFR-005)
- [x] All requirements have acceptance criteria in Given/When/Then format
- [x] Constraints documented (CON-001 through CON-005)
- [x] Assumptions documented (ASM-001 through ASM-003)
- [x] Out of scope items listed
- [x] User stories cover all functional requirements
- [x] Sync points with existing codebase identified
- [x] Files to change identified
- [x] Backward compatibility addressed (NFR-002)
- [x] No ambiguous requirements (all thresholds, formats, and behaviors specified)

---

*Requirements specification completed in ANALYSIS MODE -- no state.json writes, no branches created.*
