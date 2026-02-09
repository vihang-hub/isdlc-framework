# Implementation Notes: REQ-0004 Advisory Behavior Hooks

**Phase:** 06-implementation
**Date:** 2026-02-09
**Status:** Complete

---

## Summary

Implemented 7 new enforcement hooks, 3 common.cjs library additions, settings.json registration (8 new entries across 4 matchers), and uninstall.sh updates. All 88 new tests pass (140 total CJS hook tests).

## Implementation Decisions

### 1. Shared Phase Delegation Detection

Created `detectPhaseDelegation()` in common.cjs to avoid duplicating agent-name resolution logic across 3 hooks (phase-loop-controller, phase-sequence-guard, and potentially future hooks). This function:
- Uses the existing `normalizeAgentName()` and `getAgentPhase()` from common.cjs
- Falls back to manifest scanning when subagent_type is not recognized
- Falls back to regex phase pattern matching as a last resort
- Returns a structured `{ isDelegation, targetPhase, agentName }` object
- Filters out setup commands using the new `isSetupCommand()` helper

### 2. spawnSync vs execSync for PostToolUse Hook Tests

PostToolUse hooks output warnings to stderr only (never stdout). The initial test implementation used `execSync` which discards stderr on exit code 0. Switched to `spawnSync` with the `input` option for stdin delivery, which provides separate `stdout` and `stderr` properties regardless of exit code. This affected tests for state-write-validator, walkthrough-tracker, and discover-menu-guard.

### 3. EARLY_PHASES Set in plan-surfacer

The plan-surfacer hook uses a hardcoded `EARLY_PHASES` Set rather than computing the phase position from the workflow. This is intentional: the "which phases need a plan" decision is a policy choice, not a computation. Early phases (00-05) are planning phases; 06+ are execution phases that benefit from task plan visibility.

### 4. STATE_JSON_PATTERN Cross-Platform Regex

The state-write-validator uses `/\.isdlc[/\\](?:projects[/\\][^/\\]+[/\\])?state\.json$/` to match both single-project (`.isdlc/state.json`) and monorepo (`.isdlc/projects/{id}/state.json`) paths on both Unix and Windows.

### 5. discover-menu-guard Text Length Threshold

Set `MIN_MENU_TEXT_LENGTH = 50` to avoid false positives on short tool results. Menu text with all 3 options is typically 200+ characters. The 50-char threshold filters out non-menu results while being conservative enough to catch truncated menus.

## Files Created

| File | Type | Lines | Tests |
|------|------|-------|-------|
| `src/claude/hooks/branch-guard.cjs` | PreToolUse[Bash] hook | 135 | 14 |
| `src/claude/hooks/plan-surfacer.cjs` | PreToolUse[Task] hook | 109 | 10 |
| `src/claude/hooks/phase-loop-controller.cjs` | PreToolUse[Task] hook | 101 | 12 |
| `src/claude/hooks/phase-sequence-guard.cjs` | PreToolUse[Task] hook | 108 | 12 |
| `src/claude/hooks/state-write-validator.cjs` | PostToolUse[Write,Edit] hook | 154 | 15 |
| `src/claude/hooks/walkthrough-tracker.cjs` | PostToolUse[Task] hook | 96 | 10 |
| `src/claude/hooks/discover-menu-guard.cjs` | PostToolUse[Task] hook | 157 | 11 |
| `src/claude/hooks/tests/common-phase-detection.test.cjs` | Unit tests | 196 | 15 |
| `src/claude/hooks/tests/branch-guard.test.cjs` | Unit tests | 208 | 14 |
| `src/claude/hooks/tests/plan-surfacer.test.cjs` | Unit tests | 185 | 10 |
| `src/claude/hooks/tests/phase-loop-controller.test.cjs` | Unit tests | 195 | 12 |
| `src/claude/hooks/tests/phase-sequence-guard.test.cjs` | Unit tests | 204 | 12 |
| `src/claude/hooks/tests/state-write-validator.test.cjs` | Unit tests | 262 | 15 |
| `src/claude/hooks/tests/walkthrough-tracker.test.cjs` | Unit tests | 168 | 10 |
| `src/claude/hooks/tests/discover-menu-guard.test.cjs` | Unit tests | 196 | 11 |

## Files Modified

| File | Changes |
|------|---------|
| `src/claude/hooks/lib/common.cjs` | Added `SETUP_COMMAND_KEYWORDS`, `isSetupCommand()`, `detectPhaseDelegation()` (~115 lines) |
| `src/claude/settings.json` | Added 8 hook registrations across 4 matchers (PreToolUse[Task], PreToolUse[Bash], PostToolUse[Task], PostToolUse[Write], PostToolUse[Edit]) |
| `uninstall.sh` | Added 7 hook filenames to FRAMEWORK_PATTERNS cleanup array |

## Test Results

- **Total CJS hook tests:** 140 (88 new + 52 existing)
- **Suites:** 15
- **Pass:** 140
- **Fail:** 0
- **Duration:** ~1.2s

## Constitutional Compliance

All 12 applicable articles validated as compliant:
- Art I (Specification Primacy), Art II (Test-First), Art III (Security by Design)
- Art V (Simplicity), Art VI (Code Review), Art VII (Traceability)
- Art VIII (Documentation), Art IX (Quality Gate), Art X (Fail-Safe Defaults)
- Art XII (Dual Module System), Art XIII (Hook Protocol), Art XVI (State Machine)
