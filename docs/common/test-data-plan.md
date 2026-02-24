# Test Data Plan: Custom Skill Management (REQ-0022)

**Phase**: 05-test-strategy
**Created**: 2026-02-18
**Feature**: Custom skill management -- add, wire, and inject user-provided skills into workflows (GH-14)

---

## Overview

This feature adds 6 new utility functions to `common.cjs` that validate files, analyze content, format injection blocks, and manage manifest I/O. Test data requires:

1. **Skill file fixtures**: `.md` files with valid/invalid YAML frontmatter
2. **Manifest fixtures**: JSON objects representing `external-skills-manifest.json`
3. **Content fixtures**: Strings with keyword patterns for content analysis
4. **Filesystem fixtures**: Temporary directory structures mimicking iSDLC projects

All fixtures are generated programmatically via factory functions within the test file (no external fixture files needed). This follows the pattern established in `skill-injection.test.cjs`.

---

## Boundary Values

### Skill Name Boundaries

| Boundary | Value | Expected Result | Test Case |
|----------|-------|----------------|-----------|
| Minimum valid length | `"a1"` (2 chars) | Valid | TC-01.05 |
| Maximum valid length | `"a" + "b".repeat(98) + "c"` (100 chars) | Valid | TC-08.07 |
| Below minimum (1 char) | `"a"` | Invalid -- SKL-E006 | TC-02.15 |
| At regex boundary (hyphens) | `"a-b"` (hyphen between alphanums) | Valid | TC-01.04 |
| Leading hyphen | `"-bad"` | Invalid -- SKL-E006 | TC-02.13 |
| Trailing hyphen | `"bad-"` | Invalid -- SKL-E006 | TC-02.14 |

### Skill Content Length Boundaries

| Boundary | Value | Expected Result | Test Case |
|----------|-------|----------------|-----------|
| Below truncation threshold | 9,999 chars | Content passed as-is | TC-08.08 |
| At truncation threshold | 10,000 chars | Content passed as-is (boundary) | TC-12.01 |
| Above truncation threshold | 10,001 chars | Content truncated, delivery switched to reference | TC-11.04 |
| Empty content | 0 chars | Handled gracefully | TC-08.05 |

### Description Length Boundaries

| Boundary | Value | Expected Result | Test Case |
|----------|-------|----------------|-----------|
| Minimum valid length | 1 char | Valid | TC-01.01 |
| Maximum length (500 chars) | 500-char description | Valid | TC-06.07 |
| Empty (whitespace only) | `"   "` | Invalid -- SKL-E005 | TC-02.17 |

### Manifest Size Boundaries

| Boundary | Value | Expected Result | Test Case |
|----------|-------|----------------|-----------|
| Empty skills array | `skills: []` | Valid, no injection | TC-14.02 |
| Single skill | `skills: [{ ... }]` | Valid | TC-06.07 |
| Maximum skills (50) | `skills` with 50 entries | Valid, under 500ms | TC-06.08, TC-17.02 |

---

## Invalid Inputs

### File Validation Invalid Inputs

| Input | Type | Expected Error | Test Case |
|-------|------|---------------|-----------|
| Non-existent file path | File not found | SKL-E001 | TC-02.01 |
| `.txt` file | Wrong extension | SKL-E002 | TC-02.02 |
| `.json` file | Wrong extension | SKL-E002 | TC-02.03 |
| File with no extension | No extension | SKL-E002 | TC-02.04 |
| File without `---` frontmatter | No frontmatter | SKL-E003 | TC-02.05 |
| Zero-byte `.md` file | Empty file | SKL-E003 | TC-02.06 |
| Frontmatter missing `name` | Missing required field | SKL-E004 | TC-02.07 |
| Frontmatter missing `description` | Missing required field | SKL-E005 | TC-02.08 |
| Both fields missing | Multiple errors | SKL-E004 + SKL-E005 | TC-02.09 |
| Uppercase name | Invalid format | SKL-E006 | TC-02.10 |
| Underscore name | Invalid format | SKL-E006 | TC-02.11 |
| Space in name | Invalid format | SKL-E006 | TC-02.12 |

### Content Analysis Invalid Inputs

| Input | Type | Expected Behavior | Test Case |
|-------|------|-------------------|-----------|
| `null` | Null input | Returns default fallback | TC-04.01 |
| `undefined` | Undefined input | Returns default fallback | TC-04.02 |
| `""` | Empty string | Returns default fallback | TC-04.03 |
| `42` | Non-string type | Returns default fallback (no crash) | TC-04.04 |

### Path Security Invalid Inputs

| Input | Type | Expected Behavior | Test Case |
|-------|------|-------------------|-----------|
| `"../../etc/passwd"` | Path traversal (forward slash + `..`) | Rejected | TC-16.01 |
| `"..\\windows\\system"` | Path traversal (backslash + `..`) | Rejected | TC-16.02 |
| `"../parent.md"` | Parent directory traversal | Rejected | TC-16.03 |

### Manifest Invalid Inputs

| Input | Type | Expected Behavior | Test Case |
|-------|------|-------------------|-----------|
| `null` manifest | Null object | `removeSkillFromManifest` returns safe default | TC-09.03 |
| Missing `skills` array | Incomplete manifest | Handled gracefully | TC-09.04 |
| Corrupt JSON on disk | Parse failure | `loadExternalManifest` returns null | TC-10.05 |

---

## Maximum-Size Inputs

### Large Skill File (10,001+ chars)

```javascript
function createLargeSkillContent(charCount) {
    const header = [
        '---',
        'name: large-skill',
        'description: A skill that exceeds the truncation threshold',
        '---',
        '',
        '# Large Skill Content',
        ''
    ].join('\n');
    const bodyNeeded = charCount - header.length;
    const body = 'x'.repeat(Math.max(0, bodyNeeded));
    return header + body;
}
```

Used in: TC-11.04 (pipeline with large content), TC-12.01 (injection with truncation)

### Large Manifest (50 skills)

```javascript
function createLargeManifest(skillCount) {
    const skills = [];
    for (let i = 1; i <= skillCount; i++) {
        skills.push({
            name: `skill-${String(i).padStart(3, '0')}`,
            description: `Auto-generated test skill number ${i}`,
            file: `skill-${String(i).padStart(3, '0')}.md`,
            added_at: new Date().toISOString(),
            bindings: {
                agents: ['software-developer'],
                phases: ['06-implementation'],
                injection_mode: 'always',
                delivery_type: 'context'
            }
        });
    }
    return { version: '1.0.0', skills };
}
```

Used in: TC-06.08 (50-skill manifest write), TC-17.02 (performance: 50-skill parse)

### Maximum-Length Skill Name (100 chars)

```javascript
const MAX_NAME = 'a' + 'b'.repeat(98) + 'c';  // 100 chars, matches regex pattern
```

Used in: TC-08.07 (long skill name in injection block)

---

## Valid Skill File Fixtures

### Minimal Valid Skill

```javascript
function createMinimalSkill(dir, name, description) {
    const content = [
        '---',
        `name: ${name}`,
        `description: ${description}`,
        '---',
        '',
        `# ${name}`,
        '',
        'Skill body content here.',
        ''
    ].join('\n');
    const filePath = path.join(dir, `${name}.md`);
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
}
```

### Full-Featured Skill (all optional fields)

```javascript
function createFullSkill(dir) {
    const content = [
        '---',
        'name: nestjs-conventions',
        'description: NestJS framework conventions and patterns',
        'owner: software-developer',
        'skill_id: EXT-001',
        'when_to_use: You must follow these NestJS conventions',
        'dependencies: typescript-basics',
        '---',
        '',
        '# NestJS Conventions',
        '',
        '## Controller Patterns',
        'Always use @Controller decorator...',
        '',
        '## Service Patterns',
        'Services should be injectable...',
        ''
    ].join('\n');
    const filePath = path.join(dir, 'nestjs-conventions.md');
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
}
```

---

## Keyword Content Fixtures

Fixtures for testing `analyzeSkillContent()` keyword detection accuracy.

```javascript
const KEYWORD_FIXTURES = {
    testing: {
        content: 'This skill covers unit testing with Jest. It includes mock setup, stub patterns, and coverage thresholds for assertion-based validation.',
        expectedKeywords: ['test', 'testing', 'mock', 'stub', 'coverage', 'assertion', 'jest'],
        expectedPhases: ['05-test-strategy', '06-implementation'],
        expectedConfidence: 'high'
    },
    architecture: {
        content: 'Design patterns for microservice architecture. Component-based module system design.',
        expectedKeywords: ['architecture', 'design pattern', 'microservice', 'module', 'component'],
        expectedPhases: ['03-architecture', '04-design'],
        expectedConfidence: 'high'
    },
    devops: {
        content: 'Docker containerization and Kubernetes deployment. CI/CD pipeline configuration.',
        expectedKeywords: ['docker', 'kubernetes', 'deploy', 'ci/cd', 'pipeline'],
        expectedPhases: ['10-cicd', '11-local-testing'],
        expectedConfidence: 'high'
    },
    security: {
        content: 'OWASP security guidelines. Authentication and encryption best practices.',
        expectedKeywords: ['security', 'owasp', 'authentication', 'encryption'],
        expectedPhases: ['09-validation'],
        expectedConfidence: 'high'
    },
    implementation: {
        content: 'Implement the controller and service classes for the REST API endpoints.',
        expectedKeywords: ['implement', 'controller', 'service', 'api', 'endpoint'],
        expectedPhases: ['06-implementation'],
        expectedConfidence: 'high'
    },
    requirements: {
        content: 'Writing user story specifications with acceptance criteria.',
        expectedKeywords: ['user story', 'specification', 'acceptance criteria'],
        expectedPhases: ['01-requirements'],
        expectedConfidence: 'high'
    },
    review: {
        content: 'Code review guidelines with lint rules and static analysis.',
        expectedKeywords: ['code review', 'lint', 'static analysis', 'review', 'quality'],
        expectedPhases: ['08-code-review'],
        expectedConfidence: 'high'
    },
    mixed: {
        content: 'Testing the API endpoint implementation with mock assertions.',
        expectedKeywords: ['test', 'api', 'endpoint', 'implement', 'mock', 'assertion'],
        expectedPhases: ['05-test-strategy', '06-implementation'],
        expectedConfidence: 'high'
    },
    noMatch: {
        content: 'Random content about cooking recipes and gardening tips.',
        expectedKeywords: [],
        expectedPhases: ['06-implementation'],
        expectedConfidence: 'low'
    }
};
```

---

## Manifest Fixtures

### Empty Manifest

```javascript
const EMPTY_MANIFEST = { version: '1.0.0', skills: [] };
```

### Single-Skill Manifest

```javascript
const SINGLE_SKILL_MANIFEST = {
    version: '1.0.0',
    skills: [{
        name: 'nestjs-conventions',
        description: 'NestJS framework conventions',
        file: 'nestjs-conventions.md',
        added_at: '2026-02-18T12:00:00Z',
        bindings: {
            agents: ['software-developer'],
            phases: ['06-implementation'],
            injection_mode: 'always',
            delivery_type: 'context'
        }
    }]
};
```

### Multi-Skill Manifest (3 skills, different delivery types)

```javascript
const MULTI_SKILL_MANIFEST = {
    version: '1.0.0',
    skills: [
        {
            name: 'nestjs-conventions',
            description: 'NestJS patterns',
            file: 'nestjs-conventions.md',
            added_at: '2026-02-18T12:00:00Z',
            bindings: { agents: ['software-developer'], phases: ['06-implementation'], injection_mode: 'always', delivery_type: 'context' }
        },
        {
            name: 'company-standards',
            description: 'Company coding standards',
            file: 'company-standards.md',
            added_at: '2026-02-18T12:01:00Z',
            bindings: { agents: ['qa-engineer'], phases: ['08-code-review'], injection_mode: 'always', delivery_type: 'instruction' }
        },
        {
            name: 'aws-deployment',
            description: 'AWS deployment guide',
            file: 'aws-deployment.md',
            added_at: '2026-02-18T12:02:00Z',
            bindings: { agents: ['cicd-engineer'], phases: ['10-cicd'], injection_mode: 'always', delivery_type: 'reference' }
        }
    ]
};
```

### Legacy Manifest (skill without bindings -- backward compatibility)

```javascript
const LEGACY_MANIFEST = {
    version: '1.0.0',
    skills: [{
        name: 'old-skill',
        description: 'Legacy skill without bindings',
        file: 'old-skill.md',
        added_at: '2026-01-01T00:00:00Z'
        // Note: no bindings object (backward compat per NFR-005)
    }]
};
```

### Corrupt Manifest (invalid JSON)

```javascript
const CORRUPT_MANIFEST_CONTENT = '{ "version": "1.0.0", "skills": [BROKEN';
```

---

## Project Structure Fixture

### createTestProject() Factory

Sets up a complete temporary directory mimicking an iSDLC project installation.

```javascript
function createTestProject(opts = {}) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdlc-ext-skill-test-'));

    // Create required directory structure
    fs.mkdirSync(path.join(tmpDir, '.isdlc'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.claude', 'hooks', 'config'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.claude', 'skills', 'external'), { recursive: true });

    // Write minimal state.json
    fs.writeFileSync(path.join(tmpDir, '.isdlc', 'state.json'), JSON.stringify({
        framework_version: '0.1.0-alpha',
        skill_enforcement: { enabled: true, mode: 'observe' }
    }));

    // Copy real skills-manifest.json for path resolution
    const realConfigDir = path.resolve(__dirname, '..', 'config');
    for (const f of ['skills-manifest.json', 'iteration-requirements.json']) {
        const src = path.join(realConfigDir, f);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, path.join(tmpDir, '.claude', 'hooks', 'config', f));
        }
    }

    // Optional: write external skills manifest
    if (opts.manifest) {
        const manifestDir = path.join(tmpDir, 'docs', 'isdlc');
        fs.mkdirSync(manifestDir, { recursive: true });
        fs.writeFileSync(
            path.join(manifestDir, 'external-skills-manifest.json'),
            JSON.stringify(opts.manifest, null, 2)
        );
    }

    // Optional: create skill files in external directory
    if (opts.skillFiles) {
        for (const [name, content] of Object.entries(opts.skillFiles)) {
            fs.writeFileSync(
                path.join(tmpDir, '.claude', 'skills', 'external', `${name}.md`),
                content
            );
        }
    }

    return tmpDir;
}
```

---

## Data Lifecycle

1. **Setup**: `createTestProject()` called in `before()` or `beforeEach()` to create isolated temp directory
2. **Execution**: Tests call utility functions with fixture data; assertions validate returns
3. **Teardown**: `fs.rmSync(tmpDir, { recursive: true, force: true })` in `after()` or `afterEach()`

No persistent test data. No shared mutable state between test groups. Each `describe()` block is fully isolated.
