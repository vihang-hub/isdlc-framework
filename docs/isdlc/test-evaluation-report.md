# Test Evaluation Report

**Generated:** 2026-02-07
**Evaluated by:** iSDLC Discover (D2 Test Evaluator)
**Project:** iSDLC Framework

---

## Executive Summary

The iSDLC framework has **minimal test coverage**: 1 test file with 24 tests covering only the hook subsystem. The CLI layer (lib/), shell scripts, and 5 of 8 hooks have **zero tests**. The npm test command (`node --test lib/**/*.test.js`) matches no files. CI provides smoke tests but no automated unit or integration test suite for the core functionality.

**Overall Coverage Estimate: ~15-20%** (hooks only, no lib/ coverage)

---

## Current Test Infrastructure

### Test Framework

The project uses a **custom Node.js test runner** (`src/claude/hooks/tests/test-skill-validator.js`) with no external test framework dependency. The test file:
- Spawns hook processes with controlled stdin/env
- Uses temp directories for isolation
- Has pass/fail counting with colored output
- Cleans up after each test

### Existing Tests (24 total)

| Category | Count | What's Tested |
|----------|-------|---------------|
| common.js | 7 | getProjectRoot, fs module, readStateValue, getTimestamp, normalizeAgentName (3 variants) |
| skill-validator.js | 8 | Non-Task allowed, phase match, orchestrator bypass, cross-phase observe, warn/audit/disabled/observe modes |
| log-skill-usage.js | 4 | Task logging, non-Task skip, accumulation, correct agent name |
| Integration | 1 | Full flow: validator -> logger for same-phase agent |
| gate-blocker.js | 4 | Delegation pass with log, fail without log, disabled phase, missing manifest |

### CI/CD Test Coverage

The `ci.yml` GitHub Actions workflow provides:
- **Lint job**: `npm run lint` (currently echo stub)
- **Test job**: `npm test` on 3 OS x 3 Node versions (but npm test matches no files)
- **Integration job**: CLI smoke tests (help, version, doctor, init --dry-run, actual install, uninstall --dry-run)
- **Bash install job**: Shell installer smoke test on Ubuntu and macOS

---

## Gap Analysis

### Critical Gaps (Must Fix)

| Component | Lines | Tests | Risk | Recommendation |
|-----------|-------|-------|------|---------------|
| `lib/installer.js` | 845 | 0 | CRITICAL | Symlink creation, state init, settings.json generation, project detection -- all untested. Bugs here break all new installations. |
| `lib/updater.js` | 550 | 0 | CRITICAL | Manifest diffing, file cleanup, backup creation, deep merge -- all untested. Bugs here can destroy existing installations. |
| `lib/project-detector.js` | 277 | 0 | HIGH | New vs existing detection logic untested. Wrong detection leads to wrong workflow. |
| `lib/monorepo-handler.js` | 247 | 0 | HIGH | Multi-project isolation untested. Cross-project state corruption possible. |
| `lib/uninstaller.js` | 514 | 0 | HIGH | Cleanup logic untested. Could leave orphaned files or remove user files. |

### Medium Gaps (Should Fix)

| Component | Lines | Tests | Risk | Recommendation |
|-----------|-------|-------|------|---------------|
| `gate-blocker.js` | 575 | 4 | MEDIUM | Only delegation tests exist. Missing: menu interaction check, test iteration check, constitutional check, workflow override. |
| `iteration-corridor.js` | 337 | 0 | MEDIUM | TEST_CORRIDOR and CONST_CORRIDOR blocking logic untested. |
| `constitution-validator.js` | 323 | 0 | MEDIUM | Phase completion detection, article checking, state initialization untested. |
| `test-watcher.js` | 545 | 0 | MEDIUM | Test command detection, result parsing, circuit breaker, ATDD skip detection untested. |
| `menu-tracker.js` | 261 | 0 | MEDIUM | Menu pattern detection, selection tracking, step completion untested. |
| `model-provider-router.js` | 153 | 0 | MEDIUM | Provider selection, health check, fallback chain untested. |
| `lib/doctor.js` | 238 | 0 | MEDIUM | Health check validation logic untested. |
| `lib/cli.js` | 233 | 0 | MEDIUM | Argument parsing, command routing untested. |

### Low Gaps (Nice to Have)

| Component | Lines | Tests | Risk | Recommendation |
|-----------|-------|-------|------|---------------|
| `install.sh` | 1,162 | CI smoke | LOW | Complex shell script with many edge cases. Consider shellcheck. |
| `update.sh` | 580 | 0 | LOW | Shell update script untested. |
| `uninstall.sh` | 867 | CI smoke | LOW | Shell uninstall script. |
| `lib/utils/fs-helpers.js` | 250 | 0 | LOW | File system utilities. |
| `lib/utils/logger.js` | 137 | 0 | LOW | Logger is cosmetic, low risk. |
| `lib/utils/prompts.js` | 110 | 0 | LOW | Interactive prompts, hard to unit test. |

---

## Recommended Test Infrastructure

### Phase 1: Fix npm test (Immediate)

The `npm test` script (`node --test lib/**/*.test.js`) matches zero files. Either:
- Create `lib/*.test.js` files using Node.js built-in test runner
- Or update the script to point to existing test files

### Phase 2: Unit Tests for lib/ (Priority: CRITICAL)

Create test files for each lib module:
- `lib/installer.test.js` -- Test symlink creation, state init, settings generation
- `lib/updater.test.js` -- Test manifest diff, file cleanup, backup, deep merge
- `lib/project-detector.test.js` -- Test new/existing detection with various project layouts
- `lib/monorepo-handler.test.js` -- Test project resolution, state scoping
- `lib/uninstaller.test.js` -- Test cleanup logic, file removal
- `lib/doctor.test.js` -- Test health check validation
- `lib/cli.test.js` -- Test argument parsing, command routing

### Phase 3: Hook Tests (Priority: HIGH)

Extend the existing test file or create per-hook test files:
- `hooks/tests/test-gate-blocker.js` -- Complete gate check coverage
- `hooks/tests/test-iteration-corridor.js` -- Corridor state and blocking
- `hooks/tests/test-constitution-validator.js` -- Completion detection, article checking
- `hooks/tests/test-test-watcher.js` -- Command detection, result parsing, circuit breaker
- `hooks/tests/test-menu-tracker.js` -- Menu detection, selection tracking

### Phase 4: Integration Tests (Priority: MEDIUM)

- Install -> Doctor -> Update -> Uninstall flow
- Monorepo: install -> add project -> switch project -> verify isolation
- Hook chain: PreToolUse -> action -> PostToolUse state changes

### Phase 5: Additional Tooling (Priority: LOW)

- **Mutation testing**: Stryker for JavaScript
- **Shell script linting**: shellcheck for install.sh/uninstall.sh/update.sh
- **Coverage reporting**: c8 or istanbul for Node.js code coverage

---

## Test Quality Metrics (Current)

| Metric | Current | Target |
|--------|---------|--------|
| Test files | 1 | 15+ |
| Total tests | 24 | 150+ |
| Hook coverage | 3 of 8 (37.5%) | 8 of 8 (100%) |
| Lib coverage | 0 of 10 (0%) | 10 of 10 (100%) |
| CI matrix | 9 combinations | 9 combinations (keep) |
| Mutation score | N/A | >=80% |
| npm test | Matches 0 files | Runs all lib tests |
