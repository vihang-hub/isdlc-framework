'use strict';

/**
 * Unit Tests: inject-session-cache.cjs SessionStart Hook (REQ-0001 FR-002)
 * =========================================================================
 * Tests for the SessionStart hook that reads the cache file and outputs to stdout.
 *
 * Framework: node:test + node:assert/strict (CJS stream)
 * Run: node --test src/claude/hooks/tests/test-inject-session-cache.test.cjs
 *
 * Traces to: FR-002, AC-002-01 through AC-002-05, NFR-003, NFR-005, NFR-008
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const HOOK_PATH = path.resolve(__dirname, '..', 'inject-session-cache.cjs');
const HOOK_TIMEOUT_MS = 10000;

/** Run the hook as a child process with given env overrides */
function runHook(envOverrides = {}) {
    return new Promise((resolve, reject) => {
        const env = { ...process.env, ...envOverrides };
        const child = spawn('node', [HOOK_PATH], { env, stdio: ['pipe', 'pipe', 'pipe'] });

        let stdout = '';
        let stderr = '';
        let settled = false;

        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                child.kill('SIGKILL');
                reject(new Error(`Hook timed out after ${HOOK_TIMEOUT_MS}ms`));
            }
        }, HOOK_TIMEOUT_MS);

        child.stdout.on('data', d => { stdout += d.toString(); });
        child.stderr.on('data', d => { stderr += d.toString(); });

        child.on('close', code => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                resolve({ stdout, stderr, code });
            }
        });

        child.on('error', err => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                reject(err);
            }
        });

        child.stdin.end();
    });
}

function createTmpDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'isdlc-hook-cache-'));
}

function cleanup(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

describe('inject-session-cache.cjs', () => {

    // TC-HOOK-01
    it('TC-HOOK-01: outputs cache file content to stdout when cache exists', async () => {
        const tmpDir = createTmpDir();
        fs.mkdirSync(path.join(tmpDir, '.isdlc'), { recursive: true });
        fs.writeFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'test cache content');
        try {
            const result = await runHook({ CLAUDE_PROJECT_DIR: tmpDir });
            assert.equal(result.stdout, 'test cache content');
            assert.equal(result.stderr, '');
            assert.equal(result.code, 0);
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-HOOK-02
    it('TC-HOOK-02: produces no output when cache file missing (fail-open)', async () => {
        const tmpDir = createTmpDir();
        fs.mkdirSync(path.join(tmpDir, '.isdlc'), { recursive: true });
        try {
            const result = await runHook({ CLAUDE_PROJECT_DIR: tmpDir });
            assert.equal(result.stdout, '');
            assert.equal(result.stderr, '');
            assert.equal(result.code, 0);
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-HOOK-03
    it('TC-HOOK-03: produces no output when cache file unreadable (fail-open)', async () => {
        // Skip on Windows where chmod 000 doesn't work the same way
        if (process.platform === 'win32') return;
        const tmpDir = createTmpDir();
        fs.mkdirSync(path.join(tmpDir, '.isdlc'), { recursive: true });
        const cachePath = path.join(tmpDir, '.isdlc', 'session-cache.md');
        fs.writeFileSync(cachePath, 'secret content');
        fs.chmodSync(cachePath, 0o000);
        try {
            const result = await runHook({ CLAUDE_PROJECT_DIR: tmpDir });
            assert.equal(result.stdout, '');
            assert.equal(result.stderr, '');
            assert.equal(result.code, 0);
        } finally {
            try { fs.chmodSync(cachePath, 0o644); } catch (_) {}
            cleanup(tmpDir);
        }
    });

    // TC-HOOK-04
    it('TC-HOOK-04: outputs empty string for empty cache file', async () => {
        const tmpDir = createTmpDir();
        fs.mkdirSync(path.join(tmpDir, '.isdlc'), { recursive: true });
        fs.writeFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), '');
        try {
            const result = await runHook({ CLAUDE_PROJECT_DIR: tmpDir });
            assert.equal(result.stdout, '');
            assert.equal(result.code, 0);
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-HOOK-06
    it('TC-HOOK-06: completes within 5000ms timeout', async () => {
        const tmpDir = createTmpDir();
        fs.mkdirSync(path.join(tmpDir, '.isdlc'), { recursive: true });
        // Write a ~128K cache file
        const bigContent = 'x'.repeat(128000);
        fs.writeFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), bigContent);
        try {
            const start = Date.now();
            const result = await runHook({ CLAUDE_PROJECT_DIR: tmpDir });
            const elapsed = Date.now() - start;
            assert.ok(elapsed < 5000, `Hook took ${elapsed}ms, should be under 5000ms`);
            assert.equal(result.code, 0);
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-HOOK-07
    it('TC-HOOK-07: hook is self-contained (no common.cjs dependency)', () => {
        const content = fs.readFileSync(HOOK_PATH, 'utf8');
        assert.ok(!content.includes("require('./lib/common.cjs')"),
            'Should not require common.cjs');
        assert.ok(!content.includes("require('../lib/common.cjs')"),
            'Should not require common.cjs via relative path');
        // Only fs and path
        assert.ok(content.includes("require('fs')"));
        assert.ok(content.includes("require('path')"));
    });

    // TC-HOOK-08
    it('TC-HOOK-08: never writes to stderr', async () => {
        const tmpDir = createTmpDir();
        // Various scenarios: cache missing, empty dir
        try {
            const result1 = await runHook({ CLAUDE_PROJECT_DIR: tmpDir });
            assert.equal(result1.stderr, '');
            const result2 = await runHook({ CLAUDE_PROJECT_DIR: '/nonexistent/path/isdlc-test' });
            assert.equal(result2.stderr, '');
        } finally {
            cleanup(tmpDir);
        }
    });
});
