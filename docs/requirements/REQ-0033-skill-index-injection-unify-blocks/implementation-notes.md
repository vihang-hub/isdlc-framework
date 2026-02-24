# Implementation Notes: REQ-0033 Skill Index Injection & Unify Blocks

**Requirement ID**: REQ-0033
**Artifact Folder**: REQ-0033-skill-index-injection-unify-blocks
**Phase**: 06-implementation
**Created**: 2026-02-23
**Status**: Complete

---

## Summary

Replaced two ambiguous curly-brace comment blocks in `src/claude/commands/isdlc.md` STEP 3d with imperative numbered instructions (SKILL INJECTION STEP A, B, C) and simplified reference placeholders inside the template literal.

Also updated `src/claude/hooks/tests/skill-injection.test.cjs` to align TC-09 assertions with the new instruction wording and added three new tests (TC-09.4, TC-09.5, TC-09.6).

---

## Files Modified

### 1. `src/claude/commands/isdlc.md`

**Change 1 -- Instruction Block Insertion**:
- Inserted the `agent_modifiers`, `Discovery context`, and `Skill injection` instruction blocks (Steps A, B, C) into the Phase-Loop Controller preamble section, between the protocol introduction and STEP 1.
- This positioning ensures the skill injection instructions are available for all phase delegation and appear before any "Use Task tool" template in the file, satisfying the test ordering constraints.

**Change 2 -- Template Literal Simplification**:
- Replaced the 21-line curly-brace blocks (old lines 1724-1744) with two short reference lines:
  - `{built_in_skills_block -- from SKILL INJECTION STEP A above, omit if empty}`
  - `{external_skills_blocks -- from SKILL INJECTION STEP B above, omit if empty}`

**Unchanged**:
- GATE REQUIREMENTS INJECTION block (CON-006)
- BUDGET DEGRADATION INJECTION block (CON-006)
- Phase-to-agent mapping table
- All other STEP 3d content

### 2. `src/claude/hooks/tests/skill-injection.test.cjs`

- **TC-09.1**: Updated assertion from `SKILL INDEX BLOCK` to `SKILL INJECTION STEP A` + function name checks
- **TC-09.2**: Updated `skillPos` to use `SKILL INJECTION STEP A` instead of `SKILL INDEX BLOCK`
- **TC-09.3**: Unchanged
- **TC-09.4**: New -- validates STEP B with external manifest reference
- **TC-09.5**: New -- validates fail-open language in both steps
- **TC-09.6**: New -- validates STEP C assembly instruction exists

---

## Design Deviation: Instruction Block Placement

The module design specified inserting the instruction block between line 1715 (Discovery context) and line 1717 (template literal opening). During implementation, this placement was found to be incompatible with the test suite's ordering assertions (TC-R33-04.1 and TC-R33-04.2), which require SKILL INJECTION STEP A/B to appear before the first "Use Task tool" occurrence in the file.

The first "Use Task tool" in the file is at STEP 1 (line ~1551 in the original file), which is structurally before STEP 3d. The instruction block was therefore placed in the Phase-Loop Controller preamble (between the protocol introduction and STEP 1) alongside the existing `agent_modifiers` and `Discovery context` paragraphs.

This placement is architecturally sound: the skill injection, workflow modifiers, and discovery context are all delegation-preparation steps that conceptually apply to the Phase-Loop Controller's delegation in STEP 3d.

---

## Test Results

| Test File | Tests | Pass | Fail |
|-----------|-------|------|------|
| `test-req-0033-skill-injection-wiring.test.cjs` | 34 | 34 | 0 |
| `skill-injection.test.cjs` | 43 | 43 | 0 |
| **Total** | **77** | **77** | **0** |

---

## Constitutional Compliance

| Article | Status | Evidence |
|---------|--------|----------|
| Article I (Specification Primacy) | PASS | Implementation follows module-design-step3d.md specification with one documented deviation (placement) |
| Article II (Test-First Development) | PASS | Tests were RED before implementation, GREEN after; 34 new tests + 3 new TC-09 tests |
| Article III (Security by Design) | PASS | No security-sensitive changes; fail-open semantics prevent information leakage |
| Article V (Simplicity First) | PASS | Minimal changes: 2 files modified, no new dependencies, no new hooks |
| Article VII (Artifact Traceability) | PASS | All changes trace to FR-001 through FR-006, documented in test-traceability-matrix.csv |
| Article IX (Quality Gate Integrity) | PASS | All 77 tests pass, CON-006 verified (GATE/BUDGET blocks intact) |
| Article X (Fail-Safe Defaults) | PASS | Every injection step has explicit fail-open error handling |

---

## Metadata

```json
{
  "phase": "06-implementation",
  "requirement_id": "REQ-0033",
  "artifact_folder": "REQ-0033-skill-index-injection-unify-blocks",
  "files_modified": ["src/claude/commands/isdlc.md", "src/claude/hooks/tests/skill-injection.test.cjs"],
  "test_count": 77,
  "all_tests_passing": true,
  "constitutional_compliance": "pass",
  "debate_rounds_used": 0,
  "fan_out_chunks": 0
}
```
