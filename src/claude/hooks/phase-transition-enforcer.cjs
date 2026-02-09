#!/usr/bin/env node
/**
 * iSDLC Phase Transition Enforcer - PostToolUse[Task] Hook
 * =========================================================
 * Detects "Would you like to proceed?" patterns in agent output
 * and warns that automatic transitions should be used instead.
 *
 * Performance budget: < 100ms
 * Fail-open: always (PostToolUse is observational only)
 *
 * Traces to: FR-01, AC-01a through AC-01h
 * Version: 1.0.0
 */

const {
    readStdin,
    readState,
    debugLog,
    logHookEvent
} = require('./lib/common.cjs');

/**
 * Permission-asking patterns that indicate an agent is not auto-advancing.
 * Case-insensitive matching.
 */
const PERMISSION_PATTERNS = [
    /would you like to proceed/i,
    /ready to advance/i,
    /should I continue/i,
    /shall we proceed/i,
    /do you want me to move forward/i,
    /want me to go ahead/i
];

/**
 * Check if text contains any permission-asking patterns.
 * @param {string} text - Text to scan
 * @returns {{ found: boolean, pattern: string }} Result
 */
function detectPermissionAsking(text) {
    if (!text || typeof text !== 'string') {
        return { found: false, pattern: '' };
    }
    for (const regex of PERMISSION_PATTERNS) {
        const match = text.match(regex);
        if (match) {
            return { found: true, pattern: match[0] };
        }
    }
    return { found: false, pattern: '' };
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

        // Extract task output/result text
        const output = (input.tool_result && input.tool_result.text) ||
                       (input.tool_result && typeof input.tool_result === 'string' ? input.tool_result : '') ||
                       '';

        if (!output || typeof output !== 'string') {
            process.exit(0);
        }

        // Check for permission-asking patterns
        const result = detectPermissionAsking(output);
        if (!result.found) {
            process.exit(0);
        }

        // Only warn if there is an active workflow
        const state = readState();
        if (!state || !state.active_workflow) {
            debugLog('Permission pattern found but no active workflow, skipping');
            process.exit(0);
        }

        const phase = (state.active_workflow && state.active_workflow.current_phase) || 'unknown';

        // Log and warn
        logHookEvent('phase-transition-enforcer', 'warn', {
            phase,
            reason: `Permission-asking pattern detected: '${result.pattern}'`
        });

        console.error(
            `TRANSITION WARNING: Agent asked for permission to proceed. ` +
            `Phase transitions should be automatic when gates pass. ` +
            `Pattern detected: '${result.pattern}'`
        );
        process.exit(0);

    } catch (error) {
        debugLog('Error in phase-transition-enforcer:', error.message);
        process.exit(0);
    }
}

main();
