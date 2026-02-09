#!/usr/bin/env node
/**
 * iSDLC Iteration Corridor - PreToolUse Hook
 * ============================================
 * Restricts agent actions during active iteration states.
 *
 * When tests are failing or constitutional validation is pending,
 * agents can only perform actions related to fixing the issue.
 * Blocks delegation (Task) and gate advancement (Skill) attempts
 * that would let the agent escape the iteration loop.
 *
 * Corridors:
 * - TEST_CORRIDOR: Tests failing, agent must fix code and re-run tests
 * - CONST_CORRIDOR: Tests passed, agent must validate constitution
 * - NO_CORRIDOR: No active iteration, all actions allowed
 *
 * Version: 1.0.0
 */

const {
    readState,
    readStdin,
    outputBlockResponse,
    debugLog,
    getProjectRoot,
    getTimestamp,
    writePendingEscalation
} = require('./lib/common.cjs');

const fs = require('fs');
const path = require('path');

/**
 * Setup commands that should NEVER be blocked.
 * Same bypass list as other hooks for consistency.
 */
const SETUP_COMMAND_KEYWORDS = [
    'discover',
    'constitution',
    'init',
    'setup',
    'configure',
    'configure-cloud',
    'new project',
    'project setup',
    'install',
    'status'
];

/**
 * Patterns that indicate an agent is trying to advance, delegate, or escape iteration.
 * Used to block Task tool calls that would let the agent avoid fixing the issue.
 */
const ADVANCE_PATTERNS = [
    /advance/i,
    /gate/i,
    /next\s+phase/i,
    /proceed/i,
    /move\s+to\s+phase/i,
    /progress\s+to/i,
    /delegate/i,
    /hand\s*off/i,
    /phase\s+complete/i,
    /declare\s+complete/i
];

/**
 * Extract user-configured iteration config from state.json.
 * Returns null if not present or not configured (no configured_at timestamp).
 * @param {object} state - Parsed state.json
 * @returns {object|null} iteration_config or null
 */
function getIterationConfig(state) {
    const config = state && state.iteration_config;
    if (!config || !config.configured_at) return null;
    return config;
}

/**
 * Load iteration requirements config
 */
function loadIterationRequirements() {
    const projectRoot = getProjectRoot();
    const configPaths = [
        path.join(projectRoot, '.claude', 'hooks', 'config', 'iteration-requirements.json'),
        path.join(projectRoot, '.isdlc', 'config', 'iteration-requirements.json')
    ];

    for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
            try {
                return JSON.parse(fs.readFileSync(configPath, 'utf8'));
            } catch (e) {
                return null;
            }
        }
    }
    return null;
}

/**
 * Determine the current corridor state from state.json
 *
 * Returns:
 *   { corridor: 'TEST_CORRIDOR' | 'CONST_CORRIDOR' | 'NONE', details: {...} }
 */
function determineCorridorState(state, currentPhase, phaseReq) {
    const phaseState = state.phases?.[currentPhase];
    if (!phaseState) {
        return { corridor: 'NONE' };
    }

    // Check test iteration state
    const testReq = phaseReq?.test_iteration;
    const testState = phaseState.iteration_requirements?.test_iteration;

    if (testReq?.enabled && testState) {
        // Test iteration is active, not completed, and not escalated → TEST_CORRIDOR
        if (!testState.completed && !testState.status?.match(/^escalated$/)) {
            // Only enforce corridor if there's been at least one test run with a failure
            if (testState.last_test_result === 'failed') {
                return {
                    corridor: 'TEST_CORRIDOR',
                    details: {
                        current_iteration: testState.current_iteration,
                        max_iterations: testState.max_iterations,
                        last_error: testState.history?.slice(-1)[0]?.error || 'Unknown',
                        last_command: testState.last_test_command
                    }
                };
            }
        }
    }

    // Check constitutional validation state
    const constReq = phaseReq?.constitutional_validation;
    const constState = phaseState.constitutional_validation;

    // Only enter CONST_CORRIDOR if test iteration is satisfied (completed or not required)
    const testSatisfied = !testReq?.enabled ||
        (testState?.completed && testState?.status !== 'escalated') ||
        (testState?.completed && testState?.escalation_approved);

    if (testSatisfied && constReq?.enabled) {
        if (constState && !constState.completed && constState.status !== 'escalated') {
            return {
                corridor: 'CONST_CORRIDOR',
                details: {
                    iterations_used: constState.iterations_used || 0,
                    max_iterations: constState.max_iterations || constReq.max_iterations,
                    articles: constReq.articles || [],
                    status: constState.status
                }
            };
        }

        // Constitutional validation not started but required, and tests passed
        if (!constState && testSatisfied && testState?.completed) {
            return {
                corridor: 'CONST_CORRIDOR',
                details: {
                    iterations_used: 0,
                    max_iterations: constReq.max_iterations,
                    articles: constReq.articles || [],
                    status: 'not_started'
                }
            };
        }
    }

    return { corridor: 'NONE' };
}

/**
 * Check if a Task tool call contains advance/delegate keywords
 */
function taskHasAdvanceKeywords(toolInput) {
    const prompt = (toolInput.prompt || '');
    const description = (toolInput.description || '');
    const combined = prompt + ' ' + description;

    // First check setup bypass
    const combinedLower = combined.toLowerCase();
    for (const setupKeyword of SETUP_COMMAND_KEYWORDS) {
        if (combinedLower.includes(setupKeyword)) {
            return false;
        }
    }

    return ADVANCE_PATTERNS.some(pattern => pattern.test(combined));
}

/**
 * Check if a Skill tool call is an advance attempt
 */
function skillIsAdvanceAttempt(toolInput) {
    const skill = (toolInput.skill || '').toLowerCase();
    const args = (toolInput.args || '').toLowerCase();

    // Setup commands via Skill tool should not be blocked
    for (const setupKeyword of SETUP_COMMAND_KEYWORDS) {
        if (args.includes(setupKeyword)) {
            return false;
        }
    }

    if (skill === 'isdlc' && (args.includes('advance') || args.includes('gate'))) {
        return true;
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

        const toolName = input.tool_name;
        const toolInput = input.tool_input || {};

        // Only apply corridor enforcement to Task and Skill tools
        if (toolName !== 'Task' && toolName !== 'Skill') {
            process.exit(0);
        }

        // Load state
        const state = readState();
        if (!state) {
            process.exit(0);
        }

        // Check if enforcement is enabled
        if (state.iteration_enforcement?.enabled === false) {
            process.exit(0);
        }

        // Determine current phase — prefer active_workflow if present
        const activeWorkflow = state.active_workflow;
        const currentPhase = (activeWorkflow && activeWorkflow.current_phase) || state.current_phase;
        if (!currentPhase) {
            process.exit(0);
        }

        // Load requirements and apply workflow overrides if applicable
        const requirements = loadIterationRequirements();
        let phaseReq = requirements?.phase_requirements?.[currentPhase];
        if (!phaseReq) {
            process.exit(0);
        }

        if (activeWorkflow && requirements.workflow_overrides) {
            const overrides = requirements.workflow_overrides[activeWorkflow.type]?.[currentPhase];
            if (overrides) {
                phaseReq = { ...phaseReq };
                if (overrides.test_iteration) {
                    phaseReq.test_iteration = { ...phaseReq.test_iteration, ...overrides.test_iteration };
                }
                if (overrides.constitutional_validation) {
                    phaseReq.constitutional_validation = { ...phaseReq.constitutional_validation, ...overrides.constitutional_validation };
                }
            }
        }

        // Determine corridor state
        const corridorState = determineCorridorState(state, currentPhase, phaseReq);

        if (corridorState.corridor === 'NONE') {
            debugLog('No active corridor, allowing');
            process.exit(0);
        }

        debugLog('Corridor active:', corridorState.corridor);

        // Apply corridor rules
        if (corridorState.corridor === 'TEST_CORRIDOR') {
            // TEST_CORRIDOR: Block Task delegation and Skill advancement
            if (toolName === 'Task' && taskHasAdvanceKeywords(toolInput)) {
                const d = corridorState.details;
                const stopReason = `ITERATION CORRIDOR: Tests are failing (iteration ${d.current_iteration}/${d.max_iterations}). ` +
                    `Fix the code and re-run tests before doing anything else.\n\n` +
                    `Last error: ${d.last_error}\n` +
                    `Last test command: ${d.last_command || 'unknown'}\n\n` +
                    `Blocked action: ${toolName} (detected advance/delegate keywords)`;
                outputBlockResponse(stopReason);
                writePendingEscalation({
                    type: 'corridor_blocked',
                    hook: 'iteration-corridor',
                    phase: currentPhase,
                    detail: stopReason,
                    timestamp: getTimestamp()
                });
                process.exit(0);
            }

            if (toolName === 'Skill' && skillIsAdvanceAttempt(toolInput)) {
                const d = corridorState.details;
                const stopReason = `ITERATION CORRIDOR: Tests are failing (iteration ${d.current_iteration}/${d.max_iterations}). ` +
                    `Fix the code and re-run tests before doing anything else.\n\n` +
                    `Last error: ${d.last_error}\n` +
                    `Last test command: ${d.last_command || 'unknown'}\n\n` +
                    `Blocked action: ${toolName} (gate advancement not allowed during test iteration)`;
                outputBlockResponse(stopReason);
                writePendingEscalation({
                    type: 'corridor_blocked',
                    hook: 'iteration-corridor',
                    phase: currentPhase,
                    detail: stopReason,
                    timestamp: getTimestamp()
                });
                process.exit(0);
            }
        }

        if (corridorState.corridor === 'CONST_CORRIDOR') {
            // CONST_CORRIDOR: Block Task delegation and Skill advancement
            if (toolName === 'Task' && taskHasAdvanceKeywords(toolInput)) {
                const d = corridorState.details;
                const articleList = d.articles.join(', ');
                const stopReason = `ITERATION CORRIDOR: Constitutional validation in progress for Articles [${articleList}]. ` +
                    `Validate and fix artifacts before proceeding.\n\n` +
                    `Status: ${d.status} (iteration ${d.iterations_used}/${d.max_iterations})\n\n` +
                    `Blocked action: ${toolName} (detected advance/delegate keywords)`;
                outputBlockResponse(stopReason);
                writePendingEscalation({
                    type: 'corridor_blocked',
                    hook: 'iteration-corridor',
                    phase: currentPhase,
                    detail: stopReason,
                    timestamp: getTimestamp()
                });
                process.exit(0);
            }

            if (toolName === 'Skill' && skillIsAdvanceAttempt(toolInput)) {
                const d = corridorState.details;
                const articleList = d.articles.join(', ');
                const stopReason = `ITERATION CORRIDOR: Constitutional validation in progress for Articles [${articleList}]. ` +
                    `Validate and fix artifacts before proceeding.\n\n` +
                    `Status: ${d.status} (iteration ${d.iterations_used}/${d.max_iterations})\n\n` +
                    `Blocked action: ${toolName} (gate advancement not allowed during constitutional validation)`;
                outputBlockResponse(stopReason);
                writePendingEscalation({
                    type: 'corridor_blocked',
                    hook: 'iteration-corridor',
                    phase: currentPhase,
                    detail: stopReason,
                    timestamp: getTimestamp()
                });
                process.exit(0);
            }
        }

        // Action is allowed within the corridor
        debugLog('Action allowed within corridor');
        process.exit(0);

    } catch (error) {
        // Fail-open: any errors → allow the action
        debugLog('Error in iteration-corridor:', error.message);
        process.exit(0);
    }
}

main();
