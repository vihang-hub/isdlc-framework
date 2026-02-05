#!/usr/bin/env node
/**
 * iSDLC Skill Observability - Test Suite (Node.js)
 * =================================================
 * Unit tests for skill-validator.js and log-skill-usage.js hooks
 *
 * Usage: node test-skill-validator.js [--verbose]
 *
 * Version: 3.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');

// Test counters
let passed = 0;
let failed = 0;
const verbose = process.argv.includes('--verbose');

// Colors (works on all platforms with modern terminals)
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m'
};

// =============================================================================
// TEST UTILITIES
// =============================================================================

function log(msg) {
    if (verbose) {
        console.log(`[TEST] ${msg}`);
    }
}

function pass(testName) {
    passed++;
    console.log(`${colors.green}✓${colors.reset} ${testName}`);
}

function fail(testName, expected, actual) {
    failed++;
    console.log(`${colors.red}✗${colors.reset} ${testName}`);
    if (expected !== undefined) {
        console.log(`  Expected: ${expected}`);
    }
    if (actual !== undefined) {
        console.log(`  Actual: ${actual}`);
    }
}

// Create temporary test environment
let testDir = null;

function setupTestEnv() {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdlc-test-'));
    fs.mkdirSync(path.join(testDir, '.isdlc'), { recursive: true });
    fs.mkdirSync(path.join(testDir, '.claude', 'hooks', 'config'), { recursive: true });

    // Copy manifest to .claude/hooks/config/ (where hooks expect it)
    const projectRoot = path.resolve(__dirname, '../../..');
    const manifestSrc = path.join(projectRoot, '.claude', 'hooks', 'config', 'skills-manifest.json');
    if (fs.existsSync(manifestSrc)) {
        fs.copyFileSync(manifestSrc, path.join(testDir, '.claude', 'hooks', 'config', 'skills-manifest.json'));
    }

    // Create test state.json
    const state = {
        skill_enforcement: {
            enabled: true,
            mode: 'strict',
            fail_behavior: 'allow',
            manifest_version: '2.0.0'
        },
        current_phase: '05-implementation',
        skill_usage_log: []
    };
    fs.writeFileSync(path.join(testDir, '.isdlc', 'state.json'), JSON.stringify(state, null, 2));

    process.env.CLAUDE_PROJECT_DIR = testDir;
    log(`Created test environment at ${testDir}`);
}

function cleanupTestEnv() {
    if (testDir && fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
        log('Cleaned up test environment');
    }
    testDir = null;
}

function writeState(state) {
    fs.writeFileSync(path.join(testDir, '.isdlc', 'state.json'), JSON.stringify(state, null, 2));
}

function readState() {
    return JSON.parse(fs.readFileSync(path.join(testDir, '.isdlc', 'state.json'), 'utf8'));
}

// Run a hook with input and return output
function runHook(hookPath, input) {
    return new Promise((resolve, reject) => {
        const child = spawn('node', [hookPath], {
            env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code });
        });

        child.on('error', (err) => {
            reject(err);
        });

        // Write input to stdin
        child.stdin.write(JSON.stringify(input));
        child.stdin.end();
    });
}

// =============================================================================
// COMMON.JS TESTS
// =============================================================================

async function testCommonJs() {
    console.log('\nTesting common.js...');
    console.log('====================');

    setupTestEnv();

    // Import common.js with test environment
    const commonPath = path.resolve(__dirname, '../lib/common.js');

    // Clear require cache to pick up new CLAUDE_PROJECT_DIR
    delete require.cache[require.resolve(commonPath)];
    const common = require(commonPath);

    // Test getProjectRoot
    const root = common.getProjectRoot();
    if (root === testDir) {
        pass('getProjectRoot returns correct path');
    } else {
        fail('getProjectRoot returns correct path', testDir, root);
    }

    // Test that Node.js fs module is available (equivalent to bash's check_jq)
    if (typeof require('fs').existsSync === 'function') {
        pass('Node.js fs module available');
    } else {
        fail('Node.js fs module available');
    }

    // Test readStateValue
    const mode = common.readStateValue('skill_enforcement.mode');
    if (mode === 'strict') {
        pass('readStateValue reads mode correctly');
    } else {
        fail('readStateValue reads mode correctly', 'strict', mode);
    }

    // Test getTimestamp
    const ts = common.getTimestamp();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(ts)) {
        pass('getTimestamp returns ISO format');
    } else {
        fail('getTimestamp returns ISO format', 'YYYY-MM-DDTHH:MM:SS.sssZ', ts);
    }

    // Test normalizeAgentName
    let normalized = common.normalizeAgentName('SOLUTION_ARCHITECT');
    if (normalized === 'solution-architect') {
        pass('normalizeAgentName handles uppercase + underscores');
    } else {
        fail('normalizeAgentName handles uppercase + underscores', 'solution-architect', normalized);
    }

    normalized = common.normalizeAgentName('developer');
    if (normalized === 'software-developer') {
        pass('normalizeAgentName maps shorthand names');
    } else {
        fail('normalizeAgentName maps shorthand names', 'software-developer', normalized);
    }

    normalized = common.normalizeAgentName('sdlc-orchestrator');
    if (normalized === 'sdlc-orchestrator') {
        pass('normalizeAgentName preserves correct names');
    } else {
        fail('normalizeAgentName preserves correct names', 'sdlc-orchestrator', normalized);
    }

    cleanupTestEnv();
}

// =============================================================================
// SKILL-VALIDATOR.JS TESTS
// =============================================================================

async function testSkillValidator() {
    console.log('\nTesting skill-validator.js...');
    console.log('==============================');

    const hookPath = path.resolve(__dirname, '../skill-validator.js');

    // Test 1: Non-Task tool should be allowed
    setupTestEnv();
    let result = await runHook(hookPath, { tool_name: 'Read', tool_input: { path: '/some/file' } });
    if (result.stdout === '') {
        pass('Non-Task tool calls are allowed (no output)');
    } else {
        fail('Non-Task tool calls are allowed', 'empty output', result.stdout);
    }
    cleanupTestEnv();

    // Test 2: Task tool with matching phase agent should be allowed
    setupTestEnv();
    result = await runHook(hookPath, {
        tool_name: 'Task',
        tool_input: { subagent_type: 'software-developer', description: 'Test' }
    });
    if (result.stdout === '') {
        pass('software-developer allowed in 05-implementation phase');
    } else {
        fail('software-developer allowed in 05-implementation phase', 'empty output', result.stdout);
    }
    cleanupTestEnv();

    // Test 3: Orchestrator should always be allowed
    setupTestEnv();
    result = await runHook(hookPath, {
        tool_name: 'Task',
        tool_input: { subagent_type: 'sdlc-orchestrator', description: 'Test' }
    });
    if (result.stdout === '') {
        pass('sdlc-orchestrator always allowed (phase=all)');
    } else {
        fail('sdlc-orchestrator always allowed', 'empty output', result.stdout);
    }
    cleanupTestEnv();

    // Test 4: Cross-phase agent is observed but allowed (observability mode)
    setupTestEnv();
    result = await runHook(hookPath, {
        tool_name: 'Task',
        tool_input: { subagent_type: 'requirements-analyst', description: 'Test' }
    });
    if (result.stdout === '') {
        pass('requirements-analyst allowed in 05-implementation phase (observability — no blocking)');
    } else {
        fail('requirements-analyst allowed in 05-implementation phase (observability)', 'empty output', result.stdout);
    }
    cleanupTestEnv();

    // Test 5: Warn mode should allow
    setupTestEnv();
    writeState({
        skill_enforcement: { enabled: true, mode: 'warn', fail_behavior: 'allow', manifest_version: '2.0.0' },
        current_phase: '05-implementation',
        skill_usage_log: []
    });
    result = await runHook(hookPath, {
        tool_name: 'Task',
        tool_input: { subagent_type: 'requirements-analyst', description: 'Test' }
    });
    if (result.stdout === '') {
        pass('requirements-analyst allowed in warn mode');
    } else {
        fail('requirements-analyst allowed in warn mode', 'empty output', result.stdout);
    }
    cleanupTestEnv();

    // Test 6: Audit mode should allow
    setupTestEnv();
    writeState({
        skill_enforcement: { enabled: true, mode: 'audit', fail_behavior: 'allow', manifest_version: '2.0.0' },
        current_phase: '05-implementation',
        skill_usage_log: []
    });
    result = await runHook(hookPath, {
        tool_name: 'Task',
        tool_input: { subagent_type: 'requirements-analyst', description: 'Test' }
    });
    if (result.stdout === '') {
        pass('requirements-analyst allowed in audit mode');
    } else {
        fail('requirements-analyst allowed in audit mode', 'empty output', result.stdout);
    }
    cleanupTestEnv();

    // Test 7: Disabled enforcement should allow everything
    setupTestEnv();
    writeState({
        skill_enforcement: { enabled: false, mode: 'strict', fail_behavior: 'allow', manifest_version: '2.0.0' },
        current_phase: '05-implementation',
        skill_usage_log: []
    });
    result = await runHook(hookPath, {
        tool_name: 'Task',
        tool_input: { subagent_type: 'requirements-analyst', description: 'Test' }
    });
    if (result.stdout === '') {
        pass('All agents allowed when enforcement disabled');
    } else {
        fail('All agents allowed when enforcement disabled', 'empty output', result.stdout);
    }
    cleanupTestEnv();

    // Test 8: Observe mode should allow cross-phase agents
    setupTestEnv();
    writeState({
        skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '3.0.0' },
        current_phase: '05-implementation',
        skill_usage_log: []
    });
    result = await runHook(hookPath, {
        tool_name: 'Task',
        tool_input: { subagent_type: 'requirements-analyst', description: 'Test' }
    });
    if (result.stdout === '') {
        pass('requirements-analyst allowed in observe mode');
    } else {
        fail('requirements-analyst allowed in observe mode', 'empty output', result.stdout);
    }
    cleanupTestEnv();
}

// =============================================================================
// LOG-SKILL-USAGE.JS TESTS
// =============================================================================

async function testLogSkillUsage() {
    console.log('\nTesting log-skill-usage.js...');
    console.log('==============================');

    const hookPath = path.resolve(__dirname, '../log-skill-usage.js');

    // Test 1: Task tool should be logged
    setupTestEnv();
    await runHook(hookPath, {
        tool_name: 'Task',
        tool_input: { subagent_type: 'software-developer', description: 'Test task' }
    });

    let state = readState();
    if (state.skill_usage_log.length === 1) {
        pass('Task tool usage logged to state.json');
    } else {
        fail('Task tool usage logged to state.json', '1 entry', `${state.skill_usage_log.length} entries`);
    }

    // Verify log entry contents
    if (state.skill_usage_log[0].agent === 'software-developer') {
        pass('Log entry contains correct agent name');
    } else {
        fail('Log entry contains correct agent name', 'software-developer', state.skill_usage_log[0].agent);
    }
    cleanupTestEnv();

    // Test 2: Non-Task tool should not be logged
    setupTestEnv();
    await runHook(hookPath, {
        tool_name: 'Read',
        tool_input: { path: '/some/file' }
    });

    state = readState();
    if (state.skill_usage_log.length === 0) {
        pass('Non-Task tool not logged (count unchanged)');
    } else {
        fail('Non-Task tool not logged', '0 entries', `${state.skill_usage_log.length} entries`);
    }
    cleanupTestEnv();

    // Test 3: Multiple calls accumulate
    setupTestEnv();
    await runHook(hookPath, {
        tool_name: 'Task',
        tool_input: { subagent_type: 'software-developer', description: 'First task' }
    });
    await runHook(hookPath, {
        tool_name: 'Task',
        tool_input: { subagent_type: 'qa-engineer', description: 'Second task' }
    });

    state = readState();
    if (state.skill_usage_log.length === 2) {
        pass('Multiple Task calls accumulate in log');
    } else {
        fail('Multiple Task calls accumulate in log', '2 entries', `${state.skill_usage_log.length} entries`);
    }
    cleanupTestEnv();
}

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

async function testIntegration() {
    console.log('\nTesting Integration...');
    console.log('======================');

    const validatorPath = path.resolve(__dirname, '../skill-validator.js');
    const loggerPath = path.resolve(__dirname, '../log-skill-usage.js');

    // Use 06-implementation to match software-developer's manifest phase
    setupTestEnv();
    writeState({
        skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '3.0.0' },
        current_phase: '06-implementation',
        skill_usage_log: []
    });

    // Test: Full flow - same-phase agent
    const input = {
        tool_name: 'Task',
        tool_input: { subagent_type: 'software-developer', description: 'Implement feature' }
    };

    // Run validator
    const validatorResult = await runHook(validatorPath, input);

    if (validatorResult.stdout === '') {
        // Run logger
        await runHook(loggerPath, input);

        const state = readState();
        if (state.skill_usage_log.length > 0 && state.skill_usage_log[0].status === 'executed') {
            pass('Integration: allowed agent validated and logged correctly');
        } else {
            fail('Integration: allowed agent logged with correct status', 'executed', state.skill_usage_log[0]?.status);
        }
    } else {
        fail('Integration: allowed agent should pass validation', 'empty output', validatorResult.stdout);
    }

    cleanupTestEnv();
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
    console.log('==================================');
    console.log('iSDLC Skill Enforcement Test Suite');
    console.log('(Node.js - Cross-Platform)');
    console.log('==================================');

    try {
        await testCommonJs();
        await testSkillValidator();
        await testLogSkillUsage();
        await testIntegration();
    } catch (error) {
        console.error(`${colors.red}Test error:${colors.reset}`, error);
        process.exit(1);
    }

    // Summary
    console.log('\n==================================');
    console.log('Test Results');
    console.log('==================================');
    console.log(`Passed: ${colors.green}${passed}${colors.reset}`);
    console.log(`Failed: ${colors.red}${failed}${colors.reset}`);

    if (failed === 0) {
        console.log(`${colors.green}All tests passed!${colors.reset}`);
        process.exit(0);
    } else {
        console.log(`${colors.red}Some tests failed.${colors.reset}`);
        process.exit(1);
    }
}

main();
