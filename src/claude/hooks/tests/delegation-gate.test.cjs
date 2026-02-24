'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
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

const HOOK_PATH = path.resolve(__dirname, '..', 'delegation-gate.cjs');

describe('delegation-gate (Stop hook)', () => {
    let hookPath;

    before(() => {
        setupTestEnv();
        hookPath = prepareHook(HOOK_PATH);
    });

    after(() => {
        cleanupTestEnv();
    });

    // Helper to write a pending_delegation marker into state.json
    function writePendingDelegation(marker) {
        const state = readState();
        state.pending_delegation = marker;
        writeState(state);
    }

    // Helper to clear pending_delegation
    function clearPendingDelegation() {
        const state = readState();
        state.pending_delegation = null;
        writeState(state);
    }

    // Standard Stop hook input (minimal)
    const stopInput = { tool_name: 'Stop', tool_input: {} };

    describe('no pending delegation', () => {
        beforeEach(() => {
            clearPendingDelegation();
        });

        it('should pass through when no pending_delegation exists', async () => {
            const result = await runHook(hookPath, stopInput);
            assert.equal(result.code, 0);
            assert.equal(result.stdout.trim(), '');
        });
    });

    describe('staleness check (GH-62)', () => {
        it('should auto-clear a marker older than 30 minutes', async () => {
            const staleTime = new Date(Date.now() - 45 * 60 * 1000).toISOString();
            writePendingDelegation({
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: staleTime,
                args: 'build "something"'
            });

            const result = await runHook(hookPath, stopInput);
            assert.equal(result.code, 0);
            // Should NOT block
            if (result.stdout.trim()) {
                const output = JSON.parse(result.stdout.trim());
                assert.notEqual(output.decision, 'block',
                    'Stale marker (45m) should not block');
            }

            // Marker should be cleared
            const state = readState();
            assert.equal(state.pending_delegation, null,
                'Stale marker should be cleared from state');
        });

        it('should auto-clear a marker exactly at the threshold boundary', async () => {
            const staleTime = new Date(Date.now() - 31 * 60 * 1000).toISOString();
            writePendingDelegation({
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: staleTime,
                args: 'feature "something"'
            });

            const result = await runHook(hookPath, stopInput);
            assert.equal(result.code, 0);
            if (result.stdout.trim()) {
                const output = JSON.parse(result.stdout.trim());
                assert.notEqual(output.decision, 'block',
                    'Marker at 31m should be auto-cleared');
            }

            const state = readState();
            assert.equal(state.pending_delegation, null);
        });

        it('should still block a fresh marker when delegation is missing', async () => {
            const freshTime = new Date(Date.now() - 2 * 60 * 1000).toISOString();
            writePendingDelegation({
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: freshTime,
                args: 'build "something"'
            });

            const result = await runHook(hookPath, stopInput);
            assert.equal(result.code, 0);
            assert.ok(result.stdout.trim(), 'Should produce output for fresh marker');
            const output = JSON.parse(result.stdout.trim());
            assert.equal(output.decision, 'block',
                'Fresh marker (2m) with no delegation should block');
        });

        it('should handle missing invoked_at gracefully (no staleness check)', async () => {
            writePendingDelegation({
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                args: 'build "something"'
                // No invoked_at
            });

            const result = await runHook(hookPath, stopInput);
            assert.equal(result.code, 0);
            // Should fall through to normal block (no delegation found)
            assert.ok(result.stdout.trim());
            const output = JSON.parse(result.stdout.trim());
            assert.equal(output.decision, 'block',
                'Missing invoked_at should fall through to normal enforcement');
        });
    });

    describe('exempt actions (BUG-0021)', () => {
        beforeEach(() => {
            clearPendingDelegation();
        });

        it('should auto-clear a marker for the "add" action', async () => {
            writePendingDelegation({
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: new Date().toISOString(),
                args: 'add "some item"'
            });

            const result = await runHook(hookPath, stopInput);
            assert.equal(result.code, 0);
            if (result.stdout.trim()) {
                const output = JSON.parse(result.stdout.trim());
                assert.notEqual(output.decision, 'block',
                    'add action should be exempt');
            }

            const state = readState();
            assert.equal(state.pending_delegation, null);
        });

        it('should auto-clear a marker for the "analyze" action', async () => {
            writePendingDelegation({
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: new Date().toISOString(),
                args: 'analyze "some item"'
            });

            const result = await runHook(hookPath, stopInput);
            assert.equal(result.code, 0);
            if (result.stdout.trim()) {
                const output = JSON.parse(result.stdout.trim());
                assert.notEqual(output.decision, 'block',
                    'analyze action should be exempt');
            }

            const state = readState();
            assert.equal(state.pending_delegation, null);
        });
    });

    describe('delegation found', () => {
        it('should pass when delegation is found in skill_usage_log', async () => {
            const now = new Date();
            const invokedAt = new Date(now.getTime() - 5000).toISOString();
            const delegatedAt = new Date(now.getTime() - 2000).toISOString();

            writePendingDelegation({
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: invokedAt,
                args: 'feature "something"'
            });

            const state = readState();
            state.skill_usage_log = [{
                agent: 'sdlc-orchestrator',
                timestamp: delegatedAt,
                skill: 'ORCH-001'
            }];
            writeState(state);

            const result = await runHook(hookPath, stopInput);
            assert.equal(result.code, 0);
            if (result.stdout.trim()) {
                const output = JSON.parse(result.stdout.trim());
                assert.notEqual(output.decision, 'block',
                    'Should pass when delegation found in log');
            }
        });

        it('should pass when workflow has progressed past phase 01', async () => {
            writePendingDelegation({
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: new Date().toISOString(),
                args: 'feature "something"'
            });

            const state = readState();
            state.active_workflow = { current_phase_index: 2 };
            writeState(state);

            const result = await runHook(hookPath, stopInput);
            assert.equal(result.code, 0);
            if (result.stdout.trim()) {
                const output = JSON.parse(result.stdout.trim());
                assert.notEqual(output.decision, 'block',
                    'Should pass when workflow advanced past phase 01');
            }
        });

        it('should pass when a phase is in_progress', async () => {
            writePendingDelegation({
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: new Date().toISOString(),
                args: 'feature "something"'
            });

            const state = readState();
            state.active_workflow = {
                current_phase: '01-requirements',
                current_phase_index: 0
            };
            state.phases = {
                '01-requirements': { status: 'in_progress' }
            };
            writeState(state);

            const result = await runHook(hookPath, stopInput);
            assert.equal(result.code, 0);
            if (result.stdout.trim()) {
                const output = JSON.parse(result.stdout.trim());
                assert.notEqual(output.decision, 'block',
                    'Should pass when phase is in_progress');
            }
        });
    });

    describe('empty/malformed input', () => {
        beforeEach(() => {
            clearPendingDelegation();
        });

        it('should pass through on empty input', async () => {
            writePendingDelegation({
                skill: 'isdlc',
                required_agent: 'sdlc-orchestrator',
                invoked_at: new Date().toISOString(),
                args: 'build "something"'
            });

            const result = await runHook(hookPath, '');
            assert.equal(result.code, 0);
            assert.equal(result.stdout.trim(), '');
        });
    });
});
