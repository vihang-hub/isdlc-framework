# Requirements Summary: REQ-0042 Session Cache Markdown Tightening

**Accepted**: 2026-02-26

## Problem

The session cache consumes ~44% of the context window. Three markdown sections (SKILL_INDEX 39,866 chars, ROUNDTABLE_CONTEXT 47,092 chars, DISCOVERY_CONTEXT 22,814 chars) account for 62% of the cache. REQ-0041 TOON encoding did not produce measurable context window savings in practice. The full 25-30% reduction target (~44K-53K chars) must come from markdown tightening alone.

## Functional Requirements (8 FRs)

| FR | Title | Priority | Target Savings |
|----|-------|----------|----------------|
| FR-001 | SKILL_INDEX Banner Deduplication | Must Have | ~2K chars |
| FR-002 | SKILL_INDEX Compact Format + Path Shortening | Must Have | ~19K chars (combined 50%+ section) |
| FR-003 | Persona Section Stripping (sections 4,6,8,9,10) | Must Have | ~3K/persona |
| FR-004 | Self-Validation Compaction | Must Have | ~7.5-9K total (with FR-003) |
| FR-005 | Topic File Tightening (strip frontmatter) | Must Have | Combined RT 40%+ (~19K) |
| FR-006 | DISCOVERY_CONTEXT Aggressive Prose Stripping | Must Have | 40%+ (~9K) |
| FR-007 | Fail-Open Tightening Safety | Must Have | N/A (safety) |
| FR-008 | Reduction Reporting | Should Have | N/A (observability) |

## Key Constraints

- Source files unchanged on disk; transformations at assembly time only
- Information completeness: every fact preserved, wording can change
- Validation through usage observation, not automated fact-checking
- REQ-0042 is self-sufficient for the 25-30% target (REQ-0041 savings unproven)

## Estimated Combined Savings

~51K chars (29% of 177K total cache)
