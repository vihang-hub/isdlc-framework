#!/usr/bin/env node
/**
 * Antigravity - Isdlc State Validator Script
 * =========================================
 * Runs the state-write-validator check logic and outputs Antigravity-formatted JSON.
 */

const { check } = require('../../../hooks/lib/state-logic.cjs');
const {
    readState,
    loadManifest,
    loadIterationRequirements,
    loadWorkflowDefinitions,
    getProjectRoot
} = require('../../../hooks/lib/common.cjs');
const { formatResult } = require('../../../../antigravity/antigravity-bridge.cjs');
const path = require('path');

async function main() {
    try {
        const projectRoot = getProjectRoot();
        const statePath = path.join(projectRoot, '.isdlc', 'state.json');

        // Mock the "input" to simulate a state check
        const input = {
            tool_name: 'Edit', // Simulate a check after an edit
            tool_input: {
                file_path: statePath
            }
        };

        const state = readState();
        const manifest = loadManifest();
        const requirements = loadIterationRequirements();
        const workflows = loadWorkflowDefinitions();

        const ctx = { input, state, manifest, requirements, workflows };
        const result = check(ctx);

        if (result.decision === 'block') {
            console.log(JSON.stringify(formatResult(false, result.stopReason, { details: result })));
            process.exit(1);
        } else if (result.stderr) {
            console.log(JSON.stringify(formatResult(true, "State validation had warnings.", { warnings: result.stderr, details: result })));
            process.exit(0);
        } else {
            console.log(JSON.stringify(formatResult(true, "State validation PASSED", { details: result })));
            process.exit(0);
        }
    } catch (e) {
        console.log(JSON.stringify(formatResult(false, `Error running state validator: ${e.message}`)));
        process.exit(1);
    }
}

main();
