/**
 * Tests for phase-sequence-guard.cjs hook
 * Traces to: FR-03, AC-03, AC-03a-d, NFR-01
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const HOOK_PATH = path.join(__dirname, '..', 'phase-sequence-guard.cjs');

function setupTestEnv() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-seq-test-'));
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

function makeDelegationStdin(targetPhase) {
    return {
        tool_name: 'Task',
        tool_input: {
            subagent_type: '',
            prompt: `delegate to ${targetPhase} agent`
        }
    };
}

describe('phase-sequence-guard hook', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = setupTestEnv();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // T1: Allows delegation to current phase
    it('allows delegation to current phase', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' }
        });
        const result = runHook(tmpDir, makeDelegationStdin('06-implementation'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T2: Blocks delegation to different phase (skipping ahead)
    it('blocks delegation to different phase', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '03-architecture' }
        });
        const result = runHook(tmpDir, makeDelegationStdin('06-implementation'));
        assert.equal(result.exitCode, 0);
        assert.ok(result.stdout.length > 0, 'Should produce block output');
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.continue, false);
        assert.ok(parsed.stopReason.includes('OUT-OF-ORDER PHASE DELEGATION'));
    });

    // T3: Blocks delegation to earlier phase (going backward)
    it('blocks delegation to earlier phase', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' }
        });
        const result = runHook(tmpDir, makeDelegationStdin('01-requirements'));
        assert.equal(result.exitCode, 0);
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.continue, false);
        assert.ok(parsed.stopReason.includes('OUT-OF-ORDER'));
    });

    // T4: Allows non-delegation Task calls
    it('allows non-delegation Task calls', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' }
        });
        const result = runHook(tmpDir, {
            tool_name: 'Task',
            tool_input: { subagent_type: '', prompt: 'do some general work' }
        });
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T5: Allows non-Task tool calls
    it('allows non-Task tool calls', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' }
        });
        const result = runHook(tmpDir, {
            tool_name: 'Bash',
            tool_input: { command: 'ls' }
        });
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T6: Allows when no active_workflow
    it('allows when no active_workflow', () => {
        writeState(tmpDir, {});
        const result = runHook(tmpDir, makeDelegationStdin('06-implementation'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T7: Allows setup commands (discover in prompt)
    it('allows setup commands in prompt', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' }
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

    // T8: Fail-open on missing state.json
    it('fail-open on missing state.json', () => {
        fs.rmSync(path.join(tmpDir, '.isdlc', 'state.json'), { force: true });
        const result = runHook(tmpDir, makeDelegationStdin('06-implementation'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T9: Fail-open on empty stdin
    it('fail-open on empty stdin', () => {
        const result = runHook(tmpDir, '');
        assert.equal(result.exitCode, 0);
    });

    // T10: Fail-open on invalid JSON
    it('fail-open on invalid JSON', () => {
        const result = runHook(tmpDir, 'not json');
        assert.equal(result.exitCode, 0);
    });

    // T11: Block message includes both phases
    it('block message includes current and target phases', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '03-architecture' }
        });
        const result = runHook(tmpDir, makeDelegationStdin('06-implementation'));
        const parsed = JSON.parse(result.stdout);
        assert.ok(parsed.stopReason.includes('03-architecture'));
        assert.ok(parsed.stopReason.includes('06-implementation'));
        assert.ok(parsed.stopReason.includes('GATE-03'));
    });

    // T12: Allows when no current_phase set
    it('allows when no current_phase set', () => {
        writeState(tmpDir, {
            active_workflow: {}
        });
        const result = runHook(tmpDir, makeDelegationStdin('06-implementation'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });
});
