/**
 * Tests for walkthrough-tracker.cjs hook
 * Traces to: FR-06, AC-06, AC-06a-c, NFR-01
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const HOOK_PATH = path.join(__dirname, '..', 'walkthrough-tracker.cjs');

function setupTestEnv() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'walkthrough-test-'));
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

function makeDiscoverTaskStdin(hasResult) {
    const base = {
        tool_name: 'Task',
        tool_input: { subagent_type: 'discover-orchestrator' }
    };
    if (hasResult) {
        base.tool_result = 'Discovery completed successfully';
    }
    return base;
}

describe('walkthrough-tracker hook', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = setupTestEnv();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // T1: Warns when discover completes without walkthrough
    it('warns when discover completes without walkthrough', () => {
        writeState(tmpDir, {
            discovery_context: { walkthrough_completed: false }
        });
        const result = runHook(tmpDir, makeDiscoverTaskStdin(true));
        assert.equal(result.stdout, '', 'Should NEVER produce stdout');
        assert.ok(result.stderr.includes('[walkthrough-tracker] WARNING'));
        assert.ok(result.stderr.includes('constitution walkthrough'));
    });

    // T2: Warns when walkthrough_completed is missing
    it('warns when walkthrough_completed is undefined', () => {
        writeState(tmpDir, {
            discovery_context: {}
        });
        const result = runHook(tmpDir, makeDiscoverTaskStdin(true));
        assert.equal(result.stdout, '');
        assert.ok(result.stderr.includes('[walkthrough-tracker] WARNING'));
    });

    // T3: Silent when walkthrough completed
    it('silent when walkthrough_completed is true', () => {
        writeState(tmpDir, {
            discovery_context: { walkthrough_completed: true }
        });
        const result = runHook(tmpDir, makeDiscoverTaskStdin(true));
        assert.equal(result.stdout, '');
        assert.ok(!result.stderr.includes('[walkthrough-tracker] WARNING'));
    });

    // T4: Silent when no discovery_context
    it('silent when no discovery_context in state', () => {
        writeState(tmpDir, {});
        const result = runHook(tmpDir, makeDiscoverTaskStdin(true));
        assert.equal(result.stdout, '');
        assert.ok(!result.stderr.includes('[walkthrough-tracker] WARNING'));
    });

    // T5: Silent when no tool_result (task not complete)
    it('silent when no tool_result', () => {
        writeState(tmpDir, {
            discovery_context: { walkthrough_completed: false }
        });
        const result = runHook(tmpDir, makeDiscoverTaskStdin(false));
        assert.equal(result.stdout, '');
        assert.ok(!result.stderr.includes('[walkthrough-tracker] WARNING'));
    });

    // T6: Silent for non-discover tasks
    it('silent for non-discover tasks', () => {
        writeState(tmpDir, {
            discovery_context: { walkthrough_completed: false }
        });
        const result = runHook(tmpDir, {
            tool_name: 'Task',
            tool_input: { subagent_type: 'software-developer' },
            tool_result: 'done'
        });
        assert.equal(result.stdout, '');
        assert.ok(!result.stderr.includes('[walkthrough-tracker] WARNING'));
    });

    // T7: Silent for non-Task tools
    it('silent for non-Task tools', () => {
        const result = runHook(tmpDir, {
            tool_name: 'Bash',
            tool_input: { command: 'ls' }
        });
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T8: Fail-open on missing state.json
    it('fail-open on missing state.json', () => {
        fs.rmSync(path.join(tmpDir, '.isdlc', 'state.json'), { force: true });
        const result = runHook(tmpDir, makeDiscoverTaskStdin(true));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T9: Fail-open on empty stdin
    it('fail-open on empty stdin', () => {
        const result = runHook(tmpDir, '');
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T10: Fail-open on invalid JSON
    it('fail-open on invalid JSON', () => {
        const result = runHook(tmpDir, 'not json');
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });
});
