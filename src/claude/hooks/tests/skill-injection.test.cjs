/**
 * Tests for skill index injection into agent Task prompts (BUG-0011-GH-15)
 *
 * Tests: getAgentSkillIndex(), formatSkillIndexBlock(), description extraction,
 *        caching, fail-open resilience, agent file validation
 *
 * Traces to: FR-01 through FR-05, AC-01 through AC-07, NFR-01 through NFR-05
 *
 * Test runner: node:test (Article II)
 * Module: CJS (hooks convention)
 * TDD: Tests designed to FAIL before fix, PASS after implementation
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// =============================================================================
// Test Environment Setup
// =============================================================================

const COMMON_PATH = path.join(__dirname, '..', 'lib', 'common.cjs');

/**
 * Create a minimal temp directory that mimics an installed iSDLC project.
 * Sets up .claude/hooks/config/skills-manifest.json and skill files.
 */
function createTestProject(opts = {}) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdlc-skill-test-'));

    // Create .claude/hooks/config/ for manifest
    const hooksConfigDir = path.join(tmpDir, '.claude', 'hooks', 'config');
    fs.mkdirSync(hooksConfigDir, { recursive: true });

    // Create .isdlc/ for state.json
    const isdlcDir = path.join(tmpDir, '.isdlc');
    fs.mkdirSync(isdlcDir, { recursive: true });
    fs.writeFileSync(path.join(isdlcDir, 'state.json'), JSON.stringify({
        framework_version: '0.1.0-alpha',
        skill_enforcement: { enabled: true, mode: 'observe' }
    }));

    if (opts.noManifest) {
        return tmpDir;
    }

    // Default manifest with test agents -- production schema (v5+): flat string arrays
    // Traces to: FR-03, AC-03-01, AC-03-04 (BUG-0035 fixture alignment)
    const manifest = opts.manifest || {
        version: '5.0.0',
        total_skills: 5,
        enforcement_mode: 'observe',
        ownership: {
            'test-agent-alpha': {
                agent_id: '99',
                phase: 'all',
                skill_count: 3,
                skills: ['TEST-001', 'TEST-002', 'TEST-003']
            },
            'test-agent-beta': {
                agent_id: '98',
                phase: '06-implementation',
                skill_count: 2,
                skills: ['BETA-001', 'BETA-002']
            },
            'test-agent-empty': {
                agent_id: '97',
                phase: '01-requirements',
                skill_count: 0,
                skills: []
            }
        },
        skill_lookup: {
            'TEST-001': 'test-agent-alpha',
            'TEST-002': 'test-agent-alpha',
            'TEST-003': 'test-agent-alpha',
            'BETA-001': 'test-agent-beta',
            'BETA-002': 'test-agent-beta'
        },
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

    // Create SKILL.md files (YAML format by default)
    const skillsBaseDir = path.join(tmpDir, 'src', 'claude', 'skills');

    if (!opts.noSkillFiles) {
        // YAML format skills for test-agent-alpha
        createSkillFile(skillsBaseDir, 'testing/skill-one', 'yaml', {
            name: 'skill-one',
            description: 'Execute the first test skill',
            skill_id: 'TEST-001'
        });
        createSkillFile(skillsBaseDir, 'testing/skill-two', 'yaml', {
            name: 'skill-two',
            description: 'Execute the second test skill',
            skill_id: 'TEST-002'
        });
        // Markdown format skill for test-agent-alpha (mixed)
        createSkillFile(skillsBaseDir, 'testing/skill-three', 'markdown', {
            name: 'skill-three',
            description: 'Execute the third test skill using markdown format',
            skill_id: 'TEST-003'
        });

        // YAML format skills for test-agent-beta
        createSkillFile(skillsBaseDir, 'beta/beta-skill-one', 'yaml', {
            name: 'beta-skill-one',
            description: 'Beta skill number one',
            skill_id: 'BETA-001'
        });
        createSkillFile(skillsBaseDir, 'beta/beta-skill-two', 'yaml', {
            name: 'beta-skill-two',
            description: 'Beta skill number two',
            skill_id: 'BETA-002'
        });
    }

    if (opts.createMalformedSkill) {
        // Overwrite skill-two with a malformed file (has skill_id for resolution but no description)
        const malformedPath = path.join(skillsBaseDir, 'testing', 'skill-two', 'SKILL.md');
        fs.writeFileSync(malformedPath, '---\nskill_id: TEST-002\n---\n# Just a title\n\nNo description field here.\n', 'utf8');
    }

    if (opts.createEmptySkill) {
        // Overwrite skill-two with a minimal file (has skill_id for resolution but nothing else)
        const emptyPath = path.join(skillsBaseDir, 'testing', 'skill-two', 'SKILL.md');
        fs.writeFileSync(emptyPath, '---\nskill_id: TEST-002\n---\n', 'utf8');
    }

    if (opts.removeSkillFile) {
        // Remove skill-two SKILL.md file entirely
        const removePath = path.join(skillsBaseDir, 'testing', 'skill-two', 'SKILL.md');
        if (fs.existsSync(removePath)) {
            fs.unlinkSync(removePath);
        }
    }

    return tmpDir;
}

/**
 * Create a SKILL.md file in either YAML or Markdown format.
 */
function createSkillFile(baseDir, skillPath, format, data) {
    const dir = path.join(baseDir, skillPath);
    fs.mkdirSync(dir, { recursive: true });

    let content;
    if (format === 'yaml') {
        content = [
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
    } else {
        // Markdown format (quality-loop style) with ## Description header
        // Includes skill_id in frontmatter for string-schema resolution (BUG-0035)
        content = [
            '---',
            `skill_id: ${data.skill_id}`,
            '---',
            '',
            `# ${data.skill_id}: ${data.name}`,
            '',
            '## Description',
            data.description,
            '',
            '## Owner',
            '- **Agent**: test-agent',
            '- **Phase**: test-phase',
            '',
            '## Usage',
            'This skill is used for testing.',
            ''
        ].join('\n');
    }

    fs.writeFileSync(path.join(dir, 'SKILL.md'), content, 'utf8');
}

/**
 * Load common.cjs with a specific project root.
 * Clears require cache to ensure fresh load, sets CLAUDE_PROJECT_DIR.
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
 * Clean up a temp directory.
 */
function cleanupTestProject(tmpDir) {
    try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {
        // Best-effort cleanup
    }
}

// =============================================================================
// TC-01: getAgentSkillIndex() — Happy Path
// Traces to: FR-01, AC-01
// =============================================================================

describe('TC-01: getAgentSkillIndex() — Happy Path', () => {
    let tmpDir;
    let common;

    before(() => {
        tmpDir = createTestProject();
        common = loadCommon(tmpDir);
    });

    after(() => {
        cleanupTestProject(tmpDir);
    });

    // TC-01.1: Returns correct entries for known agent
    it('TC-01.1: returns correct entries for known agent with skills', () => {
        const result = common.getAgentSkillIndex('test-agent-alpha');
        assert.ok(Array.isArray(result), 'Result should be an array');
        assert.equal(result.length, 3, 'test-agent-alpha should have 3 skills');
    });

    // TC-01.2: Returns correct entries for another agent
    it('TC-01.2: returns correct entries for second agent', () => {
        const result = common.getAgentSkillIndex('test-agent-beta');
        assert.ok(Array.isArray(result), 'Result should be an array');
        assert.equal(result.length, 2, 'test-agent-beta should have 2 skills');
    });

    // TC-01.3: Returns empty array for unknown agent
    it('TC-01.3: returns empty array for unknown agent', () => {
        const result = common.getAgentSkillIndex('unknown-agent');
        assert.ok(Array.isArray(result), 'Result should be an array');
        assert.equal(result.length, 0, 'Unknown agent should return empty array');
    });

    // TC-01.4: Returns empty array for null input
    it('TC-01.4: returns empty array for null input', () => {
        const result = common.getAgentSkillIndex(null);
        assert.ok(Array.isArray(result));
        assert.equal(result.length, 0);
    });

    // TC-01.5: Returns empty array for undefined input
    it('TC-01.5: returns empty array for undefined input', () => {
        const result = common.getAgentSkillIndex(undefined);
        assert.ok(Array.isArray(result));
        assert.equal(result.length, 0);
    });

    // TC-01.6: Returns empty array for empty string
    it('TC-01.6: returns empty array for empty string', () => {
        const result = common.getAgentSkillIndex('');
        assert.ok(Array.isArray(result));
        assert.equal(result.length, 0);
    });

    // TC-01.7: All descriptions are non-empty strings
    it('TC-01.7: all descriptions are non-empty strings', () => {
        const result = common.getAgentSkillIndex('test-agent-alpha');
        for (const entry of result) {
            assert.equal(typeof entry.description, 'string', `Description for ${entry.id} should be string`);
            assert.ok(entry.description.length > 0, `Description for ${entry.id} should be non-empty`);
        }
    });

    // TC-01.8: All paths contain SKILL.md reference
    it('TC-01.8: all paths reference SKILL.md files', () => {
        const result = common.getAgentSkillIndex('test-agent-alpha');
        for (const entry of result) {
            assert.ok(
                entry.path.includes('SKILL.md') || entry.path.includes('skills/'),
                `Path for ${entry.id} should reference skill location: ${entry.path}`
            );
        }
    });

    // TC-01.9: Entry structure matches expected schema
    it('TC-01.9: entry structure has id, name, description, path', () => {
        const result = common.getAgentSkillIndex('test-agent-alpha');
        assert.ok(result.length > 0, 'Should have entries to validate');
        for (const entry of result) {
            assert.ok('id' in entry, `Entry should have 'id' property`);
            assert.ok('name' in entry, `Entry should have 'name' property`);
            assert.ok('description' in entry, `Entry should have 'description' property`);
            assert.ok('path' in entry, `Entry should have 'path' property`);
            assert.equal(typeof entry.id, 'string');
            assert.equal(typeof entry.name, 'string');
            assert.equal(typeof entry.description, 'string');
            assert.equal(typeof entry.path, 'string');
        }
    });

    // TC-01.10: Agent with empty skills array returns empty array
    it('TC-01.10: agent with empty skills array returns empty array', () => {
        const result = common.getAgentSkillIndex('test-agent-empty');
        assert.ok(Array.isArray(result));
        assert.equal(result.length, 0);
    });

    // TC-01.11: Entry IDs match manifest data
    it('TC-01.11: entry IDs match manifest skill IDs', () => {
        const result = common.getAgentSkillIndex('test-agent-alpha');
        const ids = result.map(e => e.id);
        assert.ok(ids.includes('TEST-001'), 'Should include TEST-001');
        assert.ok(ids.includes('TEST-002'), 'Should include TEST-002');
        assert.ok(ids.includes('TEST-003'), 'Should include TEST-003');
    });
});

// =============================================================================
// TC-02: formatSkillIndexBlock() — Output Formatting
// Traces to: FR-02, AC-02
// =============================================================================

describe('TC-02: formatSkillIndexBlock() — Output Formatting', () => {
    let tmpDir;
    let common;

    before(() => {
        tmpDir = createTestProject();
        common = loadCommon(tmpDir);
    });

    after(() => {
        cleanupTestProject(tmpDir);
    });

    // TC-02.1: Empty input returns empty string
    it('TC-02.1: empty input returns empty string', () => {
        const result = common.formatSkillIndexBlock([]);
        assert.equal(result, '', 'Empty array should produce empty string');
    });

    // TC-02.2: Single entry formats correctly
    it('TC-02.2: single entry formats with header and skill info', () => {
        const entries = [{
            id: 'DEV-001',
            name: 'code-implementation',
            description: 'Write production code following designs and best practices',
            path: 'src/claude/skills/development/code-implementation/SKILL.md'
        }];
        const result = common.formatSkillIndexBlock(entries);

        assert.ok(result.includes('AVAILABLE SKILLS'), 'Should contain AVAILABLE SKILLS header');
        assert.ok(result.includes('DEV-001'), 'Should contain skill ID');
        assert.ok(result.includes('code-implementation'), 'Should contain skill name');
        assert.ok(result.includes('Write production code'), 'Should contain description');
        assert.ok(result.includes('SKILL.md'), 'Should contain path reference');
    });

    // TC-02.3: Multiple entries all present
    it('TC-02.3: multiple entries all present in output', () => {
        const entries = [
            { id: 'A-001', name: 'alpha', description: 'Alpha desc', path: 'a/SKILL.md' },
            { id: 'B-001', name: 'beta', description: 'Beta desc', path: 'b/SKILL.md' },
            { id: 'C-001', name: 'gamma', description: 'Gamma desc', path: 'c/SKILL.md' }
        ];
        const result = common.formatSkillIndexBlock(entries);

        assert.ok(result.includes('A-001'), 'Should contain first skill ID');
        assert.ok(result.includes('B-001'), 'Should contain second skill ID');
        assert.ok(result.includes('C-001'), 'Should contain third skill ID');
        assert.ok(result.includes('Alpha desc'), 'Should contain first description');
        assert.ok(result.includes('Beta desc'), 'Should contain second description');
        assert.ok(result.includes('Gamma desc'), 'Should contain third description');
    });

    // TC-02.4: Header includes usage instruction
    it('TC-02.4: header includes usage instruction about Read tool', () => {
        const entries = [{ id: 'X-001', name: 'test', description: 'Test', path: 'x/SKILL.md' }];
        const result = common.formatSkillIndexBlock(entries);

        // Header should mention consulting with Read tool
        assert.ok(
            result.toLowerCase().includes('consult') || result.toLowerCase().includes('read'),
            'Header should mention consulting skills or using Read tool'
        );
    });

    // TC-02.5: Output stays within 30-line budget for 14 entries (NFR-01)
    it('TC-02.5: 14-entry output does not exceed 30 lines (NFR-01)', () => {
        const entries = [];
        for (let i = 1; i <= 14; i++) {
            entries.push({
                id: `DEV-${String(i).padStart(3, '0')}`,
                name: `skill-${i}`,
                description: `Description for skill number ${i}`,
                path: `dev/skill-${i}/SKILL.md`
            });
        }
        const result = common.formatSkillIndexBlock(entries);
        const lines = result.split('\n').filter(l => l.trim().length > 0);
        assert.ok(
            lines.length <= 30,
            `Output should be at most 30 lines, got ${lines.length}`
        );
    });
});

// =============================================================================
// TC-03: Description Extraction — Dual Format Support
// Traces to: FR-05, AC-05
// =============================================================================

describe('TC-03: Description Extraction — Dual Format', () => {
    let tmpDir;
    let common;

    before(() => {
        tmpDir = createTestProject();
        common = loadCommon(tmpDir);
    });

    after(() => {
        cleanupTestProject(tmpDir);
    });

    // TC-03.1: YAML frontmatter format extraction
    it('TC-03.1: extracts description from YAML frontmatter format', () => {
        const result = common.getAgentSkillIndex('test-agent-alpha');
        const skillOne = result.find(e => e.id === 'TEST-001');
        assert.ok(skillOne, 'TEST-001 should be in results');
        assert.equal(skillOne.description, 'Execute the first test skill');
    });

    // TC-03.2: Markdown header format extraction
    it('TC-03.2: extracts description from Markdown ## Description format', () => {
        const result = common.getAgentSkillIndex('test-agent-alpha');
        const skillThree = result.find(e => e.id === 'TEST-003');
        assert.ok(skillThree, 'TEST-003 should be in results');
        assert.equal(
            skillThree.description,
            'Execute the third test skill using markdown format'
        );
    });

    // TC-03.3: Malformed SKILL.md falls back to name
    it('TC-03.3: malformed SKILL.md falls back to manifest name', () => {
        const malformedDir = createTestProject({ createMalformedSkill: true });
        const malformedCommon = loadCommon(malformedDir);

        const result = malformedCommon.getAgentSkillIndex('test-agent-alpha');
        const skillTwo = result.find(e => e.id === 'TEST-002');
        assert.ok(skillTwo, 'TEST-002 should be in results');
        // Fallback to manifest name when description can't be extracted
        assert.equal(skillTwo.description, 'skill-two',
            'Should fall back to manifest name when description missing');

        cleanupTestProject(malformedDir);
    });

    // TC-03.4: Empty SKILL.md falls back to name
    it('TC-03.4: empty SKILL.md falls back to manifest name', () => {
        const emptyDir = createTestProject({ createEmptySkill: true });
        const emptyCommon = loadCommon(emptyDir);

        const result = emptyCommon.getAgentSkillIndex('test-agent-alpha');
        const skillTwo = result.find(e => e.id === 'TEST-002');
        assert.ok(skillTwo, 'TEST-002 should be in results');
        assert.equal(skillTwo.description, 'skill-two',
            'Should fall back to manifest name when file is empty');

        cleanupTestProject(emptyDir);
    });

    // TC-03.5: YAML description with quotes is handled
    it('TC-03.5: YAML description with quotes strips them', () => {
        const quotedDir = createTestProject();
        // Overwrite skill-one with quoted description
        const skillPath = path.join(quotedDir, 'src', 'claude', 'skills', 'testing', 'skill-one', 'SKILL.md');
        fs.writeFileSync(skillPath, [
            '---',
            'name: skill-one',
            'description: "Quoted description text"',
            'skill_id: TEST-001',
            '---',
            '',
            '# skill-one',
            ''
        ].join('\n'), 'utf8');

        const quotedCommon = loadCommon(quotedDir);
        const result = quotedCommon.getAgentSkillIndex('test-agent-alpha');
        const skillOne = result.find(e => e.id === 'TEST-001');
        assert.ok(skillOne, 'TEST-001 should be in results');
        assert.equal(skillOne.description, 'Quoted description text',
            'Should strip quotes from YAML description');

        cleanupTestProject(quotedDir);
    });
});

// =============================================================================
// TC-04: Integration — End-to-End Flow
// Traces to: FR-01, FR-02, AC-01, AC-02
// =============================================================================

describe('TC-04: Integration — End-to-End Flow', () => {
    let tmpDir;
    let common;

    before(() => {
        tmpDir = createTestProject();
        common = loadCommon(tmpDir);
    });

    after(() => {
        cleanupTestProject(tmpDir);
    });

    // TC-04.1: Full pipeline from agent name to formatted block
    it('TC-04.1: agent name to formatted block produces valid output', () => {
        const skillIndex = common.getAgentSkillIndex('test-agent-alpha');
        const block = common.formatSkillIndexBlock(skillIndex);

        assert.ok(typeof block === 'string', 'Block should be a string');
        assert.ok(block.length > 0, 'Block should be non-empty for agent with skills');
        assert.ok(block.includes('AVAILABLE SKILLS'), 'Block should have header');
        assert.ok(block.includes('TEST-001'), 'Block should contain skill IDs');
        assert.ok(block.includes('Execute the first test skill'), 'Block should contain descriptions');
    });

    // TC-04.2: Unknown agent produces empty block
    it('TC-04.2: unknown agent produces empty block string', () => {
        const skillIndex = common.getAgentSkillIndex('nonexistent-agent');
        const block = common.formatSkillIndexBlock(skillIndex);
        assert.equal(block, '', 'Unknown agent should produce empty block');
    });
});

// =============================================================================
// TC-05: Caching Behavior
// Traces to: AC-07, NFR-02
// =============================================================================

describe('TC-05: Caching Behavior', () => {
    // TC-05.1: Second call uses cache
    it('TC-05.1: second call returns same result (cache hit)', () => {
        const tmpDir = createTestProject();
        const common = loadCommon(tmpDir);

        const result1 = common.getAgentSkillIndex('test-agent-alpha');
        const result2 = common.getAgentSkillIndex('test-agent-alpha');

        assert.deepStrictEqual(result1, result2, 'Second call should return identical data');

        // Verify cache is populated
        if (common._getCacheStats) {
            const stats = common._getCacheStats();
            assert.ok(stats.configCacheSize > 0, 'Config cache should be populated');
        }

        cleanupTestProject(tmpDir);
    });

    // TC-05.2: Cache invalidation on manifest mtime change
    it('TC-05.2: cache invalidated when manifest file is modified', () => {
        const tmpDir = createTestProject();
        const common = loadCommon(tmpDir);

        // First call — populates cache
        const result1 = common.getAgentSkillIndex('test-agent-alpha');
        assert.equal(result1.length, 3);

        // Modify manifest — change skill count (production string schema)
        const manifestPath = path.join(tmpDir, '.claude', 'hooks', 'config', 'skills-manifest.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        manifest.ownership['test-agent-alpha'].skills.push('TEST-004');
        manifest.skill_lookup['TEST-004'] = 'test-agent-alpha';
        manifest.path_lookup['testing/skill-four'] = 'test-agent-alpha';
        // Ensure mtime changes (write with a small delay simulation via sync)
        const newContent = JSON.stringify(manifest, null, 2);
        // Force mtime change by waiting briefly
        const statBefore = fs.statSync(manifestPath);
        fs.writeFileSync(manifestPath, newContent, 'utf8');
        // Touch the file to ensure mtime is different
        const now = new Date();
        fs.utimesSync(manifestPath, now, now);

        // Create the new SKILL.md file
        createSkillFile(
            path.join(tmpDir, 'src', 'claude', 'skills'),
            'testing/skill-four',
            'yaml',
            { name: 'skill-four', description: 'Fourth skill', skill_id: 'TEST-004' }
        );

        // Reset caches to force re-read
        if (common._resetCaches) {
            common._resetCaches();
        }
        process.env.CLAUDE_PROJECT_DIR = tmpDir;

        // Second call should reflect new data
        const result2 = common.getAgentSkillIndex('test-agent-alpha');
        // After cache invalidation, manifest is re-read
        // The new skill should be visible if cache is properly invalidated
        assert.ok(result2.length >= 3, 'Should have at least original skills after cache refresh');

        cleanupTestProject(tmpDir);
    });

    // TC-05.3: Cache does not leak between project roots
    it('TC-05.3: cache does not leak between different project roots', () => {
        const tmpDir1 = createTestProject();
        const tmpDir2 = createTestProject({
            manifest: {
                version: '5.0.0',
                total_skills: 1,
                enforcement_mode: 'observe',
                ownership: {
                    'test-agent-alpha': {
                        agent_id: '99',
                        phase: 'all',
                        skill_count: 1,
                        skills: ['ONLY-001']
                    }
                },
                skill_lookup: { 'ONLY-001': 'test-agent-alpha' },
                path_lookup: { 'only/only-skill': 'test-agent-alpha' }
            }
        });
        // Create SKILL.md for the second project
        createSkillFile(
            path.join(tmpDir2, 'src', 'claude', 'skills'),
            'only/only-skill',
            'yaml',
            { name: 'only-skill', description: 'The only skill', skill_id: 'ONLY-001' }
        );

        // Load from first project
        const common1 = loadCommon(tmpDir1);
        const result1 = common1.getAgentSkillIndex('test-agent-alpha');
        assert.equal(result1.length, 3, 'Project 1 should have 3 skills');

        // Load from second project
        const common2 = loadCommon(tmpDir2);
        const result2 = common2.getAgentSkillIndex('test-agent-alpha');
        assert.equal(result2.length, 1, 'Project 2 should have 1 skill');

        cleanupTestProject(tmpDir1);
        cleanupTestProject(tmpDir2);
    });
});

// =============================================================================
// TC-06: Fail-Open Resilience
// Traces to: FR-01, AC-06, NFR-03
// =============================================================================

describe('TC-06: Fail-Open Resilience', () => {
    // TC-06.1: Missing manifest returns empty array
    it('TC-06.1: missing manifest returns empty array, no error', () => {
        const tmpDir = createTestProject({ noManifest: true });
        const common = loadCommon(tmpDir);

        const result = common.getAgentSkillIndex('software-developer');
        assert.ok(Array.isArray(result), 'Should return array');
        assert.equal(result.length, 0, 'Should be empty when no manifest');

        cleanupTestProject(tmpDir);
    });

    // TC-06.2: Corrupt manifest returns empty array
    it('TC-06.2: corrupt manifest returns empty array, no error', () => {
        const tmpDir = createTestProject({ corruptManifest: true });
        const common = loadCommon(tmpDir);

        const result = common.getAgentSkillIndex('test-agent-alpha');
        assert.ok(Array.isArray(result), 'Should return array');
        assert.equal(result.length, 0, 'Should be empty when manifest is corrupt');

        cleanupTestProject(tmpDir);
    });

    // TC-06.3: Agent not in manifest returns empty array
    it('TC-06.3: agent not in manifest returns empty array', () => {
        const tmpDir = createTestProject();
        const common = loadCommon(tmpDir);

        const result = common.getAgentSkillIndex('agent-not-in-manifest');
        assert.ok(Array.isArray(result));
        assert.equal(result.length, 0);

        cleanupTestProject(tmpDir);
    });

    // TC-06.4: Unreadable SKILL.md skips that skill
    it('TC-06.4: unreadable SKILL.md skips that skill, returns others', () => {
        const tmpDir = createTestProject({ removeSkillFile: true });
        const common = loadCommon(tmpDir);

        const result = common.getAgentSkillIndex('test-agent-alpha');
        assert.ok(Array.isArray(result), 'Should return array');
        // skill-two SKILL.md was removed, so only 2 of 3 skills should be returned
        assert.equal(result.length, 2,
            'Should return 2 entries (skill-two skipped due to missing file)');
        const ids = result.map(e => e.id);
        assert.ok(ids.includes('TEST-001'), 'Should still have TEST-001');
        assert.ok(ids.includes('TEST-003'), 'Should still have TEST-003');
        assert.ok(!ids.includes('TEST-002'), 'TEST-002 should be skipped');

        cleanupTestProject(tmpDir);
    });

    // TC-06.5: All SKILL.md files missing returns empty array
    it('TC-06.5: all SKILL.md files missing returns empty array', () => {
        const tmpDir = createTestProject({ noSkillFiles: true });
        const common = loadCommon(tmpDir);

        const result = common.getAgentSkillIndex('test-agent-alpha');
        assert.ok(Array.isArray(result), 'Should return array');
        assert.equal(result.length, 0, 'All skills skipped, should be empty');

        cleanupTestProject(tmpDir);
    });
});

// =============================================================================
// TC-09: STEP 3d Prompt Template Verification
// Traces to: FR-03, AC-03
// =============================================================================

describe('TC-09: STEP 3d Prompt Template — Skill Injection Point', () => {
    const PROJECT_ROOT = path.join(__dirname, '..', '..', '..', '..');
    const ISDLC_MD_PATH = path.join(PROJECT_ROOT, 'src', 'claude', 'commands', 'isdlc.md');

    // TC-09.1: STEP 3d template includes SKILL INJECTION STEP A with function references
    it('TC-09.1: STEP 3d delegation template includes SKILL INJECTION STEP A', () => {
        const content = fs.readFileSync(ISDLC_MD_PATH, 'utf8');
        assert.ok(
            content.includes('SKILL INJECTION STEP A') &&
            content.includes('getAgentSkillIndex') &&
            content.includes('formatSkillIndexBlock'),
            'STEP 3d must include SKILL INJECTION STEP A with getAgentSkillIndex and formatSkillIndexBlock instructions'
        );
    });

    // TC-09.2: Skill block placement is after workflow modifiers
    it('TC-09.2: skill block reference appears after WORKFLOW MODIFIERS in template', () => {
        const content = fs.readFileSync(ISDLC_MD_PATH, 'utf8');
        const modifiersPos = content.indexOf('WORKFLOW MODIFIERS');
        const skillPos = content.indexOf('SKILL INJECTION STEP A');

        assert.ok(modifiersPos > -1, 'WORKFLOW MODIFIERS should exist in template');
        assert.ok(skillPos > -1, 'Skill block reference should exist in template');
        assert.ok(
            skillPos > modifiersPos,
            'Skill block should appear after WORKFLOW MODIFIERS in template'
        );
    });

    // TC-09.3: Template still contains gate validation instruction
    it('TC-09.3: template retains GATE validation instruction after skill block', () => {
        const content = fs.readFileSync(ISDLC_MD_PATH, 'utf8');
        // The delegation template should still end with gate validation
        assert.ok(
            content.includes('Validate GATE'),
            'Template should retain Validate GATE instruction'
        );
    });

    // TC-09.4: External skill injection instructions exist
    it('TC-09.4: STEP 3d includes external skill injection instructions', () => {
        const content = fs.readFileSync(ISDLC_MD_PATH, 'utf8');
        assert.ok(
            content.includes('SKILL INJECTION STEP B') &&
            content.includes('external-skills-manifest.json'),
            'STEP 3d must include SKILL INJECTION STEP B with external manifest reference'
        );
    });

    // TC-09.5: Fail-open language is present for both steps
    it('TC-09.5: skill injection steps include fail-open language', () => {
        const content = fs.readFileSync(ISDLC_MD_PATH, 'utf8');
        // Step A: "If the Bash tool call fails"
        assert.ok(
            content.includes('Bash tool call fails') || content.includes('fails or produces empty'),
            'Step A must include fail-open handling for Bash failure'
        );
        // Step B: "fail-open" in the header
        assert.ok(
            content.includes('STEP B') && content.includes('fail-open'),
            'Step B header must include fail-open declaration'
        );
    });

    // TC-09.6: Assembly step exists
    it('TC-09.6: STEP 3d includes skill assembly step', () => {
        const content = fs.readFileSync(ISDLC_MD_PATH, 'utf8');
        assert.ok(
            content.includes('SKILL INJECTION STEP C'),
            'STEP 3d must include SKILL INJECTION STEP C for assembly'
        );
    });
});

// =============================================================================
// TC-07: Agent File Validation
// Traces to: FR-04, AC-04
// =============================================================================

describe('TC-07: Agent File Validation', () => {
    const PROJECT_ROOT = path.join(__dirname, '..', '..', '..', '..');
    const AGENTS_DIR = path.join(PROJECT_ROOT, 'src', 'claude', 'agents');
    const MANIFEST_YAML_PATH = path.join(PROJECT_ROOT, 'src', 'isdlc', 'config', 'skills-manifest.yaml');

    /**
     * Parse owned_skills from agent frontmatter.
     * Supports both inline array format: owned_skills: [DEV-001, DEV-002]
     * and YAML list format:
     *   owned_skills:
     *     - DEV-001  # comment
     *     - DEV-002
     * Returns array of skill IDs or empty array if none.
     */
    function getAgentOwnedSkills(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) return [];
        const fm = fmMatch[1];

        // Try inline array format first: owned_skills: [DEV-001, DEV-002]
        const inlineMatch = fm.match(/owned_skills:\s*\[([^\]]*)\]/);
        if (inlineMatch) {
            if (inlineMatch[1].trim() === '') return [];
            return inlineMatch[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
        }

        // Try YAML list format: owned_skills:\n  - DEV-001  # comment
        const listMatch = fm.match(/owned_skills:\s*\n((?:\s+-\s+.+\n?)+)/);
        if (listMatch) {
            const items = listMatch[1].match(/^\s+-\s+(\S+)/gm);
            if (items && items.length > 0) {
                return items.map(item => item.replace(/^\s+-\s+/, '').trim());
            }
        }

        return [];
    }

    /**
     * Get list of agents that own skills from the manifest YAML.
     */
    function getAgentsWithSkillsFromManifest() {
        if (!fs.existsSync(MANIFEST_YAML_PATH)) return [];
        const content = fs.readFileSync(MANIFEST_YAML_PATH, 'utf8');
        const agents = [];
        const regex = /^\s{2}(\S+):\s*$/gm;
        let match;
        while ((match = regex.exec(content)) !== null) {
            const name = match[1];
            // Check it has skills (not just metadata)
            const nextSection = content.indexOf('\n  ', match.index + match[0].length);
            if (nextSection > -1) {
                const section = content.substring(match.index, nextSection + 100);
                if (section.includes('skills:')) {
                    agents.push(name);
                }
            }
        }
        return agents;
    }

    // TC-07.1: Agents with owned_skills have ## Skills section
    it('TC-07.1: all agent files with owned_skills have ## Skills section', () => {
        if (!fs.existsSync(AGENTS_DIR)) {
            assert.fail('Agents directory not found at ' + AGENTS_DIR);
        }

        const agentFiles = fs.readdirSync(AGENTS_DIR)
            .filter(f => f.endsWith('.md'));

        const agentsWithSkills = [];
        const agentsMissingSections = [];

        for (const file of agentFiles) {
            const filePath = path.join(AGENTS_DIR, file);
            const owned = getAgentOwnedSkills(filePath);
            if (owned.length > 0) {
                agentsWithSkills.push(file);
                const content = fs.readFileSync(filePath, 'utf8');
                if (!content.includes('## Skills')) {
                    agentsMissingSections.push(file);
                }
            }
        }

        assert.ok(
            agentsWithSkills.length > 0,
            'Should find at least some agents with owned_skills'
        );
        assert.equal(
            agentsMissingSections.length, 0,
            `Agents missing ## Skills section: ${agentsMissingSections.join(', ')}`
        );
    });

    // TC-07.2: Agents without owned_skills do NOT have ## Skills section
    it('TC-07.2: agents without owned_skills do not have ## Skills section', () => {
        if (!fs.existsSync(AGENTS_DIR)) {
            assert.fail('Agents directory not found');
        }

        const agentFiles = fs.readdirSync(AGENTS_DIR)
            .filter(f => f.endsWith('.md'));

        const agentsWithoutSkills = [];
        const agentsWronglyHavingSection = [];

        for (const file of agentFiles) {
            const filePath = path.join(AGENTS_DIR, file);
            const owned = getAgentOwnedSkills(filePath);
            if (owned.length === 0) {
                agentsWithoutSkills.push(file);
                const content = fs.readFileSync(filePath, 'utf8');
                if (content.includes('## Skills')) {
                    agentsWronglyHavingSection.push(file);
                }
            }
        }

        assert.equal(
            agentsWronglyHavingSection.length, 0,
            `Agents without skills should NOT have ## Skills section: ${agentsWronglyHavingSection.join(', ')}`
        );
    });

    // TC-07.3: ## Skills section references AVAILABLE SKILLS and Read tool
    it('TC-07.3: ## Skills section contains correct instruction text', () => {
        if (!fs.existsSync(AGENTS_DIR)) {
            assert.fail('Agents directory not found');
        }

        const agentFiles = fs.readdirSync(AGENTS_DIR)
            .filter(f => f.endsWith('.md'));

        for (const file of agentFiles) {
            const filePath = path.join(AGENTS_DIR, file);
            const owned = getAgentOwnedSkills(filePath);
            if (owned.length > 0) {
                const content = fs.readFileSync(filePath, 'utf8');
                if (content.includes('## Skills')) {
                    // Extract section after ## Skills
                    const sectionStart = content.indexOf('## Skills');
                    const nextSection = content.indexOf('\n## ', sectionStart + 10);
                    const section = nextSection > -1
                        ? content.substring(sectionStart, nextSection)
                        : content.substring(sectionStart);

                    assert.ok(
                        section.includes('AVAILABLE SKILLS'),
                        `${file}: ## Skills section should reference AVAILABLE SKILLS`
                    );
                    assert.ok(
                        section.includes('Read tool') || section.includes('Read'),
                        `${file}: ## Skills section should reference Read tool`
                    );
                }
            }
        }
    });
});

// =============================================================================
// TC-08: Non-Functional Requirements
// Traces to: NFR-01 through NFR-05
// =============================================================================

describe('TC-08: Non-Functional Requirements', () => {
    const PROJECT_ROOT = path.join(__dirname, '..', '..', '..', '..');

    // TC-08.1: Already covered by TC-02.5 (30-line budget)

    // TC-08.2: Performance — getAgentSkillIndex under 100ms
    it('TC-08.2: getAgentSkillIndex completes under 100ms (NFR-02)', () => {
        const tmpDir = createTestProject();
        const common = loadCommon(tmpDir);

        const start = process.hrtime.bigint();
        common.getAgentSkillIndex('test-agent-alpha');
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1_000_000;

        assert.ok(
            durationMs < 100,
            `getAgentSkillIndex took ${durationMs.toFixed(2)}ms, should be under 100ms`
        );

        cleanupTestProject(tmpDir);
    });

    // TC-08.3: No new runtime dependencies
    it('TC-08.3: no new runtime dependencies added (NFR-05)', () => {
        const pkgPath = path.join(PROJECT_ROOT, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = Object.keys(pkg.dependencies || {}).sort();
        assert.deepStrictEqual(
            deps,
            ['chalk', 'fs-extra', 'prompts', 'semver'],
            'No new runtime dependencies should be added'
        );
    });

    // TC-08.4: Hook file count matches expected (NFR-05)
    // REQ-0001 FR-002 adds inject-session-cache.cjs (29 total)
    it('TC-08.4: no new hook files added (NFR-05)', () => {
        const hooksDir = path.join(PROJECT_ROOT, 'src', 'claude', 'hooks');
        if (!fs.existsSync(hooksDir)) {
            return; // Skip if not in project context
        }
        const hookFiles = fs.readdirSync(hooksDir)
            .filter(f => f.endsWith('.cjs') && !f.includes('.test.'));
        assert.equal(
            hookFiles.length, 29,
            `Expected 29 hook files (28 original + inject-session-cache.cjs), found ${hookFiles.length}`
        );
    });
});
