#!/usr/bin/env node
/**
 * iSDLC State Write Validator - PostToolUse[Write,Edit] Hook
 * ============================================================
 * Validates state.json writes for structural integrity.
 * Delegated to state-logic.cjs for cross-platform compatibility.
 */

const { check } = require('./lib/state-logic.cjs');
const {
    readStdin,
    readState,
    loadManifest,
    loadIterationRequirements,
    loadWorkflowDefinitions
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
                const { outputBlockResponse } = require('./lib/common.cjs');
                outputBlockResponse(result.stopReason);
            }
            process.exit(0);
        } catch (e) {
            process.exit(0);
        }
    })();
}
