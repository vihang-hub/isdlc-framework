# Bug Report: BUG-0035-GH-81-82-83

**Bug ID:** BUG-0035-GH-81-82-83
**External Links:**
- https://github.com/vihangshah/isdlc/issues/81
- https://github.com/vihangshah/isdlc/issues/82
- https://github.com/vihangshah/isdlc/issues/83
**External IDs:** GH-81, GH-82, GH-83
**Created:** 2026-02-23
**Severity:** High

---

## Summary

`getAgentSkillIndex()` in `src/claude/hooks/lib/common.cjs` silently returns empty arrays for every agent because it expects ownership skills to be objects (`{ id, name, path }`) but the production `skills-manifest.json` stores them as flat string arrays of skill IDs (e.g., `["DEV-001", "DEV-002"]`). Additionally, the hardcoded `src/claude/skills/` path fails in installed projects where skills live at `.claude/skills/`. The test suite masks both bugs because its mock fixtures use the wrong schema (objects instead of strings).

---

## Issue #81: Schema mismatch in getAgentSkillIndex()

### Expected Behavior

`getAgentSkillIndex('software-developer')` should return an array of 14 skill objects with correct `id`, `name`, `description`, and `path` fields, resolved from the production manifest where `ownership[agent].skills` is a flat array of skill ID strings.

### Actual Behavior

The function iterates over `agentEntry.skills` and accesses `skill.path`, `skill.id`, `skill.name` on each entry. Since the production manifest stores skills as strings (e.g., `"DEV-001"`), all property accesses return `undefined`. The `path.join(projectRoot, 'src', 'claude', 'skills', undefined, 'SKILL.md')` call produces an invalid path, `fs.existsSync` returns `false`, and the skill is skipped. The function returns an empty array for every agent. The fail-open design masks this as a non-error.

### Reproduction Steps

1. Load the production `skills-manifest.json` (version 5.0.0)
2. Call `getAgentSkillIndex('software-developer')`
3. Observe the return value is `[]` instead of an array of 14 skill objects
4. Inspect `manifest.ownership['software-developer'].skills` -- it contains `["DEV-001", "DEV-002", ..., "DEV-014"]` (strings, not objects)

### Root Cause

Schema mismatch between code expectations and manifest format. The function was written assuming `ownership[agent].skills` contains objects with `{ id, name, path }` properties. The production manifest v5.0.0 stores skill IDs as flat strings. The `skill_lookup` table (skill_id -> agent_name) and `path_lookup` table (category/skill-name -> agent_name) exist in the manifest but are not utilized by the function.

---

## Issue #82: Hardcoded skill path fails in installed projects

### Expected Behavior

Skill SKILL.md files should be resolved at `.claude/skills/{category}/{skill-name}/SKILL.md` in installed projects (post `npx isdlc init`) and at `src/claude/skills/{category}/{skill-name}/SKILL.md` in the development repository.

### Actual Behavior

Line 1277 hardcodes `path.join(projectRoot, 'src', 'claude', 'skills', ...)`. In installed projects, skills are copied to `.claude/skills/`, so the `src/claude/skills/` path does not exist and all skill files fail to resolve.

### Reproduction Steps

1. Run `npx isdlc init` in a fresh project
2. Verify skills exist at `.claude/skills/` (not `src/claude/skills/`)
3. Any hook that calls `getAgentSkillIndex()` will fail to find skill files
4. The function returns empty arrays, so skill injection into agent prompts is silently broken

### Root Cause

The path resolution is hardcoded to the development layout (`src/claude/skills/`) and does not account for the installed layout (`.claude/skills/`).

---

## Issue #83: Test fixtures use wrong manifest schema

### Expected Behavior

Test fixtures in `skill-injection.test.cjs` should use the production manifest schema where `ownership[agent].skills` is a flat array of skill ID strings (e.g., `["TEST-001", "TEST-002"]`).

### Actual Behavior

Test fixtures (lines 59-72) use object arrays: `[{ id: 'TEST-001', name: 'skill-one', path: 'testing/skill-one' }]`. Tests pass against this mock schema, but the code being tested fails on the production manifest. This creates false confidence -- tests are green but production behavior is broken.

### Reproduction Steps

1. Open `src/claude/hooks/tests/skill-injection.test.cjs`
2. Inspect the mock manifest at lines 50-80
3. Compare `ownership[agent].skills` format: objects in mock vs. strings in production
4. Run tests -- all pass despite the production bug

### Root Cause

Test fixtures were written to match the code's assumptions rather than the production data format. No integration test loads the real `skills-manifest.json`.

---

## Environment

- Runtime: Node.js 20+
- Module system: CommonJS (hooks)
- Manifest version: 5.0.0 (246 skills)
- Affected file: `src/claude/hooks/lib/common.cjs` (lines 1251-1310)
- Test file: `src/claude/hooks/tests/skill-injection.test.cjs`
- Manifest file: `src/claude/hooks/config/skills-manifest.json`

---

## Impact

- **Skill injection is completely non-functional** in production -- every agent receives an empty skills list
- The fail-open design masks the bug: no errors are thrown, no warnings are logged
- Installed projects (via `npx isdlc init`) have a second layer of failure due to hardcoded paths
- Test suite provides false confidence -- 100% pass rate despite broken production behavior
- Affects all agents that rely on skill injection for prompt augmentation
