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

    it('outputs mandatory delegation context when skill is isdlc', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Skill',
            tool_input: { skill: 'isdlc', args: 'feature "Build auth"' }
        });

        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('MANDATORY:'));
        assert.ok(result.stdout.includes('sdlc-orchestrator'));
        assert.ok(result.stdout.includes('Phase-Loop Controller'));
    });

    it('outputs mandatory delegation context when skill is discover', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Skill',
            tool_input: { skill: 'discover', args: '--existing' }
        });

        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('MANDATORY:'));
        assert.ok(result.stdout.includes('discover-orchestrator'));
    });

    it('handles skill name with leading slash', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Skill',
            tool_input: { skill: '/isdlc', args: 'fix "Login bug"' }
        });

        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('MANDATORY:'));
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
            tool_input: { skill: 'isdlc', args: 'feature "Build auth"' }
        });

        const state = readState();
        assert.ok(state.pending_delegation);
        assert.equal(state.pending_delegation.skill, 'isdlc');
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

    it('includes "Do NOT enter plan mode" and "Do NOT write code" in the enforcement message', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Skill',
            tool_input: { skill: 'isdlc', args: 'feature "test"' }
        });

        assert.ok(result.stdout.includes('Do NOT enter plan mode'));
        assert.ok(result.stdout.includes('Do NOT implement the request directly'));
        assert.ok(result.stdout.includes('Do NOT write code yourself'));
    });

    // =========================================================================
    // REQ-0023: Three-verb model inline carve-out (replaces BUG-0021)
    // =========================================================================

    describe('REQ-0023: EXEMPT_ACTIONS for inline subcommands', () => {

        // AC-01: EXEMPT_ACTIONS contains 'analyze'
        it('does NOT write pending_delegation marker for "analyze" action (AC-01, AC-03)', async () => {
            const result = await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: { skill: 'isdlc', args: 'analyze "some description"' }
            });

            assert.equal(result.code, 0);
            // No MANDATORY message should be emitted
            assert.ok(!result.stdout.includes('MANDATORY'),
                'Should NOT output MANDATORY delegation message for exempt action');

            // No pending_delegation marker should be written
            const state = readState();
            assert.ok(!state.pending_delegation,
                'Should NOT write pending_delegation for exempt analyze action');
        });

        // AC-02: Action parsing extracts 'analyze' from args string
        it('parses action "analyze" from args with description (AC-02)', async () => {
            const result = await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: { skill: 'isdlc', args: 'analyze "Build a login page"' }
            });

            assert.equal(result.code, 0);
            assert.ok(!result.stdout.includes('MANDATORY'),
                'Should parse analyze from args with quoted description');
        });

        // AC-04: Non-exempt actions still write marker
        it('still writes pending_delegation marker for "feature" action (AC-04)', async () => {
            await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: { skill: 'isdlc', args: 'feature "Build auth"' }
            });

            const state = readState();
            assert.ok(state.pending_delegation,
                'Should still write pending_delegation for non-exempt action "feature"');
            assert.equal(state.pending_delegation.skill, 'isdlc');
            assert.equal(state.pending_delegation.required_agent, 'sdlc-orchestrator');
        });

        it('still writes pending_delegation marker for "fix" action (AC-04)', async () => {
            await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: { skill: 'isdlc', args: 'fix "Login bug"' }
            });

            const state = readState();
            assert.ok(state.pending_delegation,
                'Should still write pending_delegation for non-exempt action "fix"');
        });

        it('still writes pending_delegation marker for "upgrade" action (AC-04)', async () => {
            await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: { skill: 'isdlc', args: 'upgrade "node 22"' }
            });

            const state = readState();
            assert.ok(state.pending_delegation,
                'Should still write pending_delegation for non-exempt action "upgrade"');
        });

        // AC-06: Empty/missing args don't crash; fall through to normal enforcement
        it('falls through to normal enforcement when args are empty (AC-06)', async () => {
            const result = await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: { skill: 'isdlc', args: '' }
            });

            assert.equal(result.code, 0);
            // Empty args => no action parsed => not exempt => normal enforcement
            assert.ok(result.stdout.includes('MANDATORY'),
                'Empty args should fall through to normal delegation enforcement');

            const state = readState();
            assert.ok(state.pending_delegation,
                'Should write pending_delegation when args are empty (not exempt)');
        });

        it('falls through to normal enforcement when args are missing (AC-06)', async () => {
            const result = await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: { skill: 'isdlc' }
            });

            assert.equal(result.code, 0);
            // Missing args => falls through
            assert.ok(result.stdout.includes('MANDATORY'),
                'Missing args should fall through to normal delegation enforcement');
        });

        // Edge case: analyze with leading flags
        it('parses action "analyze" even with leading flags (edge case)', async () => {
            const result = await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: { skill: 'isdlc', args: '--verbose analyze "description"' }
            });

            assert.equal(result.code, 0);
            assert.ok(!result.stdout.includes('MANDATORY'),
                'Should parse analyze even with leading flags');
        });

        // Edge case: case insensitivity
        it('handles ANALYZE in uppercase (case-insensitive) (edge case)', async () => {
            const result = await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: { skill: 'isdlc', args: 'ANALYZE "some feature"' }
            });

            assert.equal(result.code, 0);
            assert.ok(!result.stdout.includes('MANDATORY'),
                'Should handle case-insensitive action matching');
        });

        // Edge case: analyze with /isdlc (leading slash skill)
        it('skips marker for exempt action even with leading slash on skill name', async () => {
            const result = await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: { skill: '/isdlc', args: 'analyze "test"' }
            });

            assert.equal(result.code, 0);
            assert.ok(!result.stdout.includes('MANDATORY'),
                'Should skip marker for exempt analyze even with leading slash');
        });

        // Edge case: discover skill is NOT affected by EXEMPT_ACTIONS
        it('discover skill still enforces delegation (not affected by EXEMPT_ACTIONS)', async () => {
            const result = await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: { skill: 'discover', args: '' }
            });

            assert.equal(result.code, 0);
            assert.ok(result.stdout.includes('MANDATORY'),
                'discover skill should still require delegation');
        });

        // =================================================================
        // REQ-0023: 'add' action exempt from delegation (FR-008, AC-008-01)
        // =================================================================

        it('does NOT write pending_delegation marker for "add" action (REQ-0023, AC-008-01)', async () => {
            const result = await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: { skill: 'isdlc', args: 'add "Add payment processing"' }
            });

            assert.equal(result.code, 0);
            assert.ok(!result.stdout.includes('MANDATORY'),
                'Should NOT output MANDATORY delegation message for exempt add action');

            const state = readState();
            assert.ok(!state.pending_delegation,
                'Should NOT write pending_delegation for exempt add action');
        });

        it('add action with flags exempt from delegation (REQ-0023)', async () => {
            const result = await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: { skill: 'isdlc', args: '--verbose add "#42"' }
            });

            assert.equal(result.code, 0);
            assert.ok(!result.stdout.includes('MANDATORY'),
                'Should skip MANDATORY for add with leading flags');
        });

        // =================================================================
        // REQ-0023: 'build' action NOT exempt (FR-008, AC-008-02)
        // =================================================================

        it('build action requires delegation enforcement (REQ-0023, AC-008-02)', async () => {
            const result = await runHook(hookPath, {
                tool_name: 'Skill',
                tool_input: { skill: 'isdlc', args: 'build "payment-processing"' }
            });

            assert.equal(result.code, 0);
            assert.ok(result.stdout.includes('MANDATORY'),
                'build action should require delegation');

            const state = readState();
            assert.ok(state.pending_delegation,
                'Should write pending_delegation for build action');
        });

        // Debug log confirmation (debugLog requires SKILL_VALIDATOR_DEBUG=true)
        it('logs exempt action to stderr when debug mode enabled', async () => {
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
                    tool_name: 'Skill',
                    tool_input: { skill: 'isdlc', args: 'analyze "test"' }
                }));
                child.stdin.end();
            });

            assert.equal(result.code, 0);
            // stderr should contain debug log about exempt action
            assert.ok(result.stderr.includes('exempt'),
                'Should log exempt action to stderr when debug is enabled');
        });
    });
});
