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
    // 7. TEST_CORRIDOR: blocks Skill with isdlc advance
    // -----------------------------------------------------------------------
    it('TEST_CORRIDOR: blocks Skill tool with isdlc advance', async () => {
        cleanupTestEnv();
        setupTestEnv(testCorridorState());
        hookPath = installHook();

        const result = await runHook(hookPath, skillInput('isdlc', 'advance'));
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
    // 15. CONST_CORRIDOR: blocks Skill isdlc gate
    // -----------------------------------------------------------------------
    it('CONST_CORRIDOR: blocks Skill tool with isdlc gate', async () => {
        cleanupTestEnv();
        setupTestEnv(constCorridorState());
        hookPath = installHook();

        const result = await runHook(hookPath, skillInput('isdlc', 'gate'));
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

        const result = await runHook(hookPath, skillInput('isdlc', 'discover'));
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
    // 22. TEST_CORRIDOR writes pending_escalations on block
    // -----------------------------------------------------------------------
    it('TEST_CORRIDOR: writes pending_escalations entry when blocked', async () => {
        cleanupTestEnv();
        setupTestEnv(testCorridorState());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('advance to next phase'));
        assert.equal(result.code, 0);
        const block = parseBlock(result.stdout);
        assert.ok(block, 'Should produce block output');
        assert.equal(block.continue, false);

        const state = readState();
        assert.ok(Array.isArray(state.pending_escalations), 'Should have pending_escalations array');
        assert.ok(state.pending_escalations.length > 0, 'Should have at least one escalation');

        const escalation = state.pending_escalations[0];
        assert.equal(escalation.type, 'corridor_blocked');
        assert.equal(escalation.hook, 'iteration-corridor');
        assert.equal(escalation.phase, '06-implementation');
        assert.ok(escalation.detail.includes('ITERATION CORRIDOR'));
        assert.ok(escalation.timestamp, 'Should have timestamp');
    });

    // -----------------------------------------------------------------------
    // 23. CONST_CORRIDOR writes pending_escalations on block
    // -----------------------------------------------------------------------
    it('CONST_CORRIDOR: writes pending_escalations entry when blocked', async () => {
        cleanupTestEnv();
        setupTestEnv(constCorridorState());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('proceed to next phase'));
        assert.equal(result.code, 0);
        const block = parseBlock(result.stdout);
        assert.ok(block, 'Should produce block output');
        assert.equal(block.continue, false);

        const state = readState();
        assert.ok(Array.isArray(state.pending_escalations), 'Should have pending_escalations array');
        assert.ok(state.pending_escalations.length > 0, 'Should have at least one escalation');

        const escalation = state.pending_escalations[0];
        assert.equal(escalation.type, 'corridor_blocked');
        assert.equal(escalation.hook, 'iteration-corridor');
        assert.equal(escalation.phase, '06-implementation');
        assert.ok(escalation.detail.includes('Constitutional validation'));
        assert.ok(escalation.timestamp, 'Should have timestamp');
    });

    // -----------------------------------------------------------------------
    // 24. iteration_config without configured_at is ignored (no regression)
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

    // =========================================================================
    // BUG-0008: Delegation Guard
    // Delegation prompts from the phase-loop controller must NOT be blocked
    // by iteration corridors. The /gate/i pattern in ADVANCE_PATTERNS is the
    // most likely false positive trigger (matches "Validate GATE-NN").
    // FIX-002: AC-06 through AC-08
    // =========================================================================

    describe('BUG-0008: Delegation guard', () => {

        // TC-IC-D01: Delegation bypasses TEST_CORRIDOR advance keyword check
        // Requirement: FIX-002, AC-06
        it('TEST_CORRIDOR: allows delegation prompt with "GATE-06" keyword', async () => {
            cleanupTestEnv();
            setupTestEnv(testCorridorState());
            hookPath = installHook();

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    prompt: 'Execute Phase 06 - Implementation for fix workflow.\nValidate GATE-06 on completion.',
                    subagent_type: 'software-developer'
                }
            });
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '', 'Delegation prompt should NOT be blocked by TEST_CORRIDOR');
        });

        // TC-IC-D02: Delegation bypasses CONST_CORRIDOR advance keyword check
        // Requirement: FIX-002, AC-06
        it('CONST_CORRIDOR: allows delegation prompt with "GATE-08" keyword', async () => {
            cleanupTestEnv();
            setupTestEnv(constCorridorState());
            hookPath = installHook();

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    prompt: 'Execute Phase 08 - Code Review.\nPhase key: 08-code-review\nValidate GATE-08 on completion.',
                    subagent_type: 'code-reviewer'
                }
            });
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '', 'Delegation prompt should NOT be blocked by CONST_CORRIDOR');
        });

        // TC-IC-D03: "GATE-NN" in delegation prompt no longer triggers /gate/i false positive
        // Requirement: FIX-002, AC-06
        it('TEST_CORRIDOR: "GATE-02" in delegation prompt does not trigger /gate/i', async () => {
            cleanupTestEnv();
            setupTestEnv(testCorridorState());
            hookPath = installHook();

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    prompt: 'Execute Phase 02 - Tracing for fix workflow.\nArtifact folder: BUG-0008\nPhase key: 02-tracing\nValidate GATE-02 on completion.',
                    subagent_type: 'trace-analyst'
                }
            });
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '', 'GATE-02 in delegation should NOT trigger /gate/i block');
        });

        // TC-IC-D04: Genuine advance keywords still blocked in TEST_CORRIDOR
        // Requirement: FIX-002, AC-07
        it('TEST_CORRIDOR: still blocks genuine "advance to next phase" after guard', async () => {
            cleanupTestEnv();
            setupTestEnv(testCorridorState());
            hookPath = installHook();

            const result = await runHook(hookPath, taskInput('advance to next phase'));
            assert.equal(result.code, 0);
            const block = parseBlock(result.stdout);
            assert.ok(block, 'Should produce block output for genuine advance');
            assert.equal(block.continue, false);
            assert.ok(block.stopReason.includes('ITERATION CORRIDOR'));
        });

        // TC-IC-D05: Genuine advance keywords still blocked in CONST_CORRIDOR
        // Requirement: FIX-002, AC-08
        it('CONST_CORRIDOR: still blocks genuine "proceed to next phase" after guard', async () => {
            cleanupTestEnv();
            setupTestEnv(constCorridorState());
            hookPath = installHook();

            const result = await runHook(hookPath, taskInput('proceed to next phase'));
            assert.equal(result.code, 0);
            const block = parseBlock(result.stdout);
            assert.ok(block, 'Should produce block output for genuine proceed');
            assert.equal(block.continue, false);
            assert.ok(block.stopReason.includes('Constitutional validation in progress'));
        });

        // TC-IC-D06: Delegation with description field also bypasses corridor
        // Requirement: FIX-002, AC-06
        it('TEST_CORRIDOR: allows delegation with GATE keyword in description field', async () => {
            cleanupTestEnv();
            setupTestEnv(testCorridorState());
            hookPath = installHook();

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    prompt: 'Execute Phase 01 - Requirements for feature workflow.',
                    description: 'Phase key: 01-requirements. Validate GATE-01 on completion.',
                    subagent_type: 'requirements-analyst'
                }
            });
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '', 'Delegation with GATE in description should NOT be blocked');
        });
    });

    // =========================================================================
    // Self-Healing: Phase Key Normalization
    // =========================================================================

    it('self-heals alias phase keys (no corridor for normalized phase)', async () => {
        // Use an alias phase key that normalizes to a phase with no test iteration
        cleanupTestEnv();
        setupTestEnv({
            current_phase: '13-test-deploy',  // alias → 12-test-deploy
            iteration_enforcement: { enabled: true },
            active_workflow: {
                type: 'feature',
                current_phase: '13-test-deploy',
                phases: ['12-test-deploy']
            },
            phases: {
                '12-test-deploy': {
                    status: 'in_progress'
                    // No test_iteration state → no corridor
                }
            }
        });
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('advance to next phase'));
        assert.equal(result.code, 0);
        const stdout = result.stdout;
        // Should self-heal: either [SELF-HEAL] on stderr or allow through
        assert.ok(result.stderr.includes('[SELF-HEAL]') || stdout === '',
            'Should self-heal or allow through for alias phase');
    });

    it('self-heals when requirements missing for phase', async () => {
        cleanupTestEnv();
        setupTestEnv({
            current_phase: '99-nonexistent',
            iteration_enforcement: { enabled: true },
            phases: {}
        });
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('advance to next phase'));
        assert.equal(result.code, 0);
        const stdout = result.stdout;
        // Should self-heal and allow since no requirements are defined
        assert.ok(result.stderr.includes('[SELF-HEAL]') || stdout === '',
            'Should self-heal for missing phase requirements');
    });

    it('self-heal normalizes phase key then finds requirements', async () => {
        // Use 14-production (alias for 13-production) in a failing test corridor
        cleanupTestEnv();
        setupTestEnv({
            current_phase: '14-production',  // alias → 13-production
            iteration_enforcement: { enabled: true },
            phases: {
                '13-production': {
                    status: 'in_progress'
                }
            }
        });
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('advance to next phase'));
        assert.equal(result.code, 0);
        // Should either self-heal or pass through — not hang or error
        assert.ok(result.code === 0, 'Should exit cleanly with alias phase');
    });

    // =========================================================================
    // BUG-0031: Exempt Action Verb Tests (analyze, add)
    // These verbs are workflow-independent and must never be blocked by
    // iteration corridors even when description text contains "gate".
    // =========================================================================

    describe('BUG-0031: Exempt action verbs', () => {

        // -----------------------------------------------------------------
        // 25. TC-IC-01: analyze verb is exempt in TEST_CORRIDOR
        // Requirement: FR-002 / AC-002-01
        // -----------------------------------------------------------------
        it('TEST_CORRIDOR: allows analyze verb via Skill (exempt action, BUG-0031)', async () => {
            cleanupTestEnv();
            setupTestEnv(testCorridorState());
            hookPath = installHook();

            const result = await runHook(hookPath, skillInput('isdlc', 'analyze "gate-blocker blocks analyze"'));
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '', 'analyze verb should pass through TEST_CORRIDOR');
        });

        // -----------------------------------------------------------------
        // 26. TC-IC-02: add verb is exempt in CONST_CORRIDOR
        // Requirement: FR-002 / AC-002-02
        // -----------------------------------------------------------------
        it('CONST_CORRIDOR: allows add verb via Skill (exempt action, BUG-0031)', async () => {
            cleanupTestEnv();
            setupTestEnv(constCorridorState());
            hookPath = installHook();

            const result = await runHook(hookPath, skillInput('isdlc', 'add "fix gate issue"'));
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '', 'add verb should pass through CONST_CORRIDOR');
        });

        // -----------------------------------------------------------------
        // 27. TC-IC-03: analyze with flags is exempt
        // Requirement: FR-003 / AC-003-02
        // -----------------------------------------------------------------
        it('TEST_CORRIDOR: allows analyze verb with flags via Skill (exempt action, BUG-0031)', async () => {
            cleanupTestEnv();
            setupTestEnv(testCorridorState());
            hookPath = installHook();

            const result = await runHook(hookPath, skillInput('isdlc', '--verbose analyze "issue desc"'));
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '', 'analyze with flags should pass through TEST_CORRIDOR');
        });

        // -----------------------------------------------------------------
        // 28. TC-IC-04: advance verb is NOT exempt (regression)
        // Requirement: FR-002 / AC-002-03
        // -----------------------------------------------------------------
        it('TEST_CORRIDOR: still blocks advance verb via Skill (NOT exempt, BUG-0031 regression)', async () => {
            cleanupTestEnv();
            setupTestEnv(testCorridorState());
            hookPath = installHook();

            const result = await runHook(hookPath, skillInput('isdlc', 'advance'));
            assert.equal(result.code, 0);
            const block = parseBlock(result.stdout);
            assert.ok(block, 'Should produce block output');
            assert.equal(block.continue, false);
            assert.ok(block.stopReason.includes('gate advancement not allowed during test iteration'),
                'advance must still be blocked in TEST_CORRIDOR');
        });

        // -----------------------------------------------------------------
        // 29. TC-IC-05: build verb is NOT exempt
        // Requirement: FR-004 / AC-004-04
        // -----------------------------------------------------------------
        it('TEST_CORRIDOR: blocks build verb with "gate" in description via Skill (NOT exempt, BUG-0031)', async () => {
            cleanupTestEnv();
            setupTestEnv(testCorridorState());
            hookPath = installHook();

            const result = await runHook(hookPath, skillInput('isdlc', 'build "fix gate-blocker"'));
            assert.equal(result.code, 0);
            const block = parseBlock(result.stdout);
            assert.ok(block, 'Should produce block output');
            assert.equal(block.continue, false);
            assert.ok(block.stopReason.includes('gate advancement not allowed during test iteration'),
                'build with gate keyword must still be blocked');
        });

        // -----------------------------------------------------------------
        // 30. TC-IC-06: empty args handled safely
        // Requirement: FR-003 / AC-003-03
        // -----------------------------------------------------------------
        it('TEST_CORRIDOR: handles empty args safely via Skill (BUG-0031 edge case)', async () => {
            cleanupTestEnv();
            setupTestEnv(testCorridorState());
            hookPath = installHook();

            const result = await runHook(hookPath, skillInput('isdlc', ''));
            assert.equal(result.code, 0);
            // Empty args: action = '', not exempt, but also no 'advance'/'gate' match
            assert.equal(result.stdout, '', 'Empty args should pass through (not an advance attempt)');
        });

        // -----------------------------------------------------------------
        // 31. TC-IC-07: add verb is exempt in TEST_CORRIDOR
        // Requirement: FR-002 / AC-002-01
        // -----------------------------------------------------------------
        it('TEST_CORRIDOR: allows add verb via Skill (exempt action in TEST_CORRIDOR, BUG-0031)', async () => {
            cleanupTestEnv();
            setupTestEnv(testCorridorState());
            hookPath = installHook();

            const result = await runHook(hookPath, skillInput('isdlc', 'add "track this gate bug"'));
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '', 'add verb should pass through TEST_CORRIDOR');
        });
    });
});
