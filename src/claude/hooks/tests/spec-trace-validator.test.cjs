/**
 * Tests for spec-trace-validator.cjs hook
 * Traces to: FR-004, AC-004-01 through AC-004-07
 */

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const hookPath = path.join(__dirname, '..', 'spec-trace-validator.cjs');
const { check, parseTasksFileMap, isExemptFile, ACTIVE_PHASES } = require(hookPath);

// =========================================================================
// Helpers
// =========================================================================

function setupTestEnv(opts = {}) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stv-test-'));
    fs.mkdirSync(path.join(tmpDir, '.isdlc'), { recursive: true });

    const artifactFolder = opts.artifactFolder || 'REQ-GH-261-test';

    // Create tasks.md
    const isdlcDocsDir = path.join(tmpDir, 'docs', 'isdlc');
    fs.mkdirSync(isdlcDocsDir, { recursive: true });
    if (opts.tasksContent) {
        fs.writeFileSync(path.join(isdlcDocsDir, 'tasks.md'), opts.tasksContent);
    }

    // Create requirements-spec.md
    if (opts.specContent) {
        const reqDir = path.join(tmpDir, 'docs', 'requirements', artifactFolder);
        fs.mkdirSync(reqDir, { recursive: true });
        fs.writeFileSync(path.join(reqDir, 'requirements-spec.md'), opts.specContent);
    }

    return { tmpDir, artifactFolder };
}

function makeState(phase, artifactFolder) {
    return {
        active_workflow: {
            current_phase: phase,
            artifact_folder: artifactFolder
        }
    };
}

function cleanup(tmpDir) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
}

// =========================================================================
// parseTasksFileMap — AC-004-03
// =========================================================================

describe('spec-trace-validator: parseTasksFileMap', () => {
    let tmpDir;

    afterEach(() => { if (tmpDir) cleanup(tmpDir); });

    // STV-13
    it('builds file-to-AC map from tasks.md format', () => {
        const env = setupTestEnv({
            tasksContent: '## Phase 06: Implementation -- IN PROGRESS\n\n- [ ] T003 Hook | traces: FR-002, AC-002-01, AC-002-02\n  files: src/claude/hooks/deferral-detector.cjs (CREATE)\n'
        });
        tmpDir = env.tmpDir;
        const result = parseTasksFileMap(path.join(tmpDir, 'docs', 'isdlc', 'tasks.md'));
        assert.ok(result !== null);
        assert.ok(result.fileToACs.has('src/claude/hooks/deferral-detector.cjs'));
        const acs = result.fileToACs.get('src/claude/hooks/deferral-detector.cjs');
        assert.ok(acs.includes('AC-002-01'));
        assert.ok(acs.includes('AC-002-02'));
    });

    // STV-14
    it('handles multiple files per task', () => {
        const env = setupTestEnv({
            tasksContent: '## Phase 06: Implementation\n\n- [ ] T005 Hook | traces: FR-003, AC-003-01\n  files: src/claude/hooks/test-quality-validator.cjs (CREATE), src/claude/hooks/lib/common.cjs (MODIFY)\n'
        });
        tmpDir = env.tmpDir;
        const result = parseTasksFileMap(path.join(tmpDir, 'docs', 'isdlc', 'tasks.md'));
        assert.ok(result.fileToACs.has('src/claude/hooks/test-quality-validator.cjs'));
        assert.ok(result.fileToACs.has('src/claude/hooks/lib/common.cjs'));
    });

    // STV-15
    it('handles tasks with no files listed', () => {
        const env = setupTestEnv({
            tasksContent: '## Phase 06: Implementation\n\n- [ ] T002 Constitution updates | traces: FR-001\n'
        });
        tmpDir = env.tmpDir;
        const result = parseTasksFileMap(path.join(tmpDir, 'docs', 'isdlc', 'tasks.md'));
        assert.ok(result !== null);
        assert.equal(result.fileToACs.size, 0);
    });

    it('returns null for non-existent file', () => {
        const result = parseTasksFileMap('/nonexistent/tasks.md');
        assert.equal(result, null);
    });
});

// =========================================================================
// isExemptFile
// =========================================================================

describe('spec-trace-validator: isExemptFile', () => {
    // STV-04
    it('exempts config files from tracing', () => {
        assert.ok(isExemptFile('package.json'));
        assert.ok(isExemptFile('.eslintrc.js'));
    });

    // STV-05
    it('exempts test files from tracing', () => {
        assert.ok(isExemptFile('tests/unit/app.test.js'));
        assert.ok(isExemptFile('src/hooks/tests/hook.test.cjs'));
    });

    // STV-06
    it('exempts docs/requirements/ files', () => {
        assert.ok(isExemptFile('docs/requirements/REQ-001/spec.md'));
    });

    it('does not exempt source files', () => {
        assert.ok(!isExemptFile('src/claude/hooks/deferral-detector.cjs'));
    });

    it('exempts .isdlc/ files', () => {
        assert.ok(isExemptFile('.isdlc/state.json'));
    });

    it('returns true for null/empty', () => {
        assert.ok(isExemptFile(null));
        assert.ok(isExemptFile(''));
    });
});

// =========================================================================
// Phase Gating — AC-004-01
// =========================================================================

describe('spec-trace-validator: phase gating', () => {
    it('fires on phase 06-implementation', () => {
        assert.ok(ACTIVE_PHASES.includes('06-implementation'));
    });

    it('does not fire on other phases', () => {
        const ctx = { state: makeState('08-code-review', 'folder') };
        const result = check(ctx);
        assert.equal(result.decision, 'allow');
    });
});

// =========================================================================
// Fail-Open
// =========================================================================

describe('spec-trace-validator: fail-open', () => {
    // STV-19
    it('returns allow on null input', () => {
        const result = check(null);
        assert.equal(result.decision, 'allow');
    });

    // STV-20
    it('returns allow on missing tasks.md', () => {
        const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'stv-notasks-'));
        fs.mkdirSync(path.join(tmpDir2, '.isdlc'), { recursive: true });
        fs.mkdirSync(path.join(tmpDir2, 'docs', 'isdlc'), { recursive: true });
        const origEnv = process.env.CLAUDE_PROJECT_DIR;
        process.env.CLAUDE_PROJECT_DIR = tmpDir2;
        try {
            const ctx = { state: makeState('06-implementation', 'folder') };
            const result = check(ctx);
            assert.equal(result.decision, 'allow');
        } finally {
            process.env.CLAUDE_PROJECT_DIR = origEnv;
            cleanup(tmpDir2);
        }
    });

    // STV-21
    it('returns allow on missing state', () => {
        const result = check({ state: null });
        assert.equal(result.decision, 'allow');
    });
});

// =========================================================================
// Block Message — AC-004-06, AC-004-07
// =========================================================================

describe('spec-trace-validator: block message', () => {
    // STV-18
    it('would contain SPEC TRACE INCOMPLETE signal on block', () => {
        // Verify the signal string is used in the hook
        const hookSource = fs.readFileSync(hookPath, 'utf8');
        assert.ok(hookSource.includes('SPEC TRACE INCOMPLETE'));
    });
});
