/**
 * Unit tests for src/core/state/index.js — Minimal StateStore
 *
 * Tests: readState, writeState, getProjectRoot
 * Requirements: FR-001 (AC-001-01), FR-003 (AC-003-01, AC-003-02)
 *
 * Uses REAL temp filesystem for isolation (no mocks).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { readState, writeState, getProjectRoot } from '../../../src/core/state/index.js';

// ---------------------------------------------------------------------------
// Helper: create isolated temp project with .isdlc/state.json
// ---------------------------------------------------------------------------
function createTempProject(stateContent = null) {
  const base = mkdtempSync(join(tmpdir(), 'isdlc-core-'));
  const isdlcDir = join(base, '.isdlc');
  mkdirSync(isdlcDir, { recursive: true });
  if (stateContent !== null) {
    writeFileSync(join(isdlcDir, 'state.json'), JSON.stringify(stateContent, null, 2), 'utf-8');
  }
  return base;
}

function cleanupTemp(dir) {
  if (dir && existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// readState
// ---------------------------------------------------------------------------

describe('readState()', () => {
  let projectRoot;

  after(() => cleanupTemp(projectRoot));

  // ST-01: readState returns parsed JSON from .isdlc/state.json
  it('ST-01: returns parsed JSON from .isdlc/state.json', async () => {
    const state = { project_name: 'test', current_phase: '01' };
    projectRoot = createTempProject(state);

    const result = await readState(projectRoot);
    assert.deepStrictEqual(result, state);
  });

  // ST-02: readState throws on missing .isdlc/state.json
  it('ST-02: throws on missing .isdlc/state.json', async () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'isdlc-core-'));

    await assert.rejects(
      () => readState(emptyDir),
      (err) => {
        assert.ok(err.message.includes('state.json') || err.code === 'ENOENT',
          `Expected error about missing state.json, got: ${err.message}`);
        return true;
      }
    );

    cleanupTemp(emptyDir);
  });

  // ST-03: readState throws on invalid JSON content
  it('ST-03: throws on invalid JSON content', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'isdlc-core-'));
    const isdlcDir = join(dir, '.isdlc');
    mkdirSync(isdlcDir, { recursive: true });
    writeFileSync(join(isdlcDir, 'state.json'), '{ invalid json !!!', 'utf-8');

    await assert.rejects(
      () => readState(dir),
      (err) => {
        assert.ok(err instanceof SyntaxError || err.message.includes('JSON'),
          `Expected JSON parse error, got: ${err.message}`);
        return true;
      }
    );

    cleanupTemp(dir);
  });
});

// ---------------------------------------------------------------------------
// writeState
// ---------------------------------------------------------------------------

describe('writeState()', () => {
  let projectRoot;

  after(() => cleanupTemp(projectRoot));

  // ST-04: writeState serializes object to .isdlc/state.json
  it('ST-04: serializes object to .isdlc/state.json', async () => {
    projectRoot = createTempProject({});
    const state = { project_name: 'spike', phases: { '06': { status: 'active' } } };

    await writeState(projectRoot, state);

    const raw = readFileSync(join(projectRoot, '.isdlc', 'state.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    assert.deepStrictEqual(parsed, state);
  });

  // ST-05: writeState is atomic — uses temp file + rename
  it('ST-05: atomic write uses temp file + rename pattern', async () => {
    const dir = createTempProject({});
    const state = { test: 'atomic' };

    // Write should succeed without leaving temp files
    await writeState(dir, state);

    // Verify the file exists and is valid
    const result = await readState(dir);
    assert.deepStrictEqual(result, state);

    // Verify no temp files remain in .isdlc/
    const { readdirSync } = await import('node:fs');
    const files = readdirSync(join(dir, '.isdlc'));
    const tempFiles = files.filter(f => f.startsWith('.state-') || f.endsWith('.tmp'));
    assert.equal(tempFiles.length, 0, `Temp files should not remain: ${tempFiles}`);

    cleanupTemp(dir);
  });

  // ST-06: writeState does not leave partial file on error
  it('ST-06: does not leave partial file on serialization error', async () => {
    const dir = createTempProject({ original: true });

    // Create a circular reference that JSON.stringify cannot handle
    const circular = {};
    circular.self = circular;

    await assert.rejects(
      () => writeState(dir, circular),
      (err) => {
        assert.ok(err instanceof TypeError || err.message.includes('circular'),
          `Expected circular reference error, got: ${err.message}`);
        return true;
      }
    );

    // Original state.json should still be intact
    const result = await readState(dir);
    assert.deepStrictEqual(result, { original: true });

    cleanupTemp(dir);
  });

  // ST-07: writeState round-trips through readState without data loss
  it('ST-07: round-trips through readState without data loss', async () => {
    const dir = createTempProject({});

    const complex = {
      project_name: 'roundtrip-test',
      phases: {
        '06-implementation': {
          status: 'active',
          iterations: { current: 3, max: 10, history: [] }
        }
      },
      verdicts: [
        { file: 'src/a.js', cycle: 1, verdict: 'PASS' },
        { file: 'src/b.js', cycle: 2, verdict: 'REVISE' }
      ],
      unicode: 'Test with \u00e9m\u00f6ji and sp\u00e9cial chars'
    };

    await writeState(dir, complex);
    const result = await readState(dir);
    assert.deepStrictEqual(result, complex);

    cleanupTemp(dir);
  });

  // ST-11: writeState creates .isdlc/ directory if missing
  it('ST-11: creates .isdlc/ directory if missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'isdlc-core-'));
    // No .isdlc/ directory exists

    const state = { created: true };
    await writeState(dir, state);

    assert.ok(existsSync(join(dir, '.isdlc', 'state.json')), '.isdlc/state.json should exist');
    const result = await readState(dir);
    assert.deepStrictEqual(result, state);

    cleanupTemp(dir);
  });
});

// ---------------------------------------------------------------------------
// getProjectRoot
// ---------------------------------------------------------------------------

describe('getProjectRoot()', () => {
  let projectRoot;

  after(() => cleanupTemp(projectRoot));

  // ST-08: getProjectRoot finds .isdlc/ in CWD
  it('ST-08: finds .isdlc/ in CWD', () => {
    projectRoot = createTempProject({ test: true });

    const result = getProjectRoot(projectRoot);
    assert.equal(result, projectRoot);
  });

  // ST-09: getProjectRoot walks up parent directories
  it('ST-09: walks up parent directories to find .isdlc/', () => {
    const root = createTempProject({ test: true });
    const nested = join(root, 'src', 'deep', 'nested');
    mkdirSync(nested, { recursive: true });

    const result = getProjectRoot(nested);
    assert.equal(result, root);

    cleanupTemp(root);
  });

  // ST-10: getProjectRoot throws when no .isdlc/ found
  it('ST-10: throws when no .isdlc/ found', () => {
    const dir = mkdtempSync(join(tmpdir(), 'isdlc-no-root-'));

    assert.throws(
      () => getProjectRoot(dir),
      (err) => {
        assert.ok(err.message.includes('.isdlc') || err.message.includes('project root'),
          `Expected error about missing .isdlc, got: ${err.message}`);
        return true;
      }
    );

    cleanupTemp(dir);
  });
});
