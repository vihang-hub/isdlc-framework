# Coverage Report: REQ-0023-three-verb-backlog-model

**Phase**: 16-quality-loop
**Date**: 2026-02-18
**Branch**: feature/REQ-0023-three-verb-backlog-model

## Coverage Summary

| Stream | Total Tests | Pass | Fail | Pre-Existing Fail | New Fail |
|--------|-------------|------|------|--------------------|----------|
| CJS (hooks) | 1945 | 1944 | 1 | 1 | 0 |
| ESM (lib) | 632 | 630 | 2 | 2 | 0 |
| **Total** | **2577** | **2574** | **3** | **3** | **0** |

**Quantitative coverage**: NOT CONFIGURED (no c8/nyc/istanbul installed)

## New Feature Test Coverage

### src/claude/hooks/lib/three-verb-utils.cjs (636 lines, 14 exported functions)

| Function | Tests | Positive | Negative | Boundary | Edge |
|----------|-------|----------|----------|----------|------|
| generateSlug | 12 | 4 | 4 | 2 | 2 |
| detectSource | 6 | 3 | 1 | 0 | 2 |
| deriveAnalysisStatus | 4 | 2 | 1 | 0 | 1 |
| deriveBacklogMarker | 4 | 3 | 0 | 0 | 1 |
| readMetaJson | 7 | 2 | 2 | 0 | 3 |
| writeMetaJson | 4 | 2 | 0 | 0 | 2 |
| parseBacklogLine | 7 | 4 | 1 | 0 | 2 |
| updateBacklogMarker | 6 | 2 | 2 | 0 | 2 |
| appendToBacklog | 6 | 3 | 0 | 1 | 2 |
| resolveItem | 16 | 5 | 3 | 0 | 8 |
| findBacklogItemByNumber | 4 | 1 | 1 | 0 | 2 |
| findByExternalRef | 4 | 2 | 1 | 0 | 1 |
| searchBacklogTitles | 3 | 1 | 1 | 0 | 1 |
| findDirForDescription | 3 | 1 | 1 | 0 | 1 |

**Additional test categories:**
- Constants (MARKER_REGEX, ANALYSIS_PHASES): 5 tests
- Error codes (ERR-*): 18 tests
- Performance (NFR-004): 3 tests
- Cross-platform CRLF (NFR-005): 2 tests
- Integration scenarios: 17 tests

**Total new tests**: 126

## Pre-Existing Failures (unchanged)

1. CJS: gate-blocker supervised_review stderr assertion (1 test)
2. ESM: README agent count expects 40 (1 test)
3. ESM: Agent file count expects 48, found 60 (1 test)

## Recommendation

Install `c8` for quantitative line/branch coverage measurement.
