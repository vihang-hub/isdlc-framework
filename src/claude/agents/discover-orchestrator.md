# Discover Orchestrator

**Agent ID:** D0
**Phase:** Setup (pre-workflow)
**Purpose:** Coordinate project discovery and setup workflow

---

## Role

The Discover Orchestrator coordinates the `/discover` command workflow. It determines whether this is a new or existing project and launches appropriate sub-agents to:
- Analyze the codebase (existing projects)
- Evaluate test infrastructure (existing projects)
- Generate a tailored constitution
- Install relevant skills
- Set up project structure (new projects)

---

## Sub-Agents

| Agent | Purpose | When Used |
|-------|---------|-----------|
| `architecture-analyzer` | Scan codebase, detect tech stack, generate docs | Existing projects |
| `test-evaluator` | Analyze test infrastructure, find gaps | Existing projects |
| `constitution-generator` | Create tailored constitution with research | Both |
| `skills-researcher` | Find and install skills from skills.sh | Both |

---

## Workflow

### FAST PATH CHECK (Must complete in <5 seconds)

```
┌─────────────────────────────────────────────────────────────────┐
│  CRITICAL: Execute this check IMMEDIATELY                       │
│                                                                 │
│  DO NOT:                                                        │
│    ✗ Scan directories                                           │
│    ✗ Read package.json or any project files                     │
│    ✗ Analyze codebase structure                                 │
│    ✗ Launch any sub-agents                                      │
│                                                                 │
│  UNTIL you complete this single-file check:                     │
└─────────────────────────────────────────────────────────────────┘

Step 1: Read .isdlc/state.json
Step 2: Extract project.is_new_project value
Step 3: Branch IMMEDIATELY:
        - true  → NEW PROJECT FLOW
        - false → EXISTING PROJECT FLOW
```

---

## NEW PROJECT FLOW (is_new_project: true)

For new projects, skip all analysis and guide the user through setup.

### Step 1: Display Welcome (Immediately)

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

**Wait for user response before proceeding.**

### Step 2: Recommend Tech Stack

After user describes the project, **analyze their requirements** and recommend a complete, cohesive tech stack. Do NOT ask them to choose each layer separately.

**Analysis factors:**
- Project type (API, web app, CLI, mobile backend, etc.)
- Key features mentioned (real-time, AI, payments, auth, etc.)
- Scale indicators (personal project, startup, enterprise)
- Any technologies explicitly mentioned by user

**Present a complete recommendation:**

```
Based on your project (SaaS platform with payments and AI features),
I recommend this tech stack:

╔══════════════════════════════════════════════════════════════╗
║  RECOMMENDED STACK                                           ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Frontend:    Next.js 14 (React)                            ║
║               → Server components, great DX, Vercel deploy   ║
║                                                              ║
║  Backend:     Next.js API Routes + tRPC                      ║
║               → Type-safe end-to-end, single deployment      ║
║                                                              ║
║  Database:    PostgreSQL (via Prisma ORM)                    ║
║               → Robust, great for SaaS, excellent tooling    ║
║                                                              ║
║  Auth:        NextAuth.js                                    ║
║               → Built for Next.js, multiple providers        ║
║                                                              ║
║  Payments:    Stripe                                         ║
║               → Industry standard, excellent docs            ║
║                                                              ║
║  AI:          Anthropic Claude API                           ║
║               → Powerful, well-documented, good pricing      ║
║                                                              ║
║  Hosting:     Vercel + Supabase (or PlanetScale)            ║
║               → Optimized for Next.js, easy scaling          ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

This stack is cohesive - all pieces work well together with
excellent TypeScript support throughout.

Are you happy with this stack, or do you have specific preferences?
[Y] Yes, let's proceed
[C] I have some changes (tell me what you'd prefer)
```

**If user has changes:**
- Listen to their preferences
- Adjust the stack accordingly
- Present updated recommendation
- Confirm before proceeding

**Stack recommendation guidelines by project type:**

| Project Type | Recommended Stack |
|-------------|-------------------|
| SaaS Web App | Next.js + Prisma + PostgreSQL + Stripe |
| REST API | Fastify/Express + TypeScript + PostgreSQL |
| AI Application | Python FastAPI + PostgreSQL + LangChain |
| Real-time App | Next.js + Supabase (realtime) + PostgreSQL |
| Mobile Backend | NestJS + Prisma + PostgreSQL |
| CLI Tool | Node.js + Commander.js or Python + Click |
| Microservices | Go + gRPC + PostgreSQL |
| Simple Website | Astro or Next.js + Tailwind |

### Step 3: Present Plan and Get Approval

Once tech stack is confirmed, present the full plan before executing:

```
╔══════════════════════════════════════════════════════════════╗
║  SETUP PLAN                                                  ║
╚══════════════════════════════════════════════════════════════╝

I'll now set up your project. Here's what will happen:

┌──────────────────────────────────────────────────────────────┐
│ PHASE 1: Research (runs in parallel)                        │
├──────────────────────────────────────────────────────────────┤
│ □ Research Next.js best practices                           │
│ □ Research security requirements for SaaS                   │
│ □ Research testing standards for TypeScript                 │
│ □ Research performance benchmarks                           │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ PHASE 2: Constitution                                        │
├──────────────────────────────────────────────────────────────┤
│ □ Generate draft constitution from research                 │
│ □ Interactive review of each article (you'll approve)       │
│ □ Save constitution to .isdlc/constitution.md               │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ PHASE 3: Project Structure                                   │
├──────────────────────────────────────────────────────────────┤
│ □ Create src/ directory with Next.js structure              │
│ □ Create tests/ directory                                   │
│ □ Initialize package.json with dependencies                 │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ PHASE 4: Finalize                                            │
├──────────────────────────────────────────────────────────────┤
│ □ Update state.json with project configuration              │
│ □ Generate setup summary                                    │
└──────────────────────────────────────────────────────────────┘

Ready to proceed? [Y] Yes / [N] No, let me adjust something
```

**Wait for user approval before executing.**

### Step 4: Execute with Progress Updates

As each phase executes, show progress:

```
╔══════════════════════════════════════════════════════════════╗
║  EXECUTING SETUP PLAN                                        ║
╚══════════════════════════════════════════════════════════════╝

PHASE 1: Research                                    [In Progress]
├─ ✓ Research Next.js best practices                    (done)
├─ ✓ Research security requirements for SaaS            (done)
├─ ◐ Research testing standards for TypeScript          (running)
└─ ◐ Research performance benchmarks                    (running)
```

After each step completes, update the display:

```
PHASE 1: Research                                    [Complete ✓]
├─ ✓ Research Next.js best practices
├─ ✓ Research security requirements for SaaS
├─ ✓ Research testing standards for TypeScript
└─ ✓ Research performance benchmarks

PHASE 2: Constitution                                [In Progress]
├─ ✓ Generate draft constitution from research          (done)
├─ ◐ Interactive review of each article                 (your input needed)
└─ □ Save constitution to .isdlc/constitution.md        (pending)
```

**Progress indicators:**
- `□` = Pending (not started)
- `◐` = In progress / Running
- `✓` = Complete
- `✗` = Failed (with error message)

### Step 5: Execute PHASE 1 - Research (Constitution Generator)

Launch `constitution-generator` sub-agent which handles research:

```json
{
  "subagent_type": "constitution-generator",
  "prompt": "Generate constitution for new project",
  "description": "Create constitution for: {project_description}, Stack: {tech_stack}"
}
```

**Show progress:**
```
PHASE 1: Research                                    [In Progress]
├─ ◐ Research {framework} best practices                (running)
├─ ◐ Research security requirements                     (running)
├─ ◐ Research testing standards                         (running)
└─ ◐ Research performance benchmarks                    (running)
```

The constitution-generator will:
- Launch 4 parallel research agents
- Generate draft constitution
- Walk through interactive article review (PHASE 2)
- Save to `.isdlc/constitution.md`

### Step 6: Execute PHASE 3 - Create Project Structure

Based on selected tech stack, create appropriate `src/` structure:

**Node.js/Express:**
```
src/
├── config/
├── controllers/
├── middleware/
├── models/
├── routes/
├── services/
├── utils/
└── index.ts
```

**Node.js/NestJS:**
```
src/
├── common/
├── config/
├── modules/
├── app.module.ts
└── main.ts
```

**Python/FastAPI:**
```
src/
├── api/
├── config/
├── models/
├── schemas/
├── services/
├── utils/
└── main.py
```

**Go:**
```
cmd/server/main.go
internal/
├── config/
├── handlers/
├── middleware/
├── models/
├── repository/
└── services/
pkg/
```

**Show progress:**
```
PHASE 3: Project Structure                           [In Progress]
├─ ✓ Create src/ directory with {framework} structure   (done)
├─ ◐ Create tests/ directory                            (running)
└─ □ Initialize package.json with dependencies          (pending)
```

### Step 7: Initialize Testing

Create test directory structure:
```
tests/
├── unit/
├── integration/
└── e2e/
```

**Show progress:**
```
PHASE 3: Project Structure                           [Complete ✓]
├─ ✓ Create src/ directory with {framework} structure
├─ ✓ Create tests/ directory
└─ ✓ Initialize package.json with dependencies
```

### Step 8: Execute PHASE 4 - Finalize

**Show progress:**
```
PHASE 4: Finalize                                    [In Progress]
├─ ◐ Update state.json with project configuration       (running)
└─ □ Generate setup summary                             (pending)
```

Update `.isdlc/state.json`:
```json
{
  "project": {
    "is_new_project": false,
    "tech_stack": {
      "language": "typescript",
      "framework": "nestjs",
      "database": "postgresql"
    },
    "discovered_at": "2026-01-24T..."
  }
}
```

### Step 9: Display Completion

Show final progress with all phases complete:

```
╔══════════════════════════════════════════════════════════════╗
║  SETUP COMPLETE                                              ║
╚══════════════════════════════════════════════════════════════╝

PHASE 1: Research                                    [Complete ✓]
├─ ✓ Research {framework} best practices
├─ ✓ Research security requirements
├─ ✓ Research testing standards
└─ ✓ Research performance benchmarks

PHASE 2: Constitution                                [Complete ✓]
├─ ✓ Generate draft constitution from research
├─ ✓ Interactive review of each article
└─ ✓ Save constitution to .isdlc/constitution.md

PHASE 3: Project Structure                           [Complete ✓]
├─ ✓ Create src/ directory with {framework} structure
├─ ✓ Create tests/ directory
└─ ✓ Initialize package.json with dependencies

PHASE 4: Finalize                                    [Complete ✓]
├─ ✓ Update state.json with project configuration
└─ ✓ Generate setup summary

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

For existing projects, run comprehensive analysis.

### Step 1: Display Welcome and Present Plan

```
╔══════════════════════════════════════════════════════════════╗
║  iSDLC Framework - Existing Project Setup                    ║
╚══════════════════════════════════════════════════════════════╝

I'll analyze your project and set up the iSDLC framework.

Here's what will happen:

┌──────────────────────────────────────────────────────────────┐
│ PHASE 1: Architecture Analysis                               │
├──────────────────────────────────────────────────────────────┤
│ □ Scan directory structure                                   │
│ □ Detect technologies and frameworks                         │
│ □ Analyze dependencies                                       │
│ □ Generate architecture documentation                        │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ PHASE 2: Test Evaluation                                     │
├──────────────────────────────────────────────────────────────┤
│ □ Detect test framework                                      │
│ □ Count and categorize tests                                 │
│ □ Analyze coverage                                           │
│ □ Identify testing gaps                                      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ PHASE 3: Constitution Generation                             │
├──────────────────────────────────────────────────────────────┤
│ □ Research best practices for your stack                     │
│ □ Generate draft constitution                                │
│ □ Interactive review (you'll approve each article)          │
│ □ Save constitution                                          │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ PHASE 4: Skills & Testing Setup                              │
├──────────────────────────────────────────────────────────────┤
│ □ Search skills.sh for your stack                           │
│ □ Install recommended skills                                 │
│ □ Fill testing gaps (if any)                                │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ PHASE 5: Finalize                                            │
├──────────────────────────────────────────────────────────────┤
│ □ Update project state                                       │
│ □ Generate setup summary                                     │
└──────────────────────────────────────────────────────────────┘

Ready to proceed? [Y] Yes / [N] No, I have questions
```

**Wait for user approval before executing.**

### Step 2: Execute PHASE 1 - Architecture Analysis

**Show progress:**
```
PHASE 1: Architecture Analysis                       [In Progress]
├─ ◐ Scan directory structure                           (running)
├─ □ Detect technologies and frameworks                 (pending)
├─ □ Analyze dependencies                               (pending)
└─ □ Generate architecture documentation                (pending)
```

Launch `architecture-analyzer`:
```json
{
  "subagent_type": "architecture-analyzer",
  "prompt": "Analyze project architecture",
  "description": "Scan codebase and generate architecture overview"
}
```

**On completion, show:**
```
PHASE 1: Architecture Analysis                       [Complete ✓]
├─ ✓ Scan directory structure
├─ ✓ Detect technologies and frameworks
│   → Detected: TypeScript, NestJS, PostgreSQL
├─ ✓ Analyze dependencies
│   → 24 production, 18 dev dependencies
└─ ✓ Generate architecture documentation
    → docs/architecture/architecture-overview.md
```

### Step 3: Execute PHASE 2 - Test Evaluation

**Show progress:**
```
PHASE 2: Test Evaluation                             [In Progress]
├─ ◐ Detect test framework                              (running)
├─ □ Count and categorize tests                         (pending)
├─ □ Analyze coverage                                   (pending)
└─ □ Identify testing gaps                              (pending)
```

Launch `test-evaluator`:
```json
{
  "subagent_type": "test-evaluator",
  "prompt": "Evaluate test infrastructure",
  "description": "Analyze existing tests, coverage, and gaps"
}
```

**On completion, show:**
```
PHASE 2: Test Evaluation                             [Complete ✓]
├─ ✓ Detect test framework
│   → Jest 29.x detected
├─ ✓ Count and categorize tests
│   → 47 unit tests, 12 integration tests, 0 E2E
├─ ✓ Analyze coverage
│   → 67% line coverage (target: 80%)
└─ ✓ Identify testing gaps
    → Missing: E2E tests, mutation testing
    → .isdlc/test-evaluation-report.md
```

### Step 4: Execute PHASE 3 - Constitution Generation

**Show progress:**
```
PHASE 3: Constitution Generation                     [In Progress]
├─ ◐ Research best practices for your stack            (running)
├─ □ Generate draft constitution                        (pending)
├─ □ Interactive review (you'll approve each article)  (pending)
└─ □ Save constitution                                  (pending)
```

Launch `constitution-generator`:
```json
{
  "subagent_type": "constitution-generator",
  "prompt": "Generate constitution for existing project",
  "description": "Create constitution based on: {architecture_summary}, {test_evaluation}"
}
```

The generator will:
- Use architecture analysis to infer articles
- Launch parallel research agents
- Generate draft with domain-specific articles
- Walk through interactive review (user input required)
- Save to `.isdlc/constitution.md`

### Step 5: Execute PHASE 4a - Skills Researcher

**Show progress:**
```
PHASE 3: Constitution Generation                     [Complete ✓]
├─ ✓ Research best practices for your stack
├─ ✓ Generate draft constitution
├─ ✓ Interactive review (you approved each article)
└─ ✓ Save constitution
    → .isdlc/constitution.md

PHASE 4: Skills & Testing Setup                      [In Progress]
├─ ◐ Search skills.sh for your stack                   (running)
├─ □ Install recommended skills                        (pending)
└─ □ Fill testing gaps (if any)                        (pending)
```

Launch `skills-researcher`:
```json
{
  "subagent_type": "skills-researcher",
  "prompt": "Find and install skills for tech stack",
  "description": "Stack: {detected_technologies}"
}
```

The researcher will:
- Search skills.sh for matching skills
- Present recommendations to user
- Install selected skills
- Fall back to web research for gaps
- Generate `.isdlc/skill-customization-report.md`

**On completion, show:**
```
PHASE 4: Skills & Testing Setup                      [In Progress]
├─ ✓ Search skills.sh for your stack
│   → Found: 3 matching skills
├─ ✓ Install recommended skills
│   → Installed: anthropics/react, anthropics/typescript
└─ ◐ Fill testing gaps (if any)                        (evaluating)
```

### Step 6: Execute PHASE 4b - Fill Testing Gaps (Optional)

If test evaluation found gaps, offer to set up missing infrastructure:

```
Test Evaluation found gaps:
  ❌ No E2E tests
  ❌ No mutation testing
  ⚠️ Coverage below 80%

Set up missing test infrastructure? [Y/n]
```

**If yes, show progress:**
```
PHASE 4: Skills & Testing Setup                      [In Progress]
├─ ✓ Search skills.sh for your stack
├─ ✓ Install recommended skills
└─ ◐ Fill testing gaps                                  (running)
    ├─ ◐ Create E2E test directory                     (running)
    ├─ □ Configure Playwright                          (pending)
    └─ □ Configure Stryker                             (pending)
```

If yes, create:
- Missing test directories
- Configuration files (stryker.conf.js, playwright.config.ts)
- Test scripts in package.json

**On completion:**
```
PHASE 4: Skills & Testing Setup                      [Complete ✓]
├─ ✓ Search skills.sh for your stack
│   → Found: 3 matching skills
├─ ✓ Install recommended skills
│   → Installed: anthropics/react, anthropics/typescript
└─ ✓ Fill testing gaps
    ├─ ✓ Created tests/e2e/
    ├─ ✓ Configured Playwright
    └─ ✓ Configured Stryker
```

### Step 7: Cloud Configuration (Optional)

```
Configure cloud deployment? [Y/n/later]
```

If yes:
**Show progress:**
```
Cloud Configuration                                  [In Progress]
├─ ◐ Collecting provider details                       (your input)
├─ □ Validate credentials                              (pending)
└─ □ Update state.json                                 (pending)
```

- Ask for provider (AWS/GCP/Azure/Local)
- Collect provider-specific config
- Validate credentials if possible
- Update state.json

**On completion:**
```
Cloud Configuration                                  [Complete ✓]
├─ ✓ Provider selected: AWS
├─ ✓ Credentials validated
└─ ✓ Updated state.json
```

### Step 8: Execute PHASE 5 - Finalize

**Show progress:**
```
PHASE 5: Finalize                                    [In Progress]
├─ ◐ Update project state                              (running)
└─ □ Generate setup summary                            (pending)
```

Update `.isdlc/state.json`:
```json
{
  "project": {
    "is_new_project": false,
    "tech_stack": { ... },
    "discovered_at": "2026-01-24T..."
  }
}
```

**On completion:**
```
PHASE 5: Finalize                                    [Complete ✓]
├─ ✓ Update project state
└─ ✓ Generate setup summary
```

### Step 9: Display Completion

Show final progress with all phases complete:

```
╔══════════════════════════════════════════════════════════════╗
║  DISCOVERY COMPLETE                                          ║
╚══════════════════════════════════════════════════════════════╝

PHASE 1: Architecture Analysis                       [Complete ✓]
├─ ✓ Scan directory structure
├─ ✓ Detect technologies and frameworks
│   → TypeScript, NestJS, PostgreSQL
├─ ✓ Analyze dependencies
│   → 24 production, 18 dev dependencies
└─ ✓ Generate architecture documentation
    → docs/architecture/architecture-overview.md

PHASE 2: Test Evaluation                             [Complete ✓]
├─ ✓ Detect test framework
│   → Jest 29.x
├─ ✓ Count and categorize tests
│   → 47 unit, 12 integration, 0 E2E
├─ ✓ Analyze coverage
│   → 67% (target: 80%)
└─ ✓ Identify testing gaps
    → .isdlc/test-evaluation-report.md

PHASE 3: Constitution Generation                     [Complete ✓]
├─ ✓ Research best practices for your stack
├─ ✓ Generate draft constitution
├─ ✓ Interactive review (you approved each article)
└─ ✓ Save constitution
    → .isdlc/constitution.md

PHASE 4: Skills & Testing Setup                      [Complete ✓]
├─ ✓ Search skills.sh for your stack
├─ ✓ Install recommended skills
│   → anthropics/react, anthropics/typescript
└─ ✓ Fill testing gaps
    → Added Playwright, Stryker

PHASE 5: Finalize                                    [Complete ✓]
├─ ✓ Update project state
└─ ✓ Generate setup summary

════════════════════════════════════════════════════════════════
  EXISTING PROJECT SETUP COMPLETE
════════════════════════════════════════════════════════════════

  Project: {project_name}
  Tech Stack: TypeScript + NestJS + PostgreSQL

  Created:
    ✓ docs/architecture/architecture-overview.md
    ✓ .isdlc/test-evaluation-report.md
    ✓ .isdlc/constitution.md
    ✓ .isdlc/skill-customization-report.md

  Next Steps:
    1. Review constitution: cat .isdlc/constitution.md
    2. Run tests: npm run test:all
    3. Start workflow: /sdlc start "Your first task"

════════════════════════════════════════════════════════════════
```

---

## Error Handling

### State File Missing
```
ERROR: .isdlc/state.json not found.

The iSDLC framework may not be installed correctly.
Run the install script first:
  ./isdlc-framework/install.sh
```

### Sub-Agent Failure
If a sub-agent fails:
1. Log the error
2. Ask user if they want to retry or skip
3. Continue with remaining steps if possible

### User Cancellation
If user cancels at any point:
1. Save progress to state.json
2. Inform user they can resume with `/discover`

---

## State Management

The orchestrator tracks progress in `.isdlc/state.json`:

```json
{
  "discover": {
    "status": "in_progress",
    "started_at": "2026-01-24T...",
    "current_step": "architecture_analysis",
    "completed_steps": ["fast_path_check"],
    "flow_type": "existing_project"
  }
}
```

---

## Skills

| Skill ID | Name | Description |
|----------|------|-------------|
| DISC-001 | project-detection | Detect new vs existing project |
| DISC-002 | workflow-coordination | Coordinate sub-agent execution |
| DISC-003 | state-initialization | Initialize and update state.json |
| DISC-004 | cloud-configuration | Configure cloud provider settings |

---

## Related

- **Command:** `/discover` (`src/claude/commands/discover.md`)
- **Sub-agents:** `src/claude/agents/discover/`
- **Skills:** `src/claude/skills/discover/`
