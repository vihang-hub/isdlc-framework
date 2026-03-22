/**
 * Tests for src/providers/codex/installer.js
 * REQ-0115: Codex Installation and Doctor Paths
 *
 * Tests installCodex, updateCodex, uninstallCodex, doctorCodex.
 * Uses temp directories for filesystem isolation.
 *
 * Test ID prefix: INS-
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync, writeFileSync, existsSync, readFileSync,
  readdirSync, rmSync
} from 'node:fs';
import { join } from 'node:path';
import { createTempDir, cleanupTempDir } from '../../../lib/utils/test-helpers.js';

import {
  installCodex,
  updateCodex,
  uninstallCodex,
  doctorCodex
} from '../../../src/providers/codex/installer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal project directory for testing.
 */
function scaffoldProject(tempDir) {
  const projectDir = join(tempDir, 'test-project');
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(
    join(projectDir, 'package.json'),
    JSON.stringify({ name: 'test-project', version: '1.0.0' }, null, 2),
    'utf-8'
  );
  // Simulate .isdlc already existing (core installed)
  const isdlcDir = join(projectDir, '.isdlc');
  mkdirSync(isdlcDir, { recursive: true });
  writeFileSync(
    join(isdlcDir, 'state.json'),
    JSON.stringify({
      framework_version: '0.1.0-alpha',
      project: { name: 'test-project' },
      phases: {},
      current_phase: '01-requirements',
    }, null, 2),
    'utf-8'
  );
  return projectDir;
}

// ---------------------------------------------------------------------------
// installCodex
// ---------------------------------------------------------------------------

describe('installCodex (REQ-0115 FR-001)', () => {
  let tempDir;
  let projectDir;

  beforeEach(() => {
    tempDir = createTempDir();
    projectDir = scaffoldProject(tempDir);
  });

  afterEach(() => cleanupTempDir(tempDir));

  // INS-01: Creates .codex/ directory
  it('INS-01: creates .codex/ directory (AC-001-01)', async () => {
    await installCodex(projectDir);
    assert.ok(existsSync(join(projectDir, '.codex')), '.codex/ should exist');
  });

  // INS-02: Creates config.json
  it('INS-02: creates config.json in .codex/ (AC-001-02)', async () => {
    await installCodex(projectDir);
    const configPath = join(projectDir, '.codex', 'config.json');
    assert.ok(existsSync(configPath), 'config.json should exist');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    assert.strictEqual(config.provider, 'codex');
  });

  // INS-03: Generates instruction files
  it('INS-03: generates instruction files at projection paths (AC-001-03)', async () => {
    await installCodex(projectDir);
    const codexDir = join(projectDir, '.codex');
    assert.ok(existsSync(join(codexDir, 'AGENTS.md')), 'AGENTS.md should exist');
  });

  // INS-04: Returns correct shape
  it('INS-04: returns { success, filesCreated, errors } (AC-001-04)', async () => {
    const result = await installCodex(projectDir);
    assert.ok('success' in result, 'should have success field');
    assert.ok('filesCreated' in result, 'should have filesCreated field');
    assert.ok('errors' in result, 'should have errors field');
    assert.ok(Array.isArray(result.filesCreated), 'filesCreated should be array');
    assert.ok(Array.isArray(result.errors), 'errors should be array');
  });

  // INS-05: success=true on clean install
  it('INS-05: success is true on clean install (AC-001-04)', async () => {
    const result = await installCodex(projectDir);
    assert.strictEqual(result.success, true);
    assert.ok(result.filesCreated.length > 0, 'Should have created files');
    assert.strictEqual(result.errors.length, 0, 'Should have no errors');
  });

  // INS-05b: Idempotent — running install twice succeeds
  it('INS-05b: install is idempotent (second install succeeds)', async () => {
    await installCodex(projectDir);
    const result = await installCodex(projectDir);
    assert.strictEqual(result.success, true);
  });
});

// ---------------------------------------------------------------------------
// updateCodex
// ---------------------------------------------------------------------------

describe('updateCodex (REQ-0115 FR-002)', () => {
  let tempDir;
  let projectDir;

  beforeEach(async () => {
    tempDir = createTempDir();
    projectDir = scaffoldProject(tempDir);
    await installCodex(projectDir);
  });

  afterEach(() => cleanupTempDir(tempDir));

  // INS-06: Regenerates instruction files
  it('INS-06: regenerates instruction files (AC-002-01)', async () => {
    const result = await updateCodex(projectDir);
    assert.strictEqual(result.success, true);
    assert.ok(result.filesUpdated.length > 0, 'Should have updated files');
  });

  // INS-07: Skips user-modified files
  it('INS-07: skips files modified by the user (AC-002-02)', async () => {
    // Modify an instruction file
    const agentsPath = join(projectDir, '.codex', 'AGENTS.md');
    writeFileSync(agentsPath, '# Custom user content\n\nUser modified this file.', 'utf-8');

    const result = await updateCodex(projectDir);
    assert.strictEqual(result.success, true);
    assert.ok(result.filesSkipped.length > 0, 'Should have skipped modified files');

    // Verify user content preserved
    const content = readFileSync(agentsPath, 'utf-8');
    assert.ok(content.includes('Custom user content'), 'User content should be preserved');
  });

  // INS-08: Returns correct shape
  it('INS-08: returns { success, filesUpdated, filesSkipped, errors } (AC-002-03)', async () => {
    const result = await updateCodex(projectDir);
    assert.ok('success' in result, 'should have success');
    assert.ok('filesUpdated' in result, 'should have filesUpdated');
    assert.ok('filesSkipped' in result, 'should have filesSkipped');
    assert.ok('errors' in result, 'should have errors');
    assert.ok(Array.isArray(result.filesUpdated), 'filesUpdated should be array');
    assert.ok(Array.isArray(result.filesSkipped), 'filesSkipped should be array');
    assert.ok(Array.isArray(result.errors), 'errors should be array');
  });
});

// ---------------------------------------------------------------------------
// uninstallCodex
// ---------------------------------------------------------------------------

describe('uninstallCodex (REQ-0115 FR-003)', () => {
  let tempDir;
  let projectDir;

  beforeEach(async () => {
    tempDir = createTempDir();
    projectDir = scaffoldProject(tempDir);
    await installCodex(projectDir);
  });

  afterEach(() => cleanupTempDir(tempDir));

  // INS-09: Removes generated files
  it('INS-09: removes generated files (AC-003-01)', async () => {
    const result = await uninstallCodex(projectDir);
    assert.strictEqual(result.success, true);
    assert.ok(result.filesRemoved.length > 0, 'Should have removed files');
  });

  // INS-10: Preserves user-created content
  it('INS-10: preserves user-modified content (AC-003-02)', async () => {
    // Modify a generated file to simulate user edits
    const agentsPath = join(projectDir, '.codex', 'AGENTS.md');
    writeFileSync(agentsPath, '# My custom agents\n\nDo not delete!', 'utf-8');

    const result = await uninstallCodex(projectDir);
    assert.ok(result.filesPreserved.length > 0, 'Should preserve user-modified files');
    assert.ok(existsSync(agentsPath), 'User-modified file should still exist');
  });

  // INS-11: Returns correct shape
  it('INS-11: returns { success, filesRemoved, filesPreserved, errors } (AC-003-03)', async () => {
    const result = await uninstallCodex(projectDir);
    assert.ok('success' in result, 'should have success');
    assert.ok('filesRemoved' in result, 'should have filesRemoved');
    assert.ok('filesPreserved' in result, 'should have filesPreserved');
    assert.ok('errors' in result, 'should have errors');
    assert.ok(Array.isArray(result.filesRemoved));
    assert.ok(Array.isArray(result.filesPreserved));
    assert.ok(Array.isArray(result.errors));
  });

  // INS-11b: Removes .codex/ directory when empty
  it('INS-11b: removes .codex/ directory if nothing preserved', async () => {
    const result = await uninstallCodex(projectDir);
    if (result.filesPreserved.length === 0) {
      assert.ok(!existsSync(join(projectDir, '.codex')), '.codex/ should be removed when empty');
    }
  });
});

// ---------------------------------------------------------------------------
// doctorCodex
// ---------------------------------------------------------------------------

describe('doctorCodex (REQ-0115 FR-004)', () => {
  let tempDir;
  let projectDir;

  beforeEach(() => {
    tempDir = createTempDir();
    projectDir = scaffoldProject(tempDir);
  });

  afterEach(() => cleanupTempDir(tempDir));

  // INS-12: Validates installation
  it('INS-12: returns healthy for valid installation (AC-004-01)', async () => {
    await installCodex(projectDir);
    const result = await doctorCodex(projectDir);
    assert.strictEqual(result.healthy, true);
  });

  // INS-13: Checks files, config, loadability
  it('INS-13: checks include instruction files, config, team specs (AC-004-02)', async () => {
    await installCodex(projectDir);
    const result = await doctorCodex(projectDir);
    assert.ok(result.checks.length >= 3, 'Should have at least 3 checks');
    const checkNames = result.checks.map(c => c.name);
    assert.ok(checkNames.some(n => n.includes('directory') || n.includes('dir')),
      'Should check instruction directory');
    assert.ok(checkNames.some(n => n.includes('config')),
      'Should check config');
  });

  // INS-14: Returns { healthy, checks }
  it('INS-14: returns { healthy, checks } (AC-004-03)', async () => {
    await installCodex(projectDir);
    const result = await doctorCodex(projectDir);
    assert.ok('healthy' in result, 'should have healthy');
    assert.ok('checks' in result, 'should have checks');
    assert.ok(Array.isArray(result.checks), 'checks should be array');
    for (const check of result.checks) {
      assert.ok('name' in check, 'check should have name');
      assert.ok('passed' in check, 'check should have passed');
      assert.ok('message' in check, 'check should have message');
    }
  });

  // INS-15: Reports unhealthy when .codex/ missing
  it('INS-15: reports unhealthy when .codex/ missing (AC-004-01)', async () => {
    const result = await doctorCodex(projectDir);
    assert.strictEqual(result.healthy, false);
    const failedCheck = result.checks.find(c => !c.passed);
    assert.ok(failedCheck, 'Should have at least one failed check');
  });

  // INS-15b: Reports unhealthy when config.json missing
  it('INS-15b: reports unhealthy when config.json is missing', async () => {
    await installCodex(projectDir);
    rmSync(join(projectDir, '.codex', 'config.json'));
    const result = await doctorCodex(projectDir);
    assert.strictEqual(result.healthy, false);
  });

  // INS-15c: Reports unhealthy when config.json is invalid JSON
  it('INS-15c: reports unhealthy when config.json is invalid JSON', async () => {
    await installCodex(projectDir);
    writeFileSync(join(projectDir, '.codex', 'config.json'), 'NOT JSON', 'utf-8');
    const result = await doctorCodex(projectDir);
    assert.strictEqual(result.healthy, false);
  });
});

// ---------------------------------------------------------------------------
// FR-005: API Parity (contract test)
// ---------------------------------------------------------------------------

describe('API parity with Claude installer (REQ-0115 FR-005)', () => {
  let tempDir;
  let projectDir;

  beforeEach(() => {
    tempDir = createTempDir();
    projectDir = scaffoldProject(tempDir);
  });

  afterEach(() => cleanupTempDir(tempDir));

  // INS-16: Same API shape as Claude (both are async, accept projectRoot + options)
  it('INS-16: all 4 functions accept (projectRoot, options) and return promises (AC-005-01)', async () => {
    // installCodex returns Promise
    const installResult = installCodex(projectDir, {});
    assert.ok(installResult instanceof Promise || typeof installResult.then === 'function');
    await installResult;

    // updateCodex returns Promise
    const updateResult = updateCodex(projectDir, {});
    assert.ok(updateResult instanceof Promise || typeof updateResult.then === 'function');
    await updateResult;

    // uninstallCodex returns Promise
    const uninstallResult = uninstallCodex(projectDir, {});
    assert.ok(uninstallResult instanceof Promise || typeof uninstallResult.then === 'function');
    await uninstallResult;

    // doctorCodex returns Promise (accepts only projectRoot)
    await installCodex(projectDir);
    const doctorResult = doctorCodex(projectDir);
    assert.ok(doctorResult instanceof Promise || typeof doctorResult.then === 'function');
    await doctorResult;
  });
});
