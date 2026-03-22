# Code Review Report -- REQ-0134 + REQ-0135 ProviderRuntime Adapters

**Phase**: 08-code-review
**Scope**: Human Review Only (Phase 06 implementation loop completed)
**Date**: 2026-03-22
**Reviewer**: QA Engineer (Phase 08)

---

## 1. Scope & Methodology

This review covers 4 new files and 1 modified file introduced by the REQ-0134 (Claude) and REQ-0135 (Codex) provider runtime adapter batch:

| File | Type | Lines |
|------|------|-------|
| `src/providers/claude/runtime.js` | New production | ~193 |
| `src/providers/codex/runtime.js` | New production | ~299 |
| `tests/providers/claude/runtime.test.js` | New test | ~382 |
| `tests/providers/codex/runtime.test.js` | New test | ~554 |
| `tests/core/orchestration/provider-runtime.test.js` | Modified test | 1 assertion updated |

**Review mode**: Human Review Only. The per-file implementation loop in Phase 06 already validated logic correctness, error handling, per-file security, code quality, test quality, and tech-stack alignment. This review focuses on cross-cutting concerns: architecture coherence, business logic coherence, design pattern compliance, integration correctness, and requirement completeness.

---

## 2. Architecture Decisions

### 2.1 Delegation Shim vs Real Execution (PASS)

The Claude adapter is intentionally a delegation shim -- it structures prompts and returns `{ status: 'delegated' }` rather than spawning processes. This is architecturally sound: Claude Code's Task tool invocation happens at the isdlc.md orchestration layer, so the runtime adapter only needs to prepare the delegation payload. The Codex adapter, in contrast, actually spawns `codex exec` processes via `child_process.execFile`, which is correct for an external CLI tool.

This asymmetry is properly documented in the architecture-overview.md and implementation-notes.md.

### 2.2 Dependency Injection Pattern (PASS)

Both adapters use constructor injection via the config object (`_execSync`, `_execFile`, `_spawn`, `_readline`, `_projectInstructions`). This avoids ESM module mocking complexity and keeps tests fast and deterministic. The pattern is consistent across both adapters and with the existing provider infrastructure.

### 2.3 Interface Contract Integration (PASS)

Both adapters are validated by `validateProviderRuntime()` from `src/core/orchestration/provider-runtime.js`. The dynamic import path `createProviderRuntime('claude', config)` was verified to work end-to-end during this review. Both adapters export `createRuntime` as expected by the factory in the interface contract module.

---

## 3. Business Logic Coherence

### 3.1 Claude Adapter (PASS)

The Claude adapter implements exactly the behavior described in its requirements spec:
- `executeTask` builds a prompt from phase/agent/context and returns a delegation intent
- `executeParallel` uses `Promise.allSettled` with per-task error isolation
- `presentInteractive` returns a structured `{ type: 'interactive', prompt }` intent
- `readUserResponse` returns a structured `{ type: 'user_input', options }` intent
- `validateRuntime` checks for the `claude` CLI via `which`

The `buildPrompt` helper correctly assembles optional sections (artifact_folder, workflow_type, instructions, skill_context) only when present.

### 3.2 Codex Adapter (PASS)

The Codex adapter follows its spec:
- `executeTask` calls `projectInstructions()` to build an instruction bundle, then invokes `codex exec`
- Fail-open on projection failure (falls back to minimal instruction)
- JSON parsing of stdout with string fallback
- `readUserResponse` supports numbered choice selection with validation
- `presentInteractive` uses spawn with stdin/stdout piping

### 3.3 Cross-Adapter Consistency (PASS)

Both adapters share the same method signatures and return types. The `executeParallel` implementation is nearly identical (Promise.allSettled with same error mapping), which is appropriate since it is a thin wrapper over `executeTask`.

---

## 4. Design Pattern Compliance

### 4.1 Fail-Open Pattern (PASS)

Both adapters correctly implement fail-open (Constitution Article X):
- `validateRuntime()` catches errors and returns `{ available: false, reason }` instead of throwing
- Codex `executeTask` catches projection errors and falls back to minimal instructions
- Codex `spawnAsync` resolves (never rejects) even on spawn errors

### 4.2 Factory Pattern (PASS)

Both use the same `createRuntime(config)` factory pattern that returns an object literal with closures over the injected dependencies. This is the simplest possible approach (Article V) -- no class hierarchies, no prototype chains.

### 4.3 Frozen Constants (PASS)

The Claude adapter freezes `PHASE_AGENT_MAP` with `Object.freeze()`, consistent with the interface contract module's treatment of `PROVIDER_RUNTIME_INTERFACE` and related constants.

---

## 5. Integration Points

### 5.1 Interface Contract <-> Adapters (PASS)

Verified that `createProviderRuntime('claude', config)` and `createProviderRuntime('codex', config)` both:
1. Dynamically import the correct runtime.js file
2. Call `createRuntime(config)` on the module
3. Pass `validateProviderRuntime()` validation
4. Return a fully functional runtime object

### 5.2 Codex Projection Integration (PASS)

The Codex adapter imports `projectInstructions` from `./projection.js` and calls it with `(phase, agent, { workflow, projectRoot })`. The projection module exists at the expected path. Test XRT-32 verifies the instruction content flows through to `codex exec` args, and XRT-33 verifies graceful fallback on projection failure.

### 5.3 Modified Test File (PASS)

`tests/core/orchestration/provider-runtime.test.js` PR-24 was correctly updated: it previously asserted that provider runtime does NOT load (comment: "No provider runtime.js files exist yet"), and now asserts it loads successfully. This is the expected change given that runtime.js files now exist.

---

## 6. Requirement Completeness

### REQ-0134 (Claude Adapter)

| Requirement | Status | Evidence |
|------------|--------|----------|
| FR-001: createRuntime(config) | IMPLEMENTED | CRT-01..CRT-05 |
| FR-002: executeTask | IMPLEMENTED | CRT-06..CRT-11 |
| FR-003: executeParallel | IMPLEMENTED | CRT-12..CRT-16 |
| FR-004: presentInteractive | IMPLEMENTED | CRT-17..CRT-19 |
| FR-005: readUserResponse | IMPLEMENTED | CRT-20..CRT-22 |
| FR-006: validateRuntime | IMPLEMENTED | CRT-23..CRT-26 |

All 6 functional requirements implemented. 33 tests covering all acceptance criteria.

### REQ-0135 (Codex Adapter)

| Requirement | Status | Evidence |
|------------|--------|----------|
| FR-001: createRuntime(config) | IMPLEMENTED | XRT-01..XRT-04 |
| FR-002: executeTask | IMPLEMENTED | XRT-05..XRT-13 |
| FR-003: executeParallel | IMPLEMENTED | XRT-14..XRT-18 |
| FR-004: presentInteractive | IMPLEMENTED | XRT-19..XRT-21 |
| FR-005: readUserResponse | IMPLEMENTED | XRT-22..XRT-27 |
| FR-006: validateRuntime | IMPLEMENTED | XRT-28..XRT-31 |
| FR-007: Projection integration | IMPLEMENTED | XRT-32..XRT-33 |

All 7 functional requirements implemented. 35 tests covering all acceptance criteria.

---

## 7. Findings

### 7.1 LOW: `which` command is not cross-platform (Windows)

**File**: `src/providers/claude/runtime.js:185`, `src/providers/codex/runtime.js:291`
**Category**: Cross-platform compatibility (Article XII)
**Severity**: LOW
**Description**: Both adapters use `which claude` / `which codex` for CLI discovery. The `which` command is available on macOS and Linux but not natively on Windows (where `where.exe` is the equivalent).
**Mitigating factor**: The `validateRuntime()` method wraps the call in try/catch and returns `{ available: false }` on failure, so this does not crash on Windows -- it simply reports the CLI as unavailable. Additionally, neither Claude Code nor Codex CLI currently has official Windows support, so this is a future concern rather than a current blocker.
**Suggestion**: When Windows support becomes relevant, consider using `process.platform === 'win32' ? 'where' : 'which'` or a cross-platform lookup package. Not blocking.

### 7.2 INFO: Module design doc mentions `which`/`where` but code only uses `which`

**File**: `docs/requirements/REQ-0134-claude-runtime-adapter/module-design.md:31`
**Category**: Documentation currency (Article VIII)
**Severity**: INFO
**Description**: The module design document states `validateRuntime()` checks via `which`/`where`, implying cross-platform handling. The actual implementation only uses `which`. This is a minor documentation imprecision -- the design anticipated Windows support that the current implementation does not yet include. Not blocking, but noted for future alignment.

---

## 8. Test Summary

| Suite | Tests | Pass | Fail | Duration |
|-------|-------|------|------|----------|
| Claude runtime (CRT-01..CRT-33) | 33 | 33 | 0 | 52ms |
| Codex runtime (XRT-01..XRT-35) | 35 | 35 | 0 | (included above) |
| Interface contract (PR-01..PR-36) | 36 | 36 | 0 | 41ms |
| **Total new** | **68** | **68** | **0** | -- |
| Core suite (full) | 981 | 981 | 0 | 858ms |
| Provider suite (full) | 161 | 161 | 0 | 2835ms |

Zero regressions. Zero test failures.

---

## 9. Constitutional Compliance

| Article | Status | Notes |
|---------|--------|-------|
| V (Simplicity First) | COMPLIANT | Claude adapter is a minimal ~193-line shim. Codex adapter is ~299 lines with necessary child_process wrappers. No over-engineering. Factory returns object literal, no class hierarchy. |
| VI (Code Review Required) | COMPLIANT | This document constitutes the code review. |
| VII (Artifact Traceability) | COMPLIANT | All test IDs (CRT-/XRT-) trace to FR numbers and AC identifiers. JSDoc in both runtime files references REQ-0134/0135. Implementation-notes.md provides full traceability matrix. |
| VIII (Documentation Currency) | COMPLIANT | Architecture overview, module design, implementation notes, and test strategy all current. Minor imprecision in module-design.md noted as INFO finding (non-blocking). |
| IX (Quality Gate Integrity) | COMPLIANT | All 68 tests pass. Interface contract tests pass. Dynamic import integration verified. Build integrity confirmed. |
| XIII (Module System Consistency) | COMPLIANT | Both runtime files use ESM (`import`/`export`). They are in `src/providers/` (not hooks), so ESM is correct per Article XIII. No CommonJS require statements. |

---

## 10. Verdict

**QA APPROVED**

- 0 critical findings
- 0 high findings
- 1 low finding (cross-platform `which` -- non-blocking, fail-open mitigated)
- 1 info finding (minor doc imprecision)
- 68/68 new tests passing
- 0 regressions across 1142 total tests
- All 13 functional requirements (6 + 7) implemented and tested
- Constitutional articles V, VI, VII, VIII, IX, XIII all compliant

The code is ready for merge to main.
