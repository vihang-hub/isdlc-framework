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

**Phase 3: Cloud Provider Configuration**

13. **Ask deployment target**: Present cloud provider options
    ```
    Where will this project be deployed?
    [1] AWS
    [2] GCP
    [3] Azure
    [4] Local only (no cloud deployment)
    [5] Not decided yet
    ```

14. **Collect provider-specific config** (if 1-3 selected):
    - AWS: Ask for profile name and region
    - GCP: Ask for project ID and region
    - Azure: Ask for subscription ID, resource group, and region

15. **Update state.json** with cloud_configuration:
    - If provider selected (AWS/GCP/Azure):
      - Set `staging_enabled: true`
      - Set `production_enabled: true`
      - Set `workflow_endpoint: "13-operations"`
    - If "Local only" (4):
      - Set `provider: "none"`
      - Set `staging_enabled: false`
      - Set `production_enabled: false`
      - Set `workflow_endpoint: "10-local-testing"`
    - If "Not decided yet" (5):
      - Set `provider: "undecided"`
      - Set `workflow_endpoint: "10-local-testing"`
      - Inform: "Workflow will complete after local testing. Run /sdlc configure-cloud later to enable deployment."

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

**Phase 4: Tech-Stack Skill Customization (PARALLEL RESEARCH)**

After constitution creation and cloud configuration, enhance relevant skills with current best practices for the detected tech stack.

**CRITICAL: Use parallel research to minimize wait time.**

16. **Group technologies and launch parallel research agents**:

For each detected technology, launch a research agent. Launch ALL agents IN PARALLEL using a single message with multiple Task tool calls (max 5-6 concurrent for optimal performance).

```
┌──────────────────────────────────────────────────────────────┐
│  PHASE 4: Tech-Stack Skill Customization                     │
├──────────────────────────────────────────────────────────────┤
│  Detected: Node.js, TypeScript, React, Express, PostgreSQL   │
│  Launching: 5 parallel research agents                       │
└──────────────────────────────────────────────────────────────┘

  ◐ Agent 1: Node.js best practices 2026...
  ◐ Agent 2: TypeScript best practices 2026...
  ◐ Agent 3: React best practices 2026...
  ◐ Agent 4: Express.js best practices 2026...
  ◐ Agent 5: PostgreSQL best practices 2026...
```

Each research agent (using Task tool with subagent_type=Explore or haiku model):
- Performs 2-3 focused WebSearches for that specific technology
- Extracts actionable guidance (security, testing, performance)
- Returns structured recommendations

**Batching Strategy** (if >6 technologies detected):
- Batch 1: First 5-6 technologies (parallel)
- Wait for completion
- Batch 2: Next 5-6 technologies (parallel)
- Continue until all researched

17. **Collect results and update skills**:
Once all agents complete, sequentially update each skill file:
- Read the skill's current content
- Append researched guidance to "Project-Specific Considerations"
- Use dated headers: `### {Technology} (Auto-researched {DATE})`

18. **Generate customization report**: Create `.isdlc/skill-customization-report.md`

19. **User confirmation**: Display summary of skills updated

**Two-Tier Skill Mapping Strategy:**

*Tier 1: Static Mapping (Known Tech Stacks)*

Use `.claude/config/tech-stack-skill-mapping.yaml` for common technologies. This maps known technologies to their relevant skills and research queries.

*Tier 2: Dynamic Discovery (Unknown Tech Stacks)*

For technologies NOT in the static mapping:

1. **Classify the technology** by type:
   - Language/Runtime → affects: code-implementation, unit-testing
   - Frontend Framework → affects: frontend-development, ui-ux, state-management
   - Backend Framework → affects: api-implementation, authentication, error-handling
   - Database/ORM → affects: database-integration, migration-writing
   - DevOps Tool → affects: cicd-pipeline, containerization, deployment-strategy
   - Testing Tool → affects: test-strategy, test-case-design, coverage-analysis

2. **Research and determine relevant skills** dynamically:
   ```
   WebSearch: "{technology} SDLC best practices categories"
   WebSearch: "{technology} development workflow phases"

   From results, identify which skill categories apply:
   - Does it affect how code is written? → code-implementation
   - Does it have security implications? → security-configuration
   - Does it change testing approach? → test-strategy
   - Does it affect deployment? → deployment-strategy
   ```

3. **Update determined skills** with researched guidance

**Technology Type to Skill Category Mapping:**

| Tech Type | Default Skills to Update |
|-----------|-------------------------|
| Language/Runtime | code-implementation, unit-testing, cicd-pipeline |
| Frontend Framework | frontend-development, ui-ux, state-management, test-case-design |
| Backend Framework | api-implementation, authentication, error-handling, security-configuration |
| Database/ORM | database-integration, migration-writing, performance-optimization |
| DevOps/Infra | cicd-pipeline, containerization, deployment-strategy, infrastructure-as-code |
| Testing Tool | test-strategy, test-case-design, coverage-analysis |
| Security Tool | security-configuration, dependency-auditing, code-security-review |
| Monitoring/Observability | monitoring-setup, log-management, alerting-management |

**Skill Update Format:**

Append to existing "Project-Specific Considerations" section:

```markdown
## Project-Specific Considerations
- TypeScript strict mode      ← Existing content preserved
- NestJS/React patterns

### Node.js 20.x (Auto-researched 2025-01-19)
- Use native fetch API instead of axios
- Enable structured logging with pino
- Run npm audit in CI with --audit-level=high

### Express.js (Auto-researched 2025-01-19)
- Use helmet.js for security headers
- Implement rate limiting with express-rate-limit
- Validate inputs with zod at route level
```

**Explicit Step Announcements:**

Every action must be announced before execution:

*Phase Start Announcement:*
```
════════════════════════════════════════════════════════════════
  PHASE 4: Tech-Stack Skill Customization
════════════════════════════════════════════════════════════════
  Detected: Node.js, TypeScript, React 18, Express.js, PostgreSQL
  Skills to customize: 8 (estimated)
════════════════════════════════════════════════════════════════
```

*Step 1: Technology Classification*
```
┌──────────────────────────────────────────────────────────────┐
│  STEP 1: Classifying Technologies                            │
├──────────────────────────────────────────────────────────────┤
│  Technology:  Node.js                                        │
│  Type:        Language/Runtime                               │
│  Mapping:     Static (from config)                           │
│  Skills:      code-implementation, unit-testing, cicd-pipeline│
└──────────────────────────────────────────────────────────────┘
```

*Step 2: Web Research (per technology)*
```
┌──────────────────────────────────────────────────────────────┐
│  STEP 2: Researching Best Practices                          │
├──────────────────────────────────────────────────────────────┤
│  Technology:  Node.js                                        │
│  Query:       "Node.js best practices 2025"                  │
│  Focus:       Security, Testing, Performance                 │
└──────────────────────────────────────────────────────────────┘

  → Searching: "Node.js best practices 2025"
  → Searching: "Node.js security vulnerabilities 2025"
  → Extracting actionable guidance...
```

*Step 3: Skill Update (per skill)*
```
┌──────────────────────────────────────────────────────────────┐
│  STEP 3: Updating Skill                                      │
├──────────────────────────────────────────────────────────────┤
│  Skill:       code-implementation (DEV-001)                  │
│  Path:        .claude/skills/development/code-implementation │
│  Section:     Project-Specific Considerations                │
│  Adding:      Node.js 20.x guidance (5 recommendations)      │
└──────────────────────────────────────────────────────────────┘
```

*For Unknown Technologies (Tier 2 Dynamic):*
```
┌──────────────────────────────────────────────────────────────┐
│  STEP 1: Classifying Unknown Technology                      │
├──────────────────────────────────────────────────────────────┤
│  Technology:  Bun.js                                         │
│  Status:      NOT in static mapping                          │
│  Action:      Dynamic classification via research            │
└──────────────────────────────────────────────────────────────┘

  → Searching: "What is Bun.js used for"
  → Result: JavaScript runtime (alternative to Node.js)
  → Classification: Language/Runtime
  → Default skills: code-implementation, unit-testing, cicd-pipeline

┌──────────────────────────────────────────────────────────────┐
│  STEP 1b: Identifying Additional Skills                      │
├──────────────────────────────────────────────────────────────┤
│  Technology:  Bun.js                                         │
│  Query:       "Bun.js development workflow best practices"   │
│  Finding:     Performance-critical → adding performance-opt  │
└──────────────────────────────────────────────────────────────┘
```

*Step 4: Generate Report*
```
┌──────────────────────────────────────────────────────────────┐
│  STEP 4: Generating Customization Report                     │
├──────────────────────────────────────────────────────────────┤
│  Output:      .isdlc/skill-customization-report.md           │
│  Skills:      8 customized                                   │
│  Techs:       5 researched                                   │
└──────────────────────────────────────────────────────────────┘
```

*Phase Complete Summary:*
```
════════════════════════════════════════════════════════════════
  PHASE 4 COMPLETE
════════════════════════════════════════════════════════════════
  Technologies researched: 5
    ✓ Node.js (static mapping)
    ✓ TypeScript (static mapping)
    ✓ React 18 (static mapping)
    ✓ Express.js (static mapping)
    ✓ PostgreSQL (static mapping)

  Skills customized: 8
    ✓ development/code-implementation
    ✓ development/frontend-development
    ✓ development/api-implementation
    ✓ development/database-integration
    ✓ development/unit-testing
    ✓ security/security-configuration
    ✓ testing/test-case-design
    ✓ devops/cicd-pipeline

  Report: .isdlc/skill-customization-report.md
════════════════════════════════════════════════════════════════

View full customization report? [Y/n]
```

**Idempotency:**

- Track last customization in `.isdlc/state.json` under `skill_customization`
- If re-running within 7 days, prompt user:
  - [1] Skip (keep existing)
  - [2] Re-research all
  - [3] Research only new technologies
- Use dated section headers to identify auto-generated content

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
