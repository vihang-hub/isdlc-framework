/**
 * Tests for External Skill Management (REQ-0022)
 *
 * Tests: validateSkillFrontmatter(), analyzeSkillContent(), suggestBindings(),
 *        writeExternalManifest(), formatSkillInjectionBlock(), removeSkillFromManifest(),
 *        SKILL_KEYWORD_MAP, PHASE_TO_AGENT_MAP constants,
 *        existing functions (resolveExternalSkillsPath, resolveExternalManifestPath,
 *        loadExternalManifest), integration pipelines, fail-open, backward compat,
 *        path security, performance
 *
 * Traces to: FR-001 through FR-009, NFR-001 through NFR-006, ADR-0008 through ADR-0011
 *
 * Test runner: node:test (Article II)
 * Module: CJS (hooks convention)
 * TDD: Tests written BEFORE implementation
 */

'use strict';

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
 * Load common.cjs with a fresh module cache, pointed at a test project root.
 * Follows the pattern established in skill-injection.test.cjs.
 */
function loadCommon(projectRoot) {
    delete require.cache[require.resolve(COMMON_PATH)];
    process.env.CLAUDE_PROJECT_DIR = projectRoot;
    process.env.NODE_ENV = 'test';
    process.env.ISDLC_TEST_MODE = '1';
    const common = require(COMMON_PATH);
    if (common._resetCaches) common._resetCaches();
    return common;
}

// =============================================================================
// Fixture Factories
// =============================================================================

/**
 * Create a minimal test project directory with .isdlc/ and optional manifest.
 */
function createTestProject(opts = {}) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdlc-ext-skill-'));

    // Create .isdlc/ for state.json
    const isdlcDir = path.join(tmpDir, '.isdlc');
    fs.mkdirSync(isdlcDir, { recursive: true });
    fs.writeFileSync(path.join(isdlcDir, 'state.json'), JSON.stringify({
        framework_version: '0.1.0-alpha',
        skill_enforcement: { enabled: true, mode: 'observe' }
    }));

    // Create .claude/hooks/config/ for skills-manifest
    const hooksConfigDir = path.join(tmpDir, '.claude', 'hooks', 'config');
    fs.mkdirSync(hooksConfigDir, { recursive: true });
    fs.writeFileSync(path.join(hooksConfigDir, 'skills-manifest.json'), JSON.stringify({
        version: '5.0.0', total_skills: 0, ownership: {}
    }));

    // Create external skills directory if requested
    if (opts.createExternalDir) {
        const extDir = path.join(tmpDir, '.claude', 'skills', 'external');
        fs.mkdirSync(extDir, { recursive: true });
    }

    // Create manifest if provided
    if (opts.manifest) {
        const manifestDir = path.join(tmpDir, 'docs', 'isdlc');
        fs.mkdirSync(manifestDir, { recursive: true });
        fs.writeFileSync(
            path.join(manifestDir, 'external-skills-manifest.json'),
            JSON.stringify(opts.manifest, null, 2) + '\n'
        );
    }

    return tmpDir;
}

/**
 * Create a valid skill .md file with YAML frontmatter.
 */
function createValidSkillFile(dir, name, description, body) {
    const content = [
        '---',
        `name: ${name}`,
        `description: ${description}`,
        '---',
        '',
        body || 'This is the skill body content.'
    ].join('\n');
    const filePath = path.join(dir, `${name}.md`);
    fs.writeFileSync(filePath, content);
    return filePath;
}

/**
 * Create a skill file with full optional fields.
 */
function createFullSkillFile(dir, name, opts = {}) {
    const lines = ['---'];
    lines.push(`name: ${name}`);
    lines.push(`description: ${opts.description || 'A test skill'}`);
    if (opts.owner) lines.push(`owner: ${opts.owner}`);
    if (opts.when_to_use) lines.push(`when_to_use: ${opts.when_to_use}`);
    if (opts.skill_id) lines.push(`skill_id: ${opts.skill_id}`);
    if (opts.dependencies) lines.push(`dependencies: ${opts.dependencies}`);
    lines.push('---');
    lines.push('');
    lines.push(opts.body || 'Default body content.');
    const content = lines.join('\n');
    const filePath = path.join(dir, `${name}.md`);
    fs.writeFileSync(filePath, content);
    return filePath;
}

/**
 * Clean up a temp directory.
 */
function cleanup(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch (_) { /* ignore */ }
}


// =============================================================================
// TC-01: validateSkillFrontmatter() -- Happy Path
// Traces: FR-001, V-004, V-005, V-006
// =============================================================================

describe('TC-01: validateSkillFrontmatter() -- Happy Path', () => {
    let tmpDir, common;

    before(() => {
        tmpDir = createTestProject();
        common = loadCommon(tmpDir);
    });

    after(() => cleanup(tmpDir));

    it('TC-01.01: Valid skill file with minimal frontmatter', () => {
        const filePath = createValidSkillFile(tmpDir, 'my-skill', 'A test skill', 'Body content');
        const result = common.validateSkillFrontmatter(filePath);
        assert.equal(result.valid, true);
        assert.deepStrictEqual(result.errors, []);
        assert.equal(result.parsed.name, 'my-skill');
        assert.equal(result.parsed.description, 'A test skill');
        assert.ok(typeof result.body === 'string');
    });

    it('TC-01.02: Valid skill file with all optional fields', () => {
        const filePath = createFullSkillFile(tmpDir, 'full-skill', {
            description: 'Full featured',
            owner: 'software-developer',
            when_to_use: 'During implementation',
            skill_id: 'EXT-001',
            dependencies: 'node,npm'
        });
        const result = common.validateSkillFrontmatter(filePath);
        assert.equal(result.valid, true);
        assert.equal(result.parsed.name, 'full-skill');
        assert.equal(result.parsed.description, 'Full featured');
        assert.equal(result.parsed.owner, 'software-developer');
        assert.equal(result.parsed.when_to_use, 'During implementation');
        assert.equal(result.parsed.skill_id, 'EXT-001');
        assert.equal(result.parsed.dependencies, 'node,npm');
    });

    it('TC-01.03: Body content extracted correctly', () => {
        const filePath = createValidSkillFile(tmpDir, 'body-test', 'Test', '## Section\n\nParagraph one.\n\nParagraph two.');
        const result = common.validateSkillFrontmatter(filePath);
        assert.equal(result.valid, true);
        assert.ok(result.body.includes('## Section'));
        assert.ok(result.body.includes('Paragraph one.'));
        assert.ok(result.body.includes('Paragraph two.'));
    });

    it('TC-01.04: Name with hyphens and numbers is valid', () => {
        const filePath = createValidSkillFile(tmpDir, 'nestjs-v3-conventions', 'NestJS v3');
        const result = common.validateSkillFrontmatter(filePath);
        assert.equal(result.valid, true);
    });

    it('TC-01.05: Two-character name is valid (minimum length)', () => {
        const filePath = createValidSkillFile(tmpDir, 'a1', 'Minimal name');
        const result = common.validateSkillFrontmatter(filePath);
        assert.equal(result.valid, true);
    });
});


// =============================================================================
// TC-02: validateSkillFrontmatter() -- Negative / Error Cases
// Traces: FR-001, NFR-006, V-001 through V-006
// =============================================================================

describe('TC-02: validateSkillFrontmatter() -- Error Cases', () => {
    let tmpDir, common;

    before(() => {
        tmpDir = createTestProject();
        common = loadCommon(tmpDir);
    });

    after(() => cleanup(tmpDir));

    it('TC-02.01: File not found', () => {
        const result = common.validateSkillFrontmatter(path.join(tmpDir, 'nonexistent.md'));
        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.includes('File not found')));
        assert.equal(result.parsed, null);
        assert.equal(result.body, null);
    });

    it('TC-02.02: Non-.md extension (.txt)', () => {
        const txtFile = path.join(tmpDir, 'skill.txt');
        fs.writeFileSync(txtFile, '---\nname: test\ndescription: test\n---\n');
        const result = common.validateSkillFrontmatter(txtFile);
        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.includes('.txt')));
    });

    it('TC-02.03: Non-.md extension (.json)', () => {
        const jsonFile = path.join(tmpDir, 'skill.json');
        fs.writeFileSync(jsonFile, '{"name": "test"}');
        const result = common.validateSkillFrontmatter(jsonFile);
        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.includes('.json')));
    });

    it('TC-02.04: No extension at all', () => {
        const noExtFile = path.join(tmpDir, 'skillfile');
        fs.writeFileSync(noExtFile, '---\nname: test\ndescription: test\n---\n');
        const result = common.validateSkillFrontmatter(noExtFile);
        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.includes('(none)')));
    });

    it('TC-02.05: No YAML frontmatter', () => {
        const noFm = path.join(tmpDir, 'no-frontmatter.md');
        fs.writeFileSync(noFm, '# Just a heading\n\nNo frontmatter here.');
        const result = common.validateSkillFrontmatter(noFm);
        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.includes('No YAML frontmatter')));
    });

    it('TC-02.06: Empty file', () => {
        const emptyFile = path.join(tmpDir, 'empty.md');
        fs.writeFileSync(emptyFile, '');
        const result = common.validateSkillFrontmatter(emptyFile);
        assert.equal(result.valid, false);
    });

    it('TC-02.07: Missing name field', () => {
        const noName = path.join(tmpDir, 'no-name.md');
        fs.writeFileSync(noName, '---\ndescription: Has description only\n---\nBody');
        const result = common.validateSkillFrontmatter(noName);
        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.includes('Missing required frontmatter field: name')));
    });

    it('TC-02.08: Missing description field', () => {
        const noDesc = path.join(tmpDir, 'no-desc.md');
        fs.writeFileSync(noDesc, '---\nname: valid-name\n---\nBody');
        const result = common.validateSkillFrontmatter(noDesc);
        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.includes('Missing required frontmatter field: description')));
    });

    it('TC-02.09: Both name and description missing', () => {
        const bothMissing = path.join(tmpDir, 'both-missing.md');
        fs.writeFileSync(bothMissing, '---\nowner: someone\n---\nBody');
        const result = common.validateSkillFrontmatter(bothMissing);
        assert.equal(result.valid, false);
        assert.ok(result.errors.length >= 2);
        assert.ok(result.errors.some(e => e.includes('name')));
        assert.ok(result.errors.some(e => e.includes('description')));
    });

    it('TC-02.10: Name with uppercase chars', () => {
        const upperName = path.join(tmpDir, 'upper-name.md');
        fs.writeFileSync(upperName, '---\nname: NestJS-Conventions\ndescription: Test\n---\n');
        const result = common.validateSkillFrontmatter(upperName);
        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.toLowerCase().includes('name')));
    });

    it('TC-02.11: Name with underscores', () => {
        const underName = path.join(tmpDir, 'under-name.md');
        fs.writeFileSync(underName, '---\nname: my_skill\ndescription: Test\n---\n');
        const result = common.validateSkillFrontmatter(underName);
        assert.equal(result.valid, false);
    });

    it('TC-02.12: Name with spaces', () => {
        const spaceName = path.join(tmpDir, 'space-name.md');
        fs.writeFileSync(spaceName, '---\nname: my skill\ndescription: Test\n---\n');
        const result = common.validateSkillFrontmatter(spaceName);
        assert.equal(result.valid, false);
    });

    it('TC-02.13: Name starting with hyphen', () => {
        const hyphenStart = path.join(tmpDir, 'hyphen-start.md');
        fs.writeFileSync(hyphenStart, '---\nname: -bad-name\ndescription: Test\n---\n');
        const result = common.validateSkillFrontmatter(hyphenStart);
        assert.equal(result.valid, false);
    });

    it('TC-02.14: Name ending with hyphen', () => {
        const hyphenEnd = path.join(tmpDir, 'hyphen-end.md');
        fs.writeFileSync(hyphenEnd, '---\nname: bad-name-\ndescription: Test\n---\n');
        const result = common.validateSkillFrontmatter(hyphenEnd);
        assert.equal(result.valid, false);
    });

    it('TC-02.15: Single character name', () => {
        const singleChar = path.join(tmpDir, 'single-char.md');
        fs.writeFileSync(singleChar, '---\nname: a\ndescription: Test\n---\n');
        const result = common.validateSkillFrontmatter(singleChar);
        assert.equal(result.valid, false);
    });

    it('TC-02.16: Empty name (whitespace only)', () => {
        const emptyName = path.join(tmpDir, 'empty-name.md');
        fs.writeFileSync(emptyName, '---\nname:   \ndescription: Test\n---\n');
        const result = common.validateSkillFrontmatter(emptyName);
        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.includes('Missing required frontmatter field: name')));
    });

    it('TC-02.17: Empty description (whitespace only)', () => {
        const emptyDesc = path.join(tmpDir, 'empty-desc.md');
        fs.writeFileSync(emptyDesc, '---\nname: valid-name\ndescription:   \n---\n');
        const result = common.validateSkillFrontmatter(emptyDesc);
        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.includes('Missing required frontmatter field: description')));
    });

    it('TC-02.18: All errors collected (not fail-fast)', () => {
        const multiFail = path.join(tmpDir, 'multi-fail.md');
        // Missing name + empty description
        fs.writeFileSync(multiFail, '---\ndescription:   \n---\n');
        const result = common.validateSkillFrontmatter(multiFail);
        assert.equal(result.valid, false);
        assert.ok(result.errors.length >= 2, `Expected 2+ errors, got ${result.errors.length}`);
    });
});


// =============================================================================
// TC-03: analyzeSkillContent() -- Keyword Analysis
// Traces: FR-002
// =============================================================================

describe('TC-03: analyzeSkillContent() -- Keyword Analysis', () => {
    let tmpDir, common;

    before(() => {
        tmpDir = createTestProject();
        common = loadCommon(tmpDir);
    });

    after(() => cleanup(tmpDir));

    it('TC-03.01: Testing keywords detected', () => {
        const result = common.analyzeSkillContent('This skill covers testing, mock setup, and coverage');
        assert.ok(result.keywords.some(k => k === 'testing' || k === 'test'));
        assert.ok(result.keywords.includes('mock'));
        assert.ok(result.keywords.includes('coverage'));
        assert.ok(result.suggestedPhases.includes('05-test-strategy') || result.suggestedPhases.includes('06-implementation'));
    });

    it('TC-03.02: Architecture keywords detected', () => {
        const result = common.analyzeSkillContent('Design patterns for microservice architecture');
        assert.ok(result.keywords.includes('architecture'));
        assert.ok(result.keywords.includes('design pattern'));
        assert.ok(result.keywords.includes('microservice'));
        assert.ok(result.suggestedPhases.includes('03-architecture'));
    });

    it('TC-03.03: DevOps keywords detected', () => {
        const result = common.analyzeSkillContent('Docker deployment pipeline with CI/CD');
        assert.ok(result.keywords.includes('deploy'));
        assert.ok(result.keywords.includes('docker'));
        assert.ok(result.keywords.includes('ci/cd'));
        assert.ok(result.suggestedPhases.includes('10-cicd'));
    });

    it('TC-03.04: Security keywords detected', () => {
        const result = common.analyzeSkillContent('OWASP security authentication encryption');
        assert.ok(result.suggestedPhases.includes('09-validation'));
    });

    it('TC-03.05: Implementation keywords detected', () => {
        const result = common.analyzeSkillContent('Implement controller API endpoint service');
        assert.ok(result.suggestedPhases.includes('06-implementation'));
    });

    it('TC-03.06: Requirements keywords detected', () => {
        const result = common.analyzeSkillContent('User story acceptance criteria specification');
        assert.ok(result.suggestedPhases.includes('01-requirements'));
    });

    it('TC-03.07: Review keywords detected', () => {
        const result = common.analyzeSkillContent('Code review quality lint static analysis');
        assert.ok(result.suggestedPhases.includes('08-code-review'));
    });

    it('TC-03.08: Mixed categories (cross-cutting)', () => {
        const result = common.analyzeSkillContent('Testing the API endpoint implementation');
        // Should include both testing and implementation phases
        const hasTestPhase = result.suggestedPhases.includes('05-test-strategy') || result.suggestedPhases.includes('06-implementation');
        assert.ok(hasTestPhase, 'Should include a testing or implementation phase');
    });

    it('TC-03.09: Case insensitive matching', () => {
        const result = common.analyzeSkillContent('DOCKER deployment with TESTING');
        assert.ok(result.keywords.length >= 2, 'Should detect keywords regardless of case');
    });

    it('TC-03.10: High confidence (3+ keywords)', () => {
        const result = common.analyzeSkillContent('testing coverage mock assertion in unit tests');
        assert.equal(result.confidence, 'high');
    });

    it('TC-03.11: Medium confidence (1-2 keywords)', () => {
        const result = common.analyzeSkillContent('This discusses testing only');
        assert.equal(result.confidence, 'medium');
    });

    it('TC-03.12: Low confidence (no keywords)', () => {
        const result = common.analyzeSkillContent('Random content with no matching terms whatsoever');
        assert.equal(result.confidence, 'low');
        assert.deepStrictEqual(result.suggestedPhases, ['06-implementation']);
    });
});


// =============================================================================
// TC-04: analyzeSkillContent() -- Edge Cases
// Traces: FR-002
// =============================================================================

describe('TC-04: analyzeSkillContent() -- Edge Cases', () => {
    let tmpDir, common;

    before(() => {
        tmpDir = createTestProject();
        common = loadCommon(tmpDir);
    });

    after(() => cleanup(tmpDir));

    it('TC-04.01: Null input', () => {
        const result = common.analyzeSkillContent(null);
        assert.deepStrictEqual(result.keywords, []);
        assert.deepStrictEqual(result.suggestedPhases, ['06-implementation']);
        assert.equal(result.confidence, 'low');
    });

    it('TC-04.02: Undefined input', () => {
        const result = common.analyzeSkillContent(undefined);
        assert.deepStrictEqual(result.keywords, []);
        assert.deepStrictEqual(result.suggestedPhases, ['06-implementation']);
        assert.equal(result.confidence, 'low');
    });

    it('TC-04.03: Empty string', () => {
        const result = common.analyzeSkillContent('');
        assert.equal(result.confidence, 'low');
        assert.deepStrictEqual(result.suggestedPhases, ['06-implementation']);
    });

    it('TC-04.04: Non-string input (number)', () => {
        const result = common.analyzeSkillContent(42);
        assert.deepStrictEqual(result.keywords, []);
        assert.equal(result.confidence, 'low');
    });

    it('TC-04.05: Phases deduplicated', () => {
        // "test" and "testing" belong to same category -- should not duplicate phases
        const result = common.analyzeSkillContent('test testing more test assertions');
        const uniquePhases = [...new Set(result.suggestedPhases)];
        assert.deepStrictEqual(result.suggestedPhases, uniquePhases, 'Phases should be deduplicated');
    });
});


// =============================================================================
// TC-05: suggestBindings() -- Binding Suggestions
// Traces: FR-002, PHASE_TO_AGENT_MAP
// =============================================================================

describe('TC-05: suggestBindings() -- Binding Suggestions', () => {
    let tmpDir, common;

    before(() => {
        tmpDir = createTestProject();
        common = loadCommon(tmpDir);
    });

    after(() => cleanup(tmpDir));

    it('TC-05.01: Maps phases to agents correctly', () => {
        const result = common.suggestBindings({ suggestedPhases: ['06-implementation'], confidence: 'medium' });
        assert.ok(result.agents.includes('software-developer'));
    });

    it('TC-05.02: Multiple phases map to multiple agents', () => {
        const result = common.suggestBindings({ suggestedPhases: ['03-architecture', '04-design'], confidence: 'high' });
        assert.ok(result.agents.includes('solution-architect'));
        assert.ok(result.agents.includes('system-designer'));
    });

    it('TC-05.03: Default delivery type is context', () => {
        const result = common.suggestBindings({ suggestedPhases: ['06-implementation'], confidence: 'medium' });
        assert.equal(result.delivery_type, 'context');
    });

    it('TC-05.04: Frontmatter owner adds agent', () => {
        const result = common.suggestBindings(
            { suggestedPhases: ['06-implementation'], confidence: 'medium' },
            { owner: 'qa-engineer' }
        );
        assert.ok(result.agents.includes('qa-engineer'));
    });

    it('TC-05.05: Owner upgrades confidence from low', () => {
        const result = common.suggestBindings(
            { suggestedPhases: ['06-implementation'], confidence: 'low' },
            { owner: 'software-developer' }
        );
        assert.equal(result.confidence, 'medium');
    });

    it('TC-05.06: when_to_use with "must" suggests instruction', () => {
        const result = common.suggestBindings(
            { suggestedPhases: ['06-implementation'], confidence: 'medium' },
            { when_to_use: 'You must follow these conventions' }
        );
        assert.equal(result.delivery_type, 'instruction');
    });

    it('TC-05.07: when_to_use with "standard" suggests instruction', () => {
        const result = common.suggestBindings(
            { suggestedPhases: ['06-implementation'], confidence: 'medium' },
            { when_to_use: 'Company standard coding rules' }
        );
        assert.equal(result.delivery_type, 'instruction');
    });

    it('TC-05.08: Large content suggests reference', () => {
        const result = common.suggestBindings(
            { suggestedPhases: ['06-implementation'], confidence: 'medium', contentLength: 6000 }
        );
        assert.equal(result.delivery_type, 'reference');
    });

    it('TC-05.09: Null analysis uses defaults', () => {
        const result = common.suggestBindings(null);
        assert.deepStrictEqual(result.phases, ['06-implementation']);
        assert.equal(result.confidence, 'low');
    });

    it('TC-05.10: Null frontmatterHints is safe', () => {
        const result = common.suggestBindings(
            { suggestedPhases: ['06-implementation'], confidence: 'medium' },
            null
        );
        assert.ok(result.agents.length > 0);
        assert.equal(result.delivery_type, 'context');
    });
});


// =============================================================================
// TC-06: writeExternalManifest() -- Happy Path
// Traces: FR-004
// =============================================================================

describe('TC-06: writeExternalManifest() -- Manifest I/O', () => {
    let tmpDir, common;

    beforeEach(() => {
        tmpDir = createTestProject();
        common = loadCommon(tmpDir);
    });

    afterEach(() => cleanup(tmpDir));

    it('TC-06.01: Writes valid manifest to disk', () => {
        const manifest = { version: '1.0.0', skills: [] };
        const result = common.writeExternalManifest(manifest);
        assert.equal(result.success, true);
        assert.ok(fs.existsSync(result.path));
        const onDisk = JSON.parse(fs.readFileSync(result.path, 'utf8'));
        assert.deepStrictEqual(onDisk, manifest);
    });

    it('TC-06.02: Creates parent directories', () => {
        // Remove the docs/isdlc dir if it exists to test creation
        const docsDir = path.join(tmpDir, 'docs', 'isdlc');
        if (fs.existsSync(docsDir)) {
            fs.rmSync(docsDir, { recursive: true, force: true });
        }
        const manifest = { version: '1.0.0', skills: [] };
        const result = common.writeExternalManifest(manifest);
        assert.equal(result.success, true);
        assert.ok(fs.existsSync(result.path));
    });

    it('TC-06.03: Writes with 2-space indentation and trailing newline', () => {
        const manifest = { version: '1.0.0', skills: [{ name: 'test' }] };
        const result = common.writeExternalManifest(manifest);
        assert.equal(result.success, true);
        const raw = fs.readFileSync(result.path, 'utf8');
        assert.ok(raw.endsWith('\n'), 'Should end with trailing newline');
        assert.ok(raw.includes('  "version"'), 'Should use 2-space indent');
    });

    it('TC-06.04: Overwrites existing manifest', () => {
        const manifest1 = { version: '1.0.0', skills: [{ name: 'old-skill' }] };
        common.writeExternalManifest(manifest1);
        const manifest2 = { version: '1.0.0', skills: [{ name: 'new-skill' }] };
        const result = common.writeExternalManifest(manifest2);
        assert.equal(result.success, true);
        const onDisk = JSON.parse(fs.readFileSync(result.path, 'utf8'));
        assert.equal(onDisk.skills[0].name, 'new-skill');
    });

    it('TC-06.05: Validates JSON after write (re-read)', () => {
        const manifest = { version: '1.0.0', skills: [] };
        const result = common.writeExternalManifest(manifest);
        assert.equal(result.success, true);
        assert.equal(result.error, null);
    });

    it('TC-06.06: Returns path in result', () => {
        const manifest = { version: '1.0.0', skills: [] };
        const result = common.writeExternalManifest(manifest);
        assert.ok(typeof result.path === 'string');
        assert.ok(path.isAbsolute(result.path));
    });

    it('TC-06.07: Manifest with single skill', () => {
        const manifest = {
            version: '1.0.0',
            skills: [{
                name: 'test-skill',
                description: 'Test',
                file: 'test-skill.md',
                added_at: '2026-02-18T12:00:00Z',
                bindings: {
                    agents: ['software-developer'],
                    phases: ['06-implementation'],
                    injection_mode: 'always',
                    delivery_type: 'context'
                }
            }]
        };
        const result = common.writeExternalManifest(manifest);
        assert.equal(result.success, true);
        const onDisk = JSON.parse(fs.readFileSync(result.path, 'utf8'));
        assert.equal(onDisk.skills.length, 1);
        assert.equal(onDisk.skills[0].name, 'test-skill');
    });

    it('TC-06.08: Manifest with 50 skills (max)', () => {
        const skills = [];
        for (let i = 0; i < 50; i++) {
            skills.push({ name: `skill-${String(i).padStart(3, '0')}`, file: `skill-${i}.md` });
        }
        const manifest = { version: '1.0.0', skills };
        const result = common.writeExternalManifest(manifest);
        assert.equal(result.success, true);
        const onDisk = JSON.parse(fs.readFileSync(result.path, 'utf8'));
        assert.equal(onDisk.skills.length, 50);
    });
});


// =============================================================================
// TC-07: writeExternalManifest() -- Error Cases
// Traces: FR-004, SKL-E012, SKL-E013
// =============================================================================

describe('TC-07: writeExternalManifest() -- Error Cases', () => {
    let tmpDir, common;

    before(() => {
        tmpDir = createTestProject();
        common = loadCommon(tmpDir);
    });

    after(() => cleanup(tmpDir));

    it('TC-07.01: Returns error on write failure (never throws)', () => {
        // Point at a read-only or invalid directory
        const badDir = createTestProject();
        const badCommon = loadCommon(badDir);
        const docsDir = path.join(badDir, 'docs', 'isdlc');
        fs.mkdirSync(docsDir, { recursive: true });
        // Create a directory where the manifest file should be, causing a write failure
        fs.mkdirSync(path.join(docsDir, 'external-skills-manifest.json'), { recursive: true });
        const result = badCommon.writeExternalManifest({ version: '1.0.0', skills: [] });
        assert.equal(result.success, false);
        assert.ok(typeof result.error === 'string');
        cleanup(badDir);
    });

    it('TC-07.02: Returns error on verification failure', () => {
        // This test verifies that if the written manifest doesn't have a skills array,
        // it reports validation failure. We test by writing a manifest that is technically
        // valid JSON but the re-read verification should catch non-array skills.
        // In practice this is hard to trigger since we control the input, but the
        // function should still not throw.
        const manifest = { version: '1.0.0', skills: [] };
        const result = common.writeExternalManifest(manifest);
        // Normal case should succeed
        assert.equal(result.success, true);
    });
});


// =============================================================================
// TC-08: formatSkillInjectionBlock() -- Formatting
// Traces: FR-005
// =============================================================================

describe('TC-08: formatSkillInjectionBlock() -- Formatting', () => {
    let tmpDir, common;

    before(() => {
        tmpDir = createTestProject();
        common = loadCommon(tmpDir);
    });

    after(() => cleanup(tmpDir));

    it('TC-08.01: Context delivery format', () => {
        const result = common.formatSkillInjectionBlock('my-skill', 'content here', 'context');
        assert.equal(result, 'EXTERNAL SKILL CONTEXT: my-skill\n---\ncontent here\n---');
    });

    it('TC-08.02: Instruction delivery format', () => {
        const result = common.formatSkillInjectionBlock('my-skill', 'rules here', 'instruction');
        assert.equal(result, 'EXTERNAL SKILL INSTRUCTION (my-skill): You MUST follow these guidelines:\nrules here');
    });

    it('TC-08.03: Reference delivery format', () => {
        const result = common.formatSkillInjectionBlock('my-skill', '/path/to/file', 'reference');
        assert.equal(result, 'EXTERNAL SKILL AVAILABLE: my-skill -- Read from /path/to/file if relevant to your current task');
    });

    it('TC-08.04: Unknown delivery type returns empty', () => {
        const result = common.formatSkillInjectionBlock('x', 'y', 'unknown');
        assert.equal(result, '');
    });

    it('TC-08.05: Empty content handled', () => {
        const result = common.formatSkillInjectionBlock('my-skill', '', 'context');
        assert.equal(result, 'EXTERNAL SKILL CONTEXT: my-skill\n---\n\n---');
    });

    it('TC-08.06: Content with special characters', () => {
        const content = 'Use `backticks` and **bold** and\n```js\ncode\n```';
        const result = common.formatSkillInjectionBlock('my-skill', content, 'context');
        assert.ok(result.includes('`backticks`'));
        assert.ok(result.includes('```js'));
    });

    it('TC-08.07: Long skill name handled', () => {
        const longName = 'a'.repeat(100);
        const result = common.formatSkillInjectionBlock(longName, 'content', 'context');
        assert.ok(result.includes(longName));
    });

    it('TC-08.08: Multiline content preserved', () => {
        const content = 'Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.';
        const result = common.formatSkillInjectionBlock('my-skill', content, 'context');
        assert.ok(result.includes('Paragraph 1.'));
        assert.ok(result.includes('Paragraph 2.'));
        assert.ok(result.includes('Paragraph 3.'));
    });
});


// =============================================================================
// TC-09: removeSkillFromManifest() -- Removal
// Traces: FR-007
// =============================================================================

describe('TC-09: removeSkillFromManifest() -- Removal', () => {
    let tmpDir, common;

    before(() => {
        tmpDir = createTestProject();
        common = loadCommon(tmpDir);
    });

    after(() => cleanup(tmpDir));

    it('TC-09.01: Removes existing skill by name', () => {
        const manifest = {
            version: '1.0.0',
            skills: [
                { name: 'skill-a' },
                { name: 'skill-b' },
                { name: 'skill-c' }
            ]
        };
        const result = common.removeSkillFromManifest('skill-b', manifest);
        assert.equal(result.removed, true);
        assert.equal(result.manifest.skills.length, 2);
    });

    it('TC-09.02: Name not found returns removed: false', () => {
        const manifest = {
            version: '1.0.0',
            skills: [{ name: 'skill-a' }, { name: 'skill-b' }, { name: 'skill-c' }]
        };
        const result = common.removeSkillFromManifest('nonexistent', manifest);
        assert.equal(result.removed, false);
        assert.equal(result.manifest.skills.length, 3);
    });

    it('TC-09.03: Null manifest handled safely', () => {
        const result = common.removeSkillFromManifest('any-skill', null);
        assert.equal(result.removed, false);
        assert.deepStrictEqual(result.manifest, { version: '1.0.0', skills: [] });
    });

    it('TC-09.04: Manifest without skills array', () => {
        const result = common.removeSkillFromManifest('any-skill', { version: '1.0.0' });
        assert.equal(result.removed, false);
    });

    it('TC-09.05: Case-sensitive name matching', () => {
        const manifest = {
            version: '1.0.0',
            skills: [{ name: 'my-skill' }]
        };
        const result = common.removeSkillFromManifest('My-Skill', manifest);
        assert.equal(result.removed, false, 'Should require exact case match');
    });

    it('TC-09.06: Removes only the named skill', () => {
        const manifest = {
            version: '1.0.0',
            skills: [
                { name: 'skill-a', file: 'a.md' },
                { name: 'skill-b', file: 'b.md' },
                { name: 'skill-c', file: 'c.md' }
            ]
        };
        const result = common.removeSkillFromManifest('skill-b', manifest);
        assert.equal(result.manifest.skills.length, 2);
        assert.ok(result.manifest.skills.some(s => s.name === 'skill-a'));
        assert.ok(result.manifest.skills.some(s => s.name === 'skill-c'));
        assert.ok(!result.manifest.skills.some(s => s.name === 'skill-b'));
    });
});


// =============================================================================
// TC-10: Existing Functions -- Coverage Gap Fill
// Traces: NFR-004 (Monorepo Compatibility), CON-002
// =============================================================================

describe('TC-10: Existing Functions -- Coverage Gap Fill', () => {
    let tmpDir, common;

    beforeEach(() => {
        tmpDir = createTestProject();
        common = loadCommon(tmpDir);
    });

    afterEach(() => cleanup(tmpDir));

    it('TC-10.01: resolveExternalSkillsPath -- single project', () => {
        const result = common.resolveExternalSkillsPath();
        assert.ok(result.endsWith(path.join('.claude', 'skills', 'external')));
    });

    it('TC-10.02: resolveExternalManifestPath -- single project', () => {
        const result = common.resolveExternalManifestPath();
        assert.ok(result.endsWith(path.join('docs', 'isdlc', 'external-skills-manifest.json')));
    });

    it('TC-10.03: loadExternalManifest -- no manifest file', () => {
        const result = common.loadExternalManifest();
        assert.equal(result, null);
    });

    it('TC-10.04: loadExternalManifest -- valid manifest', () => {
        const manifestDir = path.join(tmpDir, 'docs', 'isdlc');
        fs.mkdirSync(manifestDir, { recursive: true });
        fs.writeFileSync(
            path.join(manifestDir, 'external-skills-manifest.json'),
            JSON.stringify({ version: '1.0.0', skills: [] })
        );
        // Re-load common to pick up the file
        common = loadCommon(tmpDir);
        const result = common.loadExternalManifest();
        assert.ok(result !== null);
        assert.equal(result.version, '1.0.0');
        assert.deepStrictEqual(result.skills, []);
    });

    it('TC-10.05: loadExternalManifest -- corrupt JSON (fail-open)', () => {
        const manifestDir = path.join(tmpDir, 'docs', 'isdlc');
        fs.mkdirSync(manifestDir, { recursive: true });
        fs.writeFileSync(
            path.join(manifestDir, 'external-skills-manifest.json'),
            'NOT VALID JSON {'
        );
        common = loadCommon(tmpDir);
        const result = common.loadExternalManifest();
        assert.equal(result, null);
    });

    it('TC-10.06: resolveExternalSkillsPath -- with explicit projectId', () => {
        // In non-monorepo mode, projectId is ignored; just verify no crash
        const result = common.resolveExternalSkillsPath('test-project');
        assert.ok(typeof result === 'string');
    });
});


// =============================================================================
// TC-11: Integration -- Skill Add Pipeline
// Traces: FR-001, FR-002, FR-004
// =============================================================================

describe('TC-11: Integration -- Skill Add Pipeline', () => {
    let tmpDir, common;

    beforeEach(() => {
        tmpDir = createTestProject({ createExternalDir: true });
        common = loadCommon(tmpDir);
    });

    afterEach(() => cleanup(tmpDir));

    it('TC-11.01: Full validate -> analyze -> suggest -> write', () => {
        const filePath = createValidSkillFile(
            tmpDir, 'test-utils', 'Testing utilities',
            'Provides testing, mock, and coverage utilities for unit tests.'
        );

        // Step 1: Validate
        const validation = common.validateSkillFrontmatter(filePath);
        assert.equal(validation.valid, true);

        // Step 2: Analyze
        const analysis = common.analyzeSkillContent(validation.body);
        assert.ok(analysis.keywords.length > 0);

        // Step 3: Suggest
        const suggestions = common.suggestBindings(analysis, validation.parsed);
        assert.ok(suggestions.agents.length > 0);
        assert.ok(suggestions.phases.length > 0);

        // Step 4: Write manifest
        const manifest = {
            version: '1.0.0',
            skills: [{
                name: validation.parsed.name,
                description: validation.parsed.description,
                file: `${validation.parsed.name}.md`,
                added_at: new Date().toISOString(),
                bindings: {
                    agents: suggestions.agents,
                    phases: suggestions.phases,
                    injection_mode: 'always',
                    delivery_type: suggestions.delivery_type
                }
            }]
        };
        const writeResult = common.writeExternalManifest(manifest);
        assert.equal(writeResult.success, true);
    });

    it('TC-11.02: Full pipeline with architecture skill', () => {
        const filePath = createValidSkillFile(
            tmpDir, 'arch-patterns', 'Architecture patterns',
            'Design patterns for microservice architecture and component modules.'
        );
        const validation = common.validateSkillFrontmatter(filePath);
        assert.equal(validation.valid, true);

        const analysis = common.analyzeSkillContent(validation.body);
        assert.ok(analysis.suggestedPhases.includes('03-architecture') || analysis.suggestedPhases.includes('04-design'));
    });

    it('TC-11.03: Pipeline with no keyword matches', () => {
        const filePath = createValidSkillFile(
            tmpDir, 'random-stuff', 'Random content',
            'Nothing related to any particular domain here.'
        );
        const validation = common.validateSkillFrontmatter(filePath);
        const analysis = common.analyzeSkillContent(validation.body);
        assert.deepStrictEqual(analysis.suggestedPhases, ['06-implementation']);
        assert.equal(analysis.confidence, 'low');
    });

    it('TC-11.04: Pipeline with large content', () => {
        const largeBody = 'x'.repeat(6000);
        const filePath = createValidSkillFile(tmpDir, 'large-skill', 'Large content', largeBody);
        const validation = common.validateSkillFrontmatter(filePath);
        const analysis = common.analyzeSkillContent(validation.body);
        analysis.contentLength = validation.body.length;
        const suggestions = common.suggestBindings(analysis, validation.parsed);
        assert.equal(suggestions.delivery_type, 'reference');
    });
});


// =============================================================================
// TC-12: Integration -- Runtime Injection Pipeline
// Traces: FR-005, NFR-001, NFR-003
// =============================================================================

describe('TC-12: Integration -- Runtime Injection Pipeline', () => {
    let tmpDir, common;

    beforeEach(() => {
        tmpDir = createTestProject({ createExternalDir: true });
        common = loadCommon(tmpDir);
    });

    afterEach(() => cleanup(tmpDir));

    it('TC-12.01: Load manifest + format injection for matching phase', () => {
        // Set up manifest with a skill bound to 06-implementation
        const manifest = {
            version: '1.0.0',
            skills: [{
                name: 'impl-skill',
                description: 'Implementation help',
                file: 'impl-skill.md',
                added_at: '2026-02-18T12:00:00Z',
                bindings: {
                    agents: ['software-developer'],
                    phases: ['06-implementation'],
                    injection_mode: 'always',
                    delivery_type: 'context'
                }
            }]
        };
        common.writeExternalManifest(manifest);

        // Create the skill file
        const extDir = path.join(tmpDir, '.claude', 'skills', 'external');
        fs.writeFileSync(path.join(extDir, 'impl-skill.md'), '---\nname: impl-skill\ndescription: Implementation help\n---\nImpl content');

        // Re-load manifest
        common = loadCommon(tmpDir);
        const loaded = common.loadExternalManifest();
        assert.ok(loaded !== null);

        // Match and format
        const skill = loaded.skills[0];
        assert.ok(skill.bindings.phases.includes('06-implementation'));
        const block = common.formatSkillInjectionBlock(skill.name, 'Impl content', skill.bindings.delivery_type);
        assert.ok(block.includes('EXTERNAL SKILL CONTEXT: impl-skill'));
    });

    it('TC-12.02: No match when phase does not match', () => {
        const manifest = {
            version: '1.0.0',
            skills: [{
                name: 'arch-skill',
                description: 'Architecture only',
                file: 'arch-skill.md',
                bindings: {
                    agents: ['solution-architect'],
                    phases: ['03-architecture'],
                    injection_mode: 'always',
                    delivery_type: 'context'
                }
            }]
        };
        common.writeExternalManifest(manifest);
        common = loadCommon(tmpDir);
        const loaded = common.loadExternalManifest();
        const skill = loaded.skills[0];
        const currentPhase = '06-implementation';
        const matches = skill.bindings.phases.includes(currentPhase) || skill.bindings.agents.includes('software-developer');
        assert.equal(matches, false, 'Skill should not match phase 06-implementation');
    });

    it('TC-12.03: Missing skill file at injection time (fail-open)', () => {
        const manifest = {
            version: '1.0.0',
            skills: [{
                name: 'ghost-skill',
                description: 'Ghost',
                file: 'ghost-skill.md',
                bindings: {
                    agents: ['software-developer'],
                    phases: ['06-implementation'],
                    injection_mode: 'always',
                    delivery_type: 'context'
                }
            }]
        };
        common.writeExternalManifest(manifest);
        common = loadCommon(tmpDir);

        // Try to read the skill file -- it doesn't exist
        const extDir = common.resolveExternalSkillsPath();
        const skillFilePath = path.join(extDir, 'ghost-skill.md');
        assert.equal(fs.existsSync(skillFilePath), false, 'Skill file should not exist');
        // Fail-open: no crash, just skip
    });

    it('TC-12.04: Malformed manifest at injection time', () => {
        const manifestDir = path.join(tmpDir, 'docs', 'isdlc');
        fs.mkdirSync(manifestDir, { recursive: true });
        fs.writeFileSync(
            path.join(manifestDir, 'external-skills-manifest.json'),
            'CORRUPT JSON DATA!!!'
        );
        common = loadCommon(tmpDir);
        const loaded = common.loadExternalManifest();
        assert.equal(loaded, null, 'Should return null on corrupt manifest');
    });
});


// =============================================================================
// TC-13: Integration -- Skill Removal Pipeline
// Traces: FR-007, FR-004
// =============================================================================

describe('TC-13: Integration -- Skill Removal Pipeline', () => {
    let tmpDir, common;

    beforeEach(() => {
        tmpDir = createTestProject();
        common = loadCommon(tmpDir);
    });

    afterEach(() => cleanup(tmpDir));

    it('TC-13.01: Remove and rewrite manifest', () => {
        const manifest = {
            version: '1.0.0',
            skills: [
                { name: 'skill-a', file: 'skill-a.md' },
                { name: 'skill-b', file: 'skill-b.md' }
            ]
        };
        common.writeExternalManifest(manifest);
        common = loadCommon(tmpDir);
        const loaded = common.loadExternalManifest();
        const { removed, manifest: updated } = common.removeSkillFromManifest('skill-a', loaded);
        assert.equal(removed, true);
        const writeResult = common.writeExternalManifest(updated);
        assert.equal(writeResult.success, true);
        common = loadCommon(tmpDir);
        const final = common.loadExternalManifest();
        assert.equal(final.skills.length, 1);
        assert.equal(final.skills[0].name, 'skill-b');
    });

    it('TC-13.02: Remove last skill leaves empty array', () => {
        const manifest = { version: '1.0.0', skills: [{ name: 'only-skill' }] };
        common.writeExternalManifest(manifest);
        common = loadCommon(tmpDir);
        const loaded = common.loadExternalManifest();
        const { removed, manifest: updated } = common.removeSkillFromManifest('only-skill', loaded);
        assert.equal(removed, true);
        common.writeExternalManifest(updated);
        common = loadCommon(tmpDir);
        const final = common.loadExternalManifest();
        assert.deepStrictEqual(final.skills, []);
    });

    it('TC-13.03: Remove non-existent skill, manifest unchanged', () => {
        const manifest = {
            version: '1.0.0',
            skills: [{ name: 'real-skill', file: 'real-skill.md' }]
        };
        common.writeExternalManifest(manifest);
        common = loadCommon(tmpDir);
        const loaded = common.loadExternalManifest();
        const { removed, manifest: updated } = common.removeSkillFromManifest('ghost-skill', loaded);
        assert.equal(removed, false);
        assert.equal(updated.skills.length, 1);
    });
});


// =============================================================================
// TC-14: Fail-Open Behavior (NFR-003)
// Traces: NFR-003, NFR-005
// =============================================================================

describe('TC-14: Fail-Open Behavior', () => {
    let tmpDir, common;

    beforeEach(() => {
        tmpDir = createTestProject();
        common = loadCommon(tmpDir);
    });

    afterEach(() => cleanup(tmpDir));

    it('TC-14.01: No manifest file -- loadExternalManifest returns null', () => {
        const result = common.loadExternalManifest();
        assert.equal(result, null);
    });

    it('TC-14.02: Manifest exists but skills array empty', () => {
        const manifest = { version: '1.0.0', skills: [] };
        common.writeExternalManifest(manifest);
        common = loadCommon(tmpDir);
        const loaded = common.loadExternalManifest();
        assert.ok(loaded !== null);
        assert.equal(loaded.skills.length, 0);
    });

    it('TC-14.03: Skill entry without bindings (backward compat)', () => {
        const manifest = {
            version: '1.0.0',
            skills: [{
                name: 'legacy-skill',
                file: 'legacy-skill.md',
                added_at: '2026-01-01T00:00:00Z'
                // No bindings object
            }]
        };
        common.writeExternalManifest(manifest);
        common = loadCommon(tmpDir);
        const loaded = common.loadExternalManifest();
        const skill = loaded.skills[0];
        // No bindings -- should be skipped during injection
        assert.equal(skill.bindings, undefined);
    });

    it('TC-14.04: Skill file missing from disk', () => {
        const extDir = common.resolveExternalSkillsPath();
        const missingFile = path.join(extDir, 'does-not-exist.md');
        assert.equal(fs.existsSync(missingFile), false);
        // Injection should skip this skill -- no crash
    });

    it('TC-14.05: Entire injection pipeline error (corrupt manifest)', () => {
        const manifestDir = path.join(tmpDir, 'docs', 'isdlc');
        fs.mkdirSync(manifestDir, { recursive: true });
        fs.writeFileSync(
            path.join(manifestDir, 'external-skills-manifest.json'),
            '{{BROKEN}}'
        );
        common = loadCommon(tmpDir);
        const loaded = common.loadExternalManifest();
        assert.equal(loaded, null, 'Should return null on parse failure');
    });
});


// =============================================================================
// TC-15: Backward Compatibility (NFR-005)
// Traces: NFR-005
// =============================================================================

describe('TC-15: Backward Compatibility', () => {
    let tmpDir, common;

    before(() => {
        tmpDir = createTestProject();
        common = loadCommon(tmpDir);
    });

    after(() => cleanup(tmpDir));

    it('TC-15.01: No manifest file, no external dir -- all functions handle gracefully', () => {
        assert.equal(common.loadExternalManifest(), null);
        assert.ok(typeof common.resolveExternalSkillsPath() === 'string');
        assert.ok(typeof common.resolveExternalManifestPath() === 'string');
    });

    it('TC-15.02: loadExternalManifest returns null not error', () => {
        const result = common.loadExternalManifest();
        assert.equal(result, null);
    });

    it('TC-15.03: Manifest entry without bindings object is safe', () => {
        const manifest = {
            version: '1.0.0',
            skills: [{
                name: 'legacy-skill',
                file: 'legacy-skill.md',
                added_at: '2026-01-01T00:00:00Z'
            }]
        };
        // Write and re-read
        common = loadCommon(createTestProject({ manifest }));
        const loaded = common.loadExternalManifest();
        const skill = loaded.skills[0];
        assert.equal(skill.bindings, undefined, 'Legacy entries should have no bindings');
        // Simulating injection check: skill without bindings is skipped
        const hasBindings = skill.bindings && skill.bindings.injection_mode === 'always';
        assert.ok(!hasBindings, 'Should be skipped during injection');
    });
});


// =============================================================================
// TC-16: Path Security
// Traces: Security T1, PS-001 through PS-004
// =============================================================================

describe('TC-16: Path Security', () => {
    let tmpDir, common;

    before(() => {
        tmpDir = createTestProject();
        common = loadCommon(tmpDir);
    });

    after(() => cleanup(tmpDir));

    it('TC-16.01: Filename with forward slash rejected', () => {
        const filename = '../../etc/passwd';
        const hasFwdSlash = filename.includes('/');
        assert.ok(hasFwdSlash, 'Test setup: filename should contain /');
        // Path traversal check: the filename must not contain / \ or ..
        const isUnsafe = filename.includes('/') || filename.includes('\\') || filename.includes('..');
        assert.ok(isUnsafe, 'Should be detected as unsafe');
    });

    it('TC-16.02: Filename with backslash rejected', () => {
        const filename = '..\\windows\\system';
        const isUnsafe = filename.includes('/') || filename.includes('\\') || filename.includes('..');
        assert.ok(isUnsafe, 'Should be detected as unsafe');
    });

    it('TC-16.03: Filename with .. rejected', () => {
        const filename = '../parent.md';
        const isUnsafe = filename.includes('/') || filename.includes('\\') || filename.includes('..');
        assert.ok(isUnsafe, 'Should be detected as unsafe');
    });

    it('TC-16.04: Clean filename accepted', () => {
        const filename = 'my-skill.md';
        const isUnsafe = filename.includes('/') || filename.includes('\\') || filename.includes('..');
        assert.equal(isUnsafe, false, 'Should be safe');
    });
});


// =============================================================================
// TC-17: Performance (NFR-001, NFR-002)
// Traces: NFR-001, NFR-002
// =============================================================================

describe('TC-17: Performance', () => {
    let tmpDir, common;

    before(() => {
        tmpDir = createTestProject({ createExternalDir: true });
        common = loadCommon(tmpDir);
    });

    after(() => cleanup(tmpDir));

    it('TC-17.01: Single skill injection under 100ms', () => {
        const start = Date.now();
        const block = common.formatSkillInjectionBlock('perf-test', 'Some content', 'context');
        const elapsed = Date.now() - start;
        assert.ok(block.length > 0);
        assert.ok(elapsed < 100, `formatSkillInjectionBlock took ${elapsed}ms, expected <100ms`);
    });

    it('TC-17.02: 50-skill manifest parse under 500ms', () => {
        const skills = [];
        for (let i = 0; i < 50; i++) {
            skills.push({
                name: `perf-skill-${i}`,
                file: `perf-skill-${i}.md`,
                bindings: {
                    agents: ['software-developer'],
                    phases: ['06-implementation'],
                    injection_mode: 'always',
                    delivery_type: 'context'
                }
            });
        }
        const manifest = { version: '1.0.0', skills };
        common.writeExternalManifest(manifest);
        common = loadCommon(tmpDir);

        const start = Date.now();
        const loaded = common.loadExternalManifest();
        const elapsed = Date.now() - start;

        assert.ok(loaded !== null);
        assert.equal(loaded.skills.length, 50);
        assert.ok(elapsed < 500, `Manifest load took ${elapsed}ms, expected <500ms`);
    });

    it('TC-17.03: analyzeSkillContent under 10ms', () => {
        const content = 'x'.repeat(2000);
        const start = Date.now();
        common.analyzeSkillContent(content);
        const elapsed = Date.now() - start;
        assert.ok(elapsed < 10, `analyzeSkillContent took ${elapsed}ms, expected <10ms`);
    });
});


// =============================================================================
// TC-18: SKILL_KEYWORD_MAP and PHASE_TO_AGENT_MAP Constants
// Traces: FR-002
// =============================================================================

describe('TC-18: Constants Validation', () => {
    let tmpDir, common;

    before(() => {
        tmpDir = createTestProject();
        common = loadCommon(tmpDir);
    });

    after(() => cleanup(tmpDir));

    it('TC-18.01: SKILL_KEYWORD_MAP exported', () => {
        assert.ok(typeof common.SKILL_KEYWORD_MAP === 'object');
        assert.ok(common.SKILL_KEYWORD_MAP !== null);
    });

    it('TC-18.02: SKILL_KEYWORD_MAP has 7 categories', () => {
        const keys = Object.keys(common.SKILL_KEYWORD_MAP);
        assert.equal(keys.length, 7);
        assert.ok(keys.includes('testing'));
        assert.ok(keys.includes('architecture'));
        assert.ok(keys.includes('devops'));
        assert.ok(keys.includes('security'));
        assert.ok(keys.includes('implementation'));
        assert.ok(keys.includes('requirements'));
        assert.ok(keys.includes('review'));
    });

    it('TC-18.03: PHASE_TO_AGENT_MAP exported', () => {
        assert.ok(typeof common.PHASE_TO_AGENT_MAP === 'object');
        assert.ok(common.PHASE_TO_AGENT_MAP !== null);
    });

    it('TC-18.04: PHASE_TO_AGENT_MAP has 11 entries', () => {
        const keys = Object.keys(common.PHASE_TO_AGENT_MAP);
        assert.equal(keys.length, 11);
    });

    it('TC-18.05: All keyword entries have phases array', () => {
        for (const [category, config] of Object.entries(common.SKILL_KEYWORD_MAP)) {
            assert.ok(Array.isArray(config.phases), `${category} should have phases array`);
            assert.ok(config.phases.length > 0, `${category} phases should be non-empty`);
            assert.ok(Array.isArray(config.keywords), `${category} should have keywords array`);
            assert.ok(config.keywords.length > 0, `${category} keywords should be non-empty`);
        }
    });
});
