# TC-02: Phase Key Alignment — Orchestrator Task Definitions Table

**Test ID:** TC-02
**Category:** Cross-reference validation
**Fix Requirement:** FIX-001
**Acceptance Criteria:** AC-1
**Root Cause:** RC1 (Phase key mismatch between workflows.json and orchestrator)

---

## Objective

Verify that every phase key used in `workflows.json` has a corresponding entry in the Task Definitions table in `00-sdlc-orchestrator.md`.

## Preconditions

- `src/isdlc/config/workflows.json` exists and is valid JSON
- `src/claude/agents/00-sdlc-orchestrator.md` exists

## Test Steps

1. Parse `workflows.json` and collect all unique phase keys across all workflow definitions
2. Parse the Task Definitions table in `00-sdlc-orchestrator.md` (the table under "### Task Definitions by Workflow Phase")
3. Extract the phase key column from each table row
4. For each phase key in `workflows.json`, assert it exists in the orchestrator table

## Expected Results

- Every phase key from `workflows.json` has a matching entry in the orchestrator's Task Definitions table
- The orchestrator and isdlc.md tables contain the same set of phase keys

## Test Data

Same canonical phase keys as TC-01 (derived from `workflows.json`).

## Implementation Notes

- The orchestrator table may have identical structure to the isdlc.md table
- Both tables should have the exact same set of phase keys
