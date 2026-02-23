/**
 * TDD RED-state tests for BUG-0035-GH-81-82-83
 *
 * These tests define the EXPECTED behavior of getAgentSkillIndex() after the fix.
 * They use the PRODUCTION manifest schema (flat string arrays in ownership.skills)
 * and will FAIL against the current (buggy) implementation.
 *
 * Three coupled bugs:
 *   GH-81: Function expects skill objects but production manifest has string arrays
 *   GH-82: Skill path hardcoded to src/claude/skills/, fails in installed projects
 *   GH-83: Test fixtures use wrong schema, giving false confidence
 *
 * Traces to: FR-01 (AC-01-01..AC-01-06), FR-02 (AC-02-01..AC-02-05), FR-03 (AC-03-01..AC-03-04)
 *
 * Test runner: node:test (Article II)
 * Module: CJS (hooks convention)
 * TDD state: RED -- tests FAIL until Phase 06 implements the fix
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// =============================================================================
// Constants
// =============================================================================

const COMMON_PATH = path.join(__dirname, '..', 'lib', 'common.cjs');
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..', '..');
const REAL_MANIFEST_PATH = path.join(PROJECT_ROOT, 'src', 'claude', 'hooks', 'config', 'skills-manifest.json');

// =============================================================================
// Test Helpers -- Production Schema Fixtures
// =============================================================================

/**
 * Create a temp project with PRODUCTION-SCHEMA manifest (flat string arrays).
 * This is the key difference from skill-injection.test.cjs which uses objects.
 *
 * Traces to: FR-03, AC-03-01, AC-03-04
 */
function createProductionSchemaProject(opts = {}) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdlc-b35-'));

    // Create .claude/hooks/config/ for manifest
    const hooksConfigDir = path.join(tmpDir, '.claude', 'hooks', 'config');
    fs.mkdirSync(hooksConfigDir, { recursive: true });

    // Create .isdlc/ for state.json (required by getProjectRoot)
    const isdlcDir = path.join(tmpDir, '.isdlc');
    fs.mkdirSync(isdlcDir, { recursive: true });
    fs.writeFileSync(path.join(isdlcDir, 'state.json'), JSON.stringify({
        framework_version: '0.1.0-alpha',
        skill_enforcement: { enabled: true, mode: 'observe' }
    }));

    if (opts.noManifest) {
        return tmpDir;
    }

    // Production-schema manifest: skills are FLAT STRING ARRAYS (not objects)
    const manifest = opts.manifest || {
        version: '5.0.0',
        total_skills: 5,
        enforcement_mode: 'observe',
        ownership: {
            'test-agent-alpha': {
                agent_id: '99',
                phase: 'all',
                skill_count: 3,
                skills: ['TST-001', 'TST-002', 'TST-003']  // STRINGS, not objects
            },
            'test-agent-beta': {
                agent_id: '98',
                phase: '06-implementation',
                skill_count: 2,
                skills: ['BETA-001', 'BETA-002']  // STRINGS, not objects
            },
            'test-agent-empty': {
                agent_id: '97',
                phase: '01-requirements',
                skill_count: 0,
                skills: []
            }
        },
        // skill_lookup: skill ID -> owning agent (required for resolution)
        skill_lookup: {
            'TST-001': 'test-agent-alpha',
            'TST-002': 'test-agent-alpha',
            'TST-003': 'test-agent-alpha',
            'BETA-001': 'test-agent-beta',
            'BETA-002': 'test-agent-beta'
        },
        // path_lookup: category/skill-name -> owning agent (required for path resolution)
        path_lookup: {
            'testing/skill-one': 'test-agent-alpha',
            'testing/skill-two': 'test-agent-alpha',
            'testing/skill-three': 'test-agent-alpha',
            'beta/beta-skill-one': 'test-agent-beta',
            'beta/beta-skill-two': 'test-agent-beta'
        }
    };

    if (opts.corruptManifest) {
        fs.writeFileSync(
            path.join(hooksConfigDir, 'skills-manifest.json'),
            'NOT VALID JSON {{{',
            'utf8'
        );
    } else {
        fs.writeFileSync(
            path.join(hooksConfigDir, 'skills-manifest.json'),
            JSON.stringify(manifest, null, 2),
            'utf8'
        );
    }

    // Determine which skill base dir to create files in
    const skillBaseDirs = [];
    if (opts.onlyInstalledPath) {
        skillBaseDirs.push(path.join(tmpDir, '.claude', 'skills'));
    } else if (opts.onlyDevPath) {
        skillBaseDirs.push(path.join(tmpDir, 'src', 'claude', 'skills'));
    } else if (opts.bothPaths) {
        skillBaseDirs.push(path.join(tmpDir, '.claude', 'skills'));
        skillBaseDirs.push(path.join(tmpDir, 'src', 'claude', 'skills'));
    } else if (!opts.noSkillFiles) {
        // Default: src/claude/skills/ (dev mode)
        skillBaseDirs.push(path.join(tmpDir, 'src', 'claude', 'skills'));
    }

    for (const baseDir of skillBaseDirs) {
        if (!opts.noSkillFiles) {
            // Create SKILL.md files with skill_id in frontmatter matching the string IDs
            createSkillMd(baseDir, 'testing/skill-one', {
                skill_id: 'TST-001',
                name: 'skill-one',
                description: 'Execute the first test skill'
            });

            if (!opts.removeSecondSkill) {
                createSkillMd(baseDir, 'testing/skill-two', {
                    skill_id: 'TST-002',
                    name: 'skill-two',
                    description: 'Execute the second test skill'
                });
            }

            createSkillMd(baseDir, 'testing/skill-three', {
                skill_id: 'TST-003',
                name: 'skill-three',
                description: 'Execute the third test skill'
            });

            createSkillMd(baseDir, 'beta/beta-skill-one', {
                skill_id: 'BETA-001',
                name: 'beta-skill-one',
                description: 'Beta skill number one'
            });
            createSkillMd(baseDir, 'beta/beta-skill-two', {
                skill_id: 'BETA-002',
                name: 'beta-skill-two',
                description: 'Beta skill number two'
            });
        }
    }

    return tmpDir;
}

/**
 * Create a SKILL.md file with YAML frontmatter containing skill_id.
 */
function createSkillMd(baseDir, skillPath, data) {
    const dir = path.join(baseDir, skillPath);
    fs.mkdirSync(dir, { recursive: true });
    const content = [
        '---',
        `name: ${data.name}`,
        `description: ${data.description}`,
        `skill_id: ${data.skill_id}`,
        `owner: test-agent`,
        'collaborators: []',
        'project: test-project',
        'version: 1.0.0',
        '---',
        '',
        `# ${data.name}`,
        '',
        '## Purpose',
        `${data.description}.`,
        ''
    ].join('\n');
    fs.writeFileSync(path.join(dir, 'SKILL.md'), content, 'utf8');
}

/**
 * Load common.cjs with a specific project root.
 * Clears require cache to ensure fresh load.
 */
function loadCommon(projectRoot) {
    delete require.cache[require.resolve(COMMON_PATH)];
    process.env.CLAUDE_PROJECT_DIR = projectRoot;
    process.env.NODE_ENV = 'test';
    process.env.ISDLC_TEST_MODE = '1';
    const common = require(COMMON_PATH);
    if (common._resetCaches) {
        common._resetCaches();
    }
    return common;
}

/**
 * Clean up a temp directory (best-effort).
 */
function cleanup(tmpDir) {
    try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {
        // Best-effort
    }
}

// =============================================================================
// TC-B35-01: String-ID Resolution -- Happy Path (FR-01, AC-01-01)
// RED STATE: Current code returns [] because it treats strings as objects
// =============================================================================

describe('TC-B35-01: String-ID resolution returns correct count [FR-01, AC-01-01]', () => {
    let tmpDir;
    let common;

    before(() => {
        tmpDir = createProductionSchemaProject();
        common = loadCommon(tmpDir);
    });

    after(() => {
        cleanup(tmpDir);
    });

    it('[P0] AC-01-01: returns 3 skill objects for agent with 3 string skill IDs', () => {
        const result = common.getAgentSkillIndex('test-agent-alpha');

        // RED: Current code returns [] because skill.path is undefined for string "TST-001"
        assert.ok(Array.isArray(result), 'Result should be an array');
        assert.equal(result.length, 3,
            `Expected 3 skills for test-agent-alpha, got ${result.length}. ` +
            'If 0, the function is not resolving flat string skill IDs (GH-81).');
    });

    it('[P0] AC-01-01: returns 2 skill objects for second agent with 2 string IDs', () => {
        const result = common.getAgentSkillIndex('test-agent-beta');

        assert.ok(Array.isArray(result), 'Result should be an array');
        assert.equal(result.length, 2,
            `Expected 2 skills for test-agent-beta, got ${result.length}.`);
    });
});

// =============================================================================
// TC-B35-02: Returned Object Structure (FR-01, AC-01-02)
// RED STATE: Current code returns [] so there are no objects to inspect
// =============================================================================

describe('TC-B35-02: Returned objects have correct structure [FR-01, AC-01-02]', () => {
    let tmpDir;
    let common;

    before(() => {
        tmpDir = createProductionSchemaProject();
        common = loadCommon(tmpDir);
    });

    after(() => {
        cleanup(tmpDir);
    });

    it('[P0] AC-01-02: each object has id, name, description, path fields', () => {
        const result = common.getAgentSkillIndex('test-agent-alpha');

        assert.ok(result.length > 0,
            'Must return at least one entry to validate structure (currently returns [] due to GH-81)');

        for (const entry of result) {
            assert.equal(typeof entry.id, 'string', `id should be string, got ${typeof entry.id}`);
            assert.equal(typeof entry.name, 'string', `name should be string, got ${typeof entry.name}`);
            assert.equal(typeof entry.description, 'string', `description should be string, got ${typeof entry.description}`);
            assert.equal(typeof entry.path, 'string', `path should be string, got ${typeof entry.path}`);
        }
    });

    it('[P0] AC-01-02: id matches the string skill ID from manifest', () => {
        const result = common.getAgentSkillIndex('test-agent-alpha');

        assert.ok(result.length > 0, 'Must return entries to validate IDs');

        const ids = result.map(e => e.id);
        assert.ok(ids.includes('TST-001'), 'Should include TST-001');
        assert.ok(ids.includes('TST-002'), 'Should include TST-002');
        assert.ok(ids.includes('TST-003'), 'Should include TST-003');
    });

    it('[P0] AC-01-02: name matches skill directory name from path_lookup', () => {
        const result = common.getAgentSkillIndex('test-agent-alpha');

        assert.ok(result.length > 0, 'Must return entries to validate names');

        const entry = result.find(e => e.id === 'TST-001');
        assert.ok(entry, 'Should find entry for TST-001');
        assert.equal(entry.name, 'skill-one',
            'Name should match the skill directory name (skill-one)');
    });

    it('[P0] AC-01-02: description is non-empty string from SKILL.md', () => {
        const result = common.getAgentSkillIndex('test-agent-alpha');

        assert.ok(result.length > 0, 'Must return entries to validate descriptions');

        const entry = result.find(e => e.id === 'TST-001');
        assert.ok(entry, 'Should find entry for TST-001');
        assert.ok(entry.description.length > 0, 'Description should be non-empty');
        assert.equal(entry.description, 'Execute the first test skill',
            'Description should come from SKILL.md frontmatter');
    });

    it('[P0] AC-01-02: path ends with SKILL.md and is relative', () => {
        const result = common.getAgentSkillIndex('test-agent-alpha');

        assert.ok(result.length > 0, 'Must return entries to validate paths');

        const entry = result.find(e => e.id === 'TST-001');
        assert.ok(entry, 'Should find entry for TST-001');
        assert.ok(entry.path.endsWith('SKILL.md'),
            `Path should end with SKILL.md, got: ${entry.path}`);
        assert.ok(!path.isAbsolute(entry.path),
            `Path should be relative, got absolute: ${entry.path}`);
    });
});

// =============================================================================
// TC-B35-03: Missing/Corrupt Manifest (FR-01, AC-01-03)
// GREEN STATE: This already works in current code (fail-open)
// =============================================================================

describe('TC-B35-03: Missing/corrupt manifest returns empty array [FR-01, AC-01-03]', () => {
    it('[P0] AC-01-03: missing manifest returns []', () => {
        const tmpDir = createProductionSchemaProject({ noManifest: true });
        const common = loadCommon(tmpDir);

        const result = common.getAgentSkillIndex('test-agent-alpha');
        assert.ok(Array.isArray(result), 'Should return array');
        assert.equal(result.length, 0, 'Should be empty when no manifest');

        cleanup(tmpDir);
    });

    it('[P0] AC-01-03: corrupt manifest returns []', () => {
        const tmpDir = createProductionSchemaProject({ corruptManifest: true });
        const common = loadCommon(tmpDir);

        const result = common.getAgentSkillIndex('test-agent-alpha');
        assert.ok(Array.isArray(result), 'Should return array');
        assert.equal(result.length, 0, 'Should be empty when manifest is corrupt');

        cleanup(tmpDir);
    });
});

// =============================================================================
// TC-B35-04: Unknown Agent (FR-01, AC-01-04)
// GREEN STATE: This already works in current code (fail-open)
// =============================================================================

describe('TC-B35-04: Unknown agent returns empty array [FR-01, AC-01-04]', () => {
    let tmpDir;
    let common;

    before(() => {
        tmpDir = createProductionSchemaProject();
        common = loadCommon(tmpDir);
    });

    after(() => {
        cleanup(tmpDir);
    });

    it('[P1] AC-01-04: nonexistent agent name returns []', () => {
        const result = common.getAgentSkillIndex('nonexistent-agent');
        assert.ok(Array.isArray(result));
        assert.equal(result.length, 0);
    });
});

// =============================================================================
// TC-B35-05: Unresolvable Skill ID Skipped (FR-01, AC-01-05)
// RED STATE: Current code returns [] for ALL skills with string IDs
// =============================================================================

describe('TC-B35-05: Unresolvable skill ID is skipped [FR-01, AC-01-05]', () => {
    it('[P0] AC-01-05: missing SKILL.md for one skill skips it, returns others', () => {
        const tmpDir = createProductionSchemaProject({ removeSecondSkill: true });
        const common = loadCommon(tmpDir);

        const result = common.getAgentSkillIndex('test-agent-alpha');

        // RED: Current code returns [] for all. After fix, should return 2 (skill-two skipped).
        assert.ok(Array.isArray(result), 'Should return array');
        assert.equal(result.length, 2,
            `Expected 2 skills (skill-two skipped), got ${result.length}. ` +
            'If 0, string ID resolution is not working (GH-81).');

        const ids = result.map(e => e.id);
        assert.ok(ids.includes('TST-001'), 'Should still have TST-001');
        assert.ok(ids.includes('TST-003'), 'Should still have TST-003');
        assert.ok(!ids.includes('TST-002'), 'TST-002 should be skipped (no SKILL.md)');

        cleanup(tmpDir);
    });

    it('[P0] AC-01-05: all SKILL.md files missing returns empty array', () => {
        const tmpDir = createProductionSchemaProject({ noSkillFiles: true });
        const common = loadCommon(tmpDir);

        const result = common.getAgentSkillIndex('test-agent-alpha');

        // This should return [] even after fix (no files to resolve)
        assert.ok(Array.isArray(result));
        assert.equal(result.length, 0, 'All skills unresolvable, should be empty');

        cleanup(tmpDir);
    });
});

// =============================================================================
// TC-B35-06: Empty/Null/Undefined Agent Name (FR-01, AC-01-06)
// GREEN STATE: This already works in current code (input guard)
// =============================================================================

describe('TC-B35-06: Empty/null/undefined agent name returns [] [FR-01, AC-01-06]', () => {
    let tmpDir;
    let common;

    before(() => {
        tmpDir = createProductionSchemaProject();
        common = loadCommon(tmpDir);
    });

    after(() => {
        cleanup(tmpDir);
    });

    it('[P1] AC-01-06: null returns []', () => {
        assert.deepStrictEqual(common.getAgentSkillIndex(null), []);
    });

    it('[P1] AC-01-06: undefined returns []', () => {
        assert.deepStrictEqual(common.getAgentSkillIndex(undefined), []);
    });

    it('[P1] AC-01-06: empty string returns []', () => {
        assert.deepStrictEqual(common.getAgentSkillIndex(''), []);
    });

    it('[P1] AC-01-06: whitespace-only string returns []', () => {
        assert.deepStrictEqual(common.getAgentSkillIndex('   '), []);
    });
});

// =============================================================================
// TC-B35-07: Dev Path src/claude/skills/ Works (FR-02, AC-02-01)
// RED STATE: Current code hardcodes src/ but can't resolve string IDs
// =============================================================================

describe('TC-B35-07: Dev path src/claude/skills/ resolution [FR-02, AC-02-01]', () => {
    it('[P0] AC-02-01: resolves SKILL.md from src/claude/skills/', () => {
        const tmpDir = createProductionSchemaProject({ onlyDevPath: true });
        const common = loadCommon(tmpDir);

        const result = common.getAgentSkillIndex('test-agent-alpha');

        // RED: Current code returns [] because string IDs can't be resolved
        assert.ok(result.length > 0,
            'Should resolve skills from src/claude/skills/ (GH-81 blocks this)');

        const entry = result.find(e => e.id === 'TST-001');
        assert.ok(entry, 'Should find TST-001');
        assert.ok(entry.path.includes('src/claude/skills/'),
            `Path should reference src/claude/skills/, got: ${entry.path}`);

        cleanup(tmpDir);
    });
});

// =============================================================================
// TC-B35-08: Installed Path .claude/skills/ Works (FR-02, AC-02-02)
// RED STATE: Current code only checks src/claude/skills/ (GH-82)
// =============================================================================

describe('TC-B35-08: Installed path .claude/skills/ resolution [FR-02, AC-02-02]', () => {
    it('[P0] AC-02-02: resolves SKILL.md from .claude/skills/ when src/ absent', () => {
        const tmpDir = createProductionSchemaProject({ onlyInstalledPath: true });
        const common = loadCommon(tmpDir);

        const result = common.getAgentSkillIndex('test-agent-alpha');

        // RED: Current code hardcodes src/claude/skills/ only (GH-82)
        assert.ok(result.length > 0,
            'Should resolve skills from .claude/skills/ when src/ absent (GH-82 blocks this)');

        const entry = result.find(e => e.id === 'TST-001');
        assert.ok(entry, 'Should find TST-001 from installed path');
        assert.ok(entry.path.includes('.claude/skills/'),
            `Path should reference .claude/skills/, got: ${entry.path}`);

        cleanup(tmpDir);
    });
});

// =============================================================================
// TC-B35-09: .claude/skills/ Takes Precedence (FR-02, AC-02-03)
// RED STATE: Current code never checks .claude/skills/ (GH-82)
// =============================================================================

describe('TC-B35-09: Dev path takes precedence [FR-02, REQ-0001 ADR-0028]', () => {
    it('[P1] AC-02-03: src/claude/skills/ is used when both paths exist (dev mode precedence)', () => {
        const tmpDir = createProductionSchemaProject({ bothPaths: true });
        const common = loadCommon(tmpDir);

        const result = common.getAgentSkillIndex('test-agent-alpha');

        // REQ-0001: _buildSkillPathIndex scans src/ first (dev mode takes precedence)
        assert.ok(result.length > 0,
            'Should resolve skills when both paths exist');

        const entry = result.find(e => e.id === 'TST-001');
        assert.ok(entry, 'Should find TST-001');
        assert.ok(entry.path.includes('src/claude/skills/'),
            `Dev path src/claude/skills/ should take precedence, got: ${entry.path}`);

        cleanup(tmpDir);
    });
});

// =============================================================================
// TC-B35-10: Neither Path Exists -- Skill Skipped (FR-02, AC-02-04)
// GREEN STATE (partially): Current code already skips missing files,
//   but this test validates it with production schema
// =============================================================================

describe('TC-B35-10: Neither path exists -- skill skipped [FR-02, AC-02-04]', () => {
    it('[P1] AC-02-04: skill with no SKILL.md in either location is skipped', () => {
        const tmpDir = createProductionSchemaProject({ noSkillFiles: true });
        const common = loadCommon(tmpDir);

        const result = common.getAgentSkillIndex('test-agent-alpha');

        // Even after fix, with no skill files, should return []
        assert.ok(Array.isArray(result));
        assert.equal(result.length, 0, 'All skills should be skipped');

        cleanup(tmpDir);
    });
});

// =============================================================================
// TC-B35-11: Returned Path is Relative (FR-02, AC-02-05)
// RED STATE: Current code returns [] so no paths to check
// =============================================================================

describe('TC-B35-11: Returned path is relative from project root [FR-02, AC-02-05]', () => {
    it('[P1] AC-02-05: path field is relative, not absolute', () => {
        const tmpDir = createProductionSchemaProject();
        const common = loadCommon(tmpDir);

        const result = common.getAgentSkillIndex('test-agent-alpha');

        // RED: Current code returns []
        assert.ok(result.length > 0,
            'Must return entries to validate relative paths');

        for (const entry of result) {
            assert.ok(!path.isAbsolute(entry.path),
                `Path should be relative from project root, got absolute: ${entry.path}`);
            assert.ok(
                entry.path.startsWith('src/claude/skills/') ||
                entry.path.startsWith('.claude/skills/'),
                `Path should start with src/claude/skills/ or .claude/skills/, got: ${entry.path}`);
            assert.ok(entry.path.endsWith('SKILL.md'),
                `Path should end with SKILL.md, got: ${entry.path}`);
        }

        cleanup(tmpDir);
    });
});

// =============================================================================
// TC-B35-12: Mock Manifest Uses String Arrays (FR-03, AC-03-01)
// GREEN STATE: This validates our own test fixture schema
// =============================================================================

describe('TC-B35-12: Mock fixture schema validation [FR-03, AC-03-01]', () => {
    it('[P0] AC-03-01: mock manifest skills are flat string arrays, not objects', () => {
        const tmpDir = createProductionSchemaProject();

        // Read the manifest we wrote to disk
        const manifestPath = path.join(tmpDir, '.claude', 'hooks', 'config', 'skills-manifest.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

        for (const [agentName, agentEntry] of Object.entries(manifest.ownership)) {
            if (agentEntry.skills.length > 0) {
                for (const skill of agentEntry.skills) {
                    assert.equal(typeof skill, 'string',
                        `ownership.${agentName}.skills should contain strings, ` +
                        `got ${typeof skill}: ${JSON.stringify(skill)}`);
                }
            }
        }

        cleanup(tmpDir);
    });
});

// =============================================================================
// TC-B35-13: Integration Test Against Real Production Manifest (FR-03, AC-03-02)
// RED STATE: Current code returns [] for production manifest (the actual bug)
// =============================================================================

describe('TC-B35-13: Production manifest integration [FR-03, AC-03-02]', () => {
    // Skip if we're not in the project context (e.g., running in CI without full repo)
    const manifestExists = fs.existsSync(REAL_MANIFEST_PATH);

    it('[P0] AC-03-02: software-developer returns exactly 14 skills from real manifest', { skip: !manifestExists ? 'Real manifest not found' : false }, () => {
        // Load common with real project root
        const common = loadCommon(PROJECT_ROOT);

        const result = common.getAgentSkillIndex('software-developer');

        // RED: This is THE bug. Current code returns [] for production manifest.
        assert.ok(Array.isArray(result), 'Should return array');
        assert.equal(result.length, 14,
            `software-developer should have exactly 14 skills, got ${result.length}. ` +
            'If 0, the function cannot resolve flat string skill IDs from production manifest (GH-81).');

        // Validate each entry has correct structure
        for (const entry of result) {
            assert.equal(typeof entry.id, 'string', `id should be string for ${entry.id}`);
            assert.equal(typeof entry.name, 'string', `name should be string for ${entry.id}`);
            assert.equal(typeof entry.description, 'string', `description should be string for ${entry.id}`);
            assert.equal(typeof entry.path, 'string', `path should be string for ${entry.id}`);

            assert.ok(entry.id.startsWith('DEV-'),
                `Skill ID should start with DEV-, got ${entry.id}`);
            assert.ok(entry.name.length > 0,
                `Name should be non-empty for ${entry.id}`);
            assert.ok(entry.description.length > 0,
                `Description should be non-empty for ${entry.id}`);
            assert.ok(entry.path.endsWith('SKILL.md'),
                `Path should end with SKILL.md for ${entry.id}, got: ${entry.path}`);
        }

        // Verify specific expected IDs (DEV-001 through DEV-014)
        const ids = result.map(e => e.id).sort();
        const expectedIds = Array.from({ length: 14 }, (_, i) => `DEV-${String(i + 1).padStart(3, '0')}`);
        assert.deepStrictEqual(ids, expectedIds,
            'Should contain DEV-001 through DEV-014');
    });

    it('[P0] AC-03-02: DEV-001 resolves to code-implementation with valid path', { skip: !manifestExists ? 'Real manifest not found' : false }, () => {
        const common = loadCommon(PROJECT_ROOT);

        const result = common.getAgentSkillIndex('software-developer');

        // RED: Current code returns []
        assert.ok(result.length > 0, 'Must return entries to validate DEV-001');

        const dev001 = result.find(e => e.id === 'DEV-001');
        assert.ok(dev001, 'Should find DEV-001 in results');
        assert.equal(dev001.name, 'code-implementation',
            'DEV-001 should map to code-implementation');
        assert.ok(
            dev001.path.includes('development/code-implementation/SKILL.md'),
            `Path should include development/code-implementation/SKILL.md, got: ${dev001.path}`);
        assert.ok(dev001.description.length > 0,
            'Description should be extracted from SKILL.md');
    });
});

// =============================================================================
// TC-B35-14: Mock Includes skill_lookup and path_lookup (FR-03, AC-03-04)
// GREEN STATE: This validates our own test fixture completeness
// =============================================================================

describe('TC-B35-14: Mock manifest includes lookup tables [FR-03, AC-03-04]', () => {
    it('[P1] AC-03-04: mock has skill_lookup and path_lookup consistent with skills', () => {
        const tmpDir = createProductionSchemaProject();

        const manifestPath = path.join(tmpDir, '.claude', 'hooks', 'config', 'skills-manifest.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

        // Verify skill_lookup exists and has entries
        assert.ok(manifest.skill_lookup, 'Manifest should have skill_lookup table');
        assert.ok(Object.keys(manifest.skill_lookup).length > 0,
            'skill_lookup should have entries');

        // Verify path_lookup exists and has entries
        assert.ok(manifest.path_lookup, 'Manifest should have path_lookup table');
        assert.ok(Object.keys(manifest.path_lookup).length > 0,
            'path_lookup should have entries');

        // Verify every skill ID in ownership is in skill_lookup
        for (const [agentName, agentEntry] of Object.entries(manifest.ownership)) {
            for (const skillId of agentEntry.skills) {
                assert.ok(manifest.skill_lookup[skillId],
                    `Skill ${skillId} from ${agentName} should be in skill_lookup`);
            }
        }

        cleanup(tmpDir);
    });
});

// =============================================================================
// TC-B35-15: Corrupt Manifest Fail-Open Regression (FR-01, AC-01-03)
// GREEN STATE: Fail-open for corrupt manifest already works
// =============================================================================

describe('TC-B35-15: Corrupt manifest fail-open regression [FR-01, AC-01-03]', () => {
    it('[P0] AC-01-03: corrupt JSON returns [], does not throw', () => {
        const tmpDir = createProductionSchemaProject({ corruptManifest: true });
        const common = loadCommon(tmpDir);

        // This should not throw
        const result = common.getAgentSkillIndex('test-agent-alpha');
        assert.ok(Array.isArray(result), 'Should return array');
        assert.equal(result.length, 0, 'Corrupt manifest should return empty array');

        cleanup(tmpDir);
    });
});

// =============================================================================
// TC-B35-NFR-01: Performance Under 100ms (NFR-02)
// RED STATE: May still pass (function returns quickly when it returns [])
// =============================================================================

describe('TC-B35-NFR-01: Performance requirement [NFR-02]', () => {
    it('getAgentSkillIndex with production schema completes under 100ms', () => {
        const tmpDir = createProductionSchemaProject();
        const common = loadCommon(tmpDir);

        const start = process.hrtime.bigint();
        common.getAgentSkillIndex('test-agent-alpha');
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1_000_000;

        assert.ok(durationMs < 100,
            `getAgentSkillIndex took ${durationMs.toFixed(2)}ms, should be under 100ms`);

        cleanup(tmpDir);
    });
});
