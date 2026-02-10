#!/usr/bin/env node
'use strict';
/**
 * iSDLC Post-Bash Dispatcher - PostToolUse[Bash] Hook
 * =====================================================
 * Consolidates 3 PostToolUse[Bash] hooks into 1 process for performance.
 * REQ-0010 Tier 1: Hook Dispatcher Consolidation
 *
 * All hooks run (no short-circuit -- PostToolUse is observational).
 *
 * Execution order:
 *   1. test-watcher                  - writes iteration state, may output stdout guidance
 *   2. review-reminder               - may output stdout warning (git commit only)
 *   3. atdd-completeness-validator   - stderr warnings (ATDD priority violations)
 *
 * Writes state once after all hooks.
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
    debugLog
} = require('../lib/common.cjs');

// Import hook check functions
const { check: testWatcherCheck } = require('../test-watcher.cjs');
const { check: reviewReminderCheck } = require('../review-reminder.cjs');
const { check: atddCompletenessValidatorCheck } = require('../atdd-completeness-validator.cjs');

/**
 * Hook execution order.
 * @type {Array<{ name: string, check: function }>}
 */
const HOOKS = [
    { name: 'test-watcher',                check: testWatcherCheck },
    { name: 'review-reminder',             check: reviewReminderCheck },
    { name: 'atdd-completeness-validator', check: atddCompletenessValidatorCheck }
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

        // 5. Call all hooks (no short-circuit -- PostToolUse is observational)
        let stateModified = false;
        const allStderr = [];
        const allStdout = [];

        for (const hook of HOOKS) {
            try {
                const result = hook.check(ctx);
                if (result.stateModified) stateModified = true;
                if (result.stderr) allStderr.push(result.stderr);
                if (result.stdout) allStdout.push(result.stdout);
            } catch (e) {
                debugLog(`post-bash-dispatcher: ${hook.name} threw:`, e.message);
                // Fail-open: continue to next hook
            }
        }

        // 6. Write state once if modified
        if (stateModified && state) {
            writeState(state);
        }

        // Output accumulated stderr/stdout
        if (allStderr.length > 0) {
            console.error(allStderr.join('\n'));
        }
        if (allStdout.length > 0) {
            console.log(allStdout.join('\n'));
        }

        process.exit(0);
    } catch (e) {
        debugLog('post-bash-dispatcher error:', e.message);
        process.exit(0);
    }
}

main();
