'use strict';

/**
 * iSDLC Gate Blocker - Extended Test Suite (CJS)
 * ================================================
 * Tests for src/claude/hooks/gate-blocker.js (PreToolUse hook)
 *
 * The existing delegation tests are in test-skill-validator.js. This file tests:
 * - Gate advancement detection (keywords, tool types)
 * - Setup command bypass
 * - Test iteration requirement checks
 * - Constitutional validation requirement checks
 * - Interactive elicitation requirement checks
 * - All-requirements-satisfied gate opening
 * - Fail-open behavior
 *
 * Run: node --test src/claude/hooks/tests/test-gate-blocker-extended.test.cjs
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const {
    setupTestEnv,
    cleanupTestEnv,
    writeState,
    readState,
    writeConfig,
    writeIterationRequirements,
    getTestDir,
    prepareHook,
    runHook
} = require('./hook-test-utils.cjs');

/** Absolute path to the original hook source */
const hookSrcPath = path.resolve(__dirname, '..', 'gate-blocker.js');

/**
 * Helper: create a minimal iteration requirements config for testing.
 * Uses '06-implementation' as the phase under test by default.
 */
function writeTestRequirements(phaseOverrides) {
    const config = {
        version: '2.0.0',
        phase_requirements: {
            '06-implementation': Object.assign({
                interactive_elicitation: { enabled: false },
                test_iteration: {
                    enabled: true,
                    max_iterations: 10,
                    circuit_breaker_threshold: 3
                },
                constitutional_validation: {
                    enabled: true,
                    max_iterations: 5,
                    articles: ['I', 'II', 'VII']
                },
                agent_delegation_validation: {
                    enabled: true
                }
            }, phaseOverrides || {})
        },
        gate_blocking_rules: {
            block_on_incomplete_test_iteration: true,
            block_on_incomplete_constitutional: true,
            block_on_incomplete_elicitation: true,
            block_on_missing_agent_delegation: true
        }
    };
    writeIterationRequirements(config);
    return config;
}

/**
 * Helper: create a gate advancement input (Task to orchestrator with keyword).
 */
function gateAdvanceInput(keyword) {
    return {
        tool_name: 'Task',
        tool_input: {
            prompt: `Please ${keyword || 'advance'} to the next phase`,
            subagent_type: 'sdlc-orchestrator'
        }
    };
}

// =============================================================================
// Test Suite: gate-blocker.js (extended)
// =============================================================================

describe('gate-blocker.js (extended)', () => {

    /** Path to the CJS-prepared hook in the temp dir (set in beforeEach) */
    let hookPath;

    beforeEach(() => {
        setupTestEnv({
            current_phase: '06-implementation',
            iteration_enforcement: { enabled: true }
        });
        hookPath = prepareHook(hookSrcPath);
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    // =========================================================================
    // Gate Advancement Detection
    // =========================================================================

    describe('Gate advancement detection', () => {

        // ---------------------------------------------------------------------
        // 1. Non-Task/non-Skill tool passes through
        // ---------------------------------------------------------------------
        it('passes through for non-Task, non-Skill tools (e.g., Read)', async () => {
            const result = await runHook(hookPath, {
                tool_name: 'Read',
                tool_input: { file_path: '/some/file.js' }
            });

            assert.equal(result.stdout, '', 'Should produce no output');
            assert.equal(result.code, 0);
        });

        // ---------------------------------------------------------------------
        // 2. Task that is NOT an orchestrator passes through
        // ---------------------------------------------------------------------
        it('passes through for Task that is not an orchestrator', async () => {
            writeTestRequirements();

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    prompt: 'advance to next phase please',
                    subagent_type: 'software-developer'
                }
            });

            // software-developer is not an orchestrator, so gate check is skipped
            assert.equal(result.stdout, '', 'Should pass through for non-orchestrator');
            assert.equal(result.code, 0);
        });

        // ---------------------------------------------------------------------
        // 3. Orchestrator Task with "advance" keyword triggers gate check
        // ---------------------------------------------------------------------
        it('triggers gate check when orchestrator Task contains "advance"', async () => {
            writeTestRequirements();

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            // With no test iteration state, should block
            assert.ok(result.stdout, 'Should produce blocking output');
            const output = JSON.parse(result.stdout);
            assert.equal(output.continue, false, 'Should block (test_iteration not started)');
            assert.ok(output.stopReason.includes('GATE BLOCKED'),
                'Should include GATE BLOCKED message');
        });

        // ---------------------------------------------------------------------
        // 4. Orchestrator Task with "gate" keyword triggers gate check
        // ---------------------------------------------------------------------
        it('triggers gate check when orchestrator Task contains "gate"', async () => {
            writeTestRequirements();

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    prompt: 'run gate check for phase 06',
                    subagent_type: 'sdlc-orchestrator'
                }
            });

            assert.equal(result.code, 0);
            assert.ok(result.stdout, 'Should produce blocking output');
            const output = JSON.parse(result.stdout);
            assert.equal(output.continue, false, 'Should block on gate keyword');
        });

        // ---------------------------------------------------------------------
        // 5. Skill tool with "advance" arg triggers gate check
        // ---------------------------------------------------------------------
        it('triggers gate check when Skill tool has "advance" in args', async () => {
            writeTestRequirements();

            const result = await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: {
                    skill: 'sdlc',
                    args: 'advance to next phase'
                }
            });

            assert.equal(result.code, 0);
            assert.ok(result.stdout, 'Should produce blocking output');
            const output = JSON.parse(result.stdout);
            assert.equal(output.continue, false, 'Should block when Skill advance detected');
        });

        // ---------------------------------------------------------------------
        // 6. Setup command "discover" bypasses gate check
        // ---------------------------------------------------------------------
        it('bypasses gate check for setup command "discover"', async () => {
            writeTestRequirements();

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    prompt: 'run discover on the codebase and then advance',
                    subagent_type: 'sdlc-orchestrator'
                }
            });

            // 'discover' is a setup keyword and takes priority over 'advance'
            assert.equal(result.stdout, '', 'Should pass through for setup command');
            assert.equal(result.code, 0);
        });

        // ---------------------------------------------------------------------
        // 6b. Setup command "status" bypasses gate check via Skill tool
        // ---------------------------------------------------------------------
        it('bypasses gate check for "status" setup command via Skill tool', async () => {
            writeTestRequirements();

            const result = await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: {
                    skill: 'sdlc',
                    args: 'status advance'
                }
            });

            // 'status' is a setup keyword
            assert.equal(result.stdout, '', 'Should pass through for status command');
            assert.equal(result.code, 0);
        });
    });

    // =========================================================================
    // Requirement Checks
    // =========================================================================

    describe('Requirement checks', () => {

        // ---------------------------------------------------------------------
        // 7. Test iteration not started - blocks
        // ---------------------------------------------------------------------
        it('blocks when test_iteration is required but not started', async () => {
            writeTestRequirements();

            writeState({
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                current_phase: '06-implementation',
                skill_usage_log: [{ agent: 'software-developer', agent_phase: '06-implementation' }],
                iteration_enforcement: { enabled: true },
                phases: {
                    '06-implementation': {
                        status: 'in_progress'
                        // No iteration_requirements.test_iteration
                    }
                }
            });

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            assert.ok(result.stdout, 'Should produce blocking output');
            const output = JSON.parse(result.stdout);
            assert.equal(output.continue, false);
            assert.ok(output.stopReason.includes('test_iteration'),
                'Block reason should mention test_iteration');
        });

        // ---------------------------------------------------------------------
        // 8. Test iteration incomplete (failures > 0) - blocks
        // ---------------------------------------------------------------------
        it('blocks when test_iteration exists but is incomplete with failures', async () => {
            writeTestRequirements();

            writeState({
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                current_phase: '06-implementation',
                skill_usage_log: [{ agent: 'software-developer', agent_phase: '06-implementation' }],
                iteration_enforcement: { enabled: true },
                phases: {
                    '06-implementation': {
                        status: 'in_progress',
                        iteration_requirements: {
                            test_iteration: {
                                completed: false,
                                current_iteration: 3,
                                max_iterations: 10,
                                last_test_result: 'failed',
                                failures_count: 5
                            }
                        }
                    }
                }
            });

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            const output = JSON.parse(result.stdout);
            assert.equal(output.continue, false);
            assert.ok(output.stopReason.includes('GATE BLOCKED'));
            assert.ok(output.stopReason.includes('test_iteration'));
        });

        // ---------------------------------------------------------------------
        // 9. Test iteration completed and passing - allows (for that check)
        // ---------------------------------------------------------------------
        it('passes test_iteration check when completed with success', async () => {
            writeTestRequirements({
                // Disable other checks to isolate test_iteration
                constitutional_validation: { enabled: false },
                agent_delegation_validation: { enabled: false }
            });

            writeState({
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                current_phase: '06-implementation',
                skill_usage_log: [],
                iteration_enforcement: { enabled: true },
                phases: {
                    '06-implementation': {
                        status: 'in_progress',
                        iteration_requirements: {
                            test_iteration: {
                                completed: true,
                                status: 'success',
                                current_iteration: 2,
                                max_iterations: 10,
                                last_test_result: 'passed'
                            }
                        }
                    }
                }
            });

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            // Should allow (empty stdout)
            assert.equal(result.stdout, '',
                'Should not block when test_iteration is satisfied');
        });

        // ---------------------------------------------------------------------
        // 10. Constitutional validation not started - blocks when required
        // ---------------------------------------------------------------------
        it('blocks when constitutional_validation is required but not started', async () => {
            writeTestRequirements({
                test_iteration: { enabled: false },
                agent_delegation_validation: { enabled: false }
            });

            writeState({
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                current_phase: '06-implementation',
                skill_usage_log: [],
                iteration_enforcement: { enabled: true },
                phases: {
                    '06-implementation': {
                        status: 'in_progress'
                        // No constitutional_validation
                    }
                }
            });

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            const output = JSON.parse(result.stdout);
            assert.equal(output.continue, false);
            assert.ok(output.stopReason.includes('constitutional_validation'),
                'Block reason should mention constitutional_validation');
        });

        // ---------------------------------------------------------------------
        // 11. Constitutional validation completed and compliant - allows
        // ---------------------------------------------------------------------
        it('passes constitutional check when completed with compliant status', async () => {
            writeTestRequirements({
                test_iteration: { enabled: false },
                agent_delegation_validation: { enabled: false }
            });

            writeState({
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                current_phase: '06-implementation',
                skill_usage_log: [],
                iteration_enforcement: { enabled: true },
                phases: {
                    '06-implementation': {
                        status: 'in_progress',
                        constitutional_validation: {
                            completed: true,
                            status: 'compliant',
                            iterations_used: 2,
                            max_iterations: 5,
                            articles_checked: ['I', 'II', 'VII']
                        }
                    }
                }
            });

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            // Should allow (empty stdout)
            assert.equal(result.stdout, '',
                'Should not block when constitutional validation is compliant');
        });

        // ---------------------------------------------------------------------
        // 12. All requirements satisfied - gate opens
        // ---------------------------------------------------------------------
        it('allows gate advancement when ALL requirements are satisfied', async () => {
            writeTestRequirements();

            writeState({
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                current_phase: '06-implementation',
                skill_usage_log: [{ agent: 'software-developer', agent_phase: '06-implementation' }],
                iteration_enforcement: { enabled: true },
                phases: {
                    '06-implementation': {
                        status: 'in_progress',
                        iteration_requirements: {
                            test_iteration: {
                                completed: true,
                                status: 'success',
                                last_test_result: 'passed'
                            }
                        },
                        constitutional_validation: {
                            completed: true,
                            status: 'compliant'
                        }
                    }
                }
            });

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            // Gate should open: empty stdout means allow
            assert.equal(result.stdout, '',
                'Should allow advancement when all requirements satisfied');
        });

        // ---------------------------------------------------------------------
        // 13. Phase with no requirements configured - allows
        // ---------------------------------------------------------------------
        it('allows advancement when phase has no requirements defined', async () => {
            // Write requirements that do NOT include the current phase
            writeIterationRequirements({
                version: '2.0.0',
                phase_requirements: {
                    '01-requirements': {
                        interactive_elicitation: { enabled: true },
                        test_iteration: { enabled: false }
                    }
                    // No '06-implementation' phase defined
                }
            });

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            assert.equal(result.stdout, '',
                'Should allow when no requirements defined for current phase');
        });
    });

    // =========================================================================
    // Fail-open and edge cases
    // =========================================================================

    describe('Fail-open and edge cases', () => {

        // ---------------------------------------------------------------------
        // 14. Missing workflow state - fail-open, allows
        // ---------------------------------------------------------------------
        it('allows (fail-open) when state.json is missing entirely', async () => {
            const testDir = getTestDir();
            const stateFile = path.join(testDir, '.isdlc', 'state.json');
            if (fs.existsSync(stateFile)) {
                fs.unlinkSync(stateFile);
            }

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            assert.equal(result.stdout, '',
                'Should allow (fail-open) when no state.json exists');
        });

        // ---------------------------------------------------------------------
        // 15. Enforcement disabled - allows
        // ---------------------------------------------------------------------
        it('allows when iteration_enforcement.enabled is false', async () => {
            writeTestRequirements();

            writeState({
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                current_phase: '06-implementation',
                skill_usage_log: [],
                iteration_enforcement: { enabled: false },
                phases: {}
            });

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            assert.equal(result.stdout, '',
                'Should allow when enforcement is disabled');
        });

        // ---------------------------------------------------------------------
        // 16. No iteration requirements config file - allows
        // ---------------------------------------------------------------------
        it('allows when iteration-requirements.json is missing', async () => {
            // Delete the iteration requirements config
            const testDir = getTestDir();
            const configPath = path.join(testDir, '.claude', 'hooks', 'config', 'iteration-requirements.json');
            if (fs.existsSync(configPath)) {
                fs.unlinkSync(configPath);
            }

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            assert.equal(result.stdout, '',
                'Should allow when no requirements config exists');
        });

        // ---------------------------------------------------------------------
        // 17. No current_phase set in state - allows
        // ---------------------------------------------------------------------
        it('allows when no current_phase is set in state', async () => {
            writeTestRequirements();

            writeState({
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                // No current_phase key
                skill_usage_log: [],
                iteration_enforcement: { enabled: true },
                phases: {}
            });

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            assert.equal(result.stdout, '',
                'Should allow when no current_phase is set');
        });

        // ---------------------------------------------------------------------
        // 18. Gate block updates state with blocking info
        // ---------------------------------------------------------------------
        it('updates state with gate_validation blocking info on block', async () => {
            writeTestRequirements({
                agent_delegation_validation: { enabled: false }
            });

            writeState({
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                current_phase: '06-implementation',
                skill_usage_log: [],
                iteration_enforcement: { enabled: true },
                phases: {
                    '06-implementation': { status: 'in_progress' }
                }
            });

            await runHook(hookPath, gateAdvanceInput('advance'));

            const state = readState();
            const gateVal = state.phases?.['06-implementation']?.gate_validation;
            assert.ok(gateVal, 'Should have gate_validation in state');
            assert.equal(gateVal.status, 'blocked');
            assert.ok(gateVal.blocked_at, 'Should have blocked_at timestamp');
            assert.ok(Array.isArray(gateVal.blocking_requirements),
                'Should have blocking_requirements array');
            assert.ok(gateVal.blocking_requirements.length > 0,
                'Should have at least one blocking requirement');
        });

        // ---------------------------------------------------------------------
        // 19. Orchestrator with "next phase" keyword triggers gate check
        // ---------------------------------------------------------------------
        it('triggers gate check with "next phase" keyword', async () => {
            writeTestRequirements({
                test_iteration: { enabled: false },
                constitutional_validation: { enabled: false },
                agent_delegation_validation: { enabled: false }
            });

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    prompt: 'move to next phase of the SDLC',
                    subagent_type: 'sdlc-orchestrator'
                }
            });

            // With all requirements disabled, gate should open (allow)
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '',
                'Should allow when all requirements are disabled');
        });

        // ---------------------------------------------------------------------
        // 20. Constitutional validation completed but NOT compliant - blocks
        // ---------------------------------------------------------------------
        it('blocks when constitutional_validation is completed but status is not compliant', async () => {
            writeTestRequirements({
                test_iteration: { enabled: false },
                agent_delegation_validation: { enabled: false }
            });

            writeState({
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                current_phase: '06-implementation',
                skill_usage_log: [],
                iteration_enforcement: { enabled: true },
                phases: {
                    '06-implementation': {
                        status: 'in_progress',
                        constitutional_validation: {
                            completed: true,
                            status: 'non-compliant',
                            iterations_used: 5,
                            max_iterations: 5
                        }
                    }
                }
            });

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            const output = JSON.parse(result.stdout);
            assert.equal(output.continue, false);
            assert.ok(output.stopReason.includes('constitutional_validation'),
                'Should block on non-compliant constitutional validation');
        });

        // ---------------------------------------------------------------------
        // 21. Skill tool with "gate" in args triggers gate check
        // ---------------------------------------------------------------------
        it('triggers gate check when Skill tool has "gate" in args', async () => {
            writeTestRequirements({
                test_iteration: { enabled: false },
                constitutional_validation: { enabled: false },
                agent_delegation_validation: { enabled: false }
            });

            const result = await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: {
                    skill: 'sdlc',
                    args: 'gate check for phase 06'
                }
            });

            assert.equal(result.code, 0);
            // All requirements disabled, so should allow
            assert.equal(result.stdout, '',
                'Gate check via Skill with all requirements disabled should allow');
        });

        // ---------------------------------------------------------------------
        // 22. Interactive elicitation not completed - blocks for Phase 01
        // ---------------------------------------------------------------------
        it('blocks when interactive_elicitation is required but not completed', async () => {
            writeIterationRequirements({
                version: '2.0.0',
                phase_requirements: {
                    '01-requirements': {
                        interactive_elicitation: {
                            enabled: true,
                            min_menu_interactions: 3,
                            required_final_selection: ['save', 'continue']
                        },
                        test_iteration: { enabled: false },
                        constitutional_validation: { enabled: false },
                        agent_delegation_validation: { enabled: false }
                    }
                }
            });

            writeState({
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                current_phase: '01-requirements',
                skill_usage_log: [],
                iteration_enforcement: { enabled: true },
                phases: {
                    '01-requirements': {
                        status: 'in_progress',
                        iteration_requirements: {
                            interactive_elicitation: {
                                required: true,
                                completed: false,
                                menu_interactions: 1,
                                selections: []
                            }
                        }
                    }
                }
            });

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    prompt: 'advance to next phase',
                    subagent_type: 'sdlc-orchestrator'
                }
            });

            assert.equal(result.code, 0);
            const output = JSON.parse(result.stdout);
            assert.equal(output.continue, false);
            assert.ok(output.stopReason.includes('interactive_elicitation'),
                'Block reason should mention interactive_elicitation');
        });

        // ---------------------------------------------------------------------
        // 23. Setup command "init" bypasses gate check via Task
        // ---------------------------------------------------------------------
        it('bypasses gate check for "init" setup command in Task prompt', async () => {
            writeTestRequirements();

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    prompt: 'init the project and advance the workflow',
                    subagent_type: 'sdlc-orchestrator'
                }
            });

            assert.equal(result.stdout, '', 'Should bypass gate for init command');
            assert.equal(result.code, 0);
        });

        // ---------------------------------------------------------------------
        // 24. Orchestrator with "proceed" keyword triggers gate check
        // ---------------------------------------------------------------------
        it('triggers gate check with "proceed" keyword', async () => {
            writeTestRequirements();

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    prompt: 'proceed to the testing phase',
                    subagent_type: 'sdlc-orchestrator'
                }
            });

            assert.equal(result.code, 0);
            // Should block since no requirements are met
            assert.ok(result.stdout, 'Should produce blocking output');
            const output = JSON.parse(result.stdout);
            assert.equal(output.continue, false, 'Should block on proceed keyword');
        });
    });
});
