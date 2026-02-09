#!/usr/bin/env node
/**
 * iSDLC Phase-Loop Controller - PreToolUse[Task] Hook
 * =====================================================
 * Blocks phase delegation when the orchestrator has not called TaskUpdate
 * to mark the phase as in_progress. Ensures user visibility of progress.
 *
 * Performance budget: < 100ms
 * Fail-open: any error results in silent exit (exit 0, no output)
 *
 * Traces to: FR-01, AC-01, AC-01a, AC-01b, AC-01c
 * Version: 1.0.0
 */

const {
    readStdin,
    readState,
    outputBlockResponse,
    debugLog,
    logHookEvent,
    detectPhaseDelegation
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

        // Only intercept Task tool calls
        if (input.tool_name !== 'Task') {
            process.exit(0);
        }

        // Detect if this is a phase delegation
        const delegation = detectPhaseDelegation(input);
        if (!delegation.isDelegation) {
            debugLog('Not a phase delegation, allowing');
            process.exit(0);
        }

        debugLog('Phase delegation detected:', delegation.targetPhase, delegation.agentName);

        // Read state
        const state = readState();
        if (!state) {
            debugLog('No state.json, allowing (fail-open)');
            process.exit(0);
        }

        // Check for active workflow
        if (!state.active_workflow) {
            debugLog('No active workflow, allowing');
            process.exit(0);
        }

        const currentPhase = state.active_workflow.current_phase;
        if (!currentPhase) {
            debugLog('No current phase, allowing');
            process.exit(0);
        }

        // Check phase status
        const phaseState = state.phases && state.phases[currentPhase];
        const phaseStatus = phaseState && phaseState.status;

        if (phaseStatus === 'in_progress' || phaseStatus === 'completed') {
            debugLog('Phase status is', phaseStatus, '- allowing');
            process.exit(0);
        }

        // Block: phase status is not in_progress
        const agentLabel = delegation.agentName || delegation.targetPhase || 'unknown';
        logHookEvent('phase-loop-controller', 'block', {
            phase: delegation.targetPhase,
            agent: agentLabel,
            reason: `Phase status is '${phaseStatus || 'not set'}', expected 'in_progress'`
        });
        outputBlockResponse(
            `PHASE DELEGATION WITHOUT PROGRESS TRACKING: You are delegating to ` +
            `phase agent '${agentLabel}' for phase '${delegation.targetPhase}', ` +
            `but the phase task has not been marked as in_progress.\n\n` +
            `Before delegating, you MUST:\n` +
            `1. Call TaskCreate to create a task for this phase (if not already created)\n` +
            `2. Call TaskUpdate to set the task status to in_progress\n\n` +
            `This ensures the user can see phase progress via spinners. The phase status ` +
            `in state.json must be "in_progress" before delegation can proceed.\n\n` +
            `Current phase status: ${phaseStatus || 'not set'}`
        );
        process.exit(0);

    } catch (error) {
        debugLog('Error in phase-loop-controller:', error.message);
        process.exit(0);
    }
}

main();
