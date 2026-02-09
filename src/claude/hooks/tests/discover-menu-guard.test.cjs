/**
 * Tests for discover-menu-guard.cjs hook
 * Traces to: FR-07, AC-07, AC-07a-c, NFR-01
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const HOOK_PATH = path.join(__dirname, '..', 'discover-menu-guard.cjs');

function setupTestEnv() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'discover-menu-test-'));
    const isdlcDir = path.join(tmpDir, '.isdlc');
    fs.mkdirSync(isdlcDir, { recursive: true });
    return tmpDir;
}

function runHook(tmpDir, stdinJson) {
    const stdinStr = typeof stdinJson === 'string'
        ? stdinJson
        : JSON.stringify(stdinJson);
    const result = spawnSync('node', [HOOK_PATH], {
        input: stdinStr,
        cwd: tmpDir,
        env: {
            ...process.env,
            CLAUDE_PROJECT_DIR: tmpDir,
            SKILL_VALIDATOR_DEBUG: 'true'
        },
        encoding: 'utf8',
        timeout: 5000
    });
    return {
        stdout: (result.stdout || '').trim(),
        stderr: (result.stderr || '').trim(),
        exitCode: result.status || 0
    };
}

function makeDiscoverMenuResult(text) {
    return {
        tool_name: 'Task',
        tool_input: { subagent_type: 'discover-orchestrator' },
        tool_result: text
    };
}

const CORRECT_MENU = `Welcome to iSDLC Discover!

Please choose an option:
[1] New Project - Start from scratch
[2] Existing Project (Recommended) - Analyze your existing codebase
[3] Chat/Explore - Have a conversation about your project

Select an option (1-3):`;

const MISSING_EXPLORE_MENU = `Welcome to iSDLC Discover!

Please choose an option:
[1] New Project - Start from scratch
[2] Existing Project (Recommended) - Analyze your existing codebase

Select an option (1-2):`;

const OLD_MENU_WITH_SCOPED = `Welcome to iSDLC Discover!

Please choose an option:
[1] New Project - Start from scratch
[2] Existing Project - Analyze your existing codebase
[3] Chat/Explore - Conversational mode
[4] Scoped Analysis - Analyze specific parts

Select an option (1-4):`;

const OLD_MENU_WITH_AUTODETECT = `Welcome to iSDLC Discover!

Please choose an option:
[1] Auto-detect project type
[2] New Project
[3] Existing Project - Analyze your existing codebase
[4] Chat/Explore - Conversational mode

Select an option (1-4):`;

describe('discover-menu-guard hook', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = setupTestEnv();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // T1: Silent for correct 3-option menu
    it('silent for correct 3-option menu', () => {
        const result = runHook(tmpDir, makeDiscoverMenuResult(CORRECT_MENU));
        assert.equal(result.stdout, '', 'Should NEVER produce stdout');
        assert.ok(!result.stderr.includes('[discover-menu-guard] WARNING'));
    });

    // T2: Warns when missing required option (Chat/Explore)
    it('warns when missing Chat/Explore option', () => {
        const result = runHook(tmpDir, makeDiscoverMenuResult(MISSING_EXPLORE_MENU));
        assert.equal(result.stdout, '');
        assert.ok(result.stderr.includes('[discover-menu-guard] WARNING'));
        assert.ok(result.stderr.includes('Missing options'));
    });

    // T3: Warns when forbidden option present (Scoped Analysis)
    it('warns when Scoped Analysis option present', () => {
        const result = runHook(tmpDir, makeDiscoverMenuResult(OLD_MENU_WITH_SCOPED));
        assert.equal(result.stdout, '');
        assert.ok(result.stderr.includes('[discover-menu-guard] WARNING'));
        assert.ok(result.stderr.includes('removed options'));
    });

    // T4: Warns when forbidden option present (Auto-detect)
    it('warns when Auto-detect option present', () => {
        const result = runHook(tmpDir, makeDiscoverMenuResult(OLD_MENU_WITH_AUTODETECT));
        assert.equal(result.stdout, '');
        assert.ok(result.stderr.includes('[discover-menu-guard] WARNING'));
        assert.ok(result.stderr.includes('removed options'));
    });

    // T5: Silent for non-discover tasks
    it('silent for non-discover tasks', () => {
        const result = runHook(tmpDir, {
            tool_name: 'Task',
            tool_input: { subagent_type: 'software-developer' },
            tool_result: 'some output with [1] options'
        });
        assert.equal(result.stdout, '');
        assert.ok(!result.stderr.includes('[discover-menu-guard] WARNING'));
    });

    // T6: Silent for non-Task tools
    it('silent for non-Task tools', () => {
        const result = runHook(tmpDir, {
            tool_name: 'Bash',
            tool_input: { command: 'ls' }
        });
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T7: Silent when tool_result is too short
    it('silent when tool_result is too short', () => {
        const result = runHook(tmpDir, makeDiscoverMenuResult('short'));
        assert.equal(result.stdout, '');
        assert.ok(!result.stderr.includes('[discover-menu-guard] WARNING'));
    });

    // T8: Silent when no numbered options detected
    it('silent when no numbered options detected', () => {
        const longText = 'This is a long discover result without any numbered options. '.repeat(5);
        const result = runHook(tmpDir, makeDiscoverMenuResult(longText));
        assert.equal(result.stdout, '');
        assert.ok(!result.stderr.includes('[discover-menu-guard] WARNING'));
    });

    // T9: Fail-open on empty stdin
    it('fail-open on empty stdin', () => {
        const result = runHook(tmpDir, '');
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T10: Fail-open on invalid JSON
    it('fail-open on invalid JSON', () => {
        const result = runHook(tmpDir, 'not json');
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T11: Handles object tool_result
    it('handles object tool_result', () => {
        const result = runHook(tmpDir, {
            tool_name: 'Task',
            tool_input: { subagent_type: 'discover-orchestrator' },
            tool_result: {
                output: '[1] New Project [2] Existing Project [3] Chat/Explore',
                status: 'success',
                menu: 'option 1 is new project'
            }
        });
        assert.equal(result.stdout, '');
        // The stringified object should contain the menu options
    });
});
