# Requirements Specification: BUG-0031 -- gate-blocker blocks /isdlc analyze and /isdlc add

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-22
**Coverage**: Problem discovery, requirements definition, prioritization
**Source**: GitHub Issue #65

---

## Business Context

The iSDLC framework supports three top-level verbs in the `/isdlc` command: `add`, `analyze`, and `build` (REQ-0023: three-verb model). The `add` and `analyze` verbs are explicitly designed to operate independently of workflow machinery -- they do not write to state.json, do not create branches, and should be available at all times regardless of active workflow state.

When a user has an active workflow (e.g., building a fix for BUG-0029) and wants to triage a new issue (e.g., analyzing GH-64), the `analyze` command should work without interference. Currently, it can be blocked by the gate-blocker hook, preventing concurrent triage and development workflows.

## Stakeholders and Personas

### Primary User: Developer with Active Workflow
- Actively working on a feature/fix (workflow in progress)
- Encounters a new issue or idea they want to triage immediately
- Expects `/isdlc analyze` and `/isdlc add` to work regardless of current workflow state
- Should not need to complete or cancel their current workflow to triage new items

## User Journeys

### Current (Broken) Journey
1. Developer is working on BUG-0029 fix (workflow active in phase 16-quality-loop)
2. Developer encounters a new issue (GH-64) and wants to triage it
3. Developer runs `/isdlc analyze "#64: gate-blocker blocks..."`
4. Gate-blocker hook fires, detects "gate" substring in the description text
5. Gate-blocker blocks with `GATE BLOCKED: Iteration requirements not satisfied`
6. Developer cannot triage the new issue without completing or canceling their current workflow

### Desired Journey
1. Developer is working on BUG-0029 fix (workflow active in phase 16-quality-loop)
2. Developer encounters a new issue (GH-64) and wants to triage it
3. Developer runs `/isdlc analyze "#64: gate-blocker blocks..."`
4. Gate-blocker recognizes `analyze` as an exempt verb and allows it through
5. Analysis runs independently, producing artifacts in `docs/requirements/`
6. Developer continues their BUG-0029 workflow uninterrupted

## Technical Context

The bug has two layers:

1. **Missing verb exemption**: `gate-blocker.cjs` and `iteration-corridor.cjs` do not exempt `analyze`/`add` verbs from gate checks, unlike `skill-delegation-enforcer.cjs` which already has this exemption.

2. **Substring false positive**: The `args.includes('gate')` check in `isGateAdvancementAttempt()` matches the substring "gate" anywhere in the args string. When the description text passed to `analyze` contains "gate" (e.g., "gate-blocker blocks..."), the check falsely identifies this as a gate advancement attempt.

## Functional Requirements

### FR-001: Exempt analyze and add verbs from gate-blocker gate checks
**Priority**: Must Have
**Confidence**: High

When the Skill tool is invoked with `skill: 'isdlc'` and the action verb (first non-flag word in args) is `analyze` or `add`, the gate-blocker hook must return `{ decision: 'allow' }` immediately without evaluating gate requirements.

**Acceptance Criteria**:
- AC-001-01: `/isdlc analyze "<any description>"` passes through gate-blocker when an active workflow exists with unsatisfied gate requirements.
- AC-001-02: `/isdlc add "<any description>"` passes through gate-blocker when an active workflow exists with unsatisfied gate requirements.
- AC-001-03: `/isdlc analyze` with description text containing "gate" or "advance" is NOT treated as a gate advancement attempt.
- AC-001-04: `/isdlc advance` continues to be blocked by gate-blocker when gate requirements are unsatisfied (no regression).
- AC-001-05: `/isdlc gate-check` continues to trigger gate requirement evaluation (no regression).

### FR-002: Exempt analyze and add verbs from iteration-corridor checks
**Priority**: Must Have
**Confidence**: High

When the Skill tool is invoked with `skill: 'isdlc'` and the action verb is `analyze` or `add`, the iteration-corridor hook must return `{ decision: 'allow' }` immediately without evaluating corridor state.

**Acceptance Criteria**:
- AC-002-01: `/isdlc analyze "<any description>"` passes through iteration-corridor when in TEST_CORRIDOR state.
- AC-002-02: `/isdlc add "<any description>"` passes through iteration-corridor when in CONST_CORRIDOR state.
- AC-002-03: `/isdlc advance` continues to be blocked by iteration-corridor during active corridors (no regression).

### FR-003: Use consistent action verb parsing across hooks
**Priority**: Should Have
**Confidence**: High

The action verb extraction logic must match the pattern used in `skill-delegation-enforcer.cjs` (line 72): `(args.match(/^(?:--?\w+\s+)*(\w+)/) || [])[1] || ''`. This extracts the first non-flag word, handling flags like `--verbose` before the action verb.

**Acceptance Criteria**:
- AC-003-01: Action parsing handles `analyze "desc"` -> action = `analyze`.
- AC-003-02: Action parsing handles `--verbose analyze "desc"` -> action = `analyze`.
- AC-003-03: Action parsing handles empty args -> action = `''` (no exemption, falls through to existing logic).
- AC-003-04: Action parsing handles `advance` -> action = `advance` (not exempt, continues to gate check).

### FR-004: Add test coverage for exempt verbs
**Priority**: Must Have
**Confidence**: High

New test cases must verify the exemption behavior for both `analyze` and `add` verbs, including edge cases with description text containing gate-related keywords.

**Acceptance Criteria**:
- AC-004-01: Test that `/isdlc analyze "gate-blocker issue"` passes through gate-blocker.
- AC-004-02: Test that `/isdlc add "fix gate issue"` passes through gate-blocker.
- AC-004-03: Test that `/isdlc analyze` does not break existing `advance` blocking behavior.
- AC-004-04: Test that `/isdlc build "something"` is NOT exempt (only analyze and add are exempt).

## Out of Scope

- Changes to `constitutional-iteration-validator.cjs`: This hook already uses regex word boundaries (`/\badvance\b/i`) which are less susceptible to substring false positives, and it only checks gate-related patterns, not arbitrary action verbs. However, for consistency, a separate follow-up could add explicit verb exemptions there too.
- Changes to `pre-skill-dispatcher.cjs`: The dispatcher's early-exit logic (no active workflow = exit) is correct and does not need modification.
- Changes to `skill-delegation-enforcer.cjs`: Already correctly exempts `analyze`/`add`. No change needed.

## MoSCoW Prioritization

| Requirement | Priority | Rationale |
|-------------|----------|-----------|
| FR-001 | Must Have | Core bug fix -- gate-blocker is the blocking hook |
| FR-002 | Must Have | Same pattern in iteration-corridor, same fix needed |
| FR-003 | Should Have | Consistency with existing parsing pattern reduces future bugs |
| FR-004 | Must Have | Regression protection for the fix |

## Dependencies

- FR-003 supports FR-001 and FR-002 (parsing pattern needed for exemption logic)
- FR-004 depends on FR-001 and FR-002 (tests verify the fix)
