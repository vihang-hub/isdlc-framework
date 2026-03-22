/**
 * Unit tests for src/core/analyze/memory-model.js — Memory Layering
 *
 * Tests 3-layer schema, merge rules, search config, enrichment pipeline.
 * Requirements: REQ-0111 FR-001..005
 *
 * Test ID prefix: MM- (Memory Model)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getMemoryLayerSchema,
  getMergeRules,
  getSearchStrategyConfig,
  getEnrichmentPipeline
} from '../../../src/core/analyze/memory-model.js';

// ---------------------------------------------------------------------------
// FR-001: Memory Layer Schema (AC-001-01..02)
// ---------------------------------------------------------------------------

describe('FR-001: Memory Layer Schema', () => {
  it('MM-01: schema has exactly 3 layers (AC-001-01)', () => {
    const schema = getMemoryLayerSchema();
    const keys = Object.keys(schema);
    assert.equal(keys.length, 3);
    assert.deepEqual(keys.sort(), ['project', 'session', 'user']);
  });

  it('MM-02: user layer has correct paths and format (AC-001-01)', () => {
    const schema = getMemoryLayerSchema();
    assert.deepEqual(schema.user.paths, ['profile.json', 'sessions/']);
    assert.equal(schema.user.format, 'json_file_and_directory');
    assert.equal(schema.user.fail_open, true);
  });

  it('MM-03: project layer has correct paths and format (AC-001-01)', () => {
    const schema = getMemoryLayerSchema();
    assert.deepEqual(schema.project.paths, ['roundtable-memory.json']);
    assert.equal(schema.project.format, 'json_file');
    assert.equal(schema.project.fail_open, true);
  });

  it('MM-04: session layer is in-memory with no paths (AC-001-01)', () => {
    const schema = getMemoryLayerSchema();
    assert.deepEqual(schema.session.paths, []);
    assert.equal(schema.session.format, 'in_memory');
    assert.equal(schema.session.fail_open, true);
  });

  it('MM-05: each layer has a description (AC-001-02)', () => {
    const schema = getMemoryLayerSchema();
    for (const key of Object.keys(schema)) {
      assert.equal(typeof schema[key].description, 'string', `${key} missing description`);
    }
  });
});

// ---------------------------------------------------------------------------
// FR-002: Merge Rules (AC-002-01..03)
// ---------------------------------------------------------------------------

describe('FR-002: Merge Rules', () => {
  it('MM-06: priority order is user > project > session (AC-002-01)', () => {
    const rules = getMergeRules();
    assert.deepEqual(rules.priority, ['user', 'project', 'session']);
  });

  it('MM-07: conflict_threshold is 0.5 (AC-002-02)', () => {
    const rules = getMergeRules();
    assert.equal(rules.conflict_threshold, 0.5);
  });

  it('MM-08: strategy is user_overrides_project (AC-002-01)', () => {
    const rules = getMergeRules();
    assert.equal(rules.strategy, 'user_overrides_project');
  });

  it('MM-09: merge rules are frozen (AC-002-03)', () => {
    const rules = getMergeRules();
    assert.ok(Object.isFrozen(rules));
    assert.ok(Object.isFrozen(rules.priority));
  });
});

// ---------------------------------------------------------------------------
// FR-003: Search Strategy Config (AC-003-01..03)
// ---------------------------------------------------------------------------

describe('FR-003: Search Strategy Config', () => {
  it('MM-10: prefer is hybrid (AC-003-01)', () => {
    const config = getSearchStrategyConfig();
    assert.equal(config.prefer, 'hybrid');
  });

  it('MM-11: fallback is legacy (AC-003-02)', () => {
    const config = getSearchStrategyConfig();
    assert.equal(config.fallback, 'legacy');
  });

  it('MM-12: fail_open_on_missing_index is true (AC-003-03)', () => {
    const config = getSearchStrategyConfig();
    assert.equal(config.fail_open_on_missing_index, true);
  });

  it('MM-13: search config is frozen', () => {
    const config = getSearchStrategyConfig();
    assert.ok(Object.isFrozen(config));
  });
});

// ---------------------------------------------------------------------------
// FR-004: Enrichment Pipeline (AC-004-01..02)
// ---------------------------------------------------------------------------

describe('FR-004: Enrichment Pipeline', () => {
  it('MM-14: pipeline has 4 steps (AC-004-01)', () => {
    const pipeline = getEnrichmentPipeline();
    assert.equal(pipeline.length, 4);
  });

  it('MM-15: steps are in correct order (AC-004-01)', () => {
    const pipeline = getEnrichmentPipeline();
    const ids = pipeline.map(s => s.id);
    assert.deepEqual(ids, ['writeSessionRecord', 'embedSession', 'vectorStore', 'searchIndex']);
  });

  it('MM-16: step 1 is sync, steps 2-4 are async (AC-004-02)', () => {
    const pipeline = getEnrichmentPipeline();
    assert.equal(pipeline[0].async, false);
    assert.equal(pipeline[1].async, true);
    assert.equal(pipeline[2].async, true);
    assert.equal(pipeline[3].async, true);
  });

  it('MM-17: pipeline is frozen', () => {
    const pipeline = getEnrichmentPipeline();
    assert.ok(Object.isFrozen(pipeline));
    for (const step of pipeline) {
      assert.ok(Object.isFrozen(step), `step ${step.id} should be frozen`);
    }
  });
});

// ---------------------------------------------------------------------------
// Immutability
// ---------------------------------------------------------------------------

describe('Memory Model Immutability', () => {
  it('MM-18: layer schema is frozen at all levels', () => {
    const schema = getMemoryLayerSchema();
    assert.ok(Object.isFrozen(schema));
    for (const key of Object.keys(schema)) {
      assert.ok(Object.isFrozen(schema[key]), `${key} layer should be frozen`);
      assert.ok(Object.isFrozen(schema[key].paths), `${key}.paths should be frozen`);
    }
  });
});
