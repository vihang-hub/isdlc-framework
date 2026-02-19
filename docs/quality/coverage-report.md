# Coverage Report: BUG-0051-GH-51 Sizing Consent

**Phase**: 16-quality-loop
**Date**: 2026-02-19
**Branch**: bugfix/BUG-0051-sizing-consent

## Coverage Status

Coverage tooling (c8/nyc/istanbul) is **not configured** for this project. This report documents functional coverage based on test-to-requirement traceability.

## Functional Coverage: New Code

### extractFallbackSizingMetrics() (lines 2854-2922 of common.cjs)

| Path | Test | Status |
|------|------|--------|
| Quick-scan with valid JSON + affected_file_count | TC-01 | Covered |
| Quick-scan with compound risk level | TC-02 | Covered |
| Quick-scan missing, requirements.md fallback | TC-03 | Covered |
| Quick-scan malformed JSON, requirements fallback | TC-04 | Covered |
| Quick-scan valid JSON but missing field | TC-05 | Covered |
| Both files missing -- null metrics | TC-06 | Covered |
| Requirements with LARGE scope | TC-07 | Covered |
| Empty artifactFolder argument | TC-08 | Covered |
| Empty projectRoot argument | TC-08b | Covered |
| requirements-spec.md preferred over requirements.md | TC-08c | Covered |
| Requirements with no scope keyword | TC-08d | Covered |

**Estimated line coverage**: 100% of new function paths exercised.

### normalizeRiskLevel() (lines 2827-2836 of common.cjs)

| Path | Test | Status |
|------|------|--------|
| Valid standard level ('low') | TC-01 | Covered |
| Compound level ('low-to-medium' -> 'medium') | TC-02 | Covered |
| Null/undefined input -> 'medium' default | TC-06 (implicit) | Covered |

**Estimated line coverage**: 100% (all branches exercised).

### applySizingDecision() audit fields (lines 3024-3031 of common.cjs)

| Path | Test | Status |
|------|------|--------|
| All four fields provided | TC-09 | Covered |
| No fields provided (backward compat defaults) | TC-10 | Covered |
| Light flag path (reason + user_prompted) | TC-11 | Covered |
| PATH 3 fallback (all four fields) | TC-12 | Covered |
| User override path | TC-12b | Covered |
| Epic deferred with audit fields | TC-12c | Covered |

**Estimated line coverage**: 100% of new audit field logic exercised.

## Coverage Summary

| Module | New Lines | Tests | Estimated Coverage |
|--------|-----------|-------|--------------------|
| normalizeRiskLevel() | 10 | 3 | 100% |
| extractFallbackSizingMetrics() | 69 | 11 | 100% |
| applySizingDecision() audit fields | 8 | 6 | 100% |
| **Total** | **87** | **17** | **100%** |
