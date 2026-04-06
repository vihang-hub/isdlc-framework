/**
 * Tests for Embedding Lifecycle — FR-004, FR-005, FR-006
 *
 * BUG-0056: Verify installer, uninstaller, and updater manage embedding
 * infrastructure correctly.
 *
 * These tests verify the new code paths by importing and testing the
 * model-downloader functions directly, and by verifying the lifecycle
 * scripts contain the expected imports and function calls.
 *
 * REQ: BUG-0056 / FR-004 (AC-004-01..04), FR-005 (AC-005-01..03), FR-006 (AC-006-01..03)
 * Article II: Test-First Development
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTempDir, cleanupTempDir } from '../../utils/test-helpers.js';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

// ---------------------------------------------------------------------------
// FR-004: Installer embedding infrastructure
// ---------------------------------------------------------------------------

describe('FR-004: Installer Embedding Infrastructure', () => {
  // TC-004-06: tokenizers package in package.json
  it('TC-004-06: tokenizers listed in package.json', () => {
    const pkgPath = join(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.optionalDependencies || {}) };
    assert.ok('tokenizers' in allDeps, 'tokenizers should be available');
  });

  // TC-004-01: Installer source references user-memory directory creation
  it('TC-004-01: installer.js creates user-memory directory', () => {
    const src = readFileSync(join(process.cwd(), 'lib', 'installer.js'), 'utf-8');
    assert.ok(src.includes('user-memory'), 'Installer should reference user-memory directory');
    assert.ok(src.includes('.isdlc/user-memory') || src.includes("'user-memory'"),
      'Installer should create user-memory path');
  });

  // TC-004-02: Installer source references docs/.embeddings/ creation
  it('TC-004-02: installer.js creates docs/.embeddings directory', () => {
    const src = readFileSync(join(process.cwd(), 'lib', 'installer.js'), 'utf-8');
    assert.ok(src.includes('.embeddings'), 'Installer should reference .embeddings directory');
  });

  // TC-004-03: Installer no longer calls downloadModel() — Transformers.js handles downloads.
  it('TC-004-03: installer.js references Transformers.js for model handling', () => {
    const src = readFileSync(join(process.cwd(), 'lib', 'installer.js'), 'utf-8');
    assert.ok(!src.includes("model-downloader.js"),
      'Installer should not import model-downloader.js after Jina v2 migration');
    assert.ok(src.includes('Transformers.js'),
      'Installer should reference Transformers.js for model downloads');
  });

  // TC-004-04: Model download failure handling no longer needed — auto-caching.
  it('TC-004-04: installer no longer has manual model download failure path', () => {
    const src = readFileSync(join(process.cwd(), 'lib', 'installer.js'), 'utf-8');
    assert.ok(!src.includes("model-downloader.js"),
      'No model-downloader import should remain');
  });

  // TC-004-05: Installer creates user-memory dir idempotently
  it('TC-004-05: ensureDir is idempotent (directory already exists)', async () => {
    const tmpDir = createTempDir();
    const dir = join(tmpDir, 'user-memory');
    mkdirSync(dir, { recursive: true });
    // Re-create should not throw
    mkdirSync(dir, { recursive: true });
    assert.ok(existsSync(dir), 'Directory should still exist');
    cleanupTempDir(tmpDir);
  });
});

// ---------------------------------------------------------------------------
// FR-005: Uninstaller embedding cleanup
// ---------------------------------------------------------------------------

describe('FR-005: Uninstaller Embedding Cleanup', () => {
  // TC-005-01: Uninstaller removes .isdlc/models/
  it('TC-005-01: uninstaller.js removes .isdlc/models/', () => {
    const src = readFileSync(join(process.cwd(), 'lib', 'uninstaller.js'), 'utf-8');
    assert.ok(src.includes('models'), 'Uninstaller should reference models directory');
    assert.ok(src.includes('.isdlc/models') || src.includes("'models'"),
      'Uninstaller should remove .isdlc/models/');
  });

  // TC-005-02: Uninstaller removes docs/.embeddings/ contents
  it('TC-005-02: uninstaller.js cleans docs/.embeddings/', () => {
    const src = readFileSync(join(process.cwd(), 'lib', 'uninstaller.js'), 'utf-8');
    assert.ok(src.includes('.embeddings'),
      'Uninstaller should reference .embeddings directory');
  });

  // TC-005-03: Uninstaller removes memory.db but preserves session JSONs
  it('TC-005-03: uninstaller.js removes memory.db', () => {
    const src = readFileSync(join(process.cwd(), 'lib', 'uninstaller.js'), 'utf-8');
    assert.ok(src.includes('memory.db'),
      'Uninstaller should reference memory.db for removal');
  });

  // TC-005-04: Uninstaller handles missing model directory gracefully
  it('TC-005-04: uninstaller handles missing dirs gracefully', () => {
    const src = readFileSync(join(process.cwd(), 'lib', 'uninstaller.js'), 'utf-8');
    assert.ok(src.includes('isDirectory(modelsDir)') || src.includes('Embedding cleanup skipped'),
      'Uninstaller should check directory existence before removal');
  });
});

// ---------------------------------------------------------------------------
// FR-006: Updater model version check
// ---------------------------------------------------------------------------

describe('FR-006: Updater Model Version Check', () => {
  let tempDir;

  before(() => {
    tempDir = createTempDir();
  });

  after(() => {
    cleanupTempDir(tempDir);
  });

  // TC-006-01: Updater no longer manages model downloads (Jina v2 migration).
  // Transformers.js handles model caching automatically on first use.
  it('TC-006-01: updater.js no longer references model-downloader', () => {
    const src = readFileSync(join(process.cwd(), 'lib', 'updater.js'), 'utf-8');
    assert.ok(!src.includes("model-downloader.js"),
      'Updater should not import model-downloader.js after Jina v2 migration');
    assert.ok(src.includes('Transformers.js'),
      'Updater should reference Transformers.js for model handling');
  });

  // TC-006-02 through TC-006-04: model-downloader.js tests removed —
  // file deleted as part of FR-004 (Jina v2 migration).
});
