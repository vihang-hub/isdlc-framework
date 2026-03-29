#!/usr/bin/env node
'use strict';
/**
 * iSDLC MCP Tool Router - PreToolUse Hook
 * ========================================
 * Routes agents from lower-fidelity built-in tools to higher-fidelity MCP
 * alternatives when available. Config-driven via mcp-tool-routing.json.
 *
 * Enforcement levels per rule:
 *   - block: output JSON to block tool, suggest MCP alternative
 *   - warn:  allow through but log a warning to stderr
 *   - allow: pass through silently
 *
 * Fail-open: any error (config missing, malformed input, etc.) allows through.
 * Performance budget: < 100ms (sync JSON parse + regex matching only)
 *
 * Traces to: FR-01, FR-02, FR-03, FR-04, FR-05, FR-06
 * Version: 1.0.0
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

/** @type {object|null} Cached config object */
let _configCache = null;

/**
 * Load routing config from mcp-tool-routing.json.
 * Returns null on any error (fail-open).
 * @param {string} [projectDir] - Override project dir (for testing)
 * @returns {object|null}
 */
function loadRoutingConfig(projectDir) {
    if (_configCache) return _configCache;
    try {
        const dir = projectDir || process.env.CLAUDE_PROJECT_DIR || process.cwd();
        const configPath = path.join(dir, '.claude', 'hooks', 'config', 'mcp-tool-routing.json');
        if (!fs.existsSync(configPath)) return null;
        const raw = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(raw);
        if (!config || !Array.isArray(config.rules)) return null;
        _configCache = config;
        return config;
    } catch (e) {
        return null;
    }
}

/**
 * Clear the config cache (for testing).
 */
function clearConfigCache() {
    _configCache = null;
}

// ---------------------------------------------------------------------------
// MCP availability detection
// ---------------------------------------------------------------------------

/**
 * Check if an MCP tool is likely available.
 * Currently checks the settings.json mcpServers field to see if the
 * MCP server prefix is registered. Fails open (returns true if unknown).
 * @param {string} mcpToolName - e.g. "mcp__code-index-mcp__search_code_advanced"
 * @param {string} [projectDir] - Override project dir
 * @returns {boolean}
 */
function isMcpToolAvailable(mcpToolName, projectDir) {
    try {
        if (!mcpToolName) return false;
        // Extract the server name from the MCP tool name
        // Format: mcp__{server}__{tool}
        const match = mcpToolName.match(/^mcp__([^_]+(?:-[^_]+)*)__/);
        if (!match) return false;
        const serverName = match[1];

        const dir = projectDir || process.env.CLAUDE_PROJECT_DIR || process.cwd();
        const settingsPath = path.join(dir, '.claude', 'settings.json');
        if (!fs.existsSync(settingsPath)) return false;
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        if (!settings || !settings.mcpServers) return false;
        return serverName in settings.mcpServers;
    } catch (e) {
        // Fail open: if we can't determine availability, assume available
        // so the routing still suggests the MCP tool
        return true;
    }
}

// ---------------------------------------------------------------------------
// Exception detection
// ---------------------------------------------------------------------------

/**
 * Check if a Read call is a partial read (edit prep) or PDF read.
 * Partial reads have offset, limit, or pages params.
 * @param {object} toolInput - The tool_input from the hook context
 * @returns {boolean} true if this is a legitimate exception
 */
function isReadException(toolInput) {
    if (!toolInput) return false;
    // Partial read (edit prep): has offset or limit
    if (toolInput.offset != null || toolInput.limit != null) return true;
    // PDF read: has pages param
    if (toolInput.pages != null) return true;
    return false;
}

/**
 * Check if a Grep call is targeting a specific file (not a directory search).
 * Single-file grep is a legitimate use pattern.
 * @param {object} toolInput - The tool_input from the hook context
 * @returns {boolean} true if this is a legitimate exception
 */
function isGrepException(toolInput) {
    if (!toolInput) return false;
    const targetPath = toolInput.path;
    if (!targetPath) return false;
    // If the path ends with a file extension, it's a specific file
    // Common code file extensions
    if (/\.\w{1,10}$/.test(targetPath) && !/[*?]/.test(targetPath)) {
        return true;
    }
    return false;
}

/**
 * Check if a Bash mkdir targets a temp directory.
 * @param {string} command - The bash command string
 * @returns {boolean} true if this is a temp directory mkdir
 */
function isTempDirMkdir(command) {
    if (!command) return false;
    // Check for common temp directory patterns
    return /\bmkdir\b.*(?:\/tmp\/|\/var\/folders\/|\$TMPDIR|\$\{TMPDIR\}|%TEMP%)/i.test(command);
}

/**
 * Check if a Bash command is a mkdir command.
 * @param {string} command - The bash command string
 * @returns {boolean}
 */
function isMkdirCommand(command) {
    if (!command) return false;
    return /^\s*mkdir\b/.test(command);
}

// ---------------------------------------------------------------------------
// Core check function
// ---------------------------------------------------------------------------

/**
 * Find the matching routing rule for the given tool invocation.
 * @param {object} input - Hook input: { tool_name, tool_input }
 * @param {object} config - Parsed routing config
 * @returns {object|null} The matched rule, or null
 */
function findMatchingRule(input, config) {
    if (!input || !config || !Array.isArray(config.rules)) return null;

    const toolName = input.tool_name;
    const toolInput = input.tool_input || {};

    for (const rule of config.rules) {
        if (!rule || !rule.tool || !rule.mcp_tool) continue;

        if (rule.tool !== toolName) continue;

        // Bash rules: check command_pattern
        if (rule.tool === 'Bash') {
            const command = toolInput.command || '';
            if (rule.command_pattern) {
                const pattern = new RegExp(rule.command_pattern);
                if (!pattern.test(command)) continue;
            }
            // Check temp dir exception for mkdir
            if (rule.exceptions && rule.exceptions.temp_directory && isTempDirMkdir(command)) {
                continue;
            }
            return rule;
        }

        // Read rules: check exceptions
        if (rule.tool === 'Read') {
            // Partial read / PDF exception
            if (rule.exceptions && (rule.exceptions.partial_read || rule.exceptions.pdf_read)) {
                if (isReadException(toolInput)) continue;
            }
            // Single-file exception (for bulk_read rule)
            if (rule.exceptions && rule.exceptions.single_file) {
                // Single file reads are always exempt from bulk routing
                continue;
            }
            return rule;
        }

        // Grep rules: check specific-file exception
        if (rule.tool === 'Grep') {
            if (rule.exceptions && rule.exceptions.specific_file && isGrepException(toolInput)) {
                continue;
            }
            return rule;
        }

        // Write rules: single-file exception
        if (rule.tool === 'Write') {
            if (rule.exceptions && rule.exceptions.single_file) {
                // Single file writes are always exempt from bulk routing
                continue;
            }
            return rule;
        }

        // Default: tool name matches, no special conditions
        return rule;
    }

    return null;
}

/**
 * Dispatcher-compatible check function.
 * @param {object} ctx - { input, state, manifest, requirements, workflows }
 * @returns {{ decision: string, stopReason?: string, stderr?: string }}
 */
function check(ctx) {
    try {
        const input = ctx && ctx.input;
        if (!input || !input.tool_name) {
            return { decision: 'allow' };
        }

        // Load config (fail-open on missing/malformed)
        const projectDir = process.env.CLAUDE_PROJECT_DIR || undefined;
        const config = loadRoutingConfig(projectDir);
        if (!config) {
            return { decision: 'allow' };
        }

        // Find matching rule
        const rule = findMatchingRule(input, config);
        if (!rule) {
            return { decision: 'allow' };
        }

        // Determine enforcement level
        const enforcement = rule.enforcement || config.default_enforcement || 'warn';

        // Check MCP availability (fail-open: if unavailable, allow through)
        if (!isMcpToolAvailable(rule.mcp_tool, projectDir)) {
            return { decision: 'allow' };
        }

        // Apply enforcement
        if (enforcement === 'allow') {
            return { decision: 'allow' };
        }

        const suggestion = `Consider using \`${rule.mcp_tool}\` instead of \`${input.tool_name}\` for ${rule.operation || 'this operation'}.` +
            (rule.description ? ` ${rule.description}.` : '');

        if (enforcement === 'warn') {
            return {
                decision: 'allow',
                stderr: `MCP_TOOL_ROUTER WARNING: ${suggestion}`
            };
        }

        if (enforcement === 'block') {
            return {
                decision: 'block',
                stopReason:
                    `MCP TOOL ROUTING: A higher-fidelity MCP tool is available for this operation.\n\n` +
                    `Blocked tool: ${input.tool_name}\n` +
                    `Preferred MCP tool: ${rule.mcp_tool}\n\n` +
                    `${suggestion}\n\n` +
                    `If this is a legitimate use of ${input.tool_name} (e.g., edit prep, targeted search), ` +
                    `provide more specific parameters to bypass this check.`
            };
        }

        // Unknown enforcement level: fail-open
        return { decision: 'allow' };
    } catch (error) {
        // Fail-open on any error (Article X: Fail-Safe Defaults)
        return { decision: 'allow' };
    }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    check,
    loadRoutingConfig,
    clearConfigCache,
    isMcpToolAvailable,
    isReadException,
    isGrepException,
    isTempDirMkdir,
    isMkdirCommand,
    findMatchingRule
};

// ---------------------------------------------------------------------------
// Standalone execution (PreToolUse hook protocol)
// ---------------------------------------------------------------------------

if (require.main === module) {
    const { readStdin, outputBlockResponse, debugLog } = require('./lib/common.cjs');

    (async () => {
        try {
            const inputStr = await readStdin();
            if (!inputStr || !inputStr.trim()) { process.exit(0); }

            let input;
            try { input = JSON.parse(inputStr); } catch (e) { process.exit(0); }

            if (!input || !input.tool_name) { process.exit(0); }

            const ctx = { input };
            const result = check(ctx);

            if (result.stderr) {
                console.error(result.stderr);
            }

            if (result.decision === 'block' && result.stopReason) {
                outputBlockResponse(result.stopReason);
            }

            process.exit(0);
        } catch (e) {
            // Fail-open: exit cleanly on any unhandled error
            debugLog('Error in mcp-tool-router:', e.message);
            process.exit(0);
        }
    })();
}
