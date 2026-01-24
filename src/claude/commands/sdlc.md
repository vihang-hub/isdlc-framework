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
| 1 (New, no constitution) | [1] | Execute `/discover` (runs NEW PROJECT FLOW) |
| 1 (New, no constitution) | [2] | Display path to constitution.md and exit |
| 2 (Existing, no constitution) | [1] | Execute `/discover` (runs EXISTING PROJECT FLOW) |
| 2 (Existing, no constitution) | [2] | Display path to constitution.md and exit |
| 3 (Constitution ready) | [1] | Execute `/sdlc start` (prompt for project name) |
| 3 (Constitution ready) | [2] | Display constitution contents |
| 3 (Constitution ready) | [3] | Execute `/discover` (re-run setup) |
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
/discover                 # Preferred (or /sdlc discover which redirects)
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
