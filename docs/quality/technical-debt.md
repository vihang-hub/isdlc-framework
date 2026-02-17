# Technical Debt Inventory

**Project:** iSDLC Framework
**Workflow:** BUG-0022-GH-1
**Date:** 2026-02-17

---

## New Technical Debt Introduced

**None.** This fix does not introduce new technical debt. It reduces debt by eliminating the inconsistency between the test-generate workflow (which used the legacy pipeline) and the feature/fix workflows (which use Phase 16 quality-loop).

## Pre-Existing Technical Debt (Noted During Review)

### TD-01: Phase Numbering Inconsistency (Pre-existing, Low)
**Location:** `src/claude/agents/07-qa-engineer.md`
**Description:** The QA engineer agent file header references "Phase 07" and "GATE-07" but the phase key in workflows.json is `08-code-review`. This is a pre-existing naming inconsistency across the framework -- the agent was originally designated as Phase 07 but the workflow key evolved to `08-code-review`.
**Impact:** Low -- the orchestrator routes by phase_key, not agent-internal numbering. This does not affect functionality.
**Recommendation:** Consider standardizing numbering in a future cleanup pass.

### TD-02: test-run Workflow Still Uses Legacy Pipeline (Pre-existing, Low)
**Location:** `src/isdlc/config/workflows.json`, `test-run` workflow
**Description:** The `test-run` workflow still uses phases `["11-local-testing", "07-testing"]` (the legacy pipeline). This is intentional and documented in the requirements scope ("Out of Scope: Adding build checks to ALL workflows -- only test-generate for this fix").
**Impact:** Low -- the test-run workflow executes existing tests, not generating new ones, so build breakage from generated code is not a concern.
**Recommendation:** Consider migrating test-run to Phase 16 in a future feature request if build verification is desired for test execution workflows.

### TD-03: No Linter or Coverage Tool Configured (Pre-existing)
**Impact:** Cannot run automated style checks or measure line/branch coverage.
**Status:** Known and tracked separately.

### TD-04: 4 Pre-Existing Test Failures (Pre-existing)
**Tests:** CJS: supervised_review status test; ESM: prompt-format, TC-E09 README agent count
**Impact:** Low -- drift-related, not functionality bugs.
**Status:** Known and documented in previous quality reports.

## Debt Reduced by This Fix

| Item | Before | After |
|------|--------|-------|
| test-generate workflow inconsistency | Used legacy 11+07 pipeline without build checks | Uses Phase 16 with build integrity check |
| QA APPROVED on broken build | Possible -- no build verification gate | Impossible -- build check is prerequisite for QA APPROVED |
| Build error classification | Not available | Mechanical vs logical classification with auto-fix |
