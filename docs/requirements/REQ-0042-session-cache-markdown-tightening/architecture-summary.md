# Architecture Summary: REQ-0042 Session Cache Markdown Tightening

**Accepted**: 2026-02-26

## Key Decisions

| ADR | Decision | Rationale |
|-----|----------|-----------|
| ADR-001 | Inline tightening functions in common.cjs | Tightly coupled to cache assembly; no independent consumers |
| ADR-002 | Compact skill format with path shortening | ~9.6K extra savings from shortened paths; no other callers of formatSkillIndexBlock() |
| ADR-003 | Aggressive persona stripping (sections 4,6,8,9,10) | Section 4 duplicated by topic files; sections 6,8,9,10 duplicated by roundtable system prompt |
| ADR-004 | Aggressive discovery prose stripping | LLM agents extract facts from structured content; prose restatements add no information |

## Integration Points

6 function-call interfaces within rebuildSessionCache(). All fail-open independently. No changes to inject-session-cache.cjs or bin/rebuild-cache.js.

## Risk Level

Medium. Aggressive tightening justified by updated target. Mitigated by fail-open pattern allowing per-function tuning.

## Technology

No new dependencies. CJS string manipulation only.
