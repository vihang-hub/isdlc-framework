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
```

### What It Does

#### For New Projects (is_new_project: true)
1. **Ask about your project** - What are you building?
2. **Select tech stack** - Language, framework, database
3. **Research best practices** - 4 parallel research agents
4. **Generate constitution** - Interactive article review
5. **Create project structure** - Tech-stack-specific `src/` layout
6. **Set up testing** - Initialize test infrastructure

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
- `.isdlc/constitution.md` - Tailored project constitution
- `src/` - Project structure (tech-stack-specific)
- `tests/` - Test infrastructure

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
     "prompt": "Execute /discover command",
     "description": "Run project discovery workflow"
   }
   ```

3. **The orchestrator coordinates** the workflow by launching sub-agents:
   - `architecture-analyzer` (D1) - Tech stack, architecture, dependencies, deployment, integrations
   - `test-evaluator` (D2) - Test coverage by type, critical paths, quality assessment
   - `constitution-generator` (D3) - Creates tailored constitution with research
   - `skills-researcher` (D4) - Finds and installs relevant skills
   - `data-model-analyzer` (D5) - Database schemas, entities, relationships, migrations
   - `feature-mapper` (D6) - API endpoints, UI pages, background jobs, business domains

   For existing projects, D1, D2, D5, and D6 run **in parallel** during Phase 1.

### Related Commands
- `/sdlc feature` - Build a new feature after discover completes
- `/sdlc fix` - Fix a bug after discover completes
- `/sdlc test run` - Run existing tests
- `/sdlc status` - Check current project status

### Prerequisites
- iSDLC framework must be installed (`.isdlc/` and `.claude/` folders exist)
- `state.json` must exist with `project.is_new_project` flag

### See Also
- `docs/framework-info.md` - Framework overview
- `.isdlc/constitution.md` - Project constitution
- `.isdlc/state.json` - Project state
