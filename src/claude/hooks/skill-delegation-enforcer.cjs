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

/**
 * REQ-0023: Three-verb model inline commands that run without orchestrator delegation.
 * `add` creates backlog items inline. `analyze` runs analysis phases inline.
 * Both skip pending_delegation and mandatory delegation context.
 * `build` is NOT exempt -- it goes through standard orchestrator delegation.
 */
const EXEMPT_ACTIONS = new Set(['add', 'analyze']);

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

        // BUG-0021: Parse the action (first non-flag word) from args.
        // Handles: 'analyze "desc"', '--verbose analyze "desc"', empty args.
        const action = (args.match(/^(?:--?\w+\s+)*(\w+)/) || [])[1] || '';
        if (EXEMPT_ACTIONS.has(action.toLowerCase())) {
            debugLog(`Skill delegation enforcer: /${skill} ${action} is exempt from delegation`);
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
            `MANDATORY: You have loaded the /${skill} command. ` +
            `Follow the instructions in the loaded command prompt exactly. ` +
            `For workflow commands, begin by delegating to "${requiredAgent}" for initialization ` +
            `(STEP 1 of the Phase-Loop Controller). ` +
            `Do NOT implement the request directly. Do NOT enter plan mode. ` +
            `Do NOT write code yourself.`
        );

        process.exit(0);

    } catch (error) {
        debugLog('Error in skill-delegation-enforcer:', error.message);
        // Fail open
        process.exit(0);
    }
}

main();
