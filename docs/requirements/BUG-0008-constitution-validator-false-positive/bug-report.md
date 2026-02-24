# Bug Report: BUG-0008 — Constitution Validator False Positive on Delegation Prompts

**Reported**: 2026-02-12
**Severity**: HIGH (blocks workflow execution)
**Component**: Hook system (pre-task-dispatcher pipeline)
**Affected Hooks**: constitution-validator.cjs, iteration-corridor.cjs, gate-blocker.cjs

---

## Summary

Multiple PreToolUse[Task] hooks in the pre-task-dispatcher pipeline use regex pattern matching to detect "phase completion" or "gate advancement" intent in Task tool prompts. These patterns match phrases that appear in **delegation prompts** (instructions sent FROM the phase-loop controller TO an agent), not just in agent completion declarations. This causes the hooks to block legitimate delegation calls, preventing the phase-loop controller from assigning work to agents.

## Reproduction Steps

1. Start a fix or feature workflow via `/isdlc fix` or `/isdlc feature`
2. Phase-loop controller (isdlc.md STEP 3d) attempts to delegate to a phase agent via Task tool
3. The delegation prompt contains phrases like:
   - "Complete Phase 01 requirements capture"
   - "validate GATE-01 before declaring complete"
   - "Phase 05 test strategy"
4. Pre-task-dispatcher fires hooks in order; one or more hooks match these phrases and BLOCK the Task call

## Expected Behavior

Delegation prompts (phase-loop controller -> agent) should pass through all hooks without blocking. Only completion declarations (agent -> orchestrator/gate) should trigger validation.

## Actual Behavior

Hooks detect delegation prompts as completion/gate-advancement attempts and block them. The phase-loop controller cannot delegate work to agents.

## Root Cause

Three hooks use overly broad regex patterns that match delegation prompts:

### 1. constitution-validator.cjs (COMPLETION_PATTERNS, line 31-43)
```javascript
const COMPLETION_PATTERNS = [
    /phase\s+(complete|done|finished)/i,    // Matches "Complete Phase 01"
    /gate\s+validation/i,                   // Matches "validate GATE-01"
    /phase\s+\d+\s+complete/i,              // Matches "Phase 01 complete" in instructions
    /implementation\s+complete/i,            // Matches instructions mentioning "implementation complete"
    /testing\s+complete/i,                   // Matches instructions about testing
    /requirements\s+complete/i              // Matches requirements instructions
];
```

### 2. iteration-corridor.cjs (ADVANCE_PATTERNS, line 54-65)
```javascript
const ADVANCE_PATTERNS = [
    /advance/i,           // Too broad
    /gate/i,              // Matches ANY mention of "gate" including "validate GATE-01"
    /delegate/i,          // Matches the word "delegate" in delegation instructions
    /phase\s+complete/i   // Matches "Complete Phase 01"
];
```

### 3. gate-blocker.cjs (gateKeywords, line 138)
```javascript
const gateKeywords = ['advance', 'gate', 'next phase', 'proceed', 'move to phase', 'progress to'];
```
This only triggers for orchestrator Task calls (subagent_type check), so it is less problematic but still susceptible.

## Fix Strategy

Add a **delegation detection guard** at the top of each affected hook's detection function. If the Task call is a delegation (detected by `detectPhaseDelegation()` from common.cjs returning `isDelegation: true`), skip the completion/gate/corridor pattern matching entirely.

This is the correct approach because:
- `detectPhaseDelegation()` already exists and works correctly
- Delegations are NOT completion declarations -- they are work assignments
- The phase-loop-controller and phase-sequence-guard hooks already use `detectPhaseDelegation()` correctly
- Adding the guard is a minimal, focused fix that does not change any validation logic

## Affected Files

| File | Function | Fix |
|------|----------|-----|
| `src/claude/hooks/constitution-validator.cjs` | `isPhaseCompletionAttempt()` | Add delegation guard before pattern matching |
| `src/claude/hooks/iteration-corridor.cjs` | `check()` / `taskHasAdvanceKeywords()` | Add delegation guard before ADVANCE_PATTERNS check |
| `src/claude/hooks/gate-blocker.cjs` | `isGateAdvancementAttempt()` | Add delegation guard before gate keyword check |
| `src/claude/hooks/tests/test-constitution-validator.test.cjs` | N/A | Add tests for delegation bypass |
| `src/claude/hooks/tests/test-iteration-corridor.test.cjs` | N/A | Add tests for delegation bypass |
| `src/claude/hooks/tests/test-gate-blocker-ext.test.cjs` | N/A | Add tests for delegation bypass |
