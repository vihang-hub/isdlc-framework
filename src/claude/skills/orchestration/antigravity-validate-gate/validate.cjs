#!/usr/bin/env node
/**
 * Antigravity - Isdlc Gate Validator Script
 * =========================================
 * Runs the gate-blocker check logic and outputs Antigravity-formatted JSON.
 */

const { check } = require('../../../hooks/lib/gate-logic.cjs');
const {
    readState,
    loadManifest,
    loadIterationRequirements,
    loadWorkflowDefinitions,
    getProjectRoot
} = require('../../../hooks/lib/common.cjs');
const { formatResult } = require('../../../../antigravity/antigravity-bridge.cjs');

async function main() {
    try {
        const state = readState();
        const manifest = loadManifest();
        const requirements = loadIterationRequirements();
        const workflows = loadWorkflowDefinitions();

        // Check if there is an active workflow
        if (!state.active_workflow) {
            console.log(JSON.stringify(formatResult(true, "No active workflow to validate.")));
            process.exit(0);
        }

        // Mock the "input" for the validator
        const input = {
            tool_name: 'GateCheck',
            tool_input: {}
        };

        const ctx = { input, state, manifest, requirements, workflows };
        const result = check(ctx);

        if (result.decision === 'block') {
            console.log(JSON.stringify(formatResult(false, result.stopReason, { details: result })));
            process.exit(1);
        } else {
            console.log(JSON.stringify(formatResult(true, "Gate validation PASSED", { details: result })));
            process.exit(0);
        }
    } catch (e) {
        console.log(JSON.stringify(formatResult(false, `Error running gate validator: ${e.message}`)));
        process.exit(1);
    }
}

main();
