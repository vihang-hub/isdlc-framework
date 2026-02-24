# ADR-0001: Implement Fan-Out Engine as Embedded Agent Protocol

## Status

Accepted

## Context

The fan-out/fan-in parallelism feature (REQ-0017, FR-001) requires a reusable engine that can be shared between Phase 16 (Quality Loop) and Phase 08 (Code Review). The iSDLC framework defines all agent behavior in markdown files. There is no executable runtime module system for agents -- agents follow instructions, they do not import libraries.

We need to decide how to implement the "reusable module" requirement (AC-001-04: "The engine is implemented as a reusable module under src/claude/ or as a shared skill").

### Options Considered

1. **Embedded agent protocol with skill registration** -- Define the fan-out protocol (JSON contracts, splitting algorithm, spawn pattern, merge rules) in a skill markdown file. Phase agents reference this skill and provide phase-specific parameters.

2. **Executable JavaScript module** -- Implement the chunk splitter, spawner, and merger as a JS module under `lib/` or `src/claude/hooks/lib/` that agents call via the Bash tool.

3. **Dedicated fan-out orchestrator agent** -- Create a new `fan-out-orchestrator.md` agent that Phase 16 and Phase 08 delegate to.

4. **Duplicate protocol in each consumer** -- Copy the full fan-out protocol into each consumer agent (Phase 16, Phase 08).

## Decision

We will use **Option 1: Embedded agent protocol with skill registration**.

The fan-out engine is defined as a skill file (`src/claude/skills/quality-loop/fan-out-engine/SKILL.md`) containing:
- JSON input/output contracts for the chunk splitter
- The deterministic splitting algorithms (round-robin, group-by-directory)
- The parallel Task spawner pattern
- The result merger rules (aggregation, deduplication, priority sorting)

Each consumer agent (16-quality-loop-engineer.md, 07-qa-engineer.md) includes a "Fan-Out Protocol" section that references the skill and provides phase-specific parameters (thresholds, strategies, result formats).

The skill is registered in the skills manifest as QL-012 (fan-out-orchestration) for observability.

## Consequences

### Positive

- **Consistent with existing architecture**: All iSDLC agent behavior is defined in markdown. No new execution paradigm introduced.
- **Reusable**: Both Phase 16 and Phase 08 reference the same protocol. Future consumers can adopt it.
- **Observable**: Skill registration enables tracking via `skill_usage_log`.
- **No runtime dependencies**: No new JS modules, no new hook code, no external processes.
- **Simple**: The protocol is human-readable markdown with JSON contracts. Easy to understand and modify.

### Negative

- **Protocol-level, not runtime-level reuse**: If the protocol changes, both consumer agents must be updated manually. There is no compile-time or runtime check that consumers follow the latest protocol.
- **Duplication of phase-specific parameters**: Each consumer agent has its own threshold values, strategy defaults, and result format handling. This is intentional (different phases have different needs) but means some logic appears in both agents.
- **No enforcement**: The protocol is guidance. A phase agent could deviate from the protocol without detection. This is acceptable because iSDLC agents are all instruction-based (no agent follows instructions perfectly 100% of the time).

## Alternatives Rejected

### Option 2: Executable JavaScript Module

Rejected because:
- iSDLC agents do not call runtime code -- they follow markdown instructions
- Would introduce a new execution pattern (agent -> Bash -> JS module -> result)
- Adds unnecessary complexity (Article V: Simplicity First)
- The protocol is simple enough to express in markdown

### Option 3: Dedicated Fan-Out Orchestrator Agent

Rejected because:
- Adds an unnecessary intermediary (3-level nesting: Phase Loop -> Phase Agent -> Fan-Out Orchestrator -> Chunk Agents)
- Increases context window usage and latency
- Over-engineering for 2 consumers (Article V)

### Option 4: Duplicate Protocol in Each Consumer

Rejected because:
- Violates DRY principle
- Two copies would drift as the protocol evolves
- The skill file provides a single source of truth

## Traces

- FR-001 (Shared Fan-Out/Fan-In Engine)
- AC-001-04 (Reusable module under src/claude/)
- Article V (Simplicity First)
- Article IV (Explicit Over Implicit)
