# Quick Scan: Wire Skill Index Block Injection + Unify Skill Injection

**Generated**: 2026-02-23T16:35:00Z
**Feature**: Wire SKILL INDEX BLOCK injection in isdlc.md phase delegation (#84) and unify built-in + external skill injection into single AVAILABLE SKILLS block (#85)
**Phase**: 00-quick-scan

---

## Scope Estimate

**Estimated Scope**: Medium
**File Count Estimate**: ~8-12 files
**Confidence**: High

---

## Keyword Matches

### Domain Keywords
| Keyword | File Matches | Context |
|---------|--------------|---------|
| skill | 15+ files | Skills manifest, injection code, tests, skill index functions |
| index | 8 files | getAgentSkillIndex(), skill index tests, skill index block spec |
| injection | 6 files | Skill injection tests, external skill management, common.cjs |
| delegation | 3 files | Phase delegation spec in isdlc.md, tests, common code |
| AVAILABLE SKILLS | 2 files | isdlc.md spec (STEP 3d comment), external skill manifest doc |

### Technical Keywords
| Keyword | File Matches | Context |
|---------|--------------|---------|
| getAgentSkillIndex() | 1 file | src/claude/hooks/lib/common.cjs (function definition) |
| formatSkillIndexBlock() | 1 file | src/claude/hooks/lib/common.cjs (function definition) |
| Task tool delegation | 1 file | isdlc.md (STEP 3d phase delegation prompt) |
| skills-manifest.json | 2 files | Config file + test setup |
| external-skills-manifest.json | 0 files | Does not exist yet (part of feature) |

---

## Key Findings

### 1. SKILL INDEX BLOCK Injection Code Exists But Unwired
- **Location**: `src/claude/hooks/lib/common.cjs` (lines 1262-1440)
- **Status**: Functions implemented and tested in `src/claude/hooks/tests/test-bug-0035-skill-index.test.cjs`
- **Problem**: isdlc.md STEP 3d (phase delegation) at line 1724 documents the injection as a comment/spec but does NOT actually call `getAgentSkillIndex()` and `formatSkillIndexBlock()` during Task tool delegation
- **Current spec location**: isdlc.md lines 1719-1744 define STEP 3d (DIRECT PHASE DELEGATION) with three separate injection blocks:
  - Line 1724: SKILL INDEX BLOCK (documented but unwired)
  - Line 1725: EXTERNAL SKILL INJECTION (documented but unwired)
  - Line 1745: GATE REQUIREMENTS INJECTION (documented but may be unwired)

### 2. Two Separate Skill Injection Blocks Need Unification
- **Current architecture**: isdlc.md STEP 3d has TWO separate skill injection mechanisms:
  1. Built-in SKILL INDEX BLOCK (getAgentSkillIndex + formatSkillIndexBlock)
  2. EXTERNAL SKILL INJECTION (reads external-skills-manifest.json and merges external skills)
- **Goal**: Merge these into a single "AVAILABLE SKILLS" block that combines both sources
- **External skills**: Infrastructure expects `docs/isdlc/external-skills-manifest.json` (monorepo: `docs/isdlc/projects/{project-id}/external-skills-manifest.json`)

### 3. Related Infrastructure Exists
- **Skills manifest**: `src/claude/hooks/config/skills-manifest.json` contains built-in skill ownership
- **Tests for skill injection**:
  - `src/claude/hooks/tests/skill-injection.test.cjs` (BUG-0011-GH-15)
  - `src/claude/hooks/tests/external-skill-management.test.cjs`
  - `src/claude/hooks/tests/test-bug-0035-skill-index.test.cjs` (BUG-0035-GH-81-82-83)
- **Phase delegation hook**: Post-phase hook likely needs to call the wiring code

---

## Affected File Categories

### Primary Implementation Files (5 files)
1. `src/claude/commands/isdlc.md` - STEP 3d phase delegation logic (primary change location)
2. `src/claude/hooks/lib/common.cjs` - getAgentSkillIndex/formatSkillIndexBlock functions (already exist, may need minor tweaks)
3. Possible new file: Skill injection consolidation helper (if unified block needs separate handler)
4. `src/claude/hooks/config/skills-manifest.json` - Ownership section (reference only)
5. `docs/isdlc/external-skills-manifest.json` - External skills config (may need creation/documentation)

### Test Files (4-5 files)
1. `src/claude/hooks/tests/skill-injection.test.cjs` - Unit tests for getAgentSkillIndex/formatSkillIndexBlock
2. `src/claude/hooks/tests/external-skill-management.test.cjs` - External skills integration
3. `src/claude/hooks/tests/test-bug-0035-skill-index.test.cjs` - BUG-0035 regression tests
4. Integration test (phase delegation + skill injection wired together)

### Supporting Files (2-3 files)
1. `.claude/hooks/config/skills-manifest.json` - Runtime copy (synced from src/)
2. `.claude/commands/isdlc.md` - Runtime copy (symlink from src/)
3. Possible: Update documentation on external skills format

---

## Technical Dependencies

- **Phase 01 isdlc.md**: Must understand delegation prompt construction in STEP 3d
- **Skills infrastructure**: Must integrate with existing getAgentSkillIndex/formatSkillIndexBlock
- **External skills format**: Must validate against external-skills-manifest schema (if exists)
- **Task tool**: Delegation uses Task tool with constructed prompt strings

---

## Notes for Requirements

The following questions will help clarify scope in Phase 01:

1. **Unified block design**: Should "AVAILABLE SKILLS" include:
   - Skill ID + Name + Description + Path (built-in style)?
   - Additional metadata from external skills manifest?
   - Separate subsections for built-in vs external, or fully merged?

2. **External skills manifest format**: What schema should external-skills-manifest.json follow?
   - Should it reuse skills-manifest.json structure?
   - What validation is required?

3. **Error handling**: If skill injection fails (missing manifest, corrupt JSON, etc.):
   - Should phase delegation fail, or be fail-open (continue without skills)?
   - Should warnings be logged?

4. **Backward compatibility**: Are there any existing external skills already deployed that we need to support?

5. **Monorepo support**: Should unified AVAILABLE SKILLS block work in both single-project and monorepo modes?

---

## Quick Scan Metadata

```json
{
  "scan_completed_at": "2026-02-23T16:35:00Z",
  "search_duration_ms": 45,
  "keywords_searched": 10,
  "files_matched": 25,
  "scope_estimate": "medium",
  "primary_impact_area": "Phase delegation orchestration (isdlc.md STEP 3d)",
  "secondary_areas": ["Skill index wiring", "External skill integration", "Unified block formatting"],
  "code_exists": true,
  "code_tested": true,
  "wiring_status": "incomplete"
}
```

---

## Phase Gate Validation

**GATE-00-QUICK-SCAN Requirements**:
- [x] Keywords extracted from feature description
- [x] Codebase search completed (within time limit)
- [x] Scope estimated (medium, ~8-12 files)
- [x] quick-scan.md generated in artifact folder
- [x] State.json updated with phase completion

