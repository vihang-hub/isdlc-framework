/**
 * Unit tests for src/core/teams/contracts/ — JSON Schema validation
 *
 * Tests: writer-context.json, review-context.json, update-context.json
 * Requirements: FR-004 (AC-004-01, AC-004-02)
 *
 * Uses a minimal JSON Schema validator (subset) since the project has no
 * external schema validator dependency. We validate structure, required fields,
 * and const/enum constraints.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const contractsDir = join(__dirname, '..', '..', '..', 'src', 'core', 'teams', 'contracts');

// ---------------------------------------------------------------------------
// Load schemas
// ---------------------------------------------------------------------------

let writerSchema, reviewSchema, updateSchema;

before(() => {
  writerSchema = JSON.parse(readFileSync(join(contractsDir, 'writer-context.json'), 'utf-8'));
  reviewSchema = JSON.parse(readFileSync(join(contractsDir, 'review-context.json'), 'utf-8'));
  updateSchema = JSON.parse(readFileSync(join(contractsDir, 'update-context.json'), 'utf-8'));
});

// ---------------------------------------------------------------------------
// Minimal schema validator (validates required, const, type, min/max)
// ---------------------------------------------------------------------------

function validateAgainstSchema(schema, data) {
  const errors = [];

  if (schema.type === 'object' && typeof data !== 'object') {
    errors.push(`Expected object, got ${typeof data}`);
    return { valid: false, errors };
  }

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (data[field] === undefined) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  // Check property constraints
  if (schema.properties && typeof data === 'object') {
    for (const [key, constraint] of Object.entries(schema.properties)) {
      if (data[key] === undefined) continue;

      // const constraint
      if (constraint.const !== undefined && data[key] !== constraint.const) {
        errors.push(`Field ${key}: expected const "${constraint.const}", got "${data[key]}"`);
      }

      // type constraint
      if (constraint.type) {
        const jsType = Array.isArray(data[key]) ? 'array' : typeof data[key];
        if (constraint.type === 'integer') {
          if (typeof data[key] !== 'number' || !Number.isInteger(data[key])) {
            errors.push(`Field ${key}: expected integer, got ${data[key]}`);
          }
        } else if (constraint.type === 'array') {
          if (!Array.isArray(data[key])) {
            errors.push(`Field ${key}: expected array, got ${jsType}`);
          }
        } else if (jsType !== constraint.type) {
          errors.push(`Field ${key}: expected ${constraint.type}, got ${jsType}`);
        }
      }

      // minimum / maximum
      if (constraint.minimum !== undefined && data[key] < constraint.minimum) {
        errors.push(`Field ${key}: value ${data[key]} below minimum ${constraint.minimum}`);
      }
      if (constraint.maximum !== undefined && data[key] > constraint.maximum) {
        errors.push(`Field ${key}: value ${data[key]} above maximum ${constraint.maximum}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// writer-context.json
// ---------------------------------------------------------------------------

describe('writer-context.json schema', () => {
  // CS-01: writer-context.json is valid JSON Schema
  it('CS-01: is valid JSON Schema (has required structure)', () => {
    assert.equal(writerSchema.type, 'object');
    assert.ok(Array.isArray(writerSchema.required), 'required should be an array');
    assert.ok(writerSchema.properties, 'properties should exist');
    assert.ok(writerSchema.required.includes('mode'));
    assert.ok(writerSchema.required.includes('per_file_loop'));
    assert.ok(writerSchema.required.includes('file_number'));
    assert.ok(writerSchema.required.includes('total_files'));
  });

  // CS-02: Valid WRITER_CONTEXT passes schema validation
  it('CS-02: valid WRITER_CONTEXT passes validation', () => {
    const valid = {
      mode: 'writer',
      per_file_loop: true,
      tdd_ordering: true,
      file_number: 1,
      total_files: 5,
      file_path: 'src/widget.js',
      completed_files: []
    };
    const result = validateAgainstSchema(writerSchema, valid);
    assert.ok(result.valid, `Expected valid, got errors: ${result.errors.join(', ')}`);
  });

  // CS-03: WRITER_CONTEXT missing required fields fails validation
  it('CS-03: missing required fields fails validation', () => {
    const invalid = { per_file_loop: true }; // missing mode, file_number, total_files
    const result = validateAgainstSchema(writerSchema, invalid);
    assert.ok(!result.valid, 'Should fail validation');
    assert.ok(result.errors.some(e => e.includes('mode')), 'Should report missing mode');
    assert.ok(result.errors.some(e => e.includes('file_number')), 'Should report missing file_number');
    assert.ok(result.errors.some(e => e.includes('total_files')), 'Should report missing total_files');
  });
});

// ---------------------------------------------------------------------------
// review-context.json
// ---------------------------------------------------------------------------

describe('review-context.json schema', () => {
  // CS-04: review-context.json is valid JSON Schema
  it('CS-04: is valid JSON Schema (has required structure)', () => {
    assert.equal(reviewSchema.type, 'object');
    assert.ok(Array.isArray(reviewSchema.required));
    assert.ok(reviewSchema.properties);
    assert.ok(reviewSchema.required.includes('file_path'));
    assert.ok(reviewSchema.required.includes('file_number'));
    assert.ok(reviewSchema.required.includes('cycle'));
  });

  // CS-05: Valid REVIEW_CONTEXT passes schema validation
  it('CS-05: valid REVIEW_CONTEXT passes validation', () => {
    const valid = {
      file_path: 'src/auth.js',
      file_number: 2,
      cycle: 1,
      tech_stack: 'node',
      constitution_path: 'docs/isdlc/constitution.md'
    };
    const result = validateAgainstSchema(reviewSchema, valid);
    assert.ok(result.valid, `Expected valid, got errors: ${result.errors.join(', ')}`);
  });

  // CS-06: REVIEW_CONTEXT missing required fields fails validation
  it('CS-06: missing required fields fails validation', () => {
    const invalid = { cycle: 1 }; // missing file_path, file_number
    const result = validateAgainstSchema(reviewSchema, invalid);
    assert.ok(!result.valid, 'Should fail validation');
    assert.ok(result.errors.some(e => e.includes('file_path')));
    assert.ok(result.errors.some(e => e.includes('file_number')));
  });

  // CS-07: REVIEW_CONTEXT cycle outside 1-3 range fails validation
  it('CS-07: cycle outside 1-3 range fails validation', () => {
    const tooLow = { file_path: 'a.js', file_number: 1, cycle: 0 };
    const resultLow = validateAgainstSchema(reviewSchema, tooLow);
    assert.ok(!resultLow.valid, 'cycle=0 should fail');
    assert.ok(resultLow.errors.some(e => e.includes('minimum')), 'Should report below minimum');

    const tooHigh = { file_path: 'a.js', file_number: 1, cycle: 4 };
    const resultHigh = validateAgainstSchema(reviewSchema, tooHigh);
    assert.ok(!resultHigh.valid, 'cycle=4 should fail');
    assert.ok(resultHigh.errors.some(e => e.includes('maximum')), 'Should report above maximum');
  });
});

// ---------------------------------------------------------------------------
// update-context.json
// ---------------------------------------------------------------------------

describe('update-context.json schema', () => {
  // CS-08: update-context.json is valid JSON Schema
  it('CS-08: is valid JSON Schema (has required structure)', () => {
    assert.equal(updateSchema.type, 'object');
    assert.ok(Array.isArray(updateSchema.required));
    assert.ok(updateSchema.properties);
    assert.ok(updateSchema.required.includes('file_path'));
    assert.ok(updateSchema.required.includes('cycle'));
    assert.ok(updateSchema.required.includes('reviewer_verdict'));
    assert.ok(updateSchema.required.includes('findings'));
  });

  // CS-09: Valid UPDATE_CONTEXT passes schema validation
  it('CS-09: valid UPDATE_CONTEXT passes validation', () => {
    const valid = {
      file_path: 'src/auth.js',
      cycle: 2,
      reviewer_verdict: 'REVISE',
      findings: {
        blocking: [{ category: 'correctness', description: 'Missing null check' }],
        warning: [{ category: 'style', description: 'Use const' }]
      }
    };
    const result = validateAgainstSchema(updateSchema, valid);
    assert.ok(result.valid, `Expected valid, got errors: ${result.errors.join(', ')}`);
  });

  // CS-10: UPDATE_CONTEXT missing required fields fails validation
  it('CS-10: missing required fields fails validation', () => {
    const invalid = { file_path: 'a.js' }; // missing cycle, reviewer_verdict, findings
    const result = validateAgainstSchema(updateSchema, invalid);
    assert.ok(!result.valid, 'Should fail validation');
    assert.ok(result.errors.some(e => e.includes('cycle')));
    assert.ok(result.errors.some(e => e.includes('reviewer_verdict')));
    assert.ok(result.errors.some(e => e.includes('findings')));
  });

  // CS-11: UPDATE_CONTEXT with non-REVISE verdict fails validation
  it('CS-11: non-REVISE verdict fails validation', () => {
    const invalid = {
      file_path: 'src/auth.js',
      cycle: 1,
      reviewer_verdict: 'PASS', // should be REVISE
      findings: { blocking: [], warning: [] }
    };
    const result = validateAgainstSchema(updateSchema, invalid);
    assert.ok(!result.valid, 'PASS verdict should fail for update-context');
    assert.ok(result.errors.some(e => e.includes('REVISE')), 'Should report expected REVISE');
  });
});
