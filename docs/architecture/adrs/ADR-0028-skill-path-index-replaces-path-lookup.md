# ADR-0028: Skill Path Index Replaces path_lookup in Manifest

## Status

Accepted

## Context

The `getAgentSkillIndex()` function in common.cjs currently uses `path_lookup` from skills-manifest.json to resolve skill IDs to file paths in the v5+ production schema. The `path_lookup` field is a 246-entry mapping of `category/skill-name` -> `agent-name`, occupying ~250 lines in the manifest.

FR-008 (absorbed from GH #86) requires removing `path_lookup` and `skill_paths` from the manifest to reduce its size and eliminate dead-weight data. However, the impact analysis identified that `path_lookup` IS actively used by `getAgentSkillIndex()` (line 1292) -- contrary to assumption ASM-004 which stated it was unused.

The `skill_lookup` field (skillID -> agent) already exists in the manifest and provides an alternative reverse-index. However, `skill_lookup` maps skill IDs to agents, not skill IDs to file paths. We need a way to resolve skill IDs to file paths without `path_lookup`.

## Decision

Introduce a **per-process cached skill path index** built by scanning the skills directory tree:

1. New private function `_buildSkillPathIndex()` scans `src/claude/skills/` (or `.claude/skills/`) for all SKILL.md files
2. Extracts `skill_id` from each file's YAML frontmatter
3. Builds a `Map<skillID, relativePath>` index
4. Caches the index per-process using the existing `_configCache` pattern with mtime-based invalidation (keyed on the skills directory mtime)

`getAgentSkillIndex()` is refactored to use this index instead of `path_lookup`:

```
Before: path_lookup[path] == agentName -> resolve path to skillID
After:  skillPathIndex[skillID] -> path (direct lookup)
```

This is architecturally cleaner: skill ID is the primary key, and the path is derived from it -- not the other way around.

## Consequences

**Positive:**
- Eliminates dependency on `path_lookup` -- enabling safe removal (FR-008)
- The skill path index is more direct: `skillID -> path` is a single lookup, versus the old approach of iterating all path_lookup entries to find paths owned by the agent
- Per-process caching with mtime invalidation means the directory scan happens once per process (or once per mtime change) -- same performance profile as the existing `_loadConfigWithCache` pattern
- Removes ~250 lines from skills-manifest.json after `path_lookup` is deleted
- Also enables `skill_paths` removal (only 1 entry, minimal impact)

**Negative:**
- First call per process pays a directory scan cost (~242 SKILL.md files with frontmatter extraction). Measured at ~50-100ms on SSD. Subsequent calls use the cache.
- The skills directory mtime check may not detect changes to individual SKILL.md files (directory mtime only changes when files are added/removed, not when existing files are modified). Mitigated by: (a) SKILL.md frontmatter changes are extremely rare, (b) process lifetime is short (single phase delegation), (c) `rebuildSessionCache()` does a full rebuild anyway.
- Temporary dual-mode transition period: during implementation, the refactored function falls back to `path_lookup` if the index build fails. This fallback is removed after tests pass.

## Alternatives Considered

- **Embed skill paths in the `ownership` section**: Add a `paths` array alongside the `skills` array in each agent's ownership entry. Rejected because it duplicates data already derivable from the SKILL.md files and makes the manifest larger rather than smaller.
- **Use `skill_lookup` + naming convention**: Derive the file path from the skill ID using a naming convention (e.g., DEV-001 -> development/code-implementation). Rejected because the convention is not consistent across all categories (some skill names do not match their containing directory names).
- **Precompute skill paths in `rebuildSessionCache()`**: Only resolve paths during cache builds, not at runtime. Rejected because `getAgentSkillIndex()` is still called at runtime for fallback (when cache is absent) and for hook validation.

## Traces

- **Requirements**: FR-008 (AC-008-01, AC-008-02, AC-008-03)
- **Impact Analysis**: "path_lookup IS actively used by getAgentSkillIndex()" finding
- **Constitutional Articles**: Article IV (Explicit Over Implicit), Article V (Simplicity First)
