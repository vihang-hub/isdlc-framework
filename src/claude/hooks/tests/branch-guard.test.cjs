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
