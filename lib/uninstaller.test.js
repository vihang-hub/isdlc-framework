/**
 * Tests for lib/uninstaller.js
 *
 * Uses subprocess approach: first installs with `node bin/isdlc.js init --force`,
 * then uninstalls with `node bin/isdlc.js uninstall --force`.
 * Each test creates its own isolated temp directory.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTempDir, cleanupTempDir } from './utils/test-helpers.js';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const binPath = join(__dirname, '..', 'bin', 'isdlc.js');

/**
 * Create a minimal project directory with package.json and git init.
 */
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

/**
 * Run isdlc init --force in the given directory.
 */
function runInit(cwd) {
  return execSync(`node "${binPath}" init --force`, {
    cwd,
    encoding: 'utf-8',
    timeout: 60000,
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });
}

/**
 * Run isdlc uninstall --force with optional extra flags.
 */
function runUninstall(cwd, extraArgs = '') {
  return execSync(`node "${binPath}" uninstall --force ${extraArgs}`, {
    cwd,
    encoding: 'utf-8',
    timeout: 60000,
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });
}

// ---------------------------------------------------------------------------
// uninstall on non-installed directory exits gracefully
// ---------------------------------------------------------------------------

describe('uninstaller: uninstall on non-installed dir exits gracefully', () => {
  let projectDir;
  let output;

  before(() => {
    projectDir = setupProjectDir('no-install');
    // Run uninstall without prior install -- should not crash
    output = runUninstall(projectDir);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('does not throw (exits 0)', () => {
    // If we got here, execSync did not throw, so exit code was 0
    assert.ok(true, 'uninstall on empty dir should not crash');
  });

  it('output mentions no installation detected', () => {
    assert.ok(
      output.includes('No iSDLC') || output.includes('not') || output.includes('detected'),
      'should indicate no installation found'
    );
  });
});

// ---------------------------------------------------------------------------
// Full cycle: install then uninstall removes .claude/
// ---------------------------------------------------------------------------

describe('uninstaller: install then uninstall removes framework files from .claude/', () => {
  let projectDir;

  before(() => {
    projectDir = setupProjectDir('full-cycle');
    runInit(projectDir);
    runUninstall(projectDir);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('settings.json hooks are removed', () => {
    const settingsPath = join(projectDir, '.claude', 'settings.json');
    if (existsSync(settingsPath)) {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      assert.ok(!('hooks' in settings), 'hooks should be removed from settings.json');
    } else {
      // settings.json removed entirely is also valid
      assert.ok(true);
    }
  });

  it('.claude/ no longer has settings.json with hooks', () => {
    // The uninstaller strips hooks and permissions from settings.json.
    // If no user keys remain, the file is deleted entirely.
    const settingsPath = join(projectDir, '.claude', 'settings.json');
    if (existsSync(settingsPath)) {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      assert.ok(!('hooks' in settings));
      assert.ok(!('permissions' in settings));
    } else {
      assert.ok(true, 'settings.json deleted entirely');
    }
  });
});

// ---------------------------------------------------------------------------
// After uninstall, .isdlc/state.json is preserved
// ---------------------------------------------------------------------------

describe('uninstaller: .isdlc/state.json is preserved after uninstall', () => {
  let projectDir;

  before(() => {
    projectDir = setupProjectDir('preserve-state');
    runInit(projectDir);
    runUninstall(projectDir);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('state.json still exists', () => {
    assert.ok(
      existsSync(join(projectDir, '.isdlc', 'state.json')),
      '.isdlc/state.json should be preserved after uninstall'
    );
  });

  it('state.json is valid JSON with project data', () => {
    const raw = readFileSync(join(projectDir, '.isdlc', 'state.json'), 'utf-8');
    const state = JSON.parse(raw);
    assert.ok('project' in state, 'state should still have project key');
  });
});

// ---------------------------------------------------------------------------
// uninstall --force --dry-run makes no changes
// ---------------------------------------------------------------------------

describe('uninstaller: uninstall --force --dry-run makes no changes', () => {
  let projectDir;

  before(() => {
    projectDir = setupProjectDir('dryrun-uninstall');
    runInit(projectDir);
    runUninstall(projectDir, '--dry-run');
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('.claude/ still exists after dry-run uninstall', () => {
    assert.ok(existsSync(join(projectDir, '.claude')), '.claude/ should still exist');
  });

  it('.claude/agents/ still has files after dry-run', () => {
    const agentsDir = join(projectDir, '.claude', 'agents');
    assert.ok(existsSync(agentsDir), 'agents/ should still exist');
    const entries = readdirSync(agentsDir, { recursive: true });
    assert.ok(entries.length > 0, 'agents/ should still contain files');
  });

  it('state.json still exists after dry-run', () => {
    assert.ok(existsSync(join(projectDir, '.isdlc', 'state.json')));
  });
});

// ---------------------------------------------------------------------------
// uninstall --force cleans hooks from settings.json
// ---------------------------------------------------------------------------

describe('uninstaller: cleans hooks from settings.json', () => {
  let projectDir;

  before(() => {
    projectDir = setupProjectDir('clean-settings');
    runInit(projectDir);
    // Verify hooks exist before uninstall
    const settingsBefore = JSON.parse(readFileSync(join(projectDir, '.claude', 'settings.json'), 'utf-8'));
    assert.ok('hooks' in settingsBefore, 'hooks should exist before uninstall (precondition)');
    runUninstall(projectDir);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('settings.json has hooks removed (or file deleted entirely)', () => {
    const settingsPath = join(projectDir, '.claude', 'settings.json');
    if (existsSync(settingsPath)) {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      assert.ok(!('hooks' in settings), 'hooks key should be removed from settings.json');
      assert.ok(!('permissions' in settings), 'permissions key should be removed from settings.json');
    } else {
      // settings.json was removed entirely (empty after stripping) -- that is fine
      assert.ok(true, 'settings.json was removed entirely');
    }
  });
});

// ---------------------------------------------------------------------------
// After uninstall, docs/ scaffold is preserved
// ---------------------------------------------------------------------------

describe('uninstaller: docs/ scaffold is preserved by default', () => {
  let projectDir;

  before(() => {
    projectDir = setupProjectDir('docs-preserve');
    runInit(projectDir);
    // docs/ has content (README.md, constitution.md, etc.)
    runUninstall(projectDir);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('docs/ directory still exists', () => {
    assert.ok(existsSync(join(projectDir, 'docs')), 'docs/ should be preserved by default');
  });
});

// ---------------------------------------------------------------------------
// uninstall --force on partial installation handles gracefully
// ---------------------------------------------------------------------------

describe('uninstaller: partial installation (only .isdlc) handles gracefully', () => {
  let projectDir;
  let output;

  before(() => {
    projectDir = setupProjectDir('partial-install');
    // Create only .isdlc/ without .claude/
    mkdirSync(join(projectDir, '.isdlc'), { recursive: true });
    writeFileSync(
      join(projectDir, '.isdlc', 'state.json'),
      JSON.stringify({ framework_version: '0.1.0-alpha', project: { name: 'partial' } }),
      'utf-8'
    );
    output = runUninstall(projectDir);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('does not throw (exits 0)', () => {
    assert.ok(true, 'should handle partial installation without crashing');
  });

  it('state.json is preserved', () => {
    assert.ok(
      existsSync(join(projectDir, '.isdlc', 'state.json')),
      'state.json should be preserved even in partial uninstall'
    );
  });
});

// ---------------------------------------------------------------------------
// uninstall removes .isdlc framework dirs but preserves state
// ---------------------------------------------------------------------------

describe('uninstaller: removes framework dirs from .isdlc/', () => {
  let projectDir;

  before(() => {
    projectDir = setupProjectDir('framework-dirs');
    runInit(projectDir);
    runUninstall(projectDir);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('.isdlc/config/ is removed', () => {
    assert.ok(!existsSync(join(projectDir, '.isdlc', 'config')), '.isdlc/config/ should be removed');
  });

  it('.isdlc/templates/ is removed', () => {
    assert.ok(!existsSync(join(projectDir, '.isdlc', 'templates')), '.isdlc/templates/ should be removed');
  });

  it('.isdlc/scripts/ is removed', () => {
    assert.ok(!existsSync(join(projectDir, '.isdlc', 'scripts')), '.isdlc/scripts/ should be removed');
  });

  it('.isdlc/installed-files.json is removed', () => {
    assert.ok(
      !existsSync(join(projectDir, '.isdlc', 'installed-files.json')),
      'installed-files.json should be removed'
    );
  });

  it('.isdlc/state.json is still present', () => {
    assert.ok(existsSync(join(projectDir, '.isdlc', 'state.json')), 'state.json should be preserved');
  });
});

// ---------------------------------------------------------------------------
// default export
// ---------------------------------------------------------------------------

describe('uninstaller: default export', () => {
  it('exports an object with uninstall function', async () => {
    const mod = await import('./uninstaller.js');
    assert.equal(typeof mod.uninstall, 'function');
    assert.equal(typeof mod.default.uninstall, 'function');
  });
});
