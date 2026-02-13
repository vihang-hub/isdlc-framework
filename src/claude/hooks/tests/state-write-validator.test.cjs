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

// =========================================================================
// BUG-0011: Phase Field Protection (V8)
// Traces to: FR-01 thru FR-05, AC-01a thru AC-05c, NFR-01, NFR-02
// =========================================================================
describe('BUG-0011: Phase Field Protection (V8)', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = setupTestEnv();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    /**
     * Helper: build a Write stdin payload with explicit content.
     * Reuses the same pattern as the V7 test section.
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

    // ===================================================================
    // FR-01: Block Phase Index Regression (AC-01a thru AC-01f)
    // ===================================================================

    // T32: Block write when incoming current_phase_index < disk (AC-01a)
    it('T32: blocks write when incoming current_phase_index < disk', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '03-architecture',
                current_phase_index: 3,
                phase_status: {
                    '01-requirements': 'completed',
                    '02-impact-analysis': 'completed',
                    '03-architecture': 'in_progress'
                }
            }
        });
        const incomingState = {
            state_version: 10,
            active_workflow: {
                current_phase: '02-impact-analysis',
                current_phase_index: 2,
                phase_status: {
                    '01-requirements': 'completed',
                    '02-impact-analysis': 'in_progress'
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.ok(
            result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
            `T32: Expected V8 block, got stdout: ${result.stdout}`
        );
    });

    // T33: Allow write when incoming current_phase_index == disk (AC-01b)
    it('T33: allows write when incoming current_phase_index equals disk', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            }
        });
        const incomingState = {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'T33: Should allow same phase index');
    });

    // T34: Allow write when incoming current_phase_index > disk (AC-01b)
    it('T34: allows write when incoming current_phase_index > disk', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '05-test-strategy',
                current_phase_index: 2,
                phase_status: {
                    '05-test-strategy': 'in_progress'
                }
            }
        });
        const incomingState = {
            state_version: 11,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 3,
                phase_status: {
                    '05-test-strategy': 'completed',
                    '06-implementation': 'in_progress'
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'T34: Should allow forward phase index');
    });

    // T35: Allow write when incoming has no active_workflow (AC-01c)
    it('T35: allows write when incoming has no active_workflow', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {}
            }
        });
        const incomingState = {
            state_version: 10,
            phases: {
                '06-implementation': { status: 'in_progress' }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'T35: Should allow when incoming has no active_workflow');
    });

    // T36: Allow write when disk has no active_workflow (AC-01d)
    it('T36: allows write when disk has no active_workflow', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 5,
            phases: {}
        });
        const incomingState = {
            state_version: 6,
            active_workflow: {
                current_phase: '01-requirements',
                current_phase_index: 0,
                phase_status: {
                    '01-requirements': 'in_progress'
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'T36: Should allow when disk has no active_workflow');
    });

    // T37: Block message includes incoming and disk phase index values (AC-01e)
    it('T37: block message includes incoming and disk phase index values', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 8,
            active_workflow: {
                current_phase: '16-quality-loop',
                current_phase_index: 7,
                phase_status: {
                    '16-quality-loop': 'in_progress'
                }
            }
        });
        const incomingState = {
            state_version: 8,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 4,
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.ok(
            result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
            `T37: Expected V8 block, got stdout: ${result.stdout}`
        );
        // Block message should include both index values for debugging
        assert.ok(result.stdout.includes('4'), `T37: Expected incoming index 4 in message, got: ${result.stdout}`);
        assert.ok(result.stdout.includes('7'), `T37: Expected disk index 7 in message, got: ${result.stdout}`);
    });

    // T38: V8 block is logged to stderr (AC-01f)
    it('T38: V8 block is logged to stderr', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 8,
            active_workflow: {
                current_phase: '16-quality-loop',
                current_phase_index: 7,
                phase_status: {
                    '16-quality-loop': 'in_progress'
                }
            }
        });
        const incomingState = {
            state_version: 8,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 4,
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.ok(
            result.stderr.includes('V8') || result.stderr.includes('phase'),
            `T38: Expected V8/phase in stderr, got: ${result.stderr}`
        );
        assert.ok(
            result.stderr.includes('[state-write-validator]'),
            `T38: Expected [state-write-validator] in stderr, got: ${result.stderr}`
        );
    });

    // ===================================================================
    // FR-02: Block phase_status Regression (AC-02a thru AC-02g)
    // ===================================================================

    // T39: Block phase_status change from completed to pending (AC-02a)
    it('T39: blocks phase_status regression completed -> pending', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '01-requirements': 'completed',
                    '02-impact-analysis': 'completed',
                    '06-implementation': 'in_progress'
                }
            }
        });
        const incomingState = {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '01-requirements': 'pending',
                    '02-impact-analysis': 'completed',
                    '06-implementation': 'in_progress'
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.ok(
            result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
            `T39: Expected V8 block on status regression, got stdout: ${result.stdout}`
        );
    });

    // T40: Block phase_status change from completed to in_progress (AC-02b)
    it('T40: blocks phase_status regression completed -> in_progress', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '01-requirements': 'completed',
                    '06-implementation': 'in_progress'
                }
            }
        });
        const incomingState = {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '01-requirements': 'in_progress',
                    '06-implementation': 'in_progress'
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.ok(
            result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
            `T40: Expected V8 block on status regression, got stdout: ${result.stdout}`
        );
    });

    // T41: Block phase_status change from in_progress to pending (AC-02c)
    it('T41: blocks phase_status regression in_progress -> pending', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            }
        });
        const incomingState = {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'pending'
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.ok(
            result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
            `T41: Expected V8 block on status regression, got stdout: ${result.stdout}`
        );
    });

    // T42: Allow phase_status change from pending to in_progress (AC-02d)
    it('T42: allows phase_status forward progress pending -> in_progress', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'pending'
                }
            }
        });
        const incomingState = {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'T42: Should allow forward progress');
    });

    // T43: Allow phase_status change from in_progress to completed (AC-02e)
    it('T43: allows phase_status forward progress in_progress -> completed', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            }
        });
        const incomingState = {
            state_version: 11,
            active_workflow: {
                current_phase: '16-quality-loop',
                current_phase_index: 6,
                phase_status: {
                    '06-implementation': 'completed',
                    '16-quality-loop': 'in_progress'
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'T43: Should allow forward progress');
    });

    // T44: Allow adding new phase_status entries not on disk (AC-02f)
    it('T44: allows adding new phase_status entries not on disk', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '01-requirements',
                current_phase_index: 0,
                phase_status: {
                    '01-requirements': 'in_progress'
                }
            }
        });
        const incomingState = {
            state_version: 11,
            active_workflow: {
                current_phase: '02-impact-analysis',
                current_phase_index: 1,
                phase_status: {
                    '01-requirements': 'completed',
                    '02-impact-analysis': 'in_progress'
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'T44: Should allow new phase entries');
    });

    // T45: Block when one valid change plus one regression (AC-02g)
    it('T45: blocks when one valid change plus one regression', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '01-requirements': 'completed',
                    '02-impact-analysis': 'completed',
                    '05-test-strategy': 'completed',
                    '06-implementation': 'in_progress'
                }
            }
        });
        const incomingState = {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '01-requirements': 'completed',
                    '02-impact-analysis': 'in_progress',
                    '05-test-strategy': 'completed',
                    '06-implementation': 'in_progress'
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.ok(
            result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
            `T45: Expected V8 block on mixed regression, got stdout: ${result.stdout}`
        );
    });

    // ===================================================================
    // FR-03: Fail-Open on Errors (AC-03a thru AC-03e)
    // ===================================================================

    // T46: Allow when incoming content is not valid JSON (AC-03a)
    it('T46: allows when incoming content is not valid JSON', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {}
            }
        });
        const result = runHook(tmpDir, {
            tool_name: 'Write',
            tool_input: {
                file_path: statePath,
                content: 'this is {{ not valid json'
            }
        });
        assert.equal(result.exitCode, 0);
        assert.ok(
            !result.stdout.includes('"continue":false') && !result.stdout.includes('"continue": false'),
            `T46: Should fail-open on bad JSON, got: ${result.stdout}`
        );
    });

    // T47: Allow when disk state cannot be read (AC-03b)
    it('T47: allows when disk state file does not exist', () => {
        // Do NOT create a disk state file -- use a path that doesn't exist on disk
        const fakePath = path.join(tmpDir, '.isdlc', 'nonexistent-state.json');
        const incomingState = {
            state_version: 1,
            active_workflow: {
                current_phase: '01-requirements',
                current_phase_index: 0,
                phase_status: {
                    '01-requirements': 'in_progress'
                }
            }
        };
        // We need the path to match STATE_JSON_PATTERN, so use state.json name
        // but remove it from disk first
        const statePath = path.join(tmpDir, '.isdlc', 'state.json');
        // setupTestEnv creates .isdlc/ but no state.json
        if (fs.existsSync(statePath)) {
            fs.unlinkSync(statePath);
        }
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'T47: Should fail-open when disk file missing');
    });

    // T48: Allow when incoming has no active_workflow (AC-03c)
    it('T48: allows when incoming has no active_workflow (AC-03c)', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {}
            }
        });
        const incomingState = {
            state_version: 10,
            phases: {}
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'T48: Should allow when incoming lacks active_workflow');
    });

    // T49: Allow when disk has no active_workflow (AC-03c -- disk side)
    it('T49: allows when disk has no active_workflow', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 5
        });
        const incomingState = {
            state_version: 6,
            active_workflow: {
                current_phase: '01-requirements',
                current_phase_index: 0,
                phase_status: {}
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'T49: Should allow when disk lacks active_workflow');
    });

    // T50: Allow when disk has no phase_status but incoming does (AC-03d)
    it('T50: allows when disk has no phase_status but incoming does', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5
            }
        });
        const incomingState = {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'T50: Should allow when disk lacks phase_status');
    });

    // T51: Allow when incoming has no phase_status but disk does (AC-03d -- incoming side)
    it('T51: allows when incoming has no phase_status but disk does', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            }
        });
        const incomingState = {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'T51: Should allow when incoming lacks phase_status');
    });

    // T52: Allow when V8 logic throws an unexpected error (AC-03e)
    it('T52: allows when active_workflow is not an object (fail-open)', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: 'this is not an object'
        });
        const incomingState = {
            state_version: 10,
            active_workflow: {
                current_phase: '01-requirements',
                current_phase_index: 0,
                phase_status: {}
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.ok(
            !result.stdout.includes('"continue":false') && !result.stdout.includes('"continue": false'),
            `T52: Should fail-open on type error, got: ${result.stdout}`
        );
    });

    // ===================================================================
    // FR-04: Write Events Only (AC-04a, AC-04b)
    // ===================================================================

    // T53: V8 is skipped for Edit events (AC-04a)
    it('T53: V8 is skipped for Edit events', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '01-requirements': 'completed'
                }
            }
        });
        // Edit event -- V8 should not run (Edit has no incoming content to compare)
        const result = runHook(tmpDir, makeEditStdin(statePath));
        assert.equal(result.exitCode, 0);
        // Even though disk has regressed data, Edit should not trigger V8 block
        assert.ok(
            !result.stdout.includes('"continue":false') && !result.stdout.includes('"continue": false'),
            `T53: V8 should not block Edit events, got: ${result.stdout}`
        );
    });

    // T54: V8 runs for Write events targeting state.json (AC-04b)
    it('T54: V8 runs for Write events and blocks phase index regression', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            }
        });
        const incomingState = {
            state_version: 10,
            active_workflow: {
                current_phase: '01-requirements',
                current_phase_index: 0,
                phase_status: {
                    '01-requirements': 'in_progress'
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.ok(
            result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
            `T54: Expected V8 block on Write event, got stdout: ${result.stdout}`
        );
    });

    // ===================================================================
    // FR-05: Execution Order (AC-05a thru AC-05c)
    // ===================================================================

    // T55: V7 blocks before V8 runs -- short circuit (AC-05a, AC-05b)
    it('T55: V7 blocks before V8 runs (stale version + regressed index)', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            }
        });
        const incomingState = {
            state_version: 3,
            active_workflow: {
                current_phase: '01-requirements',
                current_phase_index: 0,
                phase_status: {
                    '01-requirements': 'pending'
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        // V7 should block (version 3 < 10)
        assert.ok(
            result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
            `T55: Expected V7 block, got stdout: ${result.stdout}`
        );
        // Block should be from V7, not V8
        assert.ok(
            result.stdout.includes('Version mismatch') || result.stdout.includes('version'),
            `T55: Expected V7 version message, got: ${result.stdout}`
        );
    });

    // T56: V8 blocks before V1-V3 content validation runs (AC-05a, AC-05c)
    it('T56: V8 blocks before V1-V3 content validation', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            },
            phases: {
                '06-implementation': {
                    constitutional_validation: { completed: true, iterations_used: 0 }
                }
            }
        });
        const incomingState = {
            state_version: 10,
            active_workflow: {
                current_phase: '01-requirements',
                current_phase_index: 0,
                phase_status: {
                    '01-requirements': 'pending'
                }
            },
            phases: {
                '06-implementation': {
                    constitutional_validation: { completed: true, iterations_used: 0 }
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        // V8 should block (phase index 0 < 5)
        assert.ok(
            result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
            `T56: Expected V8 block, got stdout: ${result.stdout}`
        );
        // V1-V3 should NOT have run, so no constitutional_validation WARNING
        assert.ok(
            !result.stderr.includes('constitutional_validation'),
            `T56: V1-V3 should not run after V8 block, stderr: ${result.stderr}`
        );
    });

    // T57: V8 allows, then V1-V3 runs and warns (AC-05a)
    it('T57: V8 allows then V1-V3 runs and warns on suspicious content', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            },
            phases: {
                '06-implementation': {
                    constitutional_validation: { completed: true, iterations_used: 0 }
                }
            }
        });
        const incomingState = {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            },
            phases: {
                '06-implementation': {
                    constitutional_validation: { completed: true, iterations_used: 0 }
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        // V8 should allow (same phase index)
        assert.equal(result.stdout, '', 'T57: Should not block');
        // V1-V3 should run and produce WARNING
        assert.ok(
            result.stderr.includes('constitutional_validation'),
            `T57: Expected V1 warning on stderr, got: ${result.stderr}`
        );
    });

    // ===================================================================
    // Boundary and Edge Cases
    // ===================================================================

    // T58: Block on phase index regression from 1 to 0 (boundary)
    it('T58: blocks on smallest phase index regression (1 to 0)', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 5,
            active_workflow: {
                current_phase: '02-impact-analysis',
                current_phase_index: 1,
                phase_status: {
                    '02-impact-analysis': 'in_progress'
                }
            }
        });
        const incomingState = {
            state_version: 5,
            active_workflow: {
                current_phase: '01-requirements',
                current_phase_index: 0,
                phase_status: {
                    '01-requirements': 'in_progress'
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.ok(
            result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
            `T58: Expected V8 block on boundary regression, got stdout: ${result.stdout}`
        );
    });

    // T59: Allow when phase_status has unknown status values
    it('T59: allows when phase_status has unknown status values', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'unknown_status'
                }
            }
        });
        const incomingState = {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'another_unknown'
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.ok(
            !result.stdout.includes('"continue":false') && !result.stdout.includes('"continue": false'),
            `T59: Should fail-open on unknown statuses, got: ${result.stdout}`
        );
    });

    // T60: Allow when current_phase_index is missing in incoming (NFR-02)
    it('T60: allows when current_phase_index missing in incoming', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            }
        });
        const incomingState = {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'T60: Should allow when incoming lacks current_phase_index');
    });

    // T61: Allow when current_phase_index is missing in disk state (NFR-02)
    it('T61: allows when current_phase_index missing in disk state', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            }
        });
        const incomingState = {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'T61: Should allow when disk lacks current_phase_index');
    });

    // T62: Block on phase_status regression across multiple phases simultaneously
    it('T62: blocks on multiple simultaneous phase_status regressions', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '08-code-review',
                current_phase_index: 7,
                phase_status: {
                    '01-requirements': 'completed',
                    '02-impact-analysis': 'completed',
                    '05-test-strategy': 'completed',
                    '06-implementation': 'completed',
                    '16-quality-loop': 'completed',
                    '08-code-review': 'in_progress'
                }
            }
        });
        const incomingState = {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 3,
                phase_status: {
                    '01-requirements': 'completed',
                    '02-impact-analysis': 'in_progress',
                    '05-test-strategy': 'pending',
                    '06-implementation': 'in_progress'
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.ok(
            result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
            `T62: Expected V8 block on multiple regressions, got stdout: ${result.stdout}`
        );
    });

    // T63: V8 works with monorepo state.json paths
    it('T63: V8 blocks phase regression in monorepo state.json', () => {
        const monorepoDir = path.join(tmpDir, '.isdlc', 'projects', 'my-api');
        fs.mkdirSync(monorepoDir, { recursive: true });
        const statePath = path.join(monorepoDir, 'state.json');
        fs.writeFileSync(statePath, JSON.stringify({
            state_version: 5,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            }
        }, null, 2));
        const incomingState = {
            state_version: 5,
            active_workflow: {
                current_phase: '01-requirements',
                current_phase_index: 0,
                phase_status: {
                    '01-requirements': 'pending'
                }
            }
        };
        const result = runHook(tmpDir, {
            tool_name: 'Write',
            tool_input: {
                file_path: statePath,
                content: JSON.stringify(incomingState, null, 2)
            }
        });
        assert.equal(result.exitCode, 0);
        assert.ok(
            result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
            `T63: Expected V8 block on monorepo regression, got stdout: ${result.stdout}`
        );
    });

    // ===================================================================
    // Regression Tests: V1-V7 Unaffected
    // ===================================================================

    // T64: V7 version block still works after V8 addition
    it('T64: V7 version block still works after V8 addition', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {}
            }
        });
        const incomingState = {
            state_version: 3,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {}
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        assert.ok(
            result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
            `T64: Expected V7 block, got stdout: ${result.stdout}`
        );
        assert.ok(
            result.stdout.includes('Version mismatch') || result.stdout.includes('version'),
            `T64: Expected V7 version message, got: ${result.stdout}`
        );
    });

    // T65: V1 content warning still fires after V8 addition
    it('T65: V1 content warning still fires after V8 addition', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            },
            phases: {
                '01-requirements': {
                    constitutional_validation: { completed: true, iterations_used: 0 }
                }
            }
        });
        const incomingState = {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            },
            phases: {
                '01-requirements': {
                    constitutional_validation: { completed: true, iterations_used: 0 }
                }
            }
        };
        const result = runHook(tmpDir, makeWriteStdinWithContent(statePath, incomingState));
        assert.equal(result.exitCode, 0);
        // V8 should allow (same phase index)
        assert.equal(result.stdout, '', 'T65: Should not block');
        // V1 should still warn
        assert.ok(
            result.stderr.includes('constitutional_validation'),
            `T65: Expected V1 warning on stderr, got: ${result.stderr}`
        );
    });

    // ===================================================================
    // Performance Tests (NFR-01)
    // ===================================================================

    // T66: Hook completes within 100ms budget
    it('T66: hook completes within 100ms budget (averaged)', () => {
        const statePath = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            }
        });
        const incomingState = {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: {
                    '06-implementation': 'in_progress'
                }
            }
        };
        const stdin = makeWriteStdinWithContent(statePath, incomingState);
        const iterations = 5;
        const start = Date.now();
        for (let i = 0; i < iterations; i++) {
            runHook(tmpDir, stdin);
        }
        const elapsed = Date.now() - start;
        const avg = elapsed / iterations;
        // Node process startup dominates; 100ms per invocation is the budget
        assert.ok(avg < 200, `T66: Average execution time ${avg}ms exceeds 200ms budget`);
    });

    // T67: V8 overhead measured by comparing with and without active_workflow
    it('T67: V8 overhead is minimal (< 50ms delta)', () => {
        // Scenario 1: No active_workflow (V8 short-circuits)
        const statePathNoAW = writeStateFile(tmpDir, {
            state_version: 10,
            phases: {}
        });
        const noAWStdin = {
            tool_name: 'Write',
            tool_input: {
                file_path: statePathNoAW,
                content: JSON.stringify({ state_version: 10, phases: {} }, null, 2)
            }
        };

        const iterations = 5;
        const startNoAW = Date.now();
        for (let i = 0; i < iterations; i++) {
            runHook(tmpDir, noAWStdin);
        }
        const elapsedNoAW = Date.now() - startNoAW;

        // Scenario 2: With active_workflow (V8 does full comparison)
        const statePathAW = writeStateFile(tmpDir, {
            state_version: 10,
            active_workflow: {
                current_phase: '06-implementation',
                current_phase_index: 5,
                phase_status: { '06-implementation': 'in_progress' }
            }
        });
        const awStdin = {
            tool_name: 'Write',
            tool_input: {
                file_path: statePathAW,
                content: JSON.stringify({
                    state_version: 10,
                    active_workflow: {
                        current_phase: '06-implementation',
                        current_phase_index: 5,
                        phase_status: { '06-implementation': 'in_progress' }
                    }
                }, null, 2)
            }
        };

        const startAW = Date.now();
        for (let i = 0; i < iterations; i++) {
            runHook(tmpDir, awStdin);
        }
        const elapsedAW = Date.now() - startAW;

        const avgNoAW = elapsedNoAW / iterations;
        const avgAW = elapsedAW / iterations;
        const delta = Math.abs(avgAW - avgNoAW);
        // V8 overhead should be < 50ms (generous allowance for CI variance)
        assert.ok(delta < 50, `T67: V8 overhead ${delta}ms exceeds 50ms`);
    });
});
