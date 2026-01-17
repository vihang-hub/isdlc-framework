# iSDLC Framework for Claude Code

An integrated Software Development Lifecycle (iSDLC) framework designed for Claude Code. Provides structured multi-agent workflows, phase gates, and standardized processes for building web applications.

## Overview

This framework implements a 13-phase SDLC with 10 skill categories and 116 total skills. Clone this repo and you're ready to start building projects.

### Key Features

- **116 Skills** across 10 categories
- **13 Phases** from requirements to operations
- **Phase Gates** with validation checklists
- **Monorepo Ready** - shared skills, per-project state
- **Templates** for standardized artifacts
- **Configuration** for coding, testing, and operations standards

## Structure

```
isdlc-framework/                 # Clone this repo
├── .claude/
│   └── skills/                  # Shared skills (116)
│       ├── orchestration/       # 8 skills
│       ├── requirements/        # 10 skills
│       ├── architecture/        # 12 skills
│       ├── design/              # 10 skills
│       ├── testing/             # 13 skills
│       ├── development/         # 14 skills
│       ├── security/            # 13 skills
│       ├── devops/              # 14 skills
│       ├── documentation/       # 10 skills
│       └── operations/          # 12 skills
├── isdlc-framework/             # Shared resources
│   ├── templates/               # 13 document templates
│   ├── checklists/              # 13 phase gate checklists
│   ├── config/                  # 3 config files
│   └── scripts/                 # 3 utility scripts
├── packages/                    # Your projects go here
│   ├── project-a/
│   │   ├── .isdlc/              # Project state & artifacts
│   │   └── .claude/CLAUDE.md
│   └── project-b/
│       └── ...
└── README.md
```

## Getting Started

### Prerequisites

- Claude Code CLI installed
- Bash shell
- `jq` (for scripts) - `brew install jq` or `apt install jq`

### 1. Clone the Framework

```bash
git clone <repo-url> my-monorepo
cd my-monorepo
```

You now have the complete structure with 116 skills ready to use.

### 2. Initialize a Project

```bash
./isdlc-framework/scripts/init-project.sh packages/my-app "My App"
```

This creates:
- `packages/my-app/.isdlc/` - Project state and phase artifacts
- `packages/my-app/.claude/CLAUDE.md` - Project context for Claude

### 3. Start Building

```bash
cd packages/my-app
claude  # Open Claude Code
```

Claude will have access to all 116 skills from the root `.claude/skills/` directory.

## Utility Scripts

Run from project directory:

```bash
# Validate project setup
../../isdlc-framework/scripts/validate-state.sh

# Generate status report
../../isdlc-framework/scripts/generate-report.sh
```

## Skills by Category

| Category | Skills | Purpose |
|----------|--------|---------|
| orchestration | 8 | Workflow management, phase gates, task delegation |
| requirements | 10 | Requirements capture, user stories, traceability |
| architecture | 12 | System design, tech stack, database, security |
| design | 10 | API contracts, UI/UX, modules, error handling |
| testing | 13 | Test strategy, coverage, test data, reporting |
| development | 14 | Implementation, unit tests, code review |
| security | 13 | Threat modeling, vulnerability scanning, compliance |
| devops | 14 | CI/CD, infrastructure, deployment, containers |
| documentation | 10 | Technical docs, API docs, runbooks |
| operations | 12 | Monitoring, alerting, incident response |

## SDLC Phases

| Phase | Name | Primary Skills |
|-------|------|----------------|
| 01 | Requirements Capture | requirements/* |
| 02 | Architecture & Blueprint | architecture/* |
| 03 | Design & API Contracts | design/* |
| 04 | Test Strategy & Design | testing/* |
| 05 | Implementation | development/* |
| 06 | Integration & Testing | testing/* |
| 07 | Code Review & QA | development/code-review |
| 08 | Independent Validation | testing/* |
| 09 | Version Control & CI/CD | devops/* |
| 10 | Local Development & Testing | development/*, testing/* |
| 11 | Test Environment Deployment | devops/* |
| 12 | Production Deployment | devops/* |
| 13 | Production Operations | operations/* |

## Project State

Each project maintains state in `.isdlc/state.json`:

```json
{
  "framework_version": "1.0.0",
  "project": {
    "name": "my-app",
    "created": "2024-01-15T10:00:00Z"
  },
  "current_phase": "01-requirements",
  "phases": {
    "01-requirements": {
      "status": "in_progress",
      "artifacts": []
    }
  },
  "blockers": [],
  "history": []
}
```

## Configuration

### Project Config

Override framework defaults in `.isdlc/config.yaml`:

```yaml
project:
  name: "my-app"
  tech_stack:
    frontend: "React"
    backend: "Node.js"
    database: "PostgreSQL"

testing:
  unit:
    coverage_target: 90  # Override default 80
```

### Framework Defaults

See `isdlc-framework/config/` for:
- `defaults.yaml` - General settings
- `coding-standards.yaml` - Coding conventions
- `testing-standards.yaml` - Testing requirements

## License

MIT License
