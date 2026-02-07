/**
 * Tests for lib/installer.js
 *
 * Uses subprocess approach: calls `node bin/isdlc.js init --force` in a temp directory
 * and inspects the resulting filesystem. Each test creates its own isolated temp dir.
 *
 * The --force flag is critical: it skips all interactive prompts and defaults to
 * quality provider mode.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTempDir, cleanupTempDir } from './utils/test-helpers.js';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const binPath = join(__dirname, '..', 'bin', 'isdlc.js');

/**
 * Create a minimal project directory with package.json and git init.
 * Returns the absolute path to the temp project directory.
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
 * Run isdlc init with --force and optional extra flags in the given directory.
 */
function runInit(cwd, extraArgs = '') {
  return execSync(`node "${binPath}" init --force ${extraArgs}`, {
    cwd,
    encoding: 'utf-8',
    timeout: 60000,
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });
}

// ---------------------------------------------------------------------------
// init --force: directory creation
// ---------------------------------------------------------------------------

describe('installer: init --force creates expected directories', () => {
  let projectDir;

  before(() => {
    projectDir = setupProjectDir('dir-test');
    runInit(projectDir);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('creates .claude/ directory', () => {
    assert.ok(existsSync(join(projectDir, '.claude')), '.claude/ should exist');
  });

  it('creates .isdlc/ directory', () => {
    assert.ok(existsSync(join(projectDir, '.isdlc')), '.isdlc/ should exist');
  });

  it('creates docs/ directory', () => {
    assert.ok(existsSync(join(projectDir, 'docs')), 'docs/ should exist');
  });
});

// ---------------------------------------------------------------------------
// init --force: state.json
// ---------------------------------------------------------------------------

describe('installer: state.json', () => {
  let projectDir;
  let state;

  before(() => {
    projectDir = setupProjectDir('state-test');
    runInit(projectDir);
    const raw = readFileSync(join(projectDir, '.isdlc', 'state.json'), 'utf-8');
    state = JSON.parse(raw);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('creates state.json with framework_version key', () => {
    assert.ok('framework_version' in state, 'state should have framework_version');
    assert.equal(typeof state.framework_version, 'string');
  });

  it('creates state.json with project key', () => {
    assert.ok('project' in state, 'state should have project key');
    assert.ok('name' in state.project, 'project should have name');
  });

  it('creates state.json with phases key', () => {
    assert.ok('phases' in state, 'state should have phases key');
    assert.ok('01-requirements' in state.phases, 'phases should include 01-requirements');
  });

  it('project.name matches the package.json name', () => {
    assert.equal(state.project.name, 'state-test');
  });
});

// ---------------------------------------------------------------------------
// init --force: settings.json
// ---------------------------------------------------------------------------

describe('installer: settings.json', () => {
  let projectDir;
  let settings;

  before(() => {
    projectDir = setupProjectDir('settings-test');
    runInit(projectDir);
    const raw = readFileSync(join(projectDir, '.claude', 'settings.json'), 'utf-8');
    settings = JSON.parse(raw);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('creates settings.json with hooks object containing PreToolUse and PostToolUse', () => {
    assert.ok('hooks' in settings, 'settings should have hooks key');
    assert.equal(typeof settings.hooks, 'object', 'hooks should be an object');
    assert.ok('PreToolUse' in settings.hooks, 'hooks should have PreToolUse key');
    assert.ok('PostToolUse' in settings.hooks, 'hooks should have PostToolUse key');
  });
});

// ---------------------------------------------------------------------------
// init --force: framework file subdirectories
// ---------------------------------------------------------------------------

describe('installer: copies framework file subdirectories', () => {
  let projectDir;

  before(() => {
    projectDir = setupProjectDir('files-test');
    runInit(projectDir);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('creates .claude/agents/ with agent files', () => {
    const agentsDir = join(projectDir, '.claude', 'agents');
    assert.ok(existsSync(agentsDir), '.claude/agents/ should exist');
    const entries = readdirSync(agentsDir, { recursive: true });
    assert.ok(entries.length > 0, 'agents/ should contain files');
  });

  it('creates .claude/skills/ with skill files', () => {
    const skillsDir = join(projectDir, '.claude', 'skills');
    assert.ok(existsSync(skillsDir), '.claude/skills/ should exist');
    const entries = readdirSync(skillsDir, { recursive: true });
    assert.ok(entries.length > 0, 'skills/ should contain files');
  });

  it('creates .claude/hooks/ with hook files', () => {
    const hooksDir = join(projectDir, '.claude', 'hooks');
    assert.ok(existsSync(hooksDir), '.claude/hooks/ should exist');
    const entries = readdirSync(hooksDir, { recursive: true });
    assert.ok(entries.length > 0, 'hooks/ should contain files');
  });

  it('creates .claude/commands/ with command files', () => {
    const commandsDir = join(projectDir, '.claude', 'commands');
    assert.ok(existsSync(commandsDir), '.claude/commands/ should exist');
    const entries = readdirSync(commandsDir, { recursive: true });
    assert.ok(entries.length > 0, 'commands/ should contain files');
  });
});

// ---------------------------------------------------------------------------
// init --force: installed-files.json manifest
// ---------------------------------------------------------------------------

describe('installer: installed-files.json manifest', () => {
  let projectDir;
  let manifest;

  before(() => {
    projectDir = setupProjectDir('manifest-test');
    runInit(projectDir);
    const raw = readFileSync(join(projectDir, '.isdlc', 'installed-files.json'), 'utf-8');
    manifest = JSON.parse(raw);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('creates installed-files.json', () => {
    assert.ok(existsSync(join(projectDir, '.isdlc', 'installed-files.json')));
  });

  it('manifest has files array with tracked entries', () => {
    assert.ok(Array.isArray(manifest.files), 'manifest should have files array');
    assert.ok(manifest.files.length > 0, 'files array should not be empty');
  });

  it('manifest has framework_version', () => {
    assert.ok('framework_version' in manifest, 'manifest should have framework_version');
  });
});

// ---------------------------------------------------------------------------
// init --force --dry-run: no directories created
// ---------------------------------------------------------------------------

describe('installer: init --force --dry-run creates NO directories', () => {
  let projectDir;

  before(() => {
    projectDir = setupProjectDir('dryrun-test');
    runInit(projectDir, '--dry-run');
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('does not create .isdlc/state.json', () => {
    assert.ok(
      !existsSync(join(projectDir, '.isdlc', 'state.json')),
      '.isdlc/state.json should NOT exist in dry-run'
    );
  });

  it('does not create .isdlc/installed-files.json', () => {
    assert.ok(
      !existsSync(join(projectDir, '.isdlc', 'installed-files.json')),
      'installed-files.json should NOT exist in dry-run'
    );
  });
});

// ---------------------------------------------------------------------------
// init --force: settings.json preserves existing user keys
// ---------------------------------------------------------------------------

describe('installer: settings.json preserves existing user keys', () => {
  let projectDir;
  let settings;

  before(() => {
    projectDir = setupProjectDir('merge-test');
    // Create a pre-existing settings.json with a custom user key
    mkdirSync(join(projectDir, '.claude'), { recursive: true });
    writeFileSync(
      join(projectDir, '.claude', 'settings.json'),
      JSON.stringify({ myCustomKey: 'preserve-me', userTheme: 'dark' }, null, 2),
      'utf-8'
    );
    runInit(projectDir);
    const raw = readFileSync(join(projectDir, '.claude', 'settings.json'), 'utf-8');
    settings = JSON.parse(raw);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('preserves custom user keys after install', () => {
    assert.equal(settings.myCustomKey, 'preserve-me', 'myCustomKey should be preserved');
    assert.equal(settings.userTheme, 'dark', 'userTheme should be preserved');
  });

  it('still adds framework hooks', () => {
    assert.ok('hooks' in settings, 'hooks should still be present after merge');
  });
});

// ---------------------------------------------------------------------------
// init --force: reinstall on already installed directory
// ---------------------------------------------------------------------------

describe('installer: reinstall on already installed directory succeeds', () => {
  let projectDir;

  before(() => {
    projectDir = setupProjectDir('reinstall-test');
    // First install
    runInit(projectDir);
    // Second install (reinstall)
    runInit(projectDir);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('succeeds without error and state.json still exists', () => {
    assert.ok(existsSync(join(projectDir, '.isdlc', 'state.json')), 'state.json should exist after reinstall');
  });

  it('installed-files.json is regenerated', () => {
    assert.ok(existsSync(join(projectDir, '.isdlc', 'installed-files.json')), 'manifest should exist after reinstall');
  });
});

// ---------------------------------------------------------------------------
// init --force: phase directories created in .isdlc
// ---------------------------------------------------------------------------

describe('installer: phase directories created in .isdlc', () => {
  let projectDir;

  before(() => {
    projectDir = setupProjectDir('phases-test');
    runInit(projectDir);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('creates .isdlc/phases/ with 13 phase subdirectories', () => {
    const phasesDir = join(projectDir, '.isdlc', 'phases');
    assert.ok(existsSync(phasesDir), '.isdlc/phases/ should exist');
    const entries = readdirSync(phasesDir);
    assert.equal(entries.length, 13, 'should have 13 phase directories');
  });

  it('each phase directory has an artifacts/ subdirectory', () => {
    const phasesDir = join(projectDir, '.isdlc', 'phases');
    const entries = readdirSync(phasesDir);
    for (const entry of entries) {
      const artifactsDir = join(phasesDir, entry, 'artifacts');
      assert.ok(existsSync(artifactsDir), `${entry}/artifacts/ should exist`);
    }
  });
});

// ---------------------------------------------------------------------------
// init --force: docs structure
// ---------------------------------------------------------------------------

describe('installer: docs structure', () => {
  let projectDir;

  before(() => {
    projectDir = setupProjectDir('docs-test');
    runInit(projectDir);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('creates docs/README.md', () => {
    assert.ok(existsSync(join(projectDir, 'docs', 'README.md')), 'docs/README.md should exist');
  });

  it('creates docs/isdlc/constitution.md', () => {
    assert.ok(
      existsSync(join(projectDir, 'docs', 'isdlc', 'constitution.md')),
      'docs/isdlc/constitution.md should exist'
    );
  });

  it('constitution contains the project name', () => {
    const content = readFileSync(join(projectDir, 'docs', 'isdlc', 'constitution.md'), 'utf-8');
    assert.ok(content.includes('docs-test'), 'constitution should contain the project name');
  });

  it('creates docs/requirements/ directory', () => {
    assert.ok(existsSync(join(projectDir, 'docs', 'requirements')), 'docs/requirements/ should exist');
  });

  it('creates docs/architecture/ directory', () => {
    assert.ok(existsSync(join(projectDir, 'docs', 'architecture')), 'docs/architecture/ should exist');
  });
});

// ---------------------------------------------------------------------------
// init --force: CLAUDE.md created if missing
// ---------------------------------------------------------------------------

describe('installer: CLAUDE.md created if missing', () => {
  let projectDir;

  before(() => {
    projectDir = setupProjectDir('claudemd-test');
    runInit(projectDir);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('creates an empty CLAUDE.md in project root', () => {
    assert.ok(existsSync(join(projectDir, 'CLAUDE.md')), 'CLAUDE.md should exist');
  });
});

// ---------------------------------------------------------------------------
// default export
// ---------------------------------------------------------------------------

describe('installer: default export', () => {
  it('exports an object with install function', async () => {
    const mod = await import('./installer.js');
    assert.equal(typeof mod.install, 'function');
    assert.equal(typeof mod.default.install, 'function');
  });
});
