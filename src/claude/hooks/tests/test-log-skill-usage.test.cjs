'use strict';

/**
 * iSDLC Log Skill Usage - Test Suite (CJS / node:test)
 * =====================================================
 * Tests for log-skill-usage.js PostToolUse hook.
 *
 * Uses .cjs extension to avoid ESM/CJS conflict (package.json has "type": "module").
 * The hook is copied to the temp dir as .cjs via prepareHook().
 *
 * Run:  node --test src/claude/hooks/tests/test-log-skill-usage.test.cjs
 *
 * Version: 4.0.0
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
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

// Absolute paths to the source hook files
const LOGGER_HOOK_SRC = path.resolve(__dirname, '..', 'log-skill-usage.cjs');
const VALIDATOR_HOOK_SRC = path.resolve(__dirname, '..', 'skill-validator.cjs');

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

describe('log-skill-usage.js', () => {
    let hookPath;

    beforeEach(() => {
        setupTestEnv();
        hookPath = prepareHook(LOGGER_HOOK_SRC);
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    // -----------------------------------------------------------------------
    // 1. Task tool usage logged to state.json (check skill_usage_log array)
    // -----------------------------------------------------------------------
    it('logs Task tool usage to skill_usage_log in state.json', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'software-developer',
                prompt: 'Implement feature',
                description: 'Build the widget'
            },
            tool_result: 'success'
        });

        assert.equal(result.code, 0, 'exit code should be 0');

        const state = readState();
        assert.ok(Array.isArray(state.skill_usage_log), 'skill_usage_log should be an array');
        assert.equal(state.skill_usage_log.length, 1, 'should have exactly 1 log entry');
    });

    // -----------------------------------------------------------------------
    // 2. Log entry contains correct agent name
    // -----------------------------------------------------------------------
    it('records the correct agent name in the log entry', async () => {
        await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'software-developer',
                prompt: 'Implement feature',
                description: 'Build widget'
            },
            tool_result: 'ok'
        });

        const state = readState();
        const entry = state.skill_usage_log[0];
        assert.equal(entry.agent, 'software-developer', 'agent field should be normalized name');
        assert.equal(entry.description, 'Build widget', 'description should be captured');
        assert.ok(entry.timestamp, 'timestamp should be present');
        assert.equal(entry.current_phase, '06-implementation', 'current_phase should match state');
    });

    // -----------------------------------------------------------------------
    // 3. Non-Task tool not logged (count stays 0)
    // -----------------------------------------------------------------------
    it('does not log non-Task tool calls', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Read',
            tool_input: { file_path: '/some/file.js' }
        });

        assert.equal(result.code, 0, 'exit code should be 0');

        const state = readState();
        assert.equal(state.skill_usage_log.length, 0, 'skill_usage_log should remain empty');
    });

    // -----------------------------------------------------------------------
    // 4. Multiple Task calls accumulate in log
    // -----------------------------------------------------------------------
    it('accumulates multiple Task call log entries', async () => {
        // First call
        await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'software-developer',
                prompt: 'First call',
                description: 'Call 1'
            }
        });

        // Second call
        await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'requirements-analyst',
                prompt: 'Second call',
                description: 'Call 2'
            }
        });

        // Third call
        await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'sdlc-orchestrator',
                prompt: 'Third call',
                description: 'Call 3'
            }
        });

        const state = readState();
        assert.equal(state.skill_usage_log.length, 3, 'should have 3 log entries');
        assert.equal(state.skill_usage_log[0].agent, 'software-developer');
        assert.equal(state.skill_usage_log[1].agent, 'requirements-analyst');
        assert.equal(state.skill_usage_log[2].agent, 'sdlc-orchestrator');
    });

    // -----------------------------------------------------------------------
    // 5. Disabled enforcement -- no logging
    // -----------------------------------------------------------------------
    it('does not log when enforcement is disabled', async () => {
        const state = readState();
        state.skill_enforcement.enabled = false;
        writeState(state);

        await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'software-developer',
                prompt: 'Should not be logged'
            }
        });

        const updatedState = readState();
        assert.equal(updatedState.skill_usage_log.length, 0, 'no entries when enforcement disabled');
    });

    // -----------------------------------------------------------------------
    // 6. Log entry has correct status field
    //    - 'executed' for phase-match
    //    - 'observed' for cross-phase in observe mode
    // -----------------------------------------------------------------------
    it('sets status to "executed" for phase-matching agent', async () => {
        // software-developer in phase 06-implementation, current_phase = 06-implementation
        await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'software-developer',
                prompt: 'Phase match call'
            }
        });

        const state = readState();
        const entry = state.skill_usage_log[0];
        assert.equal(entry.status, 'executed', 'status should be "executed" for phase match');
        assert.equal(entry.reason, 'authorized-phase-match', 'reason should indicate phase match');
    });

    it('sets status to "observed" for cross-phase agent in observe mode', async () => {
        // requirements-analyst is in 01-requirements, current is 06-implementation
        await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'requirements-analyst',
                prompt: 'Cross-phase call'
            }
        });

        const state = readState();
        const entry = state.skill_usage_log[0];
        assert.equal(entry.status, 'observed', 'status should be "observed" for cross-phase');
        assert.equal(entry.reason, 'cross-phase-usage', 'reason should indicate cross-phase');
    });

    it('sets status to "warned" for cross-phase agent in warn mode', async () => {
        const state = readState();
        state.skill_enforcement.mode = 'warn';
        writeState(state);

        await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'requirements-analyst',
                prompt: 'Cross-phase in warn mode'
            }
        });

        const updatedState = readState();
        const entry = updatedState.skill_usage_log[0];
        assert.equal(entry.status, 'warned', 'status should be "warned" in warn mode');
        assert.equal(entry.enforcement_mode, 'warn', 'enforcement_mode should be recorded');
    });

    it('sets status to "executed" and reason "authorized-orchestrator" for orchestrator', async () => {
        await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'sdlc-orchestrator',
                prompt: 'Orchestrator call'
            }
        });

        const state = readState();
        const entry = state.skill_usage_log[0];
        assert.equal(entry.status, 'executed', 'orchestrator status should be "executed"');
        assert.equal(entry.reason, 'authorized-orchestrator', 'reason should be orchestrator');
    });

    // -----------------------------------------------------------------------
    // 7. Integration: validator allows + logger logs correctly
    // -----------------------------------------------------------------------
    it('integration: validator allows then logger logs the same call', async () => {
        const validatorPath = prepareHook(VALIDATOR_HOOK_SRC);

        const input = {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'software-developer',
                prompt: 'Implementation task',
                description: 'Build feature X'
            }
        };

        // Step 1: Validator (PreToolUse) -- should allow
        const validatorResult = await runHook(validatorPath, input);
        assert.equal(validatorResult.code, 0, 'validator exit code should be 0');
        assert.equal(validatorResult.stdout, '', 'validator should produce no stdout');

        // Step 2: Logger (PostToolUse) -- should log
        const loggerResult = await runHook(hookPath, {
            ...input,
            tool_result: 'Feature X implemented successfully'
        });
        assert.equal(loggerResult.code, 0, 'logger exit code should be 0');

        // Verify log entry
        const state = readState();
        assert.equal(state.skill_usage_log.length, 1, 'should have 1 log entry');
        assert.equal(state.skill_usage_log[0].agent, 'software-developer');
        assert.equal(state.skill_usage_log[0].status, 'executed');
        assert.equal(state.skill_usage_log[0].description, 'Build feature X');
    });

    // -----------------------------------------------------------------------
    // 8. Missing state.json -- fail-open, no crash
    // -----------------------------------------------------------------------
    it('fails open without crashing when state.json is missing', async () => {
        // Remove state.json
        const testDir = getTestDir();
        const stateFile = path.join(testDir, '.isdlc', 'state.json');
        if (fs.existsSync(stateFile)) {
            fs.unlinkSync(stateFile);
        }

        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'software-developer',
                prompt: 'This should not crash'
            }
        });

        assert.equal(result.code, 0, 'exit code should be 0 (fail-open)');
        assert.equal(result.stdout, '', 'stdout should be empty');
    });

    // -----------------------------------------------------------------------
    // Bonus: empty stdin -- fail-open
    // -----------------------------------------------------------------------
    it('fails open on empty stdin without crashing', async () => {
        const result = await runHookRaw(hookPath, '');

        assert.equal(result.code, 0, 'exit code should be 0');
        assert.equal(result.stdout, '', 'stdout should be empty');

        // State should be unchanged
        const state = readState();
        assert.equal(state.skill_usage_log.length, 0, 'no entries should be logged');
    });

    // -----------------------------------------------------------------------
    // Bonus: description defaults to 'N/A' when not provided
    // -----------------------------------------------------------------------
    it('defaults description to "N/A" when not provided in tool_input', async () => {
        await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'software-developer',
                prompt: 'No description provided'
            }
        });

        const state = readState();
        const entry = state.skill_usage_log[0];
        assert.equal(entry.description, 'N/A', 'description should default to "N/A"');
    });
});
