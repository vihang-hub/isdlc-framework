# Bug Report: BUG-0021-GH-5

**Title**: delegation-gate infinite loop on /isdlc analyze -- missing carve-out for Phase A
**Severity**: Medium
**Priority**: P1
**Reported**: 2026-02-17
**External Tracker**: [GitHub #5](https://github.com/vihangshah/isdlc/issues/5)
**Bug ID**: BUG-0021

---

## Summary

The `skill-delegation-enforcer.cjs` PostToolUse hook writes a `pending_delegation` marker to state.json for ALL `/isdlc` invocations, including `/isdlc analyze`. However, `/isdlc analyze` (Phase A) is spec-exempt from orchestrator delegation -- it runs inline without a Task delegation to `sdlc-orchestrator`. The `delegation-gate.cjs` Stop hook then sees the uncleared `pending_delegation` marker and blocks every subsequent response, creating an infinite loop that can only be resolved by manually clearing the marker from state.json.

---

## Expected Behavior

When `/isdlc analyze` is invoked via the Skill tool, no `pending_delegation` marker should be written because `analyze` does not require orchestrator delegation. The response should proceed without being blocked by the delegation gate.

## Actual Behavior

1. User invokes `/isdlc analyze`
2. `skill-delegation-enforcer.cjs` fires on PostToolUse[Skill] and writes `pending_delegation` marker with `required_agent: "sdlc-orchestrator"`
3. Phase A runs inline (no Task delegation to sdlc-orchestrator)
4. Response completes, `delegation-gate.cjs` Stop hook fires
5. Stop hook finds `pending_delegation` marker, checks `skill_usage_log` for delegation to `sdlc-orchestrator` -- none found
6. Stop hook blocks the response with "did not delegate" error
7. On retry, the same block occurs because the marker is never cleared
8. Infinite blocking loop until manual intervention

---

## Steps to Reproduce

1. Open a project with iSDLC installed and state.json initialized
2. Run `/isdlc analyze`
3. Observe that `skill-delegation-enforcer.cjs` writes `pending_delegation` to state.json
4. Observe that `delegation-gate.cjs` blocks the response
5. Every subsequent response attempt is blocked by the same stale marker

---

## Root Cause

`skill-delegation-enforcer.cjs` treats ALL `/isdlc` invocations identically -- it matches the skill name `isdlc` in `DELEGATION_MAP` and unconditionally writes a `pending_delegation` marker. There is no exemption list for `/isdlc` subcommands that run inline without orchestrator delegation.

The `analyze` action (Phase A) is designed to run inline within the isdlc.md command handler. It does not delegate to `sdlc-orchestrator` via Task -- it directly invokes the analysis agents. This means the `pending_delegation` marker is never cleared by a matching delegation entry in `skill_usage_log`.

**Key files:**
- `src/claude/hooks/skill-delegation-enforcer.cjs` (writes marker for ALL /isdlc invocations)
- `src/claude/hooks/delegation-gate.cjs` (blocks when marker exists but no delegation found)

---

## Impact

- **User-facing**: All responses blocked after `/isdlc analyze` until manual state.json edit
- **Workaround**: Manually delete `pending_delegation` object from `.isdlc/state.json`
- **Affected commands**: `/isdlc analyze` (and potentially any future inline-only subcommands)

---

## Environment

- Framework: iSDLC 0.1.0-alpha
- Runtime: Node.js 20+
- Platform: macOS Darwin 25.2.0

---

## Proposed Fix

Add an `EXEMPT_ACTIONS` set (or similar) to `skill-delegation-enforcer.cjs` that lists `/isdlc` subcommands which run inline without orchestrator delegation. When the parsed action from args matches an exempt action, skip writing the `pending_delegation` marker and skip emitting the mandatory delegation message.

Initial exempt actions: `analyze` (Phase A).

As a defense-in-depth measure, also add a carve-out in `delegation-gate.cjs` so that if the pending delegation args contain an exempt action, the marker is cleared without blocking.
