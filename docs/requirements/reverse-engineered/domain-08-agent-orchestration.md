# Domain 08: Agent Orchestration

**Source Files**: `src/claude/agents/**/*.md`, `src/claude/commands/*.md`, `src/claude/hooks/config/*.json`
**AC Count**: TBD (generated at runtime by D6 Step 9)
**Priority**: TBD (generated at runtime by D6 Step 9)

---

> **Note**: This file is a template. The Feature Mapper (D6) populates the actual
> acceptance criteria at runtime during `/discover --existing` by executing Step 9
> (Analyze Markdown Agent/Command Definitions). The examples below illustrate the
> expected format and categories. D6 replaces this content with real AC derived
> from the scanned agent files, command files, and config JSON.

---

## Category A: Command Routing

AC in this category verify that each user-facing command routes to the correct orchestrator agent.

### AC-AO-001: Feature Command Routing [CRITICAL] (example)

**Given** a user invokes the `/sdlc feature` command
**When** the command is processed by the SDLC orchestrator
**Then** it delegates to the `requirements-analyst` agent for Phase 01
**And** follows the workflow phase sequence defined in iteration-requirements.json

**Source**: `src/claude/commands/feature.md`

---

### AC-AO-002: Discover Command Routing [CRITICAL] (example)

**Given** a user invokes the `/discover` command
**When** the command is processed
**Then** it delegates to the `discover-orchestrator` agent
**And** passes `--existing`, `--shallow`, `--atdd-ready`, `--scope`, `--target`, `--priority` options if provided

**Source**: `src/claude/commands/discover.md`

---

## Category B: Workflow Phase Sequence

AC in this category verify that workflow types execute phases in the correct order.

### AC-AO-0XX: Feature Workflow Phase Sequence [CRITICAL] (example)

**Given** a `feature` workflow is active
**When** the orchestrator progresses through phases
**Then** the phases execute in this order: 01-requirements -> 02-solution -> 03-design -> 04-test-architecture -> 05-test-cases -> 06-implementation -> 07-code-review -> 08-integration-test -> 09-security -> 10-performance -> 11-release -> 12-deployment -> 13-operations
**And** no phase is skipped unless explicitly disabled in iteration-requirements.json

**Source**: `src/claude/hooks/config/iteration-requirements.json`

---

## Category C: Agent-Phase Mapping

AC in this category verify that each agent maps to the correct phase and owns the correct skills.

### AC-AO-0XX: Software Developer Phase Mapping [HIGH] (example)

**Given** the `software-developer` agent is loaded
**When** the skills manifest is consulted
**Then** it maps to phase `06-implementation`
**And** it owns 14 skills: DEV-001, DEV-002, DEV-003, DEV-004, DEV-005, DEV-006, DEV-007, DEV-008, DEV-009, DEV-010, DEV-011, DEV-012, DEV-013, DEV-014

**Source**: `src/claude/hooks/config/skills-manifest.json`

---

### AC-AO-0XX: Requirements Analyst Phase Mapping [HIGH] (example)

**Given** the `requirements-analyst` agent is loaded
**When** the skills manifest is consulted
**Then** it maps to phase `01-requirements`
**And** it owns the skills listed under its manifest entry

**Source**: `src/claude/hooks/config/skills-manifest.json`

---

## Category D: Gate Requirements

AC in this category verify that gate checklists enforce the correct conditions.

### AC-AO-0XX: GATE-05 Test Case Requirements [HIGH] (example)

**Given** phase `05-test-cases` is complete
**When** `GATE-05` is evaluated
**Then** the following conditions must be met:
  - All test cases have Given/When/Then format
  - Test coverage target is defined
  - Test cases map to requirements via traceability matrix

**Source**: `src/claude/agents/04-test-architect.md`

---

### AC-AO-0XX: GATE-06 Implementation Requirements [HIGH] (example)

**Given** phase `06-implementation` is complete
**When** `GATE-06` is evaluated
**Then** the following conditions must be met:
  - All unit tests pass
  - Code coverage meets threshold (>= 80%)
  - No undocumented behavior introduced

**Source**: `src/claude/agents/05-software-developer.md`

---

## Extraction Rules

The following rules govern which behaviors are extracted as AC:

1. **DO extract**: Command-to-agent routing, phase sequences from config, agent-phase mappings from manifest, gate checklist items
2. **DO NOT extract**: Prompt instructions, skill descriptions, subjective guidance, formatting instructions
3. **Confidence**: All AC in this domain are HIGH confidence (derived from deterministic config and explicit routing declarations)
4. **Priority assignment**:
   - CRITICAL: Command routing, workflow phase sequences (breaking these prevents framework operation)
   - HIGH: Agent-phase mappings, gate requirements (breaking these causes incorrect behavior)
   - MEDIUM: Optional flag handling, edge cases in delegation
