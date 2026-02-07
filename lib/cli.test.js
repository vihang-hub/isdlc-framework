/**
 * Tests for lib/cli.js
 *
 * Uses subprocess isolation (execSync) to test the CLI binary end-to-end.
 * This approach tests the actual user experience: running `node bin/isdlc.js <args>`
 * and checking exit codes and stdout/stderr output.
 *
 * Why subprocess isolation?
 *   - cli.js imports many modules (installer, updater, doctor) with side effects
 *   - ESM mocking is limited; subprocess testing is more reliable
 *   - It tests the real CLI path including bin/isdlc.js entry point
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const binPath = join(__dirname, '..', 'bin', 'isdlc.js');
const EXEC_OPTS = { encoding: 'utf-8', timeout: 15000 };

/**
 * Helper: run the CLI and return stdout.
 * Throws on non-zero exit code (use runCLIExpectFail for those).
 */
function runCLI(args, opts = {}) {
  return execSync(`node "${binPath}" ${args}`, { ...EXEC_OPTS, ...opts });
}

/**
 * Helper: run the CLI expecting a non-zero exit code.
 * Returns { status, stdout, stderr }.
 */
function runCLIExpectFail(args, opts = {}) {
  try {
    const stdout = execSync(`node "${binPath}" ${args}`, {
      ...EXEC_OPTS,
      ...opts,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      status: err.status,
      stdout: err.stdout || '',
      stderr: err.stderr || '',
    };
  }
}

describe('CLI (lib/cli.js) — subprocess tests', () => {
  // ───────────────────────────────────────────────
  // help command
  // ───────────────────────────────────────────────
  describe('help command', () => {
    it('should exit 0 and show usage for "help"', () => {
      const output = runCLI('help');
      assert.ok(output.includes('Usage:'), 'Output should contain "Usage:"');
    });

    it('should exit 0 and show usage for "--help"', () => {
      const output = runCLI('--help');
      assert.ok(output.includes('Usage:'), 'Output should contain "Usage:"');
    });

    it('should exit 0 and show usage for "-h"', () => {
      const output = runCLI('-h');
      assert.ok(output.includes('Usage:'), 'Output should contain "Usage:"');
    });

    it('should show available commands in help output', () => {
      const output = runCLI('help');
      assert.ok(output.includes('init'), 'Help should list init command');
      assert.ok(output.includes('update'), 'Help should list update command');
      assert.ok(output.includes('doctor'), 'Help should list doctor command');
      assert.ok(output.includes('uninstall'), 'Help should list uninstall command');
      assert.ok(output.includes('version'), 'Help should list version command');
    });

    it('should show options section in help output', () => {
      const output = runCLI('help');
      assert.ok(output.includes('--monorepo'), 'Help should mention --monorepo');
      assert.ok(output.includes('--force'), 'Help should mention --force');
      assert.ok(output.includes('--dry-run'), 'Help should mention --dry-run');
      assert.ok(output.includes('--backup'), 'Help should mention --backup');
      assert.ok(output.includes('--provider-mode'), 'Help should mention --provider-mode');
    });

    it('should show help when no command is provided', () => {
      const output = runCLI('');
      assert.ok(output.includes('Usage:'), 'No-args output should contain "Usage:"');
    });
  });

  // ───────────────────────────────────────────────
  // version command
  // ───────────────────────────────────────────────
  describe('version command', () => {
    it('should exit 0 and show version for "version"', () => {
      const output = runCLI('version');
      assert.ok(output.includes('iSDLC Framework v'), 'Output should contain version prefix');
    });

    it('should exit 0 and show version for "--version"', () => {
      const output = runCLI('--version');
      assert.ok(output.includes('iSDLC Framework v'), 'Output should contain version prefix');
    });

    it('should exit 0 and show version for "-v"', () => {
      const output = runCLI('-v');
      assert.ok(output.includes('iSDLC Framework v'), 'Output should contain version prefix');
    });

    it('should include the actual version number from package.json', () => {
      const output = runCLI('version');
      // package.json says 0.1.0-alpha
      assert.ok(
        output.includes('0.1.0-alpha'),
        'Output should contain the version from package.json'
      );
    });
  });

  // ───────────────────────────────────────────────
  // unknown command
  // ───────────────────────────────────────────────
  describe('unknown command', () => {
    it('should exit non-zero for an unknown command', () => {
      const result = runCLIExpectFail('totally-bogus-command');
      assert.notEqual(result.status, 0, 'Unknown command should exit with non-zero status');
    });

    it('should print "Unknown command" in the output', () => {
      const result = runCLIExpectFail('totally-bogus-command');
      const combined = result.stdout + result.stderr;
      assert.ok(
        combined.includes('Unknown command'),
        'Output should mention "Unknown command"'
      );
    });

    it('should also show help after an unknown command', () => {
      const result = runCLIExpectFail('totally-bogus-command');
      const combined = result.stdout + result.stderr;
      assert.ok(
        combined.includes('Usage:'),
        'Output should include usage/help text after unknown command'
      );
    });
  });

  // ───────────────────────────────────────────────
  // doctor command
  // ───────────────────────────────────────────────
  describe('doctor command', () => {
    it('should run without crashing (may report issues in a non-installed dir)', () => {
      // doctor runs in cwd, which is the iSDLC repo itself (no .isdlc/ dir likely).
      // It should report "Not installed" but not throw/crash.
      const result = runCLIExpectFail('doctor');
      // Either exit 0 (healthy) or exit non-zero (issues found) is fine.
      // The key assertion: it produced output and did not hang or segfault.
      const combined = result.stdout + result.stderr;
      assert.ok(combined.length > 0, 'doctor should produce some output');
    });

    it('should show health check header in output', () => {
      const result = runCLIExpectFail('doctor');
      const combined = result.stdout + result.stderr;
      assert.ok(
        combined.includes('Health Check') || combined.includes('Doctor'),
        'Output should contain health check or doctor header'
      );
    });
  });

  // ───────────────────────────────────────────────
  // init --dry-run --force
  // ───────────────────────────────────────────────
  describe('init --dry-run --force', () => {
    let tempDir;

    before(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'isdlc-cli-test-'));
    });

    after(() => {
      if (tempDir && existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should exit 0 when run with --dry-run --force in a temp directory', () => {
      // --dry-run means nothing is written; --force skips prompts
      const output = runCLI('init --dry-run --force', { cwd: tempDir });
      assert.ok(typeof output === 'string', 'Should produce string output');
    });

    it('should mention dry run in the output', () => {
      const output = runCLI('init --dry-run --force', { cwd: tempDir });
      // The installer prints a dry-run notice at the end
      assert.ok(
        output.toLowerCase().includes('dry run'),
        'Output should mention "dry run"'
      );
    });
  });

  // ───────────────────────────────────────────────
  // update --dry-run --force
  // ───────────────────────────────────────────────
  describe('update --dry-run --force', () => {
    let tempDir;

    before(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'isdlc-cli-update-test-'));
    });

    after(() => {
      if (tempDir && existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should handle gracefully when there is no installation to update', () => {
      // Running update in an empty temp dir — no .isdlc/ exists.
      // Should fail or report "not installed" without crashing.
      const result = runCLIExpectFail('update --dry-run --force', { cwd: tempDir });
      const combined = result.stdout + result.stderr;
      // It should produce output (not hang silently)
      assert.ok(combined.length > 0, 'Update in empty dir should produce output');
    });
  });

  // ───────────────────────────────────────────────
  // flag parsing edge cases
  // ───────────────────────────────────────────────
  describe('flag parsing', () => {
    it('should treat --help before a command as the help command', () => {
      const output = runCLI('--help init');
      assert.ok(output.includes('Usage:'), 'Should show help when --help precedes a command');
    });

    it('should treat -v flag as version regardless of position', () => {
      const output = runCLI('-v');
      assert.ok(
        output.includes('iSDLC Framework v'),
        '-v should show version'
      );
    });

    it('should accept --version as a flag (not just a command)', () => {
      const output = runCLI('--version');
      assert.ok(
        output.includes('iSDLC Framework v'),
        '--version flag should show version'
      );
    });

    it('should show examples section in help', () => {
      const output = runCLI('help');
      assert.ok(output.includes('Examples:'), 'Help output should contain Examples section');
    });

    it('should show after-installation section in help', () => {
      const output = runCLI('help');
      assert.ok(
        output.includes('After Installation:'),
        'Help output should contain After Installation section'
      );
    });
  });

  // ───────────────────────────────────────────────
  // init with invalid provider-mode
  // ───────────────────────────────────────────────
  describe('init --provider-mode validation', () => {
    let tempDir;

    before(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'isdlc-cli-provider-'));
    });

    after(() => {
      if (tempDir && existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should reject an invalid provider mode', () => {
      const result = runCLIExpectFail(
        'init --provider-mode invalid-mode --force',
        { cwd: tempDir }
      );
      assert.notEqual(result.status, 0, 'Invalid provider mode should cause non-zero exit');
      const combined = result.stdout + result.stderr;
      assert.ok(
        combined.includes('Invalid provider mode'),
        'Output should mention invalid provider mode'
      );
    });

    it('should list valid modes in the error message', () => {
      const result = runCLIExpectFail(
        'init --provider-mode nope --force',
        { cwd: tempDir }
      );
      const combined = result.stdout + result.stderr;
      assert.ok(combined.includes('free'), 'Error should list "free" as valid mode');
      assert.ok(combined.includes('budget'), 'Error should list "budget" as valid mode');
      assert.ok(combined.includes('quality'), 'Error should list "quality" as valid mode');
      assert.ok(combined.includes('local'), 'Error should list "local" as valid mode');
      assert.ok(combined.includes('hybrid'), 'Error should list "hybrid" as valid mode');
    });
  });
});
