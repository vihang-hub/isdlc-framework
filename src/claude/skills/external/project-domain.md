---
name: project-domain
description: Distilled project domain -- terminology, business rules, feature catalog
skill_id: PROJ-003
owner: discover-orchestrator
collaborators: []
project: isdlc-framework
version: 1.0.0
when_to_use: When understanding business context, writing requirements, or naming domain concepts
dependencies: []
---

# Project Domain

## Domain Terminology
| Term | Definition |
|------|-----------|
| Agent | A markdown-defined AI specialist that owns one SDLC phase or discovery task |
| Skill | A reusable capability (SKILL.md) bound to agents via manifest |
| Hook | A CJS module that intercepts Claude Code tool calls (pre/post/stop/notification) |
| Phase | One step in an SDLC workflow (e.g., 01-requirements, 06-implementation) |
| Gate | A quality checkpoint that must pass before advancing to the next phase |
| Workflow | A sequence of phases (feature, fix, upgrade, test) |
| Contract | A JSON file defining required phases, artifacts, and gates for a workflow |
| Constitution | A set of immutable articles governing development standards |
| Profile | A gate intensity setting (rapid/standard/strict) |
| Roundtable | A multi-persona analysis session (business analyst + architect + designer) |
| Debate | A Creator -> Critic -> Refiner loop for artifact quality |
| Antigravity | Workflow automation scripts (init, finalize, validate, advance) |
| Bridge | A CJS wrapper that exposes ESM core modules to CJS hooks |
| Provider | An LLM backend adapter (Claude Code or Codex) |
| Projection | A bundled artifact generated for Codex consumption (AGENTS.md) |
| Dispatcher | A hook that routes events to multiple sub-handlers |
| Iteration corridor | Enforced min/max iteration counts per phase |
| Circuit breaker | Stops iterations after N identical failures |

## Business Rules
- Single active workflow per project (no concurrent workflows, except --interrupt for fix)
- Phases execute sequentially; gate must pass before advancing
- Constitution articles are immutable once established
- Test count must never decrease without documented ADR justification
- Hooks fail-open unless security-critical; gates fail-closed
- All state writes validated against JSON schemas
- Dogfooding: changes to src/ must also update root .isdlc/ and .claude/
- Dual-provider: all features must work for both Claude Code and Codex

## Feature Catalog
| Feature | Domain | Description |
|---------|--------|-------------|
| Workflow Orchestration | Core | Phase-loop execution, gate validation, workflow init/finalize |
| Installation Lifecycle | CLI | Install/update/uninstall/doctor for target projects |
| Iteration Enforcement | Hooks | Min/max iterations, circuit breakers, test watching |
| Skill Management | Skills | Manifest bindings, injection planning, skill logging |
| Provider Routing | Providers | Dual-provider selection, model routing, runtime abstraction |
| Constitution Management | Governance | Article validation, constitutional checks, compliance |
| Monorepo Detection | State | Project detection, path resolution, state scoping |
| Agent Orchestration | Teams | Debate loops, fan-out, dual-track, roundtable analysis |
| Backlog Management | Backlog | Item resolution, GitHub sync, slug generation |
| Search | Search | Multi-backend code search with ranking |
| Embeddings | Embedding | CodeBERT chunking, encoding, and semantic search |
| Content Model | Content | Agent/skill/command/topic classification |
| Compliance | Validators | Contract evaluation, gate logic, traceability |

## Provenance
- **Source**: D6 feature mapping output, reverse-engineered acceptance criteria
- **Distilled**: 2026-03-28
- **Discovery run**: full
