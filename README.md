# iSDLC Framework for Claude Code

An integrated Software Development Lifecycle (iSDLC) framework designed for Claude Code. Provides structured multi-agent workflows, phase gates, and standardized processes for building web applications.

## Overview

This framework implements a **1-to-1 mapping** between 13 SDLC phases and 13 specialized AI agents. Each phase has exactly ONE dedicated agent, creating clear ownership and simplified workflows.

### Key Features

- **14 Specialized Agents** (1 Orchestrator + 13 Phase Agents)
- **1-to-1 Phase Mapping** - Each agent owns exactly one phase
- **13 Quality Gates** with validation checklists
- **116+ Skills** distributed across agents
- **Monorepo Ready** - shared agents and skills, per-project state
- **Templates** for standardized artifacts
- **Linear Workflow** with clear handoff points

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

You now have the complete structure with 14 specialized agents ready to use.

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

The SDLC Orchestrator will coordinate all 13 phase-specific agents from the root `.claude/agents/` directory.

## Utility Scripts

Run from project directory:

```bash
# Validate project setup
../../isdlc-framework/scripts/validate-state.sh

# Generate status report
../../isdlc-framework/scripts/generate-report.sh
```

## The 14 Specialized Agents

| Phase | Agent | Responsibility |
|-------|-------|----------------|
| **00** | **SDLC Orchestrator** | Workflow coordination, phase gates, conflict resolution |
| **01** | **Requirements Analyst** | Requirements capture, user stories, NFRs |
| **02** | **Solution Architect** | System architecture, tech stack, database design |
| **03** | **System Designer** | API contracts, module design, UI/UX |
| **04** | **Test Design Engineer** | Test strategy, test cases, traceability |
| **05** | **Software Developer** | Implementation (TDD), unit tests |
| **06** | **Integration Tester** | Integration testing, E2E testing |
| **07** | **QA Engineer** | Code review, quality metrics, QA sign-off |
| **08** | **Security & Compliance Auditor** | Security scanning, penetration testing, compliance |
| **09** | **CI/CD Engineer** | Pipeline automation, build configuration |
| **10** | **Dev Environment Engineer** | Local dev setup, developer experience |
| **11** | **Deployment Engineer (Staging)** | Staging deployment, smoke tests, rollback |
| **12** | **Release Manager** | Production deployment, release coordination |
| **13** | **Site Reliability Engineer** | Operations, monitoring, incident response |

## SDLC Phase Flow

```
Phase 01: Requirements → Requirements Analyst → GATE-01
    ↓
Phase 02: Architecture → Solution Architect → GATE-02
    ↓
Phase 03: Design → System Designer → GATE-03
    ↓
Phase 04: Test Strategy → Test Design Engineer → GATE-04
    ↓
Phase 05: Implementation → Software Developer → GATE-05
    ↓
Phase 06: Integration Testing → Integration Tester → GATE-06
    ↓
Phase 07: Code Review & QA → QA Engineer → GATE-07
    ↓
Phase 08: Security Validation → Security & Compliance Auditor → GATE-08
    ↓
Phase 09: CI/CD Setup → CI/CD Engineer → GATE-09
    ↓
Phase 10: Local Dev Setup → Dev Environment Engineer → GATE-10
    ↓
Phase 11: Staging Deployment → Deployment Engineer (Staging) → GATE-11
    ↓
Phase 12: Production Release → Release Manager → GATE-12
    ↓
Phase 13: Operations → Site Reliability Engineer → GATE-13
```

**1-to-1 Mapping**: Each phase has exactly ONE dedicated agent.

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
