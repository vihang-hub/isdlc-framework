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
 * Version: 1.1.0
 */

const {
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

/**
 * Dispatcher-compatible check function.
 * @param {object} ctx - { input, state, manifest, requirements, workflows }
 * @returns {{ decision: 'allow'|'block', stopReason?: string, stderr?: string, stdout?: string, stateModified?: boolean }}
 */
function check(ctx) {
    try {
        const input = ctx.input;
        if (!input) {
            return { decision: 'allow' };
        }

        if (input.tool_name !== 'Task') {
            return { decision: 'allow' };
        }

        // Read state
        const state = ctx.state;
        if (!state) {
            debugLog('No state.json, allowing (fail-open)');
            return { decision: 'allow' };
        }

        if (!state.active_workflow) {
            debugLog('No active workflow, allowing');
            return { decision: 'allow' };
        }

        const currentPhase = state.active_workflow.current_phase;
        if (!currentPhase) {
            debugLog('No current phase, allowing');
            return { decision: 'allow' };
        }

        // Early phases do not require a plan
        if (EARLY_PHASES.has(currentPhase)) {
            debugLog('Early phase', currentPhase, '- plan not required');
            return { decision: 'allow' };
        }

        // Check if tasks.md exists
        const tasksPath = resolveTasksPath();
        if (fs.existsSync(tasksPath)) {
            debugLog('Task plan exists at', tasksPath);
            return { decision: 'allow' };
        }

        // Block: implementation+ phase without task plan
        logHookEvent('plan-surfacer', 'block', {
            phase: currentPhase,
            reason: `No tasks.md found at ${tasksPath}`
        });

        const stopReason =
            `TASK PLAN NOT GENERATED: The current phase '${currentPhase}' requires ` +
            `a task plan (docs/isdlc/tasks.md) to exist before proceeding. ` +
            `No plan was found.\n\n` +
            `The task plan provides user visibility into the project roadmap and ` +
            `phase breakdown. Without it, the user cannot see what work is planned.\n\n` +
            `To fix this:\n` +
            `1. Run the generate-plan skill (ORCH-012) to create the task plan\n` +
            `2. Or manually create docs/isdlc/tasks.md with the phase breakdown\n\n` +
            `Expected path: ${tasksPath}`;

        return { decision: 'block', stopReason };

    } catch (error) {
        debugLog('Error in plan-surfacer:', error.message);
        return { decision: 'allow' };
    }
}

// Export check for dispatcher use
module.exports = { check };

// Standalone execution
if (require.main === module) {
    const { readStdin, readState, loadManifest, loadIterationRequirements, loadWorkflowDefinitions } = require('./lib/common.cjs');

    (async () => {
        try {
            const inputStr = await readStdin();
            if (!inputStr || !inputStr.trim()) {
                process.exit(0);
            }
            let input;
            try { input = JSON.parse(inputStr); } catch (e) { process.exit(0); }

            const state = readState();
            const manifest = loadManifest();
            const requirements = loadIterationRequirements();
            const workflows = loadWorkflowDefinitions();
            const ctx = { input, state, manifest, requirements, workflows };

            const result = check(ctx);

            if (result.stderr) {
                console.error(result.stderr);
            }
            if (result.stdout) {
                console.log(result.stdout);
            }
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
