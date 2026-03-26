# Implementation Notes: Execution Contract System

**Slug**: REQ-0141-phase-work-guard-hook
**Phase**: 06 - Implementation
**Date**: 2026-03-26

---

## 1. Implementation Summary

Implemented the Execution Contract System per the module design specification. The system provides unified contract-based enforcement for deterministic execution across all contexts (workflow phases, analyze, discover, add) and providers (Claude, Codex).

### Modules Implemented

| Module | File | LOC (approx) | Status |
|--------|------|------|--------|
| Contract Schema | `src/core/validators/contract-schema.js` | 110 | Complete |
| Reference Resolver | `src/core/validators/contract-ref-resolver.js` | 120 | Complete |
| Contract Loader | `src/core/validators/contract-loader.js` | 130 | Complete |
| Contract Evaluator | `src/core/validators/contract-evaluator.js` | 250 | Complete |
| State Helpers | `.claude/hooks/lib/common.cjs` (additions) | 70 | Complete |
| Contract Generator | `bin/generate-contracts.js` | 320 | Complete |
| Codex Runtime Adapter | `src/providers/codex/runtime.js` (modifications) | 30 | Complete |
| Codex Governance | `src/providers/codex/governance.js` (modifications) | 10 | Complete |
| Codex Projection | `src/providers/codex/projection.js` (modifications) | 45 | Complete |
| Installer | `src/core/installer/index.js`, `lib/installer.js` | 2 | Complete |

### Test Files

| Test File | Tests | Framework |
|-----------|-------|-----------|
| `tests/core/validators/contract-schema.test.js` | 21 | ESM (node:test) |
| `tests/core/validators/contract-ref-resolver.test.js` | 14 | ESM |
| `tests/core/validators/contract-loader.test.js` | 20 | ESM |
| `tests/core/validators/contract-evaluator.test.js` | 39 | ESM |
| `tests/core/validators/contract-generator.test.js` | 25 | ESM |
| `tests/core/validators/contract-evaluator-integration.test.js` | 10 | ESM |
| `tests/core/validators/contract-cross-provider.test.js` | 6 | ESM |
| `src/claude/hooks/tests/contract-state-helpers.test.cjs` | 18 | CJS |
| `src/claude/hooks/tests/phase-agent-map-guard.test.cjs` | 5 | CJS |
| **Total** | **158** | |

---

## 2. Key Implementation Decisions

### 2.1 PHASE_AGENT_MAP Export (ADR-006)

`PHASE_AGENT_MAP` was already defined at line 2503 in `common.cjs` but was NOT exported in `module.exports`. Added it to the exports block and created a guarding test (`phase-agent-map-guard.test.cjs`) that verifies the export exists and contains all expected phase keys. This prevents accidental removal.

Note: There is also a `PHASE_TO_AGENT_MAP` (smaller subset) that was already exported. Both are now exported. `PHASE_AGENT_MAP` is the canonical complete map per ADR-006.

### 2.2 State Helpers Pattern (ADR-004)

The new state helpers (`writeContractViolation`, `readContractViolations`, `clearContractViolations`) follow the in-memory mutator pattern established by `addPendingEscalation` at line 3198. Pure in-memory mutation, caller persists.

Dedup key: `${contract_id}:${expectation_type}` -- different from escalations which dedup by `hook+phase+type` within a time window.

### 2.3 Evaluator Fail-Open Design (Article X)

Every check in the evaluator is wrapped in try/catch. The outermost handler ensures that even catastrophic errors (null params, type errors) return the safe default `{ violations: [], warnings: [...], stale_contract: false }`. This is tested by CE-26 through CE-30.

### 2.4 Codex Integration (ADR-001, ADR-008)

- `runtime.js`: `validatePhaseGate()` now loads and evaluates contracts as an additive step after `validatePhase()`. Block violations cause `pass: false`.
- `governance.js`: Added `execution-contract` to the enforceable checkpoints array.
- `projection.js`: Added advisory-only contract summary injection via `loadContractSummary()`. This is informational, not enforcement (ADR-008).

### 2.5 Generator Determinism (AC-002-03)

The generator uses `deterministicStringify()` which sorts object keys at every level. Entries are sorted by `execution_unit`. Input files are sorted by path. The only non-deterministic field is `_generation_metadata.generated_at` (timestamps differ between runs), but entry content is identical.

---

## 3. Deviations from Design

None. Implementation matches the module design specification exactly.

---

## 4. Test Coverage

- 158 tests across 9 test files
- All 158 tests passing
- 0 regressions in existing test suites (providers: 249/249, core: 1298/1299 with 1 pre-existing failure)
- Coverage areas: schema validation, reference resolution, contract loading/override, contract evaluation (agent, skills, artifacts, state, presentation, cleanup), state helpers (FIFO, dedup), generator (all contexts), integration pipeline, cross-provider parity
