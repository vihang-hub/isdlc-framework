# Technology Stack Decision: Fan-Out/Fan-In Parallelism

**REQ ID**: REQ-0017
**Phase**: 03-architecture
**Created**: 2026-02-15
**Author**: Solution Architect (Agent 03)

---

## Decision Context

The fan-out/fan-in parallelism feature operates entirely within the existing iSDLC technology stack. There are no new languages, frameworks, databases, or external services to evaluate. This document records the decision to extend the existing stack and justifies the approach.

---

## Existing Stack (Retained)

### Agent Definition Layer

**Technology**: Markdown files with YAML frontmatter
**Location**: `src/claude/agents/*.md`
**Decision**: RETAIN -- extend with fan-out protocol sections
**Rationale**:
- All 48 iSDLC agents are defined as markdown files
- Adding executable code for orchestration would introduce a competing paradigm
- The fan-out protocol is expressible as agent instructions (split, spawn, merge)
- No alternative is simpler for this use case

### Skill Definition Layer

**Technology**: Markdown SKILL.md files organized by category
**Location**: `src/claude/skills/{category}/{skill-name}/SKILL.md`
**Decision**: RETAIN -- add new skill files for fan-out engine components
**Rationale**:
- Skills are the iSDLC mechanism for reusable capabilities
- The fan-out engine is a reusable capability (used by Phase 16 and Phase 08)
- Skill registration provides observability via skill_usage_log

**New Skills to Register**:

| Skill ID | Name | Category Path | Owner Agent |
|----------|------|--------------|-------------|
| QL-012 | fan-out-orchestration | `quality-loop/fan-out-engine` | quality-loop-engineer |

Note: A single skill ID (QL-012) covers the full engine (split + spawn + merge) rather than three separate IDs. The engine components are always invoked together as a unit. Separate skill IDs for splitter, spawner, and merger would add observability overhead without insight (they are never invoked independently). This keeps the skill manifest lean and consistent with the existing 1-skill-per-capability pattern.

### Execution Substrate

**Technology**: Claude Code Task tool (parallel tool calls)
**Decision**: RETAIN -- use for spawning N parallel chunk agents
**Rationale**:
- The Task tool already supports launching multiple agents in a single response (proven with Phase 16 dual-track: 2 parallel Tasks)
- Scaling from 2 to N (max 8) uses the same mechanism
- No external process spawning or job queues needed (C-001)
- Timeout handling is available per-task

### State Management

**Technology**: JSON filesystem state (`.isdlc/state.json`)
**Decision**: RETAIN -- extend schema with `fan_out` configuration section
**Rationale**:
- state.json is the single source of runtime configuration
- All hooks and agents already read from state.json
- Adding a new top-level section is backward-compatible (old readers ignore new keys)
- No database needed (C-001: no external dependencies)

### Configuration Layer

**Technology**: state.json only (NOT workflows.json)
**Decision**: USE state.json EXCLUSIVELY for fan-out configuration
**Rationale**:
- workflows.json does not exist on disk (confirmed in impact analysis)
- Creating workflows.json to support FR-007 AC-007-02 is unnecessary complexity
- state.json already supports per-workflow configuration via `active_workflow.flags`
- The `--no-fan-out` flag is stored in `active_workflow.flags.no_fan_out`
- Per-phase threshold overrides can be stored in `fan_out.phase_overrides`

See ADR-0002 for the full decision record.

### Hook Enforcement Layer

**Technology**: CommonJS hooks (`.cjs` files)
**Decision**: NO CHANGES to hook code
**Rationale**:
- gate-blocker.cjs validates phase output based on iteration-requirements.json schema
- The merged fan-out output uses the identical schema to single-agent output (NFR-003)
- Therefore, gate-blocker requires zero code changes
- iteration-requirements.json may optionally add a `fan_out_summary` field, but it is not required for gate validation
- This is the architecturally safest approach: the entire fan-out feature is invisible to the hook layer

### CLI Layer

**Technology**: isdlc.md markdown command with flag parsing
**Decision**: EXTEND -- add `--no-fan-out` flag parsing
**Rationale**:
- Existing flags (e.g., `-light`) are parsed inline in isdlc.md
- `--no-fan-out` follows the same pattern
- The flag is stored in `active_workflow.flags.no_fan_out` in state.json
- Phase agents check this flag before deciding whether to fan out

---

## Technology Evaluation Matrix

Since no new technologies are being introduced, this matrix evaluates the decision to use each existing technology for the fan-out capability:

| Criterion | Markdown Agents | Task Tool | state.json | CJS Hooks |
|-----------|----------------|-----------|-----------|-----------|
| Maturity | High (48 agents) | High (proven) | High (316+ versions) | High (26 hooks) |
| Team familiarity | High | High | High | High |
| Performance fit | Good (no overhead) | Good (native parallel) | Good (fast JSON read) | N/A (no changes) |
| Security fit | Good (no exec code) | Good (sandboxed) | Good (local file) | N/A |
| Maintenance burden | Low (markdown) | Zero (Claude Code native) | Low (schema extension) | Zero (no changes) |
| Integration cost | Low | Zero | Low | Zero |

---

## Alternatives Considered and Rejected

### 1. JavaScript Runtime Module for Fan-Out Engine

**Description**: Implement the chunk splitter, spawner, and merger as a JS module under `lib/` or `src/claude/hooks/lib/` that agents call via Bash tool.

**Why Rejected**:
- iSDLC agents do not call runtime code -- they follow markdown instructions
- Would introduce a new execution pattern (agent -> Bash -> JS module -> result)
- Adds complexity without benefit: the protocol is simple enough to express in markdown
- Violates Article V (Simplicity First): executable code is unnecessary

### 2. New Fan-Out Orchestrator Agent

**Description**: Create a dedicated `fan-out-orchestrator.md` agent that Phase 16 and Phase 08 delegate to for fan-out coordination.

**Why Rejected**:
- Adds an unnecessary intermediary (3-level nesting: Phase Loop -> Phase Agent -> Fan-Out Orchestrator -> Chunk Agents)
- Increases context window usage and latency
- The fan-out protocol is simple enough for phase agents to follow directly
- Over-engineering for 2 consumers (violates Article V)

### 3. workflows.json for Per-Workflow Configuration

**Description**: Create a workflows.json file to store per-workflow fan-out overrides (as specified in FR-007 AC-007-02).

**Why Rejected**:
- workflows.json does not exist on disk (impact analysis finding)
- Creating it introduces a new configuration file that all hooks/agents would need to discover
- state.json already provides all needed configuration surfaces
- AC-007-02 can be satisfied by per-phase overrides in `fan_out.phase_overrides` in state.json
- Simpler to have one configuration source (Article V)

See ADR-0002 for details.

---

## Summary

No new technologies are introduced. The fan-out feature is implemented entirely within the existing iSDLC technology stack by extending:
1. Agent markdown files (protocol sections)
2. Skill definitions (new QL-012 skill)
3. state.json schema (new `fan_out` section)
4. isdlc.md command (new `--no-fan-out` flag)

The hook enforcement layer (gate-blocker, iteration-corridor, skill-validator) requires zero code changes because the merged fan-out output uses the same schema as single-agent output.
