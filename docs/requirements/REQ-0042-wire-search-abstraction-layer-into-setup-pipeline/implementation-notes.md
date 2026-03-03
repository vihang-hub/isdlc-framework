# Implementation Notes: Wire Search Abstraction Layer into Setup Pipeline

**Requirement**: REQ-0042
**Phase**: 06 - Implementation
**Last Updated**: 2026-03-03
**Status**: Complete

---

## Implementation Summary

This implementation wires the existing search abstraction layer (lib/search/) into the iSDLC setup pipeline as Step 8 of the installer, and adds Enhanced Search sections to 6 agent markdown files.

### Files Created

| File | Purpose | Lines |
|------|---------|-------|
| `lib/setup-search.js` | Core orchestration: `setupSearchCapabilities()` and `buildSearchConfig()` | ~168 |
| `lib/setup-search.test.js` | Unit tests for setup-search module | ~350 |
| `tests/prompt-verification/search-agent-migration.test.js` | Agent markdown validation tests | ~275 |

### Files Modified

| File | Change | Lines Changed |
|------|--------|---------------|
| `lib/cli.js` | Added `--no-search-setup` flag parsing, help text, `parseArgs` export | ~10 |
| `lib/cli.test.js` | Added parseArgs unit tests and help text validation | ~40 |
| `lib/installer.js` | Added import, step renumbering (7/7 to 8/8), Step 8 call site | ~8 |
| `src/claude/agents/quick-scan/quick-scan-agent.md` | Added Enhanced Search section | ~15 |
| `src/claude/agents/impact-analysis/impact-analyzer.md` | Added Enhanced Search section | ~10 |
| `src/claude/agents/impact-analysis/entry-point-finder.md` | Added Enhanced Search section | ~10 |
| `src/claude/agents/impact-analysis/risk-assessor.md` | Added Enhanced Search section | ~10 |
| `src/claude/agents/discover/architecture-analyzer.md` | Added Enhanced Search section | ~12 |
| `src/claude/agents/discover/feature-mapper.md` | Added Enhanced Search section | ~12 |

### Files NOT Modified (Constraint)

All `lib/search/*.js` modules remain untouched per the requirement constraint. The 180 existing tests continue to pass.

---

## Key Design Decisions

### ADR-001: Dependency Injection for Testability

`setupSearchCapabilities()` accepts an optional `context` parameter with `logger` and `deps` overrides. This allows unit tests to mock all search module dependencies without ESM module-level mocking (which is unreliable in Node.js).

### ADR-002: Additive Agent Markdown Changes

All 6 agent files received an `# ENHANCED SEARCH` or `## ENHANCED SEARCH` section added before the Error Handling section. No frontmatter was modified. Existing Grep/Glob/find patterns remain as the baseline fallback.

### ADR-003: Fail-Open Wrapper

The entire Step 8 is wrapped in a single try-catch. Any error (detection failure, installation failure, MCP config failure, config write failure) produces a warning log and allows the installer to continue. This ensures search setup never blocks framework installation.

---

## Test Results

| Test Suite | Tests | Pass | Fail | Coverage |
|------------|-------|------|------|----------|
| lib/setup-search.test.js | 21 | 21 | 0 | 100% lines |
| lib/cli.test.js (new tests) | 7 | 7 | 0 | 92.94% lines |
| search-agent-migration.test.js | 19 | 19 | 0 | N/A (markdown) |
| lib/search/*.test.js (existing) | 180 | 180 | 0 | 96.59% lines |
| **Total new tests** | **47** | **47** | **0** | |

### Coverage for New Code

```
File             | % Stmts | % Branch | % Funcs | % Lines
-----------------|---------|----------|---------|---------
setup-search.js  |   100   |   95.65  |    75   |   100
cli.js           |   92.94 |   73.91  |   100   |  92.94
```

---

## Requirement Traceability

| FR | Implementation | Test |
|----|---------------|------|
| FR-001 (Setup Pipeline Integration) | `setupSearchCapabilities()` in lib/setup-search.js | TC-U-001 through TC-U-012 |
| FR-002 (CLI Flag Support) | `--no-search-setup` in lib/cli.js parseArgs | TC-U-017 through TC-U-022 |
| FR-003 (Detection Step) | Detection call in setupSearchCapabilities() | TC-U-001, TC-U-005, TC-U-010 |
| FR-004 (Installation Step) | Install loop in setupSearchCapabilities() | TC-U-003, TC-U-006, TC-U-007, TC-U-011, TC-U-012 |
| FR-005 (Configuration Persistence) | writeSearchConfig() call, buildSearchConfig() | TC-U-013 through TC-U-016 |
| FR-006 (Agent Migration) | Enhanced Search sections in 6 agent .md files | TC-U-026 through TC-U-037 |
| FR-007 (Fail-Open Behavior) | try-catch wrapper in setupSearchCapabilities() | TC-U-005, TC-U-008, TC-U-009 |
