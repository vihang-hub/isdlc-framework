# Impact Analysis: Roundtable Analysis Agent with Named Personas

**Generated**: 2026-02-19
**Feature**: GH-20 -- Single roundtable agent with 3 named personas (Maya/Alex/Jordan) for interactive analysis during the analyze verb, with step-file architecture, adaptive depth, menu system, and session resumability.
**Based On**: Phase 01 Requirements (finalized requirements-spec.md)
**Phase**: 02-impact-analysis
**Artifact Folder**: gh-20-roundtable-analysis-agent-with-named-personas

---

## Scope Comparison

| Aspect | Original (Phase 00) | Clarified (Phase 01) |
|--------|---------------------|----------------------|
| Description | Single roundtable agent with multi-hat behavior | Single agent, 3 named personas, step-file architecture, adaptive depth, menu system, session resumability |
| Keywords | analyze, persona, debate, roundtable, step-files | analyze, persona, step-file, adaptive-depth, menu, meta.json, resumability, brief/standard/deep |
| Estimated Files | ~18-25 (quick-scan) | 27 new + 2 modified = 29 total |
| Scope Change | - | REFINED (clarified that no skills-manifest.json changes needed; persona definitions inline in agent file per CON-001; step files are file-based, not skill-manifest-based) |

---

## Executive Summary

This feature introduces a new roundtable-analyst agent that replaces direct phase-agent delegation during the analyze verb (phases 00-04). The blast radius is **LOW** because the feature is overwhelmingly additive: 26 new files are created, only 2 existing files are modified, and the modification to `isdlc.md` is a conditional branch (if roundtable agent exists, use it; otherwise fall back to existing behavior). The modification to `three-verb-utils.cjs` is also additive -- extending `readMetaJson()` and `writeMetaJson()` with two new optional fields (`steps_completed`, `depth_overrides`) that default gracefully when absent. Existing phase agents, the build verb, and all hooks remain untouched. The primary risk is in the `isdlc.md` modification (the most critical file in the framework) and ensuring the meta.json schema extension does not break the 184 existing tests for `three-verb-utils.cjs`.

**Blast Radius**: LOW (2 existing files modified, both with backward-compatible changes)
**Risk Level**: MEDIUM (isdlc.md is high-value target; step-file architecture is new pattern)
**Affected Files**: 29 (27 CREATE, 2 MODIFY)
**Affected Modules**: 4 (agents, skills/analysis-steps, commands, hooks/lib)

---

## Impact Analysis

### Files Affected

#### New Files (27 CREATE)

| # | File Path | Purpose | FR Trace |
|---|-----------|---------|----------|
| 1 | `src/claude/agents/roundtable-analyst.md` | Main agent: persona definitions, phase mapping, step execution engine, menu system, adaptive depth logic | FR-001, FR-002, FR-003, FR-006, FR-007, FR-008, FR-011 |
| 2 | `src/claude/skills/analysis-steps/00-quick-scan/01-scope-estimation.md` | Step: scope estimation | FR-004, FR-012 |
| 3 | `src/claude/skills/analysis-steps/00-quick-scan/02-keyword-search.md` | Step: keyword search | FR-004, FR-012 |
| 4 | `src/claude/skills/analysis-steps/00-quick-scan/03-file-count.md` | Step: file count estimation | FR-004, FR-012 |
| 5 | `src/claude/skills/analysis-steps/01-requirements/01-business-context.md` | Step: business context discovery | FR-004, FR-012 |
| 6 | `src/claude/skills/analysis-steps/01-requirements/02-user-needs.md` | Step: user needs discovery | FR-004, FR-012 |
| 7 | `src/claude/skills/analysis-steps/01-requirements/03-ux-journey.md` | Step: UX journey mapping | FR-004, FR-012 |
| 8 | `src/claude/skills/analysis-steps/01-requirements/04-technical-context.md` | Step: technical context | FR-004, FR-012 |
| 9 | `src/claude/skills/analysis-steps/01-requirements/05-quality-risk.md` | Step: quality and risk assessment | FR-004, FR-012 |
| 10 | `src/claude/skills/analysis-steps/01-requirements/06-feature-definition.md` | Step: core feature definition | FR-004, FR-012 |
| 11 | `src/claude/skills/analysis-steps/01-requirements/07-user-stories.md` | Step: user story writing | FR-004, FR-012 |
| 12 | `src/claude/skills/analysis-steps/01-requirements/08-prioritization.md` | Step: MoSCoW prioritization | FR-004, FR-012 |
| 13 | `src/claude/skills/analysis-steps/02-impact-analysis/01-blast-radius.md` | Step: blast radius assessment | FR-004, FR-012 |
| 14 | `src/claude/skills/analysis-steps/02-impact-analysis/02-entry-points.md` | Step: entry point identification | FR-004, FR-012 |
| 15 | `src/claude/skills/analysis-steps/02-impact-analysis/03-risk-zones.md` | Step: risk zone analysis | FR-004, FR-012 |
| 16 | `src/claude/skills/analysis-steps/02-impact-analysis/04-impact-summary.md` | Step: impact summary and review | FR-004, FR-012 |
| 17 | `src/claude/skills/analysis-steps/03-architecture/01-architecture-options.md` | Step: architecture options and tradeoffs | FR-004, FR-012 |
| 18 | `src/claude/skills/analysis-steps/03-architecture/02-technology-decisions.md` | Step: technology decisions | FR-004, FR-012 |
| 19 | `src/claude/skills/analysis-steps/03-architecture/03-integration-design.md` | Step: integration architecture | FR-004, FR-012 |
| 20 | `src/claude/skills/analysis-steps/03-architecture/04-architecture-review.md` | Step: architecture review | FR-004, FR-012 |
| 21 | `src/claude/skills/analysis-steps/04-design/01-module-design.md` | Step: module design and boundaries | FR-004, FR-012 |
| 22 | `src/claude/skills/analysis-steps/04-design/02-interface-contracts.md` | Step: interface contracts | FR-004, FR-012 |
| 23 | `src/claude/skills/analysis-steps/04-design/03-data-flow.md` | Step: data flow and state management | FR-004, FR-012 |
| 24 | `src/claude/skills/analysis-steps/04-design/04-error-handling.md` | Step: error handling and validation | FR-004, FR-012 |
| 25 | `src/claude/skills/analysis-steps/04-design/05-design-review.md` | Step: design review and approval | FR-004, FR-012 |
| 26 | `src/claude/hooks/tests/test-three-verb-utils-steps.test.cjs` | Tests for new meta.json fields (steps_completed, depth_overrides) | FR-005, NFR-005 |
| 27 | `.claude/agents/roundtable-analyst.md` | Runtime copy synced from src/claude (dogfooding convention) | -- |

**NOTE on persona directory**: The initial feature summary mentioned `src/claude/agents/personas/` as new files. Per CON-001 in the requirements spec, persona definitions MUST live within the single `roundtable-analyst.md` agent file, not as separate files. The personas directory is NOT needed.

**NOTE on skills-manifest.json**: Per Section 7 of the requirements spec ("Out of Scope"), analysis step files use a file-based architecture, not the skill manifest system. No new skill IDs are registered. The `skills-manifest.json` does NOT need modification.

#### Modified Files (2 MODIFY)

| # | File Path | Change Description | Lines Affected (est.) | Risk |
|---|-----------|-------------------|----------------------|------|
| 1 | `src/claude/commands/isdlc.md` | Add roundtable-agent routing in analyze verb step 7: check if `roundtable-analyst.md` exists, if so delegate to it instead of standard phase agent; pass step context in Task prompt | ~15-25 lines in step 7 | HIGH |
| 2 | `src/claude/hooks/lib/three-verb-utils.cjs` | Extend `readMetaJson()` to default `steps_completed: []` and `depth_overrides: {}`; extend `writeMetaJson()` to preserve these fields | ~10-15 lines | MEDIUM |

#### Unchanged Files (Explicitly NOT Modified)

| File | Reason |
|------|--------|
| `src/claude/agents/01-requirements-analyst.md` | Used by build workflow only (CON-002) |
| `src/claude/agents/02-solution-architect.md` | Used by build workflow only |
| `src/claude/agents/03-system-designer.md` | Used by build workflow only |
| `src/claude/agents/quick-scan/quick-scan-agent.md` | Used by build workflow only |
| `src/claude/agents/impact-analysis/impact-analysis-orchestrator.md` | Used by build workflow only |
| `src/claude/hooks/config/skills-manifest.json` | Step files bypass skill manifest (requirements Section 7) |
| `src/claude/hooks/config/iteration-requirements.json` | Roundtable runs in analyze mode (no workflow, no iterations) |
| `src/claude/hooks/skill-delegation-enforcer.cjs` | Analyze verb already in EXEMPT_ACTIONS set |
| `src/claude/agents/00-sdlc-orchestrator.md` | Not involved in analyze verb |
| `src/isdlc/config/workflows.json` | Analyze does not use workflow system |

### Module Coupling Analysis

```
                        ┌──────────────────────────────────┐
                        │     src/claude/commands/          │
                        │         isdlc.md                  │
                        │   (analyze verb handler, step 7)  │
                        └────────────┬─────────────────────┘
                                     │ delegates via Task tool
                                     │ (conditional: roundtable exists?)
                                     ▼
                   ┌─────────────────────────────────────────┐
                   │     src/claude/agents/                   │
                   │       roundtable-analyst.md              │
                   │   (persona definitions, step executor,   │
                   │    menu system, adaptive depth)          │
                   └──────┬──────────────┬───────────────────┘
                          │              │
              reads step  │              │ reads/writes
              files       │              │ meta.json
                          ▼              ▼
  ┌───────────────────────────────┐  ┌───────────────────────────┐
  │ src/claude/skills/            │  │ src/claude/hooks/lib/     │
  │   analysis-steps/             │  │   three-verb-utils.cjs    │
  │   {phase-key}/NN-step.md     │  │   (readMetaJson,          │
  │   (24 step files, read-only) │  │    writeMetaJson)          │
  └───────────────────────────────┘  └───────────────────────────┘
                                              │
                                              │ consumed by
                                              ▼
                                   ┌──────────────────────────┐
                                   │ Existing consumers       │
                                   │ (isdlc.md analyze/build, │
                                   │  00-sdlc-orchestrator)   │
                                   └──────────────────────────┘
```

**Coupling Assessment**: LOW

- The roundtable agent is a new node with no incoming dependencies from existing code (nothing calls it except the conditional in `isdlc.md` step 7).
- The step files are leaf nodes -- read by the roundtable agent only, not referenced by anything else.
- The `three-verb-utils.cjs` changes are additive defaults that existing consumers ignore (they never read `steps_completed` or `depth_overrides`).
- The `isdlc.md` change is a conditional branch -- existing path preserved when roundtable agent is absent (AC-009-04).

### Dependency Graph (Inward and Outward)

**Inward Dependencies** (what the new code depends on):
1. `roundtable-analyst.md` depends on: step files in `analysis-steps/`, `three-verb-utils.cjs` (via meta.json read/write pattern), artifact folder path conventions
2. Step files depend on: nothing external (self-contained markdown)
3. `isdlc.md` changes depend on: existence check for `roundtable-analyst.md` file

**Outward Dependencies** (what depends on the new/changed code):
1. Nothing depends on `roundtable-analyst.md` (new, leaf agent)
2. Nothing depends on step files (new, leaf content)
3. Everything that reads meta.json depends on `three-verb-utils.cjs` -- this is the critical path:
   - `isdlc.md` (analyze verb handler, build verb handler)
   - `00-sdlc-orchestrator.md` (build workflow init)
   - 184 existing tests in `test-three-verb-utils.test.cjs`

---

## Entry Points

### Implementation Entry Point Order (Recommended)

The recommended implementation order minimizes dependency issues by building foundations first:

| Order | File | Rationale |
|-------|------|-----------|
| 1 | `src/claude/hooks/lib/three-verb-utils.cjs` | Foundation: extend meta.json schema first so roundtable agent can use it. Additive-only change (new defaults). |
| 2 | `src/claude/hooks/tests/test-three-verb-utils-steps.test.cjs` | Validate: confirm new fields work and existing 184 tests still pass. |
| 3 | `src/claude/skills/analysis-steps/` (all 24 step files) | Content: create step file directory structure and all 24 step files. These are self-contained and can be written in bulk. |
| 4 | `src/claude/agents/roundtable-analyst.md` | Core: the main agent file, depends on step files existing and meta.json schema being ready. |
| 5 | `src/claude/commands/isdlc.md` | Integration: wire the roundtable agent into the analyze verb. This is the last step because it activates the feature. |
| 6 | `.claude/agents/roundtable-analyst.md` | Sync: copy from src/claude for dogfooding runtime. |

### Integration Chain

```
User runs: /isdlc analyze "my-feature"
  └─> isdlc.md analyze handler
       └─> Step 7: Check if roundtable-analyst.md exists
            ├─ YES: Delegate to roundtable-analyst via Task tool
            │   └─> roundtable-analyst.md receives phase key + meta.json
            │        └─> Loads step files from analysis-steps/{phase-key}/
            │             └─> Executes steps sequentially
            │                  └─> After each step: update meta.json (steps_completed)
            │                       └─> Present menu: [E] / [C] / natural input
            │                            └─> Returns to isdlc.md handler
            │                                 └─> isdlc.md updates phases_completed
            └─ NO: Delegate to standard phase agent (existing behavior)
```

### API Surface Changes

**No new API endpoints.** All changes are within the CLI/agent system.

**meta.json schema extension** (backward-compatible):
```json
{
  "analysis_status": "partial",
  "phases_completed": ["00-quick-scan"],
  "steps_completed": ["00-01", "00-02", "00-03"],
  "depth_overrides": { "01-requirements": "brief" },
  "codebase_hash": "abc1234",
  "source": "github",
  "source_id": "GH-20",
  "created_at": "2026-02-19T00:00:00.000Z"
}
```

New fields `steps_completed` and `depth_overrides` are optional. When absent, `readMetaJson()` defaults them to `[]` and `{}` respectively. Existing consumers that do not read these fields are unaffected.

---

## Risk Assessment

### Risk Matrix

| ID | Risk | Severity | Likelihood | Mitigation |
|----|------|----------|------------|------------|
| R1 | `isdlc.md` modification introduces regression in analyze/build verb | HIGH | LOW | Conditional branch with fallback; test manually with roundtable agent absent |
| R2 | `three-verb-utils.cjs` schema change breaks existing 184 tests | HIGH | LOW | Changes are additive defaults only; run full test suite after change |
| R3 | Step file YAML frontmatter parsing errors at runtime | MEDIUM | MEDIUM | Define strict schema; validate frontmatter in roundtable agent before execution |
| R4 | Persona context bleed between phases (BA style leaking into Architect phase) | MEDIUM | MEDIUM | Clear persona state at phase boundaries; explicit persona activation in step headers |
| R5 | meta.json `steps_completed` grows unbounded for large analyses | LOW | LOW | 24 steps max in current design; no mitigation needed |
| R6 | Step files discovered out of order on some file systems | LOW | MEDIUM | Numeric prefix sort; explicit step_id ordering in frontmatter |
| R7 | `.claude/` sync forgotten during dogfooding | LOW | HIGH | Add to sync checklist; reminder in implementation notes |
| R8 | Agent count documentation becomes stale (README says 59 agents, will become 60) | LOW | HIGH | Update README.md agent count references during implementation |
| R9 | Adaptive depth selection logic edge cases (no quick-scan output, conflicting signals) | MEDIUM | LOW | Default to "standard" when ambiguous (AC-006-07) |
| R10 | `isdlc.md` file is 1717 lines; modification risks merge conflicts with parallel work | MEDIUM | MEDIUM | Keep change localized to step 7 area (lines 587-596); minimize diff surface |

### Test Coverage Gaps

| File | Current Coverage | Gap |
|------|-----------------|-----|
| `src/claude/hooks/lib/three-verb-utils.cjs` | 184 tests, 100% pass | No tests for `steps_completed` or `depth_overrides` fields yet |
| `src/claude/commands/isdlc.md` | Manual testing only (markdown agent file, not unit-testable) | No automated tests possible for agent markdown files |
| `src/claude/agents/roundtable-analyst.md` | N/A (new file) | Agent behavior can only be validated through integration testing |
| Step files (24 files) | N/A (new files) | YAML frontmatter validation is runtime-only |

**Recommended Test Additions**:
1. Add tests to `test-three-verb-utils.test.cjs` for:
   - `readMetaJson()` defaulting `steps_completed` to `[]` when missing
   - `readMetaJson()` defaulting `depth_overrides` to `{}` when missing
   - `readMetaJson()` preserving existing `steps_completed` array when present
   - `writeMetaJson()` preserving `steps_completed` and `depth_overrides` through write cycle
   - `writeMetaJson()` not breaking when `steps_completed` is absent (backward compat)
2. Consider a new test file `test-three-verb-utils-steps.test.cjs` for step-tracking tests to keep concerns separated

### Complexity Hotspots

| Area | Complexity | Why |
|------|-----------|-----|
| `roundtable-analyst.md` step execution engine | HIGH | Must load step files dynamically, parse YAML frontmatter, execute in order, track progress, handle adaptive depth branching, and present menus -- all within a single agent markdown file |
| `roundtable-analyst.md` persona switching | MEDIUM | Must maintain distinct communication styles across 3 personas with clean transitions at phase boundaries |
| `isdlc.md` analyze verb step 7 modification | MEDIUM | High-value file (1717 lines); change must be surgical and backward-compatible |
| Step file schema consistency | MEDIUM | 24 files must all follow the same YAML frontmatter schema; no automated validation at authoring time |

### Technical Debt Markers

| Item | Debt Type | Severity |
|------|-----------|----------|
| Elaboration mode stub (`[E]` menu option) | Intentional stub for #21 | LOW -- documented, expected |
| Critic/Refiner integration not wired at step boundaries | Deferred for #22 | LOW -- documented, expected |
| No YAML frontmatter schema validation tool | Missing infrastructure | MEDIUM -- could cause runtime errors if step files have typos |
| Agent count references scattered across README, package.json, docs | Documentation drift | LOW -- needs updating from 59/60 to new count |

---

## Cross-Validation

### Consistency Check: Files Affected vs. Entry Points

All files listed in the Impact Analysis section are accounted for in the Entry Points implementation order. The 27 new files map to orders 3 (step files), 4 (agent), and 6 (sync). The 2 modified files map to orders 1 (three-verb-utils.cjs) and 5 (isdlc.md).

### Consistency Check: Risk vs. Coverage

- R1 (isdlc.md regression) -- no automated tests exist for this file, consistent with the gap identified in Test Coverage. Mitigation: manual testing with agent absent.
- R2 (three-verb-utils.cjs breaking) -- 184 tests exist, gap is only for new fields. Test addition recommended in Entry Points order 2.
- R4 (persona bleed) -- no automated test possible for agent behavior. This is an inherent limitation of markdown-based agents.

### Requirements Spec vs. Feature Summary Discrepancies

| Discrepancy | Feature Summary Says | Requirements Spec Says | Resolution |
|-------------|---------------------|----------------------|------------|
| Persona files | NEW: `src/claude/agents/personas/` | CON-001: Personas inline in agent file | Follow requirements spec (no separate persona files) |
| Skills manifest | MODIFY: `skills-manifest.json` | Section 7: No new skill IDs | Follow requirements spec (no manifest changes) |
| Three-verb-utils tests | Not mentioned | NFR-005: backward compatibility | New test file needed (added to file list) |

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Implementation Order**: three-verb-utils.cjs extension -> tests -> step files (bulk) -> roundtable-analyst.md -> isdlc.md integration -> .claude/ sync
2. **High-Risk Areas -- Add Tests First**: Extend `test-three-verb-utils.test.cjs` with `steps_completed` and `depth_overrides` tests BEFORE modifying the production code. Run the full 184-test suite after every change to `three-verb-utils.cjs`.
3. **Dependencies to Resolve**: None -- all upstream dependencies (three-verb model REQ-0023, build auto-detection REQ-0026) are confirmed complete.
4. **Keep isdlc.md Change Minimal**: The modification to `isdlc.md` step 7 should be a simple conditional check (does roundtable-analyst.md exist?) with the existing delegation pattern as the else branch. Target fewer than 20 lines of change.
5. **Step Files Are Bulk Work**: The 24 step files follow a uniform schema and can be authored efficiently. Consider creating a template step file first, then duplicating with phase-specific content.
6. **Documentation Updates**: Update `README.md` agent count from 59 to 60. Update `package.json` description if it references agent count. Update `CLAUDE.md` Key Files section if it mentions agent count.

---

## Impact Analysis Metadata

```json
{
  "analysis_completed_at": "2026-02-19",
  "sub_agents": ["M1-impact-analyzer", "M2-entry-point-finder", "M3-risk-assessor"],
  "verification_status": "PASS",
  "requirements_document": "docs/requirements/gh-20-roundtable-analysis-agent-with-named-personas/requirements-spec.md",
  "quick_scan_used": "docs/requirements/gh-20-roundtable-analysis-agent-with-named-personas/quick-scan.md",
  "scope_change_from_original": "refined",
  "requirements_keywords": ["analyze", "persona", "step-file", "adaptive-depth", "menu", "meta.json", "resumability", "brief", "standard", "deep", "roundtable"],
  "files_directly_affected": 29,
  "modules_affected": 4,
  "risk_level": "medium",
  "blast_radius": "low",
  "coverage_gaps": 2
}
```
