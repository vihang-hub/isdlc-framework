# Module Design: BUG-0031 -- gate-blocker blocks /isdlc analyze and /isdlc add

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-22
**Coverage**: Module specifications, data structures, change details

---

## Module 1: gate-blocker.cjs -- isGateAdvancementAttempt()

### Responsibility

Detects whether a tool invocation is an attempt to advance through a workflow gate. Returns `true` for gate advancement attempts and `false` for all other invocations, including workflow-independent verbs.

### Change Specification

**Location**: `src/claude/hooks/gate-blocker.cjs`, lines 117-133 (Skill tool branch of `isGateAdvancementAttempt()`)

**Add**: A new constant `EXEMPT_ACTIONS` (Set) at module level, and an action verb parsing + exemption check inside the Skill tool branch, placed AFTER the setup keyword check and BEFORE the `args.includes('advance') || args.includes('gate')` check.

**New constant** (near line 72, after `SETUP_COMMAND_KEYWORDS`):

```javascript
/**
 * REQ-0023: Three-verb model actions that run outside workflow machinery.
 * These verbs do not write state.json or create branches; they must never
 * be blocked by gate or iteration corridor checks.
 * Matches skill-delegation-enforcer.cjs EXEMPT_ACTIONS.
 */
const EXEMPT_ACTIONS = new Set(['analyze', 'add']);
```

**New check** (inside `isGateAdvancementAttempt()`, after line 128 setup keyword check, before line 130 advance/gate check):

```javascript
// BUG-0031: Exempt analyze/add verbs — workflow-independent actions
const action = (args.match(/^(?:--?\w+\s+)*(\w+)/) || [])[1] || '';
if (EXEMPT_ACTIONS.has(action)) {
    debugLog(`Exempt action '${action}' detected via Skill, skipping gate check`);
    return false;
}
```

### Data Structures

| Structure | Type | Description |
|-----------|------|-------------|
| `EXEMPT_ACTIONS` | `Set<string>` | Set containing `'analyze'` and `'add'`. Used for O(1) lookup. |
| `action` | `string` | First non-flag word extracted from `args` using regex. Empty string if args is empty or unparseable. |

### Dependencies

- No new imports. Uses existing `debugLog` from common.cjs.
- Regex pattern matches `skill-delegation-enforcer.cjs` line 72.

---

## Module 2: iteration-corridor.cjs -- skillIsAdvanceAttempt()

### Responsibility

Detects whether a Skill tool invocation is an attempt to advance/escape the iteration corridor. Returns `true` for advance attempts and `false` for all other invocations.

### Change Specification

**Location**: `src/claude/hooks/iteration-corridor.cjs`, lines 189-205 (`skillIsAdvanceAttempt()`)

**Add**: Same `EXEMPT_ACTIONS` constant and action verb parsing + exemption check, placed AFTER the setup keyword check and BEFORE the `args.includes('advance') || args.includes('gate')` check.

**New constant** (near line 49, after `SETUP_COMMAND_KEYWORDS`):

```javascript
/**
 * REQ-0023: Three-verb model actions that run outside workflow machinery.
 * These verbs do not write state.json or create branches; they must never
 * be blocked by gate or iteration corridor checks.
 * Matches skill-delegation-enforcer.cjs EXEMPT_ACTIONS.
 */
const EXEMPT_ACTIONS = new Set(['analyze', 'add']);
```

**New check** (inside `skillIsAdvanceAttempt()`, after line 198 setup keyword loop, before line 200 advance/gate check):

```javascript
// BUG-0031: Exempt analyze/add verbs — workflow-independent actions
const action = (args.match(/^(?:--?\w+\s+)*(\w+)/) || [])[1] || '';
if (EXEMPT_ACTIONS.has(action)) {
    debugLog(`Exempt action '${action}' detected via Skill, skipping corridor check`);
    return false;
}
```

### Data Structures

Same as Module 1.

### Dependencies

- No new imports. Uses existing `debugLog` from common.cjs.

---

## Module 3: test-gate-blocker-extended.test.cjs -- New Test Cases

### Responsibility

Verify that `analyze` and `add` verbs are exempt from gate-blocker checks, while `advance`, `gate-check`, and `build` continue to trigger gate checks.

### Change Specification

**Location**: `src/claude/hooks/tests/test-gate-blocker-extended.test.cjs`, inside the `'Gate advancement detection'` describe block (after test 6b, around line 241)

**Add**: Four new test cases:

1. **Test: analyze verb exemption** -- `/isdlc analyze "gate-blocker issue"` passes through gate-blocker
2. **Test: add verb exemption** -- `/isdlc add "fix gate issue"` passes through gate-blocker
3. **Test: analyze with flags exemption** -- `/isdlc --verbose analyze "desc"` passes through gate-blocker
4. **Test: build verb NOT exempt** -- `/isdlc build "something with gate"` is NOT exempt (continues to standard logic)

### Test Input Patterns

| Test | Skill | Args | Expected |
|------|-------|------|----------|
| analyze exemption | `isdlc` | `analyze "gate-blocker blocks analyze"` | Pass through (no output) |
| add exemption | `isdlc` | `add "fix gate issue"` | Pass through (no output) |
| analyze with flags | `isdlc` | `--verbose analyze "desc"` | Pass through (no output) |
| build NOT exempt | `isdlc` | `build "something with gate"` | Falls through to standard logic (may or may not block depending on state) |

---

## Version Bumps

| File | Current Version | New Version |
|------|----------------|-------------|
| `gate-blocker.cjs` | 3.2.0 | 3.3.0 |
| `iteration-corridor.cjs` | 1.1.0 | 1.2.0 |
