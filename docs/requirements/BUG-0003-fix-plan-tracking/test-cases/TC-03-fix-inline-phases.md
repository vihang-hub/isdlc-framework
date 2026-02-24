# TC-03: Fix Workflow Inline Phases Match workflows.json

**Test ID:** TC-03
**Category:** Cross-reference validation
**Fix Requirement:** FIX-001
**Acceptance Criteria:** AC-1
**Root Cause:** RC3 (Hardcoded fix phases with old numbering in isdlc.md)

---

## Objective

Verify that the inline fix workflow phase array in `isdlc.md` (under the `fix` action section) uses the exact same phase keys as `workflows.json` fix definition.

## Preconditions

- `src/isdlc/config/workflows.json` exists
- `src/claude/commands/isdlc.md` exists

## Test Steps

1. Parse `workflows.json` and extract `workflows.fix.phases` array
2. Find the fix action section in `isdlc.md` and extract the inline phases array
3. Compare the two arrays for exact equality

## Expected Results

- The inline fix phases in isdlc.md exactly match the fix phases in workflows.json
- Specifically: `["01-requirements", "02-tracing", "05-test-strategy", "06-implementation", "11-local-testing", "07-testing", "10-cicd", "08-code-review"]`
- NOT the old numbering: `["01-requirements", "02-tracing", "04-test-strategy", "05-implementation", ...]`

## Implementation Notes

- Search for the JSON array literal containing `01-requirements` and `02-tracing` in the fix section
- Use regex to extract the array elements
- Compare element by element with workflows.json
