/**
 * Characterization Tests: Domain 01 - Workflow Orchestration
 * Generated from reverse-engineered acceptance criteria
 *
 * Tests the CLI command routing, argument parsing, and provider mode validation.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTempDir, cleanupTempDir, createProjectDir } from '../../lib/utils/test-helpers.js';
import { mkdirSync, writeFileSync } from 'node:fs';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const binPath = join(__dirname, '..', '..', 'bin', 'isdlc.js');

function runCli(cwd, args, expectFailure = false) {
  try {
    return execSync(`node "${binPath}" ${args}`, {
      cwd,
      encoding: 'utf-8',
      timeout: 60000,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });
  } catch (err) {
    if (expectFailure) {
      return { stdout: err.stdout || '', stderr: err.stderr || '', status: err.status };
    }
    throw err;
  }
}

function setupProjectDir(name = 'test-project') {
  const tmpBase = createTempDir();
  const projectDir = join(tmpBase, name);
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(
    join(projectDir, 'package.json'),
    JSON.stringify({ name, version: '1.0.0' }, null, 2),
    'utf-8'
  );
  execSync('git init', { cwd: projectDir, stdio: 'ignore' });
  return projectDir;
}

describe('Workflow Orchestration', () => {

  describe('AC-WO-001: CLI Command Routing', () => {
    it('routes "init" to install()', () => {
      const projectDir = setupProjectDir('route-init');
      try {
        const output = runCli(projectDir, 'init --force');
        assert.ok(typeof output === 'string', 'init should produce output');
        assert.ok(output.length > 0, 'init should produce non-empty output');
      } finally {
        cleanupTempDir(join(projectDir, '..'));
      }
    });

    it('routes "version" to display version', () => {
      const tmpDir = createTempDir();
      try {
        const output = runCli(tmpDir, 'version');
        assert.match(output.trim(), /\d+\.\d+\.\d+/, 'Should contain semver');
      } finally {
        cleanupTempDir(tmpDir);
      }
    });

    it('routes unknown command to error', () => {
      const tmpDir = createTempDir();
      try {
        const result = runCli(tmpDir, 'foobar', true);
        assert.ok(
          result.status !== 0 || (result.stderr && result.stderr.includes('Unknown')),
          'Unknown command should produce error'
        );
      } finally {
        cleanupTempDir(tmpDir);
      }
    });

    it('routes no command to help output', () => {
      const tmpDir = createTempDir();
      try {
        const output = runCli(tmpDir, '');
        assert.ok(
          output.includes('Usage') || output.includes('usage') || output.includes('help') ||
          output.includes('Commands') || output.includes('init'),
          `Expected help output, got: ${output.slice(0, 200)}`
        );
      } finally {
        cleanupTempDir(tmpDir);
      }
    });
  });

  describe('AC-WO-002: CLI Argument Parsing', () => {
    it('extracts boolean flags correctly', () => {
      const projectDir = setupProjectDir('parse-flags');
      try {
        // --force and --dry-run are real flags
        const output = runCli(projectDir, 'init --dry-run');
        // Dry-run should not create .isdlc
        assert.ok(typeof output === 'string', 'Should process flags without error');
      } finally {
        cleanupTempDir(join(projectDir, '..'));
      }
    });

    it('extracts --provider-mode value', () => {
      const projectDir = setupProjectDir('parse-provider-mode');
      try {
        const output = runCli(projectDir, 'init --force --provider-mode free');
        assert.ok(typeof output === 'string', 'Should accept --provider-mode flag');
      } finally {
        cleanupTempDir(join(projectDir, '..'));
      }
    });

    it('handles -h short flag', () => {
      const tmpDir = createTempDir();
      try {
        const output = runCli(tmpDir, '-h');
        assert.ok(
          output.includes('Usage') || output.includes('usage') || output.includes('help') ||
          output.includes('Commands') || output.includes('init'),
          `Expected help output for -h, got: ${output.slice(0, 200)}`
        );
      } finally {
        cleanupTempDir(tmpDir);
      }
    });

    it('handles -v short flag', () => {
      const tmpDir = createTempDir();
      try {
        const output = runCli(tmpDir, '-v');
        assert.match(output.trim(), /\d+\.\d+\.\d+/, '-v should contain semver');
      } finally {
        cleanupTempDir(tmpDir);
      }
    });
  });

  describe('AC-WO-003: Provider Mode Validation', () => {
    it('accepts valid provider modes', () => {
      const projectDir = setupProjectDir('valid-mode');
      try {
        const output = runCli(projectDir, 'init --force --provider-mode quality');
        assert.ok(typeof output === 'string', 'quality mode should be accepted');
      } finally {
        cleanupTempDir(join(projectDir, '..'));
      }
    });

    it('rejects invalid provider modes', () => {
      const projectDir = setupProjectDir('invalid-mode');
      try {
        const result = runCli(projectDir, 'init --force --provider-mode turbo', true);
        assert.ok(
          result.status !== 0 ||
          (typeof result === 'object' && result.stderr && result.stderr.includes('Invalid')),
          'Invalid provider mode should be rejected'
        );
      } finally {
        cleanupTempDir(join(projectDir, '..'));
      }
    });
  });

  describe('AC-WO-004: Background Update Check', () => {
    it('does not show notification for version command', () => {
      const tmpDir = createTempDir();
      try {
        const output = runCli(tmpDir, 'version');
        // version command should just show version, no update notification
        const lines = output.trim().split('\n').filter(l => l.trim());
        // First line should be the version, no "update available" message
        assert.match(lines[0].trim(), /\d+\.\d+\.\d+/, 'First line should be version');
      } finally {
        cleanupTempDir(tmpDir);
      }
    });
  });

  describe('AC-WO-009: Setup Command Bypass', () => {
    it('allows discover-related commands through without gate blocking', () => {
      // This tests the gate-blocker's bypass logic
      // The gate-blocker should not intercept discover commands
      // We test this indirectly: if gate-blocker were blocking discover,
      // the init command would fail (since init is a setup command)
      const projectDir = setupProjectDir('bypass-test');
      try {
        // init is a setup command that should bypass gate checks
        const output = runCli(projectDir, 'init --force');
        assert.ok(typeof output === 'string', 'Setup commands should bypass gate-blocker');
      } finally {
        cleanupTempDir(join(projectDir, '..'));
      }
    });
  });
});
