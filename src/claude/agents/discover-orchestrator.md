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

### Step 3: Launch Constitution Generator

Use the Task tool to launch `constitution-generator` sub-agent:

```json
{
  "subagent_type": "constitution-generator",
  "prompt": "Generate constitution for new project",
  "description": "Create constitution for: {project_description}, Stack: {tech_stack}"
}
```

The constitution-generator will:
- Launch 4 parallel research agents
- Generate draft constitution
- Walk through interactive article review
- Save to `.isdlc/constitution.md`

### Step 4: Create Project Structure

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

### Step 5: Initialize Testing

Create test directory structure:
```
tests/
├── unit/
├── integration/
└── e2e/
```

### Step 6: Update State

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

### Step 7: Display Completion

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

For existing projects, run comprehensive analysis.

### Step 1: Display Welcome

```
╔══════════════════════════════════════════════════════════════╗
║  iSDLC Framework - Existing Project Setup                    ║
╚══════════════════════════════════════════════════════════════╝

I'll analyze your project and set up the iSDLC framework.

This will:
  1. Analyze your codebase architecture
  2. Evaluate existing test infrastructure
  3. Generate a tailored constitution
  4. Install relevant skills for your stack
  5. Fill any testing gaps

Starting analysis...
```

### Step 2: Launch Architecture Analyzer

Use the Task tool to launch `architecture-analyzer`:

```json
{
  "subagent_type": "architecture-analyzer",
  "prompt": "Analyze project architecture",
  "description": "Scan codebase and generate architecture overview"
}
```

**Wait for completion.** The analyzer returns:
- Detected technologies
- Framework identification
- Dependency analysis
- Directory structure map
- Generated `docs/architecture/architecture-overview.md`

### Step 3: Launch Test Evaluator

Use the Task tool to launch `test-evaluator`:

```json
{
  "subagent_type": "test-evaluator",
  "prompt": "Evaluate test infrastructure",
  "description": "Analyze existing tests, coverage, and gaps"
}
```

**Wait for completion.** The evaluator returns:
- Test types found (unit, integration, e2e)
- Coverage metrics
- Testing patterns detected
- Gaps identified
- Generated `.isdlc/test-evaluation-report.md`

### Step 4: Launch Constitution Generator

Use the Task tool to launch `constitution-generator`:

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
- Walk through interactive review
- Save to `.isdlc/constitution.md`

### Step 5: Launch Skills Researcher

Use the Task tool to launch `skills-researcher`:

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

### Step 6: Fill Testing Gaps (Optional)

If test evaluation found gaps, offer to set up missing infrastructure:

```
Test Evaluation found gaps:
  ❌ No E2E tests
  ❌ No mutation testing
  ⚠️ Coverage below 80%

Set up missing test infrastructure? [Y/n]
```

If yes, create:
- Missing test directories
- Configuration files (stryker.conf.js, playwright.config.ts)
- Test scripts in package.json

### Step 7: Cloud Configuration (Optional)

```
Configure cloud deployment? [Y/n/later]
```

If yes:
- Ask for provider (AWS/GCP/Azure/Local)
- Collect provider-specific config
- Update state.json

### Step 8: Update State

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

### Step 9: Display Completion

```
════════════════════════════════════════════════════════════════
  /discover COMPLETE
════════════════════════════════════════════════════════════════

  Phase 1: Architecture Discovery ✓
    → docs/architecture/architecture-overview.md

  Phase 2: Test Evaluation ✓
    → Existing: Jest, 47 unit tests, 67% coverage
    → Gaps: E2E, mutation testing
    → .isdlc/test-evaluation-report.md

  Phase 3: Constitution Generation ✓
    → .isdlc/constitution.md

  Phase 4: Skills Installation ✓
    → Installed: anthropics/react, anthropics/typescript
    → .isdlc/skill-customization-report.md

  Phase 5: Testing Infrastructure ✓
    → Added: Playwright, Stryker

════════════════════════════════════════════════════════════════

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
