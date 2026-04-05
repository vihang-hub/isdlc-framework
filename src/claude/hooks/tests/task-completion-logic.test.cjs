/**
 * Unit tests for src/claude/hooks/lib/task-completion-logic.cjs
 * Tests: TC-CHK, TC-DPT, TC-CNT, TC-FMT from test-cases.md
 * Traces: FR-001, FR-002, AC-001-01, AC-001-02, AC-002-01..06
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  check,
  detectPhaseCompletionTransition,
  countUnfinishedTopLevelTasks,
  formatBlockMessage
} = require('../lib/task-completion-logic.cjs');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeState(overrides = {}) {
  return {
    active_workflow: { type: 'build', ...overrides.active_workflow },
    phases: {
      '06-implementation': { status: 'in_progress', ...overrides.phase06 },
      ...overrides.phases
    },
    ...overrides.root
  };
}

function makeTaskPlan(overrides = {}) {
  return {
    slug: 'REQ-TEST',
    phases: {
      '06': {
        name: 'Implementation',
        status: 'IN PROGRESS',
        tasks: overrides.tasks || [
          { id: 'T001', description: 'Done task', complete: true, parentId: null, children: [], blockedBy: [], blocks: [], traces: [], files: [] },
          { id: 'T002', description: 'Pending task', complete: false, parentId: null, children: [], blockedBy: [], blocks: [], traces: [], files: [] }
        ]
      },
      ...overrides.phases
    }
  };
}

function makeInput(newState) {
  return {
    tool_name: 'Edit',
    tool_input: {
      file_path: '/project/.isdlc/state.json',
      new_string: JSON.stringify(newState)
    }
  };
}

// ---------------------------------------------------------------------------
// detectPhaseCompletionTransition
// ---------------------------------------------------------------------------

describe('detectPhaseCompletionTransition', () => {
  // TC-DPT-01: Transition detected
  it('detects pending → completed transition', () => {
    const old = { phases: { '06-implementation': { status: 'in_progress' } } };
    const next = { phases: { '06-implementation': { status: 'completed' } } };
    const result = detectPhaseCompletionTransition(old, next);
    assert.ok(result);
    assert.equal(result.phaseKey, '06-implementation');
    assert.equal(result.isTransition, true);
  });

  // TC-DPT-02: No transition (both completed)
  it('returns null for idempotent write (completed → completed)', () => {
    const old = { phases: { '06-implementation': { status: 'completed' } } };
    const next = { phases: { '06-implementation': { status: 'completed' } } };
    assert.equal(detectPhaseCompletionTransition(old, next), null);
  });

  // TC-DPT-03: No transition (still in_progress)
  it('returns null when status stays in_progress', () => {
    const old = { phases: { '06-implementation': { status: 'in_progress' } } };
    const next = { phases: { '06-implementation': { status: 'in_progress' } } };
    assert.equal(detectPhaseCompletionTransition(old, next), null);
  });

  // TC-DPT-04: null oldState → new completed triggers
  it('treats null oldState as transition', () => {
    const next = { phases: { '06-implementation': { status: 'completed' } } };
    const result = detectPhaseCompletionTransition(null, next);
    assert.ok(result);
    assert.equal(result.phaseKey, '06-implementation');
  });

  // TC-DPT-05: null newState → null
  it('returns null for null newState', () => {
    assert.equal(detectPhaseCompletionTransition({}, null), null);
  });

  // TC-DPT-06: no phases in newState → null
  it('returns null when newState has no phases', () => {
    assert.equal(detectPhaseCompletionTransition({}, { active_workflow: {} }), null);
  });

  // TC-DPT-07: First phase with new key in oldState
  it('detects transition for phase not in oldState', () => {
    const old = { phases: {} };
    const next = { phases: { '05-test-strategy': { status: 'completed' } } };
    const result = detectPhaseCompletionTransition(old, next);
    assert.ok(result);
    assert.equal(result.phaseKey, '05-test-strategy');
  });

  // TC-DPT-08: Multiple phases, returns first
  it('returns first transitioning phase', () => {
    const old = { phases: { '05-test-strategy': { status: 'in_progress' }, '06-implementation': { status: 'in_progress' } } };
    const next = { phases: { '05-test-strategy': { status: 'completed' }, '06-implementation': { status: 'completed' } } };
    const result = detectPhaseCompletionTransition(old, next);
    assert.ok(result);
    // Should be one of the two
    assert.ok(['05-test-strategy', '06-implementation'].includes(result.phaseKey));
  });
});

// ---------------------------------------------------------------------------
// countUnfinishedTopLevelTasks
// ---------------------------------------------------------------------------

describe('countUnfinishedTopLevelTasks', () => {
  // TC-CNT-01: Happy path with 1 unfinished
  it('returns unfinished top-level tasks', () => {
    const plan = makeTaskPlan();
    const result = countUnfinishedTopLevelTasks(plan, '06-implementation');
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'T002');
    assert.equal(result[0].description, 'Pending task');
  });

  // TC-CNT-02: All done → empty
  it('returns empty when all tasks complete', () => {
    const plan = makeTaskPlan({ tasks: [
      { id: 'T001', description: 'Done', complete: true, parentId: null, children: [], blockedBy: [], blocks: [], traces: [], files: [] }
    ]});
    assert.deepEqual(countUnfinishedTopLevelTasks(plan, '06-implementation'), []);
  });

  // TC-CNT-03: Excludes sub-tasks (parentId set)
  it('excludes sub-tasks (parentId non-null)', () => {
    const plan = makeTaskPlan({ tasks: [
      { id: 'T001', description: 'Parent done', complete: true, parentId: null, children: ['T001A'], blockedBy: [], blocks: [], traces: [], files: [] },
      { id: 'T001A', description: 'Sub incomplete', complete: false, parentId: 'T001', children: [], blockedBy: [], blocks: [], traces: [], files: [] }
    ]});
    // Sub-task not counted
    assert.deepEqual(countUnfinishedTopLevelTasks(plan, '06-implementation'), []);
  });

  // TC-CNT-04: Phase prefix match ("06-implementation" → "06")
  it('matches phase by prefix when exact key missing', () => {
    const plan = makeTaskPlan();
    const result = countUnfinishedTopLevelTasks(plan, '06-implementation');
    assert.equal(result.length, 1);
  });

  // TC-CNT-05: null taskPlan → empty
  it('returns empty for null taskPlan', () => {
    assert.deepEqual(countUnfinishedTopLevelTasks(null, '06'), []);
  });

  // TC-CNT-06: null phaseKey → empty
  it('returns empty for null phaseKey', () => {
    assert.deepEqual(countUnfinishedTopLevelTasks(makeTaskPlan(), null), []);
  });

  // TC-CNT-07: Non-matching phase → empty
  it('returns empty for non-matching phase', () => {
    assert.deepEqual(countUnfinishedTopLevelTasks(makeTaskPlan(), '99-nonexistent'), []);
  });

  // TC-CNT-08: Missing tasks array in phase → empty
  it('returns empty when phase has no tasks array', () => {
    const plan = { phases: { '06': { name: 'Impl', status: 'PENDING' } } };
    assert.deepEqual(countUnfinishedTopLevelTasks(plan, '06'), []);
  });
});

// ---------------------------------------------------------------------------
// formatBlockMessage
// ---------------------------------------------------------------------------

describe('formatBlockMessage', () => {
  // TC-FMT-01: Standard format per AC-001-02
  it('formats message per AC-001-02', () => {
    const msg = formatBlockMessage('06-implementation', [
      { id: 'T019', description: 'Create http-server' }
    ]);
    assert.ok(msg.startsWith('TASKS INCOMPLETE:'));
    assert.ok(msg.includes('Phase 06-implementation has 1 unfinished'));
    assert.ok(msg.includes('- [ ] T019: Create http-server'));
    assert.ok(msg.includes('Article I.5'));
    assert.ok(msg.includes('Complete remaining tasks'));
  });

  // TC-FMT-02: Multiple tasks listed
  it('lists multiple unfinished tasks', () => {
    const msg = formatBlockMessage('06-implementation', [
      { id: 'T017', description: 'Task A' },
      { id: 'T019', description: 'Task B' },
      { id: 'T020', description: 'Task C' }
    ]);
    assert.ok(msg.includes('3 unfinished'));
    assert.ok(msg.includes('- [ ] T017: Task A'));
    assert.ok(msg.includes('- [ ] T019: Task B'));
    assert.ok(msg.includes('- [ ] T020: Task C'));
  });

  // TC-FMT-03: Empty array → 0 unfinished
  it('handles empty unfinished array', () => {
    const msg = formatBlockMessage('06-implementation', []);
    assert.ok(msg.includes('0 unfinished'));
  });

  // TC-FMT-04: null phaseKey → "unknown"
  it('handles null phaseKey', () => {
    const msg = formatBlockMessage(null, [{ id: 'T001', description: 'test' }]);
    assert.ok(msg.includes('Phase unknown'));
  });

  // TC-FMT-05: null tasks → handles gracefully
  it('handles null tasks array', () => {
    const msg = formatBlockMessage('06', null);
    assert.ok(msg.includes('0 unfinished'));
  });
});

// ---------------------------------------------------------------------------
// check (main entrypoint)
// ---------------------------------------------------------------------------

describe('check', () => {
  // TC-CHK-01: Happy path block — unfinished tasks
  it('blocks when unfinished tasks exist', () => {
    const state = makeState({ phase06: { status: 'in_progress' } });
    const newState = { ...state, phases: { '06-implementation': { status: 'completed' } } };
    const input = makeInput(newState);
    const plan = makeTaskPlan();

    const result = check({ input, state, taskPlan: plan });
    assert.equal(result.decision, 'block');
    assert.ok(result.stderr.includes('TASKS INCOMPLETE'));
    assert.equal(result.unfinishedTasks.length, 1);
    assert.equal(result.unfinishedTasks[0].id, 'T002');
  });

  // TC-CHK-02: All tasks done → allow
  it('allows when all tasks complete', () => {
    const state = makeState({ phase06: { status: 'in_progress' } });
    const newState = { ...state, phases: { '06-implementation': { status: 'completed' } } };
    const input = makeInput(newState);
    const plan = makeTaskPlan({ tasks: [
      { id: 'T001', description: 'Done', complete: true, parentId: null, children: [], blockedBy: [], blocks: [], traces: [], files: [] }
    ]});

    const result = check({ input, state, taskPlan: plan });
    assert.equal(result.decision, 'allow');
  });

  // TC-CHK-03 (AC-002-01): Not build workflow → allow
  it('allows for non-build workflow', () => {
    const state = makeState({ active_workflow: { type: 'test-run' } });
    const input = makeInput({ phases: { '06-implementation': { status: 'completed' } } });
    const result = check({ input, state, taskPlan: makeTaskPlan() });
    assert.equal(result.decision, 'allow');
  });

  // TC-CHK-04 (AC-002-01): No active workflow → allow
  it('allows with no active_workflow', () => {
    const state = { phases: { '06-implementation': { status: 'in_progress' } } };
    const input = makeInput({ phases: { '06-implementation': { status: 'completed' } } });
    const result = check({ input, state, taskPlan: makeTaskPlan() });
    assert.equal(result.decision, 'allow');
  });

  // TC-CHK-05 (AC-002-04): Malformed JSON in tool_input → allow
  it('allows on unparseable tool_input', () => {
    const state = makeState();
    const input = { tool_name: 'Edit', tool_input: { file_path: '.isdlc/state.json', new_string: 'not json' } };
    const result = check({ input, state, taskPlan: makeTaskPlan() });
    assert.equal(result.decision, 'allow');
  });

  // TC-CHK-06 (AC-002-05): No transition → allow
  it('allows when no phase completion transition detected', () => {
    const state = makeState({ phase06: { status: 'completed' } });
    const newState = { phases: { '06-implementation': { status: 'completed' } } };
    const input = makeInput(newState);
    const result = check({ input, state, taskPlan: makeTaskPlan() });
    assert.equal(result.decision, 'allow');
  });

  // TC-CHK-07 (AC-002-02): null taskPlan → allow
  it('allows when taskPlan is null', () => {
    const state = makeState({ phase06: { status: 'in_progress' } });
    const newState = { phases: { '06-implementation': { status: 'completed' } } };
    const input = makeInput(newState);
    const result = check({ input, state, taskPlan: null });
    assert.equal(result.decision, 'allow');
  });

  // TC-CHK-08 (AC-002-03): No matching phase section → allow
  it('allows when taskPlan has no matching phase section', () => {
    const state = makeState({ phase06: { status: 'in_progress' } });
    const newState = { phases: { '06-implementation': { status: 'completed' } } };
    const input = makeInput(newState);
    const plan = { phases: { '99': { name: 'Other', tasks: [] } } };
    const result = check({ input, state, taskPlan: plan });
    assert.equal(result.decision, 'allow');
  });

  // TC-CHK-09 (AC-002-06): Internal exception → allow
  it('allows on internal exception (fail-open)', () => {
    // Force an error by passing a ctx that triggers deep access on null
    const result = check({ input: { tool_input: null }, state: null, taskPlan: null });
    assert.equal(result.decision, 'allow');
  });

  // TC-CHK-10: null ctx → allow
  it('allows on null ctx', () => {
    const result = check(null);
    assert.equal(result.decision, 'allow');
  });
});
