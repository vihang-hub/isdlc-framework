'use strict';

/**
 * iSDLC Three-Verb Utilities - Step Tracking Extension Tests (CJS / node:test)
 * =============================================================================
 * Unit + integration tests for steps_completed and depth_overrides
 * meta.json fields added by REQ-ROUNDTABLE-ANALYST (GH-20).
 *
 * Run:  node --test src/claude/hooks/tests/test-three-verb-utils-steps.test.cjs
 *
 * REQ-0027: Roundtable analysis agent with named personas
 * Traces: FR-005, FR-006, NFR-003, NFR-005, VR-META-005..BC-004
 *
 * Version: 1.0.0
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
    readMetaJson,
    writeMetaJson,
    extractFilesFromImpactAnalysis,
    checkBlastRadiusStaleness
} = require('../lib/three-verb-utils.cjs');

// ---------------------------------------------------------------------------
// Test environment helpers
// ---------------------------------------------------------------------------

let testDir;

function createTestDir() {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdlc-steps-test-'));
    return testDir;
}

function cleanupTestDir() {
    if (testDir && fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
    testDir = null;
}

/**
 * Write a meta.json to the test slug directory.
 * @param {object} data - Meta object to write
 */
function writeMeta(data) {
    fs.writeFileSync(
        path.join(testDir, 'meta.json'),
        JSON.stringify(data, null, 2)
    );
}

/**
 * Read meta.json from disk (raw, no processing).
 * @returns {object} Parsed meta object
 */
function readMetaRaw() {
    return JSON.parse(fs.readFileSync(path.join(testDir, 'meta.json'), 'utf8'));
}

// Legacy fixture: meta.json without steps_completed or depth_overrides
function legacyMeta() {
    return {
        description: 'test item',
        source: 'manual',
        created_at: '2026-01-01T00:00:00.000Z',
        analysis_status: 'raw',
        phases_completed: []
    };
}

// ---------------------------------------------------------------------------
// Suite A: three-verb-utils Steps Extension
// Traces: FR-005, FR-006, NFR-005, VR-META-005..BC-004
// ---------------------------------------------------------------------------

describe('three-verb-utils: steps_completed and depth_overrides (GH-20)', () => {
    beforeEach(() => {
        createTestDir();
    });

    afterEach(() => {
        cleanupTestDir();
    });

    // --- TC-A01 ---
    it('TC-A01: readMetaJson defaults steps_completed to [] when field absent', () => {
        writeMeta(legacyMeta());
        const meta = readMetaJson(testDir);
        assert.ok(meta !== null, 'readMetaJson should not return null');
        assert.deepStrictEqual(meta.steps_completed, []);
    });

    // --- TC-A02 ---
    it('TC-A02: readMetaJson defaults depth_overrides to {} when field absent', () => {
        writeMeta(legacyMeta());
        const meta = readMetaJson(testDir);
        assert.ok(meta !== null);
        assert.deepStrictEqual(meta.depth_overrides, {});
    });

    // --- TC-A03 ---
    it('TC-A03: readMetaJson preserves existing steps_completed array', () => {
        const data = { ...legacyMeta(), steps_completed: ['00-01', '00-02', '01-01'] };
        writeMeta(data);
        const meta = readMetaJson(testDir);
        assert.deepStrictEqual(meta.steps_completed, ['00-01', '00-02', '01-01']);
    });

    // --- TC-A04 ---
    it('TC-A04: readMetaJson preserves existing depth_overrides object', () => {
        const data = {
            ...legacyMeta(),
            depth_overrides: { '01-requirements': 'brief', '03-architecture': 'deep' }
        };
        writeMeta(data);
        const meta = readMetaJson(testDir);
        assert.deepStrictEqual(meta.depth_overrides, {
            '01-requirements': 'brief',
            '03-architecture': 'deep'
        });
    });

    // --- TC-A05 ---
    it('TC-A05: readMetaJson corrects steps_completed when it is a string', () => {
        writeMeta({ ...legacyMeta(), steps_completed: '00-01' });
        const meta = readMetaJson(testDir);
        assert.deepStrictEqual(meta.steps_completed, []);
    });

    // --- TC-A06 ---
    it('TC-A06: readMetaJson corrects steps_completed when it is null', () => {
        writeMeta({ ...legacyMeta(), steps_completed: null });
        const meta = readMetaJson(testDir);
        assert.deepStrictEqual(meta.steps_completed, []);
    });

    // --- TC-A07 ---
    it('TC-A07: readMetaJson corrects steps_completed when it is a number', () => {
        writeMeta({ ...legacyMeta(), steps_completed: 42 });
        const meta = readMetaJson(testDir);
        assert.deepStrictEqual(meta.steps_completed, []);
    });

    // --- TC-A08 ---
    it('TC-A08: readMetaJson corrects depth_overrides when it is null', () => {
        writeMeta({ ...legacyMeta(), depth_overrides: null });
        const meta = readMetaJson(testDir);
        assert.deepStrictEqual(meta.depth_overrides, {});
    });

    // --- TC-A09 ---
    it('TC-A09: readMetaJson corrects depth_overrides when it is an array', () => {
        writeMeta({ ...legacyMeta(), depth_overrides: ['brief'] });
        const meta = readMetaJson(testDir);
        assert.deepStrictEqual(meta.depth_overrides, {});
    });

    // --- TC-A10 ---
    it('TC-A10: readMetaJson corrects depth_overrides when it is a string', () => {
        writeMeta({ ...legacyMeta(), depth_overrides: 'brief' });
        const meta = readMetaJson(testDir);
        assert.deepStrictEqual(meta.depth_overrides, {});
    });

    // --- TC-A11 ---
    it('TC-A11: readMetaJson preserves all existing fields alongside new defaults', () => {
        const data = {
            description: 'full item',
            source: 'github',
            source_id: 'GH-20',
            created_at: '2026-02-19T10:00:00.000Z',
            analysis_status: 'partial',
            phases_completed: ['00-quick-scan'],
            codebase_hash: 'abc1234'
        };
        writeMeta(data);
        const meta = readMetaJson(testDir);
        // All original fields preserved
        assert.equal(meta.description, 'full item');
        assert.equal(meta.source, 'github');
        assert.equal(meta.source_id, 'GH-20');
        assert.equal(meta.created_at, '2026-02-19T10:00:00.000Z');
        assert.equal(meta.analysis_status, 'partial');
        assert.deepStrictEqual(meta.phases_completed, ['00-quick-scan']);
        assert.equal(meta.codebase_hash, 'abc1234');
        // New defaults added
        assert.deepStrictEqual(meta.steps_completed, []);
        assert.deepStrictEqual(meta.depth_overrides, {});
    });

    // --- TC-A12 ---
    it('TC-A12: readMetaJson returns null for missing meta.json (unchanged behavior)', () => {
        // testDir exists but has no meta.json
        const result = readMetaJson(testDir);
        assert.equal(result, null);
    });

    // --- TC-A13 ---
    it('TC-A13: readMetaJson returns null for corrupt JSON (unchanged behavior)', () => {
        fs.writeFileSync(path.join(testDir, 'meta.json'), '{not valid json');
        const result = readMetaJson(testDir);
        assert.equal(result, null);
    });

    // --- TC-A14 ---
    it('TC-A14: writeMetaJson preserves steps_completed through write cycle', () => {
        const meta = {
            ...legacyMeta(),
            steps_completed: ['00-01', '00-02']
        };
        writeMetaJson(testDir, meta);
        const written = readMetaRaw();
        assert.deepStrictEqual(written.steps_completed, ['00-01', '00-02']);
    });

    // --- TC-A15 ---
    it('TC-A15: writeMetaJson preserves depth_overrides through write cycle', () => {
        const meta = {
            ...legacyMeta(),
            depth_overrides: { '01-requirements': 'deep' }
        };
        writeMetaJson(testDir, meta);
        const written = readMetaRaw();
        assert.deepStrictEqual(written.depth_overrides, { '01-requirements': 'deep' });
    });

    // --- TC-A16 ---
    it('TC-A16: writeMetaJson succeeds when steps_completed is absent (old callers)', () => {
        const meta = legacyMeta();
        // No steps_completed or depth_overrides on the meta object
        assert.doesNotThrow(() => writeMetaJson(testDir, meta));
        const written = readMetaRaw();
        // File is valid JSON
        assert.ok(typeof written === 'object');
        // steps_completed is not in written file (was undefined on input)
        assert.equal(written.steps_completed, undefined);
    });

    // --- TC-A17 ---
    it('TC-A17: writeMetaJson derives analysis_status from phases_completed only, not steps_completed', () => {
        const meta = {
            ...legacyMeta(),
            phases_completed: ['00-quick-scan'],
            steps_completed: ['00-01', '00-02', '00-03', '01-01', '01-02']
        };
        writeMetaJson(testDir, meta);
        const written = readMetaRaw();
        // 1/5 phases = partial, regardless of 5 steps
        assert.equal(written.analysis_status, 'partial');
    });

    // --- TC-A18 ---
    it('TC-A18: writeMetaJson deletes phase_a_completed but preserves steps_completed', () => {
        const meta = {
            description: 'test',
            source: 'manual',
            created_at: '2026-01-01T00:00:00.000Z',
            phases_completed: [],
            phase_a_completed: true,
            steps_completed: ['00-01']
        };
        writeMetaJson(testDir, meta);
        const written = readMetaRaw();
        assert.equal(written.phase_a_completed, undefined, 'phase_a_completed should be deleted');
        assert.deepStrictEqual(written.steps_completed, ['00-01'], 'steps_completed should be preserved');
    });

    // --- TC-A19 ---
    it('TC-A19: readMetaJson -> writeMetaJson round-trip preserves steps + depth', () => {
        writeMeta({
            ...legacyMeta(),
            steps_completed: ['00-01', '01-01'],
            depth_overrides: { '01-requirements': 'brief' }
        });

        // Read, mutate, write
        const meta = readMetaJson(testDir);
        meta.steps_completed.push('01-02');
        writeMetaJson(testDir, meta);

        // Read back
        const meta2 = readMetaJson(testDir);
        assert.deepStrictEqual(meta2.steps_completed, ['00-01', '01-01', '01-02']);
        assert.deepStrictEqual(meta2.depth_overrides, { '01-requirements': 'brief' });
    });

    // --- TC-A20 ---
    it('TC-A20: readMetaJson handles meta.json with only legacy fields (full backward compat)', () => {
        writeMeta({ phase_a_completed: true, description: 'old item' });
        const meta = readMetaJson(testDir);
        // Legacy migration: phase_a_completed true => analyzed, all 5 phases
        assert.equal(meta.analysis_status, 'analyzed');
        assert.equal(meta.phases_completed.length, 5);
        // New defaults applied
        assert.deepStrictEqual(meta.steps_completed, []);
        assert.deepStrictEqual(meta.depth_overrides, {});
    });
});

// ---------------------------------------------------------------------------
// Suite D: Integration Tests (meta.json step tracking)
// Traces: FR-005, FR-006, NFR-003, NFR-005
// ---------------------------------------------------------------------------

describe('three-verb-utils: meta.json step tracking integration (GH-20)', () => {
    beforeEach(() => {
        createTestDir();
    });

    afterEach(() => {
        cleanupTestDir();
    });

    // --- TC-D01 ---
    it('TC-D01: Simulate step-by-step progression', () => {
        writeMeta({ ...legacyMeta(), steps_completed: [] });

        // Step 1: read, add step, write
        let meta = readMetaJson(testDir);
        meta.steps_completed.push('00-01');
        writeMetaJson(testDir, meta);

        // Verify first step persisted
        meta = readMetaJson(testDir);
        assert.deepStrictEqual(meta.steps_completed, ['00-01']);

        // Step 2: add another step
        meta.steps_completed.push('00-02');
        writeMetaJson(testDir, meta);

        // Verify progressive tracking
        meta = readMetaJson(testDir);
        assert.deepStrictEqual(meta.steps_completed, ['00-01', '00-02']);
    });

    // --- TC-D02 ---
    it('TC-D02: Simulate resume with partial steps', () => {
        writeMeta({
            ...legacyMeta(),
            steps_completed: ['00-01', '00-02', '00-03', '01-01', '01-02'],
            phases_completed: ['00-quick-scan']
        });

        const meta = readMetaJson(testDir);
        // Filter Phase 01 completed steps
        const phase01Completed = meta.steps_completed.filter(s => s.startsWith('01-'));
        assert.deepStrictEqual(phase01Completed, ['01-01', '01-02']);

        // Next step would be 01-03
        const allPhase01Steps = ['01-01', '01-02', '01-03', '01-04', '01-05', '01-06', '01-07', '01-08'];
        const nextStep = allPhase01Steps.find(s => !meta.steps_completed.includes(s));
        assert.equal(nextStep, '01-03');
    });

    // --- TC-D03 ---
    it('TC-D03: Simulate depth override persistence', () => {
        writeMeta({ ...legacyMeta(), depth_overrides: {} });

        let meta = readMetaJson(testDir);
        meta.depth_overrides['01-requirements'] = 'deep';
        writeMetaJson(testDir, meta);

        meta = readMetaJson(testDir);
        assert.equal(meta.depth_overrides['01-requirements'], 'deep');
    });

    // --- TC-D04 ---
    it('TC-D04: Simulate phase completion with steps', () => {
        writeMeta({
            ...legacyMeta(),
            steps_completed: ['00-01', '00-02', '00-03'],
            phases_completed: []
        });

        let meta = readMetaJson(testDir);
        meta.phases_completed.push('00-quick-scan');
        writeMetaJson(testDir, meta);

        meta = readMetaJson(testDir);
        assert.deepStrictEqual(meta.phases_completed, ['00-quick-scan']);
        assert.deepStrictEqual(meta.steps_completed, ['00-01', '00-02', '00-03']);
        assert.equal(meta.analysis_status, 'partial');
    });

    // --- TC-D05 ---
    it('TC-D05: Old meta.json upgraded on read and preserved on write', () => {
        writeMeta({
            description: 'old',
            source: 'manual',
            created_at: '2026-01-01T00:00:00.000Z',
            analysis_status: 'raw',
            phases_completed: ['00-quick-scan']
        });

        // Read -- should add defaults
        let meta = readMetaJson(testDir);
        assert.deepStrictEqual(meta.steps_completed, []);
        assert.deepStrictEqual(meta.depth_overrides, {});

        // Mutate and write
        meta.steps_completed.push('01-01');
        writeMetaJson(testDir, meta);

        // Read back -- verify all preserved
        meta = readMetaJson(testDir);
        assert.equal(meta.description, 'old');
        assert.equal(meta.source, 'manual');
        assert.deepStrictEqual(meta.phases_completed, ['00-quick-scan']);
        assert.deepStrictEqual(meta.steps_completed, ['01-01']);
        assert.deepStrictEqual(meta.depth_overrides, {});
    });
});

// ---------------------------------------------------------------------------
// Suite E: Blast-Radius-Aware Staleness Integration Tests (GH-61)
// Traces: FR-004, FR-005, FR-006, NFR-003, NFR-004
// ---------------------------------------------------------------------------

describe('three-verb-utils: blast-radius staleness integration (GH-61)', () => {

    // Realistic impact-analysis.md content matching actual project format
    const REALISTIC_IMPACT_MD = [
        '# Impact Analysis: REQ-0031 Build Consumption',
        '',
        '## 1. Overview',
        '',
        'This analysis covers the blast radius for the build consumption feature.',
        '',
        '### Directly Affected Files',
        '',
        '| File | Change Type | FR Trace | Impact |',
        '|------|------------|----------|--------|',
        '| `src/claude/commands/isdlc.md` | MODIFY | FR-002 | STEP 1 + Step 4b-4c changes |',
        '| `src/claude/agents/00-sdlc-orchestrator.md` | MODIFY | FR-001 | MODE: init-only |',
        '| `src/claude/hooks/lib/three-verb-utils.cjs` | MODIFY | FR-004, FR-005 | 2 new functions |',
        '| `src/claude/hooks/tests/test-three-verb-utils.test.cjs` | MODIFY | FR-005 | New test suites |',
        '| `src/claude/hooks/tests/test-three-verb-utils-steps.test.cjs` | MODIFY | FR-005 | Integration tests |',
        '',
        '### Indirectly Affected Files',
        '',
        '| File | Change Type | FR Trace | Impact |',
        '|------|------------|----------|--------|',
        '| `src/claude/hooks/config/skills-manifest.json` | NO CHANGE | -- | Skill references |',
        '| `src/claude/hooks/config/iteration-requirements.json` | NO CHANGE | -- | Phase timeouts |'
    ].join('\n');

    // TC-INT-01: Extract + check pipeline with realistic content, no overlap
    it('TC-INT-01: realistic content, no overlap -> silent proceed', () => {
        const files = extractFilesFromImpactAnalysis(REALISTIC_IMPACT_MD);
        assert.equal(files.length, 5);

        const meta = { codebase_hash: 'aaa1111' };
        const changedFiles = ['package.json', 'README.md', 'lib/cli.js'];
        const result = checkBlastRadiusStaleness(meta, 'bbb2222', REALISTIC_IMPACT_MD, changedFiles);
        assert.equal(result.stale, false);
        assert.equal(result.severity, 'none');
        assert.equal(result.overlappingFiles.length, 0);
        assert.equal(result.changedFileCount, 3);
        assert.equal(result.blastRadiusFileCount, 5);
    });

    // TC-INT-02: Extract + check pipeline with realistic content, 2 overlaps (info)
    it('TC-INT-02: realistic content, 2 overlaps -> info', () => {
        const meta = { codebase_hash: 'aaa1111' };
        const changedFiles = [
            'src/claude/commands/isdlc.md',
            'src/claude/hooks/lib/three-verb-utils.cjs',
            'package.json'
        ];
        const result = checkBlastRadiusStaleness(meta, 'bbb2222', REALISTIC_IMPACT_MD, changedFiles);
        assert.equal(result.stale, true);
        assert.equal(result.severity, 'info');
        assert.equal(result.overlappingFiles.length, 2);
    });

    // TC-INT-03: Extract + check pipeline with realistic content, all 5 overlap (warning)
    it('TC-INT-03: realistic content, all 5 overlap -> warning', () => {
        const meta = { codebase_hash: 'aaa1111' };
        const changedFiles = [
            'src/claude/commands/isdlc.md',
            'src/claude/agents/00-sdlc-orchestrator.md',
            'src/claude/hooks/lib/three-verb-utils.cjs',
            'src/claude/hooks/tests/test-three-verb-utils.test.cjs',
            'src/claude/hooks/tests/test-three-verb-utils-steps.test.cjs',
            'package.json'
        ];
        const result = checkBlastRadiusStaleness(meta, 'bbb2222', REALISTIC_IMPACT_MD, changedFiles);
        assert.equal(result.stale, true);
        assert.equal(result.severity, 'warning');
        assert.equal(result.overlappingFiles.length, 5);
    });

    // TC-INT-04: Indirectly affected files are NOT in the blast radius
    it('TC-INT-04: indirectly affected files not extracted', () => {
        const files = extractFilesFromImpactAnalysis(REALISTIC_IMPACT_MD);
        assert.ok(!files.includes('src/claude/hooks/config/skills-manifest.json'));
        assert.ok(!files.includes('src/claude/hooks/config/iteration-requirements.json'));
    });

    // TC-INT-05: Same hash means no staleness regardless of content
    it('TC-INT-05: same hash -> not stale even with blast radius content', () => {
        const meta = { codebase_hash: 'abc1234' };
        const changedFiles = ['src/claude/commands/isdlc.md'];
        const result = checkBlastRadiusStaleness(meta, 'abc1234', REALISTIC_IMPACT_MD, changedFiles);
        assert.equal(result.stale, false);
        assert.equal(result.severity, 'none');
    });

    // TC-INT-06: Fallback when impact analysis missing
    it('TC-INT-06: null impact analysis content -> fallback', () => {
        const meta = { codebase_hash: 'aaa1111' };
        const result = checkBlastRadiusStaleness(meta, 'bbb2222', null, ['src/claude/commands/isdlc.md']);
        assert.equal(result.severity, 'fallback');
        assert.equal(result.fallbackReason, 'no-impact-analysis');
    });

    // TC-INT-07: Fallback when content has no parseable table
    it('TC-INT-07: content without parseable table -> fallback', () => {
        const meta = { codebase_hash: 'aaa1111' };
        const noTableMd = '# Impact Analysis\n\nFreeform text only, no table.\n';
        const result = checkBlastRadiusStaleness(meta, 'bbb2222', noTableMd, ['file.js']);
        assert.equal(result.severity, 'fallback');
        assert.equal(result.fallbackReason, 'no-parseable-table');
    });

    // TC-INT-08: Path normalization pipeline (./ stripped before comparison)
    it('TC-INT-08: path normalization ensures ./ prefixes match git output', () => {
        const md = [
            '### Directly Affected Files',
            '',
            '| File | Change Type |',
            '|------|------------|',
            '| `./src/hooks/lib/utils.cjs` | MODIFY |'
        ].join('\n');
        const meta = { codebase_hash: 'aaa1111' };
        const changedFiles = ['src/hooks/lib/utils.cjs'];
        const result = checkBlastRadiusStaleness(meta, 'bbb2222', md, changedFiles);
        assert.equal(result.stale, true);
        assert.equal(result.severity, 'info');
        assert.equal(result.overlappingFiles.length, 1);
    });

    // TC-INT-09: Full pipeline with meta from readMetaJson
    it('TC-INT-09: full pipeline with readMetaJson round-trip', () => {
        createTestDir();
        try {
            writeMeta({
                description: 'test feature',
                source: 'manual',
                created_at: '2026-02-20T10:00:00.000Z',
                analysis_status: 'analyzed',
                phases_completed: ['00-quick-scan', '01-requirements', '02-impact-analysis', '03-architecture', '04-design'],
                codebase_hash: 'old1234'
            });

            const meta = readMetaJson(testDir);
            const changedFiles = ['src/claude/commands/isdlc.md', 'package.json'];
            const result = checkBlastRadiusStaleness(meta, 'new5678', REALISTIC_IMPACT_MD, changedFiles);
            assert.equal(result.stale, true);
            assert.equal(result.severity, 'info');
            assert.equal(result.originalHash, 'old1234');
            assert.equal(result.currentHash, 'new5678');
        } finally {
            cleanupTestDir();
        }
    });
});
