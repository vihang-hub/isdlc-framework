/**
 * Unit tests for rolling-state.js (REQ-GH-253)
 *
 * Verifies the in-memory rolling state store: creation, updates from
 * trailer and markers, conflict resolution (trailer wins), and
 * fail-safe behavior when both mechanisms fail.
 *
 * Traces to: FR-003, AC-003-01, AC-003-02, AC-003-03, AC-003-04
 * Test runner: node:test (ESM, Article XIII)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { create, update, snapshot, applyAcceptedPayload } from '../../../../src/core/roundtable/rolling-state.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MINIMAL_DEF = {
  states: [
    { name: 'CONVERSATION', sub_tasks: { tasks: [{ id: 'SCOPE_FRAMING' }, { id: 'CODEBASE_SCAN' }] } }
  ]
};

const ANALYZE_DEF = {
  states: {
    CONVERSATION: {
      description: 'Interactive roundtable conversation',
      sub_tasks: {
        execution_order: 'dynamic',
        tasks: [
          { id: 'SCOPE_FRAMING', completion_marker: 'scope_framed' },
          { id: 'CODEBASE_SCAN', completion_marker: 'scan_complete' },
          { id: 'BLAST_RADIUS', completion_marker: 'blast_radius_assessed' },
          { id: 'OPTIONS_RESEARCH', completion_marker: 'options_researched' },
          { id: 'DEPENDENCY_CHECK', completion_marker: 'dependencies_checked' }
        ]
      }
    }
  }
};

const EMPTY_DEF = { states: [] };
const NO_SUBTASKS_DEF = { states: [{ name: 'IDLE' }] };

// ---------------------------------------------------------------------------
// RS-01: Create rolling state from definition (positive)
// ---------------------------------------------------------------------------

describe('REQ-GH-253 rolling-state', () => {

  it('RS-01: creates initial rolling state from state machine definition', () => {
    const state = create(MINIMAL_DEF);
    assert.strictEqual(state.scan_complete, false);
    assert.strictEqual(state.scope_accepted, false);
    assert.deepStrictEqual(state.coverage_by_topic, {});
    assert.strictEqual(state.amendment_cycles, 0);
    assert.strictEqual(state.rendering_mode, 'bulleted');
    assert.deepStrictEqual(state.participation_markers, { maya: false, alex: false, jordan: false });
    assert.deepStrictEqual(state.sub_task_completion, { SCOPE_FRAMING: false, CODEBASE_SCAN: false });
  });

  it('RS-01b: creates state from object-keyed definition (analyze.json format)', () => {
    const state = create(ANALYZE_DEF);
    assert.strictEqual(Object.keys(state.sub_task_completion).length, 5);
    assert.strictEqual(state.sub_task_completion.SCOPE_FRAMING, false);
    assert.strictEqual(state.sub_task_completion.BLAST_RADIUS, false);
  });

  it('RS-01c: creates state from empty definition with no sub-tasks', () => {
    const state = create(EMPTY_DEF);
    assert.deepStrictEqual(state.sub_task_completion, {});
    assert.strictEqual(state.scan_complete, false);
  });

  it('RS-01d: creates state from definition with states but no sub_tasks', () => {
    const state = create(NO_SUBTASKS_DEF);
    assert.deepStrictEqual(state.sub_task_completion, {});
  });

  it('RS-01e: creates state from null/undefined definition gracefully', () => {
    const state = create(null);
    assert.deepStrictEqual(state.sub_task_completion, {});
    assert.strictEqual(state.scan_complete, false);
  });

  // RS-02: Update from trailer (positive, AC-003-01)
  it('RS-02: updates state from parsed trailer fields', () => {
    const state = create(MINIMAL_DEF);
    const updated = update(state, { trailer: { sub_task: 'CODEBASE_SCAN', status: 'complete' } });
    assert.strictEqual(updated.scan_complete, true);
    assert.strictEqual(updated.sub_task_completion.CODEBASE_SCAN, true);
  });

  it('RS-02b: trailer with running status does not mark complete', () => {
    const state = create(MINIMAL_DEF);
    const updated = update(state, { trailer: { sub_task: 'CODEBASE_SCAN', status: 'running' } });
    assert.strictEqual(updated.scan_complete, false);
    assert.strictEqual(updated.sub_task_completion.CODEBASE_SCAN, false);
  });

  // RS-03: Update from markers (positive, AC-003-02)
  it('RS-03: updates state from marker extraction results', () => {
    const state = create(MINIMAL_DEF);
    const updated = update(state, { markers: { scope_accepted: true } });
    assert.strictEqual(updated.scope_accepted, true);
  });

  it('RS-03b: updates coverage_by_topic from markers', () => {
    const state = create(MINIMAL_DEF);
    const updated = update(state, { markers: { coverage_by_topic: { auth: true, sessions: false } } });
    assert.strictEqual(updated.coverage_by_topic.auth, true);
    assert.strictEqual(updated.coverage_by_topic.sessions, false);
  });

  it('RS-03c: updates participation_markers from markers', () => {
    const state = create(MINIMAL_DEF);
    const updated = update(state, { markers: { participation_markers: { maya: true } } });
    assert.strictEqual(updated.participation_markers.maya, true);
    assert.strictEqual(updated.participation_markers.alex, false);
  });

  // RS-04: Trailer wins on conflict (positive, AC-003-03)
  it('RS-04: trailer overrides markers when both report conflicting values', () => {
    const state = create(MINIMAL_DEF);
    const updated = update(state, { trailer: { scope_accepted: false }, markers: { scope_accepted: true } });
    assert.strictEqual(updated.scope_accepted, false);
  });

  it('RS-04b: trailer rendering_mode overrides marker rendering_mode', () => {
    const state = create(MINIMAL_DEF);
    const updated = update(state, {
      trailer: { rendering_mode: 'silent' },
      markers: { rendering_mode: 'conversational' }
    });
    assert.strictEqual(updated.rendering_mode, 'silent');
  });

  // RS-05: Both mechanisms fail -- state unchanged (negative, AC-003-04)
  it('RS-05: state unchanged when both trailer and markers return nothing', () => {
    const state = create(MINIMAL_DEF);
    const before = snapshot(state);
    const updated = update(state, { trailer: null, markers: {} });
    assert.deepStrictEqual(snapshot(updated), before);
  });

  it('RS-05b: state unchanged with empty updates object', () => {
    const state = create(MINIMAL_DEF);
    const before = snapshot(state);
    const updated = update(state, {});
    assert.deepStrictEqual(snapshot(updated), before);
  });

  it('RS-05c: state unchanged with null updates', () => {
    const state = create(MINIMAL_DEF);
    const before = snapshot(state);
    const updated = update(state, null);
    assert.deepStrictEqual(snapshot(updated), before);
  });

  // RS-06: Snapshot returns deep copy
  it('RS-06: snapshot returns independent deep copy', () => {
    const state = create(MINIMAL_DEF);
    const snap = snapshot(state);
    snap.scan_complete = true;
    snap.coverage_by_topic.test = true;
    assert.strictEqual(state.scan_complete, false);
    assert.strictEqual(state.coverage_by_topic.test, undefined);
  });

  // RS-07: Original state not mutated by update
  it('RS-07: update does not mutate original state', () => {
    const state = create(MINIMAL_DEF);
    const original = snapshot(state);
    update(state, { markers: { scope_accepted: true, coverage_by_topic: { x: true } } });
    assert.deepStrictEqual(snapshot(state), original);
  });

  // RS-08: Update sub_task_completion via markers
  it('RS-08: updates sub_task_completion from markers object', () => {
    const state = create(MINIMAL_DEF);
    const updated = update(state, { markers: { sub_task_completion: { SCOPE_FRAMING: true } } });
    assert.strictEqual(updated.sub_task_completion.SCOPE_FRAMING, true);
    assert.strictEqual(updated.sub_task_completion.CODEBASE_SCAN, false);
  });

  // RS-09: amendment_cycles from trailer
  it('RS-09: trailer can set amendment_cycles', () => {
    const state = create(MINIMAL_DEF);
    const updated = update(state, { trailer: { amendment_cycles: 2 } });
    assert.strictEqual(updated.amendment_cycles, 2);
  });

  // -------------------------------------------------------------------------
  // BUG-GH-265 follow-ups (GH-266) — accepted_payloads accumulator
  // -------------------------------------------------------------------------

  // RS-10: create() initializes accepted_payloads with all 7 PRESENTING_* keys
  // Traces: FR-005, AC-005-01
  it('RS-10: create() initializes accepted_payloads with 7 PRESENTING_* keys defaulted to null', () => {
    const state = create(MINIMAL_DEF);
    assert.ok(state.accepted_payloads, 'accepted_payloads field present');
    const expected = [
      'PRESENTING_REQUIREMENTS',
      'PRESENTING_ARCHITECTURE',
      'PRESENTING_DESIGN',
      'PRESENTING_TASKS',
      'PRESENTING_BUG_SUMMARY',
      'PRESENTING_ROOT_CAUSE',
      'PRESENTING_FIX_STRATEGY',
    ];
    for (const key of expected) {
      assert.ok(key in state.accepted_payloads, `key ${key} present`);
      assert.strictEqual(state.accepted_payloads[key], null, `${key} defaults to null`);
    }
  });

  // RS-11: applyAcceptedPayload writes to correct slot, others untouched, immutable input
  // Traces: FR-005, AC-005-02
  it('RS-11: applyAcceptedPayload writes to correct slot, leaves others null, does not mutate input', () => {
    const state = create(MINIMAL_DEF);
    const stateBefore = snapshot(state);

    const updated = applyAcceptedPayload(state, 'PRESENTING_REQUIREMENTS', 'FR-001 accepted');

    assert.strictEqual(updated.accepted_payloads.PRESENTING_REQUIREMENTS, 'FR-001 accepted');
    assert.strictEqual(updated.accepted_payloads.PRESENTING_ARCHITECTURE, null, 'others untouched');
    assert.strictEqual(updated.accepted_payloads.PRESENTING_DESIGN, null);
    // Input must not be mutated
    assert.deepStrictEqual(snapshot(state), stateBefore, 'input state unchanged');
    // Returned object must be different reference
    assert.notStrictEqual(updated, state, 'new object returned');
  });

  // RS-11b: applyAcceptedPayload with unknown stateName returns input unchanged
  // Traces: FR-005, AC-005-02 (negative)
  it('RS-11b: applyAcceptedPayload with unknown state name returns input unchanged', () => {
    const state = create(MINIMAL_DEF);
    const result = applyAcceptedPayload(state, 'NOT_A_REAL_STATE', 'payload');
    assert.strictEqual(result, state, 'returns same input on invalid stateName');
  });

  // RS-12: update() defensively self-heals legacy state without accepted_payloads
  // Traces: FR-005, AC-005-03
  it('RS-12: update() defensively initializes accepted_payloads on legacy state shapes', () => {
    // Simulate a legacy in-flight session — rolling state pre-dates the
    // accepted_payloads field, so it's absent from the input.
    const legacyState = {
      coverage_by_topic: {},
      scan_complete: false,
      scope_accepted: false,
      current_persona_rotation: ['maya', 'alex', 'jordan'],
      rendering_mode: 'bulleted',
      amendment_cycles: 0,
      participation_markers: { maya: false, alex: false, jordan: false },
      sub_task_completion: {},
      // accepted_payloads intentionally absent
    };
    const updated = update(legacyState, { markers: { scan_complete: true } });
    assert.ok(updated.accepted_payloads, 'accepted_payloads self-healed onto output');
    assert.strictEqual(updated.accepted_payloads.PRESENTING_TASKS, null);
    assert.strictEqual(updated.scan_complete, true, 'normal update behavior preserved');
  });

  // RS-13: snapshot includes accepted_payloads
  // Traces: FR-005, AC-005-01
  it('RS-13: snapshot includes accepted_payloads', () => {
    const state = create(MINIMAL_DEF);
    const updated = applyAcceptedPayload(state, 'PRESENTING_TASKS', 'tasks accepted');
    const snap = snapshot(updated);
    assert.deepStrictEqual(snap.accepted_payloads, updated.accepted_payloads);
    // Snapshot is independent
    snap.accepted_payloads.PRESENTING_TASKS = 'mutated';
    assert.strictEqual(updated.accepted_payloads.PRESENTING_TASKS, 'tasks accepted', 'snapshot is deep copy');
  });

});
