# Implementation Notes: Build Auto-Detection and Seamless Phase 05+ Handoff

**Phase**: 06-implementation
**Feature ID**: REQ-BUILD-AUTODETECT / REQ-0026
**Date**: 2026-02-19

---

## 1. Summary

Implemented the build auto-detection feature for `/isdlc build`. This adds the ability to detect analysis completion level from meta.json and start the workflow from the right phase, enabling seamless handoff from `/isdlc analyze` to `/isdlc build`.

## 2. Files Modified

### 2.1 Production Code

| File | Change Type | Description |
|------|------------|-------------|
| `src/claude/hooks/lib/three-verb-utils.cjs` | MODIFY | Added `IMPLEMENTATION_PHASES` constant and 3 new pure functions: `validatePhasesCompleted()`, `computeStartPhase()`, `checkStaleness()` |
| `src/claude/commands/isdlc.md` | MODIFY | Added build auto-detection steps 4a-4e between existing steps 4 and 5 in the build verb handler; updated STEP 1 to pass START_PHASE and ARTIFACT_FOLDER parameters |
| `src/claude/agents/00-sdlc-orchestrator.md` | MODIFY | Added step 2b for START_PHASE/ARTIFACT_FOLDER handling; updated enforcement rules, mode definitions, and meta.json build tracking (step 9) |

### 2.2 Test Code

| File | Change Type | Description |
|------|------------|-------------|
| `src/claude/hooks/tests/test-three-verb-utils.test.cjs` | MODIFY | Added 58 new test cases across 7 describe blocks (IMPLEMENTATION_PHASES, validatePhasesCompleted, computeStartPhase, checkStaleness, Integration, Regression, Error Handling) |

## 3. Key Design Decisions

### 3.1 Pure Functions (ADR-001)
All three new utility functions are pure -- no filesystem I/O, no git commands, no side effects. This makes them trivially testable and safe to call from the build verb handler without risk of blocking.

### 3.2 START_PHASE String Parameter (ADR-002)
The orchestrator receives a `START_PHASE` string (e.g., `"05-test-strategy"`) and slices the workflow phases array at that index. This is simpler than passing a pre-sliced array and allows the orchestrator to validate the phase key against the authoritative workflow definition.

### 3.3 Contiguous Prefix Validation
`validatePhasesCompleted()` returns only the contiguous prefix of recognized phases. If phases `[00, 02]` are reported, only `[00]` is valid because `01` is missing (gap detection). This prevents false analysis completion claims from corrupted meta.json.

### 3.4 Staleness as Pure Comparison (ADR-004)
`checkStaleness()` performs only string comparison on hashes. The git `rev-list --count` enrichment happens in the build verb handler (the caller), keeping the utility function pure and testable without git.

## 4. Test Results

- **Total tests**: 184 (126 existing + 58 new)
- **Passing**: 184
- **Failing**: 0
- **Coverage**: 100% branch coverage for the 3 new functions (all 15 branches tested)
- **Framework**: node:test + node:assert/strict (Node 18+ built-in)
- **Run command**: `node --test src/claude/hooks/tests/test-three-verb-utils.test.cjs`

## 5. Backward Compatibility (NFR-003)

The implementation maintains full backward compatibility:
- When `START_PHASE` is absent, the orchestrator uses full phases array (unchanged behavior)
- When `ARTIFACT_FOLDER` is absent, the orchestrator creates a new REQ-NNNN-slug folder (unchanged)
- When meta.json is missing or corrupted, `computeStartPhase()` returns `status: 'raw'` with `startPhase: null`, triggering the full workflow
- The `feature` action alias continues to behave identically to `build`

## 6. Traceability

| Requirement | Implementation |
|------------|---------------|
| FR-001 (Analysis Status Detection) | `computeStartPhase()` returns raw/partial/analyzed status |
| FR-002 (Phase-Skip Fully Analyzed) | `computeStartPhase()` returns `startPhase: '05-test-strategy'` for analyzed items |
| FR-003 (Partial Analysis) | `validatePhasesCompleted()` + `computeStartPhase()` detect partial with correct next phase |
| FR-004 (Staleness Detection) | `checkStaleness()` + build verb handler git enrichment |
| FR-005 (Phase Summary Display) | Build verb handler step 4e displays BUILD SUMMARY banner |
| FR-006 (Orchestrator START_PHASE) | Orchestrator step 2b validates and slices phases array |
| FR-007 (Artifact Folder Naming) | Orchestrator step 2b handles ARTIFACT_FOLDER with/without REQ prefix |
| FR-008 (Meta.json Build Tracking) | Orchestrator step 9 writes build_started_at and workflow_type |
| NFR-001 (Detection Latency) | Pure functions execute in microseconds; git commands add ~100-300ms |
| NFR-002 (Git Hash Performance) | commitsBehind populated by caller, not in utility function |
| NFR-003 (Backward Compatibility) | All new parameters optional; absent = unchanged behavior |
| NFR-004 (Graceful Degradation) | All functions never throw; invalid inputs produce safe defaults |
| NFR-006 (Testability) | All functions exported, pure, 58 test cases |
