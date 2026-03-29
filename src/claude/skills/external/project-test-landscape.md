---
name: project-test-landscape
description: Distilled test landscape -- framework, coverage, gaps, patterns, fragile areas
skill_id: PROJ-004
owner: discover-orchestrator
collaborators: []
project: isdlc-framework
version: 1.0.0
when_to_use: When writing tests, evaluating coverage, or assessing test strategy
dependencies: []
---

# Project Test Landscape

## Test Framework and Config
- Runner: `node --test` (Node.js built-in, no external framework)
- Assertion: `node:assert` (strict mode)
- Config: package.json scripts (test, test:hooks, test:core, test:providers, test:e2e, test:all)
- Coverage tool: None configured (no nyc/c8/istanbul)
- CI: GitHub Actions, 3 OS (ubuntu, macos, windows) x 3 Node (20, 22, 24) matrix

## Coverage Summary
| Type | Count | Files | Notes |
|------|-------|-------|-------|
| Unit (lib/) | ~600 | 59 | CLI, embedding, search modules |
| Unit (hooks) | ~600 | 171 | Hooks, dispatchers, lib modules (CJS) |
| Unit (core) | ~250 | 89 | Provider-neutral core modules |
| Unit (providers) | ~100 | 19 | Claude + Codex adapters |
| Prompt verification | ~30 | 9 | Agent prompt content validation (3 FAIL) |
| E2E | ~10 | 2 | CLI lifecycle, status command |
| Verification/parity | ~50 | 8 | Golden tests, migration, performance benchmarks |
| Packages | ~50 | 8 | bulk-fs-mcp |
| **Total** | **1,600** | **365** | 99.8% pass rate (1,597 pass / 3 fail) |

## Known Gaps
- No formal code coverage tool -- cannot measure thresholds quantitatively (P1)
- 3 failing prompt-format tests in lib/prompt-format.test.js (stale content expectations) (P0)
- No E2E workflow lifecycle tests (feature/fix/upgrade flow untested) (P2)
- No embedding pipeline integration tests (28 modules, unit-only) (P2)
- src/core/bridge/ undercovered (18 modules, 6 test files) (P3)
- No mutation testing configured (P3)

## Fragile Areas
- lib/prompt-format.test.js: Tests assert exact string content in CLAUDE.md / README; breaks when content changes
- Hook tests (77K lines): Disproportionately large; shared test helpers could reduce duplication
- State.json schema tests: Tightly coupled to exact schema shape; schema evolution requires test updates

## Test Patterns
- Co-located tests: lib/*.test.js alongside lib/*.js (same directory)
- Mirror structure: tests/core/ mirrors src/core/ directory hierarchy
- Fixture files: tests/core/fixtures/, tests/core/validators/fixtures/
- Parity tests: tests/verification/parity/ ensures Claude and Codex produce equivalent output
- Golden tests: tests/verification/golden.test.js compares output against baseline
- Performance benchmarks: tests/verification/performance/benchmarks.test.js
- CJS hook tests use `describe`/`it` pattern via `node:test` API
- ESM tests use `test()`/`describe()` from `node:test`

## Provenance
- **Source**: docs/isdlc/test-evaluation-report.md
- **Distilled**: 2026-03-28
- **Discovery run**: full
