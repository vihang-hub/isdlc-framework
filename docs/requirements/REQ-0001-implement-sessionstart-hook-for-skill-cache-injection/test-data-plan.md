# Test Data Plan: Unified SessionStart Cache (REQ-0001)

**Phase**: 05-test-strategy
**Created**: 2026-02-23

---

## 1. Test Fixture Strategy

All test data is generated programmatically in `beforeEach` / `before` hooks using `setupTestEnv()` from `hook-test-utils.cjs`. No external test data files are committed to the repository. Each test creates its own isolated temp directory.

### 1.1 Fixture Setup Pattern

```javascript
// Standard fixture setup (CJS)
const testDir = setupTestEnv();
const isdlcDir = path.join(testDir, '.isdlc');
const srcDir = path.join(testDir, 'src', 'claude');

// Create source file structure
fs.mkdirSync(path.join(testDir, 'docs', 'isdlc'), { recursive: true });
fs.writeFileSync(
    path.join(testDir, 'docs', 'isdlc', 'constitution.md'),
    FIXTURE_CONSTITUTION
);
```

---

## 2. Boundary Values

### 2.1 Cache Size Boundaries

| Test Value | Size (chars) | Purpose | Test Case |
|-----------|-------------|---------|-----------|
| Empty cache | 0 | Minimum possible output | TC-BUILD-10 |
| Header only | ~80 | Minimum valid cache | TC-BUILD-10 |
| Just under budget | 127,999 | Budget boundary (valid) | TC-BUILD-13 |
| At budget | 128,000 | Budget boundary (valid) | TC-BUILD-13 |
| Over budget | 128,001 | Budget warning trigger | TC-BUILD-13 |
| Large cache | 200,000 | Well over budget | TC-BUILD-13 |

**Fixture generation for size boundaries**:

```javascript
// Generate constitution of exact size to hit budget boundary
const TARGET_SIZE = 128001; // over budget
const headerSize = 80; // approximate header
const sectionOverhead = 200; // delimiters
const constitutionSize = TARGET_SIZE - headerSize - sectionOverhead;
const OVERSIZED_CONSTITUTION = 'x'.repeat(constitutionSize);
```

### 2.2 Source Hash Boundaries

| Scenario | Fixture Setup | Purpose | Test Case |
|----------|--------------|---------|-----------|
| Zero source files | Empty directory | Hash of empty input | TC-MTIME-08 |
| Single source file | Just constitution.md | Minimum hash input | TC-MTIME-01 |
| All source files | Full fixture set | Maximum hash input | TC-MTIME-01 |
| Identical mtimes | `fs.utimesSync` all to same time | Determinism check | TC-MTIME-03 |
| Changed single mtime | Touch one file after hash | Change detection | TC-MTIME-04 |

### 2.3 Skill Count Boundaries

| Count | Fixture Setup | Purpose | Test Case |
|-------|--------------|---------|-----------|
| 0 skills | Empty skills directory | No skills indexed | TC-INDEX-03 |
| 1 skill | Single SKILL.md | Minimum skill index | TC-INDEX-01 |
| 2 skills (different agents) | Two SKILL.md files | Multi-agent index | TC-INDEX-02 |
| Duplicate ID | Same skill_id in src/ and .claude/ | Precedence check | TC-INDEX-05 |

### 2.4 Section Count Boundaries

| Count | Fixture Setup | Purpose | Test Case |
|-------|--------------|---------|-----------|
| 0 sections | No source files at all | All sections skipped | TC-BUILD-10 |
| 1 section | Only constitution.md | Partial cache | TC-BUILD-04 |
| 8 sections | All source files | Full cache | TC-BUILD-01 |

---

## 3. Invalid Inputs

### 3.1 File Content Errors

| Invalid Input | Fixture | Expected Behavior | Test Case |
|--------------|---------|-------------------|-----------|
| Corrupt JSON (skills-manifest.json) | `'{not json'` | SKILLS_MANIFEST + SKILL_INDEX skipped | TC-BUILD-08 (implied) |
| Binary content in constitution.md | Buffer with 0xFF bytes | Section included (treated as text) | TC-BUILD-06 (variant) |
| Empty skills-manifest.json | `'{}'` | SKILLS_MANIFEST present but empty, SKILL_INDEX skipped | TC-BUILD-08 (variant) |
| Corrupt JSON (external manifest) | `'[invalid'` | EXTERNAL_SKILLS skipped | TC-BUILD-15 (variant) |
| SKILL.md with no frontmatter | `'# Just a heading\nNo skill_id here'` | File skipped in index | TC-INDEX-04 |
| SKILL.md with empty skill_id | `'skill_id: \n'` | File skipped in index | TC-INDEX-04 (variant) |

**Fixture generation**:

```javascript
// Corrupt JSON fixture
const CORRUPT_JSON = '{"version": "5.0.0", "ownership": {broken';

// SKILL.md without frontmatter
const NO_FRONTMATTER_SKILL = '# Skill Name\nThis skill does something.\n';

// SKILL.md with empty skill_id
const EMPTY_ID_SKILL = '---\nskill_id: \nname: empty-id\n---\n';
```

### 3.2 Filesystem Errors

| Error Condition | Fixture Setup | Expected Behavior | Test Case |
|----------------|--------------|-------------------|-----------|
| File permission denied | `fs.chmodSync(file, 0o000)` | Section skipped / hook exits 0 | TC-HOOK-03, TC-BUILD-04 |
| Directory not readable | `fs.chmodSync(dir, 0o000)` | Index returns empty Map | TC-INDEX-03 (variant) |
| Missing .isdlc/ directory | No `.isdlc/` created | `rebuildSessionCache()` throws | TC-BUILD-05 |
| Missing cache file | No `session-cache.md` | Hook exits 0, no output | TC-HOOK-02 |
| Symlink to non-existent file | `fs.symlinkSync('/nonexistent', cachePath)` | Hook exits 0 (ENOENT on read) | TC-HOOK-02 (variant) |

**Note**: Permission-based tests (`chmod 000`) may not work on all CI environments (e.g., root user on CI). These tests should use `try/catch` with a skip mechanism when running as root.

### 3.3 Environment Errors

| Error Condition | Fixture Setup | Expected Behavior | Test Case |
|----------------|--------------|-------------------|-----------|
| `CLAUDE_PROJECT_DIR` unset | `delete process.env.CLAUDE_PROJECT_DIR` | Hook falls back to cwd | TC-HOOK-05 |
| `CLAUDE_PROJECT_DIR` points to non-existent dir | `process.env.CLAUDE_PROJECT_DIR = '/nonexistent'` | Hook exits 0 | TC-HOOK-02 (variant) |
| `projectRoot` option invalid | `{ projectRoot: '/nonexistent' }` | Throws (no .isdlc/) | TC-BUILD-05 (variant) |

---

## 4. Maximum-Size Inputs

### 4.1 Large Cache File

For performance testing (TC-HOOK-06), generate a cache file at the maximum expected size.

```javascript
// Generate 128K character cache file
const HEADER = '<!-- SESSION CACHE: Generated 2026-02-23T00:00:00Z | Sources: 100 | Hash: deadbeef -->\n\n';
const SECTION_START = '<!-- SECTION: CONSTITUTION -->\n';
const SECTION_END = '\n<!-- /SECTION: CONSTITUTION -->\n';
const FILL_SIZE = 128000 - HEADER.length - SECTION_START.length - SECTION_END.length;
const LARGE_CONTENT = HEADER + SECTION_START + 'x'.repeat(FILL_SIZE) + SECTION_END;

fs.writeFileSync(cachePath, LARGE_CONTENT, 'utf8');
```

### 4.2 Many Skills (Scale Test)

For skill path index performance, create a fixture with many SKILL.md files.

```javascript
// Generate 50 mock skills (approximate real project scale)
for (let i = 1; i <= 50; i++) {
    const id = `TST-${String(i).padStart(3, '0')}`;
    const dir = path.join(testDir, 'src', 'claude', 'skills', `category-${i}`, `skill-${i}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'SKILL.md'),
        `---\nskill_id: ${id}\nname: test-skill-${i}\ndescription: Test skill number ${i}\n---\n# Skill ${i}\nContent here.\n`
    );
}
```

### 4.3 Large Individual Files

| File | Size Target | Purpose |
|------|------------|---------|
| constitution.md | 50K chars | Large section content |
| workflows.json | 20K chars | Large JSON section |
| persona file | 15K chars | Large persona content |
| SKILL.md | 10K chars | Large individual skill (should not be in cache -- only index) |

---

## 5. Fixture Registry

Standard fixture constants to be defined once and reused across test files.

### 5.1 Minimal Valid Fixtures

```javascript
const FIXTURES = {
    constitution: '# Constitution\n## Article I\nTest article content.\n',
    workflows: '{"feature":{"phases":["01-requirements","02-impact","03-architecture"]},"fix":{"phases":["01-requirements"]}}',
    iterationRequirements: '{"version":"2.0.0","defaults":{"max_iterations":5}}',
    artifactPaths: '{"feature":{"01-requirements":"docs/requirements/{folder}/requirements-spec.md"}}',
    skillsManifest: JSON.stringify({
        version: '5.0.0',
        ownership: {
            'test-agent': {
                phase: '06-implementation',
                skills: ['TST-001', 'TST-002']
            }
        },
        skill_lookup: {
            'TST-001': 'test-agent',
            'TST-002': 'test-agent'
        }
    }, null, 2),
    externalManifest: '{"version":"1.0.0","skills":[{"name":"ext-skill","file":"ext-skill.md","source":"user","bindings":{"phases":["all"],"agents":["all"],"injection_mode":"manual","delivery_type":"reference"}}]}',
    skillMd: (id, name, desc) =>
        `---\nskill_id: ${id}\nname: ${name}\ndescription: ${desc}\n---\n# ${name}\n${desc}\n`,
    personaMd: (name) =>
        `# Persona: ${name}\nThis is the ${name} persona.\nKey responsibilities and focus areas.\n`,
    topicMd: (id) =>
        `# Topic: ${id}\nAnalysis guidance for ${id}.\n`
};
```

### 5.2 Setup Helper Function

```javascript
/**
 * Create a fully populated test project fixture.
 * @param {string} testDir - Root of the test directory
 * @param {object} [overrides] - Override individual fixtures
 */
function createFullFixture(testDir, overrides = {}) {
    // Constitution
    const docsDir = path.join(testDir, 'docs', 'isdlc');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'constitution.md'), overrides.constitution || FIXTURES.constitution);

    // Workflows
    const configDir = path.join(testDir, 'src', 'isdlc', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'workflows.json'), overrides.workflows || FIXTURES.workflows);

    // Iteration requirements + artifact paths
    const hookConfigDir = path.join(testDir, '.claude', 'hooks', 'config');
    fs.mkdirSync(hookConfigDir, { recursive: true });
    fs.writeFileSync(path.join(hookConfigDir, 'iteration-requirements.json'), overrides.iterationRequirements || FIXTURES.iterationRequirements);
    fs.writeFileSync(path.join(hookConfigDir, 'artifact-paths.json'), overrides.artifactPaths || FIXTURES.artifactPaths);

    // Skills manifest
    const manifestDir = path.join(testDir, 'src', 'claude', 'hooks', 'config');
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(path.join(manifestDir, 'skills-manifest.json'), overrides.skillsManifest || FIXTURES.skillsManifest);

    // SKILL.md files
    const skillsDir = path.join(testDir, 'src', 'claude', 'skills');
    fs.mkdirSync(path.join(skillsDir, 'testing', 'test-skill-1'), { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'testing', 'test-skill-1', 'SKILL.md'), FIXTURES.skillMd('TST-001', 'test-skill-1', 'First test skill'));
    fs.mkdirSync(path.join(skillsDir, 'testing', 'test-skill-2'), { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'testing', 'test-skill-2', 'SKILL.md'), FIXTURES.skillMd('TST-002', 'test-skill-2', 'Second test skill'));

    // External manifest
    const extManifestDir = path.join(testDir, 'docs', 'isdlc');
    fs.writeFileSync(path.join(extManifestDir, 'external-skills-manifest.json'), overrides.externalManifest || FIXTURES.externalManifest);

    // Personas
    const agentsDir = path.join(testDir, 'src', 'claude', 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(path.join(agentsDir, 'persona-business-analyst.md'), FIXTURES.personaMd('Business Analyst'));
    fs.writeFileSync(path.join(agentsDir, 'persona-solutions-architect.md'), FIXTURES.personaMd('Solutions Architect'));
    fs.writeFileSync(path.join(agentsDir, 'persona-system-designer.md'), FIXTURES.personaMd('System Designer'));

    // Topics
    const topicsDir = path.join(testDir, 'src', 'claude', 'skills', 'analysis-topics', 'architecture');
    fs.mkdirSync(topicsDir, { recursive: true });
    fs.writeFileSync(path.join(topicsDir, 'architecture.md'), FIXTURES.topicMd('architecture'));
}
```

---

## 6. Test Data Cleanup

All test data is cleaned up automatically via `cleanupTestEnv()` in `after()` hooks.

```javascript
after(() => {
    cleanupTestEnv();
});
```

Additional cleanup for permission-denied tests:

```javascript
after(() => {
    // Restore permissions before cleanup (rmSync needs write permission)
    if (protectedFile && fs.existsSync(protectedFile)) {
        fs.chmodSync(protectedFile, 0o644);
    }
    cleanupTestEnv();
});
```

---

## 7. Test Data Dependencies

| Data Dependency | Source | Fallback |
|----------------|--------|----------|
| skills-manifest.json schema | Copied from `src/claude/hooks/config/` by `setupTestEnv()` | Use minimal fixture |
| iteration-requirements.json | Copied from `src/claude/hooks/config/` by `setupTestEnv()` | Use minimal fixture |
| common.cjs | Copied to test lib/ by `prepareHook()` or `installCommonCjs()` | Required -- tests fail without it |
| inject-session-cache.cjs | Copied to test dir by `prepareHook()` | Required for hook tests |

---

## 8. Parameterized Test Data

For section extraction tests, use parameterized test data to verify all 8 sections:

```javascript
const SECTION_NAMES = [
    'CONSTITUTION',
    'WORKFLOW_CONFIG',
    'ITERATION_REQUIREMENTS',
    'ARTIFACT_PATHS',
    'SKILLS_MANIFEST',
    'SKILL_INDEX',
    'EXTERNAL_SKILLS',
    'ROUNDTABLE_CONTEXT'
];

for (const section of SECTION_NAMES) {
    it(`extracts ${section} section from cache`, () => {
        const extracted = extractSection(cacheContent, section);
        assert.ok(extracted !== null, `${section} should be extractable`);
        assert.ok(extracted.length > 0, `${section} should have content`);
    });
}
```
