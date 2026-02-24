# Requirements Specification: BUG-0035-GH-81-82-83

**Bug ID:** BUG-0035-GH-81-82-83
**Phase:** 01-requirements
**Scope:** bug-report (fix workflow)
**Created:** 2026-02-23
**Status:** Draft

---

## Context

The `getAgentSkillIndex()` function in `src/claude/hooks/lib/common.cjs` is responsible for resolving an agent's owned skills from the `skills-manifest.json` and returning an array of skill metadata (id, name, description, path) for injection into agent Task prompts. The function is completely non-functional in production due to three interrelated bugs:

1. **Schema mismatch** (GH-81): The function expects `ownership[agent].skills` to contain objects but the production manifest uses flat string arrays of skill IDs
2. **Hardcoded path** (GH-82): Skill file resolution uses `src/claude/skills/` which does not exist in installed projects
3. **False-confidence tests** (GH-83): Test fixtures use the wrong schema, so tests pass despite the production bug

These three issues are tightly coupled -- fixing #81 requires updating the resolution logic, which surfaces #82, and both require #83 to prevent regression.

---

## Fix Requirements

### FR-01: Rewrite getAgentSkillIndex() to work with production manifest schema

The function must resolve skill metadata from flat string IDs in `ownership[agent].skills` using the manifest's existing lookup tables (`skill_lookup`, `path_lookup`) and SKILL.md frontmatter.

**Resolution approach (Option B from GH-81):** Keep the manifest's string-array format unchanged. Rewrite the function to:
1. Read the skill ID string from `ownership[agent].skills`
2. Look up skill metadata (name, category/path) by reversing the `path_lookup` table or by scanning SKILL.md frontmatter for matching `skill_id`
3. Return correctly populated `{ id, name, description, path }` objects

**Acceptance Criteria:**

- **AC-01-01:** Given the production `skills-manifest.json` (v5.0.0) is loaded and `ownership['software-developer'].skills` contains `["DEV-001", ..., "DEV-014"]` as strings, when `getAgentSkillIndex('software-developer')` is called, then it returns an array of exactly 14 skill objects
- **AC-01-02:** Given a valid skill ID string (e.g., `"DEV-001"`), when the function resolves it, then the returned object contains `id` matching the input string, `name` matching the skill's directory name (e.g., `"code-implementation"`), a non-empty `description` string, and a `path` pointing to the SKILL.md file
- **AC-01-03:** Given the manifest is missing or corrupt (null, undefined, no `ownership` key), when `getAgentSkillIndex()` is called, then it returns an empty array without throwing (fail-open preserved)
- **AC-01-04:** Given an agent name that does not exist in the manifest's `ownership` section, when `getAgentSkillIndex('nonexistent-agent')` is called, then it returns an empty array without throwing
- **AC-01-05:** Given an agent whose skills array contains a skill ID that cannot be resolved (no matching SKILL.md file found), when `getAgentSkillIndex()` is called, then it skips the unresolvable skill and continues processing remaining skills (fail-open per-skill)
- **AC-01-06:** Given an empty string, null, or undefined is passed as the agent name, when `getAgentSkillIndex()` is called, then it returns an empty array without throwing

### FR-02: Implement dual-path skill file resolution

Skill SKILL.md files must be resolved from both the development layout (`src/claude/skills/`) and the installed layout (`.claude/skills/`).

**Acceptance Criteria:**

- **AC-02-01:** Given the project root contains `src/claude/skills/{category}/{skill-name}/SKILL.md` (development mode), when skill path resolution runs, then the file is found and its content is read successfully
- **AC-02-02:** Given the project root contains `.claude/skills/{category}/{skill-name}/SKILL.md` but NOT `src/claude/skills/` (installed mode), when skill path resolution runs, then the file is found at the `.claude/skills/` location
- **AC-02-03:** Given both `src/claude/skills/` and `.claude/skills/` exist (development + dogfooding), when skill path resolution runs, then `.claude/skills/` is tried first (installed path takes precedence, since it reflects the runtime layout)
- **AC-02-04:** Given neither path contains the SKILL.md file, when skill path resolution runs, then the skill is skipped without error (fail-open)
- **AC-02-05:** Given the resolved path is used in the returned `path` field of the skill object, when the path is included in agent prompt injection, then it is a relative path from the project root (e.g., `.claude/skills/development/code-implementation/SKILL.md` or `src/claude/skills/development/code-implementation/SKILL.md`)

### FR-03: Align test fixtures with production manifest schema

Test fixtures must use the production manifest format (flat string arrays in `ownership[agent].skills`) and at least one test must validate against the real `skills-manifest.json`.

**Acceptance Criteria:**

- **AC-03-01:** Given the mock manifest in `skill-injection.test.cjs`, when the `ownership[agent].skills` field is inspected, then it contains flat arrays of skill ID strings (e.g., `["TEST-001", "TEST-002"]`) not objects
- **AC-03-02:** Given the test suite includes a production manifest integration test, when the test loads the real `skills-manifest.json` from `src/claude/hooks/config/`, then it calls `getAgentSkillIndex('software-developer')` and asserts the result contains exactly 14 entries with valid `id`, `name`, `description`, and `path` fields
- **AC-03-03:** Given all existing test cases are updated to use the new mock schema format, when the full test suite runs, then all tests pass (no regressions)
- **AC-03-04:** Given the mock manifest needs additional lookup tables to support the rewritten function, when mock `skill_lookup` or `path_lookup` tables are needed, then they are included in the test fixtures and are consistent with the mock skill IDs and paths

---

## Constraints

- **CON-01:** The production `skills-manifest.json` schema (string arrays in ownership) MUST NOT be changed. The code must adapt to the manifest, not vice versa.
- **CON-02:** The fail-open behavior of `getAgentSkillIndex()` MUST be preserved -- any unresolvable state returns `[]` or skips the individual skill, never throws.
- **CON-03:** The function signature `getAgentSkillIndex(agentName) -> Array<{id, name, description, path}>` MUST NOT change (callers depend on it).
- **CON-04:** Hook module must remain CommonJS (`.cjs` extension, `require()` imports).
- **CON-05:** No git commits during implementation -- the orchestrator manages git operations.

---

## Assumptions

- **ASM-01:** The `path_lookup` table in the manifest (mapping `category/skill-name` -> `agent_name`) can be reverse-indexed to find the directory path for a skill ID by combining `skill_lookup[id] -> agent_name` with a scan of `path_lookup` entries for that agent.
- **ASM-02:** Every skill's SKILL.md frontmatter contains a `skill_id` field matching its manifest ID (verified for DEV-001 in `development/code-implementation/SKILL.md`).
- **ASM-03:** The `_extractSkillDescription()` helper function works correctly and does not need changes.

---

## Files Affected

| File | Change Type | Description |
|------|-------------|-------------|
| `src/claude/hooks/lib/common.cjs` | Modify | Rewrite `getAgentSkillIndex()` to handle string skill IDs and dual-path resolution |
| `src/claude/hooks/tests/skill-injection.test.cjs` | Modify | Update mock fixtures to production schema, add production manifest integration test |
| `src/claude/hooks/config/skills-manifest.json` | Read-only | Production manifest -- not modified, only read |

---

## Glossary

| Term | Definition |
|------|------------|
| `skill_lookup` | Manifest table mapping skill ID (e.g., `"DEV-001"`) to owning agent name (e.g., `"software-developer"`) |
| `path_lookup` | Manifest table mapping skill directory path (e.g., `"development/code-implementation"`) to owning agent name |
| `ownership` | Manifest section mapping agent names to their metadata and list of owned skill IDs |
| fail-open | Design pattern where errors result in graceful degradation (empty return) rather than exceptions |
| SKILL.md frontmatter | YAML header in each skill file containing `skill_id`, `name`, `description`, `owner`, etc. |
