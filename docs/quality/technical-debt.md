# Technical Debt Inventory

**Project:** iSDLC Framework
**Workflow:** BUG-0029-GH-18-multiline-bash-permission-bypass (fix)
**Phase:** 08 - Code Review & QA
**Date:** 2026-02-20
**Updated by:** QA Engineer (Phase 08)

---

## 1. New Technical Debt (This Fix)

None. This bug fix is purely mechanical (reformatting multiline bash to single-line) and introduces no new technical debt.

---

## 2. Resolved Technical Debt (This Fix)

### TD-BUG29-001: Multiline Bash Blocks in Agent Prompt Files (RESOLVED)

**Severity**: Medium
**Location**: `src/claude/agents/discover/architecture-analyzer.md`, `src/claude/agents/quick-scan/quick-scan-agent.md`
**Description**: These 2 agent prompt files contained multiline Bash code blocks that bypass Claude Code's `*` glob permission matching rules. The `*` glob does not match newlines, so multiline bash commands in agent prompts trigger interactive permission prompts instead of being auto-allowed.
**Resolution**: Reformatted to single-line commands (architecture-analyzer: joined backslash-continuation to single line; quick-scan: split multi-command block into 4 separate single-line blocks).
**Status**: RESOLVED. Verified by 38 tests including codebase-wide sweep.

### TD-BUG29-002: Delegation-Gate Stale Markers (RESOLVED)

**Severity**: Medium
**Location**: `src/claude/hooks/delegation-gate.cjs`
**Description**: The delegation gate had no staleness check on `pending_delegation` markers. Cross-session markers (from a previous Claude Code conversation) would persist indefinitely and block all responses in new sessions.
**Resolution**: Added GH-62 staleness threshold (30 minutes). Markers older than 30 minutes are auto-cleared with a self-heal notification.
**Status**: RESOLVED. Verified by 35/35 delegation-gate tests passing with dynamic timestamps.

---

## 3. Pre-Existing Technical Debt (Unchanged)

### TD-PRE-001: 5 Pre-Existing Test Failures

**Severity**: Low
**Description**: 5 tests fail across the full suite, all pre-existing and unrelated to this fix:
1. **SM-04**: supervised_review log output (gate-blocker-extended) -- CJS
2. **TC-E09**: README.md agent count (48 expected vs actual)
3. **T07**: STEP 1 description mentions branch creation before Phase 01
4. **TC-07**: STEP 4 contains task cleanup instructions
5. **TC-13-01**: Exactly 48 agent markdown files exist (48 expected, 61 actual)

### TD-PRE-002: No Mutation Testing

**Severity**: Low
**Description**: No mutation testing framework (Stryker, etc.) is configured. Article XI requires mutation score >= 80%.

### TD-PRE-003: No Native Coverage Reporting

**Severity**: Low
**Description**: Node.js built-in `node:test` does not provide native coverage reporting. Coverage is estimated from test case analysis.

### TD-PRE-004: No Automated Linting

**Severity**: Medium (pre-existing)
**Location**: Project-wide
**Description**: No ESLint or TypeScript configuration. All static analysis is manual during code review.

---

## 4. Technical Debt Ledger

| Category | Count | Details |
|----------|-------|---------|
| New debt items | 0 | -- |
| Resolved debt items | 2 | TD-BUG29-001 (multiline bash), TD-BUG29-002 (stale markers) |
| Pre-existing debt | 4 | TD-PRE-001 through TD-PRE-004 |
| Net change | -2 | Bug fix reduces technical debt |

---

## 5. Summary

This bug fix introduces zero new technical debt and resolves 2 existing items (multiline bash violation in 2 agent files, and stale delegation markers across sessions). The overall debt trend is positive. Pre-existing items remain unchanged and are tracked for future resolution.
