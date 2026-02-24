# Quick Scan: BUG-0031 -- gate-blocker blocks /isdlc analyze and /isdlc add

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-22
**Coverage**: Full codebase scan of hook system

---

## Scan Summary

| Metric | Value |
|--------|-------|
| Direct files affected | 1 (gate-blocker.cjs) |
| Related files (same pattern) | 1 (iteration-corridor.cjs) |
| Test files to update | 1 (test-gate-blocker-extended.test.cjs) |
| Dispatcher file | 1 (pre-skill-dispatcher.cjs) |
| Config files | 1 (settings.json -- no change needed) |
| Total affected area | 4 files |

## Key Codebase Findings

### 1. Hook Chain Architecture (PreToolUse[Skill])

The `pre-skill-dispatcher.cjs` (line 46-49) defines the hook execution order for all `Skill` tool invocations:

1. `iteration-corridor.cjs` -- corridor enforcement
2. `gate-blocker.cjs` -- gate requirements check
3. `constitutional-iteration-validator.cjs` -- constitutional validation check

The dispatcher **short-circuits on first block** (line 98). This means if any hook in the chain blocks, subsequent hooks never execute.

### 2. Existing Exemption Pattern in skill-delegation-enforcer.cjs

`skill-delegation-enforcer.cjs` (PostToolUse hook, line 37) already defines:

```javascript
const EXEMPT_ACTIONS = new Set(['add', 'analyze']);
```

And parses the action verb from args (line 72):

```javascript
const action = (args.match(/^(?:--?\w+\s+)*(\w+)/) || [])[1] || '';
```

This pattern correctly extracts the first non-flag word from the args string, handling cases like `analyze "description"`, `--verbose analyze "desc"`, and empty args.

### 3. Root Cause: Substring Match on Full Args String

`gate-blocker.cjs` line 130 checks:

```javascript
if (skill === 'isdlc' && (args.includes('advance') || args.includes('gate'))) {
    return true;
}
```

The `args.includes('gate')` check matches the substring "gate" anywhere in the full args string, including inside quoted description text. When a user runs `/isdlc analyze "#64: gate-blocker blocks..."`, the args string is `analyze "#64: gate-blocker blocks..."`, and `args.includes('gate')` returns `true` because the description text contains "gate-blocker".

The same pattern exists in `iteration-corridor.cjs` line 200:

```javascript
if (skill === 'isdlc' && (args.includes('advance') || args.includes('gate'))) {
    return true;
}
```

### 4. Setup Keyword Bypass Exists but Does Not Cover analyze/add

Both `gate-blocker.cjs` (line 60-71) and `iteration-corridor.cjs` (line 38-49) define `SETUP_COMMAND_KEYWORDS` that bypass gate checks. The list includes `discover`, `init`, `status`, etc. but does NOT include `analyze` or `add`.

### 5. constitutional-iteration-validator Has a Different (Safer) Pattern

`constitutional-iteration-validator.cjs` uses regex patterns (line 23-28) like `/\badvance\b/i` with word boundaries. This is less susceptible to substring false positives, but would still not explicitly exempt `analyze`/`add` verbs.

### 6. No Existing Tests for analyze/add Bypass

`test-gate-blocker-extended.test.cjs` has tests for setup command bypass (test 6, 6b) but no tests verifying that `analyze` or `add` verbs pass through the gate check.

## Files Inventory

| File | Path | Role |
|------|------|------|
| gate-blocker.cjs | `src/claude/hooks/gate-blocker.cjs` | Primary fix target |
| iteration-corridor.cjs | `src/claude/hooks/iteration-corridor.cjs` | Same pattern, needs same fix |
| pre-skill-dispatcher.cjs | `src/claude/hooks/dispatchers/pre-skill-dispatcher.cjs` | Dispatcher (no change needed) |
| skill-delegation-enforcer.cjs | `src/claude/hooks/skill-delegation-enforcer.cjs` | Reference implementation for exempt actions |
| constitutional-iteration-validator.cjs | `src/claude/hooks/constitutional-iteration-validator.cjs` | Third hook in chain (lower risk) |
| test-gate-blocker-extended.test.cjs | `src/claude/hooks/tests/test-gate-blocker-extended.test.cjs` | Test file to update |
| settings.json | `src/claude/settings.json` | Hook configuration (no change needed) |
