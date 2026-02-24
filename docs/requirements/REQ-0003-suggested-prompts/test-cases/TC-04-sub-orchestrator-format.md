# Test Cases: TC-04 - Sub-Orchestrator Format Compliance

**Validation Rules:** VR-004
**Priority:** Medium
**Traced Requirements:** REQ-004, ADR-005

---

## TC-04-01: Sub-orchestrators have SUGGESTED NEXT STEPS

**Description:** All 3 sub-orchestrators use the full prompt format with `SUGGESTED NEXT STEPS:`.

**Preconditions:** Feature implementation complete.

**Steps:**
1. For each sub-orchestrator file (impact-analysis-orchestrator, tracing-orchestrator, discover-orchestrator):
   - Extract `# SUGGESTED PROMPTS` section content
   - Search for `SUGGESTED NEXT STEPS:` string

**Expected Result:** Found in all 3 sub-orchestrator files.

---

## TC-04-02: Sub-orchestrators have [1], [2], [3] items

**Description:** Sub-orchestrators provide user-facing navigation with numbered items.

**Steps:**
1. For each of the 3 sub-orchestrator files:
   - Extract `# SUGGESTED PROMPTS` section content
   - Search for `[1]`, `[2]`, `[3]` strings

**Expected Result:** All three item references found in all 3 files.

---

## TC-04-03: Sub-orchestrators do NOT use STATUS as output format

**Description:** Sub-orchestrators are user-facing and should use the full prompt block, not the minimal STATUS line.

**Steps:**
1. For each of the 3 sub-orchestrator files:
   - Extract the `## Output Format` subsection content
   - Check that the output format is `SUGGESTED NEXT STEPS:`, not `STATUS:`

**Expected Result:** Output format uses `SUGGESTED NEXT STEPS:` pattern in all 3 files.

**Clarification:** The word "STATUS" may appear elsewhere in the file (e.g., in descriptions). The check is specifically that the `## Output Format` subsection defines `SUGGESTED NEXT STEPS:` as the emitted format, NOT `STATUS:`.

---

## TC-04-04: Discover orchestrator uses static prompts

**Description:** The discover orchestrator runs outside SDLC workflows and uses static prompts with no dynamic phase resolution.

**Steps:**
1. Read `discover-orchestrator.md`
2. Extract `# SUGGESTED PROMPTS` section
3. Check for absence of `## Resolution Logic` subsection

**Expected Result:** `## Resolution Logic` NOT found in discover-orchestrator's SUGGESTED PROMPTS section.

**Rationale:** Per ADR-005 and the sub-orchestrator design, discover-orchestrator does not have an `active_workflow` to read, so its prompts are hardcoded static text.
