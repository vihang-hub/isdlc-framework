# Error Taxonomy: REQ-0042 Session Cache Markdown Tightening

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-02-26
**Coverage**: All error paths

---

## Error Codes

| Code | Description | Trigger Condition | Severity | Recovery Action |
|------|-------------|-------------------|----------|-----------------|
| TIGHT-001 | Persona tightening failed | `tightenPersonaContent()` throws during section parsing | Warning | Return original rawContent unchanged (fail-open) |
| TIGHT-002 | Topic tightening failed | `tightenTopicContent()` throws during frontmatter stripping | Warning | Return original rawContent unchanged (fail-open) |
| TIGHT-003 | Discovery condensation failed | `condenseDiscoveryContent()` throws during block analysis | Warning | Return original rawContent unchanged (fail-open) |
| TIGHT-004 | Invalid input type | Any tightening function receives non-string input | Info | Return empty string |
| TIGHT-005 | Skill index format error | `formatSkillIndexBlock()` receives malformed skill entries | Warning | Return empty string (existing behavior) |

## Error Propagation Strategy

**Pattern**: Log-and-continue with fail-open fallback

Each tightening function is wrapped in a try/catch block. On any error:
1. The original (verbose) content is returned instead of tightened content
2. If verbose mode is enabled, a warning is written to stderr: `WARNING: Tightening failed for {section}: {error.message}, using verbose fallback`
3. The cache assembly continues -- a failed tightener does not prevent other sections from being built

This is consistent with the framework's fail-open philosophy (ADR-0027, Article X of the constitution).

## Graceful Degradation Levels

| Level | Condition | Behavior |
|-------|-----------|----------|
| Full optimization | All tightening functions succeed | Cache contains tightened SKILL_INDEX, ROUNDTABLE_CONTEXT, and DISCOVERY_CONTEXT |
| Partial optimization | One or more tighteners fail | Failed sections use verbose content; successful sections use tightened content |
| No optimization | All tighteners fail | Cache is identical to pre-REQ-0042 behavior (full verbose content) |
| Cache rebuild failure | `rebuildSessionCache()` throws | Existing error handling in `bin/rebuild-cache.js` reports failure |

All degradation levels produce a valid, usable session cache. The worst case is identical to the current behavior.
