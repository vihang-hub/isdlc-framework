#!/usr/bin/env node
/**
 * iSDLC Skill Observability - PostToolUse Logging Hook
 * ====================================================
 * Logs all Task tool invocations to skill_usage_log in state.json
 * Cross-platform Node.js implementation
 *
 * This hook receives JSON input via stdin with the structure:
 * {
 *   "tool_name": "Task",
 *   "tool_input": {
 *     "subagent_type": "software-developer",
 *     "prompt": "...",
 *     "description": "..."
 *   },
 *   "tool_result": "..."
 * }
 *
 * Version: 3.0.0
 */

const {
    readState,
    loadManifest,
    loadExternalManifest,
    normalizeAgentName,
    appendSkillLog,
    getTimestamp,
    readStdin,
    debugLog
} = require('./lib/common.js');

async function main() {
    try {
        // Read hook input from stdin
        const inputStr = await readStdin();

        if (!inputStr || !inputStr.trim()) {
            debugLog('No input received, skipping');
            process.exit(0);
        }

        let input;
        try {
            input = JSON.parse(inputStr);
        } catch (e) {
            debugLog('Invalid JSON input, skipping');
            process.exit(0);
        }

        // Extract tool name
        const toolName = input.tool_name;

        // Only log Task tool calls
        if (toolName !== 'Task') {
            process.exit(0);
        }

        // Extract tool_input
        const toolInput = input.tool_input;
        if (!toolInput) {
            process.exit(0);
        }

        // Extract target agent from subagent_type
        let targetAgent = toolInput.subagent_type;
        if (!targetAgent) {
            process.exit(0);
        }

        // Normalize agent name
        targetAgent = normalizeAgentName(targetAgent);

        // Extract description if available
        const description = toolInput.description || 'N/A';

        // Load state
        const state = readState();
        if (!state) {
            debugLog('No state.json found, skipping logging');
            process.exit(0);
        }

        // Check if enforcement is enabled
        const enforcement = state.skill_enforcement || {};
        if (enforcement.enabled === false) {
            debugLog('Enforcement disabled, skipping logging');
            process.exit(0);
        }

        // Get enforcement mode
        const enforcementMode = enforcement.mode || 'strict';

        // Get current phase
        const currentPhase = state.current_phase || '01-requirements';

        // Load manifest to determine authorization
        const manifest = loadManifest();

        // Load external manifest for recognition
        const externalManifest = loadExternalManifest();
        const externalSkillsRegistered = externalManifest && externalManifest.skills
            ? Object.keys(externalManifest.skills).length
            : 0;

        // Determine authorization status
        let status = 'executed';
        let reason = 'allowed';
        let agentPhase = '';

        if (manifest && manifest.ownership && manifest.ownership[targetAgent]) {
            agentPhase = manifest.ownership[targetAgent].phase || '';

            if (agentPhase === 'all') {
                reason = 'authorized-orchestrator';
            } else if (agentPhase === currentPhase) {
                reason = 'authorized-phase-match';
            } else {
                // Cross-phase usage — allowed in all modes (observability model)
                switch (enforcementMode) {
                    case 'observe':
                        status = 'observed';
                        reason = 'cross-phase-usage';
                        break;
                    case 'warn':
                        status = 'warned';
                        reason = 'cross-phase-usage';
                        break;
                    case 'audit':
                        status = 'audited';
                        reason = 'cross-phase-usage';
                        break;
                    case 'strict':
                        // Legacy strict mode — now observability-only
                        status = 'observed';
                        reason = 'cross-phase-usage';
                        break;
                    default:
                        status = 'observed';
                        reason = 'cross-phase-usage';
                }
            }
        }

        // Create log entry
        const logEntry = {
            timestamp: getTimestamp(),
            agent: targetAgent,
            agent_phase: agentPhase,
            current_phase: currentPhase,
            description: description,
            status: status,
            reason: reason,
            enforcement_mode: enforcementMode,
            external_skills_registered: externalSkillsRegistered
        };

        // Append to skill_usage_log
        if (appendSkillLog(logEntry)) {
            debugLog(`Logged skill usage: ${targetAgent} (${status})`);
        } else {
            debugLog('Failed to log skill usage');
        }

        // Always exit 0 - logging should never block
        process.exit(0);

    } catch (error) {
        debugLog('Error in log-skill-usage:', error.message);
        // Fail silently on errors
        process.exit(0);
    }
}

main();
