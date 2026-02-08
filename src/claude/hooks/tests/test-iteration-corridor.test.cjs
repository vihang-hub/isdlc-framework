'use strict';

/**
 * iSDLC Iteration Corridor - Test Suite (CJS)
 * =============================================
 * Unit tests for src/claude/hooks/iteration-corridor.js
 *
 * The iteration-corridor hook is a PreToolUse hook that restricts agent actions
 * during active iteration states. When tests are failing (TEST_CORRIDOR) or
 * constitutional validation is pending (CONST_CORRIDOR), agents can only perform
 * actions related to fixing the issue. Advance/delegate attempts are blocked.
 *
 * IMPORTANT: Hooks use CommonJS require() but the project package.json has
 * "type": "module". We copy the hook + lib/common.js to the temp test directory
 * (which is outside the ESM package scope) so Node treats .js files as CJS.
 *
 * Run: node --test src/claude/hooks/tests/test-iteration-corridor.test.cjs
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
const hookSrcPath = path.resolve(__dirname, '..', 'iteration-corridor.cjs');
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
    const hookDest = path.join(testDir, 'iteration-corridor.cjs');
    fs.copyFileSync(hookSrcPath, hookDest);
    return hookDest;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a Task tool input with a prompt */
function taskInput(prompt) {
    return { tool_name: 'Task', tool_input: { prompt } };
}

/** Build a Skill tool input */
function skillInput(skill, args) {
    return { tool_name: 'Skill', tool_input: { skill, args } };
}

/** Parse a block response from stdout, returns null if stdout is empty (allowed) */
function parseBlock(stdout) {
    if (!stdout || !stdout.trim()) return null;
    try {
        return JSON.parse(stdout);
    } catch {
        return null;
    }
}

/**
 * Build state overrides that put the hook into TEST_CORRIDOR for phase 06-implementation.
 * Requirements: test_iteration enabled, last_test_result = 'failed', completed = false,
 * status != 'escalated'.
 */
function testCorridorState(extras) {
    return {
        current_phase: '06-implementation',
        iteration_enforcement: { enabled: true },
        phases: {
            '06-implementation': {
                status: 'in_progress',
                iteration_requirements: {
                    test_iteration: {
                        required: true,
                        completed: false,
                        current_iteration: 2,
                        max_iterations: 10,
                        failures_count: 2,
                        last_test_result: 'failed',
                        last_test_command: 'npm test',
                        history: [
                            { iteration: 1, result: 'FAILED', error: 'TypeError: x is not a function' },
                            { iteration: 2, result: 'FAILED', error: 'TypeError: x is not a function' }
                        ],
                        ...((extras && extras.test_iteration) || {})
                    }
                }
            }
        }
    };
}

/**
 * Build state overrides that put the hook into CONST_CORRIDOR for phase 06-implementation.
 * Requirements: test_iteration completed = true AND constitutional_validation not completed.
 */
function constCorridorState(extras) {
    return {
        current_phase: '06-implementation',
        iteration_enforcement: { enabled: true },
        phases: {
            '06-implementation': {
                status: 'in_progress',
                iteration_requirements: {
                    test_iteration: {
                        required: true,
                        completed: true,
                        status: 'success',
                        current_iteration: 3,
                        max_iterations: 10,
                        last_test_result: 'passed'
                    }
                },
                constitutional_validation: {
                    required: true,
                    completed: false,
                    status: 'pending',
                    iterations_used: 1,
                    max_iterations: 5,
                    ...((extras && extras.constitutional_validation) || {})
                }
            }
        }
    };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('iteration-corridor.js', () => {
    let hookPath;

    beforeEach(() => {
        // Each test calls setupTestEnv with its own overrides, but we set a
        // default here that will be overridden by the setupTestEnv call inside.
        setupTestEnv();
        hookPath = installHook();
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    // -----------------------------------------------------------------------
    // 1. Non-Task/Skill tool passthrough
    // -----------------------------------------------------------------------
    it('allows non-Task/Skill tools (e.g., Read) without blocking', async () => {
        cleanupTestEnv();
        setupTestEnv(testCorridorState());
        hookPath = installHook();

        const result = await runHook(hookPath, { tool_name: 'Read', tool_input: { file_path: '/tmp/foo.txt' } });
        assert.equal(result.code, 0, 'Exit code should be 0');
        assert.equal(result.stdout, '', 'stdout should be empty (allow)');
    });

    // -----------------------------------------------------------------------
    // 2. No state.json - fail-open
    // -----------------------------------------------------------------------
    it('allows action when state.json does not exist (fail-open)', async () => {
        cleanupTestEnv();
        const testDir = setupTestEnv();
        hookPath = installHook();
        // Remove state.json to simulate missing state
        fs.unlinkSync(path.join(testDir, '.isdlc', 'state.json'));

        const result = await runHook(hookPath, taskInput('advance to next phase'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Should allow (fail-open) when no state');
    });

    // -----------------------------------------------------------------------
    // 3. Enforcement disabled
    // -----------------------------------------------------------------------
    it('allows all actions when iteration_enforcement.enabled is false', async () => {
        cleanupTestEnv();
        setupTestEnv({
            ...testCorridorState(),
            iteration_enforcement: { enabled: false }
        });
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('advance to next phase'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Should allow when enforcement disabled');
    });

    // -----------------------------------------------------------------------
    // 4. No corridor active (tests not yet run / no failures)
    // -----------------------------------------------------------------------
    it('allows Task with advance keywords when no corridor is active', async () => {
        cleanupTestEnv();
        setupTestEnv({
            current_phase: '06-implementation',
            iteration_enforcement: { enabled: true },
            phases: {
                '06-implementation': {
                    status: 'in_progress',
                    iteration_requirements: {
                        test_iteration: {
                            required: true,
                            completed: false,
                            current_iteration: 0,
                            max_iterations: 10
                            // No last_test_result = 'failed', so no corridor
                        }
                    }
                }
            }
        });
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('advance to next phase'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Should allow when no corridor active (no test failures yet)');
    });

    // -----------------------------------------------------------------------
    // 5. TEST_CORRIDOR: blocks Task with "advance to next phase"
    // -----------------------------------------------------------------------
    it('TEST_CORRIDOR: blocks Task with prompt containing "advance to next phase"', async () => {
        cleanupTestEnv();
        setupTestEnv(testCorridorState());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('advance to next phase'));
        assert.equal(result.code, 0);
        const block = parseBlock(result.stdout);
        assert.ok(block, 'Should produce block output');
        assert.equal(block.continue, false);
        assert.ok(block.stopReason.includes('ITERATION CORRIDOR'), 'stopReason should mention ITERATION CORRIDOR');
        assert.ok(block.stopReason.includes('Tests are failing'), 'stopReason should mention tests are failing');
    });

    // -----------------------------------------------------------------------
    // 6. TEST_CORRIDOR: blocks Task with "delegate to code review agent"
    // -----------------------------------------------------------------------
    it('TEST_CORRIDOR: blocks Task with prompt containing "delegate"', async () => {
        cleanupTestEnv();
        setupTestEnv(testCorridorState());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('delegate to code review agent'));
        assert.equal(result.code, 0);
        const block = parseBlock(result.stdout);
        assert.ok(block, 'Should produce block output');
        assert.equal(block.continue, false);
        assert.ok(block.stopReason.includes('advance/delegate keywords'));
    });

    // -----------------------------------------------------------------------
    // 7. TEST_CORRIDOR: blocks Skill with sdlc advance
    // -----------------------------------------------------------------------
    it('TEST_CORRIDOR: blocks Skill tool with sdlc advance', async () => {
        cleanupTestEnv();
        setupTestEnv(testCorridorState());
        hookPath = installHook();

        const result = await runHook(hookPath, skillInput('sdlc', 'advance'));
        assert.equal(result.code, 0);
        const block = parseBlock(result.stdout);
        assert.ok(block, 'Should produce block output');
        assert.equal(block.continue, false);
        assert.ok(block.stopReason.includes('gate advancement not allowed during test iteration'));
    });

    // -----------------------------------------------------------------------
    // 8. TEST_CORRIDOR: allows Task with "fix the failing test"
    // -----------------------------------------------------------------------
    it('TEST_CORRIDOR: allows Task with prompt about fixing tests (no advance keywords)', async () => {
        cleanupTestEnv();
        setupTestEnv(testCorridorState());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('fix the failing test in auth module'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Should allow fix-related task');
    });

    // -----------------------------------------------------------------------
    // 9. TEST_CORRIDOR: allows Task with "discover" (setup bypass)
    // -----------------------------------------------------------------------
    it('TEST_CORRIDOR: allows Task with setup keyword "discover" even with advance keywords', async () => {
        cleanupTestEnv();
        setupTestEnv(testCorridorState());
        hookPath = installHook();

        // "discover" is a setup keyword that triggers bypass BEFORE advance check
        const result = await runHook(hookPath, taskInput('discover and advance the project setup'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Should allow setup commands even in TEST_CORRIDOR');
    });

    // -----------------------------------------------------------------------
    // 10. CONST_CORRIDOR: blocks advance
    // -----------------------------------------------------------------------
    it('CONST_CORRIDOR: blocks Task with advance keywords', async () => {
        cleanupTestEnv();
        setupTestEnv(constCorridorState());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('proceed to next phase'));
        assert.equal(result.code, 0);
        const block = parseBlock(result.stdout);
        assert.ok(block, 'Should produce block output');
        assert.equal(block.continue, false);
        assert.ok(block.stopReason.includes('Constitutional validation in progress'));
    });

    // -----------------------------------------------------------------------
    // 11. CONST_CORRIDOR: allows non-advance Task
    // -----------------------------------------------------------------------
    it('CONST_CORRIDOR: allows Task without advance keywords', async () => {
        cleanupTestEnv();
        setupTestEnv(constCorridorState());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('Check the constitution for Article II compliance'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Should allow non-advance task in CONST_CORRIDOR');
    });

    // -----------------------------------------------------------------------
    // 12. Corridor exits when both test and const are completed
    // -----------------------------------------------------------------------
    it('exits corridor when test_iteration and constitutional_validation are both completed', async () => {
        cleanupTestEnv();
        setupTestEnv({
            current_phase: '06-implementation',
            iteration_enforcement: { enabled: true },
            phases: {
                '06-implementation': {
                    status: 'in_progress',
                    iteration_requirements: {
                        test_iteration: {
                            required: true,
                            completed: true,
                            status: 'success',
                            current_iteration: 3,
                            max_iterations: 10,
                            last_test_result: 'passed'
                        }
                    },
                    constitutional_validation: {
                        required: true,
                        completed: true,
                        status: 'compliant',
                        iterations_used: 2,
                        max_iterations: 5
                    }
                }
            }
        });
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('advance to next phase'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Should allow advance when all validations are completed');
    });

    // -----------------------------------------------------------------------
    // 13. Escalated status exits TEST_CORRIDOR
    // -----------------------------------------------------------------------
    it('exits TEST_CORRIDOR when test_iteration status is escalated', async () => {
        cleanupTestEnv();
        setupTestEnv(testCorridorState({
            test_iteration: {
                status: 'escalated',
                completed: false,
                last_test_result: 'failed'
            }
        }));
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('advance to next phase'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Should allow advance when escalated (not in corridor)');
    });

    // -----------------------------------------------------------------------
    // 14. Task tool with non-advance description allowed in TEST_CORRIDOR
    // -----------------------------------------------------------------------
    it('TEST_CORRIDOR: allows Task with description like "Explore codebase"', async () => {
        cleanupTestEnv();
        setupTestEnv(testCorridorState());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('Explore the codebase to understand the module structure'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Should allow exploration tasks in TEST_CORRIDOR');
    });

    // -----------------------------------------------------------------------
    // 15. CONST_CORRIDOR: blocks Skill sdlc gate
    // -----------------------------------------------------------------------
    it('CONST_CORRIDOR: blocks Skill tool with sdlc gate', async () => {
        cleanupTestEnv();
        setupTestEnv(constCorridorState());
        hookPath = installHook();

        const result = await runHook(hookPath, skillInput('sdlc', 'gate'));
        assert.equal(result.code, 0);
        const block = parseBlock(result.stdout);
        assert.ok(block, 'Should produce block output');
        assert.equal(block.continue, false);
        assert.ok(block.stopReason.includes('gate advancement not allowed during constitutional validation'));
    });

    // -----------------------------------------------------------------------
    // 16. Skill tool that is NOT an advance attempt is allowed
    // -----------------------------------------------------------------------
    it('TEST_CORRIDOR: allows Skill tool that is not sdlc advance/gate', async () => {
        cleanupTestEnv();
        setupTestEnv(testCorridorState());
        hookPath = installHook();

        const result = await runHook(hookPath, skillInput('commit', '-m "fix test"'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Should allow non-sdlc-advance skills');
    });

    // -----------------------------------------------------------------------
    // 17. No current_phase in state - fail-open
    // -----------------------------------------------------------------------
    it('allows action when current_phase is not set in state', async () => {
        cleanupTestEnv();
        setupTestEnv({
            iteration_enforcement: { enabled: true },
            phases: {}
        });
        hookPath = installHook();
        // Remove current_phase entirely from state
        const state = readState();
        delete state.current_phase;
        writeState(state);

        const result = await runHook(hookPath, taskInput('advance to next phase'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Should allow when no current_phase');
    });

    // -----------------------------------------------------------------------
    // 18. TEST_CORRIDOR: blocks Task with "hand off" keyword
    // -----------------------------------------------------------------------
    it('TEST_CORRIDOR: blocks Task with "hand off" advance keyword', async () => {
        cleanupTestEnv();
        setupTestEnv(testCorridorState());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('hand off to the next agent'));
        assert.equal(result.code, 0);
        const block = parseBlock(result.stdout);
        assert.ok(block, 'Should produce block output');
        assert.equal(block.continue, false);
    });

    // -----------------------------------------------------------------------
    // 19. Setup bypass: "configure" keyword bypasses corridor
    // -----------------------------------------------------------------------
    it('TEST_CORRIDOR: allows Task with setup keyword "configure"', async () => {
        cleanupTestEnv();
        setupTestEnv(testCorridorState());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('configure the project build settings and proceed'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Should allow setup command "configure" in corridor');
    });

    // -----------------------------------------------------------------------
    // 20. Skill with setup keyword in args is allowed
    // -----------------------------------------------------------------------
    it('TEST_CORRIDOR: allows Skill with setup keyword in args', async () => {
        cleanupTestEnv();
        setupTestEnv(testCorridorState());
        hookPath = installHook();

        const result = await runHook(hookPath, skillInput('sdlc', 'discover'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Should allow Skill with setup keyword "discover" in args');
    });

    // -----------------------------------------------------------------------
    // 21. iteration_config in state does not break TEST_CORRIDOR
    // -----------------------------------------------------------------------
    it('TEST_CORRIDOR: still blocks advance when iteration_config is present in state', async () => {
        cleanupTestEnv();
        const stateWithIterConfig = testCorridorState();
        stateWithIterConfig.iteration_config = {
            implementation_max: 3,
            testing_max: 3,
            circuit_breaker_threshold: 2,
            escalation_behavior: 'pause',
            configured_at: '2026-02-07T14:30:00Z'
        };
        setupTestEnv(stateWithIterConfig);
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('advance to next phase'));
        assert.equal(result.code, 0);
        const block = parseBlock(result.stdout);
        assert.ok(block, 'Should produce block output');
        assert.equal(block.continue, false);
        assert.ok(block.stopReason.includes('ITERATION CORRIDOR'), 'Should still enforce corridor with iteration_config present');
    });

    // -----------------------------------------------------------------------
    // 22. iteration_config without configured_at is ignored (no regression)
    // -----------------------------------------------------------------------
    it('TEST_CORRIDOR: ignores iteration_config without configured_at', async () => {
        cleanupTestEnv();
        const stateWithPartialConfig = testCorridorState();
        stateWithPartialConfig.iteration_config = {
            implementation_max: 3,
            testing_max: 3
            // No configured_at — should be treated as unconfigured
        };
        setupTestEnv(stateWithPartialConfig);
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('advance to next phase'));
        assert.equal(result.code, 0);
        const block = parseBlock(result.stdout);
        assert.ok(block, 'Should produce block output');
        assert.equal(block.continue, false);
        assert.ok(block.stopReason.includes('ITERATION CORRIDOR'), 'Should still enforce corridor when config is incomplete');
    });
});
