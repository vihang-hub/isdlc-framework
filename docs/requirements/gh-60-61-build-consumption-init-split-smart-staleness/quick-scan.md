# Quick Scan: Build Handler Split & Smart Staleness (GH-60 + GH-61)

**Generated**: 2026-02-20T12:00:00Z
**Feature**: GH-60 (Split MODE: init-and-phase-01 into MODE: init-only + Phase-Loop Controller) + GH-61 (Blast-radius-aware staleness check)
**Phase**: 00-quick-scan
**Artifact Folder**: gh-60-61-build-consumption-init-split-smart-staleness

---

## Scope Estimate

**Estimated Scope**: MEDIUM
**File Count Estimate**: ~8-12 files
**Confidence**: MEDIUM
**Rationale**: Two focused changes to orchestrator delegation and staleness checking. GH-60 splits a single mode into two smaller modes with Phase-Loop Controller handling phase execution. GH-61 extends staleness checking with git diff logic. Changes are additive/refactoring, not systemic rewrites.

---

## Keyword Matches

### Domain Keywords

| Keyword | Matches | Context |
|---------|---------|---------|
| `init-and-phase-01` | 2 | isdlc.md, 00-sdlc-orchestrator.md (to be deprecated/refactored) |
| `init-only` | 0 | New MODE to be added |
| `staleness` | 3 | three-verb-utils.cjs (checkStaleness fn), ADR-0025, isdlc.md (step 4b-4c) |
| `blast-radius` | 5 | impact-analysis spec, blast-radius-validator.cjs, isdlc.md phase-loop docs |
| `codebase_hash` | 8 | three-verb-utils.cjs tests, meta.json handling |
| `git diff` | 1 | ADR-0025 (staleness detection approach) |
| `Phase-Loop Controller` | 12 | isdlc.md (STEP 3 and Phase-Loop docs, ~1200 lines) |

### Technical Keywords

| Keyword | Matches | Context |
|---------|---------|---------|
| `orchestrator` | 40+ | isdlc.md, 00-sdlc-orchestrator.md (1660 lines) |
| `MODE:` | 4 | isdlc.md mode descriptions (feature, analyze, add, build) |
| `checkStaleness()` | 8 | three-verb-utils.cjs (function + tests) |
| `computeStartPhase()` | 8 | three-verb-utils.cjs (function + tests) |
| `impact-analysis.md` | 15+ | Phase 02 artifacts, file list extraction |
| `git diff --name-only` | 0 | New feature in GH-61 (not yet in codebase) |
| `metadata.json` / `meta.json` | 12 | three-verb-utils.cjs (readMetaJson, writeMetaJson) |

---

## Relevant Modules

Based on keyword search and discovery report:

1. **isdlc.md** (1816 lines)
   - STEP 1: INIT — Orchestrator delegation
   - STEP 3: Phase-Loop Controller (the main execution engine)
   - STEP 4: FINALIZE — Merge/completion
   - Build handler (steps 4a-4e for auto-detection)
   - Staleness check location (step 4b-4c, lines ~680)

2. **00-sdlc-orchestrator.md** (1660 lines)
   - MODE: init-and-phase-01 handler (lines ~764-1100)
   - Init workflow creation
   - START_PHASE resolution (REQ-0026 logic)
   - Flag parsing and pass-through

3. **three-verb-utils.cjs** (920 lines)
   - `readMetaJson()` — reads meta.json from slug directory
   - `checkStaleness(meta, currentHash)` — current naive hash comparison (lines 511-539)
   - `computeStartPhase(meta, workflowPhases)` — start phase detection (lines 393-488)
   - `validatePhasesCompleted()` — validates analysis phase progress

4. **workflows.json** (378 lines)
   - Feature workflow phase definitions
   - Currently lists all phases sequentially
   - May need adjustment if MODE: init-only changes delegation pattern

5. **impact-analysis.md** (samples: REQ-0011 ~250 lines)
   - Directly Affected Files table (structured, machine-readable)
   - File counts, module counts, risk assessment
   - Format must remain stable for GH-61 extraction

---

## Detailed Analysis by Issue

### GH-60: Split init-and-phase-01 into init-only + Phase-Loop Controller

**Current State**:
- isdlc.md has STEP 1 (orchestrator delegation) calling MODE: init-and-phase-01
- Orchestrator runs init + Phase 01 + gate + plan generation in one call
- Phase-Loop Controller (STEP 3) then runs remaining phases (02-13)

**Target State**:
- New MODE: init-only — orchestrator runs init only, returns control
- Phase-Loop Controller runs ALL phases (01-13) in sequence after init
- Deprecate MODE: init-and-phase-01

**Estimated Files Affected**:
- `src/claude/commands/isdlc.md` (STEP 1 refactor, STEP 3 adjustment) — 1 file
- `src/claude/agents/00-sdlc-orchestrator.md` (add MODE: init-only, keep MODE: init-and-phase-01 for backward compat) — 1 file
- `.isdlc/config/workflows.json` (verify phase sequence compatibility) — 1 file
- Possible: `src/claude/hooks/phase-loop-controller.cjs` (verify phase 01 handling) — 1 file

**Notes**:
- Backward compat: MODE: init-and-phase-01 should remain functional during deprecation period
- Phase-Loop Controller already handles phases 02-13; extending to 01 is minimal change
- No changes to meta.json or state schema expected

---

### GH-61: Smart Staleness Check (Blast-Radius-Aware)

**Current State** (checkStaleness in three-verb-utils.cjs, lines 511-539):
```javascript
// Step 2: Same hash -> not stale
if (meta.codebase_hash === currentHash) {
    return { stale: false, ... };
}
// Step 3: Different hash -> stale (naive)
return { stale: true, ... };
```
Simple hash mismatch detection. No file-level analysis.

**Target State** (GH-61 enhancement):
- Read `impact-analysis.md` → extract file list
- Run `git diff --name-only {original-hash}..HEAD`
- Intersect: commits that modified files in impact-analysis.md
- Decision tree:
  - 0 overlaps → silent (not stale for blast radius purposes)
  - 1-3 overlaps → info note (potential staleness)
  - 4+ overlaps → warning menu (likely stale)

**Estimated Files Affected**:
- `src/claude/hooks/lib/three-verb-utils.cjs` (extend checkStaleness or new function) — 1 file
  - Add `extractFilesFromImpactAnalysis(mdContent)` helper
  - Modify checkStaleness to accept impact-analysis.md path and do git diff
  - Or: create new function `checkBlastRadiusStaleness()` for clarity
- `src/claude/commands/isdlc.md` (use new staleness check in step 4b-4c) — 1 file
  - Pass impact-analysis.md path to staleness checker
  - Handle 0/1-3/4+ decision logic (silent/note/warning)
- `src/claude/hooks/tests/test-three-verb-utils.test.cjs` (add test cases) — 1 file

**Dependencies**:
- Requires git available at runtime (already assumed by framework)
- Requires impact-analysis.md to exist (Phase 02 artifact, guaranteed if resuming from later phase)
- ADR-0025 already documents approach

**Notes**:
- No new state.json fields needed
- No new config files needed
- Change is pure utility extension (backward compatible)

---

## Blast Radius Summary

### Direct Changes (8-12 files)

| File | Changes | Risk |
|------|---------|------|
| `src/claude/commands/isdlc.md` | STEP 1 refactor (MODE delegation), STEP 4b-4c staleness logic | MEDIUM (Phase-Loop Controller is critical path) |
| `src/claude/agents/00-sdlc-orchestrator.md` | Add MODE: init-only, adjust init flow | LOW (additive mode, backward compat MODE: init-and-phase-01) |
| `src/claude/hooks/lib/three-verb-utils.cjs` | Extend checkStaleness or new function, add file extraction | LOW (utility function, testable in isolation) |
| `.isdlc/config/workflows.json` | Verify phase sequence (likely no change) | LOW (read-only verification) |
| `src/claude/hooks/phase-loop-controller.cjs` | Possibly: adjust phase 01 entry (likely no change) | LOW |
| `src/claude/hooks/tests/test-three-verb-utils.test.cjs` | Add test cases for staleness / file extraction | LOW (test-only) |

### Indirect Dependencies (Read-Only or Minimal Impact)

| File | Affected By | Risk |
|------|---------|------|
| `src/claude/hooks/blast-radius-validator.cjs` | GH-61 smart staleness (reads same impact-analysis.md) | LOW (no code changes, just aware of new logic) |
| `src/claude/agents/01-requirements-analyst.md` | GH-60 phase ordering change | LOW (Phase 01 logic unchanged) |
| All phase agents (02-13) | GH-60 phase orchestration refactor | LOW (Phase-Loop Controller handles sequencing) |

---

## Questions for Requirements Phase

Based on findings, these questions may help clarify scope:

1. **Backward Compatibility**: Should MODE: init-and-phase-01 remain supported, deprecated-but-functional, or removed immediately? (Affects orchestrator design)

2. **Staleness Menu UX**: When GH-61 detects 4+ overlapping commits, what should the warning menu present? Options: (a) proceed anyway, (b) re-analyze, (c) cancel workflow?

3. **Phase 01 in Phase-Loop**: When GH-60 shifts Phase 01 to Phase-Loop Controller, should init still create a `phases['01-requirements']` entry, or does Phase-Loop Controller create it on first iteration?

4. **Impact Analysis Format**: Is the "Directly Affected Files" section stable enough for machine parsing (GH-61), or does it vary by analyst?

5. **Git Availability**: Can we assume `git` is always available and working in the project root when staleness check runs?

---

## Quick Scan Metadata

```json
{
  "scan_completed_at": "2026-02-20T12:00:00Z",
  "search_duration_ms": 120,
  "keywords_searched": 12,
  "files_matched": 8,
  "scope_estimate": "medium",
  "file_count_estimate": 10,
  "core_modules_affected": 5,
  "issues_grouped": 2,
  "integration_risk": "medium"
}
```

---

## Key Files Referenced

- `/Users/vihangshah/enactor-code/isdlc/src/claude/commands/isdlc.md` (1816 lines)
- `/Users/vihangshah/enactor-code/isdlc/src/claude/agents/00-sdlc-orchestrator.md` (1660 lines)
- `/Users/vihangshah/enactor-code/isdlc/src/claude/hooks/lib/three-verb-utils.cjs` (920 lines)
- `/Users/vihangshah/enactor-code/isdlc/.isdlc/config/workflows.json` (378 lines)
- `/Users/vihangshah/enactor-code/isdlc/docs/architecture/adrs/ADR-0025-staleness-detection-approach.md`

---

## Conclusion

This is a focused, medium-complexity feature affecting the build handler and orchestrator orchestration logic. The primary complexity is in the Phase-Loop Controller refactor (GH-60) and the new git diff integration (GH-61), both of which are additive/refactoring changes rather than fundamental rewrites. The features integrate well with existing REQ-0026 (Build auto-detection) work and ADR-0025 (Staleness detection), indicating good design alignment.

Estimated effort: ~6-8 hours for implementation + tests.
