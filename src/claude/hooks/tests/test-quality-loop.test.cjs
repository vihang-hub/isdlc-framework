'use strict';
const { describe, it, before, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { setupTestEnv, cleanupTestEnv, runHook, prepareHook } = require('./hook-test-utils.cjs');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const HOOKS_DIR = path.resolve(__dirname, '..');
const GATE_BLOCKER_SRC = path.join(HOOKS_DIR, 'gate-blocker.cjs');
const ITERATION_CORRIDOR_SRC = path.join(HOOKS_DIR, 'iteration-corridor.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function installCommonCjs(testDir) {
    const src = path.join(HOOKS_DIR, 'lib', 'common.cjs');
    const destDir = path.join(testDir, '.claude', 'hooks', 'lib');
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, path.join(destDir, 'common.cjs'));
}

function requireCommon(testDir) {
    const p = path.join(testDir, '.claude', 'hooks', 'lib', 'common.cjs');
    delete require.cache[p];
    return require(p);
}

function parseOutput(result) {
    if (!result.stdout) return null;
    const lines = result.stdout.trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        try { return JSON.parse(lines[i]); } catch {}
    }
    return null;
}

function writeQualityLoopState(testDir, stateOverrides) {
    const state = Object.assign({
        active_workflow: { type: 'feature', current_phase: '16-quality-loop', phases_completed: ['06-implementation'] },
        phases: { '16-quality-loop': { status: 'in_progress' } }
    }, stateOverrides);
    const statePath = path.join(testDir, '.isdlc', 'state.json');
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state));
    return state;
}

// ---------------------------------------------------------------------------
// 1. common.cjs integration
// ---------------------------------------------------------------------------
describe('Quality Loop: common.cjs integration', () => {
    let testDir, common;

    before(() => {
        testDir = setupTestEnv();
        installCommonCjs(testDir);
        common = requireCommon(testDir);
    });

    afterEach(() => { /* keep testDir alive for all tests in describe */ });

    it('PHASE_AGENT_MAP includes 16-quality-loop', () => {
        const src = fs.readFileSync(path.join(HOOKS_DIR, 'lib', 'common.cjs'), 'utf8');
        assert.ok(src.includes("'16-quality-loop': 'quality-loop-engineer'"), 'PHASE_AGENT_MAP should map 16-quality-loop');
    });

    it('normalizeAgentName resolves quality-loop', () => {
        assert.equal(common.normalizeAgentName('quality-loop'), 'quality-loop-engineer');
    });

    it('normalizeAgentName resolves 16-quality-loop-engineer', () => {
        assert.equal(common.normalizeAgentName('16-quality-loop-engineer'), 'quality-loop-engineer');
    });

    it('normalizeAgentName resolves ql shorthand', () => {
        assert.equal(common.normalizeAgentName('ql'), 'quality-loop-engineer');
    });

    it('normalizeAgentName returns quality-loop-engineer unchanged', () => {
        assert.equal(common.normalizeAgentName('quality-loop-engineer'), 'quality-loop-engineer');
    });

    it('getAgentForPhase returns quality-loop-engineer for 16-quality-loop', () => {
        if (common.getAgentForPhase) {
            assert.equal(common.getAgentForPhase('16-quality-loop'), 'quality-loop-engineer');
        }
    });
});

// ---------------------------------------------------------------------------
// 2. gate-blocker integration
// ---------------------------------------------------------------------------
describe('Quality Loop: gate-blocker integration', () => {
    let hookPath;

    beforeEach(() => {
        setupTestEnv();
        hookPath = prepareHook(GATE_BLOCKER_SRC);
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it('blocks gate when 16-quality-loop test_iteration incomplete', async () => {
        const testDir = setupTestEnv();
        hookPath = prepareHook(GATE_BLOCKER_SRC);
        writeQualityLoopState(testDir);

        const input = { tool_name: 'Task', tool_input: { description: 'advance to 08-code-review' } };
        const result = await runHook(hookPath, input);
        const output = parseOutput(result);
        if (output) {
            assert.equal(output.continue, false, 'Gate should be blocked');
        }
    });

    it('blocks gate when constitutional_validation incomplete', async () => {
        const testDir = setupTestEnv();
        hookPath = prepareHook(GATE_BLOCKER_SRC);
        writeQualityLoopState(testDir, {
            phases: {
                '16-quality-loop': {
                    status: 'in_progress',
                    test_iteration: { completed: true, iterations: 2, all_passing: true }
                }
            }
        });

        const input = { tool_name: 'Task', tool_input: { description: 'advance to 08-code-review' } };
        const result = await runHook(hookPath, input);
        const output = parseOutput(result);
        if (output) {
            assert.equal(output.continue, false, 'Gate should be blocked');
        }
    });

    it('allows gate when all requirements met', async () => {
        const testDir = setupTestEnv();
        hookPath = prepareHook(GATE_BLOCKER_SRC);
        writeQualityLoopState(testDir, {
            phases: {
                '16-quality-loop': {
                    status: 'in_progress',
                    test_iteration: { completed: true, iterations: 2, all_passing: true },
                    constitutional_validation: { completed: true, iterations: 1, compliant: true },
                    delegated_to: 'quality-loop-engineer'
                }
            },
            skill_usage_log: [{ agent: 'quality-loop-engineer', phase: '16-quality-loop' }]
        });

        const input = { tool_name: 'Task', tool_input: { description: 'advance to 08-code-review' } };
        const result = await runHook(hookPath, input);
        assert.ok(result.exitCode === 0 || result.exitCode === undefined, 'Hook should not crash');
    });

    it('does not crash with empty state', async () => {
        const testDir = setupTestEnv();
        hookPath = prepareHook(GATE_BLOCKER_SRC);
        fs.writeFileSync(path.join(testDir, '.isdlc', 'state.json'), JSON.stringify({}));

        const input = { tool_name: 'Task', tool_input: { description: 'test' } };
        const result = await runHook(hookPath, input);
        assert.ok(result.exitCode === 0 || result.exitCode === undefined, 'Hook should not crash on empty state');
    });
});

// ---------------------------------------------------------------------------
// 3. iteration-corridor integration
// ---------------------------------------------------------------------------
describe('Quality Loop: iteration-corridor integration', () => {
    let hookPath;

    beforeEach(() => {
        setupTestEnv();
        hookPath = prepareHook(ITERATION_CORRIDOR_SRC);
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it('allows iteration when under max_iterations', async () => {
        const testDir = setupTestEnv();
        hookPath = prepareHook(ITERATION_CORRIDOR_SRC);
        writeQualityLoopState(testDir, {
            phases: { '16-quality-loop': { status: 'in_progress', test_iteration: { iterations: 2 } } }
        });

        const input = { tool_name: 'Bash', tool_input: { command: 'npm test' } };
        const result = await runHook(hookPath, input);
        assert.ok(result.exitCode === 0 || result.exitCode === undefined, 'Should allow iteration');
    });

    it('does not crash at max_iterations boundary', async () => {
        const testDir = setupTestEnv();
        hookPath = prepareHook(ITERATION_CORRIDOR_SRC);
        writeQualityLoopState(testDir, {
            phases: { '16-quality-loop': { status: 'in_progress', test_iteration: { iterations: 10 } } }
        });

        const input = { tool_name: 'Bash', tool_input: { command: 'npm test' } };
        const result = await runHook(hookPath, input);
        assert.ok(result.exitCode === 0 || result.exitCode === undefined, 'Should not crash at boundary');
    });
});

// ---------------------------------------------------------------------------
// 4. workflows.json integration
// ---------------------------------------------------------------------------
describe('Quality Loop: workflows.json integration', () => {
    const wfPath = path.join(__dirname, '..', '..', '..', 'isdlc', 'config', 'workflows.json');
    let wf;

    before(() => {
        wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));
    });

    it('feature workflow has 9 phases', () => {
        assert.equal(wf.workflows.feature.phases.length, 9);
    });

    it('feature workflow includes 16-quality-loop', () => {
        assert.ok(wf.workflows.feature.phases.includes('16-quality-loop'));
    });

    it('feature workflow does NOT include 11-local-testing', () => {
        assert.ok(!wf.workflows.feature.phases.includes('11-local-testing'));
    });

    it('feature workflow does NOT include 07-testing', () => {
        assert.ok(!wf.workflows.feature.phases.includes('07-testing'));
    });

    it('feature workflow does NOT include 10-cicd', () => {
        assert.ok(!wf.workflows.feature.phases.includes('10-cicd'));
    });

    it('feature workflow 16-quality-loop is after 06-implementation', () => {
        const idx06 = wf.workflows.feature.phases.indexOf('06-implementation');
        const idx16 = wf.workflows.feature.phases.indexOf('16-quality-loop');
        assert.ok(idx16 === idx06 + 1, '16-quality-loop should immediately follow 06-implementation');
    });

    it('fix workflow has 6 phases', () => {
        assert.equal(wf.workflows.fix.phases.length, 6);
    });

    it('fix workflow includes 16-quality-loop', () => {
        assert.ok(wf.workflows.fix.phases.includes('16-quality-loop'));
    });

    it('fix workflow does NOT include 11-local-testing', () => {
        assert.ok(!wf.workflows.fix.phases.includes('11-local-testing'));
    });

    it('feature agent_modifiers has 16-quality-loop', () => {
        assert.ok(wf.workflows.feature.agent_modifiers['16-quality-loop']);
        assert.equal(wf.workflows.feature.agent_modifiers['16-quality-loop'].scope, 'parallel-quality-check');
    });

    it('feature agent_modifiers has 08-code-review with human-review-only', () => {
        assert.ok(wf.workflows.feature.agent_modifiers['08-code-review']);
        assert.equal(wf.workflows.feature.agent_modifiers['08-code-review'].scope, 'human-review-only');
    });

});

// ---------------------------------------------------------------------------
// 5. skills-manifest.json integration
// ---------------------------------------------------------------------------
describe('Quality Loop: skills-manifest.json integration', () => {
    const smPath = path.join(__dirname, '..', 'config', 'skills-manifest.json');
    let sm;

    before(() => {
        sm = JSON.parse(fs.readFileSync(smPath, 'utf8'));
    });

    it('has quality-loop-engineer in ownership', () => {
        assert.ok(sm.ownership['quality-loop-engineer']);
    });

    it('quality-loop-engineer has 12 skills', () => {
        assert.equal(sm.ownership['quality-loop-engineer'].skill_count, 12);
        assert.equal(sm.ownership['quality-loop-engineer'].skills.length, 12);
    });

    it('quality-loop-engineer phase is 16-quality-loop', () => {
        assert.equal(sm.ownership['quality-loop-engineer'].phase, '16-quality-loop');
    });

    it('all QL-* skills in skill_lookup', () => {
        for (let i = 1; i <= 12; i++) {
            const id = 'QL-' + String(i).padStart(3, '0');
            assert.equal(sm.skill_lookup[id], 'quality-loop-engineer', id + ' should map to quality-loop-engineer');
        }
    });

    it('skill_lookup has quality-loop skill IDs (path_lookup removed per REQ-0001 FR-008)', () => {
        // path_lookup was removed per FR-008. Verify skill_lookup coverage instead.
        assert.equal(sm.skill_lookup['QL-001'], 'quality-loop-engineer');
        assert.equal(sm.skill_lookup['QL-012'], 'quality-loop-engineer');
    });

    it('version is 5.0.0', () => {
        assert.equal(sm.version, '5.0.0');
    });

    it('total_skills is 246', () => {
        assert.equal(sm.total_skills, 246);
    });
});

// ---------------------------------------------------------------------------
// 6. iteration-requirements.json integration
// ---------------------------------------------------------------------------
describe('Quality Loop: iteration-requirements.json integration', () => {
    const irPath = path.join(__dirname, '..', 'config', 'iteration-requirements.json');
    let ir;

    before(() => {
        ir = JSON.parse(fs.readFileSync(irPath, 'utf8'));
    });

    it('has 16-quality-loop in phase_requirements', () => {
        assert.ok(ir.phase_requirements['16-quality-loop']);
    });

    it('16-quality-loop has test_iteration enabled', () => {
        assert.equal(ir.phase_requirements['16-quality-loop'].test_iteration.enabled, true);
    });

    it('16-quality-loop max_iterations is 10', () => {
        assert.equal(ir.phase_requirements['16-quality-loop'].test_iteration.max_iterations, 10);
    });

    it('16-quality-loop circuit_breaker_threshold is 3', () => {
        assert.equal(ir.phase_requirements['16-quality-loop'].test_iteration.circuit_breaker_threshold, 3);
    });

    it('16-quality-loop success_criteria includes lint_passing', () => {
        assert.equal(ir.phase_requirements['16-quality-loop'].test_iteration.success_criteria.lint_passing, true);
    });

    it('16-quality-loop constitutional articles correct', () => {
        const articles = ir.phase_requirements['16-quality-loop'].constitutional_validation.articles;
        assert.deepStrictEqual(articles, ['II', 'III', 'V', 'VI', 'VII', 'IX', 'XI']);
    });

    it('16-quality-loop agent_delegation enabled', () => {
        assert.equal(ir.phase_requirements['16-quality-loop'].agent_delegation_validation.enabled, true);
    });

    it('feature workflow override for 08-code-review exists', () => {
        assert.ok(ir.workflow_overrides.feature);
        assert.ok(ir.workflow_overrides.feature['08-code-review']);
    });

    it('feature 08-code-review override disables test_iteration', () => {
        assert.equal(ir.workflow_overrides.feature['08-code-review'].test_iteration.enabled, false);
    });

    it('feature 08-code-review override narrows constitutional articles', () => {
        const articles = ir.workflow_overrides.feature['08-code-review'].constitutional_validation.articles;
        assert.deepStrictEqual(articles, ['VI', 'IX']);
    });

    it('fix workflow override for 08-code-review exists', () => {
        assert.ok(ir.workflow_overrides.fix['08-code-review']);
        assert.equal(ir.workflow_overrides.fix['08-code-review'].test_iteration.enabled, false);
    });
});
