# Test Strategy: BUG-0029-GH-18 Multiline Bash Permission Bypass

**Bug ID:** BUG-0029-GH-18
**Phase:** 05-test-strategy
**Date:** 2026-02-20 (updated from 2026-02-19)
**Testing Framework:** Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
**Test Extension:** `.test.cjs` (CommonJS, matching project convention)
**Test Location:** `src/claude/hooks/tests/`
**Test File:** `multiline-bash-validation.test.cjs`

---

## Existing Infrastructure (from test evaluation)

- **Framework**: Node.js built-in `node:test` (no external dependency)
- **Coverage Tool**: None configured (manual verification)
- **Current Test Count**: 555+ tests (302 ESM lib tests + 253 CJS hook tests)
- **Existing Patterns**: CJS tests in `src/claude/hooks/tests/*.test.cjs`, ESM tests in `lib/*.test.js`
- **Test Runner**: `npm run test:hooks` for CJS hook tests
- **Test Helpers**: `src/claude/hooks/tests/hook-test-utils.cjs` provides `setupTestEnv`, `cleanupTestEnv`, `writeState`, `readState`

This test strategy extends the existing test suite. It does NOT propose a different framework or restructure existing tests.

---

## Scope Update (2026-02-20)

The original analysis (2026-02-19) identified 8 files with 28 multiline blocks. Phase 02 revalidation (2026-02-20) confirmed that **26 of 28 blocks across 6 files** were already resolved through 49 interim commits. The remaining active scope is:

| File | Multiline Blocks | Pattern Type | Status |
|------|-----------------|--------------|--------|
| `src/claude/agents/discover/architecture-analyzer.md` | 1 (line 46) | Line-continuation (`\` backslashes, 11 lines) | **FAILING** |
| `src/claude/agents/quick-scan/quick-scan-agent.md` | 1 (line 113) | Multi-example with comments (9 lines) | **FAILING** |
| 8 previously affected files | 0 | N/A | **PASSING** (regression guards) |

The CLAUDE.md "Single-Line Bash Convention" section is already deployed and tested.

---

## Strategy for This Requirement

### Approach

This bug fix is a **prompt-content fix** -- rewriting `.md` files to eliminate multiline Bash code blocks. There is no runtime code change (no hooks, no lib/ modules, no CLI changes). The test strategy focuses on:

1. **TDD enforcement (RED state)**: Tests for the 2 remaining files FAIL before the fix, proving they detect the violation
2. **Content validation**: Static analysis of `.md` file content to verify no multiline Bash blocks remain
3. **Convention verification**: Confirming the Single-Line Bash Convention section exists in CLAUDE.md and CLAUDE.md.template
4. **Codebase-wide sweep**: A comprehensive scan of ALL 65+ agent/command `.md` files to prevent regressions
5. **Detection algorithm verification**: Synthetic tests proving the scanner catches all known pattern types

### What We Are NOT Testing

- **Runtime behavior of Claude Code's permission engine** -- this is a platform constraint (CON-001), not something we can unit-test
- **LLM behavior** -- whether the LLM actually generates single-line commands after the fix is an integration/behavioral test that cannot be automated in the test suite
- **Settings.json glob matching** -- the glob semantics are a Claude Code platform feature

### Test Types

| Test Type | Count | Purpose |
|-----------|-------|---------|
| Unit (per-file content validation) | 10 | Scan each affected .md file for multiline Bash blocks |
| Unit (convention verification) | 10 | Verify CLAUDE.md and template contain required sections |
| Unit (detection algorithm) | 8 | Synthetic tests proving scanner catches known patterns |
| Unit (regression - non-Bash safe) | 8 | Verify non-Bash code blocks are not flagged |
| Unit (codebase-wide sweep) | 2 | Scan ALL agent/command files comprehensively |
| **Total** | **38** | |

---

## TDD Enforcement

This is a fix workflow. The following tests are designed to FAIL before Phase 06 implementation:

| Test | What It Asserts | Current State |
|------|----------------|---------------|
| `architecture-analyzer.md should have no multiline Bash blocks` | Zero multiline blocks in file | **FAILING** (1 block at line 46) |
| `quick-scan-agent.md should have no multiline Bash blocks` | Zero multiline blocks in file | **FAILING** (1 block at line 113) |
| `should have zero multiline Bash blocks across ALL agent/command files` | Zero violations in entire codebase | **FAILING** (same 2 blocks) |

Phase 06 must fix the 2 files to turn these 3 tests GREEN.

---

## Test Pyramid

### Unit Tests (38 tests)

All tests for this bug fix are unit-level content validation tests. They read `.md` files from `src/claude/` and validate their content against structural rules. No integration or E2E tests are needed because:

- The fix changes static content (Markdown files), not executable code
- There are no component interfaces to validate
- There is no runtime state to test

### Integration Tests

Not applicable. The fix does not change any module interfaces or component interactions.

### E2E Tests

Not applicable. The fix does not change any user-facing behavior beyond eliminating permission prompts, which cannot be automated in a test suite (requires Claude Code's runtime permission engine).

### Security Tests

Not applicable. The fix does not introduce any new inputs, APIs, or data handling.

### Performance Tests

Not applicable. The fix changes static file content. No performance characteristics are affected.

---

## Flaky Test Mitigation

The tests in this strategy are deterministic by design:

- **No network calls**: All tests read local files from the repository
- **No timing dependencies**: Tests validate static content, not time-sensitive operations
- **No shared state**: Each test reads its own file(s) independently
- **No randomness**: Content validation uses deterministic regex patterns
- **No temp directories needed**: Tests read production files directly

Flaky test risk: **NONE**. All tests are pure file-content assertions.

---

## Test File Organization

Following existing project conventions, all tests are in a single CJS test file:

```
src/claude/hooks/tests/
  multiline-bash-validation.test.cjs    # All 38 tests for BUG-0029
```

### Naming Convention

Tests follow the existing pattern: `{descriptive-name}.test.cjs`

Test IDs follow: `TC-MLB-{NN}` (Test Case - MultiLine Bash - Number)

### Run Command

```bash
node --test src/claude/hooks/tests/multiline-bash-validation.test.cjs
```

Also included in the existing `npm run test:hooks` aggregate command.

---

## Coverage Targets

| Metric | Target | Current |
|--------|--------|---------|
| Requirement coverage | 100% | 100% -- all FRs and ACs mapped |
| File coverage | 100% | 100% -- all 10 affected files + codebase-wide sweep |
| Pattern type coverage | 100% | 100% -- all 8 pattern types detected by scanner |
| Convention section coverage | 100% | 100% -- both CLAUDE.md and CLAUDE.md.template verified |

---

## Critical Paths

1. **Multiline Bash detection in remaining files** (architecture-analyzer.md, quick-scan-agent.md): The 2 files that currently FAIL and must be fixed in Phase 06
2. **Codebase-wide sweep**: Catches any multiline Bash in ANY agent/command file, preventing future regressions
3. **Convention section presence**: Without the convention section, regression is likely
4. **Detection algorithm correctness**: Ensures the scanner catches all pattern types including line-continuations

---

## Test Commands (using existing infrastructure)

- **This fix's tests**: `node --test src/claude/hooks/tests/multiline-bash-validation.test.cjs`
- **All CJS hook tests**: `npm run test:hooks`
- **All ESM lib tests**: `npm test`
- **Full suite**: `npm run test:all`

---

## Dependencies

- Node.js 18+ (built-in `node:test` and `node:assert/strict`)
- No additional npm packages required
- No test fixtures or temp directories needed (tests read production files)

---

## GATE-05 Validation

- [x] Test strategy covers unit tests (content validation is unit-level)
- [x] Integration tests documented as N/A with rationale
- [x] E2E tests documented as N/A with rationale
- [x] Security tests documented as N/A with rationale
- [x] Performance tests documented as N/A with rationale
- [x] Test cases exist for all requirements (FR-001 through FR-004, NFR-001 through NFR-004)
- [x] Traceability matrix complete (100% FR and AC coverage)
- [x] Coverage targets defined
- [x] Test data strategy documented (synthetic test data in detection algorithm tests)
- [x] Critical paths identified
- [x] Flaky test mitigation addressed
- [x] Test pyramid documented
- [x] TDD enforcement: 3 tests FAIL before fix, proving detection works
