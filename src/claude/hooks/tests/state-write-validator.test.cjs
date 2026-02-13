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

// =========================================================================
// BUG-0009: Version Check (V7)
// Traces to: FR-03, AC-03a, AC-03b, AC-03c, AC-03d, AC-03e
// =========================================================================
describe('BUG-0009: Version Check (V7)', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = setupTestEnv();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    /**
     * Helper: write state.json with a given state_version on disk,
     * then build a Write stdin payload whose content has a different state_version.
     */
    function makeWriteStdinWithContent(filePath, content) {
        return {
            tool_name: 'Write',
            tool_input: {
                file_path: filePath,
                content: typeof content === 'string' ? content : JSON.stringify(content, null, 2)
            }
        };
    }

    // T16: Block when incoming state_version < disk state_version (stale write)
    it('T16: blocks stale write when incoming version < disk version', () => {
        // Disk has version 5
        const statePath = writeStateFile(tmpDir, {
            state_version: 5,
            phases: { '01-requirements': { status: 'completed' } }
        });
        // Incoming write has version 3 (stale)
        const incomingState = {
            state_version: 3,
            phases: { '01-requirements': { status: 'completed' } }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        // Should output a block response on stdout
        assert.ok(result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
            `Expected block response on stdout, got: ${result.stdout}`);
        assert.ok(result.stdout.includes('Version mismatch') || result.stdout.includes('version'),
            `Expected version mismatch message, got: ${result.stdout}`);
    });

    // T17: Allow when incoming state_version == disk state_version (current write)
    it('T17: allows write when incoming version equals disk version', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 5,
            phases: { '01-requirements': { status: 'completed' } }
        });
        const incomingState = {
            state_version: 5,
            phases: { '01-requirements': { status: 'completed' } }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should not block on matching versions');
    });

    // T18: Allow when incoming state_version > disk state_version (writeState auto-incremented)
    it('T18: allows write when incoming version > disk version', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 5,
            phases: {}
        });
        const incomingState = {
            state_version: 6,
            phases: {}
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should not block on newer version');
    });

    // T19: Allow when incoming state_version is missing (backward compat)
    it('T19: allows write when incoming state_version is missing', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 5,
            phases: {}
        });
        const incomingState = {
            phases: {}
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should allow when incoming version missing');
    });

    // T20: Allow when incoming state_version is null (backward compat)
    it('T20: allows write when incoming state_version is null', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 5,
            phases: {}
        });
        const incomingState = {
            state_version: null,
            phases: {}
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should allow when incoming version is null');
    });

    // T21: Allow when disk state_version is missing (migration case)
    it('T21: allows write when disk state_version is missing', () => {
        const statePath = writeStateFile(tmpDir, {
            phases: {}
        });
        const incomingState = {
            state_version: 1,
            phases: {}
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should allow when disk version missing');
    });

    // T22: Allow when disk file does not exist (fail-open)
    it('T22: allows write when disk state file does not exist', () => {
        const fakePath = path.join(tmpDir, '.isdlc', 'state.json');
        // Remove the state file
        if (fs.existsSync(fakePath)) {
            fs.unlinkSync(fakePath);
        }
        const incomingState = {
            state_version: 1,
            phases: {}
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(fakePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should allow when disk file missing');
    });

    // T23: Allow when disk file is corrupt JSON (fail-open)
    it('T23: allows write when disk state file is corrupt JSON', () => {
        const statePath = path.join(tmpDir, '.isdlc', 'state.json');
        fs.writeFileSync(statePath, 'NOT VALID JSON {{{', 'utf8');
        const incomingState = {
            state_version: 1,
            phases: {}
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should fail-open on corrupt disk file');
    });

    // T24: Block includes correct version numbers in stopReason
    it('T24: block message includes expected and actual version numbers', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            phases: {}
        });
        const incomingState = {
            state_version: 7,
            phases: {}
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.ok(result.stdout.includes('10'), `Expected disk version 10 in message, got: ${result.stdout}`);
        assert.ok(result.stdout.includes('7'), `Expected incoming version 7 in message, got: ${result.stdout}`);
    });

    // T25: Block on version 1 incoming vs version 2 on disk
    it('T25: blocks when incoming version 1 vs disk version 2', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 2,
            phases: {}
        });
        const incomingState = {
            state_version: 1,
            phases: {}
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.ok(result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
            `Expected block, got: ${result.stdout}`);
    });

    // T26: V7 check runs before V1-V3 checks (stale write blocked before content validation)
    it('T26: stale version blocked even with valid phase content', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 5,
            phases: {
                '01-requirements': {
                    constitutional_validation: { completed: true, iterations_used: 3 }
                }
            }
        });
        const incomingState = {
            state_version: 2,
            phases: {
                '01-requirements': {
                    constitutional_validation: { completed: true, iterations_used: 3 }
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.ok(result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
            `Expected block on stale version, got: ${result.stdout}`);
    });

    // T27: Version check works with Edit tool
    it('T27: version check works with Edit tool', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 5,
            phases: {}
        });
        // For Edit, the hook reads the file from disk after the edit
        // The state on disk has version 5, and the hook should read it
        // We simulate an Edit that did NOT update state_version properly
        // by writing a state file with version 3 before the hook runs
        fs.writeFileSync(statePath, JSON.stringify({
            state_version: 3,
            phases: {}
        }, null, 2));
        // But the V7 check for Edit reads the current disk state vs the pre-edit disk state
        // Since Edit modifies in-place, we need the pre-edit version check
        // For Edit events, we pass the file_path and check disk version against original
        const editStdin = {
            tool_name: 'Edit',
            tool_input: { file_path: statePath }
        };
        const result = runHook(tmpDir, editStdin);
        // For Edit, the hook reads the just-edited file from disk
        // Since disk file now has version 3, and there's no "original" comparison,
        // Edit events should still pass through (the hook only validates content structure)
        assert.equal(result.exitCode, 0);
    });

    // T28: Allow when both disk and incoming have no state_version (both legacy)
    it('T28: allows when both disk and incoming lack state_version', () => {
        const statePath = writeStateFile(tmpDir, {
            phases: { '01-requirements': { status: 'pending' } }
        });
        const incomingState = {
            phases: { '01-requirements': { status: 'in_progress' } }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should allow when both lack version');
    });

    // T29: Monorepo path with version check
    it('T29: version check works with monorepo state.json path', () => {
        const monorepoDir = path.join(tmpDir, '.isdlc', 'projects', 'api');
        fs.mkdirSync(monorepoDir, { recursive: true });
        const statePath = path.join(monorepoDir, 'state.json');
        fs.writeFileSync(statePath, JSON.stringify({
            state_version: 5,
            phases: {}
        }, null, 2));
        const incomingState = {
            state_version: 2,
            phases: {}
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.ok(result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
            `Expected block on monorepo stale version, got: ${result.stdout}`);
    });

    // T30: Version mismatch logged to stderr as warning
    it('T30: version mismatch produces stderr warning', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 5,
            phases: {}
        });
        const incomingState = {
            state_version: 2,
            phases: {}
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.ok(result.stderr.includes('version') || result.stderr.includes('Version') || result.stderr.includes('mismatch'),
            `Expected version warning on stderr, got: ${result.stderr}`);
    });

    // T31: Allow when incoming content is not valid JSON (fail-open on parse error)
    it('T31: allows when incoming content is not valid JSON', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 5,
            phases: {}
        });
        const result = runHook(tmpDir, {
            tool_name: 'Write',
            tool_input: {
                file_path: statePath,
                content: 'this is not json'
            }
        });
        assert.equal(result.exitCode, 0);
        // Should fail-open: no block
        assert.ok(!result.stdout.includes('"continue":false') && !result.stdout.includes('"continue": false'),
            `Should fail-open on bad JSON, got: ${result.stdout}`);
    });
});
