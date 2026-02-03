## Discover Command
Set up a new project or analyze an existing codebase to create a tailored project constitution.

### Usage
```
/discover [options]
```

### Description
The `/discover` command is the universal entry point for setting up a project with the iSDLC framework. It intelligently adapts its behavior based on whether this is a new or existing project.

**For new projects:** Guides you through defining your project, selecting a tech stack, and creating a constitution.

**For existing projects:** Produces a comprehensive discovery report (tech stack, architecture, data model, functional features, test coverage), then generates a tailored constitution.

### Options
| Option | Description |
|--------|-------------|
| `--new` | Force new project flow (skip detection) |
| `--existing` | Force existing project flow (skip detection) |
| `--project {id}` | Target a specific project in monorepo mode |
| `--skip-tests` | Skip test infrastructure evaluation |
| `--skip-skills` | Skip skills.sh integration |
| `--help` | Show this help message |

### Examples
```bash
# Auto-detect project type (recommended)
/discover

# Force new project setup
/discover --new

# Analyze existing project, skip test evaluation
/discover --existing --skip-tests

# Discover a specific project in a monorepo
/discover --project api-service
```

### What It Does

#### For New Projects (is_new_project: true)
1. **Project Vision** (D7) — Interactive elicitation: problem, users, features, constraints → Project Brief
2. **Research** (D3) — 4 parallel research agents: best practices, compliance, performance, testing
3. **Tech Stack Selection** — Recommend cohesive stack, user confirms
4. **Product Requirements** (D7) — Generate PRD from brief + research → functional/NFR/MVP scope
5. **Architecture Blueprint** (D8) — Design components, data model, API structure, directory layout
6. **Constitution** (D3) — Generate from all prior artifacts, interactive article review
7. **Project Structure** (D4) — Scaffold src/ from blueprint, install skills, set up tests
8. **Finalize** — Update state, display summary

#### For Existing Projects (is_new_project: false)
1. **Project Analysis** (4 agents in parallel)
   - **Architecture & Tech Stack** (D1) — Structure, frameworks, dependencies, deployment topology, integrations
   - **Data Model** (D5) — Database schemas, entities, relationships, migrations
   - **Functional Features** (D6) — API endpoints, UI pages, background jobs, business domains
   - **Test Coverage** (D2) — Coverage by type, critical untested paths, test quality
2. **Discovery Report** — Assemble unified report from all analysis
3. **Generate constitution** — Informed by discovery findings
4. **Install skills** — From skills.sh for your tech stack
5. **Fill testing gaps** — Add missing test infrastructure
6. **Configure cloud** — Optional deployment setup

### Output
After completion, you'll have:

**Existing projects:**
- `docs/project-discovery-report.md` - Unified discovery report (tech stack, architecture, data model, features, test coverage)
- `docs/architecture/architecture-overview.md` - Detailed architecture documentation
- `.isdlc/test-evaluation-report.md` - Test analysis with per-type coverage and quality assessment
- `.isdlc/constitution.md` - Tailored project constitution
- `.isdlc/skill-customization-report.md` - Installed skills report

**New projects:**
- `docs/project-brief.md` - Problem statement, users, features, constraints
- `docs/requirements/prd.md` - Product Requirements Document with MVP scope
- `docs/architecture/architecture-overview.md` - Architecture blueprint with data model and API design
- `docs/architecture/data-model.md` - Detailed data model (if >5 entities)
- `.isdlc/constitution.md` - Tailored project constitution
- `src/` - Project structure scaffolded from architecture blueprint
- `tests/` - Test infrastructure (unit, integration, e2e)

**Monorepo mode** (when `--project {id}` is used, CWD matches a registered project, or monorepo detected):
- All `docs/` outputs go to `docs/{project-id}/` instead
- Discovery scopes analysis to the project's path (not entire monorepo root)
- Constitution goes to `.isdlc/projects/{project-id}/constitution.md` (project override)
- State updates go to `.isdlc/projects/{project-id}/state.json`
- External skills install to `.isdlc/projects/{project-id}/skills/external/` (not shared `.claude/skills/external/`)
- External skills manifest at `.isdlc/projects/{project-id}/external-skills-manifest.json`
- Skill report at `.isdlc/projects/{project-id}/skill-customization-report.md`

**CWD-based project resolution** (when `--project` not provided):
- If CWD is inside a registered project path, that project is auto-selected
- Resolution order: `--project` flag > CWD detection > `default_project` > interactive prompt

### Implementation

When this command is invoked:

1. **Launch discover-orchestrator agent** via the Task tool:
   ```
   Task tool → discover-orchestrator agent
   ```

2. **Pass arguments** (if any) to the orchestrator:
   ```json
   {
     "subagent_type": "discover-orchestrator",
     "prompt": "Execute /discover command [--new|--existing] [--project {id}] [--skip-tests] [--skip-skills]",
     "description": "Run project discovery workflow"
   }
   ```
   If `--project {id}` is provided, include it in the prompt so the orchestrator scopes discovery to that project's path and writes outputs to project-scoped locations.

3. **The orchestrator coordinates** the workflow by launching sub-agents:
   - `architecture-analyzer` (D1) - Tech stack, architecture, dependencies, deployment, integrations
   - `test-evaluator` (D2) - Test coverage by type, critical paths, quality assessment
   - `constitution-generator` (D3) - Creates tailored constitution with research
   - `skills-researcher` (D4) - Finds and installs relevant skills
   - `data-model-analyzer` (D5) - Database schemas, entities, relationships, migrations
   - `feature-mapper` (D6) - API endpoints, UI pages, background jobs, business domains
   - `product-analyst` (D7) - Vision elicitation, brainstorming, PRD generation (new projects)
   - `architecture-designer` (D8) - Architecture blueprint from PRD and tech stack (new projects)

   For existing projects, D1, D2, D5, and D6 run **in parallel** during Phase 1.
   For new projects, D7 handles vision + PRD, D8 handles architecture blueprint.

### Related Commands
- `/sdlc feature` - Build a new feature after discover completes
- `/sdlc fix` - Fix a bug after discover completes
- `/sdlc test run` - Run existing tests
- `/sdlc status` - Check current project status

### Prerequisites
- iSDLC framework must be installed (`.isdlc/` and `.claude/` folders exist)
- `state.json` must exist with `project.is_new_project` flag

### See Also
- `.isdlc/constitution.md` - Project constitution
- `.isdlc/state.json` - Project state
