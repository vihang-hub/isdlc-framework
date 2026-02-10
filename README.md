<div align="center">

# iSDLC Framework

<h3><em>Structured AI-powered software development, from requirements to production.</em></h3>

<p><strong>A comprehensive SDLC framework for Claude Code with 48 agents, 240 skills, quality gates at every phase boundary, and 26 deterministic enforcement hooks.</strong></p>

[![npm version](https://img.shields.io/npm/v/isdlc.svg)](https://www.npmjs.com/package/isdlc)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Agents](https://img.shields.io/badge/Agents-48-purple.svg)](docs/AGENTS.md)
[![Skills](https://img.shields.io/badge/Skills-240-green.svg)](docs/DETAILED-SKILL-ALLOCATION.md)
[![Gates](https://img.shields.io/badge/Quality%20Gates-21-orange.svg)](docs/ARCHITECTURE.md#quality-gates)
[![Hooks](https://img.shields.io/badge/Hooks-26-red.svg)](docs/ARCHITECTURE.md#hooks-26)

</div>

---

## What is iSDLC?

The iSDLC (integrated Software Development Lifecycle) framework provides **48 specialized AI agents** that guide software development from requirements through production:

- **16 SDLC agents** — 1 orchestrator + 15 phase agents (requirements → operations → upgrades + quality loop)
- **23 Discover agents** — 1 orchestrator + 22 sub-agents that analyze existing projects (with behavior extraction & AC generation) or elicit vision for new ones (with inception party debate rounds)
- **5 Exploration agents** — 1 quick scan (Phase 00) + 4 impact analysis (Phase 02 for features)
- **4 Tracing agents** — trace bug root causes (Phase 02 for bugs)

The framework installs **into your existing project**, providing structured multi-agent workflows, quality gates between every phase, and 26 deterministic hooks that enforce iteration requirements at runtime.

**Key principles**: Clear ownership (one agent per phase), deterministic hook enforcement, quality gates at every boundary, artifact traceability, and adaptive workflows.

**Licensing**: This framework is **free and open source** (MIT License). You provide your own LLM access via a Claude Code subscription.

> [Full agent documentation](docs/AGENTS.md) | [System architecture](docs/ARCHITECTURE.md)

---

## Getting Started

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | 20+ | Required for hooks and CLI |
| **Claude Code** | Latest | [Install guide](https://docs.anthropic.com/en/docs/claude-code/overview) |
| **LLM Provider** | Any | Free options available (see Step 2) |

### Step 1: Install the Framework

Choose one of three installation methods:

**Option 1: npx (recommended — no global install needed)**
```bash
cd /path/to/your-project
npx isdlc init
```

**Option 2: Global install (for frequent use)**
```bash
npm install -g isdlc
cd /path/to/your-project
isdlc init
```

**Option 3: Git clone (for development or customization)**
```bash
cd /path/to/your-project
git clone <repo-url> isdlc-framework
./isdlc-framework/install.sh
```

**Option 3b: Git clone on Windows (PowerShell)**
```powershell
cd C:\path\to\your-project
git clone <repo-url> isdlc-framework
.\isdlc-framework\install.ps1
```

If blocked by execution policy:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\isdlc-framework\install.ps1
```

Non-interactive (CI/CD):
```powershell
.\isdlc-framework\install.ps1 -Force
```

The installer runs a 6-step process: detect project type → check for monorepo → confirm installation → copy framework files (48 agents, 240 skills, 26 hooks, settings) → set up `.isdlc/` state directory → generate docs structure. See [Installation Flow](docs/ARCHITECTURE.md#installation-flow) for details.

### Step 2: Start Using the Framework

```bash
claude                                    # Start Claude Code
/discover                                 # Analyze project (or describe if new)
/isdlc feature "Add user authentication"   # Develop a feature end-to-end
```

The `/discover` command analyzes your project's architecture, test coverage, and patterns, then generates a tailored constitution (governance rules). For new projects, it elicits your vision through interactive prompts.

Once discovery is complete, `/isdlc` presents a context-aware menu based on your project state:

| Use Case | Command |
|----------|---------|
| **Analyze existing project** | `/discover` |
| **Develop new feature** | `/isdlc feature "description"` |
| **Fix a bug (TDD)** | `/isdlc fix "description"` |
| **Generate test suite** | `/isdlc test generate` |
| **Upgrade dependency** | `/isdlc upgrade "Node.js 22"` |
| **Full lifecycle** | `/isdlc start` |
<!-- | **Configure LLM provider** | `/provider` | -->

---

## How iSDLC Solves AI Development Challenges

AI coding assistants are powerful but have well-known failure modes. The iSDLC framework addresses eleven specific challenges through structural enforcement — 26 hooks, quality gates at every phase boundary, 48 agents, and configuration files that constrain AI behavior deterministically rather than relying on prompt instructions alone.

### 1. Enforcement Outside the LLM

**The problem**: Prompt-based constraints can be ignored, reinterpreted, or forgotten as context grows. AI behavior is inherently non-deterministic — the same prompt produces different results. No amount of instruction-tuning guarantees the AI will follow rules once the conversation is long enough.

**How iSDLC solves it**:
- All 26 hooks run as **separate Node.js processes** — they intercept tool calls via Claude Code's `PreToolUse` and `PostToolUse` events and are not part of the LLM conversation
- `iteration-corridor.cjs` enforces TEST and CONST corridors — when tests are failing, the agent can only fix code and re-run tests (no delegation, no gate advancement)
- `gate-blocker.cjs` performs 4 checks before allowing phase advancement: iteration requirements, workflow validation, phase sequencing, and agent delegation verification
- State-driven enforcement means behavior depends on `.isdlc/state.json` and config files, not on conversation history
- **Fail-open safety**: if a hook crashes or times out, it allows the operation to proceed rather than blocking all work

> *Mechanism*: 26 hooks as Node.js processes, `iteration-corridor.cjs` (TEST/CONST corridors), `gate-blocker.cjs` (4 checks), `.claude/settings.json` registration, fail-open design

### 2. Quality That Can't Be Skipped

**The problem**: AI assistants declare tasks "done" prematurely — tests don't pass, coverage is below threshold, edge cases are missing, and there's no systematic quality validation. The AI cannot be trusted to judge its own output.

**How iSDLC solves it**:
- **Quality gates at every phase boundary** across 21 enforced phases, each with specific requirements (artifacts, tests, coverage)
- **Quality Loop** (Phase 16) runs parallel testing and automated QA in feature/fix workflows, replacing sequential test/CI phases
- `test-watcher.cjs` monitors test executions, tracks up to 10 iterations per phase, and enforces 80% coverage minimum
- **Circuit breaker**: 3 identical test failures in a row triggers an automatic stop — the agent cannot continue making the same mistake
- When iteration limits are exceeded, the system **escalates to a human** rather than allowing the agent to proceed
- Gate failures require remediation — they cannot be skipped or waived

> *Mechanism*: `test-watcher.cjs` (10 iterations, 80% coverage, circuit breaker at 3), `gate-blocker.cjs`, human escalation

### 3. Pick Up Where You Left Off

**The problem**: AI conversations are ephemeral. Close the terminal, hit a context limit, or step away for lunch — and all progress is lost. You restart from scratch every session.

**How iSDLC solves it**:
- `.isdlc/state.json` persists workflow state, phase progress, iteration counters, and active agent across sessions
- `workflow-completion-enforcer.cjs` detects when `active_workflow` is cleared and ensures the workflow completes cleanly
- Starting a new Claude Code session with an in-progress workflow resumes at the exact phase where you left off — no repeated work
- Each phase produces typed artifacts (requirements spec, architecture doc, test strategy) that survive session boundaries and become inputs to the next phase

> *Mechanism*: `.isdlc/state.json` persistence, `workflow-completion-enforcer.cjs`, phase artifact directories (`.isdlc/phases/`)

### 4. Scope Stays Contained

**The problem**: Ask an AI to fix a bug and it refactors three modules, upgrades a dependency, and rewrites the test suite. Scope creep is the default behavior — the AI optimizes for "helpful" rather than "focused."

**How iSDLC solves it**:
- `workflows.json` defines the exact phase sequence for each workflow type (feature, fix, test, upgrade) — the agent cannot invent extra steps
- Discovery context includes "DO NOT REDESIGN" constraints — agents extend existing patterns rather than proposing rewrites
- `phase-sequence-guard.cjs` blocks out-of-order phase execution — the agent cannot jump ahead or revisit completed phases
- Fix workflows are scoped to 6 phases (requirements → tracing → test strategy → implementation → quality loop → code review) with no architecture or design phases

> *Mechanism*: `workflows.json` (fixed phase sequences), `phase-sequence-guard.cjs`, "DO NOT REDESIGN" constraint table, workflow-specific phase lists

### 5. Knowledge of Your Codebase

**The problem**: AI assistants start every session with zero knowledge of your codebase. They guess at architecture, reinvent existing patterns, and propose changes that conflict with established conventions.

**How iSDLC solves it**:
- `/discover` runs 22 specialized agents that map architecture, test coverage, dependencies, and feature inventory
- Discovery results are persisted as structured artifacts (constitution, architecture report, test evaluation, feature map)
- The orchestrator injects **DISCOVERY CONTEXT** into Phases 01-03 delegation prompts, so downstream agents inherit project knowledge
- The `--existing` flag triggers behavior extraction and characterization test generation for legacy code

> *Mechanism*: `discover-orchestrator.md` (22 discover agents), orchestrator DISCOVERY CONTEXT injection, `--deep` / `--atdd-ready` flags

### 6. Self-Correcting, Not Self-Looping

**The problem**: When an AI gets stuck, it loops — retrying the same failing approach, generating variations of broken code, burning tokens without progress. It lacks the ability to recognize when it's stuck and change strategy.

**How iSDLC solves it**:
- **Circuit breaker** in `test-watcher.cjs`: 3 identical test failures trigger an automatic stop with human escalation
- **Iteration limits**: each phase has a configured maximum (typically 5-10 iterations) — exceeding the limit forces escalation rather than infinite retry
- `iteration-corridor.cjs` confines the agent to a "corridor" — when tests are failing, the agent can only edit code and re-run tests, nothing else
- Escalation rules are defined in `iteration-requirements.json`: circuit breaker → human review, max iterations exceeded → human review, timeout → human notification

> *Mechanism*: `test-watcher.cjs` (circuit breaker at 3), `iteration-corridor.cjs` (corridor confinement), `iteration-requirements.json` escalation rules

### 7. Context That Survives

**The problem**: As conversations grow long, AI assistants lose track of earlier decisions. Requirements from the beginning of a session get contradicted by implementation at the end. Across sessions, all context is lost entirely.

**How iSDLC solves it**:
- Phase-based handoff means each agent receives only the artifacts it needs, not the full conversation history — context is structured, not conversational
- The **Project Constitution** (generated during `/discover`) codifies governance rules that survive session boundaries
- `.isdlc/state.json` tracks which phases are complete, what artifacts exist, and where the workflow stands
- Each phase reads predecessor artifacts as input — the architect reads the requirements spec, the designer reads the architecture doc, the developer reads the design

> *Mechanism*: `.isdlc/state.json`, phase artifact chain, `docs/isdlc/constitution.md`, 1-to-1 agent-phase mapping

### 8. Architectural Coherence

**The problem**: The AI drifts from reality — it fabricates APIs, invents patterns your codebase doesn't use, and makes contradictory decisions across phases. The architecture says REST but the code uses GraphQL. The design specifies PostgreSQL but the implementation creates SQLite tables.

**How iSDLC solves it**:
- The **Project Constitution** codifies real patterns, dependencies, and constraints as ground truth — verified during `/discover`, not hallucinated
- `constitution-validator.cjs` intercepts phase completion attempts and blocks advancement until artifacts are validated against constitutional articles
- **1-to-1 agent-phase mapping** — each phase has exactly one agent with clear responsibilities, preventing overlapping decisions
- Phase artifacts are inputs to subsequent phases — the architect's decisions constrain the designer, whose decisions constrain the developer
- Article I (Specification Primacy) ensures code serves specifications, not the other way around

> *Mechanism*: `constitution-validator.cjs`, `docs/isdlc/constitution.md`, 1-to-1 agent-phase mapping, Article I (Specification Primacy)

### 9. Requirements Before Code

**The problem**: Users provide incomplete descriptions — missing edge cases, unstated assumptions, vague acceptance criteria. AI assistants fill gaps with guesses rather than asking, and jump straight to code.

**How iSDLC solves it**:
- Phase 01 (Requirements Analyst) uses interactive A/R/C elicitation — presenting menus where the user can **A**djust, **R**efine, or **C**ontinue
- `menu-tracker.cjs` tracks elicitation progress and requires a minimum of 3 menu interactions before allowing phase advancement
- Bug reports include a **sufficiency check** — the requirements analyst validates expected behavior, actual behavior, and reproduction steps
- `plan-surfacer.cjs` blocks delegation to implementation phases when the task plan hasn't been reviewed
- For existing projects, `/discover` captures implicit knowledge (dependencies, conventions, test patterns) so agents don't have to guess

> *Mechanism*: `menu-tracker.cjs` (min 3 interactions), `plan-surfacer.cjs`, bug sufficiency check in `01-requirements-analyst.md`, A/R/C menus

### 10. Traceability

**The problem**: AI-generated code has no audit trail. You can't trace a line of code back to the requirement that justified it, or verify that all acceptance criteria have test coverage.

**How iSDLC solves it**:
- Article VII (Artifact Traceability) in the constitution mandates that every artifact references its source
- Each phase produces typed artifacts with explicit input/output relationships (requirements → architecture → design → tests → code)
- The test design phase produces `ac-traceability.csv` mapping acceptance criteria → test cases → implementation files
- `gate-blocker.cjs` blocks phase advancement unless required artifacts are present

> *Mechanism*: Article VII, `ac-traceability.csv`, `gate-blocker.cjs` artifact validation, typed phase artifacts

### 11. Multi-Agent Coordination

**The problem**: Multi-agent systems are fragile — agents talk past each other, duplicate work, make contradictory decisions, and lack clear handoff protocols. Orchestrating 48 agents without chaos is a coordination problem, not just a prompting problem.

**How iSDLC solves it**:
- `workflows.json` defines fixed, non-skippable phase sequences for each workflow type — agents execute in a defined order, not in parallel free-for-all
- `delegation-gate.cjs` validates that the correct agent is delegated for each phase — the orchestrator cannot accidentally assign the wrong agent
- Phase 02 (Impact Analysis) and Phase 02 (Tracing) each orchestrate 3 parallel sub-agents with structured consolidation — parallelism is controlled, not ad-hoc
- `skill-delegation-enforcer.cjs` ensures skill invocations match the expected agent-phase pairing
- `no_halfway_entry` and `no_phase_skipping` rules in `workflows.json` prevent agents from entering workflows mid-stream

> *Mechanism*: `workflows.json` (fixed sequences), `delegation-gate.cjs`, `skill-delegation-enforcer.cjs`, parallel sub-agent orchestration (impact-analysis, tracing)

---

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, hooks, agents, state management, end-to-end flow |
| [AGENTS.md](docs/AGENTS.md) | All 48 agents with responsibilities and artifacts |
| [DETAILED-SKILL-ALLOCATION.md](docs/DETAILED-SKILL-ALLOCATION.md) | 240 skills organized by category |
| [CONSTITUTION-GUIDE.md](docs/CONSTITUTION-GUIDE.md) | Project governance principles |
| [MONOREPO-GUIDE.md](docs/MONOREPO-GUIDE.md) | Multi-project setup |
| [AUTONOMOUS-ITERATION.md](docs/AUTONOMOUS-ITERATION.md) | Self-correcting agent behavior |
| [SKILL-ENFORCEMENT.md](docs/SKILL-ENFORCEMENT.md) | Runtime skill observability |
<!-- | [MULTI-PROVIDER-SUPPORT-DESIGN.md](docs/designs/MULTI-PROVIDER-SUPPORT-DESIGN.md) | LLM provider configuration | -->

---

## Project Status

**Completed** (10 enhancements):
- 48 agents, 240 skills, 21 enforced phases, 26 hooks
- Project Constitution, Adaptive Workflow, Autonomous Iteration
- Skill Observability, Deterministic Hooks, Monorepo Support
- Task Planning, Phase 00 Exploration Mode, Multi-Provider LLM Support
- **Cross-platform npm package** with auto-update notifications

**In Progress**: Integration testing, real project validation

**Planned**: Agent metrics, workflow visualization, portfolio dashboard

---

## System Requirements

- **Node.js 20+** (required)
- **Claude Code** (CLI tool from Anthropic)
- **macOS, Linux, or Windows** (all platforms supported)

---

## Contributing

This framework is under active development. Contributions, feedback, and suggestions are welcome.

## License

MIT License

---

<div align="center">

**iSDLC Framework** v0.1.0-alpha — 48 agents, 240 skills, 21 enforced phases, 26 hooks, cross-platform npm package

</div>
