# TC-01: Phase Key Alignment — isdlc.md STEP 2 Table

**Test ID:** TC-01
**Category:** Cross-reference validation
**Fix Requirement:** FIX-001
**Acceptance Criteria:** AC-1
**Root Cause:** RC1 (Phase key mismatch between workflows.json and isdlc.md)

---

## Objective

Verify that every phase key used in `workflows.json` has a corresponding entry in the STEP 2 lookup table in `isdlc.md`, and that the keys match exactly.

## Preconditions

- `src/isdlc/config/workflows.json` exists and is valid JSON
- `src/claude/commands/isdlc.md` exists

## Test Steps

1. Parse `workflows.json` and collect all unique phase keys across all workflow definitions
2. Parse the STEP 2 lookup table in `isdlc.md` (the table between `| Phase Key |` header and the next section)
3. Extract the phase key column from each table row
4. For each phase key in `workflows.json`, assert it exists in the isdlc.md table

## Expected Results

- Every phase key from every workflow in `workflows.json` has a matching entry in the isdlc.md STEP 2 table
- No phase key requires improvisation by the executing agent

## Test Data

Source of truth: `workflows.json` contains these phase keys across all workflows:
- `00-quick-scan`, `01-requirements`, `02-impact-analysis`, `02-tracing`
- `03-architecture`, `04-design`, `05-test-strategy`, `06-implementation`
- `07-testing`, `08-code-review`, `09-validation`, `10-cicd`
- `11-local-testing`, `12-remote-build`, `13-test-deploy`, `14-production`
- `15-operations`, `16-upgrade-plan`, `16-upgrade-execute`

## Implementation Notes

- Use regex to extract table rows: `/\|\s*`([^`]+)`\s*\|/g`
- Collect unique phase keys from all `workflows[].phases` arrays
- Skip reverse-engineer workflow (deprecated, uses R1-R4 prefixes)
