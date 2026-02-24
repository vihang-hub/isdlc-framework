# ADR-0010: Skill Manager as Standalone Agent

## Status

Accepted

## Context

The interactive wiring session (FR-003) requires a multi-step conversational interaction:
1. Display suggested or existing bindings
2. Present agent/phase selection grouped by category
3. User selects delivery type
4. Confirmation with save/adjust/cancel

This interaction pattern is conversational and requires LLM reasoning for smart defaults. The question is where to implement it.

Options:
1. **Standalone agent** (`skill-manager.md`): New agent dedicated to wiring sessions
2. **Inline in isdlc.md**: Embed all wiring logic in the command dispatcher
3. **Node.js CLI prompt**: Use inquirer/prompts for terminal-based interaction

## Decision

Create a standalone `skill-manager.md` agent that is delegated to by `isdlc.md` via the Task tool for wiring sessions.

## Consequences

**Positive:**
- Clean separation of concerns: isdlc.md handles dispatch, skill-manager handles conversation
- Consistent with framework pattern: all multi-step interactions use agents (e.g., impact-analysis-orchestrator, tracing-orchestrator)
- The agent can leverage LLM intelligence for smart defaults and natural language understanding
- isdlc.md stays focused on dispatch/orchestration, not conversational UX

**Negative:**
- One additional Task tool invocation per wiring session (adds ~5-10 seconds latency)
- A new agent file to maintain
- Agent must be registered in skills-manifest.json

**Mitigated risks:**
- The latency is acceptable because wiring is an infrequent operation (once per skill registration)
- The agent is small (~150-200 lines) and self-contained
- Registration in skills-manifest.json follows established pattern

## Agent Design

The skill-manager agent:
- Is NOT a phase agent (not part of any workflow phase)
- Does NOT access state.json or trigger workflows (CON-003)
- Does NOT write to the manifest (returns bindings object to isdlc.md, which does the write)
- Is registered in skills-manifest.json with `agent_id: "EXT"` and `phase: "skill-management"`
- Receives all context in its delegation prompt (skill name, suggestions, phase list, existing bindings)

## Alternatives Considered

### Inline in isdlc.md (Rejected)
- isdlc.md is already 1407 lines. Adding 150+ lines of conversational wiring logic would push it past 1600 lines.
- Mixes orchestration (phase loop, gate validation, state management) with UX (wiring session).
- Harder to test and maintain.

### Node.js CLI prompt (Rejected)
- Would require adding npm dependencies (inquirer, prompts, etc.)
- Cannot leverage LLM for smart defaults or natural language understanding
- Inconsistent with framework pattern (all interactive operations use agents)
- Would need to run outside Claude Code's Task tool

## Requirement Traceability

- FR-003 (Interactive Wiring Session)
- FR-009 (Re-wiring Existing Skills)
- CON-003 (No Git Operations)
- Article V (Simplicity First)
