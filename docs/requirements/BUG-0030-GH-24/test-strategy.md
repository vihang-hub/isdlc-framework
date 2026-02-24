# Test Strategy: BUG-0030-GH-24

**Bug**: Impact analysis sub-agents anchor on quick scan file list instead of independent search
**Phase**: 05-test-strategy
**Created**: 2026-02-18
**Test Framework**: Node.js built-in `node:test` + `node:assert/strict` (CJS)
**Test Runner**: `node --test src/claude/hooks/tests/test-impact-search-directives.test.cjs`

---

## Existing Infrastructure

- **Framework**: `node:test` (built-in, Node 18+)
- **Test Streams**: ESM (`lib/*.test.js`) and CJS (`src/claude/hooks/tests/*.test.cjs`)
- **Pattern**: Structural verification of source files (read real files, assert on content)
- **Precedent**: `test-build-integrity.test.cjs`, `artifact-path-consistency.test.cjs` -- both read production source files and assert structural properties
- **Conventions**: CJS (`.test.cjs`), `describe`/`it` blocks, `assert.ok`/`assert.match` for string content validation, `before()` for one-time file loading

## Strategy for This Bug Fix

- **Approach**: Extend existing CJS test suite with a new prompt content verification test file
- **Test Type**: Structural content validation (read `.md` agent prompt files, assert required text exists)
- **Location**: `src/claude/hooks/tests/test-impact-search-directives.test.cjs`
- **Coverage Target**: 100% of acceptance criteria (AC-001 through AC-005)

---

## Test Pyramid

### Unit Tests (Primary Focus)

This bug fix is entirely prompt-only (`.md` files). The "unit" tests verify that each agent prompt file contains the required instructional content. These are structural assertions -- they read real source files and check for the presence of specific directive text.

| Test Area | File Under Test | What is Verified |
|-----------|----------------|------------------|
| M1 search directive | `impact-analyzer.md` | Contains "MUST perform independent Glob/Grep search" or equivalent |
| M2 search directive | `entry-point-finder.md` | Contains "MUST perform independent Glob/Grep search" or equivalent |
| M3 search directive | `risk-assessor.md` | Contains "MUST perform independent Glob/Grep search" or equivalent |
| M4 verification step | `cross-validation-verifier.md` | Contains independent completeness verification step |
| Supplementary context label | All 4 files | Contains "supplementary context only" or equivalent |

### Integration Tests

Not applicable. The changes are to isolated `.md` prompt files with no inter-file dependencies at a code level. The cross-validation verifier (M4) references M1/M2/M3 outputs conceptually, but the test validates prompt content, not runtime agent behavior.

### E2E Tests

Not applicable for this bug fix. End-to-end validation of the impact analysis pipeline (Phase 00 -> Phase 02 sub-agents) would require running the full orchestrator with real delegation, which is outside the scope of a prompt content fix. The structural tests provide sufficient confidence that the instructions are present and correctly placed.

### Security Tests

Not applicable. No credential handling, input validation, or authorization changes.

### Performance Tests

Not applicable. No runtime code changes.

## Performance Test Plan

No performance tests are needed. The fix modifies agent prompt text only -- no executable code paths, no I/O operations, no latency-sensitive operations are affected.

## Flaky Test Mitigation

- All tests read static source files from disk using synchronous `fs.readFileSync()`. No network calls, no concurrency, no time-dependent assertions.
- File paths are resolved from `__dirname` using `path.resolve()`, making them deterministic regardless of working directory.
- String matching uses case-insensitive regex patterns to avoid false negatives from minor formatting changes.
- No test isolation issues: tests are read-only against production source files.

---

## TDD Enforcement (Fix Workflow)

Since this is a fix workflow, the test-first requirement means:

1. **Tests are written first** (this phase) and designed to **FAIL** against the current (unfixed) `.md` files
2. **Phase 06 (Implementation)** modifies the `.md` files to make the tests pass
3. **Phase 16 (Quality Loop)** confirms all tests pass

### Why Tests Will Fail Against Current Files

The trace analysis (Phase 02) confirmed:
- "Glob" appears 0 times in M1, M2, M3, M4 feature sections
- "Grep" appears 0 times in M2, M3, M4; once in M1 as a lowercase example only
- "independent" appears 0 times in all four agent files
- "exhaustive" appears 0 times in feature workflow sections of M1, M2, M3
- "supplementary" appears 0 times in all four files
- M4 has no step that searches the codebase independently

The tests assert the **presence** of these terms. Running them before the fix guarantees failure.

---

## Test File Location

```
src/claude/hooks/tests/test-impact-search-directives.test.cjs
```

Follows the established CJS test convention in this project. The file reads source `.md` files from `src/claude/agents/impact-analysis/` and validates content.

## Test Execution

```bash
node --test src/claude/hooks/tests/test-impact-search-directives.test.cjs
```

Integrates into the existing test run via `npm run test:hooks` (which discovers all `*.test.cjs` files in the hooks/tests directory).

---

## Coverage Targets

| Metric | Target |
|--------|--------|
| Requirement coverage (FR) | 100% -- both FRs covered |
| Acceptance criteria coverage (AC) | 100% -- all 5 ACs have dedicated test cases |
| Positive test cases | 5 (one per AC, verifying directive presence) |
| Negative test cases | 5 (verifying absence of incorrect/old patterns) |
| Total test cases | 17 (see test-cases/ for full breakdown) |

## Critical Paths

1. **M1/M2/M3 independent search directive** -- The primary fix. Each agent MUST have an explicit instruction to perform independent Glob/Grep search. This is the highest-priority test target.
2. **M4 independent completeness verification** -- The secondary fix. M4 MUST have a new step that independently searches the codebase. Second-highest priority.
3. **Supplementary context labeling** -- Cross-cutting requirement. All agents MUST label quick scan output as non-authoritative. Validates the defensive framing.

---

## GATE-04 Checklist

- [x] Test strategy covers applicable test types (unit/structural -- integration/E2E/security/performance not applicable for prompt-only fix)
- [x] Test cases exist for all requirements (FR-001, FR-002)
- [x] Test cases exist for all acceptance criteria (AC-001 through AC-005)
- [x] Traceability matrix complete (100% requirement coverage)
- [x] Coverage targets defined
- [x] Test data strategy documented (see test-data-plan section below)
- [x] Critical paths identified
- [x] TDD enforcement: tests designed to fail against current files
