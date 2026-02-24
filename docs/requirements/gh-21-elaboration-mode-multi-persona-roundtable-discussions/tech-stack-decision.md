# Technology Stack Decision: Elaboration Mode

**Feature**: Elaboration Mode -- Multi-Persona Roundtable Discussions
**Feature ID**: REQ-GH21-ELABORATION-MODE
**Source**: GH-21
**Phase**: 03-architecture

---

## 1. Technology Stack Assessment

This feature introduces **no new technologies**. The elaboration mode is implemented entirely within the existing technology stack of the iSDLC framework.

### 1.1 Existing Stack (UNCHANGED)

| Layer | Technology | Version | Role in Elaboration |
|-------|-----------|---------|---------------------|
| Agent Instructions | Markdown (`.md`) | N/A | Primary implementation medium. Elaboration logic is expressed as structured markdown instructions in roundtable-analyst.md. |
| Utility Functions | Node.js (CommonJS `.cjs`) | 18+ | readMetaJson() defensive default. ~3 lines of JavaScript. |
| State Storage | JSON files (`meta.json`) | N/A | Elaboration records stored as JSON objects in meta.json. |
| Runtime | Claude Code Agent System | Current | Executes agent instructions, provides Read/Write/Edit tools. |
| Step Definitions | YAML frontmatter + Markdown | N/A | Step files read for topic, title, and outputs fields. |

### 1.2 Technology Evaluation

No technology evaluation was needed because:

1. **No new language or framework**: The feature is a behavioral enhancement to an existing markdown agent file. The "programming language" is natural language prompt instructions.

2. **No new runtime dependencies**: The only JavaScript change is a 3-line defensive default following an established pattern.

3. **No new data store**: meta.json is already the established state storage mechanism for the roundtable agent. Extending it with optional fields is a schema evolution, not a technology choice.

4. **No new communication protocol**: The elaboration handler uses the same Read/Write/Edit tools that the agent already uses for step execution and artifact production.

5. **No new infrastructure**: The feature runs within the existing Claude Code agent context. No new services, containers, or external dependencies are required.

---

## 2. Key Technology Decisions

### 2.1 Prompt Instructions as Implementation Medium

**Decision**: Implement elaboration logic as structured markdown prompt instructions, not as JavaScript code or a separate agent.

**Rationale**:
- Consistent with the existing roundtable-analyst.md implementation pattern (CON-001)
- Multi-persona simulation within a single agent context is a prompt-engineering challenge, not a software engineering challenge
- No code execution is needed for discussion orchestration, topic enforcement, or synthesis -- these are all instruction-following behaviors
- Easier to iterate and tune than compiled code

**Tradeoff**: Prompt instructions are less testable than code. Behavioral correctness depends on the LLM's instruction-following capability. This is mitigated by clear, structured instructions and manual validation (per impact analysis recommendation M3).

**ADR**: ADR-0002-prompt-instructions-as-implementation

### 2.2 Sequential Persona Simulation (Not Multi-Agent Delegation)

**Decision**: Simulate all three personas sequentially within a single agent context, rather than delegating to separate agent instances via the Task tool.

**Rationale**:
- CON-005 mandates sequential execution within a single context
- Multi-agent delegation would require inter-agent state passing, increasing complexity
- A single context maintains full discussion history, enabling natural cross-talk
- Simpler failure modes: no delegation failures, no state synchronization issues

**Tradeoff**: All persona contributions consume the same context window. The turn limit (default 10) bounds total context consumption.

**ADR**: ADR-0003-sequential-persona-simulation

### 2.3 meta.json as Elaboration State Store (Not state.json)

**Decision**: Store elaboration records in meta.json (per-item, in artifact folder), not in .isdlc/state.json (global framework state).

**Rationale**:
- CON-003 prohibits state.json writes from the roundtable agent
- meta.json is already the established state store for step tracking (steps_completed, depth_overrides)
- Elaboration state is per-item (not global), making meta.json the natural location
- Follows the principle of locality: elaboration records live alongside the artifacts they enriched

**Tradeoff**: Elaboration analytics across items would require scanning multiple meta.json files. This is acceptable because cross-item elaboration memory is explicitly out of scope.

---

## 3. Compatibility Matrix

| Component | Compatibility | Notes |
|-----------|--------------|-------|
| Claude Code agent runtime | COMPATIBLE | Feature uses standard agent capabilities (Read/Write/Edit, user interaction) |
| Node.js 18+ | COMPATIBLE | Minor readMetaJson() change uses standard JavaScript |
| Existing meta.json consumers | COMPATIBLE | New fields are optional; JSON.parse handles unknown fields natively |
| Step file format | COMPATIBLE | Step files are read-only; no format changes |
| isdlc.md command handler | COMPATIBLE | Delegation interface unchanged |
| Hook system | COMPATIBLE | No hook logic depends on elaboration state |

---

## 4. Technology Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| LLM fails to maintain distinct persona voices in extended discussions | Medium | Explicit per-persona behavioral rules; attribution prefix on every contribution; manual testing per NFR-002 |
| Context window limits reached during 10-turn discussions | Low | Turn limit bounds total content; synthesis compresses before artifact writes |
| JSON.stringify drops elaboration data on write | Very Low | writeMetaJson() already uses JSON.stringify for the full meta object; no selective field handling |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-20 | Solutions Architect (Phase 03) | Initial tech stack decision |
