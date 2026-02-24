# Impact Analysis: Three-Verb Backlog Model (add/analyze/build)

**Generated**: 2026-02-18
**Feature**: Unify backlog management around three natural verbs (add, analyze, build), eliminate Phase A/B naming, redesign command surface and intent detection
**Based On**: Phase 01 Requirements (finalized) -- 9 FRs, 6 NFRs, 44 ACs
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original (Phase 00) | Clarified (Phase 01) |
|--------|---------------------|----------------------|
| Description | Three-verb backlog model (add/analyze/build) | Same scope decomposed into 9 FRs (add verb, analyze verb, build verb, intent detection, command surface, orchestrator, BACKLOG.md markers, hooks, meta.json schema) |
| Keywords | add, analyze, build, Phase A/B, backlog | add, analyze, build, meta.json, BACKLOG.md markers, hooks, intent detection, orchestrator, resumable analysis, staleness |
| Estimated Files | 10-15 files | 12 files directly, 10+ files review/cascade |
| Scope Change | - | Refined (same boundaries, precise decomposition) |

---

## Executive Summary

This feature is a **command surface redesign** that replaces the current Phase A/B preparation pipeline, `/isdlc analyze`, `/isdlc start`, and backlog picker with three clean verbs: `add`, `analyze`, `build`. The blast radius is **medium** -- concentrated in 4 primary files (isdlc.md, CLAUDE.md, orchestrator, template) with 4 hook files requiring targeted updates. The core workflow machinery (workflows.json, phase agents, quality loop) is **unaffected** -- the `build` verb maps directly to the existing feature workflow. The main risk areas are the hook EXEMPT_ACTIONS updates (2 hooks + 2 test files with tightly coupled assertions) and the isdlc.md rewrite (1463-line file requiring removal of SCENARIO 5 and Phase A/B pipeline while preserving all other scenarios). The meta.json schema migration is low-risk (read-time conversion, no batch migration). BACKLOG.md marker parsing is new functionality with no existing test coverage.

**Blast Radius**: MEDIUM (12 files directly affected, 4 modules)
**Risk Level**: MEDIUM
**Affected Files**: 12 directly, ~10 cascade/review
**Affected Modules**: Command surface (isdlc.md), Intent detection (CLAUDE.md + template), Orchestrator (00-sdlc-orchestrator.md), Hooks (4 hook files + 2 test files)

---

## Impact Analysis

### Files Directly Affected

#### Tier 1: Major Rewrites (4 files)

| File | Lines | FRs | Change Type | Description |
|------|-------|-----|-------------|-------------|
| `src/claude/commands/isdlc.md` | 1463 | FR-005 | Major rewrite | Remove SCENARIO 5 (Phase A pipeline), `/isdlc analyze` (old semantics), `/isdlc start`, `phase_a_completed` references, backlog picker references. Add `/isdlc add`, `/isdlc analyze` (new semantics), `/isdlc build`. Update ACTION routing in Phase-Loop Controller. Update QUICK REFERENCE table. ~43 Phase A/B pattern matches to eliminate. |
| `CLAUDE.md` | 253 | FR-004 | Moderate rewrite | Replace Feature/Fix intent detection table with Add/Analyze/Build/Fix. Update signal words. Keep Upgrade, Test run, Test generate, Discovery, Skill mgmt intents unchanged. |
| `src/claude/agents/00-sdlc-orchestrator.md` | 1689 | FR-006 | Moderate rewrite | Remove entire BACKLOG PICKER section (~200 lines). Update SCENARIO 3 menu (replace "New Feature"/"Fix" with Add/Analyze/Build/Fix). Update COMMANDS YOU SUPPORT. Remove Jira metadata parsing from picker. |
| `src/claude/CLAUDE.md.template` | 259 | FR-004 | Moderate rewrite | Replace old intent detection (Feature/Fix/Intake/Analyze/"Start (Phase B)") with new Add/Analyze/Build/Fix table. Remove "Preparation Pipeline" paragraph. Remove `phase_a_completed` reference in Jira integration section. |

#### Tier 2: Targeted Updates (4 files)

| File | Lines | FRs | Change Type | Description |
|------|-------|-----|-------------|-------------|
| `src/claude/hooks/skill-delegation-enforcer.cjs` | 113 | FR-008 | Minor (1 line) | Change `EXEMPT_ACTIONS` from `new Set(['analyze'])` to `new Set(['add', 'analyze'])`. Update BUG-0021 comment to reference three-verb model. |
| `src/claude/hooks/delegation-gate.cjs` | 221 | FR-008 | Minor (1 line) | Change `EXEMPT_ACTIONS` from `new Set(['analyze'])` to `new Set(['add', 'analyze'])`. Update BUG-0021 comment. |
| `src/claude/hooks/menu-halt-enforcer.cjs` | 182 | FR-008 | Review only | The `backlog-picker` menu pattern (line 44-47) detects `[O] Other` + numbered items. This pattern is still valid for menus that present a list of items with an "Other" option. **Decision**: Keep the pattern but verify it does not conflict with new menu formats. |
| `src/claude/hooks/gate-blocker.cjs` | 925 | FR-008 | Review only | No Phase A/B references found. No changes needed. Gate-blocker only checks `active_workflow` state, and `add`/`analyze` do not create workflows (NFR-002). Safe. |

#### Tier 3: Schema Updates (3 files)

| File | Lines | FRs | Change Type | Description |
|------|-------|-----|-------------|-------------|
| `docs/requirements/REQ-0020-*/meta.json` | 8 | FR-009 | Read-time migration | Contains `phase_a_completed: true`. New code reads this as `analysis_status: "analyzed"`. No file modification needed. |
| `docs/requirements/REQ-0021-*/meta.json` | 8 | FR-009 | Read-time migration | Same as above. |
| `docs/requirements/REQ-0022-*/meta.json` | 8 | FR-009 | Read-time migration | Same as above. |

#### Tier 4: Test Updates (2 files)

| File | Lines | FRs | Change Type | Description |
|------|-------|-----|-------------|-------------|
| `src/claude/hooks/tests/test-skill-delegation-enforcer.test.cjs` | 368 | FR-008 | Test update | BUG-0021 section (11 tests): Add tests for `'add'` exempt action. Existing `'analyze'` tests remain valid. Update section header comment from "Phase A analyze carve-out" to "three-verb model inline carve-out". |
| `src/claude/hooks/tests/test-delegation-gate.test.cjs` | 984 | FR-008 | Test update | BUG-0021 section (8+ tests): Add tests for `'add'` exempt action auto-clear. Existing `'analyze'` tests remain valid. Update section header comment. |

### Files NOT Affected (Confirmed Safe)

| File | Reason |
|------|--------|
| `.isdlc/config/workflows.json` | Workflow definitions unchanged. `build` maps to existing `feature` workflow. The `command` field (`/isdlc feature`) is metadata only, not used for routing. |
| `src/claude/hooks/lib/common.cjs` | No Phase A/meta.json/backlog-picker references. PHASE_AGENT_MAP has no Phase A entries. |
| `src/claude/hooks/config/skills-manifest.json` | No Phase A/B references. |
| `src/claude/agents/14-upgrade-engineer.md` | Uses "Phase A" for upgrade risk assessment (different concept). NOT the Phase A/B being eliminated. Leave alone. |
| `src/claude/agents/01-requirements-analyst.md` through `13-*.md` | Phase agents are unaffected. They receive delegation from the Phase-Loop Controller identically whether invoked via `build` or `feature`. |

### Dependency Analysis

**Outward Dependencies** (what depends on changed files):
- All phase agents depend on `isdlc.md` for action routing -> changes to routing must preserve existing `feature`, `fix`, `upgrade`, `test-run`, `test-generate` paths
- All agent delegations go through `skill-delegation-enforcer` -> EXEMPT_ACTIONS change must not break existing non-exempt flows
- `delegation-gate` is the safety net for all workflows -> EXEMPT_ACTIONS change must not create false blocks

**Inward Dependencies** (what changed files depend on):
- `isdlc.md` reads `workflows.json` for phase arrays -> `workflows.json` is unchanged, so phase arrays are stable
- `isdlc.md` reads `state.json` for active_workflow -> state.json schema is unchanged for `build` verb (uses same `active_workflow` structure)
- Hooks read `state.json` -> schema unchanged for hook-relevant fields

### Change Propagation Estimate

```
isdlc.md (command routing)
  |-> CLAUDE.md (intent detection maps to commands)
  |-> CLAUDE.md.template (mirrors CLAUDE.md for new installs)
  |-> 00-sdlc-orchestrator.md (menu presentation)
  |-> skill-delegation-enforcer.cjs (exempt action enforcement)
  |     |-> test-skill-delegation-enforcer.test.cjs
  |-> delegation-gate.cjs (exempt action safety net)
  |     |-> test-delegation-gate.test.cjs
  |-> menu-halt-enforcer.cjs (review only)
  |-> gate-blocker.cjs (review only, confirmed safe)

meta.json schema (FR-009)
  |-> 3 existing meta.json files (read-time migration, no file changes)
  |-> New meta.json files use new schema (created by `add` verb)

BACKLOG.md markers (FR-007)
  |-> BACKLOG.md format (new markers [~] and [A])
  |-> No existing parsing code to update (new functionality)
```

---

## Entry Points

### Existing Entry Points (Modified)

| Entry Point | Location | FRs | Change |
|-------------|----------|-----|--------|
| `/isdlc feature "<desc>"` | isdlc.md ACTION routing | FR-003, FR-005 | Keep as alias for `build` during transition. The `build` verb creates the same workflow. |
| `/isdlc fix "<desc>"` | isdlc.md ACTION routing | FR-005 | Unchanged. Fix workflow has distinct phases. |
| Intent detection table | CLAUDE.md Step 1 | FR-004 | Rewrite: Add/Analyze/Build/Fix replace Feature/Fix. |
| SCENARIO 3 menu | 00-sdlc-orchestrator.md | FR-006 | Update options: Add/Analyze/Build/Fix replace New Feature/Fix. |
| EXEMPT_ACTIONS check | skill-delegation-enforcer.cjs line 36 | FR-008 | Add `'add'` to exempt set. |
| EXEMPT_ACTIONS check | delegation-gate.cjs line 31 | FR-008 | Add `'add'` to exempt set. |

### New Entry Points (Created)

| Entry Point | Location | FRs | Description |
|-------------|----------|-----|-------------|
| `/isdlc add "<desc>"` | isdlc.md new section | FR-001, FR-005 | Inline action (no orchestrator). Creates draft.md + meta.json + BACKLOG.md entry. |
| `/isdlc analyze "<item>"` | isdlc.md new section | FR-002, FR-005 | Inline action (no orchestrator). Runs Phases 00-04 interactively outside workflow. Replaces old Phase A semantics. |
| `/isdlc build "<item>"` | isdlc.md new section | FR-003, FR-005 | Orchestrator-delegated action. Creates feature workflow. Replaces `/isdlc feature`. |
| Natural language "add" intent | CLAUDE.md intent table | FR-004 | Maps "add to backlog", "track this", "log this" to `/isdlc add`. |
| Natural language "analyze" intent | CLAUDE.md intent table | FR-004 | Maps "analyze", "think through", "plan this" to `/isdlc analyze`. |
| Natural language "build" intent | CLAUDE.md intent table | FR-004 | Maps "build", "implement", "create", "code" to `/isdlc build`. |

### Removed Entry Points

| Entry Point | Location | Reason |
|-------------|----------|--------|
| `/isdlc start "<item>"` | isdlc.md | Replaced by `build`. Build always starts full workflow (16.5 deferred). |
| SCENARIO 5 (Phase A pipeline) | isdlc.md | Replaced by `add` + `analyze` verbs. |
| Backlog picker (no-args) | 00-sdlc-orchestrator.md | Replaced by SCENARIO 3 menu with Add/Analyze/Build options. |
| "Start (Phase B)" intent | CLAUDE.md.template | Eliminated with Phase A/B terminology. |

### Implementation Chain

```
User natural language
  -> CLAUDE.md intent detection (Step 1)
    -> Maps to /isdlc {verb}
      -> isdlc.md ACTION routing
        -> add:     Inline execution (no orchestrator, no workflow)
        -> analyze: Inline execution (delegates to phase agents 00-04 directly)
        -> build:   Orchestrator delegation -> feature workflow -> Phase-Loop Controller
        -> fix:     Unchanged (orchestrator delegation -> fix workflow)
```

### Recommended Implementation Order

1. **FR-009: meta.json schema** -- Define the new schema and read-time migration. Foundation for add/analyze.
2. **FR-001: Add verb** -- Implement the simplest verb first. Creates draft.md, meta.json (new schema), BACKLOG.md entry.
3. **FR-007: BACKLOG.md markers** -- Implement marker system alongside add verb.
4. **FR-002: Analyze verb** -- Build on add verb output. Interactive analysis pipeline with phase delegation.
5. **FR-003: Build verb** -- Wire build to existing feature workflow. Simplest orchestrator change.
6. **FR-005: isdlc.md rewrite** -- Major file change: remove SCENARIO 5, Phase A/B, add/analyze/build sections, update routing.
7. **FR-006: Orchestrator simplification** -- Remove BACKLOG PICKER, update menus. Depends on FR-005 routing being in place.
8. **FR-004: Intent detection** -- CLAUDE.md and template updates. Can be done in parallel with FR-006.
9. **FR-008: Hook updates** -- Final step. Update EXEMPT_ACTIONS, update tests. Verifiable independently.

---

## Risk Assessment

### Risk Matrix

| Risk | Probability | Impact | Severity | Mitigation |
|------|-------------|--------|----------|------------|
| R1: isdlc.md rewrite breaks existing feature/fix routing | Medium | High | HIGH | Test all 6 existing workflows (feature, fix, test-run, test-generate, upgrade, reverse-engineer) after isdlc.md changes. Preserve all SCENARIO 1-4 and Phase-Loop Controller logic. |
| R2: EXEMPT_ACTIONS update creates false blocks for `build` | Low | High | MEDIUM | `build` must NOT be in EXEMPT_ACTIONS (it goes through orchestrator). Verify with existing "feature" non-exempt test cases. |
| R3: Hook test assertions tightly coupled to current values | Medium | Medium | MEDIUM | Existing BUG-0021 tests reference `'analyze'` strings. Need additive tests for `'add'` without breaking `'analyze'` tests. |
| R4: BACKLOG.md marker regex breaks on existing items | Medium | Medium | MEDIUM | Existing `[ ]` and `[x]` markers must parse unchanged. Test regex with real BACKLOG.md (142 existing items). |
| R5: meta.json read-time migration mishandles edge cases | Low | Medium | LOW | Defensive defaults: missing `phase_a_completed` = `"raw"`. `true` = `"analyzed"`. `false` = `"raw"`. Test with 3 existing meta.json files. |
| R6: Orchestrator BACKLOG PICKER removal breaks no-args behavior | Low | High | MEDIUM | SCENARIO 3 menu replaces picker functionality. Verify no-args `/isdlc` still presents a valid menu. |
| R7: `analyze` verb conflicts with gate-blocker expectations | Low | High | MEDIUM | Confirmed safe: gate-blocker only checks `active_workflow`, and `analyze` does not create one. No action needed. |
| R8: Template (CLAUDE.md.template) diverges from CLAUDE.md | Low | Low | LOW | Mirror changes in both files. Diff after implementation. |

### Test Coverage Gaps

| Area | Current Coverage | Gap | Recommendation |
|------|-----------------|-----|----------------|
| `add` verb logic | None (new code) | Full gap | Write unit tests for slug generation, meta.json creation, BACKLOG.md append, counter read-only enforcement |
| `analyze` verb logic | None (new code) | Full gap | Write integration tests for phase resumption, meta.json.phases_completed tracking, staleness detection |
| `build` verb logic | Partially covered by feature workflow tests | Minor gap | Verify `build` produces identical workflow state as `feature` |
| BACKLOG.md marker parsing | None (new code) | Full gap | Write regex tests for all 4 markers: `[ ]`, `[~]`, `[A]`, `[x]` |
| meta.json migration | None (new code) | Full gap | Write tests for `phase_a_completed: true` -> `analysis_status: "analyzed"` conversion |
| EXEMPT_ACTIONS for `add` | None (new) | Partial gap | Add parallel test cases for `'add'` mirroring existing `'analyze'` tests in both hook test files |
| isdlc.md ACTION routing | No automated tests (agent prompt) | Full gap (structural) | Manual verification of all action paths after rewrite |

### Complexity Hotspots

| File | Complexity Concern | LOC | Risk Factor |
|------|-------------------|-----|-------------|
| `src/claude/commands/isdlc.md` | 1463 lines of interleaved markdown + logic. Removing SCENARIO 5 (~100 lines) while adding add/analyze/build sections (~150 lines). Phase-Loop Controller routing is the most delicate area. | 1463 | HIGH -- largest file, most interconnected |
| `src/claude/agents/00-sdlc-orchestrator.md` | 1689 lines. BACKLOG PICKER is a self-contained section (~200 lines). Removal is clean but must verify no other section references picker. | 1689 | MEDIUM -- large but modular removal |
| `src/claude/hooks/tests/test-delegation-gate.test.cjs` | 984 lines. 8+ test cases reference `'analyze'` with specific assertion messages. Adding `'add'` tests requires mirroring structure. | 984 | MEDIUM -- test duplication but straightforward |

### Technical Debt Markers

| Debt Item | Location | Impact on This Feature |
|-----------|----------|----------------------|
| BUG-0021 "Phase A analyze carve-out" comments | skill-delegation-enforcer.cjs, delegation-gate.cjs, both test files | Comments reference "Phase A" terminology that this feature eliminates. Update to "three-verb model inline carve-out". |
| Phase A/B terminology in 27 agent files | Various src/claude/agents/*.md | Most are false-positive matches on "Pre-Phase Actions" or upgrade-specific "Phase A". Only isdlc.md, orchestrator, and template have actual Phase A/B prep pipeline references. |
| `backlog-picker` pattern in menu-halt-enforcer | menu-halt-enforcer.cjs line 44 | Pattern name references old concept but the regex logic (`[O] Other` detection) is still valid for any menu with an "Other" option. Consider renaming to `other-option-menu`. |

---

## Cross-Validation

Cross-validation was performed inline during analysis.

**File List Consistency**: M1 identified 12 directly affected files. M2 identified all 12 as containing entry points or requiring entry point changes. M3 confirmed 7 of 12 have test coverage gaps (the 4 new code files + 2 hook test files + BACKLOG.md parsing).

**Risk vs Coupling Consistency**: M1 rated isdlc.md as highest coupling (most outward dependencies). M3 rated it as highest risk (largest file, most interconnected). Consistent.

**Completeness Check**: All 9 FRs map to at least one affected file. All 44 ACs can be traced to specific file changes. No orphan requirements.

**Verification Status**: PASS

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**: meta.json schema (FR-009) -> add verb (FR-001) -> BACKLOG markers (FR-007) -> analyze verb (FR-002) -> build verb (FR-003) -> isdlc.md rewrite (FR-005) -> orchestrator (FR-006) -> intent detection (FR-004) -> hooks (FR-008)
2. **High-Risk Areas**: isdlc.md Phase-Loop Controller routing (test all 6 workflow types after changes), EXEMPT_ACTIONS in both hooks (add parallel tests before modifying)
3. **Dependencies to Resolve**: None -- this is a foundational redesign with no upstream blockers
4. **Test-First Targets**: Hook EXEMPT_ACTIONS tests (add `'add'` tests before changing hook code), BACKLOG.md marker regex tests, meta.json migration tests
5. **Backward Compatibility**: Keep `/isdlc feature` as a hidden alias for `build`. Existing `[ ]`/`[x]` markers must parse unchanged. Legacy `phase_a_completed` must be read correctly.

---

## Impact Analysis Metadata

```json
{
  "analysis_completed_at": "2026-02-18T20:00:00.000Z",
  "sub_agents": ["M1", "M2", "M3", "M4"],
  "verification_status": "PASS",
  "requirements_document": "docs/requirements/REQ-0023-three-verb-backlog-model/requirements-spec.md",
  "quick_scan_used": "docs/requirements/REQ-0023-three-verb-backlog-model/quick-scan.md",
  "scope_change_from_original": "refined",
  "requirements_keywords": ["add", "analyze", "build", "backlog", "intent", "verb", "marker", "status", "raw", "partial", "analyzed"],
  "files_directly_affected": 12,
  "modules_affected": 4,
  "risk_level": "medium",
  "blast_radius": "medium",
  "coverage_gaps": 7
}
```
