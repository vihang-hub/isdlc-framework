# Validation Rules: REQ-0003 - Suggested Prompts

**Artifact ID:** REQ-0003-suggested-prompts
**Phase:** 04 - Design
**Created:** 2026-02-08
**Status:** Final

---

## 1. Overview

This document defines the validation rules that tests MUST enforce to verify correct implementation of the suggested prompts feature. Since the feature modifies only markdown files (not runtime code), validation focuses on structural format consistency, coverage completeness, and classification correctness.

---

## 2. Validation Rule Catalog

### VR-001: Section Presence (Coverage)

**Rule:** Every agent markdown file in `src/claude/agents/` MUST contain a `# SUGGESTED PROMPTS` section.

**Scope:** All 36 agent files (15 phase agents + 1 quick scan + 3 sub-orchestrators + 17 sub-agents)

**Validation method:**
1. Glob for all `.md` files in `src/claude/agents/` and subdirectories
2. Exclude non-agent files (if any)
3. For each file, search for the string `# SUGGESTED PROMPTS`
4. Assert: all 36 files contain the section

**Files expected:**

| Category | Count | Files |
|----------|-------|-------|
| Phase agents | 15 | 01 through 14 + quick-scan-agent |
| Sub-orchestrators | 3 | impact-analysis-orchestrator, tracing-orchestrator, discover-orchestrator |
| Sub-agents | 17 | 11 discover/*, 3 impact-analysis/*, 3 tracing/* |
| Orchestrator | 1 | 00-sdlc-orchestrator (has PROMPT EMISSION PROTOCOL instead) |
| **Total** | **36** | |

**Special case:** `00-sdlc-orchestrator.md` gets `# PROMPT EMISSION PROTOCOL` instead of `# SUGGESTED PROMPTS`. The validation must check for either heading in the orchestrator file.

**Traced to:** REQ-003, AC-005-01

---

### VR-002: Phase Agent Format Compliance

**Rule:** Every phase agent's SUGGESTED PROMPTS section MUST contain the canonical output format.

**Validation method:**
1. For each phase agent file (15 + 1 QS):
2. Find the `# SUGGESTED PROMPTS` section
3. Within that section, verify presence of:
   - `## Resolution Logic` subsection
   - `## Output Format` subsection
   - `## Fallback` subsection
   - The string `SUGGESTED NEXT STEPS:` within a code block
   - At least one `[1]`, `[2]`, `[3]` item reference

**Traced to:** REQ-005, AC-003-01

---

### VR-003: Sub-Agent Format Compliance

**Rule:** Every sub-agent's SUGGESTED PROMPTS section MUST contain the minimal STATUS format, NOT the full prompt block format.

**Validation method:**
1. For each sub-agent file (17 files):
2. Find the `# SUGGESTED PROMPTS` section
3. Assert: contains `STATUS:` pattern
4. Assert: does NOT contain `[1]`, `[2]`, `[3]` numbered items
5. Assert: does NOT contain `SUGGESTED NEXT STEPS:` string

**Traced to:** REQ-004, ADR-005

---

### VR-004: Sub-Orchestrator Format Compliance

**Rule:** Every sub-orchestrator's SUGGESTED PROMPTS section MUST contain the full prompt block format (same as phase agents), NOT the minimal STATUS format.

**Validation method:**
1. For each sub-orchestrator file (3 files):
2. Find the `# SUGGESTED PROMPTS` section
3. Assert: contains `SUGGESTED NEXT STEPS:` string
4. Assert: contains `[1]`, `[2]`, `[3]` item references
5. Assert: does NOT contain `STATUS:` as its output format

**Exception:** `discover-orchestrator.md` uses static prompts (no `## Resolution Logic` subsection) because it runs outside SDLC workflows.

**Traced to:** REQ-004, ADR-005

---

### VR-005: Orchestrator Emission Points

**Rule:** The SDLC orchestrator's `# PROMPT EMISSION PROTOCOL` section MUST define exactly 5 emission points.

**Validation method:**
1. Read `00-sdlc-orchestrator.md`
2. Find `# PROMPT EMISSION PROTOCOL` section
3. Count subsections: must find exactly 5 numbered emission points:
   - Workflow Initialization
   - Gate Passage
   - Gate Failure
   - Blocker/Escalation
   - Workflow Completion
4. Each emission point must include at least one prompt template

**Traced to:** REQ-004, ADR-006, AC-004-01, AC-004-02

---

### VR-006: ASCII-Only Content

**Rule:** All prompt text in SUGGESTED PROMPTS sections MUST contain only ASCII characters (no Unicode, no emoji, no box-drawing characters).

**Validation method:**
1. For each of the 36 agent files:
2. Extract the `# SUGGESTED PROMPTS` section content
3. Assert: all characters are in the ASCII range (0x00-0x7F)
4. Specifically reject: emoji, box-drawing characters, smart quotes, em-dashes

**Traced to:** NFR-005, ADR-004

---

### VR-007: No Hardcoded Phase Numbers in Dynamic Agents

**Rule:** Phase agents and sub-orchestrators that use dynamic resolution MUST NOT contain hardcoded phase numbers or phase names in their prompt output templates.

**Validation method:**
1. For each phase agent file (15 + 1 QS) and sub-orchestrator file (IA, Tracing):
2. Within the `# SUGGESTED PROMPTS` section:
3. Assert: the `[1]` primary prompt uses `{primary_prompt}` or `{display_name}` placeholder, NOT a literal like "Continue to Phase 03 - Design"
4. Allowed literals: "Show workflow status", "Start a new workflow", "Show project status", review-specific text

**Exception:** `discover-orchestrator.md` uses static prompts (allowed, per ADR-005).

**Traced to:** REQ-002, REQ-006, ADR-002, R-003

---

### VR-008: Prompt Tier Order

**Rule:** In every canonical prompt block template, `[1]` MUST be the primary action (workflow advancement), and the last `[N]` MUST be the utility action.

**Validation method:**
1. For each phase agent and sub-orchestrator:
2. Find the Output Format template
3. Assert: `[1]` line contains either a primary action variable or "Complete workflow"
4. Assert: last `[N]` line contains "Show workflow status" or "View project status"

**Traced to:** ADR-003, AC-003-02

---

### VR-009: Fallback Section Presence

**Rule:** Every phase agent and sub-orchestrator (except discover-orchestrator) MUST have a Fallback section.

**Validation method:**
1. For each phase agent (15 + 1 QS) and sub-orchestrator (IA, Tracing):
2. Within `# SUGGESTED PROMPTS` section:
3. Assert: contains "Fallback" subsection heading
4. Assert: fallback section includes "Show project status" and "Start a new workflow"

**Exception:** `discover-orchestrator.md` (static prompts, no active_workflow dependency)
**Exception:** Sub-agents (17 files) -- they use STATUS format, no fallback needed

**Traced to:** Architecture edge case 7.1, Article X

---

### VR-010: Agent 01 Interactive Exception

**Rule:** Agent 01 (requirements-analyst) MUST include an instruction to NOT emit prompts during interactive A/R/C menu pauses.

**Validation method:**
1. Read `01-requirements-analyst.md`
2. Within `# SUGGESTED PROMPTS` section:
3. Assert: contains text referencing "Do NOT emit" during "interactive" or "A/R/C" or "menu" pauses
4. Assert: contains text indicating prompts should only emit at final phase completion

**Traced to:** Architecture edge case 7.5, REQ-007

---

### VR-011: No State Schema Changes

**Rule:** The implementation MUST NOT add any new fields to state.json for prompt storage.

**Validation method:**
1. Diff the state.json schema before and after implementation
2. Assert: no new top-level keys added
3. Assert: no new keys within `active_workflow`
4. Assert: no new keys within `phases`

**Traced to:** NFR-006, Article XIV

---

### VR-012: Test Suite Regression

**Rule:** All existing tests MUST continue to pass after implementation.

**Validation method:**
1. Run `npm run test:all`
2. Assert: exit code 0
3. Assert: test count >= 596 (current baseline)

**Traced to:** NFR-001

---

### VR-013: No New Dependencies

**Rule:** No new npm dependencies MUST be added.

**Validation method:**
1. Compare `package.json` dependency counts before and after
2. Assert: `dependencies` count unchanged
3. Assert: `devDependencies` count unchanged (or only test-related additions)

**Traced to:** NFR-003

---

### VR-014: Section Placement Order

**Rule:** The `# SUGGESTED PROMPTS` section MUST appear AFTER `# SELF-VALIDATION` (when present) and BEFORE the closing motivational line (when present).

**Validation method:**
1. For each phase agent with both SELF-VALIDATION and a closing line:
2. Find line numbers of: `# SELF-VALIDATION`, `# SUGGESTED PROMPTS`, closing line
3. Assert: SELF-VALIDATION line < SUGGESTED PROMPTS line < closing line number

**Traced to:** Architecture Section 11.2 (Insertion Point Convention), ADR-001

---

## 3. Validation Priority

| Priority | Rules | Rationale |
|----------|-------|-----------|
| **Critical** | VR-001, VR-002, VR-003, VR-012 | Core functionality: presence, format, regression |
| **High** | VR-005, VR-007, VR-008, VR-011 | Correctness: emission points, dynamic resolution, state integrity |
| **Medium** | VR-004, VR-006, VR-009, VR-010 | Quality: sub-orchestrator format, ASCII, fallbacks, interactive exception |
| **Low** | VR-013, VR-014 | Hygiene: dependencies, section order |

---

## 4. Test Implementation Guidance

### 4.1 Test File Location

New validation tests should be placed at: `lib/prompt-format.test.js` (ESM)

### 4.2 Test Framework

Use existing `node:test` + `node:assert/strict` framework (no new dependencies).

### 4.3 Test Structure

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// VR-001: Section Presence
describe('Suggested Prompts: Section Presence', () => {
  it('all 36 agent files have SUGGESTED PROMPTS or PROMPT EMISSION PROTOCOL section', () => {
    // Glob agent files, check for section heading
  });
});

// VR-002: Phase Agent Format
describe('Suggested Prompts: Phase Agent Format', () => {
  it('phase agents contain Resolution Logic, Output Format, and Fallback subsections', () => {
    // Parse section, check for required subsections
  });
});

// VR-003: Sub-Agent Format
describe('Suggested Prompts: Sub-Agent Format', () => {
  it('sub-agents contain STATUS format, not SUGGESTED NEXT STEPS', () => {
    // Parse section, check for STATUS pattern, reject [N] items
  });
});

// ... additional tests per validation rules
```

### 4.4 File Classification Helper

Tests need to classify agent files into categories (phase agent, sub-orchestrator, sub-agent, orchestrator). A helper function should be used:

```javascript
function classifyAgentFile(filePath) {
  if (filePath.includes('00-sdlc-orchestrator')) return 'orchestrator';
  if (filePath.includes('impact-analysis-orchestrator')) return 'sub-orchestrator';
  if (filePath.includes('tracing-orchestrator')) return 'sub-orchestrator';
  if (filePath.includes('discover-orchestrator')) return 'sub-orchestrator';
  if (filePath.includes('discover/')) return 'sub-agent';
  if (filePath.includes('impact-analysis/')) return 'sub-agent';
  if (filePath.includes('tracing/')) return 'sub-agent';
  if (filePath.includes('quick-scan/')) return 'phase-agent';
  return 'phase-agent';
}
```

---

## 5. Traceability Matrix (Validation Rules -> Requirements)

| Validation Rule | Requirements | ADRs | NFRs | AC |
|-----------------|-------------|------|------|-----|
| VR-001 | REQ-003 | ADR-001 | NFR-002 | AC-005-01 |
| VR-002 | REQ-005 | ADR-003, ADR-004 | NFR-005 | AC-003-01 |
| VR-003 | REQ-004 | ADR-005 | NFR-002 | - |
| VR-004 | REQ-004 | ADR-005 | - | - |
| VR-005 | REQ-004 | ADR-006 | - | AC-004-01, AC-004-02 |
| VR-006 | - | ADR-004 | NFR-005 | - |
| VR-007 | REQ-002, REQ-006 | ADR-002 | - | AC-002-01 |
| VR-008 | REQ-001, REQ-003 | ADR-003 | - | AC-003-02 |
| VR-009 | - | ADR-001 | - | AC-005-03 |
| VR-010 | REQ-007 | - | - | AC-005-02 |
| VR-011 | - | - | NFR-006 | - |
| VR-012 | - | - | NFR-001 | - |
| VR-013 | - | - | NFR-003 | - |
| VR-014 | REQ-003 | ADR-001 | NFR-002 | AC-005-01 |
