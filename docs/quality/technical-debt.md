# Technical Debt Assessment: BUG-0016 / BUG-0017 Orchestrator Scope Overrun

**Date**: 2026-02-14
**Phase**: 08-code-review
**Workflow**: fix (BUG-0016-orchestrator-scope-overrun)

---

## New Technical Debt

### TD-NEW-01: Redundant MODE Instructions in 3 Locations (LOW)

- **Files**: `src/claude/agents/00-sdlc-orchestrator.md`
- **Description**: MODE enforcement instructions now appear in 3 places: top-level MODE ENFORCEMENT block, Section 4a Mode-Aware Guard, and Section 4 step 7.5. This redundancy is intentional for LLM prompt engineering (repetition reinforces compliance), but creates a maintenance burden if MODE definitions change.
- **Recommendation**: When MODE definitions are next updated, ensure all 3 locations are updated simultaneously. Consider adding an in-file comment listing the 3 locations.
- **Priority**: Low -- the redundancy is a feature, not a bug, for prompt engineering.

## Existing Technical Debt Addressed

### TD-RESOLVED-01: Orchestrator Ignores init-and-phase-01 Boundary (was HIGH)

- **Bug**: BUG-0017 -- The orchestrator ran all workflow phases when invoked with `MODE: init-and-phase-01`, bypassing the phase-loop controller entirely
- **Root cause**: Section 4a's "AUTOMATIC" phase transitions overrode the MODE parameter constraints in Section 3c
- **Resolution**: Added 3 prompt-level safeguards at positions that the LLM reads before the automatic transition instructions
- **Net effect**: The phase-loop controller now retains control after Phase 01, enabling per-phase task visibility, hook enforcement, and supervised review gates

## Summary

| Category | Count | Status |
|----------|-------|--------|
| New Debt | 1 (LOW) | Documented |
| Resolved Debt | 1 (HIGH) | CLOSED |
| Informational | 0 | -- |

**Net Technical Debt Change**: -1 (one HIGH resolved, one LOW introduced)
