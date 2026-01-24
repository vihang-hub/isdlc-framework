## Discover Command
Set up a new project or analyze an existing codebase to create a tailored project constitution.

### Usage
```
/discover [options]
```

### Description
The `/discover` command is the universal entry point for setting up a project with the iSDLC framework. It intelligently adapts its behavior based on whether this is a new or existing project.

**For new projects:** Guides you through defining your project, selecting a tech stack, and creating a constitution.

**For existing projects:** Analyzes your codebase, evaluates test infrastructure, and generates a tailored constitution.

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
1. **Analyze architecture** - Scan codebase, detect technologies
2. **Evaluate tests** - Find existing tests, measure coverage, identify gaps
3. **Generate constitution** - Based on discovered patterns
4. **Install skills** - From skills.sh for your tech stack
5. **Fill testing gaps** - Add missing test infrastructure
6. **Configure cloud** - Optional deployment setup

### Output
After completion, you'll have:
- `.isdlc/constitution.md` - Tailored project constitution
- `docs/architecture/architecture-overview.md` - Architecture documentation (existing projects)
- `.isdlc/test-evaluation-report.md` - Test analysis (existing projects)
- `src/` - Project structure (new projects)
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
   - `architecture-analyzer` - Scans and documents codebase
   - `test-evaluator` - Evaluates test infrastructure
   - `constitution-generator` - Creates tailored constitution
   - `skills-researcher` - Finds and installs relevant skills

### Related Commands
- `/sdlc start` - Begin SDLC workflow after discover completes
- `/sdlc status` - Check current project status
- `/sdlc constitution` - View or edit constitution directly

### Prerequisites
- iSDLC framework must be installed (`.isdlc/` and `.claude/` folders exist)
- `state.json` must exist with `project.is_new_project` flag

### See Also
- `docs/framework-info.md` - Framework overview
- `.isdlc/constitution.md` - Project constitution
- `.isdlc/state.json` - Project state
