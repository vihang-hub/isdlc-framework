# Implementation Notes: BUG-0011-GH-15

## Bug: Skill Injection Into Agent Task Prompts

Built-in skills (242 SKILL.md files) were never injected into agent Task prompts at runtime. The entire skills architecture existed for observability logging only, not capability delivery.

## Changes Made

### 1. `src/claude/hooks/lib/common.cjs` -- New Functions

**`_extractSkillDescription(content)`** (private)
- Extracts description from SKILL.md file content
- Supports dual format: YAML frontmatter (`description: ...`) and Markdown headers (`## Description`)
- Strips quotes from YAML descriptions
- Returns null on failure (triggers fallback to manifest name)

**`getAgentSkillIndex(agentName)`** (exported)
- Accepts agent name string, returns array of `{id, name, description, path}`
- Loads manifest via existing `loadManifest()` (which uses `_loadConfigWithCache`)
- Looks up `manifest.ownership[agentName].skills[]`
- For each skill, reads SKILL.md and extracts description
- Fail-open: returns `[]` on any failure (null input, missing manifest, unknown agent, missing files)
- Skips individual skills with missing SKILL.md files rather than failing entirely

**`formatSkillIndexBlock(skillIndex)`** (exported)
- Formats skill index array into a text block for Task prompt injection
- Returns empty string for empty arrays
- Output format stays within 30-line budget for 14 entries (NFR-01)
- Header includes usage instruction referencing Read tool

### 2. `src/claude/commands/isdlc.md` -- Delegation Template

Added `{SKILL INDEX BLOCK}` placeholder to STEP 3d delegation template:
- Placed after `{WORKFLOW MODIFIERS}` and `{DISCOVERY CONTEXT}`
- Before `Validate GATE-{NN}`
- Instructs orchestrator to look up agent's owned skills and format as AVAILABLE SKILLS block

### 3. Agent .md Files -- 52 Files Modified

Added `## Skills` section to all agent files with non-empty `owned_skills:` in frontmatter:
```
## Skills
Consult your owned skills (listed in AVAILABLE SKILLS in your Task prompt) when they are relevant to the current task. Use the Read tool to access the full SKILL.md file for detailed process steps, validation criteria, and examples.
```

Agents without `owned_skills:` or with empty arrays were left unchanged.

### 4. Test File -- `src/claude/hooks/tests/skill-injection.test.cjs`

Updated the test helper `getAgentOwnedSkills()` to handle YAML list format in agent frontmatter (the original regex only matched inline array format `[...]`, but actual agent files use multiline YAML lists).

## Key Design Decisions

1. **Fail-open everywhere**: All error paths return empty arrays/strings rather than throwing. This preserves the existing fail-open pattern in common.cjs.

2. **No new dependencies**: Uses only `fs`, `path`, and existing common.cjs infrastructure (`loadManifest`, `_loadConfigWithCache`, `getProjectRoot`).

3. **No new hook files**: Functions added to existing common.cjs rather than creating new hook files.

4. **Caching via existing pattern**: `getAgentSkillIndex` leverages `loadManifest()` which already uses mtime-based caching via `_loadConfigWithCache`.

5. **Dual-format description extraction**: Handles both YAML frontmatter (70% of SKILL.md files) and Markdown `## Description` header (30%).

## Test Results

- 40/40 tests passing
- No regressions in existing test suite (49 pre-existing failures unrelated to this change)
- Performance: `getAgentSkillIndex` completes under 100ms (NFR-02)
- Output size: 14-entry block stays under 30 lines (NFR-01)

## Traces

- FR-01, AC-01: getAgentSkillIndex implementation
- FR-02, AC-02: formatSkillIndexBlock implementation
- FR-03, AC-03: STEP 3d template modification
- FR-04, AC-04: Agent file ## Skills sections
- FR-05, AC-05: Dual-format description extraction
- AC-06: Fail-open resilience
- AC-07: Caching behavior
- NFR-01: 30-line output budget
- NFR-02: Performance under 100ms
- NFR-05: No new dependencies or hook files
