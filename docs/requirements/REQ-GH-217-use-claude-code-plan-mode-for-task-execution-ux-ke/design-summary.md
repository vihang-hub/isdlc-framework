# Design Summary: REQ-GH-217

## Decision Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Progress display mechanism | TaskCreate per main task | Same UX as phase-level display; user-confirmed |
| Sub-task visibility | Phase summary only | Keeps task bar readable at scale |
| Task entry lifecycle | Persist through phase, cleanup at boundary | User-confirmed preference |
| Plan Mode (EnterPlanMode) | Rejected | Designed for planning, not execution tracking |
| Task ordering | Accept platform reordering | Filed upstream request for stable ordering |

## Changes Summary

| File | Change Type | Description |
|------|------------|-------------|
| `src/core/tasks/task-formatter.js` | NEW | `formatPhaseSummary()` pure function |
| `src/claude/commands/isdlc.md` | MODIFY | STEP 3d-tasks.d: main tasks only |
| `src/claude/commands/isdlc.md` | MODIFY | STEP 3d-tasks.f: remove tier cleanup |
| `src/claude/commands/isdlc.md` | MODIFY | STEP 3f: add summary print + phase cleanup |
| `CLAUDE.md` | MODIFY | Sub-Task Creation Protocol clarification |

## Open Questions

None — all decisions confirmed by user.

## Implementation Readiness

Ready to build. All interfaces defined, no external dependencies, no architectural decisions pending.
