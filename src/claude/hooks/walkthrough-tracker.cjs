#!/usr/bin/env node
/**
 * iSDLC Walkthrough Tracker - PostToolUse[Task] Hook
 * ====================================================
 * Warns when a /discover workflow completes without the constitution
 * walkthrough being recorded as completed.
 *
 * OBSERVATIONAL ONLY: outputs warnings to stderr, never blocks.
 *
 * Performance budget: < 50ms
 * Fail-open: any error results in silent exit (exit 0, no output)
 *
 * Traces to: FR-06, AC-06, AC-06a, AC-06b, AC-06c
 * Version: 1.0.0
 */

const {
    readStdin,
    readState,
    debugLog,
    normalizeAgentName
} = require('./lib/common.cjs');

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

        if (input.tool_name !== 'Task') {
            process.exit(0);
        }

        // Check if this is a discover orchestrator task
        const toolInput = input.tool_input || {};
        const subagentType = toolInput.subagent_type || '';
        const normalized = normalizeAgentName(subagentType);

        if (normalized !== 'discover-orchestrator') {
            process.exit(0);
        }

        // Check if the task completed (has a result)
        const toolResult = input.tool_result;
        if (!toolResult) {
            debugLog('No tool_result, task may not be complete yet');
            process.exit(0);
        }

        debugLog('Discover orchestrator task completion detected');

        // Read state
        const state = readState();
        if (!state) {
            debugLog('No state.json, allowing (fail-open)');
            process.exit(0);
        }

        // Check discovery_context
        const discoveryContext = state.discovery_context;
        if (!discoveryContext) {
            debugLog('No discovery_context in state, skipping');
            process.exit(0);
        }

        if (discoveryContext.walkthrough_completed === true) {
            debugLog('Walkthrough completed, silent');
            process.exit(0);
        }

        // Warn: walkthrough not completed
        console.error(
            `[walkthrough-tracker] WARNING: Discovery completed without constitution walkthrough.\n` +
            `  The /discover command completed, but the constitution walkthrough step was not\n` +
            `  recorded as completed (discovery_context.walkthrough_completed is not true).\n` +
            `  The walkthrough ensures the user reviews and approves the project constitution\n` +
            `  before starting SDLC work. Consider running the walkthrough manually.`
        );
        process.exit(0);

    } catch (error) {
        debugLog('Error in walkthrough-tracker:', error.message);
        process.exit(0);
    }
}

main();
