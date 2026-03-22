# Test Strategy: Analyze Model Batch (REQ-0108..0113)

**Phase**: 05-test-strategy | **Date**: 2026-03-22
**Covers**: REQ-0108, REQ-0109, REQ-0110, REQ-0111, REQ-0112, REQ-0113

---

## 1. Scope

6 frozen pure-data modules in `src/core/analyze/`, 1 barrel index, and 1 CJS bridge.
Same pattern as `src/core/discover/` — frozen objects, registry functions, no runtime logic.

## 2. Test Framework

- **Runner**: `node:test` (built-in, matches existing `tests/core/discover/*.test.js`)
- **Assertions**: `node:assert/strict`
- **Command**: `npm run test:core` (glob: `tests/core/**/*.test.js`)
- **Coverage**: Node.js built-in `--experimental-test-coverage`

## 3. Test File Map

| Module Source | Test File | Test ID Prefix | Req |
|---|---|---|---|
| `src/core/analyze/lifecycle.js` | `tests/core/analyze/lifecycle.test.js` | LC- | REQ-0108 |
| `src/core/analyze/state-machine.js` | `tests/core/analyze/state-machine.test.js` | SM- | REQ-0109 |
| `src/core/analyze/artifact-readiness.js` | `tests/core/analyze/artifact-readiness.test.js` | AR- | REQ-0110 |
| `src/core/analyze/memory-model.js` | `tests/core/analyze/memory-model.test.js` | MM- | REQ-0111 |
| `src/core/analyze/finalization-chain.js` | `tests/core/analyze/finalization-chain.test.js` | FC- | REQ-0112 |
| `src/core/analyze/inference-depth.js` | `tests/core/analyze/inference-depth.test.js` | ID- | REQ-0113 |
| `src/core/bridge/analyze.cjs` | `tests/core/analyze/bridge-analyze.test.js` | AB- | REQ-0108..0113 |

## 4. Test Categories per Module

Each module test file covers 3 categories:

1. **Data correctness** — exported objects match design spec values exactly
2. **Registry functions** — return correct data, handle edge cases (unknown keys return null)
3. **Immutability** — `Object.isFrozen()` on all exported objects and nested arrays/objects

## 5. Acceptance Criteria Coverage

### REQ-0108 (lifecycle.js) — 12 tests
- AC-001-01..04: Entry routing model fields (flags, staleness, sizing, classification, routing)
- AC-002-01..03: Prefetch graph (6 groups, fields, parallel flags)
- AC-003-01..03: Bug/feature signals lists, case-insensitive note
- AC-004-01..03: Registry function returns

### REQ-0109 (state-machine.js) — 14 tests
- AC-001-01..02: STATES enum (7 values), EVENTS enum (3 values)
- AC-002-01..03: Transition table correctness, invalid transitions return null
- AC-003-01..03: Tier paths (standard=3, light=2, trivial=1)
- AC-004-01..03: Registry functions

### REQ-0110 (artifact-readiness.js) — 10 tests
- AC-001-01..03: Readiness rules for 4 artifacts
- AC-002-01..03: Topic DAG edges, ordering
- AC-003-01..03: Write strategy config flags
- AC-004-01..03: Registry functions, unknown artifact returns null

### REQ-0111 (memory-model.js) — 10 tests
- AC-001-01..02: Layer schema (3 layers with paths/format/fail_open)
- AC-002-01..03: Merge rules (priority, threshold, strategy)
- AC-003-01..03: Search config (prefer, fallback, fail_open)
- AC-004-01..02: Enrichment pipeline (4 steps, order)
- AC-005-01..04: Registry functions

### REQ-0112 (finalization-chain.js) — 10 tests
- AC-001-01..02: 6-step chain, ordering, depends_on
- AC-002-01..03: Step schema fields, sync/async classification
- AC-003-01..03: Provider classification
- AC-004-01..03: Registry functions (all, neutral, async)

### REQ-0113 (inference-depth.js) — 12 tests
- AC-001-01..02: Confidence enum (3 levels with weights)
- AC-002-01..03: Depth guidance per topic (4 topics, 3 depths each)
- AC-003-01..02: Coverage guardrails per depth
- AC-004-01..02: Depth adjustment signals (shallower/deeper)
- AC-005-01..04: Registry functions, unknown topic returns null

### Bridge (analyze.cjs) — 7 tests
- Export existence for all registry functions
- Parity with ESM for key functions

## 6. Coverage Target

- **Line coverage**: >= 95% (frozen data modules are near-100% by nature)
- **Branch coverage**: >= 90% (registry function null-return branches)

## 7. Risk Mitigation

- **Low risk**: Pure data modules, no I/O, no side effects
- **Frozen object testing**: Verify `Object.isFrozen()` at every nesting level
- **Regression**: New tests extend the existing `npm run test:core` suite (721 passing)

## 8. Execution Plan

1. Write all 7 test files (TDD Red)
2. Write all 8 production files (TDD Green)
3. Run `npm run test:core` — all new + existing tests pass
4. Verify no existing tests broken (721 baseline preserved)
