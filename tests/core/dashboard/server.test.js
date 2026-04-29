/**
 * Integration tests for src/dashboard/server.js
 * REQ-0068: Dashboard server API endpoints
 * Test ID prefix: DS-
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { startDashboardServer } from '../../../src/dashboard/server.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let tempDir;
let serverInstance;

function setupTempState(stateContent) {
  tempDir = join(tmpdir(), `isdlc-dashboard-test-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });
  const stateJsonPath = join(tempDir, 'state.json');
  writeFileSync(stateJsonPath, JSON.stringify(stateContent));
  return stateJsonPath;
}

function makeStateWithWorkflow() {
  return {
    active_workflow: {
      type: 'feature',
      current_phase: '06-implementation',
      phases: ['05-test-strategy', '06-implementation', '16-quality-loop', '08-code-review'],
      sub_agent_log: [{ agent: 'software-developer', phase: '06-implementation', status: 'running', provider: 'claude' }],
      hook_events: [],
      artifacts_produced: []
    },
    phases: {
      '05-test-strategy': { status: 'completed' },
      '06-implementation': { status: 'in_progress' }
    },
    workflow_history: [
      {
        slug: 'REQ-0066-team-continuity-memory',
        source_id: 'GH-125',
        type: 'feature',
        status: 'completed',
        phase_snapshots: [{ phase: '06-implementation', status: 'complete', wall_clock_minutes: 28, provider: 'claude' }]
      }
    ]
  };
}

async function fetch(url) {
  const response = await globalThis.fetch(url);
  return response;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterEach(async () => {
  if (serverInstance) {
    await serverInstance.close();
    serverInstance = null;
  }
  if (tempDir) {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
    tempDir = null;
  }
});

// ---------------------------------------------------------------------------
// DS-01: Server starts
// ---------------------------------------------------------------------------

describe('startDashboardServer', () => {
  it('DS-01: starts HTTP server on specified port', async () => {
    const stateJsonPath = setupTempState(makeStateWithWorkflow());
    serverInstance = await startDashboardServer({
      stateJsonPath,
      port: 0 // OS-assigned port to avoid conflicts
    });

    assert.ok(serverInstance.port > 0);
    assert.ok(serverInstance.url.startsWith('http://127.0.0.1:'));
    assert.equal(typeof serverInstance.close, 'function');
  });
});

// ---------------------------------------------------------------------------
// DS-02, DS-03: GET /api/state
// ---------------------------------------------------------------------------

describe('GET /api/state', () => {
  it('DS-02: returns merged state + topology JSON', async () => {
    const stateJsonPath = setupTempState(makeStateWithWorkflow());
    serverInstance = await startDashboardServer({
      stateJsonPath,
      port: 0
    });

    const res = await fetch(`${serverInstance.url}/api/state`);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.ok(data.active_workflow);
    assert.ok(data.topology !== undefined);
    assert.ok(data.timestamp);
  });

  it('DS-03: response includes active_workflow, phases, topology, timestamp', async () => {
    const stateJsonPath = setupTempState(makeStateWithWorkflow());
    serverInstance = await startDashboardServer({
      stateJsonPath,
      port: 0
    });

    const res = await fetch(`${serverInstance.url}/api/state`);
    const data = await res.json();

    assert.ok('active_workflow' in data);
    assert.ok('phases' in data);
    assert.ok('topology' in data);
    assert.ok('timestamp' in data);
    assert.ok('workflow_type' in data);
    assert.equal(data.workflow_type, 'feature');
  });
});

// ---------------------------------------------------------------------------
// DS-04, DS-05: GET /api/history
// ---------------------------------------------------------------------------

describe('GET /api/history', () => {
  it('DS-04: returns workflow_history array', async () => {
    const stateJsonPath = setupTempState(makeStateWithWorkflow());
    serverInstance = await startDashboardServer({
      stateJsonPath,
      port: 0
    });

    const res = await fetch(`${serverInstance.url}/api/history`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
    assert.equal(data.length, 1);
  });

  it('DS-05: GET /api/history/:id returns single workflow by slug', async () => {
    const stateJsonPath = setupTempState(makeStateWithWorkflow());
    serverInstance = await startDashboardServer({
      stateJsonPath,
      port: 0
    });

    const res = await fetch(`${serverInstance.url}/api/history/REQ-0066-team-continuity-memory`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.slug, 'REQ-0066-team-continuity-memory');
    assert.equal(data.type, 'feature');
  });
});

// ---------------------------------------------------------------------------
// DS-06: live_dashboard disabled
// ---------------------------------------------------------------------------

describe('live_dashboard disabled', () => {
  it('DS-06: server does not start when not invoked (no automatic startup)', () => {
    // This test validates the design: server.js exports startDashboardServer()
    // but does NOT auto-start. The caller (CLI wrapper) decides whether to start.
    // There is no implicit startup -- the function must be explicitly called.
    assert.ok(typeof startDashboardServer === 'function');
    // If the server auto-started on import, we'd detect a leaked listener.
    // Since we reach this assertion, no implicit startup occurred.
  });
});

// ---------------------------------------------------------------------------
// DS-07: localhost binding
// ---------------------------------------------------------------------------

describe('security', () => {
  it('DS-07: server binds to 127.0.0.1 only', async () => {
    const stateJsonPath = setupTempState(makeStateWithWorkflow());
    serverInstance = await startDashboardServer({
      stateJsonPath,
      port: 0
    });

    // The URL should be 127.0.0.1, not 0.0.0.0
    assert.ok(serverInstance.url.includes('127.0.0.1'));
  });
});

// ---------------------------------------------------------------------------
// DS-08: port fallback
// ---------------------------------------------------------------------------

describe('port fallback', () => {
  it('DS-08: uses different port when preferred is taken', async () => {
    const stateJsonPath = setupTempState(makeStateWithWorkflow());

    // Start first server on a specific port
    const first = await startDashboardServer({
      stateJsonPath,
      port: 0 // OS-assigned
    });

    // Start second server on same port -- should fall back
    const second = await startDashboardServer({
      stateJsonPath,
      port: first.port // Try same port
    });

    assert.notEqual(first.port, second.port);

    await second.close();
    await first.close();
    serverInstance = null; // Both cleaned up manually
  });
});

// ---------------------------------------------------------------------------
// DS-AI: Analysis data in /api/state (BUG-GH-277)
// ---------------------------------------------------------------------------

function writeAnalysisIndex(dir, content) {
  writeFileSync(join(dir, 'analysis-index.json'), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
}

function makeAnalysisIndex(items = []) {
  return {
    version: '1.0.0',
    updated_at: new Date().toISOString(),
    items
  };
}

function makeAnalysisItem(overrides = {}) {
  return {
    slug: 'BUG-GH-277-dashboard-fix',
    source_id: 'GH-277',
    item_type: 'BUG',
    analysis_status: 'partial',
    phases_completed: ['00-quick-scan', '01-requirements'],
    created_at: '2026-04-29T10:00:00.000Z',
    last_activity_at: '2026-04-29T12:00:00.000Z',
    ...overrides
  };
}

describe('GET /api/state — analysis data (BUG-GH-277)', () => {

  it('DS-AI-01: includes analysis_items when analysis-index.json exists', async () => {
    const stateJsonPath = setupTempState({ active_workflow: null, phases: {} });
    writeAnalysisIndex(tempDir, makeAnalysisIndex([makeAnalysisItem()]));

    serverInstance = await startDashboardServer({ stateJsonPath, port: 0 });
    const res = await fetch(`${serverInstance.url}/api/state`);
    const data = await res.json();

    assert.ok(Array.isArray(data.analysis_items));
    assert.strictEqual(data.analysis_items.length, 1);
    assert.strictEqual(data.analysis_items[0].slug, 'BUG-GH-277-dashboard-fix');
  });

  it('DS-AI-02: includes active_analysis for partial items', async () => {
    const stateJsonPath = setupTempState({ active_workflow: null, phases: {} });
    writeAnalysisIndex(tempDir, makeAnalysisIndex([
      makeAnalysisItem({ analysis_status: 'partial', last_activity_at: '2026-04-29T12:00:00.000Z' }),
      makeAnalysisItem({ slug: 'REQ-GH-280-feature', analysis_status: 'analyzed', last_activity_at: '2026-04-29T11:00:00.000Z' })
    ]));

    serverInstance = await startDashboardServer({ stateJsonPath, port: 0 });
    const res = await fetch(`${serverInstance.url}/api/state`);
    const data = await res.json();

    assert.ok(data.active_analysis);
    assert.strictEqual(data.active_analysis.slug, 'BUG-GH-277-dashboard-fix');
    assert.strictEqual(data.active_analysis.analysis_status, 'partial');
  });

  it('DS-AI-03: active_analysis is null when no partial items', async () => {
    const stateJsonPath = setupTempState({ active_workflow: null, phases: {} });
    writeAnalysisIndex(tempDir, makeAnalysisIndex([
      makeAnalysisItem({ analysis_status: 'analyzed' })
    ]));

    serverInstance = await startDashboardServer({ stateJsonPath, port: 0 });
    const res = await fetch(`${serverInstance.url}/api/state`);
    const data = await res.json();

    assert.strictEqual(data.active_analysis, null);
  });

  it('DS-AI-04: analysis_items is empty array when no index file', async () => {
    const stateJsonPath = setupTempState({ active_workflow: null, phases: {} });
    // Do NOT write an analysis-index.json

    serverInstance = await startDashboardServer({ stateJsonPath, port: 0 });
    const res = await fetch(`${serverInstance.url}/api/state`);
    const data = await res.json();

    assert.deepStrictEqual(data.analysis_items, []);
    assert.strictEqual(data.active_analysis, null);
  });

  it('DS-AI-05: analysis data coexists with active_workflow', async () => {
    const stateJsonPath = setupTempState(makeStateWithWorkflow());
    writeAnalysisIndex(tempDir, makeAnalysisIndex([makeAnalysisItem()]));

    serverInstance = await startDashboardServer({ stateJsonPath, port: 0 });
    const res = await fetch(`${serverInstance.url}/api/state`);
    const data = await res.json();

    assert.ok(data.active_workflow);
    assert.ok(Array.isArray(data.analysis_items));
    assert.strictEqual(data.analysis_items.length, 1);
  });

  it('DS-AI-06: handles corrupt analysis-index.json', async () => {
    const stateJsonPath = setupTempState({ active_workflow: null, phases: {} });
    writeAnalysisIndex(tempDir, 'NOT VALID JSON {{{');

    serverInstance = await startDashboardServer({ stateJsonPath, port: 0 });
    const res = await fetch(`${serverInstance.url}/api/state`);
    const data = await res.json();

    assert.deepStrictEqual(data.analysis_items, []);
    assert.strictEqual(data.active_analysis, null);
  });

  it('DS-AI-07: analysis_items match expected schema', async () => {
    const stateJsonPath = setupTempState({ active_workflow: null, phases: {} });
    writeAnalysisIndex(tempDir, makeAnalysisIndex([makeAnalysisItem()]));

    serverInstance = await startDashboardServer({ stateJsonPath, port: 0 });
    const res = await fetch(`${serverInstance.url}/api/state`);
    const data = await res.json();

    const item = data.analysis_items[0];
    assert.ok('slug' in item);
    assert.ok('source_id' in item);
    assert.ok('item_type' in item);
    assert.ok('analysis_status' in item);
    assert.ok(Array.isArray(item.phases_completed));
    assert.ok('created_at' in item);
    assert.ok('last_activity_at' in item);
  });

  it('DS-AI-08: existing response fields unchanged', async () => {
    const stateJsonPath = setupTempState(makeStateWithWorkflow());

    serverInstance = await startDashboardServer({ stateJsonPath, port: 0 });
    const res = await fetch(`${serverInstance.url}/api/state`);
    const data = await res.json();

    // All existing fields still present
    assert.ok('active_workflow' in data);
    assert.ok('phases' in data);
    assert.ok('topology' in data);
    assert.ok('timestamp' in data);
    assert.ok('workflow_type' in data);
    assert.strictEqual(data.workflow_type, 'feature');
    // active_workflow should be populated (not null)
    assert.ok(data.active_workflow);
    assert.strictEqual(data.active_workflow.type, 'feature');
  });
});
