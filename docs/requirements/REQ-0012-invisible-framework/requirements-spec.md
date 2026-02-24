# Requirements Specification: REQ-0012 Invisible Framework

**Feature**: Invisible framework -- CLAUDE.md rewrite for auto-intent-detection
**ID**: REQ-0012
**Created**: 2026-02-13
**Status**: APPROVED

---

## 1. Problem Statement

Currently, iSDLC framework users must know and manually type slash commands (`/isdlc feature`, `/isdlc fix`, `/isdlc upgrade`, etc.) to engage development workflows. This creates a learning curve, breaks conversational flow, and makes the framework feel like a separate tool rather than an integrated development partner.

## 2. Stakeholders

| Stakeholder | Role | Concern |
|-------------|------|---------|
| End users (developers) | Primary users | Want natural conversation, not command memorization |
| Framework maintainers | Developers of iSDLC | Want reliable intent detection without false positives |
| Power users | Advanced users | Want slash commands to remain available |

## 3. Scope

### In Scope

- Rewrite the `## Workflow-First Development` section of `CLAUDE.md.template` (source of truth)
- Rewrite the same section in the dogfooding project's `CLAUDE.md`
- Add intent-to-command mapping rules (natural language -> iSDLC command)
- Add a consent protocol (detect, inform, confirm before invoking)
- Handle edge cases: active workflows, ambiguous intent, non-dev conversations, exploration/questions
- Preserve slash command support for power users

### Out of Scope

- Changes to hooks, agents, skills, or any runtime code
- Changes to the `isdlc.md` command file
- Documentation updates beyond CLAUDE.md (follow-up task)
- Changes to the installer.js logic (it already copies CLAUDE.md.template)

## 4. Functional Requirements

### FR-01: Intent Detection from Natural Language

The `## Workflow-First Development` section of CLAUDE.md MUST instruct Claude to detect development intent from natural user conversation without requiring slash commands.

**Acceptance Criteria**:
- AC-01.1: When a user says something like "add a login page", "I want to build a search feature", or "let's implement dark mode", Claude MUST detect this as a **feature** intent
- AC-01.2: When a user says something like "this button is broken", "the API returns 500", "users can't log in", or "fix the crash on startup", Claude MUST detect this as a **fix** intent
- AC-01.3: When a user says something like "upgrade React to v19", "update Node to 24", or "bump the lodash dependency", Claude MUST detect this as an **upgrade** intent
- AC-01.4: When a user says something like "run the tests", "check if tests pass", or "execute the test suite", Claude MUST detect this as a **test run** intent
- AC-01.5: When a user says something like "write tests for the auth module", "add unit tests", or "generate test coverage", Claude MUST detect this as a **test generate** intent
- AC-01.6: When a user says something like "set up the project", "configure the framework", or "initialize iSDLC", Claude MUST detect this as a **discovery** intent

### FR-02: Consent Protocol

Claude MUST inform the user what workflow it detected and get explicit consent before invoking any iSDLC command.

**Acceptance Criteria**:
- AC-02.1: After detecting intent, Claude MUST present a clear, concise message stating: what it detected, what command it will run, and ask for confirmation
- AC-02.2: The consent message MUST NOT use jargon like "Phase 01" or "GATE-01" -- it should be in plain language
- AC-02.3: If the user confirms (yes, sure, go ahead, ok, etc.), Claude MUST invoke the corresponding `/isdlc` command
- AC-02.4: If the user declines, Claude MUST NOT invoke any command and ask what the user wants instead
- AC-02.5: The consent prompt MUST be a single short message, not a multi-paragraph explanation

### FR-03: Intent-to-Command Mapping

CLAUDE.md MUST contain a clear mapping from detected intent categories to iSDLC commands.

**Acceptance Criteria**:
- AC-03.1: Feature intent maps to `/isdlc feature "<extracted description>"`
- AC-03.2: Fix intent maps to `/isdlc fix "<extracted description>"`
- AC-03.3: Upgrade intent maps to `/isdlc upgrade "<extracted target>"`
- AC-03.4: Test run intent maps to `/isdlc test run`
- AC-03.5: Test generate intent maps to `/isdlc test generate`
- AC-03.6: Discovery/setup intent maps to `/discover`
- AC-03.7: When the user explicitly types a slash command (e.g., `/isdlc feature "..."`) Claude MUST execute it immediately without re-asking -- backward compatibility preserved

### FR-04: Edge Case Handling

CLAUDE.md MUST instruct Claude on how to handle ambiguous or non-development conversations.

**Acceptance Criteria**:
- AC-04.1: When user intent is ambiguous (could be feature or fix), Claude MUST ask a brief clarifying question rather than guessing
- AC-04.2: When the user asks questions, explores code, or seeks explanation (not development), Claude MUST respond normally without triggering workflow detection
- AC-04.3: When an active workflow is already in progress, Claude MUST NOT start a new workflow -- instead inform the user and suggest continuing or cancelling
- AC-04.4: When the user asks to refactor code, Claude MUST treat this as a feature intent (refactoring is a feature workflow)
- AC-04.5: Non-development requests (explain this code, what does X do, help me understand) MUST NOT trigger intent detection

### FR-05: Invisible Framework Principle

The CLAUDE.md instructions MUST ensure users never need to know slash commands exist.

**Acceptance Criteria**:
- AC-05.1: The CLAUDE.md text MUST NOT instruct Claude to suggest or mention slash commands to users
- AC-05.2: Claude MUST NOT say things like "Would you like me to run `/isdlc feature`?" -- it should say "I'll set up a feature workflow for that"
- AC-05.3: The consent message MUST describe actions in user terms ("I'll track this as a new feature and guide you through requirements, design, and implementation") not framework terms
- AC-05.4: Progress updates, phase transitions, and quality checks remain visible -- only the invocation mechanism becomes invisible
- AC-05.5: If a user explicitly asks about slash commands or the framework, Claude SHOULD explain them -- the commands are not secret, just not the default interaction pattern

## 5. Non-Functional Requirements

### NFR-01: Reliability

- Intent detection false positive rate MUST be below 5% (measured by: non-development requests incorrectly triggering workflow detection)
- The consent step acts as a safety net for any misdetection

### NFR-02: Backward Compatibility

- All existing slash commands MUST continue to work exactly as before
- Power users who type `/isdlc feature "..."` MUST get immediate execution (no double-prompting)
- The `Agent Framework Context` section, `SKILL OBSERVABILITY Protocol`, `SUGGESTED PROMPTS` protocol, and `CONSTITUTIONAL PRINCIPLES Preamble` sections of CLAUDE.md MUST remain unchanged

### NFR-03: Maintainability

- The intent detection rules MUST be expressed as clear, readable instructions in CLAUDE.md (not complex regex or parsing logic)
- New workflow types added to the framework in the future MUST be addable by editing a single mapping table in CLAUDE.md

### NFR-04: Template Consistency

- `src/claude/CLAUDE.md.template` is the source of truth for new installations
- The dogfooding `CLAUDE.md` at project root includes the template content plus project-specific context
- Both MUST be updated in this feature

## 6. Files to Change

| File | Change |
|------|--------|
| `src/claude/CLAUDE.md.template` | Rewrite `## Workflow-First Development` section |
| `CLAUDE.md` (project root) | Rewrite `## Workflow-First Development` section (dogfooding copy) |

## 7. Constraints

- No changes to `src/claude/commands/isdlc.md` (the command file)
- No changes to hooks, agents, skills, or any `.cjs`/`.js` runtime files
- No changes to `lib/installer.js` (it already copies the template)
- The framework still shows progress, asks for inputs/confirmations during workflow execution as it does today
- This is purely a system prompt (CLAUDE.md) change

## 8. Success Criteria

1. A user can say "add a login page" and get a feature workflow started without knowing any slash commands
2. A user can say "this button is broken" and get a fix workflow started without knowing any slash commands
3. A user can say "upgrade React" and get an upgrade workflow started without knowing any slash commands
4. Non-development conversations (questions, exploration) do not trigger false workflow detection
5. Power users can still type `/isdlc feature "..."` and get immediate execution
6. The CLAUDE.md template file is updated so new installations get the invisible framework behavior by default
