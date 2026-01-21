#!/usr/bin/env node
/**
 * iSDLC Gate Blocker - PreToolUse Hook
 * =====================================
 * Blocks gate advancement unless all iteration requirements are met.
 *
 * Intercepts:
 * - Task tool calls to orchestrator with "advance", "gate-check", "gate" in prompt
 * - Skill tool calls with /sdlc advance
 *
 * Version: 1.0.0
 */

const {
    readState,
    writeState,
    readStdin,
    outputBlockResponse,
    debugLog,
    getProjectRoot,
    getTimestamp
} = require('./lib/common.js');

const fs = require('fs');
const path = require('path');

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
                debugLog('Error loading iteration requirements:', e.message);
            }
        }
    }
    return null;
}

/**
 * Detect if this is a gate advancement attempt
 */
function isGateAdvancementAttempt(input) {
    const toolName = input.tool_name;
    const toolInput = input.tool_input || {};

    // Check Task tool calls
    if (toolName === 'Task') {
        const subagentType = (toolInput.subagent_type || '').toLowerCase();
        const prompt = (toolInput.prompt || '').toLowerCase();
        const description = (toolInput.description || '').toLowerCase();

        // Orchestrator invocations with gate-related keywords
        if (subagentType.includes('orchestrator') || subagentType === 'sdlc-orchestrator') {
            const gateKeywords = ['advance', 'gate', 'next phase', 'proceed', 'move to phase', 'progress to'];
            for (const keyword of gateKeywords) {
                if (prompt.includes(keyword) || description.includes(keyword)) {
                    return true;
                }
            }
        }
    }

    // Check Skill tool calls (if /sdlc advance is used)
    if (toolName === 'Skill') {
        const skill = (toolInput.skill || '').toLowerCase();
        const args = (toolInput.args || '').toLowerCase();

        if (skill === 'sdlc' && (args.includes('advance') || args.includes('gate'))) {
            return true;
        }
    }

    return false;
}

/**
 * Check if test iteration requirement is satisfied
 */
function checkTestIterationRequirement(phaseState, phaseRequirements) {
    const testReq = phaseRequirements.test_iteration;
    if (!testReq || !testReq.enabled) {
        return { satisfied: true, reason: 'not_required' };
    }

    const iterState = phaseState?.iteration_requirements?.test_iteration;
    if (!iterState) {
        return {
            satisfied: false,
            reason: 'Test iteration not started. Run tests and iterate until passing.',
            action_required: 'RUN_TESTS'
        };
    }

    if (!iterState.completed) {
        if (iterState.last_test_result === 'failed') {
            return {
                satisfied: false,
                reason: `Test iteration incomplete. ${iterState.current_iteration}/${iterState.max_iterations} iterations used. Last result: FAILED.`,
                action_required: 'CONTINUE_ITERATION',
                details: {
                    current_iteration: iterState.current_iteration,
                    max_iterations: iterState.max_iterations,
                    failures: iterState.failures_count
                }
            };
        }
        return {
            satisfied: false,
            reason: 'Test iteration not completed.',
            action_required: 'RUN_TESTS'
        };
    }

    // Check if escalated (which allows gate passage with human approval)
    if (iterState.status === 'escalated') {
        if (iterState.escalation_approved) {
            return { satisfied: true, reason: 'escalation_approved' };
        }
        return {
            satisfied: false,
            reason: 'Test iteration escalated but not approved. Human approval required.',
            action_required: 'HUMAN_APPROVAL',
            escalation_reason: iterState.escalation_reason
        };
    }

    return { satisfied: true, reason: 'tests_passing' };
}

/**
 * Check if constitutional validation requirement is satisfied
 */
function checkConstitutionalRequirement(phaseState, phaseRequirements) {
    const constReq = phaseRequirements.constitutional_validation;
    if (!constReq || !constReq.enabled) {
        return { satisfied: true, reason: 'not_required' };
    }

    const constState = phaseState?.constitutional_validation;
    if (!constState) {
        return {
            satisfied: false,
            reason: 'Constitutional validation not started. Validate artifacts against constitution.',
            action_required: 'RUN_CONSTITUTIONAL_VALIDATION',
            articles_required: constReq.articles
        };
    }

    if (!constState.completed) {
        return {
            satisfied: false,
            reason: `Constitutional validation incomplete. Status: ${constState.status}. ${constState.iterations_used || 0}/${constState.max_iterations} iterations.`,
            action_required: 'CONTINUE_CONSTITUTIONAL_ITERATION',
            details: {
                status: constState.status,
                iterations_used: constState.iterations_used,
                articles_checked: constState.articles_checked || []
            }
        };
    }

    if (constState.status === 'escalated') {
        if (constState.escalation_approved) {
            return { satisfied: true, reason: 'escalation_approved' };
        }
        return {
            satisfied: false,
            reason: 'Constitutional validation escalated. Human decision required.',
            action_required: 'HUMAN_DECISION',
            unresolved_violations: constState.unresolved_violations
        };
    }

    if (constState.status !== 'compliant') {
        return {
            satisfied: false,
            reason: `Constitutional validation status: ${constState.status}. Must be 'compliant'.`,
            action_required: 'FIX_VIOLATIONS'
        };
    }

    return { satisfied: true, reason: 'compliant' };
}

/**
 * Check if interactive elicitation requirement is satisfied (Phase 01)
 */
function checkElicitationRequirement(phaseState, phaseRequirements) {
    const elicitReq = phaseRequirements.interactive_elicitation;
    if (!elicitReq || !elicitReq.enabled) {
        return { satisfied: true, reason: 'not_required' };
    }

    const elicitState = phaseState?.iteration_requirements?.interactive_elicitation;
    if (!elicitState) {
        return {
            satisfied: false,
            reason: 'Interactive elicitation not started. Use A/R/C menu pattern with user.',
            action_required: 'START_ELICITATION'
        };
    }

    if (!elicitState.completed) {
        return {
            satisfied: false,
            reason: `Interactive elicitation incomplete. ${elicitState.menu_interactions || 0} menu interactions recorded.`,
            action_required: 'CONTINUE_ELICITATION',
            min_required: elicitReq.min_menu_interactions
        };
    }

    // Check final selection
    if (elicitReq.required_final_selection) {
        const finalSel = (elicitState.final_selection || '').toLowerCase();
        const validSelections = elicitReq.required_final_selection.map(s => s.toLowerCase());
        if (!validSelections.includes(finalSel)) {
            return {
                satisfied: false,
                reason: `Invalid final selection: '${elicitState.final_selection}'. Expected one of: ${validSelections.join(', ')}`,
                action_required: 'COMPLETE_ELICITATION'
            };
        }
    }

    return { satisfied: true, reason: 'elicitation_complete' };
}

/**
 * Main validation logic
 */
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

        // Only check gate advancement attempts
        if (!isGateAdvancementAttempt(input)) {
            debugLog('Not a gate advancement attempt, allowing');
            process.exit(0);
        }

        debugLog('Gate advancement attempt detected');

        // Load state
        const state = readState();
        if (!state) {
            debugLog('No state.json, allowing (fail-open)');
            process.exit(0);
        }

        // Check if iteration enforcement is enabled
        const enforcement = state.iteration_enforcement || {};
        if (enforcement.enabled === false) {
            debugLog('Iteration enforcement disabled');
            process.exit(0);
        }

        // Load requirements config
        const requirements = loadIterationRequirements();
        if (!requirements) {
            debugLog('No iteration requirements config, allowing');
            process.exit(0);
        }

        // Get current phase
        const currentPhase = state.current_phase;
        if (!currentPhase) {
            debugLog('No current phase set');
            process.exit(0);
        }

        debugLog('Current phase:', currentPhase);

        // Get phase requirements
        const phaseReq = requirements.phase_requirements[currentPhase];
        if (!phaseReq) {
            debugLog('No requirements defined for phase:', currentPhase);
            process.exit(0);
        }

        // Get phase state
        const phaseState = state.phases?.[currentPhase] || {};

        // Check all requirements
        const checks = [];

        // 1. Test iteration check
        const testCheck = checkTestIterationRequirement(phaseState, phaseReq);
        if (!testCheck.satisfied) {
            checks.push({
                requirement: 'test_iteration',
                ...testCheck
            });
        }

        // 2. Constitutional validation check
        const constCheck = checkConstitutionalRequirement(phaseState, phaseReq);
        if (!constCheck.satisfied) {
            checks.push({
                requirement: 'constitutional_validation',
                ...constCheck
            });
        }

        // 3. Interactive elicitation check
        const elicitCheck = checkElicitationRequirement(phaseState, phaseReq);
        if (!elicitCheck.satisfied) {
            checks.push({
                requirement: 'interactive_elicitation',
                ...elicitCheck
            });
        }

        // If all checks pass, allow gate advancement
        if (checks.length === 0) {
            debugLog('All iteration requirements satisfied, allowing gate advancement');
            process.exit(0);
        }

        // Block gate advancement
        const blockingReqs = checks.map(c => c.requirement).join(', ');
        const details = checks.map(c => `\n- ${c.requirement}: ${c.reason}`).join('');

        const stopReason = `GATE BLOCKED: Iteration requirements not satisfied for phase '${currentPhase}'.\n\nBlocking requirements: ${blockingReqs}${details}\n\nComplete the required iterations before advancing.`;

        // Update state with blocking info
        if (!state.phases) state.phases = {};
        if (!state.phases[currentPhase]) state.phases[currentPhase] = {};

        state.phases[currentPhase].gate_validation = {
            status: 'blocked',
            blocked_at: getTimestamp(),
            blocking_requirements: checks.map(c => c.requirement),
            details: checks
        };
        writeState(state);

        outputBlockResponse(stopReason);
        process.exit(0);

    } catch (error) {
        debugLog('Error in gate-blocker:', error.message);
        process.exit(0);
    }
}

main();
