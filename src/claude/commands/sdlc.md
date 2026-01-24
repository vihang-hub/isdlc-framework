## SDLC Orchestrator Command
Invoke the SDLC Orchestrator to coordinate software development lifecycle workflows.

### Usage
`/sdlc <action> [options]`

### No-Argument Behavior (Interactive Menu)

When `/sdlc` is invoked without any action, present a context-aware menu based on project state.

**Detection Logic:**
1. Check if `.isdlc/constitution.md` exists and is NOT a template. Template markers include:
   - `<!-- CONSTITUTION_STATUS: STARTER_TEMPLATE -->` (init script marker)
   - `## ⚠️ CUSTOMIZATION REQUIRED` section
   - `**Status**: ⚠️ NEEDS CUSTOMIZATION`
   - `[PROJECT_NAME]` or `[PROJECT NAME]` placeholders
   - `## Instructions` section
   - `(Customize This)` markers
   - `## Articles (Generic - Customize for Your Project)`
2. Check if `.isdlc/state.json` exists and has `current_phase` set (workflow in progress)
3. Check if this is a new or existing project

**Project Type Detection (Priority Order):**

1. **Primary: Check `state.json`** - Read `.isdlc/state.json` → `project.is_new_project`
   - If `is_new_project: true` → NEW project
   - If `is_new_project: false` → EXISTING project (or discovery completed)

2. **Fallback: File-based detection** (if `is_new_project` not set or state.json missing)
   An existing project is detected if ANY of these are found:
   - `src/` or `lib/` or `app/` directory exists
   - `package.json` exists (Node.js project)
   - `requirements.txt` or `pyproject.toml` exists (Python project)
   - `go.mod` exists (Go project)
   - `Cargo.toml` exists (Rust project)
   - `pom.xml` or `build.gradle` exists (Java project)
   - More than 5 source code files (`*.py`, `*.js`, `*.ts`, `*.go`, `*.rs`, `*.java`)

---

**SCENARIO 1: Constitution NOT configured + NEW project (is_new_project: true)**

```
╔══════════════════════════════════════════════════════════════╗
║  iSDLC Framework - New Project Setup                         ║
╚══════════════════════════════════════════════════════════════╝

Constitution Status: Not configured
Project Type: New project

Select an option:

[1] Run /sdlc discover (Recommended)
    Define your project, set up tech stack, and create constitution

[2] Edit constitution.md Manually
    Open .isdlc/constitution.md and customize the template yourself

Enter selection (1-2):
```

---

**SCENARIO 2: Constitution NOT configured + EXISTING project (is_new_project: false)**

```
╔══════════════════════════════════════════════════════════════╗
║  iSDLC Framework - Existing Project Setup                    ║
╚══════════════════════════════════════════════════════════════╝

Constitution Status: Not configured
Project Type: Existing codebase detected (Node.js, TypeScript)

Select an option:

[1] Run /sdlc discover (Recommended)
    Analyze codebase and auto-generate tailored constitution

[2] Edit constitution.md Manually
    Open .isdlc/constitution.md and customize the template yourself

Enter selection (1-2):
```

---

**SCENARIO 3: Constitution IS configured + Workflow NOT started**

```
╔══════════════════════════════════════════════════════════════╗
║  iSDLC Framework - Ready                                     ║
╚══════════════════════════════════════════════════════════════╝

Constitution Status: Configured ✓
Workflow Status: Not started

Select an option:

[1] Start Workflow (Recommended)
    Begin the SDLC workflow with complexity assessment

[2] View Constitution
    Display the current project constitution

[3] Reconfigure Constitution
    Update or replace the existing constitution

Enter selection (1-3):
```

---

**SCENARIO 4: Constitution IS configured + Workflow IN PROGRESS**

```
╔══════════════════════════════════════════════════════════════╗
║  iSDLC Framework - In Progress                               ║
╚══════════════════════════════════════════════════════════════╝

Constitution Status: Configured ✓
Workflow Status: Phase 05 - Implementation (in progress)
Active Agent: Software Developer (Agent 05)

Select an option:

[1] Check Status (Recommended)
    View detailed progress, blockers, and next steps

[2] Run Gate Check
    Validate current phase gate requirements

[3] Advance to Next Phase
    Move to next phase (requires gate to pass)

[4] Escalate Issue
    Pause workflow and escalate an issue for human decision

Enter selection (1-4):
```

---

**After Selection Mapping:**

| Scenario | Option | Action |
|----------|--------|--------|
| 1 (New, no constitution) | [1] | Execute `/sdlc discover` (runs NEW PROJECT FLOW) |
| 1 (New, no constitution) | [2] | Display path to constitution.md and exit |
| 2 (Existing, no constitution) | [1] | Execute `/sdlc discover` (runs EXISTING PROJECT FLOW) |
| 2 (Existing, no constitution) | [2] | Display path to constitution.md and exit |
| 3 (Constitution ready) | [1] | Execute `/sdlc start` (prompt for project name) |
| 3 (Constitution ready) | [2] | Display constitution contents |
| 3 (Constitution ready) | [3] | Execute `/sdlc discover` (re-run setup) |
| 4 (Workflow in progress) | [1] | Execute `/sdlc status` |
| 4 (Workflow in progress) | [2] | Execute `/sdlc gate-check` |
| 4 (Workflow in progress) | [3] | Execute `/sdlc advance` |
| 4 (Workflow in progress) | [4] | Prompt for issue description, then `/sdlc escalate` |

---

### Actions

**start** - Initialize a new project or feature workflow
```
/sdlc start "Project or feature description"
```
1. Validate the project constitution at `.isdlc/constitution.md`
2. If constitution is missing or still a template, STOP and guide the user to create one
3. Assess project complexity and determine required phases
4. Initialize workflow state in `.isdlc/state.json`
5. Delegate to Requirements Analyst (Phase 01)

**status** - Show current project status
```
/sdlc status
```
1. Read `.isdlc/state.json`
2. Report current phase, active agent, blockers, and progress
3. Show completed vs pending phases

**gate-check** - Validate current phase gate
```
/sdlc gate-check
```
1. Identify current phase from state
2. Run gate validation checklist
3. Report pass/fail with details
4. Check constitutional compliance

**advance** - Move to next phase (requires gate pass)
```
/sdlc advance
```
1. Validate current phase gate passes
2. Update state to next phase
3. Delegate to next phase agent

**delegate** - Assign task to specific agent
```
/sdlc delegate <agent-name> "task description"
```
Agents: requirements-analyst, solution-architect, system-designer, test-design-engineer, software-developer, integration-tester, qa-engineer, security-compliance-auditor, cicd-engineer, dev-environment-engineer, deployment-engineer-staging, release-manager, site-reliability-engineer

**escalate** - Escalate issue to human
```
/sdlc escalate "issue description"
```
1. Log escalation in state
2. Pause workflow
3. Present issue to user for resolution

**constitution** - Create or validate project constitution (for NEW projects)
```
/sdlc constitution
```
This command interactively creates a tailored constitution for new projects.

**Step 1: Gather Project Information**
- Prompt: "What is this project about?"
- Wait for user response with project description

**Step 2: Launch Parallel Research Agents**
After receiving the project description, launch 4 research agents IN PARALLEL using a single message with multiple Task tool calls:

```
┌──────────────────────────────────────────────────────────────┐
│  LAUNCHING PARALLEL RESEARCH                                 │
├──────────────────────────────────────────────────────────────┤
│  Agent 1: Best Practices Research                            │
│  Agent 2: Compliance Requirements Research                   │
│  Agent 3: Performance Benchmarks Research                    │
│  Agent 4: Testing Standards Research                         │
└──────────────────────────────────────────────────────────────┘
```

Launch these 4 agents simultaneously (in ONE message with 4 Task tool calls):

| Agent | Task | Search Queries |
|-------|------|----------------|
| **Best Practices** | Research industry best practices | "{project_type} best practices 2026", "{project_type} architecture patterns" |
| **Compliance** | Research compliance requirements | "{project_type} compliance requirements", "HIPAA/PCI-DSS/GDPR {project_type}" |
| **Performance** | Research performance benchmarks | "{project_type} performance benchmarks", "{project_type} SLA standards" |
| **Testing** | Research testing standards | "{project_type} testing best practices", "{project_type} test coverage standards" |

Each agent should:
1. Perform 2-3 WebSearches
2. Extract actionable recommendations
3. Return a structured summary with suggested articles

**Step 3: Collect Results**
Wait for all 4 agents to complete. Aggregate their findings into:
- Recommended domain-specific articles
- Suggested thresholds and requirements
- Compliance considerations

**Step 4: Generate Draft Constitution**
Create a draft with:
- All 10 universal articles (from template)
- Suggested domain-specific articles based on parallel research
- Customized thresholds from research findings

**Step 5: Interactive Article Review**
Walk through each article one by one:
- Display the article with research context
- Ask: "Keep this article as-is, modify it, or remove it?"
- If modify: Ask for specific changes
- Allow adding custom articles

**Step 6: Save and Validate**
Write final constitution to `.isdlc/constitution.md`

**Example Flow:**
```
> What is this project about?
User: "An e-commerce platform for selling handmade crafts with payment processing"

┌──────────────────────────────────────────────────────────────┐
│  LAUNCHING PARALLEL RESEARCH (4 agents)                      │
├──────────────────────────────────────────────────────────────┤
│  ◐ Best Practices: Researching e-commerce patterns...        │
│  ◐ Compliance: Researching PCI-DSS, GDPR requirements...     │
│  ◐ Performance: Researching e-commerce SLAs...               │
│  ◐ Testing: Researching e-commerce testing standards...      │
└──────────────────────────────────────────────────────────────┘

[All agents complete in ~10-15 seconds instead of ~40-60 seconds]

> Research complete! Based on findings, I recommend these articles:
  - Article XI: PCI-DSS Compliance (payment processing detected)
  - Article XII: Performance Requirements (p95 < 200ms for API)
  - Article XIII: Data Privacy (GDPR for customer data)
  - Article XIV: Accessibility (WCAG 2.1 for e-commerce)

> Let's review each article...
```

**discover** - Analyze project and create tailored constitution
```
/sdlc discover
```
This command is the universal entry point for setting up a project with iSDLC. It adapts its behavior based on whether this is a new or existing project.

---

## ⚡ FAST PATH CHECK (MANDATORY - Execute in <5 seconds)

**CRITICAL: This check MUST happen FIRST, IMMEDIATELY, before ANY other action.**

```
┌─────────────────────────────────────────────────────────────────┐
│  STOP. DO NOT:                                                  │
│    ✗ Scan directories                                           │
│    ✗ Read package.json, requirements.txt, or any project files  │
│    ✗ Analyze codebase structure                                 │
│    ✗ Launch exploration agents                                  │
│    ✗ Search for patterns                                        │
│                                                                 │
│  UNTIL you complete this single-file check:                     │
└─────────────────────────────────────────────────────────────────┘
```

**Step 1: Read state.json (ONE file, ONE field)**
```
Read .isdlc/state.json
Extract: project.is_new_project
```

**Step 2: Branch IMMEDIATELY based on result**
```
IF is_new_project === true:
  → Display "New Project Setup" header
  → Ask "What is this project about?"
  → DONE with fast path (continue to NEW PROJECT FLOW below)

IF is_new_project === false:
  → Display "Existing Project Setup" header
  → Begin analysis (EXISTING PROJECT FLOW below)
```

**Why this matters:** New projects have no code to analyze. Spending time scanning an empty project wastes user time. The `is_new_project` flag tells us instantly which path to take.

---

## NEW PROJECT FLOW (is_new_project: true)

For new projects, skip ALL codebase analysis and go directly to interactive constitution creation.

**Immediately display (no scanning, no delay):**
```
╔══════════════════════════════════════════════════════════════╗
║  iSDLC Framework - New Project Setup                         ║
╚══════════════════════════════════════════════════════════════╝

Welcome! Let's set up your new project.

I'll help you:
  1. Define your project and tech stack
  2. Research best practices for your stack
  3. Create a tailored constitution
  4. Set up the recommended folder structure

What is this project about?
(Describe the project type, purpose, and key features)
```

**Then wait for user response.** Do NOT proceed until user describes the project.

**NP-Step 1: Process Project Description**

User responds with project description, e.g.:
```
> "A REST API for managing user authentication with JWT tokens"
```

Parse the description to identify:
- Project type (API, web app, CLI, library, etc.)
- Domain hints (auth, e-commerce, analytics, etc.)
- Any mentioned technologies

**NP-Step 2: Identify Tech Stack**

Ask about the intended tech stack:
```
What technology stack will you use?

Language/Runtime:
[1] Node.js (JavaScript/TypeScript)
[2] Python
[3] Go
[4] Java
[5] Rust
[6] Other (specify)

> User selects: [1] Node.js

Framework:
[1] Express.js
[2] Fastify
[3] NestJS
[4] Koa
[5] Hono
[6] None/Custom

> User selects: [3] NestJS

Database:
[1] PostgreSQL
[2] MySQL
[3] MongoDB
[4] SQLite
[5] None/Undecided
[6] Other (specify)

> User selects: [1] PostgreSQL
```

**NP-Step 3: Launch Parallel Research Agents**

Same as the `constitution` command - launch 4 research agents IN PARALLEL:

| Agent | Task | Search Queries |
|-------|------|----------------|
| **Best Practices** | Research industry best practices | "{project_type} {framework} best practices 2026" |
| **Compliance** | Research compliance requirements | "{project_type} compliance requirements", relevant regulations |
| **Performance** | Research performance benchmarks | "{framework} performance benchmarks", "{project_type} SLA standards" |
| **Testing** | Research testing standards | "{framework} testing best practices", "{language} test coverage standards" |

**NP-Step 4: Generate Draft Constitution**

Create a draft constitution with:
- Universal articles (from template)
- Domain-specific articles based on research
- Customized thresholds from research findings

**NP-Step 5: Interactive Article Review**

Walk through each article:
- Display the article with research context
- Ask: "Keep this article as-is, modify it, or remove it?"
- Allow adding custom articles

**NP-Step 6: Create Project Structure**

Based on the selected tech stack, create the appropriate `src/` structure:

**Node.js/TypeScript (Express, Fastify, Koa, Hono):**
```
src/
├── config/           # Configuration and environment
├── controllers/      # Route handlers
├── middleware/       # Express/Fastify middleware
├── models/          # Data models and types
├── routes/          # Route definitions
├── services/        # Business logic
├── utils/           # Utility functions
└── index.ts         # Entry point
```

**Node.js/TypeScript (NestJS):**
```
src/
├── common/          # Shared decorators, pipes, guards
├── config/          # Configuration modules
├── modules/         # Feature modules
│   └── users/       # Example module
├── app.module.ts    # Root module
└── main.ts          # Entry point
```

**Python (FastAPI, Flask, Django):**
```
src/
├── api/             # API routes/views
├── config/          # Configuration
├── models/          # Data models
├── schemas/         # Pydantic schemas (FastAPI)
├── services/        # Business logic
├── utils/           # Utilities
├── __init__.py
└── main.py          # Entry point
```

**Go:**
```
cmd/
└── server/
    └── main.go      # Entry point
internal/
├── config/          # Configuration
├── handlers/        # HTTP handlers
├── middleware/      # HTTP middleware
├── models/          # Data models
├── repository/      # Data access
└── services/        # Business logic
pkg/                 # Public packages
```

**Java (Spring Boot):**
```
src/
└── main/
    └── java/
        └── com/example/
            ├── config/       # Configuration classes
            ├── controller/   # REST controllers
            ├── model/        # Entity classes
            ├── repository/   # JPA repositories
            ├── service/      # Service layer
            └── Application.java
```

**Rust:**
```
src/
├── config/          # Configuration
├── handlers/        # Request handlers
├── models/          # Data models
├── routes/          # Route definitions
├── services/        # Business logic
└── main.rs          # Entry point
```

Create the structure and add a README:
```bash
mkdir -p src/{appropriate_folders}
echo "# Source Code - {project_name}\n\nGenerated by iSDLC discover for {framework} projects." > src/README.md
```

**NP-Step 7: Initialize Testing Infrastructure**

Based on the selected stack, set up appropriate testing tools:

| Stack | Unit Testing | Integration | E2E |
|-------|-------------|-------------|-----|
| Node.js/TS | Jest/Vitest | Supertest | Playwright |
| Python | pytest | pytest + httpx | pytest + Playwright |
| Go | go test | go test + httptest | - |
| Java | JUnit 5 | Spring Boot Test | - |
| Rust | cargo test | - | - |

Create test directories:
```
tests/
├── unit/
├── integration/
└── e2e/
```

**NP-Step 8: Save and Complete**

1. Write constitution to `.isdlc/constitution.md`
2. Update `state.json`:
   - Set `project.is_new_project: false` (setup complete)
   - Set `project.tech_stack` with detected/selected values
   - Set `current_phase: "01-requirements"`
3. Display completion summary

```
════════════════════════════════════════════════════════════════
  NEW PROJECT SETUP COMPLETE
════════════════════════════════════════════════════════════════

  Project: {project_name}
  Tech Stack: {language} + {framework} + {database}

  Created:
    ✓ .isdlc/constitution.md (tailored constitution)
    ✓ src/ (project structure for {framework})
    ✓ tests/ (testing infrastructure)

  Next Steps:
    1. Review constitution: cat .isdlc/constitution.md
    2. Start coding in src/
    3. When ready: /sdlc start "Your first task"

════════════════════════════════════════════════════════════════
```

---

## EXISTING PROJECT FLOW (is_new_project: false)

For existing projects with code, run the full analysis workflow.

**Phase 1: Architecture Discovery**
1. Scan the project directory structure and files
2. Identify technologies, frameworks, and patterns used
3. Detect project type (web app, API, library, monorepo, etc.)
4. Analyze dependencies (package.json, requirements.txt, go.mod, Cargo.toml, etc.)
5. Map the codebase structure (src/, lib/, components/, services/, etc.)
6. Identify external integrations and databases
7. Generate or update `docs/architecture/architecture-overview.md` with:
   - Executive summary based on discovered structure
   - Technology stack (languages, frameworks, libraries)
   - Container/component architecture diagrams (Mermaid)
   - Data architecture (if database schemas found)
   - External integrations detected
   - Directory structure documentation
8. Report findings to the user

**Phase 1b: Test Automation Evaluation**

Analyze existing test infrastructure to understand current testing maturity, patterns, and gaps.

**CRITICAL: This evaluation informs Phase 4 (Testing Infrastructure Setup) - identifying what already exists vs what needs to be added.**

9. **Detect existing test infrastructure**:

Scan for test-related files and directories:
```
Test Directories:
  - tests/, test/, __tests__/, spec/, specs/
  - src/**/*.test.*, src/**/*.spec.*
  - e2e/, integration/, unit/, functional/
  - cypress/, playwright/, puppeteer/

Test Configuration Files:
  - jest.config.js, jest.config.ts, jest.setup.js
  - vitest.config.ts, vitest.config.js
  - mocha.opts, .mocharc.js, .mocharc.json
  - pytest.ini, pyproject.toml [tool.pytest], conftest.py
  - karma.conf.js, protractor.conf.js
  - cypress.config.js, playwright.config.ts
  - .nycrc, .c8rc, coverage config
  - stryker.conf.js (mutation testing)

Test Scripts in package.json/pyproject.toml:
  - test, test:unit, test:integration, test:e2e
  - test:coverage, test:watch, test:ci
```

10. **Evaluate Scope and Coverage**:

```
┌──────────────────────────────────────────────────────────────┐
│  TEST AUTOMATION EVALUATION: Scope & Coverage                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Test Types Detected:                                        │
│    ✓ Unit Tests: 47 files in tests/unit/                     │
│    ✓ Integration Tests: 12 files in tests/integration/       │
│    ✗ E2E Tests: Not found                                    │
│    ✗ Property-Based Tests: Not found                         │
│    ✗ Mutation Tests: Not configured                          │
│                                                              │
│  Coverage Analysis:                                          │
│    - Coverage tool: Istanbul/nyc                             │
│    - Last reported coverage: 67% (from coverage/lcov.info)   │
│    - Coverage thresholds configured: No                      │
│                                                              │
│  Test-to-Source Ratio:                                       │
│    - Source files: 124                                       │
│    - Test files: 59                                          │
│    - Ratio: 0.48 tests per source file                       │
│                                                              │
│  Modules Without Tests:                                      │
│    - src/services/payment/ (0 tests)                         │
│    - src/utils/validation/ (0 tests)                         │
│    - src/middleware/auth/ (1 test, 5 source files)           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Analysis includes:
- **Test type inventory**: Unit, integration, E2E, performance, security, property-based, mutation
- **Coverage metrics**: Parse existing coverage reports (lcov, cobertura, clover)
- **Coverage thresholds**: Check if thresholds are configured and enforced
- **Test-to-source ratio**: Calculate testing density
- **Untested modules**: Identify source directories/files with no corresponding tests
- **Test file distribution**: How tests are organized across the codebase

11. **Analyze Testing Patterns**:

```
┌──────────────────────────────────────────────────────────────┐
│  TEST AUTOMATION EVALUATION: Patterns                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Testing Framework: Jest 29.x                                │
│  Assertion Library: Jest built-in (expect)                   │
│  Mocking Strategy: jest.mock(), manual mocks in __mocks__/   │
│                                                              │
│  Patterns Detected:                                          │
│    ✓ AAA Pattern (Arrange-Act-Assert): Consistent            │
│    ✓ Test fixtures: tests/fixtures/                          │
│    ✓ Factory functions: tests/factories/                     │
│    ✓ Shared test utilities: tests/helpers/                   │
│    ⚠ Mocking external services: Inconsistent                 │
│    ✗ Contract testing: Not found                             │
│    ✗ Snapshot testing: Not used                              │
│                                                              │
│  Test Data Management:                                       │
│    - Fixtures: JSON files in tests/fixtures/                 │
│    - Factories: Custom factory functions                     │
│    - Database seeding: Not detected                          │
│                                                              │
│  CI Integration:                                             │
│    - GitHub Actions: .github/workflows/test.yml              │
│    - Test command in CI: npm test                            │
│    - Coverage upload: Codecov                                │
│                                                              │
│  Code Quality:                                               │
│    - Test linting: ESLint with jest plugin                   │
│    - Test naming convention: describe/it blocks              │
│    - Async handling: async/await consistent                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Pattern analysis includes:
- **Framework & tools**: Testing framework, assertion library, mocking library
- **Test structure**: AAA pattern, BDD style, test organization
- **Data management**: Fixtures, factories, builders, database seeding
- **Mocking patterns**: How external dependencies are mocked
- **CI/CD integration**: How tests run in pipelines
- **Code quality**: Linting, naming conventions, async patterns

12. **Identify Testing Gaps**:

```
┌──────────────────────────────────────────────────────────────┐
│  TEST AUTOMATION EVALUATION: Gaps & Recommendations          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  CRITICAL GAPS:                                              │
│  ══════════════                                              │
│  1. No E2E Tests                                             │
│     Impact: User journeys not validated                      │
│     Recommendation: Add Playwright/Cypress for critical flows│
│                                                              │
│  2. No Mutation Testing                                      │
│     Impact: Test quality not verified                        │
│     Recommendation: Configure Stryker for mutation analysis  │
│     Article XI Compliance: REQUIRED                          │
│                                                              │
│  3. Payment Module Untested (src/services/payment/)          │
│     Impact: High-risk code without test coverage             │
│     Recommendation: Priority unit + integration tests        │
│                                                              │
│  MODERATE GAPS:                                              │
│  ═══════════════                                             │
│  4. Coverage Below Threshold (67% < 80% target)              │
│     Impact: Significant code paths untested                  │
│     Recommendation: Focus on src/utils/, src/middleware/     │
│                                                              │
│  5. Inconsistent Mocking Strategy                            │
│     Impact: Flaky tests, maintenance burden                  │
│     Recommendation: Standardize on MSW for API mocking       │
│                                                              │
│  6. No Property-Based Testing                                │
│     Impact: Edge cases may be missed                         │
│     Recommendation: Add fast-check for input validation      │
│     Article XI Compliance: RECOMMENDED                       │
│                                                              │
│  MINOR GAPS:                                                 │
│  ════════════                                                │
│  7. No Snapshot Tests for UI Components                      │
│     Impact: UI regressions harder to catch                   │
│     Recommendation: Add snapshot tests for stable components │
│                                                              │
│  8. Missing Test Documentation                               │
│     Impact: Onboarding difficulty                            │
│     Recommendation: Add tests/README.md with conventions     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Gap analysis includes:
- **Missing test types**: E2E, performance, security, contract, mutation, property-based
- **Coverage gaps**: Modules/files with low or no coverage
- **Pattern inconsistencies**: Inconsistent mocking, assertions, organization
- **Article XI compliance**: Check against Integration Testing Integrity requirements
- **Best practice gaps**: Missing fixtures, factories, test utilities
- **Documentation gaps**: Missing test documentation, conventions

13. **Generate Test Evaluation Report**:

Create `.isdlc/test-evaluation-report.md`:
```markdown
# Test Automation Evaluation Report

**Generated**: {DATE}
**Project**: {project_name}
**Tech Stack**: {language}, {framework}

## Executive Summary

| Metric | Value | Status |
|--------|-------|--------|
| Test Types | 2 of 6 | ⚠️ Incomplete |
| Coverage | 67% | ⚠️ Below target (80%) |
| Test-to-Source Ratio | 0.48 | ⚠️ Low |
| Article XI Compliance | 1 of 5 | ❌ Non-compliant |
| Mutation Testing | Not configured | ❌ Missing |

## Scope & Coverage

### Test Types Inventory
| Type | Status | Files | Location |
|------|--------|-------|----------|
| Unit | ✓ | 47 | tests/unit/ |
| Integration | ✓ | 12 | tests/integration/ |
| E2E | ✗ | 0 | - |
| Property-Based | ✗ | 0 | - |
| Mutation | ✗ | 0 | - |
| Performance | ✗ | 0 | - |

### Coverage Analysis
- **Current Coverage**: 67%
- **Target Coverage**: 80%
- **Coverage Tool**: Istanbul/nyc
- **Thresholds Configured**: No

### Untested Modules
| Module | Source Files | Test Files | Risk |
|--------|--------------|------------|------|
| src/services/payment/ | 8 | 0 | HIGH |
| src/utils/validation/ | 5 | 0 | MEDIUM |
| src/middleware/auth/ | 5 | 1 | HIGH |

## Patterns Analysis

### Testing Stack
- **Framework**: Jest 29.x
- **Assertions**: Jest expect
- **Mocking**: jest.mock(), __mocks__/
- **Coverage**: Istanbul/nyc

### Detected Patterns
- ✓ AAA Pattern (Arrange-Act-Assert)
- ✓ Test fixtures (tests/fixtures/)
- ✓ Factory functions (tests/factories/)
- ⚠️ Inconsistent API mocking
- ✗ Contract testing
- ✗ Snapshot testing

### CI/CD Integration
- **Platform**: GitHub Actions
- **Test Script**: npm test
- **Coverage Upload**: Codecov
- **Blocking on Failure**: Yes

## Gaps & Recommendations

### Critical (Must Fix)
1. **Add E2E Tests** - User journeys not validated
2. **Configure Mutation Testing** - Required for Article XI
3. **Test Payment Module** - High-risk code untested

### Moderate (Should Fix)
4. **Increase Coverage to 80%** - Focus on utils/, middleware/
5. **Standardize Mocking** - Use MSW for API mocking
6. **Add Property-Based Tests** - Recommended for Article XI

### Minor (Nice to Have)
7. **Add Snapshot Tests** - For stable UI components
8. **Document Test Conventions** - Create tests/README.md

## Article XI Compliance

| Requirement | Status | Notes |
|-------------|--------|-------|
| Mutation Testing | ❌ | Not configured |
| No Stubs in Integration | ⚠️ | Some tests use mocks |
| No Assertions | ❌ | Traditional assertions used |
| Adversarial Testing | ❌ | No property-based tests |
| Execution-Based Reporting | ⚠️ | Coverage only |

## Recommendations for Phase 4

Based on this evaluation, Phase 4 (Testing Infrastructure Setup) should:
1. Skip: Unit test framework (already configured)
2. Skip: Coverage tooling (already configured)
3. Add: Mutation testing (Stryker)
4. Add: E2E testing (Playwright)
5. Add: Property-based testing (fast-check)
6. Configure: Coverage thresholds enforcement
7. Enhance: Integration test patterns per Article XI
```

14. **Update state.json with evaluation results**:

```json
{
  "test_evaluation": {
    "evaluated_at": "2026-01-23T...",
    "summary": {
      "test_types_found": ["unit", "integration"],
      "test_types_missing": ["e2e", "mutation", "property-based", "performance"],
      "coverage_percent": 67,
      "coverage_target": 80,
      "test_to_source_ratio": 0.48,
      "article_xi_compliance": false
    },
    "existing_infrastructure": {
      "framework": "jest",
      "version": "29.x",
      "coverage_tool": "istanbul",
      "ci_integration": "github-actions"
    },
    "gaps": {
      "critical": ["e2e_tests", "mutation_testing", "payment_module_tests"],
      "moderate": ["coverage_below_target", "inconsistent_mocking", "property_tests"],
      "minor": ["snapshot_tests", "test_documentation"]
    },
    "phase4_recommendations": {
      "skip": ["unit_framework", "coverage_tool"],
      "add": ["mutation_testing", "e2e_testing", "property_testing"],
      "configure": ["coverage_thresholds"],
      "enhance": ["integration_patterns"]
    }
  }
}
```

15. **Present evaluation summary to user**:

```
════════════════════════════════════════════════════════════════
  PHASE 1b COMPLETE: Test Automation Evaluation
════════════════════════════════════════════════════════════════

  Existing Infrastructure:
    ✓ Jest 29.x (unit testing)
    ✓ Istanbul (coverage)
    ✓ GitHub Actions CI

  Coverage: 67% (target: 80%)

  Gaps Identified:
    ❌ No E2E tests
    ❌ No mutation testing (Article XI required)
    ❌ Payment module untested (HIGH RISK)
    ⚠️ Property-based testing missing

  Report: .isdlc/test-evaluation-report.md

  This evaluation will inform Phase 4 (Testing Infrastructure Setup).
  Existing tools will be preserved; only gaps will be addressed.
════════════════════════════════════════════════════════════════

Continue to Phase 2 (Constitution Generation)? [Y/n]
```

**Test Detection Patterns:**

| Language | Test Patterns |
|----------|---------------|
| JavaScript/TypeScript | `*.test.js`, `*.spec.ts`, `__tests__/`, jest, vitest, mocha |
| Python | `test_*.py`, `*_test.py`, `tests/`, pytest, unittest |
| Go | `*_test.go`, `go test` |
| Java | `*Test.java`, `*Tests.java`, `src/test/`, JUnit, TestNG |
| Rust | `#[test]`, `tests/`, `cargo test` |
| Ruby | `*_spec.rb`, `spec/`, RSpec, minitest |
| C# | `*Tests.cs`, `*.Tests/`, xUnit, NUnit, MSTest |

**Coverage Report Parsing:**

| Format | Files |
|--------|-------|
| LCOV | `coverage/lcov.info`, `lcov.info` |
| Cobertura | `coverage.xml`, `cobertura.xml` |
| Clover | `clover.xml` |
| Istanbul JSON | `coverage/coverage-final.json` |
| JaCoCo | `jacoco.xml`, `target/site/jacoco/` |
| Go | `coverage.out`, `cover.out` |

**Phase 2: Constitution Generation**
Based on discovered architecture and test evaluation, generate a tailored constitution:

16. **Infer domain-specific articles** from discovered stack:
    - Payment libraries (Stripe, PayPal) → Suggest PCI-DSS article
    - Auth libraries (Auth0, Passport) → Suggest authentication article
    - Database ORMs → Suggest data integrity article
    - Docker/K8s configs → Suggest deployment article
    - Frontend frameworks → Suggest accessibility/performance articles
    - Test evaluation gaps → Suggest testing-related articles

17. **Identify gaps** that can't be inferred from code:
    - Non-functional requirements (NFRs) like performance SLAs
    - Compliance requirements (HIPAA, GDPR)
    - Business-specific constraints
    - Team conventions

18. **Interactive article walkthrough**:
    For each article (universal + suggested domain-specific):
    - Display the article with context from discovered code
    - Ask: "This article applies to your project. Keep, modify, or skip?"
    - For NFRs not discoverable from code, prompt user to provide values:
      ```
      > I found you're using Express.js for your API.
      > What should the API response time SLA be?
      > [1] p95 < 100ms (strict)
      > [2] p95 < 200ms (standard)
      > [3] p95 < 500ms (relaxed)
      > [4] Custom value
      > [5] Skip this article
      ```

19. **Save constitution**: Write final constitution to `.isdlc/constitution.md`

20. **Initialize state.json** with default cloud configuration:
    - Set `provider: "undecided"`
    - Set `staging_enabled: false`
    - Set `production_enabled: false`
    - Set `workflow_endpoint: "10-local-testing"` (default until cloud configured)
    - Cloud configuration will be prompted after testing completes (Phase 5)

**What discover analyzes:**
- **Package files**: package.json, requirements.txt, go.mod, Cargo.toml, pom.xml, build.gradle, Gemfile
- **Config files**: tsconfig.json, .babelrc, webpack.config.js, docker-compose.yml, Dockerfile
- **Directory patterns**: src/, lib/, api/, components/, services/, models/, controllers/, routes/
- **Database files**: schema files, migrations, prisma.schema, *.sql
- **API definitions**: openapi.yaml, swagger.json, GraphQL schemas
- **Environment files**: .env.example (not .env for security)
- **CI/CD configs**: .github/workflows/, .gitlab-ci.yml, Jenkinsfile

**Stack-to-Article Mapping:**
| Discovered Stack | Suggested Article |
|-----------------|-------------------|
| Stripe, PayPal, payment libs | PCI-DSS Compliance |
| Auth0, Passport, JWT | Authentication Security |
| React, Vue, Angular | Accessibility (WCAG 2.1) |
| Express, FastAPI, Gin | API Performance SLAs |
| Prisma, TypeORM, SQLAlchemy | Data Integrity |
| Docker, Kubernetes | Container Security |
| Redis, Memcached | Caching Strategy |
| Healthcare keywords in code | HIPAA Compliance |
| GDPR-related code patterns | Data Privacy |

**Phase 3: Tech-Stack Skill Customization (skills.sh Integration)**

After constitution creation, discover and install relevant skills from **https://skills.sh/** for the detected tech stack.

**PRIMARY SOURCE: skills.sh**

skills.sh is a centralized directory of reusable AI agent skills. Skills are installed via:
```bash
npx skills add <owner/skill-name>
```

**CRITICAL: Always check skills.sh FIRST before falling back to web research.**

21. **Search skills.sh for each detected technology**:

For each detected technology, search skills.sh to find matching skills.

```
┌──────────────────────────────────────────────────────────────┐
│  PHASE 3: Tech-Stack Skill Customization                     │
├──────────────────────────────────────────────────────────────┤
│  Detected: Node.js, TypeScript, React, Express, PostgreSQL   │
│  Source: https://skills.sh/                                  │
│  Searching for matching skills...                            │
└──────────────────────────────────────────────────────────────┘
```

**Step 1: Fetch skills.sh directory**

Use WebFetch to search skills.sh for each technology:
```
WebFetch: https://skills.sh/
Prompt: "Find all skills related to {technology}. Return skill names, owners, install commands, and descriptions."
```

Alternatively, search the skills.sh leaderboard and category pages:
```
WebFetch: https://skills.sh/search?q={technology}
WebFetch: https://skills.sh/category/{category}
```

**Step 2: Match technologies to available skills**

For each detected technology, identify matching skills from skills.sh:

| Detected Tech | Search Query | Example Matches |
|--------------|--------------|-----------------|
| React | "react" | `anthropics/react`, `vercel/react-best-practices` |
| TypeScript | "typescript" | `anthropics/typescript`, community TS skills |
| Node.js | "nodejs" OR "node" | `anthropics/nodejs`, Express-related skills |
| PostgreSQL | "postgresql" OR "postgres" | Database skills, ORM skills |
| Tailwind | "tailwind" | `tailwindlabs/tailwindcss` |

22. **Present skill recommendations to user**:

```
┌──────────────────────────────────────────────────────────────┐
│  SKILLS.SH RECOMMENDATIONS                                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  React (34K installs)                                        │
│    Skill: anthropics/react                                   │
│    Install: npx skills add anthropics/react                  │
│    Description: React best practices and patterns            │
│                                                              │
│  TypeScript                                                  │
│    Skill: anthropics/typescript                              │
│    Install: npx skills add anthropics/typescript             │
│    Description: TypeScript coding standards                  │
│                                                              │
│  Tailwind CSS (25.8K installs)                               │
│    Skill: tailwindlabs/tailwindcss                           │
│    Install: npx skills add tailwindlabs/tailwindcss          │
│    Description: Tailwind utility-first CSS patterns          │
│                                                              │
│  No skill found for: PostgreSQL                              │
│    → Will use web research fallback                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Install recommended skills? [Y/n/select]
```

**User Options:**
- **Y**: Install all recommended skills
- **n**: Skip skill installation
- **select**: Choose which skills to install interactively

23. **Install selected skills**:

For each selected skill, run the install command:
```bash
npx skills add anthropics/react
npx skills add anthropics/typescript
npx skills add tailwindlabs/tailwindcss
```

Track installed skills in `.isdlc/state.json`:
```json
{
  "skill_customization": {
    "skills_sh_installed": [
      {
        "name": "anthropics/react",
        "installed_at": "2026-01-23T...",
        "version": "latest"
      },
      {
        "name": "anthropics/typescript",
        "installed_at": "2026-01-23T...",
        "version": "latest"
      }
    ]
  }
}
```

24. **Fallback: Web research for unmatched technologies**:

For technologies WITHOUT a matching skill on skills.sh, fall back to web research:

```
┌──────────────────────────────────────────────────────────────┐
│  FALLBACK: Web Research                                      │
├──────────────────────────────────────────────────────────────┤
│  Technology: PostgreSQL                                      │
│  Reason: No matching skill found on skills.sh                │
│  Action: Researching best practices via WebSearch            │
└──────────────────────────────────────────────────────────────┘

  → Searching: "PostgreSQL best practices 2026"
  → Searching: "PostgreSQL security configuration 2026"
  → Extracting actionable guidance...
```

For fallback research, update local skill files:
- Read the skill's current content
- Append researched guidance to "Project-Specific Considerations"
- Use dated headers: `### {Technology} (Web-researched {DATE})`

25. **Generate customization report**: Create `.isdlc/skill-customization-report.md`

```markdown
# Skill Customization Report

**Generated**: {DATE}
**Tech Stack**: Node.js, TypeScript, React, Express, PostgreSQL

## Skills Installed from skills.sh

| Skill | Install Command | Status |
|-------|-----------------|--------|
| anthropics/react | `npx skills add anthropics/react` | ✓ Installed |
| anthropics/typescript | `npx skills add anthropics/typescript` | ✓ Installed |
| tailwindlabs/tailwindcss | `npx skills add tailwindlabs/tailwindcss` | ✓ Installed |

## Web Research Fallback

| Technology | Reason | Skills Updated |
|------------|--------|----------------|
| PostgreSQL | No skills.sh match | database-integration, security-configuration |
| Express.js | No skills.sh match | api-implementation, error-handling |

## Recommendations Applied
[Details of each skill/research result]
```

26. **User confirmation**: Display summary

**Explicit Step Announcements:**

*Phase Start Announcement:*
```
════════════════════════════════════════════════════════════════
  PHASE 3: Tech-Stack Skill Customization
════════════════════════════════════════════════════════════════
  Detected: Node.js, TypeScript, React 18, Express.js, PostgreSQL
  Primary Source: https://skills.sh/
  Fallback: Web research for unmatched technologies
════════════════════════════════════════════════════════════════
```

*Step 1: skills.sh Lookup*
```
┌──────────────────────────────────────────────────────────────┐
│  STEP 1: Searching skills.sh                                 │
├──────────────────────────────────────────────────────────────┤
│  URL: https://skills.sh/                                     │
│  Searching for: React, TypeScript, Node.js, Express, Postgres│
└──────────────────────────────────────────────────────────────┘

  → Found: anthropics/react (34K installs)
  → Found: anthropics/typescript
  → Found: tailwindlabs/tailwindcss (25.8K installs)
  → Not found: PostgreSQL
  → Not found: Express.js
```

*Step 2: Skill Installation*
```
┌──────────────────────────────────────────────────────────────┐
│  STEP 2: Installing Skills                                   │
├──────────────────────────────────────────────────────────────┤
│  Command: npx skills add anthropics/react                    │
│  Status: ✓ Installed                                         │
└──────────────────────────────────────────────────────────────┘
```

*Step 3: Web Research Fallback*
```
┌──────────────────────────────────────────────────────────────┐
│  STEP 3: Web Research Fallback                               │
├──────────────────────────────────────────────────────────────┤
│  Technology: PostgreSQL                                      │
│  Query: "PostgreSQL best practices 2026"                     │
│  Updating: .claude/skills/development/database-integration   │
└──────────────────────────────────────────────────────────────┘
```

*Phase Complete Summary:*
```
════════════════════════════════════════════════════════════════
  PHASE 3 COMPLETE
════════════════════════════════════════════════════════════════

  Skills from skills.sh: 3 installed
    ✓ anthropics/react
    ✓ anthropics/typescript
    ✓ tailwindlabs/tailwindcss

  Web research fallback: 2 technologies
    ✓ PostgreSQL → database-integration updated
    ✓ Express.js → api-implementation updated

  Report: .isdlc/skill-customization-report.md
════════════════════════════════════════════════════════════════

View full customization report? [Y/n]
```

**Idempotency:**

- Track installed skills in `.isdlc/state.json` under `skill_customization.skills_sh_installed`
- If re-running, check which skills are already installed:
  - [1] Skip already installed skills
  - [2] Reinstall all (update to latest)
  - [3] Install only new technologies
- For web research fallback, use dated section headers to identify auto-generated content

**skills.sh Search Strategy:**

When searching skills.sh, try multiple query variations:
1. Exact technology name: "react", "typescript"
2. Framework variations: "reactjs", "react.js"
3. Category browsing: frontend, backend, database, devops
4. Popular/trending skills that match the tech stack

**Fallback Trigger Conditions:**

Use web research fallback when:
- No matching skill exists on skills.sh
- User declines to install a skill
- skills.sh is unavailable (network error)
- Skill is too generic (need project-specific guidance)

**Phase 4: Testing Infrastructure Setup (EVALUATION-DRIVEN)**

After skill customization, set up testing infrastructure to fill the gaps identified in Phase 1b (Test Automation Evaluation). This phase respects existing infrastructure and only adds what's missing.

**CRITICAL: Reference `state.json.test_evaluation.phase4_recommendations` to determine what to skip/add/configure.**

**INTELLIGENT SETUP FLOW:**
- **Skip**: Tools already present (detected in Phase 1b)
- **Add**: Missing test types (e2e, mutation, property-based)
- **Configure**: Missing configurations (coverage thresholds)
- **Enhance**: Existing patterns that need Article XI compliance

27. **Announce Phase 4 with evaluation context**:
```
════════════════════════════════════════════════════════════════
  PHASE 4: Testing Infrastructure Setup
════════════════════════════════════════════════════════════════
  Detected Stack: {primary_language}, {framework}

  From Test Evaluation (Phase 1b):
    ✓ SKIP: Unit testing (Jest already configured)
    ✓ SKIP: Coverage tool (Istanbul already present)
    → ADD: Mutation testing (Stryker)
    → ADD: E2E testing (Playwright)
    → ADD: Property-based testing (fast-check)
    → CONFIGURE: Coverage thresholds (80%)
════════════════════════════════════════════════════════════════
```

28. **Research ONLY missing tools** (skip what exists):

Check `state.json.test_evaluation.phase4_recommendations.add` and research only those:

| Gap from Evaluation | Research Query | Purpose |
|---------------------|---------------|---------|
| **Mutation Testing** (if missing) | "{language} mutation testing tools {YEAR}" | Find mutation testing framework |
| **E2E Testing** (if missing) | "{language} {framework} e2e testing {YEAR}" | Find E2E testing framework |
| **Property-Based** (if missing) | "{language} property-based testing {YEAR}" | Find property-based testing tools |
| **Performance** (if missing) | "{language} performance testing {YEAR}" | Find performance testing tools |

| Agent | Research Query | Purpose |
|-------|---------------|---------|
| **Mutation Testing** | "{language} mutation testing tools {YEAR}" | Find mutation testing framework |
| **Adversarial Testing** | "{language} property-based testing fuzz testing {YEAR}" | Find property-based/fuzz testing tools |
| **Integration Testing** | "{language} {framework} integration testing real API no mocks {YEAR}" | Find real integration testing approach |
| **Test Reporting** | "{language} test reporting execution-based coverage {YEAR}" | Find reporting tools |

Each agent returns:
- Tool name and package (e.g., `@stryker-mutator/core`)
- Install command (e.g., `npm install --save-dev @stryker-mutator/core`)
- Config file format (e.g., `stryker.conf.js`)
- Basic configuration template
- Directory structure recommendations

29. **Present tool recommendations to user** (only for gaps):
```
┌──────────────────────────────────────────────────────────────┐
│  TESTING INFRASTRUCTURE RECOMMENDATIONS                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Mutation Testing:                                           │
│    Tool: Stryker Mutator                                     │
│    Install: npm install --save-dev @stryker-mutator/core     │
│             @stryker-mutator/typescript-checker              │
│             @stryker-mutator/jest-runner                     │
│    Config: stryker.conf.js                                   │
│                                                              │
│  Adversarial Testing:                                        │
│    Tool: fast-check (property-based testing)                 │
│    Install: npm install --save-dev fast-check                │
│    Tool: @faker-js/faker (data generation)                   │
│    Install: npm install --save-dev @faker-js/faker           │
│                                                              │
│  Integration Testing:                                        │
│    Tool: Supertest (real HTTP calls)                         │
│    Install: npm install --save-dev supertest                 │
│    Note: Tests will use actual URLs, no stubs                │
│                                                              │
│  Test Reporting:                                             │
│    Tool: jest-html-reporter                                  │
│    Install: npm install --save-dev jest-html-reporter        │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Proceed with installation? [Y/n]
```

30. **Install dependencies** (if user confirms):

Detect package manager and run appropriate install:
```bash
# Node.js (npm/yarn/pnpm)
npm install --save-dev {all_packages}

# Python (pip/poetry)
pip install {packages} --dev
# or
poetry add --group dev {packages}

# Go
go get -t {packages}

# Java (Maven/Gradle)
# Add to pom.xml or build.gradle
```

31. **Create configuration files** (only for new tools):

For each tool, create the appropriate config file:

*Mutation Testing Config (example for Stryker):*
```javascript
// stryker.conf.js (auto-generated by iSDLC discover)
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
module.exports = {
  packageManager: 'npm',
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'jest', // or detected test runner
  coverageAnalysis: 'perTest',
  thresholds: {
    high: 80,
    low: 60,
    break: 50
  },
  mutate: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ]
};
```

*Adversarial Testing Setup (example for fast-check):*
```typescript
// tests/property/setup.ts (auto-generated by iSDLC discover)
import fc from 'fast-check';

// Configure fast-check defaults for this project
fc.configureGlobal({
  numRuns: 100,
  verbose: true,
  endOnFailure: true
});

export { fc };
```

*Integration Test Base (example for Supertest):*
```typescript
// tests/integration/base.ts (auto-generated by iSDLC discover)
import request from 'supertest';

/**
 * Integration Test Configuration
 * Article XI: Integration Testing Integrity
 *
 * RULES ENFORCED:
 * 1. Real URLs only - no stubs/mocks
 * 2. No assertions - verify through execution
 * 3. Use actual test environment endpoints
 */

// Base URL from environment (MUST be real endpoint)
const BASE_URL = process.env.TEST_API_URL;

if (!BASE_URL) {
  throw new Error(
    'TEST_API_URL environment variable is required. ' +
    'Integration tests MUST use real URLs per Article XI.'
  );
}

export const api = request(BASE_URL);

// Validation helper (not assertion)
export function validateResponse(response: any, schema: any): boolean {
  // Schema validation instead of assertions
  return schema.safeParse(response).success;
}
```

32. **Create test directory structure** (merge with existing):

```
tests/
├── unit/                    # Unit tests (mocks allowed)
├── integration/             # Integration tests (NO mocks)
│   ├── base.ts             # Base configuration
│   └── api/                # API integration tests
├── property/               # Property-based/adversarial tests
│   ├── setup.ts           # fast-check configuration
│   └── generators/        # Custom data generators
├── mutation/               # Mutation test configuration
│   └── stryker.conf.js    # Stryker config
└── reports/               # Test execution reports
```

33. **Update package.json/pyproject.toml with test scripts** (add missing only):

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=tests/unit",
    "test:integration": "jest --testPathPattern=tests/integration",
    "test:property": "jest --testPathPattern=tests/property",
    "test:mutation": "stryker run",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:property",
    "test:report": "jest --coverage --coverageReporters=html"
  }
}
```

34. **Generate testing infrastructure report**:

Create `.isdlc/testing-infrastructure-report.md`:
```markdown
# Testing Infrastructure Report

**Generated**: {DATE}
**Tech Stack**: {language}, {framework}

## Installed Tools

### Mutation Testing
- **Tool**: Stryker Mutator
- **Config**: stryker.conf.js
- **Threshold**: 80% mutation score
- **Command**: `npm run test:mutation`

### Adversarial Testing
- **Tool**: fast-check
- **Config**: tests/property/setup.ts
- **Generators**: tests/property/generators/
- **Command**: `npm run test:property`

### Integration Testing
- **Framework**: Supertest
- **Base**: tests/integration/base.ts
- **Rules Enforced**:
  - ✓ Real URLs only (TEST_API_URL required)
  - ✓ No mocks/stubs in integration tests
  - ✓ Schema validation instead of assertions

### Test Reporting
- **Tool**: jest-html-reporter
- **Output**: tests/reports/
- **Command**: `npm run test:report`

## Directory Structure
[tree output]

## Article XI Compliance
- [x] Mutation testing configured
- [x] Adversarial testing configured
- [x] Real URL enforcement in integration tests
- [x] Execution-based reporting configured
```

35. **Update state.json with testing infrastructure status**:

```json
{
  "testing_infrastructure": {
    "configured_at": "2026-01-22T...",
    "tools": {
      "mutation": {
        "name": "stryker",
        "package": "@stryker-mutator/core",
        "config": "stryker.conf.js",
        "threshold": 80
      },
      "adversarial": {
        "name": "fast-check",
        "package": "fast-check",
        "config": "tests/property/setup.ts"
      },
      "integration": {
        "name": "supertest",
        "package": "supertest",
        "base_url_env": "TEST_API_URL",
        "no_stubs_enforced": true
      }
    },
    "directories_created": [
      "tests/unit",
      "tests/integration",
      "tests/property",
      "tests/mutation",
      "tests/reports"
    ],
    "scripts_added": [
      "test:mutation",
      "test:property",
      "test:integration",
      "test:report"
    ]
  }
}
```

*Phase 4 Complete Announcement:*
```
════════════════════════════════════════════════════════════════
  PHASE 4 COMPLETE: Testing Infrastructure Setup
════════════════════════════════════════════════════════════════

  Installed:
    ✓ Mutation Testing: Stryker Mutator (80% threshold)
    ✓ Adversarial Testing: fast-check + @faker-js/faker
    ✓ Integration Testing: Supertest (real URLs enforced)
    ✓ Test Reporting: jest-html-reporter

  Created:
    ✓ tests/integration/base.ts (no-stub enforcement)
    ✓ tests/property/setup.ts (fast-check config)
    ✓ stryker.conf.js (mutation config)

  Scripts Added:
    ✓ npm run test:mutation
    ✓ npm run test:property
    ✓ npm run test:integration
    ✓ npm run test:report

  Report: .isdlc/testing-infrastructure-report.md

  Article XI Compliance: CONFIGURED ✓
════════════════════════════════════════════════════════════════

Run 'npm run test:mutation' to verify mutation testing setup.
```

**Language-Agnostic Research Queries:**

The research agents use these query patterns (no hardcoded tool names):

| Category | Query Pattern |
|----------|---------------|
| Mutation | "{language} mutation testing framework {YEAR} best" |
| Property | "{language} property based testing generative {YEAR}" |
| Fuzz | "{language} fuzz testing security {YEAR}" |
| Integration | "{language} {framework} http integration test real server {YEAR}" |
| Reporting | "{language} test coverage execution report html {YEAR}" |

The agent extracts from search results:
1. Most recommended tool name
2. Package/dependency identifier
3. Installation command
4. Configuration format
5. Basic setup example

**Phase 5: Cloud Provider Configuration (OPTIONAL - Post-Testing)**

This phase is **triggered automatically** when GATE-06 (Integration Testing) passes, or can be run manually via `/sdlc configure-cloud` at any time.

**TRIGGER CONDITIONS:**
- Automatic: GATE-06 passes AND `cloud_configuration.provider === "undecided"`
- Manual: User runs `/sdlc configure-cloud`

36. **Prompt for cloud configuration** (after testing completes):
```
════════════════════════════════════════════════════════════════
  PHASE 5: Cloud Provider Configuration (Optional)
════════════════════════════════════════════════════════════════
  Testing Status: GATE-06 PASSED ✓
  Current Cloud Config: Not configured

  Your tests are passing! Ready to configure deployment?
════════════════════════════════════════════════════════════════

Where will this project be deployed?
[1] AWS
[2] GCP
[3] Azure
[4] Local only (no cloud deployment)
[5] Skip for now (can configure later with /sdlc configure-cloud)
```

37. **Collect provider-specific config** (if 1-3 selected):
    - AWS: Ask for profile name and region
    - GCP: Ask for project ID and region
    - Azure: Ask for subscription ID, resource group, and region

38. **Update state.json** with cloud_configuration:
    - If provider selected (AWS/GCP/Azure):
      - Set `cloud_configuration.provider` to selected provider
      - Set `cloud_configuration.configured_at` to timestamp
      - Set `staging_enabled: true`
      - Set `production_enabled: true`
      - Set `workflow_endpoint: "13-operations"`
    - If "Local only" (4):
      - Set `provider: "none"`
      - Set `staging_enabled: false`
      - Set `production_enabled: false`
      - Set `workflow_endpoint: "10-local-testing"`
    - If "Skip for now" (5):
      - Keep `provider: "undecided"`
      - Set `workflow_endpoint: "10-local-testing"`
      - Inform: "Workflow will complete after local testing. Run /sdlc configure-cloud later to enable deployment."

*Phase 5 Complete Announcement:*
```
════════════════════════════════════════════════════════════════
  PHASE 5 COMPLETE: Cloud Configuration
════════════════════════════════════════════════════════════════

  Provider: AWS
  Region: us-east-1
  Profile: default

  Deployment Enabled:
    ✓ Staging (Phase 11)
    ✓ Production (Phase 12)

  Workflow Endpoint: Phase 13 (Operations)
════════════════════════════════════════════════════════════════

Ready to start the SDLC workflow? Run /sdlc start
```

**Final State Update:**

After all phases complete, update `state.json`:
- Set `project.is_new_project: false` (discovery complete, no longer needs setup flow)
- Set `project.tech_stack` with discovered values (language, framework, database)
- Set `project.discovered_at` to current timestamp

**DISCOVER COMPLETE - Summary:**

After all phases complete, display final summary:
```
════════════════════════════════════════════════════════════════
  /sdlc discover COMPLETE
════════════════════════════════════════════════════════════════

  Phase 1: Architecture Discovery ✓
    → docs/architecture/architecture-overview.md

  Phase 1b: Test Automation Evaluation ✓
    → Existing: Jest, Istanbul, 47 unit tests, 12 integration tests
    → Coverage: 67% (target: 80%)
    → Gaps: E2E, mutation testing, property-based testing
    → .isdlc/test-evaluation-report.md

  Phase 2: Constitution Generation ✓
    → .isdlc/constitution.md

  Phase 3: Tech-Stack Skill Customization ✓
    → Skills installed from skills.sh
    → .isdlc/skill-customization-report.md

  Phase 4: Testing Infrastructure Setup ✓
    → Preserved: Jest, Istanbul (existing)
    → Added: Stryker, fast-check, Playwright (gaps filled)
    → .isdlc/testing-infrastructure-report.md

  Phase 5: Cloud Configuration ✓ (or "Skipped")
    → Cloud provider: {provider or "undecided"}
    → Workflow endpoint: Phase {10 or 13}

════════════════════════════════════════════════════════════════

  Next Steps:
    1. Review test evaluation: cat .isdlc/test-evaluation-report.md
    2. Review constitution: cat .isdlc/constitution.md
    3. Run tests: npm run test:all
    4. Start workflow: /sdlc start "Your project description"

════════════════════════════════════════════════════════════════
```

**configure-cloud** - Configure or reconfigure cloud provider for deployment
```
/sdlc configure-cloud
```
Use this command to configure cloud deployment settings at any time, especially:
- After selecting "Not decided yet" during discover
- When workflow is paused at Phase 10
- To change cloud provider settings

**Procedure:**
1. Present cloud provider selection:
   ```
   Configure Cloud Provider for Deployment

   Current setting: [current provider or "undecided"]

   Where will this project be deployed?
   [1] AWS
   [2] GCP
   [3] Azure
   [4] Local only (no cloud deployment)
   ```

2. If cloud provider selected (1-3):
   - **AWS**: Collect profile and region
     ```
     AWS Configuration:
     > Profile name (from ~/.aws/credentials): [default]
     > Region: [us-east-1]
     ```
   - **GCP**: Collect project ID and region
     ```
     GCP Configuration:
     > Project ID: [my-project-123]
     > Region: [us-central1]
     ```
   - **Azure**: Collect subscription, resource group, region
     ```
     Azure Configuration:
     > Subscription ID: [...]
     > Resource Group: [...]
     > Region: [eastus]
     ```

3. Optionally validate credentials:
   ```
   Validate cloud credentials? [Y/n]
   ```
   - If yes: Run validation command for the provider
   - Report success/failure

4. Update `state.json`:
   - Set `cloud_configuration.provider`
   - Set provider-specific config (aws/gcp/azure)
   - Set `cloud_configuration.configured_at` to current timestamp
   - Set `cloud_configuration.credentials_validated`
   - Recalculate deployment flags:
     - `staging_enabled: true` if cloud provider
     - `production_enabled: true` if cloud provider
     - `workflow_endpoint: "13-operations"` if cloud provider
     - `workflow_endpoint: "10-local-testing"` if none

5. If workflow was paused at Phase 10 with provider "undecided":
   ```
   Cloud provider configured. Workflow can now continue.

   Current status: Phase 10 complete, GATE-10 passed
   Next action: Advance to Phase 11 (Staging Deployment)

   Continue workflow? [Y/n]
   ```
   - If yes: Advance to Phase 11
   - If no: Inform user to run `/sdlc advance` when ready

### Adaptive Workflow

The orchestrator dynamically determines required phases based on task complexity:

| Task Type | Typical Phases | When |
|-----------|----------------|------|
| Bug fixes, config changes | 01, 05, 06 | Simple, no architecture impact |
| Features, API endpoints | 01-07, 09 | Multiple components, integration needed |
| Platforms, compliance | All 13 | Complex architecture, regulatory requirements |

### Examples

```
/sdlc start "Build a REST API for user authentication"
/sdlc status
/sdlc gate-check
/sdlc advance
/sdlc delegate software-developer "Implement the login endpoint"
/sdlc constitution
/sdlc discover
/sdlc configure-cloud
/sdlc escalate "Unclear requirement about session timeout"
```

### Prerequisites

1. **Project Constitution**: A valid `.isdlc/constitution.md` is required before starting any workflow
2. **Framework Installation**: The iSDLC framework must be installed (run `init-project.sh`)

### Implementation

When this command is invoked:

**If NO action argument provided (`/sdlc` alone):**
1. Use the Task tool to launch the `sdlc-orchestrator` agent
2. Pass explicit instruction: "No action specified. Present the interactive context-aware menu based on constitution status, workflow status, and existing project detection."
3. The orchestrator MUST present the appropriate scenario menu (1-4) based on detection logic
4. Wait for user selection before taking further action

**If action argument provided (`/sdlc <action>`):**
1. Use the Task tool to launch the `sdlc-orchestrator` agent
2. Pass the action and any arguments to the agent
3. The orchestrator will coordinate the appropriate workflow

```
/sdlc (no args) → Task tool → sdlc-orchestrator → Interactive Menu → User Selection → Action
/sdlc <action>  → Task tool → sdlc-orchestrator → Execute Action → Phase agents (01-13)
```
