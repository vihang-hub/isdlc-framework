# iSDLC Agents

This document provides detailed information about all 36 agents in the iSDLC framework.

## Overview

The framework's 36 agents are organized into five groups:

| Group | Count | Purpose |
|-------|-------|---------|
| [SDLC Agents](#sdlc-agents) | 15 | Execute development phases (1 orchestrator + 14 phase agents) |
| [Discover Agents](#discover-agents) | 9 | Analyze projects before development begins |
| [Mapping Agents](#mapping-agents-phase-00) | 4 | Analyze feature impact before requirements capture |
| [Tracing Agents](#tracing-agents-phase-00) | 4 | Trace bug root causes before fix requirements |
| [Reverse Engineer Agents](#reverse-engineer-agents) | 4 | Extract knowledge from existing code |

---

## SDLC Agents

The 15 SDLC agents implement a 1-to-1 mapping between phases and agents. Each agent owns exactly one phase from requirements through operations and upgrades.

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
| **14** | **Upgrade Engineer** | Dependency/tool upgrades with regression testing | upgrade-analysis.md, upgrade-summary.md |

**1-to-1 Mapping**: Each phase has exactly ONE dedicated agent with clear entry/exit criteria. No overlapping responsibilities — conflicts only occur at phase boundaries and are handled by the Orchestrator.

---

## Exploration Agents

Exploration agents help understand the scope and impact of changes through specialized analysis.

### Mapping Agents (Phase 00 - Feature Workflow)

For new features, the Mapping Orchestrator (M0) coordinates three parallel sub-agents to produce `impact-analysis.md`:

| ID | Agent | Responsibility |
|----|-------|----------------|
| **M0** | **Mapping Orchestrator** | Coordinates mapping, consolidates impact analysis |
| **M1** | **Impact Analyzer** | Affected files, module dependencies, change propagation |
| **M2** | **Entry Point Finder** | API endpoints, UI components, jobs, event handlers |
| **M3** | **Risk Assessor** | Complexity scoring, coverage gaps, technical debt, risk zones |

**Invoked by**: `/sdlc feature "description"` (automatic, or skip with `--no-mapping`)

**Output**: `docs/isdlc/impact-analysis.md`, `feature-map.json`

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

The framework implements a linear 14-phase workflow with quality gates between each phase.

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
Phase 14: Upgrades
    | (Upgrade Engineer)
    v GATE-14: Upgrade complete, zero regressions
```

---

## Agent Files

Agent definitions are located in `.claude/agents/`:

```
.claude/agents/
├── 00-sdlc-orchestrator.md
├── 01-requirements-analyst.md
├── 02-solution-architect.md
├── 03-system-designer.md
├── 04-test-design-engineer.md
├── 05-software-developer.md
├── 06-integration-tester.md
├── 07-qa-engineer.md
├── 08-security-compliance-auditor.md
├── 09-cicd-engineer.md
├── 10-environment-builder.md
├── 11-deployment-engineer-staging.md
├── 12-release-manager.md
├── 13-site-reliability-engineer.md
├── 14-upgrade-engineer.md
├── D0-discover-orchestrator.md
├── D1-architecture-analyzer.md
├── D2-test-evaluator.md
├── D3-constitution-generator.md
├── D4-skills-researcher.md
├── D5-data-model-analyzer.md
├── D6-feature-mapper.md
├── D7-product-analyst.md
├── D8-architecture-designer.md
├── M0-mapping-orchestrator.md
├── M1-impact-analyzer.md
├── M2-entry-point-finder.md
├── M3-risk-assessor.md
├── T0-tracing-orchestrator.md
├── T1-symptom-analyzer.md
├── T2-execution-path-tracer.md
├── T3-root-cause-identifier.md
├── R1-behavior-analyzer.md
├── R2-characterization-test-generator.md
├── R3-artifact-integration.md
└── R4-atdd-bridge.md
```
