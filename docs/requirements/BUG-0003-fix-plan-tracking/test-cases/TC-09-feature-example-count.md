# TC-09: Feature Workflow Example Correct Phase Count

**Test ID:** TC-09
**Category:** Example validation
**Fix Requirement:** FIX-001
**Acceptance Criteria:** AC-1

---

## Objective

Verify that the feature workflow TaskCreate example in the orchestrator has the correct number of tasks matching the `workflows.json` feature definition.

## Preconditions

- `src/isdlc/config/workflows.json` exists
- `src/claude/agents/00-sdlc-orchestrator.md` exists

## Test Steps

1. Parse `workflows.json` and count `workflows.feature.phases.length`
2. Locate the "### Example: Feature Workflow" section in the orchestrator
3. Count the number of `TaskCreate:` lines in the example
4. Assert the counts match

## Expected Results

- The feature workflow example shows exactly 11 TaskCreate lines (matching the 11 phases in `workflows.json` feature definition)
- All phase names in the example correspond to valid workflow phases

## Key Patterns to Verify

- Count of `TaskCreate:` lines in the feature example section
- `00-quick-scan` (or "Quick scan") appears in the example
- `02-impact-analysis` (or "Analyze impact") appears in the example
