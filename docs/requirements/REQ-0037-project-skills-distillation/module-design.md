# Module Design: Project Skills Distillation

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-02-24
**Coverage**: 90%
**Source**: GitHub #88
**Slug**: REQ-0037-project-skills-distillation

---

## Module Identification

This feature has no new code modules in the traditional sense. The work consists of:

1. **Orchestrator Instructions Module** -- new inline step in `discover-orchestrator.md`
2. **Session Cache Modification** -- Section 9 removal from `rebuildSessionCache()` in `common.cjs`

Both are modifications to existing modules, not new modules. The design below specifies the structure and behavior of the new orchestrator step and the cache modification.

---

## Module 1: Distillation Step (Orchestrator Instructions)

### Responsibility
Read discovery source artifacts, distill each into a concise project skill file, register in the manifest, and trigger cache rebuild. Operates as inline markdown instructions within `discover-orchestrator.md`.

### Boundary Definition
- **Input**: Discovery source artifacts (markdown files produced by D1, D2, D6)
- **Output**: Four skill files in `.claude/skills/external/`, updated `external-skills-manifest.json`
- **Trigger**: Completion of each source phase during discovery (not a standalone step)
- **Scope**: Reads only from discovery outputs; writes only to `.claude/skills/external/` and the manifest

### Internal Structure

#### Skill-to-Source Mapping (Hardcoded)

| Skill File | Skill ID | Source Phase | Source Artifacts | Content Sections |
|------------|----------|-------------|-----------------|-----------------|
| `project-architecture.md` | PROJ-001 | D1 | `docs/project-discovery-report.md` (Architecture section), `docs/architecture/architecture-overview.md` | Component boundaries, data flow summary, integration points, architectural patterns |
| `project-conventions.md` | PROJ-002 | D1 | `docs/project-discovery-report.md` (Patterns/Conventions section) | Naming conventions, error handling patterns, file organization, framework usage |
| `project-domain.md` | PROJ-003 | D6 | D6 feature mapping output, reverse-engineered ACs | Domain terminology, business rules, feature catalog summary |
| `project-test-landscape.md` | PROJ-004 | D2 | `docs/isdlc/test-evaluation-report.md` | Test framework/config, coverage by type, known gaps, fragile areas, test patterns |

#### Execution Sequence

```
DISTILLATION STEP (runs after source phases complete):

Step D.1: Read existing manifest
  - Call: Read docs/isdlc/external-skills-manifest.json
  - On failure: proceed with empty manifest (fail-open)

Step D.2: For each source phase that ran in this discovery:
  Step D.2a: Identify skills mapped to this phase
  Step D.2b: Remove discover-sourced manifest entries for those skills
  Step D.2c: Delete corresponding skill files from .claude/skills/external/
  Step D.2d: Read source artifact(s) for each skill
    - On read failure: skip this skill, log warning, continue to next
  Step D.2e: Distill content using LLM summarization
    - Apply structural template for this skill
    - Enforce 5,000 character limit
    - Include provenance section
  Step D.2f: Write skill file to .claude/skills/external/
    - On write failure: skip this skill, log warning, continue
  Step D.2g: Add manifest entry for this skill
    - source: "discover"
    - bindings: all phases, all agents, always, context

Step D.3: Write updated manifest
  - Call: Write docs/isdlc/external-skills-manifest.json
  - On failure: log warning, continue

Step D.4: Rebuild session cache
  - Call: rebuildSessionCache() (conceptually -- the orchestrator instructs
    the agent to run the rebuild)
  - On failure: log warning, continue

Step D.5: Log distillation summary
  - List skills produced, skipped, and warnings
```

### Estimated Size
- ~200-300 lines added to `discover-orchestrator.md`
- Includes structural templates for all four skills, execution instructions, and error handling

---

## Module 2: Session Cache Modification

### Responsibility
Remove the redundant Section 9 (DISCOVERY_CONTEXT) from `rebuildSessionCache()`.

### Boundary Definition
- **Input**: N/A (deletion)
- **Output**: `rebuildSessionCache()` no longer includes raw discovery report content
- **Side Effect**: Session cache file (`.isdlc/session-cache.md`) no longer contains DISCOVERY_CONTEXT section

### Change Specification

**Remove** from `rebuildSessionCache()` in `common.cjs` (lines ~4114-4131):

```javascript
// Section 9: DISCOVERY_CONTEXT (discover phase artifacts)
parts.push(buildSection('DISCOVERY_CONTEXT', () => {
    const discoveryFiles = [
        { label: 'Project Discovery Report', path: path.join(root, 'docs', 'project-discovery-report.md') },
        { label: 'Test Evaluation Report', path: resolveTestEvaluationPath() },
        { label: 'Reverse Engineer Report', path: path.join(root, 'docs', 'isdlc', 'reverse-engineer-report.md') },
    ];
    const dcParts = [];
    for (const df of discoveryFiles) {
        try {
            const content = fs.readFileSync(df.path, 'utf8');
            if (content.trim().length > 0) {
                dcParts.push(`### ${df.label}\n${content}`);
            }
        } catch (_) { /* skip missing files */ }
    }
    return dcParts.join('\n\n');
}));
```

**No replacement code** -- Section 7 (EXTERNAL_SKILLS) already handles project skill injection.

### Estimated Size
- ~18 lines removed from `common.cjs`
- Test updates: remove/update Section 9 assertions in `test-session-cache-builder.test.cjs`

---

## Skill File Templates

### Template: project-architecture.md (PROJ-001)

```markdown
---
name: project-architecture
description: Distilled project architecture -- components, boundaries, data flow, key patterns
skill_id: PROJ-001
owner: discover-orchestrator
collaborators: []
project: <project-name>
version: 1.0.0
when_to_use: When making architectural decisions, assessing impact, or designing modules
dependencies: []
---

# Project Architecture

## Components
- <Component name>: <single-line responsibility>
  (repeat for each major component/module)

## Data Flow
- <Source> -> <Processing> -> <Destination>
  (repeat for each major data path)

## Integration Points
| Integration | Type | Protocol | Notes |
|-------------|------|----------|-------|
| <name> | <internal/external> | <HTTP/file/etc> | <key detail> |

## Architectural Patterns
- <Pattern>: <where and how it's used>

## Provenance
- **Source**: docs/project-discovery-report.md, docs/architecture/architecture-overview.md
- **Distilled**: <discovery timestamp>
- **Discovery run**: <full|incremental>
```

### Template: project-conventions.md (PROJ-002)

```markdown
---
name: project-conventions
description: Distilled project conventions -- naming, error handling, file organization, patterns
skill_id: PROJ-002
owner: discover-orchestrator
collaborators: []
project: <project-name>
version: 1.0.0
when_to_use: When writing new code, reviewing code, or making style decisions
dependencies: []
---

# Project Conventions

## Naming Conventions
- Files: <pattern>
- Functions/methods: <pattern>
- Variables: <pattern>
- Constants: <pattern>

## Error Handling Patterns
- <Pattern description and where it's used>

## File Organization
- <Directory structure conventions>

## Framework Usage
- <Framework-specific patterns and conventions>

## Provenance
- **Source**: docs/project-discovery-report.md (patterns/conventions section)
- **Distilled**: <discovery timestamp>
- **Discovery run**: <full|incremental>
```

### Template: project-domain.md (PROJ-003)

```markdown
---
name: project-domain
description: Distilled project domain -- terminology, business rules, feature catalog
skill_id: PROJ-003
owner: discover-orchestrator
collaborators: []
project: <project-name>
version: 1.0.0
when_to_use: When understanding business context, writing requirements, or naming domain concepts
dependencies: []
---

# Project Domain

## Domain Terminology
| Term | Definition |
|------|-----------|
| <term> | <definition> |

## Business Rules
- <Rule description>

## Feature Catalog
| Feature | Domain | Description |
|---------|--------|-------------|
| <name> | <domain> | <brief description> |

## Provenance
- **Source**: D6 feature mapping output, reverse-engineered acceptance criteria
- **Distilled**: <discovery timestamp>
- **Discovery run**: <full|incremental>
```

### Template: project-test-landscape.md (PROJ-004)

```markdown
---
name: project-test-landscape
description: Distilled test landscape -- framework, coverage, gaps, patterns, fragile areas
skill_id: PROJ-004
owner: discover-orchestrator
collaborators: []
project: <project-name>
version: 1.0.0
when_to_use: When writing tests, evaluating coverage, or assessing test strategy
dependencies: []
---

# Project Test Landscape

## Test Framework and Config
- Runner: <test runner>
- Assertion: <assertion library>
- Config: <config file locations>

## Coverage Summary
| Type | Count | Coverage | Notes |
|------|-------|----------|-------|
| Unit | <n> | <pct>% | <notes> |
| Integration | <n> | <pct>% | <notes> |
| E2E | <n> | <pct>% | <notes> |

## Known Gaps
- <Gap description and risk level>

## Fragile Areas
- <Area and why it's fragile>

## Test Patterns
- <Pattern description>

## Provenance
- **Source**: docs/isdlc/test-evaluation-report.md
- **Distilled**: <discovery timestamp>
- **Discovery run**: <full|incremental>
```

---

## Dependency Diagram

```
discover-orchestrator.md
    │
    ├── reads ──→ D1 output (architecture-analyzer)
    ├── reads ──→ D2 output (test-evaluator)
    ├── reads ──→ D6 output (feature-mapper)
    │
    ├── writes ──→ .claude/skills/external/project-architecture.md
    ├── writes ──→ .claude/skills/external/project-conventions.md
    ├── writes ──→ .claude/skills/external/project-domain.md
    ├── writes ──→ .claude/skills/external/project-test-landscape.md
    │
    ├── updates ──→ docs/isdlc/external-skills-manifest.json
    │                  (via writeExternalManifest() or equivalent)
    │
    └── calls ──→ rebuildSessionCache()
                      │
                      ├── reads ──→ .claude/skills/external/* (Section 7)
                      ├── reads ──→ external-skills-manifest.json
                      └── writes ──→ .isdlc/session-cache.md

common.cjs (rebuildSessionCache)
    │
    └── Section 9 REMOVED ──→ no longer reads:
          - docs/project-discovery-report.md
          - docs/isdlc/test-evaluation-report.md
          - docs/isdlc/reverse-engineer-report.md
```

No circular dependencies. All data flows in one direction: source artifacts -> skill files -> manifest -> cache -> agent context.

---

## Pending Sections

- Detailed orchestrator markdown wording (deferred to implementation -- requires iterative refinement of LLM prompts for distillation quality)
