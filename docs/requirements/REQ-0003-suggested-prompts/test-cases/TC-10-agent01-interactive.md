# Test Cases: TC-10 - Agent 01 Interactive Exception

**Validation Rules:** VR-010
**Priority:** Medium
**Traced Requirements:** REQ-007, Architecture edge case 7.5, AC-005-02

---

## TC-10-01: Agent 01 has "Do NOT emit" instruction for interactive pauses

**Description:** The requirements analyst (Agent 01) must include explicit instruction to NOT emit prompt blocks during interactive A/R/C menu pauses.

**Preconditions:** Feature implementation complete.

**Steps:**
1. Read `src/claude/agents/01-requirements-analyst.md`
2. Extract `# SUGGESTED PROMPTS` section
3. Search for text matching the pattern:
   - Contains "Do NOT emit" (or "Do not emit")
   - AND contains at least one of: "interactive", "A/R/C", "menu", "pause"

**Expected Result:** Both conditions met.

**Rationale:** Agent 01 is the only agent with interactive pause points (A/R/C menus). If it emitted prompt blocks during these pauses, the user would see competing navigation options -- the A/R/C menu and the suggested prompts block simultaneously. This would be confusing.

---

## TC-10-02: Agent 01 specifies prompts only at final completion

**Description:** Agent 01 must include instruction to emit prompts only at the end of the phase (after all artifacts are saved).

**Steps:**
1. Read `src/claude/agents/01-requirements-analyst.md`
2. Extract `# SUGGESTED PROMPTS` section
3. Search for text indicating prompts should emit at phase completion:
   - Contains at least one of: "final", "end of the phase", "after all artifacts", "once"

**Expected Result:** Condition met.

**Rationale:** Per architecture edge case 7.5, Agent 01 goes through multiple interactive rounds (3 questions, A/R/C menus for each step, Save confirmation). Prompts should only appear at the very end, after the user has completed the interactive flow and all artifacts are written.
