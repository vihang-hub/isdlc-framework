#!/usr/bin/env node
/**
 * iSDLC Branch Guard - PreToolUse[Bash] Hook
 * ============================================
 * Blocks git commits to main/master when an active workflow has a
 * feature branch. Also blocks commits on the workflow's feature/bugfix
 * branch during intermediate phases (before the final phase completes).
 * Ensures commits represent validated, reviewed work.
 *
 * Phase-aware blocking (BUG-0012):
 *   - Commits on the workflow branch are BLOCKED during all phases except the last
 *   - Commits on the workflow branch are ALLOWED during the final phase (e.g., finalize)
 *   - Commits on non-workflow branches are always ALLOWED (fail-open)
 *   - Missing current_phase or phases array triggers fail-open
 *
 * Performance budget: < 200ms (includes git subprocess)
 * Fail-open: any error results in silent exit (exit 0, no output)
 *
 * Traces to: FR-04, AC-04, AC-04a-e, BUG-0012 FR-01 through FR-05, AC-07 through AC-20
 * Branch existence verification (BUG-0015):
 *   - Before blocking commits to main, verify the workflow branch exists in git
 *   - If the branch was already deleted (post-merge, pre-finalize), allow the commit
 *   - Uses `git rev-parse --verify refs/heads/{branch}` for verification
 *   - Fail-open on any git error
 *
 * Version: 2.1.0
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

/**
 * Verify that a branch exists in the local git repository.
 * Uses `git rev-parse --verify refs/heads/{name}` which exits 0 if the ref exists.
 * @param {string} branchName - The branch name to verify
 * @returns {boolean} true if the branch exists, false otherwise
 */
function branchExistsInGit(branchName) {
    try {
        execSync(`git rev-parse --verify refs/heads/${branchName}`, {
            encoding: 'utf8',
            timeout: 3000,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        return true;
    } catch (e) {
        debugLog('Branch does not exist or git failed:', branchName, e.message);
        return false;
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

        // BUG-0015: Verify the workflow branch actually exists in git.
        // After merge + branch deletion, state.json may still show status='active'
        // until the orchestrator finalizes. In this window, allow commits.
        const workflowBranchName = gitBranch.name || '';
        if (workflowBranchName && !branchExistsInGit(workflowBranchName)) {
            debugLog('Workflow branch no longer exists in git, allowing (fail-open):', workflowBranchName);
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

        // Phase-aware commit blocking on feature/bugfix branches (BUG-0012)
        // Only apply phase blocking if the current branch matches the workflow branch.
        // If on a different branch (e.g., hotfix/urgent), allow unconditionally.
        if (currentBranch !== workflowBranchName) {
            debugLog('Current branch does not match workflow branch, allowing');
            process.exit(0);
        }

        // On the workflow branch: check if the current phase allows commits.
        // Fail-open if current_phase or phases array is missing.
        const currentPhase = state.active_workflow.current_phase;
        const phases = state.active_workflow.phases;

        if (!currentPhase || !Array.isArray(phases) || phases.length === 0) {
            debugLog('Missing current_phase or phases array, allowing (fail-open)');
            process.exit(0);
        }

        // Commits are ALLOWED only during the final phase of the workflow.
        // The final phase is typically 08-code-review or finalize -- the last
        // element in the phases array. All earlier phases are blocked because
        // the code has not yet passed quality-loop and code-review validation.
        const lastPhase = phases[phases.length - 1];
        if (currentPhase === lastPhase) {
            debugLog(`Current phase '${currentPhase}' is the final phase, allowing commit`);
            process.exit(0);
        }

        // Block: we are on the workflow branch during an intermediate phase.
        logHookEvent('branch-guard', 'block', {
            reason: `Commit blocked during phase '${currentPhase}' on branch '${currentBranch}'`
        });
        outputBlockResponse(
            `COMMIT BLOCKED (Phase: ${currentPhase}): Commits are not allowed ` +
            `on the workflow branch during intermediate phases.\n\n` +
            `The current phase '${currentPhase}' has not yet passed quality-loop ` +
            `and code-review validation. Committing now would create unvalidated ` +
            `snapshots in version control.\n\n` +
            `What to do instead:\n` +
            `- Leave changes on the working tree (they will be committed by the orchestrator at workflow finalize)\n` +
            `- If you need to save work temporarily, use: git stash\n` +
            `- The orchestrator handles git add, commit, and merge at the appropriate time\n\n` +
            `Current phase:  ${currentPhase}\n` +
            `Current branch: ${currentBranch}\n` +
            `Final phase:    ${lastPhase}`
        );
        process.exit(0);

    } catch (error) {
        debugLog('Error in branch-guard:', error.message);
        process.exit(0);
    }
}

main();
