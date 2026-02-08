#!/usr/bin/env node
/**
 * iSDLC Review Reminder - PostToolUse[Bash] Hook
 * ================================================
 * Displays a reminder when code_review is disabled but team_size > 1.
 * Triggers only on `git commit` commands.
 *
 * Performance budget: < 100ms
 * Fail-open: any error results in silent exit (exit 0, no output)
 *
 * Version: 1.0.0
 */

const {
    readStdin,
    readCodeReviewConfig,
    debugLog
} = require('./lib/common.cjs');

async function main() {
    try {
        const input = await readStdin();
        if (!input) return;

        let parsed;
        try {
            parsed = JSON.parse(input);
        } catch (e) {
            return; // Invalid stdin — fail-open
        }

        // Only trigger on git commit commands
        const command = parsed?.tool_input?.command || '';
        if (!isGitCommit(command)) return;

        // Read code review configuration
        const config = readCodeReviewConfig();

        // Only warn if disabled AND team > 1
        if (!config.enabled && config.team_size > 1) {
            const message = 'Manual code review is currently bypassed. ' +
                'If your team has grown beyond 1 developer, consider enabling it ' +
                'by setting code_review.enabled to true in .isdlc/state.json.';
            console.log(JSON.stringify({ warning: message }));
        }
    } catch (e) {
        debugLog('review-reminder error:', e.message);
        // Fail-open: exit silently
    }
}

/**
 * Check if a command is a git commit variant
 * @param {string} command - The bash command string
 * @returns {boolean}
 */
function isGitCommit(command) {
    return /\bgit\s+commit\b/.test(command);
}

main();
