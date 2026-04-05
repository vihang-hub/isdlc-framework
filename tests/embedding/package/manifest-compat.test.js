/**
 * Tests for .emb manifest backward compatibility (T006, T011, T012)
 * Traces: FR-007, NFR-004, AC-007-01, AC-007-02, AC-007-03, AC-007-04, AC-007-05
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest, createManifestWithHnsw } from '../../../lib/embedding/package/manifest.js';

describe('.emb manifest backward compatibility', () => {
  const baseManifest = {
    moduleId: 'test-module',
    version: '1.0.0',
    model: 'test-model',
    dimensions: 128,
    chunkCount: 10,
    tier: 'full',
    createdAt: new Date().toISOString(),
    checksums: { index: 'idx-hash', metadata: 'meta-hash' }
  };

  describe('new HNSW fields (AC-007-01 through AC-007-04)', () => {
    it('accepts manifest with hnsw_index_present: true', () => {
      const manifest = { ...baseManifest, hnsw_index_present: true };
      const result = validateManifest(manifest);
      assert.equal(result.valid, true);
    });

    it('accepts manifest with file_hashes map', () => {
      const manifest = {
        ...baseManifest,
        file_hashes: { 'a.js': 'abc123', 'b.js': 'def456' }
      };
      const result = validateManifest(manifest);
      assert.equal(result.valid, true);
    });

    it('accepts manifest with hnsw_params object', () => {
      const manifest = {
        ...baseManifest,
        hnsw_params: { M: 16, efConstruction: 200, efSearch: 50 }
      };
      const result = validateManifest(manifest);
      assert.equal(result.valid, true);
    });

    it('accepts manifest with hash_algorithm: sha256', () => {
      const manifest = { ...baseManifest, hash_algorithm: 'sha256' };
      const result = validateManifest(manifest);
      assert.equal(result.valid, true);
    });

    it('creates complete manifest with all HNSW fields via helper', () => {
      const manifest = createManifestWithHnsw(baseManifest, {
        fileHashes: { 'a.js': 'h1' },
        hnswParams: { M: 16, efConstruction: 200, efSearch: 50 }
      });
      assert.equal(manifest.hnsw_index_present, true);
      assert.deepEqual(manifest.hnsw_params, { M: 16, efConstruction: 200, efSearch: 50 });
      assert.equal(manifest.hash_algorithm, 'sha256');
      assert.deepEqual(manifest.file_hashes, { 'a.js': 'h1' });
    });
  });

  describe('legacy manifest load (AC-007-05)', () => {
    it('validates legacy manifest without new HNSW fields', () => {
      const legacy = { ...baseManifest };
      const result = validateManifest(legacy);
      assert.equal(result.valid, true);
    });

    it('treats absent hnsw_index_present as false', () => {
      const legacy = { ...baseManifest };
      assert.ok(!legacy.hnsw_index_present);
    });

    it('treats absent file_hashes as no manifest for incremental diff', () => {
      const legacy = { ...baseManifest };
      assert.equal(legacy.file_hashes, undefined);
    });
  });
});
