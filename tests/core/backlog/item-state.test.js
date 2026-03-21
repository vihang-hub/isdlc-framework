/**
 * Tests for src/core/backlog/item-state.js
 * REQ-0083: Extract ItemStateService
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  readMetaJson,
  writeMetaJson,
  deriveAnalysisStatus,
  deriveBacklogMarker
} from '../../../src/core/backlog/item-state.js';

describe('deriveAnalysisStatus', () => {
  it('returns raw for non-array input', () => {
    assert.strictEqual(deriveAnalysisStatus(null), 'raw');
    assert.strictEqual(deriveAnalysisStatus('invalid'), 'raw');
  });

  it('returns raw for empty array', () => {
    assert.strictEqual(deriveAnalysisStatus([]), 'raw');
  });

  it('returns partial for incomplete phases', () => {
    assert.strictEqual(deriveAnalysisStatus(['00-quick-scan', '01-requirements']), 'partial');
  });

  it('returns analyzed for all analysis phases', () => {
    const all = ['00-quick-scan', '01-requirements', '02-impact-analysis', '03-architecture', '04-design'];
    assert.strictEqual(deriveAnalysisStatus(all), 'analyzed');
  });

  it('handles light sizing with skip phases', () => {
    const sizingDecision = {
      effective_intensity: 'light',
      light_skip_phases: ['03-architecture', '04-design']
    };
    const completed = ['00-quick-scan', '01-requirements', '02-impact-analysis'];
    assert.strictEqual(deriveAnalysisStatus(completed, sizingDecision), 'analyzed');
  });

  it('returns partial when light sizing requirements not met', () => {
    const sizingDecision = {
      effective_intensity: 'light',
      light_skip_phases: ['03-architecture', '04-design']
    };
    const completed = ['00-quick-scan'];
    assert.strictEqual(deriveAnalysisStatus(completed, sizingDecision), 'partial');
  });
});

describe('deriveBacklogMarker', () => {
  it('returns space for raw', () => {
    assert.strictEqual(deriveBacklogMarker('raw'), ' ');
  });

  it('returns tilde for partial', () => {
    assert.strictEqual(deriveBacklogMarker('partial'), '~');
  });

  it('returns A for analyzed', () => {
    assert.strictEqual(deriveBacklogMarker('analyzed'), 'A');
  });

  it('returns space for unknown status', () => {
    assert.strictEqual(deriveBacklogMarker('unknown'), ' ');
  });
});

describe('readMetaJson', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'isdlc-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null for non-existent directory', () => {
    assert.strictEqual(readMetaJson(join(tmpDir, 'nonexistent')), null);
  });

  it('reads and normalizes meta.json', () => {
    writeFileSync(join(tmpDir, 'meta.json'), JSON.stringify({ description: 'Test' }));
    const meta = readMetaJson(tmpDir);
    assert.ok(meta);
    assert.strictEqual(meta.analysis_status, 'raw');
    assert.deepStrictEqual(meta.phases_completed, []);
    assert.strictEqual(meta.source, 'manual');
    assert.ok(meta.created_at);
  });

  it('migrates legacy phase_a_completed field', () => {
    writeFileSync(join(tmpDir, 'meta.json'), JSON.stringify({ phase_a_completed: true }));
    const meta = readMetaJson(tmpDir);
    assert.strictEqual(meta.analysis_status, 'analyzed');
    assert.strictEqual(meta.phases_completed.length, 5);
  });

  it('returns null for corrupted JSON', () => {
    writeFileSync(join(tmpDir, 'meta.json'), 'not json');
    assert.strictEqual(readMetaJson(tmpDir), null);
  });

  it('applies roundtable defaults', () => {
    writeFileSync(join(tmpDir, 'meta.json'), JSON.stringify({}));
    const meta = readMetaJson(tmpDir);
    assert.deepStrictEqual(meta.steps_completed, []);
    assert.deepStrictEqual(meta.depth_overrides, {});
    assert.deepStrictEqual(meta.elaborations, []);
    assert.deepStrictEqual(meta.elaboration_config, {});
  });
});

describe('writeMetaJson', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'isdlc-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes meta.json and derives analysis_status', () => {
    const meta = {
      phases_completed: ['00-quick-scan', '01-requirements', '02-impact-analysis', '03-architecture', '04-design']
    };
    writeMetaJson(tmpDir, meta);
    const written = JSON.parse(readFileSync(join(tmpDir, 'meta.json'), 'utf8'));
    assert.strictEqual(written.analysis_status, 'analyzed');
  });

  it('removes legacy field', () => {
    const meta = { phase_a_completed: true, phases_completed: [] };
    writeMetaJson(tmpDir, meta);
    const written = JSON.parse(readFileSync(join(tmpDir, 'meta.json'), 'utf8'));
    assert.strictEqual(written.phase_a_completed, undefined);
  });
});
