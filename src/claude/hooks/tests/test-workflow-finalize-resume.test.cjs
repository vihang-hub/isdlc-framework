'use strict';

/**
 * iSDLC Workflow Finalize Resume - Test Suite (CJS)
 * ==================================================
 * Integration tests for suspended workflow restoration in workflow-finalize.cjs (REQ-0059)
 *
 * Run: node --test src/claude/hooks/tests/test-workflow-finalize-resume.test.cjs
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const WORKFLOW_FINALIZE_PATH = path.resolve(__dirname, '..', '..', '..', 'antigravity', 'workflow-finalize.cjs');
const LIB_SRC = path.resolve(__dirname, '..', 'lib');
const HOOKS_CONFIG_SRC = path.resolve(__dirname, '..', 'config');

let testDir;

function setupEnv() {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdlc-finalize-resume-'));
    fs.mkdirSync(path.join(testDir, '.isdlc'), { recursive: true });
    const libDir = path.join(testDir, 'src', 'claude', 'hooks', 'lib');
    fs.mkdirSync(libDir, { recursive: true });
    for (const f of ['common.cjs', 'user-hooks.cjs']) {
        const src = path.join(LIB_SRC, f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(libDir, f));
    }
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
    // user-hooks config
    const hooksDir = path.join(testDir, '.claude', 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });
    // git init (finalize tries to merge)
    try {
        execSync('git init && git add -A && git commit -m "init" --allow-empty', { cwd: testDir, stdio: 'pipe' });
    } catch (e) { /* ok */ }
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

function runFinalize(args = '') {
    try {
        const stdout = execSync(`node "${WORKFLOW_FINALIZE_PATH}" --skip-merge ${args}`, {
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

/** Build a completed fix workflow for finalization */
function completedFixWorkflow() {
    return {
        type: 'fix',
        description: 'Fix broken hook',
        slug: 'BUG-0001-fix-broken-hook',
        phases: ['01-requirements', '05-test-strategy', '06-implementation', '08-code-review'],
        current_phase: '08-code-review',
        current_phase_index: 3,
        phase_status: {
            '01-requirements': 'completed',
            '05-test-strategy': 'completed',
            '06-implementation': 'completed',
            '08-code-review': 'completed'
        },
        started_at: '2026-01-01T00:00:00.000Z',
        flags: { light: false, supervised: false }
    };
}

/** Build a suspended feature workflow */
function suspendedFeatureWorkflow() {
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

// =============================================================================
// Tests
// =============================================================================

describe('workflow-finalize.cjs resume (REQ-0059)', () => {
    beforeEach(() => setupEnv());
    afterEach(() => teardown());

    it('T09: finalize with suspended_workflow restores it to active_workflow', () => {
        writeState({
            state_version: 1,
            active_workflow: completedFixWorkflow(),
            suspended_workflow: suspendedFeatureWorkflow()
        });
        const { parsed, code } = runFinalize();
        assert.strictEqual(code, 0);
        assert.strictEqual(parsed.result, 'FINALIZED');
        const state = readState();
        assert.ok(state.active_workflow, 'active_workflow should be restored');
        assert.strictEqual(state.active_workflow.type, 'feature');
        assert.strictEqual(state.active_workflow.slug, 'REQ-0042-dark-mode');
    });

    it('T10: restored workflow has all original fields intact', () => {
        const suspended = suspendedFeatureWorkflow();
        writeState({
            state_version: 1,
            active_workflow: completedFixWorkflow(),
            suspended_workflow: suspended
        });
        runFinalize();
        const state = readState();
        const aw = state.active_workflow;
        assert.strictEqual(aw.type, suspended.type);
        assert.strictEqual(aw.slug, suspended.slug);
        assert.strictEqual(aw.description, suspended.description);
        assert.deepStrictEqual(aw.phases, suspended.phases);
        assert.strictEqual(aw.current_phase, suspended.current_phase);
        assert.strictEqual(aw.current_phase_index, suspended.current_phase_index);
        assert.strictEqual(aw.artifact_folder, suspended.artifact_folder);
        assert.deepStrictEqual(aw.flags, suspended.flags);
    });

    it('T11: suspended_workflow is deleted after restore', () => {
        writeState({
            state_version: 1,
            active_workflow: completedFixWorkflow(),
            suspended_workflow: suspendedFeatureWorkflow()
        });
        runFinalize();
        const state = readState();
        assert.strictEqual(state.suspended_workflow, undefined, 'suspended_workflow should be absent');
    });

    it('T12: phase iteration state reset on restore', () => {
        writeState({
            state_version: 1,
            active_workflow: completedFixWorkflow(),
            suspended_workflow: suspendedFeatureWorkflow(),
            phases: {
                '06-implementation': {
                    status: 'in_progress',
                    test_iteration: { current_iteration: 3, completed: true },
                    constitutional_validation: { completed: true, iterations_used: 2, status: 'compliant' },
                    interactive_elicitation: { completed: true, menu_interactions: 5 },
                    iteration_requirements: {
                        test_iteration: { max_iterations: 10 },
                        interactive_elicitation: { min_menu_interactions: 3 }
                    }
                }
            }
        });
        runFinalize();
        const state = readState();
        const phaseData = state.phases['06-implementation'];
        assert.strictEqual(phaseData.test_iteration, undefined, 'test_iteration should be cleared');
        assert.strictEqual(phaseData.constitutional_validation, undefined, 'constitutional_validation should be cleared');
        assert.strictEqual(phaseData.interactive_elicitation, undefined, 'interactive_elicitation should be cleared');
        assert.strictEqual(phaseData.iteration_requirements.test_iteration, undefined, 'nested test_iteration should be cleared');
        assert.strictEqual(phaseData.iteration_requirements.interactive_elicitation, undefined, 'nested interactive_elicitation should be cleared');
    });

    it('T13: recovery_action set to resumed_from_suspension', () => {
        writeState({
            state_version: 1,
            active_workflow: completedFixWorkflow(),
            suspended_workflow: suspendedFeatureWorkflow()
        });
        runFinalize();
        const state = readState();
        assert.ok(state.active_workflow.recovery_action, 'recovery_action should be set');
        assert.strictEqual(state.active_workflow.recovery_action.type, 'resumed_from_suspension');
        assert.strictEqual(state.active_workflow.recovery_action.phase, '06-implementation');
        assert.ok(state.active_workflow.recovery_action.timestamp, 'timestamp should be set');
    });

    it('T14: finalize without suspended_workflow is normal (no restoration)', () => {
        writeState({
            state_version: 1,
            active_workflow: completedFixWorkflow()
        });
        const { parsed, code } = runFinalize();
        assert.strictEqual(code, 0);
        assert.strictEqual(parsed.result, 'FINALIZED');
        const state = readState();
        assert.strictEqual(state.active_workflow, undefined, 'no active_workflow when no suspension');
        assert.strictEqual(parsed.resumed_workflow, undefined);
    });

    it('T15: output includes resumed_workflow when restoration occurs', () => {
        writeState({
            state_version: 1,
            active_workflow: completedFixWorkflow(),
            suspended_workflow: suspendedFeatureWorkflow()
        });
        const { parsed } = runFinalize();
        assert.ok(parsed.resumed_workflow, 'resumed_workflow should be in output');
        assert.strictEqual(parsed.resumed_workflow.type, 'feature');
        assert.strictEqual(parsed.resumed_workflow.slug, 'REQ-0042-dark-mode');
        assert.strictEqual(parsed.resumed_workflow.phase, '06-implementation');
    });

    it('T16: state_version incremented after restoration', () => {
        writeState({
            state_version: 50,
            active_workflow: completedFixWorkflow(),
            suspended_workflow: suspendedFeatureWorkflow()
        });
        runFinalize();
        const state = readState();
        assert.ok(state.state_version > 50, `state_version should be > 50, got ${state.state_version}`);
    });
});
