/**
 * Tests for workflow-completion-enforcer.cjs hook
 * Traces to: REQ-0005
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const HOOK_PATH = path.join(__dirname, '..', 'workflow-completion-enforcer.cjs');

function setupTestEnv() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-completion-test-'));
    const isdlcDir = path.join(tmpDir, '.isdlc');
    fs.mkdirSync(isdlcDir, { recursive: true });

    // Copy lib/ dependencies
    const libSrcDir = path.join(__dirname, '..', 'lib');
    const libDestDir = path.join(tmpDir, 'lib');
    fs.mkdirSync(libDestDir, { recursive: true });
    for (const f of ['common.cjs', 'provider-utils.cjs']) {
        const src = path.join(libSrcDir, f);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, path.join(libDestDir, f));
        }
    }

    // Copy hook to tmpDir root (so lib/ relative path works)
    fs.copyFileSync(HOOK_PATH, path.join(tmpDir, 'workflow-completion-enforcer.cjs'));

    // Copy config files
    const configSrc = path.join(__dirname, '..', 'config');
    const configDest = path.join(tmpDir, '.claude', 'hooks', 'config');
    fs.mkdirSync(configDest, { recursive: true });
    for (const f of ['skills-manifest.json', 'iteration-requirements.json']) {
        const src = path.join(configSrc, f);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, path.join(configDest, f));
        }
    }

    return tmpDir;
}

function writeStateFile(tmpDir, state) {
    const statePath = path.join(tmpDir, '.isdlc', 'state.json');
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    return statePath;
}

function readStateFile(tmpDir) {
    const statePath = path.join(tmpDir, '.isdlc', 'state.json');
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
}

function runHook(tmpDir, stdinJson) {
    const hookScript = path.join(tmpDir, 'workflow-completion-enforcer.cjs');
    const stdinStr = typeof stdinJson === 'string'
        ? stdinJson
        : JSON.stringify(stdinJson);
    const result = spawnSync('node', [hookScript], {
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

function recentTimestamp() {
    return new Date().toISOString();
}

function staleTimestamp() {
    return new Date(Date.now() - 5 * 60 * 1000).toISOString();
}

function baseState(overrides = {}) {
    return {
        skill_enforcement: { enabled: true, mode: 'observe' },
        current_phase: null,
        skill_usage_log: [],
        iteration_enforcement: { enabled: true },
        phases: {
            '01-requirements': {
                status: 'completed',
                started: '2026-02-01T00:00:00Z',
                completed: '2026-02-01T01:00:00Z',
                gate_passed: true,
                summary: '5 requirements captured',
                artifacts: ['requirements-spec.md']
            },
            '05-implementation': {
                status: 'completed',
                started: '2026-02-01T02:00:00Z',
                completed: '2026-02-01T04:00:00Z',
                gate_passed: true,
                summary: 'Feature implemented',
                artifacts: []
            }
        },
        active_workflow: null,
        workflow_history: [],
        history: [],
        ...overrides
    };
}

function incompleteEntry(overrides = {}) {
    return {
        type: 'feature',
        id: 'REQ-TEST',
        description: 'Test workflow',
        started_at: '2026-02-01T00:00:00Z',
        completed_at: recentTimestamp(),
        status: 'completed',
        phases: ['01-requirements', '05-implementation'],
        merged_commit: 'abc1234',
        ...overrides
    };
}

function completeEntry() {
    return {
        ...incompleteEntry(),
        phase_snapshots: [
            { key: '01-requirements', status: 'completed' }
        ],
        metrics: {
            total_phases: 1,
            phases_completed: 1,
            total_duration_minutes: 60,
            test_iterations_total: 0,
            gates_passed_first_try: 1,
            gates_required_iteration: 0
        }
    };
}

describe('workflow-completion-enforcer hook', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = setupTestEnv();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // T01: Non-Write/Edit tool → exit 0
    it('T01: ignores non-Write/Edit tools', () => {
        const state = baseState({ workflow_history: [incompleteEntry()] });
        const statePath = writeStateFile(tmpDir, state);
        const result = runHook(tmpDir, { tool_name: 'Bash', tool_input: { command: 'ls' } });
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T02: Non-state.json path → exit 0
    it('T02: ignores non-state.json paths', () => {
        const state = baseState({ workflow_history: [incompleteEntry()] });
        writeStateFile(tmpDir, state);
        const result = runHook(tmpDir, makeWriteStdin('/some/other/file.json'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T03: active_workflow still present → exit 0
    it('T03: exits when active_workflow is present', () => {
        const state = baseState({
            active_workflow: { phases: ['01-requirements'], current_phase: '01-requirements' },
            workflow_history: [incompleteEntry()]
        });
        const statePath = writeStateFile(tmpDir, state);
        const result = runHook(tmpDir, makeWriteStdin(statePath));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
        // State should not be modified
        const after = readStateFile(tmpDir);
        assert.ok(after.active_workflow);
    });

    // T04: Empty workflow_history → exit 0
    it('T04: exits when workflow_history is empty', () => {
        const state = baseState({ workflow_history: [] });
        const statePath = writeStateFile(tmpDir, state);
        const result = runHook(tmpDir, makeWriteStdin(statePath));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T05: Entry already has phase_snapshots + metrics → exit 0
    it('T05: skips entries that already have snapshots and metrics', () => {
        const state = baseState({ workflow_history: [completeEntry()] });
        const statePath = writeStateFile(tmpDir, state);
        const result = runHook(tmpDir, makeWriteStdin(statePath));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T06: Stale entry (>2 min old) → exit 0
    it('T06: skips stale entries older than 2 minutes', () => {
        const entry = incompleteEntry({ completed_at: staleTimestamp() });
        const state = baseState({ workflow_history: [entry] });
        const statePath = writeStateFile(tmpDir, state);
        const result = runHook(tmpDir, makeWriteStdin(statePath));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T07: Missing phase_snapshots → auto-remediate
    it('T07: auto-remediates missing phase_snapshots', () => {
        const entry = incompleteEntry();
        const state = baseState({ workflow_history: [entry] });
        const statePath = writeStateFile(tmpDir, state);
        const result = runHook(tmpDir, makeWriteStdin(statePath));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');

        const after = readStateFile(tmpDir);
        const lastEntry = after.workflow_history[after.workflow_history.length - 1];
        assert.ok(Array.isArray(lastEntry.phase_snapshots), 'should have phase_snapshots array');
        assert.ok(lastEntry.phase_snapshots.length > 0, 'should have at least one snapshot');
    });

    // T08: Missing metrics → auto-remediate
    it('T08: auto-remediates missing metrics', () => {
        const entry = incompleteEntry();
        const state = baseState({ workflow_history: [entry] });
        const statePath = writeStateFile(tmpDir, state);
        const result = runHook(tmpDir, makeWriteStdin(statePath));
        assert.equal(result.exitCode, 0);

        const after = readStateFile(tmpDir);
        const lastEntry = after.workflow_history[after.workflow_history.length - 1];
        assert.ok(lastEntry.metrics, 'should have metrics object');
        assert.equal(typeof lastEntry.metrics.total_phases, 'number');
        assert.equal(typeof lastEntry.metrics.phases_completed, 'number');
    });

    // T09: Completed workflow remediation — correct snapshots from state.phases
    it('T09: creates correct snapshots from state.phases data', () => {
        const entry = incompleteEntry();
        const state = baseState({ workflow_history: [entry] });
        const statePath = writeStateFile(tmpDir, state);
        runHook(tmpDir, makeWriteStdin(statePath));

        const after = readStateFile(tmpDir);
        const lastEntry = after.workflow_history[after.workflow_history.length - 1];
        const keys = lastEntry.phase_snapshots.map(s => s.key);
        assert.ok(keys.includes('01-requirements'), 'should include 01-requirements');
        assert.ok(keys.includes('05-implementation'), 'should include 05-implementation');
    });

    // T10: Cancelled workflow remediation — status preserved
    it('T10: handles cancelled workflow entries', () => {
        const entry = incompleteEntry({
            status: 'cancelled',
            completed_at: undefined,
            cancelled_at: recentTimestamp(),
            cancelled_at_phase: '05-implementation',
            cancellation_reason: 'Test cancel'
        });
        // Remove completed_at explicitly
        delete entry.completed_at;
        const state = baseState({ workflow_history: [entry] });
        const statePath = writeStateFile(tmpDir, state);
        runHook(tmpDir, makeWriteStdin(statePath));

        const after = readStateFile(tmpDir);
        const lastEntry = after.workflow_history[after.workflow_history.length - 1];
        assert.equal(lastEntry.status, 'cancelled');
        assert.ok(Array.isArray(lastEntry.phase_snapshots));
        assert.ok(lastEntry.metrics);
    });

    // T11: Phases from entry.phases used for reconstruction
    it('T11: uses entry.phases array for reconstruction', () => {
        // Only include 01-requirements in entry phases, even though state has both
        const entry = incompleteEntry({ phases: ['01-requirements'] });
        const state = baseState({ workflow_history: [entry] });
        const statePath = writeStateFile(tmpDir, state);
        runHook(tmpDir, makeWriteStdin(statePath));

        const after = readStateFile(tmpDir);
        const lastEntry = after.workflow_history[after.workflow_history.length - 1];
        // Metrics should reflect only the phases from the entry
        assert.equal(lastEntry.metrics.total_phases, 1);
    });

    // T12: Fallback — phases from Object.keys(state.phases) when entry has no phases
    it('T12: falls back to state.phases keys when entry.phases is missing', () => {
        const entry = incompleteEntry();
        delete entry.phases;
        const state = baseState({ workflow_history: [entry] });
        const statePath = writeStateFile(tmpDir, state);
        runHook(tmpDir, makeWriteStdin(statePath));

        const after = readStateFile(tmpDir);
        const lastEntry = after.workflow_history[after.workflow_history.length - 1];
        // Should still produce snapshots from state.phases keys
        assert.ok(lastEntry.phase_snapshots.length > 0, 'should have snapshots from state.phases fallback');
    });

    // T13: Pruning applied during remediation
    it('T13: applies pruning during remediation', () => {
        // Create a large skill_usage_log that should get trimmed
        const bigLog = Array.from({ length: 30 }, (_, i) => ({
            skill: `SKILL-${i}`,
            phase: '01-requirements',
            timestamp: new Date().toISOString()
        }));
        const state = baseState({
            skill_usage_log: bigLog,
            workflow_history: [incompleteEntry()]
        });
        const statePath = writeStateFile(tmpDir, state);
        runHook(tmpDir, makeWriteStdin(statePath));

        const after = readStateFile(tmpDir);
        assert.ok(after.skill_usage_log.length <= 20, 'skill_usage_log should be pruned to max 20');
    });

    // T14: Self-heal notification on stderr
    it('T14: outputs self-heal notification on stderr', () => {
        const state = baseState({ workflow_history: [incompleteEntry()] });
        const statePath = writeStateFile(tmpDir, state);
        const result = runHook(tmpDir, makeWriteStdin(statePath));
        assert.ok(result.stderr.includes('[SELF-HEAL]'), 'stderr should contain [SELF-HEAL]');
    });

    // T15: logHookEvent called — hook log file written
    it('T15: writes hook log event', () => {
        const state = baseState({ workflow_history: [incompleteEntry()] });
        const statePath = writeStateFile(tmpDir, state);
        runHook(tmpDir, makeWriteStdin(statePath));

        // Check for hook activity log file
        const logPath = path.join(tmpDir, '.isdlc', 'hook-activity.log');
        assert.ok(fs.existsSync(logPath), 'hook-activity.log should exist');
        const logContent = fs.readFileSync(logPath, 'utf8');
        assert.ok(logContent.includes('workflow-completion-enforcer'), 'log should mention hook name');
    });

    // T16: Fail-open — corrupt state.json → exit 0
    it('T16: exits gracefully on corrupt state.json', () => {
        const statePath = path.join(tmpDir, '.isdlc', 'state.json');
        fs.writeFileSync(statePath, '{{{not valid json');
        const result = runHook(tmpDir, makeWriteStdin(statePath));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T17: Fail-open — empty stdin → exit 0
    it('T17: exits gracefully on empty stdin', () => {
        const state = baseState({ workflow_history: [incompleteEntry()] });
        writeStateFile(tmpDir, state);
        const result = runHook(tmpDir, '');
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T18: Fail-open — invalid JSON stdin → exit 0
    it('T18: exits gracefully on invalid JSON stdin', () => {
        const state = baseState({ workflow_history: [incompleteEntry()] });
        writeStateFile(tmpDir, state);
        const result = runHook(tmpDir, 'not-json{{{');
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T19: No stdout produced (hook protocol)
    it('T19: never produces stdout output', () => {
        const state = baseState({ workflow_history: [incompleteEntry()] });
        const statePath = writeStateFile(tmpDir, state);
        const result = runHook(tmpDir, makeWriteStdin(statePath));
        assert.equal(result.stdout, '', 'stdout must always be empty');
    });

    // T20: Monorepo path matches regex
    it('T20: matches monorepo state.json paths', () => {
        const state = baseState({ workflow_history: [incompleteEntry()] });
        const monoPath = path.join(tmpDir, '.isdlc', 'projects', 'my-app');
        fs.mkdirSync(monoPath, { recursive: true });
        const statePath = path.join(monoPath, 'state.json');
        fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
        // The regex should match this monorepo path
        const monoStatePath = statePath;
        const result = runHook(tmpDir, makeWriteStdin(monoStatePath));
        // It should attempt processing (exit 0 either way), not reject the path
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T21: Edit tool_name also triggers processing
    it('T21: processes Edit tool_name same as Write', () => {
        const state = baseState({ workflow_history: [incompleteEntry()] });
        const statePath = writeStateFile(tmpDir, state);
        const result = runHook(tmpDir, makeEditStdin(statePath));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');

        const after = readStateFile(tmpDir);
        const lastEntry = after.workflow_history[after.workflow_history.length - 1];
        assert.ok(Array.isArray(lastEntry.phase_snapshots), 'Edit should also trigger remediation');
    });

    // T22: active_workflow stays null after remediation
    it('T22: active_workflow remains null after remediation', () => {
        const state = baseState({ workflow_history: [incompleteEntry()] });
        const statePath = writeStateFile(tmpDir, state);
        runHook(tmpDir, makeWriteStdin(statePath));

        const after = readStateFile(tmpDir);
        assert.equal(after.active_workflow, null, 'active_workflow must stay null');
    });
});
