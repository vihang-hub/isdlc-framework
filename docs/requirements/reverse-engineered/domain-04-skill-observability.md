# Domain 04: Skill Observability

**Source Files**: `src/claude/hooks/skill-validator.js`, `src/claude/hooks/log-skill-usage.js`, `src/claude/hooks/lib/common.js`
**AC Count**: 10
**Priority**: 2 Critical, 5 High, 3 Medium

---

## AC-SO-001: Task Tool Call Interception [CRITICAL]

**Given** any tool call is made during an agent workflow
**When** skill-validator receives it via stdin
**Then** it only processes Task tool calls (agent delegation)
**And** passes through all non-Task tools (Bash, Read, Write, etc.) immediately
**And** extracts subagent_type from tool_input

**Source**: `src/claude/hooks/skill-validator.js:55-69`

---

## AC-SO-002: Agent Name Normalization [HIGH]

**Given** a subagent_type is extracted from the tool input
**When** normalizeAgentName() processes it
**Then** it converts to lowercase, replaces underscores with hyphens
**And** maps 30+ variations to canonical names:
  - "orchestrator" -> "sdlc-orchestrator"
  - "01-requirements-analyst" -> "requirements-analyst"
  - "d6" -> "feature-mapper"
  - "developer" -> "software-developer"
**And** returns the input unchanged if no mapping exists

**Source**: `src/claude/hooks/lib/common.js:725-788`

---

## AC-SO-003: Never-Block Observability Model [CRITICAL]

**Given** skill-validator detects a cross-phase agent delegation
**When** any enforcement mode is active (observe, strict, warn, audit)
**Then** it ALWAYS allows the delegation (exit 0, no output)
**And** strict mode behaves identically to observe mode (legacy compatibility)
**And** the only output is debug logging (when SKILL_VALIDATOR_DEBUG=true)

**Source**: `src/claude/hooks/skill-validator.js:158-193`

---

## AC-SO-004: Orchestrator Always Authorized [HIGH]

**Given** the target agent has phase="all" in the manifest
**When** authorization is checked
**Then** it is immediately authorized regardless of current phase
**And** this applies to the sdlc-orchestrator agent

**Source**: `src/claude/hooks/skill-validator.js:139-142`

---

## AC-SO-005: Setup Agent Always Authorized [HIGH]

**Given** the target agent has phase="setup" in the manifest
**When** authorization is checked
**Then** it is immediately authorized regardless of current phase
**And** this applies to all discover agents (D1-D8)

**Source**: `src/claude/hooks/skill-validator.js:145-148`

---

## AC-SO-006: PostToolUse Skill Usage Logging [HIGH]

**Given** a Task tool call completes
**When** log-skill-usage processes the result
**Then** it creates a log entry with:
  - timestamp, agent name, agent_phase, current_phase
  - description, status, reason, enforcement_mode
  - external_skills_registered count
**And** appends the entry to skill_usage_log[] in state.json
**And** never blocks (exit 0 always)

**Source**: `src/claude/hooks/log-skill-usage.js:33-173`

---

## AC-SO-007: Cross-Phase Usage Categorization [HIGH]

**Given** an agent is delegated to outside its designated phase
**When** log-skill-usage records the event
**Then** it sets status based on enforcement mode:
  - observe -> status="observed", reason="cross-phase-usage"
  - warn -> status="warned", reason="cross-phase-usage"
  - audit -> status="audited", reason="cross-phase-usage"
  - strict -> status="observed", reason="cross-phase-usage" (same as observe)
**And** authorized delegations get reason="authorized-phase-match" or "authorized-orchestrator"

**Source**: `src/claude/hooks/log-skill-usage.js:111-143`

---

## AC-SO-008: Manifest Loading with Fallback [MEDIUM]

**Given** a hook needs to load the skills manifest
**When** loadManifest() is called
**Then** it checks two locations in order:
  1. .claude/hooks/config/skills-manifest.json
  2. .isdlc/config/skills-manifest.json
**And** returns null if neither exists (fail-open behavior)

**Source**: `src/claude/hooks/lib/common.js:659-692`

---

## AC-SO-009: External Manifest Recognition [MEDIUM]

**Given** an agent is not found in the framework manifest
**When** skill-validator or log-skill-usage processes it
**Then** it checks the external skills manifest for recognition
**And** logs the external skills count if found
**And** allows the delegation regardless (unknown agents are not blocked)

**Source**: `src/claude/hooks/skill-validator.js:119-129`, `log-skill-usage.js:101-104`

---

## AC-SO-010: Fail-Open on All Errors [MEDIUM]

**Given** any hook encounters an error (JSON parse, file read, state corruption)
**When** the error is caught
**Then** the hook exits with code 0 and no stdout output
**And** error details are logged to stderr only when debug mode is enabled
**And** user workflow is NEVER blocked by hook errors

**Source**: `src/claude/hooks/skill-validator.js:195-199`, Constitution Article X rule 6
