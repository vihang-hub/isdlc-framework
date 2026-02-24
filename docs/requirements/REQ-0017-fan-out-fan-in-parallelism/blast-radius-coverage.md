# Blast Radius Coverage — REQ-0017 Fan-Out/Fan-In Parallelism

| File | Change Type | Status | Rationale |
|------|-------------|--------|-----------|
| `src/claude/hooks/config/skills-manifest.json` | MODIFY | covered | QL-012 skill entry added (skill_count 11→12, total_skills 242→243, skill_lookup and path_lookup entries) |
| `src/claude/agents/16-quality-loop-engineer.md` | MODIFY | covered | Fan-Out Protocol (Track A) section added with decision tree, chunk splitting, result merging, partial failure handling |
| `src/claude/agents/07-qa-engineer.md` | MODIFY | covered | Fan-Out Protocol (Code Review) section added with decision tree, group-by-directory splitting, deduplication, cross-cutting concerns |
| `src/claude/hooks/config/iteration-requirements.json` | MODIFY | deferred | Per ADR-0004, fan-out output uses identical schema to single-agent output. Gate validation thresholds are unchanged. No modification needed. |
| `src/claude/hooks/lib/common.cjs` | MODIFY | deferred | Per ADR-0001, fan-out engine is a markdown protocol, not executable code. No new utility functions needed in common.cjs. Configuration is read from state.json by the agent markdown, not by hook code. |
| `src/claude/commands/isdlc.md` | MODIFY | covered | --no-fan-out flag parsing added for feature and fix workflows, flag table row added |
| `src/claude/agents/00-sdlc-orchestrator.md` | MODIFY | deferred | Fan-out is phase-internal (Phase 16 and Phase 08 agents orchestrate their own fan-out). The orchestrator delegates to phase agents unchanged. No orchestrator modifications needed. |
