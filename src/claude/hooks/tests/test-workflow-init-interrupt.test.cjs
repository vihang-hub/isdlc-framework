'use strict';

/**
 * iSDLC Workflow Init Interrupt - Test Suite (CJS)
 * =================================================
 * Integration tests for --interrupt flag in workflow-init.cjs (REQ-0059)
 *
 * Run: node --test src/claude/hooks/tests/test-workflow-init-interrupt.test.cjs
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const WORKFLOW_INIT_PATH = path.resolve(__dirname, '..', '..', '..', 'antigravity', 'workflow-init.cjs');
const LIB_SRC = path.resolve(__dirname, '..', 'lib');
const HOOKS_CONFIG_SRC = path.resolve(__dirname, '..', 'config');

let testDir;

function setupEnv() {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdlc-init-interrupt-'));
    // .isdlc dir
    fs.mkdirSync(path.join(testDir, '.isdlc'), { recursive: true });
    // lib files for common.cjs
    const libDir = path.join(testDir, 'src', 'claude', 'hooks', 'lib');
    fs.mkdirSync(libDir, { recursive: true });
    for (const f of ['common.cjs', 'user-hooks.cjs']) {
        const src = path.join(LIB_SRC, f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(libDir, f));
    }
    // config
    const configDir = path.join(testDir, '.claude', 'hooks', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    for (const f of ['skills-manifest.json', 'iteration-requirements.json', 'workflows.json']) {
        const src = path.join(HOOKS_CONFIG_SRC, f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(configDir, f));
    }
    // constitution stub
    const constDir = path.join(testDir, 'docs', 'isdlc');
    fs.mkdirSync(constDir, { recursive: true });
    fs.writeFileSync(path.join(constDir, 'constitution.md'), '# Test Constitution\n');
    // docs/requirements for slug resolution
    fs.mkdirSync(path.join(testDir, 'docs', 'requirements'), { recursive: true });
    // user-hooks config
    const hooksDir = path.join(testDir, '.claude', 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });
    // git init (workflow-init tries to create branch)
    try { execSync('git init', { cwd: testDir, stdio: 'pipe' }); } catch (e) { /* ok */ }
}

function teardown() {
    if (testDir && fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
    testDir = null;
}

function writeState(state) {
    fs.writeFileSync(path.join(testDir, '.isdlc', 'state.json'), JSON.stringify(state, null, 2));
}

function readState() {
    return JSON.parse(fs.readFileSync(path.join(testDir, '.isdlc', 'state.json'), 'utf8'));
}

function runInit(args) {
    try {
        const stdout = execSync(`node "${WORKFLOW_INIT_PATH}" ${args}`, {
            cwd: testDir,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
            timeout: 10000
        });
        return { parsed: JSON.parse(stdout.toString().trim()), code: 0 };
    } catch (e) {
        const stdout = e.stdout ? e.stdout.toString().trim() : '';
        let parsed = null;
        try { parsed = JSON.parse(stdout); } catch (_) {}
        return { parsed, code: e.status, stdout };
    }
}

// =============================================================================
// Tests
// =============================================================================

describe('workflow-init.cjs --interrupt (REQ-0059)', () => {
    beforeEach(() => setupEnv());
    afterEach(() => teardown());

    it('T01: --interrupt flag parsed correctly', () => {
        // With no active workflow, --interrupt --type fix should just init normally
        writeState({ state_version: 1 });
        const { parsed, code } = runInit('--type fix --interrupt --description "Fix broken hook"');
        assert.strictEqual(code, 0);
        assert.strictEqual(parsed.result, 'INITIALIZED');
        assert.strictEqual(parsed.workflow_type, 'fix');
    });

    it('T02: --interrupt --type fix with active workflow suspends it and creates fix workflow', () => {
        writeState({
            state_version: 1,
            active_workflow: {
                type: 'feature',
                description: 'Building dark mode',
                slug: 'REQ-0042-dark-mode',
                phases: ['01-requirements', '06-implementation'],
                current_phase: '06-implementation',
                current_phase_index: 1,
                phase_status: { '01-requirements': 'completed', '06-implementation': 'in_progress' },
                started_at: '2026-01-01T00:00:00.000Z',
                flags: { light: false, supervised: false },
                artifact_folder: 'REQ-0042-dark-mode'
            }
        });
        const { parsed, code } = runInit('--type fix --interrupt --description "Fix gate-blocker hook"');
        assert.strictEqual(code, 0);
        assert.strictEqual(parsed.result, 'INITIALIZED');
        assert.strictEqual(parsed.workflow_type, 'fix');
        assert.strictEqual(parsed.interrupted, true);
        assert.deepStrictEqual(parsed.suspended_workflow, {
            type: 'feature', slug: 'REQ-0042-dark-mode', phase: '06-implementation'
        });
    });

    it('T03: suspended_workflow preserves all original fields', () => {
        const originalWorkflow = {
            type: 'feature',
            description: 'Building dark mode',
            slug: 'REQ-0042-dark-mode',
            phases: ['01-requirements', '06-implementation', '08-code-review'],
            current_phase: '06-implementation',
            current_phase_index: 1,
            phase_status: { '01-requirements': 'completed', '06-implementation': 'in_progress', '08-code-review': 'pending' },
            started_at: '2026-01-01T00:00:00.000Z',
            flags: { light: false, supervised: true },
            artifact_folder: 'REQ-0042-dark-mode'
        };
        writeState({ state_version: 1, active_workflow: originalWorkflow });
        runInit('--type fix --interrupt --description "Fix hook"');
        const state = readState();
        assert.ok(state.suspended_workflow, 'suspended_workflow should exist');
        assert.strictEqual(state.suspended_workflow.type, 'feature');
        assert.strictEqual(state.suspended_workflow.slug, 'REQ-0042-dark-mode');
        assert.strictEqual(state.suspended_workflow.current_phase, '06-implementation');
        assert.strictEqual(state.suspended_workflow.current_phase_index, 1);
        assert.deepStrictEqual(state.suspended_workflow.phases, originalWorkflow.phases);
        assert.deepStrictEqual(state.suspended_workflow.phase_status, originalWorkflow.phase_status);
        assert.deepStrictEqual(state.suspended_workflow.flags, { light: false, supervised: true });
        assert.strictEqual(state.suspended_workflow.artifact_folder, 'REQ-0042-dark-mode');
    });

    it('T04: after suspension, active_workflow is the new fix workflow', () => {
        writeState({
            state_version: 1,
            active_workflow: {
                type: 'feature', description: 'Old', slug: 'REQ-0042-dark-mode',
                phases: ['06-implementation'], current_phase: '06-implementation',
                current_phase_index: 0, phase_status: { '06-implementation': 'in_progress' },
                started_at: '2026-01-01T00:00:00.000Z', flags: { light: false, supervised: false }
            }
        });
        runInit('--type fix --interrupt --description "Fix hook"');
        const state = readState();
        assert.strictEqual(state.active_workflow.type, 'fix');
        assert.notStrictEqual(state.active_workflow.slug, 'REQ-0042-dark-mode');
        assert.ok(state.active_workflow.phases.includes('01-requirements'), 'fix workflow should have requirements phase');
    });

    it('T05: --interrupt without --type fix is blocked', () => {
        writeState({
            state_version: 1,
            active_workflow: {
                type: 'feature', description: 'Old', slug: 'REQ-0042-dark-mode',
                phases: ['06-implementation'], current_phase: '06-implementation',
                current_phase_index: 0, phase_status: { '06-implementation': 'in_progress' },
                started_at: '2026-01-01T00:00:00.000Z', flags: { light: false, supervised: false }
            }
        });
        const { parsed, code } = runInit('--type feature --interrupt --description "New feature"');
        assert.notStrictEqual(code, 0);
        assert.strictEqual(parsed.result, 'ERROR');
        assert.ok(parsed.message.includes('Only fix workflows can interrupt'));
    });

    it('T06: --interrupt when suspended_workflow already exists → ERROR with both descriptions', () => {
        writeState({
            state_version: 1,
            active_workflow: {
                type: 'fix', description: 'First fix', slug: 'BUG-0001-first-fix',
                phases: ['06-implementation'], current_phase: '06-implementation',
                current_phase_index: 0, phase_status: { '06-implementation': 'in_progress' },
                started_at: '2026-01-01T00:00:00.000Z', flags: { light: false, supervised: false }
            },
            suspended_workflow: {
                type: 'feature', description: 'Original feature', slug: 'REQ-0042-dark-mode',
                phases: ['06-implementation'], current_phase: '06-implementation',
                current_phase_index: 0, phase_status: { '06-implementation': 'in_progress' },
                started_at: '2026-01-01T00:00:00.000Z', flags: { light: false, supervised: false }
            }
        });
        const { parsed, code } = runInit('--type fix --interrupt --description "Second fix"');
        assert.notStrictEqual(code, 0);
        assert.strictEqual(parsed.result, 'ERROR');
        assert.ok(parsed.message.includes('already a suspended workflow'));
        assert.ok(parsed.active_workflow, 'should include active_workflow info');
        assert.ok(parsed.suspended_workflow, 'should include suspended_workflow info');
    });

    it('T07: --interrupt --type fix with no active workflow → normal init', () => {
        writeState({ state_version: 1 });
        const { parsed, code } = runInit('--type fix --interrupt --description "Fix hook"');
        assert.strictEqual(code, 0);
        assert.strictEqual(parsed.result, 'INITIALIZED');
        assert.strictEqual(parsed.interrupted, undefined, 'no interruption occurred');
        const state = readState();
        assert.strictEqual(state.suspended_workflow, undefined, 'no suspended_workflow');
    });

    it('T08: state_version incremented after suspension', () => {
        writeState({
            state_version: 10,
            active_workflow: {
                type: 'feature', description: 'Old', slug: 'REQ-0042-dark-mode',
                phases: ['06-implementation'], current_phase: '06-implementation',
                current_phase_index: 0, phase_status: { '06-implementation': 'in_progress' },
                started_at: '2026-01-01T00:00:00.000Z', flags: { light: false, supervised: false }
            }
        });
        runInit('--type fix --interrupt --description "Fix hook"');
        const state = readState();
        assert.ok(state.state_version > 10, `state_version should be > 10, got ${state.state_version}`);
    });
});
