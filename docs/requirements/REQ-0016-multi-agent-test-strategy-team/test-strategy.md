# Test Strategy: Multi-agent Test Strategy Team (REQ-0016)

**Version**: 1.0
**Created**: 2026-02-15
**Phase**: 05-test-strategy
**Traces**: FR-01 through FR-07, NFR-01 through NFR-04, C-01 through C-04

---

## Existing Infrastructure (from test evaluation)

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **CJS Stream**: `src/claude/hooks/tests/*.test.cjs` (CommonJS, explicit `.cjs`)
- **Test Helpers**: `src/claude/hooks/tests/hook-test-utils.cjs` (setupTestEnv, runHook, prepareHook, etc.)
- **Current Coverage**: ~555 existing tests; hooks stream uses CJS
- **Existing Patterns**: `tasks-format-validation.test.cjs` (regex-based markdown validation, fixture generators, no external YAML parser)
- **Run Command**: `npm run test:hooks`

## Strategy for This Requirement

- **Approach**: Extend existing CJS test suite (NOT replace)
- **New Test File**: `src/claude/hooks/tests/test-strategy-debate-team.test.cjs`
- **Pattern Source**: `tasks-format-validation.test.cjs` for file-read + regex validation; `test-skill-validator.test.cjs` for `describe`/`it` structure with `node:test`
- **Coverage Target**: 85+ test cases across 10 test groups
- **No New Dependencies**: Uses only `node:test`, `node:assert/strict`, `node:fs`, `node:path`

---

## Test Pyramid

### Level 1: Unit Tests (70% -- ~60 tests)

Validate individual artifacts in isolation using file-read + regex pattern matching.

| Test Group | Target | Tests | Description |
|------------|--------|-------|-------------|
| Critic Agent Validation | 04-test-strategy-critic.md | 13 | Frontmatter, 8 mandatory checks, output format, severity classification |
| Refiner Agent Validation | 04-test-strategy-refiner.md | 12 | Frontmatter, fix strategies, change log, escalation protocol |
| Creator Awareness | 04-test-design-engineer.md | 8 | DEBATE_CONTEXT detection, round labeling, single-agent fallback |
| Skills Manifest | skills-manifest.json | 10 | Agent entries, skill assignments, invariants, schema |
| DEBATE_ROUTING | 00-sdlc-orchestrator.md | 10 | Row presence, agent mapping, artifacts, critical artifact |

**Execution**: `node --test src/claude/hooks/tests/test-strategy-debate-team.test.cjs`

### Level 2: Integration Tests (20% -- ~17 tests)

Validate cross-module consistency and pattern compliance.

| Test Group | Scope | Tests | Description |
|------------|-------|-------|-------------|
| Cross-Module Consistency | All agent files + manifest + orchestrator | 8 | Skill IDs match between agents and manifest, agent names consistent across files |
| Pattern Compliance | All debate teams (01, 03, 04, 05) | 5 | New agents follow established patterns from existing debate teams |
| Regression Guards | Existing debate team entries | 4 | Existing Phase 01/03/04 entries unchanged after adding Phase 05 |

### Level 3: Edge Case / Boundary Tests (10% -- ~10 tests)

Validate error handling, boundary conditions, and defensive behaviors.

| Test Group | Scope | Tests | Description |
|------------|-------|-------|-------------|
| Missing File Handling | Agent file read failures | 3 | Graceful handling when expected files do not exist |
| Malformed Content | Agent files with missing fields | 4 | Frontmatter without required fields, empty content |
| Boundary Conditions | Manifest edge cases | 3 | Empty skills array, duplicate agent entries, skill count mismatch |

---

## Flaky Test Mitigation

All tests in this suite are deterministic file-read tests with zero flaky risk:

| Risk Category | Applicable? | Mitigation |
|---------------|-------------|------------|
| Timing-dependent | No | All tests are synchronous file reads |
| External services | No | No network calls; all file-system reads |
| Random data | No | No random data generation |
| Shared mutable state | No | Each test reads files independently; no global state mutation |

The test file reads source files from the repository (not temp directories) because it validates artifact content, not hook behavior. This eliminates filesystem setup/teardown overhead and shared-state risks.

---

## Performance Test Plan

Not applicable for this feature. NFR-03 (convergence within 3 rounds) is a behavioral constraint enforced by the orchestrator's existing debate loop logic. The tests validate the *structure* of the agents that participate in the debate loop, not the runtime performance of the loop itself.

---

## Test Data Strategy

### File Path Constants

```javascript
const AGENTS_DIR = join(__dirname, '..', '..', 'agents');
const CRITIC_FILE = join(AGENTS_DIR, '04-test-strategy-critic.md');
const REFINER_FILE = join(AGENTS_DIR, '04-test-strategy-refiner.md');
const CREATOR_FILE = join(AGENTS_DIR, '04-test-design-engineer.md');
const ORCHESTRATOR_FILE = join(AGENTS_DIR, '00-sdlc-orchestrator.md');
const MANIFEST_FILE = join(__dirname, '..', 'config', 'skills-manifest.json');
```

### Regex Patterns (Validation Rules)

All regex patterns are derived from `validation-rules.json` (VR-AGENT-*, VR-CRITIC-*, VR-REFINER-*, VR-ROUTING-*, VR-CREATOR-*, VR-MANIFEST-*). Each validation rule maps to one or more test cases.

### No External Fixtures Needed

The test data IS the source files themselves. Unlike hook tests that need synthetic state.json fixtures, this test suite validates real agent definition files and configuration. No fixture generators are required.

---

## Test Execution

### Commands

```bash
# Run only this test file
node --test src/claude/hooks/tests/test-strategy-debate-team.test.cjs

# Run all CJS hook tests (includes this file)
npm run test:hooks

# Run all tests
npm run test:all
```

### CI Integration

The new test file is automatically picked up by `npm run test:hooks` which globs `src/claude/hooks/tests/*.test.cjs`. No CI configuration changes needed.

---

## Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Requirement Coverage | 100% | Every FR and AC must have at least one test case |
| Validation Rule Coverage | 100% | All 34 VR-* rules from validation-rules.json mapped to tests |
| Test Count | 85+ | Comprehensive coverage including negative and boundary tests |
| Test Types | Unit + Integration + Edge Case | Three-level pyramid |
| Zero Regression | 0 test failures | NFR-04: no existing test breakage |
