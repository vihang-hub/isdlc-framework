#!/usr/bin/env node
/**
 * iSDLC Skill Enforcement - PreToolUse Validation Hook
 * =====================================================
 * Intercepts Task tool calls and validates agent authorization
 * Cross-platform Node.js implementation
 *
 * This hook receives JSON input via stdin with the structure:
 * {
 *   "tool_name": "Task",
 *   "tool_input": {
 *     "subagent_type": "software-developer",
 *     "prompt": "...",
 *     "description": "..."
 *   }
 * }
 *
 * Output:
 * - Exit 0 with no output: Allow the tool call
 * - Exit 0 with JSON output: Block with {"continue": false, "stopReason": "..."}
 *
 * Version: 2.0.0
 */

const {
    readState,
    loadManifest,
    normalizeAgentName,
    readStdin,
    outputBlockResponse,
    debugLog
} = require('./lib/common.js');

async function main() {
    try {
        // Read hook input from stdin
        const inputStr = await readStdin();

        if (!inputStr || !inputStr.trim()) {
            debugLog('No input received, allowing');
            process.exit(0);
        }

        let input;
        try {
            input = JSON.parse(inputStr);
        } catch (e) {
            debugLog('Invalid JSON input, allowing');
            process.exit(0);
        }

        // Extract tool name
        const toolName = input.tool_name;
        debugLog('Tool name:', toolName);

        // Only validate Task tool calls (agent delegation)
        if (toolName !== 'Task') {
            debugLog('Not a Task tool call, allowing');
            process.exit(0);
        }

        // Extract tool_input
        const toolInput = input.tool_input;
        if (!toolInput) {
            debugLog('No tool_input, allowing');
            process.exit(0);
        }

        // Extract target agent from subagent_type
        let targetAgent = toolInput.subagent_type;
        if (!targetAgent) {
            debugLog('No subagent_type specified, allowing');
            process.exit(0);
        }

        debugLog('Target agent (raw):', targetAgent);

        // Normalize agent name
        targetAgent = normalizeAgentName(targetAgent);
        debugLog('Target agent (normalized):', targetAgent);

        // Load state
        const state = readState();
        if (!state) {
            debugLog('No state.json found, allowing (fail-open)');
            process.exit(0);
        }

        // Check if enforcement is enabled
        const enforcement = state.skill_enforcement || {};
        if (enforcement.enabled === false) {
            debugLog('Enforcement disabled, allowing');
            process.exit(0);
        }

        // Get enforcement mode and fail behavior
        const enforcementMode = enforcement.mode || 'strict';
        const failBehavior = enforcement.fail_behavior || 'allow';
        debugLog('Enforcement mode:', enforcementMode);

        // Get current phase
        const currentPhase = state.current_phase || '01-requirements';
        debugLog('Current phase:', currentPhase);

        // Load manifest
        const manifest = loadManifest();
        if (!manifest) {
            debugLog('No manifest found, allowing (fail-open per fail_behavior:', failBehavior + ')');
            if (failBehavior === 'block') {
                outputBlockResponse('SKILL ENFORCEMENT ERROR: skills-manifest.json not found');
                process.exit(0);
            }
            process.exit(0);
        }

        // Check if agent exists in manifest
        if (!manifest.ownership || !manifest.ownership[targetAgent]) {
            debugLog(`Agent '${targetAgent}' not found in manifest`);
            // Unknown agent - this might be a non-SDLC agent, allow
            process.exit(0);
        }

        // Get agent's designated phase
        const agentPhase = manifest.ownership[targetAgent].phase;
        debugLog('Agent phase:', agentPhase);

        // Validate authorization
        let isAuthorized = false;

        // Orchestrator is always authorized (phase = "all")
        if (agentPhase === 'all') {
            isAuthorized = true;
            debugLog('Agent is orchestrator, always authorized');
        }
        // Setup agents are always authorized (phase = "setup")
        // These run during /discover before any workflow phase
        else if (agentPhase === 'setup') {
            isAuthorized = true;
            debugLog('Agent is setup agent, always authorized');
        }
        // Agent's phase matches current phase
        else if (agentPhase === currentPhase) {
            isAuthorized = true;
            debugLog('Agent phase matches current phase');
        } else {
            debugLog(`Agent phase (${agentPhase}) does not match current phase (${currentPhase})`);
        }

        // Handle based on authorization result and enforcement mode
        if (isAuthorized) {
            debugLog('Authorization: ALLOWED');
            process.exit(0);
        }

        // Unauthorized access detected
        debugLog('Authorization: DENIED');

        switch (enforcementMode) {
            case 'strict':
                // Block the operation
                const stopReason = `SKILL ENFORCEMENT: Agent '${targetAgent}' (phase: ${agentPhase}) is not authorized for current phase '${currentPhase}'. Delegate to the appropriate agent via the orchestrator.`;
                outputBlockResponse(stopReason);
                process.exit(0);
                break;

            case 'warn':
                // Allow with warning (logged in PostToolUse)
                debugLog('WARNING: Unauthorized access allowed (warn mode)');
                process.exit(0);
                break;

            case 'audit':
                // Allow silently (logged in PostToolUse)
                debugLog('AUDIT: Unauthorized access recorded (audit mode)');
                process.exit(0);
                break;

            default:
                // Unknown mode, default to strict
                const defaultStopReason = `SKILL ENFORCEMENT: Agent '${targetAgent}' is not authorized for phase '${currentPhase}'.`;
                outputBlockResponse(defaultStopReason);
                process.exit(0);
        }

    } catch (error) {
        debugLog('Error in skill-validator:', error.message);
        // Fail open on errors
        process.exit(0);
    }
}

main();
