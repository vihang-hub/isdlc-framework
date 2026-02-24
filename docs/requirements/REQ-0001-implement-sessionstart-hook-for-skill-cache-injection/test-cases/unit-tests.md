# Unit Test Cases: Unified SessionStart Cache (REQ-0001)

**Phase**: 05-test-strategy
**Test Type**: Unit
**Framework**: node:test + node:assert/strict (CJS stream)

---

## 1. rebuildSessionCache() -- test-session-cache-builder.test.cjs

### TC-BUILD-01: Produces valid cache file with all sections (positive)
**Requirement**: FR-001, AC-001-01
**Priority**: P0
**Given**: A test directory with `.isdlc/`, valid `constitution.md`, `workflows.json`, `iteration-requirements.json`, `artifact-paths.json`, `skills-manifest.json`, 3 mock SKILL.md files, 3 persona files, 2 topic files
**When**: `rebuildSessionCache({ projectRoot: testDir })` is called
**Then**:
- Returns an object with `path`, `size`, `hash`, `sections`, `skipped` properties
- `result.path` ends with `.isdlc/session-cache.md`
- `result.size` > 0
- `result.sections` contains `CONSTITUTION`, `WORKFLOW_CONFIG`, `ITERATION_REQUIREMENTS`, `ARTIFACT_PATHS`, `SKILLS_MANIFEST`, `SKILL_INDEX`, `EXTERNAL_SKILLS` or `ROUNDTABLE_CONTEXT`
- The file `.isdlc/session-cache.md` exists on disk
- File content matches `result.size`

### TC-BUILD-02: Cache file contains all 8 section delimiters (positive)
**Requirement**: FR-001, AC-001-02, NFR-007
**Priority**: P0
**Given**: A test directory with all source files present
**When**: `rebuildSessionCache({ projectRoot: testDir })` is called
**Then**:
- Cache file contains `<!-- SECTION: CONSTITUTION -->` and `<!-- /SECTION: CONSTITUTION -->`
- Cache file contains `<!-- SECTION: WORKFLOW_CONFIG -->` and `<!-- /SECTION: WORKFLOW_CONFIG -->`
- Cache file contains `<!-- SECTION: ITERATION_REQUIREMENTS -->` and `<!-- /SECTION: ITERATION_REQUIREMENTS -->`
- Cache file contains `<!-- SECTION: ARTIFACT_PATHS -->` and `<!-- /SECTION: ARTIFACT_PATHS -->`
- Cache file contains `<!-- SECTION: SKILLS_MANIFEST -->` and `<!-- /SECTION: SKILLS_MANIFEST -->`
- Cache file contains `<!-- SECTION: SKILL_INDEX -->` and `<!-- /SECTION: SKILL_INDEX -->`
- Cache file contains `<!-- SECTION: EXTERNAL_SKILLS -->` or `<!-- SECTION: EXTERNAL_SKILLS SKIPPED: ... -->`
- Cache file contains `<!-- SECTION: ROUNDTABLE_CONTEXT -->` and `<!-- /SECTION: ROUNDTABLE_CONTEXT -->`

### TC-BUILD-03: Cache header contains timestamp, source count, and hash (positive)
**Requirement**: FR-001, AC-001-03, NFR-006
**Priority**: P0
**Given**: A test directory with source files present
**When**: `rebuildSessionCache({ projectRoot: testDir })` is called
**Then**:
- First line of cache file matches regex `<!-- SESSION CACHE: Generated .+ \| Sources: \d+ \| Hash: [0-9a-f]{8} -->`
- `Generated` field is a valid ISO-8601 timestamp
- `Sources` count matches `result.hash` and source file count
- `Hash` is an 8-character hex string matching `result.hash`

### TC-BUILD-04: Missing source files produce SKIPPED markers (positive)
**Requirement**: FR-001, AC-001-04
**Priority**: P0
**Given**: A test directory with `.isdlc/` but NO `constitution.md`, NO `workflows.json`, NO persona files
**When**: `rebuildSessionCache({ projectRoot: testDir })` is called
**Then**:
- Function does NOT throw
- `result.skipped` contains `CONSTITUTION`, `WORKFLOW_CONFIG`
- Cache file contains `<!-- SECTION: CONSTITUTION SKIPPED: ... -->` (with reason)
- Cache file still contains valid delimiters for sections that ARE present (e.g., `ARTIFACT_PATHS` if present)

### TC-BUILD-05: Missing .isdlc/ directory throws (negative)
**Requirement**: FR-001, Error CACHE-001
**Priority**: P0
**Given**: A test directory WITHOUT `.isdlc/` subdirectory
**When**: `rebuildSessionCache({ projectRoot: testDir })` is called
**Then**:
- Throws an Error with message containing "No .isdlc/ directory"
- No cache file is written

### TC-BUILD-06: Constitution section contains raw file content (positive)
**Requirement**: FR-001, AC-001-01
**Priority**: P1
**Given**: A test directory with `docs/isdlc/constitution.md` containing "# Test Constitution\nArticle I"
**When**: `rebuildSessionCache({ projectRoot: testDir })` is called
**Then**:
- Content between `<!-- SECTION: CONSTITUTION -->` and `<!-- /SECTION: CONSTITUTION -->` contains "# Test Constitution" and "Article I"

### TC-BUILD-07: Workflow config section contains raw JSON (positive)
**Requirement**: FR-001, AC-001-01
**Priority**: P1
**Given**: A test directory with `src/isdlc/config/workflows.json` containing `{"feature":{"phases":["01"]}}`
**When**: `rebuildSessionCache({ projectRoot: testDir })` is called
**Then**:
- Content between WORKFLOW_CONFIG delimiters is the raw JSON string

### TC-BUILD-08: Skills manifest section excludes path_lookup and skill_paths (positive)
**Requirement**: FR-001, FR-008
**Priority**: P1
**Given**: A skills-manifest.json with `path_lookup`, `skill_paths`, and `ownership` fields
**When**: `rebuildSessionCache({ projectRoot: testDir })` is called
**Then**:
- Content between SKILLS_MANIFEST delimiters does NOT contain `"path_lookup"`
- Content between SKILLS_MANIFEST delimiters does NOT contain `"skill_paths"`
- Content between SKILLS_MANIFEST delimiters DOES contain `"ownership"`

### TC-BUILD-09: Skill index section contains per-agent blocks (positive)
**Requirement**: FR-001, AC-001-02
**Priority**: P1
**Given**: A test directory with 2 agents in manifest ownership, each with 2 skills, and matching SKILL.md files
**When**: `rebuildSessionCache({ projectRoot: testDir })` is called
**Then**:
- Content between SKILL_INDEX delimiters contains `## Agent: agent-one`
- Content between SKILL_INDEX delimiters contains `## Agent: agent-two`
- Each agent block contains skill IDs and descriptions

### TC-BUILD-10: All source files missing produces minimal valid cache (negative)
**Requirement**: FR-001, AC-001-04
**Priority**: P1
**Given**: A test directory with `.isdlc/` but no source files at all (no constitution, no workflows, no manifest, no skills, no personas, no topics)
**When**: `rebuildSessionCache({ projectRoot: testDir })` is called
**Then**:
- Function does NOT throw
- Cache file is written
- `result.sections` is empty or contains only successfully built sections
- `result.skipped` contains all section names
- Cache header is still present and valid

### TC-BUILD-11: Roundtable context includes persona files (positive)
**Requirement**: FR-001, AC-001-02
**Priority**: P1
**Given**: Test directory with `src/claude/agents/persona-business-analyst.md` containing "BA persona content"
**When**: `rebuildSessionCache({ projectRoot: testDir })` is called
**Then**:
- Content between ROUNDTABLE_CONTEXT delimiters contains `### Persona: Business Analyst`
- Content contains "BA persona content"

### TC-BUILD-12: Roundtable context includes topic files (positive)
**Requirement**: FR-001, AC-001-02
**Priority**: P1
**Given**: Test directory with `src/claude/skills/analysis-topics/architecture/architecture.md` containing "Architecture topic content"
**When**: `rebuildSessionCache({ projectRoot: testDir })` is called
**Then**:
- Content between ROUNDTABLE_CONTEXT delimiters contains `### Topic: architecture`
- Content contains "Architecture topic content"

### TC-BUILD-13: Size budget warning emitted when cache exceeds 128K (negative)
**Requirement**: FR-001, AC-001-05, NFR-009
**Priority**: P1
**Given**: Test directory with source files that produce a cache > 128000 characters (e.g., large constitution file of 130K chars)
**When**: `rebuildSessionCache({ projectRoot: testDir })` is called
**Then**:
- Function does NOT throw
- Cache file IS written (warning only, not fatal)
- `result.size` > 128000
- If verbose mode is on, a warning message is emitted

### TC-BUILD-14: Idempotent -- two calls produce identical output (positive)
**Requirement**: FR-001, Component spec idempotency
**Priority**: P2
**Given**: A test directory with static source files (mtimes not changed between calls)
**When**: `rebuildSessionCache()` is called twice in sequence
**Then**:
- Both calls produce the same `result.hash`
- Both cache files have identical content (except the `Generated` timestamp)

### TC-BUILD-15: External skills section with missing manifest (negative)
**Requirement**: FR-001, AC-001-04
**Priority**: P2
**Given**: A test directory without `docs/isdlc/external-skills-manifest.json`
**When**: `rebuildSessionCache({ projectRoot: testDir })` is called
**Then**:
- EXTERNAL_SKILLS section is skipped with a SKIPPED marker
- Other sections are still built normally

---

## 2. _buildSkillPathIndex() -- test-session-cache-builder.test.cjs

### TC-INDEX-01: Builds correct skill ID to path mapping (positive)
**Requirement**: FR-008 prerequisite, ADR-0028
**Priority**: P0
**Given**: Test directory with `src/claude/skills/dev/code-impl/SKILL.md` containing `skill_id: DEV-001` in frontmatter
**When**: `_buildSkillPathIndex()` is called (via test-only export)
**Then**:
- Returns a Map
- Map has entry `"DEV-001"` -> path ending in `src/claude/skills/dev/code-impl/SKILL.md`

### TC-INDEX-02: Scans both src/claude/skills/ and .claude/skills/ (positive)
**Requirement**: FR-008 prerequisite
**Priority**: P1
**Given**: Test directory with:
- `src/claude/skills/dev/code-impl/SKILL.md` (skill_id: DEV-001)
- `.claude/skills/testing/unit-test/SKILL.md` (skill_id: TEST-001)
**When**: `_buildSkillPathIndex()` is called
**Then**:
- Map contains both `DEV-001` and `TEST-001`
- `DEV-001` path starts with `src/claude/skills/`
- `TEST-001` path starts with `.claude/skills/`

### TC-INDEX-03: Returns empty Map when skills directories missing (negative)
**Requirement**: FR-008 prerequisite, Error INDEX-001
**Priority**: P0
**Given**: Test directory with no `src/claude/skills/` and no `.claude/skills/` directories
**When**: `_buildSkillPathIndex()` is called
**Then**:
- Returns an empty Map (size === 0)
- Does NOT throw

### TC-INDEX-04: Skips SKILL.md files without skill_id frontmatter (negative)
**Requirement**: FR-008 prerequisite, Error INDEX-002
**Priority**: P1
**Given**: Test directory with:
- `src/claude/skills/good/SKILL.md` containing `skill_id: GOOD-001`
- `src/claude/skills/bad/SKILL.md` containing NO `skill_id:` line
**When**: `_buildSkillPathIndex()` is called
**Then**:
- Map contains `GOOD-001`
- Map does NOT contain any entry for the bad skill
- Map size === 1

### TC-INDEX-05: First found wins (src takes precedence over .claude) (positive)
**Requirement**: FR-008 prerequisite
**Priority**: P1
**Given**: Test directory with:
- `src/claude/skills/dev/code-impl/SKILL.md` (skill_id: DEV-001) -> `src/...` path
- `.claude/skills/dev/code-impl/SKILL.md` (skill_id: DEV-001) -> `.claude/...` path
**When**: `_buildSkillPathIndex()` is called
**Then**:
- Map contains `DEV-001` exactly once
- Path starts with `src/claude/skills/` (dev takes precedence)

### TC-INDEX-06: Caching -- second call returns cached result (positive)
**Requirement**: FR-008 prerequisite, Component spec caching behavior
**Priority**: P1
**Given**: Test directory with skills. `_buildSkillPathIndex()` has been called once.
**When**: `_buildSkillPathIndex()` is called again without modifying the skills directory
**Then**:
- Returns the same Map instance (or equivalent)
- No additional directory scans (verified by timing or checking returned object identity)

### TC-INDEX-07: Cache invalidated when skills directory mtime changes (positive)
**Requirement**: FR-008 prerequisite
**Priority**: P2
**Given**: `_buildSkillPathIndex()` has been called once. Then a new SKILL.md is added and the skills directory mtime is touched.
**When**: `_buildSkillPathIndex()` is called again
**Then**:
- The new skill appears in the Map
- Map size increased by 1

### TC-INDEX-08: _resetCaches() clears skill path index (positive)
**Requirement**: FR-008 prerequisite
**Priority**: P2
**Given**: `_buildSkillPathIndex()` has been called and cached
**When**: `_resetCaches()` is called, then `_buildSkillPathIndex()` is called again
**Then**:
- A fresh directory scan is performed (new Map instance)

### TC-INDEX-09: Skips hidden directories (positive)
**Requirement**: FR-008 prerequisite
**Priority**: P2
**Given**: Test directory with `.hidden/SKILL.md` (skill_id: HIDDEN-001) inside skills dir
**When**: `_buildSkillPathIndex()` is called
**Then**:
- Map does NOT contain `HIDDEN-001`

### TC-INDEX-10: Skips node_modules directory (positive)
**Requirement**: FR-008 prerequisite
**Priority**: P2
**Given**: Test directory with `node_modules/SKILL.md` (skill_id: NM-001) inside skills dir
**When**: `_buildSkillPathIndex()` is called
**Then**:
- Map does NOT contain `NM-001`

### TC-INDEX-11: Skill ID format validation (positive)
**Requirement**: VR-040
**Priority**: P2
**Given**: Test directory with valid SKILL.md files containing IDs like DEV-001, TEST-002, REQ-003
**When**: `_buildSkillPathIndex()` is called
**Then**:
- All keys match pattern `^[A-Z]+-\d{3}$`

### TC-INDEX-12: Path traversal in skill paths is not possible (security, negative)
**Requirement**: Security
**Priority**: P1
**Given**: Test directory with a SKILL.md at a path containing `../` segments
**When**: `_buildSkillPathIndex()` is called
**Then**:
- Returned paths do not contain `../` or navigate outside project root

---

## 3. _collectSourceMtimes() -- test-session-cache-builder.test.cjs

### TC-MTIME-01: Collects mtimes from existing source files (positive)
**Requirement**: FR-001, NFR-006
**Priority**: P0
**Given**: Test directory with `docs/isdlc/constitution.md` and `src/isdlc/config/workflows.json`
**When**: `_collectSourceMtimes(testDir)` is called
**Then**:
- `result.sources` is an array with entries for both files
- Each entry has `path` (string) and `mtimeMs` (number)
- `result.count >= 2`
- `result.hash` is a non-empty string

### TC-MTIME-02: Skips missing files silently (negative)
**Requirement**: FR-001
**Priority**: P1
**Given**: Test directory with only `docs/isdlc/constitution.md` (no workflows.json, no manifest, etc.)
**When**: `_collectSourceMtimes(testDir)` is called
**Then**:
- `result.sources` contains only the constitution entry
- No errors thrown

### TC-MTIME-03: Hash is deterministic for same file state (positive)
**Requirement**: NFR-006
**Priority**: P1
**Given**: Test directory with fixed files and known mtimes (set via `fs.utimesSync`)
**When**: `_collectSourceMtimes(testDir)` is called twice
**Then**:
- Both calls return the same `result.hash`

### TC-MTIME-04: Hash changes when file mtime changes (positive)
**Requirement**: NFR-006
**Priority**: P1
**Given**: Test directory with files. First call returns `hash1`.
**When**: A source file's mtime is updated (via `fs.utimesSync`), then called again
**Then**:
- Second call returns `hash2` where `hash2 !== hash1`

### TC-MTIME-05: Sources array is sorted by path (positive)
**Requirement**: Component spec (sorted for hash determinism)
**Priority**: P2
**Given**: Test directory with multiple source files
**When**: `_collectSourceMtimes(testDir)` is called
**Then**:
- `result.sources` is sorted lexicographically by `.path`

### TC-MTIME-06: Hash is 8-character hex string (positive)
**Requirement**: VR-012
**Priority**: P1
**Given**: Test directory with source files
**When**: `_collectSourceMtimes(testDir)` is called
**Then**:
- `result.hash` matches pattern `^[0-9a-f]{8}$`

### TC-MTIME-07: Includes skill files via skill path index (positive)
**Requirement**: FR-001
**Priority**: P2
**Given**: Test directory with SKILL.md files in `src/claude/skills/`
**When**: `_collectSourceMtimes(testDir)` is called
**Then**:
- `result.sources` includes entries with paths containing `SKILL.md`

### TC-MTIME-08: Empty project returns zero count (negative)
**Requirement**: FR-001
**Priority**: P2
**Given**: Test directory with `.isdlc/` but no source files
**When**: `_collectSourceMtimes(testDir)` is called
**Then**:
- `result.count === 0` or very small
- `result.hash` is still a valid 8-char hex string

---

## 4. getAgentSkillIndex() refactor -- test-session-cache-builder.test.cjs

### TC-SKILL-01: Returns array of skill entries for known agent (positive)
**Requirement**: FR-008 prerequisite, VR-050
**Priority**: P0
**Given**: Test directory with skills-manifest.json containing agent `test-agent` with skills `["TEST-001", "TEST-002"]`, and corresponding SKILL.md files in `src/claude/skills/`
**When**: `getAgentSkillIndex("test-agent")` is called
**Then**:
- Returns array of length 2
- Each entry has `id`, `name`, `description`, `path` fields
- Entry IDs are `TEST-001` and `TEST-002`
- Paths end with `/SKILL.md`

### TC-SKILL-02: Returns empty array for unknown agent (negative)
**Requirement**: FR-008 prerequisite, VR-050
**Priority**: P0
**Given**: Test directory with skills-manifest.json containing agents but NOT `nonexistent-agent`
**When**: `getAgentSkillIndex("nonexistent-agent")` is called
**Then**:
- Returns empty array `[]`
- Does NOT throw

### TC-SKILL-03: Handles missing SKILL.md for listed skill ID (negative)
**Requirement**: FR-008 prerequisite
**Priority**: P1
**Given**: Test directory with manifest listing skill `MISS-001` for agent, but no corresponding SKILL.md on disk
**When**: `getAgentSkillIndex("agent-name")` is called
**Then**:
- Skill `MISS-001` is skipped
- Other skills for the agent are still returned
- Does NOT throw

### TC-SKILL-04: Does NOT use path_lookup field (positive)
**Requirement**: FR-008, AC-008-01, AC-008-02
**Priority**: P0
**Given**: Test directory with skills-manifest.json WITHOUT `path_lookup` and WITHOUT `skill_paths` fields, but WITH `ownership` and `skill_lookup`
**When**: `getAgentSkillIndex("test-agent")` is called
**Then**:
- Returns correct skill entries
- Proves the function works without path_lookup

### TC-SKILL-05: Skill entry id matches skill_id from SKILL.md frontmatter (positive)
**Requirement**: VR-051
**Priority**: P1
**Given**: SKILL.md with `skill_id: DEV-001` in frontmatter
**When**: `getAgentSkillIndex("agent-with-DEV-001")` is called
**Then**:
- Entry has `id: "DEV-001"`

### TC-SKILL-06: Skill entry name is derived from directory name (positive)
**Requirement**: VR-052
**Priority**: P1
**Given**: SKILL.md at path `src/claude/skills/development/code-implementation/SKILL.md`
**When**: `getAgentSkillIndex("agent-name")` is called
**Then**:
- Entry has `name: "code-implementation"`

### TC-SKILL-07: Skill entry description extracted from SKILL.md (positive)
**Requirement**: VR-053
**Priority**: P1
**Given**: SKILL.md containing `description: "Write production code"` in frontmatter
**When**: `getAgentSkillIndex("agent-name")` is called
**Then**:
- Entry has `description: "Write production code"` (or equivalent extracted description)

### TC-SKILL-08: Skill entry path is relative (positive)
**Requirement**: VR-054
**Priority**: P1
**Given**: SKILL.md at `src/claude/skills/dev/code/SKILL.md`
**When**: `getAgentSkillIndex("agent-name")` is called
**Then**:
- Entry `path` is a relative path (not absolute), ending with `/SKILL.md`

### TC-SKILL-09: Returns empty array when manifest missing (negative)
**Requirement**: FR-008 prerequisite
**Priority**: P1
**Given**: Test directory without skills-manifest.json
**When**: `getAgentSkillIndex("any-agent")` is called
**Then**:
- Returns empty array `[]`
- Does NOT throw

### TC-SKILL-10: formatSkillIndexBlock() produces expected format (positive)
**Requirement**: FR-001, AC-001-02
**Priority**: P1
**Given**: A skill entry array `[{id: "DEV-001", name: "code-impl", description: "Write code", path: "src/.../SKILL.md"}]`
**When**: `formatSkillIndexBlock(entries)` is called
**Then**:
- Output contains `DEV-001: code-impl -- Write code`
- Output contains `-> src/.../SKILL.md`

---

## 5. inject-session-cache.cjs -- test-inject-session-cache.test.cjs

### TC-HOOK-01: Outputs cache file content to stdout when cache exists (positive)
**Requirement**: FR-002, AC-002-01
**Priority**: P0
**Given**: Test directory with `.isdlc/session-cache.md` containing "test cache content"
**When**: The hook is run via `runHook()` with `CLAUDE_PROJECT_DIR` set to test directory
**Then**:
- `stdout` === "test cache content"
- `stderr` === "" (empty)
- `code` === 0

### TC-HOOK-02: Produces no output when cache file missing (negative, fail-open)
**Requirement**: FR-002, AC-002-02, NFR-005
**Priority**: P0
**Given**: Test directory with `.isdlc/` but NO `session-cache.md`
**When**: The hook is run via `runHook()`
**Then**:
- `stdout` === "" (empty)
- `stderr` === "" (empty)
- `code` === 0

### TC-HOOK-03: Produces no output when cache file unreadable (negative, fail-open)
**Requirement**: FR-002, AC-002-03, NFR-005
**Priority**: P0
**Given**: Test directory with `.isdlc/session-cache.md` that has permissions 000 (no read)
**When**: The hook is run via `runHook()`
**Then**:
- `stdout` === "" (empty)
- `stderr` === "" (empty)
- `code` === 0

### TC-HOOK-04: Outputs empty string for empty cache file (positive)
**Requirement**: FR-002
**Priority**: P2
**Given**: Test directory with `.isdlc/session-cache.md` that is an empty file (0 bytes)
**When**: The hook is run via `runHook()`
**Then**:
- `stdout` === "" (empty)
- `code` === 0

### TC-HOOK-05: Falls back to process.cwd() when CLAUDE_PROJECT_DIR unset (positive)
**Requirement**: FR-002, Component spec
**Priority**: P1
**Given**: Hook run with `CLAUDE_PROJECT_DIR` NOT set in env, cwd set to test directory with valid cache
**When**: The hook is run
**Then**:
- Either outputs cache content (if cwd has cache) or exits 0 with no output

### TC-HOOK-06: Completes within 5000ms timeout (performance)
**Requirement**: FR-002, AC-002-05, NFR-003
**Priority**: P1
**Given**: Test directory with `.isdlc/session-cache.md` of ~128K characters
**When**: Hook execution time is measured
**Then**:
- `execution_time_ms < 5000`

### TC-HOOK-07: Hook is self-contained (no common.cjs dependency) (positive)
**Requirement**: FR-002, ADR-0027
**Priority**: P1
**Given**: The hook file `inject-session-cache.cjs`
**When**: Its source code is inspected
**Then**:
- Does NOT contain `require('./lib/common.cjs')` or any local module require except `fs` and `path`

### TC-HOOK-08: Never writes to stderr (positive)
**Requirement**: VR-071
**Priority**: P1
**Given**: Various failure scenarios (cache missing, permissions error, invalid content)
**When**: Hook is run for each scenario
**Then**:
- `stderr` === "" in every case

---

## 6. bin/rebuild-cache.js CLI -- test-rebuild-cache-cli.test.cjs

### TC-CLI-01: Reports success with path, size, hash (positive)
**Requirement**: FR-004, AC-004-01, AC-004-03
**Priority**: P0
**Given**: A valid test project directory with all required source files
**When**: `node bin/rebuild-cache.js` is run in the test directory
**Then**:
- Exit code === 0
- stdout contains "Session cache rebuilt successfully"
- stdout contains "Path:" with a valid path
- stdout contains "Size:" with a number
- stdout contains "Hash:" with an 8-char hex string
- stdout contains "Sections:"

### TC-CLI-02: Reports failure when run outside iSDLC project (negative)
**Requirement**: FR-004, AC-004-02
**Priority**: P0
**Given**: A temp directory WITHOUT `.isdlc/`
**When**: `node bin/rebuild-cache.js` is run in that directory
**Then**:
- Exit code === 1
- stderr contains "Failed to rebuild session cache"

### TC-CLI-03: Supports --verbose flag (positive)
**Requirement**: FR-004
**Priority**: P2
**Given**: A valid test project
**When**: `node bin/rebuild-cache.js --verbose` is run
**Then**:
- Exit code === 0
- stdout contains success message
- Verbose output may appear on stderr

### TC-CLI-04: Uses createRequire to bridge ESM/CJS boundary (positive)
**Requirement**: FR-004, ADR-0030
**Priority**: P1
**Given**: The CLI script source code
**When**: Source is inspected
**Then**:
- Contains `import { createRequire } from 'module'`
- Uses `createRequire(import.meta.url)` to load common.cjs

### TC-CLI-05: Reports skipped sections (positive)
**Requirement**: FR-004, AC-004-03
**Priority**: P2
**Given**: A test project with some missing source files
**When**: `node bin/rebuild-cache.js` is run
**Then**:
- stdout contains "Skipped:" with section names

### TC-CLI-06: Supports -v shorthand for verbose (positive)
**Requirement**: FR-004
**Priority**: P3
**Given**: A valid test project
**When**: `node bin/rebuild-cache.js -v` is run
**Then**:
- Exit code === 0 (same behavior as --verbose)

### TC-CLI-07: Exit code 1 when common.cjs not loadable (negative)
**Requirement**: FR-004, Error CLI-003
**Priority**: P2
**Given**: A test environment where `src/claude/hooks/lib/common.cjs` does not exist
**When**: `node bin/rebuild-cache.js` is run
**Then**:
- Exit code === 1
- stderr contains error message

---

## 7. Hook Registration (FR-003) -- test-session-cache-builder.test.cjs

### TC-REG-01: settings.json contains SessionStart entries (positive)
**Requirement**: FR-003, AC-003-01
**Priority**: P0
**Given**: The `src/claude/settings.json` file (after implementation)
**When**: The file is parsed as JSON and the `hooks.SessionStart` key is inspected
**Then**:
- `hooks.SessionStart` is an array
- Contains an entry with `matcher.event === "startup"`
- Contains an entry with `matcher.event === "resume"`
- Each entry's command is `node $CLAUDE_PROJECT_DIR/.claude/hooks/inject-session-cache.cjs`

### TC-REG-02: Matchers use startup/resume pattern, NOT compact (positive)
**Requirement**: FR-003, AC-003-02, CON-004
**Priority**: P0
**Given**: The `hooks.SessionStart` entries
**When**: Each matcher is inspected
**Then**:
- Matcher is an object with `type` and `event` fields
- Matcher is NOT a bare string (compact format)

### TC-REG-03: Timeout is 5000ms (positive)
**Requirement**: FR-003, AC-003-03
**Priority**: P1
**Given**: The `hooks.SessionStart` entries
**When**: Each hook's timeout is inspected
**Then**:
- `timeout === 5000`

---

## 8. Manifest Cleanup (FR-008) -- test-session-cache-builder.test.cjs

### TC-MAN-01: skills-manifest.json has no path_lookup key (positive)
**Requirement**: FR-008, AC-008-01
**Priority**: P0
**Given**: The `src/claude/hooks/config/skills-manifest.json` file (after implementation)
**When**: Parsed as JSON and inspected
**Then**:
- Does NOT have a `path_lookup` property

### TC-MAN-02: skills-manifest.json has no skill_paths key (positive)
**Requirement**: FR-008, AC-008-02
**Priority**: P0
**Given**: The `src/claude/hooks/config/skills-manifest.json` file (after implementation)
**When**: Parsed as JSON and inspected
**Then**:
- Does NOT have a `skill_paths` property

### TC-MAN-03: Existing hooks still function after manifest cleanup (positive)
**Requirement**: FR-008, AC-008-03
**Priority**: P0
**Given**: skills-manifest.json without path_lookup and skill_paths
**When**: `skill-validator.cjs`, `log-skill-usage.cjs`, and `getAgentSkillIndex()` are executed
**Then**:
- No runtime errors
- Functions return expected results (skill validation passes, skill usage logs correctly, agent index returns skills)

---

## 9. External Manifest Source Field (FR-009) -- test-session-cache-builder.test.cjs

### TC-SRC-01: Source field "discover" included in manifest entry (positive)
**Requirement**: FR-009, AC-009-01
**Priority**: P1
**Given**: External manifest entry with `"source": "discover"`
**When**: `rebuildSessionCache()` processes it
**Then**:
- EXTERNAL_SKILLS section includes `Source: discover` for that entry

### TC-SRC-02: Source field "user" included in manifest entry (positive)
**Requirement**: FR-009, AC-009-03
**Priority**: P1
**Given**: External manifest entry with `"source": "user"`
**When**: `rebuildSessionCache()` processes it
**Then**:
- EXTERNAL_SKILLS section includes `Source: user`

### TC-SRC-03: Missing source field treated as "unknown" (negative)
**Requirement**: FR-009, AC-009-04
**Priority**: P1
**Given**: External manifest entry WITHOUT a `source` field
**When**: `rebuildSessionCache()` processes it
**Then**:
- EXTERNAL_SKILLS section includes `Source: unknown`
- No errors thrown

### TC-SRC-04: Source field "skills.sh" included (positive)
**Requirement**: FR-009, AC-009-02
**Priority**: P2
**Given**: External manifest entry with `"source": "skills.sh"`
**When**: `rebuildSessionCache()` processes it
**Then**:
- EXTERNAL_SKILLS section includes `Source: skills.sh`

---

## 10. Security Test Cases

### TC-SEC-01: Path traversal in SKILL.md path does not escape project (negative)
**Requirement**: Security
**Priority**: P1
**Given**: A SKILL.md file with content containing `skill_id: ATK-001` placed at a path with `../` segments inside the skills directory
**When**: `_buildSkillPathIndex()` is called
**Then**:
- Returned path for `ATK-001` does not escape the project root (no `../` leading outside)

### TC-SEC-02: Cache output does not contain .env or credentials (negative)
**Requirement**: Security
**Priority**: P1
**Given**: Test directory with valid source files AND a `.env` file and `credentials.json` in the project root
**When**: `rebuildSessionCache()` is called
**Then**:
- Cache file does NOT contain content from `.env` or `credentials.json`
