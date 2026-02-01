# iSDLC Framework for Claude Code

An integrated Software Development Lifecycle (iSDLC) framework designed for Claude Code. Provides structured multi-agent workflows, phase gates, and standardized processes for building software projects using AI-powered development.

## Overview

This framework implements a **1-to-1 mapping** between 13 SDLC phases and 13 specialized AI agents. Each phase has exactly ONE dedicated agent, creating clear ownership, simplified workflows, and explicit handoff points.

### Key Features

- **14 Specialized Agents** (1 Orchestrator + 13 Phase Agents)
- **1-to-1 Phase Mapping** - Each agent owns exactly one phase
- **13 Quality Gates** with validation checklists
- **159 Skills** distributed across 11 categories
- **Exclusive Skill Ownership** - Each skill belongs to exactly one agent with enforcement
- **Skill Usage Audit Trail** - All skill executions logged for compliance tracking
- **Adaptive Workflow** - Orchestrator determines required phases based on task complexity
- **Project Constitution** - Customizable governance principles enforced by agents
- **Autonomous Iteration** - Self-correcting agents that iterate until tests pass
- **Standardized Artifacts** - Templates for each phase's deliverables
- **Linear Workflow** with clear handoff points
- **Monorepo Ready** - Share framework across multiple projects

## Project Structure

```
isdlc-framework/
├── src/
│   ├── claude/                    # → Installed to .claude/
│   │   ├── agents/                # 14 SDLC agents + 6 discover sub-agents
│   │   │   ├── 00-sdlc-orchestrator.md
│   │   │   ├── 01-requirements-analyst.md
│   │   │   ├── ... (02-13)
│   │   │   └── discover/          # Discover sub-agents (D1-D6)
│   │   ├── commands/              # Custom slash commands
│   │   │   └── primer.md
│   │   ├── skills/                # 159 Skills across 11 categories
│   │   │   ├── orchestration/
│   │   │   ├── requirements/
│   │   │   ├── architecture/
│   │   │   ├── design/
│   │   │   ├── testing/
│   │   │   ├── development/
│   │   │   ├── devops/
│   │   │   ├── security/
│   │   │   ├── operations/
│   │   │   └── documentation/
│   │   ├── hooks/                 # Runtime enforcement hooks
│   │   │   ├── config/
│   │   │   ├── skill-validator.js
│   │   │   ├── gate-blocker.js
│   │   │   └── ...
│   │   └── settings.json
│   │
│   └── isdlc/                     # → Installed to .isdlc/
│       ├── checklists/            # Phase gate checklists (13 files)
│       ├── config/                # Configuration files
│       │   ├── defaults.yaml
│       │   ├── coding-standards.yaml
│       │   └── testing-standards.yaml
│       ├── scripts/               # Utility scripts
│       │   ├── validate-state.sh
│       │   └── generate-report.sh
│       └── templates/             # Document templates
│           └── constitution.md
│
├── docs/                          # Documentation
├── install.sh                     # Installation script (run this!)
├── README.md                      # This file
└── LICENSE
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

## Discover Agents

The `/discover` command uses specialized sub-agents to analyze projects before SDLC phases begin:

| ID | Agent | Responsibility |
|----|-------|----------------|
| **D0** | **Discover Orchestrator** | Coordinates discovery, assembles report |
| **D1** | **Architecture Analyzer** | Tech stack, dependencies, deployment topology, integrations |
| **D2** | **Test Evaluator** | Test coverage by type, critical untested paths, test quality |
| **D3** | **Constitution Generator** | Generates project constitution from analysis |
| **D4** | **Skills Researcher** | Researches best practices for detected tech stack |
| **D5** | **Data Model Analyzer** | Database schemas, ORM models, migrations, relationships |
| **D6** | **Feature Mapper** | API endpoints, UI pages, CLI commands, business domains |
| **D7** | **Product Analyst** | Vision elicitation, brainstorming, PRD generation (new projects) |
| **D8** | **Architecture Designer** | Architecture blueprint from PRD and tech stack (new projects) |

For existing projects, D1, D2, D5, and D6 run in parallel to produce a unified `docs/project-discovery-report.md`.
For new projects, D7 guides vision elicitation and PRD generation, D8 designs the architecture blueprint.

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
- An existing project directory (or create a new one)

### Installation

The iSDLC framework is designed to be installed **into your existing project**. The installation script will set up everything and then clean up after itself.

#### Option 1: Clone into your project

```bash
# Navigate to your project
cd /path/to/your-project

# Clone the framework into your project
git clone <repo-url> isdlc-framework

# Run the installation script
./isdlc-framework/install.sh
```

The script is at the root of the cloned repo, so it's easy to find and run.

#### Option 2: Download and extract

```bash
# Navigate to your project
cd /path/to/your-project

# Download and extract the framework
# (clones into isdlc-framework/ folder)

# Run the installation script
./isdlc-framework/install.sh
```

### What the Installation Does

1. **Creates/merges `.claude/` folder** - Copies agent definitions and skills
   - If you already have a `.claude/` folder, it merges the contents
   - Backs up your existing `CLAUDE.md` if present

2. **Creates `docs/` folder** - For requirements and documentation
   - `docs/requirements/` - Requirements specifications
   - `docs/architecture/` - Architecture documents
   - `docs/design/` - Design documents

3. **Creates `.isdlc/` folder** - Framework state and resources
   - `state.json` - Current phase and progress tracking
   - `constitution.md` - Project governance principles
   - `config/` - Framework configuration
   - `checklists/` - Gate validation checklists
   - `templates/` - Document templates

4. **Self-cleanup** - Removes the cloned `isdlc-framework/` folder after installation

### After Installation

Your project structure will look like:

```
your-project/
├── .claude/           # Agent definitions and skills
│   ├── agents/        # 14 specialized agents
│   ├── skills/        # 159 skills across 11 categories
│   └── CLAUDE.md      # Project context for Claude
├── .isdlc/            # Framework state and resources
│   ├── state.json     # Current phase and progress
│   ├── constitution.md
│   ├── config/
│   ├── checklists/
│   └── templates/
├── docs/              # Requirements and documentation
│   ├── requirements/
│   ├── architecture/
│   └── design/
└── src/               # Your source code
```

### Start Working

```bash
# Start Claude Code
claude

# The SDLC Orchestrator (Agent 00) will coordinate the workflow
```

### Workflow Overview

The **SDLC Orchestrator** guides you through 13 phases:

1. **Phase 01**: Requirements Analyst captures requirements
2. **GATE-01**: Validate requirements before proceeding
3. **Phase 02**: Solution Architect designs system architecture
4. **GATE-02**: Architecture review and approval
5. ... (continue through all 13 phases)

Each phase produces specific artifacts in `.isdlc/phases/<phase-name>/` directories.

## Skills System

The framework includes **159 specialized skills** distributed across 11 categories:

| Category | Skills | Primary Agents |
|----------|--------|----------------|
| **Orchestration** | 10 | Agent 00 (Orchestrator) |
| **Requirements** | 10 | Agent 01 (Requirements Analyst) |
| **Architecture** | 12 | Agent 02 (Solution Architect) |
| **Design** | 10 | Agent 03 (System Designer) |
| **Testing** | 13 | Agent 04 (Test Design), Agent 06 (Integration Tester) |
| **Development** | 15 | Agent 05 (Software Developer), Agent 07 (QA Engineer) |
| **DevOps** | 14 | Agent 09, 10, 11, 12 (CI/CD, Dev Env, Deployment, Release) |
| **Security** | 13 | Agent 08 (Security & Compliance Auditor) |
| **Operations** | 12 | Agent 13 (Site Reliability Engineer) |
| **Documentation** | 10 | Distributed across agents 10, 12, 13 |
| **Discover** | 40 | Discover sub-agents D1-D8 |

See [docs/SKILL-DISTRIBUTION.md](docs/SKILL-DISTRIBUTION.md) for detailed skill allocation.

## Quality Gates

Each phase has a quality gate with specific validation criteria. Gate checklists are located in `checklists/`:

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

## Project Constitution

**NEW**: The framework now supports project-specific constitutional principles that all agents must follow.

### What is a Constitution?

A project constitution is a set of immutable principles (like "Test-First Development" or "Security by Design") that govern all development activities. The orchestrator and all 13 phase agents read and enforce these principles at quality gates.

### How to Use

1. **Copy the template** to your project:
   ```bash
   cp isdlc-framework/src/isdlc/templates/constitution.md .isdlc/constitution.md
   ```
   (Or use `init-project.sh` which does this automatically)

2. **Customize** the articles for your project:
   - Keep relevant articles (Specification Primacy, Test-First, Security by Design, etc.)
   - Remove articles that don't apply
   - Add custom articles (HIPAA Compliance, Performance SLAs, etc.)

3. **Get team agreement** on the principles

4. **Agents enforce** constitutional compliance at each quality gate

### Example Constitution Articles

- **Specification Primacy**: Code serves specifications (source of truth)
- **Test-First Development**: Tests MUST be written before implementation
- **Library-First Design**: Prefer libraries over custom implementations
- **Security by Design**: Security considerations precede implementation
- **Explicit Over Implicit**: No assumptions, mark uncertainties
- **Simplicity First**: YAGNI, avoid over-engineering
- **Artifact Traceability**: Requirements → Design → Code → Tests
- **Documentation Currency**: Docs updated with code changes
- **Quality Gate Integrity**: Gates cannot be skipped
- **Fail-Safe Defaults**: Secure and safe by default

### Resources

- **Template**: [src/isdlc/templates/constitution.md](src/isdlc/templates/constitution.md)
- **Guide**: [docs/CONSTITUTION-GUIDE.md](docs/CONSTITUTION-GUIDE.md)
- **Analysis**: [docs/FRAMEWORK-COMPARISON-ANALYSIS.md](docs/FRAMEWORK-COMPARISON-ANALYSIS.md)

## Adaptive Workflow

The orchestrator dynamically determines which phases to run based on task complexity. No upfront track selection required.

### How It Works

1. **You describe the task** - bug fix, new feature, platform build, etc.
2. **Orchestrator assesses complexity** across 6 dimensions:
   - Architectural complexity
   - Security requirements
   - Testing needs
   - Deployment complexity
   - Team coordination
   - Timeline constraints
3. **Selects appropriate phases** - simple tasks skip unnecessary phases, complex tasks get full rigor
4. **Adapts as needed** - if scope increases mid-task, orchestrator adds phases

### Example Phase Selection

| Task Type | Typical Phases |
|-----------|----------------|
| Bug fix | 01 (brief), 05, 06 |
| New feature | 01, 02, 03, 04, 05, 06, 07 |
| API endpoint | 01, 03, 04, 05, 06, 07, 09 |
| Platform/compliance | All 13 phases |

### Quality Standards

The orchestrator enforces appropriate quality thresholds:
- **Unit test coverage**: 60-90% based on complexity
- **Integration coverage**: 70-80% for multi-component work
- **Security audit**: Required for compliance-sensitive tasks
- **Code review**: Required for features, optional for trivial fixes

## Skill Enforcement

**NEW**: The framework now implements exclusive skill ownership where each skill belongs to exactly one agent, with runtime validation and audit logging.

### How It Works

1. **Exclusive Ownership**: Each of the 159 skills has exactly ONE owner agent
2. **Pre-Execution Validation**: Before using a skill, the agent validates ownership
3. **Audit Trail**: All skill usage (authorized and unauthorized) is logged to state.json
4. **Gate Integration**: Skill compliance is reviewed at each quality gate

### Enforcement Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| **Strict** | Block unauthorized access | Production, compliance-critical |
| **Warn** | Allow with warning | Migration, testing |
| **Audit** | Log only, no enforcement | Initial rollout, analysis |

### Cross-Agent Delegation

When an agent needs functionality from a skill it doesn't own:
1. Agent requests orchestrator to delegate
2. Orchestrator delegates to owning agent
3. Owning agent executes skill and logs usage
4. Results returned to requesting agent

### Resources

- **Documentation**: [docs/SKILL-ENFORCEMENT.md](docs/SKILL-ENFORCEMENT.md)
- **Skills Manifest**: [src/isdlc/config/skills-manifest.yaml](src/isdlc/config/skills-manifest.yaml)
- **Validation Skill**: [.claude/skills/orchestration/skill-validation/SKILL.md](.claude/skills/orchestration/skill-validation/SKILL.md)

## Autonomous Iteration

**NEW**: Agents now autonomously iterate when tests fail, rather than stopping at first failure.

### How It Works

1. Agent implements code/tests
2. Runs test suite
3. If tests fail: analyzes errors, applies fixes, retries
4. Continues until success OR max iterations reached
5. Escalates to human only when stuck

### Iteration Limits

- **Max iterations**: 10 (default)
- **Timeout per iteration**: 5 minutes
- **Circuit breaker**: Stops after 3 identical failures

### Failure Escalation

Escalation triggers:
- Max iterations exceeded
- Same error repeats 3+ times (stuck in loop)
- External dependency/environmental issue detected

### Resources

- **Documentation**: [docs/AUTONOMOUS-ITERATION.md](docs/AUTONOMOUS-ITERATION.md)
- **Iteration Skill**: [.claude/skills/development/autonomous-iterate.md](.claude/skills/development/autonomous-iterate.md)

## Deterministic Iteration Enforcement

**NEW**: The framework now uses Claude Code hooks to **deterministically enforce** iteration requirements, rather than relying on agent judgment.

### Problem Solved

Previously, iteration protocols (test iteration, constitutional validation, interactive elicitation) were defined in skill files but relied on agents "remembering" to follow them. This created a risk of agents skipping critical iterations.

### Solution: Hook-Based Enforcement

Four hooks intercept tool calls and enforce iteration requirements:

| Hook | Type | Trigger | Action |
|------|------|---------|--------|
| `gate-blocker.js` | PreToolUse | Gate advancement attempt | **BLOCKS** unless all iteration requirements satisfied |
| `test-watcher.js` | PostToolUse | Bash test command | Tracks iterations, outputs guidance, triggers circuit breaker |
| `constitution-validator.js` | PreToolUse | Phase completion attempt | **BLOCKS** unless constitutional validation complete |
| `menu-tracker.js` | PostToolUse | A/R/C menu interaction | Tracks elicitation progress for Phase 01 |

### Enforcement Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENFORCEMENT FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Agent runs "npm test"                                           │
│       ↓                                                          │
│  test-watcher.js (PostToolUse)                                   │
│       ├── Detects test command                                   │
│       ├── Parses PASS/FAIL                                       │
│       ├── Updates iteration count in state.json                  │
│       └── Outputs: "❌ TESTS FAILED - ITERATE REQUIRED"          │
│       ↓                                                          │
│  Agent attempts gate advancement                                 │
│       ↓                                                          │
│  gate-blocker.js (PreToolUse)                                    │
│       ├── Checks test_iteration.completed                        │
│       ├── Checks constitutional_validation.status                │
│       └── BLOCKS if requirements not met                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Per-Phase Requirements

Configured in `.claude/hooks/config/iteration-requirements.json`:

| Phase | Test Iteration | Constitutional | Interactive Elicitation |
|-------|---------------|----------------|------------------------|
| 01-requirements | ❌ | ✅ | ✅ (A/R/C menus) |
| 05-implementation | ✅ (max 10) | ✅ | ❌ |
| 06-testing | ✅ (max 10) | ✅ | ❌ |
| 09-cicd | ✅ (max 5) | ✅ | ❌ |
| Others | ❌ | ✅ | ❌ |

### Circuit Breaker

The `test-watcher.js` hook implements a circuit breaker:
- **Trigger**: 3 identical consecutive failures
- **Action**: Marks iteration as `escalated`, requires human approval
- **Purpose**: Prevents infinite loops on unsolvable issues

### State Tracking

All iteration state is tracked in `.isdlc/state.json`:

```json
{
  "phases": {
    "05-implementation": {
      "iteration_requirements": {
        "test_iteration": {
          "completed": false,
          "current_iteration": 3,
          "max_iterations": 10,
          "status": "in_progress",
          "history": [...]
        }
      },
      "constitutional_validation": {
        "completed": true,
        "status": "compliant",
        "iterations_used": 2
      }
    }
  }
}
```

### Escalation Handling

When iterations exceed max or circuit breaker triggers:
1. Hook marks status as `escalated`
2. Gate blocker blocks advancement
3. Human must set `escalation_approved: true` in state.json
4. Gate blocker then allows advancement

### Resources

- **Config**: [.claude/hooks/config/iteration-requirements.json](.claude/hooks/config/iteration-requirements.json)
- **Hooks**: `.claude/hooks/gate-blocker.js`, `test-watcher.js`, `constitution-validator.js`, `menu-tracker.js`

## Configuration

### Framework Defaults

Located in `src/isdlc/config/`:

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

### init-project.sh (Installation Script)
Located at the root of the cloned repo (`isdlc-framework/install.sh` from your project).

```bash
# Run from your project directory after cloning the framework
./isdlc-framework/install.sh
```

This script:
- Installs the framework into your project
- Creates `.claude/`, `.isdlc/`, and `docs/` folders
- Cleans up by removing itself after installation

### Post-Installation Scripts
After installation, these scripts are available in `.isdlc/scripts/` (if copied):

#### validate-state.sh
Validate project state and phase gate criteria.

```bash
./.isdlc/scripts/validate-state.sh
```

#### generate-report.sh
Generate a status report for the current project.

```bash
./.isdlc/scripts/generate-report.sh
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
- ✅ 159 skills organized into 11 categories
- ✅ 13 phase gate checklists defined
- ✅ 7 document templates created
- ✅ Configuration system implemented
- ✅ Utility scripts created
- ✅ Project Constitution system (Enhancement #1)
- ✅ Adaptive Workflow - Orchestrator-managed phase selection (Enhancement #2)
- ✅ Autonomous Iteration for self-correcting agents (Enhancement #3)
- ✅ Exclusive Skill Ownership & Enforcement (Enhancement #4)
- ✅ Deterministic Iteration Enforcement via Hooks (Enhancement #5)

### In Progress
- ⏳ Integration testing across all phases
- ⏳ Real project validation

### Planned
- 📋 Agent performance metrics
- 📋 Workflow visualization tools
- 📋 Project portfolio dashboard

## Contributing

This framework is under active development. Contributions, feedback, and suggestions are welcome.

## License

MIT License

---

**Framework Version**: 2.1.0
**Last Updated**: 2026-01-21
**Agents**: 22 (14 SDLC agents + 8 Discover sub-agents)
**Skills**: 159 across 11 categories
**Quality Gates**: 13
**Enforcement Hooks**: 5 (skill-validator, gate-blocker, test-watcher, constitution-validator, menu-tracker)
**Enhancements**: 5 (Constitution, Scale-Adaptive, Autonomous Iteration, Skill Enforcement, Deterministic Iteration Enforcement)
