# Implementation Notes: BUG-0035-GH-81-82-83

## Summary

Fixed three tightly coupled bugs in `getAgentSkillIndex()` in `src/claude/hooks/lib/common.cjs`:

1. **GH-81**: Function expected skill objects but production manifest (v5+) uses string arrays
2. **GH-82**: Skill path hardcoded to `src/claude/skills/`, fails in installed projects
3. **GH-83**: Test fixtures in `skill-injection.test.cjs` used wrong schema (objects instead of strings)

## Changes Made

### 1. `src/claude/hooks/lib/common.cjs` -- getAgentSkillIndex() rewrite

**Root cause**: The function iterated `ownership[agent].skills` treating each entry as an object (`skill.path`, `skill.id`, `skill.name`). Production manifest v5+ stores skills as flat string arrays (e.g., `["DEV-001", "DEV-002"]`), causing all property accesses to return `undefined` and silently returning `[]`.

**Fix**: Schema detection with dual code paths:

- **String schema (v5+)**: Detects `typeof skills[0] === 'string'`. Builds a reverse index from `path_lookup` (path -> agent) to find all paths owned by the agent. Reads each SKILL.md to extract `skill_id` from YAML frontmatter. Matches extracted skill_ids against the string IDs in the skills array.

- **Legacy object schema (v3)**: Preserves backward compatibility. Uses `skill.id`, `skill.name`, `skill.path` directly from the manifest objects.

- **Dual-path resolution (GH-82 fix)**: Both code paths now try `.claude/skills/{path}/SKILL.md` first (installed projects), then `src/claude/skills/{path}/SKILL.md` (dev mode). The `.claude/` path takes precedence when both exist.

- **Fail-open preserved**: All errors caught at individual skill level. Missing/corrupt manifest returns `[]`. Missing SKILL.md files skip that skill.

### 2. `src/claude/hooks/tests/skill-injection.test.cjs` -- fixture alignment

- Changed manifest `ownership[agent].skills` from object arrays to string arrays
- Added `path_lookup` table to manifest fixtures
- Updated `createMalformedSkill` and `createEmptySkill` to retain `skill_id` in frontmatter (tests description fallback, not ID resolution)
- Updated markdown-format `createSkillFile` to include `skill_id` in frontmatter
- Updated TC-05.2 cache invalidation test to use string-schema skill addition
- Updated TC-05.3 cache isolation test to use string-schema manifest
- All 40 existing tests pass

### 3. No changes to test-bug-0035-skill-index.test.cjs (TDD tests)

All 27 TDD tests written in Phase 05 now pass without modification. These tests validated the expected behavior with production schema fixtures.

## Test Results

| Test Suite | Tests | Pass | Fail |
|-----------|-------|------|------|
| test-bug-0035-skill-index.test.cjs | 27 | 27 | 0 |
| skill-injection.test.cjs | 40 | 40 | 0 |
| Full hooks suite (npm run test:hooks) | 2536 | 2530 | 6* |

*6 pre-existing failures in delegation-gate, gate-blocker-extended, and workflow-completion-enforcer -- unrelated to this fix.

## Design Decisions

1. **Schema detection via typeof check**: Using `typeof skills[0] === 'string'` is simple and reliable. No version field parsing needed.

2. **Reverse index from path_lookup**: The production manifest has `path_lookup` (path -> agent) but no `skill_id -> path` mapping. We reverse the path_lookup to get all paths for an agent, then read SKILL.md files to find the `skill_id`, creating the mapping.

3. **skill_id extraction from frontmatter**: All production SKILL.md files have `skill_id:` in YAML frontmatter. This is the canonical way to correlate path to skill ID.

4. **.claude/ precedence**: Installed projects copy skills to `.claude/skills/`. This takes precedence over `src/claude/skills/` since installed copies may be customized.

## Traceability

- FR-01: getAgentSkillIndex() handles both string and object schemas
- FR-02: Dual-path resolution (.claude/ and src/claude/)
- FR-03: Test fixtures aligned with production schema
- CON-01: Production manifest schema unchanged
- CON-02: Fail-open behavior preserved
- CON-03: Function signature unchanged
- CON-04: Module remains CommonJS (.cjs)
