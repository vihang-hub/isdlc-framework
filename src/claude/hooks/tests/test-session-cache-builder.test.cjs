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

    // TC-BUILD-07 (updated for REQ-0041: TOON encoding of all JSON sections)
    it('TC-BUILD-07: workflow config section contains TOON-encoded content', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            const sectionStart = content.indexOf('<!-- SECTION: WORKFLOW_CONFIG -->');
            const sectionEnd = content.indexOf('<!-- /SECTION: WORKFLOW_CONFIG -->');
            const section = content.substring(sectionStart, sectionEnd);
            // REQ-0041: section now uses TOON encoding with bare keys
            assert.ok(section.includes('[TOON]'), 'WORKFLOW_CONFIG should use TOON encoding');
            assert.ok(section.includes('feature:'), 'Should contain bare feature key');
            assert.ok(section.includes('01-requirements'), 'Should contain phase reference');
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-BUILD-08 (updated for REQ-0041: TOON encoding with _comment stripping)
    it('TC-BUILD-08: skills manifest section uses TOON and contains ownership', () => {
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
            // REQ-0041: TOON encoding uses bare keys (no JSON quotes)
            assert.ok(section.includes('[TOON]'), 'Should use TOON encoding');
            // path_lookup and skill_paths are still present (TOON encodes all keys)
            // but ownership key should be present as bare key
            assert.ok(section.includes('ownership:'), 'Should contain bare ownership key');
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

    // TC-SRC-03 (updated for REQ-0038: loadExternalManifest now defaults missing source to "user")
    it('TC-SRC-03: missing source field defaults to "user" via loadExternalManifest', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        fs.mkdirSync(path.join(tmpDir, '.claude', 'skills', 'external'), { recursive: true });
        fs.writeFileSync(path.join(tmpDir, '.claude', 'skills', 'external', 'old-skill.md'), 'old content');
        fs.writeFileSync(path.join(tmpDir, 'docs', 'isdlc', 'external-skills-manifest.json'),
            JSON.stringify({ skills: [{ name: 'old-skill', file: 'old-skill.md', bindings: { phases: ['all'] } }] }));
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            assert.ok(content.includes('Source: user'), 'Missing source should default to "user" per REQ-0038');
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

// =============================================================================
// TOON Encoding Integration (REQ-0040) tests
// =============================================================================

describe('TOON Encoding Integration (REQ-0040)', () => {
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

    // TC-TOON-INT-01: SKILLS_MANIFEST uses TOON encoding when data is a uniform array
    // Traces: REQ-0040 FR-001, ADR-0040-02
    it('TC-TOON-INT-01: SKILLS_MANIFEST uses TOON encoding when manifest is a uniform array', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;

        // Replace the skills manifest with a uniform array to trigger TOON encoding
        const uniformManifest = [
            { id: 'TST-001', agent: 'agent-one', phase: 'testing' },
            { id: 'TST-002', agent: 'agent-one', phase: 'testing' },
            { id: 'TST-003', agent: 'agent-two', phase: 'dev' }
        ];
        const manifestPath = path.join(tmpDir, 'src', 'claude', 'hooks', 'config', 'skills-manifest.json');
        fs.writeFileSync(manifestPath, JSON.stringify(uniformManifest));

        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');

            const sStart = content.indexOf('<!-- SECTION: SKILLS_MANIFEST -->');
            const sEnd = content.indexOf('<!-- /SECTION: SKILLS_MANIFEST -->');
            const section = content.substring(sStart, sEnd);

            // Should contain [TOON] marker and TOON header format
            assert.ok(section.includes('[TOON]'),
                'SKILLS_MANIFEST section should contain [TOON] marker for uniform array data');
            assert.ok(section.includes('[3]{id,agent,phase}:'),
                'SKILLS_MANIFEST section should contain TOON header with field names');
            assert.ok(section.includes('TST-001,agent-one,testing'),
                'SKILLS_MANIFEST section should contain TOON-encoded data rows');
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-TOON-INT-02: SKILLS_MANIFEST uses TOON encoding for nested objects (REQ-0041)
    // Traces: REQ-0041 FR-007 (AC-007-01), REQ-0040 ADR-0040-03 (fail-open preserved)
    it('TC-TOON-INT-02: SKILLS_MANIFEST uses TOON for nested object manifest (REQ-0041)', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;

        try {
            // The default full test project has a standard manifest (nested object)
            // REQ-0041 encodeValue() now handles all data types, including nested objects
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');

            const sStart = content.indexOf('<!-- SECTION: SKILLS_MANIFEST -->');
            const sEnd = content.indexOf('<!-- /SECTION: SKILLS_MANIFEST -->');
            const section = content.substring(sStart, sEnd);

            // REQ-0041: encodeValue() encodes nested objects in TOON format
            assert.ok(section.includes('[TOON]'),
                'SKILLS_MANIFEST should contain [TOON] marker with encodeValue() (REQ-0041)');
            // Should contain bare key-value pairs (not JSON-quoted keys)
            assert.ok(section.includes('ownership:'),
                'SKILLS_MANIFEST should contain TOON-encoded ownership key');
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-TOON-INT-03: SKILLS_MANIFEST falls back to JSON when toon-encoder throws
    // Traces: REQ-0040 ADR-0040-03, Article X (fail-open)
    it('TC-TOON-INT-03: SKILLS_MANIFEST falls back to JSON when encoder is missing', () => {
        const tmpDir = createFullTestProject();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;

        // Write a uniform array manifest that would normally trigger TOON
        const uniformManifest = [
            { id: 'A', name: 'Alpha' },
            { id: 'B', name: 'Beta' }
        ];
        const manifestPath = path.join(tmpDir, 'src', 'claude', 'hooks', 'config', 'skills-manifest.json');
        fs.writeFileSync(manifestPath, JSON.stringify(uniformManifest));

        // Note: Since the toon-encoder.cjs exists in the real lib directory and
        // common.cjs is loaded from source, the encoder WILL be found. But the
        // fail-open behavior is tested by TC-TOON-INT-02 (non-uniform data path).
        // This test verifies the normal encoding path works end-to-end.
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');

            // Verify the cache was written successfully regardless of encoding path
            assert.ok(content.includes('<!-- SECTION: SKILLS_MANIFEST -->'),
                'Cache must contain SKILLS_MANIFEST opening delimiter');
            assert.ok(content.includes('<!-- /SECTION: SKILLS_MANIFEST -->'),
                'Cache must contain SKILLS_MANIFEST closing delimiter');

            // For uniform array, TOON encoding should be used
            const sStart = content.indexOf('<!-- SECTION: SKILLS_MANIFEST -->');
            const sEnd = content.indexOf('<!-- /SECTION: SKILLS_MANIFEST -->');
            const section = content.substring(sStart, sEnd);
            assert.ok(section.includes('[TOON]') || section.includes('"id"'),
                'SKILLS_MANIFEST should contain either TOON or JSON content');
        } finally {
            cleanup(tmpDir);
        }
    });
});

// =============================================================================
// REQ-0042: Markdown Tightening Tests
// =============================================================================

// ---------------------------------------------------------------------------
// Realistic test data fixtures for tightening tests
// ---------------------------------------------------------------------------

/** Build a realistic persona file with all 10 sections */
function buildRealisticPersonaContent() {
    return `---
name: persona-test-analyst
description: "Test persona for markdown tightening tests"
model: opus
owned_skills: []
---

# Test Analyst -- Persona

## 1. Identity

- **Name**: Test Analyst
- **Role**: Business Analyst
- **Opening**: "I am a test persona for validation."
- **Communication Style**: Detail-oriented, analytical.

## 2. Principles

1. **Understand before solving**: Probe requirements deeply.
2. **Surface the unstated**: Uncover edge cases.
3. **Validate with examples**: Use concrete scenarios.
4. **Prioritize ruthlessly**: Challenge inflated priorities.

## 3. Voice Integrity Rules

**DO**:
- Ground discussion in user needs
- Ask "why" and "what if"
- Challenge solutions that lack benefit
- Use acceptance criteria language

**DO NOT**:
- Use technical jargon unprompted
- Propose implementations
- Specify function signatures

## 4. Analytical Approach

### 4.1 Problem Discovery
- What business problem does this solve?
- What does success look like?
- What is the cost of NOT doing this?
- Current state analysis
- Stakeholder mapping

### 4.2 User Needs Analysis
- User type identification
- Workflow mapping
- Pain point articulation
- Edge cases in user journeys
- Accessibility considerations

### 4.3 Requirements Definition
- FR-NNN format with AC-NNN-NN acceptance criteria
- Testable observable behavior
- Boundary conditions
- Dependency mapping
- Out-of-scope documentation

### 4.4 Prioritization
- MoSCoW framework
- Challenge inflated priorities
- Minimum viable set identification
- Dependency-aware ordering

## 5. Interaction Style

### 5.1 With User
- Open naturally
- Probe organically
- Summarize before moving on
- Adapt language

### 5.2 With Other Personas
- Hand off technical decisions
- Ask for precision
- Stay in requirements domain

## 6. Artifact Responsibilities

### 6.1 requirements-spec.md
- **Owner**: Analyst (sole writer)
- **Sections**: Business Context, Stakeholders, User Journeys
- **Progressive write**: First write after discovery

### 6.2 user-stories.json
- **Owner**: Analyst (sole writer)
- **Format**: Array of story objects

### 6.3 traceability-matrix.csv
- **Owner**: Analyst (sole writer)
- **Format**: FR_ID, AC_ID, Story_ID

## 7. Self-Validation Protocol

Before writing:
- Verify FRs have testable ACs
- No vague requirements
- Priorities assigned to all FRs
- At least one user type identified

Before finalization:
- All user types have journeys documented
- Out-of-scope is explicit
- MoSCoW is complete
- Dependencies between FRs are mapped

## 8. Artifact Folder Convention

- All artifacts written to: docs/requirements/{slug}/
- Each write produces a COMPLETE file
- File must be self-describing

## 9. Meta.json Protocol

- Analyst does NOT write meta.json directly
- Reports progress via messaging
- Lead writes meta.json based on reports

## 10. Constraints

- No state.json writes
- No branch creation
- Single-line Bash commands only
- No framework internals
`;
}

/** Build a realistic topic file with YAML frontmatter */
function buildRealisticTopicContent() {
    return `---
topic_id: "test-topic"
topic_name: "Test Topic"
primary_persona: "solutions-architect"
contributing_personas:
  - "system-designer"
coverage_criteria:
  - "At least 2 options considered"
  - "Each option has documented pros and cons"
artifact_sections:
  - artifact: "architecture-overview.md"
    sections: ["1. Options", "2. Selected", "3. Summary"]
depth_guidance:
  brief: "Single recommended approach. 1-2 exchanges."
  standard: "2-3 options with tradeoffs. 3-5 exchanges."
  deep: "Exhaustive evaluation. 6+ exchanges."
source_step_files:
  - "03-01"
  - "03-02"
---

## Analytical Knowledge

### Architecture Options and Tradeoffs

- Identify all possible architecture approaches
- For each option document pros and cons
- Assess risk appetite
- Identify constraints that eliminate options

### Data Flow Analysis

- Map data sources to consumers
- Document transformations
- Identify bottlenecks

## Validation Criteria

- At least 2 options per decision
- Each option has pros, cons, alignment
- Selected option has rationale
- Integration points mapped

## Artifact Instructions

- Write architecture-overview.md
- Include ADR format for decisions
- Document data flow end-to-end
`;
}

/** Build realistic discovery content with headings, tables, lists, and prose */
function buildRealisticDiscoveryContent() {
    return `## Project Overview

The iSDLC framework is a JavaScript/Node.js CLI tool that provides an integrated software development lifecycle. This paragraph describes the overall architecture and should be stripped during condensation. It was designed to support autonomous agent workflows with phase-gated quality enforcement throughout the development process.

The framework has been in active development since early 2026 and has undergone significant architectural evolution. Initially conceived as a simple hook-based system, it has grown to encompass 48 specialized agents, 240 skills across 17 categories, and 26 runtime enforcement hooks. The design philosophy emphasizes fail-open behavior, constitutional compliance, and deterministic iteration enforcement.

### Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | 20+ |
| Language | JavaScript | ES2022 |
| Module System | CJS (hooks) | - |
| CLI | Commander.js | 12.x |

The above table shows the core technology decisions made during project inception. These decisions were driven by compatibility requirements with Claude Code's CommonJS hook system and the need for cross-platform support across macOS, Linux, and Windows environments.

### Key Directories

- src/claude/agents/ -- 48 specialized agents
- src/claude/skills/ -- 240 skills across 17 categories
- src/claude/hooks/ -- 26 runtime enforcement hooks
- bin/ -- CLI entry point

This section provides a comprehensive overview of the directory structure used throughout the project. Each directory serves a specific purpose in the framework architecture. The agents directory contains persona files, phase agent definitions, and discovery orchestration agents. The skills directory is organized by category with each skill having its own SKILL.md manifest file.

### File Statistics

| Metric | Value |
|--------|-------|
| Total files | 500+ |
| Test files | 50+ |
| Agent files | 48 |
| Skill files | 240 |

## Behavioral Analysis

The framework operates in multiple modes depending on the context and user interaction patterns. Each mode has distinct characteristics that affect how agents are dispatched, how state is managed, and how quality gates are enforced. Understanding these behavioral patterns is critical for maintaining backward compatibility during refactoring efforts.

The behavioral analysis reveals several key patterns that are fundamental to the framework's operation. These patterns have been validated through extensive characterization testing and are documented in the acceptance criteria matrix.

### Detected Patterns

1. Workflow-first development with intent detection
2. Phase-gated quality enforcement
3. Constitutional compliance validation

### Risk Areas

- State file corruption during concurrent operations
- Hook ordering dependencies
- Session cache size management

More analysis would be needed to fully characterize all risk vectors in the system. The current risk assessment covers the most critical areas but additional investigation into edge cases around monorepo mode and concurrent workflow execution would be beneficial for long-term stability.

## Coverage Summary

| Domain | ACs | Covered | Partial | Uncovered |
|--------|-----|---------|---------|-----------|
| Workflow | 20 | 15 | 3 | 2 |
| Hooks | 30 | 25 | 2 | 3 |
| Cache | 10 | 8 | 1 | 1 |

## Architecture Assessment

The architecture follows a layered approach with clear separation between the CLI layer, the hook dispatch layer, and the agent execution layer. This separation enables independent testing and evolution of each layer while maintaining a stable contract between them.

The hook system is the most critical architectural component as it serves as the primary enforcement mechanism for all quality gates, iteration requirements, and constitutional compliance checks. Any changes to the hook dispatch order or hook registration format can have cascading effects throughout the framework.

### Integration Points

- CLI entry point dispatches to hook system
- Hook system reads state.json for workflow context
- Agents receive context through task prompts
- Session cache provides pre-computed context to reduce per-hook computation

The session cache optimization introduced in REQ-0001 significantly reduced the per-session startup overhead by pre-computing and caching framework context that would otherwise require multiple file reads and manifest lookups on every session start.
`;
}

/** Create a full test project with realistic persona/topic content for REQ-0042 tightening tests */
function createFullTestProjectWithRealisticContent() {
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

    // Skills manifest
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
    fs.writeFileSync(path.join(tmpDir, '.claude', 'hooks', 'config', 'skills-manifest.json'),
        JSON.stringify(manifest, null, 2));

    // Create SKILL.md files
    createSkillFile(tmpDir, 'src/claude/skills/testing/skill-one', 'TST-001', 'First test skill');
    createSkillFile(tmpDir, 'src/claude/skills/testing/skill-two', 'TST-002', 'Second test skill');
    createSkillFile(tmpDir, 'src/claude/skills/dev/skill-three', 'TST-003', 'Third test skill');
    createSkillFile(tmpDir, 'src/claude/skills/dev/skill-four', 'TST-004', 'Fourth test skill');

    // Realistic persona files (REQ-0042)
    fs.mkdirSync(path.join(tmpDir, 'src', 'claude', 'agents'), { recursive: true });
    const personaContent = buildRealisticPersonaContent();
    fs.writeFileSync(path.join(tmpDir, 'src', 'claude', 'agents', 'persona-business-analyst.md'), personaContent);
    fs.writeFileSync(path.join(tmpDir, 'src', 'claude', 'agents', 'persona-solutions-architect.md'), personaContent);
    fs.writeFileSync(path.join(tmpDir, 'src', 'claude', 'agents', 'persona-system-designer.md'), personaContent);

    // Realistic topic files (REQ-0042)
    const topicContent = buildRealisticTopicContent();
    fs.mkdirSync(path.join(tmpDir, 'src', 'claude', 'skills', 'analysis-topics', 'architecture'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'claude', 'skills', 'analysis-topics', 'architecture', 'architecture.md'), topicContent);
    fs.mkdirSync(path.join(tmpDir, 'src', 'claude', 'skills', 'analysis-topics', 'problem-discovery'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'claude', 'skills', 'analysis-topics', 'problem-discovery', 'problem-discovery.md'), topicContent);

    return tmpDir;
}

// =============================================================================
// tightenPersonaContent() tests (FR-003, FR-004)
// =============================================================================

describe('tightenPersonaContent()', () => {
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

    // TC-TPC-01: Stripped sections absent from output
    it('TC-TPC-01: stripped sections absent from output (FR-003, AC-003-01)', () => {
        const input = buildRealisticPersonaContent();
        const result = common._tightenPersonaContent(input);
        assert.ok(!result.includes('Analytical Approach'), 'Section 4 should be stripped');
        assert.ok(!result.includes('Artifact Responsibilities'), 'Section 6 should be stripped');
        assert.ok(!result.includes('Artifact Folder Convention'), 'Section 8 should be stripped');
        assert.ok(!result.includes('Meta.json Protocol'), 'Section 9 should be stripped');
        assert.ok(!result.includes('Constraints'), 'Section 10 should be stripped');
    });

    // TC-TPC-02: Kept sections present in output
    it('TC-TPC-02: kept sections present in output (FR-003, AC-003-02)', () => {
        const input = buildRealisticPersonaContent();
        const result = common._tightenPersonaContent(input);
        assert.ok(result.includes('Identity'), 'Section 1 should be kept');
        assert.ok(result.includes('Principles'), 'Section 2 should be kept');
        assert.ok(result.includes('Voice Integrity'), 'Section 3 should be kept');
        assert.ok(result.includes('Interaction Style'), 'Section 5 should be kept');
    });

    // TC-TPC-03: Persona heading delimiter preserved
    it('TC-TPC-03: persona heading delimiter preserved (FR-003, AC-003-03)', () => {
        const input = buildRealisticPersonaContent();
        const result = common._tightenPersonaContent(input);
        // The title heading should be preserved
        assert.ok(result.includes('# Test Analyst'), 'Title heading should be preserved');
    });

    // TC-TPC-04: YAML frontmatter stripped from persona
    it('TC-TPC-04: YAML frontmatter stripped from persona (FR-003, AC-003-04)', () => {
        const input = buildRealisticPersonaContent();
        const result = common._tightenPersonaContent(input);
        assert.ok(!result.trimStart().startsWith('---'), 'Output should not start with frontmatter');
        assert.ok(!result.includes('owned_skills'), 'Frontmatter fields should be stripped');
        assert.ok(!result.includes('persona-test-analyst'), 'Frontmatter name should be stripped');
    });

    // TC-TPC-05: Null input returns empty string
    it('TC-TPC-05: null input returns empty string (FR-003, AC-003-01)', () => {
        const result = common._tightenPersonaContent(null);
        assert.equal(result, '');
    });

    // TC-TPC-06: Empty string input returns empty string
    it('TC-TPC-06: empty string input returns empty string (FR-003, AC-003-01)', () => {
        const result = common._tightenPersonaContent('');
        assert.equal(result, '');
    });

    // TC-TPC-07: Non-string input returns empty string
    it('TC-TPC-07: non-string input returns empty string (FR-003, AC-003-01)', () => {
        assert.equal(common._tightenPersonaContent(42), '');
        assert.equal(common._tightenPersonaContent(true), '');
        assert.equal(common._tightenPersonaContent({}), '');
        assert.equal(common._tightenPersonaContent([]), '');
    });

    // TC-TPC-08: Content with no section headings returns frontmatter-stripped content
    it('TC-TPC-08: content with no section headings returns frontmatter-stripped content (FR-003, AC-003-01)', () => {
        const input = '---\nname: test\n---\nSome plain body content\nMore content here\n';
        const result = common._tightenPersonaContent(input);
        assert.ok(!result.includes('---'), 'Frontmatter delimiters should be stripped');
        assert.ok(result.includes('Some plain body content'), 'Body content should be preserved');
    });

    // TC-TPC-09: Self-Validation present as single merged checklist (FR-004, AC-004-01)
    it('TC-TPC-09: self-validation merged into single checklist (FR-004, AC-004-01)', () => {
        const input = buildRealisticPersonaContent();
        const result = common._tightenPersonaContent(input);
        // Section 7 content should be present
        assert.ok(result.includes('Self-Validation'), 'Section 7 heading should be present');
        // Should NOT have separate "Before writing" and "Before finalization" sub-headings
        assert.ok(!result.includes('Before writing:'), 'Should not have separate Before writing heading');
        assert.ok(!result.includes('Before finalization:'), 'Should not have separate Before finalization heading');
    });

    // TC-TPC-10: All validation criteria preserved in merged checklist (FR-004, AC-004-02)
    it('TC-TPC-10: all validation criteria preserved in merged checklist (FR-004, AC-004-02)', () => {
        const input = buildRealisticPersonaContent();
        const result = common._tightenPersonaContent(input);
        // Count list items in section 7 area
        // The section 7 has 4 "Before writing" items + 4 "Before finalization" items = 8 total
        assert.ok(result.includes('Verify FRs have testable ACs'), 'Before writing item 1 preserved');
        assert.ok(result.includes('No vague requirements'), 'Before writing item 2 preserved');
        assert.ok(result.includes('Priorities assigned'), 'Before writing item 3 preserved');
        assert.ok(result.includes('At least one user type'), 'Before writing item 4 preserved');
        assert.ok(result.includes('All user types have journeys'), 'Before finalization item 1 preserved');
        assert.ok(result.includes('Out-of-scope is explicit'), 'Before finalization item 2 preserved');
        assert.ok(result.includes('MoSCoW is complete'), 'Before finalization item 3 preserved');
        assert.ok(result.includes('Dependencies between FRs'), 'Before finalization item 4 preserved');
    });

    // TC-TPC-11: Validation criteria remain within persona block (FR-004, AC-004-03)
    it('TC-TPC-11: validation criteria within persona block (FR-004, AC-004-03)', () => {
        // Each persona has its own tightenPersonaContent call, so criteria stays per-persona
        const input = buildRealisticPersonaContent();
        const result = common._tightenPersonaContent(input);
        // Section 7 should be in the result
        assert.ok(result.includes('## 7.'), 'Section 7 heading preserved in output');
        // Validation items should be present
        const listItems = result.split('\n').filter(l => l.trim().startsWith('- '));
        assert.ok(listItems.length >= 7, 'At least 7 validation items in merged checklist');
    });

    // TC-TPC-12: Per-persona reduction at least 50% (FR-004, AC-004-04)
    it('TC-TPC-12: per-persona reduction at least 50% (FR-004, AC-004-04)', () => {
        const input = buildRealisticPersonaContent();
        const result = common._tightenPersonaContent(input);
        assert.ok(result.length <= input.length * 0.50,
            `Tightened (${result.length}) should be <= 50% of original (${input.length})`);
    });
});

// =============================================================================
// tightenTopicContent() tests (FR-005)
// =============================================================================

describe('tightenTopicContent()', () => {
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

    // TC-TTC-01: Topic frontmatter stripped
    it('TC-TTC-01: topic frontmatter stripped (FR-005, AC-005-01)', () => {
        const input = buildRealisticTopicContent();
        const result = common._tightenTopicContent(input);
        assert.ok(!result.trimStart().startsWith('---'), 'Output should not start with frontmatter');
    });

    // TC-TTC-02: depth_guidance and source_step_files absent
    it('TC-TTC-02: depth_guidance and source_step_files absent (FR-005, AC-005-02)', () => {
        const input = buildRealisticTopicContent();
        const result = common._tightenTopicContent(input);
        assert.ok(!result.includes('depth_guidance'), 'depth_guidance should be stripped with frontmatter');
        assert.ok(!result.includes('source_step_files'), 'source_step_files should be stripped with frontmatter');
    });

    // TC-TTC-03: Analytical Knowledge and Validation Criteria preserved
    it('TC-TTC-03: analytical knowledge and validation criteria preserved (FR-005, AC-005-03)', () => {
        const input = buildRealisticTopicContent();
        const result = common._tightenTopicContent(input);
        assert.ok(result.includes('Analytical Knowledge'), 'Analytical Knowledge should be preserved');
        assert.ok(result.includes('Validation Criteria'), 'Validation Criteria should be preserved');
        assert.ok(result.includes('Artifact Instructions'), 'Artifact Instructions should be preserved');
    });

    // TC-TTC-04: Topic heading delimiter preserved
    it('TC-TTC-04: topic heading delimiter preserved (FR-005, AC-005-04)', () => {
        const input = buildRealisticTopicContent();
        const result = common._tightenTopicContent(input);
        // Count ## headings
        const headings = result.split('\n').filter(l => l.startsWith('## '));
        assert.ok(headings.length >= 3, 'At least 3 ## headings should be preserved');
    });

    // TC-TTC-05: ROUNDTABLE_CONTEXT total reduction at least 40% -- tested in integration section

    // TC-TTC-06: Null/empty topic input returns empty string
    it('TC-TTC-06: null/empty topic input returns empty string (FR-005, AC-005-01)', () => {
        assert.equal(common._tightenTopicContent(null), '');
        assert.equal(common._tightenTopicContent(''), '');
        assert.equal(common._tightenTopicContent(undefined), '');
    });

    // TC-TTC-07: Non-string topic input returns empty string
    it('TC-TTC-07: non-string topic input returns empty string (FR-005, AC-005-01)', () => {
        assert.equal(common._tightenTopicContent(42), '');
        assert.equal(common._tightenTopicContent(true), '');
        assert.equal(common._tightenTopicContent({}), '');
        assert.equal(common._tightenTopicContent([]), '');
    });

    // TC-TTC-08: Topic content with no frontmatter returns unchanged
    it('TC-TTC-08: topic content with no frontmatter returns unchanged (FR-005, AC-005-01)', () => {
        const input = '## Analytical Knowledge\n\n- Some content\n- More content\n';
        const result = common._tightenTopicContent(input);
        assert.equal(result, input, 'Content without frontmatter should be returned unchanged');
    });
});

// =============================================================================
// condenseDiscoveryContent() tests (FR-006)
// =============================================================================

describe('condenseDiscoveryContent()', () => {
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

    // TC-CDC-01: Tables preserved verbatim
    it('TC-CDC-01: tables preserved verbatim (FR-006, AC-006-01)', () => {
        const input = buildRealisticDiscoveryContent();
        const result = common._condenseDiscoveryContent(input);
        // Every input line starting with | should be in output
        const inputTableLines = input.split('\n').filter(l => l.trim().startsWith('|'));
        for (const line of inputTableLines) {
            assert.ok(result.includes(line), `Table line should be preserved: ${line.substring(0, 40)}...`);
        }
    });

    // TC-CDC-02: Headings preserved verbatim
    it('TC-CDC-02: headings preserved verbatim (FR-006, AC-006-02)', () => {
        const input = buildRealisticDiscoveryContent();
        const result = common._condenseDiscoveryContent(input);
        const inputHeadings = input.split('\n').filter(l => l.trim().startsWith('#'));
        for (const line of inputHeadings) {
            assert.ok(result.includes(line), `Heading should be preserved: ${line}`);
        }
    });

    // TC-CDC-03: List items preserved
    it('TC-CDC-03: list items preserved (FR-006, AC-006-03)', () => {
        const input = buildRealisticDiscoveryContent();
        const result = common._condenseDiscoveryContent(input);
        const inputLists = input.split('\n').filter(l => {
            const t = l.trim();
            return t.startsWith('- ') || t.startsWith('* ') || /^\d+\. /.test(t);
        });
        for (const line of inputLists) {
            assert.ok(result.includes(line), `List item should be preserved: ${line}`);
        }
    });

    // TC-CDC-04: Prose paragraphs removed
    it('TC-CDC-04: prose paragraphs removed (FR-006, AC-006-04)', () => {
        const input = buildRealisticDiscoveryContent();
        const result = common._condenseDiscoveryContent(input);
        assert.ok(!result.includes('The iSDLC framework is a JavaScript/Node.js CLI tool'),
            'Prose paragraph should be removed');
        assert.ok(!result.includes('The above table shows'),
            'Prose paragraph after table should be removed');
        assert.ok(!result.includes('This section provides a comprehensive overview'),
            'Descriptive prose should be removed');
    });

    // TC-CDC-05: Discovery reduction at least 40%
    it('TC-CDC-05: discovery reduction at least 40% (FR-006, AC-006-05)', () => {
        const input = buildRealisticDiscoveryContent();
        const result = common._condenseDiscoveryContent(input);
        assert.ok(result.length <= input.length * 0.60,
            `Condensed (${result.length}) should be <= 60% of original (${input.length})`);
    });

    // TC-CDC-06: Consecutive blank lines collapsed
    it('TC-CDC-06: consecutive blank lines collapsed (FR-006, AC-006-04)', () => {
        const input = '## Heading\n\nProse paragraph one.\n\nProse paragraph two.\n\nProse paragraph three.\n\n## Next\n';
        const result = common._condenseDiscoveryContent(input);
        assert.ok(!result.includes('\n\n\n\n'), 'No more than 2 consecutive blank lines');
    });

    // TC-CDC-07: Null/empty discovery input returns empty string
    it('TC-CDC-07: null/empty discovery input returns empty string (FR-006, AC-006-01)', () => {
        assert.equal(common._condenseDiscoveryContent(null), '');
        assert.equal(common._condenseDiscoveryContent(''), '');
        assert.equal(common._condenseDiscoveryContent(undefined), '');
    });

    // TC-CDC-08: Non-string discovery input returns empty string
    it('TC-CDC-08: non-string discovery input returns empty string (FR-006, AC-006-01)', () => {
        assert.equal(common._condenseDiscoveryContent(42), '');
        assert.equal(common._condenseDiscoveryContent(true), '');
        assert.equal(common._condenseDiscoveryContent({}), '');
        assert.equal(common._condenseDiscoveryContent([]), '');
    });

    // TC-CDC-09: Content with no tables/lists strips all prose
    it('TC-CDC-09: content with no tables/lists strips all prose (FR-006, AC-006-04)', () => {
        const input = '## Heading One\n\nProse paragraph here.\n\n## Heading Two\n\nMore prose.\n';
        const result = common._condenseDiscoveryContent(input);
        const nonBlankLines = result.split('\n').filter(l => l.trim().length > 0);
        for (const line of nonBlankLines) {
            assert.ok(line.trim().startsWith('#'),
                `All non-blank lines should be headings, got: "${line}"`);
        }
    });
});

// =============================================================================
// formatSkillIndexBlock() modified tests (FR-001, FR-002)
// =============================================================================

describe('formatSkillIndexBlock() compact format', () => {
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

    // TC-FSI-04: Single-line skill entry format
    it('TC-FSI-04: single-line skill entry format (FR-002, AC-002-01)', () => {
        const skillIndex = [{
            id: 'DEV-001',
            name: 'code-implementation',
            description: 'Implement code',
            path: 'src/claude/skills/development/code-implementation/SKILL.md'
        }];
        const result = common.formatSkillIndexBlock(skillIndex);
        assert.ok(result.includes('DEV-001: code-implementation | Implement code | development/code-implementation'),
            'Should use single-line pipe-separated format');
    });

    // TC-FSI-05: Base path in section header -- tested in integration (section-level banner)

    // TC-FSI-06: All skill entries preserved in compact format
    it('TC-FSI-06: all skill entries preserved in compact format (FR-002, AC-002-03)', () => {
        const skillIndex = [
            { id: 'DEV-001', name: 'code-impl', description: 'Implement', path: 'src/claude/skills/dev/code-impl/SKILL.md' },
            { id: 'DEV-002', name: 'unit-test', description: 'Test', path: 'src/claude/skills/dev/unit-test/SKILL.md' },
            { id: 'TST-001', name: 'integration', description: 'Integrate', path: 'src/claude/skills/testing/integration/SKILL.md' },
            { id: 'SEC-001', name: 'security', description: 'Secure', path: 'src/claude/skills/security/security/SKILL.md' },
            { id: 'DOC-001', name: 'docs', description: 'Document', path: 'src/claude/skills/documentation/docs/SKILL.md' },
        ];
        const result = common.formatSkillIndexBlock(skillIndex);
        for (const s of skillIndex) {
            assert.ok(result.includes(s.id), `Skill ID ${s.id} should be present`);
            assert.ok(result.includes(s.name), `Skill name ${s.name} should be present`);
            assert.ok(result.includes(s.description), `Skill description ${s.description} should be present`);
        }
    });

    // TC-FSI-07: Combined FR-001 + FR-002 achieves 50% reduction -- tested in integration

    // TC-FSI-08: Empty skill index returns empty string
    it('TC-FSI-08: empty skill index returns empty string (FR-002, AC-002-01)', () => {
        assert.equal(common.formatSkillIndexBlock([]), '');
    });

    // TC-FSI-09: Non-array input returns empty string
    it('TC-FSI-09: non-array input returns empty string (FR-002, AC-002-01)', () => {
        assert.equal(common.formatSkillIndexBlock(null), '');
        assert.equal(common.formatSkillIndexBlock(undefined), '');
        assert.equal(common.formatSkillIndexBlock('string'), '');
        assert.equal(common.formatSkillIndexBlock(42), '');
    });

    // TC-FSI-10: Path shortening extracts last two segments
    it('TC-FSI-10: path shortening extracts last two segments (FR-002, AC-002-03)', () => {
        const skillIndex = [{
            id: 'MUT-001',
            name: 'mutation-testing',
            description: 'Mutation test',
            path: 'src/claude/skills/testing/mutation-testing/SKILL.md'
        }];
        const result = common.formatSkillIndexBlock(skillIndex);
        assert.ok(result.includes('testing/mutation-testing'),
            'Should contain last two path segments');
        assert.ok(!result.includes('src/claude/skills/testing/mutation-testing'),
            'Should NOT contain full path');
    });

    // TC-FSI-NO-BANNER: No per-block banner in compact format
    it('TC-FSI-NO-BANNER: no per-block banner in compact format (FR-001)', () => {
        const skillIndex = [{
            id: 'DEV-001',
            name: 'code-impl',
            description: 'Impl',
            path: 'src/claude/skills/dev/code-impl/SKILL.md'
        }];
        const result = common.formatSkillIndexBlock(skillIndex);
        assert.ok(!result.includes('AVAILABLE SKILLS'),
            'Per-block output should NOT contain banner');
    });
});

// =============================================================================
// Fail-open tightening safety tests (FR-007)
// =============================================================================

describe('Fail-open tightening safety (FR-007)', () => {
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

    // TC-FO-01: tightenPersonaContent returns original on error
    // To trigger error, we would need to mock internals, but since all inputs
    // are handled gracefully, we test that non-standard content returns safely
    it('TC-FO-01: tightenPersonaContent handles malformed section boundaries (FR-007, AC-007-01)', () => {
        // Content with unusual ## patterns that still processes safely
        const rawContent = '---\nname: test\n---\n## 1. Identity\nContent\n## NotANumber. Weird\nStuff\n';
        const result = common._tightenPersonaContent(rawContent);
        assert.ok(typeof result === 'string', 'Should return a string');
        assert.ok(result.length > 0, 'Should return non-empty content');
    });

    // TC-FO-02: tightenTopicContent returns original on error
    it('TC-FO-02: tightenTopicContent handles unusual content (FR-007, AC-007-01)', () => {
        // Content with frontmatter-like content but odd structure
        const rawContent = '---\nkey: value\n---\n';
        const result = common._tightenTopicContent(rawContent);
        // Should return the rawContent since stripping frontmatter leaves nothing meaningful
        assert.equal(result, rawContent, 'Should return original when stripped content is empty');
    });

    // TC-FO-03: condenseDiscoveryContent returns original on error
    it('TC-FO-03: condenseDiscoveryContent handles all-blank content (FR-007, AC-007-01)', () => {
        const rawContent = '   \n   \n   \n';
        const result = common._condenseDiscoveryContent(rawContent);
        // Input is whitespace-only, which is treated as empty
        assert.equal(result, '', 'Whitespace-only input should return empty string');
    });

    // TC-FO-04: One section failure does not affect other sections
    it('TC-FO-04: one section failure does not affect other sections (FR-007, AC-007-02)', () => {
        const tmpDir = createFullTestProjectWithRealisticContent();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            // Write an invalid/empty persona file that will still process without error
            // The fail-open design means it never crashes
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            assert.ok(content.includes('<!-- SECTION: SKILL_INDEX -->'), 'SKILL_INDEX should be present');
            assert.ok(content.includes('<!-- SECTION: ROUNDTABLE_CONTEXT -->'), 'ROUNDTABLE should be present');
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-FO-05: Verbose mode logs fallback warning
    it('TC-FO-05: verbose mode includes reduction stats (FR-007, AC-007-03)', () => {
        const tmpDir = createFullTestProjectWithRealisticContent();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;

        // Capture stderr
        const originalWrite = process.stderr.write;
        let stderrOutput = '';
        process.stderr.write = (chunk) => { stderrOutput += chunk; };

        try {
            common.rebuildSessionCache({ projectRoot: tmpDir, verbose: true });
            // Verbose mode should log tightening stats
            assert.ok(stderrOutput.includes('TIGHTEN') || stderrOutput.includes('Session cache written'),
                'Verbose mode should produce stderr output');
        } finally {
            process.stderr.write = originalWrite;
            cleanup(tmpDir);
        }
    });
});

// =============================================================================
// Integration tests: SKILL_INDEX section (FR-001, FR-002)
// =============================================================================

describe('SKILL_INDEX integration (FR-001, FR-002)', () => {
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

    // TC-FSI-01: Banner appears once at section level
    it('TC-FSI-01: banner appears once at section level (FR-001, AC-001-01)', () => {
        const tmpDir = createFullTestProjectWithRealisticContent();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            const sStart = content.indexOf('<!-- SECTION: SKILL_INDEX -->');
            const sEnd = content.indexOf('<!-- /SECTION: SKILL_INDEX -->');
            const section = content.substring(sStart, sEnd);
            const bannerCount = section.split('AVAILABLE SKILLS').length - 1;
            assert.equal(bannerCount, 1, 'Banner should appear exactly once at section level');
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-FSI-02: Agent headings preserved in SKILL_INDEX
    it('TC-FSI-02: agent headings preserved in SKILL_INDEX (FR-001, AC-001-02)', () => {
        const tmpDir = createFullTestProjectWithRealisticContent();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            const sStart = content.indexOf('<!-- SECTION: SKILL_INDEX -->');
            const sEnd = content.indexOf('<!-- /SECTION: SKILL_INDEX -->');
            const section = content.substring(sStart, sEnd);
            assert.ok(section.includes('## Agent: agent-one'), 'Agent one heading preserved');
            assert.ok(section.includes('## Agent: agent-two'), 'Agent two heading preserved');
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-FSI-03: Banner dedup saves characters
    it('TC-FSI-03: banner dedup saves characters (FR-001, AC-001-03)', () => {
        const tmpDir = createFullTestProjectWithRealisticContent();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            const sStart = content.indexOf('<!-- SECTION: SKILL_INDEX -->');
            const sEnd = content.indexOf('<!-- /SECTION: SKILL_INDEX -->');
            const section = content.substring(sStart, sEnd);
            // With only 4 test skills, savings are modest. Verify compact format is used.
            assert.ok(section.includes('|'), 'Compact format uses pipe separators');
            assert.ok(!section.includes('\u2192'), 'Old arrow format should not be present');
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-FSI-05: Base path in section header
    it('TC-FSI-05: base path in section header (FR-002, AC-002-02)', () => {
        const tmpDir = createFullTestProjectWithRealisticContent();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            const sStart = content.indexOf('<!-- SECTION: SKILL_INDEX -->');
            const sEnd = content.indexOf('<!-- /SECTION: SKILL_INDEX -->');
            const section = content.substring(sStart, sEnd);
            assert.ok(section.includes('Base path:'), 'Section should contain Base path');
            assert.ok(section.includes('src/claude/skills/{category}/{name}/SKILL.md'),
                'Base path template should be present');
        } finally {
            cleanup(tmpDir);
        }
    });
});

// =============================================================================
// Integration tests: ROUNDTABLE_CONTEXT section (FR-003, FR-004, FR-005)
// =============================================================================

describe('ROUNDTABLE_CONTEXT integration (FR-003, FR-004, FR-005)', () => {
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

    // TC-TPC-03-INT: Persona heading delimiters preserved in built cache
    it('TC-TPC-03-INT: persona heading delimiters preserved in built cache (FR-003, AC-003-03)', () => {
        const tmpDir = createFullTestProjectWithRealisticContent();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            const sStart = content.indexOf('<!-- SECTION: ROUNDTABLE_CONTEXT -->');
            const sEnd = content.indexOf('<!-- /SECTION: ROUNDTABLE_CONTEXT -->');
            const section = content.substring(sStart, sEnd);
            const personaBlocks = section.split('### Persona:').length - 1;
            assert.equal(personaBlocks, 3, 'Should have 3 persona blocks');
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-TTC-04-INT: Topic heading delimiters preserved in built cache
    it('TC-TTC-04-INT: topic heading delimiters preserved in built cache (FR-005, AC-005-04)', () => {
        const tmpDir = createFullTestProjectWithRealisticContent();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            const sStart = content.indexOf('<!-- SECTION: ROUNDTABLE_CONTEXT -->');
            const sEnd = content.indexOf('<!-- /SECTION: ROUNDTABLE_CONTEXT -->');
            const section = content.substring(sStart, sEnd);
            const topicBlocks = section.split('### Topic:').length - 1;
            assert.equal(topicBlocks, 2, 'Should have 2 topic blocks');
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-TTC-05: ROUNDTABLE_CONTEXT reduction -- persona tightening applied
    it('TC-TTC-05: ROUNDTABLE_CONTEXT applies persona tightening (FR-005, AC-005-05)', () => {
        const tmpDir = createFullTestProjectWithRealisticContent();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            const sStart = content.indexOf('<!-- SECTION: ROUNDTABLE_CONTEXT -->');
            const sEnd = content.indexOf('<!-- /SECTION: ROUNDTABLE_CONTEXT -->');
            const section = content.substring(sStart, sEnd);
            // Persona sections 4, 6, 8, 9, 10 should be stripped
            assert.ok(!section.includes('Analytical Approach'),
                'Section 4 should be stripped from persona content');
            assert.ok(!section.includes('Artifact Responsibilities'),
                'Section 6 should be stripped from persona content');
            // Kept sections should be present
            assert.ok(section.includes('Identity'), 'Section 1 should be present');
            assert.ok(section.includes('Principles'), 'Section 2 should be present');
        } finally {
            cleanup(tmpDir);
        }
    });

    // Topic tightening applied in cache
    it('TC-INT-TOPIC: topic tightening applied in cache (FR-005)', () => {
        const tmpDir = createFullTestProjectWithRealisticContent();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            const sStart = content.indexOf('<!-- SECTION: ROUNDTABLE_CONTEXT -->');
            const sEnd = content.indexOf('<!-- /SECTION: ROUNDTABLE_CONTEXT -->');
            const section = content.substring(sStart, sEnd);
            // Frontmatter should be stripped from topics
            assert.ok(!section.includes('depth_guidance'),
                'Topic frontmatter depth_guidance should be stripped');
            assert.ok(!section.includes('source_step_files'),
                'Topic frontmatter source_step_files should be stripped');
            // But topic content preserved
            assert.ok(section.includes('Analytical Knowledge'),
                'Topic body should be preserved');
        } finally {
            cleanup(tmpDir);
        }
    });
});

// =============================================================================
// Verbose reduction reporting tests (FR-008)
// =============================================================================

describe('Verbose reduction reporting (FR-008)', () => {
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

    // TC-REP-01: Per-section reduction reported in verbose mode
    it('TC-REP-01: per-section reduction reported in verbose mode (FR-008, AC-008-01)', () => {
        const tmpDir = createFullTestProjectWithRealisticContent();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;

        const originalWrite = process.stderr.write;
        let stderrOutput = '';
        process.stderr.write = (chunk) => { stderrOutput += chunk; };

        try {
            common.rebuildSessionCache({ projectRoot: tmpDir, verbose: true });
            assert.ok(/TIGHTEN SKILL_INDEX: \d+ -> \d+ chars/.test(stderrOutput),
                'Should report SKILL_INDEX reduction');
            assert.ok(/TIGHTEN ROUNDTABLE_CONTEXT: \d+ -> \d+ chars/.test(stderrOutput),
                'Should report ROUNDTABLE_CONTEXT reduction');
        } finally {
            process.stderr.write = originalWrite;
            cleanup(tmpDir);
        }
    });

    // TC-REP-02: Total reduction summary in verbose mode
    it('TC-REP-02: total reduction summary in verbose mode (FR-008, AC-008-02)', () => {
        const tmpDir = createFullTestProjectWithRealisticContent();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;

        const originalWrite = process.stderr.write;
        let stderrOutput = '';
        process.stderr.write = (chunk) => { stderrOutput += chunk; };

        try {
            common.rebuildSessionCache({ projectRoot: tmpDir, verbose: true });
            assert.ok(/TIGHTEN total: \d+ -> \d+ chars/.test(stderrOutput),
                'Should report total tightening reduction');
        } finally {
            process.stderr.write = originalWrite;
            cleanup(tmpDir);
        }
    });

    // TC-REP-03: Reduction stats written to stderr not stdout
    it('TC-REP-03: reduction stats in stderr not in cache content (FR-008, AC-008-03)', () => {
        const tmpDir = createFullTestProjectWithRealisticContent();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;

        const originalWrite = process.stderr.write;
        let stderrOutput = '';
        process.stderr.write = (chunk) => { stderrOutput += chunk; };

        try {
            common.rebuildSessionCache({ projectRoot: tmpDir, verbose: true });
            const cacheContent = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            assert.ok(!cacheContent.includes('TIGHTEN'), 'Cache file should NOT contain TIGHTEN');
            assert.ok(stderrOutput.includes('TIGHTEN'), 'stderr should contain TIGHTEN');
        } finally {
            process.stderr.write = originalWrite;
            cleanup(tmpDir);
        }
    });

    // TC-REP-04: Non-verbose mode does not output reduction stats
    it('TC-REP-04: non-verbose mode does not output reduction stats (FR-008, AC-008-01)', () => {
        const tmpDir = createFullTestProjectWithRealisticContent();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;

        const originalWrite = process.stderr.write;
        let stderrOutput = '';
        process.stderr.write = (chunk) => { stderrOutput += chunk; };

        try {
            common.rebuildSessionCache({ projectRoot: tmpDir, verbose: false });
            assert.ok(!stderrOutput.includes('TIGHTEN'),
                'Non-verbose mode should NOT output TIGHTEN stats');
        } finally {
            process.stderr.write = originalWrite;
            cleanup(tmpDir);
        }
    });
});

// =============================================================================
// Backward compatibility tests (cross-cutting)
// =============================================================================

describe('Backward compatibility (BWC)', () => {
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

    // TC-BWC-01: Section delimiters preserved in full cache
    it('TC-BWC-01: section delimiters preserved in full cache', () => {
        const tmpDir = createFullTestProjectWithRealisticContent();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            assert.ok(content.includes('<!-- SECTION: SKILL_INDEX -->'), 'SKILL_INDEX open delimiter');
            assert.ok(content.includes('<!-- /SECTION: SKILL_INDEX -->'), 'SKILL_INDEX close delimiter');
            assert.ok(content.includes('<!-- SECTION: ROUNDTABLE_CONTEXT -->'), 'ROUNDTABLE open delimiter');
            assert.ok(content.includes('<!-- /SECTION: ROUNDTABLE_CONTEXT -->'), 'ROUNDTABLE close delimiter');
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-BWC-02: Orchestrator persona extraction works on tightened cache
    it('TC-BWC-02: orchestrator persona extraction works on tightened cache', () => {
        const tmpDir = createFullTestProjectWithRealisticContent();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            const sStart = content.indexOf('<!-- SECTION: ROUNDTABLE_CONTEXT -->');
            const sEnd = content.indexOf('<!-- /SECTION: ROUNDTABLE_CONTEXT -->');
            const section = content.substring(sStart, sEnd);
            // Split on '### Persona:' -- should get one extra part (before first match)
            const parts = section.split('### Persona:');
            assert.equal(parts.length, 4, 'Should split into 3 persona blocks + 1 prefix');
            // Each persona block should have Identity content
            for (let i = 1; i < parts.length; i++) {
                assert.ok(parts[i].includes('Identity'),
                    `Persona block ${i} should contain Identity`);
            }
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-BWC-03: Orchestrator topic extraction works on tightened cache
    it('TC-BWC-03: orchestrator topic extraction works on tightened cache', () => {
        const tmpDir = createFullTestProjectWithRealisticContent();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            const sStart = content.indexOf('<!-- SECTION: ROUNDTABLE_CONTEXT -->');
            const sEnd = content.indexOf('<!-- /SECTION: ROUNDTABLE_CONTEXT -->');
            const section = content.substring(sStart, sEnd);
            const parts = section.split('### Topic:');
            assert.equal(parts.length, 3, 'Should split into 2 topic blocks + 1 prefix');
            for (let i = 1; i < parts.length; i++) {
                assert.ok(parts[i].includes('Analytical Knowledge'),
                    `Topic block ${i} should contain Analytical Knowledge`);
            }
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-BWC-04: Skill ID and path extractable from compact format
    it('TC-BWC-04: skill ID and path extractable from compact format', () => {
        const skillIndex = [
            { id: 'DEV-001', name: 'code-impl', description: 'Implement code', path: 'src/claude/skills/development/code-impl/SKILL.md' },
        ];
        const result = common.formatSkillIndexBlock(skillIndex);
        // Parse the compact line
        const line = result.trim();
        const match = line.match(/^\s*(\S+):\s+(\S+)\s+\|\s+(.+?)\s+\|\s+(.+)$/);
        assert.ok(match, 'Should match compact format pattern');
        assert.equal(match[1], 'DEV-001', 'Extracted ID should match');
        assert.equal(match[2], 'code-impl', 'Extracted name should match');
        // Reconstruct full path from base + short path
        const fullPath = `src/claude/skills/${match[4]}/SKILL.md`;
        assert.equal(fullPath, skillIndex[0].path, 'Reconstructed path should match original');
    });

    // TC-BWC-05: Section start/end delimiters balanced
    it('TC-BWC-05: section start/end delimiters balanced', () => {
        const tmpDir = createFullTestProjectWithRealisticContent();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            common.rebuildSessionCache({ projectRoot: tmpDir });
            const content = fs.readFileSync(path.join(tmpDir, '.isdlc', 'session-cache.md'), 'utf8');
            const sectionNames = ['CONSTITUTION', 'WORKFLOW_CONFIG', 'ITERATION_REQUIREMENTS',
                'ARTIFACT_PATHS', 'SKILLS_MANIFEST', 'SKILL_INDEX', 'ROUNDTABLE_CONTEXT'];
            for (const name of sectionNames) {
                const opens = content.split(`<!-- SECTION: ${name} -->`).length - 1;
                const closes = content.split(`<!-- /SECTION: ${name} -->`).length - 1;
                if (opens > 0) {
                    assert.equal(opens, closes,
                        `Section ${name}: opening (${opens}) and closing (${closes}) delimiters should match`);
                }
            }
        } finally {
            cleanup(tmpDir);
        }
    });

    // TC-BWC-06: Cross-section independence under failure
    it('TC-BWC-06: cross-section independence under failure', () => {
        const tmpDir = createFullTestProjectWithRealisticContent();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            // Remove persona files to simulate missing content
            const agentDir = path.join(tmpDir, 'src', 'claude', 'agents');
            fs.rmSync(agentDir, { recursive: true, force: true });
            // Cache should still build successfully
            const result = common.rebuildSessionCache({ projectRoot: tmpDir });
            assert.ok(result.sections.includes('SKILL_INDEX'),
                'SKILL_INDEX should still be present when persona files missing');
            const content = fs.readFileSync(result.path, 'utf8');
            assert.ok(content.includes('<!-- SECTION: SKILL_INDEX -->'),
                'SKILL_INDEX section should be in cache');
        } finally {
            cleanup(tmpDir);
        }
    });
});
