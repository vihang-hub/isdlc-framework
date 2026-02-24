# Trace Analysis: delegation-gate infinite loop on /isdlc analyze

**Generated**: 2026-02-17T00:20:00.000Z
**Bug**: delegation-gate infinite loop on /isdlc analyze -- missing carve-out for Phase A
**External ID**: GitHub #5
**Workflow**: fix
**Phase**: 02-tracing
**Bug ID**: BUG-0021

---

## Executive Summary

The `skill-delegation-enforcer.cjs` hook unconditionally writes a `pending_delegation` marker to state.json whenever the `/isdlc` Skill tool is invoked, regardless of the subcommand. The `delegation-gate.cjs` Stop hook then checks every response for evidence that delegation to `sdlc-orchestrator` occurred. For workflow commands (`feature`, `fix`, `upgrade`, `test`, `start`), this delegation happens via `Task -> sdlc-orchestrator`, so the gate clears normally. However, `/isdlc analyze` (Phase A) is architecturally exempt from the workflow machinery -- it runs inline with no state.json writes, no hooks, no branches, and critically no orchestrator delegation. The `pending_delegation` marker is therefore never satisfied, causing `delegation-gate.cjs` to block every subsequent response in an infinite loop. The only escape is manual deletion of the marker from state.json (or the 5-error safety valve, which may not trigger for non-error blocks).

**Root Cause Confidence**: HIGH
**Severity**: Medium (blocks all responses after `/isdlc analyze` until manual intervention)
**Estimated Complexity**: Low (surgical fix in two files, well-defined exempt action list)

---

## Symptom Analysis

### Error Manifestation

The user experiences a hard block loop after invoking `/isdlc analyze`:

1. **Visible symptom**: Every response after `/isdlc analyze` is blocked with the message:
   ```
   You loaded /isdlc but did not delegate to "sdlc-orchestrator" for initialization.
   Follow the loaded command's Phase-Loop Controller: begin with Task -> sdlc-orchestrator (STEP 1).
   Do not implement the request directly.
   ```
2. **Loop behavior**: The block repeats on every response attempt because the `pending_delegation` marker persists in state.json and no action can clear it through normal flow.
3. **No error thrown**: The hooks execute successfully (exit code 0) -- this is a logic bug, not a runtime error. The 5-consecutive-error safety valve (delegation-gate.cjs lines 160-186) does NOT trigger because the blocking path (lines 146-153) is in the normal success flow, not the catch block.

### Triggering Conditions

- **Required**: `/isdlc analyze` invoked via the Skill tool
- **State prerequisite**: `.isdlc/state.json` must exist (if missing, enforcer fails open at line 66-69)
- **Not user-type specific**: Affects all users equally
- **Not time-dependent**: Occurs immediately on first response after `/isdlc analyze`
- **Persistent**: Marker remains until manually cleared or state.json is deleted

### Error Keywords

- `pending_delegation`
- `did not delegate`
- `sdlc-orchestrator`
- `Phase-Loop Controller`

---

## Execution Path

### Entry Point

The bug is triggered when the user invokes `/isdlc analyze "description"` via the Skill tool. The Skill tool fires a PostToolUse event that is consumed by `skill-delegation-enforcer.cjs`.

### Complete Call Chain

```
User invokes: /isdlc analyze "some description"
    |
    v
[1] Claude Code fires PostToolUse[Skill] event
    |
    v
[2] skill-delegation-enforcer.cjs receives event via stdin
    File: src/claude/hooks/skill-delegation-enforcer.cjs
    |
    +--[2a] Parses input JSON (line 40-44)
    |       tool_name: "Skill"
    |       tool_input: { skill: "isdlc", args: "analyze \"some description\"" }
    |
    +--[2b] Extracts skill name (line 53)
    |       skill = "isdlc" (lowercased, leading "/" stripped)
    |
    +--[2c] Looks up DELEGATION_MAP[skill] (line 57)
    |       DELEGATION_MAP = { 'isdlc': 'sdlc-orchestrator', 'discover': 'discover-orchestrator' }
    |       requiredAgent = "sdlc-orchestrator"  <-- MATCH (no args inspection!)
    |
    +--[2d] Reads state.json (line 65)
    |       State exists -> continues
    |
    +--[2e] *** BUG LOCATION #1 *** Writes pending_delegation (lines 72-77)
    |       writePendingDelegation({
    |           skill: "isdlc",
    |           required_agent: "sdlc-orchestrator",
    |           invoked_at: "2026-02-17T00:15:00.000Z",
    |           args: "analyze \"some description\""
    |       })
    |       This writes to state.json -> state.pending_delegation = { ... }
    |
    +--[2f] Outputs mandatory delegation context message (lines 80-87)
    |       "MANDATORY: You have loaded the /isdlc command..."
    |       This message tells Claude to delegate, but Phase A runs inline!
    |
    +--[2g] Exits with code 0
    |
    v
[3] isdlc.md command handler processes the Skill invocation
    File: src/claude/commands/isdlc.md
    |
    +--[3a] Parses action from args: "analyze"
    +--[3b] Routes to SCENARIO 5: Phase A Preparation Pipeline (line 232)
    +--[3c] Phase A runs INLINE -- no Task delegation to sdlc-orchestrator
    +--[3d] Phase A writes to docs/requirements/{slug}/ only
    +--[3e] Phase A does NOT write to .isdlc/state.json
    +--[3f] Phase A does NOT log to skill_usage_log
    +--[3g] No delegation entry created anywhere
    |
    v
[4] Claude completes response -> Stop hook fires
    |
    v
[5] delegation-gate.cjs receives Stop event via stdin
    File: src/claude/hooks/delegation-gate.cjs
    |
    +--[5a] Reads pending_delegation marker (line 88)
    |       pending = { skill: "isdlc", required_agent: "sdlc-orchestrator",
    |                   invoked_at: "...", args: "analyze \"some description\"" }
    |       pending is NOT null -> continues enforcement
    |
    +--[5b] Reads state.json (line 97)
    |       State exists -> continues
    |
    +--[5c] Checks skill_usage_log via findDelegation() (line 117)
    |       Searches for entry with agent matching "sdlc-orchestrator"
    |       after invoked_at timestamp
    |       Result: false (no delegation occurred)
    |
    +--[5d] Checks workflow phase progress (line 126)
    |       state.active_workflow may or may not exist
    |       If exists: current_phase_index check
    |       For analyze: no active_workflow was created by Phase A
    |       OR if a workflow exists from prior work, its phase_index
    |       would need to be > 0 (may or may not pass)
    |       Result: typically does NOT clear marker
    |
    +--[5e] Checks current_phase in_progress (line 134)
    |       No phase was set in_progress by Phase A
    |       Result: does NOT clear marker
    |
    +--[5f] *** BUG LOCATION #2 *** BLOCKS response (lines 148-153)
    |       Outputs JSON: { decision: "block", reason: "You loaded /isdlc but
    |       did not delegate to \"sdlc-orchestrator\"..." }
    |
    +--[5g] Exits with code 0 (block is a "successful" operation)
    |
    v
[6] Claude retries response -> Stop hook fires again -> SAME BLOCK
    |
    v
[7] INFINITE LOOP: marker never cleared, delegation never happens
```

### Data Flow Diagram

```
state.json                  skill-delegation-enforcer     delegation-gate
-----------                 -------------------------     ---------------
                            PostToolUse[Skill] event
                                    |
                            skill="isdlc" matched
                            args="analyze ..."
                            (args NOT inspected)
                                    |
pending_delegation: null  ------>  WRITE  ------> pending_delegation: {
                                                    skill: "isdlc",
                                                    required_agent: "sdlc-orchestrator",
                                                    args: "analyze ..."
                                                  }
                                                          |
                            isdlc.md runs Phase A         |
                            (inline, no delegation)       |
                                                          |
                                                  Stop hook fires
                                                          |
                                                  READ pending_delegation
                                                  -> exists!
                                                          |
                                                  findDelegation() -> false
                                                  phase_index check -> no clear
                                                  current_phase check -> no clear
                                                          |
                                                  BLOCK (marker preserved)
                                                          |
                                                  Next response attempt
                                                          |
                                                  BLOCK again (infinite)
```

### Key Observation: The args Field Contains Evidence

The `pending_delegation.args` field contains `"analyze \"some description\""`. Both the enforcer (at write time) and the gate (at check time) have access to this string. Neither currently parses the action word from it. This is the primary fix point -- parsing the first word of `args` and checking it against an exempt list.

---

## Root Cause Analysis

### Hypothesis 1 (PRIMARY -- HIGH CONFIDENCE): Missing exempt action check in skill-delegation-enforcer.cjs

**Evidence**:
- `skill-delegation-enforcer.cjs` line 57: `DELEGATION_MAP[skill]` matches on skill name `"isdlc"` only, with no inspection of `args`
- The `args` variable is captured at line 54 (`const args = toolInput.args || ''`) but only passed through to `writePendingDelegation()` at line 76 -- never used for routing decisions
- `isdlc.md` line 582-583 explicitly states: `analyze` "Does NOT require an active workflow" and "Does NOT read or write state.json, does NOT create branches, does NOT invoke hooks"
- `isdlc.md` line 799: `/isdlc analyze` workflow type is `phase-a` with `*(outside workflow)*`, gate mode `none`, branch `none`
- The architectural intent is clear: `analyze` should not participate in hook enforcement at all

**Fix point**: `src/claude/hooks/skill-delegation-enforcer.cjs` lines 56-61. Add an `EXEMPT_ACTIONS` set and parse the first word from `args`. If the action matches, exit early (skip marker write and context message).

### Hypothesis 2 (SECONDARY -- DEFENSE IN DEPTH): Missing exempt action check in delegation-gate.cjs

**Evidence**:
- `delegation-gate.cjs` line 88: reads `pending_delegation` and proceeds if non-null
- Lines 112-114: extracts `requiredAgent` and `invokedAt` but does not inspect `pending.args`
- The `args` field is available in the pending marker (written at enforcer line 76) but never read by the gate
- Even if the enforcer is fixed, a stale marker from a previous session or a race condition could cause the same block

**Fix point**: `src/claude/hooks/delegation-gate.cjs` between lines 88-94. After reading the pending marker, parse `pending.args` for the action word. If exempt, call `clearMarkerAndResetErrors()` and exit cleanly.

### Hypothesis 3 (REJECTED): Safety valve should catch the loop

The 5-error safety valve at delegation-gate.cjs lines 160-186 is in the `catch` block. The blocking path (lines 146-153) is in the normal try flow and exits with `process.exit(0)`. The safety valve only triggers on unhandled exceptions, not on deliberate blocks. This is by design -- the safety valve protects against corrupt state, not against logic bugs.

### Ranked Hypotheses

| Rank | Hypothesis | Confidence | Fix Complexity |
|------|-----------|------------|----------------|
| 1 | Missing EXEMPT_ACTIONS in skill-delegation-enforcer.cjs | HIGH | Low -- add Set + 5 lines of parsing |
| 2 | Missing exempt check in delegation-gate.cjs (defense-in-depth) | HIGH | Low -- add 8 lines of parsing + clear |
| 3 | Safety valve insufficient | N/A (by design) | N/A -- not a bug |

### Suggested Fixes

**Fix 1 (Primary): Add EXEMPT_ACTIONS to skill-delegation-enforcer.cjs**

```javascript
// Add after DELEGATION_MAP (line 29):
const EXEMPT_ACTIONS = new Set(['analyze']);

// Add in main() after requiredAgent check (after line 60):
// Parse action from args (first non-flag word)
const action = (args.match(/^(?:--?\w+\s+)*(\w+)/) || [])[1] || '';
if (EXEMPT_ACTIONS.has(action.toLowerCase())) {
    debugLog(`Skill delegation enforcer: /${skill} ${action} is exempt from delegation`);
    process.exit(0);
}
```

**Fix 2 (Defense-in-depth): Add exempt check to delegation-gate.cjs**

```javascript
// Add at module level (after require block):
const EXEMPT_ACTIONS = new Set(['analyze']);

// Add after reading pending marker (after line 92), before state read:
const pendingArgs = (pending.args || '');
const pendingAction = (pendingArgs.match(/^(?:--?\w+\s+)*(\w+)/) || [])[1] || '';
if (EXEMPT_ACTIONS.has(pendingAction.toLowerCase())) {
    debugLog('Delegation gate: pending delegation is for exempt action, auto-clearing');
    clearMarkerAndResetErrors();
    process.exit(0);
}
```

### Fix Points Summary

| File | Line(s) | Change |
|------|---------|--------|
| `src/claude/hooks/skill-delegation-enforcer.cjs` | After line 29 | Add `EXEMPT_ACTIONS = new Set(['analyze'])` |
| `src/claude/hooks/skill-delegation-enforcer.cjs` | After line 60 | Parse action from args, skip if exempt |
| `src/claude/hooks/delegation-gate.cjs` | Module level | Add `EXEMPT_ACTIONS = new Set(['analyze'])` |
| `src/claude/hooks/delegation-gate.cjs` | After line 92 | Parse action from pending.args, auto-clear if exempt |
| `.claude/hooks/skill-delegation-enforcer.cjs` | (sync) | Copy from src after fix |
| `.claude/hooks/delegation-gate.cjs` | (sync) | Copy from src after fix |

### Files Requiring New Tests

| File | Tests to Add |
|------|-------------|
| `src/claude/hooks/tests/skill-delegation-enforcer.test.cjs` | New file: exempt action skip, non-exempt marker write, empty args handling |
| `src/claude/hooks/tests/delegation-gate.test.cjs` | New file: exempt action auto-clear, non-exempt block, stale marker clear |

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-17T00:25:00.000Z",
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "error_keywords": ["pending_delegation", "did not delegate", "sdlc-orchestrator", "Phase-Loop Controller"],
  "files_analyzed": [
    "src/claude/hooks/skill-delegation-enforcer.cjs",
    "src/claude/hooks/delegation-gate.cjs",
    "src/claude/hooks/lib/common.cjs",
    "src/claude/commands/isdlc.md"
  ],
  "fix_points": [
    {
      "file": "src/claude/hooks/skill-delegation-enforcer.cjs",
      "type": "primary",
      "change": "Add EXEMPT_ACTIONS set and action parsing to skip marker for exempt commands"
    },
    {
      "file": "src/claude/hooks/delegation-gate.cjs",
      "type": "defense-in-depth",
      "change": "Add exempt action check to auto-clear stale markers without blocking"
    }
  ],
  "root_cause_confidence": "high",
  "estimated_complexity": "low"
}
```
