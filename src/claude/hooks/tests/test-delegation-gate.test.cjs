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
            skill: 'sdlc',
            required_agent: 'sdlc-orchestrator',
            invoked_at: '2026-02-08T10:00:00Z',
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
        assert.ok(output.reason.includes('Task tool'));
    });

    it('allows when pending_delegation exists AND matching delegation found', async () => {
        const state = readState();
        state.pending_delegation = {
            skill: 'sdlc',
            required_agent: 'sdlc-orchestrator',
            invoked_at: '2026-02-08T10:00:00Z',
            args: 'feature "test"'
        };
        state.skill_usage_log = [
            {
                timestamp: '2026-02-08T10:00:05Z',
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
            skill: 'sdlc',
            required_agent: 'sdlc-orchestrator',
            invoked_at: '2026-02-08T10:00:00Z',
            args: 'feature "test"'
        };
        state.skill_usage_log = [
            {
                timestamp: '2026-02-08T10:00:05Z',
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
            invoked_at: '2026-02-08T10:00:00Z',
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
            invoked_at: '2026-02-08T10:00:00Z',
            args: '--existing'
        };
        state.skill_usage_log = [
            {
                timestamp: '2026-02-08T10:00:05Z',
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
            skill: 'sdlc',
            required_agent: 'sdlc-orchestrator',
            invoked_at: '2026-02-08T10:00:00Z',
            args: 'feature "test"'
        };
        // This entry is from BEFORE the pending delegation
        state.skill_usage_log = [
            {
                timestamp: '2026-02-08T09:00:00Z',
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
            skill: 'sdlc',
            required_agent: 'sdlc-orchestrator',
            invoked_at: '2026-02-08T10:00:00Z',
            args: 'feature "test"'
        };
        // Delegated to discover-orchestrator instead of sdlc-orchestrator
        state.skill_usage_log = [
            {
                timestamp: '2026-02-08T10:00:05Z',
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
});
