/**
 * Tests for FileHashManifest module (T002, T009)
 * Traces: FR-004, AC-004-01, AC-004-02, AC-004-03
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  computeManifest,
  diffManifests,
  computeFileHash
} from '../../../lib/embedding/incremental/file-hash.js';

describe('FileHashManifest', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'embed-hash-'));
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  describe('computeFileHash', () => {
    it('computes SHA-256 hex of file content', async () => {
      const filePath = join(tmpDir, 'a.txt');
      writeFileSync(filePath, 'hello world');
      const hash = await computeFileHash(filePath);
      assert.equal(hash, 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });

    it('returns null for missing file', async () => {
      const hash = await computeFileHash(join(tmpDir, 'nope.txt'));
      assert.equal(hash, null);
    });

    it('produces identical hashes for identical content', async () => {
      writeFileSync(join(tmpDir, 'x.txt'), 'same');
      writeFileSync(join(tmpDir, 'y.txt'), 'same');
      const h1 = await computeFileHash(join(tmpDir, 'x.txt'));
      const h2 = await computeFileHash(join(tmpDir, 'y.txt'));
      assert.equal(h1, h2);
    });
  });

  describe('computeManifest', () => {
    // AC-004-02: walks filesystem, computes SHA-256 per file
    it('computes manifest over flat directory', async () => {
      writeFileSync(join(tmpDir, 'a.js'), 'content-a');
      writeFileSync(join(tmpDir, 'b.js'), 'content-b');
      const manifest = await computeManifest(tmpDir);
      assert.ok(manifest['a.js']);
      assert.ok(manifest['b.js']);
      assert.equal(Object.keys(manifest).length, 2);
    });

    it('walks nested directories', async () => {
      mkdirSync(join(tmpDir, 'sub'));
      writeFileSync(join(tmpDir, 'top.js'), 'top');
      writeFileSync(join(tmpDir, 'sub', 'nested.js'), 'nested');
      const manifest = await computeManifest(tmpDir);
      assert.ok(manifest['top.js']);
      assert.ok(manifest['sub/nested.js']);
    });

    it('returns empty object for empty directory', async () => {
      const manifest = await computeManifest(tmpDir);
      assert.deepEqual(manifest, {});
    });

    it('returns empty object for non-existent directory', async () => {
      const manifest = await computeManifest(join(tmpDir, 'nope'));
      assert.deepEqual(manifest, {});
    });

    it('respects exclude patterns', async () => {
      writeFileSync(join(tmpDir, 'keep.js'), 'keep');
      mkdirSync(join(tmpDir, 'node_modules'));
      writeFileSync(join(tmpDir, 'node_modules', 'skip.js'), 'skip');
      const manifest = await computeManifest(tmpDir, { exclude: ['node_modules'] });
      assert.ok(manifest['keep.js']);
      assert.ok(!manifest['node_modules/skip.js']);
    });
  });

  describe('diffManifests', () => {
    // AC-004-03: diff produces changed, added, deleted sets
    it('identifies changed files', () => {
      const prior = { 'a.js': 'hash1', 'b.js': 'hash2' };
      const current = { 'a.js': 'hash1-NEW', 'b.js': 'hash2' };
      const diff = diffManifests(prior, current);
      assert.deepEqual(diff.changed, ['a.js']);
      assert.deepEqual(diff.added, []);
      assert.deepEqual(diff.deleted, []);
    });

    it('identifies added files', () => {
      const prior = { 'a.js': 'hash1' };
      const current = { 'a.js': 'hash1', 'b.js': 'hash2' };
      const diff = diffManifests(prior, current);
      assert.deepEqual(diff.changed, []);
      assert.deepEqual(diff.added, ['b.js']);
      assert.deepEqual(diff.deleted, []);
    });

    it('identifies deleted files', () => {
      const prior = { 'a.js': 'hash1', 'b.js': 'hash2' };
      const current = { 'a.js': 'hash1' };
      const diff = diffManifests(prior, current);
      assert.deepEqual(diff.changed, []);
      assert.deepEqual(diff.added, []);
      assert.deepEqual(diff.deleted, ['b.js']);
    });

    it('identifies all three categories simultaneously', () => {
      const prior = { 'a.js': 'h1', 'b.js': 'h2', 'c.js': 'h3' };
      const current = { 'a.js': 'h1', 'b.js': 'h2-new', 'd.js': 'h4' };
      const diff = diffManifests(prior, current);
      assert.deepEqual(diff.changed.sort(), ['b.js']);
      assert.deepEqual(diff.added.sort(), ['d.js']);
      assert.deepEqual(diff.deleted.sort(), ['c.js']);
    });

    it('returns empty sets for identical manifests', () => {
      const m = { 'a.js': 'h1', 'b.js': 'h2' };
      const diff = diffManifests(m, { ...m });
      assert.deepEqual(diff.changed, []);
      assert.deepEqual(diff.added, []);
      assert.deepEqual(diff.deleted, []);
    });

    it('handles null/undefined inputs gracefully', () => {
      const diff = diffManifests(null, { 'a.js': 'h' });
      assert.deepEqual(diff.changed, []);
      assert.deepEqual(diff.added, ['a.js']);
      assert.deepEqual(diff.deleted, []);
    });
  });
});
