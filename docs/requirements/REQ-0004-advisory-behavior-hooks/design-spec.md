# Design Specification: REQ-0004 Advisory Behavior Hooks

**Version:** 1.0
**Date:** 2026-02-08
**Status:** Proposed
**Phase:** 04-design
**Traces to:** architecture.md (Sections 3-13), requirements-spec.md (FR-01 through FR-07, NFR-01 through NFR-05)

---

## 1. Document Purpose

This document provides implementation-ready design specifications for the 7 new enforcement hooks defined in REQ-0004. It covers:

1. Exact function signatures, inputs, outputs, and return types for each hook
2. common.cjs interface additions with JSDoc contracts
3. settings.json registration (exact JSON)
4. Error and warning message templates (verbatim strings)
5. State.json field paths read and written by each hook
6. Validation rules for state integrity checks
7. Implementation pseudocode for each hook's decision logic

Developers should be able to implement each hook directly from this specification without consulting the architecture document for ambiguities.

---

## 2. Conventions and Terminology

| Term | Definition |
|------|-----------|
| **Block** | Hook outputs a JSON object to stdout with `continue: false` and a `stopReason` string. Claude Code prevents the tool from executing. |
| **Allow** | Hook produces no stdout output and exits with code 0. Claude Code proceeds with the tool call. |
| **Warn** | Hook outputs a message to stderr via `console.error()`. The tool call is not affected. The message appears in debug logs when `SKILL_VALIDATOR_DEBUG=true`. |
| **Fail-open** | On any error (parse failure, missing file, unexpected data), the hook allows the action (no stdout, exit 0). |
| **Phase delegation** | A Task tool call where the orchestrator delegates work to a phase-specific agent (e.g., `subagent_type: "software-developer"`). |
| **Setup command** | A command that should never be blocked (discover, init, setup, configure, status, etc.). |

### 2.1 Stdout Protocol for Blocking Hooks (PreToolUse)

All blocking hooks MUST use the `outputBlockResponse()` function from common.cjs, which outputs:

```json
{"continue":false,"stopReason":"<human-readable message>"}
```

Claude Code reads this JSON from stdout. If `continue` is `false`, the tool call is prevented and `stopReason` is displayed to the agent.

### 2.2 Stderr Protocol for Warning Hooks (PostToolUse)

Warning-only hooks write to stderr via `console.error()`:

```
[hook-name] WARNING: <message>
  <detail line 1>
  <detail line 2>
```

This output is visible only in debug logs. It never appears in the Claude Code conversation.

### 2.3 Debug Logging

All hooks use `debugLog()` from common.cjs, which writes to stderr only when `SKILL_VALIDATOR_DEBUG=true`:

```
[skill-validator] <message>
```

---

## 3. common.cjs Interface Additions

### 3.1 SETUP_COMMAND_KEYWORDS (Exported Constant)

```javascript
/**
 * Setup commands that should NEVER be blocked by enforcement hooks.
 * These run BEFORE workflows start or are configuration/status commands.
 *
 * Used by: gate-blocker, iteration-corridor, phase-loop-controller,
 *          phase-sequence-guard, detectPhaseDelegation
 *
 * @type {ReadonlyArray<string>}
 */
const SETUP_COMMAND_KEYWORDS = Object.freeze([
    'discover',
    'constitution',
    'init',
    'setup',
    'configure',
    'configure-cloud',
    'new project',
    'project setup',
    'install',
    'status'
]);
```

**Location in common.cjs:** Place after the existing monorepo support section (after line 547), before the State Management section.

**Migration note:** The existing `SETUP_COMMAND_KEYWORDS` in `gate-blocker.cjs` (line 98) and `iteration-corridor.cjs` (line 37) should be replaced with `const { SETUP_COMMAND_KEYWORDS } = require('./lib/common.cjs')` in a follow-up refactoring task. The new hooks will import from common.cjs from the start.

### 3.2 isSetupCommand(text)

```javascript
/**
 * Check if text contains any setup command keyword.
 * Setup commands should never be blocked by enforcement hooks.
 *
 * @param {string} text - Text to search (case-insensitive)
 * @returns {boolean} True if text contains a setup command keyword
 *
 * @example
 *   isSetupCommand('discover the project')     // true
 *   isSetupCommand('delegate to developer')     // false
 *   isSetupCommand('')                          // false
 *   isSetupCommand(null)                        // false
 */
function isSetupCommand(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return SETUP_COMMAND_KEYWORDS.some(keyword => lower.includes(keyword));
}
```

**Location in common.cjs:** Immediately after `SETUP_COMMAND_KEYWORDS`.

### 3.3 detectPhaseDelegation(parsedInput)

```javascript
/**
 * Detect if a Task tool call is a phase delegation.
 *
 * Detection algorithm (ordered by reliability):
 *   1. If tool_name !== 'Task', return not-a-delegation.
 *   2. If combined prompt/description text contains setup keywords, return not-a-delegation.
 *   3. If subagent_type matches a known agent name (via normalizeAgentName + getAgentPhase),
 *      return the detected phase. Skip agents with phase 'all' or 'setup'.
 *   4. If subagent_type did not match, scan combined text for exact agent names from the
 *      skills-manifest ownership map.
 *   5. If still no match, scan for phase name patterns like "01-requirements" or "phase 01".
 *   6. If no match, return not-a-delegation.
 *
 * @param {object} parsedInput - Parsed stdin JSON from Claude Code hook protocol
 * @param {string} parsedInput.tool_name - The tool being invoked (must be 'Task')
 * @param {object} [parsedInput.tool_input] - Tool input parameters
 * @param {string} [parsedInput.tool_input.subagent_type] - The sub-agent type
 * @param {string} [parsedInput.tool_input.prompt] - The task prompt
 * @param {string} [parsedInput.tool_input.description] - The task description
 *
 * @returns {{
 *   isDelegation: boolean,
 *   targetPhase: string|null,
 *   agentName: string|null
 * }}
 *
 * @example
 *   // Direct agent name in subagent_type
 *   detectPhaseDelegation({
 *     tool_name: 'Task',
 *     tool_input: { subagent_type: 'software-developer', prompt: 'implement feature' }
 *   })
 *   // => { isDelegation: true, targetPhase: '06-implementation', agentName: 'software-developer' }
 *
 *   // Setup command bypass
 *   detectPhaseDelegation({
 *     tool_name: 'Task',
 *     tool_input: { subagent_type: 'discover-orchestrator', prompt: 'discover project' }
 *   })
 *   // => { isDelegation: false, targetPhase: null, agentName: null }
 *
 *   // Non-Task tool
 *   detectPhaseDelegation({ tool_name: 'Bash', tool_input: { command: 'ls' } })
 *   // => { isDelegation: false, targetPhase: null, agentName: null }
 */
function detectPhaseDelegation(parsedInput) {
    const NOT_DELEGATION = { isDelegation: false, targetPhase: null, agentName: null };

    // Guard: must be a Task tool call
    if (!parsedInput || parsedInput.tool_name !== 'Task') {
        return NOT_DELEGATION;
    }

    const toolInput = parsedInput.tool_input || {};
    const subagentType = (toolInput.subagent_type || '').trim();
    const prompt = toolInput.prompt || '';
    const description = toolInput.description || '';
    const combined = (prompt + ' ' + description).toLowerCase();

    // Step 1: Check setup command whitelist
    if (isSetupCommand(combined)) {
        return NOT_DELEGATION;
    }

    // Also check subagent_type for setup agent names
    if (subagentType) {
        const normalizedSubagent = normalizeAgentName(subagentType);
        const subagentPhase = getAgentPhase(normalizedSubagent);
        if (subagentPhase === 'all' || subagentPhase === 'setup') {
            return NOT_DELEGATION;
        }
    }

    // Step 2: Match subagent_type against known agent names
    if (subagentType) {
        const normalized = normalizeAgentName(subagentType);
        const phase = getAgentPhase(normalized);
        if (phase) {
            return { isDelegation: true, targetPhase: phase, agentName: normalized };
        }
    }

    // Step 3: Scan prompt/description for exact agent names from manifest
    const manifest = loadManifest();
    if (manifest && manifest.ownership) {
        for (const [agentName, info] of Object.entries(manifest.ownership)) {
            if (info.phase === 'all' || info.phase === 'setup') continue;
            if (combined.includes(agentName.toLowerCase())) {
                return { isDelegation: true, targetPhase: info.phase, agentName };
            }
        }
    }

    // Step 4: Match phase name patterns (e.g., "01-requirements", "phase 06")
    const phasePattern = /(?:phase\s+)?(\d{2})-([a-z][a-z-]*)/i;
    const phaseMatch = combined.match(phasePattern);
    if (phaseMatch) {
        const phaseName = `${phaseMatch[1]}-${phaseMatch[2]}`;
        return { isDelegation: true, targetPhase: phaseName, agentName: null };
    }

    return NOT_DELEGATION;
}
```

**Location in common.cjs:** After `isSetupCommand()`.

### 3.4 Updated module.exports

Add these three entries to the existing `module.exports` block:

```javascript
module.exports = {
    // ... all existing exports unchanged ...

    // Phase delegation detection (REQ-0004)
    detectPhaseDelegation,
    SETUP_COMMAND_KEYWORDS,
    isSetupCommand
};
```

### 3.5 Summary of common.cjs Changes

| Addition | Type | Lines (est.) |
|----------|------|-------------|
| `SETUP_COMMAND_KEYWORDS` | Constant | 12 (incl. JSDoc) |
| `isSetupCommand()` | Function | 14 (incl. JSDoc) |
| `detectPhaseDelegation()` | Function | 52 (incl. JSDoc) |
| `module.exports` additions | 3 lines | 3 |
| **Total** | | **~81 lines** |

common.cjs grows from ~1163 to ~1244 lines.

---

## 4. Hook Module Designs

### 4.1 phase-loop-controller.cjs

**File:** `src/claude/hooks/phase-loop-controller.cjs`
**Type:** PreToolUse[Task]
**Can block:** Yes
**Traces to:** FR-01, AC-01, AC-01a, AC-01b, AC-01c
**Performance budget:** < 100ms

#### 4.1.1 Imports

```javascript
const {
    readStdin,
    readState,
    outputBlockResponse,
    debugLog,
    detectPhaseDelegation
} = require('./lib/common.cjs');
```

#### 4.1.2 Decision Logic (Pseudocode)

```
1. Read stdin (fail-open on empty/bad JSON)
2. Call detectPhaseDelegation(input)
3. If NOT a delegation: exit 0 (allow)
4. Read state.json (fail-open if null)
5. If no active_workflow: exit 0 (allow)
6. Get currentPhase from active_workflow.current_phase
7. Get phaseState from state.phases[currentPhase]
8. If phaseState.status === 'in_progress': exit 0 (allow)
9. Otherwise: BLOCK with message
```

#### 4.1.3 State Reads

| Path | Type | Purpose |
|------|------|---------|
| `active_workflow` | object\|undefined | Check if workflow is active |
| `active_workflow.current_phase` | string | Current phase name |
| `phases[currentPhase].status` | string | Check if TaskUpdate was called |

#### 4.1.4 Block Message Template

```
PHASE DELEGATION WITHOUT PROGRESS TRACKING: You are delegating to phase agent
'{agentName}' for phase '{targetPhase}', but the phase task has not been marked
as in_progress.

Before delegating, you MUST:
1. Call TaskCreate to create a task for this phase (if not already created)
2. Call TaskUpdate to set the task status to in_progress

This ensures the user can see phase progress via spinners. The phase status
in state.json must be "in_progress" before delegation can proceed.

Current phase status: {actualStatus || 'not set'}
```

#### 4.1.5 Edge Cases

| Condition | Behavior | Rationale |
|-----------|----------|-----------|
| `parsedInput` is null | Allow | Fail-open per NFR-01 |
| `tool_name` is not 'Task' | Allow | Only intercepts Task calls |
| `detectPhaseDelegation` returns `isDelegation: false` | Allow | Not a phase delegation |
| `state.json` missing | Allow | Fail-open, no state to check |
| `active_workflow` is null | Allow | No workflow, no enforcement |
| `phases` object is missing | Block | No phases means status was never set |
| `phases[currentPhase]` is missing | Block | Phase entry not created yet |
| `phases[currentPhase].status` is `'pending'` | Block | TaskUpdate not called |
| `phases[currentPhase].status` is `'in_progress'` | Allow | TaskUpdate was called |
| `phases[currentPhase].status` is `'completed'` | Allow | Phase already done, re-delegation is fine |
| Setup command detected in prompt | Allow | Setup commands are never blocked |

#### 4.1.6 Complete Implementation Specification

```javascript
#!/usr/bin/env node
/**
 * iSDLC Phase-Loop Controller - PreToolUse[Task] Hook
 * =====================================================
 * Blocks phase delegation when the orchestrator has not called TaskUpdate
 * to mark the phase as in_progress. Ensures user visibility of progress.
 *
 * Performance budget: < 100ms
 * Fail-open: any error results in silent exit (exit 0, no output)
 *
 * Version: 1.0.0
 */

const {
    readStdin,
    readState,
    outputBlockResponse,
    debugLog,
    detectPhaseDelegation
} = require('./lib/common.cjs');

async function main() {
    try {
        const inputStr = await readStdin();
        if (!inputStr || !inputStr.trim()) {
            process.exit(0);
        }

        let input;
        try {
            input = JSON.parse(inputStr);
        } catch (e) {
            process.exit(0);
        }

        // Only intercept Task tool calls
        if (input.tool_name !== 'Task') {
            process.exit(0);
        }

        // Detect if this is a phase delegation
        const delegation = detectPhaseDelegation(input);
        if (!delegation.isDelegation) {
            debugLog('Not a phase delegation, allowing');
            process.exit(0);
        }

        debugLog('Phase delegation detected:', delegation.targetPhase, delegation.agentName);

        // Read state
        const state = readState();
        if (!state) {
            debugLog('No state.json, allowing (fail-open)');
            process.exit(0);
        }

        // Check for active workflow
        if (!state.active_workflow) {
            debugLog('No active workflow, allowing');
            process.exit(0);
        }

        const currentPhase = state.active_workflow.current_phase;
        if (!currentPhase) {
            debugLog('No current phase, allowing');
            process.exit(0);
        }

        // Check phase status
        const phaseState = state.phases && state.phases[currentPhase];
        const phaseStatus = phaseState && phaseState.status;

        if (phaseStatus === 'in_progress' || phaseStatus === 'completed') {
            debugLog('Phase status is', phaseStatus, '- allowing');
            process.exit(0);
        }

        // Block: phase status is not in_progress
        const agentLabel = delegation.agentName || delegation.targetPhase || 'unknown';
        outputBlockResponse(
            `PHASE DELEGATION WITHOUT PROGRESS TRACKING: You are delegating to ` +
            `phase agent '${agentLabel}' for phase '${delegation.targetPhase}', ` +
            `but the phase task has not been marked as in_progress.\n\n` +
            `Before delegating, you MUST:\n` +
            `1. Call TaskCreate to create a task for this phase (if not already created)\n` +
            `2. Call TaskUpdate to set the task status to in_progress\n\n` +
            `This ensures the user can see phase progress via spinners. The phase status ` +
            `in state.json must be "in_progress" before delegation can proceed.\n\n` +
            `Current phase status: ${phaseStatus || 'not set'}`
        );
        process.exit(0);

    } catch (error) {
        debugLog('Error in phase-loop-controller:', error.message);
        process.exit(0);
    }
}

main();
```

---

### 4.2 plan-surfacer.cjs

**File:** `src/claude/hooks/plan-surfacer.cjs`
**Type:** PreToolUse[Task]
**Can block:** Yes
**Traces to:** FR-02, AC-02, AC-02a, AC-02b, AC-02c
**Performance budget:** < 100ms

#### 4.2.1 Imports

```javascript
const {
    readStdin,
    readState,
    outputBlockResponse,
    debugLog,
    resolveTasksPath
} = require('./lib/common.cjs');

const fs = require('fs');
```

#### 4.2.2 Constants

```javascript
/**
 * Phases that do NOT require a task plan (tasks.md).
 * Any phase not in this set requires the plan to exist before delegation.
 */
const EARLY_PHASES = new Set([
    '00-quick-scan',
    '01-requirements',
    '02-impact-analysis',
    '02-tracing',
    '03-architecture',
    '04-design',
    '05-test-strategy'
]);
```

#### 4.2.3 Decision Logic (Pseudocode)

```
1. Read stdin (fail-open on empty/bad JSON)
2. If tool_name !== 'Task': exit 0 (allow)
3. Read state.json (fail-open if null)
4. If no active_workflow: exit 0 (allow)
5. Get currentPhase from active_workflow.current_phase
6. If EARLY_PHASES.has(currentPhase): exit 0 (allow, plan not needed yet)
7. Resolve tasks.md path via resolveTasksPath()
8. If fs.existsSync(tasksPath): exit 0 (allow, plan exists)
9. BLOCK with message
```

#### 4.2.4 State Reads

| Path | Type | Purpose |
|------|------|---------|
| `active_workflow` | object\|undefined | Check if workflow is active |
| `active_workflow.current_phase` | string | Determine if plan is required |

#### 4.2.5 File System Reads

| Path | Purpose |
|------|---------|
| `resolveTasksPath()` (docs/isdlc/tasks.md or monorepo equivalent) | Check plan existence |

#### 4.2.6 Block Message Template

```
TASK PLAN NOT GENERATED: The current phase '{currentPhase}' requires a task plan
(docs/isdlc/tasks.md) to exist before proceeding. No plan was found.

The task plan provides user visibility into the project roadmap and phase
breakdown. Without it, the user cannot see what work is planned.

To fix this:
1. Run the generate-plan skill (ORCH-012) to create the task plan
2. Or manually create docs/isdlc/tasks.md with the phase breakdown

Expected path: {tasksPath}
```

#### 4.2.7 Edge Cases

| Condition | Behavior | Rationale |
|-----------|----------|-----------|
| `tool_name` is not 'Task' | Allow | Only intercepts Task calls |
| `state.json` missing | Allow | Fail-open per NFR-01 |
| `active_workflow` is null | Allow | No workflow, no enforcement |
| Current phase is in EARLY_PHASES | Allow | Plan not needed for planning phases |
| Current phase is `06-implementation` | Check for tasks.md | Implementation needs plan |
| Current phase is `07-qa` | Check for tasks.md | QA needs plan |
| tasks.md exists (any content) | Allow | File existence is sufficient |
| tasks.md does not exist | Block | Plan must be generated first |
| resolveTasksPath() resolves monorepo path | Correct path checked | Monorepo-aware via common.cjs |
| fs.existsSync throws | Allow | Fail-open, caught by outer try/catch |

#### 4.2.8 Complete Implementation Specification

```javascript
#!/usr/bin/env node
/**
 * iSDLC Plan Surfacer - PreToolUse[Task] Hook
 * =============================================
 * Blocks delegation to implementation+ phases when the task plan
 * (docs/isdlc/tasks.md) has not been generated.
 *
 * Performance budget: < 100ms
 * Fail-open: any error results in silent exit (exit 0, no output)
 *
 * Version: 1.0.0
 */

const {
    readStdin,
    readState,
    outputBlockResponse,
    debugLog,
    resolveTasksPath
} = require('./lib/common.cjs');

const fs = require('fs');

/**
 * Phases that do NOT require a task plan.
 * Any phase not in this set requires the plan to exist.
 */
const EARLY_PHASES = new Set([
    '00-quick-scan',
    '01-requirements',
    '02-impact-analysis',
    '02-tracing',
    '03-architecture',
    '04-design',
    '05-test-strategy'
]);

async function main() {
    try {
        const inputStr = await readStdin();
        if (!inputStr || !inputStr.trim()) {
            process.exit(0);
        }

        let input;
        try {
            input = JSON.parse(inputStr);
        } catch (e) {
            process.exit(0);
        }

        if (input.tool_name !== 'Task') {
            process.exit(0);
        }

        // Read state
        const state = readState();
        if (!state) {
            debugLog('No state.json, allowing (fail-open)');
            process.exit(0);
        }

        if (!state.active_workflow) {
            debugLog('No active workflow, allowing');
            process.exit(0);
        }

        const currentPhase = state.active_workflow.current_phase;
        if (!currentPhase) {
            debugLog('No current phase, allowing');
            process.exit(0);
        }

        // Early phases do not require a plan
        if (EARLY_PHASES.has(currentPhase)) {
            debugLog('Early phase', currentPhase, '- plan not required');
            process.exit(0);
        }

        // Check if tasks.md exists
        const tasksPath = resolveTasksPath();
        if (fs.existsSync(tasksPath)) {
            debugLog('Task plan exists at', tasksPath);
            process.exit(0);
        }

        // Block: implementation+ phase without task plan
        outputBlockResponse(
            `TASK PLAN NOT GENERATED: The current phase '${currentPhase}' requires ` +
            `a task plan (docs/isdlc/tasks.md) to exist before proceeding. ` +
            `No plan was found.\n\n` +
            `The task plan provides user visibility into the project roadmap and ` +
            `phase breakdown. Without it, the user cannot see what work is planned.\n\n` +
            `To fix this:\n` +
            `1. Run the generate-plan skill (ORCH-012) to create the task plan\n` +
            `2. Or manually create docs/isdlc/tasks.md with the phase breakdown\n\n` +
            `Expected path: ${tasksPath}`
        );
        process.exit(0);

    } catch (error) {
        debugLog('Error in plan-surfacer:', error.message);
        process.exit(0);
    }
}

main();
```

---

### 4.3 phase-sequence-guard.cjs

**File:** `src/claude/hooks/phase-sequence-guard.cjs`
**Type:** PreToolUse[Task]
**Can block:** Yes
**Traces to:** FR-03, AC-03, AC-03a, AC-03b, AC-03c, AC-03d
**Performance budget:** < 100ms

#### 4.3.1 Imports

```javascript
const {
    readStdin,
    readState,
    outputBlockResponse,
    debugLog,
    detectPhaseDelegation
} = require('./lib/common.cjs');
```

#### 4.3.2 Decision Logic (Pseudocode)

```
1. Read stdin (fail-open on empty/bad JSON)
2. If tool_name !== 'Task': exit 0 (allow)
3. Call detectPhaseDelegation(input)
4. If NOT a delegation: exit 0 (allow)
5. Read state.json (fail-open if null)
6. If no active_workflow: exit 0 (allow)
7. Get currentPhase from active_workflow.current_phase
8. Get targetPhase from delegation result
9. If targetPhase === currentPhase: exit 0 (allow, correct phase)
10. BLOCK with message including both current and target phase
```

#### 4.3.3 State Reads

| Path | Type | Purpose |
|------|------|---------|
| `active_workflow` | object\|undefined | Check if workflow is active |
| `active_workflow.current_phase` | string | The expected current phase |

#### 4.3.4 Block Message Template

```
OUT-OF-ORDER PHASE DELEGATION: Attempting to delegate to phase '{targetPhase}'
(agent: {agentName || 'unknown'}), but the current workflow phase is '{currentPhase}'.

Phases must execute in the order defined by the workflow. You cannot skip ahead
or go back to a previous phase without advancing through the gate.

To proceed correctly:
- Complete the current phase '{currentPhase}' and pass GATE-{gateNumber}
- Then the orchestrator will advance to the next phase automatically

Current phase: {currentPhase}
Target phase:  {targetPhase}
```

#### 4.3.5 Edge Cases

| Condition | Behavior | Rationale |
|-----------|----------|-----------|
| `tool_name` is not 'Task' | Allow | Only intercepts Task calls |
| Not a phase delegation | Allow | Non-delegation Task calls are fine |
| `state.json` missing | Allow | Fail-open per NFR-01 |
| `active_workflow` is null | Allow | No workflow, no sequence to enforce |
| Target phase matches current phase | Allow | Correct delegation |
| Target phase does not match | Block | Out-of-order delegation |
| Setup command in prompt | Allow | `detectPhaseDelegation` returns false for setup commands |
| Manifest missing (agent phase unknown) | Allow via detectPhaseDelegation | Fail-open: no manifest means no phase to compare |
| targetPhase is null (detection found pattern but no phase) | Allow | Ambiguous detection, fail-open |

#### 4.3.6 Complete Implementation Specification

```javascript
#!/usr/bin/env node
/**
 * iSDLC Phase Sequence Guard - PreToolUse[Task] Hook
 * ====================================================
 * Blocks out-of-order phase delegation. The target phase of a delegation
 * must match the current workflow phase.
 *
 * Performance budget: < 100ms
 * Fail-open: any error results in silent exit (exit 0, no output)
 *
 * Version: 1.0.0
 */

const {
    readStdin,
    readState,
    outputBlockResponse,
    debugLog,
    detectPhaseDelegation
} = require('./lib/common.cjs');

async function main() {
    try {
        const inputStr = await readStdin();
        if (!inputStr || !inputStr.trim()) {
            process.exit(0);
        }

        let input;
        try {
            input = JSON.parse(inputStr);
        } catch (e) {
            process.exit(0);
        }

        if (input.tool_name !== 'Task') {
            process.exit(0);
        }

        // Detect if this is a phase delegation
        const delegation = detectPhaseDelegation(input);
        if (!delegation.isDelegation) {
            debugLog('Not a phase delegation, allowing');
            process.exit(0);
        }

        debugLog('Phase delegation detected -> target:', delegation.targetPhase);

        // Read state
        const state = readState();
        if (!state) {
            debugLog('No state.json, allowing (fail-open)');
            process.exit(0);
        }

        if (!state.active_workflow) {
            debugLog('No active workflow, allowing');
            process.exit(0);
        }

        const currentPhase = state.active_workflow.current_phase;
        if (!currentPhase) {
            debugLog('No current phase set, allowing');
            process.exit(0);
        }

        const targetPhase = delegation.targetPhase;
        if (!targetPhase) {
            debugLog('No target phase detected, allowing (fail-open)');
            process.exit(0);
        }

        // Allow if target matches current
        if (targetPhase === currentPhase) {
            debugLog('Target phase matches current phase, allowing');
            process.exit(0);
        }

        // Extract gate number from current phase (e.g., '03-architecture' -> '03')
        const gateMatch = currentPhase.match(/^(\d+)/);
        const gateNumber = gateMatch ? gateMatch[1] : '??';

        // Block: out-of-order phase delegation
        const agentLabel = delegation.agentName || 'unknown';
        outputBlockResponse(
            `OUT-OF-ORDER PHASE DELEGATION: Attempting to delegate to phase ` +
            `'${targetPhase}' (agent: ${agentLabel}), but the current workflow ` +
            `phase is '${currentPhase}'.\n\n` +
            `Phases must execute in the order defined by the workflow. You cannot ` +
            `skip ahead or go back to a previous phase without advancing through ` +
            `the gate.\n\n` +
            `To proceed correctly:\n` +
            `- Complete the current phase '${currentPhase}' and pass GATE-${gateNumber}\n` +
            `- Then the orchestrator will advance to the next phase automatically\n\n` +
            `Current phase: ${currentPhase}\n` +
            `Target phase:  ${targetPhase}`
        );
        process.exit(0);

    } catch (error) {
        debugLog('Error in phase-sequence-guard:', error.message);
        process.exit(0);
    }
}

main();
```

---

### 4.4 branch-guard.cjs

**File:** `src/claude/hooks/branch-guard.cjs`
**Type:** PreToolUse[Bash]
**Can block:** Yes
**Traces to:** FR-04, AC-04, AC-04a, AC-04b, AC-04c, AC-04d, AC-04e
**Performance budget:** < 200ms (includes git subprocess)

#### 4.4.1 Imports

```javascript
const {
    readStdin,
    readState,
    outputBlockResponse,
    debugLog
} = require('./lib/common.cjs');

const { execSync } = require('child_process');
```

#### 4.4.2 Helper Functions

```javascript
/**
 * Detect if a bash command contains a git commit operation.
 * Matches: git commit, git commit -m, git commit --amend, etc.
 * Also matches chained commands: git add . && git commit -m "msg"
 *
 * @param {string} command - The bash command string
 * @returns {boolean}
 */
function isGitCommit(command) {
    if (!command) return false;
    return /\bgit\s+commit\b/.test(command);
}

/**
 * Get the current git branch name.
 * Uses git rev-parse --abbrev-ref HEAD with a 3-second timeout.
 *
 * @returns {string|null} Branch name, or null if git is unavailable or fails
 */
function getCurrentBranch() {
    try {
        return execSync('git rev-parse --abbrev-ref HEAD', {
            encoding: 'utf8',
            timeout: 3000,
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
    } catch (e) {
        debugLog('git rev-parse failed:', e.message);
        return null;
    }
}
```

#### 4.4.3 Decision Logic (Pseudocode)

```
1. Read stdin (fail-open on empty/bad JSON)
2. If tool_name !== 'Bash': exit 0 (allow)
3. Extract command from tool_input.command
4. If NOT isGitCommit(command): exit 0 (allow)
5. Read state.json (fail-open if null)
6. If no active_workflow: exit 0 (allow)
7. If no active_workflow.git_branch: exit 0 (allow)
8. If git_branch.status !== 'active': exit 0 (allow)
9. Get current branch via getCurrentBranch()
10. If branch is null: exit 0 (fail-open, git error)
11. If branch === 'main' OR branch === 'master': BLOCK
12. Otherwise: exit 0 (allow, on correct feature branch)
```

#### 4.4.4 State Reads

| Path | Type | Purpose |
|------|------|---------|
| `active_workflow` | object\|undefined | Check if workflow is active |
| `active_workflow.git_branch` | object\|undefined | Check branch tracking |
| `active_workflow.git_branch.name` | string | Expected branch name |
| `active_workflow.git_branch.status` | string | Must be 'active' to enforce |

#### 4.4.5 Block Message Template

```
COMMIT TO MAIN BLOCKED: You are attempting to commit to '{currentBranch}' while
an active workflow has a feature branch '{expectedBranch}'.

During an active workflow, all commits should go to the feature branch to keep
main/master clean until the work is reviewed and merged.

To fix this:
1. Switch to the feature branch: git checkout {expectedBranch}
2. Then commit your changes there

Current branch:  {currentBranch}
Expected branch: {expectedBranch}
```

#### 4.4.6 Edge Cases

| Condition | Behavior | Rationale |
|-----------|----------|-----------|
| `tool_name` is not 'Bash' | Allow | Only intercepts Bash calls |
| Command is not `git commit` | Allow | Only checks commits |
| Command is `git push` | Allow | Push is not a commit |
| Command is `git commit-tree` | Allow | Regex does not match |
| `state.json` missing | Allow | Fail-open |
| `active_workflow` is null | Allow | No workflow, no branch enforcement |
| `git_branch` is undefined | Allow | Workflow without branch tracking |
| `git_branch.status` is `'merged'` | Allow | Branch is no longer active |
| `git_branch.status` is `'active'` and branch is `main` | Block | Core enforcement |
| `git_branch.status` is `'active'` and branch is `master` | Block | Also catches master |
| `git_branch.status` is `'active'` and branch is feature branch | Allow | Correct branch |
| `getCurrentBranch()` returns null | Allow | Fail-open, git error |
| `getCurrentBranch()` returns `'HEAD'` (detached) | Allow | Not main/master |
| Chained command: `git add . && git commit -m "msg"` | Detect commit | Regex matches anywhere |
| `git commit --amend` | Detect commit | Regex matches `git commit` |

#### 4.4.7 Complete Implementation Specification

```javascript
#!/usr/bin/env node
/**
 * iSDLC Branch Guard - PreToolUse[Bash] Hook
 * ============================================
 * Blocks git commits to main/master when an active workflow has a
 * feature branch. Ensures commits go to the correct branch.
 *
 * Performance budget: < 200ms (includes git subprocess)
 * Fail-open: any error results in silent exit (exit 0, no output)
 *
 * Version: 1.0.0
 */

const {
    readStdin,
    readState,
    outputBlockResponse,
    debugLog
} = require('./lib/common.cjs');

const { execSync } = require('child_process');

/**
 * Detect if a bash command contains a git commit operation.
 * @param {string} command - The bash command string
 * @returns {boolean}
 */
function isGitCommit(command) {
    if (!command) return false;
    return /\bgit\s+commit\b/.test(command);
}

/**
 * Get the current git branch name via git rev-parse.
 * @returns {string|null} Branch name or null on failure
 */
function getCurrentBranch() {
    try {
        return execSync('git rev-parse --abbrev-ref HEAD', {
            encoding: 'utf8',
            timeout: 3000,
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
    } catch (e) {
        debugLog('git rev-parse failed:', e.message);
        return null;
    }
}

async function main() {
    try {
        const inputStr = await readStdin();
        if (!inputStr || !inputStr.trim()) {
            process.exit(0);
        }

        let input;
        try {
            input = JSON.parse(inputStr);
        } catch (e) {
            process.exit(0);
        }

        if (input.tool_name !== 'Bash') {
            process.exit(0);
        }

        const command = (input.tool_input && input.tool_input.command) || '';

        // Only check git commit commands
        if (!isGitCommit(command)) {
            process.exit(0);
        }

        debugLog('Git commit detected in command:', command);

        // Read state
        const state = readState();
        if (!state) {
            debugLog('No state.json, allowing (fail-open)');
            process.exit(0);
        }

        if (!state.active_workflow) {
            debugLog('No active workflow, allowing');
            process.exit(0);
        }

        const gitBranch = state.active_workflow.git_branch;
        if (!gitBranch || gitBranch.status !== 'active') {
            debugLog('No active git_branch in workflow, allowing');
            process.exit(0);
        }

        // Get current branch from git
        const currentBranch = getCurrentBranch();
        if (!currentBranch) {
            debugLog('Could not determine current branch, allowing (fail-open)');
            process.exit(0);
        }

        debugLog('Current branch:', currentBranch);

        // Block commits to main/master
        if (currentBranch === 'main' || currentBranch === 'master') {
            const expectedBranch = gitBranch.name || 'feature branch';
            outputBlockResponse(
                `COMMIT TO MAIN BLOCKED: You are attempting to commit to ` +
                `'${currentBranch}' while an active workflow has a feature ` +
                `branch '${expectedBranch}'.\n\n` +
                `During an active workflow, all commits should go to the feature ` +
                `branch to keep main/master clean until the work is reviewed ` +
                `and merged.\n\n` +
                `To fix this:\n` +
                `1. Switch to the feature branch: git checkout ${expectedBranch}\n` +
                `2. Then commit your changes there\n\n` +
                `Current branch:  ${currentBranch}\n` +
                `Expected branch: ${expectedBranch}`
            );
            process.exit(0);
        }

        // On feature branch or other branch, allow
        debugLog('Not on main/master, allowing');
        process.exit(0);

    } catch (error) {
        debugLog('Error in branch-guard:', error.message);
        process.exit(0);
    }
}

main();
```

---

### 4.5 state-write-validator.cjs

**File:** `src/claude/hooks/state-write-validator.cjs`
**Type:** PostToolUse[Write, Edit]
**Can block:** No (observational, warnings to stderr only)
**Traces to:** FR-05, AC-05, AC-05a, AC-05b, AC-05c, AC-05d, AC-05e
**Performance budget:** < 100ms

#### 4.5.1 Imports

```javascript
const {
    readStdin,
    debugLog
} = require('./lib/common.cjs');

const fs = require('fs');
```

#### 4.5.2 Constants

```javascript
/**
 * Regex to match state.json file paths (single-project and monorepo).
 * Matches:
 *   .isdlc/state.json
 *   .isdlc/projects/my-project/state.json
 *   .isdlc\state.json (Windows)
 *   .isdlc\projects\my-project\state.json (Windows)
 */
const STATE_JSON_PATTERN = /\.isdlc[/\\](?:projects[/\\][^/\\]+[/\\])?state\.json$/;
```

#### 4.5.3 Validation Rules

These rules detect "impossible" state combinations that indicate fabricated data:

| Rule ID | State Path | Condition | Warning |
|---------|-----------|-----------|---------|
| V1 | `phases[*].constitutional_validation` | `completed === true` AND (`iterations_used` is missing OR `iterations_used < 1`) | Fake constitutional validation: completed but no iterations |
| V2 | `phases[*].iteration_requirements.interactive_elicitation` | `completed === true` AND (`menu_interactions` is missing OR `menu_interactions < 1`) | Fake interactive elicitation: completed but no menu interactions |
| V3 | `phases[*].iteration_requirements.test_iteration` | `completed === true` AND (`current_iteration` is missing OR `current_iteration < 1`) | Fake test iteration: completed but no test runs |

#### 4.5.4 Decision Logic (Pseudocode)

```
1. Read stdin (fail-open on empty/bad JSON)
2. If tool_name !== 'Write' AND tool_name !== 'Edit': exit 0
3. Extract file_path from tool_input.file_path || tool_input.filePath
4. If file_path does not match STATE_JSON_PATTERN: exit 0
5. Read the file from disk (it was just written/edited)
6. Parse as JSON (fail-open on parse error)
7. For each phase in state.phases:
   a. Apply rule V1 (constitutional_validation)
   b. Apply rule V2 (interactive_elicitation)
   c. Apply rule V3 (test_iteration)
   d. For each violation, console.error a warning
8. exit 0 (NEVER block, NEVER write to stdout)
```

#### 4.5.5 Warning Message Templates

**V1 (fake constitutional validation):**
```
[state-write-validator] WARNING: Suspicious state.json write detected.
  Phase: {phaseName}
  Issue: constitutional_validation.completed is true but iterations_used is {value}
  Rule: A completed constitutional validation must have at least 1 iteration
  Path: {filePath}
```

**V2 (fake interactive elicitation):**
```
[state-write-validator] WARNING: Suspicious state.json write detected.
  Phase: {phaseName}
  Issue: interactive_elicitation.completed is true but menu_interactions is {value}
  Rule: A completed elicitation must have at least 1 menu interaction
  Path: {filePath}
```

**V3 (fake test iteration):**
```
[state-write-validator] WARNING: Suspicious state.json write detected.
  Phase: {phaseName}
  Issue: test_iteration.completed is true but current_iteration is {value}
  Rule: A completed test iteration must have at least 1 test run
  Path: {filePath}
```

#### 4.5.6 Edge Cases

| Condition | Behavior | Rationale |
|-----------|----------|-----------|
| `tool_name` is not Write or Edit | Exit silently | Only checks Write/Edit |
| `file_path` is not state.json | Exit silently | Only validates state.json |
| File cannot be read from disk | Exit silently | Fail-open |
| File is not valid JSON | Exit silently | Fail-open |
| No `phases` in state | Exit silently | Nothing to validate |
| Phase has no constitutional_validation | Skip that rule | Normal for phases without const validation |
| constitutional_validation.completed is false | Skip | No violation |
| constitutional_validation.completed is true, iterations_used >= 1 | Skip | Valid |
| constitutional_validation.completed is true, iterations_used < 1 | Warn | Suspicious |
| NEVER produces stdout output | Required | PostToolUse[Write/Edit] stdout would inject text into conversation |

#### 4.5.7 Complete Implementation Specification

```javascript
#!/usr/bin/env node
/**
 * iSDLC State Write Validator - PostToolUse[Write,Edit] Hook
 * ============================================================
 * Validates state.json writes for structural integrity.
 * Detects impossible state combinations that indicate fabricated data.
 *
 * OBSERVATIONAL ONLY: outputs warnings to stderr, never blocks.
 * NEVER produces stdout output (would inject into conversation).
 *
 * Performance budget: < 100ms
 * Fail-open: any error results in silent exit (exit 0, no output)
 *
 * Version: 1.0.0
 */

const {
    readStdin,
    debugLog
} = require('./lib/common.cjs');

const fs = require('fs');

/**
 * Regex to match state.json paths (single-project and monorepo, cross-platform).
 */
const STATE_JSON_PATTERN = /\.isdlc[/\\](?:projects[/\\][^/\\]+[/\\])?state\.json$/;

/**
 * Validate a single phase's state data for suspicious patterns.
 * @param {string} phaseName - Phase identifier (e.g., '01-requirements')
 * @param {object} phaseData - The phase's state object
 * @param {string} filePath - Path to the state.json file
 * @returns {string[]} Array of warning messages (empty if valid)
 */
function validatePhase(phaseName, phaseData, filePath) {
    const warnings = [];

    // Rule V1: constitutional_validation
    const constVal = phaseData.constitutional_validation;
    if (constVal && constVal.completed === true) {
        const iters = constVal.iterations_used;
        if (iters === undefined || iters === null || iters < 1) {
            warnings.push(
                `[state-write-validator] WARNING: Suspicious state.json write detected.\n` +
                `  Phase: ${phaseName}\n` +
                `  Issue: constitutional_validation.completed is true but iterations_used is ${iters}\n` +
                `  Rule: A completed constitutional validation must have at least 1 iteration\n` +
                `  Path: ${filePath}`
            );
        }
    }

    // Rule V2: interactive_elicitation
    const elicit = phaseData.iteration_requirements &&
                   phaseData.iteration_requirements.interactive_elicitation;
    if (elicit && elicit.completed === true) {
        const menuCount = elicit.menu_interactions;
        if (menuCount === undefined || menuCount === null || menuCount < 1) {
            warnings.push(
                `[state-write-validator] WARNING: Suspicious state.json write detected.\n` +
                `  Phase: ${phaseName}\n` +
                `  Issue: interactive_elicitation.completed is true but menu_interactions is ${menuCount}\n` +
                `  Rule: A completed elicitation must have at least 1 menu interaction\n` +
                `  Path: ${filePath}`
            );
        }
    }

    // Rule V3: test_iteration
    const testIter = phaseData.iteration_requirements &&
                     phaseData.iteration_requirements.test_iteration;
    if (testIter && testIter.completed === true) {
        const iterCount = testIter.current_iteration;
        if (iterCount === undefined || iterCount === null || iterCount < 1) {
            warnings.push(
                `[state-write-validator] WARNING: Suspicious state.json write detected.\n` +
                `  Phase: ${phaseName}\n` +
                `  Issue: test_iteration.completed is true but current_iteration is ${iterCount}\n` +
                `  Rule: A completed test iteration must have at least 1 test run\n` +
                `  Path: ${filePath}`
            );
        }
    }

    return warnings;
}

async function main() {
    try {
        const inputStr = await readStdin();
        if (!inputStr || !inputStr.trim()) {
            process.exit(0);
        }

        let input;
        try {
            input = JSON.parse(inputStr);
        } catch (e) {
            process.exit(0);
        }

        // Only process Write and Edit tool results
        if (input.tool_name !== 'Write' && input.tool_name !== 'Edit') {
            process.exit(0);
        }

        const toolInput = input.tool_input || {};
        const filePath = toolInput.file_path || toolInput.filePath || '';

        // Check if the file is a state.json
        if (!STATE_JSON_PATTERN.test(filePath)) {
            process.exit(0);
        }

        debugLog('State.json write detected:', filePath);

        // Read the file from disk (it was just written)
        let stateData;
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            stateData = JSON.parse(content);
        } catch (e) {
            debugLog('Could not read/parse state.json:', e.message);
            process.exit(0);
        }

        // Validate each phase
        const phases = stateData.phases;
        if (!phases || typeof phases !== 'object') {
            process.exit(0);
        }

        for (const [phaseName, phaseData] of Object.entries(phases)) {
            if (!phaseData || typeof phaseData !== 'object') continue;

            const warnings = validatePhase(phaseName, phaseData, filePath);
            for (const warning of warnings) {
                console.error(warning);
            }
        }

        // NEVER produce stdout output
        process.exit(0);

    } catch (error) {
        debugLog('Error in state-write-validator:', error.message);
        process.exit(0);
    }
}

main();
```

---

### 4.6 walkthrough-tracker.cjs

**File:** `src/claude/hooks/walkthrough-tracker.cjs`
**Type:** PostToolUse[Task]
**Can block:** No (observational, warnings to stderr only)
**Traces to:** FR-06, AC-06, AC-06a, AC-06b, AC-06c
**Performance budget:** < 50ms

#### 4.6.1 Imports

```javascript
const {
    readStdin,
    readState,
    debugLog,
    normalizeAgentName
} = require('./lib/common.cjs');
```

#### 4.6.2 Decision Logic (Pseudocode)

```
1. Read stdin (fail-open on empty/bad JSON)
2. If tool_name !== 'Task': exit 0
3. Extract subagent_type from tool_input
4. Normalize subagent_type via normalizeAgentName()
5. If normalized name does not match 'discover-orchestrator': exit 0
6. If tool_result is empty/null: exit 0 (task not yet completed)
7. Read state.json (fail-open if null)
8. If state.discovery_context does not exist: exit 0 (no discover context)
9. If state.discovery_context.walkthrough_completed === true: exit 0 (silent)
10. console.error warning about missing walkthrough
11. exit 0
```

#### 4.6.3 State Reads

| Path | Type | Purpose |
|------|------|---------|
| `discovery_context` | object\|undefined | Check if discover was run |
| `discovery_context.walkthrough_completed` | boolean | Check if walkthrough completed |

#### 4.6.4 Warning Message Template

```
[walkthrough-tracker] WARNING: Discovery completed without constitution walkthrough.
  The /discover command completed, but the constitution walkthrough step was not
  recorded as completed (discovery_context.walkthrough_completed is not true).
  The walkthrough ensures the user reviews and approves the project constitution
  before starting SDLC work. Consider running the walkthrough manually.
```

#### 4.6.5 Discover Completion Detection

The hook detects discover orchestrator completions by checking:
1. `tool_input.subagent_type` normalizes to `'discover-orchestrator'`
2. `tool_result` is present and non-empty (indicating the task finished, not just started)

This is intentionally a broad match. False positives (warning during in-progress discover) are acceptable because the warning is observational only and goes to stderr.

#### 4.6.6 Complete Implementation Specification

```javascript
#!/usr/bin/env node
/**
 * iSDLC Walkthrough Tracker - PostToolUse[Task] Hook
 * ====================================================
 * Warns when a /discover workflow completes without the constitution
 * walkthrough being recorded as completed.
 *
 * OBSERVATIONAL ONLY: outputs warnings to stderr, never blocks.
 *
 * Performance budget: < 50ms
 * Fail-open: any error results in silent exit (exit 0, no output)
 *
 * Version: 1.0.0
 */

const {
    readStdin,
    readState,
    debugLog,
    normalizeAgentName
} = require('./lib/common.cjs');

async function main() {
    try {
        const inputStr = await readStdin();
        if (!inputStr || !inputStr.trim()) {
            process.exit(0);
        }

        let input;
        try {
            input = JSON.parse(inputStr);
        } catch (e) {
            process.exit(0);
        }

        if (input.tool_name !== 'Task') {
            process.exit(0);
        }

        // Check if this is a discover orchestrator task
        const toolInput = input.tool_input || {};
        const subagentType = toolInput.subagent_type || '';
        const normalized = normalizeAgentName(subagentType);

        if (normalized !== 'discover-orchestrator') {
            process.exit(0);
        }

        // Check if the task completed (has a result)
        const toolResult = input.tool_result;
        if (!toolResult) {
            debugLog('No tool_result, task may not be complete yet');
            process.exit(0);
        }

        debugLog('Discover orchestrator task completion detected');

        // Read state
        const state = readState();
        if (!state) {
            debugLog('No state.json, allowing (fail-open)');
            process.exit(0);
        }

        // Check discovery_context
        const discoveryContext = state.discovery_context;
        if (!discoveryContext) {
            debugLog('No discovery_context in state, skipping');
            process.exit(0);
        }

        if (discoveryContext.walkthrough_completed === true) {
            debugLog('Walkthrough completed, silent');
            process.exit(0);
        }

        // Warn: walkthrough not completed
        console.error(
            `[walkthrough-tracker] WARNING: Discovery completed without constitution walkthrough.\n` +
            `  The /discover command completed, but the constitution walkthrough step was not\n` +
            `  recorded as completed (discovery_context.walkthrough_completed is not true).\n` +
            `  The walkthrough ensures the user reviews and approves the project constitution\n` +
            `  before starting SDLC work. Consider running the walkthrough manually.`
        );
        process.exit(0);

    } catch (error) {
        debugLog('Error in walkthrough-tracker:', error.message);
        process.exit(0);
    }
}

main();
```

---

### 4.7 discover-menu-guard.cjs

**File:** `src/claude/hooks/discover-menu-guard.cjs`
**Type:** PostToolUse[Task]
**Can block:** No (observational, warnings to stderr only)
**Traces to:** FR-07, AC-07, AC-07a, AC-07b, AC-07c
**Performance budget:** < 50ms

#### 4.7.1 Imports

```javascript
const {
    readStdin,
    debugLog,
    normalizeAgentName
} = require('./lib/common.cjs');
```

#### 4.7.2 Constants

```javascript
/**
 * Required menu option patterns. All 3 must match for a valid menu.
 */
const REQUIRED_OPTIONS = [
    /new\s+project/i,
    /existing\s+project/i,
    /chat|explore/i
];

/**
 * Forbidden menu option patterns. If any match, the menu is invalid.
 */
const FORBIDDEN_OPTIONS = [
    /scoped\s+analysis/i,
    /auto[- ]?detect/i
];

/**
 * Minimum text length to consider as a menu presentation.
 * Shorter text is unlikely to be a full menu.
 */
const MIN_MENU_TEXT_LENGTH = 50;
```

#### 4.7.3 Decision Logic (Pseudocode)

```
1. Read stdin (fail-open on empty/bad JSON)
2. If tool_name !== 'Task': exit 0
3. Check if this is a discover-related task:
   - subagent_type normalizes to 'discover-orchestrator'
   - OR prompt/description contains 'discover'
4. If NOT discover-related: exit 0
5. Extract text from tool_result (stringify if object)
6. If text length < MIN_MENU_TEXT_LENGTH: exit 0 (too short to be a menu)
7. Check if text contains numbered options (regex: /\[\d+\]|\d+\.\s|option\s+\d/i)
8. If no numbered options detected: exit 0 (not a menu presentation)
9. Check REQUIRED_OPTIONS: all 3 must match
10. Check FORBIDDEN_OPTIONS: none should match
11. If all required present and no forbidden: exit 0 (correct menu)
12. Otherwise: console.error warning about incorrect menu
13. exit 0
```

#### 4.7.4 Warning Message Template

**Missing required options:**
```
[discover-menu-guard] WARNING: Incorrect discover menu detected.
  Expected 3 options: [1] New Project, [2] Existing Project, [3] Chat/Explore
  Missing options: {list of missing patterns}
  The /discover command should present exactly 3 options. See REQ-0001.
```

**Forbidden options present:**
```
[discover-menu-guard] WARNING: Incorrect discover menu detected.
  Found removed options: {list of forbidden matches}
  These options were removed in REQ-0001 and should not appear.
  Expected 3 options: [1] New Project, [2] Existing Project, [3] Chat/Explore
```

#### 4.7.5 Edge Cases

| Condition | Behavior | Rationale |
|-----------|----------|-----------|
| `tool_name` is not 'Task' | Exit silently | Only checks Task |
| Not a discover-related task | Exit silently | Only validates discover output |
| `tool_result` is empty | Exit silently | Task not complete |
| `tool_result` is too short | Exit silently | Not a menu |
| `tool_result` has no numbered options | Exit silently | Not a menu presentation |
| Correct 3-option menu | Exit silently | Valid |
| Missing "Chat/Explore" option | Warn | Incomplete menu |
| "Scoped Analysis" option present | Warn | Removed option |
| "Auto-detect" as standalone option | Warn | Removed option |
| `tool_result` is an object | Stringify before checking | Handle both string and object results |

#### 4.7.6 Complete Implementation Specification

```javascript
#!/usr/bin/env node
/**
 * iSDLC Discover Menu Guard - PostToolUse[Task] Hook
 * ====================================================
 * Warns when the /discover command presents an incorrect menu.
 * The expected menu has exactly 3 options: New Project, Existing Project,
 * Chat/Explore.
 *
 * OBSERVATIONAL ONLY: outputs warnings to stderr, never blocks.
 *
 * Performance budget: < 50ms
 * Fail-open: any error results in silent exit (exit 0, no output)
 *
 * Version: 1.0.0
 */

const {
    readStdin,
    debugLog,
    normalizeAgentName
} = require('./lib/common.cjs');

const REQUIRED_OPTIONS = [
    /new\s+project/i,
    /existing\s+project/i,
    /chat|explore/i
];

const FORBIDDEN_OPTIONS = [
    /scoped\s+analysis/i,
    /auto[- ]?detect/i
];

const MIN_MENU_TEXT_LENGTH = 50;

/**
 * Check if a Task call is related to discover.
 * @param {object} input - Parsed stdin JSON
 * @returns {boolean}
 */
function isDiscoverTask(input) {
    const toolInput = input.tool_input || {};
    const subagentType = toolInput.subagent_type || '';
    const normalized = normalizeAgentName(subagentType);

    if (normalized === 'discover-orchestrator') {
        return true;
    }

    // Fallback: check prompt/description for discover keyword
    const prompt = (toolInput.prompt || '').toLowerCase();
    const description = (toolInput.description || '').toLowerCase();
    return prompt.includes('discover') || description.includes('discover');
}

/**
 * Extract text content from tool_result.
 * @param {*} toolResult - The tool result (string or object)
 * @returns {string}
 */
function extractText(toolResult) {
    if (typeof toolResult === 'string') return toolResult;
    if (toolResult && typeof toolResult === 'object') {
        return JSON.stringify(toolResult);
    }
    return '';
}

async function main() {
    try {
        const inputStr = await readStdin();
        if (!inputStr || !inputStr.trim()) {
            process.exit(0);
        }

        let input;
        try {
            input = JSON.parse(inputStr);
        } catch (e) {
            process.exit(0);
        }

        if (input.tool_name !== 'Task') {
            process.exit(0);
        }

        if (!isDiscoverTask(input)) {
            process.exit(0);
        }

        // Extract text from tool_result
        const text = extractText(input.tool_result);
        if (text.length < MIN_MENU_TEXT_LENGTH) {
            debugLog('Text too short to be a menu:', text.length, 'chars');
            process.exit(0);
        }

        // Check if this looks like a menu (has numbered options)
        if (!/\[\d+\]|\d+\.\s|option\s+\d/i.test(text)) {
            debugLog('No numbered options detected, not a menu');
            process.exit(0);
        }

        debugLog('Discover menu text detected, validating');

        // Check required options
        const missingOptions = [];
        for (const pattern of REQUIRED_OPTIONS) {
            if (!pattern.test(text)) {
                missingOptions.push(pattern.source);
            }
        }

        // Check forbidden options
        const forbiddenFound = [];
        for (const pattern of FORBIDDEN_OPTIONS) {
            if (pattern.test(text)) {
                forbiddenFound.push(pattern.source);
            }
        }

        // If all required present and no forbidden, menu is correct
        if (missingOptions.length === 0 && forbiddenFound.length === 0) {
            debugLog('Correct 3-option menu detected');
            process.exit(0);
        }

        // Warn about incorrect menu
        if (missingOptions.length > 0) {
            console.error(
                `[discover-menu-guard] WARNING: Incorrect discover menu detected.\n` +
                `  Expected 3 options: [1] New Project, [2] Existing Project, [3] Chat/Explore\n` +
                `  Missing options: ${missingOptions.join(', ')}\n` +
                `  The /discover command should present exactly 3 options. See REQ-0001.`
            );
        }

        if (forbiddenFound.length > 0) {
            console.error(
                `[discover-menu-guard] WARNING: Incorrect discover menu detected.\n` +
                `  Found removed options: ${forbiddenFound.join(', ')}\n` +
                `  These options were removed in REQ-0001 and should not appear.\n` +
                `  Expected 3 options: [1] New Project, [2] Existing Project, [3] Chat/Explore`
            );
        }

        process.exit(0);

    } catch (error) {
        debugLog('Error in discover-menu-guard:', error.message);
        process.exit(0);
    }
}

main();
```

---

## 5. settings.json Registration (Exact JSON)

### 5.1 Complete Updated settings.json hooks Section

The following is the exact JSON for the `hooks` section of `src/claude/settings.json` after REQ-0004. Comments are not valid JSON but are included for clarity; they must be removed in the actual file.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/iteration-corridor.cjs",
            "timeout": 10000
          },
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/skill-validator.cjs",
            "timeout": 10000
          },
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/phase-loop-controller.cjs",
            "timeout": 10000
          },
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/plan-surfacer.cjs",
            "timeout": 10000
          },
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/phase-sequence-guard.cjs",
            "timeout": 10000
          },
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/gate-blocker.cjs",
            "timeout": 10000
          },
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/constitution-validator.cjs",
            "timeout": 10000
          }
        ]
      },
      {
        "matcher": "Skill",
        "hooks": [
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/iteration-corridor.cjs",
            "timeout": 10000
          },
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/gate-blocker.cjs",
            "timeout": 10000
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/branch-guard.cjs",
            "timeout": 10000
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/log-skill-usage.cjs",
            "timeout": 5000
          },
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/menu-tracker.cjs",
            "timeout": 5000
          },
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/walkthrough-tracker.cjs",
            "timeout": 5000
          },
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/discover-menu-guard.cjs",
            "timeout": 5000
          }
        ]
      },
      {
        "matcher": "Skill",
        "hooks": [
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/skill-delegation-enforcer.cjs",
            "timeout": 5000
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/test-watcher.cjs",
            "timeout": 10000
          },
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/review-reminder.cjs",
            "timeout": 5000
          }
        ]
      },
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/state-write-validator.cjs",
            "timeout": 5000
          }
        ]
      },
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/state-write-validator.cjs",
            "timeout": 5000
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/delegation-gate.cjs",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

### 5.2 Hook Execution Order Summary

| Event | Position | Hook | Blocks? |
|-------|----------|------|---------|
| PreToolUse[Task] | 1 | iteration-corridor.cjs | Yes |
| PreToolUse[Task] | 2 | skill-validator.cjs | No |
| PreToolUse[Task] | 3 | **phase-loop-controller.cjs** | **Yes** |
| PreToolUse[Task] | 4 | **plan-surfacer.cjs** | **Yes** |
| PreToolUse[Task] | 5 | **phase-sequence-guard.cjs** | **Yes** |
| PreToolUse[Task] | 6 | gate-blocker.cjs | Yes |
| PreToolUse[Task] | 7 | constitution-validator.cjs | No |
| PreToolUse[Skill] | 1 | iteration-corridor.cjs | Yes |
| PreToolUse[Skill] | 2 | gate-blocker.cjs | Yes |
| PreToolUse[Bash] | 1 | **branch-guard.cjs** | **Yes** |
| PostToolUse[Task] | 1 | log-skill-usage.cjs | No |
| PostToolUse[Task] | 2 | menu-tracker.cjs | No |
| PostToolUse[Task] | 3 | **walkthrough-tracker.cjs** | **No** |
| PostToolUse[Task] | 4 | **discover-menu-guard.cjs** | **No** |
| PostToolUse[Skill] | 1 | skill-delegation-enforcer.cjs | No |
| PostToolUse[Bash] | 1 | test-watcher.cjs | No |
| PostToolUse[Bash] | 2 | review-reminder.cjs | No |
| PostToolUse[Write] | 1 | **state-write-validator.cjs** | **No** |
| PostToolUse[Edit] | 1 | **state-write-validator.cjs** | **No** |
| Stop | 1 | delegation-gate.cjs | Yes |

**Total registrations:** 20 (was 12, +8)
**Unique hook files:** 18 (was 11, +7)

---

## 6. State.json Field Reference

### 6.1 Fields Read by New Hooks

No new state.json fields are introduced. All hooks read existing fields.

| Field Path | Read By | Type | Written By |
|-----------|---------|------|------------|
| `active_workflow` | phase-loop-controller, plan-surfacer, phase-sequence-guard, branch-guard | object | sdlc-orchestrator |
| `active_workflow.current_phase` | phase-loop-controller, plan-surfacer, phase-sequence-guard | string | sdlc-orchestrator |
| `active_workflow.git_branch` | branch-guard | object | sdlc-orchestrator |
| `active_workflow.git_branch.name` | branch-guard | string | sdlc-orchestrator |
| `active_workflow.git_branch.status` | branch-guard | string | sdlc-orchestrator |
| `phases[*].status` | phase-loop-controller | string | sdlc-orchestrator / phase agents |
| `phases[*].constitutional_validation` | state-write-validator | object | constitution-validator / phase agents |
| `phases[*].iteration_requirements.interactive_elicitation` | state-write-validator | object | menu-tracker |
| `phases[*].iteration_requirements.test_iteration` | state-write-validator | object | test-watcher |
| `discovery_context` | walkthrough-tracker | object | discover-orchestrator |
| `discovery_context.walkthrough_completed` | walkthrough-tracker | boolean | discover-orchestrator |

### 6.2 Expected active_workflow.git_branch Structure

```json
{
  "active_workflow": {
    "git_branch": {
      "name": "feature/REQ-0004-advisory-behavior-hooks",
      "status": "active",
      "created_at": "2026-02-08T20:00:00Z"
    }
  }
}
```

Valid `status` values: `"active"`, `"merged"`, `"abandoned"`.

The branch-guard only blocks when `status === "active"`. If the field is missing, undefined, or any other value, the hook allows the commit (fail-open).

---

## 7. uninstall.sh Update

Add 7 entries to the `FRAMEWORK_PATTERNS` array in `uninstall.sh`:

```bash
# Advisory behavior hooks (REQ-0004)
"phase-loop-controller.cjs"
"plan-surfacer.cjs"
"phase-sequence-guard.cjs"
"branch-guard.cjs"
"state-write-validator.cjs"
"walkthrough-tracker.cjs"
"discover-menu-guard.cjs"
```

These entries ensure the uninstaller removes the new hook files when the framework is uninstalled.

---

## 8. Error Taxonomy

### 8.1 Block Responses (PreToolUse Hooks)

All block responses follow the same JSON protocol via `outputBlockResponse()`:

```json
{"continue":false,"stopReason":"<message>"}
```

| Hook | Error Code | Message Prefix | Severity |
|------|-----------|----------------|----------|
| phase-loop-controller | PLC-001 | PHASE DELEGATION WITHOUT PROGRESS TRACKING | Blocking |
| plan-surfacer | PS-001 | TASK PLAN NOT GENERATED | Blocking |
| phase-sequence-guard | PSG-001 | OUT-OF-ORDER PHASE DELEGATION | Blocking |
| branch-guard | BG-001 | COMMIT TO MAIN BLOCKED | Blocking |

### 8.2 Warning Messages (PostToolUse Hooks)

All warnings go to stderr only. No stdout output.

| Hook | Warning Code | Message Prefix | Output |
|------|-------------|----------------|--------|
| state-write-validator | SWV-001 | Suspicious state.json write (constitutional) | stderr |
| state-write-validator | SWV-002 | Suspicious state.json write (elicitation) | stderr |
| state-write-validator | SWV-003 | Suspicious state.json write (test iteration) | stderr |
| walkthrough-tracker | WT-001 | Discovery completed without constitution walkthrough | stderr |
| discover-menu-guard | DMG-001 | Incorrect discover menu (missing options) | stderr |
| discover-menu-guard | DMG-002 | Incorrect discover menu (forbidden options) | stderr |

### 8.3 Fail-Open Scenarios

Every hook handles these scenarios identically:

| Scenario | Behavior | Exit Code |
|----------|----------|-----------|
| Empty stdin | No output, exit | 0 |
| Invalid JSON stdin | No output, exit | 0 |
| state.json missing | No output, exit | 0 |
| state.json invalid JSON | No output, exit | 0 |
| Unexpected data type in state | No output, exit | 0 |
| File system error | No output, exit | 0 |
| git command failure (branch-guard) | No output, exit | 0 |
| Manifest file missing | No output, exit | 0 |
| Any uncaught exception | Caught by outer try/catch, exit | 0 |

---

## 9. Validation Rules Summary

### 9.1 PreToolUse Validation (Blocking)

| Rule | Hook | Condition to Block |
|------|------|--------------------|
| Phase delegation without TaskUpdate | phase-loop-controller | `detectPhaseDelegation` returns true AND `phases[currentPhase].status` is not `'in_progress'` or `'completed'` |
| Task plan missing for impl+ phases | plan-surfacer | Current phase NOT in EARLY_PHASES AND `resolveTasksPath()` file does not exist |
| Out-of-order phase delegation | phase-sequence-guard | `detectPhaseDelegation` returns true AND `targetPhase !== currentPhase` |
| Git commit on main with active branch | branch-guard | Command matches `/\bgit\s+commit\b/` AND `git_branch.status === 'active'` AND `getCurrentBranch()` is `'main'` or `'master'` |

### 9.2 PostToolUse Validation (Warning Only)

| Rule | Hook | Condition to Warn |
|------|------|--------------------|
| Fake constitutional validation | state-write-validator | `completed === true` AND `iterations_used` is undefined, null, or < 1 |
| Fake interactive elicitation | state-write-validator | `completed === true` AND `menu_interactions` is undefined, null, or < 1 |
| Fake test iteration | state-write-validator | `completed === true` AND `current_iteration` is undefined, null, or < 1 |
| Walkthrough not completed | walkthrough-tracker | Discover orchestrator task completed AND `discovery_context.walkthrough_completed` is not true |
| Wrong discover menu | discover-menu-guard | Task output looks like a menu AND (missing required options OR contains forbidden options) |

---

## 10. Implementation Order

This order reflects the dependency chain and enables incremental testing.

| Step | Deliverable | Depends On | Files Changed |
|------|------------|------------|---------------|
| 1 | `SETUP_COMMAND_KEYWORDS`, `isSetupCommand()`, `detectPhaseDelegation()` in common.cjs | None | `lib/common.cjs` |
| 2 | common-phase-detection.test.cjs | Step 1 | `tests/common-phase-detection.test.cjs` |
| 3 | branch-guard.cjs + branch-guard.test.cjs | common.cjs (existing) | 2 new files |
| 4 | plan-surfacer.cjs + plan-surfacer.test.cjs | common.cjs (existing) | 2 new files |
| 5 | state-write-validator.cjs + state-write-validator.test.cjs | common.cjs (existing) | 2 new files |
| 6 | phase-loop-controller.cjs + phase-loop-controller.test.cjs | Step 1 | 2 new files |
| 7 | phase-sequence-guard.cjs + phase-sequence-guard.test.cjs | Step 1 | 2 new files |
| 8 | walkthrough-tracker.cjs + walkthrough-tracker.test.cjs | common.cjs (existing) | 2 new files |
| 9 | discover-menu-guard.cjs + discover-menu-guard.test.cjs | common.cjs (existing) | 2 new files |
| 10 | settings.json registration | Steps 3-9 | `settings.json` |
| 11 | uninstall.sh update | Step 10 | `uninstall.sh` |

**Rationale:** Steps 3-5 are fully independent hooks that depend only on existing common.cjs utilities. Steps 6-7 depend on the new `detectPhaseDelegation()` function from step 1. Steps 8-9 are observational hooks with minimal dependencies. Step 10 (settings.json) is last to ensure all hooks exist before registration.

---

## 11. File Inventory

### 11.1 New Files (16 total)

| File | Type | Lines (est.) |
|------|------|-------------|
| `src/claude/hooks/phase-loop-controller.cjs` | Hook | ~80 |
| `src/claude/hooks/plan-surfacer.cjs` | Hook | ~75 |
| `src/claude/hooks/phase-sequence-guard.cjs` | Hook | ~85 |
| `src/claude/hooks/branch-guard.cjs` | Hook | ~90 |
| `src/claude/hooks/state-write-validator.cjs` | Hook | ~110 |
| `src/claude/hooks/walkthrough-tracker.cjs` | Hook | ~65 |
| `src/claude/hooks/discover-menu-guard.cjs` | Hook | ~100 |
| `src/claude/hooks/tests/phase-loop-controller.test.cjs` | Test | ~200 |
| `src/claude/hooks/tests/plan-surfacer.test.cjs` | Test | ~170 |
| `src/claude/hooks/tests/phase-sequence-guard.test.cjs` | Test | ~200 |
| `src/claude/hooks/tests/branch-guard.test.cjs` | Test | ~230 |
| `src/claude/hooks/tests/state-write-validator.test.cjs` | Test | ~230 |
| `src/claude/hooks/tests/walkthrough-tracker.test.cjs` | Test | ~170 |
| `src/claude/hooks/tests/discover-menu-guard.test.cjs` | Test | ~170 |
| `src/claude/hooks/tests/common-phase-detection.test.cjs` | Test | ~140 |
| `docs/requirements/REQ-0004-advisory-behavior-hooks/design-spec.md` | Doc | This file |

### 11.2 Modified Files (3 total)

| File | Change |
|------|--------|
| `src/claude/hooks/lib/common.cjs` | Add ~81 lines (3 exports) |
| `src/claude/settings.json` | Add 8 hook registrations, 3 new matchers |
| `uninstall.sh` | Add 7 entries to FRAMEWORK_PATTERNS |

---

## 12. Traceability Matrix

| Requirement | Design Section | Hook File | Test File |
|-------------|---------------|-----------|-----------|
| FR-01 (Phase-Loop Controller) | 4.1 | phase-loop-controller.cjs | phase-loop-controller.test.cjs |
| FR-02 (Plan Surfacer) | 4.2 | plan-surfacer.cjs | plan-surfacer.test.cjs |
| FR-03 (Phase Sequence Guard) | 4.3 | phase-sequence-guard.cjs | phase-sequence-guard.test.cjs |
| FR-04 (Branch Guard) | 4.4 | branch-guard.cjs | branch-guard.test.cjs |
| FR-05 (State Write Validator) | 4.5 | state-write-validator.cjs | state-write-validator.test.cjs |
| FR-06 (Walkthrough Tracker) | 4.6 | walkthrough-tracker.cjs | walkthrough-tracker.test.cjs |
| FR-07 (Discover Menu Guard) | 4.7 | discover-menu-guard.cjs | discover-menu-guard.test.cjs |
| NFR-01 (Fail-open) | 8.3 | All hooks | All test exit code assertions |
| NFR-02 (Performance) | 4.*.Performance budget | All hooks | Implicit in test timeouts |
| NFR-03 (CJS/Node/OS) | All hook headers | All .cjs files | CI matrix |
| NFR-04 (Testability) | All test specifications | -- | All test files |
| NFR-05 (No regressions) | 5.1 (ordering), 5.2 | settings.json | Full test suite |
| ADR-001 (Shared detection) | 3.3 | common.cjs | common-phase-detection.test.cjs |
| ADR-002 (Shared whitelist) | 3.1 | common.cjs | common-phase-detection.test.cjs |
| ADR-003 (New matchers) | 5.1 | settings.json | Matcher compatibility test |
| ADR-004 (Hook ordering) | 5.2 | settings.json | Integration test |
| ADR-005 (Git subprocess) | 4.4.2 | branch-guard.cjs | branch-guard.test.cjs |
| ADR-006 (State detection) | 4.5.2, 4.5.3 | state-write-validator.cjs | state-write-validator.test.cjs |

---

## 13. Test Specifications

### 13.1 Test Pattern (All Tests Follow This Structure)

```javascript
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const HOOK_PATH = path.join(__dirname, '..', '{hook-name}.cjs');

function setupTestEnv() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), '{hook}-test-'));
    const isdlcDir = path.join(tmpDir, '.isdlc');
    fs.mkdirSync(isdlcDir, { recursive: true });
    return tmpDir;
}

function writeState(tmpDir, state) {
    fs.writeFileSync(
        path.join(tmpDir, '.isdlc', 'state.json'),
        JSON.stringify(state, null, 2)
    );
}

function runHook(tmpDir, stdinJson) {
    const stdinStr = typeof stdinJson === 'string'
        ? stdinJson
        : JSON.stringify(stdinJson);
    try {
        const result = execSync(
            `echo '${stdinStr.replace(/'/g, "\\'")}' | node "${HOOK_PATH}"`,
            {
                cwd: tmpDir,
                env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
                encoding: 'utf8',
                timeout: 5000,
                stdio: ['pipe', 'pipe', 'pipe']
            }
        );
        return { stdout: result.trim(), stderr: '', exitCode: 0 };
    } catch (e) {
        return {
            stdout: (e.stdout || '').trim(),
            stderr: (e.stderr || '').trim(),
            exitCode: e.status || 1
        };
    }
}

function cleanupTestEnv(tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
}
```

### 13.2 Test Case Counts

| Test File | Count | Blocking Tests | Allow Tests | Fail-Open Tests |
|-----------|-------|---------------|-------------|-----------------|
| phase-loop-controller.test.cjs | 12 | 2 | 7 | 3 |
| plan-surfacer.test.cjs | 10 | 2 | 5 | 3 |
| phase-sequence-guard.test.cjs | 12 | 2 | 6 | 4 |
| branch-guard.test.cjs | 14 | 3 | 7 | 4 |
| state-write-validator.test.cjs | 14 | 0 (warns) | 5 | 4 |
| walkthrough-tracker.test.cjs | 10 | 0 (warns) | 5 | 5 |
| discover-menu-guard.test.cjs | 10 | 0 (warns) | 4 | 4 |
| common-phase-detection.test.cjs | 10 | n/a | n/a | 2 |
| **Total** | **92** | **9** | **39** | **29** |

### 13.3 branch-guard.test.cjs Special Setup

Tests for branch-guard require a real git repository because `getCurrentBranch()` runs `git rev-parse --abbrev-ref HEAD`:

```javascript
function setupGitRepo(tmpDir, branchName) {
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
    // Create initial commit on main
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test');
    execSync('git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
    if (branchName && branchName !== 'main') {
        execSync(`git checkout -b ${branchName}`, { cwd: tmpDir, stdio: 'pipe' });
    }
}
```

For the fail-open test (T10: git rev-parse fails), do NOT call `setupGitRepo()` -- the temp directory has no `.git` folder, so `git rev-parse` will fail, and the hook should allow.

### 13.4 state-write-validator.test.cjs Stderr Capture

Tests for state-write-validator must capture stderr since the hook writes warnings there:

```javascript
function runHookWithStderr(tmpDir, stdinJson) {
    const stdinStr = typeof stdinJson === 'string'
        ? stdinJson
        : JSON.stringify(stdinJson);
    try {
        const result = execSync(
            `echo '${stdinStr.replace(/'/g, "\\'")}' | node "${HOOK_PATH}"`,
            {
                cwd: tmpDir,
                env: {
                    ...process.env,
                    CLAUDE_PROJECT_DIR: tmpDir,
                    SKILL_VALIDATOR_DEBUG: 'true'
                },
                encoding: 'utf8',
                timeout: 5000
            }
        );
        return { stdout: result.trim(), stderr: '', exitCode: 0 };
    } catch (e) {
        return {
            stdout: (e.stdout || '').trim(),
            stderr: (e.stderr || '').trim(),
            exitCode: e.status || 0
        };
    }
}
```

**Note:** `state-write-validator` uses `console.error()` for warnings, which always writes to stderr. However, `debugLog()` also writes to stderr and is controlled by `SKILL_VALIDATOR_DEBUG`. For tests that need to capture warnings but not debug noise, the tests should check for the specific warning prefix `[state-write-validator] WARNING:` in stderr.

---

## 14. Performance Budget

| Hook | Budget | Bottleneck | Measured Estimate |
|------|--------|-----------|-------------------|
| phase-loop-controller | 100ms | state.json read + manifest load | ~30ms |
| plan-surfacer | 100ms | state.json read + fs.existsSync | ~15ms |
| phase-sequence-guard | 100ms | state.json read + manifest load | ~30ms |
| branch-guard | 200ms | state.json read + git subprocess | ~50ms |
| state-write-validator | 100ms | state.json read from disk | ~10ms |
| walkthrough-tracker | 50ms | state.json read | ~10ms |
| discover-menu-guard | 50ms | stdin parse only | ~5ms |

**Total worst-case for PreToolUse[Task] (7 hooks):** ~350ms
**Total worst-case for PreToolUse[Bash] (1 hook):** ~50ms
**Total worst-case for PostToolUse[Task] (4 hooks):** ~50ms

All within the configured timeouts (10s for PreToolUse, 5s for PostToolUse).

---

## Appendix A: Design Decisions Log

| Decision | Rationale | Alternatives Rejected |
|----------|-----------|----------------------|
| Shared `detectPhaseDelegation()` in common.cjs | Single source of truth, tested once | Inline in each hook (duplication risk) |
| `SETUP_COMMAND_KEYWORDS` as frozen constant | Immutable, shared across hooks | Mutable array (accidental modification risk) |
| `outputBlockResponse()` for all blocking | Consistent JSON protocol | Direct `console.log(JSON.stringify(...))` (fragile) |
| `console.error()` for warnings | Stays out of conversation, visible in logs | stdout (injects into conversation), file logging (too complex) |
| Git subprocess with 3s timeout | Simple, reliable, handles all git states | Reading .git/HEAD directly (breaks on detached HEAD, worktrees) |
| Phase name set instead of index comparison | Works across different workflow types | Index comparison (fragile when workflow types differ) |
| File existence check for tasks.md | Simple, reliable, no content parsing needed | Content validation (over-engineered for this use case) |
| Regex for state.json path matching | Cross-platform, handles both separators | String comparison (misses Windows paths) |
