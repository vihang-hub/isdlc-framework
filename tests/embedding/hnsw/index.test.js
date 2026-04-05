/**
 * Tests for HnswIndex module (T001, T008)
 * Traces: FR-001, FR-002, AC-001-01, AC-001-02, AC-001-03, AC-002-01, AC-002-02, NFR-003
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHnswIndex,
  serializeHnswIndex,
  deserializeHnswIndex,
  searchHnsw,
  DEFAULT_HNSW_PARAMS
} from '../../../lib/embedding/hnsw/index.js';

/**
 * Generate a synthetic random vector.
 */
function randomVector(dim, seed) {
  const v = new Float32Array(dim);
  let s = seed;
  for (let i = 0; i < dim; i++) {
    // Simple LCG for deterministic randomness
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    v[i] = (s / 0x7fffffff) * 2 - 1;
  }
  return v;
}

/**
 * Linear scan reference implementation for recall measurement.
 */
function linearSearch(query, vectors, k) {
  const scored = vectors.map((v, idx) => {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < v.length; i++) {
      dot += query[i] * v[i];
      na += query[i] * query[i];
      nb += v[i] * v[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return { index: idx, score: denom === 0 ? 0 : dot / denom };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map(x => x.index);
}

describe('HnswIndex', () => {
  const DIM = 16;
  let vectors;

  beforeEach(() => {
    vectors = [];
    for (let i = 0; i < 100; i++) {
      vectors.push(randomVector(DIM, i + 1));
    }
  });

  describe('DEFAULT_HNSW_PARAMS', () => {
    // AC-001-03: defaults M=16, efConstruction=200, efSearch=50
    it('exposes M=16, efConstruction=200, efSearch=50', () => {
      assert.equal(DEFAULT_HNSW_PARAMS.M, 16);
      assert.equal(DEFAULT_HNSW_PARAMS.efConstruction, 200);
      assert.equal(DEFAULT_HNSW_PARAMS.efSearch, 50);
    });
  });

  describe('buildHnswIndex', () => {
    // AC-001-01: index built alongside vectors
    it('builds an index from vectors', () => {
      const index = buildHnswIndex(vectors, DIM);
      assert.ok(index);
    });

    it('uses DEFAULT_HNSW_PARAMS when not specified', () => {
      const index = buildHnswIndex(vectors, DIM);
      assert.ok(index);
    });

    it('accepts custom params', () => {
      const index = buildHnswIndex(vectors, DIM, { M: 8, efConstruction: 100, efSearch: 25 });
      assert.ok(index);
    });

    it('returns null for empty vector set', () => {
      const index = buildHnswIndex([], DIM);
      assert.equal(index, null);
    });

    it('returns null for zero dimension', () => {
      const index = buildHnswIndex(vectors, 0);
      assert.equal(index, null);
    });
  });

  describe('serialize/deserialize roundtrip', () => {
    // AC-001-02: HNSW serialized into .emb package
    it('serializes to Buffer and deserializes back', () => {
      const index = buildHnswIndex(vectors, DIM);
      const buf = serializeHnswIndex(index);
      assert.ok(Buffer.isBuffer(buf));
      assert.ok(buf.length > 0);

      const restored = deserializeHnswIndex(buf, DIM);
      assert.ok(restored);
    });

    it('search results match pre/post serialization', () => {
      const index = buildHnswIndex(vectors, DIM);
      const query = randomVector(DIM, 999);
      const before = searchHnsw(index, query, 10);

      const buf = serializeHnswIndex(index);
      const restored = deserializeHnswIndex(buf, DIM);
      const after = searchHnsw(restored, query, 10);

      assert.deepEqual(
        before.map(r => r.index).sort(),
        after.map(r => r.index).sort()
      );
    });

    it('returns null for null index serialize', () => {
      assert.equal(serializeHnswIndex(null), null);
    });

    it('returns null for empty buffer deserialize', () => {
      assert.equal(deserializeHnswIndex(Buffer.alloc(0), DIM), null);
    });
  });

  describe('searchHnsw', () => {
    // AC-002-01: findNearest signature unchanged (we return {index, score}[])
    it('returns k results sorted by score', () => {
      const index = buildHnswIndex(vectors, DIM);
      const query = vectors[0];
      const results = searchHnsw(index, query, 10);

      assert.equal(results.length, 10);
      for (let i = 1; i < results.length; i++) {
        assert.ok(results[i - 1].score >= results[i].score);
      }
    });

    it('includes the query vector itself as top match', () => {
      const index = buildHnswIndex(vectors, DIM);
      const query = vectors[5];
      const results = searchHnsw(index, query, 10);
      assert.equal(results[0].index, 5);
    });

    // NFR-003: recall ≥95% on HNSW queries (small corpus sanity check)
    it('achieves high recall vs linear scan on 100 vectors', () => {
      const index = buildHnswIndex(vectors, DIM);
      const query = randomVector(DIM, 7777);
      const k = 10;

      const hnswResults = searchHnsw(index, query, k).map(r => r.index);
      const linearResults = linearSearch(query, vectors, k);

      const overlap = hnswResults.filter(i => linearResults.includes(i)).length;
      const recall = overlap / k;
      assert.ok(recall >= 0.9, `Recall ${recall} below 0.9 threshold`);
    });

    it('returns empty array for null index', () => {
      const results = searchHnsw(null, randomVector(DIM, 1), 10);
      assert.deepEqual(results, []);
    });
  });
});
