<div align="center">

# iSDLC Framework

<h3><em>Structured AI-powered software development, from requirements to production.</em></h3>

<p><strong>A comprehensive SDLC framework for Claude Code with 36 agents, 200 skills, 16 quality gates, and monorepo support.</strong></p>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Agents](https://img.shields.io/badge/Agents-36-purple.svg)](docs/AGENTS.md)
[![Skills](https://img.shields.io/badge/Skills-200-green.svg)](docs/DETAILED-SKILL-ALLOCATION.md)
[![Gates](https://img.shields.io/badge/Quality%20Gates-16-orange.svg)](#quality-gates)
[![Hooks](https://img.shields.io/badge/Hooks-5-red.svg)](#enforcement-hooks)

</div>

---

## What is iSDLC?

The iSDLC (integrated Software Development Lifecycle) framework provides **36 specialized AI agents** that guide software development from requirements through production:

- **15 SDLC agents** — 1 orchestrator + 14 phase agents (requirements → operations)
- **9 Discover agents** — analyze existing projects or elicit vision for new ones
- **8 Exploration agents** — 4 mapping (features) + 4 tracing (bugs) for Phase 00
- **4 Reverse Engineer agents** — extract acceptance criteria from existing code

The framework installs **into your existing project**, providing structured multi-agent workflows, quality gates between every phase, and standardized processes for AI-powered development.

**Key principles**: Clear ownership (one agent per phase), exclusive skill ownership, quality gates at every boundary, artifact traceability, and adaptive workflows.

→ [Full agent documentation](docs/AGENTS.md)

---

## Quick Start

### Installation

```bash
cd /path/to/your-project
git clone <repo-url> isdlc-framework
./isdlc-framework/install.sh
```

### Commands

| Use Case | Command |
|----------|---------|
| **Analyze existing project** | `/discover` |
| **Develop new feature** | `/sdlc feature "description"` |
| **Fix a bug (TDD)** | `/sdlc fix "description"` |
| **Generate test suite** | `/sdlc test generate` |
| **Upgrade dependency** | `/sdlc upgrade "Node.js 22"` |
| **Full lifecycle** | `/sdlc start` |
| **Configure LLM provider** | `/provider` |

### Example Workflows

**Existing application:**
```bash
claude                                    # Start Claude Code
/discover                                 # Analyze project, generate constitution
/sdlc feature "Add user authentication"   # Develop new feature
```

**New application:**
```bash
claude                                    # Start Claude Code
/discover                                 # Elicit vision, generate architecture
/sdlc feature "Build initial feature"     # Start building
```

---

## Core Features

### Quality Gates

16 quality gates enforce validation at every phase boundary:
- **Artifact validation** — Required outputs must exist and meet criteria
- **Constitutional compliance** — Agents validate against project principles
- **Hook enforcement** — Deterministic blocking until requirements met

Gates cannot be skipped. When iteration limits are exceeded, the system escalates to a human.

### Enforcement Hooks

Five hooks intercept tool calls and enforce iteration requirements:

| Hook | Purpose |
|------|---------|
| `gate-blocker.js` | Blocks gate advancement until requirements satisfied |
| `test-watcher.js` | Tracks test iterations, triggers circuit breaker |
| `constitution-validator.js` | Blocks until constitutional validation complete |
| `menu-tracker.js` | Tracks stakeholder elicitation progress |
| `model-provider-router.js` | Routes to appropriate LLM provider by phase |

### Multi-Provider LLM Support

Use different LLM providers based on your needs:

| Mode | Provider | Best For |
|------|----------|----------|
| `free` | Groq, Together AI, Google AI Studio | Learning, prototyping |
| `local` | Ollama | Privacy, offline, air-gapped |
| `quality` | Anthropic | Production, critical work |
| `hybrid` | Phase-aware routing | Balanced cost/quality |

```bash
/provider setup-ollama    # Automatic Ollama setup
/provider set free        # Use free cloud providers
/provider status          # Check provider health
```

→ [Multi-provider design](docs/designs/MULTI-PROVIDER-SUPPORT-DESIGN.md)

### Monorepo Support

Multiple projects can share a single framework installation:
- Auto-detection via workspace indicators
- Per-project isolation (state, counters, workflows)
- Shared agents, skills, hooks, and config

```bash
/sdlc feature "Add auth" --project api-service
/discover --project web-frontend
```

→ [Monorepo guide](docs/MONOREPO-GUIDE.md)

### Project Constitution

Customizable governance principles enforced at every quality gate:
- Test-First Development
- Security by Design
- Library-First Design
- Simplicity First

→ [Constitution guide](docs/CONSTITUTION-GUIDE.md)

---

## Documentation

| Document | Description |
|----------|-------------|
| [AGENTS.md](docs/AGENTS.md) | All 36 agents with responsibilities and artifacts |
| [DETAILED-SKILL-ALLOCATION.md](docs/DETAILED-SKILL-ALLOCATION.md) | 200 skills organized by category |
| [CONSTITUTION-GUIDE.md](docs/CONSTITUTION-GUIDE.md) | Project governance principles |
| [MONOREPO-GUIDE.md](docs/MONOREPO-GUIDE.md) | Multi-project setup |
| [AUTONOMOUS-ITERATION.md](docs/AUTONOMOUS-ITERATION.md) | Self-correcting agent behavior |
| [SKILL-ENFORCEMENT.md](docs/SKILL-ENFORCEMENT.md) | Runtime ownership validation |
| [MULTI-PROVIDER-SUPPORT-DESIGN.md](docs/designs/MULTI-PROVIDER-SUPPORT-DESIGN.md) | LLM provider configuration |

---

## Project Status

**Completed** (9 enhancements):
- 36 agents, 200 skills, 16 gates, 5 hooks
- Project Constitution, Adaptive Workflow, Autonomous Iteration
- Skill Enforcement, Deterministic Hooks, Monorepo Support
- Task Planning, Phase 00 Exploration Mode, Multi-Provider LLM Support

**In Progress**: Integration testing, real project validation

**Planned**: Agent metrics, workflow visualization, portfolio dashboard

---

## Contributing

This framework is under active development. Contributions, feedback, and suggestions are welcome.

## License

MIT License

---

<div align="center">

**iSDLC Framework** v2.4.0 — 36 agents, 200 skills, 16 gates, 5 hooks, 9 enhancements

</div>
