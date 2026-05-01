'use strict';

/**
 * Tests for post-skill-dispatcher.cjs
 * REQ-GH-278 FR-001: PostToolUse[Skill] logging hook
 * Test IDs: PSD-01 through PSD-14
 *
 * Uses hook-test-utils.cjs for isolated test environment setup.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
    setupTestEnv,
    cleanupTestEnv,
    prepareDispatcher,
    runDispatcher,
    readState,
    writeState
} = require(path.resolve(__dirname, '..', '..', '..', 'src', 'claude', 'hooks', 'tests', 'hook-test-utils.cjs'));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeValidSkillInput(overrides = {}) {
    return {
        tool_name: 'Skill',
        tool_input: { skill: 'unit-testing', args: '--verbose' },
        tool_result: 'Skill invoked successfully',
        ...overrides
    };
}

function makeStateWithWorkflow(overrides = {}) {
    return {
        active_workflow: {
            type: 'feature',
            current_phase: '06-implementation',
            phases: ['05-test-strategy', '06-implementation'],
            sub_agent_log: [{ agent: 'software-developer', phase: '06-implementation', status: 'running' }]
        },
        skill_enforcement: { enabled: true, mode: 'observe' },
        skill_usage_log: [],
        current_phase: '06-implementation',
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

let dispatcherPath;

describe('post-skill-dispatcher.cjs (REQ-GH-278)', () => {

    beforeEach(() => {
        setupTestEnv(makeStateWithWorkflow());
        dispatcherPath = prepareDispatcher('post-skill-dispatcher.cjs');
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    // PSD-01: Logs Skill tool call with correct fields
    it('PSD-01: logs Skill tool call with correct skill_name, agent, phase, timestamp, source:"tool_call"', async () => {
        const result = await runDispatcher(dispatcherPath, makeValidSkillInput());

        assert.strictEqual(result.code, 0);
        assert.strictEqual(result.stdout, ''); // No stdout for PostToolUse

        const state = readState();
        assert.ok(Array.isArray(state.skill_usage_log));
        assert.strictEqual(state.skill_usage_log.length, 1);

        const entry = state.skill_usage_log[0];
        assert.strictEqual(entry.skill_name, 'unit-testing');
        assert.strictEqual(entry.agent, 'software-developer');
        assert.strictEqual(entry.phase, '06-implementation');
        assert.strictEqual(entry.source, 'tool_call');
        assert.ok(entry.timestamp); // ISO-8601 timestamp present
    });

    // PSD-02: Extracts skill name from tool_input.skill field
    it('PSD-02: extracts skill name from tool_input.skill field', async () => {
        const input = makeValidSkillInput({
            tool_input: { skill: 'code-refactoring', args: '' }
        });
        await runDispatcher(dispatcherPath, input);

        const state = readState();
        assert.strictEqual(state.skill_usage_log[0].skill_name, 'code-refactoring');
    });

    // PSD-03: Does not log non-Skill tool calls
    it('PSD-03: does not log non-Skill tool calls (tool_name != "Skill")', async () => {
        const input = {
            tool_name: 'Read',
            tool_input: { file_path: '/tmp/test.txt' },
            tool_result: 'file contents'
        };
        const result = await runDispatcher(dispatcherPath, input);

        assert.strictEqual(result.code, 0);
        const state = readState();
        assert.strictEqual(state.skill_usage_log.length, 0);
    });

    // PSD-04: Fails open when state.json is missing
    it('PSD-04: fails open (exit 0, no stdout) when state.json is missing', async () => {
        // Delete state.json
        const fs = require('fs');
        const testDir = require(path.resolve(__dirname, '..', '..', '..', 'src', 'claude', 'hooks', 'tests', 'hook-test-utils.cjs')).getTestDir();
        fs.unlinkSync(path.join(testDir, '.isdlc', 'state.json'));

        const result = await runDispatcher(dispatcherPath, makeValidSkillInput());
        assert.strictEqual(result.code, 0);
        assert.strictEqual(result.stdout, '');
    });

    // PSD-05: Fails open on empty stdin
    it('PSD-05: fails open on empty stdin', async () => {
        // runDispatcher sends JSON to stdin, so we need to pass empty object
        // Actually we need to test empty string - let's use runHook directly with empty input
        const { spawn } = require('child_process');
        const child = spawn('node', [dispatcherPath], {
            env: { ...process.env },
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';
        child.stdout.on('data', d => { stdout += d.toString(); });
        child.stderr.on('data', d => { stderr += d.toString(); });

        // Write empty string and close
        child.stdin.write('');
        child.stdin.end();

        const code = await new Promise(resolve => child.on('close', resolve));
        assert.strictEqual(code, 0);
        assert.strictEqual(stdout.trim(), '');
    });

    // PSD-06: Fails open on malformed JSON stdin
    it('PSD-06: fails open on malformed JSON stdin', async () => {
        const { spawn } = require('child_process');
        const child = spawn('node', [dispatcherPath], {
            env: { ...process.env },
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        child.stdout.on('data', d => { stdout += d.toString(); });

        child.stdin.write('NOT VALID JSON {{{');
        child.stdin.end();

        const code = await new Promise(resolve => child.on('close', resolve));
        assert.strictEqual(code, 0);
        assert.strictEqual(stdout.trim(), '');
    });

    // PSD-07: Fails open when tool_input is missing
    it('PSD-07: fails open when tool_input is missing', async () => {
        const input = { tool_name: 'Skill' };
        const result = await runDispatcher(dispatcherPath, input);

        assert.strictEqual(result.code, 0);
        assert.strictEqual(result.stdout, '');
        const state = readState();
        assert.strictEqual(state.skill_usage_log.length, 0);
    });

    // PSD-08: Fails open when tool_input.skill is missing
    it('PSD-08: fails open when tool_input.skill is missing', async () => {
        const input = {
            tool_name: 'Skill',
            tool_input: { args: '--verbose' }
        };
        const result = await runDispatcher(dispatcherPath, input);

        assert.strictEqual(result.code, 0);
        assert.strictEqual(result.stdout, '');
        const state = readState();
        assert.strictEqual(state.skill_usage_log.length, 0);
    });

    // PSD-09: Accumulates multiple Skill call entries
    it('PSD-09: accumulates multiple Skill call entries in skill_usage_log', async () => {
        await runDispatcher(dispatcherPath, makeValidSkillInput({
            tool_input: { skill: 'unit-testing' }
        }));
        await runDispatcher(dispatcherPath, makeValidSkillInput({
            tool_input: { skill: 'code-refactoring' }
        }));
        await runDispatcher(dispatcherPath, makeValidSkillInput({
            tool_input: { skill: 'error-handling' }
        }));

        const state = readState();
        assert.strictEqual(state.skill_usage_log.length, 3);
        assert.strictEqual(state.skill_usage_log[0].skill_name, 'unit-testing');
        assert.strictEqual(state.skill_usage_log[1].skill_name, 'code-refactoring');
        assert.strictEqual(state.skill_usage_log[2].skill_name, 'error-handling');
    });

    // PSD-10: Uses active_workflow.current_phase over stale top-level current_phase
    it('PSD-10: uses active_workflow.current_phase over stale top-level current_phase', async () => {
        writeState({
            active_workflow: {
                type: 'feature',
                current_phase: '08-code-review',
                phases: ['06-implementation', '08-code-review'],
                sub_agent_log: [{ agent: 'qa-engineer', phase: '08-code-review' }]
            },
            skill_enforcement: { enabled: true, mode: 'observe' },
            skill_usage_log: [],
            current_phase: '06-implementation' // stale
        });

        await runDispatcher(dispatcherPath, makeValidSkillInput());
        const state = readState();
        assert.strictEqual(state.skill_usage_log[0].phase, '08-code-review');
        assert.strictEqual(state.skill_usage_log[0].agent, 'qa-engineer');
    });

    // PSD-11: Falls back to top-level current_phase when no active_workflow
    it('PSD-11: falls back to top-level current_phase when no active_workflow', async () => {
        writeState({
            skill_enforcement: { enabled: true, mode: 'observe' },
            skill_usage_log: [],
            current_phase: '03-architecture'
        });

        await runDispatcher(dispatcherPath, makeValidSkillInput());
        const state = readState();
        assert.strictEqual(state.skill_usage_log[0].phase, '03-architecture');
        assert.strictEqual(state.skill_usage_log[0].agent, 'unknown');
    });

    // PSD-12: Records timestamp in ISO 8601 format
    it('PSD-12: records timestamp in ISO 8601 format', async () => {
        await runDispatcher(dispatcherPath, makeValidSkillInput());

        const state = readState();
        const ts = state.skill_usage_log[0].timestamp;
        // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ or similar
        assert.ok(ts);
        assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(ts), `Timestamp "${ts}" should be ISO 8601`);
    });

    // PSD-13: Does not log when skill_enforcement.enabled is false
    it('PSD-13: does not log when skill_enforcement.enabled is false', async () => {
        writeState({
            ...makeStateWithWorkflow(),
            skill_enforcement: { enabled: false, mode: 'observe' }
        });

        await runDispatcher(dispatcherPath, makeValidSkillInput());
        const state = readState();
        assert.strictEqual(state.skill_usage_log.length, 0);
    });

    // PSD-14: Includes args field from tool_input if present
    it('PSD-14: includes args field from tool_input if present', async () => {
        const input = makeValidSkillInput({
            tool_input: { skill: 'unit-testing', args: '--coverage --verbose' }
        });
        await runDispatcher(dispatcherPath, input);

        const state = readState();
        assert.strictEqual(state.skill_usage_log[0].args, '--coverage --verbose');
    });
});
