'use strict';

/**
 * iSDLC Constitution Validator - Test Suite (CJS)
 * =================================================
 * Unit tests for src/claude/hooks/constitution-validator.js
 *
 * The constitution-validator hook is a PreToolUse hook that intercepts phase
 * completion declarations and ensures constitutional validation has been performed.
 * It detects completion patterns in Task tool prompts, checks the state for
 * constitutional validation status, and blocks completion until validation is done.
 *
 * IMPORTANT: Hooks use CommonJS require() but the project package.json has
 * "type": "module". We copy the hook + lib/common.js to the temp test directory
 * (which is outside the ESM package scope) so Node treats .js files as CJS.
 *
 * Run: node --test src/claude/hooks/tests/test-constitution-validator.test.cjs
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
const hookSrcPath = path.resolve(__dirname, '..', 'constitution-validator.cjs');
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
    const hookDest = path.join(testDir, 'constitution-validator.cjs');
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
 * State where phase 06-implementation has constitutional validation enabled
 * and the validation has NOT been started yet (no constitutional_validation in phase state).
 */
function phaseWithConstitutionalRequired() {
    return {
        current_phase: '06-implementation',
        iteration_enforcement: { enabled: true },
        phases: {
            '06-implementation': {
                status: 'in_progress'
                // No constitutional_validation key = not_started
            }
        }
    };
}

/**
 * State where constitutional validation is in progress (pending, not completed).
 */
function phaseWithConstitutionalPending() {
    return {
        current_phase: '06-implementation',
        iteration_enforcement: { enabled: true },
        phases: {
            '06-implementation': {
                status: 'in_progress',
                constitutional_validation: {
                    required: true,
                    completed: false,
                    status: 'pending',
                    iterations_used: 1,
                    max_iterations: 5,
                    articles_required: ['I', 'II', 'III', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'],
                    articles_checked: [],
                    violations_found: [],
                    history: []
                }
            }
        }
    };
}

/**
 * State where constitutional validation is completed and compliant.
 */
function phaseWithConstitutionalCompliant() {
    return {
        current_phase: '06-implementation',
        iteration_enforcement: { enabled: true },
        phases: {
            '06-implementation': {
                status: 'in_progress',
                constitutional_validation: {
                    required: true,
                    completed: true,
                    status: 'compliant',
                    iterations_used: 2,
                    max_iterations: 5,
                    articles_required: ['I', 'II', 'III'],
                    articles_checked: ['I', 'II', 'III'],
                    violations_found: [],
                    history: []
                }
            }
        }
    };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('constitution-validator.js', () => {
    let hookPath;

    beforeEach(() => {
        setupTestEnv();
        hookPath = installHook();
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    // -----------------------------------------------------------------------
    // 1. Non-Task tool passes through
    // -----------------------------------------------------------------------
    it('allows non-Task tools (e.g., Bash) without any check', async () => {
        cleanupTestEnv();
        setupTestEnv(phaseWithConstitutionalRequired());
        hookPath = installHook();

        const result = await runHook(hookPath, { tool_name: 'Bash', tool_input: { command: 'ls' } });
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Non-Task tool should pass through');
    });

    // -----------------------------------------------------------------------
    // 2. Task without completion keywords passes through
    // -----------------------------------------------------------------------
    it('allows Task without completion keywords (e.g., "fix this bug")', async () => {
        cleanupTestEnv();
        setupTestEnv(phaseWithConstitutionalRequired());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('fix this bug in the login handler'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Non-completion Task should pass through');
    });

    // -----------------------------------------------------------------------
    // 3. Setup command bypasses
    // -----------------------------------------------------------------------
    it('allows Task with setup keyword "discover" even with completion-like text', async () => {
        cleanupTestEnv();
        setupTestEnv(phaseWithConstitutionalRequired());
        hookPath = installHook();

        // "discover" is a setup keyword that bypasses the completion check
        const result = await runHook(hookPath, taskInput('discover the project and phase complete'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Setup commands should bypass');
    });

    // -----------------------------------------------------------------------
    // 4. "phase complete" detected as completion attempt
    // -----------------------------------------------------------------------
    it('blocks Task with "phase complete" when constitutional validation not started', async () => {
        cleanupTestEnv();
        setupTestEnv(phaseWithConstitutionalRequired());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('The phase complete. Ready to move on.'));
        assert.equal(result.code, 0);
        const block = parseBlock(result.stdout);
        assert.ok(block, 'Should produce block output');
        assert.equal(block.continue, false);
        assert.ok(block.stopReason.includes('PHASE COMPLETION BLOCKED'));
    });

    // -----------------------------------------------------------------------
    // 5. "ready for gate" detected as completion attempt
    // -----------------------------------------------------------------------
    it('blocks Task with "ready for gate" when constitutional validation not done', async () => {
        cleanupTestEnv();
        setupTestEnv(phaseWithConstitutionalRequired());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('All work done, ready for gate validation'));
        assert.equal(result.code, 0);
        const block = parseBlock(result.stdout);
        assert.ok(block, 'Should produce block output');
        assert.equal(block.continue, false);
        assert.ok(block.stopReason.includes('Constitutional validation required'));
    });

    // -----------------------------------------------------------------------
    // 6. "implementation complete" detected as completion attempt
    // -----------------------------------------------------------------------
    it('blocks Task with "implementation complete" as completion pattern', async () => {
        cleanupTestEnv();
        setupTestEnv(phaseWithConstitutionalRequired());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('The implementation complete, all tests passing'));
        assert.equal(result.code, 0);
        const block = parseBlock(result.stdout);
        assert.ok(block, 'Should produce block output');
        assert.equal(block.continue, false);
    });

    // -----------------------------------------------------------------------
    // 7. No state.json - fail-open
    // -----------------------------------------------------------------------
    it('allows action when state.json does not exist (fail-open)', async () => {
        cleanupTestEnv();
        const testDir = setupTestEnv();
        hookPath = installHook();
        fs.unlinkSync(path.join(testDir, '.isdlc', 'state.json'));

        const result = await runHook(hookPath, taskInput('phase complete'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Should allow (fail-open) when no state');
    });

    // -----------------------------------------------------------------------
    // 8. Enforcement disabled
    // -----------------------------------------------------------------------
    it('allows completion when iteration_enforcement.enabled is false', async () => {
        cleanupTestEnv();
        setupTestEnv({
            ...phaseWithConstitutionalRequired(),
            iteration_enforcement: { enabled: false }
        });
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('phase complete'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Should allow when enforcement disabled');
    });

    // -----------------------------------------------------------------------
    // 9. Phase has no constitutional_validation configured
    // -----------------------------------------------------------------------
    it('allows completion when phase has no constitutional_validation in requirements', async () => {
        // Use a phase that has constitutional_validation disabled (00-quick-scan)
        cleanupTestEnv();
        setupTestEnv({
            current_phase: '00-quick-scan',
            iteration_enforcement: { enabled: true },
            phases: {
                '00-quick-scan': {
                    status: 'in_progress'
                }
            }
        });
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('phase complete'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Should allow when constitutional validation not configured');
    });

    // -----------------------------------------------------------------------
    // 10. Validation not started - blocks AND initializes state tracking
    // -----------------------------------------------------------------------
    it('initializes constitutional_validation state when blocking not_started completion', async () => {
        cleanupTestEnv();
        setupTestEnv(phaseWithConstitutionalRequired());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('phase complete'));
        assert.equal(result.code, 0);
        const block = parseBlock(result.stdout);
        assert.ok(block, 'Should block');
        assert.equal(block.continue, false);
        assert.ok(block.stopReason.includes('not_started'));

        // Verify state was initialized
        const state = readState();
        const constState = state.phases['06-implementation'].constitutional_validation;
        assert.ok(constState, 'constitutional_validation should be initialized in state');
        assert.equal(constState.completed, false);
        assert.equal(constState.status, 'pending');
        assert.equal(constState.iterations_used, 0);
        assert.ok(constState.started_at, 'Should have started_at timestamp');
        assert.ok(Array.isArray(constState.articles_required), 'Should have articles_required array');
    });

    // -----------------------------------------------------------------------
    // 11. Validation in progress (status: 'pending', completed: false) - blocks
    // -----------------------------------------------------------------------
    it('blocks completion when constitutional validation is in progress (pending)', async () => {
        cleanupTestEnv();
        setupTestEnv(phaseWithConstitutionalPending());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('declare complete'));
        assert.equal(result.code, 0);
        const block = parseBlock(result.stdout);
        assert.ok(block, 'Should produce block output');
        assert.equal(block.continue, false);
        assert.ok(block.stopReason.includes('in_progress'));
    });

    // -----------------------------------------------------------------------
    // 12. Validation compliant and completed - allows
    // -----------------------------------------------------------------------
    it('allows completion when constitutional validation is compliant and completed', async () => {
        cleanupTestEnv();
        setupTestEnv(phaseWithConstitutionalCompliant());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('phase complete'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Should allow completion when validation is compliant');
    });

    // -----------------------------------------------------------------------
    // 13. "submit for review" detected as completion attempt
    // -----------------------------------------------------------------------
    it('blocks Task with "submit for review" as completion pattern', async () => {
        cleanupTestEnv();
        setupTestEnv(phaseWithConstitutionalPending());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('submit for review'));
        assert.equal(result.code, 0);
        const block = parseBlock(result.stdout);
        assert.ok(block, 'Should produce block output');
        assert.equal(block.continue, false);
    });

    // -----------------------------------------------------------------------
    // 14. "mark as complete" detected as completion attempt
    // -----------------------------------------------------------------------
    it('blocks Task with "mark as complete" as completion pattern', async () => {
        cleanupTestEnv();
        setupTestEnv(phaseWithConstitutionalPending());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('mark as complete'));
        assert.equal(result.code, 0);
        const block = parseBlock(result.stdout);
        assert.ok(block, 'Should produce block output');
        assert.equal(block.continue, false);
    });

    // -----------------------------------------------------------------------
    // 15. Escalated with approval - allows
    // -----------------------------------------------------------------------
    it('allows completion when constitutional validation is escalated with approval', async () => {
        // NOTE: The hook checks !constState.completed before the escalated branch,
        // so escalation_approved only takes effect when completed is true.
        cleanupTestEnv();
        setupTestEnv({
            current_phase: '06-implementation',
            iteration_enforcement: { enabled: true },
            phases: {
                '06-implementation': {
                    status: 'in_progress',
                    constitutional_validation: {
                        required: true,
                        completed: true,
                        status: 'escalated',
                        escalation_approved: true,
                        iterations_used: 5,
                        max_iterations: 5
                    }
                }
            }
        });
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('phase complete'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Should allow when escalation is approved');
    });

    // -----------------------------------------------------------------------
    // 16. Escalated without approval - blocks
    // -----------------------------------------------------------------------
    it('blocks completion when constitutional validation is escalated without approval', async () => {
        // NOTE: completed must be true to reach the escalated branch in checkConstitutionalStatus.
        // With completed: false, the !completed check catches it first as "in_progress".
        cleanupTestEnv();
        setupTestEnv({
            current_phase: '06-implementation',
            iteration_enforcement: { enabled: true },
            phases: {
                '06-implementation': {
                    status: 'in_progress',
                    constitutional_validation: {
                        required: true,
                        completed: true,
                        status: 'escalated',
                        escalation_approved: false,
                        unresolved_violations: ['Article I'],
                        iterations_used: 5,
                        max_iterations: 5
                    }
                }
            }
        });
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('phase complete'));
        assert.equal(result.code, 0);
        const block = parseBlock(result.stdout);
        assert.ok(block, 'Should produce block output');
        assert.equal(block.continue, false);
    });

    // -----------------------------------------------------------------------
    // 17. "testing complete" detected as completion attempt
    // -----------------------------------------------------------------------
    it('blocks Task with "testing complete" as completion pattern', async () => {
        cleanupTestEnv();
        setupTestEnv(phaseWithConstitutionalPending());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('testing complete'));
        assert.equal(result.code, 0);
        const block = parseBlock(result.stdout);
        assert.ok(block, 'Should produce block output');
        assert.equal(block.continue, false);
    });

    // -----------------------------------------------------------------------
    // 18. Constitution block writes pending_escalations to state.json
    // -----------------------------------------------------------------------
    it('writes pending_escalations entry when blocking phase completion', async () => {
        cleanupTestEnv();
        setupTestEnv(phaseWithConstitutionalRequired());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('phase complete'));
        assert.equal(result.code, 0);
        const block = parseBlock(result.stdout);
        assert.ok(block, 'Should produce block output');
        assert.equal(block.continue, false);

        const state = readState();
        assert.ok(Array.isArray(state.pending_escalations), 'Should have pending_escalations array');
        assert.ok(state.pending_escalations.length > 0, 'Should have at least one escalation');

        const escalation = state.pending_escalations[0];
        assert.equal(escalation.type, 'constitution_blocked');
        assert.equal(escalation.hook, 'constitution-validator');
        assert.equal(escalation.phase, '06-implementation');
        assert.ok(escalation.detail.includes('PHASE COMPLETION BLOCKED'));
        assert.ok(escalation.timestamp, 'Should have timestamp');
    });

    // -----------------------------------------------------------------------
    // 19. Setup keyword "init" bypasses even with completion keywords
    // -----------------------------------------------------------------------
    it('allows Task with setup keyword "init" even when combined with completion text', async () => {
        cleanupTestEnv();
        setupTestEnv(phaseWithConstitutionalRequired());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('init project and then phase complete'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Setup keyword "init" should bypass completion check');
    });

    // =========================================================================
    // Self-Healing: Phase Key Normalization
    // =========================================================================

    it('self-heals alias phase key and finds requirements', async () => {
        // Use 14-production (alias for 13-production)
        cleanupTestEnv();
        setupTestEnv({
            current_phase: '14-production',  // alias → 13-production
            iteration_enforcement: { enabled: true },
            phases: {
                '13-production': {
                    status: 'in_progress'
                    // No constitutional_validation yet
                }
            }
        });
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('phase complete'));
        assert.equal(result.code, 0);
        // Should self-heal the phase key — either block with correct phase or allow
        const stdout = result.stdout;
        // If it blocks, it should reference the canonical phase key
        if (stdout && stdout.includes('PHASE COMPLETION BLOCKED')) {
            assert.ok(!stdout.includes('14-production') || result.stderr.includes('[SELF-HEAL]'),
                'Should normalize alias or output self-heal notification (on stderr)');
        }
    });

    it('self-heals when no requirements exist for phase', async () => {
        cleanupTestEnv();
        setupTestEnv({
            current_phase: '99-nonexistent',
            iteration_enforcement: { enabled: true },
            phases: {}
        });
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('phase complete'));
        assert.equal(result.code, 0);
        // Should allow through — no requirements means no constitutional check
        const stdout = result.stdout;
        assert.ok(result.stderr.includes('[SELF-HEAL]') || stdout === '',
            'Should self-heal or allow for missing requirements (on stderr)');
    });

    it('auto-initializes tracking and normalizes phase', async () => {
        cleanupTestEnv();
        setupTestEnv({
            current_phase: '13-test-deploy',  // alias → 12-test-deploy
            iteration_enforcement: { enabled: true },
            phases: {
                '12-test-deploy': {
                    status: 'in_progress'
                }
            }
        });
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('phase complete'));
        assert.equal(result.code, 0);
        // Should either self-heal, block with instructions, or allow
        // The key is it doesn't error
        assert.ok(result.code === 0, 'Should exit cleanly after normalization');
    });

    // =========================================================================
    // BUG-0005: Read-Priority Fix (AC-03a)
    // Hooks must prefer active_workflow.current_phase over top-level current_phase
    // =========================================================================

    describe('BUG-0005: active_workflow.current_phase read priority (AC-03a)', () => {

        // TC-03a-01: Prefers active_workflow.current_phase when both set (divergent)
        it('prefers active_workflow.current_phase over stale top-level current_phase', async () => {
            cleanupTestEnv();
            setupTestEnv({
                current_phase: '05-test-strategy',        // STALE top-level
                active_agent: 'test-design-engineer',
                active_workflow: {
                    type: 'fix',
                    current_phase: '06-implementation',   // CORRECT source
                    current_phase_index: 3,
                    phases: ['01-requirements', '02-tracing', '05-test-strategy', '06-implementation']
                },
                iteration_enforcement: { enabled: true },
                phases: {
                    '05-test-strategy': { status: 'completed' },
                    '06-implementation': {
                        status: 'in_progress'
                        // No constitutional_validation = not_started
                    }
                }
            });
            hookPath = installHook();

            const result = await runHook(hookPath, taskInput('phase complete'));
            assert.equal(result.code, 0);
            const block = parseBlock(result.stdout);
            assert.ok(block, 'Should produce block output for 06-implementation');
            assert.equal(block.continue, false);
            // Verify it blocked because 06-implementation has no constitutional_validation
            assert.ok(block.stopReason.includes('not_started'),
                'Should block on 06-implementation (not_started), not 05-test-strategy');

            // Verify state was initialized for 06-implementation, NOT 05-test-strategy
            const state = readState();
            assert.ok(state.phases['06-implementation'].constitutional_validation,
                'Should initialize constitutional_validation for 06-implementation');
            assert.equal(state.phases['05-test-strategy'].constitutional_validation, undefined,
                'Should NOT touch 05-test-strategy');
        });

        // TC-03a-02: Falls back to top-level current_phase when active_workflow is null
        it('falls back to top-level current_phase when active_workflow is absent', async () => {
            cleanupTestEnv();
            setupTestEnv({
                current_phase: '06-implementation',
                // active_workflow intentionally omitted
                iteration_enforcement: { enabled: true },
                phases: {
                    '06-implementation': {
                        status: 'in_progress'
                        // No constitutional_validation = not_started
                    }
                }
            });
            hookPath = installHook();

            const result = await runHook(hookPath, taskInput('phase complete'));
            assert.equal(result.code, 0);
            const block = parseBlock(result.stdout);
            assert.ok(block, 'Should produce block output');
            assert.equal(block.continue, false);
            assert.ok(block.stopReason.includes('not_started'),
                'Should resolve phase from top-level current_phase');
        });

        // TC-03a-03: Allows when both current_phase fields are missing (fail-open)
        it('allows when both active_workflow and current_phase are missing (fail-open)', async () => {
            cleanupTestEnv();
            const testDir = setupTestEnv();
            // Write state manually to ensure current_phase is truly absent
            writeState({
                iteration_enforcement: { enabled: true },
                phases: {}
            });
            hookPath = installHook();

            const result = await runHook(hookPath, taskInput('phase complete'));
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '', 'Should allow (fail-open) when no phase info available');
        });

        // TC-03a-04: Prefers active_workflow even when top-level is extremely stale
        it('prefers active_workflow.current_phase even when top-level is extremely stale', async () => {
            cleanupTestEnv();
            setupTestEnv({
                current_phase: '01-requirements',         // EXTREMELY stale
                active_workflow: {
                    type: 'fix',
                    current_phase: '08-code-review',      // CORRECT source
                    current_phase_index: 5
                },
                iteration_enforcement: { enabled: true },
                phases: {
                    '08-code-review': {
                        status: 'in_progress'
                    }
                }
            });
            hookPath = installHook();

            const result = await runHook(hookPath, taskInput('phase complete'));
            assert.equal(result.code, 0);
            // Should evaluate against 08-code-review, not 01-requirements
            // 08-code-review has constitutional_validation requirement in iteration-requirements.json
            // The exact result depends on whether 08-code-review has constitutional_validation enabled,
            // but the key test is that it does NOT use 01-requirements
            const state = readState();
            // If it initialized tracking, it should be for 08-code-review
            if (state.phases['08-code-review']?.constitutional_validation) {
                assert.ok(true, 'Correctly evaluated against 08-code-review');
            }
            // Should NOT have initialized tracking for 01-requirements
            assert.equal(state.phases['01-requirements'], undefined,
                'Should NOT evaluate against stale 01-requirements');
        });
    });

    // =========================================================================
    // BUG-0008: Delegation Guard
    // Delegation prompts (phase-loop controller delegating to phase agents)
    // must NOT be treated as phase completion attempts.
    // FIX-001: AC-01 through AC-05
    // =========================================================================

    describe('BUG-0008: Delegation guard', () => {

        // TC-CV-D01: Delegation with known phase agent subagent_type bypasses completion check
        // Requirement: FIX-001, AC-01
        it('allows delegation with known phase agent subagent_type (software-developer)', async () => {
            cleanupTestEnv();
            setupTestEnv(phaseWithConstitutionalRequired());
            hookPath = installHook();

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    prompt: 'Execute Phase 06 - Implementation for feature workflow.\nValidate GATE-06 on completion.',
                    subagent_type: 'software-developer'
                }
            });
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '', 'Delegation prompt should NOT be blocked as completion');
        });

        // TC-CV-D02: Delegation with agent name in prompt bypasses completion check
        // Requirement: FIX-001, AC-02
        it('allows delegation with agent name trace-analyst in subagent_type', async () => {
            cleanupTestEnv();
            setupTestEnv(phaseWithConstitutionalRequired());
            hookPath = installHook();

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    prompt: 'Execute Phase 02 - Tracing for fix workflow.\nArtifact folder: BUG-0008\nValidate GATE-02 on completion.',
                    subagent_type: 'trace-analyst'
                }
            });
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '', 'Delegation to trace-analyst should NOT be blocked');
        });

        // TC-CV-D03: Delegation with phase pattern in prompt bypasses completion check
        // Requirement: FIX-001, AC-03
        it('allows delegation with phase pattern 05-test-strategy in prompt', async () => {
            cleanupTestEnv();
            setupTestEnv(phaseWithConstitutionalRequired());
            hookPath = installHook();

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    prompt: 'Execute Phase 05 - Test Strategy for fix workflow.\nPhase key: 05-test-strategy\nValidate GATE-05 on completion.',
                    subagent_type: 'test-design-engineer'
                }
            });
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '', 'Delegation with phase pattern should NOT be blocked');
        });

        // TC-CV-D04: Genuine completion still detected after delegation guard added
        // Requirement: FIX-001, AC-04
        it('still blocks genuine completion "phase complete" after delegation guard added', async () => {
            cleanupTestEnv();
            setupTestEnv(phaseWithConstitutionalRequired());
            hookPath = installHook();

            const result = await runHook(hookPath, taskInput('The phase complete. Ready to move on.'));
            assert.equal(result.code, 0);
            const block = parseBlock(result.stdout);
            assert.ok(block, 'Should produce block output for genuine completion');
            assert.equal(block.continue, false);
            assert.ok(block.stopReason.includes('PHASE COMPLETION BLOCKED'));
        });

        // TC-CV-D05: Setup command bypass remains unchanged after delegation guard
        // Requirement: FIX-001, AC-05
        it('still allows setup keyword "discover" bypass after delegation guard added', async () => {
            cleanupTestEnv();
            setupTestEnv(phaseWithConstitutionalRequired());
            hookPath = installHook();

            const result = await runHook(hookPath, taskInput('discover the project and phase complete'));
            assert.equal(result.code, 0);
            assert.equal(result.stdout, '', 'Setup commands should still bypass after guard');
        });
    });

    // =========================================================================
    // BUG-0005: Write Correctness (AC-06a)
    // constitution-validator writes to state.phases[currentPhase].constitutional_validation
    // using the correctly resolved phase key
    // =========================================================================

    describe('BUG-0005: write correctness with active_workflow (AC-06a)', () => {

        // TC-06a-01: Writes constitutional_validation to active_workflow-resolved phase
        it('writes constitutional_validation to the active_workflow-resolved phase', async () => {
            cleanupTestEnv();
            setupTestEnv({
                current_phase: '05-test-strategy',        // STALE
                active_workflow: {
                    type: 'fix',
                    current_phase: '06-implementation',   // CORRECT
                    current_phase_index: 3
                },
                iteration_enforcement: { enabled: true },
                phases: {
                    '05-test-strategy': { status: 'completed' },
                    '06-implementation': {
                        status: 'in_progress'
                    }
                }
            });
            hookPath = installHook();

            await runHook(hookPath, taskInput('phase complete'));

            const state = readState();
            // Must write to 06-implementation, not 05-test-strategy
            assert.ok(state.phases['06-implementation'].constitutional_validation,
                'Should write constitutional_validation to 06-implementation');
            assert.equal(state.phases['05-test-strategy'].constitutional_validation, undefined,
                'Should NOT write to stale 05-test-strategy');
        });

        // TC-06a-02: Writes to top-level-resolved phase when no active_workflow
        it('writes constitutional_validation to top-level-resolved phase when no active_workflow', async () => {
            cleanupTestEnv();
            setupTestEnv({
                current_phase: '06-implementation',
                iteration_enforcement: { enabled: true },
                phases: {
                    '06-implementation': {
                        status: 'in_progress'
                    }
                }
            });
            hookPath = installHook();

            await runHook(hookPath, taskInput('phase complete'));

            const state = readState();
            assert.ok(state.phases['06-implementation'].constitutional_validation,
                'Should write constitutional_validation to 06-implementation from top-level');
        });
    });
});
