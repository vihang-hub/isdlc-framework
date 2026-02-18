#!/usr/bin/env node
/**
 * iSDLC Delegation Gate - Stop Hook
 * ===================================
 * Hard safety net: when Claude finishes its response, checks if a /isdlc or
 * /discover command was loaded (via pending_delegation marker in state.json)
 * but no Task delegation to the correct orchestrator agent followed.
 *
 * If delegation is missing, blocks the response so Claude must retry
 * and delegate properly.
 *
 * Version: 1.0.0
 */

const {
    readState,
    writeState,
    readPendingDelegation,
    clearPendingDelegation,
    readStdin,
    debugLog,
    outputSelfHealNotification,
    logHookEvent
} = require('./lib/common.cjs');

/**
 * REQ-0023: Three-verb model inline commands exempt from delegation enforcement.
 * Defense-in-depth: if a pending_delegation marker exists for an exempt action
 * (add, analyze), auto-clear it without blocking.
 * `build` is NOT exempt -- delegation must occur.
 */
const EXEMPT_ACTIONS = new Set(['add', 'analyze']);

/**
 * Check if the skill_usage_log contains a delegation to the required agent
 * that occurred after the pending_delegation was written.
 *
 * @param {Array} usageLog - The skill_usage_log array from state.json
 * @param {string} requiredAgent - The expected orchestrator agent name
 * @param {string} invokedAt - ISO-8601 timestamp of when the skill was invoked
 * @returns {boolean} True if delegation was found
 */
function findDelegation(usageLog, requiredAgent, invokedAt) {
    if (!Array.isArray(usageLog) || usageLog.length === 0) {
        return false;
    }

    const invokedTime = new Date(invokedAt).getTime();

    for (const entry of usageLog) {
        if (!entry.timestamp || !entry.agent) continue;

        const entryTime = new Date(entry.timestamp).getTime();
        if (entryTime < invokedTime) continue;

        // Normalize agent name for comparison
        const agent = entry.agent.toLowerCase().replace(/[_\s]/g, '-');
        const required = requiredAgent.toLowerCase().replace(/[_\s]/g, '-');

        if (agent === required || agent.includes(required)) {
            return true;
        }
    }

    return false;
}

async function main() {
    try {
        // Helper to clear delegation marker and reset error counter
        function clearMarkerAndResetErrors() {
            clearPendingDelegation();
            try {
                const s = readState();
                if (s && s._delegation_gate_error_count) {
                    s._delegation_gate_error_count = 0;
                    writeState(s);
                }
            } catch (e) { /* ignore */ }
        }

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

        // Read pending delegation marker
        const pending = readPendingDelegation();
        if (!pending) {
            // No pending delegation — nothing to enforce
            process.exit(0);
        }

        debugLog('Delegation gate: pending delegation found:', pending);

        // BUG-0021: Defense-in-depth — auto-clear exempt action markers.
        // If the pending marker's args contain an exempt action (e.g., 'analyze'),
        // clear the marker without blocking.
        const pendingArgs = (pending.args || '');
        const pendingAction = (pendingArgs.match(/^(?:--?\w+\s+)*(\w+)/) || [])[1] || '';
        if (EXEMPT_ACTIONS.has(pendingAction.toLowerCase())) {
            debugLog('Delegation gate: pending delegation is for exempt action, auto-clearing');
            clearMarkerAndResetErrors();
            process.exit(0);
        }

        // Read state to check skill_usage_log
        const state = readState();
        if (!state) {
            // State is missing/corrupt but we have a pending delegation — block instead of clearing
            logHookEvent('delegation-gate', 'block', {
                reason: 'State unavailable but pending delegation exists — blocking to preserve marker'
            });
            console.log(JSON.stringify({
                decision: 'block',
                reason: `Delegation gate cannot verify delegation: state.json is unavailable. ` +
                    `A pending delegation to "${pending.required_agent}" exists. ` +
                    `Please ensure state.json is valid and retry.`
            }));
            process.exit(0);
        }

        const usageLog = state.skill_usage_log || [];
        const requiredAgent = pending.required_agent;
        const invokedAt = pending.invoked_at;

        // Check if delegation occurred
        const delegated = findDelegation(usageLog, requiredAgent, invokedAt);

        if (delegated) {
            debugLog(`Delegation gate: delegation to ${requiredAgent} confirmed, clearing marker`);
            clearMarkerAndResetErrors();
            process.exit(0);
        }

        // Phase-Loop Controller: if workflow progressed past phase 01, init delegation confirmed
        if (state.active_workflow && state.active_workflow.current_phase_index > 0) {
            debugLog(`Delegation gate: workflow at phase index ${state.active_workflow.current_phase_index} — init delegation confirmed`);
            clearMarkerAndResetErrors();
            process.exit(0);
        }

        // Cross-reference: check if any phase is in_progress (evidence of active work)
        // BUG-0005 (AC-03b): Prefer active_workflow.current_phase over top-level (fix inverted priority)
        const currentPhase = (state.active_workflow && state.active_workflow.current_phase) || state.current_phase;
        if (currentPhase && state.phases && state.phases[currentPhase]) {
            const phaseData = state.phases[currentPhase];
            if (phaseData.status === 'in_progress') {
                outputSelfHealNotification('delegation-gate',
                    `Phase '${currentPhase}' is in_progress — accepting as delegation evidence.`);
                clearMarkerAndResetErrors();
                process.exit(0);
            }
        }

        // Delegation did NOT happen — block the response
        debugLog(`Delegation gate: BLOCKING — no delegation to ${requiredAgent} found after ${invokedAt}`);

        console.log(JSON.stringify({
            decision: 'block',
            reason: `You loaded /${pending.skill} but did not delegate to "${requiredAgent}" for initialization. ` +
                `Follow the loaded command's Phase-Loop Controller: begin with Task → ${requiredAgent} (STEP 1). ` +
                `Do not implement the request directly.`
        }));

        process.exit(0);

    } catch (error) {
        debugLog('Error in delegation-gate:', error.message);

        // Safety valve: track consecutive error-blocks to prevent infinite loops
        let errorCount = 0;
        try {
            const state = readState();
            if (state) {
                errorCount = (state._delegation_gate_error_count || 0) + 1;
                state._delegation_gate_error_count = errorCount;
                writeState(state);
            }
        } catch (e) { /* ignore state update failures */ }

        if (errorCount >= 5) {
            // Safety valve: after 5 consecutive errors, clear marker to prevent infinite loops
            debugLog('delegation-gate: safety valve triggered after 5 consecutive errors, clearing marker');
            try { clearPendingDelegation(); } catch (e) { /* ignore */ }
            try {
                const state = readState();
                if (state) {
                    state._delegation_gate_error_count = 0;
                    writeState(state);
                }
            } catch (e) { /* ignore */ }
            logHookEvent('delegation-gate', 'warn', {
                reason: 'Safety valve: cleared marker after 5 consecutive errors'
            });
            process.exit(0);
        }

        // Block on error instead of fail-open — preserve the marker
        logHookEvent('delegation-gate', 'error', {
            reason: `Error during delegation check: ${error.message}`
        });
        console.log(JSON.stringify({
            decision: 'block',
            reason: `Delegation gate encountered an error during verification. ` +
                `The pending delegation marker has been preserved. ` +
                `Error: ${error.message}. ` +
                `Please retry the delegation to the required orchestrator agent.`
        }));
        process.exit(0);
    }
}

main();
