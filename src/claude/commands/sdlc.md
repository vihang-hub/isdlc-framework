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

[1] Run /discover (Recommended)
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

[1] Run /discover (Recommended)
    Analyze codebase and auto-generate tailored constitution

[2] Edit constitution.md Manually
    Open .isdlc/constitution.md and customize the template yourself

Enter selection (1-2):
```

---

**SCENARIO 3: Constitution IS configured + No active workflow**

```
╔══════════════════════════════════════════════════════════════╗
║  iSDLC Framework - Ready                                     ║
╚══════════════════════════════════════════════════════════════╝

Constitution Status: Configured ✓
Workflow Status: No active workflow

What would you like to do?

[1] New Feature       — Implement a new feature end-to-end
[2] Fix               — Fix a bug or defect
[3] Run Tests         — Execute existing automation tests
[4] Generate Tests    — Create new tests for existing code
[5] Full Lifecycle    — Run complete SDLC (all 13 phases)
[6] View Status       — Check current project status

Enter selection (1-6):
```

---

**SCENARIO 4: Constitution IS configured + Workflow IN PROGRESS**

```
╔══════════════════════════════════════════════════════════════╗
║  iSDLC Framework - In Progress                               ║
╚══════════════════════════════════════════════════════════════╝

Constitution Status: Configured ✓
Active Workflow: feature (Phase 03 - Design, 3/7 complete)
Active Agent: System Designer (Agent 03)

Select an option:

[1] Continue     — Resume current workflow (Recommended)
[2] Gate Check   — Validate current phase gate
[3] View Status  — Check detailed progress
[4] Escalate     — Escalate a blocker to human
[5] Cancel       — Cancel current workflow

Enter selection (1-5):
```

---

**After Selection Mapping:**

| Scenario | Option | Action |
|----------|--------|--------|
| 1 (New, no constitution) | [1] | Execute `/discover` (runs NEW PROJECT FLOW) |
| 1 (New, no constitution) | [2] | Display path to constitution.md and exit |
| 2 (Existing, no constitution) | [1] | Execute `/discover` (runs EXISTING PROJECT FLOW) |
| 2 (Existing, no constitution) | [2] | Display path to constitution.md and exit |
| 3 (Ready, no workflow) | [1] | Execute `/sdlc feature` |
| 3 (Ready, no workflow) | [2] | Execute `/sdlc fix` |
| 3 (Ready, no workflow) | [3] | Execute `/sdlc test run` |
| 3 (Ready, no workflow) | [4] | Execute `/sdlc test generate` |
| 3 (Ready, no workflow) | [5] | Execute `/sdlc start` (full lifecycle) |
| 3 (Ready, no workflow) | [6] | Execute `/sdlc status` |
| 4 (Workflow active) | [1] | Resume current workflow at active phase |
| 4 (Workflow active) | [2] | Execute `/sdlc gate-check` |
| 4 (Workflow active) | [3] | Execute `/sdlc status` |
| 4 (Workflow active) | [4] | Prompt for issue description, then `/sdlc escalate` |
| 4 (Workflow active) | [5] | Execute `/sdlc cancel` |

---

### Actions

**feature** - Implement a new feature end-to-end
```
/sdlc feature "Feature description"
```
1. Validate constitution exists and is not a template
2. Check no active workflow (block if one exists, suggest `/sdlc cancel` first)
3. Initialize `active_workflow` in state.json with type `"feature"` and phases `["01-requirements", "02-architecture", "03-design", "05-implementation", "06-testing", "09-cicd", "07-code-review"]`
4. Delegate to Requirements Analyst (Phase 01) with `scope: "feature"`
5. After GATE-01: creates `feature/REQ-NNNN-description` branch from main
6. After GATE-07: merges branch to main, deletes branch

**fix** - Fix a bug or defect with TDD
```
/sdlc fix "Bug description"
/sdlc fix "Bug description" --link https://mycompany.atlassian.net/browse/JIRA-1234
```
1. Validate constitution exists and is not a template
2. Check no active workflow
3. Initialize `active_workflow` with type `"fix"` and phases `["01-requirements", "05-implementation", "06-testing", "09-cicd", "07-code-review"]`
4. If `--link` provided, pass it to Agent 01 as the external bug URL
5. Delegate to Requirements Analyst (Phase 01) with `scope: "bug-report"`
6. Agent 01 extracts external ID from URL and creates `BUG-NNNN-{external-id}/` folder
7. If no `--link` provided, Agent 01 asks for the bug link during the bug report flow
8. Phase 05 requires a failing test before the fix (TDD enforcement)
9. After GATE-01: creates `bugfix/BUG-NNNN-external-id` branch from main
10. After GATE-07: merges branch to main, deletes branch

**test run** - Execute existing automation tests
```
/sdlc test run
```
1. Present test type selection: Unit, System, E2E (multi-select)
2. Initialize `active_workflow` with type `"test-run"` and phases `["06-testing"]`
3. Delegate to Integration Tester (Phase 06) with selected test types
4. Report results — does NOT fix failures (suggest `/sdlc fix` for each)

**test generate** - Create new tests for existing code
```
/sdlc test generate
```
1. Present test type selection: Unit, System, E2E (single-select)
2. Initialize `active_workflow` with type `"test-generate"` and phases `["04-test-strategy", "05-implementation", "06-testing", "07-code-review"]`
3. Phase 04: Analyze code and design test cases
4. Phase 05: Write the test code
5. Phase 06: Run new tests to verify they work
6. Phase 07: Review test quality

**start** - Run complete SDLC lifecycle (all 13 phases)
```
/sdlc start "Project or feature description"
```
1. Validate constitution exists and is not a template
2. Check no active workflow
3. Assess project complexity
4. Initialize `active_workflow` with type `"full-lifecycle"` and all 13 phases
5. Delegate to Requirements Analyst (Phase 01)

**cancel** - Cancel the active workflow
```
/sdlc cancel
```
1. Check for active workflow (if none, inform user)
2. Prompt for cancellation reason (required)
3. If git branch is active: commit uncommitted work, checkout main, preserve branch
4. Move workflow to `workflow_history` with status `"cancelled"` and reason
5. Clear `active_workflow` from state.json
6. Display cancellation confirmation (include branch preservation note if applicable)

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
Agents: requirements-analyst, solution-architect, system-designer, test-design-engineer, software-developer, integration-tester, qa-engineer, security-compliance-auditor, cicd-engineer, environment-builder, deployment-engineer-staging, release-manager, site-reliability-engineer

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

> **REDIRECTED:** This command has been moved to a dedicated `/discover` command for better separation of concerns.

**Usage:** Use `/discover` instead of `/sdlc discover`.

The `/discover` command provides:
- Project type detection (new vs existing)
- Architecture analysis (existing projects)
- Test infrastructure evaluation
- Constitution generation with research
- Skills installation from skills.sh
- Project structure setup (new projects)

See `/discover --help` for full documentation.

**Quick Start:**
```bash
# For any project (auto-detects new vs existing)
/discover

# Force new project setup
/discover --new

# Force existing project analysis
/discover --existing
```

---

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

### Workflows

Each subcommand maps to a predefined workflow with a fixed, non-skippable phase sequence. Workflow definitions are in `.isdlc/config/workflows.json`.

| Command | Workflow | Phases | Gate Mode | Branch |
|---------|----------|--------|-----------|--------|
| `/sdlc feature` | feature | 01 → 02 → 03 → 05 → 10 → 06 → 09 → 07 | strict | `feature/REQ-NNNN-...` |
| `/sdlc fix` | fix | 01 → 05 → 10 → 06 → 09 → 07 | strict | `bugfix/BUG-NNNN-...` |
| `/sdlc test run` | test-run | 10 → 06 | strict | none |
| `/sdlc test generate` | test-generate | 04 → 05 → 10 → 06 → 07 | strict | none |
| `/sdlc start` | full-lifecycle | 01 → ... → 05 → 10 → 06 → ... → 10(remote) → 11 → ... → 13 | strict | `feature/REQ-NNNN-...` |

**Enforcement rules:**
- Workflows start at phase 1 — no `--start-at` flag
- Phases cannot be skipped within a workflow
- Only one active workflow at a time
- Starting a new workflow requires cancelling the active one first

### Examples

```
/sdlc feature "Build a REST API for user authentication"
/sdlc fix "Login endpoint returns 500 on empty password"
/sdlc fix "Login endpoint returns 500 on empty password" --link https://mycompany.atlassian.net/browse/AUTH-456
/sdlc test run
/sdlc test generate
/sdlc start "New e-commerce platform"
/sdlc status
/sdlc gate-check
/sdlc cancel
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
/sdlc (no args)    → Task tool → sdlc-orchestrator → Interactive Menu → User Selection → Action
/sdlc feature ...  → Task tool → sdlc-orchestrator → Initialize feature workflow → Phase agents
/sdlc fix ...      → Task tool → sdlc-orchestrator → Initialize fix workflow → Phase agents
/sdlc test run     → Task tool → sdlc-orchestrator → Initialize test-run workflow → Phase 06 agent
/sdlc test generate → Task tool → sdlc-orchestrator → Initialize test-generate workflow → Phase agents
/sdlc start ...    → Task tool → sdlc-orchestrator → Initialize full-lifecycle workflow → Phase agents
/sdlc cancel       → Task tool → sdlc-orchestrator → Cancel active workflow
/sdlc <action>     → Task tool → sdlc-orchestrator → Execute Action
```
