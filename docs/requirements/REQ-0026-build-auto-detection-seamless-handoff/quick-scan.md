# Quick Scan: Build Auto-Detection and Seamless Phase 05+ Handoff

**Generated**: 2026-02-19T15:00:00Z
**Feature**: Auto-detect analysis progress in backlog items and start build workflow from the appropriate phase instead of always from Phase 00
**Phase**: 00-quick-scan

---

## Scope Estimate

**Estimated Scope**: Medium
**File Count Estimate**: ~12-15 files
**Confidence**: Medium

### Rationale

This feature requires:
1. **Schema & metadata changes** (2-3 files) — extend meta.json with `analysis_status` and `phases_completed` tracking
2. **Build verb handler enhancement** (1 file) — src/claude/commands/isdlc.md (`build` / `feature` verb)
3. **Utility functions** (1-2 files) — src/claude/hooks/lib/three-verb-utils.cjs (already has `resolveItem`, `readMetaJson`, needs phase-skip logic)
4. **Orchestrator initialization** (1 file) — src/claude/agents/00-sdlc-orchestrator.md (accept skip-phases parameter in init-and-phase-01 mode)
5. **Workflow phase reset logic** (1 file) — src/claude/hooks/lib/common.cjs (`resetPhasesForWorkflow` needs variant for skipping completed phases)
6. **UX/prompting** (2-3 files) — prompts for clarifying partial analysis, staleness warnings, phase skip confirmation
7. **Tests** (3-4 files) — unit tests for auto-detection, staleness checks, phase skipping logic

Existing infrastructure (Phase-Loop Controller, workflow initialization, hooks) is already in place and requires minimal changes. The feature is well-isolated to build verb initialization and does not affect other verbs or phase agents.

---

## Keyword Matches

### Domain Keywords
| Keyword | Files | Context |
|---------|-------|---------|
| build | 12 | src/claude/commands/isdlc.md (build verb handler), workflows.json (feature workflow) |
| analyze | 8 | isdlc.md (analyze verb), three-verb-utils.cjs (resolveItem), state.json (analysis_status) |
| phase | 15 | orchestrator, workflows.json (phase arrays), common.cjs (phase reset/tracking) |
| auto-detect | 2 | isdlc.md (detection logic for constitution, project type) — pattern exists |
| skip | 6 | workflows.json (skip_exploration option), isdlc.md (SKIP_PHASES references) |
| seamless | 0 | Novel pattern for this feature — term not used in codebase |

### Technical Keywords
| Keyword | Files | Context |
|---------|-------|---------|
| phases_completed | 5 | three-verb-utils.cjs, common.cjs (state tracking), meta.json schema |
| analysis_status | 6 | three-verb-utils.cjs, state management, legacy migration (phase_a_completed) |
| meta.json | 4 | three-verb-utils.cjs, backlog integration, artifact tracking |
| resolveItem | 3 | three-verb-utils.cjs (main entry point for item lookup) |
| resetPhasesForWorkflow | 1 | common.cjs (workflow phase initialization) |
| current_phase_index | 3 | common.cjs (orchestrator phase loop tracking) |

---

## Relevant Modules

Based on keyword search and feature description, the following modules are highly likely to be affected:

| Module | File | Purpose | Scope |
|--------|------|---------|-------|
| Three-Verb Utils | `src/claude/hooks/lib/three-verb-utils.cjs` | Shared utilities for add/analyze/build — resolveItem, readMetaJson | HIGH — extend with phase-skip logic |
| Build Verb Handler | `src/claude/commands/isdlc.md` | Entry point for `/isdlc build` and `/isdlc feature` | HIGH — add analysis detection, phase skip parameter |
| SDLC Orchestrator | `src/claude/agents/00-sdlc-orchestrator.md` | Initialization and phase delegation for `init-and-phase-01` mode | MEDIUM — accept skip-phases parameter |
| Common Lib | `src/claude/hooks/lib/common.cjs` | Phase tracking, state reset — `resetPhasesForWorkflow()` | MEDIUM — extend with phase-skip variant |
| Workflows Config | `src/isdlc/config/workflows.json` | Workflow definitions, phase arrays | LOW — reference only, may add SKIP_PHASES option |
| Meta Schema | `docs/requirements/*/meta.json` | Per-item metadata tracking | HIGH — already has `phases_completed`, needs validation |
| Phase-Loop Controller | `src/claude/commands/isdlc.md` (STEP 3) | Phase sequencing logic | LOW — should work as-is with skipped phases |

---

## Current State Analysis

### What Already Exists

1. **Analysis Status Tracking** — `meta.json` already has `analysis_status` field (raw/partial/analyzed) and `phases_completed` array (three-verb-utils.cjs, lines 200-221)
2. **Item Resolution** — `resolveItem()` function exists (three-verb-utils.cjs, lines 401+) with ID/slug/title matching
3. **Legacy Migration** — Phase A completion tracking has migration path from `phase_a_completed` boolean to `phases_completed` array
4. **Workflow Phase Management** — `resetPhasesForWorkflow()` initializes phase state (common.cjs, lines 2471+)
5. **Phase Sequencing** — Phase-Loop Controller with STEP 3d (delegation) and STEP 3e (state update) exists

### What Needs to be Added

1. **Auto-Detection Logic** — Read `meta.json.phases_completed` and determine next available phase
2. **Staleness Check** — Compare `meta.json.codebase_hash` with current git HEAD (warn if different)
3. **Phase Skip Mechanism** — Variant of `resetPhasesForWorkflow()` to skip already-completed phases
4. **UX Prompting** — Clarify partial analysis scenarios (e.g., "Requirements done but no design. Continue design?")
5. **Parameter Threading** — Pass skip-phases list through orchestrator → common.cjs → state initialization
6. **Testing** — Unit tests for phase detection logic, staleness validation

---

## Questions for Requirements Analyst

Based on this scan, clarify these points to scope the implementation correctly:

1. **Partial Analysis Handling**: When item has requirements but no architecture (phases 00-01 done, 02+ pending), should the build verb:
   - Auto-detect and skip to Phase 02? (seamless)
   - Present a menu asking user to complete analysis first? (guided)
   - Show analysis summary and ask user to confirm skipping to Phase 02? (informed)

2. **Staleness Strategy**: When `codebase_hash` in meta.json differs from current HEAD:
   - Warn but allow proceed? (user override)
   - Force re-analysis? (safe)
   - Offer hybrid: re-run quick-scan and impact-analysis but reuse requirements/design? (smart refresh)

3. **Scope of "Analysis Complete"**: Does "fully analyzed" mean:
   - All phases 00-04 complete (skip to Phase 05-test-strategy)?
   - User has marked item as "ready to build" explicitly?
   - Requires all analysis gates to pass?

4. **UI for Phase Summary**: How should the system present which phases are done?
   - Short summary: "✓ Requirements ✓ Architecture, pending Design" (inline)
   - Detailed list with dates: (verbose)
   - Visual progress bar: (graphical — harder in CLI)

5. **Error Recovery**: If analysis is partial and contradictory (e.g., phases_completed lists 00,01,03 but skips 02):
   - Auto-repair by sorting/validating? (opinionated)
   - Show warning and ask user to fix? (safe)
   - Abort with error message? (strict)

---

## Integration Points

The feature integrates with these existing systems:

1. **Phase-Loop Controller** (isdlc.md STEP 3) — phases are skipped, not executed, so STEP 3d simply does not delegate to those agents
2. **State Initialization** — `resetPhasesForWorkflow()` is called during orchestrator init; variant will skip setting pending status for completed phases
3. **Meta.json Lifecycle** — No changes to meta.json structure; existing `phases_completed` array is the source of truth
4. **Build Verb Entry Point** — Logic goes in isdlc.md build handler, before orchestrator delegation
5. **Workflows Config** — Defines which phases map to which workflow (feature, fix, etc.); used to determine skip list

---

## Risk & Dependencies

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Partial/corrupted analysis state | Medium | Validate phases_completed array against known ANALYSIS_PHASES; offer repair option |
| Codebase drift since analysis | Medium | Implement staleness check with git hash comparison; offer refresh workflow |
| User confusion about "ready" state | Medium | Clear UX messaging showing which phases are done and which will run |
| Phase ordering dependencies | Low | Phases are acyclic; skipping earlier phases doesn't break later ones |
| Orchestrator initialization complexity | Low | Existing init-and-phase-01 mode already handles phase sequencing |

---

## Quick Scan Metadata

```json
{
  "scan_completed_at": "2026-02-19T15:00:00Z",
  "search_duration_ms": 45,
  "keywords_searched": 13,
  "files_matched": 35,
  "scope_estimate": "medium",
  "file_count_estimate": 14,
  "confidence": "medium",
  "keyword_breakdown": {
    "domain_keywords": {
      "build": 12,
      "analyze": 8,
      "phase": 15,
      "skip": 6
    },
    "technical_keywords": {
      "phases_completed": 5,
      "analysis_status": 6,
      "meta.json": 4,
      "resolveItem": 3
    }
  },
  "affected_modules": [
    "src/claude/hooks/lib/three-verb-utils.cjs",
    "src/claude/commands/isdlc.md",
    "src/claude/agents/00-sdlc-orchestrator.md",
    "src/claude/hooks/lib/common.cjs",
    "src/isdlc/config/workflows.json",
    "docs/requirements/*/meta.json"
  ]
}
```

---

## Notes for Requirements Phase

1. **Existing Infrastructure is Solid**: The three-verb model (add/analyze/build) is already implemented. Auto-detection is a natural extension of the build verb.

2. **Meta Schema Already Supports It**: `phases_completed` array exists in meta.json and is actively maintained by three-verb-utils.cjs. No breaking changes needed.

3. **Phase-Loop Controller is Phase-Agnostic**: STEP 3d simply delegates to phase agents based on current_phase_index. Skipped phases are automatically skipped by not advancing the index.

4. **Key Design Decision**: Should auto-detection be explicit (user confirms skip) or implicit (user just says "build X" and it starts from the right place)? Draft suggests implicit, but this should be clarified.

5. **Staleness Detection is Novel**: Codebase hash comparison (meta.json.codebase_hash vs git HEAD) is not currently implemented anywhere in the framework. This will be the most complex part.

6. **Testing Strategy**: Focus on:
   - Phase detection logic (which phases to skip given phases_completed array)
   - Staleness detection edge cases
   - UI messaging for partial analysis
   - Integration with orchestrator init

