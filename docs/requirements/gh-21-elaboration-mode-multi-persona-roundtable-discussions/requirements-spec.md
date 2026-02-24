# Requirements Specification: Elaboration Mode -- Multi-Persona Roundtable Discussions

**Feature ID**: REQ-GH21-ELABORATION-MODE
**Source**: GitHub Issue #21
**Source ID**: GH-21
**Backlog Reference**: Item 16.3
**Scope**: Feature
**Complexity**: Medium (~15-20 files)
**Depends On**: #20 / REQ-0027 (Roundtable Agent with Named Personas) -- COMPLETED, MERGED
**Enables**: Richer analysis artifacts through multi-perspective discussion

---

## 1. Business Context

### 1.1 Problem Statement

The roundtable analysis agent (REQ-0027) currently assigns a single persona to each analysis phase. When the user encounters a topic that would benefit from multiple perspectives -- such as architecture tradeoffs during requirements discovery, or business constraints during design -- they have no mechanism to bring additional viewpoints into the discussion. The `[E]` menu option exists at every step boundary but currently falls back to deepening the current step with a single persona, losing the cross-disciplinary insight that makes roundtable discussions valuable.

Specific deficiencies:

1. **Single-persona limitation at each step**: Maya (BA) handles requirements alone. If the user wants Alex (Architect) to weigh in on technical feasibility of a requirement, there is no mechanism to surface that perspective.
2. **Lost cross-cutting insights**: Complex features have requirements that span business, technical, and design concerns simultaneously. A single persona cannot adequately explore all dimensions.
3. **Elaboration stub provides only depth, not breadth**: The current stub (section 4.4) switches to "deep" mode but keeps the same persona. This adds depth on one axis but misses the breadth of multi-persona discussion.
4. **No synthesis from multi-perspective discussion**: Even if personas could speak, there is no mechanism to synthesize their discussion points into enriched artifacts.

### 1.2 Business Drivers

- **Analysis quality**: Topics like "should we support offline mode?" require business viability analysis (Maya), architecture impact assessment (Alex), and interface design implications (Jordan) simultaneously. Single-persona analysis misses 2 of 3 perspectives.
- **User control over depth**: The user should decide when a topic deserves multi-perspective treatment. Not every step needs elaboration, but the option must always be available.
- **Foundation for #22 (Critic/Refiner)**: The multi-persona discussion pattern established here becomes the interaction model for transparent critic/refiner workflows.
- **BMAD party-mode parity**: The BMAD methodology's party-mode demonstrates that persona roundtable discussions produce higher-quality outputs than sequential single-persona analysis.

### 1.3 Success Metrics

- SM-001: When elaboration mode is used, the resulting artifact section contains insights from at least 2 personas (measured by persona attribution in discussion synthesis).
- SM-002: Elaboration sessions complete and return to the step workflow within a bounded number of exchanges (max 10 turns per session to prevent rabbit holes).
- SM-003: Artifact sections updated after elaboration contain richer content (more acceptance criteria, more risk considerations, more design alternatives) compared to single-persona analysis of the same topic.
- SM-004: The elaboration entry/exit flow completes without interrupting step progress tracking in meta.json.

### 1.4 Scope Boundaries

**In Scope:**
- Replace the elaboration stub (section 4.4) in roundtable-analyst.md with a full multi-persona discussion handler
- Multi-persona activation: all three personas (Maya, Alex, Jordan) participate in focused discussion
- User participation as an equal in the discussion
- Cross-talk between personas (personas reference each other's points)
- Topic-focused discussion scoped to the current analysis step
- Persona addressing: user can direct questions to specific personas by name or to the group
- Discussion synthesis: capture key insights and update artifacts
- Elaboration tracking in meta.json (per-step elaboration state)
- Exit mechanism to return to the step workflow with enriched context
- Turn limits to prevent unbounded discussion

**Out of Scope (this release):**
- Persistent elaboration memory across analysis sessions (elaboration context is per-session)
- User-defined personas joining elaboration (only the 3 built-in personas)
- Elaboration within a step (only at step boundaries via the [E] menu)
- Automated elaboration triggers (elaboration is always user-initiated)
- Changes to the build verb behavior
- Changes to the step file schema (step files are unchanged)
- Critic/Refiner integration at step boundaries (#22, deferred)

---

## 2. Stakeholders and Personas

### 2.1 Primary Persona: Framework User (Developer)

- **Role**: Software developer using iSDLC to analyze backlog items before building them
- **Goals**: Bring multiple analytical perspectives to bear on complex topics during analysis; get richer, more thoroughly considered artifacts
- **Pain Points**: Single-persona analysis misses cross-cutting concerns; no way to get the architect's view during requirements or the designer's view during architecture without manually re-running phases
- **Technical Proficiency**: Intermediate to advanced; CLI-comfortable; familiar with the analyze workflow and menu system
- **Key Tasks**: Selects [E] at a step boundary when a topic deserves deeper multi-perspective exploration; participates in the discussion; reviews synthesized insights in artifacts

### 2.2 Secondary Persona: Framework Maintainer

- **Role**: Developer maintaining/extending the iSDLC framework (dogfooding)
- **Goals**: Clean implementation that extends the existing roundtable agent without breaking the step execution engine or menu system; elaboration logic is contained in a well-defined section
- **Pain Points**: Elaboration should not require changes to every step file; synthesis logic should be reusable across phases
- **Key Tasks**: Maintains the elaboration handler in roundtable-analyst.md; tunes persona cross-talk behavior; extends synthesis patterns

---

## 3. User Journeys

### 3.1 Primary Journey: Elaboration During Requirements Analysis

**Entry Point**: User is at a step boundary menu during `/isdlc analyze "feature"`, Phase 01 (Requirements).

1. Maya (BA) completes step 01-03 (User Experience & Journeys) and presents the step menu.
2. User sees: `[E] Elaboration Mode -- bring all perspectives to discuss this topic`
3. User selects `[E]`.
4. System activates elaboration mode. All three personas are introduced: "Bringing Alex (Solutions Architect) and Jordan (System Designer) into the discussion. Topic: User Experience & Journeys for {feature}."
5. Maya frames the discussion topic based on the current step's output so far.
6. Alex offers architectural perspective: "From an architecture standpoint, this user journey implies..."
7. Jordan offers design perspective: "The interface contracts for this flow would need..."
8. User participates, asks questions, directs specific personas: "Alex, how does this affect the existing module boundary?"
9. Alex responds in character, referencing Jordan's point: "Building on Jordan's interface concern..."
10. After discussion (user-initiated or turn limit), user types `done` or selects exit.
11. System synthesizes: "Key insights from elaboration: {summary}. Updating requirements-spec.md section 3 with enriched user journey."
12. System returns to the step menu at step 01-03 (same position), with artifacts updated.
13. User selects `[C]` to continue to step 01-04.

### 3.2 Alternative Journey: Elaboration at Phase Boundary

1. Maya completes the final step of Phase 01 (step 01-08 Prioritization).
2. Phase boundary menu appears with `[E]` option.
3. User selects `[E]` to discuss prioritization with all personas before moving to Phase 02.
4. All three personas discuss priority tradeoffs from their respective lenses.
5. After elaboration, user exits and selects `[C]` to continue to Phase 02.

### 3.3 Edge Case: Elaboration with No User Input

1. User selects `[E]`.
2. Personas begin discussing.
3. User does not participate (only reads).
4. After a few exchanges, system prompts: "Any thoughts on this, or should we wrap up?"
5. User types `done`.
6. Synthesis occurs as normal.

### 3.4 Edge Case: Elaboration Exceeds Turn Limit

1. User selects `[E]`.
2. Discussion proceeds for the maximum allowed turns (10).
3. System announces: "We've had a thorough discussion. Let me synthesize the key points."
4. Synthesis occurs automatically.
5. Step menu re-presented.

---

## 4. Technical Context

### 4.1 Runtime Environment

- **Language**: Markdown-based agent instructions (no code runtime)
- **Framework**: Claude Code agent system (Task tool for delegation, Read/Write/Edit for file operations)
- **Module System**: Agent files in `src/claude/agents/`, step files in `src/claude/skills/analysis-steps/`
- **Configuration**: meta.json per artifact folder for session tracking

### 4.2 Integration Points

- **roundtable-analyst.md**: Primary integration point. Section 4.4 (elaboration stub) is replaced. Sections 2 (step execution engine), 4 (menu system), and 5 (session management) are extended.
- **meta.json**: Extended with elaboration tracking fields (per-step elaboration state).
- **Step files**: NOT modified. Step files define the topics; elaboration operates on whatever topic the current step covers.
- **isdlc.md (analyze handler)**: Minimal or no changes. Elaboration is contained within the roundtable agent's execution.
- **Artifact files**: Updated by the synthesis logic after elaboration (requirements-spec.md, impact-analysis.md, etc.).

### 4.3 Technical Constraints

- **CON-001 (Single Agent File)**: Elaboration mode runs within the existing roundtable-analyst.md agent. No new agent file is created.
- **CON-002 (Analyze Verb Only)**: Elaboration is only available during the analyze verb workflow.
- **CON-003 (No State.json Writes)**: All elaboration tracking is in meta.json, not state.json.
- **CON-004 (Single-Line Bash)**: Any Bash commands follow the single-line convention.
- **Single-context constraint**: All three personas are simulated by the same agent within a single context window. Cross-talk is generated sequentially, not in parallel.

### 4.4 Backward Compatibility

- The [E] menu option already exists. Changing its handler from stub to full implementation is a backward-compatible enhancement.
- meta.json is extended with optional fields. Existing consumers that do not read elaboration fields are unaffected.
- Step files are unchanged. The step execution engine behavior is unchanged for [C] and [S] menu selections.

---

## 5. Quality Attributes & Risks

### 5.1 Key Risks

| Risk ID | Risk | Likelihood | Impact | Mitigation |
|---------|------|------------|--------|------------|
| RSK-001 | Elaboration discussions go off-topic or become unbounded | Medium | Medium | Enforce turn limits (max 10 turns). Personas stay scoped to the current step's topic. |
| RSK-002 | Persona voices blend or become indistinguishable during cross-talk | Medium | High | Explicit persona attribution in every message. Persona communication style guidelines enforce distinct voices. |
| RSK-003 | Synthesis produces artifacts that conflict with pre-elaboration content | Low | High | Synthesis is additive (enriches, does not replace). User reviews synthesized content before step menu re-presents. |
| RSK-004 | Context window overflow from lengthy multi-persona discussions | Low | High | Turn limits bound discussion length. Synthesis compresses discussion into key insights before writing to artifacts. |
| RSK-005 | Meta.json elaboration tracking breaks existing session resume | Low | Medium | Elaboration fields are optional. readMetaJson() handles missing fields gracefully (existing pattern from REQ-0027). |

### 5.2 Quality Attribute Priorities

1. **Usability** (Critical): Elaboration entry/exit must be seamless. The user should feel in control of when elaboration starts and ends.
2. **Maintainability** (High): Elaboration logic is contained in roundtable-analyst.md. No step file modifications required.
3. **Reliability** (High): Elaboration must not corrupt step progress or artifact state. Session resume must work after elaboration.
4. **Performance** (Medium): Turn limits prevent excessive latency. Synthesis should not add more than a few seconds to step transitions.

---

## 6. Functional Requirements

### FR-001: Elaboration Mode Entry

The system MUST allow the user to enter elaboration mode by selecting `[E]` at any step boundary menu during the analyze workflow.

**Acceptance Criteria:**

- AC-001-01: Given a step boundary menu is displayed after any completed step, When the user selects `[E]`, Then the system activates elaboration mode for the topic of the just-completed step.
- AC-001-02: Given a phase boundary menu is displayed after the final step of a phase, When the user selects `[E]`, Then the system activates elaboration mode for the overall phase topic.
- AC-001-03: Given the user selects `[E]`, When elaboration mode activates, Then the system displays an introduction message: "Bringing {persona_2_name} ({role_2}) and {persona_3_name} ({role_3}) into the discussion. Topic: {current_step_title} for {item_name}."
- AC-001-04: Given elaboration mode activates, When the introduction is displayed, Then the lead persona (the persona who owns the current phase) frames the discussion topic by summarizing what was covered in the just-completed step.

### FR-002: Multi-Persona Participation

The system MUST activate all three named personas (Maya Chen, Alex Rivera, Jordan Park) plus the user as equal participants during elaboration mode.

**Acceptance Criteria:**

- AC-002-01: Given elaboration mode is active, When personas contribute to the discussion, Then each persona speaks in their defined communication style (Maya: probing/detail-oriented, Alex: strategic/tradeoff-focused, Jordan: precise/interface-focused).
- AC-002-02: Given elaboration mode is active, When all personas have been introduced, Then the lead persona (phase owner) speaks first to frame the topic, followed by the other two personas offering their perspective.
- AC-002-03: Given elaboration mode is active, When a persona references another persona's point, Then they use the other persona's name explicitly: "Building on {name}'s point about..." or "I agree with {name} that..."
- AC-002-04: Given elaboration mode is active, When personas contribute, Then each contribution is prefixed with the persona's name and role: "{Name} ({Role}): {content}"

### FR-003: User Participation and Persona Addressing

The system MUST allow the user to participate as an equal in the elaboration discussion, including addressing specific personas by name.

**Acceptance Criteria:**

- AC-003-01: Given elaboration mode is active, When the user types a message, Then the system processes it as a contribution to the discussion and all personas can respond.
- AC-003-02: Given elaboration mode is active, When the user addresses a specific persona by name (e.g., "Alex, what about scalability?"), Then only the addressed persona responds first, with other personas optionally following up.
- AC-003-03: Given elaboration mode is active, When the user addresses the group (e.g., "What do you all think about...?"), Then each persona responds in turn with their perspective.
- AC-003-04: Given elaboration mode is active, When the user has not participated for 3 consecutive persona exchanges, Then the lead persona prompts the user: "Any thoughts on this, or should we wrap up?"

### FR-004: Topic-Focused Discussion

The system MUST keep elaboration discussions focused on the current analysis step's topic and prevent off-topic drift.

**Acceptance Criteria:**

- AC-004-01: Given elaboration mode is active for step 01-03 (User Experience & Journeys), When personas discuss, Then contributions are scoped to user experience, workflows, and journey-related concerns for the current feature.
- AC-004-02: Given a persona's contribution drifts to an unrelated topic, When the lead persona detects drift, Then the lead persona redirects: "{Name} raises an interesting point about {topic}, but let's stay focused on {current_topic}. We can explore that when we get to {relevant_phase}."
- AC-004-03: Given elaboration mode is active, When the discussion begins, Then the lead persona states the specific focus question: "Let's discuss: {topic_question_derived_from_step_output}."

### FR-005: Cross-Talk Between Personas

The system MUST enable natural cross-talk between personas during elaboration, where personas build on, challenge, or extend each other's points.

**Acceptance Criteria:**

- AC-005-01: Given persona A makes a point during elaboration, When persona B responds, Then persona B may reference persona A's point directly: "Alex mentioned {point}. From a design perspective, that means..."
- AC-005-02: Given personas disagree on an approach, When the disagreement is expressed, Then each persona states their position with reasoning and the lead persona summarizes the tradeoff for the user.
- AC-005-03: Given a persona identifies a concern raised by another persona, When they respond, Then they may propose a resolution or ask the user to arbitrate: "Maya and I see this differently. {User}, what matters more for your project: {option_A} or {option_B}?"

### FR-006: Elaboration Mode Exit

The system MUST provide clear exit mechanisms to end elaboration and return to the step workflow.

**Acceptance Criteria:**

- AC-006-01: Given elaboration mode is active, When the user types `done`, `exit`, `wrap up`, or `back`, Then the system initiates synthesis and exits elaboration mode.
- AC-006-02: Given elaboration mode is active, When the turn limit is reached (FR-007), Then the system automatically initiates synthesis and exits elaboration mode with a message: "We've had a thorough discussion. Let me synthesize the key points."
- AC-006-03: Given elaboration mode exits, When synthesis completes, Then the system re-presents the same step boundary menu that was displayed before elaboration was entered (the user is at the same position in the step sequence).
- AC-006-04: Given elaboration mode exits, When the step menu is re-presented, Then the `[E]` option is still available, allowing the user to re-enter elaboration if desired.

### FR-007: Turn Limits

The system MUST enforce a maximum number of discussion turns to prevent unbounded elaboration sessions.

**Acceptance Criteria:**

- AC-007-01: Given elaboration mode is active, When the discussion reaches 10 persona exchange turns (a turn = one persona speaking or the user contributing), Then the system announces the turn limit and initiates synthesis.
- AC-007-02: Given the turn limit is approaching (turn 8 of 10), When a persona speaks, Then the lead persona signals: "We're nearing the end of our discussion time. Any final points?"
- AC-007-03: Given the turn limit is configurable, When the default is 10 turns, Then the system uses 10 unless overridden in meta.json `elaboration_config.max_turns`.

### FR-008: Discussion Synthesis

The system MUST synthesize the elaboration discussion into structured insights and update the relevant artifacts.

**Acceptance Criteria:**

- AC-008-01: Given elaboration mode exits (user-initiated or turn limit), When synthesis runs, Then the system produces a structured summary: key insights (bulleted), decisions made, open questions, and action items.
- AC-008-02: Given synthesis produces key insights, When the current step has associated output artifacts (from the step file's `outputs` field), Then the system updates those artifacts with enriched content from the elaboration discussion.
- AC-008-03: Given synthesis updates artifacts, When the updates are applied, Then the synthesis is additive -- it enriches existing content rather than replacing it. New insights are appended or woven into existing sections.
- AC-008-04: Given synthesis completes, When the summary is displayed to the user, Then the user can see what was added to artifacts: "Updated {artifact_name}, section {section}: added {brief_description_of_additions}."
- AC-008-05: Given synthesis produces a summary, When the summary contains persona attributions, Then each insight is attributed to the persona(s) who contributed it: "[Maya/Alex] Identified that offline mode requires local caching strategy."

### FR-009: Elaboration State Tracking

The system MUST track elaboration usage per step in meta.json for session management and analytics.

**Acceptance Criteria:**

- AC-009-01: Given the user enters elaboration mode for step 01-03, When elaboration completes, Then meta.json is updated with an elaboration record: `elaborations: [{ "step_id": "01-03", "turn_count": N, "personas_active": ["business-analyst", "solutions-architect", "system-designer"], "timestamp": "..." }]`.
- AC-009-02: Given meta.json has no `elaborations` field, When the first elaboration occurs, Then the field is initialized as an empty array and the first record is appended.
- AC-009-03: Given a session is resumed after elaboration occurred in a previous session, When the roundtable agent loads context, Then it reads the elaborations array and can reference previous elaboration insights in the context recovery message.
- AC-009-04: Given the user re-enters elaboration for a step that was previously elaborated, When the second elaboration completes, Then a new record is appended (not replaced), allowing multiple elaboration passes per step.

### FR-010: Persona Voice Integrity During Elaboration

The system MUST maintain distinct persona voices during multi-persona elaboration, preventing voice blending or generic "committee" responses.

**Acceptance Criteria:**

- AC-010-01: Given Maya speaks during elaboration, When she contributes, Then she probes assumptions, asks "why" and "what if", and challenges vague statements -- consistent with her defined communication style.
- AC-010-02: Given Alex speaks during elaboration, When he contributes, Then he focuses on tradeoffs, blast radius, risk, and architectural implications -- consistent with his defined communication style.
- AC-010-03: Given Jordan speaks during elaboration, When he contributes, Then he focuses on interfaces, concrete specifications, error handling, and implementation precision -- consistent with his defined communication style.
- AC-010-04: Given any persona speaks during elaboration, When their contribution is reviewed, Then their voice is distinguishable from other personas without needing to read the attribution prefix.

---

## 7. Out of Scope

- **Persistent elaboration memory across items**: Elaboration insights are captured in artifacts for the current item only. Personas do not remember elaboration discussions from other analyzed items.
- **User-defined personas**: Only the three built-in personas (Maya, Alex, Jordan) participate in elaboration. Custom personas are not supported.
- **Mid-step elaboration**: Elaboration is triggered only at step boundary menus (`[E]` option). It cannot be triggered during a step's question-answer flow.
- **Automated elaboration triggers**: Elaboration is always user-initiated. The system does not automatically enter elaboration based on topic complexity.
- **Parallel persona execution**: All personas run sequentially within a single agent context. There is no parallel delegation to separate agents.
- **Critic/Refiner at step boundaries (#22)**: This feature establishes the multi-persona discussion pattern but does not integrate the transparent critic/refiner workflow.
- **Changes to step file schema**: Existing step files are unchanged. Elaboration operates on the step's output and topic, not on step file content.
- **Elaboration during build verb**: Elaboration is analyze-only, consistent with the roundtable agent's scope.

---

## 8. MoSCoW Prioritization

| Priority | Requirements | Count |
|----------|-------------|-------|
| Must Have | FR-001, FR-002, FR-003, FR-004, FR-006, FR-008, FR-010 | 7 |
| Should Have | FR-005, FR-007, FR-009 | 3 |
| Could Have | -- | 0 |
| Won't Have (this release) | See Out of Scope | -- |

### Must Have (MVP)

| ID | Requirement | Rationale |
|----|-------------|-----------|
| FR-001 | Elaboration Mode Entry | Core entry mechanism; without this the feature does not exist |
| FR-002 | Multi-Persona Participation | Defining characteristic; single-persona deep mode already exists as fallback |
| FR-003 | User Participation and Persona Addressing | User must be an active participant, not a passive observer |
| FR-004 | Topic-Focused Discussion | Without focus, elaboration devolves into unfocused chat |
| FR-006 | Elaboration Mode Exit | Users must be able to return to the step workflow |
| FR-008 | Discussion Synthesis | Without synthesis, elaboration insights are lost (not captured in artifacts) |
| FR-010 | Persona Voice Integrity | Without distinct voices, multi-persona discussion provides no value over deep mode |

### Should Have

| ID | Requirement | Rationale |
|----|-------------|-----------|
| FR-005 | Cross-Talk Between Personas | Enriches discussion quality but personas can discuss without explicit cross-references |
| FR-007 | Turn Limits | Important guardrail but the lead persona can manually wrap up discussions |
| FR-009 | Elaboration State Tracking | Analytics and resume support; the feature works without persistent tracking |

---

## 9. Constraints

### CON-001: Single Agent File

Elaboration mode MUST be implemented within the existing `roundtable-analyst.md` agent. No new agent files are created. Multi-persona discussion is orchestrated by the single agent adopting multiple personas sequentially.

### CON-002: Analyze Verb Only

Elaboration mode is only available during the analyze verb workflow. It does not affect the build verb.

### CON-003: No State.json Writes

All elaboration tracking uses meta.json in the artifact folder. No writes to `.isdlc/state.json`.

### CON-004: Single-Line Bash Convention

Any Bash commands in the elaboration handler follow the single-line convention from CLAUDE.md.

### CON-005: Sequential Persona Execution

All personas are simulated by the same agent within a single context window. Cross-talk is generated sequentially. There is no parallel agent delegation for elaboration mode.

### CON-006: Step File Immutability

Elaboration mode does not modify step file content or schema. It operates on the output and topic of the current step.

---

## 10. Assumptions

### ASM-001: REQ-0027 Is Complete and Stable

The roundtable agent (REQ-0027) is implemented with persona definitions, step execution engine, menu system, and session management. The elaboration stub at section 4.4 is the designated integration point.

### ASM-002: Meta.json Schema Is Extensible

The meta.json schema supports adding new optional fields (`elaborations` array) without breaking existing consumers. This is the same assumption validated in REQ-0027.

### ASM-003: Context Window Capacity

A 10-turn elaboration discussion (with 3 personas plus user contributions) fits within the available context window alongside the current step context, artifact content, and agent instructions.

### ASM-004: Step Outputs Field Is Reliable

Each step file's `outputs` field accurately lists the artifact files that the step contributes to. The synthesis handler uses this field to determine which artifacts to update.

---

## 11. Glossary

| Term | Definition |
|------|-----------|
| **Elaboration mode** | A multi-persona discussion mode triggered by the user at a step boundary, where all three personas (Maya, Alex, Jordan) discuss the current topic collaboratively. |
| **Cross-talk** | When personas reference each other's points during discussion, building on or challenging contributions by name. |
| **Lead persona** | The persona who owns the current analysis phase and frames the elaboration topic. Maya leads during Phases 00-01, Alex during Phases 02-03, Jordan during Phase 04. |
| **Turn** | One contribution in the elaboration discussion -- either a persona speaking or the user contributing. |
| **Turn limit** | The maximum number of turns allowed in a single elaboration session (default: 10). |
| **Synthesis** | The process of compressing the elaboration discussion into structured insights and updating artifacts with enriched content. |
| **Persona addressing** | When the user directs a question or comment to a specific persona by name during elaboration. |
| **Topic focus** | The constraint that elaboration discussion stays scoped to the current step's topic, with the lead persona redirecting off-topic drift. |
| **Elaboration record** | A JSON object in meta.json tracking one elaboration session: step_id, turn count, active personas, and timestamp. |

---

## 12. Non-Functional Requirements

### NFR-001: Elaboration Entry Responsiveness

Elaboration mode activation (from [E] selection to first persona introduction) MUST complete promptly.

- Metric: First persona introduction displayed within 3 seconds of [E] selection.
- Measurement: Manual observation during testing.
- Priority: Should Have

### NFR-002: Persona Voice Distinctiveness

Each persona's contributions during elaboration MUST be distinguishable by communication style without reading the attribution prefix.

- Metric: In a blind review of 5 elaboration transcripts, a reader can correctly identify the persona for >= 80% of contributions based on style alone.
- Measurement: Manual review during acceptance testing.
- Priority: Must Have

### NFR-003: Synthesis Completeness

The elaboration synthesis MUST capture all decisions and key insights from the discussion.

- Metric: Zero decisions made during elaboration are missing from the synthesis summary.
- Measurement: Compare synthesis output against full discussion transcript during testing.
- Priority: Must Have

### NFR-004: Artifact Integrity After Synthesis

Artifact updates from elaboration synthesis MUST NOT corrupt or overwrite existing artifact content.

- Metric: Pre-elaboration artifact content is preserved (diff shows additions only, no deletions of pre-existing content).
- Measurement: Diff analysis of artifacts before and after elaboration.
- Priority: Must Have

### NFR-005: Session Resume After Elaboration

Session resume MUST work correctly after elaboration has occurred.

- Metric: After elaboration on step N, resuming the session starts at step N+1 (or re-presents step N menu if step was not advanced). Elaboration records in meta.json are preserved.
- Measurement: Session resume test after forced interruption post-elaboration.
- Priority: Must Have

### NFR-006: Turn Limit Enforcement

The turn limit MUST be enforced reliably to prevent context window overflow.

- Metric: No elaboration session exceeds the configured max_turns (default: 10).
- Measurement: Turn counting in elaboration records.
- Priority: Should Have

### NFR-007: Elaboration Backward Compatibility

Adding elaboration support MUST NOT break the existing [C], [S], and natural-input menu behaviors.

- Metric: All existing menu options ([C] Continue, [S] Skip, natural language input) work identically before and after elaboration mode implementation.
- Measurement: Regression testing of menu system.
- Priority: Must Have

---

## 13. Persona Specifications for Elaboration Mode

The three personas defined in REQ-0027 are reused during elaboration with the following elaboration-specific behavioral guidelines.

### 13.1 Maya Chen (Business Analyst) -- Elaboration Behavior

- **Elaboration Role**: Grounds the discussion in user needs and business value. Challenges technical solutions that lack clear user benefit.
- **Elaboration Patterns**:
  - "Before we go deeper on the technical approach, who benefits from this?"
  - "Alex, your architecture suggestion sounds right, but what does the user see? Jordan, how would this surface in the interface?"
  - Summarizes points of agreement and flags unresolved tensions.

### 13.2 Alex Rivera (Solutions Architect) -- Elaboration Behavior

- **Elaboration Role**: Assesses technical feasibility, identifies blast radius, and presents tradeoffs. Bridges business requirements and design constraints.
- **Elaboration Patterns**:
  - "Maya's requirement for {X} implies we need {Y} at the architecture level. That has implications for..."
  - "Jordan, if we go with this approach, your interface contract would need to account for..."
  - Presents multiple options when the group reaches a decision point.

### 13.3 Jordan Park (System Designer) -- Elaboration Behavior

- **Elaboration Role**: Translates discussion into concrete specifications. Identifies interface contracts, data structures, and error handling implications.
- **Elaboration Patterns**:
  - "To make this concrete: the function signature would be `f(input) -> output`, with error case {E}."
  - "Maya, your acceptance criterion for {X} would translate to this test: Given {context}, When {action}, Then {outcome}."
  - Flags when discussion is too abstract to implement.

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-20 | Requirements Analyst (Phase 01) | Initial specification |
