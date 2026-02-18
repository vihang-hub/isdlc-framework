# Quick Scan: BUG-0027-GH-15

> Built-in skills (243 SKILL.md files) never injected into agent Task prompts at runtime

## Scope Estimate

| Metric | Value |
|--------|-------|
| **Severity** | Medium-high |
| **Complexity** | Medium |
| **Estimated files to modify** | 3 core + 48 agent files (mechanical) |
| **Estimated new files** | 0 (extends existing) |
| **Estimated new tests** | 15-25 |
| **Related issues** | GitHub #14 (custom skill management — shares injection point) |
| **Backlog item** | 13.2 |

## Keyword Matches

| Keyword | Matches | Notes |
|---------|---------|-------|
| `owned_skills` | 56 agent files (frontmatter) | Metadata only — never read at runtime |
| `SKILL.md` | 242 files in `src/claude/skills/` | Content never loaded into prompts |
| `loadManifest()` | `common.cjs` line 854 | Loads manifest for hooks, not for injection |
| `getSkillOwner()` | `common.cjs` line 870 | Reverse lookup: skill → agent. No agent → skills lookup |
| `skill_lookup` | `skills-manifest.yaml` | Maps skill_id → agent_name. No agent_name → skills |
| `STEP 3d` | `isdlc.md` line ~1020 | Agent delegation prompt — **injection point** |
| `inject` | 0 matches in `isdlc.md` | Confirms no skill injection exists |

## File Impact Analysis

### Core Changes (3 files)

| File | Lines | Change Type | Description |
|------|-------|-------------|-------------|
| `src/claude/commands/isdlc.md` | ~1600 | Modify | STEP 3d: add skill index block to agent delegation prompt |
| `src/claude/hooks/lib/common.cjs` | ~2977 | Modify | Add `getAgentSkillIndex(agentName)` utility function |
| `src/claude/hooks/config/skills-manifest.json` | ~600 | No change | Already has ownership data — consumed by new utility |

### Mechanical Changes (48 agent files)

| Directory | Files | Change Type | Description |
|-----------|-------|-------------|-------------|
| `src/claude/agents/*.md` | ~48 | Modify | Add 1-line instruction: "Consult your owned skills when relevant" |

### Test Files

| File | Change Type |
|------|-------------|
| `tests/test-skill-injection.test.cjs` | New — test `getAgentSkillIndex()` and prompt assembly |

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Token overhead from skill index | Low | One line per skill (~15 words). Largest agent owns 14 skills = 14 lines |
| Agent ignores skill index | Medium | Add explicit instruction in agent files to consult skills |
| Manifest structure mismatch | Low | `getAgentSkillIndex()` validates manifest shape, returns empty on failure |
| Performance: reading SKILL.md at runtime | Low | Agents use Read tool on-demand — no bulk loading |
| Coordination with #14 (custom skills) | Medium | Design injection block to be extensible for both built-in and custom skills |

## Dependencies

- **Consumes**: `skills-manifest.yaml` ownership data, SKILL.md frontmatter descriptions
- **Shares injection point with**: GitHub #14 (custom skill management)
- **No blockers**: Can be implemented independently
