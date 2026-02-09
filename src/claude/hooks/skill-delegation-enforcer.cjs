#!/usr/bin/env node
/**
 * iSDLC Skill Delegation Enforcer - PostToolUse[Skill] Hook
 * ==========================================================
 * When /isdlc or /discover is loaded via the Skill tool, injects a mandatory
 * context message requiring Claude to delegate to the orchestrator agent
 * via the Task tool.
 *
 * Also writes a pending_delegation marker to state.json so the Stop hook
 * (delegation-gate.cjs) can verify delegation actually occurred.
 *
 * Version: 1.0.0
 */

const {
    readState,
    writePendingDelegation,
    readStdin,
    getTimestamp,
    debugLog
} = require('./lib/common.cjs');

/**
 * Map of skill names to their required orchestrator agent types.
 */
const DELEGATION_MAP = {
    'isdlc': 'sdlc-orchestrator',
    'discover': 'discover-orchestrator'
};

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

        // Only handle Skill tool calls
        const toolName = input.tool_name;
        if (toolName !== 'Skill') {
            process.exit(0);
        }

        const toolInput = input.tool_input || {};
        const skill = (toolInput.skill || '').toLowerCase().replace(/^\//, '');
        const args = toolInput.args || '';

        // Only enforce for /isdlc and /discover
        const requiredAgent = DELEGATION_MAP[skill];
        if (!requiredAgent) {
            process.exit(0);
        }

        debugLog(`Skill delegation enforcer: /${skill} detected, requiring delegation to ${requiredAgent}`);

        // Check if state exists (fail-open if not)
        const state = readState();
        if (!state) {
            debugLog('No state.json found, skipping enforcement');
            process.exit(0);
        }

        // Write pending_delegation marker
        writePendingDelegation({
            skill: skill,
            required_agent: requiredAgent,
            invoked_at: getTimestamp(),
            args: args
        });

        // Output mandatory delegation context
        console.log(
            `MANDATORY DELEGATION REQUIRED: You have loaded the /${skill} command. ` +
            `You MUST now use the Task tool to delegate to the "${requiredAgent}" agent. ` +
            `Do NOT implement the request directly. Do NOT enter plan mode. ` +
            `Do NOT write code yourself. Do NOT use any tool other than Task with ` +
            `subagent_type: "${requiredAgent}" as your next action.`
        );

        process.exit(0);

    } catch (error) {
        debugLog('Error in skill-delegation-enforcer:', error.message);
        // Fail open
        process.exit(0);
    }
}

main();
