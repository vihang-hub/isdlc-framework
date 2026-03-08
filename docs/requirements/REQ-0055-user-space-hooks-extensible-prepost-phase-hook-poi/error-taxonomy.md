# Error Taxonomy: User-Space Hooks

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-03-08
**Coverage**: 100%

---

## 1. Hook Execution Errors

| Code | Name | Severity | Recovery |
|------|------|----------|----------|
| `HOOK_TIMEOUT` | Hook exceeded timeout | Warning | Kill process, report to user, continue workflow |
| `HOOK_CRASH` | Hook process crashed (signal/exception) | Warning | Report to user, continue workflow |
| `HOOK_BLOCK` | Hook exited with code 2 | Block | Report to user with hook output, present options (fix, skip, override) |
| `HOOK_WARNING` | Hook exited with code 1 or 3+ | Warning | Show output to user, continue |
| `HOOK_NOT_FOUND` | Hook directory does not exist | Silent | No action -- absence of hooks is normal |

## 2. Configuration Errors

| Code | Name | Severity | Recovery |
|------|------|----------|----------|
| `CONFIG_PARSE_ERROR` | `.isdlc/config.json` is invalid JSON | Warning | Use default values, log warning |
| `CONFIG_MISSING` | `.isdlc/config.json` does not exist | Silent | Use default values |

## 3. Resolution Errors

| Code | Name | Severity | Recovery |
|------|------|----------|----------|
| `ALIAS_UNRESOLVED` | Phase alias not found in alias map | Warning | Log warning, skip hook point |
| `DIR_NOT_READABLE` | Hook directory exists but is not readable | Warning | Log warning, skip directory |

## 4. Error Propagation Rules

1. **Hook errors never crash the framework**: All errors from user hooks are caught and reported, never propagated as exceptions
2. **Blocks only apply at pre-gate**: Only `pre-gate` hook blocks prevent gate advancement. Blocks at other hook points (post-phase, post-workflow) are downgraded to warnings since the operation has already occurred
3. **Timeout is a warning, not a block**: A timed-out hook is killed and reported as a warning. If the developer wants timeout to block, they should handle it in their hook's error path (exit 2 on timeout)
4. **Multiple blocks**: If multiple hooks block at the same hook point, the first block is reported. Remaining hooks still execute (to surface all issues), but only the first blockingHook is highlighted in the result
