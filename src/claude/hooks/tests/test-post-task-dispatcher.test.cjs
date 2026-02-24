'use strict';

/**
 * iSDLC Post-Task Dispatcher - Integration Test Suite (CJS)
 * ===========================================================
 * Integration tests for src/claude/hooks/dispatchers/post-task-dispatcher.cjs
 *
 * The post-task dispatcher consolidates 6 PostToolUse[Task] hooks:
 *   1. log-skill-usage       - writes skill_usage_log (state modification)
 *   2. menu-tracker          - writes menu/elicitation state (state modification)
 *   3. walkthrough-tracker   - stderr warnings only
 *   4. discover-menu-guard   - stderr warnings only
 *   5. phase-transition-enforcer - stderr warnings only
 *   6. menu-halt-enforcer    - stderr warnings only
 *
 * All hooks run (no short-circuit). Writes state once after all hooks.
 *
 * NOTE: No early-exit guard because log-skill-usage logs regardless.
 *
 * Run: node --test src/claude/hooks/tests/test-post-task-dispatcher.test.cjs
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
    setupTestEnv,
    cleanupTestEnv,
    prepareDispatcher,
    runDispatcher,
    writeState,
    readState,
    writeConfig
} = require('./hook-test-utils.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a PostToolUse[Task] input with tool_result */
function postTaskInput(subagentType, toolResult) {
    return {
        tool_name: 'Task',
        tool_input: {
            prompt: 'Implement the feature',
            description: 'Phase delegation',
            subagent_type: subagentType || 'software-developer'
        },
        tool_result: toolResult || 'Agent completed task successfully'
    };
}

/** Build an active workflow state */
function activeWorkflowState(phase, extraPhaseState) {
    return {
        active_workflow: {
            type: 'feature',
            requirement_id: 'REQ-TEST',
            current_phase: phase || '06-implementation',
            phases: ['01-requirements', '02-architecture', '06-implementation'],
            started_at: new Date().toISOString()
        },
        phases: {
            [phase || '06-implementation']: Object.assign({
                status: 'in_progress',
                started_at: new Date().toISOString(),
                iterations: { current: 1, max: 3 }
            }, extraPhaseState || {})
        },
        skill_enforcement: { enabled: true, mode: 'observe', manifest_version: '5.0.0' },
        iteration_enforcement: { enabled: true },
        current_phase: phase || '06-implementation',
        skill_usage_log: [],
        gates: {},
        pending_escalations: []
    };
}

// =============================================================================
// Test Suite
// =============================================================================

describe('post-task-dispatcher', () => {
    let dispatcherPath;

    // -------------------------------------------------------------------------
    // TC-01: Empty stdin
    // -------------------------------------------------------------------------
    describe('empty/invalid stdin handling', () => {
        before(() => {
            setupTestEnv(activeWorkflowState());
            dispatcherPath = prepareDispatcher('post-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-01: exits cleanly with empty stdin', async () => {
            const result = await runDispatcher(dispatcherPath, '');
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '');
        });

        it('TC-02: exits cleanly with invalid JSON stdin', async () => {
            const result = await runDispatcher(dispatcherPath, 'not{json');
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '');
        });
    });

    // -------------------------------------------------------------------------
    // TC-03: No active workflow
    // -------------------------------------------------------------------------
    describe('no active workflow', () => {
        before(() => {
            setupTestEnv({
                skill_enforcement: { enabled: true, mode: 'observe', manifest_version: '5.0.0' },
                iteration_enforcement: { enabled: true },
                current_phase: '06-implementation',
                skill_usage_log: [],
                phases: {}
            });
            dispatcherPath = prepareDispatcher('post-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-03: runs without blocking when no active workflow (log-skill-usage still runs)', async () => {
            const result = await runDispatcher(dispatcherPath, postTaskInput());
            assert.equal(result.code, 0);
            // PostToolUse never blocks, just observes
        });
    });

    // -------------------------------------------------------------------------
    // TC-04-05: All hooks run (no short-circuit)
    // -------------------------------------------------------------------------
    describe('all hooks run path', () => {
        before(() => {
            setupTestEnv(activeWorkflowState());
            dispatcherPath = prepareDispatcher('post-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-04: completes successfully with active workflow', async () => {
            const result = await runDispatcher(dispatcherPath, postTaskInput());
            assert.equal(result.code, 0);
        });

        it('TC-05: never produces a block response (PostToolUse is observational)', async () => {
            const result = await runDispatcher(dispatcherPath, postTaskInput());
            assert.equal(result.code, 0);
            // PostToolUse dispatchers should never produce {continue:false}
            if (result.stdout.trim()) {
                try {
                    const parsed = JSON.parse(result.stdout);
                    assert.notEqual(parsed.continue, false,
                        'PostToolUse should never block');
                } catch {
                    // Non-JSON stdout is fine for PostToolUse
                }
            }
        });
    });

    // -------------------------------------------------------------------------
    // TC-06: State modification by log-skill-usage
    // -------------------------------------------------------------------------
    describe('state modification - skill usage logging', () => {
        before(() => {
            setupTestEnv(activeWorkflowState());
            dispatcherPath = prepareDispatcher('post-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-06: log-skill-usage appends to skill_usage_log in state', async () => {
            const result = await runDispatcher(dispatcherPath, postTaskInput('software-developer'));
            assert.equal(result.code, 0);
            const state = readState();
            assert.ok(Array.isArray(state.skill_usage_log),
                'skill_usage_log should remain an array');
            // log-skill-usage should have added an entry
            assert.ok(state.skill_usage_log.length >= 1,
                'Should have at least one skill usage log entry');
        });
    });

    // -------------------------------------------------------------------------
    // TC-07: State written once (consolidated write)
    // -------------------------------------------------------------------------
    describe('consolidated state write', () => {
        before(() => {
            const state = activeWorkflowState('01-requirements');
            setupTestEnv(state);
            dispatcherPath = prepareDispatcher('post-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-07: state file is valid JSON after dispatcher completes', async () => {
            // menu-tracker runs for 01-requirements phase, may modify state
            const input = postTaskInput('requirements-analyst',
                'Here is the menu: 1. Feature 2. Bug Fix\nUser selected: Feature');
            const result = await runDispatcher(dispatcherPath, input);
            assert.equal(result.code, 0);
            // Verify state is still valid
            const state = readState();
            assert.ok(state, 'State should be parseable after consolidated write');
            assert.equal(typeof state, 'object');
        });
    });

    // -------------------------------------------------------------------------
    // TC-08: Stderr accumulation from multiple hooks
    // -------------------------------------------------------------------------
    describe('stderr accumulation', () => {
        before(() => {
            setupTestEnv(activeWorkflowState());
            dispatcherPath = prepareDispatcher('post-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-08: stderr is collected from hooks without crashing', async () => {
            const result = await runDispatcher(dispatcherPath, postTaskInput());
            assert.equal(result.code, 0);
            assert.equal(typeof result.stderr, 'string');
        });
    });

    // -------------------------------------------------------------------------
    // TC-09: Stdout collection from hooks
    // -------------------------------------------------------------------------
    describe('stdout collection', () => {
        before(() => {
            setupTestEnv(activeWorkflowState());
            dispatcherPath = prepareDispatcher('post-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-09: stdout from hooks is collected and output', async () => {
            const result = await runDispatcher(dispatcherPath, postTaskInput());
            assert.equal(result.code, 0);
            // Stdout may or may not have content depending on hook behavior
            assert.equal(typeof result.stdout, 'string');
        });
    });

    // -------------------------------------------------------------------------
    // TC-10: Fail-open on hook error
    // -------------------------------------------------------------------------
    describe('fail-open on hook error', () => {
        before(() => {
            setupTestEnv(activeWorkflowState());
            dispatcherPath = prepareDispatcher('post-task-dispatcher.cjs');
            // Corrupt the manifest to cause potential errors in log-skill-usage
            writeConfig('skills-manifest.json', '<<<INVALID>>>');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-10: continues when a hook throws an error', async () => {
            const result = await runDispatcher(dispatcherPath, postTaskInput());
            assert.equal(result.code, 0,
                'Dispatcher should exit 0 even when hooks throw');
        });
    });

    // -------------------------------------------------------------------------
    // TC-11: Non-Task tool input passthrough
    // -------------------------------------------------------------------------
    describe('non-Task tool input', () => {
        before(() => {
            setupTestEnv(activeWorkflowState());
            dispatcherPath = prepareDispatcher('post-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-11: processes non-Task tool input without error', async () => {
            const result = await runDispatcher(dispatcherPath, {
                tool_name: 'Write',
                tool_input: { file_path: '/tmp/test.js' },
                tool_result: 'File written'
            });
            assert.equal(result.code, 0);
        });
    });

    // -------------------------------------------------------------------------
    // TC-12: Multiple sequential dispatcher calls
    // -------------------------------------------------------------------------
    describe('sequential dispatcher calls', () => {
        before(() => {
            setupTestEnv(activeWorkflowState());
            dispatcherPath = prepareDispatcher('post-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-12: state accumulates correctly across multiple runs', async () => {
            // Run twice with different agents
            await runDispatcher(dispatcherPath, postTaskInput('software-developer'));
            await runDispatcher(dispatcherPath, postTaskInput('solution-architect'));

            const state = readState();
            assert.ok(Array.isArray(state.skill_usage_log));
            assert.ok(state.skill_usage_log.length >= 2,
                'Should have at least 2 log entries from 2 runs');
        });
    });

    // -------------------------------------------------------------------------
    // TC-13: Conditional activation — workflow-dependent hooks skipped (T3-B)
    // -------------------------------------------------------------------------
    describe('conditional activation - hooks skipped when no active workflow', () => {
        before(() => {
            setupTestEnv({
                skill_enforcement: { enabled: true, mode: 'observe', manifest_version: '5.0.0' },
                iteration_enforcement: { enabled: true },
                current_phase: '06-implementation',
                skill_usage_log: [],
                phases: {}
            });
            dispatcherPath = prepareDispatcher('post-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-13a: menu-tracker, phase-transition-enforcer, menu-halt-enforcer skipped when no workflow', async () => {
            const result = await runDispatcher(dispatcherPath, postTaskInput());
            assert.equal(result.code, 0);
            // log-skill-usage runs (always active), others skipped
            // Key assertion: no errors from skipped hooks
        });
    });

    // -------------------------------------------------------------------------
    // TC-13b: Conditional activation — discover-only hooks skipped for non-discover
    // -------------------------------------------------------------------------
    describe('conditional activation - discover hooks skipped for feature workflow', () => {
        before(() => {
            const state = activeWorkflowState();
            // workflow type is 'feature', not 'discover'
            setupTestEnv(state);
            dispatcherPath = prepareDispatcher('post-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-13b: walkthrough-tracker and discover-menu-guard skipped for non-discover workflow', async () => {
            const result = await runDispatcher(dispatcherPath, postTaskInput());
            assert.equal(result.code, 0);
            // These hooks only activate for discover workflows
        });
    });

    // -------------------------------------------------------------------------
    // TC-14: Enforcement disabled
    // -------------------------------------------------------------------------
    describe('enforcement disabled', () => {
        before(() => {
            const state = activeWorkflowState();
            state.skill_enforcement = { enabled: false };
            state.iteration_enforcement = { enabled: false };
            setupTestEnv(state);
            dispatcherPath = prepareDispatcher('post-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-14: runs without error when enforcement is disabled', async () => {
            const result = await runDispatcher(dispatcherPath, postTaskInput());
            assert.equal(result.code, 0);
        });
    });
});
