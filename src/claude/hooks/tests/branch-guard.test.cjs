/**
 * Tests for branch-guard.cjs hook
 * Traces to: FR-04, AC-04, AC-04a-e, NFR-01
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const HOOK_PATH = path.join(__dirname, '..', 'branch-guard.cjs');

function setupTestEnv() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'branch-guard-test-'));
    const isdlcDir = path.join(tmpDir, '.isdlc');
    fs.mkdirSync(isdlcDir, { recursive: true });
    return tmpDir;
}

function writeState(tmpDir, state) {
    fs.writeFileSync(
        path.join(tmpDir, '.isdlc', 'state.json'),
        JSON.stringify(state, null, 2)
    );
}

function setupGitRepo(tmpDir, branchName) {
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
    // Create initial commit on main
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test');
    execSync('git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
    if (branchName && branchName !== 'main') {
        execSync(`git checkout -b ${branchName}`, { cwd: tmpDir, stdio: 'pipe' });
    }
}

function runHook(tmpDir, stdinJson) {
    const stdinStr = typeof stdinJson === 'string'
        ? stdinJson
        : JSON.stringify(stdinJson);
    try {
        const result = execSync(
            `echo '${stdinStr.replace(/'/g, "\\'")}' | node "${HOOK_PATH}"`,
            {
                cwd: tmpDir,
                env: {
                    ...process.env,
                    CLAUDE_PROJECT_DIR: tmpDir,
                    SKILL_VALIDATOR_DEBUG: '0',
                    PATH: process.env.PATH
                },
                encoding: 'utf8',
                timeout: 5000
            }
        );
        return { stdout: result.trim(), exitCode: 0 };
    } catch (e) {
        return {
            stdout: (e.stdout || '').trim(),
            stderr: (e.stderr || '').trim(),
            exitCode: e.status || 1
        };
    }
}

function makeStdin(command) {
    return {
        tool_name: 'Bash',
        tool_input: { command }
    };
}

describe('branch-guard hook', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = setupTestEnv();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // T1: Blocks git commit on main when workflow has active feature branch
    it('blocks git commit on main with active workflow branch', () => {
        setupGitRepo(tmpDir, 'main');
        // BUG-0015: Must create the branch in git so existence check passes
        execSync('git checkout -b feature/test-branch', { cwd: tmpDir, stdio: 'pipe' });
        execSync('git checkout main', { cwd: tmpDir, stdio: 'pipe' });
        writeState(tmpDir, {
            active_workflow: {
                type: 'feature',
                git_branch: { name: 'feature/test-branch', status: 'active' }
            }
        });
        const result = runHook(tmpDir, makeStdin('git commit -m "feat: add feature"'));
        assert.equal(result.exitCode, 0);
        assert.ok(result.stdout.length > 0, 'Should produce block output');
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.continue, false);
        assert.ok(parsed.stopReason.includes('COMMIT TO MAIN BLOCKED'));
    });

    // T2: Blocks git commit on master
    it('blocks git commit on master with active workflow branch', () => {
        setupGitRepo(tmpDir, 'main');
        // BUG-0015: Create the branch first so existence check passes
        execSync('git checkout -b feature/test', { cwd: tmpDir, stdio: 'pipe' });
        execSync('git checkout main', { cwd: tmpDir, stdio: 'pipe' });
        // Rename main to master
        execSync('git branch -m main master', { cwd: tmpDir, stdio: 'pipe' });
        writeState(tmpDir, {
            active_workflow: {
                type: 'feature',
                git_branch: { name: 'feature/test', status: 'active' }
            }
        });
        const result = runHook(tmpDir, makeStdin('git commit -m "msg"'));
        assert.equal(result.exitCode, 0);
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.continue, false);
        assert.ok(parsed.stopReason.includes('COMMIT TO MAIN BLOCKED'));
    });

    // T3: Allows git commit on feature branch
    it('allows git commit on feature branch', () => {
        setupGitRepo(tmpDir, 'feature/test-branch');
        writeState(tmpDir, {
            active_workflow: {
                type: 'feature',
                git_branch: { name: 'feature/test-branch', status: 'active' }
            }
        });
        const result = runHook(tmpDir, makeStdin('git commit -m "feat: work"'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should produce no output for feature branch');
    });

    // T4: Allows non-commit git commands
    it('allows git push commands', () => {
        setupGitRepo(tmpDir, 'main');
        writeState(tmpDir, {
            active_workflow: {
                type: 'feature',
                git_branch: { name: 'feature/test', status: 'active' }
            }
        });
        const result = runHook(tmpDir, makeStdin('git push origin main'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should produce no output for git push');
    });

    // T5: Allows when no active_workflow
    it('allows when no active_workflow', () => {
        setupGitRepo(tmpDir, 'main');
        writeState(tmpDir, {});
        const result = runHook(tmpDir, makeStdin('git commit -m "msg"'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T6: Allows when git_branch status is not active
    it('allows when git_branch status is merged', () => {
        setupGitRepo(tmpDir, 'main');
        writeState(tmpDir, {
            active_workflow: {
                type: 'feature',
                git_branch: { name: 'feature/done', status: 'merged' }
            }
        });
        const result = runHook(tmpDir, makeStdin('git commit -m "msg"'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T7: Allows when git_branch is undefined
    it('allows when git_branch is undefined', () => {
        setupGitRepo(tmpDir, 'main');
        writeState(tmpDir, {
            active_workflow: { type: 'feature' }
        });
        const result = runHook(tmpDir, makeStdin('git commit -m "msg"'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T8: Allows non-Bash tool calls
    it('allows non-Bash tool calls', () => {
        writeState(tmpDir, {
            active_workflow: {
                type: 'feature',
                git_branch: { name: 'feature/test', status: 'active' }
            }
        });
        const result = runHook(tmpDir, {
            tool_name: 'Task',
            tool_input: { prompt: 'do something' }
        });
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T9: Detects git commit in chained commands
    it('detects git commit in chained commands', () => {
        setupGitRepo(tmpDir, 'main');
        // BUG-0015: Create the branch so existence check passes
        execSync('git checkout -b feature/test', { cwd: tmpDir, stdio: 'pipe' });
        execSync('git checkout main', { cwd: tmpDir, stdio: 'pipe' });
        writeState(tmpDir, {
            active_workflow: {
                type: 'feature',
                git_branch: { name: 'feature/test', status: 'active' }
            }
        });
        const result = runHook(tmpDir, makeStdin('git add . && git commit -m "msg"'));
        assert.equal(result.exitCode, 0);
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.continue, false);
    });

    // T10: Fail-open when git is unavailable (no .git directory)
    it('fail-open when git rev-parse fails', () => {
        // No git repo initialized
        writeState(tmpDir, {
            active_workflow: {
                type: 'feature',
                git_branch: { name: 'feature/test', status: 'active' }
            }
        });
        const result = runHook(tmpDir, makeStdin('git commit -m "msg"'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should fail-open when git fails');
    });

    // T11: Fail-open on missing state.json
    it('fail-open on missing state.json', () => {
        setupGitRepo(tmpDir, 'main');
        fs.rmSync(path.join(tmpDir, '.isdlc', 'state.json'), { force: true });
        const result = runHook(tmpDir, makeStdin('git commit -m "msg"'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T12: Fail-open on empty stdin
    it('fail-open on empty stdin', () => {
        const result = runHook(tmpDir, '');
        assert.equal(result.exitCode, 0);
    });

    // T13: Fail-open on invalid JSON stdin
    it('fail-open on invalid JSON stdin', () => {
        const result = runHook(tmpDir, 'not json');
        assert.equal(result.exitCode, 0);
    });

    // T14: Block message includes expected branch name
    it('block message includes expected branch name', () => {
        setupGitRepo(tmpDir, 'main');
        // BUG-0015: Create the branch so existence check passes
        execSync('git checkout -b feature/REQ-0004', { cwd: tmpDir, stdio: 'pipe' });
        execSync('git checkout main', { cwd: tmpDir, stdio: 'pipe' });
        writeState(tmpDir, {
            active_workflow: {
                type: 'feature',
                git_branch: { name: 'feature/REQ-0004', status: 'active' }
            }
        });
        const result = runHook(tmpDir, makeStdin('git commit -m "msg"'));
        const parsed = JSON.parse(result.stdout);
        assert.ok(parsed.stopReason.includes('feature/REQ-0004'));
        assert.ok(parsed.stopReason.includes('main'));
    });
});

// =========================================================================
// BUG-0012: Phase-Aware Commit Blocking Tests (T15-T31)
// =========================================================================
// Traces to: BUG-0012 requirements-spec.md (FR-01 through FR-05, AC-01 through AC-20)
// These tests are TDD scaffolds -- they MUST FAIL until branch-guard.cjs is
// enhanced with phase-aware commit blocking logic in Phase 06 (Implementation).
// =========================================================================

/**
 * Helper: create a state.json with a standard workflow and configurable phase.
 * @param {string} currentPhase - The current workflow phase
 * @param {string[]} phases - The workflow phases array
 * @param {string} branchName - The workflow git branch name
 * @param {string} [type='fix'] - Workflow type
 * @returns {object} state object for writeState()
 */
function makeWorkflowState(currentPhase, phases, branchName, type) {
    const state = {
        active_workflow: {
            type: type || 'fix',
            git_branch: { name: branchName, status: 'active' }
        }
    };
    if (currentPhase !== undefined) {
        state.active_workflow.current_phase = currentPhase;
    }
    if (phases !== undefined) {
        state.active_workflow.phases = phases;
    }
    return state;
}

const STANDARD_PHASES = [
    '01-requirements',
    '02-tracing',
    '05-test-strategy',
    '06-implementation',
    '16-quality-loop',
    '08-code-review'
];

describe('branch-guard phase-aware commit blocking (BUG-0012)', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = setupTestEnv();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // T15: Block commit on feature branch during phase 06-implementation
    // Traces to: AC-07, AC-09
    it('T15: blocks commit on feature branch during 06-implementation', () => {
        setupGitRepo(tmpDir, 'feature/REQ-test');
        writeState(tmpDir, makeWorkflowState(
            '06-implementation',
            STANDARD_PHASES,
            'feature/REQ-test',
            'feature'
        ));
        const result = runHook(tmpDir, makeStdin('git commit -m "feat: implement fix"'));
        assert.equal(result.exitCode, 0);
        assert.ok(result.stdout.length > 0, 'Should produce block output on feature branch during implementation');
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.continue, false, 'Commit should be blocked during implementation phase');
    });

    // T16: Block commit on bugfix branch during phase 16-quality-loop
    // Traces to: AC-07, AC-09
    it('T16: blocks commit on bugfix branch during 16-quality-loop', () => {
        setupGitRepo(tmpDir, 'bugfix/BUG-0012-test');
        writeState(tmpDir, makeWorkflowState(
            '16-quality-loop',
            STANDARD_PHASES,
            'bugfix/BUG-0012-test',
            'fix'
        ));
        const result = runHook(tmpDir, makeStdin('git commit -m "fix: quality improvements"'));
        assert.equal(result.exitCode, 0);
        assert.ok(result.stdout.length > 0, 'Should produce block output on bugfix branch during quality-loop');
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.continue, false, 'Commit should be blocked during quality-loop phase');
    });

    // T17: Block commit on feature branch during phase 05-test-strategy
    // Traces to: AC-07, AC-09
    it('T17: blocks commit on feature branch during 05-test-strategy', () => {
        setupGitRepo(tmpDir, 'feature/REQ-test');
        writeState(tmpDir, makeWorkflowState(
            '05-test-strategy',
            STANDARD_PHASES,
            'feature/REQ-test',
            'feature'
        ));
        const result = runHook(tmpDir, makeStdin('git commit -m "test: add test strategy"'));
        assert.equal(result.exitCode, 0);
        assert.ok(result.stdout.length > 0, 'Should produce block output during test-strategy');
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.continue, false, 'Commit should be blocked during test-strategy phase');
    });

    // T18: Allow commit during final phase 08-code-review
    // Traces to: AC-08, AC-10, AC-15, AC-16
    it('T18: allows commit during final phase 08-code-review', () => {
        setupGitRepo(tmpDir, 'feature/REQ-test');
        writeState(tmpDir, makeWorkflowState(
            '08-code-review',
            STANDARD_PHASES,
            'feature/REQ-test',
            'feature'
        ));
        const result = runHook(tmpDir, makeStdin('git commit -m "chore: review artifacts"'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should produce no output during final phase (commit allowed)');
    });

    // T19: Allow commit when no active_workflow on feature branch (fail-open)
    // Traces to: AC-11
    it('T19: allows commit on feature branch when no active_workflow', () => {
        setupGitRepo(tmpDir, 'feature/REQ-test');
        writeState(tmpDir, {});
        const result = runHook(tmpDir, makeStdin('git commit -m "msg"'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should allow when no active workflow (fail-open)');
    });

    // T20: Allow commit on non-workflow branch (hotfix/urgent)
    // Traces to: AC-12
    it('T20: allows commit on non-workflow branch', () => {
        setupGitRepo(tmpDir, 'hotfix/urgent');
        writeState(tmpDir, makeWorkflowState(
            '06-implementation',
            ['01-requirements', '06-implementation', '16-quality-loop', '08-code-review'],
            'feature/REQ-test',
            'feature'
        ));
        const result = runHook(tmpDir, makeStdin('git commit -m "hotfix: urgent"'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should allow on branch that does not match workflow branch');
    });

    // T21: Fail-open when current_phase is missing from state
    // Traces to: AC-14
    it('T21: fail-open when current_phase is missing', () => {
        setupGitRepo(tmpDir, 'feature/REQ-test');
        writeState(tmpDir, makeWorkflowState(
            undefined,  // no current_phase
            ['01-requirements', '06-implementation', '08-code-review'],
            'feature/REQ-test'
        ));
        const result = runHook(tmpDir, makeStdin('git commit -m "msg"'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should fail-open when current_phase is missing');
    });

    // T22: Fail-open when phases array is missing from state
    // Traces to: AC-14
    it('T22: fail-open when phases array is missing', () => {
        setupGitRepo(tmpDir, 'feature/REQ-test');
        writeState(tmpDir, makeWorkflowState(
            '06-implementation',
            undefined,  // no phases array
            'feature/REQ-test'
        ));
        const result = runHook(tmpDir, makeStdin('git commit -m "msg"'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should fail-open when phases array is missing');
    });

    // T23: Allow git add without git commit during blocked phases
    // Traces to: AC-18
    it('T23: allows git add without commit during blocked phases', () => {
        setupGitRepo(tmpDir, 'feature/REQ-test');
        writeState(tmpDir, makeWorkflowState(
            '06-implementation',
            ['01-requirements', '06-implementation', '16-quality-loop', '08-code-review'],
            'feature/REQ-test'
        ));
        const result = runHook(tmpDir, makeStdin('git add -A'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'git add without commit should always be allowed');
    });

    // T24: Block message includes phase name, stash suggestion, orchestrator note
    // Traces to: AC-13, AC-19, AC-20
    it('T24: block message includes phase name, stash suggestion, and orchestrator note', () => {
        setupGitRepo(tmpDir, 'bugfix/BUG-0012-test');
        writeState(tmpDir, makeWorkflowState(
            '06-implementation',
            STANDARD_PHASES,
            'bugfix/BUG-0012-test',
            'fix'
        ));
        const result = runHook(tmpDir, makeStdin('git commit -m "wip"'));
        assert.equal(result.exitCode, 0);
        assert.ok(result.stdout.length > 0, 'Should produce block output');
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.continue, false);
        // AC-13: includes phase name
        assert.ok(
            /implementation|06-implementation/i.test(parsed.stopReason),
            'Block message should reference the current phase'
        );
        // AC-19: suggests git stash
        assert.ok(
            /stash/i.test(parsed.stopReason),
            'Block message should suggest git stash as alternative'
        );
        // AC-20: mentions orchestrator
        assert.ok(
            /orchestrator/i.test(parsed.stopReason),
            'Block message should mention orchestrator handles commits'
        );
    });

    // T25: Allow commit during last phase for non-standard workflow
    // Traces to: AC-15, AC-16
    it('T25: allows commit during last phase of non-standard workflow', () => {
        setupGitRepo(tmpDir, 'feature/REQ-test');
        // Non-standard workflow where quality-loop IS the last phase
        writeState(tmpDir, makeWorkflowState(
            '16-quality-loop',
            ['01-requirements', '06-implementation', '16-quality-loop'],
            'feature/REQ-test',
            'feature'
        ));
        const result = runHook(tmpDir, makeStdin('git commit -m "msg"'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should allow commit during last phase of non-standard workflow');
    });

    // T26: Regression -- still blocks commits to main with phase-aware logic present
    // Traces to: NFR-03
    it('T26: regression - still blocks commits to main when phase-aware logic is present', () => {
        setupGitRepo(tmpDir, 'main');
        // BUG-0015: Create the branch so existence check passes
        execSync('git checkout -b feature/REQ-test', { cwd: tmpDir, stdio: 'pipe' });
        execSync('git checkout main', { cwd: tmpDir, stdio: 'pipe' });
        writeState(tmpDir, makeWorkflowState(
            '06-implementation',
            STANDARD_PHASES,
            'feature/REQ-test',
            'feature'
        ));
        const result = runHook(tmpDir, makeStdin('git commit -m "msg"'));
        assert.equal(result.exitCode, 0);
        assert.ok(result.stdout.length > 0, 'Should produce block output on main');
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.continue, false);
        assert.ok(parsed.stopReason.includes('COMMIT TO MAIN BLOCKED'), 'Existing main protection must still work');
    });
});

describe('branch-guard agent no-commit instructions (BUG-0012)', () => {
    const AGENTS_DIR = path.resolve(__dirname, '..', '..', 'agents');
    const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
    const CLAUDE_MD = path.join(PROJECT_ROOT, 'CLAUDE.md');

    // T27: software-developer agent references Git Commit Prohibition in CLAUDE.md
    // Traces to: AC-01, AC-02 (REQ-0021: extracted to CLAUDE.md)
    it('T27: software-developer agent contains no-commit instruction in prominent position', () => {
        const agentPath = path.join(AGENTS_DIR, '05-software-developer.md');
        const content = fs.readFileSync(agentPath, 'utf8');
        const lines = content.split('\n');

        // AC-01: agent references Git Commit Prohibition (extracted to CLAUDE.md)
        assert.ok(
            /Git Commit Prohibition/i.test(content) || /do\s+not.*git.*commit/i.test(content),
            'Agent must reference Git Commit Prohibition in CLAUDE.md or contain inline instruction'
        );

        // AC-02: reference should appear within first 80 lines (prominent position)
        const first80 = lines.slice(0, 80).join('\n');
        assert.ok(
            /Git Commit Prohibition/i.test(first80) || /do\s+not.*git.*commit/i.test(first80),
            'Git commit prohibition reference must appear within first 80 lines'
        );
    });

    // T28: Agent inline prohibition explains WHY commits are prohibited
    // Traces to: AC-03 (REQ-0021), BUG-0028 (FR-004: inline prohibition replaces dead CLAUDE.md cross-ref)
    it('T28: software-developer agent explains why commits are prohibited', () => {
        const agentPath = path.join(AGENTS_DIR, '05-software-developer.md');
        const agentContent = fs.readFileSync(agentPath, 'utf8');

        // Must reference workflow finalize or orchestrator managing git (inline in agent file per BUG-0028)
        assert.ok(
            /workflow\s+finalize|orchestrator.*manages|branch-guard.*hook/i.test(agentContent),
            'Agent inline prohibition must explain why commits are prohibited'
        );
    });

    // T29: Agent inline prohibition mentions orchestrator manages git
    // Traces to: AC-04 (REQ-0021), BUG-0028 (FR-004: inline prohibition replaces dead CLAUDE.md cross-ref)
    it('T29: software-developer agent mentions orchestrator manages git', () => {
        const agentPath = path.join(AGENTS_DIR, '05-software-developer.md');
        const agentContent = fs.readFileSync(agentPath, 'utf8');

        assert.ok(
            /orchestrator.*git|orchestrator.*commit|orchestrator.*merge/i.test(agentContent),
            'Agent must mention orchestrator manages git operations'
        );
    });

    // T30: quality-loop-engineer agent references Git Commit Prohibition
    // Traces to: AC-05 (REQ-0021: extracted to CLAUDE.md)
    it('T30: quality-loop-engineer agent contains no-commit instruction', () => {
        const agentPath = path.join(AGENTS_DIR, '16-quality-loop-engineer.md');
        const content = fs.readFileSync(agentPath, 'utf8');

        assert.ok(
            /Git Commit Prohibition/i.test(content) || /do\s+not.*git.*commit/i.test(content),
            'Quality-loop agent must reference Git Commit Prohibition in CLAUDE.md or contain inline instruction'
        );
    });

    // T31: Agent inline prohibition explains branch-guard enforcement
    // Traces to: AC-06 (REQ-0021), BUG-0028 (FR-004: inline prohibition replaces dead CLAUDE.md cross-ref)
    it('T31: quality-loop-engineer agent explains branch-guard enforcement', () => {
        const agentPath = path.join(AGENTS_DIR, '16-quality-loop-engineer.md');
        const agentContent = fs.readFileSync(agentPath, 'utf8');

        assert.ok(
            /branch-guard.*hook|workflow\s+finalize|orchestrator.*manages/i.test(agentContent),
            'Agent inline prohibition must explain branch-guard enforcement'
        );
    });
});

// =========================================================================
// BUG-0015: Branch Existence Verification Tests (T32-T35)
// =========================================================================
// Traces to: BUG-0015 requirements-spec.md (FR-01, FR-02, AC-01 through AC-04)
// =========================================================================

describe('branch-guard branch existence check (BUG-0015)', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = setupTestEnv();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // T32: Allow commit to main when workflow branch was already deleted
    // Traces to: AC-01 (BUG-0015)
    it('T32: allows commit to main when workflow branch no longer exists in git', () => {
        setupGitRepo(tmpDir, 'main');
        // State says branch is active, but it does not exist in git
        writeState(tmpDir, {
            active_workflow: {
                type: 'feature',
                git_branch: { name: 'feature/REQ-0099-deleted', status: 'active' }
            }
        });
        const result = runHook(tmpDir, makeStdin('git commit -m "post-merge commit"'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should allow commit when workflow branch does not exist in git');
    });

    // T33: Still block commit to main when workflow branch exists in git
    // Traces to: AC-02 (BUG-0015)
    it('T33: still blocks commit to main when workflow branch exists in git', () => {
        setupGitRepo(tmpDir, 'main');
        // Create the feature branch so it exists in git
        execSync('git checkout -b feature/REQ-0099-exists', { cwd: tmpDir, stdio: 'pipe' });
        execSync('git checkout main', { cwd: tmpDir, stdio: 'pipe' });
        writeState(tmpDir, {
            active_workflow: {
                type: 'feature',
                git_branch: { name: 'feature/REQ-0099-exists', status: 'active' }
            }
        });
        const result = runHook(tmpDir, makeStdin('git commit -m "should be blocked"'));
        assert.equal(result.exitCode, 0);
        assert.ok(result.stdout.length > 0, 'Should produce block output when branch exists');
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.continue, false);
        assert.ok(parsed.stopReason.includes('COMMIT TO MAIN BLOCKED'));
    });

    // T34: Fail-open when git rev-parse --verify fails (not a git repo)
    // Traces to: AC-03 (BUG-0015)
    it('T34: fail-open when branch verification fails in non-git directory', () => {
        // No git repo initialized -- git rev-parse --verify will fail
        writeState(tmpDir, {
            active_workflow: {
                type: 'feature',
                git_branch: { name: 'feature/REQ-test', status: 'active' }
            }
        });
        const result = runHook(tmpDir, makeStdin('git commit -m "msg"'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should fail-open when git verification fails');
    });

    // T35: Allow commit on feature branch when branch exists (phase-aware still applies)
    // Regression test: branch existence check should not interfere with
    // non-main branch logic.
    // Traces to: AC-02 (BUG-0015), regression
    it('T35: branch existence check does not interfere with feature branch commits', () => {
        setupGitRepo(tmpDir, 'feature/REQ-test');
        writeState(tmpDir, {
            active_workflow: {
                type: 'feature',
                git_branch: { name: 'feature/REQ-test', status: 'active' },
                current_phase: '08-code-review',
                phases: ['01-requirements', '06-implementation', '08-code-review']
            }
        });
        const result = runHook(tmpDir, makeStdin('git commit -m "review commit"'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should allow commit on feature branch during final phase');
    });
});
