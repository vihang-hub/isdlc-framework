# Requirements Specification — REQ-0011: Adaptive Workflow Sizing

**Version**: 1.0.0
**Created**: 2026-02-12
**Status**: Approved
**Workflow**: feature
**Constitution**: docs/isdlc/constitution.md (14 articles)

---

## 1. Overview

The iSDLC framework currently runs the same heavyweight 9-phase process for all features regardless of scope. Architecture (Phase 03) and Design (Phase 04) produce 16+ artifacts (~1-2 hours) even for trivial changes affecting 1-5 files. Conversely, massive features (20+ files) get crammed into a single implementation phase with no decomposition.

Adaptive Workflow Sizing introduces a sizing decision point after Impact Analysis (Phase 02) where real data exists — affected files, entry points, risk assessment, blast radius — to recommend one of three workflow intensities: light, standard, or epic.

## 2. Functional Requirements

### REQ-0011-FR-01: Sizing Decision Point After Impact Analysis

After Phase 02 (Impact Analysis) completes and GATE-02 passes, the framework MUST analyze Impact Analysis outputs and generate a sizing recommendation before advancing to the next phase.

**Acceptance Criteria:**
- **AC-01**: Sizing logic reads `impact-analysis.md` for: file count, module count, risk score, coupling assessment, test coverage gaps
- **AC-02**: Sizing runs AFTER GATE-02 passes, BEFORE Phase 03 delegation
- **AC-03**: Sizing recommendation is deterministic given the same Impact Analysis inputs

### REQ-0011-FR-02: Three Workflow Intensities

The framework MUST support three workflow intensities based on sizing analysis.

- **light**: Small scope (1-5 affected files, low risk). Skips Phase 03 (Architecture) and Phase 04 (Design). Workflow proceeds: `00 -> 01 -> 02 -> 05 -> 06 -> 16 -> 08`.
- **standard**: Medium scope (6-20 affected files). Current full workflow, no changes: `00 -> 01 -> 02 -> 03 -> 04 -> 05 -> 06 -> 16 -> 08`.
- **epic** (future): Large scope (20+ affected files OR high risk). Decompose into sub-features, each with its own mini-cycle, with integration testing across all sub-features at the end.

**Acceptance Criteria:**
- **AC-04**: Light workflow skips phases `03-architecture` and `04-design` from `active_workflow.phases`
- **AC-05**: Standard workflow preserves all 9 current feature phases unchanged
- **AC-06**: Epic workflow decomposes into sub-features with independent mini-cycles (FUTURE — not in scope for initial delivery)
- **AC-07**: Intensity thresholds are configurable (default: light <= 5 files, standard 6-20, epic > 20)

### REQ-0011-FR-03: Sizing Recommendation UX

After Impact Analysis, the framework MUST present the sizing recommendation to the user with rationale and allow accept/override.

**Acceptance Criteria:**
- **AC-08**: Recommendation includes: intensity name, file count, module count, risk level, rationale
- **AC-09**: User menu: `[A] Accept recommendation` / `[O] Override (choose intensity)` / `[S] Show full analysis`
- **AC-10**: If user overrides, they choose from the available intensities (light, standard, epic)
- **AC-11**: The chosen intensity is recorded in `active_workflow.sizing` in state.json

### REQ-0011-FR-04: `-light` Flag for Force-Lightweight

Users MUST be able to force lightweight workflow via `/isdlc feature -light "description"`.

**Acceptance Criteria:**
- **AC-12**: `-light` flag on `/isdlc feature` bypasses the sizing recommendation and forces light intensity
- **AC-13**: When `-light` is used, Impact Analysis still runs (for blast radius coverage) but sizing recommendation is skipped
- **AC-14**: `-light` is the ONLY new flag — no `-epic` or `-standard` flags (epic is framework-recommended only)

### REQ-0011-FR-05: Phase Array Modification After Sizing

When sizing determines light intensity, the framework MUST modify `active_workflow.phases` to remove skipped phases.

**Acceptance Criteria:**
- **AC-15**: Light intensity removes `03-architecture` and `04-design` from `active_workflow.phases` array
- **AC-16**: `active_workflow.phase_status` is updated to remove entries for skipped phases
- **AC-17**: `phases` object in state.json is pruned to match
- **AC-18**: `current_phase_index` is recalculated to point to the correct next phase (`05-test-strategy`)

### REQ-0011-FR-06: Epic Decomposition — FUTURE

> **Status**: Stretch goal / future work. Depends on adaptive workflow sizing infrastructure (FR-01 through FR-05). Tracked separately in BACKLOG.md.

When sizing determines epic intensity, the framework MUST decompose the feature into sub-features.

**Acceptance Criteria:**
- **AC-19**: Requirements Analyst (Agent 01) re-enters to break the feature into sub-features with clear boundaries
- **AC-20**: Each sub-feature gets an independent mini-cycle: design -> implement -> test -> gate
- **AC-21**: Integration testing runs across all sub-features after individual gates pass
- **AC-22**: `state.json` tracks parent feature + sub-features with individual phase progress
- **AC-23**: Sub-features share the parent's git branch (no branch-per-sub-feature)

### REQ-0011-FR-07: Sizing State Tracking

The framework MUST record sizing decisions in state.json for observability.

**Acceptance Criteria:**
- **AC-24**: `active_workflow.sizing` object includes: `{ intensity, file_count, module_count, risk_score, coupling, coverage_gaps, recommended_by, overridden, overridden_to, decided_at }`
- **AC-25**: Sizing data persists to `workflow_history` on workflow completion

## 3. Non-Functional Requirements

### REQ-0011-NFR-01: Performance

Sizing analysis MUST complete within 5 seconds (reading and analyzing impact-analysis.md). No external API calls.

### REQ-0011-NFR-02: Backward Compatibility

Existing workflows that do not trigger sizing (fix, test-run, test-generate, upgrade) MUST be unaffected. Feature workflows without `-light` flag MUST default to the sizing recommendation flow.

### REQ-0011-NFR-03: No New Dependencies

Sizing logic MUST NOT introduce new npm dependencies. All parsing and analysis uses Node.js built-ins.

### REQ-0011-NFR-04: Constitutional Compliance

All changes MUST comply with the project constitution (docs/isdlc/constitution.md), specifically:
- Article I: Specifications serve as source of truth (sizing thresholds documented)
- Article IV: No unresolved ambiguities in sizing logic
- Article V: Simplicity (no over-engineering the sizing algorithm)
- Article VII: Artifact traceability (sizing decision linked to Impact Analysis)
- Article IX: Gate integrity (sizing does not bypass gates)

## 4. Scope Boundaries

### In Scope (Initial Delivery)
- FR-01: Sizing decision point after Impact Analysis
- FR-02: Light and standard intensities (epic = recommendation only, no execution)
- FR-03: Sizing recommendation UX
- FR-04: `-light` flag
- FR-05: Phase array modification for light intensity
- FR-07: Sizing state tracking

### Out of Scope (Future)
- FR-06: Epic decomposition execution (sub-feature mini-cycles, state tracking)
- Sizing for non-feature workflows (fix, upgrade, test)
- Custom intensity definitions beyond light/standard/epic

## 5. Dependencies

- **Impact Analysis (Phase 02)**: Must produce `impact-analysis.md` with file count, module count, risk score, coupling assessment, test coverage gaps
- **Phase-Loop Controller (isdlc.md)**: Must support post-gate sizing hook between GATE-02 and Phase 03 delegation
- **workflows.json**: Must support dynamic phase array modification at runtime
- **Blast Radius Validator (REQ-0010)**: Existing hook validates coverage — unaffected by sizing

## 6. Affected Components

| Component | Change Type | Description |
|-----------|-------------|-------------|
| `src/claude/commands/isdlc.md` | Modify | Add sizing decision point after GATE-02, `-light` flag parsing |
| `.isdlc/config/workflows.json` | Modify | Add `sizing` configuration block to feature workflow |
| `src/claude/agents/00-sdlc-orchestrator.md` | Modify | Add sizing logic to orchestrator for `init-and-phase-01` mode |
| `src/claude/hooks/common.cjs` | Modify | Add `applySizingDecision()` helper for phase array modification |
| Impact Analysis outputs | Read-only | Parse existing `impact-analysis.md` format |
| `.isdlc/state.json` | Modify | Add `sizing` object to `active_workflow` |

## 7. Traceability

| Requirement | Source | Priority |
|-------------|--------|----------|
| FR-01 | BACKLOG.md line 56 | P0 — Core |
| FR-02 | BACKLOG.md lines 57-60 | P0 — Core |
| FR-03 | BACKLOG.md lines 61-63 | P0 — Core |
| FR-04 | BACKLOG.md line 58 | P1 — Important |
| FR-05 | Derived from FR-02 | P0 — Core |
| FR-06 | BACKLOG.md lines 66-77 | P2 — Future |
| FR-07 | BACKLOG.md line 64 | P1 — Important |
