# BUG-0055: Blast radius validator fails-open when coverage artifact is missing

**Source**: GitHub Issue #127
**Created**: 2026-03-21

## Bug Description

The blast radius validator hook (`src/claude/hooks/blast-radius-validator.js`) silently passes when `blast-radius-coverage.md` does not exist. This means if the Phase 06 implementation agent skips creating the coverage artifact, the entire blast radius enforcement chain is bypassed — files listed in the impact analysis as Tier 1 direct changes can be silently dropped.

## How It Was Discovered

REQ-0066 (Team Continuity Memory) shipped with `src/claude/commands/isdlc.md` listed as a Tier 1 direct change in impact-analysis.md (tracing to FR-001, FR-002) but the file was never modified. The implementation agent only modified `lib/memory-*.js` and declared success. No `blast-radius-coverage.md` was created. The blast radius validator never fired. Phase 16 (quality loop) and Phase 08 (code review) both passed without catching the gap.

## Root Cause

The blast radius validator is **fail-open** when the coverage artifact is missing. Per Article X (Fail-Safe Defaults), hooks fail-open to avoid blocking the user. But this specific hook protects implementation completeness — failing open here means silently accepting incomplete work.

## Expected Behavior

When `blast-radius-coverage.md` does not exist but `impact-analysis.md` DOES exist (meaning blast radius was analyzed), the validator should:
1. **Fail-closed** — block phase advancement
2. Emit a clear message: "blast-radius-coverage.md missing. The implementation agent must create this artifact to track which files from the impact analysis have been addressed."
3. The Phase 06 agent should be re-delegated to create the coverage artifact

## Additional Gate Escapes Found (Same Incident)

Three gates failed to catch the missing `isdlc.md` change:

1. **Phase 06 (Implementation)**: Agent implemented lib functions but skipped handler wiring (step 9 of 10 in implementation order). No blast-radius-coverage.md created.
2. **Phase 16 (Quality Loop)**: Validated test coverage of modified files (91.35%) but not blast radius coverage (which files from impact-analysis were actually changed).
3. **Phase 08 (Code Review)**: Checked "All requirements implemented" by reviewing modified files, not by cross-referencing impact-analysis.md Tier 1 file list against the actual diff.

## Suggested Fixes

1. **Blast radius validator**: Fail-closed when impact-analysis.md exists but blast-radius-coverage.md does not
2. **Phase 08 code review agent**: Add a mandatory check that compares impact-analysis.md Tier 1 files against `git diff --name-only` and flags unaddressed files
3. **Phase 16 quality loop**: Add blast radius coverage as a quality check alongside test coverage

## Traces

- Discovered during REQ-0066 post-build verification
- Related: GH-126 (CodeBERT embedding non-functional)
- Affects: blast-radius-validator.js, qa-engineer agent, quality-loop-engineer agent
