# ADR-001: Single-Agent Persona Router Pattern

## Status

Accepted

## Context

The roundtable analysis agent needs to support three named personas (Maya Chen / Business Analyst, Alex Rivera / Solutions Architect, Jordan Park / System Designer) across five analysis phases (00-04). The core design question is how to structure the persona system.

Three patterns were considered:

1. **Multi-agent model**: One agent file per persona, coordinated by a router agent
2. **Single-agent with external persona files**: One agent file that loads persona definitions from separate files
3. **Single-agent with inline personas**: One agent file containing all persona definitions and switching logic

Requirements context:
- CON-001 mandates a single agent file (no separate persona agent files)
- NFR-002 requires seamless persona transitions with no style leakage
- NFR-004 requires adding new personas without modifying the core agent (aspirational)
- The Task tool creates isolated execution contexts per invocation

## Decision

Use the **single-agent with inline personas** pattern. The `roundtable-analyst.md` file contains all three persona definitions inline, along with the phase-to-persona mapping table and step execution logic.

Persona isolation across phases is guaranteed structurally: each phase delegation is a separate Task tool invocation, creating a fresh agent context. The agent activates the appropriate persona based on the `phase_key` received in the delegation prompt.

## Consequences

**Positive:**
- Satisfies CON-001 (single agent file)
- No cross-agent state management needed
- Persona isolation is guaranteed by Task tool's execution model -- no cleanup or reset logic
- Simplest possible implementation (Article V: Simplicity First)
- No additional agent discovery, loading, or routing infrastructure
- Agent count increases by exactly 1 (not 3 or 4)

**Negative:**
- Adding a new persona requires editing the agent file (violates strict NFR-004 interpretation)
- The agent file will be large (estimated 800-1200 lines with three persona definitions + step execution logic)
- All persona definitions are loaded into context even though only one is active per invocation

**Mitigations:**
- The agent file size is comparable to existing large agents (requirements-analyst: 1841 lines, orchestrator: 1660 lines)
- New personas are a rare operation; the step-file system provides the primary extensibility mechanism
- Only the active persona's instructions are followed by the model, so unused persona definitions do not cause behavior issues

## Alternatives Considered

### Multi-Agent Model (Rejected)
- One agent per persona + one router agent = 4 new agent files
- **Rejected because**: Prohibited by CON-001; increases agent count by 4 instead of 1; requires cross-agent state sharing for step tracking

### External Persona Files (Rejected)
- One agent + 3 persona definition files loaded at runtime
- **Rejected because**: While CON-001 could be interpreted to allow supporting files, the simplest reading prohibits separate persona files; the loading mechanism adds complexity with no clear benefit for 3 fixed personas

## Traces

- FR-001 (roundtable agent definition)
- FR-002 (persona definitions)
- FR-003 (phase-to-persona mapping)
- CON-001 (single agent file constraint)
- NFR-002 (persona switch consistency)
- Article V (Simplicity First)
