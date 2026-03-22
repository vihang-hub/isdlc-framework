/**
 * Unit tests for src/core/analyze/artifact-readiness.js — Artifact Readiness
 *
 * Tests readiness rules, topic dependencies, and write strategy config.
 * Requirements: REQ-0110 FR-001..004
 *
 * Test ID prefix: AR- (Artifact Readiness)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getArtifactReadiness,
  getTopicDependencies,
  getWriteStrategyConfig
} from '../../../src/core/analyze/artifact-readiness.js';

// ---------------------------------------------------------------------------
// FR-001: Readiness Rules (AC-001-01..03)
// ---------------------------------------------------------------------------

describe('FR-001: Readiness Rules', () => {
  it('AR-01: requirements-spec.md requires problem-discovery + requirements-definition (AC-001-01)', () => {
    const topics = getArtifactReadiness('requirements-spec.md');
    assert.deepEqual(topics, ['problem-discovery', 'requirements-definition']);
  });

  it('AR-02: architecture-overview.md requires 3 topics (AC-001-01)', () => {
    const topics = getArtifactReadiness('architecture-overview.md');
    assert.deepEqual(topics, ['problem-discovery', 'requirements-definition', 'architecture']);
  });

  it('AR-03: module-design.md requires 4 topics (AC-001-01)', () => {
    const topics = getArtifactReadiness('module-design.md');
    assert.deepEqual(topics, ['problem-discovery', 'requirements-definition', 'architecture', 'specification']);
  });

  it('AR-04: meta.json requires only problem-discovery (AC-001-03)', () => {
    const topics = getArtifactReadiness('meta.json');
    assert.deepEqual(topics, ['problem-discovery']);
  });

  it('AR-05: unknown artifact returns null (AC-004-01)', () => {
    assert.equal(getArtifactReadiness('nonexistent.md'), null);
  });

  it('AR-06: readiness rules topics are frozen arrays', () => {
    const topics = getArtifactReadiness('requirements-spec.md');
    assert.ok(Object.isFrozen(topics));
  });
});

// ---------------------------------------------------------------------------
// FR-002: Topic Dependencies (AC-002-01..03)
// ---------------------------------------------------------------------------

describe('FR-002: Topic Dependencies', () => {
  it('AR-07: DAG has 3 edges (AC-002-01)', () => {
    const edges = getTopicDependencies();
    assert.equal(edges.length, 3);
  });

  it('AR-08: edges define correct ordering (AC-002-01)', () => {
    const edges = getTopicDependencies();
    assert.deepEqual(edges[0], ['problem-discovery', 'requirements-definition']);
    assert.deepEqual(edges[1], ['requirements-definition', 'architecture']);
    assert.deepEqual(edges[2], ['architecture', 'specification']);
  });

  it('AR-09: edges are frozen (AC-002-02)', () => {
    const edges = getTopicDependencies();
    assert.ok(Object.isFrozen(edges));
    for (const edge of edges) {
      assert.ok(Object.isFrozen(edge), `edge ${edge} should be frozen`);
    }
  });
});

// ---------------------------------------------------------------------------
// FR-003: Write Strategy Config (AC-003-01..03)
// ---------------------------------------------------------------------------

describe('FR-003: Write Strategy Config', () => {
  it('AR-10: progressive_meta_only is true (AC-003-01)', () => {
    const config = getWriteStrategyConfig();
    assert.equal(config.progressive_meta_only, true);
  });

  it('AR-11: final_batch_write is true (AC-003-02)', () => {
    const config = getWriteStrategyConfig();
    assert.equal(config.final_batch_write, true);
  });

  it('AR-12: pre_write_consistency_check is true (AC-003-03)', () => {
    const config = getWriteStrategyConfig();
    assert.equal(config.pre_write_consistency_check, true);
  });

  it('AR-13: write strategy config is frozen', () => {
    const config = getWriteStrategyConfig();
    assert.ok(Object.isFrozen(config));
  });
});
