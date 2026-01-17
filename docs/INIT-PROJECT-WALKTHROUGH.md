# init-project.sh Script Walkthrough

**Script**: `isdlc-framework/scripts/init-project.sh`
**Purpose**: Initialize a new project with the iSDLC framework
**Date**: 2026-01-17

---

## What the Script Does

The `init-project.sh` script sets up a new project with the iSDLC framework structure. Here's a step-by-step walkthrough:

---

## Step-by-Step Process

### Step 1: Track Selection (NEW!)

The script first asks you to select a workflow track:

```
Select Workflow Track:
1) Quick Flow      - Bug fixes, trivial changes (30min - 2hrs)
2) Standard Flow   - Features, services (4hrs - 3 days)
3) Enterprise Flow - Platforms, compliance (weeks - months)
4) Let orchestrator assess complexity

Select track [1-4]: _
```

**What Happens**:
- User selects 1-4
- Script sets track configuration variables:
  - `TRACK`: "quick" | "standard" | "enterprise" | "auto"
  - `TRACK_NAME`: Display name
  - `COMPLEXITY_LEVEL`: 1 | 2 | 4 | null
  - `PHASES_REQUIRED`: Array of required phase numbers
  - `PHASES_OPTIONAL`: Array of optional phase numbers
  - `PHASES_SKIPPED`: Array of skipped phase numbers

**Example (Standard Flow)**:
```bash
TRACK="standard"
TRACK_NAME="Standard Flow"
COMPLEXITY_LEVEL=2
PHASES_REQUIRED="[1, 2, 3, 4, 5, 6, 7, 9]"
PHASES_OPTIONAL="[8, 10]"
PHASES_SKIPPED="[11, 12, 13]"
```

---

### Step 2: Create Project Directory

```bash
mkdir -p /path/to/your-project
cd /path/to/your-project
```

**What Happens**:
- Creates project directory if it doesn't exist
- Changes into the project directory

---

### Step 3: Find Monorepo Root

```bash
find_monorepo_root() {
    # Searches upward for .claude/skills or isdlc-framework
}
```

**What Happens**:
- Looks for framework resources (agents, skills, templates)
- If found: Sets `MONOREPO_ROOT` and `STANDALONE=false`
- If not found: Sets `STANDALONE=true` (warns user to install framework)

---

### Step 4: Create `.isdlc/` Directory Structure

```bash
mkdir -p .isdlc/phases/{01-requirements,02-architecture,03-design,...}/artifacts
```

**What Happens**:
Creates this directory structure:
```
.isdlc/
├── phases/
│   ├── 01-requirements/
│   │   └── artifacts/
│   ├── 02-architecture/
│   │   └── artifacts/
│   ├── 03-design/
│   │   └── artifacts/
│   ├── ... (all 13 phases)
│   └── 13-operations/
│       └── artifacts/
└── (state.json, constitution.md to be created next)
```

---

### Step 5: Create `state.json` with Track Information (NEW!)

The script creates `.isdlc/state.json` with track configuration:

```json
{
  "framework_version": "1.0.0",
  "project": {
    "name": "your-project",
    "created": "2026-01-17T10:30:00Z",
    "description": ""
  },
  "complexity_assessment": {
    "level": 2,
    "track": "standard",
    "assessed_at": "2026-01-17T10:30:00Z",
    "assessed_by": "manual",
    "dimensions": {
      "architectural": null,
      "security": null,
      "testing": null,
      "deployment": null,
      "team": null,
      "timeline": null
    }
  },
  "workflow": {
    "track": "standard",
    "track_name": "Standard Flow",
    "phases_required": [1, 2, 3, 4, 5, 6, 7, 9],
    "phases_optional": [8, 10],
    "phases_skipped": [11, 12, 13]
  },
  "current_phase": "01-requirements",
  "phases": {
    "01-requirements": {
      "status": "pending",
      "started": null,
      "completed": null,
      "gate_passed": null,
      "artifacts": [],
      "notes": null
    },
    ... (all 13 phases)
  },
  "blockers": [],
  "active_agent": null,
  "history": [
    {
      "timestamp": "2026-01-17T10:30:00Z",
      "agent": "init-script",
      "action": "Project initialized"
    }
  ]
}
```

**Key New Fields**:
- `complexity_assessment.*` - Track selection and assessment data
- `workflow.*` - Which phases are required/optional/skipped

---

### Step 6: Copy Project Constitution

```bash
cp isdlc-framework/templates/constitution.md .isdlc/constitution.md
```

**What Happens**:
- Copies constitution template from framework
- Creates `.isdlc/constitution.md`
- This defines immutable project principles

**Example Constitution Content**:
```markdown
# Project Constitution

## Article I: Specification Primacy
Code serves specifications. Specifications are the source of truth.

## Article II: Test-First Development
Tests MUST be written before implementation. NON-NEGOTIABLE.

... (9 articles total)
```

---

### Step 7: Create Project Config

```bash
cat > .isdlc/config.yaml << EOF
# Project-specific iSDLC configuration
# Inherits from: /path/to/framework/isdlc-framework/config/

project:
  name: "your-project"
  # tech_stack:
  #   frontend: "React"
  #   backend: "Node.js"
  #   database: "PostgreSQL"

# Override framework defaults as needed:
# testing:
#   unit:
#     coverage_target: 90
EOF
```

**What Happens**:
- Creates project-specific config file
- Can override framework defaults
- Inherits from `isdlc-framework/config/` by default

---

### Step 8: Create `.claude/CLAUDE.md`

```bash
mkdir -p .claude
cat > .claude/CLAUDE.md << EOF
# Project: your-project

This project uses the iSDLC Framework.

## Framework Resources

- Skills: ../../.claude/skills/ (116 skills)
- Resources: ../../isdlc-framework/
- State: .isdlc/state.json

## Skills (116 across 10 categories)

| Category | Skills | Purpose |
|----------|--------|---------|
| orchestration | 8 | Workflow, gates, delegation |
| requirements | 10 | Requirements, user stories |
... (full table)

## Current Phase

Check .isdlc/state.json for current phase and status.

## SDLC Phases

01-requirements → 02-architecture → 03-design → 04-test-strategy
→ 05-implementation → 06-testing → 07-code-review → 08-validation
→ 09-cicd → 10-local-testing → 11-test-deploy → 12-production
→ 13-operations
EOF
```

**What Happens**:
- Creates Claude Code context file
- Tells Claude about available skills and agents
- Links to framework resources

---

### Step 9: Create Basic Project Directories

```bash
mkdir -p src tests docs
```

**What Happens**:
- Creates standard project directories
- Ready for code, tests, and documentation

---

### Step 10: Create `.gitignore`

```bash
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
vendor/
.venv/

# Build outputs
dist/
build/
*.egg-info/

# IDE
.idea/
.vscode/
*.swp

# Environment
.env
.env.local

# Logs
*.log
logs/

# Coverage
coverage/
.nyc_output/

# OS
.DS_Store
Thumbs.db
EOF
```

**What Happens**:
- Creates `.gitignore` if it doesn't exist
- Ignores common files (node_modules, .env, etc.)

---

### Step 11: Display Summary

```
Project initialized successfully!

Structure created:
  .isdlc/                  - Project state and artifacts
  .isdlc/state.json        - Current phase and progress
  .isdlc/constitution.md   - Project constitutional principles
  .isdlc/phases/           - Phase artifacts
  .claude/CLAUDE.md        - Project context for Claude

Shared resources from monorepo:
  /path/to/framework/.claude/skills/
  /path/to/framework/isdlc-framework/

Next steps:
  1. cd /path/to/your-project
  2. Review .isdlc/state.json
  3. Start with requirements phase
```

---

## Complete Project Structure After Init

```
your-project/
├── .isdlc/
│   ├── state.json              ← Track configuration, phase status
│   ├── constitution.md         ← Project principles
│   ├── config.yaml             ← Project-specific config
│   └── phases/
│       ├── 01-requirements/
│       │   └── artifacts/
│       ├── 02-architecture/
│       │   └── artifacts/
│       ├── ... (all 13 phases)
│       └── 13-operations/
│           └── artifacts/
├── .claude/
│   └── CLAUDE.md               ← Context for Claude Code
├── src/                        ← Source code (empty)
├── tests/                      ← Tests (empty)
├── docs/                       ← Documentation (empty)
└── .gitignore                  ← Git ignore file
```

---

## Example: Running the Script

### Example 1: Quick Flow Project

```bash
$ ./isdlc-framework/scripts/init-project.sh bug-fix-123

iSDLC Framework - Project Initialization
==========================================
Project:   bug-fix-123
Name:      bug-fix-123

Select Workflow Track:
1) Quick Flow      - Bug fixes, trivial changes (30min - 2hrs)
2) Standard Flow   - Features, services (4hrs - 3 days)
3) Enterprise Flow - Platforms, compliance (weeks - months)
4) Let orchestrator assess complexity

Select track [1-4]: 1

Selected: Quick Flow

Creating project directory...
Creating .isdlc directory structure...
Creating initial state.json...
Copying project constitution...
Creating project config...
Creating CLAUDE.md...
Creating project directories...
Creating .gitignore...

Project initialized successfully!

Structure created:
  .isdlc/                  - Project state and artifacts
  .isdlc/state.json        - Current phase and progress
  .isdlc/constitution.md   - Project constitutional principles
  .isdlc/phases/           - Phase artifacts
  .claude/CLAUDE.md        - Project context for Claude

Next steps:
  1. cd bug-fix-123
  2. Review .isdlc/state.json
  3. Start with requirements phase
```

**Result**: Project configured for Quick Flow (only phases 1, 5, 6)

---

### Example 2: Standard Flow Project

```bash
$ ./isdlc-framework/scripts/init-project.sh user-profile-api

Select track [1-4]: 2

Selected: Standard Flow
```

**Result**: Project configured for Standard Flow (phases 1, 2, 3, 4, 5, 6, 7, 9)

---

### Example 3: Enterprise Flow Project

```bash
$ ./isdlc-framework/scripts/init-project.sh saas-platform

Select track [1-4]: 3

Selected: Enterprise Flow
```

**Result**: Project configured for Enterprise Flow (all 13 phases)

---

### Example 4: Auto-Assessment

```bash
$ ./isdlc-framework/scripts/init-project.sh mystery-project

Select track [1-4]: 4

Selected: Auto-assess
Orchestrator will assess complexity at project start
```

**Result**: Project initialized with `track: "auto"`, orchestrator will assess complexity when you start working on it in Claude Code

---

## Track Configuration in state.json

### Quick Flow Example:
```json
{
  "workflow": {
    "track": "quick",
    "track_name": "Quick Flow",
    "phases_required": [1, 5, 6],
    "phases_optional": [4, 7],
    "phases_skipped": [2, 3, 8, 9, 10, 11, 12, 13]
  }
}
```

### Standard Flow Example:
```json
{
  "workflow": {
    "track": "standard",
    "track_name": "Standard Flow",
    "phases_required": [1, 2, 3, 4, 5, 6, 7, 9],
    "phases_optional": [8, 10],
    "phases_skipped": [11, 12, 13]
  }
}
```

### Enterprise Flow Example:
```json
{
  "workflow": {
    "track": "enterprise",
    "track_name": "Enterprise Flow",
    "phases_required": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    "phases_optional": [],
    "phases_skipped": []
  }
}
```

---

## What Happens Next (In Claude Code)

After running `init-project.sh`, when you start Claude Code in the project:

1. **Orchestrator reads state.json**:
   - Sees selected track (quick/standard/enterprise)
   - Knows which phases are required/optional/skipped

2. **Enforces track throughout workflow**:
   - Only delegates to required agents
   - Skips gate validation for skipped phases
   - Allows adding optional phases if needed

3. **Example (Quick Flow)**:
   - User: "Fix the typo in README"
   - Orchestrator: Sees track=quick, only runs phases 1, 5, 6
   - Phase 01: Brief requirements
   - Phase 05: Make the fix
   - Phase 06: Test rendering
   - **Skips**: Architecture, Design, Test Strategy, Code Review, Security, CI/CD, Deployment, Ops

---

## Key Benefits

1. **Right-Sized Process**: Bug fixes don't require full 13-phase SDLC
2. **Flexible**: Can start Quick, upgrade to Standard if scope grows
3. **Automated**: Orchestrator enforces track automatically
4. **Transparent**: state.json shows exactly which phases will run
5. **Safe**: Cannot accidentally skip critical phases for enterprise projects

---

## Summary

The `init-project.sh` script now:

✅ **Asks for track selection** (Quick/Standard/Enterprise/Auto)
✅ **Configures state.json** with track information
✅ **Creates directory structure** for all phases
✅ **Copies constitution** from framework template
✅ **Sets up Claude context** with framework resources
✅ **Ready for orchestrator** to enforce track during workflow

**Result**: Projects are initialized with the right level of rigor based on complexity!

---

**Script Location**: [isdlc-framework/scripts/init-project.sh](../isdlc-framework/scripts/init-project.sh)
**Documentation**: [SCALE-ADAPTIVE-TRACKS.md](SCALE-ADAPTIVE-TRACKS.md)
**Last Updated**: 2026-01-17
