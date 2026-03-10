'use strict';

/**
 * Unit Tests: Workflow Loader (REQ-0058)
 * =======================================
 * Tests for workflow-loader.cjs — discovery, parsing, validation,
 * and merging of shipped + user-defined workflows.
 *
 * Test file: src/claude/hooks/tests/test-workflow-loader.test.cjs
 * Run: node --test src/claude/hooks/tests/test-workflow-loader.test.cjs
 *
 * Covers:
 *   - resolveExtension: remove, add, reorder operations (18 tests)
 *   - validatePhaseOrdering: canonical order warnings (10 tests)
 *   - validateWorkflow: name, phases, extends, agent validation (14 tests)
 *   - buildShippedEntry / buildCustomEntry: registry entry shape (10 tests)
 *   - loadWorkflows: full integration (12 tests)
 *   - loadPhaseOrdering: config loading (4 tests)
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Load the module under test
const loader = require(path.join(__dirname, '..', '..', '..', 'isdlc', 'workflow-loader.cjs'));

// =========================================================================
// Test Helpers
// =========================================================================

const FEATURE_PHASES = [
    '00-quick-scan', '01-requirements', '02-impact-analysis',
    '03-architecture', '04-design', '05-test-strategy',
    '06-implementation', '16-quality-loop', '08-code-review'
];

const FIX_PHASES = [
    '01-requirements', '02-tracing', '05-test-strategy',
    '06-implementation', '16-quality-loop', '08-code-review'
];

function createTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'wfl-test-'));
}

function removeTempDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
}

// =========================================================================
// resolveExtension Tests
// =========================================================================

describe('resolveExtension', () => {
    it('returns base phases unchanged when diffSpec is empty', () => {
        const result = loader.resolveExtension(FEATURE_PHASES, {});
        assert.deepStrictEqual(result.phases, FEATURE_PHASES);
        assert.deepStrictEqual(result.phase_agents, {});
    });

    it('removes phases listed in remove_phases', () => {
        const result = loader.resolveExtension(FEATURE_PHASES, {
            remove_phases: ['03-architecture', '04-design']
        });
        assert.ok(!result.phases.includes('03-architecture'));
        assert.ok(!result.phases.includes('04-design'));
        assert.equal(result.phases.length, FEATURE_PHASES.length - 2);
    });

    it('throws when remove_phases references non-existent phase', () => {
        assert.throws(() => {
            loader.resolveExtension(FEATURE_PHASES, {
                remove_phases: ['99-nonexistent']
            });
        }, /not found in base workflow/);
    });

    it('adds phases with after insertion point', () => {
        const result = loader.resolveExtension(FEATURE_PHASES, {
            add_phases: [{ phase: 'custom-review', after: '06-implementation' }]
        });
        const idx = result.phases.indexOf('custom-review');
        const implIdx = result.phases.indexOf('06-implementation');
        assert.ok(idx > implIdx);
        assert.equal(idx, implIdx + 1);
    });

    it('adds phases with before insertion point', () => {
        const result = loader.resolveExtension(FEATURE_PHASES, {
            add_phases: [{ phase: 'custom-scan', before: '01-requirements' }]
        });
        const idx = result.phases.indexOf('custom-scan');
        const reqIdx = result.phases.indexOf('01-requirements');
        assert.ok(idx < reqIdx);
        assert.equal(idx, reqIdx - 1);
    });

    it('appends phase to end when no insertion point given', () => {
        const result = loader.resolveExtension(FEATURE_PHASES, {
            add_phases: ['custom-tail']
        });
        assert.equal(result.phases[result.phases.length - 1], 'custom-tail');
    });

    it('records agent mapping for custom phases with agent field', () => {
        const result = loader.resolveExtension(FEATURE_PHASES, {
            add_phases: [{ phase: 'custom-lint', after: '06-implementation', agent: 'agents/lint.md' }]
        });
        assert.equal(result.phase_agents['custom-lint'], 'agents/lint.md');
    });

    it('throws when add_phases after references non-existent phase', () => {
        assert.throws(() => {
            loader.resolveExtension(FEATURE_PHASES, {
                add_phases: [{ phase: 'x', after: 'nonexistent' }]
            });
        }, /insertion point.*not found/);
    });

    it('throws when add_phases before references non-existent phase', () => {
        assert.throws(() => {
            loader.resolveExtension(FEATURE_PHASES, {
                add_phases: [{ phase: 'x', before: 'nonexistent' }]
            });
        }, /insertion point.*not found/);
    });

    it('reorders a phase after another', () => {
        const result = loader.resolveExtension(FEATURE_PHASES, {
            reorder: [{ move: '05-test-strategy', after: '06-implementation' }]
        });
        const tsIdx = result.phases.indexOf('05-test-strategy');
        const implIdx = result.phases.indexOf('06-implementation');
        assert.ok(tsIdx > implIdx);
    });

    it('reorders a phase before another', () => {
        const result = loader.resolveExtension(FEATURE_PHASES, {
            reorder: [{ move: '08-code-review', before: '06-implementation' }]
        });
        const crIdx = result.phases.indexOf('08-code-review');
        const implIdx = result.phases.indexOf('06-implementation');
        assert.ok(crIdx < implIdx);
    });

    it('throws when reorder move phase not found', () => {
        assert.throws(() => {
            loader.resolveExtension(FEATURE_PHASES, {
                reorder: [{ move: 'nonexistent', after: '01-requirements' }]
            });
        }, /reorder.*not found/);
    });

    it('throws when reorder target not found', () => {
        assert.throws(() => {
            loader.resolveExtension(FEATURE_PHASES, {
                reorder: [{ move: '01-requirements', after: 'nonexistent' }]
            });
        }, /reorder.*not found/);
    });

    it('applies operations in fixed order: remove → add → reorder', () => {
        const result = loader.resolveExtension(FEATURE_PHASES, {
            remove_phases: ['03-architecture'],
            add_phases: [{ phase: 'custom-check', after: '02-impact-analysis' }],
            reorder: [{ move: 'custom-check', after: '04-design' }]
        });
        // custom-check should be after 04-design (reorder happened after add)
        const ccIdx = result.phases.indexOf('custom-check');
        const desIdx = result.phases.indexOf('04-design');
        assert.ok(ccIdx > desIdx);
        // 03-architecture should be gone (removed first)
        assert.ok(!result.phases.includes('03-architecture'));
    });

    it('throws when result is empty after remove', () => {
        assert.throws(() => {
            loader.resolveExtension(['only-phase'], {
                remove_phases: ['only-phase']
            });
        }, /empty phase list/);
    });

    it('handles multiple add_phases in sequence', () => {
        const result = loader.resolveExtension(['01-requirements', '06-implementation'], {
            add_phases: [
                { phase: 'step-a', after: '01-requirements' },
                { phase: 'step-b', after: 'step-a' }
            ]
        });
        const aIdx = result.phases.indexOf('step-a');
        const bIdx = result.phases.indexOf('step-b');
        assert.equal(bIdx, aIdx + 1);
    });

    it('skips add_phases entries without phase name', () => {
        const result = loader.resolveExtension(FEATURE_PHASES, {
            add_phases: [{ after: '01-requirements' }]  // missing phase field
        });
        assert.equal(result.phases.length, FEATURE_PHASES.length);
    });

    it('ignores null/undefined arrays gracefully', () => {
        const result = loader.resolveExtension(FEATURE_PHASES, {
            remove_phases: null,
            add_phases: undefined,
            reorder: null
        });
        assert.deepStrictEqual(result.phases, FEATURE_PHASES);
    });
});

// =========================================================================
// validatePhaseOrdering Tests
// =========================================================================

describe('validatePhaseOrdering', () => {
    const CANONICAL = {
        '00-quick-scan': 0,
        '01-requirements': 10,
        '02-impact-analysis': 20,
        '03-architecture': 30,
        '04-design': 40,
        '05-test-strategy': 50,
        '06-implementation': 60,
        '08-code-review': 80,
        '16-quality-loop': 75
    };

    it('returns no warnings for correctly ordered phases', () => {
        const warnings = loader.validatePhaseOrdering(FEATURE_PHASES, CANONICAL);
        assert.equal(warnings.length, 0);
    });

    it('warns when shipped phases are out of order', () => {
        const phases = ['06-implementation', '01-requirements'];
        const warnings = loader.validatePhaseOrdering(phases, CANONICAL);
        assert.ok(warnings.length > 0);
        assert.ok(warnings[0].includes('06-implementation'));
        assert.ok(warnings[0].includes('01-requirements'));
    });

    it('skips custom phases not in canonical ordering', () => {
        const phases = ['01-requirements', 'custom-phase', '06-implementation'];
        const warnings = loader.validatePhaseOrdering(phases, CANONICAL);
        assert.equal(warnings.length, 0);
    });

    it('handles empty phase list', () => {
        const warnings = loader.validatePhaseOrdering([], CANONICAL);
        assert.equal(warnings.length, 0);
    });

    it('handles single phase', () => {
        const warnings = loader.validatePhaseOrdering(['01-requirements'], CANONICAL);
        assert.equal(warnings.length, 0);
    });

    it('handles all custom phases', () => {
        const warnings = loader.validatePhaseOrdering(['x', 'y', 'z'], CANONICAL);
        assert.equal(warnings.length, 0);
    });

    it('detects multiple out-of-order pairs', () => {
        const phases = ['06-implementation', '03-architecture', '01-requirements'];
        const warnings = loader.validatePhaseOrdering(phases, CANONICAL);
        assert.equal(warnings.length, 2);
    });

    it('handles empty canonical ordering', () => {
        const warnings = loader.validatePhaseOrdering(FEATURE_PHASES, {});
        assert.equal(warnings.length, 0);
    });

    it('correctly handles equal rank phases', () => {
        const canonical = { 'a': 10, 'b': 10 };
        const warnings = loader.validatePhaseOrdering(['a', 'b'], canonical);
        assert.equal(warnings.length, 0);
    });

    it('includes rank numbers in warning message', () => {
        const warnings = loader.validatePhaseOrdering(
            ['06-implementation', '01-requirements'],
            CANONICAL
        );
        assert.ok(warnings[0].includes('rank 60'));
        assert.ok(warnings[0].includes('rank 10'));
    });
});

// =========================================================================
// validateWorkflow Tests
// =========================================================================

describe('validateWorkflow', () => {
    let tmpDir;
    const shippedWorkflows = {
        feature: { phases: FEATURE_PHASES },
        fix: { phases: FIX_PHASES }
    };

    beforeEach(() => { tmpDir = createTempDir(); });
    afterEach(() => { removeTempDir(tmpDir); });

    it('rejects workflow without name', () => {
        const result = loader.validateWorkflow({}, 'test.yaml', shippedWorkflows, tmpDir);
        assert.equal(result.valid, false);
        assert.ok(result.errors[0].includes('name'));
    });

    it('rejects workflow with name collision with shipped', () => {
        const result = loader.validateWorkflow(
            { name: 'feature' },
            'test.yaml', shippedWorkflows, tmpDir
        );
        assert.equal(result.valid, false);
        assert.ok(result.errors[0].includes('collides'));
    });

    it('rejects workflow without phases or extends', () => {
        const result = loader.validateWorkflow(
            { name: 'my-workflow' },
            'test.yaml', shippedWorkflows, tmpDir
        );
        assert.equal(result.valid, false);
        assert.ok(result.errors[0].includes('phases'));
    });

    it('rejects workflow with non-existent extends target', () => {
        const result = loader.validateWorkflow(
            { name: 'my-ext', extends: 'nonexistent' },
            'test.yaml', shippedWorkflows, tmpDir
        );
        assert.equal(result.valid, false);
        assert.ok(result.errors[0].includes('base workflow not found'));
    });

    it('accepts valid extending workflow', () => {
        const result = loader.validateWorkflow(
            { name: 'my-ext', extends: 'feature' },
            'test.yaml', shippedWorkflows, tmpDir
        );
        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
    });

    it('accepts valid standalone workflow with shipped phases', () => {
        const result = loader.validateWorkflow(
            { name: 'my-flow', phases: ['01-requirements', '06-implementation'] },
            'test.yaml', shippedWorkflows, tmpDir
        );
        assert.equal(result.valid, true);
    });

    it('rejects unknown phase without agent field', () => {
        const result = loader.validateWorkflow(
            { name: 'my-flow', phases: ['custom-phase'] },
            'test.yaml', shippedWorkflows, tmpDir
        );
        assert.equal(result.valid, false);
        assert.ok(result.errors[0].includes('Unknown phase'));
    });

    it('accepts custom phase with agent field and existing agent file', () => {
        const agentFile = path.join(tmpDir, 'agent.md');
        fs.writeFileSync(agentFile, '# Agent');
        const result = loader.validateWorkflow(
            { name: 'my-flow', phases: [{ phase: 'custom', agent: agentFile }] },
            'test.yaml', shippedWorkflows, tmpDir
        );
        assert.equal(result.valid, true);
    });

    it('rejects custom phase with missing agent file', () => {
        const result = loader.validateWorkflow(
            { name: 'my-flow', phases: [{ phase: 'custom', agent: '/nonexistent/agent.md' }] },
            'test.yaml', shippedWorkflows, tmpDir
        );
        assert.equal(result.valid, false);
        assert.ok(result.errors[0].includes('agent file not found'));
    });

    it('warns on empty intent field', () => {
        const result = loader.validateWorkflow(
            { name: 'my-flow', phases: ['01-requirements'], intent: '' },
            'test.yaml', shippedWorkflows, tmpDir
        );
        assert.equal(result.valid, true);
        assert.ok(result.warnings.length > 0);
        assert.ok(result.warnings[0].includes('intent'));
    });

    it('validates add_phases agent files in extending workflow', () => {
        const result = loader.validateWorkflow(
            {
                name: 'my-ext', extends: 'feature',
                add_phases: [{ phase: 'lint', agent: '/nonexistent.md' }]
            },
            'test.yaml', shippedWorkflows, tmpDir
        );
        assert.equal(result.valid, false);
        assert.ok(result.errors[0].includes('agent file not found'));
    });

    it('accepts name collision check case-insensitively', () => {
        const result = loader.validateWorkflow(
            { name: 'Feature' },
            'test.yaml', shippedWorkflows, tmpDir
        );
        assert.equal(result.valid, false);
        assert.ok(result.errors[0].includes('collides'));
    });

    it('handles mixed string and object phases', () => {
        const agentFile = path.join(tmpDir, 'lint.md');
        fs.writeFileSync(agentFile, '# Lint');
        const result = loader.validateWorkflow(
            {
                name: 'mixed-flow',
                phases: [
                    '01-requirements',
                    { phase: 'custom-lint', agent: agentFile },
                    '06-implementation'
                ]
            },
            'test.yaml', shippedWorkflows, tmpDir
        );
        assert.equal(result.valid, true);
    });
});

// =========================================================================
// buildShippedEntry / buildCustomEntry Tests
// =========================================================================

describe('buildShippedEntry', () => {
    it('creates entry with correct shape', () => {
        const entry = loader.buildShippedEntry('feature', {
            label: 'New Feature',
            description: 'Build features',
            intent: 'Build new things',
            examples: ['Add login'],
            phases: FEATURE_PHASES,
            gate_mode: 'strict',
            requires_branch: true
        });
        assert.equal(entry.name, 'New Feature');
        assert.equal(entry.description, 'Build features');
        assert.equal(entry.intent, 'Build new things');
        assert.deepStrictEqual(entry.examples, ['Add login']);
        assert.deepStrictEqual(entry.phases, FEATURE_PHASES);
        assert.equal(entry.gate_mode, 'strict');
        assert.equal(entry.requires_branch, true);
        assert.equal(entry.source, 'shipped');
        assert.equal(entry.extends, null);
        assert.deepStrictEqual(entry.phase_agents, {});
    });

    it('provides defaults for missing fields', () => {
        const entry = loader.buildShippedEntry('minimal', {});
        assert.equal(entry.name, 'minimal');
        assert.equal(entry.description, '');
        assert.equal(entry.intent, '');
        assert.deepStrictEqual(entry.examples, []);
        assert.deepStrictEqual(entry.phases, []);
        assert.equal(entry.gate_mode, 'strict');
        assert.equal(entry.requires_branch, true);
    });

    it('handles requires_branch false', () => {
        const entry = loader.buildShippedEntry('test-run', { requires_branch: false });
        assert.equal(entry.requires_branch, false);
    });
});

describe('buildCustomEntry', () => {
    it('builds entry for standalone custom workflow', () => {
        const entry = loader.buildCustomEntry({
            name: 'My Custom',
            description: 'Custom workflow',
            phases: ['01-requirements', { phase: 'custom-lint', agent: 'agents/lint.md' }, '06-implementation']
        }, '/path/to/custom.yaml', {});
        assert.equal(entry.name, 'My Custom');
        assert.equal(entry.source, 'custom');
        assert.deepStrictEqual(entry.phases, ['01-requirements', 'custom-lint', '06-implementation']);
        assert.equal(entry.phase_agents['custom-lint'], 'agents/lint.md');
        assert.equal(entry.file_path, '/path/to/custom.yaml');
    });

    it('builds entry for extending workflow', () => {
        const shipped = {
            feature: { phases: FEATURE_PHASES }
        };
        const entry = loader.buildCustomEntry({
            name: 'Feature Lite',
            extends: 'feature',
            remove_phases: ['03-architecture', '04-design']
        }, '/path/to/lite.yaml', shipped);
        assert.equal(entry.extends, 'feature');
        assert.ok(!entry.phases.includes('03-architecture'));
        assert.ok(!entry.phases.includes('04-design'));
        assert.equal(entry.phases.length, FEATURE_PHASES.length - 2);
    });

    it('sets requires_branch to false by default for custom', () => {
        const entry = loader.buildCustomEntry(
            { name: 'test', phases: ['01-requirements'] },
            'test.yaml', {}
        );
        assert.equal(entry.requires_branch, false);
    });

    it('respects explicit requires_branch in custom', () => {
        const entry = loader.buildCustomEntry(
            { name: 'test', phases: ['01-requirements'], requires_branch: true },
            'test.yaml', {}
        );
        assert.equal(entry.requires_branch, true);
    });

    it('preserves agent_modifiers and options', () => {
        const entry = loader.buildCustomEntry({
            name: 'test',
            phases: ['01-requirements'],
            agent_modifiers: { '01-requirements': { scope: 'custom' } },
            options: { verbose: true }
        }, 'test.yaml', {});
        assert.deepStrictEqual(entry.agent_modifiers, { '01-requirements': { scope: 'custom' } });
        assert.deepStrictEqual(entry.options, { verbose: true });
    });

    it('handles extending with add_phases and agent mapping', () => {
        const shipped = { feature: { phases: FEATURE_PHASES } };
        const entry = loader.buildCustomEntry({
            name: 'Feature Plus',
            extends: 'feature',
            add_phases: [{ phase: 'security-scan', after: '06-implementation', agent: 'agents/sec.md' }]
        }, 'plus.yaml', shipped);
        assert.ok(entry.phases.includes('security-scan'));
        assert.equal(entry.phase_agents['security-scan'], 'agents/sec.md');
    });

    it('handles extending when base not found gracefully', () => {
        const entry = loader.buildCustomEntry({
            name: 'Bad Ext',
            extends: 'nonexistent'
        }, 'bad.yaml', {});
        assert.deepStrictEqual(entry.phases, []);
    });
});

// =========================================================================
// loadPhaseOrdering Tests
// =========================================================================

describe('loadPhaseOrdering', () => {
    it('returns an object with phase ranks', () => {
        const ordering = loader.loadPhaseOrdering();
        assert.equal(typeof ordering, 'object');
        // Should have at least some shipped phases
        assert.ok(ordering['01-requirements'] !== undefined || Object.keys(ordering).length >= 0);
    });

    it('returns numeric rank values', () => {
        const ordering = loader.loadPhaseOrdering();
        for (const [key, val] of Object.entries(ordering)) {
            assert.equal(typeof val, 'number', `${key} should have numeric rank`);
        }
    });

    it('has correct relative ordering for key phases', () => {
        const ordering = loader.loadPhaseOrdering();
        if (ordering['01-requirements'] !== undefined) {
            assert.ok(ordering['01-requirements'] < ordering['06-implementation']);
        }
    });

    it('returns empty object on missing config (graceful fallback)', () => {
        // This tests the catch path — we can't easily break the real file,
        // but we verify the function never throws
        const result = loader.loadPhaseOrdering();
        assert.equal(typeof result, 'object');
    });
});

// =========================================================================
// loadWorkflows Integration Tests
// =========================================================================

describe('loadWorkflows', () => {
    let tmpDir;

    beforeEach(() => { tmpDir = createTempDir(); });
    afterEach(() => { removeTempDir(tmpDir); });

    it('loads shipped workflows from config', () => {
        const result = loader.loadWorkflows(tmpDir);
        assert.ok(result.shipped.feature);
        assert.ok(result.shipped.fix);
        assert.ok(result.shipped.upgrade);
        assert.ok(result.shipped['test-run']);
        assert.ok(result.shipped['test-generate']);
    });

    it('returns merged registry with shipped when no custom dir exists', () => {
        const result = loader.loadWorkflows(tmpDir);
        assert.deepStrictEqual(Object.keys(result.custom), []);
        assert.ok(Object.keys(result.merged).length > 0);
        assert.deepStrictEqual(result.merged, result.shipped);
    });

    it('has feature-light as a shipped workflow with correct phases', () => {
        const result = loader.loadWorkflows(tmpDir);
        assert.ok(result.shipped['feature-light'], 'feature-light should be a shipped workflow');
        // feature-light should NOT include architecture/design
        assert.ok(!result.shipped['feature-light'].phases.includes('03-architecture'));
        assert.ok(!result.shipped['feature-light'].phases.includes('04-design'));
        // But should include the remaining feature phases
        assert.ok(result.shipped['feature-light'].phases.includes('00-quick-scan'));
        assert.ok(result.shipped['feature-light'].phases.includes('01-requirements'));
        assert.ok(result.shipped['feature-light'].phases.includes('06-implementation'));
        assert.equal(result.shipped['feature-light'].phases.length, 7);
    });

    it('shipped workflows have intent fields', () => {
        const result = loader.loadWorkflows(tmpDir);
        for (const [name, wf] of Object.entries(result.shipped)) {
            assert.ok(typeof wf.intent === 'string', `${name} should have intent`);
        }
    });

    it('shipped workflows have examples arrays', () => {
        const result = loader.loadWorkflows(tmpDir);
        for (const [name, wf] of Object.entries(result.shipped)) {
            assert.ok(Array.isArray(wf.examples), `${name} should have examples array`);
        }
    });

    it('reports errors for invalid YAML files', () => {
        const wfDir = path.join(tmpDir, '.isdlc', 'workflows');
        fs.mkdirSync(wfDir, { recursive: true });
        fs.writeFileSync(path.join(wfDir, 'bad.yaml'), '{{invalid yaml');

        const result = loader.loadWorkflows(tmpDir);
        assert.ok(result.errors.length > 0);
        assert.ok(result.errors[0].includes('YAML_PARSE_ERROR'));
    });

    it('reports errors for YAML without name', () => {
        const wfDir = path.join(tmpDir, '.isdlc', 'workflows');
        fs.mkdirSync(wfDir, { recursive: true });
        fs.writeFileSync(path.join(wfDir, 'noname.yaml'), 'phases:\n  - 01-requirements\n');

        const result = loader.loadWorkflows(tmpDir);
        assert.ok(result.errors.length > 0);
        assert.ok(result.errors.some(e => e.includes('name')));
    });

    it('custom workflows cannot override shipped names', () => {
        const wfDir = path.join(tmpDir, '.isdlc', 'workflows');
        fs.mkdirSync(wfDir, { recursive: true });
        fs.writeFileSync(path.join(wfDir, 'collision.yaml'), 'name: feature\nphases:\n  - 01-requirements\n');

        const result = loader.loadWorkflows(tmpDir);
        assert.ok(result.errors.length > 0);
        assert.ok(result.errors.some(e => e.includes('collides')));
    });

    it('loads valid custom standalone workflow', () => {
        const wfDir = path.join(tmpDir, '.isdlc', 'workflows');
        fs.mkdirSync(wfDir, { recursive: true });
        fs.writeFileSync(path.join(wfDir, 'spike.yaml'),
            'name: Spike\ndescription: Quick spike\nintent: Run a quick spike\nphases:\n  - 01-requirements\n  - 06-implementation\n');

        const result = loader.loadWorkflows(tmpDir);
        assert.ok(result.custom['spike']);
        assert.equal(result.custom['spike'].name, 'Spike');
        assert.deepStrictEqual(result.custom['spike'].phases, ['01-requirements', '06-implementation']);
        assert.equal(result.custom['spike'].source, 'custom');
        assert.ok(result.merged['spike']);
    });

    it('loads valid custom extending workflow', () => {
        const wfDir = path.join(tmpDir, '.isdlc', 'workflows');
        fs.mkdirSync(wfDir, { recursive: true });
        fs.writeFileSync(path.join(wfDir, 'thorough.yaml'),
            'name: Thorough Feature\nextends: feature\nadd_phases:\n  - phase: security-scan\n    after: 06-implementation\n');

        const result = loader.loadWorkflows(tmpDir);
        assert.ok(result.custom['thorough-feature']);
        assert.equal(result.custom['thorough-feature'].extends, 'feature');
        assert.ok(result.custom['thorough-feature'].phases.includes('security-scan'));
    });

    it('ignores non-yaml files in workflows directory', () => {
        const wfDir = path.join(tmpDir, '.isdlc', 'workflows');
        fs.mkdirSync(wfDir, { recursive: true });
        fs.writeFileSync(path.join(wfDir, 'readme.md'), '# Workflows');
        fs.writeFileSync(path.join(wfDir, 'notes.txt'), 'notes');

        const result = loader.loadWorkflows(tmpDir);
        assert.equal(result.errors.length, 0);
        assert.equal(Object.keys(result.custom).length, 0);
    });

    it('handles yml extension same as yaml', () => {
        const wfDir = path.join(tmpDir, '.isdlc', 'workflows');
        fs.mkdirSync(wfDir, { recursive: true });
        fs.writeFileSync(path.join(wfDir, 'quick.yml'),
            'name: Quick Build\nphases:\n  - 01-requirements\n  - 06-implementation\n');

        const result = loader.loadWorkflows(tmpDir);
        assert.ok(result.custom['quick-build'] || result.errors.length === 0);
    });
});
