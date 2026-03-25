/**
 * Integration tests for applyVerbGuard in src/providers/codex/runtime.js
 * REQ-0139 FR-003/FR-004/FR-007: Runtime Guard Enforcement
 *
 * Tests applyVerbGuard() end-to-end: config reading, verb resolution,
 * preamble generation, and return shape.
 *
 * Test ID prefix: RVG-
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { applyVerbGuard } from '../../../src/providers/codex/runtime.js';

// ---------------------------------------------------------------------------
// Helpers — Config and State fixtures
// ---------------------------------------------------------------------------

/** Config with verb_routing: "runtime" */
const runtimeConfig = { verb_routing: 'runtime' };

/** Config with verb_routing: "prompt" */
const promptConfig = { verb_routing: 'prompt' };

/** Config with no verb_routing key */
const noVerbRoutingConfig = {};

/** State with active workflow */
const activeWorkflowState = {
  active_workflow: {
    type: 'feature',
    description: 'REQ-0139',
    current_phase: '06-implementation'
  }
};

/** State with no active workflow */
const noActiveWorkflowState = { active_workflow: null };

// ---------------------------------------------------------------------------
// applyVerbGuard — Runtime Mode (FR-003)
// ---------------------------------------------------------------------------

describe('applyVerbGuard — Runtime Mode (REQ-0139 FR-003/FR-007)', () => {
  // RVG-01: runtime mode + verb detected → preamble in modifiedPrompt
  it('RVG-01: runtime mode + verb detected → modifiedPrompt contains RESERVED_VERB_ROUTING preamble (AC-007-01)', () => {
    const { modifiedPrompt, verbResult } = applyVerbGuard('analyze it', runtimeConfig, noActiveWorkflowState);
    assert.ok(modifiedPrompt.includes('RESERVED_VERB_ROUTING:'), 'Should contain preamble header');
    assert.ok(modifiedPrompt.includes('analyze it'), 'Should still contain original prompt');
    assert.strictEqual(verbResult.detected, true);
    assert.strictEqual(verbResult.verb, 'analyze');
  });

  // RVG-02: preamble has all required fields
  it('RVG-02: preamble has detected, verb, command, confirmation_required fields (AC-003-02)', () => {
    const { modifiedPrompt } = applyVerbGuard('build this', runtimeConfig, noActiveWorkflowState);
    assert.ok(modifiedPrompt.includes('detected: true'), 'Preamble should have detected field');
    assert.ok(modifiedPrompt.includes('verb: "build"'), 'Preamble should have verb field');
    assert.ok(modifiedPrompt.includes('command: "/isdlc build"'), 'Preamble should have command field');
    assert.ok(modifiedPrompt.includes('confirmation_required: true'), 'Preamble should have confirmation_required field');
  });

  // RVG-03: prompt mode → unmodified
  it('RVG-03: prompt mode → modifiedPrompt === original prompt (AC-007-02)', () => {
    const prompt = 'analyze it';
    const { modifiedPrompt, verbResult } = applyVerbGuard(prompt, promptConfig, noActiveWorkflowState);
    assert.strictEqual(modifiedPrompt, prompt);
    assert.strictEqual(verbResult.detected, false);
  });

  // RVG-04: missing verb_routing config → defaults to prompt mode
  it('RVG-04: missing verb_routing config → defaults to prompt mode (AC-004-03)', () => {
    const prompt = 'build something';
    const { modifiedPrompt, verbResult } = applyVerbGuard(prompt, noVerbRoutingConfig, noActiveWorkflowState);
    assert.strictEqual(modifiedPrompt, prompt);
    assert.strictEqual(verbResult.detected, false);
  });

  // RVG-05: runtime mode + no verb detected → unmodified
  it('RVG-05: runtime mode + no verb detected → modifiedPrompt === original (AC-003-03)', () => {
    const prompt = 'hello world';
    const { modifiedPrompt, verbResult } = applyVerbGuard(prompt, runtimeConfig, noActiveWorkflowState);
    assert.strictEqual(modifiedPrompt, prompt);
    assert.strictEqual(verbResult.detected, false);
  });

  // RVG-06: runtime mode + active workflow → preamble includes blocked_by
  it('RVG-06: runtime mode + active workflow → preamble includes blocked_by (AC-003-02)', () => {
    const { modifiedPrompt, verbResult } = applyVerbGuard('build it', runtimeConfig, activeWorkflowState);
    assert.ok(modifiedPrompt.includes('blocked_by: "active_workflow"'), 'Preamble should have blocked_by field');
    assert.strictEqual(verbResult.detected, true);
    assert.strictEqual(verbResult.blocked_by, 'active_workflow');
  });

  // RVG-07: runtime mode + ambiguous prompt → preamble includes ambiguity
  it('RVG-07: runtime mode + ambiguous prompt → preamble includes ambiguity (AC-003-02)', () => {
    const { modifiedPrompt, verbResult } = applyVerbGuard('add and analyze this', runtimeConfig, noActiveWorkflowState);
    assert.ok(modifiedPrompt.includes('ambiguity: true'), 'Preamble should have ambiguity field');
    assert.strictEqual(verbResult.ambiguity, true);
  });

  // RVG-08: runtime mode + excluded prompt → no preamble
  it('RVG-08: runtime mode + excluded prompt → no preamble added (AC-003-03)', () => {
    const prompt = 'explain this code';
    const { modifiedPrompt } = applyVerbGuard(prompt, runtimeConfig, noActiveWorkflowState);
    assert.strictEqual(modifiedPrompt, prompt);
  });

  // RVG-09: runtime mode + slash command → no preamble
  it('RVG-09: runtime mode + slash command → no preamble added (AC-003-03)', () => {
    const prompt = '/isdlc analyze something';
    const { modifiedPrompt } = applyVerbGuard(prompt, runtimeConfig, noActiveWorkflowState);
    assert.strictEqual(modifiedPrompt, prompt);
  });

  // RVG-10: runtime mode + empty prompt → no preamble
  it('RVG-10: runtime mode + empty prompt → no preamble added (AC-003-03)', () => {
    const prompt = '';
    const { modifiedPrompt } = applyVerbGuard(prompt, runtimeConfig, noActiveWorkflowState);
    assert.strictEqual(modifiedPrompt, prompt);
  });

  // RVG-11: confirmation_required is always true
  it('RVG-11: preamble confirmation_required is always true (AC-003-04)', () => {
    const { modifiedPrompt } = applyVerbGuard('build it', runtimeConfig, noActiveWorkflowState);
    assert.ok(modifiedPrompt.includes('confirmation_required: true'));
  });

  // RVG-12: return value shape
  it('RVG-12: return value is { modifiedPrompt, verbResult } shape (AC-003-01)', () => {
    const result = applyVerbGuard('analyze it', runtimeConfig, noActiveWorkflowState);
    assert.ok('modifiedPrompt' in result, 'Should have modifiedPrompt');
    assert.ok('verbResult' in result, 'Should have verbResult');
    assert.strictEqual(typeof result.modifiedPrompt, 'string');
    assert.strictEqual(typeof result.verbResult, 'object');
  });
});
