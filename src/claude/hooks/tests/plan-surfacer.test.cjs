/**
 * Tests for plan-surfacer.cjs hook
 * Traces to: FR-02, AC-02, AC-02a-c, NFR-01
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const HOOK_PATH = path.join(__dirname, '..', 'plan-surfacer.cjs');

function setupTestEnv() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-surfacer-test-'));
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

function createTasksPlan(tmpDir) {
    const docsDir = path.join(tmpDir, 'docs', 'isdlc');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'tasks.md'), '# Task Plan\n\n## Phase 01');
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

function makeTaskStdin(subagentType, prompt) {
    return {
        tool_name: 'Task',
        tool_input: { subagent_type: subagentType, prompt: prompt || '' }
    };
}

describe('plan-surfacer hook', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = setupTestEnv();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // T1: Blocks when impl phase and no tasks.md
    it('blocks when impl phase and no tasks.md', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' }
        });
        const result = runHook(tmpDir, makeTaskStdin('sdlc-orchestrator', 'delegate'));
        assert.equal(result.exitCode, 0);
        assert.ok(result.stdout.length > 0, 'Should produce block output');
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.continue, false);
        assert.ok(parsed.stopReason.includes('TASK PLAN NOT GENERATED'));
    });

    // T2: Allows when impl phase and tasks.md exists
    it('allows when impl phase and tasks.md exists', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' }
        });
        createTasksPlan(tmpDir);
        const result = runHook(tmpDir, makeTaskStdin('sdlc-orchestrator', 'delegate'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T3: Allows early phase (01-requirements)
    it('allows early phase without tasks.md', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '01-requirements' }
        });
        const result = runHook(tmpDir, makeTaskStdin('sdlc-orchestrator', 'delegate'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T4: Allows early phase (04-design)
    it('allows early phase 04-design without tasks.md', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '04-design' }
        });
        const result = runHook(tmpDir, makeTaskStdin('sdlc-orchestrator', 'delegate'));
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
        const result = runHook(tmpDir, makeTaskStdin('sdlc-orchestrator', 'delegate'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T7: Fail-open on missing state.json
    it('fail-open on missing state.json', () => {
        fs.rmSync(path.join(tmpDir, '.isdlc', 'state.json'), { force: true });
        const result = runHook(tmpDir, makeTaskStdin('sdlc-orchestrator', 'delegate'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T8: Fail-open on empty stdin
    it('fail-open on empty stdin', () => {
        const result = runHook(tmpDir, '');
        assert.equal(result.exitCode, 0);
    });

    // T9: Fail-open on invalid JSON
    it('fail-open on invalid JSON', () => {
        const result = runHook(tmpDir, 'not json');
        assert.equal(result.exitCode, 0);
    });

    // T10: Block message includes phase name and path
    it('block message includes phase name and path', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '07-qa' }
        });
        const result = runHook(tmpDir, makeTaskStdin('sdlc-orchestrator', 'delegate'));
        const parsed = JSON.parse(result.stdout);
        assert.ok(parsed.stopReason.includes('07-qa'));
        assert.ok(parsed.stopReason.includes('tasks.md'));
    });
});
