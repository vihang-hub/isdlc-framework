# Implementation Notes: BUG-0016 -- Orchestrator Scope Overrun

**Phase**: 06-implementation
**Bug ID**: BUG-0016 (BUG-0017 internal)
**Implemented**: 2026-02-14
**Artifact Folder**: BUG-0016-orchestrator-scope-overrun

---

## Summary

Applied three prompt-level fixes to `src/claude/agents/00-sdlc-orchestrator.md` to prevent the orchestrator from exceeding its MODE-scoped boundaries. The root cause was that Section 4a ("Automatic Phase Transitions") used CRITICAL-level imperative language that overrode the descriptive MODE boundary in Section 3c. Section 4a was unconditional -- no mode-aware guard existed.

## Changes Made

### Fix 1 (P0): MODE ENFORCEMENT block at top of file

**File**: `src/claude/agents/00-sdlc-orchestrator.md` (lines 22-39)
**What**: Added a `# MODE ENFORCEMENT` heading (level 1) with CRITICAL-level imperative language that explicitly defines the hard boundaries for each MODE (init-and-phase-01, single-phase, finalize). Positioned BEFORE `# CORE MISSION` to ensure the LLM reads it first.

**Key design decisions**:
- Used level-1 heading (`#`) to match the same structural prominence as CORE MISSION
- Used bold `**CRITICAL**` + "STOP IMMEDIATELY" + "DO NOT delegate" to match or exceed Section 4a's language strength
- Explicitly stated "These boundaries OVERRIDE Section 4a" to eliminate ambiguity
- Preserved backward compatibility: "If no MODE parameter is present, proceed with full-workflow mode"

### Fix 2 (P0): Mode-Aware Guard in Section 4a

**File**: `src/claude/agents/00-sdlc-orchestrator.md` (lines 739-745)
**What**: Added a `#### Mode-Aware Guard` subsection at the top of Section 4a, before the existing CRITICAL automatic-transition instruction. This guard checks the MODE parameter before every transition.

**Key design decisions**:
- Used `####` heading level (lower than Section 4a's `##`) to keep it as a subsection
- Listed all four MODE cases explicitly (init-and-phase-01, single-phase, finalize, no MODE)
- Placed BEFORE the CRITICAL instruction so it is read first in the section

### Fix 3 (P1): Step 7.5 in Advancement Algorithm

**File**: `src/claude/agents/00-sdlc-orchestrator.md` (line 725)
**What**: Added step 7.5 to the 8-step advancement algorithm in Section 4, between step 7 (update top-level current_phase) and step 8 (delegate to next agent). This step checks whether the MODE boundary has been reached and stops execution if so.

**Key design decisions**:
- Used "7.5" numbering to avoid renumbering existing steps (minimizes diff/regression risk)
- Bold "CHECK MODE BOUNDARY" for emphasis
- Explicit "DO NOT execute step 8" instruction

### Sync: Runtime copy

The source and runtime copies are identical (symlinked), so no separate sync was needed.

## Test Results

| Suite | Total | Pass | Fail | Notes |
|-------|-------|------|------|-------|
| New tests (orchestrator-scope-overrun.test.js) | 20 | 20 | 0 | All T01-T20 pass |
| ESM (npm test) | 581 | 579 | 2 | 2 pre-existing failures (TC-E09, BUG-0014 T12) |
| CJS (npm run test:hooks) | 1280 | 1280 | 0 | Zero regressions |
| **Total** | **1861** | **1859** | **2** | All new tests pass, no regressions |

### Pre-existing failures (not caused by this change):
1. **TC-E09**: README.md agent count mismatch (known issue)
2. **BUG-0014 T12**: Step 7 extraction regex mismatch from prior renumbering

## Constitutional Compliance

| Article | Status | Evidence |
|---------|--------|----------|
| I (Specification Primacy) | Compliant | Implementation matches design spec exactly -- 3 fixes as specified |
| II (Test-First Development) | Compliant | Tests written before implementation (TDD Red -> Green) |
| III (Security by Design) | N/A | No security-relevant changes (prompt-only fix) |
| V (Simplicity First) | Compliant | Minimal changes -- only added necessary MODE guards |
| VII (Artifact Traceability) | Compliant | All tests trace to AC/NFR IDs |
| VIII (Documentation Currency) | Compliant | Implementation notes reflect actual changes |
| IX (Quality Gate Integrity) | Compliant | All 20 new tests pass, 1280 CJS tests pass |
| X (Fail-Safe Defaults) | Compliant | MODE enforcement defaults to full-workflow (backward compatible) |

## Files Changed

| File | Action | Lines Changed |
|------|--------|---------------|
| `src/claude/agents/00-sdlc-orchestrator.md` | MODIFIED | +28 lines (MODE block + guard + step 7.5) |
| `lib/orchestrator-scope-overrun.test.js` | CREATED | 555 lines (20 test cases) |
| `docs/requirements/BUG-0016-orchestrator-scope-overrun/implementation-notes.md` | CREATED | This file |
