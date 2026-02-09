#!/usr/bin/env node
/**
 * iSDLC Plan Surfacer - PreToolUse[Task] Hook
 * =============================================
 * Blocks delegation to implementation+ phases when the task plan
 * (docs/isdlc/tasks.md) has not been generated.
 *
 * Performance budget: < 100ms
 * Fail-open: any error results in silent exit (exit 0, no output)
 *
 * Traces to: FR-02, AC-02, AC-02a, AC-02b, AC-02c
 * Version: 1.0.0
 */

const {
    readStdin,
    readState,
    outputBlockResponse,
    debugLog,
    logHookEvent,
    resolveTasksPath
} = require('./lib/common.cjs');

const fs = require('fs');

/**
 * Phases that do NOT require a task plan.
 * Any phase not in this set requires the plan to exist.
 */
const EARLY_PHASES = new Set([
    '00-quick-scan',
    '01-requirements',
    '02-impact-analysis',
    '02-tracing',
    '03-architecture',
    '04-design',
    '05-test-strategy'
]);

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

        // Read state
        const state = readState();
        if (!state) {
            debugLog('No state.json, allowing (fail-open)');
            process.exit(0);
        }

        if (!state.active_workflow) {
            debugLog('No active workflow, allowing');
            process.exit(0);
        }

        const currentPhase = state.active_workflow.current_phase;
        if (!currentPhase) {
            debugLog('No current phase, allowing');
            process.exit(0);
        }

        // Early phases do not require a plan
        if (EARLY_PHASES.has(currentPhase)) {
            debugLog('Early phase', currentPhase, '- plan not required');
            process.exit(0);
        }

        // Check if tasks.md exists
        const tasksPath = resolveTasksPath();
        if (fs.existsSync(tasksPath)) {
            debugLog('Task plan exists at', tasksPath);
            process.exit(0);
        }

        // Block: implementation+ phase without task plan
        logHookEvent('plan-surfacer', 'block', {
            phase: currentPhase,
            reason: `No tasks.md found at ${tasksPath}`
        });
        outputBlockResponse(
            `TASK PLAN NOT GENERATED: The current phase '${currentPhase}' requires ` +
            `a task plan (docs/isdlc/tasks.md) to exist before proceeding. ` +
            `No plan was found.\n\n` +
            `The task plan provides user visibility into the project roadmap and ` +
            `phase breakdown. Without it, the user cannot see what work is planned.\n\n` +
            `To fix this:\n` +
            `1. Run the generate-plan skill (ORCH-012) to create the task plan\n` +
            `2. Or manually create docs/isdlc/tasks.md with the phase breakdown\n\n` +
            `Expected path: ${tasksPath}`
        );
        process.exit(0);

    } catch (error) {
        debugLog('Error in plan-surfacer:', error.message);
        process.exit(0);
    }
}

main();
