/**
 * Integration tests for src/claude/hooks/task-completion-gate.cjs
 * Uses copy-to-temp pattern per Article XIII requirement 6.
 * Tests: TC-HOOK from test-cases.md
 * Traces: FR-001, FR-002, AC-001-03, AC-002-06
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

// ---------------------------------------------------------------------------
// Test helpers — copy-to-temp pattern
// ---------------------------------------------------------------------------

/**
 * Set up a temp directory with the hook and its dependencies.
 * Per Article XIII req 6: copy hook files to temp dir outside package.
 */
function setupHookEnv() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcg-hook-'));

  // Copy hook entry
  const hookSrc = path.resolve(__dirname, '..', 'task-completion-gate.cjs');
  const hookDest = path.join(tmpDir, 'task-completion-gate.cjs');
  fs.copyFileSync(hookSrc, hookDest);

  // Copy lib/ directory
  const libDir = path.join(tmpDir, 'lib');
  fs.mkdirSync(libDir, { recursive: true });

  const libSrc = path.resolve(__dirname, '..', 'lib');
  for (const f of ['task-completion-logic.cjs', 'common.cjs', 'profile-loader.cjs']) {
    const src = path.join(libSrc, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(libDir, f));
    }
  }

  // Create minimal .isdlc directory for getProjectRoot
  const isdlcDir = path.join(tmpDir, '.isdlc');
  fs.mkdirSync(isdlcDir, { recursive: true });

  // Create docs/isdlc for tasks.md
  const docsDir = path.join(tmpDir, 'docs', 'isdlc');
  fs.mkdirSync(docsDir, { recursive: true });

  return { tmpDir, hookPath: hookDest, isdlcDir, docsDir };
}

/**
 * Run the hook with stdin input.
 * Returns { code, stdout, stderr }.
 */
function runHook(hookPath, stdinInput, cwd) {
  try {
    const result = execSync(
      `echo '${stdinInput.replace(/'/g, "\\'")}' | node "${hookPath}"`,
      {
        cwd,
        timeout: 5000,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }
    );
    return { code: 0, stdout: result, stderr: '' };
  } catch (err) {
    return {
      code: err.status || 1,
      stdout: err.stdout || '',
      stderr: err.stderr || ''
    };
  }
}

function writeStateJson(isdlcDir, state) {
  fs.writeFileSync(path.join(isdlcDir, 'state.json'), JSON.stringify(state, null, 2));
}

function writeTasksMd(docsDir, content) {
  fs.writeFileSync(path.join(docsDir, 'tasks.md'), content);
}

const TASKS_WITH_PENDING = `# Task Plan: REQ-TEST test

## Progress Summary

| Phase | Tasks | Complete | Status |
|-------|-------|----------|--------|
| 06 | 2 | 1 | IN PROGRESS |
| **Total** | **2** | **1** | **50%** |

## Phase 06: Implementation -- IN PROGRESS

- [X] T001 Done task | traces: FR-001
  files: src/foo.js (CREATE)
- [ ] T002 Pending task | traces: FR-002
  files: src/bar.js (CREATE)
`;

const TASKS_ALL_DONE = `# Task Plan: REQ-TEST test

## Progress Summary

| Phase | Tasks | Complete | Status |
|-------|-------|----------|--------|
| 06 | 1 | 1 | COMPLETE |
| **Total** | **1** | **1** | **100%** |

## Phase 06: Implementation -- COMPLETE

- [X] T001 Done task | traces: FR-001
  files: src/foo.js (CREATE)
`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('task-completion-gate.cjs (hook integration)', () => {
  let env;

  beforeEach(() => {
    env = setupHookEnv();
  });

  afterEach(() => {
    try { fs.rmSync(env.tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  // TC-HOOK-01: Empty stdin → exit 0
  it('exits 0 on empty stdin', () => {
    const result = runHook(env.hookPath, '', env.tmpDir);
    assert.equal(result.code, 0);
  });

  // TC-HOOK-02: Malformed JSON stdin → exit 0
  it('exits 0 on malformed JSON', () => {
    const result = runHook(env.hookPath, 'not json', env.tmpDir);
    assert.equal(result.code, 0);
  });

  // TC-HOOK-07: tool_input.file_path not state.json → exit 0
  it('exits 0 when file_path is not state.json', () => {
    const input = JSON.stringify({
      tool_name: 'Edit',
      tool_input: { file_path: '/some/other/file.json', new_string: '{}' }
    });
    const result = runHook(env.hookPath, input, env.tmpDir);
    assert.equal(result.code, 0);
  });

  // TC-HOOK-10: Non-build workflow → exit 0
  it('exits 0 for non-build workflow', () => {
    writeStateJson(env.isdlcDir, {
      active_workflow: { type: 'test-run' },
      phases: { '06-implementation': { status: 'in_progress' } }
    });
    const newState = { phases: { '06-implementation': { status: 'completed' } }, active_workflow: { type: 'test-run' } };
    const input = JSON.stringify({
      tool_name: 'Edit',
      tool_input: { file_path: path.join(env.tmpDir, '.isdlc/state.json'), new_string: JSON.stringify(newState) }
    });
    const result = runHook(env.hookPath, input, env.tmpDir);
    assert.equal(result.code, 0);
  });
});
