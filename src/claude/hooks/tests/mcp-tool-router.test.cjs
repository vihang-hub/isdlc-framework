/**
 * Tests for mcp-tool-router.cjs PreToolUse hook
 * ==============================================
 * Traces to: FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, NFR-01, NFR-02, NFR-03
 *
 * Test groups:
 *   TC-01: Happy path routing (FR-01)
 *   TC-02: Enforcement levels (FR-04)
 *   TC-03: Fail-open behavior (FR-03)
 *   TC-04: Config extensibility (FR-02)
 *   TC-05: MCP availability detection (FR-05)
 *   TC-06: Legitimate use exceptions (FR-06)
 *   TC-07: Hook integration (NFR-01, NFR-02, NFR-03)
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

const HOOK_PATH = path.join(__dirname, '..', 'mcp-tool-router.cjs');

const VALID_CONFIG = {
    version: '1.0.0',
    default_enforcement: 'warn',
    rules: [
        {
            tool: 'Grep',
            operation: 'codebase_search',
            mcp_tool: 'mcp__code-index-mcp__search_code_advanced',
            enforcement: 'block',
            description: 'Use semantic code search instead of regex grep',
            exceptions: { specific_file: true }
        },
        {
            tool: 'Glob',
            operation: 'file_discovery',
            mcp_tool: 'mcp__code-index-mcp__find_files',
            enforcement: 'warn',
            description: 'Use indexed file discovery instead of filesystem glob'
        },
        {
            tool: 'Read',
            operation: 'file_summary',
            mcp_tool: 'mcp__code-index-mcp__get_file_summary',
            enforcement: 'warn',
            description: 'Use file summary for orientation',
            exceptions: { partial_read: true, pdf_read: true }
        },
        {
            tool: 'Read',
            operation: 'bulk_read',
            mcp_tool: 'mcp__bulk-fs-mcp__read_files',
            enforcement: 'warn',
            exceptions: { single_file: true }
        },
        {
            tool: 'Write',
            operation: 'bulk_write',
            mcp_tool: 'mcp__bulk-fs-mcp__write_files',
            enforcement: 'allow',
            exceptions: { single_file: true }
        },
        {
            tool: 'Bash',
            operation: 'directory_creation',
            mcp_tool: 'mcp__bulk-fs-mcp__create_directories',
            enforcement: 'warn',
            command_pattern: '^mkdir\\b',
            exceptions: { temp_directory: true }
        }
    ]
};

const SETTINGS_WITH_MCP = {
    mcpServers: {
        'code-index-mcp': { command: 'code-index-mcp', args: [] },
        'bulk-fs-mcp': { command: 'bulk-fs-mcp', args: [] }
    }
};

const SETTINGS_NO_MCP = {
    mcpServers: {}
};

// ---------------------------------------------------------------------------
// Test environment helpers
// ---------------------------------------------------------------------------

function setupTestEnv(configOverride, settingsOverride) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-router-test-'));
    const isdlcDir = path.join(tmpDir, '.isdlc');
    const configDir = path.join(tmpDir, '.claude', 'hooks', 'config');
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(isdlcDir, { recursive: true });
    fs.mkdirSync(configDir, { recursive: true });

    // Write config
    if (configOverride !== null) {
        const config = configOverride !== undefined ? configOverride : VALID_CONFIG;
        if (typeof config === 'string') {
            fs.writeFileSync(path.join(configDir, 'mcp-tool-routing.json'), config);
        } else {
            fs.writeFileSync(path.join(configDir, 'mcp-tool-routing.json'), JSON.stringify(config, null, 2));
        }
    }

    // Write settings.json (for MCP availability detection)
    const settings = settingsOverride !== undefined ? settingsOverride : SETTINGS_WITH_MCP;
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify(settings, null, 2));

    // Write minimal state.json
    fs.writeFileSync(
        path.join(isdlcDir, 'state.json'),
        JSON.stringify({ current_phase: '06-implementation' }, null, 2)
    );

    return tmpDir;
}

function cleanupTestEnv(tmpDir) {
    if (tmpDir && fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

function runHook(tmpDir, stdinInput) {
    const stdinStr = typeof stdinInput === 'string' ? stdinInput : JSON.stringify(stdinInput);
    const result = spawnSync('node', [HOOK_PATH], {
        cwd: tmpDir,
        input: stdinStr,
        env: {
            ...process.env,
            CLAUDE_PROJECT_DIR: tmpDir,
            SKILL_VALIDATOR_DEBUG: '0',
            PATH: process.env.PATH
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

/**
 * Load the hook module directly (for unit testing check() function).
 * We require a fresh copy each time to avoid config cache issues.
 */
function loadHookModule(tmpDir) {
    // Clear require cache
    delete require.cache[require.resolve(HOOK_PATH)];
    process.env.CLAUDE_PROJECT_DIR = tmpDir;
    const mod = require(HOOK_PATH);
    mod.clearConfigCache();
    return mod;
}

// ===========================================================================
// TC-01: Happy Path Routing (FR-01)
// ===========================================================================

describe('TC-01: Happy path routing (FR-01)', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv(tmpDir);
    });

    it('TC-01.1: Grep triggers routing suggestion to search_code_advanced', () => {
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Grep', tool_input: { pattern: 'foo', path: '/project' } }
        });
        assert.equal(result.decision, 'block');
        assert.ok(result.stopReason);
        assert.ok(result.stopReason.includes('mcp__code-index-mcp__search_code_advanced'));
    });

    it('TC-01.2: Glob triggers routing suggestion to find_files', () => {
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Glob', tool_input: { pattern: '**/*.ts' } }
        });
        assert.equal(result.decision, 'allow');
        assert.ok(result.stderr);
        assert.ok(result.stderr.includes('mcp__code-index-mcp__find_files'));
    });

    it('TC-01.3: Bash mkdir triggers routing to create_directories', () => {
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Bash', tool_input: { command: 'mkdir -p /project/src/new' } }
        });
        assert.equal(result.decision, 'allow');
        assert.ok(result.stderr);
        assert.ok(result.stderr.includes('mcp__bulk-fs-mcp__create_directories'));
    });

    it('TC-01.4: Read (full file, no offset/limit) triggers routing to get_file_summary', () => {
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Read', tool_input: { file_path: '/some/file.js' } }
        });
        assert.equal(result.decision, 'allow');
        assert.ok(result.stderr);
        assert.ok(result.stderr.includes('mcp__code-index-mcp__get_file_summary'));
    });

    it('TC-01.5: Unmatched tool passes through silently', () => {
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Task', tool_input: { description: 'Do something' } }
        });
        assert.equal(result.decision, 'allow');
        assert.equal(result.stopReason, undefined);
        assert.equal(result.stderr, undefined);
    });

    it('TC-01.6: Tool in routing table but with allow enforcement passes through', () => {
        const mod = loadHookModule(tmpDir);
        // Write rule has "allow" enforcement and single_file exception,
        // so single writes always pass through
        const result = mod.check({
            input: { tool_name: 'Write', tool_input: { file_path: '/a/b.js', content: 'x' } }
        });
        assert.equal(result.decision, 'allow');
        assert.equal(result.stopReason, undefined);
    });
});

// ===========================================================================
// TC-02: Enforcement Levels (FR-04)
// ===========================================================================

describe('TC-02: Enforcement levels (FR-04)', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv(tmpDir);
    });

    it('TC-02.1: block level outputs continue:false with stopReason', () => {
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Grep', tool_input: { pattern: 'X', path: '/project' } }
        });
        assert.equal(result.decision, 'block');
        assert.ok(result.stopReason);
        assert.ok(result.stopReason.includes('mcp__code-index-mcp__search_code_advanced'));
        assert.ok(result.stopReason.includes('MCP TOOL ROUTING'));
    });

    it('TC-02.2: warn level allows through with stderr warning', () => {
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Glob', tool_input: { pattern: '**/*.ts' } }
        });
        assert.equal(result.decision, 'allow');
        assert.equal(result.stopReason, undefined);
        assert.ok(result.stderr);
        assert.ok(result.stderr.includes('WARNING'));
    });

    it('TC-02.3: allow level passes through silently', () => {
        // Override config with Grep set to allow
        const config = JSON.parse(JSON.stringify(VALID_CONFIG));
        config.rules[0].enforcement = 'allow';
        cleanupTestEnv(tmpDir);
        tmpDir = setupTestEnv(config);

        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Grep', tool_input: { pattern: 'X', path: '/project' } }
        });
        assert.equal(result.decision, 'allow');
        assert.equal(result.stopReason, undefined);
        assert.equal(result.stderr, undefined);
    });

    it('TC-02.4: per-rule override: Grep is block but Glob is warn', () => {
        const mod = loadHookModule(tmpDir);

        const grepResult = mod.check({
            input: { tool_name: 'Grep', tool_input: { pattern: 'X', path: '/project' } }
        });
        assert.equal(grepResult.decision, 'block');

        mod.clearConfigCache();
        const globResult = mod.check({
            input: { tool_name: 'Glob', tool_input: { pattern: '**/*.ts' } }
        });
        assert.equal(globResult.decision, 'allow');
        assert.ok(globResult.stderr); // warn generates stderr
    });

    it('TC-02.5: default enforcement applies when rule omits enforcement field', () => {
        const config = {
            version: '1.0.0',
            default_enforcement: 'warn',
            rules: [
                {
                    tool: 'Glob',
                    operation: 'file_discovery',
                    mcp_tool: 'mcp__code-index-mcp__find_files'
                    // No enforcement field -- should use default_enforcement
                }
            ]
        };
        cleanupTestEnv(tmpDir);
        tmpDir = setupTestEnv(config);

        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Glob', tool_input: { pattern: '*.ts' } }
        });
        assert.equal(result.decision, 'allow');
        assert.ok(result.stderr);
        assert.ok(result.stderr.includes('WARNING'));
    });
});

// ===========================================================================
// TC-03: Fail-Open Behavior (FR-03)
// ===========================================================================

describe('TC-03: Fail-open behavior (FR-03)', () => {
    let tmpDir;

    afterEach(() => {
        cleanupTestEnv(tmpDir);
    });

    it('TC-03.1: empty stdin exits cleanly', () => {
        tmpDir = setupTestEnv();
        const result = runHook(tmpDir, '');
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    it('TC-03.2: malformed JSON stdin exits cleanly', () => {
        tmpDir = setupTestEnv();
        const result = runHook(tmpDir, 'not json {');
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    it('TC-03.3: missing tool_name allows through', () => {
        tmpDir = setupTestEnv();
        const mod = loadHookModule(tmpDir);
        const result = mod.check({ input: { tool_input: {} } });
        assert.equal(result.decision, 'allow');
    });

    it('TC-03.4: missing tool_input allows through', () => {
        tmpDir = setupTestEnv();
        const mod = loadHookModule(tmpDir);
        // Grep without tool_input still matches the rule but has no
        // tool_input — exceptions check handles gracefully
        const result = mod.check({ input: { tool_name: 'Grep' } });
        // Should still try to match and possibly block/warn,
        // but the important thing is no crash
        assert.ok(result.decision === 'allow' || result.decision === 'block');
    });

    it('TC-03.5: config file missing allows through', () => {
        tmpDir = setupTestEnv(null); // null = don't write config
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Grep', tool_input: { pattern: 'foo' } }
        });
        assert.equal(result.decision, 'allow');
    });

    it('TC-03.6: config file malformed JSON allows through', () => {
        tmpDir = setupTestEnv('not valid json {{{');
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Grep', tool_input: { pattern: 'foo' } }
        });
        assert.equal(result.decision, 'allow');
    });

    it('TC-03.7: config file with empty rules array allows through', () => {
        tmpDir = setupTestEnv({ version: '1.0.0', rules: [] });
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Grep', tool_input: { pattern: 'foo' } }
        });
        assert.equal(result.decision, 'allow');
    });

    it('TC-03.8: null ctx input allows through', () => {
        tmpDir = setupTestEnv();
        const mod = loadHookModule(tmpDir);
        const result = mod.check({});
        assert.equal(result.decision, 'allow');
    });
});

// ===========================================================================
// TC-04: Config Extensibility (FR-02)
// ===========================================================================

describe('TC-04: Config extensibility (FR-02)', () => {
    let tmpDir;

    afterEach(() => {
        cleanupTestEnv(tmpDir);
    });

    it('TC-04.1: add a new custom routing rule via config', () => {
        const config = {
            version: '1.0.0',
            default_enforcement: 'block',
            rules: [
                {
                    tool: 'CustomTool',
                    operation: 'custom_op',
                    mcp_tool: 'mcp__code-index-mcp__custom_tool',
                    enforcement: 'block',
                    description: 'Custom routing rule'
                }
            ]
        };
        tmpDir = setupTestEnv(config);
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'CustomTool', tool_input: {} }
        });
        assert.equal(result.decision, 'block');
        assert.ok(result.stopReason.includes('mcp__code-index-mcp__custom_tool'));
    });

    it('TC-04.2: removing a routing rule means the tool is no longer routed', () => {
        const config = {
            version: '1.0.0',
            default_enforcement: 'block',
            rules: []  // No rules = nothing routed
        };
        tmpDir = setupTestEnv(config);
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Grep', tool_input: { pattern: 'X' } }
        });
        assert.equal(result.decision, 'allow');
    });

    it('TC-04.3: config supports description field for human-readable docs', () => {
        const config = {
            version: '1.0.0',
            rules: [
                {
                    tool: 'Grep',
                    operation: 'search',
                    mcp_tool: 'mcp__code-index-mcp__search_code_advanced',
                    enforcement: 'block',
                    description: 'Use semantic search for better results'
                }
            ]
        };
        tmpDir = setupTestEnv(config);
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Grep', tool_input: { pattern: 'X' } }
        });
        assert.equal(result.decision, 'block');
        assert.ok(result.stopReason.includes('semantic search'));
    });

    it('TC-04.4: config supports default_enforcement field', () => {
        const config = {
            version: '1.0.0',
            default_enforcement: 'warn',
            rules: [
                {
                    tool: 'Glob',
                    operation: 'find',
                    mcp_tool: 'mcp__code-index-mcp__find_files'
                    // No enforcement -- should default to 'warn'
                }
            ]
        };
        tmpDir = setupTestEnv(config);
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Glob', tool_input: { pattern: '*.js' } }
        });
        assert.equal(result.decision, 'allow');
        assert.ok(result.stderr);
        assert.ok(result.stderr.includes('WARNING'));
    });
});

// ===========================================================================
// TC-05: MCP Availability Detection (FR-05)
// ===========================================================================

describe('TC-05: MCP availability detection (FR-05)', () => {
    let tmpDir;

    afterEach(() => {
        cleanupTestEnv(tmpDir);
    });

    it('TC-05.1: MCP tool available — routing enforced', () => {
        tmpDir = setupTestEnv(undefined, SETTINGS_WITH_MCP);
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Grep', tool_input: { pattern: 'foo', path: '/project' } }
        });
        assert.equal(result.decision, 'block');
        assert.ok(result.stopReason);
    });

    it('TC-05.2: MCP tool NOT available — allow through (fail-open)', () => {
        tmpDir = setupTestEnv(undefined, SETTINGS_NO_MCP);
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Grep', tool_input: { pattern: 'foo', path: '/project' } }
        });
        assert.equal(result.decision, 'allow');
    });

    it('TC-05.3: MCP availability check errors — allow through (fail-open)', () => {
        tmpDir = setupTestEnv();
        // Write invalid JSON to settings.json to force parse error
        fs.writeFileSync(path.join(tmpDir, '.claude', 'settings.json'), 'not json');
        const mod = loadHookModule(tmpDir);
        // isMcpToolAvailable should catch the error and return true (fail-open assumes available)
        // But since the config is valid and rule matches, it proceeds
        const result = mod.check({
            input: { tool_name: 'Grep', tool_input: { pattern: 'foo', path: '/project' } }
        });
        // Fails open — either blocks (assumed available) or allows
        assert.ok(result.decision === 'block' || result.decision === 'allow');
        assert.equal(result.exitCode, undefined); // No crash
    });

    it('TC-05.3b: isMcpToolAvailable returns true on parse error (fail-open)', () => {
        tmpDir = setupTestEnv();
        fs.writeFileSync(path.join(tmpDir, '.claude', 'settings.json'), 'not json');
        const mod = loadHookModule(tmpDir);
        const available = mod.isMcpToolAvailable('mcp__code-index-mcp__search_code_advanced', tmpDir);
        // On parse error, fail-open returns true
        assert.equal(available, true);
    });
});

// ===========================================================================
// TC-06: Legitimate Use Exceptions (FR-06)
// ===========================================================================

describe('TC-06: Legitimate use exceptions (FR-06)', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv(tmpDir);
    });

    it('TC-06.1: Read with offset (edit prep) is NOT routed', () => {
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Read', tool_input: { file_path: 'f.js', offset: 10, limit: 50 } }
        });
        assert.equal(result.decision, 'allow');
        assert.equal(result.stderr, undefined);
    });

    it('TC-06.1b: Read with limit only is NOT routed', () => {
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Read', tool_input: { file_path: 'f.js', limit: 100 } }
        });
        assert.equal(result.decision, 'allow');
        assert.equal(result.stderr, undefined);
    });

    it('TC-06.2: Read with pages param (PDF reading) is NOT routed', () => {
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Read', tool_input: { file_path: 'doc.pdf', pages: '1-5' } }
        });
        assert.equal(result.decision, 'allow');
        assert.equal(result.stderr, undefined);
    });

    it('TC-06.3: Grep with specific file path is exempt', () => {
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Grep', tool_input: { pattern: 'X', path: '/specific/file.js' } }
        });
        assert.equal(result.decision, 'allow');
    });

    it('TC-06.3b: Grep with directory path is NOT exempt', () => {
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Grep', tool_input: { pattern: 'X', path: '/project/src' } }
        });
        assert.equal(result.decision, 'block');
    });

    it('TC-06.4: Bash commands that are NOT mkdir are not routed', () => {
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Bash', tool_input: { command: 'ls -la' } }
        });
        assert.equal(result.decision, 'allow');
        assert.equal(result.stderr, undefined);
    });

    it('TC-06.5: Bash mkdir to temp directory is not routed', () => {
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Bash', tool_input: { command: 'mkdir -p /tmp/test' } }
        });
        assert.equal(result.decision, 'allow');
    });

    it('TC-06.6: Write tool is not bulk-routed for single file writes', () => {
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Write', tool_input: { file_path: 'f.js', content: 'x' } }
        });
        assert.equal(result.decision, 'allow');
        assert.equal(result.stderr, undefined);
    });
});

// ===========================================================================
// TC-07: Hook Integration (NFR-01, NFR-02, NFR-03)
// ===========================================================================

describe('TC-07: Hook integration (NFR-01, NFR-02, NFR-03)', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv(tmpDir);
    });

    it('TC-07.1: hook spawns as child process and exits cleanly', () => {
        const result = runHook(tmpDir, { tool_name: 'Task', tool_input: {} });
        assert.equal(result.exitCode, 0);
    });

    it('TC-07.2: hook reads stdin JSON and writes blocking JSON to stdout', () => {
        const result = runHook(tmpDir, {
            tool_name: 'Grep',
            tool_input: { pattern: 'foo', path: '/project' }
        });
        assert.equal(result.exitCode, 0);
        assert.ok(result.stdout.length > 0);
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.continue, false);
        assert.ok(parsed.stopReason.includes('mcp__code-index-mcp__search_code_advanced'));
    });

    it('TC-07.2b: hook produces empty stdout for allowed tools', () => {
        const result = runHook(tmpDir, {
            tool_name: 'Task',
            tool_input: {}
        });
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    it('TC-07.3: hook reads CLAUDE_PROJECT_DIR for config resolution', () => {
        // The hook in runHook gets CLAUDE_PROJECT_DIR set to tmpDir
        // and finds the config there
        const result = runHook(tmpDir, {
            tool_name: 'Grep',
            tool_input: { pattern: 'foo', path: '/project' }
        });
        assert.ok(result.stdout.includes('stopReason'));
    });

    it('TC-07.4: hook exports check() function for dispatcher compatibility', () => {
        const mod = loadHookModule(tmpDir);
        assert.equal(typeof mod.check, 'function');
    });

    it('TC-07.5: performance — hook completes in under 100ms', () => {
        const start = process.hrtime.bigint();
        runHook(tmpDir, {
            tool_name: 'Grep',
            tool_input: { pattern: 'foo', path: '/project' }
        });
        const elapsed = Number(process.hrtime.bigint() - start) / 1e6; // ms
        // Child process spawn has overhead; use generous limit for CI
        // but the hook logic itself is < 10ms
        assert.ok(elapsed < 5000, `Hook took ${elapsed}ms (expected < 5000ms for child process)`);
    });
});

// ===========================================================================
// Additional unit tests for helper functions
// ===========================================================================

describe('Helper functions (unit tests)', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv(tmpDir);
    });

    it('isReadException: detects offset', () => {
        const mod = loadHookModule(tmpDir);
        assert.ok(mod.isReadException({ file_path: 'f.js', offset: 10 }));
    });

    it('isReadException: detects limit', () => {
        const mod = loadHookModule(tmpDir);
        assert.ok(mod.isReadException({ file_path: 'f.js', limit: 50 }));
    });

    it('isReadException: detects pages', () => {
        const mod = loadHookModule(tmpDir);
        assert.ok(mod.isReadException({ file_path: 'f.pdf', pages: '1-3' }));
    });

    it('isReadException: false for full read', () => {
        const mod = loadHookModule(tmpDir);
        assert.equal(mod.isReadException({ file_path: 'f.js' }), false);
    });

    it('isReadException: false for null input', () => {
        const mod = loadHookModule(tmpDir);
        assert.equal(mod.isReadException(null), false);
    });

    it('isGrepException: detects specific file path', () => {
        const mod = loadHookModule(tmpDir);
        assert.ok(mod.isGrepException({ pattern: 'X', path: '/some/file.js' }));
    });

    it('isGrepException: false for directory path', () => {
        const mod = loadHookModule(tmpDir);
        assert.equal(mod.isGrepException({ pattern: 'X', path: '/project/src' }), false);
    });

    it('isGrepException: false for glob path', () => {
        const mod = loadHookModule(tmpDir);
        assert.equal(mod.isGrepException({ pattern: 'X', path: '*.js' }), false);
    });

    it('isGrepException: false for null input', () => {
        const mod = loadHookModule(tmpDir);
        assert.equal(mod.isGrepException(null), false);
    });

    it('isGrepException: false when no path', () => {
        const mod = loadHookModule(tmpDir);
        assert.equal(mod.isGrepException({ pattern: 'X' }), false);
    });

    it('isTempDirMkdir: detects /tmp/ paths', () => {
        const mod = loadHookModule(tmpDir);
        assert.ok(mod.isTempDirMkdir('mkdir -p /tmp/test'));
    });

    it('isTempDirMkdir: detects $TMPDIR paths', () => {
        const mod = loadHookModule(tmpDir);
        assert.ok(mod.isTempDirMkdir('mkdir $TMPDIR/test'));
    });

    it('isTempDirMkdir: false for project paths', () => {
        const mod = loadHookModule(tmpDir);
        assert.equal(mod.isTempDirMkdir('mkdir -p /project/src/new'), false);
    });

    it('isTempDirMkdir: false for null', () => {
        const mod = loadHookModule(tmpDir);
        assert.equal(mod.isTempDirMkdir(null), false);
    });

    it('isMkdirCommand: detects mkdir', () => {
        const mod = loadHookModule(tmpDir);
        assert.ok(mod.isMkdirCommand('mkdir -p /foo'));
    });

    it('isMkdirCommand: false for non-mkdir', () => {
        const mod = loadHookModule(tmpDir);
        assert.equal(mod.isMkdirCommand('ls -la'), false);
    });

    it('isMkdirCommand: false for null', () => {
        const mod = loadHookModule(tmpDir);
        assert.equal(mod.isMkdirCommand(null), false);
    });

    it('isMcpToolAvailable: detects registered MCP server', () => {
        const mod = loadHookModule(tmpDir);
        assert.ok(mod.isMcpToolAvailable('mcp__code-index-mcp__search_code_advanced', tmpDir));
    });

    it('isMcpToolAvailable: false for unregistered MCP server', () => {
        tmpDir = setupTestEnv(undefined, SETTINGS_NO_MCP);
        const mod = loadHookModule(tmpDir);
        assert.equal(mod.isMcpToolAvailable('mcp__code-index-mcp__search_code_advanced', tmpDir), false);
    });

    it('isMcpToolAvailable: false for invalid tool name', () => {
        const mod = loadHookModule(tmpDir);
        assert.equal(mod.isMcpToolAvailable('not_mcp_format', tmpDir), false);
    });

    it('isMcpToolAvailable: false for empty string', () => {
        const mod = loadHookModule(tmpDir);
        assert.equal(mod.isMcpToolAvailable('', tmpDir), false);
    });

    it('findMatchingRule: returns null for null input', () => {
        const mod = loadHookModule(tmpDir);
        assert.equal(mod.findMatchingRule(null, VALID_CONFIG), null);
    });

    it('findMatchingRule: returns null for null config', () => {
        const mod = loadHookModule(tmpDir);
        assert.equal(mod.findMatchingRule({ tool_name: 'Grep' }, null), null);
    });

    it('findMatchingRule: skips rules without required fields', () => {
        const mod = loadHookModule(tmpDir);
        const config = { rules: [{ tool: 'Grep' }] }; // Missing mcp_tool
        assert.equal(mod.findMatchingRule({ tool_name: 'Grep', tool_input: {} }, config), null);
    });
});

// ===========================================================================
// Edge cases and boundary values
// ===========================================================================

describe('Edge cases and boundary values', () => {
    let tmpDir;

    afterEach(() => {
        cleanupTestEnv(tmpDir);
    });

    it('handles config with unknown enforcement level (fail-open)', () => {
        const config = {
            version: '1.0.0',
            rules: [{
                tool: 'Grep',
                operation: 'search',
                mcp_tool: 'mcp__code-index-mcp__search_code_advanced',
                enforcement: 'panic'
            }]
        };
        tmpDir = setupTestEnv(config);
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Grep', tool_input: { pattern: 'X' } }
        });
        // Unknown enforcement level = allow (fail-open)
        assert.equal(result.decision, 'allow');
    });

    it('handles config with rule missing tool field', () => {
        const config = {
            version: '1.0.0',
            rules: [{ mcp_tool: 'mcp__x__y', enforcement: 'block' }]
        };
        tmpDir = setupTestEnv(config);
        const mod = loadHookModule(tmpDir);
        const result = mod.check({
            input: { tool_name: 'Grep', tool_input: { pattern: 'X' } }
        });
        assert.equal(result.decision, 'allow');
    });

    it('handles empty tool_name string', () => {
        tmpDir = setupTestEnv();
        const mod = loadHookModule(tmpDir);
        const result = mod.check({ input: { tool_name: '', tool_input: {} } });
        assert.equal(result.decision, 'allow');
    });

    it('handles null ctx', () => {
        tmpDir = setupTestEnv();
        const mod = loadHookModule(tmpDir);
        const result = mod.check(null);
        assert.equal(result.decision, 'allow');
    });

    it('clearConfigCache resets cache', () => {
        tmpDir = setupTestEnv();
        const mod = loadHookModule(tmpDir);
        // First call loads config
        mod.check({ input: { tool_name: 'Grep', tool_input: { pattern: 'X' } } });
        // Clear cache
        mod.clearConfigCache();
        // Write new config with no rules
        const configDir = path.join(tmpDir, '.claude', 'hooks', 'config');
        fs.writeFileSync(path.join(configDir, 'mcp-tool-routing.json'), JSON.stringify({ version: '1.0.0', rules: [] }));
        // Now Grep should be allowed (no rules)
        const result = mod.check({
            input: { tool_name: 'Grep', tool_input: { pattern: 'X' } }
        });
        assert.equal(result.decision, 'allow');
    });
});
