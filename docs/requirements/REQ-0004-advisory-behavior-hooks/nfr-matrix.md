# Non-Functional Requirements Matrix: REQ-0004

**Feature:** Advisory Behavior Hooks
**Date:** 2026-02-08

---

## NFR Summary

| ID | Category | Requirement | Target | Verification Method |
|----|----------|-------------|--------|---------------------|
| NFR-01 | Reliability | Fail-open behavior | 100% of hooks | Unit test: error injection |
| NFR-02a | Performance | PreToolUse latency | < 10s (timeout) | CI timing assertion |
| NFR-02b | Performance | PostToolUse latency | < 5s (timeout) | CI timing assertion |
| NFR-02c | Performance | File I/O per hook call | 1 state.json read max | Code review |
| NFR-03a | Compatibility | CJS module system | .cjs extension | File extension check |
| NFR-03b | Compatibility | Node.js versions | 18, 20, 22 | CI matrix |
| NFR-03c | Compatibility | Operating systems | macOS, Linux, Windows | CI matrix |
| NFR-03d | Compatibility | Dependencies | 0 (builtins only) | package.json audit |
| NFR-04a | Testability | Test co-location | tests/*.test.cjs | Glob check |
| NFR-04b | Testability | Test runner | node:test | Import check |
| NFR-04c | Testability | Min test cases per hook | >= 10 | Test count |
| NFR-04d | Testability | Protocol simulation | stdin/stdout JSON | Test pattern |
| NFR-05a | Stability | Existing test suite | 0 regressions | Full test run |
| NFR-05b | Stability | Existing hooks | No breakage | Integration test |
| NFR-05c | Stability | settings.json order | Preserved | Diff check |

## Constitutional Article Mapping

| NFR | Constitutional Article | Rationale |
|-----|------------------------|-----------|
| NFR-01 | Article X (Fail-Safe Defaults) | Hooks must never block on infrastructure failure |
| NFR-02 | Article V (Simplicity First) | No unnecessary complexity in hook logic |
| NFR-03a | Article XII (Dual Module System) | CJS for hooks, ESM for CLI |
| NFR-03d | Article V (Simplicity First) | No third-party dependencies |
| NFR-04a | Article II (Test-First Development) | Tests co-located with production code |
| NFR-04b | Article II (Test-First Development) | node:test is the standard runner |
| NFR-04d | Article XI (Integration Testing) | Real protocol simulation, no mocking |
| NFR-05 | Article IX (Quality Gate Integrity) | Gates cannot be weakened |

## Risk Matrix

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Hook blocks legitimate user work | High | Medium | NFR-01: fail-open on all errors |
| Hook performance degrades UX | Medium | Low | NFR-02: single file read, no network |
| New hooks break existing hooks | High | Low | NFR-05: full regression test |
| Windows path handling breaks | Medium | Medium | NFR-03c: CI matrix validation |
| False positives on phase detection | Medium | Medium | Conservative pattern matching, allow on uncertainty |
