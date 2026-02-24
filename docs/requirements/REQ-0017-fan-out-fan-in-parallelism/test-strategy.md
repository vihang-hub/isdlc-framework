# Test Strategy: Fan-Out/Fan-In Parallelism (REQ-0017)

**Phase**: 05-test-strategy
**Created**: 2026-02-15
**Author**: Test Design Engineer (Agent 05)
**Status**: Draft
**Traces**: FR-001 through FR-007, NFR-001 through NFR-004

---

## 1. Executive Summary

This test strategy covers the fan-out/fan-in parallelism feature for Phase 16 (Quality Loop) and Phase 08 (Code Review). Because the implementation is a **markdown protocol** (not executable code), the test approach is fundamentally different from typical unit testing. The testable surface area consists of:

1. **Skills manifest registration** -- JSON validation (QL-012 entry in skills-manifest.json)
2. **CLI flag parsing** -- `--no-fan-out` flag in isdlc.md, verified via existing CJS hook tests that parse state.json flags
3. **Agent markdown content validation** -- Verifying the protocol sections exist and are complete in the modified agent files
4. **Protocol contract validation** -- JSON schema contracts (chunk splitter I/O, spawner, merger) are structurally sound
5. **State.json schema validation** -- The fan_out configuration section conforms to the defined schema

---

## 2. Existing Infrastructure (Leveraged)

| Component | Status | Notes |
|-----------|--------|-------|
| **Framework** | node:test + node:assert/strict | Node.js built-in test runner |
| **CJS test stream** | `npm run test:hooks` | Hook-level tests in `src/claude/hooks/tests/*.test.cjs` |
| **ESM test stream** | `npm test` | Lib-level tests in `lib/*.test.js` |
| **Test helpers** | `hook-test-utils.cjs` | setupTestEnv, cleanupTestEnv, writeState, readState, writeConfig, runHook, prepareHook |
| **Current test count** | 555+ baseline | Per constitution Article II |
| **Naming convention** | `test-{module}.test.cjs` (CJS), `{module}.test.js` (ESM) | Follow existing patterns |

**Strategy**: Extend existing test suite. DO NOT replace infrastructure or introduce new frameworks.

---

## 3. Test Types and Approach

### 3.1 Unit Tests (CJS -- skills-manifest.json validation)

**Purpose**: Verify the skills-manifest.json has the correct QL-012 registration after implementation.

**Approach**: CJS test that reads the manifest file and validates:
- `ownership.quality-loop-engineer.skills` includes `"QL-012"`
- `ownership.quality-loop-engineer.skill_count` is 12
- `skill_lookup["QL-012"]` equals `"quality-loop-engineer"`
- `path_lookup["quality-loop/fan-out-engine"]` equals `"quality-loop-engineer"`
- `total_skills` incremented from 242 to 243

**File**: `src/claude/hooks/tests/test-fan-out-manifest.test.cjs`
**Count**: 6 test cases

### 3.2 Unit Tests (CJS -- flag parsing via state.json)

**Purpose**: Verify the `--no-fan-out` flag is correctly stored in state.json and consumed by hook infrastructure.

**Approach**: CJS tests using existing hook-test-utils that create state.json with `active_workflow.flags.no_fan_out` and verify hooks read the flag correctly. These test the flag's presence and effect on the state object, not the isdlc.md parsing itself (which is a markdown protocol executed by the orchestrator).

**File**: `src/claude/hooks/tests/test-fan-out-config.test.cjs`
**Count**: 10 test cases

### 3.3 Content Validation Tests (CJS -- agent markdown verification)

**Purpose**: Verify that the agent markdown files contain the required protocol sections after implementation. This is the primary mechanism for testing a markdown protocol -- asserting that required content is present.

**Approach**: CJS tests that read the actual markdown files from `src/claude/agents/` and verify presence of required protocol sections, key terms, threshold values, and contract references.

**File**: `src/claude/hooks/tests/test-fan-out-protocol.test.cjs`
**Count**: 18 test cases

### 3.4 Integration Tests (CJS -- cross-component consistency)

**Purpose**: Verify consistency across all modified files -- the agent files reference the correct skill ID, the manifest has the matching entry, the interface spec matches the agent protocol sections, and the state schema is consistent.

**Approach**: CJS tests that read multiple files and cross-validate references, threshold values, and schema definitions.

**File**: `src/claude/hooks/tests/test-fan-out-integration.test.cjs`
**Count**: 12 test cases

### 3.5 Contract Schema Tests (CJS -- JSON schema validation)

**Purpose**: Verify the JSON contracts defined in the interface specification and validation rules are internally consistent (no contradictions, all required fields documented, enum values complete).

**Approach**: Read the validation-rules.json file and verify all rules are self-consistent. Also validate that sample JSON payloads from the interface spec conform to the stated contracts.

**Integrated into**: `test-fan-out-protocol.test.cjs` and `test-fan-out-integration.test.cjs`

### 3.6 Test Types NOT Applicable

| Type | Reason for Exclusion |
|------|---------------------|
| **E2E tests** | The fan-out engine is a markdown protocol -- there is no running server or API |
| **Performance tests** | NFR-001 concerns wall-clock time of parallel Task calls, which cannot be tested without running actual multi-agent workflows |
| **Security tests** | No new executable code paths, no new inputs from external sources |
| **Mutation tests** | Not applicable to markdown content -- mutation testing targets executable code |

---

## 4. Coverage Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Requirement coverage | 100% (11/11) | Every FR and NFR mapped to at least one test case |
| Acceptance criteria coverage | 100% (35/35) | Every AC has a direct test case |
| Test file count | 4 new CJS test files | Follows existing `test-{name}.test.cjs` convention |
| New test count | 46 test cases | Net addition to the 555+ baseline |
| Manifest validation | 100% | All 5 registration points verified |
| Protocol section coverage | 100% | Every required section in every modified file verified |
| Cross-component consistency | 100% | All file-to-file references validated |

---

## 5. Critical Paths (100% Coverage Required)

Per constitution Article II, critical paths require 100% coverage:

1. **Skills manifest registration**: gate-blocker.cjs and skill-validator.cjs read the manifest at runtime. An incorrect entry could block or misroute skill validation.
2. **Flag parsing storage in state.json**: The `no_fan_out` flag persists in state and is read by phase agents. Incorrect storage breaks the opt-out mechanism.
3. **Backward compatibility**: Below-threshold behavior must be identical to current behavior. Protocol must explicitly skip fan-out when thresholds are not met.
4. **Merged output schema compatibility**: The merged output must use identical fields to single-agent output. Gate-blocker must not be affected by additive fields.

---

## 6. Test Data Strategy

### 6.1 Skills Manifest Test Data
- The real `skills-manifest.json` from `src/claude/hooks/config/` (copied to temp dir by hook-test-utils)
- Mutated variants with missing QL-012, incorrect skill_count, missing path_lookup

### 6.2 State.json Fan-Out Config Test Data
- Empty state (no `fan_out` section) -- tests defaults
- Complete `fan_out` section with all fields -- tests full config
- Invalid `max_agents` values (0, 9, -1, "string") -- tests validation
- Invalid `timeout_per_chunk_ms` values (0, -1, 3600001) -- tests clamping
- `no_fan_out: true` in `active_workflow.flags` -- tests flag override
- Per-phase overrides for both `16-quality-loop` and `08-code-review`

### 6.3 Agent Markdown Test Data
- Real agent files from `src/claude/agents/` read directly
- Expected section headers, threshold values, and contract references

### 6.4 Boundary Values
| Parameter | Minimum | Below | At | Above | Maximum |
|-----------|---------|-------|-----|-------|---------|
| Test count (Phase 16) | 1 | 249 | 250 | 251 | 10000+ |
| File count (Phase 08) | 1 | 4 | 5 | 6 | 100+ |
| max_agents | 1 | -- | -- | -- | 8 |
| Chunk count | 1 | -- | -- | -- | 8 |

---

## 7. Test Commands (Existing Infrastructure)

```bash
# Run all hook tests (includes fan-out tests)
npm run test:hooks

# Run specific fan-out test file
node --test src/claude/hooks/tests/test-fan-out-manifest.test.cjs
node --test src/claude/hooks/tests/test-fan-out-config.test.cjs
node --test src/claude/hooks/tests/test-fan-out-protocol.test.cjs
node --test src/claude/hooks/tests/test-fan-out-integration.test.cjs

# Run all tests (ESM + CJS)
npm run test:all
```

---

## 8. Test Organization

```
src/claude/hooks/tests/
  test-fan-out-manifest.test.cjs      # Skills manifest QL-012 registration (6 tests)
  test-fan-out-config.test.cjs        # State.json fan_out config + flag (10 tests)
  test-fan-out-protocol.test.cjs      # Agent markdown protocol validation (18 tests)
  test-fan-out-integration.test.cjs   # Cross-component consistency (12 tests)
```

All test files follow the project's CJS convention:
- `'use strict';` header
- `require('node:test')` and `require('node:assert/strict')`
- `require('./hook-test-utils.cjs')` for shared utilities
- `describe/it/beforeEach/afterEach` pattern
- Temp directory isolation via `setupTestEnv()`/`cleanupTestEnv()`

---

## 9. Requirement-to-Test Mapping Summary

| Requirement | Test File(s) | Test Count | Coverage |
|-------------|-------------|------------|----------|
| FR-001 | manifest, protocol, integration | 7 | 100% |
| FR-002 | protocol, integration | 6 | 100% |
| FR-003 | protocol, integration | 5 | 100% |
| FR-004 | protocol, integration | 5 | 100% |
| FR-005 | protocol, integration | 7 | 100% |
| FR-006 | protocol, integration | 7 | 100% |
| FR-007 | config, manifest, protocol | 5 | 100% |
| NFR-001 | protocol | 2 | 100% |
| NFR-002 | protocol | 2 | 100% |
| NFR-003 | protocol, integration | 3 | 100% |
| NFR-004 | protocol, integration | 2 | 100% |

Total: 46 test cases covering all 11 requirements (100% coverage).

See `traceability-matrix.csv` for the full mapping.

---

## 10. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Markdown protocol cannot be unit-tested like code | Content validation tests verify protocol sections exist, are complete, and reference correct contracts |
| Skills manifest corruption blocks all workflows | 6 dedicated manifest tests, plus cross-validation with agent files |
| Flag not persisted correctly | Direct state.json read/write tests using hook-test-utils |
| Protocol sections inconsistent between agents | Integration tests cross-validate Phase 16 and Phase 08 sections |
| Threshold values drift between spec and implementation | Integration tests read both spec and agent files to compare values |

---

## 11. Assumptions

1. Implementation will modify the files listed in component-spec.md (no new executable code files)
2. The skills-manifest.json will be the only config file modified
3. The agent markdown files will contain machine-readable section headers that can be matched with regex
4. The existing hook-test-utils.cjs patterns are sufficient for all test needs
5. The validation-rules.json will be committed alongside the implementation

---

## 12. Constitution Compliance

| Article | Compliance | Evidence |
|---------|-----------|----------|
| **II (Test-First)** | PASS | Test strategy designed before implementation; 46 test cases defined |
| **VII (Traceability)** | PASS | 100% requirement-to-test mapping in traceability-matrix.csv |
| **IX (Quality Gates)** | PASS | GATE-04 checklist items all addressed |
| **XI (Integration Testing)** | PASS | 12 integration tests validate cross-component interactions |
