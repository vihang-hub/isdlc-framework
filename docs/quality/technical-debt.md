# Technical Debt Assessment: REQ-0012-invisible-framework

**Date**: 2026-02-13
**Phase**: 08-code-review
**Workflow**: Feature (REQ-0012)

---

## Technical Debt Introduced by REQ-0012

### TD-NEW-001: Dual-File Sync Requirement (LOW)

- **Source**: `CLAUDE.md` (project root) and `src/claude/CLAUDE.md.template`
- **Description**: The Workflow-First Development section must remain synchronized between the dogfooding CLAUDE.md and the template. Currently verified by test T43 (80% match threshold) but no automated mechanism to enforce exact synchronization during development.
- **Impact**: LOW -- test T43 catches drift; template is source of truth for new installations. Manual sync is sufficient given the section changes infrequently.
- **Recommendation**: If this section changes frequently in the future, consider adding a CI check that verifies byte-identical Workflow-First sections between both files.

### TD-NEW-002: Update Path Gap for Existing Installations (LOW)

- **Source**: `lib/updater.js` -- explicitly preserves CLAUDE.md during updates
- **Description**: Existing iSDLC installations will not receive the Invisible Framework behavior on `isdlc update` because the updater preserves CLAUDE.md. Only new installations (via `isdlc init`) get the template. This is by design (preserving user customizations) but means existing users must manually adopt the new section.
- **Impact**: LOW -- by design. The updater correctly avoids overwriting user-customized CLAUDE.md files.
- **Recommendation**: Consider adding a `--refresh-prompts` flag to `isdlc update` in a future feature that offers to merge new template sections while preserving user customizations. Tracked in BACKLOG.md.

---

## Technical Debt NOT Introduced by REQ-0012

This feature is a markdown-only change with no runtime code modifications. It does not introduce:
- No new dependencies
- No new complexity in runtime code
- No temporary workarounds or TODO markers
- No deferred cleanup tasks

---

## Pre-Existing Technical Debt (Noted for Reference)

### TD-001: TC-E09 README Agent Count (Pre-existing, LOW)

- **Source**: ESM test `deep-discovery-consistency.test.js`
- **Description**: Test expects README.md to reference "40 agents" but the actual count has changed. 1 ESM test fails (538/539).
- **Impact**: LOW -- test-only issue, no production impact.
- **Recommendation**: Update README or test to reflect current agent count.

### TD-002: Stale Header Comment in state-write-validator.cjs (Pre-existing, LOW)

- **Source**: `src/claude/hooks/state-write-validator.cjs`
- **Description**: File header says "OBSERVATIONAL ONLY" but V7/V8 now block writes.
- **Impact**: LOW -- documentation-only issue.

### TD-003: check() Cyclomatic Complexity in phase-loop-controller.cjs (Pre-existing, LOW)

- **Source**: `src/claude/hooks/phase-loop-controller.cjs`
- **Description**: CC=17 (threshold <20). Approaching medium complexity.
- **Impact**: LOW -- linear structure, well-tested.

---

## Summary

| Category | New Debt | Pre-existing Debt | Worsened |
|----------|----------|-------------------|----------|
| Production code | 0 | 2 (stale header, CC approaching threshold) | No |
| Architecture | 2 (dual-file sync, update path gap) | 0 | No |
| Tests | 0 | 1 (TC-E09 count) | No |
| Documentation | 0 | 0 | No |
| **Total** | **2 (LOW)** | **3** | **No** |

**Verdict**: REQ-0012 introduces 2 items of LOW-severity technical debt, both related to operational workflow (dual-file sync and update path gap) rather than code quality. Neither requires immediate remediation. No pre-existing debt was worsened.
