# Test Cases: TC-05 - Orchestrator Emission Points

**Validation Rules:** VR-005
**Priority:** High
**Traced Requirements:** REQ-004, AC-004-01, AC-004-02, ADR-006

---

## TC-05-01: Orchestrator has PROMPT EMISSION PROTOCOL section

**Description:** The SDLC orchestrator file contains the `# PROMPT EMISSION PROTOCOL` section heading.

**Preconditions:** Feature implementation complete.

**Steps:**
1. Read `src/claude/agents/00-sdlc-orchestrator.md`
2. Search for `# PROMPT EMISSION PROTOCOL` (level-1 heading)

**Expected Result:** Heading found.

---

## TC-05-02: Orchestrator defines exactly 5 emission points

**Description:** The PROMPT EMISSION PROTOCOL section contains exactly 5 numbered subsections corresponding to the 5 lifecycle points.

**Steps:**
1. Extract content of `# PROMPT EMISSION PROTOCOL` section
2. Count `### ` (level-3) subsection headings that begin with a number (e.g., `### 1.`, `### 2.`, etc.)

**Expected Result:** Exactly 5 numbered subsections found.

---

## TC-05-03: Each emission point contains at least one [1] item

**Description:** Every emission point defines at least one prompt with the `[1]` prefix.

**Steps:**
1. For each of the 5 emission point subsections:
   - Search for `[1]` string within the subsection

**Expected Result:** `[1]` found in all 5 subsections.

---

## TC-05-04: All 5 lifecycle event names present

**Description:** The PROMPT EMISSION PROTOCOL section references all 5 lifecycle events by name.

**Steps:**
1. Extract content of `# PROMPT EMISSION PROTOCOL` section
2. Search for each keyword (case-insensitive):
   - "Workflow Initialization"
   - "Gate Passage" (or "Gate Pass")
   - "Gate Failure" (or "Gate Fail")
   - "Blocker" (or "Escalation")
   - "Workflow Completion" (or "Completion" or "Cancellation")

**Expected Result:** All 5 lifecycle events referenced.

**Rationale:** Per ADR-006, the orchestrator emits prompts at exactly these 5 lifecycle points. This test ensures no point is accidentally omitted.
