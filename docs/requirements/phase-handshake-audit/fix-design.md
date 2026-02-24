# Fix Design: Phase Handshake Audit (GH-55)

**Date**: 2026-02-20
**Based On**: Investigation Report (investigation-report.md)
**Status**: Design Complete

This document provides the technical design for fixing each weakness (W-1 through W-8) identified in the phase handshake investigation.

---

## Table of Contents

1. [W-1 FIX: PHASE_AGENT_MAP Unification (CRITICAL)](#w-1-fix-phase_agent_map-unification)
2. [W-2 FIX: Extract activatePhase() and completePhase() Helpers](#w-2-fix-extract-activatephase-and-completephase-helpers)
3. [W-3 FIX: Eliminate phase_status Redundancy](#w-3-fix-eliminate-phase_status-redundancy)
4. [W-4 FIX: writeState() JSDoc Correction](#w-4-fix-writestate-jsdoc-correction)
5. [W-5 FIX: Remove Duplicate loadIterationRequirements()](#w-5-fix-remove-duplicate-loaditerationrequirements)
6. [W-6 FIX: Consolidate STATE_JSON_PATTERN](#w-6-fix-consolidate-state_json_pattern)
7. [W-7 FIX: Wrap Reconstruction in try/finally](#w-7-fix-wrap-reconstruction-in-tryfinally)
8. [W-8 FIX: normalizeAgentName() Maintenance Note](#w-8-fix-normalizeagentname-maintenance-note)
9. [Effort Summary](#effort-summary)
10. [Implementation Order](#implementation-order)

---

## W-1 FIX: PHASE_AGENT_MAP Unification

**Priority**: P0 (fix immediately)
**Effort**: 1-2 hours
**Type**: Bug fix
**Files to change**: 2
**Test requirements**: 1 new test

### Problem Statement

Three separate PHASE_AGENT_MAP instances exist:
- **Map 1**: `src/claude/hooks/lib/common.cjs` lines 2029-2049 (18 entries)
- **Map 2**: `src/claude/commands/isdlc.md` STEP 3d table lines 1158-1179 (20 entries)
- **Map 3**: `src/claude/commands/isdlc.md` STEP 3c-prime lines 1337-1352 (15 entries, DRIFTED)

Map 3 has 10 wrong agent names, 2 wrong phase keys, and 7 missing entries. The `active_agent` top-level field is written with incorrect values.

### Fix Design

#### Change 1: Replace Map 3 in isdlc.md

**File**: `src/claude/commands/isdlc.md`
**Lines**: 1335-1352

Replace the entire PHASE_AGENT_MAP block:

```
CURRENT (lines 1335-1352):
--------------------------
**PHASE_AGENT_MAP** (for STEP 3c-prime `active_agent` resolution):
```
01-requirements -> requirements-analyst
02-tracing -> trace-analyst
02-impact-analysis -> impact-analyst
03-architecture -> solution-architect
04-design -> software-designer
05-test-strategy -> test-design-engineer
06-implementation -> software-developer
07-testing -> quality-assurance-engineer
08-code-review -> code-reviewer
09-security -> security-engineer
10-local-testing -> quality-assurance-engineer
16-quality-loop -> quality-assurance-engineer
11-deployment -> release-engineer
12-test-deploy -> release-engineer
13-production -> release-engineer
```

REPLACEMENT:
-----------
**PHASE_AGENT_MAP** (for STEP 3c-prime `active_agent` resolution):

Resolve `active_agent` by looking up the current `phase_key` in the PHASE-AGENT table in STEP 3d above. Use the `subagent_type` column value as the `active_agent`. If the phase key is not found in the STEP 3d table (should not happen), use `"unknown-agent"` and log a warning to stderr.
```

This eliminates the duplicate map entirely, making STEP 3d the single source of truth for agent name resolution in isdlc.md.

#### Change 2: Add `00-quick-scan` to common.cjs PHASE_AGENT_MAP

**File**: `src/claude/hooks/lib/common.cjs`
**Line**: 2029

Add the missing entry:

```javascript
// CURRENT (line 2029):
const PHASE_AGENT_MAP = {
    '01-requirements': 'requirements-analyst',
    // ...

// REPLACEMENT:
const PHASE_AGENT_MAP = {
    '00-quick-scan': 'quick-scan-agent',
    '01-requirements': 'requirements-analyst',
    // ... (rest unchanged)
```

This makes Map 1 (common.cjs) and Map 2 (STEP 3d) equivalent -- 20 entries each, identical content.

#### Change 3: Add PHASE_AGENT_MAP Consistency Test

**File**: `src/claude/hooks/tests/test-common.test.cjs`

Add a new test that:
1. Imports `PHASE_AGENT_MAP` from common.cjs
2. Reads `src/claude/commands/isdlc.md`
3. Parses the STEP 3d table using regex: `/^\| `([^`]+)` \| `([^`]+)` \|$/gm`
4. Asserts that every entry in the STEP 3d table exists in `PHASE_AGENT_MAP` with the same value
5. Asserts that every entry in `PHASE_AGENT_MAP` exists in the STEP 3d table

```javascript
test('PHASE_AGENT_MAP matches isdlc.md STEP 3d table', () => {
    const { PHASE_AGENT_MAP } = require('../lib/common.cjs');
    const isdlcMd = fs.readFileSync(
        path.join(__dirname, '../../commands/isdlc.md'), 'utf8'
    );

    // Parse STEP 3d table
    const tableRegex = /^\| `([^`]+)` \| `([^`]+)` \|$/gm;
    const step3dMap = {};
    let match;
    while ((match = tableRegex.exec(isdlcMd)) !== null) {
        if (match[1] !== 'Phase Key') { // skip header
            step3dMap[match[1]] = match[2];
        }
    }

    // Every STEP 3d entry must be in PHASE_AGENT_MAP
    for (const [phase, agent] of Object.entries(step3dMap)) {
        assert.strictEqual(
            PHASE_AGENT_MAP[phase], agent,
            `STEP 3d has ${phase} -> ${agent}, but PHASE_AGENT_MAP has ${PHASE_AGENT_MAP[phase]}`
        );
    }

    // Every PHASE_AGENT_MAP entry must be in STEP 3d
    for (const [phase, agent] of Object.entries(PHASE_AGENT_MAP)) {
        assert.strictEqual(
            step3dMap[phase], agent,
            `PHASE_AGENT_MAP has ${phase} -> ${agent}, but STEP 3d has ${step3dMap[phase]}`
        );
    }
});
```

### Backward Compatibility

- **active_agent field**: Will now contain correct agent names. Any code reading `active_agent` will get the right value.
- **No behavioral change**: No hook reads `active_agent` for enforcement. The fix only corrects metadata.
- **STEP 3c-prime behavior**: Unchanged -- it still resolves `active_agent` from a map, but now references the STEP 3d table instead of a separate drifted map.

### Verification

After applying the fix:
1. Run the new consistency test -- it must pass
2. Start a feature workflow -- verify `active_agent` in state.json matches the agent that actually executes
3. Verify STEP 3d table has 20 entries matching common.cjs PHASE_AGENT_MAP

---

## W-2 FIX: Extract activatePhase() and completePhase() Helpers

**Priority**: P1 (refactoring workflow)
**Effort**: 2-3 hours
**Type**: Refactoring for testability
**Files to change**: 2
**Test requirements**: 2 new test suites

### Problem Statement

STEP 3c-prime writes 7 fields and STEP 3e writes 5 fields as prose instructions. These write sequences cannot be unit-tested because they are not executable code.

### Fix Design

#### Change 1: Add activatePhase() to common.cjs

**File**: `src/claude/hooks/lib/common.cjs`
**Location**: After the PHASE_AGENT_MAP definition (line 2049)

```javascript
/**
 * Activate a phase: write all required state fields for STEP 3c-prime.
 * This function centralizes the 7-field write sequence so it can be
 * unit-tested independently of the prose-based Phase-Loop Controller.
 *
 * Fields written:
 *   1. phases[phaseKey].status = "in_progress"
 *   2. phases[phaseKey].started = ISO-8601 (if not already set)
 *   3. active_workflow.current_phase = phaseKey
 *   4. active_workflow.phase_status[phaseKey] = "in_progress"
 *   5. current_phase (top-level) = phaseKey
 *   6. active_agent (top-level) = agentName
 *   7. phases[phaseKey].timing initialization or retry increment
 *
 * @param {object} state - State object to mutate
 * @param {string} phaseKey - Phase key to activate (e.g., "06-implementation")
 * @param {string} agentName - Agent name from PHASE_AGENT_MAP
 * @returns {object} The mutated state object
 */
function activatePhase(state, phaseKey, agentName) {
    // Ensure phases object exists
    if (!state.phases) state.phases = {};
    if (!state.phases[phaseKey]) {
        state.phases[phaseKey] = {
            status: 'pending',
            started: null,
            completed: null,
            gate_passed: null,
            artifacts: []
        };
    }

    // 1. Detailed phases object: status
    state.phases[phaseKey].status = 'in_progress';

    // 2. Detailed phases object: started timestamp (preserve on retries)
    if (!state.phases[phaseKey].started) {
        state.phases[phaseKey].started = new Date().toISOString();
    }

    // 3. active_workflow.current_phase
    if (state.active_workflow) {
        state.active_workflow.current_phase = phaseKey;

        // 4. active_workflow.phase_status
        if (!state.active_workflow.phase_status) {
            state.active_workflow.phase_status = {};
        }
        state.active_workflow.phase_status[phaseKey] = 'in_progress';
    }

    // 5. Top-level current_phase (backward compat)
    state.current_phase = phaseKey;

    // 6. Top-level active_agent (backward compat)
    state.active_agent = agentName;

    // 7. Timing initialization or retry increment
    if (!state.phases[phaseKey].timing) {
        state.phases[phaseKey].timing = {
            started_at: new Date().toISOString(),
            retries: 0
        };
    } else if (state.phases[phaseKey].timing.started_at) {
        // Retry case: increment retries, preserve started_at
        state.phases[phaseKey].timing.retries =
            (state.phases[phaseKey].timing.retries || 0) + 1;
    }

    return state;
}

/**
 * Complete a phase: write all required state fields for STEP 3e.
 * This function centralizes the 5-field write sequence so it can be
 * unit-tested independently of the prose-based Phase-Loop Controller.
 *
 * Fields written:
 *   1. phases[phaseKey].status = "completed"
 *   2. phases[phaseKey].summary = summary (max 150 chars)
 *   3. active_workflow.current_phase_index += 1
 *   4. active_workflow.phase_status[phaseKey] = "completed"
 *   5. phases[phaseKey].timing.completed_at and wall_clock_minutes
 *
 * Fields NOT written (BUG-0006 constraint):
 *   - active_workflow.current_phase (NOT changed to next phase)
 *   - active_workflow.phase_status[nextPhase] (NOT set to "in_progress")
 *   - phases[nextPhase].status (NOT set to "in_progress")
 *   - current_phase (top-level, NOT changed)
 *   - active_agent (top-level, NOT changed)
 *
 * @param {object} state - State object to mutate
 * @param {string} phaseKey - Phase key to complete (e.g., "06-implementation")
 * @param {string} summary - Phase summary (will be truncated to 150 chars)
 * @returns {object} The mutated state object
 */
function completePhase(state, phaseKey, summary) {
    // Ensure phases object exists
    if (!state.phases) state.phases = {};
    if (!state.phases[phaseKey]) {
        state.phases[phaseKey] = {};
    }

    // 1. Detailed phases object: status
    state.phases[phaseKey].status = 'completed';

    // 2. Detailed phases object: summary
    state.phases[phaseKey].summary = (summary || '').substring(0, 150);

    // 3. active_workflow.current_phase_index
    if (state.active_workflow) {
        state.active_workflow.current_phase_index =
            (state.active_workflow.current_phase_index || 0) + 1;

        // 4. active_workflow.phase_status
        if (!state.active_workflow.phase_status) {
            state.active_workflow.phase_status = {};
        }
        state.active_workflow.phase_status[phaseKey] = 'completed';
    }

    // 5. Timing: completed_at and wall_clock_minutes
    if (state.phases[phaseKey].timing) {
        state.phases[phaseKey].timing.completed_at = new Date().toISOString();
        if (state.phases[phaseKey].timing.started_at) {
            const start = new Date(state.phases[phaseKey].timing.started_at).getTime();
            const end = new Date(state.phases[phaseKey].timing.completed_at).getTime();
            state.phases[phaseKey].timing.wall_clock_minutes =
                Math.round((end - start) / 60000);
        } else {
            state.phases[phaseKey].timing.wall_clock_minutes = 0;
        }
    }

    return state;
}
```

Export both functions:
```javascript
module.exports = {
    // ... existing exports ...
    activatePhase,
    completePhase,
    PHASE_AGENT_MAP  // also export PHASE_AGENT_MAP if not already exported
};
```

#### Change 2: Update STEP 3c-prime and STEP 3e Prose

**File**: `src/claude/commands/isdlc.md`

**STEP 3c-prime** (lines 1128-1138): Replace the 7 individual field write instructions with:

```
**3c-prime.** PRE-DELEGATION STATE UPDATE -- Write phase activation to `state.json`
BEFORE delegating to the phase agent.

Using the `state.json` already read in step 3b, apply the `activatePhase()` function
from common.cjs:

1. Resolve `agentName` by looking up `phase_key` in the PHASE-AGENT table in STEP 3d
2. Call `activatePhase(state, phase_key, agentName)` -- this writes all 7 required
   fields (phases[key].status, phases[key].started, active_workflow.current_phase,
   active_workflow.phase_status[key], current_phase, active_agent, timing init/retry)
3. Write `.isdlc/state.json`

**IMPORTANT**: The activatePhase() function handles the distinction between
`phases[phase_key]` (detailed phases object) and `active_workflow.phase_status[phase_key]`
(summary map). Both are updated.
```

**STEP 3e** (lines 1271-1286): Replace the 5 individual field write instructions with:

```
**3e.** POST-PHASE STATE UPDATE -- After the phase agent returns successfully:
1. Read `.isdlc/state.json`
2. Extract summary from agent result (max 150 chars)
3. Call `completePhase(state, phase_key, summary)` -- this writes all 5 required
   fields (phases[key].status = "completed", phases[key].summary, current_phase_index += 1,
   active_workflow.phase_status[key] = "completed", timing completion)
4. BUG-0006: completePhase() does NOT activate the next phase. The next iteration's
   STEP 3c-prime handles phase activation.
5. Write `.isdlc/state.json`
6. Update `docs/isdlc/tasks.md` (if it exists):
   ... (existing tasks.md update logic unchanged)
```

#### Change 3: Unit Tests for activatePhase() and completePhase()

**File**: `src/claude/hooks/tests/test-common.test.cjs`

```javascript
describe('activatePhase()', () => {
    test('writes all 7 required fields', () => {
        const state = {
            active_workflow: {
                current_phase: '01-requirements',
                current_phase_index: 0,
                phase_status: { '01-requirements': 'completed' }
            },
            phases: {},
            current_phase: '01-requirements',
            active_agent: 'requirements-analyst'
        };

        activatePhase(state, '02-impact-analysis', 'impact-analysis-orchestrator');

        // Field 1: phases[key].status
        assert.strictEqual(state.phases['02-impact-analysis'].status, 'in_progress');
        // Field 2: phases[key].started (non-null ISO-8601)
        assert.ok(state.phases['02-impact-analysis'].started);
        assert.ok(state.phases['02-impact-analysis'].started.includes('T'));
        // Field 3: active_workflow.current_phase
        assert.strictEqual(state.active_workflow.current_phase, '02-impact-analysis');
        // Field 4: active_workflow.phase_status[key]
        assert.strictEqual(state.active_workflow.phase_status['02-impact-analysis'], 'in_progress');
        // Field 5: top-level current_phase
        assert.strictEqual(state.current_phase, '02-impact-analysis');
        // Field 6: top-level active_agent
        assert.strictEqual(state.active_agent, 'impact-analysis-orchestrator');
        // Field 7: timing initialization
        assert.ok(state.phases['02-impact-analysis'].timing);
        assert.strictEqual(state.phases['02-impact-analysis'].timing.retries, 0);
    });

    test('preserves started timestamp on retries', () => {
        const originalStarted = '2026-01-01T00:00:00.000Z';
        const state = {
            active_workflow: { phase_status: {} },
            phases: {
                '06-implementation': {
                    status: 'pending',
                    started: originalStarted,
                    timing: { started_at: originalStarted, retries: 0 }
                }
            }
        };

        activatePhase(state, '06-implementation', 'software-developer');

        assert.strictEqual(state.phases['06-implementation'].started, originalStarted);
        assert.strictEqual(state.phases['06-implementation'].timing.retries, 1);
    });

    test('creates phases entry if missing', () => {
        const state = {
            active_workflow: { phase_status: {} },
            phases: {}
        };

        activatePhase(state, '03-architecture', 'solution-architect');

        assert.ok(state.phases['03-architecture']);
        assert.strictEqual(state.phases['03-architecture'].status, 'in_progress');
    });
});

describe('completePhase()', () => {
    test('writes all 5 required fields', () => {
        const state = {
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: { '06-implementation': 'in_progress' }
            },
            phases: {
                '06-implementation': {
                    status: 'in_progress',
                    timing: { started_at: new Date(Date.now() - 60000).toISOString(), retries: 0 }
                }
            },
            current_phase: '06-implementation',
            active_agent: 'software-developer'
        };

        completePhase(state, '06-implementation', 'Implementation completed successfully');

        // Field 1: phases[key].status
        assert.strictEqual(state.phases['06-implementation'].status, 'completed');
        // Field 2: phases[key].summary
        assert.strictEqual(state.phases['06-implementation'].summary, 'Implementation completed successfully');
        // Field 3: current_phase_index incremented
        assert.strictEqual(state.active_workflow.current_phase_index, 6);
        // Field 4: active_workflow.phase_status[key]
        assert.strictEqual(state.active_workflow.phase_status['06-implementation'], 'completed');
        // Field 5: timing completion
        assert.ok(state.phases['06-implementation'].timing.completed_at);
        assert.ok(state.phases['06-implementation'].timing.wall_clock_minutes >= 0);
    });

    test('BUG-0006: does NOT modify next-phase fields', () => {
        const state = {
            active_workflow: {
                current_phase: '05-test-strategy',
                current_phase_index: 4,
                phase_status: {
                    '05-test-strategy': 'in_progress',
                    '06-implementation': 'pending'
                },
                phases: ['05-test-strategy', '06-implementation']
            },
            phases: {
                '05-test-strategy': {
                    status: 'in_progress',
                    timing: { started_at: new Date().toISOString(), retries: 0 }
                },
                '06-implementation': { status: 'pending' }
            },
            current_phase: '05-test-strategy',
            active_agent: 'test-design-engineer'
        };

        completePhase(state, '05-test-strategy', 'Test strategy complete');

        // These fields must NOT be changed (BUG-0006 constraint)
        assert.strictEqual(state.active_workflow.current_phase, '05-test-strategy');
        assert.strictEqual(state.active_workflow.phase_status['06-implementation'], 'pending');
        assert.strictEqual(state.phases['06-implementation'].status, 'pending');
        assert.strictEqual(state.current_phase, '05-test-strategy');
        assert.strictEqual(state.active_agent, 'test-design-engineer');
    });

    test('truncates summary to 150 characters', () => {
        const state = {
            active_workflow: { current_phase_index: 0, phase_status: {} },
            phases: { '01-requirements': { status: 'in_progress' } }
        };
        const longSummary = 'A'.repeat(200);

        completePhase(state, '01-requirements', longSummary);

        assert.strictEqual(state.phases['01-requirements'].summary.length, 150);
    });
});
```

### Backward Compatibility

- **No behavioral change**: The helpers produce the exact same state mutations as the current prose instructions.
- **Prose still exists**: Claude still reads isdlc.md and executes the phase loop. The helpers are referenced in prose, providing Claude a precise function to call.
- **Existing tests unaffected**: The helpers do not change any hook behavior.

---

## W-3 FIX: Eliminate phase_status Redundancy

**Priority**: P1 (bundle with W-2)
**Effort**: 1-2 hours (incremental on top of W-2)
**Type**: Refactoring
**Files to change**: 2-3
**Test requirements**: 1 new validation rule test

### Problem Statement

`active_workflow.phase_status[key]` is a redundant copy of `phases[key].status`. Both must be synchronized on every transition. Failure to synchronize causes BUG-0005-class defects.

### Fix Design

This fix has two parts: a V9 validation rule (immediate safety net) and a deprecation path (future simplification).

#### Part A: Add V9 Cross-Location Consistency Validation

**File**: `src/claude/hooks/state-write-validator.cjs`

Add a new V9 rule that, after any state write, checks that `active_workflow.phase_status[key]` and `phases[key].status` agree for all keys:

```javascript
// V9: Cross-location phase status consistency
// Warn (not block) if active_workflow.phase_status[key] disagrees with phases[key].status
function checkV9CrossLocationConsistency(incoming) {
    const warnings = [];
    const phaseStatus = incoming?.active_workflow?.phase_status;
    const phases = incoming?.phases;

    if (!phaseStatus || !phases) return warnings;

    for (const [key, status] of Object.entries(phaseStatus)) {
        const detailedStatus = phases[key]?.status;
        if (detailedStatus && detailedStatus !== status) {
            warnings.push(
                `V9: phase_status["${key}"] = "${status}" disagrees with ` +
                `phases["${key}"].status = "${detailedStatus}"`
            );
        }
    }

    return warnings;
}
```

V9 emits warnings (logged to hook-activity.log) rather than blocking, because:
1. The divergence may be transient (mid-write state during a multi-field update)
2. Blocking on divergence would be overly aggressive
3. The observational approach detects the problem without introducing new failure modes

#### Part B: Deprecation Path (Future)

The `active_workflow.phase_status` map can be deprecated in a future version:

1. **Phase 1 (this fix)**: Add V9 observational check. Keep writing to both locations.
2. **Phase 2 (future)**: Add a helper function `getPhaseStatus(state, phaseKey)` that reads from `phases[key].status` only. Migrate all readers to use this helper.
3. **Phase 3 (future)**: Stop writing to `active_workflow.phase_status`. Keep reading it as a fallback for backward compatibility with older state files.
4. **Phase 4 (future)**: Remove `active_workflow.phase_status` from the schema entirely.

This design does NOT implement phases 2-4. It only implements Phase 1 (V9 rule) as the immediate safety net.

### Backward Compatibility

- **V9 is observational**: It warns but does not block. No existing behavior changes.
- **active_workflow.phase_status continues to be written**: The activatePhase() and completePhase() helpers write to both locations, maintaining full backward compatibility.

---

## W-4 FIX: writeState() JSDoc Correction

**Priority**: P3
**Effort**: 5 minutes
**Type**: Documentation fix
**Files to change**: 1
**Test requirements**: None

### Fix Design

**File**: `src/claude/hooks/lib/common.cjs`
**Location**: JSDoc above `writeState()` function

Replace the misleading claim with accurate documentation:

```javascript
/**
 * Write state to disk.
 *
 * Creates a shallow copy to set state_version without mutating the caller's
 * top-level state_version field. However, nested objects (phases, active_workflow,
 * active_workflow.phase_status) are shared references and WILL reflect any
 * mutations made to the caller's object before the write.
 *
 * The shallow copy is intentional: only state_version needs protection from
 * leaking back to the caller. All other mutations have already been applied
 * to the state object before writeState() is called.
 *
 * @param {object} state - State object. Top-level state_version will not be mutated.
 * @returns {void}
 */
```

### Backward Compatibility

No code change -- documentation only.

---

## W-5 FIX: Remove Duplicate loadIterationRequirements()

**Priority**: P2
**Effort**: 30 minutes
**Type**: Dead code removal
**Files to change**: 4
**Test requirements**: Run existing tests to verify no regression

### Fix Design

Remove the local `loadIterationRequirements()` function from these files:

1. **`src/claude/hooks/gate-blocker.cjs`** (line ~35)
2. **`src/claude/hooks/iteration-corridor.cjs`** (line ~83)
3. **`src/claude/hooks/test-watcher.cjs`** (line ~253)
4. **`src/claude/hooks/constitution-validator.cjs`** (line ~49)

In each file, the triple-fallback chain:
```javascript
const requirements = ctx.requirements
    || loadIterationRequirementsFromCommon()
    || loadIterationRequirements();  // local copy -- dead code under dispatcher
```

Should be simplified to:
```javascript
const requirements = ctx.requirements || loadIterationRequirementsFromCommon();
```

### Verification

After removing the local functions:
1. Run `npm run test:hooks` -- all existing tests must pass
2. Verify that the dispatcher always populates `ctx.requirements` (check `pre-task-dispatcher.cjs`)
3. The `loadIterationRequirementsFromCommon()` import from common.cjs remains as the fallback for standalone hook execution (e.g., during testing)

### Backward Compatibility

- **No behavioral change**: Under the dispatcher (production path), `ctx.requirements` is always populated. The local fallback never executes.
- **Test compatibility**: Tests that invoke hooks directly (without a dispatcher) will use `loadIterationRequirementsFromCommon()` from common.cjs, which is functionally identical to the removed local versions.

---

## W-6 FIX: Consolidate STATE_JSON_PATTERN

**Priority**: P2
**Effort**: 15 minutes
**Type**: Dead code removal
**Files to change**: 2
**Test requirements**: Run existing tests to verify no regression

### Fix Design

**File 1**: `src/claude/hooks/state-write-validator.cjs` (line ~29)

Replace local definition:
```javascript
// CURRENT:
const STATE_JSON_PATTERN = /\.isdlc[/\\](?:projects[/\\][^/\\]+[/\\])?state\.json$/;

// REPLACEMENT:
const { STATE_JSON_PATTERN } = require('./lib/common.cjs');
```

**File 2**: `src/claude/hooks/workflow-completion-enforcer.cjs` (line ~45)

Replace local definition:
```javascript
// CURRENT:
const STATE_JSON_PATTERN = /\.isdlc[/\\](?:projects[/\\][^/\\]+[/\\])?state\.json$/;

// REPLACEMENT:
const { STATE_JSON_PATTERN } = require('./lib/common.cjs');
```

### Verification

Verify `STATE_JSON_PATTERN` is exported from common.cjs. If not currently exported, add it to the `module.exports` block.

### Backward Compatibility

No behavioral change -- same regex, different import source.

---

## W-7 FIX: Wrap Reconstruction in try/finally

**Priority**: P3
**Effort**: 15 minutes
**Type**: Defensive coding
**Files to change**: 1
**Test requirements**: 1 new test case

### Fix Design

**File**: `src/claude/hooks/workflow-completion-enforcer.cjs`
**Location**: Lines ~154-159 (reconstruction pattern)

Wrap the temporary `active_workflow` assignment in try/finally:

```javascript
// CURRENT:
state.active_workflow = {
    phases: phasesArray,
    started_at: lastEntry.started_at || null,
    completed_at: lastEntry.completed_at || lastEntry.cancelled_at || null,
    sizing: sizingRecord
};
const { phase_snapshots, metrics } = collectPhaseSnapshots(state);
state.active_workflow = null;

// REPLACEMENT:
let phase_snapshots, metrics;
try {
    state.active_workflow = {
        phases: phasesArray,
        started_at: lastEntry.started_at || null,
        completed_at: lastEntry.completed_at || lastEntry.cancelled_at || null,
        sizing: sizingRecord
    };
    const result = collectPhaseSnapshots(state);
    phase_snapshots = result.phase_snapshots;
    metrics = result.metrics;
} finally {
    state.active_workflow = null;
}
```

### Backward Compatibility

No behavioral change under normal conditions. The try/finally only adds protection against exceptions in `collectPhaseSnapshots()`.

---

## W-8 FIX: normalizeAgentName() Maintenance Note

**Priority**: P3 (documentation only)
**Effort**: 10 minutes
**Type**: Documentation
**Files to change**: 1
**Test requirements**: None

### Fix Design

**File**: `src/claude/hooks/lib/common.cjs`
**Location**: JSDoc above `normalizeAgentName()` function

Add a maintenance note:

```javascript
/**
 * Normalize agent name variations to canonical names.
 *
 * MAINTENANCE NOTE: This function contains hardcoded mappings for all known
 * agent name variations. When adding a new agent:
 * 1. Add the canonical name to PHASE_AGENT_MAP
 * 2. Add any name variations to normalizeAgentName()
 * 3. Add the agent to skills-manifest.json ownership section
 * 4. Add the agent to isdlc.md STEP 3d table
 * 5. Verify the PHASE_AGENT_MAP consistency test passes
 *
 * The normalizeAgentName() mappings and the skills-manifest ownership section
 * serve complementary purposes: normalizeAgentName() handles runtime variations
 * in how agent names appear in Task prompts; the manifest ownership section
 * provides authoritative agent-to-phase mappings for detectPhaseDelegation().
 */
```

### Backward Compatibility

No code change -- documentation only.

---

## Effort Summary

| Fix | Priority | Effort | Type | Risk |
|-----|----------|--------|------|------|
| W-1: PHASE_AGENT_MAP unification | P0 | 1-2 hours | Bug fix | LOW (metadata correction only) |
| W-2: activatePhase/completePhase | P1 | 2-3 hours | Refactoring | LOW (same mutations, now testable) |
| W-3: V9 consistency rule | P1 | 1-2 hours | New validation | LOW (observational, non-blocking) |
| W-4: writeState JSDoc | P3 | 5 minutes | Documentation | NONE |
| W-5: Remove duplicate loaders | P2 | 30 minutes | Dead code removal | LOW (fallback for unused path) |
| W-6: Consolidate regex | P2 | 15 minutes | Import change | NONE |
| W-7: try/finally wrapper | P3 | 15 minutes | Defensive coding | NONE |
| W-8: Maintenance note | P3 | 10 minutes | Documentation | NONE |
| **Total** | | **5.5-8.5 hours** | | |

---

## Implementation Order

### Batch 1: P0 Critical Fix (1-2 hours)

1. Replace Map 3 in isdlc.md STEP 3c-prime with reference to STEP 3d
2. Add `00-quick-scan` to common.cjs PHASE_AGENT_MAP
3. Write PHASE_AGENT_MAP consistency test
4. Run tests, verify `active_agent` is correct

### Batch 2: P1 Refactoring (3-5 hours)

5. Add activatePhase() and completePhase() to common.cjs
6. Write unit tests for both helpers
7. Update STEP 3c-prime and STEP 3e prose to reference helpers
8. Add V9 cross-location consistency rule to state-write-validator.cjs
9. Run full test suite

### Batch 3: P2 Cleanup (45 minutes)

10. Remove duplicate loadIterationRequirements() from 4 hooks
11. Import STATE_JSON_PATTERN from common.cjs in 2 files
12. Run test suite

### Batch 4: P3 Minor (30 minutes)

13. Fix writeState() JSDoc
14. Add try/finally to workflow-completion-enforcer
15. Add normalizeAgentName() maintenance note

---

## Appendix: Exact PHASE_AGENT_MAP Canonical Values

For reference, the canonical PHASE_AGENT_MAP (after W-1 fix) should contain these 20 entries, matching both common.cjs and isdlc.md STEP 3d:

| Phase Key | Agent Name | Agent File |
|-----------|-----------|------------|
| `00-quick-scan` | `quick-scan-agent` | `quick-scan/quick-scan-agent.md` |
| `01-requirements` | `requirements-analyst` | `01-requirements-analyst.md` |
| `02-impact-analysis` | `impact-analysis-orchestrator` | `impact-analysis/impact-analysis-orchestrator.md` |
| `02-tracing` | `tracing-orchestrator` | `tracing/tracing-orchestrator.md` |
| `03-architecture` | `solution-architect` | `02-solution-architect.md` |
| `04-design` | `system-designer` | `03-system-designer.md` |
| `05-test-strategy` | `test-design-engineer` | `04-test-design-engineer.md` |
| `06-implementation` | `software-developer` | `05-software-developer.md` |
| `07-testing` | `integration-tester` | `06-integration-tester.md` |
| `08-code-review` | `qa-engineer` | `07-qa-engineer.md` |
| `09-validation` | `security-compliance-auditor` | `08-security-compliance-auditor.md` |
| `10-cicd` | `cicd-engineer` | `09-cicd-engineer.md` |
| `11-local-testing` | `environment-builder` | `10-dev-environment-engineer.md` (name: environment-builder) |
| `12-remote-build` | `environment-builder` | `10-dev-environment-engineer.md` (name: environment-builder) |
| `12-test-deploy` | `deployment-engineer-staging` | `11-deployment-engineer-staging.md` |
| `13-production` | `release-manager` | `12-release-manager.md` |
| `14-operations` | `site-reliability-engineer` | `13-site-reliability-engineer.md` |
| `15-upgrade-plan` | `upgrade-engineer` | `14-upgrade-engineer.md` |
| `15-upgrade-execute` | `upgrade-engineer` | `14-upgrade-engineer.md` |
| `16-quality-loop` | `quality-loop-engineer` | `16-quality-loop-engineer.md` |

Note: Agent file numbers (01-, 02-, etc.) do not match phase key numbers (01-, 02-, etc.) because the file numbering reflects the agent's position in the original agent roster, not the phase key. This is intentional and documented.
