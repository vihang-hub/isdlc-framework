# Technical Debt Assessment -- BUG-0019-GH-1 Blast Radius Relaxation Fix

**Date**: 2026-02-16
**Phase**: 08-code-review
**Workflow**: Fix (BUG-0019-GH-1)

---

## 1. Technical Debt Addressed by This Fix

### TD-RESOLVED-01: Generic Hook Block Handling (Bug 0.17)

**Previous state**: STEP 3f treated all hook blocks identically with a generic Retry/Skip/Cancel menu. No hook-specific handling existed.
**Resolution**: Added `3f-blast-radius` branch with specialized 7-step handling including file parsing, task cross-reference, prohibitions, and retry loop.
**Impact**: Eliminated the root cause of blast radius relaxation by providing specific re-implementation instructions.

### TD-RESOLVED-02: Missing Task Plan Integration (Bug 0.18)

**Previous state**: `docs/isdlc/tasks.md` was never read during blast radius block handling, leaving the orchestrator unaware of which tasks corresponded to unaddressed files.
**Resolution**: `matchFilesToTasks()` cross-references unaddressed files against tasks.md, identifying task IDs, statuses, and discrepancies.
**Impact**: The orchestrator now provides actionable task-level guidance during re-delegation.

### TD-RESOLVED-03: No Orchestrator Guardrails

**Previous state**: `00-sdlc-orchestrator.md` had zero mentions of blast radius, deferral, or impact-analysis immutability. LLM agents defaulted to path of least resistance.
**Resolution**: Section 8.1 adds 5 explicit guardrail rules with MUST/MUST NOT constraints.
**Impact**: Agents now have clear prohibitions against modifying impact-analysis.md or auto-generating deferrals.

## 2. Technical Debt Introduced (New)

### TD-NEW-01: No `resetBlastRadiusRetries()` Helper (Low Priority)

**Location**: `blast-radius-step3f-helpers.cjs`
**Description**: When a workflow completes, `blast_radius_retries` and `blast_radius_retry_log` become stale in state.json. They are implicitly cleared when the orchestrator finalize step moves the active workflow to `workflow_history` and clears `active_workflow`. However, there is no explicit helper to reset these fields, which could cause confusion if a future maintainer accesses them between workflows.
**Risk**: Low -- the fields are workflow-scoped and become irrelevant when the workflow ends.
**Remediation cost**: Trivial (5-line function + 1 test).
**Recommendation**: Defer. Consider adding during the next state management cleanup.

### TD-NEW-02: Blast Radius Validator Deferral Source Not Verified (Out of Scope per FR-04)

**Location**: `blast-radius-validator.cjs` (unchanged)
**Description**: The validator currently accepts any file listed in `blast-radius-coverage.md` with a "deferred" status, regardless of whether that deferral appears in `requirements-spec.md`. The fix addresses this at the STEP 3f level by validating deferrals against requirements-spec.md before the validator runs, but the validator itself does not perform this check.
**Risk**: Low-Medium -- an agent that writes directly to blast-radius-coverage.md (bypassing STEP 3f) could still circumvent validation. However, the orchestrator guardrails and STEP 3f prohibitions make this unlikely.
**Remediation cost**: Medium (requires changes to blast-radius-validator.cjs which was explicitly out of scope for this fix per requirements-spec.md Section "Out of Scope").
**Recommendation**: Track as a future enhancement (Batch F or later). The current fix addresses the symptom at the orchestrator level; the validator-level fix is defense-in-depth.

## 3. Pre-Existing Technical Debt (Observed, Not Introduced)

### TD-PRE-01: No Linter Configured

**Impact**: Cannot run automated style checks. Manual review required for each change.
**Status**: Known. Tracked separately.

### TD-PRE-02: No Code Coverage Tool Configured

**Impact**: Cannot measure line/branch coverage automatically. Requirements-level coverage analysis used instead.
**Status**: Known. Tracked separately.

### TD-PRE-03: 4 Pre-Existing Test Failures

**Tests**: TC-E09 (agent count in README), T43 (template drift), TC-13-01 (agent file count), supervised_review (gate-blocker test)
**Impact**: Low -- all are drift-related, not functionality bugs.
**Status**: Known and documented in Phase 16 quality reports.

## 4. Summary

| Category | Count | Details |
|----------|-------|---------|
| Debt resolved | 3 | Generic hook handling, missing task integration, missing guardrails |
| Debt introduced | 2 | No reset helper (trivial), validator deferral source (deferred) |
| Pre-existing debt | 3 | No linter, no coverage tool, test drift |
| **Net debt change** | **-1** | Resolved more than introduced |
