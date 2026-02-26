# Data Flow: REQ-0042 Session Cache Markdown Tightening

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-02-26
**Coverage**: All data paths

---

## 1. Source-to-Cache Data Flow

### SKILL_INDEX Path

```
skills-manifest.json (disk)
  |
  v
loadManifest() -> manifest.ownership (agent -> skills mapping)
  |
  v
For each agent:
  getAgentSkillIndex(agentName) -> [{id, name, description, path}, ...]
    |
    v
  formatSkillIndexBlock(skillIndex) -> compact single-line entries with shortened paths (NO banner)
    |
    v
  "## Agent: {name}\n{entries}"
  |
  v
Header prepended: "AVAILABLE SKILLS...\nBase path: src/claude/skills/{category}/{name}/SKILL.md\n\n" + blocks.join('\n\n')
  |
  v
buildSection('SKILL_INDEX', ...) -> wrapped in <!-- SECTION --> delimiters
```

### ROUNDTABLE_CONTEXT Path

```
persona-*.md files (disk, 3 files)          topic-*.md files (disk, 6 files)
  |                                           |
  v                                           v
fs.readFileSync() -> rawContent              fs.readFileSync() -> rawContent
  |                                           |
  v                                           v
tightenPersonaContent(rawContent)            tightenTopicContent(rawContent)
  - Strip YAML frontmatter                    - Strip YAML frontmatter
  - Strip sections 4, 6, 8, 9, 10            - Return remaining content
  - Compact section 7 checklists
  |                                           |
  v                                           v
"### Persona: {name}\n{tightened}"           "### Topic: {id}\n{tightened}"
  |                                           |
  +-------------------------------------------+
  |
  v
rtParts.join('\n\n')
  |
  v
buildSection('ROUNDTABLE_CONTEXT', ...) -> wrapped in <!-- SECTION --> delimiters
```

### DISCOVERY_CONTEXT Path

```
project-discovery-report.md (disk)
  |
  v
fs.readFileSync() -> rawContent
  |
  v
condenseDiscoveryContent(rawContent)
  - Keep headings (lines starting with #)
  - Keep table rows (lines starting with |)
  - Keep list items (lines starting with - or * or numbered)
  - Strip all prose paragraph lines
  - Collapse consecutive blank lines
  |
  v
buildSection('DISCOVERY_CONTEXT', ...) -> wrapped in <!-- SECTION --> delimiters
```

## 2. Cache Assembly Flow (Complete)

```
rebuildSessionCache(options)
  |
  +-- Section 1: CONSTITUTION              (unchanged)
  +-- Section 2: WORKFLOW_CONFIG            (TOON encoded, REQ-0041)
  +-- Section 3: ITERATION_REQUIREMENTS     (TOON encoded, REQ-0041)
  +-- Section 4: ARTIFACT_PATHS             (TOON encoded, REQ-0041)
  +-- Section 5: SKILLS_MANIFEST            (TOON encoded, REQ-0041)
  +-- Section 6: SKILL_INDEX                [TIGHTENED: FR-001, FR-002]
  +-- Section 7: EXTERNAL_SKILLS            (unchanged)
  +-- Section 8: ROUNDTABLE_CONTEXT         [TIGHTENED: FR-003, FR-004, FR-005]
  +-- Section 9: DISCOVERY_CONTEXT          [TIGHTENED: FR-006]
  |
  v
header + parts.join('\n\n')
  |
  v
fs.writeFileSync(.isdlc/session-cache.md)
  |
  v
Return { path, size, hash, sections, skipped }
```

## 3. Downstream Consumption Flow (Unchanged)

```
inject-session-cache.cjs (SessionStart hook)
  |
  v
fs.readFileSync(.isdlc/session-cache.md) -> process.stdout.write(content)
  |
  v
LLM context window receives full cache
  |
  +-- Orchestrator (isdlc.md step 7a):
  |     Extracts ROUNDTABLE_CONTEXT section
  |     Splits on "### Persona:" -> personaContent (aggressively tightened)
  |     Splits on "### Topic:" -> topicContent (frontmatter stripped)
  |     Inlines into dispatch prompt as PERSONA_CONTEXT, TOPIC_CONTEXT
  |
  +-- Phase agents:
  |     Parse SKILL_INDEX for skill IDs and shortened paths (compact single-line format)
  |     Reconstruct full path using base path convention from section header
  |
  +-- Various agents:
        Read DISCOVERY_CONTEXT for project knowledge (structured content only)
```

## 4. State Mutations

| Mutation Point | What Changes | Readers |
|---------------|-------------|---------|
| `formatSkillIndexBlock()` output | Compact single-line format with shortened paths, no banner | `rebuildSessionCache()` SKILL_INDEX builder |
| Persona content in ROUNDTABLE_CONTEXT | Sections 4,6,8,9,10 stripped; section 7 compacted; frontmatter stripped | Orchestrator extraction at dispatch |
| Topic content in ROUNDTABLE_CONTEXT | Frontmatter stripped | Orchestrator extraction at dispatch |
| Discovery content in DISCOVERY_CONTEXT | All prose stripped; headings, tables, lists preserved | Various agents reading project context |
| `.isdlc/session-cache.md` | Significantly smaller file size (~29% total reduction) | `inject-session-cache.cjs` |

## 5. Persistence Boundaries

- **Source files**: Unchanged on disk (read-only)
- **Cache file**: Regenerated on each `rebuildSessionCache()` call (transient artifact)
- **No session state**: Tightening functions are stateless, pure transformations
- **No database/external storage**: All data flows through the filesystem
