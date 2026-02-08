---
name: tour
description: Interactive guided tour of iSDLC framework features and capabilities
user_invocable: true
---

# /tour — iSDLC Interactive Guide

An interactive, use-case-driven guide that helps users understand what to do based on their situation. Instead of a reference manual, this walks users through real workflows step by step.

## Instructions

When the user runs `/tour`, follow these steps in order.

### Step 1: Context Detection

Before showing any content, silently check the project state:

1. Read `.isdlc/state.json` (if it exists) and note:
   - `discovery_completed` — whether `/discover` has been run
   - `active_workflow` — whether an SDLC workflow is in progress
   - `discovery_context.project_type` — `existing` or `greenfield`
2. These values inform which menu option to highlight (Step 2), but do NOT block the tour if state is missing.

### Step 2: Welcome + Main Menu

Present this welcome and menu. If context detection found a relevant signal, add a short note like *"Based on your project, option 1 is most relevant."*

---

**Welcome to iSDLC** — a framework of 36 AI agents that guide development from requirements through deployment. Quality gates enforce completion between phases, and deterministic hooks enforce rules at runtime.

**What would you like to learn about?**

Use AskUserQuestion with these options:

| Option | Label |
|--------|-------|
| 1 | Working with an existing project |
| 2 | Starting a new (greenfield) project |
| 3 | Upgrading dependencies or runtimes |
| 4 | Generating a test suite |
| 5 | Installation and AI tool setup |

If the user selects an option, jump to that use case section below.

After each use case section, offer navigation with AskUserQuestion:

| Option | Label |
|--------|-------|
| B | Back to main menu |
| N | Next use case |
| Q | Exit tour |

---

### Use Case 1: Working with an Existing Project

#### 1a. First-Time Setup

If you haven't run `/discover` on this project yet, that's your starting point. Discovery analyzes your codebase and creates a tailored project constitution.

**Run:** `/discover`

What happens during discovery:
1. **Architecture scan** — maps your project structure, dependencies, and patterns
2. **Tech stack detection** — identifies languages, frameworks, build tools
3. **Test evaluation** — measures existing coverage and identifies gaps
4. **Feature mapping** — catalogs endpoints, pages, commands, background jobs
5. **Constitution generation** — creates governance rules tailored to your stack (testing thresholds, security rules, coding standards)
6. **Post-discovery walkthrough** — reviews the constitution with you, suggests next steps

After discovery, the framework knows your project. You only need to re-run `/discover` if the architecture changes significantly (e.g., new major dependency, restructured modules).

#### 1b. Feature Development

**Run:** `/sdlc feature "description of the feature"`

The orchestrator assesses complexity and selects which phases to run. For a typical feature:

1. **Requirements** — the requirements analyst captures functional requirements, user stories, and acceptance criteria
2. **Architecture** — the solution architect evaluates whether the feature needs architectural changes (extends existing patterns when discovery context exists)
3. **Design** — the system designer creates detailed API contracts, data flows, and error handling
4. **Test Strategy** — the test design engineer creates a test plan with cases mapped to each requirement
5. **Implementation** — the software developer writes code using TDD (tests first, then implementation)
6. **Local Testing** — the environment builder starts services and runs health checks
7. **Integration Testing** — the integration tester runs the full test suite and measures coverage
8. **Code Review** — the QA engineer reviews code quality and checks standards
9. **Security** — the security auditor scans for vulnerabilities
10. **CI/CD** — the CI/CD engineer configures pipeline automation

Each phase has a quality gate that must pass before the next begins. If a gate fails, the agent iterates (with circuit breakers to prevent infinite loops).

Not all phases run for every feature — the orchestrator skips phases when complexity is low.

#### 1c. Bug Fix

**Run:** `/sdlc fix "description of the bug"`

Bug fixes use a TDD approach with tracing agents:

1. **Bug Report** — the requirements analyst captures the bug report (expected behavior, actual behavior, reproduction steps)
2. **Tracing** — three specialized agents work in parallel:
   - Symptom analyzer — analyzes error messages and log patterns
   - Execution path tracer — follows code execution from entry point to where the bug manifests
   - Root cause identifier — synthesizes findings and ranks hypotheses
3. **Test Strategy** — the test design engineer creates test cases that reproduce the bug
4. **Implementation** — the software developer writes a failing test first, then fixes the code until the test passes
5. **Testing** — the integration tester verifies the fix doesn't break anything else
6. **Code Review** — the QA engineer reviews the fix

---

### Use Case 2: Starting a New (Greenfield) Project

#### 2a. First-Time Setup

For a brand-new project, discovery works differently — it helps you plan rather than scan.

**Run:** `/discover`

What happens for a new project:
1. **Vision elicitation** — the product analyst asks about your project goals, target users, and constraints
2. **Research** — analyzes similar projects, frameworks, and patterns relevant to your vision
3. **Tech stack recommendation** — suggests technologies based on your requirements
4. **PRD generation** — creates a Product Requirements Document
5. **Architecture blueprint** — designs the initial system architecture
6. **Constitution generation** — creates governance rules for the new project
7. **Scaffolding** — sets up project structure, configuration, and initial files

#### 2b. Feature Development and Bug Fixes

Once discovery is complete, feature development and bug fixes work exactly the same as for existing projects. See Use Case 1b and 1c above.

The only difference: the first feature often implements the core scaffolding, so the orchestrator may include all phases.

---

### Use Case 3: Upgrading Dependencies or Runtimes

#### 3a. Prerequisites

Before upgrading, you need existing test coverage to verify nothing breaks. If your test suite is thin:

**Run:** `/sdlc test generate` first (see Use Case 4)

The upgrade workflow uses an implement-test loop — it makes changes, runs tests, and iterates until all tests pass. Without tests, it has no safety net.

#### 3b. Upgrade Workflow

**Run:** `/sdlc upgrade "name of dependency or runtime"`

Example: `/sdlc upgrade "Node.js 22"` or `/sdlc upgrade "React 19"`

What happens:
1. **Detection** — identifies the current version and looks up the target version
2. **Impact analysis** — reviews changelogs, identifies breaking changes, maps affected files
3. **Migration plan** — generates a step-by-step plan ranked by risk, presented for your approval
4. **Implement-test loop** — for each migration step:
   - Makes the code change
   - Runs the test suite
   - If tests fail, analyzes failures and iterates
   - Moves to next step when tests pass
5. **Code review** — QA engineer reviews all changes
6. **Merge** — when all tests pass and review is complete

You approve the migration plan before any code changes begin.

---

### Use Case 4: Generating a Test Suite

#### 4a. Why Generate Tests?

Tests are a prerequisite for:
- **Upgrades** — the implement-test loop needs tests to verify changes
- **Bug fixes** — TDD requires a failing test that proves the bug exists
- **Safe refactoring** — tests catch regressions
- **Constitution enforcement** — your constitution defines coverage thresholds (e.g., ≥80% unit coverage)

#### 4b. Test Generation Workflow

**Run:** `/sdlc test generate`

What happens:
1. **Analysis** — evaluates your codebase to understand what needs testing
2. **Test strategy** — the test design engineer creates a comprehensive plan (unit, integration, E2E)
3. **Implementation** — the software developer writes the tests using your project's existing test framework
4. **Execution** — runs the generated tests and measures coverage
5. **Review** — QA engineer reviews test quality

The framework uses your constitution's testing thresholds to determine when coverage is sufficient.

---

### Section 5: Installation and AI Tool Setup

#### Installation Methods

| Method | Command |
|--------|---------|
| npx (one-time) | `npx isdlc init` |
| Global install | `npm install -g isdlc && isdlc init` |
| Git clone | `git clone <repo> && ./install.sh` |
| Windows | `.\install.ps1` |

#### Agent Model Configuration

iSDLC uses Claude Code as the primary AI engine. Sub-agents can be routed to different model providers:

| Mode | Description |
|------|-------------|
| claude-code | All agents use Claude Code (recommended) |
| quality | Anthropic API for max quality (requires API key) |
| free | Free-tier cloud providers for cost-sensitive work |
| budget | Mix of free and paid for balanced cost |
| local | Ollama only — offline, requires GPU with 12GB+ VRAM |
| hybrid | Smart per-phase routing — advanced, configure in providers.yaml |

**Run:** `/provider` to view or change your current configuration.

#### Key Files

- `.isdlc/state.json` — project state (gitignored, tracks phases and progress)
- `.isdlc/providers.yaml` — model provider configuration
- `docs/isdlc/constitution.md` — project governance rules
- `.claude/settings.json` — Claude Code hook and agent configuration

---

## Argument Handling

- `/tour` with no arguments → Show welcome + main menu (Step 2)
- `/tour existing` → Jump directly to Use Case 1
- `/tour new` or `/tour greenfield` → Jump directly to Use Case 2
- `/tour upgrade` → Jump directly to Use Case 3
- `/tour test` → Jump directly to Use Case 4
- `/tour install` → Jump directly to Section 5

When jumping to a specific section, still offer the navigation options (Back / Next / Exit) at the end.
