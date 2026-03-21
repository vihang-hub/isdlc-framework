/**
 * Unit tests for src/core/teams/implementation-loop.js — ImplementationLoop class
 *
 * Tests: constructor, initFromPlan, computeNextFile, buildWriterContext,
 *        buildReviewContext, buildUpdateContext, processVerdict, isComplete, getSummary
 * Requirements: FR-002 (AC-002-01, AC-002-02, AC-002-03), FR-004 (AC-004-01)
 *
 * 26 test cases covering positive, negative, and boundary scenarios.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ImplementationLoop } from '../../../src/core/teams/implementation-loop.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', 'fixtures');

// Load fixtures
const sampleTeamSpec = JSON.parse(readFileSync(join(fixturesDir, 'sample-team-spec.json'), 'utf-8'));

// Helper: create a standard team spec
function makeTeamSpec(overrides = {}) {
  return { ...sampleTeamSpec, ...overrides };
}

// Helper: create a file list for testing
function makeFiles(count = 3, tdd = false) {
  if (tdd) {
    // Test-source pairs
    const files = [];
    for (let i = 0; i < count; i++) {
      files.push({ path: `tests/mod${i}.test.js`, type: 'test', order: i * 2 + 1 });
      files.push({ path: `src/mod${i}.js`, type: 'source', order: i * 2 + 2 });
    }
    return files;
  }
  return Array.from({ length: count }, (_, i) => ({
    path: `src/file${i}.js`,
    type: 'source',
    order: i + 1
  }));
}

// ---------------------------------------------------------------------------
// constructor
// ---------------------------------------------------------------------------

describe('ImplementationLoop constructor', () => {
  // IL-01: constructor accepts teamSpec and optional loopState
  it('IL-01: accepts teamSpec and optional loopState', () => {
    const spec = makeTeamSpec();
    const loop = new ImplementationLoop(spec);
    assert.ok(loop, 'Should create instance');

    // With loopState
    const state = { files: [], current_file_index: 0, cycle_per_file: {}, max_cycles: 3, verdicts: [], completed_files: [], tdd_ordering: false };
    const loop2 = new ImplementationLoop(spec, state);
    assert.ok(loop2, 'Should create instance with loopState');
  });

  // IL-02: constructor rejects invalid teamSpec (missing required fields)
  it('IL-02: rejects invalid teamSpec (missing required fields)', () => {
    assert.throws(
      () => new ImplementationLoop({}),
      (err) => {
        assert.ok(err.message.includes('team_type') || err.message.includes('teamSpec') || err.message.includes('required'),
          `Expected teamSpec validation error, got: ${err.message}`);
        return true;
      }
    );

    assert.throws(
      () => new ImplementationLoop(null),
      (err) => err instanceof Error
    );
  });
});

// ---------------------------------------------------------------------------
// initFromPlan
// ---------------------------------------------------------------------------

describe('ImplementationLoop.initFromPlan()', () => {
  // IL-03: initFromPlan creates LoopState with correct file ordering
  it('IL-03: creates LoopState with correct file ordering', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const files = makeFiles(3);
    const state = loop.initFromPlan(files);

    assert.equal(state.files.length, 3);
    assert.equal(state.current_file_index, 0);
    assert.deepStrictEqual(state.cycle_per_file, {});
    assert.equal(state.max_cycles, 3);
    assert.deepStrictEqual(state.verdicts, []);
    assert.deepStrictEqual(state.completed_files, []);
  });

  // IL-04: initFromPlan applies TDD ordering (test files before source)
  it('IL-04: applies TDD ordering (test files before source)', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    // Give source files first, test files second
    const files = [
      { path: 'src/widget.js', type: 'source', order: 1 },
      { path: 'tests/widget.test.js', type: 'test', order: 2 },
      { path: 'src/helper.js', type: 'source', order: 3 },
      { path: 'tests/helper.test.js', type: 'test', order: 4 }
    ];
    const state = loop.initFromPlan(files, { tdd_ordering: true });

    assert.equal(state.tdd_ordering, true);
    // Test files should come before their corresponding source files
    // Expected: test, source, test, source pairs
    assert.equal(state.files[0].type, 'test', 'First file should be test');
    assert.equal(state.files[1].type, 'source', 'Second file should be source');
    assert.equal(state.files[2].type, 'test', 'Third file should be test');
    assert.equal(state.files[3].type, 'source', 'Fourth file should be source');
  });

  // IL-05: initFromPlan with tdd_ordering=false preserves original order
  it('IL-05: tdd_ordering=false preserves original order', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const files = [
      { path: 'src/a.js', type: 'source', order: 1 },
      { path: 'src/b.js', type: 'source', order: 2 },
      { path: 'tests/a.test.js', type: 'test', order: 3 }
    ];
    const state = loop.initFromPlan(files, { tdd_ordering: false });

    assert.equal(state.tdd_ordering, false);
    assert.equal(state.files[0].path, 'src/a.js');
    assert.equal(state.files[1].path, 'src/b.js');
    assert.equal(state.files[2].path, 'tests/a.test.js');
  });
});

// ---------------------------------------------------------------------------
// computeNextFile
// ---------------------------------------------------------------------------

describe('ImplementationLoop.computeNextFile()', () => {
  // IL-06: computeNextFile returns first file on fresh state
  it('IL-06: returns first file on fresh state', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const state = loop.initFromPlan(makeFiles(3));

    const next = loop.computeNextFile(state);
    assert.ok(next, 'Should return a file');
    assert.equal(next.file_path, 'src/file0.js');
    assert.equal(next.file_number, 1);
    assert.equal(next.total, 3);
  });

  // IL-07: computeNextFile returns null when all files complete
  it('IL-07: returns null when all files complete', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const state = loop.initFromPlan(makeFiles(1));
    // Manually mark all files as completed
    state.current_file_index = 1;
    state.completed_files = ['src/file0.js'];

    const next = loop.computeNextFile(state);
    assert.equal(next, null);
  });

  // IL-08: computeNextFile includes file_number, total, is_test
  it('IL-08: includes file_number, total, is_test fields', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const files = [
      { path: 'tests/widget.test.js', type: 'test', order: 1 },
      { path: 'src/widget.js', type: 'source', order: 2 }
    ];
    const state = loop.initFromPlan(files);

    const next = loop.computeNextFile(state);
    assert.equal(next.file_path, 'tests/widget.test.js');
    assert.equal(next.file_number, 1);
    assert.equal(next.total, 2);
    assert.equal(next.is_test, true);
  });
});

// ---------------------------------------------------------------------------
// buildWriterContext
// ---------------------------------------------------------------------------

describe('ImplementationLoop.buildWriterContext()', () => {
  // IL-09: buildWriterContext produces valid WRITER_CONTEXT shape
  it('IL-09: produces valid WRITER_CONTEXT shape', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const state = loop.initFromPlan(makeFiles(3));
    const fileInfo = loop.computeNextFile(state);

    const ctx = loop.buildWriterContext(state, fileInfo);
    assert.equal(ctx.mode, 'writer');
    assert.equal(typeof ctx.per_file_loop, 'boolean');
    assert.equal(ctx.file_number, 1);
    assert.equal(ctx.total_files, 3);
    assert.equal(ctx.file_path, 'src/file0.js');
  });

  // IL-10: buildWriterContext includes completed_files list
  it('IL-10: includes completed_files list', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const state = loop.initFromPlan(makeFiles(3));
    // Simulate some files already completed
    state.completed_files = ['src/file0.js', 'src/file1.js'];
    state.current_file_index = 2;
    const fileInfo = loop.computeNextFile(state);

    const ctx = loop.buildWriterContext(state, fileInfo);
    assert.deepStrictEqual(ctx.completed_files, ['src/file0.js', 'src/file1.js']);
  });
});

// ---------------------------------------------------------------------------
// buildReviewContext
// ---------------------------------------------------------------------------

describe('ImplementationLoop.buildReviewContext()', () => {
  // IL-11: buildReviewContext produces valid REVIEW_CONTEXT shape
  it('IL-11: produces valid REVIEW_CONTEXT shape', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const state = loop.initFromPlan(makeFiles(2));
    const fileInfo = loop.computeNextFile(state);

    const ctx = loop.buildReviewContext(state, fileInfo, 1);
    assert.equal(ctx.file_path, 'src/file0.js');
    assert.equal(ctx.file_number, 1);
    assert.equal(ctx.cycle, 1);
  });

  // IL-12: buildReviewContext includes cycle count
  it('IL-12: includes cycle count', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const state = loop.initFromPlan(makeFiles(1));
    const fileInfo = loop.computeNextFile(state);

    const ctx1 = loop.buildReviewContext(state, fileInfo, 1);
    assert.equal(ctx1.cycle, 1);

    const ctx2 = loop.buildReviewContext(state, fileInfo, 2);
    assert.equal(ctx2.cycle, 2);

    const ctx3 = loop.buildReviewContext(state, fileInfo, 3);
    assert.equal(ctx3.cycle, 3);
  });
});

// ---------------------------------------------------------------------------
// buildUpdateContext
// ---------------------------------------------------------------------------

describe('ImplementationLoop.buildUpdateContext()', () => {
  // IL-13: buildUpdateContext produces valid UPDATE_CONTEXT shape
  it('IL-13: produces valid UPDATE_CONTEXT shape', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const state = loop.initFromPlan(makeFiles(1));
    const fileInfo = loop.computeNextFile(state);
    state.cycle_per_file[fileInfo.file_path] = 1;

    const findings = {
      blocking: [{ category: 'correctness', description: 'Missing check' }],
      warning: []
    };

    const ctx = loop.buildUpdateContext(state, fileInfo, findings);
    assert.equal(ctx.file_path, 'src/file0.js');
    assert.equal(ctx.reviewer_verdict, 'REVISE');
    assert.ok(ctx.findings);
    assert.ok(Array.isArray(ctx.findings.blocking));
    assert.ok(Array.isArray(ctx.findings.warning));
  });

  // IL-14: buildUpdateContext includes blocking + warning findings
  it('IL-14: includes blocking and warning findings', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const state = loop.initFromPlan(makeFiles(1));
    const fileInfo = loop.computeNextFile(state);
    state.cycle_per_file[fileInfo.file_path] = 2;

    const findings = {
      blocking: [
        { category: 'security', description: 'XSS vulnerability' },
        { category: 'correctness', description: 'Off-by-one error' }
      ],
      warning: [
        { category: 'style', description: 'Inconsistent naming' }
      ]
    };

    const ctx = loop.buildUpdateContext(state, fileInfo, findings);
    assert.equal(ctx.findings.blocking.length, 2);
    assert.equal(ctx.findings.warning.length, 1);
    assert.equal(ctx.cycle, 2);
  });
});

// ---------------------------------------------------------------------------
// processVerdict
// ---------------------------------------------------------------------------

describe('ImplementationLoop.processVerdict()', () => {
  // IL-15: processVerdict PASS advances to next file
  it('IL-15: PASS advances to next file', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const state = loop.initFromPlan(makeFiles(3));
    state.cycle_per_file['src/file0.js'] = 1;

    const result = loop.processVerdict(state, 'PASS');
    assert.equal(result.action, 'next_file');
    assert.equal(result.loopState.current_file_index, 1);
    assert.ok(result.loopState.completed_files.includes('src/file0.js'));
  });

  // IL-16: processVerdict REVISE routes to updater (action=update)
  it('IL-16: REVISE routes to updater', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const state = loop.initFromPlan(makeFiles(2));
    state.cycle_per_file['src/file0.js'] = 1;

    const result = loop.processVerdict(state, 'REVISE');
    assert.equal(result.action, 'update');
    // Should stay on the same file
    assert.equal(result.loopState.current_file_index, 0);
  });

  // IL-17: processVerdict REVISE increments cycle_per_file
  it('IL-17: REVISE increments cycle_per_file', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const state = loop.initFromPlan(makeFiles(1));
    state.cycle_per_file['src/file0.js'] = 1;

    const result = loop.processVerdict(state, 'REVISE');
    assert.equal(result.loopState.cycle_per_file['src/file0.js'], 2);
  });

  // IL-18: processVerdict REVISE at max_cycles returns action=fail
  it('IL-18: REVISE at max_cycles returns action=fail', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const state = loop.initFromPlan(makeFiles(1));
    state.cycle_per_file['src/file0.js'] = 3; // Already at max

    const result = loop.processVerdict(state, 'REVISE');
    assert.equal(result.action, 'fail');
  });

  // IL-19: processVerdict PASS on last file returns action=complete
  it('IL-19: PASS on last file returns action=complete', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const state = loop.initFromPlan(makeFiles(1));
    state.cycle_per_file['src/file0.js'] = 1;

    const result = loop.processVerdict(state, 'PASS');
    assert.equal(result.action, 'complete');
    assert.ok(result.loopState.completed_files.includes('src/file0.js'));
  });
});

// ---------------------------------------------------------------------------
// isComplete
// ---------------------------------------------------------------------------

describe('ImplementationLoop.isComplete()', () => {
  // IL-20: isComplete returns false when files remain
  it('IL-20: returns false when files remain', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const state = loop.initFromPlan(makeFiles(3));
    state.completed_files = ['src/file0.js'];

    assert.equal(loop.isComplete(state), false);
  });

  // IL-21: isComplete returns true when all files passed
  it('IL-21: returns true when all files passed', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const state = loop.initFromPlan(makeFiles(2));
    state.completed_files = ['src/file0.js', 'src/file1.js'];
    state.current_file_index = 2;

    assert.equal(loop.isComplete(state), true);
  });
});

// ---------------------------------------------------------------------------
// getSummary
// ---------------------------------------------------------------------------

describe('ImplementationLoop.getSummary()', () => {
  // IL-22: getSummary returns correct file counts and verdict history
  it('IL-22: returns correct file counts and verdict history', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const state = loop.initFromPlan(makeFiles(3));
    state.completed_files = ['src/file0.js', 'src/file1.js'];
    state.current_file_index = 2;
    state.verdicts = [
      { file: 'src/file0.js', cycle: 1, verdict: 'PASS' },
      { file: 'src/file1.js', cycle: 1, verdict: 'REVISE' },
      { file: 'src/file1.js', cycle: 2, verdict: 'PASS' }
    ];

    const summary = loop.getSummary(state);
    assert.equal(summary.total_files, 3);
    assert.equal(summary.completed_files, 2);
    assert.equal(summary.remaining_files, 1);
    assert.equal(summary.verdicts.length, 3);
  });
});

// ---------------------------------------------------------------------------
// LoopState tracking
// ---------------------------------------------------------------------------

describe('LoopState tracking', () => {
  // IL-23: LoopState tracks current_file_index correctly
  it('IL-23: tracks current_file_index correctly', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const state = loop.initFromPlan(makeFiles(3));
    assert.equal(state.current_file_index, 0);

    state.cycle_per_file['src/file0.js'] = 1;
    const result = loop.processVerdict(state, 'PASS');
    assert.equal(result.loopState.current_file_index, 1);
  });

  // IL-24: LoopState tracks cycle_per_file per file
  it('IL-24: tracks cycle_per_file per file', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const state = loop.initFromPlan(makeFiles(2));
    state.cycle_per_file['src/file0.js'] = 1;

    const r1 = loop.processVerdict(state, 'REVISE');
    assert.equal(r1.loopState.cycle_per_file['src/file0.js'], 2);

    // file1 should not be affected
    assert.equal(r1.loopState.cycle_per_file['src/file1.js'], undefined);
  });

  // IL-25: LoopState tracks completed_files array
  it('IL-25: tracks completed_files array', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const state = loop.initFromPlan(makeFiles(3));
    state.cycle_per_file['src/file0.js'] = 1;

    const r1 = loop.processVerdict(state, 'PASS');
    assert.deepStrictEqual(r1.loopState.completed_files, ['src/file0.js']);

    r1.loopState.cycle_per_file['src/file1.js'] = 1;
    const r2 = loop.processVerdict(r1.loopState, 'PASS');
    assert.deepStrictEqual(r2.loopState.completed_files, ['src/file0.js', 'src/file1.js']);
  });

  // IL-26: LoopState tracks verdict_history array
  it('IL-26: tracks verdict history array', () => {
    const loop = new ImplementationLoop(makeTeamSpec());
    const state = loop.initFromPlan(makeFiles(1));
    state.cycle_per_file['src/file0.js'] = 1;

    const r1 = loop.processVerdict(state, 'REVISE');
    assert.equal(r1.loopState.verdicts.length, 1);
    assert.equal(r1.loopState.verdicts[0].verdict, 'REVISE');
    assert.equal(r1.loopState.verdicts[0].file, 'src/file0.js');

    r1.loopState.cycle_per_file['src/file0.js'] = 2;
    const r2 = loop.processVerdict(r1.loopState, 'PASS');
    assert.equal(r2.loopState.verdicts.length, 2);
    assert.equal(r2.loopState.verdicts[1].verdict, 'PASS');
  });
});
