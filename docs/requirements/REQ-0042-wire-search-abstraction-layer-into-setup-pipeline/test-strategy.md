# Test Strategy: Wire Search Abstraction Layer into Setup Pipeline

**Status**: Final
**Requirement**: REQ-0042
**Phase**: 05 - Test Strategy & Design
**Last Updated**: 2026-03-03
**Constitutional Articles**: II (Test-First), VII (Artifact Traceability), IX (Quality Gate Integrity), XI (Integration Testing Integrity)

---

## Existing Infrastructure (from test evaluation)

- **Framework**: Node.js built-in test runner (`node:test`)
- **Module System**: ESM for `lib/` modules, CommonJS for hooks
- **Coverage Tool**: None configured (c8 recommended but not yet adopted)
- **Current Coverage**: ~15-20% (hooks only, no lib/ coverage -- from initial eval; expanded significantly since REQ-0041)
- **Test Commands**: `npm test` runs `node --test lib/*.test.js lib/utils/*.test.js lib/search/*.test.js lib/search/backends/*.test.js`
- **Existing Patterns**: REQ-0041 established comprehensive test patterns in `lib/search/*.test.js` (9 test files, 180 tests, 96.59% line coverage)
- **Test Helpers**: `lib/utils/test-helpers.js` provides `createTempDir()` and `cleanupTempDir()`

## Strategy for This Requirement

- **Approach**: Extend existing test suite (NOT replace)
- **Primary Focus**: New `setupSearchCapabilities()` function in `lib/installer.js` and CLI flag parsing in `lib/cli.js`
- **Secondary Focus**: Agent markdown migration validation (structural checks)
- **Coverage Target**: >=80% line coverage for new code (per Article II)
- **Test Location**: New test cases added alongside existing `lib/installer.test.js` and `lib/cli.test.js` patterns
- **Naming Convention**: `*.test.js` (ESM, matching existing lib/ test files)

## Test Pyramid

### Unit Tests (Primary -- ~35 test cases)

Unit tests validate individual functions in isolation. For REQ-0042, unit tests cover:

1. **setupSearchCapabilities()** in `lib/installer.js` -- The core new function. Tested with mocked `lib/search/` dependencies (detection, install, config) to validate orchestration logic, error handling, and flag interactions.
2. **parseArgs()** in `lib/cli.js` -- Validates `--no-search-setup` flag parsing and interactions with existing flags (`--force`, `--dry-run`).
3. **buildConfig()** helper -- Validates config construction from detection + installation results.
4. **showHelp()** in `lib/cli.js` -- Validates help text includes the new flag.

**Test file location**: `lib/installer.test.js` (extend existing) or `lib/installer-search-setup.test.js` (new companion file to keep tests organized).

**Mocking approach**: The `setupSearchCapabilities()` function imports from `lib/search/detection.js`, `lib/search/install.js`, and `lib/search/config.js`. Unit tests should use dependency injection or module-level stubs to isolate the function. Since these search modules accept `execFn` parameters for testability (established in REQ-0041), the same pattern applies to the installer's usage of them.

### Integration Tests (~8 test cases)

Integration tests validate the end-to-end flow of the setup pipeline with real (but controlled) filesystem operations:

1. **Installer + search setup**: Run `node bin/isdlc.js init --force` in a temp directory and verify that step 8 executes (or at least that the installer completes without error when search modules are available).
2. **Opt-out flow**: Run `node bin/isdlc.js init --force --no-search-setup` and verify no `search-config.json` is created.
3. **Dry-run flow**: Run `node bin/isdlc.js init --force --dry-run` and verify no files are modified by step 8.
4. **Error recovery**: Simulate detection failure and verify the installer completes.

**Test file location**: Extend existing `lib/installer.test.js` integration suite (subprocess approach).

### E2E Tests (~3 test cases)

End-to-end tests validate the complete user journey:

1. **New installation with search setup**: Full `isdlc init` flow produces expected search-config.json and MCP entries.
2. **Agent markdown integrity**: Verify migrated agent files contain the Enhanced Search section and preserve existing structure.
3. **Backward compatibility**: Projects without search setup work identically to pre-REQ-0042 behavior.

**Test file location**: `tests/e2e/search-setup.test.js`

### Security Tests (~3 test cases)

1. **Path traversal**: Verify `setupSearchCapabilities()` rejects project roots with `..` components that could escape the intended directory.
2. **Settings.json injection**: Verify `configureMcpServers()` does not allow arbitrary command injection via crafted MCP entries (already covered by REQ-0041 tests, but validated end-to-end here).
3. **Search config sanitization**: Verify `writeSearchConfig()` sanitizes inputs (no code execution in config values).

### Performance Tests (~2 test cases)

1. **Detection timeout**: Verify search detection completes within 5 seconds (the documented timeout bound).
2. **Installer overhead**: Verify step 8 adds less than 30 seconds to the total init time (per QA-002 usability threshold).

## Flaky Test Mitigation

1. **Temp directory isolation**: Every test creates its own temp directory via `createTempDir()` and cleans up via `cleanupTempDir()`. No shared state between tests.
2. **No real network calls in unit tests**: Tool installation is mocked. Only integration tests may detect real tools, but they do not install them.
3. **No process-level side effects**: Tests that call `setupSearchCapabilities()` use mocked logger and file system operations. Tests that use subprocess approach (`execSync`) run in isolated temp directories.
4. **Deterministic exec stubs**: The `createExecStub()` pattern from REQ-0041 tests provides deterministic tool detection responses.
5. **Timeout guards**: All subprocess-based tests use `timeout: 60000` to prevent hangs.

## Performance Test Plan

Performance testing validates the usability quality attribute (QA-002: search setup adds at most 30 seconds to init flow).

**Approach**:
- Measure wall-clock time for step 8 in isolation (without real tool installation)
- Measure incremental overhead of detection (filesystem scan)
- Use `process.hrtime.bigint()` for sub-millisecond precision

**Thresholds**:
- Detection alone: < 5 seconds (per existing tool detection timeout)
- Step 8 total (detection + display + config write, excluding tool install): < 10 seconds
- Full init with search setup: < 30 seconds total (existing init + step 8)

**Tooling**: No external performance test framework needed. Built-in `node:test` with timing assertions.

## Test Commands (use existing)

- Unit + Integration: `npm test` (already includes `lib/*.test.js` and `lib/search/*.test.js` globs)
- E2E: `npm run test:e2e`
- All: `npm run test:all`

## Critical Paths

The following paths require 100% test coverage per Article II:

1. **Happy path**: `isdlc init` -> step 8 -> detect -> install -> configure MCP -> write config
2. **Opt-out path**: `isdlc init --no-search-setup` -> step 8 skipped entirely
3. **Error recovery path**: Detection/install/MCP fails -> warning logged -> installer continues
4. **Force mode path**: `isdlc init --force` -> auto-accept all recommendations
5. **Dry-run path**: `isdlc init --dry-run` -> display recommendations without changes
6. **No recommendations path**: Detection finds no tools to recommend -> write baseline config

## Mutation Testing

Per Article XI, mutation testing is required with a threshold of >=80%.

**Tool**: Stryker (JavaScript/Node.js mutation testing framework)
**Scope**: New code in `lib/installer.js` (setupSearchCapabilities, buildConfig) and `lib/cli.js` (parseArgs extension)
**Configuration**: Will be configured during Phase 16 (Quality Loop) with targeted mutant selection for new code only.

## Test Execution Order

1. Unit tests run first (fastest feedback)
2. Integration tests run second (subprocess-based, slower)
3. E2E tests run last (full-flow, slowest)
4. Mutation tests run in Quality Loop (Phase 16)

## Agent Migration Validation Strategy

Agent markdown changes are not runtime code, so they are validated through structural tests:

1. **Section presence**: Verify each migrated agent file contains the expected section header (`# ENHANCED SEARCH` or `## Enhanced Search`)
2. **Frontmatter preservation**: Verify YAML frontmatter is unchanged
3. **Existing section preservation**: Verify existing `## Step N:` headings are untouched
4. **Content validation**: Verify the Enhanced Search section contains required keywords (modality, structural, lexical, fallback)

These are implemented as unit tests that read the agent markdown files and check for expected patterns.
