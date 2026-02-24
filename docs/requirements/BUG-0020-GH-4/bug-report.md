# Bug Report: BUG-0020-GH-4

**Title**: Artifact path mismatch between agents and gate-blocker -- no single source of truth
**Severity**: High
**Priority**: P0
**Reported**: 2026-02-16
**External Tracker**: [GitHub #4](https://github.com/vihangshah/isdlc/issues/4)
**Bug ID**: BUG-0020

---

## Summary

Agent OUTPUT STRUCTURE sections and `iteration-requirements.json` artifact_validation.paths are defined independently with no shared source of truth. They have drifted as agents were refactored, causing 4 of 5 phases with artifact validation to be mismatched. This causes gate blocks at runtime.

---

## Expected Behavior

When a phase agent writes artifacts to its OUTPUT STRUCTURE path, the gate-blocker hook (`gate-blocker-ext.cjs`) should validate those exact paths via `iteration-requirements.json` artifact_validation.paths. The paths should always match because they reference the same canonical location.

## Actual Behavior

Agent OUTPUT STRUCTURE paths and `iteration-requirements.json` artifact_validation.paths diverge. Agents consolidated their work-item-specific artifacts under `docs/requirements/{artifact_folder}/` during refactoring, but `iteration-requirements.json` still references the original per-category directories (`docs/architecture/`, `docs/design/`, `docs/testing/`, `docs/reviews/`).

---

## Mismatch Inventory

| Phase | Agent Writes To | Gate-Blocker Expects | Match? |
|-------|----------------|---------------------|--------|
| 01-requirements | `docs/requirements/{artifact_folder}/requirements-spec.md` | `docs/requirements/{artifact_folder}/requirements-spec.md` | YES |
| 03-architecture | `docs/requirements/{artifact_folder}/database-design.md` + `docs/common/` | `docs/architecture/{artifact_folder}/architecture-overview.md` | NO |
| 04-design | `docs/requirements/{artifact_folder}/module-design.md` | `docs/design/{artifact_folder}/interface-spec.yaml` or `.md` | NO |
| 05-test-strategy | `docs/requirements/{artifact_folder}/test-cases.md` | `docs/testing/{artifact_folder}/test-strategy.md` | NO |
| 08-code-review | `docs/requirements/{artifact_folder}/code-review-report.md` | `docs/reviews/{artifact_folder}/review-summary.md` | NO |

**4 of 5 phases with artifact validation are mismatched.**

---

## Steps to Reproduce

1. Start any feature or fix workflow (e.g., `/isdlc feature "test"`)
2. Progress through Phase 01 (requirements) -- GATE-01 passes (paths match)
3. Progress through Phase 03 (architecture) -- agent writes to `docs/requirements/{artifact_folder}/`
4. Gate-blocker checks `docs/architecture/{artifact_folder}/architecture-overview.md` -- FILE NOT FOUND
5. Gate blocks with artifact validation failure

**Observed during**: REQ-0020 Phase 08 -- gate-blocker expected `docs/reviews/{artifact_folder}/review-summary.md` but agent wrote to `docs/requirements/{artifact_folder}/code-review-report.md`.

---

## Root Cause

Agent OUTPUT STRUCTURE sections and `iteration-requirements.json` artifact_validation.paths are defined independently in separate files with no shared source of truth. They drifted when agents were refactored to consolidate work-item-specific artifacts under `docs/requirements/{artifact_folder}/` instead of scattered category directories.

**Key files:**
- Agent definitions: `src/claude/agents/*.md` (OUTPUT STRUCTURE sections)
- Gate-blocker config: `src/claude/hooks/config/iteration-requirements.json` (artifact_validation.paths)
- Gate-blocker hook: `src/claude/hooks/gate-blocker-ext.cjs` (reads iteration-requirements.json)

---

## Environment

- Framework: iSDLC 0.1.0-alpha
- Runtime: Node.js 20+
- Platform: macOS Darwin 25.2.0

---

## Proposed Fix

Create a shared `artifact-paths.json` config file as the single source of truth for artifact output locations. Both agent OUTPUT STRUCTURE sections and `iteration-requirements.json` artifact_validation.paths should reference this canonical mapping. Gate-blocker reads it for validation, agents reference it for output paths. Drift becomes structurally impossible.

Add a validation test (`artifact-path-consistency.test.cjs`) to catch any future mismatches between the shared config, agent definitions, and iteration-requirements.json.
