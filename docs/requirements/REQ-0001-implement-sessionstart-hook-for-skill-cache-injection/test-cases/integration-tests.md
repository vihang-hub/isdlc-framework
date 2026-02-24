# Integration Test Cases: Unified SessionStart Cache (REQ-0001)

**Phase**: 05-test-strategy
**Test Type**: Integration
**Framework**: node:test + node:assert/strict (CJS stream)
**File**: `src/claude/hooks/tests/test-session-cache-integration.test.cjs`

---

## 1. Cache Build + Hook Read Round-Trip

### TC-INT-01: Full round-trip -- build cache then read via hook (positive)
**Requirement**: FR-001 + FR-002
**Priority**: P0
**Given**: A test directory with all source files (constitution, workflows, manifest, skills, personas, topics)
**When**:
1. `rebuildSessionCache({ projectRoot: testDir })` is called
2. `inject-session-cache.cjs` is run via `runHook()` with `CLAUDE_PROJECT_DIR = testDir`
**Then**:
- Hook stdout contains the full cache content
- Hook stdout starts with `<!-- SESSION CACHE: Generated`
- Hook stdout contains all section delimiters that `result.sections` listed

### TC-INT-02: Round-trip with partial source files (positive)
**Requirement**: FR-001 + FR-002
**Priority**: P1
**Given**: A test directory with only constitution.md and workflows.json (no skills, no personas)
**When**:
1. `rebuildSessionCache({ projectRoot: testDir })` is called
2. Hook is run via `runHook()`
**Then**:
- Hook stdout contains CONSTITUTION and WORKFLOW_CONFIG sections
- Hook stdout contains SKIPPED markers for missing sections

### TC-INT-03: Round-trip preserves exact content (positive)
**Requirement**: FR-001 + FR-002
**Priority**: P0
**Given**: Test directory with known file contents
**When**:
1. Build cache
2. Read cache via hook
3. Compare hook stdout with direct `fs.readFileSync` of cache file
**Then**:
- Hook stdout byte-for-byte matches the cache file content

### TC-INT-04: Rebuild updates stale cache (positive)
**Requirement**: FR-001 + NFR-006
**Priority**: P1
**Given**: Test directory. Cache built once. Then a source file (constitution.md) is modified.
**When**: `rebuildSessionCache()` is called again
**Then**:
- New cache has different `Hash` than original
- New cache contains the updated constitution content
- Old cache file is overwritten

### TC-INT-05: Hook reads latest cache after rebuild (positive)
**Requirement**: FR-001 + FR-002 + FR-007
**Priority**: P1
**Given**: Cache built with version A of constitution. Then constitution modified and cache rebuilt.
**When**: Hook is run after the second build
**Then**:
- Hook stdout contains the version B constitution content (not version A)

---

## 2. Cache Build + Section Extraction

### TC-INT-06: Extract CONSTITUTION section via regex (positive)
**Requirement**: FR-005, AC-005-01
**Priority**: P0
**Given**: Cache file built with known constitution content "Test Article I"
**When**: Section is extracted using regex `<!-- SECTION: CONSTITUTION -->([\s\S]*?)<!-- \/SECTION: CONSTITUTION -->`
**Then**:
- Extracted content contains "Test Article I"

### TC-INT-07: Extract SKILL_INDEX agent block (positive)
**Requirement**: FR-005, AC-005-04
**Priority**: P0
**Given**: Cache file built with agent `test-agent` having skills
**When**: SKILL_INDEX section is extracted, then `## Agent: test-agent` block is located
**Then**:
- Block contains the test agent's skill entries
- Block ends before the next `## Agent:` heading or section closing delimiter

### TC-INT-08: Extract ROUNDTABLE_CONTEXT persona block (positive)
**Requirement**: FR-006, AC-006-01
**Priority**: P1
**Given**: Cache file built with persona-business-analyst.md containing "BA content"
**When**: ROUNDTABLE_CONTEXT section is extracted, then `### Persona: Business Analyst` block is located
**Then**:
- Block contains "BA content"

### TC-INT-09: Section extraction returns null for missing section (negative)
**Requirement**: FR-005, AC-005-06
**Priority**: P1
**Given**: Cache file with CONSTITUTION section but WITHOUT EXTERNAL_SKILLS section (skipped)
**When**: Section extraction is attempted for EXTERNAL_SKILLS
**Then**:
- Returns null (section not found)

---

## 3. Installer/Updater Trigger Integration

### TC-INT-10: installer.js calls rebuildSessionCache after init (positive)
**Requirement**: FR-007, AC-007-05
**Priority**: P1
**Given**: A mock project directory. `installer.js` install function is called (or simulated).
**When**: Installation completes
**Then**:
- `.isdlc/session-cache.md` exists
- Cache contains expected sections

### TC-INT-11: Cache rebuild failure does not block installation (negative)
**Requirement**: FR-007, Error TRIGGER-001
**Priority**: P1
**Given**: A project where `rebuildSessionCache()` will fail (e.g., mock that throws)
**When**: Installation is attempted
**Then**:
- Installation succeeds (exit code 0)
- Warning is logged about cache rebuild failure

### TC-INT-12: Cache rebuilt after `isdlc update` (positive)
**Requirement**: FR-007, AC-007-06
**Priority**: P2
**Given**: An existing project with a stale cache
**When**: Update operation completes
**Then**:
- Cache file has been regenerated (new timestamp in header)

---

## 4. Manifest Cleanup Consumer Verification

### TC-INT-13: skill-validator.cjs works without path_lookup (positive)
**Requirement**: FR-008, AC-008-03
**Priority**: P0
**Given**: skills-manifest.json without `path_lookup` and `skill_paths` fields
**When**: `skill-validator.cjs` check() is called with a valid skill usage context
**Then**:
- Returns a valid decision (not a crash)
- Skill validation logic works correctly

### TC-INT-14: log-skill-usage.cjs works without path_lookup (positive)
**Requirement**: FR-008, AC-008-03
**Priority**: P1
**Given**: skills-manifest.json without `path_lookup` and `skill_paths` fields
**When**: `log-skill-usage.cjs` check() is called
**Then**:
- Skill usage is logged correctly
- No runtime errors from missing fields

### TC-INT-15: getAgentSkillIndex + rebuildSessionCache end-to-end without path_lookup (positive)
**Requirement**: FR-008, AC-008-03
**Priority**: P0
**Given**: skills-manifest.json without `path_lookup`, SKILL.md files on disk
**When**: `rebuildSessionCache()` calls `getAgentSkillIndex()` internally
**Then**:
- SKILL_INDEX section is populated with agent blocks
- No errors during cache build

---

## 5. External Manifest Source Field Integration

### TC-INT-16: Source field persists through cache build cycle (positive)
**Requirement**: FR-009, AC-009-01
**Priority**: P1
**Given**: External manifest with entries `{ "name": "skill-a", "source": "discover" }` and `{ "name": "skill-b", "source": "user" }`
**When**: `rebuildSessionCache()` is called
**Then**:
- EXTERNAL_SKILLS section contains `Source: discover` for skill-a
- EXTERNAL_SKILLS section contains `Source: user` for skill-b

### TC-INT-17: Mixed source/no-source entries handled correctly (positive)
**Requirement**: FR-009, AC-009-04
**Priority**: P1
**Given**: External manifest with one entry having `"source": "discover"` and another with no `source` field
**When**: `rebuildSessionCache()` is called
**Then**:
- First entry: `Source: discover`
- Second entry: `Source: unknown`

### TC-INT-18: Empty external manifest produces skipped section (negative)
**Requirement**: FR-009
**Priority**: P2
**Given**: External manifest with `{ "skills": [] }`
**When**: `rebuildSessionCache()` is called
**Then**:
- EXTERNAL_SKILLS section is either skipped or contains empty content
