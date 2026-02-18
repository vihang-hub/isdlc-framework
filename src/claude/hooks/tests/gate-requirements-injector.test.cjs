/**
 * Tests for gate-requirements-injector.cjs
 * Traces to: REQ-0024 (Gate Requirements Pre-Injection)
 *
 * Uses node:test + node:assert/strict (project CJS test pattern).
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Helpers: create / destroy temp dirs with fixture configs
// ---------------------------------------------------------------------------

let testDir = null;

function createTestDir() {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdlc-gate-req-test-'));
    return testDir;
}

function destroyTestDir() {
    if (testDir && fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
    testDir = null;
}

/**
 * Writes a fixture config file into the test directory structure.
 * @param {string} relPath - Relative path from testDir (e.g. 'src/claude/hooks/config/iteration-requirements.json')
 * @param {object|string} content - JSON object or raw string
 */
function writeFixture(relPath, content) {
    const fullPath = path.join(testDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    const data = typeof content === 'object' ? JSON.stringify(content, null, 2) : content;
    fs.writeFileSync(fullPath, data);
}

// ---------------------------------------------------------------------------
// Load the module under test
// ---------------------------------------------------------------------------

// We require the module lazily to avoid caching issues across tests
function loadModule() {
    // Clear require cache to get a fresh copy each time
    const modPath = path.resolve(__dirname, '..', 'lib', 'gate-requirements-injector.cjs');
    delete require.cache[modPath];
    return require(modPath);
}

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const FIXTURE_ITERATION_REQ = {
    version: '2.1.0',
    phase_requirements: {
        '06-implementation': {
            timeout_minutes: 90,
            interactive_elicitation: { enabled: false },
            test_iteration: {
                enabled: true,
                max_iterations: 10,
                circuit_breaker_threshold: 3,
                success_criteria: {
                    all_tests_passing: true,
                    min_coverage_percent: 80
                }
            },
            constitutional_validation: {
                enabled: true,
                max_iterations: 5,
                articles: ['I', 'II', 'III', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
            },
            agent_delegation_validation: { enabled: true },
            artifact_validation: { enabled: false }
        },
        '01-requirements': {
            interactive_elicitation: {
                enabled: true,
                min_menu_interactions: 3
            },
            test_iteration: { enabled: false },
            constitutional_validation: {
                enabled: true,
                max_iterations: 5,
                articles: ['I', 'IV', 'VII', 'IX', 'XII']
            },
            agent_delegation_validation: { enabled: true },
            artifact_validation: {
                enabled: true,
                paths: ['docs/requirements/{artifact_folder}/requirements-spec.md']
            }
        }
    }
};

const FIXTURE_ARTIFACT_PATHS = {
    version: '1.0.0',
    phases: {
        '01-requirements': {
            paths: ['docs/requirements/{artifact_folder}/requirements-spec.md']
        },
        '03-architecture': {
            paths: ['docs/requirements/{artifact_folder}/architecture-overview.md']
        },
        '06-implementation': {
            paths: ['docs/requirements/{artifact_folder}/coverage-report.html']
        }
    }
};

const FIXTURE_CONSTITUTION = `# Project Constitution

## Universal Articles

---

### Article I: Specification Primacy

**Principle**: Specifications are the source of truth.

---

### Article II: Test-First Development

**Principle**: Tests MUST be written before implementation.

---

### Article III: Security by Design

**Principle**: Security considerations MUST precede implementation decisions.

---

### Article V: Simplicity First

**Principle**: Implement the simplest solution that satisfies requirements.

---

### Article IX: Quality Gate Integrity

**Principle**: Quality gates cannot be skipped.

---

### Article XII: Documentation Currency

**Principle**: Documentation MUST be updated with code changes.
`;

const FIXTURE_WORKFLOWS = {
    version: '1.0.0',
    workflows: {
        feature: {
            agent_modifiers: {
                '06-implementation': {
                    _when_atdd_mode: {
                        track_red_green_transitions: true,
                        require_priority_order: true
                    }
                }
            }
        },
        fix: {
            agent_modifiers: {
                '06-implementation': {
                    require_failing_test_first: true
                }
            }
        }
    }
};

// ---------------------------------------------------------------------------
// Helper to set up a fully populated test dir
// ---------------------------------------------------------------------------

function setupFullFixtures() {
    createTestDir();
    writeFixture('src/claude/hooks/config/iteration-requirements.json', FIXTURE_ITERATION_REQ);
    writeFixture('src/claude/hooks/config/artifact-paths.json', FIXTURE_ARTIFACT_PATHS);
    writeFixture('docs/isdlc/constitution.md', FIXTURE_CONSTITUTION);
    writeFixture('.isdlc/config/workflows.json', FIXTURE_WORKFLOWS);
}

// =========================================================================
// TEST SUITES
// =========================================================================

// -------------------------------------------------------------------------
// 1. buildGateRequirementsBlock - happy path
// -------------------------------------------------------------------------

describe('REQ-0024: buildGateRequirementsBlock', () => {
    afterEach(() => {
        destroyTestDir();
    });

    it('returns formatted block for 06-implementation with all configs present', () => {
        setupFullFixtures();
        const mod = loadModule();
        const result = mod.buildGateRequirementsBlock(
            '06-implementation',
            'REQ-0024-gate-requirements-pre-injection',
            'feature',
            testDir
        );

        // Should contain phase header
        assert.ok(result.includes('GATE REQUIREMENTS FOR PHASE 06 (Implementation)'), 'Should include phase header');

        // Should contain iteration requirements section
        assert.ok(result.includes('Iteration Requirements:'), 'Should include iteration requirements section');
        assert.ok(result.includes('test_iteration: enabled'), 'Should show test_iteration enabled');
        assert.ok(result.includes('max 10 iterations'), 'Should show max iterations');
        assert.ok(result.includes('coverage >= 80%'), 'Should show coverage threshold');
        assert.ok(result.includes('constitutional_validation: enabled'), 'Should show constitutional enabled');

        // Should contain artifact paths section with resolved template vars
        assert.ok(result.includes('Required Artifacts:'), 'Should include required artifacts section');
        assert.ok(result.includes('REQ-0024-gate-requirements-pre-injection'), 'Should resolve artifact_folder template');

        // Should contain constitutional articles
        assert.ok(result.includes('Constitutional Articles to Validate:'), 'Should include articles section');
        assert.ok(result.includes('Article I:'), 'Should list Article I');
        assert.ok(result.includes('Specification Primacy'), 'Should include article title');

        // Should contain workflow modifiers
        assert.ok(result.includes('Workflow Modifiers:'), 'Should include workflow modifiers section');

        // Should contain the warning footer
        assert.ok(result.includes('DO NOT attempt to advance the gate'), 'Should include warning footer');
    });

    it('returns formatted block for 01-requirements', () => {
        setupFullFixtures();
        const mod = loadModule();
        const result = mod.buildGateRequirementsBlock(
            '01-requirements',
            'REQ-0024-gate-requirements-pre-injection',
            'feature',
            testDir
        );

        assert.ok(result.includes('GATE REQUIREMENTS FOR PHASE 01 (Requirements)'), 'Should include phase 01 header');
        assert.ok(result.includes('interactive_elicitation: enabled'), 'Should show interactive_elicitation enabled');
        assert.ok(result.includes('test_iteration: disabled'), 'Should show test_iteration disabled');
    });

    it('returns empty string for unknown phase', () => {
        setupFullFixtures();
        const mod = loadModule();
        const result = mod.buildGateRequirementsBlock(
            '99-nonexistent',
            'REQ-0024-test',
            'feature',
            testDir
        );

        assert.equal(result, '', 'Should return empty string for unknown phase');
    });

    it('returns empty string when projectRoot does not exist', () => {
        const mod = loadModule();
        const result = mod.buildGateRequirementsBlock(
            '06-implementation',
            'REQ-0024-test',
            'feature',
            '/tmp/nonexistent-dir-isdlc-test-xyz'
        );

        assert.equal(result, '', 'Should return empty string for missing projectRoot');
    });

    it('returns block even when artifact-paths.json is missing (fail-open)', () => {
        createTestDir();
        writeFixture('src/claude/hooks/config/iteration-requirements.json', FIXTURE_ITERATION_REQ);
        writeFixture('docs/isdlc/constitution.md', FIXTURE_CONSTITUTION);
        // No artifact-paths.json, no workflows.json
        const mod = loadModule();
        const result = mod.buildGateRequirementsBlock(
            '06-implementation',
            'REQ-0024-test',
            'feature',
            testDir
        );

        // Should still produce a block (iteration requirements and constitution still available)
        assert.ok(result.includes('GATE REQUIREMENTS FOR PHASE 06'), 'Should still produce block');
        assert.ok(result.includes('test_iteration: enabled'), 'Should include test_iteration from iteration-requirements');
    });

    it('returns block even when constitution.md is missing (fail-open)', () => {
        createTestDir();
        writeFixture('src/claude/hooks/config/iteration-requirements.json', FIXTURE_ITERATION_REQ);
        // No constitution.md
        const mod = loadModule();
        const result = mod.buildGateRequirementsBlock(
            '06-implementation',
            'REQ-0024-test',
            'feature',
            testDir
        );

        assert.ok(result.includes('GATE REQUIREMENTS FOR PHASE 06'), 'Should still produce block');
        // Should NOT have constitutional articles section (no constitution file)
        // But the section header may still appear if articles list is defined - depends on formatting logic
    });

    it('defaults projectRoot to process.cwd() when not provided', () => {
        // This tests the default parameter behavior
        const mod = loadModule();
        // Should not throw; returns '' because CWD likely lacks configs
        const result = mod.buildGateRequirementsBlock(
            '06-implementation',
            'REQ-0024-test'
        );
        assert.equal(typeof result, 'string', 'Should always return a string');
    });

    it('handles null workflowType gracefully', () => {
        setupFullFixtures();
        const mod = loadModule();
        const result = mod.buildGateRequirementsBlock(
            '06-implementation',
            'REQ-0024-test',
            null,
            testDir
        );

        // Should still produce the block, just without workflow modifiers
        assert.ok(result.includes('GATE REQUIREMENTS FOR PHASE 06'), 'Should produce block with null workflowType');
    });
});

// -------------------------------------------------------------------------
// 2. resolveTemplateVars
// -------------------------------------------------------------------------

describe('REQ-0024: resolveTemplateVars', () => {
    afterEach(() => {
        destroyTestDir();
    });

    it('replaces {artifact_folder} with provided value', () => {
        const mod = loadModule();
        const result = mod.resolveTemplateVars(
            'docs/requirements/{artifact_folder}/requirements-spec.md',
            { artifact_folder: 'REQ-0024-test' }
        );
        assert.equal(result, 'docs/requirements/REQ-0024-test/requirements-spec.md');
    });

    it('replaces multiple different placeholders', () => {
        const mod = loadModule();
        const result = mod.resolveTemplateVars(
            '{phase}/{artifact_folder}/output.md',
            { phase: '06-implementation', artifact_folder: 'REQ-0024-test' }
        );
        assert.equal(result, '06-implementation/REQ-0024-test/output.md');
    });

    it('returns path unchanged when no vars match', () => {
        const mod = loadModule();
        const result = mod.resolveTemplateVars(
            'docs/some/static/path.md',
            { artifact_folder: 'REQ-0024-test' }
        );
        assert.equal(result, 'docs/some/static/path.md');
    });

    it('returns path unchanged when vars is empty', () => {
        const mod = loadModule();
        const result = mod.resolveTemplateVars(
            'docs/{artifact_folder}/path.md',
            {}
        );
        assert.equal(result, 'docs/{artifact_folder}/path.md');
    });

    it('returns path unchanged when vars is null', () => {
        const mod = loadModule();
        const result = mod.resolveTemplateVars(
            'docs/{artifact_folder}/path.md',
            null
        );
        assert.equal(result, 'docs/{artifact_folder}/path.md');
    });

    it('handles path with no placeholders and no vars', () => {
        const mod = loadModule();
        const result = mod.resolveTemplateVars('plain/path.md', {});
        assert.equal(result, 'plain/path.md');
    });
});

// -------------------------------------------------------------------------
// 3. parseConstitutionArticles
// -------------------------------------------------------------------------

describe('REQ-0024: parseConstitutionArticles', () => {
    afterEach(() => {
        destroyTestDir();
    });

    it('parses standard article headers from constitution.md', () => {
        createTestDir();
        writeFixture('docs/isdlc/constitution.md', FIXTURE_CONSTITUTION);
        const mod = loadModule();
        const articles = mod.parseConstitutionArticles(testDir);

        assert.equal(articles['I'], 'Specification Primacy');
        assert.equal(articles['II'], 'Test-First Development');
        assert.equal(articles['III'], 'Security by Design');
        assert.equal(articles['V'], 'Simplicity First');
        assert.equal(articles['IX'], 'Quality Gate Integrity');
        assert.equal(articles['XII'], 'Documentation Currency');
    });

    it('returns empty object when constitution.md does not exist', () => {
        createTestDir();
        // No constitution.md written
        const mod = loadModule();
        const articles = mod.parseConstitutionArticles(testDir);
        assert.deepEqual(articles, {});
    });

    it('returns empty object for empty constitution file', () => {
        createTestDir();
        writeFixture('docs/isdlc/constitution.md', '');
        const mod = loadModule();
        const articles = mod.parseConstitutionArticles(testDir);
        assert.deepEqual(articles, {});
    });

    it('returns empty object for constitution with no article headers', () => {
        createTestDir();
        writeFixture('docs/isdlc/constitution.md', '# Just a title\n\nSome body text.\n');
        const mod = loadModule();
        const articles = mod.parseConstitutionArticles(testDir);
        assert.deepEqual(articles, {});
    });

    it('handles Roman numerals correctly (I through XII and beyond)', () => {
        createTestDir();
        const mdContent = `
### Article I: First
### Article IV: Fourth
### Article IX: Ninth
### Article XI: Eleventh
### Article XII: Twelfth
`;
        writeFixture('docs/isdlc/constitution.md', mdContent);
        const mod = loadModule();
        const articles = mod.parseConstitutionArticles(testDir);

        assert.equal(articles['I'], 'First');
        assert.equal(articles['IV'], 'Fourth');
        assert.equal(articles['IX'], 'Ninth');
        assert.equal(articles['XI'], 'Eleventh');
        assert.equal(articles['XII'], 'Twelfth');
    });
});

// -------------------------------------------------------------------------
// 4. formatBlock
// -------------------------------------------------------------------------

describe('REQ-0024: formatBlock', () => {
    afterEach(() => {
        destroyTestDir();
    });

    it('produces all sections when all data present', () => {
        const mod = loadModule();
        const phaseReq = FIXTURE_ITERATION_REQ.phase_requirements['06-implementation'];
        const resolvedPaths = [
            'docs/requirements/REQ-0024-test/coverage-report.html'
        ];
        const articleMap = {
            'I': 'Specification Primacy',
            'II': 'Test-First Development',
            'III': 'Security by Design'
        };
        const modifiers = { track_red_green_transitions: true };

        const result = mod.formatBlock('06-implementation', phaseReq, resolvedPaths, articleMap, modifiers);

        assert.ok(result.includes('GATE REQUIREMENTS FOR PHASE 06 (Implementation)'));
        assert.ok(result.includes('Iteration Requirements:'));
        assert.ok(result.includes('test_iteration: enabled'));
        assert.ok(result.includes('Required Artifacts:'));
        assert.ok(result.includes('coverage-report.html'));
        assert.ok(result.includes('Constitutional Articles to Validate:'));
        assert.ok(result.includes('Article I: Specification Primacy'));
        assert.ok(result.includes('Article II: Test-First Development'));
        assert.ok(result.includes('Article III: Security by Design'));
        assert.ok(result.includes('Workflow Modifiers:'));
        assert.ok(result.includes('DO NOT attempt to advance the gate'));
    });

    it('omits artifacts section when paths array is empty', () => {
        const mod = loadModule();
        const phaseReq = FIXTURE_ITERATION_REQ.phase_requirements['06-implementation'];
        const result = mod.formatBlock('06-implementation', phaseReq, [], { 'I': 'Test' }, null);

        assert.ok(!result.includes('Required Artifacts:'), 'Should not include artifacts section');
    });

    it('omits constitutional articles section when articleMap is empty', () => {
        const mod = loadModule();
        const phaseReq = {
            test_iteration: { enabled: false },
            constitutional_validation: { enabled: false },
            interactive_elicitation: { enabled: false }
        };
        const result = mod.formatBlock('06-implementation', phaseReq, [], {}, null);

        assert.ok(!result.includes('Constitutional Articles to Validate:'), 'Should not include articles when disabled');
    });

    it('omits workflow modifiers section when modifiers is null', () => {
        const mod = loadModule();
        const phaseReq = {
            test_iteration: { enabled: true, max_iterations: 5, success_criteria: { min_coverage_percent: 80 } },
            constitutional_validation: { enabled: false },
            interactive_elicitation: { enabled: false }
        };
        const result = mod.formatBlock('06-implementation', phaseReq, [], {}, null);

        assert.ok(!result.includes('Workflow Modifiers:'), 'Should not include modifiers when null');
    });

    it('uses "Unknown" for unmapped phase names', () => {
        const mod = loadModule();
        const phaseReq = {
            test_iteration: { enabled: false },
            constitutional_validation: { enabled: false },
            interactive_elicitation: { enabled: false }
        };
        const result = mod.formatBlock('99-mystery', phaseReq, [], {}, null);

        assert.ok(result.includes('GATE REQUIREMENTS FOR PHASE 99 (Unknown)'));
    });

    it('shows agent_delegation enabled when present', () => {
        const mod = loadModule();
        const phaseReq = {
            test_iteration: { enabled: false },
            constitutional_validation: { enabled: false },
            interactive_elicitation: { enabled: false },
            agent_delegation_validation: { enabled: true }
        };
        const result = mod.formatBlock('06-implementation', phaseReq, [], {}, null);

        assert.ok(result.includes('agent_delegation: enabled'), 'Should show agent_delegation enabled');
    });

    it('shows artifact_validation enabled when present', () => {
        const mod = loadModule();
        const phaseReq = {
            test_iteration: { enabled: false },
            constitutional_validation: { enabled: false },
            interactive_elicitation: { enabled: false },
            artifact_validation: { enabled: true, paths: ['some/path.md'] }
        };
        const result = mod.formatBlock('06-implementation', phaseReq, [], {}, null);

        assert.ok(result.includes('artifact_validation: enabled'), 'Should show artifact_validation enabled');
    });
});

// -------------------------------------------------------------------------
// 5. deepMerge
// -------------------------------------------------------------------------

describe('REQ-0024: deepMerge', () => {
    it('merges flat objects with override winning', () => {
        const mod = loadModule();
        const base = { a: 1, b: 2 };
        const overrides = { b: 3, c: 4 };
        const result = mod.deepMerge(base, overrides);
        assert.deepEqual(result, { a: 1, b: 3, c: 4 });
    });

    it('merges nested objects recursively', () => {
        const mod = loadModule();
        const base = { a: { x: 1, y: 2 }, b: 3 };
        const overrides = { a: { y: 99, z: 100 } };
        const result = mod.deepMerge(base, overrides);
        assert.deepEqual(result, { a: { x: 1, y: 99, z: 100 }, b: 3 });
    });

    it('concatenates arrays', () => {
        const mod = loadModule();
        const base = { arr: [1, 2] };
        const overrides = { arr: [3, 4] };
        const result = mod.deepMerge(base, overrides);
        assert.deepEqual(result, { arr: [1, 2, 3, 4] });
    });

    it('override scalar wins over base scalar', () => {
        const mod = loadModule();
        const result = mod.deepMerge({ a: 'old' }, { a: 'new' });
        assert.deepEqual(result, { a: 'new' });
    });

    it('handles empty base', () => {
        const mod = loadModule();
        const result = mod.deepMerge({}, { a: 1 });
        assert.deepEqual(result, { a: 1 });
    });

    it('handles empty overrides', () => {
        const mod = loadModule();
        const result = mod.deepMerge({ a: 1 }, {});
        assert.deepEqual(result, { a: 1 });
    });

    it('does not mutate inputs', () => {
        const mod = loadModule();
        const base = { a: { x: 1 } };
        const overrides = { a: { y: 2 } };
        mod.deepMerge(base, overrides);
        assert.deepEqual(base, { a: { x: 1 } }, 'base should not be mutated');
        assert.deepEqual(overrides, { a: { y: 2 } }, 'overrides should not be mutated');
    });
});

// -------------------------------------------------------------------------
// 6. Edge cases
// -------------------------------------------------------------------------

describe('REQ-0024: Edge cases', () => {
    afterEach(() => {
        destroyTestDir();
    });

    it('handles invalid JSON in iteration-requirements.json (fail-open)', () => {
        createTestDir();
        writeFixture('src/claude/hooks/config/iteration-requirements.json', 'NOT VALID JSON {{{');
        const mod = loadModule();
        const result = mod.buildGateRequirementsBlock(
            '06-implementation',
            'REQ-0024-test',
            'feature',
            testDir
        );
        // Should fail-open: return empty string since we cannot determine phase requirements
        assert.equal(result, '', 'Should return empty string on invalid JSON');
    });

    it('handles invalid JSON in artifact-paths.json (fail-open)', () => {
        createTestDir();
        writeFixture('src/claude/hooks/config/iteration-requirements.json', FIXTURE_ITERATION_REQ);
        writeFixture('src/claude/hooks/config/artifact-paths.json', '{{BROKEN}}');
        const mod = loadModule();
        const result = mod.buildGateRequirementsBlock(
            '06-implementation',
            'REQ-0024-test',
            'feature',
            testDir
        );
        // Should still produce a block (iteration requirements still valid)
        assert.ok(result.includes('GATE REQUIREMENTS FOR PHASE 06'), 'Should produce block despite bad artifact-paths');
    });

    it('handles invalid JSON in workflows.json (fail-open)', () => {
        createTestDir();
        writeFixture('src/claude/hooks/config/iteration-requirements.json', FIXTURE_ITERATION_REQ);
        writeFixture('.isdlc/config/workflows.json', 'BAD JSON');
        const mod = loadModule();
        const result = mod.buildGateRequirementsBlock(
            '06-implementation',
            'REQ-0024-test',
            'feature',
            testDir
        );
        // Should still produce a block without workflow modifiers
        assert.ok(result.includes('GATE REQUIREMENTS FOR PHASE 06'), 'Should produce block despite bad workflows.json');
    });

    it('handles undefined artifactFolder param', () => {
        setupFullFixtures();
        const mod = loadModule();
        const result = mod.buildGateRequirementsBlock(
            '06-implementation',
            undefined,
            'feature',
            testDir
        );
        // Should still produce a block; template vars won't be resolved
        assert.equal(typeof result, 'string', 'Should return a string');
    });

    it('handles empty string phaseKey', () => {
        setupFullFixtures();
        const mod = loadModule();
        const result = mod.buildGateRequirementsBlock('', 'REQ-test', 'feature', testDir);
        assert.equal(result, '', 'Should return empty string for empty phase key');
    });
});

// -------------------------------------------------------------------------
// 7. loadIterationRequirements
// -------------------------------------------------------------------------

describe('REQ-0024: loadIterationRequirements', () => {
    afterEach(() => {
        destroyTestDir();
    });

    it('loads from src/claude/hooks/config/ first', () => {
        createTestDir();
        writeFixture('src/claude/hooks/config/iteration-requirements.json', { version: '2.1.0', phase_requirements: { test: true } });
        const mod = loadModule();
        const result = mod.loadIterationRequirements(testDir);
        assert.ok(result !== null, 'Should load config');
        assert.equal(result.version, '2.1.0');
    });

    it('falls back to .claude/hooks/config/ when src/ path missing', () => {
        createTestDir();
        writeFixture('.claude/hooks/config/iteration-requirements.json', { version: '1.0.0-fallback', phase_requirements: {} });
        const mod = loadModule();
        const result = mod.loadIterationRequirements(testDir);
        assert.ok(result !== null, 'Should load from fallback path');
        assert.equal(result.version, '1.0.0-fallback');
    });

    it('returns null when neither path exists', () => {
        createTestDir();
        const mod = loadModule();
        const result = mod.loadIterationRequirements(testDir);
        assert.equal(result, null, 'Should return null when no config exists');
    });
});

// -------------------------------------------------------------------------
// 8. loadArtifactPaths
// -------------------------------------------------------------------------

describe('REQ-0024: loadArtifactPaths', () => {
    afterEach(() => {
        destroyTestDir();
    });

    it('loads from src/claude/hooks/config/ first', () => {
        createTestDir();
        writeFixture('src/claude/hooks/config/artifact-paths.json', { version: '1.0.0', phases: { test: true } });
        const mod = loadModule();
        const result = mod.loadArtifactPaths(testDir);
        assert.ok(result !== null);
        assert.equal(result.version, '1.0.0');
    });

    it('falls back to .claude/hooks/config/ when src/ path missing', () => {
        createTestDir();
        writeFixture('.claude/hooks/config/artifact-paths.json', { version: '0.9.0-fb', phases: {} });
        const mod = loadModule();
        const result = mod.loadArtifactPaths(testDir);
        assert.ok(result !== null);
        assert.equal(result.version, '0.9.0-fb');
    });

    it('returns null when neither path exists', () => {
        createTestDir();
        const mod = loadModule();
        const result = mod.loadArtifactPaths(testDir);
        assert.equal(result, null);
    });
});

// -------------------------------------------------------------------------
// 9. loadWorkflowModifiers
// -------------------------------------------------------------------------

describe('REQ-0024: loadWorkflowModifiers', () => {
    afterEach(() => {
        destroyTestDir();
    });

    it('loads modifier for feature / 06-implementation', () => {
        createTestDir();
        writeFixture('.isdlc/config/workflows.json', FIXTURE_WORKFLOWS);
        const mod = loadModule();
        const result = mod.loadWorkflowModifiers(testDir, 'feature', '06-implementation');
        assert.ok(result !== null);
        assert.ok(result._when_atdd_mode);
        assert.equal(result._when_atdd_mode.track_red_green_transitions, true);
    });

    it('loads modifier for fix / 06-implementation', () => {
        createTestDir();
        writeFixture('.isdlc/config/workflows.json', FIXTURE_WORKFLOWS);
        const mod = loadModule();
        const result = mod.loadWorkflowModifiers(testDir, 'fix', '06-implementation');
        assert.ok(result !== null);
        assert.equal(result.require_failing_test_first, true);
    });

    it('returns null for unknown workflowType', () => {
        createTestDir();
        writeFixture('.isdlc/config/workflows.json', FIXTURE_WORKFLOWS);
        const mod = loadModule();
        const result = mod.loadWorkflowModifiers(testDir, 'unknown', '06-implementation');
        assert.equal(result, null);
    });

    it('returns null for unknown phaseKey', () => {
        createTestDir();
        writeFixture('.isdlc/config/workflows.json', FIXTURE_WORKFLOWS);
        const mod = loadModule();
        const result = mod.loadWorkflowModifiers(testDir, 'feature', '99-nonexistent');
        assert.equal(result, null);
    });

    it('returns null when workflows.json missing', () => {
        createTestDir();
        const mod = loadModule();
        const result = mod.loadWorkflowModifiers(testDir, 'feature', '06-implementation');
        assert.equal(result, null);
    });

    it('returns null when workflowType is null', () => {
        createTestDir();
        writeFixture('.isdlc/config/workflows.json', FIXTURE_WORKFLOWS);
        const mod = loadModule();
        const result = mod.loadWorkflowModifiers(testDir, null, '06-implementation');
        assert.equal(result, null);
    });
});

// -------------------------------------------------------------------------
// 10. Integration test: full pipeline
// -------------------------------------------------------------------------

describe('REQ-0024: Integration - full pipeline', () => {
    afterEach(() => {
        destroyTestDir();
    });

    it('produces complete output with real-ish fixture configs', () => {
        setupFullFixtures();
        const mod = loadModule();
        const result = mod.buildGateRequirementsBlock(
            '06-implementation',
            'REQ-0024-gate-requirements-pre-injection',
            'feature',
            testDir
        );

        // Verify it is a non-empty string
        assert.ok(result.length > 0, 'Should produce non-empty output');

        // Check structure: has header, iteration reqs, articles, footer
        const lines = result.split('\n');
        assert.ok(lines[0].includes('GATE REQUIREMENTS'), 'First line should be header');
        assert.ok(lines[lines.length - 1].includes('DO NOT attempt') || lines[lines.length - 2].includes('DO NOT attempt'),
            'Last meaningful line should be the warning');
    });

    it('produces output for fix workflow with different modifiers', () => {
        setupFullFixtures();
        const mod = loadModule();
        const result = mod.buildGateRequirementsBlock(
            '06-implementation',
            'BUG-0030-test-fix',
            'fix',
            testDir
        );

        assert.ok(result.includes('GATE REQUIREMENTS FOR PHASE 06'));
        assert.ok(result.includes('Workflow Modifiers:'));
        assert.ok(result.includes('require_failing_test_first'));
    });

    it('produces output for phase with no artifact paths defined', () => {
        setupFullFixtures();
        const mod = loadModule();
        // 01-requirements has artifact paths in iteration-requirements but not all phases do in artifact-paths
        const result = mod.buildGateRequirementsBlock(
            '01-requirements',
            'REQ-0024-test',
            'feature',
            testDir
        );

        assert.ok(result.includes('GATE REQUIREMENTS FOR PHASE 01 (Requirements)'));
        assert.ok(result.includes('Iteration Requirements:'));
    });

    it('falls back to .claude/ path for iteration-requirements when src/ missing', () => {
        createTestDir();
        // Write only to .claude/ fallback path
        writeFixture('.claude/hooks/config/iteration-requirements.json', FIXTURE_ITERATION_REQ);
        writeFixture('.claude/hooks/config/artifact-paths.json', FIXTURE_ARTIFACT_PATHS);
        writeFixture('docs/isdlc/constitution.md', FIXTURE_CONSTITUTION);
        const mod = loadModule();
        const result = mod.buildGateRequirementsBlock(
            '06-implementation',
            'REQ-0024-test',
            'feature',
            testDir
        );

        assert.ok(result.includes('GATE REQUIREMENTS FOR PHASE 06'), 'Should work with .claude/ fallback');
        assert.ok(result.includes('test_iteration: enabled'), 'Should parse iteration requirements');
    });
});

// -------------------------------------------------------------------------
// 11. Phase name mapping coverage
// -------------------------------------------------------------------------

describe('REQ-0024: Phase name mapping', () => {
    it('maps all known phase keys correctly', () => {
        const mod = loadModule();
        const phaseReq = {
            test_iteration: { enabled: false },
            constitutional_validation: { enabled: false },
            interactive_elicitation: { enabled: false }
        };

        const knownPhases = {
            '00-quick-scan': 'Quick Scan',
            '01-requirements': 'Requirements',
            '02-impact-analysis': 'Impact Analysis',
            '02-tracing': 'Tracing',
            '03-architecture': 'Architecture',
            '04-design': 'Design',
            '05-test-strategy': 'Test Strategy',
            '06-implementation': 'Implementation',
            '07-testing': 'Testing',
            '08-code-review': 'Code Review',
            '16-quality-loop': 'Quality Loop'
        };

        for (const [phaseKey, expectedName] of Object.entries(knownPhases)) {
            const result = mod.formatBlock(phaseKey, phaseReq, [], {}, null);
            const phaseNum = phaseKey.split('-')[0];
            assert.ok(
                result.includes(`PHASE ${phaseNum} (${expectedName})`),
                `Phase ${phaseKey} should map to "${expectedName}"`
            );
        }
    });
});
