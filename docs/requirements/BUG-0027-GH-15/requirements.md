# Requirements: BUG-0027-GH-15

> Built-in skills (243 SKILL.md files) never injected into agent Task prompts at runtime

**GitHub**: #15
**Backlog**: 13.2
**Severity**: Medium-high
**Complexity**: Medium

---

## Problem Statement

The framework has 242 SKILL.md files (~56,900 lines of domain expertise) across 17 categories in `src/claude/skills/`. Each agent declares `owned_skills:` in YAML frontmatter (e.g., `DEV-001`, `DEV-002`). The skills-manifest.yaml maps ownership: agent → skills[]. However, **no code reads these SKILL.md files or injects their content into agent Task prompts**.

The entire skills architecture (manifest, ownership, IDs, categories) exists for observability logging only — not capability delivery. Agents operate purely from their agent `.md` instructions + Task prompt context, never seeing the ~50,000+ lines of process steps, validation criteria, and domain knowledge in their owned skills.

## Evidence

1. **STEP 3d in isdlc.md** (~line 1020): Agent delegation prompt includes phase key, artifact folder, workflow modifiers, and discovery context — but zero references to skills, SKILL.md, or owned_skills.

2. **common.cjs**: Has `getSkillOwner(skillId)` (skill → agent lookup) and `getAgentPhase(agentName)` but no `getAgentSkills(agentName)` or any skill content loading function.

3. **Agent files**: Declare `owned_skills:` in frontmatter (e.g., software-developer owns DEV-001 through DEV-014) but contain no instruction to read or consult these skills.

4. **skills-manifest.yaml**: Has full `ownership[agent].skills[]` mapping with `id`, `name`, `path` per skill — sufficient data to build a skill index. But consumed only by hooks (skill-validator, log-skill-usage) for logging.

5. **SKILL.md files**: 100% have a `description` field (one-line, action-oriented, unique per skill). 70% use YAML frontmatter with `description:` on line 3. 30% use markdown format with `## Description` header. All descriptions are extractable.

## Design Decision: Option B — Summaries + On-Demand Reading

Per issue #15 analysis, Option B is the recommended approach:

- **Inject**: A skill index (skill_id + name + one-line description + file path) into agent Task prompts
- **Read**: Agents use the Read tool to consult specific SKILL.md files when relevant to the current task
- **Token cost**: ~1 line per skill. Largest agent (software-developer) owns 14 skills = 14 index lines

This avoids the token explosion of Option A (inject all content) and the complexity of Option C (relevance scoring).

---

## Functional Requirements

### FR-01: Skill Index Utility Function

Add `getAgentSkillIndex(agentName)` to `common.cjs`.

**Input**: Agent name (string, normalized)
**Output**: Array of skill index entries, or empty array on failure

```javascript
// Returns:
[
  { id: "DEV-001", name: "code-implementation", description: "Write production code following designs and best practices", path: "src/claude/skills/development/code-implementation/SKILL.md" },
  { id: "DEV-002", name: "unit-testing", description: "Write and maintain unit tests for code validation", path: "src/claude/skills/testing/unit-testing/SKILL.md" },
  // ...
]
```

**Behavior**:
1. Load manifest via `loadManifest()` (reuses existing mtime cache)
2. Look up `manifest.ownership[agentName]`
3. For each skill in `ownership[agentName].skills[]`:
   - Read the SKILL.md file at `src/claude/skills/{skill.path}/SKILL.md`
   - Extract `description` from YAML frontmatter (line 3: `description: ...`) or markdown header (`## Description` + next line)
   - Build index entry with `id`, `name`, `description`, `path`
4. Return array of index entries
5. On any failure (manifest missing, agent not found, SKILL.md unreadable): return empty array (fail-open)

**Caching**: Description extraction results should be cached alongside manifest data (descriptions don't change between process invocations unless SKILL.md files are modified). Use same mtime-based pattern as `_loadConfigWithCache`.

### FR-02: Skill Index Formatting

Add `formatSkillIndexBlock(skillIndex)` to `common.cjs`.

**Input**: Array from FR-01
**Output**: Formatted text block for injection into Task prompts

```
AVAILABLE SKILLS (consult when relevant using Read tool):
  DEV-001: code-implementation — Write production code following designs and best practices
    → src/claude/skills/development/code-implementation/SKILL.md
  DEV-002: unit-testing — Write and maintain unit tests for code validation
    → src/claude/skills/testing/unit-testing/SKILL.md
  ...
```

**Behavior**:
1. If input array is empty, return empty string (no block injected)
2. Format each entry as: `  {id}: {name} — {description}\n    → {path}`
3. Prefix with header line explaining purpose and how to use

### FR-03: STEP 3d Skill Injection

Modify the agent delegation prompt template in `isdlc.md` STEP 3d to include the skill index block.

**Current template** (~line 1020):
```
Use Task tool → {agent_name} with:
  "Execute Phase {NN} - {Phase Name} for {workflow_type} workflow.
   Artifact folder: {artifact_folder}
   Phase key: {phase_key}
   {WORKFLOW MODIFIERS}
   {DISCOVERY CONTEXT}
   Validate GATE-{NN} on completion."
```

**Modified template**:
```
Use Task tool → {agent_name} with:
  "Execute Phase {NN} - {Phase Name} for {workflow_type} workflow.
   Artifact folder: {artifact_folder}
   Phase key: {phase_key}
   {WORKFLOW MODIFIERS}
   {DISCOVERY CONTEXT}
   {SKILL INDEX BLOCK}
   Validate GATE-{NN} on completion."
```

Where `{SKILL INDEX BLOCK}` is the output of FR-02 for the target agent. Include only if non-empty.

**Note**: This injection point should be designed to accommodate custom skills (#14) in the future. The block format should support both built-in and external skill entries under the same `AVAILABLE SKILLS` header.

### FR-04: Agent Instruction Update

Add a standard instruction to all agent `.md` files that own skills (48 files):

```
## Skills
Consult your owned skills (listed in AVAILABLE SKILLS in your Task prompt) when they are relevant to the current task. Use the Read tool to access the full SKILL.md file for detailed process steps, validation criteria, and examples.
```

**Placement**: After the agent's main instruction sections, before any protocol references.

**Scope**: Only agents that have `owned_skills:` in their frontmatter. Agents with no owned skills get no new instruction.

### FR-05: Description Extraction from SKILL.md

Support both SKILL.md formats for description extraction:

**Format A (YAML frontmatter, 70% of files)**:
```yaml
---
name: code-implementation
description: Write production code following designs and best practices
skill_id: DEV-001
...
---
```
Extract: regex `/^description:\s*["']?(.+?)["']?\s*$/m` on frontmatter block

**Format B (Markdown headers, 30% of files)**:
```markdown
# QL-005: lint-check

## Description
Execute linter and report findings
```
Extract: find `## Description` header, take next non-empty line

**Fallback**: If description can't be extracted, use the `name` field from the manifest as the description.

---

## Non-Functional Requirements

### NFR-01: Token Efficiency
- Skill index block must not exceed 30 lines for any single agent
- One-line-per-skill format (id + name + description + path = 2 lines per skill)
- Largest agent (software-developer, 14 skills) = 29 lines including header. Within budget.

### NFR-02: Performance
- `getAgentSkillIndex()` must complete in <100ms for any agent
- Description extraction cached alongside manifest (mtime-based invalidation)
- No filesystem reads during cached path — descriptions stored in memory after first extraction

### NFR-03: Fail-Open
- If manifest is missing → no skill block injected (empty array)
- If agent has no skills in manifest → no skill block injected
- If SKILL.md file is unreadable → skip that skill, continue with others
- If description can't be extracted → use manifest `name` as fallback
- Never block agent delegation due to skill loading failures

### NFR-04: Extensibility
- The `AVAILABLE SKILLS` block format must accommodate future custom skill entries (#14)
- The `getAgentSkillIndex()` function should accept an optional second parameter for external skills to merge
- The formatting function should not assume all skills come from the built-in manifest

### NFR-05: Backward Compatibility
- Agents that don't receive a skill index block must continue to work identically
- The `owned_skills:` frontmatter in agent files remains metadata — not consumed by the new injection code (manifest is the source of truth)
- Existing hook behavior (skill-validator, log-skill-usage) is unchanged

---

## Acceptance Criteria

### AC-01: Utility Function
- [ ] `getAgentSkillIndex("software-developer")` returns 14 entries with correct ids, names, descriptions, and paths
- [ ] `getAgentSkillIndex("unknown-agent")` returns empty array
- [ ] `getAgentSkillIndex("sdlc-orchestrator")` returns 12 entries (ORCH-001 through ORCH-012)
- [ ] All returned descriptions are non-empty strings
- [ ] All returned paths point to existing SKILL.md files

### AC-02: Format Block
- [ ] `formatSkillIndexBlock([])` returns empty string
- [ ] `formatSkillIndexBlock(entries)` starts with `AVAILABLE SKILLS` header
- [ ] Each entry shows skill_id, name, description, and file path
- [ ] Block is human-readable and follows the specified format

### AC-03: STEP 3d Integration
- [ ] Agent delegation prompt includes `AVAILABLE SKILLS` block when agent has skills
- [ ] Agent delegation prompt has no skill block when agent has no skills
- [ ] Skill block appears after workflow modifiers and before gate validation instruction
- [ ] Block is only included for phase delegations (not setup commands or same-phase sub-delegations)

### AC-04: Agent Files
- [ ] All 48 agent files with `owned_skills:` have the new `## Skills` instruction section
- [ ] Agents without `owned_skills:` are unchanged
- [ ] Instruction references "AVAILABLE SKILLS in your Task prompt" and "Read tool"

### AC-05: Description Extraction
- [ ] YAML-format SKILL.md files have description correctly extracted
- [ ] Markdown-format SKILL.md files (quality-loop, devops stubs) have description correctly extracted
- [ ] Missing or malformed SKILL.md files fall back to manifest `name`

### AC-06: Fail-Open
- [ ] Missing manifest → no skill block, no error, agent delegation proceeds normally
- [ ] Unreadable SKILL.md → that skill skipped, remaining skills still in index
- [ ] Empty ownership for agent → no skill block injected

### AC-07: Caching
- [ ] Second call to `getAgentSkillIndex()` for same agent uses cached descriptions
- [ ] Modifying a SKILL.md file invalidates the cache on next call
- [ ] Cache does not leak between different project roots

---

## Files to Modify

| File | Change | Priority |
|------|--------|----------|
| `src/claude/hooks/lib/common.cjs` | Add `getAgentSkillIndex()`, `formatSkillIndexBlock()`, description extraction logic | P0 |
| `src/claude/commands/isdlc.md` | STEP 3d: add `{SKILL INDEX BLOCK}` to delegation prompt template | P0 |
| `src/claude/agents/*.md` (48 files) | Add `## Skills` instruction section | P1 (mechanical) |
| `tests/test-skill-injection.test.cjs` | New test file for FR-01 through FR-05 | P0 |

## Relationship to GitHub #14 (Custom Skills)

This fix and #14 share the same injection point (STEP 3d). The design here explicitly supports extensibility:
- FR-02 format block uses a generic `AVAILABLE SKILLS` header (not "built-in skills")
- FR-04 instruction says "your owned skills" (covers both built-in and custom)
- NFR-04 requires the utility to accept external skills for merging

Recommended: Implement this fix first, then #14 extends the same injection mechanism.

---

## Implementation Notes

### Description Extraction Strategy

The `description` field is present in 100% of SKILL.md files and is consistently located:
- YAML format (70%): `description:` on line 3 of frontmatter
- Markdown format (30%): First line after `## Description` header

Average description length: ~8 words (4-15 word range). All are action-oriented imperatives ("Write...", "Design...", "Scan..."). No duplicates across the 242 skills.

### Manifest as Source of Truth

The manifest `ownership[agent].skills[]` array is the source of truth for which skills an agent owns, not the `owned_skills:` frontmatter in agent files. The frontmatter is metadata for the manifest generator — the runtime code reads the manifest.

### Token Budget

| Agent | Skills | Index Lines | Est. Tokens |
|-------|--------|-------------|-------------|
| software-developer | 14 | 29 | ~300 |
| sdlc-orchestrator | 12 | 25 | ~260 |
| requirements-analyst | 11 | 23 | ~240 |
| test-design-engineer | 9 | 19 | ~200 |
| Average agent | 5 | 11 | ~120 |
| Total (all agents) | 233 | — | — |

Worst case (software-developer): ~300 tokens added to delegation prompt. Acceptable overhead.
