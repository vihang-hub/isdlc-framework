#!/usr/bin/env node
'use strict';
/**
 * iSDLC State File Guard - PreToolUse[Bash] Dispatched Hook
 * ==========================================================
 * Blocks Bash commands that attempt to write directly to state.json,
 * bypassing the hook enforcement system.
 *
 * Detection logic:
 *   1. commandTargetsStateJson(command) — regex for .isdlc/...state.json
 *   2. isWriteCommand(command) — detects write operators/commands
 *   3. Only blocks when BOTH match (read-only like `cat state.json` is allowed)
 *
 * Performance budget: < 50ms (regex only, no I/O)
 * Fail-open: empty/missing input → allow
 *
 * Version: 1.0.0
 */

const {
    STATE_JSON_PATTERN,
    debugLog,
    logHookEvent
} = require('./lib/common.cjs');

/**
 * Pattern to detect state.json references in a bash command string.
 * Matches both forward and backward slashes, with optional quoting.
 * @type {RegExp}
 */
const STATE_JSON_CMD_PATTERN = /\.isdlc[/\\](?:projects[/\\][^/\\\s"']+[/\\])?state\.json/;

/**
 * Patterns that indicate a write operation in a bash command.
 * These are checked against the full command string.
 * @type {RegExp[]}
 */
const WRITE_PATTERNS = [
    />\s*/,           // redirect: > or >>
    /\btee\b/,        // tee command
    /\bwriteFileSync\b/,   // Node.js fs.writeFileSync
    /\bwriteFile\b/,       // Node.js fs.writeFile
    /\bnode\s+-e\b/,       // node -e (inline script)
    /\bnode\s+--eval\b/,   // node --eval
    /\bpython3?\s+-c\b/,   // python -c (inline script)
    /\bruby\s+-e\b/,       // ruby -e
    /\bperl\s+-e\b/,       // perl -e
    /\bsed\s+-i\b/,        // sed in-place
    /\bsed\s+--in-place\b/,
    /\bawk\s+-i\b/,        // awk in-place
];

/**
 * Patterns for commands that move/copy files TO state.json.
 * These need the state.json reference to appear as the target (last arg).
 * @type {RegExp[]}
 */
const MOVE_COPY_PATTERNS = [
    /\bmv\b.*state\.json\s*$/,
    /\bcp\b.*state\.json\s*$/,
    /\binstall\b.*state\.json\s*$/,
];

/**
 * Check if a bash command references a state.json file.
 * @param {string} command - The bash command string
 * @returns {boolean}
 */
function commandTargetsStateJson(command) {
    if (!command) return false;
    return STATE_JSON_CMD_PATTERN.test(command);
}

/**
 * Check if a bash command contains write operations.
 * @param {string} command - The bash command string
 * @returns {boolean}
 */
function isWriteCommand(command) {
    if (!command) return false;

    // Check standard write patterns
    for (const pattern of WRITE_PATTERNS) {
        if (pattern.test(command)) return true;
    }

    // Check move/copy to state.json
    for (const pattern of MOVE_COPY_PATTERNS) {
        if (pattern.test(command)) return true;
    }

    return false;
}

/**
 * Dispatcher-compatible check function.
 * @param {object} ctx - { input, state, manifest, requirements, workflows }
 * @returns {{ decision: string, stopReason?: string }}
 */
function check(ctx) {
    try {
        const input = ctx.input;
        if (!input) {
            return { decision: 'allow' };
        }

        if (input.tool_name !== 'Bash') {
            return { decision: 'allow' };
        }

        const command = (input.tool_input && input.tool_input.command) || '';
        if (!command) {
            return { decision: 'allow' };
        }

        // Both conditions must be true to block
        if (!commandTargetsStateJson(command)) {
            return { decision: 'allow' };
        }

        if (!isWriteCommand(command)) {
            // Read-only command targeting state.json is fine
            debugLog('state-file-guard: read-only state.json access allowed:', command);
            return { decision: 'allow' };
        }

        // Block: bash command is writing to state.json
        logHookEvent('state-file-guard', 'block', {
            reason: `Bash write to state.json blocked: ${command.substring(0, 100)}`
        });

        return {
            decision: 'block',
            stopReason:
                `BASH STATE GUARD: Direct writes to state.json via Bash are not permitted.\n\n` +
                `Blocked command: ${command.substring(0, 200)}\n\n` +
                `state.json is managed by iSDLC hooks and must only be modified through ` +
                `the Write or Edit tools (which are validated by state-write-validator).\n\n` +
                `If you need to update state, use the Write tool to write the complete ` +
                `state.json file, or use the Edit tool to modify specific fields.`
        };
    } catch (error) {
        debugLog('Error in state-file-guard:', error.message);
        return { decision: 'allow' };
    }
}

module.exports = { check, commandTargetsStateJson, isWriteCommand };

// Standalone execution
if (require.main === module) {
    const { readStdin, readState, loadManifest, loadIterationRequirements, loadWorkflowDefinitions, outputBlockResponse } = require('./lib/common.cjs');

    (async () => {
        try {
            const inputStr = await readStdin();
            if (!inputStr || !inputStr.trim()) { process.exit(0); }
            let input;
            try { input = JSON.parse(inputStr); } catch (e) { process.exit(0); }

            const state = readState();
            const manifest = loadManifest();
            const requirements = loadIterationRequirements();
            const workflows = loadWorkflowDefinitions();
            const ctx = { input, state, manifest, requirements, workflows };

            const result = check(ctx);

            if (result.stderr) console.error(result.stderr);
            if (result.stdout) console.log(result.stdout);
            if (result.decision === 'block' && result.stopReason) {
                outputBlockResponse(result.stopReason);
            }
            process.exit(0);
        } catch (e) { process.exit(0); }
    })();
}
