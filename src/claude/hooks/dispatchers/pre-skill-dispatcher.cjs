#!/usr/bin/env node
'use strict';
/**
 * iSDLC Pre-Skill Dispatcher - PreToolUse[Skill] Hook
 * =====================================================
 * Consolidates 3 PreToolUse[Skill] hooks into 1 process for performance.
 * REQ-0010 Tier 1: Hook Dispatcher Consolidation
 *
 * Execution order (preserves current enforcement priority):
 *   1. iteration-corridor                - corridor enforcement (same function, Skill matcher)
 *   2. gate-blocker                      - gate requirements (same function, Skill matcher)
 *   3. constitutional-iteration-validator - verifies constitutional validation was performed
 *
 * Short-circuits on first { decision: 'block' }.
 * Writes state once after all hooks or after the blocking hook.
 *
 * Version: 1.0.0
 */

const {
    readStdin,
    readState,
    writeState,
    loadManifest,
    loadIterationRequirements,
    loadWorkflowDefinitions,
    outputBlockResponse,
    debugLog
} = require('../lib/common.cjs');

// Import hook check functions
const { check: iterationCorridorCheck } = require('../iteration-corridor.cjs');
const { check: gateBlockerCheck } = require('../gate-blocker.cjs');
const { check: constitutionalIterationValidatorCheck } = require('../constitutional-iteration-validator.cjs');

/**
 * Hook execution order.
 * @type {Array<{ name: string, check: function }>}
 */
const HOOKS = [
    { name: 'iteration-corridor',                check: iterationCorridorCheck },
    { name: 'gate-blocker',                      check: gateBlockerCheck },
    { name: 'constitutional-iteration-validator', check: constitutionalIterationValidatorCheck }
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

        // 3. Early exit if no active workflow
        // All 3 hooks in this dispatcher require an active workflow context.
        if (!state || !state.active_workflow) {
            process.exit(0);
        }

        // 4. Load configs once
        const manifest = loadManifest();
        const requirements = loadIterationRequirements();
        const workflows = loadWorkflowDefinitions();

        // 5. Build ctx
        const ctx = { input, state, manifest, requirements, workflows };

        // 6. Call hooks in order, short-circuit on first block
        let stateModified = false;
        const allStderr = [];

        for (const hook of HOOKS) {
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
                debugLog(`pre-skill-dispatcher: ${hook.name} threw:`, e.message);
                // Fail-open: continue to next hook
            }
        }

        // 7. Write state once if modified
        if (stateModified && state) {
            writeState(state);
        }

        // Output accumulated stderr
        if (allStderr.length > 0) {
            console.error(allStderr.join('\n'));
        }

        process.exit(0);
    } catch (e) {
        debugLog('pre-skill-dispatcher error:', e.message);
        process.exit(0);
    }
}

main();
