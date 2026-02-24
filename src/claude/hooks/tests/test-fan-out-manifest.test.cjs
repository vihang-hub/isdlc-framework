'use strict';

/**
 * Fan-Out Manifest Tests (test-fan-out-manifest.test.cjs)
 * ========================================================
 * Validates that skills-manifest.json has QL-012 skill registered correctly.
 *
 * Traces: FR-001 (AC-001-04)
 * Test count: 6 (TC-M01 through TC-M06)
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const MANIFEST_PATH = path.resolve(__dirname, '..', 'config', 'skills-manifest.json');

// ---------------------------------------------------------------------------
// Load manifest once
// ---------------------------------------------------------------------------
let manifest;

before(() => {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
});

// ---------------------------------------------------------------------------
// TC-M01: QL-012 in quality-loop-engineer skills array
// Requirement: FR-001 (AC-001-04) | Priority: P0
// ---------------------------------------------------------------------------
describe('Fan-Out Manifest: QL-012 registration', () => {

  it('TC-M01: QL-012 is present in quality-loop-engineer skills array', () => {
    const skills = manifest.ownership['quality-loop-engineer'].skills;
    assert.ok(skills.includes('QL-012'), 'QL-012 should be in the skills array');
  });

  // ---------------------------------------------------------------------------
  // TC-M02: skill_count updated to 12
  // Requirement: FR-001 (AC-001-04) | Priority: P0
  // ---------------------------------------------------------------------------
  it('TC-M02: quality-loop-engineer skill_count is 12', () => {
    assert.equal(
      manifest.ownership['quality-loop-engineer'].skill_count,
      12,
      'skill_count should be 12 (was 11 before QL-012)'
    );
  });

  // ---------------------------------------------------------------------------
  // TC-M03: QL-012 in skill_lookup
  // Requirement: FR-001 (AC-001-04) | Priority: P0
  // ---------------------------------------------------------------------------
  it('TC-M03: QL-012 maps to quality-loop-engineer in skill_lookup', () => {
    assert.equal(
      manifest.skill_lookup['QL-012'],
      'quality-loop-engineer',
      'QL-012 should map to quality-loop-engineer in skill_lookup'
    );
  });

  // ---------------------------------------------------------------------------
  // TC-M04: fan-out-engine in path_lookup
  // Requirement: FR-001 (AC-001-04) | Priority: P0
  // ---------------------------------------------------------------------------
  it('TC-M04: QL-012 (fan-out-engine) maps to quality-loop-engineer in skill_lookup', () => {
    // Updated per REQ-0001 FR-008: path_lookup removed, use skill_lookup instead
    assert.equal(
      manifest.skill_lookup['QL-012'],
      'quality-loop-engineer',
      'QL-012 (fan-out-engine) should map to quality-loop-engineer in skill_lookup'
    );
  });

  // ---------------------------------------------------------------------------
  // TC-M05: total_skills incremented to 246
  // Requirement: FR-001 (AC-001-04) | Priority: P1
  // ---------------------------------------------------------------------------
  it('TC-M05: total_skills is 246', () => {
    assert.equal(
      manifest.total_skills,
      246,
      'total_skills should be 246 (was 243 before REQ-0022 EXT-001/002/003)'
    );
  });

  // ---------------------------------------------------------------------------
  // TC-M06: QL skills array is sequential (QL-001 through QL-012)
  // Requirement: FR-001 (AC-001-04) | Priority: P2
  // ---------------------------------------------------------------------------
  it('TC-M06: QL skills are sequential QL-001 through QL-012 with no gaps', () => {
    const skills = manifest.ownership['quality-loop-engineer'].skills;
    const expected = [];
    for (let i = 1; i <= 12; i++) {
      expected.push('QL-' + String(i).padStart(3, '0'));
    }
    assert.deepStrictEqual(skills, expected, 'Skills should be sequential QL-001 to QL-012');
  });

});
