# Consumer and Trigger Test Cases: Unified SessionStart Cache (REQ-0001)

**Phase**: 05-test-strategy
**Test Type**: Unit + Integration (mixed)
**Framework**: node:test + node:assert/strict (CJS stream)

---

## 1. Phase-Loop Controller Consumer Tests (FR-005)

These tests verify that consumers can extract cached content from section delimiters.
Since the phase-loop controller is in isdlc.md (Markdown, consumed by the LLM), these
tests validate the section extraction utility function pattern that consumers use.

### TC-CONS-01: CONSTITUTION section extractable from cache (positive)
**Requirement**: FR-005, AC-005-01
**Priority**: P0
**Given**: Cache content with `<!-- SECTION: CONSTITUTION -->{content}<!-- /SECTION: CONSTITUTION -->`
**When**: `extractSection(cacheContent, "CONSTITUTION")` is called
**Then**:
- Returns the content between delimiters

### TC-CONS-02: WORKFLOW_CONFIG section extractable (positive)
**Requirement**: FR-005, AC-005-02
**Priority**: P0
**Given**: Cache content with WORKFLOW_CONFIG section containing `{"feature":{"phases":["01"]}}`
**When**: `extractSection(cacheContent, "WORKFLOW_CONFIG")` is called
**Then**:
- Returns valid JSON that parses successfully
- Parsed JSON contains `feature.phases`

### TC-CONS-03: ITERATION_REQUIREMENTS section extractable (positive)
**Requirement**: FR-005, AC-005-03
**Priority**: P1
**Given**: Cache content with ITERATION_REQUIREMENTS section
**When**: `extractSection(cacheContent, "ITERATION_REQUIREMENTS")` is called
**Then**:
- Returns valid JSON

### TC-CONS-04: SKILL_INDEX section -- agent block extractable (positive)
**Requirement**: FR-005, AC-005-04
**Priority**: P0
**Given**: Cache content with SKILL_INDEX section containing `## Agent: test-agent` block
**When**: Agent block is extracted from the SKILL_INDEX section using string search for `## Agent: test-agent`
**Then**:
- Extracted block contains skill entries for test-agent
- Block does not include skills from other agents

### TC-CONS-05: EXTERNAL_SKILLS section extractable (positive)
**Requirement**: FR-005, AC-005-05
**Priority**: P1
**Given**: Cache content with EXTERNAL_SKILLS section containing skill entries
**When**: `extractSection(cacheContent, "EXTERNAL_SKILLS")` is called
**Then**:
- Returns formatted external skill blocks

### TC-CONS-06: Fail-open: missing section returns null (negative)
**Requirement**: FR-005, AC-005-06, NFR-005
**Priority**: P0
**Given**: Cache content that does NOT contain a WORKFLOW_CONFIG section (skipped)
**When**: `extractSection(cacheContent, "WORKFLOW_CONFIG")` is called
**Then**:
- Returns null
- Consumer should fall back to disk read

### TC-CONS-07: Fail-open: SKIPPED section returns null (negative)
**Requirement**: FR-005, AC-005-06
**Priority**: P1
**Given**: Cache content with `<!-- SECTION: CONSTITUTION SKIPPED: file not found -->`
**When**: `extractSection(cacheContent, "CONSTITUTION")` is called
**Then**:
- Returns null (SKIPPED marker is not a valid open/close pair)

---

## 2. Roundtable Consumer Tests (FR-006)

### TC-RT-01: ROUNDTABLE_CONTEXT persona extraction (positive)
**Requirement**: FR-006, AC-006-01
**Priority**: P0
**Given**: Cache with ROUNDTABLE_CONTEXT section containing `### Persona: Business Analyst\nBA content`
**When**: Persona content is extracted by searching for `### Persona: Business Analyst`
**Then**:
- Extracted content contains "BA content"

### TC-RT-02: ROUNDTABLE_CONTEXT topic extraction (positive)
**Requirement**: FR-006, AC-006-02
**Priority**: P0
**Given**: Cache with ROUNDTABLE_CONTEXT section containing `### Topic: architecture\nArch topic content`
**When**: Topic content is extracted by searching for `### Topic: architecture`
**Then**:
- Extracted content contains "Arch topic content"

### TC-RT-03: Fail-open: missing ROUNDTABLE_CONTEXT section (negative)
**Requirement**: FR-006, AC-006-03, NFR-005
**Priority**: P0
**Given**: Cache content without ROUNDTABLE_CONTEXT section
**When**: Section extraction is attempted
**Then**:
- Returns null
- Consumer should fall back to reading persona and topic files from disk

### TC-RT-04: Multiple personas and topics extractable independently (positive)
**Requirement**: FR-006, AC-006-01, AC-006-02
**Priority**: P1
**Given**: Cache with ROUNDTABLE_CONTEXT containing 3 personas and 3 topics
**When**: Each persona and topic is extracted
**Then**:
- All 3 persona blocks extractable with correct content
- All 3 topic blocks extractable with correct content
- No content cross-contamination between blocks

---

## 3. Trigger Integration Tests (FR-007)

### TC-TRIG-01: Cache rebuilt after /discover (positive)
**Requirement**: FR-007, AC-007-01
**Priority**: P1
**Given**: The cache rebuild instruction is present in discover.md or isdlc.md discover handler
**When**: `/discover` operation is simulated (source files updated, then `rebuildSessionCache()` called)
**Then**:
- Cache file is regenerated
- Cache reflects updated discovery results

### TC-TRIG-02: Cache rebuilt after skill add (positive)
**Requirement**: FR-007, AC-007-02
**Priority**: P1
**Given**: A project with existing cache. New skill SKILL.md added and manifest updated.
**When**: `rebuildSessionCache()` is called (simulating post-skill-add trigger)
**Then**:
- SKILL_INDEX section includes the new skill
- EXTERNAL_SKILLS section updated if the skill is external

### TC-TRIG-03: Cache rebuilt after skill remove (positive)
**Requirement**: FR-007, AC-007-03
**Priority**: P1
**Given**: A project with cache containing skill X. Skill X removed from manifest and SKILL.md deleted.
**When**: `rebuildSessionCache()` is called (simulating post-skill-remove trigger)
**Then**:
- SKILL_INDEX section no longer contains skill X

### TC-TRIG-04: Cache rebuilt after skill wire (positive)
**Requirement**: FR-007, AC-007-04
**Priority**: P2
**Given**: A project with existing cache. Skill bindings updated.
**When**: `rebuildSessionCache()` is called (simulating post-skill-wire trigger)
**Then**:
- Cache reflects updated bindings

### TC-TRIG-05: Cache rebuilt after isdlc init (positive)
**Requirement**: FR-007, AC-007-05
**Priority**: P1
**Given**: A fresh project after `isdlc init` completes
**When**: The installation flow includes `rebuildSessionCache()` call
**Then**:
- `.isdlc/session-cache.md` exists
- Cache contains at minimum the CONSTITUTION section

### TC-TRIG-06: Cache rebuilt after isdlc update (positive)
**Requirement**: FR-007, AC-007-06
**Priority**: P2
**Given**: An existing project after `isdlc update` completes
**When**: The update flow includes `rebuildSessionCache()` call
**Then**:
- Cache is regenerated with updated framework content
- New cache hash differs from pre-update hash (if source files changed)
