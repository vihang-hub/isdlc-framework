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
3. Check if this is an existing project with source code

**Existing Project Detection:**
An existing project is detected if ANY of these are found:
- `src/` or `lib/` or `app/` directory exists
- `package.json` exists (Node.js project)
- `requirements.txt` or `pyproject.toml` exists (Python project)
- `go.mod` exists (Go project)
- `Cargo.toml` exists (Rust project)
- `pom.xml` or `build.gradle` exists (Java project)
- More than 5 source code files (`*.py`, `*.js`, `*.ts`, `*.go`, `*.rs`, `*.java`)

---

**SCENARIO 1: Constitution NOT configured + NEW project (no existing code)**

```
╔══════════════════════════════════════════════════════════════╗
║  iSDLC Framework - Setup                                     ║
╚══════════════════════════════════════════════════════════════╝

Constitution Status: Not configured
Project Type: New project

Select an option:

[1] Create Constitution Interactively (Recommended)
    Answer guided questions to generate a tailored constitution

[2] Edit constitution.md Manually
    Open .isdlc/constitution.md and customize the template yourself

Enter selection (1-2):
```

---

**SCENARIO 2: Constitution NOT configured + EXISTING project (code detected)**

```
╔══════════════════════════════════════════════════════════════╗
║  iSDLC Framework - Setup                                     ║
╚══════════════════════════════════════════════════════════════╝

Constitution Status: Not configured
Project Type: Existing codebase detected (Node.js, TypeScript)

Select an option:

[1] Run /sdlc discover (Recommended)
    Analyze existing codebase and auto-generate constitution

[2] Create Constitution Interactively
    Answer guided questions to generate a tailored constitution

[3] Edit constitution.md Manually
    Open .isdlc/constitution.md and customize the template yourself

Enter selection (1-3):
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
| 1 (New, no constitution) | [1] | Execute `/sdlc constitution` |
| 1 (New, no constitution) | [2] | Display path to constitution.md and exit |
| 2 (Existing, no constitution) | [1] | Execute `/sdlc discover` |
| 2 (Existing, no constitution) | [2] | Execute `/sdlc constitution` |
| 2 (Existing, no constitution) | [3] | Display path to constitution.md and exit |
| 3 (Constitution ready) | [1] | Execute `/sdlc start` (prompt for project name) |
| 3 (Constitution ready) | [2] | Display constitution contents |
| 3 (Constitution ready) | [3] | Execute `/sdlc constitution` |
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

**discover** - Analyze existing project and create tailored constitution
```
/sdlc discover
```
This command analyzes an existing codebase and interactively creates a constitution.

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

**Phase 2: Constitution Generation**
Based on discovered architecture, generate a tailored constitution:

9. **Infer domain-specific articles** from discovered stack:
   - Payment libraries (Stripe, PayPal) → Suggest PCI-DSS article
   - Auth libraries (Auth0, Passport) → Suggest authentication article
   - Database ORMs → Suggest data integrity article
   - Docker/K8s configs → Suggest deployment article
   - Frontend frameworks → Suggest accessibility/performance articles

10. **Identify gaps** that can't be inferred from code:
    - Non-functional requirements (NFRs) like performance SLAs
    - Compliance requirements (HIPAA, GDPR)
    - Business-specific constraints
    - Team conventions

11. **Interactive article walkthrough**:
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

12. **Save constitution**: Write final constitution to `.isdlc/constitution.md`

13. **Initialize state.json** with default cloud configuration:
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

14. **Search skills.sh for each detected technology**:

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

15. **Present skill recommendations to user**:

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

16. **Install selected skills**:

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

17. **Fallback: Web research for unmatched technologies**:

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

18. **Generate customization report**: Create `.isdlc/skill-customization-report.md`

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

19. **User confirmation**: Display summary

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

**Phase 4: Testing Infrastructure Setup (DYNAMIC TOOLING)**

After skill customization, set up the testing infrastructure based on Article XI (Integration Testing Integrity) requirements. This phase is FULLY DYNAMIC - no hardcoded tool mappings.

**CRITICAL: All tooling decisions are made via web research based on detected tech stack.**

20. **Announce Phase 4**:
```
════════════════════════════════════════════════════════════════
  PHASE 4: Testing Infrastructure Setup
════════════════════════════════════════════════════════════════
  Detected Stack: {primary_language}, {framework}
  Setting up: Mutation Testing, Adversarial Testing, Integration Testing
  Method: Dynamic research (no hardcoded mappings)
════════════════════════════════════════════════════════════════
```

21. **Research testing tools in parallel** (launch 4 agents simultaneously):

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

22. **Present tool recommendations to user**:
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

23. **Install dependencies** (if user confirms):

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

24. **Create configuration files**:

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

25. **Create test directory structure**:

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

26. **Update package.json/pyproject.toml with test scripts**:

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

27. **Generate testing infrastructure report**:

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

28. **Update state.json with testing infrastructure status**:

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

29. **Prompt for cloud configuration** (after testing completes):
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

30. **Collect provider-specific config** (if 1-3 selected):
    - AWS: Ask for profile name and region
    - GCP: Ask for project ID and region
    - Azure: Ask for subscription ID, resource group, and region

31. **Update state.json** with cloud_configuration:
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

**DISCOVER COMPLETE - Summary:**

After all phases complete, display final summary:
```
════════════════════════════════════════════════════════════════
  /sdlc discover COMPLETE
════════════════════════════════════════════════════════════════

  Phase 1: Architecture Discovery ✓
    → docs/architecture/architecture-overview.md

  Phase 2: Constitution Generation ✓
    → .isdlc/constitution.md

  Phase 3: Tech-Stack Skill Customization ✓
    → Skills installed from skills.sh
    → .isdlc/skill-customization-report.md

  Phase 4: Testing Infrastructure Setup ✓
    → Mutation, adversarial, integration testing configured
    → .isdlc/testing-infrastructure-report.md

  Phase 5: Cloud Configuration ✓ (or "Skipped")
    → Cloud provider: {provider or "undecided"}
    → Workflow endpoint: Phase {10 or 13}

════════════════════════════════════════════════════════════════

  Next Steps:
    1. Review constitution: cat .isdlc/constitution.md
    2. Run tests: npm run test:all
    3. Start workflow: /sdlc start "Your project description"

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
