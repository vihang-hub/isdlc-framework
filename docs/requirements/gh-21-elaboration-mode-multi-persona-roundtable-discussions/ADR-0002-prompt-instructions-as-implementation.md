# ADR-0002: Prompt Instructions as Implementation Medium

## Status

Accepted

## Context

Elaboration mode requires multi-persona discussion orchestration: simulating three distinct personas, generating contextually appropriate responses in each persona's voice, managing cross-talk, enforcing topic focus, and producing synthesis summaries. We needed to decide where this logic lives: in markdown prompt instructions within the agent file, or in JavaScript code invoked by the agent.

**Requirements driving this decision**:
- CON-001: Single agent file (elaboration within roundtable-analyst.md)
- CON-005: Sequential persona execution within single context
- FR-002: Multi-persona participation with distinct communication styles
- FR-005: Cross-talk between personas
- FR-008: Discussion synthesis
- FR-010: Persona voice integrity

## Decision

Implement all elaboration logic as **structured markdown prompt instructions** within roundtable-analyst.md. No new JavaScript modules, no code execution during the discussion flow. The only JavaScript change is a 3-line defensive default in readMetaJson().

The elaboration handler (Section 4.4) is structured as a series of numbered instruction sections with conditional logic expressed in natural language:

```
4.4.1 Entry Handler
4.4.2 Topic Framer
4.4.3 Discussion Loop
4.4.4 Persona Addressing Parser
4.4.5 Topic Enforcer
4.4.6 Exit Handler
4.4.7 Synthesis Engine
4.4.8 State Tracker
4.4.9 Voice Integrity Rules
```

## Consequences

**Positive:**
- Consistent with the existing roundtable-analyst.md architecture (all agent behavior is prompt-driven)
- Multi-persona simulation is fundamentally a language generation task -- prompt instructions are the natural medium
- No runtime dependencies beyond the standard Claude Code agent system
- Easier to iterate and refine: editing markdown is faster than editing/testing JavaScript
- Cross-talk and voice integrity are prompt-engineering problems, not software engineering problems
- Zero new files created (maintains blast radius at 2 files total)

**Negative:**
- Not unit-testable: prompt instructions cannot be verified by automated tests
- Behavioral correctness depends on the LLM's instruction-following capability, which may vary across model versions
- Complex conditional logic (persona addressing, topic drift detection) is harder to express precisely in natural language than in code
- Debugging requires manual conversation testing rather than unit test output

**Mitigations:**
- Manual validation protocol (from impact analysis M3 recommendations): define a test script covering all major flows
- Structured instruction format with clear section numbering reduces ambiguity
- Persona voice testing per NFR-002: run 3-5 elaboration sessions and verify persona distinctiveness
- The turn limit (FR-007) provides a hard safety net regardless of instruction-following quality

## Alternatives Considered

### Alternative 1: JavaScript Discussion Engine
Create a new module (`src/claude/hooks/lib/elaboration-engine.cjs`) that manages discussion state, turn counting, and persona rotation. The agent invokes it via Bash tool.

**Rejected because**:
- Persona voice generation is inherently an LLM task, not a code task. A JavaScript engine could manage state but not generate persona responses.
- Would require passing discussion context between the agent and the engine via Bash tool (serialization overhead, context fragmentation).
- Increases blast radius from 2 files to 3 files.
- Violates the simplicity principle (Article V): adds code infrastructure for a problem that prompt instructions solve directly.

### Alternative 2: Hybrid (Code for State, Prompts for Responses)
Use JavaScript for state management (turn counting, exit detection) and prompt instructions for persona response generation.

**Rejected because**:
- Turn counting is trivial in prompt instructions ("Increment turn counter. If turn == max_turns, proceed to synthesis.")
- Exit keyword detection is trivial in prompt instructions ("If user types done/exit/wrap up/back, proceed to synthesis.")
- The complexity does not justify splitting the implementation across two mediums.
- Would require the agent to invoke Bash between each turn for state checks, adding latency and breaking conversation flow.

## Traces

- CON-001 (Single Agent File) -> all logic in roundtable-analyst.md
- FR-002 (Multi-Persona) -> persona simulation via prompt instructions
- FR-005 (Cross-Talk) -> natural language cross-referencing instructions
- FR-008 (Synthesis) -> structured summary generation via prompt instructions
- FR-010 (Voice Integrity) -> per-persona behavioral rules in Section 4.4.9
- Article V (Simplicity First) -> simplest viable implementation medium
