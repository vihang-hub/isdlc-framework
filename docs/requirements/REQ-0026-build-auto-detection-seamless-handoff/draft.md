# Build Auto-Detection and Seamless Phase 05+ Handoff

**Source**: GitHub Issue #23
**Backlog Item**: 16.5

## Problem

When user says "build X", the framework cannot auto-detect how far analysis has progressed. `/isdlc build` requires the user to know the command exists, pass the right slug, and understand that analysis must be complete. If analysis is partial, the error messages are cryptic.

## Proposed Solution

When user says "build X" or "let's implement X":

1. Find matching item in `docs/requirements/` by slug, ID, or title
2. Read `meta.json` to determine analysis completion level
3. Auto-detect start phase:
   - Fully analyzed (all phases 00-04 done) → start at Phase 05 (skip re-running analysis)
   - Partially analyzed (e.g., requirements done but no architecture) → offer to resume analysis or start from current point
   - Raw item → run full workflow (Phases 00-08)
4. Staleness check: if codebase changed significantly since analysis, warn and offer refresh
5. Present clear summary: "This item has requirements and architecture but no design. Want to complete design first, or skip to implementation?"

## Files to Modify

- `src/claude/commands/isdlc.md` — build verb implementation
- `meta.json` schema extension — per-phase completion tracking (not just `phase_a_completed` boolean)

## Dependencies

- #19 (three-verb model — DONE)

## Subsumes

- #17: Phase B re-runs Phase 00/01 (SKIP_PHASES not implemented)
- #9: No post-Phase-A picker
- #10: No parallel analysis UX message

## Complexity

Low-medium
