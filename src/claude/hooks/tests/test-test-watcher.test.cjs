'use strict';

/**
 * iSDLC Test Watcher - Test Suite (CJS)
 * =======================================
 * Unit tests for src/claude/hooks/test-watcher.js
 *
 * The test-watcher hook is a PostToolUse hook that monitors Bash tool executions
 * for test commands. When a test command is detected, it parses the result for
 * pass/fail, updates the iteration counter in state.json, checks for circuit
 * breaker conditions, and outputs guidance to the agent.
 *
 * IMPORTANT: PostToolUse hooks receive tool_result in the input JSON:
 * {
 *   "tool_name": "Bash",
 *   "tool_input": { "command": "npm test" },
 *   "tool_result": "output of the command..."
 * }
 *
 * IMPORTANT: Hooks use CommonJS require() but the project package.json has
 * "type": "module". We copy the hook + lib/common.js to the temp test directory
 * (which is outside the ESM package scope) so Node treats .js files as CJS.
 *
 * Run: node --test src/claude/hooks/tests/test-test-watcher.test.cjs
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
    setupTestEnv,
    cleanupTestEnv,
    getTestDir,
    writeState,
    readState,
    runHook
} = require('./hook-test-utils.cjs');

/** Source paths */
const hookSrcPath = path.resolve(__dirname, '..', 'test-watcher.cjs');
const commonSrcPath = path.resolve(__dirname, '..', 'lib', 'common.cjs');

/**
 * Copy the hook file and its lib/common.cjs dependency into the temp test dir.
 * Returns the absolute path to the copied hook file.
 */
function installHook() {
    const testDir = getTestDir();
    const libDir = path.join(testDir, 'lib');
    if (!fs.existsSync(libDir)) {
        fs.mkdirSync(libDir, { recursive: true });
    }
    fs.copyFileSync(commonSrcPath, path.join(libDir, 'common.cjs'));
    const hookDest = path.join(testDir, 'test-watcher.cjs');
    fs.copyFileSync(hookSrcPath, hookDest);
    return hookDest;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a PostToolUse Bash input with command and result.
 * @param {string} command - The bash command
 * @param {string} output - The command output (tool_result)
 * @param {number} [exitCode] - Optional exit code embedded in result
 */
function bashTestInput(command, output, exitCode) {
    const input = {
        tool_name: 'Bash',
        tool_input: { command }
    };
    if (exitCode !== undefined) {
        // Embed exit code in a structured result object
        input.tool_result = { output, exitCode };
    } else {
        input.tool_result = output;
    }
    return input;
}

/**
 * Base state for a phase with test_iteration enabled.
 * Uses phase 06-implementation which has test_iteration.enabled: true in the
 * iteration-requirements.json config.
 *
 * NOTE: active_workflow is required — test-watcher exits silently when
 * no active workflow exists (to avoid noise during casual test runs).
 */
function baseTestState(extras) {
    return {
        current_phase: '06-implementation',
        iteration_enforcement: { enabled: true },
        active_workflow: {
            type: 'feature',
            current_phase: '06-implementation',
            current_phase_index: 5
        },
        phases: {
            '06-implementation': {
                status: 'in_progress',
                ...((extras && extras.phase) || {})
            }
        }
    };
}

/**
 * State with an existing test_iteration that has failed N times.
 */
function failedIterationState(iteration, maxIter, extras) {
    return baseTestState({
        phase: {
            iteration_requirements: {
                test_iteration: {
                    required: true,
                    completed: false,
                    current_iteration: iteration || 1,
                    max_iterations: maxIter || 10,
                    failures_count: iteration || 1,
                    identical_failure_count: 0,
                    last_test_result: 'failed',
                    last_test_command: 'npm test',
                    history: [],
                    started_at: '2026-01-01T00:00:00.000Z',
                    ...((extras && extras.test_iteration) || {})
                }
            }
        }
    });
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('test-watcher.js', () => {
    let hookPath;

    beforeEach(() => {
        setupTestEnv();
        hookPath = installHook();
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    // -----------------------------------------------------------------------
    // 1. Non-Bash tool passes through
    // -----------------------------------------------------------------------
    it('passes through non-Bash tools (e.g., Task)', async () => {
        cleanupTestEnv();
        setupTestEnv(baseTestState());
        hookPath = installHook();

        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: { prompt: 'Run the test suite' },
            tool_result: 'Done'
        });
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Non-Bash tool should pass through silently');
    });

    // -----------------------------------------------------------------------
    // 2. Bash command that's not a test
    // -----------------------------------------------------------------------
    it('passes through Bash commands that are not test commands (e.g., npm install)', async () => {
        cleanupTestEnv();
        setupTestEnv(baseTestState());
        hookPath = installHook();

        const result = await runHook(hookPath, bashTestInput('npm install', 'added 150 packages'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Non-test Bash command should pass through');
    });

    // -----------------------------------------------------------------------
    // 3. npm test with passing output - records success
    // -----------------------------------------------------------------------
    it('records success in state when npm test passes', async () => {
        cleanupTestEnv();
        setupTestEnv(baseTestState());
        hookPath = installHook();

        const output = 'Test Suites: 5 passed, 5 total\nTests: 20 passed, 0 failed, 20 total\nAll tests passed';
        const result = await runHook(hookPath, bashTestInput('npm test', output));
        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('TESTS PASSED'), 'Should output success message');

        const state = readState();
        const iterState = state.phases['06-implementation'].iteration_requirements.test_iteration;
        assert.ok(iterState, 'test_iteration state should be created');
        assert.equal(iterState.completed, true);
        assert.equal(iterState.status, 'success');
        assert.equal(iterState.last_test_result, 'passed');
    });

    // -----------------------------------------------------------------------
    // 4. npm test with failing output - records failure
    // -----------------------------------------------------------------------
    it('records failure in state when npm test fails', async () => {
        cleanupTestEnv();
        setupTestEnv(baseTestState());
        hookPath = installHook();

        const output = 'Tests: 3 failed, 17 passed, 20 total\nFAIL src/auth.test.js\nError: Expected true to be false';
        const result = await runHook(hookPath, bashTestInput('npm test', output));
        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('TESTS FAILED'), 'Should output failure message');

        const state = readState();
        const iterState = state.phases['06-implementation'].iteration_requirements.test_iteration;
        assert.equal(iterState.completed, false);
        assert.equal(iterState.last_test_result, 'failed');
        assert.ok(iterState.failures_count >= 1);
    });

    // -----------------------------------------------------------------------
    // 5. pytest detected as test command
    // -----------------------------------------------------------------------
    it('detects pytest as a test command', async () => {
        cleanupTestEnv();
        setupTestEnv(baseTestState());
        hookPath = installHook();

        const output = '5 passed in 2.1s\nAll tests passed';
        const result = await runHook(hookPath, bashTestInput('pytest tests/', output));
        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('TESTS PASSED'), 'pytest should be detected as test command');
    });

    // -----------------------------------------------------------------------
    // 6. go test detected as test command
    // -----------------------------------------------------------------------
    it('detects go test as a test command', async () => {
        cleanupTestEnv();
        setupTestEnv(baseTestState());
        hookPath = installHook();

        const output = 'ok  \tgithub.com/user/repo\t0.5s\n3 passing\nPASSED';
        const result = await runHook(hookPath, bashTestInput('go test ./...', output));
        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('TESTS PASSED'), 'go test should be detected');
    });

    // -----------------------------------------------------------------------
    // 7. cargo test detected as test command
    // -----------------------------------------------------------------------
    it('detects cargo test as a test command', async () => {
        cleanupTestEnv();
        setupTestEnv(baseTestState());
        hookPath = installHook();

        const output = 'test result: ok. 10 passed; 0 failed; 0 ignored\nAll tests passed';
        const result = await runHook(hookPath, bashTestInput('cargo test', output));
        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('TESTS PASSED'), 'cargo test should be detected');
    });

    // -----------------------------------------------------------------------
    // 8. jest detected as test command
    // -----------------------------------------------------------------------
    it('detects jest as a test command', async () => {
        cleanupTestEnv();
        setupTestEnv(baseTestState());
        hookPath = installHook();

        const output = 'Tests: 8 passed, 0 failed, 8 total\nAll tests passed';
        const result = await runHook(hookPath, bashTestInput('jest --coverage', output));
        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('TESTS PASSED'), 'jest should be detected');
    });

    // -----------------------------------------------------------------------
    // 9. First failure creates iteration state
    // -----------------------------------------------------------------------
    it('creates iteration state on first test failure', async () => {
        cleanupTestEnv();
        setupTestEnv(baseTestState());
        hookPath = installHook();

        const output = 'FAIL src/app.test.js\n1 failed, 4 passed\nError: assertion failed';
        const result = await runHook(hookPath, bashTestInput('npm test', output));
        assert.equal(result.code, 0);

        const state = readState();
        const iterState = state.phases['06-implementation'].iteration_requirements.test_iteration;
        assert.ok(iterState, 'test_iteration should be created');
        assert.equal(iterState.current_iteration, 1);
        assert.equal(iterState.completed, false);
        assert.equal(iterState.last_test_result, 'failed');
        assert.ok(iterState.started_at, 'Should have started_at timestamp');
        assert.ok(Array.isArray(iterState.history), 'Should have history array');
        assert.equal(iterState.history.length, 1);
        assert.equal(iterState.history[0].result, 'FAILED');
    });

    // -----------------------------------------------------------------------
    // 10. Second failure increments iteration counter
    // -----------------------------------------------------------------------
    it('increments iteration counter on subsequent failures', async () => {
        cleanupTestEnv();
        setupTestEnv(failedIterationState(2, 10));
        hookPath = installHook();

        const output = 'FAIL src/app.test.js\n1 failed\nTypeError: Cannot read property';
        const result = await runHook(hookPath, bashTestInput('npm test', output));
        assert.equal(result.code, 0);

        const state = readState();
        const iterState = state.phases['06-implementation'].iteration_requirements.test_iteration;
        assert.equal(iterState.current_iteration, 3, 'Should increment from 2 to 3');
        assert.equal(iterState.completed, false);
    });

    // -----------------------------------------------------------------------
    // 11. Success after failure marks completed=true, status="success"
    // -----------------------------------------------------------------------
    it('marks iteration as completed with status "success" after passing tests', async () => {
        cleanupTestEnv();
        setupTestEnv(failedIterationState(3, 10));
        hookPath = installHook();

        const output = 'All tests passed\nTests: 10 passed, 0 failed, 10 total';
        const result = await runHook(hookPath, bashTestInput('npm test', output));
        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('TESTS PASSED'), 'Should announce success');

        const state = readState();
        const iterState = state.phases['06-implementation'].iteration_requirements.test_iteration;
        assert.equal(iterState.completed, true);
        assert.equal(iterState.status, 'success');
        assert.equal(iterState.last_test_result, 'passed');
        assert.ok(iterState.completed_at, 'Should have completed_at timestamp');
    });

    // -----------------------------------------------------------------------
    // 12. Max iterations exceeded triggers escalation
    // -----------------------------------------------------------------------
    it('escalates when max iterations are exceeded', async () => {
        // Set current_iteration to 9, max_iterations to 10 -- next failure will be #10 = max
        cleanupTestEnv();
        setupTestEnv(failedIterationState(9, 10));
        hookPath = installHook();

        const output = 'FAIL\n1 failed\nError: Something broken';
        const result = await runHook(hookPath, bashTestInput('npm test', output));
        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('MAX ITERATIONS EXCEEDED'), 'Should announce max iterations');

        const state = readState();
        const iterState = state.phases['06-implementation'].iteration_requirements.test_iteration;
        assert.equal(iterState.completed, true);
        assert.equal(iterState.status, 'escalated');
        assert.equal(iterState.escalation_reason, 'max_iterations');
    });

    // -----------------------------------------------------------------------
    // 13. Enforcement disabled - no state changes
    // -----------------------------------------------------------------------
    it('passes through without state changes when enforcement is disabled', async () => {
        cleanupTestEnv();
        setupTestEnv({
            current_phase: '06-implementation',
            iteration_enforcement: { enabled: false },
            active_workflow: { type: 'feature', current_phase: '06-implementation' },
            phases: {
                '06-implementation': { status: 'in_progress' }
            }
        });
        hookPath = installHook();

        const output = 'FAIL\n3 failed\nError: bad';
        const result = await runHook(hookPath, bashTestInput('npm test', output));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Should be silent when enforcement disabled');

        const state = readState();
        // Should NOT have created iteration_requirements
        assert.ok(
            !state.phases['06-implementation'].iteration_requirements,
            'Should not create iteration state when enforcement disabled'
        );
    });

    // -----------------------------------------------------------------------
    // 14. Exit code extraction from structured tool_result
    // -----------------------------------------------------------------------
    it('detects failure from exitCode in structured tool_result', async () => {
        cleanupTestEnv();
        setupTestEnv(baseTestState());
        hookPath = installHook();

        // No output but exit code 1 -- should be detected as failure
        const result = await runHook(hookPath, bashTestInput('npm test', '', 1));
        assert.equal(result.code, 0);

        const state = readState();
        const iterState = state.phases['06-implementation'].iteration_requirements.test_iteration;
        assert.equal(iterState.last_test_result, 'failed', 'Should detect failure from exit code');
    });

    // -----------------------------------------------------------------------
    // 15. Output with "FAIL" keyword detected as failure
    // -----------------------------------------------------------------------
    it('detects failure from FAIL keyword in output', async () => {
        cleanupTestEnv();
        setupTestEnv(baseTestState());
        hookPath = installHook();

        const output = 'FAIL src/components/Button.test.js\n  Expected: true\n  Received: false';
        const result = await runHook(hookPath, bashTestInput('npm test', output));
        assert.equal(result.code, 0);

        const state = readState();
        const iterState = state.phases['06-implementation'].iteration_requirements.test_iteration;
        assert.equal(iterState.last_test_result, 'failed', 'Should detect FAIL keyword');
    });

    // -----------------------------------------------------------------------
    // 16. Output with "Tests: 5 passed, 0 failed" detected as success
    // -----------------------------------------------------------------------
    it('detects success from "Tests: N passed, 0 failed" pattern', async () => {
        cleanupTestEnv();
        setupTestEnv(baseTestState());
        hookPath = installHook();

        const output = 'Tests: 5 passed, 0 failed, 5 total\nTime: 2.5s';
        const result = await runHook(hookPath, bashTestInput('npm test', output));
        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('TESTS PASSED'), 'Should detect success pattern');

        const state = readState();
        const iterState = state.phases['06-implementation'].iteration_requirements.test_iteration;
        assert.equal(iterState.last_test_result, 'passed');
        assert.equal(iterState.completed, true);
        assert.equal(iterState.status, 'success');
    });

    // -----------------------------------------------------------------------
    // 17. No state.json - passes through silently
    // -----------------------------------------------------------------------
    it('passes through when state.json does not exist', async () => {
        cleanupTestEnv();
        const testDir = setupTestEnv();
        hookPath = installHook();
        fs.unlinkSync(path.join(testDir, '.isdlc', 'state.json'));

        const output = 'FAIL\n1 failed';
        const result = await runHook(hookPath, bashTestInput('npm test', output));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Should pass through when no state');
    });

    // -----------------------------------------------------------------------
    // 17b. No active_workflow - passes through silently (no iteration noise)
    // -----------------------------------------------------------------------
    it('passes through silently when no active_workflow exists', async () => {
        cleanupTestEnv();
        setupTestEnv({
            current_phase: '06-implementation',
            iteration_enforcement: { enabled: true },
            // No active_workflow — casual test run outside SDLC workflow
            phases: {
                '06-implementation': { status: 'in_progress' }
            }
        });
        hookPath = installHook();

        const output = 'FAIL\n3 failed\nError: assertion failed';
        const result = await runHook(hookPath, bashTestInput('npm test', output));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Should pass through silently without active workflow');

        // Should NOT modify state
        const state = readState();
        assert.ok(
            !state.phases['06-implementation'].iteration_requirements,
            'Should not create iteration state when no active workflow'
        );
    });

    // -----------------------------------------------------------------------
    // 18. vitest detected as test command
    // -----------------------------------------------------------------------
    it('detects vitest as a test command', async () => {
        cleanupTestEnv();
        setupTestEnv(baseTestState());
        hookPath = installHook();

        const output = 'Tests: 12 passed, 0 failed\nAll tests passed';
        const result = await runHook(hookPath, bashTestInput('vitest run', output));
        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('TESTS PASSED'), 'vitest should be detected');
    });

    // -----------------------------------------------------------------------
    // 19. mvn test detected as test command
    // -----------------------------------------------------------------------
    it('detects mvn test as a test command', async () => {
        cleanupTestEnv();
        setupTestEnv(baseTestState());
        hookPath = installHook();

        const output = 'BUILD SUCCESS\nTests run: 25, Failures: 0, Errors: 0';
        const result = await runHook(hookPath, bashTestInput('mvn test', output));
        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('TESTS PASSED'), 'mvn test should be detected');
    });

    // -----------------------------------------------------------------------
    // 20. History entry is recorded for each test run
    // -----------------------------------------------------------------------
    it('records history entry with correct fields for each test run', async () => {
        cleanupTestEnv();
        setupTestEnv(baseTestState());
        hookPath = installHook();

        const output = 'FAIL src/app.test.js\n2 failed\nError: assertion failed';
        await runHook(hookPath, bashTestInput('npm test', output));

        const state = readState();
        const iterState = state.phases['06-implementation'].iteration_requirements.test_iteration;
        assert.equal(iterState.history.length, 1);
        const entry = iterState.history[0];
        assert.equal(entry.iteration, 1);
        assert.equal(entry.result, 'FAILED');
        assert.equal(entry.command, 'npm test');
        assert.ok(entry.timestamp, 'History entry should have timestamp');
        assert.ok(entry.error, 'History entry should have error');
    });

    // -----------------------------------------------------------------------
    // 21. Phase without test_iteration enabled passes through
    // -----------------------------------------------------------------------
    it('passes through for a phase with test_iteration disabled', async () => {
        cleanupTestEnv();
        setupTestEnv({
            current_phase: '01-requirements',
            iteration_enforcement: { enabled: true },
            active_workflow: { type: 'feature', current_phase: '01-requirements' },
            phases: {
                '01-requirements': { status: 'in_progress' }
            }
        });
        hookPath = installHook();

        const output = 'FAIL\n1 failed';
        const result = await runHook(hookPath, bashTestInput('npm test', output));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Phase without test_iteration enabled should pass through');
    });

    // -----------------------------------------------------------------------
    // 22. Exit code in string format "exited with code 1"
    // -----------------------------------------------------------------------
    it('extracts exit code from string "exited with code 1" in tool_result', async () => {
        cleanupTestEnv();
        setupTestEnv(baseTestState());
        hookPath = installHook();

        const output = 'npm test exited with code 1';
        const result = await runHook(hookPath, bashTestInput('npm test', output));
        assert.equal(result.code, 0);

        const state = readState();
        const iterState = state.phases['06-implementation'].iteration_requirements.test_iteration;
        assert.equal(iterState.last_test_result, 'failed', 'Should detect failure from "exited with code 1"');
    });

    // -----------------------------------------------------------------------
    // 23. Failure output message contains remaining iterations
    // -----------------------------------------------------------------------
    it('failure output includes remaining iterations count', async () => {
        cleanupTestEnv();
        setupTestEnv(failedIterationState(3, 10));
        hookPath = installHook();

        const output = 'FAIL\n1 failed\nError: broken';
        const result = await runHook(hookPath, bashTestInput('npm test', output));
        assert.equal(result.code, 0);
        // current_iteration was 3, will become 4, remaining = 10-4 = 6
        assert.ok(result.stdout.includes('4/10'), 'Should show iteration 4/10');
        assert.ok(result.stdout.includes('Remaining iterations: 6'), 'Should show remaining iterations');
    });

    // -----------------------------------------------------------------------
    // 24. Success output mentions constitutional validation next step
    // -----------------------------------------------------------------------
    it('success output mentions constitutional validation as next step', async () => {
        cleanupTestEnv();
        setupTestEnv(baseTestState());
        hookPath = installHook();

        const output = 'All tests passed\nTests: 5 passed, 0 failed';
        const result = await runHook(hookPath, bashTestInput('npm test', output));
        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('Constitutional validation required'),
            'Success message should mention constitutional validation as next step');
    });

    // -----------------------------------------------------------------------
    // 25. iteration_config.testing_max overrides max_iterations from requirements
    // -----------------------------------------------------------------------
    it('uses iteration_config.testing_max from state.json when present', async () => {
        cleanupTestEnv();
        // Set iteration_config with testing_max=3 (lower than default 10)
        setupTestEnv({
            ...baseTestState(),
            iteration_config: {
                implementation_max: 5,
                testing_max: 3,
                circuit_breaker_threshold: 2,
                escalation_behavior: 'pause',
                configured_at: '2026-02-07T14:30:00Z'
            }
        });
        hookPath = installHook();

        // First failure — should create state with max_iterations=3
        const output = 'FAIL src/app.test.js\n1 failed\nError: assertion failed';
        const result = await runHook(hookPath, bashTestInput('npm test', output));
        assert.equal(result.code, 0);

        const state = readState();
        const iterState = state.phases['06-implementation'].iteration_requirements.test_iteration;
        assert.equal(iterState.max_iterations, 3, 'max_iterations should be 3 from iteration_config.testing_max');
        assert.ok(result.stdout.includes('1/3'), 'Output should show iteration 1/3');
        assert.ok(result.stdout.includes('Remaining iterations: 2'), 'Should show 2 remaining');
    });

    // -----------------------------------------------------------------------
    // 26. iteration_config.circuit_breaker_threshold overrides requirements
    // -----------------------------------------------------------------------
    it('uses iteration_config.circuit_breaker_threshold from state.json', async () => {
        cleanupTestEnv();
        // Set circuit_breaker_threshold=2 (lower than default 3)
        // Set up state with 1 identical failure already recorded, threshold=2 means next identical triggers
        setupTestEnv({
            ...failedIterationState(1, 10, {
                test_iteration: {
                    identical_failure_count: 1,
                    history: [
                        { iteration: 1, result: 'FAILED', error: 'TypeError: x is not a function' }
                    ]
                }
            }),
            iteration_config: {
                implementation_max: 5,
                testing_max: 10,
                circuit_breaker_threshold: 2,
                escalation_behavior: 'pause',
                configured_at: '2026-02-07T14:30:00Z'
            }
        });
        hookPath = installHook();

        // Same error repeated — should trigger circuit breaker at threshold=2
        const output = 'FAIL\n1 failed\nTypeError: x is not a function';
        const result = await runHook(hookPath, bashTestInput('npm test', output));
        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('CIRCUIT BREAKER TRIGGERED'),
            'Circuit breaker should trigger at threshold=2 from iteration_config');

        const state = readState();
        const iterState = state.phases['06-implementation'].iteration_requirements.test_iteration;
        assert.equal(iterState.status, 'escalated');
        assert.equal(iterState.escalation_reason, 'circuit_breaker');
    });

    // -----------------------------------------------------------------------
    // 27. Without iteration_config, falls back to iteration-requirements.json
    // -----------------------------------------------------------------------
    it('falls back to iteration-requirements.json when iteration_config is absent', async () => {
        cleanupTestEnv();
        // No iteration_config in state — should use default from requirements (10)
        setupTestEnv(baseTestState());
        hookPath = installHook();

        const output = 'FAIL src/app.test.js\n1 failed\nError: something broke';
        const result = await runHook(hookPath, bashTestInput('npm test', output));
        assert.equal(result.code, 0);

        const state = readState();
        const iterState = state.phases['06-implementation'].iteration_requirements.test_iteration;
        // Default from iteration-requirements.json for 06-implementation is 10
        assert.equal(iterState.max_iterations, 10,
            'Should use max_iterations from iteration-requirements.json when no iteration_config');
    });

    // -----------------------------------------------------------------------
    // 28. iteration_config without configured_at is ignored
    // -----------------------------------------------------------------------
    it('ignores iteration_config without configured_at timestamp', async () => {
        cleanupTestEnv();
        // iteration_config present but missing configured_at — should be treated as absent
        setupTestEnv({
            ...baseTestState(),
            iteration_config: {
                implementation_max: 2,
                testing_max: 2,
                circuit_breaker_threshold: 1
                // No configured_at — getIterationConfig returns null
            }
        });
        hookPath = installHook();

        const output = 'FAIL src/app.test.js\n1 failed\nError: assertion failed';
        const result = await runHook(hookPath, bashTestInput('npm test', output));
        assert.equal(result.code, 0);

        const state = readState();
        const iterState = state.phases['06-implementation'].iteration_requirements.test_iteration;
        // Should NOT use testing_max=2, should fall back to requirements default (10)
        assert.equal(iterState.max_iterations, 10,
            'Should ignore iteration_config without configured_at and use requirements default');
    });

    // -----------------------------------------------------------------------
    // 29. Max iterations escalation respects iteration_config.testing_max
    // -----------------------------------------------------------------------
    it('escalates at iteration_config.testing_max instead of requirements max', async () => {
        cleanupTestEnv();
        // testing_max=3, current_iteration=2 — next failure (#3) should trigger max exceeded
        setupTestEnv({
            ...failedIterationState(2, 3),
            iteration_config: {
                implementation_max: 5,
                testing_max: 3,
                circuit_breaker_threshold: 5,
                escalation_behavior: 'pause',
                configured_at: '2026-02-07T14:30:00Z'
            }
        });
        hookPath = installHook();

        const output = 'FAIL\n1 failed\nError: Something broken';
        const result = await runHook(hookPath, bashTestInput('npm test', output));
        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('MAX ITERATIONS EXCEEDED'),
            'Should escalate at testing_max=3');

        const state = readState();
        const iterState = state.phases['06-implementation'].iteration_requirements.test_iteration;
        assert.equal(iterState.completed, true);
        assert.equal(iterState.status, 'escalated');
        assert.equal(iterState.escalation_reason, 'max_iterations');
    });

    // -----------------------------------------------------------------------
    // 30. Existing iteration state max_iterations is preserved (not overwritten)
    // -----------------------------------------------------------------------
    it('does not overwrite max_iterations on existing iteration state', async () => {
        cleanupTestEnv();
        // Pre-existing iterState has max_iterations=10, iteration_config has testing_max=3
        // Since iterState already exists, max_iterations should stay at 10
        setupTestEnv({
            ...failedIterationState(2, 10),
            iteration_config: {
                implementation_max: 5,
                testing_max: 3,
                circuit_breaker_threshold: 2,
                escalation_behavior: 'pause',
                configured_at: '2026-02-07T14:30:00Z'
            }
        });
        hookPath = installHook();

        const output = 'FAIL\n1 failed\nError: another failure';
        const result = await runHook(hookPath, bashTestInput('npm test', output));
        assert.equal(result.code, 0);

        const state = readState();
        const iterState = state.phases['06-implementation'].iteration_requirements.test_iteration;
        // max_iterations should remain 10 because iterState already existed
        assert.equal(iterState.max_iterations, 10,
            'Should preserve existing max_iterations when iterState already exists');
    });
});
