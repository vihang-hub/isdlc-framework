# Test Data Plan: BUG-0006 -- Phase-Loop State Ordering Fix

**Bug ID**: BUG-0006
**Date**: 2026-02-12

---

## 1. Overview

This fix modifies a markdown prompt file (`isdlc.md`), not executable code. Test data consists of:

1. **File paths**: The source and runtime copies of `isdlc.md` for content verification
2. **Regex patterns**: Used to verify instruction presence, absence, and ordering
3. **State.json fixtures**: For the existing hook tests (already defined in `phase-loop-controller.test.cjs`)

No new test data fixtures need to be created for external APIs, databases, or file-system-based tests. The prompt content tests read real files and apply pattern matching.

## 2. File Paths

| File | Purpose | Used By |
|------|---------|---------|
| `src/claude/commands/isdlc.md` | Source of truth for prompt instructions | All TC-01*, TC-02*, TC-03*, TC-04a |
| `.claude/commands/isdlc.md` | Runtime copy (must match source) | TC-04a |

## 3. Regex Patterns (Test Data for Content Verification)

### 3.1 STEP 3a-prime Detection

The test must locate the pre-delegation state write section. Patterns to match:

```
Pattern: /3a[-']?prime|PRE[-\s]?DELEGATION\s+STATE/i
Purpose: Detect the new step label
Used by: TC-01-EXIST
```

### 3.2 Field Presence in STEP 3a-prime

Each AC requires verifying a specific field is mentioned in the pre-delegation section:

| AC | Pattern (flexible) | Purpose |
|----|-------------------|---------|
| AC-01a | `phases.*status.*in_progress` | Phase status set |
| AC-01b | `phases.*started.*timestamp\|ISO` | Started timestamp (conditional) |
| AC-01c | `active_workflow.*current_phase.*phase_key\|phase key` | Current phase set |
| AC-01d | `phase_status.*in_progress` | Phase status map synced |
| AC-01e | `current_phase.*=.*phase` (top-level context) | Top-level phase set |
| AC-01f | `active_agent.*=.*agent\|PHASE_AGENT_MAP` | Agent set from map |

### 3.3 STEP 3e Removal Detection

For verifying that next-phase activation is removed from STEP 3e step 6:

```
Approach: Extract STEP 3e section text, then within the "if more phases remain" block,
verify ABSENCE of in_progress assignments for new_phase.

Boundary: The test must distinguish between:
- STEP 3e setting completed phase status = "completed" (SHOULD remain)
- STEP 3e setting next phase status = "in_progress" (SHOULD be removed)
```

### 3.4 Ordering Verification

```
Approach: Find character offsets of key markers:
  offset_3c = position of STEP 3c text (escalation handling)
  offset_pre = position of pre-delegation write text
  offset_3d = position of STEP 3d text (Task delegation)

Assert: offset_3c < offset_pre < offset_3d
```

## 4. State.json Fixtures (Existing -- No Changes)

The existing `phase-loop-controller.test.cjs` already defines these fixtures inline using `writeState()`:

| Fixture | Fields | Used By |
|---------|--------|---------|
| Status not set | `{ active_workflow: { current_phase: '06-implementation' }, phases: {} }` | T1 |
| Status pending | `{ ..., phases: { '06-implementation': { status: 'pending' } } }` | T2 |
| Status in_progress | `{ ..., phases: { '06-implementation': { status: 'in_progress' } } }` | T3 |
| Status completed | `{ ..., phases: { '06-implementation': { status: 'completed' } } }` | T4 |
| No active_workflow | `{}` | T7 |

These remain unchanged. No new fixtures are needed for the hook tests.

## 5. Test Data Generation Strategy

| Category | Strategy | Rationale |
|----------|----------|-----------|
| File content | Read real files at test time | Tests verify actual deployed content, not synthetic data |
| Regex patterns | Hardcoded in test file | Patterns are stable (based on requirements spec field names) |
| State.json | Inline fixtures via `writeState()` | Follows existing project pattern |

## 6. Data Sensitivity

No sensitive data is involved. The test data consists of:
- Public source code files (isdlc.md)
- Synthetic state.json fixtures with no real user data
- Regex patterns matching instruction text
