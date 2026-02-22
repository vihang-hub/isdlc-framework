# Technical Debt Inventory

**Project:** iSDLC Framework
**Workflow:** BUG-0028-agents-ignore-injected-gate-requirements (fix)
**Phase:** 08 - Code Review & QA
**Date:** 2026-02-22
**Updated by:** QA Engineer (Phase 08)

---

## 1. New Technical Debt (This Fix)

### TD-BUG28-001: Growth Budget Test Baseline Anomaly

**Severity**: Low
**Location**: `src/claude/hooks/tests/gate-requirements-injector.test.cjs` (Test 6, lines 1052-1082)
**Description**: The 40% growth budget test compares `formatBlock()` output without `isIntermediatePhase` (which defaults to `true`) against the same call with explicit `true`. Both produce identical output, so the "growth" is 0%. The test passes but does not actually measure old-format vs. new-format growth. Consider using a stored baseline character count instead.
**Impact**: Test intent is still valid (prevents future bloat), but does not validate the original NFR-001 assertion about growth from the pre-BUG-0028 format.

---

## 2. Resolved Technical Debt (This Fix)

### TD-BUG28-R01: Dead Cross-References in Agent Prompt Files (RESOLVED)

**Severity**: Medium
**Location**: `src/claude/agents/05-software-developer.md` (line 29), `src/claude/agents/16-quality-loop-engineer.md` (line 33)
**Description**: Both files contained `> See **Git Commit Prohibition** in CLAUDE.md.` -- a cross-reference to a section that DOES NOT EXIST in CLAUDE.md. This was the most impactful root cause (RC-2) of agents ignoring gate requirements: the agents followed the reference, found nothing, and proceeded without the constraint.
**Resolution**: Replaced dead cross-references with inline 3-line prohibition blocks that state the prohibition, the reason, and the consequence explicitly.
**Status**: RESOLVED. Verified by branch-guard.test.cjs T27-T31.

### TD-BUG28-R02: Missing Commit Prohibition in integration-tester Agent (RESOLVED)

**Severity**: Low
**Location**: `src/claude/agents/06-integration-tester.md`
**Description**: The integration-tester agent had no commit prohibition despite being an implementation-adjacent agent that runs tests (and might attempt to commit test results).
**Resolution**: Added inline 3-line prohibition block matching the pattern used by 07-qa-engineer.md.
**Status**: RESOLVED.

### TD-BUG28-R03: Weak Constraint Delivery in Gate Requirements Injection (RESOLVED)

**Severity**: Medium
**Location**: `src/claude/hooks/lib/gate-requirements-injector.cjs`
**Description**: The `formatBlock()` function produced an informational block (`GATE REQUIREMENTS FOR PHASE NN`) that agents treated as context rather than hard constraints. No imperative prohibitions, no primacy/recency bias reinforcement.
**Resolution**: Added `CRITICAL CONSTRAINTS` section at the top (primacy bias) and `REMINDER` footer at the bottom (recency bias) with imperative prohibition statements derived from phase configuration.
**Status**: RESOLVED. Verified by 18 new tests.

### TD-BUG28-R04: Unhelpful Hook Block Messages (RESOLVED)

**Severity**: Low
**Location**: `src/claude/hooks/branch-guard.cjs`
**Description**: When branch-guard blocked a commit, the message said "not allowed on the workflow branch during intermediate phases" without referencing the constraint the agent should have followed. Agents would sometimes retry the commit because the message did not explicitly say "Do NOT retry."
**Resolution**: Updated message to reference `CRITICAL CONSTRAINTS` block and added "Do NOT retry the commit -- it will be blocked again" as the first bullet in the "What to do instead" section.
**Status**: RESOLVED. Verified by branch-guard.test.cjs T24.

---

## 3. Pre-Existing Technical Debt (Unchanged)

### TD-PRE-001: Pre-Existing Test Failures (68 total)

**Severity**: Medium
**Description**: 68 tests fail in the full CJS hook suite, all pre-existing and unrelated to BUG-0028. These are in Jira sync tests (M4), backlog picker tests (M2a/M2b), workflow-finalizer tests (WF14-WF15), and state-json-pruning tests (T01-T14).

### TD-PRE-002: No Mutation Testing

**Severity**: Low
**Description**: No mutation testing framework configured.

### TD-PRE-003: No Native Coverage Reporting

**Severity**: Low
**Description**: Node.js `node:test` lacks native coverage reporting.

### TD-PRE-004: No Automated Linting

**Severity**: Medium (pre-existing)
**Description**: No ESLint or TypeScript configuration.

---

## 4. Technical Debt Ledger

| Category | Count | Details |
|----------|-------|---------|
| New debt items | 1 | TD-BUG28-001 (test baseline anomaly, low severity) |
| Resolved debt items | 4 | TD-BUG28-R01 through R04 |
| Pre-existing debt | 4 | TD-PRE-001 through TD-PRE-004 |
| Net change | -3 | Bug fix reduces technical debt |

---

## 5. Summary

This bug fix resolves 4 existing technical debt items (2 dead cross-references in agent files, weak constraint delivery in injection block, unhelpful hook block messages) and introduces 1 low-severity item (test baseline anomaly). The net effect is a reduction of 3 debt items. Pre-existing items remain unchanged and are tracked for future resolution.
