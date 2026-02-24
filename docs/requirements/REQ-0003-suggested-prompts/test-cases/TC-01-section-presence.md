# Test Cases: TC-01 - Section Presence

**Validation Rules:** VR-001
**Priority:** Critical
**Traced Requirements:** REQ-003, AC-005-01

---

## TC-01-01: Agent file inventory is complete

**Description:** Verify that exactly 36 agent markdown files exist in `src/claude/agents/` and subdirectories.

**Preconditions:** Repository checked out on feature branch.

**Steps:**
1. Glob for `**/*.md` in `src/claude/agents/`
2. Count results

**Expected Result:** Exactly 36 files found.

**Verification Data:**
- 15 numbered phase agents (`01-*.md` through `14-*.md`)
- 1 orchestrator (`00-sdlc-orchestrator.md`)
- 1 quick-scan agent (`quick-scan/quick-scan-agent.md`)
- 1 discover orchestrator (`discover-orchestrator.md`)
- 11 discover sub-agents (`discover/*.md`)
- 3 impact-analysis agents (`impact-analysis/*.md`)
- 4 tracing agents (`tracing/*.md`)

---

## TC-01-02: All phase agents and QS have SUGGESTED PROMPTS section

**Description:** Every phase agent (15 numbered + 1 quick-scan) contains `# SUGGESTED PROMPTS`.

**Preconditions:** Feature implementation complete.

**Steps:**
1. For each of the 16 phase agent files:
   - Read file content
   - Search for `# SUGGESTED PROMPTS` heading (not `##`, exactly `# `)

**Expected Result:** All 16 files contain the heading.

**Failure Criteria:** Any phase agent missing the section fails the test.

---

## TC-01-03: All sub-agents have SUGGESTED PROMPTS section

**Description:** Every sub-agent (17 files) contains `# SUGGESTED PROMPTS`.

**Preconditions:** Feature implementation complete.

**Steps:**
1. For each of the 17 sub-agent files (11 discover + 3 impact-analysis + 3 tracing):
   - Read file content
   - Search for `# SUGGESTED PROMPTS` heading

**Expected Result:** All 17 files contain the heading.

---

## TC-01-04: Orchestrator has PROMPT EMISSION PROTOCOL section

**Description:** The SDLC orchestrator (`00-sdlc-orchestrator.md`) has `# PROMPT EMISSION PROTOCOL` instead of `# SUGGESTED PROMPTS`.

**Preconditions:** Feature implementation complete.

**Steps:**
1. Read `src/claude/agents/00-sdlc-orchestrator.md`
2. Search for `# PROMPT EMISSION PROTOCOL` heading

**Expected Result:** Heading found.

**Additional check:** Orchestrator should NOT also have `# SUGGESTED PROMPTS` (it uses the alternate heading per VR-001).
