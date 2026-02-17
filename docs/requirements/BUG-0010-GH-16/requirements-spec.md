# BUG-0010-GH-16: Fix artifact-paths.json Filename Mismatches

**Type:** Bug Fix
**Severity:** High
**External Reference:** [GitHub Issue #16](https://github.com/vihang-hub/isdlc-framework/issues/16)
**Created:** 2026-02-17

---

## Problem Statement

`artifact-paths.json` (the gate-blocker's source of truth for artifact validation) contains filenames that don't match what phase agents actually produce. This causes the gate-blocker to block valid phase completions with false `artifact_presence` failures.

## Root Cause

`artifact-paths.json` was hand-authored in BUG-0020 with assumed filenames rather than being derived from agent output templates. REQ-0021 extracted shared protocol sections but did NOT touch `artifact-paths.json` or `iteration-requirements.json`, so the mismatch persists.

---

## Bug 1: Phase 08 (code-review) Filename Mismatch

### Current Behavior
- `artifact-paths.json` expects: `review-summary.md`
- `iteration-requirements.json` expects: `review-summary.md`
- QA Engineer agent (`07-qa-engineer.md`) actually produces: `code-review-report.md`
- `review-summary.md` is only created by the orchestrator during finalize -- AFTER GATE-08

### Expected Behavior
- Both config files should reference `code-review-report.md` to match what the QA Engineer agent produces

### Acceptance Criteria
- AC-1: `artifact-paths.json` phase `08-code-review` references `code-review-report.md`
- AC-2: `iteration-requirements.json` phase `08-code-review` artifact_validation paths references `code-review-report.md`
- AC-3: Gate-blocker no longer produces false `artifact_presence` failure for Phase 08

## Bug 2: Phase 01 (requirements) Artifact Validation in Fix Workflows

### Current Behavior
- `iteration-requirements.json` has `artifact_validation.enabled: true` for Phase 01
- In fix workflows, when the orchestrator handles requirements internally (e.g., pre-analyzed bugs from GitHub Issues), `requirements-spec.md` may not be written to disk before the gate fires
- This causes false `artifact_presence` failure at GATE-01

### Expected Behavior
- Fix workflow should have an override that disables artifact validation for Phase 01, since the orchestrator handles requirements capture differently in fix workflows
- Feature workflows should continue to validate Phase 01 artifacts

### Acceptance Criteria
- AC-4: `iteration-requirements.json` `workflow_overrides.fix["01-requirements"]` includes `artifact_validation.enabled: false`
- AC-5: Feature workflow Phase 01 artifact validation remains enabled (unaffected)
- AC-6: Gate-blocker no longer produces false `artifact_presence` failure for Phase 01 in fix workflows

---

## Files Affected

| File | Change |
|------|--------|
| `src/claude/hooks/config/artifact-paths.json` | Change `review-summary.md` to `code-review-report.md` for phase `08-code-review` |
| `src/claude/hooks/config/iteration-requirements.json` | Change `review-summary.md` to `code-review-report.md` for phase `08-code-review`; add `artifact_validation.enabled: false` to `workflow_overrides.fix["01-requirements"]` |

## Non-Functional Requirements

- NFR-1: Zero behavioral changes to gate-blocker.cjs (config-only fix)
- NFR-2: No impact on feature workflow artifact validation
- NFR-3: Both JSON files must remain valid JSON after changes

## Reproduction Steps

1. Run `/isdlc fix "any bug description"`
2. Phase 01 completes -- gate-blocker fires with `artifact_presence` missing for `requirements-spec.md`
3. Work around Phase 01 block
4. Complete through Phase 08 -- gate-blocker fires with `artifact_presence` missing for `review-summary.md`
5. Agent wrote `code-review-report.md` but hook expects `review-summary.md`
