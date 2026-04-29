/**
 * Unit tests for src/core/backlog/analysis-index.js
 * BUG-GH-277: Dashboard shows no active workflows during analysis
 * Test ID prefix: AI-
 * Traces: FR-001, FR-007
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, chmodSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';

import {
  readAnalysisIndex,
  updateAnalysisIndex,
  rebuildAnalysisIndex
} from '../../../src/core/backlog/analysis-index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProjectRoot() {
  const root = mkdtempSync(join(tmpdir(), 'isdlc-ai-test-'));
  mkdirSync(join(root, '.isdlc'), { recursive: true });
  return root;
}

function writeIndex(root, content) {
  writeFileSync(join(root, '.isdlc', 'analysis-index.json'), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
}

function readIndex(root) {
  return JSON.parse(readFileSync(join(root, '.isdlc', 'analysis-index.json'), 'utf8'));
}

const DEFAULT_INDEX = { version: '1.0.0', updated_at: null, items: [] };

function makeMeta(overrides = {}) {
  return {
    source_id: 'GH-277',
    item_type: 'BUG',
    analysis_status: 'partial',
    phases_completed: ['00-quick-scan', '01-requirements'],
    created_at: '2026-04-29T10:00:00.000Z',
    ...overrides
  };
}

function makeSlugDir(root, slug, meta) {
  const reqDir = join(root, 'docs', 'requirements', slug);
  mkdirSync(reqDir, { recursive: true });
  if (meta) {
    writeFileSync(join(reqDir, 'meta.json'), JSON.stringify(meta, null, 2));
  }
  return reqDir;
}

// ---------------------------------------------------------------------------
// readAnalysisIndex
// ---------------------------------------------------------------------------

describe('readAnalysisIndex', () => {
  let root;

  beforeEach(() => { root = makeProjectRoot(); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('AI-01: returns default when file does not exist', () => {
    const result = readAnalysisIndex(root);
    assert.deepStrictEqual(result, DEFAULT_INDEX);
  });

  it('AI-02: returns parsed JSON for valid file', () => {
    const index = {
      version: '1.0.0',
      updated_at: '2026-04-29T10:00:00.000Z',
      items: [
        { slug: 'BUG-GH-277-fix', source_id: 'GH-277', item_type: 'BUG', analysis_status: 'partial', phases_completed: ['00-quick-scan'], created_at: '2026-04-29T10:00:00.000Z', last_activity_at: '2026-04-29T10:00:00.000Z' },
        { slug: 'REQ-GH-280-feature', source_id: 'GH-280', item_type: 'FEATURE', analysis_status: 'raw', phases_completed: [], created_at: '2026-04-29T11:00:00.000Z', last_activity_at: '2026-04-29T11:00:00.000Z' }
      ]
    };
    writeIndex(root, index);
    const result = readAnalysisIndex(root);
    assert.deepStrictEqual(result, index);
  });

  it('AI-03: returns default for corrupt JSON (fail-open)', () => {
    writeIndex(root, 'not valid json {{{');
    const result = readAnalysisIndex(root);
    assert.deepStrictEqual(result, DEFAULT_INDEX);
  });

  it('AI-04: returns default for empty file', () => {
    writeFileSync(join(root, '.isdlc', 'analysis-index.json'), '');
    const result = readAnalysisIndex(root);
    assert.deepStrictEqual(result, DEFAULT_INDEX);
  });

  it('AI-21: returns items:[] when items key is missing from file', () => {
    writeIndex(root, { version: '1.0.0' });
    const result = readAnalysisIndex(root);
    assert.deepStrictEqual(result.items, []);
    assert.strictEqual(result.version, '1.0.0');
  });
});

// ---------------------------------------------------------------------------
// updateAnalysisIndex
// ---------------------------------------------------------------------------

describe('updateAnalysisIndex', () => {
  let root;

  beforeEach(() => { root = makeProjectRoot(); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('AI-05: creates file when absent', () => {
    // Remove the .isdlc dir to start fresh, then let function recreate it
    rmSync(join(root, '.isdlc'), { recursive: true, force: true });
    mkdirSync(join(root, '.isdlc'), { recursive: true });

    const meta = makeMeta();
    updateAnalysisIndex(root, 'BUG-GH-277-dashboard-fix', meta);

    const index = readIndex(root);
    assert.strictEqual(index.items.length, 1);
    assert.strictEqual(index.items[0].slug, 'BUG-GH-277-dashboard-fix');
    assert.strictEqual(index.items[0].source_id, 'GH-277');
    assert.strictEqual(index.items[0].item_type, 'BUG');
  });

  it('AI-06: adds new item without affecting existing', () => {
    const existingItem = {
      slug: 'slug-a', source_id: 'GH-100', item_type: 'FEATURE',
      analysis_status: 'analyzed',
      phases_completed: ['00-quick-scan', '01-requirements', '02-impact-analysis', '03-architecture', '04-design'],
      created_at: '2026-01-01T00:00:00.000Z', last_activity_at: '2026-01-01T00:00:00.000Z'
    };
    writeIndex(root, { version: '1.0.0', updated_at: '2026-01-01T00:00:00.000Z', items: [existingItem] });

    const metaB = makeMeta({ source_id: 'GH-200', item_type: 'FEATURE' });
    updateAnalysisIndex(root, 'slug-b', metaB);

    const index = readIndex(root);
    assert.strictEqual(index.items.length, 2);
    assert.strictEqual(index.items[0].slug, 'slug-a');
    assert.strictEqual(index.items[0].source_id, 'GH-100');
    assert.strictEqual(index.items[1].slug, 'slug-b');
    assert.strictEqual(index.items[1].source_id, 'GH-200');
  });

  it('AI-07: updates existing item in place', () => {
    const existingItem = {
      slug: 'GH-277', source_id: 'GH-277', item_type: 'BUG',
      analysis_status: 'raw', phases_completed: [],
      created_at: '2026-04-01T00:00:00.000Z', last_activity_at: '2026-04-01T00:00:00.000Z'
    };
    writeIndex(root, { version: '1.0.0', updated_at: '2026-04-01T00:00:00.000Z', items: [existingItem] });

    const updatedMeta = makeMeta({ phases_completed: ['00-quick-scan', '01-requirements'] });
    updateAnalysisIndex(root, 'GH-277', updatedMeta);

    const index = readIndex(root);
    assert.strictEqual(index.items.length, 1); // No duplicate
    assert.deepStrictEqual(index.items[0].phases_completed, ['00-quick-scan', '01-requirements']);
    assert.strictEqual(index.items[0].analysis_status, 'partial');
    // last_activity_at should be refreshed
    assert.notStrictEqual(index.items[0].last_activity_at, '2026-04-01T00:00:00.000Z');
  });

  it('AI-08: preserves all schema fields', () => {
    const meta = makeMeta();
    updateAnalysisIndex(root, 'BUG-GH-277-test', meta);

    const index = readIndex(root);
    assert.strictEqual(index.version, '1.0.0');
    assert.ok(index.updated_at);
    const item = index.items[0];
    assert.strictEqual(item.slug, 'BUG-GH-277-test');
    assert.strictEqual(item.source_id, 'GH-277');
    assert.strictEqual(item.item_type, 'BUG');
    assert.ok(item.analysis_status);
    assert.ok(Array.isArray(item.phases_completed));
    assert.ok(item.created_at);
    assert.ok(item.last_activity_at);
  });

  it('AI-09: sets version and updated_at correctly', () => {
    const meta = makeMeta();
    updateAnalysisIndex(root, 'test-slug', meta);

    const index = readIndex(root);
    assert.strictEqual(index.version, '1.0.0');
    // updated_at should be a valid ISO-8601 timestamp
    const ts = new Date(index.updated_at);
    assert.ok(!isNaN(ts.getTime()), 'updated_at should be valid ISO-8601');
  });

  it('AI-10: handles corrupt existing file (fail-open recovery)', () => {
    writeIndex(root, 'corrupt json data!!!');

    const meta = makeMeta();
    updateAnalysisIndex(root, 'fresh-item', meta);

    const index = readIndex(root);
    assert.strictEqual(index.items.length, 1);
    assert.strictEqual(index.items[0].slug, 'fresh-item');
  });

  it('AI-11: derives analysis_status partial from phases_completed', () => {
    const meta = makeMeta({ phases_completed: ['00-quick-scan', '01-requirements'] });
    updateAnalysisIndex(root, 'test-partial', meta);

    const index = readIndex(root);
    assert.strictEqual(index.items[0].analysis_status, 'partial');
  });

  it('AI-12: derives analysis_status analyzed for all 5 phases', () => {
    const allPhases = ['00-quick-scan', '01-requirements', '02-impact-analysis', '03-architecture', '04-design'];
    const meta = makeMeta({ phases_completed: allPhases });
    updateAnalysisIndex(root, 'test-analyzed', meta);

    const index = readIndex(root);
    assert.strictEqual(index.items[0].analysis_status, 'analyzed');
  });

  it('AI-13: derives analysis_status raw for empty phases', () => {
    const meta = makeMeta({ phases_completed: [] });
    updateAnalysisIndex(root, 'test-raw', meta);

    const index = readIndex(root);
    assert.strictEqual(index.items[0].analysis_status, 'raw');
  });

  it('AI-19: creates .isdlc directory if missing', () => {
    const bareRoot = mkdtempSync(join(tmpdir(), 'isdlc-ai-bare-'));
    try {
      const meta = makeMeta();
      updateAnalysisIndex(bareRoot, 'test-slug', meta);

      const index = JSON.parse(readFileSync(join(bareRoot, '.isdlc', 'analysis-index.json'), 'utf8'));
      assert.strictEqual(index.items.length, 1);
    } finally {
      rmSync(bareRoot, { recursive: true, force: true });
    }
  });

  it('AI-20: fail-open on write error (read-only dir)', () => {
    const readonlyRoot = mkdtempSync(join(tmpdir(), 'isdlc-ai-ro-'));
    mkdirSync(join(readonlyRoot, '.isdlc'), { recursive: true });
    try {
      chmodSync(join(readonlyRoot, '.isdlc'), 0o444);
      // Should not throw
      updateAnalysisIndex(readonlyRoot, 'test-slug', makeMeta());
    } finally {
      // Restore permissions for cleanup
      try { chmodSync(join(readonlyRoot, '.isdlc'), 0o755); } catch (_e) { /* ignore */ }
      rmSync(readonlyRoot, { recursive: true, force: true });
    }
  });

  it('AI-22: preserves item_type field', () => {
    const meta = makeMeta({ item_type: 'BUG' });
    updateAnalysisIndex(root, 'test-type', meta);

    const index = readIndex(root);
    assert.strictEqual(index.items[0].item_type, 'BUG');
  });
});

// ---------------------------------------------------------------------------
// rebuildAnalysisIndex
// ---------------------------------------------------------------------------

describe('rebuildAnalysisIndex', () => {
  let root;

  beforeEach(() => { root = makeProjectRoot(); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('AI-14: rebuilds from meta.json files', () => {
    makeSlugDir(root, 'BUG-GH-100-fix', {
      source_id: 'GH-100', item_type: 'BUG',
      analysis_status: 'partial', phases_completed: ['00-quick-scan'],
      created_at: '2026-01-01T00:00:00.000Z'
    });
    makeSlugDir(root, 'REQ-GH-200-feature', {
      source_id: 'GH-200', item_type: 'FEATURE',
      analysis_status: 'analyzed',
      phases_completed: ['00-quick-scan', '01-requirements', '02-impact-analysis', '03-architecture', '04-design'],
      created_at: '2026-02-01T00:00:00.000Z'
    });
    makeSlugDir(root, 'REQ-GH-300-upgrade', {
      source_id: 'GH-300', item_type: 'UPGRADE',
      analysis_status: 'raw', phases_completed: [],
      created_at: '2026-03-01T00:00:00.000Z'
    });

    rebuildAnalysisIndex(root);

    const index = readIndex(root);
    assert.strictEqual(index.version, '1.0.0');
    assert.strictEqual(index.items.length, 3);

    const slugs = index.items.map(i => i.slug).sort();
    assert.deepStrictEqual(slugs, ['BUG-GH-100-fix', 'REQ-GH-200-feature', 'REQ-GH-300-upgrade']);
  });

  it('AI-15: skips directories without meta.json', () => {
    makeSlugDir(root, 'has-meta', {
      source_id: 'GH-1', item_type: 'BUG', analysis_status: 'raw',
      phases_completed: [], created_at: '2026-01-01T00:00:00.000Z'
    });
    makeSlugDir(root, 'also-has-meta', {
      source_id: 'GH-2', item_type: 'FEATURE', analysis_status: 'partial',
      phases_completed: ['00-quick-scan'], created_at: '2026-02-01T00:00:00.000Z'
    });
    // Create dir without meta.json
    makeSlugDir(root, 'no-meta', null);

    rebuildAnalysisIndex(root);

    const index = readIndex(root);
    assert.strictEqual(index.items.length, 2);
  });

  it('AI-16: handles empty requirements directory', () => {
    mkdirSync(join(root, 'docs', 'requirements'), { recursive: true });

    rebuildAnalysisIndex(root);

    const index = readIndex(root);
    assert.deepStrictEqual(index.items, []);
  });

  it('AI-17: handles missing requirements directory', () => {
    // docs/requirements/ does not exist
    rebuildAnalysisIndex(root);

    const index = readIndex(root);
    assert.deepStrictEqual(index.items, []);
  });

  it('AI-18: skips corrupt meta.json', () => {
    makeSlugDir(root, 'valid-1', {
      source_id: 'GH-1', item_type: 'BUG', analysis_status: 'raw',
      phases_completed: [], created_at: '2026-01-01T00:00:00.000Z'
    });
    makeSlugDir(root, 'valid-2', {
      source_id: 'GH-2', item_type: 'FEATURE', analysis_status: 'partial',
      phases_completed: ['00-quick-scan'], created_at: '2026-02-01T00:00:00.000Z'
    });
    // Create dir with corrupt meta.json
    const corruptDir = join(root, 'docs', 'requirements', 'corrupt-meta');
    mkdirSync(corruptDir, { recursive: true });
    writeFileSync(join(corruptDir, 'meta.json'), 'not json!!!');

    rebuildAnalysisIndex(root);

    const index = readIndex(root);
    assert.strictEqual(index.items.length, 2);
  });
});
