#!/usr/bin/env node
/**
 * iSDLC Phase Sequence Guard - PreToolUse[Task] Hook
 * ====================================================
 * Blocks out-of-order phase delegation. The target phase of a delegation
 * must match the current workflow phase.
 *
 * Performance budget: < 100ms
 * Fail-open: any error results in silent exit (exit 0, no output)
 *
 * Traces to: FR-03, AC-03, AC-03a, AC-03b, AC-03c, AC-03d
 * Version: 1.0.0
 */

const {
    readStdin,
    readState,
    outputBlockResponse,
    debugLog,
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

        if (input.tool_name !== 'Task') {
            process.exit(0);
        }

        // Detect if this is a phase delegation
        const delegation = detectPhaseDelegation(input);
        if (!delegation.isDelegation) {
            debugLog('Not a phase delegation, allowing');
            process.exit(0);
        }

        debugLog('Phase delegation detected -> target:', delegation.targetPhase);

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
            debugLog('No current phase set, allowing');
            process.exit(0);
        }

        const targetPhase = delegation.targetPhase;
        if (!targetPhase) {
            debugLog('No target phase detected, allowing (fail-open)');
            process.exit(0);
        }

        // Allow if target matches current
        if (targetPhase === currentPhase) {
            debugLog('Target phase matches current phase, allowing');
            process.exit(0);
        }

        // Extract gate number from current phase (e.g., '03-architecture' -> '03')
        const gateMatch = currentPhase.match(/^(\d+)/);
        const gateNumber = gateMatch ? gateMatch[1] : '??';

        // Block: out-of-order phase delegation
        const agentLabel = delegation.agentName || 'unknown';
        outputBlockResponse(
            `OUT-OF-ORDER PHASE DELEGATION: Attempting to delegate to phase ` +
            `'${targetPhase}' (agent: ${agentLabel}), but the current workflow ` +
            `phase is '${currentPhase}'.\n\n` +
            `Phases must execute in the order defined by the workflow. You cannot ` +
            `skip ahead or go back to a previous phase without advancing through ` +
            `the gate.\n\n` +
            `To proceed correctly:\n` +
            `- Complete the current phase '${currentPhase}' and pass GATE-${gateNumber}\n` +
            `- Then the orchestrator will advance to the next phase automatically\n\n` +
            `Current phase: ${currentPhase}\n` +
            `Target phase:  ${targetPhase}`
        );
        process.exit(0);

    } catch (error) {
        debugLog('Error in phase-sequence-guard:', error.message);
        process.exit(0);
    }
}

main();
