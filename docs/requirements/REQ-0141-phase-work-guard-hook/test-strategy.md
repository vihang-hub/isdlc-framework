# Test Strategy: Execution Contract System

**Slug**: REQ-0141-phase-work-guard-hook
**Phase**: 05 - Test Strategy & Design
**Version**: 1.0.0

---

## 1. Existing Infrastructure (from test evaluation)

- **Framework**: Node.js built-in test runner (`node:test`)
- **Module Systems**: ESM for `tests/core/**/*.test.js` (runs via `npm run test:core`), CJS for `src/claude/hooks/tests/*.test.cjs` (runs via `npm run test:hooks`)
- **Existing Patterns**: Core validators follow `tests/core/validators/{module}.test.js` naming; hook tests follow `src/claude/hooks/tests/{feature}.test.cjs`
- **Assertion Library**: `node:assert/strict`
- **Coverage Tool**: None configured (no c8/istanbul)
- **Current Test Count**: 1300+ tests across all suites (ESM lib, CJS hooks, core, characterization, e2e, providers)
- **Existing Validator Tests**: 13 test files in `tests/core/validators/` covering gate-logic, enforcement, constitutional checks, traceability, coverage, phase validation

## 2. Strategy for This Requirement

- **Approach**: Extend existing test suite -- add new test files alongside existing validator tests and hook tests
- **New Test Types Needed**: Unit tests (all 7 modules), integration tests (evaluator pipeline, cross-provider parity, generator end-to-end), performance tests (evaluation latency)
- **Coverage Target**: >=80% unit (standard intensity per Article II), 100% for critical paths (evaluator, state helpers, loader override resolution)
- **Test Run Command**: `npm run test:core` for ESM core modules, `npm run test:hooks` for CJS state helpers
- **Mutation Testing**: Required per Article XI -- Stryker configured for new modules

---

## 3. Test Pyramid

### 3.1 Unit Tests (Foundation)

Unit tests are the primary layer. Every new module gets its own dedicated test file. All modules are designed as pure functions or have minimal I/O, making them highly unit-testable.

| Module | Test File | Estimated Tests | Priority |
|--------|-----------|-----------------|----------|
| Contract Schema | `tests/core/validators/contract-schema.test.js` | 18-22 | P0 |
| Contract Loader | `tests/core/validators/contract-loader.test.js` | 20-25 | P0 |
| Contract Evaluator | `tests/core/validators/contract-evaluator.test.js` | 35-45 | P0 |
| Reference Resolver | `tests/core/validators/contract-ref-resolver.test.js` | 15-18 | P0 |
| State Helpers | `src/claude/hooks/tests/contract-state-helpers.test.cjs` | 18-22 | P0 |
| Contract Generator | `tests/core/validators/contract-generator.test.js` | 25-30 | P1 |
| PHASE_AGENT_MAP Export Guard | `src/claude/hooks/tests/phase-agent-map-guard.test.cjs` | 5-8 | P0 |

**Total estimated unit tests**: 136-170

### 3.2 Integration Tests (Middle)

Integration tests verify multi-module interactions. The contract system has a clear pipeline: load -> resolve refs -> evaluate -> report violations.

| Integration Scope | Test File | Estimated Tests | Priority |
|-------------------|-----------|-----------------|----------|
| Evaluator Pipeline (load + resolve + evaluate) | `tests/core/validators/contract-evaluator-integration.test.js` | 10-12 | P0 |
| Cross-Provider Parity (Claude vs Codex paths) | `tests/core/validators/contract-cross-provider.test.js` | 6-8 | P1 |
| Generator End-to-End (read config -> produce contracts) | `tests/core/validators/contract-generator-e2e.test.js` | 8-10 | P1 |
| Override Resolution (shipped + user contracts) | `tests/core/validators/contract-override-resolution.test.js` | 8-10 | P1 |

**Total estimated integration tests**: 32-40

### 3.3 Performance Tests (Enforcement)

Performance tests enforce the <2 second evaluation budget and <100ms staleness check.

| Performance Scope | Test File | Estimated Tests |
|-------------------|-----------|-----------------|
| Evaluation Latency | `tests/core/validators/contract-performance.test.js` | 4-6 |
| Staleness Hash Check | Same file | 2-3 |

**Total estimated performance tests**: 6-9

### 3.4 Security Tests

No dedicated security test file needed. Security concerns are addressed within unit tests:
- Path traversal prevention in loader (tested in loader unit tests)
- Malformed contract input handling (tested in schema and evaluator unit tests)
- Fail-open behavior on all error paths (tested in evaluator unit tests)

### 3.5 E2E Tests

E2E tests for the contract system are deferred. The evaluator runs within the phase-loop controller (Claude) and `validatePhaseGate()` (Codex) -- these are tested via existing characterization tests and manual workflow execution. The generator CLI is tested end-to-end in the integration layer.

---

## 4. Test Case Specifications

### 4.1 Contract Schema (`contract-schema.test.js`)

**Traces**: FR-001 (AC-001-01 through AC-001-05)

#### Positive Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CS-01 | validateContract accepts a well-formed contract with version, entries[], _generation_metadata | AC-001-01 | positive |
| CS-02 | validateContractEntry accepts entry with all required fields: execution_unit, context, expectations, violation_response | AC-001-01 | positive |
| CS-03 | validateContractEntry accepts expectations with all sub-fields: agent, skills_required, artifacts_produced, state_assertions, cleanup, presentation | AC-001-02 | positive |
| CS-04 | validateContractEntry accepts violation_response with valid values: block, warn, report | AC-001-03 | positive |
| CS-05 | validateContractEntry accepts non-workflow execution_unit values: "roundtable", "discover", "add-item" | AC-001-04 | positive |
| CS-06 | validateContractEntry accepts $ref objects in skills_required and artifacts_produced | AC-001-05 | positive |
| CS-07 | validateContractEntry accepts null for optional expectations fields (agent, skills_required, artifacts_produced) | AC-001-02 | positive |
| CS-08 | validateContractEntry accepts presentation section with all sub-fields | AC-001-02 | positive |

#### Negative Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CS-09 | validateContract rejects contract without version field | AC-001-01 | negative |
| CS-10 | validateContract rejects contract without entries array | AC-001-01 | negative |
| CS-11 | validateContractEntry rejects entry missing execution_unit | AC-001-01 | negative |
| CS-12 | validateContractEntry rejects entry missing context | AC-001-01 | negative |
| CS-13 | validateContractEntry rejects entry missing expectations | AC-001-01 | negative |
| CS-14 | validateContractEntry rejects entry missing violation_response | AC-001-01 | negative |
| CS-15 | validateContractEntry rejects violation_response with invalid value (not block/warn/report) | AC-001-03 | negative |
| CS-16 | validateContractEntry rejects state_assertions without path field | AC-001-02 | negative |
| CS-17 | validateContractEntry rejects state_assertions without equals field | AC-001-02 | negative |
| CS-18 | validateContract rejects non-object input (string, number, null) | AC-001-01 | negative |

#### Boundary Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CS-19 | validateContract accepts contract with empty entries array | AC-001-01 | boundary |
| CS-20 | validateContractEntry accepts entry with empty state_assertions array | AC-001-02 | boundary |
| CS-21 | validateContractEntry accepts entry with empty cleanup array | AC-001-02 | boundary |

---

### 4.2 Contract Loader (`contract-loader.test.js`)

**Traces**: FR-002 (AC-002-01 through AC-002-06), FR-006 (AC-006-01 through AC-006-04), FR-008 (AC-008-03)

#### Positive Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CL-01 | loadContractEntry returns entry from shipped contracts when no override exists | AC-002-01 | positive |
| CL-02 | loadContractEntry returns entry from override contracts when override exists | AC-008-03 | positive |
| CL-03 | loadContractEntry returns source: 'shipped' for shipped contracts | AC-002-01 | positive |
| CL-04 | loadContractEntry returns source: 'override' for override contracts | AC-008-03 | positive |
| CL-05 | loadContractEntry matches by execution_unit + context key | AC-002-01 | positive |
| CL-06 | checkStaleness returns stale: false when hashes match | AC-006-01 | positive |
| CL-07 | checkStaleness returns stale: true with changed file list when hashes differ | AC-006-01, AC-006-02 | positive |
| CL-08 | loadContractEntry detects staleness and sets stale: true in return value | AC-006-01 | positive |
| CL-09 | loadContractEntry reads _generation_metadata.input_files for hash check | AC-006-01 | positive |

#### Negative Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CL-10 | loadContractEntry returns { entry: null, source: null } when no contract found | AC-002-01 | negative |
| CL-11 | loadContractEntry handles malformed JSON in contract file gracefully | FR-003/AC-003-07 | negative |
| CL-12 | loadContractEntry handles missing shipped contracts directory | FR-003/AC-003-07 | negative |
| CL-13 | loadContractEntry handles missing override contracts directory | FR-003/AC-003-07 | negative |
| CL-14 | checkStaleness handles missing input file (file deleted after generation) | AC-006-03 | negative |
| CL-15 | checkStaleness handles unreadable input file | AC-006-03 | negative |

#### Override Resolution Tests (ADR-007)

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CL-16 | Override replaces shipped entry completely (full replacement, not deep merge) | AC-008-03 | positive |
| CL-17 | Override for one execution_unit does not affect other execution_units | AC-008-03 | positive |
| CL-18 | Shipped entry used when override file exists but has no matching entry | AC-008-03 | positive |
| CL-19 | Multiple contract files scanned correctly (workflow-feature.contract.json, workflow-fix.contract.json, etc.) | AC-002-01 | positive |

#### Performance Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CL-20 | checkStaleness completes in under 100ms for typical input set (5-7 files) | AC-006-04 | performance |

---

### 4.3 Reference Resolver (`contract-ref-resolver.test.js`)

**Traces**: FR-001 (AC-001-05), FR-003 (AC-003-04, AC-003-05)

#### Positive Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| RR-01 | resolveRef resolves artifact-paths $ref to array of file paths for a given phase | AC-003-05 | positive |
| RR-02 | resolveRef resolves skills-manifest $ref to array of skill IDs for a given agent | AC-003-04 | positive |
| RR-03 | resolveRef substitutes {artifact_folder} in resolved artifact paths | AC-003-05 | positive |
| RR-04 | resolveRef uses cache for repeated config file reads | AC-001-05 | positive |
| RR-05 | registerResolver adds a new resolver that resolveRef can invoke | AC-001-05 | positive |
| RR-06 | resolveRef with custom resolver returns expected value | AC-001-05 | positive |

#### Negative Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| RR-07 | resolveRef returns empty array when $ref source is unregistered | AC-001-05 | negative |
| RR-08 | resolveRef returns empty array when config file is missing | AC-003-04 | negative |
| RR-09 | resolveRef returns empty array when config file is malformed JSON | AC-003-04 | negative |
| RR-10 | resolveRef handles null/undefined ref input gracefully | AC-001-05 | negative |
| RR-11 | resolveRef handles ref without $ref key | AC-001-05 | negative |

#### Boundary Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| RR-12 | resolveRef returns empty array when phase has no artifacts in artifact-paths.json | AC-003-05 | boundary |
| RR-13 | resolveRef returns empty array when agent has no skills in skills-manifest.json | AC-003-04 | boundary |
| RR-14 | Cache is isolated per evaluation cycle (new Map each time) | AC-001-05 | boundary |

---

### 4.4 Contract Evaluator (`contract-evaluator.test.js`)

**Traces**: FR-003 (AC-003-01 through AC-003-08), FR-009 (AC-009-01 through AC-009-06)

#### Agent Engagement Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CE-01 | Detects agent_not_engaged when skill_usage_log has no delegation for expected agent | AC-003-03 | positive |
| CE-02 | No violation when skill_usage_log contains delegation matching expected agent | AC-003-03 | positive |
| CE-03 | Skips agent check when expectations.agent is null | AC-003-03 | positive |

#### Skills Required Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CE-04 | Detects skills_missing when required skill not in skill_usage_log | AC-003-04 | positive |
| CE-05 | No violation when all required skills appear in skill_usage_log | AC-003-04 | positive |
| CE-06 | Produces one violation per missing skill (not one for all) | AC-003-04 | positive |
| CE-07 | Skips skills check when expectations.skills_required is null | AC-003-04 | positive |

#### Artifacts Produced Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CE-08 | Detects artifacts_missing when expected file does not exist on disk | AC-003-05 | positive |
| CE-09 | No violation when all expected artifact files exist on disk | AC-003-05 | positive |
| CE-10 | Substitutes {artifact_folder} in artifact paths before checking | AC-003-05 | positive |
| CE-11 | Skips artifacts check when expectations.artifacts_produced is null | AC-003-05 | positive |

#### State Assertions Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CE-12 | Detects state_incomplete when state path value does not equal expected | AC-003-06 | positive |
| CE-13 | No violation when all state assertions pass | AC-003-06 | positive |
| CE-14 | Traverses nested state paths via dot-notation (e.g., "phases.06-implementation.status") | AC-003-06 | positive |
| CE-15 | Handles missing state path gracefully (warning, not crash) | AC-003-06 | positive |

#### Presentation Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CE-16 | Detects presentation_violated when confirmation_sequence not followed | AC-009-02 | positive |
| CE-17 | Detects presentation_violated when persona_format not matched | AC-009-05 | positive |
| CE-18 | No violation when presentation expectations met | AC-009-01 | positive |
| CE-19 | Skips presentation check when expectations.presentation is null | AC-009-01 | positive |
| CE-20 | Checks completion_summary for non-workflow contexts | AC-009-06 | positive |
| CE-21 | Checks progress_format for workflow contexts | AC-009-04 | positive |

#### Cleanup Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CE-22 | Uncheckable cleanup items produce warnings, not violations | FR-003 | positive |
| CE-23 | Checkable cleanup items (tasks.md section complete) produce violation if unmet | FR-003 | positive |

#### Violation Shape Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CE-24 | Each violation contains required fields: contract_id, execution_unit, expectation_type, expected, actual, severity, configured_response | AC-004-02 | positive |
| CE-25 | Severity in violation matches violation_response from contract entry | AC-008-01 | positive |

#### Fail-Open Tests (Article X)

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CE-26 | Malformed contract entry returns empty violations with warning | AC-003-07 | negative |
| CE-27 | Missing config file during $ref resolution skips check with warning | AC-003-07 | negative |
| CE-28 | State missing expected fields skips assertion with warning | AC-003-07 | negative |
| CE-29 | Thrown exception caught, returns empty violations with warning | AC-003-07 | negative |
| CE-30 | Stale contract flag returned but execution not blocked | AC-006-03 | negative |

#### Return Shape Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CE-31 | evaluateContract returns { violations: [], warnings: [], stale_contract: boolean } | AC-003-01 | positive |
| CE-32 | evaluateContract with no issues returns empty violations and warnings | AC-003-01 | positive |

#### Performance Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CE-33 | Full evaluation completes in under 2 seconds | AC-003-08 | performance |
| CE-34 | Evaluation of contract with 20 state assertions completes in under 500ms | AC-003-08 | performance |

---

### 4.5 State Helpers (`contract-state-helpers.test.cjs`)

**Traces**: FR-004 (AC-004-01 through AC-004-05)

#### writeContractViolation Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| SH-01 | Appends violation entry to state.contract_violations[] | AC-004-01 | positive |
| SH-02 | Initializes contract_violations array if missing from state | AC-004-01 | positive |
| SH-03 | Deduplicates by contract_id + expectation_type | AC-004-01 | positive |
| SH-04 | FIFO cap at 20 entries -- oldest evicted when cap exceeded | AC-004-01 | positive |
| SH-05 | Written entry contains all required fields: contract_id, execution_unit, expected, actual, severity, configured_response | AC-004-02 | positive |
| SH-06 | Is a pure in-memory mutator -- does not write to disk | AC-004-03 | positive |
| SH-07 | Handles corrupt contract_violations (non-array) by reinitializing | AC-004-01 | negative |

#### readContractViolations Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| SH-08 | Returns contract_violations array from state | AC-004-04 | positive |
| SH-09 | Returns empty array when contract_violations is missing | AC-004-04 | negative |
| SH-10 | Returns empty array when contract_violations is malformed (non-array) | AC-004-04 | negative |
| SH-11 | Does not mutate state | AC-004-04 | positive |

#### clearContractViolations Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| SH-12 | Sets state.contract_violations to empty array | AC-004-04 | positive |
| SH-13 | Is a pure in-memory mutator -- does not write to disk | AC-004-04 | positive |
| SH-14 | Handles missing contract_violations without error | AC-004-04 | negative |

#### FIFO and Dedup Boundary Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| SH-15 | At exactly 20 entries, no eviction occurs | AC-004-01 | boundary |
| SH-16 | At 21 entries, oldest entry is evicted | AC-004-01 | boundary |
| SH-17 | Duplicate entry updates timestamp but does not add second copy | AC-004-01 | boundary |
| SH-18 | Same contract_id with different expectation_type is NOT a duplicate | AC-004-01 | boundary |

---

### 4.6 Contract Generator (`contract-generator.test.js`)

**Traces**: FR-002 (AC-002-01 through AC-002-06), FR-007 (AC-007-01 through AC-007-04)

#### Generation Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CG-01 | Generates workflow-feature.contract.json with entries for all feature workflow phases | AC-002-01 | positive |
| CG-02 | Generates workflow-fix.contract.json with entries for all fix workflow phases | AC-002-01 | positive |
| CG-03 | Generates analyze.contract.json with roundtable execution unit | AC-007-02 | positive |
| CG-04 | Generates discover.contract.json with discover execution unit | AC-007-03 | positive |
| CG-05 | Generates add.contract.json with add-item execution unit | AC-007-01 | positive |
| CG-06 | Each generated entry has valid schema (passes validateContract) | AC-002-01 | positive |

#### Determinism Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CG-07 | Same config inputs produce byte-identical output on two runs | AC-002-03 | positive |
| CG-08 | Entries are sorted by execution_unit + context | AC-002-03 | positive |
| CG-09 | JSON output uses sorted keys (deterministic serialization) | AC-002-03 | positive |

#### Metadata Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CG-10 | Generated contracts contain _generation_metadata with generated_at, input_files, generator_version | AC-002-04 | positive |
| CG-11 | input_files contains SHA-256 hashes for each source file | AC-002-04 | positive |
| CG-12 | generator_version matches package.json version | AC-002-04 | positive |

#### Config Source Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CG-13 | Generator imports PHASE_AGENT_MAP from common.cjs | AC-002-05 | positive |
| CG-14 | Generator reads artifact-paths.json as single authority for artifacts | AC-002-06 | positive |
| CG-15 | Generator reads skills-manifest.json for skill expectations | AC-002-01 | positive |
| CG-16 | Generator reads roundtable.yaml for analyze contract expectations | AC-007-04 | positive |
| CG-17 | Generator reads external-skills-manifest.json for discover contract | AC-007-03 | positive |

#### Non-Workflow Coverage Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CG-18 | Add contract checks: folder created, draft.md written, meta.json written, BACKLOG.md updated | AC-007-01 | positive |
| CG-19 | Analyze contract reflects configured personas from roundtable.yaml | AC-007-02, AC-007-04 | positive |
| CG-20 | Discover contract checks external skill injection | AC-007-03 | positive |

#### Negative Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CG-21 | Generator fails with clear error if PHASE_AGENT_MAP export is missing | AC-002-05 | negative |
| CG-22 | Generator handles missing optional config files with warning | AC-002-01 | negative |
| CG-23 | Generator handles malformed roundtable.yaml gracefully | AC-007-04 | negative |

#### Output Path Tests

| ID | Description | AC | Type |
|----|-------------|-----|------|
| CG-24 | Default output writes to .claude/hooks/config/contracts/ | AC-002-01 | positive |
| CG-25 | --output flag writes to specified directory | AC-002-02 | positive |

---

### 4.7 PHASE_AGENT_MAP Export Guard (`phase-agent-map-guard.test.cjs`)

**Traces**: FR-002 (AC-002-05), ADR-006

| ID | Description | AC | Type |
|----|-------------|-----|------|
| PM-01 | PHASE_AGENT_MAP is exported from common.cjs | AC-002-05 | positive |
| PM-02 | PHASE_AGENT_MAP is a non-empty object | AC-002-05 | positive |
| PM-03 | PHASE_AGENT_MAP contains all expected phase keys (01 through 13, plus 16) | AC-002-05 | positive |
| PM-04 | Each PHASE_AGENT_MAP value is a non-empty string (agent name) | AC-002-05 | positive |
| PM-05 | PHASE_AGENT_MAP contains at least 14 entries (guarding regression) | AC-002-05 | positive |

---

### 4.8 Orchestrator Remediation Tests

**Traces**: FR-005 (AC-005-01 through AC-005-05)

These are tested at the integration level since remediation involves the phase-loop controller reading contract_violations and dispatching actions.

| ID | Description | AC | Type |
|----|-------------|-----|------|
| OR-01 | Block violation triggers retry/re-invocation logic | AC-005-02 | integration |
| OR-02 | Warn violation displays banner and continues to next phase | AC-005-03 | integration |
| OR-03 | Report violation is logged, orchestrator continues | AC-005-04 | integration |
| OR-04 | clearContractViolations called after remediation completes | AC-005-05 | integration |
| OR-05 | Phase-loop reads contract_violations after evaluation | AC-005-01 | integration |

---

### 4.9 Configurable Violation Response Tests

**Traces**: FR-008 (AC-008-01, AC-008-02)

| ID | Description | AC | Type |
|----|-------------|-----|------|
| VR-01 | Default violation responses: agent_not_engaged=block, artifacts_missing=block, skills_missing=report, state_incomplete=report, cleanup_skipped=warn | AC-008-02 | positive |
| VR-02 | Each expectation type has independent response level | AC-008-01 | positive |
| VR-03 | Evaluator uses violation_response from contract entry (not hardcoded defaults) | AC-008-01 | positive |

---

### 4.10 Violation Banner Format Tests

**Traces**: FR-009 (AC-009-03)

| ID | Description | AC | Type |
|----|-------------|-----|------|
| VB-01 | Violation banner follows standard format: CONTRACT VIOLATION header, Expected, Actual, Response | AC-009-03 | positive |
| VB-02 | Banner format is consistent across all violation types | AC-009-03 | positive |

---

## 5. Integration Test Specifications

### 5.1 Evaluator Pipeline Integration (`contract-evaluator-integration.test.js`)

Tests the full load -> resolve -> evaluate -> report pipeline with real config files.

| ID | Description | Modules Involved | Type |
|----|-------------|-----------------|------|
| EI-01 | Full evaluation of a well-formed contract against compliant state produces zero violations | Loader, Resolver, Evaluator | positive |
| EI-02 | Full evaluation of a contract against non-compliant state produces correct violations | Loader, Resolver, Evaluator | positive |
| EI-03 | Stale contract detected via hash mismatch but evaluation proceeds | Loader, Evaluator | positive |
| EI-04 | Override contract loaded and evaluated instead of shipped default | Loader, Evaluator | positive |
| EI-05 | $ref resolution uses cached config (no double read) | Resolver, Evaluator | positive |
| EI-06 | Violations written to state via writeContractViolation after evaluation | Evaluator, State Helpers | positive |
| EI-07 | Multiple violation types from single evaluation (agent + artifacts) | Evaluator | positive |
| EI-08 | Non-workflow context (analyze) evaluates correctly | Loader, Evaluator | positive |
| EI-09 | Non-workflow context (discover) evaluates correctly | Loader, Evaluator | positive |
| EI-10 | Non-workflow context (add) evaluates correctly | Loader, Evaluator | positive |

### 5.2 Cross-Provider Parity Integration (`contract-cross-provider.test.js`)

Verifies that the same contract, evaluated through Claude-path and Codex-path adapters, produces identical results.

| ID | Description | Type |
|----|-------------|------|
| CP-01 | Same contract + state produces identical violations through both code paths | positive |
| CP-02 | Same contract + state produces identical warnings through both code paths | positive |
| CP-03 | Same stale_contract flag through both code paths | positive |
| CP-04 | Codex validatePhaseGate merges contract result correctly with phase validation result | positive |
| CP-05 | Block violations in contract cause validatePhaseGate to return pass: false | positive |
| CP-06 | Warn violations in contract do not affect validatePhaseGate pass status | positive |

### 5.3 Generator End-to-End (`contract-generator-e2e.test.js`)

Runs the generator against real config files and validates output.

| ID | Description | Type |
|----|-------------|------|
| GE-01 | Generator produces valid contract files readable by loader | positive |
| GE-02 | Generated contracts pass schema validation | positive |
| GE-03 | Generated contracts for feature workflow have entries for all expected phases | positive |
| GE-04 | Generated analyze contract reflects current roundtable.yaml | positive |
| GE-05 | Regeneration after config modification produces different hash in metadata | positive |
| GE-06 | Generated contracts are loadable by evaluator for full pipeline test | positive |
| GE-07 | Generator respects --output flag for alternate directory | positive |
| GE-08 | Generator with missing PHASE_AGENT_MAP export fails with clear error | negative |

### 5.4 Override Resolution Integration (`contract-override-resolution.test.js`)

Tests the full override precedence chain with real file system structures.

| ID | Description | Type |
|----|-------------|------|
| OV-01 | Override in .isdlc/config/contracts/ takes precedence over .claude/hooks/config/contracts/ | positive |
| OV-02 | Full replacement verified -- no fields from shipped entry leak into override result | positive |
| OV-03 | Unmatched execution_unit in override does not affect other entries | positive |
| OV-04 | Empty override directory falls back to shipped contracts | positive |
| OV-05 | Override for one workflow type does not affect other workflow types | positive |
| OV-06 | Override with different violation_response is used in evaluation | positive |
| OV-07 | Removing override causes fallback to shipped on next load | positive |
| OV-08 | Multiple override files processed correctly | positive |

---

## 6. Flaky Test Mitigation

### 6.1 Risk Areas

| Risk | Modules Affected | Mitigation |
|------|-----------------|------------|
| File system timing | Loader, Generator | Use temp directories created fresh per test; clean up in afterEach |
| Hash non-determinism | Staleness check | Use fixed content files; verify hash algorithm is deterministic |
| Performance variability | Evaluation latency tests | Use generous thresholds (2x the requirement); mark performance tests with `{ skip: process.env.CI }` if needed |
| Config file state leakage | Generator, Loader | Each test creates isolated config directory; no shared mutable state |

### 6.2 Isolation Strategy

- Every test that touches the file system creates a unique temp directory via `mkdtemp`
- No test depends on another test's output
- State objects are created fresh per test (no shared state object)
- Config file reads are isolated via `options.shippedPath` and `options.overridePath` injection points (designed into the loader API)
- The evaluator receives state as a parameter (no file read) -- completely isolated

### 6.3 Test Ordering

- All tests are independent and can run in any order
- No `before` hooks that create shared state across tests
- Each `describe` block is self-contained

---

## 7. Performance Test Plan

### 7.1 Performance Budgets

| Metric | Budget | Measurement Method | Frequency |
|--------|--------|-------------------|-----------|
| Full contract evaluation (load + resolve + evaluate) | < 2 seconds | `performance.now()` around `evaluateContract()` | Every test run |
| Staleness hash check | < 100ms | `performance.now()` around `checkStaleness()` | Every test run |
| Contract generation (all contexts) | < 5 seconds | `performance.now()` around generator main | Integration tests |
| Single $ref resolution | < 50ms | `performance.now()` around `resolveRef()` | Unit tests |

### 7.2 Performance Test Implementation

Performance tests use Node.js built-in `performance.now()` for timing. Tests assert that elapsed time is within budget. Warm-up runs are included to eliminate JIT variance.

```js
// Pattern for performance assertions
it('PE-01: Full evaluation completes in under 2 seconds', async () => {
  // Warm-up
  evaluateContract(params);

  const start = performance.now();
  const result = evaluateContract(params);
  const elapsed = performance.now() - start;

  assert.ok(elapsed < 2000, `Evaluation took ${elapsed}ms, budget is 2000ms`);
});
```

### 7.3 Regression Detection

Performance test results are logged with timing. If a performance test fails, it indicates a regression that must be investigated before merge.

---

## 8. Test Data Plan

### 8.1 Test Fixtures Directory

Location: `tests/core/validators/fixtures/contracts/`

### 8.2 Contract Fixtures

| Fixture | Purpose | Contents |
|---------|---------|----------|
| `valid-workflow-feature.contract.json` | Valid feature workflow contract | All phases, full expectations, default violation_response |
| `valid-analyze.contract.json` | Valid analyze context contract | Roundtable execution_unit, persona expectations, presentation |
| `valid-discover.contract.json` | Valid discover context contract | Discover execution_unit, skill injection expectations |
| `valid-add.contract.json` | Valid add context contract | Add-item execution_unit, folder/file creation expectations |
| `malformed.contract.json` | Malformed contract (missing required fields) | Intentionally invalid |
| `stale.contract.json` | Contract with outdated hashes | Valid schema but hashes don't match current config |
| `override-feature-phase06.contract.json` | Override contract for one phase | Replaces shipped phase 06 entry |

### 8.3 Config Fixtures

| Fixture | Purpose |
|---------|---------|
| `artifact-paths.fixture.json` | Subset of artifact-paths.json for test isolation |
| `skills-manifest.fixture.json` | Subset of skills-manifest.json for test isolation |
| `roundtable.fixture.yaml` | Minimal roundtable config for analyze tests |

### 8.4 State Fixtures

| Fixture | Purpose |
|---------|---------|
| State object with compliant skill_usage_log | Agent engaged, skills used -- passes all checks |
| State object with missing agent delegation | Triggers agent_not_engaged violation |
| State object with missing skill entries | Triggers skills_missing violation |
| State object with incomplete state paths | Triggers state_incomplete violation |
| State object with contract_violations at cap (20) | Tests FIFO eviction |
| Empty state object | Tests graceful handling of missing fields |

### 8.5 Boundary Values

| Boundary | Test Coverage |
|----------|--------------|
| Empty contract entries array | CS-19 |
| Empty state_assertions array | CS-20 |
| Empty cleanup array | CS-21 |
| FIFO at exactly 20 entries | SH-15 |
| FIFO at 21 entries (eviction) | SH-16 |
| artifact_folder with special characters (spaces, unicode) | CE-10 |
| Deeply nested state path (5+ levels) | CE-14 |
| Zero expectations (all null) | CE-32 |

### 8.6 Invalid Inputs

| Invalid Input | Test Coverage |
|---------------|--------------|
| Non-object contract (string, number, null, array) | CS-18 |
| Contract entry missing execution_unit | CS-11 |
| Contract entry missing context | CS-12 |
| Violation response with invalid enum value | CS-15 |
| State assertion without path | CS-16 |
| $ref without $ref key | RR-11 |
| Malformed JSON in contract file | CL-11 |
| Missing config file for $ref resolution | RR-08 |
| Non-array contract_violations in state | SH-07, SH-10 |

### 8.7 Maximum-Size Inputs

| Input | Size | Test Coverage |
|-------|------|--------------|
| Contract with 50 entries (all workflow phases + non-workflow) | ~50 entries | CE-33 (performance) |
| State with 20 contract_violations at FIFO cap | 20 entries | SH-15 |
| State with 100 skill_usage_log entries | 100 entries | CE-02 (agent search in large log) |
| Contract with 20 state_assertions | 20 assertions | CE-34 (performance) |
| artifact-paths.json with 30+ phases | Full config | RR-01 |

---

## 9. Traceability Matrix

### FR-to-Test Mapping

| Requirement | ACs | Test IDs | Coverage |
|-------------|-----|----------|----------|
| FR-001 (Contract Schema) | AC-001-01 to AC-001-05 | CS-01 to CS-21 | 100% |
| FR-002 (Contract Generation) | AC-002-01 to AC-002-06 | CG-01 to CG-25, GE-01 to GE-08 | 100% |
| FR-003 (Contract Evaluation) | AC-003-01 to AC-003-08 | CE-01 to CE-34, EI-01 to EI-10 | 100% |
| FR-004 (Violation Reporting) | AC-004-01 to AC-004-05 | SH-01 to SH-18 | 100% |
| FR-005 (Orchestrator Remediation) | AC-005-01 to AC-005-05 | OR-01 to OR-05 | 100% |
| FR-006 (Config Change Detection) | AC-006-01 to AC-006-04 | CL-06 to CL-09, CL-14, CL-15, CL-20 | 100% |
| FR-007 (Non-Workflow Coverage) | AC-007-01 to AC-007-04 | CG-18 to CG-20, EI-08 to EI-10 | 100% |
| FR-008 (Configurable Violation Response) | AC-008-01 to AC-008-03 | VR-01 to VR-03, CL-16 to CL-19, OV-01 to OV-08 | 100% |
| FR-009 (UX and Presentation Contract) | AC-009-01 to AC-009-06 | CE-16 to CE-21, VB-01 to VB-02 | 100% |

### ADR-to-Test Mapping

| ADR | Key Decision | Guarding Tests |
|-----|-------------|----------------|
| ADR-001 (Core-First Evaluator) | Same evaluator for Claude and Codex | CP-01 to CP-06 |
| ADR-004 (In-Memory Mutator) | State helpers don't write to disk | SH-06, SH-13 |
| ADR-005 (Generalized Ref Resolution) | Single resolveRef function | RR-01 to RR-14 |
| ADR-006 (PHASE_AGENT_MAP Stable Export) | Export exists with guarding test | PM-01 to PM-05 |
| ADR-007 (Full Replacement Override) | No deep merge | CL-16, OV-02 |
| ADR-008 (Codex Advisory-Only Injection) | Runtime evaluator is sole authority | CP-01 (parity) |

### Article-to-Test Mapping

| Constitutional Article | Enforcement Tests |
|-----------------------|-------------------|
| Article II (Test-First) | All tests designed before implementation (this document) |
| Article VII (Traceability) | Every AC mapped to test IDs (Section 9 matrix) |
| Article IX (Quality Gate) | GATE-04 checklist (Section 11) |
| Article X (Fail-Open) | CE-26 to CE-30 (fail-open behavior on all error paths) |
| Article XI (Integration Testing) | EI-01 to EI-10, CP-01 to CP-06 (real evaluation, no mocks in integration) |
| Article XIII (Module System) | CJS tests in hooks/tests/ for state helpers; ESM tests in tests/core/ for evaluator |
| Article XIV (State Management) | SH-01 to SH-18 (contract_violations array integrity) |

---

## 10. Test File Organization

```
tests/
  core/
    validators/
      contract-schema.test.js              # CS-01 to CS-21 (unit)
      contract-loader.test.js              # CL-01 to CL-20 (unit)
      contract-evaluator.test.js           # CE-01 to CE-34 (unit)
      contract-ref-resolver.test.js        # RR-01 to RR-14 (unit)
      contract-generator.test.js           # CG-01 to CG-25 (unit)
      contract-evaluator-integration.test.js   # EI-01 to EI-10 (integration)
      contract-cross-provider.test.js      # CP-01 to CP-06 (integration)
      contract-generator-e2e.test.js       # GE-01 to GE-08 (integration)
      contract-override-resolution.test.js # OV-01 to OV-08 (integration)
      contract-performance.test.js         # PE-01 to PE-06 (performance)
      fixtures/
        contracts/
          valid-workflow-feature.contract.json
          valid-analyze.contract.json
          valid-discover.contract.json
          valid-add.contract.json
          malformed.contract.json
          stale.contract.json
          override-feature-phase06.contract.json
        config/
          artifact-paths.fixture.json
          skills-manifest.fixture.json
          roundtable.fixture.yaml

src/
  claude/
    hooks/
      tests/
        contract-state-helpers.test.cjs    # SH-01 to SH-18 (unit, CJS)
        phase-agent-map-guard.test.cjs     # PM-01 to PM-05 (guard, CJS)
```

---

## 11. GATE-04 Validation Checklist

- [x] Test strategy covers unit, integration, E2E, security, performance
- [x] Test cases exist for all 9 functional requirements (FR-001 through FR-009)
- [x] Test cases exist for all 46 acceptance criteria
- [x] Traceability matrix complete (100% requirement coverage)
- [x] Coverage targets defined (>=80% unit, 100% critical paths)
- [x] Test data strategy documented (fixtures, boundary values, invalid inputs, max-size inputs)
- [x] Critical paths identified (evaluator pipeline, state helpers, override resolution)
- [x] Fail-open behavior tested for all error paths (Article X)
- [x] Cross-provider parity tested (Article XI)
- [x] Performance budgets defined with measurement approach
- [x] Flaky test mitigation documented
- [x] Test files follow existing project conventions (ESM for core, CJS for hooks)
- [x] PHASE_AGENT_MAP export guarded with dedicated test (ADR-006)

---

## 12. Estimated Test Counts

| Category | Test Count (estimated) |
|----------|----------------------|
| Unit tests (Schema) | 21 |
| Unit tests (Loader) | 20 |
| Unit tests (Evaluator) | 34 |
| Unit tests (Resolver) | 14 |
| Unit tests (State Helpers) | 18 |
| Unit tests (Generator) | 25 |
| Unit tests (PHASE_AGENT_MAP guard) | 5 |
| Integration tests (Pipeline) | 10 |
| Integration tests (Cross-Provider) | 6 |
| Integration tests (Generator E2E) | 8 |
| Integration tests (Override) | 8 |
| Integration tests (Orchestrator Remediation) | 5 |
| Performance tests | 6 |
| Violation response tests | 3 |
| Banner format tests | 2 |
| **Total** | **~185** |

No decrease in existing test count. All new tests are additive.
