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
// init --force: Claude Code detection
// ---------------------------------------------------------------------------

describe('installer: Claude Code detection with --force', () => {
  let projectDir;
  let output;

  before(() => {
    projectDir = setupProjectDir('claude-detect-test');
    output = runInit(projectDir);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('completes installation even if claude CLI is not on PATH', () => {
    assert.ok(existsSync(join(projectDir, '.isdlc', 'state.json')), 'state.json should exist');
    assert.ok(existsSync(join(projectDir, '.claude', 'settings.json')), 'settings.json should exist');
  });

  it('output mentions Claude Code detection step', () => {
    assert.ok(
      output.includes('Checking for Claude Code') || output.includes('Claude Code'),
      'output should mention Claude Code detection'
    );
  });

  // Provider selection disabled — framework is Claude Code-specific
  it('output mentions AI assistant engine', () => {
    assert.ok(
      output.includes('Claude Code') || output.includes('AI Assistant'),
      'output should reference Claude Code as the AI engine'
    );
  });
});

// ---------------------------------------------------------------------------
// init --force: state.json uses observe mode
// ---------------------------------------------------------------------------

describe('installer: state.json skill_enforcement uses observe mode', () => {
  let projectDir;
  let state;

  before(() => {
    projectDir = setupProjectDir('observe-mode-test');
    runInit(projectDir);
    const raw = readFileSync(join(projectDir, '.isdlc', 'state.json'), 'utf-8');
    state = JSON.parse(raw);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('skill_enforcement.mode is observe (not strict)', () => {
    assert.equal(state.skill_enforcement.mode, 'observe', 'mode should be observe');
  });
});

// ---------------------------------------------------------------------------
// init --force: tour is skipped
// ---------------------------------------------------------------------------

describe('installer: --force skips tour', () => {
  let projectDir;
  let output;

  before(() => {
    projectDir = setupProjectDir('tour-skip-test');
    output = runInit(projectDir);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('completes without hanging (tour prompt not shown)', () => {
    assert.ok(existsSync(join(projectDir, '.isdlc', 'state.json')), 'state.json should exist');
  });

  it('output does not contain tour prompt', () => {
    assert.ok(
      !output.includes('QUICK OVERVIEW'),
      'output should NOT contain tour header in --force mode'
    );
  });

  it('output still contains Next Steps section', () => {
    assert.ok(
      output.includes('Next Steps'),
      'output should contain Next Steps section'
    );
  });

  it('Next Steps mentions /tour command', () => {
    assert.ok(
      output.includes('/tour'),
      'Next Steps should mention /tour command'
    );
  });
});

// ---------------------------------------------------------------------------
// init --force: tour command file is installed
// ---------------------------------------------------------------------------

describe('installer: tour command file is installed', () => {
  let projectDir;

  before(() => {
    projectDir = setupProjectDir('tour-file-test');
    runInit(projectDir);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  it('installs tour.md in .claude/commands/', () => {
    assert.ok(
      existsSync(join(projectDir, '.claude', 'commands', 'tour.md')),
      '.claude/commands/tour.md should exist'
    );
  });

  it('tour.md has correct YAML frontmatter', () => {
    const content = readFileSync(join(projectDir, '.claude', 'commands', 'tour.md'), 'utf-8');
    assert.ok(content.includes('name: tour'), 'should have name: tour');
    assert.ok(content.includes('user_invocable: true'), 'should have user_invocable: true');
  });

  it('tour.md contains use-case-driven content', () => {
    const content = readFileSync(join(projectDir, '.claude', 'commands', 'tour.md'), 'utf-8');
    assert.ok(content.includes('existing project'), 'should contain existing project use case');
    assert.ok(content.includes('greenfield'), 'should contain greenfield use case');
    assert.ok(content.includes('Upgrading'), 'should contain upgrade use case');
    assert.ok(content.includes('test suite'), 'should contain test generation use case');
  });
});

// ---------------------------------------------------------------------------
// REQ-0014: BACKLOG.md content validation (TC-01 through TC-06)
// ---------------------------------------------------------------------------

describe('installer: BACKLOG.md content validation', () => {
  let projectDir;
  let content;

  before(() => {
    projectDir = setupProjectDir('backlog-content-test');
    runInit(projectDir);
    content = readFileSync(join(projectDir, 'BACKLOG.md'), 'utf-8');
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  // TC-01: BACKLOG.md contains title header (traces AC-04, NFR-01)
  it('contains # Project Backlog as the title', () => {
    assert.ok(content.startsWith('# Project Backlog'), 'should start with # Project Backlog title');
  });

  // TC-02: BACKLOG.md contains preamble blockquote (traces AC-04, NFR-01)
  it('contains preamble blockquote explaining purpose', () => {
    assert.ok(content.includes('> Backlog and completed items are tracked here.'), 'should have preamble');
    assert.ok(content.includes('> This file is NOT loaded into every conversation'), 'should have context warning');
  });

  // TC-03: BACKLOG.md contains ## Open section header (traces AC-02, NFR-01)
  it('contains ## Open section header', () => {
    assert.ok(content.includes('\n## Open\n'), 'should contain ## Open section');
  });

  // TC-04: BACKLOG.md contains ## Completed section header (traces AC-03, NFR-01)
  it('contains ## Completed section header', () => {
    assert.ok(content.includes('\n## Completed\n'), 'should contain ## Completed section');
  });

  // TC-05: BACKLOG.md ends with trailing newline (traces NFR-01)
  it('ends with exactly one trailing newline', () => {
    assert.ok(content.endsWith('\n'), 'should end with trailing newline');
    assert.ok(!content.endsWith('\n\n'), 'should not end with double newline');
  });

  // TC-06: ## Open appears before ## Completed (traces AC-05, NFR-01)
  it('has ## Open before ## Completed', () => {
    const openIndex = content.indexOf('## Open');
    const completedIndex = content.indexOf('## Completed');
    assert.ok(openIndex > -1 && completedIndex > -1, 'both sections must exist');
    assert.ok(openIndex < completedIndex, '## Open must appear before ## Completed');
  });
});

// ---------------------------------------------------------------------------
// REQ-0014: BACKLOG.md created during init (TC-07 through TC-11)
// ---------------------------------------------------------------------------

describe('installer: BACKLOG.md created during init', () => {
  let projectDir;

  before(() => {
    projectDir = setupProjectDir('backlog-init-test');
    runInit(projectDir);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  // TC-07: BACKLOG.md is created at project root (traces AC-01, FR-01)
  it('creates BACKLOG.md at project root', () => {
    assert.ok(existsSync(join(projectDir, 'BACKLOG.md')), 'BACKLOG.md should exist at project root');
  });

  // TC-08: BACKLOG.md is not empty (traces AC-01, AC-02, AC-03)
  it('creates BACKLOG.md with meaningful content', () => {
    const content = readFileSync(join(projectDir, 'BACKLOG.md'), 'utf-8');
    assert.ok(content.length > 50, 'BACKLOG.md should have meaningful content');
  });

  // TC-09: BACKLOG.md has no backlog items (traces NFR-01)
  it('creates BACKLOG.md with empty sections (no items)', () => {
    const content = readFileSync(join(projectDir, 'BACKLOG.md'), 'utf-8');
    const lines = content.split('\n');
    const itemLines = lines.filter(line => line.match(/^- /));
    assert.equal(itemLines.length, 0, 'BACKLOG.md should have no backlog items');
  });

  // TC-10: BACKLOG.md created alongside other install artifacts (traces NFR-02)
  it('creates BACKLOG.md alongside CLAUDE.md and state.json', () => {
    assert.ok(existsSync(join(projectDir, 'BACKLOG.md')), 'BACKLOG.md should exist');
    assert.ok(existsSync(join(projectDir, 'CLAUDE.md')), 'CLAUDE.md should exist');
    assert.ok(existsSync(join(projectDir, '.isdlc', 'state.json')), 'state.json should exist');
  });

  // TC-11: BACKLOG.md not tracked in installed-files.json (traces AC-10)
  it('does not track BACKLOG.md in installed-files.json manifest', () => {
    const manifest = JSON.parse(readFileSync(join(projectDir, '.isdlc', 'installed-files.json'), 'utf-8'));
    const backlogEntries = manifest.files.filter(f => f.includes('BACKLOG'));
    assert.equal(backlogEntries.length, 0, 'BACKLOG.md should NOT be in the install manifest');
  });
});

// ---------------------------------------------------------------------------
// REQ-0014: BACKLOG.md skip-if-exists guard (TC-12, TC-13)
// ---------------------------------------------------------------------------

describe('installer: BACKLOG.md skip-if-exists guard', () => {
  let projectDir;
  const customContent = '# My Custom Backlog\n\nUser data here.\n';

  before(() => {
    projectDir = setupProjectDir('backlog-exists-test');
    // Create pre-existing BACKLOG.md with custom content
    writeFileSync(join(projectDir, 'BACKLOG.md'), customContent, 'utf-8');
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  // TC-12: Existing BACKLOG.md is not overwritten (traces AC-06, FR-02)
  it('does not overwrite pre-existing BACKLOG.md', () => {
    runInit(projectDir);
    const after = readFileSync(join(projectDir, 'BACKLOG.md'), 'utf-8');
    assert.equal(after, customContent, 'BACKLOG.md should be preserved when it already exists');
  });

  // TC-13: Skip message is emitted when BACKLOG.md exists (traces AC-07)
  it('emits skip message when BACKLOG.md already exists', () => {
    const output = runInit(projectDir);
    assert.ok(
      output.includes('already exists') || output.includes('skipping'),
      'output should indicate BACKLOG.md creation was skipped'
    );
  });
});

// ---------------------------------------------------------------------------
// REQ-0014: BACKLOG.md dry-run guard (TC-14, TC-15)
// ---------------------------------------------------------------------------

describe('installer: BACKLOG.md dry-run guard', () => {
  let projectDir;

  before(() => {
    projectDir = setupProjectDir('backlog-dryrun-test');
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  // TC-14: Dry-run does not create BACKLOG.md (traces AC-08, FR-03)
  it('does not create BACKLOG.md in dry-run mode', () => {
    runInit(projectDir, '--dry-run');
    assert.ok(
      !existsSync(join(projectDir, 'BACKLOG.md')),
      'BACKLOG.md should NOT exist after dry-run'
    );
  });

  // TC-15: Dry-run still emits creation log message (traces AC-09)
  it('emits BACKLOG creation message even in dry-run mode', () => {
    const output = runInit(projectDir, '--dry-run');
    assert.ok(
      output.includes('BACKLOG') || output.includes('backlog'),
      'dry-run output should mention BACKLOG.md creation'
    );
  });
});

// ---------------------------------------------------------------------------
// REQ-0032: Issue Tracker Configuration section in CLAUDE.md
// ---------------------------------------------------------------------------

describe('installer: CLAUDE.md contains Issue Tracker Configuration section', () => {
  let projectDir;
  let content;

  before(() => {
    projectDir = setupProjectDir('tracker-section-test');
    runInit(projectDir);
    content = readFileSync(join(projectDir, 'CLAUDE.md'), 'utf-8');
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  // TC-IT-001: init --force creates CLAUDE.md with Issue Tracker Configuration section
  it('CLAUDE.md contains ## Issue Tracker Configuration section', () => {
    assert.ok(
      content.includes('## Issue Tracker Configuration'),
      'CLAUDE.md should contain ## Issue Tracker Configuration'
    );
  });

  // TC-IT-002: init --force defaults issueTrackerMode to manual
  it('CLAUDE.md contains **Tracker**: manual (--force default)', () => {
    assert.ok(
      content.includes('**Tracker**: manual'),
      'Tracker should default to manual in --force mode'
    );
  });

  // TC-IT-010: Template placeholders are interpolated (no {{...}} remain)
  it('no template placeholders remain in the Issue Tracker section', () => {
    assert.ok(
      !content.includes('{{ISSUE_TRACKER}}'),
      '{{ISSUE_TRACKER}} placeholder should be interpolated'
    );
    assert.ok(
      !content.includes('{{JIRA_PROJECT_KEY}}'),
      '{{JIRA_PROJECT_KEY}} placeholder should be interpolated'
    );
    assert.ok(
      !content.includes('{{GITHUB_REPO}}'),
      '{{GITHUB_REPO}} placeholder should be interpolated'
    );
  });

  // TC-IT-012: CLAUDE.md section is machine-readable with documented regex
  it('section is parseable with documented regex patterns', () => {
    const trackerMatch = content.match(/\*\*Tracker\*\*:\s*(\w+)/);
    assert.ok(trackerMatch, 'Tracker line should be parseable');
    assert.equal(trackerMatch[1], 'manual', 'parsed tracker should be manual');
  });
});

// ---------------------------------------------------------------------------
// REQ-0032: CLAUDE.md template has placeholders
// ---------------------------------------------------------------------------

describe('installer: CLAUDE.md.template contains Issue Tracker placeholders', () => {
  let projectDir;
  let templateContent;

  before(() => {
    projectDir = setupProjectDir('template-check-test');
    runInit(projectDir);
    templateContent = readFileSync(
      join(projectDir, '.claude', 'CLAUDE.md.template'),
      'utf-8'
    );
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  // TC-IT-009: template contains section and placeholders
  it('template contains ## Issue Tracker Configuration', () => {
    assert.ok(
      templateContent.includes('## Issue Tracker Configuration'),
      'template should contain the section header'
    );
  });

  it('template contains {{ISSUE_TRACKER}} placeholder', () => {
    assert.ok(
      templateContent.includes('{{ISSUE_TRACKER}}'),
      'template should contain {{ISSUE_TRACKER}}'
    );
  });

  it('template contains {{JIRA_PROJECT_KEY}} placeholder', () => {
    assert.ok(
      templateContent.includes('{{JIRA_PROJECT_KEY}}'),
      'template should contain {{JIRA_PROJECT_KEY}}'
    );
  });

  it('template contains {{GITHUB_REPO}} placeholder', () => {
    assert.ok(
      templateContent.includes('{{GITHUB_REPO}}'),
      'template should contain {{GITHUB_REPO}}'
    );
  });
});

// ---------------------------------------------------------------------------
// REQ-0032: GitHub remote auto-detection
// ---------------------------------------------------------------------------

describe('installer: GitHub remote auto-detection', () => {
  let projectDir;
  let content;

  before(() => {
    projectDir = setupProjectDir('github-remote-test');
    // Add a GitHub remote
    execSync('git remote add origin https://github.com/testuser/testproj.git', {
      cwd: projectDir,
      stdio: 'ignore',
    });
    runInit(projectDir);
    content = readFileSync(join(projectDir, 'CLAUDE.md'), 'utf-8');
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  // TC-IT-003: init --force with GitHub remote auto-detects repo
  it('auto-detects GitHub repository in CLAUDE.md', () => {
    assert.ok(
      content.includes('**GitHub Repository**: testuser/testproj'),
      'CLAUDE.md should contain the detected GitHub repo'
    );
  });
});

describe('installer: non-GitHub remote leaves repo empty', () => {
  let projectDir;
  let content;

  before(() => {
    projectDir = setupProjectDir('gitlab-remote-test');
    // Add a GitLab remote
    execSync('git remote add origin https://gitlab.com/testuser/testproj.git', {
      cwd: projectDir,
      stdio: 'ignore',
    });
    runInit(projectDir);
    content = readFileSync(join(projectDir, 'CLAUDE.md'), 'utf-8');
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  // TC-IT-004: init --force with non-GitHub remote leaves GitHub repo empty
  it('GitHub Repository field is empty for non-GitHub remotes', () => {
    // The line should have **GitHub Repository**: followed by nothing or whitespace
    const ghMatch = content.match(/\*\*GitHub Repository\*\*:\s*(\S*)/);
    // Should be empty or not match a repo pattern
    assert.ok(!ghMatch || !ghMatch[1] || !ghMatch[1].includes('testuser'),
      'GitHub Repository should be empty for non-GitHub remotes'
    );
  });
});

// ---------------------------------------------------------------------------
// REQ-0032: Existing CLAUDE.md not overwritten
// ---------------------------------------------------------------------------

describe('installer: existing CLAUDE.md not overwritten', () => {
  let projectDir;
  const customContent = '# My Custom CLAUDE.md\n\nUser data here.\n';

  before(() => {
    projectDir = setupProjectDir('claudemd-preserve-test');
    writeFileSync(join(projectDir, 'CLAUDE.md'), customContent, 'utf-8');
    runInit(projectDir);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  // TC-IT-011: Installer does not overwrite existing CLAUDE.md
  it('preserves existing CLAUDE.md content', () => {
    const after = readFileSync(join(projectDir, 'CLAUDE.md'), 'utf-8');
    assert.equal(after, customContent, 'CLAUDE.md should not be overwritten');
  });
});

// ---------------------------------------------------------------------------
// REQ-0032: Dry-run does not write Issue Tracker section
// ---------------------------------------------------------------------------

describe('installer: dry-run does not create CLAUDE.md with tracker section', () => {
  let projectDir;

  before(() => {
    projectDir = setupProjectDir('dryrun-tracker-test');
    runInit(projectDir, '--dry-run');
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  // TC-IT-031: init --dry-run does not write CLAUDE.md
  it('does not create CLAUDE.md in dry-run mode', () => {
    assert.ok(
      !existsSync(join(projectDir, 'CLAUDE.md')),
      'CLAUDE.md should NOT exist after dry-run'
    );
  });
});

// ---------------------------------------------------------------------------
// REQ-0032: Full integration test
// ---------------------------------------------------------------------------

describe('installer: full init --force produces valid installation with tracker defaults', () => {
  let projectDir;

  before(() => {
    projectDir = setupProjectDir('full-tracker-test');
    runInit(projectDir);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  // TC-IT-033: Full init --force produces valid installation with tracker defaults
  it('CLAUDE.md exists with Issue Tracker Configuration', () => {
    const content = readFileSync(join(projectDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(content.includes('## Issue Tracker Configuration'));
    assert.ok(content.includes('**Tracker**: manual'));
  });

  it('.isdlc/state.json exists', () => {
    assert.ok(existsSync(join(projectDir, '.isdlc', 'state.json')));
  });

  it('.claude/ directory exists', () => {
    assert.ok(existsSync(join(projectDir, '.claude')));
  });

  it('exit code is 0 (no error)', () => {
    // If we got here, the before() hook succeeded, meaning exit code was 0
    assert.ok(true);
  });
});

// ---------------------------------------------------------------------------
// REQ-0032: init --force output mentions issue tracker
// ---------------------------------------------------------------------------

describe('installer: init --force output mentions issue tracker', () => {
  let projectDir;
  let output;

  before(() => {
    projectDir = setupProjectDir('tracker-output-test');
    output = runInit(projectDir);
  });

  after(() => cleanupTempDir(join(projectDir, '..')));

  // TC-IT-032 (partial): Output references issue tracker
  it('output mentions issue tracker configuration', () => {
    assert.ok(
      output.includes('Issue tracker') || output.includes('issue tracker') || output.includes('manual'),
      'output should mention issue tracker configuration'
    );
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
