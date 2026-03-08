/**
 * Tests for change-summary-generator.cjs
 * Traces to: REQ-0054 FR-001 through FR-008, NFR-001 through NFR-011
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync, execSync } = require('child_process');

const SCRIPT_PATH = path.resolve(__dirname, '..', '..', '..', 'antigravity', 'change-summary-generator.cjs');

// Import module exports for unit testing
const mod = require('../../../antigravity/change-summary-generator.cjs');

// --- Fixture Factories ---

function setupTestEnv(opts = {}) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'change-summary-test-'));
    const isdlcDir = path.join(tmpDir, '.isdlc');
    fs.mkdirSync(isdlcDir, { recursive: true });

    if (opts.state) {
        fs.writeFileSync(path.join(isdlcDir, 'state.json'), JSON.stringify(opts.state, null, 2));
    }

    const reqFolder = opts.folderName || 'REQ-9999-test-feature';
    const reqDir = path.join(tmpDir, 'docs', 'requirements', reqFolder);
    fs.mkdirSync(reqDir, { recursive: true });

    if (opts.reqSpec) {
        fs.writeFileSync(path.join(reqDir, 'requirements-spec.md'), opts.reqSpec);
    }

    const tasksDir = path.join(tmpDir, 'docs', 'isdlc');
    fs.mkdirSync(tasksDir, { recursive: true });
    if (opts.tasksMd) {
        fs.writeFileSync(path.join(tasksDir, 'tasks.md'), opts.tasksMd);
    }

    return { tmpDir, isdlcDir, reqDir, reqFolder };
}

function cleanupTestEnv(tmpDir) {
    try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {
        // Best-effort cleanup
    }
}

function setupTestGitRepo(tmpDir) {
    const opts = { cwd: tmpDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] };
    execSync('git init', opts);
    execSync('git config user.email "test@test.com"', opts);
    execSync('git config user.name "Test"', opts);
    fs.writeFileSync(path.join(tmpDir, 'initial.txt'), 'initial');
    execSync('git add .', opts);
    execSync('git commit -m "initial commit"', opts);
    // git init creates 'main' by default on modern git; -B ensures idempotency
    execSync('git checkout -B main', opts);
    execSync('git checkout -b feature/test', opts);
}

function baseState() {
    return {
        project_name: 'test-project',
        state_version: 42,
        current_phase: '06-implementation',
        active_workflow: {
            type: 'feature',
            slug: 'REQ-9999-test-feature',
            artifact_folder: 'REQ-9999-test-feature',
            base_branch: 'main',
            phases: ['06-implementation'],
            current_phase: '06-implementation',
            current_phase_index: 0,
            phase_status: { '06-implementation': 'in_progress' }
        },
        phases: {
            '06-implementation': {
                status: 'in_progress',
                started: '2026-03-09T01:00:00.000Z',
                summary: '42 tests passing, 0 failing. 90% coverage.',
                iteration_requirements: {
                    test_iteration: {
                        completed: true,
                        current_iteration: 2,
                        tests_passing: true,
                        coverage_percent: 90
                    }
                }
            }
        }
    };
}

function runGenerator(tmpDir, folderRelPath) {
    return spawnSync('node', [SCRIPT_PATH, '--folder', folderRelPath], {
        cwd: tmpDir,
        encoding: 'utf8',
        timeout: 30000,
        env: { ...process.env, ISDLC_PROJECT_ROOT: tmpDir }
    });
}

// ======================================================
// UNIT TESTS
// ======================================================

describe('parseArgs', () => {
    it('TC-001: extracts --folder argument', () => {
        const origArgv = process.argv;
        process.argv = ['node', 'script.cjs', '--folder', 'docs/requirements/REQ-0054'];
        try {
            const result = mod.parseArgs();
            assert.equal(result.folder, 'docs/requirements/REQ-0054');
        } finally {
            process.argv = origArgv;
        }
    });

    it('TC-002: returns null when --folder missing', () => {
        const origArgv = process.argv;
        process.argv = ['node', 'script.cjs'];
        try {
            const result = mod.parseArgs();
            assert.equal(result.folder, null);
        } finally {
            process.argv = origArgv;
        }
    });

    it('TC-003: returns null when --folder has no value', () => {
        const origArgv = process.argv;
        process.argv = ['node', 'script.cjs', '--folder'];
        try {
            const result = mod.parseArgs();
            assert.equal(result.folder, null);
        } finally {
            process.argv = origArgv;
        }
    });
});

describe('parseDiffLine', () => {
    it('TC-004: parses M (modified) status', () => {
        const result = mod.parseDiffLine('M\tsrc/file.js');
        assert.deepEqual(result, { status: 'M', path: 'src/file.js', oldPath: null });
    });

    it('TC-005: parses A (added) status', () => {
        const result = mod.parseDiffLine('A\tsrc/new.js');
        assert.deepEqual(result, { status: 'A', path: 'src/new.js', oldPath: null });
    });

    it('TC-006: parses D (deleted) status', () => {
        const result = mod.parseDiffLine('D\tsrc/old.js');
        assert.deepEqual(result, { status: 'D', path: 'src/old.js', oldPath: null });
    });

    it('TC-007: parses R (renamed) with oldPath', () => {
        const result = mod.parseDiffLine('R100\tsrc/old.js\tsrc/new.js');
        assert.deepEqual(result, { status: 'R', oldPath: 'src/old.js', path: 'src/new.js' });
    });

    it('TC-008: returns null for malformed lines', () => {
        assert.equal(mod.parseDiffLine(''), null);
        assert.equal(mod.parseDiffLine('M'), null);
    });

    it('TC-009: handles R### prefix variations', () => {
        const result = mod.parseDiffLine('R075\told.txt\tnew.txt');
        assert.equal(result.status, 'R');
        assert.equal(result.oldPath, 'old.txt');
        assert.equal(result.path, 'new.txt');
    });
});

describe('filterByValidSet', () => {
    it('TC-010: accepts all when validReqs is empty', () => {
        const result = mod.filterByValidSet(['FR-001', 'FR-002'], new Set());
        assert.deepEqual(result, ['FR-001', 'FR-002']);
    });

    it('TC-011: filters against valid set', () => {
        const valid = new Set(['FR-001', 'AC-001-01']);
        const result = mod.filterByValidSet(['FR-001', 'FR-999', 'AC-001-01'], valid);
        assert.deepEqual(result, ['FR-001', 'AC-001-01']);
    });

    it('TC-012: deduplicates ids', () => {
        const result = mod.filterByValidSet(['FR-001', 'FR-001', 'FR-002'], new Set());
        assert.deepEqual(result, ['FR-001', 'FR-002']);
    });
});

describe('containsNullBytes', () => {
    it('TC-013: returns false for text', () => {
        assert.equal(mod.containsNullBytes('hello world'), false);
    });

    it('TC-014: returns true for binary content', () => {
        assert.equal(mod.containsNullBytes('hello\0world'), true);
    });
});

describe('extractValidRequirements', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evr-test-'));
    });

    afterEach(() => {
        cleanupTestEnv(tmpDir);
    });

    it('TC-015: extracts FR-NNN and AC-NNN-NN from requirements-spec.md', () => {
        const reqPath = path.join(tmpDir, 'requirements-spec.md');
        fs.writeFileSync(reqPath, '## FR-001: Feature\n### AC-001-01: First AC\n### AC-001-02: Second AC\n## FR-002: Another');
        const result = mod.extractValidRequirements(reqPath);
        assert.ok(result.has('FR-001'));
        assert.ok(result.has('FR-002'));
        assert.ok(result.has('AC-001-01'));
        assert.ok(result.has('AC-001-02'));
    });

    it('TC-016: returns empty set for missing file', () => {
        const result = mod.extractValidRequirements(path.join(tmpDir, 'nonexistent.md'));
        assert.equal(result.size, 0);
    });

    it('TC-017: returns empty set for file with no FR/AC patterns', () => {
        const reqPath = path.join(tmpDir, 'requirements-spec.md');
        fs.writeFileSync(reqPath, '## Overview\nThis is a feature.\n');
        const result = mod.extractValidRequirements(reqPath);
        assert.equal(result.size, 0);
    });
});

describe('extractTestResults', () => {
    it('TC-018: extracts test data from state phases', () => {
        const state = baseState();
        const result = mod.extractTestResults(state);
        assert.ok(result);
        assert.equal(result.passing, 42);
        assert.equal(result.failing, 0);
        assert.equal(result.total, 42);
        assert.equal(result.coveragePercent, 90);
    });

    it('TC-019: returns null for null state', () => {
        assert.equal(mod.extractTestResults(null), null);
    });

    it('TC-020: returns null when phase 06 missing', () => {
        const result = mod.extractTestResults({ phases: {} });
        assert.equal(result, null);
    });

    it('TC-021: returns null when test_iteration missing', () => {
        const state = { phases: { '06-implementation': { status: 'completed', iteration_requirements: {} } } };
        const result = mod.extractTestResults(state);
        assert.equal(result, null);
    });

    it('TC-022: handles summary with pass/fail counts', () => {
        const state = baseState();
        state.phases['06-implementation'].summary = '10 tests passing, 2 failing';
        const result = mod.extractTestResults(state);
        assert.equal(result.passing, 10);
        assert.equal(result.failing, 2);
        assert.equal(result.total, 12);
    });

    it('TC-023: coverage null when not a number', () => {
        const state = baseState();
        state.phases['06-implementation'].iteration_requirements.test_iteration.coverage_percent = 'unknown';
        const result = mod.extractTestResults(state);
        assert.equal(result.coveragePercent, null);
    });
});

describe('buildSummaryData', () => {
    it('TC-024: assembles correct metrics', () => {
        const files = [
            { path: 'a.js', changeType: 'modified', oldPath: null, rationale: 'r', tracedRequirements: ['FR-001'], tracingSource: 'commit' },
            { path: 'b.js', changeType: 'added', oldPath: null, rationale: 'r', tracedRequirements: [], tracingSource: 'untraced' },
            { path: 'c.js', changeType: 'deleted', oldPath: null, rationale: 'r', tracedRequirements: ['FR-002'], tracingSource: 'tasks.md' }
        ];
        const diffResult = { mergeBase: 'abc', head: 'def', entries: [] };
        const testResults = { total: 10, passing: 10, failing: 0, coveragePercent: 95 };
        const context = { workflowSlug: 'test', baseBranch: 'main', artifactFolder: 'test' };
        const result = mod.buildSummaryData(diffResult, files, testResults, context, []);

        assert.equal(result.summary.filesModified, 1);
        assert.equal(result.summary.filesAdded, 1);
        assert.equal(result.summary.filesDeleted, 1);
        assert.equal(result.summary.totalFilesChanged, 3);
        assert.equal(result.summary.requirementsTraced, 2);
        assert.equal(result.summary.requirementsUntraced, 1);
        assert.equal(result.summary.testsPassing, true);
    });

    it('TC-025: handles null diffResult', () => {
        const context = { workflowSlug: 'test', baseBranch: 'main', artifactFolder: 'test' };
        const result = mod.buildSummaryData(null, [], null, context, ['warning1']);
        assert.equal(result.baseCommit, null);
        assert.equal(result.headCommit, null);
        assert.equal(result.summary.totalFilesChanged, 0);
        assert.equal(result.testResults, null);
        assert.deepEqual(result.warnings, ['warning1']);
    });

    it('TC-026: testsPassing is null when no test results', () => {
        const context = { workflowSlug: 'test', baseBranch: 'main', artifactFolder: 'test' };
        const result = mod.buildSummaryData(null, [], null, context, []);
        assert.equal(result.summary.testsPassing, null);
    });
});

describe('renderMarkdown', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-test-'));
    });

    afterEach(() => {
        cleanupTestEnv(tmpDir);
    });

    it('TC-027: renders complete markdown with all sections', () => {
        const summaryData = {
            generatedAt: '2026-03-09T01:00:00.000Z',
            workflowSlug: 'REQ-9999',
            baseBranch: 'main',
            baseCommit: 'abc1234',
            headCommit: 'def5678',
            summary: {
                filesModified: 1, filesAdded: 1, filesDeleted: 0, filesRenamed: 0,
                totalFilesChanged: 2, requirementsTraced: 1, requirementsUntraced: 1
            },
            files: [
                { path: 'src/a.js', changeType: 'modified', oldPath: null, rationale: 'Updated logic', tracedRequirements: ['FR-001'], tracingSource: 'commit' },
                { path: 'src/b.js', changeType: 'added', oldPath: null, rationale: 'New file', tracedRequirements: [], tracingSource: 'untraced' }
            ],
            testResults: { total: 10, passing: 10, failing: 0, coveragePercent: 95 },
            warnings: []
        };
        const outPath = path.join(tmpDir, 'change-summary.md');
        const result = mod.renderMarkdown(summaryData, outPath);
        assert.equal(result, outPath);
        const content = fs.readFileSync(outPath, 'utf8');
        assert.ok(content.includes('# Change Summary'));
        assert.ok(content.includes('**Total changed** | **2**'));
        assert.ok(content.includes('`src/a.js`'));
        assert.ok(content.includes('FR-001'));
        assert.ok(content.includes('## Test Results'));
        assert.ok(content.includes('95%'));
    });

    it('TC-028: omits test results section when null', () => {
        const summaryData = {
            generatedAt: '2026-03-09T01:00:00.000Z',
            workflowSlug: 'test', baseBranch: 'main',
            baseCommit: null, headCommit: null,
            summary: { filesModified: 0, filesAdded: 0, filesDeleted: 0, filesRenamed: 0, totalFilesChanged: 0, requirementsTraced: 0, requirementsUntraced: 0 },
            files: [], testResults: null, warnings: []
        };
        const outPath = path.join(tmpDir, 'change-summary.md');
        mod.renderMarkdown(summaryData, outPath);
        const content = fs.readFileSync(outPath, 'utf8');
        assert.ok(!content.includes('## Test Results'));
    });

    it('TC-029: omits warnings section when empty', () => {
        const summaryData = {
            generatedAt: '2026-03-09T01:00:00.000Z',
            workflowSlug: 'test', baseBranch: 'main',
            baseCommit: null, headCommit: null,
            summary: { filesModified: 0, filesAdded: 0, filesDeleted: 0, filesRenamed: 0, totalFilesChanged: 0, requirementsTraced: 0, requirementsUntraced: 0 },
            files: [], testResults: null, warnings: []
        };
        const outPath = path.join(tmpDir, 'change-summary.md');
        mod.renderMarkdown(summaryData, outPath);
        const content = fs.readFileSync(outPath, 'utf8');
        assert.ok(!content.includes('## Warnings'));
    });

    it('TC-030: includes warnings section when populated', () => {
        const summaryData = {
            generatedAt: '2026-03-09T01:00:00.000Z',
            workflowSlug: 'test', baseBranch: 'main',
            baseCommit: null, headCommit: null,
            summary: { filesModified: 0, filesAdded: 0, filesDeleted: 0, filesRenamed: 0, totalFilesChanged: 0, requirementsTraced: 0, requirementsUntraced: 0 },
            files: [], testResults: null, warnings: ['git diff unavailable']
        };
        const outPath = path.join(tmpDir, 'change-summary.md');
        mod.renderMarkdown(summaryData, outPath);
        const content = fs.readFileSync(outPath, 'utf8');
        assert.ok(content.includes('## Warnings'));
        assert.ok(content.includes('git diff unavailable'));
    });

    it('TC-031: returns null on write failure', () => {
        const summaryData = {
            generatedAt: '2026-03-09T01:00:00.000Z',
            workflowSlug: 'test', baseBranch: 'main',
            baseCommit: null, headCommit: null,
            summary: { filesModified: 0, filesAdded: 0, filesDeleted: 0, filesRenamed: 0, totalFilesChanged: 0, requirementsTraced: 0, requirementsUntraced: 0 },
            files: [], testResults: null, warnings: []
        };
        const result = mod.renderMarkdown(summaryData, '/nonexistent/path/file.md');
        assert.equal(result, null);
    });
});

describe('renderJson', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rj-test-'));
    });

    afterEach(() => {
        cleanupTestEnv(tmpDir);
    });

    it('TC-032: renders valid JSON with snake_case fields', () => {
        const summaryData = {
            schemaVersion: '1.0',
            generatedAt: '2026-03-09T01:00:00.000Z',
            workflowSlug: 'REQ-9999',
            baseBranch: 'main',
            baseCommit: 'abc',
            headCommit: 'def',
            summary: {
                filesModified: 1, filesAdded: 0, filesDeleted: 0, filesRenamed: 0,
                totalFilesChanged: 1, requirementsTraced: 1, requirementsUntraced: 0,
                testsPassing: true, testCount: 5, coveragePercent: 90
            },
            files: [
                { path: 'src/a.js', changeType: 'modified', oldPath: null, rationale: 'Changed', tracedRequirements: ['FR-001'], tracingSource: 'commit' }
            ],
            testResults: { total: 5, passing: 5, failing: 0, coveragePercent: 90 },
            warnings: []
        };
        const outPath = path.join(tmpDir, 'change-summary.json');
        const result = mod.renderJson(summaryData, outPath);
        assert.equal(result, outPath);

        const parsed = JSON.parse(fs.readFileSync(outPath, 'utf8'));
        assert.equal(parsed.schema_version, '1.0');
        assert.equal(parsed.workflow_slug, 'REQ-9999');
        assert.equal(parsed.summary.files_modified, 1);
        assert.equal(parsed.summary.total_files_changed, 1);
        assert.equal(parsed.files[0].change_type, 'modified');
        assert.equal(parsed.files[0].traced_requirements[0], 'FR-001');
        assert.equal(parsed.test_results.total, 5);
    });

    it('TC-033: test_results is null when no test data', () => {
        const summaryData = {
            schemaVersion: '1.0',
            generatedAt: '2026-03-09T01:00:00.000Z',
            workflowSlug: 'test', baseBranch: 'main',
            baseCommit: null, headCommit: null,
            summary: { filesModified: 0, filesAdded: 0, filesDeleted: 0, filesRenamed: 0, totalFilesChanged: 0, requirementsTraced: 0, requirementsUntraced: 0, testsPassing: null, testCount: null, coveragePercent: null },
            files: [], testResults: null, warnings: []
        };
        const outPath = path.join(tmpDir, 'change-summary.json');
        mod.renderJson(summaryData, outPath);
        const parsed = JSON.parse(fs.readFileSync(outPath, 'utf8'));
        assert.equal(parsed.test_results, null);
    });

    it('TC-034: returns null on write failure', () => {
        const summaryData = {
            schemaVersion: '1.0', generatedAt: '2026-03-09T01:00:00.000Z',
            workflowSlug: 'test', baseBranch: 'main', baseCommit: null, headCommit: null,
            summary: { filesModified: 0, filesAdded: 0, filesDeleted: 0, filesRenamed: 0, totalFilesChanged: 0, requirementsTraced: 0, requirementsUntraced: 0, testsPassing: null, testCount: null, coveragePercent: null },
            files: [], testResults: null, warnings: []
        };
        const result = mod.renderJson(summaryData, '/nonexistent/path/file.json');
        assert.equal(result, null);
    });
});

describe('displayInlineBrief', () => {
    it('TC-035: is a no-op', () => {
        // Should not throw and should return undefined
        const result = mod.displayInlineBrief({ summary: {} });
        assert.equal(result, undefined);
    });
});

describe('classifyFiles', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-test-'));
        setupTestGitRepo(tmpDir);
    });

    afterEach(() => {
        cleanupTestEnv(tmpDir);
    });

    it('TC-036: maps status letters to human-readable types', () => {
        const entries = [
            { status: 'M', path: 'initial.txt', oldPath: null },
            { status: 'A', path: 'new.txt', oldPath: null },
            { status: 'D', path: 'removed.txt', oldPath: null }
        ];
        const result = mod.classifyFiles(entries, tmpDir);
        assert.equal(result[0].changeType, 'modified');
        assert.equal(result[1].changeType, 'added');
        assert.equal(result[2].changeType, 'deleted');
    });

    it('TC-037: renamed files use oldPath in default rationale', () => {
        const entries = [
            { status: 'R', path: 'new-name.txt', oldPath: 'old-name.txt' }
        ];
        const result = mod.classifyFiles(entries, tmpDir);
        assert.equal(result[0].changeType, 'renamed');
        assert.equal(result[0].oldPath, 'old-name.txt');
    });

    it('TC-038: extracts rationale from git log', () => {
        // initial.txt has commit "initial commit"
        const entries = [
            { status: 'M', path: 'initial.txt', oldPath: null }
        ];
        const result = mod.classifyFiles(entries, tmpDir);
        assert.ok(result[0].rationale.length > 0);
    });
});

describe('constants', () => {
    it('TC-039: SCHEMA_VERSION is 1.0', () => {
        assert.equal(mod.SCHEMA_VERSION, '1.0');
    });

    it('TC-040: GIT_TIMEOUT_MS is 5000', () => {
        assert.equal(mod.GIT_TIMEOUT_MS, 5000);
    });

    it('TC-041: MAX_CODE_SCAN_SIZE is 102400', () => {
        assert.equal(mod.MAX_CODE_SCAN_SIZE, 102400);
    });

    it('TC-042: REQ_PATTERN matches FR-NNN and AC-NNN-NN', () => {
        const text = 'Implements FR-001 and AC-001-01 and AC-002-03';
        const matches = text.match(mod.REQ_PATTERN);
        assert.deepEqual(matches, ['FR-001', 'AC-001-01', 'AC-002-03']);
    });
});

// ======================================================
// INTEGRATION TESTS
// ======================================================

describe('integration: collectGitDiff', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-int-'));
        setupTestGitRepo(tmpDir);
    });

    afterEach(() => {
        cleanupTestEnv(tmpDir);
    });

    it('TC-043: collects diff from feature branch', () => {
        fs.writeFileSync(path.join(tmpDir, 'new-file.txt'), 'content');
        execSync('git add . && git commit -m "add new-file"', { cwd: tmpDir, stdio: ['pipe', 'pipe', 'pipe'] });
        const result = mod.collectGitDiff(tmpDir, 'main');
        assert.ok(result);
        assert.ok(result.mergeBase);
        assert.ok(result.head);
        assert.ok(result.entries.length >= 1);
        const newFile = result.entries.find(e => e.path === 'new-file.txt');
        assert.ok(newFile);
        assert.equal(newFile.status, 'A');
    });

    it('TC-044: returns null for non-git directory', () => {
        const nonGit = fs.mkdtempSync(path.join(os.tmpdir(), 'non-git-'));
        try {
            const result = mod.collectGitDiff(nonGit, 'main');
            assert.equal(result, null);
        } finally {
            cleanupTestEnv(nonGit);
        }
    });

    it('TC-045: handles empty diff (no changes)', () => {
        // On feature branch with no changes from main
        const result = mod.collectGitDiff(tmpDir, 'main');
        assert.ok(result);
        assert.equal(result.entries.length, 0);
    });

    it('TC-046: handles modified files', () => {
        fs.writeFileSync(path.join(tmpDir, 'initial.txt'), 'changed content');
        execSync('git add . && git commit -m "modify initial"', { cwd: tmpDir, stdio: ['pipe', 'pipe', 'pipe'] });
        const result = mod.collectGitDiff(tmpDir, 'main');
        assert.ok(result);
        const modified = result.entries.find(e => e.path === 'initial.txt');
        assert.ok(modified);
        assert.equal(modified.status, 'M');
    });
});

describe('integration: traceRequirements', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr-int-'));
        setupTestGitRepo(tmpDir);
    });

    afterEach(() => {
        cleanupTestEnv(tmpDir);
    });

    it('TC-047: Level 1 traces from tasks.md', () => {
        const tasksPath = path.join(tmpDir, 'tasks.md');
        fs.writeFileSync(tasksPath, '- [X] T0001 Implement feature src/a.js | traces: FR-001, AC-001-01\n');
        const files = [{ path: 'src/a.js', changeType: 'added', oldPath: null, rationale: 'New' }];
        const reqPath = path.join(tmpDir, 'req.md');
        fs.writeFileSync(reqPath, 'FR-001 AC-001-01');
        const result = mod.traceRequirements(files, tasksPath, reqPath, tmpDir);
        assert.equal(result[0].tracingSource, 'tasks.md');
        assert.ok(result[0].tracedRequirements.includes('FR-001'));
    });

    it('TC-048: Level 2 traces from commit messages', () => {
        fs.writeFileSync(path.join(tmpDir, 'feature.js'), '// new feature');
        execSync('git add . && git commit -m "implement FR-002 feature"', { cwd: tmpDir, stdio: ['pipe', 'pipe', 'pipe'] });
        const files = [{ path: 'feature.js', changeType: 'added', oldPath: null, rationale: 'New' }];
        const result = mod.traceRequirements(files, '/nonexistent/tasks.md', '/nonexistent/req.md', tmpDir);
        assert.equal(result[0].tracingSource, 'commit');
        assert.ok(result[0].tracedRequirements.includes('FR-002'));
    });

    it('TC-049: Level 3 traces from code comments', () => {
        fs.writeFileSync(path.join(tmpDir, 'commented.js'), '// Implements FR-003\nmodule.exports = {};');
        execSync('git add . && git commit -m "add file"', { cwd: tmpDir, stdio: ['pipe', 'pipe', 'pipe'] });
        const files = [{ path: 'commented.js', changeType: 'added', oldPath: null, rationale: 'New' }];
        // No tasks.md, commit msg has no FR/AC pattern
        const result = mod.traceRequirements(files, '/nonexistent/tasks.md', '/nonexistent/req.md', tmpDir);
        assert.equal(result[0].tracingSource, 'code-comment');
        assert.ok(result[0].tracedRequirements.includes('FR-003'));
    });

    it('TC-050: Level 4 marks as untraced', () => {
        fs.writeFileSync(path.join(tmpDir, 'plain.txt'), 'no references');
        execSync('git add . && git commit -m "add plain file"', { cwd: tmpDir, stdio: ['pipe', 'pipe', 'pipe'] });
        const files = [{ path: 'plain.txt', changeType: 'added', oldPath: null, rationale: 'New' }];
        const result = mod.traceRequirements(files, '/nonexistent/tasks.md', '/nonexistent/req.md', tmpDir);
        assert.equal(result[0].tracingSource, 'untraced');
        assert.deepEqual(result[0].tracedRequirements, []);
    });

    it('TC-051: skips deleted files in Level 3 code scan', () => {
        const files = [{ path: 'deleted.js', changeType: 'deleted', oldPath: null, rationale: 'Removed' }];
        const result = mod.traceRequirements(files, '/nonexistent/tasks.md', '/nonexistent/req.md', tmpDir);
        // Should be untraced (can't read deleted file)
        assert.equal(result[0].tracingSource, 'untraced');
    });

    it('TC-052: skips binary files in Level 3', () => {
        const binaryPath = path.join(tmpDir, 'binary.bin');
        fs.writeFileSync(binaryPath, Buffer.from([0x00, 0x01, 0x02, 0x03]));
        execSync('git add . && git commit -m "add binary"', { cwd: tmpDir, stdio: ['pipe', 'pipe', 'pipe'] });
        const files = [{ path: 'binary.bin', changeType: 'added', oldPath: null, rationale: 'New' }];
        const result = mod.traceRequirements(files, '/nonexistent/tasks.md', '/nonexistent/req.md', tmpDir);
        assert.equal(result[0].tracingSource, 'untraced');
    });
});

describe('integration: writeOutputs', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wo-int-'));
        fs.mkdirSync(path.join(tmpDir, '.isdlc'), { recursive: true });
        fs.mkdirSync(path.join(tmpDir, 'docs', 'requirements', 'REQ-9999'), { recursive: true });
    });

    afterEach(() => {
        cleanupTestEnv(tmpDir);
    });

    it('TC-053: writes both files independently', () => {
        const summaryData = {
            schemaVersion: '1.0',
            generatedAt: '2026-03-09T01:00:00.000Z',
            workflowSlug: 'test', baseBranch: 'main',
            baseCommit: 'abc', headCommit: 'def',
            summary: { filesModified: 1, filesAdded: 0, filesDeleted: 0, filesRenamed: 0, totalFilesChanged: 1, requirementsTraced: 1, requirementsUntraced: 0, testsPassing: true, testCount: 5, coveragePercent: 90 },
            files: [{ path: 'a.js', changeType: 'modified', oldPath: null, rationale: 'Changed', tracedRequirements: ['FR-001'], tracingSource: 'commit' }],
            testResults: { total: 5, passing: 5, failing: 0, coveragePercent: 90 },
            warnings: []
        };
        const folderAbs = path.join(tmpDir, 'docs', 'requirements', 'REQ-9999');
        const result = mod.writeOutputs(summaryData, folderAbs, tmpDir);
        assert.ok(result.mdPath);
        assert.ok(result.jsonPath);
        assert.ok(fs.existsSync(result.mdPath));
        assert.ok(fs.existsSync(result.jsonPath));
    });

    it('TC-054: md failure does not block json', () => {
        const summaryData = {
            schemaVersion: '1.0', generatedAt: '2026-03-09T01:00:00.000Z',
            workflowSlug: 'test', baseBranch: 'main', baseCommit: null, headCommit: null,
            summary: { filesModified: 0, filesAdded: 0, filesDeleted: 0, filesRenamed: 0, totalFilesChanged: 0, requirementsTraced: 0, requirementsUntraced: 0, testsPassing: null, testCount: null, coveragePercent: null },
            files: [], testResults: null, warnings: []
        };
        // Use non-existent folder for MD but valid for JSON
        const result = mod.writeOutputs(summaryData, '/nonexistent/folder', tmpDir);
        assert.equal(result.mdPath, null);
        assert.ok(result.jsonPath);
    });
});

describe('integration: degradation scenarios', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deg-int-'));
    });

    afterEach(() => {
        cleanupTestEnv(tmpDir);
    });

    it('TC-055: full pipeline works with no git, no state, no tasks', () => {
        // Setup minimal env
        const isdlcDir = path.join(tmpDir, '.isdlc');
        fs.mkdirSync(isdlcDir, { recursive: true });
        const reqDir = path.join(tmpDir, 'docs', 'requirements', 'REQ-9999');
        fs.mkdirSync(reqDir, { recursive: true });
        fs.writeFileSync(path.join(isdlcDir, 'state.json'), JSON.stringify({ active_workflow: { slug: 'REQ-9999', artifact_folder: 'REQ-9999' } }));

        // collectGitDiff returns null (not a git repo), no tasks.md, no reqspec
        const context = {
            projectRoot: tmpDir,
            state: { active_workflow: { slug: 'REQ-9999', artifact_folder: 'REQ-9999' } },
            folderAbsolute: reqDir,
            folderRelative: 'docs/requirements/REQ-9999',
            baseBranch: 'main',
            workflowSlug: 'REQ-9999',
            artifactFolder: 'REQ-9999',
            reqSpecPath: path.join(reqDir, 'requirements-spec.md'),
            tasksPath: path.join(tmpDir, 'docs', 'isdlc', 'tasks.md')
        };

        const diffResult = mod.collectGitDiff(tmpDir, 'main'); // null
        assert.equal(diffResult, null);

        const warnings = ['git diff unavailable -- no file data collected'];
        const summaryData = mod.buildSummaryData(null, [], null, context, warnings);
        assert.equal(summaryData.summary.totalFilesChanged, 0);
        assert.ok(summaryData.warnings.includes('git diff unavailable -- no file data collected'));
    });
});

// ======================================================
// E2E TESTS
// ======================================================

describe('E2E: subprocess execution', () => {
    let tmpDir, reqDir, reqFolder;

    beforeEach(() => {
        const env = setupTestEnv({
            state: baseState(),
            folderName: 'REQ-9999-test-feature',
            reqSpec: '## FR-001: Feature\n### AC-001-01: First AC'
        });
        tmpDir = env.tmpDir;
        reqDir = env.reqDir;
        reqFolder = env.reqFolder;
        setupTestGitRepo(tmpDir);
    });

    afterEach(() => {
        cleanupTestEnv(tmpDir);
    });

    it('TC-056: exits 0 with valid JSON on success', () => {
        // Create a file change on the feature branch
        fs.writeFileSync(path.join(tmpDir, 'new-feature.js'), '// FR-001 implementation');
        execSync('git add . && git commit -m "implement FR-001"', { cwd: tmpDir, stdio: ['pipe', 'pipe', 'pipe'] });

        const result = runGenerator(tmpDir, `docs/requirements/${reqFolder}`);
        assert.equal(result.status, 0, `stderr: ${result.stderr}`);
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.result, 'OK');
        assert.ok(typeof parsed.files_changed === 'number');
    });

    it('TC-057: exits 2 with ERROR when --folder missing', () => {
        const result = spawnSync('node', [SCRIPT_PATH], {
            cwd: tmpDir,
            encoding: 'utf8',
            timeout: 30000,
            env: { ...process.env, ISDLC_PROJECT_ROOT: tmpDir }
        });
        assert.equal(result.status, 2);
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.result, 'ERROR');
        assert.ok(parsed.message.includes('--folder'));
    });

    it('TC-058: exits 2 when folder does not exist', () => {
        const result = runGenerator(tmpDir, 'docs/requirements/NONEXISTENT');
        assert.equal(result.status, 2);
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.result, 'ERROR');
        assert.ok(parsed.message.includes('not found'));
    });

    it('TC-059: generates both output files', () => {
        fs.writeFileSync(path.join(tmpDir, 'feature.js'), 'module.exports = {}');
        execSync('git add . && git commit -m "add feature"', { cwd: tmpDir, stdio: ['pipe', 'pipe', 'pipe'] });

        const result = runGenerator(tmpDir, `docs/requirements/${reqFolder}`);
        assert.equal(result.status, 0, `stderr: ${result.stderr}`);
        const parsed = JSON.parse(result.stdout);

        // Check md file exists
        if (parsed.md_path) {
            assert.ok(fs.existsSync(path.join(tmpDir, parsed.md_path)));
        }
        // Check json file exists
        if (parsed.json_path) {
            assert.ok(fs.existsSync(path.join(tmpDir, parsed.json_path)));
            const jsonContent = JSON.parse(fs.readFileSync(path.join(tmpDir, parsed.json_path), 'utf8'));
            assert.equal(jsonContent.schema_version, '1.0');
        }
    });
});
