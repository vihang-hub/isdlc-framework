# TC-05: STEP 3e Strikethrough Instructions Present

**Test ID:** TC-05
**Category:** Structural validation
**Fix Requirement:** FIX-002
**Acceptance Criteria:** AC-3

---

## Objective

Verify that STEP 3e in `isdlc.md` contains explicit instructions to mark completed phase tasks with strikethrough formatting.

## Preconditions

- `src/claude/commands/isdlc.md` exists

## Test Steps

1. Read `isdlc.md` and locate the STEP 3 section (specifically 3e)
2. Search for strikethrough-related instructions (pattern: `~~`)
3. Verify the instructions describe wrapping the subject in `~~` on gate pass

## Expected Results

- STEP 3e contains `~~` (strikethrough marker)
- STEP 3e describes updating both `status` and `subject` on task completion
- The instruction wraps the original `[N] subject` in `~~`

## Key Patterns to Verify

- `~~[N]` or `~~` appears in STEP 3e text
- `strikethrough` keyword appears
- `completed` keyword appears near the strikethrough instruction
- Reference to wrapping the subject (not just setting status)
