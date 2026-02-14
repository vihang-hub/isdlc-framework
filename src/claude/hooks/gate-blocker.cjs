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
 * Version: 3.2.0
 */

const {
    debugLog,
    getTimestamp,
    loadManifest,
    validateSchema,
    normalizePhaseKey,
    diagnoseBlockCause,
    outputSelfHealNotification,
    logHookEvent,
    addPendingEscalation,
    detectPhaseDelegation,
    loadIterationRequirements: loadIterationRequirementsFromCommon,
    loadWorkflowDefinitions: loadWorkflowDefinitionsFromCommon
} = require('./lib/common.cjs');

const fs = require('fs');
const path = require('path');

/**
 * Load iteration requirements config (local fallback)
 */
function loadIterationRequirements() {
    const { getProjectRoot } = require('./lib/common.cjs');
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
 * Load workflow definitions config (local fallback)
 */
function loadWorkflowDefinitions() {
    const { getProjectRoot } = require('./lib/common.cjs');
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
 * BUG-0008: Added detectPhaseDelegation() guard to prevent false positives
 * on delegation prompts containing gate-related keywords like "GATE-NN".
 */
function isGateAdvancementAttempt(input) {
    const toolName = input.tool_name;
    const toolInput = input.tool_input || {};

    // Check Task tool calls
    if (toolName === 'Task') {
        // BUG-0008: Phase-loop controller delegations are NOT gate advancement attempts
        try {
            const delegation = detectPhaseDelegation(input);
            if (delegation.isDelegation) {
                debugLog(`Delegation detected (agent: ${delegation.agentName}, phase: ${delegation.targetPhase}), skipping gate check`);
                return false;
            }
        } catch (e) { /* fail-open: fall through to existing logic */ }

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
 * Resolve template placeholders in artifact paths.
 * Substitutes {artifact_folder} from state.active_workflow.artifact_folder.
 * @param {string[]} paths - Paths with template placeholders
 * @param {object} state - state.json content
 * @returns {string[]} Resolved paths (templates without values are filtered out)
 */
function resolveArtifactPaths(paths, state) {
    const artifactFolder = state?.active_workflow?.artifact_folder;
    const resolved = [];

    for (const p of paths) {
        if (p.includes('{artifact_folder}')) {
            if (artifactFolder) {
                resolved.push(p.replace(/\{artifact_folder\}/g, artifactFolder));
            }
            // If no artifact_folder, skip this path (fail-open)
        } else {
            resolved.push(p);
        }
    }

    return resolved;
}

/**
 * Check if required artifacts are present for the current phase.
 * For phases with artifact_validation config, checks that files exist on disk.
 * Fail-open: missing config or unresolvable paths pass the check.
 */
function checkArtifactPresenceRequirement(phaseState, phaseRequirements, state, currentPhase) {
    const artifactReq = phaseRequirements.artifact_validation;
    if (!artifactReq || !artifactReq.enabled) {
        return { satisfied: true, reason: 'not_required' };
    }

    const paths = artifactReq.paths;
    if (!paths || paths.length === 0) {
        return { satisfied: true, reason: 'no_paths_configured' };
    }

    const resolvedPaths = resolveArtifactPaths(paths, state);
    if (resolvedPaths.length === 0) {
        // All paths had unresolvable templates — fail-open
        return { satisfied: true, reason: 'paths_unresolvable' };
    }

    const { getProjectRoot } = require('./lib/common.cjs');
    const projectRoot = getProjectRoot();
    const missingArtifacts = [];

    // For paths with alternatives (e.g., interface-spec.yaml OR interface-spec.md),
    // group by directory and check if ANY variant exists
    const pathsByDir = {};
    for (const p of resolvedPaths) {
        const dir = path.dirname(p);
        if (!pathsByDir[dir]) pathsByDir[dir] = [];
        pathsByDir[dir].push(p);
    }

    for (const [dir, dirPaths] of Object.entries(pathsByDir)) {
        const anyExists = dirPaths.some(p => fs.existsSync(path.join(projectRoot, p)));
        if (!anyExists) {
            missingArtifacts.push(dirPaths[0]); // Report first variant as missing
        }
    }

    if (missingArtifacts.length > 0) {
        return {
            satisfied: false,
            reason: `Required artifact(s) missing for phase '${currentPhase}': ${missingArtifacts.join(', ')}`,
            action_required: 'CREATE_ARTIFACTS',
            missing_artifacts: missingArtifacts
        };
    }

    return { satisfied: true, reason: 'all_present' };
}

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

        // Only check gate advancement attempts
        if (!isGateAdvancementAttempt(input)) {
            debugLog('Not a gate advancement attempt, allowing');
            return { decision: 'allow' };
        }

        // =====================================================================
        // Supervised Mode Note (REQ-0013):
        // The supervised review gate (STEP 3e-review in isdlc.md) runs AFTER
        // a phase completes and its gate requirements are satisfied. It operates
        // at the phase-loop controller level, not at the hook level.
        //
        // Gate-blocker does NOT need to block for supervised mode -- it only
        // validates iteration requirements (tests, constitutional, elicitation,
        // delegation, artifacts). The review gate handles the user-facing
        // pause/review/redo flow independently.
        //
        // When supervised_mode is active, the gate-blocker allows gate
        // advancement as normal. The phase-loop controller's STEP 3e-review
        // intercepts after advancement to present the review menu.
        // =====================================================================

        debugLog('Gate advancement attempt detected');

        // Load state
        const state = ctx.state;
        if (!state) {
            debugLog('No state.json, allowing (fail-open)');
            return { decision: 'allow' };
        }

        // Check if iteration enforcement is enabled
        const enforcement = state.iteration_enforcement || {};
        if (enforcement.enabled === false) {
            debugLog('Iteration enforcement disabled');
            return { decision: 'allow' };
        }

        // Load requirements config (prefer ctx.requirements, fallback to local loader)
        const requirements = ctx.requirements || loadIterationRequirementsFromCommon() || loadIterationRequirements();
        if (!requirements) {
            debugLog('No iteration requirements config, allowing');
            return { decision: 'allow' };
        }

        // Determine current phase — workflow-aware
        const activeWorkflow = state.active_workflow;
        let currentPhase;
        let workflowDef = null;
        let stderrMessages = '';

        if (activeWorkflow) {
            currentPhase = activeWorkflow.current_phase || state.current_phase;
            debugLog('Active workflow:', activeWorkflow.type, '| Phase:', currentPhase);

            // Load workflow definition for sequence validation (prefer ctx.workflows)
            const workflows = ctx.workflows || loadWorkflowDefinitionsFromCommon() || loadWorkflowDefinitions();
            if (workflows && workflows.workflows) {
                workflowDef = workflows.workflows[activeWorkflow.type];
            }

            // Validate phase is in the workflow sequence
            if (workflowDef) {
                const workflowPhases = activeWorkflow.phases || workflowDef.phases;
                const phaseIndex = activeWorkflow.current_phase_index;

                // Verify current phase matches expected position in workflow
                if (phaseIndex != null && workflowPhases[phaseIndex] !== currentPhase) {
                    const stopReason =
                        `GATE BLOCKED: Workflow state mismatch. ` +
                        `Expected phase '${workflowPhases[phaseIndex]}' at index ${phaseIndex} ` +
                        `but current is '${currentPhase}'.`;
                    return { decision: 'block', stopReason };
                }

                // Check if this is the last phase (advancement would complete the workflow)
                if (phaseIndex != null && phaseIndex >= workflowPhases.length - 1) {
                    debugLog('At last workflow phase — gate check applies, advancement completes workflow');
                }
            }
        } else {
            // BUG-0005 (AC-03e): prefer active_workflow.current_phase even in fallback branch
            currentPhase = state.active_workflow?.current_phase || state.current_phase;
        }

        if (!currentPhase) {
            debugLog('No current phase set');
            return { decision: 'allow' };
        }

        // Normalize phase key (self-healing: catches alias mismatches)
        const originalPhase = currentPhase;
        currentPhase = normalizePhaseKey(currentPhase);
        if (currentPhase !== originalPhase) {
            const msg = `[SELF-HEAL] gate-blocker: Phase key '${originalPhase}' normalized to '${currentPhase}'.`;
            stderrMessages += msg + '\n';
            logHookEvent('gate-blocker', 'self-heal', { reason: `Phase key '${originalPhase}' normalized to '${currentPhase}'.` });
        }

        debugLog('Current phase:', currentPhase);

        // Get base phase requirements
        let phaseReq = requirements.phase_requirements[currentPhase];
        if (!phaseReq) {
            // Self-heal: missing requirements is infrastructure issue, not genuine block
            const msg = `[SELF-HEAL] gate-blocker: No requirements defined for phase '${currentPhase}'. Allowing gate advancement.`;
            stderrMessages += msg + '\n';
            logHookEvent('gate-blocker', 'self-heal', { reason: `No requirements defined for phase '${currentPhase}'. Allowing gate advancement.` });
            return { decision: 'allow', stderr: stderrMessages.trim() || undefined };
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
        if (activeWorkflow?.phase_status?.[currentPhase] === 'completed') {
            debugLog('Phase already completed in active_workflow.phase_status, skipping gate checks');
            return { decision: 'allow', stderr: stderrMessages.trim() || undefined };
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

        // 5. Artifact presence check
        const artifactCheck = checkArtifactPresenceRequirement(phaseState, phaseReq, state, currentPhase);
        if (!artifactCheck.satisfied) {
            checks.push({
                requirement: 'artifact_presence',
                ...artifactCheck
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
                    // Write trigger to state for orchestrator to pick up
                    if (!state.pending_triggers) state.pending_triggers = [];
                    state.pending_triggers.push({
                        trigger: 'cloud_configuration',
                        triggered_at: getTimestamp(),
                        phase: currentPhase
                    });
                    return { decision: 'allow', stderr: stderrMessages.trim() || undefined, stateModified: true };
                }
            }

            return { decision: 'allow', stderr: stderrMessages.trim() || undefined };
        }

        // Diagnose each blocking check — self-heal infrastructure issues
        const genuineChecks = [];
        for (const oneCheck of checks) {
            const diagnosis = diagnoseBlockCause('gate-blocker', currentPhase, oneCheck.requirement, state);
            if (diagnosis.cause === 'infrastructure' || diagnosis.cause === 'stale') {
                const msg = `[SELF-HEAL] gate-blocker: ${diagnosis.detail}. Action: ${diagnosis.remediation}.`;
                stderrMessages += msg + '\n';
                logHookEvent('gate-blocker', 'self-heal', { phase: currentPhase, reason: diagnosis.detail });
            } else {
                genuineChecks.push(oneCheck);
            }
        }

        // Log supervised review context for debugging (REQ-0013)
        if (state.active_workflow?.supervised_review?.status === 'reviewing') {
            const msg = `[INFO] gate-blocker: supervised review in progress for phase '${state.active_workflow.supervised_review.phase}'. Gate check unaffected.`;
            stderrMessages += msg + '\n';
        }

        // If all blocks were infrastructure, allow gate advancement
        if (genuineChecks.length === 0) {
            debugLog('All blocks were infrastructure issues, self-healed — allowing');
            return { decision: 'allow', stderr: stderrMessages.trim() || undefined };
        }

        // Block gate advancement (genuine failures only)
        const blockingReqs = genuineChecks.map(c => c.requirement).join(', ');
        const details = genuineChecks.map(c => `\n- ${c.requirement}: ${c.reason}`).join('');

        const stopReason = `GATE BLOCKED: Iteration requirements not satisfied for phase '${currentPhase}'.\n\nBlocking requirements: ${blockingReqs}${details}\n\nComplete the required iterations before advancing.`;

        // Update state with blocking info (in memory)
        if (!state.phases) state.phases = {};
        if (!state.phases[currentPhase]) state.phases[currentPhase] = {};

        state.phases[currentPhase].gate_validation = {
            status: 'blocked',
            blocked_at: getTimestamp(),
            blocking_requirements: checks.map(c => c.requirement),
            details: checks
        };

        // Write escalation for phase-loop controller visibility
        addPendingEscalation(state, {
            type: 'gate_blocked',
            hook: 'gate-blocker',
            phase: currentPhase,
            detail: stopReason,
            timestamp: getTimestamp()
        });

        return {
            decision: 'block',
            stopReason,
            stderr: stderrMessages.trim() || undefined,
            stateModified: true
        };

    } catch (error) {
        debugLog('Error in gate-blocker:', error.message);
        return { decision: 'allow' };
    }
}

// Export check for dispatcher use
module.exports = { check };

// Standalone execution
if (require.main === module) {
    const { readStdin, readState, writeState: writeStateFn, loadManifest: loadManifestFn, loadIterationRequirements: loadReqs, loadWorkflowDefinitions: loadWfs, outputBlockResponse } = require('./lib/common.cjs');

    (async () => {
        try {
            const inputStr = await readStdin();
            if (!inputStr || !inputStr.trim()) { process.exit(0); }
            let input;
            try { input = JSON.parse(inputStr); } catch (e) { process.exit(0); }

            const state = readState();
            const manifest = loadManifestFn();
            const requirements = loadReqs();
            const workflows = loadWfs();
            const ctx = { input, state, manifest, requirements, workflows };

            const result = check(ctx);

            if (result.stderr) console.error(result.stderr);
            if (result.stdout) console.log(result.stdout);
            if (result.decision === 'block' && result.stopReason) {
                outputBlockResponse(result.stopReason);
            }
            if (result.stateModified && state) {
                writeStateFn(state);
            }
            process.exit(0);
        } catch (e) { process.exit(0); }
    })();
}
