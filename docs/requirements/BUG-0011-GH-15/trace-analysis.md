# Trace Analysis: Skills never injected into agent Task prompts

**Generated**: 2026-02-17T23:45:00Z
**Bug**: Built-in skills (243 SKILL.md files) are never injected into agent Task prompts at runtime
**External ID**: GH-15
**Workflow**: fix
**Phase**: 02-tracing

---

## Executive Summary

The skills architecture has all the data infrastructure needed for capability delivery (manifest with ownership mappings, 242 SKILL.md files with extractable descriptions, agent frontmatter declaring owned_skills) but the **delegation prompt template in STEP 3d of isdlc.md completely omits skill content**. The `common.cjs` utility library has functions to look up skills-to-agent (`getSkillOwner`) and agent-to-phase (`getAgentPhase`) but **no agent-to-skills function exists** -- the reverse lookup was never implemented. Additionally, agent `.md` files contain no instruction telling agents to consult their skills. The root cause is a clear omission in the phase-loop delegation code path: the plumbing exists for observability but was never extended to capability injection.

**Root Cause Confidence**: HIGH
**Severity**: Medium-high (feature gap, not crash)
**Estimated Complexity**: Medium (3 core files + 50 mechanical agent file updates)

---

## Symptom Analysis

### Error Messages / Observable Symptoms

This is not a crash bug -- it is a **silent feature gap**. There are no error messages or stack traces. The symptoms are:

1. **Agents never reference SKILL.md content**: When agents are delegated to via the Task tool, their prompt contains phase key, artifact folder, workflow modifiers, and optional discovery context -- but zero skill information. Agents operate purely from their agent `.md` instructions and Task prompt context.

2. **56,900 lines of domain expertise are inert**: The 242 SKILL.md files across 17 categories contain detailed process steps, validation criteria, examples, and domain knowledge that agents never see.

3. **`owned_skills:` frontmatter is metadata-only**: 59 agent files declare `owned_skills:` in YAML frontmatter, but no runtime code reads this. The manifest (`skills-manifest.yaml`) is the source of truth, but it too is consumed only by observability hooks.

### Triggering Conditions

The symptom is always present -- every phase delegation omits skills. There is no conditional trigger; the injection code simply does not exist.

### Scope of Impact

- **59 agent files** declare `owned_skills:` (more than the 48 cited in requirements -- tracing, impact-analysis, and quick-scan sub-agents also have them)
- **242 SKILL.md files** are never loaded into agent prompts
- **All phase delegations** are affected (STEP 3d handles every phase in every workflow)

### Source Location of Symptoms

| Symptom | File | Line(s) | Evidence |
|---------|------|---------|----------|
| No skill injection in delegation prompt | `src/claude/commands/isdlc.md` | 1020-1028 | Template has `{WORKFLOW MODIFIERS}` and `{DISCOVERY CONTEXT}` but no `{SKILL INDEX BLOCK}` |
| No agent-to-skills lookup function | `src/claude/hooks/lib/common.cjs` | 870-889 | `getSkillOwner(skillId)` exists (skill-to-agent), `getAgentPhase(agentName)` exists (agent-to-phase), but no `getAgentSkills(agentName)` or `getAgentSkillIndex(agentName)` |
| No "AVAILABLE SKILLS" or "SKILL INDEX" in source tree | `src/` (entire tree) | N/A | `grep -r "getAgentSkill\|formatSkillIndex\|AVAILABLE SKILLS\|SKILL INDEX" src/` returns 0 matches |
| Skills consumed only by observability hooks | `src/claude/hooks/skill-validator.cjs` | 28-33 | Imports `loadManifest` only for phase authorization logging |
| Skills consumed only by logging hooks | `src/claude/hooks/log-skill-usage.cjs` | 23-29 | Imports `loadManifest` only for usage logging |

---

## Execution Path

### Path 1: STEP 3d Phase Delegation (the injection point)

The phase-loop controller in `isdlc.md` handles every phase delegation:

```
isdlc.md STEP 3d (line 1020-1028)
  |
  v
Resolve agent_name from PHASE-AGENT table (line 987-1014)
  |
  v
Read agent_modifiers from state.json -> workflows.json (line 1016)
  |
  v
Check if phase is 02/03 -> include DISCOVERY CONTEXT (line 1018)
  |
  v
Build delegation prompt:
  "Execute Phase {NN} - {Phase Name} for {workflow_type} workflow.
   Artifact folder: {artifact_folder}
   Phase key: {phase_key}
   {WORKFLOW MODIFIERS: {json} -- if applicable}
   {DISCOVERY CONTEXT: ... -- if phase 02 or 03}
   Validate GATE-{NN} on completion."
  |
  v
Task tool -> {agent_name} with prompt
  |
  v
[NO SKILL CONTENT IN PROMPT]
```

**Gap identified**: Between the DISCOVERY CONTEXT inclusion (line 1018) and the final prompt assembly (line 1020-1028), there is no step that:
1. Looks up the target agent's skills from the manifest
2. Reads SKILL.md descriptions
3. Formats a skill index block
4. Injects it into the prompt

### Path 2: loadManifest() -> _loadConfigWithCache() (the caching pattern to reuse)

```
loadManifest() (common.cjs line 857-863)
  |
  v
getManifestPath() (line 835-851)
  - Checks: .claude/hooks/config/skills-manifest.json   <-- DOES NOT EXIST in dogfood
  - Checks: .isdlc/config/skills-manifest.json           <-- DOES NOT EXIST in dogfood
  - Returns null if neither found
  |
  v
_loadConfigWithCache(manifestPath, 'skills-manifest') (line 140-164)
  - Cache key: {projectRoot}:skills-manifest
  - Checks mtime: if unchanged, returns cached data
  - If changed: re-reads, re-parses JSON, updates cache
  - On error: returns null (fail-open)
```

**Key finding for implementation**: The `_loadConfigWithCache` function provides the exact caching pattern needed for skill descriptions. It uses `Map` keyed by `{projectRoot}:{configName}` with `mtimeMs` for invalidation. The new `getAgentSkillIndex()` function should use this same pattern for caching extracted descriptions.

**Secondary finding**: In the dogfood environment, `skills-manifest.json` does not exist at either search path. The manifest only exists as YAML at `src/isdlc/config/skills-manifest.yaml`. The installer (`lib/installer.js` line 401-409) converts YAML to JSON at install time. This means the new function needs the JSON manifest to be present, which requires running the installer or manually creating it. For implementation, `getManifestPath()` may need an additional search path, or tests should ensure the JSON is generated.

### Path 3: skills-manifest.yaml ownership structure

```
skills-manifest.yaml
  |
  v
ownership:
  {agent-name}:              # e.g., "software-developer"
    agent_id: "{NN}"         # e.g., "05"
    phase: "{phase-key}"     # e.g., "05-implementation"
    skill_count: {N}         # e.g., 14
    skills:                  # Array of skill entries
      - id: {SKILL-ID}      # e.g., "DEV-001"
        name: {skill-name}   # e.g., "code-implementation"
        path: {relative-path} # e.g., "development/code-implementation"
  |
  v
skill_lookup:                # Reverse mapping (skill_id -> agent_name)
  {SKILL-ID}: {agent-name}
```

**Agent-to-skills lookup is straightforward**: `manifest.ownership[agentName].skills` gives the array directly. Each entry has `id`, `name`, and `path`. The `path` field is relative to `src/claude/skills/` (e.g., `development/code-implementation` -> `src/claude/skills/development/code-implementation/SKILL.md`).

**Confirmed**: The manifest has full data for building a skill index. Only the code to traverse `ownership[agent].skills[]` and read descriptions is missing.

### Path 4: SKILL.md description extraction

Two formats exist with consistent description placement:

**Format A -- YAML frontmatter (70% of files, ~170 files)**:
```yaml
---
name: code-implementation
description: Write production code following designs and best practices
skill_id: DEV-001
owner: software-developer
...
---
```
- Description is on line 3 in the frontmatter block
- Extractable via regex: `/^description:\s*["']?(.+?)["']?\s*$/m`
- Example file: `src/claude/skills/development/code-implementation/SKILL.md`

**Format B -- Markdown headers (30% of files, ~72 files)**:
```markdown
# QL-005: lint-check

## Description
Execute linter and report findings

## Owner
...
```
- Description is the first non-empty line after `## Description` header
- Extractable via: find `## Description`, take next non-empty line
- Example files: `src/claude/skills/quality-loop/lint-check/SKILL.md`, `src/claude/skills/quality-loop/build-verification/SKILL.md`

**Both formats confirmed extractable**: Descriptions are short (4-15 words), action-oriented, unique per skill.

---

## Root Cause Analysis

### Hypothesis 1: Delegation prompt template omits skill injection (CONFIRMED -- PRIMARY ROOT CAUSE)

**Confidence**: HIGH (direct evidence)

**Evidence**:
1. `isdlc.md` lines 1020-1028 show the complete delegation prompt template with no skill-related placeholders
2. Zero matches for "AVAILABLE SKILLS", "SKILL INDEX", "getAgentSkill", "formatSkillIndex" across entire `src/` tree
3. The template was designed with extensibility points (`{WORKFLOW MODIFIERS}`, `{DISCOVERY CONTEXT}`) but skills were never added as an extensibility point

**Root cause**: The delegation prompt template in STEP 3d was written before skill injection was considered a runtime feature. The skills infrastructure was built for observability (hooks that log usage) but the critical last-mile step -- injecting skill awareness into the agent's prompt -- was never implemented.

### Hypothesis 2: Agent-to-skills utility function was never written (CONFIRMED -- SECONDARY ROOT CAUSE)

**Confidence**: HIGH (direct evidence)

**Evidence**:
1. `common.cjs` exports `getSkillOwner(skillId)` (skill -> agent) and `getAgentPhase(agentName)` (agent -> phase) but no `getAgentSkills(agentName)` or `getAgentSkillIndex(agentName)`
2. The `loadManifest()` function loads the manifest, and `manifest.ownership[agent].skills` contains the data, but no code traverses this path
3. No description extraction function exists -- SKILL.md files are never read by any hook or utility

**Root cause**: The reverse lookup pattern (agent -> skills) was skipped when the manifest utilities were built. The existing functions serve the hooks (which need skill -> agent for validation and agent -> phase for authorization) but the agent -> skills direction serves injection, which was not implemented.

### Hypothesis 3: Agent files lack instruction to consult skills (CONFIRMED -- TERTIARY ROOT CAUSE)

**Confidence**: HIGH (direct evidence)

**Evidence**:
1. 59 agent files declare `owned_skills:` in frontmatter but contain no instruction text telling the agent to use these skills
2. 9 discover agents have a `## Skills` section with hardcoded skill tables -- but these are informational metadata, not dynamic references to an AVAILABLE SKILLS block
3. Even if skills were injected into the prompt, agents would not know to use them without an instruction like "Consult your owned skills when relevant"

**Root cause**: The `owned_skills:` frontmatter was designed for the manifest generator to build the ownership mapping, not for the agent to act on. Agents need explicit instructions to use the Read tool to consult SKILL.md files.

### Hypothesis Ranking

| Rank | Hypothesis | Confidence | Impact |
|------|-----------|------------|--------|
| 1 | STEP 3d delegation prompt omits skill injection | HIGH | Blocking -- no skill data reaches agents |
| 2 | No agent-to-skills utility function | HIGH | Blocking -- no code exists to build skill index |
| 3 | Agent files lack skill consultation instruction | HIGH | Usability -- even with injection, agents need guidance |

### Suggested Fixes

**Fix 1 (FR-01)**: Add `getAgentSkillIndex(agentName)` to `common.cjs`
- Load manifest via existing `loadManifest()`
- Look up `manifest.ownership[agentName].skills[]`
- For each skill, resolve SKILL.md path: `src/claude/skills/{skill.path}/SKILL.md`
- Extract description using dual-format parsing (YAML frontmatter or Markdown header)
- Cache extracted descriptions using `_loadConfigWithCache` pattern
- Return array of `{ id, name, description, path }` entries
- **Complexity**: Low-medium. Follows existing patterns in common.cjs.

**Fix 2 (FR-02)**: Add `formatSkillIndexBlock(skillIndex)` to `common.cjs`
- Format entries as human-readable text block with `AVAILABLE SKILLS` header
- Return empty string for empty input (no injection)
- **Complexity**: Low. Pure formatting function.

**Fix 3 (FR-03)**: Modify STEP 3d delegation template in `isdlc.md`
- Add `{SKILL INDEX BLOCK}` placeholder after `{DISCOVERY CONTEXT}`
- Include instructions for when to include/omit the block
- **Complexity**: Low. Single template modification.

**Fix 4 (FR-04)**: Add `## Skills` instruction to agent files
- 59 agent files with `owned_skills:` need the standard instruction
- 9 already have a `## Skills` section (discover agents) -- these need updating to reference AVAILABLE SKILLS
- 50 need new `## Skills` section added
- **Complexity**: Low (mechanical, repetitive).

**Fix 5 (FR-05)**: Implement dual SKILL.md format extraction
- YAML frontmatter: regex on `description:` line within `---` blocks
- Markdown header: find `## Description`, take next non-empty line
- Fallback: use `name` from manifest if extraction fails
- **Complexity**: Low. Two regex patterns plus fallback.

### Additional Implementation Notes

**Manifest availability concern**: In the dogfood environment, `skills-manifest.json` does not exist at the runtime search paths (`.claude/hooks/config/` or `.isdlc/config/`). The installer converts YAML to JSON at install time. For the new function to work:
- Option A: Run the installer to generate the JSON (production path)
- Option B: Add YAML parsing capability to `getManifestPath()` / `loadManifest()` (fragile, adds dependency)
- Option C: Add `src/isdlc/config/skills-manifest.yaml` as a third search path with YAML parsing (pragmatic for dogfood)
- **Recommendation**: The requirements spec (FR-01) assumes `loadManifest()` works. For testing, ensure the JSON is generated. For dogfood, the installer should be run. No changes needed to `loadManifest()` itself.

**Agent count discrepancy**: Requirements cite 48 agents with `owned_skills:`. Tracing found 59. The additional 11 are in subdirectories: `tracing/` (4 agents), `impact-analysis/` (4 agents), `quick-scan/` (1 agent), and additional discover agents. FR-04 should cover all 59, not just 48.

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-17T23:45:00Z",
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "error_keywords": ["skills", "SKILL.md", "owned_skills", "skill injection", "delegation prompt", "STEP 3d", "getAgentSkillIndex"],
  "files_traced": {
    "delegation_template": "src/claude/commands/isdlc.md:1020-1028",
    "skill_utilities": "src/claude/hooks/lib/common.cjs:835-889",
    "caching_pattern": "src/claude/hooks/lib/common.cjs:140-164",
    "manifest_yaml": "src/isdlc/config/skills-manifest.yaml",
    "skill_validator_hook": "src/claude/hooks/skill-validator.cjs",
    "skill_logging_hook": "src/claude/hooks/log-skill-usage.cjs",
    "sample_yaml_skill": "src/claude/skills/development/code-implementation/SKILL.md",
    "sample_md_skill": "src/claude/skills/quality-loop/lint-check/SKILL.md",
    "sample_agent": "src/claude/agents/05-software-developer.md"
  },
  "key_findings": {
    "skill_md_count": 242,
    "agents_with_owned_skills": 59,
    "agents_already_have_skills_section": 9,
    "manifest_json_exists": false,
    "manifest_yaml_exists": true,
    "installer_converts_yaml_to_json": true,
    "getAgentSkillIndex_exists": false,
    "formatSkillIndexBlock_exists": false,
    "delegation_template_has_skill_placeholder": false
  }
}
```
