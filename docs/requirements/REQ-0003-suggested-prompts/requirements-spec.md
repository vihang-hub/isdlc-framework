# Requirements Specification: REQ-0003 - Framework-Controlled Suggested Prompts

**Artifact ID:** REQ-0003-suggested-prompts
**Workflow:** Feature
**Created:** 2026-02-08
**Status:** Draft

---

## 1. Project Overview

### Problem Statement

The iSDLC framework has 36 specialized agents that each perform work within their assigned SDLC phase. When an agent completes its work (or pauses for user input), Claude Code auto-generates suggested prompts that are generic and context-free -- e.g., "Continue working", "Show me the code", or "What else needs to be done?" These generic suggestions provide no actionable guidance to the user about what the logical next step in the SDLC workflow should be.

### Business Drivers

- **User productivity**: Users waste time figuring out what to do next after each phase completes
- **Workflow continuity**: The orchestrator knows the next phase, but this knowledge is not surfaced to the user as actionable prompts
- **Framework polish**: Suggested prompts are a highly visible UX element -- meaningful prompts signal a professional, well-integrated tool
- **Reduced cognitive load**: Users should not need to remember SDLC phase sequences or agent names

### Success Metrics

- Every agent emits at least 2-3 contextual suggested prompts at phase completion
- Suggested prompts reflect the actual workflow state (next phase, current blockers, available actions)
- Zero regression in existing agent behavior -- prompts are additive, not a behavioral change

---

## 2. Stakeholders and Personas

### Primary User: Developer using iSDLC

- **Role**: Software developer running SDLC workflows via Claude Code
- **Goal**: Navigate SDLC phases efficiently with clear guidance on what to do next
- **Pain point**: After a phase completes, Claude Code shows generic suggestions instead of "Continue to Phase 03 - Design" or "Run tests"
- **Technical proficiency**: Intermediate to advanced -- comfortable with CLI but not memorizing iSDLC phase sequences

### Secondary User: SDLC Orchestrator (Agent 00)

- **Role**: Automated coordinator that manages phase transitions
- **Goal**: Ensure smooth handoffs between phases
- **Need**: Phase agents emit consistent, parseable completion signals that the orchestrator and hooks can detect

---

## 3. Functional Requirements

### REQ-001: Agent Completion Prompt Emission

Each phase agent MUST emit a structured "suggested prompts" block at the end of its work. The block contains 2-4 contextual next-step prompts relevant to the current workflow state.

**Trigger**: Agent completes its phase work (after gate validation, after artifact creation, or after a user-facing pause point)
**Output**: A formatted block of suggested prompts at the end of the agent's final response

### REQ-002: Prompt Context Awareness

Suggested prompts MUST be context-aware, drawing from:
- The active workflow type (feature, fix, test-run, test-generate, upgrade)
- The current phase and next phase in the workflow sequence
- The artifact folder (e.g., REQ-0003-suggested-prompts)
- Any blockers or warnings from the current phase

### REQ-003: Prompt Catalog by Agent

Each of the 36 agent markdown files MUST include a `SUGGESTED PROMPTS` section that defines the prompts the agent should emit. Prompts are categorized:
- **Primary**: The most likely next action (e.g., "Continue to Phase 03")
- **Alternative**: Other valid actions (e.g., "Review architecture docs", "Check gate status")
- **Utility**: Always-available actions (e.g., "Show workflow status", "Cancel workflow")

### REQ-004: Orchestrator Prompt Emission

The SDLC Orchestrator (Agent 00) MUST emit suggested prompts at these key moments:
- After workflow initialization (before first phase)
- After each phase gate passes (before next phase)
- After workflow completion
- After workflow cancellation
- When presenting the interactive menu (Scenarios 1-4)

### REQ-005: Prompt Format Specification

Suggested prompts MUST follow a consistent format that is human-readable and machine-parseable:

```
---
SUGGESTED NEXT STEPS:
  [1] Continue to Phase 03 - Design
  [2] Review architecture documents
  [3] Show workflow status
---
```

### REQ-006: Dynamic Prompt Generation

Prompts MUST be dynamically generated based on workflow state, not hardcoded. The agent reads `active_workflow` from state.json to determine:
- Which phase comes next in the workflow's `phases` array
- Whether the current phase has blockers
- What artifacts were produced

### REQ-007: Prompt Output at Pause Points

Agents that have interactive pause points (e.g., Agent 01 with A/R/C menus) MUST emit contextual prompts when pausing for user input. These prompts guide the user on what input is expected.

---

## 4. Non-Functional Requirements

### NFR-001: Zero Behavioral Regression

**Category**: Compatibility
**Metric**: All 596+ existing tests must continue to pass
**Measurement**: `npm run test:all` passes before and after implementation

### NFR-002: Minimal Agent File Changes

**Category**: Maintainability
**Metric**: Each agent markdown file change is additive (append-only section), not restructuring
**Measurement**: Code review confirms no existing sections modified, only new `SUGGESTED PROMPTS` section added

### NFR-003: No New Dependencies

**Category**: Simplicity
**Metric**: Zero new npm dependencies added
**Measurement**: `package.json` dependency count unchanged

### NFR-004: Module System Compliance (Article XIII)

**Category**: Compatibility
**Metric**: Any hook code uses CommonJS (.cjs), any lib code uses ESM (.js)
**Measurement**: No ESM imports in .cjs files, no require() in .js files

### NFR-005: Cross-Platform Compatibility (Article XII)

**Category**: Compatibility
**Metric**: Prompt output uses only ASCII characters (no platform-dependent Unicode)
**Measurement**: Output renders correctly on macOS, Linux, and Windows terminals

### NFR-006: State Management Integrity (Article XIV)

**Category**: Reliability
**Metric**: No new fields written to state.json for prompt storage -- prompts are ephemeral output only
**Measurement**: state.json schema unchanged

### NFR-007: Performance

**Category**: Performance
**Metric**: Prompt generation adds < 50ms to agent completion time
**Measurement**: No file I/O required for prompt generation beyond existing state.json reads

---

## 5. Constraints

### CON-001: Agent File Format

Agent files are markdown (.md) with YAML frontmatter. The suggested prompts section must be valid markdown that agents can parse as instructions.

### CON-002: No Hook Required

Suggested prompts are emitted by agents as part of their text output -- no new hook is needed. Agents simply include the formatted prompt block in their response.

### CON-003: Backward Compatible

If an agent does not have a `SUGGESTED PROMPTS` section, it continues to work as before. The feature is opt-in per agent.

### CON-004: Constitution Compliance

All changes must comply with the project constitution (14 articles), particularly:
- Article V (Simplicity First): No over-engineering -- prompts are text output, not a complex system
- Article VIII (Documentation Currency): Agent docs updated alongside behavior changes
- Article XIII (Module System Consistency): Respect ESM/CJS boundary

---

## 6. Assumptions

- Claude Code displays the last portion of an agent's output as context for suggested prompt generation
- The format chosen for prompt blocks will be visible to users in the Claude Code interface
- Agents can read `active_workflow` from state.json to determine workflow context (this is already supported)

---

## 7. Out of Scope

- **Hook-based prompt injection**: No new hooks to intercept/modify prompts
- **Claude Code API integration**: No changes to Claude Code's internal suggested prompt algorithm
- **Prompt analytics**: No tracking of which suggested prompts users select
- **Prompt localization**: English only

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| Suggested Prompts | Next-step actions shown to the user in Claude Code after an agent response |
| Phase Agent | One of 36 specialized agents, each responsible for one SDLC phase |
| Orchestrator | Agent 00 that coordinates phase transitions and workflow management |
| Active Workflow | The currently running SDLC workflow (feature, fix, etc.) tracked in state.json |
| Gate | Quality checkpoint between phases that must pass before advancing |
