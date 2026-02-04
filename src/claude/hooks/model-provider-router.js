#!/usr/bin/env node

/**
 * model-provider-router.js
 * ========================
 * PreToolUse hook that intercepts Task tool calls and injects
 * the appropriate provider/model configuration based on:
 *
 * 1. CLI overrides (ISDLC_PROVIDER_OVERRIDE, ISDLC_MODEL_OVERRIDE)
 * 2. Agent-specific overrides (agent_overrides in providers.yaml)
 * 3. Phase routing rules (phase_routing in providers.yaml)
 * 4. Mode defaults (modes.{active_mode} in providers.yaml)
 * 5. Global defaults (defaults.provider, defaults.model)
 * 6. Fallback chains on health check failure
 *
 * Version: 1.0.0
 * Part of iSDLC Multi-Provider Support
 */

const {
    loadProvidersConfig,
    hasProvidersConfig,
    selectProvider,
    selectWithFallback,
    getEnvironmentOverrides,
    trackUsage,
    debugLog
} = require('./lib/provider-utils.js');

const {
    readState,
    readStdin,
    outputBlockResponse
} = require('./lib/common.js');

// ============================================================================
// MAIN HOOK LOGIC
// ============================================================================

async function main() {
    try {
        // Read hook input from stdin
        const input = await readStdin();
        const { tool_name, tool_input } = JSON.parse(input);

        // Only intercept Task tool calls (agent invocations)
        if (tool_name !== 'Task') {
            // Pass through - don't interfere with other tools
            process.exit(0);
            return;
        }

        // Check if multi-provider is configured
        if (!hasProvidersConfig()) {
            // No providers.yaml - use default behavior (Anthropic)
            debugLog('No providers.yaml found, using default Anthropic');
            process.exit(0);
            return;
        }

        // Load configuration
        const config = loadProvidersConfig();
        const state = readState();

        // Extract context from tool input
        const context = {
            subagent_type: tool_input.subagent_type || 'unknown',
            prompt: tool_input.prompt || ''
        };

        debugLog(`Processing Task call for agent: ${context.subagent_type}`);
        debugLog(`Current phase: ${state?.current_phase || 'unknown'}`);
        debugLog(`Active mode: ${config.active_mode || 'hybrid'}`);

        // Select provider based on rules
        let selection = selectProvider(config, state, context);
        debugLog(`Initial selection: ${selection.provider}:${selection.model} (${selection.source})`);

        // Health check and fallback
        selection = await selectWithFallback(config, selection);

        // Handle complete provider failure
        if (!selection.healthy && selection.error) {
            // Log the failure
            console.error(`[provider-router] ${selection.error}`);

            // Block the operation with clear message
            outputBlockResponse(
                `LLM Provider Unavailable\n\n` +
                `${selection.error}\n\n` +
                `Troubleshooting:\n` +
                `  - Check your internet connection\n` +
                `  - Verify API keys are set (ANTHROPIC_API_KEY, etc.)\n` +
                `  - If using Ollama, ensure it's running: ollama serve\n` +
                `  - Run /provider status to check all providers\n`
            );
            process.exit(0);
            return;
        }

        // Get environment overrides for the selected provider
        const envOverrides = getEnvironmentOverrides(config, selection);

        // Log usage (if tracking enabled)
        trackUsage(config, state, selection);

        // Log final selection
        debugLog(`Final selection: ${selection.provider}:${selection.model}`);
        debugLog(`Environment overrides:`, Object.keys(envOverrides).join(', '));

        // Emit warning if using fallback
        if (selection.originalProvider) {
            console.error(
                `\n[provider-router] Provider Fallback Active\n` +
                `  Primary (${selection.originalProvider}) unavailable: ${selection.originalReason}\n` +
                `  Using fallback: ${selection.provider}:${selection.model}\n`
            );
        }

        // Emit warning if using local provider for complex phase
        if (selection.warning) {
            console.error(`\n[provider-router] Warning: ${selection.warning}\n`);
        }

        // Output the result for Claude Code to process
        // The environment_overrides will be applied before spawning the subagent
        console.log(JSON.stringify({
            continue: true,
            environment_overrides: envOverrides,
            provider_selection: {
                provider: selection.provider,
                model: selection.model,
                source: selection.source,
                phase: state?.current_phase || 'unknown'
            }
        }));

        process.exit(0);

    } catch (err) {
        // Log error but don't block - fail open to preserve existing behavior
        console.error(`[provider-router] Error: ${err.message}`);
        if (process.env.ISDLC_PROVIDER_DEBUG === 'true') {
            console.error(err.stack);
        }

        // Allow the operation to proceed with default behavior
        process.exit(0);
    }
}

// Run the hook
main();
