<div align="center">

# iSDLC Framework

<h3><em>Structured AI-powered software development, from requirements to production.</em></h3>

<p><strong>A comprehensive SDLC framework for Claude Code with 23 agents, 164 skills, 13 quality gates, and monorepo support.</strong></p>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Agents](https://img.shields.io/badge/Agents-23-purple.svg)](#the-sdlc-agents)
[![Skills](https://img.shields.io/badge/Skills-164-green.svg)](#skills-system)
[![Gates](https://img.shields.io/badge/Quality%20Gates-13-orange.svg)](#quality-gates)
[![Hooks](https://img.shields.io/badge/Hooks-5-red.svg)](#deterministic-iteration-enforcement)

</div>

---

## Table of Contents

- [What is iSDLC?](#what-is-isdlc)
- [Get Started](#get-started)
- [The SDLC Agents](#the-sdlc-agents)
- [Development Phases](#development-phases)
- [Available Workflows](#available-workflows)
- [Core Features](#core-features)
- [Configuration](#configuration)
- [Project Status](#project-status)
- [Contributing](#contributing)
- [License](#license)

---

## What is iSDLC?

The iSDLC (integrated Software Development Lifecycle) framework implements a **1-to-1 mapping** between 13 SDLC phases and 13 specialized AI agents, coordinated by an orchestrator. Each phase has exactly ONE dedicated agent, creating clear ownership, simplified workflows, and explicit handoff points.

The framework is designed to be installed **into your existing project**. It provides structured multi-agent workflows, quality gates between every phase, and standardized processes for building software using AI-powered development with Claude Code.

Key principles: **clear ownership** (one agent per phase), **exclusive skill ownership** (each skill belongs to one agent), **quality gates** (validation at every phase boundary), **artifact traceability** (requirements to design to code to tests), and **adaptive workflows** (the orchestrator selects phases based on task complexity).

### Main Usage

| Use Case | Command | Description |
|----------|---------|-------------|
| **Project Discovery** | `/discover` | Analyze an existing project's tech stack, tests, data models, and features |
| **Reverse Engineering** | `/sdlc reverse-engineer` | Extract acceptance criteria and generate characterization tests from existing code |
| **Test Pack Generation** | `/sdlc test generate` | Generate a comprehensive test suite for existing code |
| **New Feature** | `/sdlc feature "desc"` | Develop a new feature end-to-end with full SDLC rigor |
| **Bug Fix** | `/sdlc fix "desc"` | Fix a bug using test-driven development |
| **Full Lifecycle** | `/sdlc start` | Complete SDLC for new projects or major work |

## Get Started

### Prerequisites

- [Claude Code CLI](https://docs.anthropic.com/claude-code) installed
- Bash shell (macOS, Linux, or WSL on Windows)
- An existing project directory (or create a new one)

### Installation

```bash
# Navigate to your project
cd /path/to/your-project

# Clone the framework
git clone <repo-url> isdlc-framework

# Install into your project
./isdlc-framework/install.sh
```

The installer copies agents, skills, hooks, and configuration into your project, then removes the cloned folder.

<details>
<summary><strong>What the installation does</strong></summary>

1. **Creates/merges `.claude/` folder** — Agent definitions, skills, hooks, and settings
   - If you already have a `.claude/` folder, it merges the contents
   - Backs up your existing `CLAUDE.md` if present
2. **Creates `docs/` folder** — For requirements, architecture, and design documents
3. **Creates `.isdlc/` folder** — Framework state and resources
   - `state.json` — Current phase and progress tracking
   - `constitution.md` — Project governance principles
   - `config/` — Framework configuration
   - `checklists/` — Gate validation checklists
   - `templates/` — Document templates
4. **Self-cleanup** — Removes the cloned `isdlc-framework/` folder after installation

</details>

### Post-Install Structure

```
your-project/
├── .claude/           # Agent definitions, skills, hooks
│   ├── agents/        # 14 SDLC agents + 9 discover agents
│   ├── skills/        # 164 skills across 11 categories
│   ├── hooks/         # Runtime enforcement hooks
│   └── settings.json
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

### Quick Start

```bash
# Start Claude Code in your project
claude

# Discover your project first (recommended for existing projects)
/discover

# Then start a workflow
/sdlc feature "Add user authentication"
/sdlc fix "Fix login timeout bug"
```

## The SDLC Agents

Each agent is a specialized AI mapped to exactly one SDLC phase, with specific responsibilities, skills, and deliverables.

| Phase | Agent | Responsibility | Key Artifacts |
|-------|-------|----------------|---------------|
| **00** | **SDLC Orchestrator** | Workflow coordination, phase gates, conflict resolution | workflow-state.json, gate-validation.json |
| **01** | **Requirements Analyst** | Requirements capture, user stories, NFRs | requirements-spec.md, user-stories.json, nfr-matrix.md |
| **02** | **Solution Architect** | System architecture, tech stack, database design | architecture-overview.md, tech-stack-decision.md, ADRs |
| **03** | **System Designer** | API contracts, module design, UI/UX wireframes | openapi.yaml, module-designs/, wireframes/ |
| **04** | **Test Design Engineer** | Test strategy, test cases, traceability | test-strategy.md, test-cases/, traceability-matrix.csv |
| **05** | **Software Developer** | Implementation (TDD), unit tests, coding standards | source-code/, unit-tests/, coverage-report.html |
| **06** | **Integration Tester** | Integration testing, E2E testing, API contract tests | integration-tests/, e2e-tests/, test-execution-report.md |
| **07** | **QA Engineer** | Code review, quality metrics, QA sign-off | code-review-report.md, quality-metrics.md, qa-sign-off.md |
| **08** | **Security & Compliance Auditor** | Security scanning, penetration testing, compliance | security-scan-report.md, compliance-checklist.md |
| **09** | **CI/CD Engineer** | Pipeline automation, build configuration | ci-config.yaml, cd-config.yaml, Dockerfile |
| **10** | **Environment Builder** | Environment build & launch for testing | testing_environment in state.json, build-log.md |
| **11** | **Deployment Engineer (Staging)** | Staging deployment, smoke tests, rollback | deployment-log-staging.md, smoke-test-results.md |
| **12** | **Release Manager** | Production deployment, release coordination | release-notes.md, post-deployment-report.md |
| **13** | **Site Reliability Engineer** | Operations, monitoring, incident response, SLAs | monitoring-config/, alert-rules.yaml, sla-tracking.md |

### Discover Agents

The `/discover` command uses 9 specialized sub-agents to analyze projects before SDLC workflows begin. For existing projects, D1, D2, D5, and D6 run in parallel to produce a unified `docs/project-discovery-report.md`. For new projects, D7 guides vision elicitation and D8 designs the architecture blueprint.

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

## Development Phases

The framework implements a linear 13-phase workflow with quality gates between each phase.

<details>
<summary><strong>Phase flow diagram</strong></summary>

```
Phase 01: Requirements Capture
    | (Requirements Analyst)
    v GATE-01: Requirements validation
Phase 02: Architecture & Blueprint
    | (Solution Architect)
    v GATE-02: Architecture review
Phase 03: Design & API Contracts
    | (System Designer)
    v GATE-03: Design approval
Phase 04: Test Strategy & Design
    | (Test Design Engineer)
    v GATE-04: Test strategy approval
Phase 05: Implementation
    | (Software Developer)
    v GATE-05: Code complete + unit tests pass
Phase 06: Integration & Testing
    | (Integration Tester)
    v GATE-06: Integration tests pass
Phase 07: Code Review & QA
    | (QA Engineer)
    v GATE-07: QA sign-off
Phase 08: Independent Validation
    | (Security & Compliance Auditor)
    v GATE-08: Security sign-off
Phase 09: Version Control & CI/CD
    | (CI/CD Engineer)
    v GATE-09: Pipeline operational
Phase 10: Local Development & Testing
    | (Environment Builder)
    v GATE-10: Dev environment validated
Phase 11: Test Environment Deployment
    | (Deployment Engineer - Staging)
    v GATE-11: Staging deployment verified
Phase 12: Production Deployment
    | (Release Manager)
    v GATE-12: Production go-live complete
Phase 13: Production Operations
    | (Site Reliability Engineer)
    v GATE-13: Operations stable
```

</details>

**1-to-1 Mapping**: Each phase has exactly ONE dedicated agent with clear entry/exit criteria. No overlapping responsibilities — conflicts only occur at phase boundaries and are handled by the Orchestrator.

## Available Workflows

The orchestrator provides focused workflows via `/sdlc` and `/discover` commands. Each workflow defines a fixed, non-skippable phase sequence with strict gate enforcement.

| Command | Workflow | Phases | Branch |
|---------|----------|--------|--------|
| `/discover` | Project Discovery | D1-D8 sub-agents analyze tech stack, tests, data models, features | No |
| `/sdlc feature "desc"` | New Feature | Requirements → Architecture → Design → Test Strategy → Implementation → Local Testing → Integration Testing → CI/CD → Code Review | Yes |
| `/sdlc fix "desc"` | Bug Fix (TDD) | Requirements → Test Strategy → Implementation → Local Testing → Integration Testing → CI/CD → Code Review | Yes |
| `/sdlc test run` | Run Tests | Local Testing → Integration Testing | No |
| `/sdlc test generate` | Generate Tests | Test Strategy → Implementation → Local Testing → Integration Testing → Code Review | No |
| `/sdlc start` | Full Lifecycle | All 13 phases (Requirements through Operations) | Yes |
| `/sdlc reverse-engineer` | Reverse Engineer | Behavior Extraction → Characterization Tests → Artifact Integration → ATDD Bridge | No |

**Git branch lifecycle**: Workflows that produce code automatically create branches (`feature/REQ-NNNN-desc` or `bugfix/BUG-NNNN-id`), execute all phases on the branch, and merge to main with `--no-ff` after the final gate passes.

**ATDD mode**: Feature and fix workflows support `--atdd` for Acceptance Test-Driven Development with `test.skip()` scaffolds and Given-When-Then AC mapping.

## Core Features

- [**Project Constitution**](#project-constitution) — Customizable governance principles enforced at every quality gate
- [**Skills System**](#skills-system) — 164 specialized skills across 11 categories with exclusive ownership
- [**Quality Gates**](#quality-gates) — 13 validation gates with checklist-based verification
- [**Skill Enforcement**](#skill-enforcement) — Runtime ownership validation and audit logging
- [**Autonomous Iteration**](#autonomous-iteration) — Self-correcting agents that iterate until tests pass
- [**Deterministic Iteration Enforcement**](#deterministic-iteration-enforcement) — Hook-based enforcement of iteration requirements
- [**Monorepo Support**](#monorepo-support) — Multi-project management from a single installation
- [**Task Planning & Progress Tracking**](#task-planning--progress-tracking) — Persistent task plans with checkbox-based tracking (ORCH-012)

---

### Project Constitution

A project constitution is a set of immutable principles (e.g., "Test-First Development", "Security by Design") that govern all development activities. The orchestrator and all 13 phase agents read and enforce these principles at quality gates.

1. Install creates a starter template at `.isdlc/constitution.md`
2. Customize the articles for your project — keep relevant ones, remove what doesn't apply, add your own
3. Agents enforce constitutional compliance at each quality gate

Example articles: Specification Primacy, Test-First Development, Library-First Design, Security by Design, Simplicity First, Quality Gate Integrity, Fail-Safe Defaults.

See [docs/CONSTITUTION-GUIDE.md](docs/CONSTITUTION-GUIDE.md) for the full guide.

### Skills System

The framework includes **164 specialized skills** distributed across 11 categories:

| Category | Skills | Primary Agents |
|----------|--------|----------------|
| **Orchestration** | 10 | Agent 00 (Orchestrator) |
| **Requirements** | 10 | Agent 01 (Requirements Analyst) |
| **Architecture** | 12 | Agent 02 (Solution Architect) |
| **Design** | 10 | Agent 03 (System Designer) |
| **Testing** | 13 | Agent 04 (Test Design), Agent 06 (Integration Tester) |
| **Development** | 15 | Agent 05 (Software Developer), Agent 07 (QA Engineer) |
| **DevOps** | 16 | Agent 09, 10, 11, 12 (CI/CD, Env Builder, Deployment, Release) |
| **Security** | 13 | Agent 08 (Security & Compliance Auditor) |
| **Operations** | 12 | Agent 13 (Site Reliability Engineer) |
| **Documentation** | 10 | Distributed across agents 10, 12, 13 |
| **Discover** | 40 | Discover sub-agents D1-D8 |

See [docs/SKILL-DISTRIBUTION.md](docs/SKILL-DISTRIBUTION.md) for detailed skill allocation.

### Quality Gates

Each phase has a quality gate (GATE-01 through GATE-13) with specific validation criteria.

<details>
<summary><strong>Gate checklist files</strong></summary>

| Gate | File | Validates |
|------|------|-----------|
| GATE-01 | `01-requirements-gate.md` | Requirements completeness and quality |
| GATE-02 | `02-architecture-gate.md` | Architecture review and tech stack approval |
| GATE-03 | `03-design-gate.md` | API contracts and design approval |
| GATE-04 | `04-test-strategy-gate.md` | Test strategy and coverage plan |
| GATE-05 | `05-implementation-gate.md` | Code complete and unit tests pass |
| GATE-06 | `06-testing-gate.md` | Integration and E2E tests pass |
| GATE-07 | `07-code-review-gate.md` | Code review and quality metrics |
| GATE-08 | `08-validation-gate.md` | Security scan and compliance check |
| GATE-09 | `09-cicd-gate.md` | Pipeline operational and build passing |
| GATE-10 | `10-local-testing-gate.md` | Local dev environment validated |
| GATE-11 | `11-test-deploy-gate.md` | Staging deployment verified |
| GATE-12 | `12-production-gate.md` | Production deployment complete |
| GATE-13 | `13-operations-gate.md` | Operations stable and monitored |

</details>

### Skill Enforcement

Each of the 164 skills has exactly ONE owner agent, with runtime validation and audit logging.

- **Pre-Execution Validation**: Before using a skill, the agent validates ownership
- **Audit Trail**: All skill usage (authorized and unauthorized) is logged to state.json
- **Gate Integration**: Skill compliance is reviewed at each quality gate
- **Cross-Agent Delegation**: When an agent needs a skill it doesn't own, the orchestrator delegates to the owning agent

| Enforcement Mode | Behavior | Use Case |
|------------------|----------|----------|
| **Strict** | Block unauthorized access | Production, compliance-critical |
| **Warn** | Allow with warning | Migration, testing |
| **Audit** | Log only, no enforcement | Initial rollout, analysis |

See [docs/SKILL-ENFORCEMENT.md](docs/SKILL-ENFORCEMENT.md) for details.

### Autonomous Iteration

Agents autonomously iterate when tests fail, rather than stopping at first failure.

1. Agent implements code/tests
2. Runs test suite
3. If tests fail: analyzes errors, applies fixes, retries
4. Continues until success OR max iterations reached (default: 10)
5. **Circuit breaker**: Stops after 3 identical failures and escalates to human

See [docs/AUTONOMOUS-ITERATION.md](docs/AUTONOMOUS-ITERATION.md) for details.

### Deterministic Iteration Enforcement

Claude Code hooks **deterministically enforce** iteration requirements, rather than relying on agent judgment.

Four hooks intercept tool calls and enforce iteration requirements:

| Hook | Type | Trigger | Action |
|------|------|---------|--------|
| `gate-blocker.js` | PreToolUse | Gate advancement attempt | **Blocks** unless all iteration requirements satisfied |
| `test-watcher.js` | PostToolUse | Bash test command | Tracks iterations, outputs guidance, triggers circuit breaker |
| `constitution-validator.js` | PreToolUse | Phase completion attempt | **Blocks** unless constitutional validation complete |
| `menu-tracker.js` | PostToolUse | A/R/C menu interaction | Tracks elicitation progress for Phase 01 |

<details>
<summary><strong>Enforcement flow and per-phase requirements</strong></summary>

**Enforcement flow**:

```
Agent runs "npm test"
    |
    v
test-watcher.js (PostToolUse)
    |- Detects test command
    |- Parses PASS/FAIL
    |- Updates iteration count in state.json
    |- Outputs: "TESTS FAILED - ITERATE REQUIRED"
    |
    v
Agent attempts gate advancement
    |
    v
gate-blocker.js (PreToolUse)
    |- Checks test_iteration.completed
    |- Checks constitutional_validation.status
    |- BLOCKS if requirements not met
```

**Per-phase requirements** (configured in `.claude/hooks/config/iteration-requirements.json`):

| Phase | Test Iteration | Constitutional | Interactive Elicitation |
|-------|---------------|----------------|------------------------|
| 01-requirements | No | Yes | Yes (A/R/C menus) |
| 05-implementation | Yes (max 10) | Yes | No |
| 06-testing | Yes (max 10) | Yes | No |
| 09-cicd | Yes (max 5) | Yes | No |
| Others | No | Yes | No |

**Escalation**: When iterations exceed max or circuit breaker triggers, the hook marks status as `escalated`. The gate blocker blocks advancement until a human sets `escalation_approved: true` in state.json.

</details>

### Monorepo Support

The framework supports monorepo installations where multiple projects share a single framework installation.

- **Auto-detection**: `install.sh` detects monorepos via workspace indicators (pnpm-workspace.yaml, turbo.json, nx.json, lerna.json, rush.json) or directory patterns
- **Per-project isolation**: Each project gets its own `state.json`, counters, workflows, and optional constitution override
- **Shared resources**: Agents, skills, hooks, checklists, and config are shared across all projects
- **Backward compatible**: Single-project repos work unchanged; monorepo mode activates only when `.isdlc/monorepo.json` exists

<details>
<summary><strong>Monorepo directory structure</strong></summary>

```
monorepo/
├── .claude/                          # Shared
├── .isdlc/
│   ├── monorepo.json                 # Project registry
│   ├── constitution.md               # Shared constitution
│   ├── config/                       # Shared config
│   └── projects/                     # Per-project state
│       ├── api-service/
│       │   ├── state.json
│       │   └── constitution.md       # Optional override
│       └── web-frontend/
│           └── state.json
├── docs/
│   ├── api-service/                  # Per-project docs
│   │   ├── requirements/
│   │   ├── architecture/
│   │   └── design/
│   └── web-frontend/
│       ├── requirements/
│       ├── architecture/
│       └── design/
└── apps/
    ├── api-service/
    └── web-frontend/
```

</details>

```bash
# Target a specific project
/sdlc feature "Add auth" --project api-service
/discover --project web-frontend

# Manage projects
/sdlc project list
/sdlc project add shared-lib packages/shared-lib
/sdlc project scan
/sdlc project select api-service
```

See [docs/MONOREPO-GUIDE.md](docs/MONOREPO-GUIDE.md) for detailed setup and usage.

### Task Planning & Progress Tracking

After GATE-01 passes, the orchestrator generates a persistent task plan at `.isdlc/tasks.md` (ORCH-012). The plan provides a single view of all work across workflow phases:

- **Checkbox-based tracking** — Phase agents mark tasks complete as work progresses
- **Sequential task IDs** — Tasks numbered T0001, T0002, etc. across all phases
- **Parallel markers** — Phases eligible for parallel execution marked with `[P]`
- **Progress summary** — Total tasks, completed count, and remaining work

Applies to feature, fix, and full-lifecycle workflows. Test-run and test-generate workflows skip plan generation.

## Configuration

### Framework Defaults

Located in `.isdlc/config/`:

| File | Purpose |
|------|---------|
| `defaults.yaml` | General framework settings |
| `coding-standards.yaml` | Code style and conventions |
| `testing-standards.yaml` | Test coverage requirements |
| `skills-manifest.yaml` | Skill ownership and lookup tables |
| `workflows.json` | Workflow definitions (phase sequences, gate modes, agent modifiers) |

### Project-Specific Config

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
  integration:
    enabled: true

deployment:
  environments:
    - staging
    - production
```

## Project Status

### Completed
- 14 agent definitions (SDLC) + 9 discover agents
- 164 skills organized into 11 categories
- 13 phase gate checklists
- 7 document templates
- Configuration system and utility scripts
- Project Constitution system (Enhancement #1)
- Adaptive Workflow (Enhancement #2)
- Autonomous Iteration (Enhancement #3)
- Exclusive Skill Ownership & Enforcement (Enhancement #4)
- Deterministic Iteration Enforcement via Hooks (Enhancement #5)
- Monorepo Support (Enhancement #6)
- Task Planning & Progress Tracking — ORCH-012 (Enhancement #7)

### In Progress
- Integration testing across all phases
- Real project validation

### Planned
- Agent performance metrics
- Workflow visualization tools
- Project portfolio dashboard

## Contributing

This framework is under active development. Contributions, feedback, and suggestions are welcome.

## License

MIT License

---

<div align="center">

**iSDLC Framework** v2.1.0 — 23 agents, 164 skills, 13 gates, 5 hooks, 7 enhancements

</div>
