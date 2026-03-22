/**
 * Tests for src/providers/codex/index.js — barrel re-exports
 * REQ-0114 FR-003: Provider Index
 *
 * Verifies that the Codex adapter entry point re-exports all
 * public functions from projection.js, installer.js, and governance.js.
 *
 * Test ID prefix: IDX-
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getCodexConfig,
  getProjectionPaths,
  projectInstructions,
  installCodex,
  updateCodex,
  uninstallCodex,
  doctorCodex,
  getGovernanceModel,
  validateCheckpoint
} from '../../../src/providers/codex/index.js';

// ---------------------------------------------------------------------------
// FR-003: Provider Index (AC-003-01..03)
// ---------------------------------------------------------------------------

describe('Codex index re-exports (REQ-0114 FR-003)', () => {
  // IDX-01: Re-exports getCodexConfig from projection
  it('IDX-01: re-exports getCodexConfig (AC-003-01)', () => {
    assert.strictEqual(typeof getCodexConfig, 'function');
    const config = getCodexConfig();
    assert.strictEqual(config.provider, 'codex');
  });

  // IDX-02: Re-exports getProjectionPaths from projection
  it('IDX-02: re-exports getProjectionPaths (AC-003-01)', () => {
    assert.strictEqual(typeof getProjectionPaths, 'function');
    const paths = getProjectionPaths();
    assert.ok('instructions' in paths);
  });

  // IDX-03: Re-exports installer functions
  it('IDX-03: re-exports installCodex, updateCodex, uninstallCodex, doctorCodex (AC-003-02)', () => {
    assert.strictEqual(typeof installCodex, 'function');
    assert.strictEqual(typeof updateCodex, 'function');
    assert.strictEqual(typeof uninstallCodex, 'function');
    assert.strictEqual(typeof doctorCodex, 'function');
  });

  // IDX-04: Re-exports governance functions
  it('IDX-04: re-exports getGovernanceModel, validateCheckpoint (AC-003-03)', () => {
    assert.strictEqual(typeof getGovernanceModel, 'function');
    assert.strictEqual(typeof validateCheckpoint, 'function');
  });

  // IDX-05: Re-exports projectInstructions
  it('IDX-05: re-exports projectInstructions (AC-003-01)', () => {
    assert.strictEqual(typeof projectInstructions, 'function');
  });

  // IDX-06: All exports are functions
  it('IDX-06: all 9 exports are functions', async () => {
    const mod = await import('../../../src/providers/codex/index.js');
    const exportNames = Object.keys(mod).filter(k => k !== 'default');
    assert.ok(exportNames.length >= 9, `Expected >= 9 exports, got ${exportNames.length}`);
    for (const name of exportNames) {
      assert.strictEqual(typeof mod[name], 'function', `${name} should be a function`);
    }
  });
});
