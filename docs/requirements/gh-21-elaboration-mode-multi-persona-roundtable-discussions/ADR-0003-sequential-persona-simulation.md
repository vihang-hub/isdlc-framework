# ADR-0003: Sequential Persona Simulation in Single Agent Context

## Status

Accepted

## Context

Elaboration mode requires three distinct personas (Maya Chen/BA, Alex Rivera/Architect, Jordan Park/Designer) to participate in a focused discussion. We needed to decide the execution model: should each persona be a separate agent instance (delegated via Task tool), or should a single agent simulate all three personas sequentially?

**Requirements driving this decision**:
- CON-005: Sequential persona execution within single context window
- FR-002: All three personas participate with distinct communication styles
- FR-005: Cross-talk (personas reference each other's points by name)
- FR-010: Persona voice integrity (voices must be distinguishable)
- NFR-002: 80% persona identification rate in blind review

## Decision

A **single agent simulates all three personas sequentially** within one context window. The agent adopts each persona's identity in turn, generating responses prefixed with the persona's name and role attribution. Cross-talk is achieved by referencing previous contributions within the same context.

The rotation pattern is:
1. **Lead persona speaks first** (determined by phase-to-persona mapping)
2. **Remaining personas respond** (based on relevance or round-robin)
3. **User contributes** (addressing specific persona or group)
4. Repeat until exit condition

Each persona contribution follows this template:
```
{Name} ({Role}): {Content in persona's communication style}
```

## Consequences

**Positive:**
- Full discussion history is available in a single context, enabling natural cross-talk without state passing
- Simpler architecture: no inter-agent communication, no state serialization, no delegation overhead
- Consistent with CON-005 (mandatory constraint)
- Lower latency: no Task tool delegation round-trips between turns
- The agent can maintain discussion coherence across all personas because it "sees" the full conversation
- Attribution prefix + distinct communication styles (from persona definitions) enable voice differentiation

**Negative:**
- All persona contributions consume the same context window, limiting total discussion length
- Voice blending risk: the same LLM instance may drift toward a generic voice when simulating multiple personas consecutively (RSK-002)
- Cannot parallelize persona responses (sequential by definition)
- Testing voice integrity requires manual review (NFR-002), not automated verification

**Mitigations:**
- Turn limit (default 10) bounds total context consumption from elaboration
- Per-persona behavioral rules (Section 4.4.9) with explicit anti-blending instructions
- Attribution prefix on every contribution provides explicit persona identification
- Elaboration-specific persona patterns (from requirements Section 13) provide distinct response templates
- Manual voice testing per NFR-002 recommendation

## Alternatives Considered

### Alternative 1: Multi-Agent Delegation (Task Tool)
Delegate each persona to a separate agent instance. An orchestrating agent manages turn order and collects responses.

**Rejected because**:
- CON-005 explicitly prohibits parallel agent delegation for elaboration
- Each delegated agent would only see its own context, not the full discussion. Cross-talk (FR-005) would require passing full discussion history in each delegation prompt -- expensive and fragile.
- Delegation overhead (Task tool round-trip per turn) would add significant latency to a conversational flow
- Three separate agents cannot build on each other's points naturally; cross-references would feel forced

### Alternative 2: Hybrid (Lead Agent + Delegated Perspectives)
The lead persona runs as the primary agent. For each turn, it delegates to specialist agents for the other two personas' contributions, then synthesizes.

**Rejected because**:
- Same cross-talk limitation as Alternative 1 (delegated agents lack full context)
- Complex orchestration logic for a feature that has a LOW blast radius
- Delegation failures (Task tool timeouts, context limits) would disrupt the conversational flow
- Violates the simplicity principle (Article V)

## Traces

- CON-005 (Sequential Persona Execution) -> mandatory constraint, not optional
- FR-002 (Multi-Persona Participation) -> all 3 personas simulated in single context
- FR-005 (Cross-Talk) -> shared context enables natural cross-references
- FR-010 (Voice Integrity) -> attribution prefix + behavioral rules
- NFR-002 (Voice Distinctiveness) -> 80% identification target via style guidelines
- Article V (Simplicity First) -> simplest execution model that satisfies requirements
