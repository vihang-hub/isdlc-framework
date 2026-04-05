/**
 * Tests for incrementalDiff orchestrator (T003, T010)
 * Traces: FR-004, FR-005, FR-006, AC-004-04, AC-004-07, AC-004-08, AC-005-01, AC-006-01, AC-006-02
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runIncremental } from '../../../lib/embedding/incremental/index.js';

describe('incrementalDiff orchestrator', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'embed-inc-'));
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  describe('error paths', () => {
    // AC-005-01: no prior .emb → NO_PRIOR_PACKAGE
    it('errors with NO_PRIOR_PACKAGE when no prior package exists', async () => {
      writeFileSync(join(tmpDir, 'a.js'), 'content');
      const result = await runIncremental({
        rootPath: tmpDir,
        priorPackagePath: join(tmpDir, 'missing.emb'),
        outputPath: join(tmpDir, 'new.emb')
      });
      assert.equal(result.ok, false);
      assert.equal(result.errorCode, 'NO_PRIOR_PACKAGE');
    });

    // AC-004-08: legacy .emb without file_hashes → LEGACY_PACKAGE_NO_HASHES
    it('errors with LEGACY_PACKAGE_NO_HASHES for legacy emb without file_hashes manifest', async () => {
      const result = await runIncremental({
        rootPath: tmpDir,
        priorPackagePath: join(tmpDir, 'legacy.emb'),
        outputPath: join(tmpDir, 'new.emb'),
        _mockPriorPackage: { manifest: { /* no file_hashes */ } }
      });
      assert.equal(result.ok, false);
      assert.equal(result.errorCode, 'LEGACY_PACKAGE_NO_HASHES');
    });

    // AC-006-01, AC-006-02: deletions → DELETIONS_DETECTED
    it('errors with DELETIONS_DETECTED when files removed from disk', async () => {
      const result = await runIncremental({
        rootPath: tmpDir,
        priorPackagePath: join(tmpDir, 'prior.emb'),
        outputPath: join(tmpDir, 'new.emb'),
        _mockPriorPackage: {
          manifest: { file_hashes: { 'deleted.js': 'h1', 'still-here.js': 'h2' } },
          vectors: [],
          metadata: []
        },
        _mockCurrentManifest: { 'still-here.js': 'h2' }
      });
      assert.equal(result.ok, false);
      assert.equal(result.errorCode, 'DELETIONS_DETECTED');
      assert.equal(result.deletedCount, 1);
    });
  });

  describe('happy path', () => {
    // AC-004-04: re-embeds changed+added, copies unchanged forward
    it('returns diff summary with changed/added/unchanged counts', async () => {
      const result = await runIncremental({
        rootPath: tmpDir,
        priorPackagePath: join(tmpDir, 'prior.emb'),
        outputPath: join(tmpDir, 'new.emb'),
        _mockPriorPackage: {
          manifest: { file_hashes: { 'a.js': 'h1', 'b.js': 'h2' } },
          vectors: [new Float32Array(4), new Float32Array(4)],
          metadata: [{ filePath: 'a.js' }, { filePath: 'b.js' }]
        },
        _mockCurrentManifest: { 'a.js': 'h1-CHANGED', 'b.js': 'h2', 'c.js': 'h3-NEW' },
        _mockEmbed: async (paths) => paths.map(() => new Float32Array(4))
      });
      assert.equal(result.ok, true);
      assert.deepEqual(result.summary.changed, ['a.js']);
      assert.deepEqual(result.summary.added, ['c.js']);
      assert.equal(result.summary.unchanged, 1);
    });

    it('skips rebuild when no changes detected', async () => {
      const result = await runIncremental({
        rootPath: tmpDir,
        priorPackagePath: join(tmpDir, 'prior.emb'),
        outputPath: join(tmpDir, 'new.emb'),
        _mockPriorPackage: {
          manifest: { file_hashes: { 'a.js': 'h1' } },
          vectors: [new Float32Array(4)],
          metadata: [{ filePath: 'a.js' }]
        },
        _mockCurrentManifest: { 'a.js': 'h1' }
      });
      assert.equal(result.ok, true);
      assert.equal(result.summary.changed.length, 0);
      assert.equal(result.summary.added.length, 0);
      assert.equal(result.summary.unchanged, 1);
    });
  });
});
