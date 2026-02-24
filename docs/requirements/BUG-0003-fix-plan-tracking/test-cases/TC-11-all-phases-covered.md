# TC-11: All workflows.json Phases Have Table Entries

**Test ID:** TC-11
**Category:** Completeness validation
**Fix Requirement:** FIX-001
**Acceptance Criteria:** AC-1

---

## Objective

Verify that EVERY unique phase key across ALL workflow definitions in `workflows.json` has a corresponding entry in both lookup tables (isdlc.md and orchestrator). This is a superset check that goes beyond individual workflow validation.

## Preconditions

- `src/isdlc/config/workflows.json` exists
- `src/claude/commands/isdlc.md` exists
- `src/claude/agents/00-sdlc-orchestrator.md` exists

## Test Steps

1. Parse `workflows.json` and collect ALL unique phase keys from ALL workflows (excluding reverse-engineer which uses R1-R4 prefixes)
2. Parse both lookup tables and collect their phase key sets
3. Compute the set difference: `workflows_keys - table_keys`
4. Assert the difference is empty (no missing keys)

## Expected Results

- Every phase key from every workflow definition has a table entry in both files
- The set difference is empty
- This ensures that if new workflows are added in the future, tests will catch missing table entries

## Implementation Notes

- Collect from: feature, fix, test-run, test-generate, full-lifecycle, upgrade
- Skip: reverse-engineer (uses non-standard R1-R4 phase keys)
- Expected unique keys: approximately 19 (some shared across workflows)
