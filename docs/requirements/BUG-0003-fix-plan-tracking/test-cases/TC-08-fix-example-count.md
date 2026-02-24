# TC-08: Fix Workflow Example Correct Phase Count

**Test ID:** TC-08
**Category:** Example validation
**Fix Requirement:** FIX-001
**Acceptance Criteria:** AC-1
**Root Cause:** RC2 (Orchestrator fix example showed wrong phase count)

---

## Objective

Verify that the fix workflow TaskCreate example in the orchestrator has the correct number of tasks matching the `workflows.json` fix definition.

## Preconditions

- `src/isdlc/config/workflows.json` exists
- `src/claude/agents/00-sdlc-orchestrator.md` exists

## Test Steps

1. Parse `workflows.json` and count `workflows.fix.phases.length`
2. Locate the "### Example: Fix Workflow" section in the orchestrator
3. Count the number of `TaskCreate:` lines in the example
4. Assert the counts match

## Expected Results

- The fix workflow example shows exactly 8 TaskCreate lines (matching the 8 phases in `workflows.json` fix definition)
- Previously this was 6 lines (missing `02-tracing` and `05-test-strategy`)

## Key Patterns to Verify

- Count of `TaskCreate:` lines in the fix example section
- `02-tracing` (or "Trace bug root cause") appears in the example
- `05-test-strategy` (or "Design test strategy") appears in the example
