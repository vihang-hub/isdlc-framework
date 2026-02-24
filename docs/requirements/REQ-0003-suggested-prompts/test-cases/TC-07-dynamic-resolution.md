# Test Cases: TC-07 - Dynamic Resolution

**Validation Rules:** VR-007
**Priority:** High
**Traced Requirements:** REQ-002, REQ-006, ADR-002, R-003

---

## TC-07-01: Phase agents use dynamic placeholders in [1] prompt

**Description:** Phase agents must NOT contain hardcoded phase numbers or names in their primary prompt template. They must use placeholders like `{primary_prompt}` or `{display_name}`.

**Preconditions:** Feature implementation complete.

**Steps:**
1. For each of the 16 phase agent files:
   - Extract `## Output Format` subsection from SUGGESTED PROMPTS
   - Find the `[1]` line
   - Assert: line contains a placeholder (curly-brace variable like `{primary_prompt}`, `{display_name}`, or `{next_phase_name}`)
   - Assert: line does NOT contain a literal like "Continue to Phase 03 - Design" or any "Phase NN" with a specific number

**Expected Result:** All 16 phase agents use placeholders, no hardcoded phase references.

**Allowed patterns in [1]:**
- `{primary_prompt}`
- `{display_name}`
- `{next_phase_name}`
- "Complete workflow and merge to main" (this is the last-phase case, not a hardcoded phase reference)

**Rejected patterns:**
- "Continue to Phase 03"
- "Continue to Phase 03 - Design"
- Any text matching `/Phase \d{2} - /` in the `[1]` output template

---

## TC-07-02: Dynamic sub-orchestrators use placeholders

**Description:** Impact Analysis and Tracing orchestrators (which have Resolution Logic) use dynamic placeholders in their primary prompt.

**Steps:**
1. For `impact-analysis-orchestrator.md` and `tracing-orchestrator.md`:
   - Extract `## Output Format` subsection
   - Find the `[1]` line
   - Assert: contains a placeholder variable, no hardcoded phase name

**Expected Result:** Both use dynamic placeholders.

---

## TC-07-03: Discover orchestrator uses static prompts (exception)

**Description:** The discover orchestrator is the documented exception -- it runs outside SDLC workflows and uses static text.

**Steps:**
1. Read `discover-orchestrator.md`
2. Extract `# SUGGESTED PROMPTS` section
3. Verify that static text like "Start a new feature" appears (allowed per ADR-005)

**Expected Result:** Static prompts present. No dynamic placeholders required.

**Rationale:** Discover orchestrator has no `active_workflow` to read, so static prompts are architecturally correct (ADR-005, VR-007 exception).
