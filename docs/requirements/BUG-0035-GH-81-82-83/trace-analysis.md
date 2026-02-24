# Trace Analysis: Skills Subsystem Schema Mismatch (GH-81/82/83)

**Generated**: 2026-02-23
**Bug**: getAgentSkillIndex() returns empty arrays due to schema mismatch, hardcoded paths, and wrong test fixtures
**External IDs**: GH-81, GH-82, GH-83
**Workflow**: fix
**Phase**: 02-tracing

---

## Executive Summary

The `getAgentSkillIndex()` function in `src/claude/hooks/lib/common.cjs` (lines 1251-1310) is completely non-functional in production. The function iterates over `ownership[agent].skills` and accesses `skill.path`, `skill.id`, and `skill.name` on each element, but the production `skills-manifest.json` stores skills as flat string arrays (e.g., `["DEV-001", "DEV-002"]`), not objects. Every string property access returns `undefined`, the constructed file path is invalid, `fs.existsSync` returns `false`, and every skill is silently skipped. A secondary bug hardcodes the path to `src/claude/skills/` which does not exist in installed projects. The test suite masks both bugs because its mock fixtures use the wrong schema (objects instead of strings), providing false confidence. The root cause is a schema assumption mismatch introduced when the manifest was refactored from object-style to flat-string-style ownership entries, without updating the consuming code.

**Root Cause Confidence**: High
**Severity**: High
**Estimated Complexity**: Medium

---

## Symptom Analysis

### Error Behavior

There are no visible errors, exceptions, or log messages. The function is designed fail-open: any unresolvable state returns an empty array `[]`. This fail-open design completely masks the bug.

### Observable Symptoms

| Symptom | Impact | Detection Method |
|---------|--------|-----------------|
| `getAgentSkillIndex('software-developer')` returns `[]` instead of 14 entries | Skill injection into agent Task prompts is completely non-functional | Call function with production manifest loaded |
| No AVAILABLE SKILLS block appears in agent delegation prompts | All 48 agents operate without skill context | Inspect Task prompt content |
| `formatSkillIndexBlock([])` returns `""` | Empty string silently omitted from prompts | Trace call chain from hook to prompt assembly |
| All tests pass (39 tests, 0 failures) | False confidence -- tests validate broken code against broken fixtures | Run `node --test src/claude/hooks/tests/skill-injection.test.cjs` |

### Error Chain

1. `getAgentSkillIndex('software-developer')` is called
2. `loadManifest()` succeeds -- returns valid manifest object
3. `manifest.ownership['software-developer']` resolves to `{ agent_id: "05", phase: "06-implementation", skill_count: 14, skills: ["DEV-001", ...] }`
4. `agentEntry.skills` is `["DEV-001", "DEV-002", ..., "DEV-014"]` -- an array of **strings**
5. The `for (const skill of agentEntry.skills)` loop iterates; `skill` = `"DEV-001"` (a string)
6. `skill.path` evaluates to `undefined` (strings do not have a `.path` property)
7. `path.join(projectRoot, 'src', 'claude', 'skills', undefined, 'SKILL.md')` produces a path containing the literal string `"undefined"`
8. `fs.existsSync(...)` returns `false` for this invalid path
9. The `continue` statement skips the skill
10. After all 14 iterations, `result` remains `[]`
11. The empty array is returned -- no error, no warning

### Triggering Conditions

- **Always triggered**: The bug occurs on every call to `getAgentSkillIndex()` with any agent name, because all agents in the production manifest use flat string arrays
- **No timing dependency**: Not intermittent -- 100% reproducible
- **No environment dependency for GH-81**: Affects both development and installed projects
- **Environment-dependent for GH-82**: Only affects installed projects (where `src/claude/skills/` does not exist)

---

## Execution Path

### Entry Points

The function is called from the hook system during agent delegation (STEP 3d of the Phase-Loop Controller in `isdlc.md`). The call chain is:

```
isdlc.md (STEP 3d: delegate to phase agent)
  -> getAgentSkillIndex(agentName)
    -> loadManifest()
      -> getManifestPath()
        -> checks .claude/hooks/config/skills-manifest.json (primary)
        -> checks .isdlc/config/skills-manifest.json (fallback)
      -> _loadConfigWithCache(path, 'skills-manifest')
        -> fs.statSync + JSON.parse + cache
    -> manifest.ownership[agentName]
    -> for each skill in agentEntry.skills:
        -> path.join(projectRoot, 'src', 'claude', 'skills', skill.path, 'SKILL.md')  [BUG: skill.path is undefined]
        -> fs.existsSync(skillMdPath)  [returns false]
        -> continue  [skill skipped]
    -> return []  [always empty]
  -> formatSkillIndexBlock([])
    -> returns ""  [empty string, omitted from prompt]
```

### Data Flow Analysis

**Manifest loading** (`loadManifest()` at line 1179): Works correctly. Returns the full manifest object with `ownership`, `skill_lookup`, and `path_lookup` tables. No bug here.

**Agent entry lookup** (line 1263): Works correctly. `manifest.ownership['software-developer']` returns the expected object with `skills: ["DEV-001", ..., "DEV-014"]`.

**Skills iteration** (line 1275): This is where the bug manifests. The loop variable `skill` is a **string** (e.g., `"DEV-001"`), not an object.

**Property access on string** (line 1277): `skill.path` on a string returns `undefined`. JavaScript does not throw on property access of primitive types -- it silently returns `undefined`.

**Path construction** (line 1277): `path.join(projectRoot, 'src', 'claude', 'skills', undefined, 'SKILL.md')` coerces `undefined` to `"undefined"`, producing a path like `/project/src/claude/skills/undefined/SKILL.md`.

**File existence check** (line 1280): `fs.existsSync('/project/src/claude/skills/undefined/SKILL.md')` returns `false`.

**Skip logic** (line 1282): `continue` skips to next iteration. Same failure repeats for all skills.

### Hardcoded Path Issue (GH-82)

Line 1277 constructs the path exclusively from `src/claude/skills/`:
```javascript
const skillMdPath = path.join(projectRoot, 'src', 'claude', 'skills', skill.path, 'SKILL.md');
```

In installed projects (post `npx isdlc init`), skills are at `.claude/skills/`, not `src/claude/skills/`. The `getManifestPath()` function (line 1157) already implements dual-path resolution for the manifest file (checking `.claude/hooks/config/` first, then `.isdlc/config/`), but `getAgentSkillIndex()` does not follow this pattern for skill files.

### Available Lookup Tables (Not Used)

The manifest contains three tables that could resolve skill IDs to paths:

1. **`skill_lookup`** (line 574): Maps skill ID to agent name. Example: `"DEV-001" -> "software-developer"`. Already used by `getSkillOwner()` but not by `getAgentSkillIndex()`.

2. **`path_lookup`** (line 819): Maps `category/skill-name` to agent name. Example: `"development/code-implementation" -> "software-developer"`. This table can be reverse-indexed: for a given agent, collect all paths that map to that agent, then match against skill IDs by reading SKILL.md frontmatter.

3. **SKILL.md frontmatter**: Each file contains `skill_id: DEV-001` in its YAML header. This provides the definitive mapping from file path to skill ID.

### Resolution Strategy

The fix must build a reverse index from `path_lookup`:
1. For a given agent, filter `path_lookup` entries where the value matches the agent name
2. For each matching path (e.g., `"development/code-implementation"`), construct the full file path
3. Read the SKILL.md, extract `skill_id` from frontmatter
4. Match against the skill IDs in `ownership[agent].skills`
5. Return the resolved `{ id, name, description, path }` objects

---

## Root Cause Analysis

### Hypothesis 1: Schema Evolution Mismatch (HIGH CONFIDENCE)

**Evidence:**
- The production `skills-manifest.json` v5.0.0 stores `ownership[agent].skills` as flat string arrays: `["DEV-001", "DEV-002"]`
- The code at lines 1275-1298 accesses `skill.path`, `skill.id`, `skill.name` -- properties of an object, not a string
- The test fixtures (lines 59-72 of `skill-injection.test.cjs`) use objects: `[{ id: 'TEST-001', name: 'skill-one', path: 'testing/skill-one' }]`
- The manifest was likely refactored from object-style to flat-string-style at some point, and the consuming code was not updated

**Root Cause:** The manifest schema evolved from object arrays to string arrays in `ownership[agent].skills`, but `getAgentSkillIndex()` was never updated to handle the new format. The function was written (or last updated) when the manifest used the object format, and the test fixtures were written to match the code's assumptions rather than the production data.

**Confidence:** High -- direct evidence from comparing manifest schema to code assumptions.

### Hypothesis 2: Test-First Inversion (HIGH CONFIDENCE, explains GH-83)

**Evidence:**
- Test fixtures at lines 50-87 use `skills: [{ id: 'TEST-001', name: 'skill-one', path: 'testing/skill-one' }]`
- Production manifest uses `skills: ["DEV-001", "DEV-002"]`
- All 39 tests pass because the fixtures match the code, not the production data
- No integration test loads the real `skills-manifest.json`

**Root Cause:** Tests were designed to validate the code's implementation rather than the code's correctness against production data. The test fixtures encode the code's assumptions, creating a circular validation loop. When the manifest format diverged, the tests continued to pass because they test against mock data that shares the same wrong assumptions.

**Confidence:** High -- direct comparison of fixture schema vs. production schema.

### Hypothesis 3: Development-Only Path Assumption (MEDIUM CONFIDENCE, explains GH-82)

**Evidence:**
- Line 1277: `path.join(projectRoot, 'src', 'claude', 'skills', skill.path, 'SKILL.md')` -- hardcoded to `src/claude/skills/`
- `getManifestPath()` (line 1157) already handles dual paths: `.claude/hooks/config/` (primary) and `.isdlc/config/` (fallback)
- In installed projects, skills are copied to `.claude/skills/`, not `src/claude/skills/`
- The function was likely written and tested only in the development repository

**Root Cause:** The skill file path resolution was written for the development environment only, without considering the installed project layout. The `getManifestPath()` function demonstrates the correct dual-path pattern already exists in the codebase, but was not applied to skill file resolution.

**Confidence:** Medium -- the bug is real but masked by GH-81 (since skill.path is undefined anyway, the path would be wrong regardless).

### Ranked Hypotheses

| Rank | Hypothesis | Confidence | Impact |
|------|-----------|------------|--------|
| 1 | Schema evolution mismatch (GH-81) | High | Breaks all skill resolution for all agents |
| 2 | Test-first inversion (GH-83) | High | Prevents detection of #1 |
| 3 | Development-only path (GH-82) | Medium | Breaks installed projects (masked by #1) |

### Suggested Fix

**Approach:** Rewrite the inner loop of `getAgentSkillIndex()` to:

1. **Build a reverse index** from `path_lookup`: For the given agent, collect all directory paths where `path_lookup[dirPath] === agentName`. This gives entries like `"development/code-implementation"`.

2. **For each directory path**, construct the full SKILL.md path using dual-path resolution:
   - Try `.claude/skills/{dirPath}/SKILL.md` first (installed layout)
   - Fall back to `src/claude/skills/{dirPath}/SKILL.md` (development layout)

3. **Read the SKILL.md** and extract `skill_id` from frontmatter.

4. **Match against the agent's skill IDs**: Only include skills whose `skill_id` appears in `ownership[agent].skills`.

5. **Extract description** using existing `_extractSkillDescription()` helper.

6. **Extract name** from the directory path (last segment, e.g., `"code-implementation"` from `"development/code-implementation"`).

7. **Return** `{ id, name, description, path }` for each resolved skill.

**Complexity:** Medium -- the logic is straightforward but requires careful handling of the reverse index and dual-path resolution. No new dependencies needed. No signature changes.

**Fix for test fixtures (GH-83):**
- Update mock manifest in `skill-injection.test.cjs` to use flat string arrays: `skills: ["TEST-001", "TEST-002"]`
- Add mock `path_lookup` entries to the fixture: `{ "testing/skill-one": "test-agent-alpha", ... }`
- Add at least one integration test that loads the real `skills-manifest.json` and validates against the actual `software-developer` agent
- Ensure mock SKILL.md files contain `skill_id` in frontmatter (already present)

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-23",
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "error_keywords": ["getAgentSkillIndex", "skill.path", "undefined", "empty array", "schema mismatch", "path_lookup", "skill_lookup", "ownership"],
  "files_analyzed": [
    "src/claude/hooks/lib/common.cjs (lines 1240-1310)",
    "src/claude/hooks/config/skills-manifest.json (ownership, skill_lookup, path_lookup sections)",
    "src/claude/hooks/tests/skill-injection.test.cjs (full file, 1026 lines)",
    "src/claude/skills/development/code-implementation/SKILL.md (frontmatter verification)"
  ],
  "phase_timing_report": {
    "debate_rounds_used": 0,
    "fan_out_chunks": 0
  }
}
```
