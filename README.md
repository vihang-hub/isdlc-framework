<div align="center">

# iSDLC Framework

<h3><em>Structured AI-powered software development, from requirements to production.</em></h3>

<p><strong>A comprehensive SDLC framework for Claude Code with 48 agents, 240 skills, 17 quality gates, and deterministic hook enforcement.</strong></p>

[![npm version](https://img.shields.io/npm/v/isdlc.svg)](https://www.npmjs.com/package/isdlc)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Agents](https://img.shields.io/badge/Agents-48-purple.svg)](docs/AGENTS.md)
[![Skills](https://img.shields.io/badge/Skills-240-green.svg)](docs/DETAILED-SKILL-ALLOCATION.md)
[![Gates](https://img.shields.io/badge/Quality%20Gates-17-orange.svg)](docs/ARCHITECTURE.md#quality-gates-17)
[![Hooks](https://img.shields.io/badge/Hooks-25-red.svg)](docs/ARCHITECTURE.md#hooks-25)

</div>

---

## What is iSDLC?

The iSDLC (integrated Software Development Lifecycle) framework provides **48 specialized AI agents** that guide software development from requirements through production:

- **16 SDLC agents** — 1 orchestrator + 15 phase agents (requirements → operations → upgrades + quality loop)
- **23 Discover agents** — analyze existing projects (with behavior extraction & AC generation) or elicit vision for new ones (with inception party debate rounds)
- **5 Exploration agents** — 1 quick scan (Phase 00) + 4 impact analysis (Phase 02 for features)
- **4 Tracing agents** — trace bug root causes (Phase 02 for bugs)

The framework installs **into your existing project**, providing structured multi-agent workflows, quality gates between every phase, and 25 deterministic hooks that enforce iteration requirements at runtime.

**Key principles**: Clear ownership (one agent per phase), deterministic hook enforcement, quality gates at every boundary, artifact traceability, and adaptive workflows.

**Licensing**: This framework is **free and open source** (MIT License). You provide your own LLM access via a Claude Code subscription.

> [Full agent documentation](docs/AGENTS.md) | [System architecture](docs/ARCHITECTURE.md)

---

## Getting Started

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | 18+ | Required for hooks and CLI |
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

The installer runs a 6-step process: detect project type → check for monorepo → confirm installation → copy framework files (48 agents, 240 skills, 25 hooks, settings) → set up `.isdlc/` state directory → generate docs structure. See [Installation Flow](docs/ARCHITECTURE.md#installation-flow) for details.

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

AI coding assistants are powerful but have well-known failure modes. The iSDLC framework addresses nine specific challenges through structural enforcement — hooks, gates, agents, and configuration files that constrain AI behavior deterministically rather than relying on prompt instructions alone.

### 1. Knowledge & Skills of Existing Projects

**The problem**: AI assistants start every session with zero knowledge of your codebase. They guess at architecture, reinvent existing patterns, and propose changes that conflict with established conventions.

**How iSDLC solves it**:
- `/discover` runs 23 specialized agents that map architecture, test coverage, dependencies, and feature inventory
- Discovery results are persisted as structured artifacts (constitution, architecture report, test evaluation, feature map)
- The orchestrator injects **DISCOVERY CONTEXT** into Phases 01-03 delegation prompts, so downstream agents inherit project knowledge
- The `--existing` flag triggers behavior extraction and characterization test generation for legacy code
- Discovery context includes "DO NOT REDESIGN" constraints — agents extend existing patterns rather than proposing rewrites

> *Mechanism*: `discover-orchestrator.md` (23 agents), orchestrator DISCOVERY CONTEXT blocks, `--deep` / `--atdd-ready` flags

### 2. Hallucination

**The problem**: AI models fabricate APIs, invent non-existent libraries, generate code that references undefined variables, and make up facts about your system.

**How iSDLC solves it**:
- The **Project Constitution** (generated during `/discover`) codifies real patterns, dependencies, and constraints as ground truth
- `constitution-validator.cjs` intercepts phase completion attempts and blocks advancement until artifacts are validated against constitutional articles
- Article I (Specification Primacy) ensures code serves specifications, not the other way around
- Article VII (Artifact Traceability) requires every output to trace back to a documented input
- Discovery constraints provide verified architecture facts, so agents don't need to guess

> *Mechanism*: `constitution-validator.cjs`, `docs/isdlc/constitution.md`, Articles I & VII

### 3. Context Rot

**The problem**: As conversations grow long, AI assistants lose track of earlier decisions. Requirements from the beginning of a session get contradicted by implementation at the end. Across sessions, all context is lost entirely.

**How iSDLC solves it**:
- `.isdlc/state.json` persists workflow state, phase progress, iteration counters, and active agent across sessions
- Each phase produces typed artifacts (requirements spec, architecture doc, test strategy) that become inputs to the next phase
- The constitution provides continuity — governance rules survive session boundaries
- Phase-based handoff means each agent receives only the artifacts it needs, not the full conversation history

> *Mechanism*: `.isdlc/state.json`, phase artifact directories (`.isdlc/phases/`), constitution enforcement

### 4. Incomplete Prompts / Context Gaps

**The problem**: Users provide incomplete descriptions — missing edge cases, unstated assumptions, vague acceptance criteria. AI assistants fill gaps with guesses rather than asking.

**How iSDLC solves it**:
- `/discover` for existing projects runs D7 (Dependency Mapper) and D8 (Convention Detector) to capture implicit knowledge
- Phase 01 (Requirements Analyst) uses interactive A/R/C elicitation — presenting menus where the user can **A**djust, **R**efine, or **C**ontinue
- `menu-tracker.cjs` tracks elicitation progress and requires a minimum of 3 menu interactions before allowing phase advancement
- Bug reports include a **sufficiency check** — the requirements analyst validates expected behavior, actual behavior, and reproduction steps, with up to 2 follow-up prompts
- For greenfield projects, discover agents (D7, D8) elicit tech stack preferences and architectural constraints interactively

> *Mechanism*: `menu-tracker.cjs` (min 3 interactions), bug sufficiency check in `01-requirements-analyst.md`, A/R/C menus

### 5. Missing Traceability

**The problem**: AI-generated code has no audit trail. You can't trace a line of code back to the requirement that justified it, or verify that all acceptance criteria have test coverage.

**How iSDLC solves it**:
- Article VII (Artifact Traceability) in the constitution mandates that every artifact references its source
- Each phase produces typed artifacts with explicit input/output relationships (requirements → architecture → design → tests → code)
- Gate validation checks that required artifacts exist and reference their predecessors
- The test design phase produces `ac-traceability.csv` mapping acceptance criteria → test cases → implementation files
- `gate-blocker.cjs` blocks phase advancement unless traceability artifacts are present

> *Mechanism*: Article VII, `ac-traceability.csv`, `gate-blocker.cjs` artifact validation, typed phase artifacts

### 6. Deviation from Instructions

**The problem**: AI assistants drift from instructions over time — they skip steps, take shortcuts, ignore constraints mentioned earlier in the conversation, or escape iteration loops when stuck.

**How iSDLC solves it**:
- `iteration-corridor.cjs` enforces TEST and CONST corridors — when tests are failing, the agent can only fix code and re-run tests (no delegation, no gate advancement)
- `gate-blocker.cjs` performs 4 checks before allowing phase advancement: iteration requirements, workflow validation, phase sequencing, and agent delegation verification
- `constitution-validator.cjs` blocks phase completion until constitutional compliance is verified
- All 25 hooks run as separate Node.js processes outside the LLM context — the AI cannot override, ignore, or negotiate with them

> *Mechanism*: `iteration-corridor.cjs` (TEST/CONST corridors), `gate-blocker.cjs` (4 checks), `constitution-validator.cjs`

### 7. Poor Quality / Incomplete Output

**The problem**: AI assistants declare tasks "done" prematurely — tests don't pass, coverage is below threshold, edge cases are missing, and there's no systematic quality validation.

**How iSDLC solves it**:
- **17 quality gates** between every phase, each with specific requirements (artifacts, tests, coverage)
- **Quality Loop** (Phase 16) runs parallel testing and automated QA in feature/fix workflows, replacing sequential test/CI phases
- `test-watcher.cjs` monitors test executions, tracks up to 10 iterations per phase, and enforces 80% coverage minimum
- **Circuit breaker**: 3 identical test failures in a row triggers an automatic stop — the agent cannot continue making the same mistake
- When iteration limits are exceeded, the system **escalates to a human** rather than allowing the agent to proceed
- Gate failures require remediation — they cannot be skipped or waived

> *Mechanism*: `test-watcher.cjs` (10 iterations, 80% coverage, circuit breaker at 3), `gate-blocker.cjs`, human escalation

### 8. Inconsistent Implementation

**The problem**: Different parts of the same feature get implemented in contradictory ways. The architecture says REST but the code uses GraphQL. The design specifies PostgreSQL but the implementation creates SQLite tables.

**How iSDLC solves it**:
- **1-to-1 agent-phase mapping** — each phase has exactly one agent with clear responsibilities, preventing overlapping decisions
- `workflows.json` defines the exact phase sequence for each workflow type (feature, fix, test, upgrade), ensuring consistent progression
- Discovery context includes "DO NOT REDESIGN" constraints — when agents in Phases 01-03 receive discovery results, they extend existing patterns rather than proposing alternatives
- Phase artifacts are inputs to subsequent phases — the architect's decisions constrain the designer, whose decisions constrain the developer

> *Mechanism*: 1-to-1 agent-phase mapping, `workflows.json`, discovery "DO NOT REDESIGN" constraint table

### 9. Deterministic Behavior

**The problem**: AI behavior is inherently non-deterministic. The same prompt can produce different results. Prompt-based constraints can be ignored, reinterpreted, or forgotten as context grows.

**How iSDLC solves it**:
- All 25 hooks run as **separate Node.js processes** — they are not part of the LLM conversation and cannot be influenced by prompt injection
- Hooks intercept tool calls via Claude Code's `PreToolUse` and `PostToolUse` events and enforce rules by reading `state.json` and configuration files
- **Fail-open safety**: if a hook crashes or times out, it allows the operation to proceed rather than blocking all work
- State-driven enforcement means behavior depends on `.isdlc/state.json` and config files, not on conversation history
- Hook registration is defined in `.claude/settings.json` — the framework's behavior is code, not prompts

> *Mechanism*: 25 hooks as Node.js processes, `.claude/settings.json` registration, `.isdlc/state.json` state-driven enforcement, fail-open design

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
- 48 agents, 240 skills, 17 gates, 25 hooks
- Project Constitution, Adaptive Workflow, Autonomous Iteration
- Skill Observability, Deterministic Hooks, Monorepo Support
- Task Planning, Phase 00 Exploration Mode, Multi-Provider LLM Support
- **Cross-platform npm package** with auto-update notifications

**In Progress**: Integration testing, real project validation

**Planned**: Agent metrics, workflow visualization, portfolio dashboard

---

## System Requirements

- **Node.js 18+** (required)
- **Claude Code** (CLI tool from Anthropic)
- **macOS, Linux, or Windows** (all platforms supported)

---

## Contributing

This framework is under active development. Contributions, feedback, and suggestions are welcome.

## License

MIT License

---

<div align="center">

**iSDLC Framework** v0.1.0-alpha — 48 agents, 240 skills, 17 gates, 25 hooks, cross-platform npm package

</div>
