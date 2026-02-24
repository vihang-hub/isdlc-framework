'use strict';

/**
 * iSDLC Supervised Mode - Unit Test Suite (CJS)
 * ==============================================
 * Tests for supervised mode functions in src/claude/hooks/lib/common.cjs
 *
 * Functions under test:
 * - readSupervisedModeConfig(state)
 * - shouldReviewPhase(config, phaseKey)
 * - generatePhaseSummary(state, phaseKey, projectRoot, options)
 * - recordReviewAction(state, phaseKey, action, details)
 *
 * REQ-0013: Supervised Mode
 * Run: node --test src/claude/hooks/tests/test-supervised-mode.test.cjs
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
    setupTestEnv,
    cleanupTestEnv,
    getTestDir,
    writeState,
    readState
} = require('./hook-test-utils.cjs');

// Source path for common.cjs
const commonSrcPath = path.resolve(__dirname, '..', 'lib', 'common.cjs');

/**
 * Copy common.cjs into the temp test directory so we can require() it
 * without ESM interference from the project-level package.json.
 */
function installCommonCjs() {
    const testDir = getTestDir();
    const libDir = path.join(testDir, 'lib');
    if (!fs.existsSync(libDir)) {
        fs.mkdirSync(libDir, { recursive: true });
    }
    const dest = path.join(libDir, 'common.cjs');
    fs.copyFileSync(commonSrcPath, dest);
    return dest;
}

/** Require common.cjs from the temp dir, clearing cache first. */
function requireCommon(cjsPath) {
    delete require.cache[require.resolve(cjsPath)];
    return require(cjsPath);
}

// =============================================================================
// Test Suite: Supervised Mode Functions (REQ-0013)
// =============================================================================

describe('Supervised Mode Functions (REQ-0013)', () => {
    let common;
    let savedEnv;
    let commonCjsPath;

    before(() => {
        savedEnv = { ...process.env };
        setupTestEnv();
        commonCjsPath = installCommonCjs();
        common = requireCommon(commonCjsPath);
    });

    after(() => {
        cleanupTestEnv();
        process.env = savedEnv;
    });

    /** Helper to get a fresh require of common after file changes. */
    function freshCommon() {
        return requireCommon(commonCjsPath);
    }

    // =========================================================================
    // 1. readSupervisedModeConfig (20 tests)
    // =========================================================================

    describe('readSupervisedModeConfig()', () => {

        // --- 1.1 Valid Configurations ---

        // T01: returns defaults when supervised_mode block is missing (AC-01c)
        it('T01: returns defaults when supervised_mode block is missing', () => {
            const state = { active_workflow: {} };
            const config = common.readSupervisedModeConfig(state);
            assert.deepStrictEqual(config, {
                enabled: false,
                review_phases: 'all',
                parallel_summary: true,
                auto_advance_timeout: null
            });
        });

        // T02: returns enabled=true with valid full config (AC-01a)
        it('T02: returns enabled=true with valid full config', () => {
            const state = {
                supervised_mode: {
                    enabled: true,
                    review_phases: 'all',
                    parallel_summary: true
                }
            };
            const config = common.readSupervisedModeConfig(state);
            assert.equal(config.enabled, true);
            assert.equal(config.review_phases, 'all');
            assert.equal(config.parallel_summary, true);
            assert.equal(config.auto_advance_timeout, null);
        });

        // T03: returns enabled=false with disabled config (AC-01b)
        it('T03: returns enabled=false with disabled config', () => {
            const state = { supervised_mode: { enabled: false } };
            const config = common.readSupervisedModeConfig(state);
            assert.equal(config.enabled, false);
            assert.equal(config.review_phases, 'all');
            assert.equal(config.parallel_summary, true);
            assert.equal(config.auto_advance_timeout, null);
        });

        // T04: normalizes review_phases array with valid entries (AC-01e)
        it('T04: normalizes review_phases array with valid entries', () => {
            const state = {
                supervised_mode: {
                    enabled: true,
                    review_phases: ['03', '04', '06']
                }
            };
            const config = common.readSupervisedModeConfig(state);
            assert.equal(config.enabled, true);
            assert.deepStrictEqual(config.review_phases, ['03', '04', '06']);
        });

        // --- 1.2 Missing/Null State Guards ---

        // T05: returns defaults when state is null (AC-01c, ERR-SM-100)
        it('T05: returns defaults when state is null', () => {
            const config = common.readSupervisedModeConfig(null);
            assert.equal(config.enabled, false);
            assert.equal(config.review_phases, 'all');
            assert.equal(config.parallel_summary, true);
            assert.equal(config.auto_advance_timeout, null);
        });

        // T06: returns defaults when state is undefined (AC-01c, ERR-SM-100)
        it('T06: returns defaults when state is undefined', () => {
            const config = common.readSupervisedModeConfig(undefined);
            assert.equal(config.enabled, false);
        });

        // T07: returns defaults when state is not an object (AC-01c, ERR-SM-100)
        it('T07: returns defaults when state is not an object', () => {
            const config = common.readSupervisedModeConfig('string');
            assert.equal(config.enabled, false);
        });

        // --- 1.3 Invalid supervised_mode Block ---

        // T08: returns defaults when supervised_mode is null (NFR-02, ERR-SM-101)
        it('T08: returns defaults when supervised_mode is null', () => {
            const config = common.readSupervisedModeConfig({ supervised_mode: null });
            assert.equal(config.enabled, false);
        });

        // T09: returns defaults when supervised_mode is an array (NFR-02, ERR-SM-101)
        it('T09: returns defaults when supervised_mode is an array', () => {
            const config = common.readSupervisedModeConfig({ supervised_mode: [1, 2, 3] });
            assert.equal(config.enabled, false);
        });

        // T10: returns defaults when supervised_mode is a string (NFR-02, ERR-SM-101)
        it('T10: returns defaults when supervised_mode is a string', () => {
            const config = common.readSupervisedModeConfig({ supervised_mode: 'true' });
            assert.equal(config.enabled, false);
        });

        // --- 1.4 Invalid enabled Field ---

        // T11: treats string 'true' as false (NFR-02, ERR-SM-102)
        it('T11: treats string "true" as false', () => {
            const config = common.readSupervisedModeConfig({
                supervised_mode: { enabled: 'true' }
            });
            assert.equal(config.enabled, false);
        });

        // T12: treats number 1 as false (NFR-02, ERR-SM-102)
        it('T12: treats number 1 as false', () => {
            const config = common.readSupervisedModeConfig({
                supervised_mode: { enabled: 1 }
            });
            assert.equal(config.enabled, false);
        });

        // T13: treats null as false (NFR-02, ERR-SM-102)
        it('T13: treats null as false', () => {
            const config = common.readSupervisedModeConfig({
                supervised_mode: { enabled: null }
            });
            assert.equal(config.enabled, false);
        });

        // --- 1.5 Invalid review_phases Field ---

        // T14: treats number as 'all' (NFR-02, ERR-SM-103)
        it('T14: treats number as "all"', () => {
            const config = common.readSupervisedModeConfig({
                supervised_mode: { enabled: true, review_phases: 42 }
            });
            assert.equal(config.review_phases, 'all');
        });

        // T15: filters invalid entries from array (AC-01f, ERR-SM-104)
        it('T15: filters invalid entries from array', () => {
            const config = common.readSupervisedModeConfig({
                supervised_mode: { enabled: true, review_phases: ['03', 'invalid', '06', '999'] }
            });
            assert.deepStrictEqual(config.review_phases, ['03', '06']);
        });

        // T16: treats all-invalid array as 'all' (AC-01f, ERR-SM-104)
        it('T16: treats all-invalid array as "all"', () => {
            const config = common.readSupervisedModeConfig({
                supervised_mode: { enabled: true, review_phases: ['invalid', 'abc', '1'] }
            });
            assert.equal(config.review_phases, 'all');
        });

        // T17: preserves valid entries alongside invalid (AC-01f, ERR-SM-104)
        it('T17: preserves valid entries alongside invalid', () => {
            const config = common.readSupervisedModeConfig({
                supervised_mode: { enabled: true, review_phases: ['03', null, 4, '16'] }
            });
            assert.deepStrictEqual(config.review_phases, ['03', '16']);
        });

        // --- 1.6 Invalid parallel_summary Field ---

        // T18: treats string 'false' as true (default) (NFR-02, ERR-SM-105)
        it('T18: treats string "false" as true (default)', () => {
            const config = common.readSupervisedModeConfig({
                supervised_mode: { enabled: true, parallel_summary: 'false' }
            });
            assert.equal(config.parallel_summary, true);
        });

        // T19: treats number 0 as true (default) (NFR-02, ERR-SM-105)
        it('T19: treats number 0 as true (default)', () => {
            const config = common.readSupervisedModeConfig({
                supervised_mode: { enabled: true, parallel_summary: 0 }
            });
            assert.equal(config.parallel_summary, true);
        });

        // --- 1.7 auto_advance_timeout Field ---

        // T20: always returns null regardless of input (CON-013-05, ERR-SM-106)
        it('T20: always returns null regardless of input', () => {
            const config = common.readSupervisedModeConfig({
                supervised_mode: { enabled: true, auto_advance_timeout: 300 }
            });
            assert.equal(config.auto_advance_timeout, null);
        });
    });

    // =========================================================================
    // 2. shouldReviewPhase (16 tests)
    // =========================================================================

    describe('shouldReviewPhase()', () => {

        // --- 2.1 Disabled/Invalid Config ---

        // T21: returns false when config is null (AC-03f)
        it('T21: returns false when config is null', () => {
            assert.equal(common.shouldReviewPhase(null, '03-architecture'), false);
        });

        // T22: returns false when enabled is false (AC-03f)
        it('T22: returns false when enabled is false', () => {
            const config = { enabled: false, review_phases: 'all' };
            assert.equal(common.shouldReviewPhase(config, '03-architecture'), false);
        });

        // T23: returns false when config is undefined (AC-03f)
        it('T23: returns false when config is undefined', () => {
            assert.equal(common.shouldReviewPhase(undefined, '03-architecture'), false);
        });

        // --- 2.2 review_phases = "all" ---

        // T24: returns true for any phase when review_phases is "all" (AC-01d)
        it('T24: returns true for any phase when review_phases is "all"', () => {
            const config = { enabled: true, review_phases: 'all' };
            assert.equal(common.shouldReviewPhase(config, '03-architecture'), true);
        });

        // T25: returns true for implementation phase with "all" (AC-01d)
        it('T25: returns true for implementation phase with "all"', () => {
            const config = { enabled: true, review_phases: 'all' };
            assert.equal(common.shouldReviewPhase(config, '06-implementation'), true);
        });

        // T26: returns true for quality-loop phase with "all" (AC-01d)
        it('T26: returns true for quality-loop phase with "all"', () => {
            const config = { enabled: true, review_phases: 'all' };
            assert.equal(common.shouldReviewPhase(config, '16-quality-loop'), true);
        });

        // --- 2.3 review_phases = Array ---

        // T27: returns true when phase prefix matches array entry (AC-01e)
        it('T27: returns true when phase prefix matches array entry', () => {
            const config = { enabled: true, review_phases: ['03', '04', '06'] };
            assert.equal(common.shouldReviewPhase(config, '03-architecture'), true);
        });

        // T28: returns false when phase prefix not in array (AC-01e)
        it('T28: returns false when phase prefix not in array', () => {
            const config = { enabled: true, review_phases: ['03', '04', '06'] };
            assert.equal(common.shouldReviewPhase(config, '05-test-strategy'), false);
        });

        // T29: returns true for last matching entry (AC-01e)
        it('T29: returns true for last matching entry', () => {
            const config = { enabled: true, review_phases: ['03', '04', '06'] };
            assert.equal(common.shouldReviewPhase(config, '06-implementation'), true);
        });

        // T30: returns false for 16-quality-loop with ['03'] (AC-01e)
        it('T30: returns false for 16-quality-loop with ["03"]', () => {
            const config = { enabled: true, review_phases: ['03'] };
            assert.equal(common.shouldReviewPhase(config, '16-quality-loop'), false);
        });

        // T31: extracts 2-digit prefix correctly from phase key (AC-01e)
        it('T31: extracts 2-digit prefix correctly from phase key', () => {
            const config = { enabled: true, review_phases: ['16'] };
            assert.equal(common.shouldReviewPhase(config, '16-quality-loop'), true);
        });

        // --- 2.4 Invalid Phase Key Inputs ---

        // T32: returns false for null phaseKey
        it('T32: returns false for null phaseKey', () => {
            const config = { enabled: true, review_phases: 'all' };
            assert.equal(common.shouldReviewPhase(config, null), false);
        });

        // T33: returns false for empty string phaseKey
        it('T33: returns false for empty string phaseKey', () => {
            const config = { enabled: true, review_phases: 'all' };
            assert.equal(common.shouldReviewPhase(config, ''), false);
        });

        // T34: returns false for non-string phaseKey
        it('T34: returns false for non-string phaseKey', () => {
            const config = { enabled: true, review_phases: 'all' };
            assert.equal(common.shouldReviewPhase(config, 42), false);
        });

        // --- 2.5 Boundary Cases ---

        // T35: returns false with unexpected review_phases type
        it('T35: returns false with unexpected review_phases type', () => {
            const config = { enabled: true, review_phases: { '03': true } };
            assert.equal(common.shouldReviewPhase(config, '03-architecture'), false);
        });

        // T36: handles single-entry array (AC-01e)
        it('T36: handles single-entry array', () => {
            const config = { enabled: true, review_phases: ['06'] };
            assert.equal(common.shouldReviewPhase(config, '06-implementation'), true);
        });
    });

    // =========================================================================
    // 3. generatePhaseSummary (22 tests)
    // =========================================================================

    describe('generatePhaseSummary()', () => {

        let projectRoot;

        beforeEach(() => {
            projectRoot = getTestDir();
        });

        // --- 3.1 Full Summary Generation ---

        // T37: generates full summary with all sections (AC-02a)
        it('T37: generates full summary with all sections', () => {
            const state = {
                phases: {
                    '03-architecture': {
                        status: 'completed',
                        started: '2026-02-14T10:00:00Z',
                        completed: '2026-02-14T10:30:00Z',
                        artifacts: ['architecture-overview.md', 'adrs/adr-0001.md'],
                        summary: 'Selected interceptor pattern; defined 4 helpers'
                    }
                }
            };

            const result = common.generatePhaseSummary(state, '03-architecture', projectRoot);
            assert.ok(result !== null, 'Should return a file path');
            assert.ok(fs.existsSync(result), 'File should exist');

            const content = fs.readFileSync(result, 'utf8');
            assert.ok(content.includes('# Phase 03 Summary'), 'Should have heading');
            assert.ok(content.includes('**Status**: Completed'), 'Should have status');
            assert.ok(content.includes('**Duration**:'), 'Should have duration');
            assert.ok(content.includes('Key Decisions'), 'Should have Key Decisions');
            assert.ok(content.includes('Artifacts Created'), 'Should have Artifacts');
            assert.ok(content.includes('File Changes'), 'Should have File Changes');
        });

        // T38: includes phase number in heading (AC-02a)
        it('T38: includes phase number in heading', () => {
            const state = {
                phases: { '03-architecture': { status: 'completed' } }
            };
            const result = common.generatePhaseSummary(state, '03-architecture', projectRoot);
            assert.ok(result !== null);
            const content = fs.readFileSync(result, 'utf8');
            assert.ok(content.includes('# Phase 03 Summary: Architecture'));
        });

        // T39: calculates duration from timestamps (AC-02a)
        it('T39: calculates duration from timestamps', () => {
            const state = {
                phases: {
                    '03-architecture': {
                        started: '2026-02-14T10:00:00Z',
                        completed: '2026-02-14T10:30:00Z'
                    }
                }
            };
            const result = common.generatePhaseSummary(state, '03-architecture', projectRoot);
            const content = fs.readFileSync(result, 'utf8');
            assert.ok(content.includes('30m'), 'Should show 30 minutes');
        });

        // T40: includes artifact list in table (AC-02a)
        it('T40: includes artifact list in table', () => {
            const state = {
                phases: {
                    '03-architecture': {
                        artifacts: ['arch.md', 'adrs/']
                    }
                }
            };
            const result = common.generatePhaseSummary(state, '03-architecture', projectRoot);
            const content = fs.readFileSync(result, 'utf8');
            assert.ok(content.includes('| arch.md |'), 'Should include arch.md in table');
            assert.ok(content.includes('| adrs/ |'), 'Should include adrs/ in table');
        });

        // --- 3.2 Minimal Summary ---

        // T41: generates minimal summary without diffs or decisions (AC-02e)
        it('T41: generates minimal summary without diffs or decisions', () => {
            const state = {
                phases: {
                    '03-architecture': {
                        status: 'completed',
                        summary: 'Some decisions here',
                        artifacts: ['file.md']
                    }
                }
            };
            const result = common.generatePhaseSummary(state, '03-architecture', projectRoot, { minimal: true });
            assert.ok(result !== null);
            const content = fs.readFileSync(result, 'utf8');
            assert.ok(!content.includes('Key Decisions'), 'Should NOT have Key Decisions in minimal');
            assert.ok(!content.includes('File Changes'), 'Should NOT have File Changes in minimal');
        });

        // T42: minimal summary still includes artifacts (AC-02e)
        it('T42: minimal summary still includes artifacts', () => {
            const state = {
                phases: {
                    '03-architecture': {
                        artifacts: ['file.md']
                    }
                }
            };
            const result = common.generatePhaseSummary(state, '03-architecture', projectRoot, { minimal: true });
            const content = fs.readFileSync(result, 'utf8');
            assert.ok(content.includes('Artifacts Created/Modified'));
        });

        // T43: minimal summary includes phase name and status (AC-02e)
        it('T43: minimal summary includes phase name and status', () => {
            const state = {
                phases: {
                    '03-architecture': {}
                }
            };
            const result = common.generatePhaseSummary(state, '03-architecture', projectRoot, { minimal: true });
            const content = fs.readFileSync(result, 'utf8');
            assert.ok(content.includes('Architecture'));
            assert.ok(content.includes('Completed'));
        });

        // --- 3.3 Edge Cases -- Missing Data ---

        // T44: handles missing phase data (AC-02b, ERR-SM-200)
        it('T44: handles missing phase data', () => {
            const state = { phases: {} };
            const result = common.generatePhaseSummary(state, '03-architecture', projectRoot);
            assert.ok(result !== null, 'Should still generate a summary');
            const content = fs.readFileSync(result, 'utf8');
            assert.ok(content.includes('N/A'), 'Should show N/A for missing data');
        });

        // T45: handles empty artifacts array (AC-02b, ERR-SM-200)
        it('T45: handles empty artifacts array', () => {
            const state = {
                phases: {
                    '03-architecture': { artifacts: [] }
                }
            };
            const result = common.generatePhaseSummary(state, '03-architecture', projectRoot);
            const content = fs.readFileSync(result, 'utf8');
            assert.ok(content.includes('No file changes recorded'));
        });

        // T46: handles invalid timestamps (AC-02a, ERR-SM-205)
        it('T46: handles invalid timestamps', () => {
            const state = {
                phases: {
                    '03-architecture': {
                        started: 'not-a-date',
                        completed: 'also-not-a-date'
                    }
                }
            };
            const result = common.generatePhaseSummary(state, '03-architecture', projectRoot);
            const content = fs.readFileSync(result, 'utf8');
            assert.ok(content.includes('N/A'), 'Should show N/A for invalid timestamps');
        });

        // T47: handles missing summary text (AC-02b, ERR-SM-200)
        it('T47: handles missing summary text', () => {
            const state = {
                phases: { '03-architecture': {} }
            };
            const result = common.generatePhaseSummary(state, '03-architecture', projectRoot);
            const content = fs.readFileSync(result, 'utf8');
            assert.ok(content.includes('No summary available'));
        });

        // T48: handles null state gracefully (NFR-02, ERR-SM-204)
        it('T48: handles null state gracefully', () => {
            // null state is handled via optional chaining (state?.phases?.[phaseKey])
            // so it degrades to empty phase data rather than throwing
            const result = common.generatePhaseSummary(null, '03-architecture', projectRoot);
            // Function handles null state gracefully -- either returns a path with defaults or null
            assert.ok(result === null || typeof result === 'string',
                'Should handle null state gracefully');
        });

        // --- 3.4 Directory and File Operations ---

        // T49: creates reviews directory if missing (AC-02c)
        it('T49: creates reviews directory if missing', () => {
            const reviewsDir = path.join(projectRoot, '.isdlc', 'reviews');
            if (fs.existsSync(reviewsDir)) {
                fs.rmSync(reviewsDir, { recursive: true, force: true });
            }
            const state = { phases: { '03-architecture': {} } };
            const result = common.generatePhaseSummary(state, '03-architecture', projectRoot);
            assert.ok(result !== null);
            assert.ok(fs.existsSync(reviewsDir), 'Reviews directory should be created');
        });

        // T50: overwrites existing summary file (redo) (AC-02d)
        it('T50: overwrites existing summary file (redo)', () => {
            const reviewsDir = path.join(projectRoot, '.isdlc', 'reviews');
            fs.mkdirSync(reviewsDir, { recursive: true });
            const summaryPath = path.join(reviewsDir, 'phase-03-summary.md');
            fs.writeFileSync(summaryPath, 'OLD CONTENT');

            const state = {
                phases: {
                    '03-architecture': {
                        summary: 'New summary content'
                    }
                }
            };
            const result = common.generatePhaseSummary(state, '03-architecture', projectRoot);
            assert.ok(result !== null);
            const content = fs.readFileSync(result, 'utf8');
            assert.ok(!content.includes('OLD CONTENT'), 'Old content should be overwritten');
            assert.ok(content.includes('New summary content'), 'New content should be present');
        });

        // --- 3.5 Git Diff Handling ---

        // T51: includes git diff output when available (AC-02a)
        it('T51: includes git diff section in full summary', () => {
            const state = {
                phases: {
                    '03-architecture': { status: 'completed' }
                }
            };
            const result = common.generatePhaseSummary(state, '03-architecture', projectRoot);
            const content = fs.readFileSync(result, 'utf8');
            assert.ok(content.includes('File Changes (git diff)'), 'Should have git diff section');
        });

        // T52: handles git not available (AC-02a, ERR-SM-201)
        it('T52: handles git not available', () => {
            // Use a non-git directory
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'no-git-'));
            const isdlcDir = path.join(tmpDir, '.isdlc');
            fs.mkdirSync(isdlcDir, { recursive: true });

            const state = {
                phases: {
                    '03-architecture': { status: 'completed' }
                }
            };
            const result = common.generatePhaseSummary(state, '03-architecture', tmpDir);
            assert.ok(result !== null);
            const content = fs.readFileSync(result, 'utf8');
            assert.ok(
                content.includes('Git diff unavailable') || content.includes('No uncommitted'),
                'Should handle missing git gracefully'
            );
            // Cleanup
            fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        // T53: handles empty git diff (AC-02a)
        it('T53: skips git diff in minimal mode', () => {
            const state = {
                phases: {
                    '03-architecture': { status: 'completed' }
                }
            };
            const result = common.generatePhaseSummary(state, '03-architecture', projectRoot, { minimal: true });
            const content = fs.readFileSync(result, 'utf8');
            assert.ok(!content.includes('File Changes'), 'Minimal should not have git diff');
        });

        // --- 3.6 Error Handling / Fail-Safe ---

        // T54: returns null when directory creation fails (NFR-02, ERR-SM-202)
        it('T54: returns null when projectRoot is invalid', () => {
            const state = {
                phases: { '03-architecture': {} }
            };
            // Use a path that cannot be created
            const result = common.generatePhaseSummary(state, '03-architecture', '/dev/null/impossible/path');
            assert.equal(result, null, 'Should return null on failure');
        });

        // T55: returns null when file write fails (NFR-02, ERR-SM-203)
        it('T55: catch-all handles unexpected errors gracefully', () => {
            // Pass undefined phaseKey to trigger a TypeError in split()
            const result = common.generatePhaseSummary({ phases: {} }, undefined, projectRoot);
            assert.equal(result, null, 'Should return null on TypeError from undefined phaseKey');
        });

        // T56: catch-all returns null on unexpected error (NFR-02, ERR-SM-204)
        it('T56: catch-all returns null on unexpected error', () => {
            // Create state that causes TypeError in processing
            const badState = Object.create(null);  // no prototype
            const result = common.generatePhaseSummary(badState, '03-architecture', projectRoot);
            // Should return a path (since badState has no phases, it handles gracefully)
            // OR null if the error is caught
            // The function is designed to catch all errors
            assert.ok(result === null || typeof result === 'string');
        });

        // --- 3.7 Private Helper: _resolvePhaseDisplayName ---

        // T57: resolves known phase keys to display names (AC-02a)
        it('T57: resolves known phase key to display name', () => {
            const state = { phases: { '03-architecture': {} } };
            const result = common.generatePhaseSummary(state, '03-architecture', projectRoot);
            const content = fs.readFileSync(result, 'utf8');
            assert.ok(content.includes('Architecture'), 'Should resolve to "Architecture"');
        });

        // T58: resolves unknown phase key via fallback (AC-02a)
        it('T58: resolves unknown phase key via fallback', () => {
            const state = { phases: { '99-custom-phase': {} } };
            const result = common.generatePhaseSummary(state, '99-custom-phase', projectRoot);
            const content = fs.readFileSync(result, 'utf8');
            assert.ok(content.includes('Custom Phase'), 'Should derive "Custom Phase" from key');
        });
    });

    // =========================================================================
    // 4. recordReviewAction (16 tests)
    // =========================================================================

    describe('recordReviewAction()', () => {

        // --- 4.1 Continue Action ---

        // T59: records continue action with correct shape (AC-08a)
        it('T59: records continue action with correct shape', () => {
            const state = { active_workflow: { review_history: [] } };
            const result = common.recordReviewAction(state, '03-architecture', 'continue', { timestamp: '2026-02-14T10:30:00Z' });
            assert.equal(result, true);
            assert.equal(state.active_workflow.review_history.length, 1);
            const entry = state.active_workflow.review_history[0];
            assert.equal(entry.phase, '03-architecture');
            assert.equal(entry.action, 'continue');
            assert.equal(entry.timestamp, '2026-02-14T10:30:00Z');
        });

        // T60: auto-generates timestamp if not provided (AC-08a)
        it('T60: auto-generates timestamp if not provided', () => {
            const state = { active_workflow: { review_history: [] } };
            const result = common.recordReviewAction(state, '03-architecture', 'continue', {});
            assert.equal(result, true);
            const entry = state.active_workflow.review_history[0];
            assert.ok(entry.timestamp, 'Should have auto-generated timestamp');
            // Verify it looks like an ISO timestamp
            assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(entry.timestamp), 'Should be ISO format');
        });

        // T61: appends to existing review_history (AC-08a)
        it('T61: appends to existing review_history', () => {
            const existing = { phase: '01-requirements', action: 'continue', timestamp: '2026-02-14T09:00:00Z' };
            const state = { active_workflow: { review_history: [existing] } };
            common.recordReviewAction(state, '03-architecture', 'continue', { timestamp: '2026-02-14T10:30:00Z' });
            assert.equal(state.active_workflow.review_history.length, 2);
            assert.deepStrictEqual(state.active_workflow.review_history[0], existing);
        });

        // --- 4.2 Review Action ---

        // T62: records review action with paused_at and resumed_at (AC-08a)
        it('T62: records review action with paused_at and resumed_at', () => {
            const state = { active_workflow: { review_history: [] } };
            const details = {
                paused_at: '2026-02-14T10:45:00Z',
                resumed_at: '2026-02-14T11:00:00Z',
                timestamp: '2026-02-14T11:00:00Z'
            };
            common.recordReviewAction(state, '04-design', 'review', details);
            const entry = state.active_workflow.review_history[0];
            assert.equal(entry.action, 'review');
            assert.equal(entry.paused_at, '2026-02-14T10:45:00Z');
            assert.equal(entry.resumed_at, '2026-02-14T11:00:00Z');
        });

        // T63: review action includes timestamp from details (AC-08a)
        it('T63: review action includes timestamp from details', () => {
            const state = { active_workflow: { review_history: [] } };
            common.recordReviewAction(state, '04-design', 'review', { timestamp: '2026-02-14T11:00:00Z' });
            const entry = state.active_workflow.review_history[0];
            assert.equal(entry.timestamp, '2026-02-14T11:00:00Z');
        });

        // T64: review action spreads additional detail fields (AC-08a)
        it('T64: review action spreads additional detail fields', () => {
            const state = { active_workflow: { review_history: [] } };
            const details = {
                timestamp: '2026-02-14T11:00:00Z',
                custom_field: 'custom_value'
            };
            common.recordReviewAction(state, '04-design', 'review', details);
            const entry = state.active_workflow.review_history[0];
            assert.equal(entry.custom_field, 'custom_value');
        });

        // --- 4.3 Redo Action ---

        // T65: records redo action with redo_count and guidance (AC-08a)
        it('T65: records redo action with redo_count and guidance', () => {
            const state = { active_workflow: { review_history: [] } };
            const details = {
                redo_count: 1,
                guidance: 'Focus on error handling',
                timestamp: '2026-02-14T11:30:00Z'
            };
            common.recordReviewAction(state, '06-implementation', 'redo', details);
            const entry = state.active_workflow.review_history[0];
            assert.equal(entry.action, 'redo');
            assert.equal(entry.redo_count, 1);
            assert.equal(entry.guidance, 'Focus on error handling');
        });

        // T66: records redo action with high redo_count (AC-08a)
        it('T66: records redo action with high redo_count', () => {
            const state = { active_workflow: { review_history: [] } };
            common.recordReviewAction(state, '06-implementation', 'redo', {
                redo_count: 3,
                timestamp: '2026-02-14T11:30:00Z'
            });
            assert.equal(state.active_workflow.review_history[0].redo_count, 3);
        });

        // T67: records redo with empty guidance (AC-08a)
        it('T67: records redo with empty guidance', () => {
            const state = { active_workflow: { review_history: [] } };
            common.recordReviewAction(state, '06-implementation', 'redo', {
                guidance: '',
                timestamp: '2026-02-14T11:30:00Z'
            });
            assert.equal(state.active_workflow.review_history[0].guidance, '');
        });

        // --- 4.4 Array Initialization ---

        // T68: initializes review_history when missing (AC-08a, ERR-SM-700)
        it('T68: initializes review_history when missing', () => {
            const state = { active_workflow: {} };
            const result = common.recordReviewAction(state, '03-architecture', 'continue', { timestamp: '2026-02-14T10:30:00Z' });
            assert.equal(result, true);
            assert.ok(Array.isArray(state.active_workflow.review_history));
            assert.equal(state.active_workflow.review_history.length, 1);
        });

        // T69: re-initializes review_history when not an array (AC-08a, ERR-SM-700)
        it('T69: re-initializes review_history when not an array', () => {
            const state = { active_workflow: { review_history: 'not-array' } };
            const result = common.recordReviewAction(state, '03-architecture', 'continue', { timestamp: '2026-02-14T10:30:00Z' });
            assert.equal(result, true);
            assert.ok(Array.isArray(state.active_workflow.review_history));
            assert.equal(state.active_workflow.review_history.length, 1);
        });

        // --- 4.5 Guard Clauses ---

        // T70: returns false when state is null (AC-08a, ERR-SM-701)
        it('T70: returns false when state is null', () => {
            assert.equal(common.recordReviewAction(null, '03-architecture', 'continue'), false);
        });

        // T71: returns false when active_workflow is missing (AC-08a, ERR-SM-701)
        it('T71: returns false when active_workflow is missing', () => {
            assert.equal(common.recordReviewAction({}, '03-architecture', 'continue'), false);
        });

        // T72: returns true on successful recording (AC-08a)
        it('T72: returns true on successful recording', () => {
            const state = { active_workflow: {} };
            assert.equal(common.recordReviewAction(state, '03-architecture', 'continue', { timestamp: 'now' }), true);
        });

        // --- 4.6 Append Behavior ---

        // T73: preserves order of entries (AC-08a)
        it('T73: preserves order of entries', () => {
            const state = { active_workflow: { review_history: [] } };
            common.recordReviewAction(state, '01-requirements', 'continue', { timestamp: 't1' });
            common.recordReviewAction(state, '03-architecture', 'review', { timestamp: 't2' });
            common.recordReviewAction(state, '06-implementation', 'redo', { timestamp: 't3' });
            assert.equal(state.active_workflow.review_history.length, 3);
            assert.equal(state.active_workflow.review_history[0].phase, '01-requirements');
            assert.equal(state.active_workflow.review_history[1].phase, '03-architecture');
            assert.equal(state.active_workflow.review_history[2].phase, '06-implementation');
        });

        // T74: does not mutate details object
        it('T74: does not mutate details object', () => {
            const state = { active_workflow: {} };
            const details = { timestamp: '2026-02-14T10:30:00Z' };
            const detailsCopy = { ...details };
            common.recordReviewAction(state, '03-architecture', 'continue', details);
            assert.deepStrictEqual(details, detailsCopy, 'Details object should not be mutated');
        });
    });

    // =========================================================================
    // 5. Schema Validation Tests (6 tests)
    // =========================================================================

    describe('Schema validation', () => {

        it('S01: readSupervisedModeConfig return shape has all required fields', () => {
            const config = common.readSupervisedModeConfig({});
            assert.ok('enabled' in config, 'Must have enabled field');
            assert.ok('review_phases' in config, 'Must have review_phases field');
            assert.ok('parallel_summary' in config, 'Must have parallel_summary field');
            assert.ok('auto_advance_timeout' in config, 'Must have auto_advance_timeout field');
        });

        it('S02: readSupervisedModeConfig return types are correct', () => {
            const config = common.readSupervisedModeConfig({
                supervised_mode: { enabled: true, review_phases: ['03'], parallel_summary: false }
            });
            assert.equal(typeof config.enabled, 'boolean');
            assert.ok(Array.isArray(config.review_phases));
            assert.equal(typeof config.parallel_summary, 'boolean');
            assert.equal(config.auto_advance_timeout, null);
        });

        it('S03: shouldReviewPhase returns boolean', () => {
            const result = common.shouldReviewPhase({ enabled: true, review_phases: 'all' }, '03-architecture');
            assert.equal(typeof result, 'boolean');
        });

        it('S04: generatePhaseSummary returns string or null', () => {
            const result = common.generatePhaseSummary({ phases: {} }, '03-architecture', getTestDir());
            assert.ok(result === null || typeof result === 'string');
        });

        it('S05: recordReviewAction returns boolean', () => {
            const result = common.recordReviewAction({ active_workflow: {} }, '03-architecture', 'continue', {});
            assert.equal(typeof result, 'boolean');
        });

        it('S06: recordReviewAction entry has required fields', () => {
            const state = { active_workflow: {} };
            common.recordReviewAction(state, '03-architecture', 'continue', { timestamp: 'now' });
            const entry = state.active_workflow.review_history[0];
            assert.ok('phase' in entry, 'Must have phase');
            assert.ok('action' in entry, 'Must have action');
            assert.ok('timestamp' in entry, 'Must have timestamp');
        });
    });
});
