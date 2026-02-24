# Requirements Specification: Wire Skill Index Block Injection and Unify Skill Injection

**Requirement ID**: REQ-0033
**Artifact Folder**: REQ-0033-skill-index-injection-unify-blocks
**Version**: 1.0.0
**Created**: 2026-02-23
**Status**: Draft
**Source**: GitHub Issues #84, #85
**Scope**: Feature
**Estimated Complexity**: Medium (~8-12 files)

---

## 1. Project Overview

### 1.1 Problem Statement

The iSDLC framework's phase delegation mechanism (isdlc.md STEP 3d) specifies two skill injection blocks -- a SKILL INDEX BLOCK for built-in skills and an EXTERNAL SKILL INJECTION block for project-specific external skills. Both are documented as procedural specifications but are NOT actually wired into the delegation prompt construction. As a result, phase agents are delegated without knowing what skills are available to them, degrading the quality of agent work.

### 1.2 Business Context

- **Why Now**: The skill infrastructure (getAgentSkillIndex, formatSkillIndexBlock) was fixed in BUG-0035 and now works correctly. The external skill management system (REQ-0022) documented the injection spec but left it unwired. Both systems are ready to be activated.
- **Impact of Inaction**: Phase agents operate without skill awareness, leading to suboptimal outputs. External skills registered by users have no effect on agent behavior.
- **Success Metrics**: Phase agents receive skill context in their delegation prompts; external skills are injected alongside built-in skills in a unified format.

### 1.3 Scope

**In Scope**:
- Wire the SKILL INDEX BLOCK injection so the Phase-Loop Controller actually executes it during STEP 3d
- Wire the EXTERNAL SKILL INJECTION so external skills are read and injected during STEP 3d
- Unify both injections into a single coherent AVAILABLE SKILLS block in the delegation prompt
- Maintain fail-open semantics for both injection paths
- Support both single-project and monorepo modes

**Out of Scope**:
- SessionStart skill cache (GitHub Issue #91) -- not yet created; external skills continue using file-read pattern
- Changes to getAgentSkillIndex() or formatSkillIndexBlock() internals (already fixed in BUG-0035)
- New skill registration workflows
- Changes to skills-manifest.json schema
- Changes to hook enforcement logic

---

## 2. Stakeholders and Personas

### Persona 1: Phase-Loop Controller (LLM Executor)

- **Role**: The Claude LLM instance executing isdlc.md as procedural instructions
- **Goals**: Construct complete delegation prompts with all injection blocks populated
- **Pain Points**: Current spec uses curly-brace comment blocks that are ambiguous -- unclear whether to execute them as instructions or treat them as documentation
- **Key Tasks**: Read skills-manifest.json, call getAgentSkillIndex(), format AVAILABLE SKILLS block, read external-skills-manifest.json, filter and inject external skills

### Persona 2: Phase Agent (Delegated LLM)

- **Role**: The target agent (e.g., software-developer, qa-engineer) receiving the delegation prompt
- **Goals**: Know what skills are available and how to access them on-demand
- **Pain Points**: Currently receives no skill context; must guess or rely on hardcoded skill tables in agent files
- **Key Tasks**: Read AVAILABLE SKILLS block, consult relevant skills using Read tool when needed

### Persona 3: Framework Developer (Human)

- **Role**: Developer maintaining or extending the iSDLC framework
- **Goals**: Register external skills and have them automatically injected into relevant phase agents
- **Pain Points**: External skills can be registered but never reach agents; two separate injection mechanisms create maintenance burden

---

## 3. Functional Requirements

### FR-001: Wire Built-In Skill Index Block Injection

**Description**: The Phase-Loop Controller MUST execute the SKILL INDEX BLOCK injection during STEP 3d by looking up the target agent's owned skills from skills-manifest.json, calling getAgentSkillIndex() and formatSkillIndexBlock(), and including the result in the delegation prompt.

**Priority**: Must Have

**Acceptance Criteria**:

- **AC-001-01**: Given the Phase-Loop Controller is constructing a delegation prompt for a phase agent, when the agent has owned skills in skills-manifest.json, then the AVAILABLE SKILLS block from formatSkillIndexBlock() MUST be included in the delegation prompt.

- **AC-001-02**: Given the Phase-Loop Controller is constructing a delegation prompt, when getAgentSkillIndex() returns an empty array (agent has no owned skills), then NO AVAILABLE SKILLS block is appended to the prompt (empty result is a no-op).

- **AC-001-03**: Given the Phase-Loop Controller is constructing a delegation prompt, when skills-manifest.json cannot be read or parsed, then the delegation MUST proceed without a skill block (fail-open) and no error is surfaced to the user.

### FR-002: Wire External Skill Injection

**Description**: The Phase-Loop Controller MUST execute the EXTERNAL SKILL INJECTION during STEP 3d by reading external-skills-manifest.json, filtering skills by phase/agent bindings, reading matched skill files, and appending formatted content to the delegation prompt.

**Priority**: Must Have

**Acceptance Criteria**:

- **AC-002-01**: Given external-skills-manifest.json exists and contains skills with matching bindings for the current phase/agent, when the Phase-Loop Controller constructs the delegation prompt, then matched external skill content MUST be read from .claude/skills/external/ and appended to the prompt.

- **AC-002-02**: Given external-skills-manifest.json does not exist, when the Phase-Loop Controller constructs the delegation prompt, then the injection is skipped entirely as a no-op (no error, no warning to user).

- **AC-002-03**: Given external-skills-manifest.json exists but contains no skills matching the current phase/agent, when the Phase-Loop Controller constructs the delegation prompt, then no external skill content is appended.

- **AC-002-04**: Given a matched external skill file exceeds 10,000 characters, when the content is read, then it MUST be truncated and delivered as a reference (path only) instead of full content.

- **AC-002-05**: Given an external skill has delivery_type "instruction", when it is injected, then it MUST be formatted as: `EXTERNAL SKILL INSTRUCTION ({name}): You MUST follow these guidelines:\n{content}`.

- **AC-002-06**: Given an external skill has delivery_type "context", when it is injected, then it MUST be formatted as: `EXTERNAL SKILL CONTEXT: {name}\n---\n{content}\n---`.

- **AC-002-07**: Given an external skill has delivery_type "reference", when it is injected, then it MUST be formatted as: `EXTERNAL SKILL AVAILABLE: {name} -- Read from {path} if relevant`.

### FR-003: Unify Built-In and External Skills into Single Delegation Prompt Structure

**Description**: The delegation prompt MUST present both built-in skill index entries and external skill injections in a coherent, non-conflicting structure. Built-in skills appear as a reference list (skill ID, name, description, path). External skills appear as injected content blocks (context, instruction, or reference). Both sections are clearly labeled within the delegation prompt.

**Priority**: Must Have

**Acceptance Criteria**:

- **AC-003-01**: Given both built-in skills and external skills are present for a phase agent, when the delegation prompt is constructed, then both appear in the prompt without duplication or conflict.

- **AC-003-02**: Given both sources produce content, when the prompt is assembled, then built-in skills appear FIRST as the AVAILABLE SKILLS reference list, followed by any external skill injection blocks separated by double newlines.

- **AC-003-03**: Given only built-in skills exist (no external manifest), when the prompt is assembled, then only the AVAILABLE SKILLS block appears.

- **AC-003-04**: Given only external skills match (agent has no built-in skills), when the prompt is assembled, then only the external skill injection blocks appear.

- **AC-003-05**: Given neither built-in nor external skills produce output, when the prompt is assembled, then no skill-related content is added to the delegation prompt (clean no-op).

### FR-004: Convert Comment Spec to Executable Instructions in isdlc.md

**Description**: The current STEP 3d delegation template uses curly-brace comment blocks (`{SKILL INDEX BLOCK ...}` and `{EXTERNAL SKILL INJECTION ...}`) that are ambiguous to the LLM executor. These MUST be rewritten as clear, imperative, step-by-step instructions that the Phase-Loop Controller can unambiguously execute.

**Priority**: Must Have

**Acceptance Criteria**:

- **AC-004-01**: Given the STEP 3d delegation template in isdlc.md, when the SKILL INDEX BLOCK section is read, then it MUST contain numbered imperative instructions (not curly-brace comment blocks) that the LLM can execute step by step.

- **AC-004-02**: Given the STEP 3d delegation template in isdlc.md, when the EXTERNAL SKILL INJECTION section is read, then it MUST contain numbered imperative instructions that the LLM can execute step by step.

- **AC-004-03**: Given the rewritten instructions, when the Phase-Loop Controller processes STEP 3d, then the instructions MUST produce the same output format as getAgentSkillIndex() + formatSkillIndexBlock() would produce (i.e., the AVAILABLE SKILLS header with skill entries).

- **AC-004-04**: Given the rewritten instructions reference JavaScript functions (getAgentSkillIndex, formatSkillIndexBlock), when the Phase-Loop Controller executes them, then it MUST use Bash tool to call these functions via Node.js (since isdlc.md is executed by an LLM, not a JS runtime, the spec must tell the LLM HOW to invoke JavaScript helpers).

### FR-005: Monorepo Path Resolution for External Skills

**Description**: External skill injection MUST resolve paths correctly in both single-project mode and monorepo mode, using the appropriate state file and manifest locations.

**Priority**: Must Have

**Acceptance Criteria**:

- **AC-005-01**: Given a single-project installation, when external skills are injected, then the manifest is read from `docs/isdlc/external-skills-manifest.json` and skill files from `.claude/skills/external/`.

- **AC-005-02**: Given a monorepo installation with an active project, when external skills are injected, then the manifest is read from `docs/isdlc/projects/{project-id}/external-skills-manifest.json` and skill files from `.isdlc/projects/{project-id}/skills/external/`.

- **AC-005-03**: Given a monorepo installation where the project-specific manifest does not exist, when external skills are injected, then injection is silently skipped (no error, fail-open).

### FR-006: Fail-Open Semantics for All Injection Paths

**Description**: Every injection path (built-in skill index, external skill injection) MUST fail open. Any error at any step MUST result in the delegation continuing with whatever prompt has been constructed so far, never blocking the phase delegation.

**Priority**: Must Have

**Acceptance Criteria**:

- **AC-006-01**: Given getAgentSkillIndex() throws an unexpected error, when the Phase-Loop Controller processes the skill index block, then the delegation MUST proceed without skill context (fail-open).

- **AC-006-02**: Given external-skills-manifest.json contains malformed JSON, when the Phase-Loop Controller reads it, then parsing MUST fail gracefully and the delegation MUST proceed without external skills.

- **AC-006-03**: Given a matched external skill .md file does not exist on disk, when the Phase-Loop Controller attempts to read it, then that individual skill is skipped and other skills continue to be processed.

- **AC-006-04**: Given the Bash tool call to invoke getAgentSkillIndex() fails (e.g., node not found, script error), when the Phase-Loop Controller processes the skill index block, then the delegation MUST proceed without skill context.

---

## 4. Non-Functional Requirements

| NFR ID | Category | Requirement | Metric | Measurement Method | Priority |
|--------|----------|-------------|--------|-------------------|----------|
| NFR-001 | Performance | Skill index block formatting MUST stay within prompt size limits | <= 30 lines for 14 entries (as per formatSkillIndexBlock spec) | Count output lines per agent with most skills | Must Have |
| NFR-002 | Performance | Skill injection MUST NOT add significant latency to phase delegation | < 5 seconds total for built-in + external injection | Time STEP 3d execution with and without injection | Should Have |
| NFR-003 | Reliability | Fail-open MUST be the default for ALL injection paths | 0 delegation failures caused by skill injection errors | Monitor phase delegation success rate | Must Have |
| NFR-004 | Maintainability | Injection instructions in isdlc.md MUST be self-documenting | No separate documentation needed to understand the injection process | Code review confirms clarity | Should Have |
| NFR-005 | Compatibility | Injection MUST work in both single-project and monorepo modes | Tested in both configurations | Manual verification in each mode | Must Have |
| NFR-006 | Compatibility | External skill content MUST NOT exceed 10,000 characters per skill | Auto-truncation with reference fallback for oversized skills | Content length check in injection logic | Must Have |

---

## 5. Constraints

| CON ID | Constraint | Rationale |
|--------|-----------|-----------|
| CON-001 | Primary change target is `src/claude/commands/isdlc.md` STEP 3d -- this is a specification file executed as procedural instructions by the LLM, not traditional code | The "code" being modified is markdown that serves as executable instructions for the Phase-Loop Controller |
| CON-002 | getAgentSkillIndex() and formatSkillIndexBlock() in common.cjs MUST NOT be modified (already fixed in BUG-0035) | These functions are tested (27 tests + 40 tests) and working; the issue is that isdlc.md doesn't invoke them |
| CON-003 | External skills MUST continue using file-read injection pattern (read manifest, filter, read files) -- NOT session cache | Issue #91 (SessionStart skill cache) does not exist yet and is out of scope |
| CON-004 | Single-line Bash convention MUST be followed for any Bash commands in isdlc.md instructions | Per CLAUDE.md convention, multi-line Bash breaks Claude Code permission auto-allow |
| CON-005 | No git commits during phase work | Per Git Commit Prohibition in CLAUDE.md |
| CON-006 | The GATE REQUIREMENTS INJECTION and BUDGET DEGRADATION INJECTION blocks in STEP 3d MUST NOT be modified | These are separate concerns; only skill injection blocks are in scope |

---

## 6. Assumptions

| ASM ID | Assumption | Risk if Wrong |
|--------|-----------|---------------|
| ASM-001 | The Phase-Loop Controller (LLM) can execute Bash tool calls to invoke Node.js functions like getAgentSkillIndex() during prompt construction | If LLM cannot call Bash during prompt construction, the injection approach needs redesign (e.g., inline the logic in markdown) |
| ASM-002 | skills-manifest.json is available at a known path relative to project root | If path resolution fails, skill index injection silently fails (fail-open, low risk) |
| ASM-003 | External skills will remain rare (0-5 per project) for the near term | If external skills become numerous, the file-read injection pattern may need optimization (addressed by future #91) |
| ASM-004 | formatSkillIndexBlock() output format is stable and does not need changes for the unification | If external skills need a different format, formatSkillIndexBlock may need extension |
| ASM-005 | The Phase-Loop Controller processes STEP 3d injection blocks sequentially (skill index, then external skills, then gate requirements, then budget degradation) | Order matters for prompt coherence; if blocks are processed in parallel, output may be interleaved |

---

## 7. Glossary

| Term | Definition |
|------|-----------|
| **Phase-Loop Controller** | The LLM instance executing isdlc.md as procedural instructions to manage the phase loop |
| **STEP 3d** | The phase delegation step in isdlc.md that constructs Task tool prompts for phase agents |
| **SKILL INDEX BLOCK** | A section of the delegation prompt listing built-in skills owned by the target agent |
| **AVAILABLE SKILLS** | The header used by formatSkillIndexBlock() for the built-in skill reference list |
| **EXTERNAL SKILL INJECTION** | A section of the delegation prompt injecting project-specific external skill content |
| **Fail-open** | Error handling pattern where failures result in graceful degradation (skip injection) rather than blocking the workflow |
| **skills-manifest.json** | Configuration file mapping skill IDs to owning agents and categories |
| **external-skills-manifest.json** | Configuration file listing project-specific external skills with bindings |
| **Delegation prompt** | The text passed to the Task tool when delegating to a phase agent |

---

## 8. User Stories

### US-001: Phase Agent Receives Built-In Skill Context

As a phase agent (delegated LLM),
I want to receive an AVAILABLE SKILLS block listing my owned built-in skills,
so that I can consult relevant skills on-demand during my phase work.

**Acceptance Criteria**:
- Given I am a phase agent with owned skills in skills-manifest.json, when I am delegated via Task tool, then my delegation prompt contains an AVAILABLE SKILLS block with skill IDs, names, descriptions, and file paths.
- Given I am a phase agent with no owned skills, when I am delegated, then no AVAILABLE SKILLS block appears in my prompt.

**Linked Requirements**: FR-001, FR-004
**Priority**: Must Have

### US-002: Phase Agent Receives External Skill Context

As a phase agent,
I want to receive external skill content injected into my delegation prompt,
so that project-specific skills influence my work without manual intervention.

**Acceptance Criteria**:
- Given external skills are registered and match my phase/agent bindings, when I am delegated, then the external skill content appears in my delegation prompt in the appropriate format (context/instruction/reference).
- Given no external skills are registered, when I am delegated, then no external skill blocks appear and delegation is unaffected.

**Linked Requirements**: FR-002, FR-003
**Priority**: Must Have

### US-003: Phase-Loop Controller Executes Skill Injection

As the Phase-Loop Controller,
I want clear, imperative instructions for skill injection in STEP 3d,
so that I can execute them unambiguously during delegation prompt construction.

**Acceptance Criteria**:
- Given I am processing STEP 3d, when I reach the skill injection instructions, then they are numbered imperative steps (not ambiguous curly-brace comments) that I can execute sequentially.
- Given any step in the injection process fails, when I encounter the error, then the fail-open instruction tells me to continue with the prompt as-is.

**Linked Requirements**: FR-004, FR-006
**Priority**: Must Have

### US-004: Unified Skill Presentation

As a phase agent,
I want both built-in and external skills to appear in a coherent structure in my delegation prompt,
so that I have a single, clear view of all skills available to me.

**Acceptance Criteria**:
- Given both built-in and external skills apply to me, when I read my delegation prompt, then built-in skills appear first as a reference list, followed by external skill blocks, with no duplication or conflicting formats.
- Given only one source applies, when I read my prompt, then only that source's content appears.

**Linked Requirements**: FR-003
**Priority**: Must Have

### US-005: Framework Developer Registers External Skill

As a framework developer,
I want external skills I register via `/isdlc skill add` to be automatically injected into relevant phase agents,
so that my project-specific skills take effect without manual prompt editing.

**Acceptance Criteria**:
- Given I have registered an external skill with bindings for phase "06-implementation" and agent "software-developer", when the software-developer agent is delegated for Phase 06, then my external skill content is included in the delegation prompt.
- Given I have registered an external skill but the external-skills-manifest.json is missing or corrupt, when any agent is delegated, then the delegation succeeds without my skill (fail-open).

**Linked Requirements**: FR-002, FR-005, FR-006
**Priority**: Must Have

### US-006: Monorepo External Skill Isolation

As a framework developer using monorepo mode,
I want external skills to be resolved from the correct project-scoped paths,
so that skills registered for one project do not leak into another project's agents.

**Acceptance Criteria**:
- Given I am in monorepo mode with project "frontend", when the Phase-Loop Controller resolves external skills, then it reads from `docs/isdlc/projects/frontend/external-skills-manifest.json` and `.isdlc/projects/frontend/skills/external/`.
- Given the project-specific manifest does not exist, when external skills are resolved, then injection is silently skipped.

**Linked Requirements**: FR-005
**Priority**: Must Have

---

## 9. Traceability Summary

| Requirement | User Stories | Priority |
|-------------|-------------|----------|
| FR-001 | US-001, US-003 | Must Have |
| FR-002 | US-002, US-005 | Must Have |
| FR-003 | US-003, US-004 | Must Have |
| FR-004 | US-003 | Must Have |
| FR-005 | US-005, US-006 | Must Have |
| FR-006 | US-003, US-005 | Must Have |

---

## 10. Open Questions

None. The feature description, GitHub issue context, and quick scan findings provide sufficient detail to proceed. Key design decisions are documented in the constraints:

1. Use Bash tool to invoke JavaScript helpers (ASM-001 -- validated by existing patterns in isdlc.md)
2. Keep file-read pattern for external skills (CON-003 -- #91 out of scope)
3. Do not modify common.cjs functions (CON-002 -- already fixed in BUG-0035)

---

## GATE-01 Validation

### Requirements Completeness
- [x] All functional requirements documented (FR-001 through FR-006)
- [x] All non-functional requirements documented (NFR-001 through NFR-006)
- [x] All constraints identified (CON-001 through CON-006)
- [x] All assumptions documented (ASM-001 through ASM-005)

### Requirements Quality
- [x] Each requirement has a unique ID
- [x] Each requirement has a clear description
- [x] Each requirement has a priority (all Must Have)
- [x] No ambiguous requirements
- [x] No conflicting requirements

### User Stories
- [x] User stories exist for all functional requirements
- [x] Each user story follows standard format (As a/I want/So that)
- [x] Each user story has at least one acceptance criterion
- [x] Acceptance criteria use Given/When/Then format
- [x] Stories are prioritized (all Must Have)

### Non-Functional Requirements
- [x] Performance requirements have quantifiable metrics
- [x] Reliability requirements specified (fail-open)
- [x] Compatibility requirements specified (single-project + monorepo)
- [x] Maintainability requirements specified

### Traceability
- [x] Requirements linked to user stories
- [x] No orphan requirements
- [x] No orphan user stories

### Stakeholder Approval
- [x] Requirements derived from GitHub issues #84 and #85 with clear ACs
- [x] Quick scan context incorporated
