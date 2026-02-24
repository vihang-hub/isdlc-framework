# Requirements Specification: Three-Verb Backlog Model

**ID:** REQ-0023
**Feature:** Three-verb backlog model (add/analyze/build) — unify backlog management around three natural verbs, eliminate Phase A/B naming, redesign command surface and intent detection
**External Reference:** GitHub #19
**Version:** 1.0.0
**Status:** Draft
**Created:** 2026-02-18
**Author:** Requirements Analyst (Agent 01)

---

## 1. Project Overview

### 1.1 Problem Statement

The iSDLC framework currently has overlapping entry points for managing development work items:

1. **`/isdlc feature "<desc>"`** -- starts a full feature workflow from Phase 00
2. **`/isdlc analyze "<desc>"`** -- runs "Phase A" preparation pipeline outside workflow machinery (intake + optional deep analysis), writes to `docs/requirements/{slug}/`
3. **`/isdlc start "<slug>"`** -- consumes Phase A artifacts and starts "Phase B" execution from Phase 02
4. **Backlog picker** -- appears when `/isdlc feature` or `/isdlc fix` is invoked without a description, presents BACKLOG.md items as a menu
5. **`/isdlc fix "<desc>"`** -- starts a bug fix workflow

Users do not know which command to use when. "Phase A" and "Phase B" are internal naming conventions that leak into the user experience. The handoff between Phase A artifacts (`meta.json`, `draft.md`, `requirements.md`) and Phase B consumption has multiple failure modes (BUG-0028: Phase B re-runs Phases 00/01 instead of skipping; BUG-0022: Phase A skips interactive elicitation; BUG-0024: Phase A BACKLOG.md append not implemented).

### 1.2 Business Drivers

- **Simplicity**: Three verbs (add, analyze, build) are universally understood; no framework jargon
- **Natural language alignment**: Users already say "add this to the backlog", "let's analyze this", "let's build this" -- the framework should match their vocabulary
- **Reduced friction**: One mental model instead of five overlapping commands
- **Bug resolution**: Subsumes 6 existing bugs/issues (8.1, 11.2/BUG-0022, 12.2/BUG-0024, 12.3, 12.4, 14.2/BUG-0028)
- **Foundation for future work**: Items 16.2 (roundtable agent), 16.3 (elaboration mode), 16.4 (transparent critic/refiner), 16.5 (build auto-detection) all depend on this command surface

### 1.3 Success Metrics

- Users can add an item to the backlog using natural language in under 30 seconds
- Users can analyze a backlog item interactively using the existing Phase 01-04 agents
- Users can build a backlog item with automatic analysis-level detection
- Zero `/isdlc analyze` or `/isdlc start` references remain in codebase
- Zero "Phase A" / "Phase B" terminology remains in codebase
- All existing tests pass after implementation (zero regressions)
- BACKLOG.md shows analysis status markers for each item

### 1.4 Scope

**In scope:**
- New command verbs: `add`, `analyze`, `build` (replacing `analyze`, `start`, feature-no-args backlog picker)
- Intent detection rewrite in `CLAUDE.md` to map natural language to three verbs
- Command surface redesign in `isdlc.md` (remove SCENARIO 5, Phase A/B pipeline, `/isdlc start`)
- Orchestrator simplification in `00-sdlc-orchestrator.md` (remove BACKLOG PICKER section)
- Hook updates in `skill-delegation-enforcer.cjs` (update EXEMPT_ACTIONS)
- BACKLOG.md analysis status markers: `[ ]` raw, `[~]` partially analyzed, `[A]` fully analyzed, `[x]` completed
- `meta.json` schema update to replace `phase_a_completed` with per-phase completion tracking
- CLAUDE.md.template updates for new installs

**Out of scope (this release):**
- Roundtable analysis agent with named personas (item 16.2 -- depends on this)
- Elaboration mode (item 16.3 -- depends on 16.2)
- Transparent Critic/Refiner at step boundaries (item 16.4 -- depends on 16.2)
- Build auto-detection of analysis level (item 16.5 -- depends on this; this REQ provides the `build` verb but not the smart phase detection)
- Jira MCP integration for pulling ticket content (item 12.1/BUG-0023 -- separate issue)
- BACKLOG.md completion marking automation (item 12.5/BUG-0025 -- separate issue)

---

## 2. Stakeholders and Personas

### Persona 1: Framework User (Primary)

- **Role**: Developer using iSDLC to manage their project workflow
- **Goals**: Interact with the framework naturally without memorizing internal commands
- **Pain points**: Confused by feature/analyze/start distinction; "Phase A/B" means nothing to them
- **Technical proficiency**: Intermediate to advanced; CLI-comfortable
- **Key tasks**: Add items to backlog, analyze them interactively, build when ready

### Persona 2: Framework Maintainer (Secondary)

- **Role**: Developer maintaining/extending the iSDLC framework (dogfooding)
- **Goals**: Clean internal architecture; no overlapping code paths; clear separation between verbs
- **Pain points**: Phase A/B code paths are hard to maintain and test; multiple entry points for similar behavior
- **Technical proficiency**: Expert
- **Key tasks**: Update agent prompts, maintain hooks, update tests

---

## 3. Functional Requirements

### FR-001: Add Verb — Backlog Item Intake

**Description**: The `add` verb creates a raw backlog item from a user description, external ticket reference (Jira, GitHub), or manual description. It writes a BACKLOG.md entry and optionally creates a `docs/requirements/{slug}/draft.md` with source metadata.

**Trigger**: User says "add this to the backlog", "add #42", "add Jira-1250 to backlog", or invokes `/isdlc add "<description>"`.

**Happy Path**:
1. Parse the input to identify source type:
   - External reference (Jira ticket ID, GitHub issue number): Attempt to pull content via available MCP tools. If MCP unavailable, accept the reference as metadata only.
   - Manual description: Use provided text as-is.
2. Generate a slug from the description (lowercase, hyphens, max 50 chars).
3. Determine next ID number: Read `.isdlc/state.json` -> `counters.next_req_id` (read-only, do NOT increment -- counter is incremented when a workflow starts, not at add time).
4. Create `docs/requirements/{slug}/draft.md` with raw content and source metadata.
5. Create `docs/requirements/{slug}/meta.json` with fields:
   ```json
   {
     "source": "jira" | "github" | "manual",
     "source_id": "<ticket-id-or-null>",
     "slug": "<slug>",
     "created_at": "<ISO-8601>",
     "analysis_status": "raw",
     "phases_completed": [],
     "codebase_hash": "<git-HEAD-short-SHA>"
   }
   ```
6. Append item to BACKLOG.md `## Open` section with `[ ]` (raw) status marker.
7. Confirm to user with item details and next steps ("You can analyze this now or come back later").

**Error Scenarios**:
- Slug already exists in `docs/requirements/`: Warn user, offer to overwrite or choose different name.
- BACKLOG.md does not exist: Create it with standard `## Open` / `## Completed` sections.
- External reference MCP unavailable: Fall back to manual description with reference stored as metadata.

**Acceptance Criteria**:
- AC-001-01: Given a manual description "Add payment processing", when the user invokes `add`, then `docs/requirements/add-payment-processing/draft.md` is created with the description text.
- AC-001-02: Given a manual description, when `add` completes, then `meta.json` is created with `"source": "manual"`, `"analysis_status": "raw"`, and `"phases_completed": []`.
- AC-001-03: Given an external reference "#42", when `add` completes, then `meta.json.source_id` contains "GH-42" and `meta.json.source` is "github".
- AC-001-04: When `add` completes, BACKLOG.md `## Open` section contains a new `[ ]` item with the description.
- AC-001-05: The `add` verb does NOT write to `.isdlc/state.json` (counters are read-only during add).
- AC-001-06: The `add` verb does NOT create a workflow or modify `active_workflow`.
- AC-001-07: If the slug directory already exists, the user is warned and offered overwrite/rename options.

**Priority**: Must Have

---

### FR-002: Analyze Verb — Interactive Analysis Pipeline

**Description**: The `analyze` verb runs interactive analysis on a backlog item, using existing Phase 00-04 agents (quick scan, requirements, impact analysis, architecture, design). It operates outside workflow machinery (no `active_workflow`, no branch creation, no hooks enforcement) but writes artifacts to `docs/requirements/{slug}/`.

**Trigger**: User says "analyze #42", "let's think through this", "analyze payment processing", or invokes `/isdlc analyze "<item>"`.

**Happy Path**:
1. Resolve the target item:
   - By BACKLOG.md item number (e.g., "3.2")
   - By slug (e.g., "payment-processing")
   - By external ID (e.g., "#42", "Jira-1250")
   - By description match (fuzzy match against BACKLOG.md titles)
2. If item has no `docs/requirements/{slug}/` folder, run `add` implicitly first (FR-001).
3. Read `meta.json` to determine current analysis status.
4. Execute analysis phases sequentially, starting from where the item left off:
   - Phase 00 (Quick Scan): Lightweight scope estimation -> `quick-scan.md`
   - Phase 01 (Requirements): Interactive requirements capture with A/R/C menu -> `requirements-spec.md`, `user-stories.json`, `nfr-matrix.md`
   - Phase 02 (Impact Analysis): Codebase impact assessment -> `impact-analysis.md`
   - Phase 03 (Architecture): Architecture decisions -> `architecture-overview.md`
   - Phase 04 (Design): Module and interface design -> `interface-spec.yaml`, `module-designs/`
5. After each phase completes:
   - Append phase key to `meta.json.phases_completed[]`
   - Update `meta.json.analysis_status`:
     - 0 phases done = `"raw"`
     - 1-3 phases done = `"partial"`
     - All 5 phases done (00 through 04) = `"analyzed"`
   - Update BACKLOG.md item marker: `[ ]` -> `[~]` (partial) or `[A]` (fully analyzed)
6. User can exit at any point between phases. Analysis is resumable.

**Constraints**:
- Analyze does NOT create a workflow (`active_workflow` remains null).
- Analyze does NOT create a git branch.
- Analyze does NOT modify `.isdlc/state.json` except for `meta.json` reads.
- Analyze MAY run in parallel with an active build workflow (they share zero resources).
- Each analysis phase delegates to the standard phase agent (same agents used in feature workflow).

**Error Scenarios**:
- Item not found: Suggest running `add` first; offer to create on the fly.
- Analysis already complete (`analysis_status == "analyzed"`): Inform user, offer re-analysis with staleness check.
- Codebase hash mismatch (code changed since last analysis): Warn user, offer refresh or continue.

**Acceptance Criteria**:
- AC-002-01: Given a raw backlog item, when the user invokes `analyze`, then Phases 00-04 are executed interactively in sequence.
- AC-002-02: After Phase 01 completes, `meta.json.phases_completed` includes `"01-requirements"` and `analysis_status` is `"partial"`.
- AC-002-03: After all 5 phases complete, `meta.json.analysis_status` is `"analyzed"` and BACKLOG.md shows `[A]`.
- AC-002-04: If the user exits after Phase 02, analysis is resumable -- invoking `analyze` again starts from Phase 03.
- AC-002-05: Analyze does NOT create a workflow, branch, or modify `active_workflow` in state.json.
- AC-002-06: Analyze does NOT require an active workflow to run.
- AC-002-07: Artifacts are written to `docs/requirements/{slug}/` (same location as the existing pattern).
- AC-002-08: If `docs/requirements/{slug}/` does not exist, the `add` flow runs implicitly before analysis begins.
- AC-002-09: When codebase hash in `meta.json` differs from current `git rev-parse --short HEAD`, the user receives a staleness warning.

**Priority**: Must Have

---

### FR-003: Build Verb — Execution Workflow

**Description**: The `build` verb starts a feature or fix workflow, auto-detecting the item's analysis level to determine the starting phase. For this REQ (16.1), build always starts from Phase 00 (full workflow). The smart phase detection based on analysis level is deferred to item 16.5.

**Trigger**: User says "build #42", "let's implement this", "build payment processing", or invokes `/isdlc build "<item>"`.

**Happy Path**:
1. Resolve the target item (same resolution as FR-002).
2. Read `meta.json` to check analysis status.
3. For this release: Always start a full feature workflow (Phases 00-08), regardless of analysis status.
   - Future (16.5): If fully analyzed, skip to Phase 05; if partially analyzed, resume from last incomplete phase.
4. Initialize `active_workflow` in state.json with the feature workflow phases.
5. Create the feature branch `feature/REQ-NNNN-{slug}`.
6. Increment `counters.next_req_id` in state.json.
7. Begin Phase 00 (Quick Scan) and proceed through the standard feature workflow.

**For fix workflows**: If the item is identified as a bug (by description keywords or explicit user statement), use the fix workflow instead.

**Error Scenarios**:
- Active workflow exists: Inform user, suggest `/isdlc cancel` or continue existing workflow.
- Item not found: Offer to run `add` first, then `build`.

**Acceptance Criteria**:
- AC-003-01: Given a backlog item, when the user invokes `build`, a feature workflow is initialized with `active_workflow` in state.json.
- AC-003-02: The feature branch is created with the format `feature/REQ-NNNN-{slug}`.
- AC-003-03: `counters.next_req_id` is incremented after workflow initialization.
- AC-003-04: If no matching item exists, the user is offered to `add` it first.
- AC-003-05: If an active workflow already exists, the build is blocked with a clear message.
- AC-003-06: The `build` verb maps to the existing feature workflow phases array from `workflows.json`.
- AC-003-07: For fix-type items (bug keywords in description), the fix workflow is used instead.

**Priority**: Must Have

---

### FR-004: Intent Detection Rewrite

**Description**: The intent detection table in `CLAUDE.md` must be rewritten to map natural language to the three verbs (add, analyze, build) instead of the current feature/fix/analyze/start split.

**Current State** (to be replaced):
```
| Feature | add, build, implement, create, new feature, refactor | /isdlc feature |
| Fix     | broken, fix, bug, crash, error, wrong, failing       | /isdlc fix     |
```

**New State**:
```
| Add     | add to backlog, track this, log this, remember this  | /isdlc add     |
| Analyze | analyze, think through, review requirements, plan     | /isdlc analyze |
| Build   | build, implement, create, code, develop, ship         | /isdlc build   |
| Fix     | broken, fix, bug, crash, error, wrong, failing        | /isdlc fix     |
```

**Key Design Decision**: `Fix` remains a separate intent because bug fixes have a distinct workflow (with tracing instead of impact analysis). The `build` verb is for feature-type work.

**Acceptance Criteria**:
- AC-004-01: `CLAUDE.md` intent detection table includes Add, Analyze, Build, and Fix intents.
- AC-004-02: Signal words for Add include: "add to backlog", "track this", "log this", "remember this", "save this idea".
- AC-004-03: Signal words for Analyze include: "analyze", "think through", "plan this", "review requirements", "assess impact", "design this".
- AC-004-04: Signal words for Build include: "build", "implement", "create", "code", "develop", "ship", "make this", "let's do this".
- AC-004-05: Signal words for Fix remain unchanged from current behavior.
- AC-004-06: The `CLAUDE.md.template` mirrors the same intent detection changes for new installs.
- AC-004-07: Discovery, Upgrade, Test run, Test generate, and Skill management intents remain unchanged.
- AC-004-08: Ambiguous cases between Add and Analyze (e.g., "add and analyze this") resolve to Analyze (which implicitly runs Add first per FR-002 AC-002-08).

**Priority**: Must Have

---

### FR-005: Command Surface Redesign (isdlc.md)

**Description**: The `isdlc.md` command file must be redesigned to replace Phase A/Phase B pipeline with the three-verb model.

**Changes Required**:
1. **Remove SCENARIO 5** (Phase A Preparation Pipeline) entirely.
2. **Remove `/isdlc analyze`** command definition (the old Phase A version).
3. **Remove `/isdlc start`** command definition (the old Phase B consumer).
4. **Add `/isdlc add`** command definition with intake flow.
5. **Add `/isdlc analyze`** command definition with new semantics (interactive analysis pipeline, NOT the old Phase A).
6. **Add `/isdlc build`** command definition with workflow initialization.
7. **Update ACTION routing** in the Phase-Loop Controller to handle `add`, `analyze`, `build` actions.
8. **Remove Phase A/B references** from all comments, documentation blocks, and design notes.
9. **Update QUICK REFERENCE** table to show new commands.
10. **Remove `meta.json.phase_a_completed`** references; use new `meta.json.analysis_status` field.

**Acceptance Criteria**:
- AC-005-01: Zero occurrences of "Phase A" or "Phase B" in `isdlc.md` after changes.
- AC-005-02: `/isdlc add` is a documented command with clear specification.
- AC-005-03: `/isdlc analyze` has new semantics (interactive analysis, not old Phase A pipeline).
- AC-005-04: `/isdlc build` is a documented command that initializes a feature workflow.
- AC-005-05: `/isdlc start` is removed (no longer a valid action).
- AC-005-06: The Phase-Loop Controller routes `add` and `analyze` actions inline (no orchestrator needed) and routes `build` through the standard orchestrator/phase-loop flow.
- AC-005-07: All `meta.json` references use `analysis_status` instead of `phase_a_completed`.
- AC-005-08: The QUICK REFERENCE table reflects the new command set.

**Priority**: Must Have

---

### FR-006: Orchestrator Simplification (00-sdlc-orchestrator.md)

**Description**: The SDLC Orchestrator agent file must be simplified to remove the BACKLOG PICKER section and update the no-argument menus.

**Changes Required**:
1. **Remove the BACKLOG PICKER section** entirely (feature mode sources, fix mode sources, Jira metadata parsing, workflow init with Jira context, presentation rules).
2. **Update SCENARIO 3** (no active workflow menu): Replace "New Feature" and "Fix" options with "Add to Backlog", "Analyze", and "Build" options.
3. **Update COMMANDS YOU SUPPORT** section: Replace `/isdlc feature` and `/isdlc fix` with `/isdlc add`, `/isdlc analyze`, `/isdlc build`.
4. **Keep `/isdlc fix`** as a separate command (fix workflow has distinct phases).
5. **Remove Jira metadata parsing** from the backlog picker (Jira integration will be handled by `add` verb in a future item).

**Acceptance Criteria**:
- AC-006-01: Zero occurrences of "BACKLOG PICKER" in `00-sdlc-orchestrator.md`.
- AC-006-02: SCENARIO 3 menu includes Add, Analyze, Build, and Fix options.
- AC-006-03: COMMANDS YOU SUPPORT includes `/isdlc add`, `/isdlc analyze`, `/isdlc build`.
- AC-006-04: `/isdlc fix` remains as a separate command for bug fix workflows.
- AC-006-05: Jira metadata parsing removed from orchestrator (future: handled by `add` verb).

**Priority**: Must Have

---

### FR-007: BACKLOG.md Analysis Status Markers

**Description**: BACKLOG.md items must display analysis status using a 4-state marker system.

**Marker Definitions**:
- `[ ]` — Raw: Item has been added but not analyzed
- `[~]` — Partially analyzed: Some analysis phases completed (1-4 of 5)
- `[A]` — Fully analyzed: All analysis phases (00-04) complete, ready to build
- `[x]` — Completed: Workflow finished, item shipped

**Backward Compatibility**:
- Existing `[ ]` (unchecked) items are treated as "raw" (no change needed).
- Existing `[x]` (checked) items are treated as "completed" (no change needed).
- `[~]` and `[A]` are new markers; parsing must handle them alongside existing markers.
- The existing checkbox pattern `- N.N [ ] <text>` is preserved. Only the marker character changes.

**Acceptance Criteria**:
- AC-007-01: After `add`, the BACKLOG.md item shows `[ ]` marker.
- AC-007-02: After partial analysis (1-4 phases), the marker updates to `[~]`.
- AC-007-03: After full analysis (all 5 phases), the marker updates to `[A]`.
- AC-007-04: After workflow completion, the marker updates to `[x]`.
- AC-007-05: Existing `[ ]` and `[x]` items parse correctly without modification.
- AC-007-06: BACKLOG.md parsing regex handles all four marker types: `[ ]`, `[~]`, `[A]`, `[x]`.

**Priority**: Must Have

---

### FR-008: Hook Updates

**Description**: Runtime hooks that reference Phase A must be updated.

**Changes Required**:
1. **`skill-delegation-enforcer.cjs`**: Update `EXEMPT_ACTIONS` from `new Set(['analyze'])` to `new Set(['add', 'analyze'])`. Both `add` and `analyze` run inline without orchestrator delegation.
2. **`delegation-gate.cjs`**: Review for Phase A references; update exempt action handling to match.
3. **`gate-blocker.cjs`**: Review for Phase A references; remove any Phase A-specific gate logic.
4. **`menu-halt-enforcer.cjs`**: Review for analyze/start action references; update to new verb set.

**Acceptance Criteria**:
- AC-008-01: `EXEMPT_ACTIONS` in `skill-delegation-enforcer.cjs` includes `'add'` and `'analyze'` (both run inline).
- AC-008-02: `build` is NOT in `EXEMPT_ACTIONS` (it goes through the standard orchestrator delegation).
- AC-008-03: Zero references to "Phase A" or "Phase B" in any hook file.
- AC-008-04: All existing hook tests pass after changes.

**Priority**: Must Have

---

### FR-009: meta.json Schema Update

**Description**: The `meta.json` schema must be updated to replace the boolean `phase_a_completed` field with a structured analysis tracking schema.

**Old Schema** (to be replaced):
```json
{
  "phase_a_completed": false
}
```

**New Schema**:
```json
{
  "analysis_status": "raw" | "partial" | "analyzed",
  "phases_completed": ["00-quick-scan", "01-requirements", ...]
}
```

**Migration**: Existing `meta.json` files with `phase_a_completed: true` should be treated as `analysis_status: "analyzed"` when read. Existing files with `phase_a_completed: false` should be treated as `analysis_status: "raw"`.

**Acceptance Criteria**:
- AC-009-01: New `meta.json` files use `analysis_status` and `phases_completed` fields.
- AC-009-02: `phase_a_completed` is not written by any code path.
- AC-009-03: Reading a legacy `meta.json` with `phase_a_completed: true` treats it as `analysis_status: "analyzed"`.
- AC-009-04: Reading a legacy `meta.json` with `phase_a_completed: false` (or missing) treats it as `analysis_status: "raw"`.
- AC-009-05: `phases_completed` is an array of phase key strings, maintained in execution order.

**Priority**: Must Have

---

## 4. Non-Functional Requirements

### NFR-001: Backward Compatibility

All existing tests must pass without modification to test assertions. New behavior must be additive; existing workflows (feature, fix, test-run, test-generate, upgrade) must continue to work exactly as before. The `build` verb is the new entry point for what `/isdlc feature` does today.

### NFR-002: Zero State Corruption

The `add` and `analyze` verbs must not write to `.isdlc/state.json` (except for read-only counter access). Only the `build` verb initializes `active_workflow`. This ensures add/analyze can run safely in parallel with an active build workflow.

### NFR-003: Resumable Analysis

Analysis must be resumable at any phase boundary. If the user exits after Phase 02, invoking `analyze` again must continue from Phase 03, not restart from Phase 00. This is achieved via `meta.json.phases_completed[]`.

### NFR-004: Performance

The `add` verb must complete in under 5 seconds (filesystem writes only, no AI analysis). The `analyze` verb phase transition overhead must be under 2 seconds between phases.

### NFR-005: Cross-Platform Compatibility

All file operations must use `path.join()`/`path.resolve()` per Article XII. BACKLOG.md parsing must handle both LF and CRLF line endings.

### NFR-006: Monorepo Support

In monorepo mode, all paths must be scoped per the monorepo path routing table. `add` writes to `docs/{project-id}/requirements/{slug}/`. `analyze` reads/writes from the same project-scoped path.

---

## 5. User Stories

### US-001: Add Item to Backlog (Manual)
**As a** developer, **I want to** add a feature idea to my backlog using natural language, **so that** I can capture ideas quickly without starting a full workflow.

**Acceptance Criteria**: AC-001-01, AC-001-02, AC-001-04, AC-001-05, AC-001-06

### US-002: Add Item from External Reference
**As a** developer, **I want to** add a Jira ticket or GitHub issue to my backlog by reference, **so that** the framework tracks the source and can pull content when MCP is available.

**Acceptance Criteria**: AC-001-03, AC-001-07

### US-003: Analyze a Backlog Item
**As a** developer, **I want to** analyze a backlog item interactively through requirements, impact analysis, architecture, and design, **so that** I have well-thought-out artifacts before I start building.

**Acceptance Criteria**: AC-002-01, AC-002-02, AC-002-03, AC-002-05, AC-002-06, AC-002-07

### US-004: Resume Partial Analysis
**As a** developer, **I want to** resume analysis of an item I started yesterday, **so that** I don't have to redo work I've already completed.

**Acceptance Criteria**: AC-002-04, AC-002-08

### US-005: Build a Feature
**As a** developer, **I want to** say "build this" to start implementing a backlog item, **so that** the framework handles workflow initialization, branching, and phase progression automatically.

**Acceptance Criteria**: AC-003-01, AC-003-02, AC-003-03, AC-003-06

### US-006: Natural Language Intent Detection
**As a** developer, **I want to** use natural language like "add this to the backlog" or "let's build this", **so that** I never need to remember slash commands.

**Acceptance Criteria**: AC-004-01 through AC-004-08

### US-007: View Analysis Status in Backlog
**As a** developer, **I want to** see which items are raw, partially analyzed, fully analyzed, or completed when viewing my backlog, **so that** I know what's ready to build.

**Acceptance Criteria**: AC-007-01 through AC-007-06

### US-008: Fix a Bug (Unchanged)
**As a** developer, **I want to** say "this is broken" or "fix this bug" to start a bug fix workflow, **so that** the fix workflow remains distinct from the feature workflow.

**Acceptance Criteria**: AC-004-05, AC-006-04

---

## 6. Traceability Matrix

| Requirement | User Stories | Acceptance Criteria | Phase | Article |
|-------------|-------------|---------------------|-------|---------|
| FR-001 (Add) | US-001, US-002 | AC-001-01 to AC-001-07 | 06-implementation | I, IV, VII |
| FR-002 (Analyze) | US-003, US-004 | AC-002-01 to AC-002-09 | 06-implementation | I, IV, V, VII |
| FR-003 (Build) | US-005 | AC-003-01 to AC-003-07 | 06-implementation | I, VII, IX |
| FR-004 (Intent) | US-006 | AC-004-01 to AC-004-08 | 06-implementation | I, VIII |
| FR-005 (isdlc.md) | US-005, US-006 | AC-005-01 to AC-005-08 | 06-implementation | I, VII, VIII |
| FR-006 (Orchestrator) | US-006 | AC-006-01 to AC-006-05 | 06-implementation | I, V, VIII |
| FR-007 (BACKLOG.md) | US-007 | AC-007-01 to AC-007-06 | 06-implementation | I, IV, VIII |
| FR-008 (Hooks) | US-005 | AC-008-01 to AC-008-04 | 06-implementation | IX, X, XIV |
| FR-009 (meta.json) | US-003, US-004 | AC-009-01 to AC-009-05 | 06-implementation | I, XIV |

---

## 7. Assumptions and Constraints

### Assumptions
1. Users have an initialized iSDLC project (constitution exists and is valid)
2. The three-verb model is sufficient for all current use cases (no edge cases requiring Phase A/B)
3. Existing `meta.json` files can be migrated via read-time conversion (no batch migration needed)
4. The `build` verb fully replaces `/isdlc feature` for natural language entry

### Constraints
1. `build` must produce identical workflow behavior to current `/isdlc feature` (same phases, same hooks, same gates)
2. `analyze` must remain outside workflow machinery (no state.json writes, no branches)
3. BACKLOG.md format must remain human-readable and editable
4. Hook changes must maintain fail-open behavior per Article X

---

## 8. Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Users have muscle memory for `/isdlc feature` | Medium | Low | Keep `/isdlc feature` as a hidden alias for `build` during transition |
| Existing Phase A artifacts may not migrate cleanly | Low | Medium | Read-time conversion with defensive defaults |
| Hook EXEMPT_ACTIONS update may miss edge cases | Low | High | Comprehensive hook test coverage |
| BACKLOG.md marker parsing may break on edge cases | Medium | Medium | Regex handles all 4 markers; test with real BACKLOG.md |
| `analyze` running outside workflow may confuse gate-blocker | Low | High | Gate-blocker only checks active_workflow; analyze has none |

---

## 9. Open Questions

None. All design decisions are resolved by the BACKLOG.md item 16.1 description and GH issue #19.

---

## 10. Dependencies

### Upstream Dependencies
- None (this is a foundational redesign)

### Downstream Dependencies (blocked by this REQ)
- Item 16.2: Roundtable analysis agent (depends on `analyze` verb existing)
- Item 16.3: Elaboration mode (depends on 16.2)
- Item 16.4: Transparent Critic/Refiner (depends on 16.2)
- Item 16.5: Build auto-detection (depends on `build` verb existing)
