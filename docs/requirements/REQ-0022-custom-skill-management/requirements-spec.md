# Requirements Specification: Custom Skill Management

**ID:** REQ-0022
**Feature:** Custom skill management — add, wire, and inject user-provided skills into workflows
**External Reference:** GitHub #14
**Version:** 1.0.0
**Status:** Draft
**Created:** 2026-02-18
**Author:** Requirements Analyst (Agent 01)

---

## 1. Project Overview

### 1.1 Problem Statement

Users of the iSDLC framework have no way to add domain-specific skills (e.g., NestJS patterns, React conventions, company coding standards) to the framework. The external skills directory (`.claude/skills/external/`) and manifest path resolution (`resolveExternalManifestPath()`, `resolveExternalSkillsPath()` in `common.cjs`) exist as infrastructure stubs, but there is no user-facing command, no interactive wiring session, and no runtime injection of external skill content into agent Task prompts during workflow execution.

### 1.2 Business Drivers

- **Extensibility**: The framework must support domain customization without forking or modifying core agent files
- **User retention**: Users with specialized stacks (NestJS, Django, Rails, etc.) need the framework to understand their conventions
- **Ecosystem growth**: External skills enable a community contribution model
- **Competitive differentiation**: No competing AI dev workflow tool offers structured skill injection

### 1.3 Success Metrics

- Users can add an external skill in under 2 minutes
- External skills are injected into the correct agent prompts during workflow execution
- Zero regression in existing test suites after implementation
- Smart binding suggestions are accurate for common skill categories (framework, testing, deployment)

### 1.4 Scope

**In scope:**
- Skill acquisition (file copy/validation)
- Interactive wiring session (agent/phase binding with smart defaults)
- Runtime injection into agent Task prompts
- Re-wiring existing skills
- Listing and removing registered skills
- Natural language and explicit command entry points

**Out of scope (this release):**
- Skill marketplace or remote registry
- Skill versioning or dependency resolution between external skills
- Automatic skill discovery from project dependencies (future enhancement)
- Skill templates or scaffolding generators

---

## 2. Stakeholders and Personas

### Persona 1: Framework User (Primary)

- **Role**: Developer using iSDLC to manage their project workflow
- **Goals**: Add domain-specific skills so the framework understands their tech stack conventions
- **Pain points**: Currently must rely on generic agent behavior; no way to inject project-specific knowledge
- **Technical proficiency**: Intermediate to advanced; comfortable with CLI but prefers guided interaction
- **Key tasks**: Add skills, configure bindings, run workflows with injected skills

### Persona 2: Framework Maintainer (Secondary)

- **Role**: Developer maintaining/extending the iSDLC framework itself (dogfooding)
- **Goals**: Validate the extensibility model works correctly; ensure external skills do not break core behavior
- **Pain points**: Testing injection paths requires manual state manipulation
- **Technical proficiency**: Expert
- **Key tasks**: Debug injection failures, validate manifest schema, test monorepo paths

---

## 3. Functional Requirements

### FR-001: Skill Acquisition

**Description**: The framework shall provide a command to register an external skill file (`.md` format) into the external skills directory.

**Trigger**: User invokes `/isdlc skill add <path>` or says "add a skill" in natural language.

**Happy Path**:
1. User provides a path to a `.md` skill file (local filesystem path)
2. Framework validates the file exists and contains valid YAML frontmatter with required fields: `name`, `description`
3. Framework copies the file to the external skills directory (`.claude/skills/external/` in single-project mode, `.isdlc/projects/{id}/skills/external/` in monorepo mode)
4. Framework confirms acquisition with skill name and file location

**Error Scenarios**:
- File not found: Display error with path checked
- Invalid frontmatter (missing `name` or `description`): Display specific validation error listing missing fields
- File already exists in external skills directory: Prompt user to overwrite or cancel
- Non-`.md` file provided: Display error explaining only `.md` files are supported

**Priority**: Must Have

### FR-002: Smart Binding Suggestion

**Description**: When a skill is added without explicit binding configuration, the framework shall analyze the skill's content (frontmatter fields, body keywords, name patterns) and suggest appropriate agent/phase bindings.

**Trigger**: After successful skill acquisition (FR-001), before the wiring session (FR-003).

**Suggestion Logic**:
1. Parse skill frontmatter for `owner`, `skill_id`, `when_to_use`, `dependencies` fields (if present)
2. Scan skill body for phase-indicative keywords:
   - "test", "testing", "coverage", "assertion" -> suggest `05-test-strategy`, `06-implementation` (test-related agents)
   - "architecture", "design pattern", "module", "component" -> suggest `03-architecture`, `04-design`
   - "deploy", "CI/CD", "pipeline", "docker" -> suggest `09-cicd`, `10-local-testing`
   - "security", "auth", "encryption", "OWASP" -> suggest `08-validation`
   - "implement", "code", "function", "class", "API" -> suggest `06-implementation`
   - "requirements", "user story", "acceptance criteria" -> suggest `01-requirements`
   - "review", "quality", "lint", "code review" -> suggest `08-code-review`
3. If no keywords match, default to suggesting `06-implementation` (most common use case)
4. Present suggestions to user with confidence indicator (high/medium/low based on keyword match strength)

**Priority**: Must Have

### FR-003: Interactive Wiring Session

**Description**: The framework shall provide an interactive session for configuring how an external skill binds to agents and phases.

**Trigger**: Automatically after skill acquisition (FR-001 + FR-002), or explicitly via `/isdlc skill wire <name>`.

**Session Flow**:
1. Display current binding suggestions (from FR-002) or existing bindings (for re-wiring)
2. Present agent/phase list grouped by workflow category:
   - Requirements & Analysis: `01-requirements`, `02-impact-analysis`, `02-tracing`
   - Architecture & Design: `03-architecture`, `04-design`
   - Testing: `05-test-strategy`, `07-testing`
   - Implementation: `06-implementation`
   - Quality & Security: `08-code-review`, `09-validation`, `16-quality-loop`
   - DevOps: `10-cicd`, `11-local-testing`
3. User selects one or more agents/phases (multi-select with suggested defaults pre-checked)
4. User selects delivery type:
   - **Context block**: Skill content appended as a context section in the agent's Task prompt
   - **Instruction**: Skill content injected as explicit instructions the agent must follow
   - **Reference**: Skill referenced by name; agent can read it on demand via the Read tool
5. Injection mode is always `"always"` (injected on every invocation of the bound agent/phase)
6. Present confirmation summary with `[S] Save / [A] Adjust / [X] Cancel` menu

**Priority**: Must Have

### FR-004: Manifest Registration

**Description**: On save from the wiring session, the framework shall register the skill in `external-skills-manifest.json` with a structured bindings schema.

**Manifest Schema**:
```json
{
  "version": "1.0.0",
  "skills": [
    {
      "name": "nestjs-conventions",
      "description": "NestJS framework conventions and patterns",
      "file": "nestjs-conventions.md",
      "added_at": "2026-02-18T12:00:00Z",
      "bindings": {
        "agents": ["software-developer", "solution-architect"],
        "phases": ["06-implementation", "03-architecture"],
        "injection_mode": "always",
        "delivery_type": "context"
      }
    }
  ]
}
```

**Requirements**:
- Manifest file location: `docs/isdlc/external-skills-manifest.json` (single-project) or `docs/isdlc/projects/{id}/external-skills-manifest.json` (monorepo)
- If manifest does not exist, create it with `version: "1.0.0"` and empty `skills` array
- If skill already exists in manifest (by name), update its bindings in place
- Validate manifest JSON is well-formed after write
- Use existing `resolveExternalManifestPath()` from `common.cjs` for path resolution

**Priority**: Must Have

### FR-005: Runtime Skill Injection

**Description**: During workflow execution, the phase-loop controller shall read the external skills manifest, match skills to the current agent/phase, read the `.md` files, and append formatted content blocks to the agent's Task prompt.

**Injection Point**: In `isdlc.md` STEP 3d (phase agent delegation), after constructing the base delegation prompt and before invoking the Task tool.

**Injection Logic**:
1. Call `loadExternalManifest()` from `common.cjs`
2. If manifest is null or `skills` array is empty, skip injection (no-op)
3. For each skill in manifest where `bindings.injection_mode === "always"`:
   a. Check if `bindings.phases` includes the current phase key OR `bindings.agents` includes the current agent name
   b. If matched, resolve the skill file path via `resolveExternalSkillsPath()` + skill.file
   c. Read the skill `.md` file content
   d. Format based on `bindings.delivery_type`:
      - `"context"`: Wrap in `EXTERNAL SKILL CONTEXT: {name}\n---\n{content}\n---`
      - `"instruction"`: Wrap in `EXTERNAL SKILL INSTRUCTION ({name}): You MUST follow these guidelines:\n{content}`
      - `"reference"`: Append `EXTERNAL SKILL AVAILABLE: {name} — Read from {path} if relevant to your current task`
4. Append all matched skill blocks to the delegation prompt

**Error Handling**:
- Missing skill file: Log warning, skip that skill, continue injection for remaining skills
- Malformed manifest: Log warning, skip all injection (fail-open per Article X)
- Large skill file (>10000 chars): Truncate with `[TRUNCATED — full content at {path}]` and switch to reference delivery

**Priority**: Must Have

### FR-006: Skill Listing

**Description**: The framework shall provide a command to list all registered external skills with their current bindings.

**Trigger**: `/isdlc skill list` or "list skills" / "show skills" in natural language.

**Output Format**:
```
External Skills (3 registered):

  1. nestjs-conventions
     Phases: 06-implementation, 03-architecture
     Delivery: context | Mode: always

  2. company-coding-standards
     Phases: 06-implementation, 08-code-review
     Delivery: instruction | Mode: always

  3. aws-deployment-guide
     Phases: 10-cicd
     Delivery: reference | Mode: always
```

**Edge Case**: If no skills registered, display: `"No external skills registered. Use '/isdlc skill add <path>' to add one."`

**Priority**: Should Have

### FR-007: Skill Removal

**Description**: The framework shall provide a command to unregister an external skill and optionally delete its file.

**Trigger**: `/isdlc skill remove <name>` or "remove skill" in natural language.

**Flow**:
1. Look up skill by name in manifest
2. If not found, display error with suggestion to run `/isdlc skill list`
3. If found, prompt: `"Remove '{name}' from external skills? File will be kept/deleted. [K] Keep file [D] Delete file [C] Cancel"`
4. On [K]: Remove from manifest, preserve `.md` file
5. On [D]: Remove from manifest, delete `.md` file
6. On [C]: Abort

**Priority**: Should Have

### FR-008: Natural Language Entry Points

**Description**: The CLAUDE.md intent detection table shall be extended to recognize skill management intent and route to the appropriate command.

**Signal Words**:
| Pattern | Command |
|---------|---------|
| "add a skill", "register skill", "new skill" | `/isdlc skill add` (prompt for path) |
| "wire skill", "wire X to Y", "bind skill" | `/isdlc skill wire <name>` |
| "list skills", "show skills", "what skills" | `/isdlc skill list` |
| "remove skill", "delete skill", "unregister skill" | `/isdlc skill remove <name>` |
| "use X skill during Y phase" | `/isdlc skill wire <name>` (re-wiring) |

**Priority**: Should Have

### FR-009: Re-wiring Existing Skills

**Description**: When wiring a skill that already has bindings in the manifest, the framework shall pre-fill the wiring session with current bindings and allow the user to modify them.

**Trigger**: `/isdlc skill wire <name>` where the skill already has bindings.

**Behavior**:
1. Load current bindings from manifest
2. Pre-check the currently bound agents/phases in the selection interface
3. Pre-select the current delivery type
4. User modifies as needed
5. Save overwrites existing bindings

**Priority**: Should Have

---

## 4. Non-Functional Requirements

### NFR-001: Injection Performance

**Category**: Performance
**Requirement**: Skill injection during phase delegation shall add no more than 100ms of latency to the delegation process.
**Metric**: Measured as wall-clock time between "start injection lookup" and "injection blocks appended".
**Priority**: Must Have

### NFR-002: Manifest Size Limit

**Category**: Scalability
**Requirement**: The system shall support up to 50 registered external skills without degradation.
**Metric**: Manifest parsing + skill file reading for 50 skills completes in <500ms.
**Priority**: Should Have

### NFR-003: Fail-Open Injection

**Category**: Reliability
**Requirement**: If any part of the skill injection process fails (missing file, malformed manifest, read error), the workflow shall continue without the failed skill's injection. The failure shall be logged as a warning but never block workflow progression.
**Metric**: Zero workflow failures attributable to external skill injection errors.
**Priority**: Must Have
**Constitutional Reference**: Article X (Fail-Safe Defaults)

### NFR-004: Monorepo Compatibility

**Category**: Compatibility
**Requirement**: All skill management operations shall work correctly in both single-project and monorepo modes, using the existing path resolution functions (`resolveExternalSkillsPath()`, `resolveExternalManifestPath()`) from `common.cjs`.
**Metric**: All skill operations produce correct paths in both modes.
**Priority**: Must Have

### NFR-005: Backward Compatibility

**Category**: Compatibility
**Requirement**: Projects with no external skills (no manifest, no external directory) shall experience zero behavioral change. The injection step is a no-op when no manifest exists.
**Metric**: All existing tests pass with no changes when external skills feature is present but unused.
**Priority**: Must Have

### NFR-006: Frontmatter Validation Clarity

**Category**: Usability
**Requirement**: When a skill file fails validation, the error message shall identify every missing or malformed field specifically, with an example of correct format.
**Metric**: Users can self-correct 100% of validation errors on first retry.
**Priority**: Should Have

---

## 5. Constraints

### CON-001: File Format

External skill files must be markdown (`.md`) with YAML frontmatter. No other formats are supported in this release.

### CON-002: Existing Infrastructure

Must use existing `resolveExternalSkillsPath()`, `resolveExternalManifestPath()`, and `loadExternalManifest()` from `common.cjs`. May extend but not replace these functions.

### CON-003: No Git Operations

Skill management commands do not create branches or trigger workflows. They are configuration operations that modify the project's skill registry.

### CON-004: Hook System Compatibility

External skill injection must not interfere with the existing hook dispatch system. Skill content is injected at the prompt construction level (isdlc.md), not at the hook level.

### CON-005: Module System

Any new utility functions added to `common.cjs` must be CommonJS (consistent with existing hook lib). Any new agent files must be markdown. The `isdlc.md` command file is markdown.

---

## 6. Assumptions

- ASM-001: Users will provide skill files that follow the standard SKILL.md frontmatter format (at minimum `name` and `description` fields)
- ASM-002: External skill files are small enough to include in prompt context (typically <5000 characters)
- ASM-003: The phase-loop controller in `isdlc.md` has a clear injection point before Task tool invocation in STEP 3d
- ASM-004: Users understand which phases/agents are relevant to their skills (with assistance from smart suggestions)

---

## 7. Glossary

| Term | Definition |
|------|-----------|
| External Skill | A user-provided `.md` file containing domain-specific knowledge, conventions, or instructions that augment agent behavior |
| Binding | The configuration that maps an external skill to specific agents and/or phases |
| Wiring Session | The interactive process of configuring bindings for an external skill |
| Delivery Type | How the skill content is presented to the agent: as context, instruction, or reference |
| Injection Mode | When skill content is injected; currently only `"always"` is supported |
| Manifest | The `external-skills-manifest.json` file that stores all registered skills and their bindings |
| Smart Suggestion | The automatic recommendation of agent/phase bindings based on skill content analysis |

---

## 8. Files Affected

Based on the BACKLOG.md design and codebase analysis:

| File | Change Type | Description |
|------|-------------|-------------|
| `src/claude/commands/isdlc.md` | Modify | Add `skill add/wire/list/remove` action handlers + STEP 3d injection logic |
| `CLAUDE.md` | Modify | Add skill management intent detection patterns |
| `docs/isdlc/external-skills-manifest.json` | Create | External skills manifest (created on first `skill add`) |
| `src/claude/hooks/lib/common.cjs` | Modify | Add skill content analysis, binding suggestion, and validation utilities |
| `src/claude/agents/skill-manager.md` | Create | New agent definition for interactive wiring session |
| `src/claude/hooks/config/skills-manifest.json` | Modify | Register skill-manager agent and EXT-* skill IDs |
