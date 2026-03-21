/**
 * Integration / Parity tests for the Implementation Loop
 *
 * Full loop simulation exercising the entire Writer/Reviewer/Updater sequence
 * against fixture data. Validates that extracted core logic produces identical
 * state transitions as the current inline implementation.
 *
 * Requirements: FR-005 (AC-005-02, AC-005-03), FR-001 (AC-001-02),
 *               FR-002 (AC-002-01), FR-003 (AC-003-01), FR-004 (AC-004-02)
 *
 * 8 test cases (PT-01 through PT-08).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

import { ImplementationLoop } from '../../../src/core/teams/implementation-loop.js';
import { readState, writeState } from '../../../src/core/state/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', 'fixtures');
const parityDir = join(fixturesDir, 'parity-sequences');

// Load fixtures
const teamSpec = JSON.parse(readFileSync(join(fixturesDir, 'sample-team-spec.json'), 'utf-8'));
const allPassSeq = JSON.parse(readFileSync(join(parityDir, 'all-pass.json'), 'utf-8'));
const reviseSeq = JSON.parse(readFileSync(join(parityDir, 'revise-then-pass.json'), 'utf-8'));
const maxCyclesSeq = JSON.parse(readFileSync(join(parityDir, 'max-cycles-fail.json'), 'utf-8'));

// Load contract schemas for validation
const writerSchema = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'src', 'core', 'teams', 'contracts', 'writer-context.json'), 'utf-8'));
const reviewSchema = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'src', 'core', 'teams', 'contracts', 'review-context.json'), 'utf-8'));

// Minimal schema validator (same as in contracts.test.js)
function validateAgainstSchema(schema, data) {
  const errors = [];
  if (schema.type === 'object' && typeof data !== 'object') {
    errors.push(`Expected object, got ${typeof data}`);
    return { valid: false, errors };
  }
  if (schema.required) {
    for (const field of schema.required) {
      if (data[field] === undefined) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }
  if (schema.properties && typeof data === 'object') {
    for (const [key, constraint] of Object.entries(schema.properties)) {
      if (data[key] === undefined) continue;
      if (constraint.const !== undefined && data[key] !== constraint.const) {
        errors.push(`Field ${key}: expected const "${constraint.const}", got "${data[key]}"`);
      }
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

// Helper: temp project for state persistence tests
function createTempProject() {
  const dir = mkdtempSync(join(tmpdir(), 'isdlc-parity-'));
  mkdirSync(join(dir, '.isdlc'), { recursive: true });
  return dir;
}

function cleanupTemp(dir) {
  if (dir && existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// PT-01: 3-file loop with all PASS on first review cycle
// ---------------------------------------------------------------------------

describe('Parity: full loop simulations', () => {
  it('PT-01: 3-file loop with all PASS on first review cycle', () => {
    const loop = new ImplementationLoop(teamSpec);
    let state = loop.initFromPlan(allPassSeq.files);

    for (const verdict of allPassSeq.verdicts_sequence) {
      const fileInfo = loop.computeNextFile(state);
      assert.ok(fileInfo, 'Should have a next file');

      // Set cycle for the file
      const filePath = fileInfo.file_path;
      if (!state.cycle_per_file[filePath]) {
        state.cycle_per_file[filePath] = 1;
      }

      const result = loop.processVerdict(state, verdict);
      state = result.loopState;
    }

    assert.ok(loop.isComplete(state), 'Loop should be complete');
    assert.deepStrictEqual(
      state.completed_files,
      allPassSeq.expected_completed_files
    );
  });

  // PT-02: Loop with REVISE then PASS (updater cycle)
  it('PT-02: loop with REVISE then PASS (updater cycle)', () => {
    const loop = new ImplementationLoop(teamSpec);
    let state = loop.initFromPlan(reviseSeq.files);

    // First file: REVISE
    const file1 = loop.computeNextFile(state);
    state.cycle_per_file[file1.file_path] = 1;
    let result = loop.processVerdict(state, 'REVISE');
    assert.equal(result.action, 'update');
    state = result.loopState;

    // First file: PASS after update
    state.cycle_per_file[file1.file_path] = state.cycle_per_file[file1.file_path]; // already incremented
    result = loop.processVerdict(state, 'PASS');
    assert.equal(result.action, 'next_file');
    state = result.loopState;

    // Second file: PASS
    const file2 = loop.computeNextFile(state);
    state.cycle_per_file[file2.file_path] = 1;
    result = loop.processVerdict(state, 'PASS');
    assert.equal(result.action, 'complete');
    state = result.loopState;

    assert.ok(loop.isComplete(state));
    assert.deepStrictEqual(state.completed_files, reviseSeq.expected_completed_files);
  });

  // PT-03: Loop with max cycles exhausted on one file (fail action)
  it('PT-03: max cycles exhausted returns fail action', () => {
    const loop = new ImplementationLoop(teamSpec);
    let state = loop.initFromPlan(maxCyclesSeq.files);

    const file = loop.computeNextFile(state);
    state.cycle_per_file[file.file_path] = 1;

    // Cycle 1: REVISE
    let result = loop.processVerdict(state, 'REVISE');
    assert.equal(result.action, 'update');
    state = result.loopState;

    // Cycle 2: REVISE
    result = loop.processVerdict(state, 'REVISE');
    assert.equal(result.action, 'update');
    state = result.loopState;

    // Cycle 3 (max): REVISE -> fail
    result = loop.processVerdict(state, 'REVISE');
    assert.equal(result.action, 'fail');

    assert.equal(loop.isComplete(state), false);
    assert.deepStrictEqual(state.completed_files, []);
  });

  // PT-04: TDD ordering: test written before source, reviewed in order
  it('PT-04: TDD ordering places test files before source files', () => {
    const loop = new ImplementationLoop(teamSpec);
    const files = [
      { path: 'src/auth.js', type: 'source', order: 1 },
      { path: 'tests/auth.test.js', type: 'test', order: 2 },
      { path: 'src/db.js', type: 'source', order: 3 },
      { path: 'tests/db.test.js', type: 'test', order: 4 }
    ];
    const state = loop.initFromPlan(files, { tdd_ordering: true });

    // Walk through all files and verify test comes before source
    const order = state.files.map(f => f.type);
    assert.deepStrictEqual(order, ['test', 'source', 'test', 'source']);
  });
});

// ---------------------------------------------------------------------------
// PT-05: State persistence round-trip
// ---------------------------------------------------------------------------

describe('Parity: state persistence', () => {
  let tempDir;
  after(() => cleanupTemp(tempDir));

  it('PT-05: state round-trip (write state, read, resume loop)', async () => {
    tempDir = createTempProject();

    const loop = new ImplementationLoop(teamSpec);
    let state = loop.initFromPlan(allPassSeq.files);

    // Process first file
    const file1 = loop.computeNextFile(state);
    state.cycle_per_file[file1.file_path] = 1;
    const result = loop.processVerdict(state, 'PASS');
    state = result.loopState;

    // Persist
    await writeState(tempDir, { loop_state: state });

    // Read back
    const persisted = await readState(tempDir);
    const resumedState = persisted.loop_state;

    // Resume loop from persisted state
    const loop2 = new ImplementationLoop(teamSpec);
    const nextFile = loop2.computeNextFile(resumedState);
    assert.ok(nextFile, 'Should have next file after resuming');
    assert.equal(nextFile.file_number, 2, 'Should be on file 2');
    assert.equal(resumedState.completed_files.length, 1);
  });
});

// ---------------------------------------------------------------------------
// PT-06: CJS bridge produces identical results to ESM direct import
// ---------------------------------------------------------------------------

describe('Parity: CJS bridge', () => {
  let tempDir;
  after(() => cleanupTemp(tempDir));

  it('PT-06: CJS bridge produces identical results to ESM direct', async () => {
    // Import CJS bridge
    const teamsBridge = await import('../../../src/core/bridge/teams.cjs');
    const stateBridge = await import('../../../src/core/bridge/state.cjs');

    // Create loop via bridge
    const bridgeLoop = await teamsBridge.default.createImplementationLoop(teamSpec);
    const bridgeState = bridgeLoop.initFromPlan(allPassSeq.files);

    // Create loop via ESM direct
    const directLoop = new ImplementationLoop(teamSpec);
    const directState = directLoop.initFromPlan(allPassSeq.files);

    // Compare states
    assert.deepStrictEqual(bridgeState, directState);

    // Compare computeNextFile
    const bridgeNext = bridgeLoop.computeNextFile(bridgeState);
    const directNext = directLoop.computeNextFile(directState);
    assert.deepStrictEqual(bridgeNext, directNext);

    // Test state bridge
    tempDir = createTempProject();
    await stateBridge.default.writeState(tempDir, { test: 'bridge' });
    const readBack = await stateBridge.default.readState(tempDir);
    assert.deepStrictEqual(readBack, { test: 'bridge' });
  });
});

// ---------------------------------------------------------------------------
// PT-07: Contract shapes from buildWriterContext validate against schema
// ---------------------------------------------------------------------------

describe('Parity: contract schema validation', () => {
  it('PT-07: buildWriterContext output validates against writer-context schema', () => {
    const loop = new ImplementationLoop(teamSpec);
    const state = loop.initFromPlan(allPassSeq.files);
    const fileInfo = loop.computeNextFile(state);

    const ctx = loop.buildWriterContext(state, fileInfo);
    const result = validateAgainstSchema(writerSchema, ctx);
    assert.ok(result.valid, `Writer context should validate: ${result.errors.join(', ')}`);
  });

  // PT-08: Contract shapes from buildReviewContext validate against schema
  it('PT-08: buildReviewContext output validates against review-context schema', () => {
    const loop = new ImplementationLoop(teamSpec);
    const state = loop.initFromPlan(allPassSeq.files);
    const fileInfo = loop.computeNextFile(state);

    const ctx = loop.buildReviewContext(state, fileInfo, 1);
    const result = validateAgainstSchema(reviewSchema, ctx);
    assert.ok(result.valid, `Review context should validate: ${result.errors.join(', ')}`);
  });
});
