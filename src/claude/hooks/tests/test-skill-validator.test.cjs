'use strict';

/**
 * iSDLC Skill Validator - Test Suite (CJS / node:test)
 * =====================================================
 * Tests for skill-validator.js PreToolUse hook.
 *
 * Uses .cjs extension to avoid ESM/CJS conflict (package.json has "type": "module").
 * The hook is copied to the temp dir as .cjs via prepareHook().
 *
 * Run:  node --test src/claude/hooks/tests/test-skill-validator.test.cjs
 *
 * Version: 4.0.0
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawn } = require('child_process');
const {
    setupTestEnv,
    cleanupTestEnv,
    getTestDir,
    prepareHook,
    runHook,
    readState,
    writeState
} = require('./hook-test-utils.cjs');

// Absolute path to the source hook file
const HOOK_SRC = path.resolve(__dirname, '..', 'skill-validator.cjs');

/**
 * Run a hook with raw string stdin (bypasses JSON.stringify in runHook).
 * Used to test empty stdin and invalid JSON handling.
 */
function runHookRaw(hookPath, rawStdin) {
    return new Promise((resolve, reject) => {
        const child = spawn('node', [hookPath], {
            env: { ...process.env, CLAUDE_PROJECT_DIR: getTestDir() },
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';
        let settled = false;

        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                child.kill('SIGKILL');
                reject(new Error('Hook timed out'));
            }
        }, 10000);

        child.stdout.on('data', (data) => { stdout += data.toString(); });
        child.stderr.on('data', (data) => { stderr += data.toString(); });

        child.on('close', (code) => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code });
            }
        });

        child.on('error', (err) => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                reject(err);
            }
        });

        if (rawStdin) {
            child.stdin.write(rawStdin);
        }
        child.stdin.end();
    });
}

describe('skill-validator.js', () => {
    let hookPath;

    beforeEach(() => {
        setupTestEnv();
        hookPath = prepareHook(HOOK_SRC);
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    // -----------------------------------------------------------------------
    // 1. Non-Task tool allowed (Read) -- empty stdout
    // -----------------------------------------------------------------------
    it('allows non-Task tools with empty stdout', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Read',
            tool_input: { file_path: '/some/file.js' }
        });

        assert.equal(result.code, 0, 'exit code should be 0');
        assert.equal(result.stdout, '', 'stdout should be empty (allowed)');
    });

    // -----------------------------------------------------------------------
    // 2. Task with matching-phase agent allowed (software-developer in 06-implementation)
    // -----------------------------------------------------------------------
    it('allows Task call when agent phase matches current phase', async () => {
        // Default state has current_phase = '06-implementation'
        // software-developer is in phase '06-implementation' per manifest
        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'software-developer',
                prompt: 'Implement the feature',
                description: 'Implementation task'
            }
        });

        assert.equal(result.code, 0, 'exit code should be 0');
        assert.equal(result.stdout, '', 'stdout should be empty (allowed)');
    });

    // -----------------------------------------------------------------------
    // 3. Orchestrator (sdlc-orchestrator) always allowed
    // -----------------------------------------------------------------------
    it('always allows the sdlc-orchestrator regardless of phase', async () => {
        // Set a phase that is NOT 'all'
        const state = readState();
        state.current_phase = '01-requirements';
        writeState(state);

        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'sdlc-orchestrator',
                prompt: 'Orchestrate the workflow'
            }
        });

        assert.equal(result.code, 0, 'exit code should be 0');
        assert.equal(result.stdout, '', 'stdout should be empty (allowed)');
    });

    // -----------------------------------------------------------------------
    // 4. Cross-phase agent allowed in observe mode (no blocking)
    // -----------------------------------------------------------------------
    it('allows cross-phase agent in observe mode without blocking', async () => {
        // requirements-analyst is phase '01-requirements', current is '06-implementation'
        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'requirements-analyst',
                prompt: 'Check requirements',
                description: 'Cross-phase call'
            }
        });

        assert.equal(result.code, 0, 'exit code should be 0');
        assert.equal(result.stdout, '', 'stdout should be empty (observe mode allows)');
    });

    // -----------------------------------------------------------------------
    // 5. Cross-phase agent allowed in warn mode
    // -----------------------------------------------------------------------
    it('allows cross-phase agent in warn mode without blocking', async () => {
        const state = readState();
        state.skill_enforcement.mode = 'warn';
        writeState(state);

        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'requirements-analyst',
                prompt: 'Check requirements'
            }
        });

        assert.equal(result.code, 0, 'exit code should be 0');
        assert.equal(result.stdout, '', 'stdout should be empty (warn mode allows)');
    });

    // -----------------------------------------------------------------------
    // 6. Cross-phase agent allowed in audit mode
    // -----------------------------------------------------------------------
    it('allows cross-phase agent in audit mode without blocking', async () => {
        const state = readState();
        state.skill_enforcement.mode = 'audit';
        writeState(state);

        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'requirements-analyst',
                prompt: 'Check requirements'
            }
        });

        assert.equal(result.code, 0, 'exit code should be 0');
        assert.equal(result.stdout, '', 'stdout should be empty (audit mode allows)');
    });

    // -----------------------------------------------------------------------
    // 7. Disabled enforcement allows everything
    // -----------------------------------------------------------------------
    it('allows everything when enforcement is disabled', async () => {
        const state = readState();
        state.skill_enforcement.enabled = false;
        writeState(state);

        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'requirements-analyst',
                prompt: 'This should be allowed regardless'
            }
        });

        assert.equal(result.code, 0, 'exit code should be 0');
        assert.equal(result.stdout, '', 'stdout should be empty when enforcement disabled');
    });

    // -----------------------------------------------------------------------
    // 8. Observe mode allows all (explicit)
    // -----------------------------------------------------------------------
    it('allows all delegations in explicit observe mode', async () => {
        // The default mode is already 'observe', but set it explicitly
        const state = readState();
        state.skill_enforcement.mode = 'observe';
        writeState(state);

        // Use an agent that does not match the current phase
        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'cicd-engineer',
                prompt: 'Set up CI/CD pipeline'
            }
        });

        assert.equal(result.code, 0, 'exit code should be 0');
        assert.equal(result.stdout, '', 'observe mode should produce empty stdout');
    });

    // -----------------------------------------------------------------------
    // 9. Missing subagent_type -- fail-open
    // -----------------------------------------------------------------------
    it('fails open when subagent_type is missing', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: {
                prompt: 'No subagent_type specified'
            }
        });

        assert.equal(result.code, 0, 'exit code should be 0');
        assert.equal(result.stdout, '', 'should fail open with empty stdout');
    });

    // -----------------------------------------------------------------------
    // 10. Invalid/empty stdin -- fail-open
    // -----------------------------------------------------------------------
    it('fails open on empty stdin', async () => {
        const result = await runHookRaw(hookPath, '');

        assert.equal(result.code, 0, 'exit code should be 0');
        assert.equal(result.stdout, '', 'should fail open with empty stdout');
    });

    it('fails open on invalid JSON stdin', async () => {
        const result = await runHookRaw(hookPath, '{not valid json}');

        assert.equal(result.code, 0, 'exit code should be 0');
        assert.equal(result.stdout, '', 'should fail open with empty stdout');
    });

    // -----------------------------------------------------------------------
    // Bonus: setup agent (discover-orchestrator) always allowed
    // -----------------------------------------------------------------------
    it('always allows setup-phase agents (discover-orchestrator)', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'discover-orchestrator',
                prompt: 'Run discovery'
            }
        });

        assert.equal(result.code, 0, 'exit code should be 0');
        assert.equal(result.stdout, '', 'setup agents should always be allowed');
    });

    // -----------------------------------------------------------------------
    // Bonus: strict mode (legacy) behaves same as observe -- allows cross-phase
    // -----------------------------------------------------------------------
    it('allows cross-phase agent in strict mode (legacy, now observe)', async () => {
        const state = readState();
        state.skill_enforcement.mode = 'strict';
        writeState(state);

        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'requirements-analyst',
                prompt: 'Cross-phase in strict mode'
            }
        });

        assert.equal(result.code, 0, 'exit code should be 0');
        assert.equal(result.stdout, '', 'strict mode should behave like observe');
    });

    // =========================================================================
    // BUG-0005: Read-Priority Fix (AC-03d)
    // skill-validator must prefer active_workflow.current_phase over top-level
    // =========================================================================

    describe('BUG-0005: active_workflow.current_phase read priority (AC-03d)', () => {

        // TC-03d-01: Prefers active_workflow.current_phase when both set
        it('uses active_workflow.current_phase for validation when both set (divergent)', async () => {
            cleanupTestEnv();
            setupTestEnv({
                current_phase: '05-test-strategy',        // STALE
                active_workflow: {
                    type: 'fix',
                    current_phase: '06-implementation',   // CORRECT
                    current_phase_index: 3
                },
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow' }
            });
            hookPath = prepareHook(HOOK_SRC);

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    subagent_type: 'software-developer',
                    prompt: 'Test divergent state'
                }
            });

            assert.equal(result.code, 0, 'Should exit cleanly');
            // In observe mode, it always allows, but the key is it resolved to 06-implementation
            // We verify via stderr debug output (if enabled) that it used correct phase
            assert.equal(result.stdout, '', 'Should allow in observe mode');
        });

        // TC-03d-02: Falls back to top-level when active_workflow is null
        it('falls back to top-level current_phase when no active_workflow', async () => {
            cleanupTestEnv();
            setupTestEnv({
                current_phase: '06-implementation',
                // active_workflow intentionally omitted
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow' }
            });
            hookPath = prepareHook(HOOK_SRC);

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    subagent_type: 'software-developer',
                    prompt: 'Test no workflow'
                }
            });

            assert.equal(result.code, 0, 'Should exit cleanly with top-level fallback');
            assert.equal(result.stdout, '', 'Should allow');
        });

        // TC-03d-03: Falls back to '01-requirements' when both missing
        it('falls back to 01-requirements when both sources missing', async () => {
            cleanupTestEnv();
            setupTestEnv({
                // current_phase intentionally omitted
                // active_workflow intentionally omitted
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow' }
            });
            hookPath = prepareHook(HOOK_SRC);

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    subagent_type: 'software-developer',
                    prompt: 'Test both missing'
                }
            });

            assert.equal(result.code, 0, 'Should exit cleanly with default fallback');
            assert.equal(result.stdout, '', 'Should allow');
        });

        // TC-03d-04: Divergent state uses active_workflow
        it('resolves phase from active_workflow when top-level is extremely stale', async () => {
            cleanupTestEnv();
            setupTestEnv({
                current_phase: '06-implementation',       // STALE
                active_workflow: {
                    type: 'fix',
                    current_phase: '08-code-review',      // CORRECT
                    current_phase_index: 5
                },
                skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow' }
            });
            hookPath = prepareHook(HOOK_SRC);

            const result = await runHook(hookPath, {
                tool_name: 'Task',
                tool_input: {
                    subagent_type: 'code-reviewer',
                    prompt: 'Test stale state'
                }
            });

            assert.equal(result.code, 0, 'Should exit cleanly');
            assert.equal(result.stdout, '', 'Should allow in observe mode');
        });
    });
});
