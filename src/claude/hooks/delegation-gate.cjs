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

        // Read state to check skill_usage_log
        const state = readState();
        if (!state) {
            // No state — fail open, clear marker
            clearPendingDelegation();
            process.exit(0);
        }

        const usageLog = state.skill_usage_log || [];
        const requiredAgent = pending.required_agent;
        const invokedAt = pending.invoked_at;

        // Check if delegation occurred
        const delegated = findDelegation(usageLog, requiredAgent, invokedAt);

        if (delegated) {
            debugLog(`Delegation gate: delegation to ${requiredAgent} confirmed, clearing marker`);
            clearPendingDelegation();
            process.exit(0);
        }

        // Cross-reference: check if any phase is in_progress (evidence of active work)
        const currentPhase = state.current_phase || (state.active_workflow && state.active_workflow.current_phase);
        if (currentPhase && state.phases && state.phases[currentPhase]) {
            const phaseData = state.phases[currentPhase];
            if (phaseData.status === 'in_progress') {
                outputSelfHealNotification('delegation-gate',
                    `Phase '${currentPhase}' is in_progress — accepting as delegation evidence.`);
                clearPendingDelegation();
                process.exit(0);
            }
        }

        // Delegation did NOT happen — block the response
        debugLog(`Delegation gate: BLOCKING — no delegation to ${requiredAgent} found after ${invokedAt}`);

        console.log(JSON.stringify({
            decision: 'block',
            reason: `You loaded /${pending.skill} but did not delegate to the "${requiredAgent}" agent via the Task tool. ` +
                `You MUST use the Task tool with subagent_type: "${requiredAgent}" to handle this command. ` +
                `Do not implement the request directly.`
        }));

        process.exit(0);

    } catch (error) {
        debugLog('Error in delegation-gate:', error.message);
        // Fail open — clear marker to prevent infinite blocking
        try { clearPendingDelegation(); } catch (e) { /* ignore */ }
        process.exit(0);
    }
}

main();
