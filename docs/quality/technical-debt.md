# Technical Debt Inventory

**Project:** iSDLC Framework
**Workflow:** REQ-0026-build-auto-detection-seamless-handoff (feature)
**Phase:** 08 - Code Review & QA
**Date:** 2026-02-19

---

## 1. New Technical Debt Introduced

### TD-001: BUILD SUMMARY Banner Not Shown After Quick-Scan Re-run

- **Severity**: Low
- **Location**: `src/claude/commands/isdlc.md`, Step 4c (line 669)
- **Description**: When a user selects `[Q] Re-run quick-scan` from the staleness menu, the `analysisStatus` is set to `'raw'`, which causes the BUILD SUMMARY banner (Step 4e) to be skipped. The user does not see a summary of what phases will execute before the workflow starts.
- **Impact**: Minor UX gap -- the user explicitly chose an action (re-run from Phase 00) so they understand what will happen. But the summary banner would provide additional confirmation.
- **Resolution Path**: In a future iteration, after applying the staleness choice, re-compute the analysis status before deciding whether to show the banner. This would allow the banner to be shown with "Build will execute: Phase 00 through Phase 08".
- **Traces**: CR-004 from code review, FR-005 (AC-005-03)

### TD-002: FR-008 (Meta.json Update After Build) Partially Implemented

- **Severity**: Low
- **Location**: `src/claude/agents/00-sdlc-orchestrator.md`, Step 2b
- **Description**: The orchestrator documentation references writing `build_started_at` to meta.json when a build workflow starts, but this is described as Could Have in the MoSCoW prioritization. The orchestrator accepts `ARTIFACT_FOLDER` but does not explicitly update meta.json's `build_started_at` field during initialization.
- **Impact**: Low -- meta.json still contains the correct analysis status and phases_completed. The `build_started_at` timestamp is a nice-to-have for traceability.
- **Resolution Path**: Add meta.json update during orchestrator initialization in a follow-up feature.
- **Traces**: FR-008 (AC-008-01, AC-008-02)

---

## 2. Pre-Existing Technical Debt (Unchanged)

### TD-PRE-001: Agent Inventory Count Drift

- **Severity**: Medium
- **Location**: `lib/prompt-format.test.js` (TC-E09, TC-13-01)
- **Description**: Tests expect 48 agent files but 60 exist. Agent count has grown without updating the test assertions.
- **Status**: Pre-existing, not introduced by REQ-0026.

### TD-PRE-002: Plan Tracking Task Cleanup Test

- **Severity**: Low
- **Location**: `lib/prompt-format.test.js` (TC-07)
- **Description**: Test expects specific task cleanup instructions in STEP 4 format that has drifted.
- **Status**: Pre-existing, not introduced by REQ-0026.

### TD-PRE-003: Supervised Review Timing-Sensitive Test

- **Severity**: Low
- **Location**: `src/claude/hooks/tests/workflow-completion-enforcer.test.cjs`
- **Description**: The `supervised_review` test is timing-sensitive and occasionally fails.
- **Status**: Pre-existing, not introduced by REQ-0026.

### TD-PRE-004: `no_halfway_entry` Rule Exception Not Annotated in workflows.json

- **Severity**: Low
- **Location**: `src/isdlc/config/workflows.json`
- **Description**: The architecture document (Section 3.4) specifies adding a `_comment_build_autodetect_exception` annotation to `workflows.json` under `rules.no_halfway_entry`. This annotation was not added during implementation. The exception is documented in the orchestrator and isdlc.md instead.
- **Impact**: Low -- the exception is well-documented in the agent files that consume the rules. The workflows.json annotation would improve discoverability.
- **Resolution Path**: Add the annotation in a follow-up cleanup.
- **Traces**: Architecture Section 3.4, CON-003

---

## 3. Debt Summary

| Category | New | Pre-Existing | Total |
|----------|-----|-------------|-------|
| High severity | 0 | 0 | 0 |
| Medium severity | 0 | 1 | 1 |
| Low severity | 2 | 3 | 5 |
| **Total** | **2** | **4** | **6** |

No high-severity debt introduced. All new debt items are low severity with clear resolution paths.
