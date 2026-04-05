/**
 * Unit tests for src/core/bridge/tasks.cjs
 * Tests: TC-BRIDGE-01..20 from test-cases.md
 * Traces: ADR-002, FR-001, FR-002, AC-002-02
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// The bridge under test
const bridgePath = path.resolve(__dirname, '..', '..', '..', 'core', 'bridge', 'tasks.cjs');

/**
 * Create a temp directory with a tasks.md file.
 */
function createTempTasksMd(content) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcg-bridge-'));
  const filePath = path.join(tmpDir, 'tasks.md');
  if (content !== null) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
  return { tmpDir, filePath };
}

function cleanup(tmpDir) {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
}

const VALID_TASKS_MD = `# Task Plan: REQ-TEST test-fixture

## Progress Summary

| Phase | Tasks | Complete | Status |
|-------|-------|----------|--------|
| 06 | 2 | 1 | IN PROGRESS |
| **Total** | **2** | **1** | **50%** |

## Phase 06: Implementation -- IN PROGRESS

- [X] T001 Completed task | traces: FR-001
  files: src/foo.js (CREATE)
- [ ] T002 Pending task | traces: FR-002
  files: src/bar.js (CREATE)
`;

const ALL_DONE_TASKS_MD = `# Task Plan: REQ-TEST all-done

## Progress Summary

| Phase | Tasks | Complete | Status |
|-------|-------|----------|--------|
| 06 | 1 | 1 | COMPLETE |
| **Total** | **1** | **1** | **100%** |

## Phase 06: Implementation -- COMPLETE

- [X] T001 Done task | traces: FR-001
  files: src/done.js (CREATE)
`;

describe('tasks-bridge (src/core/bridge/tasks.cjs)', () => {
  let tmpDirs = [];

  afterEach(() => {
    for (const d of tmpDirs) cleanup(d);
    tmpDirs = [];
  });

  // TC-BRIDGE-01: Happy path — valid tasks.md returns TaskPlan
  it('returns TaskPlan for valid tasks.md', async () => {
    const { tmpDir, filePath } = createTempTasksMd(VALID_TASKS_MD);
    tmpDirs.push(tmpDir);
    const { readTaskPlan } = require(bridgePath);
    const plan = await readTaskPlan(filePath);
    assert.ok(plan, 'should return a plan');
    assert.ok(plan.phases, 'plan should have phases');
    assert.ok('06' in plan.phases, 'should have phase 06');
  });

  // TC-BRIDGE-02: Happy path — all tasks done
  it('returns TaskPlan when all tasks are done', async () => {
    const { tmpDir, filePath } = createTempTasksMd(ALL_DONE_TASKS_MD);
    tmpDirs.push(tmpDir);
    const { readTaskPlan } = require(bridgePath);
    const plan = await readTaskPlan(filePath);
    assert.ok(plan, 'should return a plan');
    assert.equal(plan.phases['06'].tasks.length, 1);
  });

  // TC-BRIDGE-06: File not found → null
  it('returns null for nonexistent path', async () => {
    const { readTaskPlan } = require(bridgePath);
    const result = await readTaskPlan('/nonexistent/path/tasks.md');
    assert.equal(result, null);
  });

  // TC-BRIDGE-07: null argument → null
  it('returns null for null path', async () => {
    const { readTaskPlan } = require(bridgePath);
    const result = await readTaskPlan(null);
    assert.equal(result, null);
  });

  // TC-BRIDGE-08: undefined argument → null
  it('returns null for undefined path', async () => {
    const { readTaskPlan } = require(bridgePath);
    const result = await readTaskPlan(undefined);
    assert.equal(result, null);
  });

  // TC-BRIDGE-12: Empty file → null (task-reader returns error object)
  it('returns null for empty file', async () => {
    const { tmpDir, filePath } = createTempTasksMd('');
    tmpDirs.push(tmpDir);
    const { readTaskPlan } = require(bridgePath);
    const result = await readTaskPlan(filePath);
    assert.equal(result, null);
  });

  // TC-BRIDGE-13: Whitespace-only file → null
  it('returns null for whitespace-only file', async () => {
    const { tmpDir, filePath } = createTempTasksMd('   \n  \n  ');
    tmpDirs.push(tmpDir);
    const { readTaskPlan } = require(bridgePath);
    const result = await readTaskPlan(filePath);
    assert.equal(result, null);
  });

  // TC-BRIDGE-14: Malformed (no phase headers) → null
  it('returns null for malformed file with no phase headers', async () => {
    const { tmpDir, filePath } = createTempTasksMd('# Just a heading\nsome text');
    tmpDirs.push(tmpDir);
    const { readTaskPlan } = require(bridgePath);
    const result = await readTaskPlan(filePath);
    assert.equal(result, null);
  });

  // TC-BRIDGE-25: Module caching — second call succeeds
  it('returns plan on second call (module caching)', async () => {
    const { tmpDir, filePath } = createTempTasksMd(VALID_TASKS_MD);
    tmpDirs.push(tmpDir);
    const { readTaskPlan } = require(bridgePath);
    const plan1 = await readTaskPlan(filePath);
    const plan2 = await readTaskPlan(filePath);
    assert.ok(plan1);
    assert.ok(plan2);
    assert.deepEqual(Object.keys(plan1.phases), Object.keys(plan2.phases));
  });

  // TC-BRIDGE-30: Concurrent calls both resolve
  it('handles concurrent calls without error', async () => {
    const { tmpDir, filePath } = createTempTasksMd(VALID_TASKS_MD);
    tmpDirs.push(tmpDir);
    const { readTaskPlan } = require(bridgePath);
    const [r1, r2, r3] = await Promise.all([
      readTaskPlan(filePath),
      readTaskPlan(filePath),
      readTaskPlan('/nonexistent/path.md')
    ]);
    assert.ok(r1);
    assert.ok(r2);
    assert.equal(r3, null);
  });

  // TC-BRIDGE-35: Real tasks.md from project
  it('parses the actual project tasks.md', async () => {
    const projectTasks = path.resolve(__dirname, '..', '..', '..', '..', 'docs', 'isdlc', 'tasks.md');
    if (!fs.existsSync(projectTasks)) return; // skip if not present
    const { readTaskPlan } = require(bridgePath);
    const plan = await readTaskPlan(projectTasks);
    assert.ok(plan, 'should parse project tasks.md');
    assert.ok(plan.phases, 'should have phases');
  });
});
