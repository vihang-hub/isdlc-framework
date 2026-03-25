# Implementation Notes: REQ-0139 — Codex Reserved Verb Routing

**Phase**: 06-implementation
**Date**: 2026-03-25
**Status**: Complete

---

## Summary

Implemented reserved verb routing for Codex adapter with two enforcement modes (prompt-prepend and runtime guard). Single parser (`resolveVerb()`) ensures no behavior drift between modes.

## Files Created

| File | Purpose |
|------|---------|
| `src/isdlc/config/reserved-verbs.json` | Canonical verb spec (FR-001) |
| `src/providers/codex/verb-resolver.js` | Pure function verb resolver (FR-001, FR-006) |
| `tests/providers/codex/verb-resolver.test.js` | 37 unit tests for resolveVerb/loadVerbSpec |
| `tests/providers/codex/projection-verb-section.test.js` | 8 unit tests for buildVerbRoutingSection |
| `tests/providers/codex/runtime-verb-guard.test.js` | 12 integration tests for applyVerbGuard |

## Files Modified

| File | Change |
|------|--------|
| `src/providers/codex/projection.js` | Added `buildVerbRoutingSection()` export (FR-002) |
| `src/providers/codex/runtime.js` | Added `applyVerbGuard()` export, import of verb-resolver (FR-003) |
| `src/codex/AGENTS.md.template` | Added reserved verb section with disambiguation rules (FR-005) |
| `docs/AGENTS.md` | Added reserved verb routing reference section (FR-005) |

## Key Design Decisions

1. **"add" as a standalone phrase**: Added bare "add" to the add verb's phrases array to enable ambiguity detection for prompts like "add and analyze this". The exclusion patterns prevent false positives in non-development context.

2. **Verb spec caching**: `loadVerbSpec()` loads via `readFileSync` at module init and caches. Custom paths bypass cache (for testing).

3. **Fail-open everywhere**: Missing spec returns `{ detected: false, reason: "spec_missing" }`. Missing config defaults to "prompt" mode. Empty input returns `{ detected: false, reason: "empty_input" }`.

4. **confirmation_required always true**: The guard never auto-executes. The model must always ask for consent.

5. **Preamble format**: YAML-like structured block prepended to prompt. Fields match the VerbResult type for transparency.

## Test Results

- **New tests**: 57 (37 unit + 8 projection + 12 integration)
- **All passing**: 57/57
- **Existing tests**: 125 (zero regressions)
- **Total provider tests**: 182
- **Iterations**: 2 (first run had 3 failures from missing bare "add" phrase)

## Traceability

| FR | ACs | Tests | Status |
|----|-----|-------|--------|
| FR-001 | AC-001-01 through AC-001-05 | VR-01 through VR-37 | Covered |
| FR-002 | AC-002-01 through AC-002-04 | PVS-01 through PVS-08 | Covered |
| FR-003 | AC-003-01 through AC-003-04 | RVG-01 through RVG-12 | Covered |
| FR-004 | AC-004-01 through AC-004-03 | RVG-03, RVG-04 | Covered |
| FR-005 | AC-005-01 through AC-005-03 | Template inspection | Covered |
| FR-006 | AC-006-01 through AC-006-06 | VR-01 through VR-34 | Covered |
| FR-007 | AC-007-01, AC-007-02 | RVG-01, RVG-03 | Covered |
