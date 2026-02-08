---
name: tour
description: Interactive guided tour of iSDLC framework features and capabilities
user_invocable: true
---

# /tour — iSDLC Framework Tour

Provide an interactive guided tour of the iSDLC framework. This command helps users understand the framework's capabilities, commands, agents, and workflow.

## Instructions

When the user runs `/tour`, follow these steps:

### Step 1: Ask Tour Mode

Ask the user which tour they'd like:

**Light intro** (~5 minutes) — Quick overview of commands, agents, and workflow
**Full tour** (~15 minutes) — Comprehensive walkthrough of all framework features

If the user doesn't specify, default to Light intro.

---

### Light Intro (5 sections)

Present these 5 sections, each as a short paragraph with a heading. Present them all at once (no pauses).

#### 1. What is iSDLC?

iSDLC (integrated Software Development Lifecycle) is a framework of 36 AI agents that guide development from requirements capture through production deployment. Each SDLC phase has a dedicated agent, quality gates between phases enforce completion before advancement, and deterministic hooks enforce rules at runtime. The framework transforms Claude Code from a general assistant into a structured development partner that follows your project's governance rules.

#### 2. Core Commands

- **`/discover`** — Analyze an existing project (architecture, tests, features, tech stack) or describe a new one. Creates a tailored project constitution and maps your codebase.
- **`/sdlc feature "description"`** — Develop a feature end-to-end through all required phases (requirements → architecture → design → tests → implementation → review → deployment).
- **`/sdlc fix "description"`** — Fix a bug using a TDD approach with tracing agents that analyze symptoms, trace execution paths, and identify root causes.
- **`/provider`** — Configure which LLM models power the sub-agents (Claude Code, Anthropic API, Ollama, free-tier cloud, or hybrid routing).

#### 3. How the Workflow Works

When you start a task with `/sdlc`, the SDLC orchestrator:
1. Assesses task complexity (simple, moderate, complex, critical)
2. Selects which of the 16 phases to run and which to skip
3. Delegates to phase agents in order — each agent produces artifacts that feed the next
4. Quality gates block advancement until requirements are met
5. Iteration loops allow agents to retry failed phases (with circuit breakers to prevent infinite loops)

The orchestrator manages the full lifecycle so you focus on reviewing outputs rather than managing process.

#### 4. The Constitution

Your project's constitution (`docs/isdlc/constitution.md`) defines governance rules:
- Testing thresholds (e.g., ≥80% unit coverage)
- Security requirements (no secrets in code, input validation)
- Coding standards and simplicity principles
- Quality gate integrity rules

The constitution is created during `/discover` and enforced by hooks throughout every phase. It persists across sessions — every agent reads and follows it.

#### 5. What to Do Next

- **Existing project**: Run `/discover` to analyze your codebase, then `/sdlc feature` or `/sdlc fix` to start developing
- **New project**: Run `/discover` to describe your project and create a constitution, then `/sdlc start` to begin from requirements

Run `/tour full` anytime for the comprehensive walkthrough.

---

### Full Tour (8 sections)

Present sections 1-5 from the Light Intro above, then continue with sections 6-8 below.

After each section (including sections 1-5), ask: **"Continue to next topic? (Y/skip/done)"**
- **Y** (default): Show the next section
- **skip**: Skip to the next section heading, show just the title, then ask again
- **done**: End the tour

#### 6. The 16 Phases

Present this table:

| Phase | Agent | Purpose | Key Artifact |
|-------|-------|---------|--------------|
| 00 | Quick Scan | Lightweight scope estimate before requirements | Scope estimate |
| 01 | Requirements Analyst | Capture and structure requirements | requirements-spec.md, user-stories.json |
| 02 | Solution Architect | System architecture and technology decisions | architecture-overview.md, ADRs |
| 03 | System Designer | Detailed interface and module design | interface-spec.yaml, module-designs/ |
| 04 | Test Design Engineer | Test strategy and case design | test-strategy.md, test-cases/ |
| 05 | Software Developer | TDD implementation with unit tests | Production code + unit tests |
| 06 | Integration Tester | Integration and end-to-end testing | Test reports, coverage metrics |
| 07 | QA Engineer | Code review and quality metrics | Review report, quality scores |
| 08 | Security Compliance Auditor | Security scanning and validation | Security audit report |
| 09 | CI/CD Engineer | Pipeline configuration and automation | CI/CD config files |
| 10 | Environment Builder | Build, start, and health-check services | Running environment |
| 11 | Deployment Engineer (Staging) | Staging deployment and smoke tests | Deployment validation |
| 12 | Release Manager | Production release coordination | Release notes |
| 13 | Site Reliability Engineer | Production monitoring and incident response | Operational runbook |

Additionally, there are specialized agent groups:
- **Discover agents** (6): Feature mapper, characterization test generator, artifact integrator, architecture analyzer, data model analyzer, ATDD bridge
- **Exploration agents** (4): Impact analyzer, entry point finder, risk assessor, impact analysis orchestrator
- **Tracing agents** (4): Symptom analyzer, execution path tracer, root cause identifier, tracing orchestrator

Not all phases run for every task — the orchestrator selects phases based on complexity.

#### 7. Quality Gates & Hooks

**Quality Gates**: Each phase has a gate checklist that must pass before advancing. The `gate-blocker` hook enforces this deterministically — it checks:
1. Required artifacts exist for the current phase
2. Iteration requirements met (min iterations, test evidence)
3. Constitution validated
4. Phase agent was actually delegated to (not skipped)

**The 10 Hooks** (run automatically by Claude Code):
| Hook | Trigger | Purpose |
|------|---------|---------|
| skill-validator | PreToolUse | Validates skill usage (observe mode — logs, never blocks) |
| log-skill-usage | PostToolUse | Logs which skills each agent uses for observability |
| iteration-corridor | PreToolUse | Enforces iteration limits and tracks retry history |
| constitution-validator | PreToolUse | Validates constitution exists and is not just a template |
| test-watcher | PostToolUse | Monitors test execution and tracks pass/fail results |
| menu-tracker | PostToolUse | Tracks workflow menu selections |
| model-provider-router | PreToolUse | Routes sub-agent tasks to configured model providers |
| gate-blocker | Stop | Blocks phase advancement if gate requirements not met |
| skill-delegation-enforcer | PostToolUse[Skill] | Ensures /sdlc and /discover trigger orchestrator delegation |
| delegation-gate | Stop | Verifies orchestrator actually delegated to phase agents |

All hooks are deterministic (no LLM calls), written in CommonJS (.cjs), and fail-open on errors.

#### 8. Workflow Example

Here's what happens when you run `/sdlc feature "Add user authentication"`:

1. **Orchestrator Assessment**: Evaluates complexity → likely "complex" (security, multiple components)
2. **Phase 01 — Requirements**: Requirements analyst captures functional requirements, user stories, and acceptance criteria → `requirements-spec.md`
3. **Phase 02 — Architecture**: Solution architect designs auth system (JWT vs sessions, middleware structure, database schema) → `architecture-overview.md` + ADRs
4. **Phase 03 — Design**: System designer creates detailed API contracts, data flows, error handling → `interface-spec.yaml`
5. **Phase 04 — Test Strategy**: Test design engineer creates test plan with cases for each requirement → `test-strategy.md`
6. **Phase 05 — Implementation**: Software developer writes code with TDD (tests first, then implementation) → Source code + unit tests
7. **Phase 06 — Testing**: Integration tester runs full test suite, measures coverage → Test reports
8. **Phase 07 — Code Review**: QA engineer reviews code quality, checks standards → Review report
9. **Phase 08 — Security**: Security auditor scans for vulnerabilities, validates auth implementation → Security report

Each phase gate must pass before the next begins. If a gate fails, the agent iterates (up to the configured maximum) before escalating.

That completes the full tour! Remember:
- `/discover` to analyze your project
- `/sdlc feature` or `/sdlc fix` to start developing
- `/provider` to configure model routing
- `/tour` to revisit this introduction anytime

---

## Argument Handling

- `/tour` with no arguments → Ask which mode (light/full)
- `/tour light` or `/tour quick` → Jump straight to light intro
- `/tour full` → Jump straight to full tour
