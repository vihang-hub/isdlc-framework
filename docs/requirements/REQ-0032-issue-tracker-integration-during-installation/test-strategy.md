# Test Strategy: REQ-0032 Issue Tracker Integration During Installation

**Status**: Complete
**Last Updated**: 2026-02-22
**Requirement**: REQ-0032
**Phase**: 05 - Test Strategy

---

## 1. Existing Infrastructure (from test evaluation)

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Coverage Tool**: None configured (c8/istanbul recommended but not yet adopted)
- **Current Baseline**: 555+ tests (302 ESM lib tests + 253 CJS hook tests)
- **Existing Test Streams**: ESM (`lib/*.test.js`) and CJS (`src/claude/hooks/tests/*.test.cjs`)
- **Existing Tests for Affected Files**: `lib/installer.test.js` (30 tests), `lib/updater.test.js` (22 tests)
- **Existing Patterns**: Subprocess approach for ESM lib tests; direct function testing for CJS hooks

## 2. Strategy for This Requirement

- **Approach**: Extend existing test suites (NOT replace)
- **New Test Types Needed**: Unit tests (primary), integration tests (secondary), security validation (edge cases)
- **Coverage Target**: >=80% unit coverage on new code (per Article II); 100% critical path coverage for installer and detectSource
- **Regression Threshold**: Total test count must not decrease (Article II baseline rule)

## 3. Test Commands (use existing)

- Unit (ESM): `npm test` (runs `node --test lib/*.test.js lib/utils/*.test.js`)
- Unit (CJS): `npm run test:hooks` (runs CJS hook tests)
- All: `npm run test:all` (both streams)
- Mutation: Not yet configured (Stryker recommended; out of scope for this feature)

---

## 4. Test Scope

### 4.1 Modules Under Test

| Module | File | Stream | Test File | Test Type |
|--------|------|--------|-----------|-----------|
| Installer issue tracker prompt | `lib/installer.js` | ESM | `lib/installer.test.js` (extend) | Unit |
| `detectGitHubRemote()` | `lib/installer.js` | ESM | `lib/installer.test.js` (extend) | Unit |
| `checkGhCli()` | `lib/installer.js` | ESM | `lib/installer.test.js` (extend) | Unit |
| `checkAtlassianMcp()` | `lib/installer.js` | ESM | `lib/installer.test.js` (extend) | Unit |
| CLAUDE.md template interpolation | `lib/installer.js` | ESM | `lib/installer.test.js` (extend) | Unit |
| `detectSource(input, options?)` | `src/claude/hooks/lib/three-verb-utils.cjs` | CJS | New: `src/claude/hooks/tests/detect-source-options.test.cjs` | Unit |
| Updater section preservation | `lib/updater.js` | ESM | `lib/updater.test.js` (extend) | Unit |
| CLAUDE.md section format parsing | Regex patterns in interface spec | CJS | New: `src/claude/hooks/tests/detect-source-options.test.cjs` | Unit |
| End-to-end install with tracker | `lib/installer.js` | ESM | `lib/installer.test.js` (extend) | Integration |

### 4.2 Modules NOT Under Test (out of scope)

| Module | Reason |
|--------|--------|
| `isdlc.md` command routing | Agent prompt file; no automated test (validated at runtime) |
| CLAUDE.md template structure | Static template; validated by installer interpolation tests |
| MCP actual connectivity | Requires Claude Code runtime environment; not testable in CI |

---

## 5. Test Types

### 5.1 Unit Tests

**Target**: All new internal functions and the enhanced `detectSource()`.

**Approach**: Follow existing patterns exactly.

For ESM tests (`lib/installer.test.js`):
- Use subprocess approach: call `node bin/isdlc.js init --force` in temp directories
- Inspect resulting filesystem (CLAUDE.md content, state.json)
- Use `setupProjectDir()` and `runInit()` helpers from existing test file

For CJS tests (`detect-source-options.test.cjs`):
- Use direct function import: `require('../lib/three-verb-utils.cjs')`
- Test `detectSource()` with various input/options combinations
- Follow `hook-test-utils.cjs` patterns for setup/teardown

**Coverage Targets**:
- `detectSource()` new options path: 100% (all branches)
- `detectGitHubRemote()`: 100% (5 scenarios per interface spec)
- `checkGhCli()`: 100% (3 scenarios)
- `checkAtlassianMcp()`: 100% (3 scenarios)
- Installer prompt flow: >=80% (some interactive paths hard to test via subprocess)
- Template interpolation: 100% (3 tracker types)
- Updater preservation: 100% (3 scenarios)

### 5.2 Integration Tests

**Target**: End-to-end installer flow with issue tracker selection.

**Approach**: The existing `lib/installer.test.js` already tests the full `init --force` flow via subprocess. New integration tests extend this pattern.

- Test that `init --force` produces a CLAUDE.md with the Issue Tracker Configuration section
- Test that the section contains default values (`manual`, empty keys)
- Test that a second `init --force` (update scenario) does not destroy an existing CLAUDE.md

**Note on Article XI**: Integration tests in this project use subprocess execution, which validates real system behavior (file system writes, template interpolation, state generation). No external service stubs are used -- `--force` bypasses prompts but exercises the real code paths.

### 5.3 Security Tests

**Target**: Input validation and fail-safe behavior.

**Cases**:
- Invalid `options.issueTracker` values (e.g., `'sql-inject'`, `undefined`, `null`, `123`)
- Malformed Jira project keys (empty string, special characters, very long strings)
- `detectSource()` with `null`, `undefined`, empty string, and non-string inputs
- Path traversal in project root parameter for `detectGitHubRemote()`
- Error containment: verify `checkGhCli()` and `checkAtlassianMcp()` never throw

### 5.4 Performance Tests

**Target**: Installation time impact.

**Approach**: Not a formal performance test suite. Existing `--force` tests have a 60-second timeout. The new prompt step adds at most 2 seconds (per NFR). This is validated by ensuring existing timeout thresholds are not exceeded.

### 5.5 Adversarial Tests (Article XI)

**Target**: Boundary conditions for `detectSource()` and input parsing.

**Cases**:
- Maximum length inputs (1000+ character strings)
- Unicode characters in input
- Bare numbers at boundary values (0, 1, 999999999)
- Mixed-case project keys (e.g., `proj-123`, `Proj-123`)
- Inputs with leading/trailing whitespace
- Inputs with special regex characters (e.g., `$42`, `^42`, `*42`)

---

## 6. Test Data Strategy

### 6.1 Fixtures

Test data is defined inline in test files (following existing project pattern) rather than in separate fixture files. This is consistent with how `lib/installer.test.js` and all CJS hook tests currently work.

### 6.2 Key Test Data Sets

| Category | Data Points |
|----------|-------------|
| GitHub remote URLs | SSH (`git@github.com:user/proj.git`), HTTPS (`https://github.com/user/proj.git`), GitLab, Bitbucket, no remote, invalid URL |
| Tracker selections | `'github'`, `'jira'`, `'manual'` |
| Jira project keys | `'PROJ'`, `'MY-LONG-PROJECT'`, `''`, `'lowercase'`, `'123'` |
| Bare number inputs | `'42'`, `'1234'`, `'0'`, `'999999999'`, `'00042'` |
| Explicit pattern inputs | `'#42'`, `'PROJ-123'`, `'#0'`, `'A-1'` |
| Non-numeric inputs | `'fix login bug'`, `''`, `null`, `undefined`, `123` (number type) |
| CLAUDE.md sections | Valid section, missing section, malformed section, empty values |

---

## 7. Critical Paths (100% Coverage Required)

Per Article II, critical paths require 100% test coverage:

1. **Installer issue tracker selection flow**: All three tracker types must be testable
2. **`detectSource()` with options**: Every branch (jira + key, github, manual, fallback) must be tested
3. **Backward compatibility**: `detectSource()` without options must produce identical results to current behavior
4. **Fail-open behavior**: All error paths in `checkGhCli()`, `checkAtlassianMcp()`, `detectGitHubRemote()` must gracefully recover
5. **Updater preservation**: The `## Issue Tracker Configuration` section must survive updates

---

## 8. Estimated New Test Count

| Test File | New Tests | Test Type |
|-----------|-----------|-----------|
| `lib/installer.test.js` (extend) | ~12 | Unit + Integration |
| `src/claude/hooks/tests/detect-source-options.test.cjs` (new) | ~18 | Unit |
| `lib/updater.test.js` (extend) | ~3 | Unit |
| **Total** | **~33** | |

This brings the estimated total from 555+ to ~588+ tests, maintaining the non-decreasing baseline.

---

## 9. Test Execution Plan

### 9.1 Local Development

1. Developer writes failing test (RED) per TDD
2. Implements code to pass the test (GREEN)
3. Refactors while keeping tests green

### 9.2 CI Pipeline

- Existing CI matrix: 3 OS (Ubuntu, macOS, Windows) x 3 Node (20, 22, 24) = 9 combinations
- No new CI configuration needed -- `npm run test:all` picks up new test files automatically
- CJS test files in `src/claude/hooks/tests/*.test.cjs` are auto-discovered

### 9.3 Regression Protection

- All 555+ existing tests must continue to pass
- New tests extend existing files (installer, updater) and add one new file (detect-source-options)
- No modifications to existing test assertions

---

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `claude mcp list` output format varies across versions | Tests may not cover all output variants | Use pattern-based matching with fail-open; test known formats |
| `--force` flag bypasses prompt; cannot test interactive path | Prompt interaction untested in CI | Test prompt wiring via code review; validate defaults via --force path |
| CJS/ESM boundary for detectSource tests | Module resolution conflicts in test runner | Follow existing pattern: copy CJS files to temp directory for testing |
| Template interpolation tested only via --force default | Non-default tracker types not exercised in e2e | Unit test template interpolation separately; e2e validates plumbing |
