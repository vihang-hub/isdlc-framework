#!/usr/bin/env node
/**
 * iSDLC Branch Guard - PreToolUse[Bash] Hook
 * ============================================
 * Blocks git commits to main/master when an active workflow has a
 * feature branch. Ensures commits go to the correct branch.
 *
 * Performance budget: < 200ms (includes git subprocess)
 * Fail-open: any error results in silent exit (exit 0, no output)
 *
 * Traces to: FR-04, AC-04, AC-04a, AC-04b, AC-04c, AC-04d, AC-04e
 * Version: 1.0.0
 */

const {
    readStdin,
    readState,
    outputBlockResponse,
    debugLog,
    logHookEvent
} = require('./lib/common.cjs');

const { execSync } = require('child_process');

/**
 * Detect if a bash command contains a git commit operation.
 * @param {string} command - The bash command string
 * @returns {boolean}
 */
function isGitCommit(command) {
    if (!command) return false;
    return /\bgit\s+commit\b/.test(command);
}

/**
 * Get the current git branch name via git rev-parse.
 * @returns {string|null} Branch name or null on failure
 */
function getCurrentBranch() {
    try {
        return execSync('git rev-parse --abbrev-ref HEAD', {
            encoding: 'utf8',
            timeout: 3000,
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
    } catch (e) {
        debugLog('git rev-parse failed:', e.message);
        return null;
    }
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

        if (input.tool_name !== 'Bash') {
            process.exit(0);
        }

        const command = (input.tool_input && input.tool_input.command) || '';

        // Only check git commit commands
        if (!isGitCommit(command)) {
            process.exit(0);
        }

        debugLog('Git commit detected in command:', command);

        // Read state
        const state = readState();
        if (!state) {
            debugLog('No state.json, allowing (fail-open)');
            process.exit(0);
        }

        if (!state.active_workflow) {
            debugLog('No active workflow, allowing');
            process.exit(0);
        }

        const gitBranch = state.active_workflow.git_branch;
        if (!gitBranch || gitBranch.status !== 'active') {
            debugLog('No active git_branch in workflow, allowing');
            process.exit(0);
        }

        // Get current branch from git
        const currentBranch = getCurrentBranch();
        if (!currentBranch) {
            debugLog('Could not determine current branch, allowing (fail-open)');
            process.exit(0);
        }

        debugLog('Current branch:', currentBranch);

        // Block commits to main/master
        if (currentBranch === 'main' || currentBranch === 'master') {
            const expectedBranch = gitBranch.name || 'feature branch';
            logHookEvent('branch-guard', 'block', {
                reason: `Commit to '${currentBranch}' blocked, expected branch '${expectedBranch}'`
            });
            outputBlockResponse(
                `COMMIT TO MAIN BLOCKED: You are attempting to commit to ` +
                `'${currentBranch}' while an active workflow has a feature ` +
                `branch '${expectedBranch}'.\n\n` +
                `During an active workflow, all commits should go to the feature ` +
                `branch to keep main/master clean until the work is reviewed ` +
                `and merged.\n\n` +
                `To fix this:\n` +
                `1. Switch to the feature branch: git checkout ${expectedBranch}\n` +
                `2. Then commit your changes there\n\n` +
                `Current branch:  ${currentBranch}\n` +
                `Expected branch: ${expectedBranch}`
            );
            process.exit(0);
        }

        // On feature branch or other branch, allow
        debugLog('Not on main/master, allowing');
        process.exit(0);

    } catch (error) {
        debugLog('Error in branch-guard:', error.message);
        process.exit(0);
    }
}

main();
