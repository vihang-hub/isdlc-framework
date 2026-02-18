# Technical Debt Inventory

**Project:** iSDLC Framework
**Workflow:** REQ-0022-custom-skill-management (feature)
**Phase:** 08 - Code Review & QA
**Date:** 2026-02-18

---

## New Technical Debt Introduced

**None significant.** Two minor advisory items documented below, neither requiring immediate action.

### TD-NEW-01: Path Validation Not in Reusable Function (Low)

**Location:** `src/claude/commands/isdlc.md` -- `skill add` step 4
**Description:** The path traversal check for skill filenames (rejecting `/`, `\`, `..`) is implemented inline in the isdlc.md command flow rather than in a reusable function in `common.cjs`. The test file (TC-16) validates the detection pattern using local assertions rather than calling a production function.
**Impact:** Low. The check works correctly. Extracting to a function would improve testability and allow reuse from other contexts.
**Recommendation:** Consider adding an `isUnsafeFilename(name)` utility to `common.cjs` in a future hardening pass.
**Estimated effort:** 15 minutes.

### TD-NEW-02: TC-15.03 Orphan Temp Directory (Negligible)

**Location:** `src/claude/hooks/tests/external-skill-management.test.cjs` line 1311
**Description:** The TC-15.03 test case creates a test project via `createTestProject({ manifest })` and re-assigns the `common` module reference, but the returned temp directory path is not stored for cleanup in the `after()` hook. The parent `before()`/`after()` hooks manage a different `tmpDir`.
**Impact:** Negligible. Temp directories are cleaned by the OS. Does not affect test correctness.
**Recommendation:** Store and clean up in a future test hygiene pass.
**Estimated effort:** 2 minutes.

## Debt Reduced by This Feature

| Item | Before | After |
|------|--------|-------|
| External skills infrastructure (dead weight) | `resolveExternalSkillsPath()`, `resolveExternalManifestPath()`, `loadExternalManifest()` existed as stubs with no user-facing commands | Full end-to-end skill lifecycle: add, wire, list, remove, inject |
| Framework extensibility | No mechanism for users to add domain-specific knowledge | Complete external skill pipeline with smart binding suggestions |
| Agent prompt customization | Agents received only built-in skill index | Agents can now receive user-provided skill content via three delivery types |

## Pre-Existing Technical Debt (Noted During Review)

### TD-01: Phase Numbering Inconsistency (Pre-existing, Low)

**Location:** `src/claude/agents/07-qa-engineer.md`
**Description:** The QA engineer agent file header references "Phase 07" and "GATE-07" but the phase key in workflows.json is `08-code-review`.
**Impact:** Low.
**Status:** Pre-existing, noted in previous reviews.

### TD-02: No Linter or Coverage Tool Configured (Pre-existing)

**Impact:** Cannot run automated style checks or measure line/branch coverage.
**Status:** Known and tracked separately.

### TD-03: Pre-Existing Test Failures (Pre-existing)

**Tests:** 4 pre-existing failures across CJS and ESM suites.
**Impact:** Low -- drift-related (stale agent counts, stale assertions).
**Status:** Known and documented in quality reports.

### TD-04: common.cjs Size Growth (Pre-existing, Medium)

**Description:** `common.cjs` is now ~3,400 lines with 86 exports. While the file is well-organized with clear section headers, it is approaching the point where splitting into focused modules (e.g., `skill-utils.cjs`, `state-utils.cjs`) would improve maintainability.
**Impact:** Medium. No functional impact, but navigating and understanding the file requires familiarity with section structure.
**Recommendation:** Consider module extraction when the file exceeds ~4,000 lines or when adding the next major feature to this file.
