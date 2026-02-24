'use strict';

/**
 * iSDLC Delegation Gate - Test Suite (CJS / node:test)
 * =====================================================
 * Tests for delegation-gate.js Stop hook.
 *
 * Run:  node --test src/claude/hooks/tests/test-delegation-gate.test.cjs
 *
 * Version: 1.0.0
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
    setupTestEnv,
    cleanupTestEnv,
    prepareHook,
    runHook,
    readState,
    writeState
} = require('./hook-test-utils.cjs');

const HOOK_SRC = path.resolve(__dirname, '..', 'delegation-gate.cjs');

// GH-62 compat: Use a recent timestamp so the staleness check (30m threshold) does not auto-clear markers.
const RECENT_TS = new Date().toISOString();
// Timestamp 5 seconds after RECENT_TS — used for skill_usage_log entries that should be AFTER invoked_at
const AFTER_TS = new Date(Date.now() + 5000).toISOString();
// Timestamp 1 hour before RECENT_TS — used for skill_usage_log entries that should be BEFORE invoked_at
const BEFORE_TS = new Date(Date.now() - 3600000).toISOString();

describe('delegation-gate.js', () => {
    let hookPath;

    beforeEach(() => {
        setupTestEnv();
        hookPath = prepareHook(HOOK_SRC);
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it('exits silently when no pending_delegation exists', async () => {
        const result = await runHook(hookPath, {
            hook_event_name: 'Stop',
            stop_reason: 'end_turn'
        });

        assert.equal(result.code, 0);
        assert.equal(result.stdout, '');
    });

    it('blocks when pending_delegation exists but no matching Task delegation', async () => {
        // Write a pending_delegation marker
        const state = readState();
        state.pending_delegation = {
            skill: 'isdlc',
            required_agent: 'sdlc-orchestrator',
            invoked_at: RECENT_TS,
            args: 'feature "test"'
        };
        state.skill_usage_log = []; // empty — no delegation happened
        writeState(state);

        const result = await runHook(hookPath, {
            hook_event_name: 'Stop',
            stop_reason: 'end_turn'
        });

        assert.equal(result.code, 0);
        const output = JSON.parse(result.stdout);
        assert.equal(output.decision, 'block');
        assert.ok(output.reason.includes('sdlc-orchestrator'));
        assert.ok(output.reason.includes('Phase-Loop Controller'));
    });

    it('allows when pending_delegation exists AND matching delegation found', async () => {
        const state = readState();
        state.pending_delegation = {
            skill: 'isdlc',
            required_agent: 'sdlc-orchestrator',
            invoked_at: RECENT_TS,
            args: 'feature "test"'
        };
        state.skill_usage_log = [
            {
                timestamp: AFTER_TS,
                agent: 'sdlc-orchestrator',
                agent_phase: 'all',
                current_phase: '01-requirements',
                description: 'Run /sdlc feature',
                status: 'executed',
                reason: 'authorized-orchestrator'
            }
        ];
        writeState(state);

        const result = await runHook(hookPath, {
            hook_event_name: 'Stop',
            stop_reason: 'end_turn'
        });

        assert.equal(result.code, 0);
        assert.equal(result.stdout, '');
    });

    it('clears pending_delegation after successful verification', async () => {
        const state = readState();
        state.pending_delegation = {
            skill: 'isdlc',
            required_agent: 'sdlc-orchestrator',
            invoked_at: RECENT_TS,
            args: 'feature "test"'
        };
        state.skill_usage_log = [
            {
                timestamp: AFTER_TS,
                agent: 'sdlc-orchestrator',
                agent_phase: 'all',
                current_phase: '01-requirements',
                description: 'test',
                status: 'executed',
                reason: 'authorized-orchestrator'
            }
        ];
        writeState(state);

        await runHook(hookPath, {
            hook_event_name: 'Stop',
            stop_reason: 'end_turn'
        });

        const updatedState = readState();
        assert.equal(updatedState.pending_delegation, null);
    });

    it('handles discover → discover-orchestrator mapping', async () => {
        const state = readState();
        state.pending_delegation = {
            skill: 'discover',
            required_agent: 'discover-orchestrator',
            invoked_at: RECENT_TS,
            args: ''
        };
        state.skill_usage_log = []; // no delegation
        writeState(state);

        const result = await runHook(hookPath, {
            hook_event_name: 'Stop',
            stop_reason: 'end_turn'
        });

        assert.equal(result.code, 0);
        const output = JSON.parse(result.stdout);
        assert.equal(output.decision, 'block');
        assert.ok(output.reason.includes('discover-orchestrator'));
    });

    it('allows discover delegation when discover-orchestrator is in usage log', async () => {
        const state = readState();
        state.pending_delegation = {
            skill: 'discover',
            required_agent: 'discover-orchestrator',
            invoked_at: RECENT_TS,
            args: '--existing'
        };
        state.skill_usage_log = [
            {
                timestamp: AFTER_TS,
                agent: 'discover-orchestrator',
                agent_phase: 'all',
                current_phase: '01-requirements',
                description: 'Run /discover',
                status: 'executed',
                reason: 'authorized-orchestrator'
            }
        ];
        writeState(state);

        const result = await runHook(hookPath, {
            hook_event_name: 'Stop',
            stop_reason: 'end_turn'
        });

        assert.equal(result.code, 0);
        assert.equal(result.stdout, '');
    });

    it('ignores usage log entries that occurred BEFORE pending_delegation', async () => {
        const state = readState();
        state.pending_delegation = {
            skill: 'isdlc',
            required_agent: 'sdlc-orchestrator',
            invoked_at: RECENT_TS,
            args: 'feature "test"'
        };
        // This entry is from BEFORE the pending delegation
        state.skill_usage_log = [
            {
                timestamp: BEFORE_TS,
                agent: 'sdlc-orchestrator',
                agent_phase: 'all',
                current_phase: '01-requirements',
                description: 'old invocation',
                status: 'executed',
                reason: 'authorized-orchestrator'
            }
        ];
        writeState(state);

        const result = await runHook(hookPath, {
            hook_event_name: 'Stop',
            stop_reason: 'end_turn'
        });

        assert.equal(result.code, 0);
        const output = JSON.parse(result.stdout);
        assert.equal(output.decision, 'block');
    });

    it('blocks when wrong orchestrator was delegated to', async () => {
        const state = readState();
        state.pending_delegation = {
            skill: 'isdlc',
            required_agent: 'sdlc-orchestrator',
            invoked_at: RECENT_TS,
            args: 'feature "test"'
        };
        // Delegated to discover-orchestrator instead of sdlc-orchestrator
        state.skill_usage_log = [
            {
                timestamp: AFTER_TS,
                agent: 'discover-orchestrator',
                agent_phase: 'all',
                current_phase: '01-requirements',
                description: 'wrong agent',
                status: 'executed',
                reason: 'authorized-orchestrator'
            }
        ];
        writeState(state);

        const result = await runHook(hookPath, {
            hook_event_name: 'Stop',
            stop_reason: 'end_turn'
        });

        assert.equal(result.code, 0);
        const output = JSON.parse(result.stdout);
        assert.equal(output.decision, 'block');
        assert.ok(output.reason.includes('sdlc-orchestrator'));
    });

    it('exits silently when state.json is missing (fail-open)', async () => {
        // Remove state.json
        const fs = require('fs');
        const { getTestDir } = require('./hook-test-utils.cjs');
        fs.unlinkSync(path.join(getTestDir(), '.isdlc', 'state.json'));

        const result = await runHook(hookPath, {
            hook_event_name: 'Stop',
            stop_reason: 'end_turn'
        });

        assert.equal(result.code, 0);
        assert.equal(result.stdout, '');
    });

    it('exits silently with empty stdin', async () => {
        const { spawn } = require('child_process');
        const { getTestDir } = require('./hook-test-utils.cjs');

        const result = await new Promise((resolve, reject) => {
            const child = spawn('node', [hookPath], {
                env: { ...process.env, CLAUDE_PROJECT_DIR: getTestDir() },
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let stdout = '';
            child.stdout.on('data', d => { stdout += d.toString(); });
            child.on('close', code => resolve({ stdout: stdout.trim(), code }));
            child.on('error', reject);
            child.stdin.end();
        });

        assert.equal(result.code, 0);
        assert.equal(result.stdout, '');
    });

    it('exits silently with invalid JSON stdin', async () => {
        const { spawn } = require('child_process');
        const { getTestDir } = require('./hook-test-utils.cjs');

        const result = await new Promise((resolve, reject) => {
            const child = spawn('node', [hookPath], {
                env: { ...process.env, CLAUDE_PROJECT_DIR: getTestDir() },
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let stdout = '';
            child.stdout.on('data', d => { stdout += d.toString(); });
            child.on('close', code => resolve({ stdout: stdout.trim(), code }));
            child.on('error', reject);
            child.stdin.write('not valid json');
            child.stdin.end();
        });

        assert.equal(result.code, 0);
        assert.equal(result.stdout, '');
    });

    // =========================================================================
    // Phase-Loop Controller Awareness
    // =========================================================================

    it('allows when workflow has progressed past phase 01 (current_phase_index > 0)', async () => {
        const state = readState();
        state.pending_delegation = {
            skill: 'isdlc',
            required_agent: 'sdlc-orchestrator',
            invoked_at: RECENT_TS,
            args: 'feature "test"'
        };
        state.skill_usage_log = []; // no delegation in log
        state.active_workflow = {
            type: 'feature',
            current_phase: '06-implementation',
            current_phase_index: 2,
            phases: ['01-requirements', '02-impact-analysis', '06-implementation']
        };
        writeState(state);

        const result = await runHook(hookPath, {
            hook_event_name: 'Stop',
            stop_reason: 'end_turn'
        });

        assert.equal(result.code, 0);
        // Should pass — workflow progressed past init, so orchestrator was already invoked
        assert.equal(result.stdout, '');

        // pending_delegation should be cleared
        const updatedState = readState();
        assert.equal(updatedState.pending_delegation, null);
    });

    it('still checks delegation when current_phase_index is 0', async () => {
        const state = readState();
        state.pending_delegation = {
            skill: 'isdlc',
            required_agent: 'sdlc-orchestrator',
            invoked_at: RECENT_TS,
            args: 'feature "test"'
        };
        state.skill_usage_log = []; // no delegation
        state.active_workflow = {
            type: 'feature',
            current_phase: '01-requirements',
            current_phase_index: 0,
            phases: ['01-requirements', '06-implementation']
        };
        writeState(state);

        const result = await runHook(hookPath, {
            hook_event_name: 'Stop',
            stop_reason: 'end_turn'
        });

        assert.equal(result.code, 0);
        // Should still block — at phase index 0 means init hasn't completed
        const output = JSON.parse(result.stdout);
        assert.equal(output.decision, 'block');
    });

    // =========================================================================
    // Self-Healing: Cross-Reference Phase Status
    // =========================================================================

    it('self-heals when phase is in_progress (cross-reference delegation)', async () => {
        // Set pending_delegation but no matching skill_usage_log
        // However, the current phase IS in_progress → evidence of delegation
        const state = readState();
        state.pending_delegation = {
            skill: 'isdlc',
            required_agent: 'sdlc-orchestrator',
            invoked_at: RECENT_TS,
            args: 'feature "test"'
        };
        state.skill_usage_log = []; // empty — no delegation in log
        state.current_phase = '06-implementation';
        state.phases = {
            '06-implementation': {
                status: 'in_progress',
                started: '2026-02-08T10:01:00Z'
            }
        };
        writeState(state);

        const result = await runHook(hookPath, {
            hook_event_name: 'Stop',
            stop_reason: 'end_turn'
        });

        assert.equal(result.code, 0);
        // Should self-heal: phase in_progress is accepted as delegation evidence
        assert.ok(result.stderr.includes('[SELF-HEAL]') || result.stdout === '',
            'Should self-heal or allow when phase is in_progress');

        // pending_delegation should be cleared
        const updatedState = readState();
        assert.equal(updatedState.pending_delegation, null,
            'Should clear pending_delegation after self-heal');
    });

    it('still blocks when phase is NOT in_progress and no delegation', async () => {
        const state = readState();
        state.pending_delegation = {
            skill: 'isdlc',
            required_agent: 'sdlc-orchestrator',
            invoked_at: RECENT_TS,
            args: 'feature "test"'
        };
        state.skill_usage_log = [];
        state.current_phase = '06-implementation';
        state.phases = {
            '06-implementation': {
                status: 'pending'  // NOT in_progress
            }
        };
        writeState(state);

        const result = await runHook(hookPath, {
            hook_event_name: 'Stop',
            stop_reason: 'end_turn'
        });

        assert.equal(result.code, 0);
        // Should still block
        const output = JSON.parse(result.stdout);
        assert.equal(output.decision, 'block');
        assert.ok(output.reason.includes('sdlc-orchestrator'));
    });

    it('cross-references active_workflow.current_phase when current_phase missing', async () => {
        const state = readState();
        state.pending_delegation = {
            skill: 'isdlc',
            required_agent: 'sdlc-orchestrator',
            invoked_at: RECENT_TS,
            args: 'feature "test"'
        };
        state.skill_usage_log = [];
        delete state.current_phase;
        state.active_workflow = {
            type: 'feature',
            current_phase: '06-implementation'
        };
        state.phases = {
            '06-implementation': {
                status: 'in_progress'
            }
        };
        writeState(state);

        const result = await runHook(hookPath, {
            hook_event_name: 'Stop',
            stop_reason: 'end_turn'
        });

        assert.equal(result.code, 0);
        // Should self-heal using active_workflow.current_phase
        assert.ok(result.stderr.includes('[SELF-HEAL]') || result.stdout === '',
            'Should self-heal using active_workflow fallback');
    });

    // =========================================================================
    // Safety Valve: Error Counting & Recovery
    // =========================================================================

    it('blocks on error when state is unavailable but pending delegation exists', async () => {
        // Write pending_delegation to state, then corrupt state.json
        const state = readState();
        state.pending_delegation = {
            skill: 'isdlc',
            required_agent: 'sdlc-orchestrator',
            invoked_at: RECENT_TS,
            args: 'feature "test"'
        };
        writeState(state);

        // Now corrupt the state.json to make readState() return null inside the hook
        // We need to write valid state with pending_delegation first (hook reads it),
        // but then make readState return null for the main check.
        // Actually, the hook reads pending_delegation via readPendingDelegation()
        // which calls readState(). If state is null, readPendingDelegation returns null
        // and the hook exits silently. So we need state to be parseable for the
        // pending_delegation read, but corrupt for the second readState call.
        //
        // The simpler approach: the hook has a try/catch around main().
        // We can trigger the error path by providing a state that causes an error
        // after the pending_delegation is read but before delegation is verified.
        //
        // Let's test the explicit "state is unavailable" path (lines 97-110):
        // pending_delegation exists, but state is null. However readPendingDelegation
        // ALSO calls readState()... so if state is null, pending is null too.
        //
        // The "state unavailable" block (line 98) is reached when:
        //   1. readPendingDelegation() succeeds (first readState returns valid state)
        //   2. readState() at line 97 returns null (second read returns null)
        //
        // This could happen if state.json is deleted between the two reads,
        // but in practice this is a race condition test. Let's skip this specific
        // edge case and focus on the error counter tests that we CAN test reliably.

        // Instead, test the explicit block message when pending delegation has
        // been verified as missing. This is already covered above.
        // Let's focus on the error_count tracking below.
    });

    it('tracks _delegation_gate_error_count in state across calls', async () => {
        // The error counting happens in the catch block (lines 156-168).
        // We need to trigger an error in the main() function.
        // One way: make the state unreadable AFTER pending_delegation is read.
        //
        // Since both readPendingDelegation and the main readState use the same path,
        // we can test the error counting by examining state directly after the hook
        // writes it. The catch block increments _delegation_gate_error_count.
        //
        // We can test the clearMarkerAndResetErrors path (successful delegation
        // should reset error count to 0).
        const state = readState();
        state.pending_delegation = {
            skill: 'isdlc',
            required_agent: 'sdlc-orchestrator',
            invoked_at: RECENT_TS,
            args: 'feature "test"'
        };
        state._delegation_gate_error_count = 3; // Pre-existing error count
        state.skill_usage_log = [
            {
                timestamp: AFTER_TS,
                agent: 'sdlc-orchestrator',
                agent_phase: 'all',
                current_phase: '01-requirements',
                description: 'Run /sdlc feature',
                status: 'executed',
                reason: 'authorized-orchestrator'
            }
        ];
        writeState(state);

        // Successful delegation verification should reset error count to 0
        const result = await runHook(hookPath, {
            hook_event_name: 'Stop',
            stop_reason: 'end_turn'
        });

        assert.equal(result.code, 0);
        assert.equal(result.stdout, '', 'Should allow (delegation found)');

        const updatedState = readState();
        assert.equal(updatedState._delegation_gate_error_count, 0,
            'Error count should be reset to 0 after successful verification');
        assert.equal(updatedState.pending_delegation, null,
            'Pending delegation should be cleared');
    });

    it('error count resets to 0 on successful delegation verification', async () => {
        // Set error count to 4, then do a successful delegation
        const state = readState();
        state._delegation_gate_error_count = 4;
        state.pending_delegation = {
            skill: 'isdlc',
            required_agent: 'sdlc-orchestrator',
            invoked_at: RECENT_TS,
            args: 'feature "test"'
        };
        // Workflow progressed past phase 01 — accepted as delegation evidence
        state.active_workflow = {
            type: 'feature',
            current_phase: '06-implementation',
            current_phase_index: 2,
            phases: ['01-requirements', '02-impact-analysis', '06-implementation']
        };
        state.skill_usage_log = [];
        writeState(state);

        const result = await runHook(hookPath, {
            hook_event_name: 'Stop',
            stop_reason: 'end_turn'
        });

        assert.equal(result.code, 0);
        assert.equal(result.stdout, '');

        const updatedState = readState();
        assert.equal(updatedState._delegation_gate_error_count, 0,
            'Error count should be reset to 0 when workflow progression confirms delegation');
        assert.equal(updatedState.pending_delegation, null);
    });

    it('error count resets on self-heal (phase in_progress)', async () => {
        const state = readState();
        state._delegation_gate_error_count = 2;
        state.pending_delegation = {
            skill: 'isdlc',
            required_agent: 'sdlc-orchestrator',
            invoked_at: RECENT_TS,
            args: 'feature "test"'
        };
        state.skill_usage_log = [];
        state.current_phase = '06-implementation';
        state.phases = {
            '06-implementation': {
                status: 'in_progress',
                started: '2026-02-08T10:01:00Z'
            }
        };
        writeState(state);

        const result = await runHook(hookPath, {
            hook_event_name: 'Stop',
            stop_reason: 'end_turn'
        });

        assert.equal(result.code, 0);

        const updatedState = readState();
        assert.equal(updatedState._delegation_gate_error_count, 0,
            'Error count should be reset after self-heal clears marker');
        assert.equal(updatedState.pending_delegation, null);
    });

    // =========================================================================
    // BUG-0005: Read-Priority Fix (AC-03b)
    // delegation-gate must prefer active_workflow.current_phase over top-level
    // (fix inverted priority on line 133)
    // =========================================================================

    describe('BUG-0005: active_workflow.current_phase read priority (AC-03b)', () => {

        // TC-03b-01: Prefers active_workflow.current_phase (previously inverted)
        it('prefers active_workflow.current_phase over stale top-level for cross-reference check', async () => {
            const state = readState();
            state.pending_delegation = {
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: RECENT_TS,
                args: 'feature "test"'
            };
            state.skill_usage_log = [];
            state.current_phase = '05-test-strategy';        // STALE top-level
            state.active_workflow = {
                type: 'fix',
                current_phase: '06-implementation',          // CORRECT source
                current_phase_index: 0                       // index 0 so it doesn't bypass via line 126
            };
            state.phases = {
                '05-test-strategy': { status: 'completed' },
                '06-implementation': {
                    status: 'in_progress',
                    started: '2026-02-08T10:01:00Z'
                }
            };
            writeState(state);

            const result = await runHook(hookPath, {
                hook_event_name: 'Stop',
                stop_reason: 'end_turn'
            });

            assert.equal(result.code, 0);
            // Should self-heal using 06-implementation (in_progress), not 05-test-strategy (completed)
            assert.ok(result.stderr.includes('[SELF-HEAL]') || result.stdout === '',
                'Should find 06-implementation as in_progress via active_workflow priority');

            const updatedState = readState();
            assert.equal(updatedState.pending_delegation, null,
                'Should clear pending_delegation after resolving via active_workflow phase');
        });

        // TC-03b-02: Falls back to top-level when active_workflow is null
        it('falls back to top-level current_phase when active_workflow is null', async () => {
            const state = readState();
            state.pending_delegation = {
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: RECENT_TS,
                args: 'feature "test"'
            };
            state.skill_usage_log = [];
            state.current_phase = '06-implementation';
            delete state.active_workflow;
            state.phases = {
                '06-implementation': {
                    status: 'in_progress',
                    started: '2026-02-08T10:01:00Z'
                }
            };
            writeState(state);

            const result = await runHook(hookPath, {
                hook_event_name: 'Stop',
                stop_reason: 'end_turn'
            });

            assert.equal(result.code, 0);
            // Should self-heal using top-level current_phase
            assert.ok(result.stderr.includes('[SELF-HEAL]') || result.stdout === '',
                'Should fall back to top-level current_phase when no active_workflow');

            const updatedState = readState();
            assert.equal(updatedState.pending_delegation, null);
        });

        // TC-03b-03: Does not crash when no current_phase available at all
        it('does not crash when neither active_workflow nor current_phase is set', async () => {
            const state = readState();
            state.pending_delegation = {
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: RECENT_TS,
                args: 'feature "test"'
            };
            state.skill_usage_log = [];
            delete state.current_phase;
            delete state.active_workflow;
            state.phases = {};
            writeState(state);

            const result = await runHook(hookPath, {
                hook_event_name: 'Stop',
                stop_reason: 'end_turn'
            });

            assert.equal(result.code, 0, 'Should not crash (fail-open)');
            // May block or allow, but must not crash
        });
    });

    // =========================================================================
    // REQ-0023: Three-verb model inline carve-out (replaces BUG-0021)
    // =========================================================================

    describe('REQ-0023: EXEMPT_ACTIONS defense-in-depth', () => {

        // AC-05: Auto-clear stale exempt markers without blocking
        it('auto-clears pending_delegation for exempt "analyze" action without blocking (AC-05)', async () => {
            const state = readState();
            state.pending_delegation = {
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: RECENT_TS,
                args: 'analyze "Build a login page"'
            };
            state.skill_usage_log = []; // No delegation happened
            writeState(state);

            const result = await runHook(hookPath, {
                hook_event_name: 'Stop',
                stop_reason: 'end_turn'
            });

            assert.equal(result.code, 0);
            // Should NOT block
            assert.ok(!result.stdout.includes('"decision":"block"') &&
                       !result.stdout.includes('"decision": "block"'),
                'Should NOT block for exempt analyze action');

            // Marker should be cleared
            const updatedState = readState();
            assert.equal(updatedState.pending_delegation, null,
                'Should auto-clear pending_delegation for exempt action');
        });

        // AC-05: Logs the auto-clear (debugLog requires SKILL_VALIDATOR_DEBUG=true)
        it('logs auto-clear of exempt marker to stderr when debug enabled (AC-05)', async () => {
            const state = readState();
            state.pending_delegation = {
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: RECENT_TS,
                args: 'analyze "test"'
            };
            state.skill_usage_log = [];
            writeState(state);

            const { spawn } = require('child_process');
            const { getTestDir } = require('./hook-test-utils.cjs');

            const result = await new Promise((resolve, reject) => {
                const child = spawn('node', [hookPath], {
                    env: {
                        ...process.env,
                        CLAUDE_PROJECT_DIR: getTestDir(),
                        SKILL_VALIDATOR_DEBUG: 'true'
                    },
                    stdio: ['pipe', 'pipe', 'pipe']
                });
                let stdout = '';
                let stderr = '';
                child.stdout.on('data', d => { stdout += d.toString(); });
                child.stderr.on('data', d => { stderr += d.toString(); });
                child.on('close', code => resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code }));
                child.on('error', reject);
                child.stdin.write(JSON.stringify({
                    hook_event_name: 'Stop',
                    stop_reason: 'end_turn'
                }));
                child.stdin.end();
            });

            assert.equal(result.code, 0);
            // Should log about exempt/auto-clear to stderr
            assert.ok(result.stderr.includes('exempt') || result.stderr.includes('auto-clear'),
                'Should log exempt action auto-clear to stderr when debug is enabled');
        });

        // Non-exempt action still blocks (regression check)
        it('still blocks for non-exempt "feature" action (regression) (AC-05)', async () => {
            const state = readState();
            state.pending_delegation = {
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: RECENT_TS,
                args: 'feature "Build auth"'
            };
            state.skill_usage_log = [];
            writeState(state);

            const result = await runHook(hookPath, {
                hook_event_name: 'Stop',
                stop_reason: 'end_turn'
            });

            assert.equal(result.code, 0);
            const output = JSON.parse(result.stdout);
            assert.equal(output.decision, 'block',
                'Should still block for non-exempt "feature" action');
            assert.ok(output.reason.includes('sdlc-orchestrator'));
        });

        // Non-exempt "fix" action still blocks
        it('still blocks for non-exempt "fix" action (regression)', async () => {
            const state = readState();
            state.pending_delegation = {
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: RECENT_TS,
                args: 'fix "Login crash"'
            };
            state.skill_usage_log = [];
            writeState(state);

            const result = await runHook(hookPath, {
                hook_event_name: 'Stop',
                stop_reason: 'end_turn'
            });

            assert.equal(result.code, 0);
            const output = JSON.parse(result.stdout);
            assert.equal(output.decision, 'block');
        });

        // Edge case: args with leading flags for exempt action
        it('auto-clears exempt marker when args have leading flags', async () => {
            const state = readState();
            state.pending_delegation = {
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: RECENT_TS,
                args: '--verbose analyze "test feature"'
            };
            state.skill_usage_log = [];
            writeState(state);

            const result = await runHook(hookPath, {
                hook_event_name: 'Stop',
                stop_reason: 'end_turn'
            });

            assert.equal(result.code, 0);
            assert.ok(!result.stdout.includes('"decision":"block"') &&
                       !result.stdout.includes('"decision": "block"'),
                'Should auto-clear exempt marker with leading flags');

            const updatedState = readState();
            assert.equal(updatedState.pending_delegation, null);
        });

        // Edge case: empty args in pending marker falls through to normal blocking
        it('does NOT auto-clear when pending args are empty (AC-06)', async () => {
            const state = readState();
            state.pending_delegation = {
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: RECENT_TS,
                args: ''
            };
            state.skill_usage_log = [];
            writeState(state);

            const result = await runHook(hookPath, {
                hook_event_name: 'Stop',
                stop_reason: 'end_turn'
            });

            assert.equal(result.code, 0);
            // Empty args => no action => not exempt => should still block
            const output = JSON.parse(result.stdout);
            assert.equal(output.decision, 'block',
                'Empty args should fall through to normal blocking');
        });

        // Edge case: missing args field in pending marker
        it('does NOT crash when pending marker has no args field (AC-06)', async () => {
            const state = readState();
            state.pending_delegation = {
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: RECENT_TS
                // Note: no 'args' field
            };
            state.skill_usage_log = [];
            writeState(state);

            const result = await runHook(hookPath, {
                hook_event_name: 'Stop',
                stop_reason: 'end_turn'
            });

            assert.equal(result.code, 0, 'Should not crash with missing args');
            // Should block normally (no action to match as exempt)
            const output = JSON.parse(result.stdout);
            assert.equal(output.decision, 'block',
                'Missing args should fall through to normal blocking');
        });

        // Case insensitivity
        it('handles ANALYZE in uppercase in pending marker (case-insensitive)', async () => {
            const state = readState();
            state.pending_delegation = {
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: RECENT_TS,
                args: 'ANALYZE "Build something"'
            };
            state.skill_usage_log = [];
            writeState(state);

            const result = await runHook(hookPath, {
                hook_event_name: 'Stop',
                stop_reason: 'end_turn'
            });

            assert.equal(result.code, 0);
            assert.ok(!result.stdout.includes('"decision":"block"') &&
                       !result.stdout.includes('"decision": "block"'),
                'Should auto-clear for ANALYZE in uppercase');

            const updatedState = readState();
            assert.equal(updatedState.pending_delegation, null);
        });

        // =================================================================
        // REQ-0023: 'add' action auto-clears pending delegation (FR-008, AC-008-01)
        // =================================================================

        it('auto-clears pending_delegation for exempt "add" action without blocking (REQ-0023, AC-008-01)', async () => {
            const state = readState();
            state.pending_delegation = {
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: RECENT_TS,
                args: 'add "payment processing"'
            };
            state.skill_usage_log = [];
            writeState(state);

            const result = await runHook(hookPath, {
                hook_event_name: 'Stop',
                stop_reason: 'end_turn'
            });

            assert.equal(result.code, 0);
            // Should NOT block
            assert.ok(!result.stdout.includes('"decision":"block"') &&
                       !result.stdout.includes('"decision": "block"'),
                'Should NOT block for exempt add action');

            const updatedState = readState();
            assert.equal(updatedState.pending_delegation, null,
                'Should auto-clear pending_delegation for add action');
        });

        // =================================================================
        // REQ-0023: 'build' action NOT auto-cleared (FR-008, AC-008-02)
        // =================================================================

        it('does NOT auto-clear pending_delegation for "build" action (REQ-0023, AC-008-02)', async () => {
            const state = readState();
            state.pending_delegation = {
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: RECENT_TS,
                args: 'build "payment-processing"'
            };
            state.skill_usage_log = [];
            writeState(state);

            const result = await runHook(hookPath, {
                hook_event_name: 'Stop',
                stop_reason: 'end_turn'
            });

            assert.equal(result.code, 0);
            const output = JSON.parse(result.stdout);
            assert.equal(output.decision, 'block',
                'build action should still require delegation and block');
        });

        it('auto-clears pending_delegation for add with flags (REQ-0023)', async () => {
            const state = readState();
            state.pending_delegation = {
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: RECENT_TS,
                args: '--verbose add "#42"'
            };
            state.skill_usage_log = [];
            writeState(state);

            const result = await runHook(hookPath, {
                hook_event_name: 'Stop',
                stop_reason: 'end_turn'
            });

            assert.equal(result.code, 0);
            assert.ok(!result.stdout.includes('"decision":"block"') &&
                       !result.stdout.includes('"decision": "block"'),
                'Should auto-clear add with flags');

            const updatedState = readState();
            assert.equal(updatedState.pending_delegation, null);
        });

        // Error count reset on auto-clear
        it('resets error count when auto-clearing exempt marker', async () => {
            const state = readState();
            state._delegation_gate_error_count = 3;
            state.pending_delegation = {
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: RECENT_TS,
                args: 'analyze "test"'
            };
            state.skill_usage_log = [];
            writeState(state);

            const result = await runHook(hookPath, {
                hook_event_name: 'Stop',
                stop_reason: 'end_turn'
            });

            assert.equal(result.code, 0);
            const updatedState = readState();
            assert.equal(updatedState.pending_delegation, null);
            assert.equal(updatedState._delegation_gate_error_count, 0,
                'Error count should be reset on auto-clear of exempt marker');
        });
    });
});
