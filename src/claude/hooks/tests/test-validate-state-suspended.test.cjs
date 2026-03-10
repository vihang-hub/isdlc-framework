'use strict';

/**
 * iSDLC Validate State - Suspended Workflow Tests (CJS)
 * =====================================================
 * Integration tests for suspended_workflow validation in validate-state.cjs (REQ-0059)
 *
 * Run: node --test src/claude/hooks/tests/test-validate-state-suspended.test.cjs
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const VALIDATE_STATE_PATH = path.resolve(__dirname, '..', '..', '..', 'antigravity', 'validate-state.cjs');
const LIB_SRC = path.resolve(__dirname, '..', 'lib');

let testDir;

function setupEnv() {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdlc-validate-suspended-'));
    fs.mkdirSync(path.join(testDir, '.isdlc'), { recursive: true });
    const libDir = path.join(testDir, 'src', 'claude', 'hooks', 'lib');
    fs.mkdirSync(libDir, { recursive: true });
    for (const f of ['common.cjs', 'state-logic.cjs']) {
        const src = path.join(LIB_SRC, f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(libDir, f));
    }
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

function runValidate() {
    const { execSync } = require('child_process');
    try {
        const stdout = execSync(`node "${VALIDATE_STATE_PATH}"`, {
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

/** Build a valid suspended workflow */
function validSuspendedWorkflow() {
    return {
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
}

/** Build a valid active fix workflow */
function activeFixWorkflow() {
    return {
        type: 'fix',
        description: 'Fix broken hook',
        slug: 'BUG-0001-fix-broken-hook',
        phases: ['01-requirements', '05-test-strategy', '06-implementation', '08-code-review'],
        current_phase: '06-implementation',
        current_phase_index: 2,
        phase_status: {
            '01-requirements': 'completed',
            '05-test-strategy': 'completed',
            '06-implementation': 'in_progress',
            '08-code-review': 'pending'
        },
        started_at: '2026-01-01T00:00:00.000Z',
        flags: { light: false, supervised: false }
    };
}

// =============================================================================
// Tests
// =============================================================================

describe('validate-state.cjs suspended_workflow (REQ-0059)', () => {
    beforeEach(() => setupEnv());
    afterEach(() => teardown());

    it('T20: valid state with suspended_workflow passes validation', () => {
        writeState({
            state_version: 1,
            active_workflow: activeFixWorkflow(),
            suspended_workflow: validSuspendedWorkflow()
        });
        const { parsed, code } = runValidate();
        assert.strictEqual(code, 0);
        assert.strictEqual(parsed.result, 'VALID');
    });

    it('T21: suspended_workflow with non-numeric current_phase_index is INVALID', () => {
        const sw = validSuspendedWorkflow();
        sw.current_phase_index = 'one';
        writeState({
            state_version: 1,
            active_workflow: activeFixWorkflow(),
            suspended_workflow: sw
        });
        const { parsed, code } = runValidate();
        assert.strictEqual(code, 1);
        assert.strictEqual(parsed.result, 'INVALID');
        assert.ok(parsed.errors.some(e => e.includes('suspended_workflow.current_phase_index')));
    });

    it('T22: suspended_workflow with current_phase not in phases array is INVALID', () => {
        const sw = validSuspendedWorkflow();
        sw.current_phase = '99-nonexistent';
        writeState({
            state_version: 1,
            active_workflow: activeFixWorkflow(),
            suspended_workflow: sw
        });
        const { parsed, code } = runValidate();
        assert.strictEqual(code, 1);
        assert.strictEqual(parsed.result, 'INVALID');
        assert.ok(parsed.errors.some(e => e.includes('suspended_workflow.current_phase') && e.includes('not in phases array')));
    });

    it('T23: suspended_workflow with invalid phase_status value is INVALID', () => {
        const sw = validSuspendedWorkflow();
        sw.phase_status['06-implementation'] = 'broken';
        writeState({
            state_version: 1,
            active_workflow: activeFixWorkflow(),
            suspended_workflow: sw
        });
        const { parsed, code } = runValidate();
        assert.strictEqual(code, 1);
        assert.strictEqual(parsed.result, 'INVALID');
        assert.ok(parsed.errors.some(e => e.includes('suspended_workflow.phase_status') && e.includes('broken')));
    });
});
