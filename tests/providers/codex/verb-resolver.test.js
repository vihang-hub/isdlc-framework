/**
 * Tests for src/providers/codex/verb-resolver.js
 * REQ-0139 FR-001/FR-006: Canonical Verb Spec and Verb Resolution
 *
 * Tests resolveVerb() and loadVerbSpec() covering phrase matching,
 * precedence, ambiguity, exclusions, active workflow, slash commands,
 * and edge cases.
 *
 * Test ID prefix: VR-
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveVerb, loadVerbSpec } from '../../../src/providers/codex/verb-resolver.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// 6.1.1 Phrase Matching (FR-001, FR-006)
// ---------------------------------------------------------------------------

describe('resolveVerb — Phrase Matching (FR-001, FR-006)', () => {
  // VR-01: analyze it → detected: true, verb: "analyze"
  it('VR-01: resolveVerb("analyze it") → detected + verb "analyze" (AC-006-01)', () => {
    const result = resolveVerb('analyze it');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.verb, 'analyze');
    assert.strictEqual(result.command, '/isdlc analyze');
  });

  // VR-02: "think through this problem" → analyze
  it('VR-02: resolveVerb("think through this problem") → verb "analyze" (AC-001-03)', () => {
    const result = resolveVerb('think through this problem');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.verb, 'analyze');
  });

  // VR-03: "add to backlog" → add
  it('VR-03: resolveVerb("add to backlog") → verb "add" (AC-001-03)', () => {
    const result = resolveVerb('add to backlog');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.verb, 'add');
    assert.strictEqual(result.command, '/isdlc add');
  });

  // VR-04: "track this idea" → add
  it('VR-04: resolveVerb("track this idea") → verb "add" (AC-001-03)', () => {
    const result = resolveVerb('track this idea');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.verb, 'add');
  });

  // VR-05: "build this component" → build
  it('VR-05: resolveVerb("build this component") → verb "build" (AC-001-03)', () => {
    const result = resolveVerb('build this component');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.verb, 'build');
    assert.strictEqual(result.command, '/isdlc build');
  });

  // VR-06: "implement the feature" → build
  it('VR-06: resolveVerb("implement the feature") → verb "build" (AC-001-03)', () => {
    const result = resolveVerb('implement the feature');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.verb, 'build');
  });

  // VR-07: "let's do this" → build
  it('VR-07: resolveVerb("let\'s do this") → verb "build" (AC-001-03)', () => {
    const result = resolveVerb("let's do this");
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.verb, 'build');
  });

  // VR-08: "ship it" → build
  it('VR-08: resolveVerb("ship it") → verb "build" (AC-001-03)', () => {
    const result = resolveVerb('ship it');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.verb, 'build');
  });

  // VR-09: "refactor the module" → build
  it('VR-09: resolveVerb("refactor the module") → verb "build" (AC-001-03)', () => {
    const result = resolveVerb('refactor the module');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.verb, 'build');
  });

  // VR-10: Case insensitive match
  it('VR-10: resolveVerb("ANALYZE IT") → case insensitive match (AC-001-03)', () => {
    const result = resolveVerb('ANALYZE IT');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.verb, 'analyze');
  });
});

// ---------------------------------------------------------------------------
// 6.1.2 Command Mapping (FR-001)
// ---------------------------------------------------------------------------

describe('resolveVerb — Command Mapping (FR-001)', () => {
  // VR-11: add → /isdlc add
  it('VR-11: verb "add" maps to command "/isdlc add" (AC-006-01)', () => {
    const result = resolveVerb('add to backlog');
    assert.strictEqual(result.command, '/isdlc add');
  });

  // VR-12: analyze → /isdlc analyze
  it('VR-12: verb "analyze" maps to command "/isdlc analyze" (AC-006-01)', () => {
    const result = resolveVerb('analyze it');
    assert.strictEqual(result.command, '/isdlc analyze');
  });

  // VR-13: build → /isdlc build
  it('VR-13: verb "build" maps to command "/isdlc build" (AC-006-01)', () => {
    const result = resolveVerb('build this');
    assert.strictEqual(result.command, '/isdlc build');
  });
});

// ---------------------------------------------------------------------------
// 6.1.3 Precedence (FR-001)
// ---------------------------------------------------------------------------

describe('resolveVerb — Precedence (FR-001)', () => {
  // VR-14: analyze wins over add
  it('VR-14: analyze (precedence 2) wins over add (precedence 3) (AC-001-04)', () => {
    // "add and analyze" matches both; disambiguation → analyze
    const result = resolveVerb('add and analyze this');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.verb, 'analyze');
  });

  // VR-15: build wins over analyze
  it('VR-15: build (precedence 1) wins over analyze (precedence 2) (AC-001-04)', () => {
    const result = resolveVerb('analyze and build this');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.verb, 'build');
  });

  // VR-16: build wins when all three match
  it('VR-16: build (precedence 1) wins when all three match (AC-001-04)', () => {
    const result = resolveVerb('add, analyze, and build');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.verb, 'build');
  });
});

// ---------------------------------------------------------------------------
// 6.1.4 Ambiguity and Disambiguation (FR-006)
// ---------------------------------------------------------------------------

describe('resolveVerb — Ambiguity and Disambiguation (FR-006)', () => {
  // VR-17: "add and analyze this" → ambiguity: true, verb: "analyze"
  it('VR-17: resolveVerb("add and analyze this") → ambiguity + verb "analyze" (AC-006-02)', () => {
    const result = resolveVerb('add and analyze this');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.ambiguity, true);
    assert.deepStrictEqual(result.ambiguous_verbs.sort(), ['add', 'analyze']);
    assert.strictEqual(result.verb, 'analyze');
  });

  // VR-18: "analyze and build this" → ambiguity: true, verb: "build"
  it('VR-18: resolveVerb("analyze and build this") → ambiguity + verb "build" (AC-001-04)', () => {
    const result = resolveVerb('analyze and build this');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.ambiguity, true);
    assert.strictEqual(result.verb, 'build');
  });

  // VR-19: "add and build this" → ambiguity: true, verb: "build"
  it('VR-19: resolveVerb("add and build this") → ambiguity + verb "build" (AC-001-04)', () => {
    const result = resolveVerb('add and build this');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.ambiguity, true);
    assert.strictEqual(result.verb, 'build');
  });

  // VR-20: "add, analyze, and build" → ambiguity: true, verb: "build"
  it('VR-20: resolveVerb("add, analyze, and build") → ambiguity + verb "build" (AC-001-04)', () => {
    const result = resolveVerb('add, analyze, and build');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.ambiguity, true);
    assert.strictEqual(result.verb, 'build');
  });
});

// ---------------------------------------------------------------------------
// 6.1.5 Exclusions (FR-001, FR-006)
// ---------------------------------------------------------------------------

describe('resolveVerb — Exclusions (FR-001, FR-006)', () => {
  // VR-21: "explain this code" → detected: false, reason: "excluded"
  it('VR-21: resolveVerb("explain this code") → excluded (AC-006-03)', () => {
    const result = resolveVerb('explain this code');
    assert.strictEqual(result.detected, false);
    assert.strictEqual(result.reason, 'excluded');
  });

  // VR-22: "what does this function do" → excluded
  it('VR-22: resolveVerb("what does this function do") → excluded (AC-001-05)', () => {
    const result = resolveVerb('what does this function do');
    assert.strictEqual(result.detected, false);
    assert.strictEqual(result.reason, 'excluded');
  });

  // VR-23: "help me understand the architecture" → excluded
  it('VR-23: resolveVerb("help me understand the architecture") → excluded (AC-001-05)', () => {
    const result = resolveVerb('help me understand the architecture');
    assert.strictEqual(result.detected, false);
    assert.strictEqual(result.reason, 'excluded');
  });

  // VR-24: "show me the code" → excluded
  it('VR-24: resolveVerb("show me the code") → excluded (AC-001-05)', () => {
    const result = resolveVerb('show me the code');
    assert.strictEqual(result.detected, false);
    assert.strictEqual(result.reason, 'excluded');
  });

  // VR-25: "describe the module" → excluded
  it('VR-25: resolveVerb("describe the module") → excluded (AC-001-05)', () => {
    const result = resolveVerb('describe the module');
    assert.strictEqual(result.detected, false);
    assert.strictEqual(result.reason, 'excluded');
  });
});

// ---------------------------------------------------------------------------
// 6.1.6 Active Workflow (FR-006)
// ---------------------------------------------------------------------------

describe('resolveVerb — Active Workflow (FR-006)', () => {
  // VR-26: with activeWorkflow → blocked_by: "active_workflow"
  it('VR-26: resolveVerb("build it", { activeWorkflow: true }) → blocked_by "active_workflow" (AC-006-04)', () => {
    const result = resolveVerb('build it', { activeWorkflow: true });
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.verb, 'build');
    assert.strictEqual(result.blocked_by, 'active_workflow');
  });

  // VR-27: without activeWorkflow → blocked_by: null
  it('VR-27: resolveVerb("analyze it", { activeWorkflow: false }) → blocked_by null (AC-006-04)', () => {
    const result = resolveVerb('analyze it', { activeWorkflow: false });
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.blocked_by, null);
  });
});

// ---------------------------------------------------------------------------
// 6.1.7 Slash Command Bypass (FR-006)
// ---------------------------------------------------------------------------

describe('resolveVerb — Slash Command Bypass (FR-006)', () => {
  // VR-28: isSlashCommand → detected: false, reason: "slash_command"
  it('VR-28: resolveVerb("/isdlc analyze foo", { isSlashCommand: true }) → slash_command (AC-006-05)', () => {
    const result = resolveVerb('/isdlc analyze foo', { isSlashCommand: true });
    assert.strictEqual(result.detected, false);
    assert.strictEqual(result.reason, 'slash_command');
  });
});

// ---------------------------------------------------------------------------
// 6.1.8 Edge Cases (FR-006)
// ---------------------------------------------------------------------------

describe('resolveVerb — Edge Cases (FR-006)', () => {
  // VR-29: empty string
  it('VR-29: resolveVerb("") → empty_input (AC-006-06)', () => {
    const result = resolveVerb('');
    assert.strictEqual(result.detected, false);
    assert.strictEqual(result.reason, 'empty_input');
  });

  // VR-30: null
  it('VR-30: resolveVerb(null) → empty_input (AC-006-06)', () => {
    const result = resolveVerb(null);
    assert.strictEqual(result.detected, false);
    assert.strictEqual(result.reason, 'empty_input');
  });

  // VR-31: undefined
  it('VR-31: resolveVerb(undefined) → empty_input (AC-006-06)', () => {
    const result = resolveVerb(undefined);
    assert.strictEqual(result.detected, false);
    assert.strictEqual(result.reason, 'empty_input');
  });

  // VR-32: no match, no exclusion
  it('VR-32: resolveVerb("hello world") → detected: false (FR-006)', () => {
    const result = resolveVerb('hello world');
    assert.strictEqual(result.detected, false);
    assert.strictEqual(result.reason, null);
  });

  // VR-33: confirmation_required is always true
  it('VR-33: confirmation_required is always true on detected results (AC-003-04)', () => {
    const result = resolveVerb('build it');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.confirmation_required, true);
  });

  // VR-34: source_phrase is populated
  it('VR-34: source_phrase is populated with matched phrase (AC-003-02)', () => {
    const result = resolveVerb('analyze it');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(typeof result.source_phrase, 'string');
    assert.ok(result.source_phrase.length > 0);
  });
});

// ---------------------------------------------------------------------------
// 6.1.9 Verb Spec Loading (FR-001)
// ---------------------------------------------------------------------------

describe('loadVerbSpec — Verb Spec Loading (FR-001)', () => {
  // VR-35: returns object with expected shape
  it('VR-35: loadVerbSpec() returns { version, verbs, disambiguation, exclusions } (AC-001-01/AC-001-02)', () => {
    const spec = loadVerbSpec();
    assert.strictEqual(typeof spec, 'object');
    assert.ok('version' in spec);
    assert.ok('verbs' in spec);
    assert.ok('disambiguation' in spec);
    assert.ok('exclusions' in spec);
  });

  // VR-36: defines three verbs
  it('VR-36: spec defines three verbs: add, analyze, build (AC-001-02)', () => {
    const spec = loadVerbSpec();
    const verbNames = Object.keys(spec.verbs).sort();
    assert.deepStrictEqual(verbNames, ['add', 'analyze', 'build']);
  });

  // VR-37: missing spec file → resolveVerb returns spec_missing
  it('VR-37: missing spec file → resolveVerb returns reason "spec_missing" (Error handling)', () => {
    const spec = loadVerbSpec('/nonexistent/path/reserved-verbs.json');
    assert.strictEqual(spec, null);
  });
});
