'use strict';

/**
 * Artifact Path Consistency Tests (CJS)
 * ======================================
 * BUG-0020: Validates that artifact-paths.json and iteration-requirements.json
 * remain synchronized. Serves as a permanent drift-detection mechanism.
 *
 * These tests read the REAL config files from src/claude/hooks/config/ to
 * validate the actual production configuration for consistency.
 *
 * Run: node --test src/claude/hooks/tests/artifact-path-consistency.test.cjs
 *
 * Requirement: FR-01, FR-02, FR-05
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const CONFIG_DIR = path.resolve(__dirname, '..', 'config');
const ARTIFACT_PATHS_FILE = path.join(CONFIG_DIR, 'artifact-paths.json');
const ITER_REQS_FILE = path.join(CONFIG_DIR, 'iteration-requirements.json');

// =============================================================================
// Helper: load config files
// =============================================================================

function loadArtifactPaths() {
    return JSON.parse(fs.readFileSync(ARTIFACT_PATHS_FILE, 'utf8'));
}

function loadIterReqs() {
    return JSON.parse(fs.readFileSync(ITER_REQS_FILE, 'utf8'));
}

/**
 * Extract all phase keys that have artifact_validation.enabled: true
 * from iteration-requirements.json.
 */
function getPhasesWithArtifactValidation(iterReqs) {
    const phases = [];
    const phaseReqs = iterReqs.phase_requirements || {};
    for (const [phaseKey, config] of Object.entries(phaseReqs)) {
        if (config.artifact_validation && config.artifact_validation.enabled === true) {
            phases.push(phaseKey);
        }
    }
    return phases;
}

// =============================================================================
// Test Suite
// =============================================================================

describe('Artifact path consistency (BUG-0020)', () => {

    // -------------------------------------------------------------------------
    // TC-APC-01: artifact-paths.json exists and is valid JSON
    // Traces: FR-01, AC-01
    // -------------------------------------------------------------------------
    it('TC-APC-01: artifact-paths.json exists and is valid JSON', () => {
        assert.ok(fs.existsSync(ARTIFACT_PATHS_FILE),
            `artifact-paths.json must exist at ${ARTIFACT_PATHS_FILE}`);

        const content = fs.readFileSync(ARTIFACT_PATHS_FILE, 'utf8');
        let parsed;
        assert.doesNotThrow(() => {
            parsed = JSON.parse(content);
        }, 'artifact-paths.json must be valid JSON');

        assert.ok(parsed.phases && typeof parsed.phases === 'object',
            'artifact-paths.json must contain a top-level "phases" object');
    });

    // -------------------------------------------------------------------------
    // TC-APC-02: artifact-paths.json covers all phases with artifact_validation
    // Traces: FR-01, FR-05, AC-01
    // -------------------------------------------------------------------------
    it('TC-APC-02: artifact-paths.json covers all phases with artifact_validation', () => {
        const artifactPaths = loadArtifactPaths();
        const iterReqs = loadIterReqs();
        const phasesWithValidation = getPhasesWithArtifactValidation(iterReqs);

        assert.ok(phasesWithValidation.length > 0,
            'Should have at least one phase with artifact_validation enabled');

        for (const phaseKey of phasesWithValidation) {
            assert.ok(artifactPaths.phases[phaseKey],
                `artifact-paths.json must have an entry for phase '${phaseKey}'`);
            assert.ok(Array.isArray(artifactPaths.phases[phaseKey].paths),
                `Phase '${phaseKey}' must have a 'paths' array`);
            assert.ok(artifactPaths.phases[phaseKey].paths.length > 0,
                `Phase '${phaseKey}' paths array must not be empty`);
        }
    });

    // -------------------------------------------------------------------------
    // TC-APC-03: artifact-paths.json paths match iteration-requirements.json paths
    // Traces: FR-02, FR-05, AC-02, AC-09
    // -------------------------------------------------------------------------
    it('TC-APC-03: artifact-paths.json paths match iteration-requirements.json paths', () => {
        const artifactPaths = loadArtifactPaths();
        const iterReqs = loadIterReqs();
        const phasesWithValidation = getPhasesWithArtifactValidation(iterReqs);

        for (const phaseKey of phasesWithValidation) {
            const apPaths = artifactPaths.phases[phaseKey]?.paths || [];
            const irPaths = iterReqs.phase_requirements[phaseKey].artifact_validation.paths;

            // Sort both for comparison
            const sortedAp = [...apPaths].sort();
            const sortedIr = [...irPaths].sort();

            assert.deepStrictEqual(sortedAp, sortedIr,
                `Paths for phase '${phaseKey}' must match between artifact-paths.json and iteration-requirements.json.\n` +
                `  artifact-paths.json: ${JSON.stringify(sortedAp)}\n` +
                `  iteration-requirements.json: ${JSON.stringify(sortedIr)}`);
        }
    });

    // -------------------------------------------------------------------------
    // TC-APC-04: All paths contain {artifact_folder} template variable
    // Traces: FR-01, AC-01
    // -------------------------------------------------------------------------
    it('TC-APC-04: all paths contain {artifact_folder} template variable', () => {
        const artifactPaths = loadArtifactPaths();

        for (const [phaseKey, config] of Object.entries(artifactPaths.phases)) {
            for (const p of config.paths) {
                assert.ok(p.includes('{artifact_folder}'),
                    `Path '${p}' in phase '${phaseKey}' must contain {artifact_folder} template variable`);
            }
        }
    });

    // -------------------------------------------------------------------------
    // TC-APC-05: Schema validation
    // Traces: FR-01, FR-05
    // -------------------------------------------------------------------------
    it('TC-APC-05: artifact-paths.json schema is valid', () => {
        const artifactPaths = loadArtifactPaths();
        const PHASE_KEY_PATTERN = /^\d{2}-[\w-]+$/;

        assert.equal(typeof artifactPaths.phases, 'object',
            'Top-level "phases" must be an object');

        for (const [phaseKey, config] of Object.entries(artifactPaths.phases)) {
            assert.ok(PHASE_KEY_PATTERN.test(phaseKey),
                `Phase key '${phaseKey}' must match pattern NN-<name>`);
            assert.ok(Array.isArray(config.paths),
                `Phase '${phaseKey}' must have a 'paths' array`);
            assert.ok(config.paths.length > 0,
                `Phase '${phaseKey}' paths must not be empty`);
            for (const p of config.paths) {
                assert.equal(typeof p, 'string',
                    `Each path in phase '${phaseKey}' must be a string`);
            }
        }
    });

    // -------------------------------------------------------------------------
    // TC-APC-06 through TC-APC-10: Per-phase alignment checks
    // -------------------------------------------------------------------------
    it('TC-APC-06: Phase 01 paths are aligned (docs/requirements/)', () => {
        const artifactPaths = loadArtifactPaths();
        const iterReqs = loadIterReqs();

        const apPaths = artifactPaths.phases['01-requirements']?.paths || [];
        const irPaths = iterReqs.phase_requirements['01-requirements']?.artifact_validation?.paths || [];

        assert.ok(apPaths.includes('docs/requirements/{artifact_folder}/requirements-spec.md'),
            'Phase 01 artifact-paths.json must have docs/requirements/{artifact_folder}/requirements-spec.md');
        assert.deepStrictEqual([...apPaths].sort(), [...irPaths].sort(),
            'Phase 01 paths must be identical in both config files');
    });

    it('TC-APC-07: Phase 03 paths are aligned (docs/requirements/)', () => {
        const artifactPaths = loadArtifactPaths();
        const iterReqs = loadIterReqs();

        const apPaths = artifactPaths.phases['03-architecture']?.paths || [];
        const irPaths = iterReqs.phase_requirements['03-architecture']?.artifact_validation?.paths || [];

        assert.ok(apPaths.some(p => p.startsWith('docs/requirements/')),
            'Phase 03 artifact-paths.json must use docs/requirements/ path (not docs/architecture/)');
        assert.deepStrictEqual([...apPaths].sort(), [...irPaths].sort(),
            'Phase 03 paths must be identical in both config files');
    });

    it('TC-APC-08: Phase 04 paths are aligned (docs/requirements/)', () => {
        const artifactPaths = loadArtifactPaths();
        const iterReqs = loadIterReqs();

        const apPaths = artifactPaths.phases['04-design']?.paths || [];
        const irPaths = iterReqs.phase_requirements['04-design']?.artifact_validation?.paths || [];

        assert.ok(apPaths.some(p => p.startsWith('docs/requirements/')),
            'Phase 04 artifact-paths.json must use docs/requirements/ path (not docs/design/)');
        assert.deepStrictEqual([...apPaths].sort(), [...irPaths].sort(),
            'Phase 04 paths must be identical in both config files');
    });

    it('TC-APC-09: Phase 05 paths are aligned (docs/requirements/)', () => {
        const artifactPaths = loadArtifactPaths();
        const iterReqs = loadIterReqs();

        const apPaths = artifactPaths.phases['05-test-strategy']?.paths || [];
        const irPaths = iterReqs.phase_requirements['05-test-strategy']?.artifact_validation?.paths || [];

        assert.ok(apPaths.some(p => p.startsWith('docs/requirements/')),
            'Phase 05 artifact-paths.json must use docs/requirements/ path (not docs/testing/)');
        assert.deepStrictEqual([...apPaths].sort(), [...irPaths].sort(),
            'Phase 05 paths must be identical in both config files');
    });

    it('TC-APC-10: Phase 08 paths are aligned (docs/requirements/)', () => {
        const artifactPaths = loadArtifactPaths();
        const iterReqs = loadIterReqs();

        const apPaths = artifactPaths.phases['08-code-review']?.paths || [];
        const irPaths = iterReqs.phase_requirements['08-code-review']?.artifact_validation?.paths || [];

        assert.ok(apPaths.some(p => p.startsWith('docs/requirements/')),
            'Phase 08 artifact-paths.json must use docs/requirements/ path (not docs/reviews/)');
        assert.deepStrictEqual([...apPaths].sort(), [...irPaths].sort(),
            'Phase 08 paths must be identical in both config files');
    });

    // -------------------------------------------------------------------------
    // TC-APC-11: Mismatch detection
    // Traces: FR-05, AC-09
    // -------------------------------------------------------------------------
    it('TC-APC-11: detects mismatch when iteration-requirements.json has old paths', () => {
        // This test validates the DETECTION mechanism: if someone changes
        // iteration-requirements.json to an old/wrong path, TC-APC-03 would fail.
        // We simulate this by comparing known-wrong paths against artifact-paths.json.
        const artifactPaths = loadArtifactPaths();

        // The OLD (broken) path for phase 03
        const oldBrokenPath = 'docs/architecture/{artifact_folder}/architecture-overview.md';
        const apPaths = artifactPaths.phases['03-architecture']?.paths || [];

        // The artifact-paths.json should NOT have the old broken path
        assert.ok(!apPaths.includes(oldBrokenPath),
            'artifact-paths.json must NOT contain the old broken path for phase 03');

        // The OLD (broken) path for phase 04
        const oldDesignPath = 'docs/design/{artifact_folder}/interface-spec.yaml';
        const apPathsDesign = artifactPaths.phases['04-design']?.paths || [];
        assert.ok(!apPathsDesign.includes(oldDesignPath),
            'artifact-paths.json must NOT contain the old broken path for phase 04');
    });

    // -------------------------------------------------------------------------
    // TC-APC-12: No orphan phases in artifact-paths.json
    // Traces: FR-05
    // -------------------------------------------------------------------------
    it('TC-APC-12: no orphan phases in artifact-paths.json', () => {
        const artifactPaths = loadArtifactPaths();
        const iterReqs = loadIterReqs();

        for (const phaseKey of Object.keys(artifactPaths.phases)) {
            const phaseReq = iterReqs.phase_requirements[phaseKey];
            assert.ok(phaseReq,
                `Phase '${phaseKey}' in artifact-paths.json must exist in iteration-requirements.json`);
            assert.ok(phaseReq.artifact_validation && phaseReq.artifact_validation.enabled === true,
                `Phase '${phaseKey}' in artifact-paths.json must have artifact_validation.enabled in iteration-requirements.json`);
        }
    });
});
