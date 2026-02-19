# Technical Debt Inventory

**Project:** iSDLC Framework
**Workflow:** BUG-0029-GH-18-multiline-bash-permission-bypass (fix)
**Phase:** 08 - Code Review & QA
**Date:** 2026-02-19

---

## 1. New Technical Debt Introduced

**None.** This fix introduces zero new technical debt. The changes are pure documentation/prose rewrites with no architectural shortcuts or deferred work items.

---

## 2. Technical Debt Resolved by BUG-0029

### TD-RESOLVED-001: Multiline Bash Blocks in Agent Prompts

- **Previous state**: 25 multiline Bash code blocks across 8 agent/command files caused Claude Code to generate multiline Bash tool calls that bypassed permission auto-allow rules
- **Current state**: All 25 blocks eliminated. Convention documented in CLAUDE.md and CLAUDE.md.template to prevent regression.
- **Impact**: Eliminated permission prompt interruptions during autonomous workflow execution

---

## 3. Pre-Existing Technical Debt (Unchanged)

### TD-PRE-001: Agent Inventory Count Drift

- **Severity**: Medium
- **Location**: `lib/prompt-format.test.js` (TC-E09, TC-13-01)
- **Description**: Tests expect 48 agent files but 60 exist. Agent count has grown without updating the test assertions.
- **Status**: Pre-existing, not introduced or resolved by BUG-0029.

### TD-PRE-002: Plan Tracking Task Cleanup Test

- **Severity**: Low
- **Location**: `lib/prompt-format.test.js` (TC-07)
- **Description**: Test expects specific task cleanup instructions in STEP 4 format that has drifted.
- **Status**: Pre-existing, not introduced or resolved by BUG-0029.

### TD-PRE-003: Supervised Review Timing-Sensitive Test

- **Severity**: Low
- **Location**: `src/claude/hooks/tests/test-gate-blocker-extended.test.cjs`
- **Description**: The `supervised_review` test (SM-04) is timing-sensitive and consistently fails.
- **Status**: Pre-existing, not introduced or resolved by BUG-0029.

### TD-PRE-004: No Automated Enforcement of Single-Line Bash Convention

- **Severity**: Low
- **Location**: Convention section in CLAUDE.md
- **Description**: The Single-Line Bash Convention is documented but not enforced by a lint rule or hook. Future agent file edits could reintroduce multiline Bash blocks. The requirements spec explicitly notes that "automated enforcement (e.g., a lint rule or hook that detects multiline Bash in .md files)" is out of scope for BUG-0029 and is a candidate for a future enhancement.
- **Resolution Path**: Create a post-write-edit hook or CI check that scans agent .md files for multiline Bash blocks.
- **Traces**: Requirements-spec.md Section 6 (Out of Scope)

### TD-PRE-005: `no_halfway_entry` Rule Exception Not Annotated in workflows.json

- **Severity**: Low
- **Location**: `src/isdlc/config/workflows.json`
- **Description**: The architecture document (Section 3.4) specifies adding a comment annotation for the build auto-detect exception. Not added during REQ-0026 implementation.
- **Status**: Pre-existing from REQ-0026, not related to BUG-0029.

---

## 4. Debt Summary

| Category | New | Resolved | Pre-Existing | Net |
|----------|-----|----------|-------------|-----|
| High severity | 0 | 0 | 0 | 0 |
| Medium severity | 0 | 0 | 1 | 1 |
| Low severity | 0 | 1 (TD-RESOLVED-001) | 4 | 4 |
| **Total** | **0** | **1** | **5** | **5** |

Net debt change: **-1** (resolved one item, introduced zero).
