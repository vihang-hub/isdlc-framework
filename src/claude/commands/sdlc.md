## SDLC Orchestrator Command
Invoke the SDLC Orchestrator to coordinate software development lifecycle workflows.

### Usage
`/sdlc <action> [options]`

### Monorepo Support

When the project is a monorepo (`.isdlc/monorepo.json` exists), all commands accept a `--project {id}` flag to target a specific project. The orchestrator resolves the project root by walking up parent directories from CWD to find `.isdlc/`, so you can launch Claude from a sub-project directory (e.g., `cd FE && claude`) and it will find the framework at the monorepo root.

**Project resolution order** (when `--project` is not provided):
1. **CWD-based detection** — compute the relative path from the resolved project root to CWD, match against registered project paths in `monorepo.json` (longest prefix match)
2. **`default_project`** from `monorepo.json` — the configured default
3. **Interactive prompt** — if no project can be resolved, present selection menu

**Project subcommands:**
```
/sdlc project list                    — List all registered projects
/sdlc project add {id} {path}         — Manually register a project
/sdlc project scan                    — Auto-detect projects from scan_paths
/sdlc project select {id}             — Set default project
```

**Project flag on action commands:**
```
/sdlc feature "description" --project api-service
/sdlc fix "description" --project web-frontend
/sdlc status --project api-service
```

### No-Argument Behavior (Interactive Menu)

When `/sdlc` is invoked without any action, present a context-aware menu based on project state.

**Detection Logic:**
1. Check if `docs/isdlc/constitution.md` exists and is NOT a template. Template markers include:
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

**SCENARIO 0: Monorepo detected, no project selected**

When `.isdlc/monorepo.json` exists but no `--project` flag was provided AND no `default_project` is set (or the default project is invalid):

```
╔══════════════════════════════════════════════════════════════╗
║  iSDLC Framework - Monorepo Project Selection                ║
╚══════════════════════════════════════════════════════════════╝

Monorepo detected with [N] registered projects.

Select a project to work with:

[1] api-service        — apps/api-service
[2] web-frontend       — apps/web-frontend
[3] shared-lib         — packages/shared-lib

Or manage projects:
[P] Scan for projects  — Auto-detect from scan_paths
[A] Add project        — Register a new project manually

Enter selection:
```

After selection, set `default_project` in `monorepo.json` and proceed to the appropriate scenario (1-4) for that project.

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
    Open docs/isdlc/constitution.md and customize the template yourself

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
    Open docs/isdlc/constitution.md and customize the template yourself

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
[7] Upgrade           — Upgrade a dependency, runtime, or tool

Enter selection (1-7):
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
| 0 (Monorepo, no project) | [1-N] | Set selected project as default, proceed to scenario 1-4 |
| 0 (Monorepo, no project) | [P] | Execute `/sdlc project scan` |
| 0 (Monorepo, no project) | [A] | Prompt for project ID and path, execute `/sdlc project add` |
| 1 (New, no constitution) | [1] | Execute `/discover` (runs NEW PROJECT FLOW) |
| 1 (New, no constitution) | [2] | Display path to constitution.md and exit |
| 2 (Existing, no constitution) | [1] | Execute `/discover` (runs EXISTING PROJECT FLOW) |
| 2 (Existing, no constitution) | [2] | Display path to constitution.md and exit |
| 3 (Ready, no workflow) | [1] | Execute `/sdlc feature` (no description — presents backlog picker) |
| 3 (Ready, no workflow) | [2] | Execute `/sdlc fix` (no description — presents backlog picker) |
| 3 (Ready, no workflow) | [3] | Execute `/sdlc test run` |
| 3 (Ready, no workflow) | [4] | Execute `/sdlc test generate` |
| 3 (Ready, no workflow) | [5] | Execute `/sdlc start` (full lifecycle) |
| 3 (Ready, no workflow) | [6] | Execute `/sdlc status` |
| 3 (Ready, no workflow) | [7] | Ask what to upgrade, then execute `/sdlc upgrade "<name>"` |
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
/sdlc feature "Feature description" --project api-service
/sdlc feature                        (no description — presents backlog picker)
```
1. Validate constitution exists and is not a template
2. Check no active workflow (block if one exists, suggest `/sdlc cancel` first)
3. Initialize `active_workflow` in state.json with type `"feature"` and phases `["01-requirements", "02-architecture", "03-design", "05-implementation", "06-testing", "09-cicd", "07-code-review"]`
4. Delegate to Requirements Analyst (Phase 01) with `scope: "feature"`
5. After GATE-01: creates `feature/REQ-NNNN-description` branch from main
6. After GATE-07: merges branch to main, deletes branch

**No-description behavior:** When `/sdlc feature` is invoked without a description (no quoted text, no feature ID), the orchestrator presents a **backlog picker** instead of immediately asking for a description. The backlog picker scans:
- `CLAUDE.md` for unchecked items (`- [ ] ...`) in the Next Session section
- `.isdlc/state.json` → `workflow_history` for cancelled feature workflows
- User can also choose `[O] Other` to describe a new feature manually
See the BACKLOG PICKER section in the orchestrator agent for full details.

**fix** - Fix a bug or defect with TDD
```
/sdlc fix "Bug description"
/sdlc fix "Bug description" --link https://mycompany.atlassian.net/browse/JIRA-1234
/sdlc fix "Bug description" --project api-service
/sdlc fix                    (no description — presents backlog picker)
```
1. Validate constitution exists and is not a template
2. Check no active workflow
3. Initialize `active_workflow` with type `"fix"` and phases `["01-requirements", "02-tracing", "04-test-strategy", "05-implementation", "10-local-testing", "06-testing", "09-cicd", "07-code-review"]`
4. If `--link` provided, pass it to Agent 01 as the external bug URL
5. Delegate to Requirements Analyst (Phase 01) with `scope: "bug-report"`
6. Agent 01 extracts external ID from URL and creates `BUG-NNNN-{external-id}/` folder
7. If no `--link` provided, Agent 01 asks for the bug link during the bug report flow
8. Phase 05 requires a failing test before the fix (TDD enforcement)
9. After GATE-01: creates `bugfix/BUG-NNNN-external-id` branch from main
10. After GATE-07: merges branch to main, deletes branch

**No-description behavior:** When `/sdlc fix` is invoked without a description, the orchestrator presents a **backlog picker** that scans:
- `.isdlc/state.json` → `workflow_history` for cancelled fix workflows
- `CLAUDE.md` for unchecked items containing bug-related keywords (fix, bug, broken, error, crash, regression, issue)
- User can also choose `[O] Other` to describe a new bug manually
See the BACKLOG PICKER section in the orchestrator agent for full details.

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
Write final constitution to `docs/isdlc/constitution.md`

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


**upgrade** - Upgrade a dependency, runtime, framework, or tool
```
/sdlc upgrade "react"
/sdlc upgrade "typescript" --project api-service
/sdlc upgrade "node"
```
1. Validate constitution exists and is not a template
2. Check no active workflow (block if one exists, suggest `/sdlc cancel` first)
3. Initialize `active_workflow` in state.json with type `"upgrade"` and phases `["14-upgrade-plan", "14-upgrade-execute", "07-code-review"]`
4. **Validate test adequacy** — run the full test suite to confirm adequate coverage exists. If no tests exist, block the upgrade and recommend `/sdlc test generate` first. If coverage is below thresholds, warn the user and require explicit acceptance before proceeding.
5. Delegate to Upgrade Engineer (Phase 14) with `scope: "analysis"`:
   - Detect ecosystem and current version
   - Look up available versions from registry
   - Perform impact analysis (changelogs, codebase scan)
   - Generate migration plan ranked by risk
   - **Require user approval** before proceeding
6. After plan approval: create `upgrade/{name}-v{version}` branch from main
7. Delegate to Upgrade Engineer (Phase 14) with `scope: "execution"`:
   - Capture baseline test results
   - Execute migration steps with implement-test loop
   - Max iterations configurable (default: 10)
   - Circuit breaker: 3 identical failures → escalate
8. Delegate to QA Engineer (Phase 07) with `scope: "upgrade-review"` for code review
9. After GATE-07: merge branch to main, delete branch

---

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

**reverse-engineer** - **(Deprecated — now integrated into `/discover`)**

> **NOTE:** `/sdlc reverse-engineer` is now an alias for `/discover --existing` with the same options. Behavior extraction, characterization tests, and traceability are now built into the discover workflow.

```
/sdlc reverse-engineer                                    →  /discover --existing
/sdlc reverse-engineer --scope domain --target "payments" →  /discover --scope domain --target "payments"
/sdlc reverse-engineer --priority critical                →  /discover --priority critical
/sdlc reverse-engineer --atdd-ready                       →  /discover --atdd-ready
```

When invoked, display this message and redirect:
```
NOTE: /sdlc reverse-engineer is now integrated into /discover.
Running: /discover --existing {forwarded options}

```

All options (`--scope`, `--target`, `--priority`, `--atdd-ready`) are forwarded to `/discover`.

---

**project list** - List all registered projects in monorepo (monorepo only)
```
/sdlc project list
```
1. Read `.isdlc/monorepo.json`
2. Display all registered projects with their paths and status
3. Indicate the current default project

**project add** - Manually register a project in monorepo (monorepo only)
```
/sdlc project add {id} {path}
```
1. Validate the path exists
2. Add project entry to `monorepo.json`
3. Create `.isdlc/projects/{project-id}/` directory with initial `state.json`
4. Create docs directory structure (`docs/{project-id}/` or `{project-path}/docs/` based on `docs_location` in monorepo.json)

**project scan** - Auto-detect projects from scan_paths (monorepo only)
```
/sdlc project scan
```
1. Read `scan_paths` from `monorepo.json`
2. Scan for projects (look for package.json, go.mod, Cargo.toml, etc. in subdirectories)
3. Present discovered projects for confirmation
4. Register confirmed projects

**project select** - Set the default project (monorepo only)
```
/sdlc project select {id}
```
1. Validate project ID exists in `monorepo.json`
2. Update `default_project` in `monorepo.json`
3. Confirm selection

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
| `/sdlc fix` | fix | 01 → 02 → 04 → 05 → 10 → 06 → 09 → 07 | strict | `bugfix/BUG-NNNN-...` |
| `/sdlc test run` | test-run | 10 → 06 | strict | none |
| `/sdlc test generate` | test-generate | 04 → 05 → 10 → 06 → 07 | strict | none |
| `/sdlc start` | full-lifecycle | 01 → ... → 05 → 10 → 06 → ... → 10(remote) → 11 → ... → 13 | strict | `feature/REQ-NNNN-...` |
| `/sdlc upgrade` | upgrade | 14-plan → 14-execute → 07 | strict | `upgrade/{name}-v{ver}` |
| `/sdlc reverse-engineer` | *(alias → `/discover --existing`)* | — | — | — |

**Enforcement rules:**
- Workflows start at phase 1 — no `--start-at` flag
- Phases cannot be skipped within a workflow
- Only one active workflow at a time
- Starting a new workflow requires cancelling the active one first

### Examples

```
/sdlc feature "Build a REST API for user authentication"
/sdlc feature "Add payment processing" --project api-service
/sdlc fix "Login endpoint returns 500 on empty password"
/sdlc fix "Login endpoint returns 500 on empty password" --link https://mycompany.atlassian.net/browse/AUTH-456
/sdlc test run
/sdlc test generate
/sdlc start "New e-commerce platform"
/sdlc status
/sdlc status --project web-frontend
/sdlc gate-check
/sdlc cancel
/sdlc configure-cloud
/sdlc escalate "Unclear requirement about session timeout"
/sdlc project list
/sdlc project add shared-lib packages/shared-lib
/sdlc project scan
/sdlc project select api-service
/sdlc upgrade "react"
/sdlc upgrade "typescript" --project api-service
/sdlc upgrade "node"
/sdlc upgrade "express"
/sdlc reverse-engineer
/sdlc reverse-engineer --scope domain --target "payments"
/sdlc reverse-engineer --priority critical --atdd-ready
```

### Prerequisites

1. **Project Constitution**: A valid `docs/isdlc/constitution.md` is required before starting any workflow
2. **Framework Installation**: The iSDLC framework must be installed (run `init-project.sh`)

### Implementation

When this command is invoked:

**If in monorepo mode** (`.isdlc/monorepo.json` exists at the resolved project root — found by walking up parent directories from CWD):
- If `--project {id}` flag is present: extract the project ID from the flag
- Otherwise: auto-detect project from CWD (use the relative path from project root to CWD, match against registered project paths, longest prefix match)
- Otherwise: fall back to `default_project` in `monorepo.json`
- Include `MONOREPO CONTEXT: --project {id}` in the Task prompt passed to the orchestrator
- The orchestrator will resolve all paths (state, docs, constitution, external skills) to that project

**If NO action argument provided (`/sdlc` alone):**
1. Use the Task tool to launch the `sdlc-orchestrator` agent
2. Pass explicit instruction: "No action specified. Present the interactive context-aware menu based on constitution status, workflow status, and existing project detection."
3. In monorepo mode with no project resolved, the orchestrator MUST present SCENARIO 0 first
4. Otherwise, present the appropriate scenario menu (1-4) based on detection logic
5. Wait for user selection before taking further action

**If action is `feature` or `fix` WITHOUT a description (`/sdlc feature` or `/sdlc fix` alone):**
1. Use the Task tool to launch the `sdlc-orchestrator` agent
2. Pass explicit instruction: "Action is {feature|fix} but no description provided. Run the BACKLOG PICKER in {feature|fix} mode to let the user select from pending items or describe a new one."
3. The orchestrator scans CLAUDE.md and state.json, presents the backlog picker, waits for selection, then proceeds with the chosen description

**If action is a NON-WORKFLOW command** (cancel, status, gate-check, constitution, configure-cloud, or any unrecognized action):
1. Use the Task tool to launch the `sdlc-orchestrator` agent (single invocation)
2. Pass the action and any flags to the agent
3. The orchestrator handles it and returns

**If action is a WORKFLOW command** (feature, fix, test-run, test-generate, start, upgrade) **with description:**

Use the **Phase-Loop Controller** protocol. This runs phases one at a time in the foreground, giving the user visible task progress and immediate hook-blocker escalation.

#### STEP 1: INIT — Launch orchestrator for init + Phase 01

```
Use Task tool → sdlc-orchestrator with:
  MODE: init-and-phase-01
  ACTION: {feature|fix|test-run|test-generate|start|upgrade}
  DESCRIPTION: "{user description}"
  (include MONOREPO CONTEXT if applicable)
```

The orchestrator initializes the workflow, runs Phase 01 (requirements/bug-report), validates GATE-01, creates the branch, generates the plan, and returns a structured result:
```json
{
  "status": "phase_01_complete",
  "phases": ["01-requirements", "02-architecture", ...],
  "artifact_folder": "REQ-0001-feature-name",
  "workflow_type": "feature",
  "next_phase_index": 1
}
```

If Phase 01 fails or is cancelled, stop here.

#### STEP 2: FOREGROUND TASKS — Create visible task list

Using the `phases[]` array from the init result, create one `TaskCreate` per phase using these definitions:

| Phase Key | subject | activeForm |
|-----------|---------|------------|
| `00-mapping` | Map feature impact (Phase 00) | Mapping feature impact |
| `01-requirements` | Capture requirements (Phase 01) | Capturing requirements |
| `02-tracing` | Trace bug root cause (Phase 02) | Tracing bug root cause |
| `02-architecture` | Design architecture (Phase 02) | Designing architecture |
| `03-design` | Create design specifications (Phase 03) | Creating design specifications |
| `04-test-strategy` | Design test strategy (Phase 04) | Designing test strategy |
| `05-implementation` | Implement features (Phase 05) | Implementing features |
| `10-local-testing` | Build and launch local environment (Phase 10) | Building local environment |
| `06-testing` | Run integration and E2E tests (Phase 06) | Running integration tests |
| `07-code-review` | Perform code review and QA (Phase 07) | Performing code review |
| `08-validation` | Validate security and compliance (Phase 08) | Validating security |
| `09-cicd` | Configure CI/CD pipelines (Phase 09) | Configuring CI/CD |
| `10-remote-build` | Build and deploy remote environment (Phase 10) | Building remote environment |
| `11-test-deploy` | Deploy to staging (Phase 11) | Deploying to staging |
| `12-production` | Deploy to production (Phase 12) | Deploying to production |
| `13-operations` | Configure monitoring and operations (Phase 13) | Configuring operations |
| `14-upgrade-plan` | Analyze upgrade impact and generate plan (Phase 14) | Analyzing upgrade impact |
| `14-upgrade-execute` | Execute upgrade with regression testing (Phase 14) | Executing upgrade |

For `description`, use: `"Phase {NN} of {workflow_type} workflow"`

Mark Phase 01's task as `completed` immediately (it already passed in Step 1).

The user now sees the full task list in their terminal.

#### STEP 3: PHASE LOOP — Execute remaining phases one at a time

For each phase from `next_phase_index` through the end of `phases[]`:

**3a.** Mark the phase task as `in_progress` using `TaskUpdate` (user sees spinner).

**3b.** Read `.isdlc/state.json` and check for `pending_escalations[]`.

**3c.** If escalations exist, display the blocker banner and ask the user:

```
╔══════════════════════════════════════════════════════════════╗
║  BLOCKER — Phase {NN}: {Phase Name}                        ║
╠══════════════════════════════════════════════════════════════╣
║  Hook: {hook_name}                                         ║
║  Detail: {description}                                     ║
╚══════════════════════════════════════════════════════════════╝
```

Use `AskUserQuestion` with options:
- **Retry phase** — Clear escalations, re-run the phase
- **Skip (override)** — Clear escalations, mark task completed, continue
- **Cancel workflow** — Launch orchestrator with cancel action, stop loop

Clear `pending_escalations` after handling.

**3d.** Launch the orchestrator for this single phase:

```
Use Task tool → sdlc-orchestrator with:
  MODE: single-phase
  PHASE: {phase_key}
  (include MONOREPO CONTEXT if applicable)
```

**3e.** On return, check the result status:
- `"passed"` → Mark task as `completed`, continue to next phase
- `"blocked_by_hook"` → Display blocker banner (same format as 3c), use `AskUserQuestion` for Retry/Skip/Cancel
- Any other error → Display error, use `AskUserQuestion` for Retry/Skip/Cancel

#### STEP 4: FINALIZE — Complete the workflow

After all phases complete:

```
Use Task tool → sdlc-orchestrator with:
  MODE: finalize
  (include MONOREPO CONTEXT if applicable)
```

The orchestrator runs the Human Review Checkpoint (if code_review.enabled), merges the branch, and clears the workflow.

#### Flow Summary

```
/sdlc (no args)    → Task → orchestrator → Interactive Menu → User Selection → Action
/sdlc feature      → Task → orchestrator → Backlog Picker (feature) → Phase-Loop Controller
/sdlc fix          → Task → orchestrator → Backlog Picker (fix) → Phase-Loop Controller
/sdlc feature ...  → Phase-Loop Controller (init → tasks → loop → finalize)
/sdlc fix ...      → Phase-Loop Controller (init → tasks → loop → finalize)
/sdlc test run     → Phase-Loop Controller (init → tasks → loop → finalize)
/sdlc test generate → Phase-Loop Controller (init → tasks → loop → finalize)
/sdlc start ...    → Phase-Loop Controller (init → tasks → loop → finalize)
/sdlc upgrade ...  → Phase-Loop Controller (init → tasks → loop → finalize)
/sdlc cancel       → Task → orchestrator → Cancel active workflow
/sdlc status       → Task → orchestrator → Show status
/sdlc <action>     → Task → orchestrator → Execute Action
```
