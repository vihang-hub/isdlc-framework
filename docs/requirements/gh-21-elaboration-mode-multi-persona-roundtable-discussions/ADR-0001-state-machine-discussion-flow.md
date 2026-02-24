# ADR-0001: State Machine Discussion Flow for Elaboration Mode

## Status

Accepted

## Context

Elaboration mode (GH-21) introduces a multi-turn, multi-persona discussion flow within the roundtable-analyst.md agent. The discussion has distinct phases (entry, topic framing, discussion loop, synthesis, exit) and must handle multiple types of input (user text, exit keywords, persona addressing) while enforcing constraints (turn limits, topic focus).

We needed to choose a control flow pattern for orchestrating this interaction.

**Requirements driving this decision**:
- FR-001: Entry mechanism via [E] menu selection
- FR-003: User participation with persona addressing
- FR-004: Topic-focused discussion with drift redirection
- FR-006: Exit mechanism (user-initiated or turn limit)
- FR-007: Turn limit enforcement (default 10)
- FR-008: Discussion synthesis after exit

## Decision

Implement the elaboration discussion as a **finite state machine** with five states: ENTRY, TOPIC_FRAMING, DISCUSSION_LOOP, SYNTHESIS, and STATE_PERSIST. The state machine is expressed as structured prompt instructions within the agent's markdown file, not as executable code.

State transitions:
- ENTRY -> TOPIC_FRAMING (always, after introduction)
- TOPIC_FRAMING -> DISCUSSION_LOOP (always, after lead persona frames topic)
- DISCUSSION_LOOP -> DISCUSSION_LOOP (turn < max_turns AND no exit keyword)
- DISCUSSION_LOOP -> SYNTHESIS (exit keyword detected OR turn == max_turns)
- SYNTHESIS -> STATE_PERSIST (always, after artifact updates)
- STATE_PERSIST -> step boundary menu (always, after meta.json write)

## Consequences

**Positive:**
- Clear, linear flow that is easy to understand and follow in prompt instructions
- Each state has a well-defined entry condition, behavior, and exit condition
- Turn counting is a simple increment within the DISCUSSION_LOOP state
- Exit conditions are explicit and unambiguous
- The pattern maps directly to the functional requirements (each state traces to specific FRs)

**Negative:**
- State machine expressed in natural language (prompt instructions) is less rigorous than a coded state machine -- the LLM must faithfully follow the state transition rules
- No formal state verification mechanism (no unit tests for prompt-based state machines)
- Complex user inputs (e.g., exit keyword embedded in a longer sentence) may cause ambiguous state transitions

**Mitigations:**
- Prompt instructions are structured with clear conditional logic ("If user types done/exit/wrap up/back -> proceed to SYNTHESIS")
- Turn limit provides a hard upper bound on DISCUSSION_LOOP iterations regardless of input parsing
- Manual testing protocol (from impact analysis M3) validates state transitions

## Alternatives Considered

### Alternative 1: Unstructured Conversational Flow
Let the agent handle elaboration as freeform conversation without explicit states.

**Rejected because**: Without state boundaries, the agent may fail to enforce turn limits, forget to synthesize, or lose track of when to re-present the step menu. The requirements explicitly demand bounded, structured behavior (FR-006, FR-007).

### Alternative 2: Multi-Agent Delegation
Delegate each persona to a separate agent instance via Task tool, with an orchestrating agent managing the discussion flow.

**Rejected because**: CON-005 mandates sequential persona execution within a single context. Multi-agent delegation would also lose shared discussion context, making cross-talk (FR-005) impossible without explicit state passing.

### Alternative 3: JavaScript-Based State Machine
Implement the discussion flow as JavaScript code in a new utility module, invoked by the agent via Bash tool.

**Rejected because**: The discussion flow is an interaction pattern, not a computation. The agent needs to generate persona responses, interpret user input, and produce natural language -- all of which are agent capabilities, not code capabilities. Adding a JavaScript state machine would create unnecessary coupling between prompt behavior and code execution.

## Traces

- FR-001 (Entry) -> ENTRY state
- FR-004 (Topic Focus) -> TOPIC_FRAMING state
- FR-002, FR-003, FR-005 (Discussion) -> DISCUSSION_LOOP state
- FR-006, FR-007 (Exit) -> DISCUSSION_LOOP exit transitions
- FR-008 (Synthesis) -> SYNTHESIS state
- FR-009 (State Tracking) -> STATE_PERSIST state
