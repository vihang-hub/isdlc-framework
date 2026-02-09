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
 * Traces to: FR-05, AC-05, AC-05a, AC-05b, AC-05c, AC-05d, AC-05e
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
