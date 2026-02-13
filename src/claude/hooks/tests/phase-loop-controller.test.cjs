/**
 * Tests for phase-loop-controller.cjs hook
 * Traces to: FR-01, AC-01, AC-01a-c, NFR-01
 *
 * BUG-0013 additions (T13-T23): Same-phase bypass, cross-phase regression,
 * null safety, and observability tests.
 *
 * T1, T2, T12 updated to use cross-phase scenarios so they remain valid
 * regression tests after the same-phase bypass fix. Previously these used
 * same-phase setups (currentPhase === targetPhase) which would change
 * behavior after the fix.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const HOOK_PATH = path.join(__dirname, '..', 'phase-loop-controller.cjs');

function setupTestEnv() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-loop-test-'));
    const isdlcDir = path.join(tmpDir, '.isdlc');
    fs.mkdirSync(isdlcDir, { recursive: true });
    return tmpDir;
}

function writeState(tmpDir, state) {
    fs.writeFileSync(
        path.join(tmpDir, '.isdlc', 'state.json'),
        JSON.stringify(state, null, 2)
    );
}

function runHook(tmpDir, stdinJson) {
    const stdinStr = typeof stdinJson === 'string'
        ? stdinJson
        : JSON.stringify(stdinJson);
    try {
        const result = execSync(
            `echo '${stdinStr.replace(/'/g, "\\'")}' | node "${HOOK_PATH}"`,
            {
                cwd: tmpDir,
                env: {
                    ...process.env,
                    CLAUDE_PROJECT_DIR: tmpDir,
                    SKILL_VALIDATOR_DEBUG: '0'
                },
                encoding: 'utf8',
                timeout: 5000
            }
        );
        return { stdout: result.trim(), exitCode: 0 };
    } catch (e) {
        return {
            stdout: (e.stdout || '').trim(),
            stderr: (e.stderr || '').trim(),
            exitCode: e.status || 1
        };
    }
}

function makeDelegationStdin(prompt) {
    return {
        tool_name: 'Task',
        tool_input: {
            subagent_type: '',
            prompt: prompt || 'delegate to 06-implementation agent'
        }
    };
}

/**
 * Helper: create a cross-phase delegation scenario.
 * currentPhase is different from the phase resolved by the prompt.
 * prompt resolves to 06-implementation; currentPhase is set to something else.
 */
function makeCrossPhaseStdin() {
    return {
        tool_name: 'Task',
        tool_input: {
            subagent_type: '',
            prompt: 'delegate to 06-implementation agent'
        }
    };
}

/**
 * Helper: create a same-phase delegation scenario.
 * The prompt resolves to the given phase via phase pattern matching.
 */
function makeSamePhaseStdin(phase) {
    return {
        tool_name: 'Task',
        tool_input: {
            subagent_type: '',
            prompt: `delegate to ${phase} sub-agent`
        }
    };
}

describe('phase-loop-controller hook', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = setupTestEnv();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // =========================================================================
    // Original tests (T1-T12) -- T1, T2, T12 updated for cross-phase scenarios
    // =========================================================================

    // T1: Blocks cross-phase delegation when target phase status not set
    // (Updated: currentPhase=05-test-strategy, targetPhase=06-implementation)
    it('blocks cross-phase delegation when phase status is not set', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '05-test-strategy' },
            phases: {}
        });
        const result = runHook(tmpDir, makeCrossPhaseStdin());
        assert.equal(result.exitCode, 0);
        assert.ok(result.stdout.length > 0, 'Should produce block output');
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.continue, false);
        assert.ok(parsed.stopReason.includes('PHASE DELEGATION WITHOUT PROGRESS TRACKING'));
    });

    // T2: Blocks cross-phase delegation when current phase status is 'pending'
    // (Updated: currentPhase=05-test-strategy with status pending, targetPhase=06-implementation)
    // Note: The hook checks state.phases[currentPhase].status, not targetPhase status.
    it('blocks cross-phase delegation when current phase status is pending', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '05-test-strategy' },
            phases: { '05-test-strategy': { status: 'pending' } }
        });
        const result = runHook(tmpDir, makeCrossPhaseStdin());
        assert.equal(result.exitCode, 0);
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.continue, false);
    });

    // T3: Allows when phase status is in_progress
    it('allows when phase status is in_progress', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' },
            phases: { '06-implementation': { status: 'in_progress' } }
        });
        const result = runHook(tmpDir, makeDelegationStdin());
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T4: Allows when phase status is completed
    it('allows when phase status is completed', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' },
            phases: { '06-implementation': { status: 'completed' } }
        });
        const result = runHook(tmpDir, makeDelegationStdin());
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T5: Allows non-delegation Task calls
    it('allows non-delegation Task calls', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' },
            phases: {}
        });
        const result = runHook(tmpDir, {
            tool_name: 'Task',
            tool_input: { subagent_type: '', prompt: 'do general work' }
        });
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T6: Allows non-Task tool calls
    it('allows non-Task tool calls', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' },
            phases: {}
        });
        const result = runHook(tmpDir, {
            tool_name: 'Bash',
            tool_input: { command: 'ls' }
        });
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T7: Allows when no active_workflow
    it('allows when no active_workflow', () => {
        writeState(tmpDir, {});
        const result = runHook(tmpDir, makeDelegationStdin());
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T8: Allows setup commands (discover in prompt)
    it('allows setup commands in prompt', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' },
            phases: {}
        });
        const result = runHook(tmpDir, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'discover-orchestrator',
                prompt: 'discover the project'
            }
        });
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T9: Fail-open on missing state.json
    it('fail-open on missing state.json', () => {
        fs.rmSync(path.join(tmpDir, '.isdlc', 'state.json'), { force: true });
        const result = runHook(tmpDir, makeDelegationStdin());
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T10: Fail-open on empty stdin
    it('fail-open on empty stdin', () => {
        const result = runHook(tmpDir, '');
        assert.equal(result.exitCode, 0);
    });

    // T11: Fail-open on invalid JSON
    it('fail-open on invalid JSON stdin', () => {
        const result = runHook(tmpDir, 'not json');
        assert.equal(result.exitCode, 0);
    });

    // T12: Block message includes agent and phase info (cross-phase scenario)
    // (Updated: currentPhase=05-test-strategy, targetPhase=06-implementation)
    it('block message includes phase info', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '05-test-strategy' },
            phases: {}
        });
        const result = runHook(tmpDir, makeCrossPhaseStdin());
        const parsed = JSON.parse(result.stdout);
        assert.ok(parsed.stopReason.includes('06-implementation'));
        assert.ok(parsed.stopReason.includes('not set'));
    });

    // =========================================================================
    // BUG-0013: Same-phase bypass tests (T13-T16)
    // TDD RED: These WILL FAIL until the fix is implemented in Phase 06.
    // Traces to: FR-01 (AC-01, AC-02, AC-03, AC-04)
    // =========================================================================

    // T13: Same-phase delegation allowed when status is pending
    // The core bug scenario: sub-agent within active phase should NOT be blocked.
    it('allows same-phase delegation when phase status is pending', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' },
            phases: { '06-implementation': { status: 'pending' } }
        });
        // Prompt resolves to 06-implementation (same as currentPhase)
        const result = runHook(tmpDir, makeSamePhaseStdin('06-implementation'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Same-phase delegation should be allowed (no block output)');
    });

    // T14: Same-phase delegation allowed when phase entry missing entirely
    it('allows same-phase delegation when phase status not set', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '02-tracing' },
            phases: {} // No entry for 02-tracing at all
        });
        // Prompt resolves to 02-tracing (same as currentPhase)
        const result = runHook(tmpDir, makeSamePhaseStdin('02-tracing'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Same-phase delegation should be allowed even if phase entry missing');
    });

    // T15: Same-phase delegation allowed using the standard delegation prompt
    it('allows same-phase delegation with standard delegation prompt', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' },
            phases: { '06-implementation': { status: 'pending' } }
        });
        // makeDelegationStdin() resolves to 06-implementation (same as currentPhase)
        const result = runHook(tmpDir, makeDelegationStdin());
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Same-phase delegation with standard prompt should be allowed');
    });

    // T16: Same-phase delegation allowed regardless of arbitrary status value
    it('allows same-phase delegation regardless of phase status value', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' },
            phases: { '06-implementation': { status: 'some_unknown_status' } }
        });
        const result = runHook(tmpDir, makeSamePhaseStdin('06-implementation'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Same-phase bypass should not depend on status value');
    });

    // =========================================================================
    // BUG-0013: Cross-phase delegation regression tests (T17-T19)
    // TDD GREEN: These should PASS both before and after the fix.
    // Traces to: FR-02 (AC-05, AC-06, AC-07)
    // =========================================================================

    // T17: Cross-phase delegation blocked when current phase status is pending
    // Note: The hook checks state.phases[currentPhase].status (not targetPhase).
    // For cross-phase to block, currentPhase status must be neither in_progress nor completed.
    it('blocks cross-phase delegation when current phase status is pending', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '05-test-strategy' },
            phases: {
                '05-test-strategy': { status: 'pending' }
            }
        });
        // Prompt resolves to 06-implementation, but currentPhase is 05-test-strategy
        const result = runHook(tmpDir, makeCrossPhaseStdin());
        assert.equal(result.exitCode, 0);
        assert.ok(result.stdout.length > 0, 'Cross-phase with pending currentPhase should block');
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.continue, false);
        assert.ok(parsed.stopReason.includes('PHASE DELEGATION WITHOUT PROGRESS TRACKING'));
    });

    // T18: Cross-phase delegation allowed when current phase status is in_progress
    // Note: Hook checks state.phases[currentPhase].status. If in_progress, all delegations are allowed.
    it('allows cross-phase delegation when current phase status is in_progress', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '05-test-strategy' },
            phases: {
                '05-test-strategy': { status: 'in_progress' }
            }
        });
        const result = runHook(tmpDir, makeCrossPhaseStdin());
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T19: Cross-phase delegation allowed when current phase status is completed
    it('allows cross-phase delegation when current phase status is completed', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '05-test-strategy' },
            phases: {
                '05-test-strategy': { status: 'completed' }
            }
        });
        const result = runHook(tmpDir, makeCrossPhaseStdin());
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // =========================================================================
    // BUG-0013: Null safety tests (T20-T22)
    // TDD GREEN: These should PASS both before and after the fix.
    // Traces to: FR-03 (AC-08, AC-09, AC-10)
    // =========================================================================

    // T20: Non-delegation Task call (targetPhase is null) does not trigger bypass
    it('non-delegation Task call does not trigger same-phase bypass', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' },
            phases: { '06-implementation': { status: 'pending' } }
        });
        // "do general work" does not resolve to any phase
        const result = runHook(tmpDir, {
            tool_name: 'Task',
            tool_input: { subagent_type: '', prompt: 'do general work with no phase reference' }
        });
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Non-delegation call should be allowed via isDelegation:false path');
    });

    // T21: Null current_phase does not trigger same-phase bypass
    it('null current_phase does not trigger same-phase bypass', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: null },
            phases: {}
        });
        const result = runHook(tmpDir, makeDelegationStdin());
        assert.equal(result.exitCode, 0);
        // null currentPhase guard at line 61-63 fires first, returning allow
        assert.equal(result.stdout, '');
    });

    // T22: Missing current_phase field does not trigger same-phase bypass
    it('missing current_phase field does not trigger same-phase bypass', () => {
        writeState(tmpDir, {
            active_workflow: {},
            phases: {}
        });
        const result = runHook(tmpDir, makeDelegationStdin());
        assert.equal(result.exitCode, 0);
        // undefined currentPhase is falsy, guard at line 61-63 fires first
        assert.equal(result.stdout, '');
    });

    // =========================================================================
    // BUG-0013: Observability test (T23)
    // TDD RED: Will FAIL until the fix adds logHookEvent for same-phase bypass.
    // Traces to: FR-04 (AC-11, AC-12)
    // =========================================================================

    // T23: Same-phase bypass logs event to hook-activity.log
    it('same-phase bypass logs hook event', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' },
            phases: { '06-implementation': { status: 'pending' } }
        });
        const result = runHook(tmpDir, makeSamePhaseStdin('06-implementation'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Same-phase should be allowed');

        // Check hook-activity.log for the same-phase-bypass entry
        const logPath = path.join(tmpDir, '.isdlc', 'hook-activity.log');
        if (fs.existsSync(logPath)) {
            const logContent = fs.readFileSync(logPath, 'utf8');
            assert.ok(
                logContent.includes('same-phase-bypass'),
                'Hook activity log should contain same-phase-bypass event'
            );
        } else {
            // If same-phase bypass is not implemented, the hook blocks and no log is written
            // This assertion will fail, correctly establishing the RED baseline
            assert.fail('hook-activity.log not found -- same-phase bypass not implemented');
        }
    });
});
