/**
 * Tests for task-reader.js metadata extension (REQ-GH-219, T0002)
 * Validates that pipe annotations parse arbitrary key: value metadata.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readTaskPlan } from '../../../src/core/tasks/task-reader.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TMP = join(tmpdir(), 'isdlc-test-metadata-' + Date.now());

function writePlan(content) {
  const p = join(TMP, 'tasks.md');
  writeFileSync(p, content, 'utf8');
  return p;
}

describe('TRM: task-reader metadata extension', () => {
  before(() => mkdirSync(TMP, { recursive: true }));
  after(() => rmSync(TMP, { recursive: true, force: true }));

  it('TRM-01: parses traces-only annotation (backward compat)', () => {
    const path = writePlan(`# Task Plan: test test-slug\n\n## Phase 06: Impl -- PENDING\n\n- [ ] T0001 Do something | traces: FR-001, AC-001-01\n`);
    const plan = readTaskPlan(path);
    const task = plan.phases['06'].tasks[0];
    assert.deepStrictEqual(task.traces, ['FR-001', 'AC-001-01']);
    assert.deepStrictEqual(task.metadata.traces, ['FR-001', 'AC-001-01']);
  });

  it('TRM-02: parses critical, fail_open, max_retries, type metadata', () => {
    const path = writePlan(`# Task Plan: test test-slug\n\n## Phase FN: Finalize -- PENDING\n\n- [ ] F0001 Merge branch | critical: true, fail_open: false, max_retries: 1, type: internal\n`);
    const plan = readTaskPlan(path);
    const task = plan.phases['FN'].tasks[0];
    assert.strictEqual(task.metadata.critical, true);
    assert.strictEqual(task.metadata.fail_open, false);
    assert.strictEqual(task.metadata.max_retries, 1);
    assert.strictEqual(task.metadata.type, 'internal');
  });

  it('TRM-03: parses mixed traces + metadata', () => {
    const path = writePlan(`# Task Plan: test test-slug\n\n## Phase 06: Impl -- PENDING\n\n- [ ] T0001 Do something | traces: FR-001, critical: true, fail_open: true\n`);
    const plan = readTaskPlan(path);
    const task = plan.phases['06'].tasks[0];
    assert.deepStrictEqual(task.traces, ['FR-001']);
    assert.strictEqual(task.metadata.critical, true);
    assert.strictEqual(task.metadata.fail_open, true);
  });

  it('TRM-04: metadata is empty object when no pipe annotation', () => {
    const path = writePlan(`# Task Plan: test test-slug\n\n## Phase 06: Impl -- PENDING\n\n- [ ] T0001 Do something\n`);
    const plan = readTaskPlan(path);
    const task = plan.phases['06'].tasks[0];
    assert.deepStrictEqual(task.metadata, {});
    assert.deepStrictEqual(task.traces, []);
  });

  it('TRM-05: boolean coercion works for true and false', () => {
    const path = writePlan(`# Task Plan: test test-slug\n\n## Phase FN: Finalize -- PENDING\n\n- [ ] F0001 Step | critical: true, fail_open: false\n`);
    const plan = readTaskPlan(path);
    const task = plan.phases['FN'].tasks[0];
    assert.strictEqual(typeof task.metadata.critical, 'boolean');
    assert.strictEqual(typeof task.metadata.fail_open, 'boolean');
  });

  it('TRM-06: numeric coercion works for max_retries', () => {
    const path = writePlan(`# Task Plan: test test-slug\n\n## Phase FN: Finalize -- PENDING\n\n- [ ] F0001 Step | max_retries: 3\n`);
    const plan = readTaskPlan(path);
    const task = plan.phases['FN'].tasks[0];
    assert.strictEqual(typeof task.metadata.max_retries, 'number');
    assert.strictEqual(task.metadata.max_retries, 3);
  });

  it('TRM-07: string values remain strings', () => {
    const path = writePlan(`# Task Plan: test test-slug\n\n## Phase FN: Finalize -- PENDING\n\n- [ ] F0001 Step | type: shell\n`);
    const plan = readTaskPlan(path);
    const task = plan.phases['FN'].tasks[0];
    assert.strictEqual(typeof task.metadata.type, 'string');
    assert.strictEqual(task.metadata.type, 'shell');
  });

  it('TRM-08: alphanumeric phase keys (FN) are parsed correctly', () => {
    const path = writePlan(`# Task Plan: test test-slug\n\n## Phase FN: Finalize -- PENDING\n\n- [ ] F0001 Step | type: internal\n`);
    const plan = readTaskPlan(path);
    assert.ok(plan.phases['FN']);
    assert.strictEqual(plan.phases['FN'].name, 'Finalize');
  });

  it('TRM-09: existing numeric phase keys still work', () => {
    const path = writePlan(`# Task Plan: test test-slug\n\n## Phase 06: Implementation -- PENDING\n\n- [ ] T0001 Code | traces: FR-001\n`);
    const plan = readTaskPlan(path);
    assert.ok(plan.phases['06']);
  });

  it('TRM-10: traces with uppercase IDs not split by metadata parser', () => {
    const path = writePlan(`# Task Plan: test test-slug\n\n## Phase 06: Impl -- PENDING\n\n- [ ] T0001 Do something | traces: FR-001, AC-001-02, NFR-004\n`);
    const plan = readTaskPlan(path);
    const task = plan.phases['06'].tasks[0];
    assert.deepStrictEqual(task.traces, ['FR-001', 'AC-001-02', 'NFR-004']);
  });

  it('TRM-11: finalize-steps.default.md parses without errors', () => {
    const defaultPath = join(process.cwd(), 'src/core/finalize/finalize-steps.default.md');
    const plan = readTaskPlan(defaultPath);
    assert.ok(plan);
    assert.ok(!plan.error, `Parse error: ${plan.error} - ${plan.reason}`);
    assert.ok(plan.phases['FN']);
    assert.ok(plan.phases['FN'].tasks.length >= 9);
  });

});
