/**
 * Tests for state-write-validator.cjs hook
 * Traces to: FR-05, AC-05, AC-05a-e, NFR-01
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const HOOK_PATH = path.join(__dirname, '..', 'state-write-validator.cjs');

function setupTestEnv() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-write-test-'));
    const isdlcDir = path.join(tmpDir, '.isdlc');
    fs.mkdirSync(isdlcDir, { recursive: true });
    return tmpDir;
}

function writeStateFile(tmpDir, state) {
    const statePath = path.join(tmpDir, '.isdlc', 'state.json');
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    return statePath;
}

function runHook(tmpDir, stdinJson) {
    const stdinStr = typeof stdinJson === 'string'
        ? stdinJson
        : JSON.stringify(stdinJson);
    const result = spawnSync('node', [HOOK_PATH], {
        input: stdinStr,
        cwd: tmpDir,
        env: {
            ...process.env,
            CLAUDE_PROJECT_DIR: tmpDir,
            SKILL_VALIDATOR_DEBUG: 'true'
        },
        encoding: 'utf8',
        timeout: 5000
    });
    return {
        stdout: (result.stdout || '').trim(),
        stderr: (result.stderr || '').trim(),
        exitCode: result.status || 0
    };
}

function makeWriteStdin(filePath) {
    return {
        tool_name: 'Write',
        tool_input: { file_path: filePath }
    };
}

function makeEditStdin(filePath) {
    return {
        tool_name: 'Edit',
        tool_input: { file_path: filePath }
    };
}

describe('state-write-validator hook', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = setupTestEnv();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // T1: No stdout on valid state write
    it('produces no stdout for valid state.json write', () => {
        const statePath = writeStateFile(tmpDir, {
            phases: {
                '01-requirements': {
                    constitutional_validation: { completed: true, iterations_used: 2 }
                }
            }
        });
        const result = runHook(tmpDir, makeWriteStdin(statePath));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should NEVER produce stdout');
    });

    // T2: Warns on fake constitutional validation (completed but 0 iterations)
    it('warns on fake constitutional validation', () => {
        const statePath = writeStateFile(tmpDir, {
            phases: {
                '01-requirements': {
                    constitutional_validation: { completed: true, iterations_used: 0 }
                }
            }
        });
        const result = runHook(tmpDir, makeWriteStdin(statePath));
        assert.equal(result.stdout, '', 'Should NEVER produce stdout');
        assert.ok(result.stderr.includes('[state-write-validator] WARNING'), 'Should warn on stderr');
        assert.ok(result.stderr.includes('constitutional_validation'));
    });

    // T3: Warns on fake constitutional validation (completed, missing iterations_used)
    it('warns when constitutional_validation completed but iterations_used missing', () => {
        const statePath = writeStateFile(tmpDir, {
            phases: {
                '03-architecture': {
                    constitutional_validation: { completed: true }
                }
            }
        });
        const result = runHook(tmpDir, makeWriteStdin(statePath));
        assert.equal(result.stdout, '');
        assert.ok(result.stderr.includes('WARNING'));
        assert.ok(result.stderr.includes('iterations_used is undefined'));
    });

    // T4: Warns on fake interactive elicitation
    it('warns on fake interactive elicitation', () => {
        const statePath = writeStateFile(tmpDir, {
            phases: {
                '01-requirements': {
                    iteration_requirements: {
                        interactive_elicitation: { completed: true, menu_interactions: 0 }
                    }
                }
            }
        });
        const result = runHook(tmpDir, makeWriteStdin(statePath));
        assert.equal(result.stdout, '');
        assert.ok(result.stderr.includes('interactive_elicitation'));
    });

    // T5: Warns on fake test iteration
    it('warns on fake test iteration', () => {
        const statePath = writeStateFile(tmpDir, {
            phases: {
                '06-implementation': {
                    iteration_requirements: {
                        test_iteration: { completed: true, current_iteration: 0 }
                    }
                }
            }
        });
        const result = runHook(tmpDir, makeWriteStdin(statePath));
        assert.equal(result.stdout, '');
        assert.ok(result.stderr.includes('test_iteration'));
    });

    // T6: Silent for valid elicitation and test data
    it('silent for valid iteration data', () => {
        const statePath = writeStateFile(tmpDir, {
            phases: {
                '01-requirements': {
                    constitutional_validation: { completed: true, iterations_used: 3 },
                    iteration_requirements: {
                        interactive_elicitation: { completed: true, menu_interactions: 5 },
                        test_iteration: { completed: true, current_iteration: 2 }
                    }
                }
            }
        });
        const result = runHook(tmpDir, makeWriteStdin(statePath));
        assert.equal(result.stdout, '');
        // stderr may contain debug logs but should not contain WARNING
        assert.ok(!result.stderr.includes('[state-write-validator] WARNING'));
    });

    // T7: Silent for incomplete validations (completed: false)
    it('silent when completed is false', () => {
        const statePath = writeStateFile(tmpDir, {
            phases: {
                '01-requirements': {
                    constitutional_validation: { completed: false, iterations_used: 0 }
                }
            }
        });
        const result = runHook(tmpDir, makeWriteStdin(statePath));
        assert.equal(result.stdout, '');
        assert.ok(!result.stderr.includes('[state-write-validator] WARNING'));
    });

    // T8: Silent for non-state.json file writes
    it('silent for non-state.json writes', () => {
        const result = runHook(tmpDir, makeWriteStdin('/tmp/some-other-file.json'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T9: Works with Edit tool
    it('validates on Edit tool calls too', () => {
        const statePath = writeStateFile(tmpDir, {
            phases: {
                '01-requirements': {
                    constitutional_validation: { completed: true, iterations_used: 0 }
                }
            }
        });
        const result = runHook(tmpDir, makeEditStdin(statePath));
        assert.equal(result.stdout, '');
        assert.ok(result.stderr.includes('WARNING'));
    });

    // T10: Silent for non-Write/Edit tools
    it('silent for non-Write/Edit tools', () => {
        const result = runHook(tmpDir, {
            tool_name: 'Bash',
            tool_input: { command: 'cat .isdlc/state.json' }
        });
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T11: Fail-open on empty stdin
    it('fail-open on empty stdin', () => {
        const result = runHook(tmpDir, '');
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T12: Fail-open on invalid JSON stdin
    it('fail-open on invalid JSON stdin', () => {
        const result = runHook(tmpDir, 'not json');
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T13: Fail-open when state.json file cannot be read
    it('fail-open when state.json file does not exist on disk', () => {
        const fakePath = path.join(tmpDir, '.isdlc', 'nonexistent-state.json');
        const result = runHook(tmpDir, makeWriteStdin(fakePath));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T14: Handles monorepo state.json paths
    it('detects monorepo state.json path pattern', () => {
        const monorepoDir = path.join(tmpDir, '.isdlc', 'projects', 'my-project');
        fs.mkdirSync(monorepoDir, { recursive: true });
        const statePath = path.join(monorepoDir, 'state.json');
        fs.writeFileSync(statePath, JSON.stringify({
            phases: {
                '01-requirements': {
                    constitutional_validation: { completed: true, iterations_used: 0 }
                }
            }
        }, null, 2));
        const result = runHook(tmpDir, makeWriteStdin(statePath));
        assert.equal(result.stdout, '');
        assert.ok(result.stderr.includes('WARNING'));
    });

    // T15: No phases in state means no warnings
    it('silent when no phases in state', () => {
        const statePath = writeStateFile(tmpDir, { active_workflow: {} });
        const result = runHook(tmpDir, makeWriteStdin(statePath));
        assert.equal(result.stdout, '');
        assert.ok(!result.stderr.includes('[state-write-validator] WARNING'));
    });
});
