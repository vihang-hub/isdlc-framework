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
    // 18. Setup keyword "init" bypasses even with completion keywords
    // -----------------------------------------------------------------------
    it('allows Task with setup keyword "init" even when combined with completion text', async () => {
        cleanupTestEnv();
        setupTestEnv(phaseWithConstitutionalRequired());
        hookPath = installHook();

        const result = await runHook(hookPath, taskInput('init project and then phase complete'));
        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Setup keyword "init" should bypass completion check');
    });
});
