#!/usr/bin/env node
/**
 * iSDLC Gate Blocker - PreToolUse Hook
 * =====================================
 * Blocks gate advancement unless all iteration requirements are met.
 *
 * Intercepts:
 * - Task tool calls to orchestrator with "advance", "gate-check", "gate" in prompt
 * - Skill tool calls with /isdlc advance
 *
 * Version: 3.0.0
 */

const {
    readState,
    writeState,
    readStdin,
    outputBlockResponse,
    debugLog,
    getProjectRoot,
    getTimestamp,
    loadManifest,
    writePendingEscalation,
    validateSchema,
    normalizePhaseKey,
    diagnoseBlockCause,
    outputSelfHealNotification,
    logHookEvent,
    readPendingDelegation
} = require('./lib/common.cjs');

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
 * Load workflow definitions config
 */
function loadWorkflowDefinitions() {
    const projectRoot = getProjectRoot();
    const configPaths = [
        path.join(projectRoot, '.isdlc', 'config', 'workflows.json'),
        path.join(projectRoot, '.claude', 'hooks', 'config', 'workflows.json')
    ];

    for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
            try {
                return JSON.parse(fs.readFileSync(configPath, 'utf8'));
            } catch (e) {
                debugLog('Error loading workflow definitions:', e.message);
            }
        }
    }
    return null;
}

/**
 * Deep merge two objects. Overrides replace base values.
 */
function mergeRequirements(base, overrides) {
    if (!base) return overrides;
    if (!overrides) return base;

    const merged = JSON.parse(JSON.stringify(base));

    for (const [key, value] of Object.entries(overrides)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            merged[key] = mergeRequirements(merged[key] || {}, value);
        } else {
            merged[key] = value;
        }
    }

    return merged;
}

/**
 * Setup commands that should NEVER be blocked by gate validation.
 * These run BEFORE workflows start or are configuration commands.
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
    'status'  // Status checks should never be blocked
];

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
        const combined = prompt + ' ' + description;

        // FIRST: Check if this is a setup/configuration command - NEVER block these
        for (const setupKeyword of SETUP_COMMAND_KEYWORDS) {
            if (combined.includes(setupKeyword)) {
                debugLog(`Setup command detected (${setupKeyword}), skipping gate check`);
                return false;
            }
        }

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

    // Check Skill tool calls (if /isdlc advance is used)
    if (toolName === 'Skill') {
        const skill = (toolInput.skill || '').toLowerCase();
        const args = (toolInput.args || '').toLowerCase();

        // Setup commands via Skill tool should not be blocked
        for (const setupKeyword of SETUP_COMMAND_KEYWORDS) {
            if (args.includes(setupKeyword)) {
                debugLog(`Setup command detected via Skill (${setupKeyword}), skipping gate check`);
                return false;
            }
        }

        if (skill === 'isdlc' && (args.includes('advance') || args.includes('gate'))) {
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

    // Schema validation (fail-open)
    if (iterState) {
        const schemaResult = validateSchema(iterState, 'test-iteration');
        if (!schemaResult.valid) {
            debugLog('Test iteration schema errors:', schemaResult.errors);
        }
    }

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

    // Schema validation (fail-open: invalid schema data logs warning but does not block)
    if (constState) {
        const schemaResult = validateSchema(constState, 'constitutional-validation');
        if (!schemaResult.valid) {
            debugLog('Constitutional validation schema errors:', schemaResult.errors);
        }
    }

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

    // Schema validation (fail-open)
    if (elicitState) {
        const schemaResult = validateSchema(elicitState, 'interactive-elicitation');
        if (!schemaResult.valid) {
            debugLog('Interactive elicitation schema errors:', schemaResult.errors);
        }
    }

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
 * Check if agent delegation requirement is satisfied
 * Verifies the expected agent for the current phase was invoked at least once
 */
function checkAgentDelegationRequirement(phaseState, phaseRequirements, state, currentPhase) {
    const delegationReq = phaseRequirements.agent_delegation_validation;
    if (!delegationReq || !delegationReq.enabled) {
        return { satisfied: true, reason: 'not_required' };
    }

    const manifest = loadManifest();
    if (!manifest || !manifest.ownership) {
        return { satisfied: true, reason: 'no_manifest' };
    }

    // Find agent that owns this phase
    let expectedAgent = null;
    for (const [agent, info] of Object.entries(manifest.ownership)) {
        if (info.phase === currentPhase) {
            expectedAgent = agent;
            break;
        }
    }

    if (!expectedAgent) {
        return { satisfied: true, reason: 'no_agent_for_phase' };
    }

    // Check skill_usage_log for delegation to expected agent
    const log = state.skill_usage_log || [];
    const phaseEntries = log.filter(e => e.agent === expectedAgent && e.agent_phase === currentPhase);

    if (phaseEntries.length > 0) {
        return {
            satisfied: true,
            reason: 'agent_delegated',
            agent: expectedAgent,
            delegations: phaseEntries.length
        };
    }

    // Cross-reference: check pending_delegation for secondary evidence
    const pending = state.pending_delegation;
    if (pending && pending.required_agent) {
        const pendingAgent = pending.required_agent.toLowerCase().replace(/[_\s]/g, '-');
        const expected = expectedAgent.toLowerCase().replace(/[_\s]/g, '-');
        if (pendingAgent === expected || pendingAgent.includes(expected)) {
            return {
                satisfied: true,
                reason: 'agent_delegation_pending',
                agent: expectedAgent,
                source: 'pending_delegation'
            };
        }
    }

    // Cross-reference: check if phase is in_progress (tertiary evidence of delegation)
    const phaseData = state.phases?.[currentPhase];
    if (phaseData && phaseData.status === 'in_progress') {
        return {
            satisfied: true,
            reason: 'phase_in_progress',
            agent: expectedAgent,
            source: 'phase_status'
        };
    }

    return {
        satisfied: false,
        reason: `Phase agent '${expectedAgent}' was not delegated to during phase '${currentPhase}'. The orchestrator must delegate to the phase agent before gate advancement.`,
        action_required: 'DELEGATE_TO_PHASE_AGENT',
        expected_agent: expectedAgent
    };
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

        // Determine current phase — workflow-aware
        // If an active_workflow exists, use its current_phase; otherwise fall back to state.current_phase
        const activeWorkflow = state.active_workflow;
        let currentPhase;
        let workflowDef = null;

        if (activeWorkflow) {
            currentPhase = activeWorkflow.current_phase || state.current_phase;
            debugLog('Active workflow:', activeWorkflow.type, '| Phase:', currentPhase);

            // Load workflow definition for sequence validation
            const workflows = loadWorkflowDefinitions();
            if (workflows && workflows.workflows) {
                workflowDef = workflows.workflows[activeWorkflow.type];
            }

            // Validate phase is in the workflow sequence
            if (workflowDef) {
                // Use active_workflow.phases (the actual subset being executed) for index checks,
                // NOT workflowDef.phases (the canonical list which may include skipped phases).
                // current_phase_index tracks position within active_workflow.phases.
                const workflowPhases = activeWorkflow.phases || workflowDef.phases;
                const phaseIndex = activeWorkflow.current_phase_index;

                // Verify current phase matches expected position in workflow
                if (phaseIndex != null && workflowPhases[phaseIndex] !== currentPhase) {
                    outputBlockResponse(
                        `GATE BLOCKED: Workflow state mismatch. ` +
                        `Expected phase '${workflowPhases[phaseIndex]}' at index ${phaseIndex} ` +
                        `but current is '${currentPhase}'.`
                    );
                    process.exit(0);
                }

                // Check if this is the last phase (advancement would complete the workflow)
                if (phaseIndex != null && phaseIndex >= workflowPhases.length - 1) {
                    debugLog('At last workflow phase — gate check applies, advancement completes workflow');
                }
            }
        } else {
            currentPhase = state.current_phase;
        }

        if (!currentPhase) {
            debugLog('No current phase set');
            process.exit(0);
        }

        // Normalize phase key (self-healing: catches alias mismatches)
        const originalPhase = currentPhase;
        currentPhase = normalizePhaseKey(currentPhase);
        if (currentPhase !== originalPhase) {
            outputSelfHealNotification('gate-blocker', `Phase key '${originalPhase}' normalized to '${currentPhase}'.`);
        }

        debugLog('Current phase:', currentPhase);

        // Get base phase requirements
        let phaseReq = requirements.phase_requirements[currentPhase];
        if (!phaseReq) {
            // Self-heal: missing requirements is infrastructure issue, not genuine block
            outputSelfHealNotification('gate-blocker', `No requirements defined for phase '${currentPhase}'. Allowing gate advancement.`);
            process.exit(0);
        }

        // Apply workflow-specific overrides if active
        if (activeWorkflow && requirements.workflow_overrides) {
            const overrides = requirements.workflow_overrides[activeWorkflow.type]?.[currentPhase];
            if (overrides) {
                debugLog('Applying workflow overrides for:', activeWorkflow.type, currentPhase);
                phaseReq = mergeRequirements(phaseReq, overrides);
            }
        }

        // If the active workflow already marks this phase as completed, skip iteration checks.
        // This prevents stale gate_validation blocks when the orchestrator has already advanced.
        if (activeWorkflow?.phase_status?.[currentPhase] === 'completed') {
            debugLog('Phase already completed in active_workflow.phase_status, skipping gate checks');
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

        // 4. Agent delegation check
        const delegationCheck = checkAgentDelegationRequirement(phaseState, phaseReq, state, currentPhase);
        if (!delegationCheck.satisfied) {
            checks.push({
                requirement: 'agent_delegation',
                ...delegationCheck
            });
        }

        // If all checks pass, allow gate advancement
        if (checks.length === 0) {
            debugLog('All iteration requirements satisfied, allowing gate advancement');

            // Check for post-gate triggers (e.g., cloud config after GATE-06)
            const onGatePass = phaseReq.on_gate_pass;
            if (onGatePass?.trigger_cloud_config?.enabled) {
                const cloudConfig = state.cloud_configuration || {};
                if (cloudConfig.provider === 'undecided' || !cloudConfig.provider) {
                    // Output notification about cloud config prompt
                    const notification = {
                        type: 'gate_pass_trigger',
                        phase: currentPhase,
                        trigger: 'cloud_configuration',
                        message: `GATE-${currentPhase.split('-')[0]} passed. Cloud configuration is pending. Prompt user for cloud provider configuration.`,
                        action: 'prompt_cloud_configuration'
                    };
                    debugLog('Cloud config trigger:', notification);
                    // Write trigger to state for orchestrator to pick up
                    if (!state.pending_triggers) state.pending_triggers = [];
                    state.pending_triggers.push({
                        trigger: 'cloud_configuration',
                        triggered_at: getTimestamp(),
                        phase: currentPhase
                    });
                    writeState(state);
                }
            }

            process.exit(0);
        }

        // Diagnose each blocking check — self-heal infrastructure issues
        const genuineChecks = [];
        for (const check of checks) {
            const diagnosis = diagnoseBlockCause('gate-blocker', currentPhase, check.requirement, state);
            if (diagnosis.cause === 'infrastructure' || diagnosis.cause === 'stale') {
                outputSelfHealNotification('gate-blocker', `${diagnosis.detail}. Action: ${diagnosis.remediation}.`);
                logHookEvent('gate-blocker', 'self-heal', { phase: currentPhase, reason: diagnosis.detail });
            } else {
                genuineChecks.push(check);
            }
        }

        // If all blocks were infrastructure, allow gate advancement
        if (genuineChecks.length === 0) {
            debugLog('All blocks were infrastructure issues, self-healed — allowing');
            process.exit(0);
        }

        // Block gate advancement (genuine failures only)
        const blockingReqs = genuineChecks.map(c => c.requirement).join(', ');
        const details = genuineChecks.map(c => `\n- ${c.requirement}: ${c.reason}`).join('');

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

        // Write escalation for phase-loop controller visibility
        writePendingEscalation({
            type: 'gate_blocked',
            hook: 'gate-blocker',
            phase: currentPhase,
            detail: stopReason,
            timestamp: getTimestamp()
        });

        process.exit(0);

    } catch (error) {
        debugLog('Error in gate-blocker:', error.message);
        process.exit(0);
    }
}

main();
