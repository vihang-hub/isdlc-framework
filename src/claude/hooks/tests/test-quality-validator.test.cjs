/**
 * Tests for test-quality-validator.cjs hook
 * Traces to: FR-003, AC-003-01 through AC-003-08
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const hookPath = path.join(__dirname, '..', 'test-quality-validator.cjs');
const { check, ACTIVE_PHASES } = require(hookPath);

// =========================================================================
// Helpers
// =========================================================================

function setupTestEnv(opts = {}) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tqv-test-'));
    const isdlcDir = path.join(tmpDir, '.isdlc');
    fs.mkdirSync(isdlcDir, { recursive: true });

    const artifactFolder = opts.artifactFolder || 'REQ-GH-261-test';

    // Create requirements-spec.md
    const reqDir = path.join(tmpDir, 'docs', 'requirements', artifactFolder);
    fs.mkdirSync(reqDir, { recursive: true });
    const specContent = opts.specContent || '- AC-001-01: Given X, then Y\n- AC-001-02: Given A, then B';
    fs.writeFileSync(path.join(reqDir, 'requirements-spec.md'), specContent);

    // Create test directory
    const testDir = path.join(tmpDir, 'src', 'claude', 'hooks', 'tests');
    fs.mkdirSync(testDir, { recursive: true });

    if (opts.testContent) {
        fs.writeFileSync(path.join(testDir, 'example.test.cjs'), opts.testContent);
    }

    // Create source directory
    if (opts.srcContent) {
        const srcDir = path.join(tmpDir, 'src', 'example');
        fs.mkdirSync(srcDir, { recursive: true });
        fs.writeFileSync(path.join(srcDir, 'module.js'), opts.srcContent);
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
// AC Coverage Detection — AC-003-02, AC-003-03, AC-003-04
// =========================================================================

describe('test-quality-validator: AC coverage', () => {
    let tmpDir;

    afterEach(() => { if (tmpDir) cleanup(tmpDir); });

    // TQV-01
    it('allows when all ACs covered by tests', () => {
        const env = setupTestEnv({
            testContent: "// traces: AC-001-01, AC-001-02\nit('AC-001-01: test x', () => { assert.ok(true); });\nit('AC-001-02: test y', () => { assert.ok(true); });"
        });
        tmpDir = env.tmpDir;
        const origEnv = process.env.CLAUDE_PROJECT_DIR;
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const ctx = { state: makeState('06-implementation', env.artifactFolder) };
            const result = check(ctx);
            assert.equal(result.decision, 'allow');
        } finally {
            process.env.CLAUDE_PROJECT_DIR = origEnv;
        }
    });

    // TQV-02
    it('blocks when AC has no matching test', () => {
        const env = setupTestEnv({
            testContent: "it('AC-001-01: test x', () => { assert.ok(true); });"
        });
        tmpDir = env.tmpDir;
        const origEnv = process.env.CLAUDE_PROJECT_DIR;
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const ctx = { state: makeState('06-implementation', env.artifactFolder) };
            const result = check(ctx);
            assert.equal(result.decision, 'block');
            assert.ok(result.stopReason.includes('AC-001-02'), 'Should mention uncovered AC');
        } finally {
            process.env.CLAUDE_PROJECT_DIR = origEnv;
        }
    });

    // TQV-03
    it('blocks when multiple ACs missing', () => {
        const env = setupTestEnv({
            specContent: '- AC-001-01: X\n- AC-001-02: Y\n- AC-001-03: Z',
            testContent: "it('some test', () => { assert.ok(true); });"
        });
        tmpDir = env.tmpDir;
        const origEnv = process.env.CLAUDE_PROJECT_DIR;
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const ctx = { state: makeState('06-implementation', env.artifactFolder) };
            const result = check(ctx);
            assert.equal(result.decision, 'block');
            assert.ok(result.stopReason.includes('AC-001-01'));
            assert.ok(result.stopReason.includes('AC-001-02'));
            assert.ok(result.stopReason.includes('AC-001-03'));
        } finally {
            process.env.CLAUDE_PROJECT_DIR = origEnv;
        }
    });

    // TQV-04
    it('handles AC traces in test descriptions', () => {
        const env = setupTestEnv({
            testContent: "it('AC-001-01: should work', () => { assert.ok(true); });\nit('AC-001-02: should also work', () => { assert.ok(true); });"
        });
        tmpDir = env.tmpDir;
        const origEnv = process.env.CLAUDE_PROJECT_DIR;
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const ctx = { state: makeState('06-implementation', env.artifactFolder) };
            const result = check(ctx);
            assert.equal(result.decision, 'allow');
        } finally {
            process.env.CLAUDE_PROJECT_DIR = origEnv;
        }
    });

    // TQV-05
    it('handles AC traces in comment annotations', () => {
        const env = setupTestEnv({
            testContent: "// traces: AC-001-01, AC-001-02\nit('test', () => { assert.ok(true); });"
        });
        tmpDir = env.tmpDir;
        const origEnv = process.env.CLAUDE_PROJECT_DIR;
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const ctx = { state: makeState('06-implementation', env.artifactFolder) };
            const result = check(ctx);
            assert.equal(result.decision, 'allow');
        } finally {
            process.env.CLAUDE_PROJECT_DIR = origEnv;
        }
    });
});

// =========================================================================
// Assertion Count — AC-003-05
// =========================================================================

describe('test-quality-validator: assertion count', () => {
    let tmpDir;

    afterEach(() => { if (tmpDir) cleanup(tmpDir); });

    // TQV-06
    it('blocks test file with zero-assertion test block', () => {
        const env = setupTestEnv({
            testContent: "// traces: AC-001-01, AC-001-02\nit('AC-001-01: test', () => {\n  const x = 1;\n});\nit('AC-001-02: test2', () => { assert.ok(true); });"
        });
        tmpDir = env.tmpDir;
        const origEnv = process.env.CLAUDE_PROJECT_DIR;
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const ctx = { state: makeState('06-implementation', env.artifactFolder) };
            const result = check(ctx);
            assert.equal(result.decision, 'block');
            assert.ok(result.stopReason.includes('Zero assertions'));
        } finally {
            process.env.CLAUDE_PROJECT_DIR = origEnv;
        }
    });

    // TQV-07
    it('allows test file with assertions in all blocks', () => {
        const env = setupTestEnv({
            testContent: "// traces: AC-001-01, AC-001-02\nit('AC-001-01: test', () => {\n  assert.ok(true);\n});\nit('AC-001-02: test2', () => {\n  assert.equal(1, 1);\n});"
        });
        tmpDir = env.tmpDir;
        const origEnv = process.env.CLAUDE_PROJECT_DIR;
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const ctx = { state: makeState('06-implementation', env.artifactFolder) };
            const result = check(ctx);
            assert.equal(result.decision, 'allow');
        } finally {
            process.env.CLAUDE_PROJECT_DIR = origEnv;
        }
    });
});

// =========================================================================
// Phase Gating — AC-003-01
// =========================================================================

describe('test-quality-validator: phase gating', () => {
    // TQV-14
    it('fires on phase 06-implementation completion', () => {
        assert.ok(ACTIVE_PHASES.includes('06-implementation'));
    });

    // TQV-15
    it('fires on phase 16-quality-loop completion', () => {
        assert.ok(ACTIVE_PHASES.includes('16-quality-loop'));
    });

    // TQV-16
    it('does not fire on phase 05 or other phases', () => {
        const ctx = { state: makeState('05-test-strategy', 'folder') };
        const result = check(ctx);
        assert.equal(result.decision, 'allow');
    });
});

// =========================================================================
// Fail-Open
// =========================================================================

describe('test-quality-validator: fail-open', () => {
    // TQV-17
    it('returns allow on null input', () => {
        const result = check(null);
        assert.equal(result.decision, 'allow');
    });

    // TQV-18
    it('returns allow on missing requirements-spec.md', () => {
        const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'tqv-noreq-'));
        fs.mkdirSync(path.join(tmpDir2, '.isdlc'), { recursive: true });
        const origEnv = process.env.CLAUDE_PROJECT_DIR;
        process.env.CLAUDE_PROJECT_DIR = tmpDir2;
        try {
            const ctx = { state: makeState('06-implementation', 'nonexistent-folder') };
            const result = check(ctx);
            assert.equal(result.decision, 'allow');
        } finally {
            process.env.CLAUDE_PROJECT_DIR = origEnv;
            cleanup(tmpDir2);
        }
    });

    // TQV-19
    it('returns allow on missing state', () => {
        const result = check({ state: null });
        assert.equal(result.decision, 'allow');
    });
});

// =========================================================================
// Signal for 3f Loop — AC-003-08
// =========================================================================

describe('test-quality-validator: 3f signal', () => {
    let tmpDir;

    afterEach(() => { if (tmpDir) cleanup(tmpDir); });

    // TQV-20
    it('block message contains "TEST QUALITY INCOMPLETE" signal', () => {
        const env = setupTestEnv({
            testContent: "it('no AC traces', () => { assert.ok(true); });"
        });
        tmpDir = env.tmpDir;
        const origEnv = process.env.CLAUDE_PROJECT_DIR;
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const ctx = { state: makeState('06-implementation', env.artifactFolder) };
            const result = check(ctx);
            assert.equal(result.decision, 'block');
            assert.ok(result.stopReason.includes('TEST QUALITY INCOMPLETE'));
        } finally {
            process.env.CLAUDE_PROJECT_DIR = origEnv;
        }
    });
});
