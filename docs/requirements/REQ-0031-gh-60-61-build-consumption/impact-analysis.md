# Impact Analysis: Build Consumption -- Init Split & Smart Staleness (GH-60 + GH-61)

**Generated**: 2026-02-20
**Feature**: GH-60 (MODE: init-only + Phase-Loop Controller handles all phases) + GH-61 (Blast-radius-aware smart staleness check)
**Based On**: Phase 01 Requirements (finalized, requirements-spec.md)
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original (Phase 00 Quick Scan) | Clarified (Phase 01 Requirements) |
|--------|-------------------------------|-----------------------------------|
| Description | Split init-and-phase-01 + smart staleness | MODE: init-only orchestrator mode, Phase-Loop Controller handles Phase 01, deprecate init-and-phase-01, blast-radius-aware staleness with tiered UX |
| Keywords | init-only, staleness, blast-radius, git diff, Phase-Loop | init-only, init-and-phase-01, staleness, blast-radius, git diff, Phase-Loop Controller, tiered UX, extractFilesFromImpactAnalysis |
| Estimated Files | ~8-12 files | 10 files (6 modified, 2 new, 2 test) |
| Scope Change | - | REFINED (same scope, more precise acceptance criteria) |

---

## Executive Summary

This feature makes two focused changes to the iSDLC build orchestration pipeline. GH-60 decouples workflow initialization from first-phase execution by adding a new `MODE: init-only` to the orchestrator, shifting Phase 01 execution into the Phase-Loop Controller. GH-61 replaces the naive hash-based staleness check with a blast-radius-aware algorithm that intersects `git diff --name-only` output with the file list from `impact-analysis.md`, enabling tiered responses (silent/info/warning). The changes affect 3 core files directly (isdlc.md, 00-sdlc-orchestrator.md, three-verb-utils.cjs) with 2 new test files. The risk is MEDIUM due to isdlc.md being the critical execution path for all workflows, but the changes are additive/refactoring with strong backward compatibility guarantees.

**Blast Radius**: MEDIUM (10 files, 3 modules)
**Risk Level**: MEDIUM
**Affected Files**: 10
**Affected Modules**: 3 (command handler, orchestrator agent, hooks/lib utilities)

---

## Impact Analysis

### Directly Affected Files

| File | Change Type | FR Trace | Impact Description |
|------|------------|----------|-------------------|
| `src/claude/commands/isdlc.md` | MODIFY | FR-002, FR-003, FR-006 | STEP 1: Change MODE from init-and-phase-01 to init-only. STEP 2: Remove "Mark Phase 01 as completed" logic. Steps 4b-4c: Replace naive staleness with blast-radius-aware check and tiered UX. |
| `src/claude/agents/00-sdlc-orchestrator.md` | MODIFY | FR-001, FR-003, FR-007 | Add MODE: init-only handler (Section 3c). Mark MODE: init-and-phase-01 as deprecated in mode table. Add deprecation notice emission. Define init-only return format. |
| `src/claude/hooks/lib/three-verb-utils.cjs` | MODIFY | FR-004, FR-005 | Add `extractFilesFromImpactAnalysis(mdContent)` function. Add `checkBlastRadiusStaleness(meta, currentHash, impactAnalysisContent)` function or extend `checkStaleness()` with optional blast-radius parameter. |
| `src/claude/hooks/tests/test-three-verb-utils.test.cjs` | MODIFY | FR-004, FR-005, NFR-004 | Add test suite for `extractFilesFromImpactAnalysis()` (AC-005-01 through AC-005-04). Add test suite for blast-radius staleness check (AC-004-01 through AC-004-06). |
| `src/claude/hooks/tests/test-three-verb-utils-steps.test.cjs` | MODIFY | NFR-004 | Potentially add integration tests for the checkStaleness + extractFiles pipeline. |

### New Functions/Exports

| Function | Location | FR Trace | Description |
|----------|----------|----------|-------------|
| `extractFilesFromImpactAnalysis(mdContent)` | `three-verb-utils.cjs` | FR-005 | Pure function: parses "Directly Affected Files" table from impact-analysis.md, returns array of file paths. |
| `checkBlastRadiusStaleness(meta, currentHash, impactAnalysisContent, changedFiles)` | `three-verb-utils.cjs` | FR-004 | Enhanced staleness check: accepts pre-computed changed files for testability (NFR-004), intersects with blast radius, returns severity tier. |

### Indirectly Affected Files (Read-Only or Verification)

| File | Relationship | Risk |
|------|-------------|------|
| `.isdlc/config/workflows.json` | Read by init-only mode to construct phases array. No changes needed -- phase sequences are unchanged. | NONE |
| `src/claude/hooks/blast-radius-validator.cjs` | Contains `parseImpactAnalysis()` which parses the same `impact-analysis.md` table format. New `extractFilesFromImpactAnalysis()` should be consistent with this parser but is a separate function in a different module. Note: blast-radius-validator uses regex `^\|\s*\`([^\`]+)\`\s*\|\s*(CREATE\|MODIFY\|DELETE\|NO CHANGE)\s*\|` -- new extractor may use a different/simpler pattern since it only needs file paths, not change types. | LOW |
| `src/claude/hooks/lib/common.cjs` | Contains `parseSizingFromImpactAnalysis()` which also reads impact-analysis.md JSON metadata. No changes needed -- different parsing target (JSON block vs. file table). | NONE |
| `src/claude/agents/01-requirements-analyst.md` | Phase 01 agent. No changes needed -- it already uses `MODE: single-phase` delegation pattern. GH-60 shifts HOW Phase 01 is invoked (Phase-Loop Controller vs orchestrator), not WHAT Phase 01 does. | NONE |
| All other phase agents (02-08) | No changes. Phase-Loop Controller already handles these. | NONE |

### Dependency Map

```
isdlc.md (command handler)
  |
  +-- STEP 1 --> 00-sdlc-orchestrator.md (MODE: init-only)
  |                |
  |                +-- reads: workflows.json (phase definitions)
  |                +-- writes: state.json (active_workflow)
  |                +-- returns: { status, phases[], artifact_folder, next_phase_index: 0 }
  |
  +-- STEP 3 --> Phase-Loop Controller
  |                |
  |                +-- Phase 01 (requirements-analyst) -- NEW: now handled here
  |                +-- Phase 02 (impact-analysis-orchestrator) -- existing
  |                +-- ... remaining phases ... -- existing
  |
  +-- Step 4b-4c --> three-verb-utils.cjs
                       |
                       +-- checkStaleness() -- existing (backward compat)
                       +-- checkBlastRadiusStaleness() -- NEW
                       +-- extractFilesFromImpactAnalysis() -- NEW
                       |
                       +-- reads: impact-analysis.md (file list extraction)
                       +-- reads: git diff --name-only (changed files)
```

### Change Propagation Analysis

1. **GH-60 propagation**: The MODE change propagates from `isdlc.md STEP 1` --> `orchestrator MODE handling` --> `orchestrator return format` --> `isdlc.md STEP 2 task creation` --> `isdlc.md STEP 3 phase loop entry point`. The propagation is LINEAR and contained within the command-orchestrator boundary.

2. **GH-61 propagation**: The staleness enhancement propagates from `three-verb-utils.cjs (new functions)` --> `isdlc.md Step 4b (call site)` --> `isdlc.md Step 4c (UX tiers)`. The propagation is LINEAR and contained within the build handler steps.

3. **Cross-feature interaction**: GH-60 and GH-61 are independent. GH-60 changes STEP 1 (init delegation). GH-61 changes Steps 4b-4c (staleness check). They share no code paths. The only shared file is `isdlc.md`, but the modified sections are ~400 lines apart.

---

## Entry Points

### Entry Point 1: isdlc.md STEP 1 (GH-60)

**Current**: STEP 1 delegates to orchestrator with `MODE: init-and-phase-01`. Orchestrator runs init + Phase 01 + gate + plan. Returns with `next_phase_index: 1` (Phase 01 already done).

**After**: STEP 1 delegates to orchestrator with `MODE: init-only`. Orchestrator runs init only. Returns with `next_phase_index: 0` (no phases executed).

**Implementation chain**:
1. `isdlc.md` line ~1083: Change `MODE: init-and-phase-01` to `MODE: init-only`
2. `isdlc.md` line ~1101: Expect `next_phase_index: 0` instead of `1`
3. `isdlc.md` line ~1137: Remove "Mark Phase 01's task as completed" logic in STEP 2
4. `00-sdlc-orchestrator.md` Section 3c: Add `init-only` mode definition
5. `00-sdlc-orchestrator.md` MODE ENFORCEMENT: Add `init-only` guard
6. `00-sdlc-orchestrator.md` mode table: Mark `init-and-phase-01` as deprecated

### Entry Point 2: isdlc.md Step 4b-4c (GH-61)

**Current**: Step 4b calls `checkStaleness(meta, currentHash)` which does naive hash comparison. Step 4c shows a staleness warning menu on any hash mismatch.

**After**: Step 4b calls `checkBlastRadiusStaleness(meta, currentHash, impactAnalysisContent)` (or enhanced `checkStaleness`) which does blast-radius intersection. Step 4c applies tiered UX: silent (0 overlap), info (1-3), warning menu (4+).

**Implementation chain**:
1. `three-verb-utils.cjs`: Add `extractFilesFromImpactAnalysis(mdContent)` function
2. `three-verb-utils.cjs`: Add `checkBlastRadiusStaleness()` function (or extend `checkStaleness()` with optional parameters)
3. `three-verb-utils.cjs`: Export new functions
4. `isdlc.md` Step 4b (~line 671): Read impact-analysis.md content, call blast-radius staleness check
5. `isdlc.md` Step 4c (~line 690): Replace single-tier warning with three-tier UX (none/info/warning)
6. `isdlc.md` Step 4c: Add fallback to naive behavior when impact-analysis.md missing (AC-004-05)

### Entry Point 3: three-verb-utils.cjs exports (GH-61)

**New exports**:
- `extractFilesFromImpactAnalysis(mdContent)` -- Pure function, string in, array out
- `checkBlastRadiusStaleness(meta, currentHash, impactAnalysisContent, changedFiles)` -- Enhanced staleness with injectable changedFiles for testing

**Existing exports unchanged**:
- `checkStaleness(meta, currentHash)` -- Preserved for backward compatibility (NFR-001)

### Recommended Implementation Order

1. **extractFilesFromImpactAnalysis()** (FR-005) -- Pure function, no dependencies, testable immediately. Foundation for GH-61.
2. **checkBlastRadiusStaleness()** (FR-004) -- Depends on extractFilesFromImpactAnalysis(). Pure logic with injectable parameters.
3. **Tests for FR-005 and FR-004** -- Unit tests for both new functions before integration.
4. **MODE: init-only in orchestrator** (FR-001) -- Add new mode handler. Keep init-and-phase-01 functional.
5. **Deprecation marking** (FR-003) -- Mark init-and-phase-01 as deprecated in orchestrator docs.
6. **isdlc.md STEP 1 update** (FR-002) -- Switch to init-only. Update STEP 2 (remove Phase 01 pre-mark).
7. **isdlc.md Steps 4b-4c update** (FR-006) -- Integrate blast-radius staleness and tiered UX.
8. **Integration testing** -- End-to-end validation of both features.

---

## Risk Assessment

### Risk Matrix

| File | Risk Level | Rationale | Mitigation |
|------|-----------|-----------|------------|
| `src/claude/commands/isdlc.md` | **HIGH** | Critical execution path for ALL workflows (build, feature, fix, test, upgrade). Any regression in STEP 1 or STEP 3 blocks all workflows. File is ~1800 lines with dense orchestration logic. | 1. Changes are in well-delimited sections (STEP 1, Step 4b-4c, STEP 2). 2. NFR-001 requires backward compatibility. 3. Fallback to naive staleness on any error (NFR-003). |
| `src/claude/agents/00-sdlc-orchestrator.md` | **MEDIUM** | Central orchestrator agent. Adding a new MODE is additive, but the mode handling section is complex (~800 lines). Risk of init-only missing a step that init-and-phase-01 performs. | 1. init-and-phase-01 remains functional (CON-001). 2. init-only is a SUBSET of init-and-phase-01 (everything except phase delegation and gate/plan). 3. MODE enforcement section already handles multiple modes. |
| `src/claude/hooks/lib/three-verb-utils.cjs` | **LOW** | Utility module with pure functions. New functions are additive (no modification of existing functions). Existing checkStaleness() is preserved unchanged. | 1. New functions are pure (string/array in, object out). 2. Existing tests remain passing. 3. New functions have their own test suites. |
| `src/claude/hooks/tests/*.test.cjs` | **LOW** | Test-only files. Changes are additive (new describe blocks). | Standard test development practices. |
| `.isdlc/config/workflows.json` | **NONE** | No changes needed. Feature phase sequence is unchanged. | Verify phase array is compatible with both init modes. |

### Complexity Hotspots

| Hotspot | Complexity | Risk |
|---------|-----------|------|
| isdlc.md STEP 1 + STEP 2 interaction | **HIGH** | STEP 1 returns `next_phase_index` which STEP 2 uses for task creation and Phase 01 pre-marking. Changing from `1` to `0` requires STEP 2 to NOT pre-mark Phase 01. If this logic is missed, Phase 01 task appears completed before it runs. |
| isdlc.md Step 4b-4c staleness flow | **MEDIUM** | Current staleness is simple (stale: true/false). New flow has three tiers (none/info/warning) plus fallback paths (no impact-analysis.md, git failure). Multiple conditional branches. |
| Orchestrator MODE: init-only handler | **MEDIUM** | Must replicate ALL initialization steps from init-and-phase-01 EXCEPT phase delegation, gate validation, and plan generation. Risk of missing a step (e.g., supervised mode flag, START_PHASE handling, meta.json update). |
| extractFilesFromImpactAnalysis() parser | **LOW** | Must handle variation in impact-analysis.md table formats. The blast-radius-validator already has `parseImpactAnalysis()` with a strict regex. New function needs a resilient parser that handles both backtick-wrapped and plain file paths. |

### Test Coverage Analysis

| File | Current Coverage | Gap | Recommendation |
|------|-----------------|-----|----------------|
| `three-verb-utils.cjs` | `checkStaleness()`: 9 tests (TC-CS-01 through TC-CS-09). `computeStartPhase()`: comprehensive. `validatePhasesCompleted()`: comprehensive. | No tests for `extractFilesFromImpactAnalysis()` (does not exist yet). No tests for blast-radius-aware staleness (does not exist yet). | Add ~8-10 tests for extractFilesFromImpactAnalysis. Add ~8-10 tests for checkBlastRadiusStaleness covering all AC-004 criteria. |
| `isdlc.md` | Not unit-testable (markdown agent file). Integration coverage via manual workflow execution. | STEP 1 MODE change and STEP 2 task-marking change are only verifiable through end-to-end workflow. | Manual verification after implementation. Consider adding a validation hook that checks Phase 01 task status after STEP 2. |
| `00-sdlc-orchestrator.md` | Not unit-testable (markdown agent file). | MODE: init-only is only verifiable through orchestrator invocation. | Manual verification. Validate return format matches FR-007 ACs. |
| `blast-radius-validator.cjs` | Has `parseImpactAnalysis()` with tests. | No gap -- this file is NOT modified. But verify new `extractFilesFromImpactAnalysis()` produces compatible file paths. | Cross-validation test: parse same impact-analysis.md with both functions, verify file sets match. |

### Technical Debt Markers

| Location | Debt | Severity |
|----------|------|----------|
| `isdlc.md` line ~1137 | STEP 2 "Mark Phase 01's task as completed immediately" -- hardcoded assumption that init runs Phase 01. This is the exact line that must be removed for GH-60. | MEDIUM -- core of the change |
| `isdlc.md` line ~1083 | STEP 1 hardcodes `MODE: init-and-phase-01` -- legacy coupling between init and phase execution. | MEDIUM -- core of the change |
| `isdlc.md` Steps 4b-4c | Single-tier staleness warning -- no granularity, false positives on unrelated changes. | MEDIUM -- core of the change |
| `three-verb-utils.cjs` checkStaleness() | Pure hash comparison with no file-level awareness. | LOW -- preserved for backward compat, superseded by new function |
| `00-sdlc-orchestrator.md` MODE table | Does not document init-only yet. | LOW -- addressed by this feature |

### Risk per FR

| FR | Risk | Rationale |
|----|------|-----------|
| FR-001 (init-only) | MEDIUM | New orchestrator mode. Must replicate init logic precisely. |
| FR-002 (Phase-Loop handles Phase 01) | MEDIUM | Requires isdlc.md STEP 2 change. Phase-Loop already handles all other phases so the extension is mechanical, but the STEP 2 pre-mark removal is a subtle change. |
| FR-003 (Deprecate init-and-phase-01) | LOW | Additive annotation. No behavior change. |
| FR-004 (Blast-radius staleness) | MEDIUM | New algorithm with git interaction, fallback paths, and tiered severity. |
| FR-005 (extractFilesFromImpactAnalysis) | LOW | Pure function. Well-defined input/output. |
| FR-006 (Tiered staleness UX) | MEDIUM | Changes user-facing behavior in build handler. Three conditional branches. |
| FR-007 (init-only return format) | LOW | Defined by AC-007 series. Simple JSON structure. |

---

## Cross-Validation

### File List Consistency

M1 (Impact Analysis) identified 5 directly affected files. M2 (Entry Points) identified 3 primary entry points touching those same files. All files from M2 are a subset of M1's file list. Consistent.

### Risk Scoring Consistency

M1 coupling analysis (MEDIUM blast radius -- 3 modules, 10 files) aligns with M3 risk assessment (MEDIUM risk level -- isdlc.md is high-risk but mitigated by backward compatibility constraints). The blast-radius-validator is read-only (no code changes), reducing cross-module risk.

### Completeness Check

- All 7 FRs from requirements-spec.md are traced to affected files
- All 5 NFRs have identified validation strategies
- All 5 constraints (CON-001 through CON-005) have been accounted for
- No orphan files (all files link to at least one FR)

**Verification Status**: PASS

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**: Start with `extractFilesFromImpactAnalysis()` (pure function, testable), then `checkBlastRadiusStaleness()`, then unit tests, then orchestrator MODE: init-only, then isdlc.md STEP 1, then isdlc.md Steps 4b-4c, then integration testing.

2. **High-Risk Areas**: isdlc.md STEP 1 + STEP 2 interaction (ensure Phase 01 is NOT pre-marked as completed). Add explicit assertion in manual testing that Phase 01 task starts as pending after STEP 2.

3. **Dependencies to Resolve**: Verify `parseImpactAnalysis()` in blast-radius-validator.cjs produces compatible file paths with new `extractFilesFromImpactAnalysis()`. The two functions parse similar tables but for different purposes (change types vs. file paths only). Consider referencing blast-radius-validator's regex pattern for consistency, or documenting the intentional difference.

4. **Fallback Strategy**: Per NFR-003, every new code path must have a fallback to existing behavior. The `checkBlastRadiusStaleness()` function should fall back to `checkStaleness()` when impact-analysis.md is missing or unparseable.

---

## Impact Analysis Metadata

The following JSON block is required for automated sizing analysis (REQ-0011).
All fields are required. The `parseSizingFromImpactAnalysis()` function reads
the LAST JSON block in the file to extract sizing metrics.

```json
{
  "analysis_completed_at": "2026-02-20",
  "sub_agents": ["M1", "M2", "M3", "M4"],
  "verification_status": "PASS",
  "requirements_document": "docs/requirements/gh-60-61-build-consumption-init-split-smart-staleness/requirements-spec.md",
  "quick_scan_used": "docs/requirements/gh-60-61-build-consumption-init-split-smart-staleness/quick-scan.md",
  "scope_change_from_original": "refined",
  "requirements_keywords": ["init-only", "init-and-phase-01", "staleness", "blast-radius", "git-diff", "Phase-Loop-Controller", "tiered-UX", "extractFilesFromImpactAnalysis", "checkBlastRadiusStaleness"],
  "files_directly_affected": 5,
  "modules_affected": 3,
  "risk_level": "medium",
  "blast_radius": "medium",
  "coverage_gaps": 2
}
```
