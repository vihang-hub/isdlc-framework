'use strict';

/**
 * iSDLC Skill Delegation Enforcer - Test Suite (CJS / node:test)
 * ================================================================
 * Tests for skill-delegation-enforcer.js PostToolUse[Skill] hook.
 *
 * Run:  node --test src/claude/hooks/tests/test-skill-delegation-enforcer.test.cjs
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
    readState
} = require('./hook-test-utils.cjs');

const HOOK_SRC = path.resolve(__dirname, '..', 'skill-delegation-enforcer.cjs');

describe('skill-delegation-enforcer.js', () => {
    let hookPath;

    beforeEach(() => {
        setupTestEnv();
        hookPath = prepareHook(HOOK_SRC);
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it('outputs mandatory delegation context when skill is sdlc', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Skill',
            tool_input: { skill: 'sdlc', args: 'feature "Build auth"' }
        });

        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('MANDATORY DELEGATION REQUIRED'));
        assert.ok(result.stdout.includes('sdlc-orchestrator'));
        assert.ok(result.stdout.includes('Task tool'));
    });

    it('outputs mandatory delegation context when skill is discover', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Skill',
            tool_input: { skill: 'discover', args: '--existing' }
        });

        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('MANDATORY DELEGATION REQUIRED'));
        assert.ok(result.stdout.includes('discover-orchestrator'));
    });

    it('handles skill name with leading slash', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Skill',
            tool_input: { skill: '/sdlc', args: 'fix "Login bug"' }
        });

        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('MANDATORY DELEGATION REQUIRED'));
        assert.ok(result.stdout.includes('sdlc-orchestrator'));
    });

    it('exits silently for other skills like provider', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Skill',
            tool_input: { skill: 'provider', args: 'list' }
        });

        assert.equal(result.code, 0);
        assert.equal(result.stdout, '');
    });

    it('exits silently for non-Skill tool calls', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: { subagent_type: 'sdlc-orchestrator', prompt: 'test' }
        });

        assert.equal(result.code, 0);
        assert.equal(result.stdout, '');
    });

    it('writes pending_delegation marker to state.json', async () => {
        await runHook(hookPath, {
            tool_name: 'Skill',
            tool_input: { skill: 'sdlc', args: 'feature "Build auth"' }
        });

        const state = readState();
        assert.ok(state.pending_delegation);
        assert.equal(state.pending_delegation.skill, 'sdlc');
        assert.equal(state.pending_delegation.required_agent, 'sdlc-orchestrator');
        assert.ok(state.pending_delegation.invoked_at);
        assert.equal(state.pending_delegation.args, 'feature "Build auth"');
    });

    it('writes pending_delegation with discover agent for discover skill', async () => {
        await runHook(hookPath, {
            tool_name: 'Skill',
            tool_input: { skill: 'discover', args: '' }
        });

        const state = readState();
        assert.ok(state.pending_delegation);
        assert.equal(state.pending_delegation.skill, 'discover');
        assert.equal(state.pending_delegation.required_agent, 'discover-orchestrator');
    });

    it('exits silently when state.json does not exist (fail-open)', async () => {
        // Remove state.json
        const fs = require('fs');
        const { getTestDir } = require('./hook-test-utils.cjs');
        fs.unlinkSync(path.join(getTestDir(), '.isdlc', 'state.json'));

        const result = await runHook(hookPath, {
            tool_name: 'Skill',
            tool_input: { skill: 'sdlc', args: 'feature "test"' }
        });

        assert.equal(result.code, 0);
        // No output since state doesn't exist
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

    it('includes "Do NOT enter plan mode" in the enforcement message', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Skill',
            tool_input: { skill: 'sdlc', args: 'feature "test"' }
        });

        assert.ok(result.stdout.includes('Do NOT enter plan mode'));
        assert.ok(result.stdout.includes('Do NOT implement the request directly'));
    });
});
