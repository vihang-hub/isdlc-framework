# Quick Scan: REQ-0041 TOON Full Spec Session Cache Reduction

| Field | Value |
|-------|-------|
| **Status** | Complete |
| **Confidence** | High |
| **Last Updated** | 2026-02-26 |
| **Coverage** | Codebase scan, data structure analysis, token estimation |

## Scope Summary

Upgrade the TOON encoder (`src/claude/hooks/lib/toon-encoder.cjs`) from tabular-only encoding to full TOON spec compliance, and wire it into `rebuildSessionCache()` to encode all four JSON sections of the session cache.

## Codebase Footprint

### Direct Change Files

| File | Role | Lines |
|------|------|-------|
| `src/claude/hooks/lib/toon-encoder.cjs` | TOON encoder module | 304 |
| `src/claude/hooks/lib/common.cjs` | Cache builder (`rebuildSessionCache()`) | ~200 lines affected (4093-4290) |
| `src/claude/hooks/tests/toon-encoder.test.cjs` | Encoder test suite | 442 (47 tests) |

### JSON Sections in Session Cache

| Section | Source File | Chars (JSON) | Nesting Depth | Objects | Arrays |
|---------|-----------|-------------|---------------|---------|--------|
| SKILLS_MANIFEST | `src/claude/hooks/config/skills-manifest.json` | 20,796 | 6 | 48 | 44 |
| ITERATION_REQUIREMENTS | `.claude/hooks/config/iteration-requirements.json` | 18,545 | 7 | 166 | 42 |
| WORKFLOW_CONFIG | `src/isdlc/config/workflows.json` | 11,043 | 6 | 76 | 14 |
| ARTIFACT_PATHS | `.claude/hooks/config/artifact-paths.json` | 792 | 3 | 6 | 5 |
| **Total JSON** | | **51,176** | | **296** | **105** |

### Session Cache Composition (177,704 chars total)

| Section | Chars | % of Cache | Type |
|---------|-------|-----------|------|
| ROUNDTABLE_CONTEXT | 47,166 | 27% | Markdown (out of scope) |
| SKILL_INDEX | 39,926 | 23% | Markdown (out of scope) |
| DISCOVERY_CONTEXT | 22,886 | 13% | Markdown (out of scope) |
| SKILLS_MANIFEST | 20,866 | 12% | JSON (in scope) |
| ITERATION_REQUIREMENTS | 18,629 | 11% | JSON (in scope) |
| CONSTITUTION | 15,175 | 9% | Markdown (out of scope) |
| WORKFLOW_CONFIG | 11,084 | 6% | JSON (in scope) |
| ARTIFACT_PATHS | 861 | <1% | JSON (in scope) |

## Estimated Reduction

| Section | JSON Chars | TOON Estimate | Reduction |
|---------|-----------|---------------|-----------|
| ITERATION_REQUIREMENTS | 18,545 | 11,544 | 38% |
| SKILLS_MANIFEST | 20,796 | 14,224 | 32% |
| WORKFLOW_CONFIG | 11,043 | 8,140 | 26% |
| ARTIFACT_PATHS | 792 | 595 | 25% |
| **Total** | **51,176** | **34,503** | **33%** |

Net cache reduction: ~16,700 chars (9.4% of total 177K cache).

## Key Findings

1. **Current encoder is tabular-only**: `isUniformArray()` guard prevents activation on any cache section since all are nested objects, not uniform arrays.
2. **Single consumer**: Session cache is read-only by `inject-session-cache.cjs` which pipes raw content to LLM context. No programmatic parsing. Decoder is needed only for test round-trips.
3. **TOON encoder is only used in one place**: `common.cjs` line 4155 -- the SKILLS_MANIFEST section builder. Currently falls through to JSON every time.
4. **Fail-open precedent**: REQ-0040 established per-section JSON fallback on encoder failure (ADR-0040-03).
5. **`_comment` keys are never read programmatically**: Safe to strip from cache output.
6. **Ownership entries are uniform**: All 41 agents in `skills-manifest.json` have identical key structure (`agent_id`, `phase`, `skill_count`, `skills`), making them candidates for tabular encoding within the nested structure.

## Risk Assessment

- **Low risk**: Changes are isolated to encoder module and one function in common.cjs
- **Fail-open safety net**: Any encoding failure falls back to JSON, preserving current behavior
- **Test coverage**: 47 existing tests provide regression baseline; new features need proportional coverage
