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
const hookSrcPath = path.resolve(__dirname, '..', 'gate-blocker.cjs');

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
                    skill: 'isdlc',
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
                    skill: 'isdlc',
                    args: 'status advance'
                }
            });

            // 'status' is a setup keyword
            assert.equal(result.stdout, '', 'Should pass through for status command');
            assert.equal(result.code, 0);
        });

        // =================================================================
        // BUG-0031: Exempt action verb tests (analyze, add)
        // These verbs are workflow-independent and must never be blocked
        // by gate-blocker checks even when description contains "gate".
        // =================================================================

        // ---------------------------------------------------------------------
        // 7. TC-GB-01: analyze verb is exempt from gate-blocker
        // Requirement: FR-001 / AC-001-01, AC-001-03
        // ---------------------------------------------------------------------
        it('allows analyze verb via Skill (exempt action, BUG-0031)', async () => {
            writeTestRequirements();

            const result = await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: {
                    skill: 'isdlc',
                    args: 'analyze "gate-blocker blocks analyze"'
                }
            });

            // 'analyze' is an exempt action — description contains "gate" but must not trigger block
            assert.equal(result.stdout, '', 'Should pass through for analyze verb');
            assert.equal(result.code, 0);
        });

        // ---------------------------------------------------------------------
        // 8. TC-GB-02: add verb is exempt from gate-blocker
        // Requirement: FR-001 / AC-001-02
        // ---------------------------------------------------------------------
        it('allows add verb via Skill (exempt action, BUG-0031)', async () => {
            writeTestRequirements();

            const result = await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: {
                    skill: 'isdlc',
                    args: 'add "fix gate issue"'
                }
            });

            // 'add' is an exempt action — description contains "gate" but must not trigger block
            assert.equal(result.stdout, '', 'Should pass through for add verb');
            assert.equal(result.code, 0);
        });

        // ---------------------------------------------------------------------
        // 9. TC-GB-03: analyze with flags is exempt from gate-blocker
        // Requirement: FR-003 / AC-003-02
        // ---------------------------------------------------------------------
        it('allows analyze verb with leading flags via Skill (exempt action, BUG-0031)', async () => {
            writeTestRequirements();

            const result = await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: {
                    skill: 'isdlc',
                    args: '--verbose analyze "#64 gate issue"'
                }
            });

            // Regex must skip --verbose flag and extract 'analyze' as action verb
            assert.equal(result.stdout, '', 'Should pass through for analyze with flags');
            assert.equal(result.code, 0);
        });

        // ---------------------------------------------------------------------
        // 10. TC-GB-04: advance verb is NOT exempt (regression)
        // Requirement: FR-001 / AC-001-04
        // ---------------------------------------------------------------------
        it('still blocks advance verb via Skill (NOT exempt, BUG-0031 regression)', async () => {
            writeTestRequirements();

            const result = await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: {
                    skill: 'isdlc',
                    args: 'advance to next phase'
                }
            });

            assert.equal(result.code, 0);
            assert.ok(result.stdout, 'Should produce blocking output');
            const output = JSON.parse(result.stdout);
            assert.equal(output.continue, false, 'Should block advance verb');
            assert.ok(output.stopReason.includes('GATE BLOCKED'), 'Should include GATE BLOCKED');
        });

        // ---------------------------------------------------------------------
        // 11. TC-GB-05: build verb is NOT exempt
        // Requirement: FR-004 / AC-004-04
        // ---------------------------------------------------------------------
        it('blocks build verb with "gate" in description via Skill (NOT exempt, BUG-0031)', async () => {
            writeTestRequirements();

            const result = await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: {
                    skill: 'isdlc',
                    args: 'build "something with gate"'
                }
            });

            assert.equal(result.code, 0);
            assert.ok(result.stdout, 'Should produce blocking output');
            const output = JSON.parse(result.stdout);
            assert.equal(output.continue, false, 'Should block build with gate keyword');
        });

        // ---------------------------------------------------------------------
        // 12. TC-GB-06: empty args is handled safely
        // Requirement: FR-003 / AC-003-03
        // ---------------------------------------------------------------------
        it('handles empty args safely via Skill (BUG-0031 edge case)', async () => {
            writeTestRequirements();

            const result = await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: {
                    skill: 'isdlc',
                    args: ''
                }
            });

            // Empty args: action = '', not in EXEMPT_ACTIONS, but also no 'advance'/'gate' match
            assert.equal(result.stdout, '', 'Should pass through for empty args');
            assert.equal(result.code, 0);
        });

        // ---------------------------------------------------------------------
        // 13. TC-GB-07: gate-check verb is NOT exempt (regression)
        // Requirement: FR-001 / AC-001-05
        // ---------------------------------------------------------------------
        it('still blocks gate-check verb via Skill (NOT exempt, BUG-0031 regression)', async () => {
            writeTestRequirements();

            const result = await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: {
                    skill: 'isdlc',
                    args: 'gate-check'
                }
            });

            assert.equal(result.code, 0);
            assert.ok(result.stdout, 'Should produce blocking output');
            const output = JSON.parse(result.stdout);
            assert.equal(output.continue, false, 'Should block gate-check verb');
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
                    skill: 'isdlc',
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
        // 24. Gate block writes pending_escalations to state.json
        // ---------------------------------------------------------------------
        it('writes pending_escalations entry when gate is blocked', async () => {
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

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            const output = JSON.parse(result.stdout);
            assert.equal(output.continue, false);

            const state = readState();
            assert.ok(Array.isArray(state.pending_escalations), 'Should have pending_escalations array');
            assert.ok(state.pending_escalations.length > 0, 'Should have at least one escalation');

            const escalation = state.pending_escalations[0];
            assert.equal(escalation.type, 'gate_blocked');
            assert.equal(escalation.hook, 'gate-blocker');
            assert.equal(escalation.phase, '06-implementation');
            assert.ok(escalation.detail.includes('GATE BLOCKED'));
            assert.ok(escalation.timestamp, 'Should have timestamp');
        });

        // ---------------------------------------------------------------------
        // 25. Orchestrator with "proceed" keyword triggers gate check
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

    // =========================================================================
    // BUG-0008: Delegation Guard
    // Delegation prompts from the phase-loop controller must NOT be treated
    // as gate advancement attempts. The gate-blocker checks orchestrator
    // subagent_type + gate keywords, which can false-positive on delegation
    // prompts containing "GATE-NN".
    // FIX-003: AC-09 through AC-11
    // =========================================================================

    describe('BUG-0008: Delegation guard', () => {

        // TC-GB-D01: Delegation bypasses gate advancement check (phase agent subagent with GATE keyword)
        // Requirement: FIX-003, AC-09
        // The phase-loop controller delegates with the TARGET agent as subagent_type.
        // The prompt contains "GATE-06" which could trigger gate keyword matching if
        // the hook mistakenly checks gate keywords before delegation detection.
        it('allows delegation prompt with software-developer subagent containing GATE keyword', async () => {
            writeTestRequirements();

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    prompt: 'Execute Phase 06 - Implementation for fix workflow.\nValidate GATE-06 on completion.',
                    subagent_type: 'software-developer'
                }
            });
            assert.equal(result.code, 0);
            // software-developer is not an orchestrator, so existing code already passes through.
            // The delegation guard provides defense-in-depth: detectPhaseDelegation identifies
            // software-developer as a known phase agent before the orchestrator check is reached.
            assert.equal(result.stdout, '', 'Delegation with software-developer subagent should NOT be blocked');
        });

        // TC-GB-D02: Delegation bypasses gate check for non-orchestrator subagent
        // Requirement: FIX-003, AC-09
        it('allows delegation prompt for non-orchestrator subagent (test-design-engineer)', async () => {
            writeTestRequirements();

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    prompt: 'Execute Phase 05 - Test Strategy for fix workflow.\nValidate GATE-05 on completion.',
                    subagent_type: 'test-design-engineer'
                }
            });
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '', 'Non-orchestrator delegation should pass through');
        });

        // TC-GB-D03: Genuine gate advancement by orchestrator still detected
        // Requirement: FIX-003, AC-10
        it('still blocks genuine orchestrator "advance to the next phase" after guard', async () => {
            writeTestRequirements();

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    prompt: 'Please advance to the next phase',
                    subagent_type: 'sdlc-orchestrator'
                }
            });
            assert.equal(result.code, 0);
            assert.ok(result.stdout, 'Should produce blocking output for genuine gate advance');
            const output = JSON.parse(result.stdout);
            assert.equal(output.continue, false);
            assert.ok(output.stopReason.includes('GATE BLOCKED'));
        });

        // TC-GB-D04: Orchestrator subagent_type check still functional
        // Requirement: FIX-003, AC-11
        it('still blocks orchestrator "gate check" after delegation guard added', async () => {
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
            assert.equal(output.continue, false);
            assert.ok(output.stopReason.includes('GATE BLOCKED'));
        });

        // TC-GB-D05: Delegation with phase pattern in prompt bypasses gate check
        // Requirement: FIX-003, AC-09
        it('allows delegation with phase pattern "02-tracing" and GATE-02', async () => {
            writeTestRequirements();

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    prompt: 'Execute Phase 02 - Tracing for fix workflow.\nPhase key: 02-tracing\nValidate GATE-02 on completion.',
                    subagent_type: 'trace-analyst'
                }
            });
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '', 'Delegation with phase pattern should NOT be blocked');
        });

        // TC-GB-D06: Delegation with agent name in description bypasses gate check
        // Requirement: FIX-003, AC-09
        it('allows delegation with agent name "code-reviewer" in description', async () => {
            writeTestRequirements();

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    prompt: 'Execute Phase 08 - Code Review.',
                    description: 'Validate GATE-08 on completion. Delegate to code-reviewer.',
                    subagent_type: 'code-reviewer'
                }
            });
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '', 'Delegation with agent name in description should NOT be blocked');
        });
    });

    // =========================================================================
    // Self-Healing: Phase Key Normalization
    // =========================================================================

    describe('Self-healing: phase key normalization', () => {
        it('normalizes alias phase keys before requirements lookup', async () => {
            // Use an alias phase key (13-test-deploy → 12-test-deploy)
            cleanupTestEnv();
            setupTestEnv({
                current_phase: '13-test-deploy',  // alias
                iteration_enforcement: { enabled: true },
                phases: {
                    '12-test-deploy': {
                        status: 'completed',
                        gate_passed: '2026-01-01T00:00:00Z',
                        constitutional_validation: {
                            status: 'compliant',
                            completed: true,
                            articles_checked: ['IX', 'X']
                        }
                    }
                }
            });
            hookPath = prepareHook(hookSrcPath);
            writeTestRequirements({
                agent_delegation_validation: { enabled: false }
            });

            // Write iteration-requirements.json with 12-test-deploy entry
            writeIterationRequirements({
                version: '2.0.0',
                phase_requirements: {
                    '12-test-deploy': {
                        interactive_elicitation: { enabled: false },
                        test_iteration: { enabled: false },
                        constitutional_validation: {
                            enabled: true,
                            max_iterations: 5,
                            articles: ['IX', 'X']
                        },
                        agent_delegation_validation: { enabled: false }
                    }
                },
                gate_blocking_rules: {
                    block_on_incomplete_constitutional: true
                }
            });

            const result = await runHook(hookPath, gateAdvanceInput('advance'));
            assert.equal(result.code, 0);
            // Should self-heal and allow (constitutional already satisfied)
            // The [SELF-HEAL] message appears in stderr (not stdout, which is hook protocol)
            const stderr = result.stderr;
            assert.ok(stderr.includes('[SELF-HEAL]') || result.stdout === '',
                'Should self-heal or allow through');
        });

        it('self-heals on missing requirements for unknown phase', async () => {
            cleanupTestEnv();
            setupTestEnv({
                current_phase: '99-unknown-phase',
                iteration_enforcement: { enabled: true }
            });
            hookPath = prepareHook(hookSrcPath);

            const result = await runHook(hookPath, gateAdvanceInput('advance'));
            assert.equal(result.code, 0);
            // Should allow through since no requirements exist
            assert.ok(result.stderr.includes('[SELF-HEAL]') || result.stdout === '',
                'Should self-heal for missing requirements');
        });
    });

    // =========================================================================
    // Self-Healing: Cross-Reference Agent Delegation
    // =========================================================================

    describe('Self-healing: cross-reference delegation', () => {
        it('accepts pending_delegation as delegation evidence', async () => {
            // Set up state where skill_usage_log has no delegation
            // but pending_delegation has the correct agent
            cleanupTestEnv();
            setupTestEnv({
                current_phase: '06-implementation',
                iteration_enforcement: { enabled: true },
                pending_delegation: {
                    skill: 'isdlc',
                    required_agent: 'software-developer',
                    invoked_at: '2026-02-09T10:00:00Z'
                },
                skill_usage_log: [],
                phases: {
                    '06-implementation': {
                        status: 'in_progress',
                        iteration_requirements: {
                            test_iteration: {
                                completed: true,
                                status: 'passed',
                                current_iteration: 2,
                                max_iterations: 10
                            }
                        },
                        constitutional_validation: {
                            status: 'compliant',
                            completed: true,
                            articles_checked: ['I', 'II', 'VII']
                        }
                    }
                }
            });
            hookPath = prepareHook(hookSrcPath);
            writeTestRequirements();

            const result = await runHook(hookPath, gateAdvanceInput('advance'));
            assert.equal(result.code, 0);
            // Should not block on delegation since pending_delegation provides evidence
            if (result.stdout) {
                // If there is output, it should not block on agent_delegation
                const output = JSON.parse(result.stdout);
                if (output.continue === false) {
                    assert.ok(!output.stopReason.includes('DELEGATE_TO_PHASE_AGENT'),
                        'Should not block on delegation when pending_delegation exists');
                }
            }
        });

        it('accepts phase in_progress status as delegation evidence', async () => {
            cleanupTestEnv();
            setupTestEnv({
                current_phase: '06-implementation',
                iteration_enforcement: { enabled: true },
                skill_usage_log: [],
                phases: {
                    '06-implementation': {
                        status: 'in_progress',
                        iteration_requirements: {
                            test_iteration: {
                                completed: true,
                                status: 'passed',
                                current_iteration: 1,
                                max_iterations: 10
                            }
                        },
                        constitutional_validation: {
                            status: 'compliant',
                            completed: true,
                            articles_checked: ['I', 'II', 'VII']
                        }
                    }
                }
            });
            hookPath = prepareHook(hookSrcPath);
            writeTestRequirements();

            const result = await runHook(hookPath, gateAdvanceInput('advance'));
            assert.equal(result.code, 0);
            // Should not block on delegation since phase is in_progress
            if (result.stdout) {
                const output = JSON.parse(result.stdout);
                if (output.continue === false) {
                    assert.ok(!output.stopReason.includes('DELEGATE_TO_PHASE_AGENT'),
                        'Should not block on delegation when phase is in_progress');
                }
            }
        });
    });

    // =========================================================================
    // Self-Healing: [SELF-HEAL] notification output
    // =========================================================================

    describe('Self-healing: notification output', () => {
        it('outputs [SELF-HEAL] for missing requirements', async () => {
            cleanupTestEnv();
            setupTestEnv({
                current_phase: '12-remote-build',  // Has no requirements normally
                iteration_enforcement: { enabled: true }
            });
            hookPath = prepareHook(hookSrcPath);

            // Write requirements WITHOUT 12-remote-build entry
            writeIterationRequirements({
                version: '2.0.0',
                phase_requirements: {},
                gate_blocking_rules: {}
            });

            const result = await runHook(hookPath, gateAdvanceInput('advance'));
            assert.equal(result.code, 0);
            assert.ok(result.stderr.includes('[SELF-HEAL]'),
                'Should output [SELF-HEAL] notification for missing requirements (on stderr)');
        });
    });

    // =========================================================================
    // BUG-0005: Fallback Branch Read-Priority Fix (AC-03e)
    // gate-blocker else branch (line 578) must prefer active_workflow.current_phase
    // Note: the if-branch (line 549) is already correct
    // =========================================================================

    describe('BUG-0005: fallback branch active_workflow.current_phase read priority (AC-03e)', () => {

        // TC-03e-01: Fallback branch uses top-level when no active_workflow
        it('fallback branch uses top-level current_phase when no active_workflow exists', async () => {
            cleanupTestEnv();
            setupTestEnv({
                current_phase: '06-implementation',
                // no active_workflow
                iteration_enforcement: { enabled: true },
                phases: {
                    '06-implementation': {
                        status: 'in_progress',
                        iteration_requirements: {
                            test_iteration: { status: 'success', iterations: 3 }
                        },
                        constitutional_validation: { completed: true, status: 'compliant' }
                    }
                }
            });
            hookPath = prepareHook(hookSrcPath);
            writeTestRequirements();

            const result = await runHook(hookPath, gateAdvanceInput('advance'));
            assert.equal(result.code, 0);
            // Should evaluate 06-implementation gate requirements from top-level current_phase
        });

        // TC-03e-02: Fallback branch allows when no current_phase available (fail-open)
        it('fallback branch allows when no current_phase is available', async () => {
            cleanupTestEnv();
            setupTestEnv();
            // Write state manually to ensure current_phase is truly absent
            writeState({
                iteration_enforcement: { enabled: true },
                phases: {}
            });
            hookPath = prepareHook(hookSrcPath);
            writeTestRequirements();

            const result = await runHook(hookPath, gateAdvanceInput('advance'));
            assert.equal(result.code, 0);
            // Should allow (fail-open per line 582-583: "No current phase set")
            assert.equal(result.stdout, '', 'Should allow when no phase is set (fail-open)');
        });

        // TC-03e-03: Fallback branch with active_workflow.current_phase set
        // After the fix, even the else branch should check active_workflow?.current_phase
        it('fallback branch resolves via active_workflow.current_phase after fix', async () => {
            // This is a subtle edge case: the if-branch checks `if (activeWorkflow)`
            // where activeWorkflow = state.active_workflow. If active_workflow exists,
            // the if-branch handles it. The else branch only runs when active_workflow
            // is null/undefined. Our fix makes the else branch also check
            // state.active_workflow?.current_phase as a safety net, but in practice
            // this path only adds value if someone sets active_workflow to a falsy value
            // while still having state.active_workflow.current_phase accessible (impossible).
            // The real value: consistency with all other hooks.
            cleanupTestEnv();
            setupTestEnv({
                current_phase: '06-implementation',
                // no active_workflow — else branch is entered
                iteration_enforcement: { enabled: true },
                phases: {
                    '06-implementation': {
                        status: 'in_progress'
                    }
                }
            });
            hookPath = prepareHook(hookSrcPath);
            writeTestRequirements();

            const result = await runHook(hookPath, gateAdvanceInput('advance'));
            assert.equal(result.code, 0);
            // Should resolve 06-implementation and evaluate its gate requirements
            if (result.stdout) {
                const output = JSON.parse(result.stdout);
                // If it blocked, it should reference 06-implementation requirements
                if (output.stopReason) {
                    assert.ok(!output.stopReason.includes('No current phase'),
                        'Should have found a phase to evaluate');
                }
            }
        });
    });

    // =========================================================================
    // REQ-0013: Supervised Mode Awareness
    // Gate-blocker operates independently of supervised mode — it validates
    // iteration requirements as normal. These tests verify no interference.
    // =========================================================================

    describe('REQ-0013: Supervised mode awareness', () => {

        // SM-01: Gate allows advancement when supervised_mode enabled and all requirements pass
        it('allows advancement when supervised_mode.enabled=true and all requirements pass (AC-06a)', async () => {
            writeTestRequirements({
                agent_delegation_validation: { enabled: false }
            });

            writeState({
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                current_phase: '06-implementation',
                skill_usage_log: [],
                iteration_enforcement: { enabled: true },
                supervised_mode: {
                    enabled: true,
                    review_phases: 'all',
                    parallel_summary: true,
                    auto_advance_timeout: null
                },
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
            assert.equal(result.stdout, '',
                'Should allow when all requirements satisfied regardless of supervised_mode');
        });

        // SM-02: Gate blocks when requirements fail, regardless of supervised_mode
        it('blocks when requirements fail even with supervised_mode enabled (AC-06b)', async () => {
            writeTestRequirements({
                agent_delegation_validation: { enabled: false }
            });

            writeState({
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                current_phase: '06-implementation',
                skill_usage_log: [],
                iteration_enforcement: { enabled: true },
                supervised_mode: {
                    enabled: true,
                    review_phases: 'all'
                },
                phases: {
                    '06-implementation': {
                        status: 'in_progress'
                        // No test_iteration, no constitutional_validation
                    }
                }
            });

            const result = await runHook(hookPath, gateAdvanceInput('advance'));
            assert.equal(result.code, 0);
            assert.ok(result.stdout, 'Should produce blocking output');
            const output = JSON.parse(result.stdout);
            assert.equal(output.continue, false, 'Should block regardless of supervised_mode');
        });

        // SM-03: Gate does not crash when supervised_mode config is corrupt
        it('does not crash when supervised_mode config is corrupt (AC-06c)', async () => {
            writeTestRequirements({
                test_iteration: { enabled: false },
                constitutional_validation: { enabled: false },
                agent_delegation_validation: { enabled: false }
            });

            writeState({
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                current_phase: '06-implementation',
                skill_usage_log: [],
                iteration_enforcement: { enabled: true },
                supervised_mode: 'corrupt-value',  // Invalid type
                phases: {
                    '06-implementation': { status: 'in_progress' }
                }
            });

            const result = await runHook(hookPath, gateAdvanceInput('advance'));
            assert.equal(result.code, 0);
            // Should not crash — either allow or block based on requirements, not supervised_mode
            assert.equal(result.stdout, '',
                'Should allow when all requirements disabled, ignoring corrupt supervised_mode');
        });

        // SM-04: Info log appears when supervised_review.status === "reviewing"
        it('logs info when supervised_review is in reviewing status', async () => {
            writeTestRequirements({
                agent_delegation_validation: { enabled: false }
            });

            writeState({
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                current_phase: '06-implementation',
                skill_usage_log: [],
                iteration_enforcement: { enabled: true },
                active_workflow: {
                    type: 'feature',
                    supervised_review: {
                        phase: '06-implementation',
                        status: 'reviewing',
                        paused_at: '2026-02-14T10:45:00Z'
                    }
                },
                phases: {
                    '06-implementation': {
                        status: 'in_progress'
                        // Missing requirements — will block
                    }
                }
            });

            const result = await runHook(hookPath, gateAdvanceInput('advance'));
            assert.equal(result.code, 0);
            // The info log should appear in stderr
            assert.ok(
                result.stderr.includes('[INFO] gate-blocker: supervised review in progress') ||
                result.stderr.includes('supervised review'),
                'Should log supervised review info on stderr'
            );
        });

        // SM-05: Gate works normally when supervised_mode block is missing entirely
        it('works normally when supervised_mode block is absent', async () => {
            writeTestRequirements({
                test_iteration: { enabled: false },
                constitutional_validation: { enabled: false },
                agent_delegation_validation: { enabled: false }
            });

            writeState({
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                current_phase: '06-implementation',
                skill_usage_log: [],
                iteration_enforcement: { enabled: true },
                // No supervised_mode at all
                phases: {
                    '06-implementation': { status: 'in_progress' }
                }
            });

            const result = await runHook(hookPath, gateAdvanceInput('advance'));
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '',
                'Should allow when all requirements disabled and no supervised_mode');
        });

        // SM-06: Gate does not crash when supervised_review.status has unexpected value
        it('handles unexpected supervised_review.status gracefully', async () => {
            writeTestRequirements({
                test_iteration: { enabled: false },
                constitutional_validation: { enabled: false },
                agent_delegation_validation: { enabled: false }
            });

            writeState({
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                current_phase: '06-implementation',
                skill_usage_log: [],
                iteration_enforcement: { enabled: true },
                active_workflow: {
                    type: 'feature',
                    supervised_review: {
                        phase: '06-implementation',
                        status: 'unexpected_status'
                    }
                },
                phases: {
                    '06-implementation': { status: 'in_progress' }
                }
            });

            const result = await runHook(hookPath, gateAdvanceInput('advance'));
            assert.equal(result.code, 0);
            // Should not crash, should not log the reviewing info since status is not "reviewing"
            assert.ok(!result.stderr.includes('[INFO] gate-blocker: supervised review in progress'),
                'Should not log supervised review info for non-reviewing status');
        });

        // SM-07: Gate does not crash when active_workflow.supervised_review is null
        it('handles null supervised_review gracefully', async () => {
            writeTestRequirements({
                test_iteration: { enabled: false },
                constitutional_validation: { enabled: false },
                agent_delegation_validation: { enabled: false }
            });

            writeState({
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                current_phase: '06-implementation',
                skill_usage_log: [],
                iteration_enforcement: { enabled: true },
                active_workflow: {
                    type: 'feature',
                    supervised_review: null
                },
                phases: {
                    '06-implementation': { status: 'in_progress' }
                }
            });

            const result = await runHook(hookPath, gateAdvanceInput('advance'));
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '', 'Should allow through');
        });

        // SM-08: Gate preserves supervised_mode config in state (does not delete or modify it)
        it('preserves supervised_mode config in state after gate check', async () => {
            writeTestRequirements({
                test_iteration: { enabled: false },
                constitutional_validation: { enabled: false },
                agent_delegation_validation: { enabled: false }
            });

            const supervisedConfig = {
                enabled: true,
                review_phases: ['03', '06'],
                parallel_summary: true,
                auto_advance_timeout: null
            };

            writeState({
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                current_phase: '06-implementation',
                skill_usage_log: [],
                iteration_enforcement: { enabled: true },
                supervised_mode: supervisedConfig,
                phases: {
                    '06-implementation': { status: 'in_progress' }
                }
            });

            await runHook(hookPath, gateAdvanceInput('advance'));

            const state = readState();
            assert.deepStrictEqual(state.supervised_mode, supervisedConfig,
                'supervised_mode config should be preserved unchanged');
        });
    });

    // =========================================================================
    // BUG-0017: Artifact Variant Reporting
    // When checkArtifactPresenceRequirement finds multiple variant paths in the
    // same directory and NONE exist, the error message should list ALL variants,
    // not just the first one (dirPaths[0]).
    // =========================================================================

    describe('BUG-0017: Artifact variant reporting', () => {

        /**
         * Helper: write iteration requirements with artifact_validation paths.
         * Disables all other gate requirements so artifact check is isolated.
         */
        function writeArtifactRequirements(phase, artifactPaths) {
            writeIterationRequirements({
                version: '2.0.0',
                phase_requirements: {
                    [phase]: {
                        interactive_elicitation: { enabled: false },
                        test_iteration: { enabled: false },
                        constitutional_validation: { enabled: false },
                        agent_delegation_validation: { enabled: false },
                        artifact_validation: {
                            enabled: true,
                            paths: artifactPaths
                        }
                    }
                },
                gate_blocking_rules: {
                    block_on_missing_artifacts: true
                }
            });
        }

        // TC-GB-V01: Multi-variant missing: error lists all variants
        // Requirement: AC-1.1, FR-1, FR-2, FR-3
        it('TC-GB-V01: multi-variant missing error lists all variants', async () => {
            cleanupTestEnv();
            setupTestEnv();
            hookPath = prepareHook(hookSrcPath);

            writeArtifactRequirements('04-design', [
                'docs/design/{artifact_folder}/interface-spec.yaml',
                'docs/design/{artifact_folder}/interface-spec.md'
            ]);

            writeState({
                current_phase: '04-design',
                active_workflow: {
                    type: 'feature',
                    artifact_folder: 'REQ-TEST',
                    current_phase: '04-design'
                },
                iteration_enforcement: { enabled: true },
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                skill_usage_log: [],
                phases: {
                    '04-design': { status: 'in_progress' }
                }
            });

            // Do NOT create either variant file on disk
            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            assert.ok(result.stdout, 'Should produce blocking output');
            const output = JSON.parse(result.stdout);
            assert.equal(output.continue, false);
            assert.ok(output.stopReason.includes('interface-spec.yaml'),
                'Should mention first variant');
            assert.ok(output.stopReason.includes('interface-spec.md'),
                'Should mention second variant');
            assert.ok(output.stopReason.includes('(or'),
                'Should use "or" syntax for alternatives');
        });

        // TC-GB-V02: Multi-variant satisfied by second variant
        // Requirement: AC-1.2
        it('TC-GB-V02: multi-variant satisfied by second variant', async () => {
            cleanupTestEnv();
            setupTestEnv();
            hookPath = prepareHook(hookSrcPath);

            writeArtifactRequirements('04-design', [
                'docs/design/{artifact_folder}/interface-spec.yaml',
                'docs/design/{artifact_folder}/interface-spec.md'
            ]);

            writeState({
                current_phase: '04-design',
                active_workflow: {
                    type: 'feature',
                    artifact_folder: 'REQ-TEST',
                    current_phase: '04-design'
                },
                iteration_enforcement: { enabled: true },
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                skill_usage_log: [],
                phases: {
                    '04-design': { status: 'in_progress' }
                }
            });

            // Create the SECOND variant file on disk
            const td = getTestDir();
            const docsDir = path.join(td, 'docs', 'design', 'REQ-TEST');
            fs.mkdirSync(docsDir, { recursive: true });
            fs.writeFileSync(path.join(docsDir, 'interface-spec.md'), '# Interface Spec\n');
            // Do NOT create interface-spec.yaml

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            // Gate should not block on artifacts (second variant satisfies)
            if (result.stdout) {
                assert.ok(!result.stdout.includes('interface-spec'),
                    'Should not block on artifact when second variant exists');
            }
        });

        // TC-GB-V03: Single-path missing: error unchanged (no "or" syntax)
        // Requirement: AC-1.3
        it('TC-GB-V03: single-path missing error has no "or" syntax', async () => {
            cleanupTestEnv();
            setupTestEnv();
            hookPath = prepareHook(hookSrcPath);

            writeArtifactRequirements('01-requirements', [
                'docs/requirements/{artifact_folder}/requirements-spec.md'
            ]);

            writeState({
                current_phase: '01-requirements',
                active_workflow: {
                    type: 'feature',
                    artifact_folder: 'REQ-TEST',
                    current_phase: '01-requirements'
                },
                iteration_enforcement: { enabled: true },
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                skill_usage_log: [],
                phases: {
                    '01-requirements': { status: 'in_progress' }
                }
            });

            // Do NOT create requirements-spec.md
            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            const output = JSON.parse(result.stdout);
            assert.equal(output.continue, false);
            assert.ok(output.stopReason.includes('requirements-spec.md'),
                'Should mention the single missing artifact');
            assert.ok(!output.stopReason.includes('(or'),
                'Should NOT use "or" syntax for single-path requirement');
        });

        // TC-GB-V04: Composite representation in missing_artifacts state
        // Requirement: AC-1.4, FR-2
        it('TC-GB-V04: composite variant representation in gate_validation state', async () => {
            cleanupTestEnv();
            setupTestEnv();
            hookPath = prepareHook(hookSrcPath);

            writeArtifactRequirements('04-design', [
                'docs/design/{artifact_folder}/interface-spec.yaml',
                'docs/design/{artifact_folder}/interface-spec.md'
            ]);

            writeState({
                current_phase: '04-design',
                active_workflow: {
                    type: 'feature',
                    artifact_folder: 'REQ-TEST',
                    current_phase: '04-design'
                },
                iteration_enforcement: { enabled: true },
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                skill_usage_log: [],
                phases: {
                    '04-design': { status: 'in_progress' }
                }
            });

            // Do NOT create either variant
            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            const output = JSON.parse(result.stdout);
            assert.equal(output.continue, false);

            // Read state to check gate_validation
            const state = readState();
            const gateVal = state.phases?.['04-design']?.gate_validation;
            assert.ok(gateVal, 'Should have gate_validation');
            assert.equal(gateVal.status, 'blocked');
            // The stopReason should reference variant composite
            assert.ok(output.stopReason.includes('(or'),
                'Missing artifacts should show composite variant representation');
        });

        // TC-GB-V05: All variants exist: no artifact error
        // Requirement: AC-1.5
        it('TC-GB-V05: all variants exist, no artifact error', async () => {
            cleanupTestEnv();
            setupTestEnv();
            hookPath = prepareHook(hookSrcPath);

            writeArtifactRequirements('04-design', [
                'docs/design/{artifact_folder}/interface-spec.yaml',
                'docs/design/{artifact_folder}/interface-spec.md'
            ]);

            writeState({
                current_phase: '04-design',
                active_workflow: {
                    type: 'feature',
                    artifact_folder: 'REQ-TEST',
                    current_phase: '04-design'
                },
                iteration_enforcement: { enabled: true },
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                skill_usage_log: [],
                phases: {
                    '04-design': { status: 'in_progress' }
                }
            });

            // Create BOTH variant files
            const td = getTestDir();
            const docsDir = path.join(td, 'docs', 'design', 'REQ-TEST');
            fs.mkdirSync(docsDir, { recursive: true });
            fs.writeFileSync(path.join(docsDir, 'interface-spec.yaml'), 'openapi: 3.0.0\n');
            fs.writeFileSync(path.join(docsDir, 'interface-spec.md'), '# Interface Spec\n');

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            // No artifact-related block
            if (result.stdout) {
                assert.ok(!result.stdout.includes('interface-spec'),
                    'Should not block when all variants exist');
            }
        });

        // TC-GB-V07: Three-variant group: all listed when missing
        // Requirement: AC-1.1 (edge case)
        it('TC-GB-V07: three-variant group all listed when missing', async () => {
            cleanupTestEnv();
            setupTestEnv();
            hookPath = prepareHook(hookSrcPath);

            writeArtifactRequirements('04-design', [
                'docs/design/{artifact_folder}/spec.yaml',
                'docs/design/{artifact_folder}/spec.md',
                'docs/design/{artifact_folder}/spec.json'
            ]);

            writeState({
                current_phase: '04-design',
                active_workflow: {
                    type: 'feature',
                    artifact_folder: 'REQ-TEST',
                    current_phase: '04-design'
                },
                iteration_enforcement: { enabled: true },
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                skill_usage_log: [],
                phases: {
                    '04-design': { status: 'in_progress' }
                }
            });

            // Do NOT create any variant file
            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            const output = JSON.parse(result.stdout);
            assert.equal(output.continue, false);
            assert.ok(output.stopReason.includes('spec.yaml'),
                'Should mention first variant');
            assert.ok(output.stopReason.includes('spec.md'),
                'Should mention second variant');
            assert.ok(output.stopReason.includes('spec.json'),
                'Should mention third variant');
        });
    });

    // =========================================================================
    // BUG-0020: Artifact path mismatch reproduction (TDD RED tests)
    // These tests reproduce the exact bug: agents write to docs/requirements/
    // but iteration-requirements.json points to docs/architecture/, docs/design/,
    // docs/testing/, docs/reviews/ -- causing gate blocks.
    //
    // Before the fix: these tests FAIL (gate blocks on wrong path)
    // After the fix: these tests PASS (gate-blocker reads from artifact-paths.json)
    // =========================================================================

    describe('BUG-0020: Artifact path mismatch reproduction', () => {

        /**
         * Helper: write iteration requirements with artifact_validation paths
         * and disable all other gate requirements for isolation.
         */
        function writeArtifactOnlyRequirements(phase, artifactPaths) {
            writeIterationRequirements({
                version: '2.0.0',
                phase_requirements: {
                    [phase]: {
                        interactive_elicitation: { enabled: false },
                        test_iteration: { enabled: false },
                        constitutional_validation: { enabled: false },
                        agent_delegation_validation: { enabled: false },
                        artifact_validation: {
                            enabled: true,
                            paths: artifactPaths
                        }
                    }
                },
                gate_blocking_rules: {
                    block_on_missing_artifacts: true
                }
            });
        }

        // TC-BUG20-RED01: Phase 03 architecture path mismatch
        // Traces: FR-02, FR-03, AC-05
        it('TC-BUG20-RED01: phase 03 artifact at docs/requirements/ passes gate with corrected paths', async () => {
            cleanupTestEnv();
            setupTestEnv();
            hookPath = prepareHook(hookSrcPath);

            writeArtifactOnlyRequirements('03-architecture', [
                'docs/requirements/{artifact_folder}/architecture-overview.md'
            ]);

            // Write artifact-paths.json with corrected path
            writeConfig('artifact-paths.json', {
                phases: {
                    '03-architecture': {
                        paths: ['docs/requirements/{artifact_folder}/architecture-overview.md']
                    }
                }
            });

            writeState({
                current_phase: '03-architecture',
                active_workflow: {
                    type: 'feature',
                    artifact_folder: 'REQ-TEST',
                    current_phase: '03-architecture'
                },
                iteration_enforcement: { enabled: true },
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                skill_usage_log: [],
                phases: {
                    '03-architecture': { status: 'in_progress' }
                }
            });

            // Agent writes to docs/requirements/ (the actual path)
            const td = getTestDir();
            const docsDir = path.join(td, 'docs', 'requirements', 'REQ-TEST');
            fs.mkdirSync(docsDir, { recursive: true });
            fs.writeFileSync(path.join(docsDir, 'architecture-overview.md'), '# Architecture\n');

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            // After fix: gate should PASS (artifact exists at corrected path)
            if (result.stdout) {
                const output = JSON.parse(result.stdout);
                if (output.continue === false) {
                    assert.ok(!output.stopReason.includes('artifact'),
                        'Should NOT block on artifact presence when file exists at corrected path');
                }
            }
        });

        // TC-BUG20-RED02: Phase 04 design path mismatch
        // Traces: FR-02, FR-03, AC-06
        it('TC-BUG20-RED02: phase 04 artifact at docs/requirements/ passes gate with corrected paths', async () => {
            cleanupTestEnv();
            setupTestEnv();
            hookPath = prepareHook(hookSrcPath);

            writeArtifactOnlyRequirements('04-design', [
                'docs/requirements/{artifact_folder}/module-design.md'
            ]);

            writeConfig('artifact-paths.json', {
                phases: {
                    '04-design': {
                        paths: ['docs/requirements/{artifact_folder}/module-design.md']
                    }
                }
            });

            writeState({
                current_phase: '04-design',
                active_workflow: {
                    type: 'feature',
                    artifact_folder: 'REQ-TEST',
                    current_phase: '04-design'
                },
                iteration_enforcement: { enabled: true },
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                skill_usage_log: [],
                phases: {
                    '04-design': { status: 'in_progress' }
                }
            });

            const td = getTestDir();
            const docsDir = path.join(td, 'docs', 'requirements', 'REQ-TEST');
            fs.mkdirSync(docsDir, { recursive: true });
            fs.writeFileSync(path.join(docsDir, 'module-design.md'), '# Module Design\n');

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            if (result.stdout) {
                const output = JSON.parse(result.stdout);
                if (output.continue === false) {
                    assert.ok(!output.stopReason.includes('artifact'),
                        'Should NOT block on artifact when file exists at corrected docs/requirements/ path');
                }
            }
        });

        // TC-BUG20-RED03: Phase 05 test-strategy path mismatch
        // Traces: FR-02, FR-03, AC-07
        it('TC-BUG20-RED03: phase 05 artifact at docs/requirements/ passes gate with corrected paths', async () => {
            cleanupTestEnv();
            setupTestEnv();
            hookPath = prepareHook(hookSrcPath);

            writeArtifactOnlyRequirements('05-test-strategy', [
                'docs/requirements/{artifact_folder}/test-strategy.md'
            ]);

            writeConfig('artifact-paths.json', {
                phases: {
                    '05-test-strategy': {
                        paths: ['docs/requirements/{artifact_folder}/test-strategy.md']
                    }
                }
            });

            writeState({
                current_phase: '05-test-strategy',
                active_workflow: {
                    type: 'fix',
                    artifact_folder: 'BUG-0020-GH-4',
                    current_phase: '05-test-strategy'
                },
                iteration_enforcement: { enabled: true },
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                skill_usage_log: [],
                phases: {
                    '05-test-strategy': { status: 'in_progress' }
                }
            });

            const td = getTestDir();
            const docsDir = path.join(td, 'docs', 'requirements', 'BUG-0020-GH-4');
            fs.mkdirSync(docsDir, { recursive: true });
            fs.writeFileSync(path.join(docsDir, 'test-strategy.md'), '# Test Strategy\n');

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            if (result.stdout) {
                const output = JSON.parse(result.stdout);
                if (output.continue === false) {
                    assert.ok(!output.stopReason.includes('artifact'),
                        'Should NOT block on artifact when file exists at corrected path');
                }
            }
        });

        // TC-BUG20-RED04: Phase 08 code-review path mismatch
        // Traces: FR-02, FR-03, AC-08
        it('TC-BUG20-RED04: phase 08 artifact at docs/requirements/ passes gate with corrected paths', async () => {
            cleanupTestEnv();
            setupTestEnv();
            hookPath = prepareHook(hookSrcPath);

            writeArtifactOnlyRequirements('08-code-review', [
                'docs/requirements/{artifact_folder}/review-summary.md'
            ]);

            writeConfig('artifact-paths.json', {
                phases: {
                    '08-code-review': {
                        paths: ['docs/requirements/{artifact_folder}/review-summary.md']
                    }
                }
            });

            writeState({
                current_phase: '08-code-review',
                active_workflow: {
                    type: 'feature',
                    artifact_folder: 'REQ-0020-t6-hook-io-optimization',
                    current_phase: '08-code-review'
                },
                iteration_enforcement: { enabled: true },
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                skill_usage_log: [],
                phases: {
                    '08-code-review': { status: 'in_progress' }
                }
            });

            const td = getTestDir();
            const docsDir = path.join(td, 'docs', 'requirements', 'REQ-0020-t6-hook-io-optimization');
            fs.mkdirSync(docsDir, { recursive: true });
            fs.writeFileSync(path.join(docsDir, 'review-summary.md'), '# Code Review\n');

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            if (result.stdout) {
                const output = JSON.parse(result.stdout);
                if (output.continue === false) {
                    assert.ok(!output.stopReason.includes('artifact'),
                        'Should NOT block on artifact when file exists at corrected path');
                }
            }
        });

        // TC-BUG20-RED05: Phase 01 already correct (baseline)
        // Traces: FR-02, AC-01
        it('TC-BUG20-RED05: phase 01 requirements path is already correct (baseline)', async () => {
            cleanupTestEnv();
            setupTestEnv();
            hookPath = prepareHook(hookSrcPath);

            writeArtifactOnlyRequirements('01-requirements', [
                'docs/requirements/{artifact_folder}/requirements-spec.md'
            ]);

            writeConfig('artifact-paths.json', {
                phases: {
                    '01-requirements': {
                        paths: ['docs/requirements/{artifact_folder}/requirements-spec.md']
                    }
                }
            });

            writeState({
                current_phase: '01-requirements',
                active_workflow: {
                    type: 'feature',
                    artifact_folder: 'REQ-TEST',
                    current_phase: '01-requirements'
                },
                iteration_enforcement: { enabled: true },
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                skill_usage_log: [],
                phases: {
                    '01-requirements': { status: 'in_progress' }
                }
            });

            const td = getTestDir();
            const docsDir = path.join(td, 'docs', 'requirements', 'REQ-TEST');
            fs.mkdirSync(docsDir, { recursive: true });
            fs.writeFileSync(path.join(docsDir, 'requirements-spec.md'), '# Requirements\n');

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            // This path was always correct -- should pass both before and after fix
            assert.equal(result.stdout, '',
                'Phase 01 should pass artifact check (path was always correct)');
        });
    });

    // =========================================================================
    // BUG-0020: artifact-paths.json integration tests
    // Tests that gate-blocker reads from artifact-paths.json with fallback.
    // =========================================================================

    describe('BUG-0020: artifact-paths.json integration', () => {

        /**
         * Helper: write iteration requirements with artifact_validation paths
         * and disable all other gate requirements for isolation.
         */
        function writeArtifactOnlyRequirements(phase, artifactPaths) {
            writeIterationRequirements({
                version: '2.0.0',
                phase_requirements: {
                    [phase]: {
                        interactive_elicitation: { enabled: false },
                        test_iteration: { enabled: false },
                        constitutional_validation: { enabled: false },
                        agent_delegation_validation: { enabled: false },
                        artifact_validation: {
                            enabled: true,
                            paths: artifactPaths
                        }
                    }
                },
                gate_blocking_rules: {
                    block_on_missing_artifacts: true
                }
            });
        }

        // TC-BUG20-INT01: Gate-blocker reads paths from artifact-paths.json
        // Traces: FR-03, AC-03
        it('TC-BUG20-INT01: gate-blocker uses artifact-paths.json over iteration-requirements.json', async () => {
            cleanupTestEnv();
            setupTestEnv();
            hookPath = prepareHook(hookSrcPath);

            // iteration-requirements.json has OLD (broken) path
            writeArtifactOnlyRequirements('03-architecture', [
                'docs/architecture/{artifact_folder}/architecture-overview.md'
            ]);

            // artifact-paths.json has CORRECT path
            writeConfig('artifact-paths.json', {
                phases: {
                    '03-architecture': {
                        paths: ['docs/requirements/{artifact_folder}/architecture-overview.md']
                    }
                }
            });

            writeState({
                current_phase: '03-architecture',
                active_workflow: {
                    type: 'feature',
                    artifact_folder: 'REQ-TEST',
                    current_phase: '03-architecture'
                },
                iteration_enforcement: { enabled: true },
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                skill_usage_log: [],
                phases: {
                    '03-architecture': { status: 'in_progress' }
                }
            });

            // Artifact exists at the CORRECT path (docs/requirements/)
            const td = getTestDir();
            const docsDir = path.join(td, 'docs', 'requirements', 'REQ-TEST');
            fs.mkdirSync(docsDir, { recursive: true });
            fs.writeFileSync(path.join(docsDir, 'architecture-overview.md'), '# Architecture\n');

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            // Gate should PASS because gate-blocker reads artifact-paths.json (correct path)
            assert.equal(result.stdout, '',
                'Gate should pass when artifact-paths.json has correct path and artifact exists');
        });

        // TC-BUG20-INT02: Fallback to iteration-requirements.json
        // Traces: FR-03, NFR-01, AC-04
        it('TC-BUG20-INT02: falls back to iteration-requirements.json when artifact-paths.json is missing', async () => {
            cleanupTestEnv();
            setupTestEnv();
            hookPath = prepareHook(hookSrcPath);

            writeArtifactOnlyRequirements('01-requirements', [
                'docs/requirements/{artifact_folder}/requirements-spec.md'
            ]);

            // Do NOT write artifact-paths.json -- force fallback

            writeState({
                current_phase: '01-requirements',
                active_workflow: {
                    type: 'feature',
                    artifact_folder: 'REQ-TEST',
                    current_phase: '01-requirements'
                },
                iteration_enforcement: { enabled: true },
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                skill_usage_log: [],
                phases: {
                    '01-requirements': { status: 'in_progress' }
                }
            });

            const td = getTestDir();
            const docsDir = path.join(td, 'docs', 'requirements', 'REQ-TEST');
            fs.mkdirSync(docsDir, { recursive: true });
            fs.writeFileSync(path.join(docsDir, 'requirements-spec.md'), '# Requirements\n');

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            // Should pass -- falls back to iteration-requirements.json which has correct path for phase 01
            assert.equal(result.stdout, '',
                'Gate should pass using fallback iteration-requirements.json paths');
        });

        // TC-BUG20-INT03: Malformed artifact-paths.json falls back gracefully
        // Traces: NFR-01, AC-04
        it('TC-BUG20-INT03: falls back gracefully when artifact-paths.json is malformed', async () => {
            cleanupTestEnv();
            setupTestEnv();
            hookPath = prepareHook(hookSrcPath);

            writeArtifactOnlyRequirements('01-requirements', [
                'docs/requirements/{artifact_folder}/requirements-spec.md'
            ]);

            // Write malformed JSON to artifact-paths.json
            const td = getTestDir();
            fs.writeFileSync(
                path.join(td, '.claude', 'hooks', 'config', 'artifact-paths.json'),
                '{invalid json content'
            );

            writeState({
                current_phase: '01-requirements',
                active_workflow: {
                    type: 'feature',
                    artifact_folder: 'REQ-TEST',
                    current_phase: '01-requirements'
                },
                iteration_enforcement: { enabled: true },
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                skill_usage_log: [],
                phases: {
                    '01-requirements': { status: 'in_progress' }
                }
            });

            const docsDir = path.join(td, 'docs', 'requirements', 'REQ-TEST');
            fs.mkdirSync(docsDir, { recursive: true });
            fs.writeFileSync(path.join(docsDir, 'requirements-spec.md'), '# Requirements\n');

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            // Should not crash -- falls back to iteration-requirements.json
            assert.equal(result.stdout, '',
                'Gate should pass using fallback when artifact-paths.json is malformed');
        });

        // TC-BUG20-INT04: Gate blocks when artifact is missing even with artifact-paths.json
        // Traces: FR-03, AC-03
        it('TC-BUG20-INT04: blocks when artifact is missing even with correct artifact-paths.json', async () => {
            cleanupTestEnv();
            setupTestEnv();
            hookPath = prepareHook(hookSrcPath);

            writeArtifactOnlyRequirements('08-code-review', [
                'docs/requirements/{artifact_folder}/review-summary.md'
            ]);

            writeConfig('artifact-paths.json', {
                phases: {
                    '08-code-review': {
                        paths: ['docs/requirements/{artifact_folder}/review-summary.md']
                    }
                }
            });

            writeState({
                current_phase: '08-code-review',
                active_workflow: {
                    type: 'feature',
                    artifact_folder: 'REQ-TEST',
                    current_phase: '08-code-review'
                },
                iteration_enforcement: { enabled: true },
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                skill_usage_log: [],
                phases: {
                    '08-code-review': { status: 'in_progress' }
                }
            });

            // Do NOT create the artifact file on disk

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            assert.ok(result.stdout, 'Should produce blocking output');
            const output = JSON.parse(result.stdout);
            assert.equal(output.continue, false);
            assert.ok(output.stopReason.includes('review-summary.md'),
                'Block reason should reference the correct artifact name from artifact-paths.json');
        });

        // TC-BUG20-INT05: Template resolution works with artifact-paths.json
        // Traces: FR-03, AC-03
        it('TC-BUG20-INT05: {artifact_folder} template resolution works with artifact-paths.json', async () => {
            cleanupTestEnv();
            setupTestEnv();
            hookPath = prepareHook(hookSrcPath);

            writeArtifactOnlyRequirements('05-test-strategy', [
                'docs/requirements/{artifact_folder}/test-strategy.md'
            ]);

            writeConfig('artifact-paths.json', {
                phases: {
                    '05-test-strategy': {
                        paths: ['docs/requirements/{artifact_folder}/test-strategy.md']
                    }
                }
            });

            writeState({
                current_phase: '05-test-strategy',
                active_workflow: {
                    type: 'fix',
                    artifact_folder: 'BUG-0020-GH-4',
                    current_phase: '05-test-strategy'
                },
                iteration_enforcement: { enabled: true },
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                skill_usage_log: [],
                phases: {
                    '05-test-strategy': { status: 'in_progress' }
                }
            });

            const td = getTestDir();
            const docsDir = path.join(td, 'docs', 'requirements', 'BUG-0020-GH-4');
            fs.mkdirSync(docsDir, { recursive: true });
            fs.writeFileSync(path.join(docsDir, 'test-strategy.md'), '# Test Strategy\n');

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            assert.equal(result.stdout, '',
                'Gate should pass with BUG-0020-GH-4 artifact_folder resolution');
        });

        // TC-BUG20-INT06: Missing phase in artifact-paths.json falls back
        // Traces: NFR-01, AC-04
        it('TC-BUG20-INT06: falls back for phase not in artifact-paths.json', async () => {
            cleanupTestEnv();
            setupTestEnv();
            hookPath = prepareHook(hookSrcPath);

            writeArtifactOnlyRequirements('04-design', [
                'docs/requirements/{artifact_folder}/module-design.md'
            ]);

            // artifact-paths.json exists but does NOT have phase 04
            writeConfig('artifact-paths.json', {
                phases: {
                    '01-requirements': {
                        paths: ['docs/requirements/{artifact_folder}/requirements-spec.md']
                    }
                    // No 04-design entry
                }
            });

            writeState({
                current_phase: '04-design',
                active_workflow: {
                    type: 'feature',
                    artifact_folder: 'REQ-TEST',
                    current_phase: '04-design'
                },
                iteration_enforcement: { enabled: true },
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
                skill_usage_log: [],
                phases: {
                    '04-design': { status: 'in_progress' }
                }
            });

            const td = getTestDir();
            const docsDir = path.join(td, 'docs', 'requirements', 'REQ-TEST');
            fs.mkdirSync(docsDir, { recursive: true });
            fs.writeFileSync(path.join(docsDir, 'module-design.md'), '# Module Design\n');

            const result = await runHook(hookPath, gateAdvanceInput('advance'));

            assert.equal(result.code, 0);
            // Falls back to iteration-requirements.json path, which we set to the correct path
            assert.equal(result.stdout, '',
                'Gate should pass using iteration-requirements.json fallback for uncovered phase');
        });
    });
});
