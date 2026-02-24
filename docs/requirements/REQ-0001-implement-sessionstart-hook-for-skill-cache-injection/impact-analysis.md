# Impact Analysis: Unified SessionStart Cache

**Generated**: 2026-02-23T20:30:00Z
**Feature**: Unified SessionStart cache -- eliminate ~200+ static file reads per workflow (GH #91)
**Based On**: Phase 01 Requirements (finalized) -- requirements-spec.md
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original (Phase 00) | Clarified (Phase 01) |
|--------|---------------------|----------------------|
| Description | "SessionStart Hook for Skill Cache Injection" | "Unified SessionStart cache -- eliminate ~200+ static file reads per workflow" |
| Keywords | cache, session, skill-cache, inject, manifest | cache, session, constitution, workflow-config, iteration-requirements, skill-index, external-skills, roundtable, persona, topic, mtime, fail-open |
| Estimated Files | ~12-18 | 7 core files (2 new + 5 modified) + trigger integration points |
| New Files | 1 (inject-skill-cache.cjs) | 2 (inject-session-cache.cjs, bin/rebuild-cache.js) |
| Scope Change | - | REFINED -- broader cache content (was skills-only, now all static content), absorbed #86 and #89 |

**Scope Change Summary**: The Phase 01 requirements refined the scope from "skill cache injection" to a comprehensive "session cache" that includes constitution, workflow config, iteration requirements, artifact paths, skill index blocks, external skills, persona files, and topic files. Two additional GitHub issues were absorbed: #86 (manifest cleanup -- remove `path_lookup` and `skill_paths`) and #89 (external manifest source field).

---

## Executive Summary

This feature introduces a SessionStart hook that pre-loads all static framework content into the LLM context window at session start, eliminating 200-340 redundant file reads per 9-phase workflow. The blast radius is **medium** -- 7 core files across 4 distinct modules (hook runtime, settings, CLI command, installer) with cascading effects through the phase-loop controller and roundtable analysis handler. The primary risk is in `src/claude/hooks/lib/common.cjs` (3,909 lines, only 6 test cases covering `writeState()`) where the new `rebuildSessionCache()` function will be added, and in the FR-008 manifest cleanup where `path_lookup` is actively referenced by `getAgentSkillIndex()` -- removal requires updating that function first. All consumer changes must fail-open to disk reads, limiting regression risk. The recommended implementation order is: core cache builder first, then hook registration, then consumer changes, then trigger integration, then manifest cleanup last.

**Blast Radius**: MEDIUM (7 core files, 4 modules)
**Risk Level**: MEDIUM
**Affected Files**: 7 directly, ~10 including trigger integration and tests
**Affected Modules**: 4 (hook runtime, settings/registration, CLI command, installer/updater)

---

## Impact Analysis

### Files Directly Affected

| # | File | Change Type | FR | Lines | Module |
|---|------|------------|-----|-------|--------|
| 1 | `src/claude/hooks/inject-session-cache.cjs` | NEW | FR-002 | ~40-60 est. | Hook Runtime |
| 2 | `bin/rebuild-cache.js` | NEW | FR-004 | ~30-50 est. | CLI |
| 3 | `src/claude/hooks/lib/common.cjs` | MODIFY | FR-001, FR-008 | 3,909 | Hook Runtime |
| 4 | `src/claude/settings.json` | MODIFY | FR-003 | 306 | Settings |
| 5 | `src/claude/commands/isdlc.md` | MODIFY | FR-005, FR-006, FR-007 | 2,315 | CLI Command |
| 6 | `src/claude/hooks/config/skills-manifest.json` | MODIFY | FR-008 | 1,069 | Config |
| 7 | `lib/installer.js` | MODIFY | FR-007 | 1,165 | Installer |

### Files Indirectly Affected (Trigger Integration for FR-007)

| # | File | Trigger Point | Change Type |
|---|------|--------------|-------------|
| 8 | `src/claude/commands/discover.md` | Post-discover cache rebuild | MODIFY (add rebuild call) |
| 9 | `lib/updater.js` | Post-update cache rebuild | MODIFY (add rebuild call) |
| 10 | `docs/isdlc/external-skills-manifest.json` | FR-009 source field addition | MODIFY (schema change) |

### Files Referenced (Cache Content Sources -- read-only)

These files are read by `rebuildSessionCache()` to build the cache. They are NOT modified.

| File | Cache Section |
|------|--------------|
| `docs/isdlc/constitution.md` (367 lines) | CONSTITUTION |
| `src/isdlc/config/workflows.json` (383 lines) | WORKFLOW CONFIG |
| `.claude/hooks/config/iteration-requirements.json` (781 lines) | ITERATION REQUIREMENTS |
| `.claude/hooks/config/artifact-paths.json` (31 lines) | ARTIFACT PATHS |
| `src/claude/hooks/config/skills-manifest.json` (1,069 lines) | SKILL INDEX BY AGENT (source data) |
| `src/claude/skills/**/SKILL.md` (242 files) | SKILL INDEX BY AGENT (skill descriptions) |
| `docs/isdlc/external-skills-manifest.json` + skill files | EXTERNAL SKILLS |
| `src/claude/agents/persona-business-analyst.md` | ROUNDTABLE CONTEXT (persona) |
| `src/claude/agents/persona-solutions-architect.md` | ROUNDTABLE CONTEXT (persona) |
| `src/claude/agents/persona-system-designer.md` | ROUNDTABLE CONTEXT (persona) |
| `src/claude/skills/analysis-topics/*/` (6 topic files) | ROUNDTABLE CONTEXT (topics) |

### Outward Dependency Analysis

Files that depend on the directly affected files:

**`common.cjs` dependents** (hooks that `require('./lib/common.cjs')`):
- All 21 hook files in `src/claude/hooks/` (dispatchers, validators, enforcers)
- All 16 test files in `src/claude/hooks/tests/`
- Adding `rebuildSessionCache()` as a new export does not break existing consumers (additive change)
- Modifying `getAgentSkillIndex()` to not use `path_lookup` (required for FR-008) could affect skill injection behavior

**`settings.json` dependents**:
- Claude Code hook system (reads this file to register hooks)
- `.claude/settings.json` (must be synced from `src/claude/settings.json` via rsync)
- Adding a new `SessionStart` hook section is additive; no breaking change to existing hooks

**`isdlc.md` dependents**:
- `.claude/commands/isdlc.md` (symlink to source -- auto-synced)
- All phase agents (receive delegation prompts constructed by isdlc.md)
- Roundtable-analyst agent (receives persona/topic context from isdlc.md)

**`skills-manifest.json` dependents**:
- `common.cjs` `getAgentSkillIndex()` -- references `path_lookup` (line 1292)
- `common.cjs` `loadManifest()` -- reads the full manifest
- `skill-validator.cjs` -- validates skill IDs against manifest
- `log-skill-usage.cjs` -- reads skill metadata from manifest

### Inward Dependency Analysis

What the affected files depend on:

**`inject-session-cache.cjs` (NEW)**:
- `fs.readFileSync` -- to read `.isdlc/session-cache.md`
- `process.stdout.write` -- to output cache content
- No dependency on `common.cjs` needed (self-contained, minimal)

**`rebuildSessionCache()` in `common.cjs`**:
- `fs` -- readFileSync, writeFileSync, statSync, existsSync
- `path` -- join, resolve
- `getProjectRoot()` -- existing function in common.cjs
- `loadManifest()` -- existing function (for skill index data)
- `getAgentSkillIndex()` / `formatSkillIndexBlock()` -- existing functions (for per-agent skill blocks)
- `loadExternalManifest()` -- existing function (for external skills)
- `crypto` -- may be needed for source hash (or could use simpler mtime concatenation)

**`bin/rebuild-cache.js` (NEW)**:
- `common.cjs` -- imports `rebuildSessionCache()`
- Must handle CJS/ESM boundary (bin/ files are ESM, common.cjs is CJS)

### Change Propagation Paths

```
rebuildSessionCache() [NEW in common.cjs]
 |
 +-- Called by: inject-session-cache.cjs? NO -- hook only READS cache
 +-- Called by: bin/rebuild-cache.js [NEW] -- CLI escape hatch
 +-- Called by: installer.js -- on init/update (FR-007)
 +-- Called by: updater.js -- on update (FR-007)
 +-- Called by: isdlc.md -- after discover, skill add/remove/wire (FR-007)
 |
 +-- Reads: skills-manifest.json (including path_lookup for now)
 +-- Reads: 242 SKILL.md files
 +-- Reads: constitution.md, workflows.json, iteration-requirements.json, artifact-paths.json
 +-- Reads: external-skills-manifest.json + external skill files
 +-- Reads: 3 persona files + 6 topic files
 |
 +-- Writes: .isdlc/session-cache.md

session-cache.md [OUTPUT]
 |
 +-- Read by: inject-session-cache.cjs (SessionStart hook) --> stdout --> LLM context
 |
 +-- Referenced by: isdlc.md STEP 3d (phase delegation) -- fail-open to disk reads
 +-- Referenced by: isdlc.md analyze handler (roundtable dispatch) -- fail-open to disk reads

getAgentSkillIndex() [MODIFIED in common.cjs for FR-008]
 |
 +-- Currently uses: path_lookup from skills-manifest.json
 +-- Must be updated to: resolve skill paths without path_lookup
 +-- Called by: isdlc.md SKILL INJECTION STEP A (every phase delegation)
 +-- Called by: rebuildSessionCache() (for pre-building skill index blocks)
```

---

## Entry Points

### Existing Entry Points Affected

| # | Entry Point | Type | FR(s) | Impact |
|---|-------------|------|-------|--------|
| 1 | SessionStart hook dispatch | Hook lifecycle | FR-002, FR-003 | New hook fires at every session startup/resume |
| 2 | Phase-loop controller (STEP 3d) | CLI command | FR-005 | Constitution, workflow config, iteration requirements, skill index, external skills now sourced from session context |
| 3 | Analyze handler (roundtable dispatch) | CLI command | FR-006 | Persona and topic content sourced from session context |
| 4 | Skill management (`/isdlc skill add/remove/wire`) | CLI command | FR-007 | Cache rebuild triggered after each mutation |
| 5 | Discover (`/discover`) | CLI command | FR-007 | Cache rebuild triggered after discovery completes |
| 6 | `isdlc init` | CLI command | FR-007 | Cache rebuild after framework installation |
| 7 | `isdlc update` | CLI command | FR-007 | Cache rebuild after framework update |

### New Entry Points to Create

| # | Entry Point | Type | FR | Description |
|---|-------------|------|-----|-------------|
| 1 | `inject-session-cache.cjs` | SessionStart hook | FR-002 | Reads `.isdlc/session-cache.md`, outputs to stdout |
| 2 | `bin/rebuild-cache.js` | CLI script | FR-004 | Manual cache rebuild escape hatch |
| 3 | `rebuildSessionCache()` | Function export | FR-001 | Core cache builder in common.cjs |

### Implementation Chain (Entry to Data Layer)

**Cache Build Chain**:
```
Trigger (init/update/discover/skill-mutation)
  --> rebuildSessionCache() [common.cjs]
    --> getProjectRoot() [common.cjs] -- resolve .isdlc/ location
    --> loadManifest() [common.cjs] -- read skills-manifest.json
    --> getAgentSkillIndex() [common.cjs] -- per-agent skill blocks (x48 agents)
    --> formatSkillIndexBlock() [common.cjs] -- format each agent's block
    --> loadExternalManifest() [common.cjs] -- read external skills
    --> fs.readFileSync() -- constitution, workflows.json, etc.
    --> fs.writeFileSync() -- .isdlc/session-cache.md
```

**Cache Consumption Chain**:
```
Claude Code session startup/resume
  --> inject-session-cache.cjs (SessionStart hook)
    --> fs.readFileSync('.isdlc/session-cache.md')
    --> process.stdout.write(content)
  --> LLM context window now contains cache content

Phase delegation (STEP 3d)
  --> Check session context for CONSTITUTION section (fail-open)
  --> Check session context for WORKFLOW CONFIG section (fail-open)
  --> Check session context for ITERATION REQUIREMENTS section (fail-open)
  --> Check session context for SKILL INDEX BY AGENT section (fail-open)
  --> Check session context for EXTERNAL SKILLS section (fail-open)
  --> Fallback: read each file from disk if section not found
```

### Recommended Implementation Order

1. **FR-001**: `rebuildSessionCache()` in `common.cjs` -- core builder function
2. **FR-004**: `bin/rebuild-cache.js` -- CLI escape hatch (tests cache builder independently)
3. **FR-002 + FR-003**: `inject-session-cache.cjs` hook + `settings.json` registration
4. **FR-005**: Phase-loop controller consumer changes (isdlc.md STEP 3d)
5. **FR-006**: Roundtable consumer changes (isdlc.md analyze handler)
6. **FR-007**: Trigger integration (discover, skill management, installer, updater)
7. **FR-009**: External manifest source field
8. **FR-008**: Manifest cleanup (`path_lookup`, `skill_paths`) -- LAST, requires `getAgentSkillIndex()` update first

**Rationale**: Build the core function first so it can be tested independently. The hook and registration are simple wrappers. Consumer changes are fail-open so they can be deployed incrementally. FR-008 must be last because `getAgentSkillIndex()` currently depends on `path_lookup`.

---

## Risk Assessment

### Risk Summary

| Risk Area | Level | Description |
|-----------|-------|-------------|
| `common.cjs` complexity | MEDIUM | 3,909-line file with only 6 test cases; adding ~150-200 lines |
| `path_lookup` removal (FR-008) | HIGH | `getAgentSkillIndex()` actively uses `path_lookup`; must update resolution logic first |
| Context window budget | MEDIUM | 242 SKILL.md files + constitution + config could exceed 128K chars |
| CJS/ESM boundary (`bin/rebuild-cache.js`) | LOW | bin/ files use ESM; must use `require()` or dynamic import for common.cjs |
| isdlc.md consumer changes | LOW | Fail-open design limits regression risk; existing behavior preserved as fallback |
| SessionStart hook reliability | LOW | Simple read-and-output; fail-open on missing/unreadable cache |
| Trigger integration coordination | MEDIUM | 6 distinct trigger points across 4 files; missing any one means stale cache |

### Test Coverage Gaps in Affected Modules

| File | Existing Tests | Coverage Assessment |
|------|---------------|-------------------|
| `src/claude/hooks/lib/common.cjs` (3,909 lines) | `common.test.cjs` (142 lines, 6 tests -- `writeState()` only) | LOW -- ~2% function coverage; `getAgentSkillIndex()`, `loadManifest()`, `loadExternalManifest()`, `formatSkillIndexBlock()` have ZERO tests |
| `src/claude/hooks/inject-session-cache.cjs` (NEW) | None (new file) | NONE -- needs new test file |
| `bin/rebuild-cache.js` (NEW) | None (new file) | NONE -- needs new test file |
| `src/claude/settings.json` | No direct tests (validated by hook dispatchers at runtime) | N/A -- JSON config |
| `src/claude/commands/isdlc.md` | No unit tests (markdown command file) | N/A -- integration testing only |
| `src/claude/hooks/config/skills-manifest.json` | `skill-validator.test.cjs` (13 tests) | MEDIUM -- validates structure but not `path_lookup`/`skill_paths` fields specifically |
| `lib/installer.js` | `installer.test.js` (970 lines, ~30 tests) | MEDIUM -- tests install flow but not cache rebuild trigger |
| `lib/updater.js` | `updater.test.js` (411 lines, ~22 tests) | MEDIUM -- tests update flow but not cache rebuild trigger |

### Complexity Hotspots

1. **`getAgentSkillIndex()` in common.cjs (lines 1262-1380)**: Complex dual-schema resolution with path_lookup reverse indexing. FR-008 requires modifying this function to work without `path_lookup`. This is the highest-risk change in the feature -- modifying working code with zero test coverage.

2. **`rebuildSessionCache()` (new, estimated 150-200 lines)**: Must correctly read 250+ files (242 SKILL.md + 9 config files + 3 persona + 6 topic), build per-agent skill index blocks, handle missing files gracefully, compute source hash, and stay under 128K character budget. Complex but isolated (new function, no existing code modification).

3. **isdlc.md STEP 3d consumer changes (lines 1730-1815)**: The phase delegation logic is already complex with skill injection steps A/B/C, gate requirements injection, and budget degradation injection. Adding session context references with fail-open fallback adds another conditional layer.

4. **isdlc.md analyze handler (lines 640-770)**: The roundtable dispatch already pre-reads persona and topic files. Converting to session context lookup with fallback requires careful conditional logic to avoid breaking the relay-and-resume loop.

### Technical Debt Markers

1. **common.cjs test debt**: Only 6 tests for a 3,909-line file. The functions that `rebuildSessionCache()` will call (`getAgentSkillIndex`, `loadManifest`, `formatSkillIndexBlock`, `loadExternalManifest`) have zero tests.

2. **`path_lookup` coupling**: The `getAgentSkillIndex()` function is tightly coupled to `path_lookup` for the production v5+ schema path. The assumption in the requirements (ASM-004: "path_lookup and skill_paths fields are unused by runtime hooks") is **partially incorrect** -- `path_lookup` IS used by `getAgentSkillIndex()`.

3. **Dual sync mechanism**: Changes to `src/claude/settings.json` must be manually synced to `.claude/settings.json` via rsync. This is a known operational debt -- if sync is missed, the SessionStart hook will not be registered.

### Risk Recommendations

1. **CRITICAL -- Before FR-008**: Write tests for `getAgentSkillIndex()` to establish a behavioral baseline BEFORE modifying it to remove `path_lookup` dependency. Without tests, there is no safety net for the refactor.

2. **HIGH -- Context budget validation**: The `rebuildSessionCache()` function must include a size check. With 242 SKILL.md files averaging 2-5KB each, the raw content alone could be 500KB-1.2MB. The function must extract only skill index metadata (ID, name, description), not full SKILL.md content. Verify the budget at build time, not at consumption time.

3. **MEDIUM -- Test `inject-session-cache.cjs`**: Write tests covering: cache exists (happy path), cache missing (fail-open), cache unreadable (permissions, fail-open), cache empty, hook timeout compliance (<5000ms).

4. **MEDIUM -- Trigger integration testing**: Each of the 6 trigger points (init, update, discover, skill add, skill remove, skill wire) must be verified to call `rebuildSessionCache()`. Missing any trigger means stale cache after mutations.

5. **LOW -- ESM/CJS boundary for `bin/rebuild-cache.js`**: The `bin/` directory uses ESM (package.json has `"type": "module"`), but `common.cjs` is CommonJS. Use `import { createRequire } from 'module'` or make `rebuild-cache.js` use `.cjs` extension.

---

## Cross-Validation

### File List Consistency

Cross-referencing the Impact Analysis (M1) file list against the Entry Point (M2) analysis:

| File | In M1 | In M2 | Consistent |
|------|-------|-------|-----------|
| `src/claude/hooks/inject-session-cache.cjs` | YES (new) | YES (new entry point) | YES |
| `bin/rebuild-cache.js` | YES (new) | YES (new entry point) | YES |
| `src/claude/hooks/lib/common.cjs` | YES (modify) | YES (function export) | YES |
| `src/claude/settings.json` | YES (modify) | YES (hook registration) | YES |
| `src/claude/commands/isdlc.md` | YES (modify) | YES (5 entry points) | YES |
| `src/claude/hooks/config/skills-manifest.json` | YES (modify) | NO (not an entry point) | OK -- config file, not entry |
| `lib/installer.js` | YES (modify) | YES (trigger point) | YES |
| `lib/updater.js` | YES (indirect) | YES (trigger point) | YES |
| `src/claude/commands/discover.md` | YES (indirect) | YES (trigger point) | YES |

### Risk Scoring Consistency

| Area | M1 Coupling | M3 Risk | Consistent |
|------|-------------|---------|-----------|
| `common.cjs` | HIGH (21 hooks depend on it) | MEDIUM (low test coverage) | YES -- high coupling + low coverage = medium-high risk |
| `settings.json` | MEDIUM (all hooks depend on registration) | LOW (additive change) | YES -- additive change mitigates coupling risk |
| `isdlc.md` | HIGH (all phase agents receive its prompts) | LOW (fail-open design) | YES -- fail-open mitigates coupling risk |
| `skills-manifest.json` | MEDIUM (common.cjs reads it) | HIGH (path_lookup actively used) | YES -- active dependency is highest individual risk item |

### Key Finding: ASM-004 Assumption Partially Incorrect

The requirements assumption ASM-004 states: "The `path_lookup` and `skill_paths` fields in skills-manifest.json are unused by runtime hooks (safe to remove per #86)."

**Finding**: `skill_paths` is indeed unused and safe to remove. However, `path_lookup` IS actively used by `getAgentSkillIndex()` in `common.cjs` (line 1292). This function is called during every phase delegation via SKILL INJECTION STEP A in isdlc.md. Removing `path_lookup` without updating `getAgentSkillIndex()` would break skill injection across all phases.

**Recommendation**: FR-008 implementation must first update `getAgentSkillIndex()` to resolve skill paths using the SKILL.md frontmatter `skill_id` field directly (scanning the skills directory tree) rather than relying on `path_lookup` as a reverse index. Only after this refactor can `path_lookup` be safely removed from the manifest.

### Verification Status

- File lists: CONSISTENT across all analyses
- Risk scoring: CONSISTENT with minor variance
- Completeness: All 9 FRs covered, all NFRs addressed
- Critical finding: ASM-004 partial incorrectness identified and documented

**Overall Verification**: PASS (with noted finding on ASM-004)

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Implementation Order**:
   - Phase A (Core): FR-001 (`rebuildSessionCache()`), FR-004 (`bin/rebuild-cache.js`)
   - Phase B (Hook): FR-002 (`inject-session-cache.cjs`), FR-003 (settings.json registration)
   - Phase C (Consumers): FR-005 (phase-loop controller), FR-006 (roundtable)
   - Phase D (Triggers): FR-007 (discover, skill mgmt, installer, updater)
   - Phase E (Cleanup): FR-009 (external manifest source field), FR-008 (manifest cleanup -- requires `getAgentSkillIndex()` refactor first)

2. **High-Risk Areas -- Add Tests First**:
   - `getAgentSkillIndex()` -- zero tests, actively uses `path_lookup`, must be refactored for FR-008
   - `loadManifest()` -- zero tests, called by `rebuildSessionCache()` and `getAgentSkillIndex()`
   - `formatSkillIndexBlock()` -- zero tests, produces the skill blocks for the cache
   - `loadExternalManifest()` -- zero tests, reads external skills data

3. **Dependencies to Resolve**:
   - FR-008 depends on `getAgentSkillIndex()` being refactored to not use `path_lookup`
   - `bin/rebuild-cache.js` (ESM) must correctly import from `common.cjs` (CJS)
   - `.claude/settings.json` must be synced from `src/claude/settings.json` after registration
   - Context window budget (~128K chars) must be validated -- may require SKILL.md content extraction strategy (metadata only, not full file content)

4. **rsync Sync Requirement**: After modifying `src/claude/settings.json` and `src/claude/hooks/inject-session-cache.cjs`, run rsync to copy to `.claude/` for runtime activation.

---

## Impact Analysis Metadata

The following JSON block is required for automated sizing analysis (REQ-0011).
All fields are required. The `parseSizingFromImpactAnalysis()` function reads
the LAST JSON block in the file to extract sizing metrics.

```json
{
  "analysis_completed_at": "2026-02-23T20:30:00Z",
  "sub_agents": ["M1", "M2", "M3", "M4"],
  "verification_status": "PASS",
  "requirements_document": "docs/requirements/REQ-0001-implement-sessionstart-hook-for-skill-cache-injection/requirements-spec.md",
  "quick_scan_used": "docs/requirements/REQ-0001-implement-sessionstart-hook-for-skill-cache-injection/quick-scan.md",
  "scope_change_from_original": "refined",
  "requirements_keywords": ["cache", "session", "constitution", "workflow-config", "iteration-requirements", "skill-index", "external-skills", "roundtable", "persona", "topic", "mtime", "fail-open"],
  "files_directly_affected": 7,
  "modules_affected": 4,
  "risk_level": "medium",
  "blast_radius": "medium",
  "coverage_gaps": 3
}
```
