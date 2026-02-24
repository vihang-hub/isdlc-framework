# Implementation Notes: REQ-0032 Issue Tracker Integration During Installation

**Phase**: 06-implementation
**Date**: 2026-02-22
**Status**: Complete

---

## Summary

Implemented issue tracker selection during `isdlc init`, preference storage in CLAUDE.md, enhanced `detectSource()` with options-based routing, and updater section preservation warning.

## Files Modified

| File | Change Type | FRs | Description |
|------|-------------|-----|-------------|
| `lib/installer.js` | Modify | FR-001, FR-002, FR-003, FR-004, FR-007 | Added `detectGitHubRemote()`, `checkGhCli()`, `checkAtlassianMcp()` helper functions. Added issue tracker selection prompt after provider selection. Added CLAUDE.md template interpolation for `{{ISSUE_TRACKER}}`, `{{JIRA_PROJECT_KEY}}`, `{{GITHUB_REPO}}`. Added explicit copy of CLAUDE.md.template to `.claude/`. |
| `src/claude/CLAUDE.md.template` | Modify | FR-004 | Added `## Issue Tracker Configuration` section with three placeholder fields. |
| `src/claude/hooks/lib/three-verb-utils.cjs` | Modify | FR-005 | Extended `detectSource(input, options?)` with optional `options` parameter for bare number routing. |
| `src/claude/commands/isdlc.md` | Modify | FR-005 | Updated `detectSource` docs and `add` command flow to reference issue tracker preference from CLAUDE.md. |
| `lib/updater.js` | Modify | FR-006 | Added post-update check for missing `## Issue Tracker Configuration` section in CLAUDE.md with warning. |

## Files Created

| File | FRs | Description |
|------|-----|-------------|
| `src/claude/hooks/tests/detect-source-options.test.cjs` | FR-005 | 17 CJS unit tests for the `detectSource()` options enhancement. |

## Files Extended (Tests)

| File | New Tests | FRs |
|------|-----------|-----|
| `lib/installer.test.js` | +15 | FR-001, FR-002, FR-004, FR-007 |
| `lib/updater.test.js` | +4 | FR-006 |

## Key Decisions

1. **CLAUDE.md.template explicit copy**: The installer previously did not copy `CLAUDE.md.template` from `src/claude/` to `.claude/` because `copyDir` only targets subdirectories (agents/, commands/, etc.). Added explicit `copy()` call for the template file.

2. **Fail-open for all external tool checks**: `detectGitHubRemote()`, `checkGhCli()`, and `checkAtlassianMcp()` all use try/catch with fail-open returns. No external tool failure can crash the installer.

3. **Backward compatibility**: The `detectSource()` enhancement uses an optional second parameter. All 500+ existing callers that pass no options get identical behavior. No existing tests were modified.

4. **Updater preserves CLAUDE.md by design**: The updater already does not touch CLAUDE.md (it is listed as a preserved user artifact). FR-006 AC-006-01 is inherently satisfied. AC-006-02 adds a new warning when the section is missing.

5. **--force defaults to manual**: Per AC-001-05, the `--force` flag skips the interactive prompt and defaults to `manual` mode. This ensures non-interactive installations (CI, testing) work without prompts.

## Test Results

| Test Suite | Total | Pass | Fail | New |
|------------|-------|------|------|-----|
| `detect-source-options.test.cjs` | 17 | 17 | 0 | 17 |
| `lib/installer.test.js` | 73 | 73 | 0 | 15 |
| `lib/updater.test.js` | 24 | 24 | 0 | 4 |
| **Total new tests** | | | | **36** |

All pre-existing tests continue to pass. No regressions introduced.

## Traceability

| FR | ACs Covered | Test Cases |
|----|-------------|------------|
| FR-001 | AC-001-01 through AC-001-05 | TC-IT-001 through TC-IT-004, TC-IT-033 |
| FR-002 | AC-002-01 through AC-002-04 | TC-IT-005, TC-IT-006 |
| FR-003 | AC-003-01, AC-003-06 | TC-IT-007, TC-IT-008 |
| FR-004 | AC-004-01 through AC-004-05 | TC-IT-009 through TC-IT-012, TC-IT-033 |
| FR-005 | AC-005-01 through AC-005-06 | TC-IT-013 through TC-IT-028 |
| FR-006 | AC-006-01, AC-006-02 | TC-IT-029, TC-IT-030 |
| FR-007 | AC-007-01, AC-007-02 | TC-IT-031, TC-IT-032 |
