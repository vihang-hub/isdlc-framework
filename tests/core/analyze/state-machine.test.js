/**
 * Unit tests for src/core/analyze/state-machine.js — Roundtable FSM
 *
 * Tests STATES enum, EVENTS enum, transition table, and tier paths.
 * Requirements: REQ-0109 FR-001..004
 *
 * Test ID prefix: SM- (State Machine)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getStateMachine,
  getTransition,
  getTierPath
} from '../../../src/core/analyze/state-machine.js';

// ---------------------------------------------------------------------------
// FR-001: FSM Definition (AC-001-01..02)
// ---------------------------------------------------------------------------

describe('FR-001: FSM Definition', () => {
  it('SM-01: STATES enum has 7 members (AC-001-01)', () => {
    const { STATES } = getStateMachine();
    const keys = Object.keys(STATES);
    assert.equal(keys.length, 7);
  });

  it('SM-02: STATES contains exact expected values (AC-001-01)', () => {
    const { STATES } = getStateMachine();
    assert.equal(STATES.IDLE, 'IDLE');
    assert.equal(STATES.PRESENTING_REQUIREMENTS, 'PRESENTING_REQUIREMENTS');
    assert.equal(STATES.PRESENTING_ARCHITECTURE, 'PRESENTING_ARCHITECTURE');
    assert.equal(STATES.PRESENTING_DESIGN, 'PRESENTING_DESIGN');
    assert.equal(STATES.AMENDING, 'AMENDING');
    assert.equal(STATES.FINALIZING, 'FINALIZING');
    assert.equal(STATES.COMPLETE, 'COMPLETE');
  });

  it('SM-03: STATES is frozen (AC-001-02)', () => {
    const { STATES } = getStateMachine();
    assert.ok(Object.isFrozen(STATES));
  });

  it('SM-04: EVENTS enum has 3 members (AC-001-02)', () => {
    const { EVENTS } = getStateMachine();
    const keys = Object.keys(EVENTS);
    assert.equal(keys.length, 3);
  });

  it('SM-05: EVENTS contains accept, amend, finalize_complete (AC-001-02)', () => {
    const { EVENTS } = getStateMachine();
    assert.equal(EVENTS.ACCEPT, 'accept');
    assert.equal(EVENTS.AMEND, 'amend');
    assert.equal(EVENTS.FINALIZE_COMPLETE, 'finalize_complete');
  });

  it('SM-06: EVENTS is frozen', () => {
    const { EVENTS } = getStateMachine();
    assert.ok(Object.isFrozen(EVENTS));
  });
});

// ---------------------------------------------------------------------------
// FR-002: Transitions (AC-002-01..03)
// ---------------------------------------------------------------------------

describe('FR-002: Transitions', () => {
  it('SM-07: IDLE + accept -> PRESENTING_REQUIREMENTS (AC-002-01)', () => {
    assert.equal(getTransition('IDLE', 'accept'), 'PRESENTING_REQUIREMENTS');
  });

  it('SM-08: PRESENTING_REQUIREMENTS + accept -> PRESENTING_ARCHITECTURE', () => {
    assert.equal(getTransition('PRESENTING_REQUIREMENTS', 'accept'), 'PRESENTING_ARCHITECTURE');
  });

  it('SM-09: PRESENTING_ARCHITECTURE + accept -> PRESENTING_DESIGN', () => {
    assert.equal(getTransition('PRESENTING_ARCHITECTURE', 'accept'), 'PRESENTING_DESIGN');
  });

  it('SM-10: PRESENTING_DESIGN + accept -> FINALIZING', () => {
    assert.equal(getTransition('PRESENTING_DESIGN', 'accept'), 'FINALIZING');
  });

  it('SM-11: any PRESENTING + amend -> AMENDING (AC-002-01)', () => {
    assert.equal(getTransition('PRESENTING_REQUIREMENTS', 'amend'), 'AMENDING');
    assert.equal(getTransition('PRESENTING_ARCHITECTURE', 'amend'), 'AMENDING');
    assert.equal(getTransition('PRESENTING_DESIGN', 'amend'), 'AMENDING');
  });

  it('SM-12: AMENDING + accept -> null (runtime-resolved) (AC-002-01)', () => {
    assert.equal(getTransition('AMENDING', 'accept'), null);
  });

  it('SM-13: FINALIZING + finalize_complete -> COMPLETE (AC-002-01)', () => {
    assert.equal(getTransition('FINALIZING', 'finalize_complete'), 'COMPLETE');
  });

  it('SM-14: invalid state/event pair returns null (AC-002-03)', () => {
    assert.equal(getTransition('COMPLETE', 'accept'), null);
    assert.equal(getTransition('IDLE', 'amend'), null);
    assert.equal(getTransition('NONEXISTENT', 'accept'), null);
  });

  it('SM-15: transition table is frozen (AC-002-01)', () => {
    const { transitionTable } = getStateMachine();
    assert.ok(Object.isFrozen(transitionTable));
  });
});

// ---------------------------------------------------------------------------
// FR-003: Tier-Dependent Paths (AC-003-01..03)
// ---------------------------------------------------------------------------

describe('FR-003: Tier Paths', () => {
  it('SM-16: standard tier has 3 domains (AC-003-01)', () => {
    const path = getTierPath('standard');
    assert.deepEqual(path, [
      'PRESENTING_REQUIREMENTS', 'PRESENTING_ARCHITECTURE', 'PRESENTING_DESIGN'
    ]);
  });

  it('SM-17: light tier has 2 domains (AC-003-02)', () => {
    const path = getTierPath('light');
    assert.deepEqual(path, ['PRESENTING_REQUIREMENTS', 'PRESENTING_DESIGN']);
  });

  it('SM-18: trivial tier has 1 entry (AC-003-03)', () => {
    const path = getTierPath('trivial');
    assert.deepEqual(path, ['FINALIZING']);
  });

  it('SM-19: unknown tier returns null', () => {
    assert.equal(getTierPath('nonexistent'), null);
  });

  it('SM-20: tier paths are frozen', () => {
    const standard = getTierPath('standard');
    const light = getTierPath('light');
    const trivial = getTierPath('trivial');
    assert.ok(Object.isFrozen(standard));
    assert.ok(Object.isFrozen(light));
    assert.ok(Object.isFrozen(trivial));
  });
});
