# Test Data Plan: BACKLOG.md Scaffolding

**REQ ID**: REQ-0014
**Phase**: 05-test-strategy
**Created**: 2026-02-14
**Status**: Approved

---

## 1. Overview

This feature has simple test data needs. All test data is either generated at runtime by existing test helpers or consists of small string literals. No external fixtures, databases, or mock servers are required.

## 2. Test Data Categories

### 2.1 Project Directory Fixtures

Each test creates an isolated temporary project directory using the existing `setupProjectDir()` helper from `lib/installer.test.js`. This function:

1. Creates a temp directory via `createTempDir()` (from `lib/utils/test-helpers.js`)
2. Creates a named subdirectory
3. Writes a minimal `package.json`
4. Runs `git init`
5. Returns the absolute path

**Cleanup**: Each test uses `cleanupTempDir()` in its `after()` hook.

### 2.2 Pre-existing BACKLOG.md Content

For skip-if-exists tests (TC-12, TC-13), a custom BACKLOG.md is written before running init:

```javascript
const customContent = '# My Custom Backlog\n\nUser data here.\n';
writeFileSync(join(projectDir, 'BACKLOG.md'), customContent, 'utf-8');
```

This content deliberately differs from the template to ensure the test detects if the file was overwritten.

### 2.3 Expected Template Content

The expected BACKLOG.md content (from interface-spec.yaml `generateBacklogMd.return.contract.exact_output`):

```markdown
# Project Backlog

> Backlog and completed items are tracked here.
> This file is NOT loaded into every conversation -- reference it explicitly when needed.

## Open

## Completed
```

Structural assertions validate:
- Title line: `# Project Backlog`
- Preamble blockquote (2 lines starting with `>`)
- `## Open` heading
- `## Completed` heading
- Section ordering (Open index < Completed index)
- Trailing newline
- No list items (no `^- ` lines)

### 2.4 CLI Flags

| Flag Combination | Test Cases | Effect |
|-----------------|-----------|--------|
| `--force` | TC-01 through TC-13, TC-16, TC-17, TC-18 | Skip prompts, non-interactive mode |
| `--force --dry-run` | TC-14, TC-15 | Skip prompts + no file writes |
| `--force --purge-all` (uninstall) | TC-17 | Full purge with BACKLOG.md verification |

## 3. Test Data Generation Strategy

All test data is generated inline within each test using Node.js built-in modules:

| Data Type | Generation Method | Lifecycle |
|-----------|------------------|-----------|
| Temp directories | `createTempDir()` + `mkdirSync()` | Created in `before()`, removed in `after()` |
| package.json | `writeFileSync()` with `JSON.stringify()` | Created in `setupProjectDir()` |
| Git repo | `execSync('git init')` | Part of `setupProjectDir()` |
| Custom BACKLOG.md | `writeFileSync()` with string literal | Created in test-specific `before()` |
| CLI output capture | `execSync()` with `encoding: 'utf-8'` | Return value of `runInit()` / `runUninstall()` |

## 4. Data Isolation

Each test describe block uses a unique project name to avoid any interference between concurrent test runs:

```javascript
setupProjectDir('backlog-content-test')   // Content validation tests
setupProjectDir('backlog-skip-test')       // Skip-if-exists tests
setupProjectDir('backlog-dryrun-test')     // Dry-run tests
setupProjectDir('backlog-uninstall-test')  // Uninstall preservation tests
setupProjectDir('backlog-purge-test')      // Purge-all preservation tests
```

Each directory lives under its own `mkdtempSync()` temp base, ensuring complete filesystem isolation.

## 5. No External Dependencies

- No mock servers or HTTP fixtures
- No database state
- No environment variable manipulation (beyond `NODE_NO_WARNINGS=1`)
- No shared mutable state between test suites
- No snapshot files or golden files (assertions are inline)
