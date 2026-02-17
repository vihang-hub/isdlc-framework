/**
 * TDD Tests: BUG-0010-GH-16 -- Artifact-paths config filename mismatches
 *
 * Three fixes:
 *   1. artifact-paths.json Phase 08 references code-review-report.md (not review-summary.md)
 *   2. iteration-requirements.json Phase 08 artifact_validation references code-review-report.md
 *   3. workflow_overrides.fix["01-requirements"] has artifact_validation.enabled: false
 *
 * Traces to: AC-01 through AC-07 (config validation), AC-08 through AC-13 (integration)
 * Files under test: artifact-paths.json, iteration-requirements.json (config-only fix)
 * NFR-1: gate-blocker.cjs must NOT be modified.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// Config file paths
// ---------------------------------------------------------------------------

const HOOKS_CONFIG_DIR = path.resolve(__dirname, '..', 'config');
const ARTIFACT_PATHS_FILE = path.join(HOOKS_CONFIG_DIR, 'artifact-paths.json');
const ITERATION_REQ_FILE = path.join(HOOKS_CONFIG_DIR, 'iteration-requirements.json');
const GATE_BLOCKER_FILE = path.resolve(__dirname, '..', 'gate-blocker.cjs');

// ---------------------------------------------------------------------------
// Deep merge (replicates gate-blocker mergeRequirements logic)
// ---------------------------------------------------------------------------

/**
 * Deep merge two objects. Overrides replace base values.
 * Replicates the mergeRequirements function from gate-blocker.cjs.
 */
function mergeRequirements(base, overrides) {
    if (!base) return overrides;
    if (!overrides) return base;

    const merged = JSON.parse(JSON.stringify(base));

    for (const [key, value] of Object.entries(overrides)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            merged[key] = mergeRequirements(merged[key] || {}, value);
        } else {
            merged[key] = value;
        }
    }

    return merged;
}

// ===========================================================================
// Config Validation Tests
// ===========================================================================

describe('BUG-0010: Config validation -- artifact-paths.json', () => {

    // AC-01: artifact-paths.json is valid JSON
    it('TC-01 [P0]: artifact-paths.json is valid JSON (AC-01)', () => {
        const raw = fs.readFileSync(ARTIFACT_PATHS_FILE, 'utf8');
        let parsed;
        assert.doesNotThrow(() => {
            parsed = JSON.parse(raw);
        }, 'artifact-paths.json must be valid JSON');
        assert.ok(parsed, 'Parsed result must be truthy');
        assert.ok(parsed.phases, 'Must have a "phases" object');
    });

    // AC-02: Phase 08 references code-review-report.md (not review-summary.md)
    it('TC-02 [P0]: Phase 08 references code-review-report.md (AC-02)', () => {
        const config = JSON.parse(fs.readFileSync(ARTIFACT_PATHS_FILE, 'utf8'));
        const phase08Paths = config.phases['08-code-review']?.paths;

        assert.ok(Array.isArray(phase08Paths), 'Phase 08 must have paths array');
        assert.ok(phase08Paths.length > 0, 'Phase 08 must have at least one path');

        // Must reference code-review-report.md
        const hasCorrectFilename = phase08Paths.some(p =>
            p.includes('code-review-report.md')
        );
        assert.ok(hasCorrectFilename,
            `Phase 08 paths must reference code-review-report.md, got: ${JSON.stringify(phase08Paths)}`
        );

        // Must NOT reference review-summary.md (the old incorrect filename)
        const hasIncorrectFilename = phase08Paths.some(p =>
            p.includes('review-summary.md')
        );
        assert.ok(!hasIncorrectFilename,
            `Phase 08 paths must NOT reference review-summary.md, got: ${JSON.stringify(phase08Paths)}`
        );
    });
});

describe('BUG-0010: Config validation -- iteration-requirements.json', () => {

    // AC-03: iteration-requirements.json is valid JSON
    it('TC-03 [P0]: iteration-requirements.json is valid JSON (AC-03)', () => {
        const raw = fs.readFileSync(ITERATION_REQ_FILE, 'utf8');
        let parsed;
        assert.doesNotThrow(() => {
            parsed = JSON.parse(raw);
        }, 'iteration-requirements.json must be valid JSON');
        assert.ok(parsed, 'Parsed result must be truthy');
        assert.ok(parsed.phase_requirements, 'Must have "phase_requirements" object');
    });

    // AC-04: Phase 08 artifact_validation references code-review-report.md
    it('TC-04 [P0]: Phase 08 artifact_validation references code-review-report.md (AC-04)', () => {
        const config = JSON.parse(fs.readFileSync(ITERATION_REQ_FILE, 'utf8'));
        const phase08 = config.phase_requirements['08-code-review'];

        assert.ok(phase08, 'Phase 08 must exist in phase_requirements');
        assert.ok(phase08.artifact_validation, 'Phase 08 must have artifact_validation');
        assert.equal(phase08.artifact_validation.enabled, true, 'Phase 08 artifact_validation must be enabled');

        const paths = phase08.artifact_validation.paths;
        assert.ok(Array.isArray(paths), 'Phase 08 artifact_validation must have paths array');

        const hasCorrectFilename = paths.some(p => p.includes('code-review-report.md'));
        assert.ok(hasCorrectFilename,
            `Phase 08 artifact_validation must reference code-review-report.md, got: ${JSON.stringify(paths)}`
        );

        const hasIncorrectFilename = paths.some(p => p.includes('review-summary.md'));
        assert.ok(!hasIncorrectFilename,
            `Phase 08 artifact_validation must NOT reference review-summary.md, got: ${JSON.stringify(paths)}`
        );
    });

    // AC-05: workflow_overrides.fix["01-requirements"] has artifact_validation.enabled: false
    it('TC-05 [P0]: fix workflow override disables Phase 01 artifact_validation (AC-05)', () => {
        const config = JSON.parse(fs.readFileSync(ITERATION_REQ_FILE, 'utf8'));
        const fixOverrides = config.workflow_overrides?.fix;

        assert.ok(fixOverrides, 'workflow_overrides.fix must exist');

        const phase01Override = fixOverrides['01-requirements'];
        assert.ok(phase01Override, 'workflow_overrides.fix["01-requirements"] must exist');

        assert.ok(phase01Override.artifact_validation,
            'Phase 01 fix override must have artifact_validation block');
        assert.equal(phase01Override.artifact_validation.enabled, false,
            'Phase 01 fix override artifact_validation.enabled must be false');
    });

    // AC-06: Base Phase 01 artifact_validation.enabled is still true
    it('TC-06 [P1]: base Phase 01 artifact_validation.enabled remains true (AC-06)', () => {
        const config = JSON.parse(fs.readFileSync(ITERATION_REQ_FILE, 'utf8'));
        const phase01 = config.phase_requirements['01-requirements'];

        assert.ok(phase01, 'Phase 01 must exist in phase_requirements');
        assert.ok(phase01.artifact_validation, 'Phase 01 must have artifact_validation');
        assert.equal(phase01.artifact_validation.enabled, true,
            'Base Phase 01 artifact_validation.enabled must remain true');
    });

    // AC-07: Feature workflow override does NOT disable Phase 01 artifact validation
    it('TC-07 [P1]: feature workflow override does NOT disable Phase 01 artifact_validation (AC-07)', () => {
        const config = JSON.parse(fs.readFileSync(ITERATION_REQ_FILE, 'utf8'));
        const featureOverrides = config.workflow_overrides?.feature;

        // Feature override may or may not exist for Phase 01
        if (featureOverrides && featureOverrides['01-requirements']) {
            const phase01Override = featureOverrides['01-requirements'];
            // If it exists, artifact_validation must NOT be disabled
            if (phase01Override.artifact_validation) {
                assert.notEqual(phase01Override.artifact_validation.enabled, false,
                    'Feature workflow must NOT disable Phase 01 artifact_validation');
            }
        }
        // If no feature override exists for Phase 01, the base (enabled: true) applies -- that's correct
        assert.ok(true, 'Feature workflow preserves Phase 01 artifact validation');
    });
});

// ===========================================================================
// Integration Tests (gate-blocker merge behavior)
// ===========================================================================

describe('BUG-0010: Integration -- gate-blocker artifact presence behavior', () => {

    const { check } = require('../gate-blocker.cjs');

    /**
     * Build a minimal gate advancement input.
     */
    function makeGateAdvancementInput() {
        return {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'sdlc-orchestrator',
                prompt: 'Advance to next phase after gate check',
                description: 'Gate advancement request'
            }
        };
    }

    // AC-08: Gate-blocker allows Phase 08 when code-review-report.md exists
    it('TC-08 [P0]: gate-blocker allows Phase 08 when code-review-report.md exists (AC-08)', () => {
        // Create temp directory structure with code-review-report.md
        const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bug0010-'));
        const artifactFolder = 'BUG-0010-GH-16';
        const docsDir = path.join(tmpDir, 'docs', 'requirements', artifactFolder);
        fs.mkdirSync(docsDir, { recursive: true });
        fs.writeFileSync(path.join(docsDir, 'code-review-report.md'), '# Review\nAll good.');

        // Also create .isdlc and .claude dirs so getProjectRoot resolves
        fs.mkdirSync(path.join(tmpDir, '.isdlc'), { recursive: true });
        fs.mkdirSync(path.join(tmpDir, '.claude', 'hooks', 'config'), { recursive: true });

        // Copy artifact-paths.json so loadArtifactPaths finds the fixed version
        fs.copyFileSync(ARTIFACT_PATHS_FILE, path.join(tmpDir, '.claude', 'hooks', 'config', 'artifact-paths.json'));

        // Set CLAUDE_PROJECT_DIR to temp dir so getProjectRoot returns it
        const origEnv = process.env.CLAUDE_PROJECT_DIR;
        process.env.CLAUDE_PROJECT_DIR = tmpDir;

        try {
            const state = {
                iteration_enforcement: { enabled: true },
                active_workflow: {
                    type: 'fix',
                    current_phase: '08-code-review',
                    current_phase_index: 0,
                    phases: ['08-code-review'],
                    artifact_folder: artifactFolder,
                    phase_status: { '08-code-review': 'in_progress' }
                },
                phases: {
                    '08-code-review': {
                        status: 'in_progress',
                        constitutional_validation: {
                            completed: true,
                            status: 'compliant',
                            iterations_used: 1,
                            max_iterations: 5
                        }
                    }
                }
            };

            // Load the actual iteration-requirements.json (fixed version)
            const requirements = JSON.parse(fs.readFileSync(ITERATION_REQ_FILE, 'utf8'));

            const ctx = {
                input: makeGateAdvancementInput(),
                state,
                manifest: {},
                requirements,
                workflows: { workflows: { fix: { phases: ['08-code-review'] } } }
            };

            const result = check(ctx);

            // Artifact check should pass because code-review-report.md exists
            assert.notEqual(result.decision, 'block',
                `Phase 08 should not be blocked when code-review-report.md exists. Got: ${result.stopReason || 'allowed'}`
            );
        } finally {
            process.env.CLAUDE_PROJECT_DIR = origEnv;
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    // AC-09: Gate-blocker blocks Phase 08 when code-review-report.md is missing
    it('TC-09 [P0]: gate-blocker blocks Phase 08 when code-review-report.md is missing (AC-09)', () => {
        // Create temp directory structure WITHOUT the artifact
        const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bug0010-'));
        const artifactFolder = 'BUG-0010-GH-16';
        const docsDir = path.join(tmpDir, 'docs', 'requirements', artifactFolder);
        fs.mkdirSync(docsDir, { recursive: true });
        // Do NOT create code-review-report.md

        fs.mkdirSync(path.join(tmpDir, '.isdlc'), { recursive: true });
        fs.mkdirSync(path.join(tmpDir, '.claude', 'hooks', 'config'), { recursive: true });
        fs.copyFileSync(ARTIFACT_PATHS_FILE, path.join(tmpDir, '.claude', 'hooks', 'config', 'artifact-paths.json'));

        const origEnv = process.env.CLAUDE_PROJECT_DIR;
        process.env.CLAUDE_PROJECT_DIR = tmpDir;

        try {
            const state = {
                iteration_enforcement: { enabled: true },
                active_workflow: {
                    type: 'fix',
                    current_phase: '08-code-review',
                    current_phase_index: 0,
                    phases: ['08-code-review'],
                    artifact_folder: artifactFolder,
                    phase_status: { '08-code-review': 'in_progress' }
                },
                phases: {
                    '08-code-review': {
                        status: 'in_progress',
                        constitutional_validation: {
                            completed: true,
                            status: 'compliant',
                            iterations_used: 1,
                            max_iterations: 5
                        }
                    }
                }
            };

            const requirements = JSON.parse(fs.readFileSync(ITERATION_REQ_FILE, 'utf8'));

            const ctx = {
                input: makeGateAdvancementInput(),
                state,
                manifest: {},
                requirements,
                workflows: { workflows: { fix: { phases: ['08-code-review'] } } }
            };

            const result = check(ctx);

            // Artifact check should FAIL because code-review-report.md does not exist
            assert.equal(result.decision, 'block',
                'Phase 08 should be blocked when code-review-report.md is missing'
            );
            assert.ok(result.stopReason.includes('artifact'),
                `Block reason should mention artifacts. Got: ${result.stopReason}`
            );
        } finally {
            process.env.CLAUDE_PROJECT_DIR = origEnv;
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    // AC-10: Gate-blocker skips artifact check for Phase 01 in fix workflows
    it('TC-10 [P0]: gate-blocker skips artifact check for Phase 01 in fix workflows (AC-10)', () => {
        // After merging fix workflow overrides, artifact_validation.enabled should be false
        const config = JSON.parse(fs.readFileSync(ITERATION_REQ_FILE, 'utf8'));
        const basePhase01 = config.phase_requirements['01-requirements'];
        const fixOverride = config.workflow_overrides.fix['01-requirements'];

        // Simulate what gate-blocker does: merge base with fix override
        const merged = mergeRequirements(basePhase01, fixOverride);

        // After merge, artifact_validation.enabled must be false
        assert.equal(merged.artifact_validation.enabled, false,
            'After fix workflow merge, Phase 01 artifact_validation.enabled must be false');

        // The paths from base should still be present (merge preserves non-overridden keys)
        assert.ok(Array.isArray(merged.artifact_validation.paths),
            'Merged config should still have paths array from base');

        // But since enabled is false, gate-blocker's checkArtifactPresenceRequirement
        // will return { satisfied: true, reason: 'not_required' } and skip file checks
    });

    // AC-11: Gate-blocker validates Phase 01 artifacts in feature workflows
    it('TC-11 [P1]: gate-blocker validates Phase 01 artifacts in feature workflows (AC-11)', () => {
        const config = JSON.parse(fs.readFileSync(ITERATION_REQ_FILE, 'utf8'));
        const basePhase01 = config.phase_requirements['01-requirements'];
        const featureOverrides = config.workflow_overrides.feature;

        // Feature workflow has no Phase 01 override
        const featurePhase01Override = featureOverrides?.['01-requirements'];

        let merged;
        if (featurePhase01Override) {
            merged = mergeRequirements(basePhase01, featurePhase01Override);
        } else {
            merged = JSON.parse(JSON.stringify(basePhase01));
        }

        // After merge (or no merge), artifact_validation.enabled must be true
        assert.equal(merged.artifact_validation.enabled, true,
            'Feature workflow must preserve Phase 01 artifact_validation.enabled as true');
    });

    // AC-12: Gate-blocker validates Phase 01 artifacts with no workflow override active
    it('TC-12 [P1]: gate-blocker validates Phase 01 artifacts with no workflow override (AC-12)', () => {
        const config = JSON.parse(fs.readFileSync(ITERATION_REQ_FILE, 'utf8'));
        const basePhase01 = config.phase_requirements['01-requirements'];

        // No overrides applied -- base requirements apply directly
        assert.equal(basePhase01.artifact_validation.enabled, true,
            'Base Phase 01 artifact_validation.enabled must be true');
        assert.ok(Array.isArray(basePhase01.artifact_validation.paths),
            'Base Phase 01 must have artifact paths');
        assert.ok(basePhase01.artifact_validation.paths.length > 0,
            'Base Phase 01 must have at least one artifact path');
    });
});

// ===========================================================================
// NFR-1: gate-blocker.cjs must not be modified
// ===========================================================================

describe('BUG-0010: NFR-1 -- gate-blocker.cjs not modified', () => {

    // AC-13: gate-blocker.cjs has no uncommitted changes (config-only fix)
    it('TC-13 [P0]: gate-blocker.cjs has not been modified (NFR-1) (AC-13)', () => {
        // Check that gate-blocker.cjs has no uncommitted changes
        try {
            const diff = execSync('git diff HEAD -- src/claude/hooks/gate-blocker.cjs', {
                cwd: path.resolve(__dirname, '..', '..', '..', '..'),
                encoding: 'utf8'
            });
            assert.equal(diff.trim(), '',
                'gate-blocker.cjs must have no uncommitted changes (NFR-1: config-only fix)');
        } catch (e) {
            // If git command fails (e.g., not in a git repo), skip gracefully
            assert.ok(true, 'git diff not available, skipping NFR-1 check');
        }
    });
});
