# Requirements Specification: Roundtable Analysis Agent with Named Personas

**Feature ID**: REQ-ROUNDTABLE-ANALYST
**Source**: GitHub Issue #20 / Backlog Item #20
**Scope**: Feature
**Complexity**: Medium (~18-25 files)
**Depends On**: #19 (Three-verb backlog model) -- CONFIRMED COMPLETE
**Enables**: #21 (Elaboration mode), #22 (Transparent Critic/Refiner)

---

## 1. Project Overview

### 1.1 Problem Statement

The current `/isdlc analyze` verb delegates to individual phase agents (quick-scan-agent, requirements-analyst, impact-analysis-orchestrator, solution-architect, system-designer) in sequence. Each agent runs in isolation with its own system prompt, producing artifacts without conversational engagement. The user is passive during the most important decision-making phases -- they provide a description upfront and receive artifacts at the end. There is no persona continuity across phases, no adaptive depth based on complexity, and no way to resume a multi-phase analysis session mid-step.

Specific deficiencies:

1. **No conversational engagement during analysis**: Phase agents produce artifacts without user dialogue. The requirements-analyst has a conversational mode (A/R/C menus) but only when invoked through the build workflow, not through the analyze verb.
2. **No persona continuity**: Each phase agent has a different identity, tone, and approach. The user experiences jarring context switches between phases.
3. **No adaptive depth**: A trivial config change gets the same treatment as a complex architectural feature -- full multi-step discovery in every case.
4. **No step-level resumability**: The analyze verb tracks phase completion but not step-level progress within a phase. If a user stops mid-requirements-gathering, they restart the entire phase.
5. **No menu system during analysis**: The analyze verb offers only `[Y/n]` at phase boundaries. There is no elaboration option, no way to drill deeper.

### 1.2 Business Drivers

- **User engagement**: The analysis phases (00-04) are where the most critical decisions are made. Passive artifact generation misses domain expertise that only the user can provide.
- **Quality of artifacts**: Interactive analysis with adaptive depth produces better requirements, architecture, and design documents because the user validates assumptions in real time.
- **Session flexibility**: Developers work in bursts. A resumable step-file architecture lets them analyze in multiple sessions without losing context.
- **Foundation for ecosystem**: This feature enables #21 (Elaboration mode), #22 (Transparent Critic/Refiner), and future persona-based workflows.
- **BMAD alignment**: The BMAD methodology's party-mode pattern demonstrates that persona-driven interactive sessions produce higher-quality outputs than isolated agent runs.

### 1.3 Success Metrics

- SM-001: Users engage in at least 2 conversational exchanges per analysis phase (measured by step completion logs in meta.json).
- SM-002: Analysis artifacts produced through the roundtable agent contain zero `[NEEDS CLARIFICATION]` markers (compared to current baseline).
- SM-003: Session resumability works within 5 seconds of starting the analyze verb on a partially-completed item.
- SM-004: Simple items (quick-scan scope: small, fewer than 5 affected files) complete analysis in under 50% of the time compared to the full interactive flow.
- SM-005: All existing analyze verb behaviors continue to work (backward compatibility).

### 1.4 Scope Boundaries

**In Scope:**
- New roundtable-analyst agent (`src/claude/agents/roundtable-analyst.md`) that replaces direct phase-agent delegation during analyze
- Three named personas with defined identities, communication styles, and principles
- Phase-to-persona mapping (BA: Phases 00-01, Architect: Phases 02-03, Designer: Phase 04)
- Step-file architecture: each analysis step is a self-contained `.md` file under `src/claude/skills/analysis-steps/`
- Adaptive depth logic: complexity-based branching between brief confirmation and full discussion modes
- Step-level progress tracking in meta.json (extending existing `phases_completed` with step-level granularity)
- Menu system at each step: `[E] Elaboration Mode` / `[C] Continue` / natural conversation
- Integration with existing analyze verb handler in `isdlc.md`
- Backward compatibility: non-roundtable analysis still works if roundtable agent is absent

**Out of Scope (this release):**
- Elaboration mode implementation (#21) -- the `[E]` menu option is wired but delegates to a stub that says "Elaboration mode coming soon"
- Transparent Critic/Refiner at step boundaries (#22) -- step boundaries exist but Critic/Refiner integration is deferred
- Changes to the build verb behavior
- Changes to the add verb behavior
- Changes to the existing phase agents (they remain for build workflow use)
- Persona selection by user (personas are fixed per phase)
- Custom persona definitions by users

---

## 2. Stakeholders and Personas

### 2.1 Primary Persona: Framework User (Developer)

- **Role**: Software developer using iSDLC to analyze backlog items before building them
- **Goals**: Have an interactive, guided analysis experience that surfaces the right questions and produces high-quality artifacts
- **Pain Points**: Current analysis is passive; artifacts generated without input miss domain context; no way to resume mid-phase
- **Technical Proficiency**: Intermediate to advanced; CLI-comfortable
- **Key Tasks**: Runs `/isdlc analyze "feature-name"` and expects an interactive conversation that produces requirements, architecture, and design documents

### 2.2 Secondary Persona: Framework Maintainer

- **Role**: Developer maintaining/extending the iSDLC framework (dogfooding)
- **Goals**: Clean separation between roundtable agent and existing phase agents; extensible step-file system; no regression in build workflow
- **Pain Points**: Adding new analysis steps or personas should not require modifying the core agent; step files should be self-contained
- **Key Tasks**: Adds new step files, tunes persona definitions, extends adaptive depth rules

---

## 3. Functional Requirements

### FR-001: Roundtable Agent Definition

The system MUST provide a single roundtable-analyst agent that serves as the primary analysis coordinator during the analyze verb, wearing different persona hats depending on the current phase.

**Acceptance Criteria:**

- AC-001-01: Given the file `src/claude/agents/roundtable-analyst.md` exists, When the analyze verb handler reads the PHASE-to-AGENT table, Then the roundtable-analyst is the agent delegated to for phases 00-04 during analyze (not build).
- AC-001-02: Given the roundtable-analyst agent is loaded, When it receives a delegation prompt for a specific phase, Then it adopts the persona assigned to that phase and uses that persona's communication style for all user interactions during that phase.
- AC-001-03: Given the roundtable-analyst agent is loaded, When it begins a phase, Then it reads the step files for that phase from `src/claude/skills/analysis-steps/{phase-key}/` and executes them in order.
- AC-001-04: Given the roundtable-analyst agent frontmatter, When parsed, Then it declares `model: opus` and lists owned skills including all analysis-step skill IDs.

### FR-002: Persona Definitions

The system MUST define three named personas, each with a distinct identity, communication style, and set of guiding principles.

**Acceptance Criteria:**

- AC-002-01: Given the Business Analyst persona definition, When loaded by the roundtable agent, Then it contains: a human name, a one-line identity statement, a communication style descriptor (e.g., "probing, detail-oriented, challenges assumptions"), and at least 3 guiding principles.
- AC-002-02: Given the Solutions Architect persona definition, When loaded by the roundtable agent, Then it contains: a human name, a one-line identity statement, a communication style descriptor (e.g., "strategic, tradeoff-focused, risk-aware"), and at least 3 guiding principles.
- AC-002-03: Given the System Designer persona definition, When loaded by the roundtable agent, Then it contains: a human name, a one-line identity statement, a communication style descriptor (e.g., "precise, interface-focused, pragmatic"), and at least 3 guiding principles.
- AC-002-04: Given any persona definition, When the persona is active, Then the roundtable agent's responses reflect that persona's communication style consistently throughout the phase. The persona name is used in the step header (e.g., "Maya (Business Analyst) -- Step 1.2: User Needs Discovery").
- AC-002-05: Given any persona definition, When the persona transitions at a phase boundary, Then the agent explicitly introduces the next persona: "Handing off to {name} ({role}) for {phase description}."

### FR-003: Phase-to-Persona Mapping

The system MUST map each analysis phase to exactly one persona.

**Acceptance Criteria:**

- AC-003-01: Given the analyze verb starts Phase 00 (Quick Scan), When the roundtable agent activates, Then the Business Analyst persona leads the phase.
- AC-003-02: Given the analyze verb starts Phase 01 (Requirements), When the roundtable agent activates, Then the Business Analyst persona leads the phase.
- AC-003-03: Given the analyze verb starts Phase 02 (Impact Analysis), When the roundtable agent activates, Then the Solutions Architect persona leads the phase.
- AC-003-04: Given the analyze verb starts Phase 03 (Architecture), When the roundtable agent activates, Then the Solutions Architect persona leads the phase.
- AC-003-05: Given the analyze verb starts Phase 04 (Design), When the roundtable agent activates, Then the System Designer persona leads the phase.
- AC-003-06: Given the mapping is defined, When a new phase key not in the mapping is encountered, Then the roundtable agent falls back to the Business Analyst persona and logs a warning.

### FR-004: Step-File Architecture

The system MUST implement an analysis step-file architecture where each step within a phase is a self-contained markdown file that the roundtable agent loads and executes sequentially.

**Acceptance Criteria:**

- AC-004-01: Given the directory `src/claude/skills/analysis-steps/{phase-key}/`, When populated, Then it contains one or more `.md` step files named with a numeric prefix (e.g., `01-scope-estimation.md`, `02-keyword-search.md`).
- AC-004-02: Given a step file, When parsed, Then it contains a YAML frontmatter section with fields: `step_id` (unique string, e.g., `"00-01"`), `title` (display name), `persona` (which persona leads this step), `depth` (one of `"brief"`, `"standard"`, `"deep"`), and `outputs` (list of artifact keys this step produces or updates).
- AC-004-03: Given a step file body, When executed, Then the body contains: the questions/prompts the persona asks the user, the validation criteria for the user's response, the artifact updates to perform after user confirmation, and the menu options to present.
- AC-004-04: Given multiple step files in a phase directory, When the roundtable agent executes the phase, Then it loads all step files sorted by numeric prefix and executes them in ascending order, tracking completion of each step.
- AC-004-05: Given a step file with `depth: "brief"`, When the adaptive depth selector (FR-006) determines brief mode, Then the step presents a condensed version (single confirmation prompt instead of multi-question discovery).
- AC-004-06: Given a step file with `depth: "deep"`, When the adaptive depth selector determines deep mode, Then the step presents the full multi-question discovery flow with follow-up probing.

### FR-005: Step-Level Progress Tracking

The system MUST track analysis progress at the step level within meta.json, enabling mid-step resumability.

**Acceptance Criteria:**

- AC-005-01: Given meta.json for an item, When the roundtable agent completes a step, Then `meta.steps_completed` is updated to include the step_id (e.g., `["00-01", "00-02", "01-01"]`).
- AC-005-02: Given meta.json with `steps_completed: ["00-01", "00-02", "01-01", "01-02"]`, When the analyze verb resumes for this item, Then the roundtable agent skips completed steps and begins at the first incomplete step within the current phase.
- AC-005-03: Given meta.json with `steps_completed` containing all steps for phases 00 and 01, When the analyze verb resumes, Then the roundtable agent starts at the first step of Phase 02 and the Solutions Architect persona is activated.
- AC-005-04: Given an item with no `steps_completed` field in meta.json, When the analyze verb starts, Then the field is initialized to an empty array and the roundtable agent starts from step 1 of the first incomplete phase.
- AC-005-05: Given a step is completed, When meta.json is updated, Then the write uses the existing `writeMetaJson()` utility from `three-verb-utils.cjs` (extending it to handle the new `steps_completed` field without breaking existing callers).

### FR-006: Adaptive Depth Logic

The system MUST select analysis depth (brief vs. standard vs. deep) based on the item's complexity, determined by quick-scan results or explicit user override.

**Acceptance Criteria:**

- AC-006-01: Given the quick-scan output indicates scope "small" (fewer than 5 affected files, complexity "low"), When the roundtable agent begins Phase 01 (Requirements), Then it selects "brief" depth for all steps in that phase and confirms with the user: "This looks straightforward. I'll keep the analysis brief -- say 'deep' if you want the full treatment."
- AC-006-02: Given the quick-scan output indicates scope "medium" (5-15 affected files, complexity "medium"), When the roundtable agent begins a phase, Then it selects "standard" depth for all steps.
- AC-006-03: Given the quick-scan output indicates scope "large" (more than 15 affected files, complexity "high" or "large"), When the roundtable agent begins a phase, Then it selects "deep" depth for all steps and informs the user: "This is a substantial change. I'll do a thorough analysis."
- AC-006-04: Given any depth selection, When the user says "deep", "more detail", "let's dig in", or similar, Then the roundtable agent switches to "deep" depth for the current and subsequent steps in the current phase (user override).
- AC-006-05: Given any depth selection, When the user says "brief", "skip ahead", "keep it short", or similar, Then the roundtable agent switches to "brief" depth for the current and subsequent steps in the current phase (user override).
- AC-006-06: Given depth is selected for a phase, When stored in meta.json, Then it is recorded as `meta.depth_overrides[{phase-key}]` so that resumed sessions use the same depth.
- AC-006-07: Given no quick-scan output exists (Phase 00 has not yet run), When the roundtable agent begins Phase 00, Then it defaults to "standard" depth.

### FR-007: Step Menu System

The system MUST present a consistent menu at each step boundary, allowing the user to control the analysis flow.

**Acceptance Criteria:**

- AC-007-01: Given a step is completed and the step's output has been presented, When the roundtable agent awaits user input, Then it displays: `[E] Elaboration Mode -- bring all perspectives to discuss this topic` / `[C] Continue -- move to the next step` / or the user can type naturally to ask questions or provide feedback.
- AC-007-02: Given the user selects `[C]`, When processed, Then the roundtable agent advances to the next step in the current phase.
- AC-007-03: Given the user selects `[E]`, When processed, Then the roundtable agent acknowledges the request and informs the user that elaboration mode is not yet available: "Elaboration mode is coming in a future update (#21). For now, I'll go deeper on this topic myself." The agent then switches to "deep" depth for the current step and re-engages with more probing questions.
- AC-007-04: Given the user types a natural language response (not a menu command), When processed, Then the roundtable agent incorporates the user's input into the current step's analysis, updates artifacts accordingly, and re-presents the step menu.
- AC-007-05: Given the last step of a phase is completed, When the step menu would be presented, Then instead of `[C] Continue`, the menu shows `[C] Continue to {next phase name}` (or `[C] Complete analysis` if this is the final phase).
- AC-007-06: Given a step is completed, When the menu is presented, Then the menu also includes `[S] Skip remaining steps in this phase` which advances to the next phase boundary.

### FR-008: Persona Transition Protocol

The system MUST manage transitions between personas at phase boundaries with explicit handoff communication.

**Acceptance Criteria:**

- AC-008-01: Given the Business Analyst persona completes Phase 01 (Requirements), When Phase 02 (Impact Analysis) begins, Then the roundtable agent displays: "{BA name} has finished requirements discovery. Handing off to {Architect name} ({role}) who will assess the impact and design the architecture."
- AC-008-02: Given the Solutions Architect persona completes Phase 03 (Architecture), When Phase 04 (Design) begins, Then the roundtable agent displays a similar handoff message introducing the System Designer persona.
- AC-008-03: Given a persona transition occurs, When the new persona activates, Then the new persona provides a brief summary of what the previous persona produced: "I've reviewed {previous persona}'s {artifact type}. Here's what I'm working with: {1-2 sentence summary}."
- AC-008-04: Given a persona transition occurs, When the new persona activates, Then the communication style, tone, and question types change to match the new persona's definition.

### FR-009: Analyze Verb Integration

The system MUST integrate the roundtable agent into the existing analyze verb handler in `isdlc.md` without breaking existing behavior.

**Acceptance Criteria:**

- AC-009-01: Given the analyze verb handler reaches step 7 ("For each remaining phase..."), When the roundtable-analyst agent file exists at `src/claude/agents/roundtable-analyst.md`, Then the handler delegates to `roundtable-analyst` instead of the standard phase agent for that phase.
- AC-009-02: Given the analyze verb handler delegates to the roundtable agent, When constructing the Task prompt, Then it includes: the item slug, the current phase key, the meta.json content (including steps_completed), the adaptive depth context (quick-scan results if available), and the artifact folder path.
- AC-009-03: Given the roundtable agent completes a phase, When control returns to the analyze verb handler, Then the handler updates meta.json (phases_completed, steps_completed, codebase_hash) and offers the standard exit point: "Phase {NN} complete. Continue to Phase {NN+1}? [Y/n]".
- AC-009-04: Given the roundtable-analyst agent file does NOT exist, When the analyze verb handler reaches step 7, Then it falls back to the standard phase agent delegation (existing behavior preserved).

### FR-010: Artifact Production Compatibility

The system MUST produce the same artifact files as the existing phase agents, ensuring downstream compatibility with the build verb and all subsequent phases.

**Acceptance Criteria:**

- AC-010-01: Given the roundtable agent completes Phase 00 (Quick Scan), When artifacts are written, Then `quick-scan.md` exists in the artifact folder with the same structure and content sections as the quick-scan-agent would produce.
- AC-010-02: Given the roundtable agent completes Phase 01 (Requirements), When artifacts are written, Then `requirements-spec.md`, `user-stories.json`, and `traceability-matrix.csv` exist in the artifact folder. The `nfr-matrix.md` is written to `docs/common/nfr-matrix.md` (or updated if it exists).
- AC-010-03: Given the roundtable agent completes Phase 02 (Impact Analysis), When artifacts are written, Then `impact-analysis.md` exists in the artifact folder with blast-radius, entry-points, and risk-zones sections.
- AC-010-04: Given the roundtable agent completes Phase 03 (Architecture), When artifacts are written, Then architecture documents (architecture-overview.md, ADRs) exist in the appropriate docs folder.
- AC-010-05: Given the roundtable agent completes Phase 04 (Design), When artifacts are written, Then design documents (module-designs, interface-spec) exist in the appropriate docs folder.
- AC-010-06: Given artifacts produced by the roundtable agent, When the build verb auto-detection logic reads meta.json and checks for artifact existence, Then all expected artifacts are found and the build proceeds without re-running analysis phases.

### FR-011: Session Greeting and Context Recovery

The system MUST provide contextual greetings when starting or resuming an analysis session.

**Acceptance Criteria:**

- AC-011-01: Given a new analysis session (no steps_completed), When the roundtable agent starts, Then the active persona introduces themselves: "Hi, I'm {name}, your {role}. I'll be guiding you through {phase description}. Let's get started."
- AC-011-02: Given a resumed analysis session (steps_completed is non-empty for the current phase), When the roundtable agent starts, Then the active persona provides a context recovery message: "Welcome back. Last time we completed {summary of completed steps}. Let's pick up from {next step name}."
- AC-011-03: Given a resumed session where the phase has changed since last time, When the roundtable agent starts, Then the persona transition protocol (FR-008) fires before the context recovery message.

### FR-012: Step File Schema for Analysis Steps

The system MUST define a standard schema for step files that enables the roundtable agent to load, parse, and execute them.

**Acceptance Criteria:**

- AC-012-01: Given a step file in `src/claude/skills/analysis-steps/{phase-key}/`, When its YAML frontmatter is parsed, Then it MUST contain these required fields: `step_id` (string, globally unique), `title` (string, display name), `persona` (string, one of "business-analyst", "solutions-architect", "system-designer"), `depth` (string, one of "brief", "standard", "deep"), `outputs` (array of strings, artifact keys this step contributes to).
- AC-012-02: Given a step file, When its YAML frontmatter is parsed, Then it MAY contain these optional fields: `depends_on` (array of step_ids that must complete first), `skip_if` (condition expression for skipping this step, e.g., "scope === 'small'").
- AC-012-03: Given the step file body (after frontmatter), When parsed by the roundtable agent, Then it contains structured sections: `## Brief Mode` (condensed prompts for brief depth), `## Standard Mode` (default prompts), `## Deep Mode` (extended prompts with follow-up probing), `## Validation` (criteria for evaluating user responses), `## Artifacts` (instructions for updating artifacts after this step).
- AC-012-04: Given a step file references an artifact key in `outputs`, When the step completes, Then the roundtable agent updates or creates the corresponding artifact file in the artifact folder.

---

## 4. Non-Functional Requirements

### NFR-001: Step Transition Performance

Analysis step transitions (loading the next step file, updating meta.json, presenting the menu) MUST complete within measurable time bounds.

**Acceptance Criteria:**

- AC-NFR-001-01: Given a step completes and the next step begins, When the transition occurs, Then the time between the user selecting `[C]` and the next step's first prompt appearing is under 3 seconds (measured from meta.json write completion to first output token).
- AC-NFR-001-02: Given a phase boundary transition with persona handoff, When the transition occurs, Then the handoff message and first step prompt appear within 5 seconds.

### NFR-002: Persona Switch Consistency

Persona transitions MUST be seamless with no artifacts from the previous persona leaking into the new persona's communication.

**Acceptance Criteria:**

- AC-NFR-002-01: Given a transition from the Business Analyst to the Solutions Architect persona, When the architect starts speaking, Then the communication style matches the architect's definition (strategic, tradeoff-focused) and does NOT contain BA-style probing questions about user pain points.
- AC-NFR-002-02: Given any persona is active, When the persona responds to the user, Then the persona name is included in the step header but NOT repeated in every message body (avoiding "As {name}, I think..." repetition).

### NFR-003: Session Resumability

The system MUST support session resumability with fast context recovery.

**Acceptance Criteria:**

- AC-NFR-003-01: Given a previously started analysis with N steps completed, When the user runs `/isdlc analyze "{item}"` again, Then the roundtable agent resumes at step N+1 within 5 seconds (including meta.json read, step file load, and context recovery message).
- AC-NFR-003-02: Given a session is interrupted at any point (user closes terminal, network drop, etc.), When the user resumes, Then no work from completed steps is lost (all step outputs are persisted to artifacts and meta.json before the step menu is presented).
- AC-NFR-003-03: Given a resumed session, When the roundtable agent loads context, Then it reads only meta.json and the relevant artifact files (not the entire conversation history -- context is reconstructed from artifacts, not replayed).

### NFR-004: Extensibility

The step-file architecture MUST support adding new steps and personas without modifying the core roundtable agent.

**Acceptance Criteria:**

- AC-NFR-004-01: Given a developer adds a new step file to `src/claude/skills/analysis-steps/{phase-key}/`, When the roundtable agent next runs that phase, Then it automatically discovers and executes the new step in its numeric-prefix order.
- AC-NFR-004-02: Given a developer adds a new persona definition to the persona configuration section of the roundtable agent, When a step file references that persona in its frontmatter, Then the roundtable agent uses the new persona for that step.
- AC-NFR-004-03: Given a developer modifies a step file, When the roundtable agent next executes that step, Then the modified content is used (no caching of step files across sessions).

### NFR-005: Backward Compatibility

The roundtable agent MUST NOT break existing analyze verb behavior or build verb auto-detection.

**Acceptance Criteria:**

- AC-NFR-005-01: Given the roundtable-analyst agent file is removed or renamed, When the analyze verb handler runs, Then it falls back to standard phase-agent delegation (FR-009 AC-009-04) with zero errors.
- AC-NFR-005-02: Given the roundtable agent produces artifacts, When the build verb reads meta.json, Then `phases_completed` and `analysis_status` are set correctly and the build auto-detection logic works identically to before.
- AC-NFR-005-03: Given the roundtable agent is active, When it writes meta.json, Then it uses the existing `writeMetaJson()` utility and the resulting file is readable by `readMetaJson()` and all existing consumers.
- AC-NFR-005-04: Given the existing phase agents (requirements-analyst, solution-architect, system-designer), When the build verb (not analyze verb) delegates to phase agents, Then the existing agents are still used (roundtable agent is analyze-only).

### NFR-006: Conversational UX Quality

The roundtable agent MUST maintain a natural conversational feel throughout analysis.

**Acceptance Criteria:**

- AC-NFR-006-01: Given any persona is active, When it asks questions, Then questions are open-ended and domain-focused, not yes/no checkboxes. Example: "What happens when a payment fails mid-transaction?" not "Does the system handle payment failures? [Y/N]".
- AC-NFR-006-02: Given the user provides a response, When the persona processes it, Then the persona acknowledges the response with a brief reflection ("That's important -- so retry logic is critical here") before moving to the next question or topic.
- AC-NFR-006-03: Given the analysis is in "brief" depth mode, When the persona presents a step, Then it presents a draft summary for confirmation rather than asking questions from scratch: "Based on the quick scan, here are the 3 main requirements I see: {list}. Sound right, or should we dig deeper?"

---

## 5. Constraints

### CON-001: Single Agent File

The roundtable analyst MUST be implemented as a single agent file (`src/claude/agents/roundtable-analyst.md`). Persona definitions live within this agent file, not as separate agent files. This avoids increasing the agent count and keeps persona switching within a single agent context.

### CON-002: Analyze Verb Only

The roundtable agent MUST only be activated during the analyze verb. The build verb continues to use the existing individual phase agents. This ensures the build workflow (which does not need interactive analysis) is unaffected.

### CON-003: No State.json Writes

Per the analyze verb design (REQ-0023), the roundtable agent MUST NOT write to `.isdlc/state.json`. All progress tracking is through meta.json in the artifact folder. This constraint is inherited from the three-verb model.

### CON-004: Single-Line Bash Convention

All Bash commands within step files and the roundtable agent MUST follow the single-line Bash convention defined in CLAUDE.md. No multiline Bash commands.

### CON-005: Step File Location

Step files MUST be located under `src/claude/skills/analysis-steps/{phase-key}/` and follow the naming convention `{NN}-{step-name}.md` where NN is a zero-padded two-digit number.

### CON-006: Model Requirement

The roundtable agent MUST use `model: opus` in its frontmatter. Persona-driven interactive analysis requires the highest-capability model for natural conversation, nuanced persona voice, and adaptive depth.

---

## 6. Assumptions

### ASM-001: Three-Verb Model Exists

The three-verb model (add/analyze/build) from #19 (REQ-0023) is fully implemented and stable. The analyze verb handler in `isdlc.md` delegates to phase agents via the Task tool and tracks progress in meta.json.

### ASM-002: Meta.json Schema Is Extensible

The meta.json schema can be extended with new fields (`steps_completed`, `depth_overrides`) without breaking existing consumers. The `writeMetaJson()` and `readMetaJson()` utilities in `three-verb-utils.cjs` will be extended to handle these fields.

### ASM-003: Phase Agent Outputs Are Documented

The expected output artifacts for each phase (00-04) are well-documented in the existing phase agent files and gate validation logic, allowing the roundtable agent to produce compatible artifacts.

### ASM-004: Quick-Scan Results Are Available

When the roundtable agent begins Phase 01, the quick-scan output from Phase 00 is available in the artifact folder. This is used for adaptive depth determination (FR-006).

### ASM-005: Build Auto-Detection Is Stable

The build auto-detection from REQ-0026 (#23) is implemented and stable. The roundtable agent's meta.json updates are consumed by the build verb without modification.

---

## 7. Out of Scope

- **Elaboration mode (#21)**: The `[E]` menu option is wired but stubs to a message. Full multi-persona roundtable discussions are deferred.
- **Transparent Critic/Refiner (#22)**: Step boundaries exist but no Critic/Refiner invocation occurs at those boundaries. Deferred.
- **User-defined personas**: Personas are fixed in the agent file. Custom persona definitions are not supported in this release.
- **Persona memory across items**: Each analysis session starts fresh. Personas do not remember previous items analyzed.
- **Build verb changes**: The roundtable agent does not affect the build verb's phase agent delegation.
- **New skill IDs for analysis steps**: Analysis step files use a file-based architecture, not the skill manifest system. No new skill IDs are registered in skills-manifest.json for this feature (step files are loaded directly by the roundtable agent, not through the skill system).

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| **Persona** | A named character with a defined identity, communication style, and principles that the roundtable agent adopts during specific analysis phases. |
| **Step file** | A self-contained markdown file defining one analysis step, including prompts, validation criteria, and artifact update instructions. |
| **Adaptive depth** | The mechanism by which the roundtable agent selects between brief, standard, and deep analysis modes based on item complexity. |
| **Phase boundary** | The point between two adjacent analysis phases (e.g., between Phase 01 and Phase 02) where persona transitions occur. |
| **Step boundary** | The point between two adjacent steps within a phase where the step menu is presented. |
| **Roundtable** | The single agent that hosts all personas, switching between them based on the current phase. |
| **Elaboration mode** | A deferred feature (#21) where all personas engage in a multi-perspective discussion. Stubbed in this release. |
| **Brief mode** | Analysis depth for simple items: presents draft summaries for confirmation instead of multi-question discovery. |
| **Deep mode** | Analysis depth for complex items: full multi-question discovery with follow-up probing and edge case exploration. |
| **meta.json** | Per-item metadata file in the artifact folder tracking analysis progress, phase completion, step completion, and codebase hash. |

---

## 9. Persona Specifications

### 9.1 Business Analyst: Maya Chen

- **Name**: Maya Chen
- **Identity**: "I'm Maya, your Business Analyst. I make sure we understand the problem before we solve it."
- **Communication Style**: Probing, detail-oriented, challenges assumptions. Asks "why" and "what if" frequently. Summarizes what she heard before moving forward. Uses concrete examples to test understanding.
- **Phases**: 00-quick-scan, 01-requirements
- **Principles**:
  1. **Understand before solving**: Never accept a requirement at face value. Ask what problem it solves and who benefits.
  2. **Surface the unstated**: The most important requirements are often the ones nobody mentions. Probe for edge cases, error scenarios, and implicit assumptions.
  3. **Validate with examples**: Turn abstract requirements into concrete scenarios. "So if a user tries to X while Y is happening, what should occur?"
  4. **Prioritize ruthlessly**: Not everything is a Must Have. Challenge inflated priorities with "What happens if we ship without this?"

### 9.2 Solutions Architect: Alex Rivera

- **Name**: Alex Rivera
- **Identity**: "I'm Alex, your Solutions Architect. I think about how things fit together and what breaks when they don't."
- **Communication Style**: Strategic, tradeoff-focused, risk-aware. Presents options with pros/cons. Thinks in terms of blast radius and failure modes. Direct about technical debt and complexity costs.
- **Phases**: 02-impact-analysis, 03-architecture
- **Principles**:
  1. **Tradeoffs over dogma**: There are no perfect architectures, only appropriate ones. Present options with honest tradeoff analysis.
  2. **Blast radius awareness**: Every change has a blast radius. Understand it before committing. Small, contained changes are preferred over sweeping refactors.
  3. **Future-proof pragmatically**: Design for the next 6 months of known evolution, not the next 5 years of speculation. Avoid premature abstraction.
  4. **Risk appetite calibration**: Different teams and projects have different risk tolerances. Ask about risk appetite before recommending approaches.

### 9.3 System Designer: Jordan Park

- **Name**: Jordan Park
- **Identity**: "I'm Jordan, your System Designer. I turn architecture into interfaces, modules, and concrete designs you can build from."
- **Communication Style**: Precise, interface-focused, pragmatic. Thinks in terms of contracts, boundaries, and data flow. Shows concrete examples of function signatures, data structures, and module boundaries. Values clarity over cleverness.
- **Phases**: 04-design
- **Principles**:
  1. **Interfaces are contracts**: Define clear boundaries between modules. The interface is the promise -- get it right before worrying about implementation.
  2. **Design for the developer**: The person implementing this will read these designs. Be explicit about inputs, outputs, error handling, and edge cases.
  3. **Show, don't tell**: Use concrete code examples, data structures, and function signatures. Abstract descriptions lead to misinterpretation.
  4. **Simplicity is a feature**: The simplest design that meets requirements is the best design. Complexity must justify itself.

---

## 10. Step File Inventory

The following step files are required for the initial release. Each phase directory contains step files executed in numeric order.

### 10.1 Phase 00: Quick Scan (`analysis-steps/00-quick-scan/`)

| Step File | Step ID | Title | Depth | Outputs |
|-----------|---------|-------|-------|---------|
| `01-scope-estimation.md` | `00-01` | Scope Estimation | standard | quick-scan.md |
| `02-keyword-search.md` | `00-02` | Keyword Search | brief | quick-scan.md |
| `03-file-count.md` | `00-03` | File Count Estimation | brief | quick-scan.md |

### 10.2 Phase 01: Requirements (`analysis-steps/01-requirements/`)

| Step File | Step ID | Title | Depth | Outputs |
|-----------|---------|-------|-------|---------|
| `01-business-context.md` | `01-01` | Business Context Discovery | standard | requirements-spec.md |
| `02-user-needs.md` | `01-02` | User Needs Discovery | standard | requirements-spec.md |
| `03-ux-journey.md` | `01-03` | User Experience & Journeys | standard | requirements-spec.md |
| `04-technical-context.md` | `01-04` | Technical Context | standard | requirements-spec.md |
| `05-quality-risk.md` | `01-05` | Quality & Risk Assessment | standard | requirements-spec.md, nfr-matrix.md |
| `06-feature-definition.md` | `01-06` | Core Feature Definition | deep | requirements-spec.md |
| `07-user-stories.md` | `01-07` | User Story Writing | standard | user-stories.json |
| `08-prioritization.md` | `01-08` | MoSCoW Prioritization | brief | requirements-spec.md, traceability-matrix.csv |

### 10.3 Phase 02: Impact Analysis (`analysis-steps/02-impact-analysis/`)

| Step File | Step ID | Title | Depth | Outputs |
|-----------|---------|-------|-------|---------|
| `01-blast-radius.md` | `02-01` | Blast Radius Assessment | standard | impact-analysis.md |
| `02-entry-points.md` | `02-02` | Entry Point Identification | standard | impact-analysis.md |
| `03-risk-zones.md` | `02-03` | Risk Zone Analysis | deep | impact-analysis.md |
| `04-impact-summary.md` | `02-04` | Impact Summary & User Review | brief | impact-analysis.md |

### 10.4 Phase 03: Architecture (`analysis-steps/03-architecture/`)

| Step File | Step ID | Title | Depth | Outputs |
|-----------|---------|-------|-------|---------|
| `01-architecture-options.md` | `03-01` | Architecture Options & Tradeoffs | deep | architecture-overview.md |
| `02-technology-decisions.md` | `03-02` | Technology Decisions | standard | tech-stack-decision.md, ADRs |
| `03-integration-design.md` | `03-03` | Integration Architecture | standard | architecture-overview.md |
| `04-architecture-review.md` | `03-04` | Architecture Review & Approval | brief | architecture-overview.md |

### 10.5 Phase 04: Design (`analysis-steps/04-design/`)

| Step File | Step ID | Title | Depth | Outputs |
|-----------|---------|-------|-------|---------|
| `01-module-design.md` | `04-01` | Module Design & Boundaries | deep | module-designs/ |
| `02-interface-contracts.md` | `04-02` | Interface Contracts | deep | interface-spec.yaml |
| `03-data-flow.md` | `04-03` | Data Flow & State Management | standard | data-flow diagrams |
| `04-error-handling.md` | `04-04` | Error Handling & Validation | standard | error-taxonomy.md |
| `05-design-review.md` | `04-05` | Design Review & Approval | brief | All design artifacts |

---

## 11. User Stories

### US-001: Interactive Requirements Discovery

**As a** framework user,
**I want to** have an interactive conversation with a named Business Analyst persona during requirements analysis,
**So that** my domain knowledge is captured in the requirements and no implicit assumptions go unchallenged.

**Acceptance Criteria:**
- Given I run `/isdlc analyze "my-feature"` and Phase 00 is complete, When Phase 01 begins, Then Maya (Business Analyst) introduces herself and begins asking questions about business context.
- Given Maya asks me about user needs, When I provide a response, Then Maya reflects my answer back ("So the primary pain point is...") before moving to the next topic.
- Given a step is complete, When I see the menu, Then I can choose `[C]` to continue, `[E]` to elaborate, or type naturally.

**Linked Requirements:** FR-001, FR-002, FR-003, FR-007, FR-011

**Priority:** Must Have

### US-002: Adaptive Depth for Simple Items

**As a** framework user analyzing a simple config change,
**I want** the analysis to be brief and confirmation-oriented rather than a full multi-step discovery,
**So that** I don't spend 20 minutes analyzing a 2-file change.

**Acceptance Criteria:**
- Given quick-scan classified my item as "small" scope, When Phase 01 begins, Then Maya says "This looks straightforward. I'll keep it brief" and presents draft summaries for confirmation instead of open-ended questions.
- Given I'm in brief mode, When I want more detail, Then I can say "deep" or "more detail" to switch to full discovery mode.

**Linked Requirements:** FR-006, NFR-006

**Priority:** Must Have

### US-003: Resume Analysis Across Sessions

**As a** framework user who started analysis yesterday,
**I want to** resume where I left off without redoing completed steps,
**So that** I can analyze in multiple sessions without losing progress.

**Acceptance Criteria:**
- Given I completed steps 01-01 through 01-05 yesterday, When I run `/isdlc analyze "my-feature"` today, Then Maya says "Welcome back. Last time we covered business context through quality assessment. Let's pick up with feature definition."
- Given I completed all of Phase 01, When I resume, Then Alex (Solutions Architect) introduces himself and starts Phase 02 impact analysis.
- Given meta.json tracks my step progress, When I resume, Then the context recovery takes under 5 seconds.

**Linked Requirements:** FR-005, FR-008, FR-011, NFR-003

**Priority:** Must Have

### US-004: Persona Transitions at Phase Boundaries

**As a** framework user completing requirements analysis,
**I want** a clear handoff between the Business Analyst and Solutions Architect personas,
**So that** I understand the shift in focus and know who is guiding me next.

**Acceptance Criteria:**
- Given Maya completes Phase 01, When Phase 02 begins, Then I see a handoff message: "Maya has finished requirements discovery. Handing off to Alex Rivera (Solutions Architect)..."
- Given Alex starts Phase 02, When he introduces himself, Then he briefly summarizes what Maya produced before diving into impact analysis.

**Linked Requirements:** FR-008, NFR-002

**Priority:** Must Have

### US-005: Architecture Tradeoff Discussion

**As a** framework user during architecture analysis,
**I want** Alex (Solutions Architect) to present options with tradeoffs and ask about my risk appetite,
**So that** architectural decisions reflect my project's actual constraints rather than generic best practices.

**Acceptance Criteria:**
- Given Alex is analyzing architecture options, When he presents a decision, Then he shows at least 2 options with pros/cons and asks which aligns better with my constraints.
- Given I express a preference, When Alex processes it, Then he records my choice as an ADR with rationale.

**Linked Requirements:** FR-002, FR-010

**Priority:** Should Have

### US-006: Design with Concrete Examples

**As a** framework user during design analysis,
**I want** Jordan (System Designer) to show concrete code examples and interface definitions,
**So that** the design documents are implementable without ambiguity.

**Acceptance Criteria:**
- Given Jordan is designing module boundaries, When he presents a design, Then it includes function signatures, data structures, and error handling patterns.
- Given I approve a design, When the artifacts are written, Then they contain the concrete examples discussed, not just abstract descriptions.

**Linked Requirements:** FR-002, FR-010, FR-012

**Priority:** Should Have

### US-007: Backward-Compatible Analysis

**As a** framework maintainer,
**I want** the analyze verb to fall back to standard phase agents if the roundtable agent is missing,
**So that** removing or renaming the roundtable agent does not break existing functionality.

**Acceptance Criteria:**
- Given `roundtable-analyst.md` does not exist, When I run `/isdlc analyze`, Then the standard phase agents (quick-scan-agent, requirements-analyst, etc.) are used as before.
- Given the roundtable agent produces artifacts, When I run `/isdlc build`, Then the build auto-detection works identically to artifacts produced by standard agents.

**Linked Requirements:** FR-009, FR-010, NFR-005

**Priority:** Must Have

### US-008: Step-File Extensibility

**As a** framework maintainer,
**I want to** add new analysis steps by dropping a `.md` file into the step directory,
**So that** extending the analysis workflow requires no changes to the core roundtable agent.

**Acceptance Criteria:**
- Given I create `09-compliance-check.md` in `analysis-steps/01-requirements/`, When the roundtable agent next runs Phase 01, Then it discovers and executes the new step after step 08.
- Given the new step file has valid frontmatter, When executed, Then its persona, depth, and output directives are respected.

**Linked Requirements:** FR-004, FR-012, NFR-004

**Priority:** Should Have

---

## 12. Traceability Matrix

| Requirement | User Story | Priority | Status |
|-------------|-----------|----------|--------|
| FR-001 | US-001, US-007 | Must Have | Draft |
| FR-002 | US-001, US-005, US-006 | Must Have | Draft |
| FR-003 | US-001, US-004 | Must Have | Draft |
| FR-004 | US-001, US-008 | Must Have | Draft |
| FR-005 | US-003 | Must Have | Draft |
| FR-006 | US-002 | Must Have | Draft |
| FR-007 | US-001, US-002 | Must Have | Draft |
| FR-008 | US-004 | Must Have | Draft |
| FR-009 | US-007 | Must Have | Draft |
| FR-010 | US-005, US-006, US-007 | Must Have | Draft |
| FR-011 | US-003 | Should Have | Draft |
| FR-012 | US-006, US-008 | Should Have | Draft |
| NFR-001 | US-001, US-003 | Should Have | Draft |
| NFR-002 | US-004 | Must Have | Draft |
| NFR-003 | US-003 | Must Have | Draft |
| NFR-004 | US-008 | Should Have | Draft |
| NFR-005 | US-007 | Must Have | Draft |
| NFR-006 | US-001, US-002 | Should Have | Draft |
| CON-001 | -- | Must Have | Draft |
| CON-002 | US-007 | Must Have | Draft |
| CON-003 | -- | Must Have | Draft |
| CON-004 | -- | Must Have | Draft |
| CON-005 | US-008 | Must Have | Draft |
| CON-006 | -- | Must Have | Draft |

---

## 13. File Inventory (Implementation Guidance)

The following files are expected to be created or modified during implementation. This is guidance, not a constraint -- the implementation phase may adjust based on architectural decisions.

### New Files

| File | Purpose |
|------|---------|
| `src/claude/agents/roundtable-analyst.md` | Main roundtable agent with persona definitions, phase mapping, step execution logic, menu system, and adaptive depth |
| `src/claude/skills/analysis-steps/00-quick-scan/01-scope-estimation.md` | Step file: scope estimation |
| `src/claude/skills/analysis-steps/00-quick-scan/02-keyword-search.md` | Step file: keyword search |
| `src/claude/skills/analysis-steps/00-quick-scan/03-file-count.md` | Step file: file count estimation |
| `src/claude/skills/analysis-steps/01-requirements/01-business-context.md` | Step file: business context discovery |
| `src/claude/skills/analysis-steps/01-requirements/02-user-needs.md` | Step file: user needs discovery |
| `src/claude/skills/analysis-steps/01-requirements/03-ux-journey.md` | Step file: UX journey mapping |
| `src/claude/skills/analysis-steps/01-requirements/04-technical-context.md` | Step file: technical context |
| `src/claude/skills/analysis-steps/01-requirements/05-quality-risk.md` | Step file: quality and risk assessment |
| `src/claude/skills/analysis-steps/01-requirements/06-feature-definition.md` | Step file: core feature definition |
| `src/claude/skills/analysis-steps/01-requirements/07-user-stories.md` | Step file: user story writing |
| `src/claude/skills/analysis-steps/01-requirements/08-prioritization.md` | Step file: MoSCoW prioritization |
| `src/claude/skills/analysis-steps/02-impact-analysis/01-blast-radius.md` | Step file: blast radius assessment |
| `src/claude/skills/analysis-steps/02-impact-analysis/02-entry-points.md` | Step file: entry point identification |
| `src/claude/skills/analysis-steps/02-impact-analysis/03-risk-zones.md` | Step file: risk zone analysis |
| `src/claude/skills/analysis-steps/02-impact-analysis/04-impact-summary.md` | Step file: impact summary and review |
| `src/claude/skills/analysis-steps/03-architecture/01-architecture-options.md` | Step file: architecture options and tradeoffs |
| `src/claude/skills/analysis-steps/03-architecture/02-technology-decisions.md` | Step file: technology decisions |
| `src/claude/skills/analysis-steps/03-architecture/03-integration-design.md` | Step file: integration architecture |
| `src/claude/skills/analysis-steps/03-architecture/04-architecture-review.md` | Step file: architecture review |
| `src/claude/skills/analysis-steps/04-design/01-module-design.md` | Step file: module design and boundaries |
| `src/claude/skills/analysis-steps/04-design/02-interface-contracts.md` | Step file: interface contracts |
| `src/claude/skills/analysis-steps/04-design/03-data-flow.md` | Step file: data flow and state management |
| `src/claude/skills/analysis-steps/04-design/04-error-handling.md` | Step file: error handling and validation |
| `src/claude/skills/analysis-steps/04-design/05-design-review.md` | Step file: design review and approval |

### Modified Files

| File | Modification |
|------|-------------|
| `src/claude/commands/isdlc.md` | Update analyze verb handler (step 7) to delegate to roundtable-analyst when available, with fallback to standard agents |
| `src/claude/hooks/lib/three-verb-utils.cjs` | Extend `readMetaJson()` and `writeMetaJson()` to handle `steps_completed` and `depth_overrides` fields |
| `src/claude/hooks/lib/three-verb-utils.cjs` (tests) | Add test cases for new meta.json fields |

### Unchanged Files (Build Workflow)

The following files are explicitly NOT modified -- they continue to be used by the build workflow:

| File | Reason |
|------|--------|
| `src/claude/agents/01-requirements-analyst.md` | Used by build workflow Phase 01 |
| `src/claude/agents/02-solution-architect.md` | Used by build workflow Phase 03 |
| `src/claude/agents/03-system-designer.md` | Used by build workflow Phase 04 |
| `src/claude/agents/quick-scan/quick-scan-agent.md` | Used by build workflow Phase 00 |
| `src/claude/agents/impact-analysis/impact-analysis-orchestrator.md` | Used by build workflow Phase 02 |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-19 | Requirements Analyst (Phase 01) | Initial specification |
