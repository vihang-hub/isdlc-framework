/**
 * Tests for lib/doctor.js
 *
 * Tests the runDoctor() function by creating temp directories with various
 * installation states (healthy, partial, corrupt) and verifying it detects
 * the right issues, warnings, and passes.
 *
 * Since runDoctor() does not return structured data, we capture console.log
 * output by temporarily replacing console.log with a simple accumulator
 * function. We avoid using node:test's mock.method here because the chalk
 * ANSI objects can cause IPC serialization failures with the test runner.
 *
 * Logger output conventions (from logger.js):
 *   - success: includes Unicode checkmark U+2713
 *   - error:   includes Unicode X mark U+2717
 *   - warning: includes Unicode warning U+26A0
 *   - step:    includes bracketed step number e.g. [1/8]
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTempDir, cleanupTempDir } from './utils/test-helpers.js';
import { runDoctor } from './doctor.js';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

/** Unicode markers from logger.js for matching output */
const CHECKMARK = '\u2713'; // success
const XMARK = '\u2717'; // error
const WARNING_SYM = '\u26A0'; // warning

/**
 * Manually capture console.log calls.
 * Returns { lines, restore } where lines is an array of stringified outputs.
 *
 * This avoids node:test mock.method which can cause IPC deserialization
 * issues with chalk-styled arguments in newer Node.js versions.
 */
function manualCapture() {
  const originalLog = console.log;
  const lines = [];

  console.log = (...args) => {
    lines.push(args.map(String).join(' '));
  };

  return {
    get output() {
      return lines.join('\n');
    },
    lines,
    restore() {
      console.log = originalLog;
    },
  };
}

/**
 * Scaffold a minimal valid iSDLC installation directory.
 * Returns the project root path.
 */
function scaffoldValidInstall(projectRoot, overrides = {}) {
  const isdlcDir = join(projectRoot, '.isdlc');
  const claudeDir = join(projectRoot, '.claude');

  // .isdlc/state.json
  mkdirSync(isdlcDir, { recursive: true });
  const stateJson = overrides.stateJson || {
    framework_version: '0.1.0-alpha',
    project: { name: 'test-project' },
    phases: {},
    current_phase: 'init',
  };
  writeFileSync(join(isdlcDir, 'state.json'), JSON.stringify(stateJson, null, 2), 'utf-8');

  // .isdlc/installed-files.json
  const installedFiles = overrides.installedFiles || {
    files: ['agents/foo.md', 'skills/bar.md'],
    version: '0.1.0-alpha',
    installedAt: new Date().toISOString(),
  };
  writeFileSync(
    join(isdlcDir, 'installed-files.json'),
    JSON.stringify(installedFiles, null, 2),
    'utf-8'
  );

  // .claude subdirectories
  for (const subdir of ['agents', 'skills', 'commands', 'hooks']) {
    mkdirSync(join(claudeDir, subdir), { recursive: true });
  }

  // .claude/settings.json with hooks
  const settingsJson = overrides.settingsJson || {
    hooks: [
      { event: 'PreToolUse', command: 'node .claude/hooks/gate-blocker.cjs' },
      { event: 'PostToolUse', command: 'node .claude/hooks/log-skill-usage.cjs' },
    ],
  };
  writeFileSync(
    join(claudeDir, 'settings.json'),
    JSON.stringify(settingsJson, null, 2),
    'utf-8'
  );

  // .claude/hooks/config/skills-manifest.json
  mkdirSync(join(claudeDir, 'hooks', 'config'), { recursive: true });
  const manifest = overrides.manifest || {
    version: '4.0.0',
    enforcement_mode: 'observe',
    total_skills: 229,
  };
  writeFileSync(
    join(claudeDir, 'hooks', 'config', 'skills-manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  // docs/isdlc/constitution.md
  const docsDir = join(projectRoot, 'docs', 'isdlc');
  mkdirSync(docsDir, { recursive: true });
  const constitutionContent =
    overrides.constitution || '# Project Constitution\n\nThis is a customized constitution.\n';
  writeFileSync(join(docsDir, 'constitution.md'), constitutionContent, 'utf-8');

  return projectRoot;
}

describe('doctor (lib/doctor.js)', () => {
  let tempDir;
  let capture;

  beforeEach(() => {
    tempDir = createTempDir();
    capture = manualCapture();
  });

  afterEach(() => {
    capture.restore();
    cleanupTempDir(tempDir);
  });

  // ───────────────────────────────────────────────
  // Check 1: Framework not installed
  // ───────────────────────────────────────────────
  describe('empty directory (no installation)', () => {
    it('should report "Not installed" for an empty directory', async () => {
      await runDoctor(tempDir);
      assert.ok(capture.output.includes('Not installed'), 'Should report not installed');
    });

    it('should show Issues Found in the summary', async () => {
      await runDoctor(tempDir);
      assert.ok(capture.output.includes('Issues Found'), 'Summary should say Issues Found');
    });

    it('should include the error marker for not-installed', async () => {
      await runDoctor(tempDir);
      assert.ok(capture.output.includes(XMARK), 'Should contain error X mark');
    });

    it('should suggest reinstalling', async () => {
      await runDoctor(tempDir);
      assert.ok(
        capture.output.includes('npx isdlc init'),
        'Should suggest npx isdlc init to fix issues'
      );
    });

    it('should short-circuit and not run all 8 checks', async () => {
      await runDoctor(tempDir);
      // Check 1 runs; check 2 should not appear since it early-returns on not-installed
      assert.ok(capture.output.includes('[1/8]'), 'Should show step 1');
      assert.ok(!capture.output.includes('[2/8]'), 'Should not reach step 2');
    });
  });

  // ───────────────────────────────────────────────
  // Check 2: .claude directory and subdirectories
  // ───────────────────────────────────────────────
  describe('.isdlc exists but no .claude directory', () => {
    it('should report .claude directory missing', async () => {
      // Create only .isdlc with state.json (enough for detectExistingIsdlc to return installed)
      const isdlcDir = join(tempDir, '.isdlc');
      mkdirSync(isdlcDir, { recursive: true });
      writeFileSync(
        join(isdlcDir, 'state.json'),
        JSON.stringify({ framework_version: '0.1.0-alpha' }),
        'utf-8'
      );

      await runDoctor(tempDir);

      assert.ok(capture.output.includes('[2/8]'), 'Should reach check 2');
      assert.ok(
        capture.output.includes('Missing') || capture.output.includes('missing'),
        'Should report .claude as missing'
      );
    });
  });

  describe('.claude directory with missing subdirectories', () => {
    it('should warn about missing subdirectories', async () => {
      // Create .isdlc + .claude but only create agents/ (skip skills, commands, hooks)
      const isdlcDir = join(tempDir, '.isdlc');
      const claudeDir = join(tempDir, '.claude');
      mkdirSync(isdlcDir, { recursive: true });
      writeFileSync(
        join(isdlcDir, 'state.json'),
        JSON.stringify({ framework_version: '0.1.0-alpha' }),
        'utf-8'
      );
      mkdirSync(join(claudeDir, 'agents'), { recursive: true });

      await runDoctor(tempDir);

      assert.ok(
        capture.output.includes('Some subdirectories missing') || capture.output.includes(WARNING_SYM),
        'Should warn about missing subdirectories'
      );
    });
  });

  // ───────────────────────────────────────────────
  // Check 4: state.json
  // ───────────────────────────────────────────────
  describe('corrupt state.json (invalid JSON)', () => {
    it('should report invalid JSON for state.json', async () => {
      const isdlcDir = join(tempDir, '.isdlc');
      const claudeDir = join(tempDir, '.claude');
      mkdirSync(isdlcDir, { recursive: true });
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(join(isdlcDir, 'state.json'), '{{{not valid json!!!', 'utf-8');

      await runDoctor(tempDir);

      assert.ok(capture.output.includes('Invalid JSON'), 'Should report Invalid JSON for state.json');
    });
  });

  describe('state.json missing required keys', () => {
    it('should warn about incomplete structure', async () => {
      const isdlcDir = join(tempDir, '.isdlc');
      const claudeDir = join(tempDir, '.claude');
      mkdirSync(isdlcDir, { recursive: true });
      mkdirSync(claudeDir, { recursive: true });
      // Valid JSON but missing project and phases keys
      writeFileSync(
        join(isdlcDir, 'state.json'),
        JSON.stringify({ framework_version: '0.1.0-alpha' }),
        'utf-8'
      );

      await runDoctor(tempDir);

      assert.ok(
        capture.output.includes('Incomplete') || capture.output.includes('incomplete'),
        'Should report incomplete state.json structure'
      );
    });
  });

  // ───────────────────────────────────────────────
  // Check 5: Constitution
  // ───────────────────────────────────────────────
  describe('constitution with STARTER_TEMPLATE marker', () => {
    it('should warn about needing customization', async () => {
      scaffoldValidInstall(tempDir, {
        constitution: '# STARTER_TEMPLATE\nThis needs customization\n',
      });

      await runDoctor(tempDir);

      assert.ok(
        capture.output.includes('Needs customization') || capture.output.includes('customization'),
        'Should warn about STARTER_TEMPLATE in constitution'
      );
    });
  });

  describe('constitution missing entirely', () => {
    it('should warn about missing constitution', async () => {
      // Scaffold without constitution: manually create everything except docs/
      const isdlcDir = join(tempDir, '.isdlc');
      const claudeDir = join(tempDir, '.claude');
      mkdirSync(isdlcDir, { recursive: true });
      writeFileSync(
        join(isdlcDir, 'state.json'),
        JSON.stringify({
          framework_version: '0.1.0-alpha',
          project: { name: 'test' },
          phases: {},
          current_phase: 'init',
        }),
        'utf-8'
      );
      writeFileSync(
        join(isdlcDir, 'installed-files.json'),
        JSON.stringify({ files: [], version: '0.1.0-alpha' }),
        'utf-8'
      );
      for (const subdir of ['agents', 'skills', 'commands', 'hooks']) {
        mkdirSync(join(claudeDir, subdir), { recursive: true });
      }
      writeFileSync(
        join(claudeDir, 'settings.json'),
        JSON.stringify({ hooks: [{ event: 'PreToolUse', command: 'test' }] }),
        'utf-8'
      );
      mkdirSync(join(claudeDir, 'hooks', 'config'), { recursive: true });
      writeFileSync(
        join(claudeDir, 'hooks', 'config', 'skills-manifest.json'),
        JSON.stringify({ version: '4.0.0' }),
        'utf-8'
      );

      await runDoctor(tempDir);

      assert.ok(
        capture.output.includes('Not found') || capture.output.includes('not found'),
        'Should report constitution not found'
      );
    });
  });

  // ───────────────────────────────────────────────
  // Check 6: Hooks configuration
  // ───────────────────────────────────────────────
  describe('settings.json without hooks', () => {
    it('should warn about no hooks configured', async () => {
      scaffoldValidInstall(tempDir, {
        settingsJson: { someOtherKey: true },
      });

      await runDoctor(tempDir);

      assert.ok(
        capture.output.includes('No hooks configured'),
        'Should warn about missing hooks in settings.json'
      );
    });
  });

  describe('settings.json with empty hooks array', () => {
    it('should warn about no hooks configured', async () => {
      scaffoldValidInstall(tempDir, {
        settingsJson: { hooks: [] },
      });

      await runDoctor(tempDir);

      assert.ok(
        capture.output.includes('No hooks configured'),
        'Should warn when hooks array is empty'
      );
    });
  });

  describe('settings.json missing entirely', () => {
    it('should warn about missing settings.json', async () => {
      scaffoldValidInstall(tempDir);
      const settingsPath = join(tempDir, '.claude', 'settings.json');
      unlinkSync(settingsPath);

      await runDoctor(tempDir);

      assert.ok(
        capture.output.includes('settings.json missing'),
        'Should warn about missing settings.json'
      );
    });
  });

  // ───────────────────────────────────────────────
  // Check 7: Skills manifest
  // ───────────────────────────────────────────────
  describe('missing skills manifest', () => {
    it('should warn about missing skills manifest', async () => {
      scaffoldValidInstall(tempDir);
      const manifestPath = join(
        tempDir,
        '.claude',
        'hooks',
        'config',
        'skills-manifest.json'
      );
      unlinkSync(manifestPath);

      await runDoctor(tempDir);

      assert.ok(
        capture.output.includes('Not found') || capture.output.includes('not found') || capture.output.includes('missing'),
        'Should warn about missing skills manifest'
      );
    });
  });

  // ───────────────────────────────────────────────
  // Check 8: Installation manifest
  // ───────────────────────────────────────────────
  describe('missing installation manifest', () => {
    it('should warn about missing installed-files.json', async () => {
      scaffoldValidInstall(tempDir);
      const manifestPath = join(tempDir, '.isdlc', 'installed-files.json');
      unlinkSync(manifestPath);

      await runDoctor(tempDir);

      assert.ok(
        capture.output.includes('Missing') || capture.output.includes('missing'),
        'Should warn about missing installation manifest'
      );
    });
  });

  describe('invalid installation manifest', () => {
    it('should report invalid JSON for installed-files.json', async () => {
      scaffoldValidInstall(tempDir);
      writeFileSync(
        join(tempDir, '.isdlc', 'installed-files.json'),
        '<<<not json>>>',
        'utf-8'
      );

      await runDoctor(tempDir);

      assert.ok(
        capture.output.includes('Invalid JSON') || capture.output.includes('invalid'),
        'Should report invalid JSON for installation manifest'
      );
    });
  });

  describe('installation manifest with invalid structure', () => {
    it('should warn about invalid manifest structure', async () => {
      scaffoldValidInstall(tempDir, {
        installedFiles: { notFiles: 'wrong structure' },
      });

      await runDoctor(tempDir);

      assert.ok(
        capture.output.includes('Invalid structure') || capture.output.includes('invalid') || capture.output.includes(WARNING_SYM),
        'Should warn about invalid installation manifest structure'
      );
    });
  });

  // ───────────────────────────────────────────────
  // Full valid installation (happy path)
  // ───────────────────────────────────────────────
  describe('full valid installation', () => {
    it('should report Health Check Passed', async () => {
      scaffoldValidInstall(tempDir);

      await runDoctor(tempDir);

      assert.ok(
        capture.output.includes('Health Check Passed'),
        'Should report Health Check Passed for valid installation'
      );
    });

    it('should run all 8 checks', async () => {
      scaffoldValidInstall(tempDir);

      await runDoctor(tempDir);

      for (let i = 1; i <= 8; i++) {
        assert.ok(
          capture.output.includes(`[${i}/8]`),
          `Should show step [${i}/8]`
        );
      }
    });

    it('should have multiple success checkmarks', async () => {
      scaffoldValidInstall(tempDir);

      await runDoctor(tempDir);

      // Count checkmarks — a full install should pass most checks
      const checkmarkCount = (capture.output.match(new RegExp(CHECKMARK, 'g')) || []).length;
      assert.ok(
        checkmarkCount >= 5,
        `Expected at least 5 checkmarks, got ${checkmarkCount}`
      );
    });

    it('should not have any error X marks', async () => {
      scaffoldValidInstall(tempDir);

      await runDoctor(tempDir);

      // A fully valid install should have zero X marks
      assert.ok(
        !capture.output.includes(XMARK),
        'Valid installation should have no error X marks'
      );
    });

    it('should report passed checks count', async () => {
      scaffoldValidInstall(tempDir);

      await runDoctor(tempDir);

      assert.ok(
        capture.output.includes('Passed:'),
        'Should include passed checks count in summary'
      );
    });

    it('should show the project path', async () => {
      scaffoldValidInstall(tempDir);

      await runDoctor(tempDir);

      assert.ok(
        capture.output.includes(tempDir),
        'Should display the project path in the header'
      );
    });

    it('should show the framework version', async () => {
      scaffoldValidInstall(tempDir);

      await runDoctor(tempDir);

      assert.ok(
        capture.output.includes('0.1.0-alpha'),
        'Should show the framework version from state.json'
      );
    });

    it('should report number of hooks configured', async () => {
      scaffoldValidInstall(tempDir);

      await runDoctor(tempDir);

      assert.ok(
        capture.output.includes('2 hooks configured'),
        'Should report the number of hooks (2 in scaffolded install)'
      );
    });

    it('should report number of tracked files', async () => {
      scaffoldValidInstall(tempDir);

      await runDoctor(tempDir);

      assert.ok(
        capture.output.includes('2 files tracked'),
        'Should report the number of tracked files from installed-files.json'
      );
    });

    it('should show CLI Version label', async () => {
      scaffoldValidInstall(tempDir);

      await runDoctor(tempDir);

      assert.ok(
        capture.output.includes('CLI Version'),
        'Should display CLI Version label at the end'
      );
    });
  });

  // ───────────────────────────────────────────────
  // Version mismatch detection
  // ───────────────────────────────────────────────
  describe('version mismatch', () => {
    it('should warn about version mismatch when installed version differs', async () => {
      scaffoldValidInstall(tempDir, {
        stateJson: {
          framework_version: '0.0.1-old',
          project: { name: 'test' },
          phases: {},
          current_phase: 'init',
        },
      });

      await runDoctor(tempDir);

      assert.ok(
        capture.output.includes('Version mismatch') || capture.output.includes('mismatch'),
        'Should warn about version mismatch'
      );
    });
  });

  // ───────────────────────────────────────────────
  // Edge case: .claude exists but .isdlc does not
  // ───────────────────────────────────────────────
  describe('.claude exists but .isdlc does not', () => {
    it('should detect as installed and proceed to check 2', async () => {
      // Only create .claude — detectExistingIsdlc considers it installed if either dir exists
      mkdirSync(join(tempDir, '.claude'), { recursive: true });

      await runDoctor(tempDir);

      // It should get past check 1 (installed) and proceed to check 2+
      assert.ok(
        capture.output.includes('[2/8]'),
        'Should proceed to check 2 when .claude dir exists'
      );
    });

    it('should report .isdlc directory as missing in check 3', async () => {
      mkdirSync(join(tempDir, '.claude'), { recursive: true });

      await runDoctor(tempDir);

      assert.ok(
        capture.output.includes('[3/8]'),
        'Should reach check 3 (.isdlc directory)'
      );
      // .isdlc dir is missing so check 3 should flag it
      assert.ok(
        capture.output.includes('Missing') || capture.output.includes('missing'),
        'Should report .isdlc directory as missing'
      );
    });
  });

  // ───────────────────────────────────────────────
  // Edge case: settings.json with invalid JSON
  // ───────────────────────────────────────────────
  describe('settings.json with corrupt JSON', () => {
    it('should report settings.json as invalid', async () => {
      scaffoldValidInstall(tempDir);
      writeFileSync(
        join(tempDir, '.claude', 'settings.json'),
        '{{broken',
        'utf-8'
      );

      await runDoctor(tempDir);

      assert.ok(
        capture.output.includes('Invalid JSON') || capture.output.includes('invalid'),
        'Should report invalid settings.json'
      );
    });
  });
});
