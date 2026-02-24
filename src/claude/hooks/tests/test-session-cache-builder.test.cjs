'use strict';

/**
 * Unit Tests: Session Cache Builder (REQ-0001)
 * =============================================
 * Tests for rebuildSessionCache(), _buildSkillPathIndex(), _collectSourceMtimes(),
 * getAgentSkillIndex() refactor, hook registration, and manifest cleanup.
 *
 * Framework: node:test + node:assert/strict (CJS stream)
 * Run: node --test src/claude/hooks/tests/test-session-cache-builder.test.cjs
 *
 * Traces to: FR-001, FR-003, FR-008, FR-009, NFR-006, NFR-007, NFR-009
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Module loading
// ---------------------------------------------------------------------------

const COMMON_SRC = path.resolve(__dirname, '..', 'lib', 'common.cjs');
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

/** Require common.cjs, clearing cache first. */
function requireCommon() {
    delete require.cache[require.resolve(COMMON_SRC)];
    return require(COMMON_SRC);
}

/** Create a minimal test project directory with .isdlc/ */
function createTestProject() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdlc-cache-test-'));
    fs.mkdirSync(path.join(tmpDir, '.isdlc'), { recursive: true });
    return tmpDir;
}

/** Create a full test project with all source files */
function createFullTestProject() {
    const tmpDir = createTestProject();

    // Constitution
    fs.mkdirSync(path.join(tmpDir, 'docs', 'isdlc'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'docs', 'isdlc', 'constitution.md'),
        '# Test Constitution\nArticle I: Test article content\n');

    // Workflows
    fs.mkdirSync(path.join(tmpDir, 'src', 'isdlc', 'config'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'isdlc', 'config', 'workflows.json'),
        JSON.stringify({ feature: { phases: ['01-requirements'] } }, null, 2));

    // Iteration requirements
    fs.mkdirSync(path.join(tmpDir, '.claude', 'hooks', 'config'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.claude', 'hooks', 'config', 'iteration-requirements.json'),
        JSON.stringify({ version: '2.0.0', phases: {} }, null, 2));

    // Artifact paths
    fs.writeFileSync(path.join(tmpDir, '.claude', 'hooks', 'config', 'artifact-paths.json'),
        JSON.stringify({ paths: {} }, null, 2));

    // Skills manifest (minimal, production schema v5)
    const manifest = {
        version: '5.0.0',
        total_skills: 4,
        enforcement_mode: 'observe',
        ownership: {
            'agent-one': { skills: ['TST-001', 'TST-002'] },
            'agent-two': { skills: ['TST-003', 'TST-004'] }
        },
        skill_lookup: {
            'TST-001': 'agent-one',
            'TST-002': 'agent-one',
            'TST-003': 'agent-two',
            'TST-004': 'agent-two'
        }
    };
    fs.mkdirSync(path.join(tmpDir, 'src', 'claude', 'hooks', 'config'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'claude', 'hooks', 'config', 'skills-manifest.json'),
        JSON.stringify(manifest, null, 2));
    // Also write to .claude/hooks/config/ for loadManifest
    fs.writeFileSync(path.join(tmpDir, '.claude', 'hooks', 'config', 'skills-manifest.json'),
        JSON.stringify(manifest, null, 2));

    // Create SKILL.md files
    createSkillFile(tmpDir, 'src/claude/skills/testing/skill-one', 'TST-001', 'First test skill');
    createSkillFile(tmpDir, 'src/claude/skills/testing/skill-two', 'TST-002', 'Second test skill');
    createSkillFile(tmpDir, 'src/claude/skills/dev/skill-three', 'TST-003', 'Third test skill');
    createSkillFile(tmpDir, 'src/claude/skills/dev/skill-four', 'TST-004', 'Fourth test skill');

    // Persona files
    fs.mkdirSync(path.join(tmpDir, 'src', 'claude', 'agents'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'claude', 'agents', 'persona-business-analyst.md'),
        'BA persona content\n');
    fs.writeFileSync(path.join(tmpDir, 'src', 'claude', 'agents', 'persona-solutions-architect.md'),
        'SA persona content\n');
    fs.writeFileSync(path.join(tmpDir, 'src', 'claude', 'agents', 'persona-system-designer.md'),
        'SD persona content\n');

    // Topic files
    fs.mkdirSync(path.join(tmpDir, 'src', 'claude', 'skills', 'analysis-topics', 'architecture'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'claude', 'skills', 'analysis-topics', 'architecture', 'architecture.md'),
        'Architecture topic content\n');
    fs.mkdirSync(path.join(tmpDir, 'src', 'claude', 'skills', 'analysis-topics', 'problem-discovery'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'claude', 'skills', 'analysis-topics', 'problem-discovery', 'problem-discovery.md'),
        'Problem discovery topic content\n');

    return tmpDir;
}

function createSkillFile(tmpDir, relDir, skillId, description) {
    const fullDir = path.join(tmpDir, relDir);
    fs.mkdirSync(fullDir, { recursive: true });
    fs.writeFileSync(path.join(fullDir, 'SKILL.md'),
        `---\nskill_id: ${skillId}\ndescription: ${description}\n---\n# Skill ${skillId}\n`);
}

function cleanup(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

// =============================================================================
// rebuildSessionCache() tests
// =============================================================================

describe('rebuildSessionCache()', () => {
    let common;
    let savedEnv;

    before(() => {
        savedEnv = { ...process.env };
        process.env.NODE_ENV = 'test';
        process.env.ISDLC_TEST_MODE = '1';
        common = requireCommon();
    });

    after(() => {
        process.env = savedEnv;
    });

    beforeEach(() => {
        if (common._resetCaches) common._resetCaches();
    });

    // TC-BUILD-01
    it('TC-BUILD-01: produces valid cache file with all sections', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const result = common.rebuildSessionCache({ projectRoot: tmpDir });
            assert.ok(result.path.endsWith(path.join('.isdlc', 'session-cache.md')));
            assert.ok(result.size > 0);
            assert.ok(result.hash.length > 0);
            assert.ok(Array.isArray(result.sections));
            assert.ok(Array.isArray(result.skipped));
            assert.ok(fs.existsSync(result.path));
            const content = fs.readFileSync(result.path, 'utf8');
            assert.equal(content.length, result.size);
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-BUILD-02
    it('TC-BUILD-02: cache file contains section delimiters', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            assert.ok(content.includes('<!-- SECTION: CONSTITUTION -->'));
            assert.ok(content.includes('<!-- /SECTION: CONSTITUTION -->'));
            assert.ok(content.includes('<!-- SECTION: WORKFLOW_CONFIG -->'));
            assert.ok(content.includes('<!-- /SECTION: WORKFLOW_CONFIG -->'));
            assert.ok(content.includes('<!-- SECTION: ITERATION_REQUIREMENTS -->'));
            assert.ok(content.includes('<!-- /SECTION: ITERATION_REQUIREMENTS -->'));
            assert.ok(content.includes('<!-- SECTION: ARTIFACT_PATHS -->'));
            assert.ok(content.includes('<!-- /SECTION: ARTIFACT_PATHS -->'));
            assert.ok(content.includes('<!-- SECTION: SKILLS_MANIFEST -->'));
            assert.ok(content.includes('<!-- /SECTION: SKILLS_MANIFEST -->'));
            assert.ok(content.includes('<!-- SECTION: SKILL_INDEX -->'));
            assert.ok(content.includes('<!-- /SECTION: SKILL_INDEX -->'));
            assert.ok(content.includes('<!-- SECTION: ROUNDTABLE_CONTEXT -->'));
            assert.ok(content.includes('<!-- /SECTION: ROUNDTABLE_CONTEXT -->'));
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-BUILD-03
    it('TC-BUILD-03: cache header contains timestamp, source count, and hash', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const result = common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(result.path, 'utf8');
            const firstLine = content.split('\n')[0];
            const headerRegex = /^<!-- SESSION CACHE: Generated .+ \| Sources: \d+ \| Hash: [0-9a-f]{8} -->$/;
            assert.match(firstLine, headerRegex);
            assert.ok(firstLine.includes(`Hash: ${result.hash}`));
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-BUILD-04
    it('TC-BUILD-04: missing source files produce SKIPPED markers', () => {
        const tmpDir = createTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const result = common.rebuildSessionCache({ projectRoot: tmpDir });
            assert.ok(result.skipped.includes('CONSTITUTION'));
            assert.ok(result.skipped.includes('WORKFLOW_CONFIG'));
            const content = fs.readFileSync(result.path, 'utf8');
            assert.ok(content.includes('<!-- SECTION: CONSTITUTION SKIPPED:'));
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-BUILD-05
    it('TC-BUILD-05: missing .isdlc/ directory throws', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdlc-cache-no-isdlc-'));
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            assert.throws(() => common.rebuildSessionCache({ projectRoot: tmpDir }),
                { message: /No \.isdlc\/ directory/ });
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-BUILD-06
    it('TC-BUILD-06: constitution section contains raw file content', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            const sectionStart = content.indexOf('<!-- SECTION: CONSTITUTION -->');
            const sectionEnd = content.indexOf('<!-- /SECTION: CONSTITUTION -->');
            const section = content.substring(sectionStart, sectionEnd);
            assert.ok(section.includes('# Test Constitution'));
            assert.ok(section.includes('Article I'));
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-BUILD-07
    it('TC-BUILD-07: workflow config section contains raw JSON', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            const sectionStart = content.indexOf('<!-- SECTION: WORKFLOW_CONFIG -->');
            const sectionEnd = content.indexOf('<!-- /SECTION: WORKFLOW_CONFIG -->');
            const section = content.substring(sectionStart, sectionEnd);
            assert.ok(section.includes('"feature"'));
            assert.ok(section.includes('"01-requirements"'));
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-BUILD-08
    it('TC-BUILD-08: skills manifest section excludes path_lookup and skill_paths', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        // Add path_lookup and skill_paths to the source manifest
        const manifestPath = path.join(tmpDir, 'src', 'claude', 'hooks', 'config', 'skills-manifest.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        manifest.path_lookup = { 'testing/skill-one': 'agent-one' };
        manifest.skill_paths = { 'testing/skill-one': 'agent-one' };
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            const sStart = content.indexOf('<!-- SECTION: SKILLS_MANIFEST -->');
            const sEnd = content.indexOf('<!-- /SECTION: SKILLS_MANIFEST -->');
            const section = content.substring(sStart, sEnd);
            assert.ok(!section.includes('"path_lookup"'), 'Should not contain path_lookup');
            assert.ok(!section.includes('"skill_paths"'), 'Should not contain skill_paths');
            assert.ok(section.includes('"ownership"'), 'Should contain ownership');
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-BUILD-09
    it('TC-BUILD-09: skill index section contains per-agent blocks', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            const sStart = content.indexOf('<!-- SECTION: SKILL_INDEX -->');
            const sEnd = content.indexOf('<!-- /SECTION: SKILL_INDEX -->');
            const section = content.substring(sStart, sEnd);
            assert.ok(section.includes('## Agent: agent-one'));
            assert.ok(section.includes('## Agent: agent-two'));
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-BUILD-10
    it('TC-BUILD-10: all source files missing produces minimal valid cache', () => {
        const tmpDir = createTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const result = common.rebuildSessionCache({ projectRoot: tmpDir });
            assert.ok(result.skipped.length > 0);
            assert.ok(fs.existsSync(result.path));
            const content = fs.readFileSync(result.path, 'utf8');
            assert.ok(content.startsWith('<!-- SESSION CACHE:'));
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-BUILD-11
    it('TC-BUILD-11: roundtable context includes persona files', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            const sStart = content.indexOf('<!-- SECTION: ROUNDTABLE_CONTEXT -->');
            const sEnd = content.indexOf('<!-- /SECTION: ROUNDTABLE_CONTEXT -->');
            const section = content.substring(sStart, sEnd);
            assert.ok(section.includes('### Persona: Business Analyst'));
            assert.ok(section.includes('BA persona content'));
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-BUILD-12
    it('TC-BUILD-12: roundtable context includes topic files', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            const sStart = content.indexOf('<!-- SECTION: ROUNDTABLE_CONTEXT -->');
            const sEnd = content.indexOf('<!-- /SECTION: ROUNDTABLE_CONTEXT -->');
            const section = content.substring(sStart, sEnd);
            assert.ok(section.includes('### Topic: architecture'));
            assert.ok(section.includes('Architecture topic content'));
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-BUILD-14
    it('TC-BUILD-14: idempotent -- two calls produce same hash', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const result1 = common.rebuildSessionCache({ projectRoot: tmpDir });
            const result2 = common.rebuildSessionCache({ projectRoot: tmpDir });
            assert.equal(result1.hash, result2.hash);
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-BUILD-15
    it('TC-BUILD-15: external skills section with missing manifest is skipped', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const result = common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(result.path, 'utf8');
            // No external manifest was created, so it should be skipped
            assert.ok(
                content.includes('<!-- SECTION: EXTERNAL_SKILLS SKIPPED:') ||
                result.skipped.includes('EXTERNAL_SKILLS')
            );
        } finally {
            cleanup(tmpDir);
        }
    });
});

// =============================================================================
// _buildSkillPathIndex() tests
// =============================================================================

describe('_buildSkillPathIndex()', () => {
    let common;
    let savedEnv;

    before(() => {
        savedEnv = { ...process.env };
        process.env.NODE_ENV = 'test';
        process.env.ISDLC_TEST_MODE = '1';
        common = requireCommon();
    });

    after(() => {
        process.env = savedEnv;
    });

    beforeEach(() => {
        if (common._resetCaches) common._resetCaches();
    });

    // TC-INDEX-01
    it('TC-INDEX-01: builds correct skill ID to path mapping', () => {
        const tmpDir = createTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        createSkillFile(tmpDir, 'src/claude/skills/dev/code-impl', 'DEV-001', 'Write code');
        try {
            const idx = common._buildSkillPathIndex();
            assert.ok(idx instanceof Map);
            assert.ok(idx.has('DEV-001'));
            assert.ok(idx.get('DEV-001').endsWith(path.join('src', 'claude', 'skills', 'dev', 'code-impl', 'SKILL.md')));
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-INDEX-02
    it('TC-INDEX-02: scans both src/claude/skills/ and .claude/skills/', () => {
        const tmpDir = createTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        createSkillFile(tmpDir, 'src/claude/skills/dev/code-impl', 'DEV-001', 'Write code');
        createSkillFile(tmpDir, '.claude/skills/testing/unit-test', 'TEST-001', 'Unit tests');
        try {
            const idx = common._buildSkillPathIndex();
            assert.ok(idx.has('DEV-001'));
            assert.ok(idx.has('TEST-001'));
            assert.ok(idx.get('DEV-001').startsWith(path.join('src', 'claude', 'skills')));
            assert.ok(idx.get('TEST-001').startsWith(path.join('.claude', 'skills')));
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-INDEX-03
    it('TC-INDEX-03: returns empty Map when skills directories missing', () => {
        const tmpDir = createTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const idx = common._buildSkillPathIndex();
            assert.ok(idx instanceof Map);
            assert.equal(idx.size, 0);
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-INDEX-04
    it('TC-INDEX-04: skips SKILL.md files without skill_id frontmatter', () => {
        const tmpDir = createTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        createSkillFile(tmpDir, 'src/claude/skills/good', 'GOOD-001', 'Good skill');
        // Create a bad skill without skill_id
        const badDir = path.join(tmpDir, 'src', 'claude', 'skills', 'bad');
        fs.mkdirSync(badDir, { recursive: true });
        fs.writeFileSync(path.join(badDir, 'SKILL.md'), '# Bad Skill\nNo frontmatter\n');
        try {
            const idx = common._buildSkillPathIndex();
            assert.ok(idx.has('GOOD-001'));
            assert.equal(idx.size, 1);
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-INDEX-05
    it('TC-INDEX-05: first found wins (src takes precedence over .claude)', () => {
        const tmpDir = createTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        createSkillFile(tmpDir, 'src/claude/skills/dev/code-impl', 'DEV-001', 'From src');
        createSkillFile(tmpDir, '.claude/skills/dev/code-impl', 'DEV-001', 'From .claude');
        try {
            const idx = common._buildSkillPathIndex();
            assert.ok(idx.has('DEV-001'));
            assert.ok(idx.get('DEV-001').startsWith(path.join('src', 'claude', 'skills')),
                'src/ path should take precedence');
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-INDEX-06
    it('TC-INDEX-06: caching -- second call returns equivalent result', () => {
        const tmpDir = createTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        createSkillFile(tmpDir, 'src/claude/skills/dev/code-impl', 'DEV-001', 'Write code');
        try {
            const idx1 = common._buildSkillPathIndex();
            assert.ok(idx1.has('DEV-001'));
            // Second call should return a result with the same entries
            const idx2 = common._buildSkillPathIndex();
            assert.ok(idx2.has('DEV-001'));
            assert.equal(idx1.size, idx2.size, 'Should have same number of entries');
            assert.equal(idx1.get('DEV-001'), idx2.get('DEV-001'), 'Should have same path');
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-INDEX-08
    it('TC-INDEX-08: _resetCaches() clears skill path index', () => {
        const tmpDir = createTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        createSkillFile(tmpDir, 'src/claude/skills/dev/code-impl', 'DEV-001', 'Write code');
        try {
            const idx1 = common._buildSkillPathIndex();
            common._resetCaches();
            process.env.CLAUDE_PROJECT_DIR = tmpDir;
            const idx2 = common._buildSkillPathIndex();
            assert.notEqual(idx1, idx2, 'Should return new Map after cache reset');
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-INDEX-09
    it('TC-INDEX-09: skips hidden directories', () => {
        const tmpDir = createTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        createSkillFile(tmpDir, 'src/claude/skills/.hidden', 'HIDDEN-001', 'Hidden');
        createSkillFile(tmpDir, 'src/claude/skills/good', 'GOOD-001', 'Good');
        try {
            const idx = common._buildSkillPathIndex();
            assert.ok(!idx.has('HIDDEN-001'));
            assert.ok(idx.has('GOOD-001'));
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-INDEX-10
    it('TC-INDEX-10: skips node_modules directory', () => {
        const tmpDir = createTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        createSkillFile(tmpDir, 'src/claude/skills/node_modules', 'NM-001', 'From nm');
        createSkillFile(tmpDir, 'src/claude/skills/good', 'GOOD-001', 'Good');
        try {
            const idx = common._buildSkillPathIndex();
            assert.ok(!idx.has('NM-001'));
            assert.ok(idx.has('GOOD-001'));
        } finally {
            cleanup(tmpDir);
        }
    });
});

// =============================================================================
// _collectSourceMtimes() tests
// =============================================================================

describe('_collectSourceMtimes()', () => {
    let common;
    let savedEnv;

    before(() => {
        savedEnv = { ...process.env };
        process.env.NODE_ENV = 'test';
        process.env.ISDLC_TEST_MODE = '1';
        common = requireCommon();
    });

    after(() => {
        process.env = savedEnv;
    });

    beforeEach(() => {
        if (common._resetCaches) common._resetCaches();
    });

    // TC-MTIME-01
    it('TC-MTIME-01: collects mtimes from existing source files', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const result = common._collectSourceMtimes(tmpDir);
            assert.ok(Array.isArray(result.sources));
            assert.ok(result.count >= 2);
            assert.ok(typeof result.hash === 'string');
            assert.ok(result.hash.length > 0);
            for (const s of result.sources) {
                assert.ok(typeof s.path === 'string');
                assert.ok(typeof s.mtimeMs === 'number');
            }
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-MTIME-02
    it('TC-MTIME-02: skips missing files silently', () => {
        const tmpDir = createTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        fs.mkdirSync(path.join(tmpDir, 'docs', 'isdlc'), { recursive: true });
        fs.writeFileSync(path.join(tmpDir, 'docs', 'isdlc', 'constitution.md'), 'test');
        try {
            const result = common._collectSourceMtimes(tmpDir);
            assert.ok(result.sources.length >= 1);
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-MTIME-03
    it('TC-MTIME-03: hash is deterministic for same file state', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const r1 = common._collectSourceMtimes(tmpDir);
            const r2 = common._collectSourceMtimes(tmpDir);
            assert.equal(r1.hash, r2.hash);
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-MTIME-05
    it('TC-MTIME-05: sources array is sorted by path', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const result = common._collectSourceMtimes(tmpDir);
            for (let i = 1; i < result.sources.length; i++) {
                assert.ok(result.sources[i].path >= result.sources[i - 1].path,
                    'Sources should be sorted by path');
            }
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-MTIME-06
    it('TC-MTIME-06: hash is 8-character hex string', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const result = common._collectSourceMtimes(tmpDir);
            assert.match(result.hash, /^[0-9a-f]{8}$/);
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-MTIME-08
    it('TC-MTIME-08: empty project returns zero or minimal count', () => {
        const tmpDir = createTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const result = common._collectSourceMtimes(tmpDir);
            assert.ok(result.count === 0 || result.count <= 2);
            assert.match(result.hash, /^[0-9a-f]{8}$/);
        } finally {
            cleanup(tmpDir);
        }
    });
});

// =============================================================================
// getAgentSkillIndex() refactor tests
// =============================================================================

describe('getAgentSkillIndex() with skill path index', () => {
    let common;
    let savedEnv;

    before(() => {
        savedEnv = { ...process.env };
        process.env.NODE_ENV = 'test';
        process.env.ISDLC_TEST_MODE = '1';
        common = requireCommon();
    });

    after(() => {
        process.env = savedEnv;
    });

    beforeEach(() => {
        if (common._resetCaches) common._resetCaches();
    });

    // TC-SKILL-01
    it('TC-SKILL-01: returns array of skill entries for known agent', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const result = common.getAgentSkillIndex('agent-one');
            assert.ok(Array.isArray(result));
            assert.equal(result.length, 2);
            const ids = result.map(e => e.id);
            assert.ok(ids.includes('TST-001'));
            assert.ok(ids.includes('TST-002'));
            for (const entry of result) {
                assert.ok(entry.id);
                assert.ok(entry.name);
                assert.ok(entry.description);
                assert.ok(entry.path);
                assert.ok(entry.path.endsWith('SKILL.md'));
            }
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-SKILL-02
    it('TC-SKILL-02: returns empty array for unknown agent', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const result = common.getAgentSkillIndex('nonexistent-agent');
            assert.deepStrictEqual(result, []);
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-SKILL-04
    it('TC-SKILL-04: works without path_lookup field', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        // Verify manifest has no path_lookup
        const manifestPath = path.join(tmpDir, '.claude', 'hooks', 'config', 'skills-manifest.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        assert.ok(!('path_lookup' in manifest), 'Manifest should not have path_lookup');
        try {
            const result = common.getAgentSkillIndex('agent-one');
            assert.ok(result.length > 0, 'Should resolve skills without path_lookup');
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-SKILL-06
    it('TC-SKILL-06: skill entry name is derived from directory name', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const result = common.getAgentSkillIndex('agent-one');
            const entry = result.find(e => e.id === 'TST-001');
            assert.ok(entry);
            assert.equal(entry.name, 'skill-one');
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-SKILL-07
    it('TC-SKILL-07: skill entry description extracted from SKILL.md', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const result = common.getAgentSkillIndex('agent-one');
            const entry = result.find(e => e.id === 'TST-001');
            assert.ok(entry);
            assert.equal(entry.description, 'First test skill');
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-SKILL-08
    it('TC-SKILL-08: skill entry path is relative', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const result = common.getAgentSkillIndex('agent-one');
            for (const entry of result) {
                assert.ok(!path.isAbsolute(entry.path), `Path should be relative: ${entry.path}`);
                assert.ok(entry.path.endsWith('SKILL.md'));
            }
        } finally {
            cleanup(tmpDir);
        }
    });
});

// =============================================================================
// Hook Registration (FR-003) tests
// =============================================================================

describe('Hook Registration (FR-003)', () => {
    let settings;

    before(() => {
        const settingsPath = path.join(PROJECT_ROOT, 'src', 'claude', 'settings.json');
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    });

    // TC-REG-01
    it('TC-REG-01: settings.json contains SessionStart entries', () => {
        assert.ok(settings.hooks.SessionStart, 'Should have SessionStart key');
        assert.ok(Array.isArray(settings.hooks.SessionStart));
        const events = settings.hooks.SessionStart.map(e => e.matcher && e.matcher.event);
        assert.ok(events.includes('startup'));
        assert.ok(events.includes('resume'));
        for (const entry of settings.hooks.SessionStart) {
            for (const hook of entry.hooks) {
                assert.ok(hook.command.includes('inject-session-cache.cjs'));
            }
        }
    });

    // TC-REG-02
    it('TC-REG-02: matchers use startup/resume pattern, NOT compact', () => {
        for (const entry of settings.hooks.SessionStart) {
            assert.ok(typeof entry.matcher === 'object', 'Matcher should be an object, not compact string');
            assert.ok(entry.matcher.type);
            assert.ok(entry.matcher.event);
        }
    });

    // TC-REG-03
    it('TC-REG-03: timeout is 5000ms', () => {
        for (const entry of settings.hooks.SessionStart) {
            for (const hook of entry.hooks) {
                assert.equal(hook.timeout, 5000);
            }
        }
    });
});

// =============================================================================
// Manifest Cleanup (FR-008) tests
// =============================================================================

describe('Manifest Cleanup (FR-008)', () => {
    let manifest;

    before(() => {
        const manifestPath = path.join(PROJECT_ROOT, 'src', 'claude', 'hooks', 'config', 'skills-manifest.json');
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    });

    // TC-MAN-01
    it('TC-MAN-01: skills-manifest.json has no path_lookup key', () => {
        assert.ok(!('path_lookup' in manifest), 'Should not have path_lookup');
    });

    // TC-MAN-02
    it('TC-MAN-02: skills-manifest.json has no skill_paths key', () => {
        assert.ok(!('skill_paths' in manifest), 'Should not have skill_paths');
    });

    // TC-MAN-03
    it('TC-MAN-03: manifest still has ownership and skill_lookup', () => {
        assert.ok('ownership' in manifest);
        assert.ok('skill_lookup' in manifest);
    });
});

// =============================================================================
// External Manifest Source Field (FR-009) tests
// =============================================================================

describe('External Manifest Source Field (FR-009)', () => {
    let common;
    let savedEnv;

    before(() => {
        savedEnv = { ...process.env };
        process.env.NODE_ENV = 'test';
        process.env.ISDLC_TEST_MODE = '1';
        common = requireCommon();
    });

    after(() => {
        process.env = savedEnv;
    });

    beforeEach(() => {
        if (common._resetCaches) common._resetCaches();
    });

    // TC-SRC-01
    it('TC-SRC-01: source field "discover" included in cache', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        fs.mkdirSync(path.join(tmpDir, 'docs', 'isdlc'), { recursive: true });
        fs.mkdirSync(path.join(tmpDir, '.claude', 'skills', 'external'), { recursive: true });
        fs.writeFileSync(path.join(tmpDir, '.claude', 'skills', 'external', 'my-skill.md'), 'skill content');
        fs.writeFileSync(path.join(tmpDir, 'docs', 'isdlc', 'external-skills-manifest.json'),
            JSON.stringify({ skills: [{ name: 'my-skill', file: 'my-skill.md', source: 'discover', bindings: { phases: ['all'] } }] }));
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            assert.ok(content.includes('Source: discover'));
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-SRC-03
    it('TC-SRC-03: missing source field treated as "unknown"', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        fs.mkdirSync(path.join(tmpDir, '.claude', 'skills', 'external'), { recursive: true });
        fs.writeFileSync(path.join(tmpDir, '.claude', 'skills', 'external', 'old-skill.md'), 'old content');
        fs.writeFileSync(path.join(tmpDir, 'docs', 'isdlc', 'external-skills-manifest.json'),
            JSON.stringify({ skills: [{ name: 'old-skill', file: 'old-skill.md', bindings: { phases: ['all'] } }] }));
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            assert.ok(content.includes('Source: unknown'));
        } finally {
            cleanup(tmpDir);
        }
    });
});

// =============================================================================
// Security tests
// =============================================================================

describe('Security tests', () => {
    let common;
    let savedEnv;

    before(() => {
        savedEnv = { ...process.env };
        process.env.NODE_ENV = 'test';
        process.env.ISDLC_TEST_MODE = '1';
        common = requireCommon();
    });

    after(() => {
        process.env = savedEnv;
    });

    beforeEach(() => {
        if (common._resetCaches) common._resetCaches();
    });

    // TC-SEC-02
    it('TC-SEC-02: cache output does not contain .env or credentials', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        fs.writeFileSync(path.join(tmpDir, '.env'), 'SECRET_KEY=abc123');
        fs.writeFileSync(path.join(tmpDir, 'credentials.json'), '{"token":"secret"}');
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            assert.ok(!content.includes('SECRET_KEY'));
            assert.ok(!content.includes('abc123'));
        } finally {
            cleanup(tmpDir);
        }
    });
});

// =============================================================================
// Section 9 Removal tests (REQ-0037: Project Skills Distillation)
// =============================================================================

describe('Section 9 Removal (REQ-0037)', () => {
    let common;
    let savedEnv;

    before(() => {
        savedEnv = { ...process.env };
        process.env.NODE_ENV = 'test';
        process.env.ISDLC_TEST_MODE = '1';
        common = requireCommon();
    });

    after(() => {
        process.env = savedEnv;
    });

    beforeEach(() => {
        if (common._resetCaches) common._resetCaches();
    });

    // TC-BUILD-16: cache output does not contain DISCOVERY_CONTEXT section delimiter
    // Traces: FR-007, AC-007-01
    it('TC-BUILD-16: cache output does not contain DISCOVERY_CONTEXT section delimiter', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        // Create discovery report files that Section 9 would have read
        fs.writeFileSync(path.join(tmpDir, 'docs', 'project-discovery-report.md'),
            '# Project Discovery Report\nSample discovery content for testing.\n');
        fs.writeFileSync(path.join(tmpDir, 'docs', 'isdlc', 'test-evaluation-report.md'),
            '# Test Evaluation Report\nSample test evaluation content.\n');
        fs.writeFileSync(path.join(tmpDir, 'docs', 'isdlc', 'reverse-engineer-report.md'),
            '# Reverse Engineer Report\nSample reverse engineering content.\n');
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            // Section 9 section delimiter must not appear in any form
            assert.ok(!content.includes('<!-- SECTION: DISCOVERY_CONTEXT -->'),
                'Cache must not contain DISCOVERY_CONTEXT opening delimiter');
            assert.ok(!content.includes('<!-- /SECTION: DISCOVERY_CONTEXT -->'),
                'Cache must not contain DISCOVERY_CONTEXT closing delimiter');
            assert.ok(!content.includes('<!-- SECTION: DISCOVERY_CONTEXT SKIPPED:'),
                'Cache must not contain DISCOVERY_CONTEXT skipped marker');
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-BUILD-17: raw discovery report content not injected into cache
    // Traces: FR-007, AC-007-02
    it('TC-BUILD-17: raw discovery report content not injected into cache', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        // Write discovery report files with unique marker strings
        fs.writeFileSync(path.join(tmpDir, 'docs', 'project-discovery-report.md'),
            '# Discovery\nDISCOVERY_MARKER_ALPHA is a unique test marker.\n');
        fs.writeFileSync(path.join(tmpDir, 'docs', 'isdlc', 'test-evaluation-report.md'),
            '# Test Evaluation\nTESTREPORT_MARKER_BETA is a unique test marker.\n');
        fs.writeFileSync(path.join(tmpDir, 'docs', 'isdlc', 'reverse-engineer-report.md'),
            '# Reverse Engineer\nREVENG_MARKER_GAMMA is a unique test marker.\n');
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            // None of the raw discovery report content should appear in cache
            assert.ok(!content.includes('DISCOVERY_MARKER_ALPHA'),
                'Cache must not contain raw discovery report content (DISCOVERY_MARKER_ALPHA)');
            assert.ok(!content.includes('TESTREPORT_MARKER_BETA'),
                'Cache must not contain raw test evaluation content (TESTREPORT_MARKER_BETA)');
            assert.ok(!content.includes('REVENG_MARKER_GAMMA'),
                'Cache must not contain raw reverse engineer content (REVENG_MARKER_GAMMA)');
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-BUILD-18: Section 7 EXTERNAL_SKILLS still functions after Section 9 removal
    // Traces: FR-007, AC-007-03
    it('TC-BUILD-18: Section 7 EXTERNAL_SKILLS still functions after Section 9 removal', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        // Create external skills infrastructure
        fs.mkdirSync(path.join(tmpDir, '.claude', 'skills', 'external'), { recursive: true });
        fs.writeFileSync(path.join(tmpDir, '.claude', 'skills', 'external', 'test-skill.md'),
            'EXTERNAL_SKILL_CONTENT\nThis is an external skill for testing.\n');
        fs.writeFileSync(path.join(tmpDir, 'docs', 'isdlc', 'external-skills-manifest.json'),
            JSON.stringify({
                skills: [{
                    name: 'test-skill',
                    file: 'test-skill.md',
                    source: 'discover',
                    bindings: {
                        phases: ['all'],
                        agents: ['all'],
                        injection_mode: 'always',
                        delivery_type: 'context'
                    }
                }]
            }, null, 2));
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            // Section 7 EXTERNAL_SKILLS must be present and functional
            assert.ok(content.includes('<!-- SECTION: EXTERNAL_SKILLS -->'),
                'Cache must contain EXTERNAL_SKILLS opening delimiter');
            assert.ok(content.includes('<!-- /SECTION: EXTERNAL_SKILLS -->'),
                'Cache must contain EXTERNAL_SKILLS closing delimiter');
            assert.ok(content.includes('EXTERNAL_SKILL_CONTENT'),
                'Cache must contain the external skill file content');
            assert.ok(content.includes('Source: discover'),
                'Cache must contain the source attribution for discover-sourced skills');
        } finally {
            cleanup(tmpDir);
        }
    });
});
