/**
 * Tests for src/providers/codex/governance.js
 * REQ-0117: Codex Governance Checkpoint Integration
 *
 * Tests getGovernanceModel() and validateCheckpoint().
 *
 * Test ID prefix: GOV-
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getGovernanceModel,
  validateCheckpoint
} from '../../../src/providers/codex/governance.js';

// ---------------------------------------------------------------------------
// FR-001/FR-004: Governance Checkpoint Model
// ---------------------------------------------------------------------------

describe('getGovernanceModel (REQ-0117 FR-001/FR-004)', () => {
  // GOV-01: Returns frozen config
  it('GOV-01: returns a frozen config (AC-001-01)', () => {
    const model = getGovernanceModel();
    assert.ok(Object.isFrozen(model), 'Model should be frozen');
  });

  // GOV-02: Each entry has required fields
  it('GOV-02: each entry has checkpoint, claude_hook, status, mitigation (AC-001-02)', () => {
    const model = getGovernanceModel();
    const allEntries = [...model.enforceable, ...model.gaps];
    for (const entry of allEntries) {
      assert.ok('checkpoint' in entry, `Entry missing checkpoint: ${JSON.stringify(entry)}`);
      assert.ok('claude_hook' in entry, `Entry missing claude_hook: ${JSON.stringify(entry)}`);
      assert.ok('status' in entry, `Entry missing status: ${JSON.stringify(entry)}`);
      assert.ok('mitigation' in entry, `Entry missing mitigation: ${JSON.stringify(entry)}`);
    }
  });

  // GOV-03: phase-transition is enforceable
  it('GOV-03: phase-transition checkpoint is enforceable (AC-002-01)', () => {
    const model = getGovernanceModel();
    const pt = model.enforceable.find(e => e.checkpoint === 'phase-transition');
    assert.ok(pt, 'phase-transition should be in enforceable');
    assert.strictEqual(pt.status, 'enforceable');
  });

  // GOV-04: state-schema is enforceable
  it('GOV-04: state-schema checkpoint is enforceable (AC-002-02)', () => {
    const model = getGovernanceModel();
    const ss = model.enforceable.find(e => e.checkpoint === 'state-schema');
    assert.ok(ss, 'state-schema should be in enforceable');
    assert.strictEqual(ss.status, 'enforceable');
  });

  // GOV-05: artifact-existence is enforceable
  it('GOV-05: artifact-existence checkpoint is enforceable (AC-002-03)', () => {
    const model = getGovernanceModel();
    const ae = model.enforceable.find(e => e.checkpoint === 'artifact-existence');
    assert.ok(ae, 'artifact-existence should be in enforceable');
    assert.strictEqual(ae.status, 'enforceable');
  });

  // GOV-06: delegation-gate is a gap
  it('GOV-06: delegation-gate is a gap (AC-003-01)', () => {
    const model = getGovernanceModel();
    const dg = model.gaps.find(e => e.checkpoint === 'delegation-gate');
    assert.ok(dg, 'delegation-gate should be in gaps');
    assert.strictEqual(dg.status, 'gap');
  });

  // GOV-07: branch-guard is a gap
  it('GOV-07: branch-guard is a gap (AC-003-03)', () => {
    const model = getGovernanceModel();
    const bg = model.gaps.find(e => e.checkpoint === 'branch-guard');
    assert.ok(bg, 'branch-guard should be in gaps');
    assert.strictEqual(bg.status, 'gap');
  });

  // GOV-08: test-watcher is a gap
  it('GOV-08: test-watcher is a gap (AC-003-03)', () => {
    const model = getGovernanceModel();
    const tw = model.gaps.find(e => e.checkpoint === 'test-watcher');
    assert.ok(tw, 'test-watcher should be in gaps');
    assert.strictEqual(tw.status, 'gap');
  });

  // GOV-09: Model has enforceable and gaps arrays
  it('GOV-09: model has enforceable and gaps arrays (AC-004-01)', () => {
    const model = getGovernanceModel();
    assert.ok(Array.isArray(model.enforceable), 'enforceable should be array');
    assert.ok(Array.isArray(model.gaps), 'gaps should be array');
  });

  // GOV-10: All enforceable entries have status='enforceable'
  it('GOV-10: all enforceable entries have status "enforceable" (AC-004-02)', () => {
    const model = getGovernanceModel();
    for (const entry of model.enforceable) {
      assert.strictEqual(entry.status, 'enforceable', `${entry.checkpoint} should be enforceable`);
    }
  });

  // GOV-11: All gaps entries have status='gap'
  it('GOV-11: all gaps entries have status "gap" (AC-004-03)', () => {
    const model = getGovernanceModel();
    for (const entry of model.gaps) {
      assert.strictEqual(entry.status, 'gap', `${entry.checkpoint} should be gap`);
    }
  });

  // GOV-15: Model has mitigation_strategy field
  it('GOV-15: model has mitigation_strategy field (AC-004-01)', () => {
    const model = getGovernanceModel();
    assert.ok('mitigation_strategy' in model, 'Should have mitigation_strategy');
    assert.strictEqual(model.mitigation_strategy, 'periodic-validation');
  });

  // GOV-16: All entries are individually frozen
  it('GOV-16: all enforceable and gaps entries are frozen (AC-001-01)', () => {
    const model = getGovernanceModel();
    for (const entry of model.enforceable) {
      assert.ok(Object.isFrozen(entry), `Enforceable entry ${entry.checkpoint} should be frozen`);
    }
    for (const entry of model.gaps) {
      assert.ok(Object.isFrozen(entry), `Gap entry ${entry.checkpoint} should be frozen`);
    }
  });

  // GOV-16b: enforceable and gaps arrays are frozen
  it('GOV-16b: enforceable and gaps arrays are frozen', () => {
    const model = getGovernanceModel();
    assert.ok(Object.isFrozen(model.enforceable), 'enforceable array should be frozen');
    assert.ok(Object.isFrozen(model.gaps), 'gaps array should be frozen');
  });
});

// ---------------------------------------------------------------------------
// FR-005: Checkpoint Validation
// ---------------------------------------------------------------------------

describe('validateCheckpoint (REQ-0117 FR-005)', () => {
  // GOV-12: Returns { valid, violations }
  it('GOV-12: returns { valid, violations } (AC-005-01)', () => {
    const result = validateCheckpoint('01-requirements', {
      current_phase: '01-requirements',
      phases: {}
    });
    assert.ok('valid' in result, 'should have valid field');
    assert.ok('violations' in result, 'should have violations field');
    assert.ok(Array.isArray(result.violations), 'violations should be array');
  });

  // GOV-13: Runs enforceable checks for valid state
  it('GOV-13: validates clean state as valid (AC-005-02)', () => {
    const result = validateCheckpoint('01-requirements', {
      current_phase: '01-requirements',
      phases: { '01-requirements': {} }
    });
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.violations.length, 0);
  });

  // GOV-14: Reports violations for invalid state
  it('GOV-14: reports violations for invalid phase transition (AC-005-03)', () => {
    // Try to jump to phase 06 when current is phase 01
    const result = validateCheckpoint('06-implementation', {
      current_phase: '01-requirements',
      phases: {}
    });
    // Should detect phase sequence violation
    assert.ok(result.violations.length > 0, 'Should have violations');
    const phaseViolation = result.violations.find(v => v.checkpoint === 'phase-transition');
    assert.ok(phaseViolation, 'Should have phase-transition violation');
  });

  // GOV-14b: Violations have checkpoint and message fields
  it('GOV-14b: each violation has checkpoint and message (AC-005-03)', () => {
    const result = validateCheckpoint('06-implementation', {
      current_phase: '01-requirements',
      phases: {}
    });
    for (const v of result.violations) {
      assert.ok('checkpoint' in v, 'violation should have checkpoint');
      assert.ok('message' in v, 'violation should have message');
      assert.strictEqual(typeof v.checkpoint, 'string');
      assert.strictEqual(typeof v.message, 'string');
    }
  });

  // GOV-14c: State schema validation catches missing required fields
  it('GOV-14c: reports violation for missing current_phase in state', () => {
    const result = validateCheckpoint('01-requirements', {
      phases: {}
    });
    assert.ok(result.violations.length > 0, 'Should have violations for missing current_phase');
  });

  // GOV-14d: Handles null/undefined state gracefully
  it('GOV-14d: handles null state gracefully', () => {
    const result = validateCheckpoint('01-requirements', null);
    assert.strictEqual(result.valid, false);
    assert.ok(result.violations.length > 0);
  });

  // GOV-14e: Handles undefined state gracefully
  it('GOV-14e: handles undefined state gracefully', () => {
    const result = validateCheckpoint('01-requirements', undefined);
    assert.strictEqual(result.valid, false);
    assert.ok(result.violations.length > 0);
  });
});
