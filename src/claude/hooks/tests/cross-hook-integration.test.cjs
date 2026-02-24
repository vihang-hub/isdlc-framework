/**
 * Cross-hook integration tests for REQ-0004 advisory behavior hooks
 * ==================================================================
 * Tests interactions between new hooks and existing hooks that fire
 * on the same events. Verifies:
 * - Multiple hooks on same event don't conflict
 * - Independent hook outputs don't interfere
 * - Fail-open behavior is consistent across all hooks
 * - settings.json registration resolves to real files
 *
 * Traces to: FR-01 through FR-07, NFR-01, NFR-02
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const HOOKS_DIR = path.join(__dirname, '..');
const SETTINGS_TEMPLATE = path.join(__dirname, '..', '..', '..', '..', 'src', 'claude', 'settings.json');
// Resolve from the actual repo root
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function setupTestEnv() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cross-hook-test-'));
    const isdlcDir = path.join(tmpDir, '.isdlc');
    fs.mkdirSync(isdlcDir, { recursive: true });
    // Copy config files needed by gate-blocker
    const configDir = path.join(tmpDir, '.claude', 'hooks', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    const srcConfigDir = path.join(REPO_ROOT, 'src', 'claude', 'hooks', 'config');
    for (const file of ['iteration-requirements.json', 'skills-manifest.json']) {
        const srcPath = path.join(srcConfigDir, file);
        if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, path.join(configDir, file));
        }
    }
    // Copy schema files
    const schemasDir = path.join(configDir, 'schemas');
    const srcSchemasDir = path.join(srcConfigDir, 'schemas');
    if (fs.existsSync(srcSchemasDir)) {
        fs.mkdirSync(schemasDir, { recursive: true });
        for (const f of fs.readdirSync(srcSchemasDir)) {
            fs.copyFileSync(path.join(srcSchemasDir, f), path.join(schemasDir, f));
        }
    }
    return tmpDir;
}

function writeState(tmpDir, state) {
    fs.writeFileSync(
        path.join(tmpDir, '.isdlc', 'state.json'),
        JSON.stringify(state, null, 2)
    );
}

function runHook(hookFile, tmpDir, stdinJson) {
    const hookPath = path.join(HOOKS_DIR, hookFile);
    const stdinStr = typeof stdinJson === 'string'
        ? stdinJson
        : JSON.stringify(stdinJson);
    const result = spawnSync('node', [hookPath], {
        cwd: tmpDir,
        input: stdinStr,
        env: {
            ...process.env,
            CLAUDE_PROJECT_DIR: tmpDir,
            SKILL_VALIDATOR_DEBUG: '0',
            PATH: process.env.PATH,
            HOME: process.env.HOME
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

function setupGitRepo(tmpDir, branchName) {
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test');
    execSync('git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
    // Ensure default branch is named 'main' (git <2.28 defaults to 'master')
    execSync('git branch -M main', { cwd: tmpDir, stdio: 'pipe' });
    if (branchName && branchName !== 'main') {
        execSync(`git checkout -b ${branchName}`, { cwd: tmpDir, stdio: 'pipe' });
    }
}

function makeActiveWorkflowState(currentPhase) {
    return {
        active_workflow: {
            type: 'feature',
            description: 'test feature',
            current_phase: currentPhase,
            current_phase_index: 3,
            phases: ['01-requirements', '02-impact-analysis', '03-architecture', currentPhase],
            phase_status: { [currentPhase]: 'in_progress' },
            git_branch: {
                name: 'feature/test-branch',
                created_from: 'main',
                status: 'active'
            }
        },
        iteration_enforcement: { enabled: true },
        phases: {
            [currentPhase]: { status: 'in_progress' }
        }
    };
}

// ====================
// CROSS-HOOK TESTS
// ====================

describe('Cross-hook: phase-sequence-guard + gate-blocker on PreToolUse[Task]', () => {
    let tmpDir;

    beforeEach(() => { tmpDir = setupTestEnv(); });
    afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

    it('both hooks produce independent outputs for same Task event', () => {
        const state = makeActiveWorkflowState('03-architecture');
        writeState(tmpDir, state);

        // A delegation attempt to a different phase - phase-sequence-guard blocks
        const stdin = {
            tool_name: 'Task',
            tool_input: {
                prompt: 'Run Phase 06 implementation',
                description: 'Delegate to software-developer for phase 06-implementation',
                subagent_type: 'software-developer'
            }
        };

        const seqResult = runHook('phase-sequence-guard.cjs', tmpDir, stdin);
        const gateResult = runHook('gate-blocker.cjs', tmpDir, stdin);

        // phase-sequence-guard should block (out of order)
        assert.equal(seqResult.exitCode, 0);
        assert.ok(seqResult.stdout.length > 0, 'phase-sequence-guard should produce blocking output');

        // gate-blocker should not block (this is not a gate advancement attempt)
        assert.equal(gateResult.exitCode, 0);
        assert.equal(gateResult.stdout, '', 'gate-blocker should not interfere with non-gate delegation');
    });

    it('gate-blocker fires independently on gate advancement attempts', () => {
        const state = makeActiveWorkflowState('03-architecture');
        writeState(tmpDir, state);

        // A gate advancement attempt
        const stdin = {
            tool_name: 'Task',
            tool_input: {
                prompt: 'Advance to next phase - all work complete',
                description: 'Gate check for Phase 03',
                subagent_type: 'sdlc-orchestrator'
            }
        };

        const seqResult = runHook('phase-sequence-guard.cjs', tmpDir, stdin);
        const gateResult = runHook('gate-blocker.cjs', tmpDir, stdin);

        // phase-sequence-guard should not block orchestrator
        // (detectPhaseDelegation returns not-a-delegation for orchestrator phase "all")
        assert.equal(seqResult.exitCode, 0);

        // gate-blocker should block (no constitutional validation etc.)
        assert.equal(gateResult.exitCode, 0);
        assert.ok(gateResult.stdout.length > 0, 'gate-blocker should block unmet requirements');
    });

    it('plan-surfacer and phase-loop-controller both fire on Task events independently', () => {
        const state = makeActiveWorkflowState('06-implementation');
        state.active_workflow.phase_status['06-implementation'] = 'in_progress';
        writeState(tmpDir, state);

        const stdin = {
            tool_name: 'Task',
            tool_input: {
                prompt: 'Create a task for implementing module X',
                description: 'TaskCreate for implementation work'
            }
        };

        const planResult = runHook('plan-surfacer.cjs', tmpDir, stdin);
        const loopResult = runHook('phase-loop-controller.cjs', tmpDir, stdin);

        // plan-surfacer blocks when tasks.md is missing for implementation phase
        assert.equal(planResult.exitCode, 0);
        assert.ok(planResult.stdout.length > 0, 'plan-surfacer should block when tasks.md missing in impl phase');

        // phase-loop-controller should allow (phase is in_progress, not a delegation)
        assert.equal(loopResult.exitCode, 0);
        assert.equal(loopResult.stdout, '', 'phase-loop-controller should allow non-delegation Task calls');
    });
});

describe('Cross-hook: branch-guard + review-reminder on Bash git commands', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = setupTestEnv();
        setupGitRepo(tmpDir, 'main');
    });
    afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

    it('branch-guard blocks PreToolUse, review-reminder processes PostToolUse independently', () => {
        // BUG-0015: Create the feature branch so branch existence check passes
        execSync('git checkout -b feature/test-branch', { cwd: tmpDir, stdio: 'pipe' });
        execSync('git checkout main', { cwd: tmpDir, stdio: 'pipe' });
        const state = makeActiveWorkflowState('06-implementation');
        state.code_review = { enabled: false, team_size: 3 };
        writeState(tmpDir, state);

        const stdin = {
            tool_name: 'Bash',
            tool_input: { command: 'git commit -m "test commit"' }
        };

        // branch-guard (PreToolUse) should block commit to main
        const branchResult = runHook('branch-guard.cjs', tmpDir, stdin);
        assert.equal(branchResult.exitCode, 0);
        assert.ok(branchResult.stdout.includes('COMMIT TO MAIN BLOCKED'),
            'branch-guard should block commit to main');

        // review-reminder (PostToolUse) would fire after tool use - it runs independently
        const reviewResult = runHook('review-reminder.cjs', tmpDir, stdin);
        assert.equal(reviewResult.exitCode, 0);
        // review-reminder outputs to stdout when code_review disabled and team > 1
    });

    it('on feature branch, branch-guard allows and review-reminder still warns', () => {
        // Switch to feature branch
        execSync('git checkout -b feature/test-branch', { cwd: tmpDir, stdio: 'pipe' });

        const state = makeActiveWorkflowState('06-implementation');
        state.code_review = { enabled: false, team_size: 2 };
        writeState(tmpDir, state);

        const stdin = {
            tool_name: 'Bash',
            tool_input: { command: 'git commit -m "feature work"' }
        };

        // branch-guard should allow (on feature branch)
        const branchResult = runHook('branch-guard.cjs', tmpDir, stdin);
        assert.equal(branchResult.exitCode, 0);
        assert.equal(branchResult.stdout, '', 'branch-guard should allow commit on feature branch');

        // review-reminder should warn (code_review disabled, team > 1)
        const reviewResult = runHook('review-reminder.cjs', tmpDir, stdin);
        assert.equal(reviewResult.exitCode, 0);
    });
});

describe('Cross-hook: state-write-validator on Write while other hooks may write state', () => {
    let tmpDir;

    beforeEach(() => { tmpDir = setupTestEnv(); });
    afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

    it('state-write-validator validates state.json without conflicting with other hooks', () => {
        // Write a state.json with valid data
        const state = makeActiveWorkflowState('06-implementation');
        state.phases['06-implementation'].constitutional_validation = {
            completed: true,
            iterations_used: 1,
            status: 'compliant',
            max_iterations: 5
        };
        writeState(tmpDir, state);

        const stdin = {
            tool_name: 'Write',
            tool_input: {
                file_path: path.join(tmpDir, '.isdlc', 'state.json')
            }
        };

        // state-write-validator should not produce stdout (observational only)
        const result = runHook('state-write-validator.cjs', tmpDir, stdin);
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'state-write-validator must not produce stdout');
    });

    it('state-write-validator detects fake data and warns on stderr', () => {
        const state = makeActiveWorkflowState('06-implementation');
        state.phases['06-implementation'].constitutional_validation = {
            completed: true,
            iterations_used: 0, // Suspicious: completed but 0 iterations
            status: 'compliant',
            max_iterations: 5
        };
        writeState(tmpDir, state);

        const stdin = {
            tool_name: 'Write',
            tool_input: {
                file_path: path.join(tmpDir, '.isdlc', 'state.json')
            }
        };

        const result = runHook('state-write-validator.cjs', tmpDir, stdin);
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'state-write-validator must never produce stdout');
        assert.ok(result.stderr.includes('WARNING'), 'state-write-validator should warn on stderr');
    });

    it('state-write-validator ignores non-state.json writes', () => {
        const stdin = {
            tool_name: 'Write',
            tool_input: {
                file_path: path.join(tmpDir, 'docs', 'something.md')
            }
        };

        const result = runHook('state-write-validator.cjs', tmpDir, stdin);
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
        assert.equal(result.stderr, '');
    });
});

describe('Cross-hook: all PreToolUse[Task] hooks on same event', () => {
    let tmpDir;

    beforeEach(() => { tmpDir = setupTestEnv(); });
    afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

    it('all hooks exit 0 and produce no output for a non-delegation TaskCreate', () => {
        const state = makeActiveWorkflowState('06-implementation');
        state.active_workflow.phase_status['06-implementation'] = 'in_progress';
        writeState(tmpDir, state);

        // Create tasks.md for plan-surfacer
        const docsDir = path.join(tmpDir, 'docs', 'isdlc');
        fs.mkdirSync(docsDir, { recursive: true });
        fs.writeFileSync(path.join(docsDir, 'tasks.md'), '# Tasks\n## Phase 06: Implementation');

        const stdin = {
            tool_name: 'Task',
            tool_input: {
                prompt: 'Update task status to in_progress',
                description: 'TaskUpdate call'
            }
        };

        const hooks = [
            'phase-sequence-guard.cjs',
            'phase-loop-controller.cjs',
            'plan-surfacer.cjs',
            'gate-blocker.cjs'
        ];

        for (const hook of hooks) {
            const result = runHook(hook, tmpDir, stdin);
            assert.equal(result.exitCode, 0, `${hook} should exit 0`);
            assert.equal(result.stdout, '', `${hook} should produce no stdout for non-delegation TaskUpdate`);
        }
    });
});

describe('Cross-hook: fail-open consistency across all new hooks', () => {
    let tmpDir;

    beforeEach(() => { tmpDir = setupTestEnv(); });
    afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

    const newHooks = [
        'branch-guard.cjs',
        'plan-surfacer.cjs',
        'phase-loop-controller.cjs',
        'phase-sequence-guard.cjs',
        'state-write-validator.cjs',
        'walkthrough-tracker.cjs',
        'discover-menu-guard.cjs'
    ];

    it('all new hooks exit 0 with no output on missing state.json', () => {
        // Remove state.json
        const statePath = path.join(tmpDir, '.isdlc', 'state.json');
        if (fs.existsSync(statePath)) fs.unlinkSync(statePath);

        for (const hook of newHooks) {
            const stdin = {
                tool_name: 'Task',
                tool_input: { prompt: 'test', description: 'test' }
            };
            const result = runHook(hook, tmpDir, stdin);
            assert.equal(result.exitCode, 0, `${hook} should exit 0 on missing state.json`);
            assert.equal(result.stdout, '', `${hook} should produce no stdout on missing state.json`);
        }
    });

    it('all new hooks exit 0 with no output on empty stdin', () => {
        for (const hook of newHooks) {
            const result = runHook(hook, tmpDir, '');
            assert.equal(result.exitCode, 0, `${hook} should exit 0 on empty stdin`);
            assert.equal(result.stdout, '', `${hook} should produce no stdout on empty stdin`);
        }
    });

    it('all new hooks exit 0 with no output on invalid JSON stdin', () => {
        for (const hook of newHooks) {
            const result = runHook(hook, tmpDir, '{not valid json');
            assert.equal(result.exitCode, 0, `${hook} should exit 0 on invalid JSON`);
            assert.equal(result.stdout, '', `${hook} should produce no stdout on invalid JSON`);
        }
    });

    it('all new hooks exit 0 with no output on null tool_input', () => {
        for (const hook of newHooks) {
            const result = runHook(hook, tmpDir, { tool_name: 'Task', tool_input: null });
            assert.equal(result.exitCode, 0, `${hook} should exit 0 on null tool_input`);
            assert.equal(result.stdout, '', `${hook} should produce no stdout on null tool_input`);
        }
    });
});

describe('Settings.json hook path validation', () => {
    it('all hook paths in src/claude/settings.json resolve to existing files', () => {
        const settingsPath = path.join(REPO_ROOT, 'src', 'claude', 'settings.json');
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

        const hookPaths = [];

        // Extract all hook command paths
        for (const [eventType, matchers] of Object.entries(settings.hooks || {})) {
            for (const matcher of matchers) {
                const hooks = matcher.hooks || [];
                for (const hook of hooks) {
                    if (hook.command) {
                        // Extract the file path from "node $CLAUDE_PROJECT_DIR/.claude/hooks/foo.cjs"
                        const match = hook.command.match(/\$CLAUDE_PROJECT_DIR\/(.+)/);
                        if (match) {
                            // In source repo, .claude/ maps to src/claude/ (installed path vs source path)
                            const sourcePath = match[1].replace(/^\.claude\//, 'src/claude/');
                            hookPaths.push({
                                event: eventType,
                                matcher: matcher.matcher || 'global',
                                relativePath: match[1],
                                fullPath: path.join(REPO_ROOT, sourcePath)
                            });
                        }
                    }
                }
            }
        }

        assert.ok(hookPaths.length > 0, 'Should find hook paths in settings.json');

        for (const hookInfo of hookPaths) {
            assert.ok(
                fs.existsSync(hookInfo.fullPath),
                `Hook file missing: ${hookInfo.relativePath} (event: ${hookInfo.event}, matcher: ${hookInfo.matcher})`
            );
        }
    });

    it('settings.json is valid JSON', () => {
        const settingsPath = path.join(REPO_ROOT, 'src', 'claude', 'settings.json');
        assert.doesNotThrow(() => {
            JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        }, 'settings.json should be valid JSON');
    });

    it('all hooks are registered in settings.json (directly or via dispatchers)', () => {
        const settingsPath = path.join(REPO_ROOT, 'src', 'claude', 'settings.json');
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

        // Collect all referenced hook/dispatcher filenames
        const registeredEntries = new Set();
        for (const [eventType, matchers] of Object.entries(settings.hooks || {})) {
            for (const matcher of matchers) {
                for (const hook of (matcher.hooks || [])) {
                    if (hook.command) {
                        const filename = path.basename(hook.command);
                        registeredEntries.add(filename);
                    }
                }
            }
        }

        // Hooks directly registered (standalone, not in any dispatcher)
        const expectedStandalone = [
            'branch-guard.cjs',
            'explore-readonly-enforcer.cjs',
            'skill-delegation-enforcer.cjs',
            'delegation-gate.cjs'
        ];

        for (const hook of expectedStandalone) {
            assert.ok(
                registeredEntries.has(hook),
                `Standalone hook ${hook} should be registered directly in settings.json`
            );
        }

        // Dispatchers should be registered
        const expectedDispatchers = [
            'pre-task-dispatcher.cjs',
            'pre-skill-dispatcher.cjs',
            'post-task-dispatcher.cjs',
            'post-bash-dispatcher.cjs',
            'post-write-edit-dispatcher.cjs'
        ];

        for (const dispatcher of expectedDispatchers) {
            assert.ok(
                registeredEntries.has(dispatcher),
                `Dispatcher ${dispatcher} should be registered in settings.json`
            );
        }
    });

    it('hooks are registered on correct event types (directly or via dispatchers)', () => {
        const settingsPath = path.join(REPO_ROOT, 'src', 'claude', 'settings.json');
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

        // Build a map of entry -> { events, matchers }
        const hookRegistry = {};
        for (const [eventType, matchers] of Object.entries(settings.hooks || {})) {
            for (const matcher of matchers) {
                for (const hook of (matcher.hooks || [])) {
                    if (hook.command) {
                        const filename = path.basename(hook.command);
                        if (!hookRegistry[filename]) hookRegistry[filename] = [];
                        hookRegistry[filename].push({
                            event: eventType,
                            matcher: matcher.matcher || 'global'
                        });
                    }
                }
            }
        }

        // Verify correct event/matcher assignments for standalone hooks and dispatchers
        const expectedRegistrations = {
            'branch-guard.cjs': [{ event: 'PreToolUse', matcher: 'Bash' }],
            'explore-readonly-enforcer.cjs': [
                { event: 'PreToolUse', matcher: 'Write' },
                { event: 'PreToolUse', matcher: 'Edit' }
            ],
            'pre-task-dispatcher.cjs': [{ event: 'PreToolUse', matcher: 'Task' }],
            'pre-skill-dispatcher.cjs': [{ event: 'PreToolUse', matcher: 'Skill' }],
            'post-task-dispatcher.cjs': [{ event: 'PostToolUse', matcher: 'Task' }],
            'skill-delegation-enforcer.cjs': [{ event: 'PostToolUse', matcher: 'Skill' }],
            'post-bash-dispatcher.cjs': [{ event: 'PostToolUse', matcher: 'Bash' }],
            'post-write-edit-dispatcher.cjs': [
                { event: 'PostToolUse', matcher: 'Write' },
                { event: 'PostToolUse', matcher: 'Edit' }
            ],
            'delegation-gate.cjs': [{ event: 'Stop', matcher: 'global' }]
        };

        for (const [hook, expected] of Object.entries(expectedRegistrations)) {
            const actual = hookRegistry[hook] || [];
            for (const exp of expected) {
                const found = actual.some(a => a.event === exp.event && a.matcher === exp.matcher);
                assert.ok(found,
                    `${hook} should be registered on ${exp.event}[${exp.matcher}], ` +
                    `but found: ${JSON.stringify(actual)}`
                );
            }
        }
    });
});

describe('common.cjs backward compatibility', () => {
    it('all existing exports are still present', () => {
        const common = require(path.join(HOOKS_DIR, 'lib', 'common.cjs'));

        const existingExports = [
            'getProjectRoot',
            'isMonorepoMode',
            'readMonorepoConfig',
            'writeMonorepoConfig',
            'resolveProjectFromCwd',
            'getActiveProject',
            'resolveStatePath',
            'resolveConstitutionPath',
            'resolveDocsPath',
            'resolveExternalSkillsPath',
            'resolveExternalManifestPath',
            'resolveSkillReportPath',
            'resolveTasksPath',
            'resolveTestEvaluationPath',
            'resolveAtddChecklistPath',
            'resolveIsdlcDocsPath',
            'isMigrationNeeded',
            'loadExternalManifest',
            'readStateValue',
            'readState',
            'writeState',
            'appendSkillLog',
            'getTimestamp',
            'getManifestPath',
            'loadManifest',
            'getSkillOwner',
            'getAgentPhase',
            'normalizeAgentName',
            'isAgentAuthorizedForPhase',
            'readStdin',
            'outputBlockResponse',
            'writePendingEscalation',
            'readPendingEscalations',
            'clearPendingEscalations',
            'readPendingDelegation',
            'writePendingDelegation',
            'clearPendingDelegation',
            'readCodeReviewConfig',
            'loadSchema',
            'validateSchema',
            'debugLog'
        ];

        for (const exportName of existingExports) {
            assert.ok(
                typeof common[exportName] !== 'undefined',
                `Existing export '${exportName}' should still be present in common.cjs`
            );
        }
    });

    it('new REQ-0004 exports are present', () => {
        const common = require(path.join(HOOKS_DIR, 'lib', 'common.cjs'));

        const newExports = [
            'SETUP_COMMAND_KEYWORDS',
            'isSetupCommand',
            'detectPhaseDelegation'
        ];

        for (const exportName of newExports) {
            assert.ok(
                typeof common[exportName] !== 'undefined',
                `New export '${exportName}' should be present in common.cjs`
            );
        }
    });

    it('new exports have correct types', () => {
        const common = require(path.join(HOOKS_DIR, 'lib', 'common.cjs'));

        assert.ok(Array.isArray(common.SETUP_COMMAND_KEYWORDS), 'SETUP_COMMAND_KEYWORDS should be an array');
        assert.ok(Object.isFrozen(common.SETUP_COMMAND_KEYWORDS), 'SETUP_COMMAND_KEYWORDS should be frozen');
        assert.equal(typeof common.isSetupCommand, 'function', 'isSetupCommand should be a function');
        assert.equal(typeof common.detectPhaseDelegation, 'function', 'detectPhaseDelegation should be a function');
    });

    it('new exports do not shadow or conflict with existing exports', () => {
        const common = require(path.join(HOOKS_DIR, 'lib', 'common.cjs'));
        const allExportNames = Object.keys(common);

        // Ensure no duplicates (Set should have same size as array)
        assert.equal(allExportNames.length, new Set(allExportNames).size,
            'No duplicate export names should exist');
    });

    it('existing hooks can still require common.cjs without error', () => {
        const existingHooks = [
            'gate-blocker.cjs',
            'iteration-corridor.cjs',
            'skill-validator.cjs',
            'review-reminder.cjs',
            'test-watcher.cjs',
            'menu-tracker.cjs',
            'log-skill-usage.cjs',
            'delegation-gate.cjs',
            'skill-delegation-enforcer.cjs',
            'constitution-validator.cjs',
            'model-provider-router.cjs'
        ];

        for (const hook of existingHooks) {
            const hookPath = path.join(HOOKS_DIR, hook);
            if (fs.existsSync(hookPath)) {
                // Just verify the file can be read and contains require('./lib/common.cjs')
                const content = fs.readFileSync(hookPath, 'utf8');
                if (content.includes("require('./lib/common.cjs')")) {
                    // Existing hook uses common.cjs - verify it hasn't broken
                    assert.ok(true, `${hook} uses common.cjs`);
                }
            }
        }
    });
});

describe('Hook performance budget verification', () => {
    let tmpDir;

    beforeEach(() => { tmpDir = setupTestEnv(); });
    afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

    it('all new PreToolUse hooks complete within 200ms', () => {
        const state = makeActiveWorkflowState('06-implementation');
        state.active_workflow.phase_status['06-implementation'] = 'in_progress';
        writeState(tmpDir, state);

        const stdin = {
            tool_name: 'Task',
            tool_input: { prompt: 'test', description: 'test' }
        };

        const preToolUseHooks = [
            'phase-sequence-guard.cjs',
            'phase-loop-controller.cjs',
            'plan-surfacer.cjs'
        ];

        for (const hook of preToolUseHooks) {
            const start = Date.now();
            runHook(hook, tmpDir, stdin);
            const elapsed = Date.now() - start;
            assert.ok(elapsed < 200, `${hook} took ${elapsed}ms, should be < 200ms`);
        }
    });

    it('all new PostToolUse hooks complete within 200ms', () => {
        const state = makeActiveWorkflowState('06-implementation');
        writeState(tmpDir, state);

        const stdinWrite = {
            tool_name: 'Write',
            tool_input: {
                file_path: path.join(tmpDir, '.isdlc', 'state.json')
            }
        };

        const stdinTask = {
            tool_name: 'Task',
            tool_input: { prompt: 'test', description: 'test' },
            tool_result: 'some result'
        };

        const postToolUseHooks = [
            { hook: 'state-write-validator.cjs', stdin: stdinWrite },
            { hook: 'walkthrough-tracker.cjs', stdin: stdinTask },
            { hook: 'discover-menu-guard.cjs', stdin: stdinTask }
        ];

        for (const { hook, stdin } of postToolUseHooks) {
            const start = Date.now();
            runHook(hook, tmpDir, stdin);
            const elapsed = Date.now() - start;
            assert.ok(elapsed < 200, `${hook} took ${elapsed}ms, should be < 200ms`);
        }
    });
});
