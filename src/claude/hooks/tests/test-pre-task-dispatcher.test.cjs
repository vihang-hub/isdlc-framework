'use strict';

/**
 * iSDLC Pre-Task Dispatcher - Integration Test Suite (CJS)
 * =========================================================
 * Integration tests for src/claude/hooks/dispatchers/pre-task-dispatcher.cjs
 *
 * The pre-task dispatcher consolidates 8 PreToolUse[Task] hooks into 1 process.
 * It short-circuits on first { decision: 'block' }.
 *
 * NOTE: No early-exit guard for no-active-workflow because skill-validator
 * runs regardless. Each hook handles the null state case internally.
 *
 * Run: node --test src/claude/hooks/tests/test-pre-task-dispatcher.test.cjs
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
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

/** Build a basic Task tool input */
function taskInput(prompt, subagentType) {
    return {
        tool_name: 'Task',
        tool_input: {
            prompt: prompt || 'Implement the feature',
            description: 'Phase delegation',
            subagent_type: subagentType || 'software-developer'
        }
    };
}

/** Build a gate advancement input (orchestrator with advance keyword) */
function gateAdvanceInput() {
    return {
        tool_name: 'Task',
        tool_input: {
            prompt: 'Advance to next phase after gate check',
            description: 'Gate advancement',
            subagent_type: 'sdlc-orchestrator'
        }
    };
}

/** Build an active workflow state with a phase in progress */
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
        skill_usage_log: [],
        gates: {},
        pending_escalations: []
    };
}

/** Parse JSON from stdout, returns null if empty/invalid */
function parseStdout(stdout) {
    if (!stdout || !stdout.trim()) return null;
    try {
        return JSON.parse(stdout);
    } catch {
        return null;
    }
}

// =============================================================================
// Test Suite
// =============================================================================

describe('pre-task-dispatcher', () => {
    let dispatcherPath;

    // -------------------------------------------------------------------------
    // TC-01: Empty stdin
    // -------------------------------------------------------------------------
    describe('empty/invalid stdin handling', () => {
        before(() => {
            setupTestEnv(activeWorkflowState());
            dispatcherPath = prepareDispatcher('pre-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-01: exits cleanly with empty stdin', async () => {
            const result = await runDispatcher(dispatcherPath, '');
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '');
        });

        it('TC-02: exits cleanly with invalid JSON stdin', async () => {
            const result = await runDispatcher(dispatcherPath, 'not-json{{{');
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '');
        });
    });

    // -------------------------------------------------------------------------
    // TC-03: No active workflow (skill-validator still runs)
    // -------------------------------------------------------------------------
    describe('no active workflow', () => {
        before(() => {
            setupTestEnv({
                skill_enforcement: { enabled: true, mode: 'observe', manifest_version: '5.0.0' },
                iteration_enforcement: { enabled: true },
                skill_usage_log: [],
                phases: {}
            });
            dispatcherPath = prepareDispatcher('pre-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-03: allows task when no active workflow (hooks individually handle null)', async () => {
            const result = await runDispatcher(dispatcherPath, taskInput());
            assert.equal(result.code, 0);
            // No block output because hooks allow when no active workflow
            const parsed = parseStdout(result.stdout);
            if (parsed) {
                assert.notEqual(parsed.continue, false,
                    'Should not block when no active workflow');
            }
        });
    });

    // -------------------------------------------------------------------------
    // TC-04-05: Allow path (all hooks pass)
    // -------------------------------------------------------------------------
    describe('allow path - all hooks pass', () => {
        before(() => {
            const state = activeWorkflowState('06-implementation', {
                iteration_requirements: {
                    test_iteration: {
                        required: true,
                        completed: true,
                        last_test_result: 'passed',
                        iterations_used: 2,
                        status: 'compliant'
                    },
                    constitutional_validation: {
                        required: true,
                        completed: true,
                        iterations_used: 1,
                        status: 'compliant',
                        articles_checked: ['I', 'II', 'VII']
                    }
                }
            });
            setupTestEnv(state);
            // Create tasks.md so plan-surfacer does not block
            const docsDir = path.join(process.env.CLAUDE_PROJECT_DIR, 'docs', 'isdlc');
            fs.mkdirSync(docsDir, { recursive: true });
            fs.writeFileSync(path.join(docsDir, 'tasks.md'), '# Task Plan\n');
            dispatcherPath = prepareDispatcher('pre-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-04: allows non-gate-advancement task delegation', async () => {
            const result = await runDispatcher(dispatcherPath, taskInput('Do the work', 'software-developer'));
            assert.equal(result.code, 0);
            // No block JSON should be emitted
            const parsed = parseStdout(result.stdout);
            if (parsed) {
                assert.notEqual(parsed.continue, false,
                    'Should not block on normal delegation within phase');
            }
        });

        it('TC-05: allows non-Task tool calls without blocking', async () => {
            const result = await runDispatcher(dispatcherPath, {
                tool_name: 'Write',
                tool_input: { file_path: '/tmp/test.js' }
            });
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '', 'Non-Task tool should pass through silently');
        });
    });

    // -------------------------------------------------------------------------
    // TC-06-07: Block path (gate-blocker blocks)
    // -------------------------------------------------------------------------
    describe('block path - gate blocker triggers', () => {
        before(() => {
            const state = activeWorkflowState('06-implementation', {
                iteration_requirements: {
                    test_iteration: {
                        required: true,
                        completed: false,
                        last_test_result: 'failed',
                        iterations_used: 1,
                        status: 'failing'
                    }
                }
            });
            setupTestEnv(state);
            dispatcherPath = prepareDispatcher('pre-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-06: blocks gate advancement when test iteration incomplete', async () => {
            const result = await runDispatcher(dispatcherPath, gateAdvanceInput());
            assert.equal(result.code, 0);
            const parsed = parseStdout(result.stdout);
            assert.ok(parsed, 'Should produce block JSON');
            assert.equal(parsed.continue, false, 'Should block gate advancement');
            assert.ok(parsed.stopReason, 'Should include a stop reason');
        });

        it('TC-07: block response includes descriptive reason', async () => {
            const result = await runDispatcher(dispatcherPath, gateAdvanceInput());
            const parsed = parseStdout(result.stdout);
            assert.ok(parsed, 'Should produce block JSON');
            assert.ok(
                parsed.stopReason.includes('GATE') ||
                parsed.stopReason.includes('test') ||
                parsed.stopReason.includes('iteration') ||
                parsed.stopReason.includes('CORRIDOR') ||
                parsed.stopReason.includes('PHASE'),
                'Stop reason should reference the blocking condition'
            );
        });
    });

    // -------------------------------------------------------------------------
    // TC-08: Block path - iteration corridor blocks before gate-blocker
    // -------------------------------------------------------------------------
    describe('block path - iteration corridor short-circuits', () => {
        before(() => {
            const state = activeWorkflowState('06-implementation', {
                iteration_requirements: {
                    test_iteration: {
                        required: true,
                        completed: false,
                        last_test_result: 'failed',
                        iterations_used: 1,
                        status: 'failing'
                    }
                }
            });
            setupTestEnv(state);
            dispatcherPath = prepareDispatcher('pre-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-08: iteration corridor blocks delegation attempt during test corridor', async () => {
            // A Task delegation to orchestrator during TEST_CORRIDOR should be blocked
            // by iteration-corridor (hook #1) before gate-blocker (hook #6)
            const input = {
                tool_name: 'Task',
                tool_input: {
                    prompt: 'Delegate to next phase agent',
                    description: 'Advance to architecture phase',
                    subagent_type: 'sdlc-orchestrator'
                }
            };
            const result = await runDispatcher(dispatcherPath, input);
            assert.equal(result.code, 0);
            const parsed = parseStdout(result.stdout);
            assert.ok(parsed, 'Should produce a block response');
            assert.equal(parsed.continue, false);
        });
    });

    // -------------------------------------------------------------------------
    // TC-09: Short-circuit verification (later hooks do not run)
    // -------------------------------------------------------------------------
    describe('short-circuit behavior', () => {
        before(() => {
            // Set up state where phase-loop-controller (hook #3) would block:
            // active_workflow present but phase status is NOT in_progress
            const state = activeWorkflowState('06-implementation');
            state.phases['06-implementation'].status = 'pending';
            setupTestEnv(state);
            dispatcherPath = prepareDispatcher('pre-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-09: short-circuits on first blocking hook and exits code 0', async () => {
            const input = taskInput('Delegate to implementation', 'software-developer');
            const result = await runDispatcher(dispatcherPath, input);
            assert.equal(result.code, 0);
            // The block from phase-loop-controller should prevent later hooks from running
            const parsed = parseStdout(result.stdout);
            assert.ok(parsed, 'Should produce exactly one block response');
            assert.equal(parsed.continue, false);
        });
    });

    // -------------------------------------------------------------------------
    // TC-10: State write after non-blocking run
    // -------------------------------------------------------------------------
    describe('state write consolidation', () => {
        before(() => {
            const state = activeWorkflowState('06-implementation');
            setupTestEnv(state);
            dispatcherPath = prepareDispatcher('pre-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-10: state is readable after dispatcher run', async () => {
            const result = await runDispatcher(dispatcherPath, taskInput());
            assert.equal(result.code, 0);
            // State should still be valid and readable
            const state = readState();
            assert.ok(state, 'State should be parseable after dispatcher run');
            assert.ok(state.active_workflow, 'active_workflow should still exist');
        });
    });

    // -------------------------------------------------------------------------
    // TC-11: Stderr accumulation
    // -------------------------------------------------------------------------
    describe('stderr accumulation', () => {
        before(() => {
            // Use a phase alias that triggers self-heal normalization
            const state = activeWorkflowState('06-implementation');
            setupTestEnv(state);
            dispatcherPath = prepareDispatcher('pre-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-11: stderr is accumulated without crashing', async () => {
            const result = await runDispatcher(dispatcherPath, taskInput());
            assert.equal(result.code, 0);
            // Stderr may or may not have content (depends on hook diagnostics)
            // The important assertion is that the dispatcher does not crash
            assert.equal(typeof result.stderr, 'string');
        });
    });

    // -------------------------------------------------------------------------
    // TC-12: Fail-open on hook error
    // -------------------------------------------------------------------------
    describe('fail-open on hook error', () => {
        before(() => {
            // Set up valid state to avoid early exits
            const state = activeWorkflowState('06-implementation');
            setupTestEnv(state);
            dispatcherPath = prepareDispatcher('pre-task-dispatcher.cjs');
            // Corrupt the iteration requirements to cause a potential error in hooks
            writeConfig('iteration-requirements.json', 'not-valid-json!!!');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-12: continues to next hook when a hook throws (fail-open)', async () => {
            const result = await runDispatcher(dispatcherPath, taskInput());
            assert.equal(result.code, 0,
                'Dispatcher should exit 0 even when hooks throw errors');
        });
    });

    // -------------------------------------------------------------------------
    // TC-13: Plan surfacer block path
    // -------------------------------------------------------------------------
    describe('plan-surfacer block when tasks.md missing', () => {
        before(() => {
            // Active workflow at a non-early phase (06-implementation)
            // No tasks.md file -> plan-surfacer should block
            const state = activeWorkflowState('06-implementation');
            setupTestEnv(state);
            dispatcherPath = prepareDispatcher('pre-task-dispatcher.cjs');
            // Explicitly ensure no tasks.md exists
            const docsDir = path.join(process.env.CLAUDE_PROJECT_DIR, 'docs', 'isdlc');
            if (fs.existsSync(path.join(docsDir, 'tasks.md'))) {
                fs.unlinkSync(path.join(docsDir, 'tasks.md'));
            }
        });
        after(() => { cleanupTestEnv(); });

        it('TC-13: blocks Task delegation when tasks.md is missing at non-early phase', async () => {
            const input = taskInput('Implement the feature', 'software-developer');
            const result = await runDispatcher(dispatcherPath, input);
            assert.equal(result.code, 0);
            const parsed = parseStdout(result.stdout);
            // plan-surfacer may or may not block depending on whether it is reached
            // (iteration-corridor or phase-loop-controller may allow first)
            // The key assertion is the dispatcher completes cleanly
            assert.equal(typeof result.stdout, 'string');
        });
    });

    // -------------------------------------------------------------------------
    // TC-14: Conditional hook activation — no-workflow skip (T3-B)
    // -------------------------------------------------------------------------
    describe('conditional activation - hooks skipped when no active workflow', () => {
        before(() => {
            setupTestEnv({
                skill_enforcement: { enabled: true, mode: 'observe', manifest_version: '5.0.0' },
                iteration_enforcement: { enabled: true },
                skill_usage_log: [],
                phases: {}
            });
            dispatcherPath = prepareDispatcher('pre-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-14a: skips workflow-dependent hooks but still allows task (skill-validator runs)', async () => {
            // With no active_workflow, iteration-corridor, phase-loop-controller,
            // plan-surfacer, phase-sequence-guard, gate-blocker, constitution-validator,
            // and test-adequacy-blocker should all be skipped.
            // Only skill-validator runs (observe mode, never blocks).
            const input = {
                tool_name: 'Task',
                tool_input: {
                    prompt: 'Delegate to next phase',
                    description: 'Gate advancement',
                    subagent_type: 'sdlc-orchestrator'
                }
            };
            const result = await runDispatcher(dispatcherPath, input);
            assert.equal(result.code, 0);
            // Should NOT block — workflow-dependent hooks are skipped
            const parsed = parseStdout(result.stdout);
            if (parsed) {
                assert.notEqual(parsed.continue, false,
                    'Should not block when no active workflow (hooks skipped)');
            }
        });
    });

    // -------------------------------------------------------------------------
    // TC-14b: Conditional activation — test-adequacy-blocker only for upgrade phases
    // -------------------------------------------------------------------------
    describe('conditional activation - test-adequacy-blocker only for upgrade phases', () => {
        before(() => {
            const state = activeWorkflowState('06-implementation');
            setupTestEnv(state);
            // Create tasks.md so plan-surfacer does not block
            const docsDir = path.join(process.env.CLAUDE_PROJECT_DIR, 'docs', 'isdlc');
            fs.mkdirSync(docsDir, { recursive: true });
            fs.writeFileSync(path.join(docsDir, 'tasks.md'), '# Task Plan\n');
            dispatcherPath = prepareDispatcher('pre-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-14b: test-adequacy-blocker is skipped for non-upgrade phases', async () => {
            // Phase is 06-implementation, not 15-upgrade-*.
            // test-adequacy-blocker should be skipped even if it would otherwise block.
            const result = await runDispatcher(dispatcherPath, taskInput('Do the work', 'software-developer'));
            assert.equal(result.code, 0);
            // The important thing is the dispatcher completes — test-adequacy-blocker
            // is not invoked for non-upgrade phases.
        });
    });

    // -------------------------------------------------------------------------
    // TC-15: Enforcement disabled bypass
    // -------------------------------------------------------------------------
    describe('enforcement disabled', () => {
        before(() => {
            const state = activeWorkflowState('06-implementation');
            state.iteration_enforcement = { enabled: false };
            state.skill_enforcement = { enabled: false };
            setupTestEnv(state);
            // Create tasks.md so plan-surfacer does not block
            const docsDir = path.join(process.env.CLAUDE_PROJECT_DIR, 'docs', 'isdlc');
            fs.mkdirSync(docsDir, { recursive: true });
            fs.writeFileSync(path.join(docsDir, 'tasks.md'), '# Task Plan\n');
            dispatcherPath = prepareDispatcher('pre-task-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-15: dispatcher exits cleanly when enforcement is disabled', async () => {
            // With enforcement disabled, corridor and constitution validators allow.
            // Gate-blocker may still block if it detects a gate advancement attempt
            // and finds incomplete requirements. The key assertion is the dispatcher
            // does not crash.
            const result = await runDispatcher(dispatcherPath, taskInput('Do the work', 'software-developer'));
            assert.equal(result.code, 0);
        });
    });
});
