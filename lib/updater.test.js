/**
 * Tests for lib/updater.js
 *
 * Tests the getVersion(), checkForUpdates() export structure, and the update()
 * function via subprocess. The update flow requires an existing installation,
 * so each test that exercises update() first runs init --force.
 *
 * Uses real temp filesystem and subprocess approach for isolation.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync, readdirSync, cpSync } from 'node:fs';
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
 * Run isdlc update with --force and optional extra flags.
 */
function runUpdate(cwd, extraArgs = '') {
  return execSync(`node "${binPath}" update --force ${extraArgs}`, {
    cwd,
    encoding: 'utf-8',
    timeout: 60000,
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });
}

// ---------------------------------------------------------------------------
// getVersion()
// ---------------------------------------------------------------------------

describe('updater: getVersion()', () => {
  it('returns a semver-like version string', async () => {
    const { getVersion } = await import('./updater.js');
    const version = await getVersion();
    assert.equal(typeof version, 'string');
    assert.ok(version.length > 0, 'version should not be empty');
    // Should match semver pattern (possibly with prerelease like 0.1.0-alpha)
    assert.match(version, /^\d+\.\d+\.\d+/, 'should start with major.minor.patch');
  });
});

// ---------------------------------------------------------------------------
// checkForUpdates() structural test
// ---------------------------------------------------------------------------

describe('updater: checkForUpdates()', () => {
  it('is exported and callable', async () => {
    const { checkForUpdates } = await import('./updater.js');
    assert.equal(typeof checkForUpdates, 'function');
  });
});

// ---------------------------------------------------------------------------
// update on non-installed directory
// ---------------------------------------------------------------------------

describe('updater: update on non-installed directory fails gracefully', () => {
  let projectDir;
  let threw = false;
  let errorMsg = '';

  before(() => {
    projectDir = setupProjectDir('no-install');
    try {
      runUpdate(projectDir);
    } catch (err) {
      threw = true;
      errorMsg = err.stderr || err.stdout || err.message || '';
    }
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('exits with non-zero status', () => {
    assert.ok(threw, 'update on non-installed dir should throw/exit non-zero');
  });

  it('error message mentions missing installation', () => {
    assert.ok(
      errorMsg.includes('No iSDLC installation') || errorMsg.includes('init'),
      `error should mention missing installation, got: ${errorMsg.slice(0, 200)}`
    );
  });
});

// ---------------------------------------------------------------------------
// Full cycle: install then update
// ---------------------------------------------------------------------------

describe('updater: install --force then update --force succeeds', () => {
  let projectDir;
  let output;

  before(() => {
    projectDir = setupProjectDir('update-cycle');
    runInit(projectDir);
    output = runUpdate(projectDir);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('update completes without error', () => {
    assert.ok(output.includes('Update Complete') || output.includes('up to date'), 'output should indicate success');
  });

  it('state.json still exists after update', () => {
    assert.ok(existsSync(join(projectDir, '.isdlc', 'state.json')));
  });
});

// ---------------------------------------------------------------------------
// update --force preserves state.json project data
// ---------------------------------------------------------------------------

describe('updater: update --force preserves state.json project data', () => {
  let projectDir;
  let stateBefore;
  let stateAfter;

  before(() => {
    projectDir = setupProjectDir('preserve-state');
    runInit(projectDir);
    stateBefore = JSON.parse(readFileSync(join(projectDir, '.isdlc', 'state.json'), 'utf-8'));
    runUpdate(projectDir);
    stateAfter = JSON.parse(readFileSync(join(projectDir, '.isdlc', 'state.json'), 'utf-8'));
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('preserves project.name', () => {
    assert.equal(stateAfter.project.name, stateBefore.project.name);
  });

  it('preserves project.created timestamp', () => {
    assert.equal(stateAfter.project.created, stateBefore.project.created);
  });

  it('framework_version is present after update', () => {
    assert.ok('framework_version' in stateAfter);
  });
});

// ---------------------------------------------------------------------------
// update --force preserves existing settings.json user keys
// ---------------------------------------------------------------------------

describe('updater: update --force preserves settings.json user keys', () => {
  let projectDir;
  let settings;

  before(() => {
    projectDir = setupProjectDir('settings-preserve');
    runInit(projectDir);
    // Inject a custom user key into settings.json
    const settingsPath = join(projectDir, '.claude', 'settings.json');
    const existing = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    existing.myUserKey = 'should-survive-update';
    writeFileSync(settingsPath, JSON.stringify(existing, null, 2), 'utf-8');
    // Run update
    runUpdate(projectDir);
    settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('user key survives update', () => {
    assert.equal(settings.myUserKey, 'should-survive-update');
  });

  it('framework hooks still present', () => {
    assert.ok('hooks' in settings, 'hooks should still exist after update');
  });
});

// ---------------------------------------------------------------------------
// update --dry-run --force makes no changes
// ---------------------------------------------------------------------------

describe('updater: update --dry-run --force makes no changes', () => {
  let projectDir;
  let stateBefore;
  let manifestBefore;

  before(() => {
    projectDir = setupProjectDir('dryrun-update');
    runInit(projectDir);
    stateBefore = readFileSync(join(projectDir, '.isdlc', 'state.json'), 'utf-8');
    manifestBefore = readFileSync(join(projectDir, '.isdlc', 'installed-files.json'), 'utf-8');
    runUpdate(projectDir, '--dry-run');
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('state.json is unchanged', () => {
    const stateAfter = readFileSync(join(projectDir, '.isdlc', 'state.json'), 'utf-8');
    assert.equal(stateAfter, stateBefore, 'state.json should be identical before and after dry-run');
  });

  it('installed-files.json is unchanged', () => {
    const manifestAfter = readFileSync(join(projectDir, '.isdlc', 'installed-files.json'), 'utf-8');
    assert.equal(manifestAfter, manifestBefore, 'manifest should be identical before and after dry-run');
  });
});

// ---------------------------------------------------------------------------
// update --force creates history entry in state.json
// ---------------------------------------------------------------------------

describe('updater: update --force creates history entry', () => {
  let projectDir;
  let stateAfter;

  before(() => {
    projectDir = setupProjectDir('history-test');
    runInit(projectDir);
    runUpdate(projectDir);
    stateAfter = JSON.parse(readFileSync(join(projectDir, '.isdlc', 'state.json'), 'utf-8'));
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('history array contains an update entry', () => {
    assert.ok(Array.isArray(stateAfter.history), 'state should have history array');
    const updateEntry = stateAfter.history.find((h) => h.agent === 'npm-updater');
    assert.ok(updateEntry, 'should have a history entry from npm-updater');
    assert.ok(updateEntry.action.includes('updated'), 'action should mention update');
  });
});

// ---------------------------------------------------------------------------
// update --force regenerates installed-files.json
// ---------------------------------------------------------------------------

describe('updater: update --force regenerates installed-files.json', () => {
  let projectDir;
  let manifest;

  before(() => {
    projectDir = setupProjectDir('regen-manifest');
    runInit(projectDir);
    runUpdate(projectDir);
    manifest = JSON.parse(readFileSync(join(projectDir, '.isdlc', 'installed-files.json'), 'utf-8'));
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('manifest exists after update', () => {
    assert.ok(existsSync(join(projectDir, '.isdlc', 'installed-files.json')));
  });

  it('manifest has files array', () => {
    assert.ok(Array.isArray(manifest.files));
    assert.ok(manifest.files.length > 0);
  });

  it('manifest has framework_version', () => {
    assert.ok('framework_version' in manifest);
  });
});

// ---------------------------------------------------------------------------
// update --backup --force creates backup directory
// ---------------------------------------------------------------------------

describe('updater: update --backup --force creates backup', () => {
  let projectDir;

  before(() => {
    projectDir = setupProjectDir('backup-test');
    runInit(projectDir);
    runUpdate(projectDir, '--backup');
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('creates an isdlc-backup-* directory', () => {
    const entries = readdirSync(projectDir);
    const backupDirs = entries.filter((e) => e.startsWith('isdlc-backup-'));
    assert.ok(backupDirs.length > 0, 'should have at least one backup directory');
  });

  it('backup contains .claude/ or .isdlc/ subdirectory', () => {
    const entries = readdirSync(projectDir);
    const backupDir = entries.find((e) => e.startsWith('isdlc-backup-'));
    const backupPath = join(projectDir, backupDir);
    const backupContents = readdirSync(backupPath);
    assert.ok(
      backupContents.includes('.claude') || backupContents.includes('.isdlc'),
      'backup should contain .claude or .isdlc'
    );
  });
});

// ---------------------------------------------------------------------------
// default export
// ---------------------------------------------------------------------------

describe('updater: default export', () => {
  it('exports an object with expected functions', async () => {
    const mod = await import('./updater.js');
    assert.equal(typeof mod.default.checkForUpdates, 'function');
    assert.equal(typeof mod.default.displayUpdateNotification, 'function');
    assert.equal(typeof mod.default.getVersion, 'function');
    assert.equal(typeof mod.default.update, 'function');
  });
});
