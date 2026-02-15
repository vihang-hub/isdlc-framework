## SDLC Orchestrator Command
Invoke the SDLC Orchestrator to coordinate software development lifecycle workflows.

### Usage
`/isdlc <action> [options]`

### Monorepo Support

When the project is a monorepo (`.isdlc/monorepo.json` exists), all commands accept a `--project {id}` flag to target a specific project. The orchestrator resolves the project root by walking up parent directories from CWD to find `.isdlc/`, so you can launch Claude from a sub-project directory (e.g., `cd FE && claude`) and it will find the framework at the monorepo root.

**Project resolution order** (when `--project` is not provided):
1. **CWD-based detection** — compute the relative path from the resolved project root to CWD, match against registered project paths in `monorepo.json` (longest prefix match)
2. **`default_project`** from `monorepo.json` — the configured default
3. **Interactive prompt** — if no project can be resolved, present selection menu

**Project subcommands:**
```
/isdlc project list                    — List all registered projects
/isdlc project add {id} {path}         — Manually register a project
/isdlc project scan                    — Auto-detect projects from scan_paths
/isdlc project select {id}             — Set default project
```

**Project flag on action commands:**
```
/isdlc feature "description" --project api-service
/isdlc fix "description" --project web-frontend
/isdlc status --project api-service
```

### No-Argument Behavior (Interactive Menu)

When `/isdlc` is invoked without any action, present a context-aware menu based on project state.

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
[5] View Status       — Check current project status
[6] Upgrade           — Upgrade a dependency, runtime, or tool

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

**Supervised review recovery check** (before presenting SCENARIO 4 menu):

1. Read `active_workflow.supervised_review` from state.json
2. If `supervised_review` exists AND `supervised_review.status` is `"reviewing"` or `"gate_presented"`:
   a. Display recovery banner:
      ```
      A review was in progress for Phase {NN} ({Phase Name}).
      Summary: .isdlc/reviews/phase-{NN}-summary.md

      [C] Continue to next phase
      [R] Show summary and review again
      ```
   b. Handle user response:
      - **[C] Continue**: Clear `supervised_review`, advance to next phase (proceed with standard SCENARIO 4 [1] Continue)
      - **[R] Review**: Display summary file content, then present "When ready, say 'continue'" and wait
3. If `supervised_review` exists AND `supervised_review.status` is `"redo_pending"`:
   a. Display: "A redo was in progress for Phase {NN}. The phase will be re-run."
   b. Proceed as if user selected [1] Continue (the phase-loop will re-run from the current phase)
4. If `supervised_review` does not exist: proceed to standard SCENARIO 4 menu (no change)

---

**After Selection Mapping:**

| Scenario | Option | Action |
|----------|--------|--------|
| 0 (Monorepo, no project) | [1-N] | Set selected project as default, proceed to scenario 1-4 |
| 0 (Monorepo, no project) | [P] | Execute `/isdlc project scan` |
| 0 (Monorepo, no project) | [A] | Prompt for project ID and path, execute `/isdlc project add` |
| 1 (New, no constitution) | [1] | Execute `/discover` (runs NEW PROJECT FLOW) |
| 1 (New, no constitution) | [2] | Display path to constitution.md and exit |
| 2 (Existing, no constitution) | [1] | Execute `/discover` (runs EXISTING PROJECT FLOW) |
| 2 (Existing, no constitution) | [2] | Display path to constitution.md and exit |
| 3 (Ready, no workflow) | [1] | Execute `/isdlc feature` (no description — presents backlog picker) |
| 3 (Ready, no workflow) | [2] | Execute `/isdlc fix` (no description — presents backlog picker) |
| 3 (Ready, no workflow) | [3] | Execute `/isdlc test run` |
| 3 (Ready, no workflow) | [4] | Execute `/isdlc test generate` |
| 3 (Ready, no workflow) | [5] | Execute `/isdlc status` |
| 3 (Ready, no workflow) | [6] | Ask what to upgrade, then execute `/isdlc upgrade "<name>"` |
| 4 (Workflow active) | [1] | Resume current workflow at active phase |
| 4 (Workflow active) | [2] | Execute `/isdlc gate-check` |
| 4 (Workflow active) | [3] | Execute `/isdlc status` |
| 4 (Workflow active) | [4] | Prompt for issue description, then `/isdlc escalate` |
| 4 (Workflow active) | [5] | Execute `/isdlc cancel` |

---

### Actions

**feature** - Implement a new feature end-to-end
```
/isdlc feature "Feature description"
/isdlc feature "Feature description" --project api-service
/isdlc feature -light "Feature description"
/isdlc feature -light "Feature description" --project api-service
/isdlc feature "Feature description" --supervised
/isdlc feature -light "Feature description" --supervised
/isdlc feature "Feature description" --debate
/isdlc feature "Feature description" --no-debate
/isdlc feature                        (no description — presents backlog picker)
```
1. Validate constitution exists and is not a template
2. Check no active workflow (block if one exists, suggest `/isdlc cancel` first)
3. Parse flags from command arguments:
   - If args contain "-light": set flags.light = true, remove "-light" from description
   - If args contain "--supervised": set flags.supervised = true, remove "--supervised" from description
   - If args contain "--debate": set flags.debate = true, remove "--debate" from description
   - If args contain "--no-debate": set flags.no_debate = true, remove "--no-debate" from description
4. Initialize `active_workflow` in state.json with type `"feature"`, phases `["00-quick-scan", "01-requirements", "02-impact-analysis", "03-architecture", "04-design", "05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"]`, and flags: `{ light: flags.light || false }`
   - If flags.supervised: pass `--supervised` flag to orchestrator init (sets supervised_mode.enabled=true in state)
   - If flags.debate or flags.no_debate: pass to orchestrator for debate mode resolution
4. Delegate to Requirements Analyst (Phase 01) with `scope: "feature"`
5. During initialization: creates `feature/REQ-NNNN-description` branch from main (before Phase 01)
6. After GATE-08: merges branch to main, deletes branch

### Debate Mode Flags

| Flag | Effect | Default |
|------|--------|---------|
| `--debate` | Force debate mode ON (multi-agent debate team: requirements + architecture) | Implied for standard/epic sizing |
| `--no-debate` | Force debate mode OFF (single-agent mode for all phases) | Implied for -light |

**Flag precedence** (highest to lowest):
1. `--no-debate` -- always wins (conservative override)
2. `--debate` -- explicit enable
3. `-light` -- implies `--no-debate`
4. Sizing-based default: standard/epic = debate ON, fallback = debate ON

**Conflict resolution:** If both `--debate` and `--no-debate` are present,
`--no-debate` wins (Article X: Fail-Safe Defaults).

**Debate-enabled phases:** The debate loop currently supports Phase 01 (Requirements),
Phase 03 (Architecture), Phase 04 (Design), and Phase 05 (Test Strategy). Other phases use single-agent delegation
regardless of debate flags. See the orchestrator's DEBATE_ROUTING table for the
authoritative list.

**Passed to orchestrator:** The resolved debate flags are included in the
orchestrator delegation context as:
```
FLAGS:
  debate: true|false
  no_debate: true|false
  light: true|false
```

The orchestrator reads `FLAGS.debate` and `FLAGS.no_debate` to resolve `debate_mode`
and writes the result to `active_workflow.debate_mode` in state.json.

**No-description behavior:** When `/isdlc feature` is invoked without a description (no quoted text, no feature ID), the orchestrator presents a **backlog picker** instead of immediately asking for a description. The backlog picker scans:
- `BACKLOG.md` `## Open` section for unchecked items (`- N.N [ ] ...`), with `[Jira: TICKET-ID]` suffix for Jira-backed items
- `.isdlc/state.json` → `workflow_history` for cancelled feature workflows
- Falls back to `CLAUDE.md` scanning if `BACKLOG.md` does not exist
- User can also choose `[O] Other` to describe a new feature manually
See the BACKLOG PICKER section in the orchestrator agent for full details.

**fix** - Fix a bug or defect with TDD
```
/isdlc fix "Bug description"
/isdlc fix "Bug description" --link https://mycompany.atlassian.net/browse/JIRA-1234
/isdlc fix "Bug description" --project api-service
/isdlc fix "Bug description" --supervised
/isdlc fix                    (no description — presents backlog picker)
```
1. Validate constitution exists and is not a template
2. Check no active workflow
3. Parse flags from command arguments:
   - If args contain "--supervised": set flags.supervised = true, remove "--supervised" from description
4. Initialize `active_workflow` with type `"fix"` and phases `["01-requirements", "02-tracing", "05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"]`
   - If flags.supervised: pass `--supervised` flag to orchestrator init (sets supervised_mode.enabled=true in state)
4. If `--link` provided, pass it to Agent 01 as the external bug URL
5. Delegate to Requirements Analyst (Phase 01) with `scope: "bug-report"`
6. Agent 01 extracts external ID from URL and creates `BUG-NNNN-{external-id}/` folder
7. If no `--link` provided, Agent 01 asks for the bug link during the bug report flow
8. Phase 05 requires a failing test before the fix (TDD enforcement)
9. During initialization: creates `bugfix/BUG-NNNN-external-id` branch from main (before Phase 01)
10. After GATE-08: merges branch to main, deletes branch

**No-description behavior:** When `/isdlc fix` is invoked without a description, the orchestrator presents a **backlog picker** that scans:
- `.isdlc/state.json` → `workflow_history` for cancelled fix workflows
- `BACKLOG.md` `## Open` section for unchecked items containing bug-related keywords (fix, bug, broken, error, crash, regression, issue), with `[Jira: TICKET-ID]` suffix for Jira-backed items
- Falls back to `CLAUDE.md` scanning if `BACKLOG.md` does not exist
- User can also choose `[O] Other` to describe a new bug manually
See the BACKLOG PICKER section in the orchestrator agent for full details.

**test run** - Execute existing automation tests
```
/isdlc test run
```
1. Present test type selection: Unit, System, E2E (multi-select)
2. Initialize `active_workflow` with type `"test-run"` and phases `["11-local-testing", "07-testing"]`
3. Delegate to Integration Tester (Phase 06) with selected test types
4. Report results — does NOT fix failures (suggest `/isdlc fix` for each)

**test generate** - Create new tests for existing code
```
/isdlc test generate
```
1. Present test type selection: Unit, System, E2E (single-select)
2. Initialize `active_workflow` with type `"test-generate"` and phases `["05-test-strategy", "06-implementation", "11-local-testing", "07-testing", "08-code-review"]`
3. Phase 04: Analyze code and design test cases
4. Phase 05: Write the test code
5. Phase 06: Run new tests to verify they work
6. Phase 07: Review test quality

**cancel** - Cancel the active workflow
```
/isdlc cancel
```
1. Check for active workflow (if none, inform user)
2. Prompt for cancellation reason (required)
3. If git branch is active: commit uncommitted work, checkout main, preserve branch
4. Collect workflow progress snapshots: call `collectPhaseSnapshots(state)` to capture phase-by-phase execution data before it is lost
5. Move workflow to `workflow_history` with status `"cancelled"`, reason, `phases` (copy of `active_workflow.phases`), `phase_snapshots`, and `metrics`
6. Clear `active_workflow` from state.json
7. Display cancellation confirmation (include branch preservation note if applicable)

**status** - Show current project status
```
/isdlc status
```
1. Read `.isdlc/state.json`
2. Report current phase, active agent, blockers, and progress
3. Show completed vs pending phases

**gate-check** - Validate current phase gate
```
/isdlc gate-check
```
1. Identify current phase from state
2. Run gate validation checklist
3. Report pass/fail with details
4. Check constitutional compliance

**advance** - Move to next phase (requires gate pass)
```
/isdlc advance
```
1. Validate current phase gate passes
2. Update state to next phase
3. Delegate to next phase agent

**delegate** - Assign task to specific agent
```
/isdlc delegate <agent-name> "task description"
```
Agents: requirements-analyst, solution-architect, system-designer, test-design-engineer, software-developer, integration-tester, qa-engineer, security-compliance-auditor, cicd-engineer, environment-builder, deployment-engineer-staging, release-manager, site-reliability-engineer

**escalate** - Escalate issue to human
```
/isdlc escalate "issue description"
```
1. Log escalation in state
2. Pause workflow
3. Present issue to user for resolution

**constitution** - Create or validate project constitution (for NEW projects)
```
/isdlc constitution
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
/isdlc upgrade "react"
/isdlc upgrade "typescript" --project api-service
/isdlc upgrade "node"
```
1. Validate constitution exists and is not a template
2. Check no active workflow (block if one exists, suggest `/isdlc cancel` first)
3. Initialize `active_workflow` in state.json with type `"upgrade"` and phases `["15-upgrade-plan", "15-upgrade-execute", "08-code-review"]`
4. **Validate test adequacy** — run the full test suite to confirm adequate coverage exists. If no tests exist, block the upgrade and recommend `/isdlc test generate` first. If coverage is below thresholds, warn the user and require explicit acceptance before proceeding.
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
/isdlc discover
```

> **REDIRECTED:** This command has been moved to a dedicated `/discover` command for better separation of concerns.

**Usage:** Use `/discover` instead of `/isdlc discover`.

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

> **NOTE:** `/isdlc reverse-engineer` is now an alias for `/discover --existing` with the same options. Behavior extraction, characterization tests, and traceability are now built into the discover workflow.

```
/isdlc reverse-engineer                                    →  /discover --existing
/isdlc reverse-engineer --scope domain --target "payments" →  /discover --scope domain --target "payments"
/isdlc reverse-engineer --priority critical                →  /discover --priority critical
/isdlc reverse-engineer --atdd-ready                       →  /discover --atdd-ready
```

When invoked, display this message and redirect:
```
NOTE: /isdlc reverse-engineer is now integrated into /discover.
Running: /discover --existing {forwarded options}

```

All options (`--scope`, `--target`, `--priority`, `--atdd-ready`) are forwarded to `/discover`.

---

**project list** - List all registered projects in monorepo (monorepo only)
```
/isdlc project list
```
1. Read `.isdlc/monorepo.json`
2. Display all registered projects with their paths and status
3. Indicate the current default project

**project add** - Manually register a project in monorepo (monorepo only)
```
/isdlc project add {id} {path}
```
1. Validate the path exists
2. Add project entry to `monorepo.json`
3. Create `.isdlc/projects/{project-id}/` directory with initial `state.json`
4. Create docs directory structure (`docs/{project-id}/` or `{project-path}/docs/` based on `docs_location` in monorepo.json)

**project scan** - Auto-detect projects from scan_paths (monorepo only)
```
/isdlc project scan
```
1. Read `scan_paths` from `monorepo.json`
2. Scan for projects (look for package.json, go.mod, Cargo.toml, etc. in subdirectories)
3. Present discovered projects for confirmation
4. Register confirmed projects

**project select** - Set the default project (monorepo only)
```
/isdlc project select {id}
```
1. Validate project ID exists in `monorepo.json`
2. Update `default_project` in `monorepo.json`
3. Confirm selection

---

**configure-cloud** - Configure or reconfigure cloud provider for deployment
```
/isdlc configure-cloud
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
   - If no: Inform user to run `/isdlc advance` when ready

### Workflows

Each subcommand maps to a predefined workflow with a fixed, non-skippable phase sequence. Workflow definitions are in `.isdlc/config/workflows.json`.

| Command | Workflow | Phases | Gate Mode | Branch |
|---------|----------|--------|-----------|--------|
| `/isdlc feature` | feature | 00 → 01 → 02(IA) → 03 → 04 → 05 → 06 → 16(QL) → 08 | strict | `feature/REQ-NNNN-...` |
| `/isdlc fix` | fix | 01 → 02(trace) → 05 → 06 → 16(QL) → 08 | strict | `bugfix/BUG-NNNN-...` |
| `/isdlc test run` | test-run | 11 → 07 | strict | none |
| `/isdlc test generate` | test-generate | 05 → 06 → 11 → 07 → 08 | strict | none |
| `/isdlc upgrade` | upgrade | 15-plan → 15-execute → 08 | strict | `upgrade/{name}-v{ver}` |
| `/isdlc reverse-engineer` | *(alias → `/discover --existing`)* | — | — | — |

**Enforcement rules:**
- Workflows start at phase 1 — no `--start-at` flag
- Phases cannot be skipped within a workflow
- Only one active workflow at a time
- Starting a new workflow requires cancelling the active one first

### Examples

```
/isdlc feature "Build a REST API for user authentication"
/isdlc feature "Add payment processing" --project api-service
/isdlc fix "Login endpoint returns 500 on empty password"
/isdlc fix "Login endpoint returns 500 on empty password" --link https://mycompany.atlassian.net/browse/AUTH-456
/isdlc test run
/isdlc test generate
/isdlc status
/isdlc status --project web-frontend
/isdlc gate-check
/isdlc cancel
/isdlc configure-cloud
/isdlc escalate "Unclear requirement about session timeout"
/isdlc project list
/isdlc project add shared-lib packages/shared-lib
/isdlc project scan
/isdlc project select api-service
/isdlc upgrade "react"
/isdlc upgrade "typescript" --project api-service
/isdlc upgrade "node"
/isdlc upgrade "express"
/isdlc reverse-engineer
/isdlc reverse-engineer --scope domain --target "payments"
/isdlc reverse-engineer --priority critical --atdd-ready
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

**If NO action argument provided (`/isdlc` alone):**
1. Use the Task tool to launch the `sdlc-orchestrator` agent
2. Pass explicit instruction: "No action specified. Present the interactive context-aware menu based on constitution status, workflow status, and existing project detection."
3. In monorepo mode with no project resolved, the orchestrator MUST present SCENARIO 0 first
4. Otherwise, present the appropriate scenario menu (1-4) based on detection logic
5. Wait for user selection before taking further action

**If action is `feature` or `fix` WITHOUT a description (`/isdlc feature` or `/isdlc fix` alone):**
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

The orchestrator initializes the workflow, creates the branch, runs Phase 01 (requirements/bug-report), validates GATE-01, generates the plan, and returns a structured result:
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

Using the `phases[]` array from the init result, create one `TaskCreate` per phase. Assign each task a **sequential number** starting at 1, incrementing by 1 for each phase in the workflow. Use the format `[N]` as a prefix in the subject.

**IMPORTANT**: The `phases[]` array from the init result uses keys from `workflows.json` (the source of truth). Use these exact keys to look up subjects in the table below. Maintain a mapping of `{phase_key → task_id}` so you can update the correct task in STEP 3.

Look up the base subject and activeForm from this table:

| Phase Key | base subject | activeForm |
|-----------|---------|------------|
| `00-quick-scan` | Quick scan codebase (Phase 00) | Scanning codebase |
| `01-requirements` | Capture requirements (Phase 01) | Capturing requirements |
| `02-tracing` | Trace bug root cause (Phase 02) | Tracing bug root cause |
| `02-impact-analysis` | Analyze impact (Phase 02) | Analyzing impact |
| `03-architecture` | Design architecture (Phase 03) | Designing architecture |
| `04-design` | Create design specifications (Phase 04) | Creating design specifications |
| `05-test-strategy` | Design test strategy (Phase 05) | Designing test strategy |
| `06-implementation` | Implement features (Phase 06) | Implementing features |
| `16-quality-loop` | Run parallel quality loop (Phase 16) | Running quality loop |
| `11-local-testing` | Build and launch local environment (Phase 11) | Building local environment |
| `07-testing` | Run integration and E2E tests (Phase 07) | Running integration tests |
| `08-code-review` | Perform code review and QA (Phase 08) | Performing code review |
| `15-upgrade-plan` | Analyze upgrade impact and generate plan (Phase 15) | Analyzing upgrade impact |
| `15-upgrade-execute` | Execute upgrade with regression testing (Phase 15) | Executing upgrade |

**Subject format**: `[N] {base subject}` — e.g. `[1] Capture requirements (Phase 01)`, `[2] Analyze impact (Phase 02)`

For `description`, use: `"Phase {NN} of {workflow_type} workflow"`

**Mark Phase 01's task as completed with strikethrough** immediately (it already passed in Step 1). Update both `status` to `completed` AND `subject` to `~~[1] {base subject}~~` (markdown strikethrough).

The user now sees the full task list in their terminal with sequential numbering.

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

**3c-prime.** PRE-DELEGATION STATE UPDATE — Write phase activation to `state.json` BEFORE delegating to the phase agent. This ensures hooks see the correct state when the agent starts executing.

Using the `state.json` already read in step 3b, update the following fields:

1. Set `phases[phase_key].status` = `"in_progress"`
2. Set `phases[phase_key].started` = current ISO-8601 timestamp (only if not already set — preserve existing start time on retries)
3. Set `active_workflow.current_phase` = `phase_key`
4. Set `active_workflow.phase_status[phase_key]` = `"in_progress"`
5. Set top-level `current_phase` = `phase_key`
6. Set top-level `active_agent` = agent name (resolved from PHASE_AGENT_MAP below)
7. Write `.isdlc/state.json`

**3d.** DIRECT PHASE DELEGATION — Bypass the orchestrator and delegate directly to the phase agent.

Look up the agent for this phase from the PHASE→AGENT table:

| Phase Key | Agent (`subagent_type`) |
|-----------|------------------------|
| `00-quick-scan` | `quick-scan-agent` |
| `01-requirements` | `requirements-analyst` |
| `02-impact-analysis` | `impact-analysis-orchestrator` |
| `02-tracing` | `tracing-orchestrator` |
| `03-architecture` | `solution-architect` |
| `04-design` | `system-designer` |
| `05-test-strategy` | `test-design-engineer` |
| `06-implementation` | `software-developer` |
| `07-testing` | `integration-tester` |
| `08-code-review` | `qa-engineer` |
| `09-validation` | `security-compliance-auditor` |
| `10-cicd` | `cicd-engineer` |
| `11-local-testing` | `environment-builder` |
| `12-remote-build` | `environment-builder` |
| `12-test-deploy` | `deployment-engineer-staging` |
| `13-production` | `release-manager` |
| `14-operations` | `site-reliability-engineer` |
| `15-upgrade-plan` | `upgrade-engineer` |
| `15-upgrade-execute` | `upgrade-engineer` |
| `16-quality-loop` | `quality-loop-engineer` |

Read `agent_modifiers` for this phase from `.isdlc/state.json` → `active_workflow.type`, then look up the workflow in `workflows.json` → `workflows[type].agent_modifiers[phase_key]`. If modifiers exist, include them as `WORKFLOW MODIFIERS: {json}` in the prompt.

**Discovery context** (phases 02 and 03 only): If `phase_key` starts with `02-` or `03-`, read `.isdlc/state.json` → `discovery_context`. If it exists and `completed_at` is within 24 hours, include as a `DISCOVERY CONTEXT` block. If older than 24h, include with a `⚠️ STALE` warning. Otherwise omit.

```
Use Task tool → {agent_name} with:
  "Execute Phase {NN} - {Phase Name} for {workflow_type} workflow.
   Artifact folder: {artifact_folder}
   Phase key: {phase_key}
   {WORKFLOW MODIFIERS: {json} — if applicable}
   {DISCOVERY CONTEXT: ... — if phase 02 or 03}
   Validate GATE-{NN} on completion."
```

**3e.** POST-PHASE STATE UPDATE — After the phase agent returns successfully:
1. Read `.isdlc/state.json`
2. Set `phases[phase_key].status` = `"completed"`
3. Set `phases[phase_key].summary` = (extract from agent result, max 150 chars)
4. Set `active_workflow.current_phase_index` += 1
5. Set `active_workflow.phase_status[phase_key]` = `"completed"` (BUG-0005: sync phase_status map)
6. If more phases remain: (BUG-0006: next-phase activation moved to STEP 3c-prime at start of next iteration)
   - No action needed here — the next iteration's STEP 3c-prime handles phase activation
7. Write `.isdlc/state.json`
8. Update `docs/isdlc/tasks.md` (if it exists):
   - Find the completed phase section header (e.g., `## Phase NN: ... -- PENDING` or `-- IN PROGRESS`)
   - Change section header status to `-- COMPLETE`
   - Change all `- [ ] TNNNN ...` to `- [X] TNNNN ...` within that section (preserve pipe annotations like `| traces: AC-03a`)
   - Recalculate the Progress Summary table: update completed task counts per phase, total count, and percentage
   - Write the updated `docs/isdlc/tasks.md`
   - If `docs/isdlc/tasks.md` does not exist, skip this step silently

**PHASE_AGENT_MAP** (for STEP 3c-prime `active_agent` resolution):
```
01-requirements → requirements-analyst
02-tracing → trace-analyst
02-impact-analysis → impact-analyst
03-architecture → solution-architect
04-design → software-designer
05-test-strategy → test-design-engineer
06-implementation → software-developer
07-testing → quality-assurance-engineer
08-code-review → code-reviewer
09-security → security-engineer
10-local-testing → quality-assurance-engineer
16-quality-loop → quality-assurance-engineer
11-deployment → release-engineer
12-test-deploy → release-engineer
13-production → release-engineer
```

**3e-review.** SUPERVISED REVIEW GATE (conditional) -- After the post-phase
state update, check if a supervised review gate should fire.

**Gate trigger check**:
1. Read `supervised_mode` from state.json (already loaded in 3e)
2. Call `readSupervisedModeConfig(state)` (from common.cjs via inline logic)
   - If `config.enabled` is `false`: skip to 3e-sizing (no review gate)
3. Call `shouldReviewPhase(config, phase_key)`
   - If `false`: skip to 3e-sizing (this phase not in review_phases)
4. Call `generatePhaseSummary(state, phase_key, projectRoot, { minimal: !config.parallel_summary })`
   - Store the returned `summaryPath`
   - If `null` (generation failed): log warning, skip to 3e-sizing (fail-open)
5. Initialize `supervised_review` in state (if not already set for this phase):
   ```json
   {
     "phase": "{phase_key}",
     "status": "gate_presented",
     "paused_at": null,
     "resumed_at": null,
     "redo_count": 0,
     "redo_guidance_history": []
   }
   ```
   Write to `active_workflow.supervised_review` in state.json.

**REVIEW_LOOP**:
6. Determine menu options:
   a. Read `supervised_review.redo_count` from state
   b. If `redo_count >= 3`:
      - options = `[C] Continue`, `[R] Review`
   c. Else:
      - options = `[C] Continue`, `[R] Review`, `[D] Redo`

7. Present review gate banner and wait for user response:
   ```
   --------------------------------------------
   PHASE {NN} COMPLETE: {Phase Name}

   Summary: {summaryPath}
   Artifacts: {artifact_count} files created/modified
   Duration: {duration}

   [C] Continue -- advance to next phase
   [R] Review -- pause for manual review/edits, resume when ready
   [D] Redo -- re-run this phase with additional guidance

   Your choice: _
   --------------------------------------------
   ```

   Use `AskUserQuestion` to collect the user's response.

8. Handle user response:

   **CASE [C] Continue**:
   a. Call `recordReviewAction(state, phase_key, 'continue', { timestamp: now })`
   b. Delete `active_workflow.supervised_review` from state
   c. Write state.json
   d. PROCEED to 3e-sizing

   **CASE [R] Review**:
   a. Display the summary content inline (read the summary file and display it)
   b. Display instructions:
      "Review the artifacts listed above. Edit any files as needed.
       When ready, say 'continue' to advance to the next phase."
   c. Set `active_workflow.supervised_review.status` = `"reviewing"`
   d. Set `active_workflow.supervised_review.paused_at` = current timestamp
   e. Write state.json
   f. WAIT for user input (use `AskUserQuestion` with freeform text prompt)
   g. On user response (any confirmation like "continue", "done", "yes", "ok"):
      i.   Set `supervised_review.status` = `"completed"`
      ii.  Set `supervised_review.resumed_at` = current timestamp
      iii. Call `recordReviewAction(state, phase_key, 'review',
            { paused_at: supervised_review.paused_at, resumed_at: supervised_review.resumed_at })`
      iv.  Delete `active_workflow.supervised_review` from state
      v.   Write state.json
      vi.  PROCEED to 3e-sizing

   **CASE [D] Redo**:
   a. Prompt: "What additional guidance should this phase consider?"
   b. Capture guidance text from user (use `AskUserQuestion`)
   c. Read current `supervised_review.redo_count` from state
   d. Increment `supervised_review.redo_count` by 1
   e. Append guidance to `supervised_review.redo_guidance_history`
   f. Set `supervised_review.status` = `"redo_pending"`
   g. Write state.json
   h. Reset phase state for re-delegation:
      i.  Set `phases[phase_key].status` = `"in_progress"`
      ii. Set `active_workflow.phase_status[phase_key]` = `"in_progress"`
      iii. Write state.json
   i. Re-delegate to the same phase agent (same pattern as STEP 3d):
      - Use the PHASE-AGENT table from STEP 3d
      - Append to the original delegation prompt:
        `"\nREDO GUIDANCE: {guidance text}"`
   j. On return, re-execute STEP 3e logic:
      - Set `phases[phase_key].status` = `"completed"`
      - Set `phases[phase_key].summary` = (extract from agent result)
      - Set `active_workflow.phase_status[phase_key]` = `"completed"`
      - Write state.json
   k. Call `recordReviewAction(state, phase_key, 'redo',
        { redo_count: supervised_review.redo_count, guidance: guidance_text, timestamp: now })`
   l. Re-generate summary:
      - Call `generatePhaseSummary(state, phase_key, projectRoot, { minimal: !config.parallel_summary })`
      - Update summaryPath
   m. GOTO REVIEW_LOOP (step 6)

**3e-sizing.** SIZING DECISION POINT (conditional) -- After the post-phase
state update, check if adaptive workflow sizing should run.

**Trigger check**:
1. Read the phase key that was just completed from the state update in 3e
2. If `phase_key === '02-impact-analysis'` AND `active_workflow.type === 'feature'`:
   a. Read `active_workflow.sizing` from state.json
   b. If `sizing` is already set (not undefined/null): skip to 3e-refine (prevent double-sizing)
   c. If `sizing` is not set: execute sizing flow (below)
3. Otherwise (not Phase 02, or not feature workflow): skip to 3e-refine

**Sizing flow**:

**S1.** Read configuration:
   - Read `active_workflow.flags.light` from state.json
   - Read `workflows.json` -> `workflows.feature.sizing`
   - If `sizing.enabled` is falsy or `sizing` block is missing: skip sizing entirely (default to standard, no UX prompt). Write sizing record: `{ intensity: 'standard', effective_intensity: 'standard', recommended_by: 'framework', overridden: false, decided_at: <now>, forced_by_flag: false, epic_deferred: false }`. Write state.json, then skip to 3e-refine.

**S2.** IF `-light` flag is set (`active_workflow.flags.light === true`):
   a. Call `applySizingDecision(state, 'light', { forced_by_flag: true, config: sizingConfig })`
      where `sizingConfig` = `{ light_skip_phases: workflows.feature.sizing.light_skip_phases }`
   b. Write state.json
   c. Display forced-light banner:
      ```
      +----------------------------------------------------------+
      |  WORKFLOW SIZING: Light (forced via -light flag)          |
      |                                                           |
      |  Skipping phases:                                         |
      |    - Phase 03: Architecture                               |
      |    - Phase 04: Design                                     |
      |                                                           |
      |  Workflow: 00 -> 01 -> 02 -> 05 -> 06 -> 16 -> 08       |
      +----------------------------------------------------------+
      ```
   d. Update task list: find tasks for skipped phases, mark as completed with subject `~~[N] {subject} (Skipped -- light workflow)~~`
   e. Skip to 3e-refine

**S3.** ELSE (standard sizing flow):
   a. Read impact-analysis.md:
      - Path: `docs/requirements/{artifact_folder}/impact-analysis.md`
      - If file not found: default to standard, log warning, write sizing record, skip to 3e-refine
   b. Call `parseSizingFromImpactAnalysis(content)`
      - If returns null: default to standard with rationale "Unable to parse impact analysis", write sizing record, skip to 3e-refine
   c. Read thresholds: `workflows.json` -> `workflows.feature.sizing.thresholds`
      - If missing: use defaults `{ light_max_files: 5, epic_min_files: 20 }`
   d. Call `computeSizingRecommendation(metrics, thresholds)`
   e. Display sizing recommendation banner:
      ```
      +----------------------------------------------------------+
      |  WORKFLOW SIZING RECOMMENDATION                           |
      |                                                           |
      |  Recommended: {INTENSITY}                                 |
      |  Rationale: {rationale text}                              |
      |                                                           |
      |  Impact Analysis Summary:                                 |
      |    Files affected:  {N}                                   |
      |    Modules:         {N}                                   |
      |    Risk level:      {level}                               |
      |    Coupling:        {level}                               |
      |    Coverage gaps:   {N}                                   |
      +----------------------------------------------------------+
      ```
   f. Present user menu using `AskUserQuestion`:
      - `[A] Accept recommendation`
      - `[O] Override (choose different intensity)`
      - `[S] Show full impact analysis`
   g. Handle user choice:
      - **[A] Accept**:
        - If intensity is 'epic': inform user that epic is deferred, proceeding with standard
        - Call `applySizingDecision(state, recommendation.intensity, { metrics, config: sizingConfig })`
      - **[O] Override**:
        - Present intensity picker: `[1] Light  [2] Standard  [3] Epic`
        - Call `applySizingDecision(state, chosen, { metrics, overridden: true, overridden_to: chosen, recommended_intensity: recommendation.intensity, config: sizingConfig })`
      - **[S] Show analysis**:
        - Display full impact-analysis.md content
        - Return to menu (repeat step f)
   h. Write state.json
   i. If effective_intensity is 'light': update task list (mark skipped phase tasks as completed)
   j. Display applied sizing confirmation banner
   k. Proceed to 3e-refine

**3e-refine.** TASK REFINEMENT (conditional) — After the post-phase state update, check if task refinement should run:

**Trigger check**:
1. Read the phase key that was just completed from the state update in 3e
2. If `phase_key === '04-design'`:
   a. Check if `active_workflow.phases` includes `'06-implementation'`
   b. Check if `active_workflow.refinement_completed` is NOT `true`
   c. If BOTH true: execute refinement (below)
   d. If either false: skip to 3f

**Refinement execution**:
1. Read `active_workflow.artifact_folder` from state.json
2. Set `artifact_path` = `docs/requirements/{artifact_folder}`
3. Read design artifacts:
   - `{artifact_path}/module-design-*.md` (all module design files)
   - `{artifact_path}/interface-spec.yaml` or `{artifact_path}/interface-spec.md` (if exists)
   - `{artifact_path}/component-spec.md` (if exists)
4. Read `{artifact_path}/requirements-spec.md` for REQ/AC cross-reference
5. Read `docs/isdlc/tasks.md` (current plan)
6. Execute the refinement algorithm:
   a. Parse tasks.md: extract Phase 06 section tasks (preserve Phase 01-05, 07+ verbatim)
   b. Read design artifacts: build a map of { module -> files -> functions/exports }
   c. Read requirements-spec.md: build a map of { REQ-NNN -> [AC-NNx, ...] }
   d. For each Phase 06 high-level task:
      - Identify which design modules it maps to
      - Identify which files need CREATE or MODIFY
      - Identify which REQ/AC the files fulfill
      - Generate one task per logical unit of work (one file or tightly coupled file group)
      - Assign new TNNNN IDs (continuing from last ID in tasks.md)
      - Add `| traces:` annotations linking to REQ/AC
      - Add `files:` sub-lines with file paths and CREATE/MODIFY
   e. Compute dependencies:
      - If file B imports from file A, the task for B is `blocked_by` the task for A
      - If module X depends on module Y, tasks for X are `blocked_by` tasks for Y
      - Add `blocked_by:` and `blocks:` sub-lines
   f. Validate acyclicity: trace all dependency chains, confirm no task depends on itself transitively
   g. Compute critical path: find longest dependency chain
   h. Generate Dependency Graph section with critical path
   i. Re-compute Traceability Matrix with refined tasks
7. Write updated `docs/isdlc/tasks.md`
8. Write `{artifact_path}/task-refinement-log.md`
9. Set `active_workflow.refinement_completed = true` in state.json
10. Display refinement summary to user:

```
+----------------------------------------------------------+
|  TASK REFINEMENT COMPLETE                                 |
|                                                           |
|  Phase 06 tasks refined: {N} high-level -> {M} file-level|
|  Dependencies added: {D} edges                           |
|  Critical path length: {L} tasks                         |
|  Traceability: {T}% AC coverage                          |
|  Details: {artifact_path}/task-refinement-log.md          |
+----------------------------------------------------------+
```

**Fallback**: If no design artifacts are found, skip refinement silently. Phase 06 tasks remain high-level. The software-developer agent will self-decompose work as it does today.

**3f.** On return, check the result status:
- `"passed"` or successful completion → Mark task as `completed` **with strikethrough**: update both `status` to `completed` AND `subject` to `~~[N] {base subject}~~` (wrap the original `[N] subject` in `~~`). Continue to next phase.
- `"blocked_by_hook"` → Display blocker banner (same format as 3c), use `AskUserQuestion` for Retry/Skip/Cancel
- Any other error → Display error, use `AskUserQuestion` for Retry/Skip/Cancel

#### STEP 4: FINALIZE — Complete the workflow

After all phases complete:

```
Use Task tool → sdlc-orchestrator with:
  MODE: finalize
  (include MONOREPO CONTEXT if applicable)
```

The orchestrator runs the Human Review Checkpoint (if code_review.enabled), merges the branch, and then performs a **non-blocking Jira status sync** if `active_workflow.jira_ticket_id` exists:
- Calls `updateStatus(jira_ticket_id, "Done")` via Atlassian MCP to transition the Jira ticket
- Updates `BACKLOG.md`: marks item `[x]`, moves to `## Completed` section
- Sets `jira_sync_status` in `workflow_history` (`"synced"`, `"failed"`, or absent for local-only)
- Any Jira sync failure logs a warning but does **not** block workflow completion (non-blocking)

After Jira sync, the orchestrator collects workflow progress snapshots (`collectPhaseSnapshots()`), applies state pruning, moves the workflow to `workflow_history` (with `phases`, `phase_snapshots`, and `metrics`), and clears `active_workflow`.

**CRITICAL — MANDATORY CLEANUP (must execute even if finalize output is long):**

After the orchestrator returns from finalize, execute this cleanup loop immediately:

1. Call `TaskList` to retrieve ALL tasks in the session
2. For EACH task returned by TaskList:
   a. If task `status` is `pending` or `in_progress`:
      - Call `TaskUpdate` with `status: "completed"`
      - If the task `subject` does NOT already start with `~~`, update `subject` to `~~{current_subject}~~`
3. This loop processes ALL tasks (workflow phase tasks AND sub-agent tasks) — do not attempt to filter or identify which tasks "belong" to the workflow. After finalize, every remaining non-completed task is stale by definition.
4. Do NOT exit the Phase-Loop Controller until this cleanup loop has completed.

#### Flow Summary

```
/isdlc (no args)    → Task → orchestrator → Interactive Menu → User Selection → Action
/isdlc feature      → Task → orchestrator → Backlog Picker (feature) → Phase-Loop Controller
/isdlc fix          → Task → orchestrator → Backlog Picker (fix) → Phase-Loop Controller
/isdlc feature ...  → Phase-Loop Controller (init → tasks → direct-agent-loop → finalize)
/isdlc fix ...      → Phase-Loop Controller (init → tasks → direct-agent-loop → finalize)
/isdlc test run     → Phase-Loop Controller (init → tasks → direct-agent-loop → finalize)
/isdlc test generate → Phase-Loop Controller (init → tasks → direct-agent-loop → finalize)
/isdlc upgrade ...  → Phase-Loop Controller (init → tasks → direct-agent-loop → finalize)
/isdlc cancel       → Task → orchestrator → Cancel active workflow
/isdlc status       → Task → orchestrator → Show status
/isdlc <action>     → Task → orchestrator → Execute Action
```
