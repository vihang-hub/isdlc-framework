# Implementation Notes: Vertical Spike -- Implementation Loop Shared Core Slice

**Item**: REQ-0076 | **Phase**: 06-implementation | **Date**: 2026-03-21

---

## 1. Files Created

| File | Type | Description |
|------|------|-------------|
| `src/core/state/index.js` | ESM | Minimal StateStore: readState, writeState, getProjectRoot |
| `src/core/teams/implementation-loop.js` | ESM | ImplementationLoop class with full loop orchestration |
| `src/core/teams/contracts/writer-context.json` | JSON Schema | WRITER_CONTEXT contract |
| `src/core/teams/contracts/review-context.json` | JSON Schema | REVIEW_CONTEXT contract |
| `src/core/teams/contracts/update-context.json` | JSON Schema | UPDATE_CONTEXT contract |
| `src/core/bridge/state.cjs` | CJS bridge | Dynamic import wrapper for state module |
| `src/core/bridge/teams.cjs` | CJS bridge | Dynamic import wrapper for ImplementationLoop |

## 2. Test Files

| File | Test Count | Coverage |
|------|-----------|----------|
| `tests/core/state/state-store.test.js` | 11 | StateStore unit tests (ST-01 through ST-11) |
| `tests/core/teams/contracts.test.js` | 11 | Contract schema validation (CS-01 through CS-11) |
| `tests/core/teams/implementation-loop.test.js` | 26 | ImplementationLoop unit tests (IL-01 through IL-26) |
| `tests/core/teams/implementation-loop-parity.test.js` | 8 | Integration/parity tests (PT-01 through PT-08) |
| **Total** | **56** | **All passing** |

## 3. Coverage Results

| Metric | Value | Target |
|--------|-------|--------|
| Line coverage | 97.29% | >=80% |
| Branch coverage | 84.85% | >=75% |
| Function coverage | 95.65% | >=80% |

## 4. Key Implementation Decisions

### 4.1 Atomic Write Strategy (FR-003, AC-003-02)

writeState uses write-to-temp-then-rename in the same `.isdlc/` directory. This ensures:
- No partial writes (rename is atomic on all major filesystems)
- Serialization errors (e.g., circular references) are caught before any file I/O
- Temp files are cleaned up on rename failure

### 4.2 TDD Ordering Algorithm (FR-002, AC-002-01)

The `_applyTddOrdering` method pairs source files with test files by base name matching:
- `src/widget.js` pairs with `tests/widget.test.js`
- Pairs are emitted as [test, source] to ensure test-first ordering
- Unpaired files (tests or sources without a match) are appended at the end

### 4.3 CJS Bridge Pattern (FR-001, AC-001-02)

Per ADR-CODEX-006, the core is ESM. CJS consumers use bridge files that:
- Lazy-load via `await import()` (first call only)
- Cache the module reference for subsequent calls
- Expose the same API as the ESM module (all methods return Promises)

### 4.4 Contract Schema Design (FR-004, AC-004-01)

Schemas use JSON Schema draft 2020-12 with `additionalProperties: false` to enforce strict shapes. The `const` keyword enforces fixed values (e.g., `mode: "writer"`, `reviewer_verdict: "REVISE"`).

A minimal in-test validator checks required fields, const constraints, type, and min/max -- sufficient for this spike without adding a JSON Schema library dependency.

### 4.5 Verdict Routing (FR-002, AC-002-01)

processVerdict implements the decision tree:
- PASS: mark file complete, advance index. If last file, return "complete".
- REVISE: check cycle count. If at max_cycles, return "fail". Otherwise increment cycle, return "update".

## 5. Traceability

| Requirement | Implementation |
|-------------|---------------|
| FR-001 (AC-001-01) | `src/core/` scaffold with state/, teams/, bridge/ |
| FR-001 (AC-001-02) | ESM core + CJS bridge wrappers |
| FR-002 (AC-002-01) | ImplementationLoop class with file ordering, cycles, verdicts |
| FR-002 (AC-002-02) | LoopState tracks current_file_index, cycle_per_file, completed_files, verdicts |
| FR-002 (AC-002-03) | TeamSpec validated in constructor |
| FR-003 (AC-003-01) | readState/writeState in src/core/state/index.js |
| FR-003 (AC-003-02) | Atomic write via temp file + rename |
| FR-004 (AC-004-01) | JSON schemas in src/core/teams/contracts/ |
| FR-004 (AC-004-02) | Schemas enforce exact shapes with const, type, required |
| FR-005 (AC-005-01) | Agent files not modified (out of scope for this spike) |
| FR-005 (AC-005-02) | Core provides drop-in loop logic for quality-loop-engineer |
| FR-005 (AC-005-03) | Parity tests (PT-01 through PT-08) validate identical behavior |
