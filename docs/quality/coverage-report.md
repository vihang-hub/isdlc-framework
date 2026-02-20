# Coverage Report: REQ-0027-gh-20-roundtable-analysis-agent-with-named-personas

**Phase**: 16-quality-loop
**Date**: 2026-02-19
**Branch**: feature/REQ-0027-gh-20-roundtable-analysis-agent-with-named-personas

## Coverage Summary

| Stream | Total Tests | Pass | Fail | Pre-Existing Fail | New Fail |
|--------|-------------|------|------|--------------------|----------|
| CJS (hooks) | 2208 | 2207 | 1 | 1 | 0 |
| ESM (lib) | 632 | 629 | 3 | 3 | 0 |
| **Total** | **2840** | **2836** | **4** | **4** | **0** |

**Quantitative coverage**: NOT CONFIGURED (no c8/nyc/istanbul installed)

## New Feature Test Coverage

### test-three-verb-utils-steps.test.cjs (25 tests)

Tests for the `readMetaJson` and `writeMetaJson` changes in `three-verb-utils.cjs`:

| Category | Tests | Description |
|----------|-------|-------------|
| Default injection | TC-A01..A02 | steps_completed defaults to [], depth_overrides defaults to {} |
| Preservation | TC-A03..A04 | Existing valid values preserved on read |
| Type correction | TC-A05..A10 | Non-array steps_completed and non-object depth_overrides corrected |
| Field coexistence | TC-A11 | New fields coexist with all existing fields |
| Backward compat | TC-A12..A13, A20 | Null for missing/corrupt meta.json, legacy-only fields work |
| Write cycle | TC-A14..A18 | Write preserves steps/depth, works without them, analysis_status unaffected |
| Round-trip | TC-A19 | readMetaJson -> writeMetaJson preserves steps + depth |
| Integration | TC-D01..D05 | Step progression, resume, depth override persistence, phase completion, upgrade |

### test-step-file-validator.test.cjs (38 tests)

Tests for step file frontmatter validation and inventory:

| Category | Tests | Description |
|----------|-------|-------------|
| Frontmatter parsing | TC-B01..B02 | Valid step file with all required fields |
| step_id validation | TC-B03..B05 | Invalid format, empty, missing |
| title validation | TC-B06..B07 | Exceeding 60 chars, empty |
| persona validation | TC-B08..B11 | Three valid values, invalid rejected |
| depth validation | TC-B12..B15 | Three valid values, invalid rejected |
| outputs validation | TC-B16..B18 | Non-empty array, empty array, non-array |
| Optional fields | TC-B19..B22 | depends_on array, skip_if string |
| Body sections | TC-B23..B24 | Standard Mode presence/fallback |
| Error handling | TC-B25..B26 | Malformed YAML, missing delimiters |
| Cross-validation | TC-B27..B28 | step_id matches directory, duplicate detection |
| Inventory | TC-C01..C05 | Phase 00 (3), 01 (8), 02 (4), 03 (4), 04 (5) files exist |
| Structure | TC-C06..C10 | Valid frontmatter, matching locations, no duplicates, naming convention, body sections |

**Total new tests**: 63

## Pre-Existing Failures (unchanged)

1. CJS: gate-blocker supervised_review stderr assertion (SM-04, 1 test)
2. ESM: README agent count expects 40 (TC-E09, 1 test)
3. ESM: STEP 4 task cleanup instructions (TC-07, 1 test)
4. ESM: Agent file count expects 48, found 61 (TC-13-01, 1 test)

## Recommendation

Install `c8` for quantitative line/branch coverage measurement.
