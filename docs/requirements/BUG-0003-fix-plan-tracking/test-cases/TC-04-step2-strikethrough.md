# TC-04: STEP 2 Strikethrough Instructions Present

**Test ID:** TC-04
**Category:** Structural validation
**Fix Requirement:** FIX-002
**Acceptance Criteria:** AC-2

---

## Objective

Verify that STEP 2 in `isdlc.md` contains explicit instructions to mark Phase 01's task with strikethrough formatting after it completes during init.

## Preconditions

- `src/claude/commands/isdlc.md` exists

## Test Steps

1. Read `isdlc.md` and locate the STEP 2 section
2. Search for strikethrough-related instructions (pattern: `~~`)
3. Verify the instructions reference Phase 01 completion and strikethrough subject update

## Expected Results

- STEP 2 contains `~~` (strikethrough marker) in its instructions
- STEP 2 mentions marking Phase 01 as completed with strikethrough
- The instruction includes both `status` to `completed` AND `subject` to `~~[1]...~~`

## Key Patterns to Verify

- `~~[1]` appears in STEP 2 text
- `strikethrough` keyword appears in STEP 2
- `completed` keyword appears near the strikethrough instruction
