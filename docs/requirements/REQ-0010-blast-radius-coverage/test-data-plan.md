# Test Data Plan: REQ-0010 Blast Radius Coverage Validation

**Version**: 1.0.0
**Date**: 2026-02-12
**Phase**: 05-test-strategy
**Traces to**: All test cases in test-cases.md

---

## 1. Overview

Test data for the blast-radius-validator hook is organized into four categories:

1. **Markdown content** -- impact-analysis.md and blast-radius-coverage.md fixtures
2. **State objects** -- state.json configurations for various workflow scenarios
3. **Git state** -- Temporary git repositories with controlled branch/diff state
4. **Context objects** -- `ctx` parameter structures for direct `check()` calls

All test data is generated inline within the test file as JavaScript constants. No external fixture files are needed (following the established pattern in existing hook tests).

---

## 2. Markdown Content Fixtures

### 2.1 impact-analysis.md Fixtures

| Fixture ID | Description | Rows | Change Types | Used By |
|-----------|-------------|------|-------------|---------|
| `IA_SINGLE_TABLE` | One table with 3 valid rows | 3 | CREATE, MODIFY, DELETE | TC-PIA-01, TC-PIA-03 |
| `IA_MULTI_TABLE` | Two FR sections, 1 duplicate file | 4 (3 unique) | CREATE, MODIFY | TC-PIA-02 |
| `IA_WITH_NO_CHANGE` | Table with 4 rows including 1 NO CHANGE | 4 (3 actionable) | MODIFY, CREATE, NO CHANGE | TC-PIA-04, TC-INT-10 |
| `IA_ALL_NO_CHANGE` | Table where all rows are NO CHANGE | 3 | NO CHANGE | TC-PIA-12, EC-01 |
| `IA_MALFORMED_ROWS` | Rows without backticks around paths | 3 | MODIFY | TC-PIA-05, EC-02 |
| `IA_EXTRA_WHITESPACE` | Valid rows with extra whitespace | 2 | MODIFY | TC-PIA-06 |
| `IA_FULL_TABLE` | Includes header, separator, and data rows | 3 | CREATE, MODIFY | TC-PIA-07 |
| `IA_PROSE_ONLY` | Markdown content with no tables at all | 0 | -- | TC-INT-06, TC-ERR-07 |
| `IA_LARGE` | 100 rows for performance testing | 100 | MODIFY | TC-NFR-01 |
| `IA_PATH_TRAVERSAL` | Row with `../../etc/passwd` path | 1 | MODIFY | TC-SEC-01 |
| `IA_FIVE_FILES` | Five distinct affected files | 5 | CREATE, MODIFY | TC-INT-09, TC-ERR-10 |

### 2.2 impact-analysis.md Sample Content

```javascript
const IA_SINGLE_TABLE = [
    '## Affected Files',
    '',
    '| File | Change Type | Risk | Rationale |',
    '|------|------------|------|-----------|',
    '| `src/hooks/blast-radius-validator.cjs` | CREATE | High | New hook |',
    '| `src/hooks/dispatchers/pre-task-dispatcher.cjs` | MODIFY | Med | Add entry |',
    '| `src/agents/05-software-developer.md` | DELETE | Low | Remove section |'
].join('\n');

const IA_MULTI_TABLE = [
    '## FR-01: Hook Implementation',
    '',
    '| File | Change Type | Risk |',
    '|------|------------|------|',
    '| `src/hooks/blast-radius-validator.cjs` | CREATE | High |',
    '| `src/hooks/lib/common.cjs` | NO CHANGE | None |',
    '',
    '## FR-02: Dispatcher Integration',
    '',
    '| File | Change Type | Risk |',
    '|------|------------|------|',
    '| `src/hooks/dispatchers/pre-task-dispatcher.cjs` | MODIFY | Med |',
    '| `src/hooks/blast-radius-validator.cjs` | CREATE | High |'
].join('\n');

const IA_ALL_NO_CHANGE = [
    '| File | Change Type |',
    '|------|------------|',
    '| `src/hooks/lib/common.cjs` | NO CHANGE |',
    '| `src/hooks/lib/provider-utils.cjs` | NO CHANGE |',
    '| `src/hooks/config/skills-manifest.json` | NO CHANGE |'
].join('\n');

const IA_MALFORMED_ROWS = [
    '| File | Change Type |',
    '|------|------------|',
    '| src/hooks/no-backticks.cjs | MODIFY |',
    '| plain text path | MODIFY |',
    '| another/path | DELETE |'
].join('\n');

const IA_PROSE_ONLY = [
    '# Impact Analysis',
    '',
    'This feature affects several files in the hooks directory.',
    'The dispatcher will need modification.',
    '',
    'No structured table format used.'
].join('\n');
```

### 2.3 blast-radius-coverage.md Fixtures

| Fixture ID | Description | Rows | Statuses | Used By |
|-----------|-------------|------|---------|---------|
| `BRC_ALL_COVERED` | All entries are covered | 3 | covered | TC-PBC-08, TC-ERR-09 |
| `BRC_WITH_DEFERRAL` | Mix of covered and deferred (with rationale) | 3 | covered, deferred | TC-PBC-01, TC-INT-03 |
| `BRC_DEFERRED_NO_NOTES` | Deferred entry with empty notes column | 2 | covered, deferred (empty notes) | TC-PBC-02, TC-INT-04 |
| `BRC_MULTI_DEFERRED` | Multiple valid deferrals | 3 | deferred | TC-PBC-07 |
| `BRC_CASE_VARIATIONS` | Mixed case status values | 3 | Deferred, DEFERRED, deferred | TC-PBC-03 |

### 2.4 blast-radius-coverage.md Sample Content

```javascript
const BRC_WITH_DEFERRAL = [
    '# Blast Radius Coverage',
    '',
    '| File Path | Expected Change | Coverage Status | Notes |',
    '|-----------|----------------|-----------------|-------|',
    '| `src/hooks/validator.cjs` | CREATE | covered | New file created |',
    '| `src/hooks/dispatcher.cjs` | MODIFY | covered | Modified: added entry |',
    '| `src/agents/dev.md` | MODIFY | deferred | Deferred to REQ-0011: not needed for MVP |'
].join('\n');

const BRC_DEFERRED_NO_NOTES = [
    '| File Path | Expected Change | Coverage Status | Notes |',
    '|-----------|----------------|-----------------|-------|',
    '| `src/hooks/validator.cjs` | CREATE | covered | New file |',
    '| `src/agents/dev.md` | MODIFY | deferred |  |'
].join('\n');
```

---

## 3. State Object Fixtures

### 3.1 State Configurations

| Fixture ID | Workflow Type | Phase | Has Artifact Folder | Used By |
|-----------|-------------|-------|--------------------|---------|
| `STATE_FEATURE_P06` | feature | 06-implementation | Yes | TC-INT-*, TC-DISP-01 |
| `STATE_FIX_P06` | fix | 06-implementation | Yes | TC-DISP-02 |
| `STATE_FEATURE_P05` | feature | 05-test-strategy | Yes | TC-DISP-03 |
| `STATE_NO_WORKFLOW` | -- | 06-implementation | -- | TC-CG-03, TC-DISP-04 |
| `STATE_NO_FOLDER` | feature | 06-implementation | No | TC-CG-04 |
| `STATE_EMPTY_WORKFLOW` | feature | 06-implementation | Empty object | TC-CG-08 |

### 3.2 State Object Samples

```javascript
const STATE_FEATURE_P06 = {
    current_phase: '06-implementation',
    active_workflow: {
        type: 'feature',
        id: 'REQ-0010',
        current_phase: '06-implementation',
        artifact_folder: 'REQ-0010-blast-radius-coverage',
        phases: ['01-requirements', '06-implementation'],
        current_phase_index: 1,
        phase_status: {
            '01-requirements': 'completed',
            '06-implementation': 'in_progress'
        }
    },
    phases: {
        '06-implementation': {
            status: 'in_progress'
        }
    }
};

const STATE_FIX_P06 = {
    current_phase: '06-implementation',
    active_workflow: {
        type: 'fix',
        id: 'BUG-0008',
        current_phase: '06-implementation',
        artifact_folder: 'BUG-0008-some-fix'
    }
};

const STATE_NO_WORKFLOW = {
    current_phase: '06-implementation'
    // no active_workflow
};

const STATE_NO_FOLDER = {
    current_phase: '06-implementation',
    active_workflow: {
        type: 'feature',
        id: 'REQ-0010',
        current_phase: '06-implementation'
        // no artifact_folder
    }
};
```

---

## 4. Git State Fixtures

### 4.1 Temporary Git Repository Setup

For integration tests that exercise the full `check()` flow including `getModifiedFiles()`, we create temporary git repositories:

```javascript
function setupGitRepo(testDir, modifiedFiles) {
    const { execSync } = require('child_process');

    // Initialize repo
    execSync('git init', { cwd: testDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: testDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: testDir, stdio: 'pipe' });

    // Create initial commit on main
    execSync('git checkout -b main', { cwd: testDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(testDir, '.gitkeep'), '');
    execSync('git add .gitkeep', { cwd: testDir, stdio: 'pipe' });
    execSync('git commit -m "init"', { cwd: testDir, stdio: 'pipe' });

    // Create feature branch
    execSync('git checkout -b feature', { cwd: testDir, stdio: 'pipe' });

    // Write and commit modified files
    for (const filePath of modifiedFiles) {
        const fullPath = path.join(testDir, filePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, `// modified: ${filePath}`);
        execSync(`git add "${filePath}"`, { cwd: testDir, stdio: 'pipe' });
    }

    if (modifiedFiles.length > 0) {
        execSync('git commit -m "implement"', { cwd: testDir, stdio: 'pipe' });
    }
}
```

### 4.2 Git Scenarios

| Scenario | Modified Files | Expected Git Diff Output |
|----------|---------------|--------------------------|
| All covered | `['src/hooks/validator.cjs', 'src/hooks/dispatcher.cjs', 'src/agents/dev.md']` | All 3 files listed |
| Partial coverage | `['src/hooks/validator.cjs']` | Only 1 file listed |
| Empty diff | `[]` (no changes on branch) | Empty output |
| Not a git repo | -- (skip `git init`) | execSync throws error |

---

## 5. Context Object Fixtures

### 5.1 Direct check() Call Contexts

For unit tests that call `check(ctx)` directly (bypassing stdin/process):

```javascript
function makeCtx(stateOverride) {
    return {
        input: { tool_name: 'Task', tool_input: { prompt: 'advance' } },
        state: Object.assign({}, STATE_FEATURE_P06, stateOverride || {})
    };
}

const CTX_NO_INPUT = { state: STATE_FEATURE_P06 };
const CTX_NO_STATE = { input: { tool_name: 'Task' } };
const CTX_NO_WORKFLOW = { input: { tool_name: 'Task' }, state: STATE_NO_WORKFLOW };
const CTX_EMPTY = {};
const CTX_NULL = null;
```

---

## 6. Data Generation Strategy

All test data is **inline** within the test file (not external fixture files). This follows the established convention in existing hook tests (e.g., `test-gate-blocker-extended.test.cjs` defines helper functions and fixtures within the test file).

**Rationale**:
- Test data is co-located with test cases for readability
- No external dependencies or fixture file management
- Easy to understand what each test receives as input
- Matches the existing test patterns in the project

### 6.1 File System Setup Pattern

For tests that require markdown files on disk:

```javascript
function writeImpactAnalysis(testDir, artifactFolder, content) {
    const dir = path.join(testDir, 'docs', 'requirements', artifactFolder);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'impact-analysis.md'), content);
}

function writeCoverageChecklist(testDir, artifactFolder, content) {
    const dir = path.join(testDir, 'docs', 'requirements', artifactFolder);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'blast-radius-coverage.md'), content);
}
```

---

## 7. Boundary Values

| Data Element | Min | Max | Boundary Tests |
|-------------|-----|-----|---------------|
| Affected files count | 0 | 100+ | TC-BCR-05 (0), TC-NFR-01 (100) |
| File path length | 1 char | 256+ chars | Handled by regex `[^`]+` |
| Notes column | Empty string | Multi-sentence | TC-PBC-02 (empty), TC-PBC-01 (full) |
| Change type values | CREATE | NO CHANGE | TC-PIA-03 (all types) |
| Coverage status values | covered | unaddressed | TC-PBC-03 (case variations) |
| Table sections | 0 | 7+ | TC-PIA-02 (2), TC-INT-06 (0) |
