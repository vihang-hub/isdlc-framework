#!/usr/bin/env node
/**
 * iSDLC Gate Blocker - PreToolUse Hook
 * =====================================
 * Blocks gate advancement unless all iteration requirements are met.
 * Delegated to gate-logic.cjs for cross-platform compatibility.
 */

const { check } = require('./lib/gate-logic.cjs');
const {
    readStdin,
    readState,
    writeState: writeStateFn,
    loadManifest,
    loadIterationRequirements,
    loadWorkflowDefinitions,
    outputBlockResponse
} = require('./lib/common.cjs');

if (require.main === module) {
    (async () => {
        try {
            const inputStr = await readStdin();
            if (!inputStr || !inputStr.trim()) process.exit(0);

            let input;
            try { input = JSON.parse(inputStr); } catch (e) { process.exit(0); }

            const state = readState();
            const manifest = loadManifest();
            const requirements = loadIterationRequirements();
            const workflows = loadWorkflowDefinitions();

            const ctx = { input, state, manifest, requirements, workflows };
            const result = check(ctx);

            if (result.stderr) console.error(result.stderr);
            if (result.stdout) console.log(result.stdout);

            if (result.decision === 'block' && result.stopReason) {
                outputBlockResponse(result.stopReason);
            }

            if (result.stateModified && state) {
                writeStateFn(state);
            }
            process.exit(0);
        } catch (e) {
            process.exit(0);
        }
    })();
}
