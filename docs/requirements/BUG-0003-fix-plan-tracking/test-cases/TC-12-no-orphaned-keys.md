# TC-12: No Stale/Orphaned Phase Keys in Tables

**Test ID:** TC-12
**Category:** Hygiene validation
**Fix Requirement:** FIX-001
**Acceptance Criteria:** AC-1

---

## Objective

Verify that there are no stale or orphaned phase keys in the lookup tables that do not appear in any workflow definition. This catches the reverse of TC-11 -- entries that exist in the table but are no longer used by any workflow.

## Preconditions

- `src/isdlc/config/workflows.json` exists
- `src/claude/commands/isdlc.md` exists
- `src/claude/agents/00-sdlc-orchestrator.md` exists

## Test Steps

1. Parse `workflows.json` and collect ALL unique phase keys from ALL workflows (excluding reverse-engineer)
2. Parse both lookup tables and collect their phase key sets
3. Compute the set difference: `table_keys - workflows_keys`
4. Assert the difference is empty (no orphaned keys)

## Expected Results

- No table entry references a phase key that does not exist in any workflow
- This prevents old phase keys (like the pre-fix `04-test-strategy`, `05-implementation`) from lingering in the tables

## Implementation Notes

- This is the complement of TC-11
- Both checks together ensure the tables are a perfect mirror of workflows.json
- Together TC-11 and TC-12 guarantee bidirectional consistency
