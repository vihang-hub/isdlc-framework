#!/usr/bin/env node
'use strict';
/**
 * iSDLC Pre-Task Dispatcher - PreToolUse[Task] Hook
 * ===================================================
 * Consolidates 8 PreToolUse[Task] hooks into 1 process for performance.
 * REQ-0010 Tier 1: Hook Dispatcher Consolidation
 *
 * Execution order (preserves current enforcement priority):
 *   1. iteration-corridor    - corridor enforcement (test/constitutional)
 *   2. skill-validator       - observe only, never blocks
 *   3. phase-loop-controller - progress tracking (phase in_progress check)
 *   4. plan-surfacer         - task plan existence check
 *   5. phase-sequence-guard  - phase ordering enforcement
 *   6. gate-blocker          - gate requirements + self-healing
 *   7. constitution-validator - constitutional compliance check
 *   8. test-adequacy-blocker - test coverage sufficiency (upgrade phases)
 *
 * Short-circuits on first { decision: 'block' }.
 * Writes state once after all hooks or after the blocking hook.
 *
 * NOTE: No global early-exit-if-no-active-workflow guard because
 * skill-validator runs regardless. Hooks with shouldActivate guards are
 * skipped when their conditions aren't met (REQ-0010 T3-B).
 *
 * Version: 1.2.0
 */

const {
    readStdin,
    readState,
    writeState,
    loadManifest,
    loadIterationRequirements,
    loadWorkflowDefinitions,
    outputBlockResponse,
    debugLog,
    checkPhaseTimeout,
    logHookEvent
} = require('../lib/common.cjs');

// Import hook check functions
const { check: iterationCorridorCheck } = require('../iteration-corridor.cjs');
const { check: skillValidatorCheck } = require('../skill-validator.cjs');
const { check: phaseLoopControllerCheck } = require('../phase-loop-controller.cjs');
const { check: planSurfacerCheck } = require('../plan-surfacer.cjs');
const { check: phaseSequenceGuardCheck } = require('../phase-sequence-guard.cjs');
const { check: gateBlockerCheck } = require('../gate-blocker.cjs');
const { check: constitutionValidatorCheck } = require('../constitution-validator.cjs');
const { check: testAdequacyBlockerCheck } = require('../test-adequacy-blocker.cjs');

/** @param {object} ctx @returns {boolean} */
const hasActiveWorkflow = (ctx) => !!ctx.state?.active_workflow;

/**
 * Hook execution order with optional activation guards.
 * If shouldActivate is defined and returns false, the hook is skipped.
 * @type {Array<{ name: string, check: function, shouldActivate?: function }>}
 */
const HOOKS = [
    { name: 'iteration-corridor',    check: iterationCorridorCheck,    shouldActivate: hasActiveWorkflow },
    { name: 'skill-validator',       check: skillValidatorCheck },
    { name: 'phase-loop-controller', check: phaseLoopControllerCheck, shouldActivate: hasActiveWorkflow },
    { name: 'plan-surfacer',         check: planSurfacerCheck,         shouldActivate: hasActiveWorkflow },
    { name: 'phase-sequence-guard',  check: phaseSequenceGuardCheck,  shouldActivate: hasActiveWorkflow },
    { name: 'gate-blocker',          check: gateBlockerCheck,          shouldActivate: hasActiveWorkflow },
    { name: 'constitution-validator', check: constitutionValidatorCheck, shouldActivate: hasActiveWorkflow },
    { name: 'test-adequacy-blocker', check: testAdequacyBlockerCheck, shouldActivate: (ctx) => {
        if (!ctx.state?.active_workflow) return false;
        const phase = ctx.state.active_workflow.current_phase || '';
        return phase.startsWith('15-upgrade');
    }}
];

async function main() {
    try {
        // 1. Read stdin once
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

        // 2. Read state once
        const state = readState();

        // 3. Load configs once
        const manifest = loadManifest();
        const requirements = loadIterationRequirements();
        const workflows = loadWorkflowDefinitions();

        // 4. Build ctx
        const ctx = { input, state, manifest, requirements, workflows };

        // 4b. Phase timeout advisory check (fail-open, non-blocking)
        if (state?.active_workflow && requirements) {
            try {
                const timeout = checkPhaseTimeout(state, requirements);
                if (timeout.exceeded) {
                    console.error(`TIMEOUT WARNING: Phase '${timeout.phase}' has been active for ${timeout.elapsed} minutes (limit: ${timeout.limit}). Consider escalating to human review.`);
                    logHookEvent('pre-task-dispatcher', 'timeout_warning', {
                        phase: timeout.phase,
                        reason: `Phase active for ${timeout.elapsed}min, limit ${timeout.limit}min`
                    });
                }
            } catch (e) {
                // Fail-open: timeout check errors should never block
                debugLog('pre-task-dispatcher: timeout check error:', e.message);
            }
        }

        // 5. Call hooks in order, short-circuit on first block
        let stateModified = false;
        const allStderr = [];

        for (const hook of HOOKS) {
            if (hook.shouldActivate && !hook.shouldActivate(ctx)) {
                continue; // skip inactive hook
            }
            try {
                const result = hook.check(ctx);
                if (result.stateModified) stateModified = true;
                if (result.stderr) allStderr.push(result.stderr);

                if (result.decision === 'block') {
                    // Write state before blocking
                    if (stateModified && state) {
                        writeState(state);
                    }
                    // Output accumulated stderr
                    if (allStderr.length > 0) {
                        console.error(allStderr.join('\n'));
                    }
                    // Output block response
                    outputBlockResponse(result.stopReason);
                    process.exit(0);
                }
            } catch (e) {
                debugLog(`pre-task-dispatcher: ${hook.name} threw:`, e.message);
                // Fail-open: continue to next hook
            }
        }

        // 6. Write state once if modified
        if (stateModified && state) {
            writeState(state);
        }

        // Output accumulated stderr
        if (allStderr.length > 0) {
            console.error(allStderr.join('\n'));
        }

        process.exit(0);
    } catch (e) {
        debugLog('pre-task-dispatcher error:', e.message);
        process.exit(0);
    }
}

main();
