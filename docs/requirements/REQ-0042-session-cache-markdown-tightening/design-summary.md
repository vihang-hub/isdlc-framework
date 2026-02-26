# Design Summary: REQ-0042 Session Cache Markdown Tightening

**Accepted**: 2026-02-26

## Module Design

All tightening logic as private functions in common.cjs:

| Function | Responsibility | Reduction |
|----------|---------------|-----------|
| tightenPersonaContent() | Strip sections 4,6,8,9,10; compact section 7; strip frontmatter | ~50% per persona |
| tightenTopicContent() | Strip YAML frontmatter | Removes ~30 lines per topic |
| condenseDiscoveryContent() | Strip prose lines; keep headings, tables, lists | ~40%+ |
| formatSkillIndexBlock() | Compact single-line with shortened paths, no banner | Part of 50%+ section reduction |

## Data Flow

Source files (unchanged) -> tightening function per section -> assembled session-cache.md -> injected into LLM context. All structural delimiters preserved for downstream consumers.

## Interface Contracts

- All functions: string -> string, fail-open on error
- Path shortening: extract {category}/{name} from last two segments before /SKILL.md
- Line classification in discovery: # = heading, | = table, -/* = list, else = prose (stripped)

## Error Handling

6 error codes (TIGHT-001 through TIGHT-006). Log-and-continue with fail-open fallback. Worst case: identical to current behavior.

## Implementation Size

~100-130 lines added/modified in common.cjs. No new files, no new dependencies.
