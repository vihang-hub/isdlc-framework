# Requirements Specification: BUG-0021-GH-5

**Title**: delegation-gate infinite loop on /isdlc analyze -- missing carve-out for Phase A
**Type**: Bug Fix
**Severity**: Medium
**Bug ID**: BUG-0021
**External**: [GitHub #5](https://github.com/vihangshah/isdlc/issues/5)

---

## Bug Summary

`skill-delegation-enforcer.cjs` writes a `pending_delegation` marker for ALL `/isdlc` Skill invocations. `/isdlc analyze` runs inline (Phase A) without orchestrator delegation, so the marker is never cleared. `delegation-gate.cjs` blocks every subsequent response, creating an infinite loop requiring manual state.json intervention.

---

## Fix Requirements

### FR-01: Add exempt actions list to skill-delegation-enforcer.cjs
Add an `EXEMPT_ACTIONS` constant (Set or array) to `skill-delegation-enforcer.cjs` containing `/isdlc` subcommands that run inline without requiring orchestrator delegation. When the first word of `args` matches an exempt action, skip writing `pending_delegation` and skip emitting the mandatory delegation context message.

### FR-02: Parse action from args string
Extract the action keyword from the `args` string passed to the `/isdlc` Skill invocation. The action is the first non-flag word in the args string (e.g., `analyze` from `analyze "feature description"`, `fix` from `fix "bug description"`). Handle edge cases: empty args, args starting with flags, quoted strings.

### FR-03: Defense-in-depth in delegation-gate.cjs
Add a secondary carve-out in `delegation-gate.cjs` so that if a `pending_delegation` marker exists and the args contain an exempt action, the marker is auto-cleared without blocking. This prevents stale markers from blocking even if the enforcer fix is bypassed.

### FR-04: Sync runtime hooks to .claude/
After modifying source files in `src/claude/hooks/`, sync the updated files to `.claude/hooks/` so the runtime picks up the changes immediately.

---

## Non-Functional Requirements

### NFR-01: Backward compatibility
The fix must not affect the delegation enforcement behavior for non-exempt `/isdlc` commands (`feature`, `fix`, `upgrade`, `test`, `status`, `cancel`, etc.). These must continue to write `pending_delegation` markers and require orchestrator delegation.

### NFR-02: Zero regression
All existing tests (ESM + CJS) must continue to pass. No decrease in test count below baseline.

### NFR-03: Extensibility
The exempt actions list must be easy to extend when future inline-only subcommands are added (e.g., a simple Set addition).

---

## Acceptance Criteria

### AC-01: Exempt actions defined
**Given** `skill-delegation-enforcer.cjs` is loaded
**When** I inspect the `EXEMPT_ACTIONS` constant
**Then** it contains `'analyze'` as an exempt action
**And** it is defined as a Set or array for O(1) or simple lookup

### AC-02: Action parsing works
**Given** the `/isdlc` Skill is invoked with args `'analyze "some description"'`
**When** `skill-delegation-enforcer.cjs` parses the action
**Then** it extracts `'analyze'` as the action keyword

### AC-03: No marker written for exempt actions
**Given** the `/isdlc` Skill is invoked with args containing an exempt action
**When** `skill-delegation-enforcer.cjs` processes the event
**Then** it does NOT call `writePendingDelegation()`
**And** it does NOT emit the mandatory delegation context message
**And** it exits cleanly with code 0

### AC-04: Marker still written for non-exempt actions
**Given** the `/isdlc` Skill is invoked with args `'feature "add login"'`
**When** `skill-delegation-enforcer.cjs` processes the event
**Then** it DOES write `pending_delegation` marker
**And** it DOES emit the mandatory delegation context message

### AC-05: Defense-in-depth in delegation-gate
**Given** a stale `pending_delegation` marker exists with args containing an exempt action
**When** `delegation-gate.cjs` fires on Stop
**Then** it clears the marker without blocking
**And** it logs the auto-clear action

### AC-06: Empty args handled gracefully
**Given** the `/isdlc` Skill is invoked with empty or missing args
**When** `skill-delegation-enforcer.cjs` parses the action
**Then** it does NOT crash
**And** it falls through to normal delegation enforcement (writes marker)

### AC-07: No regression in existing tests
**Given** the fix is applied
**When** `npm run test:all` is executed
**Then** all existing tests pass with zero regressions

### AC-08: Runtime hooks synced
**Given** the source files are modified in `src/claude/hooks/`
**When** the fix is complete
**Then** `.claude/hooks/skill-delegation-enforcer.cjs` matches `src/claude/hooks/skill-delegation-enforcer.cjs`
**And** `.claude/hooks/delegation-gate.cjs` matches `src/claude/hooks/delegation-gate.cjs`

---

## Affected Files

### Hooks (modify)
- `src/claude/hooks/skill-delegation-enforcer.cjs` -- add EXEMPT_ACTIONS, action parsing, skip logic
- `src/claude/hooks/delegation-gate.cjs` -- add defense-in-depth carve-out for exempt actions

### Tests (create/modify)
- `src/claude/hooks/tests/skill-delegation-enforcer.test.cjs` -- add tests for exempt action behavior
- `src/claude/hooks/tests/delegation-gate.test.cjs` -- add tests for defense-in-depth carve-out

### Runtime sync (copy)
- `.claude/hooks/skill-delegation-enforcer.cjs` -- sync from src
- `.claude/hooks/delegation-gate.cjs` -- sync from src

---

## User Stories

### US-01: Developer runs /isdlc analyze without blocking
**As a** developer using iSDLC
**I want** `/isdlc analyze` to run without triggering delegation-gate blocks
**So that** I can use Phase A analysis without manual state.json intervention

### US-02: Developer runs /isdlc feature with normal enforcement
**As a** developer using iSDLC
**I want** `/isdlc feature`, `/isdlc fix`, and other workflow commands to continue requiring orchestrator delegation
**So that** the delegation safety net remains active for workflow commands

### US-03: Future inline commands can be exempted
**As a** framework maintainer
**I want** a simple, extensible exempt actions list
**So that** I can add future inline-only subcommands without modifying enforcement logic
