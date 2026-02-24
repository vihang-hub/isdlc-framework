# Test Strategy: BACKLOG.md Scaffolding

**REQ ID**: REQ-0014
**Phase**: 05-test-strategy
**Created**: 2026-02-14
**Status**: Approved

---

## 1. Existing Infrastructure (from project discovery)

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Coverage Tool**: istanbul/c8 (via `npm test`)
- **Current Test Count**: ~1880 tests (1280 CJS + ~600 ESM)
- **Existing Patterns**: Subprocess integration tests in `lib/installer.test.js` (~30 tests) and `lib/uninstaller.test.js` (~17 tests)
- **Shared Helpers**: `lib/utils/test-helpers.js` (createTempDir, cleanupTempDir, createProjectDir, captureConsole)
- **Naming Convention**: `*.test.js` for ESM test files
- **Test Runner Command**: `npm test` (ESM stream)

## 2. Strategy for This Requirement

- **Approach**: Extend existing `lib/installer.test.js` and `lib/uninstaller.test.js` test suites with new `describe` blocks for BACKLOG.md behavior
- **New Test Types Needed**: Unit-level content validation (pure function) + integration-level install/uninstall flow tests
- **Coverage Target**: 100% of all 12 acceptance criteria + 2 NFRs
- **Total New Test Cases**: 18 test cases (TC-01 through TC-18)

## 3. Test Types

### 3.1 Unit Tests (Pure Function)

**Scope**: `generateBacklogMd()` return value validation
**Location**: New tests added to `lib/installer.test.js`
**Pattern**: Direct import and string assertion

These tests validate that the pure function produces the correct template content without any filesystem interaction. Since `generateBacklogMd()` is module-private (not exported), these tests use the subprocess approach: run `isdlc init --force`, then read the created BACKLOG.md and validate its content. This is consistent with the existing test pattern for CLAUDE.md.

Test cases: TC-01, TC-02, TC-03, TC-04, TC-05, TC-06

### 3.2 Integration Tests (Install Flow)

**Scope**: BACKLOG.md creation during the full `isdlc init --force` install flow
**Location**: New `describe` blocks in `lib/installer.test.js`
**Pattern**: Subprocess (`node bin/isdlc.js init --force`) + filesystem assertions (matches existing installer test pattern exactly)

Test cases: TC-07, TC-08, TC-09, TC-10, TC-11

### 3.3 Guard Tests (Skip + Dry-Run)

**Scope**: Existence-check skip behavior and dry-run mode
**Location**: New `describe` blocks in `lib/installer.test.js`
**Pattern**: Pre-create BACKLOG.md before running init, assert content is preserved; run with `--dry-run`, assert no file created

Test cases: TC-12, TC-13, TC-14, TC-15

### 3.4 Negative Tests (Uninstaller Preservation)

**Scope**: BACKLOG.md survives standard uninstall and purge-all operations
**Location**: New `describe` block in `lib/uninstaller.test.js`
**Pattern**: Install, create/verify BACKLOG.md, uninstall, assert BACKLOG.md still exists with unchanged content

Test cases: TC-16, TC-17, TC-18

## 4. Test Commands (use existing)

```bash
# Run all ESM tests (includes installer + uninstaller tests)
npm test

# Run specific test file
node --test lib/installer.test.js

# Run with coverage
npm run test:coverage
```

## 5. Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| AC coverage | 100% (12/12) | Article VII -- every AC must have at least one test |
| NFR coverage | 100% (2/2) | NFRs validated through structural assertions |
| Branch coverage for BACKLOG.md block | 100% (3 branches) | Creation, skip-if-exists, dry-run |
| generateBacklogMd() output | 100% assertions | Every structural element verified |

## 6. Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Template content changes without test update | TC-01 through TC-06 validate exact structure |
| Uninstaller accidentally adds BACKLOG.md removal | TC-16, TC-17, TC-18 catch regression |
| Dry-run flag not respected | TC-14, TC-15 verify no file creation |
| Existing BACKLOG.md overwritten | TC-12, TC-13 verify preservation |
| Section ordering changes | TC-06 explicitly validates `## Open` before `## Completed` |

## 7. Test Data Requirements

See `test-data-plan.md` for full details. Summary:

- **Fresh install**: Empty project with package.json + git init (from `setupProjectDir()`)
- **Pre-existing BACKLOG.md**: Write custom content before running init
- **Dry-run mode**: Use `--dry-run` flag with `runInit()`
- **Uninstall cycle**: Full install -> verify -> uninstall -> verify

## 8. Dependencies

All tests use existing test utilities. No new dependencies or test frameworks are required.

| Dependency | Source | Status |
|-----------|--------|--------|
| `node:test` | Node.js built-in | Existing |
| `node:assert/strict` | Node.js built-in | Existing |
| `createTempDir` / `cleanupTempDir` | `lib/utils/test-helpers.js` | Existing |
| `setupProjectDir` / `runInit` | `lib/installer.test.js` (local helpers) | Existing |
| `runUninstall` | `lib/uninstaller.test.js` (local helper) | Existing |
