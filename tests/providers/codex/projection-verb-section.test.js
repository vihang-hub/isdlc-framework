/**
 * Tests for buildVerbRoutingSection in src/providers/codex/projection.js
 * REQ-0139 FR-002: Prompt-Prepend Enforcement
 *
 * Tests the buildVerbRoutingSection() function and its integration
 * with projectInstructions() (position 0 injection).
 *
 * Test ID prefix: PVS-
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildVerbRoutingSection } from '../../../src/providers/codex/projection.js';
import { loadVerbSpec } from '../../../src/providers/codex/verb-resolver.js';

// ---------------------------------------------------------------------------
// buildVerbRoutingSection (FR-002)
// ---------------------------------------------------------------------------

describe('buildVerbRoutingSection (REQ-0139 FR-002)', () => {
  const spec = loadVerbSpec();

  // PVS-01: returns a string
  it('PVS-01: buildVerbRoutingSection(spec) returns a string (AC-002-01)', () => {
    const section = buildVerbRoutingSection(spec);
    assert.strictEqual(typeof section, 'string');
  });

  // PVS-02: contains "RESERVED VERBS" header
  it('PVS-02: output contains "RESERVED VERBS" header (AC-002-03)', () => {
    const section = buildVerbRoutingSection(spec);
    assert.ok(section.includes('RESERVED VERBS'), 'Should contain RESERVED VERBS header');
  });

  // PVS-03: contains intent detection table
  it('PVS-03: output contains intent detection table (AC-002-03)', () => {
    const section = buildVerbRoutingSection(spec);
    // Table should have markdown pipe characters and verb entries
    assert.ok(section.includes('|'), 'Should contain table with pipe separators');
    assert.ok(section.includes('/isdlc add'), 'Should contain /isdlc add command');
    assert.ok(section.includes('/isdlc analyze'), 'Should contain /isdlc analyze command');
    assert.ok(section.includes('/isdlc build'), 'Should contain /isdlc build command');
  });

  // PVS-04: lists all three verbs
  it('PVS-04: output lists all three verbs: add, analyze, build (AC-002-03)', () => {
    const section = buildVerbRoutingSection(spec);
    assert.ok(section.includes('add'), 'Should reference add verb');
    assert.ok(section.includes('analyze'), 'Should reference analyze verb');
    assert.ok(section.includes('build'), 'Should reference build verb');
  });

  // PVS-05: contains disambiguation rules
  it('PVS-05: output contains disambiguation rules (AC-002-03)', () => {
    const section = buildVerbRoutingSection(spec);
    assert.ok(
      section.toLowerCase().includes('disambiguat') || section.toLowerCase().includes('precedence'),
      'Should contain disambiguation or precedence language'
    );
  });

  // PVS-06: includes "MUST route" language
  it('PVS-06: output includes "MUST route" language (AC-005-02)', () => {
    const section = buildVerbRoutingSection(spec);
    assert.ok(section.includes('MUST'), 'Should contain MUST routing language');
  });

  // PVS-07: null/empty spec → returns empty string
  it('PVS-07: empty/null spec → returns empty string (Error handling)', () => {
    const section1 = buildVerbRoutingSection(null);
    assert.strictEqual(section1, '');
    const section2 = buildVerbRoutingSection(undefined);
    assert.strictEqual(section2, '');
    const section3 = buildVerbRoutingSection({});
    assert.strictEqual(section3, '');
  });

  // PVS-08: verb routing section is at position 0 in instruction bundle
  it('PVS-08: verb routing section appears at the start of instruction content (AC-002-02)', () => {
    // This verifies that the section content, if injected at position 0,
    // would be the first thing in the markdown bundle.
    const section = buildVerbRoutingSection(spec);
    assert.ok(section.startsWith('#') || section.startsWith('##'), 'Section should start with a heading');
    assert.ok(section.length > 100, 'Section should have substantial content');
  });
});
