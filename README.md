# iSDLC Framework for Claude Code

An integrated Software Development Lifecycle (iSDLC) framework designed for Claude Code. Provides structured multi-agent workflows, phase gates, and standardized processes for building software projects using AI-powered development.

## Overview

This framework implements a **1-to-1 mapping** between 13 SDLC phases and 13 specialized AI agents. Each phase has exactly ONE dedicated agent, creating clear ownership, simplified workflows, and explicit handoff points.

### Key Features

- **14 Specialized Agents** (1 Orchestrator + 13 Phase Agents)
- **1-to-1 Phase Mapping** - Each agent owns exactly one phase
- **13 Quality Gates** with validation checklists
- **116 Skills** distributed across 10 categories
- **Standardized Artifacts** - Templates for each phase's deliverables
- **Linear Workflow** with clear handoff points
- **Monorepo Ready** - Share framework across multiple projects

## Project Structure

```
integrated-sdls-framework-v0.1/
├── .claude/
│   ├── agents/                    # 14 Agent definitions
│   │   ├── 00-sdlc-orchestrator.md
│   │   ├── 01-requirements-analyst.md
│   │   ├── 02-solution-architect.md
│   │   ├── 03-system-designer.md
│   │   ├── 04-test-design-engineer.md
│   │   ├── 05-software-developer.md
│   │   ├── 06-integration-tester.md
│   │   ├── 07-qa-engineer.md
│   │   ├── 08-security-compliance-auditor.md
│   │   ├── 09-cicd-engineer.md
│   │   ├── 10-dev-environment-engineer.md
│   │   ├── 11-deployment-engineer-staging.md
│   │   ├── 12-release-manager.md
│   │   └── 13-site-reliability-engineer.md
│   ├── skills/                    # 116 Skills across 10 categories
│   │   ├── orchestration/         # 8 skills
│   │   ├── requirements/          # 10 skills
│   │   ├── architecture/          # 12 skills
│   │   ├── design/                # 10 skills
│   │   ├── testing/               # 13 skills
│   │   ├── development/           # 14 skills
│   │   ├── devops/                # 14 skills
│   │   ├── security/              # 13 skills
│   │   ├── operations/            # 12 skills
│   │   └── documentation/         # 10 skills
│   └── settings.local.json        # Claude Code configuration
├── isdlc-framework/               # Shared framework resources
│   ├── templates/                 # Document templates (7 files)
│   ├── checklists/                # Phase gate checklists (13 files)
│   ├── config/                    # Configuration files (3 files)
│   │   ├── defaults.yaml
│   │   ├── coding-standards.yaml
│   │   └── testing-standards.yaml
│   └── scripts/                   # Utility scripts (3 files)
│       ├── init-project.sh
│       ├── validate-state.sh
│       └── generate-report.sh
├── docs/                          # Additional documentation
│   ├── NEW-agents-and-skills-architecture.md
│   ├── SKILL-DISTRIBUTION.md
│   ├── DETAILED-SKILL-ALLOCATION.md
│   ├── WORKFLOW-ALIGNMENT.md
│   ├── SKILL-REDISTRIBUTION-COMPLETE.md
│   └── RESTRUCTURING-SUMMARY.md
└── README.md                      # This file
```

## The 14 Specialized Agents

Each agent is a specialized AI with specific responsibilities, skills, and deliverables mapped to exactly one SDLC phase.

| Phase | Agent | Responsibility | Key Artifacts |
|-------|-------|----------------|---------------|
| **00** | **SDLC Orchestrator** | Workflow coordination, phase gates, conflict resolution | workflow-state.json, gate-validation.json |
| **01** | **Requirements Analyst** | Requirements capture, user stories, NFRs | requirements-spec.md, user-stories.json, nfr-matrix.md |
| **02** | **Solution Architect** | System architecture, tech stack, database design | architecture-overview.md, tech-stack-decision.md, database-design.md, ADRs |
| **03** | **System Designer** | API contracts, module design, UI/UX wireframes | openapi.yaml, module-designs/, wireframes/, error-taxonomy.md |
| **04** | **Test Design Engineer** | Test strategy, test cases, traceability | test-strategy.md, test-cases/, traceability-matrix.csv |
| **05** | **Software Developer** | Implementation (TDD), unit tests, coding standards | source-code/, unit-tests/, coverage-report.html |
| **06** | **Integration Tester** | Integration testing, E2E testing, API contract tests | integration-tests/, e2e-tests/, test-execution-report.md |
| **07** | **QA Engineer** | Code review, quality metrics, QA sign-off | code-review-report.md, quality-metrics.md, qa-sign-off.md |
| **08** | **Security & Compliance Auditor** | Security scanning, penetration testing, compliance | security-scan-report.md, penetration-test-report.md, compliance-checklist.md |
| **09** | **CI/CD Engineer** | Pipeline automation, build configuration, artifact registry | ci-config.yaml, cd-config.yaml, Dockerfile, pipeline-tests/ |
| **10** | **Dev Environment Engineer** | Local dev setup, environment parity, developer docs | docker-compose.yml, dev-guide.md, local-testing-guide.md |
| **11** | **Deployment Engineer (Staging)** | Staging deployment, smoke tests, rollback procedures | deployment-log-staging.md, smoke-test-results.md, rollback-plan.md |
| **12** | **Release Manager** | Production deployment, release coordination, go-live | deployment-log-production.md, release-notes.md, post-deployment-report.md |
| **13** | **Site Reliability Engineer** | Operations, monitoring, incident response, SLAs | monitoring-config/, alert-rules.yaml, incident-reports/, sla-tracking.md |

## SDLC Phase Flow

The framework implements a linear 13-phase workflow with quality gates between each phase:

```
Phase 01: Requirements Capture
    ↓ (Requirements Analyst)
    → GATE-01: Requirements validation
    ↓
Phase 02: Architecture & Blueprint
    ↓ (Solution Architect)
    → GATE-02: Architecture review
    ↓
Phase 03: Design & API Contracts
    ↓ (System Designer)
    → GATE-03: Design approval
    ↓
Phase 04: Test Strategy & Design
    ↓ (Test Design Engineer)
    → GATE-04: Test strategy approval
    ↓
Phase 05: Implementation
    ↓ (Software Developer)
    → GATE-05: Code complete + unit tests pass
    ↓
Phase 06: Integration & Testing
    ↓ (Integration Tester)
    → GATE-06: Integration tests pass
    ↓
Phase 07: Code Review & QA
    ↓ (QA Engineer)
    → GATE-07: QA sign-off
    ↓
Phase 08: Independent Validation
    ↓ (Security & Compliance Auditor)
    → GATE-08: Security sign-off
    ↓
Phase 09: Version Control & CI/CD
    ↓ (CI/CD Engineer)
    → GATE-09: Pipeline operational
    ↓
Phase 10: Local Development & Testing
    ↓ (Dev Environment Engineer)
    → GATE-10: Dev environment validated
    ↓
Phase 11: Test Environment Deployment
    ↓ (Deployment Engineer - Staging)
    → GATE-11: Staging deployment verified
    ↓
Phase 12: Production Deployment
    ↓ (Release Manager)
    → GATE-12: Production go-live complete
    ↓
Phase 13: Production Operations
    ↓ (Site Reliability Engineer)
    → GATE-13: Operations stable
```

**1-to-1 Mapping**: Each phase has exactly ONE dedicated agent with clear entry/exit criteria.

## Getting Started

### Prerequisites

- [Claude Code CLI](https://docs.anthropic.com/claude-code) installed
- Bash shell (macOS, Linux, or WSL on Windows)
- `jq` for JSON processing (optional, for scripts)
  - macOS: `brew install jq`
  - Ubuntu/Debian: `apt install jq`

### Quick Start

1. **Clone the framework**
   ```bash
   git clone <repo-url> my-isdlc-workspace
   cd my-isdlc-workspace
   ```

2. **Initialize a project** (when ready)
   ```bash
   # Create a new project directory
   mkdir my-project
   cd my-project

   # Initialize project state (manual for now, script WIP)
   mkdir -p .isdlc/01-requirements
   ```

3. **Start Claude Code**
   ```bash
   claude
   ```

   Claude Code will automatically detect the agent definitions in `.claude/agents/` and make them available for use.

### Using the Framework

When you start a new project, the **SDLC Orchestrator (Agent 00)** coordinates the workflow:

1. **Phase 01**: Requirements Analyst captures requirements
2. **GATE-01**: Validate requirements before proceeding
3. **Phase 02**: Solution Architect designs system architecture
4. **GATE-02**: Architecture review and approval
5. ... (continue through all 13 phases)

Each phase produces specific artifacts in `.isdlc/<phase-name>/` directories.

## Skills System

The framework includes **116 specialized skills** distributed across 10 categories:

| Category | Skills | Primary Agents |
|----------|--------|----------------|
| **Orchestration** | 8 | Agent 00 (Orchestrator) |
| **Requirements** | 10 | Agent 01 (Requirements Analyst) |
| **Architecture** | 12 | Agent 02 (Solution Architect) |
| **Design** | 10 | Agent 03 (System Designer) |
| **Testing** | 13 | Agent 04 (Test Design), Agent 06 (Integration Tester) |
| **Development** | 14 | Agent 05 (Software Developer), Agent 07 (QA Engineer) |
| **DevOps** | 14 | Agent 09, 10, 11, 12 (CI/CD, Dev Env, Deployment, Release) |
| **Security** | 13 | Agent 08 (Security & Compliance Auditor) |
| **Operations** | 12 | Agent 13 (Site Reliability Engineer) |
| **Documentation** | 10 | Distributed across agents 10, 12, 13 |

See [docs/SKILL-DISTRIBUTION.md](docs/SKILL-DISTRIBUTION.md) for detailed skill allocation.

## Quality Gates

Each phase has a quality gate with specific validation criteria. Gate checklists are located in `isdlc-framework/checklists/`:

- `01-requirements-gate.md` - Requirements completeness and quality
- `02-architecture-gate.md` - Architecture review and tech stack approval
- `03-design-gate.md` - API contracts and design approval
- `04-test-strategy-gate.md` - Test strategy and coverage plan
- `05-implementation-gate.md` - Code complete and unit tests pass
- `06-testing-gate.md` - Integration and E2E tests pass
- `07-code-review-gate.md` - Code review and quality metrics
- `08-validation-gate.md` - Security scan and compliance check
- `09-cicd-gate.md` - Pipeline operational and build passing
- `10-local-testing-gate.md` - Local dev environment validated
- `11-test-deploy-gate.md` - Staging deployment verified
- `12-production-gate.md` - Production deployment complete
- `13-operations-gate.md` - Operations stable and monitored

## Configuration

### Framework Defaults

Located in `isdlc-framework/config/`:

- **defaults.yaml** - General framework settings
- **coding-standards.yaml** - Code style and conventions
- **testing-standards.yaml** - Test coverage requirements and standards

### Project-Specific Config

Each project can maintain its own configuration in `.isdlc/config.yaml` to override framework defaults.

Example:
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
  integration:
    enabled: true

deployment:
  environments:
    - staging
    - production
```

## Utility Scripts

Located in `isdlc-framework/scripts/`:

### init-project.sh
Initialize a new project with the iSDLC framework structure.

```bash
./isdlc-framework/scripts/init-project.sh <project-path> [project-name]
```

### validate-state.sh
Validate project state and phase gate criteria.

```bash
./isdlc-framework/scripts/validate-state.sh
```

### generate-report.sh
Generate a status report for the current project.

```bash
./isdlc-framework/scripts/generate-report.sh
```

## Benefits of 1-to-1 Agent-Phase Mapping

### Clear Ownership
Each phase has exactly ONE responsible agent - no confusion about who handles what.

### Specialization
Agents are deeply specialized in their specific phase, leading to expert-level execution.

### Simpler Handoffs
Linear workflow with clear entry/exit points. Each agent receives complete artifacts from the previous phase.

### Easier Tracking
Phase progress = Agent progress. Simple status: Phase X is in_progress/completed.

### Reduced Conflicts
No overlapping responsibilities. Conflicts only at phase boundaries, handled by Orchestrator.

### Scalability
Easy to swap or upgrade individual agents. Agents can be independently improved.

## Comparison: Old vs New Architecture

### Before (Multi-Agent per Phase)
- 10 agents with overlapping responsibilities
- Agents active in multiple phases
- Complex coordination patterns
- Potential conflicts between agents

### After (1-to-1 Mapping)
- ✅ 14 agents total (1 Orchestrator + 13 Phase Agents)
- ✅ Each agent owns exactly ONE phase
- ✅ Clear handoff points between phases
- ✅ Simplified coordination through Orchestrator
- ✅ Reduced conflicts and clearer accountability

See [docs/archive/RESTRUCTURING-SUMMARY.md](docs/archive/RESTRUCTURING-SUMMARY.md) for complete migration details.

## Documentation

Additional documentation in [docs/](docs/):

- **[README.md](docs/README.md)** - Documentation index and guide
- **[NEW-agents-and-skills-architecture.md](docs/NEW-agents-and-skills-architecture.md)** - Architecture overview
- **[WORKFLOW-ALIGNMENT.md](docs/WORKFLOW-ALIGNMENT.md)** - Workflows, artifacts, and handoff protocols
- **[DETAILED-SKILL-ALLOCATION.md](docs/DETAILED-SKILL-ALLOCATION.md)** - Complete skill-to-agent mapping
- **[archive/](docs/archive/)** - Historical documentation and migration notes

## Project Status

### Completed
- ✅ 14 agent definitions created
- ✅ 116 skills organized into 10 categories
- ✅ 13 phase gate checklists defined
- ✅ 7 document templates created
- ✅ Configuration system implemented
- ✅ Utility scripts created

### In Progress
- ⏳ Project initialization automation
- ⏳ State management system
- ⏳ Integration testing across all phases

### Planned
- 📋 Agent performance metrics
- 📋 Workflow visualization tools
- 📋 Project portfolio dashboard

## Contributing

This framework is under active development. Contributions, feedback, and suggestions are welcome.

## License

MIT License

---

**Framework Version**: 1.0.0
**Last Updated**: 2026-01-17
**Agents**: 14 (1 Orchestrator + 13 Phase Agents)
**Skills**: 116 across 10 categories
**Quality Gates**: 13
