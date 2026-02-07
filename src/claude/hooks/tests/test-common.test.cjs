'use strict';

/**
 * iSDLC Common Utilities - Test Suite (CJS)
 * ==========================================
 * Unit tests for src/claude/hooks/lib/common.js
 *
 * Uses node:test (built-in) and .cjs extension to avoid ESM/CJS conflicts.
 * The hook libs use CommonJS require() but package.json has "type": "module".
 * We copy common.js to the temp dir as common.cjs so Node treats it as CJS.
 *
 * Run: node --test src/claude/hooks/tests/test-common.test.cjs
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
    setupTestEnv,
    cleanupTestEnv,
    getTestDir,
    writeState,
    readState,
    writeConfig
} = require('./hook-test-utils.cjs');

// Source path for common.js
const commonSrcPath = path.resolve(__dirname, '..', 'lib', 'common.js');

/**
 * Copy common.js into the temp test directory as common.cjs so we can require()
 * it without ESM interference from the project-level package.json.
 * Returns the path to the .cjs copy.
 */
function installCommonCjs() {
    const testDir = getTestDir();
    const libDir = path.join(testDir, 'lib');
    if (!fs.existsSync(libDir)) {
        fs.mkdirSync(libDir, { recursive: true });
    }
    const dest = path.join(libDir, 'common.cjs');
    fs.copyFileSync(commonSrcPath, dest);
    return dest;
}

/** Require common.cjs from the temp dir, clearing cache first. */
function requireCommon(cjsPath) {
    delete require.cache[require.resolve(cjsPath)];
    return require(cjsPath);
}

// =============================================================================
// Test Suite: common.js
// =============================================================================

describe('common.js', () => {
    let common;
    let savedEnv;
    let commonCjsPath;

    before(() => {
        savedEnv = { ...process.env };
        setupTestEnv();
        commonCjsPath = installCommonCjs();
        common = requireCommon(commonCjsPath);
    });

    after(() => {
        cleanupTestEnv();
        // Restore env
        process.env = savedEnv;
    });

    /** Helper to get a fresh require of common after env/file changes. */
    function freshCommon() {
        return requireCommon(commonCjsPath);
    }

    // -------------------------------------------------------------------------
    // getProjectRoot()
    // -------------------------------------------------------------------------
    describe('getProjectRoot()', () => {
        it('returns CLAUDE_PROJECT_DIR when env var is set', () => {
            const root = common.getProjectRoot();
            assert.equal(root, process.env.CLAUDE_PROJECT_DIR);
        });

        it('returns value that matches the temp test directory', () => {
            const root = common.getProjectRoot();
            const testDir = getTestDir();
            assert.ok(
                root.includes(testDir) || testDir.includes(root),
                `Expected root "${root}" to match test dir "${testDir}"`
            );
        });
    });

    // -------------------------------------------------------------------------
    // readState() / writeState()
    // -------------------------------------------------------------------------
    describe('readState() / writeState()', () => {
        const DEFAULT_STATE = {
            skill_enforcement: {
                enabled: true,
                mode: 'observe',
                fail_behavior: 'allow',
                manifest_version: '4.0.0'
            },
            current_phase: '06-implementation',
            skill_usage_log: [],
            iteration_enforcement: { enabled: true },
            phases: {}
        };

        afterEach(() => {
            // Restore original state for subsequent tests
            writeState(DEFAULT_STATE);
        });

        it('readState() returns the state written by setupTestEnv', () => {
            const state = common.readState();
            assert.ok(state, 'readState() should return non-null');
            assert.equal(state.current_phase, '06-implementation');
            assert.equal(state.skill_enforcement.mode, 'observe');
        });

        it('writeState() updates state.json', () => {
            const newState = {
                current_phase: '07-testing',
                skill_enforcement: { enabled: true, mode: 'observe' },
                skill_usage_log: []
            };
            const result = common.writeState(newState);
            assert.equal(result, true);

            const readBack = common.readState();
            assert.equal(readBack.current_phase, '07-testing');
        });

        it('readState() returns null for missing state file', () => {
            const testDir = getTestDir();
            const stateFile = path.join(testDir, '.isdlc', 'state.json');
            fs.unlinkSync(stateFile);

            const state = common.readState();
            assert.equal(state, null);
        });

        it('readState() returns null for invalid JSON', () => {
            const testDir = getTestDir();
            const stateFile = path.join(testDir, '.isdlc', 'state.json');
            fs.writeFileSync(stateFile, '{ not valid json!!!');

            const state = common.readState();
            assert.equal(state, null);
        });
    });

    // -------------------------------------------------------------------------
    // readStateValue()
    // -------------------------------------------------------------------------
    describe('readStateValue()', () => {
        it('reads a top-level key', () => {
            const phase = common.readStateValue('current_phase');
            assert.equal(phase, '06-implementation');
        });

        it('reads a nested dot path', () => {
            const mode = common.readStateValue('skill_enforcement.mode');
            assert.equal(mode, 'observe');
        });

        it('returns undefined for missing path', () => {
            const val = common.readStateValue('nonexistent.deep.path');
            assert.equal(val, undefined);
        });

        it('returns undefined when state file does not exist', () => {
            const testDir = getTestDir();
            const stateFile = path.join(testDir, '.isdlc', 'state.json');
            const backup = fs.readFileSync(stateFile, 'utf8');
            fs.unlinkSync(stateFile);

            const val = common.readStateValue('current_phase');
            assert.equal(val, undefined);

            // Restore for subsequent tests
            fs.writeFileSync(stateFile, backup);
        });
    });

    // -------------------------------------------------------------------------
    // appendSkillLog()
    // -------------------------------------------------------------------------
    describe('appendSkillLog()', () => {
        beforeEach(() => {
            writeState({
                skill_enforcement: { enabled: true, mode: 'observe' },
                current_phase: '06-implementation',
                skill_usage_log: []
            });
        });

        it('appends entry to skill_usage_log array', () => {
            const entry = { skill: 'DEV-001', agent: 'software-developer', timestamp: '2026-01-01T00:00:00Z' };
            const result = common.appendSkillLog(entry);
            assert.equal(result, true);

            const state = common.readState();
            assert.equal(state.skill_usage_log.length, 1);
            assert.equal(state.skill_usage_log[0].skill, 'DEV-001');
        });

        it('multiple appends accumulate entries', () => {
            common.appendSkillLog({ skill: 'DEV-001' });
            common.appendSkillLog({ skill: 'DEV-002' });
            common.appendSkillLog({ skill: 'DEV-003' });

            const state = common.readState();
            assert.equal(state.skill_usage_log.length, 3);
            assert.equal(state.skill_usage_log[2].skill, 'DEV-003');
        });

        it('initializes array if skill_usage_log is missing', () => {
            writeState({
                skill_enforcement: { enabled: true, mode: 'observe' },
                current_phase: '06-implementation'
                // No skill_usage_log key
            });

            const result = common.appendSkillLog({ skill: 'TEST-001' });
            assert.equal(result, true);

            const state = common.readState();
            assert.ok(Array.isArray(state.skill_usage_log));
            assert.equal(state.skill_usage_log.length, 1);
        });

        it('returns false when state file does not exist', () => {
            const testDir = getTestDir();
            const stateFile = path.join(testDir, '.isdlc', 'state.json');
            const backup = fs.readFileSync(stateFile, 'utf8');
            fs.unlinkSync(stateFile);

            const result = common.appendSkillLog({ skill: 'DEV-001' });
            assert.equal(result, false);

            // Restore
            fs.writeFileSync(stateFile, backup);
        });
    });

    // -------------------------------------------------------------------------
    // getTimestamp()
    // -------------------------------------------------------------------------
    describe('getTimestamp()', () => {
        it('returns string in ISO format', () => {
            const ts = common.getTimestamp();
            assert.equal(typeof ts, 'string');
            // ISO format: YYYY-MM-DDTHH:mm:ss.sssZ
            assert.ok(ts.includes('T'), 'Should contain T separator');
            assert.ok(ts.endsWith('Z'), 'Should end with Z (UTC)');
            // Verify it can be parsed back
            const parsed = new Date(ts);
            assert.ok(!isNaN(parsed.getTime()), 'Should be a valid date');
        });

        it('has appropriate length for ISO timestamp', () => {
            const ts = common.getTimestamp();
            // ISO string: "2026-01-22T10:30:45.123Z" => 24 chars
            assert.ok(ts.length >= 20 && ts.length <= 30,
                `Timestamp length ${ts.length} should be between 20 and 30`);
        });
    });

    // -------------------------------------------------------------------------
    // normalizeAgentName()
    // -------------------------------------------------------------------------
    describe('normalizeAgentName()', () => {
        it('converts to lowercase and replaces underscores with hyphens', () => {
            assert.equal(common.normalizeAgentName('Software_Developer'), 'software-developer');
        });

        it('maps "developer" to "software-developer"', () => {
            assert.equal(common.normalizeAgentName('developer'), 'software-developer');
        });

        it('maps "architect" to "solution-architect"', () => {
            assert.equal(common.normalizeAgentName('architect'), 'solution-architect');
        });

        it('maps "d1" to "architecture-analyzer"', () => {
            assert.equal(common.normalizeAgentName('d1'), 'architecture-analyzer');
        });

        it('maps "orchestrator" to "sdlc-orchestrator"', () => {
            assert.equal(common.normalizeAgentName('orchestrator'), 'sdlc-orchestrator');
        });

        it('maps "sre" to "site-reliability-engineer"', () => {
            assert.equal(common.normalizeAgentName('sre'), 'site-reliability-engineer');
        });

        it('handles already-normalized name by returning it unchanged', () => {
            assert.equal(common.normalizeAgentName('software-developer'), 'software-developer');
        });

        it('returns empty string for null input', () => {
            assert.equal(common.normalizeAgentName(null), '');
        });

        it('returns empty string for undefined input', () => {
            assert.equal(common.normalizeAgentName(undefined), '');
        });

        it('passes through unknown agent names in lowercase', () => {
            assert.equal(common.normalizeAgentName('Custom-Agent'), 'custom-agent');
        });
    });

    // -------------------------------------------------------------------------
    // loadManifest()
    // -------------------------------------------------------------------------
    describe('loadManifest()', () => {
        it('loads manifest from .claude/hooks/config/', () => {
            const manifest = common.loadManifest();
            assert.ok(manifest, 'Manifest should be loaded');
            assert.ok(manifest.ownership, 'Manifest should have ownership section');
            assert.ok(manifest.skill_lookup, 'Manifest should have skill_lookup section');
            assert.equal(manifest.version, '4.0.0');
        });

        it('returns null when no manifest file is found', () => {
            const testDir = getTestDir();
            const manifestFile = path.join(testDir, '.claude', 'hooks', 'config', 'skills-manifest.json');
            const backup = fs.readFileSync(manifestFile, 'utf8');
            fs.unlinkSync(manifestFile);

            // Clear require cache so loadManifest re-reads filesystem
            const fresh = freshCommon();
            const result = fresh.loadManifest();
            assert.equal(result, null);

            // Restore
            fs.writeFileSync(manifestFile, backup);
        });
    });

    // -------------------------------------------------------------------------
    // getAgentPhase() / getSkillOwner()
    // -------------------------------------------------------------------------
    describe('getAgentPhase() / getSkillOwner()', () => {
        it('returns phase for a known agent', () => {
            const phase = common.getAgentPhase('software-developer');
            assert.equal(phase, '06-implementation');
        });

        it('returns null for unknown agent', () => {
            const phase = common.getAgentPhase('nonexistent-agent');
            assert.equal(phase, null);
        });

        it('returns owner for a known skill ID', () => {
            const owner = common.getSkillOwner('DEV-001');
            assert.equal(owner, 'software-developer');
        });

        it('returns null for unknown skill ID', () => {
            const owner = common.getSkillOwner('FAKE-999');
            assert.equal(owner, null);
        });

        it('returns "all" phase for sdlc-orchestrator', () => {
            const phase = common.getAgentPhase('sdlc-orchestrator');
            assert.equal(phase, 'all');
        });

        it('returns "setup" phase for discover agents', () => {
            const phase = common.getAgentPhase('architecture-analyzer');
            assert.equal(phase, 'setup');
        });
    });

    // -------------------------------------------------------------------------
    // isAgentAuthorizedForPhase()
    // -------------------------------------------------------------------------
    describe('isAgentAuthorizedForPhase()', () => {
        it('returns true when agent phase matches current phase', () => {
            const result = common.isAgentAuthorizedForPhase('software-developer', '06-implementation');
            assert.equal(result, true);
        });

        it('returns true for orchestrator (phase="all")', () => {
            const result = common.isAgentAuthorizedForPhase('sdlc-orchestrator', '06-implementation');
            assert.equal(result, true);
        });

        it('returns false for phase mismatch', () => {
            const result = common.isAgentAuthorizedForPhase('software-developer', '01-requirements');
            assert.equal(result, false);
        });

        it('returns true for setup agents (discover agents)', () => {
            const result = common.isAgentAuthorizedForPhase('architecture-analyzer', '06-implementation');
            assert.equal(result, true);
        });

        it('returns true (fail open) for unknown agent not in manifest', () => {
            const result = common.isAgentAuthorizedForPhase('nonexistent-agent', '06-implementation');
            assert.equal(result, true);
        });
    });

    // -------------------------------------------------------------------------
    // Monorepo utilities
    // -------------------------------------------------------------------------
    describe('isMonorepoMode()', () => {
        it('returns false when monorepo.json does not exist', () => {
            assert.equal(common.isMonorepoMode(), false);
        });

        it('returns true when monorepo.json exists', () => {
            const testDir = getTestDir();
            fs.writeFileSync(
                path.join(testDir, '.isdlc', 'monorepo.json'),
                JSON.stringify({ projects: {}, default_project: 'app' })
            );

            assert.equal(common.isMonorepoMode(), true);

            // Cleanup
            fs.unlinkSync(path.join(testDir, '.isdlc', 'monorepo.json'));
        });
    });

    describe('readMonorepoConfig()', () => {
        it('returns null when monorepo.json does not exist', () => {
            const result = common.readMonorepoConfig();
            assert.equal(result, null);
        });

        it('returns parsed config when monorepo.json exists', () => {
            const testDir = getTestDir();
            const config = { projects: { app: { path: 'apps/web' } }, default_project: 'app' };
            fs.writeFileSync(
                path.join(testDir, '.isdlc', 'monorepo.json'),
                JSON.stringify(config)
            );

            const result = common.readMonorepoConfig();
            assert.deepEqual(result.default_project, 'app');
            assert.deepEqual(result.projects.app.path, 'apps/web');

            fs.unlinkSync(path.join(testDir, '.isdlc', 'monorepo.json'));
        });
    });

    describe('resolveStatePath()', () => {
        it('returns .isdlc/state.json in single-project mode', () => {
            const statePath = common.resolveStatePath();
            const testDir = getTestDir();
            assert.equal(statePath, path.join(testDir, '.isdlc', 'state.json'));
        });
    });

    // -------------------------------------------------------------------------
    // debugLog()
    // -------------------------------------------------------------------------
    describe('debugLog()', () => {
        it('does not throw when called', () => {
            assert.doesNotThrow(() => common.debugLog('test message'));
        });
    });

    // -------------------------------------------------------------------------
    // outputBlockResponse()
    // -------------------------------------------------------------------------
    describe('outputBlockResponse()', () => {
        it('writes JSON to stdout with continue=false', () => {
            const originalLog = console.log;
            let captured = '';
            console.log = (msg) => { captured = msg; };

            common.outputBlockResponse('Test block reason');

            console.log = originalLog;

            const parsed = JSON.parse(captured);
            assert.equal(parsed.continue, false);
            assert.equal(parsed.stopReason, 'Test block reason');
        });
    });

    // -------------------------------------------------------------------------
    // getManifestPath()
    // -------------------------------------------------------------------------
    describe('getManifestPath()', () => {
        it('returns path within .claude/hooks/config/', () => {
            const manifestPath = common.getManifestPath();
            assert.ok(manifestPath, 'Should find manifest');
            assert.ok(
                manifestPath.includes(path.join('.claude', 'hooks', 'config', 'skills-manifest.json')),
                `Path should point to hooks config dir, got: ${manifestPath}`
            );
        });

        it('returns null when no manifest exists', () => {
            const testDir = getTestDir();
            const manifestFile = path.join(testDir, '.claude', 'hooks', 'config', 'skills-manifest.json');
            const backup = fs.readFileSync(manifestFile, 'utf8');
            fs.unlinkSync(manifestFile);

            const fresh = freshCommon();
            const result = fresh.getManifestPath();
            assert.equal(result, null);

            // Restore
            fs.writeFileSync(manifestFile, backup);
        });
    });

    // -------------------------------------------------------------------------
    // isMigrationNeeded()
    // -------------------------------------------------------------------------
    describe('isMigrationNeeded()', () => {
        it('returns false when neither legacy nor new constitution exists', () => {
            assert.equal(common.isMigrationNeeded(), false);
        });

        it('returns true when legacy exists but new does not', () => {
            const testDir = getTestDir();
            fs.writeFileSync(
                path.join(testDir, '.isdlc', 'constitution.md'),
                '# Constitution'
            );

            assert.equal(common.isMigrationNeeded(), true);

            fs.unlinkSync(path.join(testDir, '.isdlc', 'constitution.md'));
        });

        it('returns false when new location exists', () => {
            const testDir = getTestDir();
            const newDir = path.join(testDir, 'docs', 'isdlc');
            fs.mkdirSync(newDir, { recursive: true });
            fs.writeFileSync(path.join(newDir, 'constitution.md'), '# Constitution');
            fs.writeFileSync(path.join(testDir, '.isdlc', 'constitution.md'), '# Legacy');

            assert.equal(common.isMigrationNeeded(), false);

            // Cleanup
            fs.unlinkSync(path.join(newDir, 'constitution.md'));
            fs.unlinkSync(path.join(testDir, '.isdlc', 'constitution.md'));
        });
    });
});
