# iSDLC Agents

This document provides detailed information about all 37 agents in the iSDLC framework.

## Overview

The framework's 37 agents are organized into six groups:

| Group | Count | Purpose |
|-------|-------|---------|
| [SDLC Agents](#sdlc-agents) | 15 | Execute development phases (1 orchestrator + 14 phase agents) |
| [Discover Agents](#discover-agents) | 9 | Analyze projects before development begins |
| [Quick Scan Agent](#quick-scan-agent-phase-00) | 1 | Lightweight scope estimation before requirements |
| [Impact Analysis Agents](#impact-analysis-agents-phase-02) | 4 | Full feature impact analysis after requirements |
| [Tracing Agents](#tracing-agents-phase-02) | 4 | Trace bug root causes after requirements |
| [Reverse Engineer Agents](#reverse-engineer-agents) | 4 | Extract knowledge from existing code |

---

## SDLC Agents

The 15 SDLC agents implement a 1-to-1 mapping between phases and agents. Each agent owns exactly one phase from requirements through operations and upgrades.

| Phase | Agent | Responsibility | Key Artifacts |
|-------|-------|----------------|---------------|
| **00** | **SDLC Orchestrator** | Workflow coordination, phase gates, conflict resolution | workflow-state.json, gate-validation.json |
| **01** | **Requirements Analyst** | Requirements capture, user stories, NFRs | requirements-spec.md, user-stories.json, nfr-matrix.md |
| **03** | **Solution Architect** | System architecture, tech stack, database design | architecture-overview.md, tech-stack-decision.md, ADRs |
| **04** | **System Designer** | API contracts, module design, UI/UX wireframes | openapi.yaml, module-designs/, wireframes/ |
| **05** | **Test Design Engineer** | Test strategy, test cases, traceability | test-strategy.md, test-cases/, traceability-matrix.csv |
| **06** | **Software Developer** | Implementation (TDD), unit tests, coding standards | source-code/, unit-tests/, coverage-report.html |
| **07** | **Integration Tester** | Integration testing, E2E testing, API contract tests | integration-tests/, e2e-tests/, test-execution-report.md |
| **08** | **QA Engineer** | Code review, quality metrics, QA sign-off | code-review-report.md, quality-metrics.md, qa-sign-off.md |
| **09** | **Security & Compliance Auditor** | Security scanning, penetration testing, compliance | security-scan-report.md, compliance-checklist.md |
| **10** | **CI/CD Engineer** | Pipeline automation, build configuration | ci-config.yaml, cd-config.yaml, Dockerfile |
| **11** | **Environment Builder** | Local environment build & launch for testing | testing_environment in state.json, build-log.md |
| **11** | **Deployment Engineer (Staging)** | Staging deployment, smoke tests, rollback | deployment-log-staging.md, smoke-test-results.md |
| **12** | **Release Manager** | Production deployment, release coordination | release-notes.md, post-deployment-report.md |
| **14** | **Upgrade Engineer** | Dependency/tool upgrades with regression testing | upgrade-analysis.md, upgrade-summary.md |
| **15** | **Site Reliability Engineer** | Operations, monitoring, incident response, SLAs | monitoring-config/, alert-rules.yaml, sla-tracking.md |

**1-to-1 Mapping**: Each phase has exactly ONE dedicated agent with clear entry/exit criteria. No overlapping responsibilities — conflicts only occur at phase boundaries and are handled by the Orchestrator.

---

## Exploration Agents

Exploration agents help understand the scope and impact of changes through specialized analysis.

### Quick Scan Agent (Phase 00 - Feature Workflow)

For new features, the Quick Scan Agent performs a **lightweight** scope estimation BEFORE requirements gathering. This provides just enough context for the Requirements Analyst without over-investing in analysis that may change after requirements clarification.

| ID | Agent | Responsibility |
|----|-------|----------------|
| **QS** | **Quick Scan Agent** | Keyword extraction, file count estimation, scope estimation (small/medium/large) |

**Invoked by**: `/sdlc feature "description"` (automatic, or skip with `--no-scan`)

**Output**: `quick-scan.md` (lightweight scope estimate, keyword matches, file count)

**Note**: Quick Scan uses the haiku model for fast, lightweight analysis.

### Impact Analysis Agents (Phase 02 - Feature Workflow)

For new features, **after Phase 01 captures and clarifies the requirements**, the Impact Analysis Orchestrator (IA0) coordinates three parallel sub-agents to produce a comprehensive `impact-analysis.md`:

| ID | Agent | Responsibility |
|----|-------|----------------|
| **IA0** | **Impact Analysis Orchestrator** | Coordinates analysis, consolidates impact report |
| **IA1** | **Impact Analyzer** | Affected files per AC, module dependencies, change propagation |
| **IA2** | **Entry Point Finder** | API endpoints per AC, UI components, implementation order |
| **IA3** | **Risk Assessor** | Risk per AC, coverage gaps, technical debt, blocking risks |

**Workflow Position**: Phase 02 (after Requirements)

**Invoked by**: `/sdlc feature "description"` (automatic, after Phase 01)

**Input**: Requirements document from Phase 01, Quick Scan from Phase 00

**Output**: `impact-analysis.md` (comprehensive, based on finalized requirements)

**Key Design Decision**: Impact Analysis runs AFTER requirements gathering. This ensures analysis is based on clarified, finalized requirements rather than initial descriptions.

### Tracing Agents (Phase 02 - Bug Fix Workflow)

For bug fixes, **after Phase 01 captures the bug report**, the Tracing Orchestrator (T0) coordinates three parallel sub-agents to produce `trace-analysis.md`:

| ID | Agent | Responsibility |
|----|-------|----------------|
| **T0** | **Tracing Orchestrator** | Coordinates tracing, consolidates diagnosis |
| **T1** | **Symptom Analyzer** | Error parsing, stack traces, reproduction steps, patterns |
| **T2** | **Execution Path Tracer** | Call chain, data flow, state mutations, branch points |
| **T3** | **Root Cause Identifier** | Hypotheses, evidence correlation, fix recommendations |

**Workflow Position**: Phase 02 (after Requirements, before Test Strategy)

**Invoked by**: `/sdlc fix "description"` (automatic, or skip with `--no-tracing`)

**Input**: Bug report from Phase 01 (`bug-report.md`, `requirements-spec.md`)

**Output**: `trace-analysis.md`, `diagnosis.json` (in bug artifact folder)

---

## Discover Agents

The `/discover` command uses 9 specialized sub-agents to analyze projects before SDLC workflows begin.

**For existing projects**: D1, D2, D5, and D6 run in parallel to produce a unified `docs/project-discovery-report.md`.

**For new projects**: D7 guides vision elicitation and D8 designs the architecture blueprint.

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

**Invoked by**: `/discover`

**Output**: `docs/project-discovery-report.md`, `docs/isdlc/constitution.md`

---

## Reverse Engineer Agents

The `/sdlc reverse-engineer` command uses 4 specialized sub-agents to extract acceptance criteria and generate characterization tests from existing code.

| ID | Agent | Responsibility |
|----|-------|----------------|
| **R1** | **Behavior Analyzer** | Extract behavioral contracts, side effects, and implicit AC from source code |
| **R2** | **Characterization Test Generator** | Generate tests that capture current behavior as executable specifications |
| **R3** | **Artifact Integration** | Link extracted AC to feature maps, generate traceability matrices |
| **R4** | **ATDD Bridge** | Prepare extracted AC for ATDD workflow integration with priority tagging |

**Invoked by**: `/sdlc reverse-engineer`

**Output**: Acceptance criteria documents, characterization tests, traceability matrices

---

## Development Phases

The framework implements a workflow with quality gates between each phase.

### Feature Workflow
```
Phase 00: Quick Scan
    | (Quick Scan Agent)
    v GATE-00: Scope estimated
Phase 01: Requirements Capture
    | (Requirements Analyst)
    v GATE-01: Requirements validated
Phase 02: Impact Analysis
    | (Impact Analysis Orchestrator)
    v GATE-02: Impact analysis complete
Phase 03: Architecture & Blueprint
    | (Solution Architect)
    v GATE-03: Architecture review
Phase 04: Design & API Contracts
    | (System Designer)
    v GATE-04: Design approval
Phase 05: Test Strategy & Design
    | (Test Design Engineer)
    v GATE-05: Test strategy approval
Phase 06: Implementation
    | (Software Developer)
    v GATE-06: Code complete + unit tests pass
Phase 07: Integration & Testing
    | (Integration Tester)
    v GATE-07: Integration tests pass
Phase 08: Code Review & QA
    | (QA Engineer)
    v GATE-08: QA sign-off
Phase 09: Independent Validation
    | (Security & Compliance Auditor)
    v GATE-09: Security sign-off
Phase 10: Version Control & CI/CD
    | (CI/CD Engineer)
    v GATE-10: Pipeline operational
Phase 10: Local Development & Testing
    | (Environment Builder)
    v GATE-10: Local environment validated
Phase 11: Test Environment Deployment
    | (Deployment Engineer - Staging)
    v GATE-11: Staging deployment verified
Phase 12: Production Deployment
    | (Release Manager)
    v GATE-12: Production go-live complete
Phase 14: Upgrades
    | (Upgrade Engineer)
    v GATE-14: Upgrade complete, zero regressions
Phase 15: Production Operations
    | (Site Reliability Engineer)
    v GATE-15: Operations stable
```

### Bug Fix Workflow
```
Phase 01: Requirements (Bug Report)
    | (Requirements Analyst)
    v GATE-01: Bug report captured
Phase 02: Tracing
    | (Tracing Orchestrator)
    v GATE-02: Root cause identified
Phase 05: Test Strategy & Design
    | (Test Design Engineer)
    v GATE-05: Test strategy for fix
Phase 06: Implementation (TDD)
    | (Software Developer)
    v GATE-06: Fix implemented, tests pass
... (remaining phases as needed)
```

---

## Agent Files

Agent definitions are located in `.claude/agents/`:

```
.claude/agents/
├── 00-sdlc-orchestrator.md
├── 01-requirements-analyst.md
├── 03-solution-architect.md
├── 04-system-designer.md
├── 05-test-design-engineer.md
├── 06-software-developer.md
├── 07-integration-tester.md
├── 08-qa-engineer.md
├── 09-security-compliance-auditor.md
├── 10-cicd-engineer.md
├── 10-dev-environment-engineer.md
├── 11-deployment-engineer-staging.md
├── 12-release-manager.md
├── 14-upgrade-engineer.md
├── 15-site-reliability-engineer.md
├── quick-scan/
│   └── quick-scan-agent.md
├── impact-analysis/
│   ├── impact-analysis-orchestrator.md
│   ├── impact-analyzer.md
│   ├── entry-point-finder.md
│   └── risk-assessor.md
├── tracing/
│   ├── tracing-orchestrator.md
│   ├── symptom-analyzer.md
│   ├── execution-path-tracer.md
│   └── root-cause-identifier.md
├── discover/
│   └── (discover agent files)
└── reverse-engineer/
    └── (reverse engineer agent files)
```
