# Trace Analysis: Constitution Validator False Positive on Delegation Prompts

**Generated**: 2026-02-12T21:40:00Z
**Bug**: 3 PreToolUse[Task] hooks use regex patterns that match delegation prompts, causing false positive blocks
**External ID**: BUG-0008
**Workflow**: fix
**Phase**: 02-tracing

---

## Executive Summary

Three hooks in the pre-task-dispatcher pipeline (`constitution-validator.cjs`, `iteration-corridor.cjs`, `gate-blocker.cjs`) use regex-based pattern matching to detect when an agent declares a phase complete or attempts to advance past a gate. However, these same regex patterns match against **delegation prompts** -- the instructions the phase-loop controller sends TO agents to begin work. The root cause is that none of these three hooks call `detectPhaseDelegation()` (which already exists in `common.cjs` and is used correctly by 3 other hooks) to distinguish delegations from completion declarations. The fix is to add a delegation detection guard at the top of each affected function, returning early (allowing) when the Task call is a delegation.

**Root Cause Confidence**: HIGH -- all three code paths are fully traced and the regex matches are deterministic.
**Severity**: HIGH -- blocks workflow execution entirely when delegation prompts trigger false positives.
**Estimated Complexity**: LOW -- each fix is 3-5 lines of code using an existing, tested utility function.

---

## Symptom Analysis

### Observed Symptoms

1. **Workflow delegation blocked**: When the phase-loop controller (isdlc.md STEP 3d) attempts to delegate work to a phase agent via the Task tool, the delegation is blocked by one or more hooks in the pre-task-dispatcher pipeline.

2. **Error messages observed**: The blocking hook returns a `stopReason` such as:
   - `"PHASE COMPLETION BLOCKED: Constitutional validation required."` (from constitution-validator)
   - `"ITERATION CORRIDOR: Tests are failing..."` (from iteration-corridor)
   - `"GATE BLOCKED: Iteration requirements not satisfied..."` (from gate-blocker)

3. **Trigger condition**: The delegation prompt template from isdlc.md STEP 3d is:
   ```
   "Execute Phase {NN} - {Phase Name} for {workflow_type} workflow.
    Artifact folder: {artifact_folder}
    Phase key: {phase_key}
    Validate GATE-{NN} on completion."
   ```
   This prompt contains phrases like "Complete Phase 01", "validate GATE-01", "phase 02-tracing", which match the regex patterns in all three hooks.

4. **Affected users**: All workflow types (fix, feature) that use the phase-loop controller.

5. **Timing**: Occurs on every delegation attempt when a corridor or constitutional validation state is active.

### Pattern Match Analysis

The following specific regex patterns in each hook match delegation prompts:

**constitution-validator.cjs** (`COMPLETION_PATTERNS`, lines 31-43):
| Pattern | Delegation text that matches | False positive? |
|---------|------------------------------|-----------------|
| `/phase\s+(complete\|done\|finished)/i` | "Complete Phase 01" (word order swap) | NO -- "Complete Phase" does not match "phase complete". However, "phase complete" could appear in delegation suffix text. |
| `/gate\s+validation/i` | "Validate GATE-01" -> lowercased "validate gate-01" -> does not match "gate validation" literally. | BORDERLINE -- "gate validation" is not in the template, but natural language variations could trigger it. |
| `/phase\s+\d+\s+complete/i` | "Phase 01 complete" appears in instructions like "Validate GATE-01 on completion" | YES if the agent's prompt wraps around to "Phase 01 complete" phrasing. |
| `/requirements\s+complete/i` | "requirements capture" does not match, but "requirements complete" could appear in agent instructions about the phase. | CONDITIONAL |

The actual trigger is more nuanced. The delegation prompt says "Validate GATE-{NN} on completion" which, when combined with phase names, can form matches like "gate validation" in close proximity. More critically, the `combined` text aggregation (`prompt + ' ' + description`) means ANY text in the Task call is checked against ALL patterns.

**iteration-corridor.cjs** (`ADVANCE_PATTERNS`, lines 54-65):
| Pattern | Delegation text that matches | False positive? |
|---------|------------------------------|-----------------|
| `/advance/i` | Not in standard template | No (unless custom text) |
| `/gate/i` | "Validate GATE-01" -> "gate" matches | **YES** -- extremely broad, matches any mention of "gate" |
| `/next\s+phase/i` | Not in standard template | No |
| `/proceed/i` | Not in standard template | No |
| `/delegate/i` | Not in standard template, but the word "delegate" could appear in instructions | Conditional |
| `/phase\s+complete/i` | "Complete Phase" does not match (wrong order), but "phase complete" could appear | Conditional |

The `/gate/i` pattern is the most problematic -- it matches the word "gate" anywhere in the combined prompt text, and every delegation prompt contains "Validate GATE-NN on completion."

**gate-blocker.cjs** (`gateKeywords`, line 138):
| Keyword | Delegation text that matches | False positive? |
|---------|------------------------------|-----------------|
| `'gate'` | "Validate GATE-01" -> lowercased "gate" matches | **YES** |
| `'advance'` | Not in standard template | No |
| `'next phase'` | Not in standard template | No |
| `'proceed'` | "Proceeding to Phase..." possible | Conditional |

However, gate-blocker has an **additional guard**: it only triggers when `subagent_type.includes('orchestrator')` (line 137). This means it only fires when the Task call targets the orchestrator, not when delegating TO an agent. This makes gate-blocker less likely to produce false positives in practice, but still susceptible if subagent_type is misconfigured.

### Error Source Locations

| Hook | File | Detection Function | Pattern Location |
|------|------|--------------------|------------------|
| constitution-validator | `src/claude/hooks/constitution-validator.cjs` | `isPhaseCompletionAttempt()` (line 88) | `COMPLETION_PATTERNS` (lines 31-43) |
| iteration-corridor | `src/claude/hooks/iteration-corridor.cjs` | `taskHasAdvanceKeywords()` (line 178) | `ADVANCE_PATTERNS` (lines 54-65) |
| gate-blocker | `src/claude/hooks/gate-blocker.cjs` | `isGateAdvancementAttempt()` (line 117) | `gateKeywords` (line 138) |

---

## Execution Path

### Entry Point: Pre-Task Dispatcher

The execution begins at `src/claude/hooks/dispatchers/pre-task-dispatcher.cjs` (line 75, `main()`).

**Call chain:**
```
Claude Code runtime
  -> PreToolUse[Task] hook trigger (settings.json)
    -> pre-task-dispatcher.cjs main()
      -> readStdin() -- parses JSON input { tool_name: "Task", tool_input: { prompt, description, subagent_type } }
      -> readState() -- loads .isdlc/state.json once
      -> loadManifest(), loadIterationRequirements(), loadWorkflowDefinitions() -- load configs once
      -> builds ctx = { input, state, manifest, requirements, workflows }
      -> iterates HOOKS array in order (lines 60-73):
        1. iteration-corridor.check(ctx)    -- SHORT-CIRCUITS ON BLOCK
        2. skill-validator.check(ctx)
        3. phase-loop-controller.check(ctx)
        4. plan-surfacer.check(ctx)
        5. phase-sequence-guard.check(ctx)
        6. gate-blocker.check(ctx)           -- SHORT-CIRCUITS ON BLOCK
        7. constitution-validator.check(ctx)  -- SHORT-CIRCUITS ON BLOCK
        8. test-adequacy-blocker.check(ctx)
```

The dispatcher short-circuits on the FIRST block (line 130: `if (result.decision === 'block')`). This means `iteration-corridor` (position 1) blocks BEFORE `constitution-validator` (position 7) or `gate-blocker` (position 6) even get a chance to run.

### Path 1: constitution-validator.cjs

```
check(ctx)                                          [line 219]
  -> isPhaseCompletionAttempt(input)                [line 227]
    -> toolName === 'Task'?                         [line 92] YES
    -> combined = (prompt + ' ' + description).toLowerCase()  [line 95]
    -> SETUP_COMMAND_KEYWORDS check                 [line 98-103] -- bypass check
    -> COMPLETION_PATTERNS.some(pattern => pattern.test(combined))  [line 105]
       IF ANY pattern matches -> returns true
  -> If true: loads state, checks constitutional status
  -> If constitutional validation not satisfied -> BLOCK with stopReason
```

**Key observation**: `isPhaseCompletionAttempt()` does NOT call `detectPhaseDelegation()`. It goes straight to regex matching on the combined prompt text. A delegation prompt containing "phase complete" or "gate validation" will trigger `return true` on line 105, sending the flow into the blocking path.

### Path 2: iteration-corridor.cjs

```
check(ctx)                                          [line 220]
  -> toolName === 'Task'?                           [line 231] YES
  -> loads state, determines currentPhase           [lines 247-261]
  -> loads requirements, determines corridor state  [lines 263-293]
  -> IF corridorState.corridor !== 'NONE':
    -> taskHasAdvanceKeywords(toolInput)             [line 300 or 337]
      -> combined = prompt + ' ' + description      [line 181]
      -> SETUP_COMMAND_KEYWORDS check               [lines 184-189]
      -> ADVANCE_PATTERNS.some(pattern => pattern.test(combined))  [line 191]
         /gate/i matches "Validate GATE-01" -> returns true
    -> IF true AND corridor active -> BLOCK
```

**Key observation**: `taskHasAdvanceKeywords()` does NOT call `detectPhaseDelegation()`. The `/gate/i` pattern is extremely broad and matches the word "gate" in ANY context, including "Validate GATE-01 on completion" in delegation prompts. This is the MOST LIKELY hook to trigger first (position 1 in dispatcher order).

**Critical detail**: This hook only blocks when a corridor is ACTIVE (either TEST_CORRIDOR or CONST_CORRIDOR). If no corridor is active, the hook returns `allow` at line 291. This means the false positive only manifests when an iteration loop is already in progress -- exactly the scenario where the phase-loop controller needs to re-delegate after a test fix or constitutional fix cycle.

### Path 3: gate-blocker.cjs

```
check(ctx)                                          [line 506]
  -> isGateAdvancementAttempt(input)                [line 514]
    -> toolName === 'Task'?                         [line 122] YES
    -> combined = prompt + ' ' + description (lowercased)  [lines 124-126]
    -> SETUP_COMMAND_KEYWORDS check                 [lines 129-134]
    -> subagentType.includes('orchestrator')?       [line 137]
       IF NO -> falls through, returns false at line 165
       IF YES -> checks gateKeywords in prompt/description
         'gate' matches "Validate GATE-01" -> returns true
    -> IF true: full gate requirement check
    -> IF requirements not satisfied -> BLOCK
```

**Key observation**: gate-blocker has a PARTIAL guard -- it only checks `gateKeywords` when `subagent_type` includes "orchestrator". Delegation prompts typically target specific agent names (e.g., `subagent_type: "trace-analyst"`), NOT "orchestrator". This means gate-blocker is LESS LIKELY to produce false positives in practice, but the bug is still present if `subagent_type` is missing or misconfigured.

### Correct Pattern (phase-loop-controller, phase-sequence-guard)

For comparison, hooks that handle delegation correctly:

```
check(ctx)
  -> detectPhaseDelegation(input)                   // FIRST CALL
    -> Checks subagent_type against manifest agents
    -> Scans prompt for agent names
    -> Matches phase patterns (e.g., "02-tracing")
    -> Returns { isDelegation: true/false, targetPhase, agentName }
  -> IF isDelegation: true -> (hook-specific logic for delegations)
  -> IF isDelegation: false -> allow (not a delegation)
```

These hooks call `detectPhaseDelegation()` FIRST, before doing any other pattern matching. This is the correct approach.

### Data Flow Summary

```
Delegation prompt: "Execute Phase 02 - Tracing for fix workflow. Validate GATE-02 on completion."
                                                                     ^^^^^^^
                                                              This word triggers /gate/i

Input JSON:
{
  "tool_name": "Task",
  "tool_input": {
    "prompt": "Execute Phase 02 - Tracing for fix workflow. Validate GATE-02 on completion.",
    "subagent_type": "trace-analyst"
  }
}

  -> iteration-corridor: combined.test(/gate/i) -> TRUE -> BLOCK (if corridor active)
  -> gate-blocker: subagent_type = "trace-analyst" (not orchestrator) -> SKIP -> allow
  -> constitution-validator: combined.test(COMPLETION_PATTERNS) -> depends on exact wording
```

---

## Root Cause Analysis

### Hypothesis 1: Missing delegation detection guard (CONFIRMED -- HIGH confidence)

**Evidence:**
1. `detectPhaseDelegation()` exists in `common.cjs` (line 1087) and works correctly
2. Three hooks already use it successfully: `phase-loop-controller.cjs` (line 39), `phase-sequence-guard.cjs` (line 38), `test-adequacy-blocker.cjs` (line 84)
3. The three affected hooks (`constitution-validator`, `iteration-corridor`, `gate-blocker`) do NOT import or call `detectPhaseDelegation()`
4. The delegation prompt template (isdlc.md STEP 3d, line 817) contains "Validate GATE-{NN}" which deterministically matches `/gate/i` in iteration-corridor

**Root cause**: The three affected hooks were written before `detectPhaseDelegation()` was established as the standard delegation detection mechanism. They use ad-hoc regex pattern matching that cannot distinguish between "instructions about gates" (delegation) and "attempting to pass a gate" (completion).

### Hypothesis 2: Overly broad regex patterns (CONTRIBUTING FACTOR)

**Evidence:**
1. `/gate/i` in `iteration-corridor.cjs` (line 56) matches ANY occurrence of "gate" -- this is far too broad
2. `/advance/i` (line 55) matches "advance" as a substring in words like "advanced"
3. `gateKeywords = ['gate']` in `gate-blocker.cjs` (line 138) uses substring matching

**Assessment**: Even if a delegation guard is added, these patterns are dangerously broad. However, narrowing the patterns is NOT the recommended fix because: (a) it risks missing genuine completion attempts, and (b) the delegation guard approach is cleaner and matches the established pattern in other hooks.

### Hypothesis 3: Missing context discrimination in hook inputs (REJECTED)

**Assessment**: The hook input JSON DOES contain enough context to distinguish delegations. The `subagent_type` field and the prompt text contain agent names, phase patterns, and other markers that `detectPhaseDelegation()` already uses successfully. The problem is not missing context -- it is that these hooks do not use the available context.

### Ranked Hypotheses

| Rank | Hypothesis | Confidence | Evidence Strength |
|------|-----------|------------|-------------------|
| 1 | Missing delegation detection guard | HIGH | 4 direct code evidence points |
| 2 | Overly broad regex patterns | HIGH (contributing) | 3 pattern analysis points |
| 3 | Missing context discrimination | REJECTED | Context IS available |

### Suggested Fix

Add a delegation detection guard at the top of each affected function. The pattern is identical across all three hooks:

**constitution-validator.cjs** -- `isPhaseCompletionAttempt()` (after line 92, before the SETUP_COMMAND_KEYWORDS check):

```javascript
// BUG-0008: Skip completion pattern matching for delegation prompts
const { detectPhaseDelegation } = require('./lib/common.cjs');
// ... in isPhaseCompletionAttempt():
if (toolName === 'Task') {
    try {
        const delegation = detectPhaseDelegation(input);
        if (delegation.isDelegation) {
            debugLog('Delegation detected, skipping completion pattern check');
            return false;
        }
    } catch (e) {
        // Fail-open: if delegation detection fails, fall through to pattern matching
        debugLog('Delegation detection error, falling through:', e.message);
    }
    // ... existing pattern matching continues
}
```

**iteration-corridor.cjs** -- `taskHasAdvanceKeywords()` (after line 181, before SETUP_COMMAND_KEYWORDS check):

```javascript
// BUG-0008: Skip advance pattern matching for delegation prompts
const { detectPhaseDelegation } = require('./lib/common.cjs');
// ... in taskHasAdvanceKeywords() or in check() before calling taskHasAdvanceKeywords():
try {
    const delegation = detectPhaseDelegation(input);  // input from ctx
    if (delegation.isDelegation) {
        debugLog('Delegation detected, skipping advance keyword check');
        return false;  // or skip the taskHasAdvanceKeywords() call
    }
} catch (e) {
    debugLog('Delegation detection error, falling through:', e.message);
}
```

**gate-blocker.cjs** -- `isGateAdvancementAttempt()` (after line 122, before SETUP_COMMAND_KEYWORDS check):

```javascript
// BUG-0008: Skip gate keyword matching for delegation prompts
const { detectPhaseDelegation } = require('./lib/common.cjs');
// ... in isGateAdvancementAttempt():
if (toolName === 'Task') {
    try {
        const delegation = detectPhaseDelegation(input);
        if (delegation.isDelegation) {
            debugLog('Delegation detected, skipping gate advancement check');
            return false;
        }
    } catch (e) {
        debugLog('Delegation detection error, falling through:', e.message);
    }
    // ... existing checks continue
}
```

### Import Considerations

- `constitution-validator.cjs` already imports from `./lib/common.cjs` (line 15). Just add `detectPhaseDelegation` to the destructured import.
- `iteration-corridor.cjs` already imports from `./lib/common.cjs` (line 20). Just add `detectPhaseDelegation` to the destructured import.
- `gate-blocker.cjs` already imports from `./lib/common.cjs` (line 14). Just add `detectPhaseDelegation` to the destructured import.

### Files to Modify

| File | Change | Lines |
|------|--------|-------|
| `src/claude/hooks/constitution-validator.cjs` | Add `detectPhaseDelegation` import + guard in `isPhaseCompletionAttempt()` | ~5 lines |
| `src/claude/hooks/iteration-corridor.cjs` | Add `detectPhaseDelegation` import + guard in `check()` before `taskHasAdvanceKeywords()` call | ~5 lines |
| `src/claude/hooks/gate-blocker.cjs` | Add `detectPhaseDelegation` import + guard in `isGateAdvancementAttempt()` | ~5 lines |
| `src/claude/hooks/tests/test-constitution-validator.test.cjs` | Add delegation bypass tests | New test cases |
| `src/claude/hooks/tests/test-iteration-corridor.test.cjs` | Add delegation bypass tests | New test cases |
| `src/claude/hooks/tests/test-gate-blocker-ext.test.cjs` | Add delegation bypass tests | New test cases |

### Files NOT to Modify (Constraints)

| File | Reason |
|------|--------|
| `src/claude/hooks/lib/common.cjs` | `detectPhaseDelegation()` works correctly (CON-001) |
| `src/claude/hooks/dispatchers/pre-task-dispatcher.cjs` | Dispatcher order is correct (CON-002) |
| `src/claude/hooks/phase-loop-controller.cjs` | Already uses `detectPhaseDelegation()` correctly |
| `src/claude/hooks/phase-sequence-guard.cjs` | Already uses `detectPhaseDelegation()` correctly |
| `src/claude/hooks/test-adequacy-blocker.cjs` | Already uses `detectPhaseDelegation()` correctly |

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-12T21:42:00Z",
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "error_keywords": ["PHASE COMPLETION BLOCKED", "ITERATION CORRIDOR", "GATE BLOCKED", "detectPhaseDelegation", "COMPLETION_PATTERNS", "ADVANCE_PATTERNS", "gateKeywords"],
  "files_traced": [
    "src/claude/hooks/constitution-validator.cjs",
    "src/claude/hooks/iteration-corridor.cjs",
    "src/claude/hooks/gate-blocker.cjs",
    "src/claude/hooks/dispatchers/pre-task-dispatcher.cjs",
    "src/claude/hooks/lib/common.cjs",
    "src/claude/hooks/phase-loop-controller.cjs",
    "src/claude/hooks/phase-sequence-guard.cjs",
    "src/claude/commands/isdlc.md"
  ],
  "dispatcher_execution_order": [
    "iteration-corridor",
    "skill-validator",
    "phase-loop-controller",
    "plan-surfacer",
    "phase-sequence-guard",
    "gate-blocker",
    "constitution-validator",
    "test-adequacy-blocker"
  ],
  "most_likely_trigger": "iteration-corridor /gate/i pattern matching 'Validate GATE-NN' in delegation prompt (position 1 in dispatcher, short-circuits before other hooks run)"
}
```
