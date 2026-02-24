# Implementation Notes: BUG-0020-GH-4

**Title**: Artifact path mismatch between agents and gate-blocker
**Bug ID**: BUG-0020
**External**: [GitHub #4](https://github.com/vihangshah/isdlc/issues/4)
**Phase**: 06-implementation
**Implemented**: 2026-02-16

---

## Summary

Fixed the artifact path mismatch between what agents actually write and what gate-blocker validates. Created `artifact-paths.json` as a single source of truth, updated `iteration-requirements.json` to use corrected paths, and modified `gate-blocker.cjs` to prefer `artifact-paths.json` when validating artifact presence.

## Root Cause

Agents write all phase artifacts to `docs/requirements/{artifact_folder}/`, but `iteration-requirements.json` had hardcoded paths pointing to phase-specific directories that do not exist:

| Phase | Old (broken) path | New (corrected) path |
|-------|------------------|---------------------|
| 03-architecture | `docs/architecture/{af}/architecture-overview.md` | `docs/requirements/{af}/architecture-overview.md` |
| 04-design | `docs/design/{af}/interface-spec.yaml\|.md` | `docs/requirements/{af}/module-design.md` |
| 05-test-strategy | `docs/testing/{af}/test-strategy.md` | `docs/requirements/{af}/test-strategy.md` |
| 08-code-review | `docs/reviews/{af}/review-summary.md` | `docs/requirements/{af}/review-summary.md` |
| 01-requirements | `docs/requirements/{af}/requirements-spec.md` | (unchanged -- was already correct) |

## Files Changed

### Created

1. **`src/claude/hooks/config/artifact-paths.json`** (FR-01)
   - Single source of truth for artifact paths per phase
   - Schema: `{ phases: { "<phase-key>": { paths: ["..."] } } }`
   - 5 phase entries covering all phases with artifact_validation

2. **`src/claude/hooks/tests/artifact-path-consistency.test.cjs`** (FR-05)
   - 12 test cases validating consistency between artifact-paths.json and iteration-requirements.json
   - Reads REAL production config files (not test copies) for drift detection
   - Catches future mismatches automatically

### Modified

3. **`src/claude/hooks/config/iteration-requirements.json`** (FR-03)
   - Updated `artifact_validation.paths` for phases 03, 04, 05, 08 to use corrected `docs/requirements/` paths
   - Phase 01 unchanged (was already correct)

4. **`src/claude/hooks/gate-blocker.cjs`** (FR-02)
   - Added `loadArtifactPaths()` function to read artifact-paths.json
   - Added `getArtifactPathsForPhase()` to get paths for a specific phase
   - Modified `checkArtifactPresenceRequirement()` to prefer artifact-paths.json, falling back to iteration-requirements.json inline paths
   - Fail-open: missing or malformed artifact-paths.json gracefully falls back

5. **`src/claude/hooks/tests/test-gate-blocker-extended.test.cjs`**
   - Added `describe('BUG-0020: Artifact path mismatch reproduction')` -- 5 tests
   - Added `describe('BUG-0020: artifact-paths.json integration')` -- 6 tests
   - Total: 11 new tests for BUG-0020

6. **`src/claude/hooks/tests/readme-fixes.test.cjs`**
   - Updated 1 test ("allows when either variant of design artifact exists") to use corrected paths

## Design Decisions

1. **Override pattern, not replacement**: gate-blocker prefers artifact-paths.json but falls back to iteration-requirements.json. This provides backward compatibility if artifact-paths.json is missing.

2. **Corrected iteration-requirements.json in parallel**: Even though artifact-paths.json overrides, we also corrected the inline paths in iteration-requirements.json so both files agree. The consistency test enforces this.

3. **All paths use docs/requirements/**: This matches the actual agent behavior where all artifacts are written under a single unified directory per work item.

4. **Drift detection is automated**: The `artifact-path-consistency.test.cjs` file reads production config files directly and fails if they disagree. This prevents the bug from recurring.

## Test Results

- **New tests**: 23 (12 consistency + 11 gate-blocker)
- **Pre-existing tests**: 1587 CJS hook tests
- **Pass rate**: 1586/1587 (99.94%)
- **Only failure**: Pre-existing SM-04 (REQ-0013, supervised review info logging) -- not BUG-0020 related

## Requirement Traceability

| Requirement | Implementation |
|------------|---------------|
| FR-01 | artifact-paths.json created with 5 phase entries |
| FR-02 | gate-blocker.cjs reads from artifact-paths.json via loadArtifactPaths() |
| FR-03 | iteration-requirements.json paths corrected for phases 03, 04, 05, 08 |
| FR-04 | Agent OUTPUT STRUCTURE docs -- deferred to code-review phase (documentation-only change) |
| FR-05 | artifact-path-consistency.test.cjs with 12 drift-detection tests |
| NFR-01 | Backward compatible -- fallback to iteration-requirements.json when artifact-paths.json missing |
| NFR-02 | Zero regression -- all 1586/1587 existing tests still pass |
