/**
 * Tests for phase-loop-controller.cjs hook
 * Traces to: FR-01, AC-01, AC-01a-c, NFR-01
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const HOOK_PATH = path.join(__dirname, '..', 'phase-loop-controller.cjs');

function setupTestEnv() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-loop-test-'));
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
                    SKILL_VALIDATOR_DEBUG: '0'
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

function makeDelegationStdin(prompt) {
    return {
        tool_name: 'Task',
        tool_input: {
            subagent_type: '',
            prompt: prompt || 'delegate to 06-implementation agent'
        }
    };
}

describe('phase-loop-controller hook', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = setupTestEnv();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // T1: Blocks delegation when phase status not set
    it('blocks when phase status is not set', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' },
            phases: {}
        });
        const result = runHook(tmpDir, makeDelegationStdin());
        assert.equal(result.exitCode, 0);
        assert.ok(result.stdout.length > 0, 'Should produce block output');
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.continue, false);
        assert.ok(parsed.stopReason.includes('PHASE DELEGATION WITHOUT PROGRESS TRACKING'));
    });

    // T2: Blocks when phase status is 'pending'
    it('blocks when phase status is pending', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' },
            phases: { '06-implementation': { status: 'pending' } }
        });
        const result = runHook(tmpDir, makeDelegationStdin());
        assert.equal(result.exitCode, 0);
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.continue, false);
    });

    // T3: Allows when phase status is in_progress
    it('allows when phase status is in_progress', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' },
            phases: { '06-implementation': { status: 'in_progress' } }
        });
        const result = runHook(tmpDir, makeDelegationStdin());
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T4: Allows when phase status is completed
    it('allows when phase status is completed', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' },
            phases: { '06-implementation': { status: 'completed' } }
        });
        const result = runHook(tmpDir, makeDelegationStdin());
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T5: Allows non-delegation Task calls
    it('allows non-delegation Task calls', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' },
            phases: {}
        });
        const result = runHook(tmpDir, {
            tool_name: 'Task',
            tool_input: { subagent_type: '', prompt: 'do general work' }
        });
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T6: Allows non-Task tool calls
    it('allows non-Task tool calls', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' },
            phases: {}
        });
        const result = runHook(tmpDir, {
            tool_name: 'Bash',
            tool_input: { command: 'ls' }
        });
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T7: Allows when no active_workflow
    it('allows when no active_workflow', () => {
        writeState(tmpDir, {});
        const result = runHook(tmpDir, makeDelegationStdin());
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T8: Allows setup commands (discover in prompt)
    it('allows setup commands in prompt', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' },
            phases: {}
        });
        const result = runHook(tmpDir, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'discover-orchestrator',
                prompt: 'discover the project'
            }
        });
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T9: Fail-open on missing state.json
    it('fail-open on missing state.json', () => {
        fs.rmSync(path.join(tmpDir, '.isdlc', 'state.json'), { force: true });
        const result = runHook(tmpDir, makeDelegationStdin());
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T10: Fail-open on empty stdin
    it('fail-open on empty stdin', () => {
        const result = runHook(tmpDir, '');
        assert.equal(result.exitCode, 0);
    });

    // T11: Fail-open on invalid JSON
    it('fail-open on invalid JSON stdin', () => {
        const result = runHook(tmpDir, 'not json');
        assert.equal(result.exitCode, 0);
    });

    // T12: Block message includes agent and phase info
    it('block message includes phase info', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' },
            phases: {}
        });
        const result = runHook(tmpDir, makeDelegationStdin());
        const parsed = JSON.parse(result.stdout);
        assert.ok(parsed.stopReason.includes('06-implementation'));
        assert.ok(parsed.stopReason.includes('not set'));
    });
});
