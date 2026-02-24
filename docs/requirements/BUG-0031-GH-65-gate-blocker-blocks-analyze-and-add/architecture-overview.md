# Architecture Overview: BUG-0031 -- gate-blocker blocks /isdlc analyze and /isdlc add

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-22
**Coverage**: Architecture options, selected approach, integration points

---

## Architecture Options

### Option A: Add analyze/add to SETUP_COMMAND_KEYWORDS

**Summary**: Add `'analyze'` and `'add'` to the existing `SETUP_COMMAND_KEYWORDS` array in both `gate-blocker.cjs` and `iteration-corridor.cjs`.

| Aspect | Assessment |
|--------|-----------|
| Pros | Minimal code change (2 lines per file). Uses existing bypass mechanism. |
| Cons | Semantically incorrect -- `analyze` and `add` are not setup commands. Conflates two different exemption reasons. `SETUP_COMMAND_KEYWORDS` uses `args.includes()` which is still substring-based. Adding "add" would match any args containing "add" as a substring (e.g., "add" inside "additional"). |
| Existing pattern alignment | Misaligned -- setup commands are pre-workflow commands; analyze/add are workflow-independent verbs. |
| **Verdict** | **Eliminated** -- substring matching on "add" is too broad and semantically incorrect. |

### Option B: Add dedicated EXEMPT_ACTIONS with action verb parsing (Selected)

**Summary**: Add an `EXEMPT_ACTIONS` Set matching the pattern in `skill-delegation-enforcer.cjs`. Parse the action verb (first non-flag word) from args before checking for gate/advance keywords. If the action is in EXEMPT_ACTIONS, return false (not a gate advancement attempt).

| Aspect | Assessment |
|--------|-----------|
| Pros | Semantically correct -- exemption is verb-based, not keyword-based. Reuses proven parsing pattern from `skill-delegation-enforcer.cjs`. No substring false positives. Clearly documents the intent. |
| Cons | Slightly more code (5-8 lines per file). Adds a regex parse step. |
| Existing pattern alignment | Directly aligned with `skill-delegation-enforcer.cjs` line 37 and 72. |
| **Verdict** | **Selected** -- correct semantics, proven pattern, clear intent. |

### Option C: Extract EXEMPT_ACTIONS to common.cjs

**Summary**: Define the EXEMPT_ACTIONS set and action parsing function once in `common.cjs` and import in all three hooks.

| Aspect | Assessment |
|--------|-----------|
| Pros | Single source of truth. Adding a new exempt verb requires one change. |
| Cons | Larger change scope. Requires updating common.cjs exports, which affects all hooks. Over-engineering for a 2-element set. |
| Existing pattern alignment | Would be the ideal long-term pattern but premature for this fix. |
| **Verdict** | **Deferred** -- good follow-up if the exempt verb list grows beyond 2. |

## Selected Architecture: Option B

### ADR-001: Dedicated EXEMPT_ACTIONS with Action Verb Parsing

**Status**: Accepted
**Context**: The `analyze` and `add` verbs in the `/isdlc` command are workflow-independent operations that should never be blocked by gate or iteration corridor checks. The current gate-blocker and iteration-corridor hooks lack explicit exemption for these verbs.
**Decision**: Add a dedicated `EXEMPT_ACTIONS` Set and action verb parsing to both `gate-blocker.cjs` (`isGateAdvancementAttempt()`) and `iteration-corridor.cjs` (`skillIsAdvanceAttempt()`), matching the pattern established in `skill-delegation-enforcer.cjs`.
**Rationale**: This approach uses the proven regex pattern already in production, avoids substring false positives, and clearly documents the intent through a named constant. The EXEMPT_ACTIONS set is defined inline in each file (not extracted to common.cjs) to minimize change scope for a low-complexity bug fix.
**Consequences**: Two files gain a small amount of duplicated code (the EXEMPT_ACTIONS set and the regex). This is acceptable given the low-complexity nature of the fix. If the exempt verb list grows, extraction to common.cjs should be considered.

## Technology Decisions

- **No new dependencies**: The fix uses only built-in JavaScript features (Set, RegExp).
- **Regex pattern**: `/^(?:--?\w+\s+)*(\w+)/` -- same as `skill-delegation-enforcer.cjs` line 72. Handles optional flags before the action verb.
- **No version bumps**: The hook version comment in `gate-blocker.cjs` should be bumped from 3.2.0 to 3.3.0 and `iteration-corridor.cjs` from 1.1.0 to 1.2.0 to indicate the change.

## Integration Architecture

### Hook Chain: PreToolUse[Skill]

```
User invokes /isdlc analyze "..."
    |
    v
pre-skill-dispatcher.cjs
    |
    +-- 1. iteration-corridor.check(ctx)
    |       skillIsAdvanceAttempt() -> checks EXEMPT_ACTIONS -> "analyze" is exempt -> allow
    |
    +-- 2. gate-blocker.check(ctx)
    |       isGateAdvancementAttempt() -> checks EXEMPT_ACTIONS -> "analyze" is exempt -> allow
    |
    +-- 3. constitutional-iteration-validator.check(ctx)
    |       isGateInvocation() -> no gate keywords in "analyze" -> allow
    |
    v
Skill tool executes (loads isdlc.md command)
    |
    v
PostToolUse[Skill]
    |
    +-- skill-delegation-enforcer
            EXEMPT_ACTIONS.has("analyze") -> exits without pending_delegation
```

### Integration Point Table

| Source | Target | Interface | Data Format | Error Handling |
|--------|--------|-----------|-------------|----------------|
| pre-skill-dispatcher | gate-blocker.check() | Function call | `{ input, state, manifest, requirements, workflows }` | Fail-open (try/catch in dispatcher) |
| pre-skill-dispatcher | iteration-corridor.check() | Function call | Same ctx object | Fail-open |
| gate-blocker.isGateAdvancementAttempt() | EXEMPT_ACTIONS | Set.has() lookup | string (parsed action verb) | Empty string returns false (not exempt, falls through) |

## Summary

The fix adds a lightweight verb-level exemption check to two hooks in the PreToolUse[Skill] chain. The change is isolated to the detection functions (`isGateAdvancementAttempt` and `skillIsAdvanceAttempt`) and does not alter the core gate requirement evaluation logic. The approach reuses a proven pattern from the existing codebase, ensuring consistency across the hook system.
