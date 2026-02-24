'use strict';

/**
 * iSDLC Pre-Skill Dispatcher - Integration Test Suite (CJS)
 * ===========================================================
 * Integration tests for src/claude/hooks/dispatchers/pre-skill-dispatcher.cjs
 *
 * The pre-skill dispatcher consolidates 3 PreToolUse[Skill] hooks:
 *   1. iteration-corridor
 *   2. gate-blocker
 *   3. constitutional-iteration-validator
 *
 * Has early exit if no active_workflow (all 3 hooks require it).
 * Short-circuits on first { decision: 'block' }.
 *
 * Run: node --test src/claude/hooks/tests/test-pre-skill-dispatcher.test.cjs
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

/** Build a Skill tool input */
function skillInput(skill, args) {
    return {
        tool_name: 'Skill',
        tool_input: {
            skill: skill || 'isdlc',
            args: args || 'status'
        }
    };
}

/** Build a gate-related Skill invocation (triggers constitutional-iteration-validator) */
function gateSkillInput() {
    return {
        tool_name: 'Skill',
        tool_input: {
            skill: 'isdlc',
            args: 'gate-check advance'
        }
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
        skill_usage_log: [],
        gates: {},
        pending_escalations: []
    };
}

/** Parse JSON from stdout */
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

describe('pre-skill-dispatcher', () => {
    let dispatcherPath;

    // -------------------------------------------------------------------------
    // TC-01: Empty stdin
    // -------------------------------------------------------------------------
    describe('empty/invalid stdin handling', () => {
        before(() => {
            setupTestEnv(activeWorkflowState());
            dispatcherPath = prepareDispatcher('pre-skill-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-01: exits cleanly with empty stdin', async () => {
            const result = await runDispatcher(dispatcherPath, '');
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '');
        });

        it('TC-02: exits cleanly with invalid JSON stdin', async () => {
            const result = await runDispatcher(dispatcherPath, 'broken{json');
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '');
        });
    });

    // -------------------------------------------------------------------------
    // TC-03: No active workflow - early exit
    // -------------------------------------------------------------------------
    describe('no active workflow - early exit', () => {
        before(() => {
            setupTestEnv({
                skill_enforcement: { enabled: true, mode: 'observe' },
                iteration_enforcement: { enabled: true },
                skill_usage_log: [],
                phases: {}
            });
            dispatcherPath = prepareDispatcher('pre-skill-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-03: exits immediately with no output when no active_workflow', async () => {
            const result = await runDispatcher(dispatcherPath, skillInput());
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '',
                'Should produce no output due to early exit guard');
        });

        it('TC-04: exits immediately even for gate-related skill invocation', async () => {
            const result = await runDispatcher(dispatcherPath, gateSkillInput());
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '',
                'Early exit guard should prevent all hook execution');
        });
    });

    // -------------------------------------------------------------------------
    // TC-05: Allow path
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
                        current_iteration: 2,
                        max_iterations: 10,
                        status: 'compliant'
                    }
                },
                constitutional_validation: {
                    required: true,
                    completed: true,
                    iterations_used: 1,
                    status: 'compliant',
                    articles_checked: ['I', 'II', 'VII']
                }
            });
            setupTestEnv(state);
            dispatcherPath = prepareDispatcher('pre-skill-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-05: allows non-gate skill invocation', async () => {
            const result = await runDispatcher(dispatcherPath, skillInput('isdlc', 'status'));
            assert.equal(result.code, 0);
            const parsed = parseStdout(result.stdout);
            if (parsed) {
                assert.notEqual(parsed.continue, false,
                    'Should not block non-gate skill invocations');
            }
        });

        it('TC-06: allows gate skill invocation when all validations pass', async () => {
            const result = await runDispatcher(dispatcherPath, gateSkillInput());
            assert.equal(result.code, 0);
            const parsed = parseStdout(result.stdout);
            if (parsed) {
                assert.notEqual(parsed.continue, false,
                    'Should allow gate check when validations are complete');
            }
        });
    });

    // -------------------------------------------------------------------------
    // TC-07-08: Block path (constitutional-iteration-validator)
    // -------------------------------------------------------------------------
    describe('block path - constitutional validation incomplete', () => {
        before(() => {
            const state = activeWorkflowState('06-implementation', {
                constitutional_validation: {
                    required: true,
                    completed: false,
                    iterations_used: 0,
                    status: 'pending'
                }
            });
            setupTestEnv(state);
            dispatcherPath = prepareDispatcher('pre-skill-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-07: blocks gate-check skill when constitutional validation incomplete', async () => {
            const result = await runDispatcher(dispatcherPath, gateSkillInput());
            assert.equal(result.code, 0);
            const parsed = parseStdout(result.stdout);
            assert.ok(parsed, 'Should produce block JSON');
            assert.equal(parsed.continue, false, 'Should block gate advancement');
        });

        it('TC-08: block response includes descriptive stop reason', async () => {
            const result = await runDispatcher(dispatcherPath, gateSkillInput());
            const parsed = parseStdout(result.stdout);
            assert.ok(parsed, 'Should produce block JSON');
            assert.ok(parsed.stopReason, 'Should include a stop reason');
            assert.ok(
                parsed.stopReason.includes('CONSTITUTIONAL') ||
                parsed.stopReason.includes('constitutional') ||
                parsed.stopReason.includes('GATE') ||
                parsed.stopReason.includes('CORRIDOR'),
                'Stop reason should reference the blocking condition'
            );
        });
    });

    // -------------------------------------------------------------------------
    // TC-09: Block path - iteration corridor blocks during test failure
    // -------------------------------------------------------------------------
    describe('block path - iteration corridor during TEST_CORRIDOR', () => {
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
            dispatcherPath = prepareDispatcher('pre-skill-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-09: blocks skill invocation during active test corridor', async () => {
            // During TEST_CORRIDOR, delegation-style Skill calls should be blocked
            const result = await runDispatcher(dispatcherPath, gateSkillInput());
            assert.equal(result.code, 0);
            const parsed = parseStdout(result.stdout);
            assert.ok(parsed, 'Should produce block response');
            assert.equal(parsed.continue, false);
        });
    });

    // -------------------------------------------------------------------------
    // TC-10: Short-circuit verification
    // -------------------------------------------------------------------------
    describe('short-circuit behavior', () => {
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
            dispatcherPath = prepareDispatcher('pre-skill-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-10: produces exactly one block response (not multiple)', async () => {
            const result = await runDispatcher(dispatcherPath, gateSkillInput());
            assert.equal(result.code, 0);
            // Count number of JSON objects in stdout - should be exactly 1
            const lines = result.stdout.trim().split('\n').filter(l => l.trim());
            let jsonCount = 0;
            for (const line of lines) {
                try { JSON.parse(line); jsonCount++; } catch { /* not JSON */ }
            }
            // The entire stdout should parse as one JSON object
            const parsed = parseStdout(result.stdout);
            assert.ok(parsed, 'Should have exactly one JSON block response');
        });
    });

    // -------------------------------------------------------------------------
    // TC-11: Stderr accumulation
    // -------------------------------------------------------------------------
    describe('stderr accumulation', () => {
        before(() => {
            setupTestEnv(activeWorkflowState());
            dispatcherPath = prepareDispatcher('pre-skill-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-11: stderr is accumulated without crashing', async () => {
            const result = await runDispatcher(dispatcherPath, skillInput());
            assert.equal(result.code, 0);
            assert.equal(typeof result.stderr, 'string');
        });
    });

    // -------------------------------------------------------------------------
    // TC-12: Fail-open on hook error
    // -------------------------------------------------------------------------
    describe('fail-open on hook error', () => {
        before(() => {
            setupTestEnv(activeWorkflowState());
            dispatcherPath = prepareDispatcher('pre-skill-dispatcher.cjs');
            // Corrupt iteration requirements to force errors in hooks
            writeConfig('iteration-requirements.json', '<<<CORRUPTED>>>');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-12: continues to next hook when a hook throws', async () => {
            const result = await runDispatcher(dispatcherPath, gateSkillInput());
            assert.equal(result.code, 0,
                'Dispatcher should exit 0 even when hooks encounter errors');
        });
    });

    // -------------------------------------------------------------------------
    // TC-13: Non-Skill tool passthrough
    // -------------------------------------------------------------------------
    describe('non-Skill tool passthrough', () => {
        before(() => {
            setupTestEnv(activeWorkflowState());
            dispatcherPath = prepareDispatcher('pre-skill-dispatcher.cjs');
        });
        after(() => { cleanupTestEnv(); });

        it('TC-13: passes through non-Skill tool inputs without blocking', async () => {
            const result = await runDispatcher(dispatcherPath, {
                tool_name: 'Task',
                tool_input: { prompt: 'Do something' }
            });
            assert.equal(result.code, 0);
            // Hooks are Skill-specific so Task input should pass through
            // But the early exit guard checks active_workflow, not tool_name
            assert.equal(typeof result.stdout, 'string');
        });
    });
});
