# Implementation Notes: Bug-Aware Analyze Flow (REQ-0061)

**Phase**: 06 - Implementation
**Date**: 2026-03-11
**Requirement**: REQ-0061 / GH-119

---

## Summary

Implemented three modules for the bug-aware analyze flow:

1. **Bug Classification Gate** (Module 1) -- Added to `src/claude/commands/isdlc.md` as step 6.5 in the analyze handler
2. **Bug-Gather Agent** (Module 2) -- Created `src/claude/agents/bug-gather-analyst.md`
3. **Fix Handoff Gate** (Module 3) -- Added to `src/claude/commands/isdlc.md` as step 6.5f

All changes are prompt-level markdown (no JavaScript code changes). Integration tests validate artifact format compatibility with downstream consumers.

---

## Key Implementation Decisions

### D1: computeStartPhase Does Not Detect Bug-Gather Phase 01 Completion

The `computeStartPhase` function in `three-verb-utils.cjs` validates `phases_completed` against `ANALYSIS_PHASES` which requires a contiguous prefix starting from `00-quick-scan`. Since the bug-gather agent only adds `01-requirements` (without `00-quick-scan`), `computeStartPhase` returns `raw` status.

**Resolution**: The analyze handler's step 6.5f explicitly passes `START_PHASE: "02-tracing"` to the orchestrator, bypassing `computeStartPhase` for the fix handoff. This is correct because the analyze handler has direct knowledge that Phase 01 artifacts exist (it just produced them).

### D2: Bug Classification Gate Position

The gate is inserted as step 6.5, between step 6 (SIZING PRE-CHECK) and step 7 (Roundtable conversation loop). This ensures:
- The item is resolved and meta.json is available (from steps 3-4)
- The sizing pre-check has run (step 6)
- The bug classification happens BEFORE any dispatch to roundtable or bug-gather

### D3: Draft Content and Discovery Context Reuse

Step 6.5 reads `draftContent` and `discoveryContent` once. Step 7 (roundtable, for features) reuses these variables rather than re-reading. This avoids duplicate file reads.

### D4: Bug Flow Completeness

When the bug classification gate routes to the bug-gather agent (step 6.5c-f), the entire analyze flow is self-contained. Steps 7, 7.5, 7.6, 7.7, 7.8, 8, and 9 are skipped entirely for bugs. The meta.json update and BACKLOG.md marker update happen in step 6.5e instead of step 7.8.

---

## Files Changed

| File | Change | Lines Added |
|------|--------|-------------|
| `src/claude/commands/isdlc.md` | Bug classification gate (step 6.5), fix handoff gate (step 6.5f) | ~70 lines |
| `src/claude/agents/bug-gather-analyst.md` | New agent file | ~220 lines |
| `src/claude/hooks/tests/bug-gather-artifact-format.test.cjs` | Integration tests | ~430 lines |
| `lib/prompt-format.test.js` | Agent inventory count update (69 -> 70) | 3 lines changed |

---

## Test Results

- **REQ-0061 tests**: 17/17 passing
- **Full suite (npm test)**: 1274/1277 passing (3 pre-existing failures: ONNX, SUGGESTED PROMPTS, CLAUDE.md fallback)
- **No regressions introduced**

---

## Traceability

| FR | ACs Covered | Implementation Location |
|----|-------------|------------------------|
| FR-001 (Bug Detection) | AC-001-01 to AC-001-04 | isdlc.md step 6.5a-b |
| FR-002 (Bug-Gather Agent) | AC-002-01 to AC-002-05 | bug-gather-analyst.md stages 1-4 |
| FR-003 (Artifact Production) | AC-003-01 to AC-003-04 | bug-gather-analyst.md stage 5 |
| FR-004 (Fix Handoff) | AC-004-01 to AC-004-04 | isdlc.md step 6.5f |
| FR-005 (Feature Fallback) | AC-005-01 to AC-005-03 | isdlc.md step 6.5b |
| FR-006 (Live Progress) | AC-006-01 to AC-006-03 | Existing Phase-Loop Controller behavior |
